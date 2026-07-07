# 직장인 성향 분석기 (Office Archetype) — 디자인 최종안

> STEP 3(디자인 시작) 최종 산출물 · @디자인팀장 확정본 · 2026-07-07
> 입력: `docs/planning/office-archetype-direction.md`(방향서, 충돌 시 최우선) · `docs/design/office-archetype-ux-spec.md`(@UX디자이너) · `docs/design/office-archetype-ui-spec.md`(@UI디자이너)
> slug: `office-archetype` · 라우트: `src/app/office-archetype/` · 배포: `project-orsrw.vercel.app/office-archetype`
> **스택 확정**: Next.js 14.2.3 App Router · React 18 · TypeScript · `/pae` 자체 CSS 격리 패턴
> **이 문서 하나로 개발팀(프론트/백엔드)이 STEP 4를 시작할 수 있어야 한다.** UX 와이어 + UI 비주얼을 통합하고, 두 스펙의 상충을 팀장 판단으로 해소한 단일 소스(SSOT)다.

---

## 0. 팀장 결정 요약 — 상충 해소 (Decision Log)

두 스펙에서 서로 다르거나 미정이던 지점을 **개발 착수 가능하도록 전부 확정**한다. (근거를 함께 명시)

| # | 쟁점 | UX 스펙 | UI 스펙 | **팀장 확정** | 근거 |
|---|---|---|---|---|---|
| D1 | 선택지 개수/레이아웃 | 4지선다(극단2+중도1~2) | 2 vs 4 미정 | **4지선다 · 1열 세로 스택** | UX가 정확도(중도 이탈 방지) 근거로 4지선다 명시 → 그대로 확정. 1열이 한 손 조작·터치타겟 유리 |
| D2 | 상태 저장소 | `sessionStorage` | (언급 없음) | **`sessionStorage`** | 재방문 시 stale 결과 방지 + 새로고침 복원 둘 다 만족. localStorage는 누적 카운터·테마에만 사용 |
| D3 | 자동 전환 딜레이 | 150ms | 300ms | **260ms** (선택 점등 → 슬라이드) | 오탭 인지 가능한 시각 피드백(≥200ms) + 체감 지연 없음. reduce-motion 시 0ms |
| D4 | OG 이미지 생성 방식 | Canvas or @vercel/og 택1(개발 판단) | next/og 권장 | **`next/og` `ImageResponse` (route handler) 단일 채택** | OG 메타 정확도(카톡 프리뷰) + 딥링크 무한 수명. "DB/API 0"과 상충 안 함(엣지 정적 렌더, 상태 없음). 클라 캔버스 이중구현 제거 |
| D5 | 결과 라우트 구조 | `/result` + `/result/[typeSlug]` 딥링크 | (언급 없음) | **`/result/[typeSlug]` 단일** (딥링크 = 정식 결과, `generateStaticParams` 8종) | `/result`(파라미터 없음)는 sessionStorage 결과 slug로 즉시 replace 리다이렉트. 라우트 단순화 |
| D6 | 상성 매칭 방향 | 단방향(matchSlug) | 단방향(matchBestId) 전제 | **단방향(`matchBestId`) MVP 확정** | 8×8 궁합표는 Phase 2. MVP는 결과당 "찰떡궁합 1유형"만 노출 |
| D7 | 콘텐츠 max-width | 480px | ≥480px에서 420px | **컨테이너 480px / 콘텐츠 정렬 폭 420px** | 480 셸 안에서 좌우 20px 패딩 → 실 콘텐츠 440px. UI의 420 데스크톱 카드 폭은 결과 사원증 카드에만 적용 |
| D8 | 문항 히스토리(뒤로가기) | pushState or 내부 state+popstate | (언급 없음) | **내부 state + `history.pushState`/`popstate` 동기화** | 브라우저 뒤로가기 = 이전 문항 요구 충족. URL은 `/test` 고정(문항번호 노출 안 함) |
| D9 | 8유형 네이밍 | (엔진 밖) | 초안 8개 제시 | **초안 확정하되 §3에 "베타 게이트 전 확정 아님" 명시** | 방향서 §5 베타 공감률 4.0/5.0 게이트 통과 전까지 JSON placeholder. 코드 하드코딩 금지 |
| D10 | 다크모드 | globals 계승 or 스코프 | `.oa-shell[data-theme]` 스코프 | **`.oa-shell[data-theme]` 로컬 토글** | blast radius 0. 질문 화면은 토글 숨김(몰입) |
| D11 | 판정 로딩 연출 | 0.6~1.0초 | (언급 없음) | **0.7초 고정** (`oa-indeterminate` 바 + "분석 중" 카피) | "랜덤 아님" 신뢰 연출. reduce-motion 시에도 텍스트는 유지, 애니만 정지 |

---

## 1. 확정 화면 목록 & 화면별 최종 스펙 (UX 와이어 + UI 비주얼 통합)

### 1-0. 정보 구조 (IA) — 확정 라우팅

