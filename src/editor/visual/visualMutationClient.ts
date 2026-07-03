import {
  cssPropertyLabel,
  truncatedPreview,
} from '../lib/format';
import { breakpointById, type BreakpointId } from '../../shared/breakpoints';
import { type BridgeViewportPoint } from '../../shared/domain/geometry';
import {
  type EditorTarget,
  type EditorTargetReference,
} from '../../shared/domain/targets';
import {
  type QuickActionCategory,
  type VisualAttributeMutation,
  type VisualDropPosition,
  type VisualFormValueMutation,
  type VisualFormValueSnapshot,
  type VisualMutationKind,
  type VisualRichTextMutation,
  type VisualStructureMutationSnapshot,
  type VisualStructureOperation,
  type VisualStyleDeclarationMutation,
  type VisualTargetSnapshot,
  type VisualTextMutation,
} from '../../shared/domain/visual';
import {
  type DeleteVisualElementMessage,
  type DuplicateVisualElementMessage,
  EDITOR_MESSAGE_TYPES,
  type EditorToBridgeMessage,
  type MoveVisualElementMessage,
  type RequestVisualDragMoveMessage,
  type RestoreVisualElementMessage,
  type UpdateVisualAttributeMessage,
  type UpdateVisualFormValueMessage,
  type UpdateVisualRichTextMessage,
  type UpdateVisualStyleMessage,
  type UpdateVisualTextMessage,
  type VisualMutationRequestBase,
} from '../../shared/protocol/editor-bridge-messages';
import { hasSameEditorTarget } from '../../shared/editor-targets';
import {
  getVisualStylePropertyDefinition,
  type VisualStyleCategory,
} from '../../shared/visual-style';
import { sanitizeVisualHtmlFragment } from '../../shared/visual-html';
import { sanitizeVisualAttributeMutation } from '../../shared/visual-attributes';
import {
  createVisualEditTargetDescriptor,
  createVisualEditTargetDescriptorFromSnapshot,
  createVisualEditTargetWarnings,
  describeVisualEditTarget,
  summarizeVisualTargetSnapshot,
} from '../../shared/visual-targets';
import type {
  VisualEditControlDescriptor,
  VisualEditControlKind,
  VisualEditRecord,
  VisualEditSource,
  VisualEditTargetDescriptor,
  VisualEditTargetSnapshotSummary,
  VisualEditWarning,
  VisualStyleDeclarationDiff,
  VisualStyleValueIntent,
} from '../../shared/visual-edits';
import { postToBridge } from '../bridge/bridgeClient';
import { useBreakpointStore } from '../stores/useBreakpointStore';
import {
  useVisualEditStore,
  type VisualEditRecordInput,
} from '../stores/useVisualEditStore';
import { useVisualSelectionStore } from '../stores/useVisualSelectionStore';

export interface VisualMutationDispatchResult<K extends VisualMutationKind = VisualMutationKind> {
  mutationId: number;
  record: VisualEditRecord<K>;
  message: EditorToBridgeMessage;
}

export interface VisualMutationDispatchContext {
  reference?: EditorTargetReference;
  snapshot?: VisualTargetSnapshot | null;
  source?: VisualEditSource;
  category?: QuickActionCategory | null;
  control?: Partial<VisualEditControlDescriptor>;
  breakpointId?: BreakpointId;
  warnings?: VisualEditWarning[];
}

// Stepper edits attach percent-intent metadata per declaration; the preview
// still receives the concrete computed value (the wire message strips intent).
export interface VisualStyleDeclarationMutationInput extends VisualStyleDeclarationMutation {
  intent?: VisualStyleValueIntent;
}

export interface DispatchVisualStyleMutationOptions extends VisualMutationDispatchContext {
  declarations: VisualStyleDeclarationMutationInput[];
  // Merge consecutive stepper clicks on the same target+properties into one
  // record (before/intent.base keep their first values so one undo restores).
  coalesce?: boolean;
}

