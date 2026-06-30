# Tier.gg — 테스트 계획

- 작성자: @QA설계자 (Opus)
- 작성일: 2026-05-28
- 대상: `apps/tier-gg/` MVP (Next.js 15 App Router + React 19 + Supabase / mock 분기)
- 인계: @QA실행자 (Opus) — 본 문서 §7의 인계 가이드에 따라 테스트 코드 구현

---

## 1. 테스트 범위

### 대상 (In-Scope)
- **단위**: UI 컴포넌트 (Button, Badge, ModelChip, MetricCard, SourceBadge, ScoreBar, CompareTable, SearchInput, ThemeToggle)
- **단위**: Repository 함수 (`models.ts`, `wizard.ts`, `compare.ts`, `changelog.ts`) — mock 분기 위주
- **단위**: Schema 검증 (`schemas.ts`의 Zod 스키마들)
- **단위**: Mock adapter (`mock-adapter.ts`)
- **통합**: API Route Handler (GET /api/v1/models, [slug], compare, leaderboard/[metric], search, changelog, find / POST /api/v1/find / admin POST·PATCH)
- **통합**: `/compare/[pair]` 알파벳 정렬 redirect
- **통합**: i18n 라우팅 (`en` 무프리픽스, `ko` 프리픽스), 메시지 키 누락 검증
- **데이터 무결성**: `mock-models.ts` (30개) 슬러그 유니크성 / providerSlug 참조 / source 필수 필드
- **빌드/타입**: `tsc --noEmit` + `next build`

### 제외 (Out-of-Scope, MVP)
- 실제 Supabase 인스턴스 대상 e2e (mock 모드로 대체)
- 시각 회귀 (Visual Regression) — Playwright 도입 이전이므로 수동 스모크로 대체
- 성능 부하 테스트 (k6 등) — 트래픽 발생 후 별도 라운드
- OG 이미지 픽셀 단위 검증 — 응답 200 + content-type 확인까지만

---

## 2. 테스트 전략 — 레이어별 도구

| 레이어 | 도구 | 환경 | 목적 |
|---|---|---|---|
| 컴포넌트 단위 | Vitest + React Testing Library | jsdom (파일 상단 `// @vitest-environment jsdom`) | 렌더, 상호작용, 접근성 속성 |
| Repository / Schema | Vitest | node | mock 분기 결과·정렬·필터 정확성 |
| Route Handler 통합 | Vitest (Route 함수 직접 import) | node | 캐시 헤더, 응답 형식, 에러 코드 |
| 알파벳 redirect | Vitest (page() 함수 직접 호출) | node | `redirect()` throw 확인 |
| i18n 메시지 키 | Vitest (en/ko JSON diff 스캐너) | node | 키 누락 자동 감지 |
| 데이터 무결성 | Vitest | node | mock-models 정합성 |
| 빌드/타입 | `pnpm tsc --noEmit`, `pnpm next build` | CI shell | 컴파일·정적 분석 |
| 수동 스모크 | Browser (Chrome) | dev server | 핵심 페이지 6개 (홈/모델리스트/모델상세/비교/위저드/리더보드) |

루트 `vitest.config.ts`는 이미 alias `@` → `apps/tier-gg/src` 가 아닌 루트 `./src`로 잡혀있다.  
**조치 필요**: 테스트 실행 시 `apps/tier-gg/` 내부 전용 `vitest.config.ts` 또는 alias 분리. (§6 코드 리뷰 참조)

---

## 3. 테스트 케이스 설계

우선순위: **P0 = 릴리즈 차단**, **P1 = 릴리즈 권장 통과**, **P2 = 후속 라운드**

### 3.1 컴포넌트 단위 (RTL + jsdom)

