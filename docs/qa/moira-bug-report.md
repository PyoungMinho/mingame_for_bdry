# 모이라(Moira) 백엔드 — 버그 리포트 & 테스트 실행 결과

> 작성: @QA실행자 (Opus) | 2026-06-09 | 단계: 백엔드 스텁(demo 동작)
> 입력: `docs/qa/moira-test-design.md`(설계), `docs/qa/moira-code-review.md`(리뷰)
> 구현: `tests/moira/**` (vitest + fast-check) — 8개 파일(_helpers 포함), 라인 1,395
> 러너: vitest 1.6.1 / fast-check 3.23.2

---

## 0. 한 줄 요약

설계서 ~130개 케이스를 **126개 실행 테스트**로 구현했고 **전부 green**. 전체 스위트
**323/323 통과(회귀 0)**, `tsc --noEmit` **클린**. 실제 코드 버그는 코드리뷰가 예고한
**잠재 결함 2건(m-1 nanoid 편향, m-2 calcScore NaN)을 모이라 네임스페이스 내에서 안전히 수정**
했고, 토큰 수명 클램프(M-1)·DB/Redis/RLS 미연결(B-1~B-3)은 **live 단계 이월**로 기록했다.
P0 100% green · 속성 무반례 · PII/비밀 누출 0 · 회귀 0 → **Quality Gate PASS**.

---

## 1. 테스트 실행 결과

### 1-1. 모이라 스위트 (`npx vitest run tests/moira`)

| 파일 | 테스트 수 | 결과 |
|---|---:|---|
| `token.test.ts` (TK-01~40) | 31 | ✅ |
| `token.property.test.ts` (TKP-01~06) | 6 | ✅ |
| `fairness.test.ts` (FA-01~18) | 18 | ✅ |
| `fairness.property.test.ts` (FAP-01~06) | 6 | ✅ |
| `meetups.route.test.ts` (MT-01~31, MT-RL-01~03) | 34 | ✅ |
| `result.route.test.ts` (RS-01~16) | 16 | ✅ |
| `mock.test.ts` (MK-01~15) | 15 | ✅ |
| **합계** | **126** | **통과 126 / 실패 0 / 스킵 0** |

> 설계 표 대비 추가 2건: **RS-16**(calcScore NaN 방어 회귀가드, m-2 수정 검증),
> **MT-31**(meetupId 형식·유일성 회귀가드, m-1 수정 검증).

### 1-2. 전체 회귀 (`npm test`)

```
Test Files  17 passed (17)
     Tests  323 passed (323)
```
- exam(route/engine/engine-live/curriculum/points/types/bank/rate-limit) + study(dday/grading) **전부 green**.
- 모이라 추가·코드 수정으로 인한 **회귀 0건**.

### 1-3. 타입체크 (`npx tsc --noEmit`)

- **에러 0** (테스트 파일 포함). 클린.

### 1-4. 커버리지 메모

vitest coverage `include`는 `src/lib/server|shared|api/**`로 스코프되어 모이라 파일
(`src/lib/moira/**`, `src/app/api/moira/**`)은 v8 수치 집계 대상이 아니다(설정 비변경 — 보호 영역).
대신 **함수 단위 정성 커버리지**로 보고한다:

| 모듈 | 함수 | 커버 케이스 |
|---|---|---|
| `token.ts` | issueToken/verifyToken/hashToken/extractBearer/sign/base64url* | TK-01~40, TKP-01~06 (라운드트립·위조·만료·malformed·timing-safe·해시벡터·Bearer 전 분기) |
| `fairness.ts` | gapOf/avgOf/fairLevel/fairCopy/FAIR_STYLE | FA-01~18, FAP-01~06 (경계 10/11/20/21·빈배열·단조성·전역정의역) |
| `meetups/route.ts` | POST/detectMode/clientKey/nanoid10/Zod | MT-01~31, MT-RL-01~03 (봉투·Zod 경계·bad JSON·RL·PII·모드) — geocode(live정상)만 미커버(외부 API) |
| `result/route.ts` | GET/detectMode/stddev/calcScore | RS-01~16 (스키마·정렬·공식·가중치env·409·PII·NaN방어) |
| `mock.ts` | MEMBERS/PLACES/RECOMMENDED_STATION/APPOINTMENT | MK-01~15 (정합·추천1위·CHECK계약) |

