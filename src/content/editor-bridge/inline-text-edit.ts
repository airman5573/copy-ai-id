import { EDITOR_MESSAGE_TYPES } from '../../shared/protocol/editor-bridge-messages';
import { isChipBadgeEventTarget } from './chip-badges';
import { classifyElementIntents } from './element-intent';
import { setInlineTextEditHighlightSuppressed } from './highlight';
import { tagNameOf } from './lib/dom';
import {
  resolveStrictPointHitFromMouseEvent,
  targetReferenceForElement,
} from './local-picker';
import type { BridgePost } from './types';

// Preview double-click inline text editing. The element becomes a temporary
// contenteditable; on commit it is reverted to the original text first and
// the editor re-applies the change through the regular updateVisualText
// mutation, so records/undo reuse the existing pipeline.

interface InlineTextEditSession {
  element: HTMLElement;
  previousValue: string;
  previousContentEditableAttr: string | null;
  teardown: () => void;
}

const MEDIA_TAGS = new Set(['img', 'svg', 'picture', 'video', 'audio', 'canvas', 'iframe', 'object', 'embed']);
const FORM_TAGS = new Set(['input', 'textarea', 'select', 'option', 'optgroup']);

let activeSession: InlineTextEditSession | null = null;

export function installInlineTextEdit(post: BridgePost): () => void {
  const handleDoubleClick = (event: MouseEvent): void => {
    if (activeSession || isChipBadgeEventTarget(event.target)) {
      return;
    }

    const element = resolveStrictPointHitFromMouseEvent(event)?.element ?? null;
    if (!element || !isInlineTextEditable(element)) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    beginEdit(element, post);
  };

  document.addEventListener('dblclick', handleDoubleClick, true);

  return () => {
    document.removeEventListener('dblclick', handleDoubleClick, true);
    cancelActiveEdit();
  };
}

export function isInlineTextEditActive(): boolean {
  return activeSession !== null;
}

function isInlineTextEditable(element: Element): element is HTMLElement {
  if (!(element instanceof HTMLElement) || element.isContentEditable) {
    return false;
  }

  const tagName = tagNameOf(element);
  if (MEDIA_TAGS.has(tagName) || FORM_TAGS.has(tagName)) {
    return false;
  }

  return classifyElementIntents(element).includes('text');
}

function beginEdit(element: HTMLElement, post: BridgePost): void {
  const previousValue = element.textContent ?? '';
  const previousContentEditableAttr = element.getAttribute('contenteditable');

  element.setAttribute('contenteditable', 'plaintext-only');
  const plaintextSupported = element.isContentEditable;
  if (!plaintextSupported) {
    element.setAttribute('contenteditable', 'true');
  }

  const handleKeyDown = (event: KeyboardEvent): void => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      event.stopPropagation();
      commitActiveEdit(post);
      return;
    }

    if (event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      cancelActiveEdit();
    }
  };

  const handleBlur = (): void => {
    commitActiveEdit(post);
  };

  // Fallback when plaintext-only is unsupported: force pasted content to
  // plain text so the commit value stays textContent-shaped.
  const handlePaste = (event: ClipboardEvent): void => {
    if (plaintextSupported) {
      return;
    }

    event.preventDefault();
    const text = event.clipboardData?.getData('text/plain') ?? '';
    insertPlainText(element, text);
  };

  element.addEventListener('keydown', handleKeyDown, true);
  element.addEventListener('blur', handleBlur);
  element.addEventListener('paste', handlePaste, true);

  activeSession = {
    element,
    previousValue,
    previousContentEditableAttr,
    teardown: () => {
      element.removeEventListener('keydown', handleKeyDown, true);
      element.removeEventListener('blur', handleBlur);
      element.removeEventListener('paste', handlePaste, true);
      if (previousContentEditableAttr === null) {
        element.removeAttribute('contenteditable');
      } else {
        element.setAttribute('contenteditable', previousContentEditableAttr);
      }
    },
  };

  setInlineTextEditHighlightSuppressed(true);
  element.focus({ preventScroll: true });
  selectElementContents(element);
}

function commitActiveEdit(post: BridgePost): void {
  const session = endActiveEdit();
  if (!session) {
    return;
  }

  const value = session.element.textContent ?? '';
  session.element.textContent = session.previousValue;
  if (value === session.previousValue) {
    return;
  }

  const reference = targetReferenceForElement(session.element);
  if (!reference?.target) {
    return;
  }

  post({
    type: EDITOR_MESSAGE_TYPES.inlineTextEditCommitted,
    target: reference.target,
    nodeId: reference.nodeId,
    value,
    previousValue: session.previousValue,
  });
}

function cancelActiveEdit(): void {
  const session = endActiveEdit();
  if (!session) {
    return;
  }

  session.element.textContent = session.previousValue;
}

function endActiveEdit(): InlineTextEditSession | null {
  const session = activeSession;
  if (!session) {
    return null;
  }

  activeSession = null;
  session.teardown();
  setInlineTextEditHighlightSuppressed(false);
  clearSelection(session.element);
  return session;
}

function selectElementContents(element: HTMLElement): void {
  const selection = element.ownerDocument.getSelection();
  if (!selection) {
    return;
  }

  const range = element.ownerDocument.createRange();
  range.selectNodeContents(element);
  selection.removeAllRanges();
  selection.addRange(range);
}

function clearSelection(element: HTMLElement): void {
  element.ownerDocument.getSelection()?.removeAllRanges();
}

function insertPlainText(element: HTMLElement, text: string): void {
  const selection = element.ownerDocument.getSelection();
  if (!selection || selection.rangeCount === 0) {
    element.textContent = (element.textContent ?? '') + text;
    return;
  }

  const range = selection.getRangeAt(0);
  range.deleteContents();
  range.insertNode(element.ownerDocument.createTextNode(text));
  range.collapse(false);
  selection.removeAllRanges();
  selection.addRange(range);
}
