# AI 모델 비교 대시보드 — UI 비주얼 시스템 스펙

> 작성: @UI디자이너 (Sonnet) — 디자인팀 병렬 작업
> 일자: 2026-05-28
> 입력: `docs/planning/project-direction.md`
> 톤 결정: Linear 70% + Vercel 20% + op.gg 10%, 다크 우선
> 폰트: Inter(en) / Pretendard(ko) / JetBrains Mono(수치·코드)
> 스택: Next.js 15 + Tailwind v4 + shadcn

---

## 1. 비주얼 톤 & 무드보드

### 레퍼런스 믹스 비율

| 레퍼런스 | 비율 | 빌려온 것 |
|---|---|---|
| **Linear** | 70% | 짙은 배경(#0A0A0F에 가까운 near-black), 미세한 노이즈 텍스처, 서브픽셀 테두리(1px border opacity 0.1~0.15), 정보 밀도 높은 레이아웃, 극도로 절제된 애니메이션, 크리스프한 모노스페이스 수치 |
| **Vercel** | 20% | 화이트-온-다크 타이포그래피 계층, 그리드 분할 레이아웃, 깔끔한 테이블 UI, 상태(배포/성공/실패) 뱃지 언어 |
| **op.gg** | 10% | 티어/랭킹 기반 시각화, 수치 중심 카드 배치, 색상으로 성능 등급 즉시 전달(가격↓초록·속도↑파랑·품질↑앰버), 비교 테이블 행-열 구조 |

### 핵심 무드 키워드

신뢰할 수 있는 데이터 / 차갑고 정밀한 / 밀도 있는 정보 / 개발자 친화 / 즉각적 비교

---

## 2. 디자인 토큰

### 2-1. 컬러 시스템

#### Primary Accent — 추천 단일 액센트: 바이올렛 퍼플 #7C5CFF

> **선정 이유**: Linear의 퍼플 DNA를 직접 계승. 다크 배경(#0A0A0F)에서 명도 대비 AA 이상 확보. 시안 계열(#00CFFF)은 속도 메트릭 전용으로 사용해 충돌 방지. 퍼플 단일 액센트로 브랜드 고유성 확보.

```css
/* Tailwind v4 CSS 변수 방식 */
:root {
  --color-accent:        #7C5CFF;  /* primary accent — 버튼·링크·포커스 링 */
  --color-accent-muted:  #4D3BB3;  /* hover/pressed state */
  --color-accent-subtle: rgba(124, 92, 255, 0.12);  /* 배지 배경 */
  --color-accent-glow:   rgba(124, 92, 255, 0.30);  /* 포커스 링·카드 호버 광택 */
}
```

#### Semantic — 메트릭별 컬러 언어

| 용도 | 토큰 | HEX | 설명 |
|---|---|---|---|
| 가격 낮음(저렴) | `--color-metric-price-low` | `#22C55E` | op.gg 그린 계열, 눈에 띄는 초록 |
| 가격 높음(비쌈) | `--color-metric-price-high` | `#EF4444` | 경고 레드, 즉각 인지 |
| 속도(빠름↑) | `--color-metric-speed` | `#38BDF8` | 시안-스카이 블루, 속도감 |
| 품질(높음) | `--color-metric-quality` | `#F59E0B` | 앰버, op.gg 골드 티어 |
| 컨텍스트(긺) | `--color-metric-context` | `#A78BFA` | 라벤더-퍼플, 액센트 계열 |
| success | `--color-success` | `#16A34A` | 공식 데이터 확인 완료 |
| warning | `--color-warning` | `#D97706` | 신뢰도 mid/low |
| error | `--color-error` | `#DC2626` | 데이터 불일치·오류 |
| info | `--color-info` | `#0EA5E9` | 안내·도움말 |

#### Surface (다크 우선)

```css
/* ===== DARK MODE (디폴트) ===== */
[data-theme="dark"], :root {
  /* 배경 계층 — Linear식 near-black */
  --color-bg-base:      #0A0A0F;  /* 최하단 페이지 배경 */
  --color-bg-subtle:    #111118;  /* 섹션 구분 배경 */
  --color-bg-surface:   #16161F;  /* 카드·패널 배경 */
  --color-bg-elevated:  #1E1E2A;  /* 드롭다운·모달·호버 */
  --color-bg-overlay:   rgba(0, 0, 0, 0.72);

  /* 테두리 — 서브픽셀 투명도 */
  --color-border:        rgba(255, 255, 255, 0.08);
  --color-border-strong: rgba(255, 255, 255, 0.16);
  --color-border-focus:  rgba(124, 92, 255, 0.60);

  /* 텍스트 계층 */
  --color-text-primary:   #F0F0F8;  /* 주요 텍스트 */
  --color-text-secondary: #9090A8;  /* 보조 텍스트 */
  --color-text-muted:     #5A5A72;  /* 비활성·힌트 */
  --color-text-disabled:  #3A3A4A;  /* disabled */
  --color-text-inverse:   #0A0A0F;  /* 밝은 배경 위 텍스트 */
}

/* ===== LIGHT MODE ===== */
[data-theme="light"] {
  --color-bg-base:      #FAFAFA;
  --color-bg-subtle:    #F4F4F6;
  --color-bg-surface:   #FFFFFF;
  --color-bg-elevated:  #FFFFFF;
  --color-bg-overlay:   rgba(0, 0, 0, 0.48);

  --color-border:        rgba(0, 0, 0, 0.08);
  --color-border-strong: rgba(0, 0, 0, 0.16);
  --color-border-focus:  rgba(124, 92, 255, 0.50);

  --color-text-primary:   #0F0F1A;
  --color-text-secondary: #4A4A60;
  --color-text-muted:     #8A8AA0;
  --color-text-disabled:  #C0C0D0;
  --color-text-inverse:   #F0F0F8;
}
```

#### 중립 그레이 스케일 (다크 기준)

```css
:root {
  --gray-950: #0A0A0F;
  --gray-900: #111118;
  --gray-800: #16161F;
  --gray-700: #1E1E2A;
  --gray-600: #2A2A38;
  --gray-500: #3C3C50;
  --gray-400: #5A5A72;
  --gray-300: #7A7A90;
  --gray-200: #9A9AB0;
  --gray-100: #C0C0D0;
  --gray-50:  #E8E8F0;
}
```

---

### 2-2. 타이포그래피

#### 폰트 패밀리

```css
:root {
  --font-sans-en:   'Inter', system-ui, sans-serif;        /* 영문 UI */
  --font-sans-ko:   'Pretendard Variable', 'Pretendard', 'Inter', sans-serif; /* 한국어 UI */
  --font-mono:      'JetBrains Mono', 'Fira Code', monospace; /* 수치·코드·토큰·API 키 */
}

/* 적용 전략: html[lang="ko"] 는 Pretendard 우선, 기본은 Inter */
html { font-family: var(--font-sans-en); }
html[lang="ko"] { font-family: var(--font-sans-ko); }
```

#### 스케일 정의

| 토큰 | Size | Line Height | LH (ko 보정) | Weight | Letter Spacing | 용도 |
|---|---|---|---|---|---|---|
| `text-display` | 48px | 1.15 | 1.27 (+10%) | 700 | -0.03em | OG 카드·랜딩 히어로 |
| `text-h1` | 36px | 1.2 | 1.32 | 700 | -0.02em | 페이지 타이틀 |
| `text-h2` | 28px | 1.25 | 1.38 | 600 | -0.01em | 섹션 헤더 |
| `text-h3` | 22px | 1.3 | 1.43 | 600 | 0 | 카드 제목·모달 타이틀 |
| `text-h4` | 18px | 1.4 | 1.54 | 600 | 0 | 서브섹션·테이블 헤더 |
| `text-body-l` | 16px | 1.6 | 1.76 | 400 | 0.01em | 본문·설명 |
| `text-body-m` | 14px | 1.6 | 1.76 | 400 | 0.01em | 보조 본문·카드 내용 |
| `text-body-s` | 12px | 1.55 | 1.71 | 400 | 0.02em | 캡션·날짜·출처 |
| `text-label` | 13px | 1.4 | 1.54 | 500 | 0.05em | 버튼·배지·레이블 |
| `text-mono-l` | 16px | 1.5 | — | 500 | 0 | 가격·벤치마크 수치 |
| `text-mono-m` | 14px | 1.5 | — | 400 | 0 | 토큰·API 값 |
| `text-mono-s` | 12px | 1.5 | — | 400 | 0 | 소형 수치·코드 조각 |

> 한국어 line-height 보정: 기본값 × 1.1 적용. body 계열은 1.6 고정(한글 가독성 최적).
> 모든 수치: `font-family: var(--font-mono)` + `font-variant-numeric: tabular-nums` 전역 적용.

---

### 2-3. 스페이싱

```css
:root {
  --space-1:  4px;
  --space-2:  8px;
  --space-3:  12px;
  --space-4:  16px;
  --space-6:  24px;
  --space-8:  32px;
  --space-12: 48px;
  --space-16: 64px;
}
```

| 토큰 | 값 | 주 용도 |
|---|---|---|
| `--space-1` | 4px | 아이콘-텍스트 간격, 인라인 갭 |
| `--space-2` | 8px | 컴포넌트 내부 소형 패딩, 아이템 간격 |
| `--space-3` | 12px | 배지 좌우 패딩, 테이블 셀 |
| `--space-4` | 16px | 카드 내부 패딩, 버튼 패딩 |
| `--space-6` | 24px | 섹션 내부 스택 간격 |
| `--space-8` | 32px | 카드 간 거터, 섹션 헤더 마진 |
| `--space-12` | 48px | 섹션 간 여백 |
| `--space-16` | 64px | 페이지 상하 패딩 |

---

### 2-4. Radius

```css
:root {
  --radius-xs: 3px;   /* 인라인 코드·배지 소형 */
  --radius-sm: 6px;   /* 버튼·인풋·칩 */
  --radius-md: 8px;   /* 카드·패널 (기본) */
  --radius-lg: 12px;  /* 모달·드롭다운 */
  --radius-xl: 16px;  /* 대형 카드·OG 카드 */
  --radius-full: 9999px; /* 아바타·프로바이더 칩 */
}
```

---

### 2-5. Shadow (다크 모드 우선)

```css
:root {
  /* 다크: 레이어 분리를 위한 inset glow + drop shadow 조합 */
  --shadow-sm:  0 1px 2px rgba(0,0,0,0.40),
                inset 0 1px 0 rgba(255,255,255,0.04);
  --shadow-md:  0 4px 12px rgba(0,0,0,0.50),
                inset 0 1px 0 rgba(255,255,255,0.06);
  --shadow-lg:  0 8px 32px rgba(0,0,0,0.64),
                inset 0 1px 0 rgba(255,255,255,0.08);

  /* 액센트 글로우 (카드 호버·포커스 시) */
  --shadow-accent-glow: 0 0 0 1px rgba(124, 92, 255, 0.30),
                        0 4px 20px rgba(124, 92, 255, 0.15);
}

/* 라이트 모드에서는 단순 drop shadow */
[data-theme="light"] {
  --shadow-sm:  0 1px 3px rgba(0,0,0,0.08);
  --shadow-md:  0 4px 12px rgba(0,0,0,0.12);
  --shadow-lg:  0 8px 32px rgba(0,0,0,0.16);
  --shadow-accent-glow: 0 0 0 1px rgba(124, 92, 255, 0.25),
                        0 4px 20px rgba(124, 92, 255, 0.10);
}
```

---

### 2-6. Motion (모션 토큰)

```css
:root {
  /* duration */
  --duration-instant:    80ms;   /* 즉각 피드백 (클릭·탭) */
  --duration-fast:       150ms;  /* 호버·포커스 전환 */
  --duration-base:       220ms;  /* 컴포넌트 상태 변환 */
  --duration-slow:       350ms;  /* 모달·패널 진입 */
  --duration-page:       180ms;  /* 페이지 전환 (최소, Linear식) */

  /* easing */
  --ease-out:      cubic-bezier(0.0, 0.0, 0.2, 1.0);  /* 진입 */
  --ease-in:       cubic-bezier(0.4, 0.0, 1.0, 1.0);  /* 퇴장 */
  --ease-inout:    cubic-bezier(0.4, 0.0, 0.2, 1.0);  /* 상태 전환 */
  --ease-spring:   cubic-bezier(0.34, 1.56, 0.64, 1); /* 버튼 스프링 */
}
```

---

### 2-7. Tailwind v4 토큰 매핑

```css
/* tailwind.config.ts → @layer base CSS 변수 방식 (Tailwind v4 권장) */
@theme {
  --color-accent:          #7C5CFF;
  --color-accent-muted:    #4D3BB3;
  --color-metric-cheap:    #22C55E;
  --color-metric-expensive:#EF4444;
  --color-metric-speed:    #38BDF8;
  --color-metric-quality:  #F59E0B;
  --color-metric-context:  #A78BFA;

  --color-bg-base:         #0A0A0F;
  --color-bg-surface:      #16161F;
  --color-bg-elevated:     #1E1E2A;
  --color-border:          rgba(255,255,255,0.08);
  --color-border-strong:   rgba(255,255,255,0.16);

  --color-text-primary:    #F0F0F8;
  --color-text-secondary:  #9090A8;
  --color-text-muted:      #5A5A72;

  --font-sans:    'Inter', 'Pretendard Variable', system-ui, sans-serif;
  --font-mono:    'JetBrains Mono', 'Fira Code', monospace;

  --radius-sm:  6px;
  --radius-md:  8px;
  --radius-lg:  12px;

  --spacing-1:  4px;
  --spacing-2:  8px;
  --spacing-3:  12px;
  --spacing-4:  16px;
  --spacing-6:  24px;
  --spacing-8:  32px;
  --spacing-12: 48px;
}
```

---

## 3. 핵심 컴포넌트 스펙

### 3-1. Button

**Variant × Size 매트릭스**

| Variant | 배경 | 텍스트 | 테두리 | 용도 |
|---|---|---|---|---|
| Primary | `--color-accent` (#7C5CFF) | `#FFFFFF` | 없음 | 메인 CTA (비교 시작, 공유) |
| Secondary | `--color-bg-elevated` | `--color-text-primary` | `--color-border-strong` 1px | 보조 액션 (필터, 새로고침) |
| Ghost | transparent | `--color-text-secondary` | 없음 | 인라인 액션 (더보기, 닫기) |
| Danger | rgba(220,38,38,0.12) | `#EF4444` | rgba(220,38,38,0.30) 1px | 삭제·초기화 |

| Size | Height | H-Padding | Font | Radius | Icon 전용 |
|---|---|---|---|---|---|
| sm | 28px | 10px | 12px/500 | `--radius-sm` | 28×28px |
| md | 36px | 14px | 13px/500 | `--radius-sm` | 36×36px |
| lg | 44px | 20px | 15px/500 | `--radius-sm` | 44×44px |

**상태 전환**
- `default → hover`: background brightness +8%, `--duration-fast` ease-out
- `hover → active`: `scale(0.96)` `--duration-instant` `--ease-spring`
- `disabled`: opacity 0.32, cursor not-allowed, 모든 이벤트 차단
- `loading`: 텍스트 opacity 0 → 16px 스피너(SVG 애니메이션) 중앙 배치, 너비 고정(레이아웃 점프 방지)

---

### 3-2. Badge

| Variant | 배경 | 텍스트 | 테두리 | 용도 |
|---|---|---|---|---|
| provider | `--color-bg-elevated` | `--color-text-primary` | `--color-border` 1px | OpenAI, Anthropic 등 |
| score-high | rgba(34,197,94,0.15) | #22C55E | rgba(34,197,94,0.30) | 상위 스코어 |
| score-mid | rgba(245,158,11,0.15) | #F59E0B | rgba(245,158,11,0.30) | 중간 스코어 |
| score-low | rgba(239,68,68,0.15) | #EF4444 | rgba(239,68,68,0.30) | 하위 스코어 |
| status-verified | rgba(22,163,74,0.15) | #16A34A | 없음 | 공식 데이터 확인 |
| status-stale | rgba(217,119,6,0.12) | #D97706 | 없음 | 갱신 필요 |
| status-unverified | rgba(90,90,114,0.15) | `--color-text-muted` | 없음 | 출처 미확인 |

**치수**: height 20px / padding 3px 8px / border-radius `--radius-xs` / font `text-body-s` 500

---

### 3-3. ModelChip (텍스트 마크 — 저작권 안전)

> 로고 이미지 없이 이니셜+컬러 배경으로 제공자 식별. 저작권 분쟁 원천 차단.

**구조**: [컬러 원형 아바타(28px) + 모델명 텍스트]

```
[ O ] GPT-4o          ← OpenAI: #10B981(에메랄드) 배경 + "O"
[ A ] Claude Opus 4   ← Anthropic: #F59E0B(앰버) 배경 + "A"
[ G ] Gemini 2.5 Pro  ← Google: #3B82F6(블루) 배경 + "G"
[ M ] Mistral Large   ← Mistral: #8B5CF6(바이올렛) 배경 + "M"
[ X ] Grok 3          ← xAI: #6B7280(그레이) 배경 + "X"
```

**제공자별 색상 할당 (고정)**

| 제공자 | 배경 HEX | 이니셜 | 텍스트 색 |
|---|---|---|---|
| OpenAI | `#10B981` | O | #FFFFFF |
| Anthropic | `#F59E0B` | A | #0A0A0F |
| Google | `#3B82F6` | G | #FFFFFF |
| Meta | `#1D4ED8` | M | #FFFFFF |
| Mistral | `#8B5CF6` | Mi | #FFFFFF |
| xAI | `#6B7280` | X | #FFFFFF |
| Cohere | `#06B6D4` | C | #0A0A0F |
| 기타 | `#4B5563` | 첫글자 | #FFFFFF |

**치수**: 아바타 28px `--radius-full` / 텍스트 `text-body-m` 500 / 아바타-텍스트 갭 8px / 선택 상태: 1px `--color-accent` 외곽선 + `--color-accent-subtle` 배경

---

### 3-4. MetricCard

단일 메트릭(가격/컨텍스트/속도/품질) 표시 카드.

```
+------------------------------------+
|  입력 가격        [정보 아이콘]     |
|  $0.15                             |  ← JetBrains Mono 28px/700
|  /1M tokens                        |  ← text-body-s, --color-text-muted
|                                    |
|  [●●●●○] 산업 평균 대비 저렴       |  ← ScoreBar 5단계 + 설명
+------------------------------------+
```

**치수**: 패딩 16px / `--radius-md` / 배경 `--color-bg-surface` / 테두리 `--color-border` 1px

**4종 색상 연결**

| 카드 | 라벨 색 | 바 색 | 아이콘 |
|---|---|---|---|
| 가격 | `--color-metric-cheap` or `..price-high` | 동일 | DollarSign |
| 컨텍스트 | `--color-metric-context` | `#A78BFA` | BookOpen |
| 속도 | `--color-metric-speed` | `#38BDF8` | Zap |
| 품질 | `--color-metric-quality` | `#F59E0B` | Star |

**상태**
- `loading`: 수치 영역 skeleton (12px height shimmer bar, `--duration-base` 루프)
- `stale`: 우상단 경고 뱃지 + `--color-text-muted` 처리 (전체 수치 dimmed)

---

### 3-5. CompareTable

**데스크톱 (768px+)**

```
| 속성           | GPT-4o      | Claude Opus 4 | Gemini 2.5 Pro |
|----------------|-------------|---------------|----------------|
| 입력 가격      | $2.50/1M    | $15.00/1M     | $1.25/1M       |
| 출력 가격      | $10.00/1M   | $75.00/1M     | $5.00/1M       |
| 컨텍스트 창    | 128K        | 200K          | 1M             |
| 속도 (TPS)     | 95          | 72            | 110            |
| 품질 (MMLU)    | 88.7%       | 86.8%         | 90.0%          |
| 출처 / 날짜    | 공식 · 3일전 | 공식 · 1일전  | 공식 · 5일전   |
```

- **sticky 헤더**: `position: sticky; top: 0` / 배경 `--color-bg-base` + 하단 `--color-border` 1px
- **sticky 좌측 열(속성명)**: `position: sticky; left: 0` / 배경 `--color-bg-surface`
- **행 강조**: 호버 시 배경 `--color-bg-elevated` `--duration-fast`
- **최고값 셀**: 해당 메트릭 컬러로 수치 텍스트 + `--color-accent-subtle` 배경
- **최저값 셀(가격 기준)**: `--color-metric-cheap` 텍스트

**모바일 (768px 미만) — 세로 스택 + 스와이프**

```
[모델 탭: [GPT-4o] [Claude Opus 4] [Gemini 2.5 Pro]]
↕ 수평 스크롤 스냅(snap-x mandatory)

각 카드:
+-------------------------------+
| GPT-4o                        |
| [OpenAI]                      |
|-------------------------------|
| 입력 가격     $2.50 /1M 🟢     |
| 출력 가격     $10.00 /1M       |
| 컨텍스트 창   128K              |
| 속도          95 TPS  🔵       |
| 품질(MMLU)    88.7%    🟡      |
+-------------------------------+
```

- scroll-snap-type: x mandatory / snap-align: start
- 스와이프 힌트: 우측 카드 15% peek

---

### 3-6. ScoreBar

5단계 시각화 바. MetricCard 하단에 내장.

```
[●●●●○]  매우 저렴 / 저렴 / 보통 / 비쌈 / 매우 비쌈
```

- 점 크기: 8px 원 / 갭: 4px / 채움: 메트릭 컬러 / 빈: `--gray-600`
- 텍스트 레이블: `text-body-s` `--color-text-muted` 오른쪽 배치

### MetricRadar (방사형 차트)

비교 페이지에서 2~4개 모델 오버레이 비교 시 사용.

- SVG 기반 / viewBox 200×200
- 축: 가격효율·컨텍스트·속도·품질·다국어 지원 5축
- 각 모델 폴리곤: 모델 할당 색상 / fill-opacity 0.12 / stroke 1.5px
- 레이블: `text-mono-s` / 축선: `--color-border-strong`
- 호버: 해당 모델 폴리곤 fill-opacity 0.25 + 데이터포인트 6px 원 + 툴팁

---

### 3-7. SourceMeta

데이터 출처 표시. 모든 수치 셀 하단 또는 인라인.

```
[🔗] OpenAI 공식  ·  2일 전  ·  신뢰도: 높음
```

**치수**: `text-body-s` / `--color-text-muted` / 아이콘 12px / 항목 간 가운뎃점(·) 4px 패딩

**신뢰도 색상**
- high: `--color-success` 텍스트 (+ "높음")
- mid: `--color-warning` 텍스트 (+ "중간")
- low: `--color-error` 텍스트 (+ "낮음 - 교차 확인 권장")

**링크 동작**: `href=source_url` 새 탭, `rel="noopener noreferrer"`

---

### 3-8. ShareCard (미리보기)

OG 카드 실시간 미리보기 컴포넌트. `/compare/[pair]` 페이지 공유 전 표시.

```
+-------------------------------------+
|  [브랜드 워드마크]           다크 배경|
|                                     |
|  GPT-4o  vs  Claude Opus 4          |
|                                     |
|  가격        $2.50  vs  $15.00      |
|  속도        95     vs  72  TPS     |
|  품질        88.7%  vs  86.8%       |
|                                     |
|  [도메인 URL]         [날짜]         |
+-------------------------------------+
```

- 치수: 1200×630px (OG 표준)
- 배경: `#0A0A0F` (다크 고정 — SNS 미리보기는 다크 일관성)
- 폰트 임베드: Inter 700 + JetBrains Mono 500 (`@vercel/og` ImageResponse 사용)
- 컴포넌트 미리보기: 축소판(600×315px) + "트위터에 공유" / "링크 복사" 버튼

---

### 3-9. WizardStep

위저드(`/wizard`) 진행 표시.

```
[●●○○○]   2 / 5 단계 — 용도 선택
```

**구조**: 진행 점 5개 + 단계 텍스트 + 뒤로/다음 버튼

- 점: 10px 원 / 완료=`--color-accent` / 현재=`--color-accent` 2px 외곽선+흰 내부 / 미완=`--gray-600`
- 텍스트: `text-body-s` `--color-text-muted`
- 전환 애니메이션: `translateX(20px→0) + opacity(0→1)` `--duration-base` `--ease-out`
- 뒤로: Ghost 버튼 / 다음: Primary 버튼 (조건 미충족 시 disabled)

---

### 3-10. ChangelogItem

데이터 갱신 이력 표시. `/models/[slug]` 페이지 사이드바 또는 하단.

```
+------------------------------------------+
| [🟢] 가격 갱신     GPT-4o                |
|      입력: $3.00 → $2.50  (-16.7%)       |
|      출처: OpenAI 공식      2026-05-26   |
+------------------------------------------+
```

- 좌측 아이콘: 8px 상태 색 원 (변경=accent / 신규=success / 제거=error)
- 제목: `text-body-m` 500
- 내용: `text-body-s` `--color-text-secondary`
- 날짜: `text-mono-s` `--color-text-muted` 우측 정렬
- 구분선: `--color-border` 1px

---

## 4. OG 카드 3종 비주얼 스펙

> 모두 1200×630px / 다크 배경(`#0A0A0F`) 고정 / `@vercel/og` ImageResponse

### 공통 토큰

| 요소 | 값 |
|---|---|
| 배경 | `#0A0A0F` |
| 패딩 | 60px |
| 하단 바 | 4px `#7C5CFF` (accent) 전체 너비 |
| 워드마크 폰트 | Inter 700 / `#F0F0F8` |
| 수치 폰트 | JetBrains Mono 600 / 해당 메트릭 컬러 |
| 출처 폰트 | Inter 400 / `#5A5A72` |

### OG 카드 1: 비교 카드 (compare pair)

```
배경: #0A0A0F + 미세 노이즈 텍스처 (noise.svg 오버레이, opacity 0.04)

[브랜드 워드마크]                                    [날짜]

GPT-4o                    vs               Claude Opus 4
[O]                                              [A]

입력 가격    $2.50/1M 🟢          $15.00/1M 🔴
컨텍스트     128K                 200K 🟢
속도(TPS)    95 🟢                72

[domain.com/compare/gpt-4o-vs-claude-opus-4]

████████████████████████████████████ (4px 퍼플 하단 바)
```

- 모델명: Inter 700 36px `#F0F0F8`
- "vs": Inter 400 24px `#5A5A72`
- 수치: JetBrains Mono 600 20px / 메트릭 컬러 매핑

### OG 카드 2: 위저드 결과 (wizard result)

```
배경: #0A0A0F + 좌상단 accent glow (radial-gradient, rgba(124,92,255,0.12))

[브랜드 워드마크]

"코딩 + 긴 문서 처리"에 최적인 모델
(용도 요약, Inter 400 18px, --color-text-secondary)

#1  Gemini 2.5 Pro                          점수 94
    [G] Google  ·  $1.25/1M  ·  1M 컨텍스트

#2  GPT-4o                                  점수 87
    [O] OpenAI  ·  $2.50/1M  ·  128K

#3  Claude Opus 4                           점수 82
    [A] Anthropic ·  $15/1M  ·  200K

[공유하기 domain.com/wizard?result=...]

████ (4px 퍼플 하단 바)
```

- 순위 번호: JetBrains Mono 700 28px `--color-accent`
- 점수: JetBrains Mono 600 22px `--color-metric-quality`

### OG 카드 3: 단일 모델 (model detail)

```
배경: #0A0A0F + 모델 제공자 컬러 우상단 accent blob (radial-gradient, 120px, opacity 0.10)

[브랜드 워드마크]                    [ModelChip: O  OpenAI]

GPT-4o
(Inter 700 52px, #F0F0F8)

입력 $2.50     출력 $10.00     컨텍스트 128K     속도 95 TPS
(JetBrains Mono 600 18px, 메트릭 컬러)

검증: OpenAI 공식  ·  2026-05-26  ·  신뢰도 높음

████ (4px 퍼플 하단 바)
```

- 모델명 폰트: Inter 700 52px

---

## 5. 반응형 기준점

| 브레이크포인트 | 변경 사항 |
|---|---|
| **360px** (모바일 소형) | 단일 컬럼 / 카드 16px 외부 마진 → 12px / CompareTable → 단일 모델 카드+스와이프 / 네비게이션 → 하단 탭바 4탭 / OG 미리보기 숨김 |
| **768px** (태블릿) | 2컬럼 그리드(메인 2fr + 사이드 1fr) / CompareTable 풀 표시 / MetricCard 2열 그리드 / 사이드바 240px 고정 시작 |
| **1024px** (데스크톱 소형) | 3컬럼 레이아웃 가능 / 사이드바 260px / CompareTable 스크롤 없이 3모델 동시 비교 / 위저드 2단 레이아웃(좌: 질문, 우: 미리보기) |
| **1440px** (데스크톱 대형) | 최대 너비 1280px 중앙 정렬 / CompareTable 4~5모델 동시 비교 / MetricRadar 240px 확대 / 사이드 패널 ShareCard 항상 노출 |

**모바일 공통 규칙**
- 터치 타겟 최소 44×44px
- 하단 탭바(360/768px): Home / Leaderboard / Compare / Wizard 4탭
- 스와이프 가능 영역에 scroll-snap 적용

---

## 6. 모션 가이드라인

### 원칙: 데이터가 중심, 모션은 보조

| 상황 | 지속시간 | 이징 | 규칙 |
|---|---|---|---|
| 호버 (카드, 버튼, 행) | 150ms | ease-out | scale/shadow/color만. translateY 최대 2px |
| 포커스 링 | 80ms | ease-out | 링 두께 0→2px |
| 버튼 active | 80ms | spring | scale 0.96 |
| 드롭다운·툴팁 진입 | 150ms | ease-out | opacity 0→1 + translateY 4px→0 |
| 모달 진입 | 220ms | ease-out | opacity 0→1 + scale 0.96→1 |
| 모달 퇴장 | 150ms | ease-in | opacity 1→0 + scale 1→0.96 |
| 페이지 전환 | 180ms | ease-inout | opacity 0→1 (Linear식 최소 전환) |
| 스켈레톤 shimmer | 1.5s infinite | linear | gradient sweep |
| ScoreBar 채움 | 600ms | ease-out | width 0→N% (데이터 로드 완료 시) |

### 금지 사항
- 페이지 전환에 slide/flip/bounce 사용 금지 (데이터 집약 앱, 혼란 유발)
- 자동 재생 애니메이션(카루셀 등) 금지
- transform 없이 width/height 트랜지션 금지 (레이아웃 스래싱)
- `prefers-reduced-motion: reduce` 미디어 쿼리 반드시 대응 — 모든 duration을 0으로

```css
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    transition-duration: 0.01ms !important;
  }
}
```

---

## 7. 다크/라이트 토글

**디폴트: 다크 모드**

```
진입 로직:
1. localStorage.getItem('theme') 값 우선 (사용자 명시 선택)
2. 없으면 prefers-color-scheme 미디어 쿼리 확인
3. 둘 다 없으면 → "dark" 적용 (디폴트)
```

```tsx
// 토글 컴포넌트 (헤더 우상단 고정)
<button aria-label="테마 전환">
  {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
</button>

// 루트 적용
<html data-theme={theme}>
```

**전환 애니메이션**: `background-color`, `color`, `border-color` 모두 `--duration-base` `--ease-inout` 트랜지션. CSS 변수 직접 트랜지션 미지원 브라우저 → 트랜지션 없이 즉시 전환 (graceful degradation).

**다크 전용 디테일**
- 카드 구분: `--color-border` 1px 테두리 (그림자 대신 — 다크 배경에서 shadow 비효율)
- 스크롤바: `scrollbar-color: var(--gray-600) transparent`
- 선택 텍스트: `::selection { background: var(--color-accent-subtle); }`

---

## 8. 광고 슬롯 비주얼

> MVP 미탑재. v1.1 검토용 비주얼 가이드라인. Carbon Ads 계열 네이티브 배너 기준.

**원칙**
1. 광고임을 명시 ("스폰서드" 레이블, `text-body-s` `--color-text-muted`)
2. 다크 배경 매칭: 광고 컨테이너도 `--color-bg-surface` 배경 + `--color-border` 1px
3. 콘텐츠 흐름 방해 금지: 테이블 중간 삽입 금지, 사이드바 또는 페이지 상단/하단에만 배치
4. 모바일: 하단 탭바 위 고정 배너 금지 (탭바 가림). 인피드 1개(스크롤 중간)만 허용
5. 애니메이션 광고 금지 (사이트 모션 원칙과 충돌)

**슬롯 규격**

| 슬롯 | 위치 | 크기 | 배경 |
|---|---|---|---|
| 사이드바 네이티브 | 우측 사이드바 하단 | 240×200px | `--color-bg-surface` |
| 리더보드 상단 | 리더보드 페이지 상단 | 728×90px | `--color-bg-subtle` |
| 모바일 인피드 | 모델 목록 10번째 항목 후 | full-width×100px | `--color-bg-elevated` |

---

## 9. 브랜드 후보 3개 + 워드마크 디렉션

> 디자인팀장과 사장이 최종 결정. UI디자이너 의견 및 방향 제시.

### 후보 A — "Modex"

- 뜻: Model + Index. 간결하고 글로벌 발음 쉬움
- 슬로건: "Compare smarter."
- 워드마크: Inter 700 / "M" 글자 내부 수직 분할선(비교를 상징) / 색상 `#7C5CFF`
- 도메인 가용성: modex.ai 또는 usemodex.com 검토 권장
- 장점: 짧고 발음하기 쉬움, AI 도메인과 직관적 연결
- 단점: "모덱스"로 한국 발음 시 어색할 수 있음

### 후보 B — "Lensai" (Lens + AI)

- 뜻: AI 모델을 보는 렌즈. 인사이트·투명성 강조
- 슬로건: "See through the AI noise."
- 워드마크: Inter 600 소문자 + "ai" 부분 `#7C5CFF` 액센트 + 렌즈 원형 아이콘 픽토그램
- 도메인: lensai.io 또는 lensai.com
- 장점: 스타트업 브랜드 느낌, 시각적 메타포 명확
- 단점: 기존 렌즈 관련 AI 도구와 혼동 가능성 검토 필요

### 후보 C — "Benchly"

- 뜻: Benchmark + 부사형 접미사. 벤치마크 비교 도구임을 직관적으로 전달
- 슬로건: "Every model, benchmarked."
- 워드마크: Inter 700 / "B" 문자를 막대 차트 아이콘으로 대체 / 색상 `#F0F0F8` on `#7C5CFF` 배경
- 도메인: benchly.com 또는 benchly.ai
- 장점: 기능 직관, SEO 친화적 ("benchmark" 키워드 포함), 한국어 발음 자연스러움 (벤치리)
- 단점: 기술적 인상 강해 비개발자 타겟 접근성 낮을 수 있음

### 워드마크 공통 디렉션

- 폰트: Inter 700 (로고타입 전용, 별도 구매 또는 Variable 사용 명시)
- 색상: 다크 배경 = `#F0F0F8` 텍스트 / 라이트 배경 = `#0A0A0F` 텍스트 / 액센트 = `#7C5CFF`
- 아이콘 픽토그램: 가능하면 단순 기하 도형(선 1~2개). 로고 이미지 복잡도 최소화 (파비콘 16px에서도 식별 가능해야 함)
- 금지: 그라디언트 로고 (다크/라이트 양쪽에서 동일하게 보장 어려움), 서체 가독성 낮은 워드마크

---

## 디자인팀장 결정 필요 사항

| # | 항목 | 선택지 | UI디자이너 의견 |
|---|---|---|---|
| D1 | **Primary Accent 최종 확정** | A: 퍼플 #7C5CFF (Linear 계열) / B: 시안 #06B6D4 (테크 중립) | 퍼플 권장 — Linear 레퍼런스 70% 반영, 시안은 속도 메트릭 전용으로 분리하는 게 시스템적으로 명확 |
| D2 | **브랜드명 최종 결정** | Modex / Lensai / Benchly / 사장 직접 제안 | D2는 사장과 팀장 공동 결정 권장. 도메인 가용성 사전 확인 필수 |
| D3 | **CompareTable 모바일 UX** | A: 세로 스택(현재 스펙) / B: 가로 스크롤 고정 테이블 | A 권장 — 375px에서 컬럼 3개 이상 가로 스크롤은 수치 잘림 발생. 세로 스택+스와이프가 op.gg 모바일 패턴과 일치 |
| D4 | **ModelChip 로고 정책** | A: 텍스트 이니셜만 (현재 스펙, 저작권 안전) / B: 공식 SVG 로고 (빠른 인지, 분쟁 리스크) | A 강력 권장 — 프로젝트 방향서 §10 "텍스트 마크 우선" 확정사항 준수. 로고는 공식 허가 확인 후 점진적 도입 |

---

> 이 스펙은 UX디자이너의 `ux-spec.md`(병렬 작업)와 병합하여 `design-final.md`로 디자인팀장이 확정한다.
