import {
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type Dispatch,
  type KeyboardEvent as ReactKeyboardEvent,
  type SetStateAction,
} from 'react';

import {
  bridgeViewportRectToEditorViewportRect,
  calculateFloatingOverlayPlacement,
  createEditorViewportRect,
  getPreviewWorkspaceGeometrySnapshot,
  type EditorViewportRect,
  type OverlayPlacement,
  type OverlaySize,
} from '../bridge/geometry';
import {
  MAX_NOTE_PANEL_WIDTH,
  MIN_NOTE_PANEL_WIDTH,
  useEditorLayoutStore,
} from '../stores/useEditorLayoutStore';
import {
  useFloatingNotePanelStore,
  type FloatingNotePanelAnchor,
} from '../stores/useFloatingNotePanelStore';
import { NotePanel } from './NotePanel';

const DEFAULT_FLOATING_NOTE_PANEL_HEIGHT_PX = 520;
const MIN_FLOATING_NOTE_PANEL_HEIGHT_PX = 260;
const MAX_FLOATING_NOTE_PANEL_HEIGHT_PX = 680;
const FLOATING_NOTE_PANEL_GAP_PX = 10;
const FLOATING_NOTE_PANEL_MARGIN_PX = 12;

const DEFAULT_PANEL_SIZE: OverlaySize = {
  width: MIN_NOTE_PANEL_WIDTH,
  height: DEFAULT_FLOATING_NOTE_PANEL_HEIGHT_PX,
};

interface FloatingNotePanelPlacement {
  left: number;
  top: number;
  width: number;
  height: number;
  maxHeight: number;
  side: OverlayPlacement['side'];
  transformOrigin: string;
}

export function FloatingNotePanel() {
  const enabled = useFloatingNotePanelStore((state) => state.enabled);
  const isOpen = useFloatingNotePanelStore((state) => state.isOpen);
  const anchor = useFloatingNotePanelStore((state) => state.anchor);
  const closePanel = useFloatingNotePanelStore((state) => state.closePanel);
  const notePanelWidth = useEditorLayoutStore((state) => state.notePanelWidth);
  const panelRef = useRef<HTMLDivElement | null>(null);
  const [panelSize, setPanelSize] = useState<OverlaySize>(DEFAULT_PANEL_SIZE);
  const [layoutRevision, setLayoutRevision] = useState(0);

  useLayoutEffect(() => {
    if (!enabled) {
      return;
    }

    measurePanel(panelRef.current, setPanelSize);
  }, [enabled, isOpen, notePanelWidth]);

  useEffect(() => {
    if (!enabled) {
      return undefined;
    }

    const node = panelRef.current;
    if (!node || typeof ResizeObserver === 'undefined') {
      return undefined;
    }

    const resizeObserver = new ResizeObserver(() => {
      measurePanel(node, setPanelSize);
      setLayoutRevision((revision) => revision + 1);
    });
    resizeObserver.observe(node);

    return () => resizeObserver.disconnect();
  }, [enabled]);

  useEffect(() => {
    if (!enabled) {
      return undefined;
    }

    let frameId: number | null = null;
    const bumpLayoutRevision = (): void => {
      if (frameId !== null) {
        return;
      }

      frameId = window.requestAnimationFrame(() => {
        frameId = null;
        setLayoutRevision((revision) => revision + 1);
      });
    };
    const root = panelRef.current?.getRootNode();
    const previewStage = root && 'querySelector' in root
      ? (root as ParentNode).querySelector<HTMLElement>('[data-ai-id="copy-ai-id-editor-preview-stage"]')
      : null;

    window.addEventListener('resize', bumpLayoutRevision, { passive: true });
    window.addEventListener('scroll', bumpLayoutRevision, { capture: true, passive: true });
    previewStage?.addEventListener('scroll', bumpLayoutRevision, { passive: true });

    return () => {
      if (frameId !== null) {
        window.cancelAnimationFrame(frameId);
      }
      window.removeEventListener('resize', bumpLayoutRevision);
      window.removeEventListener('scroll', bumpLayoutRevision, true);
      previewStage?.removeEventListener('scroll', bumpLayoutRevision);
    };
  }, [enabled]);

  const placement = useMemo(() => computeFloatingNotePanelPlacement({
    anchor,
    notePanelWidth,
    panelSize,
  }), [
    anchor,
    isOpen,
    layoutRevision,
    notePanelWidth,
    panelSize,
  ]);
  const shellStyle = createFloatingNotePanelStyle(placement);

  const handleShellKeyDownCapture = (event: ReactKeyboardEvent<HTMLDivElement>): void => {
    if (!isOpen || event.key !== 'Escape' || event.metaKey || event.ctrlKey || event.altKey || event.shiftKey) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    event.nativeEvent.stopImmediatePropagation?.();
    closePanel();
  };

  if (!enabled) {
    return null;
  }

  return (
    <div
      className="copy-ai-id-editor-floating-note-panel-layer"
      data-ai-id="copy-ai-id-editor-floating-note-panel-layer"
      data-ai-editor-floating-note-panel-open={isOpen ? 'true' : 'false'}
    >
      <div
        ref={panelRef}
        className={`copy-ai-id-editor-floating-note-panel-shell${isOpen ? ' is-open' : ' is-closed'}`}
        data-ai-id="copy-ai-id-editor-floating-note-panel-shell"
        data-ai-editor-floating-note-panel-side={placement.side}
        style={shellStyle}
        aria-hidden={isOpen ? undefined : true}
        inert={isOpen ? undefined : true}
        onKeyDownCapture={handleShellKeyDownCapture}
      >
        <NotePanel
          variant="floating"
          dataAiId="copy-ai-id-editor-floating-note-panel"
          className="copy-ai-id-editor-floating-note-panel"
          onRequestClose={closePanel}
        />
      </div>
    </div>
  );
}

