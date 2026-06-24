import { create } from 'zustand';

import {
  BREAKPOINT_ORDER,
  breakpointById,
  type BreakpointId,
} from '../../shared/breakpoints';

export const CANVAS_ZOOM_STEP = 0.1;
export const MIN_ZOOM = 0.25;
export const MAX_ZOOM = 2;
export const DEFAULT_ZOOM = 1;
export const DEFAULT_PREVIEW_HEIGHT = 720;
export const DEFAULT_PREVIEW_WIDTH = 1024;
export const MIN_PREVIEW_HEIGHT = 720;
export const MAX_PREVIEW_HEIGHT = 2000;
export const MIN_PREVIEW_WIDTH = 320;
export const MAX_PREVIEW_WIDTH = 2560;
const PREVIEW_STAGE_HORIZONTAL_PADDING = 64;
const PREVIEW_STAGE_VERTICAL_PADDING = 64;
export const PREVIEW_HEIGHT_RESIZE_HANDLE_OUTSET = 28;
export const PREVIEW_WIDTH_RESIZE_HANDLE_OUTSET = 28;
const PREVIEW_HEIGHT_STORAGE_KEY = 'copy-ai-id:preview-height:v1';
const PREVIEW_VIEWPORT_STORAGE_KEY = 'copy-ai-id:preview-viewport:v1';

export type PreviewViewportMode = 'breakpoint' | 'custom';

interface StoredPreviewViewport {
  viewportMode: PreviewViewportMode;
  customPreviewWidth: number;
}

export interface ActiveCanvasZoomState {
  activeBreakpointId: BreakpointId;
  zoomById: Record<BreakpointId, number>;
}

interface BreakpointStore {
  activeBreakpointId: BreakpointId;
  viewportMode: PreviewViewportMode;
  customPreviewWidth: number;
  previewHeight: number;
  zoomById: Record<BreakpointId, number>;
  setBreakpoint(id: BreakpointId): void;
  setCustomPreviewWidth(width: number): void;
  setPreviewHeight(height: number): void;
  setZoom(zoom: number): void;
  stepZoom(step?: number): void;
  fitZoom(availableStageWidth?: number, availableStageHeight?: number): void;
  hydratePreviewHeight(): Promise<void>;
  persistCustomPreviewWidth(width?: number): Promise<void>;
  persistPreviewHeight(height?: number): Promise<void>;
  resetZoom(): void;
}

export function normalizeZoom(value: number): number {
  if (!Number.isFinite(value)) {
    return DEFAULT_ZOOM;
  }

  return Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, Math.round(value * 100) / 100));
}

export function normalizePreviewHeight(value: number): number {
  if (!Number.isFinite(value)) {
    return DEFAULT_PREVIEW_HEIGHT;
  }

  return Math.min(
    MAX_PREVIEW_HEIGHT,
    Math.max(MIN_PREVIEW_HEIGHT, Math.round(value)),
  );
}

export function normalizePreviewWidth(value: number): number {
  if (!Number.isFinite(value)) {
    return DEFAULT_PREVIEW_WIDTH;
  }

  return Math.min(
    MAX_PREVIEW_WIDTH,
    Math.max(MIN_PREVIEW_WIDTH, Math.round(value)),
  );
}

function createZoomRecord(): Record<BreakpointId, number> {
  return Object.fromEntries(
    BREAKPOINT_ORDER.map((id) => [id, DEFAULT_ZOOM]),
  ) as Record<BreakpointId, number>;
}

export function getActiveCanvasZoom(state: ActiveCanvasZoomState): number {
  return normalizeZoom(state.zoomById[state.activeBreakpointId] ?? DEFAULT_ZOOM);
}

function getChromeLocalStorage(): chrome.storage.LocalStorageArea | null {
  if (typeof chrome === 'undefined' || typeof chrome.storage?.local === 'undefined') {
    return null;
  }

  return chrome.storage.local;
}

async function readStoredPreviewHeight(): Promise<number> {
  const storage = getChromeLocalStorage();
  if (!storage) {
    return DEFAULT_PREVIEW_HEIGHT;
  }

  try {
    const result = await storage.get(PREVIEW_HEIGHT_STORAGE_KEY);
    return normalizePreviewHeight(Number(result[PREVIEW_HEIGHT_STORAGE_KEY]));
  } catch {
    return DEFAULT_PREVIEW_HEIGHT;
  }
}

async function readStoredPreviewViewport(): Promise<StoredPreviewViewport> {
  const storage = getChromeLocalStorage();
  if (!storage) {
    return {
      viewportMode: 'breakpoint',
      customPreviewWidth: DEFAULT_PREVIEW_WIDTH,
    };
  }

  try {
    const result = await storage.get(PREVIEW_VIEWPORT_STORAGE_KEY);
    const storedValue = result[PREVIEW_VIEWPORT_STORAGE_KEY];

    if (!storedValue || typeof storedValue !== 'object') {
      return {
        viewportMode: 'breakpoint',
        customPreviewWidth: DEFAULT_PREVIEW_WIDTH,
      };
    }

    const storedRecord = storedValue as Partial<StoredPreviewViewport>;

    return {
      viewportMode: storedRecord.viewportMode === 'custom' ? 'custom' : 'breakpoint',
      customPreviewWidth: normalizePreviewWidth(Number(storedRecord.customPreviewWidth)),
    };
  } catch {
    return {
      viewportMode: 'breakpoint',
      customPreviewWidth: DEFAULT_PREVIEW_WIDTH,
    };
  }
}

