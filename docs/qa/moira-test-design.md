# 모이라(Moira) 백엔드 — 테스트 설계서

> 작성: @QA설계자 (Opus) | 2026-06-09 | 대상 커밋 기준: 백엔드 스텁(demo 동작) 단계
> 구현 담당: @QA실행자 → `tests/moira/**` (vitest)
> 정본 명세: `docs/backend/moira-backend-final.md` (팀장 FINAL), `moira-api-spec.md`, `moira-db-schema.md`

---

## 0. 한 줄 요약

무가입 토큰의 **보안 불변식**과 공평성 **수학적 정확성**이 P0다. 라우트는 직접 import해
`Request` 객체로 호출하는 `tests/exam/route.test.ts` 하네스를 그대로 따른다. 토큰 라운드트립과
공평성 수학에는 **fast-check 속성 기반 테스트**를 적극 사용한다. DB·Redis·외부 API는 현재
미연결(스텁)이므로 **demo 경로만** 검증하되, 두 모드 스키마 동일성·PII 미노출 같은
"미래에도 깨지면 안 되는" 계약을 회귀 가드로 못박는다.

---

## 1. 테스트 전략

### 1-1. 무엇을 / 왜 / 어느 레벨로

| 대상 | 레벨 | 도구 | 이유 |
|---|---|---|---|
| `token.ts` (issue/verify/hash/extractBearer) | **unit + property** | vitest + fast-check | 보안 핵심. 서명 위조·만료·교차사용을 한 줄이라도 뚫리면 무가입 모델 붕괴. 라운드트립·해시 결정성은 속성으로 전수에 가깝게. |
| `fairness.ts` (gap/avg/level/copy/style) | **unit + property** | vitest + fast-check | 색=공평도 불변식. 등급 경계(10/11/20/21)가 제품의 의미 전부. |
| `POST /meetups` | **route(계약)** | vitest (Request 주입) | 입력 검증(Zod) + 응답 봉투 + demo 모드 + meetupId 형식. 외부 사용자 입력의 1차 방어선. |
| `GET /result` | **route(계약)** | vitest (Request 주입) | demo 응답 스키마 + 공평성 enrich + 정렬 + PII 미노출. |
| `mock.ts` | **unit(무결성)** | vitest | 데모 정본 데이터 계약. times↔MEMBERS 정합, 추천역이 실제로 가장 공평한지. |

### 1-2. 우선순위 정의

- **P0 — 토큰 보안 + 공평성 정확성.** 뚫리면 제품 정체성(무가입·공평)이 무너지는 케이스. 머지 차단.
  - 서명 위조 거부, 만료 거부, 교차 meetup/ sub 거부, timing-safe 비교 존재, 등급 경계 4종, 추천 1위 정렬 정확성, hashToken 결정성·SHA-256 벡터.
- **P1 — 라우트 계약·검증.** Zod 경계, 응답 봉투 형태, bad JSON, 모드 표기, meetupId 형식, result 스키마.
- **P2 — mock 무결성 + 견고성.** 데이터 정합, NaN/빈배열 견고성, 모듈로 편향 등 비기능.

### 1-3. 테스트 하네스 규약 (실행자 필수 준수)

1. 디렉토리: **`tests/moira/`** 전용. `tests/exam/**`·`tests/study/**`·`tests/setup.ts`는 **수정 금지**(읽기만).
2. 라우트 호출: `tests/exam/route.test.ts` 패턴 그대로.
   ```ts
   import type { NextRequest } from "next/server";
   async function loadMeetups() { return import("@/app/api/moira/meetups/route"); }
   function postReq(body: unknown, rawOverride?: string): NextRequest {
     return new Request("http://x/api/moira/meetups", {
       method: "POST",
       headers: { "content-type": "application/json" },
       body: rawOverride !== undefined ? rawOverride : JSON.stringify(body),
     }) as unknown as NextRequest;
   }
   ```
   - `beforeEach(() => vi.resetModules())` 로 모듈 캐시 격리(env가 모듈 로드시 평가되는 `token.ts` SECRET 때문에 중요).
   - 동적 라우트(`result/route.ts`)는 두 번째 인자로 `{ params: { id } }` 직접 전달:
     `await GET(req, { params: { id: "abcdEFGH12" } })`.
