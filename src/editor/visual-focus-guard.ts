import { protectEditorInteractionFromHover } from './note-hover-guard';

const VISUAL_EDITOR_HOVER_PROTECTION_MS = 500;

const VISUAL_FOCUS_GUARD_SELECTOR = [
  '[data-copy-ai-id-visual-focus-guard="true"]',
  '[data-ai-editor-floating-visual-panel="1"]',
  '[data-ai-id="copy-ai-id-editor-quick-action-bar"]',
].join(', ');

export function installVisualEditorFocusGuard(): () => void {
  const protectIfVisualEvent = (event: Event): void => {
    if (!isVisualEditorFocusGuardEvent(event)) {
      return;
    }

    protectVisualEditorInteractionFromHover();
  };

  window.addEventListener('focusin', protectIfVisualEvent, true);
  window.addEventListener('pointerdown', protectIfVisualEvent, true);
  window.addEventListener('keydown', protectIfVisualEvent, true);
  window.addEventListener('input', protectIfVisualEvent, true);

  return () => {
    window.removeEventListener('focusin', protectIfVisualEvent, true);
    window.removeEventListener('pointerdown', protectIfVisualEvent, true);
    window.removeEventListener('keydown', protectIfVisualEvent, true);
    window.removeEventListener('input', protectIfVisualEvent, true);
  };
}

export function isVisualEditorFocusGuardEvent(event: Event): boolean {
  const path = typeof event.composedPath === 'function' ? event.composedPath() : [];
  const nodes: EventTarget[] = path.length > 0 ? path : event.target ? [event.target] : [];

  for (const node of nodes) {
    if (node instanceof Document || node instanceof Window) {
      continue;
    }

    if (!(node instanceof Element)) {
      continue;
    }

    if (node.matches(VISUAL_FOCUS_GUARD_SELECTOR) || node.closest(VISUAL_FOCUS_GUARD_SELECTOR)) {
      return true;
    }
  }

  return false;
}

export function protectVisualEditorInteractionFromHover(
  durationMs = VISUAL_EDITOR_HOVER_PROTECTION_MS,
): void {
  protectEditorInteractionFromHover(durationMs);
}
