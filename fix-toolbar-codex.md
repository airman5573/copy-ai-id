# Implementation Checklist

## Objective
- Prevent the preview `quick-toolbar` from disappearing while the pointer moves from the hovered preview element to the toolbar.
- Preserve the current architecture: the quick-toolbar remains runtime-owned DOM inside the preview iframe, hover tracking remains in the preview bridge, and the React editor/floating visual panel continue to receive the same quick-action messages.
- Keep the change surgical: protect the pointer transition path between the active element and toolbar instead of rewriting hover selection, visual panel state, or message protocols.

## Assumptions
- The requested root-level output filename is `fix-toolbar-codex.md`.
- The current issue is caused by hover retargeting before the toolbar receives `pointerenter`: the existing toolbar protection only applies when the event target or related target is already inside `[data-copy-ai-id-quick-action-bar]`, or after `isToolbarHovered`/focus/drag state is active.
- `src/content/editor-bridge/quick-action-toolbar.ts` is the only implementation that renders the quick-toolbar; there is no React quick-toolbar component.
- `src/content/editor-bridge/highlight.ts` owns preview hover selection and is the correct place to ignore pointer events that should not retarget the hovered element.
- Runtime checks must not use browser/UI automation. Static checks such as `npm run typecheck` and the required `npm run build` are acceptable after code changes.
- Existing unrelated working-tree changes in `dist/`, `src/editor/components/NotePanel.tsx`, and `src/editor/components/visual-panel/VisualPanelContent.tsx` should not be touched by this fix unless the later implementer intentionally takes ownership of them.
- Multi-agent exploration identified a broader iframe-boundary clear path (`mouseout.relatedTarget === null`) when moving from the preview iframe into editor chrome, note panel, or floating visual panel. This plan treats that as a related risk, but keeps the primary implementation scoped to the in-preview quick-toolbar transition path requested by the user.

## Risks
- If the transition corridor is too narrow, fast or diagonal pointer movement may still retarget to the underlying page before `pointerenter` reaches the toolbar.
- If the transition corridor is too wide, nearby preview elements may temporarily fail to receive hover while the toolbar is visible.
- Edge placements are clamped by viewport padding, so the corridor must use the actual `toolbarRoot.getBoundingClientRect()` rather than assuming the toolbar is centered over the element.
- Elements can disconnect or move during preview-only mutations; corridor logic must fail closed when the anchor element or toolbar is missing/hidden.
- Final human runtime confirmation may still be useful because the bug is interaction-timing-sensitive, but it must not be implemented through AI-side browser automation under the current instructions.
- If the actual reproduction path is leaving the preview iframe into editor chrome rather than moving to the in-preview quick-toolbar, the corridor-only fix may be insufficient and a separate deferred iframe-exit clear/preserve mechanism should be planned as its own scoped change.

## Unresolved Issues
- None

## Checklist
### Phase 1 - Confirm the current hover and toolbar boundaries
- [ ] Inspect the quick-toolbar render and hide state before editing.
  - Files/areas: `src/content/editor-bridge/quick-action-toolbar.ts`
  - Notes: Confirm the current module-level state (`toolbarRoot`, `renderState`, `isToolbarHovered`, `isToolbarFocusWithin`, `pendingHide`, `dragState`) and the public functions already exported from this file. Keep the fix inside this module unless a file listed below explicitly needs a small import/call-site update.
  - Parallelizable: no
- [ ] Inspect the hover event guard call sites before editing.
  - Files/areas: `src/content/editor-bridge/highlight.ts`
  - Notes: Confirm `installHoverHighlight()` calls `isQuickActionToolbarEvent(event)` from `mouseover`, `mouseout`, and `mousemove` handlers before it retargets hover. Confirm `setHighlightedElement()` calls `showQuickActionToolbar()` only when both `nextElement` and `nextTarget` exist, otherwise calls `requestQuickActionToolbarHide()`.
  - Parallelizable: no
- [ ] Leave editor-side quick-action state unchanged unless a compile error proves a type update is required.
  - Files/areas: `src/editor/bridge/bridgeClient.ts`, `src/editor/stores/useVisualSelectionStore.ts`, `src/editor/stores/useVisualBridgeStore.ts`, `src/shared/editor-messages.ts`
  - Notes: These files receive quick-action messages and open the floating visual panel. The toolbar disappearing while moving the pointer is a preview-bridge hover problem, so do not broaden the scope into React/store/message changes.
  - Parallelizable: yes

