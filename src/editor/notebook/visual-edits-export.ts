import { breakpointById } from '../../shared/breakpoints';
import {
  describeVisualEditTarget,
  visualEditTargetSerializationKey,
} from '../../shared/visual-targets';
import type {
  EditorTarget,
  VisualStructureMutationSnapshot,
} from '../../shared/editor-messages';
import type {
  VisualEditPayload,
  VisualEditRecord,
  VisualEditStatePayload,
  VisualEditTargetDescriptor,
  VisualEditWarning,
} from '../../shared/visual-edits';

interface VisualEditTargetGroup {
  target: VisualEditTargetDescriptor;
  records: VisualEditRecord[];
}

interface ExistingNotebookTarget {
  target: EditorTarget;
}

interface CompactVisualEditsExportDocument {
  version: 1;
  generatedAt: string;
  format: 'compact-visual-edits-v1';
  edits: CompactVisualEditDiff[];
}

interface CompactVisualEditDiff {
  id: string;
  order: number;
  kind: VisualEditRecord['kind'];
  operation: string;
  target: CompactVisualEditTarget;
  breakpoint?: {
    id: string;
    label: string;
    width: number;
  };
  change?: unknown;
  insertPosition?: CompactStructurePosition;
  html?: string;
  warnings?: string[];
}

interface CompactVisualEditTarget {
  strategy: VisualEditTargetDescriptor['strategy'];
  aiId?: string;
  instanceIndex?: number;
  selector?: string;
  selectorKind?: string;
  path?: string;
  tagName?: string;
  label?: string;
  context?: string;
}

interface CompactStructurePosition {
  parentNodeId: string | null;
  childElementIndex: number | null;
  previousSiblingNodeId: string | null;
  nextSiblingNodeId: string | null;
}

const VISUAL_ONLY_REQUEST_TEXT = [
  'Apply the preview-only visual edits listed in `## Visual edits` to the source implementation.',
  'Use the compact JSON for exact operation, target, insertion, HTML, breakpoint, and warning details.',
].join(' ');

const BREAKPOINT_INTENT_NOTE = [
  'Breakpoint labels are implementation intent.',
  'For non-base style edits, recreate the change as responsive/scoped source CSS.',
].join(' ');

const FALLBACK_TARGET_SAFETY_NOTE = [
  'Fallback targets are selector/context hints, not stable source IDs.',
  'Prefer adding a stable data-ai-id in source first; otherwise re-identify the element before editing.',
].join(' ');

export function getVisualOnlyNotebookRequestText(): string {
  return VISUAL_ONLY_REQUEST_TEXT;
}

export function appendVisualEditsSection(
  value: string,
  records: readonly VisualEditRecord[],
): string {
  const section = formatVisualEditsSection(records);
  const trimmedValue = value.trimEnd();

  if (!section) {
    return trimmedValue;
  }

  if (!trimmedValue) {
    return section;
  }

  return `${trimmedValue}\n\n${section}`;
}

export function formatVisualEditsSection(
  records: readonly VisualEditRecord[],
  document?: CompactVisualEditsExportDocument,
): string {
  const exportableRecords = getOrderedExportableRecords(records);

  if (exportableRecords.length === 0) {
    return '';
  }

  const exportDocument = document ?? createCompactVisualEditsExportDocument(exportableRecords);
  const targetGroups = groupVisualEditRecordsByTarget(exportableRecords);
  const guidanceLines = [
    'Preview-only: recreate these changes in source; do not copy extension runtime artifacts.',
    hasFallbackVisualEditTargets(exportableRecords) ? `Fallback safety: ${FALLBACK_TARGET_SAFETY_NOTE}` : '',
    hasNonBaseStyleVisualEdit(exportableRecords) ? `Breakpoint note: ${BREAKPOINT_INTENT_NOTE}` : '',
  ].filter(Boolean);
  const guidanceBlock = guidanceLines.length > 0
    ? [...guidanceLines, '']
    : [];
  const lines = [
    '## Visual edits',
    '',
    ...guidanceBlock,
    ...targetGroups.flatMap((group, index) => formatVisualEditTargetGroup(group, index, targetGroups.length)),
    '',
    '```json',
    JSON.stringify(exportDocument, null, 2),
    '```',
  ];

  return lines.join('\n').trimEnd();
}

export function hasAiIdVisualEditTargets(records: readonly VisualEditRecord[]): boolean {
  return records.some((record) => record.target.strategy === 'ai-id');
}

