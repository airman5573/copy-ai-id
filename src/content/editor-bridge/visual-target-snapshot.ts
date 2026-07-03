import { DATA_AI_ID_ATTRIBUTE } from '../../shared/config';
import type { BridgeViewportRect } from '../../shared/domain/geometry';
import type {
  EditorTarget,
  FallbackTargetMetadata,
} from '../../shared/domain/targets';
import type { VisualTargetSnapshot } from '../../shared/domain/visual';
import { isAiIdTarget } from '../../shared/editor-targets';
import { VISUAL_STYLE_COMPUTED_PROPERTIES } from '../../shared/visual-style';
import {
  isSafeSnapshotAttribute,
  sanitizeAttributeMap,
  sanitizeClassTokens,
} from '../../shared/visual-targets';
import {
  getComposedParentElement,
  getComposedSiblingElement,
} from '../target/composed-dom';
import { editorTargetForElement } from './editor-target';
import { classifyElementIntents } from './element-intent';
import { fallbackMetadataForElement } from './fallback-target';
import { resolveNodeIdForElement } from './layout-tree';
import {
  isContentEditableElement,
  isResolvableElement,
  tagNameOf,
} from './lib/dom';
import {
  classTokensForElement,
  normalizeWhitespace,
} from './lib/text';
import {
  viewportRectForElement,
  viewportSize,
} from './lib/viewport';
import { stripRuntimeArtifacts } from './runtime-artifacts';
import type {
  VisualTargetResolveSuccess,
  VisualTargetSnapshotOptions,
} from './visual-target-resolver';

// Serializes a resolved live element into the VisualTargetSnapshot wire
// shape. Target resolution lives in visual-target-resolver.ts.
export function createVisualTargetSnapshot(
  resolved: VisualTargetResolveSuccess,
  options: VisualTargetSnapshotOptions = {},
): VisualTargetSnapshot {
  const element = resolved.element;
  const computedStyle = window.getComputedStyle(element);
  const fallback = fallbackMetadataForElement(element);
  const target = targetForResolvedElement(element, resolved.target);
  const nodeId = resolveNodeIdForElement(element) ?? resolved.nodeId;
  const rect = viewportRectForElement(element);

  return {
    target,
    nodeId,
    tagName: tagNameOf(element),
    label: labelForElement(element, target, fallback),
    intents: classifyElementIntents(element),
    classTokens: sanitizeClassTokens(classTokensForElement(element)),
    attributes: safeAttributeMapForElement(element),
    inlineStyle: inlineStyleMapForElement(element),
    computedStyle: computedStyleMapForElement(
      computedStyle,
      options.computedStyleProperties ?? VISUAL_STYLE_COMPUTED_PROPERTIES,
    ),
    textValue: textValueForElement(element),
    richHtml: options.includeRichHtml === false ? undefined : richHtmlForElement(element),
    formValue: formValueForElement(element),
    image: imageSnapshotForElement(element),
    link: linkSnapshotForElement(element),
    parent: relationSnapshotForElement(getComposedParentElement(element)),
    previousSibling: relationSnapshotForElement(getComposedSiblingElement(element, 'previous')),
    nextSibling: relationSnapshotForElement(getComposedSiblingElement(element, 'next')),
    fallback,
    elementRect: rect,
    viewport: viewportSize(),
    isVisible: isVisiblyRendered(element, computedStyle, rect),
  };
}

export function targetForResolvedElement(element: Element, requestedTarget: EditorTarget): EditorTarget {
  return editorTargetForElement(element) ?? requestedTarget;
}

function labelForElement(
  element: Element,
  target: EditorTarget,
  fallback: FallbackTargetMetadata | null,
): string {
  if (fallback?.label) {
    return fallback.label;
  }

  if (isAiIdTarget(target)) {
    return `data-ai-id "${target.aiId}"`;
  }

  const ariaLabel = element.getAttribute('aria-label')?.trim();
  if (ariaLabel) {
    return ariaLabel;
  }

  const text = normalizeWhitespace(element.textContent ?? '');
  if (text) {
    return text.length > 80 ? `${text.slice(0, 79)}…` : text;
  }

  return tagNameOf(element);
}

