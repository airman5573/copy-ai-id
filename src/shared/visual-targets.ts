import {
  DATA_AI_ID_ATTRIBUTE,
  EDITOR_HOST_ATTR,
  EDITOR_UI_ATTR,
  OVERLAY_HOST_ATTR,
  PREVIEW_OVERLAY_ATTR,
} from './config';
import type {
  EditorTarget,
  FallbackEditorTarget,
  FallbackTargetMetadata,
  LayoutTreeNode,
} from './domain/targets';
import type {
  VisualMutationError,
  VisualMutationErrorCode,
  VisualTargetSnapshot,
} from './domain/visual';
import {
  isAiIdTarget,
  isFallbackTarget,
  targetIdentityKey,
} from './editor-targets';
import type {
  VisualEditFallbackDescriptor,
  VisualEditTargetDescriptor,
  VisualEditTargetSnapshotSummary,
  VisualEditWarning,
} from './visual-edits';

export const VISUAL_EDIT_RUNTIME_ATTRIBUTE_NAMES = [
  OVERLAY_HOST_ATTR,
  EDITOR_HOST_ATTR,
  EDITOR_UI_ATTR,
  PREVIEW_OVERLAY_ATTR,
  'data-ai-editor-overlay',
  'data-copy-ai-id-tree-node-id',
  'data-copy-ai-id-chip-id',
] as const;

const RUNTIME_ATTRIBUTE_NAME_SET = new Set<string>(VISUAL_EDIT_RUNTIME_ATTRIBUTE_NAMES);
const RUNTIME_ATTRIBUTE_PREFIXES = ['data-copy-ai-id-', 'data-ai-editor-'] as const;
const RUNTIME_AI_ID_VALUE_PREFIXES = [
  'copy-ai-id-editor-',
  'copy-ai-id-preview-',
  'ai-editor-preview-',
  'popup-',
] as const;
const RUNTIME_CLASS_TOKEN_PREFIXES = [
  'copy-ai-id-editor-',
  'copy-ai-id-preview-',
  'ai-editor-preview-',
] as const;

export interface VisualEditTargetDescriptorOptions {
  nodeId?: string | null;
  snapshot?: VisualTargetSnapshot | null;
  layoutNode?: LayoutTreeNode | null;
}

export interface VisualTargetSnapshotSummaryOptions {
  attributeNames?: readonly string[];
  computedStyleProperties?: readonly string[];
  inlineStyleProperties?: readonly string[];
}

export function createVisualEditTargetDescriptor(
  target: EditorTarget,
  options: VisualEditTargetDescriptorOptions = {},
): VisualEditTargetDescriptor {
  const snapshot = options.snapshot ?? null;
  const layoutNode = options.layoutNode ?? null;
  const nodeId = snapshot?.nodeId ?? options.nodeId ?? (isFallbackTarget(target) ? target.nodeId : null);

  if (isAiIdTarget(target)) {
    return {
      strategy: 'ai-id',
      target,
      nodeId,
      tagName: snapshot?.tagName ?? layoutNode?.tagName,
      label: snapshot?.label ?? target.aiId,
      aiId: target.aiId,
      instanceIndex: target.instanceIndex,
      textPreview: snapshot?.textValue ?? layoutNode?.textPreview,
      classTokens: sanitizeClassTokens(snapshot?.classTokens ?? layoutNode?.classTokens ?? []),
    };
  }

  const sanitizedTarget = sanitizeEditorTargetForVisualEdit(target) as FallbackEditorTarget;
  const fallback = createVisualEditFallbackDescriptor(snapshot?.fallback ?? sanitizedTarget, nodeId);

  return {
    strategy: 'fallback',
    target: sanitizedTarget,
    nodeId,
    tagName: snapshot?.tagName ?? fallback.tagName,
    label: snapshot?.label ?? fallback.label,
    fallback,
    selector: fallback.selector,
    path: fallback.path,
    textPreview: snapshot?.textValue ?? fallback.textPreview,
    accessibility: fallback.accessibility,
    classTokens: sanitizeClassTokens(snapshot?.classTokens ?? fallback.classTokens),
  };
}

export function createVisualEditTargetDescriptorFromSnapshot(
  snapshot: VisualTargetSnapshot,
): VisualEditTargetDescriptor {
  return createVisualEditTargetDescriptor(snapshot.target, {
    nodeId: snapshot.nodeId,
    snapshot,
  });
}

export function createVisualEditFallbackDescriptor(
  fallback: FallbackTargetMetadata | FallbackEditorTarget,
  nodeId: string | null = 'nodeId' in fallback ? fallback.nodeId : null,
): VisualEditFallbackDescriptor {
  return {
    nodeId,
    tagName: fallback.tagName,
    label: fallback.label,
    selector: fallback.selector,
    selectorKind: fallback.selectorKind,
    path: fallback.path,
    fullPath: fallback.fullPath,
    textPreview: fallback.textPreview,
    nearbyText: fallback.nearbyText,
    classTokens: sanitizeClassTokens(fallback.classTokens),
    accessibility: fallback.accessibility,
  };
}

export function summarizeVisualTargetSnapshot(
  snapshot: VisualTargetSnapshot,
  options: VisualTargetSnapshotSummaryOptions = {},
): VisualEditTargetSnapshotSummary {
  return {
    nodeId: snapshot.nodeId,
    tagName: snapshot.tagName,
    label: snapshot.label,
    classTokens: sanitizeClassTokens(snapshot.classTokens),
    textValue: snapshot.textValue,
    richHtml: snapshot.richHtml,
    attributes: sanitizeAttributeMap(pickRecord(snapshot.attributes, options.attributeNames)),
    inlineStyle: pickRecord(snapshot.inlineStyle, options.inlineStyleProperties),
    computedStyle: pickRecord(snapshot.computedStyle, options.computedStyleProperties),
    rect: snapshot.elementRect,
    isVisible: snapshot.isVisible,
    image: snapshot.image,
    link: snapshot.link,
    formValue: snapshot.formValue,
    parentNodeId: snapshot.parent?.nodeId ?? null,
    previousSiblingNodeId: snapshot.previousSibling?.nodeId ?? null,
    nextSiblingNodeId: snapshot.nextSibling?.nodeId ?? null,
  };
}

