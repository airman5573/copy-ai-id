# GitHub Launch Kit

This document collects ready-to-use text for publishing **Copy AI ID** on GitHub and sharing it externally.

---

## Recommended repository description

Pick one of these for the GitHub repo description field:

1. **Chrome extension editor for inspecting `data-ai-id`-first layout trees and copying precise UI notes.**
2. **Full-screen browser editor for traversing rendered DOM nodes, previewing breakpoints, and writing AI-ready `data-ai-id` or fallback target notes.**
3. **A lightweight Chrome extension and reference repo for teams using `data-ai-id` as a stable DOM contract with local fallback target support.**

### Recommended short tagline

**Semantic selectors for AI-ready interfaces.**

---

## Suggested GitHub topics

- `chrome-extension`
- `browser-extension`
- `chromium`
- `data-ai-id`
- `semantic-selectors`
- `ai-agents`
- `qa`
- `ui-review`
- `dom-inspection`
- `frontend-tooling`
- `prompt-engineering`
- `developer-tools`

---

## Recommended license

**MIT License**

Why this is a good default for this repository:

- simple and widely understood
- low-friction for adoption and reuse
- a strong fit for a developer tool and browser extension
- easy for teams to evaluate quickly during open-source discovery

If a more enterprise-oriented alternative is needed later, Apache-2.0 is the main fallback.

---

## Suggested first editor release

### Release title

**v0.2.0 — Copy AI ID Editor**

### Release notes

**Copy AI ID** is now an editor-only Chrome extension for teams that use `data-ai-id` as a stable DOM contract.

#### Highlights

- Full-screen Shadow DOM editor on the current tab
- Left layout tree with full DOM hierarchy, structural nodes, stable `data-ai-id` targets, and fallback-capable no-ID rows
- Duplicate `data-ai-id` instance badges and warnings
- Center iframe preview with six breakpoint widths and zoom controls
- Right note panel with compact target chips and AI-friendly Markdown copy output
- Keyboard traversal across the full layout-tree DOM, with `data-ai-id`-first note references and generated fallback references when no usable ID exists
- Copy action that groups Requests, Targets, and Rules for AI-assisted handoff
- Public `data-ai-id` convention guide in [`docs/add-data-ai-id.md`](./add-data-ai-id.md)

#### Included in this release

- Popup ON/OFF toggle for the active tab
- `Shift + Z + Space` editor toggle
- Preview hover/selection and keyboard navigation
- Layout tree hover/reveal/selection synchronization
- Local fallback target metadata generation for no-ID elements, including selector/path/context summaries
- Runtime-only notebook draft and explicit clipboard copy
- File URL guidance for local HTML files

#### Removed from scope

- Codex sidepanel and native messaging host
- AI chat, prompt sending, settings, and history screens
- Browser automation tooling and smoke-test artifacts
- Remote AI processing, analytics, and cloud sync

---

## Suggested release commit message

Recommended:

```text
feat: ship Copy AI ID editor shell
```

Alternative:

```text
chore: prepare editor-only Copy AI ID release
```

---

## Social intro blurb

We’re updating **Copy AI ID** into a focused Chrome extension editor for teams that use `data-ai-id` as a stable DOM contract. It opens a full-screen editor on the current tab with a DOM layout tree, responsive iframe preview, duplicate-ID warnings, keyboard traversal across layout-tree nodes, and a note panel that copies precise `data-ai-id`-first UI instructions for QA and AI-assisted development workflows. When a page has missing IDs, Copy AI ID can generate fallback target metadata from local selector/path/context details so reviewers can still point at the current DOM element while they add stable IDs later. The repo also includes a public guide for writing semantic, deterministic `data-ai-id` values that work well for AI agents and human review.

---

## Notes for publishing

Before making a public release, verify:

- repository visibility and owner settings
- final GitHub repo description and topics
- whether the extension name should remain **Copy AI ID**
- current editor screenshots and demo GIF assets
- Chrome Web Store privacy/permission text matches the current manifest
- no internal-only files or obsolete product artifacts remain tracked
