# 월마감 D0 동결 — 백엔드팀장 검토·결정 기록

- 작성: 2026-11-07 · @백엔드팀장 (프론트팀장 D0 초안 검토 후 직접 보정)
- 대상: `src/lib/monthly-close/{protocol,constants,coords,copy/schema,client/controller}.ts` + 신규 `boundaries.test.ts`
- 상태: **동결.** `npm run type-check` 통과, `npx vitest run src/lib/monthly-close` 47개 통과(coords 30 + boundaries 17).
- 이후 변경은 두 팀장 합의(★ 상수는 기획팀장 확인). 4명은 이 파일들을 기준으로 착수한다.

## 1. 프론트팀장 질문 5개 — 답

| # | 질문 | 결정 | 이유 |
|---|---|---|---|
| 1 | `NOT_JOINED`(403) 신설, 꽉 찬 방은 ROOM_FULL 우선 | **승인.** 판정 순서를 protocol에 고정: 키 형식(INVALID `key`) → 방 없음(404) → 내 자리(통과) → 두 자리 다 참(ROOM_FULL) → 그 외 NOT_JOINED. 자리 없는 사람에게는 `view`를 절대 싣지 않는다 | 빈자리가 있을 때만 입장 대화상자가 의미가 있다. 새는 정보는 "2인 판 진행 중"뿐(방향서 §2-C와 같음) |
| 2 | sync "변경 없음"에 `presence` | **승인하되 모양을 고침.** `oppPresent` 삭제(나가기는 버전 값인 `opp.present`로 이미 온다), `presence: {oppLastSeenAt, oppHidden} \| null`을 sync **두 갈래 모두**에 싣는다. 클라는 version을 바꾸지 않고 `view.opp`의 두 필드만 덮어쓴다(controller 규칙 7) | "자리에 있음"과 "접속 중"이 한 이름에 섞여 있었다. 접속은 lastSeenAt으로만 판정 |
| 3 | 차례인 사람이 숨기·복귀할 때 version | **올린다.** 시계 정지·재개는 `mc_rooms.state`의 기한을 바꾸는 상태 전이라 버전 비교 저장이 필요하다. 차례가 아닌 사람의 숨기·복귀는 안 올린다(presence). 정지 시작은 `mc_players`의 view_state 변경 시각으로 **소급**한다 | 숨기기 sync와 상대 발사가 동시에 오면 정지를 놓칠 수 있다. 소급하면 다음 요청에서 손해 없이 바로잡힌다. 정지 화면에는 `budgetEndsAt`(예산이 바닥나 다시 도는 시각)을 함께 줘 상대 화면이 그 시각에 refresh한다 |
| 4 | `lastEvent` 하나라 사건을 놓침 | **짧은 목록으로 바꿈.** `RoomView.events`(최상위, 최근 `EVENTS_KEEP`=8개, 방 전체 seq). 빈틈이 있으면 마지막 것만 문장으로 | 기존 위치(GameView)로는 대기·배치 중의 joined·left·autoPlaced를 아예 보낼 수 없었다. 저장 비용은 사건 8개 고리 버퍼라 무시할 수준 |
| 5 | matchId, draw/cap, HTTP 표 | matchId는 **`game.matchId`(항상 문자열)로 이동**, 매치 행은 status가 playing이 될 때 생성. `draw`(같은 라운드 동시 2척)/`cap`(30라운드 상한, 승자 있을 수도 무승부일 수도) **구분 승인**. HTTP 표 **승인 + `CAPACITY`(503) 추가**. 클라 분기는 HTTP 숫자가 아니라 본문 error 코드로 | room에 두면 waiting·placing에서 null이라 화면마다 `!`가 필요했고, 배치 중 상대가 나갈 때 고아 매치 행이 생긴다. 409가 셋이라 숫자 분기는 불가. 활성 방 상한 초과를 "DB 다운"과 구분해야 운영에서 원인을 읽는다(화면은 같은 E4) |
| + | `serverNow` 봉투, `status` 최상위 | **둘 다 승인.** 오류 응답에도 시계 보정이 필요하고, TS 판별 유니언은 최상위 키여야 좁혀진다 | — |

## 2. 그 밖에 바꾼 것 (유출·구현 가능성 점검 결과)

