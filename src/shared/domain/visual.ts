// Visual-editing domain types: categories, mutation payloads, snapshots,
// and box-model highlighting. Wire messages live in shared/protocol/.

import type {
  BridgeViewportRect,
  BridgeViewportSize,
} from './geometry';
import type {
  EditorTarget,
  FallbackTargetMetadata,
} from './targets';

export type QuickActionCategory = 'content' | 'layout' | 'spacing' | 'size' | 'style' | 'border';

export type VisualMutationKind =
  | 'style'
  | 'attribute'
  | 'text'
  | 'rich-text'
  | 'form-value'
  | 'structure'
  | 'html';

export type VisualMutationErrorCode =
  | 'target-not-found'
  | 'stale-target'
  | 'ambiguous-target'
  | 'protected-target'
  | 'unsupported-target'
  | 'invalid-value'
  | 'invalid-html'
  | 'mutation-failed'
  | 'restore-unavailable';

export type VisualStructureOperation = 'duplicate' | 'move-up' | 'move-down' | 'delete' | 'restore' | 'drag-move';

export type QuickActionStructureOperation = Extract<
  VisualStructureOperation,
  'duplicate' | 'move-up' | 'move-down' | 'delete'
>;

export type VisualMoveDirection = 'up' | 'down';

export type VisualDropPosition = 'before' | 'after' | 'inside-start' | 'inside-end';

export type VisualBoxRegion = 'margin' | 'border' | 'padding' | 'content' | 'gap';

export type VisualBoxEdge = 'top' | 'right' | 'bottom' | 'left' | 'row' | 'column' | 'all';

export interface VisualElementImageSnapshot {
  src: string;
  alt?: string;
  width?: number;
  height?: number;
}

export interface VisualElementLinkSnapshot {
  href: string;
  target?: string;
  rel?: string;
  text?: string;
}

export interface VisualFormValueSnapshot {
  value?: string;
  checked?: boolean;
  selectedIndex?: number;
  selectedValues?: string[];
}

export interface VisualParentSnapshot {
  nodeId: string | null;
  tagName: string;
  aiId: string | null;
  fallback: FallbackTargetMetadata | null;
}

export interface VisualSiblingSnapshot {
  nodeId: string | null;
  tagName: string;
  aiId: string | null;
  textPreview?: string;
  fallback: FallbackTargetMetadata | null;
}

export interface VisualTargetSnapshot {
  target: EditorTarget;
  nodeId: string | null;
  tagName: string;
  label: string;
  classTokens: string[];
  attributes: Record<string, string>;
  inlineStyle: Record<string, string>;
  computedStyle: Record<string, string>;
  textValue?: string;
  richHtml?: string;
  formValue?: VisualFormValueSnapshot;
  image?: VisualElementImageSnapshot;
  link?: VisualElementLinkSnapshot;
  parent?: VisualParentSnapshot;
  previousSibling?: VisualSiblingSnapshot;
  nextSibling?: VisualSiblingSnapshot;
  fallback: FallbackTargetMetadata | null;
  elementRect: BridgeViewportRect;
  viewport: BridgeViewportSize;
  isVisible: boolean;
}

export interface VisualMutationError {
  code: VisualMutationErrorCode;
  message: string;
  detail?: string;
}

export interface VisualStyleDeclarationMutation {
  property: string;
  value: string;
  priority?: '' | 'important';
  previousValue?: string | null;
}

export interface VisualAttributeMutation {
  name: string;
  value: string | null;
  previousValue?: string | null;
}

export interface VisualTextMutation {
  value: string;
  previousValue?: string;
}

export interface VisualRichTextMutation {
  html: string;
  previousHtml?: string;
}

export interface VisualFormValueMutation {
  value?: string;
  checked?: boolean;
  selectedIndex?: number;
  selectedValues?: string[];
  previousValue?: VisualFormValueSnapshot;
}

export interface VisualStructureMutationSnapshot {
  operation: VisualStructureOperation;
  parentNodeId?: string | null;
  childElementIndex?: number | null;
  previousSiblingNodeId?: string | null;
  nextSiblingNodeId?: string | null;
  targetHtml?: string;
}

export interface VisualBoxRegionHighlight {
  target: EditorTarget;
  nodeId: string | null;
  region: VisualBoxRegion;
  edge?: VisualBoxEdge;
  rect?: BridgeViewportRect;
}
