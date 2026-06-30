# 툰일기 RISO EDITION — 컴포넌트/페이지 리스타일 패턴 레퍼런스

> **목적**: 잉크 & 리소(Risograph) 미감으로 전체 UI를 끌어올린다. 이 문서는 단일 진실 공급원(SSOT)이다.
> 토큰은 `src/app/globals.css` 에 이미 정의됨. **새 색/그림자/폰트를 만들지 말고 아래 토큰만 사용**한다.
> 시그니처 컴포넌트(Button, Chip, Card/ComicCard, TabBar, ArtStyleCard)는 이미 이 패턴으로 완성됨 — 참고 표준으로 삼는다.

---

## 0. 핵심 미감 한 줄 요약
신문지 크림 종이 + 따뜻한 잉크 블랙 아웃라인 + 형광 잉크(핑크/블루/옐로우) + **하드 오프셋 그림자(blur 0)** + 하프톤 점묘 + 도장처럼 눌리는 인터랙션.

---

## 1. 절대 규칙 (Do / Don't)

**DO**
- 모든 테두리는 잉크 라인: `border-2 border-[var(--color-line)]` (강조는 `border-[3px]`).
- 모든 그림자는 하드 오프셋 토큰만: `shadow-[var(--shadow-pop-xs|sm|pop|lg|xl)]`. (blur 0, `--color-line` 기반 → 다크 자동 반전)
- 인터랙션 = **도장**: hover `-translate-x-px -translate-y-px` + 한 단계 큰 pop 그림자 / active `translate-x-[2px] translate-y-[2px]` + 한 단계 작은 pop 그림자.
- 제목/라벨/버튼/뱃지 텍스트 = `font-heading` (Do Hyeon). 숫자(컷번호/카운트/날짜 숫자) = `font-english` (Anton). 본문/일기 = `font-sans`. 말풍선/손글씨 느낌 = `font-balloon`(Gaegu) 또는 `font-marker`(Gamja Flower). 로고/대형 히어로 = `font-display`(Black Han Sans).
- 색은 의미 토큰 우선: `--color-primary`(코랄), `--color-secondary`(스카이), `--color-accent`(레몬), 표면은 `--color-surface-raised`/`--color-bg-subtle`/`--color-bg-muted`, 글자는 `--color-text-primary|secondary|muted`.
- 빈 영역/플레이스홀더/장식엔 하프톤: `className="tone-dots"` / `tone-dots-lg` / `tone-lines` / `tone-grid` (currentColor 기반, `text-[...] opacity-NN` 로 농도 제어).
- `transition` 은 속성 한정 + 짧게: `transition-[transform,box-shadow] duration-150 ease-out` (또는 색 포함). `transition-all` 금지.
- 다크모드는 토큰이 자동 반전하므로 **하드코딩 hex/`text-white`/`bg-black` 금지** — `--color-primary-text` 등 토큰 사용.

**DON'T**
- ❌ `shadow-[var(--shadow-sm|md|lg)]`(소프트) 를 카드/버튼/입력 등 인터랙션 표면에 쓰지 말 것 — 오버레이/모달 배경 그림자에만 제한적으로 허용.
- ❌ `border-[var(--color-border-default)]` 같이 회색 톤 기대하는 클래스로 "옅은 테두리" 의도하지 말 것(리소는 기본 테두리도 잉크다). 진짜 옅은 구분선이 필요하면 `border-[var(--color-border-subtle)]`.
- ❌ `text-white`, `bg-white`, 임의 hex. → `--color-primary-text`, `--color-surface-raised` 등.
- ❌ `rounded-2xl`+소프트섀도우식 "둥둥 뜬 카드" SaaS 룩. 리소는 각진 종이+하드 그림자.
- ❌ `font-bold`/`font-medium` 만으로 제목 표현. 제목은 폰트 자체(`font-heading`/`font-display`)로 위계.

---

## 2. 토큰 치트시트 (globals.css 정의됨)

### 폰트
| 토큰 | 폰트 | 용도 |
|---|---|---|
| `font-display` | Black Han Sans | 히어로/대형 타이틀/로고 |
| `font-heading` | Do Hyeon | 섹션 제목, 버튼, 칩, 라벨, 탭 |
| `font-sans` | Pretendard | 본문, 일기 텍스트, 설명 |
| `font-balloon` | Gaegu | 말풍선, 캡션, 친근한 강조 |
| `font-marker` | Gamja Flower | 손글씨 메모/스티커 |
| `font-english` | Anton | 숫자/영문 라벨(컷번호, 카운터, DATE) |

### 컬러 (라이트 기준, 다크 자동 반전)
- 잉크/종이: `--color-ink #16130F`, `--color-paper #F5F0E6`, `--color-line`(아웃라인·그림자 전용, 다크에서 크림으로 반전)
- 잉크 컬러: `--color-coral #FF3D7F`(primary), `--color-sky #2541B2`(secondary), `--color-lemon #FFD400`(accent), `--color-mint #00A95C`
- 의미색: `--color-primary[-hover|-active|-subtle|-text]`, `--color-secondary[-subtle|-text]`, `--color-accent[-subtle|-text]`
- 표면: `--color-surface-raised`(카드), `--color-bg-base|subtle|muted`
- 글자: `--color-text-primary|secondary|muted|disabled|inverse`, `--color-text-link`, `--color-text-accent`
- 상태: `--color-success|warning|error|info` (+ `-subtle`)
- 테두리: `--color-border-default`(=잉크), `--color-border-subtle`(옅은 구분), `--color-border-focus`, `--color-border-error`

