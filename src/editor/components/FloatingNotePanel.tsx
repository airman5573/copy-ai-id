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
import type { BreakpointId } from '../../shared/breakpoints';
import { EDITOR_MESSAGE_TYPES } from '../../shared/protocol/editor-bridge-messages';
import { postToBridge } from '../bridge/bridgeClient';
import { handleEditorEscapeAction } from '../shortcut-actions';
import { useBreakpointStore } from '../stores/useBreakpointStore';
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

const DEFAULT_FLOATING_NOTE_PANEL_HEIGHT_PX = 348;
const MIN_FLOATING_NOTE_PANEL_HEIGHT_PX = 150;
const MAX_FLOATING_NOTE_PANEL_HEIGHT_PX = 480;
const FLOATING_NOTE_PANEL_GAP_PX = 10;
const FLOATING_NOTE_PANEL_MARGIN_PX = 12;
const FLOATING_NOTE_PANEL_SCROLL_CLOSE_DISTANCE_PX = 200;
const RIGHT_EDGE_SHIFT_THRESHOLD_PX = 1;

const DEFAULT_PANEL_SIZE: OverlaySize = {
  width: MIN_NOTE_PANEL_WIDTH,
  height: DEFAULT_FLOATING_NOTE_PANEL_HEIGHT_PX,
};

type FloatingNotePanelPlacementMode = 'desktop-target' | 'mobile-preview-right';

const MOBILE_NOTE_PANEL_BREAKPOINTS = new Set<BreakpointId>(['base', 'mobile', 'tablet']);

interface FloatingNotePanelPlacement {
  left: number;
  top: number;
  width: number;
  height: number;
  maxHeight: number;
  mode: FloatingNotePanelPlacementMode;
  side: OverlayPlacement['side'];
  transformOrigin: string;
}

export function FloatingNotePanel() {
  const isOpen = useFloatingNotePanelStore((state) => state.isOpen);
  const anchor = useFloatingNotePanelStore((state) => state.anchor);
  const openedAt = useFloatingNotePanelStore((state) => state.openedAt);
  const notePanelWidth = useEditorLayoutStore((state) => state.notePanelWidth);
  const activeBreakpointId = useBreakpointStore((state) => state.activeBreakpointId);
  const zoom = useBreakpointStore((state) => state.zoomById[state.activeBreakpointId]);
  const panelRef = useRef<HTMLDivElement | null>(null);
  const [panelSize, setPanelSize] = useState<OverlaySize>(DEFAULT_PANEL_SIZE);
  const [layoutRevision, setLayoutRevision] = useState(0);
  const placementMode: FloatingNotePanelPlacementMode = MOBILE_NOTE_PANEL_BREAKPOINTS.has(activeBreakpointId)
    ? 'mobile-preview-right'
    : 'desktop-target';

  useLayoutEffect(() => {
    measurePanel(panelRef.current, setPanelSize);
  }, [isOpen, notePanelWidth]);

  useEffect(() => {
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
  }, []);

  useEffect(() => {
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
  }, []);

  useEffect(() => {
    if (!isOpen) {
      return undefined;
    }

    const root = panelRef.current?.getRootNode();
    const previewStage = root && 'querySelector' in root
      ? (root as ParentNode).querySelector<HTMLElement>('[data-ai-id="copy-ai-id-editor-preview-stage"]')
      : null;
    if (!previewStage) {
      return undefined;
    }

    const openedAnchor = anchor;
    let previousScrollLeft = previewStage.scrollLeft;
    let previousScrollTop = previewStage.scrollTop;
    let cumulativeScrollDistance = 0;

    const closeAfterScrollThreshold = (): void => {
      const nextScrollLeft = previewStage.scrollLeft;
      const nextScrollTop = previewStage.scrollTop;
      cumulativeScrollDistance += Math.abs(nextScrollLeft - previousScrollLeft)
        + Math.abs(nextScrollTop - previousScrollTop);
      previousScrollLeft = nextScrollLeft;
      previousScrollTop = nextScrollTop;

      if (cumulativeScrollDistance < FLOATING_NOTE_PANEL_SCROLL_CLOSE_DISTANCE_PX) {
        return;
      }

      const floatingNotePanel = useFloatingNotePanelStore.getState();
      if (
        floatingNotePanel.isOpen
        && floatingNotePanel.openedAt === openedAt
        && floatingNotePanel.anchor === openedAnchor
      ) {
        floatingNotePanel.closePanel();
      }
    };

    previewStage.addEventListener('scroll', closeAfterScrollThreshold, { passive: true });
    return () => previewStage.removeEventListener('scroll', closeAfterScrollThreshold);
  }, [anchor, isOpen, openedAt]);

  const placement = useMemo(() => computeFloatingNotePanelPlacement({
    anchor,
    mode: placementMode,
    notePanelWidth,
    panelSize,
  }), [
    anchor,
    activeBreakpointId,
    isOpen,
    layoutRevision,
    notePanelWidth,
    panelSize,
    placementMode,
    zoom,
  ]);
  const shellStyle = createFloatingNotePanelStyle(placement);

  const handleShellKeyDownCapture = (event: ReactKeyboardEvent<HTMLDivElement>): void => {
    if (!isOpen || event.key !== 'Escape' || event.metaKey || event.ctrlKey || event.altKey || event.shiftKey) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    event.nativeEvent.stopImmediatePropagation?.();
    const result = handleEditorEscapeAction();
    if (result === 'floating-note-panel') {
      postToBridge({ type: EDITOR_MESSAGE_TYPES.keyboardShortcut, shortcut: 'escape' });
    }
  };

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
        data-ai-editor-floating-note-panel-placement={placement.mode}
        data-ai-editor-floating-note-panel-side={placement.side}
        style={shellStyle}
        aria-hidden={isOpen ? undefined : true}
        inert={isOpen ? undefined : true}
        onKeyDownCapture={handleShellKeyDownCapture}
      >
        <NotePanel
          dataAiId="copy-ai-id-editor-floating-note-panel"
          className="copy-ai-id-editor-floating-note-panel"
        />
      </div>
    </div>
  );
}