function computeFloatingNotePanelPlacement({
  anchor,
  notePanelWidth,
  panelSize,
}: {
  anchor: FloatingNotePanelAnchor | null;
  notePanelWidth: number;
  panelSize: OverlaySize;
}): FloatingNotePanelPlacement {
  const bounds = getEditorBounds();
  const availableWidth = Math.max(1, bounds.width - (FLOATING_NOTE_PANEL_MARGIN_PX * 2));
  const width = clampNumber(
    notePanelWidth,
    Math.min(MIN_NOTE_PANEL_WIDTH, availableWidth),
    Math.min(MAX_NOTE_PANEL_WIDTH, availableWidth),
  );
  const maxHeight = Math.max(
    MIN_FLOATING_NOTE_PANEL_HEIGHT_PX,
    Math.min(MAX_FLOATING_NOTE_PANEL_HEIGHT_PX, bounds.height - (FLOATING_NOTE_PANEL_MARGIN_PX * 2)),
  );
  const height = clampNumber(
    Math.max(panelSize.height || DEFAULT_FLOATING_NOTE_PANEL_HEIGHT_PX, DEFAULT_FLOATING_NOTE_PANEL_HEIGHT_PX),
    MIN_FLOATING_NOTE_PANEL_HEIGHT_PX,
    maxHeight,
  );
  const anchorRect = resolveAnchorRect(anchor) ?? fallbackAnchorRect(bounds);
  const placement = calculateFloatingOverlayPlacement(anchorRect, {
    width,
    height,
  }, {
    bounds,
    gap: FLOATING_NOTE_PANEL_GAP_PX,
    mode: 'target',
    padding: FLOATING_NOTE_PANEL_MARGIN_PX,
  });

  return {
    left: Math.round(placement.left),
    top: Math.round(placement.top),
    width: Math.round(placement.width),
    height: Math.round(placement.height),
    maxHeight: Math.round(maxHeight),
    side: placement.side,
    transformOrigin: placement.transformOrigin,
  };
}

function createFloatingNotePanelStyle(placement: FloatingNotePanelPlacement): CSSProperties {
  return {
    left: `${placement.left}px`,
    top: `${placement.top}px`,
    width: `${placement.width}px`,
    height: `${placement.height}px`,
    maxHeight: `${placement.maxHeight}px`,
    transformOrigin: placement.transformOrigin,
  };
}

function resolveAnchorRect(anchor: FloatingNotePanelAnchor | null): EditorViewportRect | null {
  if (!anchor) {
    return null;
  }

  if (anchor.elementRect) {
    return bridgeViewportRectToEditorViewportRect(anchor.elementRect) ?? anchor.editorRect;
  }

  return anchor.editorRect;
}

function fallbackAnchorRect(bounds: EditorViewportRect): EditorViewportRect {
  const geometry = getPreviewWorkspaceGeometrySnapshot();
  if (geometry?.iframeRect) {
    return createEditorViewportRect({
      left: geometry.iframeRect.left,
      top: geometry.iframeRect.top,
      width: geometry.iframeRect.width,
      height: 0,
    });
  }

  return createEditorViewportRect({
    left: bounds.left + FLOATING_NOTE_PANEL_MARGIN_PX,
    top: bounds.top + FLOATING_NOTE_PANEL_MARGIN_PX,
    width: 0,
    height: 0,
  });
}

function getEditorBounds(): EditorViewportRect {
  const geometry = getPreviewWorkspaceGeometrySnapshot();
  if (geometry?.editorViewportRect) {
    return geometry.editorViewportRect;
  }

  return createEditorViewportRect({
    left: 0,
    top: 0,
    width: typeof window === 'undefined' ? 1 : Math.max(1, window.innerWidth || 1),
    height: typeof window === 'undefined' ? 1 : Math.max(1, window.innerHeight || 1),
  });
}

function measurePanel(
  node: HTMLElement | null,
  setPanelSize: Dispatch<SetStateAction<OverlaySize>>,
): void {
  if (!node) {
    return;
  }

  const rect = node.getBoundingClientRect();
  const width = Math.ceil(rect.width || node.offsetWidth || DEFAULT_PANEL_SIZE.width);
  const height = Math.ceil(rect.height || node.offsetHeight || DEFAULT_PANEL_SIZE.height);

  setPanelSize((currentSize) => {
    if (currentSize.width === width && currentSize.height === height) {
      return currentSize;
    }

    return { width, height };
  });
}

function clampNumber(value: number, min: number, max: number): number {
  if (max < min) {
    return min;
  }

  return Math.round(Math.min(Math.max(value, min), max));
}
