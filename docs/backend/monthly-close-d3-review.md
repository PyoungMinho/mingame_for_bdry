# 월마감 D3 통합 — 백엔드 코드 리뷰·보안 점검

- 작성: 2026-11-07 · @백엔드팀장
- 범위: `src/lib/monthly-close/{engine,server}/**`, `src/app/api/monthly-close/**`, `supabase/monthly-close-*.sql`, `scripts/monthly-close-smoke.mjs`
- 기준: 방향서 §4·§8·§10 D3 ④⑥⑦, `docs/planning/monthly-close/lead-backend.md` §4·§7·§8, `monthly-close-d0-freeze.md`
- 동결 파일(`protocol.ts`, `constants.ts`)은 **바꾸지 않았다.** 서버 동작으로 정한 것은 freeze 문서 §5에 추기했다.

## 0. 결론

| D3 완료 기준(서버 몫) | 결과 |
|---|---|
| `npx tsc --noEmit` | **0 오류** (프론트 동시 작업분 포함, 마지막 실행 기준) |
| `npx vitest run src/lib/monthly-close src/app/api/monthly-close` | **21 파일 / 371 통과**, 1 건너뜀(민감도 분석, 환경변수로만 실행) |
| ④ 1만 판 시뮬 G0-3 (힌트 효과 포함) | 판 길이·선공 편차·상한 도달 **통과**. 힌트 승률은 완벽 봇 61.2%(기준 60% 초과), **사람 모델 53.2%**. §3 참고 |
| ⑥ 투영 속성 테스트 1,000판 유출 0 | **통과**(`engine/project.test.ts` 1,000판 + 비간섭 400판×2). D3에서 비어 있던 두 구간(풀이 중 상대 정답·잠금 비간섭, 배치 단계 초안)을 각 300판 추가 |
| ⑦ 공유 파일 diff 0 | 월마감 작업분 **0**. 단 `package.json`에 월마감과 무관한 **기존** 변경(`test:redline` 스크립트 삭제, 세션 시작 전부터 ` M`)이 있다 → 배포 커밋에 넣지 말 것 |
| 클린 `npm run build` | **여기서 돌리지 않음**(아래 §6). 배포 단계에서 git worktree로 돈다 |

재현 테스트를 먼저 쓰고 고친 버그 6건(R1~R6), 보안 점검표 전 항목 통과, 연기 시험 스크립트 로컬 통과.

## 1. 발견한 버그와 수정

재현 테스트: `src/lib/monthly-close/server/d3-review.test.ts`(R1~R6 + 투영 보강), `src/app/api/monthly-close/guard.test.ts`. 수정 전 8건 실패 → 수정 후 전부 통과.

