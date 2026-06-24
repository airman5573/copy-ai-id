# Implementation Checklist

## Objective
- Add a preview-iframe-based visual editing system to the Copy AI ID Chrome extension, using the existing `copy-ai-id-preview=1` bridge and the referenced `ai-editor` plugin as the functional model.
- The feature should feel like a page-builder-style Visual tab: users select any layout-tree DOM element, edit style/content/media/link/curated attributes/structure in the preview, undo/redo edits, and copy a prompt that includes both human-readable visual edit instructions and machine-readable JSON diffs.
- Edits are preview-only DOM/CSS mutations inside the existing preview iframe; they are not saved back to the source page or site.

## Assumptions
- Visual editing runs only in the existing preview iframe path wired by `src/editor/components/PreviewWorkspace.tsx`, `src/editor/bridge/bridgeClient.ts`, and `src/content/editor-bridge/index.ts`.
- Target identity uses the current Copy AI ID approach: prefer `data-ai-id` targets when present; otherwise use fallback selector/path metadata from `src/content/editor-bridge/fallback-target.ts` and runtime `nodeId` maps from `src/content/editor-bridge/layout-tree.ts`.
- The right panel becomes a Note / Visual tabbed panel rather than a separate fourth column.
- Styling changes are inline-style/scoped-preview-CSS based, not Tailwind class based. Do not add Tailwind class editing or Tailwind compilation.
- Breakpoint-specific visual edits are stored separately and applied in preview through extension-injected scoped CSS/media rules, then exported in the prompt by breakpoint.
- All layout-tree DOM targets should be editable, including form controls and contenteditable targets, while preserving the existing exclusions for extension-owned DOM and non-editable technical elements such as script/style/template/meta/link/noscript.
- Curated attribute editing is allowed for safe attributes only; do not implement an unrestricted freeform attribute editor in the first pass.
- Structure controls should aim to match `ai-editor` behavior: delete, duplicate, move, insert, wrap, convert tag, and replace element HTML where feasible in preview-only mode.
- Human/browser visual verification is outside this checklist because the active user defaults prohibit AI-side browser/UI automation.

## Risks
- This is a large feature crossing shared message contracts, preview bridge mutations, editor state, right-panel UI, notebook export, CSS, i18n, docs, and build artifacts.
- Runtime `nodeId` and fallback selector/path metadata can become stale after structure edits; mutation handlers must refresh layout-tree snapshots after DOM-changing operations.
- Inline editing can conflict with existing preview keyboard shortcuts and the Lexical notebook editor unless edit-mode and focus guards are explicit.
- Breakpoint-specific scoped CSS needs a stable selector strategy for non-`data-ai-id` targets; fallback selectors may be ambiguous or become stale after structure edits.
- Structure editing without source persistence can produce prompts that are descriptive rather than directly source-applicable; export text must clearly label edits as preview-derived instructions.
- Allowing form/input/contenteditable edits increases edge cases around value vs attribute vs textContent handling.
- Existing unrelated working tree changes may be present; implementation commits should avoid staging unrelated files.

## Unresolved Issues
- None

## Checklist
### Phase 1 - Shared contracts and target descriptors
- [ ] Extend `src/shared/editor-messages.ts` with visual editing message types and payload interfaces.
  - Files/areas: `src/shared/editor-messages.ts`.
  - Notes: Add messages for target snapshot request/response, style update, text/rich-text update, image update, link update, curated attributes update, delete/restore, duplicate, move, insert HTML, wrap, convert tag, replace HTML, scoped CSS update, and mutation error responses. Keep existing highlight/layout messages compatible.
  - Parallelizable: no

- [ ] Add shared visual edit domain types for changes, target descriptors, breakpoint scopes, style declarations, curated attributes, structure actions, and prompt export payloads.
  - Files/areas: new `src/shared/visual-edits.ts` or similarly named shared module; optionally `src/shared/visual-style.ts` for CSS property metadata.
  - Notes: Model each edit as preview-only and exportable. Include before/after data, target identity, fallback metadata, active breakpoint, timestamp/order, and human-readable summary.
  - Parallelizable: no

- [ ] Add target-label and target-serialization helpers for visual edits.
  - Files/areas: `src/shared/editor-targets.ts`, new shared helper module if cleaner.
  - Notes: Prefer `data-ai-id` display when available; otherwise serialize fallback selector/path/fullPath/text context. Do not expose any temporary implementation-only attributes in final prompt output.
  - Parallelizable: yes

### Phase 2 - Bridge target resolution and snapshots
- [ ] Add preview-bridge target resolution helpers for visual editing.
  - Files/areas: new `src/content/editor-bridge/visual-targets.ts`; reuse `resolveAiTarget`, `resolveTreeNode`, `instancesOf`, `resolveNodeIdForElement` from `src/content/editor-bridge/layout-tree.ts`.
  - Notes: Resolution order should be `data-ai-id + instanceIndex`, then runtime `nodeId`, then fallback selector/path metadata when needed. Return clear stale/ambiguous/not-found errors.
  - Parallelizable: no

