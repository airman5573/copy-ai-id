#!/usr/bin/env node

import { spawn } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { realpathSync } from 'node:fs';
import http from 'node:http';
import path from 'node:path';

const DEFAULT_HOST = '127.0.0.1';
const DEFAULT_PORT = 45129;
const DEFAULT_SANDBOX = 'workspace-write';
const MAX_BODY_BYTES = 1024 * 1024;
const VALID_SANDBOXES = new Set(['read-only', 'workspace-write', 'danger-full-access']);

const options = parseArgs(process.argv.slice(2));

if (options.help) {
  printHelp();
  process.exit(0);
}

const host = options.host ?? process.env.CODEX_BRIDGE_HOST ?? DEFAULT_HOST;
const port = parsePort(options.port ?? process.env.CODEX_BRIDGE_PORT ?? String(DEFAULT_PORT));
const workspaceRoot = realpathSync(path.resolve(options.cwd ?? process.cwd()));
const sandbox = options.sandbox ?? process.env.CODEX_BRIDGE_SANDBOX ?? DEFAULT_SANDBOX;
const codexCommand = options.codex ?? process.env.CODEX_BRIDGE_CODEX_BIN ?? 'codex';
const token = options.token ?? process.env.CODEX_BRIDGE_TOKEN ?? randomBytes(24).toString('base64url');

if (!VALID_SANDBOXES.has(sandbox)) {
  fatal(`Invalid sandbox "${sandbox}". Use one of: ${Array.from(VALID_SANDBOXES).join(', ')}`);
}

const server = http.createServer((request, response) => {
  void handleRequest(request, response).catch((error) => {
    const message = error instanceof Error ? error.message : String(error);
    writeJson(response, 500, { ok: false, error: message }, request);
  });
});

server.listen(port, host, () => {
  const baseUrl = `http://${host}:${port}`;
  console.log('Copy AI ID → Codex local bridge');
  console.log(`  endpoint : ${baseUrl}/api/codex`);
  console.log(`  workspace: ${workspaceRoot}`);
  console.log(`  sandbox  : ${sandbox}`);
  console.log(`  token    : ${token}`);
  console.log('');
  console.log('Open examples/codex-bridge-demo.html as a file:// page and paste this token.');
});

async function handleRequest(request, response) {
  const url = new URL(request.url ?? '/', `http://${host}:${port}`);

  if (!isAllowedOrigin(request.headers.origin)) {
    writeJson(response, 403, { ok: false, error: 'Origin is not allowed.' }, request);
    return;
  }

  if (request.method === 'OPTIONS') {
    writeCorsPreflight(response, request);
    return;
  }

  if (request.method === 'GET' && url.pathname === '/healthz') {
    writeJson(response, 200, { ok: true, workspaceRoot, sandbox }, request);
    return;
  }

  if (request.method !== 'POST' || url.pathname !== '/api/codex') {
    writeJson(response, 404, {
      ok: false,
      error: 'Use POST /api/codex with JSON { token, prompt }.',
    }, request);
    return;
  }

  const body = await readJsonBody(request);
  const providedToken = typeof body.token === 'string'
    ? body.token
    : getHeaderValue(request, 'x-codex-bridge-token');

  if (providedToken !== token) {
    writeJson(response, 401, { ok: false, error: 'Invalid bridge token.' }, request);
    return;
  }

  const prompt = normalizePrompt(body.prompt);
  if (!prompt) {
    writeJson(response, 400, { ok: false, error: 'prompt must be a non-empty string.' }, request);
    return;
  }

  const result = await runCodex(prompt);
  writeJson(response, result.ok ? 200 : 500, result, request);
}

async function runCodex(prompt) {
  const args = [
    'exec',
    '--json',
    '--sandbox',
    sandbox,
    '--cd',
    workspaceRoot,
    '--skip-git-repo-check',
    '--config',
    'approval_policy="never"',
    '-',
  ];

  const startedAt = Date.now();
  const child = spawn(codexCommand, args, {
    cwd: workspaceRoot,
    env: process.env,
    stdio: ['pipe', 'pipe', 'pipe'],
  });

  let stdoutBuffer = '';
  let stderr = '';
  let finalMessage = '';
  let threadId = null;
  const events = [];

  child.stdout.setEncoding('utf8');
  child.stdout.on('data', (chunk) => {
    stdoutBuffer += chunk;
    let newlineIndex = stdoutBuffer.indexOf('\n');

    while (newlineIndex !== -1) {
      const line = stdoutBuffer.slice(0, newlineIndex).trim();
      stdoutBuffer = stdoutBuffer.slice(newlineIndex + 1);
      consumeCodexEventLine(line, events, {
        setFinalMessage(value) {
          finalMessage = value;
        },
        setThreadId(value) {
          threadId = value;
        },
      });
      newlineIndex = stdoutBuffer.indexOf('\n');
    }
  });

  child.stderr.setEncoding('utf8');
  child.stderr.on('data', (chunk) => {
    stderr += chunk;
  });

  child.stdin.end(prompt);

  const exit = await new Promise((resolve) => {
    child.once('error', (error) => {
      resolve({ code: null, signal: null, error });
    });
    child.once('exit', (code, signal) => {
      resolve({ code, signal, error: null });
    });
  });

  const trailingLine = stdoutBuffer.trim();
  if (trailingLine) {
    consumeCodexEventLine(trailingLine, events, {
      setFinalMessage(value) {
        finalMessage = value;
      },
      setThreadId(value) {
        threadId = value;
      },
    });
  }

  const durationMs = Date.now() - startedAt;
  if (exit.error || exit.code !== 0 || exit.signal) {
    return {
      ok: false,
      error: exit.error instanceof Error
        ? exit.error.message
        : `codex exited with ${exit.signal ? `signal ${exit.signal}` : `code ${exit.code ?? 1}`}`,
      finalMessage,
      threadId,
      events,
      stderr,
      durationMs,
    };
  }

  return {
    ok: true,
    finalMessage,
    threadId,
    events,
    stderr,
    durationMs,
  };
}

