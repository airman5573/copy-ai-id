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
  quickActionAnchorChanged: 'copy-ai-id:quick-action-anchor-changed',
  quickActionCategorySelected: 'copy-ai-id:quick-action-category-selected',
  requestVisualTargetSnapshot: 'copy-ai-id:request-visual-target-snapshot',
  visualTargetSnapshot: 'copy-ai-id:visual-target-snapshot',
  updateVisualStyle: 'copy-ai-id:update-visual-style',
  visualStyleUpdated: 'copy-ai-id:visual-style-updated',
  updateVisualText: 'copy-ai-id:update-visual-text',
  visualTextUpdated: 'copy-ai-id:visual-text-updated',
  updateVisualRichText: 'copy-ai-id:update-visual-rich-text',
  visualRichTextUpdated: 'copy-ai-id:visual-rich-text-updated',
  updateVisualAttribute: 'copy-ai-id:update-visual-attribute',
  visualAttributeUpdated: 'copy-ai-id:visual-attribute-updated',
  updateVisualFormValue: 'copy-ai-id:update-visual-form-value',
  visualFormValueUpdated: 'copy-ai-id:visual-form-value-updated',
  duplicateVisualElement: 'copy-ai-id:duplicate-visual-element',
  visualElementDuplicated: 'copy-ai-id:visual-element-duplicated',
  moveVisualElement: 'copy-ai-id:move-visual-element',
  visualElementMoved: 'copy-ai-id:visual-element-moved',
  deleteVisualElement: 'copy-ai-id:delete-visual-element',
  visualElementDeleted: 'copy-ai-id:visual-element-deleted',
  restoreVisualElement: 'copy-ai-id:restore-visual-element',
  visualElementRestored: 'copy-ai-id:visual-element-restored',
  requestVisualDragMove: 'copy-ai-id:request-visual-drag-move',
  visualDragMoveCompleted: 'copy-ai-id:visual-drag-move-completed',
  visualMutationError: 'copy-ai-id:visual-mutation-error',
  highlightVisualBoxRegion: 'copy-ai-id:highlight-visual-box-region',
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

export type VisualMoveDirection = 'up' | 'down';

export type VisualDropPosition = 'before' | 'after' | 'inside-start' | 'inside-end';

export type VisualBoxRegion = 'margin' | 'border' | 'padding' | 'content' | 'gap';

export type VisualBoxEdge = 'top' | 'right' | 'bottom' | 'left' | 'row' | 'column' | 'all';

export interface BridgeViewportSize {
  width: number;
  height: number;
}

export interface BridgeViewportPoint {
  x: number;
  y: number;
}

export interface BridgeViewportRect extends BridgeViewportPoint {
  width: number;
  height: number;
  top: number;
  right: number;
  bottom: number;
  left: number;
}

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
  previousSiblingNodeId?: string | null;
  nextSiblingNodeId?: string | null;
  targetHtml?: string;
}

export interface VisualMutationRequestBase extends EditorTargetReference {
  mutationId: number;
  breakpointId?: BreakpointId;
}

export interface VisualMutationResultBase extends EditorTargetReference {
  mutationId: number;
  applied: boolean;
  snapshot?: VisualTargetSnapshot;
  error?: VisualMutationError;
}

export interface VisualBoxRegionHighlight {
  target: EditorTarget;
  nodeId: string | null;
  region: VisualBoxRegion;
  edge?: VisualBoxEdge;
  rect?: BridgeViewportRect;
}

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
  elementRect?: BridgeViewportRect | null;
  viewport?: BridgeViewportSize;
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

export interface QuickActionAnchorChangedMessage {
  type: typeof EDITOR_MESSAGE_TYPES.quickActionAnchorChanged;
  target: EditorTarget | null;
  nodeId: string | null;
  elementRect: BridgeViewportRect | null;
  viewport: BridgeViewportSize;
  availableCategories: QuickActionCategory[];
  reason?: 'hover' | 'tree-hover' | 'hidden' | 'disconnected' | 'protected-target' | 'stale-target' | 'cleared';
}

