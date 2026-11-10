# 월마감 QA 수정 — 백엔드 (STEP 5 수정 라운드)

- 작성: 2026-11-08 · @백엔드팀장
- 입력: `docs/qa/monthly-close-bug-report.md`(QA실행자) — 백엔드 담당 BUG-03·09·11 + 기획 확인 BUG-15·16 + SIM-02
- 범위: `src/lib/monthly-close/{engine,server}/**`, 새 테스트 `src/lib/monthly-close/qa/backend-fixes.qa.test.ts`. 프론트 경로(`src/app/monthly-close/**`, `src/lib/monthly-close/{client,copy,sheet}/**`)는 건드리지 않았다.
- 동결 파일(`protocol.ts`·`constants.ts`)·공유 파일·`package.json`·SQL 변경 없음. 새 의존성 없음.

---

## 0. 기획 판단(진행자)

PM이 "완제품 만들어와"로 위임, 진행자가 결정. 이대로 구현했다.

| # | 사안 | 결정 | 구현 |
|---|---|---|---|
| BUG-15 | 미뤄진 검산이 합쳐져 판당 3회 → 2회 | **검산은 판당 3회를 지킨다.** 4·8·12라운드에 출제 조건(두 사람 모두 게임 화면)이 안 되면 미뤄서 조건이 되는 다음 라운드에 내되, **미뤄진 회차끼리 합치지 않는다**(한 라운드에 하나씩 차례로). 판이 그 전에 끝나면 그만 | `GameState.quizBacklog`(밀린 회차 수) 추가. 출제 라운드에 이미 미룬 회차가 있으면 +1, 출제할 때 −1(0이면 pendingQuiz 해제). 둘 다 힌트 상한이면 밀린 것도 비움 |
| BUG-16 | 경보 실패 벌칙 + 같은 차례 시간 초과 = 2턴 손실 | **한 사람이 같은 자기 차례에 잃는 턴은 최대 1회.** 경보 실패로 "다음 발사 1회 쉼"이 걸린 상태에서 그 차례가 시간 초과되면, 시간 초과가 그 쉼을 소진한 것으로 본다 | 시간 초과 처리에서 그 사람의 `skipNextFire`를 끈다. 차례 시작 때 쉼은 이미 소진되므로 여기서 켜져 있으면 "이 차례 도중 경보 실패"뿐이다 |
| SIM-02 | 힌트 더 받은 쪽 승률(완벽 봇 61.2% / 사람 모델 53.2%) | **`HINTS_PER_GAME = 2` 유지.** G0-3 힌트 항목은 시뮬이 아니라 **출시 후 실측(`mc_matches`)** 으로 판정하고, 실측이 60%를 넘으면 1로 내린다 | 코드 변경 없음. `docs/backend/monthly-close-sim.md` "QA 수정 재측정"에 기록 |

---

## 1. 고친 버그

| ID | 등급 | 원인 | 수정 | 파일 |
|---|---|---|---|---|
| BUG-03 | P1 | `actionFlow`는 액션 전에 `advance()`를 돈다. `stepQuiz`가 `now >= plan.at`이면 확정했는데 `plan.at`(=settleAt)은 "아직 비길 수 있는 마지막 시각"이라, 그 정각에 온 정답(차 200ms, 마감 +10,000ms)을 확정이 먼저 먹었다 | 확정 조건을 **`now > plan.at`** 으로. 기획 상수 정의대로 검산 경계를 전부 "포함"으로 통일: 차이 `QUIZ_TIE_MS`(200) **이내** = 둘 다, 마감 `deliveredAt + QUIZ_MS` **정각까지** 허용(만료는 `>`), settleAt 정각 정답 허용 → 확정은 settleAt + 1ms부터. 화면의 `settleAt` 값은 그대로(클라는 settleAt + 150ms에 refresh하므로 영향 없음) | `engine/core.ts` stepQuiz, `engine/quiz.ts` 주석 |
| BUG-09 | P2 | `cleanNickname`이 제어문자·길이만 검사 | `server/nickname.ts` 신설. 금칙어가 있으면 **거부하지 않고 기본 닉네임 "편집자NN"으로 대체**(같은 비밀키면 같은 번호, 클라 기본값과 같은 모양). 입장 흐름·오류 문구 변경 없음. 목록은 코드 내 상수로 짧고 보수적으로: 부분 일치(욕설·비하·성적 대표어 44개 + 영문·자판 입력 8개 `fuck`·`tlqkf`·`qudtls` 등) + 전체 일치만(보지·자지·시바·등신·애자·미친·새끼 — "보지마", "시바견", "등신대", 이름 "이애자" 오탐 방지). 비교 전 공백·숫자·기호 제거("시 1 발", "ㅅ.ㅂ") | `server/nickname.ts`, `server/pipeline.ts`(createRoomFlow·joinFlow) |
| BUG-11 | P3 | IP 버킷이 `x-forwarded-for` 첫 값 → 로컬에서 위조로 우회 | `clientIp()`: **Vercel(`VERCEL=1`)에서는 `x-real-ip` → `x-vercel-forwarded-for` → `x-forwarded-for`** 순(Vercel 문서: 플랫폼이 접속 IP로 채우고 클라이언트가 보낸 XFF는 덮어씀). **로컬은 예전 그대로**(XFF 첫 값 → x-real-ip; QA 스크립트의 버킷 분리 유지) | `server/auth.ts` |

