# @QA실행자 핸드오프 — W1~W2 P0 TOP 20 즉시 자동화 큐

> 작성: @QA설계자 (Opus) · 2026-05-14
> 대상: @QA실행자 (Opus)
> 범위: W1~W2 셋업 단계에서 외부 의존성(DB, LLM 실호출) 없이 즉시 자동화 가능한 P0 케이스만 추림

---

## 우선순위 원칙

1. **레드라인 5건 게이트** 먼저 → CI 머지 차단 라인 확보
2. **결정론 비즈니스 로직** (score-engine, paywall, redline, ai-budget) — 외부 의존 0
3. **route handler 계약** — Zod + 에러 코드 응답 형식
4. **시그니처 컴포넌트 통합 회귀**는 W3 이관

---

## TOP 20 케이스 — 즉시 자동화 큐

| 순위 | 케이스 ID | 도구 | 권장 파일 경로 | 비고 |
|---|---|---|---|---|
| 1 | **A-408** | Vitest + MSW Upstash | `tests/redline/ai-budget-105.test.ts` | **CR-1 패치 후** ratio≥1.05 → throw 검증. 패치 미적용 시 RED → 패치 후 GREEN |
| 2 | **A-301** | Vitest + fast-check | `tests/redline/score-determinism.test.ts` | property-based 500회. f(x)=f(x) 비트레벨 |
| 3 | **A-304** | dependency-cruiser (CLI) | `tests/lint/no-llm-in-score-engine.test.ts` | score-engine.ts import 트리에 anthropic/openai/fetch 0건 |
| 4 | **A-101** | Vitest | `tests/redline/redline-fields.test.ts` | BLOCKED_FIELD_NAMES 11종 + 대소문자/공백 변이 |
| 5 | **A-103, A-105** | Vitest | `tests/redline/redline-text-patterns.test.ts` | 한글 8 패턴 + **CR-2 영문 패턴 추가 후** 검증 |
| 6 | **A-106** | Vitest | `tests/redline/api-client-allowlist.test.ts` | `client.ts isBlockedPath` 5종 차단 경로 |
| 7 | **A-001, A-002, A-003, A-004** | Vitest | `tests/redline/age-boundary.test.ts` | calcKoreanAge 4개 경계 케이스 (생일 ±1일) |
| 8 | **A-005, A-012** | Vitest (`vi.useFakeTimers`) | `tests/redline/age-leap-and-kst.test.ts` | 윤년 2/29 + KST 자정 경계 |
| 9 | **A-007, A-008** | Vitest + Next.js NextRequest mock | `tests/integration/age-verify-validation.test.ts` | Zod `.date()` 엄격 검증 |
| 10 | **A-401 ~ A-407** | Vitest + MSW | `tests/unit/ai-budget-tiers.test.ts` | ratio 7구간 모델 결정 — 경계값 다수 |
| 11 | **A-409, A-410, A-411** | Vitest (`vi.useFakeTimers`) | `tests/unit/ai-budget-key-ttl.test.ts` | Redis 키 + TTL + **HI-1 KST 월 경계** 검증 |
| 12 | **B-001** | Vitest + NextRequest mock | `tests/integration/checkin-happy.test.ts` | 4축 정상 입력 → 201 + 5필드 응답 정합 |
| 13 | **B-005, B-006, B-007, B-008, B-009** | Vitest | `tests/integration/checkin-validation.test.ts` | memo/axis 경계값 + 누락 |
| 14 | **B-010, B-011, B-012, B-013** | Vitest | `tests/unit/streak.test.ts` | calculateStreak 4 시나리오 |
| 15 | **B-015 ~ B-019** | Vitest | `tests/unit/paywall-gate.test.ts` | assertCoachChatAccess 5 케이스 |
| 16 | **A-307, A-308, A-309, A-310** | Vitest + fast-check | `tests/unit/score-engine-bounds.test.ts` | 경계값 0/100 + 단조증가 |
| 17 | **A-305, A-306** | Vitest | `tests/unit/score-engine-weights.test.ts` | 가중치 정규화 + clamp |
| 18 | **C-001, C-002, C-003, C-004** | Vitest + MSW Supabase auth | `tests/integration/auth-required.test.ts` | Authorization 헤더 4 케이스 |
| 19 | **E-001, E-002** | Vitest | `tests/unit/score-formula-doc-sync.test.ts` | DEFAULT_WEIGHTS = 0.25 × 4 검증 (score_formula.md 동기화) |
| 20 | **A-107, A-108** | Vitest | `tests/redline/sanitize-ai-response.test.ts` | sanitizeAiResponse 한글 5 패턴 + **CR-2 영문 패턴 추가 후** |

