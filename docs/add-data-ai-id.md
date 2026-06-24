# add-data-ai-id

A public, GitHub-friendly extraction of the internal **Codex skill** used in this project for writing stable `data-ai-id` attributes.

This document is intended for:

- frontend engineers
- designers and PMs reviewing UI semantics
- QA engineers
- browser automation authors
- teams preparing their products for AI agent workflows

The goal is simple:

> Make the DOM easier for AI agents, automation tools, and humans to navigate by using stable, semantic `data-ai-id` attributes.

---

## Core principles

1. **Use `data-ai-id` only** for this selector contract.
2. **Preserve existing project conventions** if the repository already has one.
3. If there is no convention yet, use the default naming rules below.
4. Add IDs to **meaningful structure and actions**, not every decorative wrapper.
5. Keep names **deterministic, semantic, and role-based**.
6. For repeated UI items, reuse the **same ID pattern** instead of injecting runtime values.

---

## What `data-ai-id` is for

A good `data-ai-id` should help with:

- AI agent navigation
- browser automation
- manual QA
- prompt writing
- UI inspection
- long-term maintainability

It is **not** primarily a visual styling hook, and it should not depend on:

- CSS appearance
- random values
- timestamps
- loop indexes
- database IDs
- mutable user-generated labels

---

## Naming rules

### 1. Start with a stable feature or component prefix

Use a prefix that clearly identifies the page, feature, panel, card, form, or reusable component.

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

Describe what the element means in the UI tree.

Good:

- `notice-form-message-input`
- `mission-row-edit-button`
- `dashboard-scoreboard-table-body`
- `map-image-settings-company-image-upload-button`

Avoid visual names:

- `blue-button`
- `left-column`
- `big-card`

### 3. Prefer predictable suffixes

Common suffixes that work well:

- containers: `page`, `content`, `section`, `panel`, `card`, `grid`, `list`, `table`, `table-head`, `table-body`, `row`, `header`, `footer`, `actions`
- form fields: `field`, `label`, `input`, `select`, `textarea`, `helper`
- states: `loading`, `load-error`, `submit-error`, `success`, `empty-state`, `warning`
- actions: `submit-button`, `save-button`, `delete-button`, `edit-button`, `close-button`, `reset-button`
- media: `image`, `video`, `preview`, `preview-image`, `preview-video`

### 4. Use kebab-case

Always prefer lowercase kebab-case:

- `settings-page`
- `settings-page-header`
- `settings-page-save-button`

Avoid:

- `settingsPage`
- `SettingsPage`
- `settings_page`

---

## Repeated items: keep the same ID shape

Inside loops or repeated renders, the same structural role should keep the same `data-ai-id`.

Good:

```tsx
{missions.map((mission) => (
  <tr key={mission.id} data-ai-id="mission-row">
    <button data-ai-id="mission-row-edit-button">Edit</button>
  </tr>
))}
```

Bad:

```tsx
{missions.map((mission, index) => (
  <tr data-ai-id={`mission-row-${mission.id}`}>
    <button data-ai-id={`mission-row-edit-button-${index}`}>Edit</button>
  </tr>
))}
```

Do **not** put these into `data-ai-id` unless the project explicitly requires it:

- random strings
- `Date.now()` values
- UUIDs
- database IDs
- slugs derived from mutable user content
- loop indexes

Use dynamic values for React `key`, internal logic, or API payloads instead.

---

## Reusable component prefixes are allowed

For reusable components, a stable prop-driven prefix is fine.

Good:

```tsx
<div data-ai-id={aiIdPrefix}>
  <label data-ai-id={`${aiIdPrefix}-label`} />
  <input data-ai-id={`${aiIdPrefix}-input`} />
  <button data-ai-id={`${aiIdPrefix}-submit-button`} />
</div>
```

This is appropriate only when `aiIdPrefix` itself is stable and semantic, such as:

- `map-image-settings-map-image`
- `map-image-settings-company-image`
- `mission-create-form`
- `mission-edit-form`

Avoid prefixes derived from random or per-item runtime data.

---

## Coverage rules

Annotate the parts of the UI that carry real navigation or workflow meaning.

Usually annotate:

- page roots and main content areas
- cards, sections, panels, tabs, drawers, dialogs, and modals
- lists, grids, tables, rows, and row sub-sections
- forms and important field groups
- labels, inputs, selects, textareas, helpers, and errors
- action groups and important buttons
- loading, empty, success, warning, and error states
- media containers and previews
- titles, summaries, and metadata blocks when they help navigation

Usually skip:

- purely decorative wrappers
- redundant nested spans with no structural meaning
- every typography-only node when a surrounding semantic container already exists

If unsure, prefer slightly more coverage in forms, dialogs, cards, tables, and action-heavy workflows.

---

## Recommended naming shapes

### Page-level

```tsx
<Page aiId="missions-page" />
```

Derived children:

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

### List or card-level

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
  );
}
```

---

## Repository convention used by this project

In this repository, the current convention is:

- use **`data-ai-id` only**
- keep names **feature-first and role-second**
- use **kebab-case**
- annotate meaningful popup and overlay structure
- allow repeated items to share the same ID when they represent the same semantic role

Examples from this repo include:

- `popup-page`
- `popup-toggle-button`
- `inspector-overlay-root`
- `notebook-panel`
- `notebook-panel-copy-button`
- `manual-test-tile-card`

The repeated card pattern in `examples/manual-test.html` intentionally reuses the same IDs across multiple cards.

---

## Editing checklist

Before merging a change, verify that:

- the attribute is `data-ai-id`, not another custom name
- names are kebab-case
- names are semantic and role-based
- repeated items do not include runtime identifiers
- reusable prefixes are stable and meaningful
- important controls and states are covered
- names match the surrounding feature vocabulary
- no unrelated refactor or style churn was introduced

---

## Practical review questions

When reviewing a new UI, ask:

- Can an AI agent identify the main workflow areas from these IDs?
- Would a QA engineer understand the structure without reading CSS classes?
- Are these names stable if the UI layout changes?
- Are repeated items modeled as repeated roles instead of unique runtime records?
- Did we tag the meaningful states and actions, not just the wrappers?

If the answer is mostly yes, the `data-ai-id` layer is probably doing its job.

---

## Summary

The best `data-ai-id` systems are:

- semantic
- stable
- boring in a good way
- easy to scan
- easy to reuse in prompts and tests

If you adopt one rule from this guide, make it this:

> Name UI by meaning and role, not by style or runtime identity.
