# 모이라(Moira) — 백엔드 아키텍처 최종안

> 확정: @백엔드팀장 (Opus) | 2026-06-09 | 버전: v1.0 (FINAL)
> 입력: `moira-api-spec.md`(@API설계자) · `moira-db-schema.md`(@DB설계자) · 실제 마이그레이션/스텁 코드
> 상태: **본 문서가 단일 정본(Single Source of Truth)이다.** API/DB 두 산출물이 충돌할 경우 이 문서의 결정을 따른다.

---

## 0. 핵심 원칙 (변경 불가)

1. **무가입(no-signup)** — 호스트·게스트 모두 회원가입/로그인 없음. `auth.users` 의존성 0. 신원은 일회성 토큰만으로 식별. (이것이 오름·진짜집과의 핵심 차이다.)
2. **실시간 = 폴링.** 웹소켓 절대 금지. Redis 버전 카운터 + `?since` 방식.
3. **demo/live 모드.** 외부 키 0개로도 앱 전체가 구동된다(문제팩토리 철학 계승). 두 모드의 **응답 스키마는 100% 동일**, 데이터 출처만 다르다.
4. **공평성 = 의미의 전부.** 색·등급은 오직 공평도(이동시간 격차)만 표현한다. 점수 = `α·avg + β·max + γ·stddev`(낮을수록 공평).
5. **PII 최소화.** 좌표·타인 출발지는 응답에 절대 노출 금지. TTL 만료 시 PII 즉시 파기.
6. **네임스페이스 격리.** 모이라는 `moira_*`(DB)·`/api/moira/*`(라우트)·`src/lib/moira/*`만 사용. 오름/문제팩토리/진짜집 파일 불가침.

---

## 1. 시스템 아키텍처 개요

### 1-1. 컴포넌트 구성

```
┌──────────────────────────────────────────────────────────────────────┐
│  클라이언트 (모바일 우선 한국어 웹앱, Next.js App Router)              │
│  /moira → /moira/result → /moira/vote → /moira/confirm                 │
│  신원: localStorage(hostToken/voterToken) + URL ?t=(inviteToken)       │
└───────────────┬──────────────────────────────────────────────────────┘
                │ HTTPS (JSON 응답 봉투)
                ▼
┌──────────────────────────────────────────────────────────────────────┐
│  Next.js API Route (서버, runtime=nodejs, dynamic=force-dynamic)       │
│  ── 앱레벨 인증: verifyToken(서명·exp·mid) → hashToken(원문) → DB 대조 │
│  ── 모드 감지: detectMode() → live | demo                              │
│  ── 입력검증: Zod  ·  레이트리밋: rate-limit.ts(in-memory→Upstash)     │
└───┬───────────────────┬───────────────────────┬──────────────────────┘
    │ service_role       │                        │ (live 모드만)
    ▼                    ▼                        ▼
┌─────────────┐  ┌───────────────────┐  ┌────────────────────────────┐
│ Postgres    │  │ Redis (Upstash)   │  │ 외부 API                    │
│ (Supabase)  │  │ ── 버전 카운터     │  │ ── ODsay(대중교통 N×K)      │
│ SoT(영구)    │  │   moira:ver:{id}  │  │ ── Kakao Local(지오코딩)    │
│ RLS=svc only│  │ ── 득표 캐시        │  │ ── self-host OSRM(후보필터) │
│ pg_cron 만료 │  │   moira:votes:{id}│  │   (demo 모드면 mock.ts 대체)│
└─────────────┘  └───────────────────┘  └────────────────────────────┘
```

### 1-2. 저장소 역할 분담 (확정)

| 저장소 | 역할 | 정본 여부 |
|---|---|---|
| **Postgres** | meetup/member/candidate/candidate_times/vote 영구 저장. **득표·확정의 최종 정본(SoT).** | ✅ SoT |
| **Redis** | (a) 폴링용 버전 카운터 `moira:ver:{id}` (b) 득표 수 캐시 `moira:votes:{id}` (c) 투표자 마지막 선택 `moira:voted:{id}:{voterHash}`. **모두 캐시·신호용. 휘발 가능.** | ❌ 캐시 |
| **외부 API** | live 모드 데이터 소스. demo 모드면 `mock.ts`로 대체. | — |

**원칙: Redis가 죽어도 서비스는 동작한다.** 집계는 Postgres `GROUP BY`로 폴백. Redis는 지연·비용 절감용 가속 계층일 뿐, 데이터 손실 위험이 없다.

---

## 2. 무가입 토큰 보안 모델 — API↔DB 정합성 **최종 확정**

