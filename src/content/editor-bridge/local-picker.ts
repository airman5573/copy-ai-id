import { DATA_AI_ID_ATTRIBUTE, isExtensionOwnedElement } from '../../shared/config';
import type {
  BridgeViewportRect,
  BridgeViewportSize,
  EditorTarget,
} from '../../shared/editor-messages';
import { getComposedElementsFromPoint } from '../target/composed-dom';
import {
  viewportRectForElement,
  viewportSize,
} from './lib/viewport';
import { fallbackTargetForElement } from './fallback-target';
import { instancesOf, resolveNodeIdForElement } from './layout-tree';

export type LocalHitTestSource = 'point' | 'composed-path' | 'event-target';

export interface LocalHitTestResult {
  element: Element;
  source: LocalHitTestSource;
  stack: Element[];
}

export interface LocalTargetReference {
  element: Element;
  target: EditorTarget | null;
  nodeId: string | null;
  elementRect: BridgeViewportRect;
  viewport: BridgeViewportSize;
}

export function resolveStrictPointHitFromMouseEvent(event: MouseEvent): LocalHitTestResult | null {
  const pointStack = getComposedElementsFromPoint(event.clientX, event.clientY);
  const pointElement = firstPickableElement(pointStack);
  if (pointElement) {
    return {
      element: pointElement,
      source: 'point',
      stack: pointStack,
    };
  }

  const pathElement = firstElementFromComposedPath(event);
  if (pathElement) {
    return {
      element: pathElement,
      source: 'composed-path',
      stack: pointStack,
    };
  }

  const targetElement = event.target instanceof Element
    ? connectedPickableElement(event.target)
    : null;
  return targetElement
    ? {
      element: targetElement,
      source: 'event-target',
      stack: pointStack,
    }
    : null;
}

export function connectedPickableElement(element: Element | null): Element | null {
  if (!element || !element.isConnected || isExtensionOwnedElement(element)) {
    return null;
  }

  return element;
}

export function targetForElement(element: Element): EditorTarget | null {
  const connected = connectedPickableElement(element);
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

export function targetReferenceForElement(element: Element): LocalTargetReference | null {
  const connected = connectedPickableElement(element);
  if (!connected) {
    return null;
  }

  return {
    element: connected,
    target: targetForElement(connected),
    nodeId: resolveNodeIdForElement(connected),
    elementRect: viewportRectForElement(connected),
    viewport: viewportSize(),
  };
}

export function hasUsableAiId(element: Element): boolean {
  return (element.getAttribute(DATA_AI_ID_ATTRIBUTE)?.trim() ?? '').length > 0;
}

function firstPickableElement(elements: Element[]): Element | null {
  for (const element of elements) {
    const connected = connectedPickableElement(element);
    if (connected) {
      return connected;
    }
  }

  return null;
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
      const connected = connectedPickableElement(target);
      if (connected) {
        return connected;
      }
    }
  }

  return null;
}