export interface DispatchVisualTextMutationOptions extends VisualMutationDispatchContext {
  text: VisualTextMutation;
}

export interface DispatchVisualRichTextMutationOptions extends VisualMutationDispatchContext {
  richText: VisualRichTextMutation;
  sanitized?: boolean;
  strippedRuntimeArtifacts?: string[];
}

export interface DispatchVisualAttributeMutationOptions extends VisualMutationDispatchContext {
  attribute: VisualAttributeMutation;
}

export interface DispatchVisualFormValueMutationOptions extends VisualMutationDispatchContext {
  formValue: VisualFormValueMutation;
}

export type DispatchVisualStructureMutationOptions = VisualMutationDispatchContext & (
  | { operation: 'duplicate' }
  | { operation: 'move-up' | 'move-down' }
  | { operation: 'delete' }
  | { operation: 'restore'; structure: VisualStructureMutationSnapshot }
  | {
    operation: 'drag-move';
    dropTarget?: EditorTarget;
    dropNodeId?: string | null;
    position?: VisualDropPosition;
    dropPoint?: BridgeViewportPoint;
  }
);

interface ResolvedVisualMutationContext {
  reference: EditorTargetReference;
  snapshot: VisualTargetSnapshot | null;
  target: VisualEditTargetDescriptor;
  snapshotSummary: VisualEditTargetSnapshotSummary;
  source: VisualEditSource;
  breakpointId: BreakpointId;
  warnings: VisualEditWarning[];
  targetLabel: string;
}

let nextMutationId = 1;

export function getNextVisualMutationId(): number {
  const mutationId = nextMutationId;
  nextMutationId += 1;
  return mutationId;
}

export function dispatchVisualStyleMutation(
  options: DispatchVisualStyleMutationOptions,
): VisualMutationDispatchResult<'style'> {
  const context = resolveVisualMutationContext(options);
  const recordContext = addStyleBreakpointIntentWarning(context);
  const mutationId = getNextVisualMutationId();
  const category = resolveStyleCategory(options, context);
  const declarations = options.declarations.map((declaration) => ({ ...declaration }));
  const wireDeclarations: VisualStyleDeclarationMutation[] = declarations.map(
    ({ intent: _intent, ...declaration }) => declaration,
  );
  const diffs: VisualStyleDeclarationDiff[] = declarations.map((declaration) => {
    const before = resolveStyleBeforeValue(declaration, context.snapshot);
    const after = declaration.value === '' ? null : declaration.value;

    return {
      property: declaration.property,
      before: before.value,
      after,
      priority: declaration.priority,
      source: before.source,
      intent: declaration.intent,
    };
  });
  const message: UpdateVisualStyleMessage = {
    type: EDITOR_MESSAGE_TYPES.updateVisualStyle,
    ...visualMutationMessageBase(context, mutationId),
    declarations: wireDeclarations,
  };

  if (options.coalesce) {
    const coalescedRecord = coalesceStepperStyleRecord(recordContext, diffs, mutationId);
    if (coalescedRecord) {
      return finishVisualMutationDispatch(context, mutationId, coalescedRecord, message);
    }
  }

  const control = createControlDescriptor(options, {
    category,
    kind: visualControlKindForCategory(category),
    id: declarations.length === 1 ? `style:${declarations[0].property}` : 'style:multiple',
    label: styleControlLabel(declarations),
    property: declarations.length === 1 ? declarations[0].property : undefined,
  });
  const humanSummary = summarizeStyleEdit(diffs, context.targetLabel);
  const record = addOptimisticRecord<'style'>(recordContext, mutationId, {
    category,
    controlKind: control.kind,
    control,
    kind: 'style',
    payload: {
      kind: 'style',
      declarations: diffs,
    },
    before: {
      kind: 'style',
      declarations: diffs.map((diff) => ({
        property: diff.property,
        value: diff.before,
        priority: diff.priority,
        source: diff.source,
      })),
    },
    after: {
      kind: 'style',
      declarations: diffs.map((diff) => ({
        property: diff.property,
        value: diff.after,
        priority: diff.priority,
        source: 'inline',
        intent: diff.intent,
      })),
    },
    humanSummary,
  });

  return finishVisualMutationDispatch(context, mutationId, record, message);
}

