# Implementation Checklist

## Objective
- Fix the preview quick toolbar disappearing when moving the pointer from a hovered preview element into the toolbar by moving only the quick toolbar DOM into the preview iframe document.
- Keep the floating visual panel and all canonical visual-edit dispatch/recording in the existing editor Shadow DOM React app.
- Use preview-iframe toolbar interactions as bridge-to-editor requests: the iframe toolbar sends user intent to the editor, and the editor continues to call `selectQuickActionCategory`, `dispatchVisualStructureMutation`, snapshot requests, and visual edit recording.

## Assumptions
- The confirmed reproduction scope is the preview iframe path: `src/content/editor-bridge/highlight.ts` clears hover when the pointer leaves the iframe document toward the current Shadow DOM toolbar, especially through `mouseout` with `relatedTarget === null`.
- Only the quick toolbar itself moves into the preview iframe. `src/editor/components/visual-panel/FloatingVisualPanel.tsx` remains in the editor Shadow DOM.
- The editor remains the canonical action dispatcher. Preview toolbar category/structure/drag events should be represented as bridge-to-editor request messages, not direct bridge-side visual mutations that bypass editor stores or visual edit records.
- Layout-tree hover can still show the iframe toolbar because layout-tree hover already routes through `handleHoverTreeNode()` in the preview bridge, which resolves and highlights an element inside the iframe.
- Browser/UI automation, smoke checks, and visual checks are not part of this checklist. After code changes, run the required local build step because the project has an npm `build` script.

## Risks
- Rendering toolbar DOM inside the page/iframe document means it must be marked as extension/runtime-owned so hover target resolution, layout-tree extraction, fallback targeting, visual mutations, copied HTML stripping, and structure operations never treat the toolbar as user page content.
- Page CSS could affect iframe-injected toolbar unless the toolbar module uses sufficiently scoped classes, inline reset styles, or an isolated style element with runtime-owned attributes.
- Removing the Shadow DOM toolbar means `FloatingVisualPanel` can no longer anchor itself by querying `[data-ai-id="copy-ai-id-editor-quick-action-bar"]` in the editor root; panel placement must intentionally fall back to the selected target rect or consume a new bridge-provided toolbar rect.
- Drag-move support currently converts editor viewport points to bridge viewport points in `src/editor/visual/structureActions.ts`; iframe toolbar drag events already have bridge viewport coordinates and need a separate request/helper path.
- Human visual confirmation may still be useful after implementation, but it is intentionally not an AI-side checklist item under the current no-browser-verification defaults.

## Unresolved Issues
- None

## Checklist
### Phase 1 - Define bridge contract and runtime ownership
- [ ] Add quick-toolbar runtime ownership constants/selectors.
  - Files/areas: `src/shared/config.ts`, `src/content/editor-bridge/runtime-artifacts.ts`
  - Notes: Ensure the new iframe toolbar root and any injected style nodes are treated as extension-owned/runtime-only. Existing stripping already mentions `[data-copy-ai-id-quick-action-bar]`; confirm it covers the exact attributes/classes/styles used by the new toolbar. Update `EXTENSION_OWNED_DOM_SELECTOR` or an equivalent helper so hover/fallback/layout-tree/visual-target code excludes the iframe toolbar.
  - Parallelizable: no

- [ ] Add typed bridge-to-editor quick toolbar request messages.
  - Files/areas: `src/shared/editor-messages.ts`
  - Notes: Add explicit message types/interfaces for iframe toolbar requests, such as category selection, structure operation, drag preview, drag commit, and drag clear. Payloads should include `target`, `nodeId`, and the needed category/operation/bridge viewport point. Include `elementRect`/`viewport` where useful so the editor can open the existing floating panel with the same selected target geometry. Add the new interfaces to `BridgeToEditorMessage`, not just `EditorToBridgeMessage`.
  - Parallelizable: no