---

## 2. 발견 버그 표

> 상태: **수정완료**(모이라 네임스페이스 내 안전 수정 + 재검증) / **live단계이월**(인프라성, 현 단계 수정 불가) / **관찰**(현 동작 회귀가드만).

| ID | 심각도 | 대상 | 재현 | 기대 vs 실제 | 상태 |
|---|---|---|---|---|---|
| BUG-M-2 | Major | `result/route.ts` `calcScore` | `calcScore([])` 직접 호출(=live·멤버0~1명 compute 결과 유입 시) | 기대: 유한 score(또는 0). 실제: `avg=0/0=NaN`, `Math.max(...[])=-Infinity` → `fairScore=NaN` → 정렬 `a-b` 불안정(가장 공평 1위 선정 실패) | **수정완료** |
| BUG-m-1 | Minor | `meetups/route.ts` `nanoid10` | meetupId 대량 표본 분포 측정 | 기대: 62글자 균일. 실제: `b % 62`로 `256%62=8` → `A~H` 8글자가 ~25% 더 자주(5/256 vs 4/256). 엔트로피 미세 손실·식별 가능성 이론적 상승 | **수정완료** |
| BUG-M-1 | Major | `token.ts` `issueToken` + `meetups/route.ts` | `ttlHours:1`로 약속 생성 → hostToken exp 확인 | 기대: `exp = min(now+TTL, meetup.expires_at)` 클램프. 실제: 고정 TTL(host 72h)만 → 약속(1h) 만료 후에도 토큰 생존 → 연결 후 "유효 토큰인데 약속 없음" 혼란(404/410) | **live단계이월** |
| BUG-B-1 | Blocker(live) | route.ts TODO | — | DB/Redis/외부 클라이언트 미연결. hashToken 저장·1인1표·폴링·만료 런타임 부재(무가입 모델 핵심 미작동) | **live단계이월** |
| BUG-B-2 | Blocker(live) | `api/db/moira/migrations/001` | — | API는 `nanoid(10)` TEXT PK 발급, DDL은 `UUID PK` → 연결 즉시 INSERT 타입 불일치 전면 실패 | **live단계이월** |
| BUG-B-3 | Blocker(live) | `api/db/moira/migrations/` | — | 003 RLS(service_role-only)·004 cron(PII 만료) 부재 → anon 유출 시 무차별 접근·PII 영구 잔존(PIPA 소지) | **live단계이월** |
| OBS-m-4 | 관찰 | `result/route.ts` | `GET(req,{params:{id:""}})` | 현 스텁: DB 미조회라 빈/임의 id도 demo면 200(RS-15로 고정). 미래 DB 연결 시 `404 E_MEETUP_NOT_FOUND`로 바뀌어야 함 | **관찰**(회귀가드) |
| OBS-m-7 | 관찰 | `token.ts` SECRET | NODE_ENV≠production + MOIRA_TOKEN_SECRET 미설정 | 비프로덕션은 경고 없이 고정 dev-secret 서명(스테이징 위조 가능). 테스트 env는 정상(격리 OK). MT-RL-01/03 실행 시 production 분기로 `console.error` 확인됨 | **관찰**(하드닝 권고) |
| OBS-m-8 | 관찰 | `token.ts` verifyToken | payload `exp`/`mid`/`sub` 누락 토큰(미래 포맷) | `as TokenPayload` 단언만, 런타임 형태 미검증. 현재는 우리 서명만 통과해 실위험 낮음 | **관찰**(방어적 코딩 권고) |

---

## 3. 수정 항목 상세 (before / after + 재검증)

### 3-1. BUG-M-2 — `calcScore` 빈 배열 NaN 방어 (수정완료)

**파일**: `src/app/api/moira/meetups/[id]/result/route.ts`
**근거**: 코드리뷰 m-2. `fairness.ts`의 `gapOf/avgOf`는 빈 배열을 0으로 방어하는데
`calcScore`만 방어가 없는 **비대칭**. demo(항상 4명)에선 도달 불가하나 live·compute(0~1명)에서 깨짐.

