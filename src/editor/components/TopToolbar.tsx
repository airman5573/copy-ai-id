import { useEffect } from 'react';
import { Copy, NotebookText, SendHorizontal, X } from 'lucide-react';

import { isCodexReasoningEffort, CODEX_REASONING_EFFORTS } from '../../shared/codex';
import { getCurrentMessages } from '../../shared/i18n';
import { requestNotePanelFocus } from '../note-panel-focus';
import { sendNotebookDraftToCodex } from '../notebook/codex-send';
import { copyNotebookDraftFromStore } from '../notebook/copy';
import { CodexLogConsole } from './CodexLogConsole';
import { CodexSetupButton } from './CodexSetupButton';
import { useCodexStore } from '../stores/useCodexStore';
import { useCodexSetupStore } from '../stores/useCodexSetupStore';
import { useFloatingNotePanelStore } from '../stores/useFloatingNotePanelStore';
import { type FitZoomOptions } from '../stores/useBreakpointStore';
import {
  selectHasNotebookDraftForCopy,
  useNotebookStore,
} from '../stores/useNotebookStore';
import {
  selectHasVisualEdits,
  useVisualEditStore,
} from '../stores/useVisualEditStore';
import { CanvasControls } from './CanvasControls';
import { ToolbarButton } from './ui/builderChrome';

export interface TopToolbarProps {
  onRequestClose?: () => void;
  onFitZoom?: (options?: FitZoomOptions) => void;
}

