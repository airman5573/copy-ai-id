import { create } from 'zustand';

import {
  type BridgeToEditorMessage,
  type BridgeViewportRect,
  type BridgeViewportSize,
  type EditorTarget,
  type EditorTargetReference,
  type HighlightOrigin,
  type QuickActionAnchorChangedMessage,
  type QuickActionCategory,
  type TargetHighlightedMessage,
  type VisualMutationError,
  type VisualMutationErrorCode,
  type VisualMutationErrorMessage,
  type VisualTargetSnapshot,
  type VisualTargetSnapshotMessage,
} from '../../shared/editor-messages';
import { hasSameEditorTarget } from '../../shared/editor-targets';
import { getCurrentMessages } from '../../shared/i18n';
import { isVisualTargetResolutionError } from '../../shared/visual-targets';
import type { EditorViewportRect } from '../bridge/geometry';

export type VisualSnapshotStatus = 'idle' | 'loading' | 'ready' | 'error' | 'stale';

export type VisualSelectionStaleReason =
  | 'bridge-reset'
  | 'cleared'
  | 'disconnected'
  | 'hidden'
  | 'protected-target'
  | 'stale-target'
  | 'snapshot-error'
  | 'mutation-error'
  | 'deleted';

export type VisualMutationResultMessage = Extract<BridgeToEditorMessage, {
  applied: boolean;
  mutationId: number;
}>;

export interface VisualHoverTargetState {
  target: EditorTarget | null;
  nodeId: string | null;
  origin: HighlightOrigin;
  elementRect: BridgeViewportRect | null;
  editorRect: EditorViewportRect | null;
  viewport: BridgeViewportSize | null;
  updatedAt: number;
}

export interface VisualToolbarTargetState extends EditorTargetReference {
  elementRect: BridgeViewportRect;
  editorRect: EditorViewportRect | null;
  viewport: BridgeViewportSize;
  availableCategories: QuickActionCategory[];
  reason: QuickActionAnchorChangedMessage['reason'];
  updatedAt: number;
}

export interface VisualPanelTargetState extends EditorTargetReference {
  category: QuickActionCategory | null;
  elementRect: BridgeViewportRect | null;
  editorRect: EditorViewportRect | null;
  openedAt: number;
  updatedAt: number;
}

interface VisualPanelTargetInput extends EditorTargetReference {
  category?: QuickActionCategory | null;
  elementRect?: BridgeViewportRect | null;
  editorRect?: EditorViewportRect | null;
}

/**
 * Single owner of visual-selection data: hover/toolbar/panel targets with
 * their geometry, and the target-snapshot lifecycle. The floating visual
 * panel reads its target/category from `panelTarget` here and only keeps
 * open/close state in useFloatingVisualPanelStore; highlight identity for
 * tree/keyboard/notebook lives in useHighlightStore.
 */
export interface VisualSelectionStateSnapshot {
  hoverTarget: VisualHoverTargetState | null;
  activeToolbarTarget: VisualToolbarTargetState | null;
  quickActionDismissedAt: number | null;
  panelTarget: VisualPanelTargetState | null;
  snapshotStatus: VisualSnapshotStatus;
  snapshotTarget: EditorTargetReference | null;
  snapshot: VisualTargetSnapshot | null;
  snapshotEditorRect: EditorViewportRect | null;
  snapshotError: VisualMutationError | null;
  snapshotRequestedAt: number | null;
  snapshotReceivedAt: number | null;
  staleReason: VisualSelectionStaleReason | null;
}

