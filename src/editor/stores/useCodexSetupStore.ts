import { create } from 'zustand';

import { CODEX_RUNTIME_MESSAGE_TYPES } from '../../shared/codex';

export type CodexSetupStatus =
  | 'checking'
  | 'ready'
  | 'busy'
  | 'maintenance'
  | 'unreachable'
  | 'not-ready';

export interface CodexSetupCheck {
  id: string;
  ok: boolean;
  issueCode: string | null;
  detail: string;
}

interface CodexSetupOutcome {
  status: Exclude<CodexSetupStatus, 'checking'>;
  checks: CodexSetupCheck[];
  errorDetail: string | null;
}

interface CodexSetupState {
  status: CodexSetupStatus;
  checks: CodexSetupCheck[];
  errorDetail: string | null;
  isRefreshing: boolean;
  dialogOpen: boolean;
  beginRefresh(showChecking: boolean): void;
  finishRefresh(outcome: CodexSetupOutcome): void;
  openDialog(): void;
  closeDialog(): void;
  resetRuntime(): void;
}

interface CodexHealthPayload {
  ok: boolean;
  ready?: unknown;
  prerequisitesReady?: unknown;
  running?: unknown;
  maintenance?: unknown;
  acceptingRuns?: unknown;
  checks?: unknown;
  error?: unknown;
}

const INITIAL_RUNTIME_STATE = {
  status: 'checking' as const,
  checks: [] as CodexSetupCheck[],
  errorDetail: null,
  isRefreshing: false,
  dialogOpen: false,
};

let healthRequestSequence = 0;

export const useCodexSetupStore = create<CodexSetupState>((set) => ({
  ...INITIAL_RUNTIME_STATE,
  beginRefresh: (showChecking) => set((state) => showChecking
    ? {
      isRefreshing: true,
      status: 'checking',
      checks: [],
      errorDetail: null,
    }
    : {
      isRefreshing: true,
      status: state.status,
    }),
  finishRefresh: (outcome) => set({
    ...outcome,
    isRefreshing: false,
  }),
  openDialog: () => set({ dialogOpen: true }),
  closeDialog: () => set({ dialogOpen: false }),
  resetRuntime: () => set(INITIAL_RUNTIME_STATE),
}));

export async function refreshCodexSetup(options: { showChecking?: boolean } = {}): Promise<void> {
  const requestSequence = ++healthRequestSequence;
  useCodexSetupStore.getState().beginRefresh(options.showChecking === true);

  const outcome = await requestCodexHealth();
  if (requestSequence !== healthRequestSequence) {
    return;
  }

  useCodexSetupStore.getState().finishRefresh(outcome);
}

export function resetCodexSetupRuntime(): void {
  // Invalidates any health response still in flight from a previous editor
  // mount before restoring the deliberately non-optimistic checking state.
  healthRequestSequence += 1;
  useCodexSetupStore.getState().resetRuntime();
}

async function requestCodexHealth(): Promise<CodexSetupOutcome> {
  try {
    const response: unknown = await chrome.runtime.sendMessage({
      type: CODEX_RUNTIME_MESSAGE_TYPES.health,
    });

    if (!isCodexHealthPayload(response)) {
      return unreachableOutcome('Unexpected background response.');
    }

    if (!response.ok) {
      return unreachableOutcome(
        typeof response.error === 'string' ? response.error : null,
      );
    }

    const checks = normalizeChecks(response.checks);
    if (response.running === true) {
      return { status: 'busy', checks, errorDetail: null };
    }

    if (response.maintenance === true) {
      return { status: 'maintenance', checks, errorDetail: null };
    }

    if (response.ready === true) {
      return { status: 'ready', checks, errorDetail: null };
    }

    return { status: 'not-ready', checks, errorDetail: null };
  } catch (error) {
    // This covers a stopped companion as well as an invalidated extension
    // context. Both mean that Send must remain unavailable until Retry works.
    return unreachableOutcome(error instanceof Error ? error.message : null);
  }
}

function unreachableOutcome(errorDetail: string | null): CodexSetupOutcome {
  return {
    status: 'unreachable',
    checks: [],
    errorDetail,
  };
}

function isCodexHealthPayload(value: unknown): value is CodexHealthPayload {
  return Boolean(value)
    && typeof value === 'object'
    && typeof (value as { ok?: unknown }).ok === 'boolean';
}

function normalizeChecks(value: unknown): CodexSetupCheck[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.flatMap((check): CodexSetupCheck[] => {
    if (!check || typeof check !== 'object') {
      return [];
    }

    const candidate = check as Record<string, unknown>;
    if (typeof candidate.id !== 'string' || typeof candidate.ok !== 'boolean') {
      return [];
    }

    return [{
      id: candidate.id,
      ok: candidate.ok,
      issueCode: typeof candidate.issueCode === 'string' ? candidate.issueCode : null,
      detail: typeof candidate.detail === 'string' ? candidate.detail : '',
    }];
  });
}
