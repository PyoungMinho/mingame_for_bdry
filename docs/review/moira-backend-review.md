# 모이라(Moira) — 백엔드 최종 리뷰 (STEP 6)

> 검수자: @백엔드팀장 (Opus) · 2026-06-09
> 범위: 모이라 백엔드 산출물 전수 검수 (설계 3종 + 구현 라우트 2종 + 토큰 유틸 + 레이트리밋 공유모듈 + 모이라 테스트 4종)
> 검증 방법: 전 파일 정독 + `npx vitest run tests/moira` 직접 실행( **126/126 green** 실측) + 토큰 시크릿 경고 로그 실관측
> 입장: 본 아키텍처를 확정한 당사자이나, 본 문서에서는 객관적 검수자로서 냉정히 판정한다.

---

## 0. 종합 판정

| 트랙 | 판정 | 근거 |
|---|---|---|
| **demo (데모·블라인드 테스트용)** | ✅ **합격 (GO)** | 외부 키 0개로 토큰 발급·공평성 계산·정렬·PII 미노출이 실제 동작. 테스트 126/126 green. G2 블라인드 테스트 시연에 충분. |
| **live (실서비스 배포)** | ⚠️ **조건부 (NO-GO until gates)** | P1 미착수는 정상이나, 아래 [§3 라이브 전 필수 체크리스트] 미완 + **G2 추천품질 블라인드 테스트 미통과** 상태. 현 시점 라이브 금지 원칙이 설계에 정확히 반영됨. |

**핵심 요약**: 설계 품질은 시니어 수준이다. API↔DB 8개 충돌을 단일 정본(`moira-backend-final.md`)으로 정리했고, 토큰 보안 모델(서명+해시 2단 방어)은 위변조·재생·교차사용을 정확히 막는다. 다만 **프로덕션 시크릿 가드가 "경고 후 fallback"이라 fail-open**인 점이 라이브 전 반드시 닫아야 할 1순위 보안 이슈다. demo 트랙은 지금 합격, live 트랙은 게이트 통과 전 보류.

---

## 1. 보안 검수

### 1-1. 서명 토큰(HMAC-SHA256) 설계 — ✅ 견고

`src/lib/moira/token.ts` 구현이 명세(`moira-api-spec.md §3`, `moira-backend-final.md §2`)와 일치하며 다음을 정확히 방어한다.

- **위변조 방어**: `verifyToken`이 `sign(encoded)` 재계산 후 `timingSafeEqual`로 상수시간 비교. payload를 위조하고 기존 sig를 재사용하는 공격은 재서명 불일치로 차단(테스트 TK-05, 속성 TKP-02가 ∀변조 전수 검증).
- **타이밍 공격 방어**: 길이 불일치 시 `timingSafeEqual` 호출 전 `a.length !== b.length` 가드 + try/catch로 throw 없이 `signature` 반환(TK-19).
- **교차 약속 재사용 차단**: `payload.mid !== opts.meetupId` → `wrong_meetup` (TKP-03 전수). 타 약속의 토큰을 다른 약속에 못 씀.
- **검증 순서**: 서명 → 만료 → mid → sub. 서명 실패 토큰은 JSON 파싱·DB 조회 전에 거부되어 공격 표면 축소(TK-17 회귀가드).
- **2단 방어(서명+해시)**: stateless 서명 게이트 통과 후 `hashToken(raw 전체)` = SHA-256 hex 64자로 DB 행 식별. `payload.uid`가 아니라 **원문 토큰 전체**를 해시하는 정본 계약이 코드·주석·테스트(TK-33)로 고정됨. Postgres `moira_hash_token(raw)`와 입력·알고리즘 동일.
- **재생공격(replay)**: exp(host/voter 72h, invite 48h) + meetup TTL로 시간 창 제한. 무가입 특성상 nonce 기반 1회성까지는 아니나, 단발성 약속·짧은 TTL·HTTPS 전제에서 수용 가능한 수준.

