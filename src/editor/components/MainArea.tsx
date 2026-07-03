import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
  type RefObject,
} from 'react';
import {
  MAX_NOTE_PANEL_WIDTH,
  MIN_NOTE_PANEL_WIDTH,
  normalizeNotePanelWidth,
  useEditorLayoutStore,
} from '../stores/useEditorLayoutStore';
import { syncVisualBridgeGeometry } from '../bridge/bridgeClient';
import { getCurrentMessages } from '../../shared/i18n';
import { useFloatingNotePanelStore } from '../stores/useFloatingNotePanelStore';
import { NotePanel } from './NotePanel';
import { PreviewWorkspace } from './PreviewWorkspace';

interface ActivePanelResize {
  startX: number;
  startPanelWidth: number;
}

export interface MainAreaProps {
  previewStageRef?: RefObject<HTMLDivElement | null>;
  onFitZoom?: () => void;
}

const PREVIEW_MIN_WIDTH = 360;
const PANEL_RESIZE_KEY_STEP = 16;

export function MainArea({ previewStageRef, onFitZoom }: MainAreaProps) {
  const messages = getCurrentMessages();
  const mainRef = useRef<HTMLElement | null>(null);
  const notePanelWidth = useEditorLayoutStore((state) => state.notePanelWidth);
  const notePanelFloatingEnabled = useFloatingNotePanelStore((state) => state.enabled);
  const hydratePanelLayout = useEditorLayoutStore((state) => state.hydratePanelLayout);
  const setNotePanelWidth = useEditorLayoutStore((state) => state.setNotePanelWidth);
  const persistPanelLayout = useEditorLayoutStore((state) => state.persistPanelLayout);
  const previousNotePanelFloatingRef = useRef(notePanelFloatingEnabled);
  const activePanelResizeRef = useRef<ActivePanelResize | null>(null);
  const fitZoomFrameRef = useRef<number | null>(null);
  const geometrySyncFrameRef = useRef<number | null>(null);
  const initialViewportFitFrameRef = useRef<number | null>(null);
  const [resizingPanel, setResizingPanel] = useState(false);
  const isDockedNotePanelVisible = !notePanelFloatingEnabled;

  useEffect(() => {
    let isActive = true;

    void hydratePanelLayout().then(() => {
      if (!isActive || !onFitZoom) {
        return;
      }

      initialViewportFitFrameRef.current = window.requestAnimationFrame(() => {
        initialViewportFitFrameRef.current = null;
        if (!isActive) {
          return;
        }

        onFitZoom();
      });
    });

    return () => {
      isActive = false;
      if (initialViewportFitFrameRef.current !== null) {
        window.cancelAnimationFrame(initialViewportFitFrameRef.current);
        initialViewportFitFrameRef.current = null;
      }
    };
  }, [hydratePanelLayout, onFitZoom]);

  const scheduleFitZoom = useCallback(() => {
    if (fitZoomFrameRef.current !== null) {
      window.cancelAnimationFrame(fitZoomFrameRef.current);
    }
    if (geometrySyncFrameRef.current !== null) {
      window.cancelAnimationFrame(geometrySyncFrameRef.current);
      geometrySyncFrameRef.current = null;
    }

    fitZoomFrameRef.current = window.requestAnimationFrame(() => {
      fitZoomFrameRef.current = null;
      onFitZoom?.();
      geometrySyncFrameRef.current = window.requestAnimationFrame(() => {
        geometrySyncFrameRef.current = null;
        syncVisualBridgeGeometry();
      });
    });
  }, [onFitZoom]);

  useLayoutEffect(() => {
    if (previousNotePanelFloatingRef.current === notePanelFloatingEnabled) {
      return;
    }

    previousNotePanelFloatingRef.current = notePanelFloatingEnabled;
    scheduleFitZoom();
  }, [notePanelFloatingEnabled, scheduleFitZoom]);

  useEffect(() => {
    return () => {
      if (fitZoomFrameRef.current !== null) {
        window.cancelAnimationFrame(fitZoomFrameRef.current);
      }
      if (geometrySyncFrameRef.current !== null) {
        window.cancelAnimationFrame(geometrySyncFrameRef.current);
      }
      if (initialViewportFitFrameRef.current !== null) {
        window.cancelAnimationFrame(initialViewportFitFrameRef.current);
      }
    };
  }, []);

  const resizePanel = useCallback((width: number): number => {
    const normalizedWidth = resizeNotePanelWidth(width, mainRef.current);
    setNotePanelWidth(normalizedWidth);
    scheduleFitZoom();
    return normalizedWidth;
  }, [scheduleFitZoom, setNotePanelWidth]);

  const finishActivePanelResize = useCallback((restoreStartWidth: boolean): void => {
    const activePanelResize = activePanelResizeRef.current;
    activePanelResizeRef.current = null;
    setResizingPanel(false);

    if (!activePanelResize) {
      return;
    }

    if (restoreStartWidth) {
      resizePanel(activePanelResize.startPanelWidth);
    }

    void persistPanelLayout({
      notePanelWidth: useEditorLayoutStore.getState().notePanelWidth,
    });
    scheduleFitZoom();
  }, [persistPanelLayout, resizePanel, scheduleFitZoom]);

  useEffect(() => {
    if (!notePanelFloatingEnabled) {
      return;
    }

    if (activePanelResizeRef.current) {
      finishActivePanelResize(false);
      return;
    }

    setResizingPanel(false);
  }, [finishActivePanelResize, notePanelFloatingEnabled]);

  useEffect(() => {
    if (!resizingPanel) {
      return undefined;
    }

    const handlePointerMove = (event: PointerEvent): void => {
      const activePanelResize = activePanelResizeRef.current;
      if (!activePanelResize) {
        return;
      }

      resizePanel(activePanelResize.startPanelWidth + (activePanelResize.startX - event.clientX));
    };

    const handlePointerUp = (): void => {
      finishActivePanelResize(false);
    };

    const handleKeyDown = (event: KeyboardEvent): void => {
      if (event.key !== 'Escape') {
        return;
      }

      event.preventDefault();
      event.stopPropagation();
      finishActivePanelResize(true);
    };

    window.addEventListener('pointermove', handlePointerMove, true);
    window.addEventListener('pointerup', handlePointerUp, true);
    window.addEventListener('pointercancel', handlePointerUp, true);
    window.addEventListener('keydown', handleKeyDown, true);

    return () => {
      window.removeEventListener('pointermove', handlePointerMove, true);
      window.removeEventListener('pointerup', handlePointerUp, true);
      window.removeEventListener('pointercancel', handlePointerUp, true);
      window.removeEventListener('keydown', handleKeyDown, true);
    };
  }, [finishActivePanelResize, resizePanel, resizingPanel]);

  const startPanelResize = useCallback((event: ReactPointerEvent<HTMLButtonElement>): void => {
    if (event.button !== 0) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    event.currentTarget.setPointerCapture(event.pointerId);

    activePanelResizeRef.current = {
      startX: event.clientX,
      startPanelWidth: useEditorLayoutStore.getState().notePanelWidth,
    };
    setResizingPanel(true);
  }, []);

  const resizePanelWithKeyboard = useCallback((event: ReactKeyboardEvent<HTMLButtonElement>): void => {
    if (!isPanelResizeKey(event.key)) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();

    const currentWidth = useEditorLayoutStore.getState().notePanelWidth;
    const nextWidth = panelResizeKeyboardWidth(currentWidth, event.key, mainRef.current);
    const normalizedWidth = resizePanel(nextWidth);

    void persistPanelLayout({ notePanelWidth: normalizedWidth });
  }, [persistPanelLayout, resizePanel]);

  const mainClassName = [
    'copy-ai-id-editor-main',
    notePanelFloatingEnabled ? 'copy-ai-id-editor-main--note-panel-floating' : '',
    resizingPanel ? 'copy-ai-id-editor-main--panel-resizing' : '',
  ].filter(Boolean).join(' ');
  const mainStyle: CSSProperties = {
    gridTemplateColumns: isDockedNotePanelVisible
      ? `minmax(0, 1fr) ${notePanelWidth}px`
      : 'minmax(0, 1fr)',
  };

  return (
    <main
      ref={mainRef}
      className={mainClassName}
      style={mainStyle}
      data-ai-id="copy-ai-id-editor-main"
      data-ai-editor-note-panel-floating={notePanelFloatingEnabled ? 'true' : 'false'}
      data-ai-editor-note-panel-width={notePanelWidth}
      data-ai-editor-panel-resize={resizingPanel ? 'true' : 'false'}
    >
      <PreviewWorkspace stageRef={previewStageRef} />
      {isDockedNotePanelVisible ? <NotePanel /> : null}
      {isDockedNotePanelVisible ? (
        <PanelResizeHandle
          active={resizingPanel}
          label={messages.editor.resizeNotePanel}
          value={notePanelWidth}
          min={MIN_NOTE_PANEL_WIDTH}
          max={getAvailableNotePanelMaxWidth(mainRef.current)}
          onPointerDown={startPanelResize}
          onKeyDown={resizePanelWithKeyboard}
        />
      ) : null}
      {resizingPanel ? (
        <div
          className="copy-ai-id-editor-panel-resize-overlay"
          data-ai-id="copy-ai-id-editor-panel-resize-overlay"
          aria-hidden="true"
        />
      ) : null}
    </main>
  );
}

