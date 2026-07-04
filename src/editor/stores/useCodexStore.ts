import { create } from 'zustand';

import type { CodexResolveMethod } from '../../shared/codex';

export type CodexSendPhase = 'idle' | 'resolving' | 'confirming' | 'running';

export interface CodexPendingSend {
  markdown: string;
  subject: string;
  pageUrl: string;
  projectPath: string;
  method: CodexResolveMethod;
  detail: string;
}

export interface CodexSendState {
  phase: CodexSendPhase;
  pending: CodexPendingSend | null;
  setPhase(phase: CodexSendPhase): void;
  beginConfirm(pending: CodexPendingSend): void;
  reset(): void;
}

export const useCodexStore = create<CodexSendState>((set) => ({
  phase: 'idle',
  pending: null,
  setPhase: (phase) => set({ phase }),
  beginConfirm: (pending) => set({ phase: 'confirming', pending }),
  reset: () => set({ phase: 'idle', pending: null }),
}));
