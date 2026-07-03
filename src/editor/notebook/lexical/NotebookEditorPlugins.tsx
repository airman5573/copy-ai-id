import { useCallback, useEffect, useRef } from 'react';
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import { OnChangePlugin } from '@lexical/react/LexicalOnChangePlugin';
import {
  $createParagraphNode,
  $createTextNode,
  $getRoot,
  $getSelection,
  $isRangeSelection,
  type EditorState,
  type LexicalEditor,
} from 'lexical';

import type { EditorTargetReference } from '../../../shared/domain/targets';
import { EDITOR_MESSAGE_TYPES } from '../../../shared/protocol/editor-bridge-messages';
import { hasSameEditorTarget, targetIdentityKey } from '../../../shared/editor-targets';
import { postToBridge } from '../../bridge/bridgeClient';
import { isNoteEditorHoverProtected, protectEditorInteractionFromHover } from '../../note-hover-guard';
import { onNotePanelFocusRequest, type NotePanelFocusRequestDetail } from '../../note-panel-focus';
import { useHighlightStore } from '../../stores/useHighlightStore';
import { useNotebookStore } from '../../stores/useNotebookStore';
import { showStaleFallbackTargetToast } from '../../toast';
import { $createChipNode } from './ChipNode';
import { $exportNotebookLexicalState, type ExportedChipTarget } from './chip-export';
import { $setNotebookPlainText } from './plain-text';

interface NotebookEditorPluginsProps {
  draft: string;
}

export function NotebookEditorPlugins({ draft }: NotebookEditorPluginsProps) {
  const setLexicalEditorState = useNotebookStore((state) => state.setLexicalEditorState);
  const handleChange = useCallback((editorState: EditorState, editor: LexicalEditor): void => {
    if (isLexicalEditorFocused(editor)) {
      protectEditorInteractionFromHover();
    }

    const exportedState = editorState.read(() => $exportNotebookLexicalState());

    setLexicalEditorState({
      draft: exportedState.text,
      editorStateJson: JSON.stringify(editorState.toJSON()),
      activeChipTargets: exportedState.chips,
      chipTargetMap: exportedState.chipTargetMap,
      hasFallbackTargets: exportedState.hasFallbackTargets,
      isNotebookEmpty: exportedState.isEmpty,
    });
  }, [setLexicalEditorState]);

  return (
    <>
      <OnChangePlugin ignoreSelectionChange onChange={handleChange} />
      <DraftSyncPlugin draft={draft} />
      <TargetReferenceInsertionPlugin />
      <FocusRequestPlugin />
      <HighlightBlurPlugin />
      <ChipClickPlugin />
      <ChipFlashPlugin />
    </>
  );
}

function DraftSyncPlugin({ draft }: { draft: string }) {
  const [editor] = useLexicalComposerContext();
  const lastDraftRef = useRef(draft);

  useEffect(() => {
    const previousDraft = lastDraftRef.current;
    lastDraftRef.current = draft;

    if (draft === previousDraft) {
      return;
    }

    let currentDraft = '';
    editor.getEditorState().read(() => {
      currentDraft = $exportNotebookLexicalState().text;
    });

    if (currentDraft === draft) {
      return;
    }

    editor.update(() => {
      $setNotebookPlainText(draft);
    });
  }, [draft, editor]);

  return null;
}

function TargetReferenceInsertionPlugin() {
  const [editor] = useLexicalComposerContext();
  const allocateChipId = useNotebookStore((state) => state.allocateChipId);
  const setFocusedTarget = useNotebookStore((state) => state.setFocusedTarget);
  const setInsertTargetReference = useNotebookStore((state) => state.setInsertTargetReference);

  const insertTargetReference = useCallback((targetReference: EditorTargetReference): void => {
    // An element that already has a chip keeps its number: re-pressing Space
    // inserts another occurrence of the same chip id instead of minting a new
    // one. Numbers freed by deleting every occurrence are not reused.
    const existingChipId = editor.getEditorState().read(() => (
      $exportNotebookLexicalState().chips
        .find((chip) => hasSameEditorTarget(chip.target, targetReference.target))
        ?.chipId ?? null
    ));
    const chipId = existingChipId ?? allocateChipId();
    setFocusedTarget(targetReference.target);
    protectEditorInteractionFromHover();

    editor.update(() => {
      $insertChipReference(chipId, targetReference);
    }, {
      onUpdate: () => {
        editor.focus(undefined, { defaultSelection: 'rootEnd' });
      },
    });
  }, [allocateChipId, editor, setFocusedTarget]);

  useEffect(() => {
    setInsertTargetReference(insertTargetReference);

    return () => {
      setInsertTargetReference(null);
    };
  }, [insertTargetReference, setInsertTargetReference]);

  return null;
}

function FocusRequestPlugin() {
  const [editor] = useLexicalComposerContext();

  useEffect(() => {
    return onNotePanelFocusRequest((detail) => {
      protectEditorInteractionFromHover();

      editor.update(() => {
        $getRoot().selectEnd();
      }, {
        onUpdate: () => {
          editor.focus(undefined, { defaultSelection: 'rootEnd' });
          runAfterNotePanelFocus(detail);
        },
      });
    });
  }, [editor]);

  return null;
}

function runAfterNotePanelFocus(detail?: NotePanelFocusRequestDetail): void {
  if (!detail?.afterFocus) {
    return;
  }

  window.requestAnimationFrame(() => {
    detail.afterFocus?.();
  });
}

