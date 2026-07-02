# Implementation Checklist

## Objective
- Refactor the copy-ai-id extension for navigability and extensibility before new feature work: remove dead/legacy code, deduplicate copy-pasted helpers, remove store dual-writes (keeping store boundaries), split and runtime-validate the postMessage protocols, and apply a rename/re-layout convention — all on a single `refactor/v2` branch, with exact behavior preserved except for explicitly confirmed inconsistency fixes.

## Assumptions
- No tests, ESLint/Prettier, or CI are added (user decision). Verification per step is `npm run typecheck` and `npm run build` only.
- Legacy compatibility paths are removed (user decision): old plaintext notebook drafts in currently open tabs may fail to restore after the update; that is accepted.
- The two undo mechanisms (`useVisualEditStore` history stacks and `visualUndo.ts` negative-id round-trips) both stay; per-kind mutation code stays explicit with shared helpers extracted only.
- No new runtime dependencies: runtime message validation uses hand-rolled type guards in the style of `isCopyAiIdRuntimeMessage` (`src/shared/runtime-messages.ts:27`).
- `docs/` and `skills/` were deleted intentionally in `fc816d5` and are not restored; README links to them are cleaned instead.
- All commits go to the `refactor/v2` branch; nothing is pushed; merge to `main` is the user's call at the end.
- Final end-to-end verification (loading `dist/` unpacked and exercising the editor on `examples/*.html`) is a human step after the checklist completes; it is not a checklist item.

## Risks
- High-risk invariants that touched code must preserve exactly: `bridgeReady` posted before `layoutTree` (`src/content/editor-bridge/index.ts:80-89` vs reset logic in `src/editor/bridge/bridgeClient.ts:251-271`); ephemeral layout-tree `nodeId` lifecycle (`src/content/editor-bridge/layout-tree.ts:55-73`); keyboard event precedence (`src/content/editor-bridge/keyboard.ts:11-65`); the three hover/focus-guard timings and the quick-action toolbar corridor (`quick-action-toolbar.ts:170-225`, `pendingHide`/`hasActiveToolbarInteraction` gating); the bootstrap self-destruct globals (`window.__copyAiId*Cleanup__`, `copy-ai-id:destroy-content-script-instance`).
- Z-index constants live in different documents/stacking contexts (top frame vs preview iframe); do not renumber any of them while centralizing.
- Runtime validation guards that are stricter than the actual emitted messages would silently drop traffic; guards must check only the discriminant plus fields the receiver actually reads, and log a console warning when dropping.
- Rename/move phases churn many imports; each move batch must end with a clean `npm run typecheck` before committing.
- A human smoke pass over hover → quick-action bar → visual panel → notebook copy on `examples/complex-tailwind-test.html` and `examples/shadow-dom-test.html` after completion is recommended (non-blocking).

## Unresolved Issues
- None

## Checklist

### Phase 1 - Branch setup and baseline
- [x] Create and switch to a `refactor/v2` branch off `main`
  - Files/areas: git
  - Notes: All subsequent checklist commits land on this branch; do not push.
  - Parallelizable: no
- [x] Record a green baseline: run `npm run typecheck` and `npm run build`
  - Files/areas: repo root
  - Notes: If the baseline fails, fix only what is required to get green before any refactor commit.
  - Parallelizable: no

### Phase 2 - Dead code and legacy path removal
- [ ] Delete the dead box-model block in `local-picker.ts`
  - Files/areas: src/content/editor-bridge/local-picker.ts
  - Notes: Remove `localBoxModelForElement` (lines ~122-169), types `LocalBoxModel`/`LocalQuad`/`LocalPoint`/`LocalHighlightConfig`/`LocalHitTestResult`/`LocalHitTestSource`/`LocalTargetReference` (~16-47), and helpers `ringToQuads`/`rectToQuads`/`insetRect`/`pxToNumber` (~252-314). Grep each symbol across `src/` before deleting; keep the live picker path intact.
  - Parallelizable: yes
