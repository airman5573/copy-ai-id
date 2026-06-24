import {
  DATA_AI_ID_ATTRIBUTE,
  isExtensionOwnedElement,
} from '../../shared/config';
import type {
  BridgeViewportRect,
  EditorTarget,
  FallbackEditorTarget,
  FallbackTargetMetadata,
  VisualMutationError,
  VisualMutationErrorCode,
  VisualTargetSnapshot,
} from '../../shared/editor-messages';
import {
  hasSameEditorTarget,
  isAiIdTarget,
} from '../../shared/editor-targets';
import { VISUAL_STYLE_COMPUTED_PROPERTIES } from '../../shared/visual-style';
import {
  sanitizeAttributeMap,
  sanitizeClassTokens,
} from '../../shared/visual-targets';
import {
  getComposedChildElements,
  getComposedParentElement,
  getComposedSiblingElement,
  getOpenShadowRoot,
} from '../target/composed-dom';
import {
  fallbackMetadataForElement,
  fallbackTargetForElement,
} from './fallback-target';
import {
  buildLayoutTreeSnapshot,
  instancesOf,
  resolveAiTarget,
  resolveNodeIdForElement,
  resolveTreeNode,
} from './layout-tree';

export type VisualTargetResolveFailureReason = 'not-found' | 'stale' | 'ambiguous';

export type VisualTargetResolvedBy = 'node-id' | 'ai-id' | 'fallback-selector' | 'fallback-path';

export interface VisualTargetResolveRequest {
  target: EditorTarget;
  nodeId?: string | null;
  refreshLayoutTreeOnMiss?: boolean;
}

export interface VisualTargetResolveSuccess {
  ok: true;
  element: Element;
  nodeId: string | null;
  target: EditorTarget;
  resolvedBy: VisualTargetResolvedBy;
}

export interface VisualTargetResolveFailure {
  ok: false;
  reason: VisualTargetResolveFailureReason;
  target: EditorTarget;
  nodeId: string | null;
  error: VisualMutationError;
  candidateCount?: number;
}

export type VisualTargetResolveResult = VisualTargetResolveSuccess | VisualTargetResolveFailure;

export interface VisualTargetSnapshotOptions {
  computedStyleProperties?: readonly string[];
  includeRichHtml?: boolean;
}

export interface VisualTargetSnapshotSuccess {
  ok: true;
  resolved: VisualTargetResolveSuccess;
  snapshot: VisualTargetSnapshot;
}

export type VisualTargetSnapshotResult = VisualTargetSnapshotSuccess | VisualTargetResolveFailure;

interface FallbackSelectorResolution {
  candidates: Element[];
  invalidSelector: boolean;
}

const SHADOW_SELECTOR_SEPARATOR = /\s+::shadow\s+/g;
const SAFE_ATTRIBUTE_NAMES = new Set([
  DATA_AI_ID_ATTRIBUTE,
  'id',
  'class',
  'role',
  'title',
  'alt',
  'href',
  'target',
  'rel',
  'src',
  'srcset',
  'sizes',
  'loading',
  'decoding',
  'width',
  'height',
  'name',
  'type',
  'value',
  'placeholder',
  'for',
  'form',
  'action',
  'method',
  'autocomplete',
  'checked',
  'selected',
  'disabled',
  'readonly',
  'required',
  'multiple',
  'min',
  'max',
  'step',
  'pattern',
  'contenteditable',
  'tabindex',
  'lang',
  'dir',
]);
const SAFE_ATTRIBUTE_PREFIXES = ['aria-', 'data-'] as const;

export function resolveVisualTarget(
  request: VisualTargetResolveRequest,
): VisualTargetResolveResult {
  const firstAttempt = resolveVisualTargetOnce(request.target, request.nodeId ?? null);
  if (firstAttempt.ok || request.refreshLayoutTreeOnMiss === false) {
    return firstAttempt;
  }

  buildLayoutTreeSnapshot();
  const secondAttempt = resolveVisualTargetOnce(request.target, request.nodeId ?? null);
  return secondAttempt.ok ? secondAttempt : preferMoreSpecificFailure(firstAttempt, secondAttempt);
}

export function createVisualTargetResolveError(
  reason: VisualTargetResolveFailureReason,
  detail?: string,
): VisualMutationError {
  return {
    code: visualTargetResolveErrorCode(reason),
    message: visualTargetResolveErrorMessage(reason),
    detail,
  };
}

export function resolveVisualTargetSnapshot(
  request: VisualTargetResolveRequest,
  options: VisualTargetSnapshotOptions = {},
): VisualTargetSnapshotResult {
  const resolved = resolveVisualTarget(request);
  if (!resolved.ok) {
    return resolved;
  }

  return {
    ok: true,
    resolved,
    snapshot: createVisualTargetSnapshot(resolved, options),
  };
}

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

