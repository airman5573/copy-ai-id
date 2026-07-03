# Implementation Checklist — Quick Toolbar & Visual Panel Redesign

## Objective
- Quick-action 툴바를 preview iframe(브리지) 순수 DOM에서 **에디터(React/Shadow DOM) 쪽 플로팅 레이어**로 재구축하고, 선택 요소의 **의도(intent) 기반**으로 컨트롤이 재구성되게 한다 (image / text / container / link-button / form, 복수 intent 허용·image 우선).
- 수치 편집은 전부 **`+/-` 스테퍼(% 의도 모델)**로 통일: 프리뷰에는 실제 px 반영, export/prompt에는 "현재 대비 n% 증가/감소" 의도로 누적 기록. 숫자 직접 입력 UI 제거.
- 텍스트 내용 수정은 **프리뷰 더블클릭 인라인 편집**으로 전환.
- FloatingVisualPanel은 **"툴바에 없는 것 모음집"**으로 재정의: 탭 제거, intent 기반 접이식 섹션 단일 스크롤, 이미지 전용 섹션 신설, 구구절절 설명 전부 제거, 다크 유지 + 대비/액센트 강화, 브레이크포인트 배지·responsive 점 표시 제거(export의 viewport scope 규칙은 유지).
- Tailwind class 직접 편집, 자동완성 CSS 에디터는 **범위 제외**.

## Assumptions
- 스테퍼 1클릭 = 기준값(base, 해당 속성의 첫 스텝 시점 computed 값) 대비 **±10% 가산(additive)**. n클릭 = ±(n×10)%. 프리뷰 반영값 = `base × (1 + percent/100)` px (소수 1자리 반올림, 0 미만 clamp).
- 기준값이 0/none인 속성의 첫 `+` 스텝은 시드값 사용: padding/margin/gap `4px`, border-radius `2px`, border-width `1px`. opacity는 %p 단위(±10%p, 0–100 clamp).
- 현재값 표시는 스테퍼 옆에 **computed px**로 심플 표기, 뮤테이션 결과 스냅샷으로 갱신. authored 단위 역환산/CSSOM 스캔은 하지 않는다(사용자 결정으로 폐기).
- intent별 툴바 1행 구성(사용자 위임에 따른 확정안):
  - **image**: 이미지 교체(src/alt 팝오버) · W/H(auto/full/fit 키워드 + 스테퍼) · object-fit 세그먼트 · radius 스테퍼
  - **text**: font-size 스테퍼 · weight 세그먼트(400/500/600/700) · color 스와치 팝오버 · text-align 세그먼트
  - **container**: gap 스테퍼 · flex 방향/justify/align 세그먼트 · background-color 스와치 · radius 스테퍼
  - **link-button**: background-color · text color · radius 스테퍼 · font-size 스테퍼 · href 편집 팝오버
  - **form**: placeholder 편집 팝오버 · width(키워드+스테퍼) · font-size 스테퍼 · radius 스테퍼
  - 복수 intent 시 우선순위 `image > form > link-button > text > container` 순으로 1행에 이어붙이고, 중복 컨트롤은 1회만.
- 툴바 2행(모든 intent 공통): `Padding · Margin · Gap`(각각 전체/좌우/위아래/개별 스코프 팝오버) | 복제 · 위로 · 아래로 · 삭제 | 드래그 그립(⠿) | `기타`(패널 열기).
- 색상은 프리셋 팔레트 + 커스텀 피커(기존 ColorInput 재사용/간소화), 이산값(text-align, object-fit 등)은 세그먼트 버튼 — 사용자 위임 사항.
- 노출 트리거는 현행 유지: hover는 하이라이트만, **클릭(pin) 시 풀 툴바** 표시.
- export 본문 문자열은 현행처럼 영어 리터럴 유지, UI 문자열은 i18n en+ko 동시 추가(CLAUDE.md 규칙).
- 최종 브라우저 확인(examples/ 픽스처 수동 테스트)은 사람이 수행한다. 체크리스트 완료 조건에 포함하지 않는다.

