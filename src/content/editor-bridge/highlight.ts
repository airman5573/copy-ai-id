import {
  EDITOR_MESSAGE_TYPES,
  type BridgeToEditorMessage,
  type EditorTarget,
  type HighlightOrigin,
  type QuickActionCategory,
} from '../../shared/editor-messages';
import { hasSameEditorTarget } from '../../shared/editor-targets';
import { resolveTreeNode } from './layout-tree';
import { viewportSize } from './lib/viewport';
import {
  connectedPickableElement,
  hasUsableAiId,
  resolveStrictPointHitFromMouseEvent,
  targetReferenceForElement,
} from './local-picker';
import { hideOverlay, showOverlay } from './overlay';
import {
  hideQuickActionToolbar,
  isPointInQuickActionToolbarTransitionCorridor,
  isQuickActionToolbarElement,
  requestQuickActionToolbarHide,
  showQuickActionToolbar,
} from './quick-action-toolbar';

export type BridgePost = (message: BridgeToEditorMessage) => void;

interface HighlightRefreshOptions {
  force?: boolean;
  bypassPin?: boolean;
}

interface MousePosition {
  clientX: number;
  clientY: number;
  screenX: number;
  screenY: number;
}

let highlightedElement: Element | null = null;
let highlightedNodeId: string | null = null;
let highlightedTarget: EditorTarget | null = null;
let highlightedOrigin: HighlightOrigin | null = null;
let pinnedElement: Element | null = null;
let hoverHighlightSuppressed = false;
let keyboardNavigationHoverSuppressed = false;
let lastMousePosition: MousePosition | null = null;
let suppressionStartPosition: MousePosition | null = null;

const DEFAULT_QUICK_ACTION_CATEGORIES: QuickActionCategory[] = [
  'content',
  'layout',
  'spacing',
  'size',
  'style',
  'border',
];

export function installHoverHighlight(post: BridgePost): () => void {
  const handleMouseOver = (event: MouseEvent): void => {
    if (isHoverHighlightSuppressed()) {
      return;
    }

    if (isQuickActionToolbarEvent(event)) {
      return;
    }

    setHighlightedElement(resolvePreviewHighlightElement(event), post, 'preview');
  };

  const handleMouseOut = (event: MouseEvent): void => {
    if (isHoverHighlightSuppressed()) {
      return;
    }

    if (isQuickActionToolbarEvent(event)) {
      return;
    }

    if (event.relatedTarget === null) {
      setHighlightedElement(null, post, 'preview');
    }
  };

  const handleMouseMove = (event: MouseEvent): void => {
    const position = mousePositionForEvent(event);
    const releasedKeyboardSuppression = keyboardNavigationHoverSuppressed
      && hasMouseMovedFromSuppressionStart(event, position);

    if (releasedKeyboardSuppression) {
      keyboardNavigationHoverSuppressed = false;
      suppressionStartPosition = null;
    } else if (keyboardNavigationHoverSuppressed && !suppressionStartPosition) {
      suppressionStartPosition = position;
    }

    lastMousePosition = position;

    if (isQuickActionToolbarEvent(event)) {
      return;
    }

    if (!releasedKeyboardSuppression || isHoverHighlightSuppressed()) {
      return;
    }

    setHighlightedElement(resolvePreviewHighlightElement(event), post, 'preview');
  };

  const handleBlur = (): void => {
    if (isHoverHighlightSuppressed()) {
      return;
    }

    setHighlightedElement(null, post, 'preview');
  };

  const handleClick = (event: MouseEvent): void => {
    if (event.button !== 0 || isQuickActionToolbarElement(event.target)) {
      return;
    }

    const element = resolvePreviewHighlightElement(event);
    if (!element) {
      return;
    }

    consumeMouseEvent(event);
    pinQuickActionToolbar(element, post);
  };

  document.addEventListener('mouseover', handleMouseOver, { capture: true, passive: true });
  document.addEventListener('mouseout', handleMouseOut, { capture: true, passive: true });
  document.addEventListener('mousemove', handleMouseMove, { capture: true, passive: true });
  document.addEventListener('click', handleClick, true);
  window.addEventListener('blur', handleBlur, { passive: true });

  return () => {
    document.removeEventListener('mouseover', handleMouseOver, true);
    document.removeEventListener('mouseout', handleMouseOut, true);
    document.removeEventListener('mousemove', handleMouseMove, true);
    document.removeEventListener('click', handleClick, true);
    window.removeEventListener('blur', handleBlur);
    pinnedElement = null;
    hoverHighlightSuppressed = false;
    keyboardNavigationHoverSuppressed = false;
    lastMousePosition = null;
    suppressionStartPosition = null;
  };
}

