import { create } from 'zustand';

const LAYOUT_TREE_COLLAPSED_STORAGE_KEY = 'copy-ai-id:layout-tree-collapsed:v1';
const EDITOR_PANEL_LAYOUT_STORAGE_KEY = 'copy-ai-id:editor-panel-layout:v1';

export const DEFAULT_LAYOUT_TREE_PANEL_WIDTH = 300;
export const MIN_LAYOUT_TREE_PANEL_WIDTH = 240;
export const MAX_LAYOUT_TREE_PANEL_WIDTH = 560;
export const DEFAULT_NOTE_PANEL_WIDTH = 360;
export const MIN_NOTE_PANEL_WIDTH = 320;
export const MAX_NOTE_PANEL_WIDTH = 640;

interface StoredEditorPanelLayout {
  layoutTreePanelWidth: number;
  notePanelWidth: number;
}

interface EditorLayoutStore {
  layoutTreeCollapsed: boolean;
  layoutTreePanelWidth: number;
  notePanelWidth: number;
  hydrateLayoutTreeCollapsed(): Promise<void>;
  hydratePanelLayout(): Promise<void>;
  setLayoutTreeCollapsed(collapsed: boolean): void;
  setLayoutTreePanelWidth(width: number): void;
  setNotePanelWidth(width: number): void;
  persistPanelLayout(widths?: Partial<StoredEditorPanelLayout>): Promise<void>;
}

function getChromeLocalStorage(): chrome.storage.LocalStorageArea | null {
  if (typeof chrome === 'undefined' || typeof chrome.storage?.local === 'undefined') {
    return null;
  }

  return chrome.storage.local;
}

async function readStoredLayoutTreeCollapsed(): Promise<boolean> {
  const storage = getChromeLocalStorage();
  if (!storage) {
    return true;
  }

  try {
    const result = await storage.get(LAYOUT_TREE_COLLAPSED_STORAGE_KEY);
    return result[LAYOUT_TREE_COLLAPSED_STORAGE_KEY] === false ? false : true;
  } catch {
    return true;
  }
}

async function writeStoredLayoutTreeCollapsed(collapsed: boolean): Promise<void> {
  const storage = getChromeLocalStorage();
  if (!storage) {
    return;
  }

  try {
    await storage.set({ [LAYOUT_TREE_COLLAPSED_STORAGE_KEY]: collapsed });
  } catch {
    // Layout persistence is best-effort so the editor remains usable if
    // extension storage is temporarily unavailable.
  }
}

function normalizePanelWidth(value: number, min: number, max: number, fallback: number): number {
  if (!Number.isFinite(value)) {
    return fallback;
  }

  return Math.min(max, Math.max(min, Math.round(value)));
}

export function normalizeLayoutTreePanelWidth(value: number): number {
  return normalizePanelWidth(
    value,
    MIN_LAYOUT_TREE_PANEL_WIDTH,
    MAX_LAYOUT_TREE_PANEL_WIDTH,
    DEFAULT_LAYOUT_TREE_PANEL_WIDTH,
  );
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
  const fallback = {
    layoutTreePanelWidth: DEFAULT_LAYOUT_TREE_PANEL_WIDTH,
    notePanelWidth: DEFAULT_NOTE_PANEL_WIDTH,
  };
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
      layoutTreePanelWidth: normalizeLayoutTreePanelWidth(Number(storedRecord.layoutTreePanelWidth)),
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
        layoutTreePanelWidth: normalizeLayoutTreePanelWidth(layout.layoutTreePanelWidth),
        notePanelWidth: normalizeNotePanelWidth(layout.notePanelWidth),
      },
    });
  } catch {
    // Layout persistence is best-effort so the editor remains usable if
    // extension storage is temporarily unavailable.
  }
}

export const useEditorLayoutStore = create<EditorLayoutStore>((set) => ({
  layoutTreeCollapsed: true,
  layoutTreePanelWidth: DEFAULT_LAYOUT_TREE_PANEL_WIDTH,
  notePanelWidth: DEFAULT_NOTE_PANEL_WIDTH,
  hydrateLayoutTreeCollapsed: async () => {
    set({ layoutTreeCollapsed: await readStoredLayoutTreeCollapsed() });
  },
  hydratePanelLayout: async () => {
    set(await readStoredEditorPanelLayout());
  },
  setLayoutTreeCollapsed: (layoutTreeCollapsed) => {
    set({ layoutTreeCollapsed });
    void writeStoredLayoutTreeCollapsed(layoutTreeCollapsed);
  },
  setLayoutTreePanelWidth: (layoutTreePanelWidth) => {
    set({ layoutTreePanelWidth: normalizeLayoutTreePanelWidth(layoutTreePanelWidth) });
  },
  setNotePanelWidth: (notePanelWidth) => {
    set({ notePanelWidth: normalizeNotePanelWidth(notePanelWidth) });
  },
  persistPanelLayout: async (widths) => {
    const state = useEditorLayoutStore.getState();
    const layout = {
      layoutTreePanelWidth: normalizeLayoutTreePanelWidth(
        widths?.layoutTreePanelWidth ?? state.layoutTreePanelWidth,
      ),
      notePanelWidth: normalizeNotePanelWidth(widths?.notePanelWidth ?? state.notePanelWidth),
    };
    set(layout);
    await writeStoredEditorPanelLayout(layout);
  },
}));
