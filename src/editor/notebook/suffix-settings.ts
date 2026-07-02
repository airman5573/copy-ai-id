import {
  normalizeNotebookBreakpointScopes,
  type NotebookBreakpointScope,
} from './breakpoint-scope';
import { getDefaultNotebookTargetElementNotice } from './notebook-notice';

export type NotebookBreakpointScopeSelectionMode = 'all' | 'manual';

export interface NotebookSuffixSettings {
  breakpointMode: NotebookBreakpointScopeSelectionMode;
  breakpointScopes: NotebookBreakpointScope[];
  tailwindEnabled: boolean;
  targetNotice: string;
}

export const DEFAULT_NOTEBOOK_SUFFIX_SETTINGS: NotebookSuffixSettings = {
  breakpointMode: 'all',
  breakpointScopes: [],
  tailwindEnabled: false,
  targetNotice: getDefaultNotebookTargetElementNotice(),
};

function normalizeTargetNotice(value: unknown): string {
  return typeof value === 'string' ? value : getDefaultNotebookTargetElementNotice();
}

function normalizeBreakpointMode(value: unknown): NotebookBreakpointScopeSelectionMode {
  return value === 'manual' ? 'manual' : 'all';
}

export function normalizeNotebookSuffixSettings(value: unknown): NotebookSuffixSettings {
  if (!value || typeof value !== 'object') {
    return { ...DEFAULT_NOTEBOOK_SUFFIX_SETTINGS };
  }

  const valueRecord = value as Record<string, unknown>;
  const breakpointMode = normalizeBreakpointMode(valueRecord.breakpointMode);
  const breakpointScopes = Array.isArray(valueRecord.breakpointScopes)
    ? normalizeNotebookBreakpointScopes(valueRecord.breakpointScopes)
    : [];

  const targetNotice = normalizeTargetNotice(valueRecord.targetNotice);

  if (breakpointMode !== 'manual' || breakpointScopes.length === 0) {
    return {
      breakpointMode: 'all',
      breakpointScopes: [],
      tailwindEnabled: valueRecord.tailwindEnabled === true,
      targetNotice,
    };
  }

  return {
    breakpointMode: 'manual',
    breakpointScopes,
    tailwindEnabled: valueRecord.tailwindEnabled === true,
    targetNotice,
  };
}
