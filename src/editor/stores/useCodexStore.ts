import { create } from 'zustand';

import {
  DEFAULT_CODEX_REASONING_EFFORT,
  isCodexReasoningEffort,
  type CodexReasoningEffort,
  type CodexResolveMethod,
  type CodexRunEvent,
} from '../../shared/codex';

const REASONING_EFFORT_STORAGE_KEY = 'copy-ai-id:codex-reasoning:v1';
const MAX_LOG_EVENTS = 500;

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
  reasoningEffort: CodexReasoningEffort;
  logOpen: boolean;
  logEvents: CodexRunEvent[];
  setPhase(phase: CodexSendPhase): void;
  beginConfirm(pending: CodexPendingSend): void;
  beginRun(pending: CodexPendingSend): void;
  reset(): void;
  setReasoningEffort(effort: CodexReasoningEffort): void;
  hydrateReasoningEffort(): Promise<void>;
  startLog(): void;
  appendLogEvents(events: CodexRunEvent[]): void;
  closeLog(): void;
}

function getChromeLocalStorage(): chrome.storage.LocalStorageArea | null {
  if (typeof chrome === 'undefined' || typeof chrome.storage?.local === 'undefined') {
    return null;
  }

  return chrome.storage.local;
}

async function readStoredReasoningEffort(): Promise<CodexReasoningEffort> {
  const storage = getChromeLocalStorage();
  if (!storage) {
    return DEFAULT_CODEX_REASONING_EFFORT;
  }

  try {
    const result = await storage.get(REASONING_EFFORT_STORAGE_KEY);
    const stored = result[REASONING_EFFORT_STORAGE_KEY];
    return isCodexReasoningEffort(stored) ? stored : DEFAULT_CODEX_REASONING_EFFORT;
  } catch {
    return DEFAULT_CODEX_REASONING_EFFORT;
  }
}

function persistReasoningEffort(effort: CodexReasoningEffort): void {
  const storage = getChromeLocalStorage();
  if (!storage) {
    return;
  }

  void storage.set({ [REASONING_EFFORT_STORAGE_KEY]: effort }).catch(() => {
    // Ignore persistence failures (e.g. invalidated extension context).
  });
}

export const useCodexStore = create<CodexSendState>((set) => ({
  phase: 'idle',
  pending: null,
  reasoningEffort: DEFAULT_CODEX_REASONING_EFFORT,
  logOpen: false,
  logEvents: [],
  setPhase: (phase) => set({ phase }),
  beginConfirm: (pending) => set({ phase: 'confirming', pending }),
  beginRun: (pending) => set({ phase: 'running', pending }),
  reset: () => set({ phase: 'idle', pending: null }),
  setReasoningEffort: (effort) => {
    persistReasoningEffort(effort);
    set({ reasoningEffort: effort });
  },
  hydrateReasoningEffort: async () => {
    const effort = await readStoredReasoningEffort();
    set({ reasoningEffort: effort });
  },
  startLog: () => set({ logOpen: true, logEvents: [] }),
  appendLogEvents: (events) => {
    if (events.length === 0) {
      return;
    }

    set((state) => ({
      logEvents: [...state.logEvents, ...events].slice(-MAX_LOG_EVENTS),
    }));
  },
  closeLog: () => set({ logOpen: false }),
}));
