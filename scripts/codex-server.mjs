#!/usr/bin/env node

// Copy AI ID → Codex local server.
//
// Receives the notebook prompt from the extension (via its background service
// worker), resolves which local project the inspected page belongs to, and
// runs `codex exec` inside that project with automatic git commits around the
// run. Response shapes mirror src/shared/codex.ts.
//
// Start with: npm run codex-server   (or scripts/start-codex-server.sh)

import { execFile, spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { existsSync, statSync, writeFileSync } from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

const HOST = '127.0.0.1';
const PORT = parsePort(process.env.COPY_AI_ID_CODEX_SERVER_PORT ?? '45130');
const CODEX_BIN = process.env.CODEX_BIN ?? 'codex';
const CODEX_TIMEOUT_MS = parsePositiveInt(
  process.env.COPY_AI_ID_CODEX_TIMEOUT_MS ?? '300000',
  'COPY_AI_ID_CODEX_TIMEOUT_MS',
);
const ALLOW_OUTSIDE_HOME = process.env.COPY_AI_ID_ALLOW_OUTSIDE_HOME === '1';
const VALID_REASONING_EFFORTS = new Set(['medium', 'high', 'xhigh']);
const DEFAULT_REASONING_EFFORT = VALID_REASONING_EFFORTS.has(process.env.COPY_AI_ID_CODEX_REASONING)
  ? process.env.COPY_AI_ID_CODEX_REASONING
  : 'medium';
// Fast mode = the `fast` (runtime: `priority`) service tier, independent of
// reasoning effort. Requires both the feature flag and the tier request; the
// request is ignored gracefully by models that don't support the tier.
// Always on; COPY_AI_ID_CODEX_FAST=0 is the escape hatch.
const FAST_MODE = process.env.COPY_AI_ID_CODEX_FAST !== '0';
// Optional model override (`-m`); empty = the account's default model.
const CODEX_MODEL = process.env.COPY_AI_ID_CODEX_MODEL ?? '';

const CLIENT_HEADER = 'x-copy-ai-id-client';
const MAX_BODY_BYTES = 2 * 1024 * 1024;
const MAX_PROMPT_CHARS = 200000;
const MAX_OUTPUT_CHARS = 20000;
const MAX_FINISHED_RUNS = 20;
const MAX_RUN_EVENTS = 500;
const MAX_EVENT_TEXT_CHARS = 400;
const HOME_DIR = os.homedir();

const DEFAULT_GITIGNORE = `node_modules/
dist/
build/
output/
.DS_Store
*.log
.env
.env.*
`;

/** @type {Map<string, { id: string, status: 'running' | 'done', result: object | null, startedAt: number }>} */
const runs = new Map();
let activeRunId = null;

const server = http.createServer((request, response) => {
  void handleRequest(request, response).catch((error) => {
    writeJson(response, 500, {
      ok: false,
      code: 'server-error',
      error: error instanceof Error ? error.message : String(error),
    }, request);
  });
});

server.on('error', (error) => {
  if (error && error.code === 'EADDRINUSE') {
    console.error(`codex-server: port ${PORT} is already in use.`);
    console.error('Stop the other process or set COPY_AI_ID_CODEX_SERVER_PORT.');
    process.exit(1);
  }
  throw error;
});

server.listen(PORT, HOST, () => {
  console.log('Copy AI ID → Codex local server');
  console.log(`  endpoint : http://${HOST}:${PORT}`);
  console.log(`  codex    : ${CODEX_BIN}`);
  console.log(`  timeout  : ${CODEX_TIMEOUT_MS}ms`);
  console.log('');
  console.log('Keep this terminal open. The extension\'s "Send to Codex" button talks to this server.');
  void warnIfCodexMissing();
});

async function warnIfCodexMissing() {
  try {
    await execFileAsync(CODEX_BIN, ['--version'], { timeout: 10000 });
  } catch {
    console.warn('');
    console.warn(`warning: could not run "${CODEX_BIN} --version".`);
    console.warn('Install the Codex CLI or set CODEX_BIN to its path.');
  }
}

async function handleRequest(request, response) {
  const url = new URL(request.url ?? '/', `http://${HOST}:${PORT}`);

  if (request.method === 'OPTIONS') {
    writeCorsPreflight(response, request);
    return;
  }

  if (!getHeaderValue(request, CLIENT_HEADER)) {
    writeJson(response, 403, {
      ok: false,
      code: 'invalid-request',
      error: `Missing ${CLIENT_HEADER} header.`,
    }, request);
    return;
  }

  if (request.method === 'GET' && url.pathname === '/health') {
    const active = activeRunId ? runs.get(activeRunId) : null;
    writeJson(response, 200, {
      ok: true,
      service: 'copy-ai-id-codex-server',
      running: Boolean(active && active.status === 'running'),
    }, request);
    return;
  }

  if (request.method === 'POST' && url.pathname === '/resolve-project') {
    const body = await readJsonBody(request);
    const outcome = await resolveProject(body.pageUrl);
    writeJson(response, outcome.ok ? 200 : 422, outcome, request);
    return;
  }

  if (request.method === 'POST' && url.pathname === '/runs') {
    const body = await readJsonBody(request);
    const outcome = startRun(body);
    writeJson(response, outcome.ok ? 200 : outcome.code === 'busy' ? 409 : 400, outcome, request);
    return;
  }

  const runMatch = /^\/runs\/([\w-]+)$/u.exec(url.pathname);
  if (request.method === 'GET' && runMatch) {
    const run = runs.get(runMatch[1]);
    if (!run) {
      writeJson(response, 404, {
        ok: false,
        code: 'run-not-found',
        error: 'Unknown run id.',
      }, request);
      return;
    }

    // Incremental event log: the client passes back the `nextSeq` from its
    // previous poll so only new entries travel each time.
    const after = Number(url.searchParams.get('after') ?? '0');
    const events = run.events.filter((event) => event.seq > (Number.isFinite(after) ? after : 0));
    writeJson(response, 200, {
      ok: true,
      status: run.status,
      result: run.result,
      events,
      nextSeq: run.eventSeq,
    }, request);
    return;
  }

  writeJson(response, 404, {
    ok: false,
    code: 'invalid-request',
    error: 'Unknown endpoint.',
  }, request);
}

// ---------------------------------------------------------------------------
// Project resolution
// ---------------------------------------------------------------------------

async function resolveProject(pageUrl) {
  if (typeof pageUrl !== 'string' || !pageUrl.trim()) {
    return failure('invalid-request', 'pageUrl must be a non-empty string.');
  }

  let url;
  try {
    url = new URL(pageUrl);
  } catch {
    return failure('invalid-request', `pageUrl is not a valid URL: ${pageUrl}`);
  }

  if (url.protocol === 'file:') {
    return resolveFileProject(url);
  }

  if ((url.protocol === 'http:' || url.protocol === 'https:') && isLoopbackHost(url.hostname)) {
    return resolveLocalhostProject(url);
  }

  return failure(
    'unsupported-page',
    'Only localhost dev-server pages and file:// pages can be resolved to a local project.',
  );
}

async function resolveLocalhostProject(url) {
  const port = url.port
    ? Number(url.port)
    : url.protocol === 'https:' ? 443 : 80;

  let listeners;
  try {
    listeners = await execFileAsync('lsof', ['-nP', `-iTCP:${port}`, '-sTCP:LISTEN', '-Fp'], {
      timeout: 10000,
    });
  } catch {
    return failure('no-dev-server', `No local process is listening on port ${port}.`);
  }

  const pids = [...new Set(
    listeners.stdout
      .split('\n')
      .filter((line) => line.startsWith('p'))
      .map((line) => line.slice(1).trim())
      .filter(Boolean),
  )];
  if (pids.length === 0) {
    return failure('no-dev-server', `No local process is listening on port ${port}.`);
  }

  const pid = pids[0];
  let cwdOutput;
  try {
    cwdOutput = await execFileAsync('lsof', ['-a', '-p', pid, '-d', 'cwd', '-Fn'], {
      timeout: 10000,
    });
  } catch {
    return failure('unresolved-project', `Could not read the working directory of pid ${pid}.`);
  }

  const cwdLine = cwdOutput.stdout.split('\n').find((line) => line.startsWith('n'));
  const cwd = cwdLine ? cwdLine.slice(1).trim() : '';
  const validationError = validateProjectPath(cwd);
  if (validationError) {
    return failure('unresolved-project', validationError);
  }

  return {
    ok: true,
    projectPath: cwd,
    method: 'localhost-port',
    detail: `dev server pid ${pid} on port ${port}`,
    // The listening process's cwd is deterministic — safe to run without
    // asking the user to confirm.
    confident: true,
  };
}

function resolveFileProject(url) {
  const filePath = decodeURIComponent(url.pathname);
  if (!existsSync(filePath)) {
    return failure('unresolved-project', `File does not exist: ${filePath}`);
  }

  const startDir = statSync(filePath).isDirectory() ? filePath : path.dirname(filePath);
  const projectRoot = findProjectRoot(startDir) ?? startDir;
  const validationError = validateProjectPath(projectRoot);
  if (validationError) {
    return failure('unresolved-project', validationError);
  }

  const marker = existsSync(path.join(projectRoot, '.git'))
    ? '.git'
    : existsSync(path.join(projectRoot, 'package.json')) ? 'package.json' : null;
  return {
    ok: true,
    projectPath: projectRoot,
    method: 'file-path',
    detail: marker
      ? `nearest ${marker} above ${path.basename(filePath)}`
      : `directory of ${path.basename(filePath)}`,
    // A project marker makes the root unambiguous; a bare directory guess
    // (e.g. a lone HTML file on the Desktop) still needs user confirmation.
    confident: marker !== null,
  };
}

function findProjectRoot(startDir) {
  let current = startDir;
  while (ALLOW_OUTSIDE_HOME || isWithinHome(current)) {
    if (existsSync(path.join(current, '.git')) || existsSync(path.join(current, 'package.json'))) {
      return current;
    }

    const parent = path.dirname(current);
    if (parent === current) {
      break;
    }
    current = parent;
  }

  return null;
}

function validateProjectPath(projectPath) {
  if (!projectPath || typeof projectPath !== 'string' || !path.isAbsolute(projectPath)) {
    return 'Project path must be an absolute path.';
  }

  if (!existsSync(projectPath) || !statSync(projectPath).isDirectory()) {
    return `Project path is not a directory: ${projectPath}`;
  }

  if (projectPath === path.parse(projectPath).root) {
    return 'Refusing to use the filesystem root as a project.';
  }

  if (!ALLOW_OUTSIDE_HOME && !isWithinHome(projectPath)) {
    return `Project path is outside the home directory: ${projectPath} `
      + '(set COPY_AI_ID_ALLOW_OUTSIDE_HOME=1 to allow).';
  }

  return null;
}

function isWithinHome(candidate) {
  const resolved = path.resolve(candidate);
  return resolved === HOME_DIR || resolved.startsWith(HOME_DIR + path.sep);
}

function isLoopbackHost(hostname) {
  return hostname === 'localhost'
    || hostname === '127.0.0.1'
    || hostname === '::1'
    || hostname === '[::1]';
}

// ---------------------------------------------------------------------------
// Run lifecycle
// ---------------------------------------------------------------------------

function startRun(body) {
  const prompt = typeof body.prompt === 'string' ? body.prompt.trim() : '';
  if (!prompt || prompt.length > MAX_PROMPT_CHARS) {
    return failure('invalid-request', `prompt must be a non-empty string of at most ${MAX_PROMPT_CHARS} characters.`);
  }

  const projectPath = typeof body.projectPath === 'string' ? body.projectPath : '';
  const validationError = validateProjectPath(projectPath);
  if (validationError) {
    return failure('invalid-project', validationError);
  }

  const pageUrl = typeof body.pageUrl === 'string' ? body.pageUrl : '';
  const subject = typeof body.subject === 'string' ? body.subject.trim() : '';
  const reasoningEffort = VALID_REASONING_EFFORTS.has(body.reasoningEffort)
    ? body.reasoningEffort
    : DEFAULT_REASONING_EFFORT;

  const active = activeRunId ? runs.get(activeRunId) : null;
  if (active && active.status === 'running') {
    return failure('busy', 'A Codex run is already in progress.');
  }

  const run = {
    id: randomUUID(),
    status: 'running',
    result: null,
    startedAt: Date.now(),
    events: [],
    eventSeq: 0,
  };
  runs.set(run.id, run);
  activeRunId = run.id;
  pruneFinishedRuns();

  console.log(`[run ${run.id}] start — project: ${projectPath} (reasoning: ${reasoningEffort})`);
  void executeRun(run, { prompt, projectPath, pageUrl, subject, reasoningEffort });

  return { ok: true, runId: run.id };
}

function pushRunEvent(run, kind, text) {
  const trimmed = truncate(String(text).trim(), MAX_EVENT_TEXT_CHARS);
  if (!trimmed) {
    return;
  }

  run.eventSeq += 1;
  run.events.push({ seq: run.eventSeq, kind, text: trimmed });
  if (run.events.length > MAX_RUN_EVENTS) {
    run.events.splice(0, run.events.length - MAX_RUN_EVENTS);
  }
}

async function executeRun(run, { prompt, projectPath, pageUrl, subject, reasoningEffort }) {
  const startedAt = Date.now();
  const base = {
    exitCode: null,
    timedOut: false,
    finalMessage: '',
    errorOutput: '',
    error: null,
    gitInitialized: false,
    preCommitted: false,
    committedFiles: [],
    commitMessage: null,
  };

  try {
    const gitState = await prepareGit(projectPath);
    base.gitInitialized = gitState.gitInitialized;
    base.preCommitted = gitState.preCommitted;
    if (gitState.gitInitialized) {
      pushRunEvent(run, 'status', 'git init (+ default .gitignore)');
    }
    if (gitState.preCommitted) {
      pushRunEvent(run, 'status', 'git auto-commit: backed up uncommitted changes');
    }

    pushRunEvent(run, 'status', `codex exec started (${FAST_MODE ? 'fast, ' : ''}reasoning: ${reasoningEffort}${CODEX_MODEL ? `, model: ${CODEX_MODEL}` : ''})`);
    const codex = await runCodex(
      projectPath,
      buildCodexPrompt({ prompt, projectPath, pageUrl }),
      { reasoningEffort, onEvent: (kind, text) => pushRunEvent(run, kind, text) },
    );
    base.exitCode = codex.exitCode;
    base.timedOut = codex.timedOut;
    base.finalMessage = codex.finalMessage;
    base.errorOutput = codex.errorOutput;

    const codexOk = !codex.timedOut && codex.exitCode === 0;
    if (codexOk) {
      const commit = await commitCodexChanges(projectPath, subject);
      base.committedFiles = commit.committedFiles;
      base.commitMessage = commit.commitMessage;
      pushRunEvent(run, 'status', commit.commitMessage
        ? `git commit: "${commit.commitMessage}" (${commit.committedFiles.length} file(s))`
        : 'no file changes to commit');
    } else if (codex.timedOut) {
      pushRunEvent(run, 'error', 'codex timed out');
    } else {
      if (!codex.timedOut && codex.spawnError) {
        base.error = codex.spawnError;
      }
      pushRunEvent(run, 'error', codex.spawnError ?? `codex exited with code ${codex.exitCode}`);
    }

    run.result = { ...base, ok: codexOk, durationMs: Date.now() - startedAt };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    pushRunEvent(run, 'error', message);
    run.result = {
      ...base,
      ok: false,
      error: message,
      durationMs: Date.now() - startedAt,
    };
  } finally {
    run.status = 'done';
    const summary = run.result.ok
      ? `ok (${run.result.committedFiles.length} file(s) committed)`
      : run.result.timedOut ? 'timed out' : `failed (${run.result.error ?? `exit ${run.result.exitCode}`})`;
    console.log(`[run ${run.id}] done — ${summary} in ${run.result.durationMs}ms`);
  }
}

function pruneFinishedRuns() {
  const finished = [...runs.values()].filter((run) => run.status === 'done');
  if (finished.length <= MAX_FINISHED_RUNS) {
    return;
  }

  finished
    .sort((a, b) => a.startedAt - b.startedAt)
    .slice(0, finished.length - MAX_FINISHED_RUNS)
    .forEach((run) => runs.delete(run.id));
}

// ---------------------------------------------------------------------------
// Git
// ---------------------------------------------------------------------------

async function git(projectPath, args) {
  const { stdout } = await execFileAsync('git', args, {
    cwd: projectPath,
    timeout: 60000,
    maxBuffer: 8 * 1024 * 1024,
  });
  return stdout;
}

async function isInsideGitWorkTree(projectPath) {
  try {
    await git(projectPath, ['rev-parse', '--is-inside-work-tree']);
    return true;
  } catch {
    return false;
  }
}

async function prepareGit(projectPath) {
  let gitInitialized = false;
  if (!(await isInsideGitWorkTree(projectPath))) {
    await git(projectPath, ['init']);
    if (!existsSync(path.join(projectPath, '.gitignore'))) {
      writeFileSync(path.join(projectPath, '.gitignore'), DEFAULT_GITIGNORE);
    }
    gitInitialized = true;
  }

  let preCommitted = false;
  if ((await git(projectPath, ['status', '--porcelain'])).trim()) {
    await git(projectPath, ['add', '-A']);
    await commitWithIdentityFallback(projectPath, `auto-commit: ${localTimestamp()}`);
    preCommitted = true;
  }

  return { gitInitialized, preCommitted };
}

async function commitCodexChanges(projectPath, subject) {
  if (!(await git(projectPath, ['status', '--porcelain'])).trim()) {
    return { committedFiles: [], commitMessage: null };
  }

  const subjectLine = subject ? truncate(subject, 72) : 'visual edit request';
  const commitMessage = `codex: ${subjectLine}`;
  await git(projectPath, ['add', '-A']);
  await commitWithIdentityFallback(projectPath, commitMessage);
  const committedFiles = (await git(projectPath, ['show', '--name-only', '--format=format:', 'HEAD']))
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);

  return { committedFiles, commitMessage };
}

