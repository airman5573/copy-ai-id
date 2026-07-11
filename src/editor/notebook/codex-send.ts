import {
  CODEX_RUNTIME_MESSAGE_TYPES,
  type CodexFailure,
  type CodexResolveProjectResponse,
  type CodexResponse,
  type CodexRunResult,
  type CodexRunStatusResponse,
  type CodexRuntimeMessage,
  type CodexStartRunResponse,
} from '../../shared/codex';
import { getCurrentMessages } from '../../shared/i18n';
import { useCodexStore, type CodexPendingSend } from '../stores/useCodexStore';
import {
  refreshCodexSetup,
  useCodexSetupStore,
} from '../stores/useCodexSetupStore';
import { useNotebookStore } from '../stores/useNotebookStore';
import { useVisualEditStore } from '../stores/useVisualEditStore';
import { showEditorToast } from '../toast';
import { copyText } from './clipboard';
import {
  buildNotebookExportMarkdown,
  type NotebookExportMarkdown,
} from './export-markdown';

const RUN_POLL_INTERVAL_MS = 1500;
// Client-side safety cap; the server enforces its own codex timeout (5 min by
// default) and reports it as a timedOut result long before this fires.
const RUN_POLL_DEADLINE_MS = 15 * 60_000;
const CODEX_TOAST_MS = 4000;
const SUBJECT_MAX_CHARS = 72;
const LOG_AUTO_CLOSE_MS = 5000;

// Guards the delayed auto-close: a new run bumps the generation so a stale
// timer never closes the console of the run that came after it.
let logGeneration = 0;
// Identifies the one async export/resolve preparation that currently owns the
// resolving phase. Escape invalidates it so a stale continuation cannot reset
// or overtake a newer send attempt.
let activePreparationToken: symbol | null = null;

// Entry point for the "Send to Codex" buttons: build the same markdown the
// copy button produces, resolve the local project for the current page, then
// wait for the user to confirm the detected path in the dialog.
export async function sendNotebookDraftToCodex(): Promise<void> {
  const messages = getCurrentMessages().codex;
  const codexStore = useCodexStore.getState();
  if (codexStore.phase !== 'idle') {
    if (codexStore.phase === 'running') {
      showEditorToast(messages.busy, 'info');
    }
    return;
  }

  // Claim the send synchronously before the first await so two rapid trusted
  // clicks cannot both start preparing a run.
  const preparationToken = Symbol('codex-send-preparation');
  activePreparationToken = preparationToken;
  codexStore.setPhase('resolving');

  let exportMarkdown: NotebookExportMarkdown | null;
  try {
    exportMarkdown = await buildNotebookExportMarkdown();
  } catch {
    if (!resetOwnedPreparation(preparationToken)) {
      return;
    }

    showEditorToast(getCurrentMessages().notebook.copyFailed, 'error');
    return;
  }

  if (!ownsPreparation(preparationToken)) {
    return;
  }

  if (!exportMarkdown) {
    resetOwnedPreparation(preparationToken);
    showEditorToast(getCurrentMessages().notebook.empty, 'info');
    return;
  }

  let pageUrl: string;
  try {
    pageUrl = getCleanPageUrl();
  } catch {
    if (!resetOwnedPreparation(preparationToken)) {
      return;
    }

    await failWithClipboardFallback(exportMarkdown.markdown, messages.resolveFailed);
    return;
  }

  const resolved = await requestCodexBackground<CodexResolveProjectResponse>({
    type: CODEX_RUNTIME_MESSAGE_TYPES.resolveProject,
    pageUrl,
  }, isCodexResolveProjectSuccess);

  if (!ownsPreparation(preparationToken)) {
    return;
  }

  if (!resolved.ok) {
    resetOwnedPreparation(preparationToken);
    void refreshCodexSetup({ showChecking: true });
    await failWithClipboardFallback(exportMarkdown.markdown, describeFailure(resolved));
    return;
  }

  const pending: CodexPendingSend = {
    markdown: exportMarkdown.markdown,
    subject: deriveSubject(exportMarkdown.requestText),
    pageUrl,
    projectPath: resolved.projectPath,
    method: resolved.method,
    detail: resolved.detail,
  };

  // Both successful transitions below are synchronous, so releasing ownership
  // immediately before them leaves no opportunity for another send to claim.
  activePreparationToken = null;

  // A marker-based localhost/file root runs immediately; markerless listener
  // or file directories always go through the trusted-path confirm dialog.
  if (resolved.confident) {
    showEditorToast(
      messages.startedIn.replace('{path}', pending.projectPath),
      'info',
      CODEX_TOAST_MS,
    );
    await runPendingCodexSend(pending);
    return;
  }

  useCodexStore.getState().beginConfirm(pending);
}

