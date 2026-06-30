# 오름(Oreum) 백엔드 아키텍처 최종안 — W1~W2

> 작성: @백엔드팀장 (Opus) | 2026-05-14
> 입력: @API설계자 + @DB설계자 산출물 종합 검수
> 상태: W1~W2 스켈레톤 검수 완료, W3 진입 준비

---

## 1. 시스템 아키텍처

```
[클라이언트(Next.js 14 RSC + PWA)]
        │  Supabase JWT (Bearer)
        ▼
[Next.js API Routes — BFF 레이어]   ← src/app/api/*
        │
        ├─ requireAuth() → supabase.auth.getUser(token)
        ├─ runRedlineGuard() → 금지 필드/패턴 차단
        ├─ checkGeneralRateLimit() → Upstash (60/min)
        ├─ resolveAiModel() → AI 예산 카운터 (Upstash)
        │
        ├──► [Supabase Postgres + RLS]   ← service_role / authenticated
        ├──► [Upstash Redis]             ← rate-limit + ai_budget
        ├──► [Anthropic Claude Sonnet 4.5 → Haiku] (코치챗 SSE)
        ├──► [OpenAI gpt-4o-mini]        (예산 50% 폴백)
        └──► [토스페이먼츠]               (W7~8 결제 활성화)

[pg_cron 일배치 4개] — score 집계 / 익명화 / 미션 큐 / PIPA 클린업
```

원칙: 모놀리식 Next.js BFF + Supabase managed DB. 마이크로서비스 금지(MVP 범위 과설계).

---

## 2. 엔드포인트 명세 (8 + 부속 3 = 총 11 라우트)

| Method | Path | 요청 | 응답(data) | 인증 | RL | AI예산 |
|---|---|---|---|---|---|---|
| POST | `/api/checkin` | 4축+memo | checkinId/score/delta/todayMission/streak | Auth+Age | 60/min | - |
| GET | `/api/score/today` | - | score/hasCheckedInToday/delta | Auth | 60/min | - |
| GET | `/api/score/history` | period 7\|30\|90 | period/points/nextCursor | Auth(period=90:Pro) | 60/min | - |
| POST | `/api/coach/chat` (SSE) | message/persona/history | delta/done/error chunks | Auth+Trial/Pro | 5/min | ★ |
| GET | `/api/mission/today` | - | mission/completedAt | Auth | 60/min | - |
| PATCH | `/api/mission/today` | status | updated | Auth | 60/min | - |
| POST | `/api/goal` | title/desc/targetDate/axis | goalId/milestones | Auth+Pro | 5/min | ★ (분해) |
| GET | `/api/goal` | - | goals[] | Auth | 60/min | - |
| POST | `/api/onboarding/age-verify` | birthDate | allowed/age | Auth | 60/min | - |
| GET | `/api/me` | - | id/email/persona/subscription/aiBudget | Auth(age허용) | 60/min | - |
| PATCH | `/api/me` | persona/northStar/nickname | updated | Auth+Age | 60/min | - |

응답 공통 래퍼: `{success, data|error, meta:{requestId, ts}}` (Zod 검증).

---

## 3. DB 스키마 (7 테이블) — 관계도

```
auth.users (Supabase)
   │ 1:1
   ▼
users ─┬─ 1:N ─ daily_checkin ─(일배치)─► score_snapshot
       ├─ 1:N ─ goal ─ 1:N ─ mission
       ├─ 1:1 ─ subscription
       └─ 1:N ─ coach_chat
```

핵심 컬럼:
- `users(id, display_name, birth_year, persona, weights jsonb, is_anonymized, last_active_at)`
- `daily_checkin(user_id, date, input_jsonb)` — UNIQUE(user_id,date)
- `score_snapshot(user_id, date, health, learning, relation, achievement, total, delta_from_yesterday, formula_version)` — service_role INSERT only
- `mission(user_id, kind:daily|milestone, status, source:ai|user, goal_id)`
- `goal(user_id, statement, start_date, end_date GENERATED(+90d), milestones_jsonb, status)`
- `subscription(user_id UNIQUE, plan:free|basic|pro, provider, trial_ends_at, status)`
- `coach_chat(user_id, session_id, role, content, persona, tokens_in/out, cost_krw, model)` — service_role INSERT only

---

## 4. RLS 정책 핵심

전 테이블 `ENABLE ROW LEVEL SECURITY`. 패턴:

| 테이블 | SELECT | INSERT | UPDATE | DELETE |
|---|---|---|---|---|
| users | own | service_role | own | 차단 |
| daily_checkin | own | own (user_id=auth.uid) | own | 차단 |
| score_snapshot | own | service_role | service_role | 차단 |
| mission | own | own(source='user') / service_role(ai) | own | 차단 |
| goal | own | own | own | 차단 |
| subscription | own | service_role | service_role | 차단 |
| coach_chat | own | service_role only | service_role | 차단 |

