import {
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type Dispatch,
  type FocusEvent as ReactFocusEvent,
  type MutableRefObject,
  type PointerEvent as ReactPointerEvent,
  type SetStateAction,
} from 'react';
import {
  ArrowDown,
  ArrowUp,
  Copy,
  GripVertical,
  Trash2,
} from 'lucide-react';

import type {
  BridgeViewportRect,
  BridgeViewportSize,
  EditorTargetReference,
  QuickActionCategory,
  VisualStructureOperation,
} from '../../../shared/editor-messages';
import {
  bridgeViewportRectToEditorViewportRect,
  calculateQuickActionBarPlacement,
  type EditorViewportRect,
  type OverlayPlacement,
  type OverlaySize,
} from '../../bridge/geometry';
import { selectQuickActionCategory } from '../../bridge/bridgeClient';
import {
  clearQuickActionDragMovePreview,
  dispatchQuickActionDragMoveFromEditorPoint,
  dispatchQuickActionStructureOperation,
  previewQuickActionDragMoveFromEditorPoint,
  type QuickActionStructureOperation,
} from '../../visual/structureActions';
import { useFloatingVisualPanelStore } from '../../stores/useFloatingVisualPanelStore';
import {
  useVisualSelectionStore,
  type VisualHoverTargetState,
  type VisualToolbarTargetState,
} from '../../stores/useVisualSelectionStore';

const QUICK_ACTION_HIDE_DELAY_MS = 180;
const QUICK_ACTION_BAR_GAP = 8;
const QUICK_ACTION_BAR_PADDING = 12;
const DEFAULT_QUICK_ACTION_BAR_SIZE: OverlaySize = { width: 520, height: 40 };

const QUICK_ACTION_CATEGORIES: Array<{ category: QuickActionCategory; label: string }> = [
  { category: 'content', label: '콘텐츠' },
  { category: 'layout', label: '레이아웃' },
  { category: 'spacing', label: '간격' },
  { category: 'size', label: '크기' },
  { category: 'style', label: '스타일' },
  { category: 'border', label: '선' },
];

const STRUCTURE_ACTIONS: Array<{
  action: Exclude<VisualStructureOperation, 'restore' | 'drag-move'>;
  label: string;
  title: string;
  icon: typeof Copy;
  destructive?: boolean;
}> = [
  { action: 'duplicate', label: '복제', title: '복제', icon: Copy },
  { action: 'move-up', label: '위', title: '이전 형제 앞으로 이동', icon: ArrowUp },
  { action: 'move-down', label: '아래', title: '다음 형제 뒤로 이동', icon: ArrowDown },
  { action: 'delete', label: '삭제', title: '삭제', icon: Trash2, destructive: true },
];

interface QuickActionRenderTarget extends EditorTargetReference {
  elementRect: BridgeViewportRect;
  editorRect: EditorViewportRect | null;
  viewport: BridgeViewportSize | null;
  availableCategories: QuickActionCategory[];
  updatedAt: number;
}

interface QuickActionDragState {
  pointerId: number;
  startX: number;
  startY: number;
  latestX: number;
  latestY: number;
  reference: EditorTargetReference;
}

const QUICK_ACTION_DRAG_THRESHOLD_PX = 8;

