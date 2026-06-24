import { useEffect, useRef, useState } from 'react';
import { Minus, Plus, RotateCcw, StickyNote } from 'lucide-react';

import {
  getNotebookBreakpointScopeCascade,
  NOTEBOOK_BREAKPOINT_SCOPE_ORDER,
  normalizeNotebookBreakpointScopes,
  type NotebookBreakpointScope,
} from '../notebook/breakpoint-scope';
import { getCurrentMessages } from '../../shared/i18n';
import { writeNotebookTargetNotice } from '../../shared/notebook-notice';
import { clearNotebookCopyStatusReset, copyNotebookDraftFromStore } from '../notebook/copy';
import {
  DEFAULT_NOTE_FONT_SIZE,
  MAX_NOTE_FONT_SIZE,
  MIN_NOTE_FONT_SIZE,
  selectHasNotebookDraftForCopy,
  useNotebookStore,
} from '../stores/useNotebookStore';
import {
  selectHasCopyableVisualEdits,
  selectVisualEditRuntimeStatus,
  useVisualEditStore,
} from '../stores/useVisualEditStore';
import { NoteEditor } from './NoteEditor';
import { PanelChrome, ToolbarButton } from './ui/builderChrome';

export function NotePanel() {
  const messages = getCurrentMessages();
  const [isNoticeEditorOpen, setNoticeEditorOpen] = useState(false);
  const [noticeDraft, setNoticeDraft] = useState('');
  const noticeTextareaRef = useRef<HTMLTextAreaElement | null>(null);
  const draft = useNotebookStore((state) => state.draft);
  const editorStateJson = useNotebookStore((state) => state.editorStateJson);
  const isNotebookEmpty = useNotebookStore((state) => state.isNotebookEmpty);
  const suffixSettings = useNotebookStore((state) => state.suffixSettings);
  const noteFontSize = useNotebookStore((state) => state.noteFontSize);
  const copyStatus = useNotebookStore((state) => state.copyStatus);
  const clearDraft = useNotebookStore((state) => state.clearDraft);
  const setSuffixSettings = useNotebookStore((state) => state.setSuffixSettings);
  const hydrateNoteFontSize = useNotebookStore((state) => state.hydrateNoteFontSize);
  const stepNoteFontSize = useNotebookStore((state) => state.stepNoteFontSize);
  const resetNoteFontSize = useNotebookStore((state) => state.resetNoteFontSize);
  const hasNotebookDraftForCopy = useNotebookStore(selectHasNotebookDraftForCopy);
  const visualEditStatus = useVisualEditStore(selectVisualEditRuntimeStatus);
  const hasCopyableVisualEdits = useVisualEditStore(selectHasCopyableVisualEdits);
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
  const copyButtonDescriptionId = visualEditStatus.hasHiddenPromptText
    ? 'copy-ai-id-editor-copy-shortcut-hint copy-ai-id-editor-hidden-visual-prompt-status'
    : 'copy-ai-id-editor-copy-shortcut-hint';

  return (
    <PanelChrome side="right" dataAiId="copy-ai-id-editor-note-panel">
      <div className="copy-ai-id-editor-panel__header copy-ai-id-editor-panel__header--with-action">
        <div className="copy-ai-id-editor-panel__title">
          <StickyNote size={16} aria-hidden="true" />
          <h2>{messages.editor.notePanel}</h2>
        </div>
        <div className="copy-ai-id-editor-panel__actions">
          <div
            className="copy-ai-id-editor-note-font-size-controls"
            data-ai-id="copy-ai-id-editor-note-font-size-controls"
            role="group"
            aria-label={messages.notebook.fontSize}
          >
            <ToolbarButton
              className="copy-ai-id-editor-note-font-size-button"
              data-ai-id="copy-ai-id-editor-note-font-size-decrease-button"
              disabled={noteFontSize <= MIN_NOTE_FONT_SIZE}
              title={`${messages.notebook.fontSizeDecrease} (${noteFontSize}px)`}
              aria-label={`${messages.notebook.fontSizeDecrease} (${noteFontSize}px)`}
              onClick={() => stepNoteFontSize(-1)}
            >
              <Minus size={14} aria-hidden="true" />
            </ToolbarButton>
            <ToolbarButton
              className="copy-ai-id-editor-note-font-size-button"
              data-ai-id="copy-ai-id-editor-note-font-size-reset-button"
              disabled={noteFontSize === DEFAULT_NOTE_FONT_SIZE}
              title={`${messages.notebook.fontSizeReset} (${DEFAULT_NOTE_FONT_SIZE}px)`}
              aria-label={`${messages.notebook.fontSizeReset} (${DEFAULT_NOTE_FONT_SIZE}px)`}
              onClick={resetNoteFontSize}
            >
              <RotateCcw size={14} aria-hidden="true" />
            </ToolbarButton>
            <ToolbarButton
              className="copy-ai-id-editor-note-font-size-button"
              data-ai-id="copy-ai-id-editor-note-font-size-increase-button"
              disabled={noteFontSize >= MAX_NOTE_FONT_SIZE}
              title={`${messages.notebook.fontSizeIncrease} (${noteFontSize}px)`}
              aria-label={`${messages.notebook.fontSizeIncrease} (${noteFontSize}px)`}
              onClick={() => stepNoteFontSize(1)}
            >
              <Plus size={14} aria-hidden="true" />
            </ToolbarButton>
          </div>
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
        </div>
      </div>

      <NoteEditor
        draft={draft}
        editorStateJson={editorStateJson}
        fontSize={noteFontSize}
        placeholder={messages.notebook.placeholder}
      />

      <HiddenVisualPromptStatus status={visualEditStatus} />

      <div className="copy-ai-id-editor-note-controls" data-ai-id="copy-ai-id-editor-note-suffix-controls">
        <div className="copy-ai-id-editor-note-control-group" role="group" aria-label={messages.notebook.breakpointScope.label}>
          <span>{messages.notebook.breakpointScope.label}</span>
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
      </div>

      <div className="copy-ai-id-editor-copy-actions" data-ai-id="copy-ai-id-editor-copy-actions">
        <button
          className={`copy-ai-id-editor-copy-button copy-ai-id-editor-copy-button--${copyStatus}`}
          data-ai-id="copy-ai-id-editor-copy-button"
          data-ai-editor-copy-eligible={canCopyNotebook ? 'true' : 'false'}
          data-ai-editor-copy-has-visual-edits={hasCopyableVisualEdits ? 'true' : 'false'}
          type="button"
          aria-describedby={copyButtonDescriptionId}
          onClick={() => {
            void handleCopy();
          }}
        >
          {copyButtonLabel}
        </button>
        <span
          id="copy-ai-id-editor-copy-shortcut-hint"
          className="copy-ai-id-editor-copy-shortcut"
          data-ai-id="copy-ai-id-editor-copy-shortcut-hint"
        >
          <span data-ai-id="copy-ai-id-editor-copy-shortcut-label">{messages.notebook.copyShortcutLabel}</span>
          <kbd data-ai-id="copy-ai-id-editor-copy-shortcut-key">Shift + Enter</kbd>
        </span>
      </div>

      {isNoticeEditorOpen ? (
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
      ) : null}
    </PanelChrome>
  );
}