### 1-2. `MOIRA_TOKEN_SECRET` 미설정 시 동작 — 🔴 **심각(High): 프로덕션 가드가 fail-open**

`token.ts:24-33`:
```ts
const SECRET = (() => {
  const s = process.env.MOIRA_TOKEN_SECRET;
  if (!s) {
    if (process.env.NODE_ENV === "production") {
      console.error("[moira/token] MOIRA_TOKEN_SECRET is not set — this is a security risk!");
    }
    return "moira-dev-secret-do-not-use-in-production"; // ← 경고만 찍고 계속 동작
  }
  return s;
})();
```

- **문제**: production에서 시크릿이 없어도 **경고 로그만 남기고 소스에 하드코딩된 공개 dev secret으로 fallback**한다. dev secret 문자열은 레포에 그대로 있으므로, 시크릿을 깜빡 누락한 채 배포하면 **누구나 유효한 host/voter 토큰을 위조**해 임의 약속을 compute/confirm·투표 조작할 수 있다. 경고는 stdout/stderr 로그라 운영자가 놓치기 쉽다(= fail-open).
- **심각도**: High. 단 **현재는 demo/검증 단계라 즉시 위험은 아님**. 라이브 직전 반드시 fail-closed로 전환.
- **권고(라이브 전 필수)**: production이면서 시크릿 미설정/길이 32바이트 미만이면 **부팅 시 throw**(혹은 해당 라우트 500 반환)하도록 강제. 경고가 아니라 차단이어야 한다. demo 모드(외부 키 0개)와 시크릿 가드는 별개 — demo여도 토큰은 실제 서명되므로 production 배포 시엔 시크릿 필수.

### 1-3. 레이트리밋 — ✅ 적용 정확, 한계 명시됨

- `POST /meetups`에 IP 기준 분당(기본 10)·일일(50) 이중 제한 적용. 초과 시 `429 E_RATE_LIMIT` + `Retry-After`(초) 헤더 정확히 반환(MT-RL-01 실측). 서로 다른 IP 독립 카운트(MT-RL-03). `NODE_ENV=test`에서만 skip(MT-RL-02 회귀가드)이라 테스트 격리도 안전.
- `src/lib/server/rate-limit.ts`(공유 모듈, 읽기만)는 슬라이딩 윈도우 로그 방식의 순수함수로 잘 분리됨. **인메모리라 서버리스 멀티인스턴스에서 전역 부정확**한 한계가 모듈 주석·설계서 §8-3에 명시됨. MVP 수용, 유료화·확장 시 Upstash로 교체 — 합리적.
- ⚠️ **현황**: `/meetups`만 레이트리밋 구현 완료. `/compute`(hostToken 3회/분, ODsay 비용 보호의 핵심), `/votes`, `/confirm`은 라우트 자체가 미구현(P0~P1)이라 레이트리밋도 미적용. **compute 레이트리밋은 G3 비용 게이트와 직결되므로 live 전 필수**(§3).

### 1-4. 무가입 접근제어 구멍 — ✅ 설계상 닫힘

- 모든 보호 엔드포인트가 표준 인증 게이트(extract → verify(서명·exp·mid·sub) → hashToken → DB 대조)를 거치도록 설계(`moira-backend-final.md §3`). host 전용(compute/confirm)에 voter 토큰 사용 시 `403 E_NOT_HOST`로 차단(TK-10).
- DB는 전 테이블 `service_role` 전용 RLS로 anon/authenticated 직접 접근 전면 차단(설계 §7) + 클라가 DB에 도달할 경로 자체가 없음(Realtime/PostgREST 미사용, 폴링은 자체 API 경유). 단 **RLS는 003 마이그레이션으로 작성 필요(현재 미존재)** — live 전 필수.
- 1인1표는 DB `UNIQUE(meetup_id, voter_token_hash)`로 강제(정본), Redis는 가속·UX 보조. 표 변경은 `ON CONFLICT DO UPDATE`로 확정(spec과 일치).
- inviteToken URL 노출은 불가피하나 48h 짧은 만료 + 제출 후 개인 voterToken 발급으로 위험 최소화 — 합리적 트레이드오프.

