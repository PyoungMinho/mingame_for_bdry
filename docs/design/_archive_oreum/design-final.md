# AI 모델 비교 대시보드 — 최종 디자인 스펙 (Design Final)

> 확정: @디자인팀장 (Opus) — UX+UI 종합
> 일자: 2026-05-28
> 입력: `docs/design/ux-spec.md` + `docs/design/ui-spec.md` + `docs/planning/project-direction.md`
> 코드네임(임시): **Benchly** (디자인팀장 추천, 사장 최종 결정 대기)

---

## 0. 프로젝트 디자인 비전

"신뢰할 수 있는 데이터를, 한눈에 비교할 수 있게."
**Linear의 절제된 다크 인터페이스 위에 op.gg의 즉각적 수치 시각화**를 얹는다. 화려한 비주얼이 아닌 **수치의 가독성·출처의 투명성·비교의 속도**를 디자인 언어의 1순위로 둔다. 모든 모션은 보조이며, 데이터가 주인공이다. 다크 우선(Default Dark)이며, 글로벌-한국 동시 서비스를 위해 Inter+Pretendard 듀얼 타이포 시스템을 유지한다. 무로그인·정적 사이트 특성에 맞춰 첫 페인트 5초 이내 핵심 수치가 눈에 들어와야 한다.

---

## 1. 확정된 디자인 결정 (충돌 없음)

UX·UI 양쪽이 동일하게 결정한 항목 — 그대로 채택.

| 영역 | 결정 |
|---|---|
| 플랫폼 기준 | 데스크톱 1280px / 모바일 375px, 최대 콘텐츠 폭 1200px |
| 다크모드 | 디폴트 다크 + OS 감지 + 수동 토글 (localStorage 우선) |
| Primary Accent | `#7C5CFF` 바이올렛 단일 액센트 (Linear 계열 계승) |
| 메트릭 4색 언어 | 가격↓ `#22C55E` / 가격↑ `#EF4444` / 속도 `#38BDF8` / 품질 `#F59E0B` |
| 컨텍스트 보조색 | `#A78BFA` 라벤더 |
| 베이스 다크 | `#0A0A0F` near-black + 노이즈 텍스처 opacity 0.04 |
| 폰트 | Inter(en) / Pretendard Variable(ko) / JetBrains Mono(수치) |
| 모델 아이덴티티 | ModelChip — 텍스트 이니셜 + 제공자별 고정 색상 (저작권 안전) |
| URL 정규화 | `/[locale]/compare/[pair]` 알파벳 오름차순 + `_vs_` 구분자, 순서 틀리면 301 |
| 출처 신뢰도 | T1(●)/T2(○)/T3(△) 3단계, 기호+텍스트 병행 (색상만 사용 금지) |
| 신선도 경고 | 0~7일 정상 / 8~30일 옐로우 / 31일+ 오렌지 + 갱신 필요 툴팁 |
| 광고 슬롯 | 6종 위치 예약 (HTML 주석 + `min-height` 레이아웃 시프트 방지), MVP 콘텐츠 없음 |
| 접근성 | WCAG 2.1 AA, 색 대비 4.5:1, prefers-reduced-motion 대응 필수 |
| 위저드 가중치 공개 | 결과 화면 하단에 "벤치마크 40% + 가격효율 40% + 컨텍스트 10% + 다국어 10%" 노출 |
| 면책 고지 | "공개 출처 인용, 직접 측정 아님" 모든 상세/비교 페이지 하단 |

---

## 2. 충돌 해소 — 팀장 판정

UX와 UI가 다르게 말했거나 모호한 지점에 대한 최종 판정.

### C1. 위저드 단계 수 — **3단계 + 결과(=4화면)** 로 확정
- UX: 3단계 (직무→작업→예산)
- UI: WizardStep 컴포넌트 "2/5 단계" 예시 표기
- **판정**: UX의 3단계가 매트릭스(섹션 5)와 정합. UI의 WizardStep 컴포넌트는 **점 4개(직무·작업·예산·결과)** 로 수정. 5개가 아님.

