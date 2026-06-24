import { PREVIEW_OVERLAY_ATTR } from '../../shared/config';
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
