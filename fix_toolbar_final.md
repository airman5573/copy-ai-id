# Implementation Checklist

## Objective
- Fix the quick-toolbar disappearing while the pointer moves from the currently hovered preview element to the quick-toolbar.
- Use the final verified approach: a small geometry-based transition corridor between the active anchor element and the quick-toolbar.
- Keep the implementation local to the preview bridge toolbar/hover code so highlighted element state, quick-action anchor messages, and toolbar `renderState` stay consistent.

## Assumptions
- The requested final root-level Markdown filename is `fix_toolbar_final.md`.
- `fix-toolbar-codex.md` and `fix-toolbar.md` were both inspected; the final plan intentionally chooses the corridor approach from `fix-toolbar-codex.md` over the delay-timeout approach from `fix-toolbar.md`.
- The delay-timeout approach is not the final recommendation because it can keep the toolbar DOM visible after `setHighlightedElement(null, ...)` and `quickActionAnchorChanged` have already cleared content/editor state.
- The verified source flow starts in `src/content/editor-bridge/highlight.ts`: `mouseover`, `mouseout`, and `mousemove` call `isQuickActionToolbarEvent(event)` before retargeting/clearing hover.
- The quick-toolbar is runtime-owned DOM created by `src/content/editor-bridge/quick-action-toolbar.ts`; there is no React quick-toolbar component to update.
- The primary bug window is the physical gap created by `QUICK_ACTION_BAR_GAP = 8` in `src/content/editor-bridge/quick-action-toolbar.ts`, before toolbar `pointerenter` can set `isToolbarHovered = true`.
- Expected source edits are limited to `src/content/editor-bridge/quick-action-toolbar.ts` and `src/content/editor-bridge/highlight.ts`.
- Existing unrelated working-tree changes in `dist/`, `src/editor/components/NotePanel.tsx`, `src/editor/components/visual-panel/VisualPanelContent.tsx`, and the untracked `fix-toolbar.md` are not part of this final fix plan and should not be reverted or bundled into the source patch.
- Browser/UI automation, visual checks, smoke tests, Playwright, Chrome DevTools MCP, and manual QA scripts are not allowed for Codex under the current user instructions. Static checks and the required `npm run build` are allowed after source edits.

## Risks
- If the transition corridor is too narrow, fast or diagonal pointer movement may still retarget to body/whitespace/another element before the toolbar receives `pointerenter`.
- If the transition corridor is too wide, hover can feel sticky and nearby preview elements may be temporarily blocked from normal retargeting while the toolbar is visible.
- Large anchor elements require special care: the corridor should not use the full anchor width as a sticky region unless the toolbar itself spans that area.
- If the actual reproduction path is leaving the preview iframe into editor chrome, note panel, or floating visual panel, this in-preview corridor fix may be insufficient; that iframe-boundary path should be handled as a separate scoped change, not mixed into this quick-toolbar gap fix.
- `npm run build` may update generated `dist/` files, and `dist/` is already dirty in the current worktree. Build-output changes should be reported separately and not confused with the two expected source edits.
- Human runtime confirmation may still be useful because this is an interaction-timing bug, but it is not a Codex checklist item under the current no-browser/no-smoke-test instructions.

## Unresolved Issues
- None

## Checklist
### Phase 1 - Lock the final scope and strategy
- [ ] Confirm the final strategy is the transition-corridor approach, not a global delayed-hide timeout.
  - Files/areas: `fix-toolbar-codex.md`, `fix-toolbar.md`, `src/content/editor-bridge/quick-action-toolbar.ts`, `src/content/editor-bridge/highlight.ts`
  - Notes: Keep the reason explicit: corridor prevention stops hover retarget/clear before `setHighlightedElement(null, ...)` and `quickActionAnchorChanged` fire, while timeout-only hiding can leave state inconsistent.
  - Parallelizable: no
- [ ] Confirm the quick-toolbar source ownership before editing.
  - Files/areas: `src/content/editor-bridge/quick-action-toolbar.ts`
  - Notes: Verify `toolbarRoot`, `renderState`, `isToolbarHovered`, `isToolbarFocusWithin`, `pendingHide`, `dragState`, `showQuickActionToolbar()`, `requestQuickActionToolbarHide()`, `hideQuickActionToolbar()`, and `isQuickActionToolbarElement()` are still in this module.
  - Parallelizable: no
- [ ] Confirm the hover guard integration points before editing.
  - Files/areas: `src/content/editor-bridge/highlight.ts`
  - Notes: Verify `handleMouseOver`, `handleMouseOut`, and `handleMouseMove` still call `isQuickActionToolbarEvent(event)` before resolving a new hover target or clearing the current highlight.
  - Parallelizable: no
