# 직장인 성향 분석기(Office Archetype) — UI 디자인 스펙

> STEP 3(디자인 시작) UI 파트 산출물. `docs/planning/office-archetype-direction.md` 기반.
> 대상 라우트: `src/app/office-archetype/` · 배포: `project-orsrw.vercel.app/office-archetype`
> 스택 관례: `/pae`(자체 CSS 파일 완전 격리) 방식을 채택 — 공유 파일(`tailwind.config.ts`/`globals.css`) 무수정, blast radius 0.
> 개발팀 인계 시 이 문서 + `docs/design/office-archetype-tokens.json`(별도 데이터 스키마 예시, §3-5 참고)만 보고 구현 가능한 수준으로 작성.

---

## 0. 아키텍처 원칙 (UI 관점에서 개발팀에 미리 못박는 것)

1. **자체 CSS 완전 격리**: `src/app/office-archetype/oa.css` 신규 파일 하나에 전 스타일 작성 → `layout.tsx`에서 `import "./oa.css"`. `globals.css`/`tailwind.config.ts`는 **손대지 않는다** (moira처럼 tailwind 토큰 확장도 가능하지만, 공유 파일 수정 = 전 라이브 앱 리스크. 이 프로젝트는 `/pae` 선례를 따라 완전 격리 우선).
2. **디자인 토큰 = CSS 변수**: `.oa-shell { --oa-*: ... }`로 스코프. 다크모드는 `[data-theme="dark"]` 속성 토글로 변수만 교체 (클래스 중복 없이 컴포넌트 CSS 재사용).
3. **8유형 비주얼 = 데이터 기반**: 컬러/아이콘/이모지는 절대 컴포넌트에 하드코딩하지 않는다. `types.json`에 `colorVar`(CSS 변수 참조 키)를 넣고, 컴포넌트는 `style={{ '--oa-type-color': type.color }}` 형태로 인라인 주입 — UI디자이너가 정한 8색은 §5의 토큰표가 유일한 출처(SSOT).
4. **폰트**: 본문은 시스템 기본(Pretendard 미탑재 프로젝트 전역 규칙 없음 → `/pae`처럼 자체 `@import`로 포인트 폰트 1개만 로드). 가벼움 최우선(순수 클라이언트 + 바이럴 페이지라 폰트 로딩 지연이 이탈로 직결).

---

## 1. 비주얼 컨셉 / 무드

### 컨셉 한 줄
**"블라인드에 캡처해서 자랑하고 싶은, 회사원 필드 다이어리."**

### 차별화 축 (나BTI · 푸망 대비)
| 축 | 나BTI/푸망류 | Office Archetype |
|---|---|---|
| 톤 | 파스텔 동물/캐릭터, 유아적 귀여움 | **오피스 오브젝트 모티프**(사원증, 스티키노트, 커피컵, 슬랙 알림) — 성인 직장인이 봐도 유치하지 않음 |
| 색 | 비비드 무지개 8색 나열 | **오피스 무드 5계열**(네이비/그레이 베이스 + 유형별 포인트 1색) — 차분하지만 유형 구분은 즉각 |
| 근거 표현 | 없음(그냥 감성 카피) | **"근거 스탯" 시각화**(강점/그림자 2축 미니 게이지) — "찍은 게 아니라 진짜 분석했다"는 신뢰감 |
| 공유 결과물 | 캐릭터 일러스트 위주 | **"사원증(ID 카드)" 메타포** — 직장인이라면 누구나 아는 오브젝트라 "내 유형 = 내 신분증" 감정 이입 강함 |
| 상성 매칭 | 거의 없음(단품 소비) | **"협업 상성" 카드**로 2차 확산 설계(방향서 §4 K-factor) — 시각적으로 두 유형이 "짝"처럼 보이게 |

### 무드보드 키워드
`오피스 사원증` · `데스크테리어(모니터 스티커·머그컵)` · `슬랙/노션 대시보드의 정갈함` · `월요일 vs 금요일 대비 유머` · `종이 스티키노트의 촉감` · `데이터 카드(신용카드 사이즈 비율감)`

### 톤앤매너 3원칙
1. **"진지하게 가볍게"** — 색과 레이아웃은 신뢰감(정갈한 그리드, 절제된 색), 카피는 위트(직장 밈 어휘).
2. **정보 밀도는 낮게, 임팩트는 크게** — 결과 화면은 스크롤 1~1.5뷰포트 안에 "유형명 + 한 줄 정의"가 꽉 차게. 공유 캡처를 유도.
3. **사원증 메타포 일관 적용** — 결과 카드, OG 카드, 진행바(출입 게이트 느낌)까지 전부 "회사 오브젝트" 룩앤필로 통일.

---

## 2. 디자인 토큰

### 2-1. 컬러 시스템

`oa.css` 최상단에 `:root` 대신 `.oa-shell`(스코프 루트, layout.tsx가 최상위 div에 부여)에 정의. 전역 `:root` 오염 방지.

