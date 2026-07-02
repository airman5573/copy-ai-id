# Lexical notebook module

This directory is the isolated home for the notebook chip editor migration. Keep
Lexical-specific node, plugin, import, and export code here so the existing
notebook store/copy/session modules only depend on small public helpers.

Planned module split:

- `ChipNode.ts` — custom Lexical `TextNode` for stable `el-N` chips.
- `chip-export.ts` — export Lexical editor state to copied note text, active chip targets, and fallback detection.
- `plain-text.ts` — replace editor content with plain-text paragraphs when the store draft changes externally.
- `NotebookLexicalEditor.tsx` — React editor surface that replaces the old textarea internals.
- `NotebookEditorPlugins.tsx` — focused plugins for insertion, focus/hover protection, export sync, and chip clicks.

Reference-only local Lexical source paths:

- `/Users/yoon/Downloads/lexical-main/packages/lexical-playground/src/nodes/MentionNode.ts`
  - Inline `TextNode` metadata, JSON import/export, `isTextEntity()`, and insertion boundary behavior.
- `/Users/yoon/Downloads/lexical-main/packages/lexical-playground/src/nodes/EmojiNode.tsx`
  - `setMode('token')` pattern for atomic token deletion behavior.
- `/Users/yoon/Downloads/lexical-main/examples/react-plain-text/src/App.tsx`
  - Minimal React wiring with `LexicalComposer`, `PlainTextPlugin`, and `ContentEditable`.

Do not import from `/Users/yoon/Downloads/lexical-main` or add it as a local
runtime dependency. Use published npm packages only.