export function hasFallbackVisualEditTargets(records: readonly VisualEditRecord[]): boolean {
  return records.some((record) => record.target.strategy === 'fallback');
}

export function formatVisualEditTargetsForNotebookTargets(
  records: readonly VisualEditRecord[],
  existingTargets: readonly ExistingNotebookTarget[] = [],
): string {
  const exportableRecords = getOrderedExportableRecords(records);
  if (exportableRecords.length === 0) {
    return '';
  }

  return groupVisualEditRecordsByTarget(exportableRecords)
    .filter((group) => !existingTargets.some((existing) => visualEditTargetMatchesEditorTarget(group.target, existing.target)))
    .map(formatVisualEditNotebookTargetDetail)
    .join('\n\n');
}

function formatVisualEditRecordSummary(record: VisualEditRecord): string[] {
  const lines = [
    `${record.order}. ${record.humanSummary}`,
    `   - id: ${formatInlineCode(record.id)}; kind: ${formatInlineCode(record.kind)}; status: ${record.status}`,
  ];

  if (record.breakpointId) {
    lines.push(`   - ${formatBreakpointLine(record)}`);
  }

  const payloadLine = formatPayloadSummary(record);
  if (payloadLine) {
    lines.push(`   - Diff: ${payloadLine}`);
  }

  const warnings = formatWarnings(record.warnings);
  if (warnings) {
    lines.push(`   - Warnings: ${warnings}`);
  }

  return lines;
}

function formatVisualEditNotebookTargetDetail(group: VisualEditTargetGroup, index: number): string {
  const target = group.target;
  const lines = [
    `### ${formatInlineCode(`visual-edit-target-${index + 1}`)}`,
    `- Source visual edits: ${group.records.map((record) => formatInlineCode(record.id)).join(', ')}`,
    `- Target: ${formatTargetReferenceLine(target)}`,
  ];

  if (target.strategy === 'ai-id') {
    const context = contextForTarget(target);
    if (context) {
      lines.push(`- Context: ${formatPlainPreview(context)}`);
    }

    return lines.join('\n');
  }

  const context = contextForTarget(target);
  if (context) {
    lines.push(`- Context: ${formatPlainPreview(context)}`);
  }
  lines.push(`- Safety: ${FALLBACK_TARGET_SAFETY_NOTE}`);

  return lines.join('\n');
}

function formatVisualEditTargetGroup(
  group: VisualEditTargetGroup,
  index: number,
  groupCount: number,
): string[] {
  const groupLabel = groupCount > 1 ? `Target ${index + 1}` : 'Target';
  const lines = [
    `### ${groupLabel}: ${formatTargetDescriptor(group.target)}`,
    '',
    `- Target: ${formatTargetReferenceLine(group.target)}`,
  ];

  const targetSafetyLine = formatTargetSafetyLine(group.target);
  if (targetSafetyLine) {
    lines.push(`- Safety: ${targetSafetyLine}`);
  }

  const groupWarnings = formatWarningCodes(uniqueWarnings(group.records.flatMap((record) => record.warnings)));
  if (groupWarnings) {
    lines.push(`- Warnings: ${groupWarnings}`);
  }

  lines.push('', ...group.records.flatMap((record) => formatVisualEditRecordSummary(record)));
  return lines;
}

function formatTargetDescriptor(target: VisualEditTargetDescriptor): string {
  if (target.strategy === 'ai-id') {
    const instanceSuffix = target.instanceIndex && target.instanceIndex > 0
      ? `, instance ${target.instanceIndex + 1}`
      : '';
    const tagSuffix = target.tagName ? `, tag ${target.tagName}` : '';
    return `data-ai-id "${target.aiId}"${instanceSuffix}${tagSuffix}`;
  }

  return describeVisualEditTarget(target);
}

function formatTargetReferenceLine(target: VisualEditTargetDescriptor): string {
  if (target.strategy === 'ai-id') {
    const parts = [
      target.aiId ? `data-ai-id ${formatInlineCode(target.aiId)}` : 'data-ai-id target',
      target.tagName ? `<${target.tagName}>` : '',
      target.instanceIndex && target.instanceIndex > 0 ? `instance ${target.instanceIndex + 1}` : '',
    ].filter(Boolean);
    return parts.join(', ');
  }

  const selectorKind = target.fallback?.selectorKind
    ?? (target.target.kind === 'fallback' ? target.target.selectorKind : 'unknown');
  const parts = [
    target.selector ? `fallback ${formatInlineCode(target.selector)}` : 'fallback target',
    `selector kind ${formatInlineCode(selectorKind)}`,
    target.tagName ? `<${target.tagName}>` : '',
    target.label ? `— ${target.label}` : '',
  ].filter(Boolean);

  return parts.join(' ');
}