function HighlightBlurPlugin() {
  const [editor] = useLexicalComposerContext();
  const highlightedNodeId = useHighlightStore((state) => state.highlightedNodeId);
  const highlightedTarget = useHighlightStore((state) => state.highlightedTarget);
  const highlightKey = `${highlightedNodeId ?? ''}:${targetIdentityKey(highlightedTarget)}`;
  const previousHighlightKeyRef = useRef(highlightKey);

  useEffect(() => {
    if (previousHighlightKeyRef.current !== highlightKey) {
      const willBlur = isLexicalEditorFocused(editor) && !isNoteEditorHoverProtected();

      previousHighlightKeyRef.current = highlightKey;

      if (willBlur) {
        editor.blur();
      }
    }
  }, [editor, highlightedNodeId, highlightedTarget, highlightKey]);

  return null;
}

const CHIP_FLASH_CLASS_NAME = 'copy-ai-id-editor-note-chip--flash';

// Registers the chip-flash callback used by preview badge clicks: scroll the
// matching chip into view and pulse it briefly.
function ChipFlashPlugin() {
  const [editor] = useLexicalComposerContext();
  const setFlashChip = useNotebookStore((state) => state.setFlashChip);

  useEffect(() => {
    setFlashChip((chipId) => {
      const chipElement = editor.getRootElement()
        ?.querySelector<HTMLElement>(`[data-copy-ai-id-chip-id="${chipId}"]`);
      if (!chipElement) {
        return;
      }

      chipElement.scrollIntoView({ block: 'nearest' });
      chipElement.classList.remove(CHIP_FLASH_CLASS_NAME);
      // Force a reflow so re-clicking the badge restarts the animation.
      void chipElement.offsetWidth;
      chipElement.classList.add(CHIP_FLASH_CLASS_NAME);
      chipElement.addEventListener('animationend', () => {
        chipElement.classList.remove(CHIP_FLASH_CLASS_NAME);
      }, { once: true });
    });

    return () => {
      setFlashChip(null);
    };
  }, [editor, setFlashChip]);

  return null;
}

function ChipClickPlugin() {
  const [editor] = useLexicalComposerContext();

  useEffect(() => {
    return editor.registerRootListener((rootElement) => {
      if (!rootElement) {
        return undefined;
      }

      const handleClick = (event: MouseEvent): void => {
        const chipElement = getChipElementForEvent(rootElement, event);
        if (!chipElement) {
          return;
        }

        event.preventDefault();
        event.stopPropagation();
        revealChipTarget(editor, chipElement.dataset.copyAiIdChipId);
      };

      rootElement.addEventListener('click', handleClick);

      return () => {
        rootElement.removeEventListener('click', handleClick);
      };
    });
  }, [editor]);

  return null;
}

function $insertChipReference(chipId: string, reference: EditorTargetReference): void {
  const chipNode = $createChipNode({
    chipId,
    target: reference.target,
    nodeId: reference.nodeId,
  });
  const trailingSpaceNode = $createTextNode(' ');
  const selection = $getSelection();
  const root = $getRoot();
  const currentText = root.getTextContent().trimEnd();

  if ($isRangeSelection(selection)) {
    selection.insertNodes([chipNode, trailingSpaceNode]);
    trailingSpaceNode.selectEnd();
    return;
  }

  const paragraph = $createParagraphNode();
  paragraph.append(chipNode, trailingSpaceNode);

  if (!currentText) {
    root.clear();
  }

  root.append(paragraph);
  paragraph.selectEnd();
}

function getChipElementForEvent(rootElement: HTMLElement, event: MouseEvent): HTMLElement | null {
  if (!(event.target instanceof Element)) {
    return null;
  }

  const chipElement = event.target.closest<HTMLElement>('[data-copy-ai-id-chip-id]');
  if (!chipElement || !rootElement.contains(chipElement)) {
    return null;
  }

  return chipElement;
}

function revealChipTarget(editor: LexicalEditor, chipId: string | undefined): void {
  const chipTarget = findChipTarget(editor, chipId);
  const nodeId = chipTarget ? nodeIdForChipTarget(chipTarget) : null;

  if (!chipTarget || !nodeId) {
    showStaleFallbackTargetToast();
    return;
  }

  useHighlightStore.getState().setHighlightedTarget(chipTarget.target, nodeId, 'editor');
  postToBridge({
    type: EDITOR_MESSAGE_TYPES.revealTreeNode,
    nodeId,
  });
}

function findChipTarget(
  editor: LexicalEditor,
  chipId: string | undefined,
): ExportedChipTarget | null {
  if (!chipId) {
    return null;
  }

  return editor.getEditorState().read(() => {
    return $exportNotebookLexicalState().chips.find((chip) => chip.chipId === chipId) ?? null;
  });
}

function nodeIdForChipTarget(chip: ExportedChipTarget): string | null {
  return chip.nodeId ?? (chip.target.kind === 'fallback' ? chip.target.nodeId : null);
}

function isLexicalEditorFocused(editor: LexicalEditor): boolean {
  const rootElement = editor.getRootElement();
  if (!rootElement) {
    return false;
  }

  const ownerActiveElement = rootElement.ownerDocument.activeElement;
  const rootNode = rootElement.getRootNode();
  const rootActiveElement = 'activeElement' in rootNode
    ? (rootNode as Document | ShadowRoot).activeElement
    : null;

  return isElementWithinRoot(rootElement, ownerActiveElement) || isElementWithinRoot(rootElement, rootActiveElement);
}

function isElementWithinRoot(rootElement: HTMLElement, element: Element | null): boolean {
  return element !== null && (element === rootElement || rootElement.contains(element));
}