// A stepper record is recognizable by its 'stepper:' control id. Coalescing
// keeps the first before/intent.base (one undo restores the original) while
// after/intent.percent track the latest click.
function coalesceStepperStyleRecord(
  context: ResolvedVisualMutationContext,
  diffs: VisualStyleDeclarationDiff[],
  mutationId: number,
): VisualEditRecord<'style'> | null {
  const store = useVisualEditStore.getState();
  const latest = store.records[store.records.length - 1];
  if (
    !latest
    || latest.kind !== 'style'
    || latest.payload.kind !== 'style'
    || (latest.status !== 'pending' && latest.status !== 'applied')
    || !latest.control.id.startsWith('stepper:')
    || !visualEditRecordMatchesReference(latest, context.reference)
  ) {
    return null;
  }

  const previousByProperty = new Map(
    latest.payload.declarations.map((declaration) => [declaration.property, declaration]),
  );
  if (
    previousByProperty.size !== diffs.length
    || diffs.some((diff) => !previousByProperty.has(diff.property))
  ) {
    return null;
  }

  const mergedDiffs: VisualStyleDeclarationDiff[] = diffs.map((diff) => {
    const previous = previousByProperty.get(diff.property);
    if (!previous) {
      return diff;
    }

    return {
      ...diff,
      before: previous.before,
      source: previous.source,
      // A record that started concrete (zero-base seed) stays concrete.
      intent: previous.intent && diff.intent
        ? { percent: diff.intent.percent, base: previous.intent.base }
        : undefined,
    };
  });

  const updatedRecord: VisualEditRecord<'style'> = {
    ...(latest as VisualEditRecord<'style'>),
    status: 'pending',
    error: undefined,
    payload: {
      kind: 'style',
      declarations: mergedDiffs,
    },
    after: {
      kind: 'style',
      declarations: mergedDiffs.map((diff) => ({
        property: diff.property,
        value: diff.after,
        priority: diff.priority,
        source: 'inline',
        intent: diff.intent,
      })),
    },
    humanSummary: summarizeStyleEdit(mergedDiffs, context.targetLabel),
  };

  store.upsertRecord(updatedRecord as VisualEditRecord, { mutationId });
  return updatedRecord;
}

function visualEditRecordMatchesReference(
  record: VisualEditRecord,
  reference: EditorTargetReference,
): boolean {
  const recordNodeId = record.target.nodeId ?? null;
  if (recordNodeId && reference.nodeId) {
    return recordNodeId === reference.nodeId;
  }

  return hasSameEditorTarget(record.target.target, reference.target);
}

function addStyleBreakpointIntentWarning(context: ResolvedVisualMutationContext): ResolvedVisualMutationContext {
  if (context.breakpointId === 'base') {
    return context;
  }

  const breakpoint = breakpointById(context.breakpointId);
  const warning: VisualEditWarning = {
    code: 'breakpoint-intent-inline-preview',
    message: `The ${breakpoint.label} breakpoint (${context.breakpointId}, ${breakpoint.width}px) was recorded as implementation intent, but the preview mutation used inline styles for immediate feedback. Recreate it as responsive/scoped source CSS when applying the diff.`,
  };

  if (context.warnings.some((candidate) => candidate.code === warning.code)) {
    return context;
  }

  return {
    ...context,
    warnings: [...context.warnings, warning],
  };
}

