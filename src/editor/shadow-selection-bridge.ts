export interface ShadowSelectionBridgeOptions {
  host: HTMLElement;
  shadowRoot: ShadowRoot;
}

export interface ShadowSelectionBridgeController {
  dispose(): void;
}

const NOTE_EDITOR_SELECTOR = '[data-ai-id="copy-ai-id-editor-note-lexical-editor"]';

/**
 * Lexical reads selection through `window.getSelection()`. In Chrome, when the
 * contenteditable lives inside our extension ShadowRoot, the document/window
 * selection can point at the outer document (often `<html>`/`<body>`) while
 * `shadowRoot.getSelection()` still points at the real editor caret.
 *
 * Returning the ShadowRoot selection only while the notebook editor is active
 * keeps Lexical's internal selection model aligned with the DOM caret without
 * affecting normal page selections.
 */
export function installShadowSelectionBridge({
  host,
  shadowRoot,
}: ShadowSelectionBridgeOptions): ShadowSelectionBridgeController {
  const previousGetSelection = window.getSelection;
  const getDocumentSelection = (): Selection | null => previousGetSelection.call(window);
  let disposed = false;
  const patchedGetSelection = function patchedCopyAiIdGetSelection(): Selection | null {
    const documentSelection = getDocumentSelection();
    const noteEditor = getNoteEditorElement(shadowRoot);
    const shadowSelection = getShadowSelection(shadowRoot);

    if (noteEditor && shadowSelection && shouldUseShadowSelection({
      documentSelection,
      host,
      noteEditor,
      shadowRoot,
      shadowSelection,
    })) {
      return shadowSelection;
    }

    return documentSelection;
  };

  try {
    window.getSelection = patchedGetSelection;
  } catch {
    return { dispose() {} };
  }

  return {
    dispose() {
      if (disposed) {
        return;
      }

      disposed = true;
      if (window.getSelection === patchedGetSelection) {
        window.getSelection = previousGetSelection;
      }
    },
  };
}

function shouldUseShadowSelection({
  documentSelection,
  host,
  noteEditor,
  shadowRoot,
  shadowSelection,
}: {
  documentSelection: Selection | null;
  host: HTMLElement;
  noteEditor: HTMLElement;
  shadowRoot: ShadowRoot;
  shadowSelection: Selection;
}): boolean {
  if (!selectionTouchesNode(shadowSelection, noteEditor)) {
    return false;
  }

  const shadowActiveElement = shadowRoot.activeElement;
  const noteEditorHasFocus = isNodeWithin(shadowActiveElement, noteEditor);
  const hostHasFocusWithoutInnerActiveElement = document.activeElement === host && shadowActiveElement === null;
  const documentSelectionWithinEditor = selectionTouchesNode(documentSelection, noteEditor);

  return noteEditorHasFocus || (hostHasFocusWithoutInnerActiveElement && !documentSelectionWithinEditor);
}

function getNoteEditorElement(shadowRoot: ShadowRoot): HTMLElement | null {
  return shadowRoot.querySelector<HTMLElement>(NOTE_EDITOR_SELECTOR);
}

function getShadowSelection(shadowRoot: ShadowRoot): Selection | null {
  const selectionReader = shadowRoot as ShadowRoot & { getSelection?: () => Selection | null };
  return typeof selectionReader.getSelection === 'function' ? selectionReader.getSelection() : null;
}

function selectionTouchesNode(selection: Selection | null, container: Node): boolean {
  if (!selection) {
    return false;
  }

  return isNodeWithin(selection.anchorNode, container) || isNodeWithin(selection.focusNode, container);
}

function isNodeWithin(node: Node | null | undefined, container: Node): boolean {
  return Boolean(node && (node === container || container.contains(node)));
}