function resolveVisualTargetOnce(
  target: EditorTarget,
  requestedNodeId: string | null,
): VisualTargetResolveResult {
  const staleAttempts: VisualTargetResolveFailure[] = [];

  if (requestedNodeId) {
    const byNodeId = resolveByNodeId(target, requestedNodeId);
    if (byNodeId.ok) {
      return byNodeId;
    }
    if (byNodeId.reason !== 'not-found') {
      staleAttempts.push(byNodeId);
    }
  }

  if (isAiIdTarget(target)) {
    const byAiId = resolveByAiId(target);
    if (byAiId.ok) {
      return byAiId;
    }
    return preferMoreSpecificFailure(...staleAttempts, byAiId);
  }

  const byFallback = resolveByFallbackMetadata(target);
  if (byFallback.ok) {
    return byFallback;
  }

  return preferMoreSpecificFailure(...staleAttempts, byFallback);
}

function resolveByNodeId(target: EditorTarget, nodeId: string): VisualTargetResolveResult {
  const element = resolveTreeNode(nodeId);
  if (!element) {
    return failure(target, nodeId, 'not-found', `No live layout-tree node exists for nodeId "${nodeId}".`);
  }

  if (!elementMatchesEditorTarget(element, target)) {
    return failure(target, nodeId, 'stale', `Layout-tree node "${nodeId}" no longer matches the requested visual edit target.`);
  }

  return success(element, target, 'node-id');
}

function resolveByAiId(target: Extract<EditorTarget, { kind: 'ai-id' }>): VisualTargetResolveResult {
  const element = resolveAiTarget(target.aiId, target.instanceIndex);
  if (!element) {
    const matchingInstances = instancesOf(target.aiId).length;
    return failure(
      target,
      null,
      matchingInstances > 0 ? 'stale' : 'not-found',
      matchingInstances > 0
        ? `data-ai-id "${target.aiId}" exists, but instance ${target.instanceIndex + 1} is no longer available.`
        : `No live element has data-ai-id "${target.aiId}".`,
      matchingInstances,
    );
  }

  return success(element, target, 'ai-id');
}

function resolveByFallbackMetadata(target: FallbackEditorTarget): VisualTargetResolveResult {
  const selectorResolution = queryFallbackSelector(target.selector);
  if (selectorResolution.invalidSelector) {
    return failure(target, target.nodeId, 'not-found', `Fallback selector is invalid: ${target.selector}`);
  }

  const selectorCandidates = filterResolvableElements(selectorResolution.candidates);
  const selectorMatches = selectorCandidates.filter((candidate) => fallbackElementMatchesTarget(candidate, target));
  if (selectorMatches.length === 1) {
    return success(selectorMatches[0], target, 'fallback-selector');
  }
  if (selectorMatches.length > 1) {
    return failure(
      target,
      target.nodeId,
      'ambiguous',
      `Fallback selector matched ${selectorMatches.length} possible elements after metadata filtering.`,
      selectorMatches.length,
    );
  }

  const pathCandidates = findFallbackPathCandidates(target);
  if (pathCandidates.length === 1) {
    return success(pathCandidates[0], target, 'fallback-path');
  }
  if (pathCandidates.length > 1) {
    return failure(
      target,
      target.nodeId,
      'ambiguous',
      `Fallback path metadata matched ${pathCandidates.length} possible elements.`,
      pathCandidates.length,
    );
  }

  return failure(
    target,
    target.nodeId,
    selectorCandidates.length > 1 ? 'ambiguous' : selectorCandidates.length === 1 ? 'stale' : 'not-found',
    selectorCandidates.length > 1
      ? `Fallback selector matched ${selectorCandidates.length} elements and fallback path metadata did not disambiguate them.`
      : selectorCandidates.length === 1
        ? 'Fallback selector resolved an element, but its tag/path/context no longer match the requested target.'
        : 'No live element matches the fallback selector or fallback path metadata.',
    selectorCandidates.length,
  );
}

function success(
  element: Element,
  requestedTarget: EditorTarget,
  resolvedBy: VisualTargetResolvedBy,
): VisualTargetResolveSuccess {
  return {
    ok: true,
    element,
    nodeId: resolveNodeIdForElement(element),
    target: targetForResolvedElement(element, requestedTarget),
    resolvedBy,
  };
}

function failure(
  target: EditorTarget,
  nodeId: string | null,
  reason: VisualTargetResolveFailureReason,
  detail?: string,
  candidateCount?: number,
): VisualTargetResolveFailure {
  return {
    ok: false,
    reason,
    target,
    nodeId,
    candidateCount,
    error: createVisualTargetResolveError(reason, detail),
  };
}

