# Tier.gg — QA 버그 리포트

- 작성자: @QA실행자 (Opus)
- 작성일: 2026-05-28
- 대상: `apps/tier-gg/` MVP
- 테스트 결과: **28 passed / 0 failed / 0 skipped** (7 files)

---

## 1. 테스트 환경

- Runner: Vitest 2.1.9 (`apps/tier-gg/vitest.config.ts`)
- 환경: node (API/repo/i18n/data) + happy-dom (컴포넌트)
- alias: `@` → `apps/tier-gg/src` (루트 `vitest.config.ts`와 분리 — **B-09 수정**)
- 환경변수: `USE_MOCK_DATA=true`, `ADMIN_EMAIL=admin@test.local`
- 추가 devDeps: `@testing-library/react`, `@testing-library/dom`, `happy-dom`, `jsdom`
  - `jsdom` 28.x가 `@asamuzakjp/css-color`의 ESM/CJS 호환 이슈로 실패 → `happy-dom`으로 대체

---

## 2. 수정된 버그

### B-01 (P0, 보안/안정성) — `requireAdmin` 반환 분기 판별 불안정
- 위치: `src/app/api/admin/models/route.ts:33`, `src/app/api/admin/models/[id]/route.ts:39`
- 원인: `"status" in authResult`로 NextResponse 여부를 판별. 성공 반환값 타입에 `status` 필드가 추가되면 silent break.
- 수정: `authResult instanceof NextResponse`로 변경.
- 검증: `tests/api/admin-auth.spec.ts` — AD-01/03/04 통과.

### B-02 (P0, 안정성) — mock 모드에서 admin 라우트가 supabaseAdmin 직호출
- 위치: `src/app/api/admin/models/route.ts`, `src/app/api/admin/models/[id]/route.ts`
- 원인: `isMockMode()` 가드 없이 `supabaseAdmin.from(...)` 호출 → mock 환경에서 dummy URL로 네트워크 에러 → 500.
- 수정: 라우트 진입 시 `isMockMode()` true면 `503 SERVICE_UNAVAILABLE` 반환.
- 재현 절차 (수정 전): `USE_MOCK_DATA=true` 상태에서 `POST /api/admin/models` 호출 → fetch failed → 500.
- 검증: 코드 경로상 mock 모드 즉시 503 분기. 통합 테스트는 후속 라운드.

### B-03 (P1, 일관성) — wizard mock vs Supabase 분기 contextWindow 단위 불일치
- 위치: `src/lib/api/wizard.ts:94`, `:206`
- 원인: mock은 `cw / 1000` (cw가 K tokens 단위), Supabase는 `contextWindow / 1_000_000` (raw tokens). 둘 다 1M 기준이지만 단위 표기가 혼동 유발.
- 수정: 주석으로 단위 명시 + `Number()` + `Number.isFinite` 가드 추가 (B-04 부분 해결 포함).
- 검증: `tests/api/wizard.spec.ts` W-04 (총점 = 가중치 합) 통과.

### B-05 (P1, 라우팅 정책) — `/compare/a_vs_a` 동일 slug 비교 허용
- 위치: `src/app/[locale]/compare/[pair]/page.tsx:128`
- 원인: 알파벳 정렬은 통과 → CompareTable에 같은 모델 2회 렌더.
- 수정: `slugA === slugB`일 때 모델 상세(`/models/{slug}` 또는 `/{locale}/models/{slug}`)로 redirect.
- 검증: `tests/api/compare-redirect.spec.ts` CP-03 — `gpt-4o_vs_gpt-4o` → `/models/gpt-4o` PASS.

### B-09 (P0, 테스트 환경) — 루트 `vitest.config.ts`의 alias 불일치
- 위치: `apps/tier-gg/vitest.config.ts` (신규)
- 원인: 루트 config는 `@` → `./src` (루트 기준)이라 `apps/tier-gg/`의 `@/...` import 깨짐.
- 수정: `apps/tier-gg/vitest.config.ts` 신규 생성. `@` → `apps/tier-gg/src`, `environmentMatchGlobs`로 컴포넌트만 happy-dom, 나머지는 node. `esbuild.jsx: "automatic"`.
- 검증: 7개 테스트 파일 모두 alias 해석 OK.

---

## 3. 미수정 잔여 이슈

- **B-04 (P1)**: Supabase 분기 `attrs.price_input_per_1m as number` 단언 잔존. context_window 쪽만 `Number()` 가드 추가. 후속 라운드에서 price 필드도 동일 처리 권장.
- **B-06 (P1, SEO)**: compare redirect가 307 (기본). 301 명시 권장 — middleware 도입 시 처리.
- **B-07 (P2)**: `okNoCache`가 `Cache-Control: no-store`를 명시하지 않음. POST 응답이라 일반적으로 캐시되지 않으나 명시 권장.
- **B-08 (P2)**: `localePath` 헬퍼 페이지별 인라인 중복. `lib/i18n/utils.ts`로 통합 권장.
- **B-10 (P1)**: `AdminCreateModelSchema.attrs`가 `z.record(z.unknown())`. attrs 서브스키마 분리 권장.

---

## 4. 테스트 결과 상세

| 파일 | 케이스 | 결과 |
|---|---|---|
| `tests/data/mock-models.spec.ts` | D-01 ~ D-08 (8) | 8 passed |
| `tests/i18n/messages-parity.spec.ts` | I-01 (1) | 1 passed |
| `tests/api/compare-redirect.spec.ts` | CP-01, CP-03, CP-04 (3) | 3 passed |
| `tests/api/wizard.spec.ts` | W-01, W-02, W-04, W-05 + Top3 + sanity (6) | 6 passed |
| `tests/api/response-shape.spec.ts` | A-10, A-11, A-15 (3) | 3 passed |
| `tests/api/admin-auth.spec.ts` | AD-01, AD-03, AD-04 (3) | 3 passed |
| `tests/components/ModelChip.spec.tsx` | provider 색상/initial/aria-label (4) | 4 passed |
| **합계** | **28** | **28 passed / 0 failed / 0 skipped** |

실행 시간: ~683ms

---

## 5. Quality Gate 판정 (test-plan §5)

| 기준 | 상태 |
|---|---|
| 본 라운드 P0 케이스 100% Pass | PASS |
| 데이터 무결성 D-01 ~ D-08 | PASS |
| i18n 키 누락 0 (I-01) | PASS |
| compare redirect (CP-01·CP-03) + 동일 slug 처리 | PASS |
| POST /find weights 노출 (W-05/A-10) + 캐시 헤더 없음 | PASS |
| 관리자 인증 (AD-01·AD-04) | PASS |
| `tsc --noEmit` / `next build` | 본 라운드 미실행 — 후속 |
| Lighthouse / 수동 스모크 | 본 라운드 미실행 — 후속 |

**판정**: 본 자동화 라운드에서 검증한 모든 P0 케이스 PASS. `tsc`·`next build`·수동 스모크는 별도 라운드 필요. **자동화 게이트 통과**.

---

## 6. 변경 이력
- 2026-05-28 — 초안 작성, P0/P1 버그 5건 수정, 28 테스트 작성 및 통과 (@QA실행자)