---

## 도구 셋업 (QA실행자 첫 PR)

`package.json` devDependencies 추가:
```json
{
  "vitest": "^1.6.0",
  "@vitest/coverage-v8": "^1.6.0",
  "@testing-library/react": "^15.0.0",
  "@testing-library/jest-dom": "^6.4.0",
  "jsdom": "^24.0.0",
  "msw": "^2.3.0",
  "fast-check": "^3.19.0",
  "dependency-cruiser": "^16.3.0",
  "@playwright/test": "^1.44.0"
}
```

`vitest.config.ts` 권장 구조:
```ts
import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  test: {
    environment: "node",          // 기본은 node, RTL 사용 파일만 환ment: "jsdom" 지정
    globals: true,
    coverage: {
      provider: "v8",
      thresholds: { lines: 60, functions: 70, branches: 50 },
      include: ["src/lib/server/**", "src/lib/shared/**", "src/lib/api/**"],
    },
    setupFiles: ["./tests/setup.ts"],
  },
  resolve: {
    alias: { "@": path.resolve(__dirname, "./src") },
  },
});
```

`tests/setup.ts`:
```ts
import { vi, beforeEach } from "vitest";

// KST 고정 — 테스트 결정론 강제
beforeEach(() => {
  process.env.APP_TIMEZONE = "Asia/Seoul";
  process.env.AI_BUDGET_KRW_MONTHLY = "200";
  process.env.SCORE_FORMULA_VERSION = "v1.0.0";
  process.env.COACH_FREE_TRIAL_DAYS = "3";
});
```

---

## CI 통합 권장

`.github/workflows/qa.yml` 잡 5개:
1. `redline` — `vitest run tests/redline` (실패 시 PR 머지 차단)
2. `unit` — `vitest run tests/unit --coverage`
3. `integration` — `vitest run tests/integration`
4. `lint:no-llm` — `dependency-cruiser src/lib/server/score-engine.ts --output-type err --validate .dependency-cruiser.cjs`
5. `type` — `tsc --noEmit`

`redline` 잡은 **단일 실패 시 머지 차단 라벨 자동 적용**.

---

## 미해결 / 실행자 판단 필요

- **A-013** (PIPA birth_year 1년 오차) — 자동화 불가. 사장 정책 결정 필요 → 케이스 자동화 보류, `docs/qa/policy-questions.md`에 등재 권고
- **A-105** 영문 우회 — CR-2 패치 의존. **CR-2 PR과 A-105 테스트 PR을 같은 브랜치에 묶어 제출** 권고
- **A-408** ratio=1.05 → CR-1 패치 의존. 동일하게 패치+테스트 동시 PR
- **B-014** KST 자정 경계 스트릭 — `vi.useFakeTimers` + `setSystemTime(KST 2026-05-15 00:00:01)` 필수. timezone mocking 까다로움 — 실행자 노트
- **A-111** SSE 청크 분할 — 실제 LLM 호출은 W7~8 → 현재는 `sanitizeAiResponse` 단위 테스트만 가능. 누적 버퍼 로직 추가(HI-2)까지 보류

---

## 실행 순서 권장

```
Day 1: 도구 셋업 PR (Vitest + Playwright + MSW + fast-check)
Day 2: TOP 1~5 (레드라인 게이트 5개) + CI 잡 활성
Day 3: TOP 6~12 (age + checkin happy + validation)
Day 4: TOP 13~17 (streak + paywall + score bounds)
Day 5: TOP 18~20 (auth + formula sync + sanitize) → W3 진입 게이트 통과
```

---

## 핸드오프 완료 후 보고 양식

@QA실행자는 케이스별로 다음을 보고:
- ✅ PASS / ❌ FAIL / ⏸ BLOCKED (의존 패치 미적용)
- 발견된 신규 버그 (있으면 `docs/qa/bug-report.md`)
- 커버리지 수치 (lines/functions/branches)
- 다음 스프린트 추가 권고
