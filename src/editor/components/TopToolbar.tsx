import { Copy, NotebookText, X } from 'lucide-react';

import { getCurrentMessages } from '../../shared/i18n';
import { copyNotebookDraftFromStore } from '../notebook/copy';
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
  onToggleNotePanelFloating?: () => void;
}

export function TopToolbar({
  onRequestClose,
  onFitZoom,
  onToggleNotePanelFloating,
}: TopToolbarProps) {
  const messages = getCurrentMessages();
  const notePanelFloatingEnabled = useFloatingNotePanelStore((state) => state.enabled);
  const toggleNotePanelFloating = useFloatingNotePanelStore((state) => state.toggleEnabled);
  const notePanelFloatingTitle = notePanelFloatingEnabled
    ? messages.editor.notePanelFloatingDisableTitle
    : messages.editor.notePanelFloatingEnableTitle;
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
          className={`copy-ai-id-editor-note-panel-floating-toggle${notePanelFloatingEnabled ? ' is-active' : ''}`}
          data-ai-id="copy-ai-id-editor-note-panel-floating-toggle-button"
          onClick={onToggleNotePanelFloating ?? toggleNotePanelFloating}
          title={notePanelFloatingTitle}
          aria-label={messages.editor.notePanelFloatingToggle}
          aria-pressed={notePanelFloatingEnabled}
        >
          <NotebookText size={14} aria-hidden="true" />
          <span>{messages.editor.notePanelFloatingToggle}</span>
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
      </div>
    </header>
  );
}
