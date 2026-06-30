# 오름(Oreum) 코드 리뷰 — W1~W2 셋업

> 작성: @QA설계자 (Opus) · 2026-05-14
> 검토 대상: `src/lib/server/*` (8파일) + `src/lib/shared/schemas.ts` + `src/lib/api/client.ts` + `src/app/api/**/route.ts` 11라우트 + `api/db/migrations/*` 4파일
> 범위: 보안, 타입 안전성, 레드라인 강제도, API↔DB 정합

---

## Executive Summary

| 항목 | 점수 | 비고 |
|---|---|---|
| 레드라인 강제 (5건) | **3.5 / 5** | RL-5 (105% 차단) 미구현 / RL-2 영문 우회 가능 |
| TypeScript strict | 5 / 5 | `any` 0건 확인. 프론트팀장 보고 일치 |
| 보안 (RLS, 키 노출) | 3 / 5 | service_role 키 일관 사용. 단 에러 메시지에 env 이름 노출 |
| API↔DB 정합 | 2 / 5 | 14건+ 불일치. W3 일괄 리네임 예정 (백엔드팀장 보고 일치) |
| 에러 핸들링 | 4 / 5 | `toErrorResponse` 통일 우수. SSE 내부 에러 일부 누락 |
| 시그니처 통합 | 2 / 5 | 컴포넌트 4종 미통합 + 페이지 mock 폴백 |

---

## 1. Critical Issues (출시 차단) — TOP 5

### CR-1. **RL-5 AI 비용 105% 하드 차단 미구현** 🔴

**파일**: `src/lib/server/ai-budget.ts:96-108`
```ts
if (ratio < 0.5) return PRIMARY_MODEL;
if (ratio < 0.9) return FALLBACK_MODEL_1;
if (ratio < 1.0) return FALLBACK_MODEL_2;
// 100% 초과: 에러를 throw하지 않고 가장 저렴한 모델 유지 (UX 우선)
return FALLBACK_MODEL_2;
```

- 프로젝트 방향서 §6 레드라인 5번 + backend-final.md §6 AI 비용 가드 표는 **"ratio ≥ 1.05 → 코치챗 비활성 (E_AI_QUOTA_EXCEEDED, 이중 안전선)"**을 명시
- 현재 코드는 105% 이상에서도 Haiku 호출 유지 → **무한 비용 폭주 가능**
- 영향도: 악의적 사용자가 분당 5회 × 한 달이면 Haiku로도 수만 원 발생 가능
- **수정 권고**: ratio ≥ 1.05 시 `throw Errors.aiQuotaExceeded(usedKrw)`. UX 폴백은 1.0~1.05 사이에서만 유지.

### CR-2. **레드라인 영문 키워드 우회 가능** 🔴

**파일**: `src/lib/server/redline.ts:30-39, 78-84`

- `BLOCKED_TEXT_PATTERNS` / `RESPONSE_BLOCKED_PATTERNS` 모두 **한글 정규식만**
- 코치챗 사용자 메시지 `"compare with others"` `"leaderboard rank"` `"average score of everyone"` → 통과
- LLM 응답에 `"top 10%"` `"better than average user"` 포함 → `sanitizeAiResponse` 통과
- 영향도: 레드라인 R1·R2 우회. 사장 결정 정책 위반
- **수정 권고**: 영문 패턴 5+ 종 추가 (`/compare\s+(with|to)\s+other/i`, `/leaderboard/i`, `/average\s+(of|score)/i`, `/top\s+\d+\s*%/i`, `/rank(ing)?/i`)

### CR-3. **service_role 키 환경변수 이름이 에러 메시지에 노출** 🟠

**파일**: `src/lib/server/auth.ts:18-20`, `rate-limit.ts:22-24`, `ai-budget.ts:69-71`
```ts
throw new Error("SUPABASE_URL 또는 SUPABASE_SERVICE_ROLE_KEY 환경변수가 없습니다");
```

- 에러가 `toErrorResponse` 경유 시 메시지가 클라이언트에 노출되지는 않음 (catch에서 일반화)
- 그러나 **개발자 실수로 throw가 직접 SSE 청크 / 로그 / Sentry payload에 들어가면 정보 노출**
- coach/chat route SSE catch 블록에서 `err.message`를 그대로 클라이언트 chunk로 전송 (`route.ts:140`):
  ```ts
  sendChunk({ type: "error", code: "E_INTERNAL", message: err instanceof Error ? err.message : "알 수 없는 오류" });
  ```
- **수정 권고**: 환경변수 이름을 메시지에 포함하지 않거나, SSE error chunk message를 상수 문자열로 고정