```
src/app/office-archetype/
  layout.tsx                     <div className="oa-shell" data-theme={theme}> 래퍼 + import "./oa.css"
  oa.css                         전 스타일(자체 격리, globals/tailwind 무수정)
  page.tsx                       [화면1] 랜딩/인트로
  test/page.tsx                  [화면2] 질문 10문항 (URL 고정, 내부 state)
  result/page.tsx                [리다이렉터] sessionStorage 결과 → /result/[slug]로 replace, 없으면 랜딩
  result/[typeSlug]/page.tsx     [화면3] 결과 + 딥링크 프리뷰 (generateStaticParams 8종)
  og/[typeSlug]/route.tsx        [화면4 소스] OG 이미지 2종 (?variant=square|story)
  data/
    questions.json               10문항 (§4 스키마)
    types.json                   8유형 (§4 스키마)
    config.json                  공용 카피/라벨 (엔진 재사용용)
```

> `src/data/office-archetype/`가 아니라 **라우트 내부 `src/app/office-archetype/data/`** 에 배치(정적 임포트, `/pae` 격리 원칙 일관). 빌드타임 `import`라 런타임 fetch·로딩상태 불필요.

**딥링크 모드 분기**: `/result/[typeSlug]` 진입 시 `sessionStorage`에 본인 결과가 있으면 → 본인 결과 모드. 없으면 → **"친구 결과 프리뷰" 모드**(상단 배지 "누군가 공유한 결과예요" + 하단 CTA "나는 무슨 유형일까? 1분 테스트 →" `/office-archetype`).

**상태 목록(확정)**

| 상태 | 저장 위치 | 키 |
|---|---|---|
| 현재 문항 인덱스(0~9) | React state (+ history state) | — |
| 답변 배열 | `sessionStorage` | `oa-answers` |
| 결과 slug | `sessionStorage` | `oa-result` |
| 다크 테마 | `localStorage` | `oa-theme` (`light`/`dark`) |
| 누적 참여수(선택) | `localStorage` | `oa-count` (사회적 증거, 없으면 정적 카피) |

---

### 화면 1 — 랜딩/인트로 (`/office-archetype`)

**목표**: 3초 안에 "직장인용 · 10문항 · 1분 · 무료" 이해 + "MBTI 아님" 차별화 각인 + 시작 전환.

```
┌───────────────────────────────┐  max-w 480, mx-auto, min-h 100dvh, bg --oa-bg
│                    [☾ 테마토글] │  헤더: 투명, 우측 상단만 (Sun/Moon)
│   ⬡ ⬡ ⬡ ⬡                     │  8유형 아이콘 그리드(blur 6px, opacity .5)
│   ⬡ ⬡ ⬡ ⬡                     │  "내 유형은 이 중 뭘까?" 궁금증
│                               │
│   당신의 직장 유형은?          │  H1 hero(30px/800, Paperlogy), --oa-ink
│   10문항 · 1분 · 100% 무료      │  --oa-text-body-sm, --oa-muted
│                               │
│   MBTI 말고,                   │  서브카피 --oa-text-body
│   진짜 회사에서의 내 모습       │  "MBTI 말고" = §6 정확도 프레이밍
│                               │
│  ┌─────────────────────────┐  │
│  │      시작하기  →         │  │  Primary CTA, h52, --oa-primary, full-width
│  └─────────────────────────┘  │
│   지금까지 12,483명 참여        │  사회적 증거(정적/localStorage 누적)
│  ─────────────────────────    │
│  [광고 슬롯 — CTA 아래]         │  결과보다 위 금지 원칙(랜딩에도 적용)
└───────────────────────────────┘
```

- **비주얼**: 배경 `--oa-bg`, 상단 8칸 아이콘 그리드는 8유형 `color.solid` 라인아이콘을 `blur(6px)` + `opacity .5`로 티저. CTA 탭 시 `scale(0.97)` 90ms.
- **카피 규칙**: H1은 반드시 "직장/회사" 맥락. "MBTI 말고" 문구 필수(§6).
- **접근성**: CTA는 `<button>`/`<Link>`, `--oa-text-hero` `<h1>`. 테마토글 `aria-label`.

---

### 화면 2 — 질문 (`/office-archetype/test`)

**목표**: 한 손 조작 · 탭 즉시 자동 전환 · 진행률 항상 노출 · 뒤로가기 유지.

```
┌───────────────────────────────┐  min-h 100dvh, flex column
│  [←]  ▓▓▓▓░░░░░░  4 / 10       │  헤더 h52 sticky: 뒤로가기(44px) + 세그먼트 진행바 + 숫자(tabular-nums)
├───────────────────────────────┤
│                               │  (상단 1/3: 질문 텍스트)
│   회의 중 내 의견과 다른        │  --oa-text-question(18px/600, clamp)
│   결정이 내려졌을 때, 나는?     │  최대 2줄
│                               │
│                               │  (하단 2/3: 선택지 — 엄지 도달 구간)
│  ┌─────────────────────────┐  │
│  │ A. 일단 따르고 나중에     │  │  선택지 카드 min-h 56px, 1열
│  │    따로 의견을 전달한다    │  │  border 1.5px, radius-md, shadow-sm
│  └─────────────────────────┘  │
│  ┌─────────────────────────┐  │
│  │ B. 그 자리에서 바로 재차   │  │  gap 12px
│  │    의견을 제시한다         │  │
│  └─────────────────────────┘  │
│  ┌ C ... ┐  ┌ D ... ┐         │  (총 4개, 극단2 + 중도1~2)
└───────────────────────────────┘  하단 CTA 없음 = 선택지 탭이 곧 "다음"
```

