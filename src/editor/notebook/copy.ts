import { copyText } from '../../content/clipboard/clipboard';
import type { CopyStatus } from '../types';
import { useNotebookStore } from '../stores/useNotebookStore';
import { useVisualEditStore } from '../stores/useVisualEditStore';
import { formatNotebookCopyBody } from './lexical/chip-export';
import { appendNotebookSuffixes } from './format';
import {
  appendVisualEditsSection,
  getVisualOnlyNotebookRequestText,
  hasAiIdVisualEditTargets,
  hasFallbackVisualEditTargets,
} from './visual-edits-export';

const COPY_STATUS_RESET_MS = 1200;
let copyStatusResetTimer: number | null = null;

export async function copyNotebookDraftFromStore(): Promise<CopyStatus> {
  const notebook = useNotebookStore.getState();
  const visualEditStore = useVisualEditStore.getState();
  const visualEditRecords = visualEditStore.getExportableRecords();
  const hasVisualEdits = visualEditRecords.length > 0;
  const trimmedDraft = notebook.draft.trim();
  const hasNotebookDraft = !notebook.isNotebookEmpty && trimmedDraft.length > 0;

  if (!hasNotebookDraft && !hasVisualEdits) {
    setCopyStatusWithReset('empty');
    return 'empty';
  }

  const notebookRequest = hasNotebookDraft
    ? trimmedDraft
    : getVisualOnlyNotebookRequestText();
  const copiedBody = formatNotebookCopyBody(notebookRequest, notebook.activeChipTargets);
  const hasAiIdTargets = notebook.activeChipTargets.some((chip) => chip.target.kind === 'ai-id')
    || hasAiIdVisualEditTargets(visualEditRecords);
  const hasFallbackTargets = notebook.hasFallbackTargets
    || hasFallbackVisualEditTargets(visualEditRecords);
  const copiedMarkdown = appendVisualEditsSection(
    appendNotebookSuffixes(
      copiedBody,
      notebook.suffixSettings,
      {
        hasAiIdTargets,
        hasFallbackTargets,
      },
    ),
    visualEditRecords,
  );
  const result = await copyText(copiedMarkdown);
  if (!result.ok) {
    setCopyStatusWithReset('failed');
    return 'failed';
  }

  useNotebookStore.getState().clearDraft();
  useVisualEditStore.getState().clearVisualEdits();
  setCopyStatusWithReset('copied');
  return 'copied';
}

export function clearNotebookCopyStatusReset(): void {
  if (copyStatusResetTimer !== null) {
    window.clearTimeout(copyStatusResetTimer);
    copyStatusResetTimer = null;
  }
}

function setCopyStatusWithReset(status: CopyStatus): void {
  clearNotebookCopyStatusReset();
  useNotebookStore.getState().setCopyStatus(status);
  copyStatusResetTimer = window.setTimeout(() => {
    useNotebookStore.getState().setCopyStatus('idle');
    copyStatusResetTimer = null;
  }, COPY_STATUS_RESET_MS);
}
