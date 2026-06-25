import { EDITOR_MESSAGE_TYPES, type EditorKeyboardShortcut } from '../../shared/editor-messages';
import { handleNavigationShortcut } from './navigation';
import { clearHighlightedElement, requestHighlightedTargetReference, type BridgePost } from './highlight';

const Z_CODE = 'KeyZ';
const SPACE_CODE = 'Space';

export function installBridgeKeyboard(post: BridgePost): () => void {
  let zKeyPressed = false;

  const handleKeyDown = (event: KeyboardEvent): void => {
    if (event.code === Z_CODE) {
      zKeyPressed = true;
    }

    if (isShiftZSpace(event, zKeyPressed)) {
      consumeKeyboardEvent(event);
      window.parent.postMessage({
        source: 'copy-ai-id-content-script',
        type: 'copy-ai-id:set-top-editor-enabled',
        enabled: false,
      }, '*');
      return;
    }

    if (event.defaultPrevented || event.isComposing || isEditableEventTarget(event)) {
      return;
    }

    if (event.key === 'Escape' && hasNoModifier(event)) {
      consumeKeyboardEvent(event);
      post({ type: EDITOR_MESSAGE_TYPES.keyboardShortcut, shortcut: 'escape' });
      return;
    }

    if (event.key === 'Enter' && event.shiftKey && !event.metaKey && !event.ctrlKey && !event.altKey && !event.repeat) {
      consumeKeyboardEvent(event);
      post({ type: EDITOR_MESSAGE_TYPES.keyboardShortcut, shortcut: 'shift-enter' });
      return;
    }

    if (event.code === SPACE_CODE && hasNoModifier(event) && !event.repeat) {
      if (requestHighlightedTargetReference(post)) {
        consumeKeyboardEvent(event);
      }
      return;
    }

    const shortcut = shortcutForArrowKey(event.key);
    if (shortcut && hasNoModifier(event)) {
      const handled = handleNavigationShortcut(shortcut, post, () => {
        post({ type: EDITOR_MESSAGE_TYPES.keyboardShortcut, shortcut });
      });

      if (handled || isVerticalArrowKey(event.key)) {
        consumeKeyboardEvent(event);
      }
    }
  };

  const handleKeyUp = (event: KeyboardEvent): void => {
    if (event.code === Z_CODE) {
      zKeyPressed = false;
    }
  };

  const resetPressedKeys = (): void => {
    zKeyPressed = false;
  };

  window.addEventListener('keydown', handleKeyDown, true);
  window.addEventListener('keyup', handleKeyUp, true);
  window.addEventListener('blur', resetPressedKeys);

  return () => {
    window.removeEventListener('keydown', handleKeyDown, true);
    window.removeEventListener('keyup', handleKeyUp, true);
    window.removeEventListener('blur', resetPressedKeys);
  };
}

export function handleBridgeKeyboardShortcut(
  shortcut: EditorKeyboardShortcut,
  post: BridgePost,
): boolean {
  if (shortcut === 'escape') {
    clearHighlightedElement(post);
    return true;
  }

  return handleNavigationShortcut(shortcut, post);
}

function shortcutForArrowKey(key: string): 'arrow-up' | 'arrow-down' | 'arrow-left' | 'arrow-right' | null {
  switch (key) {
    case 'ArrowUp':
      return 'arrow-up';
    case 'ArrowDown':
      return 'arrow-down';
    case 'ArrowLeft':
      return 'arrow-left';
    case 'ArrowRight':
      return 'arrow-right';
    default:
      return null;
  }
}

function isShiftZSpace(event: KeyboardEvent, zKeyPressed: boolean): boolean {
  return event.code === SPACE_CODE
    && event.shiftKey
    && zKeyPressed
    && !event.metaKey
    && !event.ctrlKey
    && !event.altKey
    && !event.repeat;
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

function isEditableEventTarget(event: Event): boolean {
  const path = typeof event.composedPath === 'function' ? event.composedPath() : [];
  const nodes: EventTarget[] = path.length > 0 ? path : event.target ? [event.target] : [];

  for (const node of nodes) {
    if (node instanceof Document || node instanceof Window) {
      break;
    }

    if (!(node instanceof HTMLElement)) {
      continue;
    }

    const tagName = node.tagName.toLowerCase();
    if (tagName === 'input'
      || tagName === 'textarea'
      || tagName === 'select'
      || node.isContentEditable
      || node.getAttribute('role') === 'textbox'
    ) {
      return true;
    }
  }

  return false;
}
