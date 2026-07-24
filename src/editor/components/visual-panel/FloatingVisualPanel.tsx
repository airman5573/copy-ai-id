import {
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type Dispatch,
  type ReactElement,
  type SetStateAction,
} from 'react';

import { type BreakpointId } from '../../../shared/breakpoints';
import {
  bridgeViewportRectToEditorViewportRect,
  calculateFloatingOverlayPlacement,
  createEditorViewportRect,
  getPreviewWorkspaceGeometrySnapshot,
  type EditorViewportRect,
  type OverlayPlacement,
  type OverlaySize,
} from '../../bridge/geometry';
import { useBreakpointStore } from '../../stores/useBreakpointStore';
import {
  FLOATING_VISUAL_PANEL_CATEGORIES,
  useFloatingVisualPanelStore,
  type FloatingVisualPanelCategory,
} from '../../stores/useFloatingVisualPanelStore';
import {
  useVisualSelectionStore,
  type VisualPanelTargetState,
} from '../../stores/useVisualSelectionStore';
import { VisualPanelContent } from './VisualPanelContent';

const DESKTOP_PANEL_WIDTH_PX = 380;
const MOBILE_PANEL_WIDTH_PX = 320;
const MIN_PANEL_WIDTH_PX = 280;
const MAX_PANEL_HEIGHT_PX = 560;
const MIN_PANEL_HEIGHT_PX = 180;
const VIEWPORT_MARGIN_PX = 12;
const PANEL_GAP_PX = 8;
const DEFAULT_PANEL_SIZE: OverlaySize = { width: DESKTOP_PANEL_WIDTH_PX, height: 360 };

type FloatingPanelPlacementMode = 'desktop-follow-anchor' | 'mobile-iframe-right';

interface FloatingPanelPlacement {
  left: number;
  top: number;
  width: number;
  maxHeight: number;
  mode: FloatingPanelPlacementMode;
  side: OverlayPlacement['side'];
  transformOrigin: string;
  flipped: boolean;
}

const MOBILE_PANEL_BREAKPOINTS = new Set<BreakpointId>(['base', 'tablet']);

const CATEGORY_TAB_LABELS: Record<FloatingVisualPanelCategory, string> = {
  content: '콘텐츠',
  image: '이미지',
  layout: '레이아웃',
  spacing: '간격',
  size: '크기',
  style: '스타일',
  border: '선',
};

