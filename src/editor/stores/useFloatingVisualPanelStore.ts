import { create } from 'zustand';

/**
 * Open/close state of the floating visual panel. The panel's target,
 * category, and anchor rects are owned by useVisualSelectionStore
 * (`panelTarget`); this store only tracks visibility.
 */
interface FloatingVisualPanelStore {
  isOpen: boolean;
  openPanel(): void;
  closePanel(): void;
  resetFloatingVisualPanelStore(): void;
}

export const useFloatingVisualPanelStore = create<FloatingVisualPanelStore>((set) => ({
  isOpen: false,
  openPanel: () => set({ isOpen: true }),
  closePanel: () => set({ isOpen: false }),
  resetFloatingVisualPanelStore: () => set({ isOpen: false }),
}));
