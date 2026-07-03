// Wire protocol for the editor <-> preview-bridge postMessage channel.
// Domain value types live in shared/domain/.

import type { BreakpointId } from '../breakpoints';
import type {
  BridgeViewportPoint,
  BridgeViewportRect,
  BridgeViewportSize,
} from '../domain/geometry';
import type { ElementIntent } from '../domain/intent';
import type {
  EditorTarget,
  EditorTargetReference,
  HighlightOrigin,
  LayoutTreeNode,
} from '../domain/targets';
import type {
  QuickActionCategory,
  QuickActionStructureOperation,
  VisualAttributeMutation,
  VisualBoxRegionHighlight,
  VisualDropPosition,
  VisualFormValueMutation,
  VisualMoveDirection,
  VisualMutationError,
  VisualMutationKind,
  VisualRichTextMutation,
  VisualStructureMutationSnapshot,
  VisualStyleDeclarationMutation,
  VisualTargetSnapshot,
  VisualTextMutation,
} from '../domain/visual';

export const EDITOR_MESSAGE_TYPES = {
  bridgeReady: 'copy-ai-id:bridge-ready',
  layoutTree: 'copy-ai-id:layout-tree',
  targetHighlighted: 'copy-ai-id:target-highlighted',
  targetReferenceRequested: 'copy-ai-id:target-reference-requested',
  targetReferenceRejected: 'copy-ai-id:target-reference-rejected',
  revealTreeNode: 'copy-ai-id:reveal-tree-node',
  keyboardShortcut: 'copy-ai-id:keyboard-shortcut',
  clearQuickActionSelection: 'copy-ai-id:clear-quick-action-selection',
  setHoverHighlightSuppressed: 'copy-ai-id:set-hover-highlight-suppressed',
  setCanvasZoom: 'copy-ai-id:set-canvas-zoom',
  iframeStatus: 'copy-ai-id:iframe-status',
  quickActionAnchorChanged: 'copy-ai-id:quick-action-anchor-changed',
  quickActionCategoryRequested: 'copy-ai-id:quick-action-category-requested',
  quickActionStructureRequested: 'copy-ai-id:quick-action-structure-requested',
  quickActionDragMovePreviewRequested: 'copy-ai-id:quick-action-drag-move-preview-requested',
  quickActionDragMoveRequested: 'copy-ai-id:quick-action-drag-move-requested',
  quickActionDragMoveClearRequested: 'copy-ai-id:quick-action-drag-move-clear-requested',
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
  previewVisualDragMove: 'copy-ai-id:preview-visual-drag-move',
  clearVisualDragMovePreview: 'copy-ai-id:clear-visual-drag-move-preview',
  requestVisualDragMove: 'copy-ai-id:request-visual-drag-move',
  visualDragMoveCompleted: 'copy-ai-id:visual-drag-move-completed',
  visualMutationError: 'copy-ai-id:visual-mutation-error',
  highlightVisualBoxRegion: 'copy-ai-id:highlight-visual-box-region',
  inlineTextEditCommitted: 'copy-ai-id:inline-text-edit-committed',
} as const;

export type EditorMessageType = typeof EDITOR_MESSAGE_TYPES[keyof typeof EDITOR_MESSAGE_TYPES];

export type BridgeConnectionStatus = 'idle' | 'loading' | 'ready' | 'error';

export type IframeStatus = 'loading' | 'ready' | 'blocked' | 'error';

export type EditorKeyboardShortcut =
  | 'arrow-up'
  | 'arrow-down'
  | 'arrow-left'
  | 'arrow-right'
  | 'space'
  | 'shift-enter'
  | 'undo'
  | 'escape';

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
  elementRect?: BridgeViewportRect | null;
  viewport?: BridgeViewportSize;
}

export interface TargetReferenceRejectedMessage {
  type: typeof EDITOR_MESSAGE_TYPES.targetReferenceRejected;
  reason: 'missing-data-ai-id' | 'stale-fallback-target';
}

export interface RevealTreeNodeMessage {
  type: typeof EDITOR_MESSAGE_TYPES.revealTreeNode;
  nodeId: string;
}

export interface KeyboardShortcutMessage {
  type: typeof EDITOR_MESSAGE_TYPES.keyboardShortcut;
  shortcut: EditorKeyboardShortcut;
}

