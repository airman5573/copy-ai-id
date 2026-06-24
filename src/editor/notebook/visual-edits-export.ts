import { breakpointById } from '../../shared/breakpoints';
import { describeVisualEditTarget } from '../../shared/visual-targets';
import type {
  VisualEditRecord,
  VisualEditTargetDescriptor,
  VisualEditWarning,
  VisualEditsExportDocument,
} from '../../shared/visual-edits';
import { createVisualEditsExportDocument } from '../stores/useVisualEditStore';

const VISUAL_ONLY_REQUEST_TEXT = [
  'Apply the preview-only visual edits listed in `## Visual edits` to the source implementation.',
  'Use the human-readable summaries first, then the fenced JSON diff for exact target, before/after, and breakpoint details.',
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
  const exportableRecords = records.filter((record) => record.status !== 'failed' && record.status !== 'reverted');

  if (exportableRecords.length === 0) {
    return '';
  }

  const exportDocument = document ?? createVisualEditsExportDocument(exportableRecords);
  const lines = [
    '## Visual edits',
    '',
    'These edits were made only in the live preview. Recreate them in the actual source/CSS/markup; do not copy extension runtime artifacts.',
    '',
    ...exportableRecords.flatMap((record, index) => formatVisualEditRecordSummary(record, index)),
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

function formatVisualEditRecordSummary(record: VisualEditRecord, index: number): string[] {
  const lines = [
    `${index + 1}. ${record.humanSummary}`,
    `   - Target: ${formatTargetDescriptor(record.target)}`,
    `   - Category/control: ${record.control.category} / ${record.control.label}`,
    `   - Mutation: ${record.kind}; status: ${record.status}`,
  ];

  if (record.breakpointId) {
    const breakpoint = breakpointById(record.breakpointId);
    lines.push(`   - Breakpoint: ${breakpoint.label} (${record.breakpointId}, ${breakpoint.width}px)`);
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
  const uniqueWarnings = Array.from(
    new Map(warnings.map((warning) => [warning.code, warning.message])).entries(),
  );

  return uniqueWarnings
    .map(([code, message]) => `${code}: ${message}`)
    .join('; ');
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