**인터랙션(확정)**
- 선택지 탭 → 카드 `--oa-primary` 배경 점등 + 우측 체크 페이드인 → **260ms 후 자동 다음 문항**(`translateX` 슬라이드 + 페이드). 뒤로가기 시 역방향 슬라이드.
- 마지막(10번) 문항 또는 뒤로가기 직후 재선택은 오조작 방지를 위해 동일 260ms 유지(별도 "다음" 버튼 없음 — 일관성 우선; UI 스펙의 "마지막 문항 다음버튼 노출" 제안은 채택 안 함, 10탭=10문항 원칙 유지).
- 10번 완료 → 판정 로딩(0.7초, `oa-indeterminate` + "당신의 유형을 분석하는 중…") → `sessionStorage.oa-result` 저장 → `router.replace('/office-archetype/result/[slug]')` + `history.replaceState`로 질문 히스토리 정리.
- 뒤로가기(헤더 `←` = 브라우저 popstate 동기화): 이전 문항 + 기존 선택 하이라이트 복원. 1번에서 뒤로 = 랜딩.
- 선택지 텍스트 **line-clamp 금지**(잘림 방지, moira 교훈) — 길면 카드 높이 증가.

**접근성**: 진행바 `role="progressbar"` `aria-valuenow/min/max` `aria-label="10문항 중 N번째"`. 선택지 실제 `<button>`, Tab 순서 = 시각 순서. 문항 전환 시 `aria-live="polite"`로 새 문항 안내.

---

### 화면 3 — 결과 (`/office-archetype/result/[typeSlug]`)

**목표**: 스크롤 없이 유형명 노출 · 강점/그림자 · 상성 매칭(2차 공유 트리거) · 1탭 공유.

```
┌───────────────────────────────┐
│  [공유]   OFFICE ARCHETYPE  [☾]│  헤더 h52, surface + 하단 border
├───────────────────────────────┤
│   ╭───────── 사원증 카드 ─────╮ │  §4-3 결과 카드(OG와 레이아웃 소스 공유)
│   │ OFFICE ARCHETYPE  No.03/08│ │  상단 크롬바
│   │        ( 아이콘 )          │ │  80px 원형, bg type.tint, icon type.solid
│   │    회의실의 조용한 해결사   │ │  --oa-text-hero, --oa-ink (3초 이해 지점)
│   │      〈사색형 해결사〉       │ │  alias, --oa-muted
│   │  "말은 적지만 결정적일 때   │ │  tagline, 한 줄
│   │   정확한 한마디를 던진다"   │ │
│   │  강점 ●●●●○   그림자 ●●○○○ │ │  미니 도트 게이지(자기 속성 강조, 타유형 비교 아님)
│   │ ┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈ │ │  점선 구분
│   │ 🤝 이런 동료와 찰떡궁합     │ │  ★ 상성 매칭(2차 확산) — tint 배경 구분
│   │   [아이콘] 에너자이저형     │ │  matchBestId 유형
│   │   "침묵을 행동으로 바꿔주는"│ │  [이 유형 보기 →]
│   │ ▚▚▚ (바코드 장식) ▚▚▚      │ │  하단 절취선 장식(순수 장식)
│   ╰───────────────────────────╯ │
│  💪 강점                        │  카드 밖 상세: <ul> 시맨틱, 장면형 문장
│   · 논리적 판단, 감정에 안 휩쓸림 │
│  🌑 이럴 때 주의하면 더 좋아요   │  "약점" 아님(순화, §6)
│   · 의견을 아껴 오해를 살 수 있음│
│  ─────────────────────────    │
│  [광고 슬롯 — 공유 CTA 위]      │  결과보다 아래 원칙
├───────────────────────────────┤
│ [카톡 공유]     [이미지 저장]   │  StickyBottomBar, pb-safe
│        다시 테스트하기          │  텍스트 링크(보조)
└───────────────────────────────┘
```

**비주얼(확정)**
- 결과 카드 = **사원증 메타포**, `--oa-shadow-card`(목걸이 이중그림자), 뒤에 -4deg tint 블록 살짝 비침.
- 강점/그림자 = **도트 5개 채움 게이지**(자기 유형 내 속성 강조). ⚠️ **REDLINE**: 타 유형과 직접 수치 비교 UI·외모/능력 점수화 금지.
- 상성 매칭 섹션은 `type.color.tint` 배경으로 시각 구분 → 2차 공유 낚싯바늘. `[이 유형 보기 →]` 탭 = 바텀시트로 해당 유형 프리뷰(전체 화면 전환 없이 컨텍스트 유지).