export function QuickActionBar() {
  const hoverTarget = useVisualSelectionStore((state) => state.hoverTarget);
  const activeToolbarTarget = useVisualSelectionStore((state) => state.activeToolbarTarget);
  const quickActionDismissedAt = useVisualSelectionStore((state) => state.quickActionDismissedAt);
  const panelCategory = useFloatingVisualPanelStore((state) => state.category);
  const liveTarget = useMemo(() => resolveLiveQuickActionTarget(activeToolbarTarget, hoverTarget), [
    activeToolbarTarget,
    hoverTarget,
  ]);
  const liveTargetRef = useRef<QuickActionRenderTarget | null>(liveTarget);
  const barRef = useRef<HTMLDivElement | null>(null);
  const hideTimerRef = useRef<number | null>(null);
  const dragStateRef = useRef<QuickActionDragState | null>(null);
  const [renderTarget, setRenderTarget] = useState<QuickActionRenderTarget | null>(liveTarget);
  const [isToolbarHovered, setToolbarHovered] = useState(false);
  const [isToolbarFocusWithin, setToolbarFocusWithin] = useState(false);
  const [barSize, setBarSize] = useState<OverlaySize>(DEFAULT_QUICK_ACTION_BAR_SIZE);
  const [layoutRevision, setLayoutRevision] = useState(0);
  const [isDraggingStructure, setDraggingStructure] = useState(false);

  useEffect(() => {
    liveTargetRef.current = liveTarget;
  }, [liveTarget]);

  useEffect(() => {
    if (liveTarget) {
      clearHideTimer(hideTimerRef);
      setRenderTarget(liveTarget);
      return undefined;
    }

    if (isToolbarHovered || isToolbarFocusWithin) {
      return undefined;
    }

    scheduleHide(hideTimerRef, () => setRenderTarget(null));
    return undefined;
  }, [isToolbarFocusWithin, isToolbarHovered, liveTarget]);

  useLayoutEffect(() => {
    measureToolbar(barRef.current, setBarSize);
  }, [renderTarget, panelCategory]);

  useEffect(() => {
    const node = barRef.current;
    if (!node || typeof ResizeObserver === 'undefined') {
      return undefined;
    }

    const resizeObserver = new ResizeObserver(() => {
      measureToolbar(node, setBarSize);
      setLayoutRevision((revision) => revision + 1);
    });
    resizeObserver.observe(node);

    return () => resizeObserver.disconnect();
  }, [renderTarget]);

  useEffect(() => {
    if (!renderTarget) {
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

    window.addEventListener('resize', bumpLayoutRevision, { passive: true });
    window.addEventListener('scroll', bumpLayoutRevision, { capture: true, passive: true });

    return () => {
      if (frameId !== null) {
        window.cancelAnimationFrame(frameId);
      }
      window.removeEventListener('resize', bumpLayoutRevision);
      window.removeEventListener('scroll', bumpLayoutRevision, true);
    };
  }, [renderTarget]);

  useEffect(() => () => clearHideTimer(hideTimerRef), []);

  useEffect(() => {
    if (quickActionDismissedAt === null) {
      return;
    }

    clearHideTimer(hideTimerRef);
    setToolbarHovered(false);
    setToolbarFocusWithin(false);
    setRenderTarget(null);
  }, [quickActionDismissedAt]);

  const placement = useMemo(() => {
    if (!renderTarget) {
      return null;
    }

    const anchorRect = bridgeViewportRectToEditorViewportRect(renderTarget.elementRect)
      ?? renderTarget.editorRect;

    if (!anchorRect) {
      return null;
    }

    return calculateQuickActionBarPlacement(anchorRect, barSize, {
      gap: QUICK_ACTION_BAR_GAP,
      padding: QUICK_ACTION_BAR_PADDING,
    });
  }, [barSize, layoutRevision, renderTarget]);

  if (!renderTarget) {
    return null;
  }

  const visibleCategories = getVisibleCategories(renderTarget.availableCategories);
  const style = createToolbarStyle(placement);
  const handlePointerEnter = (): void => {
    setToolbarHovered(true);
    clearHideTimer(hideTimerRef);
  };
  const handlePointerLeave = (): void => {
    setToolbarHovered(false);
    if (!liveTargetRef.current && !isToolbarFocusWithin) {
      scheduleHide(hideTimerRef, () => setRenderTarget(null));
    }
  };
  const handleFocusCapture = (): void => {
    setToolbarFocusWithin(true);
    clearHideTimer(hideTimerRef);
  };
  const handleBlurCapture = (event: ReactFocusEvent<HTMLDivElement>): void => {
    if (event.currentTarget.contains(event.relatedTarget as Node | null)) {
      return;
    }

    setToolbarFocusWithin(false);
    if (!liveTargetRef.current && !isToolbarHovered) {
      scheduleHide(hideTimerRef, () => setRenderTarget(null));
    }
  };
  const handleCategoryClick = (category: QuickActionCategory): void => {
    selectQuickActionCategory({
      target: renderTarget.target,
      nodeId: renderTarget.nodeId,
    }, category, {
      elementRect: renderTarget.elementRect,
      editorRect: renderTarget.editorRect,
    });
  };
  const handleStructureActionClick = (operation: QuickActionStructureOperation): void => {
    dispatchQuickActionStructureOperation({
      target: renderTarget.target,
      nodeId: renderTarget.nodeId,
    }, operation);
  };
  const handleDragGripPointerDown = (event: ReactPointerEvent<HTMLButtonElement>): void => {
    if (event.button !== 0) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    event.currentTarget.setPointerCapture(event.pointerId);
    dragStateRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      latestX: event.clientX,
      latestY: event.clientY,
      reference: {
        target: renderTarget.target,
        nodeId: renderTarget.nodeId,
      },
    };
    setDraggingStructure(true);
  };
  const handleDragGripPointerMove = (event: ReactPointerEvent<HTMLButtonElement>): void => {
    const dragState = dragStateRef.current;
    if (!dragState || dragState.pointerId !== event.pointerId) {
      return;
    }

    dragState.latestX = event.clientX;
    dragState.latestY = event.clientY;

    const distance = Math.hypot(
      dragState.latestX - dragState.startX,
      dragState.latestY - dragState.startY,
    );

    if (distance >= QUICK_ACTION_DRAG_THRESHOLD_PX) {
      previewQuickActionDragMoveFromEditorPoint(dragState.reference, {
        x: dragState.latestX,
        y: dragState.latestY,
      });
    }
  };
  const finishDragGrip = (event: ReactPointerEvent<HTMLButtonElement>, commit: boolean): void => {
    const dragState = dragStateRef.current;
    if (!dragState || dragState.pointerId !== event.pointerId) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    dragStateRef.current = null;
    setDraggingStructure(false);
    clearQuickActionDragMovePreview();

    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }

    const distance = Math.hypot(
      dragState.latestX - dragState.startX,
      dragState.latestY - dragState.startY,
    );

    if (!commit || distance < QUICK_ACTION_DRAG_THRESHOLD_PX) {
      return;
    }

    dispatchQuickActionDragMoveFromEditorPoint(dragState.reference, {
      x: dragState.latestX,
      y: dragState.latestY,
    });
  };

  return (
    <div
      ref={barRef}
      className={`copy-ai-id-editor-quick-action-bar${placement ? ` copy-ai-id-editor-quick-action-bar--${placement.side}` : ''}`}
      data-ai-id="copy-ai-id-editor-quick-action-bar"
      data-copy-ai-id-visual-focus-guard="true"
      data-visual-target-updated-at={renderTarget.updatedAt}
      role="toolbar"
      aria-label="Visual editor quick actions"
      style={style}
      onPointerEnter={handlePointerEnter}
      onPointerLeave={handlePointerLeave}
      onFocusCapture={handleFocusCapture}
      onBlurCapture={handleBlurCapture}
    >
      <button
        type="button"
        className={`copy-ai-id-editor-quick-action-bar__button copy-ai-id-editor-quick-action-bar__button--icon copy-ai-id-editor-quick-action-bar__button--grip${isDraggingStructure ? ' is-dragging' : ''}`}
        data-ai-id="copy-ai-id-editor-quick-action-drag-grip-button"
        data-ai-editor-drag-grip="1"
        title="드래그해서 이동"
        aria-label="드래그해서 이동"
        aria-pressed={isDraggingStructure}
        onPointerDown={handleDragGripPointerDown}
        onPointerMove={handleDragGripPointerMove}
        onPointerUp={(event) => finishDragGrip(event, true)}
        onPointerCancel={(event) => finishDragGrip(event, false)}
        onLostPointerCapture={() => {
          if (dragStateRef.current) {
            dragStateRef.current = null;
            setDraggingStructure(false);
            clearQuickActionDragMovePreview();
          }
        }}
      >
        <GripVertical size={13} aria-hidden="true" />
      </button>

      <span className="copy-ai-id-editor-quick-action-bar__separator" data-ai-id="copy-ai-id-editor-quick-action-drag-divider" />

      {QUICK_ACTION_CATEGORIES.filter(({ category }) => visibleCategories.has(category)).map(({ category, label }) => (
        <button
          key={category}
          type="button"
          className={`copy-ai-id-editor-quick-action-bar__button${panelCategory === category ? ' is-active' : ''}`}
          data-ai-id={`copy-ai-id-editor-quick-action-${category}-button`}
          data-ai-editor-quick-action={category}
          aria-pressed={panelCategory === category}
          onClick={() => handleCategoryClick(category)}
        >
          {label}
        </button>
      ))}

      <span className="copy-ai-id-editor-quick-action-bar__separator" data-ai-id="copy-ai-id-editor-quick-action-structure-divider" />

      {STRUCTURE_ACTIONS.map(({ action, label, title, icon: Icon, destructive }) => (
        <button
          key={action}
          type="button"
          className={`copy-ai-id-editor-quick-action-bar__button copy-ai-id-editor-quick-action-bar__button--structure${destructive ? ' copy-ai-id-editor-quick-action-bar__button--danger' : ''}`}
          data-ai-id={`copy-ai-id-editor-quick-action-structure-${action}-button`}
          data-ai-editor-structure-action={action}
          title={title}
          onClick={() => handleStructureActionClick(action)}
        >
          <Icon size={12} aria-hidden="true" />
          <span>{label}</span>
        </button>
      ))}
    </div>
  );
}