function PanelResizeHandle({
  active,
  label,
  max,
  min,
  onKeyDown,
  onPointerDown,
  value,
}: {
  active: boolean;
  label: string;
  max: number;
  min: number;
  onKeyDown: (event: ReactKeyboardEvent<HTMLButtonElement>) => void;
  onPointerDown: (event: ReactPointerEvent<HTMLButtonElement>) => void;
  value: number;
}) {
  return (
    <div
      className="copy-ai-id-editor-panel-resize-boundary copy-ai-id-editor-panel-resize-boundary--note"
      data-ai-id="copy-ai-id-editor-note-panel-resize-boundary"
      data-ai-editor-panel-side="note"
      data-ai-editor-panel-resize-active={active ? 'true' : 'false'}
      style={{ right: `${value}px` }}
    >
      <button
        type="button"
        role="separator"
        className={`copy-ai-id-editor-panel-resize-handle${active ? ' is-active' : ''}`}
        data-ai-id="copy-ai-id-editor-note-panel-width-resize-handle"
        aria-label={label}
        aria-orientation="vertical"
        aria-valuemin={min}
        aria-valuemax={max}
        aria-valuenow={value}
        title={label}
        onKeyDown={onKeyDown}
        onPointerDown={onPointerDown}
      >
        <span
          className="copy-ai-id-editor-panel-resize-handle__track"
          data-ai-id="copy-ai-id-editor-note-panel-width-resize-track"
          aria-hidden="true"
        />
        <span
          className="copy-ai-id-editor-panel-resize-handle__grip"
          data-ai-id="copy-ai-id-editor-note-panel-width-resize-grip"
          aria-hidden="true"
        >
          <span />
          <span />
        </span>
      </button>
    </div>
  );
}

