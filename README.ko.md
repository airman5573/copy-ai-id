# Copy AI ID

**Chrome Web Store에서 설치하기:**  
<https://chromewebstore.google.com/detail/opodkffbpbkjjechadlpogecbmlbmkgi?utm_source=item-share-cb>

[English](README.md)

Copy AI ID는 렌더링된 페이지를 위한 `data-ai-id` 우선 Chrome 확장 에디터입니다. 현재 탭에서 켜면 전체 화면 Shadow DOM 에디터가 열리고, 반응형 iframe 미리보기·preview-only visual editing 컨트롤·플로팅 노트 패널로 AI 코딩 도구에 전달할 UI 수정 노트를 만들 수 있습니다. 선택한 요소는 노트북에 compact한 `el-N` chip으로 들어가며, `data-ai-id`가 있는 요소는 안정적인 reference로 매핑되고 없는 요소도 생성된 fallback target으로 선택하고 visual editing 할 수 있습니다.

## 에디터 사용 흐름

1. 렌더링된 페이지를 엽니다. 의미 있는 `data-ai-id`가 있으면 가장 안정적이지만, ID가 없거나 일부만 있는 페이지에서도 fallback 선택이 동작합니다.
2. **Shift + Z + Space**를 누르거나 확장 프로그램 팝업에서 **켜기**를 클릭합니다.
3. 현재 탭 위에 전체 화면 에디터가 열립니다.
   - **미리보기:** 현재 URL에 `copy-ai-id-preview=1` 쿼리 마커를 붙인 iframe 미리보기와 breakpoint 버튼, 확대/축소, 맞춤/초기화 컨트롤, 클릭으로 고정하는 퀵 편집 툴바, floating visual panel을 제공합니다.
   - **플로팅 노트 패널:** 선택한 안정적인 `data-ai-id` target 또는 생성된 fallback target에 대한 Lexical 기반 노트 draft를 작성합니다. Target은 compact한 `el-N` chip으로 표시됩니다. Preview-only visual edit 지시는 편집 중에는 숨겨지고 복사한 Markdown에만 포함됩니다.
4. 미리보기 또는 키보드로 DOM 노드를 선택합니다.
5. **Space**를 누르면 `el-1` 같은 notebook chip이 추가되고 노트 패널에 포커스됩니다. Copy AI ID는 chip target에 `data-ai-id`를 먼저 사용합니다. 선택한 노드에 사용할 수 있는 `data-ai-id`가 없으면 긴 selector/path/context 텍스트를 에디터에 노출하지 않고 fallback metadata를 chip에 저장합니다. **Space**를 누르는 순간 먼저 선택/hover된 요소 근처에 플로팅 노트 패널을 열고, 패널에 포커스한 뒤 chip을 삽입합니다. Chip을 클릭하면 연결된 미리보기 요소가 다시 선택/강조됩니다. Chip 번호는 삭제 후에도 재번호 매김하지 않으므로 draft에 `el-1`, `el-3`, `el-4`가 함께 있을 수 있습니다.
6. 필요하면 미리보기 요소를 클릭해서 퀵 편집 툴바를 그 요소에 고정합니다. 툴바 1행은 요소의 intent(image / text / container / link-button / form)에 맞춰 구성되고, 2행은 공통으로 패딩/마진/간격 스테퍼, 구조 버튼(복제·이동·삭제), 드래그 그립, floating visual panel을 여는 **기타** 버튼을 제공합니다. 수치 편집은 `+/-` 스테퍼로만 하며, preview에는 실제 px가 반영되고 export에는 "현재 값 대비 n% 증감" 의도로 기록됩니다. 텍스트 요소는 더블클릭으로 인라인 편집할 수 있습니다. 이 변경은 preview-only mutation이며 AI가 이해하기 좋은 visual edit 지시로 기록됩니다.
7. **Shift + Enter**를 누르거나 **복사** 버튼을 클릭하면 `## Requests`, `## Targets`, `## Rules`, 필요한 경우 `## Visual edits` 섹션으로 정리된 AI 친화적 Markdown이 클립보드에 복사됩니다. Inline chip은 읽기 쉬운 `@el-N` mention으로 표시되고, fallback target은 selector/path/context 정보를 함께 제공하며, visual edit은 사람이 읽는 요약과 machine-readable JSON diff를 함께 포함합니다.
8. 툴바 닫기 버튼, **Esc**, 또는 **Shift + Z + Space**로 에디터를 끕니다.

동일한 `data-ai-id`가 여러 번 나오면 각 인스턴스를 따로 표시하고 인스턴스 배지와 중복 경고를 붙여 실제 선택된 DOM 노드가 모호하지 않도록 합니다.

일부 사이트는 `X-Frame-Options` 또는 `frame-ancestors` CSP로 iframe 삽입을 차단합니다. Copy AI ID는 에디터 안에 해당 상태를 표시하지만 사이트 정책을 우회할 수는 없습니다.

## 플로팅 노트 패널

