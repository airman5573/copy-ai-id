# `add-data-ai-id` Skill Package

This directory contains a portable `SKILL.md` package for adding or refining stable `data-ai-id` attributes in HTML, JSX, TSX, and component markup.

It is intended for skill-based coding tools such as **Codex** and **Claude Code**. The skill preserves existing repository conventions when present, and otherwise falls back to semantic, deterministic, kebab-case naming rules.

---

## When to use this skill

Use this skill when you want to:

- add `data-ai-id` to new UI components
- refine vague or unstable `data-ai-id` values
- annotate forms, tables, modals, cards, dialogs, and repeated items
- make a frontend easier to navigate for AI agents and browser automation

---

## What the skill enforces

The skill is designed to:

- use `data-ai-id` only
- preserve local naming conventions first
- default to semantic kebab-case names
- annotate meaningful structure and actions
- keep repeated items on the same stable ID shape
- avoid indexes, UUIDs, database IDs, timestamps, or mutable user labels inside `data-ai-id`

---

## Included files

```text
add-data-ai-id/
  README.md
  SKILL.md
  references/
    data-ai-id-pattern-examples.md
```

- `README.md` — package-level overview
- `SKILL.md` — raw skill definition used by the tool
- `references/data-ai-id-pattern-examples.md` — generic naming examples referenced by the skill

---

## Installation

### Codex

```bash
mkdir -p ~/.codex/skills/add-data-ai-id
cp skills/add-data-ai-id/SKILL.md ~/.codex/skills/add-data-ai-id/SKILL.md
```

Optional reference examples:

```bash
mkdir -p ~/.codex/skills/add-data-ai-id/references
cp skills/add-data-ai-id/references/data-ai-id-pattern-examples.md ~/.codex/skills/add-data-ai-id/references/data-ai-id-pattern-examples.md
```

### Claude Code

Personal skill:

```bash
mkdir -p ~/.claude/skills/add-data-ai-id
cp skills/add-data-ai-id/SKILL.md ~/.claude/skills/add-data-ai-id/SKILL.md
```

Optional reference examples:

```bash
mkdir -p ~/.claude/skills/add-data-ai-id/references
cp skills/add-data-ai-id/references/data-ai-id-pattern-examples.md ~/.claude/skills/add-data-ai-id/references/data-ai-id-pattern-examples.md
```

Project-local skill:

```bash
mkdir -p .claude/skills/add-data-ai-id
cp skills/add-data-ai-id/SKILL.md .claude/skills/add-data-ai-id/SKILL.md
```

Optional reference examples:

```bash
mkdir -p .claude/skills/add-data-ai-id/references
cp skills/add-data-ai-id/references/data-ai-id-pattern-examples.md .claude/skills/add-data-ai-id/references/data-ai-id-pattern-examples.md
```

For the full guide, see [`../../docs/skill-installation.md`](../../docs/skill-installation.md).

---

## How to invoke it

### Claude Code slash command

```text
/add-data-ai-id @src/components/LoginForm.tsx
```

### Natural-language invocation

```text
Use the add-data-ai-id skill on @src/features/settings.
Preserve the existing naming convention.
```

### Codex explicit invocation

```text
$add-data-ai-id @src/components/LoginForm.tsx
```

---

## Example tasks

- annotate a form component
- annotate a modal or dialog
- add stable IDs to repeated rows without runtime values
- introduce an `aiId` or `aiIdPrefix` prop only when necessary
- refine weak names to follow feature-first, role-second naming

---

## Non-goals

This skill:

- is a naming and markup skill, not a full testing framework
- does not invent random IDs
- does not force a repo-wide refactor unless you request one
- prefers small, surgical edits

---

## See also

- [`../../docs/add-data-ai-id.md`](../../docs/add-data-ai-id.md) — public convention guide
- [`../../docs/skill-installation.md`](../../docs/skill-installation.md) — full setup and usage guide
- [`../../docs/ko-skill-installation.md`](../../docs/ko-skill-installation.md) — Korean setup and usage guide
- [`./SKILL.md`](./SKILL.md) — raw skill definition