> **이것이 본 검토의 가장 중요한 결정이다.** 두 산출물이 정면 충돌했고, 팀장이 단일 표준으로 확정한다.

### 2-1. 발견된 충돌

| 항목 | @API설계자 (`token.ts`) | @DB설계자 (스키마) | 충돌 |
|---|---|---|---|
| 토큰 형식 | HMAC-SHA256 **서명 봉투** `b64(payload).b64(sig)` | 불투명 raw 토큰 | ⚠️ |
| DB 저장 값 | spec §8: `payload.uid`(`host_token_uid`) | `SHA256(raw_token)` = `host_token_hash` 64자 | ⚠️ **정면 충돌** |
| 신원 검증 | 서명 재계산 + timingSafeEqual + exp + mid | `WHERE host_token_hash = $hash` | 둘 다 필요 |
| 토큰 수명 | host 72h / invite 48h / voter 72h (payload.exp) | meetup `expires_at` 7일 | ⚠️ 불일치 |
| meetupId | `nanoid(10)` 문자열 | `UUID` PK | ⚠️ 충돌 |

### 2-2. 확정 결론 — **2단 방어(서명 + 해시) 하이브리드**

두 설계는 *대립이 아니라 서로 다른 계층의 책임*을 맡는다. 팀장은 둘을 **결합**한다.

```
원문 토큰(raw) = base64url(payload).base64url(HMAC-SHA256(payload, MOIRA_TOKEN_SECRET))
                  └─────────────────────── 이 "문자열 전체"가 raw 토큰 ───────────────┘

[1단: 서명 검증]  verifyToken(raw, {meetupId, requireSub})
    → 봉투를 까서 서명 재계산(timingSafeEqual) + exp 만료 + mid 일치 + sub 일치
    → "이 토큰은 우리가 발급했고, 위변조 없고, 안 만료됐고, 이 약속의 토큰인가?"
    → 통과 못 하면 즉시 401 E_INVALID_TOKEN / 403 E_NOT_HOST  (DB 조회 불필요)

[2단: 해시 대조]  hashToken(raw) = SHA-256(raw 토큰 문자열 전체) hex 64자
    → DB의 host_token_hash / invite_token_hash / voter_token_hash 컬럼과 대조
    → "이 토큰은 어느 행(멤버/약속)이며, 이미 투표했는가(1인1표)?"
    → Postgres moira_hash_token(raw) 와 입력·알고리즘 완전 동일
```

**핵심 결정사항:**

1. **DB에 저장하는 값은 `payload.uid`가 아니라 `SHA-256(원문 토큰 전체)`다.** spec §8의 `*_token_uid` 컬럼명은 폐기하고, 실제 마이그레이션의 `*_token_hash`를 정본으로 채택한다. (이유: ① 실제 DDL이 이미 hash로 구현됨 ② hash가 평문 유출 위험이 없고 ③ `uid`만 저장하면 서명 봉투의 보안 이점이 DB에서 사라진다.)
2. **서명은 stateless 1차 게이트, 해시는 stateful 2차 식별자.** 서명만으로는 "이미 투표했는지"를 모르고(상태 없음), 해시만으로는 "위변조·만료"를 모른다(검증 없음). **둘 다 필수.**
3. **두 검증의 순서는 서명 먼저, 해시 나중.** 서명 실패 토큰은 DB를 건드리지 않아 DB 부하·타이밍 공격 표면을 줄인다.
4. **`hashToken()` 유틸을 `src/lib/moira/token.ts`에 추가 확정**(본 검토에서 반영). 앱·DB가 동일 함수 계약을 공유한다.

### 2-3. 토큰 수명 표준 (확정)

| 토큰 | 발급 시점 | 운반 | 만료(payload.exp) | DB 해시 컬럼 |
|---|---|---|---|---|
| `hostToken` | POST /meetups 응답 | `Authorization: Bearer` | **72h** | `moira_meetups.host_token_hash` |
| `inviteToken` | POST /meetups 응답(inviteUrl) | `?t=` 쿼리(링크 노출 불가피) | **48h**(짧게) | (저장 안 함 — 검증만) |
| `voterToken` | POST /members 응답 | `Authorization: Bearer` + localStorage | **72h** | `moira_members.invite_token_hash` = `moira_votes.voter_token_hash` |

