import {
  selectHasNotebookDraftForCopy,
  useNotebookStore,
} from '../stores/useNotebookStore';
import {
  selectHasVisualEdits,
  useVisualEditStore,
} from '../stores/useVisualEditStore';
import { formatNotebookCopyBody } from './lexical/chip-export';
import { appendNotebookSuffixes } from './format';
import { readNotebookTargetNotice } from './notebook-notice';
import {
  appendVisualEditsSection,
  formatVisualEditTargetsForNotebookTargets,
  getVisualOnlyNotebookRequestText,
  hasAiIdVisualEditTargets,
  hasFallbackVisualEditTargets,
} from './visual-edits-export';

export interface NotebookExportMarkdown {
  markdown: string;
  requestText: string;
}

// Assembles the full AI-ready markdown document from the current notebook +
// visual-edit state. Shared by clipboard copy and the codex send path; returns
// null when there is nothing to export.
export async function buildNotebookExportMarkdown(): Promise<NotebookExportMarkdown | null> {
  const notebook = useNotebookStore.getState();
  const visualEditStore = useVisualEditStore.getState();
  const visualEditRecords = visualEditStore.getExportableRecords();
  const hasVisualEdits = selectHasVisualEdits(visualEditStore);
  const hasNotebookDraft = selectHasNotebookDraftForCopy(notebook);

  if (!hasNotebookDraft && !hasVisualEdits) {
    return null;
  }

  const suffixSettings = {
    ...notebook.suffixSettings,
    targetNotice: await readNotebookTargetNotice(),
  };

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
  const markdown = appendVisualEditsSection(
    appendNotebookSuffixes(
      copiedBody,
      suffixSettings,
      {
        hasAiIdTargets,
        hasFallbackTargets,
        hasVisualEdits,
      },
    ),
    visualEditRecords,
  );

  return { markdown, requestText: notebookRequest };
}