레드라인 강제: `user_id != auth.uid()` 행은 어떤 경로로도 노출 불가 → 타인 점수/리더보드 DB 차원 불가능.

---

## 5. 점수 산식 엔진

- 파일: `src/lib/server/score-engine.ts` + `api/db/score_formula.md`
- **결정론 산식**: LLM 미사용. 4축 가중합 + 비선형 평활화(G항).
- 기본 가중치: 0.25/0.25/0.25/0.25 (정합 수정 완료: 코드 ↔ 문서 일치).
- Pro 가중치 커스텀: 각 축 0.10~0.70, 합=1.00 (서버 검증 + 정규화).
- Versioning: `SCORE_VERSION = "v1.0.0"` + ENV `SCORE_FORMULA_VERSION` 도입 (.env.example 추가).
- G항: 극단값 완충, 보정 계수 내부 비공개. score_snapshot.formula_version에 기록.

---

## 6. AI 비용 가드

```
ratio < 0.5  → Claude Sonnet 4.5 (PRIMARY)
0.5 ≤ <0.9   → gpt-4o-mini       (FALLBACK_1)
0.9 ≤ <1.0   → Claude Haiku      (FALLBACK_2)
1.0 ≤ <1.05  → Haiku 유지        (UX 우선, B-A1 결정)
ratio ≥ 1.05 → 코치챗 비활성     (E_AI_QUOTA_EXCEEDED, 이중 안전선)
```

- Upstash Redis 카운터 (`ai_budget:{userId}:{YYYY-MM}`, TTL 32일)
- DB 감사: `coach_chat.cost_krw` 누적 (정합성 보조)
- 월 ₩200/유저 상한 (Q4 사장 확정)

---

## 7. 레드라인 강제 (6가지)

1. **만 16세 미만 차단** — `assertNotAgeBlocked()` + `birth_year` 서버 재검증.
2. **외모/타인비교 금지** — `runRedlineGuard()` 금지 필드 11종 + 메시지 패턴 7종.
3. **90일 미접속 자동 익명화** — cron `oreum-anonymize-inactive-users` (03:00 KST).
4. **점수 산식 LLM 미사용** — score-engine.ts 결정론 코드만, AI 호출 경로 없음.
5. **AI 예산 ₩200/월** — Redis 카운터 + 105% 하드 차단.
6. **coach_chat 본문 1년 후 삭제** — cron `oreum-pipa-chat-content-cleanup` (월 1일 04:00, content=NULL, 메타 유지).

---

## 8. 결제·Paywall 흐름

```
가입 → users 생성(서버 트리거) → subscription(plan=free, status=trialing, trial_ends_at=+3d)
   │
   ├─ 0~3일: coach_chat 무료 (Q5=B)
   └─ 3일 후: paywall.ts → E_PAYWALL_REQUIRED(free_trial_ended)
         │
         └─ 토스페이먼츠 결제 (W7~8 활성화)
              └─ 웹훅 → service_role UPDATE subscription(plan=pro, status=active, current_period_end)
```

ENV: `TOSS_PAYMENTS_SECRET`, `COACH_FREE_TRIAL_DAYS=3`.

---

## 9. cron 잡 4개

| 잡 | 시각(KST) | 내용 |
|---|---|---|
| `oreum-daily-score-snapshot` | 00:30 | 어제 daily_checkin → score_snapshot 백필 (균등 가중치) |
| `oreum-anonymize-inactive-users` | 03:00 | last_active_at < NOW()-90d → 익명화 |
| `oreum-daily-mission-queue` | 05:00 | 오늘 미션 placeholder 생성 (AI 처리는 Edge Function) |
| `oreum-pipa-chat-content-cleanup` | 매월 1일 04:00 | coach_chat 1년 경과 content NULL |

**W3 추가 예정**: `oreum-ai-budget-sync` (시간당, Redis ↔ coach_chat.cost_krw SUM 동기화, B-D2 결정).

---

## 10. 팀장 자체 확정 결정 4건

| # | 결정 사항 | 근거 |
|---|---|---|
| **B-A1** | **AI 예산 초과: 폴백 유지 + 105% 도달 시 코치챗 비활성** | UX 보호 우선이나 무한 비용 방지 이중 안전선. 단순 차단은 페이지 유지율 -15% 추정. ai-budget.ts 후속 패치 W3. |
| **B-A2** | **미션 결정: W1~W4 규칙 기반 유지, W5 베타 A/B로 경량 AI(Haiku) 도입 검토** | 비용/지연 둘 다 절약. 미션 호출도 추후 비용 카운터에 포함되도록 `recordAiUsage()` 인터페이스 유지. |
| **B-D1** | **goal.end_date Generated Column 유지** | 12주 MVP는 90일 고정. v2에서 일반 컬럼으로 DROP+ALTER 마이그레이션 예약. |
| **B-D2** | **Redis Primary + 시간당 DB SUM 동기화 워커 추가 (W3)** | Redis 휘발 위험 대응. 정합성 안전선. cron 5번째 잡으로 추가. |