**수명 불일치 해소(서명 exp 72h vs DB TTL 7일):** 두 값은 *다른 목적*이므로 충돌이 아니다.
- **토큰 exp(72h)** = "이 토큰으로 *행동(write)* 할 수 있는 기간". 만료되면 새 요청 거부.
- **meetup TTL(7일)** = "이 약속 *데이터*가 살아있는 기간". 만료되면 PII 파기 + 조회 거부.
- **확정 규칙: 토큰 exp ≤ meetup TTL 이어야 한다.** 토큰이 살아있는데 데이터가 없는 구멍을 막기 위해, 토큰 발급 시 `exp = min(now + 토큰기본TTL, meetup.expires_at)` 로 **클램프**한다. 기본 약속 TTL을 48h(MOIRA_DEFAULT_TTL_HOURS)로 둘 경우 host/voter 토큰의 72h가 TTL을 초과하므로, **발급 시 meetup TTL로 상한**을 건다. *(token.ts 후속 보강 항목 — §10 리스크 참조)*

### 2-4. inviteToken vs voterToken 의미 정리 (충돌 해소)

- API spec: inviteToken은 "여러 게스트가 공유하는 링크 토큰"(재사용 가능), 각 게스트는 제출 시 **개인 voterToken**을 발급받는다.
- DB schema: `moira_members.invite_token_hash`에 `UNIQUE(meetup_id, invite_token_hash)`, votes는 `voter_token_hash`로 1인1표.
- **확정:** 링크의 inviteToken은 **권한 게이트**(제출 허가)일 뿐 신원이 아니다. 게스트가 출발지를 제출하면 서버가 **새 voterToken을 발급**하고, 그 **voterToken의 해시**를 `members.invite_token_hash`에 저장한다(= 그 사람의 영구 신원). 투표 시 `votes.voter_token_hash`에 같은 값이 들어가 `UNIQUE(meetup_id, voter_token_hash)`로 1인1표가 강제된다.
- 즉 **DB 컬럼명 `invite_token_hash`에 실제로 들어가는 값은 voterToken의 해시다.** (컬럼명이 다소 오해를 부르나 마이그레이션 변경 비용을 피해 컬럼명은 유지, 의미만 본 문서로 고정.)

### 2-5. meetupId 타입 충돌 해소 (확정)

- API: `nanoid(10)` URL-safe 문자열(짧은 공유 URL). DB: `UUID` PK.
- **확정: 외부 노출 ID는 `nanoid(10)` 문자열로 단일화.** `moira_meetups.id` 컬럼 타입을 `UUID` → `TEXT PRIMARY KEY`(또는 별도 `short_code TEXT UNIQUE`)로 조정해야 한다.
  - **권장안(MVP, 마이그레이션 단순):** `moira_meetups.id`를 `TEXT PRIMARY KEY`(nanoid)로 변경하고 모든 FK(`meetup_id`)도 `TEXT`로 맞춘다. URL `/j/{nanoid}`가 곧 PK라 매핑 불필요.
  - **대안(스키마 보존):** `id UUID` 유지 + `short_code TEXT UNIQUE NOT NULL`(nanoid) 추가, 외부엔 short_code만 노출. JOIN은 내부 UUID로.
  - 본 문서는 **권장안(TEXT PK)** 을 MVP 표준으로 확정한다(불필요한 매핑 레이어 제거 = 단순함 우선 원칙). → §10 P0 작업.

---

## 3. 엔드포인트 최종 목록 (확정)

모든 경로 접두사 `/api/moira/`. 응답 봉투 `{success, data, meta}` / `{success, error:{code,message}}` 고정.

| # | Method | Path | 인증 | 핵심 동작 | 성공 코드 |
|---|---|---|---|---|---|
| 1 | POST | `/meetups` | 없음 | 약속 생성, hostToken+inviteToken 발급, DB INSERT, `moira:ver=0` | 201 |
| 2 | POST | `/meetups/[id]/members` | inviteToken(`?t=`) | 게스트 출발지 제출, voterToken 발급, ver++ | 201 |
| 3 | GET | `/meetups/[id]` | 없음 | 멤버 상태 폴링(`?since`), PII 제외 | 200 |
| 4 | POST | `/meetups/[id]/compute` | hostToken(Bearer) | OSRM 프리필터→ODsay N×K→공평성 점수→후보 저장, ver++ | 202 |
| 5 | GET | `/meetups/[id]/result` | 없음 | 추천역 + 후보 + 멤버별 이동시간 + 공평성 | 200 |
| 6 | POST | `/meetups/[id]/votes` | voterToken(Bearer) | 1인1표 멱등 투표(변경 허용), Redis+PG, ver++ | 200 |
| 7 | GET | `/meetups/[id]/votes` | 없음 | 득표 집계 폴링(Redis 우선, PG 폴백) | 200 |
| 8 | POST | `/meetups/[id]/confirm` | hostToken(Bearer) | 약속 확정(호스트 전용), status=confirmed, ver++ | 200 |
| 9 | GET | `/meetups/[id]/share` | 없음 | OG 카드 메타(카톡 미리보기) | 200 |

