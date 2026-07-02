import type {
  BridgeViewportRect,
  BridgeViewportSize,
} from '../../../shared/domain/geometry';

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
    width: window.visualViewport?.width ?? window.innerWidth,
    height: window.visualViewport?.height ?? window.innerHeight,
  };
}
