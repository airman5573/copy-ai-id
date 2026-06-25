import { create } from 'zustand';

const LAYOUT_TREE_COLLAPSED_STORAGE_KEY = 'copy-ai-id:layout-tree-collapsed:v1';

interface EditorLayoutStore {
  layoutTreeCollapsed: boolean;
  hydrateLayoutTreeCollapsed(): Promise<void>;
  setLayoutTreeCollapsed(collapsed: boolean): void;
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

export const useEditorLayoutStore = create<EditorLayoutStore>((set) => ({
  layoutTreeCollapsed: true,
  hydrateLayoutTreeCollapsed: async () => {
    set({ layoutTreeCollapsed: await readStoredLayoutTreeCollapsed() });
  },
  setLayoutTreeCollapsed: (layoutTreeCollapsed) => {
    set({ layoutTreeCollapsed });
    void writeStoredLayoutTreeCollapsed(layoutTreeCollapsed);
  },
}));
