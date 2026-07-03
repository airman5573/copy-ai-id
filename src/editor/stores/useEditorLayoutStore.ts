import { create } from 'zustand';

const EDITOR_PANEL_LAYOUT_STORAGE_KEY = 'copy-ai-id:editor-panel-layout:v1';

export const DEFAULT_NOTE_PANEL_WIDTH = 360;
export const MIN_NOTE_PANEL_WIDTH = 320;
export const MAX_NOTE_PANEL_WIDTH = 640;

interface StoredEditorPanelLayout {
  notePanelWidth: number;
}

interface EditorLayoutStore {
  notePanelWidth: number;
  hydratePanelLayout(): Promise<void>;
  setNotePanelWidth(width: number): void;
  persistPanelLayout(widths?: Partial<StoredEditorPanelLayout>): Promise<void>;
}

function getChromeLocalStorage(): chrome.storage.LocalStorageArea | null {
  if (typeof chrome === 'undefined' || typeof chrome.storage?.local === 'undefined') {
    return null;
  }

  return chrome.storage.local;
}

function normalizePanelWidth(value: number, min: number, max: number, fallback: number): number {
  if (!Number.isFinite(value)) {
    return fallback;
  }

  return Math.min(max, Math.max(min, Math.round(value)));
}

export function normalizeNotePanelWidth(value: number): number {
  return normalizePanelWidth(
    value,
    MIN_NOTE_PANEL_WIDTH,
    MAX_NOTE_PANEL_WIDTH,
    DEFAULT_NOTE_PANEL_WIDTH,
  );
}

async function readStoredEditorPanelLayout(): Promise<StoredEditorPanelLayout> {
  const fallback = { notePanelWidth: DEFAULT_NOTE_PANEL_WIDTH };
  const storage = getChromeLocalStorage();
  if (!storage) {
    return fallback;
  }

  try {
    const result = await storage.get(EDITOR_PANEL_LAYOUT_STORAGE_KEY);
    const storedValue = result[EDITOR_PANEL_LAYOUT_STORAGE_KEY];

    if (!storedValue || typeof storedValue !== 'object') {
      return fallback;
    }

    const storedRecord = storedValue as Partial<StoredEditorPanelLayout>;

    return {
      notePanelWidth: normalizeNotePanelWidth(Number(storedRecord.notePanelWidth)),
    };
  } catch {
    return fallback;
  }
}

async function writeStoredEditorPanelLayout(layout: StoredEditorPanelLayout): Promise<void> {
  const storage = getChromeLocalStorage();
  if (!storage) {
    return;
  }

  try {
    await storage.set({
      [EDITOR_PANEL_LAYOUT_STORAGE_KEY]: {
        notePanelWidth: normalizeNotePanelWidth(layout.notePanelWidth),
      },
    });
  } catch {
    // Layout persistence is best-effort so the editor remains usable if
    // extension storage is temporarily unavailable.
  }
}

export const useEditorLayoutStore = create<EditorLayoutStore>((set) => ({
  notePanelWidth: DEFAULT_NOTE_PANEL_WIDTH,
  hydratePanelLayout: async () => {
    set(await readStoredEditorPanelLayout());
  },
  setNotePanelWidth: (notePanelWidth) => {
    set({ notePanelWidth: normalizeNotePanelWidth(notePanelWidth) });
  },
  persistPanelLayout: async (widths) => {
    const state = useEditorLayoutStore.getState();
    const layout = {
      notePanelWidth: normalizeNotePanelWidth(widths?.notePanelWidth ?? state.notePanelWidth),
    };
    set(layout);
    await writeStoredEditorPanelLayout(layout);
  },
}));
