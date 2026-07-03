import {
  PREVIEW_BOX_MODEL_CONTROL_Z_INDEX,
  PREVIEW_BOX_MODEL_HOVER_Z_INDEX,
  PREVIEW_BOX_MODEL_SELECTION_Z_INDEX,
  PREVIEW_OVERLAY_ATTR,
} from '../../shared/config';
import {
  computeRegionRects,
  type Edge,
  type Rect,
  type Region,
  type RegionRect,
} from './box-model-geometry';
import type {
  VisualBoxEdge,
  VisualBoxRegion,
} from '../../shared/domain/visual';

type OverlayKind = 'hover' | 'selection' | 'control';
interface BoxModelRegionFilter {
  region: VisualBoxRegion;
  edge?: VisualBoxEdge;
}

const OVERLAY_Z_INDEX: Record<OverlayKind, string> = {
  hover: String(PREVIEW_BOX_MODEL_HOVER_Z_INDEX),
  selection: String(PREVIEW_BOX_MODEL_SELECTION_Z_INDEX),
  control: String(PREVIEW_BOX_MODEL_CONTROL_Z_INDEX),
};

// Chrome DevTools-style box-model colors.
const REGION_COLORS: Record<Region, [number, number, number]> = {
  margin: [246, 178, 107],
  border: [255, 229, 153],
  padding: [147, 196, 125],
  content: [111, 168, 220],
  gap: [171, 124, 232],
};

const REGION_ALPHA: Record<Region, number> = {
  margin: 0.55,
  border: 0.5,
  padding: 0.5,
  content: 0.45,
  gap: 0.5,
};

const HOVER_ALPHA_SCALE = 0.45;
const HIGHLIGHT_ALPHA = 0.78;
const DIMMED_ALPHA_SCALE = 0.18;

const layers = new Map<OverlayKind, HTMLElement>();
const shownElements = new Map<OverlayKind, Element>();
const shownFilters = new Map<OverlayKind, BoxModelRegionFilter>();

export function showBoxModel(kind: OverlayKind, element: Element): void {
  shownElements.set(kind, element);
  shownFilters.delete(kind);
  render(kind);
}

export function showBoxModelRegion(kind: OverlayKind, element: Element, filter: BoxModelRegionFilter): void {
  shownElements.set(kind, element);
  shownFilters.set(kind, filter);
  render(kind);
}

export function hideBoxModel(kind: OverlayKind): void {
  shownElements.delete(kind);
  shownFilters.delete(kind);
  const layer = layers.get(kind);
  if (!layer) {
    return;
  }

  layer.style.display = 'none';
  layer.replaceChildren();
}

export function removeBoxModelLayers(): void {
  shownElements.clear();
  shownFilters.clear();
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

  const filter = shownFilters.get(kind);
  const regions = computeRegionRects(element);
  const layer = ensureLayer(kind);
  layer.replaceChildren(...regions.map((region) => createRegionNode(kind, region, filter)));
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


function isHighlightedRegion(region: RegionRect, filter: BoxModelRegionFilter | undefined): boolean {
  if (!filter) {
    return false;
  }

  if (region.region !== filter.region) {
    return false;
  }

  if (!filter.edge || filter.edge === 'all') {
    return true;
  }

  if (region.region === 'gap') {
    if (filter.edge === 'row') {
      return region.axis === 'y';
    }
    if (filter.edge === 'column') {
      return region.axis === 'x';
    }
  }

  return region.edge === filter.edge;
}

function createRegionNode(
  kind: OverlayKind,
  region: RegionRect,
  filter: BoxModelRegionFilter | undefined,
): HTMLElement {
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
  const alpha = resolveRegionAlpha(kind, region, filter);
  const rgba = (nextAlpha: number): string => `rgba(${red}, ${green}, ${blue}, ${nextAlpha})`;
  const highlighted = kind === 'control' && isHighlightedRegion(region, filter);

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

  if (highlighted) {
    Object.assign(node.style, {
      outline: `1px solid ${rgba(1)}`,
      outlineOffset: '-1px',
    });
  }

  return node;
}

function resolveRegionAlpha(
  kind: OverlayKind,
  region: RegionRect,
  filter: BoxModelRegionFilter | undefined,
): number {
  const base = REGION_ALPHA[region.region];
  if (kind === 'hover') {
    return base * HOVER_ALPHA_SCALE;
  }

  if (!filter) {
    return base;
  }

  return isHighlightedRegion(region, filter) ? HIGHLIGHT_ALPHA : base * DIMMED_ALPHA_SCALE;
}
