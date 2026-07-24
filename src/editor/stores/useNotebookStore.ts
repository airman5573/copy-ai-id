import { create } from 'zustand';

import type {
  EditorTarget,
  EditorTargetReference,
} from '../../shared/domain/targets';
import type { BreakpointId } from '../../shared/breakpoints';
import {
  FIRST_NOTEBOOK_CHIP_INDEX,
  formatNotebookChipId,
  normalizeNextNotebookChipIndex,
} from '../notebook/lexical/chip-ids';
import {
  type ExportedChipTarget,
  formatChipTargetMap,
  hasFallbackChipTargets,
} from '../notebook/lexical/chip-export';
import {
  DEFAULT_NOTEBOOK_SUFFIX_SETTINGS,
  normalizeNotebookSuffixSettings,
  type NotebookSuffixSettings,
} from '../notebook/suffix-settings';
import {
  getNotebookBreakpointScopeCumulativeSelection,
  NOTEBOOK_BREAKPOINT_SCOPE_ORDER,
  type NotebookBreakpointScope,
} from '../notebook/breakpoint-scope';
import type { CopyStatus } from '../types';

export const DEFAULT_NOTE_FONT_SIZE = 14;
export const MIN_NOTE_FONT_SIZE = 10;
export const MAX_NOTE_FONT_SIZE = 28;
const NOTE_FONT_SIZE_STORAGE_KEY = 'copy-ai-id:note-font-size:v1';

interface NotebookStore {
  // Derived exported note text used by copy/reset compatibility paths.
  // The editable notebook content is owned by editorStateJson.
  draft: string;
  editorStateJson: string | null;
  activeChipTargets: ExportedChipTarget[];
  chipTargetMap: string;
  hasFallbackTargets: boolean;
  isNotebookEmpty: boolean;
  nextChipIndex: number;
  suffixSettings: NotebookSuffixSettings;
  lastBreakpointScopeClick: NotebookBreakpointScope | null;
  noteFontSize: number;
  copyStatus: CopyStatus;
  focusedTarget: EditorTarget | null;
  insertTargetReference: ((reference: EditorTargetReference) => void) | null;
  flashChip: ((chipId: string) => void) | null;
  setLexicalEditorState(snapshot: NotebookLexicalStateSnapshot): void;
  allocateChipId(): string;
  setInsertTargetReference(insertTargetReference: ((reference: EditorTargetReference) => void) | null): void;
  setFlashChip(flashChip: ((chipId: string) => void) | null): void;
  setSuffixSettings(settings: NotebookSuffixSettings): void;
  syncBreakpointScopeFromCanvas(breakpointId: BreakpointId): void;
  setLastBreakpointScopeClick(scope: NotebookBreakpointScope): void;
  hydrateNoteFontSize(): Promise<void>;
  setCopyStatus(copyStatus: CopyStatus): void;
  setFocusedTarget(target: EditorTarget | null): void;
  clearDraft(): void;
  resetForPageChange(): void;
}

export interface NotebookLexicalStateSnapshot {
  draft: string;
  editorStateJson: string;
  activeChipTargets: ExportedChipTarget[];
  chipTargetMap: string;
  hasFallbackTargets: boolean;
  isNotebookEmpty: boolean;
}

export function selectHasNotebookDraftForCopy(
  state: Pick<NotebookLexicalStateSnapshot, 'draft' | 'isNotebookEmpty'>,
): boolean {
  return !state.isNotebookEmpty && state.draft.trim().length > 0;
}

function getChromeLocalStorage(): chrome.storage.LocalStorageArea | null {
  if (typeof chrome === 'undefined' || typeof chrome.storage?.local === 'undefined') {
    return null;
  }

  return chrome.storage.local;
}

export function normalizeNoteFontSize(value: number): number {
  if (!Number.isFinite(value)) {
    return DEFAULT_NOTE_FONT_SIZE;
  }

  return Math.min(
    MAX_NOTE_FONT_SIZE,
    Math.max(MIN_NOTE_FONT_SIZE, Math.round(value)),
  );
}

