import { breakpointById } from '../../shared/breakpoints';
import { truncatedPreview } from '../lib/format';
import type { VisualStructureMutationSnapshot } from '../../shared/domain/visual';
import type {
  VisualEditPayload,
  VisualEditRecord,
  VisualEditStatePayload,
  VisualEditTargetDescriptor,
  VisualEditWarning,
} from '../../shared/visual-edits';

// Machine-readable compact JSON export of visual-edit records. The human
// Markdown formatter lives in visual-edits-export.ts.
export interface CompactVisualEditsExportDocument {
  version: 2;
  generatedAt: string;
  format: 'compact-visual-edits-v2';
  edits: CompactVisualEditDiff[];
}

export interface CompactVisualEditDiff {
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

export interface CompactVisualEditTarget {
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

export interface CompactStructurePosition {
  parentNodeId: string | null;
  childElementIndex: number | null;
  previousSiblingNodeId: string | null;
  nextSiblingNodeId: string | null;
}

export function createCompactVisualEditsExportDocument(records: readonly VisualEditRecord[]): CompactVisualEditsExportDocument {
  return {
    version: 2,
    generatedAt: new Date().toISOString(),
    format: 'compact-visual-edits-v2',
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
          // Percent intent for stepper edits; before/after px stay as reference.
          intent: declaration.intent,
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

export function contextForTarget(target: VisualEditTargetDescriptor): string | undefined {
  const context = target.textPreview
    ?? target.fallback?.nearbyText
    ?? target.fallback?.textPreview
    ?? target.accessibility
    ?? target.classTokens?.join(' ');

  return context && context.trim().length > 0 ? formatPlainPreview(context) : undefined;
}

function removeUndefinedProperties<T extends Record<string, unknown>>(value: T): T {
  return Object.fromEntries(
    Object.entries(value).filter(([, entryValue]) => entryValue !== undefined),
  ) as T;
}

function exhaustivePayload(value: never): never {
  throw new Error(`Unsupported visual edit payload: ${JSON.stringify(value)}`);
}

export function uniqueWarnings(warnings: readonly VisualEditWarning[]): Array<[string, string]> {
  return Array.from(
    new Map(warnings.map((warning) => [warning.code, warning.message])).entries(),
  );
}

export function formatPlainPreview(value: string): string {
  return truncatedPreview(value, 160);
}