### C2. 비교 페이지 매트릭스 우위 표시 — **★ 기호 + 메트릭 컬러 텍스트 + Accent Subtle 배경 3중**
- UX: ★ + 굵은 글씨 (색상 단독 금지)
- UI: 메트릭 컬러 텍스트 + `--color-accent-subtle` 배경
- **판정**: 3중 표현(★ 기호 + 메트릭 컬러 텍스트 + `--color-accent-subtle` 배경) 모두 적용. 가격은 `--color-metric-price-low`, 그 외는 해당 메트릭 컬러. a11y 충돌 없음.

### C3. 모바일 비교 페이지 UX — **세로 스택 + scroll-snap-x mandatory** 채택
- UX: 가로 스크롤 + 좌측 항목 열 sticky
- UI: 세로 스택 모델 카드 + 스와이프 스냅
- **판정**: UI의 세로 스택 + 스냅 채택 (op.gg 모바일 패턴 정합). 단, 데스크톱(768px+)에서는 UX 안의 sticky-left 컬럼 유지. 즉 **브레이크포인트별 다른 패턴** 운영.

### C4. ModelChip 이니셜 규칙 — **알파벳 1글자(고정), Mistral도 "M"**
- UI 표에 Mistral만 "Mi" 2글자 → 다른 제공자(Meta=M, Mistral=Mi)와 형식 불일치
- **판정**: 이니셜은 1글자 통일. **Meta 충돌은 색상으로 구분**.
  - Meta: 배경 `#1D4ED8` 블루 + "M"
  - Mistral: 배경 `#8B5CF6` 바이올렛 + "M"
  - 시각 인지는 배경색이 1차, 글자가 2차. ModelChip 호버 시 풀네임 툴팁 필수.

### C5. 광고 슬롯 사이드바 크기 — **300×250 (UX 안 채택)**
- UX: `AD_SLOT_MODEL_DETAIL_SIDEBAR` 300×250
- UI §8: 사이드바 네이티브 240×200
- **판정**: UX의 300×250 (IAB 표준 Medium Rectangle) 채택. 표준 광고 인벤토리와 정합. UI §8 수정.

### C6. 홈 진입 시 위저드 노출 방식 — **보조 CTA로 명시**
- UX: "또는 [어떤 AI가 맞을까? 3가지 질문으로 찾기 →]" 보조 버튼
- UI: 위저드 CTA 비주얼 미정의
- **판정**: Hero 검색창이 Primary CTA. 위저드는 Hero 하단 **Secondary 버튼**(테두리 1px `--color-border-strong`, 배경 transparent, 텍스트 `--color-text-secondary`). 마케터(P2)에게도 보이되 개발자(P1) 동선을 방해하지 않음.

### C7. 위저드 직무 아이콘 — **MVP: 이모지 / W5에 SVG 5종 교체**
- UX: 텍스트 이모지(임시)
- UI: 커스텀 SVG 권장
- **판정**: MVP는 이모지로 출시(W1 핸드오프 부담 경감), 이후 W5 i18n 작업과 함께 커스텀 SVG 5종(개발자/마케터/디자이너/학생/기타) 교체. 일정 보호 우선.

### C8. Changelog 비주얼 — **홈은 단순 리스트 / 모델 상세는 ChangelogItem 카드**
- UX: 홈 하단 단순 리스트
- UI: ChangelogItem 카드 (좌측 상태원 + 우측 날짜)
- **판정**: **위치별 분리**. 홈은 텍스트 리스트(밀도 우선), 모델 상세 페이지는 카드(시각 계층 우선).

---

## 3. 컴포넌트 라이브러리 — 구현 우선순위

총 18개. shadcn 기반 + 커스텀.

### Tier 1 (W1 핸드오프 즉시 — 5일 내 구현 가능해야 함)

