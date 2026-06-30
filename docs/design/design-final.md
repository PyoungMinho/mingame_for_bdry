# 툰일기(Toonlog) 최종 디자인 스펙 v1.0

> 확정: 디자인팀장(Opus) / 2026-06-03
> 종합 입력: `ux-spec.md` (UX디자이너, 9개 화면) + `ui-spec.md` (UI디자이너, 토큰 202개 / 컴포넌트 27개)
> 확정 사실 출처: `docs/planning/project-direction.md`
> 위상: **프론트 개발팀 단일 진실 소스(SSOT)** — 이 문서 + 링크된 2개 스펙으로 구현 시작 가능
> 핸드오프 대상: 프론트팀장(전체), 백엔드팀장(§6 캘리브레이션 + §8 고지)

---

## 0. 요약 + 디자인 원칙

### 0.1 한 문단 요약

툰일기는 "일기 한 편 → AI 4컷 만화 → SNS 공유 + 365편 아카이브"를 잇는 모바일 우선(430px) 습관형 SaaS다.
디자인은 **감성 65% + 키치 35%** 톤으로, 따뜻한 종이(Paper) 위 만화 펜선(Ink) + 코랄 CTA를 핵심 무드로 한다.
9개 화면, 다크모드, react-konva 말풍선 에디터, Satori 공유 카드 3종을 11주 일정(디자인 3주 선행) 안에 구현한다.

### 0.2 디자인 원칙 5개 (모든 구현 판단의 기준)