interface VisualSelectionStore extends VisualSelectionStateSnapshot {
  setHoverTarget(message: TargetHighlightedMessage, editorRect?: EditorViewportRect | null): void;
  setQuickActionAnchor(message: QuickActionAnchorChangedMessage, editorRect?: EditorViewportRect | null): void;
  clearQuickActionTargets(): void;
  clearQuickActionSelection(): void;
  openPanelForTarget(input: VisualPanelTargetInput): void;
  closePanel(): void;
  setSnapshotLoading(reference: EditorTargetReference): void;
  setSnapshotResult(message: VisualTargetSnapshotMessage, editorRect?: EditorViewportRect | null): void;
  applyMutationResult(message: VisualMutationResultMessage, editorRect?: EditorViewportRect | null): void;
  setMutationError(message: VisualMutationErrorMessage): void;
  syncEditorRects(rects: {
    hoverEditorRect?: EditorViewportRect | null;
    activeToolbarEditorRect?: EditorViewportRect | null;
    panelEditorRect?: EditorViewportRect | null;
    snapshotEditorRect?: EditorViewportRect | null;
  }): void;
  markStale(reason: VisualSelectionStaleReason, error?: VisualMutationError | null): void;
  resetVisualSelectionState(): void;
}

export type VisualPanelReadinessStatus =
  | 'empty'
  | 'loading'
  | 'ready'
  | 'error'
  | 'stale'
  | 'waiting';

export type VisualPanelReadinessTone = 'neutral' | 'info' | 'success' | 'warning' | 'error';

export interface VisualPanelReadinessSummary {
  status: VisualPanelReadinessStatus;
  tone: VisualPanelReadinessTone;
  title: string;
  message: string;
  errorCode: VisualMutationErrorCode | null;
  staleReason: VisualSelectionStaleReason | null;
  canShowControls: boolean;
  needsReselect: boolean;
}

const initialVisualSelectionState: VisualSelectionStateSnapshot = {
  hoverTarget: null,
  activeToolbarTarget: null,
  quickActionDismissedAt: null,
  panelTarget: null,
  snapshotStatus: 'idle',
  snapshotTarget: null,
  snapshot: null,
  snapshotEditorRect: null,
  snapshotError: null,
  snapshotRequestedAt: null,
  snapshotReceivedAt: null,
  staleReason: null,
};