## Risks
- **iframe 내부 스크롤 시 앵커 드리프트**: 현재 브리지→에디터로 rect 연속 스트림이 없음(브리지 툴바가 rAF로 자가 배치). Phase 2의 rAF 앵커 스트림이 누락되면 에디터 툴바가 어긋난다.
- **스텝 연타 코얼레싱과 undo의 상호작용**: 기존 undo는 record 단위 역방향 메시지(visualUndo.ts). 누적 record의 `before`가 최초 base를 유지해야 undo 1회로 원상복구된다.
- **더블클릭 contenteditable**: React 등 프레임워크가 관리하는 페이지에서 재렌더로 편집 내용이 덮일 수 있음 — preview-only 특성상 허용, 커밋 시점에 previousValue로 되돌린 뒤 정규 뮤테이션 경로로 재적용해 기록 일관성 확보.
- **프로토콜 제거 범위가 넓음**: category/section-jump 관련 메시지·스토어·가드가 여러 파일에 걸쳐 있어 제거 시 누락 참조가 생기기 쉬움 — 마지막 정리 Phase에서 일괄 제거 후 typecheck로 확인.
- `dist/`는 빌드 산출물로 재생성됨(기존 관행상 별도 커밋). 이 계획의 커밋 단위에는 포함하지 않는다.

## Unresolved Issues
- None

## Checklist

### Phase 1 - Shared 도메인·프로토콜 기반 작업
- [x] `ElementIntent` 타입과 판별 규칙 상수 추가
  - Files/areas: `src/shared/domain/targets.ts`(또는 신규 `src/shared/domain/intent.ts`)
  - Notes: `'image'|'text'|'container'|'link-button'|'form'` 유니온 + 우선순위 배열 `INTENT_PRIORITY`. 판별 규칙(문서화): image=`img|svg|picture`+computed background-image≠none / text=제목·p·span·a 등 텍스트 태그 또는 직접 텍스트 노드 보유 / container=display flex|grid 또는 자식 요소 보유 블록 / link-button=`a[href]|button|[role=button]|input[type=button|submit|reset]` / form=`input|textarea|select|[contenteditable]`. 복수 보유 허용.
  - Parallelizable: yes
- [x] 프로토콜 확장: 앵커 메시지에 intent·재배치 사유 추가, 인라인 텍스트 편집 커밋 메시지 신설
  - Files/areas: `src/shared/protocol/editor-bridge-messages.ts`, `src/shared/protocol/guards.ts`
  - Notes: `QuickActionAnchorChangedMessage`에 `intents: ElementIntent[]` 필드와 `reason: 'repositioned'` 추가. 신규 Bridge→Editor `inlineTextEditCommitted`(`copy-ai-id:inline-text-edit-committed`, payload `{target, nodeId, value, previousValue}`). guards의 direction별 type 집합에 반영. 기존 category/드래그 trio 메시지는 이 단계에서 **삭제하지 않는다**(Phase 7에서 일괄 제거).
  - Parallelizable: yes
- [x] `VisualTargetSnapshot`에 `intents` 필드 추가 + 스테퍼용 computed 속성 커버리지 확인
  - Files/areas: `src/shared/domain/visual.ts`, `src/shared/visual-style.ts`(`VISUAL_STYLE_COMPUTED_PROPERTIES`)
  - Notes: 툴바가 쓰는 font-size/weight/align/color/background-color/padding·margin 4방향/gap/border-radius/width/height/object-fit/opacity가 computed 서브셋에 포함되는지 확인하고 누락분 추가.
  - Parallelizable: yes
- [x] visual-edits 데이터 모델에 % 의도(intent) 확장 + export 버전 승격
  - Files/areas: `src/shared/visual-edits.ts`
  - Notes: `VisualStyleDeclarationDiff`/`VisualStyleDeclarationState`에 선택 필드 `intent?: { percent: number; base: string }` 추가(스테퍼 편집에만 채움). `VISUAL_EDITS_EXPORT_VERSION`을 `2`로 승격. 색상/세그먼트/attribute 편집은 기존 구체값 기록 유지.
  - Parallelizable: yes

### Phase 2 - 브리지: intent 판별·앵커 스트림·스냅샷·더블클릭 편집
- [ ] intent 분류기 모듈 신설
  - Files/areas: 신규 `src/content/editor-bridge/element-intent.ts`
  - Notes: Phase 1 규칙 구현 `classifyElementIntents(element): ElementIntent[]`(우선순위 정렬 반환). 확장 소유 요소 제외(`isExtensionOwnedElement`).
  - Parallelizable: yes
