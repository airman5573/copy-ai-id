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
  MAX_LAYOUT_TREE_PANEL_WIDTH,
  MAX_NOTE_PANEL_WIDTH,
  MIN_LAYOUT_TREE_PANEL_WIDTH,
  MIN_NOTE_PANEL_WIDTH,
  normalizeLayoutTreePanelWidth,
  normalizeNotePanelWidth,
  useEditorLayoutStore,
} from '../stores/useEditorLayoutStore';
import { syncVisualBridgeGeometry } from '../bridge/bridgeClient';
import { getCurrentMessages } from '../../shared/i18n';
import { useFloatingNotePanelStore } from '../stores/useFloatingNotePanelStore';
import { NotePanel } from './NotePanel';
import { PreviewWorkspace } from './PreviewWorkspace';
import { LayoutTreePanel, LayoutTreePanelRail } from './tree/LayoutTreePanel';

type ResizablePanelSide = 'layout-tree' | 'note';

interface ActivePanelResize {
  side: ResizablePanelSide;
  startX: number;
  startPanelWidth: number;
}

interface PanelMaxWidthOptions {
  notePanelVisible: boolean;
}

export interface MainAreaProps {
  previewStageRef?: RefObject<HTMLDivElement | null>;
  onFitZoom?: () => void;
}

const LAYOUT_TREE_RAIL_WIDTH = 42;
const PREVIEW_MIN_WIDTH = 360;
const PANEL_RESIZE_KEY_STEP = 16;

