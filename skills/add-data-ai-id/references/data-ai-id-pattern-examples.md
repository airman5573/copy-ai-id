# `data-ai-id` Pattern Examples

Use this reference when you want concrete examples of stable, semantic `data-ai-id` naming.

These examples are intentionally generic and safe for public reuse.

## 1. Page root with derived child ids

Pattern:

- root: `settings-page`
- header: `settings-page-header`
- title: `settings-page-title`
- header actions: `settings-page-header-actions`
- content: `settings-page-content`

This works well for page shells and top-level feature screens.

## 2. Repeated rows keep the same id

Examples inside `items.map(...)`:

- `mission-row`
- `mission-row-name`
- `mission-row-edit-button`
- `mission-row-delete-button`

Use React `key` or framework-specific identity separately, but keep `data-ai-id` stable.

## 3. Repeated buttons keep the same id

Examples inside repeated button groups:

- `team-selector-team-button`

Do not append item numbers or indexes unless the repository explicitly requires it.

## 4. Reusable component with stable prefix prop

Examples:

- root: `aiIdPrefix`
- field: `${aiIdPrefix}-field`
- label: `${aiIdPrefix}-label`
- input: `${aiIdPrefix}-input`
- select button: `${aiIdPrefix}-select-button`
- upload button: `${aiIdPrefix}-upload-button`
- preview image: `${aiIdPrefix}-preview-image`

Used with stable prefixes such as:

- `profile-image-field`
- `company-logo-field`
- `checkout-address-form`

## 5. Reusable component with generic `aiId`

Examples:

- `${aiId}-label`
- `${aiId}-content`
- `${aiId}-title`
- `${aiId}-description`
- `${aiId}-image`
- `${aiId}-empty`

This works well for cards, previews, and option blocks.

## 6. Thorough form coverage

Examples:

- `notice-form`
- `notice-form-fields`
- `notice-form-team-field`
- `notice-form-team-label`
- `notice-form-team-input`
- `notice-form-message-field`
- `notice-form-message-label`
- `notice-form-message-input`
- `notice-form-actions`
- `notice-form-submit-button`
- `notice-form-error`
- `notice-form-success`

This is a good default level of coverage for important forms.

## 7. Table and status coverage

Common naming shapes:

- `results-table-container`
- `results-table`
- `results-table-head`
- `results-table-body`
- `results-row`
- `results-empty-row`
- `results-empty-state`
- `results-error`

## 8. State labels are explicit

Examples:

- `settings-load-error`
- `upload-delete-error`
- `profile-success`
- `timer-controls-error`
- `mission-list-loading`

Annotate transient UI states, not just permanent structure.

## 9. Deprecated patterns not used here

Avoid introducing these unless a target repository explicitly requires them:

- `data-semantic-id`
- `semanticId`

Prefer `data-ai-id` as the primary semantic selector attribute.
