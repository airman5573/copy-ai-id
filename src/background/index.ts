// Background service worker. Its only job is proxying editor → local codex
// server requests: content-script fetches are governed by the host page's CSP
// and mixed-content rules, while extension-context fetches are covered by the
// <all_urls> host permission. Each message is one short fetch; the long codex
// run itself is tracked by the editor polling runStatus, so the worker can be
// killed and restarted between polls without losing anything.

import {
  CODEX_CLIENT_HEADER,
  CODEX_CLIENT_HEADER_VALUE,
  CODEX_RUNTIME_MESSAGE_TYPES,
  CODEX_SERVER_BASE_URL,
  isCodexRuntimeMessage,
  type CodexFailure,
  type CodexRuntimeMessage,
} from '../shared/codex';

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
      return fetchCodexServer('GET', '/health');
    case CODEX_RUNTIME_MESSAGE_TYPES.resolveProject:
      return fetchCodexServer('POST', '/resolve-project', { pageUrl: message.pageUrl });
    case CODEX_RUNTIME_MESSAGE_TYPES.startRun:
      return fetchCodexServer('POST', '/runs', {
        prompt: message.prompt,
        subject: message.subject,
        projectPath: message.projectPath,
        pageUrl: message.pageUrl,
        reasoningEffort: message.reasoningEffort,
      });
    case CODEX_RUNTIME_MESSAGE_TYPES.runStatus:
      return fetchCodexServer(
        'GET',
        `/runs/${encodeURIComponent(message.runId)}?after=${encodeURIComponent(String(message.after))}`,
      );
  }
}

async function fetchCodexServer(
  method: 'GET' | 'POST',
  pathname: string,
  body?: Record<string, unknown>,
): Promise<unknown> {
  try {
    const response = await fetch(`${CODEX_SERVER_BASE_URL}${pathname}`, {
      method,
      headers: {
        [CODEX_CLIENT_HEADER]: CODEX_CLIENT_HEADER_VALUE,
        ...(body ? { 'content-type': 'application/json' } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
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
      error instanceof Error ? error.message : 'Could not reach the codex server.',
    );
  }
}

function failure(code: CodexFailure['code'], error: string): CodexFailure {
  return { ok: false, code, error };
}
