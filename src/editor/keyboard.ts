import {
  EDITOR_MESSAGE_TYPES,
  type EditorKeyboardShortcut,
} from '../shared/protocol/editor-bridge-messages';
import { hideQuickActionToolbar, postToBridge } from './bridge/bridgeClient';
import { resolveEditorEventElement } from './editor-shadow-root';
import { suppressHoverUntilMouseMove } from './keyboard-hover-guard';
import { handleEditorEscapeAction, handleEditorShortcutAction } from './shortcut-actions';
import { useHighlightStore } from './stores/useHighlightStore';
import {
  isVisualEditorFocusGuardEvent,
  protectVisualEditorInteractionFromHover,
} from './visual-focus-guard';

const ARROW_SHORTCUTS: Record<string, EditorKeyboardShortcut> = {
  ArrowUp: 'arrow-up',
  ArrowDown: 'arrow-down',
  ArrowLeft: 'arrow-left',
  ArrowRight: 'arrow-right',
};
const NOTEBOOK_LEXICAL_EDITOR_SELECTOR = '[data-ai-id="copy-ai-id-editor-note-lexical-editor"]';
const RESIZE_HANDLE_SELECTOR = '[data-ai-id="copy-ai-id-editor-preview-width-resize-handle"]';
const EDITABLE_TARGET_SELECTOR = 'input, textarea, select, [contenteditable=""], [contenteditable="true"], [contenteditable="plaintext-only"], [role="textbox"]';

export function installEditorKeyboard(): () => void {
  const handleKeyDown = (event: KeyboardEvent): void => {
    if (event.defaultPrevented || event.isComposing) {
      return;
    }

    if (isVisualEditorFocusGuardEvent(event)) {
      protectVisualEditorInteractionFromHover();
      if (event.key === 'Escape' && hasNoModifier(event)) {
        consumeKeyboardEvent(event);
        clearVisualEditorEscapeState();
      }
      return;
    }

    if (isShiftEnter(event) && shouldHandleShiftEnter(event)) {
      consumeKeyboardEvent(event);
      handleEditorShortcutAction('shift-enter');
      return;
    }

    if (isEditableEventTarget(event) || isResizeHandleEventTarget(event)) {
      return;
    }

    if (isUndoShortcut(event)) {
      consumeKeyboardEvent(event);
      handleEditorShortcutAction('undo', { postToBridge });
      return;
    }

    const arrowShortcut = ARROW_SHORTCUTS[event.key];
    if (arrowShortcut && hasNoModifier(event)) {
      const highlight = useHighlightStore.getState();
      if (!highlight.highlightedNodeId && !highlight.highlightedTarget) {
        if (isVerticalArrowKey(event.key)) {
          consumeKeyboardEvent(event);
        }
        return;
      }

      consumeKeyboardEvent(event);
      suppressHoverUntilMouseMove();
      postToBridge({ type: EDITOR_MESSAGE_TYPES.keyboardShortcut, shortcut: arrowShortcut });
      return;
    }

    if (event.code === 'Space' && hasNoModifier(event) && !event.repeat) {
      if (handleEditorShortcutAction('space', {
        hideQuickActionToolbar,
      })) {
        consumeKeyboardEvent(event);
      }
      return;
    }

    if (event.key === 'Escape' && hasNoModifier(event)) {
      consumeKeyboardEvent(event);
      clearVisualEditorEscapeState();
    }
  };

  window.addEventListener('keydown', handleKeyDown, true);

  return () => {
    window.removeEventListener('keydown', handleKeyDown, true);
  };
}

function clearVisualEditorEscapeState(): void {
  const result = handleEditorEscapeAction();
  if (
    result !== 'codex-setup-dialog'
    && result !== 'codex-dialog'
    && result !== 'quick-toolbar-popover'
    && result !== 'visual-panel'
    && result !== 'floating-note-panel'
  ) {
    postToBridge({ type: EDITOR_MESSAGE_TYPES.keyboardShortcut, shortcut: 'escape' });
  }
}

function isShiftEnter(event: KeyboardEvent): boolean {
  return event.key === 'Enter'
    && event.shiftKey
    && !event.metaKey
    && !event.ctrlKey
    && !event.altKey
    && !event.repeat;
}

function isUndoShortcut(event: KeyboardEvent): boolean {
  return event.key.toLowerCase() === 'z'
    && (event.ctrlKey || event.metaKey)
    && !event.shiftKey
    && !event.altKey
    && !event.repeat;
}

function shouldHandleShiftEnter(event: KeyboardEvent): boolean {
  if (!isEditableEventTarget(event)) {
    return true;
  }

  return Boolean(resolveEditorEventElement(event)?.closest(NOTEBOOK_LEXICAL_EDITOR_SELECTOR));
}

function hasNoModifier(event: KeyboardEvent): boolean {
  return !event.metaKey && !event.ctrlKey && !event.altKey && !event.shiftKey;
}

function isVerticalArrowKey(key: string): boolean {
  return key === 'ArrowUp' || key === 'ArrowDown';
}

function consumeKeyboardEvent(event: KeyboardEvent): void {
  event.preventDefault();
  event.stopPropagation();
  event.stopImmediatePropagation();
}

function isResizeHandleEventTarget(event: Event): boolean {
  return Boolean(resolveEditorEventElement(event)?.closest(RESIZE_HANDLE_SELECTOR));
}

function isEditableEventTarget(event: Event): boolean {
  return Boolean(resolveEditorEventElement(event)?.closest(EDITABLE_TARGET_SELECTOR));
}
