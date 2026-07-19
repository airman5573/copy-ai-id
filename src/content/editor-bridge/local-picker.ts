import { DATA_AI_ID_ATTRIBUTE, isExtensionOwnedElement } from '../../shared/config';
import type {
  BridgeViewportRect,
  BridgeViewportSize,
} from '../../shared/domain/geometry';
import type { EditorTarget } from '../../shared/domain/targets';
import {
  closestComposedElementMatching,
  getComposedChildElements,
  getComposedElementsFromPoint,
} from '../target/composed-dom';
import { editorTargetForElement } from './editor-target';
import {
  viewportRectForElement,
  viewportSize,
} from './lib/viewport';
import { buildLayoutTreeSnapshot, resolveNodeIdForElement } from './layout-tree';

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

// Pointer picks follow the Chrome DevTools Inspect policy: the raw hit under
// the pointer promotes upward through the composed tree to the NEAREST
// selectable element. Tagged (data-ai-id) elements always qualify; untagged
// elements must pass a significance check so trivial wrappers, zero-size
// nodes and SVG internals promote to a meaningful ancestor instead.
export function resolveStrictPointHitFromMouseEvent(event: MouseEvent): LocalHitTestResult | null {
  const pointStack = getComposedElementsFromPoint(event.clientX, event.clientY);
  const pointElement = closestSelectableElement(firstPickableElement(pointStack));
  if (pointElement) {
    return {
      element: pointElement,
      source: 'point',
      stack: pointStack,
    };
  }

  const pathElement = closestSelectableElement(firstElementFromComposedPath(event));
  if (pathElement) {
    return {
      element: pathElement,
      source: 'composed-path',
      stack: pointStack,
    };
  }

  const targetElement = event.target instanceof Element
    ? closestSelectableElement(connectedPickableElement(event.target))
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
  return connected ? editorTargetForElement(connected) : null;
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

// For explicit actions (Space reference request, click pin) only: a connected
// fallback element resolves without a target when the layout-tree registry
// predates it (the page re-rendered and replaced the node after the last
// snapshot), so rebuild the registry once and retry. Passive hover/reposition
// paths stay on targetReferenceForElement and never pay the full-tree rebuild.
export function targetReferenceWithRegistryRefresh(element: Element): LocalTargetReference | null {
  const reference = targetReferenceForElement(element);
  if (!reference || reference.target) {
    return reference;
  }

  buildLayoutTreeSnapshot();
  return targetReferenceForElement(element);
}

export function hasUsableAiId(element: Element): boolean {
  return (element.getAttribute(DATA_AI_ID_ATTRIBUTE)?.trim() ?? '').length > 0;
}

/** Tags that are never pointer-selectable, tagged or not. */
const NEVER_SELECTABLE_TAGS = new Set([
  'html',
  'body',
  'head',
  'script',
  'style',
  'link',
  'meta',
  'template',
  'noscript',
  'br',
  'wbr',
]);

/** SVG-internal tags are never candidates themselves — the upward walk promotes to the nearest svg ancestor. */
const SVG_INTERNAL_TAGS = new Set(['path', 'g', 'rect', 'circle', 'line', 'polygon', 'polyline', 'use', 'defs']);

/** Untagged elements of these tags are significant even without children/text. */
const SIGNIFICANT_TAGS = new Set([
  'img',
  'picture',
  'video',
  'svg',
  'button',
  'a',
  'input',
  'select',
  'textarea',
  'ul',
  'ol',
  'li',
  'table',
  'section',
  'article',
  'header',
  'footer',
  'nav',
  'aside',
  'figure',
  'h1',
  'h2',
  'h3',
  'h4',
  'h5',
  'h6',
  'p',
  'blockquote',
]);

/**
 * Relaxed eligibility for pointer picks and keyboard traversal: tagged
 * (data-ai-id) elements always qualify; untagged elements additionally pass a
 * significance check so trivial wrappers and zero-size nodes are skipped.
 */
export function isSelectableElement(element: Element): boolean {
  if (!element.isConnected || isExtensionOwnedElement(element)) {
    return false;
  }

  const tag = element.tagName.toLowerCase();
  if (NEVER_SELECTABLE_TAGS.has(tag)) {
    return false;
  }

  if (hasUsableAiId(element)) {
    return true;
  }

  if (SVG_INTERNAL_TAGS.has(tag)) {
    return false;
  }

  const rect = element.getBoundingClientRect();
  if (rect.width * rect.height <= 1) {
    return false;
  }

  return getComposedChildElements(element).length >= 1
    || (element.textContent ?? '').trim().length >= 4
    || SIGNIFICANT_TAGS.has(tag);
}

export function closestSelectableElement(element: Element | null): Element | null {
  return element ? closestComposedElementMatching(element, isSelectableElement) : null;
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
