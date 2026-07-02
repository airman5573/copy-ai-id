import { create } from 'zustand';

import type { EditorTargetReference } from '../../shared/domain/targets';
import type { QuickActionCategory } from '../../shared/domain/visual';
import {
  QUICK_ACTION_SECTION_IDS,
  type VisualPanelSectionId,
} from '../components/visual/sectionJump';

export type { VisualPanelSectionId } from '../components/visual/sectionJump';

export interface VisualPanelSectionJumpRequest extends EditorTargetReference {
  id: number;
  category: QuickActionCategory;
  sectionId: VisualPanelSectionId;
  requestedAt: number;
}

interface SectionJumpStateSnapshot {
  pendingJump: VisualPanelSectionJumpRequest | null;
  lastConsumedJumpId: number | null;
  nextJumpId: number;
}

interface SectionJumpStore extends SectionJumpStateSnapshot {
  queueSectionJump(input: Omit<VisualPanelSectionJumpRequest, 'id' | 'requestedAt'>): VisualPanelSectionJumpRequest;
  consumeSectionJump(id?: number): void;
  clearSectionJump(): void;
  resetSectionJumpStore(): void;
}

const initialSectionJumpState: SectionJumpStateSnapshot = {
  pendingJump: null,
  lastConsumedJumpId: null,
  nextJumpId: 1,
};

export const useSectionJumpStore = create<SectionJumpStore>((set, get) => ({
  ...initialSectionJumpState,
  queueSectionJump: (input) => {
    const id = get().nextJumpId;
    const request: VisualPanelSectionJumpRequest = {
      ...input,
      id,
      requestedAt: Date.now(),
    };

    set({
      pendingJump: request,
      nextJumpId: id + 1,
    });

    return request;
  },
  consumeSectionJump: (id) => set((state) => {
    const pendingId = state.pendingJump?.id ?? null;
    const consumedId = id ?? pendingId;

    return {
      pendingJump: id === undefined || id === pendingId ? null : state.pendingJump,
      lastConsumedJumpId: consumedId,
    };
  }),
  clearSectionJump: () => set({ pendingJump: null }),
  resetSectionJumpStore: () => set({ ...initialSectionJumpState }),
}));

export function quickActionCategoryToSectionId(category: QuickActionCategory): VisualPanelSectionId {
  return QUICK_ACTION_SECTION_IDS[category];
}
