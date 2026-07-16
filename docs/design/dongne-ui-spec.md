# 동네고수(`/dongne`) — UI 디자인 스펙

> STEP 3(디자인 시작) UI 파트 산출물. `docs/planning/dongne-plan.md` + `docs/planning/dongne-direction.md`(최우선) 기반.
> 대상 라우트: `src/app/dongne/` · 배포: `project-orsrw.vercel.app/dongne`
> 스택 관례: `/pae` · `/office-archetype` 선례를 따라 **완전 격리** — `src/app/dongne/dongne.css` 신규 1파일 + `layout.tsx`에서 import. `globals.css`/`tailwind.config.ts`/공유 `layout.tsx` **무수정**(공유 파일 변경 0건, 방향서 §2 확정).
> 모든 토큰은 `.dn-shell`(스코프 루트, `layout.tsx` 최상위 div)에 `.dn-` prefix CSS 변수로 정의. 전역 `:root` 오염 금지.

---

## 0. 아키텍처 원칙

1. **완전 격리**: `.dn-shell { --dn-*: ... }` 스코프. 다크모드 토글 없음(§1-3 근거).
2. **색은 온스크린 전용, 공유 텍스트는 색 제거**: 근접도 색(§2-1)은 화면의 시도 행 칩에만 쓰고, `navigator.clipboard`로 복사되는 공유 텍스트 문자열에는 **색상 관련 코드/이모지 블록을 절대 넣지 않는다**(방향서 "공유 아티팩트 경계" 규칙 — 코드에서 물리적으로 분리). 이 문서의 §2-1 근접도 색은 오직 화면 칩·바(bar) 렌더링용.
3. **정답 렌더 금지 경계**: 정답 확정(성공/6패) 전까지 `today.name`/`today.centroid`를 DOM·`alt`·OG에 렌더하지 않는다(기획서 §2-1 완화 3종). 이 문서의 실루엣·OG 스펙은 전부 이 경계를 전제로 설계됨.
4. **폰트**: 헤드라인·숫자 = Black Han Sans(`/pae`에서 이미 로드하는 동일 CDN 소스 재사용 — 신규 웹폰트 실험 아님, 방향서 §2 "웹폰트 추가 0" 확정). 본문·자동완성·해설 긴 글 = 시스템 Pretendard 폴백 스택(별도 `@import` 없음, 로딩비용 0).
5. **아이콘**: lucide-react 기반(다른 라우트와 톤 통일), 실링 뱃지·스탬프 연출만 커스텀 SVG.

---

## 1. 비주얼 컨셉 / 무드

### 1-1. 컨셉 한 줄
**"동네 이름이 찍힌 낡은 지적도 위에서 매일 여는 퀴즈."** — 옛 지도·인장(스탬프)의 손맛과 오늘의 게임성을 섞은 **"웜 페이퍼 에디토리얼 × 카토그래픽(지도학적)"** 톤.

### 1-2. 3앱 차별화 표

| 축 | `/pae`(오후의 패) | `/office-archetype` | `/dongne`(동네고수) |
|---|---|---|---|
| 베이스 | 다크 멤피스, 와인+골드 | 라이트/다크 토글, 오피스 네이비+옐로 | **라이트 고정, 웜 페이퍼(크림)+테라코타** |
| 모티프 | 카드게임 타일, 하드 오프셋 그림자 | 사원증·스티키노트 | **지적도·나침반·왁스 실링(인장)** |
| 헤드라인 서체 | Black Han Sans + Archivo Black | Paperlogy(예정) | **Black Han Sans**(숫자·타이틀만, 본문은 시스템) |
| 강조색 계열 | 와인레드+금 | 딥네이비+옐로 | **테라코타(나침반 바늘)+아틀라스 틸(지도 바다색)** |
| 코너 반경 | 각진 6~14px, 하드 그림자 | 부드러운 8~20px, 소프트 그림자 | **절제된 6~16px, 인장/스탬프 그림자**(눌린 느낌) |

세 앱을 나란히 캡처해도 즉시 "다른 서비스"로 읽히는 것이 목표. `/dongne`만 **밝은 배경 + 지도 그래티큘(격자) 텍스처**를 쓰는 유일한 앱이 되도록 한다.

### 1-3. 다크/라이트 정책: **라이트 단일 고정 (다크모드 없음)** — 확정 근거

방향서 §2가 이미 못박은 결정("실루엣 가독성(밝은 배경) + 3앱 톤 차별화")을 아래 4가지로 구체화해 확정한다.

1. **실루엣 판독성**: 단색 솔리드 필 실루엣은 밝은 종이 배경 위에서만 윤곽이 또렷하게 읽힌다. 다크 배경에서는 잉크색 필이 배경과 뭉개져 대비가 떨어지고, 이를 보정하려면 실루엣 전용 다크 팔레트를 별도 설계·검증해야 해 3일 빌드 스코프를 넘어선다.
2. **톤 차별화가 곧 브랜드**: `office-archetype`은 이미 라이트/다크 토글형이라, `/dongne`까지 토글을 넣으면 "3앱 중 2앱이 토글 가능"해져 차별화 축이 흐려진다. **낮의 종이 지도 위에서 매일 아침 문제를 푸는 느낌**을 단일 상태로 고정하는 것 자체가 정체성.
3. **애드센스 콘텐츠 층 최적화**: '어제의 동네' 해설은 1,500자+ 장문 읽기 + 광고 슬롯이 들어가는 페이지다. 라이트 배경이 광고 블렌딩·가독성 튜닝 부담이 적고, 다크모드 장문 읽기는 대비 조정 이슈가 추가된다.
4. **카톡 인앱 브라우저 신뢰도**: 인앱 브라우저는 `prefers-color-scheme` 감지가 기기·앱 버전마다 불안정 → 시스템 다크 감지에 기대는 대신 **`color-scheme: light` 강제**로 렌더 결과를 예측 가능하게 고정.

