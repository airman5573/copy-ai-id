---
name: add-data-ai-id
description: Add or refine stable `data-ai-id` attributes in HTML, JSX, TSX, and component markup when the user asks for semantic IDs, AI-friendly DOM hooks, automation selectors, or consistent UI identifiers. Use for React/Vue/Svelte-style templates, forms, tables, cards, dialogs, lists, and repeated render blocks. Preserve existing project conventions when present; otherwise apply deterministic kebab-case naming, keep repeated items on the same shared id pattern, and never use random values, timestamps, database ids, or array indexes inside `data-ai-id`.
---

# Add Data AI ID

Add `data-ai-id` attributes that make the UI easy for AI agents, browser automation, and maintainers to navigate.

## Workflow

1. Inspect the repository convention before editing.
2. Follow any existing `AGENTS.md`, contributor guide, or established `data-ai-id` pattern.
3. If the repo has no pattern, use the default naming rules in this skill.
4. Add ids to meaningful structural and interactive elements, not to every decorative wrapper.
5. Keep names deterministic and role-based.
6. Validate that repeated renders reuse the same `data-ai-id` names instead of embedding runtime values.

## Inspect Existing Conventions First

Before adding anything, search for the local pattern:

```bash
rg -n "data-ai-id|data-semantic-id|semanticId|data-testid" .
rg -n "data-ai-id" src app components pages features
```

Check for:

- existing prefix style such as `mission-list-*` or `upload-feed-card-*`
- project docs that define naming rules
- reusable components that already accept an `aiId` or `aiIdPrefix` prop
- old attributes that should not be extended further, such as `data-semantic-id`

If the repository already has a strong convention, match it exactly.

## Default Naming Rules

Use kebab-case, short semantic words, and stable role names.

### 1. Start with a stable feature or component prefix

Use a prefix that identifies the page, feature, card, modal, or reusable component.

Good:

- `login-form`
- `mission-list-card`
- `upload-feed-card`
- `team-settings-card`
- `timer-controls`

Avoid vague prefixes:

- `container`
- `wrapper`
- `item`
- `box`

### 2. Name by role, not appearance

Describe what the element does in the UI tree.

Good:

- `notice-form-message-input`
- `mission-row-edit-button`
- `dashboard-scoreboard-table-body`
- `map-image-settings-company-image-upload-button`

Avoid CSS-driven names:

- `blue-button`
- `left-column`
- `big-card`

### 3. Use predictable suffixes

Prefer these suffix patterns when they fit:

- containers: `page`, `content`, `section`, `panel`, `card`, `grid`, `list`, `table`, `table-head`, `table-body`, `row`, `header`, `footer`, `actions`
- form fields: `field`, `label`, `input`, `select`, `textarea`, `helper`
- states: `loading`, `load-error`, `submit-error`, `success`, `empty-state`, `warning`
- actions: `submit-button`, `save-button`, `delete-button`, `edit-button`, `close-button`, `reset-button`
- media: `image`, `video`, `preview`, `preview-image`, `preview-video`

### 4. Keep repeated items on the same id

Inside loops, keep the same `data-ai-id` value for equivalent nodes.

Good:

```tsx
{missions.map((mission) => (
  <tr key={mission.id} data-ai-id="mission-row">
    <button data-ai-id="mission-row-edit-button">수정</button>
  </tr>
))}
```

Bad:

```tsx
{missions.map((mission, index) => (
  <tr data-ai-id={`mission-row-${mission.id}`}>
    <button data-ai-id={`mission-row-edit-button-${index}`}>수정</button>
  </tr>
))}
```

Do not put these into `data-ai-id` unless the repo explicitly requires it:

- random strings
- `Date.now()`
- UUIDs
- database ids
- slugs generated from mutable user content
- loop indexes

Use dynamic values only for React `key`, API payloads, form values, and internal logic.

### 5. Allow stable reusable prefixes

For reusable components, a stable prop-driven prefix is allowed.