function resolveLiveQuickActionTarget(
  activeToolbarTarget: VisualToolbarTargetState | null,
  hoverTarget: VisualHoverTargetState | null,
): QuickActionRenderTarget | null {
  if (activeToolbarTarget?.target && activeToolbarTarget.elementRect) {
    return {
      target: activeToolbarTarget.target,
      nodeId: activeToolbarTarget.nodeId,
      elementRect: activeToolbarTarget.elementRect,
      editorRect: activeToolbarTarget.editorRect,
      viewport: activeToolbarTarget.viewport,
      availableCategories: activeToolbarTarget.availableCategories,
      updatedAt: activeToolbarTarget.updatedAt,
    };
  }

  if (hoverTarget?.target && hoverTarget.elementRect) {
    return {
      target: hoverTarget.target,
      nodeId: hoverTarget.nodeId,
      elementRect: hoverTarget.elementRect,
      editorRect: hoverTarget.editorRect,
      viewport: hoverTarget.viewport,
      availableCategories: QUICK_ACTION_CATEGORIES.map(({ category }) => category),
      updatedAt: hoverTarget.updatedAt,
    };
  }

  return null;
}

function getVisibleCategories(categories: readonly QuickActionCategory[]): Set<QuickActionCategory> {
  const requested = new Set(categories);
  if (requested.size === 0) {
    return new Set(QUICK_ACTION_CATEGORIES.map(({ category }) => category));
  }

  return new Set(
    QUICK_ACTION_CATEGORIES
      .map(({ category }) => category)
      .filter((category) => requested.has(category)),
  );
}