```css
.oa-shell {
  color-scheme: light;

  /* ── Base (오피스 뉴트럴 — 네이비 베이스) ── */
  --oa-bg: #F4F5F7;              /* 페이지 배경 — 종이/화이트보드 느낌의 아주 옅은 그레이 */
  --oa-surface: #FFFFFF;          /* 카드 표면 */
  --oa-surface-raised: #FFFFFF;   /* 결과 카드 등 강조 표면 (그림자로 구분) */
  --oa-border: #E3E6EC;
  --oa-border-strong: #C7CCD6;

  --oa-ink: #1C2333;              /* 본문 최상위 텍스트 (오피스 네이비-블랙) */
  --oa-body: #4B5468;             /* 본문 텍스트 */
  --oa-muted: #8A93A6;            /* 보조/캡션 */
  --oa-placeholder: #B3B9C6;

  /* ── Brand / Primary (오피스 시그니처 — 딥 네이비 + 옐로 포인트) ── */
  --oa-primary: #2B3556;          /* 사원증 느낌의 딥 네이비 — 헤더/CTA 배경 */
  --oa-primary-ink: #FFFFFF;
  --oa-primary-dark: #1A2038;
  --oa-accent: #FFC94A;           /* 스티키노트 옐로 — 강조/하이라이트/뱃지 */
  --oa-accent-ink: #2B3556;
  --oa-accent-soft: #FFF3D6;

  /* ── Semantic ── */
  --oa-success: #2E9E6B;
  --oa-success-bg: #E7F6EE;
  --oa-warning: #E0972B;
  --oa-warning-bg: #FDF1E1;
  --oa-error: #E24C4C;
  --oa-error-bg: #FCE9E9;
  --oa-info: #3D6FE0;
  --oa-info-bg: #EAF0FD;

  /* ── 진행바(출입 게이트 메타포) ── */
  --oa-progress-track: #E3E6EC;
  --oa-progress-fill: linear-gradient(90deg, #2B3556, #4A5A8F);

  /* ── Shadow (사원증 카드가 살짝 뜬 느낌) ── */
  --oa-shadow-sm: 0 1px 2px rgba(28,35,51,0.06);
  --oa-shadow-md: 0 4px 14px rgba(28,35,51,0.10);
  --oa-shadow-lg: 0 12px 32px rgba(28,35,51,0.16);
  --oa-shadow-card: 0 2px 0 rgba(28,35,51,0.06), 0 10px 24px rgba(28,35,51,0.10); /* 사원증 목걸이 카드 느낌 */

  /* ── Radius ── */
  --oa-radius-sm: 8px;
  --oa-radius-md: 14px;
  --oa-radius-lg: 20px;
  --oa-radius-full: 999px;
  --oa-radius-card: 18px;   /* ID카드 코너 — 실제 신용카드 비율감 */

  /* ── Spacing (4px 배수) ── */
  --oa-space-1: 4px;
  --oa-space-2: 8px;
  --oa-space-3: 12px;
  --oa-space-4: 16px;
  --oa-space-5: 20px;
  --oa-space-6: 24px;
  --oa-space-8: 32px;
  --oa-space-10: 40px;
  --oa-space-12: 48px;
}

/* ── 다크모드 ── */
.oa-shell[data-theme="dark"] {
  color-scheme: dark;
  --oa-bg: #14171F;
  --oa-surface: #1C2030;
  --oa-surface-raised: #232838;
  --oa-border: #2C3244;
  --oa-border-strong: #3B4257;

  --oa-ink: #F1F3F8;
  --oa-body: #C4C9D6;
  --oa-muted: #7C8296;
  --oa-placeholder: #565D71;

  --oa-primary: #4A5A8F;
  --oa-primary-ink: #FFFFFF;
  --oa-primary-dark: #384470;
  --oa-accent: #FFC94A;
  --oa-accent-ink: #1C2333;
  --oa-accent-soft: #3A331C;

  --oa-success: #4CC38A;
  --oa-success-bg: #16302A;
  --oa-warning: #F0A94A;
  --oa-warning-bg: #332711;
  --oa-error: #F0716B;
  --oa-error-bg: #33191A;
  --oa-info: #6C93F0;
  --oa-info-bg: #191F33;

  --oa-progress-track: #2C3244;
  --oa-progress-fill: linear-gradient(90deg, #4A5A8F, #7A8BC4);

  --oa-shadow-sm: 0 1px 2px rgba(0,0,0,0.3);
  --oa-shadow-md: 0 4px 14px rgba(0,0,0,0.4);
  --oa-shadow-lg: 0 12px 32px rgba(0,0,0,0.5);
  --oa-shadow-card: 0 2px 0 rgba(0,0,0,0.3), 0 10px 24px rgba(0,0,0,0.45);
}
```

