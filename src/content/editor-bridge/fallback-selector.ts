import type { FallbackSelectorKind } from '../../shared/domain/targets';
import { getComposedParentElement } from '../target/composed-dom';
import { tagNameOf } from './lib/dom';
import {
  cssEscape,
  meaningfulClassTokens,
  querySelectorAllSafe,
  shadowRootForElement,
} from './fallback-utils';

// CSS-selector and human-readable-path generation for no-id elements.
const UNIQUE_SEMANTIC_TAGS = new Set(['main', 'nav', 'header', 'footer']);

export interface SelectorResult {
  selector: string;
  selectorKind: FallbackSelectorKind;
}

export function generateFallbackSelector(element: Element): SelectorResult {
  const shadowRoot = shadowRootForElement(element);
  if (shadowRoot) {
    const hostSelector = generateFallbackSelector(shadowRoot.host).selector;
    const innerSelector = generateSelectorInRoot(element, shadowRoot).selector;
    return {
      selector: `${hostSelector} ::shadow ${innerSelector}`,
      selectorKind: 'shadow-path',
    };
  }

  return generateSelectorInRoot(element, element.ownerDocument);
}

function generateSelectorInRoot(element: Element, root: Document | ShadowRoot): SelectorResult {
  const semanticSelector = uniqueSemanticSelector(element, root);
  if (semanticSelector) {
    return semanticSelector;
  }

  const idSelector = uniqueIdSelector(element, root);
  if (idSelector) {
    return idSelector;
  }

  const classSelector = uniqueClassSelector(element, root);
  if (classSelector) {
    return classSelector;
  }

  return {
    selector: nthChildSelector(element, root),
    selectorKind: 'nth-child',
  };
}

function uniqueSemanticSelector(element: Element, root: Document | ShadowRoot): SelectorResult | null {
  const tag = tagNameOf(element);
  if (!UNIQUE_SEMANTIC_TAGS.has(tag)) {
    return null;
  }

  return querySelectorAllSafe(root, tag).length === 1
    ? { selector: tag, selectorKind: 'unique-semantic-tag' }
    : null;
}

function uniqueIdSelector(element: Element, root: Document | ShadowRoot): SelectorResult | null {
  const id = element.id.trim();
  if (!id) {
    return null;
  }

  const selector = `#${cssEscape(id)}`;
  return querySelectorAllSafe(root, selector).length === 1
    ? { selector, selectorKind: 'id' }
    : null;
}

function uniqueClassSelector(element: Element, root: Document | ShadowRoot): SelectorResult | null {
  const tag = tagNameOf(element);
  for (const token of meaningfulClassTokens(element)) {
    const selector = `${tag}.${cssEscape(token)}`;
    if (querySelectorAllSafe(root, selector).length === 1) {
      return { selector, selectorKind: 'unique-class' };
    }
  }

  return null;
}

function nthChildSelector(element: Element, root: Document | ShadowRoot): string {
  const tag = tagNameOf(element);
  const parent = element.parentElement;

  if (!parent) {
    const rootChildren = Array.from(root.children);
    const index = Math.max(1, rootChildren.indexOf(element) + 1);
    return `${tag}:nth-child(${index})`;
  }

  if (parent === element.ownerDocument.body) {
    return `body > ${tag}:nth-child(${childIndex(element)})`;
  }

  const parentSelector = generateSelectorInRoot(parent, root).selector;
  return `${parentSelector} > ${tag}:nth-child(${childIndex(element)})`;
}

function childIndex(element: Element): number {
  const parent = element.parentElement;
  return parent ? Math.max(1, Array.from(parent.children).indexOf(element) + 1) : 1;
}

export function getElementPath(element: Element, maxDepth: number): string {
  const parts: string[] = [];
  let current: Element | null = element;
  let depth = 0;

  while (current && depth < maxDepth) {
    const tag = tagNameOf(current);
    if (tag === 'html') {
      break;
    }

    let identifier = tag;
    if (current.id) {
      identifier = `${tag}#${current.id}`;
    } else {
      const classToken = meaningfulClassTokens(current)[0];
      if (classToken) {
        identifier = `${tag}.${classToken}`;
      }
    }

    const parent = getComposedParentElement(current);
    if (!current.parentElement && parent) {
      identifier = `⟨shadow⟩ ${identifier}`;
    }

    parts.unshift(identifier);
    current = parent;
    depth += 1;
  }

  return parts.join(' > ');
}

