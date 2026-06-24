import { create } from 'zustand';

import type { EditorTarget, HighlightOrigin } from '../../shared/editor-messages';
import { hasSameEditorTarget } from '../../shared/editor-targets';

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