function formatTargetSafetyLine(target: VisualEditTargetDescriptor): string {
  if (target.strategy === 'ai-id') {
    return 'Apply the edit to the referenced element and do not remove or rename its data-ai-id attribute.';
  }

  return FALLBACK_TARGET_SAFETY_NOTE;
}

function formatBreakpointLine(record: VisualEditRecord): string {
  const breakpointId = record.breakpointId;

  if (!breakpointId) {
    return 'Breakpoint: not recorded';
  }

  const breakpoint = breakpointById(breakpointId);
  const baseLabel = `Breakpoint intent: ${breakpoint.label} (${breakpointId}, ${breakpoint.width}px)`;

  if (record.kind === 'style' && breakpointId !== 'base') {
    return `${baseLabel}; preview was applied inline for immediate feedback, so implement this as responsive/scoped CSS for that breakpoint.`;
  }

  return baseLabel;
}

function formatPayloadSummary(record: VisualEditRecord): string {
  switch (record.payload.kind) {
    case 'style':
      return record.payload.declarations
        .map((declaration) => `${declaration.property}: ${formatNullableValue(declaration.before)} → ${formatNullableValue(declaration.after)}`)
        .join('; ');
    case 'attribute':
      return record.payload.attributes
        .map((attribute) => `${attribute.name}: ${formatNullableValue(attribute.before)} → ${formatNullableValue(attribute.after)}`)
        .join('; ');
    case 'text':
      return `text ${formatQuotedPreview(record.payload.text.before)} → ${formatQuotedPreview(record.payload.text.after)}`;
    case 'rich-text':
      return `rich HTML ${formatLengthChange(record.payload.richText.beforeHtml, record.payload.richText.afterHtml)}${record.payload.richText.sanitized ? ' (sanitized)' : ''}`;
    case 'form-value':
      return `form value ${formatJsonInline(record.payload.formValue.before)} → ${formatJsonInline(record.payload.formValue.after)}`;
    case 'structure':
      return formatStructurePayloadSummary(record);
    case 'html':
      return `HTML ${formatLengthChange(record.payload.html.beforeHtml, record.payload.html.afterHtml)}${record.payload.html.sanitized ? ' (sanitized)' : ''}`;
    default:
      return '';
  }
}

function formatWarnings(warnings: readonly VisualEditWarning[]): string {
  return formatWarningCodes(uniqueWarnings(warnings));
}

function formatWarningCodes(warnings: ReadonlyArray<[string, string]>): string {
  return warnings
    .map(([code]) => code)
    .join(', ');
}

function uniqueWarnings(warnings: readonly VisualEditWarning[]): Array<[string, string]> {
  return Array.from(
    new Map(warnings.map((warning) => [warning.code, warning.message])).entries(),
  );
}

function getOrderedExportableRecords(records: readonly VisualEditRecord[]): VisualEditRecord[] {
  return records
    .filter((record) => record.status !== 'failed' && record.status !== 'reverted')
    .slice()
    .sort(compareVisualEditRecords);
}

function compareVisualEditRecords(first: VisualEditRecord, second: VisualEditRecord): number {
  return first.order - second.order
    || first.timestamp.localeCompare(second.timestamp)
    || first.id.localeCompare(second.id);
}

function groupVisualEditRecordsByTarget(records: readonly VisualEditRecord[]): VisualEditTargetGroup[] {
  const groups = new Map<string, VisualEditTargetGroup>();

  for (const record of records) {
    const key = visualEditTargetSerializationKey(record.target);
    const existing = groups.get(key);
    if (existing) {
      existing.records.push(record);
      continue;
    }

    groups.set(key, {
      target: record.target,
      records: [record],
    });
  }

  return Array.from(groups.values())
    .map((group) => ({
      ...group,
      records: group.records.slice().sort(compareVisualEditRecords),
    }))
    .sort((first, second) => compareVisualEditRecords(first.records[0], second.records[0]));
}

