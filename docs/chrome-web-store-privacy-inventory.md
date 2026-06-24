# Chrome Web Store Privacy Data Inventory

Generated: 2026-04-26 03:41 KST
Updated: 2026-06-24 KST — preview-only visual edit inventory

## Summary for Chrome Web Store privacy fields

Copy AI ID is a developer/QA browser extension for inspecting rendered DOM targets, preferring stable `data-ai-id` attributes, viewing a DOM layout tree, previewing the current page at responsive iframe widths, making preview-only visual edits, writing local note text, and copying that note/visual-edit bundle after an explicit user action. For elements without usable `data-ai-id`, it can generate fallback target metadata locally.

The extension does not sell user data, does not use advertising IDs, does not run analytics, does not include a native host, and does not send notes, visual edits, or page content to a remote service. Current editor state is runtime-only in the extension/page context. Preview-only visual edits mutate only the local iframe preview DOM and become clipboard instructions only after explicit copy.

## Data surfaces

| Surface | Files | Data involved | Storage/transfer | Disclosure classification |
| --- | --- | --- | --- | --- |
| Rendered page layout tree | `src/content/editor-bridge/layout-tree.ts`, `src/content/editor-bridge/fallback-target.ts`, `src/shared/editor-messages.ts` | Tag names, class tokens, direct text previews, visibility, `data-ai-id` values, and fallback metadata such as generated selectors, selector type/reliability, DOM path, concise nearby text, and accessibility context from the current preview document | Read from the current page only while editor/preview bridge is active; sent by `postMessage` from preview frame to the top-frame editor shell | Website/page content used locally for the extension's single purpose |
| Selected target reference | `src/content/editor-bridge/highlight.ts`, `src/content/editor-bridge/fallback-target.ts`, `src/editor/stores/useHighlightStore.ts` | Either selected `data-ai-id` plus duplicate instance index, or generated fallback metadata with selector/path/context details for no-ID elements | Runtime-only editor state; included in copied target details only when the user selects/adds it | Website/page content used locally |
| Notebook draft text | `src/editor/stores/useNotebookStore.ts`, `src/editor/components/NotePanel.tsx` | User-entered note text, selected `data-ai-id` references, and selected fallback target metadata | Runtime-only Zustand state in the editor context; cleared after successful copy | User-provided content and selected website/page metadata used locally |
| Notebook suffix controls | `src/editor/notebook/suffix-settings.ts`, `src/editor/notebook/format.ts` | Viewport scope and Tailwind suffix preferences | Runtime-only editor state; included in copied text only after explicit copy | Local extension UI state |
| Visual edit records | `src/content/editor-bridge/visual-targets.ts`, `src/content/editor-bridge/visual-mutations.ts`, `src/content/editor-bridge/visual-structure.ts`, `src/editor/stores/useVisualEditStore.ts`, `src/editor/notebook/visual-edits-export.ts` | Selected target snapshots, computed/inline style values, safe attributes, text/rich HTML/form values, structure snapshots, before/after payloads, breakpoint labels, mutation status, and warnings | Runtime-only editor state; preview DOM is mutated locally for immediate feedback; included in copied `## Visual edits` only after explicit Copy / Shift + Enter | Website/page content and user-directed edit metadata used locally |
| Clipboard writes | `src/content/clipboard/clipboard.ts`, `src/editor/notebook/copy.ts` | User-created notebook text, selected `data-ai-id` references or fallback target metadata, selected suffixes, and preview-only visual edit summaries/JSON diffs when present | `navigator.clipboard.writeText` after explicit Copy / Shift + Enter; no manifest clipboard permission | Clipboard write on explicit user action |
| Popup current-tab state | `src/popup/active-tab-scope.ts`, `src/popup/main.ts`, `src/shared/runtime-messages.ts` | Active tab ID/URL label and enabled state response | Used locally to message the active tab content script; not persisted | Active-tab context for user-invoked UI |
| Iframe preview URL | `src/editor/components/PreviewWorkspace.tsx` | Current page URL plus the `copy-ai-id-preview=1` query marker | Loaded in the local browser iframe. The page may make its own normal site requests; Copy AI ID does not upload this URL to an extension server | Website access required for preview |

## Network and third-party transfer finding

The Chrome extension source does not use direct `fetch`, `XMLHttpRequest`, `WebSocket`, `EventSource`, or beacon APIs for analytics or remote upload. It contains normal external documentation links, such as the GitHub guide URL in the popup. The editor iframe loads the current page URL in the user's browser; this is same-site browsing/preview behavior, not a transfer to a Copy AI ID service. Visual editing mutates only that local preview DOM and does not trigger any Copy AI ID network upload.

Validation command:

```bash
rg -n "fetch\(|XMLHttpRequest|WebSocket|EventSource|sendBeacon|navigator\.sendBeacon|chrome\.runtime\.connectNative|sidePanel|nativeMessaging" src public package.json
```

## Chrome Web Store privacy copy draft

> Copy AI ID reads rendered page DOM information, including `data-ai-id` attributes and locally generated fallback metadata such as selectors, selector type/reliability, DOM paths, concise nearby text, class tokens, accessibility context, and user-directed preview-only visual edit before/after data, only while the user enables the editor. This data is used locally to show the layout tree, preview selection outlines, keyboard traversal across layout-tree nodes, note panel, and visual editing controls. Copy AI ID does not sell user data, use advertising IDs, run analytics, include a native host, or send page content, notes, or visual edits to a remote server. Notebook text and visual edit instructions are copied to the clipboard only after the user explicitly clicks Copy or presses Shift + Enter.

## Current caveats / follow-up decisions

- If future settings persistence, browser history, screen capture, voice, AI chat, native host, or prompt-sending workflows are added, update this inventory and permission justification before release.
- A public privacy policy URL must be provided in the Chrome Web Store Developer Dashboard and must match this inventory and the dashboard privacy-practices form.