// Called by the confirmation dialog for non-confident detections.
export async function confirmCodexSend(): Promise<void> {
  const { phase, pending } = useCodexStore.getState();
  if (
    phase !== 'confirming'
    || !pending
    || useCodexSetupStore.getState().status !== 'ready'
  ) {
    return;
  }

  await runPendingCodexSend(pending);
}

// Starts the run on the server and polls its status; success clears the
// draft/visual edits exactly like a copy.
async function runPendingCodexSend(pending: CodexPendingSend): Promise<void> {
  const messages = getCurrentMessages().codex;
  const codexStore = useCodexStore.getState();
  codexStore.beginRun(pending);
  codexStore.startLog();
  logGeneration += 1;

  const started = await requestCodexBackground<CodexStartRunResponse>({
    type: CODEX_RUNTIME_MESSAGE_TYPES.startRun,
    prompt: pending.markdown,
    subject: pending.subject,
    projectPath: pending.projectPath,
    pageUrl: pending.pageUrl,
    reasoningEffort: codexStore.reasoningEffort,
  }, isCodexStartRunSuccess);

  if (!started.ok) {
    useCodexStore.getState().reset();
    void refreshCodexSetup({ showChecking: true });
    scheduleLogAutoClose();
    await failWithClipboardFallback(pending.markdown, describeFailure(started));
    return;
  }

  void refreshCodexSetup({ showChecking: true });
  const result = await pollRunUntilDone(started.runId);
  useCodexStore.getState().reset();
  void refreshCodexSetup({ showChecking: true });
  scheduleLogAutoClose();

  if (!result) {
    await failWithClipboardFallback(pending.markdown, messages.timedOut);
    return;
  }

  if (!result.ok) {
    await failWithClipboardFallback(
      pending.markdown,
      result.timedOut ? messages.timedOut : messages.failed,
    );
    return;
  }

  useNotebookStore.getState().clearDraft();
  useVisualEditStore.getState().clearVisualEdits();
  const successMessage = result.committedFiles.length > 0
    ? messages.successCommitted.replace('{count}', String(result.committedFiles.length))
    : messages.successNoChanges;
  showEditorToast(successMessage, 'info', CODEX_TOAST_MS);
}

function scheduleLogAutoClose(): void {
  const generation = logGeneration;
  window.setTimeout(() => {
    if (logGeneration === generation) {
      useCodexStore.getState().closeLog();
    }
  }, LOG_AUTO_CLOSE_MS);
}

export function cancelCodexSend(): void {
  const { phase } = useCodexStore.getState();
  if (phase === 'confirming' || phase === 'resolving') {
    activePreparationToken = null;
    useCodexStore.getState().reset();
  }
}

function ownsPreparation(token: symbol): boolean {
  return activePreparationToken === token
    && useCodexStore.getState().phase === 'resolving';
}

function resetOwnedPreparation(token: symbol): boolean {
  if (!ownsPreparation(token)) {
    return false;
  }

  activePreparationToken = null;
  useCodexStore.getState().reset();
  return true;
}

async function pollRunUntilDone(runId: string): Promise<CodexRunResult | null> {
  const deadline = Date.now() + RUN_POLL_DEADLINE_MS;
  let after = 0;

  while (Date.now() < deadline) {
    await sleep(RUN_POLL_INTERVAL_MS);
    const status = await requestCodexBackground<CodexRunStatusResponse>({
      type: CODEX_RUNTIME_MESSAGE_TYPES.runStatus,
      runId,
      after,
    }, isCodexRunStatusSuccess);

    if (!status.ok) {
      // Transient worker/server hiccups shouldn't abort a multi-minute run;
      // only a vanished run id is terminal.
      if (status.code === 'run-not-found') {
        return null;
      }
      continue;
    }

    useCodexStore.getState().appendLogEvents(status.events);
    after = status.nextSeq;

    if (status.status === 'done') {
      return status.result;
    }
  }

  return null;
}

async function failWithClipboardFallback(markdown: string, baseMessage: string): Promise<void> {
  const messages = getCurrentMessages().codex;
  const copyResult = await copyText(markdown);
  const message = copyResult.ok ? `${baseMessage} ${messages.fallbackCopied}` : baseMessage;
  showEditorToast(message, 'error', CODEX_TOAST_MS);
}

