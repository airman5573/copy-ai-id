# macOS에서 Codex로 바로 보내기 설정

[English](codex-setup.md)

Copy AI ID는 추가 프로그램 없이도 AI 친화적인 요청을 **복사**할 수 있습니다. 선택 기능인 **Codex로 보내기** 버튼을 사용하려면 Mac에 작은 companion 서비스가 추가로 필요합니다. Chrome 확장 프로그램은 로컬 프로그램을 직접 실행할 수 없으므로, companion이 사용자 전용 macOS LaunchAgent로 실행되며 사용자가 명시적으로 보낸 요청을 로그인된 Codex CLI에 전달합니다.

> **지원 운영체제:** 현재 companion 설정은 macOS만 지원합니다. Companion이 없어도 지원되는 Chrome 페이지에서 에디터와 **복사** 기능은 계속 사용할 수 있습니다.

## 시작 전 준비

다음 항목이 필요합니다.

| 준비 항목 | 확인 방법 | 없을 때 할 일 |
| --- | --- | --- |
| macOS | Apple 메뉴 → **이 Mac에 관하여** | Windows와 Linux companion 설정은 아직 지원하지 않습니다. |
| Copy AI ID | Chrome에서 확장 프로그램 열기 | [프로젝트 README](../README.ko.md)의 링크에서 설치합니다. |
| Node.js 18 이상(최신 LTS 권장) | `node --version` | Node.js를 설치 또는 업데이트하고 Terminal과 Codex를 다시 연 뒤 재확인합니다. |
| 호환되는 비대화형 exec 기능을 갖춘 OpenAI Codex CLI | `codex --version`, `codex exec --help` | [Codex CLI 공식 가이드](https://learn.chatgpt.com/docs/codex/cli)를 따르고, 설정 모달에 exec 옵션 미지원이 표시되면 CLI를 업데이트합니다. |
| 인증된 Codex 세션 | `codex login status` | `codex login`을 실행하고 로그인을 완료합니다. |
| Git | `git --version` | macOS 개발자 command-line tools 또는 신뢰할 수 있는 Git 배포판을 설치합니다. |
| `lsof` | `/usr/sbin/lsof -v` | `lsof`는 일반적으로 macOS에 포함되어 있습니다. localhost 프로젝트 감지를 사용하기 전에 복구합니다. |

이 저장소를 clone하거나 `npm install`을 실행할 필요는 없습니다. 설정 Skill이 의존성 없는 companion 런타임을 사용자 Library 폴더에 복사합니다.

## 권장 설정: Codex가 설정 Skill을 사용하게 하기

1. Mac에서 Codex를 엽니다. 터미널 앱을 사용한다면 먼저 `codex`를 실행합니다.
2. Copy AI ID 에디터를 열고 상단 툴바의 **Codex 설정** 또는 노트 패널의 **설정 도움말**을 선택합니다.
3. **프롬프트 복사**를 누르고 Codex에 붙여넣은 뒤 작업이 끝날 때까지 기다립니다. 이 프롬프트는 같은 공개 저장소의 확장 릴리스와 일치하는 [`setup-copy-ai-id-codex` Skill](https://github.com/airman5573/copy-ai-id/tree/v0.1.13/skills/setup-copy-ai-id-codex)을 안내합니다.
4. Copy AI ID로 돌아와 **다시 확인**을 선택합니다. 모든 readiness 검사를 통과하고 다른 전송 작업이 없을 때만 Codex 전송 버튼이 활성화됩니다.

아래 bootstrap 프롬프트를 직접 복사해도 됩니다.

```text
$skill-installer를 사용해서 GitHub 저장소 airman5573/copy-ai-id의 skills/setup-copy-ai-id-codex 경로에서 Skill을 ref v0.1.13로 고정해서 설치해줘(main 또는 latest를 사용하지 마). 설치기에 --ref v0.1.13를 전달하거나 아래의 릴리스 고정 Skill 소스 URL을 사용해줘. 대상 Skill이 이미 있으면 설치 전에 활성 Skill 디렉터리 밖의 임시 위치로 백업하고, setup 또는 status가 실패하면 복원하며 status 성공 후에만 백업을 삭제해줘. 설치 후 실제 Skill 폴더를 찾아 SKILL.md를 읽고, 같은 작업 안에서 setup.sh와 status.sh를 bash로 실행해줘. macOS companion이 로그인 시 시작되도록 설정하고 readiness를 보고해줘. 새 Skill metadata가 다음 turn부터 적용되더라도 멈추지 말고 설치된 파일을 직접 사용해줘.

Skill source: https://github.com/airman5573/copy-ai-id/tree/v0.1.13/skills/setup-copy-ai-id-codex
Readiness endpoint: http://127.0.0.1:45130/health
```

이 가이드는 Copy AI ID `0.1.13`용입니다. 확장 프로그램이 만드는 프롬프트는 자체 manifest 버전에서 `v0.1.13`을 계산하므로 변경되는 `main` 브랜치를 설치하지 않습니다. 버전 고정 소스 URL은 일치하는 GitHub 릴리스/tag가 게시되면 열립니다.

Shell preflight는 파일을 변경하기 전에 macOS, Node.js, Codex CLI 실행 가능 여부, `codex login status`, Git, `lsof`를 확인합니다. 그다음 staged companion이 설치를 확정하기 전에 필요한 `codex exec --help` 기능을 확인하고, 실패하면 이전 설치로 rollback합니다. 기능 probe는 로컬 도움말·기능 metadata만 읽으며 Codex agent를 시작하거나 인증된 네트워크 요청을 만들지 않습니다. 준비되지 않은 항목이 있으면 Codex가 알려준 문제를 해결하고 설정을 다시 실행합니다.

새로 설치한 Skill을 재시작 후 사용할 수 있다고 Codex가 안내하면 Codex를 다시 시작한 뒤 “`$setup-copy-ai-id-codex`를 사용해서 macOS companion을 설정하고, 로그인 시 시작되도록 한 뒤 readiness를 보고해줘.”라고 요청하세요.

## 설치되는 항목

Skill은 다음 작업을 수행합니다.

1. Companion 런타임을 `~/Library/Application Support/Copy AI ID Codex`에 복사합니다.
2. `~/Library/LaunchAgents/com.copy-ai-id.codex-server.plist`를 작성합니다.
3. `com.copy-ai-id.codex-server`라는 사용자 전용 LaunchAgent를 등록합니다.
4. Companion을 즉시 시작하고, 로그인 후 다시 시작하며, 프로세스가 종료되면 재시작하도록 설정합니다.
5. 서비스에 연결할 수 있고 준비가 완료될 때까지 `http://127.0.0.1:45130/health`를 확인합니다.

사용자 단위 설치이므로 `sudo`가 필요하지 않고 브라우저 native-messaging host를 설치하지 않으며 설정 과정에서 사용자의 프로젝트를 수정하지 않습니다. 설정 Skill은 상태 확인·시작·업데이트·제거에도 사용합니다. 확장 프로그램의 요청을 실제로 받는 것은 Skill이 아니라 companion 서비스입니다.

## 확장 프로그램에서 Codex로 보내기 사용

### 지원되는 페이지

바로 보내기는 다음 페이지만 로컬 프로젝트에 연결할 수 있습니다.

- **localhost 개발 서버 페이지:** `http://localhost:...`, `https://localhost:...`, `127.0.0.1`, IPv6 loopback 페이지. Companion은 `lsof`로 수신 포트와 로컬 프로세스의 작업 폴더를 연결한 뒤, 상위로 탐색해 가장 가까운 `.git` 폴더 또는 `package.json`이 있는 실제 프로젝트 루트를 사용합니다. 개발 서버를 계속 실행하고 의도한 프로젝트 내부에서 시작하세요. 프로젝트 마커가 없으면 수신 프로세스의 작업 폴더를 대신 사용하지만, Git이나 Codex를 실행하기 전에 사용자가 해당 경로를 검토하고 확인해야 합니다.
- **로컬 파일:** `file:///...` 페이지. Companion은 파일 위치부터 위로 탐색하여 가장 가까운 `.git` 폴더 또는 `package.json`을 찾습니다. 먼저 Chrome 확장 프로그램 세부정보에서 **파일 URL에 대한 액세스 허용**을 켜세요.

일반 원격 웹사이트에서도 Copy AI ID 에디터와 **복사**는 사용할 수 있지만, 원격 URL을 로컬 프로젝트 폴더와 안전하게 연결할 수 없으므로 Codex 바로 보내기는 지원하지 않습니다. Companion은 기본적으로 macOS 홈 폴더 밖의 프로젝트를 거부하며 파일시스템 루트나 홈 폴더 전체를 프로젝트로 사용하지 않습니다.

### 연결 상태

Copy AI ID는 에디터를 시작할 때, 창이 다시 활성화될 때, 열려 있는 동안 주기적으로, 그리고 사용자가 **다시 확인**을 선택할 때 companion을 검사합니다.

| 확장 프로그램 상태 | 의미 | 할 일 |
| --- | --- | --- |
| **Codex 설정 확인 중…** | 로컬 companion을 확인하고 있습니다. | 잠시 기다립니다. 전송 버튼은 비활성화 상태입니다. |
| **전송 준비 완료** | Companion이 응답했고 모든 도구·인증 검사를 통과했습니다. | **Codex로 보내기**를 사용합니다. |
| **Codex 작업 중** | 다른 Copy AI ID Codex 실행이 진행 중입니다. | 완료될 때까지 기다립니다. 두 번째 실행은 시작되지 않습니다. |
| **Companion 관리 작업 중** | 설치·업데이트·복구·제거 작업이 maintenance lock을 보유하고 있습니다. | 작업이 끝날 때까지 기다립니다. 필수 항목 실패로 잘못 표시하지 않고 전송만 비활성화합니다. |
| **Companion 연결 안 됨** | `127.0.0.1:45130`에서 호환되는 서비스가 응답하지 않았습니다. | **Codex 설정**을 열고 설정 또는 시작을 실행한 뒤 **다시 확인**을 선택합니다. |
| **설정 미완료** | Companion은 응답했지만 프로토콜이 확장과 일치하지 않거나 Node, Codex 비대화형 exec 지원, 인증, Git, `lsof` 중 일부가 준비되지 않았습니다. | 일치하는 companion 릴리스를 설치하거나 설정 모달에 표시된 실패 항목을 해결한 뒤 **다시 확인**을 선택합니다. |

실제 `disabled` 상태인 전송 버튼은 모달을 열 수 없으므로, 상단 툴바와 노트 패널에 각각 별도의 **Codex 설정**/**설정 도움말** 버튼이 제공됩니다.

### 전송하면 일어나는 작업

프로젝트 감지 후 `.git`/`package.json` 마커가 있는 프로젝트 루트는 즉시 시작할 수 있습니다. 마커가 없는 localhost 작업 폴더나 로컬 파일 폴더는 자동으로 신뢰하지 않으며, Copy AI ID가 경로를 표시하고 사용자의 확인을 기다립니다. 그 다음 companion은:

1. 아직 Git 저장소가 아니면 Git을 초기화하고 기본 `.gitignore`를 만듭니다.
2. 기존 미커밋 작업을 로컬 안전 스냅샷으로 커밋합니다.
3. 해당 프로젝트에서 workspace-write sandbox로 `codex exec`를 실행하며, 설치된 CLI가 `fast_mode`를 지원한다고 확인된 경우에만 fast service tier를 사용합니다.
4. 성공한 Codex 실행의 변경 사항을 커밋합니다.

확인하기 전에 감지된 프로젝트를 검토하세요. 성공하면 Copy AI ID가 전송한 노트와 visual edit을 비웁니다. 실행이 실패하거나 시간 초과되면 요청을 수동으로 붙여넣을 수 있도록 클립보드 fallback을 남깁니다.

## Companion 관리

서비스를 관리하는 가장 쉬운 방법은 Codex에 `$setup-copy-ai-id-codex`를 사용해 달라고 요청하는 것입니다. Companion ZIP을 받았다면 압축을 푼 폴더에서 같은 이름의 `.command` 파일을 사용합니다.

| 작업 | Codex에 요청 | Companion ZIP |
| --- | --- | --- |
| 상태와 readiness 확인 | “`$setup-copy-ai-id-codex`를 사용해서 Copy AI ID companion 상태를 확인하고 실패 항목을 설명해줘.” | `Status.command`를 엽니다. |
| 시작 또는 재시작 | “`$setup-copy-ai-id-codex`를 사용해서 Copy AI ID companion을 시작하고 readiness를 확인해줘.” | `Start.command`를 엽니다. |
| 업데이트 | “내 확장 버전과 일치하는 릴리스 tag에서 Copy AI ID 설정 Skill을 설치한 뒤 `$setup-copy-ai-id-codex`로 companion을 업데이트하고 확인해줘.” | 확장 버전과 일치하는 ZIP을 받은 뒤 `Update.command`를 엽니다. |
| 제거 | “`$setup-copy-ai-id-codex`를 사용해서 Copy AI ID companion을 제거해줘.” | `Uninstall.command`를 엽니다. |

업데이트 스크립트는 현재 사용 중인 Skill 또는 ZIP에 포함된 런타임을 설치하며 자동 네트워크 업데이트를 수행하지 않습니다. 업데이트하기 전에 확장 버전과 일치하는 tag의 Skill 또는 ZIP을 준비하고, `main`이나 `latest`만 독립적으로 따라가지 마세요. 제거는 LaunchAgent와 설치된 companion 런타임을 삭제하지만 Chrome, Copy AI ID, Codex CLI, Codex 계정, 다운로드한 ZIP, 프로젝트 파일은 삭제하지 않습니다.

이 저장소를 checkout한 상태라면 같은 작업을 다음 스크립트로 실행할 수 있습니다.

```bash
bash skills/setup-copy-ai-id-codex/scripts/status.sh
bash skills/setup-copy-ai-id-codex/scripts/start.sh
bash skills/setup-copy-ai-id-codex/scripts/update.sh
bash skills/setup-copy-ai-id-codex/scripts/uninstall.sh
```

Skill 스크립트는 `bash`로 실행하세요. GitHub에서 받은 압축 파일은 실행 권한 비트를 보존하지 않을 수 있습니다.

## Companion ZIP 수동 설치

Codex가 GitHub에서 Skill을 설치할 수 없거나 다운로드한 번들을 직접 사용하고 싶다면 이 방법을 사용합니다.

1. 이 가이드와 확장 빌드에 일치하는 [Copy AI ID v0.1.13 릴리스](https://github.com/airman5573/copy-ai-id/releases/tag/v0.1.13)를 엽니다.
2. `copy-ai-id-codex-companion-0.1.13-macos.zip`을 받습니다. 이 단계에서 Chrome Web Store ZIP을 받지 마세요.
3. ZIP 압축을 풉니다. `SETUP_PROMPT.md`, 설정 Skill과 런타임, `Setup.command`, `Start.command`, `Status.command`, `Update.command`, `Uninstall.command`가 들어 있습니다.
4. 다음 중 한 가지 방식으로 설정합니다.
   - `SETUP_PROMPT.md`를 열어 프롬프트를 Codex에 붙여넣고, Codex가 동봉된 `skills/setup-copy-ai-id-codex/SKILL.md`를 읽도록 합니다.
   - `Setup.command`를 직접 엽니다. 인터넷에서 받은 스크립트에 대해 macOS가 확인을 요청하면 공식 `airman5573/copy-ai-id` 릴리스에서 받은 파일인지 확인한 뒤 허용합니다.
5. 설정이 준비 완료를 보고하면 확장 프로그램의 **Codex 설정** 모달로 돌아가 **다시 확인**을 선택합니다.

Finder에서 `.command` 파일을 열 수 없다면 Terminal에서 압축을 푼 파일 경로를 Bash에 전달합니다.

```bash
bash "/압축을/푼/경로/Setup.command"
```

## 문제 해결

### Codex 버튼이 계속 비활성화되어 있음

무조건 재설치하기 전에 **Codex 설정**을 열고 상태를 확인하세요.

- **Codex 설정 확인 중…:** 잠시 기다린 뒤 **다시 확인**을 선택합니다.
- **Companion 연결 안 됨:** Skill 또는 `Start.command`로 시작하고 상태를 확인합니다.
- **설정 미완료:** 실패 항목이 **Companion 호환성**이면 확장 버전과 일치하는 companion 릴리스를 설치합니다. 그 외에는 표시된 준비 항목을 해결합니다. 인증 문제라면 `codex login status`를 실행하고, 필요하면 `codex login` 후 다시 확인합니다.
- **Codex 작업 중:** 현재 실행이 끝날 때까지 기다립니다.

### Codex 또는 다른 도구를 찾지 못함

새 Terminal 창에서 다음 명령을 실행합니다.

```bash
node --version
codex --version
codex exec --help
codex login status
git --version
/usr/sbin/lsof -v
```

`codex exec --help`에 필요한 비대화형 옵션이 없다면 Codex CLI를 업데이트하세요. Terminal에서는 명령이 성공하지만 readiness 검사는 실패한다면 Skill로 LaunchAgent를 업데이트/재시작하여 현재 실행 파일 경로를 반영하고, Copy AI ID에서 **다시 확인**을 선택합니다. `fast_mode` 지원만 없는 경우에는 readiness가 실패하지 않으며 companion이 standard service tier를 사용합니다.

### Companion에는 연결되지만 페이지의 프로젝트를 찾지 못함

- localhost에서는 개발 서버가 해당 URL 포트에서 계속 수신 중인지, 의도한 프로젝트 폴더에서 시작했는지 확인합니다.
- `file://`에서는 파일이 실제로 존재하는지 확인하고 Chrome에서 Copy AI ID의 **파일 URL에 대한 액세스 허용**을 켭니다.
- 로컬 페이지를 사용하세요. 운영 중인 `https://example.com/...` URL로는 Mac의 폴더를 식별할 수 없습니다.
- 고급 설정인 `COPY_AI_ID_ALLOW_OUTSIDE_HOME=1`을 의도적으로 사용하지 않는 한 프로젝트를 홈 폴더 안에 둡니다.

### 45130 포트를 이미 사용 중임

설정 Skill에 상태 확인과 포트를 사용하는 프로세스 식별을 요청하세요. 공개 확장 프로그램은 `127.0.0.1:45130`을 사용하므로 포트를 바꾸기보다 이전 Copy AI ID companion을 중지하는 방식을 권장합니다.

### Readiness는 통과하지만 실행이 실패함

툴바 Codex 버튼 아래의 작업 로그를 확인합니다. 감지된 프로젝트에 쓸 수 있는지, Git이 커밋을 만들 수 있는지, Codex 계정 인증이 유지되는지, 실행 제한 시간 안에 처리할 수 있는 요청인지 확인합니다. 전송을 완료하지 못하면 Copy AI ID가 프롬프트를 fallback으로 복사합니다.

LaunchAgent 로그는 다음 위치에 저장됩니다.

```text
~/Library/Application Support/Copy AI ID Codex/logs/stdout.log
~/Library/Application Support/Copy AI ID Codex/logs/stderr.log
```

## 보안과 개인정보

- Companion은 `127.0.0.1`에만 바인딩되므로 LAN이나 공개 인터넷에 노출되지 않습니다.
- `/health`는 companion 프로토콜 버전 `1`을 보고합니다. 이 버전이 일치하지 않으면 확장 프로그램이 전송을 비활성화하고 **Companion 호환성**을 표시합니다.
- Copy AI ID의 정확한 client marker를 요구하고 공개 확장 프로그램 origin과 문서화된 안정적 개발 빌드만 허용합니다. 이 marker는 비밀번호가 아닌 프로토콜 확인 수단이며, loopback 바인딩과 확장 origin 제한이 주된 네트워크 경계입니다.
- 프로젝트 symlink의 실제 경로를 확인하고 파일시스템 루트와 전체 홈 폴더를 거부하며, 고급 outside-home override를 의도적으로 켜지 않는 한 실제 홈 경로 안의 프로젝트만 허용합니다.
- Mac의 로컬 프로세스는 loopback 서비스에 접근할 수 있으므로 이 공개 저장소 또는 공식 릴리스에서만 companion을 설치하고 Mac 계정을 안전하게 관리하세요.
- Readiness 세부정보는 도구 상태만 보고하며 인증 정보는 반환하지 않습니다.
- Companion이 실행 중이라는 이유만으로 아무것도 전송하지 않습니다. 사용자가 **Codex로 보내기**를 명시적으로 선택하고 필요한 프로젝트 확인을 승인한 뒤에만 프로젝트에 접근합니다.
- 로컬 companion은 사용자의 노트를 Copy AI ID 서버로 업로드하지 않습니다. 실행이 시작되면 설치된 Codex CLI가 기존 Codex 인증과 설정을 사용하여 OpenAI와 통신합니다. Codex의 데이터·계정 동작은 [Codex CLI 공식 가이드](https://learn.chatgpt.com/docs/codex/cli)를 확인하세요.
- Companion은 위에서 설명한 로컬 Git 스냅샷/커밋 작업을 수행합니다. 기존 백업을 유지하고 자동 실행 후에는 항상 변경 사항을 검토하세요.