### Phase 2 - Build the iframe-owned quick toolbar module
- [ ] Create a preview bridge quick toolbar renderer.
  - Files/areas: new `src/content/editor-bridge/quick-action-toolbar.ts`
  - Notes: Port the quick toolbar categories (`content`, `layout`, `spacing`, `size`, `style`, `border`), structure actions (`duplicate`, `move-up`, `move-down`, `delete`), labels from `getCurrentMessages()`, and styling from the old React/CSS implementation into a plain DOM module that runs inside the preview iframe. The toolbar root should use stable runtime attributes such as `data-copy-ai-id-quick-action-bar` and a stable `data-ai-id` for internal consistency, while still being excluded as runtime UI.
  - Parallelizable: no

- [ ] Implement iframe viewport placement and refresh behavior.
  - Files/areas: `src/content/editor-bridge/quick-action-toolbar.ts`, optionally `src/content/editor-bridge/overlay.ts`
  - Notes: Position the toolbar with `position: fixed` using the highlighted element's `getBoundingClientRect()` in iframe viewport coordinates. Preserve above/below placement, gap, padding, viewport clamping, max width, and resize/scroll refresh behavior. Use a live highlighted element reference so scroll/resize can recalculate placement without stale `elementRect` values.
  - Parallelizable: no

- [ ] Implement toolbar pointer/focus lifetime inside the iframe.
  - Files/areas: `src/content/editor-bridge/quick-action-toolbar.ts`, `src/content/editor-bridge/highlight.ts`
  - Notes: Keep the toolbar visible while the pointer or focus is inside the toolbar. When iframe hover changes to a different page element, update the toolbar target. When the highlighted element is cleared for a real page/iframe exit, hide and destroy or detach the toolbar. Avoid relying on the old 180ms Shadow DOM transition delay as the primary protection.
  - Parallelizable: no

- [ ] Add toolbar interaction dispatchers that post intent to the editor.
  - Files/areas: `src/content/editor-bridge/quick-action-toolbar.ts`
  - Notes: Category buttons should post the new category request message. Structure buttons should post the new structure request message. Drag grip should keep pointer capture in the iframe toolbar, apply the same 8px threshold behavior, post drag-preview requests during drag, post drag-commit on successful release, and post drag-clear on cancel/lost capture.
  - Parallelizable: no

### Phase 3 - Wire highlight and bridge lifecycle
- [ ] Integrate the iframe toolbar with highlighted element updates.
  - Files/areas: `src/content/editor-bridge/highlight.ts`
  - Notes: In `setHighlightedElement()`, after resolving `nextElement`, `nextTarget`, `nextNodeId`, `elementRect`, and `viewport`, call the new toolbar renderer when a targetable connected element exists and hide it when the highlight is cleared. Preserve the existing `targetHighlighted` and `quickActionAnchorChanged` messages for editor stores, layout tree synchronization, and floating panel state.
  - Parallelizable: no

- [ ] Prevent toolbar pointer events from clearing or retargeting preview hover.
  - Files/areas: `src/content/editor-bridge/highlight.ts`, `src/shared/config.ts`
  - Notes: Update `mouseover`, `mouseout`, and `mousemove` handling so events whose target or related target is inside the iframe toolbar do not call `setHighlightedElement(null)` or resolve the toolbar as a page element. This is the iframe-side equivalent of making toolbar hover part of the hover-safe region.
  - Parallelizable: no

- [ ] Clean up toolbar lifecycle when the preview bridge is destroyed.
  - Files/areas: `src/content/editor-bridge/index.ts`, `src/content/editor-bridge/quick-action-toolbar.ts`
  - Notes: Ensure `startPreviewBridge().destroy()` removes toolbar DOM, injected styles, event listeners, timers, pointer capture state, and scroll/resize listeners. The cleanup should run alongside `cleanupHoverHighlight()`, `cleanupBridgeKeyboard()`, and `cleanupOverlayTracking()`.
  - Parallelizable: no

### Phase 4 - Route iframe toolbar requests through the existing editor action flow
- [ ] Handle new quick toolbar request messages in the editor bridge client.
  - Files/areas: `src/editor/bridge/bridgeClient.ts`
  - Notes: Add `routeBridgeMessage()` cases for category request, structure request, drag preview, drag commit, and drag clear. Category requests should call `selectQuickActionCategory()` with the existing target/node/category and converted target rect. Structure requests should call the same editor-side visual mutation path used by the old React toolbar.
  - Parallelizable: no