function consumeCodexEventLine(line, events, sinks) {
  if (!line) {
    return;
  }

  let event;
  try {
    event = JSON.parse(line);
  } catch {
    events.push({ type: 'stdout.line', line });
    return;
  }

  events.push(event);

  if (event?.type === 'thread.started' && typeof event.thread_id === 'string') {
    sinks.setThreadId(event.thread_id);
    return;
  }

  if (
    event?.type === 'item.completed'
    && event.item?.type === 'agent_message'
    && typeof event.item.text === 'string'
  ) {
    sinks.setFinalMessage(event.item.text);
  }
}

function normalizePrompt(value) {
  if (typeof value !== 'string') {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
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
  const headers = {
    'content-type': 'application/json; charset=utf-8',
    ...getCorsHeaders(request),
  };

  response.writeHead(statusCode, headers);
  response.end(JSON.stringify(body, null, 2));
}

function writeCorsPreflight(response, request) {
  response.writeHead(204, {
    ...getCorsHeaders(request),
    'access-control-allow-methods': 'GET, POST, OPTIONS',
    'access-control-allow-headers': 'content-type, x-codex-bridge-token',
    'access-control-max-age': '600',
  });
  response.end();
}

function getCorsHeaders(request) {
  const origin = request.headers.origin;
  return {
    'access-control-allow-origin': origin && isAllowedOrigin(origin) ? origin : 'null',
    'vary': 'Origin',
  };
}

function isAllowedOrigin(origin) {
  if (!origin) {
    return true;
  }

  if (origin === 'null') {
    return true;
  }

  return /^https?:\/\/(?:localhost|127\.0\.0\.1|\[::1\])(?::\d+)?$/u.test(origin)
    || /^chrome-extension:\/\/[a-z]{32}$/u.test(origin);
}

function getHeaderValue(request, name) {
  const value = request.headers[name.toLowerCase()];
  return Array.isArray(value) ? value[0] : value;
}

function parsePort(value) {
  const portNumber = Number(value);
  if (!Number.isInteger(portNumber) || portNumber < 1 || portNumber > 65535) {
    fatal(`Invalid port "${value}".`);
  }
  return portNumber;
}

function parseArgs(argv) {
  const parsed = {};

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];

    if (arg === '--help' || arg === '-h') {
      parsed.help = true;
      continue;
    }

    const [rawName, inlineValue] = arg.split('=', 2);
    if (!rawName.startsWith('--')) {
      fatal(`Unexpected argument "${arg}".`);
    }

    const name = rawName.slice(2);
    const value = inlineValue ?? argv[index + 1];
    if (inlineValue === undefined) {
      index += 1;
    }

    if (!value) {
      fatal(`Missing value for --${name}.`);
    }

    switch (name) {
      case 'codex':
      case 'cwd':
      case 'host':
      case 'port':
      case 'sandbox':
      case 'token':
        parsed[name] = value;
        break;
      default:
        fatal(`Unknown option --${name}.`);
    }
  }

  return parsed;
}

function printHelp() {
  console.log(`Usage: npm run codex-bridge -- [options]

Starts a localhost-only bridge that lets file:// HTML send prompts to codex exec.

Options:
  --host <host>       Bind host. Default: ${DEFAULT_HOST}
  --port <port>       Bind port. Default: ${DEFAULT_PORT}
  --cwd <path>        Workspace root Codex may edit. Default: current directory
  --sandbox <mode>    read-only | workspace-write | danger-full-access. Default: ${DEFAULT_SANDBOX}
  --codex <path>      codex executable. Default: codex from PATH
  --token <token>     Fixed bridge token. Default: generated at startup
`);
}

function fatal(message) {
  console.error(`codex-local-bridge: ${message}`);
  process.exit(1);
}
