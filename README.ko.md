# Copy AI ID

**Chrome Web Store에서 설치하기:**  
<https://chromewebstore.google.com/detail/opodkffbpbkjjechadlpogecbmlbmkgi?utm_source=item-share-cb>

[English](README.md)

Copy AI ID는 렌더링된 페이지를 위한 `data-ai-id` 우선 Chrome 확장 에디터입니다. 현재 탭에서 켜면 전체 화면 Shadow DOM 에디터가 열리고, 레이아웃 트리·반응형 iframe 미리보기·preview-only visual editing 컨트롤·도킹/플로팅 전환이 가능한 노트 패널로 AI 코딩 도구에 전달할 UI 수정 노트를 만들 수 있습니다. 선택한 요소는 노트북에 compact한 `el-N` chip으로 들어가며, `data-ai-id`가 있는 요소는 안정적인 reference로 매핑되고 없는 요소도 생성된 fallback target으로 선택하고 visual editing 할 수 있습니다.

## 에디터 사용 흐름

1. 렌더링된 페이지를 엽니다. 의미 있는 `data-ai-id`가 있으면 가장 안정적이지만, ID가 없거나 일부만 있는 페이지에서도 fallback 선택이 동작합니다.
2. **Shift + Z + Space**를 누르거나 확장 프로그램 팝업에서 **켜기**를 클릭합니다.
3. 현재 탭 위에 전체 화면 에디터가 열립니다.
   - **왼쪽 — 레이아웃 트리:** 구조 파악을 위한 전체 DOM 계층을 보여주며, 모든 DOM 행은 키보드로 이동/선택할 수 있습니다. `data-ai-id`가 있는 행은 안정적인 chip target으로, 없는 행은 fallback metadata가 있으면 fallback chip target으로 추가됩니다.
   - **가운데 — 미리보기:** 현재 URL에 `copy-ai-id-preview=1` 쿼리 마커를 붙인 iframe 미리보기와 breakpoint 버튼, 확대/축소, 맞춤/초기화 컨트롤, hover quick-action bar, floating visual control panel을 제공합니다.
   - **노트 패널 — 도킹 또는 플로팅:** 선택한 안정적인 `data-ai-id` target 또는 생성된 fallback target에 대한 Lexical 기반 노트 draft를 작성합니다. Target은 compact한 `el-N` chip으로 표시됩니다. Preview-only visual edit 지시는 편집 중에는 숨겨지고 복사한 Markdown에만 포함됩니다.
4. 미리보기, 레이아웃 트리, 키보드로 DOM 노드를 선택합니다.
5. **Space**를 누르면 `el-1` 같은 notebook chip이 추가되고 노트 패널에 포커스됩니다. Copy AI ID는 chip target에 `data-ai-id`를 먼저 사용합니다. 선택한 노드에 사용할 수 있는 `data-ai-id`가 없으면 긴 selector/path/context 텍스트를 에디터에 노출하지 않고 fallback metadata를 chip에 저장합니다. 플로팅 NotePanel 모드에서는 **Space**를 누르는 순간 먼저 선택/hover된 요소 근처에 노트 패널을 열고, 패널에 포커스한 뒤 chip을 삽입합니다. Chip을 클릭하면 연결된 미리보기 요소가 다시 선택/강조됩니다. Chip 번호는 삭제 후에도 재번호 매김하지 않으므로 draft에 `el-1`, `el-3`, `el-4`가 함께 있을 수 있습니다.
6. 필요하면 미리보기 요소를 hover해서 quick-action bar를 엽니다. Category 버튼은 콘텐츠, 레이아웃, 간격, 크기, 스타일, 선 floating visual panel을 열고, 구조 버튼은 preview 안에서 요소를 복제/위아래 이동/삭제/드래그 이동합니다. 이 변경은 preview-only mutation이며 AI가 이해하기 좋은 visual edit 지시로 기록됩니다.
7. **Shift + Enter**를 누르거나 **복사** 버튼을 클릭하면 `## Requests`, `## Targets`, `## Rules`, 필요한 경우 `## Visual edits` 섹션으로 정리된 AI 친화적 Markdown이 클립보드에 복사됩니다. Inline chip은 읽기 쉬운 `@el-N` mention으로 표시되고, fallback target은 selector/path/context 정보를 함께 제공하며, visual edit은 사람이 읽는 요약과 machine-readable JSON diff를 함께 포함합니다.
8. 툴바 닫기 버튼, **Esc**, 또는 **Shift + Z + Space**로 에디터를 끕니다.

