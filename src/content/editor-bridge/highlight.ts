import {
  type EditorTarget,
  type HighlightOrigin,
} from '../../shared/domain/targets';
import { type QuickActionCategory } from '../../shared/domain/visual';
import { EDITOR_MESSAGE_TYPES } from '../../shared/protocol/editor-bridge-messages';
import { hasSameEditorTarget } from '../../shared/editor-targets';
import type { BridgePost } from './types';
import { classifyElementIntents } from './element-intent';
import { resolveTreeNode } from './layout-tree';
import { viewportSize } from './lib/viewport';
import {
  connectedPickableElement,
  hasUsableAiId,
  type LocalTargetReference,
  resolveStrictPointHitFromMouseEvent,
  targetReferenceForElement,
} from './local-picker';
import { hideOverlay, showOverlay } from './overlay';
import {
  hideQuickActionToolbar,
  isQuickActionToolbarElement,
  showQuickActionToolbar,
} from './quick-action-toolbar';

interface HighlightRefreshOptions {
  force?: boolean;
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
let inlineTextEditSuppressed = false;
let lastMousePosition: MousePosition | null = null;
let suppressionStartPosition: MousePosition | null = null;
let pinnedAnchorRafHandle: number | null = null;
let stopPinnedAnchorTracking: (() => void) | null = null;

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
    if (isHoverHighlightSuppressed() || isQuickActionToolbarElement(event.target)) {
      return;
    }