| # | 컴포넌트 | 출처 | 비고 |
|---|---|---|---|
| 1 | `Button` (Primary/Secondary/Ghost/Danger × sm/md/lg) | shadcn 확장 | UI §3-1 그대로 |
| 2 | `Badge` (provider/score-high/mid/low/status 3종) | shadcn 확장 | UI §3-2 |
| 3 | `ModelChip` | 커스텀 | UI §3-3 + C4 판정 반영 |
| 4 | `MetricCard` | 커스텀 | UI §3-4 + ScoreBar 내장 |
| 5 | `SourceBadge` (= UI의 `SourceMeta`) | 커스텀 | UI §3-7, 이름 통일 |
| 6 | `CompareTable` | 커스텀 | UI §3-5 + C3 반응형 분기 |
| 7 | `Header` / `Footer` 글로벌 내비 | 커스텀 | UX §3 |
| 8 | `SearchInput` (헤더 전역 + 홈 Hero) | shadcn 확장 | 자동완성 드롭다운 포함 |

### Tier 2 (W2~W4 화면 구현 시 추가)

| # | 컴포넌트 | 비고 |
|---|---|---|
| 9 | `LeaderboardRow` | UX §10, 순위 + ModelChip + 점수 + 변동 + [+] 버튼 |
| 10 | `WizardStep` | UI §3-9, C1 판정 — 점 4개 |
| 11 | `WizardCard` (직무·작업 선택) | 비활성 셀 opacity 0.4 + 툴팁 |
| 12 | `MetricRadar` | UI §3-6, Recharts 기반 5축 |
| 13 | `ChangelogItem` | UI §3-10, 모델 상세 전용 |
| 14 | `ShareCTA` | UX §10, 트위터+링크복사+OG 미리보기 |
| 15 | `ShareCard` (OG 미리보기) | UI §3-8 |
| 16 | `AdSlot` | UX §7, MVP는 빈 컨테이너 |

### Tier 3 (W4~W5)

| # | 컴포넌트 | 비고 |
|---|---|---|
| 17 | `LocaleToggle` (EN/KO) | next-intl 기반 |
| 18 | `ThemeToggle` (다크/라이트) | UI §7 |

---

## 4. 화면별 최종 스펙

### 화면 1. 홈 (`/[locale]/`)

레이아웃은 UX §4의 와이어프레임을 채택. 비주얼은 UI 토큰 적용. 추가 확정사항:

- Hero 영역 높이: 데스크톱 480px / 모바일 360px
- Hero 배경: `--color-bg-base` + 좌상단 radial-gradient `rgba(124,92,255,0.08)` 글로우
- Hero 타이틀: `text-display` (48px/700/-0.03em), `--color-text-primary`
- Hero 서브카피: `text-body-l`, `--color-text-secondary`
- Primary CTA: SearchInput (사이즈 lg, 너비 720px max, autofocus 없음 — a11y)
- Secondary CTA: 위저드 진입 Ghost 버튼(C6 판정)
- 인기 비교 페어 카드: 가로 4개 / 모바일 가로 스크롤 snap
- 카테고리 Top: 3컬럼 / 모바일 1컬럼 스택
- Changelog 리스트: 최근 5건, 텍스트만 (C8)

### 화면 2. 모델 상세 (`/[locale]/models/[slug]`)

- EntityHero: 12컬럼 풀폭, 높이 240px
  - 좌측: ModelChip(64px 대형) + 모델명 `text-h1` + 제공자/출시일 `text-body-m`
  - 우측: 3 MetricCard 인라인 그리드 (Context / 입력가 / 출력가)
  - 하단: [+ 비교에 추가] Primary lg + [공유] Ghost md
- 벤치마크 테이블: 각 행 우측 SourceBadge 의무
- MetricRadar: 우측 사이드바 320×320 (데스크톱 1024px+), 모바일 풀폭
- 자주 비교되는 모델: ModelChip 가로 나열, 클릭 시 `/compare/[pair]` 알파벳 정렬 자동 생성
- 사이드바 AD_SLOT_MODEL_DETAIL_SIDEBAR: 300×250 (C5)
- 면책 고지: 페이지 하단 `text-body-s` `--color-text-muted`

### 화면 3. 비교 페이지 (`/[locale]/compare/[pair]`)

