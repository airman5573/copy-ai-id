import {
  $createParagraphNode,
  $createTextNode,
  $getRoot,
  type ElementNode,
} from 'lexical';

export function isLegacyNotebookDraftValue(value: unknown): value is string {
  return typeof value === 'string';
}

export function normalizeLegacyNotebookText(value: string): string {
  return value.replace(/\r\n?/g, '\n');
}

export function legacyNotebookTextToLines(value: string): string[] {
  const normalized = normalizeLegacyNotebookText(value);
  return normalized.length > 0 ? normalized.split('\n') : [''];
}

export function $initializeNotebookFromLegacyText(value: string): void {
  // Preserve legacy raw `[fallback target]` blocks and old `[data-ai-id]`
  // references as editable/copyable text. New target insertions should create
  // ChipNode tokens instead of converting or regenerating this raw format.
  const root = $getRoot();
  root.clear();

  for (const line of legacyNotebookTextToLines(value)) {
    root.append($createLegacyTextParagraph(line));
  }
}

function $createLegacyTextParagraph(line: string): ElementNode {
  const paragraph = $createParagraphNode();

  if (line.length > 0) {
    paragraph.append($createTextNode(line));
  }

  return paragraph;
}
