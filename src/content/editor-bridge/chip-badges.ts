import {
  PREVIEW_CHIP_BADGE_Z_INDEX,
  PREVIEW_OVERLAY_ATTR,
} from '../../shared/config';
import {
  type ChipBadgeDescriptor,
  EDITOR_MESSAGE_TYPES,
} from '../../shared/protocol/editor-bridge-messages';
import { buildLayoutTreeSnapshot } from './layout-tree';
import { viewportRectForElement, viewportSize } from './lib/viewport';
import type { BridgePost } from './types';
import { resolveVisualTarget } from './visual-target-resolver';

const CHIP_BADGE_LAYER_MARKER = 'chip-badges';
const CHIP_BADGE_HEIGHT_PX = 16;
const CHIP_BADGE_STACK_GAP_PX = 3;

interface ChipBadgeEntry {
  descriptor: ChipBadgeDescriptor;
  element: Element | null;
  node: HTMLElement;
}

let entries: ChipBadgeEntry[] = [];
let layer: HTMLElement | null = null;
let bridgePost: BridgePost | null = null;

export function setChipBadges(badges: ChipBadgeDescriptor[], post: BridgePost): void {
  bridgePost = post;

  const previousElements = new Map(
    entries.map((entry) => [entry.descriptor.chipId, entry.element]),
  );
  entries = badges.map((descriptor) => ({
    descriptor,
    element: previousElements.get(descriptor.chipId) ?? null,
    node: createChipBadgeNode(descriptor),
  }));

  resolveChipBadgeElements({ rebuildLayoutTreeOnMiss: true });
  syncChipBadgeLayerChildren();
  repositionChipBadges();
}

// Re-resolves badges whose element was replaced or removed (structure
// mutations, undo restores). Callers run this after the layout tree has been
// rebuilt, so a failed resolution here is a genuinely gone target.
export function refreshChipBadges(): void {
  if (entries.length === 0) {
    return;
  }

  resolveChipBadgeElements({ rebuildLayoutTreeOnMiss: false });
  repositionChipBadges();
}

export function repositionChipBadges(): void {
  if (!layer || entries.length === 0) {
    return;
  }

  const stackOffsets = new Map<Element, number>();
  let anyVisible = false;

  for (const entry of entries) {
    const element = entry.element;
    if (!element || !element.isConnected) {
      entry.node.style.display = 'none';
      continue;
    }

    const rect = element.getBoundingClientRect();
    if (rect.width <= 0 && rect.height <= 0) {
      entry.node.style.display = 'none';
      continue;
    }

    // Dock the badge to the element's top-left corner, DevTools-style; when
    // the element touches the viewport top there is no room above, so fall
    // back to just inside the corner. Multiple badges on one element (legacy
    // drafts with distinct chip ids) stack horizontally.
    const stackOffset = stackOffsets.get(element) ?? 0;
    entry.node.style.display = 'inline-flex';
    entry.node.style.left = `${Math.max(0, rect.left) + stackOffset}px`;
    entry.node.style.top = rect.top >= CHIP_BADGE_HEIGHT_PX
      ? `${rect.top - CHIP_BADGE_HEIGHT_PX}px`
      : `${Math.max(0, rect.top)}px`;
    stackOffsets.set(element, stackOffset + entry.node.offsetWidth + CHIP_BADGE_STACK_GAP_PX);
    anyVisible = true;
  }

  layer.style.display = anyVisible ? 'block' : 'none';
}

export function removeChipBadges(): void {
  entries = [];
  layer?.remove();
  layer = null;
}

// The hover-highlight click handler hit-tests through extension-owned nodes,
// so it must skip clicks that land on a badge and leave them to the badge's
// own listener.
export function isChipBadgeEventTarget(target: EventTarget | null): boolean {
  return target instanceof Element
    && target.closest(`[${PREVIEW_OVERLAY_ATTR}="${CHIP_BADGE_LAYER_MARKER}"]`) !== null;
}

