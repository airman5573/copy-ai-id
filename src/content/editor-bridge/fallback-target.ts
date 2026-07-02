import { DATA_AI_ID_ATTRIBUTE, isExtensionOwnedElement } from '../../shared/config';
import { tagNameOf } from './lib/dom';
import {
  classTokensForElement,
  elementOwnText,
} from './lib/text';
import type {
  FallbackEditorTarget,
  FallbackSelectorKind,
  FallbackTargetMetadata,
} from '../../shared/editor-messages';
import {
  closestComposedElementMatching,
  getComposedParentElement,
  isShadowRoot,
} from '../target/composed-dom';

const LABEL_TEXT_LENGTH = 40;
const TEXT_PREVIEW_LENGTH = 80;
const NEARBY_TEXT_LENGTH = 56;
const FULL_PATH_MAX_DEPTH = 24;
const SHORT_PATH_MAX_DEPTH = 4;
const UNIQUE_SEMANTIC_TAGS = new Set(['main', 'nav', 'header', 'footer']);
const TEXT_TAGS = new Set(['p', 'span', 'label', 'li', 'blockquote', 'code', 'pre']);
const CONTAINER_TAGS = new Set(['div', 'section', 'article', 'nav', 'header', 'footer', 'aside', 'main', 'form', 'ul', 'ol']);
const GRAPHIC_TAGS = new Set(['path', 'circle', 'rect', 'line', 'ellipse', 'polygon', 'polyline', 'g']);

interface SelectorResult {
  selector: string;
  selectorKind: FallbackSelectorKind;
}

export function fallbackTargetForElement(
  element: Element,
  nodeId: string | null,
): FallbackEditorTarget | null {
  if (!nodeId) {
    return null;
  }

  const metadata = fallbackMetadataForElement(element);
  if (!metadata) {
    return null;
  }

  return {
    kind: 'fallback',
    nodeId,
    ...metadata,
  };
}

export function fallbackMetadataForElement(element: Element): FallbackTargetMetadata | null {
  if (!isFallbackCandidate(element)) {
    return null;
  }

  const selector = generateFallbackSelector(element);
  const textPreview = directTextPreview(element);
  const nearbyText = getNearbyText(element);
  const accessibility = getAccessibilityInfo(element);

  return {
    tagName: tagNameOf(element),
    label: identifyElementLabel(element),
    selector: selector.selector,
    selectorKind: selector.selectorKind,
    path: getElementPath(element, SHORT_PATH_MAX_DEPTH),
    fullPath: getElementPath(element, FULL_PATH_MAX_DEPTH),
    textPreview: textPreview || undefined,
    nearbyText: nearbyText || undefined,
    classTokens: getClassTokens(element),
    accessibility: accessibility || undefined,
  };
}

function isFallbackCandidate(element: Element): boolean {
  if (!element.isConnected || isExtensionOwnedElement(element)) {
    return false;
  }

  const aiId = element.getAttribute(DATA_AI_ID_ATTRIBUTE)?.trim() ?? '';
  return aiId.length === 0;
}

