import { create } from 'zustand';

import type {
  BridgeViewportRect,
  BridgeViewportSize,
} from '../../shared/domain/geometry';
import type { EditorTargetReference } from '../../shared/domain/targets';
import type { EditorViewportRect } from '../bridge/geometry';

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
  isOpen: boolean;
  anchor: FloatingNotePanelAnchor | null;
  openedAt: number | null;
  updatedAt: number | null;
}

interface FloatingNotePanelStore extends FloatingNotePanelStateSnapshot {
  openPanel(): void;
  openNearTarget(input: FloatingNotePanelAnchorInput): void;
  updateAnchorRects(rects: Pick<FloatingNotePanelAnchor, 'elementRect' | 'editorRect'> & {
    viewport?: BridgeViewportSize | null;
  }): void;
  closePanel(): void;
  resetFloatingNotePanelRuntime(): void;
}

const initialFloatingNotePanelState: FloatingNotePanelStateSnapshot = {
  isOpen: false,
  anchor: null,
  openedAt: null,
  updatedAt: null,
};

export const useFloatingNotePanelStore = create<FloatingNotePanelStore>((set) => ({
  ...initialFloatingNotePanelState,
  openPanel: () => {
    const now = Date.now();
    // Anchor-less open (e.g. the toolbar note button): clearing the anchor
    // makes FloatingNotePanel fall back to its default placement near the
    // preview frame instead of reusing a stale element anchor.
    set((state) => ({
      isOpen: true,
      anchor: null,
      openedAt: state.isOpen ? state.openedAt : now,
      updatedAt: now,
    }));
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
    // Keep the last anchor while the closed shell fades out. Clearing it here
    // makes FloatingNotePanel recompute from its fallback anchor mid-transition,
    // which can visibly jump the note panel toward the viewport center.
    openedAt: null,
    updatedAt: Date.now(),
  }),
  resetFloatingNotePanelRuntime: () => set({
    ...initialFloatingNotePanelState,
  }),
}));
