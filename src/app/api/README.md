# 오름(Oreum) API 설계서 — W1~W2 코어 스켈레톤

> API 설계자(@API설계자) 산출물 | 2026-05-14
> 상태: W1~W2 코어 스켈레톤 완료 (DB stub, LLM stub 포함)

---

## 엔드포인트 목록

| Method | Path | 설명 | 인증 | Pro 전용 |
|--------|------|------|------|----------|
| POST | `/api/checkin` | 4축 입력 → 점수+변화량+미션 (1 RTT) | 필요 | - |
| GET | `/api/score/today` | 오늘 점수 snapshot | 필요 | - |
| GET | `/api/score/history` | 기간별 그래프 데이터 | 필요 | 90일만 Pro |
| POST | `/api/coach/chat` | SSE 스트리밍 코치챗 | 필요 | 3일 무료 후 Pro |
| GET | `/api/mission/today` | 오늘 미션 조회 | 필요 | - |
| PATCH | `/api/mission/today` | 오늘 미션 완료 처리 | 필요 | - |
| POST | `/api/goal` | 90일 목표 등록 + AI 마일스톤 분해 | 필요 | Pro |
| GET | `/api/goal` | 목표 목록 조회 | 필요 | - |
| POST | `/api/onboarding/age-verify` | 생년월일 → 만16세 미만 차단 | 필요 | - |
| GET | `/api/me` | 유저+페르소나+구독 상태 | 필요 | - |
| PATCH | `/api/me` | 페르소나·북극성 다짐 업데이트 | 필요 | - |

---

## 상세 스펙

### POST /api/checkin

**요청 헤더**: `Authorization: Bearer <supabase_jwt>`

**요청 Body**:
```typescript
{
  health: number,       // 0~100 정수
  learning: number,     // 0~100 정수
  relation: number,     // 0~100 정수
  achievement: number,  // 0~100 정수
  memo?: string         // 선택, 최대 500자
}
```

**성공 응답** (201):
```typescript
{
  success: true,
  data: {
    checkinId: string,
    score: { health, learning, relation, achievement, total, ts, version },
    delta: { health, learning, relation, achievement, total },
    todayMission: { id, title, description, axis, difficulty },
    streak: { current, isNewRecord, graceUntil }
  }
}
```

**특징**: 1 RTT — 점수 계산 + 미션 처방이 단일 응답으로 반환됨. 하루 1회 제한(E_CHECKIN_ALREADY_DONE).

---

### GET /api/score/today

**성공 응답** (200):
```typescript
{
  success: true,
  data: {
    score: ScoreSnapshot,
    hasCheckedInToday: boolean,
    delta: ScoreDelta | null
  }
}
```

---

### GET /api/score/history?period=7|30|90&cursor=<opaque>

**쿼리 파라미터**:
- `period`: `7` | `30` | `90` (기본 `7`)
- `cursor`: 페이지네이션 커서 (선택)

**성공 응답** (200):
```typescript
{
  success: true,
  data: {
    period: "7" | "30" | "90",
    points: Array<{ date: "YYYY-MM-DD", score: ScoreSnapshot }>,
    nextCursor: string | null
  }
}
```

**주의**: `period=90`은 Pro 구독자 전용. 비Pro 호출 시 `E_PAYWALL_REQUIRED`.

---

### POST /api/coach/chat (SSE)

**요청 Body**:
```typescript
{
  message: string,              // 1~2000자
  persona: "mentor" | "spartan" | "friend",
  history?: Array<{ role: "user" | "assistant", content: string }> // 최대 20턴
}
```

**응답**: `Content-Type: text/event-stream`

SSE 청크 형식:
```
data: {"type":"delta","content":"..."}
data: {"type":"done","usage":{"promptTokens":100,"completionTokens":50,"estimatedKrw":0.5}}
data: {"type":"error","code":"E_INTERNAL","message":"..."}
```

**게이트**: 가입 후 3일 무료 → 만료 시 `E_PAYWALL_REQUIRED(free_trial_ended)`.
**모델 전략**: Claude Sonnet 4.5 → (50% 예산) gpt-4o-mini → (90% 예산) Claude Haiku.

---

### POST /api/goal

**요청 Body**:
```typescript
{
  title: string,        // 5~200자
  description?: string, // 최대 1000자
  targetDate?: string,  // YYYY-MM-DD
  axis?: "health" | "learning" | "relation" | "achievement"
}
```

**성공 응답** (201):
```typescript
{
  success: true,
  data: {
    goalId: string,
    title: string,
    milestones: Array<{ id, week, title, description, targetScore }>, // 13주
    createdAt: string
  }
}
```

**Pro 전용**: 비Pro 호출 시 `E_PAYWALL_REQUIRED`.

---

### POST /api/onboarding/age-verify

**요청 Body**:
```typescript
{ birthDate: "YYYY-MM-DD" }
```

**성공 응답** (200):
```typescript
{ success: true, data: { allowed: true, age: number } }
```

