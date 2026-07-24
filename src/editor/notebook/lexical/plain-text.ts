import {
  $createParagraphNode,
  $createTextNode,
  $getRoot,
  type ElementNode,
} from 'lexical';

/**
 * Replace the notebook editor content with plain-text paragraphs.
 *
 * Used to sync the Lexical editor when the store draft changes externally
 * (e.g., an explicit reset or page-identity change). Chip insertions are owned by
 * ChipNode; this only renders plain text.
 */
export function $setNotebookPlainText(value: string): void {
  const root = $getRoot();
  root.clear();

  for (const line of notebookTextToLines(value)) {
    root.append($createPlainTextParagraph(line));
  }
}

function notebookTextToLines(value: string): string[] {
  const normalized = value.replace(/\r\n?/g, '\n');
  return normalized.length > 0 ? normalized.split('\n') : [''];
}

function $createPlainTextParagraph(line: string): ElementNode {
  const paragraph = $createParagraphNode();

  if (line.length > 0) {
    paragraph.append($createTextNode(line));
  }

  return paragraph;
}
