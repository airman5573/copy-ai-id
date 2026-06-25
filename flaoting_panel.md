# Implementation Checklist

## Objective
- Add a persisted ON/OFF mode for the editor NotePanel so the user can choose between the current docked right-panel workflow and a floating NotePanel workflow.
- When floating mode is ON, remove the docked right NotePanel column from the main grid and render a single floating NotePanel overlay near the selected/hovered element.
- Preserve the user's requested Space flow: when Space is pressed for a target, open the floating NotePanel near that element, focus the NotePanel, then insert the target chip.
- Keep the current docked/right panel workflow available when floating mode is OFF, including the existing iframe/mobile-friendly behavior.

## Assumptions
- The requested filename is intentionally `flaoting_panel.md` and should remain exactly as provided.
- Floating mode is a global persisted preference controlled from `TopToolbar`, stored in `chrome.storage.local`, and defaulting to OFF so existing behavior remains unchanged until the user enables it.
- The floating ON/OFF preference applies across all breakpoints; mobile/tablet users can turn floating OFF to keep the docked/right panel behavior.
- Only one Lexical-backed `NotePanel` should be mounted for the active mode: docked when floating is OFF, floating when floating is ON.
- In floating mode, the floating panel may stay mounted while visually closed so `insertTargetReference` can be registered before the first Space-triggered insertion.
- Browser/UI automation, smoke tests, visual checks, and manual QA are not part of this checklist; after frontend code changes, `npm run build` is the required project build check.

## Risks
- Capturing anchor geometry after note focus or Lexical insertion can race with `protectNoteEditorFromHover()`, because `bridgeClient.ts` ignores hover/quick-action anchor messages while note hover protection is active.
- Rendering both docked and floating NotePanel instances can cause competing Lexical plugin registrations via `setInsertTargetReference`, duplicate state writes, or chip insertion going to the wrong editor.
- If the floating NotePanel is unmounted or `display: none` at the moment Space is handled, the focus-first-then-insert flow can fail because the Lexical editor is not focusable or its insertion callback is not registered.
- The current preview iframe `targetReferenceRequested` message does not include element geometry, so iframe Space needs a message payload extension for reliable exact-moment placement.
- The existing `MainArea` already has resizable panel width state; hiding the right column must also hide the note resize handle and adjust available-width calculations so preview fit/zoom does not drift.
- Small editor viewports may not have enough room for a full floating NotePanel near the target; the floating panel must clamp width/height and scroll internally.
- Current global Escape handling returns early for editable targets, so Escape inside the NotePanel editor may not close the floating panel unless a wrapper/close-button behavior is added.

## Unresolved Issues
- None

## Checklist
### Phase 1 - State, message contracts, and shared positioning primitives
- [x] Add a dedicated floating NotePanel store.
  - Files/areas: `src/editor/stores/useFloatingNotePanelStore.ts`
  - Notes: Create a Zustand store with persisted `enabled: boolean` using a key such as `copy-ai-id:note-panel-floating-enabled:v1`, runtime `isOpen: boolean`, runtime `anchor`, and actions like `hydrateEnabled`, `setEnabled`, `toggleEnabled`, `openNearTarget`, `updateAnchorRects`, `closePanel`, and `resetFloatingNotePanelRuntime`. Use the same best-effort `chrome.storage.local` pattern already used in `useEditorLayoutStore.ts` and `useNotebookStore.ts`.
  - Parallelizable: no

- [x] Define the floating NotePanel anchor type and exact anchor data shape.
  - Files/areas: `src/editor/stores/useFloatingNotePanelStore.ts`, optionally `src/editor/note-panel-anchor.ts`
  - Notes: Include `target`, `nodeId`, `elementRect`, `editorRect`, optional `viewport`, and `updatedAt`. Keep `elementRect` in preview iframe viewport coordinates and `editorRect` in editor viewport coordinates so placement can reuse `bridgeViewportRectToEditorViewportRect` and existing stores.
  - Parallelizable: no

- [x] Generalize the existing floating placement helper name without breaking the visual panel.
  - Files/areas: `src/editor/bridge/geometry.ts`, `src/editor/components/visual-panel/FloatingVisualPanel.tsx`
  - Notes: Add a generic export such as `calculateFloatingOverlayPlacement` that wraps the current `calculateFloatingVisualPanelPlacement` implementation, then keep `calculateFloatingVisualPanelPlacement` as an alias for backward compatibility or update visual panel imports to the generic name. Do not rewrite placement math.
  - Parallelizable: yes

