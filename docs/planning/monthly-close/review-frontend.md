# 월마감(/monthly-close) STEP 6 최종 리뷰 — 프론트 파트

- 작성: 2026-11-08 · @프론트팀장
- 기준: 방향서 `docs/planning/project-direction-monthly-close.md` §7·§8·§10, `docs/frontend/monthly-close-d3.md`, `docs/frontend/monthly-close-qa-fixes.md`, `docs/qa/monthly-close-bug-report.md`
- 범위: `src/app/monthly-close/**`, `src/lib/monthly-close/{client,copy,sheet}/**`, 배포 준비(공유 파일·경계·의존성·커밋 경로·번들)
- 규칙: 제품 코드와 git 상태는 바꾸지 않았다. 확인용 스크립트와 재현 테스트는 전부 레포 밖 scratchpad(`…/scratchpad/fe-review/`)에 두었다. dev 서버(localhost:3000)는 새로 띄우지 않았다.
- 표기: [실행] 직접 돌려 확인 / [코드] 소스를 읽어 확인 / [인용] 다른 문서 결과를 옮김

---

## 0. 판정

**조건부 통과. 출시 전 필수 수정 1건(MC-FE-01)을 고친 뒤 배포 게이트로 넘긴다.**

- 숨기기(이 제품의 핵심 위험)는 독립 재확인에서 30/30 통과했다. 한 방향, 창 이탈, 새로고침 숨김 시작, 숨김 중 게임 명령 차단이 모두 의도대로 동작한다.
- 공유 파일 diff 0, 경계 테스트 통과, 새 의존성 0, 새 환경변수 0, 클라이언트 번들에 서버 코드와 서비스 키가 들어가지 않는다.
- 새로 찾은 결함 중 출시 전에 고칠 것은 하나다. **재대결(v8) 판에서 상대가 남긴 의견(도발)이 받는 쪽 화면에 뜨지 않는다**(MC-FE-01, 재현 확인). 숨기기나 보안 문제는 아니지만 재대결과 웃음 문구가 G0-6·G0-7 검증 대상이라 그대로 두면 플레이테스트 결과가 오염된다. 고치는 범위는 5줄 안팎이다.
- 나머지 9건(P3 4건, 성능 1건, 정리·테스트 4건)은 출시 후에 고쳐도 된다(§7-2). 그중 피식 응답 중복(MC-FE-03)만은 14일 게이트를 판정하기 전에 고친다.

---

## 1. 직접 실행한 것

| # | 항목 | 결과 |
|---|---|---|
| 1 | `npx tsc --noEmit` | [실행] 오류 0 |
| 2 | `npx vitest run src/lib/monthly-close src/app/monthly-close src/app/api/monthly-close` | [실행] 40개 파일 중 39개 통과, 1개 건너뜀(sim-sweep, 의도된 것). 테스트 716개 통과, 1개 건너뜀, 실패 0 |
| 3 | QA 파일의 `bug()`(`it.fails`) 잔여 | [실행] 0건. 헬퍼 정의만 남아 있다. QA 리포트 §6의 "QA 테스트를 커밋하면 it.fails 16건 포함"은 **지금은 해당 없음** |
| 4 | 숨기기 독립 확인(헤드리스 Chrome, 별도 포트 9361·프로필) | [실행] 30/30 통과(§3). 스크립트: `…/scratchpad/fe-review/hide-check.mjs`, 결과: `…/fe-review/out/hide-check.json` |
| 5 | dev 클라이언트 청크 스캔(`.next/static/chunks/app/monthly-close/**`) | [실행] 서버 모듈·서비스 키 문자열 0(§5) |
| 6 | 운영 문구 팩의 숨기기 시트 합계 | [실행] 3업종 × seed 300개, 소계·합계 불일치 0. 테스트는 대역 fixture로 돌고 있어 운영 팩으로 따로 확인했다(MC-FE-08) |
| 7 | 재대결 도발 누락 재현 | [실행] 격리 vitest(`…/fe-review/vt/rematch-taunt.test.tsx`)에서 재현(MC-FE-01) |
| 8 | dispose 뒤 초인종 재구독 재현 | [실행] `…/fe-review/dispose-leak.ts`: 해제 뒤 도착한 액션 응답이 구독을 1개 새로 만든다(MC-FE-02) |
| 9 | 유휴 CPU(연습 `?mock=playing`, dev 빌드, 10초씩) | [실행] 게임 화면 스크립트 71.6ms/s, 숨김 화면 69.6ms/s(MC-FE-04) |
| 10 | 홈 360px·1366px 캡처 | [실행] 360px에서 2열이 138px씩으로 눌려 문구가 잘린다(MC-FE-05). 제목 "월마감", `noindex, nofollow`, theme-color `#F7F8FA` 확인 |