| ID | 컴포넌트 | 시나리오 | 입력 | 기대 결과 | P |
|---|---|---|---|---|---|
| C-01 | Button | variant=primary 렌더 | `<Button>OK</Button>` | role=button + 텍스트 일치 + variant 클래스 | P0 |
| C-02 | Button | disabled 클릭 무반응 | onClick mock, disabled | onClick 호출 0회 + aria-disabled 또는 disabled attr | P0 |
| C-03 | Badge | confidence T1/T2/T3별 색 토큰 클래스 | 각 prop | 클래스 분기 정확 | P1 |
| C-04 | ModelChip | provider 미지정 시 'other' fallback | unknown provider | 'other' 토큰 적용 | P1 |
| C-05 | MetricCard | value=null 처리 | null | "N/A" 렌더, 숫자 포맷 깨짐 없음 | P0 |
| C-06 | SourceBadge | sourceUrl 없으면 텍스트 only | url=undefined | a 태그 미렌더 + text 노출 | P1 |
| C-07 | ScoreBar | 0/100/초과(120) 경계값 | 각 값 | width 0%/100%/100%(clamp) | P0 |
| C-08 | CompareTable | highlight=min 가격 행에서 최저값 강조 | 2 모델, A 더 저렴 | A 셀에 강조 클래스 | P0 |
| C-09 | CompareTable | highlight=max & N/A 혼재 | A=N/A, B=80 | B 강조, N/A 셀은 비강조 | P0 |
| C-10 | SearchInput | onChange debounce 동작 | 타이핑 시뮬레이션 | 마지막 1회만 콜백 | P1 |
| C-11 | ThemeToggle | localStorage persist | 클릭 → reload | 다크/라이트 유지 | P2 |

### 3.2 Repository / Mock adapter

| ID | 함수 | 시나리오 | 기대 결과 | P |
|---|---|---|---|---|
| R-01 | `adaptModelToSummary` | mock 1건 변환 | provider 객체 매핑, modality[0] | P0 |
| R-02 | `adaptModelToDetail` | scores 매핑 | mmlu/humaneval/gpqa/arena_elo 포함 | P0 |
| R-03 | `getAllMockSummaries` | published만 필터 | draft/review 제외 | P0 |
| R-04 | `getMockDetailBySlug` | 없는 slug | null 반환 | P0 |
| R-05 | `getMockChangelogAdapted` | entity_slug 미존재 | entity_id=null, name=undefined | P1 |
| R-06 | `listModels` (mock) | provider 필터 | 해당 provider만 | P0 |
| R-07 | `listModels` (mock) | cursor 페이지네이션 | limit·hasMore 정합 | P1 |

### 3.3 위저드 추천 로직 (`wizard.ts` mock 분기)

| ID | 시나리오 | 입력 | 기대 결과 | P |
|---|---|---|---|---|
| W-01 | budget=free → 가격 0 또는 null만 통과 | task=writing, budget=free | 모든 결과의 priceInput ∈ {0, null} | P0 |
| W-02 | budget=low, ceiling 2 | task=coding | priceInput ≤ 2 또는 null | P0 |
| W-03 | task=coding → humaneval 사용 | budget=high | humaneval 보유 모델이 상위 | P0 |
| W-04 | 가중치 검증 — totalScore = nb·0.4 + np·0.4 + no·0.2 | 수동 계산 비교 | 오차 ≤ 0.01 | P0 |
| W-05 | 응답에 weights 필드 포함 (투명성) | 임의 입력 | `{benchmark:0.4, priceEfficiency:0.4, other:0.2}` | P0 |
| W-06 | 가격 필터 후 0건 | budget=free + 모든 mock 유료 시 (mock 변조) | `[]` 반환 + 200 | P1 |
| W-07 | Top3 길이 보장 | 임의 입력 | length ≤ 3, rank 1·2·3 순 | P0 |
| W-08 | 경계: contextWindow null 시 기본 4 사용 → no = 4/1000 = 0.004 | mock 변조 | NaN/Infinity 없음 | P1 |
| W-09 | 동률 처리 — totalScore 같을 때 안정 정렬 | 동률 입력 | crash 없음, 길이 3 | P2 |

### 3.4 /compare/[pair] 알파벳 정렬 redirect

