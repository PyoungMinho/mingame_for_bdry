# 월마감 QA 버그 수정 — 프론트 (STEP 5 수정 라운드)

- 작성: 2026-11-08 · @프론트팀장
- 입력: `docs/qa/monthly-close-bug-report.md` (QA실행자) — 프론트 담당 16건
- 범위 밖(백엔드팀장 동시 작업): BUG-03·09·11·15·16, `src/lib/monthly-close/{engine,server}/**`, `src/app/api/monthly-close/**` — 건드리지 않음
- 규칙 준수: 공유 파일(`src/app/layout.tsx`·`providers.tsx`·`globals.css`)·`package.json` 무수정, 새 의존성 0, 녹색·움직임·효과음 0, git add/commit 0
- 동결 파일(`protocol.ts`·`constants.ts`·`coords.ts`·`copy/schema.ts`·`client/controller.ts`) **무수정** — 필요 없었다

## 0. 결과 요약

| 버그 | 등급 | 상태 | 검증 |
|---|---|---|---|
| BUG-01 숨김 중 [의견 남기기]·[Σ] 동작 | P1 | 수정 | QA `HIDE-17` 3건 `it` 전환 통과 + 보강 4건 + CDP 실클릭 |
| BUG-02 숨김 중 [새 문서]→홈, 팝오버 튀어나옴 | P2 | 수정 | QA 4건 `it` 전환 + 보강 2건 + CDP |
| BUG-04 숨김 중 Ctrl/Cmd+S 토스트 안 보임 | P2 | 수정 | QA `HIDE-26` `it` 전환 + CDP(보이는 토스트, 숨기기 레이어 안) |
| BUG-05 양식 변경 시 닉네임 초기화 | P2 | 수정 | QA `UI-05` `it` 전환 + 포커스 보강 1건 |
| BUG-06 배치 응답 대기 중 다음 배치 유실 | P2 | 수정 | QA `UI-07`·liveroom 2건 `it` 전환 + 클라 보강 2건 |
| BUG-07 숨긴 동안 판 종료 → 크롬 단서 | P2 | 수정 | 보강 1건 + CDP `HIDE-30b/CR-6` **크롬 변화 0** |
| BUG-10 대전 DOM 1,525 > 1,500 | P2 | 수정 | CDP body **1,273**(1366×768) · 1,404(1920×1080) + 보강 4건 |
| BUG-18 모바일 4열 1~2행 제목 빔 | P2 | 수정 | 보강 3건 + CDP 360·390 캡처(A1·A2 360px 폭) |
| BUG-08 `<title>` 교체 시 감시 끊김 | P3 | 수정 | QA `HIDE-23` `it` 전환 |
| BUG-12 "완벽하지 않음" 고지 없음 | P3 | 수정 | QA `HIDE-25` `it` 전환 + CDP 홈 문구 |
| BUG-13 초인종마다 refresh 예약 | P3 | 수정 | QA liveroom `it` 전환 |
| BUG-14 3연속 클릭 "지금은 편집할 수 없습니다." | P3 | 수정 | QA 기록 테스트를 회귀로 전환(아래 §3 참고) |
| BUG-17 첫 sync가 `view:"game"` 보고 | P3 | 수정 | 클라 보강 2건 + CDP `HIDE-08/CR-3` 첫 sync 본문 `{"knownVersion":-1,"view":"disguise"}` |
| BUG-19 홈 4px 둥근 스크롤바 | P3 | 수정 | 보강 1건 + CDP 홈 뷰포트 스크롤바 4px → **12px** |
| BUG-20 부가세 "370000 (단위: 만원)" | P3 | 수정 | 보강 3건 + CDP 칸 폭 측정 |
| BUG-21 공유 시트 예외가 이탈 신호 1개만 | P3 | 코드 수정, **실기 미확인** | 클라 보강 3건. 아이폰·안드로이드 확인은 DEV-05·06 |

## 1. 버그별 원인 · 수정 · 검증

