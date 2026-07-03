import type { BreakpointId } from './breakpoints';
import type { BridgeViewportRect } from './domain/geometry';
import type {
  EditorTarget,
  FallbackSelectorKind,
} from './domain/targets';
import type {
  QuickActionCategory,
  VisualDropPosition,
  VisualFormValueSnapshot,
  VisualMutationError,
  VisualMutationKind,
  VisualStructureMutationSnapshot,
  VisualStructureOperation,
  VisualTargetSnapshot,
} from './domain/visual';

export const VISUAL_EDITS_EXPORT_VERSION = 2 as const;

export type VisualEditsExportVersion = typeof VISUAL_EDITS_EXPORT_VERSION;

export type VisualEditId = string;

export type VisualEditStatus = 'pending' | 'applied' | 'failed' | 'reverted';

export type VisualEditSource = 'quick-action-bar' | 'floating-panel' | 'drag-and-drop' | 'keyboard' | 'inline-text-edit';

export type VisualEditControlKind =
  | 'content'
  | 'layout'
  | 'spacing'
  | 'size'
  | 'style'
  | 'border'
  | 'structure'
  | 'rich-text'
  | 'form-value'
  | 'html';

export type VisualEditWarningCode =
  | 'fallback-target'
  | 'target-became-stale'
  | 'computed-style-only'
  | 'breakpoint-intent-inline-preview'
  | 'sanitized-html'
  | 'runtime-artifacts-stripped'
  | 'preview-only'
  | 'unsupported-source-save';

export interface VisualEditWarning {
  code: VisualEditWarningCode;
  message: string;
}

export interface VisualEditFallbackDescriptor {
  nodeId: string | null;
  tagName: string;
  label: string;
  selector: string;
  selectorKind: FallbackSelectorKind;
  path: string;
  fullPath?: string;
  textPreview?: string;
  nearbyText?: string;
  classTokens: string[];
  accessibility?: string;
}

export interface VisualEditTargetDescriptor {
  strategy: EditorTarget['kind'];
  target: EditorTarget;
  nodeId: string | null;
  tagName?: string;
  label?: string;
  aiId?: string;
  instanceIndex?: number;
  fallback?: VisualEditFallbackDescriptor;
  selector?: string;
  path?: string;
  textPreview?: string;
  accessibility?: string;
  classTokens?: string[];
}

export interface VisualEditTargetSnapshotSummary {
  nodeId: string | null;
  tagName: string;
  label: string;
  classTokens: string[];
  textValue?: string;
  richHtml?: string;
  attributes?: Record<string, string>;
  inlineStyle?: Record<string, string>;
  computedStyle?: Record<string, string>;
  rect?: BridgeViewportRect;
  isVisible: boolean;
  image?: VisualTargetSnapshot['image'];
  link?: VisualTargetSnapshot['link'];
  formValue?: VisualFormValueSnapshot;
  parentNodeId?: string | null;
  previousSiblingNodeId?: string | null;
  nextSiblingNodeId?: string | null;
}

export interface VisualEditControlDescriptor {
  category: QuickActionCategory;
  kind: VisualEditControlKind;
  id: string;
  label: string;
  sectionId?: string;
  property?: string;
}

// Percent-intent metadata for stepper edits: the preview applies a concrete
// px value, but the export records "change by n% relative to base" so the
// source change can be expressed in whatever unit the code already uses.
export interface VisualStyleValueIntent {
  percent: number;
  base: string;
}

export interface VisualStyleDeclarationDiff {
  property: string;
  before: string | null;
  after: string | null;
  priority?: '' | 'important';
  source?: 'inline' | 'computed' | 'unknown';
  intent?: VisualStyleValueIntent;
}

export interface VisualAttributeDiff {
  name: string;
  before: string | null;
  after: string | null;
}

export interface VisualTextDiff {
  before: string;
  after: string;
}

export interface VisualRichTextDiff {
  beforeHtml: string;
  afterHtml: string;
  sanitized: boolean;
  strippedRuntimeArtifacts?: string[];
}

export interface VisualFormValueDiff {
  before: VisualFormValueSnapshot;
  after: VisualFormValueSnapshot;
}

export interface VisualHtmlDiff {
  beforeHtml: string;
  afterHtml: string;
  sanitized: boolean;
  strippedRuntimeArtifacts?: string[];
}

export interface VisualStructureDiff {
  operation: VisualStructureOperation;
  before: VisualStructureMutationSnapshot | null;
  after: VisualStructureMutationSnapshot | null;
  movedDirection?: 'up' | 'down';
  dropPosition?: VisualDropPosition;
  dropTarget?: VisualEditTargetDescriptor;
  duplicatedTarget?: VisualEditTargetDescriptor;
}