- [ ] Delete unused exports in the content bridge
  - Files/areas: src/content/editor-bridge/layout-tree.ts (`buildLayoutTreeMessage` line ~45), src/content/editor-bridge/quick-action-toolbar.ts (`refreshQuickActionToolbarPlacement` ~161), src/content/editor-bridge/visual-mutation-results.ts (`postVisualMutationError` ~150, `isVisualMutationResultMessage` ~185), src/content/editor-bridge/visual-targets.ts (`hasSameResolvedVisualTarget` ~817)
  - Notes: Grep each symbol across all of `src/` first; delete only zero-reference exports.
  - Parallelizable: yes
- [ ] Remove the dead artifact-reporting path in `runtime-artifacts.ts`
  - Files/areas: src/content/editor-bridge/runtime-artifacts.ts
  - Notes: Delete `stripRuntimeArtifactsFromElement` (~122) and the `stripRuntimeArtifactsWithReport`/`describe*Artifact` reporting machinery; keep `stripRuntimeArtifacts` but reimplement it without building the discarded report.
  - Parallelizable: yes
- [ ] Prune the legacy artifact vocabulary in `runtime-artifacts.ts` against what the current editor actually emits
  - Files/areas: src/content/editor-bridge/runtime-artifacts.ts (selector/attribute lists, lines ~15-94), src/editor/**, src/content/editor-bridge/**
  - Notes: For each `data-ai-editor-*`/`data-copy-ai-id-*` selector and marker (e.g., `inline-text-active/protected`, `floating-visual-panel`, `preview-scope`), grep the codebase for a writer; remove entries with no writer. Keep any entry that a current module still sets.
  - Parallelizable: no
- [ ] Remove editor-side dead code and duplicate selectors
  - Files/areas: src/editor/note-hover-guard.ts (`protectNoteEditorFromHover` alias ~57-59), src/editor/stores/useVisualEditStore.ts (`selectHasCopyableVisualEdits` ~259-261 — inline its one behavior into callers of `selectHasVisualEdits` or vice versa; `hiddenPromptCount` duplicate of `exportableCount` ~280), src/editor/stores/useNotebookStore.ts (`appendTargetReference` stub ~158-167)
  - Notes: For `appendTargetReference`, confirm the `insertTargetReference == null` fallback is unreachable in practice (the Lexical editor injects the callback on mount in NotebookEditorPlugins); if a mount-race window exists, keep a minimal no-op guard instead of the stub.
  - Parallelizable: yes
- [ ] Remove legacy notebook-draft compatibility paths
  - Files/areas: src/editor/notebook/lexical/chip-import.ts (`$initializeNotebookFromLegacyText`, `isLegacyNotebookDraftValue`), src/editor/notebook/session-draft.ts (legacy plaintext fallback branch; keep v2 JSON as the only accepted format), src/shared/editor-targets.ts (`formatEditorTargetReference`, ~44-63)
  - Notes: Old-format drafts stop restoring — accepted. After removal, simplify session-draft validation to the v2 path only; delete now-unused validators.
  - Parallelizable: no
- [ ] Remove the backwards-compatible alias in `runtime-messages.ts` if unreferenced
  - Files/areas: src/shared/runtime-messages.ts (~24-25)
  - Notes: Grep for the alias name across `src/`; delete only if the canonical name covers all usages.
  - Parallelizable: yes
- [ ] Delete the unreferenced `tsconfig.base.json`
  - Files/areas: tsconfig.base.json
  - Notes: `tsconfig.json` does not `extends` it and nothing else references it; the stricter flags were never enforced and the user declined enforcing them.
  - Parallelizable: yes
- [ ] Phase gate: `npm run typecheck` and `npm run build`
  - Files/areas: repo root
  - Notes: Fix fallout from deletions before moving on.
  - Parallelizable: no

### Phase 3 - Content-bridge deduplication and confirmed fixes
- [ ] Create shared utility modules under `src/content/editor-bridge/lib/`
  - Files/areas: new src/content/editor-bridge/lib/viewport.ts, lib/dom.ts, lib/text.ts
  - Notes: viewport.ts: one `viewportRectForElement` and one `viewportSize`. dom.ts: `isContentEditableElement`, `dispatchNativeInputEvents`, `previousEditableSibling`/`nextEditableSibling`, `tagNameOf`, `pxToNumber`. text.ts: trim/preview/context-text helpers and one class-tokenization function.
  - Parallelizable: no
- [ ] Unify `viewportSize` on the `visualViewport`-aware implementation (confirmed fix)
  - Files/areas: src/content/editor-bridge/visual-targets.ts (~605, the visualViewport version — becomes canonical), src/content/editor-bridge/local-picker.ts (~190), src/content/editor-bridge/quick-action-toolbar.ts (~752)
  - Notes: This intentionally changes behavior under pinch-zoom for local-picker and quick-action-toolbar — the one approved inconsistency fix in this phase.
  - Parallelizable: no
- [ ] Replace all duplicated helper copies with the lib versions
  - Files/areas: src/content/editor-bridge/{local-picker,visual-targets,quick-action-toolbar,visual-structure,visual-form-value,visual-content,fallback-target,layout-tree}.ts
  - Notes: 3× `viewportRectForElement`, 2× editable-sibling pair, 2× `isContentEditableElement`, 2× `dispatchNativeInputEvents`, class tokenizers (`getClassTokens`/`tokenizeClassName`/`classTokensForElement`), `directTextPreview` (fallback-target ~341 vs layout-tree ~149). Diff each pair before merging; where copies genuinely diverge (beyond viewportSize), keep behavior of each call site and note the divergence in a code comment only if load-bearing.
  - Parallelizable: no
- [ ] Unify the three "ai-id-or-fallback" target builders into one
  - Files/areas: src/content/editor-bridge/local-picker.ts (`targetForElement` ~89), src/content/editor-bridge/visual-structure.ts (`editorTargetForElement` ~704), src/content/editor-bridge/visual-targets.ts (`targetForResolvedElement` ~415)
  - Notes: Compare the three implementations field-by-field first; only merge if output shapes are identical per input, otherwise parameterize the differences explicitly.
  - Parallelizable: no
- [ ] Extract shared mutation-result posting helpers for the per-kind bridge handlers
  - Files/areas: new src/content/editor-bridge/lib/mutation-result.ts; src/content/editor-bridge/{visual-style,visual-content,visual-attributes,visual-form-value}.ts
  - Notes: One generic success/failure post helper and one `mutationFailedError` factory replacing the 4 copies; the per-kind handler files stay separate (user decision).
  - Parallelizable: no
- [ ] Move the `BridgePost` type out of `highlight.ts`
  - Files/areas: src/content/editor-bridge/highlight.ts (~26), new src/content/editor-bridge/types.ts, importers (keyboard, navigation, visual-* modules)
  - Notes: Pure type move; breaks the coupling hub on a stateful module.
  - Parallelizable: yes
- [ ] Resolve the duplicated breakpoint labels
  - Files/areas: src/shared/i18n.ts (breakpoints map ~150-159), src/shared/breakpoints.ts (`BREAKPOINTS[].label` ~18-27)
  - Notes: Grep which label source each consumer reads; make one canonical (i18n map, since it is localized) and delete or redirect the other. Do not change any displayed string.
  - Parallelizable: yes
- [ ] Phase gate: `npm run typecheck` and `npm run build`
  - Files/areas: repo root
  - Notes: —
  - Parallelizable: no

### Phase 4 - Editor-side deduplication
- [ ] Delete the local control-component copies in `SizeControls`/`LayoutControls` in favor of `styleControlHelpers`
  - Files/areas: src/editor/components/controls/SizeControls.tsx, LayoutControls.tsx, styleControlHelpers.tsx
  - Notes: Local `StylePresetSelect`, `StyleTextInput`, `presetOptionsForProperty`, `visualPresetToOption`, `normalizeTextInput`, and local `*ControlGroup` duplicate canonical exports (`StyleControlGroup`, `CssPresetSelect`, `CssTextInput`, `presetOptionsForProperty`, `normalizeCssValue`). Diff local vs canonical before switching; extend the canonical component with a prop rather than keeping a fork if they diverge.
  - Parallelizable: no
- [ ] Extract a shared controlled-input hook for the draft/focus/blur/Enter/Escape pattern
  - Files/areas: new src/editor/components/controls/useDraftValue.ts (name to match repo style); the ~10 control files repeating `const [draft, setDraft] = useState` + commit-on-blur/Enter, revert-on-Escape
  - Notes: Adopt file-by-file; keep each control's commit semantics identical (when it commits, what it normalizes).
  - Parallelizable: no
- [ ] Consolidate duplicated formatting helpers into one module
  - Files/areas: new src/editor/notebook/format-utils.ts (or extend existing format.ts); src/editor/notebook/lexical/chip-export.ts (`formatInlineCode` ~216), src/editor/notebook/visual-edits-export.ts (`formatInlineCode` ~640, `formatQuotedPreview` ~630), src/editor/visual/visualMutationClient.ts (`quotePreview` ~809, `cssPropertyLabel` ~801), src/editor/visual/useStyleEdit.ts (`cssPropertyLabel` ~213)
  - Notes: Verify identical output for each duplicate pair before merging.
  - Parallelizable: yes
- [ ] Extract one shared target-resolution helper for the mutation/edit fall-through
  - Files/areas: new src/editor/visual/resolve-target.ts; src/editor/visual/visualMutationClient.ts (`resolveTargetReference` ~558-583), src/editor/visual/{useStyleEdit,useContentEdit,useAttributeEdit,useFormValueEdit}.ts (each hook's target memo)
  - Notes: The 6-candidate fall-through across selection/bridge stores must keep its exact precedence order.
  - Parallelizable: no
- [ ] Extract the shared dispatch scaffold inside `visualMutationClient.ts`
  - Files/areas: src/editor/visual/visualMutationClient.ts
  - Notes: One internal helper covering resolve-context → optimistic `addRecord` → build message → `postVisualMutation`; the six named `dispatchVisual*Mutation` functions remain as thin per-kind wrappers (user decision). Do not touch `visualUndo.ts`.
  - Parallelizable: no
- [ ] Phase gate: `npm run typecheck` and `npm run build`
  - Files/areas: repo root
  - Notes: —
  - Parallelizable: no

### Phase 5 - Store ownership cleanup (remove dual-writes, keep boundaries)
- [ ] Write an ownership map for every field duplicated across stores
  - Files/areas: src/editor/stores/useVisualSelectionStore.ts, useVisualBridgeStore.ts, useFloatingVisualPanelStore.ts, useHighlightStore.ts; src/editor/bridge/bridgeClient.ts
  - Notes: Known duplicates: `targetSnapshot` (bridge store) vs `snapshot` lifecycle (selection store); panel target/category held in selection store `panelTarget`, bridge store `selectedQuickActionCategory`, and floating-panel store `target`/`category`; `hoverTarget` vs highlight store. Record the single owner per field as code comments in this step's commit (temporary scaffolding is fine).
  - Parallelizable: no
- [ ] Remove duplicated fields and point readers at the owning store
  - Files/areas: the four stores above and every component/module reading the removed fields
  - Notes: Keep store boundaries — no store merges (user decision). Readers subscribe to the owning store directly; do not introduce cross-store sync effects.
  - Parallelizable: no
- [ ] Rework `bridgeClient` fan-out so each bridge message writes to exactly one owning store
  - Files/areas: src/editor/bridge/bridgeClient.ts (`routeBridgeMessage` ~249-433, `syncVisualBridgeGeometry` ~103-143, `selectQuickActionCategory` ~159-216)
  - Notes: Preserve observable sequencing, especially the `bridgeReady` store resets completing before `layoutTree` population.
  - Parallelizable: no
- [ ] Split `routeBridgeMessage` into per-domain handler functions
  - Files/areas: src/editor/bridge/bridgeClient.ts; new src/editor/bridge/handlers/*.ts (lifecycle, layout-tree, highlight/anchor, snapshot, mutation-results, structure)
  - Notes: The switch stays as a thin routing table; business logic moves to named handlers. Move `createVisualEditRecordPatchForMutationResult` (~468-578) next to the edit-record logic (useVisualEditStore or a records module). Keep the `isVisualUndoMutationResult` special-case behavior byte-for-byte.
  - Parallelizable: no
- [ ] Normalize store reset/clear method naming
  - Files/areas: all src/editor/stores/*.ts (`resetVisualSelectionState`, `resetVisualEditStore`, `resetVisualBridgeState`, `resetFloatingVisualPanelStore`, `resetFloatingNotePanelRuntime`, `clearDraft`, `clearVisualEdits`, `clearQuickActionTargets`)
  - Notes: Pick one convention (`reset*` for full-store resets, `clear*` for partial field clears), rename accordingly, update callers. Pure rename — no logic change.
  - Parallelizable: yes
- [ ] Phase gate: `npm run typecheck` and `npm run build`
  - Files/areas: repo root
  - Notes: —
  - Parallelizable: no

### Phase 6 - Protocol split and runtime validation
- [ ] Split `shared/editor-messages.ts` into wire protocol vs domain types
  - Files/areas: src/shared/editor-messages.ts → new src/shared/protocol/editor-bridge-messages.ts (message-type constants, message interfaces, `EditorToBridgeMessage`/`BridgeToEditorMessage` unions) and new src/shared/domain/ modules (EditorTarget, VisualTargetSnapshot, VisualMutation* payloads, box-model enums, viewport geometry types); update all importers
  - Notes: Type-only reshuffle; no renames of the types themselves in this step to keep the diff reviewable.
  - Parallelizable: no
- [ ] Add hand-rolled runtime guards for both directions of the editor↔bridge protocol
  - Files/areas: new src/shared/protocol/guards.ts; src/content/editor-bridge/index.ts (`route()` ~125-193), src/editor/bridge/bridgeClient.ts (receive path ~226-247)
  - Notes: Validate `source` tag, `type` against the known constant set, and the presence/primitive-type of fields the receiver reads — no deep structural validation. On failure: `console.warn` with the offending `type` and drop. No new dependencies.
  - Parallelizable: no
- [ ] Formalize the third (frame-toggle) channel as a typed shared contract
  - Files/areas: new src/shared/protocol/frame-messages.ts (constant, message type, guard for `copy-ai-id:set-top-editor-enabled` + source `copy-ai-id-content-script`); src/content/bootstrap/index.ts (~36, ~126-130, ~240-252), src/content/editor-bridge/keyboard.ts (~19-23)
  - Notes: Replace both hardcoded copies; keep the wire strings identical so old/new frames interoperate during reload.
  - Parallelizable: no
- [ ] Phase gate: `npm run typecheck` and `npm run build`
  - Files/areas: repo root
  - Notes: —
  - Parallelizable: no

### Phase 7 - Re-layout and renames
- [ ] Rename the content-bridge files that shadow `shared/` names, per a handler/resolver convention
  - Files/areas: src/content/editor-bridge/visual-style.ts → visual-style-handler.ts; visual-attributes.ts → visual-attribute-handler.ts; visual-content.ts → visual-content-handler.ts; visual-form-value.ts → visual-form-value-handler.ts; visual-targets.ts → visual-target-resolver.ts; update importers
  - Notes: `shared/` keeps the plain names (catalogs/contracts); a grep for `visual-style` should now disambiguate by suffix.
  - Parallelizable: no
- [ ] Relocate misplaced `shared/` modules to their owning layer
  - Files/areas: src/shared/enabled-state.ts → src/content/bootstrap/enabled-state.ts (verify popup does not import it — popup goes through runtime messages); src/shared/notebook-notice.ts → src/editor/notebook/notebook-notice.ts; src/content/clipboard/clipboard.ts → src/editor/notebook/clipboard.ts (its only importer is `src/editor/notebook/copy.ts:1`; remove the now-empty src/content/clipboard/)
  - Notes: Grep importers for each before moving. `shared/visual-html.ts` stays in shared but gains a doc comment stating its DOM dependency (content/editor contexts only).
  - Parallelizable: no
- [ ] Move the `SAFE_ATTRIBUTE_NAMES` allowlist into `shared/`
  - Files/areas: src/content/editor-bridge/visual-target-resolver.ts (~90-131) → src/shared/domain/ (or the visual-attributes catalog module)
  - Notes: It is contract data consumed by the snapshot serializer; pure move.
  - Parallelizable: yes
- [ ] Centralize the z-index constants without changing any value
  - Files/areas: src/shared/config.ts (~28), src/content/editor-bridge/overlay.ts (~7, inline ~182), src/content/editor-bridge/box-model.ts (~27-30), src/content/editor-bridge/quick-action-toolbar.ts (inline CSS ~791), src/content/editor-shell/mount.ts (~33)
  - Notes: Named constants per layer (editor host, overlay, drop indicator, box-model, toolbar) in shared config with a comment that top-frame and iframe values live in different stacking contexts. Values must remain byte-identical.
  - Parallelizable: yes
- [ ] Audit and align the two "extension-owned DOM" lists
  - Files/areas: src/shared/config.ts (`EXTENSION_OWNED_DOM_SELECTOR` ~19-33), src/content/editor-bridge/overlay.ts (`data-ai-editor-overlay` ~8), src/content/editor-bridge/runtime-artifacts.ts
  - Notes: Add to the shared selector only attributes verified to mark extension-owned runtime DOM; for each addition, check layout-tree/navigation/picker behavior implications (an element newly excluded from the tree is a behavior change — only add attrs whose elements were already excluded by other means or are pure overlays).
  - Parallelizable: no
- [ ] Phase gate: `npm run typecheck` and `npm run build`
  - Files/areas: repo root
  - Notes: —
  - Parallelizable: no

### Phase 8 - Big-file splits (behavior-preserving)
- [ ] Split `quick-action-toolbar.ts` (916 lines) into focused modules
  - Files/areas: src/content/editor-bridge/quick-action-toolbar.ts → toolbar-styles.ts (the ~130-line CSS string, ~786-916), toolbar-geometry.ts (`calculateToolbarPlacement` ~669-692, corridor math ~170-225 — pure functions), toolbar-drag.ts (drag state machine ~505-589), toolbar-messages.ts (`postCategoryRequest`/`postStructureRequest`/`postDrag*` ~435-503); main file keeps lifecycle/render/singleton state
  - Notes: The corridor hover-handoff and `pendingHide`/`hasActiveToolbarInteraction` gating are load-bearing; move code verbatim, no logic edits in this step.
  - Parallelizable: no
- [ ] Split `visual-target-resolver.ts` into resolution engine and snapshot serializer
  - Files/areas: src/content/editor-bridge/visual-target-resolver.ts → keep resolution (`resolveVisualTarget`, resolveBy* ~, fuzzy matching, `::shadow` parser); new visual-target-snapshot.ts (`createVisualTargetSnapshot` ~173-209 plus the ~15 `*ForElement` extractors ~616-803)
  - Notes: Preserve the resolve-miss → layout-tree-rebuild path (`resolveVisualTarget` rebuild at ~141) exactly.
  - Parallelizable: no
- [ ] Split `visual-structure.ts` into handlers, result assembly, and clone/sanitize utils
  - Files/areas: src/content/editor-bridge/visual-structure.ts → keep operation handlers (duplicate/move/delete/restore/drag + drop-target resolution); new visual-structure-results.ts (`structureResultForOperation` ~338-393); clone/HTML-sanitize helpers into lib/ or a sibling module
  - Notes: Result-message shapes must stay identical to the protocol types from Phase 6.
  - Parallelizable: no
- [ ] Split `fallback-target.ts` into label heuristic and selector generation
  - Files/areas: src/content/editor-bridge/fallback-target.ts → fallback-label.ts (`identifyElementLabel` ~81-198, restructured as a tag→strategy table if it stays output-identical) and fallback-selector.ts (`generateFallbackSelector` ~213-305 + path/dedupe utils); shared string utils move to lib/text.ts
  - Notes: Fallback selectors are embedded in copied output and re-resolved later — generation must remain output-identical for the same DOM.
  - Parallelizable: yes
- [ ] Extract pure geometry from `box-model.ts`
  - Files/areas: src/content/editor-bridge/box-model.ts → new box-model-geometry.ts (`computeRegionRects` ~222-319, `computeGapRects` ~321-404, `clipRect`); rendering/color tables stay
  - Notes: Verbatim move; the rAF scheduling and overlay delegation in overlay.ts are untouched.
  - Parallelizable: yes
- [ ] Split `visual-edits-export.ts` into the human-Markdown formatter and the compact-JSON builder
  - Files/areas: src/editor/notebook/visual-edits-export.ts (647 lines) → visual-edits-markdown.ts (`formatVisualEditsSection`/`formatVisualEditTargetGroup`/`formatVisualEditRecordSummary`, `formatPayloadSummary` ~298-321) and visual-edits-compact.ts (`CompactVisualEditsExportDocument` builder, `compactVisualEditDiffForRecord` ~413-509, `compactChangeForRecord`, `compactStructure*`)
  - Notes: Copied Markdown output must remain byte-identical; both export formats are kept (unifying them was not approved).
  - Parallelizable: yes
- [ ] Phase gate: `npm run typecheck` and `npm run build`
  - Files/areas: repo root
  - Notes: —
  - Parallelizable: no

### Phase 9 - Final consistency pass
- [ ] Clean dead documentation links out of both READMEs
  - Files/areas: README.md (links to docs/keyboard-traversal.md at line ~61, docs/add-data-ai-id.md ~103, docs/images/05-allow-file-url-access.png ~131, and the "Add `data-ai-id` with the skill" section ~73-103 referencing the deleted skills/ dir), README.ko.md (same content in Korean)
  - Notes: docs/ and skills/ were deleted intentionally; either drop the sections or rewrite them without file links. Keep the Chrome Web Store and workflow content.
  - Parallelizable: yes
- [ ] Document the geometry type-alias relationship
  - Files/areas: src/editor/bridge/geometry.ts (~6-7: `EditorViewportRect`/`EditorViewportPoint` aliasing `BridgeViewportRect`/`Point`)
  - Notes: Add doc comments stating the two names denote different coordinate spaces over the same shape; no type changes.
  - Parallelizable: yes
- [ ] Final unused-export sweep across `src/`
  - Files/areas: src/
  - Notes: Grep-based pass for exports with zero importers created or orphaned by the earlier phases; delete findings. No new tooling.
  - Parallelizable: no
- [ ] Final gate: `npm run typecheck` and `npm run build`, then review `git log` on `refactor/v2` for a clean commit-per-step history
  - Files/areas: repo root
  - Notes: Branch stays local; merging to `main` and Chrome Web Store packaging are the user's follow-up.
  - Parallelizable: no