전체 스위트(`npx vitest run`)는 QA실행자가 같은 시각에 돌리고 있어 중복 실행하지 않았다. 직전 결과는 295개 파일 통과, 실패 0이다(`monthly-close-qa-fixes.md` §4) [인용].

---

## 2. 코드 품질 리뷰

### 2-1. 결함

| ID | 등급 | 위치 | 내용 | 조치 |
|---|---|---|---|---|
| **MC-FE-01** | **P2, 출시 전 필수** | `_screens/GameScreen.tsx:315, 371-383` | 받은 도발을 처리하는 커서 `logSeq`가 판이 바뀌어도 초기화되지 않는다. 엔진의 `game.log` 순번은 판마다 1부터 다시 시작한다(`engine/core.ts:233-234` `log: [], logSeq: 0`). 그래서 v8 이후 판에서는 순번이 직전 판의 마지막 순번 이하인 로그가 전부 건너뛰어지고, 그 안에 든 상대 도발은 메모도 상태줄도 뜨지 않는다. 보낸 쪽 화면에는 정상으로 보여서 서로 알아채기 어렵다. 재현: 1판 로그 순번 1~3 → 2판 순번 1(도발 5번)은 메모가 바뀌지 않고, 순번 4가 와서야 뜬다. 같은 파일의 `memoLog`는 판 번호로 초기화하는데(283-287행) 이 커서만 빠졌다 | 판 id(`view.game.matchId`)가 바뀌면 커서를 0으로 되돌린다. 첫 마운트(새로고침)만 "이미 본 것" 처리를 유지한다. 예시는 아래. 회귀 테스트 1건(1판 로그 3개 → 2판 순번 1 도발이 상태줄·메모에 뜸) 추가 |
| MC-FE-02 | P3 | `client/liveRoom.ts:297-329`(act), `121-136`(applyView), `244-245`(watchBell) | `dispose()` 뒤에 도착한 액션 응답이 `applyView → watchBell`을 거치며 초인종을 다시 구독한다. `dispose()`가 `bellTopic`을 null로 비우기 때문이다. 해제 함수는 아무도 부르지 않는다. 콜백의 `refresh()`는 disposed 검사로 막혀 동작은 없고, 남는 것은 열린 Realtime 채널 1개다(페이지를 새로 열 때까지). 뒤로 가기를 한 시점에 액션이 날아가고 있을 때만 생긴다 | `applyView`나 `watchBell` 첫 줄에 `if (this.disposed) return` 추가 |
| MC-FE-03 | P3 | `_screens/Result.tsx:41`, `GameScreen.tsx:757-783`, `supabase/monthly-close-gate.sql:94-95` | 피식 응답 상태(`laugh`)가 결과 탭 컴포넌트 안에 있다. 결과 탭 → 게임 탭 → 결과 탭으로 오가면 컴포넌트가 다시 마운트되어 같은 판에 또 응답할 수 있다. 서버와 게이트 SQL 모두 중복을 걸러내지 않으므로 피식률 지표가 부풀 수 있다 | 응답 여부를 판 id 기준으로 `GameInner`로 올리거나, 게이트 SQL에서 (판, 자리)별 마지막 응답 1개만 센다. **14일 게이트를 판정하기 전까지** 고친다 |
| MC-FE-04 | P3(성능) | `GameScreen.tsx:386-400` | 250ms 틱마다 `GameInner` 전체(DOM 약 1,300개)를 다시 그린다. 숨겨 있어도, 카운트다운이 없어도 마찬가지다. dev 빌드 기준 초당 약 70ms(코어 하나의 7%)이고, 운영 빌드는 그보다 몇 배 낮을 것으로 본다[추정]. 회사 노트북에서 배터리와 팬 소음 정도의 영향이다 | 숨김 중이고 만료될 메모·메시지가 없으면 틱을 건너뛴다. 판 창(`PaneGrid`)은 specs가 같을 때 memo 처리한다 |
| MC-FE-05 | P3 | `_screens/Home.tsx:92`(인라인 `gridTemplateColumns` 2열) | 1024px 미만에서도 2열이다. 360px에서는 열마다 138px라 양식 라디오와 경보 설명이 잘린다. 링크로 들어오는 사람은 입장 대화상자로 가므로 홈은 직접 영향이 적다 | 1024px 미만에서 1열로 바꾼다(인라인 스타일을 클래스와 미디어쿼리로 옮김) |
| MC-FE-06 | P3(D3에서 넘어온 것) | `_screens/Placement.tsx` | 모바일 배치 방식(UX §5: 항목 줄 탭 → 칸 탭 → 가로/세로 토글)이 아직 PC와 같은 "시작 칸 → 끝 칸" 방식이다. 큰 [자동 배치]가 있어 진행이 막히지는 않는다 | 모바일 실사용 피드백을 보고 결정 |

