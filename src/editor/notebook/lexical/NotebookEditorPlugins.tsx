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

import type { EditorTarget, EditorTargetReference } from '../../../shared/editor-messages';
import { EDITOR_MESSAGE_TYPES } from '../../../shared/editor-messages';
import { targetIdentityKey } from '../../../shared/editor-targets';
import { postToBridge } from '../../bridge/bridgeClient';
import {
  getNotebookSelectionSnapshot,
  hashNotebookLogValue,
  logNotebookDomEvent,
  logNotebookWebmate,
} from '../../debug/webmatelog';
import { isNoteEditorHoverProtected, protectNoteEditorFromHover } from '../../note-hover-guard';
import { onNotePanelFocusRequest } from '../../note-panel-focus';
import { useHighlightStore } from '../../stores/useHighlightStore';
import { useNotebookStore } from '../../stores/useNotebookStore';
import { showStaleFallbackTargetToast } from '../../toast';
import { $createChipNode } from './ChipNode';
import { $exportNotebookLexicalState, type ExportedChipTarget } from './chip-export';
import { $initializeNotebookFromLegacyText } from './chip-import';

interface NotebookEditorPluginsProps {
  draft: string;
}

interface ExportSnapshotSummary {
  draftLength: number;
  draftHash: string | null;
  chipCount: number;
}

interface LexicalSelectionSummary {
  kind: string;
  isCollapsed?: boolean;
  anchorOffset?: number;
  focusOffset?: number;
  anchorNodeType?: string;
  focusNodeType?: string;
  selectedNodeCount?: number;
}

interface ChipInsertionSummary {
  hadRangeSelection: boolean;
  insertedViaSelection: boolean;
  rootWasEmptyBefore: boolean;
  rootTextLengthBefore: number;
  selectionBefore: LexicalSelectionSummary | null;
}

interface LexicalEditorFocusSnapshot {
  rootPresent: boolean;
  rootNodeKind: 'shadow-root' | 'document' | 'other';
  documentHasFocus: boolean | null;
  ownerActiveTag: string | null;
  ownerActiveAiId: string | null;
  ownerActiveContentEditable: string | null;
  ownerActiveIsRoot: boolean;
  ownerActiveWithinRoot: boolean;
  rootActiveTag: string | null;
  rootActiveAiId: string | null;
  rootActiveContentEditable: string | null;
  rootActiveIsRoot: boolean;
  rootActiveWithinRoot: boolean;
  isFocused: boolean;
}