async function writeStoredPreviewHeight(height: number): Promise<void> {
  const storage = getChromeLocalStorage();
  if (!storage) {
    return;
  }

  try {
    await storage.set({ [PREVIEW_HEIGHT_STORAGE_KEY]: normalizePreviewHeight(height) });
  } catch {
    // Preview height persistence is best-effort so resizing remains usable if
    // extension storage is temporarily unavailable.
  }
}

async function writeStoredPreviewViewport(viewport: StoredPreviewViewport): Promise<void> {
  const storage = getChromeLocalStorage();
  if (!storage) {
    return;
  }

  try {
    await storage.set({
      [PREVIEW_VIEWPORT_STORAGE_KEY]: {
        viewportMode: viewport.viewportMode,
        customPreviewWidth: normalizePreviewWidth(viewport.customPreviewWidth),
      },
    });
  } catch {
    // Preview viewport persistence is best-effort so resizing remains usable if
    // extension storage is temporarily unavailable.
  }
}

function getActivePreviewWidth(state: Pick<BreakpointStore, 'activeBreakpointId' | 'customPreviewWidth' | 'viewportMode'>): number {
  if (state.viewportMode === 'custom') {
    return normalizePreviewWidth(state.customPreviewWidth);
  }

  return breakpointById(state.activeBreakpointId).width;
}

export const useBreakpointStore = create<BreakpointStore>((set, get) => ({
  activeBreakpointId: 'desktop',
  viewportMode: 'breakpoint',
  customPreviewWidth: DEFAULT_PREVIEW_WIDTH,
  previewHeight: DEFAULT_PREVIEW_HEIGHT,
  zoomById: createZoomRecord(),
  setBreakpoint: (activeBreakpointId) => {
    set({ activeBreakpointId, viewportMode: 'breakpoint' });
    void writeStoredPreviewViewport({
      viewportMode: 'breakpoint',
      customPreviewWidth: get().customPreviewWidth,
    });
  },
  setCustomPreviewWidth: (width) => {
    set({
      viewportMode: 'custom',
      customPreviewWidth: normalizePreviewWidth(width),
    });
  },
  setPreviewHeight: (height) => set({ previewHeight: normalizePreviewHeight(height) }),
  setZoom: (zoom) => set((state) => ({
    zoomById: {
      ...state.zoomById,
      [state.activeBreakpointId]: normalizeZoom(zoom),
    },
  })),
  stepZoom: (step = CANVAS_ZOOM_STEP) => {
    const state = get();
    const safeStep = Number.isFinite(step) ? step : CANVAS_ZOOM_STEP;
    state.setZoom(state.zoomById[state.activeBreakpointId] + safeStep);
  },
  fitZoom: (availableStageWidth, availableStageHeight) => {
    const state = get();
    const width = getActivePreviewWidth(state);
    const visualWidth = width + (PREVIEW_WIDTH_RESIZE_HANDLE_OUTSET * 2);
    const visualHeight = state.previewHeight + PREVIEW_HEIGHT_RESIZE_HANDLE_OUTSET;
    const stageWidth = Number.isFinite(availableStageWidth)
      ? Number(availableStageWidth)
      : visualWidth + PREVIEW_STAGE_HORIZONTAL_PADDING;
    const stageHeight = Number.isFinite(availableStageHeight)
      ? Number(availableStageHeight)
      : visualHeight + PREVIEW_STAGE_VERTICAL_PADDING;
    const availableWidth = Math.max(1, stageWidth - PREVIEW_STAGE_HORIZONTAL_PADDING);
    const availableHeight = Math.max(1, stageHeight - PREVIEW_STAGE_VERTICAL_PADDING);
    const fitZoomValue = Math.min(availableWidth / visualWidth, availableHeight / visualHeight);
    state.setZoom(Math.floor(fitZoomValue * 100) / 100);
  },
  hydratePreviewHeight: async () => {
    const [previewHeight, previewViewport] = await Promise.all([
      readStoredPreviewHeight(),
      readStoredPreviewViewport(),
    ]);
    set({
      previewHeight,
      viewportMode: previewViewport.viewportMode,
      customPreviewWidth: previewViewport.customPreviewWidth,
    });
  },
  persistCustomPreviewWidth: async (width) => {
    const customPreviewWidth = normalizePreviewWidth(width ?? get().customPreviewWidth);
    set({
      viewportMode: 'custom',
      customPreviewWidth,
    });
    await writeStoredPreviewViewport({
      viewportMode: 'custom',
      customPreviewWidth,
    });
  },
  persistPreviewHeight: async (height) => {
    const previewHeight = normalizePreviewHeight(height ?? get().previewHeight);
    set({ previewHeight });
    await writeStoredPreviewHeight(previewHeight);
  },
  resetZoom: () => {
    const state = get();
    state.setZoom(DEFAULT_ZOOM);
  },
}));