- [ ] Add bridge-point drag helpers without replacing existing editor-point helpers.
  - Files/areas: `src/editor/visual/structureActions.ts`, possibly `src/editor/visual/visualMutationClient.ts`
  - Notes: Keep `dispatchQuickActionDragMoveFromEditorPoint()` for any remaining editor-coordinate callers. Add helper(s) that accept a `BridgeViewportPoint` directly for iframe toolbar drag preview/commit, then post `previewVisualDragMove` or call `dispatchVisualStructureMutation({ operation: 'drag-move', dropPoint, source: 'drag-and-drop', category: 'layout' })` without an editor-to-bridge coordinate conversion.
  - Parallelizable: no

- [ ] Keep the existing floating visual panel opening behavior intact.
  - Files/areas: `src/editor/bridge/bridgeClient.ts`, `src/editor/stores/useVisualSelectionStore.ts`, `src/editor/stores/useFloatingVisualPanelStore.ts`
  - Notes: `selectQuickActionCategory()` should remain the single place that opens `panelTarget`, `FloatingVisualPanel`, queues section jump, posts `quickActionCategorySelected`, and requests a snapshot. If category request payloads include `elementRect`, convert it to editor viewport rect before passing options.
  - Parallelizable: no

### Phase 5 - Retire the Shadow DOM quick toolbar
- [ ] Remove the old React toolbar render from the preview workspace.
  - Files/areas: `src/editor/components/PreviewWorkspace.tsx`, `src/editor/components/visual/QuickActionBar.tsx`
  - Notes: Remove the `QuickActionBar` import/render so there is only one toolbar. Delete `QuickActionBar.tsx` if all behavior has been ported, or leave only shared types/constants if they are still imported. Avoid duplicate toolbar DOM in Shadow DOM and iframe.
  - Parallelizable: no

- [ ] Move or remove obsolete Shadow DOM toolbar CSS.
  - Files/areas: `src/editor/editor.css`, `src/content/editor-bridge/quick-action-toolbar.ts` or a new bridge style helper
  - Notes: Port only the needed visual styles into the iframe toolbar module. Remove unused `.copy-ai-id-editor-quick-action-bar*` CSS from the editor stylesheet if the React toolbar is deleted. Keep class names scoped enough that page CSS conflicts are unlikely.
  - Parallelizable: no

- [ ] Adjust floating panel anchoring after removing the Shadow DOM toolbar.
  - Files/areas: `src/editor/components/visual-panel/FloatingVisualPanel.tsx`
  - Notes: `quickActionToolbarRect(panelElement)` will no longer find a toolbar in the editor Shadow DOM. Either remove that lookup and intentionally anchor desktop follow mode to the selected target rect, or consume a bridge-provided toolbar rect if added in Phase 1. Prefer the selected target rect unless a toolbar-rect payload is already implemented.
  - Parallelizable: no

### Phase 6 - Documentation and static/build checks
- [ ] Update product documentation that describes toolbar placement.
  - Files/areas: `docs/editor-usage.md`, `README.md`, possibly `docs/chrome-web-store-listing-copy.md`
  - Notes: Replace statements that the quick toolbar is rendered in the editor Shadow DOM with the new behavior: the quick toolbar is runtime-owned DOM inside the preview iframe, while the floating visual panel remains in the editor Shadow DOM. Keep existing user-facing behavior claims about moving from element to toolbar staying usable.
  - Parallelizable: yes

- [ ] Run the required local build after frontend code changes.
  - Files/areas: `package.json`, generated build output under `dist/`
  - Notes: Run `npm run build` after implementation because this project defines an npm build script and frontend/source files will change. If dependencies are missing, install once using the existing lockfile policy and retry the build once. Do not run browser automation, smoke checks, visual checks, or E2E tests unless separately requested.
  - Parallelizable: no
