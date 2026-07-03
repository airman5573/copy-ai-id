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
export const MAX_PREVIEW_HEIGHT = 2000;
export const DEFAULT_PREVIEW_HEIGHT = MAX_PREVIEW_HEIGHT;
export const DEFAULT_PREVIEW_WIDTH = 1920;
export const MIN_PREVIEW_WIDTH = 320;
export const MAX_PREVIEW_WIDTH = 2560;
export const PREVIEW_WIDTH_RESIZE_HANDLE_OUTSET = 28;
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

export interface FitZoomOptions {
  /**
   * Cap the fitted zoom at 100%. Viewport switches use this so narrow
   * breakpoints render at natural size; the explicit Fit button omits it and
   * may zoom in to fill the stage.
   */
  fitDownOnly?: boolean;
}

interface BreakpointStore {
  activeBreakpointId: BreakpointId;
  viewportMode: PreviewViewportMode;
  customPreviewWidth: number;
  previewHeight: number;
  zoomById: Record<BreakpointId, number>;
  setBreakpoint(id: BreakpointId): void;
  setCustomPreviewWidth(width: number): void;
  setZoom(zoom: number): void;
  stepZoom(step?: number): void;
  fitZoom(availableStageWidth?: number, availableStageHeight?: number, options?: FitZoomOptions): void;
  resetPreviewToStage(availableStageWidth?: number, availableStageHeight?: number): void;
  hydratePreviewHeight(): Promise<void>;
  persistCustomPreviewWidth(width?: number): Promise<void>;
  resetZoom(): void;
}

export function normalizeZoom(value: number): number {
  if (!Number.isFinite(value)) {
    return DEFAULT_ZOOM;
  }

  return Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, Math.round(value * 100) / 100));
}

export function normalizePreviewHeight(_value: number): number {
  return MAX_PREVIEW_HEIGHT;
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

function getStageFillingPreviewWidth(availableStageWidth?: number): number {
  if (!Number.isFinite(availableStageWidth)) {
    return DEFAULT_PREVIEW_WIDTH;
  }

  return normalizePreviewWidth(
    Math.max(
      MIN_PREVIEW_WIDTH,
      Math.floor(Number(availableStageWidth) - (PREVIEW_WIDTH_RESIZE_HANDLE_OUTSET * 2)),
    ),
  );
}

function getStageResetZoom(
  previewWidth: number,
  _previewHeight: number,
  availableStageWidth?: number,
  _availableStageHeight?: number,
): number {
  if (!Number.isFinite(availableStageWidth)) {
    return DEFAULT_ZOOM;
  }

  const visualWidth = previewWidth + (PREVIEW_WIDTH_RESIZE_HANDLE_OUTSET * 2);
  const availableWidth = Math.max(1, Number(availableStageWidth));
  const fitDownZoom = Math.min(DEFAULT_ZOOM, availableWidth / visualWidth);

  return normalizeZoom(Math.floor(fitDownZoom * 100) / 100);
}

export const useBreakpointStore = create<BreakpointStore>((set, get) => ({
  activeBreakpointId: 'desktop1920',
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
  fitZoom: (availableStageWidth, _availableStageHeight, options) => {
    const state = get();
    const width = getActivePreviewWidth(state);
    const visualWidth = width + (PREVIEW_WIDTH_RESIZE_HANDLE_OUTSET * 2);
    const stageWidth = Number.isFinite(availableStageWidth)
      ? Number(availableStageWidth)
      : visualWidth;
    const availableWidth = Math.max(1, stageWidth);
    // Fit by width only. Long previews should scroll vertically instead of
    // forcing the entire fixed-height iframe to shrink.
    const fitZoomValue = availableWidth / visualWidth;
    const boundedFitZoom = options?.fitDownOnly
      ? Math.min(DEFAULT_ZOOM, fitZoomValue)
      : fitZoomValue;
    state.setZoom(Math.floor(boundedFitZoom * 100) / 100);
  },
  resetPreviewToStage: (availableStageWidth, availableStageHeight) => {
    const previewWidth = getStageFillingPreviewWidth(availableStageWidth);
    const previewHeight = MAX_PREVIEW_HEIGHT;
    const zoom = getStageResetZoom(previewWidth, previewHeight, availableStageWidth, availableStageHeight);

    set((state) => ({
      viewportMode: 'custom',
      customPreviewWidth: previewWidth,
      previewHeight,
      zoomById: {
        ...state.zoomById,
        [state.activeBreakpointId]: zoom,
      },
    }));
  },
  hydratePreviewHeight: async () => {
    const previewViewport = await readStoredPreviewViewport();
    set({
      previewHeight: MAX_PREVIEW_HEIGHT,
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
  resetZoom: () => {
    const state = get();
    state.setZoom(DEFAULT_ZOOM);
  },
}));
