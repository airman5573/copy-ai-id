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

interface VisualSelectionStateSnapshot {
  hoverTarget: VisualHoverTargetState | null;
  activeToolbarTarget: VisualToolbarTargetState | null;
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

const initialVisualSelectionState: VisualSelectionStateSnapshot = {
  hoverTarget: null,
  activeToolbarTarget: null,
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
    hoverTarget: {
      target: message.target,
      nodeId: message.nodeId,
      origin: message.origin ?? 'preview',
      elementRect: message.elementRect ?? null,
      editorRect,
      viewport: message.viewport ?? null,
      updatedAt: Date.now(),
    },
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
      staleReason: null,
    };
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
      return {
        snapshotStatus: isStaleError(error?.code) ? 'stale' : 'error',
        snapshotTarget,
        snapshot: null,
        snapshotEditorRect: null,
        snapshotError: error,
        snapshotReceivedAt: Date.now(),
        staleReason: isStaleError(error?.code) ? 'stale-target' : 'snapshot-error',
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
      return selectionErrorState(state, message.error, 'mutation-error');
    }

    if (message.snapshot) {
      return {
        snapshotStatus: 'ready',
        snapshotTarget: {
          target: message.target,
          nodeId: message.nodeId,
        },
        snapshot: message.snapshot,
        snapshotEditorRect: editorRect,
        snapshotError: null,
        snapshotReceivedAt: Date.now(),
        staleReason: null,
      };
    }

    if (message.kind === 'structure' && message.operation === 'delete' && message.applied) {
      return {
        snapshotStatus: 'stale' as VisualSnapshotStatus,
        snapshotTarget: {
          target: message.target,
          nodeId: message.nodeId,
        },
        snapshot: null,
        snapshotEditorRect: null,
        snapshotError: null,
        snapshotReceivedAt: Date.now(),
        staleReason: 'deleted' as VisualSelectionStaleReason,
      };
    }

    return state;
  }),
  setMutationError: (message) => set((state) => selectionErrorState(state, message.error, 'mutation-error')),
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

function selectionErrorState(
  state: VisualSelectionStateSnapshot,
  error: VisualMutationError,
  reason: VisualSelectionStaleReason,
): Partial<VisualSelectionStateSnapshot> {
  return {
    snapshotStatus: isStaleError(error.code) ? 'stale' : 'error',
    snapshotError: error,
    staleReason: isStaleError(error.code) ? 'stale-target' : reason,
    snapshotReceivedAt: Date.now(),
    snapshotTarget: state.snapshotTarget,
  };
}

function isStaleError(code: VisualMutationErrorCode | undefined): boolean {
  return code === 'stale-target'
    || code === 'target-not-found'
    || code === 'ambiguous-target';
}
