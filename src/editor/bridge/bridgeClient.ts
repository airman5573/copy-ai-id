import { type BridgeViewportRect } from '../../shared/domain/geometry';
import { type EditorTargetReference } from '../../shared/domain/targets';
import { type QuickActionCategory } from '../../shared/domain/visual';
import {
  type BridgeReadyMessage,
  type BridgeToEditorMessage,
  EDITOR_MESSAGE_TYPES,
  type EditorKeyboardShortcut,
  type EditorToBridgeMessage,
  type KeyboardShortcutMessage,
  type QuickActionAnchorChangedMessage,
  type RequestVisualTargetSnapshotMessage,
  type TargetHighlightedMessage,
  type TargetReferenceRejectedMessage,
  type TargetReferenceRequestedMessage,
  type VisualMutationErrorMessage,
  type VisualTargetSnapshotMessage,
} from '../../shared/protocol/editor-bridge-messages';
import { hasSameEditorTarget } from '../../shared/editor-targets';
import { isVisualTargetResolutionError } from '../../shared/visual-targets';
import {
  bridgeViewportRectToEditorViewportRect,
  getBridgeIframeElement,
  type EditorViewportRect,
  registerBridgeIframeElement,
} from './geometry';
import { useBridgeStore } from '../stores/useBridgeStore';
import { useBoxModelStore } from '../stores/useBoxModelStore';
import { useFloatingNotePanelStore } from '../stores/useFloatingNotePanelStore';
import { useFloatingVisualPanelStore } from '../stores/useFloatingVisualPanelStore';
import { useHighlightStore } from '../stores/useHighlightStore';
import { useLayoutTreeStore } from '../stores/useLayoutTreeStore';
import { getActiveCanvasZoom, useBreakpointStore } from '../stores/useBreakpointStore';
import { useVisualEditStore } from '../stores/useVisualEditStore';
import { useVisualSelectionStore, type VisualMutationResultMessage } from '../stores/useVisualSelectionStore';
import {
  quickActionCategoryToSectionId,
  useSectionJumpStore,
} from '../stores/useSectionJumpStore';
import {
  appendTargetReferenceToNotebook,
  handleEditorEscapeAction,
  handleEditorShortcutAction,
} from '../shortcut-actions';
import { useRuntimeStore } from '../stores/useRuntimeStore';
import {
  isNoteEditorHoverProtected,
  onNoteEditorHoverProtectionChange,
} from '../note-hover-guard';
import { suppressHoverUntilMouseMove } from '../keyboard-hover-guard';
import {
  showDeletedVisualTargetToast,
  showMissingDataAiIdToast,
  showStaleFallbackTargetToast,
  showStaleVisualTargetToast,
} from '../toast';
import {
  clearQuickActionDragMovePreview,
  dispatchQuickActionDragMoveFromBridgePoint,
  dispatchQuickActionStructureOperation,
  previewQuickActionDragMoveFromBridgePoint,
} from '../visual/structureActions';
import { createVisualEditRecordPatchForMutationResult } from '../visual/mutationResultPatch';
import {
  handleVisualUndoMutationResult,
  isVisualUndoMutationResult,
} from '../visual/visualUndo';

const PREVIEW_QUERY_PARAM = 'copy-ai-id-preview';

export { getBridgeIframeElement } from './geometry';

let pendingPostMutationSnapshotRefresh: EditorTargetReference | null = null;

export function createPreviewUrl(sourceUrl: string): string {
  try {
    const url = new URL(sourceUrl);
    url.searchParams.set(PREVIEW_QUERY_PARAM, '1');
    return url.href;
  } catch {
    return sourceUrl;
  }
}

export function registerPreviewFrame(frame: HTMLIFrameElement | null): void {
  registerBridgeIframeElement(frame);
}

export function postToBridge(message: EditorToBridgeMessage): void {
  getBridgeIframeElement()?.contentWindow?.postMessage(message, '*');
}

export function requestBridgeQuickActionSelectionClear(): void {
  postToBridge({ type: EDITOR_MESSAGE_TYPES.clearQuickActionSelection });
}

export function postCurrentCanvasZoomToBridge(): void {
  const breakpointState = useBreakpointStore.getState();

  postToBridge({
    type: EDITOR_MESSAGE_TYPES.setCanvasZoom,
    zoom: getActiveCanvasZoom(breakpointState),
    breakpointId: breakpointState.activeBreakpointId,
  });
}