export function dispatchVisualTextMutation(
  options: DispatchVisualTextMutationOptions,
): VisualMutationDispatchResult<'text'> {
  const context = resolveVisualMutationContext({ ...options, category: options.category ?? 'content' });
  const mutationId = getNextVisualMutationId();
  const before = options.text.previousValue ?? context.snapshot?.textValue ?? '';
  const after = options.text.value;
  const control = createControlDescriptor(options, {
    category: 'content',
    kind: 'content',
    id: 'content:text',
    label: 'Text content',
  });
  const humanSummary = `Change text on ${context.targetLabel} from ${quotePreview(before)} to ${quotePreview(after)}.`;
  const record = addOptimisticRecord<'text'>(context, mutationId, {
    category: 'content',
    controlKind: control.kind,
    control,
    kind: 'text',
    payload: {
      kind: 'text',
      text: { before, after },
    },
    before: {
      kind: 'text',
      text: { value: before },
    },
    after: {
      kind: 'text',
      text: { value: after },
    },
    humanSummary,
  });
  const message: UpdateVisualTextMessage = {
    type: EDITOR_MESSAGE_TYPES.updateVisualText,
    ...visualMutationMessageBase(context, mutationId),
    text: options.text,
  };

  return finishVisualMutationDispatch(context, mutationId, record, message);
}

export function dispatchVisualRichTextMutation(
  options: DispatchVisualRichTextMutationOptions,
): VisualMutationDispatchResult<'rich-text'> {
  const context = resolveVisualMutationContext({ ...options, category: options.category ?? 'content' });
  const mutationId = getNextVisualMutationId();
  const sanitizedResult = sanitizeVisualHtmlFragment(options.richText.html);
  const richText = {
    ...options.richText,
    html: sanitizedResult.html,
  };
  const beforeHtml = options.richText.previousHtml ?? context.snapshot?.richHtml ?? '';
  const afterHtml = richText.html;
  const sanitized = Boolean(options.sanitized || sanitizedResult.changed);
  const strippedRuntimeArtifacts = mergeStrippedRuntimeArtifacts(
    options.strippedRuntimeArtifacts,
    sanitizedResult.strippedRuntimeArtifacts,
  );
  const warnings = sanitized
    ? [...context.warnings, { code: 'sanitized-html' as const, message: 'The rich HTML fragment was sanitized before applying the preview mutation.' }]
    : context.warnings;
  const control = createControlDescriptor(options, {
    category: 'content',
    kind: 'rich-text',
    id: 'content:rich-text',
    label: 'Rich HTML',
  });
  const humanSummary = `Change rich HTML on ${context.targetLabel}.`;
  const record = addOptimisticRecord<'rich-text'>({ ...context, warnings }, mutationId, {
    category: 'content',
    controlKind: control.kind,
    control,
    kind: 'rich-text',
    payload: {
      kind: 'rich-text',
      richText: {
        beforeHtml,
        afterHtml,
        sanitized,
        strippedRuntimeArtifacts,
      },
    },
    before: {
      kind: 'rich-text',
      richText: {
        html: beforeHtml,
        sanitized,
        strippedRuntimeArtifacts,
      },
    },
    after: {
      kind: 'rich-text',
      richText: {
        html: afterHtml,
        sanitized,
        strippedRuntimeArtifacts,
      },
    },
    humanSummary,
  });
  const message: UpdateVisualRichTextMessage = {
    type: EDITOR_MESSAGE_TYPES.updateVisualRichText,
    ...visualMutationMessageBase(context, mutationId),
    richText,
  };

  return finishVisualMutationDispatch(context, mutationId, record, message);
}

function mergeStrippedRuntimeArtifacts(
  first: readonly string[] | undefined,
  second: readonly string[] | undefined,
): string[] | undefined {
  const merged = Array.from(new Set([...(first ?? []), ...(second ?? [])].filter(Boolean)));
  return merged.length > 0 ? merged : undefined;
}

