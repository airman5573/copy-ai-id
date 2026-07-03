import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type FocusEvent,
  type FormEvent,
  type ReactElement,
  type ReactNode,
} from 'react';

import { sanitizeVisualHtmlFragment } from '../../../shared/visual-html';
import { useContentEdit } from '../../visual/useContentEdit';
import { VisualControl } from '../visual/VisualControl';
import { AttributeControls } from './AttributeControls';
import { FormValueControls } from './FormValueControls';
import { LinkControls } from './LinkControls';

export type ContentControlsProps = {
  disabled?: boolean;
};

const CONTENT_COMMIT_DELAY_MS = 450;

export function ContentControls({ disabled = false }: ContentControlsProps): ReactElement {
  const edit = useContentEdit();
  const canEdit = edit.canEdit && !disabled;

  return (
    <div className="space-y-4" data-ai-id="copy-ai-id-editor-visual-content-controls">
      <ContentControlGroup
        title="Text"
        dataAiId="copy-ai-id-editor-content-text-group"
      >
        <PlainTextContentControl
          canEdit={canEdit}
          targetKey={edit.targetKey}
          value={edit.textValue}
          onCommit={(value) => edit.commitText(value, {
            control: { id: 'content:text', label: 'Plain text' },
          })}
        />
      </ContentControlGroup>

      <FormValueControls disabled={!canEdit} />
      <LinkControls disabled={!canEdit} />
      <AttributeControls disabled={!canEdit} />

      <ContentControlGroup
        title="Rich HTML"
        dataAiId="copy-ai-id-editor-content-rich-html-group"
      >
        <RichHtmlContentControl
          canEdit={canEdit}
          targetKey={edit.targetKey}
          value={edit.richHtml}
          onCommit={(value) => edit.commitRichHtml(value, {
            control: { id: 'content:rich-html', label: 'Rich HTML' },
          })}
        />
      </ContentControlGroup>
    </div>
  );
}

function PlainTextContentControl({
  canEdit,
  targetKey,
  value,
  onCommit,
}: {
  canEdit: boolean;
  targetKey: string;
  value: string;
  onCommit: (value: string) => void;
}): ReactElement {
  const [draft, setDraft] = useState(value);
  const focusedRef = useRef(false);
  const lastDispatchedRef = useRef<string | null>(null);

  useEffect(() => {
    if (!focusedRef.current) {
      setDraft(value);
      lastDispatchedRef.current = null;
    }
  }, [targetKey, value]);

  const commit = useCallback((nextValue: string) => {
    if (!canEdit || nextValue === value || nextValue === lastDispatchedRef.current) {
      return;
    }

    lastDispatchedRef.current = nextValue;
    onCommit(nextValue);
  }, [canEdit, onCommit, value]);

  useEffect(() => {
    if (!canEdit || draft === value || draft === lastDispatchedRef.current) {
      return;
    }

    const timer = window.setTimeout(() => commit(draft), CONTENT_COMMIT_DELAY_MS);
    return () => window.clearTimeout(timer);
  }, [canEdit, commit, draft, value]);

  return (
    <VisualControl
      label="Plain text"
      dataAiId="copy-ai-id-editor-content-plain-text-control"
      helperText="입력을 멈추면 자동 적용되고, blur 시 즉시 적용됩니다. input/textarea/select는 value로, 일반 요소는 textContent로 반영됩니다."
      disabled={!canEdit}
    >
      <textarea
        value={draft}
        disabled={!canEdit}
        rows={5}
        className="w-full resize-y rounded-lg border border-gray-700 bg-gray-950/80 px-3 py-2 font-mono text-[11px] leading-relaxed text-gray-100 outline-none transition placeholder:text-gray-500 focus:border-blue-500/70 focus:ring-2 focus:ring-blue-500/30 disabled:cursor-not-allowed disabled:text-gray-600"
        placeholder="선택 요소의 텍스트를 입력하세요."
        onFocus={() => {
          focusedRef.current = true;
        }}
        onChange={(event) => setDraft(event.currentTarget.value)}
        onBlur={() => {
          focusedRef.current = false;
          commit(draft);
        }}
        onKeyDown={(event) => {
          if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') {
            event.preventDefault();
            commit(draft);
          }
          if (event.key === 'Escape') {
            event.preventDefault();
            setDraft(value);
            event.currentTarget.blur();
          }
        }}
        data-ai-id="copy-ai-id-editor-content-plain-text-textarea"
      />
    </VisualControl>
  );
}