**before**
```ts
function calcScore(minutes: number[]): number {
  const avg  = minutes.reduce((s, x) => s + x, 0) / minutes.length; // []→0/0=NaN
  const max  = Math.max(...minutes);                                // []→-Infinity
  const sd   = stddev(minutes);
  return MOIRA_SCORE_ALPHA * avg + MOIRA_SCORE_BETA * max + MOIRA_SCORE_GAMMA * sd;
}
```
**after**
```ts
function calcScore(minutes: number[]): number {
  if (minutes.length === 0) return 0; // gapOf/avgOf와 동일 방어. NaN/-Infinity 차단.
  const avg  = minutes.reduce((s, x) => s + x, 0) / minutes.length;
  const max  = Math.max(...minutes);
  const sd   = stddev(minutes);
  return MOIRA_SCORE_ALPHA * avg + MOIRA_SCORE_BETA * max + MOIRA_SCORE_GAMMA * sd;
}
```
**검증**:
- 직접 probe: `calcScore([])` = `0`(수정 후), 수정 전 `NaN` 확인. `[3,NaN,1].sort((a,b)=>a-b)` = `[3,NaN,1]`(미정렬, NaN 오염 입증).
- **RS-16** 신규: demo 응답 전 place `Number.isFinite(fairScore)===true` 且 1위 score=21.6 불변(정상 경로 행동 보존) → green.
- 위험도: **저위험**. `length===0` 케이스만 변경(기존 NaN → 0, 순개선). demo 정상 경로 점수·정렬 불변.

### 3-2. BUG-m-1 — `nanoid10` 모듈로 편향 제거 (수정완료)

**파일**: `src/app/api/moira/meetups/route.ts`
**근거**: 코드리뷰 m-1. `256 % 62 = 8` → 앞 8글자 ~25% 과다.

**before**
```ts
function nanoid10(): string {
  const chars = "ABC...xyz0123456789"; // 62
  return Array.from(randomBytes(10)).map((b) => chars[b % chars.length]).join("");
}
```
**after** (rejection sampling — 출력 계약 `[A-Za-z0-9]{10}` 불변)
```ts
function nanoid10(): string {
  const chars = "ABC...xyz0123456789";
  const len = chars.length;            // 62
  const ceiling = 256 - (256 % len);   // 248
  let out = "";
  while (out.length < 10) {
    for (const b of randomBytes(10 - out.length + 4)) {
      if (b >= ceiling) continue;      // 편향 유발 구간 폐기
      out += chars[b % len];
      if (out.length === 10) break;
    }
  }
  return out;
}
```
**검증**:
- 200,000 표본 probe: 형식/길이 위반 **0**, 글자 빈도 spread **2.4%**(수정 전 ~25%), 50,000개 전수 유일.
- **MT-31** 신규: 라우트 300회 호출 → 전부 `/^[A-Za-z0-9]{10}$/` 매치 + 충돌 0 → green.
- 위험도: **저위험**. 관측 계약(영숫자 10자) 동일, 엔트로피만 개선. 항상 정확히 10자 종료(probe 입증).

### 3-3. BUG-M-1 — 토큰 exp 클램프 (live단계이월, **미수정**)

**판단**: 토큰 서명/수명은 **보안 의미가 큰 로직**이라 신중 처리(작업 지침). 또한 설계서 TK-01/02/03이
**현재의 고정 TTL(72/48/72h)을 명시 계약으로 단언**하며, 설계서 §M-1 가드 메모가
"구현 후 이 단언을 **클램프 케이스로 교체**"하라고 명시 → 클램프 도입은 설계자 케이스 재작성을
동반해야 하는 **설계 변경**이다. 현 단계에선 고정 TTL 계약을 유지하고, 클램프는 백엔드팀이
`issueToken(sub, mid, now?, meetupExpiresAtSec?)` 시그니처 확장으로 처리하도록 이월.
**테스트 가드**: TK-01~03이 현재 TTL을 못박아, 향후 클램프 도입 시 의도된 실패로 변경 지점을 드러낸다.

---

## 4. 테스트 자체 수정(실행 중 발견, 코드 버그 아님)