async function commitWithIdentityFallback(projectPath, message) {
  try {
    await git(projectPath, ['commit', '-m', message]);
  } catch {
    // Likely a missing user.name/user.email; retry with a per-command identity
    // so the flow doesn't depend on the project's git config.
    await git(projectPath, [
      '-c', 'user.name=copy-ai-id',
      '-c', 'user.email=copy-ai-id@localhost',
      'commit', '-m', message,
    ]);
  }
}

function localTimestamp() {
  const now = new Date();
  const pad = (value) => String(value).padStart(2, '0');
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())} `
    + `${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;
}

// ---------------------------------------------------------------------------
// Codex
// ---------------------------------------------------------------------------

function buildCodexPrompt({ prompt, projectPath, pageUrl }) {
  return [
    `You are editing the local project at: ${projectPath}`,
    pageUrl
      ? `The change request below was captured from a live inspection of: ${pageUrl}`
      : 'The change request below was captured from a live page inspection.',
    '',
    'Instructions:',
    '- Locate the source files that produce the referenced elements. `data-ai-id` attributes and the selectors under "## Targets" map to the rendered DOM.',
    '- Apply the requested changes directly to the source files. Keep edits minimal and focused on the request.',
    '- Do not run any git commands (add/commit/push); version control is handled outside this session.',
    '',
    '---',
    '',
    prompt,
  ].join('\n');
}