- 페이지 타이틀: `text-h1`, 모델 ModelChip 인라인 ("[O] GPT-4o vs [A] Claude 3.5 Sonnet")
- 모델 추가: 우측 상단 Secondary 버튼, 최대 4개 enforced
- CompareTable: C2 우위 3중 표현 + C3 반응형 분기
- 항목별 상세 탭(코딩/추론/창작/가격): shadcn Tabs, MetricRadar 동반
- 공유 CTA: 페이지 하단 ShareCTA 컴포넌트, OG 카드 미리보기(600×315 축소판)
- pair URL 입력 잘못 시: 서버에서 알파벳 정렬 후 301 리다이렉트(미들웨어)

### 화면 4. 위저드 (`/[locale]/find`)

- 진행 표시기: WizardStep 점 **4개** (C1)
- 1단계 카드 5개 (직무): 2행 × 3열 / 3+2 그리드, 카드 사이즈 200×140
- 2단계 카드 6개 (작업): 매트릭스(UX §5) 비활성 셀 opacity 0.4 + "추천 데이터 부족" 툴팁
- 3단계 카드 4개 (예산): 가로 1행
- 결과: Top 3 모델 카드 + 추천 이유 1줄 + ShareCTA + 가중치 공개 라인
- URL 쿼리스트링 동기화 (`?job=...&task=...&budget=...`), 공유 가능
- AD_SLOT_WIZARD_RESULT: 결과 Top 3 아래 300×250

### 화면 5. 리더보드 (`/[locale]/leaderboard/[metric]`)

- 카테고리 탭: 6종 (종합/코딩/추론/창작/이미지/가격효율) shadcn Tabs
- 페이지 헤더 하단: "출처 + 신뢰도 + 갱신일" 1줄 SourceBadge
- 테이블: LeaderboardRow 컴포넌트, 호버 시 `--color-bg-elevated`
- 변동 표기: ▲N(green) / ▼N(red) / ─(muted) / NEW(accent badge)
- [+] 클릭 누적: 페이지 우상단 fixed 비교 카트 표시 (n/4)
- AD_SLOT_LEADERBOARD_RIGHT: 우측 300×600 (데스크톱 1024px+)

### 화면 6. 관리자 (`/[locale]/admin`)

- Supabase Auth 단일 관리자(사장)
- 좌측 사이드바 240px + 우측 폼 영역
- 폼 컴포넌트: shadcn 기본 Input/Select/DatePicker
- 필수 필드: aria-required + 시각적 `*` 병행
- noindex meta + robots.txt 차단
- "저장 후 Changelog 자동 생성" 체크박스 디폴트 ON

---

## 5. OG 카드 3종 최종 스펙

UI §4 그대로 채택 + 다음 보강.

### 공통 확정
- 1200×630 / `@vercel/og` ImageResponse
- 배경 `#0A0A0F` 고정 (라이트모드 사용자에게도 다크로 일관성)
- 폰트 임베드: Inter 700/600/400 + JetBrains Mono 600/500 (font subset), 한글 텍스트는 Pretendard로 fallback
- 하단 4px `#7C5CFF` 바
- 우상단 도메인/날짜

### 카드별 핵심
1. **Compare OG**: 모델 2개(2-vs-2 슬롯 고정, 3+는 "+1 more" 텍스트), 3개 핵심 메트릭 비교 (가격/컨텍스트/속도 또는 품질)
2. **Wizard Result OG**: 용도 요약 1줄 + Top 3 (순위 번호 accent / 점수 quality)
3. **Model Detail OG**: 모델명 52px + 4개 메트릭 인라인 + 출처 검증 줄

---

## 6. 프론트엔드팀 핸드오프 문서

### 6-1. CSS 변수 (`src/styles/tokens.css` — 단일 파일 통합)