> 다크모드 적용 방식: `<html>`이 아니라 `.oa-shell[data-theme]`에 스코프 — moira/문제팩토리 등 타 라우트의 다크모드 정책과 완전 무관하게 이 라우트 자체 상태(로컬스토리지 `oa-theme`)로 토글. 시스템 `prefers-color-scheme`도 최초 1회 반영 후 사용자가 토글하면 override.

### 2-2. 타이포그래피

```css
.oa-shell {
  --oa-font-display: "Paperlogy", "Pretendard Variable", "Pretendard", system-ui, sans-serif;
  /* Paperlogy(무료, 라운드+각진 중간 톤 헤드라인 서체) 자체 @import.
     본문은 시스템 폰트로 최소화(로딩비용 절감 — 방향서 "초경량" 원칙) */
  --oa-font-body: -apple-system, BlinkMacSystemFont, "Pretendard Variable", "Malgun Gothic", system-ui, sans-serif;
}
```

| 토큰 | 크기 / 행간 / 굵기 | 용도 |
|---|---|---|
| `--oa-text-hero` | 30px / 1.28 / 800 (모바일) → 40px 데스크톱 | 랜딩 훅 카피, 결과 유형명 |
| `--oa-text-h1` | 24px / 1.3 / 700 | 섹션 제목 ("당신의 협업 상성은?") |
| `--oa-text-h2` | 19px / 1.4 / 700 | 카드 제목 |
| `--oa-text-question` | 18px / 1.45 / 600 | 질문 문항 텍스트 |
| `--oa-text-body` | 15px / 1.6 / 400 | 본문 설명 |
| `--oa-text-body-sm` | 13.5px / 1.55 / 400 | 보조 설명, 캡션 |
| `--oa-text-label` | 12px / 1.4 / 700, letter-spacing 0.04em, uppercase | 배지·태그·라벨 |
| `--oa-text-mono-num` | 15px, `font-variant-numeric: tabular-nums`, 700 | 진행률 숫자("3/10") |

- 폰트 로드: `@import url('https://cdn.jsdelivr.net/gh/projectnoonnu/2408-2@1.0/Paperlogy.css');`를 `oa.css` 최상단에 1회. 헤드라인(`h1`, 결과 유형명, 로고워드마크)에만 사용 — 본문/버튼 텍스트는 시스템 폰트 유지(초경량 원칙, 방향서 §6).
- 숫자는 전부 `tabular-nums` (진행률, 순위 등 레이아웃 흔들림 방지 — moira 관례 계승).

### 2-3. 스페이싱 & 그리드

- 기본 단위 **4px**, 실사용은 8px 배수 위주(§2-1 `--oa-space-*`).
- 모바일 콘텐츠 좌우 패딩: **20px** 고정.
- 최대 폭: 모바일 100%, `max-width: 480px` 중앙 정렬(태블릿 이상에서도 모바일 폭 유지 — 이 서비스는 "모바일 전용 경험"으로 데스크톱은 좁은 카드만 중앙 표시. 데스크톱 확장 레이아웃 불필요, 방향서의 "모바일 우선" 원칙을 넘어 "모바일 전담"으로 해석).
- 카드 내부 패딩: 20px(기본), 결과 카드 24px.
- 컴포넌트 간 수직 간격: 섹션 32px, 같은 그룹 내 요소 12~16px.

### 2-4. Radius & Shadow

- 버튼/인풋: `--oa-radius-md`(14px).
- 카드/모달: `--oa-radius-lg`(20px).
- 결과 사원증 카드: `--oa-radius-card`(18px, 실제 카드 비율에 맞춘 절충값).
- 배지/칩/아바타: `--oa-radius-full`.
- 그림자는 과하지 않게 — `--oa-shadow-sm`(리스트 아이템), `--oa-shadow-md`(플로팅 CTA·모달), `--oa-shadow-card`(결과 카드 전용, 목에 거는 카드 느낌의 이중 그림자).

---

## 3. 8개 성향 유형 — 비주얼 시스템

### 3-1. 설계 축 (MBTI 재탕 금지 — 방향서 §5)

2축 매트릭스(각 축 2값 × 2값 = 4상한) + 상한 내 "주도/반응" 서브 구분으로 8유형을 만든다. **축 이름 자체도 카피로 노출 가능할 만큼 직장 맥락 그대로 사용.**

- **X축: 일 중심 ↔ 관계 중심** (일이 우선이냐, 사람/분위기가 우선이냐)
- **Y축: 주도형 ↔ 순응형** (내가 판을 짜냐, 흐름에 맞추냐)

> 이 문서는 UI 스펙이므로 문항/판정 로직 자체는 기획·UX·엔진 담당. 아래 8유형명은 **UI디자이너가 비주얼 방향을 잡기 위한 초안**이며 최종 네이밍/정의는 방향서 §5의 "블라인드 200개+ 정성분석 + 베타 검증" 게이트를 통과해야 확정된다. 개발팀은 이 이름을 하드코딩하지 말고 `types.json`의 placeholder로 취급할 것.

### 3-2. 8유형 초안 (네이밍 톤 + 비주얼 방향)

