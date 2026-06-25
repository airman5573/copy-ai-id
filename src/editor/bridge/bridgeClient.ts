import {
  EDITOR_MESSAGE_TYPES,
  type BridgeToEditorMessage,
  type BridgeViewportRect,
  type EditorToBridgeMessage,
  type EditorKeyboardShortcut,
  type EditorTargetReference,
  type QuickActionCategory,
  type RequestVisualTargetSnapshotMessage,
} from '../../shared/editor-messages';
import { hasSameEditorTarget } from '../../shared/editor-targets';
import {
  createVisualEditTargetDescriptor,
  isVisualTargetResolutionError,
} from '../../shared/visual-targets';
import type { VisualEditRecord } from '../../shared/visual-edits';
import {
  bridgeViewportRectToEditorViewportRect,
  getBridgeIframeElement,
  type EditorViewportRect,
  registerBridgeIframeElement,
} from './geometry';
import { useBridgeStore } from '../stores/useBridgeStore';
import { useBoxModelStore } from '../stores/useBoxModelStore';
import { useFloatingVisualPanelStore } from '../stores/useFloatingVisualPanelStore';
import { useHighlightStore } from '../stores/useHighlightStore';
import { useLayoutTreeStore } from '../stores/useLayoutTreeStore';
import { getActiveCanvasZoom, useBreakpointStore } from '../stores/useBreakpointStore';
import { useVisualBridgeStore, type VisualMutationResultMessage } from '../stores/useVisualBridgeStore';
import { useVisualEditStore } from '../stores/useVisualEditStore';
import { useVisualSelectionStore } from '../stores/useVisualSelectionStore';
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
  const visualState = useVisualBridgeStore.getState();
  const selectionState = useVisualSelectionStore.getState();
  const quickActionAnchorEditorRect = visualState.quickActionAnchor?.elementRect
    ? bridgeViewportRectToEditorViewportRect(visualState.quickActionAnchor.elementRect)
    : null;
  const targetSnapshotEditorRect = visualState.targetSnapshot?.snapshot?.elementRect
    ? bridgeViewportRectToEditorViewportRect(visualState.targetSnapshot.snapshot.elementRect)
    : null;
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

  visualState.syncEditorRects({
    quickActionAnchorEditorRect,
    targetSnapshotEditorRect,
  });

  selectionState.syncEditorRects({
    hoverEditorRect,
    activeToolbarEditorRect,
    panelEditorRect,
    snapshotEditorRect: selectionSnapshotEditorRect,
  });

  if (selectionState.panelTarget && useFloatingVisualPanelStore.getState().isOpen) {
    useFloatingVisualPanelStore.getState().updateAnchorRects({
      elementRect: selectionState.panelTarget.elementRect,
      editorRect: panelEditorRect,
    });
  }
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

  useVisualBridgeStore.getState().setQuickActionCategorySelection({
    target: reference.target,
    nodeId: reference.nodeId,
    category,
  });
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
  useFloatingVisualPanelStore.getState().openForTarget({
    target: reference.target,
    nodeId: reference.nodeId,
    category,
    elementRect,
    editorRect,
  });
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

function routeBridgeMessage(message: BridgeToEditorMessage): void {
  switch (message.type) {
    case EDITOR_MESSAGE_TYPES.bridgeReady:
      useVisualBridgeStore.getState().resetVisualBridgeState();
      useVisualEditStore.getState().resetVisualEditStore();
      useVisualSelectionStore.getState().resetVisualSelectionState();
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
      return;
    case EDITOR_MESSAGE_TYPES.layoutTree:
      useLayoutTreeStore.getState().setTree(message.root, message.url);
      useVisualBridgeStore.getState().markLayoutTreeRefreshed();
      flushPendingPostMutationSnapshotRefresh();
      return;
    case EDITOR_MESSAGE_TYPES.targetHighlighted:
      if (isNoteEditorHoverProtected()) {
        return;
      }

      useHighlightStore.getState().setHighlightedTarget(message.target, message.nodeId, message.origin ?? 'preview');
      useVisualSelectionStore.getState().setHoverTarget(
        message,
        message.elementRect ? bridgeViewportRectToEditorViewportRect(message.elementRect) : null,
      );
      return;
    case EDITOR_MESSAGE_TYPES.targetReferenceRequested:
      appendTargetReferenceToNotebook({
        target: message.target,
        nodeId: message.nodeId,
      }, {
        elementRect: message.elementRect ?? null,
        viewport: message.viewport ?? null,
        onFloatingNotePanelOpen: requestBridgeQuickActionSelectionClear,
      });
      return;
    case EDITOR_MESSAGE_TYPES.targetReferenceRejected:
      if (message.reason === 'missing-data-ai-id') {
        showMissingDataAiIdToast();
      } else if (message.reason === 'stale-fallback-target') {
        showStaleFallbackTargetToast();
      }
      return;
    case EDITOR_MESSAGE_TYPES.iframeStatus:
      useBridgeStore.getState().setIframeStatus(message.status, message.message);
      return;
    case EDITOR_MESSAGE_TYPES.quickActionAnchorChanged:
      if (isNoteEditorHoverProtected()) {
        return;
      }

      useVisualBridgeStore.getState().setQuickActionAnchor(
        message,
        message.elementRect ? bridgeViewportRectToEditorViewportRect(message.elementRect) : null,
      );
      useVisualSelectionStore.getState().setQuickActionAnchor(
        message,
        message.elementRect ? bridgeViewportRectToEditorViewportRect(message.elementRect) : null,
      );
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
      useVisualBridgeStore.getState().setVisualTargetSnapshot(
        message,
        message.snapshot ? bridgeViewportRectToEditorViewportRect(message.snapshot.elementRect) : null,
      );
      useVisualSelectionStore.getState().setSnapshotResult(
        message,
        message.snapshot ? bridgeViewportRectToEditorViewportRect(message.snapshot.elementRect) : null,
      );
      if (isVisualTargetResolutionError(message.error)) {
        showStaleVisualTargetToast(message.error);
      }
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
      useVisualBridgeStore.getState().setVisualMutationResult(
        message as VisualMutationResultMessage,
        message.snapshot ? bridgeViewportRectToEditorViewportRect(message.snapshot.elementRect) : null,
      );
      useVisualSelectionStore.getState().applyMutationResult(
        message as VisualMutationResultMessage,
        message.snapshot ? bridgeViewportRectToEditorViewportRect(message.snapshot.elementRect) : null,
      );
      if (message.error) {
        useVisualEditStore.getState().markMutationFailed(message.mutationId, message.error);
        if (isVisualTargetResolutionError(message.error)) {
          showStaleVisualTargetToast(message.error);
        }
      } else if (message.applied) {
        useVisualEditStore.getState().markMutationApplied(
          message.mutationId,
          createVisualEditRecordPatchForMutationResult(message as VisualMutationResultMessage),
        );
        if (message.kind === 'structure' && message.operation === 'delete') {
          useFloatingVisualPanelStore.getState().closePanel();
          showDeletedVisualTargetToast();
        }
        queuePostMutationSnapshotRefresh(message as VisualMutationResultMessage);
      }
      return;
    case EDITOR_MESSAGE_TYPES.visualMutationError:
      useVisualBridgeStore.getState().setVisualMutationError(message);
      useVisualSelectionStore.getState().setMutationError(message);
      if (message.mutationId !== undefined) {
        useVisualEditStore.getState().markMutationFailed(message.mutationId, message.error);
      }
      if (isVisualTargetResolutionError(message.error)) {
        showStaleVisualTargetToast(message.error);
      }
      return;
    case EDITOR_MESSAGE_TYPES.keyboardShortcut:
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
      });
      return;
    default:
      return;
  }
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