```css
:root, [data-theme="dark"] {
  /* === Accent === */
  --color-accent: #7C5CFF;
  --color-accent-muted: #4D3BB3;
  --color-accent-subtle: rgba(124, 92, 255, 0.12);
  --color-accent-glow: rgba(124, 92, 255, 0.30);

  /* === Metric (4 + 1 보조) === */
  --color-metric-price-low: #22C55E;
  --color-metric-price-high: #EF4444;
  --color-metric-speed: #38BDF8;
  --color-metric-quality: #F59E0B;
  --color-metric-context: #A78BFA;

  /* === Semantic === */
  --color-success: #16A34A;
  --color-warning: #D97706;
  --color-error: #DC2626;
  --color-info: #0EA5E9;

  /* === Surface === */
  --color-bg-base: #0A0A0F;
  --color-bg-subtle: #111118;
  --color-bg-surface: #16161F;
  --color-bg-elevated: #1E1E2A;
  --color-bg-overlay: rgba(0, 0, 0, 0.72);

  /* === Border === */
  --color-border: rgba(255, 255, 255, 0.08);
  --color-border-strong: rgba(255, 255, 255, 0.16);
  --color-border-focus: rgba(124, 92, 255, 0.60);

  /* === Text === */
  --color-text-primary: #F0F0F8;
  --color-text-secondary: #9090A8;
  --color-text-muted: #5A5A72;
  --color-text-disabled: #3A3A4A;
  --color-text-inverse: #0A0A0F;

  /* === Radius === */
  --radius-xs: 3px; --radius-sm: 6px; --radius-md: 8px;
  --radius-lg: 12px; --radius-xl: 16px; --radius-full: 9999px;

  /* === Spacing === */
  --space-1: 4px; --space-2: 8px; --space-3: 12px; --space-4: 16px;
  --space-6: 24px; --space-8: 32px; --space-12: 48px; --space-16: 64px;

  /* === Motion === */
  --duration-instant: 80ms; --duration-fast: 150ms;
  --duration-base: 220ms; --duration-slow: 350ms; --duration-page: 180ms;
  --ease-out: cubic-bezier(0.0,0.0,0.2,1.0);
  --ease-in: cubic-bezier(0.4,0.0,1.0,1.0);
  --ease-inout: cubic-bezier(0.4,0.0,0.2,1.0);
  --ease-spring: cubic-bezier(0.34,1.56,0.64,1);

  /* === Shadow === */
  --shadow-sm: 0 1px 2px rgba(0,0,0,0.40), inset 0 1px 0 rgba(255,255,255,0.04);
  --shadow-md: 0 4px 12px rgba(0,0,0,0.50), inset 0 1px 0 rgba(255,255,255,0.06);
  --shadow-lg: 0 8px 32px rgba(0,0,0,0.64), inset 0 1px 0 rgba(255,255,255,0.08);
  --shadow-accent-glow: 0 0 0 1px rgba(124,92,255,0.30), 0 4px 20px rgba(124,92,255,0.15);
}

[data-theme="light"] {
  --color-bg-base: #FAFAFA;
  --color-bg-subtle: #F4F4F6;
  --color-bg-surface: #FFFFFF;
  --color-bg-elevated: #FFFFFF;
  --color-border: rgba(0,0,0,0.08);
  --color-border-strong: rgba(0,0,0,0.16);
  --color-text-primary: #0F0F1A;
  --color-text-secondary: #4A4A60;
  --color-text-muted: #8A8AA0;
  --shadow-sm: 0 1px 3px rgba(0,0,0,0.08);
  --shadow-md: 0 4px 12px rgba(0,0,0,0.12);
  --shadow-lg: 0 8px 32px rgba(0,0,0,0.16);
}

@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    transition-duration: 0.01ms !important;
  }
}
```

### 6-2. Tailwind v4 설정 (`tailwind.config.ts`)

