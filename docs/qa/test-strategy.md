# 오름(Oreum) 테스트 전략서 — W1~W2

> 작성: @QA설계자 (Opus) · 2026-05-14
> 범위: W1~W2 셋업 골격 (API 11라우트 스켈레톤 + lib/server 결정론 모듈 + 페이지 mock 폴백) — 단위·계약 중심
> 다음 갱신: W3 리네임 + `@supabase/ssr` 도입 후

---

## 1. 결론 한 줄

W1~W2 골격은 **결정론 비즈니스 로직(score-engine, redline, paywall, ai-budget, errors)이 외부 의존성 없이 99% 단위 테스트 가능**한 형태로 분리되어 있다. 따라서 **단위 테스트 70% / 계약(스키마·핸들러) 25% / E2E 5%** 비율로 첫 스프린트를 시작한다. **레드라인 5건은 즉시 자동화하여 PR 머지 차단 게이트로 격상**한다.

---

## 2. 테스트 피라미드 (W1~W2)

```
        ┌──────────────┐
        │  E2E  5%     │  Playwright — 핵심 사용자 시나리오 2개 (가입→체크인, 코치챗 게이트)
        ├──────────────┤
        │ Integration  │  Vitest + MSW + Supabase Local — API Route 핸들러 11개 계약
        │   25%        │  (auth → redline → rate-limit → handler 통합 동작 검증)
        ├──────────────┤
        │ Unit         │  Vitest — score-engine / redline / paywall / ai-budget / errors
        │   70%        │  결정론 모듈 — Pure function. 80% 라인 커버리지 목표
        └──────────────┘
```

### W3 이후 비율 조정 (TODO)
- 코어 루프 완성 + DB 통합 후 Integration 비중 → 35%
- 페르소나·결제·SSE 활성화 후 E2E → 10%

---

## 3. 테스트 도구 매트릭스