구현: `.dn-shell { color-scheme: light; }` 강제, 토글 UI 자체를 만들지 않음(설계에서 제외 — 재논의 시 v2 검토).

### 1-4. 무드보드 키워드
`지적도(地籍圖) 인장` · `나침반 로즈` · `등고선 그래티큘` · `우표/도장 소인` · `아틀라스 색인 카드` · `왁스 실링 봉인`

---

## 2. 디자인 토큰

### 2-1. 컬러 시스템

```css
.dn-shell {
  color-scheme: light; /* §1-3 라이트 고정 */

  /* ── Base (웜 페이퍼) ── */
  --dn-bg: #F6EFDF;              /* 페이지 배경 — 크림 갱지 */
  --dn-bg-deep: #EFE5CE;         /* 섹션 구분 배경(아카이브 alt 블록, 카운트다운 칩) */
  --dn-surface: #FFFDF6;         /* 카드 표면 */
  --dn-surface-raised: #FFFFFF;  /* 드롭다운·모달 등 최상위 표면 */
  --dn-border: #E2D5B8;          /* 헤어라인 */
  --dn-border-strong: #C9B98D;

  --dn-ink: #2B2419;             /* 본문 최상위 텍스트, 실루엣 기본 필 색 */
  --dn-body: #4E4433;            /* 본문(해설 장문 포함) */
  --dn-muted: #8A7C5E;           /* 보조/캡션/플레이스홀더 상위 */
  --dn-placeholder: #B3A489;

  /* ── Brand / Primary (나침반 테라코타) ── */
  --dn-primary: #BF4C2C;
  --dn-primary-ink: #FFFFFF;
  --dn-primary-dark: #963A20;
  --dn-primary-soft: #F6DDD1;    /* tint 배경 */

  /* ── Secondary (아틀라스 틸 — 링크/정보) ── */
  --dn-teal: #2C6E68;
  --dn-teal-soft: #DCEBE7;

  /* ── 실링(왁스 봉인) 골드 — "우리 동네" 뱃지 전용 ── */
  --dn-seal-gold-light: #E8C77A;
  --dn-seal-gold: #B8863B;
  --dn-seal-gold-dark: #7C5A28;

  /* ── 근접도 색 램프 (색맹 안전 — 청색→중립샌드→주홍, 적록 페어 회피)
       ⚠ 온스크린 칩·바 전용. 공유 텍스트 문자열에는 사용 금지(§0-2). ── */
  --dn-prox-1: #3D6E96;   /* 0–19%  매우 멂 */
  --dn-prox-1-bg: #E4EBF1;
  --dn-prox-2: #7B93A8;   /* 20–39% 먼 편 */
  --dn-prox-2-bg: #EAEEF1;
  --dn-prox-3: #B39A66;   /* 40–59% 중간 (샌드, 중립축) */
  --dn-prox-3-bg: #F1EADA;
  --dn-prox-4: #D3812F;   /* 60–79% 가까움 */
  --dn-prox-4-bg: #FBEBDA;
  --dn-prox-5: #C24E2E;   /* 80–99% 매우 가까움 */
  --dn-prox-5-bg: #F8DFD5;
  --dn-prox-correct: #3A7D5C;      /* 100% 정답 — 램프 바깥 별도색 + 🎯/텍스트 병행 필수(색 단독 금지) */
  --dn-prox-correct-bg: #E3EFE7;

  /* ── Semantic ── */
  --dn-success: #3A7D5C;
  --dn-success-bg: #E3EFE7;
  --dn-warning: #C97F1D;          /* 스트릭 위험 넛지 */
  --dn-warning-bg: #FBEEDA;
  --dn-error: #A6402D;            /* 폼 검증 실패 등, 매우 제한적 사용 */
  --dn-error-bg: #F5DFD8;
  --dn-info: var(--dn-teal);
  --dn-info-bg: var(--dn-teal-soft);

  /* ── 실루엣 프레젠테이션 전용 (§3) ── */
  --dn-silhouette-fill: var(--dn-ink);          /* 미해결 상태 — 잉크 스탬프 톤 */
  --dn-silhouette-frame-bg: var(--dn-surface);
  --dn-silhouette-graticule: rgba(43,36,25,0.05); /* 배경 격자 라인 */
  --dn-silhouette-reveal-correct: var(--dn-success);
  --dn-silhouette-reveal-fail: #A08F63;          /* 6패 소진 — "시간초과" 뉘앙스, 에러색 아님 */

  /* ── Shadow (도장이 눌린 느낌) ── */
  --dn-shadow-sm: 0 1px 2px rgba(43,36,25,0.08);
  --dn-shadow-md: 0 4px 12px rgba(43,36,25,0.12);
  --dn-shadow-stamp: 0 2px 0 rgba(43,36,25,0.10), 0 10px 22px rgba(43,36,25,0.14);

  /* ── Radius ── */
  --dn-radius-sm: 6px;
  --dn-radius-md: 10px;
  --dn-radius-lg: 16px;
  --dn-radius-frame: 12px;   /* 실루엣 프레임 카드 */
  --dn-radius-full: 999px;

  /* ── Spacing (4px 배수) ── */
  --dn-space-1: 4px;  --dn-space-2: 8px;  --dn-space-3: 12px;
  --dn-space-4: 16px; --dn-space-5: 20px; --dn-space-6: 24px;
  --dn-space-8: 32px; --dn-space-10: 40px; --dn-space-12: 48px;
}
```

