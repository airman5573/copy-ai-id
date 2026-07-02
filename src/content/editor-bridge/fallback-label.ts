import {
  closestComposedElementMatching,
  getComposedParentElement,
} from '../target/composed-dom';
import { tagNameOf } from './lib/dom';
import {
  meaningfulClassTokens,
  trimText,
} from './fallback-utils';

// Tag-by-tag heuristic that names a no-id element for humans.
const LABEL_TEXT_LENGTH = 40;
const TEXT_TAGS = new Set(['p', 'span', 'label', 'li', 'blockquote', 'code', 'pre']);
const CONTAINER_TAGS = new Set(['div', 'section', 'article', 'nav', 'header', 'footer', 'aside', 'main', 'form', 'ul', 'ol']);
const GRAPHIC_TAGS = new Set(['path', 'circle', 'rect', 'line', 'ellipse', 'polygon', 'polyline', 'g']);

export function identifyElementLabel(element: Element): string {
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