**MC-FE-01 수정 예시**(페이지 개발 영역, 판단은 수정 담당이 한다)

```ts
const logMatch = useRef<string | null>(null);
// effect 안, view.status가 playing·ended일 때
const log = view.game.log;
if (logMatch.current !== view.game.matchId) {
  // 첫 마운트(새로고침)는 지금까지의 로그를 이미 본 것으로, 재대결 새 판은 처음부터 처리
  logSeq.current = logMatch.current === null ? (log.length ? log[log.length - 1]!.seq : 0) : 0;
  logMatch.current = view.game.matchId;
}
```

### 2-2. 죽은 코드와 임시 코드

| 위치 | 내용 | 판단 |
|---|---|---|
| `GameScreen.tsx:182-183` `void cmd`, `468` `void practiceCoach`, `572` `okKey === 'copied' ? 'copyFail' : 'copyFail'`(양쪽 같은 값), `968` 재수출 `export { INDUSTRIES, setPracticeDone }` | 쓰지 않는 값과 의미 없는 삼항 | 정리(MC-FE-07) |
| `Battle.tsx:58, 106-107` `memoStore` | 값을 넣는 곳이 없어 106행 분기가 항상 거짓이다. 메모 다시 보기는 `GameScreen`의 `memoLog`가 맡는다 | 정리 |
| `Battle.tsx:205-206` `void rememberMemo`, `415` 재수출, `liveRoom.ts:441` 재수출 | 사용처 없음 | 정리 |
| `sheet/disguise-fixtures.ts`, `_components/sheet/CellStateSampler.tsx` | 테스트에서만 import한다. 운영 import는 0이라 번들에 들어가지 않는다. **대역 fixture가 서비스 문구로 쓰이는 곳은 없다**(운영 시트는 `pack.disguise`를 쓴다, `GameScreen.tsx:412`) | 남겨도 된다. 다만 숨기기 시트 합계 테스트(`disguise.test.ts`, QA DIS-01)가 이 fixture로만 돈다(MC-FE-08) |
| `client/mockViews.ts`, `staticController.ts` | 운영 경로에서는 `blankWaitingView`(자리 없을 때 훅 규칙용 빈 view, 화면에 그리지 않음)와 연습 `?mock=` 미리보기만 쓴다 | `?mock=`는 G0-5 눈 테스트용이라 의도된 것이다. G0-5가 끝나면 제거하거나 테스트 표시(`mc:test`) 조건을 건다(MC-FE-09) |
| `copy/CHANGES.md`, `copy/REVIEW-LINES.txt` | 코드가 아닌 기록 문서다. import하지 않아 번들에 들어가지 않는다 | 커밋해도 된다(REVIEW-LINES는 PM의 G0-6 검수 입력) |
| 디버그 흔적(`console.*`, `debugger`, TODO·FIXME) | 0건 | — |
| `any`, `as any` | 0건. `as unknown as`는 JSON 문구 팩 4곳과 그 파생 2곳뿐이다. 팩 모양은 `copy.test.ts`의 zod 스키마가 검사한다 | 허용 |

### 2-3. 메모리·구독 해제