export const useVisualSelectionStore = create<VisualSelectionStore>((set) => ({
  ...initialVisualSelectionState,
  setHoverTarget: (message, editorRect = null) => set({
    hoverTarget: message.target ? {
      target: message.target,
      nodeId: message.nodeId,
      origin: message.origin ?? 'preview',
      elementRect: message.elementRect ?? null,
      editorRect,
      viewport: message.viewport ?? null,
      updatedAt: Date.now(),
    } : null,
    quickActionDismissedAt: null,
  }),
  setQuickActionAnchor: (message, editorRect = null) => set((state) => {
    if (!message.target || !message.elementRect || isClearingQuickActionReason(message.reason)) {
      return {
        activeToolbarTarget: null,
        staleReason: staleReasonForQuickActionReason(message.reason, state.staleReason),
      };
    }

    return {
      activeToolbarTarget: {
        target: message.target,
        nodeId: message.nodeId,
        elementRect: message.elementRect,
        editorRect,
        viewport: message.viewport,
        availableCategories: message.availableCategories,
        reason: message.reason,
        updatedAt: Date.now(),
      },
      quickActionDismissedAt: null,
      staleReason: null,
    };
  }),
  clearQuickActionTargets: () => set({
    hoverTarget: null,
    activeToolbarTarget: null,
    quickActionDismissedAt: Date.now(),
    staleReason: 'cleared',
  }),
  clearQuickActionSelection: () => set({
    activeToolbarTarget: null,
    quickActionDismissedAt: Date.now(),
    staleReason: 'cleared',
  }),
  openPanelForTarget: (input) => set((state) => {
    const now = Date.now();
    const existingPanelTarget = state.panelTarget;
    const samePanelTarget = hasSameEditorTarget(existingPanelTarget?.target, input.target)
      && existingPanelTarget?.nodeId === input.nodeId;
    const snapshotMatches = state.snapshotTarget
      ? hasSameEditorTarget(state.snapshotTarget.target, input.target)
        && state.snapshotTarget.nodeId === input.nodeId
      : false;
    const keepSnapshot = snapshotMatches && Boolean(state.snapshot);

    return {
      panelTarget: {
        target: input.target,
        nodeId: input.nodeId,
        category: input.category ?? existingPanelTarget?.category ?? null,
        elementRect: input.elementRect ?? existingPanelTarget?.elementRect ?? null,
        editorRect: input.editorRect ?? existingPanelTarget?.editorRect ?? null,
        openedAt: samePanelTarget ? existingPanelTarget.openedAt : now,
        updatedAt: now,
      },
      snapshotStatus: keepSnapshot ? 'ready' : 'idle',
      snapshotTarget: keepSnapshot ? state.snapshotTarget : { target: input.target, nodeId: input.nodeId },
      snapshot: keepSnapshot ? state.snapshot : null,
      snapshotEditorRect: keepSnapshot ? state.snapshotEditorRect : null,
      snapshotError: keepSnapshot ? state.snapshotError : null,
      snapshotReceivedAt: keepSnapshot ? state.snapshotReceivedAt : null,
      staleReason: null,
    };
  }),
  closePanel: () => set({ panelTarget: null }),
  setSnapshotLoading: (snapshotTarget) => set({
    snapshotStatus: 'loading',
    snapshotTarget,
    snapshotError: null,
    snapshotRequestedAt: Date.now(),
    staleReason: null,
  }),
  setSnapshotResult: (message, editorRect = null) => set((state) => {
    const snapshotTarget = targetReferenceFromSnapshotMessage(message, state.snapshotTarget);
    const error = message.error ?? null;

    if (error || !message.snapshot) {
      if (isVisualTargetResolutionError(error)) {
        return staleVisualTargetState(snapshotTarget, error, 'stale-target');
      }

      return {
        snapshotStatus: 'error',
        snapshotTarget,
        snapshot: null,
        snapshotEditorRect: null,
        snapshotError: error,
        snapshotReceivedAt: Date.now(),
        staleReason: 'snapshot-error',
      };
    }

    return {
      snapshotStatus: 'ready',
      snapshotTarget,
      snapshot: message.snapshot,
      snapshotEditorRect: editorRect,
      snapshotError: null,
      snapshotReceivedAt: Date.now(),
      staleReason: null,
    };
  }),
  applyMutationResult: (message, editorRect = null) => set((state) => {
    if (message.error) {
      return selectionErrorState(state, message.error, 'mutation-error', {
        target: message.target,
        nodeId: message.nodeId,
      });
    }

    if (message.snapshot) {
      const refreshedTarget: EditorTargetReference = {
        target: message.target,
        nodeId: message.nodeId,
      };
      const now = Date.now();

      return {
        hoverTarget: refreshHoverTargetAfterMutation(
          state.hoverTarget,
          refreshedTarget,
          message.snapshot,
          editorRect,
          now,
        ),
        activeToolbarTarget: refreshToolbarTargetAfterMutation(
          state.activeToolbarTarget,
          refreshedTarget,
          message.snapshot,
          editorRect,
          now,
        ),
        panelTarget: refreshPanelTargetAfterMutation(
          state.panelTarget,
          refreshedTarget,
          message.snapshot,
          editorRect,
          now,
        ),
        snapshotStatus: 'ready',
        snapshotTarget: refreshedTarget,
        snapshot: message.snapshot,
        snapshotEditorRect: editorRect,
        snapshotError: null,
        snapshotReceivedAt: now,
        staleReason: null,
      };
    }

    if (message.kind === 'structure' && message.operation === 'delete' && message.applied) {
      return {
        ...staleVisualTargetState({
          target: message.target,
          nodeId: message.nodeId,
        }, null, 'deleted'),
        panelTarget: null,
      };
    }

    return state;
  }),
  setMutationError: (message) => set((state) => selectionErrorState(
    state,
    message.error,
    'mutation-error',
    message.target ? { target: message.target, nodeId: message.nodeId ?? null } : undefined,
  )),
  syncEditorRects: ({
    hoverEditorRect,
    activeToolbarEditorRect,
    panelEditorRect,
    snapshotEditorRect,
  }) => set((state) => ({
    hoverTarget: state.hoverTarget && hoverEditorRect !== undefined
      ? { ...state.hoverTarget, editorRect: hoverEditorRect }
      : state.hoverTarget,
    activeToolbarTarget: state.activeToolbarTarget && activeToolbarEditorRect !== undefined
      ? { ...state.activeToolbarTarget, editorRect: activeToolbarEditorRect }
      : state.activeToolbarTarget,
    panelTarget: state.panelTarget && panelEditorRect !== undefined
      ? { ...state.panelTarget, editorRect: panelEditorRect }
      : state.panelTarget,
    snapshotEditorRect: snapshotEditorRect !== undefined ? snapshotEditorRect : state.snapshotEditorRect,
  })),
  markStale: (staleReason, snapshotError = null) => set({
    snapshotStatus: 'stale',
    snapshotError,
    staleReason,
  }),
  resetVisualSelectionState: () => set({ ...initialVisualSelectionState }),
}));