async function runCodex(projectPath, prompt, { reasoningEffort, onEvent } = {}) {
  const args = [
    'exec',
    '--json',
    '--sandbox', 'workspace-write',
    '--cd', projectPath,
    '--skip-git-repo-check',
    '--config', 'approval_policy="never"',
    '--config', `model_reasoning_effort="${reasoningEffort ?? DEFAULT_REASONING_EFFORT}"`,
    ...(FAST_MODE ? ['--enable', 'fast_mode', '--config', 'service_tier="fast"'] : []),
    ...(CODEX_MODEL ? ['--model', CODEX_MODEL] : []),
    '-',
  ];

  const child = spawn(CODEX_BIN, args, {
    cwd: projectPath,
    env: process.env,
    stdio: ['pipe', 'pipe', 'pipe'],
  });

  let stdoutBuffer = '';
  let errorOutput = '';
  let finalMessage = '';
  let timedOut = false;
  let spawnError = null;

  const consumeLine = (line) => {
    const trimmed = line.trim();
    if (!trimmed) {
      return;
    }

    let event;
    try {
      event = JSON.parse(trimmed);
    } catch {
      return;
    }

    if (
      event?.type === 'item.completed'
      && event.item?.type === 'agent_message'
      && typeof event.item.text === 'string'
    ) {
      finalMessage = event.item.text;
    }

    const described = describeCodexEvent(event);
    if (described && onEvent) {
      onEvent(described.kind, described.text);
    }
  };

  child.stdout.setEncoding('utf8');
  child.stdout.on('data', (chunk) => {
    stdoutBuffer += chunk;
    let newlineIndex = stdoutBuffer.indexOf('\n');
    while (newlineIndex !== -1) {
      consumeLine(stdoutBuffer.slice(0, newlineIndex));
      stdoutBuffer = stdoutBuffer.slice(newlineIndex + 1);
      newlineIndex = stdoutBuffer.indexOf('\n');
    }
  });

  child.stderr.setEncoding('utf8');
  child.stderr.on('data', (chunk) => {
    errorOutput = (errorOutput + chunk).slice(-MAX_OUTPUT_CHARS);
  });

  const timeoutTimer = setTimeout(() => {
    timedOut = true;
    child.kill('SIGKILL');
  }, CODEX_TIMEOUT_MS);

  child.stdin.on('error', () => {
    // Ignore EPIPE when the child dies before consuming the prompt.
  });
  child.stdin.end(prompt);

  const exit = await new Promise((resolve) => {
    child.once('error', (error) => resolve({ code: null, error }));
    child.once('exit', (code) => resolve({ code, error: null }));
  });
  clearTimeout(timeoutTimer);
  consumeLine(stdoutBuffer);

  if (exit.error) {
    spawnError = exit.error instanceof Error ? exit.error.message : String(exit.error);
  }

  return {
    exitCode: exit.code,
    timedOut,
    finalMessage: truncate(finalMessage, MAX_OUTPUT_CHARS),
    errorOutput,
    spawnError,
  };
}