| 대상 | 결과 |
|---|---|
| `GameScreen`: 250ms 인터벌, 저장 토스트 타이머, `mc-absent` 리스너, `store.onChange` | [코드] 모두 해제한다 |
| `useHideKeys`(keydown 캡처·blur·visibilitychange·pagehide), `useCommandMode`(keydown·pointerdown) | [코드] 해제한다. `setTimeout(exit, 0)`과 rAF 2곳은 수명이 짧아 무해하다 |
| `useDocumentTitle` MutationObserver(head 전체) | [코드] 해제한다. 같은 값이면 쓰지 않아 되먹임 고리가 없다 |
| `useViewport`(matchMedia·resize·visualViewport), `DisguiseSheet` resize | [코드] 해제한다 |
| `Placement` 끌기 mouseup | [코드] 끌기가 끝나면 해제한다 |
| `usePracticeRoom` 250ms tick | [코드] 해제한다 |
| `LiveRoom.dispose()`: 폴링·기한·초인종 타이머, 초인종 구독 | [코드·실행] 해제한다. 예외 하나가 MC-FE-02(해제 뒤 도착한 응답이 다시 구독) |
| `bell.ts`: import가 끝나기 전 해제, 4초 실패 타이머 | [코드] 처리한다. 구독마다 Supabase 클라이언트를 새로 만든다(채널만 지우고 클라이언트는 남는다). 방 하나에 1회라 영향은 작다(MC-FE-10) |

### 2-4. 에러 처리

- `api.ts`의 `call()`은 fetch와 JSON 실패를 모두 `NETWORK`로 돌려준다. reject하지 않는다. crypto가 없으면 요청을 보내지 않고 `SERVICE_DOWN`(E4)으로 처리한다. `feedback`은 실패해도 조용히 넘어간다. [코드]
- `LiveRoom`: 오류 코드를 입장 상태로 바꾼다. 방 없음·꽉 참·입장 필요면 폴링을 멈추고, 점검 중이면 5초마다 다시 시도한다. 네트워크 실패가 2회면 "다시 연결 중", 8회면 down이다. `RATE_LIMITED`면 `retryAfterMs`를 지킨다. 액션 응답이 오지 않는 동안 다시 누르면 `WRONG_PHASE`를 낸다(배치만 마지막 1개로 묶음). [코드·인용 liveRoom.test 29건]
- `Placement` 저장 줄은 `controller.place`가 reject하지 않는다는 전제에 기대고 있다. 실전(`call()`)과 연습(noop)은 이 전제를 지킨다. 연습 `wrap()`은 엔진이 예외를 던지면 동기로 던진다. 다만 QA fast-check 5,000 시퀀스에서 예외가 0건이었다. [코드·인용]
- XSS 경로(`dangerouslySetInnerHTML`, `innerHTML`, `eval`) 0건. 비밀키는 헤더로만 보낸다. [코드]

---

## 3. 숨기기 신뢰성 최종 확인

| 동작 | 기대(방향서 §5-4) | 결과 | 근거 |
|---|---|---|---|
| 게임에서 Tab / Shift+Tab / ESC | 숨김 | 통과 | [실행] P1·P7·P8 |
| 숨김 중 Tab / Shift+Tab | 다음 칸 / 이전 칸, 게임 복귀 없음 | 통과(D4→E4→D4) | [실행] P2·P3 |
| 숨김 중 ESC, Tab 5연타 | 숨김 유지 | 통과 | [실행] P4·P5 |
| Ctrl+Tab, Cmd+ESC | 무시 | 통과 | [실행] P9·P10 |
| 이름 상자에서 한글 조합 중 Tab(keyCode 229, code Tab) | 숨김 | 통과(조합 문자 "ㅠ") | [실행] P11. 실제 입력기 확인은 PM DEV-01~04 |
| 창 이탈(blur·visibilitychange hidden) → 복귀(focus·visible) | 숨김, 돌아와도 유지 | 통과 | [실행] P12~P15. pagehide는 [코드] `useHideKeys.ts:98` + QA HIDE |
| 새로고침(자리 있음) | 숨김으로 시작, 첫 sync 보고 `disguise`, 판 노출 프레임 0 | 통과(0/97 프레임, `{"knownVersion":-1,"view":"disguise"}`) | [실행] R3~R5(대기 방). 대전 중 새로고침 0/161은 [인용] QA HIDE-08 |
| 홈에서 방금 만든 방 첫 진입 | 게임 화면 + 공유 패널(예외) | 통과 | [실행] R1 |
| 숨김 중 [의견 남기기]·[Σ]·파일 메뉴 항목·[공유]·이름 상자 Enter | 목록·눌림·이동·패널·발사 0, 복귀 시 튀어나오는 팝오버 0 | 통과 | [실행] P17~P21, R2 |
| 한 방향 | 게임 복귀는 게임(또는 결과) 시트 탭 클릭뿐 | 통과 | [코드] `store.show()` 호출처는 `GameScreen.tsx:508` 한 곳뿐이다 |
| Ctrl/Cmd+S | 저장 창 차단, 보이는 레이어에 "저장됨" | 통과 | [실행] P16, [인용] HIDE-26 |
| 전환 시간 | p95 50ms 이하 | 통과(`mc-hide` 최대 0.1ms, 화면 반영까지 p95 28.9~36.9ms) | [실행] P22, [인용] D3 §3 |
| 공유 시트 예외(BUG-21) | 공유 시트 1번 = 숨김 0번 | 코드 수정 완료, **실기기 미확인** | PM DEV-05·06 |

