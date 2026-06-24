# Chrome Web Store Listing Copy

Generated: 2026-04-26 KST
Updated: 2026-06-24 KST — preview-only visual editing wording

## Positioning / Single Purpose

Copy AI ID helps developers and QA reviewers work with rendered pages using a `data-ai-id`-first workflow. It opens a full-screen editor on the current tab so the user can inspect the DOM layout tree, preview responsive breakpoints in an iframe, highlight exact DOM nodes, make preview-only visual edits, write local notes for stable `data-ai-id` targets or generated fallback targets, and copy the note/visual-edit bundle for QA, development, or AI-assisted UI editing workflows.

This listing should not describe the extension as a general web automation, analytics, scraping, AI chat, remote AI processing, native-host, or browsing-history tool.

## Store Category

Recommended category: **Developer Tools**

## Short Description

Inspect DOM targets, preview breakpoints, and copy UI notes.

Length: 60 characters.

## Detailed Description

Copy AI ID is a focused developer and QA helper for rendered pages. It is `data-ai-id`-first: semantic `data-ai-id` attributes create the most stable references, while generated fallback target metadata helps on pages that have no IDs or only partial ID coverage.

Turn the extension on with **Shift + Z + Space** or the popup. Copy AI ID opens a full-screen editor over the current tab:

- the left panel shows a DOM layout tree, including structural rows, stable `data-ai-id` targets, and fallback-capable no-ID rows
- the center panel loads the current page in an iframe preview with responsive breakpoint controls, zoom controls, hover quick-action bar, and preview-only visual editing controls
- the right panel keeps a notebook draft with compact chips for selected `data-ai-id` targets or generated fallback targets and hidden visual-edit status/counts

Click a target in the preview or layout tree, or use the keyboard to navigate through every layout-tree DOM node. **ArrowUp** moves to the previous sibling or parent, **ArrowRight** moves to the next sibling or enters the first child of the next ancestor branch, **ArrowLeft** moves to the previous sibling or deepest last descendant of the previous ancestor branch, and **ArrowDown** moves to the first child, next sibling, or nearest ancestor's next sibling. Press **Space** to add the highlighted node as a compact chip: stable targets store a `data-ai-id` reference, and no-ID targets store generated fallback metadata that may include a selector, selector type/reliability, DOM path, concise nearby text, class tokens, and accessibility context. Use the quick-action bar and floating visual panel to make preview-only content, layout, spacing, size, style, border, and structure edits. These edits are not saved to the page; they become precise implementation instructions. Press **Shift + Enter** or click **Copy** to copy an AI-friendly Markdown note bundle with Requests, Targets, Rules, and, when visual edits exist, Visual edits sections. Duplicate `data-ai-id` values are shown as separate instances with warning badges so the selected DOM node stays clear.

Use Copy AI ID when you need to:

- inspect rendered `data-ai-id` handles on a page
- select no-ID or partially-ID elements with generated fallback metadata
- confirm the exact UI element you mean before writing feedback
- understand surrounding DOM structure from a layout tree
- compare a page through common responsive breakpoints
- make preview-only visual edits that export as implementation prompts
- copy note text and visual edit diffs for QA, development, or AI editing workflows
- work with local HTML files when Chrome file URL access is enabled for the extension

Copy AI ID is intentionally narrow in scope. It does not provide analytics, remote AI processing, scraping, account tracking, native messaging, chat, settings/history screens, or automated actions on third-party sites. Notebook text is runtime editor state and is copied only after an explicit user action.

## Key Feature Bullets

- Full-screen Shadow DOM editor for the current tab
- DOM layout tree with structural nodes, `data-ai-id` targets, fallback-capable no-ID rows, and duplicate warnings
- Iframe preview with responsive breakpoint widths
- Keyboard navigation through the layout-tree DOM, with stable references for `data-ai-id` nodes and generated fallback metadata for no-ID nodes
- Hover quick-action bar and floating visual panel for preview-only content/style/structure edits
- Always-visible note panel with explicit copy action and hidden visual-edit export status
- Per-page-session enable/disable shortcut with Shift + Z + Space
- Optional support for local `file://` HTML pages when enabled in Chrome extension settings

## Privacy / Data Handling Copy

Copy AI ID is designed for local developer and QA workflows. It does not send page content, notes, browsing history, analytics, prompts, or files to a remote server. It reads the current page DOM only while the user has enabled the editor so it can build the layout tree, highlight DOM nodes, identify stable `data-ai-id` reference targets, generate fallback selectors/path/context for no-ID targets, apply local preview-only visual edits, and copy user-written notes plus visual edit instructions on explicit request.

## Permission Rationale Copy

Copy AI ID needs access to pages where you choose to use it so it can detect rendered `data-ai-id` attributes, build the editor layout tree, generate fallback selectors/path/context for selected no-ID elements, draw the preview selection overlay, apply user-directed preview-only DOM/style edits in the local iframe, and open the note panel. The extension uses host access and content scripts for the user-invoked current-page popup/editor workflow. It does not request `tabs`, `activeTab`, `storage`, `sidePanel`, `nativeMessaging`, `scripting`, `history`, or clipboard permissions.

## Do Not Claim

Avoid these claims in the public listing:

- automated browsing or automated site actions
- scraping, crawling, extraction, or monitoring third-party sites
- analytics, tracking, or behavioral profiling
- remote AI processing or cloud synchronization
- Codex sidepanel, native host, AI chat, settings/history, or prompt sending
- broad productivity claims unrelated to `data-ai-id` inspection and local note/copy workflows
