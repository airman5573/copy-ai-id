import { useMemo, useRef } from 'react';
import { ContentEditable } from '@lexical/react/LexicalContentEditable';
import { LexicalComposer, type InitialConfigType } from '@lexical/react/LexicalComposer';
import { LexicalErrorBoundary } from '@lexical/react/LexicalErrorBoundary';
import { PlainTextPlugin } from '@lexical/react/LexicalPlainTextPlugin';

import { protectEditorInteractionFromHover } from '../../note-hover-guard';
import { ChipNode } from './ChipNode';
import { $initializeNotebookFromLegacyText } from './chip-import';
import { NotebookEditorPlugins } from './NotebookEditorPlugins';

interface NotebookLexicalEditorProps {
  draft: string;
  editorStateJson: string | null;
  fontSize: number;
  placeholder: string;
}

const NOTEBOOK_LEXICAL_NAMESPACE = 'copy-ai-id-notebook';

export function NotebookLexicalEditor({
  draft,
  editorStateJson,
  fontSize,
  placeholder,
}: NotebookLexicalEditorProps) {
  const initialDraftRef = useRef(draft);
  const initialEditorStateJsonRef = useRef(editorStateJson);
  const initialConfig = useMemo<InitialConfigType>(() => ({
    namespace: NOTEBOOK_LEXICAL_NAMESPACE,
    nodes: [ChipNode],
    onError(error: Error) {
      throw error;
    },
    editorState: initialEditorStateJsonRef.current ?? (() => {
      $initializeNotebookFromLegacyText(initialDraftRef.current);
    }),
  }), []);

  return (
    <LexicalComposer initialConfig={initialConfig}>
      <div className="copy-ai-id-editor-note-lexical" data-ai-id="copy-ai-id-editor-note-lexical">
        <PlainTextPlugin
          contentEditable={(
            <ContentEditable
              className="copy-ai-id-editor-note-contenteditable"
              data-ai-id="copy-ai-id-editor-note-lexical-editor"
              role="textbox"
              aria-label={placeholder}
              aria-multiline="true"
              spellCheck={false}
              style={{ fontSize: `${fontSize}px` }}
              onFocus={() => protectEditorInteractionFromHover()}
              onKeyDown={() => protectEditorInteractionFromHover()}
              onInput={() => protectEditorInteractionFromHover()}
              onPaste={() => protectEditorInteractionFromHover()}
            />
          )}
          placeholder={(
            <div
              className="copy-ai-id-editor-note-placeholder"
              data-ai-id="copy-ai-id-editor-note-placeholder"
              style={{ fontSize: `${fontSize}px` }}
            >
              {placeholder}
            </div>
          )}
          ErrorBoundary={LexicalErrorBoundary}
        />
        <NotebookEditorPlugins draft={draft} />
      </div>
    </LexicalComposer>
  );
}
