import { create } from 'zustand';

import type {
  BridgeViewportRect,
  EditorTargetReference,
  QuickActionCategory,
} from '../../shared/editor-messages';
import type { EditorViewportRect } from '../bridge/geometry';

export interface FloatingVisualPanelTarget extends EditorTargetReference {
  category: QuickActionCategory;
  elementRect: BridgeViewportRect | null;
  editorRect: EditorViewportRect | null;
}

interface FloatingVisualPanelStateSnapshot {
  isOpen: boolean;
  target: FloatingVisualPanelTarget | null;
  category: QuickActionCategory | null;
  openedAt: number | null;
  updatedAt: number | null;
}

interface FloatingVisualPanelStore extends FloatingVisualPanelStateSnapshot {
  openForTarget(input: FloatingVisualPanelTarget): void;
  updateAnchorRects(rects: Pick<FloatingVisualPanelTarget, 'elementRect' | 'editorRect'>): void;
  setCategory(category: QuickActionCategory): void;
  closePanel(): void;
  resetFloatingVisualPanelStore(): void;
}

const initialFloatingVisualPanelState: FloatingVisualPanelStateSnapshot = {
  isOpen: false,
  target: null,
  category: null,
  openedAt: null,
  updatedAt: null,
};

export const useFloatingVisualPanelStore = create<FloatingVisualPanelStore>((set) => ({
  ...initialFloatingVisualPanelState,
  openForTarget: (input) => set((state) => {
    const now = Date.now();

    return {
      isOpen: true,
      target: { ...input },
      category: input.category,
      openedAt: state.isOpen ? state.openedAt : now,
      updatedAt: now,
    };
  }),
  updateAnchorRects: (rects) => set((state) => {
    if (!state.target) {
      return state;
    }

    const target = {
      ...state.target,
      ...rects,
    };

    return {
      target,
      updatedAt: Date.now(),
    };
  }),
  setCategory: (category) => set((state) => ({
    category,
    target: state.target ? { ...state.target, category } : state.target,
    updatedAt: Date.now(),
  })),
  closePanel: () => set({
    isOpen: false,
    target: null,
    category: null,
    updatedAt: Date.now(),
  }),
  resetFloatingVisualPanelStore: () => set({ ...initialFloatingVisualPanelState }),
}));
