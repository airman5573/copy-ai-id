import { DATA_AI_ID_ATTRIBUTE, isExtensionOwnedElement } from '../../shared/config';
import {
  EDITOR_MESSAGE_TYPES,
  type BridgeToEditorMessage,
  type EditorTarget,
  type HighlightOrigin,
} from '../../shared/editor-messages';
import { hasSameEditorTarget } from '../../shared/editor-targets';
import {
  instancesOf,
  resolveNodeIdForElement,
  resolveTreeNode,
} from './layout-tree';
import {
  closestComposedElementMatching,
  getDeepElementFromPoint,
} from '../target/composed-dom';
import { fallbackTargetForElement } from './fallback-target';
import { hideOverlay, showOverlay } from './overlay';

export type BridgePost = (message: BridgeToEditorMessage) => void;

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
let hoverHighlightSuppressed = false;
let keyboardNavigationHoverSuppressed = false;
let lastMousePosition: MousePosition | null = null;
let suppressionStartPosition: MousePosition | null = null;

export function installHoverHighlight(post: BridgePost): () => void {
  const handleMouseOver = (event: MouseEvent): void => {
    if (isHoverHighlightSuppressed()) {
      return;
    }

    setHighlightedElement(resolvePreviewHighlightElement(event), post, 'preview');
  };

  const handleMouseOut = (event: MouseEvent): void => {
    if (isHoverHighlightSuppressed()) {
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

  document.addEventListener('mouseover', handleMouseOver, { capture: true, passive: true });
  document.addEventListener('mouseout', handleMouseOut, { capture: true, passive: true });
  document.addEventListener('mousemove', handleMouseMove, { capture: true, passive: true });
  window.addEventListener('blur', handleBlur, { passive: true });

  return () => {
    document.removeEventListener('mouseover', handleMouseOver, true);
    document.removeEventListener('mouseout', handleMouseOut, true);
    document.removeEventListener('mousemove', handleMouseMove, true);
    window.removeEventListener('blur', handleBlur);
    hoverHighlightSuppressed = false;
    keyboardNavigationHoverSuppressed = false;
    lastMousePosition = null;
    suppressionStartPosition = null;
  };
}

export function getHighlightedElement(): Element | null {
  return connectedHighlightElement(highlightedElement);
}

export function clearHighlightedElement(post: BridgePost): void {
  setHighlightedElement(null, post, 'preview');
}

export function setHoverHighlightSuppressed(suppressed: boolean): void {
  hoverHighlightSuppressed = suppressed;
}

export function suppressHoverHighlightUntilMouseMove(): void {
  keyboardNavigationHoverSuppressed = true;
  suppressionStartPosition = lastMousePosition;
}

export function refreshHighlightedElement(post: BridgePost): void {
  setHighlightedElement(getHighlightedElement(), post, highlightedOrigin ?? 'preview');
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

  const target = targetForElement(element);
  if (!target) {
    post({
      type: EDITOR_MESSAGE_TYPES.targetReferenceRejected,
      reason: hasUsableAiId(element) ? 'missing-data-ai-id' : 'stale-fallback-target',
    });
    return true;
  }

  post({
    type: EDITOR_MESSAGE_TYPES.targetReferenceRequested,
    target,
    nodeId: resolveNodeIdForElement(element),
  });
  return true;
}

export function setHighlightedElement(
  element: Element | null,
  post: BridgePost,
  origin: HighlightOrigin = 'preview',
): void {
  const nextElement = connectedHighlightElement(element);
  const nextNodeId = nextElement ? resolveNodeIdForElement(nextElement) : null;
  const nextTarget = nextElement ? targetForElement(nextElement) : null;

  if (
    highlightedElement === nextElement
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
  });
}

export function closestAiIdElement(start: Element): Element | null {
  const element = closestComposedElementMatching(start, hasUsableAiId);
  return connectedAiIdElement(element);
}

function connectedAiIdElement(element: Element | null): Element | null {
  const connected = connectedHighlightElement(element);
  if (!connected) {
    return null;
  }

  const aiId = connected.getAttribute(DATA_AI_ID_ATTRIBUTE)?.trim() ?? '';
  return aiId ? connected : null;
}

function connectedHighlightElement(element: Element | null): Element | null {
  if (!element || !element.isConnected || isExtensionOwnedElement(element)) {
    return null;
  }

  return element;
}

function targetForElement(element: Element): EditorTarget | null {
  const connected = connectedHighlightElement(element);
  if (!connected) {
    return null;
  }

  const aiId = connected.getAttribute(DATA_AI_ID_ATTRIBUTE)?.trim() ?? '';
  if (!aiId) {
    return fallbackTargetForElement(connected, resolveNodeIdForElement(connected));
  }

  return {
    kind: 'ai-id',
    aiId,
    instanceIndex: Math.max(0, instancesOf(aiId).indexOf(connected)),
  };
}

function resolvePreviewHighlightElement(event: MouseEvent): Element | null {
  const deepestElement = deepestElementForMouseEvent(event);
  const aiIdElement = deepestElement ? closestAiIdElement(deepestElement) : null;
  return aiIdElement ?? connectedHighlightElement(deepestElement);
}

function deepestElementForMouseEvent(event: MouseEvent): Element | null {
  const deepElement = connectedHighlightElement(getDeepElementFromPoint(event.clientX, event.clientY));
  if (deepElement) {
    return deepElement;
  }

  const pathElement = firstElementFromComposedPath(event);
  if (pathElement) {
    return pathElement;
  }

  return event.target instanceof Element ? connectedHighlightElement(event.target) : null;
}

function firstElementFromComposedPath(event: MouseEvent): Element | null {
  if (typeof event.composedPath !== 'function') {
    return null;
  }

  for (const target of event.composedPath()) {
    if (target instanceof Document || target instanceof Window) {
      return null;
    }

    if (target instanceof Element) {
      const connected = connectedHighlightElement(target);
      if (connected) {
        return connected;
      }
    }
  }

  return null;
}

function hasUsableAiId(element: Element): boolean {
  return (element.getAttribute(DATA_AI_ID_ATTRIBUTE)?.trim() ?? '').length > 0;
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