3. **레이트리밋**: 라우트는 `NODE_ENV==='test'` 면 RL을 건너뛴다. vitest는 `NODE_ENV=test`로 돌므로 RL 분기는 **기본적으로 비활성**. RL은 별도 케이스(아래 RL 그룹)에서 `process.env.NODE_ENV`를 임시 조작해 검증하되, **수정 후 finally에서 원복**(`tests/exam/_helpers.ts`의 `withExamKey` 패턴 모방한 `withEnv` 헬퍼 작성 권장 — `tests/moira/_helpers.ts`).
4. **env 격리 헬퍼**: 모드 토글(`ODSAY_API_KEY`/`KAKAO_REST_KEY`)과 점수 가중치(`MOIRA_SCORE_*`)는 set/restore 헬퍼로. `tests/setup.ts`가 매 테스트마다 일부 env를 세팅하므로 충돌 주의(모이라 키는 setup이 건드리지 않음 → 안전).
5. **시간 결정성**: `issueToken(sub, mid, now?)` 의 `now` 인자를 명시 주입해 실시간 의존 제거. 만료 테스트는 `now=과거`로 발급하거나, `verifyToken`이 `Date.now()`를 쓰므로 `vi.setSystemTime()` 또는 충분히 과거의 exp를 만들어 검증(권장: `issueToken('host', mid, 0)` → exp = TTL[host] = 259200초 → `vi.setSystemTime(new Date((259200+1)*1000))` 로 만료 유도, `afterEach`에서 `vi.useRealTimers()`).
6. fast-check: `import fc from "fast-check"; fc.assert(fc.property(...))`. 실패 시 최소 반례를 자동 축소.

---

## 2. 테스트 케이스 표

> 형식: ID / 대상 / 입력 / 기대 출력 / 우선순위. @QA실행자는 이 표를 1:1로 코드화한다.
> 파일 분할 권장: `token.test.ts`, `token.property.test.ts`, `fairness.test.ts`,
> `fairness.property.test.ts`, `meetups.route.test.ts`, `result.route.test.ts`, `mock.test.ts`.

### 2-1. `token.ts` — 발급·검증 (파일: `tests/moira/token.test.ts`)

| ID | 대상 | 입력 | 기대 출력 | 우선 |
|---|---|---|---|---|
| TK-01 | issueToken→verifyToken | `issueToken("host","m1")` 후 `verifyToken(t,{meetupId:"m1"})` | `{ok:true, payload.sub:"host", payload.mid:"m1"}`, `payload.uid` 는 UUID v4 정규식 매치, `exp-iat === 72*3600` | **P0** |
| TK-02 | 라운드트립 sub 보존 | `issueToken("invite","m1")` → verify `{meetupId:"m1",requireSub:"invite"}` | `ok:true`, `payload.sub==="invite"`, `exp-iat===48*3600` | P0 |
| TK-03 | voter TTL | `issueToken("voter","m1")` | `exp-iat===72*3600` | P1 |
| TK-04 | 서명 변조 거부 | 정상 토큰의 **sig 파트 1글자 변경** 후 verify | `{ok:false, reason:"signature"}` | **P0** |
| TK-05 | payload 변조 거부 | payload 파트를 다른 base64url로 교체(sig 그대로) → verify | `{ok:false, reason:"signature"}` (재서명 불일치) | **P0** |
| TK-06 | 만료 거부 | `issueToken("host","m1",0)` 후 `vi.setSystemTime((259200+10)*1000)` → verify | `{ok:false, reason:"expired"}` | **P0** |
| TK-07 | 만료 경계(미만료) | `now0` 발급, 시스템시간 `(iat+10)`초 → verify | `ok:true` (exp 한참 미래) | P1 |
| TK-08 | exp 정확히 현재(경계) | 코드상 `exp < now` 일 때만 만료. `exp===now`이면 통과여야 함 → `issueToken(...,T)` 의 exp=T+TTL, 시스템시간=exp 정각 | `ok:true` (`<` 비교라 정각은 유효) — **경계 회귀가드** | P1 |
| TK-09 | 타 meetup 거부 | `issueToken("host","m1")` → `verifyToken(t,{meetupId:"m2"})` | `{ok:false, reason:"wrong_meetup"}` | **P0** |
| TK-10 | requireSub 불일치 | `issueToken("voter","m1")` → verify `{meetupId:"m1",requireSub:"host"}` | `{ok:false, reason:"wrong_sub"}` | **P0** |
| TK-11 | requireSub 생략시 sub 무관 통과 | `issueToken("voter","m1")` → verify `{meetupId:"m1"}` (requireSub 없음) | `ok:true` (sub 체크 skip) | P1 |
| TK-12 | malformed: 점 없음 | `verifyToken("noDotToken",{meetupId:"m1"})` | `{ok:false, reason:"malformed"}` | **P0** |
| TK-13 | malformed: 점 3개(파트>2) | `"a.b.c"` | `{ok:false, reason:"malformed"}` (parts.length!==2) | P0 |
| TK-14 | malformed: 빈 파트1 | `".sig"` | `{ok:false, reason:"malformed"}` (`!parts[0]`) | P0 |
| TK-15 | malformed: 빈 파트2 | `"payload."` | `{ok:false, reason:"malformed"}` (`!parts[1]`) | P0 |
| TK-16 | malformed: 빈 문자열 | `""` | `{ok:false, reason:"malformed"}` | P0 |
| TK-17 | 검증순서: 서명 먼저 | 만료+서명변조 동시(만료 토큰의 sig 변조) → verify | `reason:"signature"` (서명이 만료보다 먼저 평가됨 — DB·파싱 보호 불변식) | **P0** |
| TK-18 | 검증순서: payload 깨짐은 서명 통과 후 malformed | 서명은 유효하나 payload가 유효 base64url이지만 비-JSON(예: `base64url("not json")`로 직접 서명한 토큰) → verify | `{ok:false, reason:"malformed"}` (JSON.parse catch) | P1 |
| TK-19 | timing-safe 길이 불일치 | sig 파트를 정상보다 **짧게/길게** 잘라 verify | `{ok:false, reason:"signature"}` (length 불일치 분기, throw 없이 false) | P0 |
| TK-20 | 비ASCII meetupId 라운드트립 | `issueToken("host","한글-약속-😀")` → verify 동일 mid | `ok:true`, mid 정확 복원(UTF-8) | P1 |

