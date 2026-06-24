import { PREVIEW_OVERLAY_ATTR } from '../../shared/config';
import type { VisualDropPosition } from '../../shared/editor-messages';
import { hideBoxModel, removeBoxModelLayers, showBoxModel } from './box-model';

type OverlayKind = 'hover';

const OVERLAY_Z_INDEX = '2147483646';
const REFERENCE_OVERLAY_ATTR = 'data-ai-editor-overlay';

const STYLES: Record<OverlayKind, string> = {
  hover: 'outline: 2px dashed #3b82f6; background: rgba(59,130,246,0.06);',
};

const boxes = new Map<OverlayKind, HTMLDivElement>();
const tracked = new Map<OverlayKind, Element>();

let tracking = false;
let rafId: number | null = null;
let boxModelMode = false;
let dropIndicatorBox: HTMLDivElement | null = null;
let dropIndicatorState: { element: Element; position: VisualDropPosition } | null = null;

export function setBoxModelMode(enabled: boolean): void {
  if (boxModelMode === enabled) {
    return;
  }

  boxModelMode = enabled;
  if (!enabled) {
    hideBoxModel('hover');
  }
  scheduleUpdate();
}

export function startOverlayTracking(): () => void {
  if (tracking) {
    return stopOverlayTracking;
  }

  tracking = true;

  window.addEventListener('scroll', scheduleUpdate, true);
  window.addEventListener('resize', scheduleUpdate);
  scheduleUpdate();

  return stopOverlayTracking;
}

export function stopOverlayTracking(): void {
  if (!tracking) {
    return;
  }

  tracking = false;
  window.removeEventListener('scroll', scheduleUpdate, true);
  window.removeEventListener('resize', scheduleUpdate);
  if (rafId !== null) {
    window.cancelAnimationFrame(rafId);
    rafId = null;
  }

  tracked.clear();
  for (const box of boxes.values()) {
    box.remove();
  }
  boxes.clear();
  hideVisualDropIndicator();
  dropIndicatorBox?.remove();
  dropIndicatorBox = null;
  boxModelMode = false;
  removeBoxModelLayers();
}

export function showOverlay(kind: OverlayKind, element: Element): void {
  tracked.set(kind, element);
  reposition(kind);
}

export function hideOverlay(kind: OverlayKind): void {
  tracked.delete(kind);
  hideBoxModel(kind);
  hideOutlineBox(kind);
}

export function refreshOverlays(): void {
  scheduleUpdate();
}

export function showVisualDropIndicator(element: Element, position: VisualDropPosition): void {
  dropIndicatorState = { element, position };
  repositionVisualDropIndicator();
}

export function hideVisualDropIndicator(): void {
  dropIndicatorState = null;
  if (dropIndicatorBox) {
    dropIndicatorBox.style.display = 'none';
  }
}

function ensureBox(kind: OverlayKind): HTMLDivElement {
  const existing = boxes.get(kind);
  if (existing) {
    return existing;
  }

  const box = document.createElement('div');
  box.setAttribute(REFERENCE_OVERLAY_ATTR, kind);
  box.setAttribute(PREVIEW_OVERLAY_ATTR, kind);
  box.setAttribute('data-ai-id', `ai-editor-preview-${kind}-overlay-box`);
  box.style.cssText =
    `position: absolute; pointer-events: none; z-index: ${OVERLAY_Z_INDEX}; display: none; ${STYLES[kind]}`;
  (document.body ?? document.documentElement).appendChild(box);
  boxes.set(kind, box);
  return box;
}

function hideOutlineBox(kind: OverlayKind): void {
  const box = boxes.get(kind);
  if (box) {
    box.style.display = 'none';
  }
}

function scheduleUpdate(): void {
  if (rafId !== null) {
    return;
  }

  rafId = window.requestAnimationFrame(() => {
    rafId = null;
    updateOverlays();
  });
}

function updateOverlays(): void {
  reposition('hover');
  repositionVisualDropIndicator();
}

function reposition(kind: OverlayKind): void {
  const element = tracked.get(kind);
  if (!element || !element.isConnected) {
    hideOverlay(kind);
    return;
  }

  if (boxModelMode) {
    hideOutlineBox(kind);
    showBoxModel(kind, element);
    return;
  }

  hideBoxModel(kind);

  const rect = element.getBoundingClientRect();
  const box = ensureBox(kind);

  box.style.display = 'block';
  box.style.left = `${rect.left + window.scrollX}px`;
  box.style.top = `${rect.top + window.scrollY}px`;
  box.style.width = `${rect.width}px`;
  box.style.height = `${rect.height}px`;
}

function ensureDropIndicatorBox(): HTMLDivElement {
  if (dropIndicatorBox) {
    return dropIndicatorBox;
  }

  const box = document.createElement('div');
  box.setAttribute(PREVIEW_OVERLAY_ATTR, 'visual-drag-drop-indicator');
  box.setAttribute('data-copy-ai-id-visual-overlay', 'drag-drop-indicator');
  box.setAttribute('data-ai-id', 'copy-ai-id-preview-visual-drag-drop-indicator');
  box.style.cssText = [
    'position: absolute',
    'pointer-events: none',
    'z-index: 2147483647',
    'display: none',
    'box-sizing: border-box',
    'border-radius: 999px',
    'background: #60a5fa',
    'box-shadow: 0 0 0 1px rgba(15,23,42,0.75), 0 0 0 4px rgba(96,165,250,0.25)',
  ].join('; ');
  (document.body ?? document.documentElement).appendChild(box);
  dropIndicatorBox = box;
  return box;
}

function repositionVisualDropIndicator(): void {
  const state = dropIndicatorState;
  if (!state?.element || !state.element.isConnected) {
    hideVisualDropIndicator();
    return;
  }

  const rect = state.element.getBoundingClientRect();
  const box = ensureDropIndicatorBox();
  const scrollX = window.scrollX;
  const scrollY = window.scrollY;

  if (state.position === 'inside-start' || state.position === 'inside-end') {
    box.style.display = 'block';
    box.style.left = `${rect.left + scrollX}px`;
    box.style.top = `${rect.top + scrollY}px`;
    box.style.width = `${Math.max(0, rect.width)}px`;
    box.style.height = `${Math.max(0, rect.height)}px`;
    box.style.borderRadius = '6px';
    box.style.border = '2px solid #60a5fa';
    box.style.background = 'rgba(96,165,250,0.08)';
    return;
  }

  const lineHeight = 3;
  const top = (state.position === 'before' ? rect.top : rect.bottom) + scrollY - (lineHeight / 2);
  box.style.display = 'block';
  box.style.left = `${rect.left + scrollX}px`;
  box.style.top = `${top}px`;
  box.style.width = `${Math.max(24, rect.width)}px`;
  box.style.height = `${lineHeight}px`;
  box.style.borderRadius = '999px';
  box.style.border = '0';
  box.style.background = '#60a5fa';
}
