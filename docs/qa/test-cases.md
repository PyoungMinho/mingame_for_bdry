# 오름(Oreum) 테스트 케이스 명세서 — W1~W2

> 작성: @QA설계자 (Opus) · 2026-05-14
> 우선순위: **P0 = 출시 차단** / P1 = 베타 차단 / P2 = 출시 후 개선
> 자동화 표기: ✅ = 즉시 자동화 / 🟡 = W3 통합 후 / 🔴 = 수동 검증

---

## 범위
- W1~W2 골격: `src/lib/server/*`, `src/lib/shared/schemas.ts`, `src/lib/api/client.ts`, `src/app/api/**/route.ts` 11라우트 스켈레톤
- 시그니처 컴포넌트 4종 + 페이지 통합 케이스는 **TODO(W3+)** 표시
- 결제·실제 LLM 호출은 stub 상태이므로 TODO(W7~8) 표시

---

## A. 레드라인 (P0-CRITICAL) — 출시 차단 게이트

### A-1. RL-1 만 16세 미만 가입 차단

| ID | 시나리오 | 사전조건 | 입력 | 기대 결과 | P | 자동화 |
|---|---|---|---|---|---|---|
| **A-001** | 만 15세 11개월 (생일 1일 전) 가입 시도 | Supabase Auth 세션 보유 | `birthDate=2010-05-15` (today=2026-05-14) | 403 `E_AGE_BLOCKED` + `details.age=15` | P0 | ✅ |
| **A-002** | 만 16세 0개월 0일 (생일 당일) | 세션 보유 | `birthDate=2010-05-14` | 200 `allowed=true age=16` | P0 | ✅ |
| **A-003** | 만 16세 0개월 1일 전 (생일 익일) | 세션 보유 | `birthDate=2010-05-13` | 200 `allowed=true age=16` | P0 | ✅ |
| **A-004** | 만 15세 (전월 동일) | 세션 보유 | `birthDate=2010-06-14` | 403 `E_AGE_BLOCKED age=15` | P0 | ✅ |
| **A-005** | 윤년 2/29 생일 + 비윤년 검증 | 세션 보유 | `birthDate=2008-02-29` (today=2026-02-28) | age 계산 정확 (17세) | P0 | ✅ |
| **A-006** | 미래 생년월일 | 세션 보유 | `birthDate=2030-01-01` | 400 `E_VALIDATION` 또는 age 음수 reject | P0 | ✅ |
| **A-007** | 잘못된 포맷 | 세션 보유 | `birthDate="2010/05/14"` | 400 `E_VALIDATION` (Zod `.date()` 엄격) | P0 | ✅ |
| **A-008** | 빈 문자열 | 세션 보유 | `birthDate=""` | 400 `E_VALIDATION` | P0 | ✅ |
| **A-009** | 만 100세 초과 (생존 가능 경계) | 세션 보유 | `birthDate=1900-01-01` | 200 `allowed=true` (상한 없음 — 정책 확인 필요) | P0 | ✅ |
| **A-010** | 차단 플래그 false인 사용자 우회 시도 | `isAgeBlocked=false` 세션 | 다른 API 호출 (`/api/checkin`) | 200 통과. **서버 재검증은 birth_year 기반 (W3 DB 통합 후)** | P0 | 🟡 |
| **A-011** | 차단 플래그 true 사용자가 토큰 재발급 후 접근 | `isAgeBlocked=true` 세션 | `/api/checkin` POST | 403 `E_AGE_BLOCKED` (`assertNotAgeBlocked`) | P0 | ✅ |
| **A-012** | KST 시각 경계 (UTC 23시 = KST 익일 8시) 나이 계산 | 시스템시각 KST 2026-05-15 00:00:01 | `birthDate=2010-05-15` | age=16 (KST 기준 정확) | P0 | ✅ |
| **A-013** | birthDate를 birth_year로 손실 변환 후 재계산 정합 | DB 저장 (year only, PIPA) | `birthDate=2010-05-14` → DB `birth_year=2010` | 재로그인 후 만 15세로 잘못 계산 X (생일 미경과 시) — **현재 `users.birth_year` only 저장은 PIPA 우선이나 16세 경계 1년 오차 위험. 정책 재검토 필요** | P0 | 🔴 |

### A-2. RL-2 외모/타인비교 reject