### CR-4. **`requireAuth` 내부 profile 하드코드 — 실제 DB 미연결** 🔴

**파일**: `src/lib/server/auth.ts:75-79`
```ts
const profile = {
  is_age_blocked: false,        // 항상 false
  subscription_tier: "free",    // 항상 free
  coach_free_until: null,       // 항상 null
};
```

- W1~W2 의도된 stub이나 **`@supabase/ssr` 미설치 + W3 DB 연결 전까지 모든 사용자가 `isAgeBlocked=false`** → RL-1 우회 가능
- `assertNotAgeBlocked(user)`는 호출되나 `user.isAgeBlocked`가 영원히 false
- 영향: A-011 케이스 (차단 플래그 true 사용자 우회) 검증 불가
- **수정 권고**: W3 첫 작업으로 `users` 테이블 JOIN 조회 활성. 그 전까지는 `setAgeBlockedFlag`가 메모리 캐시라도 유지하도록 임시 처리

### CR-5. **시그니처 컴포넌트 4종 미통합 + 페이지 인라인 mock — 출시 위험 패턴** 🟠

**파일**: `src/components/ui/{score-display, mountain-chart, streak-indicator, checkin-slider}.tsx`
**페이지**: `src/app/(app)/{home, graph}/page.tsx` 자체 `ScoreCard` / `AxisMiniBars` / `MountainLineChart` 스텁 사용

- frontend-final.md §11 "W1~W2 스코프 내 의도된 분리"라 명시되어 있으나, **W3 통합을 잊으면 stub UI가 그대로 출시**
- 디자인 스펙 (산 능선 메타포 + 카운트업 600ms + grace period UI) 위반 위험
- 영향: 출시 시 디자인 레드라인 R1~R5 시각 검수 실패 가능
- **수정 권고**: W3 첫 PR에 "ScoreCard → ScoreDisplay 교체" 강제 + 회귀 E2E 등록. CI에 grep 가드 `tests/lint/no-mock-fallback.test.ts` 추가하여 페이지 코드에 `ScoreCard` 잔존 시 fail

---

## 2. High Issues (베타 차단)

### HI-1. **`recordAiUsage` 월 키 UTC 기준 — KST 자정 경계 9시간 오차**

**파일**: `src/lib/server/ai-budget.ts:57-60`
```ts
function currentYearMonth(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}
```

- KST 5/31 23:00 = UTC 5/31 14:00 → key=2026-05
- KST 6/1 00:30 = UTC 5/31 15:30 → key=**2026-05** (의도는 2026-06)
- 결과: 매월 마지막 9시간 동안 발생한 비용이 새 달로 안 넘어가 → 한도 초과 + 신규 달 초기화 안됨
- **수정 권고**: `APP_TIMEZONE=Asia/Seoul` 적용 (`Intl.DateTimeFormat("ko-KR", {timeZone:"Asia/Seoul"})`)

### HI-2. **레드라인 SSE 청크 분할 우회 가능**

**파일**: `src/app/api/coach/chat/route.ts` (실제 LLM 호출 W7~8 활성 시)
- `sanitizeAiResponse(event.delta.text)`는 **청크 단위로만 검사**
- LLM이 `"다"` `"른 "` `"사람"` 3청크로 분할 송신 시 정규식 미스
- **수정 권고**: 누적 버퍼 sanitize + sliding window (마지막 100자 보존)

### HI-3. **`assertNoRedlineFields`는 top-level 키만 검사 — 중첩 우회**

**파일**: `src/lib/server/redline.ts:49-56`
- `{ history: [{ role:"user", content:"...", appearance:true }] }` 형태로 중첩 시 `appearance` 키 미검출
- **수정 권고**: deep traversal (`for-of with stack`) 또는 zod transform에서 정의되지 않은 키 strict reject

### HI-4. **Zod `.strict()` 미적용 — 추가 필드 허용**

**파일**: `src/lib/shared/schemas.ts` 전 스키마
- 모든 `z.object({...})`가 default mode (extra keys ignored)
- 클라이언트가 `{ health, learning, relation, achievement, leaderboard:true }` 전송 시 — runRedlineGuard에서는 잡히나 **`.strict()` 적용하면 Zod 단에서도 reject**되어 방어 깊이 증가
- **수정 권고**: 모든 Request 스키마에 `.strict()` 적용

### HI-5. **`calculateStreak` graceUntil 계산 — 끊긴 시점 무관 항상 "오늘 자정"**