// Maps a `codex exec --json` JSONL event to a compact log-console entry, or
// null for noise (turn bookkeeping, successful command completions, …).
function describeCodexEvent(event) {
  const item = event?.item;

  if (event?.type === 'item.started' && item?.type === 'command_execution') {
    return { kind: 'command', text: `$ ${item.command ?? ''}` };
  }

  if (event?.type === 'item.completed') {
    switch (item?.type) {
      case 'agent_message':
        return typeof item.text === 'string' ? { kind: 'message', text: item.text } : null;
      case 'reasoning':
        return typeof item.text === 'string' ? { kind: 'reasoning', text: item.text } : null;
      case 'command_execution':
        // Successful commands were already logged at item.started.
        return item.exit_code == null || item.exit_code === 0
          ? null
          : { kind: 'error', text: `$ ${item.command ?? ''} → exit ${item.exit_code}` };
      case 'file_change': {
        const files = Array.isArray(item.changes)
          ? item.changes.map((change) => change?.path).filter(Boolean)
          : [];
        return { kind: 'file', text: files.length > 0 ? `edit: ${files.join(', ')}` : 'file change' };
      }
      case 'error':
        return { kind: 'error', text: item.message ?? 'error' };
      default:
        return null;
    }
  }

  if (event?.type === 'error' && typeof event.message === 'string') {
    return { kind: 'error', text: event.message };
  }

  return null;
}