| ID | 시나리오 | 입력 pair | 기대 결과 | P |
|---|---|---|---|---|
| CP-01 | 역순 입력 → redirect | `gpt-4o_vs_claude-sonnet-4-6` | `redirect("/compare/claude-sonnet-4-6_vs_gpt-4o")` 호출 | P0 |
| CP-02 | 역순 + ko locale | locale=ko, 위 입력 | `/ko/compare/...` 경로 | P0 |
| CP-03 | 정상 정렬 → redirect 미발생 | `claude-sonnet-4-6_vs_gpt-4o` | redirect 호출 0회, 200 페이지 | P0 |
| CP-04 | `_vs_` 없음 → notFound() | `claude-sonnet-4-6` | notFound throw | P0 |
| CP-05 | 한쪽 slug 없음 + 한쪽 존재 | `unknown-x_vs_gpt-4o` | 페이지 렌더 + invalidSlug 알림 | P1 |
| CP-06 | 양쪽 모두 없음 | `foo_vs_bar` (정렬 OK) | notFound throw | P0 |
| CP-07 | 동일 slug 비교 | `gpt-4o_vs_gpt-4o` | 정책 정의 필요(현재 통과). 권장: notFound 또는 동일 비교 안내 | P1 |

### 3.5 i18n

| ID | 시나리오 | 기대 결과 | P |
|---|---|---|---|
| I-01 | `messages/en.json` ↔ `messages/ko.json` 키 셋 일치 | 누락 키 0 | P0 |
| I-02 | en 무프리픽스 라우팅 (`/models`) | 200 + locale=en | P0 |
| I-03 | ko 프리픽스 (`/ko/models`) | 200 + locale=ko | P0 |
| I-04 | 미지원 locale (`/ja/models`) | 404 또는 default redirect | P1 |
| I-05 | placeholder 변수(`{a}`, `{b}`) 보존 | 양 언어 동일 변수명 | P1 |

### 3.6 API Route Handler

| ID | 엔드포인트 | 시나리오 | 기대 결과 | P |
|---|---|---|---|---|
| A-01 | GET /api/v1/models | 정상 | 200, `success:true`, `Cache-Control: public, s-maxage=300, stale-while-revalidate=3600`, meta.cursor 포함 | P0 |
| A-02 | GET /api/v1/models | limit=200 (초과) | 422 VALIDATION_ERROR (max 100) | P0 |
| A-03 | GET /api/v1/models/[slug] | 미존재 slug | 404 NOT_FOUND | P0 |
| A-04 | GET /api/v1/compare?ids=a (1개) | 검증 실패 | 422, 메시지 "최소 2개..." | P0 |
| A-05 | GET /api/v1/compare?ids=a,b,c,d,e | 5개 | 422, "최대 4개..." | P0 |
| A-06 | GET /api/v1/leaderboard/price | 정상 | 200 + 정렬(가격 오름차순) | P0 |
| A-07 | GET /api/v1/leaderboard/unknown | 잘못된 metric | 422 또는 404 | P1 |
| A-08 | GET /api/v1/search?q= | 빈 문자열 | 422 (min 1) | P0 |
| A-09 | GET /api/v1/search?q=gpt | 정상 | 200 + 결과 길이 ≤ limit | P1 |
| A-10 | POST /api/v1/find | 정상 body | 200, weights·recommendations·input 포함, **캐시 헤더 없음** | P0 |
| A-11 | POST /api/v1/find | invalid JSON | 400 BAD_REQUEST "Invalid JSON body" | P0 |
| A-12 | POST /api/v1/find | role 미상 enum | 422 VALIDATION_ERROR, path=role | P0 |
| A-13 | GET /api/v1/changelog | 정상 | 200 + 캐시 헤더 | P1 |
| A-14 | 모든 GET 응답 | 공통 형식 `{success, data, error}` | 형식 일치 | P0 |
| A-15 | 모든 에러 응답 | `{success:false, data:null, error:{code, message}}` | 형식 일치 | P0 |

