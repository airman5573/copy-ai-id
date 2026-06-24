# Implementation Checklist

## Objective
- Replace the previous broad visual-editing plan with a focused implementation plan for porting the `ai-editor` quick-action bar and floating visual control panel UX into `copy-ai-id`.
- Keep `copy-ai-id` as a Chrome extension with no chat feature: the existing right `NotePanel` remains the prompt/sidebar and its Copy button exports the visible note plus hidden visual-edit instructions.
- Render the quick-action bar in the editor Shadow DOM over the preview iframe, not inside the iframe document, while matching the `ai-editor` interaction model: hover target shows toolbar, toolbar remains usable when the pointer leaves the element, category buttons open a floating panel, and desktop placement follows the target/toolbar while mobile/tablet placement sits beside the preview iframe.
- Support all layout-tree targets, including fallback targets without `data-ai-id`, using preview-only DOM/inline-style/attribute/rich-text/structure mutations that generate AI-readable prompt output rather than assuming the edited page uses Tailwind.
- Match the `ai-editor` floating visual panel design and control UX as closely as practical by adding the needed Tailwind/PostCSS and UI dependencies, while avoiding `ai-editor` WordPress, REST, source-map, save, chat, and AI-generated-control-panel dependencies.

## Assumptions
- `visual_editing.md` is intentionally being replaced with this new plan.
- The final product does not add chat. `NotePanel` remains visible and editable; visual-edit prompt text is hidden during editing and appended only to clipboard output.
- Copy success clears both the visible note draft and accumulated visual edit records; this matches the user's selected option and the existing `copyNotebookDraftFromStore()` lifecycle.
- Actual preview edits use inline style, safe attributes, text/value changes, rich inner HTML, and DOM structure operations. They do not rely on Tailwind classes in the inspected page.
- The UI may use Tailwind utilities for the extension editor itself to closely match `ai-editor`, but generated prompt diffs describe CSS properties/DOM mutations, not Tailwind class assumptions.
- The `생성` / AI generated control panel feature from `ai-editor` is excluded.
- The active user defaults prohibit AI-side browser/UI automation; human visual review is important but is not a checklist completion dependency.
- After code changes in this npm project, `npm run build` is required by user defaults.

## Risks
- This is a large feature crossing the message contract, preview bridge, editor stores, Shadow DOM/Tailwind styling, floating geometry, note copy formatting, and DOM mutation logic.
- `ai-editor` controls are coupled to Tailwind class-token/source-map/pending-change systems; `copy-ai-id` needs a new CSS-property/DOM-diff model while preserving the visual design.
- Arbitrary web pages can contain forms, iframes, custom elements, Shadow DOM, contenteditable nodes, SVG, scripts, and CSS that complicate universal preview-only mutation.
- Hover-triggered quick actions can flicker if toolbar hover protection and hide delays are not implemented carefully.
- Fallback target identity can become stale after structure edits; mutation handlers must refresh layout-tree and target snapshots after DOM-changing operations.
- Rich-text editing must sanitize untrusted HTML fragments and avoid exporting runtime-only extension artifacts.
- Tailwind integration inside the extension Shadow DOM must not leak styles into the inspected page or break existing `copy-ai-id-editor-*` CSS.

## Unresolved Issues
- None

## Checklist
### Phase 1 - Replace stale plan and prepare project styling/dependencies
- [x] Keep this root `visual_editing.md` as the authoritative plan and do not rely on the older broad checklist content.
  - Files/areas: `visual_editing.md`.
  - Notes: The user explicitly requested replacing the old plan and matching `ai-editor` behavior more closely.
  - Parallelizable: no

- [x] Add the editor-UI dependencies needed to port the `ai-editor` floating panel/control UX.
  - Files/areas: `package.json`, `package-lock.json`.
  - Notes: Add only dependencies used by the chosen port: likely `@radix-ui/react-select`, `@radix-ui/react-slider`, `@radix-ui/react-tabs`, `@radix-ui/react-tooltip`, `@radix-ui/react-popover`, `react-hook-form`, `clsx`, `tailwind-merge`, `dompurify`, and Tailwind build dev dependencies `tailwindcss`, `postcss`, `autoprefixer`. Do not add `@json-render/*` or `zod` unless a non-AI generated-panel control actually needs them.
  - Parallelizable: yes