### Phase 2 - Add a pointer transition corridor around the toolbar gap
- [ ] Add a small transition-zone padding constant near the existing quick-toolbar geometry constants.
  - Files/areas: `src/content/editor-bridge/quick-action-toolbar.ts`
  - Notes: Add a narrowly named constant such as `QUICK_ACTION_BAR_TRANSITION_PADDING = 6`. Keep `QUICK_ACTION_BAR_GAP = 8` unchanged unless implementation evidence shows the gap itself must change. The padding should make the corridor tolerant of fast/diagonal pointer movement without blocking unrelated hover too broadly.
  - Parallelizable: no
- [ ] Export a helper that detects whether a mouse event is in the bridge/corridor between the active element and the toolbar.
  - Files/areas: `src/content/editor-bridge/quick-action-toolbar.ts`
  - Notes: Add an exported function such as `isPointerInQuickActionToolbarTransitionZone(event: MouseEvent): boolean`. It should return `false` when `toolbarRoot` is missing, `renderState` is missing, the anchor element is disconnected, the toolbar is hidden with `display: none`/`visibility: hidden`, or rects cannot describe an above/below relationship.
  - Parallelizable: no
- [ ] Implement the corridor using actual element and toolbar viewport rects.
  - Files/areas: `src/content/editor-bridge/quick-action-toolbar.ts`
  - Notes: Use `renderState.element.getBoundingClientRect()` and `toolbarRoot.getBoundingClientRect()`. For an above toolbar, treat the vertical corridor as the band from `toolbarRect.bottom` to `anchorRect.top`; for a below toolbar, use `anchorRect.bottom` to `toolbarRect.top`. Expand the horizontal bounds to `min(anchorRect.left, toolbarRect.left) - padding` through `max(anchorRect.right, toolbarRect.right) + padding`, and expand the vertical band slightly by the same padding.
  - Parallelizable: no
- [ ] Make the helper conservative for overlapping or nonstandard placements.
  - Files/areas: `src/content/editor-bridge/quick-action-toolbar.ts`
  - Notes: If the toolbar overlaps the anchor or is neither clearly above nor below, return `false` first. If later implementation needs overlap support, handle it explicitly rather than making the corridor cover a large union area by default.
  - Parallelizable: no
- [ ] Keep existing toolbar interaction state behavior intact.
  - Files/areas: `src/content/editor-bridge/quick-action-toolbar.ts`
  - Notes: Do not remove `pointerenter`, `pointerleave`, `focusin`, `focusout`, drag capture, `pendingHide`, or `hasActiveToolbarInteraction()`. The new corridor only protects the movement before the toolbar becomes actively hovered/focused.
  - Parallelizable: no

### Phase 3 - Wire the corridor into hover retarget prevention
- [ ] Import the new transition-zone helper into the hover bridge.
  - Files/areas: `src/content/editor-bridge/highlight.ts`
  - Notes: Extend the existing import from `./quick-action-toolbar` to include the new helper. Avoid creating a new module or dependency layer unless circular import constraints appear during typechecking.
  - Parallelizable: no
- [ ] Extend `isQuickActionToolbarEvent()` to treat the transition corridor as toolbar-owned interaction.
  - Files/areas: `src/content/editor-bridge/highlight.ts`
  - Notes: Update the guard to return `true` when `isQuickActionToolbarElement(event.target)`, `isQuickActionToolbarElement(event.relatedTarget)`, or `isPointerInQuickActionToolbarTransitionZone(event)` is true. This should cause `mouseover`, `mouseout`, and `mousemove` handlers to ignore the gap/corridor instead of changing `highlightedElement` or requesting toolbar hide.
  - Parallelizable: no
- [ ] Preserve the previously highlighted element while pointer events are ignored for the corridor.
  - Files/areas: `src/content/editor-bridge/highlight.ts`, `src/content/editor-bridge/quick-action-toolbar.ts`
  - Notes: Do not call `setHighlightedElement(null, ...)` or re-resolve `deepestElementForMouseEvent()` while the pointer is in the corridor. The active `renderState.element` should stay the anchor until the pointer enters the toolbar, leaves the corridor into another real element, or another existing clear path runs.
  - Parallelizable: no
