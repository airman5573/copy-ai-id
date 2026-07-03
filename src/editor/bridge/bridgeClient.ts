import { type EditorTargetReference } from '../../shared/domain/targets';
import {
  type BridgeReadyMessage,
  type BridgeToEditorMessage,
  type ChipBadgeClickedMessage,
  EDITOR_MESSAGE_TYPES,
  type EditorKeyboardShortcut,
  type EditorToBridgeMessage,
  type InlineTextEditCommittedMessage,
  type KeyboardShortcutMessage,
  type QuickActionAnchorChangedMessage,
  type RequestVisualTargetSnapshotMessage,
  type TargetHighlightedMessage,
  type TargetReferenceRejectedMessage,
  type TargetReferenceRequestedMessage,
  type VisualMutationErrorMessage,
  type VisualTargetSnapshotMessage,
} from '../../shared/protocol/editor-bridge-messages';
import { isBridgeToEditorMessage } from '../../shared/protocol/guards';
import { hasSameEditorTarget, targetIdentityKey } from '../../shared/editor-targets';
import { isVisualTargetResolutionError } from '../../shared/visual-targets';
import {
  bridgeViewportRectToEditorViewportRect,
  getBridgeIframeElement,
  type EditorViewportRect,
  registerBridgeIframeElement,
} from './geometry';
import { useBridgeStore } from '../stores/useBridgeStore';
import { useFloatingVisualPanelStore } from '../stores/useFloatingVisualPanelStore';
import { useHighlightStore } from '../stores/useHighlightStore';
import { getActiveCanvasZoom, useBreakpointStore } from '../stores/useBreakpointStore';
import { useVisualEditStore } from '../stores/useVisualEditStore';
import { useVisualSelectionStore, type VisualMutationResultMessage } from '../stores/useVisualSelectionStore';
import {
  appendTargetReferenceToNotebook,
  focusNotebookChipFromBadge,
  handleEditorEscapeAction,
  handleEditorShortcutAction,
} from '../shortcut-actions';
import { type ExportedChipTarget } from '../notebook/lexical/chip-export';
import { getNotebookChipIndex } from '../notebook/lexical/chip-ids';
import { useNotebookStore } from '../stores/useNotebookStore';
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
import { createVisualEditRecordPatchForMutationResult } from '../visual/mutationResultPatch';
import { dispatchVisualTextMutation } from '../visual/visualMutationClient';
import {
  handleVisualUndoMutationResult,
  isVisualUndoMutationResult,
} from '../visual/visualUndo';

const PREVIEW_QUERY_PARAM = 'copy-ai-id-preview';

export { getBridgeIframeElement } from './geometry';

let pendingPostMutationSnapshotRefresh: EditorTargetReference | null = null;
let lastPushedChipBadgesKey: string | null = null;

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

