import { isExtensionOwnedElement } from '../../../shared/config';

export function tagNameOf(element: Element): string {
  return element.tagName.toLowerCase();
}

export function isContentEditableElement(element: Element): element is HTMLElement {
  return element instanceof HTMLElement && (
    element.isContentEditable
    || element.getAttribute('contenteditable') === ''
    || element.getAttribute('contenteditable')?.toLowerCase() === 'true'
  );
}

export function dispatchNativeInputEvents(element: HTMLElement): void {
  element.dispatchEvent(new Event('input', { bubbles: true }));
  element.dispatchEvent(new Event('change', { bubbles: true }));
}

export function previousEditableSibling(element: Element): Element | null {
  let sibling = element.previousElementSibling;
  while (sibling && isExtensionOwnedElement(sibling)) {
    sibling = sibling.previousElementSibling;
  }
  return sibling;
}

export function nextEditableSibling(element: Element): Element | null {
  let sibling = element.nextElementSibling;
  while (sibling && isExtensionOwnedElement(sibling)) {
    sibling = sibling.nextElementSibling;
  }
  return sibling;
}

export function isResolvableElement(element: Element): boolean {
  return element.isConnected && !isExtensionOwnedElement(element);
}