### 2-2. `token.ts` — hashToken / extractBearer (같은 파일 또는 분리)

| ID | 대상 | 입력 | 기대 출력 | 우선 |
|---|---|---|---|---|
| TK-30 | hashToken 결정성 | 동일 문자열 2회 해시 | 두 결과 `===`, 길이 64, `/^[0-9a-f]{64}$/` | **P0** |
| TK-31 | hashToken SHA-256 알려진 벡터 | `hashToken("")` | `e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855` (빈 문자열 SHA-256) | **P0** |
| TK-32 | hashToken SHA-256 벡터2 | `hashToken("abc")` | `ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad` | **P0** |
| TK-33 | hashToken 원문 전체 해시(uid 아님) | `issueToken` 결과 raw 전체 vs payload.uid를 각각 해시 | `hashToken(raw) !== hashToken(uid)` 이고, raw 해시가 정본 — **§2.2 계약 회귀가드** | P0 |
| TK-34 | hashToken 충돌 회피(서로 다른 토큰) | `issueToken("host","m1")` 두 번(uid 랜덤 다름) → 각 raw 해시 | 두 해시 서로 다름 | P1 |
| TK-35 | extractBearer 정상 | `extractBearer("Bearer abc.def")` | `"abc.def"` | P0 |
| TK-36 | extractBearer null 입력 | `extractBearer(null)` | `null` | P0 |
| TK-37 | extractBearer 접두 불일치 | `extractBearer("bearer abc")`(소문자) / `"Token abc"` | 둘 다 `null` (대소문자 구분) | P1 |
| TK-38 | extractBearer 공백만 | `extractBearer("Bearer    ")` | `null` (trim 후 빈문자열→null) | P1 |
| TK-39 | extractBearer 앞뒤 공백 trim | `extractBearer("Bearer  abc.def  ")` | `"abc.def"` (slice(7).trim()) | P1 |
| TK-40 | extractBearer 접두만 | `extractBearer("Bearer ")` | `null` | P1 |

### 2-3. `token.ts` — 속성 기반 (파일: `tests/moira/token.property.test.ts`)

| ID | 대상 | 속성(fast-check) | 기대 | 우선 |
|---|---|---|---|---|
| TKP-01 | issue/verify 라운드트립 | ∀ sub∈{host,invite,voter}, ∀ mid(임의 문자열 1~64자) : `verifyToken(issueToken(sub,mid),{meetupId:mid})` | 항상 `ok:true` 且 payload.sub/mid 일치 | **P0** |
| TKP-02 | 서명 위조 불가 | ∀ raw=issueToken(...), ∀ 변조 인덱스 i in sig : i번째 문자를 다른 문자로 바꾸면 | 항상 `ok:false, reason∈{signature,malformed}` (never ok:true) | **P0** |
| TKP-03 | 교차 meetup 거부 | ∀ mid1≠mid2 : `verifyToken(issueToken(s,mid1),{meetupId:mid2})` | 항상 `reason:"wrong_meetup"` | P0 |
| TKP-04 | hashToken 결정성·형식 | ∀ s(임의 문자열) : `hashToken(s)` | 길이 64, hex only, 동일입력 동일출력, 서로 다른 입력은 (사실상) 다른 출력 | P1 |
| TKP-05 | hashToken 단사(충돌 표본) | ∀ a≠b (표본 N) : `hashToken(a)!==hashToken(b)` | 표본 내 충돌 0 | P2 |
| TKP-06 | extractBearer 멱등성 | ∀ token(점 포함 임의) : `extractBearer("Bearer "+token)` | `=== token.trim()` (token이 비지 않으면) | P2 |

