import { PREVIEW_OVERLAY_ATTR } from '../../shared/config';

type OverlayKind = 'hover';
type Edge = 'top' | 'right' | 'bottom' | 'left';
type Region = 'margin' | 'padding' | 'content' | 'gap';

interface Rect {
  left: number;
  top: number;
  width: number;
  height: number;
}

interface RegionRect {
  region: Region;
  rect: Rect;
  edge?: Edge;
  axis?: 'x' | 'y';
}

const OVERLAY_Z_INDEX: Record<OverlayKind, string> = {
  hover: '2147483645',
};

// Chrome DevTools-style box-model colors.
const REGION_COLORS: Record<Region, [number, number, number]> = {
  margin: [246, 178, 107],
  padding: [147, 196, 125],
  content: [111, 168, 220],
  gap: [171, 124, 232],
};

const REGION_ALPHA: Record<Region, number> = {
  margin: 0.55,
  padding: 0.5,
  content: 0.45,
  gap: 0.5,
};

const HOVER_ALPHA_SCALE = 0.45;

const layers = new Map<OverlayKind, HTMLElement>();
const shownElements = new Map<OverlayKind, Element>();

export function showBoxModel(kind: OverlayKind, element: Element): void {
  shownElements.set(kind, element);
  render(kind);
}

export function hideBoxModel(kind: OverlayKind): void {
  shownElements.delete(kind);
  const layer = layers.get(kind);
  if (!layer) {
    return;
  }

  layer.style.display = 'none';
  layer.replaceChildren();
}

export function removeBoxModelLayers(): void {
  shownElements.clear();
  for (const layer of layers.values()) {
    layer.remove();
  }
  layers.clear();
}

function render(kind: OverlayKind): void {
  const element = shownElements.get(kind);
  if (!element || !element.isConnected) {
    hideBoxModel(kind);
    return;
  }

  const regions = computeRegionRects(element);
  const layer = ensureLayer(kind);
  layer.replaceChildren(...regions.map((region) => createRegionNode(kind, region)));
  layer.style.display = regions.length > 0 ? 'block' : 'none';
}

function ensureLayer(kind: OverlayKind): HTMLElement {
  const existingLayer = layers.get(kind);
  if (existingLayer) {
    return existingLayer;
  }

  const layer = document.createElement('div');
  layer.setAttribute(PREVIEW_OVERLAY_ATTR, `box-model-${kind}`);
  layer.setAttribute('data-ai-id', `copy-ai-id-preview-box-model-${kind}-layer`);
  Object.assign(layer.style, {
    position: 'fixed',
    inset: '0',
    display: 'none',
    overflow: 'visible',
    pointerEvents: 'none',
    zIndex: OVERLAY_Z_INDEX[kind],
  });
  document.documentElement.appendChild(layer);
  layers.set(kind, layer);
  return layer;
}

function createRegionNode(kind: OverlayKind, region: RegionRect): HTMLElement {
  const node = document.createElement('div');
  node.setAttribute('data-ai-id', [
    'copy-ai-id-preview-box-model',
    kind,
    region.region,
    region.edge,
    region.axis,
    'region',
  ].filter(Boolean).join('-'));

  const [red, green, blue] = REGION_COLORS[region.region];
  const alpha = REGION_ALPHA[region.region] * (kind === 'hover' ? HOVER_ALPHA_SCALE : 1);
  const rgba = (nextAlpha: number): string => `rgba(${red}, ${green}, ${blue}, ${nextAlpha})`;

  Object.assign(node.style, {
    position: 'absolute',
    left: `${region.rect.left}px`,
    top: `${region.rect.top}px`,
    width: `${region.rect.width}px`,
    height: `${region.rect.height}px`,
    pointerEvents: 'none',
  });

  if (region.region === 'gap') {
    Object.assign(node.style, {
      backgroundColor: rgba(alpha * 0.25),
      backgroundImage: `repeating-linear-gradient(45deg, ${rgba(alpha)} 0px, ${rgba(alpha)} 4px, transparent 4px, transparent 8px)`,
    });
  } else {
    node.style.backgroundColor = rgba(alpha);
  }

  return node;
}