export function TopToolbar({
  onRequestClose,
  onFitZoom,
}: TopToolbarProps) {
  const messages = getCurrentMessages();
  const notePanelOpen = useFloatingNotePanelStore((state) => state.isOpen);
  const openNotePanel = useFloatingNotePanelStore((state) => state.openPanel);
  const closeNotePanel = useFloatingNotePanelStore((state) => state.closePanel);
  const notePanelTitle = notePanelOpen
    ? messages.editor.notePanelCloseTitle
    : messages.editor.notePanelOpenTitle;
  const handleToggleNotePanel = (): void => {
    if (notePanelOpen) {
      closeNotePanel();
      return;
    }

    openNotePanel();
    window.requestAnimationFrame(() => {
      requestNotePanelFocus();
    });
  };
  const copyStatus = useNotebookStore((state) => state.copyStatus);
  const hasNotebookDraftForCopy = useNotebookStore(selectHasNotebookDraftForCopy);
  const hasCopyableVisualEdits = useVisualEditStore(selectHasVisualEdits);
  const canCopyNotebook = hasNotebookDraftForCopy || hasCopyableVisualEdits;
  const copyButtonLabel = copyStatus === 'copied'
    ? messages.editor.copySuccess
    : copyStatus === 'failed'
      ? messages.editor.copyFailed
      : copyStatus === 'empty'
      ? messages.notebook.empty
      : messages.notebook.save;
  const codexPhase = useCodexStore((state) => state.phase);
  const codexSetupStatus = useCodexSetupStore((state) => state.status);
  const isCodexSetupReady = codexSetupStatus === 'ready';
  const reasoningEffort = useCodexStore((state) => state.reasoningEffort);
  const setReasoningEffort = useCodexStore((state) => state.setReasoningEffort);
  const hydrateReasoningEffort = useCodexStore((state) => state.hydrateReasoningEffort);
  useEffect(() => {
    void hydrateReasoningEffort();
  }, [hydrateReasoningEffort]);
  const reasoningLabels = {
    medium: messages.codex.reasoningMedium,
    high: messages.codex.reasoningHigh,
    xhigh: messages.codex.reasoningXhigh,
  } as const;
  const codexButtonLabel = codexPhase === 'resolving'
    ? messages.codex.resolving
    : codexPhase === 'running'
      ? messages.codex.running
      : messages.codex.send;
  const codexButtonTitle = isCodexSetupReady
    ? messages.codex.sendTitle
    : codexSetupStatus === 'not-ready'
      ? messages.codex.setup.statusDescription.notReady
      : messages.codex.setup.statusDescription[codexSetupStatus];

  return (
    <header className="copy-ai-id-editor-toolbar" data-ai-id="copy-ai-id-editor-toolbar">
      <div className="copy-ai-id-editor-toolbar__left">
        <div className="copy-ai-id-editor-brand" data-ai-id="copy-ai-id-editor-brand">
          <ToolbarButton
            className="copy-ai-id-editor-close copy-ai-id-editor-brand__close"
            data-ai-id="copy-ai-id-editor-close-button"
            onClick={onRequestClose}
            title={messages.editor.close}
            aria-label={messages.editor.close}
          >
            <X size={16} aria-hidden="true" />
            <span className="sr-only">{messages.editor.close}</span>
          </ToolbarButton>
          <div>
            <h1>{messages.editor.title}</h1>
            <p>{messages.editor.subtitle}</p>
          </div>
        </div>
      </div>

      <CanvasControls onFitZoom={onFitZoom} />

      <div className="copy-ai-id-editor-toolbar__right">
        <ToolbarButton
          className={`copy-ai-id-editor-note-panel-toggle${notePanelOpen ? ' is-active' : ''}`}
          data-ai-id="copy-ai-id-editor-note-panel-toggle-button"
          onClick={handleToggleNotePanel}
          title={notePanelTitle}
          aria-label={messages.editor.notePanelToggle}
          aria-pressed={notePanelOpen}
        >
          <NotebookText size={14} aria-hidden="true" />
          <span>{messages.editor.notePanelToggle}</span>
        </ToolbarButton>

        <button
          type="button"
          className={`copy-ai-id-editor-copy-button copy-ai-id-editor-copy-button--toolbar copy-ai-id-editor-copy-button--${copyStatus}`}
          data-ai-id="copy-ai-id-editor-toolbar-copy-button"
          data-ai-editor-copy-eligible={canCopyNotebook ? 'true' : 'false'}
          title={`${messages.notebook.save} (Shift + Enter)`}
          onClick={() => {
            void copyNotebookDraftFromStore();
          }}
        >
          <Copy size={14} aria-hidden="true" />
          <span>{copyButtonLabel}</span>
        </button>

        <div className="relative flex items-center gap-2">
          <CodexSetupButton placement="toolbar" />

          <select
            className="h-8 cursor-pointer rounded-lg border border-gray-600 bg-gray-900 px-1.5 text-xs text-gray-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400/70"
            data-ai-id="copy-ai-id-editor-codex-reasoning-select"
            title={messages.codex.reasoningTitle}
            aria-label={messages.codex.reasoningTitle}
            value={reasoningEffort}
            onChange={(event) => {
              const value = event.currentTarget.value;
              if (isCodexReasoningEffort(value)) {
                setReasoningEffort(value);
              }
            }}
          >
            {CODEX_REASONING_EFFORTS.map((effort) => (
              <option key={effort} value={effort}>
                {reasoningLabels[effort]}
              </option>
            ))}
          </select>

          <button
            type="button"
            className={`copy-ai-id-editor-copy-button copy-ai-id-editor-copy-button--toolbar copy-ai-id-editor-codex-button copy-ai-id-editor-codex-button--${codexPhase}`}
            data-ai-id="copy-ai-id-editor-toolbar-codex-button"
            data-codex-setup-status={codexSetupStatus}
            title={codexButtonTitle}
            aria-label={codexButtonTitle}
            disabled={codexPhase !== 'idle' || !isCodexSetupReady}
            onClick={(event) => {
              if (!event.isTrusted) {
                return;
              }

              void sendNotebookDraftToCodex();
            }}
          >
            <SendHorizontal size={14} aria-hidden="true" />
            <span>{codexButtonLabel}</span>
          </button>

          <CodexLogConsole />
        </div>
      </div>
    </header>
  );
}
