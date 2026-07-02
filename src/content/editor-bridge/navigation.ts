import { isExtensionOwnedElement } from '../../shared/config';
import type { EditorKeyboardShortcut } from '../../shared/editor-messages';
import {
  getComposedChildElements,
  getComposedParentElement,
  getComposedSiblingElement,
} from '../target/composed-dom';
import {
  getHighlightedElement,
  setHighlightedElement,
  suppressHoverHighlightUntilMouseMove,
} from './highlight';
import type { BridgePost } from './types';

type NavigationDirection =
  | 'parent'
  | 'first-child-or-next-sibling-or-parent-next-first-child'
  | 'previous-sibling-or-parent-previous-last-child'
  | 'next-sibling-or-parent-next-first-child';

const SHORTCUT_DIRECTIONS: Partial<Record<EditorKeyboardShortcut, NavigationDirection>> = {
  'arrow-up': 'parent',
  'arrow-down': 'first-child-or-next-sibling-or-parent-next-first-child',
  'arrow-left': 'previous-sibling-or-parent-previous-last-child',
  'arrow-right': 'next-sibling-or-parent-next-first-child',
};

const SKIPPED_NAVIGATION_TAGS = new Set([
  'html',
  'head',
  'script',
  'style',
  'link',
  'meta',
  'noscript',
  'template',
]);

export function handleNavigationShortcut(
  shortcut: EditorKeyboardShortcut,
  post: BridgePost,
  onWillNavigate?: () => void,
): boolean {
  const direction = SHORTCUT_DIRECTIONS[shortcut];
  if (!direction) {
    return false;
  }

  const current = getHighlightedElement();
  if (!current) {
    return false;
  }

  const next = resolveNavigationTarget(current, direction);
  if (!next) {
    return false;
  }

  suppressHoverHighlightUntilMouseMove();
  onWillNavigate?.();
  next.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'center' });
  setHighlightedElement(next, post);
  return true;
}

function resolveNavigationTarget(
  element: Element,
  direction: NavigationDirection,
): Element | null {
  switch (direction) {
    case 'parent':
      return resolveParentLayoutElement(element);
    case 'first-child-or-next-sibling-or-parent-next-first-child':
      return findFirstChildLayoutElement(element)
        ?? findSiblingLayoutElement(element, 'next')
        ?? findParentSiblingChildOrSelfLayoutElement(element, 'next', 'first');
    case 'previous-sibling-or-parent-previous-last-child':
      return findSiblingLayoutElement(element, 'previous')
        ?? findParentSiblingChildOrSelfLayoutElement(element, 'previous', 'last');
    case 'next-sibling-or-parent-next-first-child':
      return findSiblingLayoutElement(element, 'next')
        ?? findParentSiblingChildOrSelfLayoutElement(element, 'next', 'first');
  }
}

function resolveParentLayoutElement(element: Element): Element | null {
  const parent = getComposedParentElement(element);
  if (!parent || !isNavigableLayoutElement(parent)) {
    return null;
  }

  return parent;
}

function findFirstChildLayoutElement(element: Element): Element | null {
  for (const child of getComposedChildElements(element)) {
    if (isNavigableLayoutElement(child)) {
      return child;
    }
  }

  return null;
}

function findLastChildLayoutElement(element: Element): Element | null {
  const children = getComposedChildElements(element).filter(isNavigableLayoutElement);
  return children[children.length - 1] ?? null;
}

function findSiblingLayoutElement(
  element: Element,
  direction: 'previous' | 'next',
): Element | null {
  let sibling = getComposedSiblingElement(element, direction);

  while (sibling) {
    if (isNavigableLayoutElement(sibling)) {
      return sibling;
    }

    sibling = getComposedSiblingElement(sibling, direction);
  }

  return null;
}

function findParentSiblingChildOrSelfLayoutElement(
  element: Element,
  direction: 'previous' | 'next',
  child: 'first' | 'last',
): Element | null {
  const parent = resolveParentLayoutElement(element);
  if (!parent) {
    return null;
  }

  const sibling = findSiblingLayoutElement(parent, direction);
  if (!sibling) {
    return null;
  }

  if (child === 'first') {
    return findFirstChildLayoutElement(sibling) ?? sibling;
  }

  return findLastChildLayoutElement(sibling) ?? sibling;
}

function isNavigableLayoutElement(element: Element): boolean {
  const tagName = element.tagName.toLowerCase();
  return !SKIPPED_NAVIGATION_TAGS.has(tagName) && !isExtensionOwnedElement(element);
}
