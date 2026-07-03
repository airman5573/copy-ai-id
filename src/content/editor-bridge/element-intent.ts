import { isExtensionOwnedElement } from '../../shared/config';
import {
  type ElementIntent,
  sortElementIntents,
} from '../../shared/domain/intent';
import { getComposedChildElements } from '../target/composed-dom';
import {
  isContentEditableElement,
  tagNameOf,
} from './lib/dom';

const IMAGE_TAGS = new Set(['img', 'svg', 'picture']);

const TEXT_TAGS = new Set([
  'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
  'p', 'span', 'a', 'label', 'li', 'blockquote',
  'strong', 'em', 'b', 'i', 'small', 'mark', 'code', 'pre',
  'figcaption', 'caption', 'td', 'th', 'dt', 'dd',
]);

const FORM_TAGS = new Set(['input', 'textarea', 'select']);

const LINK_BUTTON_INPUT_TYPES = new Set(['button', 'submit', 'reset']);

// Classifies which quick-toolbar intents apply to an element. Multiple
// intents are allowed; the result is sorted by INTENT_PRIORITY.
export function classifyElementIntents(element: Element): ElementIntent[] {
  if (!element.isConnected || isExtensionOwnedElement(element)) {
    return [];
  }

  const tagName = tagNameOf(element);
  const computedStyle = computedStyleForElement(element);
  const intents: ElementIntent[] = [];

  if (hasImageIntent(tagName, computedStyle)) {
    intents.push('image');
  }
  if (hasFormIntent(element, tagName)) {
    intents.push('form');
  }
  if (hasLinkButtonIntent(element, tagName)) {
    intents.push('link-button');
  }
  if (hasTextIntent(element, tagName)) {
    intents.push('text');
  }
  if (hasContainerIntent(element, computedStyle)) {
    intents.push('container');
  }

  return sortElementIntents(intents);
}

function hasImageIntent(
  tagName: string,
  computedStyle: CSSStyleDeclaration | null,
): boolean {
  if (IMAGE_TAGS.has(tagName)) {
    return true;
  }

  // svg descendants (path, g, …) count as part of an image but are covered
  // by targeting the svg root; only the background-image case remains here.
  const backgroundImage = computedStyle?.getPropertyValue('background-image').trim() ?? '';
  return backgroundImage.length > 0 && backgroundImage !== 'none';
}

function hasFormIntent(element: Element, tagName: string): boolean {
  return FORM_TAGS.has(tagName) || isContentEditableElement(element);
}

function hasLinkButtonIntent(element: Element, tagName: string): boolean {
  if (tagName === 'button') {
    return true;
  }

  if (tagName === 'a') {
    return element.hasAttribute('href');
  }

  if (element.getAttribute('role')?.toLowerCase() === 'button') {
    return true;
  }

  return element instanceof HTMLInputElement && LINK_BUTTON_INPUT_TYPES.has(element.type);
}

function hasTextIntent(element: Element, tagName: string): boolean {
  if (TEXT_TAGS.has(tagName)) {
    return true;
  }

  return hasDirectTextNode(element);
}

function hasContainerIntent(
  element: Element,
  computedStyle: CSSStyleDeclaration | null,
): boolean {
  const display = computedStyle?.display ?? '';
  if (display.includes('flex') || display.includes('grid')) {
    return true;
  }

  if (display === 'inline') {
    return false;
  }

  return getComposedChildElements(element)
    .some((child) => !isExtensionOwnedElement(child));
}

function hasDirectTextNode(element: Element): boolean {
  for (const node of Array.from(element.childNodes)) {
    if (node.nodeType === Node.TEXT_NODE && (node.textContent ?? '').trim().length > 0) {
      return true;
    }
  }
  return false;
}

function computedStyleForElement(element: Element): CSSStyleDeclaration | null {
  const view = element.ownerDocument.defaultView;
  return view ? view.getComputedStyle(element) : null;
}