동일한 `data-ai-id`가 여러 번 나오면 각 인스턴스를 따로 표시하고 인스턴스 배지와 중복 경고를 붙여 실제 선택된 DOM 노드가 모호하지 않도록 합니다.

일부 사이트는 `X-Frame-Options` 또는 `frame-ancestors` CSP로 iframe 삽입을 차단합니다. Copy AI ID는 에디터 안에 해당 상태를 표시하지만 사이트 정책을 우회할 수는 없습니다.

## 노트 패널 모드

상단 툴바에는 설정이 저장되는 **노트 플로팅** 토글이 있습니다.

- **Floating OFF:** 노트 패널이 기존처럼 오른쪽 editor column에 도킹됩니다. Hover가 제한적인 mobile/touch workflow에서는 이 모드가 가장 예측 가능합니다.
- **Floating ON:** 오른쪽 노트 column을 숨기고, 현재 선택/hover target 근처에 floating NotePanel overlay를 엽니다. Desktop에서 요소를 hover한 뒤 **Space**를 눌러 그 요소 바로 옆에 노트를 작성할 때 유용합니다.

## Preview-only visual editing

Visual editing은 실제 source를 바로 저장하는 기능이 아니라, AI와 사용자 사이에서 정확한 구현 prompt를 만드는 인터페이스입니다. Inspect 중인 페이지, 프로젝트 source, CMS, 원격 서비스에는 저장하지 않습니다.

- 미리보기 요소를 hover하면 quick-action bar가 표시됩니다. 마우스가 요소에서 toolbar로 이동해도 toolbar를 누를 수 있도록 유지됩니다.
- Category 버튼을 누르면 floating visual panel이 열립니다. Desktop에서는 선택 요소/toolbar를 따라가고, mobile/tablet breakpoint에서는 preview iframe 옆에 배치됩니다.
- 첫 지원 category는 **콘텐츠**, **레이아웃**, **간격**, **크기**, **스타일**, **선**입니다. 콘텐츠 컨트롤은 텍스트, rich HTML fragment, 안전한 링크/속성, form value를 수정할 수 있고, 스타일 컨트롤은 preview에서 즉시 보이도록 DOM/inline style을 바꿉니다.
- 구조 컨트롤은 preview DOM 안에서 복제, 위/아래 이동, 삭제, 드래그 이동을 수행합니다. 이것도 모두 preview-only 작업입니다.
- `data-ai-id`가 없는 요소도 fallback target metadata로 visual editing 할 수 있습니다. 복사 결과에는 이 target이 덜 안정적이라는 안내와 selector/path/context가 포함되어, AI나 개발자가 source에서 다시 식별할 수 있습니다.
- Visual edit prompt text는 편집 중 화면에 직접 표시하지 않습니다. 노트 패널에는 상태/개수만 보이고, **복사**할 때 `## Visual edits` 섹션에 사람이 읽는 요약과 fenced JSON diff가 붙습니다.
- 복사가 성공하면 visible notebook draft와 accumulated visual edit record가 함께 비워집니다. Reset도 이 editor record를 비우지만, 이미 preview DOM에 적용한 mutation을 되돌리지는 않습니다. 원래 렌더링 상태로 돌아가려면 preview를 reload/reopen하세요.

## 단축키