키 처리 순서도 확인했다[코드]. `useHideKeys`와 `useCommandMode`는 둘 다 window 캡처 단계에서 듣는다. 등록 순서가 바뀌어도(입장 뒤 `tabHides`가 바뀌면 다시 등록됨) 명령 모드는 Tab·ESC를 다루지 않고 `store.view !== 'game'`이면 빠진다. 그래서 숨기기가 가로채이는 경로는 없다.

---

## 4. D3 개발 완료 기준(방향서 §10) 현황

| # | 기준 | 상태 |
|---|---|---|
| 1 | type-check, 클린 build, 전체 test | type-check 0 [실행], 전체 test 실패 0 [인용]. **클린 build는 아무도 아직 돌리지 않았다** → 배포엔지니어가 worktree에서(BLD-01·PERF-01·SEC-07·LEAK-09) |
| 2 | MemoryStore 두 브라우저 한 판 완주 + 새로고침 복원 | 충족. HTTP 한 판 전 항목과 실제 클라이언트 코드 결합, 헤드리스 두 컨텍스트로 확인 [인용 D3 §1]. 사람이 두 PC로 경보 켠 판을 끝까지 두는 확인은 PM DEV-11(배포 승인 전) |
| 3 | 연습이 서버 없이 끝까지 돌고 "동료 초대" 버튼 | 충족 [코드 `GameScreen.tsx:878-890`, 인용 `practice.test.ts` 컷 1~8]. QA PRAC-03·07은 아직 실행하지 않았다 |
| 4 | 1만 판 시뮬 G0-3 | 충족 [인용]. 힌트 항목은 출시 후 실측으로 판정하기로 진행자가 결정했다(백엔드 qa-fixes §0) |
| 5 | 숨기기 p95 50ms 이하 | 충족 |
| 6 | 투영 속성 테스트 유출 0 | 충족 [인용, 백엔드] |
| 7 | §8-2 누수 표 자체 점검 + 공유 파일 diff 0 | 충족. #1~#5 메타 [실행], #6 주황 링 덮기 [코드 css:95], #7 스크롤바 [인용 BUG-19], #9 AdSense는 운영 빌드에서 LEAK-09로 확인(아래 §7), #11·#12 포털·`<dialog>`·네이티브 창 0 [코드] |

---

## 5. 배포 준비

### 5-1. 게이트 항목

