import { create } from 'zustand';

import type { RuntimeStatus } from '../types';

interface RuntimeStore {
  mounted: boolean;
  status: RuntimeStatus;
  currentUrl: string;
  previewUrl: string;
  bootError: string | null;
  setMounted(mounted: boolean): void;
  setCurrentUrl(url: string): void;
  setPreviewUrl(url: string): void;
  setBootError(message: string | null): void;
  reset(): void;
}

const initialState = {
  mounted: false,
  status: 'idle' as RuntimeStatus,
  currentUrl: '',
  previewUrl: '',
  bootError: null,
};

export const useRuntimeStore = create<RuntimeStore>((set) => ({
  ...initialState,
  setMounted: (mounted) => set({ mounted, status: mounted ? 'mounted' : 'idle' }),
  setCurrentUrl: (currentUrl) => set({ currentUrl }),
  setPreviewUrl: (previewUrl) => set({ previewUrl }),
  setBootError: (bootError) => set({ bootError, status: bootError ? 'error' : 'mounted' }),
  reset: () => set({ ...initialState }),
}));
