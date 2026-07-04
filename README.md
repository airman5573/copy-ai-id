# Copy AI ID

**Install from the Chrome Web Store:**  
<https://chromewebstore.google.com/detail/opodkffbpbkjjechadlpogecbmlbmkgi?utm_source=item-share-cb>

[한국어](README.ko.md)

Copy AI ID is a `data-ai-id`-first Chrome extension editor for rendered pages. Turn it on from the current tab to open a full-screen Shadow DOM editor with a responsive iframe preview, preview-only visual editing controls, and a floating note panel for copying AI-ready UI change notes. Selected elements are inserted into the notebook as compact `el-N` chips; elements with `data-ai-id` map to stable references, and elements without one can still be selected and visually edited through generated fallback targets.

## Editor workflow

1. Open a rendered page. Pages with semantic `data-ai-id` attributes work best, but fallback selection also works on no-ID or mixed pages.
2. Press **Shift + Z + Space**, or open the extension popup and click **Turn ON**.
3. Copy AI ID opens a full-screen editor over the current tab:
   - **Preview:** iframe preview of the current URL with the `copy-ai-id-preview=1` query marker, breakpoint buttons, zoom controls, fit/reset controls, click-to-pin quick edit toolbar, and floating visual panel.
   - **Floating note panel:** one Lexical-backed notebook draft for selected stable `data-ai-id` targets or generated fallback targets. Targets appear as compact `el-N` chips. Preview-only visual edit instructions stay hidden while editing and are appended only to the copied Markdown.
4. Highlight DOM nodes from the preview or the keyboard.
5. Press **Space** to insert/focus a notebook chip such as `el-1`. Copy AI ID uses `data-ai-id` first for the chip target; if the highlighted node has no usable `data-ai-id`, the chip stores fallback metadata without exposing long selector/path/context text in the editor. **Space** first opens the floating note panel near the highlighted/hovered element, focuses it, then inserts the chip. Click a chip to reveal/highlight its linked preview element. Chip numbers are stable and are not renumbered after deletion, so a draft can contain `el-1`, `el-3`, and `el-4`.
6. Optionally click a preview element to pin the quick edit toolbar to it. The toolbar's first row is composed from the element's detected intents (image / text / container / link-button / form); the second row always offers padding/margin/gap steppers, structure buttons (duplicate, move, delete), a drag grip, and a **More** button that opens the floating visual panel. Numeric edits use `+/-` steppers that apply concrete pixel values to the preview while recording "change by n% relative to the current value" intents for export. Double-click a text element to edit its text inline. All mutations are preview-only and are recorded as AI-readable visual edit instructions.
7. Press **Shift + Enter** or click **Copy** to copy the notebook as AI-friendly Markdown with `## Requests`, `## Targets`, `## Rules`, and, when applicable, `## Visual edits` sections. Inline chips are rendered as readable `@el-N` mentions, fallback targets include selector/path/context details, and visual edits include human summaries plus machine-readable JSON diffs.
8. Close the editor with the toolbar close button, **Esc**, or **Shift + Z + Space**.

If the same `data-ai-id` appears multiple times, Copy AI ID shows each instance separately with an instance badge and duplicate warning so the selected DOM node stays unambiguous.

Some sites block iframe embedding with `X-Frame-Options` or `frame-ancestors` CSP. Copy AI ID reports that state inside the editor, but it cannot bypass the site policy.

## Floating note panel

The notebook lives in a floating panel overlay:

- Press **Space** on a highlighted/hovered element to open the panel right next to that element and insert a chip.
- Click the **Note** button in the top toolbar to open/close the panel without selecting an element; it appears at a default position near the preview frame.
- The top toolbar also has a **Copy** button, so visual-only edit sessions (no notebook text) can be copied without opening the note panel at all.
- The panel's controls row includes the breakpoint scope buttons, the Tailwind toggle, the copy-notice dialog, reset, the **Shift + Enter** hint, and the copy button.

## Preview-only visual editing

Visual editing is an interface for creating precise implementation prompts. It does not save changes back to the inspected page, project source, CMS, or remote service.

- Click an element in the preview to pin the quick edit toolbar to it. Clicking another element moves the toolbar; clicking the page background or pressing **Esc** dismisses it. Hovering only highlights elements and never opens the toolbar.
- The toolbar and the floating visual panel both live in the editor Shadow DOM; the preview bridge only streams anchor geometry and element intents while an element is pinned.
- The toolbar's first row adapts to the element's intents — for example images get replace/size/object-fit/radius controls, text gets font-size/weight/color/align, containers get gap/flex/background controls. The second row is shared: padding/margin/gap scope popovers, duplicate/move/delete, a drag grip, and **More**.
- Numeric properties are edited with `+/-` steppers only (10% per click relative to the value captured at the first step). The preview shows concrete pixels; the export records the percent intent with its base value so the change can be applied in whatever units the source already uses.
- Double-click a text element in the preview to edit its text inline; **Enter** or blur commits through the regular text-mutation pipeline, **Esc** cancels.
- **More** opens the floating visual panel: a single scroll of collapsible sections (an image section appears first for image-intent elements) covering everything the toolbar does not — layout, size constraints, extended typography, effects (opacity/shadow/filter/transform presets), border details, and content/attribute/form values. Desktop placement follows the selected element; mobile and tablet breakpoints place the panel beside the preview iframe.
- Structure controls duplicate, move up/down, delete, and drag elements inside the preview DOM. These are still preview-only operations.
- Elements without `data-ai-id` can be edited through fallback target metadata. The copied output marks these as less stable and includes selector/path/context details so an AI or developer can re-identify the element in source.
- Visual edit prompt text is intentionally hidden while editing. The note panel only shows status/counts. On **Copy**, Copy AI ID appends a `## Visual edits` section with human-readable summaries and a fenced JSON diff.
- A successful copy clears both the visible notebook draft and the accumulated visual edit records. Reset clears those editor records too, but it does not restore preview DOM mutations that were already applied; reload/reopen the preview to return the rendered page to its original state.

