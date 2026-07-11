// Background service worker. Its only job is proxying editor → local codex
// server requests: content-script fetches are governed by the host page's CSP
// and mixed-content rules, while extension-context fetches are covered by the
// <all_urls> host permission. Each message is one short fetch; the long codex
// run itself is tracked by the editor polling runStatus, so the worker can be
// killed and restarted between polls without losing anything.

import {
  CODEX_CLIENT_HEADER,
  CODEX_CLIENT_HEADER_VALUE,
  CODEX_COMPANION_PROTOCOL_VERSION,
  CODEX_RUNTIME_MESSAGE_TYPES,
  CODEX_SERVER_BASE_URL,
  isCodexRuntimeMessage,
  type CodexFailure,
  type CodexHealthResponse,
  type CodexHealthSuccess,
  type CodexRuntimeMessage,
} from '../shared/codex';

const CODEX_HEALTH_TIMEOUT_MS = 7000;
// Project resolution can execute two sequential lsof probes, each capped at
// 10 seconds by the companion. Keep the proxy timeout finite while allowing
// those server-side caps to expire cleanly.
const CODEX_RESOLVE_PROJECT_TIMEOUT_MS = 25_000;
// Starting a run first awaits the companion's readiness probe (commands are
// capped at 5 seconds). This deliberately generous local timeout reduces the
// chance of aborting after the server accepted a run but before its runId
// response arrived.
const CODEX_START_RUN_TIMEOUT_MS = 15_000;
// A single stalled status poll must not defeat the editor's 15-minute run
// deadline. Poll failures are transient and the editor retries them.
const CODEX_RUN_STATUS_TIMEOUT_MS = 5_000;

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (!isCodexRuntimeMessage(message)) {
    return undefined;
  }

  void routeCodexMessage(message).then(sendResponse);
  return true;
});

async function routeCodexMessage(message: CodexRuntimeMessage): Promise<unknown> {
  switch (message.type) {
    case CODEX_RUNTIME_MESSAGE_TYPES.health:
      return fetchCodexHealth();
    case CODEX_RUNTIME_MESSAGE_TYPES.resolveProject:
      return fetchCodexServer(
        'POST',
        '/resolve-project',
        { pageUrl: message.pageUrl },
        { timeoutMs: CODEX_RESOLVE_PROJECT_TIMEOUT_MS },
      );
    case CODEX_RUNTIME_MESSAGE_TYPES.startRun:
      return fetchCodexServer(
        'POST',
        '/runs',
        {
          prompt: message.prompt,
          subject: message.subject,
          projectPath: message.projectPath,
          pageUrl: message.pageUrl,
          reasoningEffort: message.reasoningEffort,
        },
        { timeoutMs: CODEX_START_RUN_TIMEOUT_MS },
      );
    case CODEX_RUNTIME_MESSAGE_TYPES.runStatus:
      return fetchCodexServer(
        'GET',
        `/runs/${encodeURIComponent(message.runId)}?after=${encodeURIComponent(String(message.after))}`,
        undefined,
        { timeoutMs: CODEX_RUN_STATUS_TIMEOUT_MS },
      );
  }
}

async function fetchCodexHealth(): Promise<CodexHealthResponse> {
  const payload = await fetchCodexServer(
    'GET',
    '/health',
    undefined,
    { timeoutMs: CODEX_HEALTH_TIMEOUT_MS },
  );

  if (isCodexHealthPayload(payload)) {
    if (payload.protocolVersion !== CODEX_COMPANION_PROTOCOL_VERSION) {
      return incompatibleProtocolHealth(payload);
    }
    return hasCodexManagementHealth(payload)
      ? payload as CodexHealthSuccess
      : healthFailure('bad-response', 'Companion health omitted its management state.');
  }

  if (isCodexFailure(payload) && payload.code === 'server-unreachable') {
    return healthFailure('server-unreachable', payload.error);
  }

  return healthFailure('bad-response', 'Unexpected codex server health response.');
}