// The 모든 옵션 panel: every edit control grouped under category tabs
// (toolbar-duplicated controls included on purpose). Opened from the quick
// toolbar's 모든 옵션 button.
export function FloatingVisualPanel(): ReactElement | null {
  const isOpen = useFloatingVisualPanelStore((state) => state.isOpen);
  const activeCategory = useFloatingVisualPanelStore((state) => state.activeCategory);
  const setCategory = useFloatingVisualPanelStore((state) => state.setCategory);
  const target = useVisualSelectionStore((state) => state.panelTarget);
  const snapshot = useVisualSelectionStore((state) => state.snapshot);
  const closePanel = useFloatingVisualPanelStore((state) => state.closePanel);
  const closeVisualSelectionPanel = useVisualSelectionStore((state) => state.closePanel);
  const activeBreakpointId = useBreakpointStore((state) => state.activeBreakpointId);
  const zoom = useBreakpointStore((state) => state.zoomById[state.activeBreakpointId]);
  const panelRef = useRef<HTMLElement | null>(null);
  const [panelSize, setPanelSize] = useState<OverlaySize>(DEFAULT_PANEL_SIZE);
  const [layoutRevision, setLayoutRevision] = useState(0);
  const placementMode: FloatingPanelPlacementMode = MOBILE_PANEL_BREAKPOINTS.has(activeBreakpointId)
    ? 'mobile-iframe-right'
    : 'desktop-follow-anchor';

  useLayoutEffect(() => {
    if (!isOpen) {
      return;
    }

    measurePanel(panelRef.current, setPanelSize);
  }, [isOpen, target?.nodeId]);

  useEffect(() => {
    if (!isOpen) {
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
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) {
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
  }, [isOpen]);

  const placement = useMemo(() => computePanelPlacement({
    mode: placementMode,
    panelSize,
    target,
  }), [
    activeBreakpointId,
    layoutRevision,
    panelSize,
    placementMode,
    target,
    zoom,
  ]);
  const panelStyle = createPanelStyle(placement);

  if (!isOpen || !target) {
    return null;
  }

  const tagName = snapshot?.tagName?.toLowerCase()
    ?? (target.target.kind === 'fallback' ? target.target.tagName.toLowerCase() : null);
  const label = snapshot?.label ?? getTargetLabel(target);
  const handleClosePanel = (): void => {
    closePanel();
    closeVisualSelectionPanel();
  };

  return (
    <div
      className="pointer-events-none fixed inset-0 z-[120]"
      data-ai-id="copy-ai-id-editor-floating-visual-panel-layer"
    >
      <section
        ref={panelRef}
        className="copy-ai-id-editor-floating-visual-panel pointer-events-auto fixed flex min-h-0 flex-col overflow-hidden rounded-2xl border border-blue-500/30 bg-[color:var(--ai-editor-chrome-bg)] text-[color:var(--ai-editor-chrome-text)] shadow-[0_20px_54px_rgba(0,0,0,0.48)] ring-1 ring-white/5 backdrop-blur-md"
        style={panelStyle}
        role="dialog"
        aria-label={`${label} 편집 패널`}
        data-ai-id="copy-ai-id-editor-floating-visual-panel"
        data-ai-editor-floating-visual-panel="1"
        data-copy-ai-id-visual-focus-guard="true"
        data-ai-editor-floating-panel-placement={placement.mode}
        data-ai-editor-floating-panel-flipped={placement.flipped ? '1' : '0'}
        data-ai-editor-floating-panel-target-ai-id={target.target.kind === 'ai-id' ? target.target.aiId : ''}
      >
        <header
          className="copy-ai-id-editor-floating-visual-panel__header shrink-0 border-b border-[color:var(--ai-editor-chrome-border)] bg-[color:var(--ai-editor-chrome-bg-translucent)] px-3 py-2.5"
          data-ai-id="copy-ai-id-editor-floating-visual-panel-header"
        >
          <div className="flex items-center gap-3" data-ai-id="copy-ai-id-editor-floating-visual-panel-header-row">
            <div className="flex min-w-0 flex-1 items-center gap-2" data-ai-id="copy-ai-id-editor-floating-visual-panel-title-row">
              {tagName ? (
                <span
                  className="shrink-0 rounded-md border border-gray-600 bg-gray-900 px-1.5 py-0.5 font-mono text-[10px] font-bold uppercase text-gray-200"
                  data-ai-id="copy-ai-id-editor-floating-visual-panel-tag-badge"
                >
                  {tagName}
                </span>
              ) : null}
              <h2
                className="truncate text-xs font-bold text-gray-50"
                data-ai-id="copy-ai-id-editor-floating-visual-panel-title-text"
              >
                {label}
              </h2>
            </div>
            <button
              type="button"
              className="copy-ai-id-editor-floating-visual-panel__close inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-gray-600 bg-gray-950/70 text-gray-200 transition hover:border-gray-500 hover:bg-gray-900 hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400/70"
              aria-label="패널 닫기"
              onClick={handleClosePanel}
              data-ai-id="copy-ai-id-editor-floating-visual-panel-close-button"
            >
              <span aria-hidden="true" data-ai-id="copy-ai-id-editor-floating-visual-panel-close-icon-text">×</span>
            </button>
          </div>
          <div
            className="mt-2 flex gap-1 overflow-x-auto pb-0.5"
            role="tablist"
            aria-label="편집 카테고리"
            data-ai-id="copy-ai-id-editor-floating-visual-panel-category-tabs"
          >
            {FLOATING_VISUAL_PANEL_CATEGORIES.map((category) => {
              const active = activeCategory === category;
              return (
                <button
                  key={category}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  className={`shrink-0 rounded-full border px-2.5 py-1 text-[10px] font-bold transition focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400/70 ${
                    active
                      ? 'border-blue-400/70 bg-blue-500/25 text-blue-50 shadow-sm shadow-blue-950/30'
                      : 'border-gray-700 bg-gray-950/40 text-gray-400 hover:border-gray-600 hover:bg-gray-900 hover:text-gray-100'
                  }`}
                  onClick={() => setCategory(category)}
                  data-ai-id={`copy-ai-id-editor-floating-visual-panel-${category}-tab-button`}
                >
                  {CATEGORY_TAB_LABELS[category]}
                </button>
              );
            })}
          </div>
        </header>

        <div
          className="copy-ai-id-editor-floating-visual-panel__body min-h-0 flex-1 overflow-y-auto bg-[color:var(--ai-editor-panel-body-bg)] p-3"
          data-ai-id="copy-ai-id-editor-floating-visual-panel-body"
        >
          <VisualPanelContent target={target} category={activeCategory} />
        </div>
      </section>
    </div>
  );
}

function getTargetLabel(target: VisualPanelTargetState): string {
  if (target.target.kind === 'ai-id') {
    return target.target.aiId;
  }

  return target.target.label || target.target.selector || target.target.tagName;
}

function computePanelPlacement({
  mode,
  panelSize,
  target,
}: {
  mode: FloatingPanelPlacementMode;
  panelSize: OverlaySize;
  target: VisualPanelTargetState | null;
}): FloatingPanelPlacement {
  const editorBounds = getEditorBounds();
  const requestedWidth = mode === 'mobile-iframe-right'
    ? MOBILE_PANEL_WIDTH_PX
    : DESKTOP_PANEL_WIDTH_PX;
  const width = clampNumber(
    requestedWidth,
    Math.min(MIN_PANEL_WIDTH_PX, Math.max(1, editorBounds.width - VIEWPORT_MARGIN_PX * 2)),
    Math.max(1, editorBounds.width - VIEWPORT_MARGIN_PX * 2),
  );
  const maxHeight = Math.max(
    MIN_PANEL_HEIGHT_PX,
    Math.min(MAX_PANEL_HEIGHT_PX, editorBounds.height - VIEWPORT_MARGIN_PX * 2),
  );
  const height = clampNumber(
    panelSize.height || DEFAULT_PANEL_SIZE.height,
    MIN_PANEL_HEIGHT_PX,
    maxHeight,
  );
  const anchorRect = resolvePanelAnchorRect(target) ?? fallbackAnchorRect();
  const placement = calculateFloatingOverlayPlacement(anchorRect, {
    width,
    height,
  }, {
    bounds: editorBounds,
    gap: PANEL_GAP_PX,
    mode: mode === 'mobile-iframe-right' ? 'preview-side' : 'target',
    padding: VIEWPORT_MARGIN_PX,
    previewSide: mode === 'mobile-iframe-right' ? 'right' : 'auto',
  });

  return {
    left: Math.round(placement.left),
    top: Math.round(placement.top),
    width: Math.round(placement.width),
    maxHeight: Math.round(maxHeight),
    mode,
    side: placement.side,
    transformOrigin: placement.transformOrigin,
    flipped: mode === 'desktop-follow-anchor' ? placement.side === 'below' : false,
  };
}

function createPanelStyle(placement: FloatingPanelPlacement): CSSProperties {
  return {
    left: `${placement.left}px`,
    top: `${placement.top}px`,
    width: `${placement.width}px`,
    maxHeight: `${placement.maxHeight}px`,
    transformOrigin: placement.transformOrigin,
  };
}

function resolvePanelAnchorRect(target: VisualPanelTargetState | null): EditorViewportRect | null {
  return targetEditorRect(target) ?? getPreviewWorkspaceGeometrySnapshot()?.iframeRect ?? null;
}

function targetEditorRect(target: VisualPanelTargetState | null): EditorViewportRect | null {
  if (!target) {
    return null;
  }

  return target.elementRect
    ? bridgeViewportRectToEditorViewportRect(target.elementRect) ?? target.editorRect
    : target.editorRect;
}

function fallbackAnchorRect(): EditorViewportRect {
  const geometry = getPreviewWorkspaceGeometrySnapshot();
  if (geometry?.iframeRect) {
    return createEditorViewportRect({
      left: geometry.iframeRect.left,
      top: geometry.iframeRect.top,
      width: geometry.iframeRect.width,
      height: 0,
    });
  }

  const bounds = getEditorBounds();
  return createEditorViewportRect({
    left: bounds.left + VIEWPORT_MARGIN_PX,
    top: bounds.top + VIEWPORT_MARGIN_PX,
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
