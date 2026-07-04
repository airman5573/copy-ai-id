import type {
  BridgeViewportRect,
  BridgeViewportSize,
} from '../shared/domain/geometry';
import type { EditorTargetReference } from '../shared/domain/targets';
import type {
  EditorKeyboardShortcut,
  EditorToBridgeMessage,
} from '../shared/protocol/editor-bridge-messages';
import { bridgeViewportRectToEditorViewportRect, type EditorViewportRect } from './bridge/geometry';
import { closeOpenQuickToolbarPopover } from './components/quick-toolbar/popoverRegistry';
import { captureNotePanelAnchor } from './note-panel-anchor';
import { requestNotePanelFocus } from './note-panel-focus';
import { cancelCodexSend } from './notebook/codex-send';
import { copyNotebookDraftFromStore } from './notebook/copy';
import { useCodexStore } from './stores/useCodexStore';
import { useFloatingNotePanelStore } from './stores/useFloatingNotePanelStore';
import { useFloatingVisualPanelStore } from './stores/useFloatingVisualPanelStore';
import { useHighlightStore } from './stores/useHighlightStore';
import { useNotebookStore } from './stores/useNotebookStore';
import { useVisualSelectionStore } from './stores/useVisualSelectionStore';
import { showStaleFallbackTargetToast } from './toast';
import { undoLastVisualEdit } from './visual/visualUndo';

export type EditorEscapeActionResult =
  | 'codex-dialog'
  | 'quick-toolbar-popover'
  | 'visual-panel'
  | 'floating-note-panel'
  | 'visual-toolbar'
  | 'highlight';

export interface AppendTargetReferenceOptions {
  elementRect?: BridgeViewportRect | null;
  editorRect?: EditorViewportRect | null;
  viewport?: BridgeViewportSize | null;
  // Injected (instead of imported from bridgeClient) to avoid a module cycle;
  // hides the quick toolbar UI while keeping the pinned selection alive.
  hideQuickActionToolbar?: () => void;
}

export type EditorShortcutActionOptions = Pick<AppendTargetReferenceOptions, 'hideQuickActionToolbar'> & {
  postToBridge?: (message: EditorToBridgeMessage) => void;
};

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
    case 'undo':
      return options.postToBridge ? undoLastVisualEdit(options.postToBridge) : false;
    case 'escape':
      handleEditorEscapeAction();
      return true;
    default:
      return false;
  }
}

export function handleEditorEscapeAction(): EditorEscapeActionResult {
  // Escape cascade: codex confirm dialog → open quick-toolbar popover →
  // visual panel → floating note panel → toolbar unpin → highlight (forwarded
  // to the bridge by callers).
  if (useCodexStore.getState().phase === 'confirming') {
    cancelCodexSend();
    return 'codex-dialog';
  }

  if (closeOpenQuickToolbarPopover()) {
    return 'quick-toolbar-popover';
  }

  const floatingPanel = useFloatingVisualPanelStore.getState();
  if (floatingPanel.isOpen) {
    floatingPanel.closePanel();
    useVisualSelectionStore.getState().closePanel();
    return 'visual-panel';
  }

  const floatingNotePanel = useFloatingNotePanelStore.getState();
  if (floatingNotePanel.isOpen) {
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
  // Capture the anchor before hiding the toolbar — the pinned toolbar
  // geometry is one of the anchor sources.
  const anchor = captureNotePanelAnchor(reference, explicitGeometry);
  floatingNotePanel.openNearTarget(anchor);
  options.hideQuickActionToolbar?.();
  window.requestAnimationFrame(() => {
    requestNotePanelFocus({
      afterFocus: () => insertTargetReferenceIntoNotebook(reference),
    });
  });
  return true;
}

// Reverse navigation for preview chip badges: badge click → focus the note
// panel (opening the floating panel near the element when enabled) and flash
// the matching chip.
export function focusNotebookChipFromBadge(
  chipId: string,
  options: AppendTargetReferenceOptions = {},
): void {
  const flashChip = (): void => {
    useNotebookStore.getState().flashChip?.(chipId);
  };
  const chip = useNotebookStore.getState().activeChipTargets
    .find((candidate) => candidate.chipId === chipId);
  const floatingNotePanel = useFloatingNotePanelStore.getState();

  if (chip) {
    const anchor = captureNotePanelAnchor(
      { target: chip.target, nodeId: chip.nodeId },
      resolveTargetReferenceGeometry(options),
    );
    floatingNotePanel.openNearTarget(anchor);
    options.hideQuickActionToolbar?.();
    window.requestAnimationFrame(() => {
      requestNotePanelFocus({ afterFocus: flashChip });
    });
    return;
  }

  requestNotePanelFocus({ afterFocus: flashChip });
}

export function insertTargetReferenceIntoNotebook(reference: EditorTargetReference): void {
  const notebook = useNotebookStore.getState();
  if (notebook.insertTargetReference) {
    notebook.insertTargetReference(reference);
  } else {
    // Visible notebook insertions are owned by the mounted Lexical editor via
    // insertTargetReference. Before it mounts, only record the focused target
    // instead of falling back to the old raw-text format.
    notebook.setFocusedTarget(reference.target);
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
