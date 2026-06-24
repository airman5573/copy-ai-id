import { create } from 'zustand';

export type EditorToastTone = 'error' | 'info';

export interface EditorToastState {
  message: string | null;
  tone: EditorToastTone;
  showToast(message: string, tone?: EditorToastTone): void;
  clearToast(): void;
}

export const useToastStore = create<EditorToastState>((set) => ({
  message: null,
  tone: 'info',
  showToast: (message, tone = 'info') => set({ message, tone }),
  clearToast: () => set({ message: null, tone: 'info' }),
}));
