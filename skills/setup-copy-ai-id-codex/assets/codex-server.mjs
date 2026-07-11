#!/usr/bin/env node

// Copy AI ID → Codex local server.
//
// Receives the notebook prompt from the extension (via its background service
// worker), resolves which local project the inspected page belongs to, and
// runs `codex exec` inside that project with automatic git commits around the
// run. Response shapes mirror src/shared/codex.ts in the Copy AI ID
// repository. This file is also the canonical standalone companion installed
// by the setup-copy-ai-id-codex skill; the repository entry point imports it.

import { execFile, spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { existsSync, realpathSync, statSync, writeFileSync } from 'node:fs';
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
// reasoning effort. It is requested only when local CLI feature metadata
// reports `fast_mode`; compatible older CLIs fall back to the standard tier.
// COPY_AI_ID_CODEX_FAST=0 disables the optional request entirely.
const FAST_MODE = process.env.COPY_AI_ID_CODEX_FAST !== '0';
// Optional model override (`-m`); empty = the account's default model.
const CODEX_MODEL = process.env.COPY_AI_ID_CODEX_MODEL ?? '';

const CLIENT_HEADER = 'x-copy-ai-id-client';
const CLIENT_HEADER_VALUE = 'copy-ai-id-extension';
// Must match CODEX_COMPANION_PROTOCOL_VERSION in src/shared/codex.ts.
const PROTOCOL_VERSION = 1;
const DEFAULT_ALLOWED_EXTENSION_IDS = [
  // Published Chrome Web Store item.
  'opodkffbpbkjjechadlpogecbmlbmkgi',
  // Stable unpacked-development id from src/manifest.ts.
  'fjakahhodjlfgoijjkpedmbbelcgfkik',
];
const ALLOWED_EXTENSION_IDS = new Set([
  ...DEFAULT_ALLOWED_EXTENSION_IDS,
  ...parseAllowedExtensionIds(process.env.COPY_AI_ID_ALLOWED_EXTENSION_IDS ?? ''),
]);
const MAX_BODY_BYTES = 2 * 1024 * 1024;
const MAX_PROMPT_CHARS = 200000;
const MAX_OUTPUT_CHARS = 20000;
const MAX_FINISHED_RUNS = 20;
const MAX_RUN_EVENTS = 500;
const MAX_EVENT_TEXT_CHARS = 400;
const MIN_NODE_MAJOR = 18;
const READINESS_CACHE_TTL_MS = 5000;
const READINESS_COMMAND_TIMEOUT_MS = 5000;
const SHUTDOWN_GRACE_MS = 2000;
const PROCESS_GROUP_DRAIN_GRACE_MS = 750;
const PROCESS_GROUP_POLL_MS = 50;
const SUPPORTS_PROCESS_GROUPS = process.platform !== 'win32';
const HOME_DIR = os.homedir();
const HOME_REAL_DIR = realpathSync(HOME_DIR);
const MANAGEMENT_LOCK_DIR = process.env.COPY_AI_ID_MANAGEMENT_LOCK_DIR ?? path.join(
  HOME_DIR,
  'Library',
  'Application Support',
  'Copy AI ID Codex.management.lock',
);
const MANAGEMENT_LOCK_RECOVERY_DIR = `${MANAGEMENT_LOCK_DIR}.recovery`;

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
let readinessCache = null;
let readinessPromise = null;
// Filled by the local-only `codex exec --help` readiness probe. Fast mode is
// an optional optimization: an older CLI can still run Copy AI ID requests as
// long as it supports the required non-interactive exec options.
let codexExecCapabilities = { fastMode: false };
/** @type {Map<number, import('node:child_process').ChildProcess>} */
const activeCodexProcessGroups = new Map();
let shutdownPromise = null;

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

process.once('SIGTERM', () => {
  void shutdownServer('SIGTERM');
});
process.once('SIGINT', () => {
  void shutdownServer('SIGINT');
});

server.listen(PORT, HOST, () => {
  console.log('Copy AI ID → Codex local server');
  console.log(`  endpoint : http://${HOST}:${PORT}`);
  console.log(`  codex    : ${CODEX_BIN}`);
  console.log(`  timeout  : ${CODEX_TIMEOUT_MS}ms`);
  console.log('');
  console.log('Ready for local Copy AI ID extension requests.');
  void warnIfNotReady();
});

async function shutdownServer(signal) {
  if (shutdownPromise) {
    return shutdownPromise;
  }

  shutdownPromise = (async () => {
    console.log(`codex-server: received ${signal}; stopping.`);
    server.close();

    // Each Codex CLI is the leader of its own Unix process group. Signal the
    // group, rather than only the CLI pid, so commands started by Codex cannot
    // outlive the companion and keep editing the project in the background.
    const groups = [...activeCodexProcessGroups.entries()];
    groups.forEach(([pid, child]) => {
      signalCodexProcessGroup(pid, child, 'SIGTERM');
    });

    if (groups.length > 0) {
      await Promise.race([
        Promise.all(groups.map(([, child]) => waitForChildExit(child))),
        delay(SHUTDOWN_GRACE_MS),
      ]);
      groups.forEach(([pid, child]) => {
        signalCodexProcessGroup(pid, child, 'SIGKILL');
      });
    }

    process.exit(signal === 'SIGINT' ? 130 : 143);
  })();

  return shutdownPromise;
}

function waitForChildExit(child) {
  if (child.exitCode !== null || child.signalCode !== null) {
    return Promise.resolve();
  }
  return new Promise((resolve) => child.once('exit', resolve));
}

function delay(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

function signalCodexProcessGroup(pid, child, signal) {
  if (SUPPORTS_PROCESS_GROUPS) {
    try {
      process.kill(-pid, signal);
      return;
    } catch (error) {
      if (!error || typeof error !== 'object' || error.code !== 'ESRCH') {
        console.error(`codex-server: could not send ${signal} to Codex process group ${pid}.`);
      }
    }
  }

  // The companion is currently macOS-only, but retain a direct-child fallback
  // for platforms without Unix process groups and for an already-gone group.
  try {
    child.kill(signal);
  } catch {
    // The process may have exited between the liveness check and this signal.
  }
}

function codexProcessGroupIsAlive(pid) {
  if (!SUPPORTS_PROCESS_GROUPS) {
    return false;
  }
  try {
    process.kill(-pid, 0);
    return true;
  } catch (error) {
    return Boolean(error && typeof error === 'object' && error.code !== 'ESRCH');
  }
}

async function waitForCodexProcessGroupExit(pid, timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  while (codexProcessGroupIsAlive(pid) && Date.now() < deadline) {
    await delay(PROCESS_GROUP_POLL_MS);
  }
  return !codexProcessGroupIsAlive(pid);
}

async function stopRemainingCodexProcessGroup(pid, child, forceImmediately) {
  if (!codexProcessGroupIsAlive(pid)) {
    return true;
  }

  // A successful Codex leader may leave a background shell/build process in
  // its group. Do not commit or report success until every such descendant is
  // gone. Timed-out runs have already received SIGKILL, so skip the grace
  // signal in that case and simply reinforce the group kill.
  if (!forceImmediately) {
    signalCodexProcessGroup(pid, child, 'SIGTERM');
    if (await waitForCodexProcessGroupExit(pid, PROCESS_GROUP_DRAIN_GRACE_MS)) {
      return true;
    }
  }

  signalCodexProcessGroup(pid, child, 'SIGKILL');
  return waitForCodexProcessGroupExit(pid, PROCESS_GROUP_DRAIN_GRACE_MS);
}

function pruneStoppedCodexProcessGroups() {
  for (const pid of activeCodexProcessGroups.keys()) {
    if (!codexProcessGroupIsAlive(pid)) {
      activeCodexProcessGroups.delete(pid);
    }
  }
}

async function warnIfNotReady() {
  const readiness = await getReadiness();
  if (!readiness.ready) {
    console.warn('');
    console.warn('warning: Codex companion setup is incomplete:');
    readiness.checks
      .filter((check) => !check.ok)
      .forEach((check) => console.warn(`  - ${check.detail}`));
  }
}

async function handleRequest(request, response) {
  const url = new URL(request.url ?? '/', `http://${HOST}:${PORT}`);

  if (request.method === 'OPTIONS') {
    writeCorsPreflight(response, request);
    return;
  }

  const requestOrigin = request.headers.origin;
  if (requestOrigin && !isAllowedOrigin(requestOrigin)) {
    writeJson(response, 403, {
      ok: false,
      code: 'invalid-request',
      error: 'This request origin is not allowed.',
    }, request);
    return;
  }

  if (getHeaderValue(request, CLIENT_HEADER) !== CLIENT_HEADER_VALUE) {
    writeJson(response, 403, {
      ok: false,
      code: 'invalid-request',
      error: `Missing or invalid ${CLIENT_HEADER} header.`,
    }, request);
    return;
  }

  if (request.method === 'GET' && url.pathname === '/health') {
    const readiness = await getReadiness();
    // Read this after the async readiness probe so a run accepted while that
    // probe is pending is reflected in the same health response.
    pruneStoppedCodexProcessGroups();
    const active = activeRunId ? runs.get(activeRunId) : null;
    const maintenance = managementIsLocked();
    writeJson(response, 200, {
      ok: true,
      service: 'copy-ai-id-codex-server',
      protocolVersion: PROTOCOL_VERSION,
      reachable: true,
      ready: readiness.ready && !maintenance,
      prerequisitesReady: readiness.ready,
      running: Boolean(active && active.status === 'running') || activeCodexProcessGroups.size > 0,
      maintenance,
      acceptingRuns: !maintenance,
      checkedAt: readiness.checkedAt,
      checks: readiness.checks,
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
    const outcome = await startRun(body);
    const statusCode = outcome.ok
      ? 200
      : outcome.code === 'busy' ? 409
        : outcome.code === 'not-ready' ? 503 : 400;
    writeJson(response, statusCode, outcome, request);
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
// Companion readiness
// ---------------------------------------------------------------------------

async function getReadiness() {
  const now = Date.now();
  if (readinessCache && readinessCache.expiresAt > now) {
    return readinessCache.value;
  }

  if (readinessPromise) {
    return readinessPromise;
  }

  readinessPromise = collectReadiness()
    .then((value) => {
      readinessCache = {
        value,
        expiresAt: Date.now() + READINESS_CACHE_TTL_MS,
      };
      return value;
    })
    .finally(() => {
      readinessPromise = null;
    });

  return readinessPromise;
}

async function collectReadiness() {
  const [codex, codexExec, codexLogin, gitCheck, lsof] = await Promise.all([
    checkVersionCommand({
      id: 'codex',
      command: CODEX_BIN,
      args: ['--version'],
      label: 'Codex CLI',
      notFoundCode: 'codex-not-found',
      unavailableCode: 'codex-version-unavailable',
    }),
    checkCodexExecCapabilities(),
    checkCodexLogin(),
    checkVersionCommand({
      id: 'git',
      command: 'git',
      args: ['--version'],
      label: 'Git',
      notFoundCode: 'git-not-found',
      unavailableCode: 'git-version-unavailable',
    }),
    checkVersionCommand({
      id: 'lsof',
      command: 'lsof',
      args: ['-v'],
      label: 'lsof',
      notFoundCode: 'lsof-not-found',
      unavailableCode: 'lsof-version-unavailable',
    }),
  ]);

  const checks = [
    checkPlatform(),
    checkNodeRuntime(),
    codex,
    codexExec,
    codexLogin,
    gitCheck,
    lsof,
  ];
  return {
    ready: checks.every((check) => check.ok),
    checkedAt: new Date().toISOString(),
    checks,
  };
}

function checkPlatform() {
  return process.platform === 'darwin'
    ? passedCheck('platform', 'macOS is supported.')
    : failedCheck(
      'platform',
      'unsupported-platform',
      'This companion currently supports macOS only.',
    );
}

function checkNodeRuntime() {
  const version = process.versions.node;
  const major = Number(version.split('.')[0]);
  return Number.isInteger(major) && major >= MIN_NODE_MAJOR
    ? passedCheck('node', `Node.js ${version} is available.`)
    : failedCheck(
      'node',
      'node-version-unsupported',
      `Node.js ${MIN_NODE_MAJOR} or newer is required.`,
    );
}

async function checkVersionCommand({
  id,
  command,
  args,
  label,
  notFoundCode,
  unavailableCode,
}) {
  try {
    const { stdout, stderr } = await execFileAsync(command, args, {
      timeout: READINESS_COMMAND_TIMEOUT_MS,
    });
    const version = extractVersion(`${stdout}\n${stderr}`);
    return passedCheck(id, version
      ? `${label} ${version} is available.`
      : `${label} is available.`);
  } catch (error) {
    return commandWasNotFound(error)
      ? failedCheck(id, notFoundCode, `${label} was not found.`)
      : failedCheck(id, unavailableCode, `${label} version could not be checked.`);
  }
}

async function checkCodexLogin() {
  try {
    const { stdout, stderr } = await execFileAsync(CODEX_BIN, ['login', 'status'], {
      timeout: READINESS_COMMAND_TIMEOUT_MS,
    });
    if (looksUnauthenticated(`${stdout}\n${stderr}`)) {
      return failedCheck(
        'codex-login',
        'codex-not-authenticated',
        'Codex CLI is not authenticated.',
      );
    }
    return passedCheck('codex-login', 'Codex CLI is authenticated.');
  } catch (error) {
    if (commandWasNotFound(error)) {
      return failedCheck('codex-login', 'codex-not-found', 'Codex CLI was not found.');
    }

    return looksUnauthenticated(commandErrorOutput(error))
      ? failedCheck(
        'codex-login',
        'codex-not-authenticated',
        'Codex CLI is not authenticated.',
      )
      : failedCheck(
        'codex-login',
        'codex-login-check-failed',
        'Codex login status could not be checked.',
      );
  }
}

async function checkCodexExecCapabilities() {
  codexExecCapabilities = { fastMode: false };

  try {
    // `--help` only parses local CLI metadata: it does not start an agent,
    // access a project, require authentication, or make a network request.
    // Run both local metadata probes inside the same timeout window. Keeping
    // them concurrent guarantees that the complete readiness collection stays
    // below the extension worker's 7-second /health timeout even if a probe
    // consumes its full 5-second command timeout.
    const [{ stdout, stderr }, fastModeFeature] = await Promise.all([
      execFileAsync(CODEX_BIN, ['exec', '--help'], {
        timeout: READINESS_COMMAND_TIMEOUT_MS,
        maxBuffer: 1024 * 1024,
      }),
      FAST_MODE ? checkCodexFastModeFeature() : Promise.resolve(false),
    ]);
    const helpOutput = `${stdout}\n${stderr}`;
    const requiredOptions = [
      '--json',
      '--sandbox',
      '--cd',
      '--skip-git-repo-check',
      '--config',
      ...(CODEX_MODEL ? ['--model'] : []),
    ];
    const missingOptions = requiredOptions.filter((option) => !helpOutput.includes(option));

    if (missingOptions.length > 0) {
      return failedCheck(
        'codex-exec',
        'codex-exec-unsupported',
        `Codex CLI exec is missing required options: ${missingOptions.join(', ')}.`,
      );
    }

    const fastMode = FAST_MODE
      && helpOutput.includes('--enable')
      && fastModeFeature;
    codexExecCapabilities = { fastMode };

    return passedCheck(
      'codex-exec',
      fastMode || !FAST_MODE
        ? 'Codex CLI supports the required non-interactive exec options.'
        : 'Codex CLI supports non-interactive exec; unsupported fast mode will be skipped.',
    );
  } catch (error) {
    if (commandWasNotFound(error)) {
      return failedCheck('codex-exec', 'codex-not-found', 'Codex CLI was not found.');
    }

    return failedCheck(
      'codex-exec',
      looksLikeUnsupportedExec(commandErrorOutput(error))
        ? 'codex-exec-unsupported'
        : 'codex-exec-capability-check-failed',
      looksLikeUnsupportedExec(commandErrorOutput(error))
        ? 'Codex CLI does not support the required non-interactive exec command.'
        : 'Codex CLI exec capabilities could not be checked.',
    );
  }
}

async function checkCodexFastModeFeature() {
  try {
    // Like `exec --help`, listing local feature metadata does not authenticate
    // or contact the network. Failure simply selects the compatible standard
    // tier instead of making the whole companion unready.
    const { stdout, stderr } = await execFileAsync(CODEX_BIN, ['features', 'list'], {
      timeout: READINESS_COMMAND_TIMEOUT_MS,
      maxBuffer: 1024 * 1024,
    });
    return /(?:^|\s)fast_mode(?:\s|$)/mu.test(`${stdout}\n${stderr}`);
  } catch {
    return false;
  }
}

function passedCheck(id, detail) {
  return { id, ok: true, issueCode: null, detail };
}

function failedCheck(id, issueCode, detail) {
  return { id, ok: false, issueCode, detail };
}

function extractVersion(output) {
  const match = /\bv?(\d+\.\d+(?:\.\d+)?(?:[-+][0-9A-Za-z.-]+)?)\b/u.exec(output);
  return match ? match[1] : '';
}

function commandWasNotFound(error) {
  return Boolean(error && typeof error === 'object' && error.code === 'ENOENT');
}

function commandErrorOutput(error) {
  if (!error || typeof error !== 'object') {
    return '';
  }
  return `${typeof error.stdout === 'string' ? error.stdout : ''}\n`
    + `${typeof error.stderr === 'string' ? error.stderr : ''}`;
}

function looksUnauthenticated(output) {
  return /not\s+(?:logged\s+in|authenticated)|login\s+required|please\s+log\s*in/iu.test(output);
}

function looksLikeUnsupportedExec(output) {
  return /(?:unknown|unrecognized|invalid)\s+(?:subcommand|command)|(?:subcommand|command)\s+.*(?:not found|unsupported)/iu.test(output);
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

  let canonicalCwd;
  try {
    canonicalCwd = realpathSync(cwd);
  } catch {
    return failure('unresolved-project', `Could not resolve the real project path: ${cwd}`);
  }

  const projectRoot = findProjectRoot(canonicalCwd);
  const projectPath = projectRoot ?? canonicalCwd;
  const projectValidationError = validateProjectPath(projectPath);
  if (projectValidationError) {
    return failure('unresolved-project', projectValidationError);
  }

  const marker = projectRoot ? getProjectMarker(projectRoot) : null;

  return {
    ok: true,
    projectPath,
    method: 'localhost-port',
    detail: marker
      ? `dev server pid ${pid} on port ${port}; nearest ${marker} from listener cwd`
      : `dev server pid ${pid} on port ${port}; listener cwd has no project marker`,
    // A marker makes the canonical root unambiguous. A listener started from
    // a broad, markerless directory still needs explicit user confirmation.
    confident: marker !== null,
  };
}

function resolveFileProject(url) {
  const filePath = decodeURIComponent(url.pathname);
  if (!existsSync(filePath)) {
    return failure('unresolved-project', `File does not exist: ${filePath}`);
  }

  const startDir = statSync(filePath).isDirectory() ? filePath : path.dirname(filePath);
  let canonicalStartDir;
  try {
    canonicalStartDir = realpathSync(startDir);
  } catch {
    return failure('unresolved-project', `Could not resolve the real project path: ${startDir}`);
  }

  const projectRoot = findProjectRoot(canonicalStartDir);
  const projectPath = projectRoot ?? canonicalStartDir;
  const validationError = validateProjectPath(projectPath);
  if (validationError) {
    return failure('unresolved-project', validationError);
  }

  const marker = getProjectMarker(projectPath);
  return {
    ok: true,
    projectPath,
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
  let current;
  try {
    current = realpathSync(startDir);
  } catch {
    return null;
  }

  while (ALLOW_OUTSIDE_HOME || isWithinHome(current)) {
    // The filesystem root and the user's entire home directory are too broad
    // to ever become an automatically trusted project, even if they happen to
    // contain a project marker.
    if (current === path.parse(current).root || current === HOME_REAL_DIR) {
      break;
    }

    if (getProjectMarker(current)) {
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

function getProjectMarker(projectPath) {
  return existsSync(path.join(projectPath, '.git'))
    ? '.git'
    : existsSync(path.join(projectPath, 'package.json')) ? 'package.json' : null;
}

function validateProjectPath(projectPath) {
  if (!projectPath || typeof projectPath !== 'string' || !path.isAbsolute(projectPath)) {
    return 'Project path must be an absolute path.';
  }

  if (!existsSync(projectPath) || !statSync(projectPath).isDirectory()) {
    return `Project path is not a directory: ${projectPath}`;
  }

  let realProjectPath;
  try {
    realProjectPath = realpathSync(projectPath);
  } catch {
    return `Could not resolve the real project path: ${projectPath}`;
  }

  if (realProjectPath === path.parse(realProjectPath).root) {
    return 'Refusing to use the filesystem root as a project.';
  }

  if (realProjectPath === HOME_REAL_DIR) {
    return 'Refusing to use the entire home directory as a project.';
  }

  if (!ALLOW_OUTSIDE_HOME && !isWithinHome(realProjectPath)) {
    return `Project path is outside the home directory: ${projectPath} `
      + '(set COPY_AI_ID_ALLOW_OUTSIDE_HOME=1 to allow).';
  }

  return null;
}

function isWithinHome(candidate) {
  let resolved;
  try {
    resolved = realpathSync(candidate);
  } catch {
    return false;
  }
  return resolved === HOME_REAL_DIR || resolved.startsWith(HOME_REAL_DIR + path.sep);
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

async function startRun(body) {
  pruneStoppedCodexProcessGroups();
  const prompt = typeof body.prompt === 'string' ? body.prompt.trim() : '';
  if (!prompt || prompt.length > MAX_PROMPT_CHARS) {
    return failure('invalid-request', `prompt must be a non-empty string of at most ${MAX_PROMPT_CHARS} characters.`);
  }

  const projectPath = typeof body.projectPath === 'string' ? body.projectPath : '';
  const validationError = validateProjectPath(projectPath);
  if (validationError) {
    return failure('invalid-project', validationError);
  }

  let canonicalProjectPath;
  try {
    canonicalProjectPath = realpathSync(projectPath);
  } catch {
    return failure('invalid-project', `Could not resolve the real project path: ${projectPath}`);
  }

  const pageUrl = typeof body.pageUrl === 'string' ? body.pageUrl : '';
  const subject = typeof body.subject === 'string' ? body.subject.trim() : '';
  const reasoningEffort = VALID_REASONING_EFFORTS.has(body.reasoningEffort)
    ? body.reasoningEffort
    : DEFAULT_REASONING_EFFORT;

  // Avoid an unnecessary readiness probe when a known run/maintenance state
  // already makes this request impossible. These are only fast-path checks:
  // both must be checked again after the asynchronous readiness gate.
  if (managementIsLocked()) {
    return failure('busy', 'The Codex companion is temporarily unavailable for maintenance.');
  }
  if (activeCodexProcessGroups.size > 0) {
    return failure('busy', 'A process started by the previous Codex run is still stopping.');
  }

  const activeBeforeReadiness = activeRunId ? runs.get(activeRunId) : null;
  if (activeBeforeReadiness && activeBeforeReadiness.status === 'running') {
    return failure('busy', 'A Codex run is already in progress.');
  }

  // Do not start the asynchronous execution pipeline (whose first phase may
  // initialize/commit Git) unless all required local tools and Codex login are
  // ready at acceptance time.
  const readiness = await getReadiness();
  if (!readiness.ready) {
    return failure(
      'not-ready',
      'The Codex companion prerequisites are not ready. Open Codex setup and retry.',
    );
  }

  // This is the acceptance critical section. There must be no await between
  // the post-readiness maintenance/active checks and activeRunId assignment:
  // concurrent POSTs resume one at a time, so only one can claim the run slot.
  // Management scripts create their lock before inspecting run state, so they
  // likewise either observe this assignment or win by creating the lock.
  if (managementIsLocked()) {
    return failure('busy', 'The Codex companion is temporarily unavailable for maintenance.');
  }
  if (activeCodexProcessGroups.size > 0) {
    return failure('busy', 'A process started by the previous Codex run is still stopping.');
  }

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

  console.log(`[run ${run.id}] start — project: ${canonicalProjectPath} (reasoning: ${reasoningEffort})`);
  void executeRun(run, {
    prompt,
    projectPath: canonicalProjectPath,
    pageUrl,
    subject,
    reasoningEffort,
  });

  return { ok: true, runId: run.id };
}

function managementIsLocked() {
  // Keep sends blocked even if a setup process is killed mid-publish. A later
  // management invocation can recover a dead owner's lock, while treating the
  // recovery mutex as maintenance closes the rename/recreate window.
  return existsSync(MANAGEMENT_LOCK_DIR) || existsSync(MANAGEMENT_LOCK_RECOVERY_DIR);
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

    const fastMode = FAST_MODE && codexExecCapabilities.fastMode;
    pushRunEvent(run, 'status', `codex exec started (${fastMode ? 'fast, ' : ''}reasoning: ${reasoningEffort}${CODEX_MODEL ? `, model: ${CODEX_MODEL}` : ''})`);
    const codex = await runCodex(
      projectPath,
      buildCodexPrompt({ prompt, projectPath, pageUrl }),
      { reasoningEffort, fastMode, onEvent: (kind, text) => pushRunEvent(run, kind, text) },
    );
    base.exitCode = codex.exitCode;
    base.timedOut = codex.timedOut;
    base.finalMessage = codex.finalMessage;
    base.errorOutput = codex.errorOutput;

    const codexOk = !codex.timedOut && codex.exitCode === 0 && !codex.spawnError;
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

async function runCodex(projectPath, prompt, { reasoningEffort, fastMode = false, onEvent } = {}) {
  const args = [
    'exec',
    '--json',
    '--sandbox', 'workspace-write',
    '--cd', projectPath,
    '--skip-git-repo-check',
    '--config', 'approval_policy="never"',
    '--config', `model_reasoning_effort="${reasoningEffort ?? DEFAULT_REASONING_EFFORT}"`,
    ...(fastMode ? ['--enable', 'fast_mode', '--config', 'service_tier="fast"'] : []),
    ...(CODEX_MODEL ? ['--model', CODEX_MODEL] : []),
    '-',
  ];

  const child = spawn(CODEX_BIN, args, {
    cwd: projectPath,
    env: process.env,
    stdio: ['pipe', 'pipe', 'pipe'],
    // On macOS/Unix this makes Codex the leader of a dedicated process group,
    // allowing timeout and server-shutdown cleanup to include every command it
    // starts instead of killing only the CLI process.
    detached: SUPPORTS_PROCESS_GROUPS,
  });
  const processGroupPid = Number.isInteger(child.pid) && child.pid > 0 ? child.pid : null;
  if (processGroupPid !== null) {
    activeCodexProcessGroups.set(processGroupPid, child);
  }

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
    if (child.exitCode !== null || child.signalCode !== null) {
      return;
    }
    timedOut = true;
    if (processGroupPid !== null) {
      signalCodexProcessGroup(processGroupPid, child, 'SIGKILL');
    } else {
      child.kill('SIGKILL');
    }
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
  let processGroupCleanupError = null;
  if (processGroupPid !== null) {
    const groupStopped = await stopRemainingCodexProcessGroup(
      processGroupPid,
      child,
      timedOut,
    );
    if (!groupStopped) {
      processGroupCleanupError = 'A command started by Codex did not stop with its process group.';
    }
    if (groupStopped) {
      activeCodexProcessGroups.delete(processGroupPid);
    }
  }
  consumeLine(stdoutBuffer);

  if (exit.error) {
    spawnError = exit.error instanceof Error ? exit.error.message : String(exit.error);
  } else if (processGroupCleanupError) {
    spawnError = processGroupCleanupError;
  }

  return {
    exitCode: processGroupCleanupError && exit.code === 0 ? null : exit.code,
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
  const match = /^chrome-extension:\/\/([a-p]{32})$/u.exec(origin);
  return Boolean(match && ALLOWED_EXTENSION_IDS.has(match[1]));
}

function parseAllowedExtensionIds(value) {
  return value
    .split(',')
    .map((item) => item.trim())
    .filter((item) => /^[a-p]{32}$/u.test(item));
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