### 3.7 관리자 인증

| ID | 시나리오 | 기대 결과 | P |
|---|---|---|---|
| AD-01 | Authorization 헤더 없음 | 401 UNAUTHORIZED | P0 |
| AD-02 | `Bearer` 없는 형식 (`token xxx`) | 401 | P0 |
| AD-03 | `ADMIN_EMAIL` 환경변수 미설정 | 500 INTERNAL_ERROR + 콘솔 에러 | P0 |
| AD-04 | 유효 JWT, 이메일 불일치 | 403 FORBIDDEN | P0 |
| AD-05 | 잘못된 JWT (서명 실패) | 401 UNAUTHORIZED | P0 |
| AD-06 | POST /api/admin/models, slug 중복 | 400 BAD_REQUEST "already exists" | P0 |
| AD-07 | POST /api/admin/models, slug 형식 위반 (대문자) | 422 VALIDATION_ERROR | P0 |
| AD-08 | PATCH /api/admin/models/[id], 존재하지 않는 id | 404 | P1 |
| AD-09 | mock 모드에서 admin POST 호출 | 현재 supabaseAdmin이 dummy → 호출 시 에러 → 500. **권장**: isMockMode 가드 추가 | P0 (개선) |

### 3.8 데이터 무결성 — mock-models.ts (30개)

| ID | 시나리오 | 기대 결과 | P |
|---|---|---|---|
| D-01 | slug 유니크 | 30개 set size === 30 | P0 |
| D-02 | id 유니크 | 30개 | P0 |
| D-03 | providerSlug 참조 유효성 | 모든 모델의 providerSlug ∈ mockProviders.slug | P0 |
| D-04 | source.url 존재 + http(s) | regex `^https?://` | P0 |
| D-05 | source.verifiedAt ISO date | `Date.parse` valid | P0 |
| D-06 | scores 값 범위 — MMLU/HumanEval/GPQA 0~100 | 모든 모델 | P0 |
| D-07 | attrs.priceInput ≥ 0 또는 null | 음수 없음 | P0 |
| D-08 | status='published' 모델 ≥ 1 | 빈 리스트 방지 | P0 |
| D-09 | mockChangelog.entitySlug 참조 유효성 | 모든 항목이 mockModels에 존재 (혹은 의도된 미존재 명시) | P1 |
| D-10 | slug 길이 ≤ 100 + `[a-z0-9-]+` | regex 통과 | P1 |

---

## 4. 엣지케이스 카탈로그

- **경계값**: limit=1/100/101, q="" / 100자 / 101자, ids 개수 0/1/2/4/5
- **빈 데이터**: 가격 필터 후 0건, search 0건, compare slug 둘 다 부재
- **null 폭탄**: scores 전부 null, contextWindow null, priceInput null, summary null
- **유니코드/특수문자**: slug에 한글·이모지 삽입 시 422
- **중복**: slug 중복 등록, compare ids=a,a
- **케이스 민감도**: slug 'GPT-4o' (대문자) → 422
- **알파벳 정렬 동일 slug**: a_vs_a 케이스 (현재 통과 — 정책 필요)
- **i18n 누락**: 한쪽 언어에만 키 추가
- **동시성**: 같은 slug 동시 POST → 한쪽 400, 한쪽 201 (DB 유니크 제약 의존)
- **헤더 위·변조**: Authorization 헤더 매우 김(>8KB), 줄바꿈 포함
- **에지 런타임 한계**: `runtime = "edge"` 라우트에서 Node-only API 사용 금지 검증

---

## 5. Quality Gate (릴리즈 PASS 조건)

릴리즈 가능 조건은 **다음 항목 모두 통과**:

1. **P0 케이스 100% Pass**, P1 케이스 ≥ 90% Pass
2. `pnpm tsc --noEmit` 에러 0
3. `pnpm next build` 성공 (warning 허용, error 0)
4. Lighthouse (홈/모델상세) — Performance ≥ 80, Accessibility ≥ 95
5. mock 모드(`USE_MOCK_DATA=true`)로 핵심 6페이지 수동 스모크 클리어
6. i18n 키 누락 0 (I-01)
7. 데이터 무결성 D-01~D-08 전부 통과
8. 콘솔 에러·경고 0 (수동 스모크 중)
9. /compare/[pair] 알파벳 redirect 동작 (CP-01·CP-03)
10. POST /api/v1/find 응답에 weights 노출 (W-05)

P1 미달 또는 P0 1건 실패 시 **릴리즈 보류**.

---

## 6. 코드 리뷰 — 발견된 잠재 이슈

### B-01 (P0, 보안/안정성) `requireAdmin` 반환 분기 판별 불안정
`api/admin/models/route.ts`가 `"status" in authResult`로 NextResponse 여부를 판단한다.  
하지만 성공 반환값 `{ userId, email }`에는 `status`가 없어 현재는 동작하지만, 향후 `status` 필드 추가 시 silent break. **권장**: `authResult instanceof NextResponse` 사용.

### B-02 (P0, 안정성) mock 모드에서 admin 라우트가 supabaseAdmin 직호출
`api/admin/models/route.ts`·`[id]/route.ts`는 `isMockMode()` 가드 없이 `supabaseAdmin.from(...)` 호출. mock 환경에서 호출 시 dummy URL로 네트워크 에러 → 500. **권장**: 라우트 진입 시 `if (isMockMode()) return Errors.forbidden() / notImplemented()`.

### B-03 (P1, 일관성) wizard mock 분기 contextWindow 단위 불일치
mock 분기는 `cw / 1000` (cw가 K 단위라면 분모도 K여야 함 → 1000K=1M tokens), Supabase 분기는 `contextWindow / 1_000_000`. **mock의 단위가 K**라는 가정과 SQL의 단위(추정 raw tokens) 불일치 가능. 단위 통일 필요.

### B-04 (P1, 안전성) `attrs.context_window as number) ?? 4096` — `as number`는 `||` 회피용이 아니어서 `null`만 잡고 `undefined`/문자열 안전성 결여
Supabase 분기. JSONB 컬럼 값이 문자열로 올 경우 산술 NaN. **권장**: `Number(x)` + `Number.isFinite` 가드.

### B-05 (P1, 라우팅 정책) `/compare/a_vs_a` 무한 동일 비교 허용
정렬은 통과하나 CompareTable이 2개 모델 요구. 현재 둘 다 같은 mock 객체 참조로 양쪽 동일 셀이 렌더된다. **권장**: `slugA === slugB` 시 `notFound()` 또는 모델 상세로 redirect.

### B-06 (P1, SEO) compare redirect가 기본 `redirect()` — temp(307). SEO 정합성 위해 301 명시 필요
Next.js `redirect()`는 RSC에서 307 GET. **권장**: `redirect(path, RedirectType.replace)` + middleware에서 301 처리.

### B-07 (P2, 캐시) `okNoCache`가 메서드명과 달리 명시적 `no-store` 헤더가 없음
중간 CDN이 기본 캐시 정책으로 캐싱할 수 있음. **권장**: `Cache-Control: no-store` 명시.

### B-08 (P2, i18n) `localePath` 헬퍼가 페이지마다 인라인 중복 정의
유지보수 위험. `lib/i18n/utils.ts`로 통합 권장.

### B-09 (P0, 테스트 환경) 루트 `vitest.config.ts`의 alias가 `./src` (루트) — `apps/tier-gg/src`와 불일치
실제 테스트 실행 시 `@/...` import 깨짐. **권장**: `apps/tier-gg/vitest.config.ts` 분리 또는 alias 추가.

### B-10 (P1, 검증) `AdminCreateModelSchema.attrs`가 `z.record(z.unknown())` — 임의 키 허용
mock-models의 attrs 스키마(priceInput 등)와 분리되어 검증 누수. **권장**: 별도 attrs 서브스키마.