| # | 심각도 | 버그 | 재현 | 수정 |
|---|---|---|---|---|
| R1 | **P1 (공정성)** | 검산 배달 시각을 기록하지 않고 검산을 싣는 경로가 둘 있었다: **재입장(join) 응답**과 **액션 거부 응답**. 그 화면으로 출제 2초 안에 답하면 엔진 방어 코드가 배달 시각 = 답 도착 시각으로 잡아 **경과 0ms → 무조건 승리**. 새로고침 한 번으로 재현 | join 직후 1.9초에 답한 쪽이 1.5초에 답한 상대를 이김 | ① `joinFlow`와 `actionFlow` 거부 경로에서도 `markDelivered` 후 저장 ② 엔진 방어 코드는 배달 기록이 없으면 **출제 시각**으로 잰다(가장 이른 가능 시각, 이득 불가) |
| R2 | P2 | 경보 무보고 판정을 `now` 기준 접속으로 했다. 판정이 창 끝(출제+10초)보다 늦게 돌면, 창 끝에 접속 중이던 사람도 `excluded`(벌칙 제외)로 빠진다. D0 결정("그 시점 lastSeen")과 다름 | 창 끝 1초 전 접속, 판정 30초 뒤 → excluded | 판정 기준 시각 = `min(now, issuedAt + ALARM_REPORT_WAIT_MS)` |
| R3 | P1 (가용성) | 대기·배치 중 손님이 나가면 상태 저장 뒤 DB 자리 행을 지우는데, 삭제가 실패하면(네트워크 순단) **그 방은 영영 ROOM_FULL**(새 사람 addPlayer가 SEAT_TAKEN). 주석은 "재시도"라 했지만 코드가 없었다. 나가기 직후 입장 경합도 같은 증상 | 삭제 1회 실패 주입 → 새 손님 ROOM_FULL | SEAT_TAKEN인데 상태의 손님 자리가 비어 있고, 남은 행의 키가 상태에 없고, 그 행의 접속 신호가 `PRESENCE_MS`보다 오래됐으면 **그 키일 때만** 지우고 1회 재시도. `RoomStore.removePlayer(roomId, seat, onlyKey?)` 추가(두 구현). 방금 들어온 사람(행 추가 후 상태 저장 직전)은 접속 신호가 최신이라 건드리지 않는다(테스트로 고정) |
| R4 | P1 (보안) | 방 번호 추측 제한이 **비밀키당**뿐이었다. 비밀키는 브라우저가 공짜로 새로 만드므로 키를 돌리면 무제한. sync·action의 404/403/409 차이로 활성 방 목록도 알아낼 수 있었다 | 키 100개 × 같은 IP → 제한 0회 | IP당 접근 실패(ROOM_NOT_FOUND·ROOM_FULL·NOT_JOINED, join·sync·action 합산) 10분 60회(메모리, 저장 안 함). 넘으면 실제 사유 대신 `RATE_LIMITED`(존재 신호 차단), 새 사람의 입장도 거부. 자리가 있는 사람의 정상 요청은 이 버킷을 보지 않는다(같은 회사 NAT의 남용자 때문에 판이 끊기지 않게). IP를 모르면(`unknown`) 건너뜀 |
| R5 | P3 | 재입장(join)에 요청 제한이 없었다(성공해도 load 2회 + touch). 연타로 DB 부하 | 같은 키 join 40회 전부 성공 | 비밀키당 join 분당 20회 |
| R6 | **P1 (오류)** | 대기·배치 중 **손님의 `leave`가 항상 500.** 엔진이 손님 자리를 null로 비운 뒤 `actionFlow`가 그 자리의 화면을 투영하다 throw. 상태는 이미 저장돼 있어 클라는 실패로 보고, 서버 로그에는 스택이 남는다(D2 테스트가 이 경로를 안 탔다) | `leave` → TypeError(meView) | 저장 후 자리가 없어졌으면 `403 NOT_JOINED`(view 없음)로 답한다. 재전송도 같은 답. 프론트 영향은 §5 |

같이 고친 것(버그 아님, 방어):
- **라우트 보호막** `_util.guard`: 예상 못 한 예외도 JSON `503 SERVICE_DOWN`(+`serverNow`)으로 답하고, 로그에는 `[monthly-close] <라우트> unhandled <예외 이름>`만 남긴다(메시지·스택·cause 미기록 — DB 행 일부가 들어 있을 수 있음). health는 저장소 조립이 던져도 `{db:"down"}`.
- 초인종 `httpSend` 타임아웃 타이머 해제, `removeChannel` 거부 삼킴.
- feedback에 IP당 분당 120회(메모리). `transport`는 참가자 확인 없이 기록되는 유일한 사건이라 키를 돌려 `mc_events`를 채우는 속도를 늦춘다.

### 1-1. 리뷰 항목별 판정 (문제없음 포함)

| 항목 | 판정 | 근거 |
|---|---|---|
| CAS 재시도 | 정상 | 모든 상태 전이가 `save(expectedVersion)` 한 경로, 실패 시 다시 load → advance → 재적용(최대 3회). 부수 효과(매치 행·지표)는 저장 성공 뒤에만, 매치 id는 성공한 시도의 것만 기록 |
| actionId 멱등 | 정상 | 자리별 최근 16개. 재전송은 `duplicate: true` + 최신 화면. 거부된 액션은 기록하지 않아 재시도 시 다시 판정. 동시 재전송 테스트 있음 |
| 서버 시계·시간 초과 1회 | 정상 | 엔진은 `ctx.now`만 쓴다(경계 테스트 ③). advance 1회당 시간 초과 1회, 새 차례 시계는 처리 시각부터라 연쇄 불가 |
| 숨기기 시계 소급·예산 | 정상(한계 1) | 정지 시작 = max(view_state 변경 시각, 차례 시작), 재개 = min(복귀 시각, 예산 소진 시각), 판마다 초기화. 한계: 정지가 처리되기 전에 복귀까지 보고되면 그 사이(대개 2초 이하)는 소급되지 않는다(§7) |
| 검산 경과·잠금 | R1 수정 후 정상 | 사람별 배달→경과, 0.2초 동시 지급, 풀이 중인 사람에게 settling 숨김(B3 비간섭 300판 추가), 오답 잠금은 본인 화면에만 |
| 경보 판정 | R2 수정 후 정상 | 둘 다 보고하면 즉시, 아니면 창 끝 기준. 반응 ms는 클라 신뢰(설계) |
| 재대결 | 정상 | 둘 다 2분 안, 선공 교대, 판 순번 +1, 상대가 나갔으면 거부, 만료 사건 |
| 이탈·부재·기권 | R6 수정 후 정상 | 대전 중 leave = 기권, 3연속 시간 초과 뒤 부재 처리, 방장 자리는 재입장용으로 유지 |
| 방 만료·정리 | 정상 | 저장·접속마다 +30분(60초 간격), 만료 방은 load에서 안 보이고 방 만들기마다 50개씩 정리, 같은 번호 만료 방은 생성 시 선삭제 |
| 레이트 리밋 | R4·R5 보강 | 표는 §2-3 |