// Hides the quick toolbar when a notebook chip append/focus takes over,
// keeping the pinned selection (element pin + selection overlay) alive.
// The store write is synchronous on purpose: a round-trip through the bridge
// would race the note-panel focus, whose hover protection swallows inbound
// quickActionAnchorChanged messages. The bridge message only suppresses
// later anchor re-syncs so the toolbar stays hidden until the next click pin.
export function hideQuickActionToolbar(): void {
  useVisualSelectionStore.getState().hideQuickActionToolbar();
  postToBridge({ type: EDITOR_MESSAGE_TYPES.hideQuickActionToolbar });
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

// Mirrors the current chip set into preview chip badges. The chip export
// produces a new array on every Lexical change, so pushes are deduped by a
// content key; bridgeReady forces a re-push because the reloaded preview
// starts badge-less.
export function postChipBadgesToBridge(options: { force?: boolean } = {}): void {
  const chips = useNotebookStore.getState().activeChipTargets;
  const syncKey = chipBadgesSyncKey(chips);
  if (!options.force && syncKey === lastPushedChipBadgesKey) {
    return;
  }

  lastPushedChipBadgesKey = syncKey;
  postToBridge({
    type: EDITOR_MESSAGE_TYPES.setChipBadges,
    badges: chips.map((chip) => ({
      chipId: chip.chipId,
      label: String(getNotebookChipIndex(chip.chipId) ?? chip.chipId),
      target: chip.target,
      nodeId: chip.nodeId,
    })),
  });
}

function chipBadgesSyncKey(chips: readonly ExportedChipTarget[]): string {
  return chips
    .map((chip) => `${chip.chipId}:${targetIdentityKey(chip.target)}:${chip.nodeId ?? ''}`)
    .join('|');
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

export function installBridgeClient(): () => void {
  const cleanupHoverProtection = onNoteEditorHoverProtectionChange((protectedFromHover) => {
    postToBridge({
      type: EDITOR_MESSAGE_TYPES.setHoverHighlightSuppressed,
      suppressed: protectedFromHover,
    });
  });

  const unsubscribeChipBadges = useNotebookStore.subscribe((state, previousState) => {
    if (state.activeChipTargets !== previousState.activeChipTargets) {
      postChipBadgesToBridge();
    }
  });

  const handleMessage = (event: MessageEvent): void => {
    const previewFrame = getBridgeIframeElement();

    if (previewFrame?.contentWindow && event.source !== previewFrame.contentWindow) {
      return;
    }

    const data: unknown = event.data;
    if (
      typeof data !== 'object'
      || data === null
      || (data as { source?: unknown }).source !== 'copy-ai-id-preview-bridge'
    ) {
      return;
    }

    if (!isBridgeToEditorMessage(data)) {
      console.warn('[Copy AI ID] Dropped unknown bridge message.', (data as { type?: unknown }).type);
      return;
    }

    routeBridgeMessage(data);
  };

  window.addEventListener('message', handleMessage);

  return () => {
    window.removeEventListener('message', handleMessage);
    cleanupHoverProtection();
    unsubscribeChipBadges();
  };
}

// Thin routing table: every multi-statement branch delegates to a named
// per-domain handler below.
function routeBridgeMessage(message: BridgeToEditorMessage): void {
  switch (message.type) {
    case EDITOR_MESSAGE_TYPES.bridgeReady:
      handleBridgeReady(message);
      return;
    // The bridge posts layoutTree after every registry rebuild; it doubles as
    // the "mutation settled" signal for pending snapshot refreshes.
    case EDITOR_MESSAGE_TYPES.layoutTree:
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
    case EDITOR_MESSAGE_TYPES.inlineTextEditCommitted:
      handleInlineTextEditCommitted(message);
      return;
    case EDITOR_MESSAGE_TYPES.keyboardShortcut:
      handleKeyboardShortcut(message);
      return;
    case EDITOR_MESSAGE_TYPES.chipBadgeClicked:
      handleChipBadgeClicked(message);
      return;
    default:
      return;
  }
}

function handleBridgeReady(message: BridgeReadyMessage): void {
  useVisualEditStore.getState().resetVisualEditStore();
  useVisualSelectionStore.getState().resetVisualSelectionStore();
  useFloatingVisualPanelStore.getState().resetFloatingVisualPanelStore();
  useBridgeStore.getState().markReady(message.url, message.aiIdCount);
  useRuntimeStore.getState().setPreviewUrl(message.url);
  postCurrentCanvasZoomToBridge();
  postChipBadgesToBridge({ force: true });
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
    hideQuickActionToolbar,
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

  closeFloatingVisualPanelForNewPinnedTarget(message);

  useVisualSelectionStore.getState().setQuickActionAnchor(
    message,
    message.elementRect ? bridgeViewportRectToEditorViewportRect(message.elementRect) : null,
  );

  // The pinned quick toolbar renders its controls straight from the target
  // snapshot, so request it immediately on pin. Repositioned anchors only
  // update geometry and must not re-request.
  if (message.reason === 'pinned' && message.target) {
    requestVisualTargetSnapshot({
      target: message.target,
      nodeId: message.nodeId,
    });
  }
}

// The floating visual panel follows the pinned selection: pinning a different
// element closes it. Only click-pins count — 'repositioned' anchors, clearing
// reasons, and same-element re-pins (bridge refreshes after mutations/tree
// rebuilds also arrive as 'pinned') leave it open.
function closeFloatingVisualPanelForNewPinnedTarget(message: QuickActionAnchorChangedMessage): void {
  if (message.reason !== 'pinned' || !message.target) {
    return;
  }

  if (!useFloatingVisualPanelStore.getState().isOpen) {
    return;
  }

  const panelTarget = useVisualSelectionStore.getState().panelTarget;
  if (!panelTarget) {
    return;
  }

  const samePanelTarget = (panelTarget.nodeId && message.nodeId && panelTarget.nodeId === message.nodeId)
    || hasSameEditorTarget(panelTarget.target, message.target);
  if (samePanelTarget) {
    return;
  }

  useFloatingVisualPanelStore.getState().closePanel();
  useVisualSelectionStore.getState().closePanel();
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

// The bridge reverted the element to previousValue before posting; re-apply
// through the regular text mutation path so the record/undo pipeline stays
// the single source of truth.
function handleInlineTextEditCommitted(message: InlineTextEditCommittedMessage): void {
  try {
    dispatchVisualTextMutation({
      reference: {
        target: message.target,
        nodeId: message.nodeId,
      },
      text: {
        value: message.value,
        previousValue: message.previousValue,
      },
      source: 'inline-text-edit',
      category: 'content',
    });
  } catch (error) {
    console.warn('[Copy AI ID] Failed to record inline text edit.', error);
  }
}

function handleChipBadgeClicked(message: ChipBadgeClickedMessage): void {
  focusNotebookChipFromBadge(message.chipId, {
    elementRect: message.elementRect ?? null,
    viewport: message.viewport ?? null,
    hideQuickActionToolbar,
  });
}

function handleKeyboardShortcut(message: KeyboardShortcutMessage): void {
  if (isArrowShortcut(message.shortcut)) {
    suppressHoverUntilMouseMove();
  }

  if (message.shortcut === 'escape') {
    const result = handleEditorEscapeAction();
    if (result !== 'quick-toolbar-popover' && result !== 'visual-panel') {
      postToBridge({ type: EDITOR_MESSAGE_TYPES.keyboardShortcut, shortcut: 'escape' });
    }
    return;
  }

  handleEditorShortcutAction(message.shortcut, {
    hideQuickActionToolbar,
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