function preferMoreSpecificFailure(
  ...failures: VisualTargetResolveFailure[]
): VisualTargetResolveFailure {
  const [firstFailure] = failures;
  if (!firstFailure) {
    throw new Error('Expected at least one visual target resolve failure.');
  }

  return failures.reduce((best, next) => {
    if (failureRank(next.reason) > failureRank(best.reason)) {
      return next;
    }
    return best;
  }, firstFailure);
}

function failureRank(reason: VisualTargetResolveFailureReason): number {
  switch (reason) {
    case 'ambiguous':
      return 3;
    case 'stale':
      return 2;
    case 'not-found':
      return 1;
  }
}

function visualTargetResolveErrorCode(reason: VisualTargetResolveFailureReason): VisualMutationErrorCode {
  switch (reason) {
    case 'ambiguous':
      return 'ambiguous-target';
    case 'stale':
      return 'stale-target';
    case 'not-found':
      return 'target-not-found';
  }
}

function visualTargetResolveErrorMessage(reason: VisualTargetResolveFailureReason): string {
  switch (reason) {
    case 'ambiguous':
      return 'The visual edit target is ambiguous.';
    case 'stale':
      return 'The visual edit target is stale.';
    case 'not-found':
      return 'The visual edit target was not found.';
  }
}

function elementMatchesEditorTarget(element: Element, target: EditorTarget): boolean {
  if (!isResolvableElement(element)) {
    return false;
  }

  if (isAiIdTarget(target)) {
    const aiId = element.getAttribute(DATA_AI_ID_ATTRIBUTE)?.trim() ?? '';
    return aiId === target.aiId && instancesOf(target.aiId)[target.instanceIndex] === element;
  }

  return fallbackElementMatchesTarget(element, target);
}

function targetForResolvedElement(element: Element, requestedTarget: EditorTarget): EditorTarget {
  const aiId = element.getAttribute(DATA_AI_ID_ATTRIBUTE)?.trim() ?? '';
  if (aiId) {
    const instanceIndex = Math.max(0, instancesOf(aiId).indexOf(element));
    return { kind: 'ai-id', aiId, instanceIndex };
  }

  const fallback = fallbackTargetForElement(element, resolveNodeIdForElement(element));
  if (fallback) {
    return fallback;
  }

  return requestedTarget;
}

function fallbackElementMatchesTarget(element: Element, target: FallbackEditorTarget): boolean {
  if (!isResolvableElement(element)) {
    return false;
  }

  const metadata = fallbackMetadataForElement(element);
  if (!metadata || metadata.tagName !== target.tagName) {
    return false;
  }

  if (metadata.fullPath && target.fullPath && metadata.fullPath === target.fullPath) {
    return true;
  }

  if (metadata.selector === target.selector && target.selectorKind !== 'nth-child') {
    return true;
  }

  const labelMatches = metadata.label === target.label;
  const pathMatches = metadata.path === target.path || Boolean(target.fullPath && metadata.fullPath === target.fullPath);
  const selectorMatches = metadata.selector === target.selector;
  const contextMatches = optionalTextMatches(metadata.textPreview, target.textPreview)
    || optionalTextMatches(metadata.nearbyText, target.nearbyText)
    || optionalTextMatches(metadata.accessibility, target.accessibility)
    || hasClassTokenOverlap(metadata.classTokens, target.classTokens);

  return (selectorMatches && (pathMatches || labelMatches || contextMatches))
    || (pathMatches && labelMatches && (contextMatches || !target.textPreview));
}

function queryFallbackSelector(selector: string): FallbackSelectorResolution {
  const trimmedSelector = selector.trim();
  if (!trimmedSelector) {
    return { candidates: [], invalidSelector: true };
  }

  if (!trimmedSelector.includes('::shadow')) {
    return queryRootSelector(document, trimmedSelector);
  }

  const parts = trimmedSelector.split(SHADOW_SELECTOR_SEPARATOR).map((part) => part.trim()).filter(Boolean);
  if (parts.length < 2) {
    return { candidates: [], invalidSelector: true };
  }

  let roots: Array<Document | ShadowRoot> = [document];
  for (let index = 0; index < parts.length; index += 1) {
    const selectorPart = parts[index];
    const isLast = index === parts.length - 1;
    const rootResults = roots.map((root) => queryRootSelector(root, selectorPart));
    if (rootResults.some((result) => result.invalidSelector)) {
      return { candidates: [], invalidSelector: true };
    }

    const matches = rootResults.flatMap((result) => result.candidates);

    if (isLast) {
      return { candidates: matches, invalidSelector: false };
    }

    roots = matches
      .map((host) => getOpenShadowRoot(host))
      .filter((root): root is ShadowRoot => root !== null);

    if (roots.length === 0) {
      return { candidates: [], invalidSelector: false };
    }
  }

  return { candidates: [], invalidSelector: false };
}