## 2. 보안 점검표

### 2-1. 숨긴 정보(G0-4)

| 항목 | 결과 | 확인 방법 |
|---|---|---|
| 상대 배(대전 중) | 유출 0 | 허용 목록 투영(`engine/project.ts`가 읽는 비밀은 내 배·종료 후 reveal 둘뿐). 1,000판 속성 테스트(금지 키·배치 정의), 관측과 모순 없는 다른 상대 배치로 바꿔도 화면 동일(400판) |
| 배치 단계 상대 초안 | 유출 0 | D3 추가 300판(초안 0~3척·완료 여부와 무관하게 `placed` 표시만) |
| 검산 정답 | 유출 0 | `QuizView`에 정답 필드 없음(타입), 정답 바꿔도 화면 동일 |
| 경보 예정 라운드 | 유출 0 | 상태 비밀, 비간섭 테스트 |
| 상대 힌트 값·오답·잠금 | 유출 0 | 상대 힌트는 범위만(LogEntry), 값·잠금 바꿔도 화면 동일. 풀이 중일 때 상대 정답·마감·잠금 비간섭(D3 추가) |
| 비밀키 원문·해시 | 유출 0 | 원문은 `auth.ts` 밖으로 안 나감, 해시는 상태·DB에만. 응답 전수 검사(파이프라인 테스트, 연기 시험 스크립트) |
| 오류 응답 내부 정보 | 정상 | 서버는 코드·숫자만. 저장소 오류 메시지는 연산 이름 + PG 코드만, API는 SERVICE_DOWN으로 바꿔 내보내지 않음. 보호막(guard)으로 예외 스택·메시지가 응답·로그에 안 감 |
| 초인종 | 정상 | 내용 `{v}`뿐, 주제는 방 UUID(참가자 화면에만) |
| 자리 없는 사람 | 정상 | ROOM_*·NOT_JOINED·CAPACITY·SERVICE_DOWN에는 view 없음(연기 시험에서도 확인) |

### 2-2. 신원·키·환경

| 항목 | 결과 |
|---|---|
| 비밀키 형식 | `MC_KEY_RE`(소문자 hex 32자) 아니면 INVALID `key`. 헤더로만, SHA-256만 저장(DB CHECK `^[0-9a-f]{64}$` + 저장소 `assertKeyHash` 이중) |
| 서비스 키 위치 | `SUPABASE_SERVICE_ROLE_KEY`는 `server/db.ts` 한 곳에서만 읽음. 경계 테스트 ①④ 통과("use client"·client/·engine/·sheet/에서 server/ import 0). 월마감 전체의 `process.env` 읽기는 `NEXT_PUBLIC_SUPABASE_URL`·`NEXT_PUBLIC_SUPABASE_ANON_KEY`(초인종 구독)·`SUPABASE_SERVICE_ROLE_KEY`·`VERCEL`/`VERCEL_ENV`뿐 → **새 환경변수 0개** |
| 운영 안전 | Vercel 안에서 키가 없으면 SERVICE_DOWN(메모리 저장소로 몰래 안 바꿈, `MemoryStore` 생성자가 거부) |
| 입력 검증 | zod strict(칸·배 모양·힌트·문구 id·반응 ms·actionId 문자 집합), 닉네임 제어·방향 문자 제거 1~8자, 본문 16KB 상한 |