| # | 유형명(초안) | 축 위치 | 한 줄 정의(초안) | 포인트 컬러 | 아이콘/오브젝트 모티프 |
|---|---|---|---|---|---|
| 1 | **불도저형** | 일중심×주도 | 회의보다 실행, 일단 치고 나간다 | `#E0522E` (버밀리언) | 헬멧+마커펜, 진행중 칸반카드 |
| 2 | **설계자형** | 일중심×주도 | 판을 먼저 짜고 완벽하게 그린 대로 간다 | `#2B3556` (딥네이비) | 청사진/자, 정렬된 포스트잇 그리드 |
| 3 | **해결사형** | 일중심×순응 | 시키면 군말 없이 제일 깔끔하게 끝낸다 | `#3D8B7A` (틸그린) | 체크리스트, 완료 도장 |
| 4 | **묵묵러형** | 일중심×순응 | 티는 안 나도 늘 제자리서 버텨주는 사람 | `#6B7280` (스틸그레이) | 뿌리내린 화분, 오래된 머그컵 |
| 5 | **분위기메이커형** | 관계중심×주도 | 텐션과 리액션으로 팀 무드를 끌어올린다 | `#FFC94A` (옐로) | 마이크, 폭죽 이모지 |
| 6 | **중재자형** | 관계중심×주도 | 갈등 나기 전에 먼저 나서서 조율한다 | `#C77DD1` (라벤더퍼플) | 저울, 손 맞잡기 |
| 7 | **경청러형** | 관계중심×순응 | 말수는 적지만 다 듣고 다 챙긴다 | `#4E9FE0` (스카이블루) | 헤드셋, 열린 귀 아이콘 |
| 8 | **텐션조절러형** | 관계중심×순응 | 눈치 빠르게 분위기 맞춰주는 만능 조연 | `#E0729A` (로즈핑크) | 카멜레온, 다이얼 |

> 네이밍 규칙: 전부 `~형`으로 끝나는 2~5글자 순우리말/직관어(한자어·영어 혼용 최소화, "~러" 등 신조어체는 밈성 강화). MBTI 알파벳 조합(예: "ENFP") 절대 사용 금지 — 방향서 게이트 위반.

### 3-3. 8색 팔레트 배치 원칙

- 8색은 색상환에서 **채도/명도를 유사 범위로 통일**(버밀리언 → 로즈핑크까지 hue 전개, 모두 중채도 파스텔~톤다운) → 어떤 조합으로 나란히 놓아도 튀지 않고 "같은 시리즈" 룩 유지.
- 딥네이비(`--oa-primary`)와 8색이 항상 대비되도록: 8색은 전부 배경(연한 tint 10%)+텍스트(원색)로 사용, 딥네이비는 UI 크롬(헤더/버튼)에만 사용해 유형색과 절대 안 겹치게.
- 각 유형 색은 `tint`(10% 불투명 배경), `solid`(아이콘/배지 원색), `deep`(텍스트용 20% 어둡게)의 3단계로 파생해 사용. 예: 불도저형 `tint: #FCE7E1`, `solid: #E0522E`, `deep: #A83D22`.
- 다크모드에서는 8색의 채도를 유지하되 명도를 10~15% 올려서(`solid` 그대로 유지, `tint`를 배경 위 12% 불투명 오버레이로 전환) 어두운 배경에서도 시인성 확보.

### 3-4. 아이콘/캐릭터 방향

- **아이콘 세트**: 커스텀 라인 아이콘(스티커 느낌, 2.5px 스트로크, 라운드 캡) — lucide-react 기반으로 조합하되 8유형 대표 아이콘만 커스텀 SVG로 별도 제작(§6 참조).
- **캐릭터는 만들지 않는다** (나BTI식 마스코트 캐릭터 지양 — 방향서 차별화 의도). 대신 "오브젝트 아이콘 + 컬러 블록"으로 유형을 표현 = 제작비/유지비 0, 성인 타겟에 어울리는 절제된 톤.
- 결과 카드 상단에는 유형별 대표 오브젝트 1개를 **일러스트가 아닌 큼직한 라인아이콘(64~80px)** 으로 배치, 배경은 해당 유형 `tint` 컬러 원형.

### 3-5. 데이터 스키마 (개발 인계용 — 하드코딩 금지 원칙 구현)

```json
// docs/design/office-archetype-tokens.json (예시 — 실제 파일은 개발팀이 src/data/office-archetype/types.json 로 배치)
{
  "types": [
    {
      "id": "bulldozer",
      "name": "불도저형",
      "axis": { "x": "work", "y": "lead" },
      "tagline": "회의보다 실행, 일단 치고 나간다",
      "color": { "tint": "#FCE7E1", "solid": "#E0522E", "deep": "#A83D22" },
      "icon": "hard-hat",
      "strengths": ["추진력", "결단력", "속도"],
      "shadow": ["과속", "합의 생략"],
      "matchBestId": "mediator",
      "matchWorstId": "listener"
    }
  ]
}
```

