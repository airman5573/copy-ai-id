# Chrome Web Store Permission Justifications

Generated: 2026-04-26 03:43 KST
Updated: 2026-06-23 KST — fallback selector/context metadata wording

## Current manifest permission summary

Source: `src/manifest.ts` and rebuilt `dist/manifest.json`.

```json
{
  "host_permissions": ["<all_urls>"],
  "content_scripts.matches": ["<all_urls>"],
  "content_scripts.all_frames": true,
  "content_scripts.match_about_blank": true
}
```

## Dashboard-ready justifications

### `tabs` / `activeTab`

Not requested in the current upload manifest. The popup still uses the `chrome.tabs` API namespace to query and message the active tab, but Chrome exposes that namespace without the `tabs` permission. The sensitive active-tab URL is covered by the declared host access for matching pages, so separate `tabs` and `activeTab` permission strings are not needed for the current editor-only flow.

### `<all_urls>` host access and content script matches

Required because Copy AI ID's single purpose is to inspect rendered DOM targets on arbitrary user-selected pages, including production sites, staging domains, localhost/dev servers, and local HTML captures. Stable targets use rendered `data-ai-id` attributes; no-ID targets can use generated fallback metadata such as selectors, selector reliability/type, DOM path, concise nearby text, class tokens, and accessibility context. The content script powers editor activation, iframe preview bridge behavior, DOM layout-tree extraction, keyboard traversal across layout-tree nodes, hover/selection outlines, note target selection, local fallback metadata generation, and clipboard copy formatting.

### `all_frames` / `match_about_blank`

The editor uses an iframe preview of the current page. Content scripts run in frames so the top-frame editor shell can be separated from the preview-frame bridge and so `about:blank`/initial frame states can be handled consistently.

## Permissions not currently requested

The current editor-only build does **not** request these permissions:

- `tabs`
- `activeTab`
- `storage`
- `sidePanel`
- `nativeMessaging`
- `scripting`
- `history`
- `desktopCapture`
- `offscreen`
- `contextMenus`
- `clipboardRead`
- `clipboardWrite`
- `tabCapture`
- `webRequest`
- `cookies`

## Validation

Validation command:

```bash
node - <<'NODE'
const fs = require('node:fs');
const manifest = JSON.parse(fs.readFileSync('dist/manifest.json', 'utf8'));
console.log(JSON.stringify({
  permissions: manifest.permissions ?? [],
  host_permissions: manifest.host_permissions ?? [],
  contentScriptMatches: manifest.content_scripts?.flatMap(s => s.matches ?? []) ?? [],
  allFrames: manifest.content_scripts?.every(s => s.all_frames === true) ?? false,
  matchAboutBlank: manifest.content_scripts?.every(s => s.match_about_blank === true) ?? false,
  hasTabs: (manifest.permissions ?? []).includes('tabs'),
  hasActiveTab: (manifest.permissions ?? []).includes('activeTab'),
  hasStorage: (manifest.permissions ?? []).includes('storage'),
  hasNativeMessaging: (manifest.permissions ?? []).includes('nativeMessaging'),
  hasSidePanel: (manifest.permissions ?? []).includes('sidePanel'),
  hasScripting: (manifest.permissions ?? []).includes('scripting'),
  hasHistory: (manifest.permissions ?? []).includes('history'),
}, null, 2));
NODE
```

Expected/current result:

```json
{
  "permissions": [],
  "host_permissions": [
    "<all_urls>"
  ],
  "contentScriptMatches": [
    "<all_urls>"
  ],
  "allFrames": true,
  "matchAboutBlank": true,
  "hasTabs": false,
  "hasActiveTab": false,
  "hasStorage": false,
  "hasNativeMessaging": false,
  "hasSidePanel": false,
  "hasScripting": false,
  "hasHistory": false
}
```