function createToolbarStyle(placement: OverlayPlacement | null): CSSProperties {
  if (!placement) {
    return {
      left: 0,
      top: 0,
      visibility: 'hidden',
    };
  }

  return {
    left: `${placement.left}px`,
    top: `${placement.top}px`,
    transformOrigin: placement.transformOrigin,
  };
}

function measureToolbar(
  node: HTMLDivElement | null,
  setBarSize: Dispatch<SetStateAction<OverlaySize>>,
): void {
  if (!node) {
    return;
  }

  const rect = node.getBoundingClientRect();
  const width = Math.ceil(rect.width || node.offsetWidth || DEFAULT_QUICK_ACTION_BAR_SIZE.width);
  const height = Math.ceil(rect.height || node.offsetHeight || DEFAULT_QUICK_ACTION_BAR_SIZE.height);

  setBarSize((currentSize) => {
    if (currentSize.width === width && currentSize.height === height) {
      return currentSize;
    }

    return { width, height };
  });
}

function scheduleHide(
  timerRef: MutableRefObject<number | null>,
  hide: () => void,
): void {
  clearHideTimer(timerRef);
  timerRef.current = window.setTimeout(() => {
    timerRef.current = null;
    hide();
  }, QUICK_ACTION_HIDE_DELAY_MS);
}

function clearHideTimer(timerRef: MutableRefObject<number | null>): void {
  if (timerRef.current === null) {
    return;
  }

  window.clearTimeout(timerRef.current);
  timerRef.current = null;
}