```ts
import type { Config } from 'tailwindcss';

export default {
  content: ['./src/**/*.{ts,tsx,mdx}'],
  theme: {
    extend: {
      colors: {
        accent: { DEFAULT: 'var(--color-accent)', muted: 'var(--color-accent-muted)', subtle: 'var(--color-accent-subtle)' },
        metric: {
          'price-low': 'var(--color-metric-price-low)',
          'price-high': 'var(--color-metric-price-high)',
          speed: 'var(--color-metric-speed)',
          quality: 'var(--color-metric-quality)',
          context: 'var(--color-metric-context)',
        },
        bg: { base: 'var(--color-bg-base)', subtle: 'var(--color-bg-subtle)', surface: 'var(--color-bg-surface)', elevated: 'var(--color-bg-elevated)' },
        border: { DEFAULT: 'var(--color-border)', strong: 'var(--color-border-strong)' },
        text: { primary: 'var(--color-text-primary)', secondary: 'var(--color-text-secondary)', muted: 'var(--color-text-muted)' },
      },
      fontFamily: {
        sans: ['Inter', 'Pretendard Variable', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'Fira Code', 'monospace'],
      },
      borderRadius: { xs: '3px', sm: '6px', md: '8px', lg: '12px', xl: '16px' },
      transitionTimingFunction: { spring: 'cubic-bezier(0.34, 1.56, 0.64, 1)' },
    },
  },
} satisfies Config;
```

### 6-3. 컴포넌트 Props 인터페이스 시그니처 (TypeScript)

```ts
// src/components/ModelChip.tsx
export type Provider =
  | 'openai' | 'anthropic' | 'google' | 'meta'
  | 'mistral' | 'xai' | 'cohere' | 'other';

export interface ModelChipProps {
  modelName: string;          // "GPT-4o"
  provider: Provider;
  size?: 'sm' | 'md' | 'lg';  // 20 / 28 / 64
  selected?: boolean;         // accent 외곽선
  showFullName?: boolean;     // false면 이니셜만 표시
  onClick?: () => void;
}

// src/components/MetricCard.tsx
export type MetricKind = 'price-in' | 'price-out' | 'context' | 'speed' | 'quality';

export interface MetricCardProps {
  kind: MetricKind;
  value: number | string;     // 수치 또는 "$2.50"
  unit?: string;              // "/1M tokens"
  scoreBar?: 1 | 2 | 3 | 4 | 5;
  scoreLabel?: string;        // "산업 평균 대비 저렴"
  stale?: boolean;
  loading?: boolean;
}

// src/components/SourceBadge.tsx
export type Confidence = 'high' | 'mid' | 'low';

export interface SourceBadgeProps {
  sourceName: string;
  sourceUrl: string;
  verifiedAt: string;         // ISO date
  confidence: Confidence;
  inline?: boolean;
}

// src/components/CompareTable.tsx
export interface CompareModel {
  slug: string;
  name: string;
  provider: Provider;
  metrics: Record<string, { value: number | string; unit?: string; source: SourceBadgeProps }>;
}

export interface CompareTableProps {
  models: CompareModel[];     // 2~4개
  attributes: { key: string; label: string; highlight?: 'min' | 'max' }[];
  onRemoveModel?: (slug: string) => void;
  onAddModel?: () => void;
}

// src/components/WizardStep.tsx
export interface WizardStepProps {
  currentStep: 1 | 2 | 3 | 4;  // C1: 4단계
  totalSteps: 4;
  stepLabels: [string, string, string, string];
}

// src/components/AdSlot.tsx
export type AdSlotId =
  | 'HOME_LEADERBOARD_TOP'
  | 'MODEL_DETAIL_SIDEBAR'
  | 'COMPARE_TOP'
  | 'COMPARE_BOTTOM'
  | 'LEADERBOARD_RIGHT'
  | 'WIZARD_RESULT';

export interface AdSlotProps {
  id: AdSlotId;
  size: '728x90' | '300x250' | '300x600' | '320x50';
  minHeight: number;
}

// src/components/ShareCTA.tsx
export interface ShareCTAProps {
  url: string;
  ogPreviewUrl: string;
  shareText: string;
  channels?: ('twitter' | 'copy' | 'native')[];
}
```

### 6-4. 디렉토리 분리 (병렬 개발 충돌 방지)

- `@컴포넌트개발자` → `src/components/` Tier 1~3 18개
- `@페이지개발자` → `src/app/[locale]/` 6개 화면
- 공통 토큰/타입은 `src/styles/`, `src/lib/types.ts` 별도 파일