export function selectVisualPanelReadinessSummary(
  state: Pick<VisualSelectionStateSnapshot, 'snapshotStatus' | 'snapshot' | 'snapshotError' | 'staleReason'>,
  hasTarget: boolean,
): VisualPanelReadinessSummary {
  const stateMessages = getCurrentMessages().visualEditor.panel.state;

  if (!hasTarget) {
    return {
      status: 'empty',
      tone: 'neutral',
      title: stateMessages.empty.title,
      message: stateMessages.empty.message,
      errorCode: null,
      staleReason: null,
      canShowControls: false,
      needsReselect: true,
    };
  }

  if (state.snapshotStatus === 'loading') {
    return {
      status: 'loading',
      tone: 'info',
      title: stateMessages.loading.title,
      message: stateMessages.loading.message,
      errorCode: null,
      staleReason: null,
      canShowControls: false,
      needsReselect: false,
    };
  }

  if (state.snapshotStatus === 'error') {
    return {
      status: 'error',
      tone: 'error',
      title: stateMessages.error.title,
      message: stateMessages.error.message,
      errorCode: state.snapshotError?.code ?? null,
      staleReason: state.staleReason,
      canShowControls: false,
      needsReselect: true,
    };
  }

  if (state.snapshotStatus === 'stale') {
    return {
      status: 'stale',
      tone: 'warning',
      title: staleReadinessTitle(state.staleReason),
      message: staleReadinessMessage(state.staleReason),
      errorCode: state.snapshotError?.code ?? null,
      staleReason: state.staleReason,
      canShowControls: false,
      needsReselect: true,
    };
  }

  if (state.snapshot) {
    return {
      status: 'ready',
      tone: 'success',
      title: stateMessages.ready.title,
      message: stateMessages.ready.message,
      errorCode: null,
      staleReason: null,
      canShowControls: true,
      needsReselect: false,
    };
  }

  return {
    status: 'waiting',
    tone: 'info',
    title: stateMessages.waiting.title,
    message: stateMessages.waiting.message,
    errorCode: null,
    staleReason: state.staleReason,
    canShowControls: false,
    needsReselect: false,
  };
}

export function describeVisualSelectionStaleReason(reason: VisualSelectionStaleReason): string {
  return getCurrentMessages().visualEditor.staleReasons[reason] ?? reason;
}

function isClearingQuickActionReason(reason: QuickActionAnchorChangedMessage['reason']): boolean {
  return reason === 'cleared'
    || reason === 'hidden'
    || reason === 'disconnected'
    || reason === 'protected-target'
    || reason === 'stale-target';
}

function staleReasonForQuickActionReason(
  reason: QuickActionAnchorChangedMessage['reason'],
  fallback: VisualSelectionStaleReason | null,
): VisualSelectionStaleReason | null {
  if (reason === 'disconnected') {
    return 'disconnected';
  }

  if (reason === 'protected-target') {
    return 'protected-target';
  }

  if (reason === 'stale-target') {
    return 'stale-target';
  }

  if (reason === 'hidden') {
    return 'hidden';
  }

  if (reason === 'cleared') {
    return 'cleared';
  }

  return fallback;
}

function targetReferenceFromSnapshotMessage(
  message: VisualTargetSnapshotMessage,
  fallback: EditorTargetReference | null,
): EditorTargetReference | null {
  const target = message.snapshot?.target ?? message.target;
  if (!target) {
    return fallback;
  }

  return {
    target,
    nodeId: message.snapshot?.nodeId ?? message.nodeId,
  };
}

