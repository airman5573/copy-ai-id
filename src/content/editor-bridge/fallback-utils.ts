import { classTokensForElement } from './lib/text';
import { isShadowRoot } from '../target/composed-dom';

// Shared low-level helpers for fallback label/selector generation.
export function trimText(value: string, maxLength: number): string {
  const normalized = value.replace(/\s+/g, ' ').trim();
  if (normalized.length <= maxLength) {
    return normalized;
  }

  return `${normalized.slice(0, Math.max(0, maxLength - 1))}…`;
}

export function getClassTokens(element: Element): string[] {
  return dedupe(
    classTokensForElement(element)
      .map(cleanClassToken)
      .filter(Boolean),
  );
}

export function meaningfulClassTokens(element: Element): string[] {
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

export function shadowRootForElement(element: Element): ShadowRoot | null {
  const root = element.getRootNode();
  return isShadowRoot(root) ? root : null;
}

export function querySelectorAllSafe(root: Document | ShadowRoot, selector: string): Element[] {
  try {
    return Array.from(root.querySelectorAll(selector));
  } catch {
    return [];
  }
}

export function matchesSafe(element: Element, selector: string): boolean {
  try {
    return element.matches(selector);
  } catch {
    return false;
  }
}

function dedupe(values: string[]): string[] {
  return values.filter((value, index) => values.indexOf(value) === index);
}

export function cssEscape(value: string): string {
  if (typeof CSS !== 'undefined' && typeof CSS.escape === 'function') {
    return CSS.escape(value);
  }

  return value.replace(/[^a-zA-Z0-9_-]/g, (character) => `\\${character}`);
}
