# Implementation Checklist

## Objective
- Improve Copy AI ID preview selection so hover, click pinning, quick-action anchoring, and Space/notebook target insertion use a Chrome-DevTools-inspired strict point picker.
- The picker must select the deepest composed element at the pointer location and must not promote that element to a nearest `data-ai-id` ancestor.
- Preserve current target compatibility: if the exact selected element itself owns `data-ai-id`, serialize it as an `ai-id` target; if the exact selected element has no `data-ai-id`, serialize it as a fallback target when fallback metadata and a layout-tree `nodeId` are available.
- Keep the change scoped to the current preview frame and existing open Shadow DOM behavior; do not redesign nested iframe routing, closed shadow-root handling, or the `EditorTarget` message shape.
- Use the local DevTools references only as design inspiration for hit-testing, box-model terminology, and highlight configuration concepts; do not integrate Chrome DevTools Protocol or automate a browser.

## Assumptions
- User decisions are fixed for implementation:
  - Strict deepest composed element wins for pointer hover/click.
  - No `data-ai-id` ancestor promotion for hover, selection, highlighting, quick-action anchoring, or Space/notebook insertion.
  - Exact selected element with its own `data-ai-id` still becomes an `ai-id` target.
  - Exact selected no-ID element becomes a fallback target when a layout-tree `nodeId` exists.
  - Scope remains current preview frame plus open Shadow DOM only; no `EditorTarget` shape change.
- Chrome DevTools behavior to emulate is the high-level split between point hit-testing and overlay rendering:
  - DevTools-like point hit-test inspiration: `DOM.getNodeForLocation(x, y, ...)` chooses the node at the viewport point.
  - DevTools-like highlight inspiration: `Overlay.HighlightConfig` separates content, padding, border, and margin colors and uses box-model geometry.
  - This project will implement local DOM equivalents, not CDP/backend-node equivalents.
- Normal browser hit-testing semantics should remain in force; do not emulate CDP's optional `ignorePointerEventsNone` behavior.
- Content, padding, and border can be selected only insofar as browser hit-testing reports the element at that point; margin and flex/grid gaps remain visual/secondary regions, not custom owner-selection regions.
- `src/content/editor-bridge/highlight.ts` should keep event-listener orchestration, pinned-element state, bridge posting, overlay updates, and quick-action toolbar synchronization.
- A new content-side local picker helper may own pure hit-test, target conversion, local geometry, and current-frame reference-building logic.
- Existing editor-side consumers should continue receiving the same `EditorTarget` union from `src/shared/editor-messages.ts`.
- This repo has `npm run build`; after future TypeScript/source implementation changes, run `npm run build` automatically. `npm run typecheck` is available and may be run for type-heavy refactors, but tests/lint/browser/visual/smoke checks remain out of scope unless explicitly requested.

## Risks
- Strict deepest selection will intentionally produce more fallback targets, including small internal leaves such as `span`, `svg`, `path`, icon wrappers, and layout-only children.
- Fallback targets are less stable than `ai-id` targets and may become stale or ambiguous after DOM changes; existing stale/ambiguous handling should be preserved rather than hidden by ancestor promotion.
- `fallbackTargetForElement(...)` requires a non-null `nodeId`; dynamically inserted no-ID elements that are not present in the latest layout-tree snapshot may highlight but fail to create a fallback target until the tree is rebuilt.
- Local DOM rectangle/quad helpers will not exactly match DevTools backend quads for transforms, clipping, SVG geometry, or multi-fragment inline layout; this is acceptable for the first local implementation.
- Adding border-region geometry to the existing box-model overlay may affect current visual-region highlighting behavior because `VisualBoxRegion` already includes `border` while `box-model.ts` currently does not render border regions.
- The working tree already contains unrelated dirty files in tracked `dist/` output and `src/editor/stores/useFloatingNotePanelStore.ts`; future implementation must not reset, overwrite, stage, or commit those unrelated changes unless explicitly authorized.
- `npm run build` may update tracked root `dist/` hashed assets; staging must be explicit and must not use `git add .`.
- Human/browser visual confirmation may be useful after implementation, but it is not an AI-side checklist dependency under the current no-browser/no-visual-verification defaults.

## Unresolved Issues
- None