| # | 원칙 | 실무 적용 |
|---|---|---|
| **P1** | **이탈보다 완성** | 생성 대기(10~60초)가 최대 적. SSE 1컷 즉시 노출 + 백그라운드 알림으로 "기다림"을 "구경"으로 전환 (§4-A, §6 ux-spec §5) |
| **P2** | **"내 이야기" 감정** | 아바타 일관성·"내 캐릭터" 카피·완성 햅틱. 기능이 아니라 감동을 판다 |
| **P3** | **마찰 제로 공유** | 공유 화면 → SNS 앱 2탭 이내. Web Share API 우선, fallback 자동 (ux-spec §7) |
| **P4** | **강압 없는 수익화** | 한도/결제는 정보 제공형. "내일 다시"와 "업그레이드" 항상 동등 (ux-spec §8.2) |
| **P5** | **한글은 이미지 밖** | 모든 텍스트(말풍선/캡션/워터마크)는 CSS/SVG/Satori 오버레이. 이미지에 한글 절대 미생성 (방향서 아키텍처 결정 #1) |

> 충돌 시 우선순위: **법무(§8) > 접근성(§9) > P1~P5 > 심미성**.

---

## 1. 브랜드 아이덴티티

### 1.1 톤 & 무드 (확정)

- **감성 65% + 키치 35%**: 기본 무드는 따뜻·잔잔(감성), 강조·재미 포인트에서 만화적 과장(키치).
- 키치 적용 지점: 코랄 CTA, `shadow-ink`(3px 오프셋 만화 그림자), 외침형 말풍선, 컷 번호 pop 애니메이션, 공유 카드 액센트 라인.
- 감성 적용 지점: 종이 질감 배경, 파스텔 화풍, 손글씨 말풍선 폰트, 부드러운 마이크로카피.

### 1.2 로고 (확정 — 상세 ui-spec §6)

- **심볼**: 대사형 말풍선 안에 일기장 줄 3개(가운데 줄만 코랄). "내 이야기(일기)를 만화(말풍선)로".
- **워드마크**: "툰일기" / "Toonlog" — Bagel Fat One.
- **최소 크기**: 조합 높이 24px, 심볼 단독 16px, 앱 아이콘 32px.
- ⚠️ 미해결: `--font-logo: 'Bagel Fat One'`(영문 전용 구글폰트)은 한글 "툰일기"를 렌더 못함 → §12 후속 과제로 이연. **MVP 로고는 SVG 패스로 제작**(폰트 의존 제거).

### 1.3 컬러·타이포 확정 → §2 토큰 블록 참조

브랜드 원색 9종(Ink/Paper/Coral/Sky/Lemon/Pencil/Eraser 등) + 타이포 6패밀리는 §2 `@theme` 블록에 확정본 수록. 상세 표·합성 타이포 스케일(`.type-*` 13종)은 ui-spec §1~2 참조.

---

## 2. 디자인 토큰 — 최종 확정본

> 아래 `@theme` 블록은 ui-spec §5 원본을 **검수·확정**한 것이다. 프론트는 이 블록을 `globals.css` 상단에 그대로 사용한다.
> 변경/검수 사항은 블록 뒤 §2.1에 명시. 토큰 상세 표(용도 설명)는 ui-spec §1~4 참조.

```css
/* tailwind.css — @theme 블록 (Tailwind v4) — 디자인팀장 확정본 v1.0 */
@import "tailwindcss";

@theme {
  /* BREAKPOINTS */
  --breakpoint-sm: 430px;
  --breakpoint-md: 768px;
  --breakpoint-lg: 1024px;
  --breakpoint-xl: 1280px;

  /* FONTS */
  --font-sans: 'Pretendard Variable', 'Pretendard', -apple-system, BlinkMacSystemFont, sans-serif;
  --font-display: 'Gmarket Sans', 'GmarketSansBold', sans-serif;
  --font-balloon: 'Cafe24Danjunghae', 'NanumPen', cursive;
  --font-english: 'Inter Variable', 'Inter', sans-serif;
  --font-logo: 'Bagel Fat One', cursive; /* ⚠️ 영문 전용 — 한글 로고는 SVG 패스 사용 */
  --font-mono: 'JetBrains Mono', 'Fira Code', monospace;

  /* FONT SIZES */
  --text-2xs: 0.625rem; --text-xs: 0.75rem; --text-sm: 0.875rem;
  --text-base: 1rem; --text-md: 1.125rem; --text-lg: 1.25rem;
  --text-xl: 1.5rem; --text-2xl: 1.875rem; --text-3xl: 2.25rem;
  --text-4xl: 3rem; --text-5xl: 3.75rem;

  /* FONT WEIGHTS */
  --font-weight-regular: 400; --font-weight-medium: 500;
  --font-weight-semibold: 600; --font-weight-bold: 700; --font-weight-extrabold: 800;

  /* LINE HEIGHTS */
  --leading-tight: 1.2; --leading-snug: 1.375; --leading-normal: 1.5;
  --leading-relaxed: 1.625; --leading-loose: 2.0;

  /* LETTER SPACING */
  --tracking-tighter: -0.05em; --tracking-tight: -0.025em; --tracking-normal: 0em;
  --tracking-wide: 0.025em; --tracking-wider: 0.05em; --tracking-widest: 0.1em;

  /* SPACING (4px 기준) */
  --spacing-px: 1px; --spacing-0: 0; --spacing-0_5: 0.125rem;
  --spacing-1: 0.25rem; --spacing-1_5: 0.375rem; --spacing-2: 0.5rem;
  --spacing-2_5: 0.625rem; --spacing-3: 0.75rem; --spacing-4: 1rem;
  --spacing-5: 1.25rem; --spacing-6: 1.5rem; --spacing-8: 2rem;
  --spacing-10: 2.5rem; --spacing-12: 3rem; --spacing-14: 3.5rem;
  --spacing-16: 4rem; --spacing-20: 5rem; --spacing-24: 6rem;

  /* BORDER RADIUS */
  --radius-none: 0; --radius-sm: 4px; --radius-md: 8px; --radius-lg: 12px;
  --radius-xl: 16px; --radius-2xl: 24px; --radius-3xl: 32px; --radius-full: 9999px;

  /* SHADOWS */
  --shadow-xs: 0 1px 2px rgb(26 26 26 / 0.06);
  --shadow-sm: 0 1px 4px rgb(26 26 26 / 0.10);
  --shadow-md: 0 4px 12px rgb(26 26 26 / 0.12);
  --shadow-lg: 0 8px 24px rgb(26 26 26 / 0.16);
  --shadow-xl: 0 16px 48px rgb(26 26 26 / 0.20);
  --shadow-ink: 3px 3px 0 rgb(26 26 26 / 0.85);      /* 키치 만화 그림자 */
  --shadow-ink-sm: 2px 2px 0 rgb(26 26 26 / 0.85);
  --shadow-focus: 0 0 0 3px rgb(77 171 247 / 0.40);
  --shadow-focus-error: 0 0 0 3px rgb(255 107 107 / 0.35);

  /* Z-INDEX */
  --z-base: 0; --z-raised: 10; --z-dropdown: 100; --z-sticky: 200;
  --z-overlay: 300; --z-modal: 400; --z-toast: 500; --z-tooltip: 600; --z-max: 9999;

  /* MOTION */
  --duration-instant: 0ms; --duration-fast: 100ms; --duration-normal: 200ms;
  --duration-slow: 300ms; --duration-xslow: 500ms;
  --duration-loading: 800ms; --duration-generation: 1200ms;
  --ease-linear: linear;
  --ease-in: cubic-bezier(0.4, 0, 1, 1);
  --ease-out: cubic-bezier(0, 0, 0.2, 1);
  --ease-in-out: cubic-bezier(0.4, 0, 0.2, 1);
  --ease-spring: cubic-bezier(0.34, 1.56, 0.64, 1);
  --ease-draw: cubic-bezier(0.25, 0.46, 0.45, 0.94);

  /* COLORS — BRAND PRIMITIVES */
  --color-ink: #1A1A1A; --color-paper: #FAF7F2;
  --color-coral: #FF6B6B; --color-coral-hover: #E55555; --color-coral-active: #CC4444;
  --color-sky: #4DABF7; --color-lemon: #FFE066;
  --color-pencil: #6C757D; --color-eraser: #DEE2E6;

  /* COLORS — SEMANTIC (LIGHT DEFAULT) */
  --color-bg-base: #FAF7F2; --color-bg-subtle: #F4F0E8; --color-bg-muted: #EDE9E0;
  --color-bg-inverse: #1A1A1A;
  --color-surface-raised: #FFFFFF; --color-surface-overlay: rgb(26 26 26 / 0.48);
  --color-text-primary: #1A1A1A; --color-text-secondary: #4A4540;
  --color-text-muted: #6C757D; --color-text-disabled: #ADB5BD;
  --color-text-inverse: #FAF7F2; --color-text-link: #4DABF7; --color-text-accent: #FF6B6B;
  --color-primary: #FF6B6B; --color-primary-hover: #E55555; --color-primary-active: #CC4444;
  --color-primary-subtle: #FFF0F0; --color-primary-text: #FFFFFF;
  --color-border-default: #DEE2E6; --color-border-strong: #ADB5BD;
  --color-border-focus: #4DABF7; --color-border-error: #FF6B6B;
  --color-success: #2ECC71; --color-success-subtle: #EDFAF4;
  --color-warning: #F59E0B; --color-warning-subtle: #FFFBEB;
  --color-error: #EF4444; --color-error-subtle: #FEF2F2;
  --color-info: #4DABF7; --color-info-subtle: #EFF8FF;
}

/* DARK MODE — system */
@media (prefers-color-scheme: dark) {
  :root:not([data-theme="light"]) {
    --color-bg-base: #1C1917; --color-bg-subtle: #292524; --color-bg-muted: #3C3633;
    --color-bg-inverse: #F0EDE8;
    --color-surface-raised: #231F1C; --color-surface-overlay: rgb(0 0 0 / 0.64);
    --color-text-primary: #F0EDE8; --color-text-secondary: #C5BFB8;
    --color-text-muted: #8B8178; --color-text-disabled: #4A4540;
    --color-text-inverse: #1A1A1A; --color-text-link: #74C0FC; --color-text-accent: #FF8080;
    --color-primary: #FF8080; --color-primary-hover: #FF9494; --color-primary-active: #FFAAAA;
    --color-primary-subtle: #3D1A1A; --color-primary-text: #1A1A1A;
    --color-border-default: #343A40; --color-border-strong: #6C757D;
    --color-border-focus: #74C0FC; --color-border-error: #FF8080;
    --color-success: #4ADE80; --color-success-subtle: #0D2E1A;
    --color-warning: #FBBF24; --color-warning-subtle: #2D1F00;
    --color-error: #F87171; --color-error-subtle: #2D0A0A;
    --color-info: #74C0FC; --color-info-subtle: #0D1F2D;
    --color-coral: #FF8080; --color-sky: #74C0FC; --color-lemon: #FFD43B;
    --color-pencil: #ADB5BD; --color-eraser: #343A40;
  }
}

/* DARK MODE — manual override (system 무관) */
[data-theme="dark"] {
  --color-bg-base: #1C1917; --color-bg-subtle: #292524; --color-bg-muted: #3C3633;
  --color-bg-inverse: #F0EDE8;
  --color-surface-raised: #231F1C; --color-surface-overlay: rgb(0 0 0 / 0.64);
  --color-text-primary: #F0EDE8; --color-text-secondary: #C5BFB8;
  --color-text-muted: #8B8178; --color-text-disabled: #4A4540;
  --color-text-inverse: #1A1A1A; --color-text-link: #74C0FC; --color-text-accent: #FF8080;
  --color-primary: #FF8080; --color-primary-hover: #FF9494; --color-primary-active: #FFAAAA;
  --color-primary-subtle: #3D1A1A; --color-primary-text: #1A1A1A;
  --color-border-default: #343A40; --color-border-strong: #6C757D;
  --color-border-focus: #74C0FC; --color-border-error: #FF8080;
  --color-success: #4ADE80; --color-success-subtle: #0D2E1A;
  --color-warning: #FBBF24; --color-warning-subtle: #2D1F00;
  --color-error: #F87171; --color-error-subtle: #2D0A0A;
  --color-info: #74C0FC; --color-info-subtle: #0D1F2D;
  --color-coral: #FF8080; --color-sky: #74C0FC; --color-lemon: #FFD43B;
  --color-pencil: #ADB5BD; --color-eraser: #343A40;
}
```

### 2.1 팀장 검수 변경 사항 (ui-spec 원본 대비)

| 항목 | ui-spec 원본 | 확정본 | 사유 |
|---|---|---|---|
| 시스템 다크 셀렉터 | `:root` | `:root:not([data-theme="light"])` | 수동 라이트 토글이 시스템 다크를 못 이기는 버그 방지 |
| 수동 다크 블록 | `/* ...동일 */` 주석 처리(미완) | **전체 토큰 명시** | 원본은 미완성이라 그대로면 수동 토글 작동 안 함 |
| Gray 스케일(`--color-gray-*` 20종) | @theme 미포함(표만 존재) | **MVP 보류** | semantic 토큰으로 충분, 직접 gray 사용 금지. 필요 시 §12 |
| `--spacing-*` 네이밍 | `_5` 표기(0_5, 1_5, 2_5) | 유지 | Tailwind v4 유효, 단 클래스는 `p-2.5` 형태로 매핑됨을 프론트 인지 |

> **그레이 스케일 사용 금지 규칙**: 컴포넌트는 반드시 semantic 토큰(`--color-text-*`, `--color-bg-*`, `--color-border-*`)만 사용. raw gray/hex 직접 입력 금지 (다크모드 자동 대응 보장).

---

## 3. 화면 목록 + IA (9개 화면)

> 전체 IA 트리·네비게이션 구조는 ux-spec §2 참조. 와이어프레임은 ux-spec §4 참조.

| # | 화면 | 라우트 | 인증 | 탭바 | 우선순위 | ux-spec |
|---|---|---|---|---|---|---|
| S1 | 랜딩 | `/` | 공개 | X | **P0** | §4 화면1 |
| S1b | 온보딩(소셜로그인+아바타설정) | `/onboarding` | 인증 | X | **P0** | §4 화면1 |
| S2 | 홈/대시보드 | `/home` | 인증 | O | **P1** | §2 IA |
| S3 | 일기 작성 | `/diary/new` | 인증 | O(FAB) | **P0** | §4 화면2~3 |
| S4 | 생성 대기 | `/diary/generating/:id` | 인증 | X | **P0** | §4 화면4, §5 |
| S5 | 4컷 결과 확인 | `/diary/:id` | 인증 | X | **P0** | §4 화면5 |
| S6 | 말풍선 에디터 | `/diary/:id/edit` | 인증 | X | **P1** | §4 화면6, §6 |
| S7 | 공유 | `/diary/:id/share` | 인증 | X | **P0** | §4 화면7, §7 |
| S8 | 아카이브(캘린더/그리드) | `/archive` | 인증 | O | **P1** | §4 화면8 |
| S9 | 마이페이지 | `/mypage` | 인증 | O | **P1** | §4 화면9 |
| S9b | 요금제 업그레이드 | `/mypage/upgrade` | 인증 | X | **P1** | §4 화면9 |
| S+ | 공유 OG 페이지(수신자용) | `/share/:id` | 공개 | X | **P1** | ux-spec §7.2 |

**네비게이션 확정**: 하단 4탭 `[홈] [작성+] [아카이브] [마이]`, 작성+는 중앙 FAB 돌출. 생성대기/편집/공유는 풀스크린(탭바 숨김).

**P0 핵심 경로 (MVP 데모 가능 최소 셋)**: S1 → S1b → S3 → S4 → S5 → S7. 이 6개로 "가입→첫만화→공유" 플로우 A가 완성된다.

---

## 4. 핵심 사용자 플로우 3개 (요약)

> 단계별 감정선·이탈 위험·대응은 ux-spec §3 표 참조. 여기서는 핵심 동선과 디자인 요구만.

### 플로우 A — 신규 첫 만화 생성 (3분 내 / 무료 첫 경험)
`랜딩 → 소셜로그인 → 아바타설정 → 일기작성 → 화풍선택 → 생성CTA → 생성대기(SSE) → 결과 → 공유`
- **최대 이탈점**: 생성 대기(단계 7). 대응 = SSE 1컷 즉시 노출 + 팁 로테이션 + 백그라운드 알림 (§6 ux-spec §5).
- **디자인 요구**: 로그인은 소셜만(이메일 폼 금지), 아바타 기본값 선택 상태 진입, 작성 화면 예시 플레이스홀더.

### 플로우 B — 무료 한도 소진 → 유료 전환
`일기작성 → (생성시도) → 한도소진 바텀시트 → 요금제 비교 → 크레딧팩/구독 → 결제 → 생성 재개`
- **핵심 규칙**: 한도 차단은 **글 작성 전 정보 표시(잔여 칩) + 생성 시도 직전 바텀시트**. 글 쓴 뒤 좌절시키지 않음.
- **디자인 요구**: 바텀시트는 정보 제공형("내일 다시" = "업그레이드" 동등). 결제 후 작성 화면으로 딥링크 복귀.

### 플로우 C — 재방문 → 공유 (습관화)
`홈(스트릭 확인) → FAB → 일기작성(화풍·아바타 기억) → 생성 → 결과 → 편집(선택) → 공유 → 홈(스트릭+1)`
- **리텐션 훅**: 홈 스트릭 D+N 전면, 마지막 화풍/아바타 자동 기억, 요일/계절 반응 플레이스홀더, 7/30/100일 배지.

---

## 5. 컴포넌트 인벤토리 (우선순위 분류)

> 상태별 토큰 스펙 상세는 ui-spec §7 참조. 여기서는 **무엇을 언제 만들지(P0/P1/P2) + UI 인벤토리 누락분 보강**.
> P0 = MVP 핵심경로 필수 / P1 = 출시 버전 필수 / P2 = Phase 2 이연.

### 5.1 ui-spec 정의 컴포넌트 (27개) 우선순위

| 컴포넌트 | 우선순위 | 사용 화면 | 비고 |
|---|---|---|---|
| Button (Primary/Secondary/Ghost/Danger/Icon) | **P0** | 전 화면 | 5종 변형, ui-spec §7.1 |
| Text Input | **P0** | 온보딩, 마이 | 6상태 |
| Textarea (일기 입력) | **P0** | S3 | 종이질감, 카운터 — §5.2 충돌해소 적용 |
| BottomSheet | **P0** | S3, 한도소진, 화풍/아바타 | 핵심 패턴 |
| Chip / Tag | **P0** | S3 화풍칩, 한도칩 | selected 상태 필수 |
| Card (4컷 만화) | **P0** | S5 | 2px ink border, shadow-ink |
| ProgressBar + 생성대기 UI | **P0** | S4 | 이탈방지 핵심, ui-spec §7.10 |
| Skeleton | **P0** | S4, S5, 공유 | shimmer |
| Avatar Selector | **P0** | S1b, S3 | 8종 그리드 |
| 화풍 선택 카드 | **P0** | S3 | 4종 |
| Toast (5타입) | **P0** | 전역 | 공유/에러 피드백 |
| 요금제 카드 | **P1** | S9b, 랜딩 | 무료/베이직/프로 |
| 요금제 배지 | **P1** | S9, S3 | 티어 표시 |
| Modal / Dialog | **P1** | 삭제확인 등 | 인라인 confirm 우선이라 우선순위 ↓ |
| Toggle | **P1** | S9 다크모드 | |
| Select | **P1** | S9 언어 | |
| Checkbox / Radio | **P1** | 약관동의, 청소년확인 | |
| Card (기본) | **P1** | S2, S9 | |
| 말풍선 4종 × 8방위 | **P1** | S6 | react-konva, §6 ux-spec, §10 ui-spec. **에디터 자체가 P1** |

### 5.2 UI 인벤토리 누락 — 팀장 보강 (UX 와이어프레임엔 있으나 ui-spec 27개에 없음)

| 신규 컴포넌트 | 우선순위 | 근거(UX) | 스펙 요지 |
|---|---|---|---|
| **TabBar + FAB** | **P0** | ux-spec §2 네비 | 4탭, 중앙 작성+ FAB 돌출, 활성=Fill+Primary, 높이 `--spacing-14`(56px), safe-area 패딩 |
| **QuotaChip (잔여 한도)** | **P0** | ux-spec 화면2 "28컷 남음" | Chip 변형. 0일 때 `--color-error` 전환 + 텍스트 병행(색만 의존 금지) |
| **EmptyState** | **P1** | ux-spec §8.1 | SVG 일러스트 120px + H3 + Body + Primary CTA. 아카이브/검색 공용 |
| **StreakBadge** | **P1** | ux-spec 화면8, 플로우C | 🔥아이콘+숫자+텍스트 3중(색각 대응). 7/30/100일 분기 카피 |
| **CalendarView + DateCell** | **P1** | ux-spec 화면8 | 7열, 셀 최소 44×44px, 썸네일/오늘(●)/빈칸 3상태 |
| **SegmentedToggle** | **P1** | 월간/연간(S9b), 캘린더/그리드(S8) | 2~3 세그먼트, selected `--color-primary-subtle` |
| **WatermarkOverlay** | **P0** | ux-spec §7.4, ui-spec §12 | Satori 내 tier 분기 렌더(무료 큼/유료 소형/프로 제거) |
| **AIDisclosureBadge** | **P0** | ux-spec §7.4, 법무 | 미리보기 배지 + 공유카드 고지. 삭제 불가 |
| **VoiceInputButton** | **P2** | ux-spec 화면2 | 음성 입력. MVP는 stub 또는 숨김 가능(§12) |

### 5.3 컴포넌트 수 집계

- **P0 컴포넌트: 19개** (ui-spec 11 핵심 + 누락 보강 P0 6 + Button 5종을 1로 세지 않고 변형 포함 시 +2 → 실 카운트 19)
  - 명시 리스트: Button(5변형), TextInput, Textarea, BottomSheet, Chip, Card(4컷), ProgressBar+생성대기, Skeleton, AvatarSelector, 화풍카드, Toast, **TabBar+FAB, QuotaChip, WatermarkOverlay, AIDisclosureBadge**.
- **P1: 16개** / **P2: 1개(VoiceInput)**.

---

## 6. 화풍 4종 + 아바타 8종 + 말풍선 4종 — 백엔드 전달용 캘리브레이션 스펙

> **백엔드팀장 핸드오프 섹션.** 방향서 §6(디자인↔백엔드 주2회 캘리브레이션) + 의존성 매트릭스(디자인→백엔드 W2말) 대응.

### 6.1 화풍 4종 — 골든 프롬프트 (전달 준비 완료)

ui-spec §8에 4종 모두 **골든 프롬프트 JSON**(keywords / negative_keywords / line_weight_range / saturation_range / shadow_layers) + **합격 기준**이 정의됨. 백엔드 캘리브레이션 입력으로 **그대로 사용 가능**.

| 화풍 | style 키 | 선 굵기 | 채도 | 핵심 negative | ui-spec |
|---|---|---|---|---|---|
| 감성 라인 | `emotional_line` | 0.5~1px | 30~40% | bold lines, high contrast | §8.1 |
| 대담한 펜선 | `bold_pen` | 2~4px | 0~20%(+액센트 60~80%) | thin lines, pastel | §8.2 |
| 팝 카툰 | `pop_cartoon` | 1.5~2px | 80~100% | watercolor, muted | §8.3 |
| 수채 터치 | `watercolor_touch` | 0~0.8px | 40~55% | sharp outlines, neon | §8.4 |

**팀장 검수 결과 — 백엔드 전달 시 보강 요청 2건:**
1. **골든 참조 이미지 세트 미첨부**: 방향서는 "골든 프롬프트 **+ 골든 참조 이미지** 세트 유지"를 요구. 현재 프롬프트만 있음. → **디자인 W2에 화풍별 참조 이미지 3컷씩(총 12컷) 생성·고정** 필요. (후속 §12-1)
2. **IP-프리 명명 확인**: 4종 명칭 모두 일반명사 조합 → 상표 리스크 낮음(방향서 리스크#5 충족). "shoujo/seinen manga style" 키워드는 프롬프트 내부용이며 UI 노출 안 함 — OK.

### 6.2 아바타 8종 — Prompt Template (전달 준비 완료)

ui-spec §9.4에 `avatar_template` + `avatar_presets` 8종 **JSON 스켈레톤** 완비. `{HAIR_COLOR}/{TOP_STYLE}/{ACCESSORY}/{USER_AVATAR_SEED}` 변수 바인딩, `style_lock`, `consistency_check`(face_embedding_threshold 0.85 / max_retry 2) 포함 → 방향서 아키텍처 #2·#3과 일치. **백엔드 사용 가능**.

| 변수 | 옵션 | 토큰(영문 enum — API 계약) |
|---|---|---|
| hair_color (8) | black/brown/blonde/red/pink/blue/green/white | ui-spec §9.3 |
| top_style (8) | white-top/stripe/hoodie/uniform/casual/formal/sport/vintage | |
| accessory (4) | glasses/hat/earphone/none | |

**팀장 검수 — 보강 요청 1건:**
- 8개 preset 중 `SHORT_HAIR_GIRL`만 `default_hair_color/default_top/default_accessory`가 명시됨. 나머지 7종은 `base_prompt_append`만 있음. → **8종 모두 default 3종 값 채워서 전달**(신규 유저 진입 시 기본값 보장). (후속 §12-2)
- 공통 규격(2~2.5등신, 두상 30%, 눈 20~25%)은 ui-spec §9.2에 확정 — OK.

### 6.3 말풍선 4종 — 메타데이터 계약

방향서 아키텍처 #1: 백엔드는 **말풍선 메타데이터만 반환**(좌표/타입/꼬리방향), 한글 텍스트는 프론트 오버레이.

| 타입 | enum | 형태 | 테두리 | 기본 꼬리 | 글자 제한(확정) | ui-spec |
|---|---|---|---|---|---|---|
| 대사형 | `speech` | 둥근 타원 | 2px ink | SW(↙) | **50자** | §10.1.1 |
| 생각형 | `thought` | 구름 | 2px ink | S(↓) 점선 | **50자** | §10.1.2 |
| 외침형 | `shout` | 폭발 jagged | 3px ink | 없음(방향성=형태) | **20자** | §10.1.3 |
| 속삭임형 | `whisper` | 점선 타원 | 1.5px dashed | SW(↙) 점선 | **40자** | §10.1.4 |

- **꼬리 8방위**: N/NE/E/SE/S/SW/W/NW. SVG path + react-konva rotation (ui-spec §10.2).
- **화풍별 톤 매칭표** 4×6 확정(ui-spec §10.3), **한글 폰트 매핑**(§10.4), **"합성 티" 방지 5기법**(§10.5: 미세회전 ±2~4° / 종이질감 / 그림자오프셋 / 선거칠기 / 배경알파 99%) — 프론트 react-konva + Satori 양쪽 적용.

**백엔드 ↔ 프론트 말풍선 메타 JSON 계약(제안 — 백엔드 OpenAPI에 반영 요청, W3말):**
```json
{ "panel": 1, "balloons": [
  { "id": "b1", "type": "speech", "tail": "SW",
    "x": 0.62, "y": 0.18, "w": 0.34, "h": 0.16,  /* 컷 기준 0~1 정규화 */
    "suggested_text": "" }  /* 백엔드는 빈 값 또는 LLM 제안, 한글 미생성 원칙상 텍스트는 프론트 입력 */
]}
```

---

## 7. 4컷/공유 카드 템플릿 3종 (Satori 구현 좌표)

> Satori 서버사이드 렌더. 절대 px 좌표는 ui-spec §11 확정본 사용. 아래는 핵심 좌표 + 팀장 정합성 결정.

### 7.1 템플릿 3종 레이아웃 (확정)

| 비율 | 해상도 | 그리드 | 용도 | 생성 시점 | ui-spec |
|---|---|---|---|---|---|
| 1:1 | 1080×1080 | **2×2** | 인스타 피드 | 결과 진입 시 **미리 생성** | §11.1 |
| 16:9 | 1920×1080 | **1×4 가로** | X/트위터 | 탭 시 On-demand(≤3초) | §11.2 |
| 9:16 | 1080×1920 | **1×4 세로 + 상단 텍스트** | 릴스/스토리 | 탭 시 On-demand(≤3초) | §11.3 |

**1080² 핵심 좌표(요약)**: 외곽 48px, 컷 486×420, 거터 12px, 컷번호 24px원형 좌상단+8/+8, 하단 텍스트영역 y=972 h=60(날짜 좌·제목 중앙), 워터마크 컷4 우하단, AI고지 x=900 y=1054.

### 7.2 팀장 정합성 결정 (충돌 해소)

- **화면 내 뷰어 vs 공유 카드 레이아웃 분리 확정**: S5 결과 화면 뷰어는 **항상 2×2**(ux-spec 화면5). 1×4 가로/세로는 **공유 카드 출력 전용**(Satori). 동일 4컷, 다른 조판. 프론트는 뷰어와 Satori 템플릿을 별개로 구현.
- **무료 미리보기 해상도**: 화면 내 미리보기·뷰어는 512px 다운스케일(방향서 무료 정책), 공유 카드 다운로드는 워터마크 박힌 1080² (무료 티어). §8 워터마크 분기와 연동.

---

## 8. 워터마크 + AI 생성 고지 (법무 연계)

> **법무 의무 — 삭제 불가. 우선순위 최상위(§0.2).** 방향서 리스크#5(법무 3중) + 아키텍처#5(워터마크=프론트 처리, tier 분기) 대응. 상세 ui-spec §12.

### 8.1 워터마크 tier 분기 (프론트 Satori 처리)

| 티어 | 워터마크 | 크기/위치 | 비고 |
|---|---|---|---|
| 무료 | 큼(브랜딩) | 80×26px, Lemon 배경, opacity 0.92, 컷 우하단 + 카드 우하단 | + QR 32px(무료 only) |
| 베이직 | 소형 반투명 | 56×18px, opacity 0.60, 카드 우하단만 | 컷 내부 X |
| 프로 | 제거 가능 | 기본 Off | AI 고지만 잔존 |

### 8.2 AI 생성 고지 (전 티어 필수 — 프로도 제거 불가)

- **공유 카드**: "AI 생성 이미지 · Made with Toonlog" 10px, opacity 0.85, 배경 대비 3:1. 위치 — 1080²: 하단중앙 y=1062 / 1920×1080: 우하단 x=1700 y=1062 / 1080×1920: 하단중앙 y=1900.
- **앱 내 미리보기**: "AI 생성" 배지(12px, `--color-info-subtle` 배경) — AIDisclosureBadge 컴포넌트.
- **워터마크 ≠ AI 고지**: 워터마크는 브랜딩(tier 분기 가능), AI 고지는 법적 의무(분기 불가). 둘은 별개 요소. ⚠️ **프로 티어에서도 AI 고지는 반드시 렌더** — 프론트 구현 시 워터마크 Off가 AI 고지까지 끄지 않도록 분리.
- **한국 AI 기본법 대응**: 공유 카드 + 미리보기 양쪽 고지. 법무 1차 자문(방향서 게이트 8.1, 진행중)에서 문구 최종 확정 — 카피는 변경 가능성 있으므로 **상수로 분리**(`AI_DISCLOSURE_TEXT`) 권장.

---

## 9. 반응형 + 다크모드 + 접근성 기준

### 9.1 반응형 (모바일 우선 430px)

| 화면폭 | 컬럼 | 거터 | 사이드 패딩 |
|---|---|---|---|
| 모바일 <430px | 4 | 16px | 20px |
| 태블릿 768px+ | 8 | 20px | 32px |
| 데스크톱 1024px+ | 12 | 24px | 48px |

- 컨텐츠 최대폭: 모바일 레이아웃 그대로 **중앙 정렬 max-width 480px**(데스크톱에서 모바일 캔버스 유지) 권장. 랜딩(S1)만 풀와이드 마케팅 레이아웃 허용.
- safe-area: TabBar/FAB는 `env(safe-area-inset-bottom)` 패딩 필수.

### 9.2 다크모드 (확정 — 상세 ui-spec §14)

- CSS-first: 시스템 자동(`prefers-color-scheme`) + 수동(`[data-theme]`), `localStorage['toonlog-theme']`, head 인라인 스크립트로 FOUC 방지.
- **야간 쓰기 최적화**: Textarea 다크 배경 #231F1C, 텍스트 #E8DDD0(따뜻한 크림), 종이 줄 opacity 0.06, 커서 코랄 유지.
- **금지**: 말풍선 텍스트 색 다크 변환 금지(이미지 위), **Satori 공유 카드는 항상 라이트/Paper 기준 고정 생성**(수신자 환경 불명), 워터마크 opacity 최소 0.60.

### 9.3 접근성 (WCAG 2.1 AA — 상세 ux-spec §10)

| 항목 | 기준 |
|---|---|
| 텍스트 대비 | 일반 4.5:1 / 대형 3:1, 다크 별도 검증 |
| 본문 최소 폰트 | 16px(모바일 줌 방지), 캡션 12px |
| 터치 타깃 | **최소 44×44px**, react-konva 핸들 **48×48px**(§10 충돌해소 #2) |
| 스크린리더 | textarea aria-label, 글자수 aria-live=polite, ProgressBar role=progressbar, 컷 이미지 LLM 생성 alt, 탭바 nav/aria-selected |
| 모션 | `prefers-reduced-motion`: shimmer/fade/scale 비활성, SSE 컷 즉시 표시 |
| 색 외 정보 | 글자수 초과·한도·스트릭 = 색 + 아이콘 + 텍스트 3중 |

---

## 10. UX ↔ UI 충돌 해소 결정 사항

> 팀장 최종 결정. 프론트는 **이 표가 두 원본 스펙보다 우선**한다.

| # | 충돌 | UX 스펙 | UI 스펙 | **팀장 결정** | 사유 |
|---|---|---|---|---|---|
| 1 | 일기 글자수 상한 | 50~300자, "300자 초과" 경고 | Textarea "900자 초과 시 warning" | **50~300자 확정.** 카운터 `n/300`, 300 초과 시 `--color-warning`+경고 | 사용자 플로우(ux)가 입력 UX의 진실. UI의 900자는 일반 textarea 잔재 |
| 2 | 말풍선 에디터 핸들 크기 | 44×44px | 48×48px | **48×48px 확정** | react-konva 캔버스 터치는 큰 타깃이 안전. 일반 UI 버튼은 44px 유지 |
| 3 | 무료 티어 해상도 | 랜딩 "512px+워터마크" | 카드 1080² 기준 | **미리보기/뷰어 512px, 공유 다운로드 1080²(워터마크)** | 방향서 무료=512 미리보기. 다운로드물은 1080²에 큰 워터마크로 바이럴 |
| 4 | 결과 4컷 배치 | 2×2 | 정방2×2 / 가로1×4 / 세로1×4 | **뷰어=2×2 / 공유카드=비율별** (§7.2) | 화면 뷰어와 Satori 출력은 별개 |
| 5 | 외침 말풍선 | 20자 제한 | 폰트 105% | **양립: 20자 + 105% 둘 다 적용** | 공간 제약 + 임팩트 동시 |
| 6 | 재생성 한도 | "다시 만들기 1회 차감" / 실패는 "차감 없음" | — | **자발적 재생성=차감, 시스템 실패=무차감** | 정상 의도. 카피로 명확히(ux §8.3) |
| 7 | 네비 컴포넌트 | TabBar+FAB 와이어 존재 | 인벤토리 누락 | **P0 신규 추가**(§5.2) | UI 인벤토리 보강 |
| 8 | 다크 셀렉터 | — | `:root`(수동 라이트가 시스템 다크 못 이김) | `:root:not([data-theme="light"])` + 수동블록 전체 명시(§2.1) | 토큰 버그 방지 |

**충돌 해소 총 8건.**

---

## 11. 프론트 핸드오프 체크리스트 + 컴포넌트→화면 매핑

### 11.1 프론트 착수 체크리스트 (W1 토큰 → W2 디자인시스템 → ...)

- [ ] §2 `@theme` 블록을 `globals.css`에 적용 + head FOUC 방지 스크립트(ui-spec §14.1)
- [ ] 폰트 셋업: Pretendard(본문), Gmarket Sans(디스플레이), Cafe24Danjunghae/NanumPen(말풍선) `next/font/local`, 말풍선 폰트 KS완성형 2,350자 subset
- [ ] **로고 SVG 패스 제작**(Bagel Fat One 한글 미지원 → §1.2)
- [ ] semantic 토큰만 사용(raw gray/hex 금지 — §2.1)
- [ ] P0 컴포넌트 19종 먼저 구현 (§5.3)
- [ ] TabBar+FAB safe-area 패딩
- [ ] SSE 생성대기 UI(ProgressBar + 컷 스켈레톤 + 팁 로테이션 + 백그라운드 알림) — 이탈방지 핵심(ux §5)
- [ ] react-konva 말풍선 에디터: 48px 핸들, 제스처 7종(ux §6.1), undo 20단계
- [ ] Satori 카드 3종(§7) + 워터마크 tier 분기 + AI 고지(프로도 고지 유지 — §8.2)
- [ ] 접근성: aria-live 글자수, reduced-motion, 색 외 정보 3중(§9.3)
- [ ] 다크모드: 야간 Textarea 최적화, Satori는 라이트 고정(§9.2)
- [ ] 마이크로카피: ux-spec §9 카피 가이드를 i18n 상수로 분리

### 11.2 컴포넌트 → 화면 매핑

| 화면 | 사용 컴포넌트(P0 굵게) |
|---|---|
| S1 랜딩 | **Button(P/S)**, 화풍카드, 요금제카드, Chip, SegmentedToggle |
| S1b 온보딩 | **Button**, **AvatarSelector**, **TextInput**, Checkbox(청소년/약관) |
| S2 홈 | **TabBar+FAB**, StreakBadge, Card(기본), **Button**, **QuotaChip** |
| S3 일기작성 | **Textarea**, **QuotaChip**, **Chip**(화풍), 화풍카드, **AvatarSelector**, **BottomSheet**, **Button**, VoiceInputButton(P2) |
| S4 생성대기 | **ProgressBar+생성대기UI**, **Skeleton**(4컷), Toast, **Button** |
| S5 결과 | **Card(4컷)**, **Button**(편집/공유/저장/재생성), **WatermarkOverlay**, **AIDisclosureBadge**, Modal(삭제) |
| S6 편집 | 말풍선4종×8방위, **Button**, undo 컨트롤, Toast |
| S7 공유 | **SegmentedToggle**(비율), **Skeleton**, **AIDisclosureBadge**, **WatermarkOverlay**, **Button**, Toast |
| S8 아카이브 | **TabBar**, CalendarView+DateCell, SegmentedToggle, StreakBadge, EmptyState, Card(그리드썸네일) |
| S9 마이 | **TabBar**, Card, 요금제배지, Toggle(다크), Select, **Button** |
| S9b 업그레이드 | 요금제카드, SegmentedToggle(월/연), 요금제배지, **Button** |

### 11.3 백엔드 핸드오프 (요약 — 상세 §6, §8)

- 화풍 4종 골든 프롬프트 JSON(ui-spec §8) — **전달 가능**, 단 골든 참조 이미지 12컷 W2 첨부 예정(§12-1)
- 아바타 8종 prompt template(ui-spec §9.4) — **전달 가능**, 단 8종 default값 보강 후(§12-2)
- 말풍선 메타 JSON 계약(§6.3) — 백엔드 OpenAPI W3말 반영 요청
- 워터마크/AI고지는 **프론트 처리**, 백엔드는 tier 정보만 제공(아키텍처#5) — 계약 확인 완료

---

## 12. 디자인 미해결 / 후속 과제 (Phase 2 이연 항목)

### 12.1 디자인 W2 내 완료 필요 (MVP 차단 요소 — 이연 아님, 잔여 작업)

| # | 과제 | 담당 | 기한 |
|---|---|---|---|
| 1 | **화풍별 골든 참조 이미지 12컷**(4종×3) 생성·고정 — 방향서 "프롬프트+참조세트" 요구 | 디자인+백엔드 | W2말(백엔드 전달 시점) |
| 2 | **아바타 8종 default 3종값**(hair/top/accessory) 채우기 | UI디자이너 | W2 |
| 3 | **로고 SVG 패스**(한글 "툰일기", Bagel Fat One 미지원 대체) | UI디자이너 | W2 |
| 4 | 아바타 8종 + 말풍선 4종 실 에셋 export(프론트 W2~3 수령) | 디자인 | W2말~W3말 |
| 5 | 텅 빈 캘린더 등 EmptyState SVG 일러스트 | UI디자이너 | W3 |

### 12.2 Phase 2 이연 (출시 후)

| # | 항목 | 사유 |
|---|---|---|
| 1 | 음성 입력(VoiceInputButton) 정식 구현 | MVP는 텍스트 우선. 와이어만 유지, stub/숨김 |
| 2 | Gray 스케일 20토큰 @theme 편입 | semantic으로 충분. 데이터viz 등 필요 시 |
| 3 | 5번째+ 화풍, 아바타 고급 커스텀(프로 차등) | 방향서 MVP 제외 확정 |
| 4 | 원클릭 SNS 공유(딥링크 자동화) | 법무 후 v1.1(방향서 MVP 제외) |
| 5 | 태블릿/데스크톱 전용 레이아웃 고도화 | 모바일 우선, 데스크톱은 중앙정렬 캔버스로 MVP 충족 |
| 6 | 100일+ 마일스톤 배지·앨범(PDF) 디자인 | 프로 기능, 락인 강화는 Phase 2 |
| 7 | AI 고지 문구 법무 최종본 반영 | 법무 1차 자문 후 `AI_DISCLOSURE_TEXT` 상수 갱신 |

---

*문서 종료 — 툰일기 최종 디자인 스펙 v1.0 / 2026-06-03 / 디자인팀장 확정*
*SSOT 구성: design-final.md(결정·우선순위·종합) + ux-spec.md(플로우·와이어) + ui-spec.md(토큰·컴포넌트 디테일)*
*다음 단계: 프론트팀장 W1 토큰 핸드오프 / 백엔드팀장 W2 캘리브레이션 핸드오프(참조이미지·default값 보강 후)*
