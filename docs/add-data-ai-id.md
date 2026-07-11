# Copy AI ID quick guide / 빠른 가이드

Copy AI ID works on rendered pages even when elements do not have `data-ai-id`. Adding stable semantic IDs simply gives copied requests and AI coding tools a more reliable target than a generated CSS selector or DOM path.

Copy AI ID는 요소에 `data-ai-id`가 없어도 렌더링된 페이지에서 동작합니다. 안정적인 semantic ID를 추가하면 생성된 CSS selector나 DOM 경로보다 복사한 요청과 AI 코딩 도구가 요소를 더 정확하게 찾을 수 있습니다.

## Basic workflow / 기본 사용 흐름

1. Open a page and press **Shift + Z + Space** (or turn the extension on from its popup).  
   페이지를 열고 **Shift + Z + Space**를 누르거나 확장 프로그램 팝업에서 켭니다.
2. Select an element in the preview and press **Space** to add an `el-N` chip to the note.  
   미리보기에서 요소를 선택하고 **Space**를 눌러 노트에 `el-N` chip을 추가합니다.
3. Add notes or preview-only visual edits.  
   노트를 작성하거나 preview-only visual edit을 적용합니다.
4. Press **Shift + Enter** or select **Copy** to copy the AI-ready Markdown.  
   **Shift + Enter** 또는 **복사**로 AI 친화적 Markdown을 복사합니다.

For the optional direct Codex connection, see the [English macOS setup guide](codex-setup.md) or [한국어 macOS 설정 가이드](codex-setup.ko.md).

## Recommended IDs / 권장 ID

Use stable, descriptive, deterministic kebab-case names. Follow an existing project convention first, distinguish sibling roles, and do not use timestamps, database IDs, random values, or array indexes.

안정적이고 의미가 분명한 deterministic kebab-case 이름을 사용하세요. 프로젝트의 기존 규칙을 먼저 따르고 sibling 역할을 구분하며 timestamp, database ID, random 값, 배열 index는 사용하지 마세요.

```html
<form data-ai-id="login-form">
  <label data-ai-id="login-form-email-field-label">Email</label>
  <input data-ai-id="login-form-email-field-input" />
  <button data-ai-id="login-form-submit-button">Sign in</button>
</form>
```

Repeated items may share a semantic ID when they represent the same component role; Copy AI ID records the selected instance separately. Prefer a truly unique semantic ID when each item has a distinct stable role.

반복 항목이 같은 컴포넌트 역할이라면 semantic ID를 공유할 수 있으며 Copy AI ID가 선택한 instance를 따로 기록합니다. 각 항목의 역할이 안정적으로 구분된다면 실제로 고유한 semantic ID를 권장합니다.
