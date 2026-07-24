import { useEffect, useState, type ChangeEvent, type KeyboardEvent } from 'react';
import { Minus, NotebookText, Plus } from 'lucide-react';

import {
  BREAKPOINTS,
  breakpointById,
  type BreakpointId,
} from '../../shared/breakpoints';
import { getCurrentMessages } from '../../shared/i18n';
import { requestNotePanelFocus } from '../note-panel-focus';
import {
  CANVAS_ZOOM_STEP,
  MAX_ZOOM,
  MIN_ZOOM,
  useBreakpointStore,
  type FitZoomOptions,
} from '../stores/useBreakpointStore';
import { useFloatingNotePanelStore } from '../stores/useFloatingNotePanelStore';
import { useNotebookStore } from '../stores/useNotebookStore';
import { ToolbarButton, ToolbarSegment } from './ui/builderChrome';

export interface CanvasControlsProps {
  onFitZoom?: (options?: FitZoomOptions) => void;
}

export function CanvasControls({ onFitZoom }: CanvasControlsProps) {
  const messages = getCurrentMessages();
  const activeBreakpointId = useBreakpointStore((state) => state.activeBreakpointId);
  const viewportMode = useBreakpointStore((state) => state.viewportMode);
  const customPreviewWidth = useBreakpointStore((state) => state.customPreviewWidth);
  const previewHeight = useBreakpointStore((state) => state.previewHeight);
  const zoom = useBreakpointStore((state) => state.zoomById[state.activeBreakpointId]);
  const setBreakpoint = useBreakpointStore((state) => state.setBreakpoint);
  const setZoom = useBreakpointStore((state) => state.setZoom);
  const stepZoom = useBreakpointStore((state) => state.stepZoom);
  const fitZoom = useBreakpointStore((state) => state.fitZoom);
  const syncBreakpointScopeFromCanvas = useNotebookStore((state) => state.syncBreakpointScopeFromCanvas);
  const notePanelOpen = useFloatingNotePanelStore((state) => state.isOpen);
  const openNotePanel = useFloatingNotePanelStore((state) => state.openPanel);
  const closeNotePanel = useFloatingNotePanelStore((state) => state.closePanel);
  const activeBreakpoint = breakpointById(activeBreakpointId);
  const activePreviewWidth = viewportMode === 'custom' ? customPreviewWidth : activeBreakpoint.width;
  const zoomPercent = Math.round(zoom * 100);
  const [zoomInputValue, setZoomInputValue] = useState(String(zoomPercent));
  const notePanelTitle = notePanelOpen
    ? messages.editor.notePanelCloseTitle
    : messages.editor.notePanelOpenTitle;

  useEffect(() => {
    setZoomInputValue(String(zoomPercent));
  }, [zoomPercent]);

  const handleBreakpointChange = (breakpointId: BreakpointId): void => {
    setBreakpoint(breakpointId);
    syncBreakpointScopeFromCanvas(breakpointId);

    if (onFitZoom) {
      onFitZoom({ fitDownOnly: true });
      return;
    }

    fitZoom(undefined, undefined, { fitDownOnly: true });
  };

  const commitZoomInput = (): void => {
    if (zoomInputValue.trim().length === 0) {
      setZoomInputValue(String(zoomPercent));
      return;
    }

    const parsedPercent = Number(zoomInputValue);
    if (!Number.isFinite(parsedPercent)) {
      setZoomInputValue(String(zoomPercent));
      return;
    }

    const nextZoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, parsedPercent / 100));
    setZoom(nextZoom);
    setZoomInputValue(String(Math.round(nextZoom * 100)));
  };

  const handleZoomInputChange = (event: ChangeEvent<HTMLInputElement>): void => {
    setZoomInputValue(event.currentTarget.value);
  };

  const handleZoomInputKeyDown = (event: KeyboardEvent<HTMLInputElement>): void => {
    if (event.key !== 'Enter') {
      return;
    }

    event.preventDefault();
    commitZoomInput();
    event.currentTarget.blur();
  };

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
              title={`${breakpointLabel} · ${breakpoint.width} × ${breakpoint.height}px`}
              aria-pressed={viewportMode === 'breakpoint' && breakpoint.id === activeBreakpointId}
            >
              {breakpointLabel}
            </ToolbarButton>
          );
        })}
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
        <label
          className="copy-ai-id-editor-zoom-input"
          data-ai-id="copy-ai-id-editor-zoom-input"
        >
          <input
            type="number"
            min={Math.round(MIN_ZOOM * 100)}
            max={Math.round(MAX_ZOOM * 100)}
            step={1}
            inputMode="numeric"
            value={zoomInputValue}
            aria-label={messages.editor.zoomInput}
            onChange={handleZoomInputChange}
            onBlur={commitZoomInput}
            onFocus={(event) => event.currentTarget.select()}
            onKeyDown={handleZoomInputKeyDown}
          />
          <span aria-hidden="true">%</span>
        </label>
        <ToolbarButton
          data-ai-id="copy-ai-id-editor-zoom-in-button"
          onClick={() => stepZoom(CANVAS_ZOOM_STEP)}
          disabled={zoom >= MAX_ZOOM}
          title={messages.editor.zoomIn}
          aria-label={messages.editor.zoomIn}
        >
          <Plus size={14} aria-hidden="true" />
        </ToolbarButton>
      </ToolbarSegment>

      <ToolbarSegment>
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
      </ToolbarSegment>
    </div>
  );
}
