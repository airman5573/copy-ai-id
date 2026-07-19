import { resolveEditorEventElement } from './editor-shadow-root';
import { protectEditorInteractionFromHover } from './note-hover-guard';

const VISUAL_EDITOR_HOVER_PROTECTION_MS = 500;

const VISUAL_FOCUS_GUARD_SELECTOR = [
  '[data-copy-ai-id-visual-focus-guard="true"]',
  '[data-ai-editor-floating-visual-panel="1"]',
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
  return Boolean(resolveEditorEventElement(event)?.closest(VISUAL_FOCUS_GUARD_SELECTOR));
}

export function protectVisualEditorInteractionFromHover(
  durationMs = VISUAL_EDITOR_HOVER_PROTECTION_MS,
): void {
  protectEditorInteractionFromHover(durationMs);
}