async function fetchCodexServer(
  method: 'GET' | 'POST',
  pathname: string,
  body?: Record<string, unknown>,
  options?: { timeoutMs?: number },
): Promise<unknown> {
  const controller = new AbortController();
  const timeoutId = options?.timeoutMs
    ? setTimeout(() => controller.abort(), options.timeoutMs)
    : null;

  try {
    const response = await fetch(`${CODEX_SERVER_BASE_URL}${pathname}`, {
      method,
      headers: {
        [CODEX_CLIENT_HEADER]: CODEX_CLIENT_HEADER_VALUE,
        ...(body ? { 'content-type': 'application/json' } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
      signal: controller.signal,
    });
    const payload: unknown = await response.json().catch(() => null);
    if (!payload || typeof payload !== 'object' || typeof (payload as { ok?: unknown }).ok !== 'boolean') {
      return failure('bad-response', `Unexpected codex server response (HTTP ${response.status}).`);
    }

    // The server already speaks the shared { ok, ... } shape; pass it through.
    return payload;
  } catch (error) {
    return failure(
      'server-unreachable',
      controller.signal.aborted
        ? 'Timed out while contacting the codex server.'
        : error instanceof Error ? error.message : 'Could not reach the codex server.',
    );
  } finally {
    if (timeoutId !== null) {
      clearTimeout(timeoutId);
    }
  }
}

type CodexHealthPayload = Omit<
  CodexHealthSuccess,
  'protocolVersion' | 'prerequisitesReady' | 'maintenance' | 'acceptingRuns'
> & {
  protocolVersion?: unknown;
  prerequisitesReady?: unknown;
  maintenance?: unknown;
  acceptingRuns?: unknown;
};

function isCodexHealthPayload(value: unknown): value is CodexHealthPayload {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const health = value as Partial<CodexHealthPayload>;
  return health.ok === true
    && health.service === 'copy-ai-id-codex-server'
    && health.reachable === true
    && typeof health.ready === 'boolean'
    && typeof health.running === 'boolean'
    && typeof health.checkedAt === 'string'
    && Array.isArray(health.checks);
}

function hasCodexManagementHealth(value: CodexHealthPayload): boolean {
  return typeof value.prerequisitesReady === 'boolean'
    && typeof value.maintenance === 'boolean'
    && typeof value.acceptingRuns === 'boolean';
}

function incompatibleProtocolHealth(health: CodexHealthPayload): CodexHealthSuccess {
  const reportedVersion = typeof health.protocolVersion === 'number'
    && Number.isSafeInteger(health.protocolVersion)
    && health.protocolVersion > 0
    ? health.protocolVersion
    : 0;

  return {
    ...health,
    protocolVersion: reportedVersion,
    ready: false,
    prerequisitesReady: false,
    running: false,
    maintenance: false,
    acceptingRuns: false,
    checks: [
      ...health.checks,
      {
        id: 'protocol',
        ok: false,
        issueCode: 'protocol-version-mismatch',
        detail: reportedVersion > 0
          ? `Companion protocol ${reportedVersion}; extension requires ${CODEX_COMPANION_PROTOCOL_VERSION}.`
          : `Companion did not report a protocol version; extension requires ${CODEX_COMPANION_PROTOCOL_VERSION}.`,
      },
    ],
  };
}

function isCodexFailure(value: unknown): value is CodexFailure {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const result = value as Partial<CodexFailure>;
  return result.ok === false && typeof result.code === 'string' && typeof result.error === 'string';
}

function failure(code: CodexFailure['code'], error: string): CodexFailure {
  return { ok: false, code, error };
}

function healthFailure(
  code: 'server-unreachable' | 'bad-response',
  error: string,
): CodexHealthResponse {
  return {
    ok: false,
    code,
    error,
    reachable: false,
    ready: false,
    running: false,
    checks: [],
  };
}