function HiddenVisualPromptStatus({
  status,
}: {
  status: ReturnType<typeof selectVisualEditRuntimeStatus>;
}) {
  if (!status.hasHiddenPromptText && !status.hasPending && !status.hasErrors) {
    return null;
  }

  return (
    <div
      id="copy-ai-id-editor-hidden-visual-prompt-status"
      className="copy-ai-id-editor-hidden-visual-prompt-status"
      data-ai-id="copy-ai-id-editor-hidden-visual-prompt-status"
      data-ai-editor-hidden-visual-prompt="true"
      role={status.hasErrors ? 'alert' : 'status'}
      aria-live={status.hasErrors ? 'assertive' : 'polite'}
    >
      <strong data-ai-id="copy-ai-id-editor-hidden-visual-prompt-status-title">
        Visual edits {status.hiddenPromptCount}개 저장됨
      </strong>
      <span data-ai-id="copy-ai-id-editor-hidden-visual-prompt-status-message">
        편집 프롬프트 내용은 노트에 표시하지 않고, 복사할 때만 <code>## Visual edits</code>로 클립보드에 포함됩니다.
      </span>
      {status.hasPending || status.hasErrors ? (
        <span
          className="copy-ai-id-editor-hidden-visual-prompt-status__meta"
          data-ai-id="copy-ai-id-editor-hidden-visual-prompt-status-meta"
        >
          {status.hasPending ? `적용 중 ${status.pendingCount}개` : null}
          {status.hasPending && status.hasErrors ? ' · ' : null}
          {status.hasErrors ? `실패 ${status.failedCount}개${status.latestErrorCode ? ` (${status.latestErrorCode})` : ''}` : null}
        </span>
      ) : null}
    </div>
  );
}