- [ ] Keep unrelated editor-side state and UI files out of scope.
  - Files/areas: `src/shared/editor-messages.ts`, `src/editor/bridge/bridgeClient.ts`, `src/editor/stores/useVisualBridgeStore.ts`, `src/editor/stores/useVisualSelectionStore.ts`, `src/editor/components/NotePanel.tsx`, `src/editor/components/visual-panel/VisualPanelContent.tsx`, `src/editor/components/visual-panel/FloatingVisualPanel.tsx`, `src/editor/components/TopToolbar.tsx`
  - Notes: Do not change message schemas, React stores, note panel behavior, floating visual panel behavior, or top toolbar behavior for this fix unless a compile error proves a direct dependency.
  - Parallelizable: yes

### Phase 2 - Add the transition corridor helper
- [ ] Add a small transition corridor padding constant near the existing quick-action toolbar geometry constants.
  - Files/areas: `src/content/editor-bridge/quick-action-toolbar.ts`
  - Notes: Use a narrowly named constant such as `QUICK_ACTION_TRANSITION_CORRIDOR_PADDING`, with a small value in the `6` to `12` pixel range. Do not change `QUICK_ACTION_BAR_GAP` as part of the first fix.
  - Parallelizable: no
- [ ] Add an exported point-based corridor helper next to the existing toolbar element helper.
  - Files/areas: `src/content/editor-bridge/quick-action-toolbar.ts`
  - Notes: Preferred signature: `export function isPointInQuickActionToolbarTransitionCorridor(clientX: number, clientY: number): boolean`. Place it near `isQuickActionToolbarElement()` so hover-related exports stay together.
  - Parallelizable: no
- [ ] Make the corridor helper fail closed when toolbar state is unavailable.
  - Files/areas: `src/content/editor-bridge/quick-action-toolbar.ts`
  - Notes: Return `false` when `toolbarRoot` is missing, `renderState` is missing, the toolbar root is disconnected, the anchor element is disconnected, the toolbar is hidden with inline `display: none` or `visibility: hidden`, or the toolbar/anchor rect has non-finite or zero dimensions.
  - Parallelizable: no
- [ ] Re-read live geometry inside the helper instead of trusting stale cached rects.
  - Files/areas: `src/content/editor-bridge/quick-action-toolbar.ts`
  - Notes: Use `renderState.element.getBoundingClientRect()` and `toolbarRoot.getBoundingClientRect()` each time the helper runs. Do not rely only on `renderState.elementRect`, because scroll/resize/mutations can move the anchor between placement refreshes.
  - Parallelizable: no
- [ ] Implement above/below placement detection from actual rects.
  - Files/areas: `src/content/editor-bridge/quick-action-toolbar.ts`
  - Notes: Treat the toolbar as above when `toolbarRect.bottom <= anchorRect.top`; treat it as below when `anchorRect.bottom <= toolbarRect.top`. If neither relationship is true, return `false` rather than inventing a broad overlap area.
  - Parallelizable: no
- [ ] Implement the vertical corridor only across the real gap plus padding.
  - Files/areas: `src/content/editor-bridge/quick-action-toolbar.ts`
  - Notes: For an above toolbar, the vertical band should span from `toolbarRect.bottom - padding` to `anchorRect.top + padding`. For a below toolbar, span from `anchorRect.bottom - padding` to `toolbarRect.top + padding`.
  - Parallelizable: no
- [ ] Implement narrow horizontal bounds that avoid sticky behavior on large anchors.
  - Files/areas: `src/content/editor-bridge/quick-action-toolbar.ts`
  - Notes: Start from the toolbar's actual `left`/`right` expanded by padding, and include the anchor center X if it sits outside the toolbar range. Do not use the full `anchorRect.left` to `anchorRect.right` span as the default corridor for very large elements.
  - Parallelizable: no
- [ ] Return `true` only when the pointer point is inside both the horizontal and vertical corridor bounds.
  - Files/areas: `src/content/editor-bridge/quick-action-toolbar.ts`
  - Notes: Use the `clientX` and `clientY` arguments directly. Keep the helper pure with no DOM mutation, no timers, no event listeners, and no message posting.
  - Parallelizable: no

### Phase 3 - Wire the corridor into hover retarget prevention
- [ ] Import the corridor helper into the hover bridge.
  - Files/areas: `src/content/editor-bridge/highlight.ts`
  - Notes: Extend the existing import from `./quick-action-toolbar` to include `isPointInQuickActionToolbarTransitionCorridor` while keeping `isQuickActionToolbarElement`, `requestQuickActionToolbarHide`, and `showQuickActionToolbar` unchanged.
  - Parallelizable: no
