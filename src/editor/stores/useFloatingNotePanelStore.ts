import { create } from 'zustand';

import type {
  BridgeViewportRect,
  BridgeViewportSize,
  EditorTargetReference,
} from '../../shared/editor-messages';
import type { EditorViewportRect } from '../bridge/geometry';

const NOTE_PANEL_FLOATING_ENABLED_STORAGE_KEY = 'copy-ai-id:note-panel-floating-enabled:v1';

export interface FloatingNotePanelAnchor extends EditorTargetReference {
  elementRect: BridgeViewportRect | null;
  editorRect: EditorViewportRect | null;
  viewport: BridgeViewportSize | null;
  updatedAt: number;
}

export interface FloatingNotePanelAnchorInput extends EditorTargetReference {
  elementRect?: BridgeViewportRect | null;
  editorRect?: EditorViewportRect | null;
  viewport?: BridgeViewportSize | null;
}

interface FloatingNotePanelStateSnapshot {
  enabled: boolean;
  isOpen: boolean;
  anchor: FloatingNotePanelAnchor | null;
  openedAt: number | null;
  updatedAt: number | null;
}

interface FloatingNotePanelStore extends FloatingNotePanelStateSnapshot {
  hydrateEnabled(): Promise<void>;
  setEnabled(enabled: boolean): void;
  toggleEnabled(): void;
  openNearTarget(input: FloatingNotePanelAnchorInput): void;
  updateAnchorRects(rects: Pick<FloatingNotePanelAnchor, 'elementRect' | 'editorRect'> & {
    viewport?: BridgeViewportSize | null;
  }): void;
  closePanel(): void;
  resetFloatingNotePanelRuntime(): void;
}

const initialFloatingNotePanelState: FloatingNotePanelStateSnapshot = {
  enabled: false,
  isOpen: false,
  anchor: null,
  openedAt: null,
  updatedAt: null,
};

function getChromeLocalStorage(): chrome.storage.LocalStorageArea | null {
  if (typeof chrome === 'undefined' || typeof chrome.storage?.local === 'undefined') {
    return null;
  }

  return chrome.storage.local;
}

async function readStoredFloatingEnabled(): Promise<boolean> {
  const storage = getChromeLocalStorage();
  if (!storage) {
    return false;
  }

  try {
    const result = await storage.get(NOTE_PANEL_FLOATING_ENABLED_STORAGE_KEY);
    return result[NOTE_PANEL_FLOATING_ENABLED_STORAGE_KEY] === true;
  } catch {
    return false;
  }
}

async function writeStoredFloatingEnabled(enabled: boolean): Promise<void> {
  const storage = getChromeLocalStorage();
  if (!storage) {
    return;
  }

  try {
    await storage.set({ [NOTE_PANEL_FLOATING_ENABLED_STORAGE_KEY]: enabled });
  } catch {
    // Floating mode persistence is best-effort so the editor remains usable if
    // extension storage is temporarily unavailable.
  }
}

export const useFloatingNotePanelStore = create<FloatingNotePanelStore>((set, get) => ({
  ...initialFloatingNotePanelState,
  hydrateEnabled: async () => {
    const enabled = await readStoredFloatingEnabled();
    set((state) => ({
      enabled,
      isOpen: enabled ? state.isOpen : false,
      anchor: enabled ? state.anchor : null,
      openedAt: enabled ? state.openedAt : null,
      updatedAt: Date.now(),
    }));
  },
  setEnabled: (enabled) => {
    const now = Date.now();
    set((state) => ({
      enabled,
      isOpen: enabled ? state.isOpen : false,
      anchor: enabled ? state.anchor : null,
      openedAt: enabled ? state.openedAt : null,
      updatedAt: now,
    }));
    void writeStoredFloatingEnabled(enabled);
  },
  toggleEnabled: () => {
    get().setEnabled(!get().enabled);
  },
  openNearTarget: (input) => {
    const now = Date.now();
    set((state) => ({
      isOpen: true,
      anchor: {
        target: input.target,
        nodeId: input.nodeId,
        elementRect: input.elementRect ?? null,
        editorRect: input.editorRect ?? null,
        viewport: input.viewport ?? null,
        updatedAt: now,
      },
      openedAt: state.isOpen ? state.openedAt : now,
      updatedAt: now,
    }));
  },
  updateAnchorRects: (rects) => set((state) => {
    if (!state.anchor) {
      return state;
    }

    const now = Date.now();
    return {
      anchor: {
        ...state.anchor,
        elementRect: rects.elementRect,
        editorRect: rects.editorRect,
        viewport: rects.viewport ?? state.anchor.viewport,
        updatedAt: now,
      },
      updatedAt: now,
    };
  }),
  closePanel: () => set({
    isOpen: false,
    anchor: null,
    openedAt: null,
    updatedAt: Date.now(),
  }),
  resetFloatingNotePanelRuntime: () => set((state) => ({
    enabled: state.enabled,
    isOpen: false,
    anchor: null,
    openedAt: null,
    updatedAt: null,
  })),
}));