- 컴포넌트는 `type.color.solid`를 `style={{ '--oa-type-color': ... }}`로 주입 후 CSS에서 `var(--oa-type-color)`로만 참조 → 8색 어디든 동일 컴포넌트 재사용.
- `matchBestId`/`matchWorstId`로 "상성 좋은 동료" 매칭(방향서 §4 2차 확산 루프)을 결과 화면에서 표시.

---

## 4. 컴포넌트 스펙

### 4-1. 선택지 버튼 (질문 화면)

```
구조: [세로 스택, 풀폭 카드형 버튼] — 한 손 조작 최우선(방향서 §6)
크기: min-height 56px, 좌우 패딩 18px, 상하 패딩 16px
간격: 버튼 간 12px
```

| 상태 | 스타일 |
|---|---|
| 기본 | `background: var(--oa-surface)`, `border: 1.5px solid var(--oa-border)`, `border-radius: var(--oa-radius-md)`, `box-shadow: var(--oa-shadow-sm)`, 텍스트 `--oa-text-body` 600 |
| 호버(데스크톱) | `border-color: var(--oa-border-strong)`, `transform: translateY(-1px)` |
| 선택(탭 즉시) | `background: var(--oa-primary)`, `color: var(--oa-primary-ink)`, `border-color: var(--oa-primary)`, 우측에 체크 아이콘 페이드인(120ms) |
| 눌림(active) | `transform: scale(0.98)`, transition 90ms |
| 포커스 | `box-shadow: 0 0 0 3px rgba(43,53,86,0.28)` (딥네이비 28% 링 — 이 라우트 전용, globals.css 전역 오렌지 링과 무관하게 `.oa-shell` 스코프에서 override) |

- **탭 즉시 다음 질문으로 자동 전환**(300ms 딜레이 후, 선택 애니메이션 보여준 뒤 전환 — "다음" 버튼 탭 한 번 아끼는 게 이탈률에 직결. 단, 마지막 문항 또는 되돌아가기 직후는 예외적으로 "다음" 버튼 노출해 오조작 방지).
- 선택지 텍스트는 최대 2줄, 그 이상이면 폰트 자동 축소 대신 `line-clamp` 없이 카드 높이가 늘어나도록(잘림 금지 — moira 커밋 이력의 "말풍선 글자 잘림" 재발 방지 교훈 적용).

### 4-2. 진행바 (출입 게이트 메타포)

```
상단 고정(sticky top), 헤더 바로 아래. height 6px, 트랙 var(--oa-progress-track), 채움 var(--oa-progress-fill)
좌측에 "3 / 10" 텍스트(--oa-text-mono-num) + 우측에 뒤로가기 아이콘(ChevronLeft, 44×44 터치영역)
```

- 채움 애니메이션: 문항 전환 시 `width` 트랜지션 300ms `cubic-bezier(0.4,0,0.2,1)`.
- 진행바 위에 "사원증 태그 스캔" 느낌의 미세 디테일: 채움 끝단에 작은 원(6px, `--oa-accent`) 표시 — 게이트를 통과하는 느낌의 시그니처 모션(과하지 않게, 0.2 opacity pulse 1회만).
- `prefers-reduced-motion: reduce` 시 모든 트랜지션 즉시 최종값(0.01ms) — globals.css 전역 규칙이 이 라우트에도 적용되므로 별도 처리 불필요, 단 `oa.css`에서 새로 정의하는 keyframe들은 동일 미디어쿼리 재정의 필수(스코프 격리로 인해 전역 규칙이 `.oa-shell` 내부 커스텀 애니메이션까지 자동으로 안 잡을 수 있음 — 반드시 `oa.css`에도 동일 `@media (prefers-reduced-motion: reduce)` 블록 작성).

### 4-3. 결과 카드 (사원증 메타포 — 핵심 컴포넌트)

```
비율: 부드럽게 세로로 긴 카드 (가로:세로 ≈ 1 : 1.55, 실제 신용카드보다 살짝 김)
폭: 모바일 화면 폭 - 40px(좌우 20px 패딩), max-width 340px, 중앙 정렬
```

