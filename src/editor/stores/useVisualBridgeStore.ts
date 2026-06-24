import { create } from 'zustand';

import {
  EDITOR_MESSAGE_TYPES,
  type BridgeToEditorMessage,
  type EditorTargetReference,
  type QuickActionAnchorChangedMessage,
  type QuickActionCategory,
  type VisualMutationErrorMessage,
  type VisualTargetSnapshotMessage,
} from '../../shared/editor-messages';

export type VisualMutationResultMessage = Extract<BridgeToEditorMessage, {
  applied: boolean;
  mutationId: number;
}>;

export interface QuickActionCategorySelection extends EditorTargetReference {
  category: QuickActionCategory;
  selectedAt: number;
}

interface VisualBridgeStateSnapshot {
  quickActionAnchor: QuickActionAnchorChangedMessage | null;
  selectedQuickActionCategory: QuickActionCategorySelection | null;
  targetSnapshot: VisualTargetSnapshotMessage | null;
  latestMutationResult: VisualMutationResultMessage | null;
  latestMutationError: VisualMutationErrorMessage | null;
  mutationResultsById: Record<number, VisualMutationResultMessage>;
  layoutRefreshRevision: number;
  lastLayoutRefreshAt: number | null;
}

interface VisualBridgeStore extends VisualBridgeStateSnapshot {
  setQuickActionAnchor(message: QuickActionAnchorChangedMessage): void;
  setQuickActionCategorySelection(selection: Omit<QuickActionCategorySelection, 'selectedAt'>): void;
  setVisualTargetSnapshot(message: VisualTargetSnapshotMessage): void;
  setVisualMutationResult(message: VisualMutationResultMessage): void;
  setVisualMutationError(message: VisualMutationErrorMessage): void;
  markLayoutTreeRefreshed(): void;
  resetVisualBridgeState(): void;
}

const initialVisualBridgeState: VisualBridgeStateSnapshot = {
  quickActionAnchor: null,
  selectedQuickActionCategory: null,
  targetSnapshot: null,
  latestMutationResult: null,
  latestMutationError: null,
  mutationResultsById: {},
  layoutRefreshRevision: 0,
  lastLayoutRefreshAt: null,
};

export const useVisualBridgeStore = create<VisualBridgeStore>((set) => ({
  ...initialVisualBridgeState,
  setQuickActionAnchor: (quickActionAnchor) => set({ quickActionAnchor }),
  setQuickActionCategorySelection: (selection) => set({
    selectedQuickActionCategory: {
      ...selection,
      selectedAt: Date.now(),
    },
  }),
  setVisualTargetSnapshot: (targetSnapshot) => set({ targetSnapshot }),
  setVisualMutationResult: (latestMutationResult) => set((state) => {
    const nextState: Partial<VisualBridgeStateSnapshot> = {
      latestMutationResult,
      mutationResultsById: {
        ...state.mutationResultsById,
        [latestMutationResult.mutationId]: latestMutationResult,
      },
    };

    if (latestMutationResult.snapshot) {
      nextState.targetSnapshot = {
        type: EDITOR_MESSAGE_TYPES.visualTargetSnapshot,
        target: latestMutationResult.target,
        nodeId: latestMutationResult.nodeId,
        snapshot: latestMutationResult.snapshot,
      };
    }

    if (latestMutationResult.error) {
      nextState.latestMutationError = {
        type: EDITOR_MESSAGE_TYPES.visualMutationError,
        mutationId: latestMutationResult.mutationId,
        kind: latestMutationResult.kind,
        target: latestMutationResult.target,
        nodeId: latestMutationResult.nodeId,
        error: latestMutationResult.error,
      };
    }

    return nextState;
  }),
  setVisualMutationError: (latestMutationError) => set({ latestMutationError }),
  markLayoutTreeRefreshed: () => set((state) => ({
    layoutRefreshRevision: state.layoutRefreshRevision + 1,
    lastLayoutRefreshAt: Date.now(),
  })),
  resetVisualBridgeState: () => set({ ...initialVisualBridgeState }),
}));
