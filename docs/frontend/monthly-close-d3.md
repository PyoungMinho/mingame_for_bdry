# 월마감 D3 통합 — 프론트팀장 메모 (2026-11-07)

범위: `src/app/monthly-close/**`, `src/lib/monthly-close/{client,copy,sheet}/**`, `docs/frontend/**`. 서버 경로(engine/·server/·api/·supabase/)와 동결 파일 5개는 손대지 않았다.
완료 조건: `npx tsc --noEmit` 0건, `npx vitest run src/lib/monthly-close src/app/monthly-close src/app/api/monthly-close` → 30 files / 479 passed / 1 skipped(백엔드 쪽 skip).

## 1. 실서버 HTTP 한 판 (로컬 dev, MemoryStore)

세 가지로 돌렸다. 스크립트는 레포 밖 scratch에 두었고(일회성), 같은 내용을 백엔드 `scripts/monthly-close-smoke.mjs`가 상시 점검으로 갖고 있다.

| 점검 | 방법 | 결과 |
|---|---|---|
| A. 원시 HTTP 한 판 | 비밀키 2개(+제3자 1개), `x-mc-test: 1`. 방 만들기 → sync(-1/같은 version) → 입장 전 sync → 초안 배치 → 입장·재입장·제3자 → 배치 오류(겹침·2척 확정·재배치) → 대전 22라운드(검산 3회: 오답 잠금·`LOCKED` 423·늦은 정답·동시 정답, 힌트 열·행·3×3, 도발+쿨다운, 차례인 사람 숨기기→시계 정지·복귀, 경보 통과·실패→다음 발 `skip`, 이미 쏜 칸, 차례 아님) → 종료·reveal 3척 → feedback 204/남의 매치 404/transport/lines_shown → v8 재대결(선공 교대·초기화·새 matchId) → 시간 초과 20초(`timeout` 사건, 연속 1) → 부재 처리 거부 → 새로고침 sync(-1) 복원 → 대전 중 재입장 → 대전 중 leave=기권 → 상대 나간 뒤 재대결 `rematch_closed` | 모든 응답 봉투(`serverNow`, `Cache-Control: no-store`) 정상, 금지 키·맞지 않은 상대 칸 주소·비밀키 원문 유출 0, events seq 오름차순·8개 이하. 계약 불일치 0 |
| B. 실제 클라 코드(`LiveRoom`)를 서버에 붙임 | esbuild로 묶고 AsyncLocalStorage로 키 2개를 갈라 fetch에 헤더를 넣음 | seated/needJoin/full/notFound 매핑, 액션 pending 중복 거부, NOT_YOUR_TURN+view 반영, presence(숨김) 반영, `now()` 보정(<1s), 새로고침 복원, 기권·재대결 폴링 반영 — 문제 0 |
| C. 헤드리스 Chrome 두 컨텍스트(일반+시크릿 대역) | CDP로 화면 클릭 | 홈 health 배너 없음 → [공유 문서 만들기] → 방 첫 진입 게임 화면+공유 패널 → B 입장 → 자동 배치·완료 → 클릭 2번(선택→반영)으로 6발 → 메모 표시 → A 새로고침 = 숨김으로 시작 → 게임 탭 복귀 시 결과·내 항목 그대로 |

참고로 남긴 관찰(버그 아님): 같은 순간 보낸 두 정답이라도 **배달 시각 기준 경과**가 200ms 넘게 차이 나면 늦은 쪽은 확정 뒤 도착해 `INVALID/quiz_stale`이 된다(설계대로). A 스크립트의 "검산 중 힌트 → hint_blocked"는 그 판에서 B가 힌트를 이미 다 써서 확인하지 못했다(엔진 단위 테스트 몫).

## 2. 고친 것