**인증 게이트 표준(모든 보호 엔드포인트 공통):**
```
1. extractBearer(header) 또는 ?t= 추출 → 없으면 401 E_INVALID_TOKEN
2. verifyToken(raw, {meetupId: params.id, requireSub})
     malformed/signature/expired → 401 E_INVALID_TOKEN
     wrong_meetup                → 401 E_INVALID_TOKEN (타 약속 토큰 차단)
     wrong_sub (host 자리에 voter)→ 403 E_NOT_HOST
3. hashToken(raw) → DB 행 조회/대조 → 없으면 401(또는 404 E_MEETUP_NOT_FOUND)
4. 비즈니스 로직
```

**상태 머신(meetup.status):** `pending`(출발지 수집) → `recommending`(compute 완료) → `voting`(투표 중) → `confirmed`(확정) → `expired`(만료). 역방향 전이 금지. compute는 `pending`에서만, confirm은 `recommending|voting`에서만 허용(아니면 409).

---

## 4. 데이터 모델 최종 (확정)

### 4-1. 테이블·관계 (5개 + Redis 키)

```
moira_meetups (루트, PK)
  ├─1:N→ moira_members          (ON DELETE CASCADE)
  ├─1:N→ moira_candidates       (ON DELETE CASCADE)
  │         └─1:N→ moira_candidate_times ←N:1─ moira_members  (양쪽 CASCADE)
  ├─1:N→ moira_votes            (candidate_id, meetup_id 양쪽 CASCADE)
  └─1:1→ confirmed_candidate_id (ON DELETE SET NULL)
```

| 테이블 | PK | 핵심 제약 | PII |
|---|---|---|---|
| `moira_meetups` | id(**TEXT/nanoid** 확정) | `host_token_hash` len=64, status CHECK, expires_at | — |
| `moira_members` | id(UUID) | `UNIQUE(meetup_id, invite_token_hash)`, avatar_color regex, status CHECK | `origin_address`, `origin_lat/lng` |
| `moira_candidates` | id(UUID) | fair_level CHECK, fair_rank>0, walk_min≥0 | — |
| `moira_candidate_times` | id(UUID) | **`UNIQUE(candidate_id, member_id)`**(UPSERT 재계산 안전), minutes>0 or NULL | — |
| `moira_votes` | id(UUID) | **`UNIQUE(meetup_id, voter_token_hash)`**(1인1표 DB강제) | — |

### 4-2. N×K 행렬 — 정규화 채택 (확정 지지)

@DB설계자의 `moira_candidate_times` 별도 테이블(정규화) 결정을 **승인**한다. 근거:
- 후보 5~10 × 멤버 4~8 = 최대 80행 → JOIN 비용 무시 가능.
- `MAX(minutes)-MIN(minutes)`(fair_gap), `AVG`(fair_avg), `STDDEV`(fair_score) 를 **Postgres 집계로 직접 계산** 가능.
- 멤버 출발지 변경 시 해당 `member_id` 행만 UPDATE → 재계산 범위 최소.
- 멤버 삭제 시 `ON DELETE CASCADE` 자동 정리.

**단, fair_score는 DB 집계와 앱 로직(`result/route.ts`의 `calcScore`)이 동일 공식·동일 가중치를 써야 한다.** stddev는 **모표준편차(N으로 나눔, `STDDEV_POP`)** 로 통일한다(현재 `result/route.ts`가 `/arr.length` = 모표준편차이므로 DB도 `STDDEV_POP` 사용). → §10 정합성 항목.

### 4-3. 공평성 계산 정본

```
gap   = max(minutes) - min(minutes)          [fairness.ts gapOf]
avg   = mean(minutes)                         [fairness.ts avgOf, 반올림]
score = α·avg + β·max + γ·stddev_pop          (α=0.4 β=0.4 γ=0.2 기본)
level = gap≤10 good / ≤20 mid / >20 bad       [fairness.ts fairLevel]
정렬   = score 오름차순(낮을수록 공평) → fair_rank 1-based
```
가중치는 `MOIRA_SCORE_ALPHA/BETA/GAMMA` 환경변수로 조정. **색은 오직 level만 의미**(공평도). 득표·인기와 무관.

---

## 5. 폴링 기반 실시간 투표 아키텍처 (확정)

### 5-1. 버전 카운터 + `?since`

