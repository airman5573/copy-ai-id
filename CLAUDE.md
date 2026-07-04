# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project overview

**Copy AI ID** is a Chrome extension (Manifest V3) that overlays a full-screen visual editor on any rendered web page. Users highlight elements (preferring stable `data-ai-id` attributes, falling back to generated selectors), make **preview-only** visual edits (style/content/attributes/structure), write notes in a Lexical-based notebook with `@el-N` element chips, and copy an AI-ready Markdown document (`## Requests / ## Targets / ## Rules / ## Visual edits` with a machine-readable JSON diff).

Product scope is intentionally narrow: editor-first. No side panel, no native messaging, no AI chat, no analytics, no remote data transmission. The only permission is `storage`; host permissions are `<all_urls>`. The one background service worker (`src/background/index.ts`) exists solely as a fetch proxy for the optional **Send to Codex** feature, which talks only to a local `127.0.0.1` server the user starts manually (`npm run codex-server`).

Stack: TypeScript (strict) + React 19 + Zustand + Lexical + Radix UI + Tailwind 3, bundled by Vite 7 with `@crxjs/vite-plugin`.

## Commands

```bash
npm run dev           # vite build --watch — rebuilds dist/ on change (reload the unpacked extension in Chrome to pick up changes)
npm run build         # one-shot build into dist/
npm run typecheck     # tsc --noEmit
npm run codex-server  # local Send-to-Codex server (scripts/codex-server.mjs); scripts/start-codex-server.sh is the shell launcher
```

- `npm run typecheck` is the **only automated verification gate**. There is no test framework, no test script, and no ESLint/Prettier config.
- Load the extension unpacked from `dist/` via `chrome://extensions` → "Load unpacked".
- Manual test fixtures live in `examples/` (plain HTML files, opened directly in the browser; `file://` pages require "Allow access to file URLs" in the extension settings).

## Chrome Web Store packaging

Use this command when preparing a new Chrome Web Store upload package:

```bash
npm run deploy-to-chrome-extension-store
```

The script (`scripts/deploy-to-chrome-extension-store.mjs`) prepares a manual-upload package; it does not automate Chrome or the Web Store UI. Default behavior:

1. Bumps the patch version in `package.json`, `package-lock.json`, and `src/manifest.ts`.
2. Runs `npm run build`.
3. Verifies the built `dist/manifest.json` version matches the bumped version.
4. Fails if the built manifest contains the local-development `key` field.
5. Creates `output/copy-ai-id-<version>-chrome-web-store.zip` from `dist/` (`output/` is gitignored).

Variants:

```bash
npm run deploy-to-chrome-extension-store -- --version 0.1.13    # exact version instead of patch bump
npm run deploy-to-chrome-extension-store -- --no-version-bump   # rebuild + repackage current version
```

After the script completes, upload the generated zip manually in the Chrome Web Store Developer Dashboard.

**Never set `COPY_AI_ID_INCLUDE_MANIFEST_KEY=1` for store builds.** That env var injects a public `key` into the manifest solely so local unpacked builds keep a stable extension ID (see `src/manifest.ts`); the packaging script rejects builds that contain it.

## Big-picture architecture

One content script runs in **every frame** (`all_frames: true`, `match_about_blank: true`, `run_at: document_idle`) and self-selects a role at boot (`src/content/bootstrap/index.ts`):

```
Top frame (the page being inspected)
 ├─ content script → role: EDITOR SHELL
 │    └─ src/content/editor-shell/mount.ts creates a fixed full-viewport host div
 │         └─ src/editor/main.tsx attaches an open Shadow DOM and mounts the React editor
 │              └─ the React app renders a preview <iframe> of the same page,
 │                 with ?copy-ai-id-preview=1 appended to the URL
 │                   └─ content script (again, via all_frames) → role: PREVIEW BRIDGE
 │                        └─ src/content/editor-bridge/ — DOM targeting, overlays,
 │                           layout-tree snapshots, quick-action toolbar, all mutations
```

The React editor and the preview bridge communicate over `window.postMessage`. All page mutations happen **only inside the preview iframe**, never on the top-frame page.

### Message channels (three separate protocols)