- [ ] pin 시 intent 포함 앵커 발신 + pin 유지 중 rAF 앵커 rect 스트림
  - Files/areas: `src/content/editor-bridge/highlight.ts`
  - Notes: `syncPinnedQuickActionToolbar`에서 `quickActionAnchorChanged` payload에 `intents` 포함. pin 상태 동안 capture-phase scroll/resize → rAF throttle로 `reason:'repositioned'` 앵커 메시지 발신(요소 disconnect 시 clear). 기존 브리지 툴바 `showQuickActionToolbar` 호출은 Phase 3 전환 항목에서 제거하므로 여기선 유지.
  - Parallelizable: no (앞 항목 의존)
- [ ] 스냅샷 직렬화에 intents 포함
  - Files/areas: `src/content/editor-bridge/visual-target-snapshot.ts`
  - Notes: `classifyElementIntents` 호출 결과를 스냅샷에 실어 에디터가 툴바 구성·현재값·형제 유무(move 버튼 disable)를 스냅샷 하나로 판단하게 한다.
  - Parallelizable: yes
- [ ] 프리뷰 더블클릭 인라인 텍스트 편집 모듈 신설
  - Files/areas: 신규 `src/content/editor-bridge/inline-text-edit.ts`, `src/content/editor-bridge/index.ts`(리스너 설치/해제), `src/content/editor-bridge/highlight.ts`(편집 중 hover/pin 억제)
  - Notes: 대상 조건 = text intent 보유 && form/media 요소 아님. dblclick → `contenteditable='plaintext-only'`(미지원 브라우저는 `true`+paste plain화) + 원본 `textContent` 보관. Enter/blur = 커밋: 요소를 previousValue로 **되돌린 뒤** `inlineTextEditCommitted{value, previousValue}` 발신(실제 적용·기록은 에디터가 정규 `updateVisualText` 뮤테이션으로 재수행 → 기존 record/undo 파이프라인 재사용). Escape = 원복 후 취소. 편집 중 keyboard.ts 단축키 무시 가드.
  - Parallelizable: yes

### Phase 3 - 에디터: React 퀵 툴바 구축·전환
- [ ] 셀렉션 스토어에 intents 반영 + pin 즉시 스냅샷 요청
  - Files/areas: `src/editor/stores/useVisualSelectionStore.ts`, `src/editor/bridge/bridgeClient.ts`(`handleQuickActionAnchorChanged`)
  - Notes: `activeToolbarTarget`에 `intents` 저장. `reason:'pinned'` 수신 시 `requestVisualTargetSnapshot` 즉시 발신(현재는 category 클릭 후에만 요청). `reason:'repositioned'`는 elementRect/editorRect만 갱신(스냅샷 재요청 없음).
  - Parallelizable: no
- [ ] 공용 스테퍼 UI 컴포넌트 신설
  - Files/areas: 신규 `src/editor/components/visual/StepperControl.tsx`, 신규 `src/editor/utils/stepperMath.ts`
  - Notes: `[-] 16px [+]` 형태. props: label/현재 computed 값/step 콜백. `stepperMath`: base 캡처, ±10% 가산, 시드값(Assumptions 참조), opacity %p 모드, 결과 px 계산·clamp. 길게 눌러 반복은 구현하지 않음(클릭 단위 유지).
  - Parallelizable: yes
- [ ] 공용 세그먼트·팝오버·색상 스와치 컴포넌트 신설
  - Files/areas: 신규 `src/editor/components/quick-toolbar/ToolbarPopover.tsx`, `SegmentControl.tsx`, `ColorSwatchControl.tsx`(기존 `ColorInput`/`dropdownCoordinator` 재사용)
  - Notes: 팝오버는 동시 1개만 열림(dropdownCoordinator 연동), Escape 시 팝오버만 닫힘(툴바 unpin보다 먼저). 색상 = 프리셋 팔레트 그리드 + 커스텀 피커.
  - Parallelizable: yes
- [ ] intent → 툴바 컨트롤 구성 정의 모듈
  - Files/areas: 신규 `src/editor/components/quick-toolbar/toolbarConfig.ts`
  - Notes: Assumptions의 intent별 1행 구성 + 공통 2행(스페이싱 3버튼/구조 4버튼/드래그 그립/기타)을 선언적 데이터로 정의. 복수 intent 병합·중복 제거 로직 포함.
  - Parallelizable: yes