export function dispatchVisualAttributeMutation(
  options: DispatchVisualAttributeMutationOptions,
): VisualMutationDispatchResult<'attribute'> {
  const context = resolveVisualMutationContext({ ...options, category: options.category ?? 'content' });
  const sanitizedAttribute = sanitizeVisualAttributeMutation(options.attribute);
  if (!sanitizedAttribute.ok) {
    throw new Error(sanitizedAttribute.error.detail ?? sanitizedAttribute.error.message);
  }

  const mutationId = getNextVisualMutationId();
  const before = sanitizedAttribute.attribute.previousValue
    ?? context.snapshot?.attributes[sanitizedAttribute.attribute.name]
    ?? null;
  const attribute = {
    ...sanitizedAttribute.attribute,
    previousValue: before,
  };
  const after = attribute.value;
  const control = createControlDescriptor(options, {
    category: 'content',
    kind: 'content',
    id: `attribute:${attribute.name}`,
    label: `Attribute: ${attribute.name}`,
  });
  const humanSummary = `Set ${attribute.name} on ${context.targetLabel} to ${quotePreview(after ?? 'removed')}.`;
  const record = addOptimisticRecord<'attribute'>(context, mutationId, {
    category: 'content',
    controlKind: control.kind,
    control,
    kind: 'attribute',
    payload: {
      kind: 'attribute',
      attributes: [{ name: attribute.name, before, after }],
    },
    before: {
      kind: 'attribute',
      attributes: [{ name: attribute.name, value: before }],
    },
    after: {
      kind: 'attribute',
      attributes: [{ name: attribute.name, value: after }],
    },
    humanSummary,
  });
  const message: UpdateVisualAttributeMessage = {
    type: EDITOR_MESSAGE_TYPES.updateVisualAttribute,
    ...visualMutationMessageBase(context, mutationId),
    attribute,
  };

  return finishVisualMutationDispatch(context, mutationId, record, message);
}

export function dispatchVisualFormValueMutation(
  options: DispatchVisualFormValueMutationOptions,
): VisualMutationDispatchResult<'form-value'> {
  const context = resolveVisualMutationContext({ ...options, category: options.category ?? 'content' });
  const mutationId = getNextVisualMutationId();
  const before = options.formValue.previousValue ?? context.snapshot?.formValue ?? {};
  const after = formValueAfterState(options.formValue);
  const control = createControlDescriptor(options, {
    category: 'content',
    kind: 'form-value',
    id: 'content:form-value',
    label: 'Form value',
  });
  const humanSummary = `Change form value on ${context.targetLabel}.`;
  const record = addOptimisticRecord<'form-value'>(context, mutationId, {
    category: 'content',
    controlKind: control.kind,
    control,
    kind: 'form-value',
    payload: {
      kind: 'form-value',
      formValue: { before, after },
    },
    before: {
      kind: 'form-value',
      formValue: { formValue: before },
    },
    after: {
      kind: 'form-value',
      formValue: { formValue: after },
    },
    humanSummary,
  });
  const message: UpdateVisualFormValueMessage = {
    type: EDITOR_MESSAGE_TYPES.updateVisualFormValue,
    ...visualMutationMessageBase(context, mutationId),
    formValue: options.formValue,
  };

  return finishVisualMutationDispatch(context, mutationId, record, message);
}

export function dispatchVisualStructureMutation(
  options: DispatchVisualStructureMutationOptions,
): VisualMutationDispatchResult<'structure'> {
  const context = resolveVisualMutationContext({
    ...options,
    category: options.category ?? 'layout',
    source: options.source ?? (options.operation === 'drag-move' ? 'drag-and-drop' : 'quick-action-bar'),
  });
  const mutationId = getNextVisualMutationId();
  const before = structureBeforeState(options);
  const operation = options.operation;
  const control = createControlDescriptor(options, {
    category: 'layout',
    kind: 'structure',
    id: `structure:${operation}`,
    label: structureOperationLabel(operation),
  });
  const humanSummary = `${structureOperationLabel(operation)} ${context.targetLabel}.`;
  const record = addOptimisticRecord<'structure'>(context, mutationId, {
    category: 'layout',
    controlKind: control.kind,
    control,
    kind: 'structure',
    payload: {
      kind: 'structure',
      structure: {
        operation,
        before,
        after: null,
        movedDirection: operation === 'move-up' ? 'up' : operation === 'move-down' ? 'down' : undefined,
        dropPosition: operation === 'drag-move' ? options.position : undefined,
        dropTarget: operation === 'drag-move' && options.dropTarget
          ? createVisualEditTargetDescriptor(options.dropTarget, { nodeId: options.dropNodeId ?? null })
          : undefined,
      },
    },
    before: {
      kind: 'structure',
      structure: { structure: before },
    },
    after: {
      kind: 'structure',
      structure: { structure: null },
    },
    humanSummary,
  });
  const message = createStructureMessage(options, context.reference, context.breakpointId, mutationId);

  return finishVisualMutationDispatch(context, mutationId, record, message);
}