| 항목 | 결과 |
|---|---|
| `git diff --stat src/app/layout.tsx src/app/providers.tsx src/app/globals.css` | [실행] **0**(작업 트리와 인덱스 모두) |
| 그 밖의 §8-1 파일(`robots.ts`·`sitemap.ts`·`manifest.ts`·lock·`tsconfig`·`vitest.config`·`tailwind.config`·`vercel.json`·`tests/setup.ts`) | [실행] diff 0. 루트에 `next.config.*`·`middleware.*` 없음 |
| `boundaries.test.ts` | [실행] 17건 통과(server/ 역참조 0, 순수 모듈 위반 0, 엔진 시각·난수 0, 서비스 키는 server/에서만, 다른 앱 import 0) |
| 새 의존성 | [실행] **0**. `package.json` 변경은 세션 이전부터 있던 `test:redline` 삭제 1줄뿐이고 lock은 그대로다. 월마감이 쓰는 패키지(react, next, lucide-react, @supabase/supabase-js, zod, fast-check, @testing-library/react, vitest)는 전부 HEAD의 `package.json`에 이미 있다 |
| 환경변수 | [코드] **새로 등록할 키 0**. 읽는 키는 `NEXT_PUBLIC_SUPABASE_URL`·`NEXT_PUBLIC_SUPABASE_ANON_KEY`(HEAD의 /pae가 이미 씀), `SUPABASE_SERVICE_ROLE_KEY`(/pae·/dongne가 이미 씀), `VERCEL`·`VERCEL_ENV`(Vercel이 자동으로 넣는 값) |
| 월마감 외부 의존 | [실행] 월마감 코드가 import하는 `@/` 경로는 전부 월마감 안이다. 커밋하지 않은 다른 파일에 기대지 않으므로 HEAD + 아래 경로만으로 빌드된다 |

### 5-2. 커밋할 경로(배포엔지니어용, 명시 경로만)

현재 월마감 관련 미추적 파일은 172개다(`git status --porcelain -uall | grep monthly-close`, 전부 `??`, 이미 추적·스테이징된 것 0). **이 리뷰 도중에도 QA실행자가 `src/lib/monthly-close/qa/reverify.qa.test.tsx`를 새로 만들었다.** STEP 6 리뷰 문서도 더 생기므로, 커밋 직전에 아래 경로로 목록을 다시 뽑는다.

**코드·자산(폴더 전체가 월마감 전용, 다른 앱 파일 섞임 0)**
```
src/app/monthly-close/                 (58)  화면·컴포넌트·CSS·화면 테스트
src/app/api/monthly-close/             (9)   라우트 6개 + _util + 테스트 2
src/lib/monthly-close/                 (81)  protocol·constants·coords·client·copy·sheet·engine·server·qa
public/monthly-close/                  (3)   icon.svg · apple-icon.png · og.png
supabase/monthly-close-schema.sql
supabase/monthly-close-teardown.sql
supabase/monthly-close-gate.sql
scripts/monthly-close-smoke.mjs              배포 후 POST-01에 필요
```
`src/lib/monthly-close/qa/**`는 포함을 권장한다. `it.fails`가 0건으로 줄어 모두 회귀 테스트가 됐다. 게이트 시간은 늘어난다(engine.qa 약 39초, hide.qa 약 26초).

**문서**
```
docs/planning/sheetbattle-plan.md
docs/planning/sheetbattle/                   r1-creative · r1-critic · r2-creative-proposal · r2-critic-analysis
docs/planning/project-direction-monthly-close.md
docs/planning/monthly-close/                 lead-{design,frontend,backend}.md + STEP 6 review-*.md
docs/planning/monthly-close-final-review.md  (STEP 6 기획팀장 산출, 생기면)
docs/design/monthly-close-ux-spec.md
docs/design/monthly-close-ui-spec.md
docs/design/monthly-close-design-final.md
docs/frontend/monthly-close-components.md
docs/frontend/monthly-close-d3.md
docs/frontend/monthly-close-qa-fixes.md
docs/frontend/monthly-close-d3-hide-timing.mjs
docs/backend/monthly-close-d0-freeze.md
docs/backend/monthly-close-d3-review.md
docs/backend/monthly-close-qa-fixes.md
docs/backend/monthly-close-sim.md
docs/qa/monthly-close-test-plan.md
docs/qa/monthly-close-bug-report.md
```