1. **fire 사건의 slot은 `sunk`일 때만**(타입 강제). 반려(hit) 단계에 slot을 주면 맞힌 배의 길이(=남은 칸 수)가 샌다. 내 판이 맞은 경우는 `me.ships`로 계산.
2. **QuizView: `mine = 'open'`이면 `status = 'open'`, `settleAt = null`만 허용**(타입 강제). 'settling'은 "상대가 이미 맞혔다"는 신호라 풀이 중인 사람에게 보내지 않는다.
3. `TurnClock` paused를 quiz / hidden 두 변형으로 나누고 hidden에 `budgetEndsAt` 필수.
4. `MC_KEY_RE`(소문자 hex 32자 = 128비트), `ROOM_CODE_RE`(10000~99999), InvalidReason `key` 추가. 재입장 때 join 본문의 닉네임·업종은 무시.
5. `VIEW_FORBIDDEN_KEYS`에 `hostKey`·`actionIds`·`deliveredAt`·`reveal` 추가, 서버 내부 비밀 필드 이름을 이 목록과 맞추도록 명시.
6. feedback: 서버가 matchId–방 번호–참가자 키를 대조, feedback은 매치·사람당 1건.
7. `constants.ts`에 `EVENTS_KEEP = 8`(기술 값). ★ 값은 손대지 않음.
8. `boundaries.test.ts` 신설: 방향서 §7 규칙 4 ①②③ + 서비스 키 위치 + 다른 앱 import 금지를 소스 검사로 강제. 아직 없는 폴더는 빈 채로 통과하고 파일이 생기면 바로 검사된다. 규칙 함수 자체도 가짜 소스로 검증. 계약 타입 회귀(대전 중 reveal 불가, hit+slot 불가 등)는 `@ts-expect-error`로 type-check에서 잡는다.
9. coords.ts·copy/schema.ts: 서버 관점 문제 없음, 변경 없음.

## 3. 구현 가능성 확인 (API·DB 설계자 기준)

| 항목 | 이 타입으로 되는가 | 구현 메모 |
|---|---|---|
| 버전 비교 저장 | 됨 | `room.version` = `mc_rooms.version`. 액션·기한 처리·배달 기록·시계 정지가 모두 같은 CAS 경로 |
| 서버 시계 | 됨 | 모든 응답 봉투 `serverNow`, 기한은 전부 절대 ms. 엔진은 `now`를 인자로 받는다 |
| 검산 사람별 경과 | 됨 | 투영 **전에** `deliveredAt[seat]`를 기록·저장(버전 +1) 후 `deadlineAt = deliveredAt + QUIZ_MS`로 투영. 2초 안에 못 실으면 출제 + 1초. 판정 = 수신 시각 − deliveredAt |
| 숨기기 예산 | 됨 | 상태: 자리별 사용량 + 정지 시작 시각(소급). 요청마다 "예산 소진 시각 지났나"를 기한 처리로 판정 → `hideBudgetOut` 사건 |
| 경보 판정 | 됨 | `SyncBody.alarm{issuedAt, reactionMs}`, 판정 창은 issuedAt + ALARM_REPORT_WAIT_MS. 그 시점 lastSeen > PRESENCE_MS면 `excluded` |
| 출제 조건 | 됨 | 저장소 `load`가 방 상태와 `mc_players`(last_seen, view_state, view_state_at)를 **함께** 돌려줘야 한다 → DB설계자 `RoomStore` 인터페이스에 반영 |

## 4. 4명에게 주의

- **API설계자**: 투영은 허용 목록으로 새 객체. 사건에는 두 자리에 같이 보내도 되는 것만. 비밀 필드 이름은 `VIEW_FORBIDDEN_KEYS`와 맞출 것. 한 요청에 시간 초과 최대 1회.
- **DB설계자**: `mc_players`에 `view_state_at` 칸 추가. `RoomStore.load`는 방 + 두 자리 접속 정보를 한 번에. 매치 행은 playing 진입 때 insert.
- **페이지개발자**: controller 규칙 7(presence 덮어쓰기)·8(사건 seq 중복 방지)·9(오류→entry). feedback용 matchId는 ended 때 잡아 둘 것. 비밀키는 `MC_KEY_RE` 형식으로 생성.
- **컴포넌트개발자**: 사건은 `view.events`에서, hit 메모에 배 이름을 쓰지 말 것(slot 없음). 정지 시계 hidden이면 `budgetEndsAt`으로 표시.
- 모두: `boundaries.test.ts`가 빨갛게 되면 경계를 넘은 것이다. 규칙을 고치지 말고 import를 고칠 것.

