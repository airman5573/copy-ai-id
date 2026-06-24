import type { EditorKeyboardShortcut, EditorTargetReference } from '../shared/editor-messages';
import { requestNotePanelFocus } from './note-panel-focus';
import { copyNotebookDraftFromStore } from './notebook/copy';
import { useHighlightStore } from './stores/useHighlightStore';
import { useNotebookStore } from './stores/useNotebookStore';
import { showStaleFallbackTargetToast } from './toast';

export function handleEditorShortcutAction(shortcut: EditorKeyboardShortcut): boolean {
  switch (shortcut) {
    case 'space':
      return appendHighlightedTargetToNotebook();
    case 'shift-enter':
      void copyNotebookDraftFromStore();
      return true;
    case 'escape':
      useHighlightStore.getState().clearHighlightedTarget();
      return true;
    default:
      return false;
  }
}

function appendHighlightedTargetToNotebook(): boolean {
  const { highlightedTarget, highlightedNodeId } = useHighlightStore.getState();
  if (!highlightedTarget) {
    if (highlightedNodeId) {
      showStaleFallbackTargetToast();
      return true;
    }

    return false;
  }

  return appendTargetReferenceToNotebook({
    target: highlightedTarget,
    nodeId: highlightedNodeId,
  });
}

export function appendTargetReferenceToNotebook(reference: EditorTargetReference): boolean {
  const notebook = useNotebookStore.getState();
  if (notebook.insertTargetReference) {
    notebook.insertTargetReference(reference);
  } else {
    notebook.appendTargetReference(reference);
  }
  requestNotePanelFocus();
  return true;
}