### BUG-01 (P1) · BUG-02 (P2) — 숨김 중 크롬의 게임 기능
- **원인**: 숨기는 순간 정리(`store.onChange` → reset)는 있었지만, 숨긴 **뒤** 크롬(상단바·메뉴·도구줄)에 남은 버튼의 핸들러에는 숨김 조건이 없었다. `ToolBar`가 도발 목록(`tauntMenu`)을 크롬 안에 그려 숨기기 시트 위에 떴고, `onMenuItem`·`onShare`·`[⋯]`는 숨김과 무관하게 홈 이동·팝오버 열기를 했다(팝오버는 게임 레이어 안이라 복귀 순간 튀어나옴).
- **수정** (`_screens/GameScreen.tsx`):
  1. 원칙 "숨김 중 게임 기능 0"을 두 겹으로 막는다.
     - 핸들러: 숨김이면 `onHint`·`onTaunt` 없음, `tauntMenu` 안 그림, `hintActive`·`tauntOpen`·`moreOpen` 모양 없음. `onShare`·`onMore`·`onMoreItem`은 즉시 반환.
     - 안전망: 셸 래퍼 `onClickCapture`가 숨김 중 크롬의 `data-mc-cmd` 클릭을 캡처 단계에서 버린다(허용 목록 `HIDDEN_SAFE_CMDS` = 메뉴 열기·메뉴 항목·✕✓뿐). 렌더가 따라오기 전 같은 프레임의 클릭까지 막는다.
  2. 메뉴는 진짜 시트처럼 **열리고 닫히기만** 한다(`onMenuItem` 숨김 분기). [새 문서] = 숨기기 시트 첫 탭으로 이동(빈 업무 시트 흉내, 숨김 유지), [문서 닫기]·[도움말]·연습 [연습 끝내기] = 닫히기만.
  3. 숨기는 순간 취소 범위 확대: 배치의 고른 항목(`armed`)·끌기(`drag`)도 취소(`_screens/Placement.tsx` reset), 끌던 중 숨겼으면 mouseup에서 놓지 않음.
- **검증**: QA `hide.qa.test.tsx` HIDE-17 7건 `bug`→`it`, 보강(`_screens/qa-fixes.test.tsx`): 장식 탭에서 [새 문서]=숨기기 시트, 연습 [연습 끝내기] 홈 안 감, **렌더 전 클릭도 캡처에서 버림**(안전망 제거 시 실패하는 것 확인), 숨김 중 aria-pressed/expanded 없음, 모바일 [⋯] 복귀 때 메뉴 0, 배치 범위 시작 취소. CDP 실마우스: 숨김 → [의견 남기기] 메뉴 0, [Σ] aria-pressed 없음, 파일 메뉴 항목 → 경로·숨김 유지, 복귀 후 보이는 팝오버 0.

### BUG-04 (P2) — 숨김 중 Ctrl/Cmd+S 토스트
- **원인**: "저장됨" 토스트가 게임 레이어 안에만 있었다.
- **수정**: 토스트 상태를 `'game' | 'disguise' | null`로 바꿔 **누른 순간 보이던 레이어**에 띄운다. 숨기기 레이어에도 같은 `Toast`(저장됨 = 진짜 시트 반응, 게임 문구 0). 연타 시 앞 타이머가 새 토스트를 일찍 지우던 것도 정리.
- **검증**: QA HIDE-26 `it` 전환. HIDE-16 "저장 토스트 + Tab"(숨긴 직후 보이는 오버레이 0)도 그대로 통과 — 게임에서 누른 토스트는 숨기기 레이어로 따라오지 않는다. CDP: 숨김 중 Ctrl+S → 보이는 토스트 "저장됨"(숨기기 레이어 안, 폭 58px).

### BUG-05 (P2) — 입장 대화상자 닉네임 초기화
- **원인**: `GameScreen`이 `key={industry}`로 `GameInner`를 다시 마운트(업종 팩·숨기기 시트를 새로 만들기 위해 필요)하는데 `nick` 상태가 그 안에 있었다.
- **수정**: `nick` 상태를 바깥 `GameScreen`으로 올렸다(key 유지 — 업종별 시트 재생성은 그대로). 재마운트된 대화상자는 닉네임 칸이 아니라 **고른 양식 라디오**에 포커스를 돌려준다(`JoinDialog` `initialFocus`) — 방향키로 양식을 고르던 흐름이 끊기지 않게.
- **검증**: QA UI-05 `it` 전환 + 보강(닉네임 유지 + activeElement = 체크된 라디오).

### BUG-06 (P2) — 배치 연속 조작 유실
- **원인**: `LiveRoom.act()`가 대기 중이면 요청 없이 `WRONG_PHASE`. `Placement`는 그 실패를 "저장 실패"로 띄우고, 첫 응답의 `me.ships`(L4만)가 `serverKey` effect로 초안을 덮어 방금 놓은 배가 사라졌다.
- **수정**:
  - `Placement.tsx`: 저장 줄 — 대기 중 들어온 저장은 **마지막 초안 1개**로 묶어 앞 응답 뒤에 보낸다. 줄이 빌 때까지 서버 중간 결과로 초안을 덮지 않고, 줄이 비면 마지막 응답의 서버 값으로 맞춘다(거절이면 서버 값으로 되돌리고 문구). 앞 요청 실패 문구는 뒤 초안이 덮으므로 띄우지 않는다. [배치 완료]도 같은 줄.
  - `client/liveRoom.ts`: place 대기 중 들어온 place는 버리지 않고 마지막 1개만 남겨 앞 응답 직후 보낸다(호출자에게는 접수 = 지금 화면 데이터로 즉시 ok). **다른 액션(fire 등)은 예전대로 `WRONG_PHASE`** — 연타 방지 규칙(기존 테스트) 유지.