```
Redis: moira:ver:{meetupId}   (INCR로 증가, EX = meetup TTL 초)
  ── meetup 생성 시 SET 0
  ── members 추가 / compute 완료 / 투표 / confirm 시 INCR

GET /meetups/[id]?since=N
  현재 ver == N  → { data: {}, meta:{version:N} }   (변경 없음, 대역폭 절약)
  현재 ver  > N  → { data: {...전체...}, meta:{version:현재값} }
  Redis MISS     → Postgres에서 상태 재구성 + ver 복구(아래 폴백)
```

권장 폴링 간격: 멤버 대기 화면 3초, 투표 화면 4초(`meta.pollingIntervalMs`로 서버가 지시 → 클라가 동적 조정).

### 5-2. 투표 쓰기 경로 (멱등 + 변경 허용)

```
POST /votes { placeId }   (voterToken 인증)
  1. verify + hashToken → voterHash
  2. 이전 표 조회: Redis GET moira:voted:{id}:{voterHash}  (MISS면 PG SELECT)
  3. 분기:
       동일 placeId      → 200 {idempotent:true}              (아무 변경 없음)
       다른 placeId      → 기존-1/신규+1 (Redis HINCRBY ×2)   {changed:true}
       이전 표 없음       → 신규+1 (HINCRBY)
  4. Redis SET moira:voted:{id}:{voterHash}=placeId EX TTL
  5. Postgres: INSERT moira_votes ON CONFLICT(meetup_id, voter_token_hash)
               DO UPDATE SET candidate_id=excluded.candidate_id   ← 표 변경 반영
  6. Redis INCR moira:ver:{id}
  7. status pending/recommending → voting 으로 전이(최초 투표 시)
```

**1인1표 정본은 DB `UNIQUE(meetup_id, voter_token_hash)`.** Redis는 가속·UX 보조일 뿐. 표 변경을 허용하므로 `ON CONFLICT DO UPDATE`(spec §6-6의 "변경 허용"과 일치) — DB schema의 `DO NOTHING`은 *최초 INSERT 멱등*에는 맞지만 *표 변경*은 불가하므로 **`DO UPDATE`로 확정**(불일치 해소, §9 참조).

### 5-3. 집계 읽기 경로 (폴백 안전)

```
GET /votes
  Redis HGETALL moira:votes:{id}  → HIT → tally 반환
  MISS → Postgres: SELECT candidate_id, COUNT(*) FROM moira_votes
                   WHERE meetup_id=$1 GROUP BY candidate_id
       → Redis HSET 재구축(캐시 워밍) → 반환
  confirm 시점의 winner 결정은 *반드시* Postgres COUNT 기준(Redis는 참고).
```

### 5-4. Redis 키 TTL 표준

| 키 | 용도 | TTL |
|---|---|---|
| `moira:ver:{id}` | 버전 카운터 | meetup `expires_at`까지 (생성 시 EX 초 설정, 권장 7일) |
| `moira:votes:{id}` | 득표 해시 캐시 | 동일 |
| `moira:voted:{id}:{voterHash}` | 투표자 마지막 선택 | 동일(또는 토큰 72h 중 짧은 쪽) |

> 주의: API spec은 일부 키 TTL을 259200초(72h)로, DB schema는 meetup TTL(7일)로 적었다. **확정: meetup `expires_at`에 동기화(7일).** 약속 데이터가 살아있는 동안 캐시도 살아있어야 폴백 일관성이 유지된다.

---

## 6. demo/live 모드 동작 규약 (확정)

### 6-1. 모드 감지 (단일 함수)

```ts
function detectMoiraMode(): "live" | "demo" {
  return process.env.ODSAY_API_KEY && process.env.KAKAO_REST_KEY ? "live" : "demo";
}
```
**둘 다 있어야 live**, 하나라도 없으면 demo. 모든 응답 `meta.mode`에 표기.

### 6-2. 엔드포인트별 모드 동작

| 엔드포인트 | demo | live |
|---|---|---|
| POST /meetups | 정상 생성(토큰·DB), 좌표 변환 skip | + Kakao 지오코딩으로 host 좌표 |
| POST /members | 좌표 `(null,null)` 저장 | + Kakao 지오코딩 |
| POST /compute | `mock.ts` PLACES/RECOMMENDED_STATION 사용, **공평성 점수는 실제 계산** | OSRM 프리필터 → ODsay N×K → 실제 점수 |
| GET /result | `mock.ts` + 실제 fairness 계산 후 정렬 | DB compute 결과 조회 |
| 그 외(투표/확정/공유/폴링) | **live와 100% 동일 로직** | 동일 |

### 6-3. 스키마 동일성 보증 (핵심)