### 6-5. 모션·인터랙션 핸드오프

- 호버: `transition-property: background-color, border-color, transform; duration: var(--duration-fast); easing: var(--ease-out);`
- 버튼 active scale 0.96 + ease-spring
- 페이지 전환: opacity만(180ms ease-inout) — slide/flip 금지
- prefers-reduced-motion 미디어 쿼리는 tokens.css에 이미 포함
- ScoreBar 채움 애니메이션: 데이터 로드 완료 후 width 0→N%, 600ms ease-out

### 6-6. 반응형 기준

| BP | Tailwind prefix | 핵심 변화 |
|---|---|---|
| 360px | (base) | 단일 컬럼, 하단 탭바 4탭, CompareTable 세로 스택+스냅 |
| 768px | `md:` | 2컬럼, CompareTable 풀 표시(sticky), MetricCard 2열 |
| 1024px | `lg:` | 사이드바 노출, AdSlot 사이드바 활성 |
| 1440px | `xl:` | 최대폭 1280 중앙, MetricRadar 확대 |

---

## 7. 6주 일정 — 디자인 작업 분담

| 주 | 디자인 작업 |
|---|---|
| **W1** | 핸드오프 5영업일: tokens.css + Tailwind 설정 + Tier 1 컴포넌트 8종 Figma 명세 → 프론트팀 인계 (Day 1~3 브랜드/홈/모델상세/비교 / Day 4~5 위저드/리더보드/관리자) |
| **W2** | 모델 상세 + 데이터 시딩 화면 검수, Tier 2 컴포넌트 보강(MetricRadar, LeaderboardRow) |
| **W3** | 비교/리더보드 실데이터 검수, 빈상태/로딩/에러 패턴 검증, 모바일 반응형 핸드오프 추가 |
| **W4** | 위저드 인터랙션 검수 + OG 카드 3종 `@vercel/og` 디자인 QA, 매트릭스 비활성 셀 UX 점검 |
| **W5** | i18n 한국어 화면 검수(Pretendard 라인하이트 1.1배 확인), SVG 직무 아이콘 5종 교체 |
| **W6** | 다크/라이트 모드 양쪽 a11y 대비 최종 검증(WCAG 2.1 AA), 광고 슬롯 레이아웃 시프트 검수, 사장 데모 |

**디자인 리소스**: Figma 1개 파일 + Variants/Modes(다크/라이트) + Auto Layout. 컴포넌트 라이브러리는 Tier 1 W1, Tier 2 W2~3, Tier 3 W4 순차 게시.

---

## 8. 사장 결정 필요 항목

1. **브랜드명 최종 확정** — 디자인팀장 추천: **Benchly**
   - 추천 이유: SEO 친화(benchmark 키워드 포함) + 한국어 발음 자연스러움(벤치리) + 도메인 단순성. "Modex"는 한국 발음 어색, "Lensai"는 기존 도구와 혼동 우려.
   - 사장이 직접 다른 후보(예: Modex)를 선호하면 변경 가능. 도메인 가용성(benchly.com / benchly.ai) 사전 확인 필요.
2. **광고 슬롯 6종 위치 최종 승인** — UX §7 그대로 진행할지(MVP는 빈 컨테이너 유지), 또는 일부 슬롯 사전 제거 여부
3. **수익 모델 도입 시점** (project-direction.md §8 미해결) — 디자인은 v1.1 Carbon Ads 네이티브 배너 가능하도록 설계 완료. 사장 결정으로 시기 확정 필요
4. **모델 로고 정책 재확인** — ModelChip 텍스트 이니셜로 확정했으나, 사장이 공식 로고 사용 결정 시 ModelChip에 SVG 슬롯만 추가하면 됨

---

> 본 문서가 디자인 최종본이다. 프론트팀은 §6 핸드오프 섹션을 그대로 사용해 W1 5일 내 Tier 1 8종 + 토큰 시스템 구축을 시작한다.
