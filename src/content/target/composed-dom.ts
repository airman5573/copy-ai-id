/**
 * Shadow-aware DOM traversal helpers for Copy AI ID target discovery.
 *
 * These helpers intentionally support only open Shadow DOM. Closed shadow roots
 * are not exposed through the platform APIs, so callers can only interact with
 * their visible host elements.
 */

export function isShadowRoot(value: unknown): value is ShadowRoot {
  return typeof ShadowRoot !== 'undefined' && value instanceof ShadowRoot;
}

export function getComposedParentElement(element: Element): Element | null {
  if (element.parentElement) {
    return element.parentElement;
  }

  const root = element.getRootNode();
  return isShadowRoot(root) ? root.host : null;
}

export function* walkComposedAncestors(
  element: Element | null,
  options: { includeSelf?: boolean } = {},
): Generator<Element> {
  let current = options.includeSelf ? element : element ? getComposedParentElement(element) : null;

  while (current) {
    yield current;
    current = getComposedParentElement(current);
  }
}

export function closestComposedElementMatching(
  element: Element | null,
  predicate: (candidate: Element) => boolean,
): Element | null {
  for (const candidate of walkComposedAncestors(element, { includeSelf: true })) {
    if (predicate(candidate)) {
      return candidate;
    }
  }

  return null;
}

export function getDeepElementFromPoint(
  x: number,
  y: number,
  root: Document | ShadowRoot = document,
): Element | null {
  return getComposedElementsFromPoint(x, y, root)[0] ?? null;
}

export function getComposedElementsFromPoint(
  x: number,
  y: number,
  root: Document | ShadowRoot = document,
): Element[] {
  const result: Element[] = [];
  const visited = new Set<Element>();

  collectComposedElementsFromPoint(root, x, y, visited, result);
  return result;
}

function collectComposedElementsFromPoint(
  root: Document | ShadowRoot,
  x: number,
  y: number,
  visited: Set<Element>,
  result: Element[],
): void {
  const elements = root.elementsFromPoint(x, y);

  for (const element of elements) {
    if (visited.has(element)) {
      continue;
    }

    visited.add(element);

    const shadowRoot = getOpenShadowRoot(element);
    if (shadowRoot) {
      collectComposedElementsFromPoint(shadowRoot, x, y, visited, result);
    }

    result.push(element);
  }
}

export function getOpenShadowRoot(element: Element): ShadowRoot | null {
  return element instanceof HTMLElement ? element.shadowRoot : null;
}

export function getComposedChildElements(element: Element): Element[] {
  const shadowRoot = getOpenShadowRoot(element);
  const shadowChildren = shadowRoot ? Array.from(shadowRoot.children) : [];
  const lightChildren = Array.from(element.children);

  return [...shadowChildren, ...lightChildren];
}

export function getComposedSiblingElement(
  element: Element,
  direction: 'previous' | 'next',
): Element | null {
  const parent = getComposedParentElement(element);
  if (!parent) {
    return null;
  }

  const siblings = getComposedChildElements(parent);
  const currentIndex = siblings.indexOf(element);
  if (currentIndex < 0) {
    return null;
  }

  const siblingIndex = direction === 'previous'
    ? currentIndex - 1
    : currentIndex + 1;

  return siblings[siblingIndex] ?? null;
}