- [ ] Add target snapshot extraction for selected elements.
  - Files/areas: `src/content/editor-bridge/visual-targets.ts`, `src/shared/visual-edits.ts`.
  - Notes: Snapshot computed/inline style, relevant attributes, tagName, text/rich HTML, image/link fields, form value fields, parent/sibling structure metadata, fallback selector/path metadata, and current `nodeId`.
  - Parallelizable: no

- [ ] Add visual editability guards while honoring the user's all-DOM preference.
  - Files/areas: `src/content/editor-bridge/visual-targets.ts`, `src/shared/config.ts` if existing extension-owned helpers need reuse.
  - Notes: Allow normal layout-tree nodes including form controls/contenteditable; block extension-owned DOM and technical/non-editable tags already excluded by layout-tree (`script`, `style`, `template`, `meta`, `link`, `noscript`).
  - Parallelizable: yes

### Phase 3 - Preview bridge mutation routing
- [ ] Wire visual editing messages into the preview bridge router.
  - Files/areas: `src/content/editor-bridge/index.ts`, new `src/content/editor-bridge/visual-mutations.ts`.
  - Notes: Follow the existing `route(message, post)` pattern and the reference plugin's `src/bridge/mutations.ts` routing style. Every mutation should post a success/error result and refresh overlays/layout tree when DOM or layout may change.
  - Parallelizable: no

- [ ] Implement inline style and breakpoint-scoped style mutations.
  - Files/areas: `src/content/editor-bridge/visual-mutations.ts`, new `src/content/editor-bridge/visual-style-sheet.ts`.
  - Notes: Base/common edits can use element inline style. Breakpoint edits should inject/update an extension-owned scoped `<style>` in the preview document with media rules. Keep generated CSS tied to serialized target selectors and refresh on target changes.
  - Parallelizable: no

- [ ] Implement text, rich-text, and form-value mutations.
  - Files/areas: `src/content/editor-bridge/visual-mutations.ts`, optional new `src/content/editor-bridge/inline-text-editing.ts`.
  - Notes: Handle plain text via `textContent`, rich HTML via guarded `innerHTML`, and form controls via `value`/checked/selected state where applicable. Preserve mutation summaries for prompt export.
  - Parallelizable: yes

- [ ] Implement curated image, link, and safe attribute mutations.
  - Files/areas: `src/content/editor-bridge/visual-mutations.ts`, new `src/shared/visual-attributes.ts` if useful.
  - Notes: Support curated fields such as `href`, `src`, `alt`, `title`, `aria-label`, and `placeholder`. Block dangerous URL schemes and executable attributes such as `on*`.
  - Parallelizable: yes

- [ ] Implement delete/restore structure mutations.
  - Files/areas: `src/content/editor-bridge/visual-mutations.ts`.
  - Notes: Store enough local preview state to restore deleted elements through undo/redo. Prefer non-destructive hidden/deleted markers only if full removal makes restore or snapshot refresh unreliable.
  - Parallelizable: yes

- [ ] Implement page-builder structure actions: duplicate, move, insert HTML, wrap, convert tag, and replace element HTML.
  - Files/areas: `src/content/editor-bridge/visual-mutations.ts`, optional `src/content/editor-bridge/visual-structure.ts`.
  - Notes: Mirror `ai-editor/src/bridge/mutations.ts` behavior where practical, but keep output preview-only. After each structure mutation, rebuild layout-tree metadata and return updated target information when possible.
  - Parallelizable: yes

### Phase 4 - Editor-side visual edit state and history
- [ ] Add an editor-side visual editing store.
  - Files/areas: new `src/editor/stores/useVisualEditStore.ts`.
  - Notes: Track selected visual target snapshot, pending visual changes, breakpoint-specific style state, mutation pending/error status, active Visual tab section, history stack, redo stack, and prompt-export order.
  - Parallelizable: no

- [ ] Connect selected highlight state to visual target snapshot loading.
  - Files/areas: `src/editor/stores/useHighlightStore.ts`, `src/editor/bridge/bridgeClient.ts`, new visual store.
  - Notes: When `highlightedTarget`/`highlightedNodeId` changes, request a snapshot from the bridge and update the visual store. Handle disconnected or stale targets gracefully.
  - Parallelizable: no

- [ ] Add editor-side bridge helpers and response handlers for visual mutations.
  - Files/areas: `src/editor/bridge/bridgeClient.ts`, possible new `src/editor/bridge/visualBridge.ts`.
  - Notes: Provide functions for each mutation type and route bridge responses into `useVisualEditStore`. Preserve current iframe status, layout tree, keyboard shortcut, and highlight routing.
  - Parallelizable: no

