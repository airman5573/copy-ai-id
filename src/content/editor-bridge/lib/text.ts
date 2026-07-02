export function normalizeWhitespace(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}

export function tokenizeClassValue(value: string): string[] {
  return value.split(/\s+/).map((token) => token.trim()).filter(Boolean);
}

export function classTokensForElement(element: Element): string[] {
  return tokenizeClassValue(element.getAttribute('class') ?? '');
}

/**
 * Direct (own) text of an element: input/textarea value, or the concatenated
 * text of the element's immediate text-node children. Untrimmed — callers
 * apply their own preview-length trimming.
 */
export function elementOwnText(
  element: Element,
  options: { inputPlaceholderFallback?: boolean } = {},
): string {
  if (element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement) {
    return options.inputPlaceholderFallback
      ? (element.value || element.placeholder || '')
      : element.value;
  }

  let text = '';
  for (const node of Array.from(element.childNodes)) {
    if (node.nodeType === Node.TEXT_NODE) {
      text += node.textContent ?? '';
    }
  }

  return text;
}