| 레벨 | 도구 | 용도 | 도입 시점 |
|---|---|---|---|
| Unit | **Vitest** (+ `@vitest/coverage-v8`) | 순수 함수, lib/server/* | W1~W2 즉시 |
| Unit (React) | **@testing-library/react** + jsdom | 컴포넌트 5종 시그니처 | W3 시그니처 통합 후 |
| Contract | **Zod schema parse** | `src/lib/shared/schemas.ts` 입출력 정합 | W1~W2 즉시 |
| API Route | **Vitest + Next.js NextRequest mock** | route.ts 핸들러 직접 호출 | W1~W2 즉시 |
| HTTP Mock | **MSW (Mock Service Worker)** | Supabase Auth / Upstash / Anthropic / OpenAI 외부 의존 | W1~W2 즉시 |
| DB | **Supabase Local (Docker)** | RLS 정책 실측 검증 | W3 (Supabase 미설치 상태에선 RLS 테스트 불가) |
| E2E | **Playwright** + 모바일 viewport(375×812) | 사용자 시나리오 + 접근성 | W3 (체크인 오버레이 통합 후) |
| 시각 | **Playwright screenshot diff** | 산 능선 시그니처 화면 | W5+ |
| 성능 | **Lighthouse CI** (mobile) | LCP/CLS 예산 | W3+ |
| 부하 | **k6** | 코치챗 SSE + AI 비용 카운터 동시성 | W11 |

> 백엔드팀장이 "테스트 도구 없음"이라 보고했으므로, **`vitest` `@vitest/coverage-v8` `@testing-library/react` `msw` `playwright` 5개 패키지 W3 추가 권고** (개발 의존성).

---

## 4. 테스트 환경 전략 (Mock vs Local vs Staging)

| 환경 | 대상 | 비용/속도 | 사용 시점 |
|---|---|---|---|
| **Mock (MSW)** | Supabase Auth / Upstash Redis / Anthropic / OpenAI / 토스 | 0원, 0.1s | Unit + Contract — 기본값 |
| **Supabase Local** | Postgres + RLS + Auth 실측 | $0, 5~10s | Integration RLS 검증 (W3+) |
| **Staging Supabase Project** | 클라우드 통합 | $25/mo, 1~5s | E2E + cron 잡 검증 (W6+) |
| **Production** | - | - | 테스트 금지. 출시 후 smoke만 |

**원칙**: 가능한 모든 케이스는 Mock 환경에서 돌린다. RLS·cron·익명화 잡 3가지만 Supabase Local로 떨어뜨린다.

---

## 5. 레드라인 강제 테스트 (PR 머지 차단 게이트) ★

> 위반 = 배포 차단. CI에서 fail 시 머지 불가. **다른 어떤 테스트보다 우선순위 P0-CRITICAL**.

| # | 레드라인 | 강제 테스트 (Quality Gate) | 자동화 도구 | 파일 권장 경로 |
|---|---|---|---|---|
| **RL-1** | 만 16세 미만 가입 차단 | (a) `calcKoreanAge` 경계값 30+ 케이스 / (b) `POST /api/onboarding/age-verify` 만15세 11개월 → 403 `E_AGE_BLOCKED` / (c) 차단 플래그 false인데 `requireAuth` 통과 후 `assertNotAgeBlocked` 우회 시도 → reject | Vitest + Route handler mock | `tests/unit/age.test.ts`, `tests/integration/onboarding.test.ts` |
| **RL-2** | 외모/타인비교 reject | (a) `BLOCKED_FIELD_NAMES` 11개 필드 + `BLOCKED_TEXT_PATTERNS` 8개 정규식 100% 매칭 / (b) `client.ts ALLOWED_PATH_PATTERNS` 정규식이 `leaderboard`·`ranking`·`compare`·`peer`·`average-all` 5종 차단 / (c) `POST /api/coach/chat` 본문에 `compare_others` 필드 → 422 / (d) `sanitizeAiResponse` 응답 5개 패턴 치환 | Vitest property-based | `tests/unit/redline.test.ts`, `tests/unit/api-client.test.ts` |
| **RL-3** | 90일 미접속 익명화 잡 | (a) `oreum-anonymize-inactive-users` cron이 `last_active_at < NOW()-90d` 행 PII 필드 alias 치환 / (b) 89일 사용자는 무영향 / (c) 익명화 후 `display_name`·`birth_year`·`email` 모두 null/anon 치환 | Supabase Local + Vitest | `tests/integration/cron-anonymize.test.ts` (W3) |
| **RL-4** | 점수 산식 결정론 | (a) 동일 입력 1000회 반복 → 동일 출력 비트레벨 / (b) `SCORE_VERSION = "v1.0.0"` snapshot에 항상 기록 / (c) score-engine.ts 내 import 트리에 `anthropic`·`openai`·`fetch` 전무 (정적 분석) / (d) `formula_version` 변경 시 과거 snapshot 보존 (W3 DB) | Vitest + dependency-cruiser | `tests/unit/score-engine.test.ts`, `tests/lint/no-llm-in-score.test.ts` |
| **RL-5** | AI 비용 ₩200 캡 + 105% 차단 | (a) ratio < 0.5 → PRIMARY / 0.5~0.9 → FB1 / 0.9~1.0 → FB2 / ≥1.0 → FB2 유지 (UX 정책) / (b) `recordAiUsage` 후 누적 ≥ ₩210 (105%) 시 코치챗 비활성 — **현재 코드에 105% 차단 미구현 = Critical Issue** / (c) Redis TTL 32일 정확 / (d) 환율 변동 시 가격 계산 정합 | Vitest + MSW Upstash mock | `tests/unit/ai-budget.test.ts`, `tests/integration/coach-chat-quota.test.ts` |

### 5-1. 레드라인 게이트 CI 흐름

```
PR 푸시
  ↓
[stage 1] lint + tsc --strict (any 0건 강제)
  ↓
[stage 2] unit:redline    ← RL-1~5 전용 스위트 (실패 시 즉시 머지 차단)
  ↓
[stage 3] unit:all        ← 80% coverage
  ↓
[stage 4] contract:zod    ← schemas.ts 입출력 정합
  ↓
[stage 5] integration     ← route handler 11개
  ↓
[stage 6] e2e:smoke       ← 가입→체크인 1개
  ↓
머지 가능
```

---

## 6. 품질 기준 (Quality Gate)

| 지표 | W3 진입 게이트 | 베타(W8) | 출시(W12) |
|---|---|---|---|
| 단위 테스트 라인 커버리지 | 60% | 75% | **80%** |
| 핵심 루프(체크인→점수→미션→delta) 커버리지 | **100%** | 100% | 100% |
| 레드라인 5건 자동화 | **5/5** | 5/5 | 5/5 |
| Critical Bug | 0 | 0 | **0** |
| High Bug | ≤ 3 | ≤ 1 | 0 |
| TS strict 위반 | 0 | 0 | 0 |
| `any` 사용 | 0 | 0 | 0 |
| 모바일 375px LCP | - | < 3.0s | **< 2.5s** |
| CLS | - | < 0.15 | **< 0.1** |
| API p95 (`/api/checkin`) | - | < 500ms | < 300ms |
| 접근성 (axe-core critical) | - | 0 | 0 |

> **Critical Bug 0건**이 출시 절대 조건. High 1건 이상 시 사장 보고 후 출시 연기 권한.

---

## 7. CI 게이트 (GitHub Actions 권장 구성)

```yaml
on: [pull_request, push]
jobs:
  redline_gate:     # 1순위, fail 시 즉시 차단
    - npm run test:redline  # tests/redline/**
  type_gate:
    - tsc --noEmit
    - eslint . --max-warnings 0
  unit_gate:
    - vitest run --coverage --reporter=verbose
    - 커버리지 threshold: lines 60% / functions 70% / branches 50% (W3 진입 기준)
  contract_gate:
    - vitest run tests/contract
  integration_gate:
    - supabase start
    - vitest run tests/integration
  e2e_gate:         # 머지 차단 X, fail 시 라벨만
    - playwright test --project=mobile-chrome
```

PR 머지는 redline / type / unit / contract / integration 5개가 모두 green 필수. e2e는 fail 허용(라벨링).

---

## 8. 테스트 데이터 전략

- **Fixture**: `tests/fixtures/users.json` (Free / Pro / 만 15세 11개월 / 90일 미접속 / AI 80% / 105%) 6종
- **Faker**: `@faker-js/faker` 사용 X — **결정론 위반**. 시드 고정 또는 fixture 사용
- **Property-based**: `fast-check` 라이브러리로 score-engine 결정론 검증 (랜덤 4축 1000회 → 동일 출력)
- **Time**: `vi.useFakeTimers()` + KST 자정 경계 테스트 강제

---

## 9. 비기능 테스트

| 카테고리 | W3~W6 | W7~W12 |
|---|---|---|
| 성능 | route handler p95 측정 | Lighthouse CI + k6 부하 |
| 보안 | RLS local 검증 + service_role 키 노출 grep | OWASP ZAP baseline |
| 접근성 | axe-core unit | Playwright + axe + 키보드 시퀀스 |
| i18n | - | 한글 가독성(Pretendard 1.6 행간) 시각 회귀 |
| 다크모드 | surface 토큰 분리 검증 | v1.5 (defer) |

---

## 10. 잔여 리스크 (사장 보고 사항)

1. **백엔드 ai-budget.ts에 105% 하드 차단 미구현** — 레드라인 5번 위반. W3 첫 작업으로 패치 + 회귀 테스트 등록 필수
2. **`@supabase/ssr` 미설치** — Auth 통합 테스트 W3까지 불가. RLS 검증은 supabase-js 단일 클라이언트로 임시 대체
3. **시그니처 컴포넌트 4종 미통합** — 페이지 mock 폴백 코드가 그대로 출시되면 디자인 스펙 위반. W3 통합 일정 강제 + 통합 후 E2E 회귀 필수
4. **API↔DB 컬럼 불일치 14건+** — W3 일괄 리네임. 리네임 전 작성된 단위 테스트는 Zod 스키마 기반(API 측)으로 유지 가능. 통합 테스트는 W3 이후 작성
5. **`@anthropic-ai/sdk` / `openai` 패키지 import 존재 + 의존성표 미명시** — frontend-final.md §2 의존성표 누락. 패키지 설치 여부 확인 필요

---

## 11. 다음 단계

- [ ] 사장 보고 후 Vitest + MSW + Playwright 5개 패키지 W3 첫 작업으로 설치 승인
- [ ] `tests/` 디렉토리 구조 합의: `tests/{unit,contract,integration,e2e,redline,fixtures}/`
- [ ] CI Gate YAML 초안 PR (별도)
- [ ] @QA실행자에게 P0 TOP 20 케이스 핸드오프 (`docs/qa/handoff.md`)
