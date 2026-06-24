import { copyText } from '../../content/clipboard/clipboard';
import type { CopyStatus } from '../types';
import { useNotebookStore } from '../stores/useNotebookStore';
import { formatNotebookCopyBody } from './lexical/chip-export';
import { appendNotebookSuffixes } from './format';

const COPY_STATUS_RESET_MS = 1200;
let copyStatusResetTimer: number | null = null;

export async function copyNotebookDraftFromStore(): Promise<CopyStatus> {
  const notebook = useNotebookStore.getState();
  const trimmedDraft = notebook.draft.trim();

  if (notebook.isNotebookEmpty || !trimmedDraft) {
    setCopyStatusWithReset('empty');
    return 'empty';
  }

  const copiedBody = formatNotebookCopyBody(trimmedDraft, notebook.activeChipTargets);
  const hasAiIdTargets = notebook.activeChipTargets.some((chip) => chip.target.kind === 'ai-id');
  const result = await copyText(appendNotebookSuffixes(
    copiedBody,
    notebook.suffixSettings,
    {
      hasAiIdTargets,
      hasFallbackTargets: notebook.hasFallbackTargets,
    },
  ));
  if (!result.ok) {
    setCopyStatusWithReset('failed');
    return 'failed';
  }

  useNotebookStore.getState().clearDraft();
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