- 근접도 5단계는 Okabe-Ito류 청색↔주홍 다이버징 램프로 설계해 적록색맹(P/D형)에서도 순서가 구분됨. **단, 색만으로 정보를 주지 않는다** — 모든 근접도 칩은 항상 `%` 숫자 텍스트 + 채움 바(길이 비례)를 함께 렌더해 색이 안 보여도 정보가 전달되게 한다(WCAG 1.4.1 준수).
- `--dn-prox-correct`(정답)는 램프 스케일 바깥의 독립 색으로, 반드시 🎯 아이콘 또는 "정답!" 텍스트와 함께 노출(색 단독 사용 금지) — 근접도 5단계(청~주홍)와 인접 혼동을 원천 차단.

### 2-2. 타이포그래피

```css
.dn-shell {
  --dn-font-display: "Black Han Sans", "Pretendard Variable", system-ui, sans-serif;
  --dn-font-body: -apple-system, BlinkMacSystemFont, "Pretendard Variable", "Malgun Gothic", system-ui, sans-serif;
}
```

| 토큰 | 크기/행간/굵기 | 용도 |
|---|---|---|
| `--dn-text-hero` | 30px / 1.24 / 800 (모바일) → 38px 데스크톱 | 워드마크 "동네고수", 결과 헤드라인 |
| `--dn-text-h1` | 22px / 1.3 / 800 | 아카이브 해설 제목, 섹션 타이틀 |
| `--dn-text-h2` | 17px / 1.4 / 700 | 카드 소제목, 해설 소제목(H2) |
| `--dn-text-body` | 15.5px / **1.78** / 400 | 해설 장문 본문 — 장문 가독성 위해 행간 넉넉히(다른 앱보다 +0.1~0.2 높음) |
| `--dn-text-body-sm` | 13px / 1.6 / 400 | 캡션, 메타정보, 자동완성 보조 라벨 |
| `--dn-text-label` | 11.5px / 1.3 / 700, letter-spacing 0.03em | 배지·탭·eyebrow 라벨 |
| `--dn-text-mono-num` | 15px, `font-variant-numeric: tabular-nums`, 700 | 거리km·근접도%·카운트다운·스트릭 숫자 |
| `--dn-text-guess-name` | 15px / 1.4 / 600 | 시도 행의 추측 지역명 |

- `--dn-font-display`(Black Han Sans)는 워드마크·게임 회차 번호·결과 헤드라인·OG 텍스트에만 한정 사용. 자동완성·해설 본문·시도 행은 전부 `--dn-font-body`(로딩비용 0).
- 숫자는 전부 `tabular-nums`(거리·근접도·카운트다운·스트릭 — 자릿수 바뀌어도 레이아웃 안 흔들림, 기획서 §3-1 "자릿수 정렬" 요구 대응).

### 2-3. 스페이싱 & 그리드

- 기본 단위 4px, 실사용 8px 배수(§2-1 `--dn-space-*`).
- 모바일 콘텐츠 좌우 패딩: **16px**(office-archetype의 20px보다 좁게 — 시도 행 3셀 그리드가 360px 폭에서 여유를 확보하기 위함, §7 계산 참고).
- 최대 폭: `max-width: 480px` 중앙 정렬, 그 이상 폭에서도 모바일 카드 폭 유지(모바일 전담 원칙, `/office-archetype` 선례 계승). 단 아카이브 해설 본문만 데스크톱에서 `max-width: 640px`로 확장 허용(장문 읽기 최적 줄길이 확보, §6).
- 카드 내부 패딩: 16px(기본), 실루엣 프레임 카드 20px(모바일)/24px(≥480px).
- 섹션 간 32px, 같은 그룹 내 요소 8~12px.

### 2-4. Radius & Shadow

- 버튼/인풋: `--dn-radius-md`(10px) — pae의 각진 느낌과 office-archetype의 둥근 느낌 사이 절제된 중간값.
- 카드/드롭다운: `--dn-radius-lg`(16px).
- 실루엣 프레임: `--dn-radius-frame`(12px) — 지도 색인 카드 느낌.
- 배지/칩/실링: `--dn-radius-full`.
- 그림자는 "도장이 종이에 눌린" 인상: `--dn-shadow-sm`(리스트 행), `--dn-shadow-md`(드롭다운·토스트), `--dn-shadow-stamp`(실루엣 프레임·실링 뱃지 전용 — 2단 그림자로 눌림 깊이감).

---

## 3. 실루엣 프레젠테이션 스펙

전제(방향서 §2 확정, UI는 이 규칙 위에 시각 스펙만 얹는다): **정북 고정(회전 없음)·미러 금지·fit-to-frame 88%(프레임 대비 여백 상하좌우 각 6%)·단일 path 솔리드 필·내부 디테일 최소화(다도해는 주요 섬 2~3개만)** — 데이터 파이프라인(`build-regions.ts`)에서 이미 각 `silhouettes/{code}.json`의 viewBox 안에 88% fit-to-frame이 사전 계산되어 들어온다.

### 3-1. 프레임 카드
```
비율: 정사각(1:1), 폭 = min(100%, 320px) 모바일 / 360px ≥480px  [F10 확정: §7의 360 캡과 정합]
배경: var(--dn-silhouette-frame-bg), border 1.5px solid var(--dn-border)
radius: var(--dn-radius-frame), shadow: var(--dn-shadow-stamp)
카드 내부 패딩: 20px(모바일) / 24px(≥480px) — 데이터가 이미 88% fit한 SVG 바깥에 추가로 주는 UI 여백
```
- SVG 자체는 데이터 단계에서 이미 6% 여백을 포함하므로, 프레임 카드 패딩과 합산하면 실루엣 주변 총 여백은 시각적으로 넉넉해진다(작은 지역·복잡한 해안선도 잘림 없이 표시).
- 실루엣은 항상 카드 정중앙 배치, 좌우 스크롤/줌 없음(고정 뷰).