**권장 명령(메인 트리에서 커밋할 경우)**
```
P="src/app/monthly-close src/app/api/monthly-close src/lib/monthly-close public/monthly-close \
supabase/monthly-close-schema.sql supabase/monthly-close-teardown.sql supabase/monthly-close-gate.sql \
scripts/monthly-close-smoke.mjs docs/planning/sheetbattle-plan.md docs/planning/sheetbattle \
docs/planning/project-direction-monthly-close.md docs/planning/monthly-close \
docs/design/monthly-close-ux-spec.md docs/design/monthly-close-ui-spec.md docs/design/monthly-close-design-final.md \
docs/frontend/monthly-close-components.md docs/frontend/monthly-close-d3.md docs/frontend/monthly-close-qa-fixes.md \
docs/frontend/monthly-close-d3-hide-timing.mjs docs/backend/monthly-close-d0-freeze.md \
docs/backend/monthly-close-d3-review.md docs/backend/monthly-close-qa-fixes.md docs/backend/monthly-close-sim.md \
docs/qa/monthly-close-test-plan.md docs/qa/monthly-close-bug-report.md"
# (monthly-close-final-review.md가 생겼으면 P에 추가)
git add -- $P
git commit -m "feat: 월마감(/monthly-close) …" -- $P   # 경로 지정 커밋(--only): 인덱스의 flight 45개는 스테이징된 채 남는다
git show --stat HEAD | grep -c flight                    # 기대 0
```
`git commit` 뒤에 경로를 빼면 인덱스에 스테이징된 flight 45개가 같이 들어간다. 반드시 경로를 붙인다.

### 5-3. 섞이면 안 되는 것

| 묶음 | 상태 | 내용 |
|---|---|---|
| flight | **인덱스에 스테이징됨(`A`) 45개** | `src/app/flight/**`, `src/lib/flight/**`, `docs/{design,planning,qa}/flight-*`, `docs/planning/project-direction-flight.md`. 월마감과 같은 커밋에 넣지 않는다(위 경로 지정 커밋으로 분리) |
| 추적 파일 수정(` M`) | 월마감과 무관 | `package.json`(`test:redline` 삭제, 세션 이전부터), `CLAUDE.md`, `.claude/agents/devops/deploy-engineer.md`, `.claude/launch.json`, `teams/workflows/deploy.yaml`, moira 5개(`src/app/moira/{result,routes}/page.tsx`, `src/lib/moira/{scenario.ts,server/compute.ts,server/odsay.ts}`, 11-02 수정) |
| 다른 미추적 앱 | 월마감과 무관 | `src/app/coffeeball/**`(7), `src/lib/coffeeball/**`(4), `src/app/office/**`(4) |
| 다른 미추적 문서 | 월마감과 무관 | `docs/design/office-clay-{design.md,spec.json}`, `docs/planning/{absurd-mnemonic-plan,dogpic-gallery,dogprompt-library,dogprompt-seeding-plan,dogstar-plan}.md`, `docs/planning/dogstar/**`(4), `docs/research/rewind/audit/{ddg,naver}.html` |

방향서 §10 배포 1(worktree에서 게이트)은 그대로 유효하다. 메인 트리에서 빌드하면 coffeeball·office·flight가 섞인 상태를 검증하게 된다.

---

## 6. 번들: 서버 코드·서비스 키 유입 여부(정적 확인)

- **import 그래프**[코드]: 클라이언트 진입점은 `Home`·`PracticeApp`·`RoomApp`(`'use client'`)과 `McRoot`다. 여기서 닿는 모듈은 `client/`, `copy/`, `sheet/`, `coords`, `constants`, `protocol`, `engine/placement`·`engine/rng`(순수 TS)뿐이다. `server/`를 import하는 비서버 파일은 0이다(boundaries ①). `node:*`, `crypto`, `next/server`를 import하는 파일은 `server/`와 `api/` 9개뿐이다.
- **키**[코드]: `SUPABASE_SERVICE_ROLE_KEY`는 `server/db.ts`에서만 읽는다(boundaries ④). 클라이언트가 읽는 것은 `NEXT_PUBLIC_*` 두 개(공개 anon 키, 초인종 구독용)뿐이다. 테이블은 RLS 정책 0개와 권한 회수로 막혀 있다(라이브 확인은 POST-02).
- **supabase-js**는 `bell.ts`가 처음 쓸 때 동적으로 import한다. 홈과 연습 번들에는 들어가지 않는다.
- **dev 청크 스캔**[실행]: `layout.js`·`page.js`·`[code]/page.js`·`practice/page.js`에서 `SUPABASE_SERVICE_ROLE_KEY`·`service_role`·`monthly-close/server`·`store-supabase`·`store-memory`·`server/db`·`node:crypto`·`createHash`는 모두 0건이다. 청크에 실린 월마감 모듈 목록에도 server/가 없다.
- 운영 빌드의 `.next/static/**` 최종 grep과 First Load JS 기록은 배포엔지니어 worktree에서 한다(SEC-07·PERF-01).