**두 모드의 응답 JSON 구조는 완전히 같다.** demo는 데이터 *출처*만 mock일 뿐, 필드·타입·봉투·에러코드가 동일하다. 프론트는 모드를 구분하지 않고 단일 코드로 렌더한다(`meta.mode`는 배지 표시용일 뿐). 외부 API 장애 시에도 live→demo로 **graceful fallback** 가능(키는 있으나 502면 mock 반환 + `meta.mode:"demo"` + `meta.degraded:true` 표기).

---

## 7. 무가입 권한 모델 — RLS/접근 통제 (확정)

### 7-1. @DB설계자 결정 승인: service_role + 앱레벨 검증, RLS는 service_role 전용

- 모이라는 `auth.users`가 없어 `auth.uid()` 기반 전통 RLS가 무의미(`auth.uid() IS NULL` 항상 참).
- **채택: 모든 DB 접근은 서버(Next API Route)가 `service_role` 키로만 수행.** 클라이언트는 DB에 직접 접근하지 않는다.
- **방어선:** 전 테이블 `ENABLE ROW LEVEL SECURITY` + 정책 `USING (current_setting('role') = 'service_role')`. 실수로 anon/authenticated 키가 Supabase 클라이언트로 직접 접근해도 **전면 차단**.

### 7-2. 클라이언트가 anon key로 DB를 못 건드리는가? — **검증 통과**

1. 클라이언트 번들에 `service_role` 키 **절대 미포함**(서버 env만). → 빌드 시 `NEXT_PUBLIC_*`가 아닌 변수는 클라에 노출 안 됨.
2. anon key가 유출돼도 RLS service_role-only 정책이 모든 행을 차단(SELECT/INSERT/UPDATE/DELETE 전부).
3. 모이라는 Supabase Realtime/직접 PostgREST를 **사용하지 않는다**(폴링은 자체 API Route 경유). 클라가 DB에 도달할 경로 자체가 없음.
- **결론: 안전.** 단 §10에 "service_role-only 정책 SQL을 003 마이그레이션으로 추가" 필요(현재 001/002엔 RLS 미포함, schema 문서에만 권장으로 존재).

### 7-3. 토큰 비밀·해시 안전

- `MOIRA_TOKEN_SECRET`(서명 키)·`service_role`(DB 키)는 서버 env만. DB·로그·에러 메시지·클라 번들 절대 금지.
- raw 토큰은 서버 메모리에만 존재. DB엔 SHA-256 해시만.
- 에러 메시지에 토큰·해시·내부 ID 노출 금지(`E_INVALID_TOKEN`은 사유를 클라에 세분 공개하지 않음 — 열거 공격 방지).

---

## 8. PII·보안·레이트리밋·만료 정책 (확정)

### 8-1. PII 최소화

| 데이터 | 저장 | 응답 노출 | 만료 처리 |
|---|---|---|---|
| `origin_address`(주소) | DB | ❌ 절대 미노출(타인 것) | TTL 만료 시 **NULL 치환** |
| `origin_lat/lng`(좌표) | DB | ❌ 절대 미노출 | TTL 만료 시 **NULL 치환** |
| `name`(닉네임) | DB | ✅(약속 참여자만) | 유지(식별 불가 수준) |
| 토큰 해시 | DB | ❌ | meetup CASCADE 시 자동 삭제 |
| 토큰 서명 비밀 | env only | ❌ | — |

GET /meetups/[id]는 `avatar`(이름 해시 색)·`status`만 반환, `origin/lat/lng` 미반환(spec §6-3 준수).

### 8-2. 만료 정책 (pg_cron, 확정)

```
TTL 기본: 생성 + 7일 (moira_meetups.expires_at)
매시 정각 pg_cron:
  1. expires_at < NOW() → status='expired'
  2. expired meetup의 members.origin_address/lat/lng → NULL  (PII 즉시 파기)
  3. expires_at < NOW() - 30일 → DELETE moira_meetups (CASCADE로 전 하위 삭제)
```
한국 PIPA 관점: 이름+주소 조합 = 식별가능정보 → 만료 즉시 주소·좌표 파기, +30일 하드삭제. **이 cron 잡을 별도 마이그레이션(004_moira_cron.sql)으로 추가 필요**(현재 미존재). → §10 P1.

### 8-3. 레이트리밋 (확정)

| 엔드포인트 | 기준 | 분당 | 일일 |
|---|---|---|---|
| POST /meetups | IP | 10 | 50 |
| POST /members | IP | 20 | 100 |
| POST /compute | hostToken | **3** | 10 |
| POST /votes | voterToken | 10 | 50 |
| POST /confirm | hostToken | 5 | 20 |
| GET 전체 | IP | 60 | — |