function postVisualMutation(message: EditorToBridgeMessage, reference: EditorTargetReference): void {
  useVisualSelectionStore.getState().setSnapshotLoading(reference);
  postToBridge(message);
}

function visualMutationMessageBase(
  context: ResolvedVisualMutationContext,
  mutationId: number,
): Pick<VisualMutationRequestBase, 'mutationId' | 'target' | 'nodeId' | 'breakpointId'> {
  return {
    mutationId,
    target: context.reference.target,
    nodeId: context.reference.nodeId,
    breakpointId: context.breakpointId,
  };
}

function finishVisualMutationDispatch<K extends VisualMutationKind>(
  context: ResolvedVisualMutationContext,
  mutationId: number,
  record: VisualEditRecord<K>,
  message: EditorToBridgeMessage,
): VisualMutationDispatchResult<K> {
  postVisualMutation(message, context.reference);
  return { mutationId, record, message };
}

function addOptimisticRecord<K extends VisualMutationKind>(
  context: ResolvedVisualMutationContext,
  mutationId: number,
  input: Pick<VisualEditRecord<K>, 'category' | 'controlKind' | 'control' | 'kind' | 'payload' | 'before' | 'after' | 'humanSummary'>,
): VisualEditRecord<K> {
  return useVisualEditStore.getState().addRecord({
    source: context.source,
    target: context.target,
    targetSnapshot: context.snapshotSummary,
    breakpointId: context.breakpointId,
    warnings: context.warnings,
    status: 'pending',
    ...input,
  } as VisualEditRecordInput, { mutationId }) as unknown as VisualEditRecord<K>;
}

function resolveVisualMutationContext(options: VisualMutationDispatchContext): ResolvedVisualMutationContext {
  const selectionState = useVisualSelectionStore.getState();
  const reference = resolveTargetReference(options, selectionState);
  const snapshot = resolveSnapshotForReference(options.snapshot ?? selectionState.snapshot, reference);
  const target = snapshot
    ? createVisualEditTargetDescriptorFromSnapshot(snapshot)
    : createVisualEditTargetDescriptor(reference.target, { nodeId: reference.nodeId });
  const snapshotSummary = snapshot
    ? summarizeVisualTargetSnapshot(snapshot)
    : createFallbackSnapshotSummary(target, reference);
  const breakpointId = options.breakpointId ?? useBreakpointStore.getState().activeBreakpointId;
  const warnings = [
    ...createVisualEditTargetWarnings(target),
    ...(options.warnings ?? []),
  ];

  return {
    reference,
    snapshot,
    target,
    snapshotSummary,
    source: options.source ?? 'floating-panel',
    breakpointId,
    warnings,
    targetLabel: describeVisualEditTarget(target),
  };
}

function resolveTargetReference(
  options: VisualMutationDispatchContext,
  selectionState: ReturnType<typeof useVisualSelectionStore.getState>,
): EditorTargetReference {
  const target = options.reference?.target
    ?? options.snapshot?.target
    ?? selectionState.panelTarget?.target
    ?? selectionState.snapshot?.target
    ?? selectionState.activeToolbarTarget?.target
    ?? selectionState.hoverTarget?.target;

  if (!target) {
    throw new Error('No visual edit target is selected.');
  }

  return {
    target,
    nodeId: options.reference?.nodeId
      ?? options.snapshot?.nodeId
      ?? selectionState.panelTarget?.nodeId
      ?? selectionState.snapshot?.nodeId
      ?? selectionState.activeToolbarTarget?.nodeId
      ?? selectionState.hoverTarget?.nodeId
      ?? null,
  };
}