**인터랙션**
- 결과 진입: 아이콘 페이드인 → 유형명 → tagline 순 100ms stagger(`oa-rise`, reduce-motion 시 정지).
- 공유 카드 이미지는 `next/og` 라우트라 사전 프리렌더 불필요(URL 요청 시 엣지 생성). 카톡 공유는 OG 메타로 자동, 이미지 저장은 `/og/[typeSlug]?variant=story` fetch → blob 다운로드.
- 다시 테스트하기: 확인 모달 없이 `sessionStorage.clear()` + 랜딩 이동.

**공유 폴백 체인(확정)**: Web Share API(`navigator.share`, 가능 시 `files`) → 실패/미지원 시 Kakao SDK(`Kakao.Share.sendDefault`) → 최종 클립보드 복사 + "링크가 복사되었어요" 토스트. **빈 에러창/콘솔 에러 노출 절대 금지.**

---

### 화면 4 — 공유 카드 (2종) → §5 상세

---

## 2. 확정 디자인 토큰 (단일 소스 · `oa.css`)

> UI 스펙 §2를 **SSOT로 확정**. `.oa-shell` 스코프 CSS 변수, 다크는 `[data-theme="dark"]` 속성 토글. `globals.css`/`tailwind.config.ts` 무수정.
> 아래를 `src/app/office-archetype/oa.css` 최상단에 그대로 반영.

```css
/* 폰트: 헤드라인 전용 1개만 로드(초경량 원칙) */
@import url('https://cdn.jsdelivr.net/gh/projectnoonnu/2408-2@1.0/Paperlogy.css');

.oa-shell {
  color-scheme: light;

  /* Base — 오피스 뉴트럴(네이비 베이스) */
  --oa-bg: #F4F5F7; --oa-surface: #FFFFFF; --oa-surface-raised: #FFFFFF;
  --oa-border: #E3E6EC; --oa-border-strong: #C7CCD6;
  --oa-ink: #1C2333; --oa-body: #4B5468; --oa-muted: #8A93A6; --oa-placeholder: #B3B9C6;

  /* Brand — 딥네이비 + 스티키노트 옐로 */
  --oa-primary: #2B3556; --oa-primary-ink: #FFFFFF; --oa-primary-dark: #1A2038;
  --oa-accent: #FFC94A; --oa-accent-ink: #2B3556; --oa-accent-soft: #FFF3D6;

  /* Semantic */
  --oa-success: #2E9E6B; --oa-success-bg: #E7F6EE;
  --oa-warning: #E0972B; --oa-warning-bg: #FDF1E1;
  --oa-error: #E24C4C;   --oa-error-bg: #FCE9E9;
  --oa-info: #3D6FE0;    --oa-info-bg: #EAF0FD;

  /* 진행바(출입 게이트) */
  --oa-progress-track: #E3E6EC;
  --oa-progress-fill: linear-gradient(90deg, #2B3556, #4A5A8F);

  /* Shadow — 사원증 카드 부양감 */
  --oa-shadow-sm: 0 1px 2px rgba(28,35,51,0.06);
  --oa-shadow-md: 0 4px 14px rgba(28,35,51,0.10);
  --oa-shadow-lg: 0 12px 32px rgba(28,35,51,0.16);
  --oa-shadow-card: 0 2px 0 rgba(28,35,51,0.06), 0 10px 24px rgba(28,35,51,0.10);

  /* Radius */
  --oa-radius-sm: 8px; --oa-radius-md: 14px; --oa-radius-lg: 20px;
  --oa-radius-full: 999px; --oa-radius-card: 18px;

  /* Spacing(4px 배수) */
  --oa-space-1: 4px;  --oa-space-2: 8px;  --oa-space-3: 12px; --oa-space-4: 16px;
  --oa-space-5: 20px; --oa-space-6: 24px; --oa-space-8: 32px;
  --oa-space-10: 40px; --oa-space-12: 48px;

  /* Typography */
  --oa-font-display: "Paperlogy","Pretendard Variable","Pretendard",system-ui,sans-serif;
  --oa-font-body: -apple-system,BlinkMacSystemFont,"Pretendard Variable","Malgun Gothic",system-ui,sans-serif;
}

/* 다크모드 — 값만 교체(컴포넌트 CSS 재사용) */
.oa-shell[data-theme="dark"] {
  color-scheme: dark;
  --oa-bg: #14171F; --oa-surface: #1C2030; --oa-surface-raised: #232838;
  --oa-border: #2C3244; --oa-border-strong: #3B4257;
  --oa-ink: #F1F3F8; --oa-body: #C4C9D6; --oa-muted: #7C8296; --oa-placeholder: #565D71;
  --oa-primary: #4A5A8F; --oa-primary-ink: #FFFFFF; --oa-primary-dark: #384470;
  --oa-accent: #FFC94A; --oa-accent-ink: #1C2333; --oa-accent-soft: #3A331C;
  --oa-success: #4CC38A; --oa-success-bg: #16302A;
  --oa-warning: #F0A94A; --oa-warning-bg: #332711;
  --oa-error: #F0716B;   --oa-error-bg: #33191A;
  --oa-info: #6C93F0;    --oa-info-bg: #191F33;
  --oa-progress-track: #2C3244;
  --oa-progress-fill: linear-gradient(90deg, #4A5A8F, #7A8BC4);
  --oa-shadow-sm: 0 1px 2px rgba(0,0,0,0.3);
  --oa-shadow-md: 0 4px 14px rgba(0,0,0,0.4);
  --oa-shadow-lg: 0 12px 32px rgba(0,0,0,0.5);
  --oa-shadow-card: 0 2px 0 rgba(0,0,0,0.3), 0 10px 24px rgba(0,0,0,0.45);
}
```