## Checklist
### Phase 1 - Establish the local picker boundary
- [ ] Record the pre-implementation Git baseline without modifying it.
  - Files/areas: `git status --short --untracked-files=all`, root `dist/`, `src/editor/stores/useFloatingNotePanelStore.ts`.
  - Notes: Treat the existing dirty `dist/` hash rotation and floating note panel store change as unrelated. Do not clean, stash, reset, or stage them as part of the selection logic implementation unless the user separately authorizes it.
  - Parallelizable: no

- [ ] Create a content-side local picker module for strict point selection and target conversion.
  - Files/areas: add `src/content/editor-bridge/local-picker.ts`.
  - Notes: Keep `highlight.ts` as the UI/state orchestrator. The new module should provide typed helpers for local hit-testing, exact-element target creation, viewport geometry, and optional local highlight/box-model data. Do not import editor React code or introduce shared message schema changes.
  - Parallelizable: no

- [ ] Define CDP-inspired but local-only picker/geometry types.
  - Files/areas: `src/content/editor-bridge/local-picker.ts`, optionally `src/content/editor-bridge/box-model.ts` if geometry types are better colocated there.
  - Notes: Include small local data shapes such as `LocalQuad`, `LocalBoxModel`, `LocalHighlightConfig`, `LocalHitTestResult`, and `LocalTargetReference`. These should model current-frame DOM data only and must not include backend node IDs, frame IDs, object IDs, or any new serialized `EditorTarget` fields.
  - Parallelizable: yes

### Phase 2 - Implement composed point hit-testing
- [ ] Add a composed `elementsFromPoint` stack helper while preserving the existing API.
  - Files/areas: `src/content/target/composed-dom.ts`.
  - Notes: Add a helper such as `getComposedElementsFromPoint(x, y, root = document)` that starts from `root.elementsFromPoint(x, y)`, descends into accessible open shadow roots with `shadowRoot.elementsFromPoint(x, y)`, avoids duplicates/cycles, and returns candidates in point-hit order. Keep `getDeepElementFromPoint(...)` exported for existing callers, either unchanged or implemented as the first/deepest candidate from the new stack helper.
  - Parallelizable: yes

- [ ] Keep the hit-test scope explicitly limited.
  - Files/areas: `src/content/target/composed-dom.ts`, `src/content/editor-bridge/local-picker.ts`.
  - Notes: Do not traverse nested iframe documents, closed shadow roots, or user-agent shadow DOM. Do not emulate `ignorePointerEventsNone`; rely on normal browser hit testing. If the point is over a child `<iframe>` from the current frame, the current-frame element exposed by browser hit testing is the only candidate in scope.
  - Parallelizable: yes

- [ ] Implement strict point candidate selection in the local picker.
  - Files/areas: `src/content/editor-bridge/local-picker.ts`, `src/shared/config.ts` for `isExtensionOwnedElement` import only.
  - Notes: Select the first connected, non-extension-owned element from the composed point stack. Use `event.composedPath()` and `event.target` only as fallback sources when point hit-testing returns no connected page element. Never replace a valid child hit with a `data-ai-id` ancestor.
  - Parallelizable: no

### Phase 3 - Preserve exact-element target semantics
- [ ] Move or mirror exact-element target creation into the local picker.
  - Files/areas: `src/content/editor-bridge/local-picker.ts`, existing logic in `src/content/editor-bridge/highlight.ts`, `src/content/editor-bridge/layout-tree.ts`, `src/content/editor-bridge/fallback-target.ts`.
  - Notes: The helper should return an `ai-id` target only when the exact selected element itself has non-empty `data-ai-id`, using `instancesOf(aiId).indexOf(element)` for `instanceIndex`. For no-ID elements, use `fallbackTargetForElement(element, resolveNodeIdForElement(element))`. Do not call `closestAiIdElement(...)` or any equivalent ancestor promotion.
  - Parallelizable: no

- [ ] Keep fallback-target eligibility unchanged.
  - Files/areas: `src/content/editor-bridge/fallback-target.ts`.
  - Notes: Do not allow fallback to override an element's own `data-ai-id`; `fallbackMetadataForElement(...)` should remain limited to connected, non-extension-owned no-ID elements. Reuse existing labels, selectors, paths, open-shadow `::shadow` selector support, class tokens, and accessibility/context metadata.
  - Parallelizable: yes