function resizeNotePanelWidth(width: number, main: HTMLElement | null): number {
  const maxWidth = getAvailableNotePanelMaxWidth(main);
  return Math.min(maxWidth, Math.max(MIN_NOTE_PANEL_WIDTH, normalizeNotePanelWidth(width)));
}

function getAvailableNotePanelMaxWidth(main: HTMLElement | null): number {
  const availableMaxWidth = getAvailableMainAreaWidth(main) - PREVIEW_MIN_WIDTH;
  return Math.max(MIN_NOTE_PANEL_WIDTH, Math.min(MAX_NOTE_PANEL_WIDTH, availableMaxWidth));
}

function getAvailableMainAreaWidth(main: HTMLElement | null): number {
  if (main?.clientWidth) {
    return main.clientWidth;
  }

  return typeof window === 'undefined' ? 0 : window.innerWidth;
}

function isPanelResizeKey(key: string): boolean {
  return key === 'ArrowLeft' || key === 'ArrowRight' || key === 'Home' || key === 'End';
}

function panelResizeKeyboardWidth(width: number, key: string, main: HTMLElement | null): number {
  if (key === 'Home') {
    return MIN_NOTE_PANEL_WIDTH;
  }

  if (key === 'End') {
    return getAvailableNotePanelMaxWidth(main);
  }

  return key === 'ArrowLeft'
    ? width + PANEL_RESIZE_KEY_STEP
    : width - PANEL_RESIZE_KEY_STEP;
}
