# 오름(Oreum) — 컴포넌트 라이브러리

> W1~W2 셋업 수준. @컴포넌트개발자 작성.
> 페이지개발자(`src/app/` 담당)에게 expose된 API 기준.

---

## 폴더 구조

```
src/components/
├── README.md                  ← 이 파일
├── tokens/
│   ├── colors.ts              ← 컬러 토큰 (primary, accent, 4축, persona)
│   ├── typography.ts          ← Pretendard 타이포 스케일
│   ├── motion.ts              ← easing/duration + Framer Motion variants
│   └── persona.ts             ← 3종 페르소나 config + applyPersona()
└── ui/
    ├── button.tsx             ← P0 핵심 — 4 variant × 3 size
    ├── score-display.tsx      ← P0 시그니처 — 카운트업 + 4축 미니 막대
    ├── mountain-chart.tsx     ← P0 시그니처 — SVG 산 능선 라인 드로우
    ├── streak-indicator.tsx   ← P0 — 7일 도트 + 재시작 보너스
    ├── checkin-slider.tsx     ← P0 — 4축 슬라이더 (CheckinSliderGroup 포함)
    ├── coach-bubble.tsx       ← P1 stub — 코치챗 말풍선
    ├── persona-selector.tsx   ← P1 stub — 페르소나 3종 토글
    ├── empty-state.tsx        ← P1 stub — Empty/Error state
    ├── bottom-sheet.tsx       ← P1 stub — 바텀시트 (드래그 TODO)
    └── paywall-card.tsx       ← P1 stub — Pro 결제 카드 (Q5-B)
```

---

## 공유 영역 파일 (페이지개발자 참조)

| 파일 | 설명 |
|------|------|
| `package.json` | 의존성 목록 |
| `tailwind.config.ts` | 디자인 토큰 → Tailwind 확장 |
| `src/styles/globals.css` | Pretendard import, base reset, 페르소나 CSS 변수 |
| `src/lib/utils.ts` | `cn()` 헬퍼 |

---

## 토큰 사용법

```ts
import { colors, axisColors, type AxisKey } from "@/components/tokens/colors";
import { motion, variants }                  from "@/components/tokens/motion";
import { personaConfig, applyPersona }       from "@/components/tokens/persona";

// 예시: 건강 축 컬러
const healthColor = colors.health[500]; // "#2E9E55"

// 예시: 페르소나 전환 (페이지개발자가 Zustand store에서 호출)
applyPersona("sparta"); // <html data-persona="sparta"> 교체 → 250ms CSS 전환

// 예시: Framer Motion variant 적용
import { motion as fm } from "framer-motion";
<fm.div variants={variants.toast} initial="hidden" animate="visible" exit="exit" />
```

---

## 노출 컴포넌트 API (페이지개발자용 5개)

### 1. Button

```tsx
import { Button } from "@/components/ui/button";

<Button variant="primary" | "secondary" | "ghost" | "destructive"
        size="sm" | "md" | "lg"
        loading={boolean}
        asChild={boolean}
        disabled={boolean}>
  텍스트
</Button>
```

### 2. ScoreDisplay

```tsx
import { ScoreDisplay } from "@/components/ui/score-display";
import type { AxisScore } from "@/components/ui/score-display";

<ScoreDisplay
  score={number}            // 0~100 총점
  delta={number | undefined} // 변화량 (양수=상승, 음수=하락)
  axes={AxisScore[]}        // 4축 미니 막대
  skipAnimation={boolean}   // 카운트업 비활성
/>
```

### 3. MountainChart

```tsx
import { MountainChart } from "@/components/ui/mountain-chart";
import type { ChartSeries } from "@/components/ui/mountain-chart";

<MountainChart
  series={ChartSeries[]}             // 시리즈 배열
  activeAxes={Array<AxisKey | "total">} // 활성 축 필터
  height={number}                    // 차트 높이 px
  skipAnimation={boolean}
  gridLines={number}
/>
```

### 4. StreakIndicator

```tsx
import { StreakIndicator } from "@/components/ui/streak-indicator";
import type { StreakDay } from "@/components/ui/streak-indicator";

<StreakIndicator
  streakCount={number}   // 연속 일수
  days={StreakDay[]}     // 7일 도트 데이터
  graceActive={boolean}  // 24h grace period 활성
  isRestart={boolean}    // 재시작 보너스 표시 (끊김 후)
  restartBonus={number}  // 보너스 점수 (기본 5)
/>
```

### 5. CheckinSlider / CheckinSliderGroup

```tsx
import { CheckinSlider, CheckinSliderGroup } from "@/components/ui/checkin-slider";
import type { CheckinFormValues } from "@/components/ui/checkin-slider";

// 단일 슬라이더
<CheckinSlider
  axis="health" | "learn" | "relate" | "achieve"
  label="건강"
  value={number}
  onValueChange={(v: number) => void}
  disabled={boolean}
/>

// 4축 그룹 (Home 체크인 화면 권장)
<CheckinSliderGroup
  values={{ health: 75, learn: 60, relate: 80, achieve: 70 }}
  onValueChange={(axis, value) => void}
  disabled={boolean}
/>
```

---

## 레드라인 (전 컴포넌트 공통)

```
// REDLINE: 외모/체형 비교 UI 금지. 타인 점수 노출 금지.
```

- 리더보드·랭킹 컴포넌트 없음
- E_AGE_BLOCKED: CTA 없음, 앱 종료 유도 (EmptyState code="E_AGE_BLOCKED")
- 스트릭 끊겨도 부정 메시지 없음 — isRestart=true 시 재시작 보너스 자동 전환

---

## 페이지개발자 TODO 목록

| 컴포넌트 | 연결 필요 사항 |
|----------|----------------|
| `PersonaSelector` | Zustand personaStore + applyPersona() |
| `CoachBubble` | SSE 스트리밍 (POST /api/coach/chat) |
| `EmptyState` | Next.js 라우터 연결 (onAction) |
| `BottomSheet` | 드래그 다운 제스처, body scroll lock |
| `PaywallCard` | 토스페이먼츠 결제 플로우 (onSubscribe) |
| `ScoreDisplay` | TanStack Query — 점수 API 응답 연결 |
| `MountainChart` | TanStack Query — 추이 데이터 API 연결 |
| `StreakIndicator` | 백엔드 grace period 상태 연동 |

---

## 접근성 체크리스트

- [x] 모든 인터랙티브 요소 `min-h-[44px]` 터치 타겟
- [x] `:focus-visible` accent-500 3px ring
- [x] 4축 컬러 + 모양 기호 + 텍스트 레이블 3중 표기
- [x] `prefers-reduced-motion` 시 카운트업/라인드로우 비활성
- [x] `aria-label`, `role`, `aria-live` 적용
- [x] `tabular-nums` 전역 숫자 적용