### 2-4. `fairness.ts` — 등급·격차·평균 (파일: `tests/moira/fairness.test.ts`)

> 시그니처(코드 확인): `gapOf(MemberTime[]):number`, `avgOf(MemberTime[]):number(반올림)`,
> `fairLevel(gap:number):"good"|"mid"|"bad"`, `fairCopy(MemberTime[]):string`,
> `FAIR_STYLE:Record<level,FairStyle>`. **추천 정렬 함수는 fairness.ts에 없음** → 정렬은 §2-6 라우트에서 검증.

| ID | 대상 | 입력 | 기대 출력 | 우선 |
|---|---|---|---|---|
| FA-01 | fairLevel 경계 gap=10 | `fairLevel(10)` | `"good"` (≤10) | **P0** |
| FA-02 | fairLevel 경계 gap=11 | `fairLevel(11)` | `"mid"` | **P0** |
| FA-03 | fairLevel 경계 gap=20 | `fairLevel(20)` | `"mid"` (≤20) | **P0** |
| FA-04 | fairLevel 경계 gap=21 | `fairLevel(21)` | `"bad"` (>20) | **P0** |
| FA-05 | fairLevel gap=0 | `fairLevel(0)` | `"good"` | P1 |
| FA-06 | fairLevel 음수 방어 | `fairLevel(-5)` | `"good"` (≤10 분기) — 회귀가드(실무상 gap≥0이나 함수 계약 확인) | P2 |
| FA-07 | gapOf 정상 | `[{minutes:22},{minutes:28},{minutes:26},{minutes:24}]` | `6` (28-22) | **P0** |
| FA-08 | gapOf 단일 멤버 | `[{minutes:30}]` | `0` (max==min) | P0 |
| FA-09 | gapOf 빈 배열 | `[]` | `0` (length===0 가드) | P0 |
| FA-10 | gapOf 동일시간 전원 | `[{minutes:20},{minutes:20},{minutes:20}]` | `0` | P1 |
| FA-11 | avgOf 반올림 | `[{minutes:20},{minutes:21}]` → 평균20.5 | `21` (Math.round, .5 올림) | **P0** |
| FA-12 | avgOf 빈 배열 | `[]` | `0` | P0 |
| FA-13 | avgOf 정상 | mock nogari times(22,28,26,24) | `25` (평균25) | P1 |
| FA-14 | fairCopy 형식 | `[{minutes:22},{minutes:28}]`(gap6) | `"격차 6분 · 공평한 편"` (gap6→? 실제 6≤10→good→"가장 공평") → **정확히 `"격차 6분 · 가장 공평"`** | P1 |
| FA-15 | fairCopy bad | gap=25 구성 `[{minutes:20},{minutes:45}]` | `"격차 25분 · 격차 큼"` | P1 |
| FA-16 | FAIR_STYLE 키 완전성 | `Object.keys(FAIR_STYLE)` | `["good","mid","bad"]` 모두 존재, 각 객체에 bar/text/label 등 7필드 | P2 |
| FA-17 | 색=공평도 매핑 불변 | good.label/mid.label/bad.label | `"가장 공평"/"공평한 편"/"격차 큼"` — 의미 회귀가드 | P1 |
| FA-18 | transfers 무시 | `[{minutes:20,transfers:5},{minutes:24,transfers:0}]` | gapOf=4 (transfers는 gap에 영향 없음) | P2 |

### 2-5. `fairness.ts` — 속성 기반 (파일: `tests/moira/fairness.property.test.ts`)

| ID | 대상 | 속성(fast-check) | 기대 | 우선 |
|---|---|---|---|---|
| FAP-01 | gap 비음수 | ∀ members(minutes∈int[0,300], 1~8명) | `gapOf>=0` 항상 | **P0** |
| FAP-02 | gap = max-min 정의 | ∀ members | `gapOf === Math.max(xs)-Math.min(xs)` | P0 |
| FAP-03 | avg 범위 | ∀ members(비어있지 않음) | `min<=avgOf<=max` (반올림 오차 ±0.5 허용 → `avg>=min-1 && avg<=max+1` 안전식, 또는 정수 minutes면 round가 [min,max] 내) | P1 |
| FAP-04 | level 단조성 | ∀ g1<g2 (둘 다 정수) | `severity(fairLevel(g1)) <= severity(fairLevel(g2))` (good<mid<bad 순서수) — 격차 커지면 등급 절대 좋아지지 않음 | **P0** |
| FAP-05 | level 전역 정의역 | ∀ g∈int[-10,1000] | `fairLevel(g)∈{"good","mid","bad"}` (예외/undefined 없음) | P1 |
| FAP-06 | 단일멤버 항상 good | ∀ 단일 멤버 | `gapOf===0` 且 `fairLevel(0)==="good"` | P1 |