export function syncVisualBridgeGeometry(): void {
  const selectionState = useVisualSelectionStore.getState();
  const hoverEditorRect = selectionState.hoverTarget?.elementRect
    ? bridgeViewportRectToEditorViewportRect(selectionState.hoverTarget.elementRect)
    : null;
  const activeToolbarEditorRect = selectionState.activeToolbarTarget?.elementRect
    ? bridgeViewportRectToEditorViewportRect(selectionState.activeToolbarTarget.elementRect)
    : null;
  const panelEditorRect = selectionState.panelTarget?.elementRect
    ? bridgeViewportRectToEditorViewportRect(selectionState.panelTarget.elementRect)
    : null;
  const selectionSnapshotEditorRect = selectionState.snapshot?.elementRect
    ? bridgeViewportRectToEditorViewportRect(selectionState.snapshot.elementRect)
    : null;

  selectionState.syncEditorRects({
    hoverEditorRect,
    activeToolbarEditorRect,
    panelEditorRect,
    snapshotEditorRect: selectionSnapshotEditorRect,
  });

}

export function requestVisualTargetSnapshot(
  reference: EditorTargetReference,
  options: Pick<RequestVisualTargetSnapshotMessage, 'includeComputedProperties'> = {},
): void {
  useVisualSelectionStore.getState().setSnapshotLoading(reference);

  postToBridge({
    type: EDITOR_MESSAGE_TYPES.requestVisualTargetSnapshot,
    target: reference.target,
    nodeId: reference.nodeId,
    includeComputedProperties: options.includeComputedProperties,
  });
}

export function selectQuickActionCategory(
  reference: EditorTargetReference,
  category: QuickActionCategory,
  options: {
    elementRect?: BridgeViewportRect | null;
    editorRect?: EditorViewportRect | null;
  } = {},
): void {
  const activeToolbarTarget = useVisualSelectionStore.getState().activeToolbarTarget;
  const isActiveToolbarTarget = Boolean(activeToolbarTarget)
    && hasSameEditorTarget(activeToolbarTarget?.target, reference.target)
    && activeToolbarTarget?.nodeId === reference.nodeId;

  const elementRect = options.elementRect
    ?? (isActiveToolbarTarget ? activeToolbarTarget?.elementRect ?? null : null);
  const editorRect = options.editorRect
    ?? (isActiveToolbarTarget ? activeToolbarTarget?.editorRect ?? null : null);

  useVisualSelectionStore.getState().openPanelForTarget({
    target: reference.target,
    nodeId: reference.nodeId,
    category,
    elementRect,
    editorRect,
  });

  const floatingNotePanel = useFloatingNotePanelStore.getState();
  if (floatingNotePanel.enabled && floatingNotePanel.isOpen) {
    floatingNotePanel.closePanel();
  }

  useFloatingVisualPanelStore.getState().openPanel();
  useSectionJumpStore.getState().queueSectionJump({
    target: reference.target,
    nodeId: reference.nodeId,
    category,
    sectionId: quickActionCategoryToSectionId(category),
  });

  postToBridge({
    type: EDITOR_MESSAGE_TYPES.quickActionCategorySelected,
    target: reference.target,
    nodeId: reference.nodeId,
    category,
  });
  requestVisualTargetSnapshot(reference);
}

export function installBridgeClient(): () => void {
  const cleanupHoverProtection = onNoteEditorHoverProtectionChange((protectedFromHover) => {
    postToBridge({
      type: EDITOR_MESSAGE_TYPES.setHoverHighlightSuppressed,
      suppressed: protectedFromHover,
    });
  });

  const handleMessage = (event: MessageEvent): void => {
    const previewFrame = getBridgeIframeElement();

    if (previewFrame?.contentWindow && event.source !== previewFrame.contentWindow) {
      return;
    }

    const message = event.data as (BridgeToEditorMessage & { source?: unknown }) | null;
    if (!message || message.source !== 'copy-ai-id-preview-bridge') {
      return;
    }

    routeBridgeMessage(message);
  };

  window.addEventListener('message', handleMessage);

  return () => {
    window.removeEventListener('message', handleMessage);
    cleanupHoverProtection();
  };
}

