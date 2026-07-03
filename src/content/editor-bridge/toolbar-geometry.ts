import type {
  BridgeViewportRect,
  BridgeViewportSize,
} from '../../shared/domain/geometry';

export const QUICK_ACTION_BAR_GAP = 8;
export const QUICK_ACTION_BAR_PADDING = 12;
export const DEFAULT_QUICK_ACTION_BAR_SIZE = { width: 520, height: 40 };

export interface OverlaySize {
  width: number;
  height: number;
}

export interface ToolbarPlacement {
  side: 'above' | 'below';
  left: number;
  top: number;
}

export function measureToolbar(node: HTMLElement): OverlaySize {
  const rect = node.getBoundingClientRect();
  return {
    width: Math.ceil(rect.width || node.offsetWidth || DEFAULT_QUICK_ACTION_BAR_SIZE.width),
    height: Math.ceil(rect.height || node.offsetHeight || DEFAULT_QUICK_ACTION_BAR_SIZE.height),
  };
}

export function calculateToolbarPlacement(
  anchorRect: BridgeViewportRect,
  size: OverlaySize,
  viewport: BridgeViewportSize,
): ToolbarPlacement {
  const maxLeft = Math.max(QUICK_ACTION_BAR_PADDING, viewport.width - size.width - QUICK_ACTION_BAR_PADDING);
  const centeredLeft = anchorRect.left + (anchorRect.width / 2) - (size.width / 2);
  const left = clamp(centeredLeft, QUICK_ACTION_BAR_PADDING, maxLeft);
  const spaceAbove = anchorRect.top - QUICK_ACTION_BAR_PADDING;
  const spaceBelow = viewport.height - anchorRect.bottom - QUICK_ACTION_BAR_PADDING;
  const side: ToolbarPlacement['side'] = spaceAbove >= size.height + QUICK_ACTION_BAR_GAP || spaceAbove >= spaceBelow
    ? 'above'
    : 'below';
  const preferredTop = side === 'above'
    ? anchorRect.top - size.height - QUICK_ACTION_BAR_GAP
    : anchorRect.bottom + QUICK_ACTION_BAR_GAP;
  const maxTop = Math.max(QUICK_ACTION_BAR_PADDING, viewport.height - size.height - QUICK_ACTION_BAR_PADDING);

  return {
    side,
    left,
    top: clamp(preferredTop, QUICK_ACTION_BAR_PADDING, maxTop),
  };
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

export function isUsableRect(rect: DOMRect): boolean {
  return Number.isFinite(rect.left)
    && Number.isFinite(rect.top)
    && Number.isFinite(rect.right)
    && Number.isFinite(rect.bottom)
    && Number.isFinite(rect.width)
    && Number.isFinite(rect.height)
    && rect.width > 0
    && rect.height > 0;
}
