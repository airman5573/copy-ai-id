import { X } from 'lucide-react';

import { getCurrentMessages } from '../../shared/i18n';
import { CanvasControls } from './CanvasControls';
import { ToolbarButton } from './ui/builderChrome';

export interface TopToolbarProps {
  onRequestClose?: () => void;
  onFitZoom?: () => void;
}

export function TopToolbar({
  onRequestClose,
  onFitZoom,
}: TopToolbarProps) {
  const messages = getCurrentMessages();

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
    </header>
  );
}