export function createVisualEditTargetWarnings(
  descriptor: VisualEditTargetDescriptor,
): VisualEditWarning[] {
  if (descriptor.strategy !== 'fallback') {
    return [];
  }

  return [{
    code: 'fallback-target',
    message: 'This visual edit targets an element without data-ai-id; selector/path context may need re-identification if the DOM changes.',
  }];
}

export function describeVisualEditTarget(descriptor: VisualEditTargetDescriptor): string {
  if (descriptor.strategy === 'ai-id') {
    const repeated = descriptor.instanceIndex && descriptor.instanceIndex > 0
      ? ` instance ${descriptor.instanceIndex + 1}`
      : '';
    const tag = descriptor.tagName ? `<${descriptor.tagName}> ` : '';
    return `${tag}data-ai-id "${descriptor.aiId}"${repeated}`;
  }

  const fallback = descriptor.fallback;
  if (!fallback) {
    return descriptor.label ?? descriptor.nodeId ?? targetIdentityKey(descriptor.target);
  }

  const tag = fallback.tagName ? `<${fallback.tagName}> ` : '';
  return `${tag}${fallback.label} (${fallback.selectorKind}: ${fallback.selector})`;
}

export function visualEditTargetSerializationKey(descriptor: VisualEditTargetDescriptor): string {
  if (descriptor.strategy === 'ai-id') {
    return `ai-id:${descriptor.aiId}:${descriptor.instanceIndex ?? 0}`;
  }

  return [
    'fallback',
    descriptor.nodeId ?? '',
    descriptor.selector ?? descriptor.fallback?.selector ?? '',
    descriptor.path ?? descriptor.fallback?.path ?? '',
  ].join(':');
}

export function serializeVisualEditTargetDescriptor(
  descriptor: VisualEditTargetDescriptor,
): VisualEditTargetDescriptor {
  const target = sanitizeEditorTargetForVisualEdit(descriptor.target);

  if (descriptor.strategy === 'ai-id') {
    return {
      ...descriptor,
      target,
      classTokens: sanitizeClassTokens(descriptor.classTokens ?? []),
    };
  }

  const fallback = descriptor.fallback
    ? createVisualEditFallbackDescriptor(descriptor.fallback, descriptor.nodeId)
    : undefined;

  return {
    ...descriptor,
    target,
    fallback,
    classTokens: sanitizeClassTokens(descriptor.classTokens ?? fallback?.classTokens ?? []),
  };
}

export function sanitizeEditorTargetForVisualEdit(target: EditorTarget): EditorTarget {
  if (!isFallbackTarget(target)) {
    return target;
  }

  return {
    ...target,
    classTokens: sanitizeClassTokens(target.classTokens),
  };
}

export function sanitizeAttributeMap(
  attributes: Record<string, string> | null | undefined,
): Record<string, string> {
  if (!attributes) {
    return {};
  }

  return Object.fromEntries(
    Object.entries(attributes)
      .filter(([name, value]) => !isVisualEditRuntimeAttribute(name, value))
      .sort(([first], [second]) => first.localeCompare(second)),
  );
}

export function sanitizeClassTokens(tokens: readonly string[] | null | undefined): string[] {
  if (!tokens) {
    return [];
  }

  const cleanTokens = tokens
    .map((token) => token.trim())
    .filter((token) => token.length > 0 && !isRuntimeClassToken(token));

  return Array.from(new Set(cleanTokens));
}

export function isVisualEditRuntimeAttribute(name: string, value: string | null | undefined): boolean {
  const normalizedName = name.trim().toLowerCase();
  if (RUNTIME_ATTRIBUTE_NAME_SET.has(normalizedName)) {
    return true;
  }

  if (RUNTIME_ATTRIBUTE_PREFIXES.some((prefix) => normalizedName.startsWith(prefix))) {
    return true;
  }

  if (normalizedName === DATA_AI_ID_ATTRIBUTE) {
    const normalizedValue = value?.trim() ?? '';
    return RUNTIME_AI_ID_VALUE_PREFIXES.some((prefix) => normalizedValue.startsWith(prefix));
  }

  return false;
}

export function isSerializableVisualEditTarget(target: EditorTarget | null | undefined): target is EditorTarget {
  return isAiIdTarget(target) || isFallbackTarget(target);
}

export function isVisualTargetResolutionError(
  error: Pick<VisualMutationError, 'code'> | null | undefined,
): boolean {
  return Boolean(error && isVisualTargetResolutionErrorCode(error.code));
}

export function isVisualTargetResolutionErrorCode(
  code: VisualMutationErrorCode | null | undefined,
): boolean {
  return code === 'target-not-found'
    || code === 'stale-target'
    || code === 'ambiguous-target';
}

function pickRecord(
  record: Record<string, string>,
  keys: readonly string[] | undefined,
): Record<string, string> {
  if (!keys || keys.length === 0) {
    return { ...record };
  }

  const picked: Record<string, string> = {};
  for (const key of keys) {
    if (Object.prototype.hasOwnProperty.call(record, key)) {
      picked[key] = record[key];
    }
  }
  return picked;
}

function isRuntimeClassToken(token: string): boolean {
  return RUNTIME_CLASS_TOKEN_PREFIXES.some((prefix) => token.startsWith(prefix));
}