function RichHtmlContentControl({
  canEdit,
  targetKey,
  value,
  onCommit,
}: {
  canEdit: boolean;
  targetKey: string;
  value: string;
  onCommit: (value: string) => void;
}): ReactElement {
  const [draft, setDraft] = useState(value);
  const [sanitizeNotice, setSanitizeNotice] = useState('');
  const richEditorRef = useRef<HTMLDivElement | null>(null);
  const focusedSurfaceRef = useRef<'editor' | 'source' | null>(null);
  const lastDispatchedRef = useRef<string | null>(null);

  useEffect(() => {
    if (focusedSurfaceRef.current === null) {
      setDraft(value);
      lastDispatchedRef.current = null;
    }
  }, [targetKey, value]);

  useEffect(() => {
    const editor = richEditorRef.current;
    if (!editor || focusedSurfaceRef.current === 'editor' || editor.innerHTML === draft) {
      return;
    }

    editor.innerHTML = draft;
  }, [draft]);

  const commit = useCallback((nextValue: string) => {
    if (!canEdit) {
      return;
    }

    const sanitized = sanitizeVisualHtmlFragment(nextValue);
    setSanitizeNotice(formatSanitizeNotice(sanitized.changed, sanitized.strippedRuntimeArtifacts.length));

    if (sanitized.html !== nextValue) {
      setDraft(sanitized.html);
      if (richEditorRef.current && focusedSurfaceRef.current !== 'editor') {
        richEditorRef.current.innerHTML = sanitized.html;
      }
    }

    if (sanitized.html === value || sanitized.html === lastDispatchedRef.current) {
      return;
    }

    lastDispatchedRef.current = sanitized.html;
    onCommit(nextValue);
  }, [canEdit, onCommit, value]);

  useEffect(() => {
    if (!canEdit || draft === value || draft === lastDispatchedRef.current) {
      return;
    }

    const timer = window.setTimeout(() => commit(draft), CONTENT_COMMIT_DELAY_MS);
    return () => window.clearTimeout(timer);
  }, [canEdit, commit, draft, value]);

  const handleEditorInput = (event: FormEvent<HTMLDivElement>): void => {
    setDraft(event.currentTarget.innerHTML);
  };

  const handleEditorBlur = (event: FocusEvent<HTMLDivElement>): void => {
    if (event.currentTarget.contains(event.relatedTarget as Node | null)) {
      return;
    }

    focusedSurfaceRef.current = null;
    commit(event.currentTarget.innerHTML);
  };

  return (
    <div className="space-y-3" data-ai-id="copy-ai-id-editor-content-rich-html-control">
      <VisualControl
        label="Rich text editor"
        dataAiId="copy-ai-id-editor-content-rich-html-editor-control"
        helperText="보이는 텍스트를 직접 수정하면 sanitized innerHTML로 preview에 반영됩니다."
        disabled={!canEdit}
      >
        <div
          ref={richEditorRef}
          className="min-h-28 max-h-56 overflow-auto rounded-lg border border-gray-700 bg-gray-950/80 px-3 py-2 text-[12px] leading-relaxed text-gray-100 outline-none transition empty:before:text-gray-600 empty:before:content-[attr(data-placeholder)] focus:border-blue-500/70 focus:ring-2 focus:ring-blue-500/30 aria-disabled:cursor-not-allowed aria-disabled:text-gray-600"
          contentEditable={canEdit}
          suppressContentEditableWarning
          role="textbox"
          aria-multiline="true"
          aria-disabled={!canEdit}
          data-placeholder="Rich text를 입력하세요."
          onFocus={() => {
            focusedSurfaceRef.current = 'editor';
          }}
          onInput={handleEditorInput}
          onBlur={handleEditorBlur}
          onKeyDown={(event) => {
            if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') {
              event.preventDefault();
              commit(event.currentTarget.innerHTML);
              event.currentTarget.blur();
            }
            if (event.key === 'Escape') {
              event.preventDefault();
              setDraft(value);
              event.currentTarget.blur();
            }
          }}
          data-ai-id="copy-ai-id-editor-content-rich-html-editor"
        />
      </VisualControl>

      <VisualControl
        label="HTML source"
        dataAiId="copy-ai-id-editor-content-rich-html-source-control"
        helperText="내부 tag까지 직접 수정합니다. script, event handler, javascript URL, extension runtime attribute는 제거됩니다."
        disabled={!canEdit}
        errorText={sanitizeNotice || undefined}
      >
        <textarea
          value={draft}
          disabled={!canEdit}
          rows={7}
          className="w-full resize-y rounded-lg border border-gray-700 bg-gray-950/80 px-3 py-2 font-mono text-[11px] leading-relaxed text-gray-100 outline-none transition placeholder:text-gray-500 focus:border-blue-500/70 focus:ring-2 focus:ring-blue-500/30 disabled:cursor-not-allowed disabled:text-gray-600"
          placeholder="<span>수정할 HTML</span>"
          spellCheck={false}
          onFocus={() => {
            focusedSurfaceRef.current = 'source';
          }}
          onChange={(event) => setDraft(event.currentTarget.value)}
          onBlur={() => {
            focusedSurfaceRef.current = null;
            commit(draft);
          }}
          onKeyDown={(event) => {
            if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') {
              event.preventDefault();
              commit(draft);
              event.currentTarget.blur();
            }
            if (event.key === 'Escape') {
              event.preventDefault();
              setDraft(value);
              event.currentTarget.blur();
            }
          }}
          data-ai-id="copy-ai-id-editor-content-rich-html-source-textarea"
        />
      </VisualControl>
    </div>
  );
}

function ContentControlGroup({
  title,
  dataAiId,
  children,
}: {
  title: string;
  dataAiId: string;
  children: ReactNode;
}): ReactElement {
  return (
    <section
      className="rounded-xl border border-gray-800 bg-gray-950/45 p-3.5 shadow-sm"
      data-ai-id={dataAiId}
    >
      <div className="mb-3" data-ai-id={`${dataAiId}-header`}>
        <h4 className="text-[11px] font-bold uppercase tracking-[0.14em] text-blue-300" data-ai-id={`${dataAiId}-title-text`}>
          {title}
        </h4>
      </div>
      <div className="space-y-3" data-ai-id={`${dataAiId}-body`}>
        {children}
      </div>
    </section>
  );
}

function formatSanitizeNotice(changed: boolean, strippedCount: number): string {
  if (!changed) {
    return '';
  }

  if (strippedCount > 0) {
    return `안전하지 않거나 runtime 전용인 HTML 조각 ${strippedCount}개를 제거했습니다.`;
  }

  return '안전한 HTML fragment로 정리한 뒤 적용했습니다.';
}