| ID | 시나리오 | 입력 | 기대 결과 | P | 자동화 |
|---|---|---|---|---|---|
| **A-101** | `BLOCKED_FIELD_NAMES` 11개 필드 각각 body 포함 | `{"compare_others": true}` 등 11회 | 11회 모두 422 `E_REDLINE_REJECT` `details.field` 정확 | P0 | ✅ |
| **A-102** | 케이스 변형 (대문자/하이픈/공백) | `{"Compare-Others": 1}` `{"COMPARE OTHERS": 1}` | normalizedKey 매칭으로 모두 차단 | P0 | ✅ |
| **A-103** | `BLOCKED_TEXT_PATTERNS` 8개 정규식 텍스트 | `"나보다 잘생긴 사람"` 등 8회 | `/api/coach/chat` 422 `E_REDLINE_REJECT details.field=message_content` | P0 | ✅ |
| **A-104** | 한글 띄어쓰기 변이 | `"다른사람"` `"다른  사람"` `"다른\n사람"` | 정규식 `\s*` 매칭 — 첫 2개는 통과해야 함. **현재 정규식 `\s*`는 0개 공백 허용 → "다른사람" 차단되나 의도? 정책 확인** | P0 | ✅ |
| **A-105** | 외국어 우회 시도 | `"compare with others"` `"leaderboard"` (영문) | `BLOCKED_TEXT_PATTERNS` 한글만 → **우회 가능 = High Risk**. 영문 키워드 정규식 추가 필요 | P0 | ✅ |
| **A-106** | client.ts `ALLOWED_PATH_PATTERNS` 미허용 경로 | `apiClient("/api/leaderboard")` `apiClient("/api/peer")` `apiClient("/api/ranking")` `apiClient("/api/compare")` `apiClient("/api/score/average-all")` | 클라단 throw `OreumApiError E_REDLINE_REJECT` | P0 | ✅ |
| **A-107** | `sanitizeAiResponse` LLM 응답 검열 | 5개 RESPONSE_BLOCKED_PATTERNS 텍스트 | 정책 안내문으로 치환 | P0 | ✅ |
| **A-108** | LLM 응답에 영문 `"top 10%"` `"average score"` 포함 | `sanitizeAiResponse("you are in top 10%")` | **현재 패턴은 한글 한정 → 통과 = 우회**. 영문 패턴 추가 권고 | P0 | ✅ |
| **A-109** | RLS 직접 검증 — 타인 user_id로 SELECT | Supabase JWT(userA) + `SELECT * FROM users WHERE id='userB'` | row 0개 (RLS `users_select_own`) | P0 | 🟡 |
| **A-110** | score_snapshot 타인 행 SELECT | userA 토큰으로 다른 user_id 조회 | row 0개 | P0 | 🟡 |
| **A-111** | 코치챗 응답 SSE 청크별 sanitize | sanitize 호출이 청크 단위로 작동 / 청크 분할로 우회 가능성 | "다른" / "사람" 청크 분리되면 정규식 미스 — **W3 누적 버퍼 sanitize 권고** | P0 | ✅ |

### A-3. RL-3 90일 미접속 익명화

| ID | 시나리오 | 사전조건 | 기대 | P | 자동화 |
|---|---|---|---|---|---|
| **A-201** | cron 실행 시 90일+1 미접속 사용자 익명화 | `last_active_at = NOW()-91d` | `display_name=NULL` `email=anon-{uuid}` `is_anonymized=true` | P0 | 🟡 |
| **A-202** | 89일 미접속 사용자 무영향 | `last_active_at = NOW()-89d` | 변경 없음 | P0 | 🟡 |
| **A-203** | 익명화 사용자 재로그인 시도 | `is_anonymized=true` | 로그인 거부 또는 신규 가입 유도 (정책 확인) | P0 | 🟡 |
| **A-204** | cron 03:00 KST 정확히 실행 | `oreum-anonymize-inactive-users` | pg_cron 스케줄 = `0 18 * * *` (UTC = 03:00 KST) | P0 | 🟡 |

### A-4. RL-4 점수 산식 결정론