- **검증**: QA UI-07·liveroom BUG-06 `it` 전환. 보강(`client/qa-fixes.test.ts`): 대기 중 place 3개 → 요청 2건·마지막 초안(B5)이 감, place 대기 중 fire = WRONG_PHASE(요청 1건).

### BUG-07 (P2) — 숨긴 동안 판 종료 → 크롬 단서
- **원인**: 크롬 값(탭 줄 결과 탭·새 표시, "버전 기록 a:b", 편집자 원·오프라인, [Σ(n)] 숫자, 파일명/탭 제목)이 숨김과 무관하게 실시간 갱신됐다.
- **수정**: `useHeldWhileHidden(hidden, live)` — 숨김 중에는 숨기기 직전 값을 그대로, 복귀 렌더부터 지금 값. 적용: 파일명(→ 탭 제목), 상단바(버전 기록·공동 편집·편집자), 도구줄 숫자·흐림, 탭 줄(창 폭이 바뀌어 탭 구성이 달라지면 지금 값). 상태줄·메모 줄은 원래 숨김 중 "준비".
- **검증**: 보강 — 숨김 중 판 종료(+재대결 번호·전적·힌트 수 변화) view 도착 → 탭·버전 기록·Σ·제목 불변, 복귀 → 결과 탭·"버전 기록 3:1"·"(3)". CDP `HIDE-30b/CR-6`: 숨긴 동안 상대 기권 → **크롬 변화 0**(수정 전 2곳 변화).

### BUG-10 (P2) — 대전 화면 DOM 1,525
- **원인**: 늘 마운트된 숨기기 시트(866 요소)가 대부분. 빈 줄 8개를 화면 크기와 무관하게 그렸고(줄당 18 요소), 글자 칸마다 `<span>` 하나씩(약 140개).
- **수정** (`_components/disguise/DisguiseSheet.tsx`): ① 데이터 아래 빈 줄 = 창 높이를 채우는 만큼(`padRowsFor`, 최소 2·최대 8 = 예전 값, 선택이 빈 줄에 있으면 그 줄 유지) ② 숨기기 시트 칸 글자는 span 없이 칸에 바로(스크린리더 이름 `aria-label`은 그대로). 게임 판 칸은 취소선 때문에 span 유지.
- **검증**: CDP body 요소 1366×768 **1,273**(대전 실방) / 1,296(연습), 1440×900 1,314, 1920×1080·2560×1440 1,404. 숨기기 시트 수정 전후 캡처 비교 — 정렬·굵기·음수 색·조건부 서식 동일. 보강: 3업종 셸 요소 ≤ 1,400, `padRowsFor` 경계.

### BUG-18 (P2) — 모바일 숨기기 시트 1~2행 제목
- **원인**: `SheetGrid`가 폭 0(숨긴 열)인 칸을 건너뛰는데, 병합 시작 열(A)이 숨으면 병합째 사라졌다(회계·영업은 모바일에서 A열을 숨김).
- **수정** (`_components/sheet/SheetGrid.tsx`): 병합 시작 열이 숨었어도 병합 안에 보이는 열이 있으면 그 자리에 병합 칸을 그린다(내용 = 시작 칸, 폭 = 보이는 열 합, 숨은 A열은 왼쪽 고정 표시 안 함). 병합 폭 계산에서 격자 밖 열은 빼도록 함께 정리.
- **검증**: 보강 — 회계·영업 모바일 A1 제목·A2 부제 표시, B1 별도 칸 없음, 인사(A열 보임) 그대로. CDP 360·390 캡처: A1·A2 360px 폭으로 표시(수정 전 공백).

### BUG-08 (P3) — `<title>` 교체 시 감시 끊김
- **원인**: 처음 찾은 `<title>` 요소만 관찰.
- **수정** (`client/useDocumentTitle.ts`): `<head>` 전체(subtree) 관찰. 같으면 쓰지 않아 되먹임 없음.
- **검증**: QA HIDE-23 `it` 전환.

### BUG-12 (P3) — "완벽하지 않음" 고지
- **수정** (`copy/ui-text.ts` 홈 안내): "숨기기는 완벽하지 않습니다. 브라우저 탭 미리보기·앱 전환 화면의 썸네일에는 숨기기 전 화면이 남을 수 있습니다." 월마감 FAQ 화면은 없으므로 홈 안내 상자에 둔다.
- **검증**: QA misc `it` 전환 + CDP 홈.

### BUG-13 (P3) — 초인종 refresh 예약
- **수정** (`client/liveRoom.ts`): 간격 제한(300ms) 중 들어온 초인종은 **뒤쪽 refresh 1개**로 묶는다(이미 예약돼 있으면 더 예약 안 함, 남은 간격만큼만 기다림). dispose·leave에서 타이머 해제.
- **검증**: QA liveroom `it` 전환(20개 → 묶임).