### 3-2. 채움색·배경 텍스처
- **채움색(미해결)**: `--dn-silhouette-fill`(잉크 브라운블랙) 솔리드. 흰 종이 위 검은 잉크 스탬프 느낌 — 방향 8각 화살표 힌트의 지리적 의미를 왜곡하지 않는 무채색 계열 유지(방향서 R1 관련 — 색으로 지역을 암시하지 않음).
- **배경 텍스처: 채택(약하게)** — 실루엣 프레임 내부에만 국한된 **그래티큘(위경도 격자) 패턴**을 깐다: `--dn-silhouette-graticule`(잉크 5% 불투명도) 1px 라인, 가로세로 32px 간격 격자. 실제 위경도 좌표가 아닌 순수 장식용 균등 격자(진짜 좌표를 흉내내 위치를 암시하면 안 됨 — 스포일러 방지 원칙과 충돌하지 않도록 **일정 간격의 장식 격자**로만 한정).
- 대비 기준: 격자 5% 불투명도는 실루엣 필(잉크색, 거의 100% 불투명)과 배경(크림 surface) 사이 대비를 절대 해치지 않는 수준 — WCAG 대비비는 실루엣 대 배경 기준으로만 검증(격자는 장식이라 텍스트 대비 규정 적용 대상 아님, 단 과하게 진해지지 않도록 5% 상한 고정).

### 3-3. 정답 공개 연출
| 상태 | 필 색 전환 | 애니메이션 | 부가 요소 |
|---|---|---|---|
| **정답(성공)** | `--dn-silhouette-fill` → `--dn-silhouette-reveal-correct`(초록) 400ms crossfade | `scale(1 → 1.04 → 1)` 300ms ease-out-back, 지역명 라벨 아래에서 슬라이드업 페이드인(200ms 지연) | "정답!" 스탬프 그래픽이 -8deg 회전하며 팝인(도장 찍는 연출, `cubic-bezier(0.34,1.56,0.64,1)`) |
| **6패 소진** | `--dn-silhouette-fill` → `--dn-silhouette-reveal-fail`(муted 올리브그레이) 600ms crossfade(성공보다 느리게 — 아쉬움의 톤) | scale 변화 없음, 라벨만 페이드인 | "정답은 OO구였어요" 라벨 + (오늘 회차는 아직 해설 페이지가 없으므로) "내일 '어제의 동네'에서 자세히 만나요" 안내 텍스트만, 해설 링크는 렌더하지 않음 |
| 진행 중(1~5회차 오답) | 변화 없음(계속 `--dn-silhouette-fill`) | — | 실루엣은 그대로, 힌트는 시도 행(§4-2)에만 누적 표시 |

- `prefers-reduced-motion: reduce` 시 모든 전환을 즉시 최종값으로(스케일 바운스·회전 생략, crossfade만 0.01ms) — `dongne.css`에 별도 media query 블록 명시 필요(전역 규칙이 스코프 내부 커스텀 keyframe까지 자동 적용 안 될 수 있음, office-archetype 선례와 동일 주의사항).
- 정답 공개 전까지 SVG `<title>`/`aria-label`에도 지역명 렌더 금지 — 스크린리더 사용자에게도 스포일러 금지 원칙 동일 적용, 대신 "오늘의 동네 실루엣" 같은 일반 alt만 사용.

---

## 4. 컴포넌트 스펙

### 4-1. 자동완성 인풋

```
높이 48px, radius var(--dn-radius-md), border 1.5px solid var(--dn-border-strong)
배경 var(--dn-surface), 좌측 아이콘 인셋(맵핀/검색, 18px, x=12px)
폰트 크기 16px 고정(iOS 자동확대 방지 — 모바일 인풋 필수 규칙)
placeholder: "동네 이름을 입력하세요 (예: 해운대구)" color var(--dn-placeholder)
```
- **포커스**: `border-color: var(--dn-primary)`, `box-shadow: 0 0 0 3px rgba(191,76,44,0.18)`(테라코타 링, 이 라우트 전용 override).
- **드롭다운**: [F2 확정] **입력 위로 오픈 기본**, 위 가용공간 < 180px면 아래로 폴백. `max-height: 240px` 스크롤, **최대 6개 결과만**, 배경 `var(--dn-surface-raised)`, `border: 1px solid var(--dn-border)`, `border-radius: var(--dn-radius-md)`, `box-shadow: var(--dn-shadow-md)`.
- **옵션 행**: `min-height: 44px`, 패딩 `10px 14px`. 좌: 지역명(매칭 부분 문자열 `var(--dn-primary)` 볼드), 우: **동명 지역이면 항상 시도 축약 배지 병기**(예: "강원" pill, `background: var(--dn-bg-deep)`, `color: var(--dn-muted)`, 11px, radius-full) — 방향서 R4 "동명 (시도) 배지 항상 병기" 규칙의 UI 구현.
- 키보드 네비게이션(↑↓): 하이라이트 행 배경 `var(--dn-primary-soft)`.
- **[디자인팀장 확정 F1] 2탭 제출**: 리스트 선택 = 입력창 확정 채움 + [추측하기] 버튼 활성화(제출 아님) → [추측하기] 탭이 실제 제출. 즉시제출 폐기(시도 6회는 되돌릴 수 없는 자원, 방향서 R4 오탭 방지). 자유 텍스트 상태로는 제출 불가.
- **[디자인팀장 확정 F2] 드롭다운 위로 오픈 기본**: 입력창이 하단부에 있고 인앱 키보드가 하단을 가리므로 위로 오픈이 기본. 위 가용공간 < 180px면 아래로 폴백.
- 정답 확정(성공/6패) 후: 인풋 자체가 사라지고 인라인 결과 블록으로 교체(페이지 이동 없음, 방향서 "게임→결과 인라인" 확정 원칙).

### 4-2. 시도 행 (게임 로그, 최신이 아래로 누적 — Wordle 관례)