export interface QuickActionCategorySelectedMessage extends EditorTargetReference {
  type: typeof EDITOR_MESSAGE_TYPES.quickActionCategorySelected;
  category: QuickActionCategory;
}

export interface RequestVisualTargetSnapshotMessage extends EditorTargetReference {
  type: typeof EDITOR_MESSAGE_TYPES.requestVisualTargetSnapshot;
  includeComputedProperties?: string[];
}

export interface VisualTargetSnapshotMessage {
  type: typeof EDITOR_MESSAGE_TYPES.visualTargetSnapshot;
  target: EditorTarget | null;
  nodeId: string | null;
  snapshot: VisualTargetSnapshot | null;
  error?: VisualMutationError;
}

export interface UpdateVisualStyleMessage extends VisualMutationRequestBase {
  type: typeof EDITOR_MESSAGE_TYPES.updateVisualStyle;
  declarations: VisualStyleDeclarationMutation[];
}

export interface VisualStyleUpdatedMessage extends VisualMutationResultBase {
  type: typeof EDITOR_MESSAGE_TYPES.visualStyleUpdated;
  kind: 'style';
  declarations: VisualStyleDeclarationMutation[];
}

export interface UpdateVisualTextMessage extends VisualMutationRequestBase {
  type: typeof EDITOR_MESSAGE_TYPES.updateVisualText;
  text: VisualTextMutation;
}

export interface VisualTextUpdatedMessage extends VisualMutationResultBase {
  type: typeof EDITOR_MESSAGE_TYPES.visualTextUpdated;
  kind: 'text';
  text: VisualTextMutation;
}

export interface UpdateVisualRichTextMessage extends VisualMutationRequestBase {
  type: typeof EDITOR_MESSAGE_TYPES.updateVisualRichText;
  richText: VisualRichTextMutation;
}

export interface VisualRichTextUpdatedMessage extends VisualMutationResultBase {
  type: typeof EDITOR_MESSAGE_TYPES.visualRichTextUpdated;
  kind: 'rich-text';
  richText: VisualRichTextMutation;
}

export interface UpdateVisualAttributeMessage extends VisualMutationRequestBase {
  type: typeof EDITOR_MESSAGE_TYPES.updateVisualAttribute;
  attribute: VisualAttributeMutation;
}

export interface VisualAttributeUpdatedMessage extends VisualMutationResultBase {
  type: typeof EDITOR_MESSAGE_TYPES.visualAttributeUpdated;
  kind: 'attribute';
  attribute: VisualAttributeMutation;
}

export interface UpdateVisualFormValueMessage extends VisualMutationRequestBase {
  type: typeof EDITOR_MESSAGE_TYPES.updateVisualFormValue;
  formValue: VisualFormValueMutation;
}

export interface VisualFormValueUpdatedMessage extends VisualMutationResultBase {
  type: typeof EDITOR_MESSAGE_TYPES.visualFormValueUpdated;
  kind: 'form-value';
  formValue: VisualFormValueMutation;
}

export interface DuplicateVisualElementMessage extends VisualMutationRequestBase {
  type: typeof EDITOR_MESSAGE_TYPES.duplicateVisualElement;
}

export interface VisualElementDuplicatedMessage extends VisualMutationResultBase {
  type: typeof EDITOR_MESSAGE_TYPES.visualElementDuplicated;
  kind: 'structure';
  operation: 'duplicate';
  duplicateTarget?: EditorTarget;
  duplicateNodeId?: string | null;
  structure?: VisualStructureMutationSnapshot;
}

export interface MoveVisualElementMessage extends VisualMutationRequestBase {
  type: typeof EDITOR_MESSAGE_TYPES.moveVisualElement;
  direction: VisualMoveDirection;
}

