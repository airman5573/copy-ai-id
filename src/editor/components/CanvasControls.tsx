import { Maximize2, Minus, Plus, RotateCcw } from 'lucide-react';

import {
  BREAKPOINTS,
  breakpointById,
  type BreakpointId,
} from '../../shared/breakpoints';
import { getCurrentMessages } from '../../shared/i18n';
import {
  CANVAS_ZOOM_STEP,
  MAX_ZOOM,
  MIN_ZOOM,
  useBreakpointStore,
} from '../stores/useBreakpointStore';
import { ToolbarButton, ToolbarSegment } from './ui/builderChrome';

export interface CanvasControlsProps {
  onFitZoom?: () => void;
}

export function CanvasControls({ onFitZoom }: CanvasControlsProps) {
  const messages = getCurrentMessages();
  const activeBreakpointId = useBreakpointStore((state) => state.activeBreakpointId);
  const viewportMode = useBreakpointStore((state) => state.viewportMode);
  const customPreviewWidth = useBreakpointStore((state) => state.customPreviewWidth);
  const previewHeight = useBreakpointStore((state) => state.previewHeight);
  const zoom = useBreakpointStore((state) => state.zoomById[state.activeBreakpointId]);
  const setBreakpoint = useBreakpointStore((state) => state.setBreakpoint);
  const persistCustomPreviewWidth = useBreakpointStore((state) => state.persistCustomPreviewWidth);
  const stepZoom = useBreakpointStore((state) => state.stepZoom);
  const resetZoom = useBreakpointStore((state) => state.resetZoom);
  const fitZoom = useBreakpointStore((state) => state.fitZoom);
  const activeBreakpoint = breakpointById(activeBreakpointId);
  const activePreviewWidth = viewportMode === 'custom' ? customPreviewWidth : activeBreakpoint.width;

  const handleBreakpointChange = (breakpointId: BreakpointId): void => {
    setBreakpoint(breakpointId);

    if (onFitZoom) {
      onFitZoom();
      return;
    }

    fitZoom();
  };

  const handleCustomViewportChange = (): void => {
    void persistCustomPreviewWidth(customPreviewWidth);

    if (onFitZoom) {
      onFitZoom();
      return;
    }

    fitZoom();
  };

  return (
    <div className="copy-ai-id-editor-canvas-controls" data-ai-id="copy-ai-id-editor-canvas-controls">
      <ToolbarSegment>
        {BREAKPOINTS.map((breakpoint) => {
          const breakpointLabel = messages.breakpoints[breakpoint.id];

          return (
            <ToolbarButton
              key={breakpoint.id}
              className={viewportMode === 'breakpoint' && breakpoint.id === activeBreakpointId ? 'is-active' : ''}
              data-ai-id={`copy-ai-id-editor-breakpoint-${breakpoint.id}-button`}
              onClick={() => handleBreakpointChange(breakpoint.id)}
              title={`${breakpointLabel} · ${breakpoint.width}px`}
              aria-pressed={viewportMode === 'breakpoint' && breakpoint.id === activeBreakpointId}
            >
              {breakpointLabel}
            </ToolbarButton>
          );
        })}
        <ToolbarButton
          className={viewportMode === 'custom' ? 'is-active' : ''}
          data-ai-id="copy-ai-id-editor-breakpoint-custom-button"
          onClick={handleCustomViewportChange}
          title={`${messages.editor.customViewport} · ${customPreviewWidth}px`}
          aria-pressed={viewportMode === 'custom'}
        >
          {messages.editor.customViewport}
        </ToolbarButton>
      </ToolbarSegment>

      <span className="copy-ai-id-editor-viewport-pill" data-ai-id="copy-ai-id-editor-viewport-width-pill">
        {activePreviewWidth} × {previewHeight}px
      </span>

      <ToolbarSegment>
        <ToolbarButton
          data-ai-id="copy-ai-id-editor-zoom-out-button"
          onClick={() => stepZoom(-CANVAS_ZOOM_STEP)}
          disabled={zoom <= MIN_ZOOM}
          title={messages.editor.zoomOut}
          aria-label={messages.editor.zoomOut}
        >
          <Minus size={14} aria-hidden="true" />
        </ToolbarButton>
        <ToolbarButton
          data-ai-id="copy-ai-id-editor-zoom-reset-button"
          onClick={resetZoom}
          title={messages.editor.zoomReset}
          aria-label={messages.editor.zoomReset}
        >
          <RotateCcw size={14} aria-hidden="true" />
          <span>{Math.round(zoom * 100)}%</span>
        </ToolbarButton>
        <ToolbarButton
          data-ai-id="copy-ai-id-editor-zoom-in-button"
          onClick={() => stepZoom(CANVAS_ZOOM_STEP)}
          disabled={zoom >= MAX_ZOOM}
          title={messages.editor.zoomIn}
          aria-label={messages.editor.zoomIn}
        >
          <Plus size={14} aria-hidden="true" />
        </ToolbarButton>
        <ToolbarButton
          data-ai-id="copy-ai-id-editor-zoom-fit-button"
          onClick={() => {
            if (onFitZoom) {
              onFitZoom();
              return;
            }
            fitZoom();
          }}
          title={messages.editor.zoomFit}
          aria-label={messages.editor.zoomFit}
        >
          <Maximize2 size={14} aria-hidden="true" />
          <span>{messages.editor.zoomFit}</span>
        </ToolbarButton>
      </ToolbarSegment>
    </div>
  );
}