- [ ] Extend `isQuickActionToolbarEvent(event)` to include the transition corridor.
  - Files/areas: `src/content/editor-bridge/highlight.ts`
  - Notes: Update the guard so it returns true when `isQuickActionToolbarElement(event.target)`, `isQuickActionToolbarElement(event.relatedTarget)`, or `isPointInQuickActionToolbarTransitionCorridor(event.clientX, event.clientY)` is true.
  - Parallelizable: no
- [ ] Preserve the existing early-return behavior in `mouseover`, `mouseout`, and `mousemove` handlers.
  - Files/areas: `src/content/editor-bridge/highlight.ts`
  - Notes: The existing handler structure should continue to return before `setHighlightedElement(...)` or `resolvePreviewHighlightElement(event)` when `isQuickActionToolbarEvent(event)` is true. The corridor should therefore preserve the previous highlighted element while the pointer crosses the gap.
  - Parallelizable: no
- [ ] Avoid adding a separate timeout/cancel-hide flow.
  - Files/areas: `src/content/editor-bridge/quick-action-toolbar.ts`, `src/content/editor-bridge/highlight.ts`
  - Notes: Do not add `hideTimeoutId`, `HIDE_DELAY_MS`, or an exported `cancelQuickActionToolbarHide()` as the primary fix. The final plan is to prevent the incorrect hover clear, not delay the visible hide after state has already cleared.
  - Parallelizable: no

### Phase 4 - Preserve existing toolbar behavior and runtime boundaries
- [ ] Keep existing toolbar active-interaction behavior intact.
  - Files/areas: `src/content/editor-bridge/quick-action-toolbar.ts`
  - Notes: Do not remove or replace `pointerenter`, `pointerleave`, `focusin`, `focusout`, drag pointer capture, `pendingHide`, `flushPendingHideIfReady()`, or `hasActiveToolbarInteraction()`.
  - Parallelizable: no
- [ ] Keep disconnected-anchor hiding behavior intact.
  - Files/areas: `src/content/editor-bridge/quick-action-toolbar.ts`
  - Notes: `updateToolbarPlacement()` should still call `hideQuickActionToolbar()` when `renderState.element` is no longer connected. The new corridor helper must not keep stale/disconnected targets alive.
  - Parallelizable: no
- [ ] Avoid message schema and editor-store changes.
  - Files/areas: `src/shared/editor-messages.ts`, `src/editor/bridge/bridgeClient.ts`, `src/editor/stores/useVisualBridgeStore.ts`, `src/editor/stores/useVisualSelectionStore.ts`
  - Notes: Existing `targetHighlighted`, `quickActionAnchorChanged`, quick-action category, structure, and drag messages remain sufficient. Editor stores are downstream and should not be changed for this in-preview gap fix.
  - Parallelizable: yes
- [ ] Avoid runtime artifact/config changes unless new DOM is emitted.
  - Files/areas: `src/shared/config.ts`, `src/content/editor-bridge/runtime-artifacts.ts`
  - Notes: The corridor helper should emit no DOM and no new attributes/classes, so runtime artifact cleanup and extension-owned selectors should not need changes.
  - Parallelizable: yes
- [ ] Keep generated `dist/` files out of manual editing.
  - Files/areas: `dist/`
  - Notes: Source edits should happen in `src/`. If the required build later regenerates `dist/`, report that separately; do not hand-edit generated assets.
  - Parallelizable: yes

### Phase 5 - Static checks, required build, and final source-scope review
- [ ] Run TypeScript static checking after source edits.
  - Files/areas: `package.json`, `tsconfig.json`, edited TypeScript files
  - Notes: Run `npm run typecheck`. If dependencies are unexpectedly missing, use the existing `package-lock.json` with `npm ci` once, then retry the original typecheck command.
  - Parallelizable: no
- [ ] Run the required production build after source edits.
  - Files/areas: `package.json`, `vite.config.ts`, `src/`, generated `dist/`
  - Notes: Run `npm run build` because this project has an npm build script and the implementation changes frontend/extension TypeScript. If dependencies are unexpectedly missing, use `npm ci` from the existing `package-lock.json` once, then retry the build command.
  - Parallelizable: no
- [ ] Review the final diff for the intended scope only.
  - Files/areas: `src/content/editor-bridge/quick-action-toolbar.ts`, `src/content/editor-bridge/highlight.ts`, any build-generated `dist/` files
  - Notes: The source diff should primarily add the corridor constant/helper and the hover guard import/call. Remove unrelated refactors, broad editor-side changes, timeout-based hide changes, and manual generated-asset edits before considering the implementation complete.
  - Parallelizable: no
