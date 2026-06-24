import type {
  BridgeViewportPoint,
  BridgeViewportRect,
} from '../../shared/editor-messages';

export type EditorViewportPoint = BridgeViewportPoint;
export type EditorViewportRect = BridgeViewportRect;

export type OverlayPlacementSide = 'above' | 'below' | 'left' | 'right';

export interface PreviewWorkspaceGeometryElements {
  stageElement: HTMLDivElement | null;
  canvasFrameElement: HTMLDivElement | null;
  canvasElement: HTMLDivElement | null;
}

export interface PreviewWorkspaceGeometrySnapshot {
  iframeRect: EditorViewportRect;
  iframeClientWidth: number;
  iframeClientHeight: number;
  scaleX: number;
  scaleY: number;
  stageRect: EditorViewportRect | null;
  canvasFrameRect: EditorViewportRect | null;
  canvasRect: EditorViewportRect | null;
  editorViewportRect: EditorViewportRect;
}

export interface OverlaySize {
  width: number;
  height: number;
}

export interface OverlayPlacementOptions {
  gap?: number;
  padding?: number;
  bounds?: EditorViewportRect | null;
}

export interface FloatingVisualPanelPlacementOptions extends OverlayPlacementOptions {
  mode?: 'target' | 'preview-side';
  previewSide?: 'auto' | 'left' | 'right';
}

export interface OverlayPlacement {
  left: number;
  top: number;
  width: number;
  height: number;
  side: OverlayPlacementSide;
  transformOrigin: string;
}

interface ResolvedOverlayPlacementOptions {
  gap: number;
  padding: number;
  bounds: EditorViewportRect;
}

const DEFAULT_OVERLAY_GAP = 8;
const DEFAULT_OVERLAY_PADDING = 12;

let previewFrame: HTMLIFrameElement | null = null;
let previewStageElement: HTMLDivElement | null = null;
let previewCanvasFrameElement: HTMLDivElement | null = null;
let previewCanvasElement: HTMLDivElement | null = null;

export function registerBridgeIframeElement(frame: HTMLIFrameElement | null): void {
  previewFrame = frame;
}

export function getBridgeIframeElement(): HTMLIFrameElement | null {
  return previewFrame;
}

export function registerPreviewWorkspaceGeometry(elements: PreviewWorkspaceGeometryElements): void {
  previewStageElement = elements.stageElement;
  previewCanvasFrameElement = elements.canvasFrameElement;
  previewCanvasElement = elements.canvasElement;
}

export function getPreviewWorkspaceGeometrySnapshot(): PreviewWorkspaceGeometrySnapshot | null {
  if (!previewFrame) {
    return null;
  }

  const iframeRect = domRectToEditorViewportRect(previewFrame.getBoundingClientRect());
  const iframeClientWidth = Math.max(1, previewFrame.clientWidth);
  const iframeClientHeight = Math.max(1, previewFrame.clientHeight);

  return {
    iframeRect,
    iframeClientWidth,
    iframeClientHeight,
    scaleX: iframeRect.width / iframeClientWidth,
    scaleY: iframeRect.height / iframeClientHeight,
    stageRect: previewStageElement
      ? domRectToEditorViewportRect(previewStageElement.getBoundingClientRect())
      : null,
    canvasFrameRect: previewCanvasFrameElement
      ? domRectToEditorViewportRect(previewCanvasFrameElement.getBoundingClientRect())
      : null,
    canvasRect: previewCanvasElement
      ? domRectToEditorViewportRect(previewCanvasElement.getBoundingClientRect())
      : null,
    editorViewportRect: getEditorViewportRect(),
  };
}

/**
 * Convert a rect measured in the preview iframe viewport into editor viewport
 * coordinates. The conversion intentionally uses the iframe element's rendered
 * DOMRect instead of only the zoom store so CSS transforms, fit zoom, scroll,
 * borders, and resize-handle offsets cannot drift from the actual iframe.
 */
