# 툰일기(Toonlog) UI 디자인 명세서 v1.0
> 작성: UI디자이너 / 2026-06-03
> 기준: 프로젝트 방향서 v1.0 + 디자인팀장 확정 방향
> 기술 스택: Next.js 15 + Tailwind v4 + react-konva + Satori

---

## 목차

1. [디자인 토큰 — 컬러](#1-디자인-토큰--컬러)
2. [디자인 토큰 — 타이포그래피](#2-디자인-토큰--타이포그래피)
3. [디자인 토큰 — 스페이싱 · 레이아웃](#3-디자인-토큰--스페이싱--레이아웃)
4. [디자인 토큰 — 모션 · 이펙트](#4-디자인-토큰--모션--이펙트)
5. [Tailwind v4 @theme 전체 코드](#5-tailwind-v4-theme-전체-코드)
6. [로고 시스템](#6-로고-시스템)
7. [핵심 컴포넌트 스펙](#7-핵심-컴포넌트-스펙)
8. [화풍 4종 시각 토큰표](#8-화풍-4종-시각-토큰표)
9. [아바타 8종 디자인 가이드](#9-아바타-8종-디자인-가이드)
10. [말풍선 디자인 시스템](#10-말풍선-디자인-시스템)
11. [4컷 카드 + 공유 카드 템플릿](#11-4컷-카드--공유-카드-템플릿)
12. [워터마크 + AI 생성 고지](#12-워터마크--ai-생성-고지)
13. [아이콘 세트 가이드](#13-아이콘-세트-가이드)
14. [다크모드 전략](#14-다크모드-전략)

---

## 1. 디자인 토큰 — 컬러

### 1.1 브랜드 원색 팔레트

| 토큰명 | 라이트 | 다크 | 용도 |
|---|---|---|---|
| `--color-ink` | `#1A1A1A` | `#F0EDE8` | 만화 펜선, 본문, CTA 텍스트 |
| `--color-paper` | `#FAF7F2` | `#1C1917` | 배경, 종이 질감 베이스 |
| `--color-coral` | `#FF6B6B` | `#FF8080` | Primary CTA, 강조 액션 |
| `--color-coral-hover` | `#E55555` | `#FF9494` | CTA 호버 상태 |
| `--color-coral-active` | `#CC4444` | `#FFAAAA` | CTA 클릭 상태 |
| `--color-sky` | `#4DABF7` | `#74C0FC` | 링크, 정보성 UI |
| `--color-lemon` | `#FFE066` | `#FFD43B` | 워터마크, 형광펜 강조 |
| `--color-pencil` | `#6C757D` | `#ADB5BD` | 보조 텍스트, 아이콘 기본 |
| `--color-eraser` | `#DEE2E6` | `#343A40` | 구분선, 비활성 Border |

### 1.2 Semantic 컬러 토큰

#### Surface / Background

| 토큰명 | 라이트 | 다크 | 용도 |
|---|---|---|---|
| `--color-bg-base` | `#FAF7F2` | `#1C1917` | 앱 전체 배경 |
| `--color-bg-subtle` | `#F4F0E8` | `#292524` | 카드 배경, 입력 배경 |
| `--color-bg-muted` | `#EDE9E0` | `#3C3633` | 호버 배경, 선택 배경 |
| `--color-bg-inverse` | `#1A1A1A` | `#F0EDE8` | 다크 배경 (피처드) |
| `--color-surface-raised` | `#FFFFFF` | `#231F1C` | 카드 라이즈드, 모달 배경 |
| `--color-surface-overlay` | `rgba(26,26,26,0.48)` | `rgba(0,0,0,0.64)` | 오버레이, 딤처리 |

#### Text

| 토큰명 | 라이트 | 다크 | 용도 |
|---|---|---|---|
| `--color-text-primary` | `#1A1A1A` | `#F0EDE8` | 주요 본문, 제목 |
| `--color-text-secondary` | `#4A4540` | `#C5BFB8` | 부제목, 설명 |
| `--color-text-muted` | `#6C757D` | `#8B8178` | 메타 정보, 플레이스홀더 |
| `--color-text-disabled` | `#ADB5BD` | `#4A4540` | 비활성 텍스트 |
| `--color-text-inverse` | `#FAF7F2` | `#1A1A1A` | 다크 배경 위 텍스트 |
| `--color-text-link` | `#4DABF7` | `#74C0FC` | 링크 텍스트 |
| `--color-text-accent` | `#FF6B6B` | `#FF8080` | 강조 텍스트 |

#### Primary Action (Coral)

| 토큰명 | 라이트 | 다크 | 용도 |
|---|---|---|---|
| `--color-primary` | `#FF6B6B` | `#FF8080` | Primary 버튼/액션 배경 |
| `--color-primary-hover` | `#E55555` | `#FF9494` | 호버 |
| `--color-primary-active` | `#CC4444` | `#FFAAAA` | 클릭/프레스 |
| `--color-primary-subtle` | `#FFF0F0` | `#3D1A1A` | Primary 연한 배경 (배지, 칩) |
| `--color-primary-text` | `#FFFFFF` | `#1A1A1A` | Primary 버튼 위 텍스트 |

#### Border

| 토큰명 | 라이트 | 다크 | 용도 |
|---|---|---|---|
| `--color-border-default` | `#DEE2E6` | `#343A40` | 기본 테두리 |
| `--color-border-strong` | `#ADB5BD` | `#6C757D` | 강조 테두리 |
| `--color-border-focus` | `#4DABF7` | `#74C0FC` | 포커스 링 |
| `--color-border-error` | `#FF6B6B` | `#FF8080` | 에러 상태 테두리 |

#### Semantic Status

| 토큰명 | 라이트 | 다크 | 용도 |
|---|---|---|---|
| `--color-success` | `#2ECC71` | `#4ADE80` | 성공, 완료 |
| `--color-success-subtle` | `#EDFAF4` | `#0D2E1A` | 성공 배경 |
| `--color-warning` | `#F59E0B` | `#FBBF24` | 경고, 주의 |
| `--color-warning-subtle` | `#FFFBEB` | `#2D1F00` | 경고 배경 |
| `--color-error` | `#EF4444` | `#F87171` | 에러, 삭제 |
| `--color-error-subtle` | `#FEF2F2` | `#2D0A0A` | 에러 배경 |
| `--color-info` | `#4DABF7` | `#74C0FC` | 정보, 안내 |
| `--color-info-subtle` | `#EFF8FF` | `#0D1F2D` | 정보 배경 |

### 1.3 그레이 스케일 (Neutral)

| 토큰명 | 라이트값 | 다크값 |
|---|---|---|
| `--color-gray-50` | `#FAFAFA` | `#0A0A0A` |
| `--color-gray-100` | `#F4F4F5` | `#18181B` |
| `--color-gray-200` | `#E4E4E7` | `#27272A` |
| `--color-gray-300` | `#D4D4D8` | `#3F3F46` |
| `--color-gray-400` | `#A1A1AA` | `#52525B` |
| `--color-gray-500` | `#71717A` | `#71717A` |
| `--color-gray-600` | `#52525B` | `#A1A1AA` |
| `--color-gray-700` | `#3F3F46` | `#D4D4D8` |
| `--color-gray-800` | `#27272A` | `#E4E4E7` |
| `--color-gray-900` | `#18181B` | `#F4F4F5` |

---

## 2. 디자인 토큰 — 타이포그래피

### 2.1 폰트 패밀리

| 토큰명 | 값 | 용도 |
|---|---|---|
| `--font-sans` | `'Pretendard Variable', 'Pretendard', -apple-system, sans-serif` | 본문, UI 전반 |
| `--font-display` | `'Gmarket Sans', 'GmarketSansBold', sans-serif` | 카드 타이틀, 강조 헤드라인 |
| `--font-balloon` | `'Cafe24Danjunghae', 'NanumPen', cursive` | 말풍선 대사, 일기 인용 |
| `--font-english` | `'Inter Variable', 'Inter', sans-serif` | 영문 UI, 메타 정보 |
| `--font-logo` | `'Bagel Fat One', cursive` | 로고 워드마크 |
| `--font-mono` | `'JetBrains Mono', 'Fira Code', monospace` | 코드, 날짜/시간 (고정폭) |

### 2.2 폰트 사이즈 스케일

| 토큰명 | 값(rem) | 값(px) | 용도 |
|---|---|---|---|
| `--text-2xs` | `0.625rem` | `10px` | 법적 고지, 미세 레이블 |
| `--text-xs` | `0.75rem` | `12px` | 태그, 배지, 캡션 |
| `--text-sm` | `0.875rem` | `14px` | 보조 텍스트, 버튼 small |
| `--text-base` | `1rem` | `16px` | 기본 본문 (일기 입력) |
| `--text-md` | `1.125rem` | `18px` | 강조 본문, 버튼 기본 |
| `--text-lg` | `1.25rem` | `20px` | 소제목, 카드 제목 |
| `--text-xl` | `1.5rem` | `24px` | 섹션 헤딩 |
| `--text-2xl` | `1.875rem` | `30px` | 페이지 타이틀 |
| `--text-3xl` | `2.25rem` | `36px` | 히어로 텍스트 |
| `--text-4xl` | `3rem` | `48px` | 공유 카드 대형 타이틀 |
| `--text-5xl` | `3.75rem` | `60px` | 랜딩 강조 |

### 2.3 폰트 웨이트

| 토큰명 | 값 | 용도 |
|---|---|---|
| `--font-regular` | `400` | 본문, 설명 |
| `--font-medium` | `500` | UI 레이블, 버튼 |
| `--font-semibold` | `600` | 소제목, 강조 |
| `--font-bold` | `700` | 헤딩, CTA 버튼 |
| `--font-extrabold` | `800` | 히어로, 카드 타이틀 |

### 2.4 라인 하이트

| 토큰명 | 값 | 용도 |
|---|---|---|
| `--leading-tight` | `1.2` | 제목, 한 줄 레이블 |
| `--leading-snug` | `1.375` | 서브헤딩, 카드 요약 |
| `--leading-normal` | `1.5` | 기본 본문 |
| `--leading-relaxed` | `1.625` | 일기 입력, 긴 문단 |
| `--leading-loose` | `2.0` | 말풍선 텍스트 |

### 2.5 Letter Spacing

| 토큰명 | 값 | 용도 |
|---|---|---|
| `--tracking-tighter` | `-0.05em` | 대형 디스플레이 제목 |
| `--tracking-tight` | `-0.025em` | 헤딩 |
| `--tracking-normal` | `0em` | 기본 |
| `--tracking-wide` | `0.025em` | UI 레이블, 버튼 |
| `--tracking-wider` | `0.05em` | 캡션, 배지 |
| `--tracking-widest` | `0.1em` | 대문자 레이블 |

### 2.6 타이포그래피 조합 스케일 (합성 토큰)

| 클래스명 | 폰트 | 사이즈 | 웨이트 | 라인높이 | 용도 |
|---|---|---|---|---|---|
| `.type-display-lg` | Gmarket Sans | 3xl | extrabold | tight | 공유 카드 메인 제목 |
| `.type-display-md` | Gmarket Sans | 2xl | bold | tight | 페이지 타이틀 |
| `.type-heading-lg` | Pretendard | xl | bold | snug | 섹션 헤딩 |
| `.type-heading-md` | Pretendard | lg | semibold | snug | 카드 타이틀 |
| `.type-heading-sm` | Pretendard | md | semibold | normal | 그룹 레이블 |
| `.type-body-lg` | Pretendard | md | regular | relaxed | 일기 입력 본문 |
| `.type-body-md` | Pretendard | base | regular | normal | 기본 본문 |
| `.type-body-sm` | Pretendard | sm | regular | normal | 설명 텍스트 |
| `.type-caption` | Pretendard | xs | regular | normal | 메타, 캡션 |
| `.type-label-lg` | Pretendard | sm | medium | tight | 버튼, UI 레이블 |
| `.type-label-sm` | Pretendard | xs | medium | tight | 배지, 태그 |
| `.type-balloon` | Cafe24Danjunghae | base | regular | loose | 말풍선 대사 |
| `.type-legal` | Pretendard | 2xs | regular | normal | 법적 고지 |

---

## 3. 디자인 토큰 — 스페이싱 · 레이아웃

### 3.1 스페이싱 스케일

기본 단위: `4px (0.25rem)`

| 토큰명 | 값(rem) | 값(px) | 용도 |
|---|---|---|---|
| `--space-0` | `0` | `0px` | — |
| `--space-px` | `0.0625rem` | `1px` | 미세 오프셋 |
| `--space-0.5` | `0.125rem` | `2px` | 아이콘 내부 패딩 |
| `--space-1` | `0.25rem` | `4px` | 최소 간격 |
| `--space-1.5` | `0.375rem` | `6px` | 아이콘-텍스트 간격 |
| `--space-2` | `0.5rem` | `8px` | 인라인 패딩 |
| `--space-2.5` | `0.625rem` | `10px` | 작은 패딩 |
| `--space-3` | `0.75rem` | `12px` | 컴포넌트 내부 패딩 small |
| `--space-4` | `1rem` | `16px` | 기본 패딩/간격 |
| `--space-5` | `1.25rem` | `20px` | 컴포넌트 간 간격 |
| `--space-6` | `1.5rem` | `24px` | 섹션 내 여백 |
| `--space-8` | `2rem` | `32px` | 카드 내부 패딩 |
| `--space-10` | `2.5rem` | `40px` | 섹션 간 여백 |
| `--space-12` | `3rem` | `48px` | 카드 외곽 여백, 페이지 상하 패딩 |
| `--space-14` | `3.5rem` | `56px` | 탭바 높이 |
| `--space-16` | `4rem` | `64px` | 헤더 높이 |
| `--space-20` | `5rem` | `80px` | 대형 섹션 간격 |
| `--space-24` | `6rem` | `96px` | 히어로 패딩 |

### 3.2 Border Radius

| 토큰명 | 값 | 용도 |
|---|---|---|
| `--radius-none` | `0` | 만화 컷 외곽, 펜선 요소 |
| `--radius-sm` | `4px` | 배지, 태그 작은 요소 |
| `--radius-md` | `8px` | 버튼 small, 인풋 |
| `--radius-lg` | `12px` | 카드, 버튼 기본 |
| `--radius-xl` | `16px` | 모달, 바텀시트 상단 |
| `--radius-2xl` | `24px` | 말풍선 대사형 |
| `--radius-3xl` | `32px` | 아바타 컨테이너 |
| `--radius-full` | `9999px` | 알약형 버튼, 컷 번호 원형 |

### 3.3 Box Shadow

| 토큰명 | 값 | 용도 |
|---|---|---|
| `--shadow-xs` | `0 1px 2px rgba(26,26,26,0.06)` | 미세 올라옴 |
| `--shadow-sm` | `0 1px 4px rgba(26,26,26,0.10)` | 기본 카드 |
| `--shadow-md` | `0 4px 12px rgba(26,26,26,0.12)` | 라이즈드 카드 |
| `--shadow-lg` | `0 8px 24px rgba(26,26,26,0.16)` | 모달, 드롭다운 |
| `--shadow-xl` | `0 16px 48px rgba(26,26,26,0.20)` | 바텀시트, 공유 카드 |
| `--shadow-ink` | `3px 3px 0 rgba(26,26,26,0.85)` | 만화 스타일 그림자 (키치) |
| `--shadow-ink-sm` | `2px 2px 0 rgba(26,26,26,0.85)` | 소형 키치 요소 |
| `--shadow-focus` | `0 0 0 3px rgba(77,171,247,0.40)` | 포커스 링 |
| `--shadow-focus-error` | `0 0 0 3px rgba(255,107,107,0.35)` | 에러 포커스 링 |

### 3.4 Z-Index

| 토큰명 | 값 | 용도 |
|---|---|---|
| `--z-base` | `0` | 기본 레이어 |
| `--z-raised` | `10` | 카드 호버 상태 |
| `--z-dropdown` | `100` | 드롭다운, 팝오버 |
| `--z-sticky` | `200` | 스티키 헤더 |
| `--z-overlay` | `300` | 오버레이 배경 |
| `--z-modal` | `400` | 모달, 바텀시트 |
| `--z-toast` | `500` | 토스트 알림 |
| `--z-tooltip` | `600` | 툴팁 |
| `--z-max` | `9999` | 강제 최상위 |

### 3.5 Breakpoint

| 토큰명 | 값 | 기준 |
|---|---|---|
| `--screen-mobile` | `430px` | 모바일 기준 (iPhone 최대폭) |
| `--screen-tablet` | `768px` | 태블릿 세로 |
| `--screen-desktop` | `1024px` | 데스크톱 |
| `--screen-wide` | `1280px` | 와이드 데스크톱 |

**그리드 시스템**

| 화면 | 컬럼 | 거터 | 사이드 패딩 |
|---|---|---|---|
| 모바일 (< 430px) | 4컬럼 | 16px | 20px |
| 태블릿 (768px+) | 8컬럼 | 20px | 32px |
| 데스크톱 (1024px+) | 12컬럼 | 24px | 48px |

### 3.6 히트 에어리어 (모바일 터치)

- 최소 터치 히트 에어리어: **44×44px** (WCAG 2.5.5)
- 말풍선 에디터 핸들: **48×48px** (react-konva 터치 타겟)
- 화풍 선택 카드: **최소 height 80px**
- 아바타 선택 셀: **최소 72×72px**

---

## 4. 디자인 토큰 — 모션 · 이펙트

### 4.1 Duration (지속 시간)

| 토큰명 | 값 | 용도 |
|---|---|---|
| `--duration-instant` | `0ms` | 즉각 피드백 |
| `--duration-fast` | `100ms` | 버튼 클릭, 체크박스 |
| `--duration-normal` | `200ms` | 기본 호버/포커스 트랜지션 |
| `--duration-slow` | `300ms` | 패널 슬라이드, 모달 등장 |
| `--duration-xslow` | `500ms` | 바텀시트, 페이지 전환 |
| `--duration-loading` | `800ms` | 스켈레톤 펄스 사이클 |
| `--duration-generation` | `1200ms` | 4컷 생성 진행 애니메이션 사이클 |

### 4.2 Easing

| 토큰명 | 값 | 용도 |
|---|---|---|
| `--ease-linear` | `linear` | 로딩 바 등 균일 진행 |
| `--ease-in` | `cubic-bezier(0.4, 0, 1, 1)` | 요소 퇴장 |
| `--ease-out` | `cubic-bezier(0, 0, 0.2, 1)` | 요소 등장, 드롭 |
| `--ease-in-out` | `cubic-bezier(0.4, 0, 0.2, 1)` | 기본 상태 변화 |
| `--ease-spring` | `cubic-bezier(0.34, 1.56, 0.64, 1)` | 바운스 피드백 (버튼 클릭) |
| `--ease-draw` | `cubic-bezier(0.25, 0.46, 0.45, 0.94)` | 만화 선 그리기 애니메이션 |

### 4.3 특수 모션

| 효과 | 트리거 | 구현 | 값 |
|---|---|---|---|
| 스켈레톤 펄스 | 로딩 | shimmer gradient animation | 200→100→200% background-position |
| 4컷 카드 등장 | SSE 컷 도착 | 위→아래 fade-slide | translateY(12px)→0, opacity 0→1, 300ms ease-out |
| 버튼 프레스 | active | scale | scale(0.96), 100ms ease-spring |
| 바텀시트 등장 | open | slide up | translateY(100%)→0, 500ms ease-out |
| 토스트 | show | slide + fade | translateY(8px)→0 + opacity, 200ms ease-out |
| 아바타 선택 | click | bounce | scale(1)→(1.08)→(1), 200ms ease-spring |
| 말풍선 배치 | drop | scale | scale(0.85)→1, 150ms ease-spring |
| 프로그레스 | generation | draw bar | width 0→100%, linear, 실제 진행 동기화 |
| 컷 번호 | 등장 | pop | scale(0)→(1.15)→(1), 250ms |

---

## 5. Tailwind v4 @theme 전체 코드

```css
/* tailwind.css — @theme 블록 (Tailwind v4) */
/* 이 파일을 globals.css 상단에 import 또는 직접 포함 */

@import "tailwindcss";

@theme {
  /* ========================
     BREAKPOINTS
     ======================== */
  --breakpoint-sm: 430px;
  --breakpoint-md: 768px;
  --breakpoint-lg: 1024px;
  --breakpoint-xl: 1280px;

  /* ========================
     FONTS
     ======================== */
  --font-sans: 'Pretendard Variable', 'Pretendard', -apple-system, BlinkMacSystemFont, sans-serif;
  --font-display: 'Gmarket Sans', 'GmarketSansBold', sans-serif;
  --font-balloon: 'Cafe24Danjunghae', 'NanumPen', cursive;
  --font-english: 'Inter Variable', 'Inter', sans-serif;
  --font-logo: 'Bagel Fat One', cursive;
  --font-mono: 'JetBrains Mono', 'Fira Code', monospace;

  /* ========================
     FONT SIZES
     ======================== */
  --text-2xs: 0.625rem;
  --text-xs: 0.75rem;
  --text-sm: 0.875rem;
  --text-base: 1rem;
  --text-md: 1.125rem;
  --text-lg: 1.25rem;
  --text-xl: 1.5rem;
  --text-2xl: 1.875rem;
  --text-3xl: 2.25rem;
  --text-4xl: 3rem;
  --text-5xl: 3.75rem;

  /* ========================
     FONT WEIGHTS
     ======================== */
  --font-weight-regular: 400;
  --font-weight-medium: 500;
  --font-weight-semibold: 600;
  --font-weight-bold: 700;
  --font-weight-extrabold: 800;

  /* ========================
     LINE HEIGHTS
     ======================== */
  --leading-tight: 1.2;
  --leading-snug: 1.375;
  --leading-normal: 1.5;
  --leading-relaxed: 1.625;
  --leading-loose: 2.0;

  /* ========================
     LETTER SPACING
     ======================== */
  --tracking-tighter: -0.05em;
  --tracking-tight: -0.025em;
  --tracking-normal: 0em;
  --tracking-wide: 0.025em;
  --tracking-wider: 0.05em;
  --tracking-widest: 0.1em;

  /* ========================
     SPACING
     ======================== */
  --spacing-px: 1px;
  --spacing-0: 0;
  --spacing-0_5: 0.125rem;
  --spacing-1: 0.25rem;
  --spacing-1_5: 0.375rem;
  --spacing-2: 0.5rem;
  --spacing-2_5: 0.625rem;
  --spacing-3: 0.75rem;
  --spacing-4: 1rem;
  --spacing-5: 1.25rem;
  --spacing-6: 1.5rem;
  --spacing-8: 2rem;
  --spacing-10: 2.5rem;
  --spacing-12: 3rem;
  --spacing-14: 3.5rem;
  --spacing-16: 4rem;
  --spacing-20: 5rem;
  --spacing-24: 6rem;

  /* ========================
     BORDER RADIUS
     ======================== */
  --radius-none: 0;
  --radius-sm: 4px;
  --radius-md: 8px;
  --radius-lg: 12px;
  --radius-xl: 16px;
  --radius-2xl: 24px;
  --radius-3xl: 32px;
  --radius-full: 9999px;

  /* ========================
     SHADOWS
     ======================== */
  --shadow-xs: 0 1px 2px rgb(26 26 26 / 0.06);
  --shadow-sm: 0 1px 4px rgb(26 26 26 / 0.10);
  --shadow-md: 0 4px 12px rgb(26 26 26 / 0.12);
  --shadow-lg: 0 8px 24px rgb(26 26 26 / 0.16);
  --shadow-xl: 0 16px 48px rgb(26 26 26 / 0.20);
  --shadow-ink: 3px 3px 0 rgb(26 26 26 / 0.85);
  --shadow-ink-sm: 2px 2px 0 rgb(26 26 26 / 0.85);
  --shadow-focus: 0 0 0 3px rgb(77 171 247 / 0.40);
  --shadow-focus-error: 0 0 0 3px rgb(255 107 107 / 0.35);

  /* ========================
     Z-INDEX
     ======================== */
  --z-base: 0;
  --z-raised: 10;
  --z-dropdown: 100;
  --z-sticky: 200;
  --z-overlay: 300;
  --z-modal: 400;
  --z-toast: 500;
  --z-tooltip: 600;
  --z-max: 9999;

  /* ========================
     MOTION
     ======================== */
  --duration-instant: 0ms;
  --duration-fast: 100ms;
  --duration-normal: 200ms;
  --duration-slow: 300ms;
  --duration-xslow: 500ms;
  --duration-loading: 800ms;
  --duration-generation: 1200ms;

  --ease-linear: linear;
  --ease-in: cubic-bezier(0.4, 0, 1, 1);
  --ease-out: cubic-bezier(0, 0, 0.2, 1);
  --ease-in-out: cubic-bezier(0.4, 0, 0.2, 1);
  --ease-spring: cubic-bezier(0.34, 1.56, 0.64, 1);
  --ease-draw: cubic-bezier(0.25, 0.46, 0.45, 0.94);

  /* ========================
     COLORS — BRAND PRIMITIVES
     ======================== */
  --color-ink: #1A1A1A;
  --color-paper: #FAF7F2;
  --color-coral: #FF6B6B;
  --color-coral-hover: #E55555;
  --color-coral-active: #CC4444;
  --color-sky: #4DABF7;
  --color-lemon: #FFE066;
  --color-pencil: #6C757D;
  --color-eraser: #DEE2E6;

  /* ========================
     COLORS — SEMANTIC (LIGHT DEFAULT)
     ======================== */
  /* Background */
  --color-bg-base: #FAF7F2;
  --color-bg-subtle: #F4F0E8;
  --color-bg-muted: #EDE9E0;
  --color-bg-inverse: #1A1A1A;
  --color-surface-raised: #FFFFFF;
  --color-surface-overlay: rgb(26 26 26 / 0.48);

  /* Text */
  --color-text-primary: #1A1A1A;
  --color-text-secondary: #4A4540;
  --color-text-muted: #6C757D;
  --color-text-disabled: #ADB5BD;
  --color-text-inverse: #FAF7F2;
  --color-text-link: #4DABF7;
  --color-text-accent: #FF6B6B;

  /* Primary */
  --color-primary: #FF6B6B;
  --color-primary-hover: #E55555;
  --color-primary-active: #CC4444;
  --color-primary-subtle: #FFF0F0;
  --color-primary-text: #FFFFFF;

  /* Border */
  --color-border-default: #DEE2E6;
  --color-border-strong: #ADB5BD;
  --color-border-focus: #4DABF7;
  --color-border-error: #FF6B6B;

  /* Status */
  --color-success: #2ECC71;
  --color-success-subtle: #EDFAF4;
  --color-warning: #F59E0B;
  --color-warning-subtle: #FFFBEB;
  --color-error: #EF4444;
  --color-error-subtle: #FEF2F2;
  --color-info: #4DABF7;
  --color-info-subtle: #EFF8FF;
}

/* ========================
   DARK MODE TOKEN OVERRIDES
   ======================== */
@media (prefers-color-scheme: dark) {
  :root {
    --color-bg-base: #1C1917;
    --color-bg-subtle: #292524;
    --color-bg-muted: #3C3633;
    --color-bg-inverse: #F0EDE8;
    --color-surface-raised: #231F1C;
    --color-surface-overlay: rgb(0 0 0 / 0.64);

    --color-text-primary: #F0EDE8;
    --color-text-secondary: #C5BFB8;
    --color-text-muted: #8B8178;
    --color-text-disabled: #4A4540;
    --color-text-inverse: #1A1A1A;
    --color-text-link: #74C0FC;
    --color-text-accent: #FF8080;

    --color-primary: #FF8080;
    --color-primary-hover: #FF9494;
    --color-primary-active: #FFAAAA;
    --color-primary-subtle: #3D1A1A;
    --color-primary-text: #1A1A1A;

    --color-border-default: #343A40;
    --color-border-strong: #6C757D;
    --color-border-focus: #74C0FC;
    --color-border-error: #FF8080;

    --color-success: #4ADE80;
    --color-success-subtle: #0D2E1A;
    --color-warning: #FBBF24;
    --color-warning-subtle: #2D1F00;
    --color-error: #F87171;
    --color-error-subtle: #2D0A0A;
    --color-info: #74C0FC;
    --color-info-subtle: #0D1F2D;

    --color-coral: #FF8080;
    --color-sky: #74C0FC;
    --color-lemon: #FFD43B;
    --color-pencil: #ADB5BD;
    --color-eraser: #343A40;
  }
}

/* data-theme 속성 기반 강제 다크 (시스템 무관) */
[data-theme="dark"] {
  --color-bg-base: #1C1917;
  /* ... (위와 동일) */
}
```

---

## 6. 로고 시스템

### 6.1 심볼 컨셉 상세

**형태**: 말풍선(대사형 타원) 안에 일기장 줄(가로 rule line 3개)이 그려진 모노그램
- 말풍선 외곽: 2px solid Ink, 둥근 모서리 radius 24px
- 내부 줄: 1px solid, 3줄, 간격 균등, 가운데 줄만 Coral 강조색
- 꼬리: 좌하단 방향, 말풍선 대사형 꼬리, 펜선 스타일

**의미**: "내 이야기(일기)를 만화(말풍선)로 만든다" — 브랜드 핵심 가치 시각화

### 6.2 워드마크

- "툰일기" (한글) — Bagel Fat One, 폰트 사이즈 로고 맥락 가변, 자간 -0.02em
- "Toonlog" (영문) — Bagel Fat One, 자간 -0.01em
- 기본 조합: 심볼 + "툰일기" 우측 배치, 수직 중앙 정렬
- 선택 조합: 심볼 단독 (파비콘, 앱 아이콘)

### 6.3 컬러 변형

| 변형 | 배경 | 심볼 | 워드마크 | 용도 |
|---|---|---|---|---|
| Primary (라이트) | Paper White | Ink + Coral 강조줄 | Ink | 기본 라이트 배경 |
| Primary (다크) | Ink | Paper White + Coral 강조줄 | Paper White | 다크 배경 |
| Mono White | 투명 | White | White | 다크 배경 위 단색 |
| Mono Black | 투명 | Black | Black | 인쇄, 라이트 위 단색 |
| Coral (키치) | Coral | White | White | 공유 카드, 특별 캠페인 |

### 6.4 클리어스페이스

- 최소 클리어스페이스: 심볼 높이의 **0.5배** 사방
- 클리어스페이스 내 다른 텍스트/요소 배치 금지

### 6.5 최소 크기

| 사용처 | 최소 크기 |
|---|---|
| 심볼+워드마크 조합 | 높이 24px |
| 심볼 단독 | 16px × 16px |
| 앱 아이콘 | 최소 32px × 32px |

### 6.6 사용 금지

- 기울임 변형 금지
- 외곽선(stroke)만 남기는 아웃라인 변형 금지
- 배경색과 대비 3:1 미달 조합 사용 금지
- 이미지 위에 배치 시 투명도 없이 단색 버전 사용

---

## 7. 핵심 컴포넌트 스펙

> 상태 5종: `default` / `hover` / `active` / `disabled` / `loading`
> 모바일 퍼스트 기준 (430px), 다크모드 병행 명시

---

### 7.1 Button

#### Button — Primary (Coral CTA)

```
크기: height 48px (md), 40px (sm), 56px (lg)
패딩: 수평 24px (md), 16px (sm), 32px (lg)
폰트: Pretendard, 16px, font-weight 700, tracking-wide
반경: radius-lg (12px)
min-width: 120px
```

| 상태 | 배경 | 텍스트 | 테두리 | 그림자 | 기타 |
|---|---|---|---|---|---|
| default | `--color-primary` | White | none | shadow-ink-sm | — |
| hover | `--color-primary-hover` | White | none | shadow-ink | translateY(-1px) |
| active | `--color-primary-active` | White | none | shadow-xs | scale(0.97) |
| disabled | `--color-border-default` | `--color-text-disabled` | none | none | cursor-not-allowed, opacity 0.5 |
| loading | `--color-primary` | transparent | none | shadow-ink-sm | Spinner 오버레이 (White, 20px) |

#### Button — Secondary

| 상태 | 배경 | 텍스트 | 테두리 | 그림자 |
|---|---|---|---|---|
| default | transparent | `--color-text-primary` | 1.5px solid `--color-border-default` | none |
| hover | `--color-bg-subtle` | `--color-text-primary` | 1.5px solid `--color-border-strong` | shadow-xs |
| active | `--color-bg-muted` | `--color-text-primary` | 1.5px solid `--color-border-strong` | none |
| disabled | transparent | `--color-text-disabled` | 1px solid `--color-border-default` | none |
| loading | transparent | transparent | 1.5px solid `--color-border-default` | none |

#### Button — Ghost

| 상태 | 배경 | 텍스트 | 테두리 |
|---|---|---|---|
| default | transparent | `--color-primary` | none |
| hover | `--color-primary-subtle` | `--color-primary-hover` | none |
| active | `--color-primary-subtle` | `--color-primary-active` | none |
| disabled | transparent | `--color-text-disabled` | none |

#### Button — Danger

| 상태 | 배경 | 텍스트 | 테두리 |
|---|---|---|---|
| default | `--color-error` | White | none |
| hover | `#DC2626` | White | none |
| active | `#B91C1C` | White | none |
| disabled | `--color-bg-subtle` | `--color-text-disabled` | none |

#### Button — Icon Only

```
크기: 44×44px (md), 36×36px (sm), 52×52px (lg)
반경: radius-lg 또는 radius-full (원형 변형)
아이콘: 20px (md 기준)
```

---

### 7.2 Input / Textarea (일기 입력)

#### Text Input

```
height: 48px
padding: 수직 14px, 수평 16px
폰트: Pretendard, 16px, font-weight 400
반경: radius-lg (12px)
border: 1.5px solid
transition: border-color 200ms ease-in-out, box-shadow 200ms
```

| 상태 | 배경 | 테두리 | 텍스트 | 그림자 |
|---|---|---|---|---|
| default | `--color-bg-subtle` | `--color-border-default` | `--color-text-primary` | none |
| hover | `--color-bg-subtle` | `--color-border-strong` | `--color-text-primary` | none |
| focus | `--color-surface-raised` | `--color-border-focus` | `--color-text-primary` | shadow-focus |
| filled | `--color-bg-subtle` | `--color-border-default` | `--color-text-primary` | none |
| error | `--color-error-subtle` | `--color-border-error` | `--color-text-primary` | shadow-focus-error |
| disabled | `--color-bg-muted` | `--color-border-default` | `--color-text-disabled` | none |

**레이블**: 12px, Pretendard, font-weight 500, `--color-text-secondary`, 인풋 위 8px
**플레이스홀더**: `--color-text-muted`
**에러 메시지**: 12px, `--color-error`, 인풋 아래 4px
**카운터**: 12px, `--color-text-muted`, 인풋 우측 하단 (textarea 전용)

#### Textarea (일기 입력용)

```
min-height: 200px (모바일), 280px (데스크톱)
max-height: 480px
padding: 16px
resize: none (자동 높이 확장)
폰트: Pretendard Variable, 16px, line-height 1.625 (--leading-relaxed)
```

**특이사항**:
- 일기 입력 textarea는 배경을 **종이 질감** CSS 패턴으로 처리
  ```css
  background-image: repeating-linear-gradient(
    transparent,
    transparent 31px,
    var(--color-border-default) 31px,
    var(--color-border-default) 32px
  );
  background-attachment: local;
  ```
- 글자 수 실시간 카운터: 하단 우측, `현재수/최대수` 형식, 900자 초과 시 `--color-warning`으로 전환

#### Select (화풍 선택 드롭다운)

```
height: 48px
padding: 0 16px
아이콘: 우측 ChevronDown 16px, --color-text-muted
appearance: none
```

#### Checkbox / Radio

```
크기: 20×20px (체크박스 정사각, 라디오 원형)
체크 시: --color-primary 배경 + White 체크마크/도트
미체크: 2px border --color-border-default
포커스: shadow-focus
disabled: opacity 0.5
```

---

### 7.3 Card

#### 기본 카드

```
배경: --color-surface-raised
반경: radius-xl (16px)
패딩: 16px (모바일), 20px (데스크톱)
border: 1px solid --color-border-default
shadow: shadow-sm
transition: shadow 200ms ease-out, transform 200ms ease-out
```

| 상태 | shadow | transform |
|---|---|---|
| default | shadow-sm | none |
| hover | shadow-md | translateY(-2px) |
| active | shadow-xs | translateY(0) |

#### 4컷 만화 카드

```
배경: --color-surface-raised
반경: radius-lg (12px)
테두리: 2px solid --color-ink (만화 스타일)
shadow: shadow-ink
오버플로: hidden
가로세로비: 1:1 (모바일 기본 — 1080×1080 기준)
```

#### 화풍 선택 카드 (이하 §7.10에서 상세)

---

### 7.4 BottomSheet

```
배경: --color-surface-raised
반경: 상단 radius-xl (16px), 하단 0
shadow: shadow-xl
max-height: 90dvh
패딩: 8px (드래그 핸들 영역) + 20px (콘텐츠)
z-index: --z-modal
```

**드래그 핸들**:
```
width: 40px
height: 4px
배경: --color-border-strong
반경: radius-full
위치: 상단 중앙 8px 아래
```

**애니메이션**:
- 등장: translateY(100%) → 0, 500ms ease-out
- 퇴장: translateY(100%), 300ms ease-in
- 백드롭: opacity 0 → 1, 300ms

**스크롤 처리**: 내부 콘텐츠 스크롤 가능, 바텀시트 상단 드래그 시 닫힘

---

### 7.5 Chip / Tag

#### 화풍/카테고리 칩

```
height: 32px (기본), 28px (small)
padding: 수평 12px
폰트: 12px, font-weight 500
반경: radius-full
border: 1.5px solid
```

| 상태 | 배경 | 테두리 | 텍스트 |
|---|---|---|---|
| default | --color-bg-subtle | --color-border-default | --color-text-secondary |
| hover | --color-bg-muted | --color-border-strong | --color-text-primary |
| selected | --color-primary-subtle | --color-primary | --color-primary |
| disabled | --color-bg-subtle | --color-border-default | --color-text-disabled |

#### 요금제 배지

```
height: 20px
padding: 수평 8px
폰트: 10px, font-weight 600, tracking-wider
반경: radius-sm
```

| 티어 | 배경 | 텍스트 |
|---|---|---|
| 무료 | --color-bg-muted | --color-text-secondary |
| 베이직 | --color-sky (투명도 0.15) | --color-sky |
| 프로 | --color-lemon (투명도 0.20) | #B7860A |
| 얼리버드 | --color-coral (투명도 0.15) | --color-coral |

---

### 7.6 Toggle (다크모드 등)

```
width: 48px, height: 28px
반경: radius-full
thumb: 22×22px, 라이트 배경 White, 위치 translateX(2px) off / translateX(22px) on
transition: 200ms ease-in-out
```

| 상태 | 트랙 배경 | 섀도 |
|---|---|---|
| off | --color-border-strong | none |
| on | --color-primary | none |
| disabled (off) | --color-bg-muted | none |
| disabled (on) | --color-primary (opacity 0.4) | none |
| focus | — | shadow-focus |

---

### 7.7 Modal / Dialog

```
배경: --color-surface-raised
반경: radius-xl (16px)
max-width: 320px (모바일), 480px (데스크톱)
padding: 24px
shadow: shadow-xl
z-index: --z-modal
백드롭: --color-surface-overlay (blur 4px)
```

**구성 요소**:
- 헤더: 제목 (18px bold) + 닫기 버튼 (44×44px, X 아이콘)
- 콘텐츠 영역: 패딩 내 자유 배치
- 액션 영역: 하단, 버튼 1~2개 (취소=Secondary, 확인=Primary)

**애니메이션**: scale(0.95)+opacity(0) → scale(1)+opacity(1), 200ms ease-out

---

### 7.8 Toast

```
height: 48px (single line), 최대 64px
width: calc(100vw - 40px), max-width 380px
padding: 수직 12px, 수평 16px
반경: radius-lg (12px)
shadow: shadow-lg
z-index: --z-toast
위치: 하단 중앙, bottom: 24px (탭바 위 20px 이격)
폰트: 14px, font-weight 500
```

| 타입 | 배경 | 텍스트 | 아이콘 |
|---|---|---|---|
| default | --color-bg-inverse | --color-text-inverse | White |
| success | --color-success | White | CheckCircle |
| warning | --color-warning | White | AlertTriangle |
| error | --color-error | White | XCircle |
| info | --color-sky | White | InfoCircle |

**자동 소멸**: 3초 (에러/경고는 4초), 스와이프 업으로 수동 닫기

---

### 7.9 Skeleton

```
배경: --color-bg-muted
반경: 콘텐츠와 동일 반경 사용
animation: shimmer 800ms ease-in-out infinite alternate
```

```css
@keyframes shimmer {
  from { background-color: var(--color-bg-muted); }
  to   { background-color: var(--color-bg-subtle); }
}
```

**4컷 카드 스켈레톤**:
- 2×2 그리드 각 컷 셀에 동일 크기 Skeleton
- 각 컷마다 100ms delay 차이 (왼쪽 위 → 오른쪽 아래 순)
- 하단에 제목 Skeleton (너비 60%, height 16px) + 날짜 (너비 30%, height 12px)

**일기 목록 스켈레톤**: 카드 height 80px, 아바타 40×40px 원형 + 텍스트 2줄

---

### 7.10 ProgressBar (4컷 생성 대기)

```
width: 100%
height: 8px
반경: radius-full
배경: --color-bg-muted
바: --color-primary (라이트), 그라디언트 옵션: linear-gradient(90deg, --color-coral, --color-lemon)
transition: width linear, 실제 SSE 진행과 동기화
```

**생성 진행 UI 전체 구성**:

```
[아바타 애니메이션 영역]
  - 선택된 아바타 캐릭터: 연필로 그리는 드로잉 애니메이션 (stroke-dashoffset CSS)
  - 너비 120px, 중앙 배치

[컷 진행 표시]
  1컷 [완료] 2컷 [생성 중...] 3컷 [대기] 4컷 [대기]
  - 각 스텝 24×24px 원형 (완료=Coral fill+Check, 중=Coral border+Spinner, 대기=gray)

[프로그레스 바]
  height: 8px, 너비 100%, Coral 계열

[메시지]
  "2번째 컷을 그리는 중..."
  14px, --color-text-secondary, 중앙 정렬

[취소 링크]
  "생성 취소" — Ghost 버튼 small, 우측 상단
```

---

### 7.11 Avatar Selector

아바타 선택 UI는 "캐릭터 꾸미기" 바텀시트에서 표시됨.

**그리드**: 2열 × 4행 = 아바타 8종 카드

```
각 셀:
  width: (100% - gap) / 2
  padding: 12px
  반경: radius-xl
  border: 2px solid --color-border-default
  배경: --color-bg-subtle
```

| 상태 | 테두리 | 배경 | 그림자 |
|---|---|---|---|
| default | --color-border-default | --color-bg-subtle | none |
| hover | --color-border-strong | --color-bg-muted | shadow-xs |
| selected | --color-primary (2.5px) | --color-primary-subtle | shadow-focus |
| disabled | --color-border-default | --color-bg-muted | none |

**커스텀 슬라이더 (선택 후 표시)**:
- 헤어컬러 8종: 20px 원형 스와치, 가로 스크롤
- 상의 8종: 아이콘+텍스트 칩
- 액세서리 4종: 안경/모자/이어폰/없음 — 아이콘 토글 버튼

---

### 7.12 화풍 선택 카드

```
width: 100%
height: 100px
반경: radius-xl (16px)
border: 2px solid
overflow: hidden
```

**내부 구성**:
- 좌측 1/3: 썸네일 이미지 영역 (화풍 샘플, 배경 채움)
- 우측 2/3: 화풍명 (16px bold) + 한 줄 설명 (12px muted)
- 우측 끝: 라디오 인디케이터 원형 (22px)

| 상태 | 테두리 | 배경 |
|---|---|---|
| default | --color-border-default | --color-surface-raised |
| hover | --color-border-strong | --color-bg-subtle |
| selected | --color-primary (2.5px) | --color-primary-subtle |

---

### 7.13 요금제 카드 (Pricing Card)

```
width: 100% (모바일 세로 배치), max-width 320px (데스크톱 3열)
반경: radius-2xl (24px)
padding: 24px
border: 2px solid --color-border-default
shadow: shadow-md
```

**프로 티어 강조**:
- 테두리: 2px solid --color-lemon
- 최상단 뱃지: "가장 인기" — Lemon 배경 + Ink 텍스트, 12px, 카드 상단 중앙 offset -12px
- shadow-ink (키치 스타일)

**카드 구성**:
```
[배지 영역] — 프로만 표시
[티어명] 20px bold
[가격] 32px extrabold / 월 12px regular
[연간 할인] 12px muted (연간 결제 시 x개월 무료)
[구분선]
[기능 목록] 14px, CheckCircle 아이콘 (Coral) 좌측
[CTA 버튼] 하단 전폭, Primary or Secondary
```

---

### 7.14 말풍선 컴포넌트 (react-konva 에디터)

이하 §10 말풍선 디자인 시스템에서 상세 명세.

---

## 8. 화풍 4종 시각 토큰표

### 8.1 감성 라인 (Emotional Line)

| 속성 | 값 |
|---|---|
| **선 굵기** | 0.5~1px 가변 (가장 얇음) |
| **채도** | 30~40% (파스텔) |
| **명암** | 셀셰이딩 1단계 (그림자 단색 1개) |
| **배경** | Paper White + 미세 lin-gradient 종이 질감 |
| **색 팔레트** | 파스텔 핑크 `#FECDD3`, 파스텔 스카이 `#BAE6FD`, 파스텔 민트 `#A7F3D0`, 크림 `#FEF3C7` |
| **텍스처** | 미세 grain (CSS noise overlay, opacity 0.06) |
| **분위기** | 잔잔, 따뜻, 일상적 |
| **주요 폰트** | Cafe24Danjunghae (말풍선) |

**프롬프트 캘리브레이션 키워드 (백엔드 전달)**:
```json
{
  "style": "emotional_line",
  "keywords": [
    "thin line art 0.5-1px",
    "pastel color palette",
    "soft shading single tone",
    "warm cozy atmosphere",
    "shoujo manga style",
    "minimal cel shading",
    "light paper texture",
    "low saturation 30-40%"
  ],
  "negative_keywords": [
    "bold lines",
    "high contrast",
    "bright neon colors",
    "heavy shadows",
    "cross-hatching"
  ],
  "line_weight_range": [0.5, 1.0],
  "saturation_range": [30, 40],
  "shadow_layers": 1
}
```

**합격 기준**:
- 선 굵기 일관성: 동일 컷 내 최대 선 굵기 편차 0.3px 이내
- 채도 평균: 30~45% (HSL 기준)
- 배경 vs 인물 채도 차: 10% 이내
- 인물 4컷 간 외곽선 스타일 일치도: 시각 검수 Pass
- 분위기 평가: 내부 검수 3인 중 2인 "잔잔/따뜻" 선택

---

### 8.2 대담한 펜선 (Bold Pen)

| 속성 | 값 |
|---|---|
| **선 굵기** | 2~4px 가변 굵기 (외곽 4px, 내부 디테일 2px) |
| **채도** | 60~80% (강렬) |
| **명암** | 강한 대비, 흑백 명암 + 망점(halftone) 패턴 |
| **배경** | Ink 또는 White + 스크린톤(25% dot pattern) |
| **색 팔레트** | Ink `#1A1A1A`, Pure White `#FFFFFF`, Coral `#FF6B6B`, Lemon `#FFE066` (포인트만) |
| **텍스처** | Halftone dot 25% (스크린톤 오마주) |
| **분위기** | 임팩트, 강렬, 드라마틱 |

**프롬프트 캘리브레이션 키워드**:
```json
{
  "style": "bold_pen",
  "keywords": [
    "bold ink lines 2-4px variable weight",
    "high contrast black and white",
    "halftone screen tone pattern",
    "dramatic shading",
    "seinen manga style",
    "strong outlines",
    "limited color accent",
    "comic book style"
  ],
  "negative_keywords": [
    "thin lines",
    "pastel colors",
    "full color painting",
    "watercolor",
    "soft edges"
  ],
  "line_weight_range": [2.0, 4.0],
  "saturation_range": [0, 20],
  "accent_saturation": [60, 80],
  "shadow_layers": "high_contrast",
  "halftone": true
}
```

**합격 기준**:
- 외곽선 최소 2px 유지 (4컷 전체)
- 명암 대비: 배경/인물 명도 차 40% 이상
- 망점 패턴 중간 그림자 영역 적용: 전체 면적 20~40%
- 포인트 색 사용: 전체 면적 15% 이하 (강조 극대화)

---

### 8.3 팝 카툰 (Pop Cartoon)

| 속성 | 값 |
|---|---|
| **선 굵기** | 1.5~2px 균일선 |
| **채도** | 80~100% (형광 원색) |
| **명암** | 거의 없음 (flat fill, max 2단계 음영) |
| **배경** | 원색 flat 배경 + 폭발형 방사선 패턴 |
| **색 팔레트** | 프라이머리 레드 `#FF3B3B`, 옐로우 `#FFD600`, 블루 `#0077FF`, 그린 `#00C851`, Ink 외곽 |
| **텍스처** | 없음 (clean flat) |
| **분위기** | 발랄, 에너지, SNS 바이럴 |

**프롬프트 캘리브레이션 키워드**:
```json
{
  "style": "pop_cartoon",
  "keywords": [
    "uniform line 1.5-2px",
    "flat color fills",
    "vibrant neon colors",
    "minimal shading",
    "pop art style",
    "bold outlines",
    "bright saturated palette",
    "cartoon sticker aesthetic"
  ],
  "negative_keywords": [
    "watercolor",
    "realistic shading",
    "muted colors",
    "thin lines",
    "gradient fills",
    "texture"
  ],
  "line_weight_range": [1.5, 2.0],
  "saturation_range": [80, 100],
  "shadow_layers": "flat_only",
  "flat_fill": true
}
```

**합격 기준**:
- 선 굵기 균일성: 동일 캐릭터 외곽선 전체 1.5±0.3px 범위
- 채도 평균: 80% 이상
- 배경 flat 면적: 인물 외곽 80% 이상이 단색

---

### 8.4 수채 터치 (Watercolor Touch)

| 속성 | 값 |
|---|---|
| **선** | 거의 없음 / 세피아 브라운 `#7B5B3A` 옅은 외곽 |
| **채도** | 40~55% (중간, 번진 느낌) |
| **명암** | 색 번짐으로 입체감, 하드 엣지 없음 |
| **배경** | 종이 크림 `#FAF0E0` + 번짐 텍스처 |
| **색 팔레트** | 수채 로즈 `#E8A0A0`, 수채 스카이 `#9EC8E8`, 수채 그린 `#A8D8A0`, 세피아 브라운 `#7B5B3A` |
| **텍스처** | 종이 질감 강 (grain opacity 0.12) + 번짐 watercolor wash |
| **분위기** | 몽환, 감성, 아날로그 |

**프롬프트 캘리브레이션 키워드**:
```json
{
  "style": "watercolor_touch",
  "keywords": [
    "watercolor painting style",
    "soft bleeding color edges",
    "paper texture grain",
    "sepia outline minimal",
    "wet-on-wet technique impression",
    "dreamy soft focus",
    "medium saturation 40-55%",
    "organic irregular shapes"
  ],
  "negative_keywords": [
    "sharp outlines",
    "flat fills",
    "high contrast",
    "neon colors",
    "clean edges",
    "manga screentone"
  ],
  "line_weight_range": [0, 0.8],
  "saturation_range": [40, 55],
  "shadow_layers": "bleed_wash",
  "texture_grain": 0.12,
  "sepia_outline": true
}
```

**합격 기준**:
- 외곽선 최대 0.8px 이하 또는 부재
- 채도 35~60% 범위 (너무 탁하거나 선명하면 불합격)
- 번짐 효과 인물 경계면 80% 이상 적용
- 종이 질감 텍스처 감지 가능

---

## 9. 아바타 8종 디자인 가이드

### 9.1 아바타 목록 및 핵심 시각 특징

| # | 이름 | 헤어 스타일 | 특징 키워드 | 기본 아바타 대상 |
|---|---|---|---|---|
| 1 | 단발소녀 | 턱선 단발, 앞머리 내려옴 | 귀엽고 세련된, 20대 여성 톤 | 여성 범용 |
| 2 | 포니테일 | 하이 포니테일, 잔머리 있음 | 활발하고 에너지 넘치는, 10~20대 | 여성 활발 |
| 3 | 안경청년 | 중간 길이, 흐트러진 자연스러운 | 지적이고 차분한, 20~30대 남성 | 남성 지적 |
| 4 | 까까머리 | 극단발/버즈컷, 선명한 윤곽 | 시원시원한, 20대 남성 | 남성 청량 |
| 5 | 장발 | 어깨 이하, 웨이브 또는 스트레이트 | 우아하고 감성적인, 20~30대 | 여성 감성 |
| 6 | 곱슬 | 볼륨 있는 자연 곱슬 | 개성 강한, 성별 중립 | 중성 개성 |
| 7 | 어린이 | 짧고 단순, 앙증맞은 비율 | 귀엽고 어린, SD 비율 | 아동 보호자 |
| 8 | 시니어 | 흰색/회색 단발 또는 숱 적음 | 온화하고 든든한, 50대+ | 중장년 |

### 9.2 공통 캐릭터 규격

```
두상 크기: 전체 높이의 30% (SD 비율 — 만화적 과장)
눈 크기: 두상 높이의 20~25%
코/입: 미니멀 (점/단선 처리)
체형: 2~2.5 등신 (만화 기호화)
팔다리: 단순화, 명확한 자세 실루엣
```

### 9.3 커스텀 범위

| 카테고리 | 선택지 | 토큰 | 비고 |
|---|---|---|---|
| 헤어컬러 | 8종 | black/brown/blonde/red/pink/blue/green/white | 베이직 이상 |
| 상의 컬러/스타일 | 8종 | white-top/stripe/hoodie/uniform/casual/formal/sport/vintage | 베이직 이상 |
| 액세서리 | 4종 | glasses/hat/earphone/none | 베이직 이상 |

### 9.4 Prompt Template JSON 스켈레톤 (백엔드 전달용)

```json
{
  "avatar_template": {
    "avatar_id": "SHORT_HAIR_GIRL",
    "base_description": "short bob hair girl, 2.5 head proportion, simple cartoon style",
    "customization": {
      "hair_color": "{HAIR_COLOR}",
      "top_style": "{TOP_STYLE}",
      "accessory": "{ACCESSORY}"
    },
    "style_lock": {
      "eye_style": "large expressive eyes, simple manga dot",
      "nose_style": "minimal dot or absent",
      "mouth_style": "simple curve line",
      "body_proportion": "2.5 heads tall, SD ratio",
      "outline_consistency": "same stroke weight as reference image"
    },
    "reference_seed": "{USER_AVATAR_SEED}",
    "multi_turn_anchor": true,
    "consistency_check": {
      "face_embedding_threshold": 0.85,
      "max_retry": 2
    }
  },
  "avatar_presets": {
    "SHORT_HAIR_GIRL": {
      "default_hair_color": "black",
      "default_top": "casual",
      "default_accessory": "none",
      "base_prompt_append": "chin-length bob with bangs, cute and stylish"
    },
    "PONYTAIL": {
      "base_prompt_append": "high ponytail with loose strands, energetic"
    },
    "GLASSES_GUY": {
      "base_prompt_append": "medium length natural messy hair, round glasses, intellectual look"
    },
    "BUZZ_CUT": {
      "base_prompt_append": "very short buzz cut, clean sharp silhouette, refreshing"
    },
    "LONG_HAIR": {
      "base_prompt_append": "long wavy or straight hair past shoulders, elegant"
    },
    "CURLY": {
      "base_prompt_append": "voluminous natural curly hair, gender neutral, unique personality"
    },
    "CHILD": {
      "base_prompt_append": "short simple hair, chibi proportion 2 heads, adorable"
    },
    "SENIOR": {
      "base_prompt_append": "white or grey short hair, warm gentle expression, 50s+"
    }
  }
}
```

---

## 10. 말풍선 디자인 시스템

### 10.1 말풍선 4종 기본 스펙

#### 10.1.1 대사형 (Speech)

```
형태: 타원 또는 둥근 직사각형
테두리: 2px solid --color-ink
배경: White (라이트) / --color-surface-raised (다크)
반경: 24px (타원 근사)
내부 패딩: 수직 8px, 수평 14px
꼬리: 삼각형, 말풍선 외곽에서 자연스럽게 뻗어나옴, 2px stroke
꼬리 크기: 길이 16px, 폭 10px
```

#### 10.1.2 생각형 (Thought)

```
형태: 구름 (불규칙 원 5~7개 연결)
테두리: 2px solid --color-ink
배경: White / 라이트 블루 wash (rgba(77,171,247,0.08))
꼬리: 점 3개 점선형 꼬리 (6px, 4px, 3px 원 순서로 작아짐), 간격 4px
점 테두리: 2px solid --color-ink, fill white
```

#### 10.1.3 외침형 (Shout)

```
형태: 폭발형 jagged (톱니 8~12개)
테두리: 3px solid --color-ink
배경: Lemon #FFE066 or Coral #FF6B6B (화풍별 분기)
꼬리: 없음 (폭발 외곽 전체가 방향성)
내부 패딩: 수직 10px, 수평 16px
텍스트: 폰트 105% 크기, font-weight 700
```

#### 10.1.4 속삭임형 (Whisper)

```
형태: 타원
테두리: 1.5px dashed --color-pencil (dash 6px, gap 4px)
배경: rgba(250,247,242,0.85) / 반투명
꼬리: 점선 꼬리, 길이 12px
내부 패딩: 수직 6px, 수평 12px
텍스트: italic 적용
```

### 10.2 꼬리 8방위 정의

```
N  : 상단 중앙
NE : 상단 우측 (약 1/4 지점)
E  : 우측 중앙
SE : 하단 우측 (약 1/4 지점)
S  : 하단 중앙 (기본)
SW : 하단 좌측 (약 1/4 지점)
W  : 좌측 중앙
NW : 상단 좌측 (약 1/4 지점)
```

**SVG 꼬리 처리**: 각 방위별 `<path>` 정의, react-konva에서 rotation 변환
- 기본 꼬리 path (S 방위 기준): `M 0 0 L 8 16 L 16 0` (대사형)
- 생각형 점 꼬리: 별도 원 3개 SVG 그룹
- 외침형: 꼬리 없음, 방향은 jagged 패턴 rotation으로 표현

### 10.3 화풍별 말풍선 톤 매칭

| 화풍 | 테두리 굵기 | 테두리 색상 | 내부 배경 | 텍스트 컬러 | 폰트 |
|---|---|---|---|---|---|
| 감성 라인 | 1px | #2A2A2A | rgba(255,255,255,0.95) | #2A2A2A | Cafe24Danjunghae |
| 대담한 펜선 | 3px | #000000 | #FFFFFF | #000000 | Cafe24Danjunghae or NanumPen |
| 팝 카툰 | 2px | #000000 | #FFFFFF | #000000 | NanumPen (굵은 느낌) |
| 수채 터치 | 0.8px | #7B5B3A | rgba(250,240,224,0.92) | #3B2A1A | Cafe24Danjunghae |

### 10.4 한글 폰트 매핑

| 말풍선 타입 | 1차 폰트 | 2차 폰트(폴백) | 비고 |
|---|---|---|---|
| 대사형 | Cafe24Danjunghae | NanumPen | 기본 |
| 생각형 | Cafe24Danjunghae | NanumBarunpen | 옅은 느낌 |
| 외침형 | NanumPen | Black Han Sans | 굵고 임팩트 |
| 속삭임형 | Cafe24Danjunghae (italic) | Nanum Gothic Coding | 흘림 느낌 |

**폰트 로딩**: Next.js `next/font/local` + `font-display: swap`, 말풍선 폰트만 별도 subset 구성 (한글 KS 완성형 2,350자)

### 10.5 "합성한 티" 방지

| 기법 | 구현 | 목적 |
|---|---|---|
| 미세 회전 | ±2~4° 랜덤 (컷당 다른 값, 시드 고정) | 딱딱한 컴퓨터 느낌 제거 |
| 종이 질감 | SVG feTurbulence + feDisplacementMap 필터 overlay | 아날로그 질감 |
| 그림자 오프셋 | 1~2px x/y offset, 화풍에 맞는 색상 | 입체감, 이미지 위 부착 느낌 |
| 선 거칠기 | SVG stroke + feTurbulence (감성/수채 화풍만) | 손 그린 느낌 |
| 배경 알파 | 99% 불투명 (완전 흰색 X) | 이미지 배경 살짝 비침 |

---

## 11. 4컷 카드 + 공유 카드 템플릿

> Satori로 서버 사이드 렌더링. 모든 좌표는 px 절대값 기준.

### 11.1 정방형 카드 — 1080×1080

```
전체 캔버스: 1080 × 1080 px

[외곽 여백]
  상하좌우: 48px

[2×2 그리드]
  컷 영역: 1080 - 48×2 = 984px 양분
  컷 크기: (984 - 12(거터)) / 2 = 486px × 각 컷
  컷 높이: 자동 계산, 텍스트 영역 80px 하단 배치 고려

  컷 1: x=48, y=48, w=486, h=동적
  컷 2: x=48+486+12=546, y=48, w=486, h=동적
  컷 3: x=48, y=48+컷1높이+12, w=486, h=동적
  컷 4: x=546, y=동일 행, w=486, h=동적

  컷 기본 높이(이미지 영역): 420px
  컷 텍스트 영역(말풍선): 이미지 위 SVG 오버레이

[컷 번호]
  위치: 각 컷 좌상단 x+8, y+8
  크기: 24×24 원형
  배경: --color-ink
  텍스트: White, 12px, bold
  
[하단 텍스트 영역]
  y: 1080 - 48 - 60 = 972
  높이: 60px
  날짜: 좌측, Gmarket Sans, 14px, --color-text-muted
  제목 (있을 경우): 중앙, Gmarket Sans, 16px, --color-text-primary

[워터마크]
  위치: 우하단 컷4 기준 x+466, y+410 (컷 내부 우하단)
  무료: 72×24px, opacity 0.9, --color-lemon 배경, "툰일기" 텍스트
  유료 small: 48×16px, opacity 0.45, same
  제거(pro): 없음

[AI 고지]
  위치: 우하단 전체 캔버스 x=900, y=1054
  텍스트: "AI 생성 이미지", 10px, --color-text-muted, opacity 0.8
  
[QR 코드 영역]
  위치: 워터마크 좌측 8px 이격
  크기: 32×32px (무료 only)
  서비스 URL QR
```

### 11.2 가로형 카드 — 1920×1080 (1×4)

```
전체 캔버스: 1920 × 1080 px

[외곽 여백]
  상하: 48px, 좌우: 80px

[1×4 가로 그리드]
  유효 폭: 1920 - 80×2 = 1760px
  컷 폭: (1760 - 12×3) / 4 = 431px
  컷 높이: 1080 - 48×2 = 984px

  컷1: x=80, y=48
  컷2: x=80+431+12=523
  컷3: x=523+431+12=966
  컷4: x=966+431+12=1409

[컷 번호] 각 컷 좌상단 +8, +8, 동일 스펙

[좌측 브랜드 영역]
  x=0, y=0, w=48px 좌측 여백에 로고 세로 배치 (vertical text, rotate -90deg)
  또는: 좌측 여백에 간단 로고 심볼만 (24×24)

[AI 고지 + 워터마크]
  우측 80px 여백 중앙 또는 마지막 컷 우하단
```

### 11.3 세로형 카드 — 1080×1920 (1×4 + 상단 텍스트)

```
전체 캔버스: 1080 × 1920 px

[상단 텍스트 영역]
  x=0, y=0, w=1080, h=280px
  배경: --color-bg-base 또는 --color-ink (다크 배리언트)
  
  날짜: x=60, y=60, Gmarket Sans, 18px, --color-text-muted
  일기 제목: x=60, y=100, Gmarket Sans, 36px bold, --color-text-primary
    최대 2줄, 넘치면 ellipsis
  감성 태그/화풍: x=60, y=190, Chip 스타일, 12px
  
  대각선 장식 요소 (선택): 우측 Lemon 또는 Coral accent line

[1×4 세로 그리드]
  상단 텍스트 영역 하단부터 시작: y=296
  유효 높이: 1920 - 296 - 48 = 1576px
  컷 높이: (1576 - 12×3) / 4 = 385px
  컷 폭: 1080 - 48×2 = 984px

  컷1: x=48, y=296
  컷2: x=48, y=296+385+12=693
  컷3: x=48, y=693+385+12=1090
  컷4: x=48, y=1090+385+12=1487

[하단 여백 영역 48px]
  워터마크 + AI 고지 + 해시태그
  
[해시태그]
  x=60, y=1868, 14px, --color-text-muted
  "#툰일기 #오늘의만화 #일기만화" 등 자동 생성
```

---

## 12. 워터마크 + AI 생성 고지

### 12.1 워터마크 — 무료 티어

```
텍스트: "툰일기" + 로고 심볼
크기: 80×26px
배경: --color-lemon (#FFE066), 반경 radius-sm (4px)
텍스트: 14px, Gmarket Sans, font-weight 700, --color-ink
테두리: 1.5px solid rgba(26,26,26,0.3)
위치: 각 컷 우하단 또는 공유 카드 전체 우하단
불투명도: 0.92
```

### 12.2 워터마크 — 베이직 티어

```
크기: 56×18px
배경: rgba(255,224,102,0.75) (반투명)
텍스트: 10px, font-weight 600
불투명도: 0.60
위치: 공유 카드 전체 우하단만 (컷 내부 X)
```

### 12.3 워터마크 — 프로 티어

```
제거 가능: 서비스 설정에서 Off 선택 시 완전 제거
기본값: Off (워터마크 없음)
대체: AI 고지 텍스트만 소형으로 유지 (법적 의무)
```

### 12.4 AI 생성 고지 (법적 의무)

**표시 위치**: 공유 카드 하단 또는 우하단 모서리
**스펙**:
```
텍스트: "AI 생성 이미지 · Made with Toonlog"
폰트: 10px, Pretendard, font-weight 400
컬러: --color-text-muted, opacity 0.85
배경: 없음 (텍스트만)
최소 대비: 배경과 3:1 이상 (WCAG)
```

**위치 규칙**:
- 정방형 1080²: 하단 중앙, y=1062
- 가로형 1920×1080: 우측 하단, x=1700, y=1062
- 세로형 1080×1920: 하단 중앙, y=1900

**한국 AI 기본법 준수 고려**:
- 공유 카드에 고지 텍스트 필수 (삭제 불가)
- 서비스 내부 미리보기에도 배지 표시 ("AI 생성" 배지, 12px, --color-info-subtle 배경)
- 워터마크와 AI 고지는 별개 (워터마크는 브랜딩, 고지는 법적 의무)

---

## 13. 아이콘 세트 가이드

### 13.1 스타일 원칙

| 항목 | 값 |
|---|---|
| 라이브러리 | Lucide Icons (메인) + 커스텀 SVG (브랜드/화풍 전용) |
| 스타일 | Line (2px stroke) — UI 아이콘 전반 |
| 채움 | Fill — 선택/활성 상태 전환용 |
| 기본 크기 | 20px × 20px (UI 기본), 16px (작은 컨텍스트), 24px (강조) |
| 선 굵기 | 1.5px (16px 아이콘), 2px (20px+) |
| 모서리 | round cap + round join |

### 13.2 필수 아이콘 목록

| 카테고리 | 아이콘명 | Lucide 이름 | 커스텀 여부 | 용도 |
|---|---|---|---|---|
| **네비게이션** | 홈 | `home` | N | 탭바 홈 |
| | 일기쓰기 | `pen-line` | N | 일기 입력 탭 |
| | 아카이브 | `calendar-days` | N | 아카이브 탭 |
| | 공유 | `share-2` | N | 공유 탭 |
| | 프로필 | `user-circle` | N | 마이페이지 탭 |
| **일기 입력** | 화풍 선택 | `palette` | N | 화풍 변경 |
| | 아바타 | `contact` | Y | 아바타 선택 (커스텀 필요) |
| | 생성 시작 | `wand-2` | N | AI 생성 CTA 아이콘 |
| | 글자 수 | `type` | N | 글자 수 표시 |
| **4컷 결과** | 재생성 | `refresh-cw` | N | 컷 재생성 |
| | 편집 | `edit-3` | N | 말풍선 편집 |
| | 저장 | `download` | N | 이미지 저장 |
| | 공유 | `send` | N | SNS 공유 |
| **말풍선 에디터** | 말풍선 추가 | (커스텀) | Y | 대사/생각/외침/속삭임 4종 |
| | 꼬리 방향 | (커스텀) | Y | 8방위 꼬리 선택 |
| | 텍스트 편집 | `type` | N | 텍스트 직접 편집 |
| | 삭제 | `trash-2` | N | 말풍선 삭제 |
| **공유 카드** | 카드 비율 | `layout-template` | Y | 1:1 / 16:9 / 9:16 전환 |
| | 링크 복사 | `link` | N | URL 복사 |
| | 인스타 | (커스텀) | Y | Instagram 공유 |
| **요금제** | 왕관 | `crown` | N | 프로 티어 표시 |
| | 번개 | `zap` | N | 빠른 생성 표시 |
| | 무한 | `infinity` | N | 무제한 표시 |
| **공통** | 닫기 | `x` | N | 모달/바텀시트 닫기 |
| | 뒤로 | `chevron-left` | N | 뒤로가기 |
| | 더보기 | `more-horizontal` | N | 옵션 메뉴 |
| | 검색 | `search` | N | 검색 |
| | 알림 | `bell` | N | 알림 |
| | 설정 | `settings` | N | 설정 |
| | 체크 | `check` | N | 완료, 선택 확인 |
| | 정보 | `info` | N | 도움말, 안내 |
| | 경고 | `alert-triangle` | N | 경고 토스트 |
| | 에러 | `x-circle` | N | 에러 토스트 |
| | 성공 | `check-circle` | N | 성공 토스트 |

### 13.3 커스텀 SVG 제작 규칙

- 뷰박스: `0 0 24 24` (스케일 기준)
- 선 굵기: `stroke-width="2"` (기본), `stroke-linecap="round"`, `stroke-linejoin="round"`
- 색상: `currentColor` (CSS로 제어)
- 채움: `fill="none"` (라인형), 선택 시 `fill="currentColor"` + stroke 제거
- 말풍선 아이콘 4종: 각 말풍선 형태를 24×24 SVG로 직접 제작

### 13.4 아이콘 사용 규칙

- **아이콘 + 텍스트**: 간격 `--space-1.5` (6px)
- **단독 아이콘 버튼**: 반드시 `aria-label` 또는 `title` 속성
- **탭바 아이콘**: 비활성=라인, 활성=Fill 전환 + Primary 색상
- **아이콘 컬러 기본값**: `--color-text-muted` → 호버/활성 시 `--color-text-primary`

---

## 14. 다크모드 전략

### 14.1 구현 방식

**CSS-first 전략**: Tailwind v4 `@media (prefers-color-scheme: dark)` + `[data-theme="dark"]` 양쪽 지원
- 시스템 설정 자동 감지 (기본)
- 앱 내 수동 토글 (`data-theme` 속성으로 override)
- 상태 저장: `localStorage['toonlog-theme']`, 초기 렌더 깜빡임 방지 스크립트 `<head>` 인라인

```html
<!-- _document.tsx 또는 layout.tsx head에 삽입 -->
<script>
  (function() {
    var t = localStorage.getItem('toonlog-theme');
    if (t) document.documentElement.setAttribute('data-theme', t);
    else if (window.matchMedia('(prefers-color-scheme: dark)').matches)
      document.documentElement.setAttribute('data-theme', 'dark');
  })();
</script>
```

### 14.2 토큰 매핑 원칙

1. **브랜드 원색은 다크모드에서 밝기 +10~15% 이동** (Coral #FF6B6B → #FF8080)
2. **배경 계층 순서 유지**: base < subtle < muted (라이트)의 관계를 다크에서도 base > subtle > muted (어두운 쪽이 base)
3. **텍스트 대비 4.5:1 이상 유지** (WCAG AA) — 모든 semantic 텍스트 토큰에서 배경과의 대비 검증 필수
4. **Ink → Paper 반전 아님**: 다크 배경은 `#1C1917` (따뜻한 어두운 갈색), 라이트 텍스트는 `#F0EDE8` (따뜻한 오프화이트) — 차갑지 않게
5. **이미지 위에 얹는 요소** (말풍선, 워터마크): 다크모드와 무관, 항상 이미지 대비 기준으로 처리

### 14.3 일기 작성 최적화 (밤 사용 多)

**야간 쓰기 환경 고려 사항**:

| 항목 | 라이트 | 다크 (야간 최적화) |
|---|---|---|
| Textarea 배경 | #FAF7F2 (오프화이트) | #231F1C (매우 어두운 갈색) |
| Textarea 선 | --color-border-default | rgba(255,255,255,0.08) (거의 안 보임) |
| Textarea 텍스트 | #1A1A1A | #E8DDD0 (따뜻한 크림 — 눈 덜 피로) |
| 배경 brightness | 100% | 다크모드 전체: `filter: brightness(0.98)` 옵션 |
| 글자 size | 16px | 16px 고정 (모바일 줌 방지) |
| 커서 색 | Coral | Coral (동일 — 눈에 띄게 유지) |
| 종이 줄 | opacity 0.12 | opacity 0.06 (더 희미하게) |

**블루라이트 고려**:
- 다크모드에서 Sky 계열 (`#4DABF7`) 사용 최소화 — 야간 UI에서 warm 계열 `#FF8080`, `#FFD43B`로 대체
- 정보성 아이콘: 야간에는 Coral/Lemon 계열 우선

### 14.4 만화 이미지와 다크 UI 공존

- 4컷 이미지는 AI 생성 → 화풍별 배경색 고정 (Paper White 기반) — 다크모드에서도 이미지 자체는 변경 없음
- 이미지 컨테이너에 `box-shadow: 0 0 0 1px var(--color-border-default)` 미세 테두리로 어두운 배경에서 이미지 경계 인지
- 감성 라인/수채 화풍: 이미지 배경이 밝은 크림 → 다크 UI와 대비 강해짐 → 컨테이너 패딩 8px + `--color-bg-subtle` 배경으로 완충

### 14.5 다크모드 금지 사항

- 말풍선 내 텍스트 색 다크 변환 금지 (이미지 위에 얹히므로, 항상 화풍 기준 색상 유지)
- Satori 공유 카드: 시스템 다크모드 무관, 라이트/Paper 기준으로 고정 생성 (수신자 환경 알 수 없음)
- 워터마크 투명도: 다크 배경에서 더 낮아지지 않게 (opacity 최소 0.60 유지)

---

## 부록 A. 토큰 인벤토리 요약

| 카테고리 | 토큰 수 |
|---|---|
| 컬러 (브랜드 원색) | 9 |
| 컬러 (Semantic — 라이트) | 33 |
| 컬러 (Semantic — 다크 override) | 33 |
| 컬러 (Neutral gray) | 10 × 2 = 20 |
| 타이포 (family) | 6 |
| 타이포 (size) | 11 |
| 타이포 (weight) | 5 |
| 타이포 (leading) | 5 |
| 타이포 (tracking) | 6 |
| 스페이싱 | 20 |
| Radius | 8 |
| Shadow | 9 |
| Z-index | 9 |
| Duration | 7 |
| Easing | 6 |
| **총 토큰 수** | **약 202개** |

---

## 부록 B. 컴포넌트 인벤토리

| # | 컴포넌트 | 상태 수 | 비고 |
|---|---|---|---|
| 1 | Button (Primary) | 5 | |
| 2 | Button (Secondary) | 5 | |
| 3 | Button (Ghost) | 4 | |
| 4 | Button (Danger) | 4 | |
| 5 | Button (Icon Only) | 4 | |
| 6 | Text Input | 6 | 에러 상태 포함 |
| 7 | Textarea | 6 | 일기 입력 전용 특수처리 |
| 8 | Select | 3 | |
| 9 | Checkbox | 4 | |
| 10 | Radio | 4 | |
| 11 | Card (기본) | 3 | |
| 12 | Card (4컷 만화) | 1 | 스타일 고정 |
| 13 | BottomSheet | 2 | open/closed |
| 14 | Chip / Tag | 4 | |
| 15 | 요금제 배지 | 4 | 티어별 |
| 16 | Toggle | 4 | |
| 17 | Modal / Dialog | 2 | open/closed |
| 18 | Toast (5 타입) | 1 each | success/warning/error/info/default |
| 19 | Skeleton | 3 | 카드/리스트/텍스트 |
| 20 | ProgressBar | 1 | + 생성 대기 UI 전체 구성 |
| 21 | Avatar Selector | 3 | default/hover/selected |
| 22 | 화풍 선택 카드 | 3 | |
| 23 | 요금제 카드 | 3 | 무료/베이직/프로 |
| 24 | 말풍선 (대사) | 8방위 | |
| 25 | 말풍선 (생각) | 8방위 | |
| 26 | 말풍선 (외침) | 8방위 | |
| 27 | 말풍선 (속삭임) | 8방위 | |
| **총** | **27개 컴포넌트** | | |

---

*UI 디자인 명세서 v1.0 — 2026-06-03 작성 완료*
*다음 단계: 디자인팀장 종합 → design-final.md 확정 → 프론트팀 W1 토큰 핸드오프*