### BUG-14 (P3) — 연타 잡음
- **수정** (`_screens/Battle.tsx`): 상대 차례에 들어온 클릭이 연타의 나머지(`detail ≥ 2`)이거나 방금 반영한 칸을 1초 안에 다시 누른 것이면 조용히 무시. 이름 상자 Enter 등 일반 경로의 "지금은 편집할 수 없습니다."는 그대로.
- **검증**: §3 참고(QA 기록 테스트 → 회귀). UI-09 "상대 차례 Enter = 문구" 통과 유지.

### BUG-17 (P3) — 첫 sync가 `game` 보고
- **원인**: `RoomApp`이 `ViewStore('game')`으로 시작하고 숨김은 첫 응답 뒤 effect에서 일어났다.
- **수정**: `LiveRoom` deps `firstSyncView`(첫 sync에만), `useMcRoom` 셋째 인자, `RoomApp` = 홈에서 방금 만든 방(`peekFreshRoom`, 지우지 않고 보기만 — 지우는 건 기존 `takeFreshRoom`)만 `game`, 나머지는 `disguise`. 자리 없는 사람(입장 대화상자)은 서버가 view를 쓰지 않는다(`syncFlow`에서 접근 실패가 `touch`보다 먼저 — 코드 확인).
- **검증**: 보강 2건 + CDP 새로고침 첫 sync 본문 `{"knownVersion":-1,"view":"disguise"}`, HIDE-08 첫 프레임 판 노출 0/163 유지, HIDE-09a(방금 만든 방 = 게임 + 공유 패널) 유지.

### BUG-19 (P3) — 홈 스크롤바
- **원인**: 전역 `::-webkit-scrollbar {4px}`·thumb `9999px`(globals.css)이 홈의 뷰포트 스크롤바에 적용. 월마감 규칙은 `.mc-root` 안쪽 스크롤 영역에만 닿았다.
- **수정** (`monthly-close.css`, 공유 파일 무수정): `body:has(.mc-root)`·`html:has(.mc-root)`의 `::-webkit-scrollbar*`를 12px 각진 모양으로 덮는다. 크롬은 뷰포트 스크롤바 모양을 `<body>`에서 먼저 찾으므로 body 선택자가 핵심(처음 html만 넣었을 때 CDP에서 4px 그대로 → body 추가 후 12px 확인). 월마감이 없는 문서에는 안 걸린다(`:has`).
- **검증**: CDP 홈(1366×520, 문서 스크롤) `innerWidth − clientWidth` = **12px**(수정 전 4px), 캡처 확인. CSS 범위 테스트(`mc-` 범위) 통과.

### BUG-20 (P3) — 부가세 숫자·단위
- **원인**: 값은 원 단위(20,000~990,000)인데 단위 표기가 "만원", 쉼표 없음.
- **수정**: 3업종 `quiz.vat.unit` "만원" → "원"(`copy/{accounting,sales,hr}.json`, 다른 검산 단위는 그대로), 값 천 단위 쉼표(`formatQuizValue`). 실측에서 "370,000"이 56px 칸(1024~1199px)·모바일 35px 칸에서 잘려(수정 전 "370000"도 모바일에서 잘렸음) 값이 1개인 부가세는 값·머리를 B:D 병합(아래 입력칸 B13:D13과 같은 폭).
- **검증**: 보강 3건(단위·쉼표·B12:D12 병합). 입력은 원래 쉼표 허용(`parseQuizInput('37,000')`).

### BUG-21 (P3) — 공유 시트 예외
- **수정** (`client/viewStore.ts`·`useHideKeys.ts`): 예외 1회 = 이탈 **1번 분량**. 첫 신호 소비 뒤 1초 안의 **다른 종류** 신호(blur ↔ visibility)는 같은 이탈로 함께 소비. 같은 종류가 다시 오면 새 이탈 → 숨김(기존 "blur 2번 → 두 번째 숨김" 테스트 유지). `pagehide`는 짝으로 소비하지 않음(돌아왔을 때 게임 화면이 남지 않게, 안전 쪽).
- **검증**: 보강 3건. **실기 확인은 PM 체크리스트 DEV-05·06(아이폰·안드로이드 공유 시트 열고 닫은 뒤 숨김 여부)**.

## 2. 바꾼 파일

