# 동네고수 (`/dongne`) — 디자인 최종안

- 작성: 2026-07-16 · 디자인팀장(최종 결정)
- 종합 소스: `docs/design/dongne-ux-spec.md`(UX) + `docs/design/dongne-ui-spec.md`(UI)
- 상위 문서: `docs/planning/dongne-direction.md`(방향서·최우선) + `docs/planning/dongne-plan.md`(기획서)
- **이 문서가 단일 진실 소스다.** 하위 UX/UI 스펙과 충돌 시 이 문서가 우선한다. 프론트엔드팀은 이 문서 하나만으로 구현한다.
- 전제(불변): 공유 파일(`globals.css`/루트 `layout.tsx`/`tailwind.config.ts`) 수정 0건 · 모든 스타일은 `.dn-shell` 스코프 + `--dn-` prefix · 온스크린 색과 공유 텍스트는 코드 레벨 물리 분리 · 정답 확정 전 `today.name`/`today.centroid` DOM·alt·OG 렌더 금지.

---

## 0. 팀장 확정 — 충돌 해소 결정 로그

UX/UI 두 스펙이 어긋난 지점을 아래와 같이 확정한다. (F#=Final 결정번호)

| F# | 충돌 지점 | UX안 | UI안 | **최종 결정** | 근거 |
|---|---|---|---|---|---|
| F1 | 추측 제출 방식 | 선택→[추측하기] **2탭** | 선택 즉시 제출 1탭 | **2탭 확정** | 시도 6회는 되돌릴 수 없는 자원. 방향서 R4 "오탭 시도 소모 방지". 즉시제출은 오탭 1회=시도 손실 |
| F2 | 드롭다운 위치 | 항상 입력창 위 | 아래 기본, 부족 시 위 플립 | **입력창 위로 오픈 기본**, 위 공간<180px면 아래 폴백 | 입력창이 하단부에 있고 인앱 키보드가 하단 40~50% 점유. 위 오픈이 기본값이어야 안정 |
| F3 | 복사 피드백 | 버튼 라벨 전환 "복사됨 ✓" | 하단 토스트 | **버튼 라벨 인라인 전환** (토스트 컴포넌트 v1 미채용) | 카톡 인앱 토스트 좌표 씹힘. 버튼 자체 상태변화가 안정적 (UX 근거 채택) |
| F4 | 통계 보기 | 인라인 아코디언 확장 | 모달 오픈 | **인라인 아코디언 확장** | 모달 최소화 원칙(인앱 뒤로가기·좌표계 안정). 모달 컴포넌트 v1 미채용 |
| F5 | 헤더 우측 | "아카이브" 텍스트 링크 | 통계/정보 아이콘 버튼 | **"아카이브" 텍스트 링크** | 아카이브=리텐션·SEO 핵심 동선. 통계는 결과카드 인라인으로 접근. 모호한 아이콘 제거 |
| F6 | 헤더 높이 | ≤44px 최소 크롬 | 52px | **48px(content) + safe-area-inset-top** | 최소 크롬 지향(UX) + 터치 여백 현실(UI) 절충 |
| F7 | 시도 행 레이아웃 | 단일 라인(자릿수 정렬) | 2줄 3셀 카드 | **단일 라인 + 근접도 이중인코딩(색% + 하단 바)** | 카톡 짧은 뷰포트 세로 예산. 2줄×6행은 세로 과점유. 라벨은 리스트 상단 1회 표기로 해결 |
| F8 | 시도 리스트 구조 | 6행 고정 스켈레톤 | 누적(플레이분만 노출) | **6행 고정 스켈레톤**: 플레이 행=풀 렌더, 미플레이 행=컴팩트 플레이스홀더 | "6번 안에" 자원 예산 시각화(UX) + 미플레이 행 컴팩트로 세로 절약(UI 우려 반영) |
| F9 | 입력창 sticky | 하단 sticky 고정 | 헤더만 sticky | **입력창 non-sticky** (포커스 시 네이티브 scroll-into-view 의존) | 카톡 하단 툴바+sticky 이중 스택 사고 방지(방향서 R3). sticky는 헤더만 |
| F10 | 실루엣 프레임 폭 | — | 320px vs 360px 내부 불일치 | **모바일 min(100%,320px) / ≥480px 360px** | UI 내부 모순 해소 |
| F11 | 스트릭 라벨 | "플레이 스트릭" | "스트릭" | **온스크린="플레이 스트릭 N일 (최고 M일)" / 공유텍스트="🔥 스트릭 N일"** | 온스크린은 정책 명시, 공유는 기획서 §3-1 포맷 고정 |
| F12 | 공유 URL | project-orsrw.vercel.app/dongne | dongne.kr(실험기 병기) | **v1=`project-orsrw.vercel.app/dongne`** (도메인 이전 후 dongne.kr 교체) | 자체도메인 게이트 통과 후 구매. v1은 슬러그 URL만 |

신규 보완 컴포넌트(양 스펙 누락): 온보딩 스트립 · 통계 히스토그램 · 스트릭 위험 넛지 배너 · localStorage 불가 안내 · 실루엣 로딩/에러 상태 · "내 동네" 미등록 유도 카드 → §4에서 스펙 정의.

---

## 1. 화면 구조 (Information Architecture)

### 1-1. 라우트 맵

```
/dongne                        오늘의 게임 (핵심·단일 화면, 결과는 인라인 아코디언 확장 — 별도 라우팅 없음)
/dongne/archive                아카이브 목록 (오늘 회차 제외, 어제까지만)
/dongne/archive/[gameNo]       '어제의 동네' 해설 (SSG, gameNo<오늘만 생성 → 미래/오늘=친화적 차단화면)
/dongne/about                  소개
/dongne/privacy                개인정보처리방침
/dongne/contact                문의
/dongne/og/[gameNo]            OG 이미지 라우트 (화면 아님, 카톡 미리보기 asset)
```

계층 깊이: 홈(게임) 기준 어느 화면이든 **2단계 이내**. 하단 탭바 없음. 모든 막다른 화면은 "오늘 문제 풀러 가기 →" 복귀 CTA 필수.

### 1-2. 네비게이션 규칙

- **헤더(전 화면 공통, 48px)**: 좌 = 워드마크 "동네고수" + 회차 배지 "#123" / 우 = **"아카이브" 텍스트 링크**. 다크토글·아이콘버튼 없음(F5).
- 게임→결과는 같은 페이지 아코디언 확장. **결과 확장은 브라우저 히스토리 스택을 쌓지 않는다**(뒤로가기 시 앱 이탈 방지, 방향서 R3).
- about/privacy/contact = 헤더 미노출. 결과 카드 하단·아카이브 하단 **푸터 텍스트 링크**로만 진입.
- 아카이브 상세 → 오늘 게임 복귀는 일반 링크 네비게이션(히스토리 정상).

### 1-3. 화면당 핵심 액션 1개

| 화면 | 핵심 액션 |
|---|---|
| `/dongne` 진행 중 | 지명 추측 제출(2탭) |
| `/dongne` 완료 후(인라인) | 결과 복사 |
| `/dongne/archive` | 회차 선택 |
| `/dongne/archive/[gameNo]` | 오늘 게임 복귀 |
| 정적/차단 화면 | 오늘 게임 복귀 |

---

## 2. 핵심 사용자 플로우

### A. 첫 방문 게임 플로우

```
카톡 링크 진입 → /dongne
→ localStorage 조회: dongne:state:{gameNo} 없음 → 신규 플레이
→ (온보딩 dismiss 기록 없음) 규칙 스트립 인라인 노출 → [시작하기] 탭 → dismiss 기록
→ 실루엣 온디맨드 fetch: silhouettes/{today.code}.json → 프레임 카드 렌더
→ 시도 리스트 6행 고정 스켈레톤 표시(1행 active, 2~6행 컴팩트 플레이스홀더)
→ 입력창 탭 → (네이티브 scroll-into-view) → 자동완성 드롭다운 위로 오픈
→ 리스트 항목 선택(자유 텍스트 제출 불가) → [추측하기] 버튼 활성 → 탭(2탭째=제출)
    오답 → active 행이 풀 렌더로 전환(거리·방위·근접도), 다음 행 active
    정답 → 해당 행 "🎯 정답!"로 대체 → 이후 행 숨김 → 결과 카드 아코디언 확장(플로우 B)
    6행 소진 & 오답 → 실패 상태: 정답 공개 + 해설 CTA
```

### B. 결과·공유 플로우 (성공 기준)

```
정답 확정
→ 시도 행 "🎯 정답!" 전환(마이크로 스탬프 팝인)
→ 결과 카드 slide-down 확장 + scrollIntoView(카드 상단 뷰포트 진입)
   구성 순서(고정):
     1) "🎉 {N}/6 만에 맞혔어요!" 헤드라인
     2) 🔥 플레이 스트릭 {N}일 (최고 {M}일)  — 항상
     3) 🏅 "우리 동네" 실링 뱃지 — 조건부(등록됨 & 정답==내동네) / 미등록이면 유도 카드
     4) [결과 복사하기 📋]  — 1차, 항상
     5) [공유하기]  — navigator.share 지원 기기만 라벨 교체 병행
     6) 다음 문제까지 HH:MM:SS 카운트다운
     7) "어제 정답 알아보기 →"  — /dongne/archive/{gameNo-1} 직행(우선순위 높음)
     8) "내 통계 보기 (펼치기 ▾)"  — 인라인 아코디언, 기본 접힘
     9) 푸터 텍스트 링크(소개·개인정보·문의)
→ [결과 복사하기] 탭 → 기획서 §6 공유 텍스트 클립보드 복사 → 버튼 라벨 "복사됨 ✓"(2초) + aria-live
```

### C. 재방문 플로우 (같은 gameNo 재진입)

```
/dongne → dongne:state:{gameNo} 조회
  완료(성공) → 온보딩·입력 UI 전부 스킵, 시도 기록 + 결과 카드 즉시 렌더 (재도전 UI 미노출)
  완료(실패) → 실패 결과 카드 즉시 렌더
  진행중(예 3/6) → 시도 1~3행 복원 + 4행부터 재개 (온보딩 재노출 안 함)
  없음 → 플로우 A
→ 완료 상태여도 카운트다운·공유·어제해설·통계 CTA 전부 생존(막다른 화면 금지)
```

### D. 아카이브 해설 플로우

```
/dongne/archive → 회차 목록(오늘 제외) → 회차 탭
→ /dongne/archive/[gameNo] (SSG): 브레드크럼 → 헤더블록 → 히어로 실루엣(풀필) →
   스탯카드 → 본문 1,500자+ → 애드센스 슬롯 → CTA "오늘 문제 풀러가기" → 회차 페이지네이션 → 푸터
```

---

## 3. 디자인 토큰 (전체)

전부 `.dn-shell` 스코프 CSS 변수. 전역 `:root` 오염 금지. `color-scheme: light` 강제(다크모드 없음).

### 3-1. 컬러

```css
.dn-shell {
  color-scheme: light;

  /* Base — 웜 페이퍼 */
  --dn-bg: #F6EFDF;             /* 페이지 배경(크림 갱지) */
  --dn-bg-deep: #EFE5CE;        /* 섹션 구분·카운트다운/거리셀 배경 */
  --dn-surface: #FFFDF6;        /* 카드 표면 */
  --dn-surface-raised: #FFFFFF; /* 드롭다운 등 최상위 표면 */
  --dn-border: #E2D5B8;         /* 헤어라인 */
  --dn-border-strong: #C9B98D;

  --dn-ink: #2B2419;            /* 최상위 텍스트, 실루엣 기본 필 */
  --dn-body: #4E4433;           /* 본문(해설 장문 포함) */
  --dn-muted: #8A7C5E;          /* 보조·캡션·상위 플레이스홀더 */
  --dn-placeholder: #B3A489;

  /* Brand — 나침반 테라코타 */
  --dn-primary: #BF4C2C;
  --dn-primary-ink: #FFFFFF;
  --dn-primary-dark: #963A20;
  --dn-primary-soft: #F6DDD1;

  /* Secondary — 아틀라스 틸(링크·정보) */
  --dn-teal: #2C6E68;
  --dn-teal-soft: #DCEBE7;

  /* 실링 골드 — "우리 동네" 뱃지 전용 */
  --dn-seal-gold-light: #E8C77A;
  --dn-seal-gold: #B8863B;
  --dn-seal-gold-dark: #7C5A28;

  /* 근접도 램프(색맹 안전: 청→샌드→주홍, 적록 페어 회피)
     ⚠ 온스크린 칩·바 전용. 공유 텍스트 문자열엔 절대 사용 금지 */
  --dn-prox-1: #3D6E96;  --dn-prox-1-bg: #E4EBF1;  /* 0–19% 매우 멂 */
  --dn-prox-2: #7B93A8;  --dn-prox-2-bg: #EAEEF1;  /* 20–39% 먼 편 */
  --dn-prox-3: #B39A66;  --dn-prox-3-bg: #F1EADA;  /* 40–59% 중간(샌드·중립축) */
  --dn-prox-4: #D3812F;  --dn-prox-4-bg: #FBEBDA;  /* 60–79% 가까움 */
  --dn-prox-5: #C24E2E;  --dn-prox-5-bg: #F8DFD5;  /* 80–99% 매우 가까움 */
  --dn-prox-correct: #3A7D5C;  --dn-prox-correct-bg: #E3EFE7; /* 100% 정답(램프 밖, 🎯 병행 필수) */

  /* Semantic */
  --dn-success: #3A7D5C;  --dn-success-bg: #E3EFE7;
  --dn-warning: #C97F1D;  --dn-warning-bg: #FBEEDA;  /* 스트릭 위험 넛지 */
  --dn-error:   #A6402D;  --dn-error-bg:   #F5DFD8;  /* 폼 검증, 매우 제한적 */
  --dn-info: var(--dn-teal);  --dn-info-bg: var(--dn-teal-soft);

  /* 실루엣 프레젠테이션 */
  --dn-silhouette-fill: var(--dn-ink);              /* 미해결 — 잉크 스탬프 */
  --dn-silhouette-frame-bg: var(--dn-surface);
  --dn-silhouette-graticule: rgba(43,36,25,0.05);   /* 장식 격자 5% */
  --dn-silhouette-reveal-correct: var(--dn-success);
  --dn-silhouette-reveal-fail: #A08F63;             /* 6패 — 올리브그레이(에러색 아님) */

  /* Shadow — 도장 눌린 느낌 */
  --dn-shadow-sm: 0 1px 2px rgba(43,36,25,0.08);
  --dn-shadow-md: 0 4px 12px rgba(43,36,25,0.12);
  --dn-shadow-stamp: 0 2px 0 rgba(43,36,25,0.10), 0 10px 22px rgba(43,36,25,0.14);

  /* Radius */
  --dn-radius-sm: 6px;  --dn-radius-md: 10px;  --dn-radius-lg: 16px;
  --dn-radius-frame: 12px;  --dn-radius-full: 999px;

  /* Spacing(4px 배수) */
  --dn-space-1: 4px;  --dn-space-2: 8px;  --dn-space-3: 12px;
  --dn-space-4: 16px; --dn-space-5: 20px; --dn-space-6: 24px;
  --dn-space-8: 32px; --dn-space-10: 40px; --dn-space-12: 48px;
}
```

**색 사용 불변 규칙**: ① 근접도 색은 화면 시도 행 칩/바에만. 공유 텍스트 포매터 함수는 색 토큰을 import조차 하지 않는 별도 모듈. ② 모든 근접도 표현은 `%숫자 + 채움 바`(이중 인코딩) 필수 — 색 단독 정보 전달 금지(WCAG 1.4.1). ③ 정답색(`--dn-prox-correct`)은 반드시 🎯/"정답!" 텍스트 동반.

### 3-2. 타이포그래피

```css
.dn-shell {
  --dn-font-display: "Black Han Sans", "Pretendard Variable", system-ui, sans-serif;
  --dn-font-body: -apple-system, BlinkMacSystemFont, "Pretendard Variable", "Malgun Gothic", system-ui, sans-serif;
}
```

| 토큰 | 크기 / 행간 / 굵기 | 용도 |
|---|---|---|
| `--dn-text-hero` | 30px / 1.24 / 800 (모바일) → 38px(데스크톱) | 워드마크, 결과 헤드라인 |
| `--dn-text-h1` | 22px / 1.3 / 800 | 해설 제목, 섹션 타이틀 |
| `--dn-text-h2` | 17px / 1.4 / 700 | 카드 소제목, 해설 H2 |
| `--dn-text-body` | 15.5px / **1.78** / 400 | 해설 장문 본문 |
| `--dn-text-body-sm` | 13px / 1.6 / 400 | 캡션·메타·자동완성 보조 라벨 |
| `--dn-text-label` | 11.5px / 1.3 / 700, ls 0.03em | 배지·eyebrow 라벨 |
| `--dn-text-mono-num` | 15px, `font-variant-numeric: tabular-nums`, 700 | 거리km·근접도%·카운트다운·스트릭 |
| `--dn-text-guess-name` | 15px / 1.4 / 600 | 시도 행 추측 지역명 |

- `--dn-font-display`(Black Han Sans)는 **워드마크·회차번호·결과 헤드라인·OG 텍스트에만**. 자동완성·본문·시도 행은 전부 `--dn-font-body`(로딩비용 0).
- 숫자는 전부 `tabular-nums`(거리·근접도·카운트다운·스트릭 — 자릿수 변화에도 레이아웃 안정, 기획서 §3-1 "자릿수 정렬" 요구 충족).

### 3-3. 스페이싱·그리드·모양

- 기본 단위 4px, 실사용 8px 배수.
- 모바일 좌우 패딩 **16px**(단일 라인 시도 행 여유 확보).
- 최대 폭 `max-width: 480px` 중앙 정렬. **예외**: 아카이브 해설 본문만 `≥480px`에서 `max-width: 640px`.
- 카드 내부 패딩 16px(기본) / 실루엣 프레임 20px(모바일)·24px(≥480px).
- Radius: 버튼·인풋 10px(md) / 카드·드롭다운 16px(lg) / 실루엣 프레임 12px / 배지·칩·실링 full.
- Shadow: 리스트 행 sm / 드롭다운 md / 실루엣 프레임·실링 뱃지 stamp(2단 눌림감).

---

## 4. 컴포넌트 목록 — 스펙 & 상태

각 컴포넌트의 상태를 기본/포커스/에러/완료 축으로 명시. 터치 타깃 전부 ≥44×44px, 인접 요소 ≥8px.

### 4-1. 헤더 (전 화면 공통)

- 높이 **48px content + `padding-top: env(safe-area-inset-top)`**, `position: sticky; top: 0`, 배경 `--dn-bg`, 하단 `1px solid --dn-border`.
- 좌: 워드마크 "동네고수"(`--dn-font-display` 20px `--dn-ink`) + 회차 배지 "#123"(pill, `--dn-primary` 배경, 흰 텍스트, 11px 700, 패딩 2px 8px).
- 우: "아카이브" 텍스트 링크(`--dn-text-body-sm` 700, `--dn-teal`, 탭 타깃 44px 확보). 아카이브/정적/해설 화면에서는 좌측이 "← 뒤로/동네고수"로 대체.

### 4-2. 온보딩 스트립 (신규·인라인, 모달 아님)

- 최초 방문(dismiss 기록 없음) 시 헤더 아래 인라인 노출. 배경 `--dn-primary-soft`, 좌측 4px `--dn-primary` 액센트 바, radius-md, 패딩 16px.
- 문구(3줄): "누구나 6번 안에!" (H2) / "① 오늘의 동네 실루엣 1개  ② 6번 안에 지명 맞히기  ③ 오답마다 거리·방향·근접도 힌트" (body-sm).
- 우하단 [시작하기] Ghost 버튼 → 탭 시 `localStorage['dongne:onboarded']=1` 기록 후 스트립 제거. localStorage 불가 시 세션당 1회만 노출.
- **상태**: 기본(노출) / 완료(dismiss 후 영구 미노출). 에러·포커스 없음.

### 4-3. 실루엣 프레임 카드

- 정사각(1:1), 폭 **min(100%, 320px)** 모바일 / **360px** ≥480px(F10). 카드 배경 `--dn-silhouette-frame-bg`, `border 1.5px solid --dn-border`, radius-frame, shadow-stamp. 내부 패딩 20px(모바일)/24px(≥480px).
- 배경: 프레임 내부 한정 장식 그래티큘 — `--dn-silhouette-graticule` 1px, 32px 균등 격자(진짜 위경도 아님, 위치 암시 금지). `repeating-linear-gradient` 또는 인라인 SVG `<pattern>` 중 프론트 선택.
- 실루엣 SVG는 데이터 파이프라인이 이미 정북고정·미러금지·fit-to-frame 88% 처리. UI는 위 프레임/여백만 추가. 좌우 스크롤·줌 없음.

**상태**
| 상태 | 필 색 | 애니메이션 | 부가 |
|---|---|---|---|
| 로딩 | — | 스켈레톤(펄스 shimmer) | alt="오늘의 동네 실루엣" |
| 에러(fetch 실패) | — | 없음 | "실루엣을 불러오지 못했어요 [다시 시도]" 인라인. 게임(자동완성)은 실루엣 없이도 진행 가능(완전 블로킹 금지) |
| 미해결(진행중) | `--dn-silhouette-fill`(잉크) | 없음 | `<title>`/`aria-label`에 지역명 렌더 금지(스포 방지) |
| 정답 공개 | → `--dn-silhouette-reveal-correct` 400ms crossfade | scale(1→1.04→1) 300ms ease-out-back + 라벨 슬라이드업 | "정답!" 스탬프 -8deg 팝인 `cubic-bezier(.34,1.56,.64,1)` |
| 실패 공개 | → `--dn-silhouette-reveal-fail` 600ms crossfade(느리게) | scale 없음, 라벨만 페이드인 | "정답은 OO였어요" + "내일 '어제의 동네'에서 만나요"(해설 링크 미렌더 — 오늘 회차 해설 없음) |

- `prefers-reduced-motion: reduce` → 스케일·회전 생략, crossfade 0.01ms(즉시 최종값). `dongne.css`에 스코프 keyframe별로 명시 재작성.

### 4-4. 자동완성 인풋 + 드롭다운 (2탭 제출 확정)

**인풋**
- 높이 48px, radius-md, `border 1.5px solid --dn-border-strong`, 배경 `--dn-surface`, 좌측 검색/맵핀 아이콘 18px(x=12px). **폰트 16px 고정**(iOS 자동확대 방지). placeholder "동네 이름을 입력하세요 (예: 해운대구)" `--dn-placeholder`.
- **non-sticky**(F9): 포커스 시 네이티브 scroll-into-view에 의존. 하단 고정 안 함.

**드롭다운(F1·F2)**
- **입력창 위로 오픈 기본**. 위 가용공간 < 180px면 아래로 폴백. `max-height: 240px` 스크롤, **최대 6개 결과만**, 배경 `--dn-surface-raised`, `border 1px --dn-border`, radius-md, shadow-md.
- 옵션 행: min-height 44px, 패딩 10px 14px. 좌 = 지역명(매칭 부분문자열 `--dn-primary` 볼드), 우 = **동명 지역이면 `(시도)` 배지 항상 병기**(pill, 배경 `--dn-bg-deep`, `--dn-muted`, 11px, radius-full).
- 입력 1글자부터 매칭(디바운스 ~150ms), 이름+별칭 매칭("강남"→강남구).
- **선택 = 입력창에 확정 채움 + [추측하기] 활성화**(제출 아님). 자유 텍스트 상태로는 제출 불가.

**인풋/드롭다운 상태**
| 상태 | 표현 |
|---|---|
| 기본 | border `--dn-border-strong` |
| 포커스 | border `--dn-primary` + `box-shadow: 0 0 0 3px rgba(191,76,44,.18)`(테라코타 링) |
| 드롭다운 옵션 하이라이트(↑↓) | 행 배경 `--dn-primary-soft` |
| 옵션 선택됨 | 인풋에 지명 채움 + 우측 ✕(초기화), [추측하기] 활성 |
| 중복(이미 추측) 옵션 | 옵션 행 opacity 0.45, "이미 추측함" 캡션(강제 차단 아님) |
| 에러(결과 0건) | 드롭다운 자리 "일치하는 동네가 없어요" 빈 상태 텍스트(`--dn-muted`, 붉은색·에러음 금지), 제출 버튼 비활성 유지 |

### 4-5. [추측하기] 버튼 (2탭째=제출)

- 풀폭, 높이 50px, radius-md. **활성**: 배경 `--dn-primary`, 흰 텍스트, shadow-sm. **비활성(선택 전)**: 배경 `--dn-bg-deep`, 텍스트 `--dn-placeholder`, `pointer-events` 유지하되 no-op. **pressed**: `--dn-primary-dark`.
- 제출 성공 시 인풋+버튼은 다음 시도용으로 초기화(정답/실패면 인라인 결과 블록으로 교체, 페이지 이동 없음).

### 4-6. 시도 리스트 (6행 고정 스켈레톤·단일 라인·최신 아래로)

리스트 상단에 **1회성 컬럼 라벨 eyebrow**: "거리 · 방향 · 근접도"(`--dn-text-label`, `--dn-muted`, 우측 정렬 그룹 위). 첫 플레이 명료성 확보(F7 라벨 비용 대체).

**플레이 완료 행(단일 라인, min-height 44px)** — CSS grid:
```
grid: [chip 24px] [name 1fr] [dist auto] [dir auto] [prox auto];  gap 8px; align-items:center;
행 컨테이너: 배경 --dn-surface, border 1px --dn-border, radius-md, margin-bottom 8px, 패딩 8px 12px;
행 하단 근접도 바: 행 하단 3px 라인, width = 근접도%, color --dn-prox-N (이중 인코딩)
```
- chip: 순번 원형칩 22px(진행 번호).
- name: 추측 지역명(`--dn-text-guess-name`), 동명이면 "(시도)" 인라인 병기.
- dist: `{정수}km`(`--dn-text-mono-num`, 우측정렬 tabular).
- dir: 8방위 화살표 아이콘(중립 `--dn-ink`, **방향은 색으로 구분 안 함**) + 방위 축약("북동").
- prox: `{%}`(`--dn-text-mono-num`, 색 `--dn-prox-N`).

**미플레이 행(컴팩트 플레이스홀더, height 28px)**: 순번칩(옅게) + "입력 대기"(`--dn-placeholder`, active 행만 표시). 배경 없음, 얇은 점선 border.

**행 상태**
| 상태 | 표현 |
|---|---|
| 미플레이(대기) | 컴팩트 플레이스홀더, 순번 옅게 |
| active(현재 차례) | 좌측 3px `--dn-primary` 액센트 바 + "입력 대기" 강조 |
| 완료(오답) | 풀 단일라인 렌더 + 하단 근접도 바 |
| 정답 | 3셀 대신 풀폭 "🎯 정답!"(배경 `--dn-success-bg`, 텍스트 `--dn-success` 볼드, border `--dn-success`). 이후 행 숨김 |
| 실패공개(6행 소진) | 6행 아래 "정답: OO"(§4-3 실루엣 실패공개와 동기) |

- 신규 완료 행 전환 시 slide-up + fade-in 220ms, `scrollIntoView({behavior:'smooth', block:'nearest'})`. 각 완료 행에 `aria-live="polite"`로 "1번째 시도, 182킬로미터, 북동쪽, 근접도 41퍼센트" 낭독(색 아닌 숫자 텍스트 병기).

### 4-7. 결과 카드 (인라인 아코디언)

성공/실패 공통 컨테이너: 시도 리스트 아래 slide-down 확장(200~250ms ease-out). 배경 `--dn-surface`, border `--dn-border`, radius-lg, 패딩 16px. 과한 컨페티·사운드 금지.

- **성공 헤드라인**: "🎉 {N}/6 만에 맞혔어요!"(`--dn-text-hero`).
- **실패 헤드라인**: "6/6 — 아쉬워요! 정답은 {지역명}였어요"(비난조 금지). 실패 시에만 정답 지명·실루엣 공개.
- 구성 순서는 §2-B 1~9 고정.

### 4-8. 스트릭 (칩 + 결과 라벨)

- **결과 카드 라벨(F11)**: "🔥 플레이 스트릭 {N}일 (최고 {M}일)". 보조 캡션 "플레이하면 이어져요(정답 못 맞혀도 유지)"(`--dn-text-body-sm`, `--dn-muted`).
- **스트릭 칩(컴팩트)**: pill height 28px, 패딩 4px 10px 4px 8px, 배경 `linear-gradient(135deg, --dn-primary-soft, #FBEEDA)`, 🔥 14px `--dn-primary`, 숫자 `--dn-text-mono-num` 13px `--dn-ink` + "일".
- **끊김/0일 상태**: 회색 다운그레이드(`--dn-muted` 배경, 아이콘 흑백)로 위험/끊김 구분.

### 4-9. "우리 동네" 실링 뱃지 (왁스 인장)

```
원형 메달 지름 64px(결과)/40px(축약)
배경 radial-gradient(circle at 35% 30%, --dn-seal-gold-light, --dn-seal-gold 55%, --dn-seal-gold-dark 100%)
음각: inset 0 2px 3px rgba(255,255,255,.4), inset 0 -2px 4px rgba(0,0,0,.35)
그림자 --dn-shadow-stamp, rotate(-6deg)
중앙 집/맵핀 글리프 20px --dn-ink, 둘레 곡선 텍스트 "우리 동네"(9px, ls .05em; 구현 부담 시 상단 고정 배지 텍스트로 대체 가능)
옆 카피 "오늘 정답이 우리 동네였음 ㅋㅋ"(--dn-text-body 볼드 --dn-primary-dark)
실패 케이스 변형 카피 "오늘 정답이 우리 동네였는데 못 맞혔어요 ㅠㅠ"
```
**상태**
| 상태 | 표현 |
|---|---|
| 등록됨 & 정답==내동네 | 실링 뱃지 + 자랑 카피 노출 |
| 등록됨 & 불일치 | 뱃지 영역 자체 미렌더(빈 공간 방치 금지 — 카드 높이 튐 없이 접힘) |
| 미등록(첫 결과 도달) | **유도 카드**: "내 동네를 등록하면 정답 일치 시 뱃지를 받아요 [내 동네 설정 →]" → 탭 시 §4-4 자동완성 인라인 오픈(동명 배지 규칙 동일) → 저장. 건너뛰기 가능(비차단) |
- 뱃지·유도는 **정답 확정 이후에만** 계산·렌더(진행 중 노출=정답 유출, 절대 금지). 재설정: 결과/헤더 근처 "내 동네 변경" 텍스트 링크.

### 4-10. 카운트다운 칩

- pill, 배경 `--dn-bg-deep`, radius-full, 패딩 6px 12px. 시계 아이콘 14px `--dn-muted` + "다음 문제까지 HH:MM:SS"(`--dn-text-mono-num` 13px `--dn-muted`).
- 계산은 **`src/lib/dongne/queue.ts` KST 고정 UTC+9 산술 재사용**(로컬 타임존/`toLocaleString`·별도 시간 로직 금지). `setInterval` 1초, `visibilitychange` 숨김 시 정지·복귀 시 큐 모듈로 재계산 리싱크(드리프트·자정넘김 방지). 독립 컴포넌트로 격리(리렌더 최소화).
- 진행 중에는 강조 안 함. 완료 후 결과 카드·아카이브 CTA 근처 배치.

### 4-11. 통계 히스토그램 (신규·인라인 아코디언, 모달 아님 — F4)

- 결과 카드 "내 통계 보기 (펼치기 ▾)" 탭 시 인라인 확장(모달 금지). 상단 요약 3칩: 총 플레이 · 승률% · 현재/최고 스트릭(전부 tabular).
- 분포 바 차트: 1~6 + 실패, 7개 가로 막대. 각 행 = 라벨(1~6/실패) + 막대(width=해당 횟수/최대값 비율, 배경 `--dn-bg-deep`, fill `--dn-primary`) + 우측 카운트 숫자.
- **오늘 결과 막대만 하이라이트**(fill `--dn-primary-dark`), 나머지 `--dn-primary`. localStorage 불가 시 이 섹션 자체 비노출.

### 4-12. 스트릭 위험 넛지 배너 (신규·인라인, 웹푸시 없음)

- 조건: 오늘 미플레이 & streak>0 & KST ≥21:00 → `/dongne` 진입 시 게임 영역 상단 인라인 배너(스크롤로 밀림, 모달 금지).
- 배경 `--dn-warning-bg`, 좌측 3px `--dn-warning` 바, radius-md, 패딩 12px 14px. 🔥 아이콘 `--dn-warning`. 문구 "🔥 스트릭 {N}일째! 자정 전에 오늘 문제를 풀어야 이어져요" + 자정까지 남은 시간(카운트다운 재사용). 우측 ✕(세션 dismiss). 경고성이되 공격적이지 않은 톤.
- **상태**: 노출(조건 충족) / dismiss(세션 한정, 다음 방문 재평가).

### 4-13. localStorage 불가 안내 (신규·1회성 비차단)

- 기능 감지 실패 시 결과 화면에 1회 인라인 노티스: "이 브라우저에서는 기록이 저장되지 않아요"(`--dn-info-bg` 배경, `--dn-teal` 텍스트, radius-md, ✕ 닫기). 세션당 1회. 에러색·모달 금지. 게임 자체는 세션 메모리로 정상 플레이(새로고침 시 초기화 = 허용 가능 저하).

### 4-14. 공유 버튼 (복사 1차 + Web Share 병행 — F3)

- **1차(항상)**: "결과 복사하기 📋" 풀폭, 높이 50px, `--dn-primary` 배경 흰 텍스트, radius-md, shadow-sm, 좌측 클립보드 아이콘.
- 탭 → `navigator.clipboard.writeText(공유텍스트)` → **버튼 라벨 "복사됨 ✓"(2초 후 원복)** + `aria-live="polite"` "복사되었습니다". **토스트 미사용**(F3).
- **2차(navigator.share 지원 기기만)**: 라벨 "공유하기"로 교체, Web Share Sheet 트리거(같은 텍스트+URL). 미지원 시 자동 클립보드 폴백(분기 UI 없음, 라벨만 조건부).
- 공유 텍스트 조립 모듈은 근접도 색 토큰과 물리적으로 분리(색블록 유출 원천 차단).

### 4-15. 공용 요소

- **버튼**: Primary(`--dn-primary` 배경·흰 텍스트·height 50·radius-md) / Secondary(흰 배경 + `--dn-border-strong` 테두리) / Ghost(배경 없음·`--dn-body`·hover underline). 포커스 시 `focus-visible` 아웃라인 `0 0 0 3px rgba(191,76,44,.18)`.
- **CTA 카드**("오늘 문제 풀러가기 →" 등): 배경 `--dn-primary-soft`, border `--dn-primary`, radius-lg, 풀폭.
- **텍스트 링크**: `--dn-teal`, hover underline.
- **safe-area 하단**: `padding-bottom: env(safe-area-inset-bottom, 0px)`. 공유 버튼·CTA는 sticky/fixed 금지, 인라인 배치(F9).

---

## 5. 화면별 최종 레이아웃

### 5-1. `/dongne` — 최초 방문(온보딩)
```
[헤더 48px] 동네고수 #123           아카이브
[온보딩 스트립] 누구나 6번 안에! ①②③  [시작하기]
[실루엣 프레임 카드]  (그래티큘 배경 · 잉크 실루엣)
[시도 리스트] eyebrow "거리·방향·근접도"
             1 active / 2~6 컴팩트 플레이스홀더
[자동완성 인풋]  "동네 이름을 입력하세요 (예: 해운대구)" 🔍
```

### 5-2. `/dongne` — 입력 중(드롭다운 위로 오픈)
```
  ▲ 고성군 (강원)
  ▲ 고성군 (경남)
  ▲ 고양시 (경기)          ← 입력창 위로 오픈, 최대 6개
[인풋: 고성군(강원)  ✕]
[ 추측하기 ]              ← 선택 전 비활성
```

### 5-3. `/dongne` — 진행 중(2시도 완료)
```
[헤더] [실루엣 프레임]
1  고성군(강원)   182km  ↗북동  41%   ← 하단 근접도 바
2  인제군          67km  ↘남동  78%
3  ▎입력 대기                          ← active
4 · 5 · 6  (컴팩트)
[인풋] [추측하기]
```

### 5-4. `/dongne` — 결과 확장(성공·우리 동네 뱃지)
```
3  양구군            🎯 정답!
──────────────
🎉 3/6 만에 맞혔어요!
🔥 플레이 스트릭 5일 (최고 8일)
🏅 [실링 뱃지] 오늘 정답이 우리 동네였음 ㅋㅋ    ← 조건부
[ 결과 복사하기 📋 ]
[ 공유하기 ]  (지원 기기만)
🕐 다음 문제까지 07:12:45
어제 정답 알아보기 →
내 통계 보기 (펼치기 ▾)
소개 · 개인정보 · 문의
```

### 5-5. `/dongne` — 결과 확장(실패 6/6)
```
6  완주             6/6 😢
──────────────
아쉬워요! 정답은 강릉시였어요
[ 실루엣(확정·올리브그레이) ] 강릉시
[ 결과 복사하기 📋 ]
🕐 다음 문제까지 03:02:10
강릉시 이야기 읽어보기 →   (어제 회차면 활성 / 오늘 회차면 "내일 만나요")
소개 · 개인정보 · 문의
```

### 5-6. `/dongne/archive` — 목록
```
[헤더] ← 동네고수 아카이브
#122   7/16   강릉시
#121   7/15   고성군(경남)
#120   7/14   인제군
 ...
오늘(#123) 문제 풀러 가기 →    ← 오늘 회차는 목록 제외(스포 방지)
```
- 행: 회차(pill) + 날짜(tabular `--dn-text-body-sm`) + 정답 지역명(`시군구명(시도)`). min-height 48px, 하단 `--dn-border` 헤어라인, 탭 전체가 링크.

### 5-7. `/dongne/archive/[gameNo]` — 어제의 동네 해설
```
동네고수 › 아카이브 › #122                    (브레드크럼)
[eyebrow "어제의 동네"] H1 "강릉시는 어떤 동네였을까?"
#122 · 2026-07-16 · 강릉시(강원)               (메타)
[ 히어로 실루엣(풀필) ] 강릉시
[스탯 2×2] 인구 21.3만 · 면적 1,040㎢ · 소속 강원 · #122
(본문 1,500자+ · 개요/유래/특산물·랜드마크/오늘 문제였다면)
[애드센스 슬롯 ①]  … 첫 문단 직후
…
[애드센스 슬롯 ②]  … 본문 종료 후
[ CTA 카드: 오늘의 문제 풀러가기 → ]
‹ #121        #123 ›   (다음이 오늘이면 비활성 + "아직 공개 전")
소개 · 개인정보 · 문의
```
- 본문 `--dn-text-body`(1.78 행간, `--dn-body` 웜 브라운블랙), 문단 간격 20px, H2 섹션 구분. 본문만 `≥480px`에서 max-width 640px.
- 헤딩은 실제 `<h1>`/`<h2>` 시맨틱 태그(백엔드 JSON-LD가 활용).
- 애드센스 슬롯: 본문과 24px 여백 + `1px --dn-border` 구분선 + "광고" 라벨 유지.
- **선택(nice-to-have, D2 후반·데이터 여력 시)**: 미니 국가 로케이터에 해당 지역 점 하이라이트(자체 실루엣 데이터, 신규 저작권 0). 필수 아님.

### 5-8. `/dongne/archive/[gameNo]` — 미래/오늘 차단(친화적)
```
아직 공개되지 않은 회차예요
(오늘 회차면) 오늘 문제는 아직 진행 중이에요!
[ 오늘 문제 풀러 가기 → ]
```
- SSG가 오늘 미만만 생성 → 정적 404. URL 직접 조작 대비 일반 404 대신 이 안내 화면. 복귀 CTA 필수.

### 5-9. `/dongne/about · privacy · contact` — 정적 공통
```
[헤더] ← 동네고수
(제목 H1)
(본문 단일 컬럼 --dn-text-body)
[ 오늘 문제 풀러 가기 → ]
소개 · 개인정보 · 문의
```

---

## 6. 공유 텍스트 — 최종 포맷 (색블록 절대 금지)

온스크린 색과 물리적으로 분리된 포매터 모듈이 생성. **정답 지역명·색블록·이모지 색타일 절대 미포함**(스포일러 프리 + 트레이드드레스 회피).

**성공:**
```
동네고수 #123
3/6 🎯
1️⃣ 182km ↗ 41%
2️⃣ 67km ↘ 78%
3️⃣ 정답!
🔥 스트릭 5일
▶ project-orsrw.vercel.app/dongne
```

**실패(6/6):**
```
동네고수 #123
6/6 😢
1️⃣ 182km ↗ 41%
2️⃣ 67km ↘ 78%
3️⃣ 210km ↖ 33%
4️⃣ 88km ← 71%
5️⃣ 45km ↙ 85%
6️⃣ 31km ↑ 90%
🔥 스트릭 5일
▶ project-orsrw.vercel.app/dongne
```

규칙:
- 1행 = `동네고수 #{gameNo}`. 2행 = 성공 `{N}/6 🎯` / 실패 `6/6 😢`.
- 시도 행 = `{번호이모지} {거리}km {방위화살표} {근접도}%`. 정답 행만 `{번호이모지} 정답!`(지명 없음).
- 방위 화살표: N↑ NE↗ E→ SE↘ S↓ SW↙ W← NW↖ (텍스트 화살표 = 색타일 아님, 안전).
- 스트릭 행 = `🔥 스트릭 {N}일`(플레이 스트릭이지만 공유엔 짧게).
- 마지막 = `▶ project-orsrw.vercel.app/dongne` (자체도메인 이전 후 `dongne.kr` 교체).
- `navigator.clipboard.writeText` 1차 + `navigator.share` 병행(둘 다 이 문자열 그대로 사용).

---

## 7. OG 카드 — 최종 스펙 (1200×630, 스포일러-프리 티저)

- 구현: office-archetype `og/[typeSlug]/route.tsx`의 `ImageResponse`/`runtime="edge"` 이식(방향서 C1). 캔버스만 **1200×630(1.91:1)** 조정(표준 링크 언퍼널링 — 카톡/FB/트위터/슬랙 최광 호환).
- 라우트 `/dongne/og/[gameNo]` — 회차 URL로 카톡 캐시 날짜별 자동 갱신(캐시버스터 불필요).

**스포일러 방지(렌더 최우선 제약)**
- OG는 `manifest.json`의 정답 `name`/`centroid`를 **절대 읽지 않는다**. 실루엣 `path`(형태)만 사용.
- 실루엣은 **채움 없이 윤곽선만**(stroke-only): stroke `--dn-ink` 30% 불투명, stroke-width 3, `stroke-dasharray: 6 4`, fill none, -4deg 회전 + 위에 거대 "?" 오버레이(Black Han Sans 220px, `--dn-primary-soft` 55%).
- `og:image:alt` 일반문만("동네고수 #123 — 오늘의 동네 실루엣 퀴즈"), 지역명 금지.

**레이아웃(1200×630 절대 좌표)**
| 영역 | x, y, w, h | 내용 |
|---|---|---|
| 배경 | 0,0,1200,630 | `linear-gradient(135deg, --dn-bg, --dn-bg-deep)` + 그래티큘 32px 5% 오버레이 |
| 세이프존 | 상하좌우 ≥64px | 카톡/FB/트위터 크롭 대응 |
| Eyebrow | 64, 72 | "매일 만나는 대한민국 동네 실루엣 퀴즈" 20px 700 `--dn-muted` ls .02em |
| 워드마크 | 64, 130 | "동네고수" display 80px 800 `--dn-ink` |
| 회차 배지 | 워드마크 우 +20px, baseline 정렬 | "#123" pill, `--dn-primary` 배경 흰 텍스트 28px 800, 패딩 8px 20px |
| 태그라인 | 64, 250, w620 | "6번 안에 대한민국 동네 실루엣 맞히기" 34px 500 `--dn-body` |
| 실루엣 티저 | center x≈900 y≈310, 360×360 | 윤곽선만(위 규칙) |
| "?" 오버레이 | 실루엣 중앙 | display "?" 220px `--dn-primary-soft` 55% |
| 하단 CTA 바 | 0,538,1200,92 | `--dn-primary` 풀폭, 흰 텍스트 "6번 안에 맞혀보세요 → project-orsrw.vercel.app/dongne" 28px 700 중앙 |

- 워드마크·회차·CTA = Black Han Sans(edge 런타임 폰트 바이너리 주입 필요). Eyebrow·태그라인 = 시스템 sans 폴백. **폰트 미확보 리스크(§9-오픈이슈): 폴백 시 좌표 불변, 자산 추가 시 좌표 변경 없이 적용.** PNG, `og:image` 메타 연결.

---

## 8. 반응형 규칙 (모바일 우선 · 카톡 인앱 safe-area)

- **타깃 최소폭 360px**(보급형 안드로이드), 검증 기본 375px(iPhone SE).
- **브레이크포인트**: `<480px` 풀폭·좌우 패딩 16px / `≥480px` `max-width: 480px` 중앙(아카이브 본문만 640px 예외).
- **뷰포트 높이**: `.dn-shell { min-height: 100vh; min-height: 100dvh; }`(폴백 100vh 먼저 후 100dvh override — progressive enhancement, 카톡 인앱 100vh 잘림 방지).
- **safe-area**: `.dn-shell`에 `padding: env(safe-area-inset-top/right/bottom/left)`. 헤더 `padding-top`에 inset-top 추가.
- **sticky 최소화**: 헤더만 `sticky; top:0`. **인풋·공유 버튼·CTA 전부 non-sticky 인라인**(F9 — 카톡 하단 툴바 이중 스택 방지).
- **인풋 폰트 ≥16px 고정**(iOS 자동확대 방지).
- **터치 타깃 ≥44×44px**, 인접 ≥8px.
- **가로 스크롤 금지**: 실루엣 프레임 `min(100%, 320/360px)` 캡, 시도 행은 고정 grid(360px 폭 검증 완료, §4-6).
- **가로 모드**: 별도 대응 없음, 세로 레이아웃 유지 + 세로 스크롤.

---

## 9. 프론트엔드 전달 사항 (구현 주의점)

### 필수 가드 (위반 시 치명)
1. **공유 색 경계**: 근접도 색 토큰(`--dn-prox-*`)은 온스크린 컴포넌트에만 바인딩. 공유 텍스트 포매터는 색 토큰을 import하지 않는 **물리적 별도 모듈**. §6 문자열엔 색블록·색이모지 0개.
2. **정답 렌더 금지 경계**: 정답 확정(성공/6패) 전까지 `today.name`/`today.centroid`를 DOM·`alt`·`<title>`·OG에 렌더 금지. 실루엣 컴포넌트·OG 라우트 양쪽 가드. 정답 전 alt는 "오늘의 동네 실루엣"만.
3. **queue.ts 단일 소스**: 카운트다운·gameNo·자정경계 전부 `src/lib/dongne/queue.ts` KST 고정 UTC+9 산술 재사용. `toLocaleString`/로컬 타임존/독자 시간 로직 금지.
4. **자정 스냅샷**: 진행 중 라운드는 세션 시작 시 gameNo/큐 스냅샷 고정(도중 정답 변경 불공정 방지). 새로고침·재방문 시에만 새 gameNo 전환.

### 인터랙션
5. **2탭 제출**(F1): 자동완성 리스트 선택 → [추측하기] 활성 → 탭이 제출. 자유 텍스트 제출·즉시제출 금지. 판정은 행정표준코드 일치(문자열 아님).
6. **드롭다운 위로 오픈 기본**(F2), 위 공간<180px면 아래 폴백. 최대 6개 결과.
7. **복사 피드백=버튼 라벨 전환**(F3), 토스트 미사용. `aria-live="polite"`.
8. **통계=인라인 아코디언**(F4), 모달 미사용.
9. **결과 인라인 확장은 히스토리 스택 미적재**(뒤로가기 앱 이탈 방지). 아카이브 상세→오늘 게임은 일반 네비게이션.
10. **근접도 이중 인코딩 필수**(§4-6): 색 % 숫자 + 하단 근접도 바. 색 단독 금지(WCAG 1.4.1). 방향 화살표는 색 구분 안 함.
11. **6행 고정 스켈레톤**(F8): 플레이 행 풀 렌더, 미플레이 행 컴팩트. 정답 시 이후 행 숨김.

### 접근성·모션
12. `prefers-reduced-motion: reduce` → 정답 공개 스케일·회전 스탬프 생략, crossfade만 즉시. `dongne.css` 스코프 keyframe별 명시 재작성(전역 규칙이 커스텀 keyframe에 자동 적용 안 됨 — office-archetype 선례).
13. 시도 행·복사·힌트에 `aria-live="polite"` 낭독. 모든 포커스 가능 요소 `focus-visible` 아웃라인.

### 격리·성능
14. `src/app/dongne/dongne.css` 신규 1파일, `layout.tsx`에서 import. `globals.css`/루트 `layout.tsx`/`tailwind.config.ts` **무수정**. 최상위 `<div className="dn-shell">` + `color-scheme: light`.
15. 실루엣 온디맨드 fetch(오늘 1개만). 실패 시 스켈레톤→에러 상태, 게임은 실루엣 없이도 진행 가능(완전 블로킹 금지).
16. 그래티큘은 `repeating-linear-gradient` 또는 인라인 SVG `<pattern>`(프론트 선택, 시각 동일하면 무관).

### 오픈 이슈(프론트/백엔드 확인)
17. **OG 폰트**: Black Han Sans woff/ttf를 `public/fonts/` 로컬 미포함 시 시스템 sans 폴백(office-archetype 동일 리스크). 좌표는 폰트 무관 유지 → 자산 추가 시 좌표 변경 없이 적용.
18. **미니 로케이터 맵**(§5-7): nice-to-have. D1 데이터 부하 확인 후 D2 후반 반영 여부 결정. 필수 아님.
19. **드롭다운 하단/상단 공간 판정 로직**: 실기기(갤럭시 구형·iPhone SE) 카톡 인앱에서 키보드 높이 실측 후 180px 임계 튜닝 필요.

---

## 10. 하위 스펙 반영 (모순 해소)

이 최종안의 F1~F12 결정에 맞춰 하위 스펙 파일을 수정 반영:
- `dongne-ui-spec.md`: §4-1 제출방식(즉시→2탭)·드롭다운 위치, §4-3 토스트→버튼 라벨·"통계 모달"→인라인, §4-7 헤더 우측(아이콘→아카이브 링크)·높이(52→48)·토스트 컴포넌트 미채용, §4-2 2줄→단일라인 표기, §3-1 프레임 폭 320/360 확정.
- `dongne-ux-spec.md`: 인풋 sticky→non-sticky, 드롭다운 "항상 위"→"위 기본·부족시 아래", placeholder 문안 통일.
</content>
</invoke>