function visualEditTargetMatchesEditorTarget(
  descriptor: VisualEditTargetDescriptor,
  target: EditorTarget,
): boolean {
  if (descriptor.strategy !== target.kind) {
    return false;
  }

  if (descriptor.strategy === 'ai-id' && target.kind === 'ai-id') {
    return descriptor.aiId === target.aiId
      && (descriptor.instanceIndex ?? 0) === target.instanceIndex;
  }

  if (descriptor.strategy === 'fallback' && target.kind === 'fallback') {
    const descriptorTarget = descriptor.target.kind === 'fallback' ? descriptor.target : null;
    if (descriptor.nodeId && target.nodeId && descriptor.nodeId === target.nodeId) {
      return true;
    }

    return (descriptor.selector ?? descriptorTarget?.selector) === target.selector
      && (descriptor.path ?? descriptorTarget?.path) === target.path
      && (descriptor.tagName ?? descriptorTarget?.tagName) === target.tagName;
  }

  return false;
}

function createCompactVisualEditsExportDocument(records: readonly VisualEditRecord[]): CompactVisualEditsExportDocument {
  return {
    version: 1,
    generatedAt: new Date().toISOString(),
    format: 'compact-visual-edits-v1',
    edits: records.map(compactVisualEditDiffForRecord),
  };
}

function compactVisualEditDiffForRecord(record: VisualEditRecord): CompactVisualEditDiff {
  const compactStructure = record.payload.kind === 'structure'
    ? compactStructureFields(record)
    : {};
  const change = compactChangeForRecord(record);
  const warnings = compactWarnings(record.warnings);

  return removeUndefinedProperties({
    id: record.id,
    order: record.order,
    kind: record.kind,
    operation: operationForRecord(record),
    target: compactTargetForDescriptor(record.target),
    breakpoint: compactBreakpointForRecord(record),
    change,
    ...compactStructure,
    warnings: warnings.length > 0 ? warnings : undefined,
  });
}

function compactTargetForDescriptor(target: VisualEditTargetDescriptor): CompactVisualEditTarget {
  if (target.strategy === 'ai-id') {
    return removeUndefinedProperties({
      strategy: 'ai-id' as const,
      aiId: target.aiId,
      instanceIndex: target.instanceIndex && target.instanceIndex > 0 ? target.instanceIndex : undefined,
      tagName: target.tagName,
      label: target.label,
      context: contextForTarget(target),
    });
  }

  return removeUndefinedProperties({
    strategy: 'fallback' as const,
    selector: target.selector ?? target.fallback?.selector,
    selectorKind: target.fallback?.selectorKind
      ?? (target.target.kind === 'fallback' ? target.target.selectorKind : undefined),
    path: target.path ?? target.fallback?.path,
    tagName: target.tagName ?? target.fallback?.tagName,
    label: target.label ?? target.fallback?.label,
    context: contextForTarget(target),
  });
}

function compactBreakpointForRecord(record: VisualEditRecord): CompactVisualEditDiff['breakpoint'] {
  if (!record.breakpointId) {
    return undefined;
  }

  const breakpoint = breakpointById(record.breakpointId);
  return {
    id: record.breakpointId,
    label: breakpoint.label,
    width: breakpoint.width,
  };
}

function compactChangeForRecord(record: VisualEditRecord): unknown {
  const payload = record.payload;

  switch (payload.kind) {
    case 'style':
      return {
        declarations: payload.declarations.map((declaration) => removeUndefinedProperties({
          property: declaration.property,
          before: declaration.before,
          after: declaration.after,
          priority: declaration.priority,
          source: declaration.source,
        })),
      };
    case 'attribute':
      return { attributes: payload.attributes };
    case 'text':
      return { text: payload.text };
    case 'rich-text':
      return {
        beforeHtml: payload.richText.beforeHtml,
        afterHtml: payload.richText.afterHtml,
        sanitized: payload.richText.sanitized,
        strippedRuntimeArtifacts: payload.richText.strippedRuntimeArtifacts,
      };
    case 'form-value':
      return { formValue: payload.formValue };
    case 'structure':
      return compactStructureChange(payload, record.before, record.after);
    case 'html':
      return {
        beforeHtml: payload.html.beforeHtml,
        afterHtml: payload.html.afterHtml,
        sanitized: payload.html.sanitized,
        strippedRuntimeArtifacts: payload.html.strippedRuntimeArtifacts,
      };
    default:
      return exhaustivePayload(payload);
  }
}

function compactStructureFields(record: VisualEditRecord): Partial<CompactVisualEditDiff> {
  if (record.payload.kind !== 'structure') {
    return {};
  }

  const { structure } = record.payload;
  const referenceSnapshot = structure.after ?? structure.before;

  return removeUndefinedProperties({
    insertPosition: compactStructurePosition(structure.after),
    html: referenceSnapshot?.targetHtml,
  });
}