| 파일 | 버그 |
|---|---|
| `src/app/monthly-close/_screens/GameScreen.tsx` | 01·02·04·05·07 |
| `src/app/monthly-close/_screens/JoinDialog.tsx` | 05 |
| `src/app/monthly-close/_screens/Placement.tsx` | 06, 01(숨길 때 armed·drag 취소) |
| `src/app/monthly-close/_screens/Battle.tsx` | 14·20 |
| `src/app/monthly-close/_screens/RoomApp.tsx` | 17 |
| `src/app/monthly-close/_components/sheet/SheetGrid.tsx` | 18 |
| `src/app/monthly-close/_components/disguise/DisguiseSheet.tsx` | 10 |
| `src/app/monthly-close/monthly-close.css` | 19 |
| `src/lib/monthly-close/client/liveRoom.ts` | 06·13·17 |
| `src/lib/monthly-close/client/useMcRoom.ts` · `identity.ts`(`peekFreshRoom`) | 17 |
| `src/lib/monthly-close/client/useDocumentTitle.ts` | 08 |
| `src/lib/monthly-close/client/viewStore.ts` · `useHideKeys.ts` | 21 |
| `src/lib/monthly-close/copy/ui-text.ts` | 12(홈 안내 1줄) |
| `src/lib/monthly-close/copy/{accounting,sales,hr}.json` | 20(`quiz.vat.unit`만) |
| 새 테스트 `src/app/monthly-close/_screens/qa-fixes.test.tsx`(20) · `src/lib/monthly-close/client/qa-fixes.test.ts`(7) | 회귀 |

## 3. QA 파일 수정 내역(지시 범위)

- `bug(`→`it(` 전환: `hide.qa.test.tsx` BUG-01×3·02×4·08·04, `ui.qa.test.tsx` BUG-05·06, `liveroom.qa.test.ts` BUG-06·13, `misc.qa.test.tsx` BUG-12. 각 파일의 `bug` 헬퍼 정의는 다음 라운드용으로 남겼다(미사용, tsc 무관).
- **예외 1건 — 보고**: `ui.qa.test.tsx` CON-09 두 번째 테스트는 `bug()`가 아니라 **현재 결함을 단언하는 기록 테스트**(`toBe(notNow)`)였다. BUG-14를 고치면 이 테스트가 깨지므로 이름을 `BUG-14 [CR-17] …(기록 테스트를 수정 후 회귀로 전환)`으로 바꾸고 단언을 `not.toBe(notNow)` 한 줄만 뒤집었다. 시나리오·준비 코드는 그대로.
- 백엔드 쪽 QA 파일(`pipeline.int.test.ts`·`engine.qa.test.ts`·`backend-fixes.qa.test.ts`)은 건드리지 않았다.

## 4. 실행 결과

| 항목 | 결과 |
|---|---|
| `npx tsc --noEmit` | 0 오류 |
| 프론트 소유 범위(`src/app/monthly-close` + `client` + QA hide·ui·liveroom·misc) | 20파일 327 통과 |
| `QA_SHOW_BUGS=1 npx vitest run src/lib/monthly-close/qa` | 프론트 BUG 전부 통과. 남은 실패 4 = 백엔드 BUG-15·16(작업 중) |
| 월마감 전체 범위(작업 중간) | 실패 = 백엔드 BUG-15·16 관련 5~6건(`engine/simulate.test.ts`·`qa/backend-fixes.qa.test.ts`·`qa/engine.qa.test.ts` ENG-09) — 백엔드팀장 진행 중이던 것, 프론트 변경과 무관 |
| `npx vitest run`(레포 전체, 마지막) | **295파일 통과 · 1 건너뜀 / 6,848 통과 · 1 건너뜀 · 1 todo, 실패 0** (백엔드 수정도 반영된 시점) |
| CDP(`scratchpad/fe-verify/fe-cdp.mjs room mobile fe dom measure`, 별도 포트 9351·프로필·출력 폴더 — QA 캡처 덮어쓰지 않음) | room+mobile 38/38, fe 7/7, dom 4/4. 캡처 `scratchpad/fe-verify/out/cdp/` |

## 5. 남은 위험 · 인계

1. **BUG-21 실기 미확인** — 짝 신호 창 1초는 추정값. DEV-05(아이폰)·DEV-06(안드로이드)에서 공유 시트 열고 닫은 뒤 숨김 여부 확인 필요.
2. **BUG-06 LiveRoom 묶음은 "접수 = 즉시 ok"** — 묶인 place의 최종 실패는 호출자가 직접 받지 못하고 `lastError`·view로만 반영된다. 화면 경로(`Placement`)는 자체 줄로 응답을 직접 받으므로 영향 없음. 다른 호출자가 place 결과에 의존하면 주의.
3. **숨김 중 [새 문서] = 숨기기 시트 첫 탭** — "아무 일 없음" 대신 고른 동작. PM이 다른 동작을 원하면 `onMenuItem` 숨김 분기 한 줄.
4. **BUG-20 문구 변경**(단위 "원", 홈 안내 1줄)은 기획 문구 검토(REVIEW-LINES 대상 아님) 권장.
5. BUG-10: 숨기기 시트 빈 줄이 창 높이에 따라 2~8줄로 바뀐다. 창을 키우면 resize로 다시 그린다(빈 줄은 격자 배경으로도 그려져 순간 공백은 없음).
6. 남은 QA 미실행 케이스(UI-03·08·14, PRAC-03·07, MOB-07, A11Y-02, DIS-06, VIS-16)와 클린 빌드 게이트(BLD-01·PERF-01·SEC-07)는 QA 재검증·배포엔지니어 몫.