export interface ClearQuickActionSelectionMessage {
  type: typeof EDITOR_MESSAGE_TYPES.clearQuickActionSelection;
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
  intents: ElementIntent[];
  reason?: 'pinned' | 'repositioned' | 'hidden' | 'disconnected' | 'protected-target' | 'stale-target' | 'cleared';
}

export interface QuickActionCategorySelectedMessage extends EditorTargetReference {
  type: typeof EDITOR_MESSAGE_TYPES.quickActionCategorySelected;
  category: QuickActionCategory;
}

export interface QuickActionRequestGeometry {
  elementRect?: BridgeViewportRect | null;
  viewport?: BridgeViewportSize;
}

export interface QuickActionCategoryRequestedMessage extends EditorTargetReference, QuickActionRequestGeometry {
  type: typeof EDITOR_MESSAGE_TYPES.quickActionCategoryRequested;
  category: QuickActionCategory;
}

export interface QuickActionStructureRequestedMessage extends EditorTargetReference, QuickActionRequestGeometry {
  type: typeof EDITOR_MESSAGE_TYPES.quickActionStructureRequested;
  operation: QuickActionStructureOperation;
}

export interface QuickActionDragMovePreviewRequestedMessage extends EditorTargetReference, QuickActionRequestGeometry {
  type: typeof EDITOR_MESSAGE_TYPES.quickActionDragMovePreviewRequested;
  dropPoint: BridgeViewportPoint;
}

export interface QuickActionDragMoveRequestedMessage extends EditorTargetReference, QuickActionRequestGeometry {
  type: typeof EDITOR_MESSAGE_TYPES.quickActionDragMoveRequested;
  dropPoint: BridgeViewportPoint;
}

export interface QuickActionDragMoveClearRequestedMessage extends EditorTargetReference {
  type: typeof EDITOR_MESSAGE_TYPES.quickActionDragMoveClearRequested;
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
  appliedCount: number;
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
  afterStructure?: VisualStructureMutationSnapshot;
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
  afterStructure?: VisualStructureMutationSnapshot;
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

export interface PreviewVisualDragMoveMessage extends EditorTargetReference {
  type: typeof EDITOR_MESSAGE_TYPES.previewVisualDragMove;
  dropTarget?: EditorTarget;
  dropNodeId?: string | null;
  position?: VisualDropPosition;
  dropPoint?: BridgeViewportPoint;
}

export interface ClearVisualDragMovePreviewMessage {
  type: typeof EDITOR_MESSAGE_TYPES.clearVisualDragMovePreview;
}

export interface VisualDragMoveCompletedMessage extends VisualMutationResultBase {
  type: typeof EDITOR_MESSAGE_TYPES.visualDragMoveCompleted;
  kind: 'structure';
  operation: 'drag-move';
  dropTarget?: EditorTarget;
  dropNodeId?: string | null;
  position?: VisualDropPosition;
  structure?: VisualStructureMutationSnapshot;
  afterStructure?: VisualStructureMutationSnapshot;
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

// Emitted by the bridge when a preview inline text edit (dblclick
// contenteditable) is committed. The bridge reverts the element to
// previousValue before posting; the editor re-applies the edit through the
// regular updateVisualText mutation path so record/undo stay consistent.
export interface InlineTextEditCommittedMessage extends EditorTargetReference {
  type: typeof EDITOR_MESSAGE_TYPES.inlineTextEditCommitted;
  value: string;
  previousValue: string;
}

export type EditorToBridgeMessage =
  | RevealTreeNodeMessage
  | KeyboardShortcutMessage
  | ClearQuickActionSelectionMessage
  | SetHoverHighlightSuppressedMessage
  | SetCanvasZoomMessage
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
  | PreviewVisualDragMoveMessage
  | ClearVisualDragMovePreviewMessage
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
  | QuickActionCategoryRequestedMessage
  | QuickActionStructureRequestedMessage
  | QuickActionDragMovePreviewRequestedMessage
  | QuickActionDragMoveRequestedMessage
  | QuickActionDragMoveClearRequestedMessage
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
  | VisualMutationErrorMessage
  | InlineTextEditCommittedMessage;