// ---------------------------------------------------------------------------
// HTTP plumbing
// ---------------------------------------------------------------------------

function failure(code, error) {
  return { ok: false, code, error };
}

function truncate(value, maxLength) {
  return value.length > maxLength ? `${value.slice(0, maxLength - 1)}…` : value;
}

async function readJsonBody(request) {
  let size = 0;
  const chunks = [];

  for await (const chunk of request) {
    size += chunk.length;
    if (size > MAX_BODY_BYTES) {
      throw new Error(`Request body is too large. Limit is ${MAX_BODY_BYTES} bytes.`);
    }
    chunks.push(chunk);
  }

  const raw = Buffer.concat(chunks).toString('utf8');
  if (!raw.trim()) {
    return {};
  }

  try {
    return JSON.parse(raw);
  } catch {
    throw new Error('Request body must be valid JSON.');
  }
}

function writeJson(response, statusCode, body, request) {
  response.writeHead(statusCode, {
    'content-type': 'application/json; charset=utf-8',
    ...getCorsHeaders(request),
  });
  response.end(JSON.stringify(body));
}

function writeCorsPreflight(response, request) {
  response.writeHead(204, {
    ...getCorsHeaders(request),
    'access-control-allow-methods': 'GET, POST, OPTIONS',
    'access-control-allow-headers': `content-type, ${CLIENT_HEADER}`,
    'access-control-max-age': '600',
  });
  response.end();
}

function getCorsHeaders(request) {
  const origin = request.headers.origin;
  return {
    'access-control-allow-origin': origin && isAllowedOrigin(origin) ? origin : 'null',
    vary: 'Origin',
  };
}

function isAllowedOrigin(origin) {
  return /^chrome-extension:\/\/[a-z]{32}$/u.test(origin)
    || /^https?:\/\/(?:localhost|127\.0\.0\.1|\[::1\])(?::\d+)?$/u.test(origin);
}

function getHeaderValue(request, name) {
  const value = request.headers[name.toLowerCase()];
  return Array.isArray(value) ? value[0] : value;
}

function parsePort(value) {
  const port = Number(value);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    console.error(`codex-server: invalid port "${value}".`);
    process.exit(1);
  }
  return port;
}

function parsePositiveInt(value, label) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    console.error(`codex-server: invalid ${label} "${value}".`);
    process.exit(1);
  }
  return parsed;
}
