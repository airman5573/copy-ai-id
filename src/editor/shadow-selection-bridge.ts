import { logNotebookWebmate } from './debug/webmatelog';

export interface ShadowSelectionBridgeOptions {
  host: HTMLElement;
  shadowRoot: ShadowRoot;
}

export interface ShadowSelectionBridgeController {
  dispose(): void;
}

const NOTE_EDITOR_SELECTOR = '[data-ai-id="copy-ai-id-editor-note-lexical-editor"]';
const MAX_USAGE_LOGS = 20;

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
  let usageLogCount = 0;
  let lastUsageLogSignature = '';

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
      maybeLogShadowSelectionBridgeUse({
        documentSelection,
        noteEditor,
        shadowRoot,
        shadowSelection,
      });
      return shadowSelection;
    }

    return documentSelection;
  };

  try {
    window.getSelection = patchedGetSelection;
  } catch (error) {
    logNotebookWebmate('shadow-selection-bridge-install-failed', {
      diagnosticArea: 'shadow-focus-selection',
      reason: error instanceof Error ? error.name : 'unknown',
    }, 'error');
    return { dispose() {} };
  }

  function maybeLogShadowSelectionBridgeUse({
    documentSelection,
    noteEditor,
    shadowRoot,
    shadowSelection,
  }: {
    documentSelection: Selection | null;
    noteEditor: HTMLElement;
    shadowRoot: ShadowRoot;
    shadowSelection: Selection;
  }): void {
    if (usageLogCount >= MAX_USAGE_LOGS) {
      return;
    }

    const signature = [
      summarizeSelectionBoundary(documentSelection, noteEditor),
      summarizeSelectionBoundary(shadowSelection, noteEditor),
      getElementLabel(document.activeElement),
      getElementLabel(shadowRoot.activeElement),
    ].join('|');

    if (signature === lastUsageLogSignature) {
      return;
    }

    lastUsageLogSignature = signature;
    usageLogCount += 1;
    logNotebookWebmate('shadow-selection-bridge-used', {
      diagnosticArea: 'shadow-focus-selection',
      documentSelectionWithinEditor: selectionTouchesNode(documentSelection, noteEditor),
      shadowSelectionWithinEditor: selectionTouchesNode(shadowSelection, noteEditor),
      activeElement: getElementLabel(document.activeElement),
      shadowActiveElement: getElementLabel(shadowRoot.activeElement),
      documentSelection: summarizeSelectionForLog(documentSelection, noteEditor),
      shadowSelection: summarizeSelectionForLog(shadowSelection, noteEditor),
      usageLogCount,
    }, 'warn');
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

function summarizeSelectionBoundary(selection: Selection | null, rootElement: HTMLElement): string {
  if (!selection) {
    return 'null';
  }

  return [
    selection.type,
    selection.rangeCount,
    selection.anchorOffset,
    getNodeLabel(selection.anchorNode, rootElement),
    selection.focusOffset,
    getNodeLabel(selection.focusNode, rootElement),
  ].join(':');
}

function summarizeSelectionForLog(selection: Selection | null, rootElement: HTMLElement): Record<string, unknown> | null {
  if (!selection) {
    return null;
  }

  return {
    type: selection.type,
    rangeCount: selection.rangeCount,
    isCollapsed: selection.isCollapsed,
    anchorOffset: selection.anchorOffset,
    focusOffset: selection.focusOffset,
    anchor: getNodeLabel(selection.anchorNode, rootElement),
    focus: getNodeLabel(selection.focusNode, rootElement),
  };
}

function getNodeLabel(node: Node | null, rootElement: HTMLElement): string | null {
  if (!node) {
    return null;
  }

  if (node.nodeType === Node.TEXT_NODE) {
    return `#text:${node.textContent?.length ?? 0}:${rootElement.contains(node) ? 'inside' : 'outside'}`;
  }

  return getElementLabel(node instanceof Element ? node : node.parentElement);
}

function getElementLabel(element: Element | null): string | null {
  if (!element) {
    return null;
  }

  const htmlElement = element instanceof HTMLElement ? element : null;
  const dataAiId = htmlElement?.dataset.aiId;
  const className = typeof element.className === 'string'
    ? element.className.split(/\s+/).filter(Boolean).slice(0, 3).join('.')
    : '';

  return [
    element.tagName.toLowerCase(),
    dataAiId ? `[data-ai-id=${dataAiId}]` : '',
    className ? `.${className}` : '',
  ].join('');
}
