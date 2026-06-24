# `add-data-ai-id` 스킬 설치 및 사용법

이 저장소에는 바로 가져다 쓸 수 있는 `add-data-ai-id` 스킬 패키지가 들어 있습니다.

- [`skills/add-data-ai-id/SKILL.md`](../skills/add-data-ai-id/SKILL.md)
- [`skills/add-data-ai-id/README.md`](../skills/add-data-ai-id/README.md)

이 스킬은 **Codex**와 **Claude Code** 둘 다에서 사용할 수 있습니다. 두 도구 모두 `SKILL.md` 기반의 스킬 형식을 사용하기 때문입니다.

> 참고: 아래 Claude Code 관련 경로와 호출 방식은 Anthropic 공식 Claude Code skills 문서를 기준으로 정리했습니다: <https://code.claude.com/docs/en/slash-commands>

---

## 1) Codex에 설치하기

현재 환경 기준으로 개인 Codex 스킬은 `~/.codex/skills/` 아래에 설치합니다.

### 개인 전역 설치

```bash
mkdir -p ~/.codex/skills/add-data-ai-id
cp skills/add-data-ai-id/SKILL.md ~/.codex/skills/add-data-ai-id/SKILL.md
```

보통은 이 정도면 충분합니다. 설치 후에는 새 Codex 세션을 시작하는 것이 좋습니다.

선택 사항으로 공개용 예시 reference도 같이 넣을 수 있습니다.

```bash
mkdir -p ~/.codex/skills/add-data-ai-id/references
cp skills/add-data-ai-id/references/data-ai-id-pattern-examples.md ~/.codex/skills/add-data-ai-id/references/data-ai-id-pattern-examples.md
```

### Codex에서 사용하는 방법

자연어로 이렇게 요청하면 됩니다.

- `Use the add-data-ai-id skill on this form component.`
- `Add stable data-ai-id attributes to @src/components/LoginForm.tsx.`
- `Apply the add-data-ai-id convention to the checkout modal.`

또는 Codex에서는 `$`를 붙여 더 명시적으로 호출할 수도 있습니다.

```text
$add-data-ai-id @src/components/LoginForm.tsx
```

Codex는 보통 다음 순서로 동작합니다.

- 먼저 저장소 안의 기존 네이밍 규칙을 확인합니다.
- 이미 강한 규칙이 있으면 그 규칙을 따릅니다.
- 규칙이 없으면 스킬 기본 규칙을 적용합니다.
  - semantic kebab-case
  - 의미 있는 구조와 액션 위주로 부여
  - 반복 항목은 같은 ID shape 유지
  - index, UUID, DB id, timestamp 같은 런타임 값 금지

---

## 2) Claude Code에 설치하기

Claude Code는 **개인 전역 스킬**과 **프로젝트 로컬 스킬** 둘 다 지원합니다.

### 방법 A: 개인 전역 스킬

```bash
mkdir -p ~/.claude/skills/add-data-ai-id
cp skills/add-data-ai-id/SKILL.md ~/.claude/skills/add-data-ai-id/SKILL.md
```

이 방식은 모든 Claude Code 프로젝트에서 사용할 수 있습니다.

선택 사항으로 공개용 예시 reference도 같이 넣을 수 있습니다.

```bash
mkdir -p ~/.claude/skills/add-data-ai-id/references
cp skills/add-data-ai-id/references/data-ai-id-pattern-examples.md ~/.claude/skills/add-data-ai-id/references/data-ai-id-pattern-examples.md
```

### 방법 B: 프로젝트 로컬 스킬

프로젝트 루트에서 다음을 실행합니다.

```bash
mkdir -p .claude/skills/add-data-ai-id
cp skills/add-data-ai-id/SKILL.md .claude/skills/add-data-ai-id/SKILL.md
```

이 방식은 해당 저장소 안에서만 스킬이 활성화됩니다.

선택 사항으로 공개용 예시 reference도 같이 넣을 수 있습니다.

```bash
mkdir -p .claude/skills/add-data-ai-id/references
cp skills/add-data-ai-id/references/data-ai-id-pattern-examples.md .claude/skills/add-data-ai-id/references/data-ai-id-pattern-examples.md
```

---