function describeFailure(failure: CodexFailure): string {
  const messages = getCurrentMessages().codex;
  switch (failure.code) {
    case 'server-unreachable':
    case 'extension-error':
    case 'bad-response':
      return messages.serverUnreachable;
    case 'unsupported-page':
      return messages.unsupportedPage;
    case 'not-ready':
      return messages.setup.statusDescription.notReady;
    case 'busy':
      return messages.busy;
    default:
      return messages.resolveFailed;
  }
}

async function requestCodexBackground<T extends CodexResponse<object>>(
  message: CodexRuntimeMessage,
  isValidSuccess: (value: Record<string, unknown>) => boolean,
): Promise<T> {
  try {
    const response: unknown = await chrome.runtime.sendMessage(message);
    if (!response || typeof response !== 'object') {
      return badResponseFailure<T>();
    }

    const candidate = response as Record<string, unknown>;
    if (candidate.ok === false) {
      return typeof candidate.code === 'string' && typeof candidate.error === 'string'
        ? response as T
        : badResponseFailure<T>();
    }
    if (candidate.ok !== true || !isValidSuccess(candidate)) {
      return badResponseFailure<T>();
    }

    return response as T;
  } catch (error) {
    // chrome.runtime is unavailable when the extension context is invalidated
    // (e.g. the unpacked extension was reloaded under a live editor instance).
    return {
      ok: false,
      code: 'extension-error',
      error: error instanceof Error ? error.message : 'Extension messaging failed.',
    } satisfies CodexFailure as T;
  }
}

function badResponseFailure<T extends CodexResponse<object>>(): T {
  return {
    ok: false,
    code: 'bad-response',
    error: 'Unexpected background response.',
  } satisfies CodexFailure as T;
}

function isCodexResolveProjectSuccess(value: Record<string, unknown>): boolean {
  return typeof value.projectPath === 'string'
    && (value.method === 'localhost-port' || value.method === 'file-path')
    && typeof value.detail === 'string'
    && typeof value.confident === 'boolean';
}

function isCodexStartRunSuccess(value: Record<string, unknown>): boolean {
  return typeof value.runId === 'string' && value.runId.length > 0;
}

function isCodexRunStatusSuccess(value: Record<string, unknown>): boolean {
  if (
    (value.status !== 'running' && value.status !== 'done')
    || !Number.isSafeInteger(value.nextSeq)
    || Number(value.nextSeq) < 0
    || !Array.isArray(value.events)
    || !value.events.every(isCodexRunEvent)
  ) {
    return false;
  }

  return value.status === 'running'
    ? value.result === null
    : isCodexRunResult(value.result);
}

function isCodexRunEvent(value: unknown): boolean {
  if (!value || typeof value !== 'object') {
    return false;
  }
  const event = value as Record<string, unknown>;
  return Number.isSafeInteger(event.seq)
    && Number(event.seq) > 0
    && typeof event.text === 'string'
    && (
      event.kind === 'status'
      || event.kind === 'command'
      || event.kind === 'reasoning'
      || event.kind === 'message'
      || event.kind === 'file'
      || event.kind === 'error'
    );
}

function isCodexRunResult(value: unknown): boolean {
  if (!value || typeof value !== 'object') {
    return false;
  }
  const result = value as Record<string, unknown>;
  return typeof result.ok === 'boolean'
    && (result.exitCode === null || Number.isInteger(result.exitCode))
    && typeof result.timedOut === 'boolean'
    && typeof result.finalMessage === 'string'
    && typeof result.errorOutput === 'string'
    && (result.error === null || typeof result.error === 'string')
    && typeof result.gitInitialized === 'boolean'
    && typeof result.preCommitted === 'boolean'
    && Array.isArray(result.committedFiles)
    && result.committedFiles.every((file) => typeof file === 'string')
    && (result.commitMessage === null || typeof result.commitMessage === 'string')
    && typeof result.durationMs === 'number'
    && Number.isFinite(result.durationMs)
    && result.durationMs >= 0;
}

function getCleanPageUrl(): string {
  const url = new URL(window.location.href);
  url.searchParams.delete('copyaiid');
  url.searchParams.delete('copy-ai-id-preview');
  return url.toString();
}

function deriveSubject(requestText: string): string {
  const firstLine = requestText
    .split('\n')
    .map((line) => line.trim())
    .find(Boolean) ?? '';
  return firstLine.length > SUBJECT_MAX_CHARS
    ? `${firstLine.slice(0, SUBJECT_MAX_CHARS - 1)}…`
    : firstLine;
}

function sleep(durationMs: number): Promise<void> {
  return new Promise((resolve) => {
    window.setTimeout(resolve, durationMs);
  });
}