- [x] Configure Tailwind/PostCSS for the extension editor Shadow DOM without changing the page under inspection.
  - Files/areas: new `tailwind.config.js`, new `postcss.config.js`, `vite.config.ts`, `src/editor/editor.css`.
  - Notes: Mirror `ai-editor`'s important selector approach using `[data-ai-editor-ui]`, disable preflight, scan editor `.tsx` files, and preserve existing `editor.css` rules. Import Tailwind layers in a way that works with the existing inline CSS injection from `src/editor/main.tsx`.
  - Parallelizable: no

- [x] Add a short source-port map comment/doc section in the plan or nearby implementation notes if needed.
  - Files/areas: `visual_editing.md` or future implementation notes.
  - Notes: Track primary source references: `ai-editor/src/bridge/quickActions.ts`, `src/editor/components/visual-panel/FloatingVisualPanel.tsx`, `src/editor/components/visual-panel/VisualPanelContent.tsx`, `src/editor/components/visual-panel/visualPanelCategories.tsx`, `src/editor/components/visual/*`, `src/editor/components/controls/*`, `src/bridge/mutations.ts`, and `src/bridge/dragAndDrop.ts`.
  - Parallelizable: yes

### Phase 2 - Shared visual-edit contracts and target model
- [x] Extend the shared bridge message contract with visual editing messages and payloads.
  - Files/areas: `src/shared/editor-messages.ts`.
  - Notes: Add quick-action anchor/category messages, target snapshot request/response, style update/result, text/rich-text update/result, attribute update/result, structure duplicate/move/delete/restore messages, drag/move request messages, mutation errors, and optional box-region highlight messages. Keep existing highlight/layout/notebook messages compatible.
  - Parallelizable: no

- [x] Add shared visual edit domain types for preview-only records and export diffs.
  - Files/areas: new `src/shared/visual-edits.ts`.
  - Notes: Model `VisualEditRecord` with id/order/timestamp, target descriptor, target snapshot summary, category/control kind, breakpoint id, before/after payload, human summary, and JSON diff payload. Payload kinds should cover `style`, `attribute`, `text`, `rich-text`, `form-value`, `structure`, and `html`.
  - Parallelizable: no

- [x] Add target descriptor and serialization helpers for visual edits.
  - Files/areas: `src/shared/editor-targets.ts`, new `src/shared/visual-targets.ts` if cleaner.
  - Notes: Prefer `data-ai-id + instanceIndex`; otherwise serialize fallback node id, selector, selector kind, DOM path/fullPath, tag, label, text/accessibility context, and class tokens. Do not expose extension runtime-only attributes in final copied output.
  - Parallelizable: yes

- [x] Define a CSS property catalog for inline-style visual controls.
  - Files/areas: new `src/shared/visual-style.ts` or `src/editor/visual/styleProperties.ts`.
  - Notes: Reuse the property coverage from `ai-editor/src/editor/tokens/propertyMap.ts` conceptually, but values should be CSS declarations rather than Tailwind tokens. Include layout, spacing, size, typography, color/background, opacity, border/radius, shadow, and image/background properties.
  - Parallelizable: yes

### Phase 3 - Preview target resolution and snapshots
- [x] Add a preview-side visual target resolver that supports both `data-ai-id` and fallback targets.
  - Files/areas: new `src/content/editor-bridge/visual-targets.ts`, `src/content/editor-bridge/layout-tree.ts`, `src/content/editor-bridge/fallback-target.ts`.
  - Notes: Resolution order should be live `nodeId`, then `data-ai-id + instanceIndex`, then fallback selector/path metadata. Return explicit `not-found`, `stale`, or `ambiguous` errors for export and UI feedback.
  - Parallelizable: no

- [x] Add visual target snapshot extraction for selected/hovered elements.
  - Files/areas: `src/content/editor-bridge/visual-targets.ts`, `src/shared/visual-edits.ts`.
  - Notes: Capture tagName, rect, computed style values for supported properties, inline style values, class tokens, safe attributes, text/value/rich HTML state, image/link fields, form field state, parent/sibling metadata, nodeId, and fallback metadata.
  - Parallelizable: no

- [x] Add bridge-side mutation result helpers and layout-tree refresh hooks.
  - Files/areas: `src/content/editor-bridge/index.ts`, `src/content/editor-bridge/layout-tree.ts`, new mutation helpers.
  - Notes: After any DOM/structure mutation, rebuild/post layout tree and keep hover/quick-action anchors fresh. Preserve existing `bridgeReady` and `layoutTree` behavior.
  - Parallelizable: no

