# Chrome Web Store Clipboard Disclosure

Generated: 2026-04-26 03:44 KST
Updated: 2026-06-23 KST — AI-friendly Markdown copied notes

## Current code behavior

Clipboard writes are centralized in:

```txt
src/content/clipboard/clipboard.ts
```

The React editor copy flow is:

```txt
src/editor/components/NotePanel.tsx
  -> copyNotebookDraftFromStore()
  -> formatNotebookCopyBody(trimmedDraft, activeChipTargets)
  -> appendNotebookSuffixes(markdownBody, suffixSettings)
  -> copyText(...)
  -> navigator.clipboard.writeText(value)
```

This means Copy AI ID writes to the clipboard only after the user explicitly clicks **Copy** in the note panel or presses **Shift + Enter** while the editor is active. Hovering, highlighting, selecting, toggling the editor with **Shift + Z + Space**, opening the layout tree, and typing notes do not write to the clipboard.

## Copied text

The copied value is an AI-friendly Markdown document generated from the current notebook draft and the selected chip targets:

- `## Requests` preserves the user-authored notebook text and renders notebook chips as readable `@el-N` mentions.
- `## Targets` maps each chip to either a stable `data-ai-id` target or a fallback target. Fallback details include selector, selector type/reliability, DOM path, and concise context when available.
- `## Rules` contains optional viewport scope suffixes, optional `works with tailwind only`, the target notice that the `data-ai-id` attribute itself must not be changed, and an additional fallback-reference notice when fallback targets are present.

If the notebook draft is empty, Copy AI ID shows an empty-state copy status and does not write to the clipboard.

After a successful copy, the visible notebook draft is cleared.

## Disclosure wording

> Copy AI ID writes text to the clipboard only when the user explicitly clicks Copy or presses Shift + Enter in the editor. The copied text may include user-entered note text, selected `data-ai-id` references, generated fallback target details with selector/path/context metadata, and Copy AI ID's optional editing-scope suffixes. The extension does not write to the clipboard merely from hovering, selecting, opening the editor, or navigating a page.
