import { create } from 'zustand';

import type { EditorTarget, HighlightOrigin } from '../../shared/editor-messages';
import { hasSameEditorTarget } from '../../shared/editor-targets';

/**
 * Owns highlight *identity* (which target/node is highlighted and from
 * where) for the layout tree, keyboard traversal, and notebook chips.
 * Hover *geometry* for the visual toolbar/panel is owned separately by
 * useVisualSelectionStore.hoverTarget; both are fed from the same
 * targetHighlighted bridge message by design.
 */
interface HighlightStore {
  highlightedTarget: EditorTarget | null;
  highlightedNodeId: string | null;
  highlightOrigin: HighlightOrigin | null;
  setHighlightedTarget(target: EditorTarget | null, nodeId?: string | null, origin?: HighlightOrigin): void;
  clearHighlightedTarget(): void;
}

export const useHighlightStore = create<HighlightStore>((set) => ({
  highlightedTarget: null,
  highlightedNodeId: null,
  highlightOrigin: null,
  setHighlightedTarget: (highlightedTarget, highlightedNodeId = null, highlightOrigin = 'editor') => set((state) => {
    if (
      state.highlightedNodeId === highlightedNodeId
      && state.highlightOrigin === highlightOrigin
      && hasSameEditorTarget(state.highlightedTarget, highlightedTarget)
    ) {
      return state;
    }

    return {
      highlightedTarget,
      highlightedNodeId,
      highlightOrigin,
    };
  }),
  clearHighlightedTarget: () => set({
    highlightedTarget: null,
    highlightedNodeId: null,
    highlightOrigin: null,
  }),
}));