### 2-6. `POST /api/moira/meetups` (파일: `tests/moira/meetups.route.test.ts`)

> 인증 없음. demo 모드(키 없음)에서만 동작. `vi.resetModules()` 필수.

| ID | 입력 | 기대 출력 | 우선 |
|---|---|---|---|
| MT-01 | `{hostName:"민호",hostOrigin:"강남구 역삼동"}` (ttl 생략) | `status 201`, `json.success===true`, `data.meetupId`(10자), `data.hostToken`(점 1개 포함), `data.inviteToken`, `data.inviteUrl` 가 `/j/{meetupId}?t={inviteToken}` 포함, `meta.mode==="demo"` | **P0** |
| MT-02 | 봉투 형태 정밀검사 | `Object.keys(json)` ⊇ `{success,data,meta}`, `Object.keys(data)===["meetupId","hostToken","inviteUrl","inviteToken"]` (스펙 §6-1 계약) | **P0** |
| MT-03 | hostToken 검증가능 | MT-01 응답의 hostToken → `verifyToken(hostToken,{meetupId:data.meetupId,requireSub:"host"})` | `ok:true` (발급된 토큰이 실제 유효) | **P0** |
| MT-04 | inviteToken sub | `verifyToken(inviteToken,{meetupId:data.meetupId,requireSub:"invite"})` | `ok:true` | P0 |
| MT-05 | hostName 빈값 `""` | `{hostName:"",hostOrigin:"강남"}` | `400`, `error.code==="E_VALIDATION"`, `error.fieldErrors.hostName` 존재 | **P0** |
| MT-06 | hostName 21자(>20) | `"가".repeat(21)` | `400 E_VALIDATION`, fieldErrors.hostName | P0 |
| MT-07 | hostName 20자 경계 | `"가".repeat(20)` | `201` (max 통과) | P1 |
| MT-08 | hostName 1자 경계 | `"가"` | `201` (min1 통과) | P1 |
| MT-09 | hostOrigin 1자(<2) | `{hostName:"민호",hostOrigin:"강"}` | `400 E_VALIDATION`, fieldErrors.hostOrigin | **P0** |
| MT-10 | hostOrigin 2자 경계 | `"강남"` | `201` | P1 |
| MT-11 | hostOrigin 100자 경계 | `"가".repeat(100)` | `201` | P1 |
| MT-12 | hostOrigin 101자(>100) | `"가".repeat(101)` | `400 E_VALIDATION` | P1 |
| MT-13 | ttlHours 0(<1) | `{...valid, ttlHours:0}` | `400 E_VALIDATION`, fieldErrors.ttlHours | **P0** |
| MT-14 | ttlHours 73(>72) | `ttlHours:73` | `400 E_VALIDATION` | P0 |
| MT-15 | ttlHours 1 경계 | `ttlHours:1` | `201` | P1 |
| MT-16 | ttlHours 72 경계 | `ttlHours:72` | `201` | P1 |
| MT-17 | ttlHours 문자열 "48" coerce | `ttlHours:"48"` | `201` (z.coerce.number 통과) | P1 |
| MT-18 | ttlHours 비숫자 문자열 "abc" | `ttlHours:"abc"` | `400 E_VALIDATION` (coerce 실패→NaN) | P1 |
| MT-19 | ttlHours 2.5(소수) | `ttlHours:2.5` | `400 E_VALIDATION` (`.int()` 위반) | P1 |
| MT-20 | ttlHours 생략 → default | valid에서 ttlHours 제거 | `201` (default 48 적용, 응답엔 노출 안 됨 — 단지 성공) | P1 |
| MT-21 | 빈 객체 `{}` | `400 E_VALIDATION`, fieldErrors에 hostName·hostOrigin 둘 다 | **P0** |
| MT-22 | bad JSON | rawOverride `"{not json"` | `400`, `error.code==="E_BAD_JSON"` | **P0** |
| MT-23 | 빈 본문 `""` | rawOverride `""` | `400 E_BAD_JSON` (req.json() throw) | P0 |
| MT-24 | meetupId 형식 | MT-01 의 meetupId | `/^[A-Za-z0-9]{10}$/` 매치(nanoid10, URL-safe 영숫자만) | **P0** |
| MT-25 | meetupId 유일성 | POST 2회 호출 | 두 meetupId 서로 다름 | P1 |
| MT-26 | hostToken≠inviteToken | MT-01 | 두 토큰 문자열 다름(다른 sub·다른 uid) | P1 |
| MT-27 | inviteUrl baseUrl 기본값 | env `NEXT_PUBLIC_MOIRA_BASE_URL` 미설정 | inviteUrl이 `https://moira.app/j/` 로 시작 | P2 |
| MT-28 | **PII 미노출** | MT-01 응답 전체 JSON 문자열 | hostOrigin 원문("강남구 역삼동")이 응답 어디에도 **미포함**, lat/lng 키 없음 | **P0** |
| MT-29 | 토큰 비밀 미노출 | 응답 JSON 문자열 | `MOIRA_TOKEN_SECRET` 값·`"moira-dev-secret"` 미포함 | P0 |
| MT-30 | live 모드 meta(키 주입) | `ODSAY_API_KEY`+`KAKAO_REST_KEY` set, geocode는 `vi.stubGlobal('fetch',...)` 로 실패/모킹 → POST | `meta.mode==="live"`, **응답 스키마는 demo와 동일 키 집합**(data 4필드 동일) — §6-3 동일성 계약. (DB 미연결이라 토큰·meetupId는 정상 생성됨) | P1 |

