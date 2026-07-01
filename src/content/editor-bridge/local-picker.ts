import { DATA_AI_ID_ATTRIBUTE, isExtensionOwnedElement } from '../../shared/config';
import type {
  BridgeViewportRect,
  BridgeViewportSize,
  EditorTarget,
} from '../../shared/editor-messages';
import { getComposedElementsFromPoint } from '../target/composed-dom';
import { fallbackTargetForElement } from './fallback-target';
import { instancesOf, resolveNodeIdForElement } from './layout-tree';

export interface LocalPoint {
  x: number;
  y: number;
}

export type LocalQuad = [LocalPoint, LocalPoint, LocalPoint, LocalPoint];

export interface LocalBoxModel {
  content: LocalQuad[];
  padding: LocalQuad[];
  border: LocalQuad[];
  margin: LocalQuad[];
}

export interface LocalHighlightConfig {
  showInfo?: boolean;
  contentColor?: string;
  paddingColor?: string;
  borderColor?: string;
  marginColor?: string;
}

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

export function localBoxModelForElement(element: Element): LocalBoxModel | null {
  const connected = connectedPickableElement(element);
  if (!connected) {
    return null;
  }

  const bounding = connected.getBoundingClientRect();
  if (bounding.width <= 0 || bounding.height <= 0) {
    return null;
  }

  const style = window.getComputedStyle(connected);
  const margin = {
    top: Math.max(0, pxToNumber(style.marginTop)),
    right: Math.max(0, pxToNumber(style.marginRight)),
    bottom: Math.max(0, pxToNumber(style.marginBottom)),
    left: Math.max(0, pxToNumber(style.marginLeft)),
  };
  const border = {
    top: pxToNumber(style.borderTopWidth),
    right: pxToNumber(style.borderRightWidth),
    bottom: pxToNumber(style.borderBottomWidth),
    left: pxToNumber(style.borderLeftWidth),
  };
  const padding = {
    top: pxToNumber(style.paddingTop),
    right: pxToNumber(style.paddingRight),
    bottom: pxToNumber(style.paddingBottom),
    left: pxToNumber(style.paddingLeft),
  };

  const borderBox = rectFromDomRect(bounding);
  const marginBox = {
    left: borderBox.left - margin.left,
    top: borderBox.top - margin.top,
    width: borderBox.width + margin.left + margin.right,
    height: borderBox.height + margin.top + margin.bottom,
  };
  const paddingBox = insetRect(borderBox, border);
  const contentBox = insetRect(paddingBox, padding);

  return {
    content: rectToQuads(contentBox),
    padding: ringToQuads(paddingBox, contentBox),
    border: ringToQuads(borderBox, paddingBox),
    margin: ringToQuads(marginBox, borderBox),
  };
}

export function hasUsableAiId(element: Element): boolean {
  return (element.getAttribute(DATA_AI_ID_ATTRIBUTE)?.trim() ?? '').length > 0;
}

export function viewportRectForElement(element: Element): BridgeViewportRect {
  const rect = element.getBoundingClientRect();

  return {
    x: rect.left,
    y: rect.top,
    left: rect.left,
    top: rect.top,
    right: rect.right,
    bottom: rect.bottom,
    width: rect.width,
    height: rect.height,
  };
}

export function viewportSize(): BridgeViewportSize {
  return {
    width: window.innerWidth,
    height: window.innerHeight,
  };
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

interface LocalRect {
  left: number;
  top: number;
  width: number;
  height: number;
}

interface BoxEdges {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

function rectFromDomRect(rect: DOMRect): LocalRect {
  return {
    left: rect.left,
    top: rect.top,
    width: rect.width,
    height: rect.height,
  };
}

function rectToQuads(rect: LocalRect): LocalQuad[] {
  return rect.width > 0 && rect.height > 0 ? [rectToQuad(rect)] : [];
}

function rectToQuad(rect: LocalRect): LocalQuad {
  const right = rect.left + rect.width;
  const bottom = rect.top + rect.height;
  return [
    { x: rect.left, y: rect.top },
    { x: right, y: rect.top },
    { x: right, y: bottom },
    { x: rect.left, y: bottom },
  ];
}

function ringToQuads(outer: LocalRect, inner: LocalRect): LocalQuad[] {
  return [
    {
      left: outer.left,
      top: outer.top,
      width: outer.width,
      height: Math.max(0, inner.top - outer.top),
    },
    {
      left: outer.left,
      top: inner.top + inner.height,
      width: outer.width,
      height: Math.max(0, outer.top + outer.height - (inner.top + inner.height)),
    },
    {
      left: outer.left,
      top: inner.top,
      width: Math.max(0, inner.left - outer.left),
      height: inner.height,
    },
    {
      left: inner.left + inner.width,
      top: inner.top,
      width: Math.max(0, outer.left + outer.width - (inner.left + inner.width)),
      height: inner.height,
    },
  ].flatMap(rectToQuads);
}

function insetRect(rect: LocalRect, edges: BoxEdges): LocalRect {
  const left = rect.left + edges.left;
  const top = rect.top + edges.top;
  const right = rect.left + rect.width - edges.right;
  const bottom = rect.top + rect.height - edges.bottom;

  return {
    left,
    top,
    width: Math.max(0, right - left),
    height: Math.max(0, bottom - top),
  };
}

function pxToNumber(value: string): number {
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : 0;
}
