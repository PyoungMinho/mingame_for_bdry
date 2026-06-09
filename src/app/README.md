# 오름(Oreum) — App Router 라우트 맵

> 작성: @페이지개발자 — W1~W2 셋업 기준
> 기반 문서: design-final.md / ux-spec.md / project-direction.md

---

## 라우트 맵

| Path | 페이지 | 인증 필요 | 레이아웃 | 데이터 소스 |
|---|---|---|---|---|
| `/` | 루트 리다이렉트 | - | root | → /home |
| `/login` | 로그인 | X | (auth) | Supabase Auth |
| `/onboarding` | 4스텝 온보딩 | O (로그인 후) | (auth) | POST /api/onboarding/age-verify |
| `/home` | 홈 (체크인+점수+미션) | O | (app) 4탭 | GET /api/score/today |
| `/graph` | 성장 그래프 | O | (app) 4탭 | GET /api/score/history |
| `/coach` | AI 코치챗 | O + Pro 게이트 | (app) 4탭 | POST /api/coach/chat (SSE) |
| `/mission` | 미션 & 90일 목표 | O | (app) 4탭 | GET /api/mission/today |
| `/paywall` | Pro 결제 | O | 풀스크린 | POST /api/paywall |
| `/api/health` | 헬스체크 | X | API Route | - |

---

## 인증 흐름

```
앱 진입
 │
 ├─ 미인증 → /login (소셜/이메일)
 │
 └─ 인증 완료
     │
     ├─ 온보딩 미완료 → /onboarding
     │   ├─ Step 1: 생년월일 확인
     │   │   └─ 만 16세 미만 → 차단 화면 (E_AGE_BLOCKED, CTA 없음)
     │   ├─ Step 2: 북극성 다짐
     │   ├─ Step 3: 90일 목표
     │   └─ Step 4: 페르소나 선택 (mentor / spartan / friend)
     │
     └─ 온보딩 완료 → /home (4탭 루프)
```

---

## Pro Paywall 게이트 동작 방식 (Q5=B)

```
/coach 진입
 │
 ├─ Pro 구독자 → 코치챗 바로 접근
 │
 └─ Free 유저
     │
     ├─ 가입 후 3일 이내 (coachFreeUntil 유효) → 코치챗 접근 + 무료 카운터 UI
     │
     └─ 가입 후 3일 초과 → /paywall 리다이렉트
         reason: "free_trial_ended" | "not_subscribed"
```

**구현 위치:**
- `src/lib/paywall/gate.ts` — `checkCoachAccess(user)` 함수
- `src/app/(app)/coach/page.tsx` — 진입 시 게이트 실행
- 서버 재검증: `POST /api/coach/chat` → 백엔드 `lib/server/paywall.ts`

---

## 상태 관리 구조

| 스토어 | 파일 | persist | 용도 |
|---|---|---|---|
| `useAuthStore` | `lib/store/auth.ts` | O (user, onboardingDone) | 인증 유저, 세션, 온보딩 완료 여부 |
| `useCheckinStore` | `lib/store/checkin.ts` | X (메모리) | 체크인 슬라이더 임시값, 오늘 완료 여부 |
| `usePersonaStore` | `lib/store/persona.ts` | O (selected) | 선택된 페르소나 (mentor/spartan/friend) |

---

## API 클라이언트 화이트리스트 (레드라인)

`src/lib/api/client.ts`에 허용된 API 경로 패턴 하드코딩.
아래 패턴에 매칭되지 않는 요청은 `E_REDLINE_REJECT`로 차단.

```
허용: /api/checkin, /api/score/today, /api/score/history
      /api/coach/chat, /api/mission, /api/goal
      /api/me, /api/onboarding, /api/health, /api/paywall
차단: /api/leaderboard, /api/ranking, /api/compare, /api/average-all, /api/peer
```

---

## TanStack Query Key 규칙

| Query Key | 엔드포인트 | 캐시 staleTime |
|---|---|---|
| `["score", "today"]` | GET /api/score/today | 60초 |
| `["score", "history", period]` | GET /api/score/history?period=7\|30\|90 | 60초 |
| `["mission", "today"]` | GET /api/mission/today | 60초 |
| `["user", "me"]` | GET /api/me | 60초 |

---

## 레드라인 강제 사항

- 모든 페이지 상단 주석: `// REDLINE: 타인 비교/외모 점수 UI 금지`
- 그래프 페이지: 본인 과거치만 표시. 비교 API 패치 client.ts 화이트리스트로 차단.
- 만 16세 미만: 온보딩 Step 1 즉시 차단 + `/api/onboarding/age-verify` 서버 이중 검증.
- 코치챗 에러코드 `E_REDLINE_REJECT` 수신 시: "오름은 외모가 아닌 성장에 집중합니다" 메시지 표시.