구성(위→아래):
1. **상단 크롬 바** (24px): 좌측 "OFFICE ARCHETYPE" 워드마크(`--oa-text-label`, `--oa-muted`), 우측 발급번호 스타일 더미 텍스트(`No. 08/08` 형태로 "8유형 중 몇 번" 표시, 재미 요소)
2. **아이콘 배지**: 80px 원형, 배경 `type.color.tint`, 안에 유형 아이콘(48px, `type.color.solid`)
3. **유형명**: `--oa-text-hero`, `--oa-ink`, 중앙 정렬. 바로 아래 태그라인(`--oa-text-body`, `--oa-muted`)
4. **강점/그림자 미니 게이지 2행**: 라벨(강점/그림자) + 도트 5개 중 채워진 개수로 표현(정량 점수 아님 — 방향서 REDLINE "타인 비교/외모 점수 UI 금지" 준수, 이는 자기 유형 내 속성 강조일 뿐 비교 지표 아니므로 허용되나 **다른 유형과의 직접 수치 비교 UI는 만들지 않는다**)
5. **구분선** (점선, `--oa-border`)
6. **상성 매칭 섹션**: "이런 동료와 찰떡궁합" — 매칭 유형 아이콘(32px) + 이름 + 한 줄 이유. 여기가 2차 확산 트리거(방향서 §4)
7. **하단 절취선 디자인**(사원증 하단 바코드/QR 느낌의 장식 SVG 패턴, 실제 QR 아님 — 순수 장식으로 카드 신뢰감 강화)

- 카드 자체에 `box-shadow: var(--oa-shadow-card)` + 살짝 기운 배경 장식(카드 뒤에 회전 -4deg로 tint 컬러 블록을 살짝 비치게 — 사원증 목걸이 스트랩 연상).
- 카드는 그대로 **OG 이미지 캡처 대상**과 레이아웃을 100% 공유(§5 참고, DOM-to-canvas 방식이든 서버 렌더든 동일 컴포넌트 재사용 원칙).

### 4-4. 공유 CTA

```
구조: 결과 카드 하단 sticky 액션 바 (2버튼 가로 배치)
```

| 버튼 | 스타일 | 용도 |
|---|---|---|
| 카톡 공유 (Primary) | `background: #FEE500`, `color: #191600`, 카톡 로고 아이콘 좌측, `flex: 1.4` | 1:1 카드 카톡 전송 (OG 카드 or 클립보드 이미지) |
| 이미지 저장 (Secondary) | `background: var(--oa-surface)`, `border: 1.5px solid var(--oa-border-strong)`, `color: var(--oa-ink)`, `flex: 1` | 9:16 스토리용 이미지 다운로드 |

- 두 버튼 아래 텍스트 링크 "다시 테스트하기" (`--oa-text-body-sm`, `--oa-muted`, underline) — 재시작 유도(포트폴리오 KPI에는 안 잡히지만 체류시간/재방문 신호).
- 버튼 높이 52px, `border-radius: var(--oa-radius-md)`, 터치 영역 44px 이상 보장.
- 눌림 피드백: `scale(0.97)` 90ms.

### 4-5. 기타 공용 요소

- **헤더**: 높이 52px, 배경 투명(랜딩)/`--oa-surface`+하단 border(질문·결과), 중앙 로고워드마크 "오피스 성향분석" 또는 뒤로가기만.
- **버튼(공용, Primary/Secondary/Ghost)**:
  - Primary: `--oa-primary` 배경, 흰 텍스트, radius-md, height 52px
  - Secondary: 흰 배경 + `--oa-border-strong` 테두리
  - Ghost: 배경 없음, `--oa-body` 텍스트, underline on hover
- **토스트**(결과 공유 완료 등): 하단 고정, `--oa-ink` 배경(다크모드 무관 항상 다크 칩), 흰 텍스트, radius-full, 2초 후 자동 소멸, slide-up 200ms.
- **홈 인디케이터 안전영역**: `padding-bottom: env(safe-area-inset-bottom, 0px)` 하단 sticky 요소 전부 적용(globals.css `.pb-safe` 클래스는 전역 유틸이라 그대로 재사용 가능 — 이 라우트에서 import 없이 바로 씀).

---

## 5. 공유 이미지(OG 카드) 상세 스펙

> 방향서 §6 "카톡 공유를 위한 OG 메타 + 결과 이미지 동적 생성" 필수 요구사항. 구현은 Next.js `ImageResponse`(OG Image Generation, `next/og`) 또는 클라이언트 캔버스 캡처(`html-to-image` 등) 중 개발팀 선택 — 이 스펙은 두 방식 모두에 적용 가능하게 **절대 좌표/px 고정 레이아웃**으로 작성.

### 5-1. 공통 규칙

- 두 포맷 모두 결과 카드(§4-3)의 정보 구조를 그대로 계승하되, 이미지 전용으로 **하단에 URL/워터마크**를 추가(바이럴 유입 트래킹 목적: `office-archetype.link` 또는 실제 도메인 짧은 표기 + "테스트하러 가기").
- 안전영역(safe zone): 카카오톡 미리보기·인스타 스토리 UI(상단 프로필바, 하단 답장 입력창)에 가려지는 영역을 반드시 비워둘 것.
- 텍스트는 이미지 안에 직접 렌더(웹폰트 임베드 필요 — `next/og`는 폰트 바이너리를 fetch해서 주입해야 함, Paperlogy 폰트 파일을 프로젝트에 로컬 포함 권장).
- 배경은 유형별 `color.tint`를 베이스로, 우상단에 큰 반투명 원형(유형 `color.solid`, opacity 0.15)으로 브랜드 아이덴티티 통일.