> **[디자인팀장 확정 F7·F8] 이 2줄 3셀 카드는 폐기.** 카톡 짧은 뷰포트 세로 예산 초과(2줄×6행). 최종 채택은 **단일 라인 행 + 하단 근접도 바(이중 인코딩)** + **6행 고정 스켈레톤(미플레이 행 컴팩트)** + 리스트 상단 1회 컬럼 라벨. 상세 그리드·상태표는 최종안 §4-6. 아래 색·이중인코딩·정답행 규칙은 단일 라인에도 그대로 적용.

~~행 구조(2줄):~~
```
줄1: [순번 원형칩 22px] [추측 지역명 --dn-text-guess-name, 동명이면 "(시도)" 인라인 병기]
줄2: grid-template-columns: 1fr 1fr 1fr; gap: 6px;  (3개 힌트 셀)
```
- **거리 셀**: 상단 숫자 `--dn-text-mono-num`("182") + 하단 "km" 라벨(`--dn-text-body-sm`, `--dn-muted`), 배경 `var(--dn-bg-deep)`, radius `--dn-radius-sm`, 패딩 `6px 8px`.
- **방향 셀**: 8방위 화살표 아이콘(중립 잉크색 `var(--dn-ink)`, 근접도 색과 무관 — 방향은 색으로 구분하지 않음) + 하단 방위 라벨("북동"), 배경 `var(--dn-info-bg)`.
- **근접도 셀**: 상단 `%` 숫자(`--dn-text-mono-num`, 해당 단계 색 `var(--dn-prox-N)`) + 하단 미니 바(폭 100%, 높이 4px, track `var(--dn-prox-N-bg)`, fill `var(--dn-prox-N)` width=근접도%) — **숫자+바 이중 인코딩**으로 색맹 사용자도 판독 가능(§2-1).
- 행 컨테이너: 배경 `var(--dn-surface)`, `border: 1px solid var(--dn-border)`, radius `var(--dn-radius-md)`, `margin-bottom: 8px`, 패딩 `10px 12px`.
- **정답 행**(마지막 성공 시도)은 3셀 대신 풀폭 셀 1개로 교체: 배경 `var(--dn-success-bg)`, 텍스트 "🎯 정답!" `var(--dn-success)` 볼드, border-color `var(--dn-success)`.
- 신규 행 추가 시 `slide-up + fade-in` 220ms, 자동으로 `scrollIntoView({behavior:'smooth', block:'nearest'})`(최신 행이 항상 보이게).
- 360px 폭 기준 계산: 콘텐츠 폭 328px(패딩 16px×2 제외) → 3셀 gap 12px 제외 시 셀당 ≈105px, 숫자(3~4자리)+라벨 배치에 충분.

### 4-3. 공유 버튼

- **1차(Primary, 항상 노출)**: "결과 복사하기 📋" 풀폭 버튼, 높이 50px, `background: var(--dn-primary)`, 텍스트 흰색, 좌측 클립보드 아이콘, radius `--dn-radius-md`, shadow `--dn-shadow-sm`. 탭 시 클립보드 복사(기획서 §3-1 텍스트 포맷) + **[디자인팀장 확정 F3] 버튼 라벨을 "복사됨 ✓"로 2초 전환(토스트 미사용 — 카톡 인앱 토스트 좌표 씹힘) + `aria-live="polite"`**.
- **2차(병행, `navigator.share` 지원 시)**: 버튼 라벨을 "공유하기"로 교체하고 Web Share Sheet 트리거(같은 텍스트+URL), 미지원 브라우저는 자동으로 1차(클립보드) 동작으로 폴백 — 별도 분기 UI 불필요, 라벨만 조건부 교체.
- 공유 텍스트 조립 시 **색상 코드/이모지 색블록 삽입 절대 금지**(§0-2) — 컴포넌트 레벨에서 온스크린 근접도 색상(`--dn-prox-*`)과 공유 텍스트 포매터 함수는 물리적으로 분리된 모듈이어야 함(개발 인계 시 강조).
- 결과 블록 하단 텍스트 링크 "내 통계 보기 (펼치기 ▾)"([디자인팀장 확정 F4] **인라인 아코디언 확장** — 모달 미사용, `--dn-text-body-sm`, `--dn-muted`, underline). 히스토그램 스펙은 최종안 §4-11.

### 4-4. 스트릭 칩

```
pill, height 28px, padding 4px 10px 4px 8px
background: linear-gradient(135deg, var(--dn-primary-soft), #FBEEDA)
아이콘: 🔥(또는 lucide Flame) 14px, color var(--dn-primary)
숫자: --dn-text-mono-num 13px 700 --dn-ink, 접미 "일"
```
- 헤더 우측 또는 결과 요약 상단에 배치. 예: "🔥 스트릭 5일".
- 스트릭 0일(오늘 아직 미플레이)이거나 어제 미접속으로 스트릭이 끊긴 경우 회색 톤(`--dn-muted` 배경, 아이콘 흑백)으로 다운그레이드해 "위험/끊김" 상태를 시각적으로 구분.

### 4-5. "우리 동네" 뱃지 (왁스 실링 메달)

```
원형 메달, 지름 64px(결과 인라인) / 40px(축약 표기)
배경: radial-gradient(circle at 35% 30%, var(--dn-seal-gold-light), var(--dn-seal-gold) 55%, var(--dn-seal-gold-dark) 100%)
음각 효과: inset box-shadow 0 2px 3px rgba(255,255,255,0.4), inset 0 -2px 4px rgba(0,0,0,0.35)
그림자: var(--dn-shadow-stamp), 살짝 회전 rotate(-6deg)
중앙 아이콘: 집/맵핀 글리프 20px var(--dn-ink), 원 둘레를 따라 곡선 텍스트 "우리 동네"(9px, letter-spacing 0.05em) — 곡선 텍스트 구현 부담 시 상단 고정 배지 텍스트로 대체 가능(선택)
```
- 최초 진입 시 1회 "내 동네" 설정(자동완성 재사용, localStorage 저장). 오늘 정답 == 내 동네일 때만 결과 화면에 노출.
- 옆에 카피 "오늘 정답이 우리 동네였음 ㅋㅋ"(`--dn-text-body`, 볼드, `--dn-primary-dark`).
- 뱃지는 정답 공개(성공/6패 불문) **이후에만** 등장 — 스포일러 경계와 동일 타이밍.

