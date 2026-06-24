import { EDITOR_MESSAGE_TYPES, type EditorKeyboardShortcut } from '../shared/editor-messages';
import { postToBridge } from './bridge/bridgeClient';
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
const NOTEBOOK_LEXICAL_EDITOR_AI_ID = 'copy-ai-id-editor-note-lexical-editor';
const PREVIEW_RESIZE_HANDLE_AI_IDS = new Set([
  'copy-ai-id-editor-preview-height-resize-handle',
  'copy-ai-id-editor-preview-width-resize-handle',
]);

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

    if (isEditableEventTarget(event) || isPreviewResizeHandleEventTarget(event)) {
      return;
    }

    if (shouldLetLayoutTreeHandleEvent(event)) {
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
      if (handleEditorShortcutAction('space')) {
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
  if (result !== 'visual-panel') {
    postToBridge({ type: EDITOR_MESSAGE_TYPES.hoverTreeNode, nodeId: null });
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

function shouldHandleShiftEnter(event: KeyboardEvent): boolean {
  if (!isEditableEventTarget(event)) {
    return true;
  }

  return event.composedPath().some((target) => {
    return target instanceof HTMLElement
      && target.dataset.aiId === NOTEBOOK_LEXICAL_EDITOR_AI_ID;
  });
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

function shouldLetLayoutTreeHandleEvent(event: KeyboardEvent): boolean {
  if (!isLayoutTreeEventTarget(event) || !hasNoModifier(event)) {
    return false;
  }

  return Boolean(ARROW_SHORTCUTS[event.key])
    || event.key === 'Enter'
    || event.code === 'Space';
}

function isLayoutTreeEventTarget(event: Event): boolean {
  return event.composedPath().some((target) => {
    return target instanceof HTMLElement
      && (target.dataset.aiId === 'copy-ai-id-editor-layout-tree'
        || target.dataset.aiId === 'copy-ai-id-editor-layout-tree-node-row'
        || target.hasAttribute('data-copy-ai-id-tree-node-id'));
  });
}

function isPreviewResizeHandleEventTarget(event: Event): boolean {
  return event.composedPath().some((target) => {
    return target instanceof HTMLElement
      && PREVIEW_RESIZE_HANDLE_AI_IDS.has(target.dataset.aiId ?? '');
  });
}

function isEditableEventTarget(event: Event): boolean {
  return event.composedPath().some((target) => {
    if (!(target instanceof Element)) {
      return false;
    }

    return Boolean(target.closest(
      'input, textarea, select, [contenteditable=""], [contenteditable="true"], [contenteditable="plaintext-only"], [role="textbox"]',
    ));
  });
}
