import { copyText } from '../../content/clipboard/clipboard';
import type { CopyStatus } from '../types';
import {
  selectHasNotebookDraftForCopy,
  useNotebookStore,
} from '../stores/useNotebookStore';
import {
  selectHasCopyableVisualEdits,
  useVisualEditStore,
} from '../stores/useVisualEditStore';
import { formatNotebookCopyBody } from './lexical/chip-export';
import { appendNotebookSuffixes } from './format';
import {
  appendVisualEditsSection,
  formatVisualEditTargetsForNotebookTargets,
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
  const hasVisualEdits = selectHasCopyableVisualEdits(visualEditStore);
  const hasNotebookDraft = selectHasNotebookDraftForCopy(notebook);

  if (!hasNotebookDraft && !hasVisualEdits) {
    setCopyStatusWithReset('empty');
    return 'empty';
  }

  const notebookRequest = hasNotebookDraft
    ? notebook.draft.trim()
    : getVisualOnlyNotebookRequestText();
  const visualEditTargetDetails = formatVisualEditTargetsForNotebookTargets(
    visualEditRecords,
    notebook.activeChipTargets,
  );
  const copiedBody = formatNotebookCopyBody(notebookRequest, notebook.activeChipTargets, {
    additionalTargetDetails: visualEditTargetDetails,
  });
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