### 4-6. 카운트다운 (다음 문제까지)

```
pill, background var(--dn-bg-deep), radius-full, padding 6px 12px
아이콘: 시계(14px, --dn-muted) + 텍스트 "다음 문제까지 07:42:15"(--dn-text-mono-num, 13px, --dn-muted)
```
- KST 자정(00:00) 기준 잔여 시간, 1초마다 클라이언트 갱신(`queue.ts`의 EPOCH 산술 재사용 — 별도 시간 계산 로직 신규 작성 금지).
- 결과 블록 하단, 아카이브 페이지 CTA 근처에 보조적으로 배치(리텐션 넛지, 방향서 §4 "스트릭 위험" 넛지와 동일 톤).

### 4-7. 기타 공용 요소

- **헤더**: [디자인팀장 확정 F5·F6] 높이 **48px content + `env(safe-area-inset-top)`**, 배경 `var(--dn-bg)`, 하단 `1px solid var(--dn-border)`, 좌측 워드마크 "동네고수"(`--dn-font-display`, 20px) + 회차 배지 "#123"(pill, `var(--dn-primary)` 배경, 흰 텍스트, 11px 700), 우측 = **"아카이브" 텍스트 링크**(통계/정보 아이콘 폐기 — 통계는 결과 카드 인라인, 다크토글 없음 §1-3).
- **버튼(공용)**: Primary(`var(--dn-primary)` 배경, 흰 텍스트, radius-md, height 50px) / Secondary(흰 배경 + `var(--dn-border-strong)` 테두리) / Ghost(배경 없음, `var(--dn-body)` 텍스트, hover underline).
- **토스트**: [디자인팀장 확정 F3] v1 **미채용**(복사 피드백은 버튼 라벨 전환으로 대체). 카톡 인앱 좌표 씹힘 이슈로 컴포넌트 자체를 만들지 않음.
- **하단 탭바 없음**(방향서 확정) — 모든 화면은 단일 세로 스크롤 흐름.
- **safe-area 하단 요소**: `padding-bottom: env(safe-area-inset-bottom, 0px)`, 단 공유 버튼은 sticky/fixed로 두지 않고 **인라인 배치**(§7 근거).

---

## 5. OG 카드 스펙 — 1200×630, 스포일러-프리 티저

> 구현 스택: office-archetype `src/app/office-archetype/og/[typeSlug]/route.tsx`의 `ImageResponse`/`runtime="edge"` 패턴 이식(방향서 C1 확정). **단 캔버스 비율은 office-archetype의 1200×1200(1:1, 카카오 링크카드용 다운로드 이미지 패턴)과 달리 이 프로젝트는 og:image 메타 태그를 통한 일반 링크 언퍼널링이 목적이므로, 카카오·트위터·페이스북·슬랙에서 가장 폭넓게 호환되는 표준 링크 프리뷰 비율 1200×630(1.91:1)을 채택**(기획서 임무 지정 그대로 확정).

### 5-1. 스포일러 방지 원칙 (렌더 로직 최우선 제약)
- OG 라우트는 `manifest.json`에서 **정답 지역의 `name`/`centroid`를 절대 읽어 렌더하지 않는다**. 실루엣 `path`(형태 데이터)만 사용 — 형태 자체는 이름을 노출하지 않으므로 완화 3종(기획서 §2-1)과 상충하지 않는다.
- 실루엣은 **채움 없이 윤곽선만**(stroke-only, fill: none) — 미리보기 썸네일 크기(카톡 대화창 ~120px)에서는 형태 식별이 사실상 불가능한 수준으로 더 낮춘다. 등고선처럼 옅게, 대시 스트로크로 "형태가 있다"는 궁금증만 유발.
- `alt`/`og:image:alt`도 일반문("동네고수 #123 — 오늘의 동네 실루엣 퀴즈")만, 지역명 언급 금지.

### 5-2. 레이아웃 (1200×630 절대 좌표)

| 영역 | 위치(x, y, w, h) | 내용 |
|---|---|---|
| 배경 | 0,0,1200,630 | `linear-gradient(135deg, var(--dn-bg) 0%, var(--dn-bg-deep) 100%)` + 그래티큘(32px 간격, 5% 불투명 잉크 라인) 전면 오버레이 |
| 세이프존 여백 | 상하좌우 최소 64px | 카톡/FB/트위터 크롭 대응 |
| Eyebrow 라벨 | 64, 72 | "매일 만나는 대한민국 동네 실루엣 퀴즈" 20px 700 `--dn-muted` letter-spacing 0.02em |
| 워드마크 | 64, 130 | "동네고수" `--dn-font-display` 80px 800 `--dn-ink` |
| 회차 배지 | 워드마크 우측 +20px 간격, baseline 정렬 | "#123" pill, `var(--dn-primary)` 배경, 흰 텍스트 28px 800, radius-full, 패딩 8px 20px |
| 태그라인 | 64, 250, width 620 | "6번 안에 대한민국 동네 실루엣 맞히기" 34px 500 `--dn-body`, 좌측 정렬 |
| 실루엣 티저 | 우측 컬럼, center x≈900 y≈310, bbox 360×360 | 윤곽선만(stroke `--dn-ink` 30% 불투명, stroke-width 3, `stroke-dasharray: 6 4`, fill: none), -4deg 회전(오려낸 지도 조각 느낌) |
| "?" 오버레이 | 실루엣 중앙 위 | Black Han Sans "?" 220px, `var(--dn-primary-soft)` 55% 불투명, 실루엣과 겹쳐 배치해 궁금증 강화 |
| 하단 CTA 바 | 0, 538, 1200, 92 | `var(--dn-primary)` 배경 풀폭, 흰 텍스트 "6번 안에 맞혀보세요 → project-orsrw.vercel.app/dongne" 28px 700 중앙정렬 |