- [x] Add runtime-artifact stripping helpers for HTML snapshots and rich-text export.
  - Files/areas: new `src/content/editor-bridge/runtime-artifacts.ts` or inside visual mutation module.
  - Notes: Mirror `ai-editor/src/bridge/mutations.ts` `stripRuntimeArtifacts` concept for extension-owned overlays, temp IDs, contenteditable markers, quick-action layers, and preview-only style markers.
  - Parallelizable: yes

### Phase 4 - Editor bridge client and geometry
- [x] Add editor-side bridge routing for visual messages.
  - Files/areas: `src/editor/bridge/bridgeClient.ts`.
  - Notes: Route quick-action anchor changes, quick-action category clicks, visual target snapshots, mutation results, mutation errors, structure results, and layout refreshes into visual stores without disturbing notebook shortcut behavior.
  - Parallelizable: no

- [x] Add iframe-to-editor geometry conversion helpers for quick-action and floating panel placement.
  - Files/areas: new `src/editor/bridge/geometry.ts`, `src/editor/bridge/bridgeClient.ts`, `src/editor/components/PreviewWorkspace.tsx`.
  - Notes: Port the `ai-editor/src/editor/bridge/geometry.ts` idea, but account for the existing preview canvas transform/zoom, resize handles, and `registerPreviewFrame()` lifecycle.
  - Parallelizable: no

- [x] Sync preview canvas zoom to visual/quick-action positioning code.
  - Files/areas: `src/editor/components/PreviewWorkspace.tsx`, `src/editor/stores/useBreakpointStore.ts`, `src/content/editor-bridge/index.ts`.
  - Notes: Existing `setCanvasZoom` message only updates overlay refresh; extend or reuse it so position math and box-model highlights stay aligned with scaled iframe content.
  - Parallelizable: yes

### Phase 5 - Visual edit stores and copy lifecycle
- [x] Add editor state for selected visual target and target snapshots.
  - Files/areas: new `src/editor/stores/useVisualSelectionStore.ts` or combined visual store.
  - Notes: Store hover target, active toolbar target, selected/open panel target, snapshot status/error, latest target rect, and stale state. Keep this separate from notebook-focused `useHighlightStore` unless a small extension is cleaner.
  - Parallelizable: no

- [x] Add editor state for accumulated preview-only visual edit records.
  - Files/areas: new `src/editor/stores/useVisualEditStore.ts`.
  - Notes: Track ordered records, pending mutation state, error messages, undo/redo stacks if included in the first pass, and helper selectors for `hasVisualEdits` and exportable JSON.
  - Parallelizable: no

- [x] Add mutation dispatch helpers for visual edits.
  - Files/areas: new `src/editor/visual/visualMutationClient.ts`, `src/editor/bridge/bridgeClient.ts`.
  - Notes: Centralize `nextMutationId`, optimistic record creation, bridge post, response reconciliation, snapshot updates, and record human summary generation. Do not copy `ai-editor` source-map/chat blockers.
  - Parallelizable: no

- [x] Tie visual edit records into the notebook copy lifecycle.
  - Files/areas: `src/editor/notebook/copy.ts`, `src/editor/notebook/format.ts`, new `src/editor/notebook/visual-edits-export.ts`, `src/editor/stores/useNotebookStore.ts`, `src/editor/stores/useVisualEditStore.ts`.
  - Notes: Allow copy when the note is empty but visual edits exist. Copy output should preserve existing `## Requests`, `## Targets`, and `## Rules`, and append hidden-on-screen `## Visual edits` with human-readable summaries plus fenced JSON. On copy success, clear note draft and visual edit records.
  - Parallelizable: no

- [x] Update reset behavior to clear both note draft and visual edit records.
  - Files/areas: `src/editor/components/NotePanel.tsx`, `src/editor/stores/useNotebookStore.ts`, `src/editor/stores/useVisualEditStore.ts`.
  - Notes: The Reset button matches the user's selected copy lifecycle by clearing the visible note and accumulated hidden visual prompt data. This pass does not revert already-applied preview DOM mutations; reverting through stored before payloads needs a separate bridge action.
  - Parallelizable: no