export interface VisualElementMovedMessage extends VisualMutationResultBase {
  type: typeof EDITOR_MESSAGE_TYPES.visualElementMoved;
  kind: 'structure';
  operation: 'move-up' | 'move-down';
  structure?: VisualStructureMutationSnapshot;
}

export interface DeleteVisualElementMessage extends VisualMutationRequestBase {
  type: typeof EDITOR_MESSAGE_TYPES.deleteVisualElement;
}

export interface VisualElementDeletedMessage extends VisualMutationResultBase {
  type: typeof EDITOR_MESSAGE_TYPES.visualElementDeleted;
  kind: 'structure';
  operation: 'delete';
  structure?: VisualStructureMutationSnapshot;
}

export interface RestoreVisualElementMessage extends VisualMutationRequestBase {
  type: typeof EDITOR_MESSAGE_TYPES.restoreVisualElement;
  structure: VisualStructureMutationSnapshot;
}

export interface VisualElementRestoredMessage extends VisualMutationResultBase {
  type: typeof EDITOR_MESSAGE_TYPES.visualElementRestored;
  kind: 'structure';
  operation: 'restore';
  structure?: VisualStructureMutationSnapshot;
}

export interface RequestVisualDragMoveMessage extends VisualMutationRequestBase {
  type: typeof EDITOR_MESSAGE_TYPES.requestVisualDragMove;
  dropTarget?: EditorTarget;
  dropNodeId?: string | null;
  position?: VisualDropPosition;
  dropPoint?: BridgeViewportPoint;
}

export interface VisualDragMoveCompletedMessage extends VisualMutationResultBase {
  type: typeof EDITOR_MESSAGE_TYPES.visualDragMoveCompleted;
  kind: 'structure';
  operation: 'drag-move';
  dropTarget?: EditorTarget;
  dropNodeId?: string | null;
  position?: VisualDropPosition;
  structure?: VisualStructureMutationSnapshot;
}

export interface VisualMutationErrorMessage {
  type: typeof EDITOR_MESSAGE_TYPES.visualMutationError;
  mutationId?: number;
  kind?: VisualMutationKind;
  target?: EditorTarget;
  nodeId?: string | null;
  error: VisualMutationError;
}

export interface HighlightVisualBoxRegionMessage {
  type: typeof EDITOR_MESSAGE_TYPES.highlightVisualBoxRegion;
  highlight: VisualBoxRegionHighlight | null;
}

export type EditorToBridgeMessage =
  | HoverTreeNodeMessage
  | RevealTreeNodeMessage
  | KeyboardShortcutMessage
  | SetHoverHighlightSuppressedMessage
  | SetCanvasZoomMessage
  | SetBoxModelModeMessage
  | QuickActionCategorySelectedMessage
  | RequestVisualTargetSnapshotMessage
  | UpdateVisualStyleMessage
  | UpdateVisualTextMessage
  | UpdateVisualRichTextMessage
  | UpdateVisualAttributeMessage
  | UpdateVisualFormValueMessage
  | DuplicateVisualElementMessage
  | MoveVisualElementMessage
  | DeleteVisualElementMessage
  | RestoreVisualElementMessage
  | RequestVisualDragMoveMessage
  | HighlightVisualBoxRegionMessage;

export type BridgeToEditorMessage =
  | BridgeReadyMessage
  | LayoutTreeMessage
  | TargetHighlightedMessage
  | TargetReferenceRequestedMessage
  | TargetReferenceRejectedMessage
  | KeyboardShortcutMessage
  | IframeStatusMessage
  | QuickActionAnchorChangedMessage
  | VisualTargetSnapshotMessage
  | VisualStyleUpdatedMessage
  | VisualTextUpdatedMessage
  | VisualRichTextUpdatedMessage
  | VisualAttributeUpdatedMessage
  | VisualFormValueUpdatedMessage
  | VisualElementDuplicatedMessage
  | VisualElementMovedMessage
  | VisualElementDeletedMessage
  | VisualElementRestoredMessage
  | VisualDragMoveCompletedMessage
  | VisualMutationErrorMessage;