### 2-3. 남용 제한 (전부 함수 인스턴스 메모리, IP 저장 안 함)

| 버킷 | 한도 | D3 |
|---|---|---|
| 방 만들기 / 키 | 10분 5회 | — |
| 방 만들기 / IP | 시간당 30회 | — |
| 입장 실패 / 키 | 10분 20회 | — |
| **입장·재입장 / 키** | 분당 20회 | 신규(R5) |
| **방 접근 실패 / IP** | 10분 60회, 넘으면 사유 대신 RATE_LIMITED | 신규(R4) |
| sync / 키 | 초당 8회 | — |
| action / 키 | 초당 10회 | — |
| feedback / 키 | 분당 30회 | — |
| **feedback / IP** | 분당 120회 | 신규 |
| 활성 방 | 200개 → `503 CAPACITY` | 최종 방어선(인스턴스 무관) |

방 번호 추측(대기방 10개, 5자리): 한 인스턴스·한 IP 기준 10분 60회 → 시간당 약 360회로, 검토서 §7의 수용 가정(시간당 360번, 약 4%)과 같아졌다(전에는 키를 돌리면 무제한). 남용이 보이면 6자리(`ROOM_CODE_*` 상수) 또는 Vercel 방화벽.

### 2-4. SQL (`supabase/monthly-close-*.sql`)

| 항목 | 결과 |
|---|---|
| RLS | 4개 테이블 켬, 정책 0개(`sql-files.test.ts`) |
| 권한 회수 | anon·authenticated `revoke all` 테이블 4개 + `mc_events_id_seq`. 부여는 `service_role`에만 |
| Realtime 발행 | 추가 없음(`alter/create publication` 없음), 확인 SELECT에 `in_realtime_publication` 열 |
| `mc_` 외 무접촉 | 모든 `public.<이름>`이 `mc_`, 다른 서비스 테이블 이름이 주석까지 0, 함수·트리거·기본 권한 변경 없음. teardown도 `mc_` 4개만, CASCADE 없음 |
| 멱등 | `if not exists`만, drop·delete·truncate 없음, 한 트랜잭션 |
| gate SQL | SELECT만, `env='production' and not is_test` |

### 2-5. SupabaseStore ↔ SQL 대조 (운영 DB 미접속, 코드·SQL 대조)

| 호출 | 필요한 스키마 | 판정 |
|---|---|---|
| `select('*, mc_players(*)')` 임베딩 | `mc_players.room_id → mc_rooms.id` 외래키 1개(관계 모호성 없음) | 맞음. 첫 호출에서 `PGRST200 Could not find a relationship`이 나면 스키마 캐시 문제 → SQL Editor에서 `notify pgrst, 'reload schema';` 1회 |
| `.eq('code').maybeSingle()` | `mc_rooms_code_uq` | 맞음 |
| CAS `update … eq(version) select(version)` | `version integer` | 맞음 |
| `addPlayer` 23505 구분 | 인덱스 이름에 `room_key` / `room_seat` | 맞음(PG는 고유 인덱스 위반도 `unique constraint "<인덱스명>"`으로 보고) |
| `startMatch` `upsert(onConflict:'id', ignoreDuplicates)` | PK `id` | 맞음. `(room_id, seq)` 고유 위반은 23505 → StoreUnavailable → 부수 효과 try/catch(게임 진행 무영향) |
| `insertEvents` `upsert(onConflict:'dedupe_key', ignoreDuplicates)` | `mc_events_dedupe_key_uq`(부분 인덱스 아님 → `ON CONFLICT (dedupe_key)` 추론 가능), null은 중복 허용 | 맞음. `id`는 identity라 보내지 않음 |
| `player_keys text[]` ← JS 배열, `hints`·`alarm_outcome` jsonb | 열 타입 | 맞음 |
| 닉네임 길이 | API는 코드포인트 수, DB `char_length` | 같은 기준 |
| `removePlayer(…, onlyKey)` | `player_key` 열 | 맞음(D3 추가) |

남은 실측은 배포 직후 연기 시험(§4)이 한다.

## 3. 힌트 균형 재측정 (G0-3 "힌트를 더 받은 쪽 승률 ≤ 60%")