### 그림자 (전부 하드 오프셋, blur 0)
`--shadow-pop-xs`(1px) · `--shadow-pop-sm`(2px) · `--shadow-pop`(4px) · `--shadow-pop-lg`(6px) · `--shadow-pop-xl`(10px)
- 컬러 그림자: `--shadow-pop-pink`, `--shadow-pop-blue`
- 포커스: `--shadow-focus`(코랄 링), `--shadow-focus-error`
- (레거시 별칭 `--shadow-ink`=pop, `--shadow-ink-sm`=pop-sm — 신규 코드는 pop 계열 직접 사용)

### 반경 / 보더폭 / z / spacing
- radius: `rounded-sm`(3) `rounded-md`(6) `rounded-lg`(10) `rounded-xl`(14) `rounded-full`. **칩/뱃지/아바타=full, 카드/버튼=lg~xl**.
- z: `--z-sticky`(탭바) `--z-modal` `--z-toast` 등.

### 헬퍼 클래스 (@layer components)
- `.tone-dots` / `.tone-dots-lg` / `.tone-lines` / `.tone-grid` — 하프톤 오버레이(currentColor). 보통 `absolute inset-0 text-[...] opacity-10~25`.
- `.ink-card` — 잉크 테두리+pop 그림자+표면 배경 카드 숏컷.
- `.pop-press` — hover/active 도장 인터랙션 숏컷(클릭 가능한 박스에).
- `.tilt-l`(-1.5°) / `.tilt-r`(1.5°) — 살짝 기울인 종이/스티커 느낌.
- 모션: `animations.css` 의 `inkStamp/panelStamp/pageTurn/halftoneDrift/inkBleed/wiggle/dotJump/inkPulse` + `.anim-halftone-drift`.

---

## 3. 확립된 패턴 스니펫 (복붙 표준)

### 클릭 가능한 표면(버튼형 카드/타일)
```tsx
className={cn(
  "border-2 border-[var(--color-line)] rounded-xl bg-[var(--color-surface-raised)]",
  "shadow-[var(--shadow-pop-sm)]",
  "transition-[transform,box-shadow] duration-150 ease-out",
  "hover:-translate-x-px hover:-translate-y-px hover:shadow-[var(--shadow-pop-lg)]",
  "active:translate-x-[2px] active:translate-y-[2px] active:shadow-[var(--shadow-pop-sm)]",
  "focus-visible:outline-none focus-visible:shadow-[var(--shadow-focus)]",
)}
```

### 선택 상태(칩/라디오/세그먼트)
```tsx
selected
  ? "bg-[var(--color-primary)] text-[var(--color-primary-text)] border-[var(--color-line)] shadow-[var(--shadow-pop-sm)]"
  : "bg-[var(--color-surface-raised)] text-[var(--color-text-secondary)] border-[var(--color-line)] hover:-translate-y-px hover:shadow-[var(--shadow-pop-sm)]"
```

### 정적 카드(비클릭)
```tsx
className="border-2 border-[var(--color-line)] rounded-xl bg-[var(--color-surface-raised)] shadow-[var(--shadow-pop-sm)] p-4"
```

### 컷번호/숫자 뱃지
```tsx
className="h-6 w-6 rounded-full border-2 border-[var(--color-line)] font-english text-[11px] leading-none -rotate-6 bg-[var(--color-lemon)] text-[var(--color-ink)] shadow-[var(--shadow-pop-xs)] flex items-center justify-center"
```

### 빈 영역 플레이스홀더(하프톤)
```tsx
<div className="relative ...">
  <span aria-hidden className="tone-dots absolute inset-0 text-[var(--color-text-muted)] opacity-20" />
  <span className="relative font-english text-2xl text-[var(--color-text-disabled)]">…</span>
</div>
```

### 포커스(모든 인터랙티브 공통)
`focus-visible:outline-none focus-visible:shadow-[var(--shadow-focus)]`

---

## 4. 접근성/기능 보존 (필수)
- 기존 `role`, `aria-*`, `tabIndex`, `onKeyDown`, `forwardRef`, props 시그니처, `displayName`, 컴포넌트 export API **변경 금지**. 시각 스타일(className)과 내부 마크업/장식만 손본다.
- 대비: primary(코랄) 위 텍스트는 `--color-primary-text`. 작은 회색 텍스트 남발 금지.
- `prefers-reduced-motion` 존중: 큰 모션엔 `motion-safe:` 프리픽스. (페이퍼 그레인은 globals에서 이미 처리됨)
- 터치 타깃 최소 44px 유지(TabBar/버튼).
- `"use client"` 지시문 유지.

## 5. 작업 후 자가검증
- `npx tsc --noEmit` 통과(타입 무변경 목표).
- 하드코딩 hex/`text-white`/`shadow-[var(--shadow-md)]` 잔존 grep 0건(인터랙션 표면 기준).
- import 경로/`cn` 사용 유지.