---

## 6. 리뷰 수정 (STEP 6 출시 전 필수 + QA 2차 새 버그) — 2026-11-08 · @프론트팀장

- 입력: `docs/planning/monthly-close/review-design.md` M1~M5(§3 정정 우선), `review-frontend.md` MC-FE-01·02·03, `review-backend.md` F1(클라 쪽), `docs/qa/monthly-close-bug-report.md` §9 BUG-22·23·24·25
- 규칙 준수: 녹색·움직임·효과음 0, 공유 파일·package.json·의존성·서버 코드(engine/server/api) 무수정, git add/commit 0. 동결 파일(`constants.ts` 등) 무수정 — 결과 화면 폴링 상수는 `liveRoom.ts` 안에 둠

### 6-1. 고친 것

| ID | 원인 | 수정 | 검증 |
|---|---|---|---|
| M1 버튼·토스트 대비 | `.mc-root button {font:inherit; color:inherit}`(0,1,1)가 `.mc-btn`·`.mc-toast`(0,1,0) 색을 이김 | `:where(.mc-root) button`(0,0,1)으로 명시도를 낮춤. 부수 효과: `.mc-btn` 굵기 600·줄 높이 18px, `.mc-toast__link` 600이 사양대로 적용 | CDP: 기본 버튼 흰 글자(6.7:1), 경보 토스트 **13.44:1**·[Tab] 칩 8.12:1, 비활성 기본 버튼 모양 그대로. `css.test.ts`에 **대비 회귀 검사 23건**(실제 CSS로 명시도·순서·상속 캐스케이드를 돌려 18개 버튼·토스트 조합 ≥ 4.5:1, 기본 버튼 흰색, 비활성 유지, 초기화 규칙 명시도 0). 옛 규칙으로 되돌리면 9건 실패 확인 |
| M2 검산 오답 메모 | 메모 기준 칸 H13이 E13:H13 병합 안이라 DOM에 칸 없음 | `Battle.tsx` 기준 칸 **B13**(입력 병합 B13:D13의 오른쪽 위에 뜸) | CDP: 오답 직후 메모 "검토 결과 / 소수점 이하는…"가 B13:D13 오른쪽(x 986, 병합 오른끝 982)에 표시. 회귀 테스트(H13로 되돌리면 실패 확인) |
| M3 홈 360px 겹침 | 인라인 2단 그리드 | 한 겹 격자 `.mc-home__grid`(PC 2단: 왼쪽 행 1~4, 안내 = 오른쪽 전체 행, 남는 높이는 빈 5행 `1fr`) + 720px 미만 1단·좌우 16px. DOM 순서 = 새 문서 → 안내 → 번호 → 최근 → 연습 | CDP 360: 섹션 x 16·폭 328, 안내가 새 문서 아래(475px). 1366: PC 배치·좌표 수정 전과 동일 |
| M4 모바일 결과 문서 | PC 위치(x 104)에서 시작, 결재란 절대 위치 | 모바일: 문서 → 작업 줄 순서, 결재란 제목 아래 오른쪽 정렬(칸 56), 라벨 64, 작업 줄 한 줄에 하나·44px·글자 가운데. **사양과 다른 점 1**: §7-4 "왼쪽 8px"는 행 머리글(고정 28px)을 셈하지 않아 라벨 칸 앞부분이 덮였다("속/성") → 행 머리글 오른쪽 +4px에서 시작, 오른쪽은 세로 스크롤바 12px + 4px 비움(폭 = 100vw − 48) | CDP 360: 문서 x 32~344(화면 안), 제목·결재란 겹침 0 |
| M5 노트북 높이 작업 줄 | 작업 줄이 문서 아래(y 635) | 작업 줄을 문서 위로(`.mc-doc-stack` flex, PC = 1행 위끝 + 8px, 문서는 그 아래 12px). DOM도 작업 줄이 먼저(Tab 순서·`/` 순서 일치) | CDP 1366×657·1280×640: 작업 줄 y 188~262, 보이는 시트 영역(156~605 / 156~588) 안 — 스크롤 없이 보임 |
| MC-FE-01 재대결 도발 | 도발 커서 `logSeq`가 판이 바뀌어도 그대로(엔진 log 순번은 판마다 1부터) | `logMatch`(matchId)가 바뀌면 커서 0. 첫 마운트(새로고침)만 "이미 본 것" 유지 | 재현 테스트를 `_screens/review-fixes.test.tsx`로 옮김(2판 순번 1 도발이 상태줄·메모에 뜸 + 새로고침은 옛 도발 안 띄움). 수정 전 코드로 실패 확인 |
| MC-FE-02 dispose 뒤 재구독 | dispose가 bellTopic을 비운 뒤 늦은 응답이 applyView → watchBell | `applyView`·`watchBell` 첫 줄 `disposed` 검사 | `client/review-fixes.test.ts`: dispose 뒤 액션 응답 → view 그대로, 구독 1회, 폴링 0 |
| MC-FE-03 피식 중복 | 응답 상태가 결과 탭 컴포넌트 안(탭 오가면 다시 마운트) | `GameInner`가 matchId별로 들고(+ sessionStorage `mc:laugh:<matchId>`), 판당 1회만 feedback | 결과 → 게임 → 결과 탭 뒤 다시 눌러도 요청 1건, 새로고침해도 1건, 다음 판은 새로 받음 |
| BUG-22 검산 입력칸 키보드 | 입력칸 진입 경로 없음 | 검산 중 상대 시트 격자에서 숫자 = 입력칸으로 이동 + 그 숫자 입력, Enter = 입력칸으로. `/` 모드 첫 항목 = 검산 입력칸(`quiz-input`, 검산 중에만). 입력칸에서 Enter는 모드만 끝내고 포커스는 그대로(제출은 입력칸이 함). 자동 포커스는 하지 않음(휴대폰 키보드가 갑자기 뜨지 않게) | QA `BUG-22` `it` 전환 통과. CDP 실키: `/` 항목 `quiz-input` 첫째, 격자에서 숫자 → 입력칸 |
| BUG-23 힌트 범위 키보드 | 힌트 모드 방향키가 범위를 안 바꿈 | 힌트 모드: 방향키 = 그 칸 중심 3×3 미리보기, 열 글자 A~H = 열 전체, 숫자 1~8 = 행 전체, Enter = 확정(머리글·칸 클릭과 같은 대상) | QA `BUG-23` `it` 전환 통과. CDP 실키: 방향키 뒤 이름 상자 "B1:D3", Enter → hint 1건, 글자 e → 열 E |
| BUG-24 배치 이름 상자 | `onLeftKey`가 Delete만 처리 | 배치 중 내 시트 격자에서 열 글자 = 이름 상자로 이동(대전과 같음) | QA `BUG-24` `it` 전환 통과. CDP 실키: 이름 상자 범위 3개 → 초안 9칸, [자동 배치] 우회 불필요 |
| BUG-25 작은 휴대폰 검산 표 | 자동 스크롤 없음 | 검산 입력칸이 화면에 붙는 순간(검산 시작·[상대 시트] 전환) 가장 가까운 스크롤 상자만 내려 입력칸 아래끝이 보이게 함. 10행 제목 줄이 열 머리글 밑으로 숨지 않는 만큼만. 이미 보이면(PC) 아무것도 안 함. 페이지·셸은 건드리지 않음 | QA `mquiz` 재실행: 360×640 입력칸 465~488(보이는 끝 511), 375×548 380~403(보이는 끝 419), 제목 줄 393·308 — **2/2 통과**. 단위 테스트 3건 |
| (덤) 결과 탭 `/` 모드 | 결과 시트에 `data-mc-grid-focus`가 없어 `/`를 끝내면 포커스가 마지막 버튼에 남음 | `ResultSheet` 격자에 `gridFocus` | QA `kbd` 결과 탭 버튼(/ 모드) 통과 |

