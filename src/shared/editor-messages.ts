import type { BreakpointId } from './breakpoints';

export const EDITOR_MESSAGE_TYPES = {
  bridgeReady: 'copy-ai-id:bridge-ready',
  layoutTree: 'copy-ai-id:layout-tree',
  targetHighlighted: 'copy-ai-id:target-highlighted',
  targetReferenceRequested: 'copy-ai-id:target-reference-requested',
  targetReferenceRejected: 'copy-ai-id:target-reference-rejected',
  hoverTreeNode: 'copy-ai-id:hover-tree-node',
  revealTreeNode: 'copy-ai-id:reveal-tree-node',
  keyboardShortcut: 'copy-ai-id:keyboard-shortcut',
  setHoverHighlightSuppressed: 'copy-ai-id:set-hover-highlight-suppressed',
  setCanvasZoom: 'copy-ai-id:set-canvas-zoom',
  setBoxModelMode: 'copy-ai-id:set-box-model-mode',
  iframeStatus: 'copy-ai-id:iframe-status',
} as const;

export type EditorMessageType = typeof EDITOR_MESSAGE_TYPES[keyof typeof EDITOR_MESSAGE_TYPES];

export type BridgeConnectionStatus = 'idle' | 'loading' | 'ready' | 'error';

export type IframeStatus = 'loading' | 'ready' | 'blocked' | 'error';

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

export type EditorKeyboardShortcut =
  | 'arrow-up'
  | 'arrow-down'
  | 'arrow-left'
  | 'arrow-right'
  | 'space'
  | 'shift-enter'
  | 'escape';

export interface BridgeReadyMessage {
  type: typeof EDITOR_MESSAGE_TYPES.bridgeReady;
  url: string;
  aiIdCount: number;
}

export interface LayoutTreeMessage {
  type: typeof EDITOR_MESSAGE_TYPES.layoutTree;
  url: string;
  root: LayoutTreeNode | null;
}

export interface TargetHighlightedMessage {
  type: typeof EDITOR_MESSAGE_TYPES.targetHighlighted;
  target: EditorTarget | null;
  nodeId: string | null;
  origin?: HighlightOrigin;
}

export interface TargetReferenceRequestedMessage extends EditorTargetReference {
  type: typeof EDITOR_MESSAGE_TYPES.targetReferenceRequested;
}

export interface TargetReferenceRejectedMessage {
  type: typeof EDITOR_MESSAGE_TYPES.targetReferenceRejected;
  reason: 'missing-data-ai-id' | 'stale-fallback-target';
}

export interface HoverTreeNodeMessage {
  type: typeof EDITOR_MESSAGE_TYPES.hoverTreeNode;
  nodeId: string | null;
}

export interface RevealTreeNodeMessage {
  type: typeof EDITOR_MESSAGE_TYPES.revealTreeNode;
  nodeId: string;
}

export interface KeyboardShortcutMessage {
  type: typeof EDITOR_MESSAGE_TYPES.keyboardShortcut;
  shortcut: EditorKeyboardShortcut;
}

export interface SetHoverHighlightSuppressedMessage {
  type: typeof EDITOR_MESSAGE_TYPES.setHoverHighlightSuppressed;
  suppressed: boolean;
}

export interface SetCanvasZoomMessage {
  type: typeof EDITOR_MESSAGE_TYPES.setCanvasZoom;
  zoom: number;
  breakpointId?: BreakpointId;
}

export interface SetBoxModelModeMessage {
  type: typeof EDITOR_MESSAGE_TYPES.setBoxModelMode;
  enabled: boolean;
}

export interface IframeStatusMessage {
  type: typeof EDITOR_MESSAGE_TYPES.iframeStatus;
  status: IframeStatus;
  url?: string;
  message?: string;
}

export type EditorToBridgeMessage =
  | HoverTreeNodeMessage
  | RevealTreeNodeMessage
  | KeyboardShortcutMessage
  | SetHoverHighlightSuppressedMessage
  | SetCanvasZoomMessage
  | SetBoxModelModeMessage;

export type BridgeToEditorMessage =
  | BridgeReadyMessage
  | LayoutTreeMessage
  | TargetHighlightedMessage
  | TargetReferenceRequestedMessage
  | TargetReferenceRejectedMessage
  | KeyboardShortcutMessage
  | IframeStatusMessage;
