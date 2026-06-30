# 오름(Oreum) — 프론트엔드 아키텍처 최종안 (W1~W2)

> 작성: @프론트팀장 (Opus) · 2026-05-14
> 기반: `docs/planning/project-direction.md`, `oreum-plan.md`, `docs/design/design-final.md`
> 산출물 합본: @컴포넌트개발자 (`src/components/`) + @페이지개발자 (`src/app/`, `src/lib/`)

---

## 1. 프로젝트 구조 (실측)

```
team_makes/
├── package.json · tailwind.config.ts · tsconfig.json (strict + @/* alias)
├── src/
│   ├── app/
│   │   ├── layout.tsx · providers.tsx · page.tsx · globals.css · manifest.ts
│   │   ├── (auth)/      layout · login · onboarding
│   │   ├── (app)/       layout · home · graph · coach · mission
│   │   ├── paywall/     page.tsx (풀스크린, 4탭 외부)
│   │   └── api/         checkin · score · coach · mission · goal · me · onboarding · health · paywall
│   ├── components/
│   │   ├── tokens/      colors · typography · motion · persona
│   │   └── ui/          button · score-display · mountain-chart · streak-indicator
│   │                    checkin-slider · coach-bubble · persona-selector
│   │                    empty-state · bottom-sheet · paywall-card
│   ├── lib/
│   │   ├── api/         client · checkin · score · coach (TanStack Query)
│   │   ├── store/       auth · checkin · persona (Zustand)
│   │   ├── server/      score-engine · ai-budget · coach-prompts · paywall
│   │   │                rate-limit · auth · errors · redline
│   │   ├── auth/guard.ts · paywall/gate.ts · shared/schemas.ts · utils.ts
│   └── styles/          (Pretendard, base reset, persona CSS vars)
└── api/  (백엔드팀 영역 — db · prisma)
```

## 2. 의존성 표

| 패키지 | 버전 | 용도 |
|---|---|---|
| next | 14.2.3 | App Router, RSC, API Routes |
| react / react-dom | 18.3.1 | - |
| zustand | 4.5.2 | 클라 상태 (auth/checkin/persona) |
| @tanstack/react-query | 5.40.0 | 서버 상태 캐싱 |
| framer-motion | 11.2.10 | 카운트업·라인드로우·variants |
| @radix-ui/react-slider | 1.1.2 | CheckinSlider 기반 |
| @radix-ui/react-{slot,dialog,switch,checkbox} | - | Button asChild, BottomSheet 등 |
| class-variance-authority + clsx + tailwind-merge | - | `cn()` 헬퍼 + variant API |
| lucide-react | 0.381 | 아이콘 |
| zod | 3.23 | shared 스키마 검증 |
| @supabase/supabase-js | 2.43 | 인증·세션 |
| tailwindcss | 3.4 | 디자인 토큰 확장 |

**누락 검증**: 요청서 8종 전부 포함. **@supabase/ssr 미설치** — 결정 F-P2에 따라 W3 첫 작업으로 추가.

## 3. 컴포넌트 5개 시그니처 ↔ 페이지 사용처

| 컴포넌트 | export | 페이지 사용 (W1~W2 실측) |
|---|---|---|
| `Button` | `<Button variant size loading asChild>` | home·graph·coach·mission·paywall·login·onboarding 7곳 임포트 ✅ |
| `ScoreDisplay` | `{ score, delta, axes, skipAnimation }` | 미사용 (홈은 자체 `ScoreCard`+`AxisMiniBars`로 mock 폴백 골격) — **W3 통합** |
| `MountainChart` | `{ series, activeAxes, height, gridLines }` | 미사용 (graph는 자체 `MountainLineChart` 스텁) — **W5+ 정교화** |
| `StreakIndicator` | `{ streakCount, days, graceActive, isRestart, restartBonus }` | 미사용 (홈은 `StreakBadge` 인라인) — **W3 통합** |
| `CheckinSlider` / `Group` | `{ values, onValueChange }` | 미사용 — **W3 체크인 오버레이에서 첫 통합** |

## 4. 라우트 맵

| Path | 인증 | 그룹 | 데이터 |
|---|---|---|---|
| `/` | - | root | → /home 리다이렉트 |
| `/login` | X | (auth) | Supabase Auth |
| `/onboarding` | O | (auth) | POST /api/onboarding/age-verify (16세 미만 차단) |
| `/home` `/graph` `/coach` `/mission` | O | (app) 4탭 | TanStack Query |
| `/paywall` | O | 풀스크린 | POST /api/paywall (토스페이먼츠) |
| `/api/health` | X | API Route | 헬스체크 |

## 5. 상태 관리 흐름

| Store | persist | 책임 |
|---|---|---|
| `useAuthStore` | localStorage (user, onboardingDone, accessToken) | 세션, 게이트 판정 |
| `useCheckinStore` | 메모리 | 슬라이더 임시값, 오늘 완료 여부 |
| `usePersonaStore` | localStorage (selected) | mentor/spartan/friend + `applyPersona()` |

서버 상태는 TanStack Query (`["score","today"]` 60s · `["score","history",p]` 60s · `["mission","today"]` 60s · `["user","me"]` 60s). 낙관적 업데이트는 체크인 mutation에서 W3 도입.

## 6. API 클라이언트 ↔ 백엔드 매핑