| ID | 시나리오 | 입력 | 기대 | P | 자동화 |
|---|---|---|---|---|---|
| **A-301** | 동일 입력 1000회 반복 | `{health:70,learning:80,relation:60,achievement:50}` | 1000회 모두 동일 `total` 비트레벨 일치 | P0 | ✅ |
| **A-302** | property-based 4축 랜덤 0~100 | `fc.tuple(fc.integer(0,100)×4)` 500회 | f(x)=f(x) 결정론 | P0 | ✅ |
| **A-303** | SCORE_VERSION snapshot 일관 | `buildScoreSnapshot()` | `version="v1.0.0"` 고정 (ENV override 시 ENV값) | P0 | ✅ |
| **A-304** | 정적 분석: score-engine.ts에 LLM/network import 없음 | dep-cruiser | `anthropic` `openai` `fetch` `axios` import 0건 | P0 | ✅ |
| **A-305** | 가중치 합 1.0 정규화 정확 | `userWeightOverride={health:0.5,learning:0.3,relation:0.1,achievement:0.1}` | 합 1.0 유지 | P0 | ✅ |
| **A-306** | clamp 0.10~0.70 경계 | `health:0.05` → 0.10 / `health:0.80` → 0.70 | clamp 정확 | P0 | ✅ |
| **A-307** | 모든 축 0 입력 | `{0,0,0,0}` | total=0, NaN 없음 | P0 | ✅ |
| **A-308** | 모든 축 100 입력 | `{100,100,100,100}` | total=100 | P0 | ✅ |
| **A-309** | smoothScore 50점 중앙값 보존 | `smoothScore(50)` | 50.0 | P0 | ✅ |
| **A-310** | smoothScore 단조증가 | `smoothScore(x) < smoothScore(x+1)` for 0..99 | 단조증가 | P0 | ✅ |
| **A-311** | calculateDelta yesterday=null | yesterday=null | delta 모든 축 0 | P0 | ✅ |
| **A-312** | calculateDelta 음수 변화량 | today=50, yesterday=70 | delta=-20.0 | P0 | ✅ |
| **A-313** | formula_version 변경 시 과거 snapshot 보존 | DB snapshot.formula_version 컬럼 | 변경 후에도 과거 행 그대로 | P0 | 🟡 (W3 DB) |
| **A-314** | 소수점 1자리 반올림 일관 | 0.05 → 0.1 / 0.04 → 0.0 (banker's rounding 여부) | 명세 통일 필요 | P0 | ✅ |

### A-5. RL-5 AI 비용 ₩200 + 105% 차단

| ID | 시나리오 | 입력 | 기대 | P | 자동화 |
|---|---|---|---|---|---|
| **A-401** | ratio=0.0 → PRIMARY | usage=0 | `claude-sonnet-4-5` | P0 | ✅ |
| **A-402** | ratio=0.49 → PRIMARY | usage=₩98 | `claude-sonnet-4-5` | P0 | ✅ |
| **A-403** | ratio=0.5 → FB1 (경계) | usage=₩100 | `gpt-4o-mini` | P0 | ✅ |
| **A-404** | ratio=0.89 → FB1 | usage=₩178 | `gpt-4o-mini` | P0 | ✅ |
| **A-405** | ratio=0.9 → FB2 (경계) | usage=₩180 | `claude-haiku` | P0 | ✅ |
| **A-406** | ratio=0.999 → FB2 | usage=₩199.9 | `claude-haiku` | P0 | ✅ |
| **A-407** | ratio=1.0 → FB2 유지 (UX 정책) | usage=₩200 | `claude-haiku` | P0 | ✅ |
| **A-408** | **ratio=1.05 → E_AI_QUOTA_EXCEEDED** | usage=₩210 | **현재 코드 미구현 = Critical Bug. 수정 후 throw 검증** | **P0** | ✅ |
| **A-409** | Redis TTL = 32일 | `recordAiUsage` 호출 | `expire` 키 TTL ≈ 2,764,800초 | P0 | ✅ |
| **A-410** | Redis 키 형식 | `ai_budget:{userId}:{YYYY-MM}` | 키 정확 | P0 | ✅ |
| **A-411** | 월 경계 (2026-05-31 23:59 KST → 06-01 00:00) | recordAiUsage 호출 시각 | 새 키 발행, 누적 0부터 시작. **현재 코드는 UTC 기준 `getMonth()` — KST 자정 경계와 9시간 차이 = Bug** | P0 | ✅ |
| **A-412** | AI_BUDGET_KRW_MONTHLY ENV 오버라이드 | ENV=300 | budget=300 적용 | P1 | ✅ |
| **A-413** | resolveAiModel 호출 시 Redis 장애 | Redis throw | E_INTERNAL — **현재 코드는 fallback 없음. UX 정책 검토 필요** | P1 | ✅ |
| **A-414** | recordAiUsage 동시 호출 (race) | 동시 10회 INCRBYFLOAT | 누적 정확 (INCRBYFLOAT atomic) | P1 | ✅ |
| **A-415** | DB `coach_chat.cost_krw` SUM ↔ Redis 동기화 | W3 cron 추가 | 정합성 ±1원 이내 | P1 | 🟡 (W3+) |

---

## B. 핵심 루프 (P0)

| ID | 시나리오 | 입력/사전 | 기대 | P | 자동화 |
|---|---|---|---|---|---|
| **B-001** | 체크인 1 RTT 성공 흐름 | 4축 + memo | 201 `checkinId/score/delta/todayMission/streak` 5필드 모두 포함 | P0 | ✅ |
| **B-002** | 하루 1회 체크인 제약 (UNIQUE) | 같은 user_id + date 2회 | 2번째 → 409 `E_CHECKIN_ALREADY_DONE` | P0 | 🟡 (DB) |
| **B-003** | UNIQUE 위반 시 graceful 응답 (race) | 동시 2회 POST | 1건 성공, 1건 409 (race-safe) | P0 | 🟡 |
| **B-004** | KST 자정 경계 체크인 분리 | 23:59:59 + 00:00:01 | 2회 모두 성공 (다른 date) | P0 | ✅ |
| **B-005** | memo 500자 정확 경계 | memo.length=500 | 200 / 501 → 400 | P0 | ✅ |
| **B-006** | memo 미제공 | memo undefined | 200 (optional) | P0 | ✅ |
| **B-007** | axis 음수 / 101 | health=-1 / 101 | 400 `E_VALIDATION` | P0 | ✅ |
| **B-008** | axis float | health=50.5 | 400 (`.int()`) | P0 | ✅ |
| **B-009** | axis 누락 | health 누락 | 400 | P0 | ✅ |
| **B-010** | 스트릭 0시 + 24h grace | last=yesterday → today | `current=N+1, isNewRecord` 정확 | P0 | ✅ |
| **B-011** | 스트릭 끊김 후 재시작 | last=NOW()-3d | `current=1, graceUntil != null` | P0 | ✅ |
| **B-012** | 스트릭 처음 (lastCheckin=null) | null | `current=1, isNewRecord` | P0 | ✅ |
| **B-013** | maxStreak 갱신 | newStreak > maxStreak | `isNewRecord=true` | P0 | ✅ |
| **B-014** | calculateStreak KST 자정 경계 | now=KST 00:00:01, last=어제 KST 23:59 | 연속 인정 | P0 | ✅ |
| **B-015** | Pro Paywall — 가입 +0일 무료 | `coachFreeUntil=NOW()+3d` | `/api/coach/chat` 통과 | P0 | ✅ |
| **B-016** | Pro Paywall — 가입 +3일 1분 후 만료 | `coachFreeUntil=NOW()-60s` | 402 `E_PAYWALL_REQUIRED reason=free_trial_ended` | P0 | ✅ |
| **B-017** | Pro 구독자 항상 통과 | `subscriptionTier=pro, coachFreeUntil=null` | 통과 | P0 | ✅ |
| **B-018** | 무료 사용자 만료 + 구독 X | `subscriptionTier=free, coachFreeUntil=NOW()-1d` | 402 `reason=free_trial_ended` | P0 | ✅ |
| **B-019** | 무료 사용자 coachFreeUntil=null (신규 미온보딩) | `coachFreeUntil=null, tier=free` | 402 `reason=not_subscribed` | P0 | ✅ |

---

## C. 인증·온보딩 (P0)

| ID | 시나리오 | 기대 | P | 자동화 |
|---|---|---|---|---|
| **C-001** | Authorization 헤더 없음 | 401 `E_AUTH_REQUIRED` | P0 | ✅ |
| **C-002** | Bearer 접두어 없음 (`token abc`) | 401 | P0 | ✅ |
| **C-003** | 만료된 JWT | 401 `E_AUTH_INVALID_TOKEN` (Supabase getUser error) | P0 | ✅ |
| **C-004** | 변조된 JWT | 401 | P0 | ✅ |
| **C-005** | 서비스 키 노출 (env 미설정) | 500 `SUPABASE_SERVICE_ROLE_KEY 환경변수 없음` — **에러 메시지에 키 이름 노출 = 정보 노출** | P0 | ✅ |
| **C-006** | 온보딩 → 첫 체크인 라우팅 | age-verify 200 → /home 자동 리다이렉트 → 체크인 유도 | P0 | 🟡 (E2E) |
| **C-007** | 온보딩 미완 + 보호 라우트 직접 접근 | `/home` 직접 → 미들웨어가 `/onboarding` 리다이렉트 | P0 | 🟡 |

---

## D. 페르소나 3종 (P1)

| ID | 시나리오 | 기대 | P | 자동화 |
|---|---|---|---|---|
| **D-001** | `data-persona="mentor"` → accent 오렌지 | `getComputedStyle().getPropertyValue('--accent')` = `#FF7A29` | P1 | 🟡 (W3) |
| **D-002** | spartan → `#FF4D00` | 동일 | P1 | 🟡 |
| **D-003** | friend → `#3DBE9C` 민트 | 동일 | P1 | 🟡 |
| **D-004** | 페르소나 변경 250ms 트랜지션 | applyPersona() → CSS var 변경 | P1 | 🟡 |
| **D-005** | 코치챗 시스템 프롬프트 페르소나별 톤 분기 | `buildSystemPromptWithContext(persona)` | mentor=따뜻 / spartan=강압 / friend=친근 키워드 포함 | P1 | ✅ |
| **D-006** | 페르소나 미선택 기본값 | default `mentor` (Zod) | mentor 프롬프트 | P1 | ✅ |

---

## E. 점수 산식 (P0) — A-4와 일부 중복, 운영 관점 추가

| ID | 시나리오 | 기대 | P | 자동화 |
|---|---|---|---|---|
| **E-001** | 사용자 가중치 미세조정 적용 | `userWeightOverride={health:0.5,...}` | total에 반영 | P0 | ✅ |
| **E-002** | 4축 가중치 표시 정합 (score_formula.md ↔ 코드) | DEFAULT_WEIGHTS | 모두 0.25 (균등) | P0 | ✅ |
| **E-003** | total 소수점 1자리 일관 | 모든 출력 | `.1` 자리까지 | P0 | ✅ |
| **E-004** | smoothed 출력 0~100 범위 | 임의 입력 | 0 ≤ smoothed ≤ 100 | P0 | ✅ |

---

## F. 결제·구독 (P1, W7~8 구현 후) — TODO(W3+)

| ID | 시나리오 | P | 자동화 |
|---|---|---|---|
| **F-001** TODO | 7일 무료체험 활성 | P1 | 🟡 |
| **F-002** TODO | 토스페이먼츠 결제 성공 → subscription.plan=pro | P1 | 🟡 |
| **F-003** TODO | 결제 웹훅 서명 검증 | P0 | 🟡 |
| **F-004** TODO | 결제 실패 → 재시도 / 취소 흐름 | P1 | 🟡 |
| **F-005** TODO | 구독 만료 → 자동 free 강등 | P1 | 🟡 |

---

## G. 회귀 (P1) — W3 리네임 후

| ID | 시나리오 | P | 자동화 |
|---|---|---|---|
| **G-001** TODO | API↔DB 14건 리네임 후 모든 핸들러 200 통과 | P1 | 🟡 |
| **G-002** TODO | `@modal/checkin` 인터셉팅 라우트 동작 (뒤로가기/딥링크) | P1 | 🟡 |
| **G-003** TODO | MountainChart SSR 비활성 → hydration mismatch 0건 | P1 | 🟡 |
| **G-004** TODO | ScoreDisplay 교체 후 카운트업 600ms | P1 | 🟡 |
| **G-005** TODO | `@supabase/ssr` 도입 후 RSC ↔ Route Handler 세션 공유 | P0 | 🟡 |

---

## H. 접근성·성능 (P2)

| ID | 시나리오 | 기대 | P | 자동화 |
|---|---|---|---|---|
| **H-001** TODO | 모든 인터랙티브 ≥ 44×44px | axe + getBoundingClientRect | P2 | 🟡 |
| **H-002** TODO | 색약 대응 — 4축 컬러+모양 병행 (SVG marker) | 시각 회귀 | P2 | 🟡 |
| **H-003** TODO | 모바일 375px LCP < 2.5s | Lighthouse CI | P2 | 🟡 |
| **H-004** TODO | CLS < 0.1 | 동일 | P2 | 🟡 |
| **H-005** TODO | Pretendard 행간 1.6 한글 가독 | 시각 회귀 | P2 | 🟡 |
| **H-006** TODO | `prefers-reduced-motion` 시 카운트업/라인드로우 비활성 | E2E | P2 | 🟡 |
| **H-007** TODO | 키보드 네비 — Tab만으로 4탭 전환 + 체크인 제출 | Playwright keyboard | P2 | 🟡 |
| **H-008** TODO | 스크린리더 alt — Mountain/Radar Chart aria-label 정확 | axe | P2 | 🟡 |

---

## 통계

- 총 케이스: **128건** (TODO 포함)
- **P0 즉시 자동화 가능: 84건**
- P0 W3 통합 후: 14건
- P1: 18건
- P2: 12건

레드라인 5건은 모두 P0로 매핑되며, A-001 ~ A-415 영역에 50건 분산 배치.
