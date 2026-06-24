import { create } from 'zustand';

import type { EditorTarget, EditorTargetReference } from '../../shared/editor-messages';
import {
  FIRST_NOTEBOOK_CHIP_INDEX,
  formatNotebookChipId,
  normalizeNextNotebookChipIndex,
} from '../notebook/lexical/chip-ids';
import type { ExportedChipTarget } from '../notebook/lexical/chip-export';
import type { NotebookDraftSessionSnapshot } from '../notebook/session-draft';
import {
  DEFAULT_NOTEBOOK_SUFFIX_SETTINGS,
  normalizeNotebookSuffixSettings,
  type NotebookSuffixSettings,
} from '../notebook/suffix-settings';
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
  noteFontSize: number;
  copyStatus: CopyStatus;
  focusedTarget: EditorTarget | null;
  insertTargetReference: ((reference: EditorTargetReference) => void) | null;
  hydrateDraftSession(snapshot: NotebookDraftSessionSnapshot): void;
  setLexicalEditorState(snapshot: NotebookLexicalStateSnapshot): void;
  allocateChipId(): string;
  appendTargetReference(reference: EditorTargetReference): void;
  setInsertTargetReference(insertTargetReference: ((reference: EditorTargetReference) => void) | null): void;
  setSuffixSettings(settings: NotebookSuffixSettings): void;
  hydrateNoteFontSize(): Promise<void>;
  stepNoteFontSize(step: number): void;
  resetNoteFontSize(): void;
  setCopyStatus(copyStatus: CopyStatus): void;
  setFocusedTarget(target: EditorTarget | null): void;
  clearDraft(): void;
}

export interface NotebookLexicalStateSnapshot {
  draft: string;
  editorStateJson: string;
  activeChipTargets: ExportedChipTarget[];
  chipTargetMap: string;
  hasFallbackTargets: boolean;
  isNotebookEmpty: boolean;
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

async function writeStoredNoteFontSize(fontSize: number): Promise<void> {
  const storage = getChromeLocalStorage();
  if (!storage) {
    return;
  }

  try {
    await storage.set({ [NOTE_FONT_SIZE_STORAGE_KEY]: normalizeNoteFontSize(fontSize) });
  } catch {
    // Font-size persistence is best-effort so the editor remains usable if
    // extension storage is temporarily unavailable.
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
  noteFontSize: DEFAULT_NOTE_FONT_SIZE,
  copyStatus: 'idle',
  focusedTarget: null,
  insertTargetReference: null,
  hydrateDraftSession: (snapshot) => set({
    ...createPlainDraftState(snapshot.draft),
    editorStateJson: snapshot.editorStateJson,
    nextChipIndex: normalizeNextNotebookChipIndex(snapshot.nextChipIndex),
  }),
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
  appendTargetReference: (targetReference) => set(() => {
    const { target } = targetReference;

    // Visible notebook insertions are owned by the mounted Lexical editor via
    // insertTargetReference. If that callback is temporarily unavailable, avoid
    // falling back to the old raw `[fallback target]`/`[data-ai-id]` text format.
    return {
      focusedTarget: target,
    };
  }),
  setInsertTargetReference: (insertTargetReference) => set({ insertTargetReference }),
  setSuffixSettings: (suffixSettings) => set({
    suffixSettings: normalizeNotebookSuffixSettings(suffixSettings),
  }),
  hydrateNoteFontSize: async () => {
    set({ noteFontSize: await readStoredNoteFontSize() });
  },
  stepNoteFontSize: (step) => set((state) => {
    const noteFontSize = normalizeNoteFontSize(state.noteFontSize + step);
    void writeStoredNoteFontSize(noteFontSize);
    return { noteFontSize };
  }),
  resetNoteFontSize: () => {
    set({ noteFontSize: DEFAULT_NOTE_FONT_SIZE });
    void writeStoredNoteFontSize(DEFAULT_NOTE_FONT_SIZE);
  },
  setCopyStatus: (copyStatus) => set({ copyStatus }),
  setFocusedTarget: (focusedTarget) => set({ focusedTarget }),
  clearDraft: () => set({
    ...createPlainDraftState(''),
    focusedTarget: null,
    copyStatus: 'idle',
    nextChipIndex: FIRST_NOTEBOOK_CHIP_INDEX,
  }),
}));