- 폰트: 워드마크·회차 배지·CTA = Black Han Sans(edge 런타임은 폰트 바이너리를 fetch/주입해야 렌더됨 — office-archetype과 동일한 미해결 리스크가 이 라우트에도 그대로 적용됨, §8 오픈이슈 참조). Eyebrow·태그라인 = 시스템 sans 폴백(폰트 fetch 불필요, 즉시 렌더 보장).
- 파일 형식 PNG, `og:image` 메타에 연결. `/dongne/og/[gameNo]` 경로로 회차별 URL 고유화(캐시버스터 불필요, 기획서 §3-2 확정).

---

## 6. '어제의 동네' 에디토리얼 템플릿

> 대상: `/dongne/archive/[gameNo]`(SSG, 오늘 미만만 생성). 목적: (a) 리텐션 콘텐츠, (b) 애드센스 요구 콘텐츠 층, (c) SEO 롱테일(방향서 §1 확정). 정답 공개가 전제된 페이지이므로 스포일러 제약 없음 — 실루엣·지역명 전부 노출 가능.

### 6-1. 페이지 구조 (위→아래)

1. **브레드크럼**: "동네고수 › 아카이브 › #122" `--dn-text-body-sm`, `--dn-muted`, 상단 패딩 16px.
2. **헤더 블록**: eyebrow pill "어제의 동네"(배경 `var(--dn-teal-soft)`, 텍스트 `var(--dn-teal)`) → H1 "OO구는 어떤 동네였을까?"(`--dn-text-h1`, `--dn-font-display` 허용 — 게임 화면과의 시각적 연속성) → 메타 행: 회차 "#122" + 날짜(tabular) + 정답 지역 표기(`시군구명(시도)` 규칙 그대로).
3. **히어로 실루엣**: §3의 실루엣 프레임 컴포넌트 재사용, 이번엔 `--dn-silhouette-reveal-correct`(초록) 또는 중립 아카이브 전용 톤으로 필. **선택 강화안**: 전체 250개 조각을 합치면 대한민국 전도가 재구성되는 원리를 이용해, 극도로 단순화한 "대한민국 미니 로케이터"(같은 자체 실루엣 데이터, 신규 저작권 리스크 없음) 위에 해당 지역만 점으로 하이라이트 — 실제 지도 이미지 사용 없이 "여기 어디쯤" 위치감을 준다(nice-to-have, 데이터팀 리소스 남으면 D2 후반 반영, 필수 아님).
4. **정보 스탯 카드**: 2×2 그리드(모바일)/4×1(≥480px) — 인구·면적·소속 시도·(선택)오늘 문제 대비 순번. 각 카드: 라벨 11px `--dn-muted` + 값 20px 700 tabular, 배경 `var(--dn-surface)`, border `var(--dn-border)`, radius `--dn-radius-md`.
5. **본문(1,500자+)**: `--dn-text-body`(15.5px/1.78/400), 문단 간격 20px, 소제목(H2, `--dn-text-h2`)으로 섹션 구분 — 권장 섹션: "개요" / "지명의 유래" / "특산물·랜드마크" / "오늘 문제였다면?". 본문 최대폭 100%(모바일) / `640px`(≥480px, 최적 읽기 줄길이 확보).
6. **애드센스 슬롯(권장 배치, 2개)**: ① 첫 문단 직후 in-content 반응형 슬롯, ② 본문 종료 후 CTA 카드 앞 1개. 두 슬롯 모두 본문과 시각적으로 24px 여백 + 옅은 구분선(`1px solid var(--dn-border)`)으로 분리, "광고" 라벨 유지(Google 정책 — 콘텐츠 오인 방지).
7. **CTA 카드**: "오늘의 문제 풀러가기 →"(`/dongne`로 링크), 배경 `var(--dn-primary-soft)`, border `var(--dn-primary)`, radius-lg, 풀폭 — 해설 페이지에서 게임으로 돌아가는 핵심 리텐션 루프이므로 가장 눈에 띄게.
8. **아카이브 페이지네이션**: "‹ #121" / "#123 ›" — 다음 회차가 "오늘"이면 링크 비활성 처리 + 안내 문구 "오늘 문제는 아직 공개 전이에요"(스포 방지, 아카이브는 오늘 미만만 SSG되므로 실제로는 라우트 자체가 404이나 UI 레벨에서도 방어적으로 비활성 표기).
9. **푸터**: 정적 3종(소개/개인정보/문의) 텍스트 링크 행, `--dn-text-body-sm`.