- [ ] QuickToolbar 본체 컴포넌트 구축(2행, 앵커 추적 배치)
  - Files/areas: 신규 `src/editor/components/quick-toolbar/QuickToolbar.tsx`, `src/editor/App.tsx`(마운트)
  - Notes: `activeToolbarTarget` 존재 시 렌더. 배치 = `bridgeViewportRectToEditorViewportRect(elementRect)` → `calculateFloatingOverlayPlacement(..., {mode:'target'})`, fixed 레이어 `z-[118]`(FloatingVisualPanel z-[120] 아래). `reason:'repositioned'` 수신·window resize·stage scroll에 재배치. 현재값은 `panel/toolbar` 스냅샷의 computedStyle에서 읽고 `visual*Updated` 결과 스냅샷으로 갱신.
  - Parallelizable: no (위 3개 컴포넌트 의존)
- [ ] 스페이싱 팝오버(전체/좌우/위아래/개별) 구현
  - Files/areas: 신규 `src/editor/components/quick-toolbar/SpacingPopover.tsx`
  - Notes: padding/margin/gap 공용. 스코프 토글(전체·좌우·위아래·개별 4방향) + 스코프별 스테퍼. 스코프에 따라 해당 방향 속성들을 한 번의 `updateVisualStyle`(복수 declarations)로 커밋.
  - Parallelizable: yes (QuickToolbar 골격 이후)
- [ ] 이미지 교체·href·placeholder 편집 팝오버 구현
  - Files/areas: 신규 `src/editor/components/quick-toolbar/AttributeEditPopover.tsx`
  - Notes: 기존 attribute 뮤테이션 경로(`visual-attributes.ts` 허용목록: src/alt/href/placeholder 포함) 재사용. URL 입력 + 적용 버튼. width/height 키워드(auto/full/fit-content) + 스테퍼 하이브리드는 `SizeHybridControl`로 함께 구현(키워드 선택 시 concrete 값 기록, 스텝 시작 시 % 의도 모델로).
  - Parallelizable: yes (QuickToolbar 골격 이후)
- [ ] 구조 버튼·드래그 그립을 에디터 발신으로 구현
  - Files/areas: `QuickToolbar.tsx` 내부, `src/editor/bridge/bridgeClient.ts`
  - Notes: 복제/이동/삭제는 기존 Editor→Bridge 메시지(`duplicateVisualElement`/`moveVisualElement`/`deleteVisualElement`)를 직접 발신(기존 `quickActionStructureRequested` 왕복 제거 대비). 이동 버튼 disable은 스냅샷 `previousSibling`/`nextSibling`로 판단. 드래그 그립은 에디터 pointer capture → `editorViewportPointToBridgeViewportPoint` 변환 → 기존 `previewVisualDragMove`/`requestVisualDragMove`/`clearVisualDragMovePreview` 발신(8px 임계값 유지).
  - Parallelizable: no
- [ ] 인라인 텍스트 편집 커밋 핸들러 연결
  - Files/areas: `src/editor/bridge/bridgeClient.ts`, `src/editor/components/visual/visualMutationClient.ts`
  - Notes: `inlineTextEditCommitted` 수신 → 기존 text 뮤테이션 디스패치 경로로 `updateVisualText{value, previousValue}` 발신(record 자동 생성). 별도 UI 없음.
  - Parallelizable: yes
- [ ] 전환: 브리지 툴바 표시 중단 + Escape 캐스케이드 확인
  - Files/areas: `src/content/editor-bridge/highlight.ts`, `src/editor/shortcut-actions.ts`, `src/editor/keyboard.ts`
  - Notes: `showQuickActionToolbar`/`hideQuickActionToolbar` 호출 제거(파일 삭제는 Phase 7). Escape 순서 = 열린 팝오버 → 툴바 unpin(`activeToolbarTarget` clear, 기존 3단계 로직 재사용) → 하이라이트. `clearQuickActionSelection` Editor→Bridge 메시지 경로는 유지.
  - Parallelizable: no

### Phase 4 - 스테퍼 % 의도 기록·코얼레싱·export
- [ ] 스테퍼 편집 디스패치에 intent 메타데이터 전달
  - Files/areas: `src/editor/components/visual/visualMutationClient.ts`, `src/editor/components/visual/useStyleEdit.ts`
  - Notes: `dispatchVisualStyleMutation` 입력에 `intent?: {percent, base}` 추가 → declaration diff/state에 채움. 프리뷰 적용값은 계산된 concrete px로 `updateVisualStyle` 발신(브리지 변경 불필요).
  - Parallelizable: no