---

## 2. 프라이버시·API 계약·비용 게이트

### 2-1. 좌표 파기(cron)·PII — ⚠️ 설계 명확, 구현 미작성

- **보존기간·범위 명확**: TTL 기본 7일(데이터)·토큰 exp 72h(행동). 만료 시 `origin_address`/`origin_lat`/`origin_lng` **NULL 치환**(즉시 PII 파기), +30일 하드 DELETE. pg_cron 매시 정각. 한국 PIPA(이름+주소=식별가능정보) 관점까지 반영됨(설계 §8-2, db-schema §8). 설계 품질 우수.
- **좌표 누출 차단**: `lat`/`lng`·타인 `origin`은 API 응답에 절대 미반환. `GET /meetups/[id]`는 avatar(이름해시 색)·status만 반환. result의 times는 `{name,minutes,transfers?}`만. 테스트 MT-28·RS-12·RS-13이 응답 직렬화에 좌표·원문 주소·`lat`/`lng` 문자열이 없음을 실증. inviteToken만 URL(`?t=`)에 노출되고 좌표는 절대 쿼리스트링에 안 들어감.
- **JSONB 미사용**: N×K 행렬은 정규화 테이블(`moira_candidate_times`) 채택 — DB 집계(MAX-MIN, AVG, STDDEV_POP) 직접 계산 + 멤버 변경 시 해당 행만 UPDATE. JSONB보다 우수한 결정(설계 §4-2, db-schema §5).
- 🟡 **이슈(Medium)**: **`004_moira_cron.sql` 미작성**. cron이 없으면 만료된 좌표가 파기되지 않아 PIPA·프라이버시 약속 위반. live 전 필수.

### 2-2. API 계약 견고성 — ✅ (구현된 2개) / ⬜ (나머지 7개 미구현, 정상)

- `POST /meetups`: Zod 검증(hostName 1~20, hostOrigin 2~100, ttlHours 1~72 int coerce)이 경계까지 견고(MT-05~23). 응답 봉투 `{success,data,meta}` 고정, data 키집합 정확(MT-02), 에러코드(E_VALIDATION/E_BAD_JSON/E_RATE_LIMIT) 일관. demo/live 스키마 동일성 보장(MT-30). nanoid10은 rejection sampling으로 모듈로 편향 제거(300표본 충돌 0, MT-31).
- `GET /result`: 공평성 공식(α·avg+β·max+γ·stddev_pop)·정렬(score 오름차순)·등급(gap 기반)이 `fairness.ts`와 일치, 가중치 env 반영(RS-09/10), 빈 배열 시 score=0 방어로 NaN/Infinity 오염 차단(RS-16). live 미연결 시 409 E_NOT_READY로 안전 실패(RS-11).
- **N명 임의 인원 지원**: ✅ 4명 하드코딩 아님. 스키마(`moira_members` N행)·공평성 로직(`minutes[]` 가변 길이)·N×K 행렬·DB 집계 모두 가변 인원 전제. demo mock이 4명일 뿐 백엔드는 임의 N 지원.
- ⬜ **미구현(정상)**: `/members`·`/compute`·`/votes`·`/confirm`·`/share`·`GET /meetups/[id]` 라우트는 스텁/미작성(P0~P1). 브리핑대로 **미착수가 정상**.

### 2-3. 유닛이코노믹스 게이트(G3) — ✅ 설계 의도 부합

- OSRM(self-host, 0원) 프리필터로 반경 내 후보역 K개를 먼저 좁힌 뒤에만 ODsay 대중교통 N×K 호출하는 2단 설계(`moira-backend-final.md §3 #4`, api-spec §6-4). ODsay 유료 호출을 프리필터로 감축하는 의도가 비용 BEP에 부합. compute에 hostToken 3회/분 최엄격 레이트리밋까지 더해 호출 폭증 방어. **단 설계 의도일 뿐 OSRM·ODsay 실연동은 P1 미착수(정상)**. G3는 live 전 실측 검증 필요.

