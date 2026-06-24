import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
  type RefObject,
} from 'react';

import { breakpointById } from '../../shared/breakpoints';
import { getCurrentMessages } from '../../shared/i18n';
import {
  createPreviewUrl,
  installBridgeClient,
  postCurrentCanvasZoomToBridge,
  registerPreviewFrame,
  syncVisualBridgeGeometry,
} from '../bridge/bridgeClient';
import { registerPreviewWorkspaceGeometry } from '../bridge/geometry';
import {
  getActiveCanvasZoom,
  MAX_PREVIEW_HEIGHT,
  MAX_PREVIEW_WIDTH,
  MIN_PREVIEW_HEIGHT,
  MIN_PREVIEW_WIDTH,
  PREVIEW_HEIGHT_RESIZE_HANDLE_OUTSET,
  PREVIEW_WIDTH_RESIZE_HANDLE_OUTSET,
  useBreakpointStore,
} from '../stores/useBreakpointStore';
import { useBridgeStore } from '../stores/useBridgeStore';
import { useRuntimeStore } from '../stores/useRuntimeStore';

const BRIDGE_READY_TIMEOUT_MS = 6000;
const PREVIEW_HEIGHT_KEYBOARD_STEP = 20;
const PREVIEW_HEIGHT_KEYBOARD_LARGE_STEP = 100;
const PREVIEW_WIDTH_KEYBOARD_STEP = 20;
const PREVIEW_WIDTH_KEYBOARD_LARGE_STEP = 100;

interface PreviewHeightResizeState {
  startHeight: number;
  startY: number;
  zoom: number;
}

interface PreviewWidthResizeState {
  startWidth: number;
  startX: number;
  zoom: number;
}

function isPreviewWidthOverflowingStage(previewWidth: number, stage: HTMLDivElement): boolean {
  if (stage.clientWidth <= 0) {
    return false;
  }

  const state = useBreakpointStore.getState();
  const safeZoom = getActiveCanvasZoom(state);
  const visualWidth = (previewWidth + (PREVIEW_WIDTH_RESIZE_HANDLE_OUTSET * 2)) * safeZoom;

  return visualWidth > stage.clientWidth;
}

export interface PreviewWorkspaceProps {
  stageRef?: RefObject<HTMLDivElement | null>;
}