### 6-2. 타이포 튜닝 근거
- 본문 행간 1.78(다른 컴포넌트 대비 최고치) — 장문 한글 읽기는 줄간격이 좁으면 피로도가 급증하고, 애드센스 페이지는 체류시간이 SEO·수익 모두에 직결되므로 가독성을 최우선.
- 본문 텍스트 색은 순검정이 아닌 `--dn-body`(#4E4433, 웜 브라운블랙) — 종이 위 잉크처럼 눈부심을 줄여 장문 읽기 피로도 완화.
- 헤딩 계층은 실제 `<h1>`/`<h2>` 시맨틱 태그로 구현(개발팀에 전달 — 백엔드팀 산출물인 페이지 레벨 JSON-LD가 이 시맨틱 구조를 그대로 활용).

---

## 7. 모바일 우선 레이아웃 규칙 (360px~) · 카톡 인앱 safe-area

- **디자인 타깃 최소폭 360px**(보급형 안드로이드 기준), 375px(iPhone SE)을 기본 검증 폭으로.
- **브레이크포인트**: `<480px` 기본(풀폭, 좌우 패딩 16px) / `≥480px` `max-width: 480px` 중앙 정렬(아카이브 본문만 640px 예외, §6-1).
- **뷰포트 높이**: `.dn-shell { min-height: 100dvh; }`(`100vh` 단독 사용 금지 — 카톡 인앱 브라우저 주소창/하단 바 크기 변화로 인한 잘림 방지, 방향서 R3). `dvh` 미지원 구형 브라우저 폴백으로 `100vh`를 먼저 선언 후 `100dvh`로 override(progressive enhancement).
- **safe-area**: `.dn-shell`에 `padding: env(safe-area-inset-top) env(safe-area-inset-right) env(safe-area-inset-bottom) env(safe-area-inset-left)` 적용. 헤더는 `padding-top`에 safe-area-inset-top 추가 반영.
- **sticky 요소 최소화**: 헤더만 `position: sticky; top: 0`. **공유 버튼·CTA는 sticky/fixed로 하단 고정하지 않고 인라인 배치**(방향서 확정) — 이유: 카톡 인앱 브라우저 자체 하단 툴바(≈56px)와 우리 앱의 sticky 바가 이중으로 쌓이면 실사용 가능 화면이 더 좁아지고, 짧은 뷰포트(예: 갤럭시 구형 기종)에서 시도 행 리스트를 sticky 바가 가리는 사고가 나기 쉬움.
- **인풋 폰트 크기 ≥16px** 고정(iOS Safari 계열 웹뷰 자동 확대 방지 — 자동완성 인풋 필수 규칙, §4-1).
- **터치 타겟 ≥44×44px** 전 컴포넌트(자동완성 옵션 행, 버튼, 순번 칩 제외 텍스트 요소).
- **가로 스크롤 금지**: 실루엣 프레임 폭은 `min(100%, 360px)`로 캡, 시도 행 그리드는 `overflow-wrap` 대신 셀 내부 `font-size` 축소 없이 고정폭 그리드 유지(360px 폭 계산은 §4-2 참고).
- **가로 모드**: 우선순위 낮음 — 별도 대응 없이 세로 레이아웃 유지 + 세로 스크롤 허용(오피스 아키타입과 동일 정책).
- **Web Share 불안정 대응**: `navigator.share` 우선 사용하되 실패/미지원 시 즉시 클립보드 폴백(§4-3) — 카톡 인앱은 Web Share API 지원이 기기·버전별로 들쭉날쭉하므로 클립보드가 항상 1차 진실 경로.

---

## 8. 개발 핸드오프 체크리스트

- [ ] `src/app/dongne/dongne.css` 신규 생성, `layout.tsx`에서 import(`globals.css`/`tailwind.config.ts` 무수정)
- [ ] `layout.tsx` 최상위에 `<div className="dn-shell">` 래퍼, `color-scheme: light` 강제(다크 토글 UI 없음)
- [ ] 근접도 색(`--dn-prox-1~5`, `--dn-prox-correct`)은 **온스크린 컴포넌트에만** 바인딩, 공유 텍스트 포매터 함수와 물리적으로 분리된 모듈에 둘 것(§0-2, §4-3)
- [ ] 정답 확정 전 DOM/`alt`/OG에 `today.name`/`today.centroid` 렌더 금지 — 실루엣 컴포넌트·OG 라우트 양쪽에 가드 필요(§0-3, §5-1)
- [ ] 시도 행 근접도 셀은 **숫자+바 이중 인코딩** 필수(색만으로 정보 전달 금지, §4-2)
- [ ] `prefers-reduced-motion` 대응을 `dongne.css` 커스텀 keyframe(정답 공개 연출 등)에 명시적으로 재작성(§3-3)
- [ ] OG 라우트 `src/app/dongne/og/[gameNo]/route.tsx` — office-archetype `ImageResponse`/edge 패턴 이식, 캔버스만 1200×630로 조정(§5)
- [ ] 자동완성 인풋 `font-size: 16px` 고정, 드롭다운 하단 공간 부족 시 위로 플립 로직(§4-1, §7)
- [ ] 공유 버튼 sticky 금지, 인라인 배치(§4-3, §7)
- [ ] `.dn-shell`에 `env(safe-area-inset-*)` + `100dvh`(폴백 `100vh`) 적용(§7)
- [ ] 아카이브 본문만 `max-width: 640px` 예외 적용(§6-1), 그 외 전 화면 `max-width: 480px`

---

## 9. 오픈 이슈 (프론트팀장/백엔드팀장 확인 필요)

1. **OG 폰트 자산**: office-archetype OG 라우트도 Black Han Sans/Paperlogy 바이너리 미확보로 satori 기본 sans 폴백 중인 것으로 실측됨. `/dongne/og`도 동일 리스크 — Black Han Sans woff/ttf를 `public/fonts/`에 로컬 포함하지 않으면 워드마크·CTA가 시스템 sans로 폴백 렌더된다(레이아웃 좌표는 폰트 무관하게 동일하게 유지되므로 폰트 자산이 추가되면 좌표 변경 없이 바로 적용 가능).
2. **미니 로케이터 맵**(§6-1 4번, "대한민국 위 위치 하이라이트")은 nice-to-have로 표시했으나, 250개 조각을 합쳐 저해상도 국가 윤곽을 만드는 작업이 D1 데이터 파이프라인에 추가 부하를 줄 수 있어 데이터팀 리소스 확인 후 D2 반영 여부 결정 필요.
3. **그래티큘 텍스처 성능**: 실루엣 프레임·OG 카드에 반복되는 격자 패턴은 CSS `repeating-linear-gradient` 또는 인라인 SVG `<pattern>`으로 구현 가능 — 프론트팀 선호 구현 방식에 맞춰 선택(시각 결과 동일하면 무관).
