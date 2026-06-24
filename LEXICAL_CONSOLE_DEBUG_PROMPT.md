# Prompt: Add Console Diagnostics for Copy AI ID Lexical Typing Bug

Use this prompt with another AI/code agent to add temporary `console.log` diagnostics for finding the root cause of the Copy AI ID notebook Lexical typing bug.

---

```md
You are debugging a Chrome MV3 extension project at:

/Users/yoon/Desktop/labs/copy-ai-id

Goal:
Find the root cause of a Lexical contenteditable typing bug inside the Copy AI ID notebook editor.

Observed bug:
The editor DOM looks like this:

<div
  aria-label="이 요소에 남길 코멘트를 작성하세요..."
  aria-multiline="true"
  class="copy-ai-id-editor-note-contenteditable"
  contenteditable="true"
  role="textbox"
  spellcheck="false"
  data-ai-id="copy-ai-id-editor-note-lexical-editor"
  data-lexical-editor="true"
>
  <p dir="auto">
    <span
      class="copy-ai-id-editor-note-chip"
      data-ai-id="copy-ai-id-editor-note-chip"
      data-copy-ai-id-chip-id="el-1"
      data-copy-ai-id-chip-target-kind="fallback"
      spellcheck="false"
      data-copy-ai-id-chip-node-id="0/1/0/1/0"
      data-lexical-text="true"
    >el-1</span>
    <span data-lexical-text="true"> 줘</span>
  </p>
</div>

When typing into this Lexical editor, characters are lost or overwritten. Example:
Typing "hello world" can result in something like "lo old".
Delete/Backspace may also not work.

Important current status:
WebmateLog instrumentation was already added, but no browser logs are reaching the local collector.
The collector itself works, and the built dist contains instrumentation strings, but querying:

namespace = copy-ai-id.notebook
scenario = lexical-shadow-input

returns 0 real browser logs.

So first, add temporary console.log diagnostics to prove:
1. Whether the updated extension bundle is actually loaded in the page.
2. Whether the notebook editor mount path is reached.
3. Whether WebmateLog enable state/fetch is failing.
4. Then diagnose the Lexical root cause:
   - Shadow DOM selection mismatch
   - highlight-triggered blur
   - draft sync replay/overwrite
   - chip boundary/input/delete behavior

Constraints:
- Do not implement the final fix yet.
- Do not refactor broadly.
- Do not use browser automation, Playwright, Chrome DevTools automation, or visual verification.
- Add temporary console.log / console.warn / console.error only.
- Keep the code behavior unchanged except for logging.
- Keep logs privacy-safe:
  - Do NOT log raw note text.
  - Do NOT log raw selected text.
  - Do NOT log clipboard contents.
  - Do NOT log full URL with query/hash.
  - Do NOT log raw fallback selector/path/fullPath/nearbyText/accessibility/label.
  - Log lengths, booleans, enum values, short hashes, internal chip ids, and safe element metadata.
- After code edits, run:
  - npm run typecheck
  - npm run build
- Report exactly which files were changed and which console labels to look for.

Recommended implementation approach:

Create or reuse a tiny debug logger, for example:

File:
src/editor/debug/console-debug.ts

Example shape:

export const COPY_AI_ID_CONSOLE_DEBUG_PARAM = 'copyaiidConsoleDebug';
export const COPY_AI_ID_CONSOLE_DEBUG_STORAGE_KEY = 'copy-ai-id:console-debug';

let cachedConsoleDebugEnabled: boolean | null = null;

export function isCopyAiIdConsoleDebugEnabled(): boolean {
  if (cachedConsoleDebugEnabled !== null) {
    return cachedConsoleDebugEnabled;
  }

  try {
    const queryValue = new URL(window.location.href).searchParams.get(COPY_AI_ID_CONSOLE_DEBUG_PARAM);
    if (queryValue !== null) {
      cachedConsoleDebugEnabled = ['1', 'true', 'yes', 'on'].includes(queryValue);
      return cachedConsoleDebugEnabled;
    }
  } catch {}

  try {
    const storageValue =
      window.sessionStorage.getItem(COPY_AI_ID_CONSOLE_DEBUG_STORAGE_KEY)
      ?? window.localStorage.getItem(COPY_AI_ID_CONSOLE_DEBUG_STORAGE_KEY);
    cachedConsoleDebugEnabled = ['1', 'true', 'yes', 'on'].includes(String(storageValue));
    return cachedConsoleDebugEnabled;
  } catch {
    cachedConsoleDebugEnabled = false;
    return false;
  }
}

export function copyAiIdConsoleDebug(label: string, data: Record<string, unknown> = {}): void {
  if (!isCopyAiIdConsoleDebugEnabled()) return;

  console.log('[CopyAIID Notebook Debug]', label, {
    atMs: Math.round(performance.now()),
    ...data,
  });
}

export function copyAiIdConsoleWarn(label: string, data: Record<string, unknown> = {}): void {
  if (!isCopyAiIdConsoleDebugEnabled()) return;

  console.warn('[CopyAIID Notebook Debug]', label, {
    atMs: Math.round(performance.now()),
    ...data,
  });
}

export function copyAiIdConsoleError(label: string, data: Record<string, unknown> = {}): void {
  if (!isCopyAiIdConsoleDebugEnabled()) return;

  console.error('[CopyAIID Notebook Debug]', label, {
    atMs: Math.round(performance.now()),
    ...data,
  });
}

Also add:

export function shortHash(value: string | null | undefined): string | null {
  if (!value) return null;
  let hash = 0x811c9dc5;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
}

Enable it with either:

?copyaiidConsoleDebug=1

or:

sessionStorage.setItem('copy-ai-id:console-debug', '1');
location.reload();

Important:
Add one very early log that is gated only by the console debug flag and proves the new bundle is loaded.

Suggested call sites and exact console labels:

1. Content script/bootstrap path

Inspect these files and add minimal logs:

- src/content/bootstrap/index.ts
- src/content/editor-shell/mount.ts
- src/editor/main.tsx

Add logs like:

copyAiIdConsoleDebug('content-bootstrap-start', {
  readyState: document.readyState,
  topFrame: window.parent === window,
  locationScopeHash: shortHash(location.origin),
  hasCopyAiIdActiveQuery: new URL(window.location.href).searchParams.get('copyaiid') === 'active',
  hasConsoleDebugQuery: new URL(window.location.href).searchParams.get('copyaiidConsoleDebug') === '1',
  hasWebmateLogQuery: new URL(window.location.href).searchParams.get('copyaiidWebmateLog') === '1',
});

copyAiIdConsoleDebug('editor-shell-enable', {
  hadExistingHost: Boolean(document.querySelector('[data-ai-id="copy-ai-id-editor-host"]')),
});

copyAiIdConsoleDebug('editor-mount-start', {
  hadExistingShadowRoot: Boolean(host.shadowRoot),
});

copyAiIdConsoleDebug('editor-shadow-root-ready', {
  shadowChildCount: shadow.childNodes.length,
});

copyAiIdConsoleDebug('editor-react-root-rendered', {
  containerAiId: container.dataset.aiId,
});

Purpose:
If these logs do not appear, the updated bundle/editor path is not actually running.

2. WebmateLog helper diagnostics

File:
src/editor/debug/webmatelog.ts

Add console debug logs inside these functions:

- isNotebookWebmateLogEnabled()
- logNotebookWebmate()
- sendWebmateLog()

Labels:

copyAiIdConsoleDebug('webmatelog-enabled-evaluated', {
  queryEnabled,
  sessionValue,
  localValue,
  cachedEnabled,
});

copyAiIdConsoleDebug('webmatelog-send-attempt', {
  namespace: payload.namespace,
  scenario: payload.scenario,
  message: payload.message,
  endpoint,
  requestId: payload.request_id,
});

copyAiIdConsoleDebug('webmatelog-send-success', {
  status: response.status,
  ok: response.ok,
  message: payload.message,
});

copyAiIdConsoleWarn('webmatelog-send-non-ok', {
  status: response.status,
  ok: response.ok,
  message: payload.message,
});

copyAiIdConsoleError('webmatelog-send-error', {
  errorName: error instanceof Error ? error.name : typeof error,
  errorMessage: error instanceof Error ? error.message : String(error),
  message: input.message,
});

Purpose:
This determines whether WebmateLog logs are disabled, not called, or blocked by fetch/CORS/mixed content/extension context.

3. Lexical native DOM input/focus/selection diagnostics

File:
src/editor/notebook/lexical/NotebookEditorPlugins.tsx

There is already a plugin or equivalent root listener added for:

- keydown
- beforeinput
- input
- compositionstart
- compositionend
- paste
- cut
- focus
- blur
- selectionchange

Add console logs there too.

Label:

copyAiIdConsoleDebug('lexical-dom-event', {
  eventType: event.type,
  key: safeKey(event),
  code: safeCode(event),
  inputType: event instanceof InputEvent ? event.inputType : null,
  dataLength: event instanceof InputEvent && typeof event.data === 'string'
    ? event.data.length
    : null,
  isComposing:
    event instanceof KeyboardEvent ? event.isComposing :
    event instanceof InputEvent ? event.isComposing :
    null,
  defaultPrevented: event.defaultPrevented,
  composed: event.composed,
  focus: getLexicalEditorFocusSnapshot(editor),
  selection: getEditorSelectionSnapshot(editor),
});

safeKey behavior:
- Printable single-character keys should be logged as '[printable]'.
- Space should be logged as 'Space'.
- Backspace/Delete/Enter/ArrowLeft/ArrowRight should be logged by name.
- Do not log raw typed letters.

Purpose:
This shows whether the browser sends key/input events normally and whether Lexical receives them.

4. Shadow DOM selection/focus snapshot

In the existing focus helper or nearby:

Add logs that compare document.activeElement and shadowRoot.activeElement.

Label:

copyAiIdConsoleDebug('lexical-focus-snapshot', {
  rootPresent,
  rootNodeKind,
  documentHasFocus,
  ownerActiveTag,
  ownerActiveAiId,
  ownerActiveContentEditable,
  ownerActiveIsRoot,
  ownerActiveWithinRoot,
  rootActiveTag,
  rootActiveAiId,
  rootActiveContentEditable,
  rootActiveIsRoot,
  rootActiveWithinRoot,
  isFocused,
  documentSelectionSummary,
  shadowSelectionSummary,
});

Purpose:
The suspected root cause is a Shadow DOM selection mismatch. We need to know if:
- document.getSelection() is null/outside editor
- shadowRoot.getSelection() points inside the editor
- Lexical is using the wrong selection source

5. Highlight blur diagnostics

File:
src/editor/notebook/lexical/NotebookEditorPlugins.tsx

Function:
HighlightBlurPlugin

Add before editor.blur():

copyAiIdConsoleWarn('highlight-blur-decision', {
  willBlur,
  hoverProtected,
  focus: getLexicalEditorFocusSnapshot(editor),
  highlightedNodeIdHash: shortHash(highlightedNodeId),
  highlightedTargetKind: highlightedTarget?.kind ?? null,
  fallbackSelectorKind:
    highlightedTarget?.kind === 'fallback'
      ? highlightedTarget.selectorKind
      : null,
  highlightOrigin,
  selection: getEditorSelectionSnapshot(editor),
});

Purpose:
If typing triggers highlight change and willBlur=true, the editor may lose selection, causing broken input/delete.

6. Draft sync replay diagnostics

File:
src/editor/notebook/lexical/NotebookEditorPlugins.tsx

Function:
DraftSyncPlugin

Add one console log for every decision:

copyAiIdConsoleWarn('draft-sync-decision', {
  decision,
  previousDraftLength: previousDraft.length,
  nextDraftLength: draft.length,
  currentDraftLength,
  previousDraftHash: shortHash(previousDraft),
  nextDraftHash: shortHash(draft),
  currentDraftHash: shortHash(currentDraft),
  propChanged: draft !== previousDraft,
  lexicalMatchesIncomingDraft: currentDraft === draft,
  focus: getLexicalEditorFocusSnapshot(editor),
  selection: getEditorSelectionSnapshot(editor),
});

Decision values:
- unchanged-prop
- already-in-sync
- reinitialize-from-legacy-text

Purpose:
If "reinitialize-from-legacy-text" appears immediately after input, the user’s typed characters are being overwritten by stale draft state.

7. Lexical change/export diagnostics

File:
src/editor/notebook/lexical/NotebookEditorPlugins.tsx

Function:
handleChange inside NotebookEditorPlugins

After $exportNotebookLexicalState():

copyAiIdConsoleDebug('lexical-change-exported', {
  draftLength: exportedState.text.length,
  draftHash: shortHash(exportedState.text),
  previousDraftLength,
  previousDraftHash,
  draftLengthDelta,
  isEmpty: exportedState.isEmpty,
  chipCount: exportedState.chips.length,
  previousChipCount,
  chipCountDelta,
  chipIds: exportedState.chips.map(chip => chip.chipId).slice(0, 20),
  chipTargets: exportedState.chips.map(chip => ({
    chipId: chip.chipId,
    targetKind: chip.target.kind,
    selectorKind: chip.target.kind === 'fallback' ? chip.target.selectorKind : null,
    nodeIdHash: shortHash(chip.nodeId),
  })).slice(0, 20),
  selection: getEditorSelectionSnapshot(editor),
  focus: getLexicalEditorFocusSnapshot(editor),
});

Purpose:
This reveals whether Lexical state actually changes after each input and whether it later shrinks/reverts.

8. Chip insertion diagnostics

File:
src/editor/notebook/lexical/NotebookEditorPlugins.tsx

Functions:
TargetReferenceInsertionPlugin
$insertChipReference

Add logs:

copyAiIdConsoleDebug('chip-insert-requested', {
  chipId,
  targetKind: targetReference.target.kind,
  selectorKind: targetReference.target.kind === 'fallback'
    ? targetReference.target.selectorKind
    : null,
  nodeIdHash: shortHash(targetReference.nodeId),
  focus: getLexicalEditorFocusSnapshot(editor),
  selection: getEditorSelectionSnapshot(editor),
});

copyAiIdConsoleDebug('chip-insert-committed', {
  chipId,
  insertionSummary: {
    hadRangeSelection,
    insertedViaSelection,
    rootWasEmptyBefore,
    rootTextLengthBefore,
    selectionBefore,
  },
  focus: getLexicalEditorFocusSnapshot(editor),
  selection: getEditorSelectionSnapshot(editor),
});

Purpose:
The bug may be related to Lexical token/entity behavior around the chip node and its trailing space.

9. ContentEditable direct React handlers

File:
src/editor/notebook/lexical/NotebookLexicalEditor.tsx

The ContentEditable currently has:

onFocus
onKeyDown
onInput
onPaste

Change them from bare protectNoteEditorFromHover() to wrappers that also log:

onFocus={(event) => {
  copyAiIdConsoleDebug('contenteditable-react-focus', {
    currentTargetAiId: event.currentTarget.dataset.aiId,
  });
  protectNoteEditorFromHover();
}}

onKeyDown={(event) => {
  copyAiIdConsoleDebug('contenteditable-react-keydown', {
    key: safeKey(event.nativeEvent),
    code: safeCode(event.nativeEvent),
    isComposing: event.nativeEvent.isComposing,
    defaultPrevented: event.nativeEvent.defaultPrevented,
  });
  protectNoteEditorFromHover();
}}

onInput={(event) => {
  const nativeEvent = event.nativeEvent;
  copyAiIdConsoleDebug('contenteditable-react-input', {
    inputType: nativeEvent instanceof InputEvent ? nativeEvent.inputType : null,
    dataLength: nativeEvent instanceof InputEvent && typeof nativeEvent.data === 'string'
      ? nativeEvent.data.length
      : null,
    isComposing: nativeEvent instanceof InputEvent ? nativeEvent.isComposing : null,
  });
  protectNoteEditorFromHover();
}}

onPaste={() => {
  copyAiIdConsoleDebug('contenteditable-react-paste', {});
  protectNoteEditorFromHover();
}}

Purpose:
This confirms whether React-level handlers see the same events as native root listeners.

10. Final diagnostic target

After adding logs and building, reproduce with URL:

?copyaiid=active&copyaiidConsoleDebug=1&copyaiidWebmateLog=1

Then inspect console manually.

Expected interpretation:

A. If no "content-bootstrap-start":
- Updated content script is not running.
- Extension reload/path is wrong.

B. If bootstrap logs exist but no "editor-mount-start":
- Editor shell is not being enabled/mounted.

C. If editor mount logs exist but no "lexical-dom-event":
- ContentEditable/root listener not attached or user is typing into a different editor/root.

D. If "lexical-dom-event" exists and documentSelection differs from shadowSelection:
- Shadow DOM selection mismatch is likely root cause.

E. If "highlight-blur-decision" shows willBlur=true during typing:
- Highlight blur is likely root cause.

F. If "draft-sync-decision" shows reinitialize-from-legacy-text after input:
- Draft replay/overwrite is likely root cause.

G. If keydown/beforeinput/delete events exist but no lexical-change-exported:
- Lexical is swallowing or failing to apply the edit, likely selection/chip boundary.

H. If lexical-change-exported shows expected growth followed by shrink/revert:
- External state/draft persistence replay is likely root cause.

Deliverables:
- Add temporary console logs only.
- Keep logs behind copyaiidConsoleDebug=1 or sessionStorage key copy-ai-id:console-debug.
- Do not log raw user text or page-sensitive values.
- Run npm run typecheck.
- Run npm run build.
- Report files changed and the exact console labels to watch.
```

---

## Recommended first labels to verify

The first three console labels to confirm are:

```text
[CopyAIID Notebook Debug] content-bootstrap-start
[CopyAIID Notebook Debug] editor-mount-start
[CopyAIID Notebook Debug] editor-react-root-rendered
```

If those do not appear, the problem is before Lexical.

If those appear, then check:

```text
[CopyAIID Notebook Debug] webmatelog-enabled-evaluated
[CopyAIID Notebook Debug] webmatelog-send-attempt
[CopyAIID Notebook Debug] webmatelog-send-error
```

That will explain why WebmateLog is not reaching the collector.

Only after that should the Lexical-level diagnostics be trusted:

```text
lexical-dom-event
lexical-focus-snapshot
highlight-blur-decision
draft-sync-decision
lexical-change-exported
chip-insert-committed
```