function resolveChipBadgeElements(options: { rebuildLayoutTreeOnMiss: boolean }): void {
  let missed = false;
  for (const entry of entries) {
    if (entry.element?.isConnected) {
      continue;
    }

    entry.element = resolveChipBadgeElement(entry.descriptor);
    missed ||= entry.element === null;
  }

  if (!missed || !options.rebuildLayoutTreeOnMiss) {
    return;
  }

  // One shared rebuild retry so N stale badges cost a single layout-tree
  // rebuild instead of the resolver's per-target refreshLayoutTreeOnMiss.
  buildLayoutTreeSnapshot();
  for (const entry of entries) {
    if (!entry.element) {
      entry.element = resolveChipBadgeElement(entry.descriptor);
    }
  }
}

function resolveChipBadgeElement(descriptor: ChipBadgeDescriptor): Element | null {
  const resolved = resolveVisualTarget({
    target: descriptor.target,
    nodeId: descriptor.nodeId,
    refreshLayoutTreeOnMiss: false,
  });

  return resolved.ok ? resolved.element : null;
}

function syncChipBadgeLayerChildren(): void {
  if (entries.length === 0) {
    if (layer) {
      layer.style.display = 'none';
      layer.replaceChildren();
    }
    return;
  }

  ensureChipBadgeLayer().replaceChildren(...entries.map((entry) => entry.node));
}

function ensureChipBadgeLayer(): HTMLElement {
  if (layer) {
    return layer;
  }

  const badgeLayer = document.createElement('div');
  badgeLayer.setAttribute(PREVIEW_OVERLAY_ATTR, CHIP_BADGE_LAYER_MARKER);
  badgeLayer.setAttribute('data-ai-id', 'copy-ai-id-preview-chip-badge-layer');
  Object.assign(badgeLayer.style, {
    position: 'fixed',
    inset: '0',
    display: 'none',
    overflow: 'visible',
    pointerEvents: 'none',
    zIndex: String(PREVIEW_CHIP_BADGE_Z_INDEX),
  });
  document.documentElement.appendChild(badgeLayer);
  layer = badgeLayer;
  return badgeLayer;
}

function createChipBadgeNode(descriptor: ChipBadgeDescriptor): HTMLElement {
  const node = document.createElement('div');
  node.setAttribute(PREVIEW_OVERLAY_ATTR, 'chip-badge');
  node.setAttribute('data-ai-id', 'copy-ai-id-preview-chip-badge');
  node.title = descriptor.chipId;
  node.textContent = descriptor.label;
  // No shadow root here (same idiom as the drop indicator); the `all: initial`
  // reset keeps page CSS from leaking into the badge.
  node.style.cssText = [
    'all: initial',
    'position: absolute',
    'display: none',
    'box-sizing: border-box',
    'align-items: center',
    'justify-content: center',
    `height: ${CHIP_BADGE_HEIGHT_PX}px`,
    'min-width: 16px',
    'padding: 0 4px',
    'border-radius: 4px 4px 4px 0',
    'background: #2563eb',
    'color: #ffffff',
    'font: 700 10px/1 -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
    'letter-spacing: 0.02em',
    'box-shadow: 0 0 0 1px rgba(15, 23, 42, 0.55)',
    'cursor: pointer',
    'pointer-events: auto',
    'user-select: none',
  ].join('; ');

  node.addEventListener('click', (event) => {
    event.preventDefault();
    event.stopPropagation();
    postChipBadgeClicked(descriptor.chipId);
  });

  return node;
}

function postChipBadgeClicked(chipId: string): void {
  const element = entries.find((entry) => entry.descriptor.chipId === chipId)?.element ?? null;

  bridgePost?.({
    type: EDITOR_MESSAGE_TYPES.chipBadgeClicked,
    chipId,
    elementRect: element?.isConnected ? viewportRectForElement(element) : null,
    viewport: viewportSize(),
  });
}