function resolveSnapshotForReference(
  snapshot: VisualTargetSnapshot | null,
  reference: EditorTargetReference,
): VisualTargetSnapshot | null {
  if (!snapshot) {
    return null;
  }

  if (!hasSameEditorTarget(snapshot.target, reference.target)) {
    return null;
  }

  if (reference.nodeId && snapshot.nodeId && reference.nodeId !== snapshot.nodeId) {
    return null;
  }

  return snapshot;
}

function createFallbackSnapshotSummary(
  target: VisualEditTargetDescriptor,
  reference: EditorTargetReference,
): VisualEditTargetSnapshotSummary {
  return {
    nodeId: reference.nodeId,
    tagName: target.tagName ?? target.fallback?.tagName ?? 'unknown',
    label: target.label ?? target.fallback?.label ?? describeVisualEditTarget(target),
    classTokens: target.classTokens ?? target.fallback?.classTokens ?? [],
    textValue: target.textPreview ?? target.fallback?.textPreview,
    attributes: {},
    inlineStyle: {},
    computedStyle: {},
    isVisible: true,
  };
}

function createControlDescriptor(
  options: VisualMutationDispatchContext,
  fallback: VisualEditControlDescriptor,
): VisualEditControlDescriptor {
  return {
    ...fallback,
    ...options.control,
    category: options.control?.category ?? fallback.category,
    kind: options.control?.kind ?? fallback.kind,
    id: options.control?.id ?? fallback.id,
    label: options.control?.label ?? fallback.label,
  };
}

function resolveStyleCategory(
  options: DispatchVisualStyleMutationOptions,
  context: ResolvedVisualMutationContext,
): VisualStyleCategory {
  if (options.category && options.category !== 'content') {
    return options.category;
  }

  const firstProperty = 'declarations' in options ? options.declarations[0]?.property : undefined;
  const definition = firstProperty ? getVisualStylePropertyDefinition(firstProperty) : null;

  if (definition) {
    return definition.category;
  }

  if (context.snapshot?.computedStyle.display?.includes('flex')) {
    return 'layout';
  }

  return 'style';
}

function visualControlKindForCategory(category: QuickActionCategory): VisualEditControlKind {
  return category === 'content' ? 'style' : category;
}

function styleControlLabel(declarations: VisualStyleDeclarationMutation[]): string {
  if (declarations.length !== 1) {
    return 'Style declarations';
  }

  return getVisualStylePropertyDefinition(declarations[0].property)?.label
    ?? cssPropertyLabel(declarations[0].property);
}

function resolveStyleBeforeValue(
  declaration: VisualStyleDeclarationMutation,
  snapshot: VisualTargetSnapshot | null,
): { value: string | null; source: 'inline' | 'computed' | 'unknown' } {
  if (declaration.previousValue !== undefined) {
    return { value: declaration.previousValue, source: 'inline' };
  }

  if (snapshot && Object.prototype.hasOwnProperty.call(snapshot.inlineStyle, declaration.property)) {
    return { value: snapshot.inlineStyle[declaration.property], source: 'inline' };
  }

  if (snapshot && Object.prototype.hasOwnProperty.call(snapshot.computedStyle, declaration.property)) {
    return { value: snapshot.computedStyle[declaration.property], source: 'computed' };
  }

  return { value: null, source: 'unknown' };
}

function summarizeStyleEdit(
  diffs: VisualStyleDeclarationDiff[],
  targetLabel: string,
): string {
  const intentSummary = summarizeIntentStyleEdit(diffs, targetLabel);
  if (intentSummary) {
    return intentSummary;
  }

  if (diffs.length === 1) {
    const diff = diffs[0];
    return `Set ${cssPropertyLabel(diff.property)} on ${targetLabel} to ${quotePreview(diff.after ?? 'removed')}.`;
  }

  return `Update ${diffs.length} style declarations on ${targetLabel}: ${diffs.map((diff) => cssPropertyLabel(diff.property)).join(', ')}.`;
}