export function getHighlightedElement(): Element | null {
  return connectedPickableElement(highlightedElement);
}

export function clearHighlightedElement(post: BridgePost): void {
  pinnedElement = null;
  setHighlightedElement(null, post, 'preview', { bypassPin: true });
}

export function clearQuickActionSelection(post: BridgePost): void {
  pinnedElement = null;
  hideQuickActionToolbar();
  post({
    type: EDITOR_MESSAGE_TYPES.quickActionAnchorChanged,
    target: null,
    nodeId: null,
    elementRect: null,
    viewport: viewportSize(),
    availableCategories: DEFAULT_QUICK_ACTION_CATEGORIES,
    reason: 'cleared',
  });
}

export function setHoverHighlightSuppressed(suppressed: boolean): void {
  hoverHighlightSuppressed = suppressed;
}

export function suppressHoverHighlightUntilMouseMove(): void {
  keyboardNavigationHoverSuppressed = true;
  suppressionStartPosition = lastMousePosition;
}

export function refreshHighlightedElement(post: BridgePost, options: HighlightRefreshOptions = {}): void {
  setHighlightedElement(getHighlightedElement(), post, highlightedOrigin ?? 'preview', options);
}

export function handleHoverTreeNode(nodeId: string | null, post: BridgePost): void {
  if (!nodeId) {
    setHighlightedElement(null, post, 'layout-tree');
    return;
  }

  const element = resolveTreeNode(nodeId);
  setHighlightedElement(element, post, 'layout-tree');
}

export function revealTreeNode(nodeId: string, post: BridgePost): void {
  const element = resolveTreeNode(nodeId);
  if (!element) {
    post({
      type: EDITOR_MESSAGE_TYPES.targetReferenceRejected,
      reason: 'stale-fallback-target',
    });
    return;
  }

  element.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'center' });
  setHighlightedElement(element, post, 'layout-tree');
}

export function requestHighlightedTargetReference(post: BridgePost): boolean {
  const element = getHighlightedElement();
  if (!element) {
    return false;
  }

  const reference = targetReferenceForElement(element);
  if (!reference?.target) {
    post({
      type: EDITOR_MESSAGE_TYPES.targetReferenceRejected,
      reason: hasUsableAiId(element) ? 'missing-data-ai-id' : 'stale-fallback-target',
    });
    return true;
  }

  post({
    type: EDITOR_MESSAGE_TYPES.targetReferenceRequested,
    target: reference.target,
    nodeId: reference.nodeId,
    elementRect: reference.elementRect,
    viewport: reference.viewport,
  });
  return true;
}