**파일**: `src/lib/server/score-engine.ts:208-210`
```ts
const graceUntil = new Date(now);
graceUntil.setHours(23, 59, 59, 999);
```
- "끊긴 날 다음날 자정까지" 코멘트와 불일치 — 실제는 "지금 호출된 날의 자정"
- 사용자가 끊긴 후 며칠 뒤 체크인하면 graceUntil이 의미 없음
- **수정 권고**: 비즈니스 룰 재정의 — grace는 `last_checkin_date + 1d 자정 KST`까지

### HI-6. **체크인 race condition — 동시 2회 요청**

**파일**: `src/app/api/checkin/route.ts:34-39` (현재 stub)
- W3 DB 통합 시 `findFirst → exists면 throw → INSERT` 패턴이면 race 발생 가능
- **수정 권고**: PostgreSQL `INSERT ... ON CONFLICT (user_id, date) DO NOTHING RETURNING *` 또는 UNIQUE 제약 위반 catch 후 409 변환

### HI-7. **rate-limit 모듈에서 한 번 import한 redis 싱글톤이 ai-budget에서 별도 import → 2개 Redis 클라이언트**

**파일**: `rate-limit.ts:14-28`, `ai-budget.ts:66-73`
- 각 파일이 자체 `getRedis()` 구현 → 같은 ENV로 2개 인스턴스 생성
- 영향: 메모리 +HTTP 풀 중복. 큰 문제 아니나 정합성 측면
- **수정 권고**: `src/lib/server/redis.ts` 공통 모듈 추출

### HI-8. **`assertNotAgeBlocked` age 인자 항상 0**

**파일**: `src/lib/server/auth.ts:96`
```ts
throw Errors.ageBlocked(0); // 정확한 age는 users 테이블에서 계산
```
- 에러 details에 age=0 노출 → 프론트 UX 메시지 부정확
- **수정 권고**: AuthUser에 `age: number` 추가 또는 birth_year로 런타임 계산

---

## 3. Medium / API↔DB 불일치 (백엔드 §11 검증)

> 백엔드팀장 보고 14건+에 대해 QA 측 재검증. **모두 확인됨 + 1건 추가 발견**.

| # | API/Zod 필드 | DB 컬럼 | 백엔드 보고 | QA 확인 | 추가 발견 |
|---|---|---|---|---|---|
| 1 | `db.checkins` | `daily_checkin` | ✅ | route.ts 36 코멘트 잔존 |
| 2 | `db.scoreSnapshots` | `score_snapshot` | ✅ | route.ts 52 코멘트 |
| 3 | `db.user_missions / missions` | `mission` | ✅ | route.ts 65 코멘트 |
| 4 | `AuthUser.subscriptionTier` | `subscription.plan` | ✅ | auth.ts 37 |
| 5 | `AuthUser.coachFreeUntil` | `subscription.trial_ends_at` | ✅ | auth.ts 39 |
| 6 | `AuthUser.isAgeBlocked` | birth_year 런타임 계산 | ✅ | 컬럼 없음 — helper 필요 |
| 7 | `MeResponse.nickname` | `users.display_name` | ✅ | schemas.ts 252 |
| 8 | `MeResponse.northStarStatement` | `users.north_star_statement` | ✅ | snake↔camel |
| 9 | `MeResponse.subscription.expiresAt` | `current_period_end` | ✅ | schemas.ts 258 |
| 10 | `CheckinRequest.memo` | `daily_checkin.note` | ✅ | schemas.ts 88 |
| 11 | `MissionSchema.axis / difficulty` | mission 테이블에 없음 | ✅ | DB 마이그레이션 005 필요 |
| 12 | `GoalRequest.title` | `goal.statement` | ✅ | schemas.ts 198 |
| 13 | `GoalRequest.targetDate` | `goal.end_date` (Generated) | ✅ | 고정 90d, 무시 처리 |
| 14 | `AgeVerifyRequest.birthDate` (full) | `users.birth_year` (year only) | ✅ | PIPA — A-013 케이스로 1년 오차 위험 |
| **15 추가** | `CheckinResponse.score.ts` (datetime) | `score_snapshot.date` (date only) | - | **timestamp ↔ date 타입 불일치. 응답은 datetime인데 DB는 date** |

W3 일괄 리네임 시 위 15건 + Zod `.strict()` 적용 동시 권고.

---

## 4. Low / 코드 품질