function compactStructureChange(
  payload: Extract<VisualEditPayload, { kind: 'structure' }>,
  beforeState: VisualEditStatePayload,
  afterState: VisualEditStatePayload,
): unknown {
  const { structure } = payload;

  return removeUndefinedProperties({
    operation: structure.operation,
    before: compactStructurePosition(structure.before ?? stateStructureSnapshot(beforeState)),
    after: compactStructurePosition(structure.after ?? stateStructureSnapshot(afterState)),
    movedDirection: structure.movedDirection,
    dropPosition: structure.dropPosition,
    dropTarget: structure.dropTarget ? compactTargetForDescriptor(structure.dropTarget) : undefined,
    duplicatedTarget: structure.duplicatedTarget ? compactTargetForDescriptor(structure.duplicatedTarget) : undefined,
  });
}

function compactStructurePosition(
  snapshot: VisualStructureMutationSnapshot | null | undefined,
): CompactStructurePosition | undefined {
  if (!snapshot) {
    return undefined;
  }

  return {
    parentNodeId: snapshot.parentNodeId ?? null,
    childElementIndex: snapshot.childElementIndex ?? null,
    previousSiblingNodeId: snapshot.previousSiblingNodeId ?? null,
    nextSiblingNodeId: snapshot.nextSiblingNodeId ?? null,
  };
}

function stateStructureSnapshot(state: VisualEditStatePayload): VisualStructureMutationSnapshot | null {
  if (state.kind !== 'structure') {
    return null;
  }

  return state.structure.structure;
}

function operationForRecord(record: VisualEditRecord): string {
  if (record.payload.kind === 'structure') {
    return record.payload.structure.operation;
  }

  return record.control.id || record.control.label || record.kind;
}

function compactWarnings(warnings: readonly VisualEditWarning[]): string[] {
  return uniqueWarnings(warnings).map(([code]) => code);
}

function hasNonBaseStyleVisualEdit(records: readonly VisualEditRecord[]): boolean {
  return records.some((record) => record.kind === 'style' && record.breakpointId && record.breakpointId !== 'base');
}

function contextForTarget(target: VisualEditTargetDescriptor): string | undefined {
  const context = target.textPreview
    ?? target.fallback?.nearbyText
    ?? target.fallback?.textPreview
    ?? target.accessibility
    ?? target.classTokens?.join(' ');

  return context && context.trim().length > 0 ? formatPlainPreview(context) : undefined;
}

function formatStructurePayloadSummary(record: VisualEditRecord): string {
  if (record.payload.kind !== 'structure') {
    return '';
  }

  const { structure } = record.payload;
  const afterIndex = structure.after?.childElementIndex;
  const beforeIndex = structure.before?.childElementIndex;
  const index = afterIndex ?? beforeIndex;
  const position = index === null || index === undefined ? '' : ` at child index ${index}`;
  const html = (structure.after ?? structure.before)?.targetHtml;
  const htmlPreview = html ? `; HTML ${formatQuotedPreview(html)}` : '';

  return `structure ${structure.operation}${position}${htmlPreview}`;
}

function removeUndefinedProperties<T extends Record<string, unknown>>(value: T): T {
  return Object.fromEntries(
    Object.entries(value).filter(([, entryValue]) => entryValue !== undefined),
  ) as T;
}

function exhaustivePayload(value: never): never {
  throw new Error(`Unsupported visual edit payload: ${JSON.stringify(value)}`);
}

function formatNullableValue(value: string | null): string {
  if (value === null) {
    return '∅';
  }

  return formatQuotedPreview(value);
}

function formatLengthChange(before: string, after: string): string {
  return `${before.length} chars → ${after.length} chars`;
}

function formatQuotedPreview(value: string): string {
  const normalized = value.replace(/\s+/g, ' ').trim();
  const preview = normalized.length > 80 ? `${normalized.slice(0, 79)}…` : normalized;
  return `"${preview.replace(/"/g, '\\"')}"`;
}

function formatJsonInline(value: unknown): string {
  return JSON.stringify(value);
}

function formatInlineCode(value: string): string {
  return `\`${value.replace(/`/g, '\\`')}\``;
}

function formatPlainPreview(value: string): string {
  const normalized = value.replace(/\s+/g, ' ').trim();
  return normalized.length > 160 ? `${normalized.slice(0, 159)}…` : normalized;
}