function computeFloatingNotePanelPlacement({
  anchor,
  mode,
  notePanelWidth,
  panelSize,
}: {
  anchor: FloatingNotePanelAnchor | null;
  mode: FloatingNotePanelPlacementMode;
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
  const placement = mode === 'mobile-preview-right'
    ? alignFloatingNotePanelTopToAnchor(calculateFloatingOverlayPlacement(anchorRect, {
      width,
      height,
    }, {
      bounds,
      gap: FLOATING_NOTE_PANEL_GAP_PX,
      mode: 'preview-side',
      padding: FLOATING_NOTE_PANEL_MARGIN_PX,
      previewSide: 'right',
    }), anchorRect, bounds)
    : calculateFloatingNotePanelPreferredPlacement(anchorRect, {
      width,
      height,
    }, bounds);

  return {
    left: Math.round(placement.left),
    top: Math.round(placement.top),
    width: Math.round(placement.width),
    height: Math.round(placement.height),
    maxHeight: Math.round(maxHeight),
    mode,
    side: placement.side,
    transformOrigin: placement.transformOrigin,
  };
}

function alignFloatingNotePanelTopToAnchor(
  placement: OverlayPlacement,
  anchorRect: EditorViewportRect,
  bounds: EditorViewportRect,
): OverlayPlacement {
  const minTop = bounds.top + FLOATING_NOTE_PANEL_MARGIN_PX;
  const maxTop = bounds.bottom - FLOATING_NOTE_PANEL_MARGIN_PX - placement.height;

  return {
    ...placement,
    top: clampNumber(anchorRect.top, minTop, maxTop),
  };
}

function calculateFloatingNotePanelPreferredPlacement(
  anchorRect: EditorViewportRect,
  size: OverlaySize,
  bounds: EditorViewportRect,
): OverlayPlacement {
  const safeWidth = Math.max(0, size.width);
  const safeHeight = Math.max(0, size.height);
  const minLeft = bounds.left + FLOATING_NOTE_PANEL_MARGIN_PX;
  const maxLeft = bounds.right - FLOATING_NOTE_PANEL_MARGIN_PX - safeWidth;
  const minTop = bounds.top + FLOATING_NOTE_PANEL_MARGIN_PX;
  const maxTop = bounds.bottom - FLOATING_NOTE_PANEL_MARGIN_PX - safeHeight;
  const preferredLeft = anchorRect.right + FLOATING_NOTE_PANEL_GAP_PX;
  const preferredTop = clampNumber(anchorRect.top, minTop, maxTop);

  if (fitsWithinBounds(preferredLeft, preferredTop, safeWidth, safeHeight, bounds)) {
    return shiftRightEdgePlacementLeft({
      left: preferredLeft,
      top: preferredTop,
      width: safeWidth,
      height: safeHeight,
      side: 'right',
      transformOrigin: 'top left',
    }, bounds);
  }

  const anchorCenter = anchorRect.left + (anchorRect.width / 2);
  const aboveLeft = anchorCenter - (safeWidth / 2);
  const aboveTop = anchorRect.top - FLOATING_NOTE_PANEL_GAP_PX - safeHeight;

  return shiftRightEdgePlacementLeft({
    left: clampNumber(aboveLeft, minLeft, maxLeft),
    top: clampNumber(aboveTop, minTop, maxTop),
    width: safeWidth,
    height: safeHeight,
    side: 'above',
    transformOrigin: 'bottom center',
  }, bounds);
}

function shiftRightEdgePlacementLeft(
  placement: OverlayPlacement,
  bounds: EditorViewportRect,
): OverlayPlacement {
  const maxRight = bounds.right - FLOATING_NOTE_PANEL_MARGIN_PX;
  const minLeft = bounds.left + FLOATING_NOTE_PANEL_MARGIN_PX;
  const maxLeft = bounds.right - FLOATING_NOTE_PANEL_MARGIN_PX - placement.width;
  const isAtRightEdge = placement.left + placement.width >= maxRight - RIGHT_EDGE_SHIFT_THRESHOLD_PX;

  if (!isAtRightEdge) {
    return placement;
  }

  return {
    ...placement,
    left: clampNumber(placement.left - placement.width, minLeft, maxLeft),
  };
}

function fitsWithinBounds(
  left: number,
  top: number,
  width: number,
  height: number,
  bounds: EditorViewportRect,
): boolean {
  const minLeft = bounds.left + FLOATING_NOTE_PANEL_MARGIN_PX;
  const maxRight = bounds.right - FLOATING_NOTE_PANEL_MARGIN_PX;
  const minTop = bounds.top + FLOATING_NOTE_PANEL_MARGIN_PX;
  const maxBottom = bounds.bottom - FLOATING_NOTE_PANEL_MARGIN_PX;

  return left >= minLeft
    && top >= minTop
    && left + width <= maxRight
    && top + height <= maxBottom;
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