### Phase 6 - Editor-owned hover quick-action bar
- [x] Create an editor-owned quick-action bar component rendered over the preview iframe.
  - Files/areas: new `src/editor/components/visual/QuickActionBar.tsx`, `src/editor/components/PreviewWorkspace.tsx`, `src/editor/App.tsx` if mounted globally.
  - Notes: Use the source `ai-editor/src/bridge/quickActions.ts` button set and visual style as reference, but render in the editor Shadow DOM. Include categories `콘텐츠`, `레이아웃`, `간격`, `크기`, `스타일`, `선`, plus grip, duplicate, move up, move down, delete. Exclude `이미지` unless implemented later and exclude `생성`. Structure buttons are present but disabled until the dedicated structure-operation slice wires the bridge mutations.
  - Parallelizable: no

- [x] Implement hover-triggered toolbar show/hide behavior with pointer-safe persistence.
  - Files/areas: `src/editor/components/visual/QuickActionBar.tsx`, `src/editor/stores/useVisualSelectionStore.ts`, `src/content/editor-bridge/highlight.ts`.
  - Notes: Toolbar appears on preview hover, stays visible when the pointer moves from the element to the toolbar, and hides only after neither target nor toolbar is hovered or when the target becomes stale. Use a short hide delay to avoid flicker.
  - Parallelizable: no

- [x] Compute quick-action bar placement from preview element rects.
  - Files/areas: `QuickActionBar.tsx`, `geometry.ts`, `PreviewWorkspace.tsx`.
  - Notes: Place above the element when space exists and below otherwise, matching `ai-editor` behavior. Keep visual size stable across preview zoom.
  - Parallelizable: no

- [x] Wire quick-action category buttons to open the floating visual panel.
  - Files/areas: `QuickActionBar.tsx`, `src/editor/stores/useFloatingVisualPanelStore.ts`, `src/editor/stores/useSectionJumpStore.ts`.
  - Notes: Clicking a category now opens the store-backed floating panel state for the current target and queues a section jump to the matching control section. The visible floating panel shell is implemented in the next Phase 7 item.
  - Parallelizable: no

- [x] Wire quick-action structure buttons and drag grip to preview-only structure operations.
  - Files/areas: `QuickActionBar.tsx`, `src/editor/visual/structureActions.ts`, `src/content/editor-bridge/visual-structure.ts`.
  - Notes: Duplicate, move up, move down, delete, and drag/drop now dispatch preview-only structure mutations against arbitrary resolvable DOM preview nodes, not source files. The bridge rejects protected roots, missing siblings, invalid drops, and self/descendant drops with mutation errors.
  - Parallelizable: no

### Phase 7 - Floating visual panel shell and section navigation
- [x] Port the `ai-editor` floating visual panel shell without AI-generated tabs.
  - Files/areas: new `src/editor/components/visual-panel/FloatingVisualPanel.tsx`, `src/editor/App.tsx`, `src/editor/stores/useFloatingVisualPanelStore.ts`.
  - Notes: Added the store-backed dark floating panel shell with source-like header, category tabs, close button, breakpoint badge, and scrollable body for content/layout/spacing/size/style/border only. Body controls are placeholder shells until the dedicated control slices; placement is currently a static safe default and remains covered by the next checklist item.
  - Parallelizable: no

- [x] Implement desktop and mobile/tablet panel placement.
  - Files/areas: `FloatingVisualPanel.tsx`, `geometry.ts`, `src/shared/breakpoints.ts`, `src/editor/stores/useBreakpointStore.ts`.
  - Notes: Desktop placement now anchors to the quick-action toolbar when present, then falls back to the selected target and opens above when space allows. Base/mobile/tablet breakpoints use the preview-side placement path, prefer the iframe's right side, and clamp panel width/top/height to the editor viewport. The panel remeasures on resize, scroll, breakpoint, zoom, target, and body-size changes.
  - Parallelizable: no

- [x] Port visual section primitives and section jump behavior.
  - Files/areas: new `src/editor/components/visual/VisualSection.tsx`, `VisualControl.tsx`, `UnitValueInput.tsx`, `EdgeBoxControl.tsx`, `DropdownSelect.tsx`, `PresetSelect.tsx`, `ColorInput.tsx`, `sectionJump.ts`, new `src/editor/stores/useSectionJumpStore.ts`.
  - Notes: Added source-like visual control primitives for section shells, form rows, unit inputs, edge boxes, presets, dropdowns, and color inputs without source-map/chat coupling. Quick-action categories now map to stable copy-ai-id visual section IDs, and `VisualSection` consumes the existing section jump store to expand, scroll, focus, and flash the target section. Dedicated dropdown coordination/input helper extraction remains in the next checklist item.
  - Parallelizable: yes