#### 2-6b. 레이트리밋 (파일 동일, describe 분리)

| ID | 입력 | 기대 출력 | 우선 |
|---|---|---|---|
| MT-RL-01 | `NODE_ENV`를 `"production"`으로 임시 변경 + `x-forwarded-for` 고정 + `MOIRA_RL_CREATE_PER_MIN` 작게(예 2) → 동일 IP로 limit+1회 POST | 마지막 요청 `429`, `error.code==="E_RATE_LIMIT"`, `Retry-After` 헤더 존재. **반드시 finally에서 NODE_ENV 원복 + rate-limit 전역 리셋**(`__resetRateLimit()` import) | P1 |
| MT-RL-02 | `NODE_ENV==='test'`(기본) 에서 limit 초과로 다회 POST | 전부 `201` (test 환경 RL skip 회귀가드) | P2 |
| MT-RL-03 | 서로 다른 `x-forwarded-for` 두 IP | 각 IP 독립 카운트(한 IP 차단돼도 다른 IP 통과) | P2 |

### 2-7. `GET /api/moira/meetups/[id]/result` (파일: `tests/moira/result.route.test.ts`)

> 호출: `await GET(req, { params: { id } })`. demo 모드에서만 200.

| ID | 입력 | 기대 출력 | 우선 |
|---|---|---|---|
| RS-01 | demo, `id="abcd123456"` | `200`, `success:true`, `data.recommendedStation.name==="을지로3가"`, `data.recommendedStation.lines` 배열, `data.places.length===5` | **P0** |
| RS-02 | 봉투/메타 | `meta.mode==="demo"`, `meta.version===1`, `meta.meetupId===id` (path echo) | P1 |
| RS-03 | place 스키마 | 각 place에 `{id,name,category,walkMin,blurb,times,fairGap,fairAvg,fairScore,fairLevel,votes}` 전부 존재(스펙 §6-5 계약) | **P0** |
| RS-04 | fairGap 계산 정확 | nogari(22,28,26,24) place의 `fairGap` | `6` (gapOf 일치) | P0 |
| RS-05 | fairAvg 계산 | nogari place `fairAvg` | `25` (avgOf 일치) | P1 |
| RS-06 | fairLevel 일치 | 각 place `fairLevel===fairLevel(fairGap)` | 전 place에서 참 | P0 |
| RS-07 | **정렬: 가장 공평이 1위** | `data.places` 배열 | `fairScore` **오름차순 정렬**(places[i].fairScore <= places[i+1].fairScore 전구간). 가장 낮은 score가 index0 | **P0** |
| RS-08 | 추천 1위 식별 | places[0] | 5개 중 `fairScore` 최소값과 동일 | **P0** |
| RS-09 | fairScore 공식 검증 | 임의 place의 minutes로 `0.4*avg+0.4*max+0.2*stddev_pop` 직접 계산 후 ×10 반올림/10 | place.fairScore와 일치(±0.05) — α/β/γ 기본값 가정 | P1 |
| RS-10 | 가중치 env 반영 | `MOIRA_SCORE_ALPHA="1"`,BETA="0",GAMMA="0" set → GET | fairScore가 `round(avg*10)/10` 과 일치(평균만 반영). **resetModules 후 import 필수**(모듈 상단 상수 평가) | P1 |
| RS-11 | live 미연결 → 409 | `ODSAY_API_KEY`+`KAKAO_REST_KEY` set → GET | `409`, `error.code==="E_NOT_READY"` (live 스텁 미구현 fallback) | P1 |
| RS-12 | **PII 미노출** | 응답 전체 JSON | MEMBERS의 `origin`("강남구 역삼동" 등) 미포함, lat/lng 키 없음. (times엔 name·minutes만) | **P0** |
| RS-13 | times 구조 | place.times 원소 | `{name,minutes,transfers?}` 만(좌표·origin 없음) | P0 |
| RS-14 | 모드 스키마 동일성 | RS-01(demo) vs 향후 live data 키집합 | demo `data` 최상위 키 = `["recommendedStation","places"]` 고정 — §6-3 회귀가드 | P1 |
| RS-15 | 빈 id | `params.id===""` | demo면 여전히 `200`(현 스텁은 DB 미조회라 id 검증 안 함) — **현 동작 회귀가드**(미래 DB 연결 시 404로 바뀌어야 함을 코드리뷰에 명시) | P2 |

