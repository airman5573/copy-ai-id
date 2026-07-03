import { create } from 'zustand';

export type FloatingVisualPanelCategory =
  | 'content'
  | 'image'
  | 'layout'
  | 'spacing'
  | 'size'
  | 'style'
  | 'border';

export const FLOATING_VISUAL_PANEL_CATEGORIES: readonly FloatingVisualPanelCategory[] = [
  'content',
  'image',
  'layout',
  'spacing',
  'size',
  'style',
  'border',
];

/**
 * Open/close state + active category tab of the floating visual panel. The
 * panel's target and anchor rects are owned by useVisualSelectionStore
 * (`panelTarget`); this store only tracks visibility and which tab is shown.
 */
interface FloatingVisualPanelStore {
  isOpen: boolean;
  activeCategory: FloatingVisualPanelCategory;
  openPanel(category?: FloatingVisualPanelCategory): void;
  setCategory(category: FloatingVisualPanelCategory): void;
  closePanel(): void;
  resetFloatingVisualPanelStore(): void;
}

export const useFloatingVisualPanelStore = create<FloatingVisualPanelStore>((set) => ({
  isOpen: false,
  activeCategory: 'content',
  openPanel: (category) => set((state) => ({
    isOpen: true,
    activeCategory: category ?? state.activeCategory,
  })),
  setCategory: (category) => set({ activeCategory: category }),
  closePanel: () => set({ isOpen: false }),
  resetFloatingVisualPanelStore: () => set({ isOpen: false, activeCategory: 'content' }),
}));