| Channel | Defined in | Direction / purpose |
|---|---|---|
| Editor ⇄ bridge | `src/shared/protocol/editor-bridge-messages.ts` | The main protocol. `EditorToBridgeMessage` (reveal tree node, keyboard shortcut, set zoom, request snapshot, update style/text/rich-text/attribute/form-value, duplicate/move/delete/restore, drag-move) and `BridgeToEditorMessage` (bridgeReady, layoutTree, targetHighlighted, quick-action events, snapshots, `visual*Updated` mutation results, mutation errors). All types namespaced `copy-ai-id:*`. Bridge→editor messages carry `source: 'copy-ai-id-preview-bridge'`. |
| Frame toggle | `src/shared/protocol/frame-messages.ts` | Child frame → top frame: `copy-ai-id:set-top-editor-enabled` (source `copy-ai-id-content-script`). Used by the hotkey in child frames and by the bridge to turn the editor off. |
| Popup ⇄ content | `src/shared/runtime-messages.ts` | `chrome.tabs.sendMessage`: `copy-ai-id:get-runtime-state` / `copy-ai-id:set-enabled`, responded with `{ enabled, available }`. |
| Editor ⇄ background (codex) | `src/shared/codex.ts` | `chrome.runtime.sendMessage` from the editor to the service worker: `copy-ai-id:codex-health` / `codex-resolve-project` / `codex-start-run` / `codex-run-status`. The worker forwards each as a fetch to the local codex server and returns the server's `{ ok, ... } \| { ok: false, code, error }` JSON verbatim. |

Runtime guards in `src/shared/protocol/guards.ts` are **intentionally shallow** — they only validate the `type` string against a direction-specific set. Handlers must narrow payloads via the discriminated unions themselves.

The message model is fire-and-forget events, not RPC: "requests" (e.g. `requestVisualTargetSnapshot`) set loading state in a store and are answered by a later inbound message correlated by target/`nodeId`/`mutationId`, not by a promise.

### Element targeting model

Targets are the currency of the whole app (`src/shared/domain/targets.ts`):

- **`AiIdEditorTarget`** — element has `data-ai-id`; identified by `{ aiId, instanceIndex }` (duplicates get instance badges).
- **`FallbackEditorTarget`** — no usable `data-ai-id`; carries generated metadata (selector + kind, DOM path, label, text preview, class tokens) built by `src/content/editor-bridge/fallback-*.ts`.

The bridge resolves incoming targets in priority order **node-id → ai-id → fallback-selector → fallback-path** (`src/content/editor-bridge/visual-target-resolver.ts`), with one layout-tree-rebuild retry on miss. Failures are typed: `target-not-found | stale-target | ambiguous-target`.

## Module map

### `src/manifest.ts`

`defineManifest` from @crxjs. MV3, `permissions: ['storage']`, `host_permissions: ['<all_urls>']`, popup action, one content-script entry (`src/content/bootstrap/index.ts`, all frames, document_idle), one background service worker (`src/background/index.ts`, module type — codex proxy only), localized name/description via `__MSG_*__` (`public/_locales/{en,ko}`). The dev-only stable `key` is included only when `COPY_AI_ID_INCLUDE_MANIFEST_KEY === '1'`.

### `src/background/` — service worker (codex proxy only)

`index.ts` — the only background logic in the extension. Listens for the codex runtime messages (guarded by `isCodexRuntimeMessage`; all other messages pass through untouched) and forwards each one as a short fetch to the local codex server (`http://127.0.0.1:45130`). Content-script fetches are subject to the host page's CSP and mixed-content rules; worker fetches are covered by the `<all_urls>` host permission. The worker is stateless — the long codex run is tracked by the editor polling `codex-run-status`, so the worker may be killed/restarted between polls.

### `src/content/` — content-script side

**`bootstrap/`** — entry + on/off lifecycle
- `index.ts` — manifest JS entry. Picks the frame role (preview bridge vs editor shell), dedupes stale script instances (dispatches `copy-ai-id:destroy-content-script-instance`, removes leftover hosts), wires hotkey/runtime/frame listeners, syncs the `?copyaiid=active` URL param (forces enable at boot; rewritten via `history.replaceState` on state change).
- `enabled-state.ts` — in-memory enabled flag. **Not persisted**; resets to `DEFAULT_ENABLED = false` on reload.
- `shift-z-space-toggle.ts` — the Shift+Z+Space hotkey state machine (latched so one press = one toggle; capture phase). In child frames the new state is forwarded to the top frame via frame messages.

**`editor-shell/`**
- `mount.ts` — creates/removes the fixed full-viewport host div in the top frame (`z-index 2147483646`, tagged `data-copy-ai-id-editor-host`) and calls `mountCopyAiIdEditor` from `src/editor/main.tsx`. No iframe is created here — that happens inside the React app.

**`target/`**
- `composed-dom.ts` — open-shadow-DOM-aware traversal helpers (`getComposedParentElement`, `getComposedChildElements`, `getDeepElementFromPoint`, …). Closed shadow roots are unreachable by design.

**`editor-bridge/`** — runs inside the preview iframe (~35 files). Concerns:

- *Entry/routing*: `index.ts` — `startPreviewBridge()`, origin-checked `message` listener (with `file://`/opaque-origin allowance), giant `route()` switch dispatching each `EditorToBridgeMessage`; posts `bridgeReady` + initial `layoutTree` when ready.
- *Targeting/resolution*: `editor-target.ts` (prefer ai-id, else fallback), `visual-target-resolver.ts` (core resolver, see above), `fallback-target.ts` / `fallback-selector.ts` (unique-semantic-tag → `#id` → unique tag.class → `nth-child` chain; `::shadow` segments for shadow hosts) / `fallback-label.ts` / `fallback-utils.ts`, `local-picker.ts` (hover/click hit-testing; rejects extension-owned elements, then promotes the raw hit DevTools-Inspect-style to the nearest *selectable* element — `html`/`body`/`br` etc. never qualify, SVG internals promote to their `<svg>`, untagged elements must pass a significance check; keyboard traversal in `navigation.ts` shares the same rule).
- *Layout tree*: `layout-tree.ts` — `buildLayoutTreeSnapshot()` walks `document.body` into `LayoutTreeNode`s and maintains the registries backing resolution (`nodeElements`, `aiIdInstances`, `elementNodeIds`). Skips `script/style/link/meta/noscript/template` and extension-owned nodes.
- *Overlays/highlights*: `overlay.ts` (hover + pinned-selection box-model overlays, drop indicator, rAF repositioning; the hover layer is hidden while it targets the pinned element so it doesn't darken the stronger selection layer), `highlight.ts` (hover/selection brain: posts `targetHighlighted`, pins the quick-action toolbar + selection overlay on click, Space → `targetReferenceRequested`), `box-model.ts` + `box-model-geometry.ts` (DevTools-style margin/border/padding/content layers; hover at 0.45× alpha, selection at base alpha), `visual-box-highlight.ts`.
- *Quick-action toolbar*: `quick-action-toolbar.ts` — imperative floating toolbar in the preview body (category buttons `content/layout/spacing/size/style/border` + structure buttons duplicate/move-up/move-down/delete + drag grip). Styled with an `all: initial` hard reset instead of a shadow root (`toolbar-styles.ts`); placement math in `toolbar-geometry.ts`.
- *Mutation handlers* (all preview-only, all follow resolve → apply → post `visual*Updated` result with fresh snapshot → rebuild tree/overlays):
  - `visual-style-handler.ts` — inline `element.style` writes (records `previousValue`, supports `!important`).
  - `visual-content-handler.ts` — text (`textContent` / form `.value` + native events) and rich text (`innerHTML` via the DOMPurify sanitizer; rejects form/media elements).
  - `visual-attribute-handler.ts` — attribute set/remove, gated by the allowlist in `src/shared/visual-attributes.ts`.
  - `visual-form-value-handler.ts` — input/textarea/select/contenteditable values, checked, selectedIndex; blocks `type=file`.
  - `visual-structure.ts` — duplicate/move/delete/restore/drag-move with before/after snapshots for undo; `visual-structure-results.ts`, `structure-clone.ts` (clones scrubbed via `runtime-artifacts.ts`).
  - `visual-mutation-results.ts` — shared result/error plumbing; `visual-target-snapshot.ts` — serializes an element to the `VisualTargetSnapshot` wire shape.
- *Keyboard/navigation*: `keyboard.ts` (bridge-side shortcuts; Shift+Z+Space here only turns the editor off), `navigation.ts` (arrow-key composed-DOM traversal).
- *lib/*: `dom.ts`, `text.ts`, `viewport.ts` small helpers.

### `src/editor/` — React app (mounted in the top-frame Shadow DOM)

**Entry**
- `main.tsx` — `mountCopyAiIdEditor(host)`: attaches an open shadow root, injects the compiled CSS via `import editorCss from './editor.css?inline'` as a single `<style>` tag, mounts `<App/>`, installs the shadow-selection bridge (Lexical selection fix) and notebook draft session persistence.
- `App.tsx` — boot effect (preview URL, hydrate persisted UI state, fit zoom) + window-level guards (`installEditorKeyboard`, hover/focus guards). Layout: `TopToolbar` / `MainArea` (single-column `PreviewWorkspace`) / `FloatingNotePanel` / `FloatingVisualPanel` / `CodexConfirmDialog` / toast.

**`stores/`** — all Zustand. One store per concern:

| Store | Owns |
|---|---|
| `useRuntimeStore` | mount status, current/preview URL, boot errors |
| `useBridgeStore` | bridge connection status, iframe status, aiId count |
| `useHighlightStore` | highlight *identity* (target/nodeId/origin) — deliberately separate from hover *geometry* |
| `useBreakpointStore` | breakpoint / custom viewport width, preview height, per-breakpoint zoom (persisted to `chrome.storage.local`) |
| `useEditorLayoutStore` | note panel width (persisted; sizes the floating note panel) |
| `useToastStore` | transient toasts |
| `useFloatingVisualPanelStore` | floating visual panel open/close only (its target lives in `useVisualSelectionStore.panelTarget`) |
| `useFloatingNotePanelStore` | floating note panel open/anchor (anchor-less `openPanel()` → default placement near the preview frame) |
| `useSectionJumpStore` | queued "scroll visual panel to section" requests |
| `useNotebookStore` | notebook draft text, Lexical `editorStateJson`, chip targets/indexes, suffix settings, copy status |
| `useVisualSelectionStore` | **single owner of visual-selection data**: hoverTarget, activeToolbarTarget, panelTarget, snapshot lifecycle (status/error/staleReason) |
| `useVisualEditStore` | visual-edit history: records, pending mutations, undo/redo stacks, export document |
| `useCodexStore` | Send-to-Codex state machine: `phase` (`idle → resolving → confirming → running`), the pending send payload (markdown, subject, resolved project path/method), the live log console state (`logOpen`/`logEvents`), and the persisted reasoning effort |

**`bridge/`**
- `bridgeClient.ts` — the message hub. `createPreviewUrl` appends `?copy-ai-id-preview=1`; `postToBridge` posts to the iframe; `installBridgeClient` validates inbound `source` + type guard, then `routeBridgeMessage` fans out to per-domain handlers that write into the stores. On `bridgeReady` it resets visual stores and re-pushes zoom state.
- `geometry.ts` — converts bridge-viewport rects/points ⇄ editor-viewport coordinates (accounting for canvas zoom) and computes floating-panel placement.

**`components/`**
- Root: `TopToolbar` (note panel open/close toggle + prompt copy button + Codex send button), `CanvasControls` (breakpoints/zoom), `MainArea` (single-column preview host), `PreviewWorkspace` (iframe host, resize handles, bridge-ready timeout → blocked status), `NotePanel` (floating-only notebook UI: copy/Codex send/reset, notice dialog, suffix toggles; the notice dialog is portaled to the editor shell), `FloatingNotePanel`, `NoteEditor`, `CodexConfirmDialog` (shows the auto-detected project path for non-confident detections), `CodexLogConsole` (live run log under the toolbar Codex button).
- `visual-panel/` — `FloatingVisualPanel` (tabs for the six categories), `VisualPanelContent` (readiness gating, renders the matching controls group).
- `visual/` — reusable inputs: `UnitValueInput`, `ColorInput`, `DropdownSelect`, `PresetSelect`, `EdgeBoxControl`, `VisualControl`/`VisualSection`; `dropdownCoordinator.ts` keeps only one dropdown open inside the shadow DOM.
- `controls/` — one component per edit category (`ContentControls`, `LayoutControls`, `SpacingControls`, `SizeControls`, `BorderControls`, `ColorControls`, `TypographyControls`, `BackgroundImageControls`, …) bound to `forms/useVisualStyleForm.ts` and the style-edit hooks.
- `ui/builderChrome.tsx` — shared toolbar/panel primitives.

**`notebook/`** — the copy/export pipeline (see below), `export-markdown.ts` (shared markdown builder used by both copy and codex send), `codex-send.ts` (Send-to-Codex orchestration: resolve → confirm → start run → poll → success clears draft / failure falls back to clipboard copy), plus `lexical/`:
- `NotebookLexicalEditor.tsx` (LexicalComposer, plain text + `ChipNode`), `ChipNode.ts` (a `TextNode` subclass carrying `{ chipId, target, nodeId }`, rendered as an `el-N` chip span), `chip-ids.ts` (chip ids are `el-<n>`, never renumbered), `NotebookEditorPlugins.tsx` (state export, draft sync, chip insertion, chip click → highlight + scroll the preview element into view via `revealTreeNode`), `chip-export.ts` (serializes Lexical state to text with `[chip]el-N[/chip]` markers + collected targets).

**Keyboard**
- `keyboard.ts` — global capture-phase handler. Shift+Enter → copy notebook; Ctrl/Cmd+Z → visual-edit undo; arrows → preview DOM traversal; Space → append highlighted target as chip; Escape → cascaded close (codex confirm dialog → visual panel → floating note panel → toolbar selection → highlight → forwarded to bridge).
- `shortcut-actions.ts` — pure action layer shared by local keyboard and bridge-forwarded shortcuts.

### `src/shared/` — cross-context contracts (no side effects)

- `protocol/` — the three message channels + shallow guards (see table above).
- `domain/` — pure value types: `targets.ts` (`EditorTarget` union, `LayoutTreeNode`, `FallbackSelectorKind`), `visual.ts` (mutation payloads, `VisualTargetSnapshot`, error codes, `QuickActionCategory`), `geometry.ts` (bridge viewport primitives).
- `visual-edits.ts` — the **export data model**: `VisualEditRecord`, `VisualEditJsonDiff`, `VisualEditsExportDocument` (`VISUAL_EDITS_EXPORT_VERSION = 1`) — the machine-readable JSON emitted under `## Visual edits`.
- `visual-targets.ts` — builds/sanitizes export descriptors; snapshot attribute allowlist (`SAFE_ATTRIBUTE_NAMES`, aria-/data- prefixes).
- `visual-attributes.ts` — curated attribute-edit allowlist (href/target/rel/src/alt/title/aria-label/placeholder/type) + `sanitizeVisualAttributeMutation` (URL-scheme validation).
- `visual-style.ts` — the CSS control catalog: ~70 property definitions with control kind, units, presets, grouping (drives the visual panel UI).
- `visual-html.ts` — DOMPurify-based `sanitizeVisualHtmlFragment` for rich-text edits (strips scripts, event handlers, dangerous URLs, runtime artifacts).
- `config.ts` — app-wide constants: `DATA_AI_ID_ATTRIBUTE`, extension-owned DOM attributes + `EXTENSION_OWNED_DOM_SELECTOR` + `isExtensionOwnedElement()`, and the z-index layering table (**comment says load-bearing; do not renumber**).
- `codex.ts` — Send-to-Codex contracts: server port/base URL, the `x-copy-ai-id-client` request header (web pages can't attach it without a preflight the server rejects), server response DTOs (`CodexResolvedProject`, `CodexRunResult`, error codes), and the editor ⇄ background runtime messages + shallow guard.
- `i18n.ts` — en/ko message table + locale resolution (Chrome UI language → navigator → `'en'`).
- `breakpoints.ts` — breakpoint definitions with Tailwind prefixes (`sm:`…`2xl:`).
- `activation-scope.ts` — per-URL scope key (used to scope notebook drafts per page).
- `editor-targets.ts`, `runtime-messages.ts`, `types.ts` — target identity helpers, popup channel, tiny shared types.

### `src/popup/`

`index.html` + `main.ts` (queries active tab, sends getState/setEnabled), `view.ts` (DOM view, pending/unavailable states, auto-close after toggle), `active-tab-scope.ts` (only http/https/file tabs are actionable), `styles.css`. The popup talks only to the top-frame content script.

### Other directories

- `public/` — icons (16/32/48/128) and `_locales/{en,ko}/messages.json` (manifest name/description only; UI strings live in `src/shared/i18n.ts`).
- `examples/` — standalone HTML fixtures for manual testing: `test-2.html` (fully `data-ai-id`-annotated, includes an intentional duplicate id), `test-1.html` (mostly un-annotated → fallback paths), `fallback-targets.html`, `shadow-dom-test.html`, `iframe-test.html`, `complex-tailwind-test.html`, `manual-test.html` (+ destination page for navigation testing).
- `scripts/deploy-to-chrome-extension-store.mjs` — the packaging script described above.
- `scripts/codex-server.mjs` + `scripts/start-codex-server.sh` — the local Send-to-Codex server (see below). `scripts/codex-local-bridge.mjs` is an older token-based prototype kept for reference (`npm run codex-bridge`); the extension only talks to `codex-server.mjs`.
- `dist/` — Vite/crxjs build output (the unpacked extension). `output/` — store zips, gitignored.

## Copy/export pipeline

`notebook/export-markdown.ts → buildNotebookExportMarkdown` assembles the full markdown document (returns `null` when there is nothing to export); `notebook/copy.ts → copyNotebookDraftFromStore` and the codex send path both consume it:

1. `chip-export.ts` — Lexical state → text with `[chip]el-N[/chip]` markers + chip target list.
2. `format.ts → formatNotebookCopyBody` — `## Requests` (markers → `@el-N` mentions) + `## Targets` (per-chip details; ai-id targets are stable references, fallback targets include selector/path/context).
3. `format.ts → appendNotebookSuffixes` — `## Rules` (viewport scope, Tailwind hints, fallback/target notices).
4. `visual-edits-export.ts` + `visual-edits-compact.ts` — `## Visual edits`: human-readable summary + fenced compact JSON (`VisualEditJsonDiff` shape).
5. `clipboard.ts → copyText`, then the draft and visual-edit records are cleared (applied preview DOM mutations are NOT reverted — reloading the preview restores the page).

Visual-edit prompt text is hidden while editing and appended only on copy. Copy is reachable from the note panel copy button, the top-toolbar copy button (works for visual-only sessions), and Shift+Enter.

## Send to Codex (optional, local-only)

Sends the exact markdown the copy button produces to the OpenAI Codex CLI running on the user's machine, with automatic git commits around the run. Nothing leaves the machine: the extension talks (only through its background service worker) to a local server the user starts manually.

```
Editor (content script, shadow DOM)
  └─ notebook/codex-send.ts — orchestration + polling, useCodexStore state machine
       └─ chrome.runtime.sendMessage (contracts: src/shared/codex.ts)
            └─ src/background/index.ts — stateless fetch proxy (extension-context fetch:
               exempt from host-page CSP / mixed-content; covered by <all_urls>)
                 └─ scripts/codex-server.mjs — 127.0.0.1:45130, zero-dependency Node
                      ├─ lsof / fs — project auto-detection
                      ├─ git — auto-commits around the run
                      └─ codex exec (child process, prompt via stdin)
```

### Local server (`scripts/codex-server.mjs`)

Started manually with `npm run codex-server` (or `scripts/start-codex-server.sh`); the extension never starts it. Endpoints (all JSON; every response is `{ ok: true, ... }` or `{ ok: false, code, error }`):

| Endpoint | Purpose |
|---|---|
| `GET /health` | liveness + whether a run is in progress |
| `POST /resolve-project` `{ pageUrl }` | page URL → `{ projectPath, method, detail }` |
| `POST /runs` `{ prompt, subject, projectPath, pageUrl }` | starts a run **asynchronously**, returns `{ runId }` immediately; `409 busy` while another run is live (single-run serialization) |
| `GET /runs/:id?after=<seq>` | `{ status: 'running' \| 'done', result, events, nextSeq }`; `events` is the incremental run log (entries with `seq > after`, capped at 500/run) that feeds the live log console; finished runs are kept in memory (last 20) |

**Project resolution** (`resolve-project`):
- `http(s)://localhost|127.0.0.1|[::1]` → `lsof -iTCP:<port> -sTCP:LISTEN` → first listening pid → `lsof -p <pid> -d cwd` → the dev-server process's working directory (method `localhost-port`). No listener → `no-dev-server`.
- `file://` → start from the file's directory and walk up to the nearest `.git` or `package.json`; if none found, use the file's directory itself (method `file-path`).
- Any other origin → `unsupported-page`. Resolved paths must be existing directories under `$HOME` (never the filesystem root); outside-home paths are rejected unless `COPY_AI_ID_ALLOW_OUTSIDE_HOME=1`.
- Every success carries `confident: boolean` — `true` for `localhost-port` (a process cwd is deterministic) and for marker-based `file-path` hits; `false` when the file walk found no marker and fell back to the file's own directory. Confident results skip the confirm dialog.

**Run pipeline** (`executeRun`), in order:
1. `git rev-parse --is-inside-work-tree`; if not a repo → `git init` + write a default `.gitignore` (only when none exists). Reported as `gitInitialized`.
2. If `git status --porcelain` is dirty → `git add -A` + commit `auto-commit: YYYY-MM-DD HH:MM:SS` (local time), so the user's pre-existing work is separated from codex's changes. Reported as `preCommitted`. Commits retry once with a `-c user.name/user.email` fallback identity if the project has no git identity.
3. Spawn `codex exec --json --sandbox workspace-write --cd <projectPath> --skip-git-repo-check --config approval_policy="never" --config model_reasoning_effort="<effort>" [-m <model>] -` with `cwd = projectPath`; the prompt goes in via **stdin** (avoids argv limits/log exposure). The reasoning effort comes per-request from the editor's toolbar selector (low/medium/high, default medium); the model is env-only. A server-side preamble is prepended: project path, page URL, "map `data-ai-id`/selectors to source", "keep edits minimal", "**do not run git commands**". JSONL events are parsed for the final `agent_message` text **and** mapped to log entries (`describeCodexEvent`: reasoning summaries, `$ command` on start, non-zero exits, `edit: <files>`, agent messages; turn bookkeeping and successful command completions are dropped). Git/lifecycle steps also push `status`/`error` entries. Timeout (`COPY_AI_ID_CODEX_TIMEOUT_MS`, default 300000) → SIGKILL + `timedOut: true`.
4. Only on exit 0 and not timed out: if the tree is dirty → `git add -A` + commit `codex: <subject>` (subject = first line of the request, ≤72 chars, supplied by the editor). `committedFiles` comes from `git show --name-only HEAD`. A clean tree yields `committedFiles: []` with no commit. Failed/timed-out runs are **not** committed — the next run's pre-commit sweeps any partial changes into its `auto-commit`.

**Result shape** (`CodexRunResult` in `src/shared/codex.ts`): `{ ok, exitCode, timedOut, finalMessage, errorOutput, error, gitInitialized, preCommitted, committedFiles, commitMessage, durationMs }`.

**Env vars**: `COPY_AI_ID_CODEX_SERVER_PORT` (default 45130 — must match `CODEX_SERVER_PORT` in `src/shared/codex.ts`), `CODEX_BIN` (default `codex` on PATH), `COPY_AI_ID_CODEX_TIMEOUT_MS` (default 300000), `COPY_AI_ID_CODEX_REASONING` (server-side default effort when a request omits it; default `medium`), `COPY_AI_ID_CODEX_MODEL` (optional `-m` override; empty = account default), `COPY_AI_ID_ALLOW_OUTSIDE_HOME=1`.

**Security model**: binds `127.0.0.1` only; every request must carry the `x-copy-ai-id-client` header. A web page cannot attach that header without a CORS preflight, and the server only ACKs preflights from `chrome-extension://` / localhost origins — so cross-site pages (including DNS-rebinding hosts) cannot drive it. The extension's service-worker fetch is CORS-exempt via host permissions and sends the header directly. `curl` testing needs `-H 'x-copy-ai-id-client: dev'`.

### Editor flow (`src/editor/notebook/codex-send.ts`)

`useCodexStore.phase` is the single state machine: `idle → resolving → confirming → running → idle`. Both Codex buttons (top toolbar + note panel) disable while non-idle and re-label per phase (`codex.resolving` / `codex.running` i18n keys).

1. `sendNotebookDraftToCodex()` — no-op with a `busy` toast if already running; builds the markdown via `buildNotebookExportMarkdown()` (empty → `notebook.empty` toast); strips the `copyaiid`/`copy-ai-id-preview` params from `location.href`; asks the worker to resolve the project. Resolve failure → reset + clipboard-fallback toast.
2. **Confident detection runs immediately** — a `codex.startedIn` toast shows the project path and `runPendingCodexSend()` starts right away. Only non-confident detections go through `beginConfirm(...)` + `CodexConfirmDialog`. Dialog cancel paths: overlay click, cancel button, or Escape (first step of the `handleEditorEscapeAction` cascade, result `'codex-dialog'` — keyboard.ts must not forward that Escape to the bridge).
3. `confirmCodexSend()` / auto-run → `runPendingCodexSend()` → `startRun` (with the persisted reasoning effort) → poll `runStatus` every 1.5s with an `after` cursor, appending returned events to `useCodexStore.logEvents`. Transient poll failures (worker restart, brief server hiccup) are tolerated; only `run-not-found` or the 15-minute client deadline aborts.
4. **Live log console** (`CodexLogConsole`, absolutely positioned under the toolbar Codex button): opens automatically at run start (`startLog()` clears prior events), renders the accumulated entries as a scrolling monospace list (auto-scrolls to bottom, kind-colored), and auto-closes 5s after the run finishes — guarded by a module-level `logGeneration` counter in `codex-send.ts` so a stale timer never closes the next run's console. The X button closes it early; runs triggered from the note panel button use the same toolbar-anchored console.
5. **Reasoning effort selector** — a compact `<select>` (low/medium/high, default medium) next to the toolbar Codex button, persisted to `chrome.storage.local` (`copy-ai-id:codex-reasoning:v1`, hydrated on toolbar mount) and sent with every run.
4. Outcome:
   - **Success** (`result.ok`): clear notebook draft + visual edits (identical to a successful copy), info toast with the committed-file count (`codex.successCommitted` / `codex.successNoChanges`).
   - **Failure/timeout**: the draft is **kept**, the plain markdown (no preamble) is copied to the clipboard as a manual fallback, and an error toast explains (`codex.failed` / `codex.timedOut` / `codex.serverUnreachable` / `codex.unsupportedPage` + `codex.fallbackCopied`). Clipboard write can itself fail when the tab lost focus mid-run — the toast then omits the "copied" suffix.

All user-facing strings live in the `codex` group of `src/shared/i18n.ts` (en + ko). `scripts/codex-local-bridge.mjs` is an unrelated older prototype (fixed workspace + token auth); the extension only speaks to `codex-server.mjs`.

## chrome.storage keys

All keys are namespaced `copy-ai-id:*:v1`: `note-font-size`, `preview-height`, `preview-viewport`, `editor-panel-layout`, `notebook-target-notice`, `codex-reasoning` (Codex reasoning effort selector), and `notebook-draft:v1:<scopeKey>` (draft scoped per page URL via `activation-scope.ts`). The editor **on/off state is not stored** — it is runtime-only and resets on reload.

## Invariants and gotchas

- **Preview-only mutations.** All DOM edits happen inside the preview iframe. Cloned/copied HTML is scrubbed of runtime artifacts (`editor-bridge/runtime-artifacts.ts`) — overlay nodes, `data-copy-ai-id-*`/`data-ai-editor-*` attributes, `copy-ai-id-*` class tokens — while **preserving authored `data-ai-id`**.
- **Extension-owned DOM.** Every element the extension injects into a page must carry one of the ownership attributes matched by `EXTENSION_OWNED_DOM_SELECTOR` (`src/shared/config.ts`). Pickers, the layout tree, structure guards, and sibling walkers all use `isExtensionOwnedElement()` so the tool never targets or edits its own UI. Any new injected DOM must follow this rule.
- **Z-index constants are load-bearing** (`src/shared/config.ts`) — the top-frame host and preview overlays live in separate documents/stacking contexts; do not renumber.
- **Enabled state is ephemeral** — in-memory only, resets to off on reload; the `?copyaiid=active` URL param is the only re-activation mechanism across navigation.
- **Shallow message guards** — postMessage guards only check the `type` field; handlers are responsible for payload narrowing.
- **Open shadow DOM only** — all traversal is composed-tree aware via `src/content/target/composed-dom.ts`; closed roots are intentionally unreachable. Fallback selectors serialize shadow crossings as `::shadow` segments.
- **Protected structure tags** — `html`/`head`/`body` and extension-owned elements can never be duplicated/moved/deleted/dropped into (`editor-bridge/visual-structure.ts`).
- **Fresh structure clones aren't in the layout-tree registry yet** — structure handlers resolve ai-id instance indexes against the live DOM instead (`editor-bridge/editor-target.ts` comment).
- **Sanitization is centralized** — rich-text HTML goes through `visual-html.ts` (DOMPurify), attribute edits through `visual-attributes.ts`, exported snapshots through the allowlists in `visual-targets.ts`. Don't bypass these when adding new mutation paths.
- **file:// and opaque origins** get relaxed origin checks in the bridge (parent-frame identity is still verified) to support local files.
- **Chip ids are stable** — `el-N` numbers are never renumbered after deletion; `nextChipIndex` is persisted with the draft.
- **Codex server port is defined in two places** — `CODEX_SERVER_PORT` in `src/shared/codex.ts` and the `COPY_AI_ID_CODEX_SERVER_PORT` default in `scripts/codex-server.mjs` must stay in sync (45130).
- **The background worker stays a stateless proxy** — no run state, timers, or keepalive tricks in `src/background/index.ts`. Long codex runs are tracked by the editor polling `codex-run-status`; the worker may be killed and restarted between polls at any time. Don't add background logic for other features.
- **Codex writes only after resolve is confident or confirmed** — the resolve step only reads (`lsof`/fs). Confident detections (dev-server cwd, marker-based file root) run immediately with a path toast; a non-confident guess (bare directory with no `.git`/`package.json`) must be confirmed in `CodexConfirmDialog` first. Never auto-run a non-confident path.
- **Codex failure keeps the draft** — the notebook draft + visual edits are cleared only on a successful run (mirroring copy semantics); failures/timeouts fall back to copying the prompt to the clipboard.
- **`codex:` commits only on success** — a failed or timed-out run leaves the tree uncommitted; the next run's `auto-commit` pre-commit sweeps those partial changes up. Don't "fix" this by committing failed runs.

## Styling conventions

- Editor CSS is compiled by Tailwind/PostCSS and injected as a single inline `<style>` inside the shadow root (`editor.css?inline` in `src/editor/main.tsx`), starting with `:host { all: initial; }` so nothing leaks in or out of the host page.
- Tailwind config (`tailwind.config.js`): `content: ['./src/**/*.tsx']`, `important: '[data-ai-editor-ui]'`, `corePlugins.preflight: false`, custom `editor.*` color tokens. Dark theme via `--editor-*` CSS custom properties.
- Two idioms coexist: older layout/chrome uses BEM-ish `copy-ai-id-editor-*` classes; newer visual-panel/controls use Tailwind utilities. Match whichever the file you're editing uses.
- The quick-action toolbar (inside the preview page) does not use a shadow root — it relies on an `all: initial` reset (`editor-bridge/toolbar-styles.ts`).
- Editor UI elements carry their own `data-ai-id` attributes (dogfooding the product's targeting convention).

## Language / i18n

- All user-facing strings live in `src/shared/i18n.ts` (`COPY_AI_ID_MESSAGES`, en + ko). Add both locales when adding strings. Manifest-level name/description live in `public/_locales/`.
- `README.md` (English) and `README.ko.md` (Korean) are mirrored — keep both in sync for user-facing documentation changes.