**타이포 스케일(확정)**

| 토큰 | 크기/행간/굵기 | 용도 |
|---|---|---|
| hero | `clamp(26px,7vw,30px)` / 1.28 / 800 | 랜딩 훅, 결과 유형명 |
| h1 | 24px / 1.3 / 700 | 섹션 제목 |
| h2 | 19px / 1.4 / 700 | 카드 제목 |
| question | `clamp(16px,4.2vw,18px)` / 1.45 / 600 | 문항 |
| body | 15px / 1.6 / 400 | 본문 |
| body-sm | 13.5px / 1.55 / 400 | 캡션 |
| label | 12px / 1.4 / 700, LS .04em, uppercase | 배지/라벨 |
| mono-num | 15px, `tabular-nums`, 700 | 진행률 숫자 |

**레이아웃(확정)**: 셸 `max-width:480px; margin:0 auto`, 좌우 패딩 20px. 결과 사원증 카드만 `max-width:340px` 중앙. `≥480px`에서 바깥 배경 `filter:brightness(0.97)`로 카드 부양감. 터치타겟 최소 44×44(`.touch-target` 전역 유틸 재사용), 선택지 카드 min-h 56. `.pb-safe` 전역 유틸로 하단 sticky safe-area.

**모션(확정) — `oa.css`에 커스텀 keyframe 정의 + 반드시 reduce-motion 재정의**
```css
@keyframes oa-indeterminate { /* 판정 로딩 바 */ }
@keyframes oa-rise { /* 결과 stagger 진입 */ }
@media (prefers-reduced-motion: reduce) {
  .oa-shell *, .oa-shell *::before, .oa-shell *::after {
    animation-duration: .01ms !important; animation-iteration-count: 1 !important;
    transition-duration: .01ms !important;
  }
}
```
> 스코프 격리로 globals의 전역 reduce-motion이 `.oa-shell` 커스텀 keyframe까지 못 잡을 수 있으므로 **oa.css에도 동일 블록 필수**(UI 스펙 §4-2 지적 반영).

**포커스 링(확정)**: `.oa-shell :focus-visible { box-shadow:0 0 0 3px rgba(43,53,86,0.28) }` — 전역 오렌지 링을 라우트 스코프에서 override(moira `.moira-scope` 선례).

---

## 3. 8유형 최종 확정 (네이밍 · 축 · 비주얼)

### 3-1. 축 (확정 — MBTI 재탕 금지, 방향서 §5)
- **X축: 일 중심 ↔ 관계 중심** (일 우선 vs 사람·분위기 우선)
- **Y축: 주도형 ↔ 순응형** (판을 짜냐 vs 흐름에 맞추냐)
- 4상한 × 각 상한 내 2유형 = 8유형. MBTI 알파벳 조합(E/I·T/F 등) **네이밍/카피/문항 어디에도 사용 금지**.

### 3-2. 8유형 확정표

> ⚠️ **베타 게이트 고지**: 아래 네이밍·정의는 **디자인 확정 초안**이다. 코드에는 반드시 `types.json` placeholder로만 넣고, 방향서 §5 "블라인드 200개+ 정성분석 + 직장인 30~50명 베타 공감률 평균 4.0/5.0" 게이트 통과 후 최종 확정한다. **컬러/아이콘/이름 하드코딩 금지** — 컴포넌트는 `type.color.solid`를 `style={{'--oa-type-color':...}}`로 주입.

| # | id | 유형명 | 축 | tagline(초안) | tint | solid | deep | icon(lucide) |
|---|---|---|---|---|---|---|---|---|
| 1 | `bulldozer` | 불도저형 | 일×주도 | 회의보다 실행, 일단 치고 나간다 | #FCE7E1 | #E0522E | #A83D22 | hard-hat |
| 2 | `architect` | 설계자형 | 일×주도 | 판을 먼저 짜고 그린 대로 간다 | #E6E9F2 | #2B3556 | #1A2038 | ruler |
| 3 | `finisher` | 해결사형 | 일×순응 | 시키면 제일 깔끔하게 끝낸다 | #E1F1EE | #3D8B7A | #2C6659 | check-check |
| 4 | `steady` | 묵묵러형 | 일×순응 | 티는 안 나도 늘 제자리를 지킨다 | #ECEEF1 | #6B7280 | #4B515C | sprout |
| 5 | `sparker` | 분위기메이커형 | 관계×주도 | 텐션과 리액션으로 무드를 올린다 | #FFF3D6 | #E0972B | #A86D18 | party-popper |
| 6 | `mediator` | 중재자형 | 관계×주도 | 갈등 전에 먼저 나서 조율한다 | #F4E8F6 | #C77DD1 | #94509E | scale |
| 7 | `listener` | 경청러형 | 관계×순응 | 말수는 적지만 다 듣고 다 챙긴다 | #E4F0FB | #4E9FE0 | #2F73AC | headphones |
| 8 | `tuner` | 텐션조절러형 | 관계×순응 | 눈치 빠르게 분위기 맞추는 만능 조연 | #FCE7EF | #E0729A | #AC4F72 | sliders-horizontal |