- [ ] Implement global undo/redo logic with focus-safe keyboard handling.
  - Files/areas: `src/editor/stores/useVisualEditStore.ts`, `src/editor/keyboard.ts`, `src/editor/note-hover-guard.ts` or new focus guard helper.
  - Notes: Add Visual tab buttons and Cmd/Ctrl+Z/Y support, but let native undo/redo pass through when focus is inside the Lexical notebook, text inputs, textareas, selects, or inline contenteditable editing.
  - Parallelizable: yes

### Phase 5 - Right panel tabs and Visual panel shell
- [ ] Refactor the right panel into Note / Visual tabs.
  - Files/areas: `src/editor/components/MainArea.tsx`, `src/editor/components/NotePanel.tsx`, new `src/editor/components/RightPanel.tsx`, `src/editor/editor.css`.
  - Notes: Preserve existing note UX and data-ai-id hooks. The Visual tab should share the existing right column width unless CSS changes are needed for page-builder controls.
  - Parallelizable: no

- [ ] Add `VisualEditPanel` shell with selection summary, pending status, history controls, and empty/error states.
  - Files/areas: new `src/editor/components/visual/VisualEditPanel.tsx` and related components.
  - Notes: Empty state should instruct the user to select an element in the preview or layout tree. Summary should show `data-ai-id` when present, otherwise fallback selector/path metadata.
  - Parallelizable: no

- [ ] Add reusable control UI primitives for visual editor fields.
  - Files/areas: new `src/editor/components/visual/controls/*`, `src/editor/editor.css`.
  - Notes: Include section chrome, row labels, unit inputs, select controls, color inputs, toggle groups, reset buttons, and compact helper/error text. Reuse `ToolbarButton`/`PanelChrome` only where it keeps code simple.
  - Parallelizable: yes

### Phase 6 - Style controls
- [ ] Implement layout/display controls.
  - Files/areas: `src/editor/components/visual/controls/LayoutControls.tsx`, visual store/bridge helpers.
  - Notes: Cover display, flex/grid basics, alignment, justify, position, z-index, overflow, and gap where practical using inline/scoped style edits.
  - Parallelizable: yes

- [ ] Implement spacing controls.
  - Files/areas: `src/editor/components/visual/controls/SpacingControls.tsx`.
  - Notes: Cover margin and padding sides with unit inputs and reset-per-property actions.
  - Parallelizable: yes

- [ ] Implement size controls.
  - Files/areas: `src/editor/components/visual/controls/SizeControls.tsx`.
  - Notes: Cover width, min/max width, height, min/max height, box sizing, and object fit where relevant.
  - Parallelizable: yes

- [ ] Implement typography controls.
  - Files/areas: `src/editor/components/visual/controls/TypographyControls.tsx`.
  - Notes: Cover font size, font weight, line height, letter spacing, text align, text decoration, text transform, white space, and color if not centralized elsewhere.
  - Parallelizable: yes

- [ ] Implement color, background, opacity, border, radius, and shadow controls.
  - Files/areas: `src/editor/components/visual/controls/ColorControls.tsx`, `BackgroundControls.tsx`, `OpacityControls.tsx`, `BorderControls.tsx`, `ShadowControls.tsx`.
  - Notes: Keep controls inline-style based. Do not add Tailwind class generation.
  - Parallelizable: yes

- [ ] Add responsive/breakpoint indicators and reset behavior to style controls.
  - Files/areas: visual controls, `src/editor/stores/useBreakpointStore.ts`, visual store.
  - Notes: Active breakpoint edits should be visually distinguished from base edits and exported by breakpoint in the final prompt.
  - Parallelizable: yes

### Phase 7 - Content, media, link, attribute, and inline editing controls
- [ ] Implement Text and Rich Text controls in the Visual tab.
  - Files/areas: `src/editor/components/visual/controls/TextControls.tsx`, `RichTextControls.tsx`, bridge text mutation handlers.
  - Notes: Support plain text and guarded rich HTML. Record before/after values in visual changes.
  - Parallelizable: yes

- [ ] Implement preview canvas inline contenteditable editing mode.
  - Files/areas: new `src/content/editor-bridge/inline-text-editing.ts`, bridge router, editor visual store.
  - Notes: Add start/commit/cancel messages, suppress conflicting preview shortcuts during inline editing, and commit edits into the same history/change pipeline as Visual tab text edits.
  - Parallelizable: no

- [ ] Implement Image controls.
  - Files/areas: `src/editor/components/visual/controls/ImageControls.tsx`, bridge image mutations.
  - Notes: Cover `src`, `alt`, width/height/object-fit where applicable. Treat image URL edits as preview-only and prompt-exportable.
  - Parallelizable: yes

