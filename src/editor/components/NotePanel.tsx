import { useEffect, type ReactNode } from 'react';
import { Copy } from 'lucide-react';
import { useShallow } from 'zustand/shallow';

import {
  getNotebookBreakpointScopeCumulativeSelection,
  NOTEBOOK_BREAKPOINT_SCOPE_ORDER,
  type NotebookBreakpointScope,
} from '../notebook/breakpoint-scope';
import { getCurrentMessages } from '../../shared/i18n';
import { clearNotebookCopyStatusReset, copyNotebookDraftFromStore } from '../notebook/copy';
import {
  selectHasNotebookDraftForCopy,
  useNotebookStore,
} from '../stores/useNotebookStore';
import {
  selectHasVisualEdits,
  selectVisualEditRuntimeStatus,
  useVisualEditStore,
} from '../stores/useVisualEditStore';
import { NoteEditor } from './NoteEditor';
import { PanelChrome, ToolbarButton } from './ui/builderChrome';

export interface NotePanelProps {
  dataAiId?: string;
  className?: string;
  dragHandle?: ReactNode;
}

export function NotePanel({
  dataAiId = 'copy-ai-id-editor-floating-note-panel',
  className = '',
  dragHandle = null,
}: NotePanelProps = {}) {
  const messages = getCurrentMessages();
  const panelClassName = [
    'copy-ai-id-editor-note-panel',
    'copy-ai-id-editor-note-panel--floating',
    className,
  ].filter(Boolean).join(' ');
  const draft = useNotebookStore((state) => state.draft);
  const editorStateJson = useNotebookStore((state) => state.editorStateJson);
  const isNotebookEmpty = useNotebookStore((state) => state.isNotebookEmpty);
  const suffixSettings = useNotebookStore((state) => state.suffixSettings);
  const noteFontSize = useNotebookStore((state) => state.noteFontSize);
  const copyStatus = useNotebookStore((state) => state.copyStatus);
  const clearDraft = useNotebookStore((state) => state.clearDraft);
  const setSuffixSettings = useNotebookStore((state) => state.setSuffixSettings);
  const lastBreakpointScopeClick = useNotebookStore((state) => state.lastBreakpointScopeClick);
  const setLastBreakpointScopeClick = useNotebookStore((state) => state.setLastBreakpointScopeClick);
  const hydrateNoteFontSize = useNotebookStore((state) => state.hydrateNoteFontSize);
  const hasNotebookDraftForCopy = useNotebookStore(selectHasNotebookDraftForCopy);
  const visualEditStatus = useVisualEditStore(useShallow(selectVisualEditRuntimeStatus));
  const hasCopyableVisualEdits = useVisualEditStore(selectHasVisualEdits);
  const canCopyNotebook = hasNotebookDraftForCopy || hasCopyableVisualEdits;
  const hasVisualEditState = visualEditStatus.totalCount > 0
    || visualEditStatus.hasPending
    || visualEditStatus.hasErrors;
  const clearVisualEdits = useVisualEditStore((state) => state.clearVisualEdits);

  useEffect(() => {
    void hydrateNoteFontSize();

    return () => {
      clearNotebookCopyStatusReset();
    };
  }, [hydrateNoteFontSize]);

  const handleCopy = async (): Promise<void> => {
    await copyNotebookDraftFromStore();
  };

  const handleReset = (): void => {
    clearDraft();
    clearVisualEdits();
  };

  const toggleScope = (scope: NotebookBreakpointScope): void => {
    const nextScopes = lastBreakpointScopeClick === scope
      ? [scope]
      : getNotebookBreakpointScopeCumulativeSelection(scope);
    const selectsEveryScope = nextScopes.length === NOTEBOOK_BREAKPOINT_SCOPE_ORDER.length;

    setSuffixSettings({
      ...suffixSettings,
      breakpointMode: selectsEveryScope ? 'all' : 'manual',
      breakpointScopes: selectsEveryScope ? [] : nextScopes,
    });
    setLastBreakpointScopeClick(scope);
  };

  const copyButtonLabel = copyStatus === 'copied'
    ? messages.editor.copySuccess
    : copyStatus === 'failed'
      ? messages.editor.copyFailed
      : copyStatus === 'empty'
      ? messages.notebook.empty
      : messages.notebook.save;
  const copyButton = (
    <button
      className={`copy-ai-id-editor-copy-button copy-ai-id-editor-copy-button--${copyStatus}`}
      data-ai-id="copy-ai-id-editor-copy-button"
      data-ai-editor-copy-eligible={canCopyNotebook ? 'true' : 'false'}
      data-ai-editor-copy-has-visual-edits={hasCopyableVisualEdits ? 'true' : 'false'}
      type="button"
      onClick={() => {
        void handleCopy();
      }}
    >
      <Copy size={13} strokeWidth={2.2} aria-hidden="true" />
      <span className="copy-ai-id-editor-copy-button__label">{copyButtonLabel}</span>
      <span
        className="copy-ai-id-editor-copy-button__shortcut"
        data-ai-id="copy-ai-id-editor-copy-shortcut-key"
      >
        · Shift + Enter
      </span>
    </button>
  );

  return (
    <PanelChrome
      side="right"
      dataAiId={dataAiId}
      className={panelClassName}
      data-ai-editor-note-panel-variant="floating"
    >
      {dragHandle}
      <NoteEditor
        draft={draft}
        editorStateJson={editorStateJson}
        fontSize={noteFontSize}
        placeholder={messages.notebook.placeholder}
      />

      <div
        className="copy-ai-id-editor-note-controls"
        data-ai-id="copy-ai-id-editor-note-suffix-controls"
      >
        <div className="copy-ai-id-editor-note-control-group" role="group" aria-label={messages.notebook.breakpointScope.label}>
          {NOTEBOOK_BREAKPOINT_SCOPE_ORDER.map((scope) => (
            <button
              key={scope}
              type="button"
              className={suffixSettings.breakpointMode === 'all' || suffixSettings.breakpointScopes.includes(scope) ? 'is-active' : ''}
              data-ai-id={`copy-ai-id-editor-note-scope-${scope}-button`}
              aria-pressed={suffixSettings.breakpointMode === 'all' || suffixSettings.breakpointScopes.includes(scope)}
              onClick={() => toggleScope(scope)}
            >
              {messages.notebook.breakpointScope[scope]}
            </button>
          ))}
        </div>

        <ToolbarButton
          data-ai-id="copy-ai-id-editor-note-reset-button"
          disabled={isNotebookEmpty && !hasVisualEditState}
          title={messages.notebook.reset}
          aria-label={messages.notebook.reset}
          onClick={handleReset}
        >
          {messages.notebook.reset}
        </ToolbarButton>
        {copyButton}
      </div>
    </PanelChrome>
  );
}
