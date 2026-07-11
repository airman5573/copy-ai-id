import { useEffect, useRef, type KeyboardEvent as ReactKeyboardEvent } from 'react';
import { SendHorizontal } from 'lucide-react';

import { getCurrentMessages } from '../../shared/i18n';
import { cancelCodexSend, confirmCodexSend } from '../notebook/codex-send';
import { useCodexStore } from '../stores/useCodexStore';
import { useCodexSetupStore } from '../stores/useCodexSetupStore';

// Safety gate before codex touches any files: shows the auto-detected project
// path and how it was detected, and only starts the run on explicit confirm.
export function CodexConfirmDialog() {
  const phase = useCodexStore((state) => state.phase);
  const pending = useCodexStore((state) => state.pending);
  const codexSetupStatus = useCodexSetupStore((state) => state.status);
  const dialogRef = useRef<HTMLDivElement | null>(null);
  const cancelButtonRef = useRef<HTMLButtonElement | null>(null);
  const confirmButtonRef = useRef<HTMLButtonElement | null>(null);
  const restoreFocusRef = useRef<HTMLElement | null>(null);
  const isOpen = phase === 'confirming' && pending !== null;
  const canRun = codexSetupStatus === 'ready';

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const rootNode = dialogRef.current?.getRootNode();
    const activeElement = rootNode instanceof ShadowRoot
      ? rootNode.activeElement
      : document.activeElement;
    restoreFocusRef.current = activeElement instanceof HTMLElement ? activeElement : null;
    const focusFrame = window.requestAnimationFrame(() => {
      (canRun ? confirmButtonRef.current : cancelButtonRef.current)?.focus();
    });

    return () => {
      window.cancelAnimationFrame(focusFrame);
      restoreFocusRef.current?.focus();
      restoreFocusRef.current = null;
    };
    // Capture the readiness state at open time; later changes only toggle the
    // Run button and should not steal focus from the user.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  if (!isOpen || !pending) {
    return null;
  }

  const messages = getCurrentMessages().codex;
  const methodDescription = pending.method === 'localhost-port'
    ? messages.confirmMethodLocalhostPort
    : messages.confirmMethodFilePath;

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center bg-black/45"
      data-ai-id="copy-ai-id-editor-codex-confirm-overlay"
      onClick={cancelCodexSend}
    >
      <div
        ref={dialogRef}
        className="w-[460px] max-w-[90vw] rounded-2xl border border-blue-500/30 bg-[color:var(--ai-editor-chrome-bg,#111827)] p-5 text-gray-100 shadow-[0_20px_54px_rgba(0,0,0,0.48)] ring-1 ring-white/5"
        data-ai-id="copy-ai-id-editor-codex-confirm-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="copy-ai-id-codex-confirm-title"
        aria-describedby="copy-ai-id-codex-confirm-description"
        onClick={(event) => event.stopPropagation()}
        onKeyDown={(event) => handleConfirmDialogKeyDown(event)}
      >
        <h2
          id="copy-ai-id-codex-confirm-title"
          className="flex items-center gap-2 text-sm font-bold text-gray-50"
        >
          <SendHorizontal size={14} aria-hidden="true" className="text-blue-400" />
          {messages.confirmTitle}
        </h2>
        <p id="copy-ai-id-codex-confirm-description" className="mt-2 text-xs text-gray-400">
          {methodDescription}
        </p>
        <div
          className="mt-3 break-all rounded-lg border border-gray-700 bg-gray-950/70 px-3 py-2 font-mono text-xs text-gray-200"
          data-ai-id="copy-ai-id-editor-codex-confirm-project-path"
        >
          {pending.projectPath}
        </div>
        <p className="mt-2 break-all text-[11px] text-gray-500">{pending.pageUrl}</p>
        <div className="mt-4 flex justify-end gap-2">
          <button
            type="button"
            ref={cancelButtonRef}
            className="rounded-lg border border-gray-600 bg-gray-900 px-3 py-1.5 text-xs text-gray-200 transition hover:border-gray-500 hover:bg-gray-800"
            data-ai-id="copy-ai-id-editor-codex-confirm-cancel-button"
            onClick={cancelCodexSend}
          >
            {messages.confirmCancel}
          </button>
          <button
            type="button"
            ref={confirmButtonRef}
            className="rounded-lg border border-blue-500 bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:border-blue-400 hover:bg-blue-500 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400/70 disabled:cursor-not-allowed disabled:border-gray-600 disabled:bg-gray-700 disabled:text-gray-400 disabled:hover:border-gray-600 disabled:hover:bg-gray-700"
            data-ai-id="copy-ai-id-editor-codex-confirm-run-button"
            disabled={!canRun}
            onClick={(event) => {
              if (!event.isTrusted) {
                return;
              }

              void confirmCodexSend();
            }}
          >
            {messages.confirmRun}
          </button>
        </div>
      </div>
    </div>
  );
}

function handleConfirmDialogKeyDown(event: ReactKeyboardEvent<HTMLDivElement>): void {
  if (event.key === 'Escape' && !event.metaKey && !event.ctrlKey && !event.altKey && !event.shiftKey) {
    event.preventDefault();
    event.stopPropagation();
    cancelCodexSend();
    return;
  }

  if (event.key !== 'Tab') {
    return;
  }

  const focusableElements = Array.from(event.currentTarget.querySelectorAll<HTMLElement>(
    'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
  )).filter((element) => element.getAttribute('aria-hidden') !== 'true');
  if (focusableElements.length === 0) {
    event.preventDefault();
    return;
  }

  const firstElement = focusableElements[0];
  const lastElement = focusableElements[focusableElements.length - 1];
  const rootNode = event.currentTarget.getRootNode();
  const activeElement = rootNode instanceof ShadowRoot
    ? rootNode.activeElement
    : document.activeElement;

  if (event.shiftKey && activeElement === firstElement) {
    event.preventDefault();
    lastElement.focus();
  } else if (!event.shiftKey && activeElement === lastElement) {
    event.preventDefault();
    firstElement.focus();
  }
}