- [ ] Add a typed local reference builder for bridge payloads.
  - Files/areas: `src/content/editor-bridge/local-picker.ts`, `src/shared/editor-messages.ts` types imported only.
  - Notes: Build `{ target, nodeId, elementRect, viewport }` for an exact picked element using the existing `BridgeViewportRect` and `BridgeViewportSize` shapes. Preserve null-target behavior when no fallback can be created because `nodeId` is missing. Do not add fields to `TargetHighlightedMessage`, `TargetReferenceRequestedMessage`, or `QuickActionAnchorChangedMessage`.
  - Parallelizable: no

- [ ] Make missing-nodeId behavior explicit without refreshing the layout tree on every hover.
  - Files/areas: `src/content/editor-bridge/local-picker.ts`, `src/content/editor-bridge/highlight.ts`, `src/content/editor-bridge/layout-tree.ts`.
  - Notes: For the first implementation, keep hover/pointer movement cheap. If a connected no-ID element lacks a `nodeId`, allow the element to be highlighted but return `target: null` so quick actions/chip insertion can use existing rejection or hide behavior. Add an on-demand layout-tree refresh only if implementation review shows an existing local bridge hook can do it surgically without broad state churn.
  - Parallelizable: no

### Phase 4 - Integrate strict selection into preview hover, click, and Space flows
- [ ] Replace `resolvePreviewHighlightElement(event)` with strict local picker resolution.
  - Files/areas: `src/content/editor-bridge/highlight.ts`, `src/content/editor-bridge/local-picker.ts`.
  - Notes: Preserve the quick-action toolbar/corridor special case: events over extension toolbar UI should keep the current highlighted element instead of retargeting. Otherwise, return the strict deepest connected page element from the local picker. This resolver is shared by hover preview, click pinning, and downstream Space/reference insertion via current highlighted state.
  - Parallelizable: no

- [ ] Update `highlight.ts` to use local picker target/reference helpers.
  - Files/areas: `src/content/editor-bridge/highlight.ts`, `src/content/editor-bridge/local-picker.ts`.
  - Notes: `setHighlightedElement(...)`, `pinQuickActionToolbar(...)`, and `requestHighlightedTargetReference(...)` should all derive `target`, `nodeId`, `elementRect`, and `viewport` from the exact selected element. Keep bridge messages unchanged and keep `hasSameEditorTarget(...)` comparisons intact.
  - Parallelizable: no

- [ ] Remove obsolete ancestor-promotion helpers and imports after integration.
  - Files/areas: `src/content/editor-bridge/highlight.ts`.
  - Notes: Delete `closestAiIdElement(...)`, `connectedAiIdElement(...)`, and the `closestComposedElementMatching` import if they are no longer referenced. Keep `hasUsableAiId(...)` only if it still drives an existing rejection reason; otherwise remove it as dead code. Do not refactor unrelated hover suppression, pinned state, overlay, or toolbar code.
  - Parallelizable: no

- [ ] Keep all preview selection entry points consistent.
  - Files/areas: `src/content/editor-bridge/highlight.ts`, `src/content/editor-bridge/keyboard.ts`, `src/content/editor-bridge/quick-action-toolbar.ts`.
  - Notes: Verify by code inspection that `mouseover`, `mousemove`, click pinning, `requestHighlightedTargetReference(post)` used by Space, quick-action anchor changes, and hover overlay updates all use the same exact selected element and target reference. Do not split hover behavior from click behavior.
  - Parallelizable: yes

### Phase 5 - Align box-model/highlight geometry with DevTools concepts locally
- [ ] Add local quad and box-model geometry helpers without changing target serialization.
  - Files/areas: `src/content/editor-bridge/local-picker.ts`, `src/content/editor-bridge/box-model.ts`.
  - Notes: Use current-frame DOM APIs such as `getBoundingClientRect()`, `getClientRects()`, and `getComputedStyle()` to build local `content`, `padding`, `border`, and `margin` geometry. This is for internal highlight/diagnostic data only; do not include it in `EditorTarget` or bridge target references.
  - Parallelizable: yes