- [x] Port dropdown coordination and input selection helpers used by visual controls.
  - Files/areas: `src/editor/components/visual/dropdownCoordinator.ts`, `inputSelection.ts`, `src/editor/utils/numericInput.ts`.
  - Notes: Added copy-ai-id scoped dropdown coordination events, shared input value selection, and numeric input formatting/stepping/unit conversion helpers. Dropdown and color palette controls now announce open state and close when another visual dropdown opens or a global close event fires. Unit/color inputs now reuse the shared helpers instead of local copies.
  - Parallelizable: yes

- [x] Add floating panel empty/stale/error states.
  - Files/areas: `VisualPanelContent.tsx`, `useVisualSelectionStore.ts`, `useVisualEditStore.ts`.
  - Notes: Added a dedicated `VisualPanelContent` component with empty/loading/waiting/stale/error notices, selected-target summary, and runtime pending/error counts. Selection readiness is derived through `selectVisualPanelReadinessSummary()`, visual edit runtime status through `selectVisualEditRuntimeStatus()`, and UI errors intentionally show only generic guidance plus error codes/counts so visual prompt text is not exposed.
  - Parallelizable: yes

### Phase 8 - Inline style controls
- [x] Implement a CSS-property style edit API for controls.
  - Files/areas: new `src/editor/visual/useStyleEdit.ts`, `src/editor/forms/useVisualStyleForm.ts`.
  - Notes: Added `useStyleEdit()` with `commitStyle(propertyId, cssValue)`, `commitStyles()`, value lookup helpers, visual edit record integration through the existing mutation client, and a `useVisualStyleForm()` adapter for length/edge controls. Added the preview bridge `updateVisualStyle` route/handler so inline style mutations apply to arbitrary resolved elements, return snapshots, and mark visual edit records applied/failed.
  - Parallelizable: no

- [x] Implement layout controls using inline CSS properties.
  - Files/areas: new/adapted `src/editor/components/controls/LayoutControls.tsx`.
  - Notes: Added `LayoutControls` and wired it into the layout floating panel category. The controls now commit inline CSS declarations for display, flex direction/wrap, justify/align/align-content, grid template columns/rows, grid auto flow/place-items, position/inset/z-index, and overflow/axis overflow, with reset buttons and practical grid presets.
  - Parallelizable: yes

- [x] Implement spacing controls for padding, margin, and gap.
  - Files/areas: `SpacingControls.tsx`, `EdgeBoxControl.tsx`, `UnitValueInput.tsx`, `useVisualStyleForm.ts`, preview box-model highlight handlers.
  - Notes: Added `SpacingControls` and wired the spacing floating panel category to padding, margin, row-gap, and column-gap inline CSS mutations. Padding/margin expose top/right/bottom/left edge inputs, all-edge presets, per-edge reset, and box-model region hover/focus highlighting. Gap controls are enabled only for flex/grid display values with a helpful disabled notice otherwise. Added a bridge handler for targeted visual box-model region highlights.
  - Parallelizable: yes

- [x] Implement size controls.
  - Files/areas: `SizeControls.tsx`, `useVisualStyleForm.ts`.
  - Notes: Added `SizeControls` and wired the size floating panel category to inline CSS mutations for box-sizing, width, height, min/max width, min/max height, aspect-ratio, object-fit, and object-position. Extended `useVisualStyleForm()` with min/max size fields and broader size units, plus keyword preset buttons for auto/100%/fit-content/max-content/min-content/none where practical.
  - Parallelizable: yes

- [x] Implement style controls.
  - Files/areas: `TextControls.tsx`, `TypographyControls.tsx`, `ColorControls.tsx`, `OpacityControls.tsx`, `ShadowControls.tsx`, `BackgroundImageControls.tsx` as applicable.
  - Notes: Added style-panel controls for text format toggles, typography, text/background color, opacity, background image, background size/repeat/position, box/text shadows, filter, and backdrop-filter. All controls use the CSS-property `useStyleEdit()` mutation path and the source-like visual control primitives, with a shared style control helper for text inputs, textareas, preset selects, reset buttons, and preset chips.
  - Parallelizable: yes

- [x] Implement border controls.
  - Files/areas: `BorderControls.tsx`, `useVisualStyleForm.ts`.
  - Notes: Added `BorderControls` and wired the border floating panel category to inline CSS mutations for border width per edge, border style/color, uniform and per-corner radius, and outline width/style/color/offset. Extended `useVisualStyleForm()` with radius corner fields and outline length fields, and generalized style control helpers so border controls record under the border category while preserving per-property before/after export data.
  - Parallelizable: yes