// Thin routing table: every multi-statement branch delegates to a named
// per-domain handler below. Ordering caveat: bridgeReady resets stores and
// must complete before the following layoutTree message populates the tree.
function routeBridgeMessage(message: BridgeToEditorMessage): void {
  switch (message.type) {
    case EDITOR_MESSAGE_TYPES.bridgeReady:
      handleBridgeReady(message);
      return;
    case EDITOR_MESSAGE_TYPES.layoutTree:
      useLayoutTreeStore.getState().setTree(message.root, message.url);
      flushPendingPostMutationSnapshotRefresh();
      return;
    case EDITOR_MESSAGE_TYPES.targetHighlighted:
      handleTargetHighlighted(message);
      return;
    case EDITOR_MESSAGE_TYPES.targetReferenceRequested:
      handleTargetReferenceRequested(message);
      return;
    case EDITOR_MESSAGE_TYPES.targetReferenceRejected:
      handleTargetReferenceRejected(message);
      return;
    case EDITOR_MESSAGE_TYPES.iframeStatus:
      useBridgeStore.getState().setIframeStatus(message.status, message.message);
      return;
    case EDITOR_MESSAGE_TYPES.quickActionAnchorChanged:
      handleQuickActionAnchorChanged(message);
      return;
    case EDITOR_MESSAGE_TYPES.quickActionCategoryRequested:
      selectQuickActionCategory({
        target: message.target,
        nodeId: message.nodeId,
      }, message.category, {
        elementRect: message.elementRect ?? null,
        editorRect: message.elementRect ? bridgeViewportRectToEditorViewportRect(message.elementRect) : null,
      });
      return;
    case EDITOR_MESSAGE_TYPES.quickActionStructureRequested:
      dispatchQuickActionStructureOperation({
        target: message.target,
        nodeId: message.nodeId,
      }, message.operation);
      return;
    case EDITOR_MESSAGE_TYPES.quickActionDragMovePreviewRequested:
      previewQuickActionDragMoveFromBridgePoint({
        target: message.target,
        nodeId: message.nodeId,
      }, message.dropPoint);
      return;
    case EDITOR_MESSAGE_TYPES.quickActionDragMoveRequested:
      dispatchQuickActionDragMoveFromBridgePoint({
        target: message.target,
        nodeId: message.nodeId,
      }, message.dropPoint);
      return;
    case EDITOR_MESSAGE_TYPES.quickActionDragMoveClearRequested:
      clearQuickActionDragMovePreview();
      return;
    case EDITOR_MESSAGE_TYPES.visualTargetSnapshot:
      handleVisualTargetSnapshot(message);
      return;
    case EDITOR_MESSAGE_TYPES.visualStyleUpdated:
    case EDITOR_MESSAGE_TYPES.visualTextUpdated:
    case EDITOR_MESSAGE_TYPES.visualRichTextUpdated:
    case EDITOR_MESSAGE_TYPES.visualAttributeUpdated:
    case EDITOR_MESSAGE_TYPES.visualFormValueUpdated:
    case EDITOR_MESSAGE_TYPES.visualElementDuplicated:
    case EDITOR_MESSAGE_TYPES.visualElementMoved:
    case EDITOR_MESSAGE_TYPES.visualElementDeleted:
    case EDITOR_MESSAGE_TYPES.visualElementRestored:
    case EDITOR_MESSAGE_TYPES.visualDragMoveCompleted:
      handleVisualMutationResultMessage(message as VisualMutationResultMessage);
      return;
    case EDITOR_MESSAGE_TYPES.visualMutationError:
      handleVisualMutationErrorMessage(message);
      return;
    case EDITOR_MESSAGE_TYPES.keyboardShortcut:
      handleKeyboardShortcut(message);
      return;
    default:
      return;
  }
}

function handleBridgeReady(message: BridgeReadyMessage): void {
  useVisualEditStore.getState().resetVisualEditStore();
  useVisualSelectionStore.getState().resetVisualSelectionStore();
  useFloatingVisualPanelStore.getState().resetFloatingVisualPanelStore();
  useSectionJumpStore.getState().resetSectionJumpStore();
  useBridgeStore.getState().markReady(message.url, message.aiIdCount);
  useRuntimeStore.getState().setPreviewUrl(message.url);
  postCurrentCanvasZoomToBridge();
  if (useBoxModelStore.getState().enabled) {
    postToBridge({ type: EDITOR_MESSAGE_TYPES.setBoxModelMode, enabled: true });
  }
  if (isNoteEditorHoverProtected()) {
    postToBridge({ type: EDITOR_MESSAGE_TYPES.setHoverHighlightSuppressed, suppressed: true });
  }
}

function handleTargetHighlighted(message: TargetHighlightedMessage): void {
  if (isNoteEditorHoverProtected()) {
    return;
  }

  useHighlightStore.getState().setHighlightedTarget(message.target, message.nodeId, message.origin ?? 'preview');
  useVisualSelectionStore.getState().setHoverTarget(
    message,
    message.elementRect ? bridgeViewportRectToEditorViewportRect(message.elementRect) : null,
  );
}