**계약·실서버 경로**
1. 홈이 늘 "공유 서버에 연결할 수 없습니다"를 띄움 — `GET /health`는 `{db}`만 오는데(봉투 없음, protocol `HealthOk`와 일치) `call()`이 `ok` 키가 없으면 NETWORK로 봤다. `api.ts`에 health 전용 읽기 + `healthIsDown()`.
2. 입장 대화상자에서 [열기]를 누른 사람이 곧바로 숨기기 시트로 떨어짐 — join 응답이 외부 저장소를 바꾸는 순간 동기 렌더+effect가 "새로고침이면 숨김으로 시작"을 먼저 실행했다(`joinedHere`를 await 뒤에 세움). 요청 전에 표시. 브라우저(C)에서 발견, act 밖 jsdom 테스트로 재현·고정.
3. 홈에서 방금 만든 방도 숨김으로 시작(A9을 첫 진입에도 적용) — `markFreshRoom/takeFreshRoom`(sessionStorage 1회)으로 첫 진입만 게임 화면 + 공유 패널. 그 뒤 새로고침은 다시 숨김으로 시작.
4. transport 지표가 늘 `bell:false` — 첫 sync 직후 보냈는데 그때는 초인종 구독 결과가 아직 없다. 연결 결과(onStatus)가 온 뒤 세션당 1회.
5. StrictMode(개발) 마운트→해제→마운트 뒤 초인종 재구독 안 됨 — `dispose()`가 `bellTopic`을 남겨 두었다.
6. 백엔드팀장 D3 요청 반영: ① 대기·배치 중 손님 `leave`가 성공해도 403 `NOT_JOINED` → 성공으로 처리(입장 대화상자 안 비침, 폴링 정지) ② `RATE_LIMITED`의 `retryAfterMs`를 sync 재시도 하한으로(join은 기존대로 상태 문장) ③ 503 `SERVICE_DOWN` → E4(기존 매핑 확인) ④ `identity.ts`의 Math.random 대체 제거 — 비밀키·actionId는 `crypto.getRandomValues`만, 없으면 요청을 보내지 않고 SERVICE_DOWN(E4). 숨기기 시트 seed만 비밀이 아니라 시각으로 대체.

**숨기기 시트 Tab = 다음 칸 (진행자 확인 버그)**
- 원인: 숨긴 뒤 포커스가 사라진 게임 칸(또는 이름 상자)에 남아 Tab이 브라우저 포커스 이동이 됨.
- 숨는 순간 포커스를 숨기기 시트 격자로(PC만, 모바일은 키보드를 건드리지 않게 생략). 격자 밖(이름 상자·body)의 Tab/Shift+Tab은 `useHideKeys`의 `onHiddenTab`이 "다음/이전 칸"으로 처리. 한 방향 유지(게임으로 안 돌아감).
- 실제 Chrome에서 `D4 → E4` 확인.

**모바일(1024px 미만)** — `useIsMobile`(matchMedia), `useKeyboardOffset`(visualViewport, 80px 초과만 키보드)
- 상단바 40px(파일명·[공유]·[⋯]) + 이름 상자 표시 전용·✕✓ 없음, 메뉴줄·도구줄 생략.
- 창 1개 + 시트 탭 `[내 시트][상대 시트] [손익]`(장식 탭·[+] 없음). 내 차례·검산이 오면 [상대 시트]로만 자동 전환, 배치 중 [내 시트].
- 메모 줄(최근 메모, 없으면 상태 문장) + 확정 줄: 대전 `H8 반영` / 검산 `확인` / 힌트 `이 범위 검토` / 배치 `[배치 완료][자동 배치]`. 칸 탭 = 선택, 같은 칸 다시 탭 또는 버튼 = 반영.
- [⋯] 메뉴: 의견 남기기·검토 의견(Σ n)·인수인계서·문서 닫기/새 문서.
- 시트 탭 줄은 키보드 위에 붙고, 숨기기 탭 한 번 = 입력칸 blur + 숨기기. 경보 칩 `[전환]`.
- 판 9열(A~I) 가로 스크롤 0, 1~8행 40px. 360×640에서 판 8행·메모 줄·확정 줄·시트 탭이 한 화면(측정: 8행 하단 436px, 탭 하단 640px).

**페이지↔컴포넌트 미결 요청**
- `TopBar onShare`(onClickCapture 우회 제거), `MobileTopBar onShare/shareDisabled/moreOpen`.
- 기능 버튼 비활성 = `aria-disabled`(+클릭 무시): `Button`(cmd 있을 때), TopBar [공유]. CSS도 `[aria-disabled='true']`를 비활성 모양으로.
- 격자 루트 `data-mc-grid-focus`(`SheetGrid gridFocus`) — 명령 이동 모드 종료 시 포커스 복귀 대상.
- 메뉴 열림 표식 `data-mc-menu-open`(MenuBar 팝업·Dropdown).
- 명령 이동 순서: `:`가 든 이름을 모두 빼던 것을 메뉴 항목 접두(`file: help: taunt: more: hint-kind:`)만 빼도록 — 결과 탭 피식 3버튼(`laugh:*`)이 A6 순서에 들어감. 실제 cmd 이름(`save-v8 copy-text new-doc name-toggle open-result more`)을 CMD_ORDER에 맞춤. 숨기기 레이어 안 버튼 제외.
- 연습 코치 말풍선: 인라인 토스트 → 메모 컴포넌트 재사용(`.mc-coach`, 머리 줄 `연습 n/8`, UX §2-5), 게임 레이어 안이라 숨기면 같이 사라짐.
- 배치 화면의 하드코딩 문장 → 문구 팩 status(`overlap rangeLen outOfBoard badAddr conflict autoPlacedBtn`).

