import { DATA_AI_ID_ATTRIBUTE, isExtensionOwnedElement } from '../../shared/config';
import { identifyElementLabel } from './fallback-label';
import {
  generateFallbackSelector,
  getElementPath,
} from './fallback-selector';
import {
  getClassTokens,
  matchesSafe,
  trimText,
} from './fallback-utils';
import { tagNameOf } from './lib/dom';
import { elementOwnText } from './lib/text';
import type {
  FallbackEditorTarget,
  FallbackSelectorKind,
  FallbackTargetMetadata,
} from '../../shared/domain/targets';

const TEXT_PREVIEW_LENGTH = 80;
const NEARBY_TEXT_LENGTH = 56;
const FULL_PATH_MAX_DEPTH = 24;
const SHORT_PATH_MAX_DEPTH = 4;

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