export function setHighlightedElement(
  element: Element | null,
  post: BridgePost,
  origin: HighlightOrigin = 'preview',
  options: HighlightRefreshOptions = {},
): void {
  const nextElement = connectedPickableElement(element);
  const activePinnedElement = getPinnedElement();
  const shouldSyncQuickActionAnchor = !activePinnedElement
    || options.bypassPin
    || nextElement === activePinnedElement;

  const nextReference = nextElement ? targetReferenceForElement(nextElement) : null;
  const nextNodeId = nextReference?.nodeId ?? null;
  const nextTarget = nextReference?.target ?? null;

  if (!options.force
    && highlightedElement === nextElement
    && highlightedNodeId === nextNodeId
    && hasSameEditorTarget(highlightedTarget, nextTarget)
    && highlightedOrigin === origin
  ) {
    return;
  }

  highlightedElement = nextElement;
  highlightedNodeId = nextNodeId;
  highlightedTarget = nextTarget;
  highlightedOrigin = origin;
  updateHoverOverlay();
  const elementRect = nextReference?.elementRect ?? null;
  const viewport = nextReference?.viewport ?? viewportSize();

  post({
    type: EDITOR_MESSAGE_TYPES.targetHighlighted,
    target: nextTarget,
    nodeId: nextNodeId,
    origin,
    elementRect,
    viewport,
  });

  if (!shouldSyncQuickActionAnchor) {
    return;
  }

  post({
    type: EDITOR_MESSAGE_TYPES.quickActionAnchorChanged,
    target: nextTarget,
    nodeId: nextNodeId,
    elementRect,
    viewport,
    availableCategories: DEFAULT_QUICK_ACTION_CATEGORIES,
    reason: quickActionAnchorReason(nextElement, origin),
  });

  if (nextElement && nextTarget) {
    showQuickActionToolbar({
      target: nextTarget,
      nodeId: nextNodeId,
      element: nextElement,
      availableCategories: DEFAULT_QUICK_ACTION_CATEGORIES,
      post,
    });
    return;
  }

  requestQuickActionToolbarHide();
}

function pinQuickActionToolbar(element: Element, post: BridgePost): void {
  const nextElement = connectedPickableElement(element);
  const nextReference = nextElement ? targetReferenceForElement(nextElement) : null;
  if (!nextElement || !nextReference?.target) {
    return;
  }

  pinnedElement = nextElement;
  setHighlightedElement(nextElement, post, 'preview', {
    bypassPin: true,
    force: true,
  });
}

function getPinnedElement(): Element | null {
  const connected = connectedPickableElement(pinnedElement);
  if (connected !== pinnedElement) {
    pinnedElement = null;
  }

  return connected;
}

function resolvePreviewHighlightElement(event: MouseEvent): Element | null {
  if (isQuickActionToolbarEvent(event)) {
    return getHighlightedElement();
  }

  return resolveStrictPointHitFromMouseEvent(event)?.element ?? null;
}

function isQuickActionToolbarEvent(event: MouseEvent): boolean {
  return isQuickActionToolbarElement(event.target)
    || isQuickActionToolbarElement(event.relatedTarget)
    || isPointInQuickActionToolbarTransitionCorridor(event.clientX, event.clientY);
}

function updateHoverOverlay(): void {
  const element = getHighlightedElement();
  if (!element) {
    hideOverlay('hover');
    return;
  }

  showOverlay('hover', element);
}

function quickActionAnchorReason(
  element: Element | null,
  origin: HighlightOrigin,
): 'hover' | 'tree-hover' | 'cleared' {
  if (!element) {
    return 'cleared';
  }

  return origin === 'layout-tree' ? 'tree-hover' : 'hover';
}

function isHoverHighlightSuppressed(): boolean {
  return hoverHighlightSuppressed || keyboardNavigationHoverSuppressed;
}

function hasMouseMovedFromSuppressionStart(event: MouseEvent, position: MousePosition): boolean {
  if (!suppressionStartPosition) {
    return event.movementX !== 0 || event.movementY !== 0;
  }

  return position.clientX !== suppressionStartPosition.clientX
    || position.clientY !== suppressionStartPosition.clientY
    || position.screenX !== suppressionStartPosition.screenX
    || position.screenY !== suppressionStartPosition.screenY;
}

function mousePositionForEvent(event: MouseEvent): MousePosition {
  return {
    clientX: event.clientX,
    clientY: event.clientY,
    screenX: event.screenX,
    screenY: event.screenY,
  };
}

function consumeMouseEvent(event: MouseEvent): void {
  event.preventDefault();
  event.stopPropagation();
  event.stopImmediatePropagation();
}