export function NotebookEditorPlugins({ draft }: NotebookEditorPluginsProps) {
  const setLexicalEditorState = useNotebookStore((state) => state.setLexicalEditorState);
  const previousExportRef = useRef<ExportSnapshotSummary | null>(null);
  const handleChange = useCallback((editorState: EditorState, editor: LexicalEditor): void => {
    const focus = getLexicalEditorFocusSnapshot(editor);
    if (focus.isFocused) {
      protectNoteEditorFromHover();
    }

    let lexicalSelection: LexicalSelectionSummary | null = null;
    const exportedState = editorState.read(() => {
      lexicalSelection = $summarizeLexicalSelection();
      return $exportNotebookLexicalState();
    });
    const previousExport = previousExportRef.current;
    const exportSummary: ExportSnapshotSummary = {
      draftLength: exportedState.text.length,
      draftHash: hashNotebookLogValue(exportedState.text),
      chipCount: exportedState.chips.length,
    };
    const chipCountDelta = previousExport
      ? exportSummary.chipCount - previousExport.chipCount
      : null;
    const draftLengthDelta = previousExport
      ? exportSummary.draftLength - previousExport.draftLength
      : null;

    logNotebookWebmate('lexical-change-exported', {
      diagnosticArea: 'chip-boundary-edit',
      focus,
      lexicalSelection,
      domSelection: getEditorSelectionSnapshot(editor),
      draftLength: exportSummary.draftLength,
      draftHash: exportSummary.draftHash,
      previousDraftLength: previousExport?.draftLength ?? null,
      previousDraftHash: previousExport?.draftHash ?? null,
      draftLengthDelta,
      isEmpty: exportedState.isEmpty,
      chipCount: exportSummary.chipCount,
      previousChipCount: previousExport?.chipCount ?? null,
      chipCountDelta,
      chipIds: exportedState.chips.map((chip) => chip.chipId).slice(0, 20),
      chipTargets: exportedState.chips.map(summarizeExportedChipTarget).slice(0, 20),
      chipTargetMapLength: exportedState.chipTargetMap.length,
      hasFallbackTargets: exportedState.hasFallbackTargets,
    }, chipCountDelta !== null && chipCountDelta !== 0 ? 'warn' : 'debug');
    previousExportRef.current = exportSummary;

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
      <NotebookInputDiagnosticsPlugin />
      <DraftSyncPlugin draft={draft} />
      <TargetReferenceInsertionPlugin />
      <FocusRequestPlugin />
      <HighlightBlurPlugin />
      <ChipClickPlugin />
    </>
  );
}

function NotebookInputDiagnosticsPlugin() {
  const [editor] = useLexicalComposerContext();

  useEffect(() => {
    return editor.registerRootListener((rootElement) => {
      if (!rootElement) {
        return undefined;
      }

      const ownerDocument = rootElement.ownerDocument;
      const rootEventNames = [
        'keydown',
        'beforeinput',
        'input',
        'compositionstart',
        'compositionend',
        'paste',
        'cut',
      ];
      let previousSelectionSignature = '';

      const handleRootEvent = (event: Event): void => {
        logNotebookDomEvent(rootElement, event.type, event, {
          diagnosticArea: 'shadow-focus-selection',
          listener: 'lexical-root-native',
          focus: getLexicalEditorFocusSnapshot(editor),
        });
      };

      const handleFocusEvent = (event: Event): void => {
        logNotebookDomEvent(rootElement, event.type, event, {
          diagnosticArea: 'shadow-focus-selection',
          listener: 'lexical-root-native-capture',
          focus: getLexicalEditorFocusSnapshot(editor),
        });
      };

      const handleSelectionChange = (): void => {
        const selectionSnapshot = getNotebookSelectionSnapshot(rootElement);
        const nextSelectionSignature = getSelectionSnapshotSignature(selectionSnapshot);
        if (nextSelectionSignature === previousSelectionSignature) {
          return;
        }

        previousSelectionSignature = nextSelectionSignature;
        logNotebookWebmate('dom-selection-change', {
          diagnosticArea: 'shadow-focus-selection',
          listener: 'owner-document',
          focus: getLexicalEditorFocusSnapshot(editor),
          selection: selectionSnapshot,
        });
      };

      for (const eventName of rootEventNames) {
        rootElement.addEventListener(eventName, handleRootEvent);
      }
      rootElement.addEventListener('focus', handleFocusEvent, true);
      rootElement.addEventListener('blur', handleFocusEvent, true);
      ownerDocument.addEventListener('selectionchange', handleSelectionChange);

      return () => {
        for (const eventName of rootEventNames) {
          rootElement.removeEventListener(eventName, handleRootEvent);
        }
        rootElement.removeEventListener('focus', handleFocusEvent, true);
        rootElement.removeEventListener('blur', handleFocusEvent, true);
        ownerDocument.removeEventListener('selectionchange', handleSelectionChange);
      };
    });
  }, [editor]);

  return null;
}

function DraftSyncPlugin({ draft }: { draft: string }) {
  const [editor] = useLexicalComposerContext();
  const lastDraftRef = useRef(draft);

  useEffect(() => {
    const previousDraft = lastDraftRef.current;
    lastDraftRef.current = draft;

    if (draft === previousDraft) {
      logNotebookWebmate('draft-sync-decision', {
        diagnosticArea: 'draft-sync-replay',
        decision: 'unchanged-prop',
        focus: getLexicalEditorFocusSnapshot(editor),
        domSelection: getEditorSelectionSnapshot(editor),
        previousDraftLength: previousDraft.length,
        nextDraftLength: draft.length,
        previousDraftHash: hashNotebookLogValue(previousDraft),
        nextDraftHash: hashNotebookLogValue(draft),
        propChanged: false,
      });
      return;
    }

    let currentDraft = '';
    let lexicalSelection: LexicalSelectionSummary | null = null;
    let chipCount = 0;
    let hasFallbackTargets = false;
    editor.getEditorState().read(() => {
      lexicalSelection = $summarizeLexicalSelection();
      const exportedState = $exportNotebookLexicalState();
      currentDraft = exportedState.text;
      chipCount = exportedState.chips.length;
      hasFallbackTargets = exportedState.hasFallbackTargets;
    });

    if (currentDraft === draft) {
      logNotebookWebmate('draft-sync-decision', {
        diagnosticArea: 'draft-sync-replay',
        decision: 'already-in-sync',
        focus: getLexicalEditorFocusSnapshot(editor),
        domSelection: getEditorSelectionSnapshot(editor),
        lexicalSelection,
        previousDraftLength: previousDraft.length,
        nextDraftLength: draft.length,
        currentDraftLength: currentDraft.length,
        previousDraftHash: hashNotebookLogValue(previousDraft),
        nextDraftHash: hashNotebookLogValue(draft),
        currentDraftHash: hashNotebookLogValue(currentDraft),
        propChanged: true,
        lexicalMatchesIncomingDraft: true,
        chipCount,
        hasFallbackTargets,
      });
      return;
    }

    logNotebookWebmate('draft-sync-decision', {
      diagnosticArea: 'draft-sync-replay',
      decision: 'reinitialize-from-legacy-text',
      focus: getLexicalEditorFocusSnapshot(editor),
      domSelection: getEditorSelectionSnapshot(editor),
      lexicalSelection,
      previousDraftLength: previousDraft.length,
      nextDraftLength: draft.length,
      currentDraftLength: currentDraft.length,
      previousDraftHash: hashNotebookLogValue(previousDraft),
      nextDraftHash: hashNotebookLogValue(draft),
      currentDraftHash: hashNotebookLogValue(currentDraft),
      propChanged: true,
      lexicalMatchesIncomingDraft: false,
      chipCount,
      hasFallbackTargets,
    }, 'warn');

    editor.update(() => {
      $initializeNotebookFromLegacyText(draft);
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
    const chipId = allocateChipId();
    setFocusedTarget(targetReference.target);
    protectNoteEditorFromHover();
    logNotebookWebmate('chip-insert-requested', {
      diagnosticArea: 'chip-boundary-edit',
      chipId,
      targetReference: summarizeTargetReference(targetReference),
      focus: getLexicalEditorFocusSnapshot(editor),
      domSelection: getEditorSelectionSnapshot(editor),
    });

    let insertionSummary: ChipInsertionSummary | null = null;
    editor.update(() => {
      insertionSummary = $insertChipReference(chipId, targetReference);
    }, {
      onUpdate: () => {
        logNotebookWebmate('chip-insert-committed', {
          diagnosticArea: 'chip-boundary-edit',
          chipId,
          targetReference: summarizeTargetReference(targetReference),
          insertion: insertionSummary,
          focus: getLexicalEditorFocusSnapshot(editor),
          domSelection: getEditorSelectionSnapshot(editor),
        });
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
    return onNotePanelFocusRequest(() => {
      protectNoteEditorFromHover();
      logNotebookWebmate('focus-request-received', {
        diagnosticArea: 'shadow-focus-selection',
        focus: getLexicalEditorFocusSnapshot(editor),
        domSelection: getEditorSelectionSnapshot(editor),
      });

      editor.update(() => {
        $getRoot().selectEnd();
      }, {
        onUpdate: () => {
          logNotebookWebmate('focus-request-committed', {
            diagnosticArea: 'shadow-focus-selection',
            focus: getLexicalEditorFocusSnapshot(editor),
            domSelection: getEditorSelectionSnapshot(editor),
          });
          editor.focus(undefined, { defaultSelection: 'rootEnd' });
        },
      });
    });
  }, [editor]);

  return null;
}

function HighlightBlurPlugin() {
  const [editor] = useLexicalComposerContext();
  const highlightedNodeId = useHighlightStore((state) => state.highlightedNodeId);
  const highlightedTarget = useHighlightStore((state) => state.highlightedTarget);
  const highlightOrigin = useHighlightStore((state) => state.highlightOrigin);
  const highlightKey = `${highlightedNodeId ?? ''}:${targetIdentityKey(highlightedTarget)}`;
  const previousHighlightKeyRef = useRef(highlightKey);

  useEffect(() => {
    if (previousHighlightKeyRef.current !== highlightKey) {
      const focus = getLexicalEditorFocusSnapshot(editor);
      const hoverProtected = isNoteEditorHoverProtected();
      const willBlur = focus.isFocused && !hoverProtected;
      const blurSuppressionReason = focus.isFocused && hoverProtected
        ? 'hover-protected-editor-input'
        : null;

      logNotebookWebmate('highlight-blur-decision', {
        diagnosticArea: 'highlight-blur',
        previousHighlightKeyHash: hashNotebookLogValue(previousHighlightKeyRef.current),
        nextHighlightKeyHash: hashNotebookLogValue(highlightKey),
        highlightedNodeIdHash: hashNotebookLogValue(highlightedNodeId),
        highlightedTarget: summarizeHighlightedTarget(highlightedTarget),
        highlightOrigin,
        focus,
        hoverProtected,
        willBlur,
        blurSuppressionReason,
        domSelection: getEditorSelectionSnapshot(editor),
      }, willBlur ? 'warn' : 'debug');

      previousHighlightKeyRef.current = highlightKey;

      if (willBlur) {
        editor.blur();
        logNotebookWebmate('highlight-blur-committed', {
          diagnosticArea: 'highlight-blur',
          highlightedNodeIdHash: hashNotebookLogValue(highlightedNodeId),
          highlightedTarget: summarizeHighlightedTarget(highlightedTarget),
          highlightOrigin,
          focusBeforeBlur: focus,
          focusAfterBlur: getLexicalEditorFocusSnapshot(editor),
          domSelectionAfterBlur: getEditorSelectionSnapshot(editor),
        }, 'warn');
      }
    }
  }, [editor, highlightedNodeId, highlightedTarget, highlightKey, highlightOrigin]);

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

function $insertChipReference(chipId: string, reference: EditorTargetReference): ChipInsertionSummary {
  const chipNode = $createChipNode({
    chipId,
    target: reference.target,
    nodeId: reference.nodeId,
  });
  const trailingSpaceNode = $createTextNode(' ');
  const selection = $getSelection();
  const selectionBefore = $summarizeLexicalSelection();
  const root = $getRoot();
  const currentText = root.getTextContent().trimEnd();

  if ($isRangeSelection(selection)) {
    selection.insertNodes([chipNode, trailingSpaceNode]);
    trailingSpaceNode.selectEnd();
    return {
      hadRangeSelection: true,
      insertedViaSelection: true,
      rootWasEmptyBefore: currentText.length === 0,
      rootTextLengthBefore: currentText.length,
      selectionBefore,
    };
  }

  const paragraph = $createParagraphNode();
  paragraph.append(chipNode, trailingSpaceNode);

  if (!currentText) {
    root.clear();
  }

  root.append(paragraph);
  paragraph.selectEnd();
  return {
    hadRangeSelection: false,
    insertedViaSelection: false,
    rootWasEmptyBefore: currentText.length === 0,
    rootTextLengthBefore: currentText.length,
    selectionBefore,
  };
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

function getEditorSelectionSnapshot(editor: LexicalEditor): ReturnType<typeof getNotebookSelectionSnapshot> | null {
  const rootElement = editor.getRootElement();
  return rootElement ? getNotebookSelectionSnapshot(rootElement) : null;
}

function getLexicalEditorFocusSnapshot(editor: LexicalEditor): LexicalEditorFocusSnapshot {
  const rootElement = editor.getRootElement();
  if (!rootElement) {
    return {
      rootPresent: false,
      rootNodeKind: 'other',
      documentHasFocus: null,
      ownerActiveTag: null,
      ownerActiveAiId: null,
      ownerActiveContentEditable: null,
      ownerActiveIsRoot: false,
      ownerActiveWithinRoot: false,
      rootActiveTag: null,
      rootActiveAiId: null,
      rootActiveContentEditable: null,
      rootActiveIsRoot: false,
      rootActiveWithinRoot: false,
      isFocused: false,
    };
  }

  const ownerDocument = rootElement.ownerDocument;
  const ownerActiveElement = ownerDocument.activeElement;
  const rootNode = rootElement.getRootNode();
  const rootActiveElement = 'activeElement' in rootNode
    ? (rootNode as Document | ShadowRoot).activeElement
    : null;
  const ownerActiveWithinRoot = isElementWithinRoot(rootElement, ownerActiveElement);
  const rootActiveWithinRoot = isElementWithinRoot(rootElement, rootActiveElement);

  return {
    rootPresent: true,
    rootNodeKind: getRootNodeKind(rootNode),
    documentHasFocus: ownerDocument.hasFocus(),
    ownerActiveTag: getElementTag(ownerActiveElement),
    ownerActiveAiId: getSafeDataAiId(ownerActiveElement),
    ownerActiveContentEditable: getContentEditableValue(ownerActiveElement),
    ownerActiveIsRoot: ownerActiveElement === rootElement,
    ownerActiveWithinRoot,
    rootActiveTag: getElementTag(rootActiveElement),
    rootActiveAiId: getSafeDataAiId(rootActiveElement),
    rootActiveContentEditable: getContentEditableValue(rootActiveElement),
    rootActiveIsRoot: rootActiveElement === rootElement,
    rootActiveWithinRoot,
    isFocused: ownerActiveWithinRoot || rootActiveWithinRoot,
  };
}

function $summarizeLexicalSelection(): LexicalSelectionSummary | null {
  const selection = $getSelection();
  if (!selection) {
    return null;
  }

  if (!$isRangeSelection(selection)) {
    return {
      kind: selection.constructor.name || 'non-range',
    };
  }

  const anchorNode = selection.anchor.getNode();
  const focusNode = selection.focus.getNode();

  return {
    kind: 'range',
    isCollapsed: selection.isCollapsed(),
    anchorOffset: selection.anchor.offset,
    focusOffset: selection.focus.offset,
    anchorNodeType: anchorNode.getType(),
    focusNodeType: focusNode.getType(),
    selectedNodeCount: selection.getNodes().length,
  };
}

function summarizeExportedChipTarget(chip: ExportedChipTarget): Record<string, unknown> {
  return {
    chipId: chip.chipId,
    targetKind: chip.target.kind,
    nodeIdHash: hashNotebookLogValue(chip.nodeId),
    target: summarizeTarget(chip.target),
  };
}

function summarizeTargetReference(reference: EditorTargetReference): Record<string, unknown> {
  return {
    nodeIdHash: hashNotebookLogValue(reference.nodeId),
    target: summarizeTarget(reference.target),
  };
}

function summarizeHighlightedTarget(target: EditorTarget | null): Record<string, unknown> | null {
  return target ? summarizeTarget(target) : null;
}

function summarizeTarget(target: EditorTarget): Record<string, unknown> {
  if (target.kind === 'ai-id') {
    return {
      kind: target.kind,
      aiIdHash: hashNotebookLogValue(target.aiId),
      instanceIndex: target.instanceIndex,
    };
  }

  return {
    kind: target.kind,
    nodeIdHash: hashNotebookLogValue(target.nodeId),
    tagName: target.tagName,
    selectorKind: target.selectorKind,
    classTokenCount: target.classTokens.length,
    hasAccessibility: Boolean(target.accessibility),
    hasTextPreview: Boolean(target.textPreview),
    hasNearbyText: Boolean(target.nearbyText),
  };
}

function getSelectionSnapshotSignature(snapshot: ReturnType<typeof getNotebookSelectionSnapshot>): string {
  return JSON.stringify({
    document: getSelectionSummarySignature(snapshot.documentSelection),
    shadow: getSelectionSummarySignature(snapshot.shadowSelection),
    active: snapshot.activeElement?.dataAiId ?? snapshot.activeElement?.tagName ?? null,
    shadowActive: snapshot.shadowActiveElement?.dataAiId ?? snapshot.shadowActiveElement?.tagName ?? null,
  });
}

function getSelectionSummarySignature(
  selection: ReturnType<typeof getNotebookSelectionSnapshot>['documentSelection'],
): Record<string, unknown> | null {
  if (!selection) {
    return null;
  }

  return {
    type: selection.type,
    rangeCount: selection.rangeCount,
    isCollapsed: selection.isCollapsed,
    anchorOffset: selection.anchorOffset,
    focusOffset: selection.focusOffset,
    anchorWithinEditor: selection.anchor?.withinEditor ?? null,
    focusWithinEditor: selection.focus?.withinEditor ?? null,
    anchorNodeName: selection.anchor?.nodeName ?? null,
    focusNodeName: selection.focus?.nodeName ?? null,
    anchorChipId: selection.anchor?.nearestChip?.chipId ?? null,
    focusChipId: selection.focus?.nearestChip?.chipId ?? null,
  };
}

function getRootNodeKind(rootNode: Node): LexicalEditorFocusSnapshot['rootNodeKind'] {
  if (typeof ShadowRoot !== 'undefined' && rootNode instanceof ShadowRoot) {
    return 'shadow-root';
  }

  if (rootNode instanceof Document) {
    return 'document';
  }

  return 'other';
}

function getElementTag(element: Element | null): string | null {
  return element ? element.tagName.toLowerCase() : null;
}

function getSafeDataAiId(element: Element | null): string | null {
  if (!(element instanceof HTMLElement)) {
    return null;
  }

  const dataAiId = element.dataset.aiId;
  return dataAiId && dataAiId.startsWith('copy-ai-id-') ? dataAiId : null;
}

function getContentEditableValue(element: Element | null): string | null {
  return element instanceof HTMLElement ? element.contentEditable : null;
}

function isElementWithinRoot(rootElement: HTMLElement, element: Element | null): boolean {
  return element !== null && (element === rootElement || rootElement.contains(element));
}