- [ ] 동일 target+property 스테퍼 연타 코얼레싱
  - Files/areas: `src/editor/stores/useVisualEditStore.ts`, `visualMutationClient.ts`
  - Notes: 최신 record가 같은 target(aiId/nodeId)+property+스테퍼 편집이고 status pending|applied면 신규 record 대신 기존 record 갱신(기존 `upsertRecord` 활용): `after`/`intent.percent` 누적, `before`·`intent.base`는 최초값 유지, humanSummary 재생성. undo(역방향 메시지)가 최초 before로 복원됨을 로직상 보장.
  - Parallelizable: no
- [ ] export에 % 의도 반영
  - Files/areas: `src/editor/notebook/visual-edits-export.ts`, `src/editor/notebook/visual-edits-compact.ts`
  - Notes: intent 있는 declaration의 humanSummary/Diff 라인을 `Increase font-size by 20% (base 16px)` 형태로. compact JSON `format`을 `compact-visual-edits-v2`로, `change.declarations[]`에 `intent` 포함(참고용 before/after px는 유지). intent 없는 편집(색상/세그먼트/attribute)은 기존 포맷 유지.
  - Parallelizable: yes
- [ ] `## Rules`에 단위 환산 지시문 추가
  - Files/areas: `src/editor/notebook/format.ts`(suffixLines), `src/shared/i18n.ts`
  - Notes: 신규 키 `notebook.unitConversionSuffix`(en: "Numeric changes are expressed as % intents relative to current values — apply them using the units already used in the source code (rem, px, %, …)." / ko 동등 문구). visual edits 섹션이 존재할 때만 삽입.
  - Parallelizable: yes

### Phase 5 - FloatingVisualPanel 재구성('기타' 모음집)
- [ ] 패널 골격 개편: 탭 제거·단일 스크롤·intent 기반 섹션 목록
  - Files/areas: `src/editor/components/visual-panel/FloatingVisualPanel.tsx`, `VisualPanelContent.tsx`
  - Notes: `QUICK_CATEGORY_TABS`/카테고리 switch 제거. 스냅샷 `intents` 기준으로 접이식 섹션 배열 렌더(이미지 intent면 이미지 섹션 최상단). '기타' 버튼 → `openPanel()`만으로 전체 목록 열림(section-jump 불필요). 헤더는 요소 태그·라벨 요약만 남기고 설명문 제거.
  - Parallelizable: no
- [ ] 이미지 전용 섹션 신설
  - Files/areas: 신규 `src/editor/components/controls/ImageControls.tsx`
  - Notes: 기존에 분산된 src/alt(attribute), object-fit/object-position, aspect-ratio, background-image 그룹을 한 섹션으로 통합. 수치는 스테퍼, 이산값은 세그먼트.
  - Parallelizable: yes
- [ ] 나머지 섹션 구성: 툴바 중복 제거 + 스테퍼 전면 교체
  - Files/areas: `src/editor/components/controls/*`(Layout/Size/Border/Typography/Color/Opacity/Shadow/BackgroundImage/Content/FormValue/Link/Attribute), `src/editor/components/forms/useVisualStyleForm.ts`
  - Notes: 현재 intent의 툴바가 커버하는 속성(스페이싱 전체 포함)은 패널에서 제외. 남는 섹션: 레이아웃(display/position/overflow/flex·grid 상세), 크기 제약(min/max/box-sizing), 타이포 확장(line-height/letter-spacing/decoration/transform/white-space/font-family), 효과(opacity/shadow/filter), 테두리 상세(변별 width·style·color/코너별 radius/outline), 콘텐츠·속성·폼 값. 모든 수치 입력(`UnitValueInput` 사용처)을 `StepperControl`로 교체, 단위 드롭다운 제거.
  - Parallelizable: yes (섹션별 분담 가능)
- [ ] 효과 섹션에 `transform` 프리셋 컨트롤 추가
  - Files/areas: `src/shared/visual-style.ts`, 효과 컨트롤 컴포넌트
  - Notes: 자주 안 쓰는 것 '기타' 수용 결정에 따른 항목. 프리셋 옵션(none/scale 0.9·1.1/rotate ±5deg/translateY 등) 방식 — 자유 입력 없음.
  - Parallelizable: yes
- [ ] 구구절절 텍스트 전면 제거
  - Files/areas: `src/editor/components/controls/*`(하드코딩 helperText/description 전부), `src/editor/components/visual/VisualControl.tsx`, `styleControlHelpers.tsx`, `VisualSection.tsx`, `VisualPanelContent.tsx`(상태 notice 축약)
  - Notes: `helperText`/그룹 description 렌더 경로 자체를 제거하거나 no-op화. 상태 notice는 한 줄(로딩/오류/선택 없음)로. 남길 라벨 중 하드코딩 한글은 i18n(en+ko)으로 이동.
  - Parallelizable: yes
