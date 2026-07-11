import { useEffect } from 'react';
import { useShallow } from 'zustand/shallow';

import {
  getNotebookBreakpointScopeCascade,
  NOTEBOOK_BREAKPOINT_SCOPE_ORDER,
  normalizeNotebookBreakpointScopes,
  type NotebookBreakpointScope,
} from '../notebook/breakpoint-scope';
import { getCurrentMessages } from '../../shared/i18n';
import { sendNotebookDraftToCodex } from '../notebook/codex-send';
import { clearNotebookCopyStatusReset, copyNotebookDraftFromStore } from '../notebook/copy';
import { useCodexStore } from '../stores/useCodexStore';
import {
  selectHasNotebookDraftForCopy,
  useNotebookStore,
} from '../stores/useNotebookStore';
import {
  selectHasVisualEdits,
  selectVisualEditRuntimeStatus,
  useVisualEditStore,
} from '../stores/useVisualEditStore';
import { useCodexSetupStore } from '../stores/useCodexSetupStore';
import { CodexSetupButton } from './CodexSetupButton';
import { NoteEditor } from './NoteEditor';
import { PanelChrome, ToolbarButton } from './ui/builderChrome';

export interface NotePanelProps {
  dataAiId?: string;
  className?: string;
}

export function NotePanel({
  dataAiId = 'copy-ai-id-editor-floating-note-panel',
  className = '',
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

  const setBreakpointMode = (): void => {
    setSuffixSettings({
      ...suffixSettings,
      breakpointMode: 'all',
      breakpointScopes: [],
    });
  };

  const toggleScope = (scope: NotebookBreakpointScope): void => {
    if (suffixSettings.breakpointMode === 'all') {
      setSuffixSettings({
        ...suffixSettings,
        breakpointMode: 'manual',
        breakpointScopes: getNotebookBreakpointScopeCascade(scope),
      });
      return;
    }

    const nextScopes = suffixSettings.breakpointScopes.includes(scope)
      ? suffixSettings.breakpointScopes.filter((selectedScope) => selectedScope !== scope)
      : normalizeNotebookBreakpointScopes([...suffixSettings.breakpointScopes, scope]);

    setSuffixSettings({
      ...suffixSettings,
      breakpointMode: nextScopes.length > 0 ? 'manual' : 'all',
      breakpointScopes: nextScopes,
    });
  };

  const copyButtonLabel = copyStatus === 'copied'
    ? messages.editor.copySuccess
    : copyStatus === 'failed'
      ? messages.editor.copyFailed
      : copyStatus === 'empty'
      ? messages.notebook.empty
      : messages.notebook.save;
  const codexPhase = useCodexStore((state) => state.phase);
  const codexSetupStatus = useCodexSetupStore((state) => state.status);
  const isCodexSetupReady = codexSetupStatus === 'ready';
  const codexButtonLabel = codexPhase === 'resolving'
    ? messages.codex.resolving
    : codexPhase === 'running'
      ? messages.codex.running
      : messages.codex.send;
  const codexButtonTitle = isCodexSetupReady
    ? messages.codex.sendTitle
    : codexSetupStatus === 'not-ready'
      ? messages.codex.setup.statusDescription.notReady
      : messages.codex.setup.statusDescription[codexSetupStatus];
  const codexButton = (
    <button
      className={`copy-ai-id-editor-copy-button copy-ai-id-editor-codex-button copy-ai-id-editor-codex-button--${codexPhase}`}
      data-ai-id="copy-ai-id-editor-codex-button"
      data-codex-setup-status={codexSetupStatus}
      type="button"
      title={codexButtonTitle}
      aria-label={codexButtonTitle}
      disabled={codexPhase !== 'idle' || !isCodexSetupReady}
      onClick={(event) => {
        if (!event.isTrusted) {
          return;
        }

        void sendNotebookDraftToCodex();
      }}
    >
      {codexButtonLabel}
    </button>
  );
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
      {copyButtonLabel}
    </button>
  );

  return (
    <PanelChrome
      side="right"
      dataAiId={dataAiId}
      className={panelClassName}
      data-ai-editor-note-panel-variant="floating"
    >
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
          <button
            type="button"
            className={suffixSettings.breakpointMode === 'all' ? 'is-active' : ''}
            data-ai-id="copy-ai-id-editor-note-scope-all-button"
            aria-pressed={suffixSettings.breakpointMode === 'all'}
            onClick={setBreakpointMode}
          >
            {messages.notebook.breakpointScope.all}
          </button>
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

        <label className="copy-ai-id-editor-note-tailwind" data-ai-id="copy-ai-id-editor-note-tailwind-toggle">
          <input
            type="checkbox"
            checked={suffixSettings.tailwindEnabled}
            onChange={(event) => setSuffixSettings({
              ...suffixSettings,
              tailwindEnabled: event.currentTarget.checked,
            })}
          />
          <span>{messages.notebook.tailwind}</span>
        </label>

        <ToolbarButton
          data-ai-id="copy-ai-id-editor-note-reset-button"
          disabled={isNotebookEmpty && !hasVisualEditState}
          title={messages.notebook.reset}
          aria-label={messages.notebook.reset}
          onClick={handleReset}
        >
          {messages.notebook.reset}
        </ToolbarButton>
        <span
          className="copy-ai-id-editor-copy-shortcut"
          data-ai-id="copy-ai-id-editor-copy-shortcut-hint"
          title={messages.notebook.copyShortcutLabel}
        >
          <kbd data-ai-id="copy-ai-id-editor-copy-shortcut-key">Shift + Enter</kbd>
        </span>
        <CodexSetupButton placement="note-panel" />
        {codexButton}
        {copyButton}
      </div>
    </PanelChrome>
  );
}