- [ ] Implement Link controls.
  - Files/areas: `src/editor/components/visual/controls/LinkControls.tsx`, bridge link/attribute mutations.
  - Notes: Cover `href`, `target`, `rel`, and link text where applicable. Block dangerous URL schemes.
  - Parallelizable: yes

- [ ] Implement curated Attribute controls.
  - Files/areas: `src/editor/components/visual/controls/AttributeControls.tsx`, shared curated attribute allowlist.
  - Notes: Provide curated fields only, matching the user's selected scope. Do not add unrestricted freeform attributes.
  - Parallelizable: yes

### Phase 8 - Structure controls
- [ ] Add Delete/Restore controls with history integration.
  - Files/areas: `src/editor/components/visual/controls/DeleteElementControls.tsx`, visual store, bridge structure handlers.
  - Notes: Deleted targets should remain restorable through undo/redo and should be represented clearly in `## Visual edits`.
  - Parallelizable: yes

- [ ] Add duplicate and move controls.
  - Files/areas: `src/editor/components/visual/controls/StructureControls.tsx`, bridge structure handlers.
  - Notes: Support duplicate, move up/down, and parent/sibling-safe moves where the DOM relationship is clear. Refresh layout tree after each action.
  - Parallelizable: yes

- [ ] Add insert, wrap, convert tag, and replace HTML controls.
  - Files/areas: `src/editor/components/visual/controls/StructureControls.tsx`, bridge structure handlers.
  - Notes: Use guarded HTML insertion/replacement. Preserve children when converting tags where feasible. Prompt export should describe the structural intent and include serialized diff data.
  - Parallelizable: yes

### Phase 9 - Notebook copy and prompt export
- [ ] Extend notebook copy formatting with a `## Visual edits` section.
  - Files/areas: `src/editor/notebook/copy.ts`, `src/editor/notebook/format.ts`, possible new `src/editor/notebook/visual-edits-export.ts`.
  - Notes: Include human-readable summaries grouped by target and breakpoint, followed by fenced machine-readable JSON diff. Preserve existing `## Requests`, `## Targets`, and `## Rules` behavior.
  - Parallelizable: no

- [ ] Add visual edit rules and warnings to copied prompt output.
  - Files/areas: notebook export modules, `src/shared/i18n.ts` if copy text is localized.
  - Notes: State that edits are preview-derived, should be applied to the referenced target, and should not remove or rename `data-ai-id` attributes.
  - Parallelizable: yes

- [ ] Ensure copied visual changes use stable target descriptions.
  - Files/areas: visual export helper, shared target serialization helper.
  - Notes: For targets with `data-ai-id`, export that. For fallback targets, export selector, selector kind, path/fullPath, tag, text context, and accessibility metadata when available.
  - Parallelizable: yes

### Phase 10 - Styling, i18n, docs, and permissions copy
- [ ] Add editor CSS for the right-panel tabs and Visual controls.
  - Files/areas: `src/editor/editor.css`.
  - Notes: Keep styles within the existing Shadow DOM editor CSS. Do not add browser/UI automation or external rendering checks.
  - Parallelizable: yes

- [ ] Add i18n strings for Visual tab labels, controls, errors, history, and prompt export text.
  - Files/areas: `src/shared/i18n.ts`, `_locales` if present or generated by existing build flow.
  - Notes: Preserve existing English/Korean style where applicable.
  - Parallelizable: yes

- [ ] Update user-facing documentation for preview-only visual editing.
  - Files/areas: `README.md`, `README.ko.md`, `docs/editor-usage.md`.
  - Notes: Explain that edits are preview-only, copied into Markdown/prompt output, and not saved back to the page/source.
  - Parallelizable: yes

- [ ] Update Chrome Web Store / permissions documentation if behavior descriptions mention copy-only operation.
  - Files/areas: `docs/chrome-web-store-permission-justifications.md` and nearby store/disclosure docs.
  - Notes: No new permission is expected from DOM preview editing, but behavior copy should disclose preview DOM mutation and user-triggered clipboard export.
  - Parallelizable: yes

### Phase 11 - Build and completion hygiene
- [ ] Run the required extension build after code changes and keep generated build artifacts consistent.
  - Files/areas: `package.json`, `package-lock.json`, `dist/*` generated by `npm run build`.
  - Notes: Run `npm run build` after implementation code changes. If dependencies are missing, use the existing lockfile with `npm ci` and retry the build once. Do not run browser/UI automation.
  - Parallelizable: no

- [ ] Keep checklist progress and unresolved issues accurate while implementing.
  - Files/areas: `visual_editing.md`.
  - Notes: Mark completed items only after implementation for that item is done. Keep `## Unresolved Issues` as `- None` unless a true implementation blocker appears.
  - Parallelizable: no