Good:

```tsx
<div data-ai-id={aiIdPrefix}>
  <label data-ai-id={`${aiIdPrefix}-label`} />
  <input data-ai-id={`${aiIdPrefix}-input`} />
  <button data-ai-id={`${aiIdPrefix}-submit-button`} />
</div>
```

Only use this when the prefix itself is stable and semantic, for example:

- `map-image-settings-map-image`
- `map-image-settings-company-image`
- `mission-create-form`
- `mission-edit-form`

Do not derive the prefix from random or per-item runtime data.

## Coverage Rules

Add `data-ai-id` thoroughly to meaningful UI structure.

Usually annotate these elements:

- page root and page content area
- cards, sections, tabs, panels, modals, drawers
- list wrappers, table wrappers, tables, rows, row sub-sections
- forms and major field groups
- field label/input/select/textarea/helper/error nodes
- button groups and important buttons
- loading, empty, success, warning, and error states
- media containers and previews
- headers, titles, summaries, metadata blocks when they help navigation

Usually skip these unless they carry unique meaning:

- purely cosmetic wrappers with no navigation value
- redundant nested spans that do not add structure, state, or action
- every single typography-only element when the surrounding semantic container is enough

When in doubt, favor slightly more coverage for important workflow areas such as forms, tables, action bars, dialogs, and cards.

## Recommended Naming Shapes

### Page-level

```tsx
<Page aiId="missions-page" />
```

Derived children should follow the same base:

- `missions-page-header`
- `missions-page-title`
- `missions-page-header-actions`
- `missions-page-content`

### Form-level

```tsx
<form data-ai-id="notice-form">
  <div data-ai-id="notice-form-message-field">
    <label data-ai-id="notice-form-message-label" />
    <textarea data-ai-id="notice-form-message-input" />
    <p data-ai-id="notice-form-message-helper" />
  </div>
  <div data-ai-id="notice-form-actions">
    <button data-ai-id="notice-form-submit-button" />
  </div>
</form>
```

### List/table-level

```tsx
<div data-ai-id="upload-feed-grid">
  <div data-ai-id="upload-feed-grid-list">
    <article data-ai-id="upload-feed-card">
      <header data-ai-id="upload-feed-card-header" />
      <div data-ai-id="upload-feed-card-actions" />
    </article>
  </div>
</div>
```

### Reusable component-level

```tsx
function PreviewCard({ aiId }: { aiId: string }) {
  return (
    <div data-ai-id={aiId}>
      <div data-ai-id={`${aiId}-header`}>
        <div data-ai-id={`${aiId}-title`} />
      </div>
      <img data-ai-id={`${aiId}-image`} />
    </div>
  )
}
```

## Reference Patterns

Load `references/data-ai-id-pattern-examples.md` when you want concrete public examples of stable `data-ai-id` naming.

Key observations that generalize well:

- Use `data-ai-id` only. Do not introduce `data-semantic-id` or `semanticId`.
- Repeated rows and buttons intentionally share the same ids inside loops.
- Reusable components often accept `aiId` or `aiIdPrefix` and derive child ids with suffixes.
- Names are feature-first and role-second, such as `mission-row-name`, `timer-team-card-stop-button`, `notice-form-message-input`.
- Error/loading/success states are explicitly labeled instead of being left untagged.

## Editing Checklist

Before finishing, verify all of the following:

- ids use `data-ai-id`, not another custom attribute
- names are kebab-case
- names are semantic and role-based
- repeated items do not include runtime identifiers
- reusable prefixes are stable and meaningful
- important controls and states are covered
- added ids match the surrounding project vocabulary
- no unrelated refactor or style churn was introduced

## Output Style

When performing the task:

- make surgical edits
- prefer the project's existing naming vocabulary
- mention any local convention you found
- if no convention exists, state that you used the skill default
- call out any places where adding ids would require a broader component API change, such as introducing an `aiId` prop