`compute`가 ODsay N×K 호출로 가장 비싸므로 최엄격. MVP는 기존 `src/lib/server/rate-limit.ts`(in-memory) 재사용 — **단 서버리스 멀티인스턴스에서 전역 부정확**(해당 파일 주석 명시). 유료화·확장 시 Upstash `@upstash/ratelimit`로 교체(rate-limit.ts가 순수함수라 교체 용이). 429 시 `Retry-After` 헤더 필수.

### 8-4. 기타 보안

- 전 구간 HTTPS. inviteToken은 URL 노출이 불가피하므로 48h 짧은 만료로 위험 최소화.
- Zod 입력 검증 전 엔드포인트 적용(이미 스텁에 반영). `E_VALIDATION`에 `fieldErrors` 포함.
- CORS: 동일 출처(Next 통합)이므로 별도 CORS 불필요. 외부 도메인 호출 차단.

---

## 9. 발견된 API↔DB 불일치 및 해결 (요약 표)

| # | 불일치 | @API설계자 | @DB설계자 | **팀장 확정** |
|---|---|---|---|---|
| 1 | **토큰 저장값** | `payload.uid` | `SHA256(raw)` hash | **hash 채택**(§2.2). uid 컬럼 폐기, hash 정본. 서명+해시 2단 방어. |
| 2 | **meetupId 타입** | nanoid(10) TEXT | UUID | **TEXT(nanoid) PK로 단일화**(§2.5). meetups.id 및 FK를 TEXT로. |
| 3 | **투표 ON CONFLICT** | DO UPDATE(표 변경) | DO NOTHING(멱등) | **DO UPDATE 채택**(§5.2). 표 변경 허용이 제품 요구. |
| 4 | **Redis 키 TTL** | 일부 72h(259200) | meetup TTL(7일) | **meetup TTL(7일) 동기화**(§5.4). 폴백 일관성. |
| 5 | **토큰 exp vs TTL** | exp 72/48h | TTL 7일 | **공존**(§2.3). 단 발급 시 `exp ≤ meetup TTL`로 클램프. |
| 6 | **stddev 정의** | (result.ts) 모표준편차 | (문서) STDDEV 미지정 | **STDDEV_POP(모) 통일**(§4.2). 앱·DB 동일 공식. |
| 7 | **RLS 적용** | (언급 없음) | 권장만(001엔 없음) | **003 마이그레이션으로 service_role-only RLS 추가**(§7.2). |
| 8 | **컬럼명 의미** | inviteToken≠voterToken | invite_token_hash | **members.invite_token_hash엔 voterToken 해시 저장**(§2.4). 컬럼명 유지, 의미 고정. |