## 5. D3 추기 (2026-11-07 · @백엔드팀장) — 동결 파일 변경 없음

`protocol.ts`·`constants.ts`는 **한 글자도 바꾸지 않았다.** 아래는 같은 타입 안에서 서버 동작만 정한 것이라 프론트가 알아야 할 것이다(상세: `docs/backend/monthly-close-d3-review.md`).

| # | 동작 | 이유 |
|---|---|---|
| 1 | 대기·배치 중 **손님이 `leave`하면 성공해도 `403 NOT_JOINED`**(view 없음). 재전송도 같다. 방장의 leave, 대전 중·종료 후 leave는 그대로 `ActionOk` | 손님 자리가 사라져 `ActionOk.view`(MeView)를 만들 수 없다. 전에는 투영이 throw해서 500이었다 |
| 2 | `RATE_LIMITED`가 join에서도 온다: 비밀키당 join 분당 20회, IP당 방 접근 실패(404·409 ROOM_FULL·403 NOT_JOINED 합산) 10분 60회. 한도를 넘은 IP는 실제 사유 대신 `RATE_LIMITED`(+ `retryAfterMs`, `Retry-After`) | 비밀키는 공짜라 키당 제한으로는 방 번호 무차별 대입을 못 막는다. 자리가 있는 사람의 정상 sync·action은 IP 버킷을 보지 않는다 |
| 3 | 라우트에서 예상 못 한 예외가 나면 HTML 500 대신 **JSON `503 SERVICE_DOWN`**(`serverNow` 포함) | 클라가 NETWORK가 아니라 E4로 분기하게, 스택·메시지가 새지 않게 |
| 4 | 검산이 실리는 **모든** 응답(join·거부 응답 포함)에서 배달 시각을 기록한다 | 새로고침 재입장 직후 2초 안에 답하면 경과 0ms로 이기던 구멍(R1) |

## 6. QA 수정 추기 (2026-11-08 · @백엔드팀장) — 동결 파일 변경 없음

`protocol.ts`·`constants.ts`는 이번에도 바꾸지 않았다. 같은 타입 안에서 서버 동작만 바뀐 것(상세: `docs/backend/monthly-close-qa-fixes.md`).

| # | 동작 | 프론트 영향 |
|---|---|---|
| 1 | 검산 `settleAt`은 "상대가 아직 비길 수 있는 마지막 시각(포함)"이다. 그 정각의 정답은 인정하고 **확정은 settleAt + 1ms부터**(BUG-03). 마감 `deadlineAt` 정각 정답도 인정 | 없음(클라는 settleAt + 150ms에 refresh). 값의 의미만 명확히 함 |
| 2 | 닉네임에 금칙어가 있으면 거부하지 않고 **"편집자NN"으로 바꿔 저장**한다(BUG-09). `INVALID nickname`은 예전처럼 길이·빈칸만 | 내 화면 `me.nickname`이 입력값과 다를 수 있다. 알림 문구를 넣을지는 프론트 판단(지금은 없음) |
| 3 | 미뤄진 검산은 합치지 않고 조건이 되는 라운드마다 하나씩 낸다(판당 최대 3회, BUG-15). 검산이 연속 라운드(예 13·14·15)에 나올 수 있다 | 없음(검산 화면은 라운드와 무관) |
| 4 | 경보 실패 쉼이 걸린 차례가 시간 초과되면 그 쉼은 소진된다(BUG-16). `me.skipNextFire`가 시간 초과와 함께 false로 바뀐다 | "다음 발사 쉼" 표시가 시간 초과 직후 사라지는 것이 정상 |
| 5 | Vercel에서는 IP 버킷을 `x-real-ip`(→ `x-vercel-forwarded-for` → XFF)로 센다(BUG-11). 로컬은 그대로 | 없음 |