> ⚠️ **컬러 상충 해소**: UI 스펙 §3-2 원표에서 5번 분위기메이커형이 `#FFC94A`(옐로)였으나 이는 `--oa-accent`(UI 크롬 강조색)와 충돌 → **유형 8색은 UI 크롬색(딥네이비/옐로)과 겹치지 않게** 하라는 UI 스펙 §3-3 자체 원칙에 따라 5번을 앰버 `#E0972B`로 조정. 2번 설계자형도 `--oa-primary` 딥네이비와 동일해 tint/deep로 구분 강화. (네이밍 확정 시 함께 재검증)

**네이밍 규칙**: 전부 `~형`, 2~5글자 순우리말/직관어. 캐릭터 마스코트 없음 — 오브젝트 라인아이콘(2.5px 스트로크) + 컬러 블록. 결과 카드 상단 아이콘 64~80px, 배경 `tint` 원형.

**상성 매칭(단방향 확정)**: 각 유형 `matchBestId` 1개(찰떡궁합). MVP는 이것만 노출. `matchWorstId`는 데이터에 두되 화면 미노출(Phase 2 여지).

---

## 4. 테스트 엔진 데이터 스키마 (dev 핸드오프 · 하드코딩 금지 계약)

> 이 스키마가 "테스트 엔진"의 **계약(contract)**. 화면 컴포넌트는 도메인 단어("직장"·"동료")를 하드코딩하지 말고 전부 JSON/config에서 주입. 후속 시리즈(hsp-test, dating-balance)가 JSON만 교체해 동일 컴포넌트 재사용.

### 4-1. `data/config.json` — 엔진 공용 카피/축 (시리즈별 교체)
```json
{
  "slug": "office-archetype",
  "title": "당신의 직장 유형은?",
  "subtitle": "MBTI 말고, 진짜 회사에서의 내 모습",
  "questionCount": 10,
  "axes": [
    { "id": "x", "pos": "work",   "neg": "relation" },
    { "id": "y", "pos": "lead",   "neg": "follow" }
  ],
  "labels": {
    "start": "시작하기",
    "restart": "다시 테스트하기",
    "strengths": "강점",
    "shadows": "이럴 때 주의하면 더 좋아요",
    "match": "이런 동료와 찰떡궁합",
    "shareKakao": "카톡 공유",
    "shareStory": "이미지 저장",
    "analyzing": "당신의 유형을 분석하는 중…"
  },
  "resultBasePath": "/office-archetype/result"
}
```

### 4-2. `data/questions.json` — 10문항
```json
{
  "version": 1,
  "questions": [
    {
      "id": "q1",
      "text": "팀 회식 자리 배정을 정할 때 나는?",
      "options": [
        { "id": "a", "text": "다들 편한 대로 앉게 둔다",         "scores": { "x": -2, "y": -1 } },
        { "id": "b", "text": "은근슬쩍 원하는 자리를 먼저 잡는다", "scores": { "x":  1, "y":  2 } },
        { "id": "c", "text": "상사·분위기 봐서 자리를 조율한다",   "scores": { "x": -2, "y":  1 } },
        { "id": "d", "text": "누가 정하든 빨리 정해지길 바란다",   "scores": { "x":  1, "y": -1 } }
      ]
    }
  ]
}
```
- `scores`는 **축 id(x/y) → 정수 가감**. 판정 = 전 문항 x·y 합산 → 부호로 4상한 결정 → 상한 내 서브 규칙(예: 절대값 큰 축의 강도)으로 8유형 중 1개 확정. 정확한 판정 함수는 엔진(`lib/score.ts`)에서 구현하되 **문항이 축을 어떻게 밀지는 데이터가 소유**.
- 극단 2 + 중도 1~2 구성(D1). 문항 1~3 저부담 → 4~8 판별력 → 9~10 가벼운 마무리(§6-2).

### 4-3. `data/types.json` — 8유형
```json
{
  "version": 1,
  "types": [
    {
      "id": "bulldozer",
      "name": "불도저형",
      "alias": "돌파형 실행가",
      "axis": { "x": "work", "y": "lead" },
      "tagline": "회의보다 실행, 일단 치고 나간다",
      "color": { "tint": "#FCE7E1", "solid": "#E0522E", "deep": "#A83D22" },
      "icon": "hard-hat",
      "gauge": { "strength": 4, "shadow": 2 },
      "strengths": [
        "정체된 회의도 '일단 해보죠' 한마디로 굴러가게 만든다",
        "마감이 코앞일 때 가장 믿음직한 사람"
      ],
      "shadows": [
        "합의를 건너뛰어 나중에 '왜 마음대로 했냐' 소리를 듣기도",
        "속도에 밀려 디테일을 놓칠 때가 있다"
      ],
      "matchBestId": "mediator",
      "matchBestReason": "당신이 치고 나갈 때 뒤탈을 조율해 주는 사람",
      "matchWorstId": "listener"
    }
  ]
}
```
- `gauge`: 강점/그림자 도트 게이지 채움값(0~5, **자기 유형 내 속성 강조** — 타 유형 비교 아님, REDLINE 준수).
- `strengths`/`shadows`: **장면형 문장**(형용사 나열 금지, §6-1). `shadows` 라벨은 config의 "이럴 때 주의하면 더 좋아요"로 순화.
- `matchBestId`/`matchBestReason`: 상성 매칭 카드. `matchWorstId`는 미노출(Phase 2).