- [x] Add breakpoint-aware style records and export labeling.
  - Files/areas: `useVisualEditStore.ts`, `useBreakpointStore.ts`, `visual-edits-export.ts`, visual control badges.
  - Notes: At minimum record the active breakpoint id with each edit. If responsive scoped styles are implemented, inject preview-only scoped CSS; otherwise export breakpoint intent clearly while applying inline style for immediate preview.
  - Parallelizable: no

### Phase 9 - Content, rich text, attributes, and form values
- [x] Implement content controls for text and rich HTML editing.
  - Files/areas: `TextControls.tsx`, optional `RichTextControls.tsx`, `src/content/editor-bridge/visual-mutations.ts`.
  - Notes: The user requested rich-text editing with internal HTML tag detail and immediate preview updates. Provide a contenteditable editor and/or HTML fragment textarea. Commit rich HTML through sanitized `innerHTML` mutation; commit plain text/form values through text/value mutation.
  - Parallelizable: no

- [x] Add safe rich-text sanitization.
  - Files/areas: new `src/shared/sanitize.ts` or `src/shared/visual-html.ts`, `TextControls.tsx`, preview mutation module.
  - Notes: Use `dompurify` or a strict allowlist for safe HTML fragments. Block scripts, event handlers, javascript URLs, extension-owned attributes, and runtime overlay artifacts.
  - Parallelizable: yes

- [x] Implement link and curated attribute controls under the content category.
  - Files/areas: `LinkControls.tsx`, `AttributeControls.tsx`, new `src/shared/visual-attributes.ts`, preview mutation module.
  - Notes: Allow safe attributes such as `href`, `target`, `rel`, `src`, `alt`, `title`, `aria-label`, `placeholder`, `type` when safe. Block `on*`, `style` freeform if redundant with style controls, and dangerous URL schemes.
  - Parallelizable: yes

- [x] Implement form-control value editing.
  - Files/areas: `TextControls.tsx`, `visual-targets.ts`, `visual-mutations.ts`.
  - Notes: Handle `input`, `textarea`, `select`, checkbox/radio checked state, and contenteditable targets. Record value/checked/selected before and after separately from attributes.
  - Parallelizable: yes

- [x] Keep visual prompt text hidden while editing.
  - Files/areas: `NotePanel.tsx`, `VisualPanelContent.tsx`, `useVisualEditStore.ts`.
  - Notes: Do not append visual edit text into the visible Lexical notebook while editing. Only expose status/count if needed; actual prompt goes to clipboard export.
  - Parallelizable: yes

### Phase 10 - Preview mutation handlers
- [x] Implement inline style mutation handlers in the preview bridge.
  - Files/areas: new `src/content/editor-bridge/visual-mutations.ts`, `src/content/editor-bridge/index.ts`.
  - Notes: Resolve target, capture before values, set/remove style declarations, post result with applied count and updated snapshot. Do not mutate extension-owned DOM.
  - Parallelizable: no

- [x] Implement text, rich-text, attribute, and form-value mutation handlers.
  - Files/areas: `visual-mutations.ts`, shared sanitize/attribute helpers.
  - Notes: Mirror source `ai-editor/src/bridge/mutations.ts` concepts, but adapt to `EditorTarget` and fallback target resolution. Post result messages with before/after payloads and rejection reasons.
  - Parallelizable: no

- [x] Implement delete and restore mutations.
  - Files/areas: `src/content/editor-bridge/visual-structure.ts`, `src/shared/editor-messages.ts`, `src/editor/bridge/bridgeClient.ts`.
  - Notes: Delete now preserves parent, sibling, child-index, and stripped HTML context in the structure snapshot. Restore uses the saved parent/sibling/index context to reinsert near the original location. Applied delete/restore bridge results patch the pending visual edit record so copy export includes before/after structure diffs instead of an empty optimistic shell.
  - Parallelizable: yes

- [x] Implement duplicate and move up/down mutations.
  - Files/areas: `src/content/editor-bridge/visual-structure.ts`, `src/shared/editor-messages.ts`, `src/editor/bridge/bridgeClient.ts`, `QuickActionBar.tsx`.
  - Notes: Duplicate now inserts a cleaned clone next to the source element, strips runtime-only editor artifacts from the cloned DOM path, records before/after structure snapshots, and exports the duplicated target when resolvable. Move up/down already skip extension-owned overlay elements and now record both before and after sibling/index context so visual edit copy output includes a real structure diff.
  - Parallelizable: yes