function identifyElementLabel(element: Element): string {
  const explicitLabel = element.getAttribute('data-element')?.trim();
  if (explicitLabel) {
    return trimText(explicitLabel, LABEL_TEXT_LENGTH);
  }

  const tag = tagNameOf(element);
  const ariaLabel = element.getAttribute('aria-label')?.trim();
  const role = element.getAttribute('role')?.trim();

  if (GRAPHIC_TAGS.has(tag)) {
    const svg = closestComposedElementMatching(element, (candidate) => tagNameOf(candidate) === 'svg');
    const parent = svg ? getComposedParentElement(svg) : null;
    if (parent && tagNameOf(parent) === 'button') {
      const buttonText = trimText(parent.textContent ?? '', LABEL_TEXT_LENGTH);
      return buttonText ? `graphic in button "${buttonText}"` : 'button graphic';
    }
    return 'graphic element';
  }

  if (tag === 'svg') {
    const parent = getComposedParentElement(element);
    if (parent && tagNameOf(parent) === 'button') {
      const buttonText = trimText(parent.textContent ?? '', LABEL_TEXT_LENGTH);
      return buttonText ? `icon in button "${buttonText}"` : 'button icon';
    }
    return ariaLabel ? `icon [${trimText(ariaLabel, LABEL_TEXT_LENGTH)}]` : 'icon';
  }

  if (tag === 'button') {
    if (ariaLabel) {
      return `button [${trimText(ariaLabel, LABEL_TEXT_LENGTH)}]`;
    }
    const text = trimText(element.textContent ?? '', LABEL_TEXT_LENGTH);
    return text ? `button "${text}"` : 'button';
  }

  if (tag === 'a') {
    const text = trimText(element.textContent ?? '', LABEL_TEXT_LENGTH);
    const href = element.getAttribute('href')?.trim();
    if (text) {
      return `link "${text}"`;
    }
    return href ? `link to ${trimText(href, LABEL_TEXT_LENGTH)}` : 'link';
  }

  if (tag === 'input') {
    const inputType = element.getAttribute('type')?.trim() || 'text';
    const placeholder = element.getAttribute('placeholder')?.trim();
    const name = element.getAttribute('name')?.trim();
    if (placeholder) {
      return `input "${trimText(placeholder, LABEL_TEXT_LENGTH)}"`;
    }
    return name ? `input [${trimText(name, LABEL_TEXT_LENGTH)}]` : `${inputType} input`;
  }

  if (tag === 'textarea') {
    const placeholder = element.getAttribute('placeholder')?.trim();
    const name = element.getAttribute('name')?.trim();
    if (placeholder) {
      return `textarea "${trimText(placeholder, LABEL_TEXT_LENGTH)}"`;
    }
    return name ? `textarea [${trimText(name, LABEL_TEXT_LENGTH)}]` : 'textarea';
  }

  if (tag === 'select') {
    const name = element.getAttribute('name')?.trim();
    return name ? `select [${trimText(name, LABEL_TEXT_LENGTH)}]` : 'select';
  }

  if (/^h[1-6]$/.test(tag)) {
    const text = trimText(element.textContent ?? '', LABEL_TEXT_LENGTH);
    return text ? `${tag} "${text}"` : tag;
  }

  if (TEXT_TAGS.has(tag)) {
    const text = trimText(element.textContent ?? '', LABEL_TEXT_LENGTH);
    if (text) {
      return tag === 'span' || tag === 'label' ? `"${text}"` : `${textLabelPrefix(tag)} "${text}"`;
    }
    return textLabelPrefix(tag);
  }

  if (tag === 'img') {
    const alt = element.getAttribute('alt')?.trim();
    return alt ? `image "${trimText(alt, LABEL_TEXT_LENGTH)}"` : 'image';
  }

  if (tag === 'video') {
    return 'video';
  }

  if (tag === 'canvas') {
    return 'canvas';
  }

  if (ariaLabel) {
    return `${tag} [${trimText(ariaLabel, LABEL_TEXT_LENGTH)}]`;
  }

  if (role) {
    return role;
  }

  if (CONTAINER_TAGS.has(tag)) {
    const classWords = meaningfulClassTokens(element)
      .flatMap((token) => token.split(/[-_:/]+/))
      .filter((token) => token.length > 2)
      .slice(0, 2);
    if (classWords.length > 0) {
      return classWords.join(' ');
    }

    return tag === 'div' ? 'container' : tag;
  }

  return tag;
}

function textLabelPrefix(tag: string): string {
  switch (tag) {
    case 'p':
      return 'paragraph';
    case 'li':
      return 'list item';
    case 'pre':
      return 'code block';
    default:
      return tag;
  }
}

