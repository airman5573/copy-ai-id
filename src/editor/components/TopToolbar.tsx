import { X } from 'lucide-react';

import { getCurrentMessages } from '../../shared/i18n';
import { type FitZoomOptions } from '../stores/useBreakpointStore';
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
    </header>
  );
}
