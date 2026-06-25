import type {
  BridgeViewportRect,
  BridgeViewportSize,
  EditorKeyboardShortcut,
  EditorTargetReference,
} from '../shared/editor-messages';
import { bridgeViewportRectToEditorViewportRect, type EditorViewportRect } from './bridge/geometry';
import { captureNotePanelAnchor } from './note-panel-anchor';
import { requestNotePanelFocus } from './note-panel-focus';
import { copyNotebookDraftFromStore } from './notebook/copy';
import { useFloatingNotePanelStore } from './stores/useFloatingNotePanelStore';
import { useFloatingVisualPanelStore } from './stores/useFloatingVisualPanelStore';
import { useHighlightStore } from './stores/useHighlightStore';
import { useNotebookStore } from './stores/useNotebookStore';
import { useVisualSelectionStore } from './stores/useVisualSelectionStore';
import { showStaleFallbackTargetToast } from './toast';

export type EditorEscapeActionResult = 'visual-panel' | 'floating-note-panel' | 'visual-toolbar' | 'highlight';

export interface AppendTargetReferenceOptions {
  elementRect?: BridgeViewportRect | null;
  editorRect?: EditorViewportRect | null;
  viewport?: BridgeViewportSize | null;
  onFloatingNotePanelOpen?: () => void;
}

export type EditorShortcutActionOptions = Pick<AppendTargetReferenceOptions, 'onFloatingNotePanelOpen'>;

export function handleEditorShortcutAction(
  shortcut: EditorKeyboardShortcut,
  options: EditorShortcutActionOptions = {},
): boolean {
  switch (shortcut) {
    case 'space':
      return appendHighlightedTargetToNotebook(options);
    case 'shift-enter':
      void copyNotebookDraftFromStore();
      return true;
    case 'escape':
      handleEditorEscapeAction();
      return true;
    default:
      return false;
  }
}

export function handleEditorEscapeAction(): EditorEscapeActionResult {
  const floatingPanel = useFloatingVisualPanelStore.getState();
  if (floatingPanel.isOpen) {
    floatingPanel.closePanel();
    useVisualSelectionStore.getState().closePanel();
    return 'visual-panel';
  }

  const floatingNotePanel = useFloatingNotePanelStore.getState();
  if (floatingNotePanel.enabled && floatingNotePanel.isOpen) {
    floatingNotePanel.closePanel();
    return 'floating-note-panel';
  }

  const visualSelection = useVisualSelectionStore.getState();
  if (visualSelection.activeToolbarTarget) {
    visualSelection.clearQuickActionSelection();
    return 'visual-toolbar';
  }

  return 'highlight';
}

function appendHighlightedTargetToNotebook(options: EditorShortcutActionOptions = {}): boolean {
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
  }, options);
}

export function appendTargetReferenceToNotebook(
  reference: EditorTargetReference,
  options: AppendTargetReferenceOptions = {},
): boolean {
  const explicitGeometry = resolveTargetReferenceGeometry(options);
  const floatingNotePanel = useFloatingNotePanelStore.getState();
  if (floatingNotePanel.enabled) {
    const anchor = captureNotePanelAnchor(reference, explicitGeometry);
    floatingNotePanel.openNearTarget(anchor);
    options.onFloatingNotePanelOpen?.();
    window.requestAnimationFrame(() => {
      requestNotePanelFocus({
        afterFocus: () => insertTargetReferenceIntoNotebook(reference),
      });
    });
    return true;
  }

  insertTargetReferenceIntoNotebook(reference);
  requestNotePanelFocus();
  return true;
}

export function insertTargetReferenceIntoNotebook(reference: EditorTargetReference): void {
  const notebook = useNotebookStore.getState();
  if (notebook.insertTargetReference) {
    notebook.insertTargetReference(reference);
  } else {
    notebook.appendTargetReference(reference);
  }
}

function resolveTargetReferenceGeometry(
  options: AppendTargetReferenceOptions,
): Required<Pick<AppendTargetReferenceOptions, 'elementRect' | 'editorRect' | 'viewport'>> {
  const elementRect = options.elementRect ?? null;
  const editorRect = options.editorRect ?? (elementRect
    ? bridgeViewportRectToEditorViewportRect(elementRect)
    : null);

  return {
    elementRect,
    editorRect,
    viewport: options.viewport ?? null,
  };
}
