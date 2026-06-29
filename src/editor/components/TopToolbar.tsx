import { NotebookText, X } from 'lucide-react';

import { getCurrentMessages } from '../../shared/i18n';
import { useFloatingNotePanelStore } from '../stores/useFloatingNotePanelStore';
import { CanvasControls } from './CanvasControls';
import { ToolbarButton } from './ui/builderChrome';

export interface TopToolbarProps {
  onRequestClose?: () => void;
  onFitZoom?: () => void;
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

  return (
    <header className="copy-ai-id-editor-toolbar" data-ai-id="copy-ai-id-editor-toolbar">
      <div className="copy-ai-id-editor-toolbar__left">
        <div className="copy-ai-id-editor-brand" data-ai-id="copy-ai-id-editor-brand">
          <span className="copy-ai-id-editor-brand__mark" aria-hidden="true">
            AI
          </span>
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

        <ToolbarButton
          className="copy-ai-id-editor-close"
          data-ai-id="copy-ai-id-editor-close-button"
          onClick={onRequestClose}
          title={messages.editor.close}
          aria-label={messages.editor.close}
        >
          <X size={16} aria-hidden="true" />
          <span>{messages.editor.close}</span>
        </ToolbarButton>
      </div>
    </header>
  );
}