### 6-2. 결과 화면 폴링(백엔드 리뷰 F1, 클라 쪽)

`client/liveRoom.ts` `interval()`이 판이 끝난 방(ended)에만 새 정책을 쓴다. 대기·배치·대전 중 값(초인종 2초 / 없음 1초 / 탭 비활성 5초)은 그대로(회귀 테스트로 고정) — 20초 턴·경보 3초 동작 불변.

| 결과 화면 상태 | 변경 전 | 변경 후 |
|---|---|---|
| 재대결 요청 전, 보이는 게임 화면 | 5초(초인종) / 3초(없음) | **30초**, 판이 끝나고 **10분 뒤 멈춤** |
| 재대결 요청 전, 숨기기·탭 비활성 | 5초 | **60초**, 10분 뒤 멈춤 |
| 재대결 요청 대기(expiresAt 전, 최대 2분) | 5초 / 3초 | 그대로 5초 / 3초(상대 수락을 놓치지 않게) |
| 재대결 기한 지남(rematchExpired) · 상대가 나감(opp.present false) | 계속 5초 / 3초 | **멈춤** |

멈춘 뒤에도 초인종(오면 즉시 sync)·내 액션([v8로 저장] 등)·기한 refresh는 동작하고, 응답 view가 다시 폴링 조건이면(예: 재대결 요청) 즉시 그 간격으로 다시 잡는다(30초 예정을 5초로 당김 포함).

**결과 화면 탭 1개를 1시간 열어 둘 때 sync 호출 수(추정)**