---

## 7. QA실행자 인계 가이드

### 7.1 디렉토리 구조 제안
```
apps/tier-gg/
├── vitest.config.ts          # ← 신규 (루트와 분리)
├── tests/
│   ├── setup.ts              # jsdom polyfill, intl mock
│   ├── unit/
│   │   ├── components/
│   │   │   ├── Button.test.tsx
│   │   │   ├── Badge.test.tsx
│   │   │   ├── ModelChip.test.tsx
│   │   │   ├── MetricCard.test.tsx
│   │   │   ├── SourceBadge.test.tsx
│   │   │   ├── ScoreBar.test.tsx
│   │   │   ├── CompareTable.test.tsx
│   │   │   ├── SearchInput.test.tsx
│   │   │   └── ThemeToggle.test.tsx
│   │   ├── lib/
│   │   │   ├── mock-adapter.test.ts
│   │   │   ├── wizard.test.ts          # W-01~W-09
│   │   │   ├── schemas.test.ts
│   │   │   └── data-integrity.test.ts  # D-01~D-10
│   ├── integration/
│   │   ├── api/
│   │   │   ├── models.route.test.ts
│   │   │   ├── compare.route.test.ts
│   │   │   ├── find.route.test.ts
│   │   │   ├── leaderboard.route.test.ts
│   │   │   ├── search.route.test.ts
│   │   │   ├── changelog.route.test.ts
│   │   │   └── admin.route.test.ts
│   │   ├── pages/
│   │   │   └── compare-pair.redirect.test.ts  # CP-01~CP-07
│   │   └── i18n/
│   │       └── messages-parity.test.ts        # I-01, I-05
└── docs/qa/
    ├── test-plan.md          # ← 본 문서
    └── bug-report.md         # 실행 후 작성
```

### 7.2 환경 변수
```bash
# tests/setup.ts
process.env.USE_MOCK_DATA = "true";
process.env.ADMIN_EMAIL = "admin@test.local";
```

### 7.3 mocking 가이드
- `next/navigation`의 `redirect`/`notFound`: `vi.mock` 후 throw하는 함수로 대체하여 호출 여부·인자 확인
- `next-intl/server`의 `getTranslations`: 키→키 echo 함수로 mock
- Route Handler 테스트: 라우트 모듈에서 `GET`/`POST`를 직접 import, `new NextRequest(url, {headers, body})`로 호출
- Supabase 호출 케이스: `vi.mock("@/lib/supabase/server")`로 `supabaseAdmin.auth.getUser` / `.from().select().single()` 체인 mock

### 7.4 최우선 실행 순서 (스모크 → 회귀)
1. D-01~D-08 (데이터 무결성) — 30초 안에 회귀 베이스라인 확보
2. I-01 (i18n 키 parity) — 양 언어 페이지 깨짐 사전 차단
3. CP-01~CP-06 (compare redirect) — SEO/공유 URL 핵심
4. W-01~W-07 (wizard 가중치) — 제품 가치 핵심
5. A-01·A-10·A-14·A-15 (API 응답 형식·캐시 헤더)
6. AD-01·AD-04 (admin 인증)
7. C-05·C-07·C-08·C-09 (N/A·경계값·highlight 강조)

### 7.5 자동화 vs 수동
- **자동화 100%**: §3.1~§3.8 전부 (Vitest)
- **수동 스모크 (1회)**: 홈, /models, /models/[slug], /compare/[pair], /find, /leaderboard/price — 다크/라이트 토글 포함, en/ko 양쪽

### 7.6 버그 리포트 형식
`docs/qa/bug-report.md`에 케이스 ID·재현 경로·실제/기대·심각도·스크린샷(가능 시) 기록. 본 문서의 B-01~B-10은 코드 리뷰 발견 사항이므로 별도 섹션으로 옮겨 우선 수정 요청.

---

## 8. 변경 이력
- 2026-05-28 — 초안 작성 (@QA설계자)