- [ ] Confirm toolbar DOM remains excluded from target discovery and copied artifacts.
  - Files/areas: `src/shared/config.ts`, `src/content/editor-bridge/runtime-artifacts.ts`
  - Notes: No change should be needed because `[data-copy-ai-id-quick-action-bar]` is already treated as extension-owned DOM and runtime artifact. If the implementation adds new runtime attributes/classes for the corridor, add them to artifact cleanup only if they are actually emitted into DOM.
  - Parallelizable: yes

### Phase 4 - Handle edge cases without broadening scope
- [ ] Ensure disconnected anchors hide normally.
  - Files/areas: `src/content/editor-bridge/quick-action-toolbar.ts`
  - Notes: Keep `updateToolbarPlacement()` behavior that hides when `renderState.element` is no longer connected. The transition-zone helper should not keep stale toolbar state alive for disconnected elements.
  - Parallelizable: no
- [ ] Ensure focus and drag interactions still defer hide.
  - Files/areas: `src/content/editor-bridge/quick-action-toolbar.ts`
  - Notes: The corridor should not replace `isToolbarFocusWithin` or `dragState`. Button click, keyboard focus, and drag-grip pointer capture should continue to use the existing `pendingHide`/`flushPendingHideIfReady()` logic.
  - Parallelizable: no
- [ ] Avoid changing quick-action message schemas.
  - Files/areas: `src/shared/editor-messages.ts`, `src/editor/bridge/bridgeClient.ts`
  - Notes: The fix should not need new message types or fields. `quickActionAnchorChanged`, `quickActionCategoryRequested`, structure actions, and drag messages should remain source-compatible.
  - Parallelizable: yes
- [ ] Avoid modifying generated `dist/` assets manually.
  - Files/areas: `dist/`
  - Notes: Source changes should be made under `src/`. Let the required production build regenerate `dist/` if the later implementation commits built assets as part of that work.
  - Parallelizable: yes
- [ ] Keep iframe-boundary/editor-chrome preservation out of the first fix unless the code path proves it is the same reproduction.
  - Files/areas: `src/content/editor-bridge/highlight.ts`, `src/editor/visual-focus-guard.ts`, `src/editor/components/NotePanel.tsx`, `src/editor/components/TopToolbar.tsx`
  - Notes: Moving from the preview iframe into editor chrome can produce `mouseout.relatedTarget === null` and clear hover before editor-side guards run. That is broader than the in-preview quick-toolbar gap. Do not add editor-chrome bridge messages, note-panel-wide guards, or floating-panel pointerenter behavior in this patch unless the later implementer confirms this is the exact requested quick-toolbar path.
  - Parallelizable: yes
- [ ] Keep editor store cleanup out of this quick-toolbar fix unless a source-level dependency requires it.
  - Files/areas: `src/editor/stores/useVisualSelectionStore.ts`, `src/editor/shortcut-actions.ts`
  - Notes: `setHoverTarget()` can create a truthy object with `target: null`, which may be worth a separate cleanup. Do not include it in the toolbar transition patch unless the implementation touches hover clear semantics beyond the quick-toolbar corridor.
  - Parallelizable: yes

### Phase 5 - Static checks and required build after code changes
- [ ] Run TypeScript static checking after source edits.
  - Files/areas: `package.json`, `tsconfig.json`, edited TypeScript files
  - Notes: Run `npm run typecheck`. If dependencies are unexpectedly missing, use the existing `package-lock.json` with `npm ci` once, then retry the original typecheck command.
  - Parallelizable: no
- [ ] Run the required production build after source edits.
  - Files/areas: `package.json`, `vite.config.ts`, `src/`, generated `dist/`
  - Notes: Because this project has an npm `build` script and the fix changes frontend/extension TypeScript, run `npm run build`. If dependencies are unexpectedly missing, use the existing `package-lock.json` with `npm ci` once, then retry the build command.
  - Parallelizable: no
- [ ] Review the final source diff for scope control.
  - Files/areas: `src/content/editor-bridge/quick-action-toolbar.ts`, `src/content/editor-bridge/highlight.ts`, any generated `dist/` files from build
  - Notes: The source diff should primarily add the transition-zone helper and the hover guard import/call. Remove unrelated refactors, style churn, or editor-side store changes unless they were required by type/build errors.
  - Parallelizable: no