| 경우 | 변경 전 | 변경 후 |
|---|---|---|
| 보이는 탭, 초인종 연결 | 720 | **약 21**(첫 sync + 10분 × 2회/분), 이후 0 |
| 보이는 탭, 초인종 없음(회사망 차단) | 1,200 | **약 21** |
| 숨기기·백그라운드 탭 | 720 | **약 11** |
| 상대가 나간 결과 화면 | 720~1,200 | **1**(첫 sync), 이후 0 |
| 그 사이 재대결 요청 1회(2분 대기 후 만료) | (위와 같음) | 위 + 24~40 + 기한 refresh 1 ≈ **최대 약 62** |

→ 탭당 시간당 호출 **약 92~99% 감소**. 초인종으로 생기는 sync는 실제 변화(사람의 조작)가 있을 때만이라 변화 없음. 테스트: `client/review-fixes.test.ts` 7건(1시간 ≤ 21회 후 0, 숨김 60초, 상대 나감 0, 재대결 대기 5초 → 만료 후 멈춤, 멈춘 뒤 [v8로 저장]이면 재개, 30초 → 5초 당김, 대전 간격 회귀).

**받아들인 부작용**: ① 초인종이 막힌 환경에서는 상대의 재대결 요청을 최대 30초 늦게 본다(대기 2분 안). 멈춘 뒤에는 초인종 없이는 못 본다 ② 결과 화면에서 내 sync가 드물어 상대 화면에 내가 "오프라인"으로 보일 수 있다(10초 기준) ③ 서버 방이 30분 무활동으로 만료된 뒤 [v8로 저장]을 누르면 기존 "찾을 수 없음" 처리로 간다. 서버의 만료 연장 규칙(백엔드 F1 서버 쪽)은 이번 범위 밖.

### 6-3. 바꾼 파일

| 파일 | 항목 |
|---|---|
| `src/app/monthly-close/monthly-close.css` | M1(초인 규칙 `:where`), M3(§12 홈 배치), M4·M5(§13 결과 탭 배치) |
| `src/app/monthly-close/_screens/Home.tsx` | M3 |
| `src/app/monthly-close/_components/result/ResultSheet.tsx` · `DocActionBar.tsx` | M4·M5, 결과 탭 gridFocus |
| `src/app/monthly-close/_screens/Battle.tsx` | M2, BUG-22·23·25 |
| `src/app/monthly-close/_components/overlays/QuizSheet.tsx` | M2 주석(사양 정정 반영) |
| `src/app/monthly-close/_screens/Placement.tsx` | BUG-24 |
| `src/app/monthly-close/_screens/GameScreen.tsx` · `Result.tsx` | MC-FE-01·03 |
| `src/lib/monthly-close/client/liveRoom.ts` | F1, MC-FE-02 |
| `src/lib/monthly-close/client/useCommandMode.ts` | BUG-22(`quiz-input` 순서, 입력칸 Enter) |
| 테스트: `_components/css.test.ts`(+23), 새 `_screens/review-fixes.test.tsx`(8), 새 `client/review-fixes.test.ts`(8), QA `qa/reverify.qa.test.tsx` BUG-22·23·24 `bug(`→`it(` 3줄만 | 회귀 |

### 6-4. 검증

- `npx tsc --noEmit` 0 · `npx vitest run src/lib/monthly-close src/app/monthly-close src/app/api/monthly-close` 전부 통과 · `QA_SHOW_BUGS=1 npx vitest run src/lib/monthly-close/qa` 259/259 (최종 수치는 보고 참조)
- 헤드리스 Chrome(포트 9371·9372, 별도 프로필, dev 서버 새로 띄우지 않음): 캡처 `/private/tmp/claude-501/-Users-pyoungminho-Desktop-------team-makes/6e5d3fa5-1e67-4890-90f3-efd18d785ba1/scratchpad/fix-round/out/after/`(수정 전 `out/before/`), 스크립트 `fix-round/fx-cdp.mjs`. QA `mc-qa-cdp-r2.mjs`의 `mquiz`·`kbd`를 포트만 바꾼 임시 사본으로 재실행 → mquiz 2/2, kbd 10/10(로그 `out/after/kbd-cdp-result.txt`). 임시 사본은 지움
- 남은 낮은 대비 표시는 비활성 도구줄([Σ (0)]·[의견 남기기] `data-off`, 2.46:1)뿐 — WCAG 비활성 예외. `aria-disabled` 부재는 디자인 P7(출시 후)

### 6-5. 남은 것

1. 디자인 P1~P10, 프론트 MC-FE-04~10은 출시 후 범위(손대지 않음)
2. 모바일 결과 문서 라벨 칸 64px에서 "소속/성명"·"종료 사유"가 두 줄로 접힘(잘림은 아님). 디자인팀장 확인 권장
3. BUG-25 아이폰 실기(DEV-05)와 BUG-22·23의 실제 한글 입력기 확인은 PM 실기 몫