### 2-8. `mock.ts` 무결성 (파일: `tests/moira/mock.test.ts`)

| ID | 대상 | 입력/검사 | 기대 출력 | 우선 |
|---|---|---|---|---|
| MK-01 | MEMBERS 수 | `MEMBERS.length` | `4` | P1 |
| MK-02 | MEMBERS host 단일 | `MEMBERS.filter(m=>m.status==="host")` | 정확히 1명(`id==="me"`,name "민호") | P1 |
| MK-03 | avatar hex 형식 | 각 member.avatar | `/^#[0-9A-F]{6}$/i` 매치 | P2 |
| MK-04 | id 유일성 | `MEMBERS.map(m=>m.id)` | 중복 없음 | P2 |
| MK-05 | PLACES 수 | `PLACES.length` | `5` | **P1** |
| MK-06 | times↔MEMBERS 정합 | 각 place.times.length 와 이름 순서 | 모든 place에서 `times.length===4` 且 names===`["민호","서연","지훈","예린"]`(순서 일치, 주석 계약) | **P0** |
| MK-07 | place id 유일성 | `PLACES.map(p=>p.id)` | 중복 없음 | P1 |
| MK-08 | minutes 양수 | 모든 times.minutes | `>0` (DB CHECK minutes>0 계약) | P1 |
| MK-09 | transfers 비음수 | 모든 times.transfers | `>=0` | P2 |
| MK-10 | walkMin 비음수 | 각 place.walkMin | `>=0` | P2 |
| MK-11 | votes 비음수 | 각 place.votes | `>=0` (`nogari:2,gwangjang:1,나머지0`) | P2 |
| MK-12 | category enum | 각 place.category | `Category` 5종 중 하나 | P2 |
| MK-13 | **추천역 정합** | 전 place에 대해 fairScore 계산(result와 동일 공식) | **score 최소(=가장 공평) place가 RECOMMENDED_STATION의 의도와 모순 없음** — 적어도 nogari(노가리골목)가 점수 상위(낮은 편)임을 확인. 정렬 1위 place의 fairLevel이 "good" 임을 보장 | **P0** |
| MK-14 | APPOINTMENT placeId 유효 | `APPOINTMENT.placeId` | `PLACES` 내 존재(`"nogari"`) | P1 |
| MK-15 | RECOMMENDED_STATION 구조 | `{name,lines,reason}` | name 문자열, lines 비어있지 않은 배열, reason 문자열 | P2 |

---

## 3. 엣지케이스·동시성·불변식 모음

### 3-1. 경계값 집중 매트릭스

| 필드 | 0/min-1 | min 경계 | max 경계 | max+1 | 비숫자/특수 |
|---|---|---|---|---|---|
| hostName | "" (MT-05) | 1자(MT-08) | 20자(MT-07) | 21자(MT-06) | 이모지·공백 |
| hostOrigin | 1자(MT-09) | 2자(MT-10) | 100자(MT-11) | 101자(MT-12) | — |
| ttlHours | 0(MT-13) | 1(MT-15) | 72(MT-16) | 73(MT-14) | "abc"(MT-18), 2.5(MT-19) |
| gap | 음수(FA-06) | 0(FA-05) | 10/20(FA-01,03) | 11/21(FA-02,04) | — |
| token exp | 과거(TK-06) | 정각(TK-08) | — | — | malformed(TK-12~16) |

### 3-2. 보안 불변식 (회귀가드 — 절대 깨지면 안 됨)

- **INV-1 위조 불가**: 어떤 변조된 토큰도 `ok:true`를 받지 못한다(TK-04,05, TKP-02).
- **INV-2 교차 차단**: 한 약속의 토큰은 다른 약속에서 무효(TK-09, TKP-03).
- **INV-3 권한 분리**: voter 토큰으로 host 자리 진입 불가(TK-10).
- **INV-4 검증 우선순위**: 서명 실패는 만료·파싱보다 먼저 평가(TK-17) → DB·파서를 공격 표면에서 보호.
- **INV-5 timing-safe**: 길이 불일치/내용 불일치 모두 throw 없이 false(TK-19); 코드에 `timingSafeEqual` 사용 존재.
- **INV-6 PII 미노출**: 어떤 응답에도 좌표·타인 origin 원문 미포함(MT-28, RS-12).
- **INV-7 비밀 미노출**: 응답·에러에 `MOIRA_TOKEN_SECRET`·dev secret 미포함(MT-29).
- **INV-8 hash 계약**: `hashToken`은 원문 토큰 전체 SHA-256 hex64, Postgres `moira_hash_token`과 동일(TK-31~33).
- **INV-9 모드 스키마 동일**: demo/live 응답의 키 집합 동일(MT-30, RS-14).