async function readStoredNoteFontSize(): Promise<number> {
  const storage = getChromeLocalStorage();
  if (!storage) {
    return DEFAULT_NOTE_FONT_SIZE;
  }

  try {
    const result = await storage.get(NOTE_FONT_SIZE_STORAGE_KEY);
    return normalizeNoteFontSize(Number(result[NOTE_FONT_SIZE_STORAGE_KEY]));
  } catch {
    return DEFAULT_NOTE_FONT_SIZE;
  }
}


function createPlainDraftState(draft: string) {
  return {
    draft,
    editorStateJson: null,
    activeChipTargets: [],
    chipTargetMap: '',
    hasFallbackTargets: false,
    isNotebookEmpty: draft.trim().length === 0,
  };
}

export const useNotebookStore = create<NotebookStore>((set) => ({
  draft: '',
  editorStateJson: null,
  activeChipTargets: [],
  chipTargetMap: '',
  hasFallbackTargets: false,
  isNotebookEmpty: true,
  nextChipIndex: FIRST_NOTEBOOK_CHIP_INDEX,
  suffixSettings: { ...DEFAULT_NOTEBOOK_SUFFIX_SETTINGS },
  lastBreakpointScopeClick: 'desktop',
  noteFontSize: DEFAULT_NOTE_FONT_SIZE,
  copyStatus: 'idle',
  focusedTarget: null,
  insertTargetReference: null,
  flashChip: null,
  setLexicalEditorState: (snapshot) => set(snapshot),
  allocateChipId: () => {
    let chipId = formatNotebookChipId(FIRST_NOTEBOOK_CHIP_INDEX);

    set((state) => {
      const nextChipIndex = normalizeNextNotebookChipIndex(state.nextChipIndex);
      chipId = formatNotebookChipId(nextChipIndex);

      return {
        nextChipIndex: nextChipIndex + 1,
      };
    });

    return chipId;
  },
  setInsertTargetReference: (insertTargetReference) => set({ insertTargetReference }),
  setFlashChip: (flashChip) => set({ flashChip }),
  setSuffixSettings: (suffixSettings) => set({
    suffixSettings: normalizeNotebookSuffixSettings(suffixSettings),
  }),
  syncBreakpointScopeFromCanvas: (breakpointId) => set((state) => {
    const scope: NotebookBreakpointScope = breakpointId === 'base'
      ? 'mobile'
      : breakpointId;
    const breakpointScopes = getNotebookBreakpointScopeCumulativeSelection(scope);
    const selectsEveryScope = breakpointScopes.length === NOTEBOOK_BREAKPOINT_SCOPE_ORDER.length;

    return {
      suffixSettings: {
        ...state.suffixSettings,
        breakpointMode: selectsEveryScope ? 'all' : 'manual',
        breakpointScopes: selectsEveryScope ? [] : breakpointScopes,
      },
      lastBreakpointScopeClick: scope,
    };
  }),
  setLastBreakpointScopeClick: (lastBreakpointScopeClick) => set({
    lastBreakpointScopeClick,
  }),
  hydrateNoteFontSize: async () => {
    set({ noteFontSize: await readStoredNoteFontSize() });
  },
  setCopyStatus: (copyStatus) => set({ copyStatus }),
  setFocusedTarget: (focusedTarget) => set({ focusedTarget }),
  clearDraft: () => set({
    ...createPlainDraftState(''),
    focusedTarget: null,
    copyStatus: 'idle',
    nextChipIndex: FIRST_NOTEBOOK_CHIP_INDEX,
  }),
  resetForPageChange: () => set({
    ...createPlainDraftState(''),
    suffixSettings: { ...DEFAULT_NOTEBOOK_SUFFIX_SETTINGS },
    lastBreakpointScopeClick: 'desktop',
    focusedTarget: null,
    copyStatus: 'idle',
    nextChipIndex: FIRST_NOTEBOOK_CHIP_INDEX,
  }),
}));