**배치 끌기·메모 재표시**
- PC 배치: 놓인 항목을 끌어 옮김(잡은 칸 기준, 점선 미리보기, 판 밖·겹침은 빨간 점선 + 저장 안 함). 끌지 않고 놓으면 기존 클릭 동작(다시 놓을 대상 고르기). 모바일은 UX §5대로 끌기 없음.
- 닫힌 메모: 이번 판에 띄운 메모를 칸별로 기억, 삼각형 칸에 마우스를 올리면 3초 다시 표시(판이 바뀌면 비움).

## 3. 숨기기 전환 시간 (D3 기준 5)

- 측정 스크립트: `docs/frontend/monthly-close-d3-hide-timing.mjs` (헤드리스 Chrome + CDP, 의존성 없음). dev 서버를 띄운 채 `node docs/frontend/monthly-close-d3-hide-timing.mjs`.
- 두 값을 낸다. ① 앱이 남기는 `performance.measure('mc-hide')`(키 처리기 → `data-view` 변경, 동기) ② 종단: `keydown.timeStamp` → 다음 프레임(rAF 뒤 task)에서 `data-view=disguise` 확인.
- 로컬 결과(맥, dev 빌드, 40회): ① p95 0.1ms ② p95 28.9~36.9ms(3회 실행) → **목표 50ms 이하 통과**. ②는 프레임 대기(최대 16.7ms)를 포함한 값이라 실제 화면 반영 상한에 가깝다.
- jsdom 테스트는 측정 경로(`mc-hide` measure 생성)만 확인한다(`d3.test.tsx`). 숫자 판정은 실기(QA V26)와 이 스크립트로.

## 4. 추가한 테스트

- `client/liveRoom.test.ts`(29): version 규칙(작은·같은 version 무시, 객체 동일성), presence 덮어쓰기(changed:false/true), 오류 코드→entry(404/409/403/503·CAPACITY, 폴링 정지·계속), 네트워크 2회 reconnecting·8회 down·회복, 거부 응답 view 반영, LOCKED·INVALID 사유, pending 중복, 키는 헤더로만, needJoin→join, serverNow 보정, 기한 refresh, 초인종 v 비교·300ms, transport 1회, StrictMode 재구독, reportView keepalive, 경보 보고, 재대결 만료, D3 백엔드 요청 3건.
- `client/useMcRoom.test.tsx`(4): 마운트 시작, 탭 복귀 즉시 sync, 해제 뒤 폴링·leave 없음, StrictMode, 메서드 참조 안정.
- `_screens/d3.test.tsx`(15): 숨긴 뒤 Tab=다음 칸(격자 안·이름 상자), mc-hide measure, 모바일 구조·자동 전환·선택→확정·숨기기 탭 blur·[⋯] 메뉴·키보드 높이, 배치 끌기(성공·겹침), 명령 이동 대상, 격자 표식·aria-disabled, 메모 재표시, 입장 직후 숨김 안 됨(act 밖 재현), 새로고침 숨김 시작·방금 만든 방 예외.
- `client/misc.test.ts`: 난수는 crypto만(Math.random 미호출).

## 5. 남은 것

1. 모바일 숨기기 시트: 4열 표시에서 A열 병합 제목(1~2행)이 비어 보인다(병합 시작 열이 폭 0이면 `SheetGrid`가 병합째 건너뜀). 병합을 첫 보이는 열로 옮기는 처리 필요(컴포넌트, 작음).
2. 모바일 배치의 "항목 줄 탭 → 칸 탭 → 가로/세로 토글"(UX §5)은 아직 PC와 같은 "시작 칸 → 끝 칸 탭" 방식. 자동 배치는 크게 있다.
3. 실기 항목(QA): V13 한글 IME 조합 중 Tab, V19 아이폰·안드로이드 키보드 위 시트 탭, V8 스크롤바, V26 다른 기기 전환 시간.
4. 클린 `npm run build`·`npm run test` 전체는 이번에 돌리지 않았다(지정 범위 테스트와 tsc만). 배포 전 게이트에서 확인.
5. 공유 파일·package.json은 건드리지 않았다(`package.json`의 변경 표시는 작업 전부터 있던 것).
