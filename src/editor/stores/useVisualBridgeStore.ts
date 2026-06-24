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
import type { EditorViewportRect } from '../bridge/geometry';

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
  quickActionAnchorEditorRect: EditorViewportRect | null;
  selectedQuickActionCategory: QuickActionCategorySelection | null;
  targetSnapshot: VisualTargetSnapshotMessage | null;
  targetSnapshotEditorRect: EditorViewportRect | null;
  latestMutationResult: VisualMutationResultMessage | null;
  latestMutationError: VisualMutationErrorMessage | null;
  mutationResultsById: Record<number, VisualMutationResultMessage>;
  layoutRefreshRevision: number;
  lastLayoutRefreshAt: number | null;
}

interface VisualBridgeStore extends VisualBridgeStateSnapshot {
  setQuickActionAnchor(message: QuickActionAnchorChangedMessage, editorRect?: EditorViewportRect | null): void;
  setQuickActionCategorySelection(selection: Omit<QuickActionCategorySelection, 'selectedAt'>): void;
  setVisualTargetSnapshot(message: VisualTargetSnapshotMessage, editorRect?: EditorViewportRect | null): void;
  setVisualMutationResult(message: VisualMutationResultMessage, editorRect?: EditorViewportRect | null): void;
  setVisualMutationError(message: VisualMutationErrorMessage): void;
  syncEditorRects(rects: Pick<VisualBridgeStateSnapshot, 'quickActionAnchorEditorRect' | 'targetSnapshotEditorRect'>): void;
  markLayoutTreeRefreshed(): void;
  resetVisualBridgeState(): void;
}

const initialVisualBridgeState: VisualBridgeStateSnapshot = {
  quickActionAnchor: null,
  quickActionAnchorEditorRect: null,
  selectedQuickActionCategory: null,
  targetSnapshot: null,
  targetSnapshotEditorRect: null,
  latestMutationResult: null,
  latestMutationError: null,
  mutationResultsById: {},
  layoutRefreshRevision: 0,
  lastLayoutRefreshAt: null,
};

export const useVisualBridgeStore = create<VisualBridgeStore>((set) => ({
  ...initialVisualBridgeState,
  setQuickActionAnchor: (quickActionAnchor, quickActionAnchorEditorRect = null) => set({
    quickActionAnchor,
    quickActionAnchorEditorRect,
  }),
  setQuickActionCategorySelection: (selection) => set({
    selectedQuickActionCategory: {
      ...selection,
      selectedAt: Date.now(),
    },
  }),
  setVisualTargetSnapshot: (targetSnapshot, targetSnapshotEditorRect = null) => set({
    targetSnapshot,
    targetSnapshotEditorRect,
  }),
  setVisualMutationResult: (latestMutationResult, targetSnapshotEditorRect = null) => set((state) => {
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
      nextState.targetSnapshotEditorRect = targetSnapshotEditorRect;
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
  syncEditorRects: ({ quickActionAnchorEditorRect, targetSnapshotEditorRect }) => set({
    quickActionAnchorEditorRect,
    targetSnapshotEditorRect,
  }),
  markLayoutTreeRefreshed: () => set((state) => ({
    layoutRefreshRevision: state.layoutRefreshRevision + 1,
    lastLayoutRefreshAt: Date.now(),
  })),
  resetVisualBridgeState: () => set({ ...initialVisualBridgeState }),
}));