| 항목 | 증상 | 처리 |
|---|---|---|
| TKP-06 모듈 해석 | `require("@/lib/moira/token")` → CJS에서 `@` 별칭 미해석(`MODULE_NOT_FOUND`) | 상단 ESM `import { extractBearer }`로 교체(vitest resolver 별칭은 ESM import만 적용). TK-18의 `require("crypto")`는 builtin이라 정상. |
| FA-16 타입 | `FAIR_STYLE[lvl] as Record<string, unknown>` → `FairStyle`에 인덱스 시그니처 없어 TS2352 | `fields`를 `as const` 키 튜플로 만들어 `FAIR_STYLE[lvl][f]` 정적 인덱싱(캐스트 제거). |

> 단언 약화 없음 — 두 건 모두 테스트 인프라(모듈 해석·타입)만 정정.

---

## 5. 보안 불변식(INV) 검증 결과

| INV | 의미 | 케이스 | 결과 |
|---|---|---|---|
| INV-1 | 위조 불가 | TK-04,05 / TKP-02 | ✅ 변조 토큰 ok:true 0건(속성 100런↑) |
| INV-2 | 교차 차단 | TK-09 / TKP-03 | ✅ wrong_meetup |
| INV-3 | 권한 분리 | TK-10 | ✅ wrong_sub |
| INV-4 | 검증 우선순위(서명 우선) | TK-17 | ✅ 만료+변조 동시 → signature |
| INV-5 | timing-safe | TK-19 | ✅ 길이 불일치도 throw 없이 signature |
| INV-6 | PII 미노출 | MT-28 / RS-12,13 | ✅ origin·lat·lng 응답 미포함 |
| INV-7 | 비밀 미노출 | MT-29 | ✅ dev-secret·SECRET키명 미포함 |
| INV-8 | hash 계약 | TK-31~33 | ✅ raw 전체 SHA-256 hex64, 벡터 일치(`""`,`abc`) |
| INV-9 | 모드 스키마 동일 | MT-30 / RS-14 | ✅ demo/live data 키집합 동일 |

---

## 6. Quality Gate 판정 (설계서 §4)

| 게이트 | 기준 | 결과 |
|---|---|---|
| 1. P0 100% green | 토큰보안·공평성경계·속성·라우트계약·result·mock의 P0 전량 | ✅ **PASS** (P0 케이스 전부 통과) |
| 2. 속성 무반례 | TKP-01/02/03, FAP-01/02/04/05 fast-check 반례 0 | ✅ **PASS** (반례 0) |
| 3. PII·비밀 누출 0 | INV-6/7 | ✅ **PASS** |
| 4. 기존 테스트 무손상 | `npm test` 전체 green | ✅ **PASS** (323/323, 회귀 0) |
| 5. 타입체크 통과 | `tsc --noEmit` 에러 0 | ✅ **PASS** (클린) |
| 6. 코드리뷰 Blocker 0 | 코드 결함 기준 Blocker | ✅ **PASS** (B-1~3은 live 단계 게이트, 현 단계 범위 밖) |

### ⇒ 최종: **Quality Gate PASS** (현 스텁 단계 머지/다음 단계 진행 가능)

**단서(live 진입 전 필수 해소)**: BUG-M-1(exp 클램프), BUG-B-1/B-2/B-3(DB/Redis/RLS/cron·UUID↔TEXT).
이들은 demo 범위 밖이며, DB 연결 시점에 백엔드팀이 처리 → @QA실행자가 통합/E2E 케이스
(1인1표 경합·폴링·표 멱등·404 분기)를 확장한다. 현 회귀가드(스키마 동일성·hash 계약·정렬·PII)가
그 전환에서 깨짐을 즉시 감지하도록 고정돼 있다.

---

## 7. 산출물

- `tests/moira/_helpers.ts` — env set/restore(`withEnv`/`withDemo`/`withLive`), `postReq`/`getReq`, body 팩토리, UUIDv4 정규식.
- `tests/moira/token.test.ts` / `token.property.test.ts` — 토큰 보안(P0).
- `tests/moira/fairness.test.ts` / `fairness.property.test.ts` — 공평성 수학.
- `tests/moira/meetups.route.test.ts` — POST 계약 + 레이트리밋.
- `tests/moira/result.route.test.ts` — GET 결과 계약.
- `tests/moira/mock.test.ts` — 데모 정본 무결성.
- 수정 코드(모이라 네임스페이스): `src/app/api/moira/meetups/[id]/result/route.ts`(calcScore 가드), `src/app/api/moira/meetups/route.ts`(nanoid10 rejection sampling).
