// Target identity and layout-tree domain types shared across layers.

export type FallbackSelectorKind =
  | 'unique-semantic-tag'
  | 'id'
  | 'unique-class'
  | 'nth-child'
  | 'shadow-path';

export interface AiIdEditorTarget {
  kind: 'ai-id';
  aiId: string;
  instanceIndex: number;
}

export interface FallbackTargetMetadata {
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

export interface FallbackEditorTarget extends FallbackTargetMetadata {
  kind: 'fallback';
  nodeId: string;
}

export type EditorTarget = AiIdEditorTarget | FallbackEditorTarget;

export interface EditorTargetReference {
  target: EditorTarget;
  nodeId: string | null;
}

export type HighlightOrigin = 'preview' | 'layout-tree' | 'editor';

export interface LayoutTreeNode {
  nodeId: string;
  tagName: string;
  aiId: string | null;
  instanceIndex: number;
  duplicateCount: number;
  classTokens: string[];
  textPreview: string;
  fallback: FallbackTargetMetadata | null;
  isVisible: boolean;
  children: LayoutTreeNode[];
}