노트북은 플로팅 패널 overlay로 제공됩니다.

- 선택/hover된 요소 위에서 **Space**를 누르면 그 요소 바로 옆에 패널이 열리고 chip이 삽입됩니다.
- 상단 툴바의 **노트** 버튼으로 요소 선택 없이도 패널을 열고 닫을 수 있습니다. 이때는 preview 프레임 근처의 기본 위치에 나타납니다.
- 상단 툴바에는 **복사** 버튼도 있어서, 노트 텍스트 없이 visual edit만 한 세션도 노트 패널을 열지 않고 바로 복사할 수 있습니다.
- 패널의 컨트롤 행에는 breakpoint 스코프 버튼, Tailwind 토글, 복사 공지(notice) 다이얼로그, 초기화, **Shift + Enter** 힌트, 복사 버튼이 있습니다.

## Preview-only visual editing

Visual editing은 실제 source를 바로 저장하는 기능이 아니라, AI와 사용자 사이에서 정확한 구현 prompt를 만드는 인터페이스입니다. Inspect 중인 페이지, 프로젝트 source, CMS, 원격 서비스에는 저장하지 않습니다.

- 미리보기 요소를 클릭하면 퀵 편집 툴바가 그 요소에 고정됩니다. 다른 요소를 클릭하면 툴바가 옮겨가고, 페이지 배경을 클릭하거나 **Esc**를 누르면 닫힙니다. Hover는 요소 하이라이트만 하며 툴바를 열지 않습니다.
- 툴바와 floating visual panel은 모두 에디터 Shadow DOM에 있습니다. preview bridge는 고정 중에 anchor 좌표와 요소 intent만 스트리밍합니다.
- 툴바 1행은 요소 intent에 맞춰 구성됩니다 — 이미지는 교체/크기/object-fit/라운드, 텍스트는 글자 크기/굵기/색/정렬, 컨테이너는 간격/flex/배경 컨트롤을 얻습니다. 2행은 공통: 패딩/마진/간격 스코프 팝오버, 복제/이동/삭제, 드래그 그립, **기타** 버튼.
- 수치 속성은 `+/-` 스테퍼로만 편집합니다(첫 스텝 시점 값 기준 클릭당 ±10%). preview에는 실제 px가 반영되고, export에는 기준값과 함께 % 의도가 기록되어 source가 쓰는 단위(rem, px, % 등)로 환산해 적용할 수 있습니다.
- preview의 텍스트 요소를 더블클릭하면 인라인으로 텍스트를 편집합니다. **Enter**/blur는 정규 text mutation 파이프라인으로 커밋하고 **Esc**는 취소합니다.
- **기타** 버튼은 floating visual panel을 엽니다. 접이식 섹션 단일 스크롤(이미지 intent 요소는 이미지 섹션이 최상단)로 툴바가 다루지 않는 나머지 — 레이아웃, 크기 제약, 타이포 확장, 효과(opacity/shadow/filter/transform 프리셋), 테두리 상세, 콘텐츠/속성/폼 값 — 를 다룹니다. Desktop에서는 선택 요소를 따라가고, mobile/tablet breakpoint에서는 preview iframe 옆에 배치됩니다.
- 구조 컨트롤은 preview DOM 안에서 복제, 위/아래 이동, 삭제, 드래그 이동을 수행합니다. 이것도 모두 preview-only 작업입니다.
- `data-ai-id`가 없는 요소도 fallback target metadata로 visual editing 할 수 있습니다. 복사 결과에는 이 target이 덜 안정적이라는 안내와 selector/path/context가 포함되어, AI나 개발자가 source에서 다시 식별할 수 있습니다.
- Visual edit prompt text는 편집 중 화면에 직접 표시하지 않습니다. 노트 패널에는 상태/개수만 보이고, **복사**할 때 `## Visual edits` 섹션에 사람이 읽는 요약과 fenced JSON diff가 붙습니다.
- 복사가 성공하면 visible notebook draft와 accumulated visual edit record가 함께 비워집니다. Reset도 이 editor record를 비우지만, 이미 preview DOM에 적용한 mutation을 되돌리지는 않습니다. 원래 렌더링 상태로 돌아가려면 preview를 reload/reopen하세요.

## 단축키

| 단축키 | 동작 |
| --- | --- |
| **Shift + Z + Space** | Copy AI ID 에디터 켜기/끄기 |
| **ArrowUp** | 이전/왼쪽 DOM 형제로 이동; 없으면 부모로 이동 |
| **ArrowRight** | 다음/오른쪽 형제로 이동; 없으면 조상 노드의 다음/오른쪽 형제로 올라간 뒤 그 branch의 첫 자식으로 진입 |
| **ArrowLeft** | 이전/왼쪽 형제로 이동; 없으면 조상 노드의 이전/왼쪽 형제로 올라간 뒤 그 branch의 가장 깊은 마지막 자식으로 진입 |
| **ArrowDown** | 첫 자식으로 이동; 없으면 다음/오른쪽 형제 또는 가장 가까운 조상 노드의 다음/오른쪽 형제로 이동 |
| **Space** | 선택 노드를 compact한 `el-N` chip으로 추가/포커스합니다. 선택/hover된 요소 근처에 플로팅 노트 패널을 열고 포커스한 뒤 chip을 삽입합니다. Chip은 안정적인 `data-ai-id` target을 우선 사용하고, 없으면 가능한 경우 생성된 fallback target을 저장합니다. |
| **Shift + Enter** | 현재 노트 전체를 suffix와 함께 복사 |
| **Esc** | 상황에 따라 선택 해제 또는 에디터 닫기/끄기 |