**BUG-11은 배포 후 POST-04로 최종 확인한다**: 라이브에서 `x-forwarded-for`를 매 요청 바꿔 없는 번호 join 70회 → 61번째부터 `RATE_LIMITED`면 닫음. 0건이면 P2로 올리고 원인(헤더 전달 방식)을 다시 본다. 배포엔지니어 인계 항목.

---

## 2. 테스트

- `qa/pipeline.int.test.ts`: BUG-03 `bug()` 2건(CON-02 차 200ms, ENG-12·13 실제 경로 마감 정각) → `it` 전환. 199·201·250ms 경계는 그대로 통과.
- `qa/engine.qa.test.ts`: 수정으로 기대값이 바뀐 **기록 테스트 2건만** 고쳤다(둘 다 고친 결함을 현재 동작으로 적어 둔 것).
  - ENG-13 "settleAt까지 기다렸다 확정": settleAt(t0+1200) 정각엔 아직 `quiz`, +1ms에 `fire`(BUG-03 경계와 같은 규칙. 고치기 전 기대 "정각에 확정"은 BUG-03 재현 테스트와 서로 모순).
  - CR-11 기록: 판당 검산 2회 → **3회**(BUG-15 기획 판단).
- 새 파일 `qa/backend-fixes.qa.test.ts`(16건): BUG-15 5건(정상 4·8·12 회귀, 4라운드분 밀림 → 9·10·12, 세 회차 모두 밀림 → 13·14·15 한 라운드 1회, 둘 다 상한이면 밀린 것 비움, 판이 먼저 끝나면 그만), BUG-16 3건(차례 주인 실패 + 시간 초과 → 다음 자기 차례 정상 / 시간 안에 쏘면 쉼 유지 / 상대 실패 → 실패자 1회만 쉼), BUG-09 5건(QA 재현 5종 + 끼워 넣기 차단, 일상어·이름 통과, 기본 닉네임 규칙, 만들기·입장 실제 경로에서 저장·내 화면·상대 화면 모두 대체, 정상 닉네임 회귀), BUG-11 3건(Vercel 헤더 우선순위, 로컬 동작 유지, `VERCEL` 환경 변수 기본값).
- **변이 확인**: 세 수정(BUG-03·15·16)을 임시로 되돌리면 새/전환 테스트 5건이 실패하고, 복원하면 통과(복원은 바이트 비교로 확인).
- 시뮬(`engine/simulate.ts`): 접속 끊김·시간 초과 잡음 옵션 추가(생략 시 예전과 같은 난수 소비 → 기존 3조건 수치 완전 동일). `simulate.test.ts`에 잡음 2조건 + 단언(2턴 손실 0, 판당 검산 수 유지) 추가.

## 3. 검증 결과

| 항목 | 결과 |
|---|---|
| `npx tsc --noEmit` | **0 오류**(최종 실행 시점, 프론트 동시 수정분 포함) |
| `QA_SHOW_BUGS=1 npx vitest run src/lib/monthly-close/qa` | **209 통과 / 실패 0**(7파일). 백엔드 분: BUG-03 2건 전환 통과, 새 16건 통과 |
| `npx vitest run src/lib/monthly-close src/app/api/monthly-close` | **592 통과 · 1 건너뜀**(sim-sweep, 의도된 skip) / 실패 0. 중간 실행에서 프론트 `it.fails` 9건이 "고쳐져서" 실패했던 것은 프론트 쪽 전환 후 해소 |
| 투영 속성 유출 | ENG-27(fast-check 5,000 시퀀스)·SEC-01 금지 키 0 유지. 새 필드 `quizBacklog`는 투영 허용 목록 밖(화면 데이터에 없음) |
| 1만 판 시뮬 | `docs/backend/monthly-close-sim.md` "QA 수정 재측정" |

## 4. 남은 위험

- **BUG-11**: Vercel이 `x-real-ip`를 실제 접속 IP로 채우고 클라이언트가 보낸 값을 덮어쓴다는 것은 Vercel 문서 근거다(https://vercel.com/docs/headers/request-headers). 라이브 POST-04 전까지는 미확인.
- **BUG-09**: 금칙어는 대표어만 막는다(변형 표기·신조어는 샌다). 오탐을 줄이려 일부 말은 전체 일치만 본다. 대체된 사람은 자기 화면에서 "편집자NN"을 보게 되고 따로 알림은 없다(새 문구가 필요해 프론트와 협의 사항으로 남김).
- **BUG-15**: 밀린 회차가 13~15라운드에 몰리면 같은 라운드대에 경보(6~15)와 차례로 겹칠 수 있다. 검산 확정 직후 같은 라운드에 경보가 나가는 기존 순서는 그대로라 경보가 밀려 사라지지는 않는다(15라운드까지 조건이 안 맞을 때만 경보 없음 — 기존 규칙).
- **BUG-16**: 경보 실패 + 시간 초과가 겹친 사람은 `consecutiveTimeouts`가 1 늘어난다(부재 처리 카운트는 그대로 — 시간 초과는 실제로 일어났으므로).
- 저장된 방 상태에 `quizBacklog`가 없는 경우(배포 전 방은 없음)는 `?? 0`으로 읽는다. SQL 변경 불필요(상태는 JSON 칸).