export function bridgeViewportRectToEditorViewportRect(
  rect: BridgeViewportRect,
): EditorViewportRect | null {
  const geometry = getPreviewWorkspaceGeometrySnapshot();
  if (!geometry) {
    return null;
  }

  return createEditorViewportRect({
    left: geometry.iframeRect.left + (rect.left * geometry.scaleX),
    top: geometry.iframeRect.top + (rect.top * geometry.scaleY),
    width: rect.width * geometry.scaleX,
    height: rect.height * geometry.scaleY,
  });
}

export function bridgeViewportPointToEditorViewportPoint(
  point: BridgeViewportPoint,
): EditorViewportPoint | null {
  const geometry = getPreviewWorkspaceGeometrySnapshot();
  if (!geometry) {
    return null;
  }

  return {
    x: geometry.iframeRect.left + (point.x * geometry.scaleX),
    y: geometry.iframeRect.top + (point.y * geometry.scaleY),
  };
}

export function editorViewportPointToBridgeViewportPoint(
  point: EditorViewportPoint,
): BridgeViewportPoint | null {
  const geometry = getPreviewWorkspaceGeometrySnapshot();
  if (!geometry) {
    return null;
  }

  return {
    x: (point.x - geometry.iframeRect.left) / geometry.scaleX,
    y: (point.y - geometry.iframeRect.top) / geometry.scaleY,
  };
}

export function editorViewportRectToBridgeViewportRect(
  rect: EditorViewportRect,
): BridgeViewportRect | null {
  const geometry = getPreviewWorkspaceGeometrySnapshot();
  if (!geometry) {
    return null;
  }

  return createEditorViewportRect({
    left: (rect.left - geometry.iframeRect.left) / geometry.scaleX,
    top: (rect.top - geometry.iframeRect.top) / geometry.scaleY,
    width: rect.width / geometry.scaleX,
    height: rect.height / geometry.scaleY,
  });
}

export function getPreviewOverlayBounds(): EditorViewportRect {
  const geometry = getPreviewWorkspaceGeometrySnapshot();
  if (!geometry?.stageRect) {
    return getEditorViewportRect();
  }

  return intersectEditorViewportRects(geometry.stageRect, geometry.editorViewportRect)
    ?? geometry.editorViewportRect;
}

export function calculateFloatingVisualPanelPlacement(
  anchorRect: EditorViewportRect,
  size: OverlaySize,
  options: FloatingVisualPanelPlacementOptions = {},
): OverlayPlacement {
  const mode = options.mode ?? 'target';
  const gap = options.gap ?? DEFAULT_OVERLAY_GAP;
  const padding = options.padding ?? DEFAULT_OVERLAY_PADDING;
  const bounds = options.bounds ?? getPreviewOverlayBounds();

  if (mode === 'preview-side') {
    return calculatePreviewSidePlacement(anchorRect, size, {
      gap,
      padding,
      bounds,
      previewSide: options.previewSide ?? 'auto',
    });
  }

  return calculateVerticalAnchorPlacement(anchorRect, size, { gap, padding, bounds });
}

export function domRectToEditorViewportRect(rect: DOMRect | DOMRectReadOnly): EditorViewportRect {
  return createEditorViewportRect({
    left: rect.left,
    top: rect.top,
    width: rect.width,
    height: rect.height,
  });
}

export function createEditorViewportRect({
  left,
  top,
  width,
  height,
}: {
  left: number;
  top: number;
  width: number;
  height: number;
}): EditorViewportRect {
  const safeLeft = sanitizeNumber(left);
  const safeTop = sanitizeNumber(top);
  const safeWidth = Math.max(0, sanitizeNumber(width));
  const safeHeight = Math.max(0, sanitizeNumber(height));

  return {
    x: safeLeft,
    y: safeTop,
    left: safeLeft,
    top: safeTop,
    right: safeLeft + safeWidth,
    bottom: safeTop + safeHeight,
    width: safeWidth,
    height: safeHeight,
  };
}