키보드 이동은 `data-ai-id`가 있는 대상만이 아니라 미리보기의 모든 DOM 노드를 따라 이동합니다. **Space**는 계속 `data-ai-id`를 우선 사용하며, ID가 없는 노드는 덜 안정적인 fallback chip으로 연결합니다.

편집 가능한 필드에 입력 중이거나 IME 조합 중일 때는 단축키를 가로채지 않습니다. 단, 노트북 안의 **Shift + Enter**는 현재 노트북을 복사합니다.

## Codex로 전송 (선택, 로컬 전용)

에디터는 **복사** 버튼이 만드는 것과 동일한 Markdown을 클립보드를 거치지 않고 내 컴퓨터의 [OpenAI Codex CLI](https://github.com/openai/codex)로 바로 보낼 수 있습니다.

1. 이 저장소에서 로컬 서버를 실행하고 터미널을 켜둡니다:

   ```bash
   npm run codex-server        # 또는 scripts/start-codex-server.sh
   ```

2. **localhost 개발 서버 페이지**나 **file:// 페이지**에서 에디터를 열고 **Codex** 버튼(상단 툴바 또는 노트 패널)을 클릭합니다.
3. 서버가 페이지의 로컬 프로젝트를 자동 감지합니다 — localhost 페이지는 포트를 개발 서버 프로세스의 작업 디렉터리로 매핑하고, `file://` 페이지는 가장 가까운 `.git`/`package.json`까지 상위 탐색합니다. 감지가 확실하면 즉시 실행되며(토스트로 프로젝트 경로 표시), 마커 없이 폴더만 추정한 불확실한 경우에만 확인 다이얼로그를 먼저 보여줍니다.
4. 실행이 시작되면 서버가:
   - 프로젝트에 저장소가 없으면 `git init`(기본 `.gitignore` 포함)을 먼저 수행하고,
   - 기존 미커밋 변경이 있으면 `auto-commit: <타임스탬프>`로 먼저 커밋한 뒤,
   - 프로젝트 안에서 `codex exec`를 실행하고(workspace-write 샌드박스, 기본 타임아웃 5분),
   - Codex의 변경을 `codex: <요청 첫 줄>`로 커밋합니다.
5. Codex가 작업하는 동안 툴바 Codex 버튼 바로 아래에 실시간 작업 로그가 열립니다 — reasoning 요약, 실행한 명령, 수정한 파일이 실시간으로 흘러나오고, 실행이 끝나면 몇 초 뒤 자동으로 닫힙니다.
6. 성공하면 복사와 동일하게 노트 드래프트와 visual edit이 초기화됩니다. 실패하거나 시간 초과되면 프롬프트를 클립보드에 대신 복사해 수동으로 붙여넣을 수 있게 합니다.

Codex 버튼 옆의 reasoning 선택기로 Codex가 얼마나 깊게 생각할지 조절할 수 있습니다(low/medium/high; 기본 medium — 복잡한 작업은 high로). 선택은 세션 간에 유지됩니다.

모든 동작은 내 컴퓨터 안에서만 일어납니다: 서버는 `127.0.0.1`에만 바인딩되며 일반 웹페이지가 붙일 수 없는 요청 헤더를 요구합니다. 환경 변수: `CODEX_BIN`, `COPY_AI_ID_CODEX_SERVER_PORT`(기본 45130), `COPY_AI_ID_CODEX_TIMEOUT_MS`(기본 300000), `COPY_AI_ID_CODEX_REASONING`(기본 `medium`), `COPY_AI_ID_CODEX_MODEL`(선택적 모델 지정), `COPY_AI_ID_ALLOW_OUTSIDE_HOME=1`.

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

Copy AI ID는 에디터 우선 제품입니다. Codex 사이드패널, native messaging host, AI 채팅, 히스토리, 설정 화면, analytics, 원격 AI 처리는 포함하지 않습니다. 노트와 preview-only visual edit 지시는 사용자가 명시적으로 복사(**복사** / **Shift + Enter**)하거나 **Codex로 전송** 실행을 명시적으로 확인했을 때만 에디터 밖으로 나가며, 선택적 Codex 경로는 사용자가 직접 실행한 로컬 `127.0.0.1` 서버와만 통신합니다 — 원격 서비스로는 아무것도 전송되지 않습니다.
