import { copyText } from './clipboard';
import type { CopyStatus } from '../types';
import { useNotebookStore } from '../stores/useNotebookStore';
import { useVisualEditStore } from '../stores/useVisualEditStore';
import { useFloatingNotePanelStore } from '../stores/useFloatingNotePanelStore';
import { buildNotebookExportMarkdown } from './export-markdown';

const COPY_STATUS_RESET_MS = 1200;
const FLOATING_NOTE_PANEL_CLOSE_AFTER_COPY_MS = 700;
let copyStatusResetTimer: number | null = null;
let floatingNotePanelCloseTimer: number | null = null;

export async function copyNotebookDraftFromStore(): Promise<CopyStatus> {
  const exportMarkdown = await buildNotebookExportMarkdown();
  if (!exportMarkdown) {
    setCopyStatusWithReset('empty');
    return 'empty';
  }

  const result = await copyText(exportMarkdown.markdown);
  if (!result.ok) {
    setCopyStatusWithReset('failed');
    return 'failed';
  }

  useNotebookStore.getState().clearDraft();
  useVisualEditStore.getState().clearVisualEdits();
  setCopyStatusWithReset('copied');
  scheduleFloatingNotePanelCloseAfterCopy();
  return 'copied';
}

export function clearNotebookCopyStatusReset(): void {
  if (copyStatusResetTimer !== null) {
    window.clearTimeout(copyStatusResetTimer);
    copyStatusResetTimer = null;
  }

  clearFloatingNotePanelCloseTimer();
}

function setCopyStatusWithReset(status: CopyStatus): void {
  clearNotebookCopyStatusReset();
  useNotebookStore.getState().setCopyStatus(status);
  copyStatusResetTimer = window.setTimeout(() => {
    useNotebookStore.getState().setCopyStatus('idle');
    copyStatusResetTimer = null;
  }, COPY_STATUS_RESET_MS);
}

function scheduleFloatingNotePanelCloseAfterCopy(): void {
  const floatingNotePanel = useFloatingNotePanelStore.getState();
  if (!floatingNotePanel.isOpen) {
    return;
  }

  const openedAt = floatingNotePanel.openedAt;
  const anchorUpdatedAt = floatingNotePanel.anchor?.updatedAt ?? null;

  floatingNotePanelCloseTimer = window.setTimeout(() => {
    floatingNotePanelCloseTimer = null;

    const currentFloatingNotePanel = useFloatingNotePanelStore.getState();
    if (
      currentFloatingNotePanel.isOpen
      && currentFloatingNotePanel.openedAt === openedAt
      && (currentFloatingNotePanel.anchor?.updatedAt ?? null) === anchorUpdatedAt
    ) {
      currentFloatingNotePanel.closePanel();
    }
  }, FLOATING_NOTE_PANEL_CLOSE_AFTER_COPY_MS);
}

function clearFloatingNotePanelCloseTimer(): void {
  if (floatingNotePanelCloseTimer !== null) {
    window.clearTimeout(floatingNotePanelCloseTimer);
    floatingNotePanelCloseTimer = null;
  }
}