- [x] Extend the preview-to-editor target reference message to carry geometry.
  - Files/areas: `src/shared/editor-messages.ts`
  - Notes: Add optional `elementRect?: BridgeViewportRect | null` and `viewport?: BridgeViewportSize` to `TargetReferenceRequestedMessage`. This lets iframe Space provide the element rect measured at the exact keydown moment.
  - Parallelizable: yes

- [x] Add a target-anchor resolver for editor-side Space flows.
  - Files/areas: `src/editor/note-panel-anchor.ts` or local helpers in `src/editor/shortcut-actions.ts`, `src/editor/stores/useVisualSelectionStore.ts`, `src/editor/stores/useVisualBridgeStore.ts`, `src/editor/bridge/geometry.ts`, `src/shared/editor-targets.ts`
  - Notes: Resolve anchors in this order: explicit iframe message geometry, matching `activeToolbarTarget`, matching `hoverTarget`, matching `useVisualBridgeStore.quickActionAnchor`, preview iframe rect fallback, then safe editor viewport fallback. Use `hasSameEditorTarget` and prefer exact `nodeId` matches when available.
  - Parallelizable: no

### Phase 2 - Toolbar toggle and mode hydration
- [x] Hydrate floating mode when the editor app mounts and reset runtime floating state on unmount.
  - Files/areas: `src/editor/App.tsx`, `src/editor/stores/useFloatingNotePanelStore.ts`
  - Notes: Call `hydrateEnabled()` during app initialization. On cleanup, reset only runtime fields such as `isOpen` and `anchor`; do not clear the persisted ON/OFF preference.
  - Parallelizable: no

- [x] Add a persistent NotePanel floating-mode toggle to the top toolbar.
  - Files/areas: `src/editor/components/TopToolbar.tsx`, `src/shared/i18n.ts`, `src/editor/editor.css`
  - Notes: Add a `ToolbarButton` in `TopToolbar` with a stable `data-ai-id` such as `copy-ai-id-editor-note-panel-floating-toggle-button`, `aria-pressed`, and localized labels/titles for enable/disable/toggle. Use the floating store's `enabled` and `toggleEnabled` actions.
  - Parallelizable: yes

- [x] Define localized labels for the new toggle.
  - Files/areas: `src/shared/i18n.ts`
  - Notes: Extend `CopyAiIdMessages.editor` with fields such as `notePanelFloatingToggle`, `notePanelFloatingEnableTitle`, and `notePanelFloatingDisableTitle`, then add English and Korean strings.
  - Parallelizable: yes

- [x] Close or reset the floating panel when the user turns floating mode OFF.
  - Files/areas: `src/editor/stores/useFloatingNotePanelStore.ts`, `src/editor/components/TopToolbar.tsx` or store action implementation
  - Notes: `setEnabled(false)` should close the floating runtime panel and clear its anchor while preserving notebook content in `useNotebookStore` and existing panel width in `useEditorLayoutStore`.
  - Parallelizable: no

### Phase 3 - MainArea docked/floating layout switch
- [x] Hide the docked NotePanel and right grid column when floating mode is ON.
  - Files/areas: `src/editor/components/MainArea.tsx`, `src/editor/editor.css`
  - Notes: Read floating `enabled` from the new store. When enabled, set grid columns to `${leftColumnWidth}px minmax(0, 1fr)`, omit docked `<NotePanel />`, and set a diagnostic data attribute such as `data-ai-editor-note-panel-floating="true"`.
  - Parallelizable: no

- [x] Hide the note-panel resize handle while floating mode is ON.
  - Files/areas: `src/editor/components/MainArea.tsx`, `src/editor/keyboard.ts`
  - Notes: Do not render the `PanelResizeHandle` with `side="note"` when the docked right panel is hidden. Keep `copy-ai-id-editor-note-panel-width-resize-handle` in the resize-handle ignore list for docked mode.
  - Parallelizable: no

- [x] Adjust panel-width calculations for floating mode.
  - Files/areas: `src/editor/components/MainArea.tsx`, `src/editor/stores/useEditorLayoutStore.ts`
  - Notes: Update `getAvailablePanelMaxWidth` or its callers so layout-tree max width does not subtract `notePanelWidth` when the right NotePanel column is hidden. Keep `notePanelWidth` persisted for docked width and floating overlay width.
  - Parallelizable: no