- [ ] Add border-region support to the existing box-model overlay if the geometry extraction touches it.
  - Files/areas: `src/content/editor-bridge/box-model.ts`, `src/shared/editor-messages.ts` read-only for `VisualBoxRegion`.
  - Notes: `VisualBoxRegion` already includes `border`, but `box-model.ts` currently renders `margin`, `padding`, `content`, and `gap`. Add `border` rectangles and DevTools-style border color handling so `showBoxModelRegion(..., { region: 'border' })` can highlight real border regions. Keep margin and gap visual-only; do not use them to override selection.
  - Parallelizable: yes

- [ ] Keep the current overlay rendering architecture.
  - Files/areas: `src/content/editor-bridge/overlay.ts`, `src/content/editor-bridge/box-model.ts`, `src/content/editor-bridge/visual-box-highlight.ts`.
  - Notes: Continue using fixed/absolute DOM overlay layers with `pointer-events: none`. Do not add canvas-based DevTools overlay rendering, CDP `Overlay.highlightNode`, rulers, tooltip collision logic, or browser automation. The selected element change should naturally move the overlay to the strict picked element.
  - Parallelizable: yes

### Phase 6 - Preserve editor and visual-target compatibility
- [ ] Leave shared target/message types unchanged.
  - Files/areas: `src/shared/editor-messages.ts`, `src/shared/editor-targets.ts`.
  - Notes: Do not add a new `EditorTarget.kind`, do not add hit metadata fields, and do not change `targetIdentityKey(...)` or `hasSameEditorTarget(...)`. Existing chips/session payloads must continue to use only `ai-id` and `fallback` targets.
  - Parallelizable: yes

- [ ] Keep visual target resolution exact-element compatible.
  - Files/areas: `src/content/editor-bridge/visual-targets.ts`.
  - Notes: Preserve `elementMatchesEditorTarget(...)` and `targetForResolvedElement(...)` semantics: own `data-ai-id` resolves as `ai-id`; no-ID elements resolve through fallback metadata. Do not introduce ancestor lookup in visual mutation resolution to compensate for strict pointer selection.
  - Parallelizable: yes

- [ ] Keep layout-tree row semantics unchanged.
  - Files/areas: `src/content/editor-bridge/layout-tree.ts`, `src/editor/components/tree/LayoutTreeNodeRow.tsx`.
  - Notes: The layout tree already targets the exact row node: rows with `aiId` create `ai-id` targets and rows with fallback metadata create fallback targets. Do not apply pointer-only logic changes to tree navigation or tree row target creation beyond shared helper imports if needed.
  - Parallelizable: yes

- [ ] Preserve extension-owned UI exclusion.
  - Files/areas: `src/shared/config.ts`, `src/content/editor-bridge/highlight.ts`, `src/content/editor-bridge/local-picker.ts`, `src/content/editor-bridge/overlay.ts`, `src/content/editor-bridge/quick-action-toolbar.ts`.
  - Notes: Ensure overlays, editor shell nodes, and quick-action toolbar nodes remain unselectable. Overlay layers should retain `pointer-events: none`, and local picker filtering should still reject extension-owned elements.
  - Parallelizable: yes

### Phase 7 - Static checks and build under current project rules
- [ ] Run TypeScript type checking if the implementation introduces exported picker/geometry types or moves target helpers across modules.
  - Files/areas: `package.json`, `tsconfig.json`, changed TypeScript files.
  - Notes: Command: `npm run typecheck`. This is allowed and useful for type-heavy refactors, but if it fails, record the issue and continue to the required build step when possible. Do not run tests, lint, browser flows, smoke checks, or visual checks unless the user explicitly requests them.
  - Parallelizable: no

- [ ] Run the required project build after source changes.
  - Files/areas: `package.json`, `dist/`, changed source files.
  - Notes: Command: `npm run build`. If dependencies are missing, run `npm ci` from the repo root because `package-lock.json` exists, then retry the original build once. Expect root `dist/` to change because it is tracked; stage only intentional build outputs and never use `git add .`.
  - Parallelizable: no

- [ ] Review generated/dirty file impact before any implementation commit.
  - Files/areas: `git status --short --untracked-files=all`, `dist/`, `src/content/**`, `src/shared/**`, `src/editor/**`.
  - Notes: Confirm the unrelated pre-existing dirty files remain separated from implementation changes. Stage only the implementation files and intentional build outputs. Do not stage `src/editor/stores/useFloatingNotePanelStore.ts` unless the user explicitly assigns that file to this task.
  - Parallelizable: no