상수는 그대로 두었다(`HINTS_PER_GAME = 2`, PM 확정 "1인 최대 2개 시작값"). 시뮬에 **사람 모델**을 추가했다(`engine/simulate.ts` `hintModel: 'human'`, 값 `HUMAN_HINT`). 사격 실력은 두 모델이 같고, 힌트를 쓰는 방식만 다르다.

- **perfect**(D2 기존): 받은 차례에 바로 쓰고, 3×3은 미확인 칸이 가장 많은 곳을 고르고, 값을 매 차례 완전히 활용한다.
- **human(typical)**: 쓸 힌트가 있으면 자기 차례마다 35% 확률로 쓴다(평균 약 2.9차례 늦게). 쓴 힌트 값을 기억해 활용할 확률 60%, 기억한 힌트를 이번 차례에 따를 확률 60%, 3×3 위치는 무작위. [추정값, 플레이테스트로 갱신]

### 3-1. 1만 판 (`MC_SIM_GAMES=10000`, 정답률 p=0.6, 경보 켬)

| 지표 | 힌트 없음 | 힌트 perfect | 힌트 human | 기준 |
|---|---|---|---|---|
| 라운드 중앙값 (p75/p90) | 17 (21/25) | 16 (19/21) | 17 (20/24) | 15~22 |
| 선공 / 후공 승 | 48.8% / 47.0% | 47.8% / 47.7% | 48.8% / 47.1% | 45~55% |
| 상한 도달 | 2.5% | 0.3% | 1.3% | ≤ 5% |
| 판당 받은 힌트 / 실제 사용률 | 0 / — | 2.38 / 99.9% | 2.39 / 92.4% | — |
| **힌트를 더 받은 쪽 승률** (판 수) | — | **61.2%** (7,415) | **53.2%** (7,555) | **≤ 60%** |
| └ 2개 vs 0개 | — | 66.2% (2,376) | 54.7% (2,316) | — |
| └ 2개 vs 1개 | — | 58.7% (4,124) | 52.8% (4,310) | — |
| └ 1개 vs 0개 | — | 60.1% (915) | 51.2% (929) | — |

perfect 열은 D2 기록(`monthly-close-sim.md`)과 시드까지 같아 수치가 정확히 재현됐다. 표본 오차(95%)는 각 ±1.1%p 안팎.

### 3-2. 민감도 (1만 판씩, 같은 시드) — `MC_SIM_SWEEP=1 MC_SIM_GAMES=10000 npx vitest run src/lib/monthly-close/engine/sim-sweep.test.ts` (약 6.5분)

사람 모델 3단계: **attentive**(차례당 사용 70%, 기억 90%, 따름 85%) / **typical**(35%/60%/60%, 기본값) / **casual**(20%/40%/40%).

| 검산 정답률 p | perfect | attentive | typical | casual | 2개 vs 0개 (perfect → attentive → typical) |
|---|---|---|---|---|---|
| 0.4 | 60.9% | 57.7% | 55.0% | 53.1% | 65.3% → 61.7% → 56.5% |
| 0.6 | 61.2% | 58.1% | 53.2% | 50.4% | 66.2% → 62.2% → 54.7% |
| 0.8 | 60.8% | 57.2% | 54.6% | 51.6% | 66.6% → 61.3% → 56.3% |

- 정답률과 무관하게 **완벽 봇만 60%를 넘고(60.8~61.2%), 꼼꼼한 사람 모델도 57~58%**다. 각 칸의 표본은 6,900~8,200판(±1.1%p).
- 판 길이는 모든 칸에서 중앙값 16~17, 상한 도달 0.3~2.2%로 기준 안이다.
- 치우침이 가장 큰 곳은 **2개 vs 0개**(전체 판의 약 15~25%): 완벽 봇 66%, 꼼꼼한 사람 61~62%. 기준 초과 위험이 실제로 생긴다면 여기서 생긴다.

### 3-3. 권고