function refreshHoverTargetAfterMutation(
  targetState: VisualHoverTargetState | null,
  reference: EditorTargetReference,
  snapshot: VisualTargetSnapshot,
  editorRect: EditorViewportRect | null,
  updatedAt: number,
): VisualHoverTargetState | null {
  if (!targetState || !targetStateMatchesReference(targetState.target, targetState.nodeId, reference)) {
    return targetState;
  }

  return {
    ...targetState,
    target: reference.target,
    nodeId: reference.nodeId,
    elementRect: snapshot.elementRect,
    editorRect,
    viewport: snapshot.viewport,
    updatedAt,
  };
}

function refreshToolbarTargetAfterMutation(
  targetState: VisualToolbarTargetState | null,
  reference: EditorTargetReference,
  snapshot: VisualTargetSnapshot,
  editorRect: EditorViewportRect | null,
  updatedAt: number,
): VisualToolbarTargetState | null {
  if (!targetState || !targetStateMatchesReference(targetState.target, targetState.nodeId, reference)) {
    return targetState;
  }

  return {
    ...targetState,
    target: reference.target,
    nodeId: reference.nodeId,
    elementRect: snapshot.elementRect,
    editorRect,
    viewport: snapshot.viewport,
    updatedAt,
  };
}

function refreshPanelTargetAfterMutation(
  targetState: VisualPanelTargetState | null,
  reference: EditorTargetReference,
  snapshot: VisualTargetSnapshot,
  editorRect: EditorViewportRect | null,
  updatedAt: number,
): VisualPanelTargetState | null {
  if (!targetState || !targetStateMatchesReference(targetState.target, targetState.nodeId, reference)) {
    return targetState;
  }

  return {
    ...targetState,
    target: reference.target,
    nodeId: reference.nodeId,
    elementRect: snapshot.elementRect,
    editorRect,
    updatedAt,
  };
}

function targetStateMatchesReference(
  target: EditorTarget | null | undefined,
  nodeId: string | null | undefined,
  reference: EditorTargetReference,
): boolean {
  if (!target) {
    return false;
  }

  if (nodeId && reference.nodeId && nodeId === reference.nodeId) {
    return true;
  }

  return hasSameEditorTarget(target, reference.target);
}

function selectionErrorState(
  state: VisualSelectionStateSnapshot,
  error: VisualMutationError,
  reason: VisualSelectionStaleReason,
  fallbackTarget?: EditorTargetReference | null,
): Partial<VisualSelectionStateSnapshot> {
  if (isVisualTargetResolutionError(error)) {
    return staleVisualTargetState(fallbackTarget ?? state.snapshotTarget, error, 'stale-target');
  }

  return {
    snapshotStatus: 'error',
    snapshotError: error,
    staleReason: reason,
    snapshotReceivedAt: Date.now(),
    snapshotTarget: fallbackTarget ?? state.snapshotTarget,
  };
}

function staleVisualTargetState(
  snapshotTarget: EditorTargetReference | null,
  snapshotError: VisualMutationError | null,
  staleReason: VisualSelectionStaleReason,
): Partial<VisualSelectionStateSnapshot> {
  return {
    hoverTarget: null,
    activeToolbarTarget: null,
    quickActionDismissedAt: Date.now(),
    snapshotStatus: 'stale',
    snapshotTarget,
    snapshot: null,
    snapshotEditorRect: null,
    snapshotError,
    snapshotReceivedAt: Date.now(),
    staleReason,
  };
}

function staleReadinessTitle(reason: VisualSelectionStaleReason | null): string {
  const stateMessages = getCurrentMessages().visualEditor.panel.state;

  if (reason === 'deleted') {
    return stateMessages.deleted.title;
  }

  return stateMessages.stale.title;
}

function staleReadinessMessage(reason: VisualSelectionStaleReason | null): string {
  const stateMessages = getCurrentMessages().visualEditor.panel.state;

  if (reason === 'deleted') {
    return stateMessages.deleted.message;
  }

  return stateMessages.stale.message;
}
