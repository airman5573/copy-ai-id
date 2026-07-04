import { useEffect, useRef } from 'react';
import { X } from 'lucide-react';

import type { CodexRunEvent } from '../../shared/codex';
import { getCurrentMessages } from '../../shared/i18n';
import { useCodexStore } from '../stores/useCodexStore';

const EVENT_TEXT_CLASSES: Record<CodexRunEvent['kind'], string> = {
  status: 'text-gray-400',
  command: 'text-blue-300',
  reasoning: 'italic text-gray-500',
  message: 'text-gray-100',
  file: 'text-emerald-300',
  error: 'text-red-300',
};

// Live run log, absolutely positioned under the toolbar Codex button. Opens
// automatically when a run starts and auto-closes a few seconds after it
// finishes (see codex-send.ts); the X button closes it early.
export function CodexLogConsole() {
  const logOpen = useCodexStore((state) => state.logOpen);
  const logEvents = useCodexStore((state) => state.logEvents);
  const phase = useCodexStore((state) => state.phase);
  const closeLog = useCodexStore((state) => state.closeLog);
  const listRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const list = listRef.current;
    if (list) {
      list.scrollTop = list.scrollHeight;
    }
  }, [logEvents]);

  if (!logOpen) {
    return null;
  }

  const messages = getCurrentMessages().codex;

  return (
    <div
      className="absolute right-0 top-full z-[150] mt-2 w-[440px] max-w-[80vw] overflow-hidden rounded-xl border border-blue-500/30 bg-[color:var(--ai-editor-chrome-bg,#111827)] shadow-[0_20px_54px_rgba(0,0,0,0.48)] ring-1 ring-white/5"
      data-ai-id="copy-ai-id-editor-codex-log-console"
      role="log"
      aria-live="polite"
    >
      <div className="flex items-center justify-between border-b border-gray-700/70 px-3 py-1.5">
        <span className="flex items-center gap-2 text-[11px] font-semibold text-gray-200">
          {phase === 'running' ? (
            <span className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400" aria-hidden="true" />
          ) : (
            <span className="inline-block h-1.5 w-1.5 rounded-full bg-gray-500" aria-hidden="true" />
          )}
          {messages.logTitle}
        </span>
        <button
          type="button"
          className="inline-flex h-5 w-5 items-center justify-center rounded text-gray-400 transition hover:bg-gray-800 hover:text-gray-200"
          data-ai-id="copy-ai-id-editor-codex-log-close-button"
          title={messages.logClose}
          aria-label={messages.logClose}
          onClick={closeLog}
        >
          <X size={12} aria-hidden="true" />
        </button>
      </div>
      <div
        ref={listRef}
        className="max-h-64 overflow-y-auto px-3 py-2 font-mono text-[11px] leading-relaxed"
      >
        {logEvents.length === 0 ? (
          <div className="text-gray-500">{messages.logWaiting}</div>
        ) : (
          logEvents.map((event) => (
            <div
              key={event.seq}
              className={`whitespace-pre-wrap break-words ${EVENT_TEXT_CLASSES[event.kind] ?? 'text-gray-300'}`}
            >
              {event.text}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