1. **`HINTS_PER_GAME = 2` 유지, 출시 진행.** 61.2%는 힌트를 즉시·완벽하게 쓰는 상한값이다. 사람처럼 쓰면 53% 안팎이고, 꼼꼼한 사람 모델에서도 60% 아래였다(§3-2). 기준 초과는 "모든 사람이 봇처럼 완벽할 때"에만 나는 1.2%p다.
2. 조정 기준을 **실측으로 판정**한다: 플레이테스트·출시 후 `mc_matches.hints`와 `winner_seat`로 "힌트를 더 받은 쪽 승률"을 그대로 계산할 수 있다(매치 행에 열이 이미 있음). 판 수가 적으므로 2개 vs 0개 판을 따로 본다(§3-2에서 가장 치우친 구간). **실측이 60%를 넘으면** `HINTS_PER_GAME = 1`을 검토한다(기획팀장 확인). 상수 하나만 바꾸면 되고 엔진 수정은 없다.
3. 기획팀장 확인 사항: "G0-3 힌트 기준을 시뮬(완벽 봇)이 아니라 실측으로 판정한다"는 해석 승인. 이 문서와 `monthly-close-sim.md` "D3 재측정"에 근거를 남겼다.

## 4. 배포 직후 연기 시험 — `scripts/monthly-close-smoke.mjs`

```
node scripts/monthly-close-smoke.mjs https://project-orsrw.vercel.app
# (선택 ④) NEXT_PUBLIC_SUPABASE_URL=… NEXT_PUBLIC_SUPABASE_ANON_KEY=… node scripts/monthly-close-smoke.mjs <URL>
```

- 대상 URL 인자 필수(기본값 없음, 없으면 종료 코드 2). 의존성 없음.
- 순서: health `db: ok`(아니면 방을 만들지 않고 멈춤) → 키 없는 요청 INVALID `key` → A 방 만들기 → B 입장(배치 단계) → 둘 다 배치 완료(대전 시작) → sync·변경 없음 응답 → 차례인 사람 발사 1회(miss) → 같은 사람 연속 발사 NOT_YOUR_TURN + 최신 화면 → A 기권(B 승, reveal 3척) → 제3자 키 ROOM_FULL(화면 없음).
- 모든 응답 점검: `Cache-Control: no-store`, `X-Robots-Tag: noindex`, 금지 키(종료 전), 비밀키 원문·해시, 아직 안 맞은 상대 배 정의.
- 선택 ④: 공개 anon 키로 `mc_` 4개 테이블 REST 직접 조회 → 거부(401/403) 또는 `[]`여야 통과. 서비스 키는 쓰지 않는다.
- 운영 기록: 모든 요청에 `x-mc-test: 1` → 방·매치·이벤트가 `is_test = true`, gate SQL에서 제외. 방 1개는 30분 뒤 만료(그동안 활성 방 200개 중 1개 사용).
- **로컬 검증**: `http://localhost:3000`(MemoryStore dev 서버)에서 전 항목 통과, 종료 코드 0. 로컬은 Supabase 키가 없어 운영 DB에 닿지 않는다.

## 5. 프론트에 넘길 것

1. **손님(1번 자리)이 대기·배치 중 `leave` → 성공해도 `403 NOT_JOINED`**(view 없음). `GameScreen`은 `leave().then(onHome)`이라 동작은 맞지만, `act()`가 NOT_JOINED를 `entry: needJoin`으로 바꿔 입장 대화상자가 한 프레임 비칠 수 있다 → leave 응답의 NOT_JOINED는 성공으로 취급해 entry를 바꾸지 말 것.
2. **`RATE_LIMITED`가 join에서도 온다**(키당 분당 20회, 같은 IP의 접근 실패 10분 60회 초과). 입장 대화상자는 `retryAfterMs`로 "잠시 후 다시" 처리. 지금 `mapError`는 RATE_LIMITED를 entry로 바꾸지 않으므로 상태줄 문구만 있으면 된다.
3. 서버의 예상 못 한 오류는 이제 JSON `503 SERVICE_DOWN` → 기존 E4(down) 분기를 탄다(전에는 HTML 500 → NETWORK).
4. `client/identity.ts` `randomHex`의 `Math.random` 대체 경로: **비밀키(`mc:key`)에는 쓰지 말 것**(예측 가능한 키 = 남의 자리 재입장). `crypto.getRandomValues`가 없으면 키를 만들지 말고 실패로 두는 편이 안전하다(actionId는 대체 경로여도 무방).
5. 검산은 join 응답에 실려도 이제 배달이 기록된다 → 재입장 직후 검산 마감(`deadlineAt`)을 그대로 믿어도 된다.

## 6. 빌드

