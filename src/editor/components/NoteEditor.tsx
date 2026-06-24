import { NotebookLexicalEditor } from '../notebook/lexical/NotebookLexicalEditor';

interface NoteEditorProps {
  draft: string;
  editorStateJson: string | null;
  fontSize: number;
  placeholder: string;
}

export function NoteEditor({
  draft,
  editorStateJson,
  fontSize,
  placeholder,
}: NoteEditorProps) {
  return (
    <div className="copy-ai-id-editor-note-editor" data-ai-id="copy-ai-id-editor-note-editor">
      <NotebookLexicalEditor
        draft={draft}
        editorStateJson={editorStateJson}
        fontSize={fontSize}
        placeholder={placeholder}
      />
    </div>
  );
}