### 5-2. 1:1 카드 (카카오톡 공유용)

```
캔버스: 1200 × 1200px (카카오 링크 공유 OG 표준 비율)
```

레이아웃(좌표는 1200×1200 기준):

| 영역 | 위치(x, y, w, h) | 내용 |
|---|---|---|
| 배경 | 0,0,1200,1200 | `color.tint` 단색 + 우상단 장식 원 |
| 상단 워드마크 | 80, 72, auto, 32 | "OFFICE ARCHETYPE" 라벨, `--oa-muted` 상당 톤, 20px, letter-spacing |
| 아이콘 배지 | center x, y=260, 지름 200 | 흰 원 배경 + 유형 아이콘 120px `color.solid` |
| 유형명 | center, y=520, | 72px, 800 weight, `--oa-ink` 상당 다크 |
| 태그라인 | center, y=610, width 900 | 32px, 400, 최대 2줄, 중앙정렬 |
| 상성 매칭 배지 | center, y=760, w 720 h 140 | 흰 반투명 카드(opacity 0.9) 안에 "찰떡궁합: {매칭유형명}" 28px |
| 하단 CTA 바 | 0, 1080, 1200, 120 | `--oa-primary` 배경 풀폭, 흰 텍스트 "나도 테스트하기 → " + URL, 30px |
| 세이프존 여백 | 상하좌우 최소 48px | 카카오 링크 카드 크롭 대응 |

- 폰트: 유형명/CTA는 Paperlogy 800, 태그라인/워드마크는 시스템 sans.
- 파일 형식: PNG (투명 배경 불필요, 카톡은 불투명 권장).

### 5-3. 9:16 카드 (인스타그램 스토리용)

```
캔버스: 1080 × 1920px
```

레이아웃:

| 영역 | 위치(x, y, w, h) | 내용 |
|---|---|---|
| 배경 | 0,0,1080,1920 | `color.tint` 그라디언트(위→아래 tint→흰색 5% 블렌드로 세로 길이감 완화) |
| 상단 세이프존 | 0~250px | **비워둠** (스토리 상단 프로필/닉네임 UI 겹침 방지) |
| 워드마크 | 90, 260, | "OFFICE ARCHETYPE" 24px |
| 아이콘 배지 | center, y=460, 지름 260 | 유형 아이콘 160px |
| 유형명 | center, y=790 | 88px, 800 weight |
| 태그라인 | center, y=900, width 820 | 36px, 최대 2줄 |
| 강점 태그 3개 | center, y=1040, 가로 배치 pill | 각 pill: `color.solid` 배경, 흰 텍스트 24px, radius-full |
| 상성 매칭 카드 | center, y=1200, w 880 h 260 | 흰 카드(radius 24, shadow) 안에 "찰떡궁합" 아이콘+이름+이유 2줄 |
| 하단 CTA | center, y=1560, | "나도 내 유형 확인하기" + 화살표 아이콘, 40px, `--oa-primary` |
| 하단 세이프존 | 1920 - 280 ~ 1920 | **비워둠** (스토리 하단 "답장 보내기" 입력창 UI 겹침 방지, 인스타 표준 세이프존) |

- 인스타 스토리는 스티커(위치 태그, 링크 스티커)를 사용자가 임의 배치할 수 있으므로, 상하 세이프존은 넉넉히(각 250~280px) 비워서 어떤 위치에 스티커가 붙어도 핵심 정보 안 가리게.
- 파일 형식: PNG. 워터마크 URL은 하단 CTA 바로 아래 44px 높이로 작게 추가(56px 여백 확보 후).

### 5-4. 구현 힌트 (UI디자이너 → 개발팀)

- 두 포맷 다 **결과 컴포넌트와 별도의 "OG 전용 렌더 컴포넌트"**를 만들 것(화면 UI 컴포넌트를 그대로 캡처하면 반응형 레이아웃이 캔버스 고정 좌표와 어긋남). `src/app/office-archetype/og/[typeId]/route.tsx` (`next/og`의 `ImageResponse`) 형태로 typeId + variant(`square`/`story`) 쿼리를 받아 동적 생성 권장.
- OG 메타 태그(`opengraph-image`, `twitter:image`)는 1:1(1200×630 또는 1200×1200 중 카카오는 1:1 정사각 선호 확인 필요 — 카카오 링크는 사각형 크롭 기본이므로 1:1 우선)을 기본으로 연결, 9:16은 앱 내 "스토리로 공유" 버튼에서 별도 다운로드/공유시트로 연결.

---

## 6. 다크모드 / 모바일 반응형 원칙

### 6-1. 다크모드