### 3-3. 미래 동시성(현 스텁 미구현 — 케이스만 명시, 구현 보류)

> DB·Redis 미연결로 **현재 테스트 불가**. P0 클라이언트 연결(§백엔드 P0) 이후 @QA실행자가 추가.

- 1인1표 경합: 동일 voterToken 동시 2건 투표 → DB `UNIQUE(meetup_id, voter_token_hash)`로 1행만(추후 통합테스트).
- 표 변경 멱등: 동일 placeId 재투표 → `idempotent:true`, 다른 placeId → `changed:true`(ON CONFLICT DO UPDATE).
- 버전 카운터 단조 증가: members/compute/vote/confirm 시 `moira:ver` INCR.
- 위 항목은 `docs/qa/moira-code-review.md`의 "미연결 리스크"와 연동.

---

## 4. Quality Gate (모이라 백엔드 — 현 단계 릴리즈/머지 조건)

릴리즈(=다음 단계 진행) 전 **반드시** 통과:

1. **P0 케이스 100% green.** 토큰 보안(TK-01,04,05,06,09,10,12~17,19,30~33,35,36), 공평성 경계(FA-01~04,07~09,11), 속성(TKP-01~03, FAP-01,02,04), 라우트 계약(MT-01,02,03,05,09,13,14,21,22,24,28), result(RS-01,03,07,08,12), mock(MK-06,13).
2. **속성 테스트 무반례**: TKP-01/02/03, FAP-01/02/04/05 — fast-check 기본 100런 이상에서 반례 0.
3. **PII·비밀 누출 0**: INV-6/7 케이스 전부 green.
4. **기존 테스트 무손상**: `npm test` 전체(exam/study 포함) 전부 green — 모이라 추가로 인한 회귀 0.
5. **타입체크 통과**: `npm run type-check` 에러 0(테스트 파일 포함).
6. 코드리뷰의 **Blocker 0건**(Major는 백로그 등록 후 진행 허용, 단 보안 Major는 게이트).

> 미연결(DB/Redis/live) 영역은 본 게이트 **범위 밖**(스텁 단계). 단 "미래에 연결될 때 깨지면 안 되는 계약"(스키마 동일성·hash 계약·정렬·PII)은 지금 회귀가드로 고정한다.

---

## 5. 자동화 전략

| 항목 | 도구 | 자동화 | 비고 |
|---|---|---|---|
| 토큰 유닛/속성 | vitest + fast-check | ✅ 전량 | 순수함수, 결정적. CI 필수. |
| 공평성 유닛/속성 | vitest + fast-check | ✅ 전량 | 동일. |
| 라우트 계약 | vitest(Request 주입) | ✅ 전량 | Next 미기동, route export 직접 호출(exam 패턴). |
| mock 무결성 | vitest | ✅ 전량 | import해서 단언. |
| 레이트리밋 | vitest | ✅ (env 토글) | NODE_ENV 조작 + `__resetRateLimit`로 격리. |
| DB/Redis/live 통합 | (보류) | ⬜ | 클라이언트 연결 후 testcontainers 또는 모킹 어댑터로 추가. 현 단계 제외. |

**CI 권장**: `npm test` 에 모이라 포함되도록 별도 설정 불필요(vitest include가 `tests/**/*.test.ts` 글롭). 속성 테스트 시드 고정(`fc.configureGlobal({ seed: ... })`)은 **하지 않음** — 매 실행 다른 입력으로 더 넓게 탐색하되, 실패 시 vitest 로그의 `seed`/`counterexample`로 재현. flaky가 문제되면 그때 시드 고정.

---

## 6. 실행자 인계 메모 (구현 순서 권장)

1. **먼저** `tests/moira/_helpers.ts`(env set/restore `withEnv`, demo/live 토글, valid body 팩토리, postReq/getReq) 작성.
2. `token.test.ts`(TK-*) → `token.property.test.ts`(TKP-*) — **P0 보안 최우선**.
3. `fairness.test.ts`(FA-*) → `fairness.property.test.ts`(FAP-*).
4. `meetups.route.test.ts`(MT-*, MT-RL-*) → `result.route.test.ts`(RS-*).
5. `mock.test.ts`(MK-*).
6. 실행 중 발견 버그는 `docs/qa/moira-bug-report.md`로(설계자 코드리뷰와 ID 정합 유지).