export interface VisualStyleDeclarationState {
  property: string;
  value: string | null;
  priority?: '' | 'important';
  source?: 'inline' | 'computed' | 'unknown';
  intent?: VisualStyleValueIntent;
}

export interface VisualAttributeState {
  name: string;
  value: string | null;
}

export interface VisualTextState {
  value: string;
}

export interface VisualRichTextState {
  html: string;
  sanitized?: boolean;
  strippedRuntimeArtifacts?: string[];
}

export interface VisualFormValueState {
  formValue: VisualFormValueSnapshot;
}

export interface VisualStructureState {
  structure: VisualStructureMutationSnapshot | null;
}

export interface VisualHtmlState {
  html: string;
  sanitized?: boolean;
  strippedRuntimeArtifacts?: string[];
}

export interface VisualStyleStatePayload {
  kind: 'style';
  declarations: VisualStyleDeclarationState[];
}

export interface VisualAttributeStatePayload {
  kind: 'attribute';
  attributes: VisualAttributeState[];
}

export interface VisualTextStatePayload {
  kind: 'text';
  text: VisualTextState;
}

export interface VisualRichTextStatePayload {
  kind: 'rich-text';
  richText: VisualRichTextState;
}

export interface VisualFormValueStatePayload {
  kind: 'form-value';
  formValue: VisualFormValueState;
}

export interface VisualStructureStatePayload {
  kind: 'structure';
  structure: VisualStructureState;
}

export interface VisualHtmlStatePayload {
  kind: 'html';
  html: VisualHtmlState;
}

export type VisualEditStatePayload =
  | VisualStyleStatePayload
  | VisualAttributeStatePayload
  | VisualTextStatePayload
  | VisualRichTextStatePayload
  | VisualFormValueStatePayload
  | VisualStructureStatePayload
  | VisualHtmlStatePayload;

export type VisualEditStatePayloadByKind<K extends VisualMutationKind> = Extract<VisualEditStatePayload, { kind: K }>;

export interface VisualStyleEditPayload {
  kind: 'style';
  declarations: VisualStyleDeclarationDiff[];
}

export interface VisualAttributeEditPayload {
  kind: 'attribute';
  attributes: VisualAttributeDiff[];
}

export interface VisualTextEditPayload {
  kind: 'text';
  text: VisualTextDiff;
}

export interface VisualRichTextEditPayload {
  kind: 'rich-text';
  richText: VisualRichTextDiff;
}

export interface VisualFormValueEditPayload {
  kind: 'form-value';
  formValue: VisualFormValueDiff;
}

export interface VisualStructureEditPayload {
  kind: 'structure';
  structure: VisualStructureDiff;
}

export interface VisualHtmlEditPayload {
  kind: 'html';
  html: VisualHtmlDiff;
}

export type VisualEditPayload =
  | VisualStyleEditPayload
  | VisualAttributeEditPayload
  | VisualTextEditPayload
  | VisualRichTextEditPayload
  | VisualFormValueEditPayload
  | VisualStructureEditPayload
  | VisualHtmlEditPayload;

export type VisualEditPayloadByKind<K extends VisualMutationKind> = Extract<VisualEditPayload, { kind: K }>;

export interface VisualEditJsonDiff<K extends VisualMutationKind = VisualMutationKind> {
  version: VisualEditsExportVersion;
  id: VisualEditId;
  order: number;
  timestamp: string;
  kind: K;
  source: VisualEditSource;
  target: VisualEditTargetDescriptor;
  snapshot: VisualEditTargetSnapshotSummary;
  control: VisualEditControlDescriptor;
  breakpointId?: BreakpointId;
  payload: VisualEditPayloadByKind<K>;
  before: VisualEditStatePayloadByKind<K>;
  after: VisualEditStatePayloadByKind<K>;
  summary: string;
  warnings: VisualEditWarning[];
}

export interface VisualEditRecord<K extends VisualMutationKind = VisualMutationKind> {
  id: VisualEditId;
  order: number;
  timestamp: string;
  status: VisualEditStatus;
  source: VisualEditSource;
  target: VisualEditTargetDescriptor;
  targetSnapshot: VisualEditTargetSnapshotSummary;
  category: QuickActionCategory;
  controlKind: VisualEditControlKind;
  control: VisualEditControlDescriptor;
  breakpointId?: BreakpointId;
  kind: K;
  payload: VisualEditPayloadByKind<K>;
  before: VisualEditStatePayloadByKind<K>;
  after: VisualEditStatePayloadByKind<K>;
  humanSummary: string;
  jsonDiff: VisualEditJsonDiff<K>;
  warnings: VisualEditWarning[];
  error?: VisualMutationError;
}

export interface VisualEditsExportDocument {
  version: VisualEditsExportVersion;
  generatedAt: string;
  edits: Array<VisualEditJsonDiff>;
}
