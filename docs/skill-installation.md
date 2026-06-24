# Installing and Using the `add-data-ai-id` Skill

This repository includes a portable copy of the `add-data-ai-id` skill here:

- [`skills/add-data-ai-id/SKILL.md`](../skills/add-data-ai-id/SKILL.md)
- [`skills/add-data-ai-id/README.md`](../skills/add-data-ai-id/README.md)

It can be installed in both **Codex** and **Claude Code** because both tools use a `SKILL.md`-based skill format.

> Note: the Claude Code location and invocation rules below are based on Anthropic's official Claude Code skills documentation: <https://code.claude.com/docs/en/slash-commands>

For a Korean version of this guide, see [`docs/ko-skill-installation.md`](./ko-skill-installation.md).

---

## 1) Install in Codex

In this environment, personal Codex skills live under `~/.codex/skills/`.

### Personal install

```bash
mkdir -p ~/.codex/skills/add-data-ai-id
cp skills/add-data-ai-id/SKILL.md ~/.codex/skills/add-data-ai-id/SKILL.md
```

That is enough for normal usage. Then start a new Codex session.

Optional public reference examples:

```bash
mkdir -p ~/.codex/skills/add-data-ai-id/references
cp skills/add-data-ai-id/references/data-ai-id-pattern-examples.md ~/.codex/skills/add-data-ai-id/references/data-ai-id-pattern-examples.md
```

### How to use it in Codex

You can ask naturally, for example:

- `Use the add-data-ai-id skill on this form component.`
- `Add stable data-ai-id attributes to @src/components/LoginForm.tsx.`
- `Apply the add-data-ai-id convention to the checkout modal.`
- `Refine vague data-ai-id names across this dialog and keep the edits surgical.`

You can also invoke the skill more explicitly in Codex with:

```text
$add-data-ai-id @src/components/LoginForm.tsx
```

Expected behavior:

- Codex checks the repository's existing naming pattern first.
- If the repo already has a convention, it follows that convention.
- Otherwise, it applies the skill's default rules: semantic kebab-case names, meaningful coverage, and repeated items sharing the same stable ID shape.

---

## 2) Install in Claude Code

Claude Code supports both **personal** and **project** skills.

### Option A: personal skill

```bash
mkdir -p ~/.claude/skills/add-data-ai-id
cp skills/add-data-ai-id/SKILL.md ~/.claude/skills/add-data-ai-id/SKILL.md
```

This makes the skill available across all your Claude Code projects.

Optional public reference examples:

```bash
mkdir -p ~/.claude/skills/add-data-ai-id/references
cp skills/add-data-ai-id/references/data-ai-id-pattern-examples.md ~/.claude/skills/add-data-ai-id/references/data-ai-id-pattern-examples.md
```

### Option B: project-local skill

Run this from the project root:

```bash
mkdir -p .claude/skills/add-data-ai-id
cp skills/add-data-ai-id/SKILL.md .claude/skills/add-data-ai-id/SKILL.md
```

This makes the skill available only inside that repository.

Optional public reference examples:

```bash
mkdir -p .claude/skills/add-data-ai-id/references
cp skills/add-data-ai-id/references/data-ai-id-pattern-examples.md .claude/skills/add-data-ai-id/references/data-ai-id-pattern-examples.md
```

### How to use it in Claude Code

According to Anthropic's docs, the `name` field becomes the slash command. Since this skill uses:

```yaml
name: add-data-ai-id
```

You can invoke it directly like this:

```text
/add-data-ai-id @src/components/LoginForm.tsx
```

You can also ask for it in natural language, for example:

- `Use the add-data-ai-id skill on @src/components/LoginForm.tsx.`
- `Apply the add-data-ai-id convention to @src/features/settings.`
- `Add stable data-ai-id attributes to this modal and keep repeated items on the same shared id pattern.`

Because the skill includes a descriptive frontmatter block, Claude Code may also load it automatically when your request clearly matches the skill.

---

## 3) What the skill does

The skill is designed to:

