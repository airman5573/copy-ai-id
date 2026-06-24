import { breakpointById } from '../../shared/breakpoints';
import {
  describeVisualEditTarget,
  visualEditTargetSerializationKey,
} from '../../shared/visual-targets';
import type {
  VisualEditRecord,
  VisualEditTargetDescriptor,
  VisualEditWarning,
  VisualEditsExportDocument,
} from '../../shared/visual-edits';
import { createVisualEditsExportDocument } from '../stores/useVisualEditStore';

interface VisualEditTargetGroup {
  target: VisualEditTargetDescriptor;
  records: VisualEditRecord[];
}

const VISUAL_ONLY_REQUEST_TEXT = [
  'Apply the preview-only visual edits listed in `## Visual edits` to the source implementation.',
  'Use the human-readable summaries first, then the fenced JSON diff for exact target, before/after, and breakpoint details.',
].join(' ');

const BREAKPOINT_INTENT_NOTE = [
  'Breakpoint labels on style edits are implementation intent.',
  'The preview applies style changes as inline DOM mutations for immediate feedback unless a future diff explicitly says scoped CSS was injected.',
].join(' ');

const FALLBACK_TARGET_SAFETY_NOTE = [
  'Fallback visual-edit targets are selector/path/context references, not stable source IDs.',
  'Before applying them, re-identify the element in the current DOM/source if nearby markup changed.',
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
  document?: VisualEditsExportDocument,
): string {
  const exportableRecords = getOrderedExportableRecords(records);

  if (exportableRecords.length === 0) {
    return '';
  }

  const exportDocument = document ?? createVisualEditsExportDocument(exportableRecords);
  const targetGroups = groupVisualEditRecordsByTarget(exportableRecords);
  const fallbackTargetNote = hasFallbackVisualEditTargets(exportableRecords)
    ? ['', `Fallback target safety: ${FALLBACK_TARGET_SAFETY_NOTE}`]
    : [];
  const lines = [
    '## Visual edits',
    '',
    'These edits were made only in the live preview. Recreate them in the actual source/CSS/markup; do not copy extension runtime artifacts.',
    BREAKPOINT_INTENT_NOTE,
    ...fallbackTargetNote,
    '',
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

function formatVisualEditRecordSummary(record: VisualEditRecord): string[] {
  const lines = [
    `${record.order}. ${record.humanSummary}`,
    `   - Record id: ${record.id}`,
    `   - Category/control: ${record.control.category} / ${record.control.label}`,
    `   - Mutation: ${record.kind}; status: ${record.status}`,
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

function formatVisualEditTargetGroup(
  group: VisualEditTargetGroup,
  index: number,
  groupCount: number,
): string[] {
  const groupLabel = groupCount > 1 ? `Target ${index + 1}` : 'Target';
  const lines = [
    `### ${groupLabel}: ${formatTargetDescriptor(group.target)}`,
    '',
    `- Strategy: ${formatTargetStrategy(group.target)}`,
    `- Visual edit records: ${group.records.length}`,
  ];

  const targetSafetyLine = formatTargetSafetyLine(group.target);
  if (targetSafetyLine) {
    lines.push(`- Safety: ${targetSafetyLine}`);
  }

  const targetLocatorLines = formatTargetLocatorLines(group.target);
  if (targetLocatorLines.length > 0) {
    lines.push(...targetLocatorLines);
  }

  const groupWarnings = formatWarningEntries(uniqueWarnings(group.records.flatMap((record) => record.warnings)));
  if (groupWarnings) {
    lines.push(`- Target warnings: ${groupWarnings}`);
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

function formatTargetStrategy(target: VisualEditTargetDescriptor): string {
  if (target.strategy === 'ai-id') {
    return 'stable data-ai-id target';
  }

  return 'fallback target resolved from selector/path/context';
}

function formatTargetSafetyLine(target: VisualEditTargetDescriptor): string {
  if (target.strategy === 'ai-id') {
    return 'Apply the edit to the referenced element and do not remove or rename its data-ai-id attribute.';
  }

  return FALLBACK_TARGET_SAFETY_NOTE;
}

function formatTargetLocatorLines(target: VisualEditTargetDescriptor): string[] {
  if (target.strategy !== 'fallback') {
    return target.nodeId ? [`- Node id at capture time: ${target.nodeId}`] : [];
  }

  const lines: string[] = [];
  if (target.selector) {
    lines.push(`- Fallback selector: \`${target.selector}\``);
  }
  if (target.fallback?.selectorKind) {
    lines.push(`- Fallback selector kind: ${target.fallback.selectorKind}`);
  }
  if (target.path) {
    lines.push(`- Fallback path: \`${target.path}\``);
  }
  if (target.nodeId) {
    lines.push(`- Node id at capture time: ${target.nodeId}`);
  }
  return lines;
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
      return `structure operation ${record.payload.structure.operation}`;
    case 'html':
      return `HTML ${formatLengthChange(record.payload.html.beforeHtml, record.payload.html.afterHtml)}${record.payload.html.sanitized ? ' (sanitized)' : ''}`;
    default:
      return '';
  }
}

function formatWarnings(warnings: readonly VisualEditWarning[]): string {
  return formatWarningEntries(uniqueWarnings(warnings));
}

function formatWarningEntries(warnings: ReadonlyArray<[string, string]>): string {
  return warnings
    .map(([code, message]) => `${code}: ${message}`)
    .join('; ');
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