function queryRootSelector(root: Document | ShadowRoot, selector: string): FallbackSelectorResolution {
  try {
    return { candidates: Array.from(root.querySelectorAll(selector)), invalidSelector: false };
  } catch {
    return { candidates: [], invalidSelector: true };
  }
}

function findFallbackPathCandidates(target: FallbackEditorTarget): Element[] {
  const candidates: Element[] = [];
  const root = document.body ?? document.documentElement;
  if (!root) {
    return candidates;
  }

  for (const element of walkComposedElements(root)) {
    if (!isResolvableElement(element)) {
      continue;
    }

    const metadata = fallbackMetadataForElement(element);
    if (!metadata || metadata.tagName !== target.tagName) {
      continue;
    }

    if (fallbackPathMetadataMatches(metadata, target)) {
      candidates.push(element);
    }
  }

  return candidates;
}

function fallbackPathMetadataMatches(metadata: FallbackTargetMetadata, target: FallbackEditorTarget): boolean {
  if (metadata.fullPath && target.fullPath && metadata.fullPath === target.fullPath) {
    return true;
  }

  const pathMatches = metadata.path === target.path;
  if (!pathMatches) {
    return false;
  }

  const labelMatches = metadata.label === target.label;
  const contextMatches = optionalTextMatches(metadata.textPreview, target.textPreview)
    || optionalTextMatches(metadata.nearbyText, target.nearbyText)
    || optionalTextMatches(metadata.accessibility, target.accessibility)
    || hasClassTokenOverlap(metadata.classTokens, target.classTokens);

  return labelMatches && (contextMatches || !target.textPreview);
}

function* walkComposedElements(root: Element): Generator<Element> {
  yield root;

  for (const child of getComposedChildElements(root)) {
    yield* walkComposedElements(child);
  }
}

function filterResolvableElements(elements: Element[]): Element[] {
  return elements.filter(isResolvableElement);
}

function isResolvableElement(element: Element): boolean {
  return element.isConnected && !isExtensionOwnedElement(element);
}

function optionalTextMatches(first: string | undefined, second: string | undefined): boolean {
  if (!first || !second) {
    return false;
  }

  return normalizeContextText(first) === normalizeContextText(second);
}

function hasClassTokenOverlap(first: string[], second: string[]): boolean {
  if (first.length === 0 || second.length === 0) {
    return false;
  }

  const firstSet = new Set(first);
  return second.some((token) => firstSet.has(token));
}

function normalizeContextText(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}

function viewportRectForElement(element: Element): BridgeViewportRect {
  const rect = element.getBoundingClientRect();
  return {
    x: rect.x,
    y: rect.y,
    width: rect.width,
    height: rect.height,
    top: rect.top,
    right: rect.right,
    bottom: rect.bottom,
    left: rect.left,
  };
}

function viewportSize(): { width: number; height: number } {
  return {
    width: window.visualViewport?.width ?? window.innerWidth,
    height: window.visualViewport?.height ?? window.innerHeight,
  };
}

function tagNameOf(element: Element): string {
  return element.tagName.toLowerCase();
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

  const text = normalizeContextText(element.textContent ?? '');
  if (text) {
    return text.length > 80 ? `${text.slice(0, 79)}…` : text;
  }

  return tagNameOf(element);
}

function classTokensForElement(element: Element): string[] {
  return (element.getAttribute('class') ?? '')
    .split(/\s+/)
    .map((token) => token.trim())
    .filter(Boolean);
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

function isSafeSnapshotAttribute(name: string): boolean {
  if (name === 'style' || name === 'srcdoc' || name.startsWith('on')) {
    return false;
  }

  return SAFE_ATTRIBUTE_NAMES.has(name)
    || SAFE_ATTRIBUTE_PREFIXES.some((prefix) => name.startsWith(prefix));
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
  const html = element.innerHTML;
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
    text: normalizeContextText(element.textContent ?? '') || undefined,
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

export function hasSameResolvedVisualTarget(
  first: VisualTargetResolveSuccess | null | undefined,
  second: VisualTargetResolveSuccess | null | undefined,
): boolean {
  if (!first || !second) {
    return false;
  }

  return first.element === second.element
    || (first.nodeId !== null && first.nodeId === second.nodeId)
    || hasSameEditorTarget(first.target, second.target);
}