function safeAttributeMapForElement(element: Element): Record<string, string> {
  const attributes: Record<string, string> = {};

  for (const attribute of Array.from(element.attributes)) {
    const name = attribute.name.toLowerCase();
    if (!isSafeSnapshotAttribute(name)) {
      continue;
    }

    attributes[name] = attribute.value;
  }

  return sanitizeAttributeMap(attributes);
}



function inlineStyleMapForElement(element: Element): Record<string, string> {
  const style = styleDeclarationForElement(element);
  if (!style) {
    return {};
  }

  const values: Record<string, string> = {};
  for (let index = 0; index < style.length; index += 1) {
    const property = style.item(index);
    if (!property) {
      continue;
    }

    values[property] = style.getPropertyValue(property);
  }

  return values;
}

function styleDeclarationForElement(element: Element): CSSStyleDeclaration | null {
  return element instanceof HTMLElement || element instanceof SVGElement
    ? element.style
    : null;
}

function computedStyleMapForElement(
  computedStyle: CSSStyleDeclaration,
  properties: readonly string[],
): Record<string, string> {
  const values: Record<string, string> = {};
  for (const property of properties) {
    values[property] = computedStyle.getPropertyValue(property);
  }
  return values;
}

function textValueForElement(element: Element): string | undefined {
  if (element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement) {
    return element.value;
  }

  if (element instanceof HTMLSelectElement) {
    return element.value;
  }

  const text = element.textContent ?? '';
  return text.length > 0 ? text : undefined;
}

function richHtmlForElement(element: Element): string | undefined {
  const html = stripRuntimeArtifacts(element.innerHTML);
  return html.length > 0 ? html : undefined;
}

function formValueForElement(element: Element): VisualTargetSnapshot['formValue'] {
  if (element instanceof HTMLInputElement) {
    const snapshot: NonNullable<VisualTargetSnapshot['formValue']> = {
      value: element.value,
    };
    if (element.type === 'checkbox' || element.type === 'radio') {
      snapshot.checked = element.checked;
    }
    return snapshot;
  }

  if (element instanceof HTMLTextAreaElement) {
    return { value: element.value };
  }

  if (element instanceof HTMLSelectElement) {
    return {
      value: element.value,
      selectedIndex: element.selectedIndex,
      selectedValues: Array.from(element.selectedOptions, (option) => option.value),
    };
  }

  if (isContentEditableElement(element)) {
    return { value: element.textContent ?? '' };
  }

  return undefined;
}

function imageSnapshotForElement(element: Element): VisualTargetSnapshot['image'] {
  if (!(element instanceof HTMLImageElement)) {
    return undefined;
  }

  return {
    src: element.currentSrc || element.src,
    alt: element.alt || undefined,
    width: element.naturalWidth || element.width || undefined,
    height: element.naturalHeight || element.height || undefined,
  };
}

function linkSnapshotForElement(element: Element): VisualTargetSnapshot['link'] {
  if (!(element instanceof HTMLAnchorElement)) {
    return undefined;
  }

  return {
    href: element.href,
    target: element.target || undefined,
    rel: element.rel || undefined,
    text: normalizeWhitespace(element.textContent ?? '') || undefined,
  };
}

function relationSnapshotForElement(element: Element | null): VisualTargetSnapshot['parent'] {
  if (!element || !isResolvableElement(element)) {
    return undefined;
  }

  const aiId = element.getAttribute(DATA_AI_ID_ATTRIBUTE)?.trim() || null;
  return {
    nodeId: resolveNodeIdForElement(element),
    tagName: tagNameOf(element),
    aiId,
    fallback: aiId ? null : fallbackMetadataForElement(element),
  };
}

function isVisiblyRendered(
  _element: Element,
  computedStyle: CSSStyleDeclaration,
  rect: BridgeViewportRect,
): boolean {
  return rect.width > 0
    && rect.height > 0
    && computedStyle.display !== 'none'
    && computedStyle.visibility !== 'hidden'
    && computedStyle.contentVisibility !== 'hidden';
}