---

## 7. 수정 요청

### 7-1. 출시 전 필수

| ID | 담당 | 내용 | 완료 확인 |
|---|---|---|---|
| **MC-FE-01** | 프론트(페이지 영역 `GameScreen.tsx`) | 재대결 판에서 받은 도발이 뜨지 않는 문제. 판 id가 바뀌면 `logSeq`를 초기화한다(§2-1 예시) | 회귀 테스트 1건 추가 → 월마감 범위 vitest·tsc 재통과 |

코드 밖의 출시 전 게이트는 이미 정해진 대로 간다. 배포엔지니어 worktree에서 클린 빌드, BLD-01·PERF-01·SEC-07·LEAK-09(운영 `next start`에서 `ins.adsbygoogle` 0). 배포 승인 전 PM 실기는 DEV-01(맥 한글 입력기 Chrome), DEV-05의 숨기기 3항목(아이폰), DEV-07(사람 눈), DEV-11(두 PC 경보 판)이다.

### 7-2. 출시 후 가능

| ID | 등급 | 내용 | 시점 |
|---|---|---|---|
| MC-FE-03 | P3 | 피식 응답이 판당 중복될 수 있음 → 지표가 부풂 | **14일 게이트 판정 전** |
| MC-FE-02 | P3 | 해제 뒤 도착한 응답이 초인종을 다시 구독 → disposed 검사 1줄 | 다음 배포 |
| MC-FE-04 | 성능 | 250ms 틱의 전체 재렌더 → 숨김·유휴 중 건너뛰기, 판 창 memo | 다음 배포 |
| MC-FE-05 | P3 | 모바일 홈 2열 압축·잘림 → 1024px 미만 1열 | 다음 배포 |
| MC-FE-06 | P3 | 모바일 배치 UX §5 방식 | 모바일 피드백을 본 뒤 |
| MC-FE-07 | 정리 | §2-2 죽은 코드(void 4곳, 같은 값 삼항, 재수출 3곳, `memoStore`) | 다음 배포 |
| MC-FE-08 | 테스트 | 숨기기 시트 합계 테스트를 운영 팩(`INDUSTRY_PACKS[*].disguise`)으로도 돌림. 이번에는 수동으로 seed 300개 × 3업종, 불일치 0을 확인했다 | 다음 배포 |
| MC-FE-09 | 정리 | 연습 `?mock=` 미리보기를 G0-5 이후 제거하거나 `mc:test` 조건으로 제한 | G0-5 이후 |
| MC-FE-10 | 정리 | `bell.ts` 구독마다 Supabase 클라이언트 생성 → 모듈 단위 1개 재사용 | 여유 있을 때 |

---

## 8. 남은 위험과 인계

1. **실기 미확인 숨기기 항목**: 실제 한글 입력기(맥 Safari, 윈도우 MS 입력기)에서 조합 중 Tab, 아이폰·안드로이드 공유 시트 예외(BUG-21), 키보드 위 시트 탭. 자동화로는 CDP 입력기 흉내까지만 확인했다.
2. **AdSense 자동 광고**: 루트 레이아웃이 운영에서 AdSense 로더를 싣는다(`src/app/layout.tsx:91-98`). 광고 단위는 0개다. 자동 광고가 켜지면 숨기기 시트 위에 광고가 뜰 수 있으므로 LEAK-09로 확인하고, 자동 광고를 켤 때는 `/monthly-close`를 반드시 제외한다(방향서 §2-O). Vercel 공유 서브도메인은 AdSense에 등록할 수 없어 지금 위험은 낮다[추정].
3. **QA 리포트 갱신 필요**: §6 "QA 테스트 커밋 시 it.fails 16건 포함"은 이제 0건이다.
4. 이 리뷰에서 만든 것: dev 서버 MemoryStore의 방 1개(20597, 테스트 표시 켬, 대기 상태로 두면 만료됨), scratchpad 스크립트·캡처(`…/scratchpad/fe-review/`). 레포 파일 변경은 이 문서 1개뿐이다.