> 본 검토에서 코드로 반영한 것: `src/lib/moira/token.ts`에 `hashToken()` 추가(#1의 앱↔DB 공유 계약 구체화). 나머지(스키마 타입 변경·RLS·cron)는 마이그레이션 작업으로 §10에 우선순위화.

---

## 10. 미해결/리스크 + 개발 우선순위 (MVP 단계별)

### 10-1. 미해결·리스크

| 리스크 | 영향 | 대응 |
|---|---|---|
| **meetups.id UUID→TEXT 변경** | FK 연쇄 변경 필요(members/candidates/votes의 meetup_id) | 001 마이그레이션 수정 또는 003에서 ALTER. **DB설계자와 협의 후 MVP 전 반영**(P0). |
| **003 RLS·004 cron 마이그레이션 부재** | 보안·PII 만료 미작동 | 작성 필요(P1). 현재 001/002만 존재. |
| **DB·Redis·외부 API 클라이언트 미연결** | 스텁이 mock 응답만 반환(실제 영속화 없음) | Supabase/Upstash SDK 연결(P0~P1). |
| **token.ts exp 클램프 미구현** | 토큰이 데이터보다 오래 살아 404 유발 가능 | `issueToken`에 `meetupExpiresAt` 인자 추가, `exp=min(...)`(P1). |
| **in-memory 레이트리밋의 서버리스 부정확** | 멀티인스턴스서 전역 제한 누수 | MVP 허용, 유료화 시 Upstash 교체(P2). |
| **compute 비동기(202) 실행 모델** | Next 서버리스엔 백그라운드 워커 부재 | MVP는 **동기 처리**(요청 내 완료, demo는 즉시)로 단순화. 실제 ODsay 도입 시 큐/Edge 검토(P2). |
| **OG 이미지 동적 생성** | /share 이미지 | MVP는 정적 OG 이미지 1종, 동적 생성 후순위(P2). |

### 10-2. 권장 개발 우선순위

**P0 — 데모 가능한 무가입 골든패스 (외부 키 0개로 동작)**
1. `moira_meetups.id` TEXT(nanoid) 전환 + FK 정합(DB설계자 협업).
2. Supabase service_role 클라이언트 연결(`src/lib/moira/db.ts`).
3. 토큰 흐름 완성: POST /meetups(✅스텁) → `hashToken` 저장 → POST /members(voterToken 발급·해시 저장) → GET /meetups/[id](폴링).
4. compute(동기·demo) → result(✅스텁 동작) → 투표(멱등) → confirm.
   → **이 시점에 /moira→result→vote→confirm 풀플로우가 demo로 end-to-end 동작.**

**P1 — 운영 안전 + live 모드**
5. `003_moira_rls.sql`(service_role-only) + `004_moira_cron.sql`(만료·PII 파기) 작성·적용.
6. Upstash Redis 연결: 버전 카운터·득표 캐시·폴백.
7. `issueToken` exp 클램프(≤ meetup TTL).
8. live 모드: Kakao 지오코딩 + ODsay N×K + OSRM 프리필터 + DB 영속화.

**P2 — 확장·바이럴**
9. /share OG 동적 이미지, 레이트리밋 Upstash 이관, compute 비동기 워커, 호스트 TTL 연장 API.

---

## 11. 환경변수 (확정 정본)

```bash
# DB
DATABASE_URL=postgresql://...                 # service_role 연결
SUPABASE_SERVICE_ROLE_KEY=...                 # 서버 전용, 클라 노출 금지
# Redis (없으면 PG 폴백)
UPSTASH_REDIS_REST_URL=...
UPSTASH_REDIS_REST_TOKEN=...
# 외부 API (둘 다 없으면 demo)
ODSAY_API_KEY=
KAKAO_REST_KEY=
OSRM_URL=http://localhost:5000                # 후보 프리필터(0원)
# Moira 전용
MOIRA_TOKEN_SECRET=<32+ bytes 랜덤>           # HMAC 서명 키
MOIRA_SCORE_ALPHA=0.4
MOIRA_SCORE_BETA=0.4
MOIRA_SCORE_GAMMA=0.2
MOIRA_DEFAULT_TTL_HOURS=48                     # 약속 데이터 TTL(토큰 exp 상한)
NEXT_PUBLIC_MOIRA_BASE_URL=https://moira.app   # 클라 노출 OK(공개 URL)
```

> **확정: `MOIRA_DEFAULT_TTL_HOURS`(48h)와 토큰 exp(host/voter 72h)가 충돌하므로, 토큰 발급 시 exp를 meetup TTL로 클램프**(§2.3). 또는 데모 단순화를 위해 약속 TTL 기본을 72h로 올려 토큰과 일치시키는 것도 허용(MVP 선택). 본 문서는 **클램프**를 표준으로 한다.

---

## 12. 파일 맵 (모이라 네임스페이스 한정)

```
api/db/moira/
  migrations/001_moira_initial.sql      ✅ 존재 (단 meetups.id TEXT 전환 필요 — P0)
  migrations/002_moira_indexes.sql      ✅ 존재
  migrations/003_moira_rls.sql          ⬜ 작성 필요 (P1)
  migrations/004_moira_cron.sql         ⬜ 작성 필요 (P1)
  seeds/dev_seed.sql                    ✅ 존재 (id TEXT 전환 시 동반 수정)
src/lib/moira/
  token.ts                              ✅ + hashToken() 추가(본 검토 반영)
  mock.ts / fairness.ts                 ✅ 정본 데이터 계약(수정 금지)
  db.ts                                 ⬜ Supabase service_role 클라이언트 (P0)
  redis.ts                              ⬜ Upstash 헬퍼 (P1)
  compute.ts                            ⬜ 공평성+외부 API (P1, live)
src/app/api/moira/
  meetups/route.ts                      ✅ 스텁(POST 동작)
  meetups/[id]/result/route.ts          ✅ 스텁(GET demo 동작)
  meetups/[id]/{route,members,compute,votes,confirm,share}/route.ts  ⬜ (P0~P1)
docs/backend/moira-backend-final.md     ✅ 본 문서 (정본)
```

---

### 최종 승인

본 아키텍처는 **무가입·폴링·demo우선·공평성** 4대 원칙을 보존하며, API/DB 두 산출물의 8개 충돌을 단일 표준으로 확정했다. MVP는 **외부 키 0개로 /moira 풀플로우가 demo end-to-end 동작**하는 것을 P0 목표로 한다.

— @백엔드팀장
