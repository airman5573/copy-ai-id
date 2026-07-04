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
import { useCodexStore } from '../stores/useCodexStore';
import { useNotebookStore } from '../stores/useNotebookStore';
import { useVisualEditStore } from '../stores/useVisualEditStore';
import { showEditorToast } from '../toast';
import { copyText } from './clipboard';
import { buildNotebookExportMarkdown } from './export-markdown';

const RUN_POLL_INTERVAL_MS = 2500;
// Client-side safety cap; the server enforces its own codex timeout (5 min by
// default) and reports it as a timedOut result long before this fires.
const RUN_POLL_DEADLINE_MS = 15 * 60_000;
const CODEX_TOAST_MS = 4000;
const SUBJECT_MAX_CHARS = 72;

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

  const exportMarkdown = await buildNotebookExportMarkdown();
  if (!exportMarkdown) {
    showEditorToast(getCurrentMessages().notebook.empty, 'info');
    return;
  }

  useCodexStore.getState().setPhase('resolving');
  const pageUrl = getCleanPageUrl();
  const resolved = await requestCodexBackground<CodexResolveProjectResponse>({
    type: CODEX_RUNTIME_MESSAGE_TYPES.resolveProject,
    pageUrl,
  });

  if (!resolved.ok) {
    useCodexStore.getState().reset();
    await failWithClipboardFallback(exportMarkdown.markdown, describeFailure(resolved));
    return;
  }

  useCodexStore.getState().beginConfirm({
    markdown: exportMarkdown.markdown,
    subject: deriveSubject(exportMarkdown.requestText),
    pageUrl,
    projectPath: resolved.projectPath,
    method: resolved.method,
    detail: resolved.detail,
  });
}

// Called by the confirmation dialog. Starts the run on the server and polls
// its status; success clears the draft/visual edits exactly like a copy.
export async function confirmCodexSend(): Promise<void> {
  const messages = getCurrentMessages().codex;
  const { phase, pending } = useCodexStore.getState();
  if (phase !== 'confirming' || !pending) {
    return;
  }

  useCodexStore.getState().setPhase('running');
  const started = await requestCodexBackground<CodexStartRunResponse>({
    type: CODEX_RUNTIME_MESSAGE_TYPES.startRun,
    prompt: pending.markdown,
    subject: pending.subject,
    projectPath: pending.projectPath,
    pageUrl: pending.pageUrl,
  });

  if (!started.ok) {
    useCodexStore.getState().reset();
    await failWithClipboardFallback(pending.markdown, describeFailure(started));
    return;
  }

  const result = await pollRunUntilDone(started.runId);
  useCodexStore.getState().reset();

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

export function cancelCodexSend(): void {
  const { phase } = useCodexStore.getState();
  if (phase === 'confirming' || phase === 'resolving') {
    useCodexStore.getState().reset();
  }
}

async function pollRunUntilDone(runId: string): Promise<CodexRunResult | null> {
  const deadline = Date.now() + RUN_POLL_DEADLINE_MS;

  while (Date.now() < deadline) {
    await sleep(RUN_POLL_INTERVAL_MS);
    const status = await requestCodexBackground<CodexRunStatusResponse>({
      type: CODEX_RUNTIME_MESSAGE_TYPES.runStatus,
      runId,
    });

    if (!status.ok) {
      // Transient worker/server hiccups shouldn't abort a multi-minute run;
      // only a vanished run id is terminal.
      if (status.code === 'run-not-found') {
        return null;
      }
      continue;
    }

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
    case 'busy':
      return messages.busy;
    default:
      return messages.resolveFailed;
  }
}

async function requestCodexBackground<T extends CodexResponse<object>>(
  message: CodexRuntimeMessage,
): Promise<T> {
  try {
    const response: unknown = await chrome.runtime.sendMessage(message);
    if (!response || typeof response !== 'object' || typeof (response as { ok?: unknown }).ok !== 'boolean') {
      return {
        ok: false,
        code: 'bad-response',
        error: 'Unexpected background response.',
      } satisfies CodexFailure as T;
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
