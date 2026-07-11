// Contracts shared by the editor, the background service worker, and (shape-
// wise) the canonical companion in
// skills/setup-copy-ai-id-codex/assets/codex-server.mjs. The server speaks
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

// Bump only when the extension/companion HTTP contract changes incompatibly.
// The companion reports this from /health and the extension keeps Send
// disabled when the reported version does not match.
export const CODEX_COMPANION_PROTOCOL_VERSION = 1;

export type CodexResolveMethod = 'localhost-port' | 'file-path';

export interface CodexResolvedProject {
  projectPath: string;
  method: CodexResolveMethod;
  detail: string;
  // True only when the localhost/file walk found a .git/package.json marker.
  // Markerless listener/file directories go through the confirm dialog.
  confident: boolean;
}

export type CodexRunStatus = 'running' | 'done';

// The server requests the fast service tier when the installed CLI reports
// support; compatible older CLIs use the standard tier. Reasoning effort is
// the only per-run UI knob, supported from medium up to xhigh.
export type CodexReasoningEffort = 'medium' | 'high' | 'xhigh';

export const CODEX_REASONING_EFFORTS: readonly CodexReasoningEffort[] = ['medium', 'high', 'xhigh'];

export const DEFAULT_CODEX_REASONING_EFFORT: CodexReasoningEffort = 'medium';

export function isCodexReasoningEffort(value: unknown): value is CodexReasoningEffort {
  return value === 'medium' || value === 'high' || value === 'xhigh';
}

// One line of the live run log streamed to the mini console. `seq` is a
// per-run monotonic cursor: the client polls with `after=<last seq>` and the
// server only returns newer entries.
export interface CodexRunEvent {
  seq: number;
  kind: 'status' | 'command' | 'reasoning' | 'message' | 'file' | 'error';
  text: string;
}

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
  | 'not-ready'
  | 'busy'
  | 'run-not-found'
  | 'server-error';

export interface CodexFailure {
  ok: false;
  code: CodexErrorCode;
  error: string;
}

export type CodexResponse<T> = ({ ok: true } & T) | CodexFailure;

// The companion is macOS-only for the initial public release. Health checks
// expose stable ids/codes so the editor can explain exactly which setup step
// is missing without parsing command output or user-specific paths.
export type CodexReadinessCheckId =
  | 'protocol'
  | 'platform'
  | 'node'
  | 'codex'
  | 'codex-exec'
  | 'codex-login'
  | 'git'
  | 'lsof';

export type CodexReadinessIssueCode =
  | 'protocol-version-mismatch'
  | 'unsupported-platform'
  | 'node-version-unsupported'
  | 'codex-not-found'
  | 'codex-version-unavailable'
  | 'codex-exec-unsupported'
  | 'codex-exec-capability-check-failed'
  | 'codex-not-authenticated'
  | 'codex-login-check-failed'
  | 'git-not-found'
  | 'git-version-unavailable'
  | 'lsof-not-found'
  | 'lsof-version-unavailable';

export interface CodexReadinessCheck {
  id: CodexReadinessCheckId;
  ok: boolean;
  issueCode: CodexReadinessIssueCode | null;
  // Intentionally concise and safe to display. The server never includes
  // command stderr, account identifiers, or filesystem paths here.
  detail: string;
}

export interface CodexHealthSuccess {
  ok: true;
  service: 'copy-ai-id-codex-server';
  protocolVersion: number;
  reachable: true;
  // Ready means all required setup checks passed. It is independent of
  // `running`, which only reports whether a Codex run is currently active.
  ready: boolean;
  prerequisitesReady: boolean;
  running: boolean;
  maintenance: boolean;
  acceptingRuns: boolean;
  checkedAt: string;
  checks: CodexReadinessCheck[];
}

export interface CodexHealthFailure extends CodexFailure {
  code: 'server-unreachable' | 'bad-response';
  reachable: false;
  ready: false;
  running: false;
  checks: CodexReadinessCheck[];
}

export type CodexHealthResponse = CodexHealthSuccess | CodexHealthFailure;
export type CodexResolveProjectResponse = CodexResponse<CodexResolvedProject>;
export type CodexStartRunResponse = CodexResponse<{ runId: string }>;
export type CodexRunStatusResponse = CodexResponse<{
  status: CodexRunStatus;
  result: CodexRunResult | null;
  events: CodexRunEvent[];
  nextSeq: number;
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
  reasoningEffort: CodexReasoningEffort;
}

export interface CodexRunStatusMessage {
  type: typeof CODEX_RUNTIME_MESSAGE_TYPES.runStatus;
  runId: string;
  after: number;
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