function createVisualEditRecordPatchForMutationResult(
  message: VisualMutationResultMessage,
): Partial<VisualEditRecord> | undefined {
  if (message.kind !== 'structure' || !message.structure) {
    return undefined;
  }

  if (
    message.operation !== 'delete'
    && message.operation !== 'restore'
    && message.operation !== 'duplicate'
    && message.operation !== 'move-up'
    && message.operation !== 'move-down'
    && message.operation !== 'drag-move'
  ) {
    return undefined;
  }

  const visualEditState = useVisualEditStore.getState();
  const pending = visualEditState.pendingMutations[message.mutationId];
  const record = pending
    ? visualEditState.records.find((candidate) => candidate.id === pending.recordId)
    : null;

  if (!record || record.kind !== 'structure' || record.payload.kind !== 'structure') {
    return undefined;
  }

  const structureRecord = record as VisualEditRecord<'structure'>;
  const currentStructure = structureRecord.payload.structure;
  const before = structureBeforeForMutationResult(message, structureRecord);
  const after = structureAfterForMutationResult(message);
  const duplicatedTarget = message.operation === 'duplicate' && message.duplicateTarget
    ? createVisualEditTargetDescriptor(message.duplicateTarget, { nodeId: message.duplicateNodeId ?? null })
    : currentStructure.duplicatedTarget;
  const dropTarget = message.operation === 'drag-move' && message.dropTarget
    ? createVisualEditTargetDescriptor(message.dropTarget, { nodeId: message.dropNodeId ?? null })
    : currentStructure.dropTarget;

  return {
    payload: {
      kind: 'structure',
      structure: {
        ...currentStructure,
        operation: message.operation,
        before,
        after,
        movedDirection: message.operation === 'move-up'
          ? 'up'
          : message.operation === 'move-down'
            ? 'down'
            : currentStructure.movedDirection,
        dropPosition: message.operation === 'drag-move'
          ? message.position ?? currentStructure.dropPosition
          : currentStructure.dropPosition,
        dropTarget,
        duplicatedTarget,
      },
    },
    before: {
      kind: 'structure',
      structure: { structure: before },
    },
    after: {
      kind: 'structure',
      structure: { structure: after },
    },
  } as Partial<VisualEditRecord>;
}

function structureBeforeForMutationResult(
  message: VisualMutationResultMessage,
  record: VisualEditRecord<'structure'>,
) {
  if (
    message.kind === 'structure'
    && (
      message.operation === 'delete'
      || message.operation === 'duplicate'
      || message.operation === 'move-up'
      || message.operation === 'move-down'
      || message.operation === 'drag-move'
    )
  ) {
    return message.structure ?? null;
  }

  return record.payload.structure.before ?? record.before.structure.structure ?? null;
}

function structureAfterForMutationResult(
  message: VisualMutationResultMessage,
) {
  if (message.kind !== 'structure') {
    return null;
  }

  switch (message.operation) {
    case 'delete':
      return null;
    case 'restore':
      return message.structure ?? null;
    case 'duplicate':
    case 'move-up':
    case 'move-down':
    case 'drag-move':
      return message.afterStructure ?? null;
    default:
      return null;
  }
}
