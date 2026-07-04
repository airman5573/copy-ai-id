// Contracts shared by the editor, the background service worker, and (shape-
// wise) the local codex server in scripts/codex-server.mjs. The server speaks
// plain JSON over http://127.0.0.1 and every response is either
// `{ ok: true, ... }` or `{ ok: false, code, error }`.

export const CODEX_SERVER_PORT = 45130;

export const CODEX_SERVER_BASE_URL = `http://127.0.0.1:${CODEX_SERVER_PORT}`;

// Requests must carry this header. Web pages cannot attach it without a CORS
// preflight (which the server only grants to extension origins), so it shields
// the server from cross-site requests; the extension service worker fetch is
// CORS-exempt via host_permissions and sends it directly.
export const CODEX_CLIENT_HEADER = 'x-copy-ai-id-client';
export const CODEX_CLIENT_HEADER_VALUE = 'copy-ai-id-extension';

export type CodexResolveMethod = 'localhost-port' | 'file-path';

export interface CodexResolvedProject {
  projectPath: string;
  method: CodexResolveMethod;
  detail: string;
}

export type CodexRunStatus = 'running' | 'done';

export interface CodexRunResult {
  ok: boolean;
  exitCode: number | null;
  timedOut: boolean;
  finalMessage: string;
  errorOutput: string;
  error: string | null;
  gitInitialized: boolean;
  preCommitted: boolean;
  committedFiles: string[];
  commitMessage: string | null;
  durationMs: number;
}

export type CodexErrorCode =
  | 'server-unreachable'
  | 'bad-response'
  | 'extension-error'
  | 'unsupported-page'
  | 'no-dev-server'
  | 'unresolved-project'
  | 'invalid-project'
  | 'invalid-request'
  | 'busy'
  | 'run-not-found'
  | 'server-error';

export interface CodexFailure {
  ok: false;
  code: CodexErrorCode;
  error: string;
}

export type CodexResponse<T> = ({ ok: true } & T) | CodexFailure;

export type CodexHealthResponse = CodexResponse<{ running: boolean }>;
export type CodexResolveProjectResponse = CodexResponse<CodexResolvedProject>;
export type CodexStartRunResponse = CodexResponse<{ runId: string }>;
export type CodexRunStatusResponse = CodexResponse<{
  status: CodexRunStatus;
  result: CodexRunResult | null;
}>;

// Editor (content script) → background service worker messages. The worker is
// a thin proxy: it forwards each message as a fetch to the local server so the
// request runs in the extension context (exempt from the host page's CSP and
// mixed-content rules).
export const CODEX_RUNTIME_MESSAGE_TYPES = {
  health: 'copy-ai-id:codex-health',
  resolveProject: 'copy-ai-id:codex-resolve-project',
  startRun: 'copy-ai-id:codex-start-run',
  runStatus: 'copy-ai-id:codex-run-status',
} as const;

export interface CodexHealthMessage {
  type: typeof CODEX_RUNTIME_MESSAGE_TYPES.health;
}

export interface CodexResolveProjectMessage {
  type: typeof CODEX_RUNTIME_MESSAGE_TYPES.resolveProject;
  pageUrl: string;
}

export interface CodexStartRunMessage {
  type: typeof CODEX_RUNTIME_MESSAGE_TYPES.startRun;
  prompt: string;
  subject: string;
  projectPath: string;
  pageUrl: string;
}

export interface CodexRunStatusMessage {
  type: typeof CODEX_RUNTIME_MESSAGE_TYPES.runStatus;
  runId: string;
}

export type CodexRuntimeMessage =
  | CodexHealthMessage
  | CodexResolveProjectMessage
  | CodexStartRunMessage
  | CodexRunStatusMessage;

const CODEX_RUNTIME_MESSAGE_TYPE_SET = new Set<string>(
  Object.values(CODEX_RUNTIME_MESSAGE_TYPES),
);

// Shallow guard by project convention: validates the type string only;
// handlers narrow payloads via the discriminated union.
export function isCodexRuntimeMessage(value: unknown): value is CodexRuntimeMessage {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const type = (value as { type?: unknown }).type;
  return typeof type === 'string' && CODEX_RUNTIME_MESSAGE_TYPE_SET.has(type);
}