| ID | 위치 | 이슈 |
|---|---|---|
| LO-1 | `redline.ts:50` | `key.toLowerCase().replace(/[-\s]/g, "_")` — 정규식 매번 컴파일. 상수화 권고 |
| LO-2 | `score-engine.ts:184` | `9 * 60 * 60 * 1000` 매직 넘버. `KST_OFFSET_MS` 상수 |
| LO-3 | `errors.ts:132` | `crypto.randomUUID()` Node 19+ / Edge 호환 확인 필요 |
| LO-4 | `client.ts:5` | `useAuthStore.getState()` 클라전용 함수가 서버 측 import 시 SSR 에러 가능 — 서버용 별도 클라이언트 권고 (W3 `@supabase/ssr` 통합 시) |
| LO-5 | `checkin/route.ts:24` | `await req.json() as Record<string, unknown>` 타입 단언. Zod 검증 전 단언은 위험 — `unknown`으로 받아 검증 후 사용 |
| LO-6 | 전반 | 모든 라우트에 try/catch + `toErrorResponse` 보일러플레이트 반복. `withErrorHandling(handler)` 고차함수 권고 |
| LO-7 | `ai-budget.ts:98` | `parseInt(... ?? String(...))` 패턴 — `Number()` 또는 `parseInt(x, 10)` radix 명시 |
| LO-8 | `paywall.ts:42-44` | `setHours(23,59,59,999)`가 로컬 타임존. 서버 UTC 환경에선 의도 다름. KST 명시 필요 |

---

## 5. 의존성 / 설정 이슈

- **`@supabase/ssr` 미설치** (frontend-final.md §2 확인) — RSC 세션 공유 불가. W3 첫 작업 필수
- **`@anthropic-ai/sdk` / `openai` import 존재** (`coach/chat/route.ts:8-9`) — `package.json` 의존성 확인 필요. 프론트팀장 보고서 §2 의존성 표에 미명시 → 설치 누락 의심
- **테스트 도구 0건** — Vitest / RTL / MSW / Playwright 5종 W3 첫 작업으로 추가 필요
- `.env.example`에 `SCORE_FORMULA_VERSION` `COACH_FREE_TRIAL_DAYS` `APP_TIMEZONE` 추가 완료 (백엔드 보고 §11-4) — `AI_BUDGET_KRW_MONTHLY` 누락 확인 필요

---

## 6. 보안 핫스팟 체크리스트

| 항목 | 상태 | 비고 |
|---|---|---|
| RLS 전 테이블 enable | ✅ | `002_rls_policies.sql` 패턴 우수 |
| service_role 키 클라이언트 노출 | ✅ | 서버 전용 `getSupabaseAdmin()` |
| JWT 검증 모든 라우트 | ✅ | `requireAuth` 11라우트 모두 호출 (health 제외) |
| CSRF / SameSite | ⚠️ | `@supabase/ssr` 도입 시 쿠키 설정 검증 필요 |
| Rate Limit 모든 라우트 | ✅ | `checkGeneralRateLimit` 11라우트 |
| Input Sanitization | ⚠️ | Zod + redline guard는 있으나 `memo` 자유 텍스트 XSS 검증 X — DB INSERT 시 escape, 출력 시 React 자동 escape 가정 |
| SQL Injection | ✅ | Supabase 클라이언트 prepared. 단 raw SQL 추가 시 주의 |
| 로그에 PII | ⚠️ | `console.warn(...) 유저 ${userId}` 형태 — 개발 시점만 사용. Sentry 연동 시 `beforeSend` 마스킹 권고 |
| service_role 키 길이 검증 | ❌ | env 미설정 시에만 throw. 잘못된 키일 때 검증 없음 |
| Webhook 서명 | ❌ | 토스페이먼츠 W7~8 — 결제 웹훅 HMAC 서명 검증 필수 (P0) |
| CORS | ❓ | Next.js 기본값. 출시 전 점검 |

---

## 7. 결론

**즉시 수정 5건 (Critical)**:
1. ai-budget 105% 하드 차단 추가
2. 레드라인 영문 패턴 추가
3. env 이름 에러 메시지 마스킹
4. requireAuth profile DB 연결 (W3)
5. 시그니처 컴포넌트 4종 통합 강제 가드 (W3)

**W3 진입 전 권고 8건 (High)**:
1. KST 자정 경계 month key
2. SSE 누적 버퍼 sanitize
3. redline deep traversal
4. Zod `.strict()`
5. calculateStreak grace 룰 재정의
6. 체크인 race ON CONFLICT
7. Redis 공통 모듈 추출
8. assertNotAgeBlocked age 인자 정확

**W3 일괄 리네임 15건** — 백엔드팀장 §11 + QA 추가 1건 (`score.ts` ↔ `date` 타입).