- inspect the repository convention first
- preserve existing naming patterns when they exist
- use `data-ai-id` only
- prefer semantic kebab-case names
- annotate meaningful structure and actions
- keep repeated items on the same stable `data-ai-id` values
- avoid runtime identifiers such as indexes, UUIDs, timestamps, or database IDs

---

## 4) Recommended prompts

### Codex or Claude Code

- `Use the add-data-ai-id skill on @src/components/ProfileForm.tsx and follow the local naming convention.`
- `Add data-ai-id coverage to this page, but skip purely decorative wrappers.`
- `Refine the existing data-ai-id names to make them more semantic and stable.`
- `Apply the add-data-ai-id skill to the table and form areas only.`

### Strong Claude Code prompt examples

#### 1. Add IDs to a single form component

```text
/add-data-ai-id @src/components/LoginForm.tsx

Preserve the repository's existing naming convention.
Add `data-ai-id` only to meaningful structure, fields, and actions.
Do not add ids to decorative wrappers.
```

#### 2. Annotate a modal carefully

```text
/add-data-ai-id @src/components/DeleteAccountModal.tsx

Cover the modal root, title, description, actions, and primary/secondary buttons.
Keep names semantic and kebab-case.
Do not use runtime values inside `data-ai-id`.
```

#### 3. Focus only on repeated list items

```text
/add-data-ai-id @src/features/orders/components/OrderList.tsx

Focus on the repeated row structure and row actions only.
Make sure equivalent nodes inside the loop share the same stable id pattern.
Do not inject order ids or array indexes into `data-ai-id`.
```

#### 4. Refine existing weak names

```text
Use the add-data-ai-id skill on @src/features/settings/components/ProfileCard.tsx.

Refine existing `data-ai-id` values if they are vague, visual, or unstable.
Prefer feature-first, role-second naming.
Keep the edits surgical.
```

#### 5. Annotate only workflow-critical areas

```text
Use the add-data-ai-id skill on @src/pages/CheckoutPage.tsx.

Only annotate workflow-critical areas:
- page root
- address form
- payment section
- order summary
- submit actions
Skip purely visual wrappers.
```

#### 6. Introduce a reusable `aiId` prop if needed

```text
Use the add-data-ai-id skill on @src/components/FileUploadCard.tsx.

If this component is reused in multiple places, introduce a stable `aiId` or `aiIdPrefix` prop only if necessary.
Keep the API change minimal and derive child ids from that prefix.
```

#### 7. Migrate from testing-oriented selectors

```text
Use the add-data-ai-id skill on @src/features/team/components/TeamTable.tsx.

If the file uses `data-testid` for semantic UI navigation, migrate or complement it with `data-ai-id` where appropriate.
Match the local naming vocabulary.
Do not do unrelated refactors.
```

#### 8. Annotate state surfaces explicitly

```text
/add-data-ai-id @src/features/reporting/components/ReportPanel.tsx

Add coverage for meaningful UI states such as loading, empty, success, and error.
Make the ids useful for both browser automation and human inspection.
```

#### 9. Apply the skill to a directory with strict boundaries

```text
Use the add-data-ai-id skill on @src/features/missions.

Inspect the existing convention first.
Update only JSX/TSX markup that directly renders meaningful UI.
Do not rename unrelated variables, refactor logic, or touch styling.
Summarize the naming pattern you found before editing.
```

#### 10. Add IDs and explain the pattern used

```text
/add-data-ai-id @src/components/NotificationForm.tsx

Before editing, inspect nearby files for the repository's naming convention.
Then add stable `data-ai-id` attributes.
At the end, briefly explain:
1. the naming pattern you followed
2. which elements you intentionally skipped
3. whether any repeated items required special handling
```

### Good targeted prompt

```text
Use the add-data-ai-id skill on @src/features/missions/components/MissionListCard.tsx.
Match the repository's current naming convention.
Cover meaningful structure, fields, rows, actions, and states.
Do not use runtime values inside data-ai-id.
```

---

## 5) Included files

This repository includes:

```text
skills/
  add-data-ai-id/
    README.md
    SKILL.md
    references/
      data-ai-id-pattern-examples.md
```

The reference file is optional but useful because the skill mentions it as a source of concrete naming examples.