## 3) Claude Code에서 사용하는 방법

이 스킬은 frontmatter에 다음과 같이 정의되어 있습니다.

```yaml
name: add-data-ai-id
```

Claude Code 공식 문서 기준으로 `name` 값이 slash command가 되므로, 다음처럼 직접 호출할 수 있습니다.

```text
/add-data-ai-id @src/components/LoginForm.tsx
```

자연어로 요청해도 됩니다.

- `Use the add-data-ai-id skill on @src/components/LoginForm.tsx.`
- `Apply the add-data-ai-id convention to @src/features/settings.`
- `Add stable data-ai-id attributes to this modal and keep repeated items on the same shared id pattern.`

설명이 잘 맞는 경우에는 Claude Code가 스킬을 자동으로 불러올 수도 있습니다.

---

## 4) 추천 프롬프트 예시

### 1. 단일 폼 컴포넌트에 추가

```text
/add-data-ai-id @src/components/LoginForm.tsx

Preserve the repository's existing naming convention.
Add `data-ai-id` only to meaningful structure, fields, and actions.
Do not add ids to decorative wrappers.
```

### 2. 모달에 신중하게 적용

```text
/add-data-ai-id @src/components/DeleteAccountModal.tsx

Cover the modal root, title, description, actions, and primary/secondary buttons.
Keep names semantic and kebab-case.
Do not use runtime values inside `data-ai-id`.
```

### 3. 반복 리스트 항목만 집중적으로 처리

```text
/add-data-ai-id @src/features/orders/components/OrderList.tsx

Focus on the repeated row structure and row actions only.
Make sure equivalent nodes inside the loop share the same stable id pattern.
Do not inject order ids or array indexes into `data-ai-id`.
```

### 4. 약한 이름만 다듬기

```text
Use the add-data-ai-id skill on @src/features/settings/components/ProfileCard.tsx.

Refine existing `data-ai-id` values if they are vague, visual, or unstable.
Prefer feature-first, role-second naming.
Keep the edits surgical.
```

### 5. 핵심 워크플로우 영역만 태깅

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

### 6. 필요할 때만 `aiIdPrefix` 도입

```text
Use the add-data-ai-id skill on @src/components/FileUploadCard.tsx.

If this component is reused in multiple places, introduce a stable `aiId` or `aiIdPrefix` prop only if necessary.
Keep the API change minimal and derive child ids from that prefix.
```

### 7. `data-testid`와 함께 정리

```text
Use the add-data-ai-id skill on @src/features/team/components/TeamTable.tsx.

If the file uses `data-testid` for semantic UI navigation, migrate or complement it with `data-ai-id` where appropriate.
Match the local naming vocabulary.
Do not do unrelated refactors.
```

### 8. 상태 UI도 명시적으로 추가

```text
/add-data-ai-id @src/features/reporting/components/ReportPanel.tsx

Add coverage for meaningful UI states such as loading, empty, success, and error.
Make the ids useful for both browser automation and human inspection.
```

### 9. 디렉터리 단위로 범위를 제한해서 적용

```text
Use the add-data-ai-id skill on @src/features/missions.

Inspect the existing convention first.
Update only JSX/TSX markup that directly renders meaningful UI.
Do not rename unrelated variables, refactor logic, or touch styling.
Summarize the naming pattern you found before editing.
```

### 10. 어떤 규칙을 따랐는지 설명까지 요청

```text
/add-data-ai-id @src/components/NotificationForm.tsx

Before editing, inspect nearby files for the repository's naming convention.
Then add stable `data-ai-id` attributes.
At the end, briefly explain:
1. the naming pattern you followed
2. which elements you intentionally skipped
3. whether any repeated items required special handling
```

---

## 5) 함께 들어 있는 파일

```text
skills/
  add-data-ai-id/
    README.md
    SKILL.md
    references/
      data-ai-id-pattern-examples.md
```

- `README.md`: 스킬 패키지 개요
- `SKILL.md`: 실제 스킬 정의 파일
- `references/data-ai-id-pattern-examples.md`: 공개용 네이밍 예시 참고 자료

더 자세한 영문 설명은 [`docs/skill-installation.md`](./skill-installation.md)에서 확인할 수 있습니다.
