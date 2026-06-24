# Copy AI ID Editor Usage

Copy AI ID opens a full-screen editor on top of the current tab. The editor is intentionally narrow: inspect rendered DOM structure, navigate layout-tree nodes, write notes for stable `data-ai-id` targets or generated fallback targets, make preview-only visual edits, and copy the resulting AI-ready Markdown. The product remains `data-ai-id`-first: fallback targets are a bridge for no-ID or partially-ID pages, not a replacement for semantic IDs.

## Open and close

- Press **Shift + Z + Space** on the page to toggle the editor.
- Or open the extension popup and click **Turn ON** / **Turn OFF**.
- The toolbar close button disables the same runtime editor state.

The enabled state is runtime-only. Reloading the page or extension context resets it.

## Layout

| Area | Purpose |
| --- | --- |
| Left layout tree | Full DOM hierarchy for context. Every DOM row is keyboard-navigable/selectable for inspection. Rows with `data-ai-id` insert stable notebook chips; no-ID rows insert fallback chips when metadata is available. |
| Center preview | Iframe preview of the current URL with the `copy-ai-id-preview=1` query marker. The preview bridge handles click selection, keyboard navigation, hover outlines, tree synchronization, hover quick-action anchoring, and preview-only DOM mutations for visual editing. |
| Right note panel | Always-visible Lexical-backed notebook draft, selected target chips, viewport scope controls, Tailwind suffix toggle, hidden visual-edit status/counts, and Copy button. Visual edit prompt text is hidden until copied. |

## Breakpoints and zoom

The preview toolbar uses these AI Editor-style breakpoints:

| ID | Label | Width |
| --- | --- | ---: |
| `base` | Base | 390px |
| `mobile` | Mobile | 640px |
| `tablet` | Tablet | 768px |
| `desktop` | Desktop | 1024px |
| `desktop1280` | 1280 | 1280px |
| `desktop1440` | 1440 | 1440px |
| `desktop1536` | 1536 | 1536px |
| `desktop1920` | 1920 | 1920px |

Zoom controls are editor-only display controls. They do not change the page source.

## Selection and duplicate IDs

- Preview hover/selection resolves to the closest composed ancestor with a non-empty `[data-ai-id]`; if none exists, it falls back to the deepest connected, non-extension-owned element.
- Tree selection can highlight any layout-tree DOM row, including rows without `data-ai-id`.
- Keyboard traversal moves through every layout-tree DOM node, not only `data-ai-id` nodes.
- Rows with `data-ai-id` are stable reference targets. Rows without `data-ai-id` can become generated fallback targets with selector/path/context metadata.
- Duplicate `data-ai-id` values are shown as separate instances with `n/total` badges and a warning marker.

## Preview-only visual editing

Visual editing is a prompt-building interface. It changes only the live preview DOM so the user can see the intended result and so Copy AI ID can generate precise instructions for an AI/developer to apply in the actual source.

### Quick-action bar

- Hover a preview element to show the editor-owned quick-action bar above that element when there is space, or below it when needed.
- Moving the pointer from the hovered element to the toolbar keeps the toolbar visible long enough to click it.
- Category buttons open the floating visual panel for `content`, `layout`, `spacing`, `size`, `style`, and `border`.
- Structure controls perform preview-only duplicate, move up, move down, delete, and drag-move operations.
- The quick-action bar is runtime-owned DOM inside the preview iframe, so hovering from the selected element into the toolbar stays within the same preview interaction surface.

### Floating visual panel

- The floating visual panel remains in the editor Shadow DOM.
- Desktop placement follows the selected target and clamps to the editor viewport.
- Mobile and tablet breakpoints place the panel beside the preview iframe where possible.
- Content controls can edit plain text, rich HTML fragments, curated safe attributes/links, and form values.
- Layout, spacing, size, style, and border controls apply CSS-property changes as inline preview mutations for immediate feedback. Style records keep the active breakpoint label as implementation intent.
- Fallback targets without `data-ai-id` are editable, but the copied output warns that selector/path/context references are less stable than semantic IDs.

### Copy and reset behavior

Visual edit records stay out of the visible notebook text while editing. The note panel may show counts/status, but not the generated prompt. On **Copy**, Copy AI ID appends a hidden `## Visual edits` section containing:

- a short preview-only warning
- target-grouped human-readable summaries
- fallback target safety notes when applicable
- breakpoint intent notes for style records
- a fenced JSON export with exact target descriptors, before/after payloads, mutation kinds, statuses, and warnings