### 4-4. 판정 엔진 인터페이스(제안)
```ts
// lib/score.ts — 도메인 무지(domain-agnostic)
type Answer = { qid: string; oid: string };
function resolveType(answers: Answer[], questions: Question[], types: Type[]): Type;
// 축 합산 → 4상한 → 상한 내 서브규칙 → Type 반환. 동점 tie-break 규칙 문서화 필수.
```

---

## 5. 공유 카드 2종 최종 스펙 (`og/[typeSlug]/route.tsx`)

> **방식 확정(D4)**: `next/og` `ImageResponse` route handler. `?variant=square|story`. Paperlogy 폰트 파일을 프로젝트 로컬(`public/fonts/`)에 포함해 `ImageResponse` fonts로 주입. OG 메타(`opengraph-image`/`twitter:image`)는 square를 기본 연결.
> 두 포맷 모두 결과 사원증 카드(§1 화면3)의 정보구조 계승 + **하단 URL 워터마크 필수**(카드만 보고도 재유입). 배경 = `color.tint` 베이스 + 우상단 반투명 원(`color.solid` opacity .15).

### 5-1. 1:1 (카톡·트위터·피드) — `1200×1200`

| 영역 | x,y,w,h | 내용 |
|---|---|---|
| 배경 | 0,0,1200,1200 | `color.tint` + 우상단 장식 원 |
| 워드마크 | 80,72 | "OFFICE ARCHETYPE" 20px, LS |
| 아이콘 배지 | center,y260,⌀200 | 흰 원 + 유형 아이콘 120px `solid` |
| 유형명 | center,y520 | 72px/800 Paperlogy, ink |
| 태그라인 | center,y610,w900 | 32px/400, 최대2줄, 중앙 |
| 상성 배지 | center,y760,720×140 | 흰 반투명(.9) "찰떡궁합: {매칭유형}" 28px |
| CTA 바 | 0,1080,1200,120 | `--oa-primary` 풀폭 "나도 테스트하기 → url" 30px 흰색 |
| 세이프존 | 상하좌우 ≥48px | 카톡 크롭 대응 |

### 5-2. 9:16 (인스타 스토리) — `1080×1920`

| 영역 | x,y,w,h | 내용 |
|---|---|---|
| 배경 | 0,0,1080,1920 | `color.tint`→흰5% 세로 그라디언트 |
| **상단 세이프존** | 0~250 | **비움**(스토리 프로필 UI) |
| 워드마크 | 90,260 | 24px |
| 아이콘 배지 | center,y460,⌀260 | 아이콘 160px |
| 유형명 | center,y790 | 88px/800 |
| 태그라인 | center,y900,w820 | 36px, 최대2줄 |
| 강점 pill×3 | center,y1040 | `solid` 배경, 흰 24px, radius-full |
| 상성 카드 | center,y1200,880×260 | 흰 카드(radius24,shadow) "찰떡궁합" 아이콘+이름+이유2줄 |
| CTA | center,y1560 | "나도 내 유형 확인하기 →" 40px |
| **하단 세이프존** | 1640~1920 | **비움**(답장 입력창), 그 위 URL 워터마크 |

- 파일 PNG(불투명). 스토리 공유 버튼 → `/og/[typeSlug]?variant=story` fetch → blob 다운로드/`navigator.share({files})`.
- ⚠️ 카카오 실제 크롭 비율은 배포 직전 실기기 카톡 공유로 QA 재검증(§7 R3).

---

## 6. 정확도 리스크 대응 (카피·문항·베타 게이트) — 방향서 §5 최우선

### 6-1. 카피 톤 (전 화면 공통, 콘텐츠팀 준수)
- **바넘 역이용 + 구체성**: "상황에 따라 다르다"류 금지. 직장 구체 장면 묘사("월요일 오전 회의에서의 당신").
- **행동 먼저, 라벨 나중**: "내향적입니다" ✗ → "회의 끝나고 나서야 할 말이 떠오르죠" ✓.
- **긍정 우선**: 강점을 그림자보다 먼저·길게. 그림자 라벨 = "이럴 때 주의하면 더 좋아요".
- **직장 밈 어휘**: 칼퇴·리마인드 메일·복붙 보고서 등(과하지 않게).
- **MBTI 명시 차별화**: 랜딩·결과에 "이건 MBTI가 아니라 '직장에서의 나'" 반복.

### 6-2. 문항 설계 가이드
- 반드시 "직장 내 특정 상황"으로 시작(일반 성격질문 금지). 4지선다(극단2+중도1~2). 순서: 1~3 저부담 → 4~8 판별력 → 9~10 가벼운 마무리.