## Shortcuts

| Shortcut | Action |
| --- | --- |
| **Shift + Z + Space** | Toggle Copy AI ID editor on/off |
| **ArrowUp** | Move to the previous/left DOM sibling; if none, move to the parent |
| **ArrowRight** | Move to the next/right sibling; if none, climb to an ancestor's next/right sibling and enter its first child |
| **ArrowLeft** | Move to the previous/left sibling; if none, climb to an ancestor's previous/left sibling and enter its deepest last descendant |
| **ArrowDown** | Move to the first child; if none, move to the next/right sibling or the nearest ancestor's next/right sibling |
| **Space** | Insert/focus the highlighted node as a compact `el-N` chip. Opens/focuses the floating note panel near the highlighted/hovered element before inserting the chip. The chip maps to a stable `data-ai-id` target first; otherwise it stores a generated fallback target when available. |
| **Shift + Enter** | Copy the current notebook text with suffixes |
| **Esc** | Clear selection or close/off the editor where applicable |

Keyboard traversal moves through every preview DOM node, not only nodes with `data-ai-id`. **Space** remains `data-ai-id`-first, while no-ID nodes use fallback chips as a less-stable bridge.

Shortcuts are ignored while typing in editable fields or during IME composition, except **Shift + Enter** inside the notebook copies the current notebook.

## Send to Codex (optional, local-only)

The editor can send the same Markdown the **Copy** button produces straight to the [OpenAI Codex CLI](https://github.com/openai/codex) on your machine — no clipboard round-trip.

1. Start the local server from this repository and keep the terminal open:

   ```bash
   npm run codex-server        # or scripts/start-codex-server.sh
   ```

2. Open a **localhost dev-server page** or a **file:// page** in the editor and click the **Codex** button (top toolbar or note panel).
3. The server auto-detects the local project for the page — localhost pages map the port to the dev-server process's working directory, `file://` pages walk up to the nearest `.git`/`package.json`. When detection is unambiguous the run starts immediately (a toast shows the project path); only uncertain guesses (a file with no `.git`/`package.json` marker nearby) ask for confirmation first.
4. The server then:
   - runs `git init` (plus a default `.gitignore`) if the project has no repository,
   - commits any pre-existing uncommitted changes first as `auto-commit: <timestamp>`,
   - runs `codex exec` inside the project (workspace-write sandbox, 5-minute default timeout),
   - commits Codex's changes as `codex: <first line of the request>`.
5. While Codex works, a live activity log opens right under the toolbar Codex button — reasoning summaries, executed commands, and edited files stream in as they happen — and closes by itself a few seconds after the run ends.
6. On success the notebook draft and visual edits are cleared, exactly like a copy. On failure or timeout the prompt is copied to the clipboard instead so you can paste it manually.

The reasoning selector next to the Codex button controls how hard Codex thinks (low/medium/high; default medium — bump it to high for complex tasks). The choice is remembered across sessions.

Everything stays on your machine: the server binds to `127.0.0.1` only and requires a request header ordinary web pages cannot attach. Environment overrides: `CODEX_BIN`, `COPY_AI_ID_CODEX_SERVER_PORT` (default 45130), `COPY_AI_ID_CODEX_TIMEOUT_MS` (default 300000), `COPY_AI_ID_CODEX_REASONING` (default `medium`), `COPY_AI_ID_CODEX_MODEL` (optional model override), `COPY_AI_ID_ALLOW_OUTSIDE_HOME=1`.

## What is `data-ai-id`?

`data-ai-id` is a stable semantic HTML attribute that gives AI tools, browser automation, QA reviewers, and maintainers a precise handle for UI elements.

```html
<button data-ai-id="login-form-submit-button">Sign in</button>
```

## Add `data-ai-id` to your markup

`data-ai-id` works best when your project adds stable semantic IDs to HTML, JSX, TSX, and component markup. Ask your AI coding assistant to follow your project's existing ID convention first; if none exists, deterministic parent-child kebab-case IDs work well:

```html
<form data-ai-id="login-form">
  <label data-ai-id="login-form-email-field-label">Email</label>
  <input data-ai-id="login-form-email-field-input" />
  <button data-ai-id="login-form-submit-button">Sign in</button>
</form>
```

## Local development build

```bash
npm install
npm run build
```

Then open `chrome://extensions`, enable **Developer mode**, choose **Load unpacked**, and select this repository's `dist/` directory.

## Local file access

If you open a local HTML file directly from disk, Chrome treats it as a `file://` page:

```text
file:///Users/you/project/page.html
```

Chrome blocks extensions from reading `file://` pages unless you enable file access for that extension.

To fix it:

1. Open `chrome://extensions`.
2. Find **Copy AI ID**.
3. Click **Details**.
4. Turn on **Allow access to file URLs**.


## Product scope

Copy AI ID is editor-first. It does **not** include a Codex side panel, native messaging host, AI chat, history, settings pages, analytics, or remote AI processing. Notes and preview-only visual edit instructions leave the editor only when the user explicitly copies them (**Copy** / **Shift + Enter**) or explicitly confirms a **Send to Codex** run, and the optional Codex path talks exclusively to a local `127.0.0.1` server the user starts manually — nothing is ever sent to a remote service.