- `npm run build`(클린, `.next` 삭제)는 **여기서 돌리지 않았다.** 같은 작업 폴더에서 프론트 dev 서버(포트 3000)가 돌고 있어 `.next`를 지우면 그 서버가 깨진다.
- 대신: `npx tsc --noEmit` 0 오류, 라우트 핸들러 6개를 실제 핸들러로 부르는 테스트(`routes.test.ts`, `guard.test.ts`), 그리고 **dev 서버(Next 컴파일)에 대한 연기 시험 전 항목 통과**로 갈음한다. 라우트는 전부 `runtime = 'nodejs'`, `dynamic = 'force-dynamic'`, `revalidate = 0`.
- 클린 빌드는 **STEP 7에서 배포엔지니어가 커밋할 내용만 꺼낸 git worktree에서** 돌린다(방향서 §10 배포 1·2). 인덱스에 staged된 /flight 파일·`package.json` 기존 변경을 섞지 않는다.

## 7. 남은 위험

| # | 위험 | 대응 |
|---|---|---|
| 1 | 레이트 리밋은 **함수 인스턴스 메모리**라 인스턴스가 여럿이면 한도가 그만큼 느슨해진다 | 최종 방어선은 활성 방 200개. 남용이 보이면 Vercel 방화벽, 방 번호 6자리 |
| 2 | 활성 방 상한 200 고갈: IP를 돌리는 공격, 또는 결과 화면 탭을 열어 둔 채 폴링하는 방이 만료되지 않고 자리를 차지 | 7일째 사용량 점검 때 `countActiveRooms` 추이 확인. 필요하면 "종료 후 N분 지나면 sync가 만료를 늘리지 않음" 규칙 추가(서버만) |
| 3 | 부채널: 검산 중 상대가 오답·정답을 내면 내 화면은 그대로인데 version만 오른다 → "상대가 뭔가 냈다"는 1비트 | 정답·잠금 값은 안 샌다(비간섭 테스트). 수용 |
| 4 | 숨기기 소급의 한계: 정지가 처리되기 전에 복귀까지 보고되면 그 구간(대개 2초 이하)은 시계가 흐른 것으로 처리. 숨기기 보고가 네트워크로 늦어 시간 초과가 먼저 처리되면 되돌리지 않는다 | 클라는 숨기기·복귀를 즉시 keepalive sync로 보낸다. QA 실기에서 체감 확인 |
| 5 | 경보 반응 ms는 클라이언트를 믿는다(설계). 조작하면 경보 벌칙을 피할 수 있다 | 친구 게임이라 수용(방향서 §4-1) |
| 6 | 초인종 `httpSend`를 응답 전에 기다린다(최대 1.5초) → Realtime이 느리면 액션 응답이 늦어진다 | 평소 수십~수백 ms[추정]. 연기 시험의 응답 시간을 보고, 느리면 상한을 줄인다 |
| 7 | 실제 Supabase로는 한 번도 돌지 않았다(PostgREST 임베딩·upsert는 코드·SQL 대조만) | 배포 직후 연기 시험이 첫 실측. 실패 시 롤백(Vercel Promote) — DB는 `mc_` 테이블뿐이라 되돌릴 것 없음 |
| 8 | feedback은 방이 만료되면(30분 무활동) 기록되지 않는다(ROOM_NOT_FOUND) | 결과 화면 직후 보내므로 영향 작음. 수용 |
| 9 | 시뮬 사람 모델 값은 추정이다 | 플레이테스트 실측(`mc_matches.hints`·`winner_seat`)으로 대체 |

## 8. 바꾼 파일

- 엔진: `engine/core.ts`(R1 방어, R2), `engine/simulate.ts`(사람 모델·차이별 집계·사용률), `engine/simulate.test.ts`(사람 모델 1건), `engine/sim-sweep.test.ts`(신규, `MC_SIM_SWEEP=1`일 때만)
- 서버: `server/pipeline.ts`(R1·R3·R4·R5·R6, 초인종 타이머, feedback IP), `server/rate.ts`(버킷 3개), `server/store.ts`·`store-memory.ts`·`store-supabase.ts`(`removePlayer` onlyKey), `server/d3-review.test.ts`(신규)
- 라우트: `_util.ts`(guard), 라우트 6개(guard 적용, health는 조립 실패도 down), `guard.test.ts`(신규)
- 스크립트: `scripts/monthly-close-smoke.mjs`(신규)
- 문서: 이 문서, `monthly-close-sim.md`(D3 재측정 추기), `monthly-close-d0-freeze.md`(§5 추기)
- 동결 파일·공유 파일·package.json·SQL: 변경 없음