// Percent-intent phrasing: "Increase font-size on X by 20% (base 16px)."
// Opacity steps are percentage points, not relative percent.
function summarizeIntentStyleEdit(
  diffs: VisualStyleDeclarationDiff[],
  targetLabel: string,
): string | null {
  if (diffs.length === 0 || diffs.some((diff) => !diff.intent)) {
    return null;
  }

  const percent = diffs[0].intent?.percent ?? 0;
  if (percent === 0 || diffs.some((diff) => diff.intent?.percent !== percent)) {
    return null;
  }

  const direction = percent > 0 ? 'Increase' : 'Decrease';
  const unit = diffs.every((diff) => diff.property === 'opacity') ? '%p' : '%';

  if (diffs.length === 1) {
    const diff = diffs[0];
    return `${direction} ${cssPropertyLabel(diff.property)} on ${targetLabel} by ${Math.abs(percent)}${unit} (base ${diff.intent?.base}).`;
  }

  const parts = diffs
    .map((diff) => `${cssPropertyLabel(diff.property)} (base ${diff.intent?.base})`)
    .join(', ');
  return `${direction} ${parts} on ${targetLabel} by ${Math.abs(percent)}${unit}.`;
}

function formValueAfterState(formValue: VisualFormValueMutation): VisualFormValueSnapshot {
  return {
    value: formValue.value,
    checked: formValue.checked,
    selectedIndex: formValue.selectedIndex,
    selectedValues: formValue.selectedValues,
  };
}

function structureBeforeState(options: DispatchVisualStructureMutationOptions): VisualStructureMutationSnapshot | null {
  if (options.operation === 'restore') {
    return options.structure;
  }

  return null;
}

function createStructureMessage(
  options: DispatchVisualStructureMutationOptions,
  reference: EditorTargetReference,
  breakpointId: BreakpointId,
  mutationId: number,
): DuplicateVisualElementMessage
  | MoveVisualElementMessage
  | DeleteVisualElementMessage
  | RestoreVisualElementMessage
  | RequestVisualDragMoveMessage {
  const base = {
    mutationId,
    target: reference.target,
    nodeId: reference.nodeId,
    breakpointId,
  };

  switch (options.operation) {
    case 'duplicate':
      return {
        ...base,
        type: EDITOR_MESSAGE_TYPES.duplicateVisualElement,
      };
    case 'move-up':
    case 'move-down':
      return {
        ...base,
        type: EDITOR_MESSAGE_TYPES.moveVisualElement,
        direction: options.operation === 'move-up' ? 'up' : 'down',
      };
    case 'delete':
      return {
        ...base,
        type: EDITOR_MESSAGE_TYPES.deleteVisualElement,
      };
    case 'restore':
      return {
        ...base,
        type: EDITOR_MESSAGE_TYPES.restoreVisualElement,
        structure: options.structure,
      };
    case 'drag-move':
      return {
        ...base,
        type: EDITOR_MESSAGE_TYPES.requestVisualDragMove,
        dropTarget: options.dropTarget,
        dropNodeId: options.dropNodeId,
        position: options.position,
        dropPoint: options.dropPoint,
      };
    default:
      return exhaustiveStructureOperation(options);
  }
}

function structureOperationLabel(operation: VisualStructureOperation): string {
  switch (operation) {
    case 'duplicate':
      return 'Duplicate element';
    case 'move-up':
      return 'Move element up';
    case 'move-down':
      return 'Move element down';
    case 'delete':
      return 'Delete element';
    case 'restore':
      return 'Restore element';
    case 'drag-move':
      return 'Drag element';
    default:
      return `Structure operation: ${operation}`;
  }
}

function exhaustiveStructureOperation(value: never): never {
  throw new Error(`Unsupported visual structure operation: ${JSON.stringify(value)}`);
}

function quotePreview(value: string): string {
  return `"${truncatedPreview(value)}"`;
}