- 스코프: `.oa-shell[data-theme="dark"]`(§2-1 변수 테이블 참조). `<html>` 전역 클래스 사용 안 함 — 타 라우트 다크모드 정책과 완전 독립.
- 최초 진입 시 `window.matchMedia('(prefers-color-scheme: dark)')` 확인 후 기본값 설정, 이후 사용자가 토글하면 `localStorage.oa-theme`에 저장해 유지.
- 토글 위치: 헤더 우측 아이콘 버튼(Sun/Moon, lucide-react), 랜딩·결과 화면에 노출(질문 화면은 UI 미니멀 유지를 위해 숨김 — 몰입 방해 최소화).
- 8유형 컬러는 다크모드에서도 **동일 hue 유지, 명도만 보정**(§3-3) — 라이트/다크 전환해도 "내 유형 색"이 달라 보이지 않게(재확인성 중요, 자기확인형 테스트 특성).
- 전환 애니메이션: `background-color`, `color`, `border-color`에 `transition: 200ms ease` (globals.css 전역 `prefers-reduced-motion` 규칙이 이 라우트 트랜지션도 자동으로 잡아줌).

### 6-2. 모바일 반응형

- **브레이크포인트**: 이 서비스는 사실상 모바일 전담(방향서 "대부분 카톡/블라인드에서 모바일로 유입"). 데스크톱은 "모바일 뷰를 확대해서 보여주는" 접근:
  - `< 480px` (기본): 풀폭, 좌우 패딩 20px
  - `≥ 480px`: 콘텐츠 `max-width: 420px`, 중앙 정렬, 바깥 배경은 `--oa-bg`를 살짝 더 진하게(`filter: brightness(0.97)` 정도) 해서 "카드가 떠 있는" 느낌으로 데스크톱 방문자에게도 완결된 경험 제공.
- **한 손 조작 최우선**(방향서 §6): 모든 인터랙션 요소(선택지 버튼, CTA, 뒤로가기)는 화면 하단 2/3 영역에 배치되도록 질문 화면 레이아웃 구성 — 헤더/진행바만 상단, 나머지(질문 텍스트+선택지)는 중단~하단에 집중.
- **터치 타겟**: 전 컴포넌트 최소 44×44px(`globals.css`의 `.touch-target` 유틸 재사용 가능).
- **뷰포트 높이 대응**: 질문 화면은 `min-height: 100dvh` 사용(모바일 브라우저 주소창 접힘 대응), 스크롤 없이 한 화면에 "진행바+질문+선택지"가 다 들어오는 것을 목표(문항당 선택지 4개 이하 권장 — UX 엔진 설계 시 반영 요청).
- **가로 모드**: 우선순위 낮음(테스트류 콘텐츠는 세로 사용이 절대다수) — 별도 대응 없이 세로 레이아웃 유지 + 세로 스크롤 허용으로 최소 방어.
- **폰트 스케일 대응**: OS 접근성 폰트 확대 설정 시 레이아웃 깨짐 방지를 위해 `rem` 대신 `px` 고정하지 않고, 핵심 텍스트(질문/버튼)는 `clamp()` 사용 권장: 예) `font-size: clamp(16px, 4.2vw, 18px)`.

---

## 7. 개발 핸드오프 체크리스트

- [ ] `src/app/office-archetype/oa.css` 신규 생성, `layout.tsx`에서 import (globals.css/tailwind.config.ts 무수정)
- [ ] `src/app/office-archetype/layout.tsx` 최상위에 `<div className="oa-shell" data-theme={theme}>` 래퍼
- [ ] `src/data/office-archetype/questions.json`, `src/data/office-archetype/types.json` 분리 (§3-5 스키마 준수, 하드코딩 금지)
- [ ] 선택지 버튼 탭 → 300ms 후 자동 다음 문항 전환 로직
- [ ] 결과 카드 컴포넌트를 OG 렌더 컴포넌트와 레이아웃 소스 공유(중복 좌표 유지보수 방지 위해 최소 색상 토큰이라도 공유)
- [ ] OG 이미지 라우트 2종(1:1, 9:16) — `next/og` `ImageResponse` 권장
- [ ] 다크모드 로컬 토글(`localStorage.oa-theme`) + 최초 시스템값 반영
- [ ] `prefers-reduced-motion` 대응을 `oa.css` 내 커스텀 keyframe에도 명시적으로 재작성
- [ ] REDLINE 준수: 타 유형과의 직접 수치 비교 UI, 외모/능력 점수화 UI 금지(§4-3 참조)

---

## 8. 오픈 이슈 (UX디자이너/디자인팀장 확인 필요)

1. 질문 10문항의 선택지가 2지선다인지 4지선다인지에 따라 §4-1 버튼 레이아웃(2열 vs 1열)이 달라짐 — UX 와이어프레임 확정 후 조정 필요.
2. "상성 매칭"이 단방향(내 유형 → 추천 동료 유형)인지, 양방향 궁합표(8×8)인지 기획 확정 필요 — 데이터 스키마(§3-5 `matchBestId`)는 단방향 전제로 작성함.
3. OG 카드의 카카오 실제 미리보기 크롭 비율은 카카오 정책 변경 가능성이 있어 배포 직전 실기기 카톡 공유 테스트 필수(QA 단계 위임).
