import { getCurrentMessages } from '../shared/i18n';
import { useToastStore, type EditorToastTone } from './stores/useToastStore';

const TOAST_RESET_MS = 1600;
let toastResetTimer: number | null = null;

export function showMissingDataAiIdToast(): void {
  showEditorToast(getCurrentMessages().editor.missingDataAiId, 'error');
}

export function showStaleFallbackTargetToast(): void {
  showEditorToast(getCurrentMessages().editor.staleFallbackTarget, 'error');
}

export function showEditorToast(message: string, tone: EditorToastTone = 'info'): void {
  clearEditorToastReset();
  useToastStore.getState().showToast(message, tone);
  toastResetTimer = window.setTimeout(() => {
    useToastStore.getState().clearToast();
    toastResetTimer = null;
  }, TOAST_RESET_MS);
}

export function clearEditorToastReset(): void {
  if (toastResetTimer !== null) {
    window.clearTimeout(toastResetTimer);
    toastResetTimer = null;
  }
}