- [x] Implement drag grip movement.
  - Files/areas: `src/editor/components/visual/QuickActionBar.tsx`, `src/editor/visual/structureActions.ts`, `src/content/editor-bridge/visual-structure.ts`, `src/content/editor-bridge/overlay.ts`, `src/shared/editor-messages.ts`, `src/editor/bridge/bridgeClient.ts`.
  - Notes: The editor-owned drag grip now forwards pointer coordinates into the preview bridge during drag, the bridge resolves valid drop targets while avoiding the dragged element/descendants, shows a preview drop indicator, clears it on cancel/drop, and applies the preview-only DOM move on pointer release. Drag results now include before/after structure snapshots plus drop target/position so copy export records a machine-readable drag-move diff.
  - Parallelizable: no

- [x] Refresh overlays, quick-action anchors, selected snapshots, and layout tree after mutations.
  - Files/areas: `src/content/editor-bridge/visual-mutation-results.ts`, `src/content/editor-bridge/highlight.ts`, `src/editor/bridge/bridgeClient.ts`, `src/editor/stores/useVisualSelectionStore.ts`.
  - Notes: Applied mutations now force-refresh the preview highlight/overlay, emit refreshed quick-action anchor messages, rebuild/post layout-tree as before, and queue a post-layout selected-target snapshot refresh. Mutation snapshots also refresh matching hover, toolbar, and floating-panel rects so editor-owned overlays do not stay anchored to stale geometry.
  - Parallelizable: no

### Phase 11 - Box model and hover interaction polish
- [x] Extend box-model highlighting for padding, margin, content, and gap while editing spacing controls.
  - Files/areas: `src/content/editor-bridge/box-model.ts`, `src/editor/components/controls/SpacingControls.tsx`, `src/editor/stores/useBoxModelStore.ts`.
  - Notes: The control-driven box-model overlay now mirrors the source `HIGHLIGHT_BOX_REGION` pattern by rendering the full box-model context while emphasizing the hovered/focused region and dimming the rest. Spacing controls now expose hover/focus chips for margin, padding, content, and gap, plus all-edge/all-gap preset highlighting. Disabling box-model mode also clears any active control region highlight.
  - Parallelizable: yes

- [x] Add toolbar/floating-panel focus and keyboard guards.
  - Files/areas: `src/editor/keyboard.ts`, `src/content/editor-bridge/keyboard.ts`, `src/editor/note-hover-guard.ts`, `src/editor/visual-focus-guard.ts`, `QuickActionBar.tsx`, `FloatingVisualPanel.tsx`, `App.tsx`.
  - Notes: Added a visual focus guard that protects preview hover while interacting with the editor-owned quick-action bar or floating visual panel, and the editor keyboard handler now ignores global shortcuts from guarded visual UI so Space, Shift+Enter, arrow navigation, and hover suppression do not fire while typing/clicking controls. Quick-action toolbar stays visible while focus remains inside it. Editable detection now also covers plaintext contenteditable and role=textbox rich-text surfaces while preserving Lexical notebook Shift+Enter copy behavior.
  - Parallelizable: no

- [x] Add Escape behavior for visual panel and toolbar.
  - Files/areas: `src/editor/keyboard.ts`, `FloatingVisualPanel.tsx`, `QuickActionBar.tsx`, visual stores.
  - Notes: Escape now closes the visual panel first, then clears the quick-action toolbar/selection and falls back to the existing preview highlight clear. Visual focus-guarded Escape is handled without deleting note draft or visual edit records, and the close button keeps both floating-panel and visual-selection panel state in sync.
  - Parallelizable: yes

- [x] Add stale target handling for fallback and structure-edited elements.
  - Files/areas: `useVisualSelectionStore.ts`, `visual-targets.ts`, `toast.ts`.
  - Notes: Visual target resolution errors (`target-not-found`, `stale-target`, `ambiguous-target`) now mark the selection as stale, clear hover/toolbar anchors, disable panel controls with a concise reselect message, and show localized toast guidance. Successful structure delete closes the floating panel, marks the selection deleted, and asks the user to hover another element.
  - Parallelizable: yes