- [x] Trigger preview fit/geometry recalculation when floating mode changes.
  - Files/areas: `src/editor/components/MainArea.tsx`, `src/editor/App.tsx`, `src/editor/bridge/bridgeClient.ts`
  - Notes: Mirror the existing `layoutTreeCollapsed` behavior by scheduling `onFitZoom` when floating mode toggles. Ensure `syncVisualBridgeGeometry()` still sees current iframe geometry after the layout changes.
  - Parallelizable: no

### Phase 4 - Floating NotePanel UI and reusable panel rendering
- [x] Refactor `NotePanel` so it can render as docked or floating without duplicating notebook logic.
  - Files/areas: `src/editor/components/NotePanel.tsx`, `src/editor/components/ui/builderChrome.tsx`
  - Notes: Add props like `variant?: 'docked' | 'floating'`, `dataAiId?: string`, and `onRequestClose?: () => void`. Keep the existing notebook controls, Lexical editor, visual edit status, and copy/reset behavior in one component. Add a close button only for floating variant if needed.
  - Parallelizable: no

- [x] Add optional class/style/data passthrough to `PanelChrome` if needed by floating rendering.
  - Files/areas: `src/editor/components/ui/builderChrome.tsx`, `src/editor/components/NotePanel.tsx`
  - Notes: Keep existing left/right panel behavior unchanged. Add only the minimal props needed for floating classes and accessible attributes.
  - Parallelizable: yes

- [ ] Create the `FloatingNotePanel` overlay component.
  - Files/areas: `src/editor/components/FloatingNotePanel.tsx`, `src/editor/bridge/geometry.ts`, `src/editor/stores/useFloatingNotePanelStore.ts`, `src/editor/stores/useEditorLayoutStore.ts`
  - Notes: Use the stored anchor and `notePanelWidth`. Measure panel size with `ResizeObserver`, compute a clamped placement using the shared floating overlay helper, and render `NotePanel variant="floating"` inside a fixed pointer-events layer. Use internal scrolling and max-height clamping.
  - Parallelizable: no

- [ ] Keep the floating NotePanel mounted while floating mode is enabled but closed.
  - Files/areas: `src/editor/components/FloatingNotePanel.tsx`, `src/editor/editor.css`
  - Notes: Avoid `display: none` for the mounted Lexical editor if it must be focusable after `openNearTarget`. Prefer a closed state that is non-interactive and invisible until opened, or set `isOpen` before issuing the focus request on Space.
  - Parallelizable: no

- [ ] Mount the floating NotePanel layer in the app shell.
  - Files/areas: `src/editor/App.tsx`
  - Notes: Render `<FloatingNotePanel />` near `<FloatingVisualPanel />`. Ensure it only owns the active NotePanel when floating mode is ON and the docked NotePanel is omitted by `MainArea`.
  - Parallelizable: no

- [ ] Add floating NotePanel CSS.
  - Files/areas: `src/editor/editor.css`
  - Notes: Add layer/shell classes such as `.copy-ai-id-editor-floating-note-panel-layer` and `.copy-ai-id-editor-floating-note-panel`. Match existing editor surfaces, z-index below or coordinated with `FloatingVisualPanel`, fixed positioning, max-height, overflow handling, and reduced-motion behavior consistent with `.copy-ai-id-editor-floating-visual-panel`.
  - Parallelizable: yes

### Phase 5 - Space flow, focus-first insertion, and geometry capture
- [ ] Include element geometry when preview iframe Space requests a target reference.
  - Files/areas: `src/content/editor-bridge/highlight.ts`
  - Notes: In `requestHighlightedTargetReference(post)`, compute `elementRect = viewportRectForElement(element)` and `viewport = viewportSize()` before posting `targetReferenceRequested`. No change should be needed in `src/content/editor-bridge/keyboard.ts`.
  - Parallelizable: yes

- [ ] Pass iframe Space geometry through the editor bridge before focus/insertion.
  - Files/areas: `src/editor/bridge/bridgeClient.ts`, `src/editor/shortcut-actions.ts`
  - Notes: In the `targetReferenceRequested` case, call `appendTargetReferenceToNotebook(reference, { elementRect: message.elementRect, viewport: message.viewport })` or equivalent. Convert explicit iframe rects to editor rects before opening the floating panel.
  - Parallelizable: no

- [ ] Refactor notebook target insertion into an explicit helper.
  - Files/areas: `src/editor/shortcut-actions.ts`, `src/editor/stores/useNotebookStore.ts`
  - Notes: Extract the current insertion body into something like `insertTargetReferenceIntoNotebook(reference)`. Keep fallback behavior that calls `notebook.appendTargetReference(reference)` when Lexical registration is unavailable.
  - Parallelizable: no