- [ ] 브레이크포인트 표시 제거
  - Files/areas: `FloatingVisualPanel.tsx`(VisualPanelBreakpointBadge), `styleControlHelpers.tsx`(StyleControlBreakpointBadge), `VisualSection.tsx`(responsive 점)
  - Notes: UI 표시만 제거. record의 `breakpointId` 기록과 export viewport scope 규칙(format.ts/breakpoint-scope.ts)은 유지.
  - Parallelizable: yes

### Phase 6 - 다크 대비·액센트 시각 개선
- [ ] 텍스트/보더 대비 상향 및 액센트 강화 일괄 적용
  - Files/areas: `src/editor/components/visual-panel/*`, `visual/*`, `controls/*`, `quick-toolbar/*`, `tailwind.config.js`, `src/editor/editor.css`(패널 shell BEM 부분)
  - Notes: 본문 `text-gray-500/600` → `text-gray-300/400`, 라벨 `text-[10px] text-gray-400` → `text-[11px] text-gray-200` 수준으로 상향, placeholder `gray-600`→`gray-500`. 액센트 `blue-500` 계열 채도/사용 빈도 강화(활성 세그먼트·스테퍼 hover·포커스 링). 다크 유지, 새 라이트 테마 없음. quick-toolbar도 동일 토큰 체계 사용.
  - Parallelizable: yes

### Phase 7 - 구 코드·프로토콜 정리, i18n 프루닝, 문서
- [ ] 브리지 툴바 관련 파일·참조 삭제
  - Files/areas: `src/content/editor-bridge/quick-action-toolbar.ts`, `toolbar-styles.ts`, `toolbar-geometry.ts` 삭제; `highlight.ts`(corridor·`isQuickActionToolbarElement` 참조), `local-picker.ts`, `keyboard.ts`, `index.ts`의 참조 정리; `src/shared/config.ts`의 `QUICK_ACTION_BAR_ATTR`/`QUICK_ACTION_STYLE_ATTR`/툴바 z-index 상수는 참조가 0이 된 경우에만 제거(z-index 표 번호는 재부여 금지)
  - Notes: `runtime-artifacts.ts`가 툴바 속성을 스크럽 목록에 갖고 있으면 함께 확인.
  - Parallelizable: no
- [ ] 폐기 프로토콜·스토어 제거
  - Files/areas: `src/shared/protocol/editor-bridge-messages.ts` + `guards.ts`(`quickActionCategoryRequested/Selected`, `quickActionStructureRequested`, `quickActionDragMove*Requested` 3종, `availableCategories` 필드), `src/editor/bridge/bridgeClient.ts`(해당 핸들러·`selectQuickActionCategory`), `src/editor/stores/useSectionJumpStore.ts` 삭제, `src/editor/components/visual/sectionJump.ts` 삭제, `src/content/editor-bridge/index.ts` route 정리
  - Notes: `QuickActionCategory` 타입은 record.category 분류용으로 잔존시킴(record/export 스키마 churn 최소화). `useVisualEditStore`의 미사용 `undoStack`/`redoStack` 데드코드도 이번에 제거.
  - Parallelizable: no
- [ ] i18n 프루닝 + en/ko 패리티 정리
  - Files/areas: `src/shared/i18n.ts`
  - Notes: 제거된 UI가 쓰던 verbose 키(categories.*.description/placeholder, panel.state 장문 등) 삭제, 신규 키(툴바 라벨·팝오버·스테퍼 aria·unitConversionSuffix 등) en+ko 동시 존재 확인.
  - Parallelizable: yes
- [ ] README 문서 동기화
  - Files/areas: `README.md`, `README.ko.md`
  - Notes: 툴바/패널 동작 설명이 있는 부분만 새 UX(의도 기반 툴바, +/- 의도 편집, 더블클릭 텍스트 편집, '기타' 패널)로 갱신. 두 언어 동시 수정.
  - Parallelizable: yes
- [ ] 정적 검증 및 빌드
  - Files/areas: 전체
  - Notes: `npm run typecheck` 통과 후 `npm run build`로 dist 재생성(프로젝트 유일 자동 게이트).
  - Parallelizable: no