### Phase 12 - Notebook export format
- [x] Implement visual edit export formatting.
  - Files/areas: new `src/editor/notebook/visual-edits-export.ts`.
  - Notes: `formatVisualEditsSection()` now emits a `## Visual edits` section with target-grouped human summaries, per-target safety/locator notes, breakpoint intent lines, concise before/after summaries, deduped warnings, fallback-target safety guidance, and a fenced JSON export document built from ordered exportable records.
  - Parallelizable: no

- [x] Integrate visual edit export with existing notebook Markdown body.
  - Files/areas: `src/editor/notebook/copy.ts`, `src/editor/notebook/lexical/chip-export.ts`, `src/editor/notebook/format.ts`.
  - Notes: Notebook copy now passes visual-edit-only target details into the existing `## Targets` section without changing chip mention expansion. Visual edit targets already represented by note chips are skipped, while unchipped visual targets get `visual-edit-target-*` detail blocks with source record ids, stable/fallback locator data, context, and fallback safety notes; fallback visual target blocks are also recognized by the suffix/rules detector.
  - Parallelizable: no

- [x] Add copy eligibility for visual-edit-only sessions.
  - Files/areas: `src/editor/notebook/copy.ts`, `NotePanel.tsx`, `useNotebookStore.ts`, `useVisualEditStore.ts`.
  - Notes: Copy eligibility is now explicit through `selectHasNotebookDraftForCopy()` plus the existing exportable-visual-edit selector. `copyNotebookDraftFromStore()` treats visual edits as copyable even when the notebook is empty and emits the visual-only request text, while `NotePanel` tracks the same eligibility and marks the copy button with data attributes for visual-edit-only sessions without changing existing copied/empty/failed statuses.
  - Parallelizable: no

- [ ] Add visual edit warning/rule suffixes.
  - Files/areas: `src/editor/notebook/format.ts`, `src/shared/i18n.ts`.
  - Notes: Add rules stating visual edits are preview-derived instructions, should be applied to referenced targets, and should not remove/rename `data-ai-id` attributes. Include fallback-target reliability warning when fallback targets are present.
  - Parallelizable: yes

### Phase 13 - Styling, i18n, docs, and cleanup
- [ ] Port source visual panel copy and labels into current i18n structure.
  - Files/areas: `src/shared/i18n.ts`, possibly `public/_locales/*/messages.json` only if extension metadata changes.
  - Notes: Add English/Korean labels for quick actions, categories, visual controls, errors, stale target states, copy warnings, and reset text. The visible UI can use Korean labels first to match source, but keep English coverage if existing app expects it.
  - Parallelizable: yes

- [ ] Style the quick-action bar and floating panel to match `ai-editor`.
  - Files/areas: `src/editor/editor.css`, Tailwind config, new component class usage.
  - Notes: Use Tailwind utilities for ported components where possible; keep existing `copy-ai-id-editor-*` layout styles intact. Ensure `[data-ai-editor-ui]` scoping contains all Tailwind utilities in the Shadow DOM.
  - Parallelizable: yes

- [ ] Update user documentation for preview-only visual editing.
  - Files/areas: `README.md`, `README.ko.md`, `docs/editor-usage.md`, possibly Chrome Web Store disclosure docs.
  - Notes: Explain that visual edits mutate only the preview iframe, are not saved to the source page, and become precise prompt instructions when copied.
  - Parallelizable: yes

- [ ] Remove or ignore obsolete references to the prior broad visual-editing checklist if any remain.
  - Files/areas: docs and comments that reference `visual_editing.md` as an old full editor roadmap.
  - Notes: Keep this file as implementation checklist; do not remove user-facing docs unless they become misleading.
  - Parallelizable: yes

### Phase 14 - Build and completion hygiene
- [ ] Run the required extension build after implementation code changes.
  - Files/areas: project root, `package.json`, `dist/*`.
  - Notes: Per user defaults, run `npm run build` after code changes. If dependencies are missing, install from the detected lockfile and retry once. Do not run browser/UI automation or smoke checks.
  - Parallelizable: no

- [ ] Keep generated build artifacts consistent after the final implementation build.
  - Files/areas: `dist/*`, `package-lock.json`.
  - Notes: Because this is a Chrome extension project with tracked `dist`, include generated build updates only when they come from the required build step.
  - Parallelizable: no

- [ ] Keep this checklist updated while implementing.
  - Files/areas: `visual_editing.md`.
  - Notes: Mark items complete only when the corresponding code/content/config change is done. Keep `## Unresolved Issues` as `- None` unless a true implementation blocker appears.
  - Parallelizable: no