export function MainArea({ previewStageRef, onFitZoom }: MainAreaProps) {
  const messages = getCurrentMessages();
  const mainRef = useRef<HTMLElement | null>(null);
  const layoutTreeCollapsed = useEditorLayoutStore((state) => state.layoutTreeCollapsed);
  const layoutTreePanelWidth = useEditorLayoutStore((state) => state.layoutTreePanelWidth);
  const notePanelWidth = useEditorLayoutStore((state) => state.notePanelWidth);
  const notePanelFloatingEnabled = useFloatingNotePanelStore((state) => state.enabled);
  const hydrateLayoutTreeCollapsed = useEditorLayoutStore((state) => state.hydrateLayoutTreeCollapsed);
  const hydratePanelLayout = useEditorLayoutStore((state) => state.hydratePanelLayout);
  const setLayoutTreeCollapsed = useEditorLayoutStore((state) => state.setLayoutTreeCollapsed);
  const setLayoutTreePanelWidth = useEditorLayoutStore((state) => state.setLayoutTreePanelWidth);
  const setNotePanelWidth = useEditorLayoutStore((state) => state.setNotePanelWidth);
  const persistPanelLayout = useEditorLayoutStore((state) => state.persistPanelLayout);
  const previousResponsiveLayoutRef = useRef({ layoutTreeCollapsed, notePanelFloatingEnabled });
  const activePanelResizeRef = useRef<ActivePanelResize | null>(null);
  const fitZoomFrameRef = useRef<number | null>(null);
  const geometrySyncFrameRef = useRef<number | null>(null);
  const [resizingPanel, setResizingPanel] = useState<ResizablePanelSide | null>(null);
  const isDockedNotePanelVisible = !notePanelFloatingEnabled;

  useEffect(() => {
    void hydrateLayoutTreeCollapsed();
    void hydratePanelLayout();
  }, [hydrateLayoutTreeCollapsed, hydratePanelLayout]);

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
    const previousResponsiveLayout = previousResponsiveLayoutRef.current;
    if (
      previousResponsiveLayout.layoutTreeCollapsed === layoutTreeCollapsed
      && previousResponsiveLayout.notePanelFloatingEnabled === notePanelFloatingEnabled
    ) {
      return;
    }

    previousResponsiveLayoutRef.current = { layoutTreeCollapsed, notePanelFloatingEnabled };
    scheduleFitZoom();
  }, [layoutTreeCollapsed, notePanelFloatingEnabled, scheduleFitZoom]);

  useEffect(() => {
    return () => {
      if (fitZoomFrameRef.current !== null) {
        window.cancelAnimationFrame(fitZoomFrameRef.current);
      }
      if (geometrySyncFrameRef.current !== null) {
        window.cancelAnimationFrame(geometrySyncFrameRef.current);
      }
    };
  }, []);

  const resizePanel = useCallback((side: ResizablePanelSide, width: number): number => {
    const normalizedWidth = resizePanelWidth(side, width, mainRef.current, {
      notePanelVisible: isDockedNotePanelVisible,
    });

    if (side === 'layout-tree') {
      setLayoutTreePanelWidth(normalizedWidth);
    } else {
      setNotePanelWidth(normalizedWidth);
    }

    scheduleFitZoom();
    return normalizedWidth;
  }, [isDockedNotePanelVisible, scheduleFitZoom, setLayoutTreePanelWidth, setNotePanelWidth]);

  const finishActivePanelResize = useCallback((restoreStartWidth: boolean): void => {
    const activePanelResize = activePanelResizeRef.current;
    activePanelResizeRef.current = null;
    setResizingPanel(null);

    if (!activePanelResize) {
      return;
    }

    if (restoreStartWidth) {
      resizePanel(activePanelResize.side, activePanelResize.startPanelWidth);
    }

    const state = useEditorLayoutStore.getState();
    void persistPanelLayout({
      layoutTreePanelWidth: state.layoutTreePanelWidth,
      notePanelWidth: state.notePanelWidth,
    });
    scheduleFitZoom();
  }, [persistPanelLayout, resizePanel, scheduleFitZoom]);

  useEffect(() => {
    if (!notePanelFloatingEnabled) {
      return;
    }

    if (activePanelResizeRef.current?.side === 'note') {
      finishActivePanelResize(false);
      return;
    }

    setResizingPanel((currentPanel) => currentPanel === 'note' ? null : currentPanel);
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

      const nextWidth = activePanelResize.side === 'layout-tree'
        ? activePanelResize.startPanelWidth + (event.clientX - activePanelResize.startX)
        : activePanelResize.startPanelWidth + (activePanelResize.startX - event.clientX);

      resizePanel(activePanelResize.side, nextWidth);
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

  const startPanelResize = useCallback((
    side: ResizablePanelSide,
    event: ReactPointerEvent<HTMLButtonElement>,
  ): void => {
    if (event.button !== 0) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    event.currentTarget.setPointerCapture(event.pointerId);

    const state = useEditorLayoutStore.getState();
    activePanelResizeRef.current = {
      side,
      startX: event.clientX,
      startPanelWidth: side === 'layout-tree'
        ? state.layoutTreePanelWidth
        : state.notePanelWidth,
    };
    setResizingPanel(side);
  }, []);

  const resizePanelWithKeyboard = useCallback((
    side: ResizablePanelSide,
    event: ReactKeyboardEvent<HTMLButtonElement>,
  ): void => {
    if (!isPanelResizeKey(event.key)) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();

    const currentWidth = side === 'layout-tree'
      ? useEditorLayoutStore.getState().layoutTreePanelWidth
      : useEditorLayoutStore.getState().notePanelWidth;
    const nextWidth = panelResizeKeyboardWidth(side, currentWidth, event.key, mainRef.current, {
      notePanelVisible: isDockedNotePanelVisible,
    });
    const normalizedWidth = resizePanel(side, nextWidth);

    void persistPanelLayout(side === 'layout-tree'
      ? { layoutTreePanelWidth: normalizedWidth }
      : { notePanelWidth: normalizedWidth });
  }, [isDockedNotePanelVisible, persistPanelLayout, resizePanel]);

  const leftColumnWidth = layoutTreeCollapsed ? LAYOUT_TREE_RAIL_WIDTH : layoutTreePanelWidth;
  const mainClassName = [
    'copy-ai-id-editor-main',
    layoutTreeCollapsed ? 'copy-ai-id-editor-main--tree-hidden' : '',
    notePanelFloatingEnabled ? 'copy-ai-id-editor-main--note-panel-floating' : '',
    resizingPanel ? 'copy-ai-id-editor-main--panel-resizing' : '',
  ].filter(Boolean).join(' ');
  const mainStyle: CSSProperties = {
    gridTemplateColumns: isDockedNotePanelVisible
      ? `${leftColumnWidth}px minmax(0, 1fr) ${notePanelWidth}px`
      : `${leftColumnWidth}px minmax(0, 1fr)`,
  };

  return (
    <main
      ref={mainRef}
      className={mainClassName}
      style={mainStyle}
      data-ai-id="copy-ai-id-editor-main"
      data-ai-editor-layout-tree-collapsed={layoutTreeCollapsed ? 'true' : 'false'}
      data-ai-editor-layout-tree-width={layoutTreePanelWidth}
      data-ai-editor-note-panel-floating={notePanelFloatingEnabled ? 'true' : 'false'}
      data-ai-editor-note-panel-width={notePanelWidth}
      data-ai-editor-panel-resize={resizingPanel ? 'true' : 'false'}
    >
      {layoutTreeCollapsed ? (
        <LayoutTreePanelRail onExpand={() => setLayoutTreeCollapsed(false)} />
      ) : (
        <LayoutTreePanel onCollapse={() => setLayoutTreeCollapsed(true)} />
      )}

      <PreviewWorkspace stageRef={previewStageRef} />
      {isDockedNotePanelVisible ? <NotePanel /> : null}
      {!layoutTreeCollapsed ? (
        <PanelResizeHandle
          side="layout-tree"
          active={resizingPanel === 'layout-tree'}
          label={messages.editor.resizeLayoutTreePanel}
          value={layoutTreePanelWidth}
          min={MIN_LAYOUT_TREE_PANEL_WIDTH}
          max={getAvailablePanelMaxWidth('layout-tree', mainRef.current, {
            notePanelVisible: isDockedNotePanelVisible,
          })}
          onPointerDown={(event) => startPanelResize('layout-tree', event)}
          onKeyDown={(event) => resizePanelWithKeyboard('layout-tree', event)}
        />
      ) : null}
      {isDockedNotePanelVisible ? (
        <PanelResizeHandle
          side="note"
          active={resizingPanel === 'note'}
          label={messages.editor.resizeNotePanel}
          value={notePanelWidth}
          min={MIN_NOTE_PANEL_WIDTH}
          max={getAvailablePanelMaxWidth('note', mainRef.current, {
            notePanelVisible: isDockedNotePanelVisible,
          })}
          onPointerDown={(event) => startPanelResize('note', event)}
          onKeyDown={(event) => resizePanelWithKeyboard('note', event)}
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
  side,
  value,
}: {
  active: boolean;
  label: string;
  max: number;
  min: number;
  onKeyDown: (event: ReactKeyboardEvent<HTMLButtonElement>) => void;
  onPointerDown: (event: ReactPointerEvent<HTMLButtonElement>) => void;
  side: ResizablePanelSide;
  value: number;
}) {
  const boundaryStyle = side === 'layout-tree'
    ? { left: `${value}px` }
    : { right: `${value}px` };

  return (
    <div
      className={`copy-ai-id-editor-panel-resize-boundary copy-ai-id-editor-panel-resize-boundary--${side}`}
      data-ai-id={`copy-ai-id-editor-${side}-panel-resize-boundary`}
      data-ai-editor-panel-side={side}
      data-ai-editor-panel-resize-active={active ? 'true' : 'false'}
      style={boundaryStyle}
    >
      <button
        type="button"
        role="separator"
        className={`copy-ai-id-editor-panel-resize-handle${active ? ' is-active' : ''}`}
        data-ai-id={`copy-ai-id-editor-${side}-panel-width-resize-handle`}
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
          data-ai-id={`copy-ai-id-editor-${side}-panel-width-resize-track`}
          aria-hidden="true"
        />
        <span
          className="copy-ai-id-editor-panel-resize-handle__grip"
          data-ai-id={`copy-ai-id-editor-${side}-panel-width-resize-grip`}
          aria-hidden="true"
        >
          <span />
          <span />
        </span>
      </button>
    </div>
  );
}

function resizePanelWidth(
  side: ResizablePanelSide,
  width: number,
  main: HTMLElement | null,
  options: PanelMaxWidthOptions,
): number {
  const minWidth = side === 'layout-tree' ? MIN_LAYOUT_TREE_PANEL_WIDTH : MIN_NOTE_PANEL_WIDTH;
  const maxWidth = getAvailablePanelMaxWidth(side, main, options);
  const normalizedWidth = side === 'layout-tree'
    ? normalizeLayoutTreePanelWidth(width)
    : normalizeNotePanelWidth(width);

  return Math.min(maxWidth, Math.max(minWidth, normalizedWidth));
}

function getAvailablePanelMaxWidth(
  side: ResizablePanelSide,
  main: HTMLElement | null,
  options: PanelMaxWidthOptions,
): number {
  const minWidth = side === 'layout-tree' ? MIN_LAYOUT_TREE_PANEL_WIDTH : MIN_NOTE_PANEL_WIDTH;
  const staticMaxWidth = side === 'layout-tree' ? MAX_LAYOUT_TREE_PANEL_WIDTH : MAX_NOTE_PANEL_WIDTH;
  const state = useEditorLayoutStore.getState();
  const oppositePanelWidth = side === 'layout-tree'
    ? (options.notePanelVisible ? state.notePanelWidth : 0)
    : state.layoutTreeCollapsed
      ? LAYOUT_TREE_RAIL_WIDTH
      : state.layoutTreePanelWidth;
  const availableWidth = getAvailableMainAreaWidth(main);
  const availableMaxWidth = availableWidth - PREVIEW_MIN_WIDTH - oppositePanelWidth;

  return Math.max(minWidth, Math.min(staticMaxWidth, availableMaxWidth));
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

function panelResizeKeyboardWidth(
  side: ResizablePanelSide,
  width: number,
  key: string,
  main: HTMLElement | null,
  options: PanelMaxWidthOptions,
): number {
  if (key === 'Home') {
    return side === 'layout-tree' ? MIN_LAYOUT_TREE_PANEL_WIDTH : MIN_NOTE_PANEL_WIDTH;
  }

  if (key === 'End') {
    return getAvailablePanelMaxWidth(side, main, options);
  }

  if (side === 'layout-tree') {
    return key === 'ArrowRight'
      ? width + PANEL_RESIZE_KEY_STEP
      : width - PANEL_RESIZE_KEY_STEP;
  }

  return key === 'ArrowLeft'
    ? width + PANEL_RESIZE_KEY_STEP
    : width - PANEL_RESIZE_KEY_STEP;
}