function calculateVerticalAnchorPlacement(
  anchorRect: EditorViewportRect,
  size: OverlaySize,
  options: ResolvedOverlayPlacementOptions,
): OverlayPlacement {
  const { bounds, gap, padding } = options;
  const safeWidth = Math.max(0, size.width);
  const safeHeight = Math.max(0, size.height);
  const minLeft = bounds.left + padding;
  const maxLeft = bounds.right - padding - safeWidth;
  const anchorCenter = anchorRect.left + (anchorRect.width / 2);
  const left = clamp(anchorCenter - (safeWidth / 2), minLeft, maxLeft);
  const aboveTop = anchorRect.top - gap - safeHeight;
  const belowTop = anchorRect.bottom + gap;
  const hasAboveRoom = aboveTop >= bounds.top + padding;
  const hasBelowRoom = belowTop + safeHeight <= bounds.bottom - padding;
  const side: OverlayPlacementSide = hasAboveRoom || !hasBelowRoom ? 'above' : 'below';
  const unclampedTop = side === 'above' ? aboveTop : belowTop;
  const top = clamp(unclampedTop, bounds.top + padding, bounds.bottom - padding - safeHeight);

  return {
    left,
    top,
    width: safeWidth,
    height: safeHeight,
    side,
    transformOrigin: side === 'above' ? 'bottom center' : 'top center',
  };
}

function calculatePreviewSidePlacement(
  anchorRect: EditorViewportRect,
  size: OverlaySize,
  options: ResolvedOverlayPlacementOptions & {
    previewSide: NonNullable<FloatingVisualPanelPlacementOptions['previewSide']>;
  },
): OverlayPlacement {
  const { bounds, gap, padding, previewSide } = options;
  const geometry = getPreviewWorkspaceGeometrySnapshot();
  const previewRect = geometry?.iframeRect ?? anchorRect;
  const safeWidth = Math.max(0, size.width);
  const safeHeight = Math.max(0, size.height);
  const preferredRightLeft = previewRect.right + gap;
  const preferredLeftLeft = previewRect.left - gap - safeWidth;
  const rightFits = preferredRightLeft + safeWidth <= bounds.right - padding;
  const leftFits = preferredLeftLeft >= bounds.left + padding;
  const side: OverlayPlacementSide = previewSide === 'right'
    ? 'right'
    : previewSide === 'left'
      ? 'left'
      : rightFits || !leftFits
        ? 'right'
        : 'left';
  const unclampedLeft = side === 'right' ? preferredRightLeft : preferredLeftLeft;
  const anchorTop = anchorRect.top + Math.min(48, Math.max(0, anchorRect.height / 2));

  return {
    left: clamp(unclampedLeft, bounds.left + padding, bounds.right - padding - safeWidth),
    top: clamp(anchorTop, bounds.top + padding, bounds.bottom - padding - safeHeight),
    width: safeWidth,
    height: safeHeight,
    side,
    transformOrigin: side === 'right' ? 'left top' : 'right top',
  };
}

function getEditorViewportRect(): EditorViewportRect {
  const width = typeof window === 'undefined' ? 0 : window.innerWidth;
  const height = typeof window === 'undefined' ? 0 : window.innerHeight;

  return createEditorViewportRect({ left: 0, top: 0, width, height });
}

function intersectEditorViewportRects(
  first: EditorViewportRect,
  second: EditorViewportRect,
): EditorViewportRect | null {
  const left = Math.max(first.left, second.left);
  const top = Math.max(first.top, second.top);
  const right = Math.min(first.right, second.right);
  const bottom = Math.min(first.bottom, second.bottom);

  if (right <= left || bottom <= top) {
    return null;
  }

  return createEditorViewportRect({
    left,
    top,
    width: right - left,
    height: bottom - top,
  });
}

function clamp(value: number, min: number, max: number): number {
  const safeValue = sanitizeNumber(value);
  const safeMin = sanitizeNumber(min);
  const safeMax = sanitizeNumber(max);

  if (safeMax < safeMin) {
    return safeMin;
  }

  return Math.min(safeMax, Math.max(safeMin, safeValue));
}

function sanitizeNumber(value: number): number {
  return Number.isFinite(value) ? value : 0;
}