| 단축키 | 동작 |
| --- | --- |
| **Shift + Z + Space** | Copy AI ID 에디터 켜기/끄기 |
| **ArrowUp** | 이전/왼쪽 레이아웃 트리 형제로 이동; 없으면 부모로 이동 |
| **ArrowRight** | 다음/오른쪽 형제로 이동; 없으면 조상 노드의 다음/오른쪽 형제로 올라간 뒤 그 branch의 첫 자식으로 진입 |
| **ArrowLeft** | 이전/왼쪽 형제로 이동; 없으면 조상 노드의 이전/왼쪽 형제로 올라간 뒤 그 branch의 가장 깊은 마지막 자식으로 진입 |
| **ArrowDown** | 첫 자식으로 이동; 없으면 다음/오른쪽 형제 또는 가장 가까운 조상 노드의 다음/오른쪽 형제로 이동 |
| **Space** | 선택 노드를 compact한 `el-N` chip으로 추가/포커스합니다. 플로팅 NotePanel 모드에서는 선택/hover된 요소 근처에 패널을 열고 포커스한 뒤 chip을 삽입합니다. Chip은 안정적인 `data-ai-id` target을 우선 사용하고, 없으면 가능한 경우 생성된 fallback target을 저장합니다. |
| **Shift + Enter** | 현재 노트 전체를 suffix와 함께 복사 |
| **Esc** | 상황에 따라 선택 해제 또는 에디터 닫기/끄기 |

키보드 이동은 `data-ai-id`가 있는 대상만이 아니라 레이아웃 트리의 모든 DOM 노드를 따라 이동합니다. **Space**는 계속 `data-ai-id`를 우선 사용하며, ID가 없는 노드는 덜 안정적인 fallback chip으로 연결합니다.

편집 가능한 필드에 입력 중이거나 IME 조합 중일 때는 단축키를 가로채지 않습니다. 단, 노트북 안의 **Shift + Enter**는 현재 노트북을 복사합니다.

## `data-ai-id`란 무엇인가요?

`data-ai-id`는 AI 도구, 브라우저 자동화, QA 리뷰어, 유지보수 담당자가 UI 요소를 정확히 지정할 수 있도록 해주는 안정적인 semantic HTML 속성입니다.

```html
<button data-ai-id="login-form-submit-button">Sign in</button>
```

## 마크업에 `data-ai-id` 추가하기

`data-ai-id`는 프로젝트의 HTML, JSX, TSX, 컴포넌트 마크업에 안정적인 semantic ID가 있을 때 가장 잘 동작합니다. AI 코딩 어시스턴트에게 기존 프로젝트의 ID 규칙을 먼저 따르도록 요청하고, 규칙이 없다면 다음과 같은 deterministic parent-child kebab-case ID를 사용하세요.

```html
<form data-ai-id="login-form">
  <label data-ai-id="login-form-email-field-label">Email</label>
  <input data-ai-id="login-form-email-field-input" />
  <button data-ai-id="login-form-submit-button">Sign in</button>
</form>
```

## 로컬 개발 빌드

```bash
npm install
npm run build
```

그 다음 `chrome://extensions`를 열고 **Developer mode**를 켠 뒤 **Load unpacked**에서 이 저장소의 `dist/` 디렉터리를 선택합니다.

## 로컬 파일 접근

로컬 HTML 파일을 디스크에서 직접 열면 Chrome은 해당 페이지를 `file://` 페이지로 처리합니다.

```text
file:///Users/you/project/page.html
```

Chrome은 해당 확장 프로그램에 파일 접근 권한을 켜지 않는 한 확장 프로그램이 `file://` 페이지를 읽는 것을 차단합니다.

해결 방법:

1. `chrome://extensions`를 엽니다.
2. **Copy AI ID**를 찾습니다.
3. **Details**를 클릭합니다.
4. **Allow access to file URLs**를 켭니다.


## 제품 범위

Copy AI ID는 이제 에디터 전용입니다. Codex 사이드패널, native messaging host, AI 채팅, 히스토리, 설정 화면, 원격 prompt 전송, analytics, 원격 AI 처리는 포함하지 않습니다. 노트와 preview-only visual edit 지시는 사용자가 명시적으로 **복사**를 누르거나 **Shift + Enter**를 눌렀을 때만 클립보드에 기록됩니다.