---

## 11. API ↔ DB 이름 정렬 매핑 표 (W3 필수 작업)

**원칙: DB 스키마를 정답으로**, API 측 코드/타입을 따라 맞춤. 대규모 리네임은 W3 시작 시 일괄.

### 11-1. 테이블명 불일치 (코드 TODO 코멘트 기준 4건)

| API 코드 표기 | DB 실제 | 조치 |
|---|---|---|
| `db.checkins` | `daily_checkin` | route 코멘트 정정 |
| `db.scoreSnapshots` | `score_snapshot` | 정정 |
| `db.user_missions` / `missions` | `mission` (kind/source로 구분) | 정정 + Mission 모델 통합 |
| `db.users` | `users` | 일치 |

### 11-2. 컬럼/필드 불일치 (10건+, 핵심)

| API/Zod 필드 | DB 컬럼 | 조치 |
|---|---|---|
| `AuthUser.subscriptionTier` | `subscription.plan` (별 테이블 JOIN) | auth.ts에서 JOIN 조회로 변경 |
| `AuthUser.coachFreeUntil` | `subscription.trial_ends_at` | 동일 |
| `AuthUser.isAgeBlocked` | `users.birth_year`로 런타임 계산 | helper `computeAgeBlocked(birth_year)` 추가 |
| `MeResponse.nickname` | `users.display_name` | 매핑 |
| `MeResponse.northStarStatement` | `users.north_star_statement` | snake↔camel 매핑 |
| `MeResponse.subscription.expiresAt` | `subscription.current_period_end` | 매핑 |
| `CheckinRequest.memo` | `daily_checkin.note` | 매핑 |
| `MissionSchema.axis / difficulty` | mission 테이블에 없음 | DB에 컬럼 추가 OR 미션 풀 별도 테이블 OR JSONB body에 포함 → **DB설계자 W3 마이그레이션 005**로 컬럼 추가 권고 |
| `GoalRequest.title / targetDate / axis` | `goal.statement / end_date(Generated) / -` | targetDate는 무시(고정 +90d), axis는 미저장 또는 milestones_jsonb에 포함 |
| `AgeVerifyRequest.birthDate` (full date) | `users.birth_year` (year only) | 클라이언트 입력은 full date 받되, **저장은 year만** (PIPA 최소수집). API 응답 변경 불요. |

### 11-3. 산식 가중치 정합 (즉시 수정 완료)

| 항목 | Before | After | 비고 |
|---|---|---|---|
| `DEFAULT_WEIGHTS` | 0.30/0.25/0.20/0.25 | **0.25 균등** | score_formula.md §2 일치 |
| `clamp` 범위 | 축마다 다름 (0.15~0.35) | **0.10~0.70 통일** | score_formula.md §3 일치 |

### 11-4. 환경변수 추가 (즉시 수정 완료)

- `SCORE_FORMULA_VERSION=v1` (산식 버전 ENV 관리)
- `COACH_FREE_TRIAL_DAYS=3` (Q5 사장 결정)
- `APP_TIMEZONE=Asia/Seoul` (KST 일자 경계)

---

## 12. 프론트팀장 합의 잔여 사항

1. **체크인 응답의 `version` 필드 노출** — 프론트가 산식 변경을 사용자에게 안내할지 (G항 부분공개 정책 협의).
2. **SSE 청크 형식** — `data: {...}\n\n` 표준 준수, 토큰 단위 → 문자 단위 권장.
3. **`E_PAYWALL_REQUIRED` 응답에 `details.reason`** (`free_trial_ended` / `pro_required`) 노출하여 프론트 분기.
4. **`MissionSchema.axis/difficulty`** — DB 컬럼 추가 후 응답 안정화 시점 합의 (현재 stub).
5. **`history.nextCursor` 형식** — 불투명 문자열로 강제, 프론트는 비교/파싱 금지.

---

## 13. 🎯 사장 결정 필요

**없음**. W1~W2 범위는 팀장 권한으로 모두 확정. W5 진입 시 미션 AI(B-A2) A/B 베타에서 사장 보고 예정.

---

## 부록 — 검수 결과 요약

- API설계자 8 엔드포인트 + 부속 3 라우트 = 11 라우트 스켈레톤 ✅
- DB설계자 7테이블 + RLS + 인덱스 + cron 4잡 + seed ✅
- 정합성 이슈 발견: **테이블명 4건, 컬럼 매핑 10건+, 산식 가중치 1건, 환경변수 3건 누락**
- 즉시 수정: 산식 가중치(0.25 균등) + clamp 범위 + .env.example 3개 변수 추가
- W3 작업 항목: 대규모 컬럼/테이블 리네임 + DB 마이그레이션 005(mission 컬럼 추가) + AI 예산 동기화 워커