function pxToNumber(value: string): number {
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function computeRegionRects(element: Element): RegionRect[] {
  const bounding = element.getBoundingClientRect();
  if (bounding.width <= 0 || bounding.height <= 0) {
    return [];
  }

  const left = bounding.left;
  const top = bounding.top;
  const { width, height } = bounding;
  const style = window.getComputedStyle(element);
  const regions: RegionRect[] = [];
  const push = (region: RegionRect): void => {
    if (region.rect.width > 0 && region.rect.height > 0) {
      regions.push(region);
    }
  };

  // Negative margins are clamped, matching browser DevTools behavior.
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

  const outerLeft = left - margin.left;
  const outerWidth = width + margin.left + margin.right;
  push({ region: 'margin', edge: 'top', rect: { left: outerLeft, top: top - margin.top, width: outerWidth, height: margin.top } });
  push({ region: 'margin', edge: 'bottom', rect: { left: outerLeft, top: top + height, width: outerWidth, height: margin.bottom } });
  push({ region: 'margin', edge: 'left', rect: { left: outerLeft, top, width: margin.left, height } });
  push({ region: 'margin', edge: 'right', rect: { left: left + width, top, width: margin.right, height } });

  const innerLeft = left + border.left;
  const innerTop = top + border.top;
  const innerWidth = Math.max(0, width - border.left - border.right);
  const innerHeight = Math.max(0, height - border.top - border.bottom);
  const topPaddingHeight = Math.min(padding.top, innerHeight);
  const bottomPaddingHeight = Math.min(padding.bottom, innerHeight);
  const sideHeight = Math.max(0, innerHeight - padding.top - padding.bottom);

  push({ region: 'padding', edge: 'top', rect: { left: innerLeft, top: innerTop, width: innerWidth, height: topPaddingHeight } });
  push({
    region: 'padding',
    edge: 'bottom',
    rect: { left: innerLeft, top: innerTop + innerHeight - bottomPaddingHeight, width: innerWidth, height: bottomPaddingHeight },
  });
  push({ region: 'padding', edge: 'left', rect: { left: innerLeft, top: innerTop + padding.top, width: Math.min(padding.left, innerWidth), height: sideHeight } });
  push({
    region: 'padding',
    edge: 'right',
    rect: { left: innerLeft + innerWidth - Math.min(padding.right, innerWidth), top: innerTop + padding.top, width: Math.min(padding.right, innerWidth), height: sideHeight },
  });

  const content: Rect = {
    left: innerLeft + padding.left,
    top: innerTop + padding.top,
    width: Math.max(0, innerWidth - padding.left - padding.right),
    height: sideHeight,
  };
  push({ region: 'content', rect: content });

  if (['flex', 'inline-flex', 'grid', 'inline-grid'].includes(style.display)) {
    const columnGap = pxToNumber(style.columnGap);
    const rowGap = pxToNumber(style.rowGap);
    if (columnGap > 0 || rowGap > 0) {
      for (const gapRect of computeGapRects(element, content, columnGap, rowGap)) {
        push(gapRect);
      }
    }
  }

  return regions;
}

function computeGapRects(element: Element, content: Rect, columnGap: number, rowGap: number): RegionRect[] {
  const childRects: Rect[] = [];
  for (const child of Array.from(element.children)) {
    if (child.hasAttribute(PREVIEW_OVERLAY_ATTR)) {
      continue;
    }

    const rect = child.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) {
      continue;
    }

    childRects.push({ left: rect.left, top: rect.top, width: rect.width, height: rect.height });
  }

  if (childRects.length < 2) {
    return [];
  }

  childRects.sort((a, b) => a.top - b.top || a.left - b.left);
  const rows: Rect[][] = [];
  let row: Rect[] = [];
  let rowBottom = -Infinity;

  for (const rect of childRects) {
    if (row.length > 0 && rect.top >= rowBottom - 0.5) {
      rows.push(row);
      row = [];
      rowBottom = -Infinity;
    }
    row.push(rect);
    rowBottom = Math.max(rowBottom, rect.top + rect.height);
  }
  rows.push(row);

  const gaps: RegionRect[] = [];

  if (columnGap > 0) {
    for (const cells of rows) {
      const byLeft = cells.slice().sort((a, b) => a.left - b.left);
      for (let index = 0; index < byLeft.length - 1; index += 1) {
        const current = byLeft[index];
        const next = byLeft[index + 1];
        const space = next.left - (current.left + current.width);
        if (space <= 0.5) {
          continue;
        }

        const width = Math.min(columnGap, space);
        const top = Math.min(current.top, next.top);
        const bottom = Math.max(current.top + current.height, next.top + next.height);
        const clipped = clipRect(
          { left: current.left + current.width + (space - width) / 2, top, width, height: bottom - top },
          content,
        );
        if (clipped) {
          gaps.push({ region: 'gap', axis: 'x', rect: clipped });
        }
      }
    }
  }

  if (rowGap > 0) {
    for (let index = 0; index < rows.length - 1; index += 1) {
      const currentBottom = Math.max(...rows[index].map((rect) => rect.top + rect.height));
      const nextTop = Math.min(...rows[index + 1].map((rect) => rect.top));
      const space = nextTop - currentBottom;
      if (space <= 0.5) {
        continue;
      }

      const height = Math.min(rowGap, space);
      const clipped = clipRect(
        { left: content.left, top: currentBottom + (space - height) / 2, width: content.width, height },
        content,
      );
      if (clipped) {
        gaps.push({ region: 'gap', axis: 'y', rect: clipped });
      }
    }
  }

  return gaps;
}

function clipRect(rect: Rect, bounds: Rect): Rect | null {
  const left = Math.max(rect.left, bounds.left);
  const top = Math.max(rect.top, bounds.top);
  const right = Math.min(rect.left + rect.width, bounds.left + bounds.width);
  const bottom = Math.min(rect.top + rect.height, bounds.top + bounds.height);

  if (right - left <= 0 || bottom - top <= 0) {
    return null;
  }

  return { left, top, width: right - left, height: bottom - top };
}