**차단 응답** (403):
```typescript
{ success: false, error: { code: "E_AGE_BLOCKED", message: "...", details: { age: number } } }
```

---

## 공통 규칙

### 인증

모든 엔드포인트에서 `Authorization: Bearer <supabase_jwt>` 헤더 필수.
미전송 시 → `401 E_AUTH_REQUIRED`.

Supabase JWT는 클라이언트에서 `supabase.auth.getSession()` 으로 획득.
서버에서 `supabase.auth.getUser(token)` 으로 검증 (RLS 자동 적용).

### 응답 형식

```typescript
// 성공
{ success: true, data: T, meta: { requestId: string, ts: string } }

// 실패
{ success: false, error: { code: ErrorCode, message: string, details?: unknown }, meta: {...} }
```

### 에러 코드 표준

| 코드 | HTTP | 설명 |
|------|------|------|
| `E_AUTH_REQUIRED` | 401 | 인증 토큰 없음 또는 만료 |
| `E_AUTH_INVALID_TOKEN` | 401 | 유효하지 않은 JWT |
| `E_AGE_BLOCKED` | 403 | 만 16세 미만 차단 |
| `E_REDLINE_REJECT` | 422 | 외모·타인비교 요청 차단 |
| `E_AI_QUOTA_EXCEEDED` | 429 | 월 AI 예산 ₩200 초과 |
| `E_PAYWALL_REQUIRED` | 402 | Pro 구독 필요 |
| `E_VALIDATION` | 400 | 입력값 유효성 오류 |
| `E_CHECKIN_ALREADY_DONE` | 409 | 오늘 이미 체크인 완료 |
| `E_NOT_FOUND` | 404 | 리소스 없음 |
| `E_RATE_LIMIT` | 429 | 레이트리밋 초과 |
| `E_INTERNAL` | 500 | 서버 내부 오류 |

### 페이지네이션 (cursor 기반)

- offset 기반 절대 사용 금지
- `nextCursor`가 `null`이면 마지막 페이지
- cursor는 불투명 문자열 (내부 구현 변경 가능)

### 레이트리밋

| 구분 | 한도 | 구현 |
|------|------|------|
| 일반 API | 유저당 60 req/분 | Upstash sliding window |
| AI 호출 | 유저당 5 req/분 | Upstash sliding window |

초과 시 `429 E_RATE_LIMIT`, `X-RateLimit-*` 헤더 포함.

---

## 환경변수

`.env.example` 참조. 주요 변수:

| 변수명 | 설명 |
|--------|------|
| `SUPABASE_URL` | Supabase 프로젝트 URL |
| `SUPABASE_ANON_KEY` | 클라이언트용 공개 키 |
| `SUPABASE_SERVICE_ROLE_KEY` | 서버 전용 (절대 클라이언트 노출 금지) |
| `UPSTASH_REDIS_REST_URL` | Upstash Redis URL |
| `UPSTASH_REDIS_REST_TOKEN` | Upstash 인증 토큰 |
| `ANTHROPIC_API_KEY` | Claude API 키 |
| `OPENAI_API_KEY` | GPT-4o-mini 폴백용 |
| `AI_BUDGET_KRW_MONTHLY` | AI 예산 상한 (기본 200원) |
| `TOSS_PAYMENTS_SECRET` | 토스페이먼츠 (W7~8) |

---

## 레드라인 강제 사항

### 서버단 금지 필드 (요청 즉시 reject)

`compare_others`, `other_users`, `appearance`, `looks`, `face_score`, `rank`, `leaderboard`, `body_score`, `weight_compare`, `attractiveness`, `beauty_score`

### 코치챗 메시지 패턴 차단

"다른 사람/유저", "타인 비교", "외모 점수", "얼굴 점수", "몸매 비교", "리더보드", "랭킹 순위"

### LLM 응답 사후 검증

`sanitizeAiResponse()` 함수로 출력 직전 검증. 위반 내용은 안내 메시지로 대체.

---

## 파일 구조

```
src/
  app/api/
    checkin/route.ts           POST /api/checkin
    score/
      today/route.ts           GET  /api/score/today
      history/route.ts         GET  /api/score/history
    coach/
      chat/route.ts            POST /api/coach/chat (SSE)
    mission/
      today/route.ts           GET|PATCH /api/mission/today
    goal/route.ts              POST|GET /api/goal
    onboarding/
      age-verify/route.ts      POST /api/onboarding/age-verify
    me/route.ts                GET|PATCH /api/me
    README.md                  (이 파일)
  lib/
    shared/
      schemas.ts               Zod 스키마 (클라이언트+서버 공유)
    server/
      auth.ts                  Supabase JWT 검증
      redline.ts               레드라인 가드
      rate-limit.ts            Upstash 레이트리밋
      ai-budget.ts             AI 예산 카운터
      score-engine.ts          결정론 점수 산식
      paywall.ts               Pro 게이트
      coach-prompts.ts         페르소나 시스템 프롬프트
      errors.ts                에러 코드 표준
```
