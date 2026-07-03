import {
  EDITOR_MESSAGE_TYPES,
  type BridgeToEditorMessage,
  type EditorToBridgeMessage,
} from './editor-bridge-messages';

const EDITOR_TO_BRIDGE_MESSAGE_TYPES: ReadonlySet<string> = new Set<string>([
  EDITOR_MESSAGE_TYPES.revealTreeNode,
  EDITOR_MESSAGE_TYPES.keyboardShortcut,
  EDITOR_MESSAGE_TYPES.clearQuickActionSelection,
  EDITOR_MESSAGE_TYPES.setHoverHighlightSuppressed,
  EDITOR_MESSAGE_TYPES.setCanvasZoom,
  EDITOR_MESSAGE_TYPES.quickActionCategorySelected,
  EDITOR_MESSAGE_TYPES.requestVisualTargetSnapshot,
  EDITOR_MESSAGE_TYPES.updateVisualStyle,
  EDITOR_MESSAGE_TYPES.updateVisualText,
  EDITOR_MESSAGE_TYPES.updateVisualRichText,
  EDITOR_MESSAGE_TYPES.updateVisualAttribute,
  EDITOR_MESSAGE_TYPES.updateVisualFormValue,
  EDITOR_MESSAGE_TYPES.duplicateVisualElement,
  EDITOR_MESSAGE_TYPES.moveVisualElement,
  EDITOR_MESSAGE_TYPES.deleteVisualElement,
  EDITOR_MESSAGE_TYPES.restoreVisualElement,
  EDITOR_MESSAGE_TYPES.previewVisualDragMove,
  EDITOR_MESSAGE_TYPES.clearVisualDragMovePreview,
  EDITOR_MESSAGE_TYPES.requestVisualDragMove,
  EDITOR_MESSAGE_TYPES.highlightVisualBoxRegion,
]);

const BRIDGE_TO_EDITOR_MESSAGE_TYPES: ReadonlySet<string> = new Set<string>([
  EDITOR_MESSAGE_TYPES.bridgeReady,
  EDITOR_MESSAGE_TYPES.layoutTree,
  EDITOR_MESSAGE_TYPES.targetHighlighted,
  EDITOR_MESSAGE_TYPES.targetReferenceRequested,
  EDITOR_MESSAGE_TYPES.targetReferenceRejected,
  EDITOR_MESSAGE_TYPES.keyboardShortcut,
  EDITOR_MESSAGE_TYPES.iframeStatus,
  EDITOR_MESSAGE_TYPES.quickActionAnchorChanged,
  EDITOR_MESSAGE_TYPES.quickActionCategoryRequested,
  EDITOR_MESSAGE_TYPES.quickActionStructureRequested,
  EDITOR_MESSAGE_TYPES.quickActionDragMovePreviewRequested,
  EDITOR_MESSAGE_TYPES.quickActionDragMoveRequested,
  EDITOR_MESSAGE_TYPES.quickActionDragMoveClearRequested,
  EDITOR_MESSAGE_TYPES.visualTargetSnapshot,
  EDITOR_MESSAGE_TYPES.visualStyleUpdated,
  EDITOR_MESSAGE_TYPES.visualTextUpdated,
  EDITOR_MESSAGE_TYPES.visualRichTextUpdated,
  EDITOR_MESSAGE_TYPES.visualAttributeUpdated,
  EDITOR_MESSAGE_TYPES.visualFormValueUpdated,
  EDITOR_MESSAGE_TYPES.visualElementDuplicated,
  EDITOR_MESSAGE_TYPES.visualElementMoved,
  EDITOR_MESSAGE_TYPES.visualElementDeleted,
  EDITOR_MESSAGE_TYPES.visualElementRestored,
  EDITOR_MESSAGE_TYPES.visualDragMoveCompleted,
  EDITOR_MESSAGE_TYPES.visualMutationError,
]);

/**
 * Shape-minimal runtime guards for the postMessage protocol: an object with
 * a `type` discriminant belonging to the direction's known set. Receivers
 * keep narrowing per-case via the discriminated unions; deep field
 * validation is intentionally not performed.
 */
export function isEditorToBridgeMessage(value: unknown): value is EditorToBridgeMessage {
  return hasMessageTypeIn(value, EDITOR_TO_BRIDGE_MESSAGE_TYPES);
}

export function isBridgeToEditorMessage(value: unknown): value is BridgeToEditorMessage {
  return hasMessageTypeIn(value, BRIDGE_TO_EDITOR_MESSAGE_TYPES);
}

function hasMessageTypeIn(value: unknown, types: ReadonlySet<string>): boolean {
  return typeof value === 'object'
    && value !== null
    && typeof (value as { type?: unknown }).type === 'string'
    && types.has((value as { type: string }).type);
}