export function PreviewWorkspace({ stageRef }: PreviewWorkspaceProps) {
  const messages = getCurrentMessages();
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const stageElementRef = useRef<HTMLDivElement | null>(null);
  const canvasFrameRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLDivElement | null>(null);
  const currentUrl = useRuntimeStore((state) => state.currentUrl);
  const previewUrl = useMemo(() => createPreviewUrl(currentUrl || window.location.href), [currentUrl]);
  const activeBreakpointId = useBreakpointStore((state) => state.activeBreakpointId);
  const viewportMode = useBreakpointStore((state) => state.viewportMode);
  const customPreviewWidth = useBreakpointStore((state) => state.customPreviewWidth);
  const previewHeight = useBreakpointStore((state) => state.previewHeight);
  const zoom = useBreakpointStore((state) => state.zoomById[state.activeBreakpointId]);
  const setCustomPreviewWidth = useBreakpointStore((state) => state.setCustomPreviewWidth);
  const persistCustomPreviewWidth = useBreakpointStore((state) => state.persistCustomPreviewWidth);
  const setPreviewHeight = useBreakpointStore((state) => state.setPreviewHeight);
  const persistPreviewHeight = useBreakpointStore((state) => state.persistPreviewHeight);
  const fitZoom = useBreakpointStore((state) => state.fitZoom);
  const bridgeStatus = useBridgeStore((state) => state.status);
  const iframeStatus = useBridgeStore((state) => state.iframeStatus);
  const iframeError = useBridgeStore((state) => state.iframeError);
  const setLoading = useBridgeStore((state) => state.setLoading);
  const setIframeStatus = useBridgeStore((state) => state.setIframeStatus);
  const setPreviewUrl = useRuntimeStore((state) => state.setPreviewUrl);
  const breakpoint = breakpointById(activeBreakpointId);
  const previewWidth = viewportMode === 'custom' ? customPreviewWidth : breakpoint.width;
  const resizeStateRef = useRef<PreviewHeightResizeState | null>(null);
  const widthResizeStateRef = useRef<PreviewWidthResizeState | null>(null);
  const [isResizingPreviewHeight, setIsResizingPreviewHeight] = useState(false);
  const [isResizingPreviewWidth, setIsResizingPreviewWidth] = useState(false);

  const syncPreviewGeometryRefs = useCallback((): void => {
    registerPreviewWorkspaceGeometry({
      stageElement: stageElementRef.current,
      canvasFrameElement: canvasFrameRef.current,
      canvasElement: canvasRef.current,
    });
  }, []);

  const handleStageRef = useCallback((node: HTMLDivElement | null): void => {
    stageElementRef.current = node;
    if (stageRef) {
      (stageRef as { current: HTMLDivElement | null }).current = node;
    }
    syncPreviewGeometryRefs();
  }, [stageRef, syncPreviewGeometryRefs]);

  const handleCanvasFrameRef = useCallback((node: HTMLDivElement | null): void => {
    canvasFrameRef.current = node;
    syncPreviewGeometryRefs();
  }, [syncPreviewGeometryRefs]);

  const handleCanvasRef = useCallback((node: HTMLDivElement | null): void => {
    canvasRef.current = node;
    syncPreviewGeometryRefs();
  }, [syncPreviewGeometryRefs]);

  useEffect(() => installBridgeClient(), []);

  useEffect(() => {
    setPreviewUrl(previewUrl);
    setLoading(previewUrl);
    registerPreviewFrame(iframeRef.current);

    const timeoutId = window.setTimeout(() => {
      const status = useBridgeStore.getState().status;
      if (status !== 'ready') {
        setIframeStatus('blocked');
      }
    }, BRIDGE_READY_TIMEOUT_MS);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [messages.editor.iframeBlocked, previewUrl, setIframeStatus, setLoading, setPreviewUrl]);

  useEffect(() => () => {
    registerPreviewFrame(null);
    registerPreviewWorkspaceGeometry({
      stageElement: null,
      canvasFrameElement: null,
      canvasElement: null,
    });
  }, []);

  useEffect(() => {
    syncPreviewGeometryRefs();

    const rafId = window.requestAnimationFrame(() => {
      syncVisualBridgeGeometry();

      if (bridgeStatus === 'ready') {
        postCurrentCanvasZoomToBridge();
      }
    });

    return () => window.cancelAnimationFrame(rafId);
  }, [activeBreakpointId, bridgeStatus, previewHeight, previewWidth, syncPreviewGeometryRefs, zoom]);

  useEffect(() => {
    if (!isResizingPreviewHeight) {
      return undefined;
    }

    const handlePointerMove = (event: PointerEvent): void => {
      const resizeState = resizeStateRef.current;
      if (!resizeState) {
        return;
      }

      const safeZoom = resizeState.zoom > 0 ? resizeState.zoom : 1;
      const deltaY = (event.clientY - resizeState.startY) / safeZoom;
      setPreviewHeight(resizeState.startHeight + deltaY);
    };

    const finishResize = (): void => {
      if (!resizeStateRef.current) {
        return;
      }

      resizeStateRef.current = null;
      setIsResizingPreviewHeight(false);
      void persistPreviewHeight();
    };

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', finishResize);
    window.addEventListener('pointercancel', finishResize);

    return () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', finishResize);
      window.removeEventListener('pointercancel', finishResize);
    };
  }, [isResizingPreviewHeight, persistPreviewHeight, setPreviewHeight]);

  useEffect(() => {
    if (!isResizingPreviewWidth) {
      return undefined;
    }

    const handlePointerMove = (event: PointerEvent): void => {
      const resizeState = widthResizeStateRef.current;
      if (!resizeState) {
        return;
      }

      const safeZoom = resizeState.zoom > 0 ? resizeState.zoom : 1;
      const deltaX = (event.clientX - resizeState.startX) / safeZoom;
      const nextPreviewWidth = resizeState.startWidth + (deltaX * 2);

      setCustomPreviewWidth(nextPreviewWidth);

      const stage = stageElementRef.current;
      if (deltaX > 0 && stage && isPreviewWidthOverflowingStage(nextPreviewWidth, stage)) {
        fitZoom(stage.clientWidth, stage.clientHeight);
      }
    };

    const finishResize = (): void => {
      if (!widthResizeStateRef.current) {
        return;
      }

      widthResizeStateRef.current = null;
      setIsResizingPreviewWidth(false);
      void persistCustomPreviewWidth();
    };

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', finishResize);
    window.addEventListener('pointercancel', finishResize);

    return () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', finishResize);
      window.removeEventListener('pointercancel', finishResize);
    };
  }, [fitZoom, isResizingPreviewWidth, persistCustomPreviewWidth, setCustomPreviewWidth]);

  const handleResizePointerDown = (event: ReactPointerEvent<HTMLButtonElement>): void => {
    if (event.button !== 0) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();

    resizeStateRef.current = {
      startHeight: previewHeight,
      startY: event.clientY,
      zoom,
    };
    setIsResizingPreviewHeight(true);
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const handleWidthResizePointerDown = (event: ReactPointerEvent<HTMLButtonElement>): void => {
    if (event.button !== 0) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();

    widthResizeStateRef.current = {
      startWidth: previewWidth,
      startX: event.clientX,
      zoom,
    };
    setCustomPreviewWidth(previewWidth);
    setIsResizingPreviewWidth(true);
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const commitPreviewHeight = (height: number): void => {
    setPreviewHeight(height);
    void persistPreviewHeight(height);
  };

  const commitPreviewWidth = (width: number): void => {
    setCustomPreviewWidth(width);
    void persistCustomPreviewWidth(width);
  };

  const handleResizeKeyDown = (event: ReactKeyboardEvent<HTMLButtonElement>): void => {
    const step = event.shiftKey ? PREVIEW_HEIGHT_KEYBOARD_LARGE_STEP : PREVIEW_HEIGHT_KEYBOARD_STEP;

    if (event.key === 'ArrowUp') {
      event.preventDefault();
      commitPreviewHeight(previewHeight - step);
      return;
    }

    if (event.key === 'ArrowDown') {
      event.preventDefault();
      commitPreviewHeight(previewHeight + step);
      return;
    }

    if (event.key === 'Home') {
      event.preventDefault();
      commitPreviewHeight(MIN_PREVIEW_HEIGHT);
      return;
    }

    if (event.key === 'End') {
      event.preventDefault();
      commitPreviewHeight(MAX_PREVIEW_HEIGHT);
    }
  };

  const handleWidthResizeKeyDown = (event: ReactKeyboardEvent<HTMLButtonElement>): void => {
    const step = event.shiftKey ? PREVIEW_WIDTH_KEYBOARD_LARGE_STEP : PREVIEW_WIDTH_KEYBOARD_STEP;

    if (event.key === 'ArrowLeft') {
      event.preventDefault();
      commitPreviewWidth(previewWidth - step);
      return;
    }

    if (event.key === 'ArrowRight') {
      event.preventDefault();
      commitPreviewWidth(previewWidth + step);
      return;
    }

    if (event.key === 'Home') {
      event.preventDefault();
      commitPreviewWidth(MIN_PREVIEW_WIDTH);
      return;
    }

    if (event.key === 'End') {
      event.preventDefault();
      commitPreviewWidth(MAX_PREVIEW_WIDTH);
    }
  };

  const canvasStyle = {
    left: `${PREVIEW_WIDTH_RESIZE_HANDLE_OUTSET * zoom}px`,
    width: `${previewWidth}px`,
    height: `${previewHeight}px`,
    minWidth: `${previewWidth}px`,
    minHeight: `${previewHeight}px`,
    transform: `scale(${zoom})`,
  };

  const canvasFrameStyle = {
    width: `${(previewWidth + (PREVIEW_WIDTH_RESIZE_HANDLE_OUTSET * 2)) * zoom}px`,
    height: `${(previewHeight + PREVIEW_HEIGHT_RESIZE_HANDLE_OUTSET) * zoom}px`,
  };

  const canvasClassName = [
    'copy-ai-id-editor-preview-canvas',
    isResizingPreviewHeight || isResizingPreviewWidth ? 'copy-ai-id-editor-preview-canvas--resizing' : '',
    isResizingPreviewHeight ? 'copy-ai-id-editor-preview-canvas--resizing-height' : '',
    isResizingPreviewWidth ? 'copy-ai-id-editor-preview-canvas--resizing-width' : '',
  ].filter(Boolean).join(' ');

  return (
    <section className="copy-ai-id-editor-preview" data-ai-id="copy-ai-id-editor-preview-panel">
      <div ref={handleStageRef} className="copy-ai-id-editor-preview-stage" data-ai-id="copy-ai-id-editor-preview-stage">
        <div
          ref={handleCanvasFrameRef}
          className="copy-ai-id-editor-preview-canvas-frame"
          style={canvasFrameStyle}
          data-ai-id="copy-ai-id-editor-preview-canvas-frame"
        >
          <div
            ref={handleCanvasRef}
            className={canvasClassName}
            style={canvasStyle}
            data-ai-id="copy-ai-id-editor-preview-canvas"
          >
            <iframe
              ref={(node) => {
                iframeRef.current = node;
                registerPreviewFrame(node);
              }}
              className="copy-ai-id-editor-preview-iframe"
              data-ai-id="copy-ai-id-editor-preview-iframe"
              title={messages.editor.preview}
              src={previewUrl}
              onLoad={() => {
                if (useBridgeStore.getState().status !== 'ready') {
                  setIframeStatus('loading');
                }
              }}
            />
            <button
              type="button"
              className="copy-ai-id-editor-preview-resize-handle copy-ai-id-editor-preview-resize-handle--height"
              data-ai-id="copy-ai-id-editor-preview-height-resize-handle"
              title={`${previewWidth} × ${previewHeight}px`}
              aria-label={messages.editor.resizePreviewHeight}
              aria-orientation="vertical"
              role="slider"
              aria-valuemin={MIN_PREVIEW_HEIGHT}
              aria-valuemax={MAX_PREVIEW_HEIGHT}
              aria-valuenow={previewHeight}
              aria-valuetext={`${previewHeight}px`}
              onPointerDown={handleResizePointerDown}
              onKeyDown={handleResizeKeyDown}
            >
              <span aria-hidden="true" />
            </button>
            <button
              type="button"
              className="copy-ai-id-editor-preview-resize-handle copy-ai-id-editor-preview-resize-handle--width"
              data-ai-id="copy-ai-id-editor-preview-width-resize-handle"
              title={`${previewWidth} × ${previewHeight}px`}
              aria-label={messages.editor.resizePreviewWidth}
              aria-orientation="horizontal"
              role="slider"
              aria-valuemin={MIN_PREVIEW_WIDTH}
              aria-valuemax={MAX_PREVIEW_WIDTH}
              aria-valuenow={previewWidth}
              aria-valuetext={`${previewWidth}px`}
              onPointerDown={handleWidthResizePointerDown}
              onKeyDown={handleWidthResizeKeyDown}
            >
              <span aria-hidden="true" />
            </button>
          </div>
        </div>
      </div>
      {bridgeStatus !== 'ready' ? (
        <div className="copy-ai-id-editor-preview-status" data-ai-id="copy-ai-id-editor-preview-status">
          <strong>{iframeStatus === 'blocked' ? messages.editor.iframeBlocked : messages.editor.iframeLoading}</strong>
          {iframeError ? <span>{iframeError}</span> : null}
        </div>
      ) : null}
    </section>
  );
}