| 프론트 함수 | 메서드 | 백엔드 핸들러 | Query Key |
|---|---|---|---|
| `fetchScoreToday()` | GET /api/score/today | api/score/today/route | ["score","today"] |
| `fetchScoreHistory(p)` | GET /api/score/history?period= | api/score/history/route | ["score","history",p] |
| `submitCheckin(b)` | POST /api/checkin | api/checkin/route + score-engine | invalidate score |
| `fetchMissionToday()` | GET /api/mission/today | api/mission/today/route | ["mission","today"] |
| `streamCoach(msg)` | POST /api/coach/chat (SSE) | coach-prompts + ai-budget | - |

화이트리스트는 `src/lib/api/client.ts`에서 정규식 매칭. `leaderboard`·`ranking`·`compare`·`average-all`·`peer` 어떤 패턴도 통과 불가 → `E_REDLINE_REJECT` 422.

## 7. 인증·온보딩·Paywall 게이트

```
앱 진입
  ├─ Supabase 세션 X → /login
  └─ 세션 O
       ├─ onboardingDone=false → /onboarding
       │     Step1 생년월일 → 만 16세 미만 → E_AGE_BLOCKED (CTA 없음, 종료 유도)
       │     Step2 북극성 → Step3 90일 목표 → Step4 페르소나
       └─ /home (4탭)
              └─ /coach 진입 시
                    Pro → 통과
                    Free (가입 ≤3일, coachFreeUntil 유효) → 통과 + 카운터
                    Free 만료 → /paywall (reason=free_trial_ended)
```

서버 재검증: `POST /api/coach/chat` 진입 시 `lib/server/paywall.ts`가 이중 체크 — 클라 게이트 위회 차단.

## 8. 팀장 자체 확정 결정 (4건)

| ID | 결정 | 근거 |
|---|---|---|
| **F-C1** MountainChart SSR | `next/dynamic` + `{ ssr: false }` 래핑 | 산 능선 라인은 viewport 측정 의존. SSR 시 hydration mismatch + LCP 무의미. 클라전용 + Suspense fallback이 표준. |
| **F-C2** Slider 터치 타겟 | Radix Slider 기본 thumb + **`::after` 가상요소 히트영역 확장** (44×44px) | 음수 마진은 iOS에서 트랙 클릭 충돌. thumbSize prop은 Radix ARIA semantics 깨짐. ::after는 시각 thumb 크기 유지+히트만 확장으로 WCAG 2.5.5 충족. |
| **F-P1** 체크인 오버레이 | `@modal` 인터셉팅 라우트 (`src/app/(app)/@modal/checkin/page.tsx` + `(.)checkin`) | 딥링크 가능, 모바일 뒤로가기 자연스러움, UX 스펙 "풀스크린 오버레이" 충족. RSC 친화. |
| **F-P2** Supabase 클라이언트 | **`@supabase/ssr` 채택** + `createBrowserClient` / `createServerClient` 분리. `src/lib/supabase/client.ts` + `server.ts` 두 파일. 쿠키 기반 세션. | App Router + RSC + Route Handler 모두에서 동일 세션 공유. 기존 `@supabase/supabase-js` 단일 클라는 RSC에서 쿠키 접근 불가. |

## 9. W3~W4 마일스톤 — 코어 루프 완성

1. **@supabase/ssr 도입** (F-P2) — `client.ts` / `server.ts` 분리, 미들웨어 세션 갱신
2. **체크인 오버레이** (F-P1) — `@modal/checkin/page.tsx` + `CheckinSliderGroup` 통합 + POST /api/checkin
3. **홈 통합** — `ScoreCard` → `ScoreDisplay` 교체, `StreakBadge` → `StreakIndicator` 교체
4. **점수 무효화** — 체크인 mutation 후 `["score","today"]` invalidate + 카운트업
5. **미션 수락/완료 mutation** — POST /api/mission 응답 → ScoreDisplay delta 갱신
6. **온보딩 → 홈 첫 체크인 유도** 자동 라우팅
7. 성능 예산 측정: LCP 2.5s · CLS 0.1 · 모바일 번들 < 180KB gzip

## 10. 백엔드팀장 합의 잔여 사항

| 항목 | 요청 |
|---|---|
| 응답 envelope | 모든 핸들러 `{ success: true, data }` / `{ success: false, error: {code,message,details} }` 통일 확정 |
| `delta` 스키마 | `/api/score/today` 응답에 `delta.total + delta.{health,learn,relate,achieve}` 모두 포함 합의 |
| SSE 포맷 | `/api/coach/chat` 이벤트 `data:` JSON 라인 + `event: redline_reject` 종료 케이스 정의 |
| Paywall 이중 검증 | `coachFreeUntil` 필드를 `/api/me` 응답에 포함 (클라 게이트 + 서버 게이트 동일 소스) |
| 쿠키 도메인 | `@supabase/ssr` 도입 시 쿠키 이름·도메인·sameSite 백엔드와 동기화 |

## 11. 코드 검수 결과

- ✅ 페이지 7곳 모두 `@/components/ui/button`을 동일 경로로 import (alias 일관)
- ✅ REDLINE 주석: 컴포넌트 10/10 · 페이지 8/8 · lib 11곳 (총 45 파일) 모두 보유
- ✅ TypeScript strict, `any` 0건, `@/*` alias 일관
- ⚠️ ScoreDisplay/MountainChart/StreakIndicator/CheckinSlider 4종은 페이지에서 **미통합** 상태 (홈/그래프가 인라인 mock 골격). W1~W2 스코프 내 의도된 분리이며, **W3 통합을 차단 이슈 1순위로 등재**.
- ⚠️ `@supabase/ssr` 미설치 (F-P2 결정대로 W3 첫 작업)

---

🎯 **사장 결정 필요 사항**: 없음 (4건 모두 팀장 권한 확정)