- [ ] Extend note-panel focus events with same-window post-focus callbacks.
  - Files/areas: `src/editor/note-panel-focus.ts`, `src/editor/notebook/lexical/NotebookEditorPlugins.tsx`
  - Notes: Add `requestNotePanelFocus(detail?: { afterFocus?: () => void })` and `onNotePanelFocusRequest(listener: (detail?: NotePanelFocusRequestDetail) => void)`. In `FocusRequestPlugin`, select root end and focus, then invoke `afterFocus` after focus using `onUpdate` plus a microtask or `requestAnimationFrame`.
  - Parallelizable: no

- [ ] Implement floating Space sequence in `appendTargetReferenceToNotebook`.
  - Files/areas: `src/editor/shortcut-actions.ts`, `src/editor/note-panel-anchor.ts`, `src/editor/stores/useFloatingNotePanelStore.ts`, `src/editor/note-panel-focus.ts`
  - Notes: If floating mode is enabled, capture anchor immediately, call `openNearTarget(anchor)`, then request NotePanel focus with `afterFocus` inserting the chip. This satisfies the requested ordering: open near element, focus, then insert chip. If floating mode is OFF, preserve existing docked behavior unless a shared focus-first path is simpler and safe.
  - Parallelizable: no

- [ ] Ensure editor-window Space can anchor without fresh iframe message geometry.
  - Files/areas: `src/editor/shortcut-actions.ts`, `src/editor/note-panel-anchor.ts`, `src/editor/stores/useVisualSelectionStore.ts`, `src/editor/stores/useVisualBridgeStore.ts`
  - Notes: For Space handled by `src/editor/keyboard.ts`, use the target/nodeId from `useHighlightStore` and the resolver fallback order from Phase 1. This covers layout-tree and editor-shell Space where no new iframe geometry payload exists.
  - Parallelizable: no

- [ ] Add Escape/close behavior for the floating NotePanel without breaking visual panel Escape behavior.
  - Files/areas: `src/editor/shortcut-actions.ts`, `src/editor/components/FloatingNotePanel.tsx`, `src/editor/keyboard.ts`
  - Notes: Provide an explicit close button in the floating panel. Optionally update `handleEditorEscapeAction` to close floating NotePanel after visual panel handling and before clearing highlight. If supporting Escape inside the note editor, handle it at the floating wrapper because global keyboard currently skips editable targets.
  - Parallelizable: no

### Phase 6 - Runtime artifact cleanup, docs, and final build
- [ ] Add floating NotePanel runtime markers to artifact stripping if needed.
  - Files/areas: `src/content/editor-bridge/runtime-artifacts.ts`, `src/shared/visual-html.ts`
  - Notes: If the floating NotePanel introduces new `data-ai-editor-*`, `data-copy-ai-id-*`, or class/id prefixes that can appear in serialized preview HTML, add them to the runtime artifact cleanup lists. Since the NotePanel is in the editor Shadow DOM, this may only require confirming no preview DOM artifacts are introduced.
  - Parallelizable: yes

- [ ] Update user-facing docs for the new mode.
  - Files/areas: `README.md`, `README.ko.md`, `docs/editor-usage.md`, optionally `docs/chrome-web-store-listing-copy.md`
  - Notes: Replace “Right note panel” wording with mode-aware language, document the toolbar toggle, and clarify that Space in floating mode opens/focuses the NotePanel near the element before inserting the chip. Do not add manual QA steps.
  - Parallelizable: yes

- [ ] Review `data-ai-id` coverage for all new rendered controls and layers.
  - Files/areas: `src/editor/components/TopToolbar.tsx`, `src/editor/components/FloatingNotePanel.tsx`, `src/editor/components/NotePanel.tsx`, `src/editor/components/ui/builderChrome.tsx`
  - Notes: Assign stable, semantic IDs such as `copy-ai-id-editor-note-panel-floating-toggle-button`, `copy-ai-id-editor-floating-note-panel-layer`, `copy-ai-id-editor-floating-note-panel`, and `copy-ai-id-editor-floating-note-panel-close-button`.
  - Parallelizable: yes

- [ ] Run the required frontend build after code/content changes.
  - Files/areas: `package.json`, generated build output if the project emits it
  - Notes: Per project instructions, run `npm run build` after implementation code changes. If dependencies are missing, install from the existing lockfile with `npm ci` and retry the build once. Do not add browser/UI automation or smoke tests.
  - Parallelizable: no