    setHighlightedElement(resolvePreviewHighlightElement(event), post, 'preview');
  };

  const handleMouseOut = (event: MouseEvent): void => {
    if (isHoverHighlightSuppressed() || isQuickActionToolbarElement(event.target)) {
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

    if (isQuickActionToolbarElement(event.target)) {
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
    if (event.button !== 0 || inlineTextEditSuppressed || isQuickActionToolbarElement(event.target)) {
      return;
    }

    const element = resolvePreviewHighlightElement(event);
    if (element && !isEmptyAreaElement(element)) {
      consumeMouseEvent(event);
      pinQuickActionToolbar(element, post);
      return;
    }

    if (pinnedElement) {
      consumeMouseEvent(event);
      clearQuickActionSelection(post);
    }
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
    endPinnedAnchorTracking();
    pinnedElement = null;
    hoverHighlightSuppressed = false;
    keyboardNavigationHoverSuppressed = false;
    inlineTextEditSuppressed = false;
    lastMousePosition = null;
    suppressionStartPosition = null;
  };
}

export function getHighlightedElement(): Element | null {
  return connectedPickableElement(highlightedElement);
}

export function clearHighlightedElement(post: BridgePost): void {
  setHighlightedElement(null, post, 'preview');
}

export function clearQuickActionSelection(post: BridgePost): void {
  pinnedElement = null;
  endPinnedAnchorTracking();
  hideQuickActionToolbar();
  post({
    type: EDITOR_MESSAGE_TYPES.quickActionAnchorChanged,
    target: null,
    nodeId: null,
    elementRect: null,
    viewport: viewportSize(),
    availableCategories: DEFAULT_QUICK_ACTION_CATEGORIES,
    intents: [],
    reason: 'cleared',
  });
}

export function setHoverHighlightSuppressed(suppressed: boolean): void {
  hoverHighlightSuppressed = suppressed;
}

// While a preview inline text edit is active, hover highlighting and click
// pinning must not fight the contenteditable session.
export function setInlineTextEditHighlightSuppressed(suppressed: boolean): void {
  inlineTextEditSuppressed = suppressed;
}

export function suppressHoverHighlightUntilMouseMove(): void {
  keyboardNavigationHoverSuppressed = true;
  suppressionStartPosition = lastMousePosition;
}

export function refreshHighlightedElement(post: BridgePost, options: HighlightRefreshOptions = {}): void {
  setHighlightedElement(getHighlightedElement(), post, highlightedOrigin ?? 'preview', options);
  refreshPinnedQuickActionToolbar(post);
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

  post({
    type: EDITOR_MESSAGE_TYPES.targetHighlighted,
    target: nextTarget,
    nodeId: nextNodeId,
    origin,
    elementRect: nextReference?.elementRect ?? null,
    viewport: nextReference?.viewport ?? viewportSize(),
  });
}

// The quick-action toolbar is pinned by click only; hover just highlights.
function pinQuickActionToolbar(element: Element, post: BridgePost): void {
  const reference = targetReferenceForElement(element);
  if (!reference?.target) {
    return;
  }

  pinnedElement = reference.element;
  setHighlightedElement(reference.element, post, 'preview', { force: true });
  syncPinnedQuickActionToolbar(reference, post);
  beginPinnedAnchorTracking(post);
}

function refreshPinnedQuickActionToolbar(post: BridgePost): void {
  if (!pinnedElement) {
    return;
  }

  const connected = connectedPickableElement(pinnedElement);
  const reference = connected ? targetReferenceForElement(connected) : null;
  if (!reference?.target) {
    clearQuickActionSelection(post);
    return;
  }

  syncPinnedQuickActionToolbar(reference, post);
}

function syncPinnedQuickActionToolbar(reference: LocalTargetReference, post: BridgePost): void {
  const target = reference.target;
  if (!target) {
    return;
  }

  post({
    type: EDITOR_MESSAGE_TYPES.quickActionAnchorChanged,
    target,
    nodeId: reference.nodeId,
    elementRect: reference.elementRect,
    viewport: reference.viewport,
    availableCategories: DEFAULT_QUICK_ACTION_CATEGORIES,
    intents: classifyElementIntents(reference.element),
    reason: 'pinned',
  });

  showQuickActionToolbar({
    target,
    nodeId: reference.nodeId,
    element: reference.element,
    availableCategories: DEFAULT_QUICK_ACTION_CATEGORIES,
    post,
  });
}

// While an element is pinned, preview scroll/resize would let the editor-side
// toolbar drift away from its anchor. Stream fresh rects (rAF-throttled) with
// reason 'repositioned' so the editor can follow; snapshots are not re-requested.
function beginPinnedAnchorTracking(post: BridgePost): void {
  if (stopPinnedAnchorTracking) {
    return;
  }

  const schedule = (): void => {
    if (pinnedAnchorRafHandle !== null) {
      return;
    }

    pinnedAnchorRafHandle = window.requestAnimationFrame(() => {
      pinnedAnchorRafHandle = null;
      postRepositionedAnchor(post);
    });
  };

  window.addEventListener('scroll', schedule, { capture: true, passive: true });
  window.addEventListener('resize', schedule, { passive: true });

  stopPinnedAnchorTracking = () => {
    window.removeEventListener('scroll', schedule, true);
    window.removeEventListener('resize', schedule);
    if (pinnedAnchorRafHandle !== null) {
      window.cancelAnimationFrame(pinnedAnchorRafHandle);
      pinnedAnchorRafHandle = null;
    }
  };
}

function endPinnedAnchorTracking(): void {
  stopPinnedAnchorTracking?.();
  stopPinnedAnchorTracking = null;
}

function postRepositionedAnchor(post: BridgePost): void {
  if (!pinnedElement) {
    return;
  }

  const connected = connectedPickableElement(pinnedElement);
  const reference = connected ? targetReferenceForElement(connected) : null;
  if (!connected || !reference?.target) {
    clearQuickActionSelection(post);
    return;
  }

  post({
    type: EDITOR_MESSAGE_TYPES.quickActionAnchorChanged,
    target: reference.target,
    nodeId: reference.nodeId,
    elementRect: reference.elementRect,
    viewport: reference.viewport,
    availableCategories: DEFAULT_QUICK_ACTION_CATEGORIES,
    intents: classifyElementIntents(connected),
    reason: 'repositioned',
  });
}

function resolvePreviewHighlightElement(event: MouseEvent): Element | null {
  return resolveStrictPointHitFromMouseEvent(event)?.element ?? null;
}

// A click that resolves to the document background dismisses the pinned
// toolbar instead of pinning the whole page.
function isEmptyAreaElement(element: Element): boolean {
  return element === element.ownerDocument.documentElement
    || element === element.ownerDocument.body;
}

function updateHoverOverlay(): void {
  const element = getHighlightedElement();
  if (!element) {
    hideOverlay('hover');
    return;
  }

  showOverlay('hover', element);
}

function isHoverHighlightSuppressed(): boolean {
  return hoverHighlightSuppressed || keyboardNavigationHoverSuppressed || inlineTextEditSuppressed;
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