function handleTargetReferenceRequested(message: TargetReferenceRequestedMessage): void {
  appendTargetReferenceToNotebook({
    target: message.target,
    nodeId: message.nodeId,
  }, {
    elementRect: message.elementRect ?? null,
    viewport: message.viewport ?? null,
    onFloatingNotePanelOpen: requestBridgeQuickActionSelectionClear,
  });
}

function handleTargetReferenceRejected(message: TargetReferenceRejectedMessage): void {
  if (message.reason === 'missing-data-ai-id') {
    showMissingDataAiIdToast();
  } else if (message.reason === 'stale-fallback-target') {
    showStaleFallbackTargetToast();
  }
}

function handleQuickActionAnchorChanged(message: QuickActionAnchorChangedMessage): void {
  if (isNoteEditorHoverProtected()) {
    return;
  }

  useVisualSelectionStore.getState().setQuickActionAnchor(
    message,
    message.elementRect ? bridgeViewportRectToEditorViewportRect(message.elementRect) : null,
  );
}

function handleVisualTargetSnapshot(message: VisualTargetSnapshotMessage): void {
  useVisualSelectionStore.getState().setSnapshotResult(
    message,
    message.snapshot ? bridgeViewportRectToEditorViewportRect(message.snapshot.elementRect) : null,
  );
  if (isVisualTargetResolutionError(message.error)) {
    showStaleVisualTargetToast(message.error);
  }
}

function handleVisualMutationResultMessage(message: VisualMutationResultMessage): void {
  useVisualSelectionStore.getState().applyMutationResult(
    message,
    message.snapshot ? bridgeViewportRectToEditorViewportRect(message.snapshot.elementRect) : null,
  );
  if (message.error) {
    if (!isVisualUndoMutationResult(message.mutationId)) {
      useVisualEditStore.getState().markMutationFailed(message.mutationId, message.error);
    } else {
      handleVisualUndoMutationResult(message);
    }
    if (isVisualTargetResolutionError(message.error)) {
      showStaleVisualTargetToast(message.error);
    }
  } else if (message.applied) {
    const handledVisualUndo = handleVisualUndoMutationResult(message);
    if (!handledVisualUndo) {
      useVisualEditStore.getState().markMutationApplied(
        message.mutationId,
        createVisualEditRecordPatchForMutationResult(message),
      );
    }
    if (!handledVisualUndo && message.kind === 'structure' && message.operation === 'delete') {
      useFloatingVisualPanelStore.getState().closePanel();
      showDeletedVisualTargetToast();
    }
    queuePostMutationSnapshotRefresh(message);
  }
}

function handleVisualMutationErrorMessage(message: VisualMutationErrorMessage): void {
  useVisualSelectionStore.getState().setMutationError(message);
  if (message.mutationId !== undefined) {
    useVisualEditStore.getState().markMutationFailed(message.mutationId, message.error);
  }
  if (isVisualTargetResolutionError(message.error)) {
    showStaleVisualTargetToast(message.error);
  }
}

function handleKeyboardShortcut(message: KeyboardShortcutMessage): void {
  if (isArrowShortcut(message.shortcut)) {
    suppressHoverUntilMouseMove();
  }

  if (message.shortcut === 'escape') {
    const result = handleEditorEscapeAction();
    if (result !== 'visual-panel') {
      postToBridge({ type: EDITOR_MESSAGE_TYPES.keyboardShortcut, shortcut: 'escape' });
    }
    return;
  }

  handleEditorShortcutAction(message.shortcut, {
    onFloatingNotePanelOpen: requestBridgeQuickActionSelectionClear,
    postToBridge,
  });
}

function isArrowShortcut(shortcut: EditorKeyboardShortcut): boolean {
  return shortcut === 'arrow-up'
    || shortcut === 'arrow-down'
    || shortcut === 'arrow-left'
    || shortcut === 'arrow-right';
}

function queuePostMutationSnapshotRefresh(message: VisualMutationResultMessage): void {
  if (!message.snapshot) {
    return;
  }

  const selectionState = useVisualSelectionStore.getState();
  if (!selectionState.panelTarget && !selectionState.snapshotTarget) {
    return;
  }

  pendingPostMutationSnapshotRefresh = {
    target: message.target,
    nodeId: message.nodeId,
  };
}

function flushPendingPostMutationSnapshotRefresh(): void {
  const pending = pendingPostMutationSnapshotRefresh;
  if (!pending) {
    return;
  }

  pendingPostMutationSnapshotRefresh = null;
  requestVisualTargetSnapshot(pending);
}