---

## 3. P1 준비도 / 라이브 배포 게이트

### 3-1. 미착수 항목(정상 — P1) 

P0 골든패스는 프론트 demo(mock) 기준이며, 다음 P1은 **현 시점 미착수가 정상**이다:
- DB·Redis·외부 API 클라이언트 실연결(`db.ts`/`redis.ts`/`compute.ts` 미작성)
- live 모드(Kakao 지오코딩 + ODsay N×K + OSRM 프리필터 + DB 영속화)
- 7개 라우트 구현, `003_moira_rls.sql`·`004_moira_cron.sql` 마이그레이션
- `issueToken` exp 클램프(≤ meetup TTL)

### 3-2. 🚦 라이브 전 필수 체크리스트 (이 게이트 통과 전 라이브 금지)

| # | 항목 | 심각도 | 비고 |
|---|---|---|---|
| 1 | **`MOIRA_TOKEN_SECRET` fail-closed 전환** — production 미설정/32B 미만 시 부팅 throw(경고→차단) | 🔴 High | §1-2. 1순위. 시크릿 누락 배포 시 토큰 위조 차단 |
| 2 | **G2 추천품질 블라인드 테스트 통과** — 공평성 추천이 사람 판단과 일치하는지 검증 | 🔴 Gate | **이 게이트 미통과 시 라이브 절대 금지**(설계·기획 정본 반영됨) |
| 3 | **`004_moira_cron.sql` 작성·적용** — 만료 좌표 NULL 치환 + 30일 하드삭제 | 🟠 Med | §2-1. PIPA·프라이버시 약속. 좌표 파기 미작동 시 위반 |
| 4 | **`003_moira_rls.sql` 작성·적용** — 전 테이블 service_role 전용 RLS | 🟠 Med | §1-4. anon key 유출 대비 심층방어 |
| 5 | **`/compute` 레이트리밋(hostToken 3/분) 구현** + OSRM→ODsay 비용 BEP 실측(G3) | 🟠 Med | §1-3, §2-3. ODsay 요금 폭증 방어 |
| 6 | `issueToken` exp 클램프(≤ meetup TTL) | 🟡 Low | 토큰이 데이터보다 오래 살아 404 유발 방지 |
| 7 | live 모드 시 HTTPS 강제·외부 API 502 시 graceful degrade(`meta.degraded`) 검증 | 🟡 Low | 설계엔 반영, 구현 시 확인 |

### 3-3. "G2 통과 전 라이브 금지" 원칙 반영 — ✅ 

설계 정본이 **demo는 외부 키 0개로 end-to-end 동작(P0 목표)**, **live는 P1 게이트 후**로 트랙을 명확히 분리했고, 본 리뷰의 판정도 demo=합격 / live=조건부로 이를 강제한다. 게이트 미통과 상태로 live 배포될 경로가 설계상 차단됨.

---

## 4. 결론

| 항목 | 결과 |
|---|---|
| 종합 판정 | **demo 합격(GO) / live 조건부(NO-GO until gates)** |
| 최우선 보안 이슈 | 🔴 `MOIRA_TOKEN_SECRET` fail-open (경고 후 dev secret fallback) — 라이브 전 fail-closed 필수 |
| 토큰 위변조·재생·교차사용 | ✅ 견고(서명+해시 2단, timing-safe, 속성테스트 전수) |
| 프라이버시(좌표 파기) | ⚠️ 설계 명확하나 cron 마이그레이션 미작성(live 전 필수) |
| 테스트 | ✅ 126/126 green(실측) |
| 라이브 게이트 | G2 블라인드 테스트 미통과 → **현 시점 라이브 금지(정상)** |

설계·구현 품질은 우수하다. demo 트랙은 지금 데모·블라인드 테스트에 내보내도 된다. live 트랙은 §3-2의 7개 항목, 특히 **시크릿 fail-closed(#1)** 와 **G2 게이트(#2)** 를 통과하기 전까지 배포 금지.

— @백엔드팀장 · 2026-06-09
