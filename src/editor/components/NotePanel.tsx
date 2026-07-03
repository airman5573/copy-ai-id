import { useEffect, useRef, useState, type ReactElement } from 'react';
import { createPortal } from 'react-dom';
import { useShallow } from 'zustand/shallow';

import {
  getNotebookBreakpointScopeCascade,
  NOTEBOOK_BREAKPOINT_SCOPE_ORDER,
  normalizeNotebookBreakpointScopes,
  type NotebookBreakpointScope,
} from '../notebook/breakpoint-scope';
import { getCurrentMessages } from '../../shared/i18n';
import { writeNotebookTargetNotice } from '../notebook/notebook-notice';
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
  const [isNoticeEditorOpen, setNoticeEditorOpen] = useState(false);
  const [noticeDraft, setNoticeDraft] = useState('');
  const noticeTextareaRef = useRef<HTMLTextAreaElement | null>(null);
  // The floating panel shell is transformed and overflow-hidden, so the
  // fixed-position notice dialog must be portaled out to the editor shell.
  const [noticeDialogHost, setNoticeDialogHost] = useState<HTMLElement | null>(null);
  const attachNoticeDialogHostProbe = (node: HTMLDivElement | null): void => {
    if (!node) {
      setNoticeDialogHost(null);
      return;
    }

    const root = node.getRootNode();
    setNoticeDialogHost('querySelector' in root
      ? (root as ParentNode).querySelector<HTMLElement>('[data-ai-id="copy-ai-id-editor-shell"]')
      : null);
  };
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

  useEffect(() => {
    if (!isNoticeEditorOpen) {
      return;
    }

    const frameId = window.requestAnimationFrame(() => {
      noticeTextareaRef.current?.focus();
      noticeTextareaRef.current?.select();
    });

    return () => {
      window.cancelAnimationFrame(frameId);
    };
  }, [isNoticeEditorOpen]);

  const handleCopy = async (): Promise<void> => {
    await copyNotebookDraftFromStore();
  };

  const handleReset = (): void => {
    clearDraft();
    clearVisualEdits();
  };

  const openNoticeEditor = (): void => {
    setNoticeDraft(suffixSettings.targetNotice);
    setNoticeEditorOpen(true);
  };

  const closeNoticeEditor = (): void => {
    setNoticeEditorOpen(false);
  };

  const saveNoticeEditor = async (): Promise<void> => {
    await writeNotebookTargetNotice(noticeDraft);

    const latestSuffixSettings = useNotebookStore.getState().suffixSettings;
    setSuffixSettings({
      ...latestSuffixSettings,
      targetNotice: noticeDraft,
    });
    setNoticeEditorOpen(false);
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
        ref={attachNoticeDialogHostProbe}
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
          data-ai-id="copy-ai-id-editor-note-notice-button"
          title={messages.notebook.noticeDialogTitle}
          aria-label={messages.notebook.noticeDialogTitle}
          aria-haspopup="dialog"
          aria-expanded={isNoticeEditorOpen}
          onClick={openNoticeEditor}
        >
          {messages.notebook.noticeButton}
        </ToolbarButton>
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
        {copyButton}
      </div>

      {isNoticeEditorOpen ? portalNoticeDialog(noticeDialogHost, (
        <div
          className="copy-ai-id-editor-notice-dialog-backdrop"
          data-ai-id="copy-ai-id-editor-notice-dialog-backdrop"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              closeNoticeEditor();
            }
          }}
          onKeyDown={(event) => {
            if (event.key === 'Escape') {
              event.preventDefault();
              closeNoticeEditor();
            }
          }}
        >
          <section
            className="copy-ai-id-editor-notice-dialog"
            data-ai-id="copy-ai-id-editor-notice-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="copy-ai-id-editor-notice-dialog-title"
          >
            <div className="copy-ai-id-editor-notice-dialog__header">
              <h3 id="copy-ai-id-editor-notice-dialog-title">
                {messages.notebook.noticeDialogTitle}
              </h3>
              <p>{messages.notebook.noticeDescription}</p>
            </div>
            <textarea
              ref={noticeTextareaRef}
              className="copy-ai-id-editor-notice-dialog__textarea"
              data-ai-id="copy-ai-id-editor-notice-textarea"
              value={noticeDraft}
              placeholder={messages.notebook.noticePlaceholder}
              spellCheck={false}
              onChange={(event) => setNoticeDraft(event.currentTarget.value)}
            />
            <div className="copy-ai-id-editor-notice-dialog__actions">
              <button
                type="button"
                className="copy-ai-id-editor-notice-dialog__button"
                data-ai-id="copy-ai-id-editor-notice-cancel-button"
                onClick={closeNoticeEditor}
              >
                {messages.notebook.noticeCancel}
              </button>
              <button
                type="button"
                className="copy-ai-id-editor-notice-dialog__button copy-ai-id-editor-notice-dialog__button--primary"
                data-ai-id="copy-ai-id-editor-notice-save-button"
                onClick={() => {
                  void saveNoticeEditor();
                }}
              >
                {messages.notebook.noticeSave}
              </button>
            </div>
          </section>
        </div>
      )) : null}
    </PanelChrome>
  );
}

function portalNoticeDialog(host: HTMLElement | null, dialog: ReactElement) {
  return host ? createPortal(dialog, host) : dialog;
}