Copy is allowed even when the visible notebook is empty if there are copyable visual edits. In that case, Copy AI ID creates a default request asking the recipient to apply the preview-only visual edits to the source implementation.

A successful copy clears both the visible notebook draft and accumulated visual edit records. The Reset button clears the same editor records. Neither action automatically restores already-applied preview DOM mutations; reload/reopen the preview if you need the page rendered from its original source again.

## Notebook copy format

Press **Space** with a highlighted node to insert a compact inline chip such as `el-1` in the Lexical note editor. The editor no longer exposes long raw selector blocks while you write notes.

- If the highlighted node has `data-ai-id`, the chip stores that stable target.
- If the highlighted node does not have a usable `data-ai-id`, the chip stores fallback metadata when the target is still connected.
- Chip IDs are stable and are not renumbered after deletion or reordering, so a draft can contain `el-1`, `el-3`, and `el-4`.
- Clicking a chip reveals/highlights the linked preview element with the same selected visual used by hover/tree selection. If the DOM changed and the target is stale or disconnected, Copy AI ID shows a stale-target error and keeps the chip unchanged.

When copied, the visible chips become readable `@el-N` mentions in an AI-friendly Markdown document. Copy AI ID also adds expanded target details:

```text
## Requests

@el-1 Please update the title.
@el-3 Compare this fallback button with the new CTA.

## Targets

### `el-1`
- Kind: stable data-ai-id target
- data-ai-id: `hero-title`

### `el-3`
- Kind: fallback target (selector reliability: `nth-child`)
- Element: `button` — button "Submit"
- Selector: `form > button:nth-child(3)`
- DOM path: `body > main > form > button`
- Context: Submit
```

Fallback chip targets are less stable than real `data-ai-id` references because they depend on the current DOM selector/path/context, but selector/path/context metadata is only added to the copied `## Targets` section and is no longer inserted into the editable note while you write.

Press **Shift + Enter** or click **Copy** to copy the whole notebook draft. If visual edit records exist, the copied Markdown also includes `## Visual edits` after the normal notebook sections. Copy AI ID appends these items under `## Rules` when applicable:

- optional viewport scope suffix when manual scope is selected
- optional `works with tailwind only`
- the target notice that the `data-ai-id` attribute itself must not be edited and that the element with that `data-ai-id` should be edited
- when fallback chip targets are present, an additional notice that fallback references are generated from the current DOM selector/path/context and may need re-identification if the DOM changes

After a successful copy, the visible notebook draft and accumulated visual edit records are cleared.

## Keyboard shortcuts

| Shortcut | Action |
| --- | --- |
| **Shift + Z + Space** | Toggle editor on/off |
| **ArrowUp** | Previous/left sibling; if none, parent |
| **ArrowRight** | Next/right sibling; if none, climb to an ancestor's next/right sibling and enter its first child |
| **ArrowLeft** | Previous/left sibling; if none, climb to an ancestor's previous/left sibling and enter its deepest last descendant |
| **ArrowDown** | First child; if none, next/right sibling; if none, nearest ancestor's next/right sibling |
| **Space** | Insert/focus the highlighted node as a compact `el-N` chip. The chip maps to a stable `data-ai-id` target first; otherwise it stores a generated fallback target when available. |
| **Shift + Enter** | Copy notebook with suffixes |
| **Esc** | Clear selection or close/off the editor where applicable |

Keyboard traversal follows layout-tree DOM order, not visual screen position. It visits nodes with and without `data-ai-id`; `data-ai-id` nodes become stable chip targets and no-ID nodes can become generated fallback chip targets. See [`keyboard-traversal.md`](keyboard-traversal.md) for step-by-step examples.

Shortcuts are ignored while the user is typing in editable fields or during IME composition, except **Shift + Enter** inside the notebook copies the current notebook.

## Manual static examples

Open these files manually when you need fallback-target examples without browser automation:

- [`../examples/code-example-ko.html`](../examples/code-example-ko.html) — a full no-`data-ai-id` page for fallback-only selection.
- [`../examples/fallback-targets.html`](../examples/fallback-targets.html) — a mixed page with stable `data-ai-id` targets and no-ID fallback targets.

## Iframe limitation

The center preview is an iframe. Some sites block iframe embedding with `X-Frame-Options` or `Content-Security-Policy: frame-ancestors`. Copy AI ID can show that the preview is blocked, but it cannot bypass the site's policy.

## Removed surfaces

The editor-only product does not include Codex sidepanel/chat/native-host flows, settings/history screens, remote prompt sending, AI-generated control panels, or browser automation tooling. Visual edits are local preview mutations plus clipboard export instructions; no native host installation is required.