function generateFallbackSelector(element: Element): SelectorResult {
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

function getElementPath(element: Element, maxDepth: number): string {
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

function directTextPreview(element: Element): string {
  return trimText(elementOwnText(element, { inputPlaceholderFallback: true }), TEXT_PREVIEW_LENGTH);
}

function getNearbyText(element: Element): string {
  const parts: string[] = [];
  const ownText = trimText(element.textContent ?? '', TEXT_PREVIEW_LENGTH);
  const previousText = siblingText(element.previousElementSibling);
  const nextText = siblingText(element.nextElementSibling);

  if (previousText) {
    parts.push(`[before: "${previousText}"]`);
  }
  if (ownText) {
    parts.push(ownText);
  }
  if (nextText) {
    parts.push(`[after: "${nextText}"]`);
  }

  return parts.join(' ');
}

function siblingText(element: Element | null): string {
  if (!element || isExtensionOwnedElement(element)) {
    return '';
  }

  return trimText(element.textContent ?? '', NEARBY_TEXT_LENGTH);
}

function getAccessibilityInfo(element: Element): string {
  const parts: string[] = [];
  const role = element.getAttribute('role')?.trim();
  const ariaLabel = element.getAttribute('aria-label')?.trim();
  const ariaDescribedBy = element.getAttribute('aria-describedby')?.trim();
  const tabIndex = element.getAttribute('tabindex')?.trim();
  const ariaHidden = element.getAttribute('aria-hidden')?.trim();

  if (role) {
    parts.push(`role="${role}"`);
  }
  if (ariaLabel) {
    parts.push(`aria-label="${trimText(ariaLabel, TEXT_PREVIEW_LENGTH)}"`);
  }
  if (ariaDescribedBy) {
    parts.push(`aria-describedby="${ariaDescribedBy}"`);
  }
  if (tabIndex) {
    parts.push(`tabindex=${tabIndex}`);
  }
  if (ariaHidden === 'true') {
    parts.push('aria-hidden');
  }
  if (isFocusable(element)) {
    parts.push('focusable');
  }

  return parts.join(', ');
}

function isFocusable(element: Element): boolean {
  return matchesSafe(element, 'a[href], button, input, select, textarea, [tabindex]');
}

function getClassTokens(element: Element): string[] {
  return dedupe(
    classTokensForElement(element)
      .map(cleanClassToken)
      .filter(Boolean),
  );
}

function meaningfulClassTokens(element: Element): string[] {
  return getClassTokens(element).filter(isMeaningfulClassToken);
}

function cleanClassToken(token: string): string {
  return token.replace(/_[a-zA-Z0-9]{6,}$/, '');
}

function isMeaningfulClassToken(token: string): boolean {
  const hashLike = /^[a-f0-9]{6,}$/i.test(token) || /[A-Z0-9]{5,}/.test(token);
  return token.length > 2
    && !/^[a-z]{1,2}$/i.test(token)
    && !hashLike;
}

function shadowRootForElement(element: Element): ShadowRoot | null {
  const root = element.getRootNode();
  return isShadowRoot(root) ? root : null;
}

function querySelectorAllSafe(root: Document | ShadowRoot, selector: string): Element[] {
  try {
    return Array.from(root.querySelectorAll(selector));
  } catch {
    return [];
  }
}

function matchesSafe(element: Element, selector: string): boolean {
  try {
    return element.matches(selector);
  } catch {
    return false;
  }
}

function trimText(value: string, maxLength: number): string {
  const normalized = value.replace(/\s+/g, ' ').trim();
  if (normalized.length <= maxLength) {
    return normalized;
  }

  return `${normalized.slice(0, Math.max(0, maxLength - 1))}…`;
}

function dedupe(values: string[]): string[] {
  return values.filter((value, index) => values.indexOf(value) === index);
}

function cssEscape(value: string): string {
  if (typeof CSS !== 'undefined' && typeof CSS.escape === 'function') {
    return CSS.escape(value);
  }

  return value.replace(/[^a-zA-Z0-9_-]/g, (character) => `\\${character}`);
}