### 6-3. 베타 검증 = **배포 게이트**
```
1) 블라인드 200개+ 정성분석 → 8유형·10문항 JSON 확정
2) /office-archetype 비공개 링크 30~50명 → 결과 화면에 임시 위젯
   "이 결과, 내 얘기 같나요?" [1~5점] → GA4/Vercel Analytics 이벤트(백엔드 저장 불필요)
3) 유형별 평균 <4.0/5.0 → 해당 유형 재설계 / 전체 <4.0 → 배포 보류·축 재검토
4) 4.0 이상만 정식 공개. 위젯은 비용 0이라 상시 유지 권장(지속 모니터링)
```
- 계측 이벤트(최소): `test_start`, `test_complete`(유형별), `share_click`(kakao/story/copy), `deeplink_view`(유형별), `deeplink_to_test_start`. → K-factor 검증용. **어떤 애널리틱스가 이미 연동됐는지 백엔드 확인 필요(R5).**

---

## 7. dev 핸드오프 체크리스트 + 미해결 리스크

### 7-1. 프론트 핸드오프 체크리스트
- [ ] `src/app/office-archetype/{layout,page}.tsx` + `test/`, `result/`, `result/[typeSlug]/`, `og/[typeSlug]/route.tsx` 생성
- [ ] `layout.tsx`: `<div className="oa-shell" data-theme={theme}>` + `import "./oa.css"` (globals/tailwind 무수정)
- [ ] `oa.css`: §2 토큰 전량 + Paperlogy `@import` + 커스텀 keyframe + **oa.css 내 reduce-motion 재정의 필수**
- [ ] `data/{config,questions,types}.json` 분리, 컴포넌트 도메인 하드코딩 금지(§4 계약)
- [ ] 선택지 4지선다 1열 · 탭→260ms 자동 전환 · line-clamp 금지
- [ ] 뒤로가기 pushState/popstate 동기화 · 답변 sessionStorage(`oa-answers`) 복원
- [ ] 판정 0.7초 로딩 연출(`oa-indeterminate`) → `oa-result` 저장 → `/result/[slug]` replace + history 정리
- [ ] `/result/[typeSlug]` `generateStaticParams` 8종 · sessionStorage 유무로 본인/딥링크 프리뷰 분기
- [ ] `/result`(무파라미터) = 결과 slug로 replace, 없으면 랜딩 리다이렉트 + 토스트
- [ ] 결과 카드 = 사원증 메타포 · 강점/그림자 도트 게이지 · 상성 매칭 tint 섹션
- [ ] 공유 폴백 체인: Web Share → Kakao SDK → 클립보드(에러 노출 금지)
- [ ] 다크 로컬 토글(`oa-theme`) 최초 시스템값 반영 · 질문 화면 토글 숨김
- [ ] 터치타겟 44px · `.touch-target`/`.pb-safe` 전역 유틸 재사용 · `min-h:100dvh`
- [ ] 접근성: progressbar aria · 선택지 `<button>` · aria-live 문항 안내 · `<ul>` 시맨틱 · alt

### 7-2. 백엔드/인프라 핸드오프
- [ ] `next/og` `ImageResponse` OG 라우트 2종(square/story) · Paperlogy 폰트 로컬 포함(`public/fonts/`)
- [ ] OG/twitter 메타 유형별 정확 노출(`/result/[typeSlug]` `generateMetadata`)
- [ ] 애널리틱스 도구 확인·연동(§6-3 이벤트) — **DB/API 0 유지**(이벤트만, 저장 없음)
- [ ] **REDLINE**: 타 유형 직접 수치 비교 UI·외모/능력 점수화 금지(도트 게이지는 자기 속성 강조라 허용)

### 7-3. 미해결 리스크 (개발 착수 가능하나 추적 필요)
- **R1 (콘텐츠 · 최우선 게이트)**: 8유형 최종 네이밍/정의·10문항 실콘텐츠는 블라인드 200개+ 정성분석 + 베타 공감률 4.0/5.0 게이트 통과 전까지 **미확정**. 개발은 골격+placeholder JSON으로 병행, 배포는 게이트 후.
- **R2 (판정 알고리즘)**: 축 합산 → 8유형 매핑의 tie-break·상한 내 서브규칙이 엔진 구현 디테일로 남음. `lib/score.ts` 스펙 문서화 + 편향 검증(특정 유형 과다 판정 방지) 필요.
- **R3 (카카오 크롭)**: OG 1:1 카톡 실기기 크롭 비율은 정책 변동 가능 → 배포 직전 실기기 QA 필수.
- **R4 (Web Share files 지원)**: iOS Safari 등 `navigator.share({files})` 지원 편차 → 스토리 이미지 공유는 다운로드 폴백 확실히.
- **R5 (애널리틱스 미확인)**: GA4/Vercel Analytics 중 이 프로젝트 실제 연동 도구 미확인 → 백엔드 확인 후 §6-3 이벤트 연결.
- **R6 (5번 유형 컬러)**: §3-2에서 옐로→앰버 조정. 네이밍 확정 시 8색 대비·다크모드 시인성 재검증.
```
