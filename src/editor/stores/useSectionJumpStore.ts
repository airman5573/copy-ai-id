import { create } from 'zustand';

import type { EditorTargetReference, QuickActionCategory } from '../../shared/editor-messages';

export type VisualPanelSectionId =
  | 'content'
  | 'layout'
  | 'spacing'
  | 'size'
  | 'style'
  | 'border';

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
  switch (category) {
    case 'content':
      return 'content';
    case 'layout':
      return 'layout';
    case 'spacing':
      return 'spacing';
    case 'size':
      return 'size';
    case 'style':
      return 'style';
    case 'border':
      return 'border';
    default:
      return exhaustiveQuickActionCategory(category);
  }
}

function exhaustiveQuickActionCategory(category: never): never {
  throw new Error(`Unsupported quick-action category: ${category}`);
}
