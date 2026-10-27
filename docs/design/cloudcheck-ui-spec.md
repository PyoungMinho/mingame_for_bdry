# 「문단속 5」(cloudcheck) — UI 디자인 스펙 (STEP 3-a · @UI디자이너)

> 작성: @UI디자이너(Sonnet) · 기준일 2026-10-19 · 대상: `/cloudcheck` (자체 완결 HTML 한 장, 시스템 폰트 · 인라인 SVG · 손작성 CSS)
> 입력(우선순위 순): ① `docs/planning/project-direction-cloudcheck.md`(방향서) ② `docs/design/cloudcheck-lead-review.md`(디자인팀장 검토 원문, 이하 **"팀장 원문"**) ③ 이 문서. 충돌하면 위가 이긴다.
> 지위: @디자인팀장이 @UX디자이너 스펙(`cloudcheck-ux-spec.md`)과 합쳐 `cloudcheck-design-final.md`를 낼 때의 입력. 복사해서 쓰는 코드 블록(tokens.css · base.css · print.css · 아이콘 path · 파비콘)을 포함한다.
> 표기: [확인: 근거] 직접 계산·조회로 확인 / [일반 지식] 널리 알려진 사양, 원문 재확인 안 함 / [설계 판단] 이 문서의 결정 / [미확인] 확인 못 함(STEP 5 이월). **[미확인]은 제품 문구에 쓰지 않는다.**
> Figma 도구는 이번 세션에 연결돼 있지 않다 [확인: 도구 목록]. 기존 `docs/design/*-ui-spec.md` 관례대로 마크다운 스펙으로 낸다.
> 이 작업에서 만들거나 고친 파일은 이 문서 하나뿐이다. 대비 계산은 레포에 스크립트를 두지 않고 손계산 + 외부 계산기 교차로 했다(§1-4).

---

## 0. 한눈에 보기

### 0-1. 핵심 결정

1. **토큰 이름을 모델의 `Status`와 맞췄다.** 팀장 원문 초안의 `danger / warn / ok / unk`는 `risk / caution / clear / unknown`(+ `na`)로 바꾼다. 방향서 결정 M(상태 문자열 `caution` 단일화)을 CSS에도 적용한 것이다. 상태 색은 `.cc-st--<status>` 클래스가 `--cc-st-*` 변수 4개(`ink · bg · icon · line`)로 리맵해서 컴포넌트가 상태 이름을 몰라도 되게 한다(§2-4).
2. **팀장 원문의 대비 수치를 전부 다시 계산했고 한 곳만 미달이었다.** 계산한 약 110쌍 중 다크 모드 `--cc-line-strong`·`--cc-na-line`(#5D6572)이 표면색(#171A20) 위에서 **2.96:1**(기준 3:1 미달)이다. **#646C79**로 바꾸면 표면 위 3.28:1, 페이지 바탕 위 3.56:1이다(§1-4). 나머지는 원문과 ±0.01 안에서 일치한다.
3. **상태 도형 5종**은 `viewBox 0 0 24 24`, 채움 도형 + 글리프(뚫린 색) 구조다. 도형은 `currentColor`, 글리프는 `--cc-glyph`(라이트 흰색 / 다크 #0F1115)를 쓴다. 해당 없음만 점선 외곽선이다(§2-2).
4. **아이콘은 15종, 합계 약 4KB [추정: path 문자 수 합산 약 1.6KB + 래퍼 코드 + 라이선스 고지]** — 예산 8KB의 절반이다. lucide에서 옮긴 것은 5종(door-closed · key-round · warehouse · cctv · file-text)뿐이고 모두 ISC 라이선스다. 나머지(창문 · ↗ · chevron · 뒤로 · 닫기 + 상태 5종)는 자체 도형이다. upload · download · printer 아이콘은 쓰지 않는다(글자 버튼으로 충분하다). 고지는 `icons.ts` 머리의 `/*! … */` 블록이고, esbuild `legalComments:'eof'`가 번들 끝에 보존한다(§3-5).
5. **Danger(빨강) 버튼은 없다.** 빨강은 '위험' 판정 전용이라는 규율을 버튼·폼 오류까지 예외 없이 적용한다. 파괴적 동작은 `<dialog>` 확인으로, 폼 오류는 굵은 잉크 2px 테두리 + 문장으로 표현한다(§5-9).
6. **Banner 6변형** = `info · scope · strong · exception · unknown · demo`. 엔진의 `Banner.kind` 9종 + `TimeNotice` 3종 + 예외 집계 + 입력 인식 실패를 이 6개에 대응시킨 표를 둔다(§5-3). 강한 공지(잉크 반전)는 방향서대로 **7일 초과 · 비밀 패턴 감지** 두 가지뿐이다.
7. **인쇄는 "배경이 안 찍혀도 읽힌다"가 기준이다.** 반전(잉크 바탕) 요소는 인쇄에서 테두리형으로 바뀌고, 배경 보존(`print-color-adjust: exact`)은 상태 배지·분포 칩에만 건다. 마스킹은 `.cc-mask-full` / `.cc-mask-short` 이중 렌더를 CSS로 전환하므로 브라우저 메뉴 인쇄에서도 마스킹본이 나온다(§6-3).
8. **CSS 예산 30 KiB는 이 스펙대로 전부 구현하면 빠듯하거나 넘는다.** 규칙별 문자 수 손계산으로 압축 후 약 30~34KB를 예상한다 [추정, §6-1 표]. 골격 3파일(tokens · base · print)은 합계 약 13KB로 안에 들어오고, 초과분은 컴포넌트 CSS에서 난다. 절감안(약 1.6KB)과 상한 상향(36 KiB, 기획팀장 확인) 중 하나를 디자인팀장이 정해 달라(§9-1 #1). 다크는 `tokens.css`의 토큰만 바뀌고 컴포넌트 CSS에는 다크용 `@media`를 쓰지 않는다.
9. **`light-dark()` 함수는 쓰지 않았다.** 토큰 선언이 절반으로 줄지만 구형 브라우저(Safari 17.5 미만 등)에서 모든 색이 무효가 된다. 토큰 블록 세 벌(라이트 · 다크 · 인쇄) 중복 약 1.5KB를 비용으로 감수한다 [설계 판단].
10. **UX 스펙과 맞춰야 할 접점**은 §9-2에 모았다(상태 글자 5개, 문 이름, 배너 매핑, 인쇄 머리·바닥, `document.title`에 신원 넣지 않기 등).

### 0-2. 팀장 원문(§2)에서 바뀐 점

| # | 항목 | 팀장 원문 | 이 문서 | 이유 |
|---|---|---|---|---|
| 1 | 토큰 이름 | `danger · warn · ok · unk` | `risk · caution · clear · unknown` | 모델 `Status`와 1:1(결정 M) |
| 2 | 다크 `line-strong` · `na-line` | #5D6572 | **#646C79** | 표면 위 2.96 → 3.28 (§1-4) |
| 3 | 확인 불가 왼쪽 띠 | 빗금 띠(폭 미정) | **6px** 실선 + 화면 빗금(다른 상태는 4px) | 4px에서는 빗금이 보이지 않는다 [설계 판단, 실브라우저 확인 필요] |
| 4 | 글자 크기 단위 | 13 / 14 / 16 / 18 / 20 / 24 / 30px | 같은 값을 **rem**으로(`.8125rem` …) | 브라우저 기본 글자 크기 설정을 따르게 한다(WCAG 1.4.4) |
| 5 | 행간 | 본문 1.6 · 제목 1.35 | 본문 1.6 · **UI(14/13px) 1.5** · 제목 1.35 | 표·칩 밀도 |
| 6 | 신규 토큰 | — | `--cc-hover · --cc-ph-bg · --cc-glyph · --cc-scrim · --cc-focus · --cc-inv-* · --cc-sp-* · --cc-r-* · --cc-bar* · --cc-hit · --cc-w-* · --cc-gutter · --cc-band-h · --cc-dur · --cc-fs-* · --cc-lh-*` | 컴포넌트가 숫자를 직접 쓰지 않게 |
| 7 | 위험 버튼 | (원문에 없음, 기본 산출물 형식에는 있음) | **없음** | 빨강은 판정 전용 |
| 8 | 워드마크 링크 | 링크 밑줄 항상 | 워드마크만 **밑줄 예외**(굵은 글자, hover 때 밑줄) | 로고형 링크 관례 [설계 판단] |
| 9 | 인쇄 반전 요소 | (원문에 없음) | 인쇄에서 테두리형으로 전환 | 기본 인쇄 설정에서 배경이 안 찍힘 |
| 10 | CSS 예산 | 25KB 권고 | **30 KiB**(방향서 §2-3) | 방향서 우선 |

---

## 1. 컬러 시스템과 디자인 토큰

### 1-1. 색 규율 (의미 → 토큰 → 허용 형태)

| 의미 | 토큰 | 허용 형태 | 금지 |
|---|---|---|---|
| 5상태 | `--cc-{risk,caution,clear,unknown,na}-*` | StateBadge · StateIcon · 분포 칩 · RuleRow 왼쪽 띠와 테두리 | 상태 밖의 용도(장식 · 버튼 · 링크 · 폼 오류). `-icon` 토큰을 **글자색**으로 쓰기 |
| 예외 | `--cc-exc / -ink / -bg` | 대상 행 4px 왼쪽 띠 · 예외 라벨 · 예외 배너 | 상태 배지 대체, 채움 버튼 |
| 체험 | `--cc-demo / -ink / -bg` | 상단 띠 · 화면 안쪽 4px 프레임 · 인쇄 머리 글자 · demo 배너 | 배지 · 칩 |
| 베타 | 무채색(`--cc-surface` + 잉크) | 상단 띠 | 색 |
| 강한 공지 | `--cc-inv-bg / -ink` (= 잉크 / 바탕 반전) | strong 배너 | 색 |
| 영향도 | 무채색 | 글자 칩. **테두리 굵기로 차등**(§5-5) | 신호등 색 |
| 버튼 · 링크 · 포커스 | `--cc-ink` | 주 버튼 잉크 채움 · 링크 밑줄 항상 · 포커스 2px 잉크 | 색 |

그림자 · 그라디언트 · 이모지 · 알약 모양 · 투명도(`opacity`)로 약하게 만들기는 쓰지 않는다. "옅게 처리"는 확인 불가에 대해 금지된 처리다.

### 1-2. `styles/tokens.css` (완성본)

컴포넌트개발자가 그대로 `src/app/cloudcheck/_client/styles/tokens.css`로 옮긴다. 파일에 CR 문자와 `</style` 문자열을 넣지 않는다(CSP 해시, 방향서 §2-3).

```css
/* styles/tokens.css — 문단속 5 디자인 토큰 v1.0 (라이트 기본 · 다크 · 인쇄)
 * ① 색은 판정(5상태)에만 쓴다. 예외(파랑)·체험(보라)은 띠·테두리 전용.
 * ② 컴포넌트 CSS에는 다크용 @media를 쓰지 않는다. 다크·인쇄는 이 파일의 토큰만 바뀐다.
 * ③ style="" 속성 금지. 동적 값은 클래스·data-* 속성으로 표현한다.
 * ④ 새 토큰은 디자인팀장 승인 후 추가한다. */
:root{
  color-scheme:light dark;

  /* 종이와 잉크 */
  --cc-bg:#FFFFFF;
  --cc-surface:#F5F6F8;
  --cc-hover:#EDEFF3;
  --cc-line:#D3D8DF;          /* 장식 구분선 전용(1.43:1). 의미를 싣지 않는다 */
  --cc-line-strong:#848D99;   /* 입력·카드 경계(3:1 이상) */
  --cc-ink:#15181D;
  --cc-ink-2:#444B57;
  --cc-ink-3:#5B6370;         /* 보조 글자(AA). 상태 글자로 쓰지 않는다 */
  --cc-ph-bg:#E4E7EC;         /* 명령 자리표시자 강조 바탕 */
  --cc-glyph:#FFFFFF;         /* 상태 도형 위 글리프(뚫린 색) */
  --cc-scrim:rgba(21,24,29,.55);

  /* 5상태: ink=글자 · bg=바탕 · icon=도형·띠·테두리 */
  --cc-risk-ink:#9B1C1C;    --cc-risk-bg:#FDEDED;    --cc-risk-icon:#C42121;
  --cc-caution-ink:#74470A; --cc-caution-bg:#FFF4D9; --cc-caution-icon:#A86200;
  --cc-clear-ink:#14532D;   --cc-clear-bg:#E9F6EE;   --cc-clear-icon:#1C7A43;
  --cc-unknown-ink:#1F2937; --cc-unknown-bg:#ECEFF3; --cc-unknown-icon:#4A5361; --cc-unknown-line:#7D8796;
  --cc-na-ink:#444B57;      --cc-na-icon:#6A7280;    --cc-na-line:#848D99;

  /* 예외(파랑) · 체험(보라) — 띠·테두리 전용 */
  --cc-exc:#2459D6;  --cc-exc-ink:#1D3F99;  --cc-exc-bg:#EBF1FE;
  --cc-demo:#6B33C9; --cc-demo-ink:#4A1F94; --cc-demo-bg:#F3EDFD;

  /* 파생(테마별 재선언 불필요: var() 참조라 위 값이 바뀌면 따라간다) */
  --cc-focus:var(--cc-ink);
  --cc-inv-bg:var(--cc-ink);
  --cc-inv-ink:var(--cc-bg);

  /* 타이포 */
  --cc-font:-apple-system,BlinkMacSystemFont,"Apple SD Gothic Neo","Segoe UI","Malgun Gothic","맑은 고딕","Noto Sans KR","Noto Sans CJK KR",Roboto,sans-serif;
  --cc-mono:ui-monospace,"SF Mono",SFMono-Regular,Menlo,Consolas,"D2Coding","Noto Sans Mono CJK KR",monospace;
  --cc-fs-13:.8125rem; --cc-fs-14:.875rem; --cc-fs-16:1rem; --cc-fs-18:1.125rem;
  --cc-fs-20:1.25rem;  --cc-fs-24:1.5rem;  --cc-fs-30:1.875rem;
  --cc-lh-body:1.6; --cc-lh-ui:1.5; --cc-lh-head:1.35;

  /* 간격(4px 단위) · 형태 · 크기 */
  --cc-sp-1:4px; --cc-sp-2:8px; --cc-sp-3:12px; --cc-sp-4:16px;
  --cc-sp-6:24px; --cc-sp-8:32px; --cc-sp-12:48px; --cc-sp-16:64px;
  --cc-r-1:4px; --cc-r-2:6px;
  --cc-bar:4px; --cc-bar-unknown:6px;
  --cc-hit:44px;
  --cc-w-main:880px; --cc-w-wide:1040px; --cc-gutter:16px; --cc-band-h:28px;
  --cc-dur:120ms;
}
@media (min-width:600px){:root{--cc-gutter:24px}}
@media (min-width:1024px){:root{--cc-gutter:32px}}

@media (prefers-color-scheme:dark){:root{
  --cc-bg:#0F1115; --cc-surface:#171A20; --cc-hover:#1C2027; --cc-line:#2B3038; --cc-line-strong:#646C79;
  --cc-ink:#E7E9EC; --cc-ink-2:#B3B9C3; --cc-ink-3:#9AA1AC;
  --cc-ph-bg:#2F353F; --cc-glyph:#0F1115; --cc-scrim:rgba(0,0,0,.65);
  --cc-risk-ink:#FFB3B3;    --cc-risk-bg:#3A1517;    --cc-risk-icon:#FF6B6B;
  --cc-caution-ink:#FFD98C; --cc-caution-bg:#33250B; --cc-caution-icon:#F0B341;
  --cc-clear-ink:#A3E4BA;   --cc-clear-bg:#102A1B;   --cc-clear-icon:#4DC27B;
  --cc-unknown-ink:#E5E7EB; --cc-unknown-bg:#20242C; --cc-unknown-icon:#B0B7C2; --cc-unknown-line:#737C8A;
  --cc-na-ink:#B3B9C3;      --cc-na-icon:#8E95A1;    --cc-na-line:#646C79;
  --cc-exc:#6E9FFF;  --cc-exc-ink:#BCD1FF;  --cc-exc-bg:#15223F;
  --cc-demo:#A98BFF; --cc-demo-ink:#DCCFFF; --cc-demo-bg:#231B3A;
}}

/* 인쇄는 항상 라이트. OS가 다크여도 종이는 라이트로 나와야 한다. 반드시 다크 블록보다 뒤에 둔다 */
@media print{:root{
  color-scheme:light;
  --cc-bg:#FFFFFF; --cc-surface:#F5F6F8; --cc-hover:#EDEFF3; --cc-line:#D3D8DF; --cc-line-strong:#848D99;
  --cc-ink:#15181D; --cc-ink-2:#444B57; --cc-ink-3:#5B6370;
  --cc-ph-bg:#E4E7EC; --cc-glyph:#FFFFFF; --cc-scrim:rgba(21,24,29,.55);
  --cc-risk-ink:#9B1C1C;    --cc-risk-bg:#FDEDED;    --cc-risk-icon:#C42121;
  --cc-caution-ink:#74470A; --cc-caution-bg:#FFF4D9; --cc-caution-icon:#A86200;
  --cc-clear-ink:#14532D;   --cc-clear-bg:#E9F6EE;   --cc-clear-icon:#1C7A43;
  --cc-unknown-ink:#1F2937; --cc-unknown-bg:#ECEFF3; --cc-unknown-icon:#4A5361; --cc-unknown-line:#7D8796;
  --cc-na-ink:#444B57;      --cc-na-icon:#6A7280;    --cc-na-line:#848D99;
  --cc-exc:#2459D6;  --cc-exc-ink:#1D3F99;  --cc-exc-bg:#EBF1FE;
  --cc-demo:#6B33C9; --cc-demo-ink:#4A1F94; --cc-demo-bg:#F3EDFD;
}}
```

- 위 파일은 소스 약 5.2KB(주석 포함), 압축 후 약 3.2KB다 [추정: 속성별 문자 수 합산]. 같은 `<head>`에 `<meta name="color-scheme" content="light dark">`와 테마 색 메타 2개를 두기를 프론트팀장에게 요청한다(§9-2).
  `<meta name="theme-color" content="#FFFFFF" media="(prefers-color-scheme: light)">` / `<meta name="theme-color" content="#0F1115" media="(prefers-color-scheme: dark)">`
- 간격 토큰 이름은 `--cc-sp-N` = N × 4px이다(1·2·3·4·6·8·12·16). 5 · 7 · 9 같은 번호는 없다.
- `--cc-gutter`는 화면 폭에 따라 16 / 24 / 32px로 바뀐다(위 두 `@media`).

### 1-3. 토큰 이름 정정표 (팀장 원문 초안 → 확정)

| 원문 | 확정 | 원문 | 확정 |
|---|---|---|---|
| `--cc-danger-ink` | `--cc-risk-ink` | `--cc-unk-ink` | `--cc-unknown-ink` |
| `--cc-danger-bg` | `--cc-risk-bg` | `--cc-unk-bg` | `--cc-unknown-bg` |
| `--cc-danger-icon` | `--cc-risk-icon` | `--cc-unk-icon` | `--cc-unknown-icon` |
| `--cc-warn-ink` | `--cc-caution-ink` | `--cc-unk-line` | `--cc-unknown-line` |
| `--cc-warn-bg` | `--cc-caution-bg` | `--cc-ok-ink` | `--cc-clear-ink` |
| `--cc-warn-icon` | `--cc-caution-icon` | `--cc-ok-bg / -icon` | `--cc-clear-bg / -icon` |

`--cc-na-*`, `--cc-exc*`, `--cc-demo*`, `--cc-bg / surface / line / line-strong / ink / ink-2 / ink-3` 이름은 그대로다.

### 1-4. 대비 검증 (팀장 원문 재계산)

**방법** [확인: 손계산 + 외부 계산기 교차, 2026-10-19]
1. 공식(WCAG 2.1 상대 휘도): 채널 `c = 값/255`, `lin = c ≤ 0.04045 ? c/12.92 : ((c+0.055)/1.055)^2.4`, `L = 0.2126·R + 0.7152·G + 0.0722·B`, `대비 = (L밝은쪽 + 0.05) / (L어두운쪽 + 0.05)`. (WCAG 2.1 문서의 임계값 0.03928과 sRGB 표준의 0.04045는 8비트 정수 입력에서 결과가 같다.)
2. **손계산 4쌍**을 소수 5자리 이상으로 풀었다(아래 계산 예).
3. 나머지는 **WebAIM Contrast Checker API**(`webaim.org/resources/contrastchecker/?fcolor=…&bcolor=…&api`)로 약 110쌍을 교차했다. 이 API는 유효숫자 3자리에서 **내림**으로 표기한다(10 미만은 소수 둘째 자리, 10 이상은 소수 첫째 자리). 손계산 4쌍은 API가 표기하는 자릿수 안에서 모두 일치했다(예: 17.79 ↔ API 17.7, 2.96 ↔ 2.96).
4. 표의 수치는 같은 방식으로 **내림 표기**다. 판정 기준(3 / 4.5 / 7)과의 거리가 0.01 안인 쌍은 없다.

**계산 예**

| 쌍 | 채널 → linear | L | 대비 |
|---|---|---|---|
| A. 잉크 #15181D / 흰색 | R 21 → 0.007499 · G 24 → 0.009134 · B 29 → 0.012286 | 0.009014 / 1 | (1+0.05) / (0.009014+0.05) = **17.79** |
| B. caution 아이콘 #A86200 / caution 바탕 #FFF4D9 | 아이콘: R 168 → 0.39157 · G 98 → 0.12214 · B 0 → 0 / 바탕: R 255 → 1 · G 244 → 0.90467 · B 217 → 0.69387 | 0.17060 / 0.90971 | 0.95971 / 0.22060 = **4.35** (비텍스트 3:1 충족, 글자로는 4.5 미달 → 아이콘 전용 규칙의 근거) |
| C. risk 글자 #9B1C1C / risk 바탕 #FDEDED | 글자: R 155 → 0.32778 · G·B 28 → 0.011612 / 바탕: R 253 → 0.98225 · G·B 237 → 0.84686 | 0.07883 / 0.87564 | 0.92564 / 0.12883 = **7.18** (상태 글자 중 최저, AAA 7:1 충족) |
| D. 다크 구 line-strong #5D6572 / surface #171A20 | #5D6572: R 93 → 0.10946 · G 101 → 0.13014 · B 114 → 0.16827 / #171A20: R 23 → 0.008568 · G 26 → 0.010330 · B 32 → 0.014444 | 0.12850 / 0.010253 | 0.17850 / 0.060253 = **2.96 (3:1 미달)** |
| D'. 다크 신 line-strong #646C79 | R 100 → 0.12744 · G 108 → 0.14996 · B 121 → 0.19120 | 0.14815 | surface 위 0.19815 / 0.060253 = **3.28**, bg(#0F1115, L 0.005566) 위 0.19815 / 0.055566 = **3.56** |

**표 1. 라이트 — 글자 (상태 글자는 AAA 7:1 목표, 그 밖은 AA 4.5:1)**

| 글자 | 바탕 | 대비 | 기준 | 판정 |
|---|---|---|---|---|
| ink #15181D | bg #FFFFFF | 17.79 | AAA | 충족 |
| ink | surface #F5F6F8 | 16.4 | AAA | 충족 |
| ink | hover #EDEFF3 · unknown-bg #ECEFF3 · ph-bg #E4E7EC | 15.4 · 15.4 · 14.3 | AAA | 충족 |
| ink-2 #444B57 (= na-ink) | bg · surface | 8.78 · 8.12 | AAA | 충족 |
| ink-3 #5B6370 | bg · surface · hover · unknown-bg | 6.06 · 5.60 · 5.26 · 5.25 | AA | 충족(AAA 아님. 상태 글자로 쓰지 않는다) |
| risk-ink #9B1C1C | risk-bg #FDEDED · bg | **7.18** · 8.15 | AAA | 충족 |
| caution-ink #74470A | caution-bg #FFF4D9 · bg | 7.24 · 7.92 | AAA | 충족 |
| clear-ink #14532D | clear-bg #E9F6EE · bg | 8.19 · 9.11 | AAA | 충족 |
| unknown-ink #1F2937 | unknown-bg #ECEFF3 · bg | 12.7 · 14.6 | AAA | 충족 |
| exc-ink #1D3F99 | exc-bg #EBF1FE · bg | 8.34 · 9.44 | AAA | 충족 |
| demo-ink #4A1F94 | demo-bg #F3EDFD · bg | 9.57 · 10.9 | AAA | 충족 |
| 흰색(주 버튼 · 반전 글자) | ink #15181D · ink-2 #444B57(hover) | 17.79 · 8.78 | AAA | 충족 |

**표 2. 라이트 — 비텍스트 (아이콘 · 띠 · 경계, 3:1)**

| 요소 | bg #FFFFFF | surface #F5F6F8 | 자기 바탕 | 판정 |
|---|---|---|---|---|
| risk-icon #C42121 | 5.85 | 5.41 | 5.16 (risk-bg) | 충족 |
| caution-icon #A86200 | 4.75 | 4.40 | **4.35** (caution-bg) | 충족. 4.5 미달이므로 **글자색 금지** |
| clear-icon #1C7A43 | 5.36 | 4.96 | 4.82 (clear-bg) | 충족 |
| unknown-icon #4A5361 | 7.77 | 7.18 | 6.74 (unknown-bg) | 충족 |
| na-icon #6A7280 | 4.84 | 4.48 | — | 충족. 4.5 미달이므로 **글자색 금지** |
| unknown-line #7D8796 (경계) | 3.63 | — | 3.15 (unknown-bg) | 충족 |
| line-strong · na-line #848D99 (경계) | 3.35 | 3.10 | hover 위 **2.91** | 충족. **hover 바탕 위에서는 이 경계색을 쓰지 않는다**(hover 때 경계를 ink로 바꾼다) |
| 도형 위 글리프 흰색 | risk-icon 5.85 · caution-icon 4.75 · clear-icon 5.36 · unknown-icon 7.77 | | | 충족 |
| exc #2459D6 | 6.04 | 5.58 | 5.33 (exc-bg) | 충족 |
| demo #6B33C9 | 7.13 | 6.60 | 6.23 (demo-bg) | 충족 |
| 포커스 링 ink | 17.79 | 16.4 | — | 충족 |

**표 3. 다크 — 글자**

| 글자 | 바탕 | 대비 | 기준 | 판정 |
|---|---|---|---|---|
| ink #E7E9EC | bg #0F1115 · surface #171A20 | 15.5 · 14.3 | AAA | 충족 |
| ink | hover #1C2027 · unknown-bg #20242C · ph-bg #2F353F | 13.4 · 12.7 · 10.1 | AAA | 충족 |
| ink-2 #B3B9C3 (= na-ink) | bg · surface | 9.57 · 8.83 | AAA | 충족 |
| ink-3 #9AA1AC | bg · surface · hover | 7.25 · 6.69 · 6.27 | AA | 충족 |
| risk-ink #FFB3B3 | risk-bg #3A1517 · bg | **9.50** · 11.1 | AAA | 충족 |
| caution-ink #FFD98C | caution-bg #33250B · bg | 11.0 · 13.9 | AAA | 충족 |
| clear-ink #A3E4BA | clear-bg #102A1B · bg | 10.4 · 12.9 | AAA | 충족 |
| unknown-ink #E5E7EB | unknown-bg #20242C · bg | 12.5 · 15.2 | AAA | 충족 |
| exc-ink #BCD1FF | exc-bg #15223F · bg | 10.2 · 12.3 | AAA | 충족 |
| demo-ink #DCCFFF | demo-bg #231B3A · bg | 11.1 · 12.9 | AAA | 충족 |
| #0F1115(주 버튼 · 반전 글자) | ink #E7E9EC · ink-2 #B3B9C3(hover) | 15.5 · 9.57 | AAA | 충족 |

**표 4. 다크 — 비텍스트**

| 요소 | bg #0F1115 | surface #171A20 | 자기 바탕 | 판정 |
|---|---|---|---|---|
| risk-icon #FF6B6B | 6.80 | 6.27 | 5.82 (risk-bg) | 충족 |
| caution-icon #F0B341 | 10.1 | — | 7.96 (caution-bg) | 충족 |
| clear-icon #4DC27B | 8.38 | — | 6.80 (clear-bg) | 충족 |
| unknown-icon #B0B7C2 | 9.35 | 8.62 | 7.70 (unknown-bg) | 충족 |
| na-icon #8E95A1 | 6.26 | 5.77 | — | 충족 |
| unknown-line #737C8A | 4.48 | — | 3.68 (unknown-bg) | 충족 |
| **line-strong · na-line #646C79 (신)** | **3.56** | **3.28** | — | **충족** |
| 구 #5D6572 (폐기) | 3.21 | **2.96** | — | **미달** |
| 도형 위 글리프 #0F1115 | risk-icon 6.80 · caution-icon 10.1 · clear-icon 8.38 · unknown-icon 9.35 | | | 충족 |
| exc #6E9FFF | 7.25 | 6.69 | 6.05 (exc-bg) | 충족 |
| demo #A98BFF | 7.04 | 6.49 | 6.06 (demo-bg) | 충족 |

**표 5. 팀장 원문 수치와 재계산 비교**

| 원문 항목 | 원문 | 재계산 | 결과 |
|---|---|---|---|
| 라이트 ink / ink-2 / ink-3 (bg 위) | 17.79 / 8.79 / 6.06 | 17.79 / 8.78 / 6.06 | 일치(±0.01) |
| 라이트 상태 글자 / 상태 바탕 | 7.19 ~ 12.73 | 7.18 ~ 12.7 | 일치. 최저는 risk(7.18), 모두 AAA |
| 라이트 아이콘 / 페이지 바탕 | 4.76 ~ 7.77 | 4.75 ~ 7.77 | 일치 |
| 라이트 아이콘 / 상태 바탕 | 4.35 ~ 6.74 | 4.35 ~ 6.74 | 일치 |
| 확인 불가 실선(라이트) | 3.63 | 3.63 | 일치 |
| 해당 없음 점선(라이트) | 3.36 | 3.35 | 일치(내림) |
| 다크 상태 글자 / 상태 바탕 | 9.50 ~ 12.56 | 9.50 ~ 12.5 | 일치 |
| 다크 아이콘 / 페이지 바탕 | 6.81 ~ 10.10 | 6.80 ~ 10.1 | 일치 |
| 다크 아이콘 / 상태 바탕 | 5.82 ~ 7.96 | 5.82 ~ 7.96 | 일치 |
| 확인 불가 실선(다크) | 4.48 | 4.48 | 일치 |
| 해당 없음 점선(다크) | 3.21 | bg 위 3.21 / **surface 위 2.96** | **원문이 bg 위만 계산함. surface 위 미달 → #646C79로 교체** |

### 1-5. 색 사용 규칙 (검증 결과에서 나온 제한)

1. `--cc-caution-icon`(4.35~4.75)과 `--cc-na-icon`(4.48~4.84)은 4.5:1에 못 미치는 구간이 있으므로 **글자색으로 쓰지 않는다.** 글자는 `-ink`만 쓴다.
2. 상태 틴트 바탕(`--cc-*-bg`) 위의 글자는 해당 상태의 `-ink`, 보조 글자도 `-ink`를 쓴다. `--cc-ink-3`은 페이지 바탕 · `surface` · `hover` 위에서만 쓴다.
3. hover 때 카드 · 입력 주변 경계는 `--cc-line-strong`이 아니라 `--cc-ink`로 바꾼다(hover 바탕 위 2.91).
4. 상태 틴트 위의 경계는 그 상태의 line 토큰(`--cc-st-line`)을 쓴다.
5. 포커스 링 · 링크 · 주 버튼은 잉크. 반전 요소 안에서는 `--cc-inv-ink`.
6. 색 구분이 흑백 인쇄와 색각 이상에서도 남도록, 모든 상태 표시는 **모양 + 글리프 + 글자 + 색**을 함께 쓴다(§2).

---

## 2. 5상태 시각 규격

### 2-1. 규격표

| 항목 | 위험 `risk` | 주의 `caution` | 이상 없음 `clear` | 확인 불가 `unknown` | 해당 없음 `na` |
|---|---|---|---|---|---|
| 모양(실루엣) | ▲ 삼각형(채움, 모서리 둥글게) | ◆ 마름모(채움) | ● 원(채움) | ■ 둥근 사각(채움) | ◌ 원(점선 외곽선만) |
| 글리프 | 느낌표 | 느낌표 | 체크 | 물음표 | 가로 막대 |
| 상태 글자(고정) | 위험 | 주의 | 이상 없음 | 확인 불가 | 해당 없음 |
| 라이트 ink / bg / icon | #9B1C1C / #FDEDED / #C42121 | #74470A / #FFF4D9 / #A86200 | #14532D / #E9F6EE / #1C7A43 | #1F2937 / #ECEFF3 / #4A5361 | #444B57 / 없음 / #6A7280 |
| 다크 ink / bg / icon | #FFB3B3 / #3A1517 / #FF6B6B | #FFD98C / #33250B / #F0B341 | #A3E4BA / #102A1B / #4DC27B | #E5E7EB / #20242C / #B0B7C2 | #B3B9C3 / 없음 / #8E95A1 |
| 배지 테두리 | 1px 실선, icon 색 | 1px 실선, icon 색 | 1px 실선, icon 색 | 1px 실선, `--cc-unknown-line` | 1px **점선**, `--cc-na-line`, 바탕 없음 |
| 행 왼쪽 띠 | 4px 실선 | 4px 실선 | 4px 실선 | **6px** 실선 + 화면에서는 빗금 | 4px 점선 |
| 행 테두리 | 구분선만 | 구분선만 | 구분선만 | **1px 실선 전체**(`--cc-unknown-line`) | 없음 |
| 글리프 색 | 라이트 흰색 / 다크 #0F1115 | 〃 | 〃 | 〃 | 도형과 같은 색(`currentColor`) |
| 권장 기본 상태(UX와 합의) | 펼침 | 펼침 | 접힘(꼬리표 + '못 본 것 n') | 펼침 | 섹션 끝 한 줄로 접음 |
| 인쇄 | 배지 배경 보존(exact) + 도형 인쇄 | 〃 | 〃 | 〃 | 〃 |

- 상태 글자는 **어디서도 생략 · 축약하지 않는다.** 아이콘만 있는 칸, "OK" · "✓" 같은 축약을 쓰지 않는다.
- 회색(확인 불가)은 **옅게 처리하지 않는다.** 본문 글자는 다른 상태와 같은 잉크, 도형은 채움, 분포 칩은 같은 크기다.
- 다섯 실루엣이 모두 달라서(삼각형 · 마름모 · 채운 원 · 채운 사각 · 점선 원) 흑백 인쇄에서도 구분된다 [설계 판단. 색각 이상 에뮬레이션과 흑백 출력은 STEP 5에서 확인: 미확인].

### 2-2. 상태 아이콘 5종 (인라인 SVG, 그대로 복사)

공통: `viewBox="0 0 24 24"`, `aria-hidden="true"`, `focusable="false"`. 크기는 CSS 클래스로 16 / 20 / 24px를 고른다(`width` · `height` 속성은 쓰지 않는다). 모서리 둥글기는 도형 `stroke`(같은 색, 2)의 `linejoin: round`가 만든다. 글리프 점은 길이 0.01의 선 + 둥근 끝(`h.01`)이다.

```html
<!-- ▲ risk -->
<svg class="cc-si cc-si--risk" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path class="cc-si__s" d="M12 4 21 20H3Z"/><path class="cc-si__g" d="M12 10v4.2M12 17.4h.01"/></svg>

<!-- ◆ caution -->
<svg class="cc-si cc-si--caution" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path class="cc-si__s" d="M12 3.6 20.4 12 12 20.4 3.6 12Z"/><path class="cc-si__g" d="M12 7.8v4.6M12 16.1h.01"/></svg>

<!-- ● clear -->
<svg class="cc-si cc-si--clear" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><circle class="cc-si__s" cx="12" cy="12" r="9"/><path class="cc-si__g" d="m7.8 12.2 2.8 2.8 5.6-5.8"/></svg>

<!-- ■ unknown -->
<svg class="cc-si cc-si--unknown" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><rect class="cc-si__s" x="3.4" y="3.4" width="17.2" height="17.2" rx="3.2"/><path class="cc-si__g" d="M9.3 9.6a2.7 2.7 0 0 1 5.4 0c0 1.7-2.7 2.1-2.7 4M12 17.2h.01"/></svg>

<!-- ◌ na -->
<svg class="cc-si cc-si--na" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><circle class="cc-si__s" cx="12" cy="12" r="9"/><path class="cc-si__g" d="M8.4 12h7.2"/></svg>
```

```css
/* 상태 아이콘 — 클래스로만 색·굵기를 준다(SVG 속성·style 속성 없음) */
.cc-si{display:inline-block;flex:none;width:16px;height:16px;vertical-align:-.2em;overflow:visible}
.cc-si--20{width:20px;height:20px}
.cc-si--24{width:24px;height:24px}
.cc-si--risk{color:var(--cc-risk-icon)}
.cc-si--caution{color:var(--cc-caution-icon)}
.cc-si--clear{color:var(--cc-clear-icon)}
.cc-si--unknown{color:var(--cc-unknown-icon)}
.cc-si--na{color:var(--cc-na-icon)}
.cc-si__s{fill:currentColor;stroke:currentColor;stroke-width:2;stroke-linejoin:round}
.cc-si__g{fill:none;stroke:var(--cc-glyph);stroke-width:2.2;stroke-linecap:round;stroke-linejoin:round}
.cc-si--na .cc-si__s{fill:none;stroke-width:2.2;stroke-dasharray:4.4 2.67}   /* 둘레 56.55 ÷ 8 = 7.07 → 점선 8마디가 어긋나지 않게 */
.cc-si--na .cc-si__g{stroke:currentColor}
```

### 2-3. `currentColor` · 글리프 · 크기 · 접근성 규칙

1. **도형은 `currentColor`**(fill과 stroke 모두). 색은 `.cc-si--<status>`가 정하므로 StateIcon은 어디에 놓아도 같은 색이다. 부모의 `color`가 바뀌어도 상태 색은 유지된다.
2. **글리프는 `var(--cc-glyph)`**(뚫린 색)다. `currentColor`를 쓰지 않는다. 해당 없음만 바탕이 없으므로 글리프도 `currentColor`다.
3. **크기**: 16px(StateBadge md · sm, 문 머리의 작은 개수 칩, 표) / 20px(StateBadge lg, 분포 칩) / 24px(범례 · V0 설명). 16px에서 글리프 선은 약 1.5px이다. 더 작게 쓰지 않는다.
4. **접근성**: 항상 `aria-hidden="true"`다. 상태는 옆의 글자가 전달한다. `role="img"` · `<title>`을 넣지 않는다(이중 낭독 방지).
5. **글자로 된 글리프 금지**: 체크 · 물음표는 문자(`✓` `?`)가 아니라 path다. 금지어 검사(`✓`)와 폰트 의존을 피한다.
6. **속성 대신 클래스**: SVG 프레젠테이션 속성(`fill=` · `stroke=`)은 CSP 영향이 없다고 알려져 있지만 [일반 지식, STEP 5 확인: 미확인] 모든 시각 값을 클래스로 둬서 문제를 만들지 않는다. React에서는 `className`, `aria-hidden`, `focusable`, `viewBox`만 쓴다.
7. **고대비 모드**(`forced-colors: active`): 도형은 `CanvasText`, 글리프는 `Canvas`로 강제한다(§6-2 마지막 블록).
8. **인쇄**: SVG 도형은 배경이 아니라 그래픽이라 '배경 그래픽' 설정과 무관하게 찍힌다 [일반 지식, STEP 5 확인: 미확인].

### 2-4. 상태 리맵 변수와 행 처리 패턴

컴포넌트는 `--cc-risk-ink` 같은 상태별 이름을 직접 쓰지 않고, 부모에 붙은 `.cc-st--<status>`가 설정한 `--cc-st-*`만 읽는다. 상태 분기 CSS가 한 곳에 모인다.

```css
.cc-st--risk{--cc-st-ink:var(--cc-risk-ink);--cc-st-bg:var(--cc-risk-bg);--cc-st-icon:var(--cc-risk-icon);--cc-st-line:var(--cc-risk-icon)}
.cc-st--caution{--cc-st-ink:var(--cc-caution-ink);--cc-st-bg:var(--cc-caution-bg);--cc-st-icon:var(--cc-caution-icon);--cc-st-line:var(--cc-caution-icon)}
.cc-st--clear{--cc-st-ink:var(--cc-clear-ink);--cc-st-bg:var(--cc-clear-bg);--cc-st-icon:var(--cc-clear-icon);--cc-st-line:var(--cc-clear-icon)}
.cc-st--unknown{--cc-st-ink:var(--cc-unknown-ink);--cc-st-bg:var(--cc-unknown-bg);--cc-st-icon:var(--cc-unknown-icon);--cc-st-line:var(--cc-unknown-line)}
.cc-st--na{--cc-st-ink:var(--cc-na-ink);--cc-st-bg:transparent;--cc-st-icon:var(--cc-na-icon);--cc-st-line:var(--cc-na-line)}
```

**확인 불가 빗금 띠**: 호스트에 `border-left: 6px solid var(--cc-unknown-icon)`를 주고, `::before`로 바탕색 줄무늬를 덮어 빗금을 만든다. 빗금은 화면에서만 보이고(인쇄에서는 배경이 안 찍혀 실선 띠가 남는다) 의미를 싣지 않는 장식이다.

```css
.cc-hatch{position:relative}
.cc-hatch::before{content:"";position:absolute;top:0;bottom:0;left:calc(-1*var(--cc-bar-unknown));width:var(--cc-bar-unknown);border-radius:var(--cc-r-2) 0 0 var(--cc-r-2);background:repeating-linear-gradient(135deg,var(--cc-bg) 0 2px,transparent 2px 5px);pointer-events:none}
```

---

## 3. 아이콘 세트

### 3-1. 문 아이콘 5종 (단색 선, `fill: none`)

공통 마크업: `<svg class="cc-di cc-di--24" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="…"/></svg>`. 색은 `currentColor`이며 기본은 잉크다. **상태 색을 칠하지 않는다**(문은 상태가 아니다). 항상 문 이름 글자와 함께 놓는다.

| 문(`DoorId`) | 화면 이름(예, 최종은 UX) | 원천 | `d` |
|---|---|---|---|
| `mfa` | 현관 | lucide `door-closed` (ISC) | `M19 21V5a2 2 0 0 0-2-2H7a2 2 0 0 0-2 2v16M2 21h20M9 12h.01` |
| `key` | 열쇠 | lucide `key-round` (ISC) | `M2.586 17.414A2 2 0 0 0 2 18.828V21a1 1 0 0 0 1 1h3a1 1 0 0 0 1-1v-1a1 1 0 0 1 1-1h1a1 1 0 0 0 1-1v-1a1 1 0 0 1 1-1h.172a2 2 0 0 0 1.414-.586l.814-.814a6.5 6.5 0 1 0-4-4zM16.5 7.5h.01` |
| `net` | 창문 | **자체 도형**(4칸 창) | `M5.5 3h13A1.5 1.5 0 0 1 20 4.5v15a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 19.5v-15A1.5 1.5 0 0 1 5.5 3ZM12 3v18M4 12h16` |
| `sto` | 창고 | lucide `warehouse` (ISC) | `M18 21V10a1 1 0 0 0-1-1H7a1 1 0 0 0-1 1v11M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V8a2 2 0 0 1 1.132-1.803l7.95-3.974a2 2 0 0 1 1.837 0l7.948 3.974A2 2 0 0 1 22 8zM6 13h12M6 17h12` |
| `log` | CCTV | lucide `cctv` (ISC) | `M16.75 12h3.632a1 1 0 0 1 .894 1.447l-2.034 4.069a1 1 0 0 1-1.708.134l-2.124-2.97M17.106 9.053a1 1 0 0 1 .447 1.341l-3.106 6.211a1 1 0 0 1-1.342.447L3.61 12.3a2.92 2.92 0 0 1-1.3-3.91L3.69 5.6a2.92 2.92 0 0 1 3.92-1.3zM2 19h3.76a2 2 0 0 0 1.8-1.1L9 15M2 21v-4M7 9h.01` |

- lucide 원본(`icons/door-closed.svg` 등, main 브랜치)을 조회해 path를 옮겼다 [확인: raw.githubusercontent.com/lucide-icons/lucide, 2026-10-19]. 원본이 여러 `<path>`로 나눈 것은 하나의 `d`로 이었다(같은 선 스타일이라 결과가 같다). `key-round`의 점(`<circle r=".5">`)은 길이 0.01의 선(`M16.5 7.5h.01`)으로 바꿨다(점 반지름 1.5 → 1, 24px 이하에서 차이가 거의 없다).
- 창문은 둥근 사각 틀 + 십자 살 구조의 자체 도형이다. 테두리 좌표는 위 4개 아이콘의 외곽(x 2~22, y 2~22)과 맞췄다.

```css
/* 문 아이콘(.cc-di)과 UI 아이콘(.cc-ic)이 같은 선 스타일을 공유한다 */
.cc-di,.cc-ic{display:inline-block;flex:none;width:16px;height:16px;vertical-align:-.2em;fill:none;stroke:currentColor;stroke-width:2;stroke-linecap:round;stroke-linejoin:round}
.cc-di--20,.cc-ic--20{width:20px;height:20px;stroke-width:1.75}
.cc-di--24,.cc-ic--24{width:24px;height:24px;stroke-width:1.5}
.cc-di--32{width:32px;height:32px;stroke-width:1.5}   /* V0 '다섯 곳'에서만 */
```

**선 굵기 규칙**: 화면에서 선이 항상 약 1.33~2px로 보이게 `viewBox` 단위 굵기를 크기별로 바꾼다. 16px = 2(1.33px) · 20px = 1.75(1.46px) · 24px = 1.5(1.5px) · 32px = 1.5(2px). 범위는 요청하신 1.5~2 안이다.

### 3-2. UI 아이콘

공통 마크업은 문 아이콘과 같고 클래스만 `cc-ic cc-ic--16` / `--20` / `--24`다(스타일은 위 §3-1의 `.cc-di, .cc-ic` 공유 규칙).

| 이름 | 쓰는 곳 | 원천 | `d` | 기본 크기 |
|---|---|---|---|---|
| `external` (↗) | ExternalLink | 자체 | `M7 17 17 7M9 7h8v8` | 16 고정 |
| `chevron` (펼침) | `<summary>` | 자체 | `M6.5 9.5 12 15l5.5-5.5` | 20 |
| `file` | DropZone · FileRecognitionList · ScriptViewer 머리 | lucide `file-text` (ISC) | `M6 22a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h8a2.4 2.4 0 0 1 1.704.706l3.588 3.588A2.4 2.4 0 0 1 20 8v12a2 2 0 0 1-2 2zM14 2v5a1 1 0 0 0 1 1h5M10 9H8M16 13H8M16 17H8` | 20 (DropZone 안 24) |
| `back` (←) | "← 리포트로" 링크 | 자체 | `M19 12H6M11.5 6.5 6 12l5.5 5.5` | 16 |
| `close` (×) | FileRecognitionList [빼기], `<dialog>` 닫기 | 자체 | `M7 7l10 10M17 7 7 17` | 16 |

- 체크박스의 체크 표시는 아이콘이 아니라 CSS(`::after` 테두리 회전)다(§5-9).
- **쓰지 않는 것**: 방패 · 자물쇠 · 인증 마크류(보증으로 읽힘), 원 · 삼각형 · 마름모 · 사각형 안에 기호가 든 경고 아이콘(상태 도형과 혼동), 복사 아이콘(복사 버튼 없음, 방향서 §7-4), 스피너(움직임 금지), 이모지.
- 본문 중 화살표 `→` · `←`는 아이콘이 아니라 문자로 쓴다(문장 속 연결용). 비교 표의 `→`는 `aria-hidden`.

### 3-3. 파비콘 (data: SVG, 열쇠 구멍 글리프)

잉크색 둥근 사각 타일 위에 흰 열쇠 구멍(원 + 아래로 넓어지는 홈)이다. 라이트 · 다크 탭 어디서도 흰 구멍이 보이도록 타일을 어둡게 했다.

```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><rect width="32" height="32" rx="7" fill="#15181D"/><circle cx="16" cy="12.5" r="4.6" fill="#fff"/><path d="M13.7 15.5h4.6l1.9 9.5h-8.4z" fill="#fff"/></svg>
```

`<head>`에 넣는 형태(속성은 큰따옴표, 내부는 작은따옴표, `#`은 `%23`, `<` `>`는 `%3C` `%3E`):

```html
<link rel="icon" href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'%3E%3Crect width='32' height='32' rx='7' fill='%2315181D'/%3E%3Ccircle cx='16' cy='12.5' r='4.6' fill='%23fff'/%3E%3Cpath d='M13.7 15.5h4.6l1.9 9.5h-8.4z' fill='%23fff'/%3E%3C/svg%3E">
```

- 약 330바이트다. CSP는 `img-src data:`가 허용한다(방향서 §2-2).
- 다크 탭 막대 위에서 타일 윤곽이 약해 보일 수 있다 [설계 판단]. 흰 구멍이 식별 신호다. 3개 브라우저 탭 표시는 STEP 5 확인 항목이다 [미확인].

### 3-4. 크기 · 정렬 규칙

- 글자 옆 아이콘은 `vertical-align: -.2em`(상태 · 문 · UI 공통), 플렉스 안에서는 `align-items: center`와 `flex: none`.
- 아이콘과 글자 사이 간격은 6px(배지 · 칩) 또는 8px(버튼 · 문 머리).
- 아이콘만 있는 버튼은 만들지 않는다. 항상 글자가 함께 있다.

### 3-5. 라이선스(ISC) 표기 방법

- **어떤 아이콘이 lucide 유래인가**: `door-closed`(현관) · `key-round`(열쇠) · `warehouse`(창고) · `cctv`(CCTV) · `file-text`(파일) — **5종**. 나머지 10종(상태 5 + 창문 + external + chevron + back + close)은 자체 도형이다.
- **라이선스**: lucide LICENSE는 ISC(저작권 "Copyright (c) 2026 Lucide Icons and Contributors")이고, Feather에서 파생된 일부 아이콘에는 MIT(Cole Bemis)가 따로 적용된다. 위 5종은 그 MIT 목록(조회한 목록에 없음)에 없는 것으로 확인했다 [확인: lucide LICENSE, 2026-10-19 조회. 목록이 조회 도구 요약을 거쳤으므로 완전성은 [미확인]]. 보수적으로 **ISC 고지뿐 아니라 MIT 고지도 같은 블록에 둔다.**
- **어디에 쓰나**: `_client/components/icons.ts` 맨 위에 `/*! … */` 주석을 둔다. 방향서 §2-3이 esbuild `legalComments:'eof'`를 정했고, esbuild는 `/*!`로 시작하거나 `@license` · `@preserve`를 포함한 주석을 법적 주석으로 보존한다 [일반 지식]. 번들 JS 끝에 남는다. **G5에서 번들 끝에 이 주석이 남았는지 grep으로 확인한다.**
- 추가로 V8('이 도구에 대해')에 접힌 '오픈소스 고지' 한 곳을 두기를 UX에 요청한다(§9-2).

```ts
/*!
 * Icons: door-closed, key-round, warehouse, cctv, file-text are adapted from Lucide (https://lucide.dev).
 *
 * ISC License
 * Copyright (c) 2026 Lucide Icons and Contributors
 * Permission to use, copy, modify, and/or distribute this software for any purpose with or without fee is
 * hereby granted, provided that the above copyright notice and this permission notice appear in all copies.
 * THE SOFTWARE IS PROVIDED "AS IS" AND THE AUTHOR DISCLAIMS ALL WARRANTIES WITH REGARD TO THIS SOFTWARE
 * INCLUDING ALL IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS. IN NO EVENT SHALL THE AUTHOR BE LIABLE
 * FOR ANY SPECIAL, DIRECT, INDIRECT, OR CONSEQUENTIAL DAMAGES OR ANY DAMAGES WHATSOEVER RESULTING FROM LOSS
 * OF USE, DATA OR PROFITS, WHETHER IN AN ACTION OF CONTRACT, NEGLIGENCE OR OTHER TORTIOUS ACTION, ARISING OUT
 * OF OR IN CONNECTION WITH THE USE OR PERFORMANCE OF THIS SOFTWARE.
 *
 * Some Lucide icons are derived from Feather (MIT License, Copyright (c) 2013-present Cole Bemis). This notice is
 * kept in case any icon above is among them: permission is granted free of charge, without restriction, provided
 * this copyright notice and permission notice are included in all copies or substantial portions of the software.
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND.
 */
```

### 3-6. 아이콘 예산

| 항목 | 크기 [추정] |
|---|---|
| 상태 도형 5종 path 데이터 | 약 0.4KB |
| 문 아이콘 5종 `d` | 약 1.2KB |
| UI 아이콘 5종 `d` | 약 0.35KB |
| 렌더 래퍼 코드(`StateIcon` · `DoorIcon` · `Icon`) | 약 0.6KB |
| ISC 고지 주석 | 약 1.4KB |
| **합계** | **약 4KB** (예산 8KB) |
| 파비콘 data: URL(HTML `<head>`) | 약 0.33KB (별도) |

실측은 D4 통합 때 프론트팀장이 한다. 아이콘을 추가하려면 이 표를 먼저 고치고 디자인팀장 승인을 받는다.

---

## 4. 타이포 · 간격 · 레이아웃

### 4-1. 글꼴

- 본문 `--cc-font` / 고정폭 `--cc-mono`는 §1-2의 값을 그대로 쓴다. 설치돼 있을 때만 쓰이는 이름(Pretendard 등)과 `system-ui`는 넣지 않는다(기기별 편차). 고정폭은 해시 · 명령 · ID · 리소스 이름에만 쓴다.
- 4개 OS(Windows · macOS · Android · iOS)의 실제 렌더는 STEP 5에서 본다 [미확인].

### 4-2. 크기 · 행간 · 굵기

| 역할 | 토큰(모바일 → ≥600) | 행간 | 굵기 | 쓰는 곳 |
|---|---|---|---|---|
| 디스플레이 | 24 → 30 | 1.35 | 700 | V0 한 줄 약속 **한 곳만** |
| h1 | 20 → 24 | 1.35 | 700 | 화면 제목 |
| h2 | 18 → 20 | 1.35 | 700 | 섹션 · 문 이름 |
| h3 | 16 → 18 | 1.35 | 600 | 점검 제목(RuleRow) · 카드 제목 |
| 본문 | 16 | 1.6 | 400 | 문장 |
| UI | 14 | 1.5 | 400 / 600 | 표 · 칩 · 보조 문장 · 작은 버튼 |
| 캡션 | 13 | 1.5 | 400 / 600 | 꼬리표 · 면책 · 호스트 · 코드 뷰어 |
| 숫자(분포 칩) | 18 | 1.2 | 700 | 분포 칩 숫자 |
| 코드 | mono 14 (명령 · 인라인) / 13 (스크립트 뷰어) / 16 (해시) | 1.6 | 400 | |

- 크기는 13 / 14 / 16 / 18 / 20 / 24 / 30 일곱 개뿐이다. 13 미만은 쓰지 않는다. 굵기는 400 / 600 / 700 셋뿐이다.
- 숫자 · 시각에는 `tabular-nums`를 쓴다(`body`에 건다. `font` 단축 속성 **뒤에** 선언해야 초기화되지 않는다).
- 입력칸은 16px다(iOS가 16px 미만 입력칸에서 확대한다 [일반 지식]).
- 한국어 문장: `word-break: keep-all` + `overflow-wrap: break-word`. 사용자 데이터(리소스 이름 · ARN · 파일 이름): `.cc-any`(`overflow-wrap: anywhere; word-break: normal`).
- 대소문자 변환 · 자간 조정 · 텍스트 그림자는 쓰지 않는다.

### 4-3. 해시 8자리 묶음 (CSS로만)

64자를 8자씩 `<span class="cc-hash__g">` 8개로 나누고, 묶음 사이에 `<wbr>`만 둔다(공백 문자 없음). 간격은 `margin-right`다. 복사하면 64자가 이어진 그대로 나와야 한다.

```html
<code class="cc-hash" translate="no"><span class="cc-hash__g">a1b2c3d4</span><wbr><span class="cc-hash__g">e5f6a7b8</span><wbr><!-- … 8묶음 … --><span class="cc-hash__g">0f1e2d3c</span></code>
```

- 16px 고정폭 8자 ≈ 77px, 8묶음 ≈ 680px라 880px 본문에서는 한 줄이다. 360px에서는 `<wbr>`에서 줄이 바뀌어 한 줄에 3묶음씩 놓인다.
- 클릭 한 번에 전체가 선택된다(`user-select: all`). 복사 결과가 공백 · 개행 없이 64자인지 3개 브라우저에서 확인한다 [미확인, STEP 5]. 이어지지 않으면 `.cc-hash__g`를 `display:inline-block`으로 바꾸는 대안을 시험한다.

### 4-4. 간격 · 반경 · 선

- 간격 스케일: 4 / 8 / 12 / 16 / 24 / 32 / 48 / 64px (`--cc-sp-1 … 16`).
- 반경: 4px(배지 · 칩 · 입력 · 버튼) / 6px(패널 · 카드 · 행 · `<dialog>`). 알약 모양과 그림자는 없다.
- 선: 1px(구분 · 일반 경계) / 1.5px(입력 · 버튼) / 2px(강조 · 선택됨 · `<dialog>`) / 3px(쓰기 명령 블록) / 띠 4px(6px: 확인 불가).

| 용도 | 값 |
|---|---|
| 컴포넌트 안쪽 여백 | 칩 `0 8px` · 배지 `2px 8px` · 패널 `16px`(≥600 `24px`) · 버튼 `10px 16px` · 표 칸 `10px 12px` |
| 블록 사이 | 16px(같은 묶음) · 24px(묶음) · 32px(≥600 섹션) · 48px(문 섹션 사이, ≥600) |
| 점검 행 사이 | 8px |
| 화면 위 여백(헤더 아래) | 24px(≥600 32px) |

### 4-5. 레이아웃 · 그리드

- 본문 컨테이너 최대 폭 **880px**(`.cc-wrap`), 스크립트 뷰어 · 발자국 표 · 넓은 표는 **1040px**(`.cc-wrap--wide`). 좌우 여백 `--cc-gutter`: 16 / 24 / 32px.
- 브레이크포인트 **600 / 1024**(모바일 퍼스트). 600 미만: 한 열 · 표는 카드형. 600~1023: 카드 2열 · 표는 표. 1024 이상: 범위 패널 2열 · 체험 세트 4열.
- 그리드: 12열 시스템은 쓰지 않는다. 필요한 곳에 `display:grid`로 직접 만들고 열 수는 **클래스 변형**(`cc-cols-2`)이나 `data-*` 속성으로 정한다(`style` 속성 금지).
- 터치 대상 최소 **44px**(`--cc-hit`): 버튼 · 입력 · `<summary>` · 체크박스 · 라디오 줄.
- 높이를 고정하지 않는다(`min-height`만). 글자 간격 조정(WCAG 1.4.12) · 200% 확대 · 320px 재배치(1.4.10)에서 내용이 잘리지 않게 한다.
- 스티키 스택: 띠(`position: sticky; top: 0; z-index: 40`) → 고정 맥락 줄(`top: var(--cc-band-h)`, `z-index: 30`). 화면 높이가 520px 이하이면 둘 다 `position: static`이다(스티키가 화면을 가림). 체험 프레임은 `z-index: 50`. `html`에 `scroll-padding-top: 88px`.

### 4-6. 움직임

- 허용은 3가지뿐이다: (1) `<details>` 펼침 때 내용 페이드인 120ms, (2) 펼침 화살표(chevron) 회전 120ms, (3) 띠가 줄어들 때 보조 줄 `max-height` 120ms. 접힘은 `<details>`의 한계로 즉시 닫힌다.
- `prefers-reduced-motion: reduce`이면 모든 `animation` · `transition`이 없다(§6-2).
- 숫자 카운트업 · 진입 애니메이션 · 축하 연출 · 스피너 · 스켈레톤은 없다. "읽는 중"은 글자로만 표시한다(워커 금지, 방향서 §2-2).

---

## 5. 컴포넌트 시각 규격

### 5-0. 공통 규칙과 연결표

**공통 상태 규칙** (컴포넌트에 따로 적지 않으면 이 규칙을 따른다)

| 상태 | 규칙 |
|---|---|
| hover(인터랙티브만) | 바탕 `--cc-hover`. 링크는 밑줄 2px. 카드 경계는 ink. **글자색은 바뀌지 않는다.** |
| focus-visible | `outline: 2px solid var(--cc-focus); outline-offset: 2px`. 반전 요소 안은 `--cc-inv-ink`. `overflow: hidden` 컨테이너 안에서는 `outline-offset: -3px` |
| disabled | 점선 1.5px `--cc-line-strong` + 글자 `--cc-ink-3` + `cursor: not-allowed` + `aria-disabled="true"` |
| active/pressed | hover와 같다(별도 색 없음) |
| 인쇄 | print.css(§6-3)가 일괄 처리. 컴포넌트에서 따로 적은 것만 예외 |
| 360px | 기본 스타일이 모바일이다(모바일 퍼스트). 아래 "360px"는 600 미만에서의 배치다 |

**클래스 인덱스** (전부 `cc-` 접두. Tailwind 유틸리티 이름과 겹치는 클래스 이름을 쓰지 않는다)

| 컴포넌트 | 루트 클래스 | 컴포넌트 | 루트 클래스 |
|---|---|---|---|
| StateBadge | `.cc-sb` | FixSteps | `.cc-fix` |
| StateIcon | `.cc-si` | CommandBlock | `.cc-cmd` |
| DoorIcon | `.cc-di` | ImpactChip | `.cc-impact` |
| LabelChip | `.cc-chip` | ScriptViewer | `.cc-sv` |
| ExceptionBand | `.cc-excl` · `.cc-exc` | FootprintTable | `.cc-fp` |
| ExternalLink | `.cc-ext` | HashDisplay | `.cc-hash` |
| AppHeader | `.cc-hdr` | PathCard | `.cc-card.cc-path` |
| Beta/DemoBand | `.cc-band` · `.cc-demo-frame` | CloudChoiceCard | `.cc-cloud` |
| StickyContextBar | `.cc-ctx` | DropZone | `.cc-drop` |
| ScopePanel | `.cc-scope` | PasteBox | `.cc-paste` |
| DoorCollectionRow | `.cc-dcr` | FileRecognitionList | `.cc-fr` |
| DistributionChips | `.cc-dist` · `.cc-dc` | BeforeAfterTable | `.cc-ba` |
| Banner | `.cc-banner` | IdentityCompare | `.cc-idc` |
| PriorityList / UnlockList | `.cc-pl` · `.cc-ul` | DemoSetPicker | `.cc-ds` |
| DoorSection | `.cc-door` | BootFallback | `.cc-boot` |
| RuleRow | `.cc-rule` | MaskedValue | `.cc-mv` |
| TargetTable | `.cc-tt` | 공용 | `.cc-btn` `.cc-in` `.cc-ta` `.cc-box` `.cc-opt` `.cc-dlg` `.cc-wrap` `.cc-stack` `.cc-vh` `.cc-skip` |
| ManualCheckList | `.cc-mc` | 인쇄 · 구조 | `.cc-print-only` `.cc-noprint` `.cc-po` `.cc-pc` `.cc-report` `.cc-manual` `.cc-actions` |
| GuideCard · Disclaimer · PrintOptions · ExceptionForm | `.cc-guide` · `.cc-disc` · `.cc-popt` · `.cc-xf` | 루트 상태 클래스 | `cc-compact` `cc-file` `cc-print-full` `cc-print-manual` `cc-screen-masked` |

**모델(§5-2 방향서) ↔ 컴포넌트 연결표(초안, 최종 대조표는 디자인팀장)**

| 모델 | 컴포넌트 | 비고 |
|---|---|---|
| `Status` | StateBadge · StateIcon · DistributionChips · RuleRow | 글자: risk 위험 / caution 주의 / clear 이상 없음 / unknown 확인 불가 / na 해당 없음 |
| `DoorId` | DoorIcon · DoorSection · DoorCollectionRow | mfa 현관 / key 열쇠 / net 창문 / sto 창고 / log CCTV (순서 고정) |
| `DoorResult.collection` | DoorCollectionRow | collected / partial / not-collected |
| `Report.banners` · `TimeNotice` · `ExceptionOverlay.counts` | Banner | §5-3 매핑표 |
| `Label.kind` | LabelChip · ExceptionBand | exception은 ExceptionBand |
| `DisplayValue` | MaskedValue | plain / sensitive(이중 렌더) / redacted |
| `RuleResult` | RuleRow | |
| `ItemResult` | TargetTable | |
| `ManualCheckItem` | ManualCheckList · GuideCard | |
| `FirstLook` | PriorityList / UnlockList | mode: findings / unlock / none-found |
| `PermissionsBlock.unlockHints` | ScopePanel(권한 줄) · UnlockList | |
| `FixGuide` · `CliTemplate` · `GuideCard` | FixSteps · CommandBlock · ImpactChip · ExternalLink | segments의 `ph`는 자리표시자 |
| `InputRecognition` | FileRecognitionList · Banner(unknown) | |
| `Comparison` | BeforeAfterTable · IdentityCompare | |
| `IdentityBlock` | StickyContextBar · ScopePanel · IdentityCompare | |
| `Report.mode.kind === "demo"` | DemoBand · 체험 프레임 · DemoSetPicker | |

### 5-1. 기본 요소 (6)

**StateBadge** — `<span class="cc-sb cc-st--risk [cc-sb--sm|cc-sb--lg]"><svg class="cc-si cc-si--risk" …/><span class="cc-sb__t">위험</span></span>`
- 구조: 아이콘(16 또는 20) + 글자. 글자는 상태 5개 고정 문자열이고 줄바꿈하지 않는다(`white-space: nowrap`).
- 시각: md 높이 ≥28px · 패딩 `2px 8px 2px 6px` · 간격 6px · 14px / 600 · 반경 4px · 바탕 `--cc-st-bg` · 테두리 1px `--cc-st-line`(해당 없음만 점선, 바탕 없음) · 글자 `--cc-st-ink`. sm(표 · 칩 안): ≥24px · 13px · 아이콘 16. lg(V4 머리): ≥32px · 16px · 아이콘 20 · 간격 8px. RuleRow 요약줄 · 먼저 볼 3개 행은 md.
- 상태: 비인터랙티브(hover · focus 없음). 인쇄: `print-color-adjust: exact`. 바탕이 안 찍혀도 모양 · 글자 · 테두리가 남는다.
- 토큰: `--cc-st-*`, `--cc-r-1`. 360px: 변화 없음. 좁아도 글자를 줄이지 않고 배지째 다음 줄로 내린다.

**StateIcon** — §2-2 그대로. 단독으로 쓰는 곳: 범례 · 분포 칩 · 맥락 줄의 '확인 불가 n' 앞. 항상 글자가 옆에 있다.

**DoorIcon** — §3-1 그대로. 24px: DoorSection 머리 / 20px: DoorCollectionRow / 32px: V0 '다섯 곳' 한 줄(5열, 360px에서도 5열: 아이콘 32 + 13px 이름 4자 이하라 들어간다). 잉크색, 상태 색 금지.

**LabelChip** — `<span class="cc-chip [cc-chip--hint|cc-chip--strong|cc-chip--inv|cc-chip--soon]">의도된 공개 후보</span>`
- 시각: 높이 ≥24px · 패딩 `0 8px` · 13px / 600 · 반경 4px · 바탕 `--cc-bg` · 글자 `--cc-ink-2` · 테두리 1px `--cc-line-strong`. 상태 색을 쓰지 않는다.
- 변형: `--hint`(점선 테두리: 이름 힌트 · 오래된 버킷 힌트처럼 **확정이 아닌 추정**) / `--strong`(테두리 1.5px `--cc-ink` · 글자 `--cc-ink`: "못 본 것 n" · "직접 볼 것 n" — 초록 옆에서 눈에 띄어야 한다) / `--inv`(잉크 채움: "권장" 등 한 화면에 1개 이하, 인쇄에서 테두리형) / `--soon`(점선 + `--cc-ink-3` 글자: "준비 중").
- 종류별 문구는 UX가 정한다(`intended-public-candidate` · `name-hint` · `legacy-hint` · `unusual-characters` · `self-answer`).
- 360px: 줄바꿈 허용(`white-space: normal`), 긴 칩은 다음 줄로.

**ExceptionBand** — 대상 행에 붙는 예외 표시. 행에 `.cc-exc`(`data-exc="active|expired"`), 라벨에 `.cc-excl`.
- 시각: 행의 첫 칸(카드형에서는 행 전체)에 `border-left: 4px solid var(--cc-exc)`. 라벨은 13px / 600 · 글자 `--cc-exc-ink` · 바탕 `--cc-exc-bg` · 테두리 1px `--cc-exc` · 반경 4px. 문구는 "예외 표시(상태는 그대로): 사유 · 만료일". **상태 배지는 그대로 두고 대상을 숨기거나 접지 않는다.**
- `expired`: 띠와 라벨 테두리가 점선, 문구 "만료되어 해제됨". `unmatched`("대상 없음")는 대상 행이 없으므로 배너(exception) 안 목록에서 보인다.
- 360px: 라벨이 사유 아래 줄로 내려간다.

**ExternalLink(DocLink)** — 
```html
<a class="cc-ext" href="https://docs.aws.amazon.com/…" target="_blank" rel="noopener noreferrer"><span class="cc-ext__t">IAM 사용자 MFA 설정</span> <span class="cc-ext__x"><span class="cc-ext__host">docs.aws.amazon.com</span><svg class="cc-ic cc-ic--16 cc-ext__i" …/></span><span class="cc-vh">새 탭에서 열림</span></a>
```
- 시각: 글자 잉크 · 밑줄 항상(1px, hover 2px) · 호스트 13px 고정폭 `--cc-ink-2` · ↗ 16px. 호스트와 ↗는 한 덩어리(`white-space: nowrap`)로 줄바꿈에서 떨어지지 않게 한다. 방문 여부로 색을 바꾸지 않는다.
- 상태: hover 밑줄 2px · focus 링 · 인쇄에서는 `href` 전체를 뒤에 붙이고 호스트 덩어리는 숨긴다(§6-3).
- 허용 호스트만 렌더(`LINK_HOSTS`, 관문 컴포넌트가 강제). 360px: 호스트 덩어리가 다음 줄로 내려갈 수 있다.

### 5-2. 머리 · 띠 (3)

**AppHeader** — `<header class="cc-hdr"><div class="cc-wrap cc-hdr__in"><a class="cc-hdr__brand">문단속 5</a><nav class="cc-hdr__nav" aria-label="보조 메뉴">…링크 2개…</nav></div><p class="cc-hdr__off" hidden>오프라인판(파일)으로 열려 있습니다</p></header>`
- 시각: 높이 ≥56px · 바닥 1px `--cc-line` · 바탕 `--cc-bg`. 워드마크 18px / 700 잉크(**밑줄 없음, hover 때 밑줄**: §0-2 예외). 메뉴 링크 14px / 600 밑줄 · 높이 44px(좌우 패딩 8px). 오프라인판 안내 줄: 바탕 `--cc-surface` · 13px · 바닥 1px `--cc-line`.
- 상태: 현재 화면 링크 `aria-current="page"` → 700 + 밑줄 2px. 스티키 아님(스크롤하면 사라진다).
- 360px: 워드마크 + 링크 2개가 한 줄(간격 8px). 오프라인판 줄은 전체 폭. 메뉴 접기(햄버거)는 쓰지 않는다.

**BetaBand / DemoBand** — 
```html
<div class="cc-band" role="region" aria-label="베타 안내"><p class="cc-band__row"><span class="cc-band__tag">베타</span><strong>실계정 검증 전</strong></p><p class="cc-band__more">판정이 틀릴 수 있습니다. …</p></div>
<div class="cc-band cc-band--demo" …><p class="cc-band__row"><span class="cc-band__tag">체험 모드</span><strong>가짜 데이터</strong></p><p class="cc-band__more">…</p></div>
<div class="cc-demo-frame" aria-hidden="true"></div>   <!-- 체험 모드에서만, 앱 루트 안 -->
```
- 규격표는 §7-1. 닫기 버튼 없음. 위쪽에 붙고(`position: sticky; top: 0`), 스크롤이 24px를 넘으면 JS가 `<html>`에 `cc-compact`를 붙여 `.cc-band__more`를 접는다(120ms). 24px 아래로 돌아오면 8px 이력(히스테리시스)을 두고 푼다.
- 접힌 높이는 `--cc-band-h`(28px)다. 패딩 5px + 줄 높이 18px로 맞췄다. 한 줄 안에는 태그 + 굵은 짧은 구절만 둔다(360px에서도 한 줄).
- 체험 프레임: `position: fixed; inset: 0; border: 4px solid var(--cc-demo); pointer-events: none; z-index: 50`. 클릭을 막지 않고, 인쇄에서는 숨긴다.

**StickyContextBar** — `<div class="cc-ctx" role="region" aria-label="점검 대상 계정">` 안에 별칭(굵게) · 끝 4자리(고정폭) · 클라우드 · `<time>` 기준 시각(KST) · StateBadge sm('확인 불가 n') · 예외 n.
- 시각: 최소 높이 40px · 패딩 `6px var(--cc-gutter)` · 14px · 바탕 `--cc-bg` · 바닥 1px `--cc-line-strong` · `position: sticky; top: var(--cc-band-h); z-index: 30`. 항목 사이 구분자 "·"(문자). 스크린샷 어디서 잘라도 누구 계정의 언제 상태인지 함께 찍히게 하는 장치다(팀장 원문 §1-5).
- 상태: 정적. 인쇄에서는 숨기고 인쇄 머리가 같은 정보를 싣는다. 
- 360px: 줄바꿈 허용(최대 2줄), 별칭이 길면 첫 항목만 말줄임(`text-overflow: ellipsis`, 최대 폭 16em). 높이를 고정하지 않는다.

### 5-3. 리포트 상단 (5)

**ScopePanel** (접을 수 없음) — `<section class="cc-scope" aria-labelledby="…"><h2>조회 범위</h2><dl class="cc-scope__dl"><div class="cc-scope__row"><dt>신원</dt><dd>…</dd></div>…</dl><div class="cc-scope__cannot">…</div></section>`
- 시각: 테두리 1px `--cc-line-strong` · 반경 6px · 바탕 `--cc-surface` · 패딩 16(≥600 24). 행은 `dt`(14px / 600 `--cc-ink-3`, 폭 6em) + `dd`(14px 잉크) 두 열. 행 사이 1px `--cc-line`. ≥1024에서 `dl`을 2단(`columns: 2; column-gap: 32px; break-inside: avoid`)으로 압축한다.
- **권한 해제 힌트 문장은 항상 보이는 블록**: 확인 불가 톤 — `.cc-st--unknown.cc-hatch`, 바탕 `--cc-unknown-bg`, 왼쪽 6px 띠 + 빗금, 16px / 600. 거부 목록은 상위 3개만 보이고 나머지는 `<details>`(요약 줄 "거부 n개 더 보기"). 권한 이름은 고정폭.
- '이 도구가 보지 못하는 것 7가지'는 전부 노출(`<ul>`, ≥600 2열). 각 줄 14px, 줄 사이 구분선. "못 막는 경로 4가지 →" 링크는 오른쪽 위.
- 상태: 정적. 인쇄: 그대로 출력(머리 아래 위치), 거부 목록 `<details>`는 `.cc-po`로 펼친다.
- 360px: `dt` 위 · `dd` 아래 쌓기(간격 4px), 2단 없음.

**DoorCollectionRow** (문별 수집 줄) — `<ul class="cc-dcr" role="list"><li class="cc-dcr__i cc-dcr__i--collected">…</li>…</ul>`
- 시각: 항목 5개 `grid-template-columns: repeat(auto-fit, minmax(150px, 1fr))`, 간격 8px. 항목: 패딩 `8px 10px` · 반경 4px · DoorIcon 20 + 문 이름 14px / 600 + 수집 상태 글자 13px(수집함 / 일부(리전 1) / 수집 안 함) + 사유 13px `--cc-ink-3`. **색 없음**(판정이 아니라 수집 상태).
- 구분: `--collected` 테두리 1px 실선 `--cc-line-strong` / `--partial` 같음 + 상태 글자 700 / `--none` 테두리 **점선** + 글자 `--cc-ink-2`. 글자가 의미를 갖고, 테두리는 보조다.
- 360px: 2열(5번째는 전체 폭). PathCard 안의 축약형은 한 줄 5열(이름만).

**DistributionChips** (+ 범례) — 
```html
<p class="cc-dist__lead">점검 10개</p>
<ul class="cc-dist" role="list">
  <li class="cc-dc cc-st--risk"><svg class="cc-si cc-si--20 cc-si--risk" …/>위험 <span class="cc-dc__n">2</span></li>
  …  <!-- 순서 고정: risk, caution, unknown, clear, na (STATUS_ORDER) -->
</ul>
<dl class="cc-legend">…상태 범례 1줄…</dl>
```
- 시각: 칩 높이 ≥36px · 패딩 `4px 12px 4px 8px` · 간격 6px · 14px / 600 · 반경 4px · 바탕 `--cc-st-bg` · 테두리 1px `--cc-st-line`(해당 없음 점선, 바탕 없음) · 숫자 18px / 700. **모든 칩은 같은 크기다.** 칩 사이 8px. 0도 표시한다: `.cc-dc--zero`는 바탕 없음 · 테두리 `--cc-line` 실선 · 글자 `--cc-ink-2` · 숫자 400 (**아이콘은 상태 색 유지**).
- 문 머리 칩은 같은 컴포넌트의 sm 변형(`.cc-dc--sm`: ≥28px · 13px · 숫자 14px · 아이콘 16), 0은 생략한다. 메인 분포 칩의 아이콘은 20px다.
- 범례: 13px, 칩과 같은 순서 · 아이콘 + 글자 + 한 줄 뜻. 툴팁에만 숨기지 않는다. 미판정 d > 0이면 그 아래에 "아직 판단하지 못한 점검이 d개 있습니다 → 직접 볼 목록"을 `unknown` 톤 한 줄로 고정한다(UX 문구).
- 막대 · 도넛 · 비율은 쓰지 않는다(점수처럼 읽힌다).
- 360px: 칩이 줄바꿈되어 2~3개씩. 앞의 "점검 N개"는 한 줄 위로 올라간다.

**Banner (6변형)** — `<div class="cc-banner cc-banner--info" role="note"><p class="cc-banner__t">제목</p><p class="cc-banner__b">내용</p><div class="cc-banner__act">…</div></div>` (`__act` 동작 영역은 있을 때만)
- 공통: 패딩 `12px 16px` · 14px / 1.5 · 반경 6px · 테두리 1px + 왼쪽 4px 띠 · **닫기 버튼 없음**. 제목 700.

| 변형 | 바탕 / 글자 | 테두리 · 띠 | 쓰는 곳 |
|---|---|---|---|
| `info` | `--cc-surface` / 잉크 | 1px `--cc-line-strong` · 띠 `--cc-ink-2` | 일반 공지 |
| `scope` | 투명 / 잉크 | **점선** 1px · 띠 점선 | 판정하지 않은 범위 안내 |
| `strong` | `--cc-inv-bg` / `--cc-inv-ink`, 16px | 테두리 같은 색 · 띠 없음 | 7일 초과 · 비밀 패턴 감지 **두 가지뿐** |
| `exception` | `--cc-exc-bg` / `--cc-exc-ink` | 1px `--cc-exc` · 띠 `--cc-exc` | 예외 n건 적용(만료 m건 해제) |
| `unknown` | `--cc-unknown-bg` / `--cc-unknown-ink` | 1px `--cc-unknown-line` · **6px 띠 + 빗금** | 입력 읽기 실패 · 계정 불일치(확인 불가 톤) |
| `demo` | `--cc-demo-bg` / `--cc-demo-ink` | 1px `--cc-demo` · 띠 `--cc-demo` | 체험 안내 · "Azure 실제 점검은 준비 중" |

- **엔진 출력 → 변형 매핑(초안)**

| 출처 | 종류 | 변형 |
|---|---|---|
| `Banner.kind` | `secrets-detected` | `strong` |
| | `areas-not-judged` · `csv-scope-unproven` · `doors-skipped` | `scope` |
| | `schema-newer-minor` · `identity-unconfirmed` · `collector-unknown-release` · `collected-at-approximate` · `duplicate-input-ignored` | `info` |
| `TimeNotice` | `snapshot-age` stale(24시간) | `info` |
| | `snapshot-age` very-stale(7일) | `strong` |
| | `future-timestamp` · `guidance-stale` | `info` |
| `ExceptionOverlay.counts` | 적용 · 만료 · 대상 없음 | `exception` |
| `InputRecognition.status` | `empty` · `wrong-type` · `parse-error` · `not-cloudcheck` · `schema-major` · `credentials-file` · `too-large` · `too-deep` · `account-mismatch` · `cloud-mismatch` | `unknown` |
| 앱 설정 | 체험 안내 · 클라우드 준비 중 | `demo` |

- 입력 오류를 `unknown`(회색) 톤으로 묶은 것은 팀장 원문 §1-1 g('확인 불가 톤의 오류 패널')를 따른 것이다. 판정의 '확인 불가'로 오독되지 않게 **오류 패널에는 상태 아이콘(■)을 쓰지 않고** 제목 글자("읽지 못했습니다" 등)와 빗금 띠만 쓴다 [설계 판단].
- 360px: 변화 없음. 동작 버튼이 있으면 아래 줄 전체 폭.

**PriorityList / UnlockList** (먼저 볼 3개 · 먼저 풀 것) — `<ol class="cc-pl" role="list"><li class="cc-pl__i cc-st--risk">…</li>…</ol>`
- 시각: 항목마다 RuleRow 요약과 같은 틀 — 왼쪽 띠 4px(`--cc-st-icon`; 확인 불가는 6px + 빗금) · 테두리 1px `--cc-line` · 반경 6px · 패딩 `12px 16px` · 간격 8px. 구성: StateBadge(md) + 점검 제목(h3 16/18px) + 사유 한 줄(14px `--cc-ink-2`) + 오른쪽 [고치는 법] 버튼(sm) + '대상 n' LabelChip. **번호 장식을 쓰지 않는다**(순위처럼 읽힘). `<ol>` 의미만 유지.
- UnlockList(mode `unlock`): 항목은 `unknown` 톤. 권한 이름(고정폭 14px, `--cc-ph-bg` 바탕 칩) + "확인 불가 점검 n개(대상 m개)를 풀 수 있습니다" 한 줄 + 해소법 종류 라벨.
- `none-found`(전부 이상 없음 · 해당 없음): 상자 대신 `info` 배너 하나. **축하 연출 없음**, 바로 아래 '이 도구가 보지 못하는 것'을 강조한다(UX).
- 상태: 행 전체는 비인터랙티브, 버튼만 인터랙티브(hover · focus 표준). 360px: 버튼과 칩이 아래 줄 전체 폭.

### 5-4. 리포트 본문 (8)

**DoorSection** — `<section class="cc-door" aria-labelledby="…"><h2 class="cc-door__h"><svg class="cc-di cc-di--24" …/>현관 <span class="cc-door__term">MFA</span></h2><ul class="cc-door__counts" role="list">…</ul>…<ul class="cc-rules">…</ul></section>`
- 시각: 위에 2px 잉크 선(`border-top: 2px solid var(--cc-ink)`) · 머리 패딩 `16px 0 12px` · h2 20px / 700, PM 용어 병기는 14px / 400 `--cc-ink-3`. 개수 칩(sm, 0은 생략) + '직접 볼 것 n' LabelChip(`--strong`)이 머리 오른쪽(≥600, `margin-left: auto`), 360px에서는 제목 아래 줄. 문 단위 종합 배지는 **그리지 않는다**(D2).
- 구성: 점검 행(위험 → 주의 → 확인 불가 → 이상 없음, 같은 상태 안에서는 priority) → 맨 끝 "해당 없음 n개" 접힌 한 줄(`<details>`, 근거 1줄 포함) → 그 문의 실제 사례 링크 1건(ExternalLink). 문 사이 간격 48px(모바일 32).
- 문 순서는 현관 → 열쇠 → 창문 → 창고 → CCTV로 고정.

**RuleRow** — `<li class="cc-rule cc-st--risk"><details class="cc-rule__d cc-po" open><summary class="cc-rule__sum">…</summary><div class="cc-rule__body">…</div></details></li>`
- 시각: `border: 1px solid var(--cc-line); border-left: 4px solid var(--cc-st-icon); border-radius: 6px`. 확인 불가는 `border-color: var(--cc-unknown-line)` 전체 실선 + 왼쪽 6px + `.cc-hatch`. 해당 없음은 왼쪽 띠 점선.
- 요약줄(`summary`): `display: grid; grid-template-columns: auto 1fr auto; gap: 8px 12px; align-items: center; min-height: 44px; padding: 12px 16px`. 1열 StateBadge(md) · 2열 제목(h3 16/18px / 600) + 사유 한 줄(14px `--cc-ink-2`) · 3열 '대상 n' 칩 + chevron. 이상 없음 행은 사유 대신 **꼬리표**(13px: 확인한 범위 · 기준 시각) + '못 본 것 n' LabelChip(`--strong`)을 바로 옆에 둔다.
- 본문: 패딩 `0 16px 16px`. 소제목은 14px / 700 잉크, 내용 14px. 영향 한 줄 → 확인할 질문 → 대상 표(TargetTable) → 못 보는 것 → 근거(ExternalLink) → [고치는 법] 버튼(primary). 
- 상태: 요약줄 hover `--cc-hover` · focus 링 · 펼침 시 chevron 180° 회전 + 내용 페이드인 120ms. 인쇄: 위험 · 주의 · 확인 불가 행은 `.cc-po`(인쇄 전 `open`), 이상 없음 · 해당 없음 행은 `.cc-pc`(요약줄만).
- 360px: 요약줄이 `grid-template-columns: 1fr auto`로 바뀌고 StateBadge + chevron이 첫 줄, 제목 · 사유 · 칩이 아래 줄들(`grid-column: 1 / -1`).

**TargetTable** — `<table class="cc-tt"><caption class="cc-vh">…</caption><thead><tr><th scope="col">상태</th><th scope="col">대상</th>…`
- 열(≥600): 상태(StateBadge sm, 폭 120px) · 대상(MaskedValue + 종류 13px) · 위치(리전 · 구독) · 사실(facts, 14px) · 라벨 · [예외 표시] 버튼(ghost). 위반 대상이 먼저(엔진 정렬), 50개 단위 [더 보기] 버튼(table 아래 줄, secondary).
- 시각: 기본 표 스타일(§6-2) — 머리 바탕 `--cc-surface` · 13px / 700 `--cc-ink-2` · 행 구분선 1px. 행 hover `--cc-hover`. 예외 행은 `.cc-exc`.
- **360px: 카드형.** `thead`는 시각적으로만 숨기고(`.cc-vh` 방식) 각 `<td data-label="…">`가 `::before{content:attr(data-label)}`로 13px `--cc-ink-3` 레이블을 얻는다. 행 = 카드(패딩 `12px 16px` · 테두리 1px `--cc-line` · 반경 6px · 카드 사이 8px). **표를 `display:block`으로 바꾸면 접근성 트리에서 표 의미가 사라질 수 있으므로** [일반 지식] `table` · `row` · `cell` · `columnheader` role을 명시한다.

**ManualCheckList** — `<table class="cc-mc"><thead>…<th>확인</th><th>문</th><th>무엇을</th><th>왜 판단하지 못했나</th><th>어떻게 보나</th><th class="cc-mc__memo">메모</th>`
- 화면: 첫 칸에 `.cc-box`(체크박스, 선택은 임시 표시일 뿐 상태를 바꾸지 않고 새로 고침하면 사라진다). 메모 열은 화면에서 숨기고 **인쇄에서만** 보인다. '어떻게 보나'는 콘솔 위치 · 속성 · 필요 권한(권한 이름은 고정폭 칩).
- 인쇄: 행 높이 ≥10mm · 체크 칸 5mm 정사각형 · 메모 열 폭 ≥38mm · 칸마다 0.5pt 선. 도장 · 서명란 · '확인자'를 넣지 않는다(인증서처럼 보이지 않게).
- 360px: 카드형(TargetTable과 같은 방식), 체크박스가 카드 왼쪽 위.

**GuideCard** (AZ-MFA-G) — `<section class="cc-guide cc-st--unknown cc-hatch">`
- 시각: `unknown` 톤 카드(바탕 `--cc-unknown-bg` · 1px `--cc-unknown-line` · 왼쪽 6px 띠 + 빗금 · 패딩 16). 단계 3개는 `<ol class="cc-steps">`, 번호는 CSS 카운터로 28px 정사각 아웃라인 상자(1.5px 잉크, 반경 4px, 700)에 넣는다(채운 사각은 상태 도형과 혼동되므로 **아웃라인**). 본인 응답은 `예 / 아니요 / 모름` 라디오(`.cc-opt`), 선택 결과는 LabelChip "본인 응답: 예(검증 안 됨) · 상태는 확인 불가 유지".
- 360px: 번호 상자 위 · 설명 아래.

**Disclaimer** — `<p class="cc-disc">…</p>`
- 시각: 13px / 1.6 `--cc-ink-2` · 패딩 `12px 16px` · 테두리 1px `--cc-line` · 반경 6px · `max-width: 44em`. 리포트 머리(분포 아래)와 인쇄 바닥에 같은 문구(방향서 §7-2)가 놓인다. 인쇄: 테두리를 위쪽 0.75pt 한 줄로 바꾸고 바닥에 둔다.

**PrintOptions** — `<fieldset class="cc-popt"><legend>인쇄 옵션</legend><label class="cc-opt"><input type="checkbox" class="cc-box"> 이름 · ID 표시</label>…<button class="cc-btn">인쇄</button><button class="cc-btn">이 목록만 인쇄</button></fieldset>`
- 시각: 리포트 동작 줄 안에 인라인, `display: flex; flex-wrap: wrap; gap: 8px 16px; align-items: center`. 옵션 `이름 · ID 표시`는 **기본 꺼짐**이고 루트 클래스 `cc-print-full`만 바꾼다(화면은 변하지 않는다). 옵션 아래 13px `--cc-ink-3` 안내: 인쇄본에 실명이 들어간다는 경고.
- 360px: 줄바꿈 후 버튼은 전체 폭 한 줄씩.

**ExceptionForm** — `<form class="cc-xf cc-excbox">` (대상 행 아래 인라인)
- 시각: 바탕 `--cc-exc-bg` · 왼쪽 4px `--cc-exc` · 패딩 16 · 소제목 "예외 표시(상태는 그대로)" 14px / 700 `--cc-exc-ink`. 필드: 사유(`.cc-in`, 필수) · 만료일(날짜 입력, 필수, 오늘 + 1 ~ 90일) · [예외로 표시](primary) · [취소](ghost). 입력칸은 자동완성 · 맞춤법 계열을 끈다(방향서 §2-4).
- 오류: 빨강을 쓰지 않는다. 입력칸 테두리 2px 잉크 + 굵은 잉크 문장("입력 확인: …"), `aria-invalid="true"` · `aria-describedby`.
- 360px: 필드 · 버튼 모두 전체 폭 세로.

### 5-5. 고치는 법 (3)

**FixSteps** — `<ol class="cc-fix"><li class="cc-fix__s"><h3 class="cc-fix__h"><span class="cc-fix__n">1</span> 먼저 확인</h3>…</li>…</ol>` 3단계 **모두 펼친 채** 보여 준다(마법사 아님).
- 시각: 단계 번호 상자는 GuideCard와 같은 28px 아웃라인 정사각. 단계 사이에 2px `--cc-line` 세로 선(번호 상자 아래로 이어지는 장식). 본문은 번호 상자 오른쪽으로 들여쓰기. 단계 이름: ① 먼저 확인 ② 바꾸기 ③ 되돌리기(UX 최종).
- **대상 계정 줄**(`.cc-fix__acct`): V4 맨 위. `border: 2px solid var(--cc-ink)` · 반경 6px · 패딩 `12px 16px`. "대상 계정" 13px / 600 `--cc-ink-2` + 별칭 굵게 + 끝 4자리 고정폭 + 클라우드. 아래 한 줄: 셸 계정이 같은지 보라는 문장. 이 줄은 스티키 아님.
- ②·③의 명령은 **쓰기 CommandBlock**(되돌리기 명령도 쓰기다). ① 먼저 확인의 명령은 읽기 CommandBlock. 
- 인쇄: V4는 주로 화면용이다. 인쇄하면 3단계가 모두 나온다(펼침 상태라 별도 처리 불필요).
- 360px: 번호 상자 위 · 본문 아래(들여쓰기 없음).

**CommandBlock (read / write / kql)** — 복사 버튼은 **어디에도 없다.**
```html
<figure class="cc-cmd cc-cmd--write">
  <figcaption class="cc-cmd__cap">쓰기 명령 · 계정 설정을 바꿉니다</figcaption>
  <pre class="cc-cmd__pre" tabindex="0"><code>aws iam create-virtual-mfa-device --virtual-mfa-device-name <span class="cc-ph">&lt;장치이름&gt;</span> …</code></pre>
</figure>
```
- **read**: 테두리 1px `--cc-line-strong` · 바탕 `--cc-surface` · 머리 "읽기 명령"(13px / 600 `--cc-ink-2`, 바닥 1px 선).
- **write**: 테두리 **3px 잉크** · 머리를 잉크 반전(`--cc-inv-bg` / `--cc-inv-ink`, 14px / 700): "쓰기 명령 · 계정 설정을 바꿉니다". 되돌리기 명령도 같은 쓰기 블록이다.
- **kql**(Azure Resource Graph): read 스타일 + 본문 `user-select: all`(클릭 한 번에 전체 선택) + 아래 13px `--cc-ink-3` 안내 "클릭하면 전체가 선택됩니다. Ctrl+C(⌘C)로 복사하세요". 읽기 · 쓰기 명령 본문에는 전체 선택을 적용하지 않는다(방향서 §7-4).
- 본문: 고정폭 14px / 1.6 · 패딩 12px · `white-space: pre-wrap; overflow-wrap: anywhere`(가로 스크롤 없이 줄바꿈) · `tabindex="0"`(키보드 포커스).
- **자리표시자**(`.cc-ph`): 바탕 `--cc-ph-bg` · 700 · 점선 밑줄 2px(`text-decoration: underline dotted 2px; text-underline-offset: 3px`) · 꺾쇠 `<…>` 글자를 그대로 둔다. 인쇄에서 바탕이 사라져도 꺾쇠 + 점선 밑줄이 남는다.
- 상태: focus는 블록 바깥 2px 링(`overflow: hidden`을 쓰지 않는다). 인쇄: 쓰기 블록 테두리 2.5pt 실선, 머리는 검정 글자 + 아래 1.5pt 선(반전 해제).
- 360px: 변화 없음(이미 줄바꿈).

**ImpactChip** — `<span class="cc-impact cc-impact--high">운영 영향: 높음</span>`
- 시각: LabelChip 기반 무채색. **테두리 굵기로 차등**: `--low` 1px · 400 / `--mid` 1.5px · 600 / `--high` 2px · 700 (모두 `--cc-ink` 테두리). 신호등 색 금지. `prodImpact`가 있으면 옆에 같은 규칙의 "운영 중단 가능" 칩.
- 360px: 줄바꿈 허용.

### 5-6. 수집 준비 (5)

**ScriptViewer** — `<figure class="cc-sv"><figcaption class="cc-sv__bar">…</figcaption>` + 문 단위 `<details class="cc-sv__d">` 5개 + `<pre class="cc-sv__code" tabindex="0">` 안에 줄마다 `<span class="cc-sv__l">`
- 시각: 1040px 폭(`.cc-wrap--wide`) · 테두리 1px `--cc-line-strong` · 반경 6px · 바탕 `--cc-surface`. 머리줄: `file` 아이콘 20 + 파일 이름(고정폭) + "줄 수 · 호출 수" 13px. 코드 13px / 1.6 고정폭, **줄 번호는 CSS 카운터**(`::before`, `user-select: none` — 복사에 번호가 섞이지 않는다), 줄 안쪽 왼쪽 패딩 56px. 주석 줄은 `--cc-ink-3`(5.6:1) 한 단계만 구분하고 구문 강조 색은 쓰지 않는다. `white-space: pre`, 가로 스크롤(`overflow-x: auto`), 최대 높이 없음(문별 `<details>`가 접기를 맡는다). 문별 요약줄: DoorIcon 20 + 문 이름 + 줄 범위 + 호출 수.
- 상태: focus 링(포커스 가능한 스크롤 영역). 인쇄: 숨김.
- 360px: 가로 스크롤 유지(코드는 줄바꿈하지 않는다), 줄 번호 열 폭 40px.

**FootprintTable** (예상 발자국 표) — `<table class="cc-fp">` 열: 호출(고정폭 13px, 줄바꿈 허용) · 필요한 권한(고정폭 13px) · 쓰는 곳(DoorIcon 20 + 이름) · 단위 · 읽기/쓰기.
- 시각: 기본 표 + 1040px 폭. **쓰기 호출 1건**(`iam:GenerateCredentialReport`)의 행: 왼쪽 2px 잉크 띠 + "쓰기(예외 1)" 글자 700. 맨 아래 합계 줄 "호출 26종 · 쓰기 1건"(AWS).
- 360px: 카드형(TargetTable 방식), 호출 이름이 카드 제목.

**HashDisplay** — 4-3의 마크업. 
- 시각: 고정폭 16px / 1.7 · 패딩 12px · 테두리 1px `--cc-line-strong` · 바탕 `--cc-surface` · 반경 4px · `user-select: all`. 그룹 `margin-right: .75em`. 출처 라벨(PDF 인쇄본 / 저장소 / 이 페이지)은 13px / 600 위쪽.
- 비교 결과: **일치** = LabelChip(기본) "일치" / **불일치** = `--inv` 칩 "불일치 — 실행하지 마세요"(색이 아니라 반전으로 강조, 인쇄에서는 이중 테두리). '검증 통과' 같은 표현 금지.
- 360px: 한 줄 3묶음(`<wbr>`에서 줄바꿈).

**PathCard** — `<article class="cc-card cc-path"><h3>…</h3>…</article>`
- 시각: 카드 테두리 **2px** `--cc-line-strong` · 반경 6px · 패딩 16(≥600 24) · 바탕 `--cc-bg`. 구성: 제목 h3 → 문별 수집 줄(축약형: 한 줄 5열, 이름만) → '필요한 것' · '한계' 목록(14px) → [이 경로로] 버튼(primary 또는 secondary). 권장 경로에 LabelChip `--inv` "권장". 선택됨: 테두리 2px `--cc-ink`.
- 상태: hover 경계 ink · focus 링. 레이아웃 ≥600 두 열(카드 2개 같은 높이), 미만 한 열.

**CloudChoiceCard** — `<button class="cc-cloud" type="button">`(또는 링크)
- 시각: 테두리 2px `--cc-ink` · 반경 6px · 패딩 16 · 최소 높이 88px · 제목 18px / 700 "AWS 점검 시작" + 부제 14px. 브랜드 색 · 로고를 쓰지 않는다(글자만). Azure(준비 중)는 `disabled`: 점선 테두리 · `--cc-ink-3` · LabelChip `--soon` "준비 중" 포함.
- 상태: hover 바탕 `--cc-hover` · focus 링. 360px: 한 열, 카드 사이 8px.

### 5-7. 입력 · 비교 · 체험 (6)

**DropZone** — `<div class="cc-drop"><svg class="cc-ic cc-ic--24" …(file)/><p class="cc-drop__hint">끌어다 놓거나 아래 버튼으로 고르세요</p><label class="cc-btn cc-btn--primary" for="…">파일 고르기</label><input type="file" class="cc-vh" id="…"></div>`
- 시각: 테두리 **2px 점선** `--cc-line-strong` · 반경 6px · 바탕 `--cc-surface` · 패딩 `32px 16px` · 가운데 정렬. 드롭존 옆에 무전송 약속 문구(방향서 §7-2)가 놓인다(UX). **버튼이 항상 보인다**(모바일에는 드래그가 없다).
- 상태: 끌어서 올릴 때 `.cc-drop--over` → 테두리 2px **실선 잉크** + 바탕 `--cc-hover` / `:focus-within` → 링 / 읽는 중 `aria-busy="true"` + 글자 "읽는 중…" (움직임 없음). 인쇄: 숨김.
- 360px: 안내 문구(`__hint`) 숨기고 버튼만. 패딩 `24px 16px`.

**PasteBox** — `<label class="cc-lab" for="…">…</label><textarea class="cc-ta cc-paste" …>`
- 시각: 고정폭 14px / 1.6 · 최소 높이 180px(360px: 140px) · `resize: vertical` · 테두리 1.5px `--cc-line-strong` · 포커스 때 테두리 ink. 자리표시자 글자 `--cc-ink-3`. 아래 오른쪽 13px `--cc-ink-3` 글자 수. 입력칸 속성(`spellcheck=false` 등)은 방향서 §2-4.

**FileRecognitionList** — `<ul class="cc-fr" role="list"><li class="cc-fr__row">…</li>…</ul>`
- 행 구성(≥600 그리드): `file` 아이콘 20 · 파일 이름(MaskedValue, 고정폭 14px) · 종류(13px) · 계정(별칭 + 끝 4자리) · 수집 시각(`<time>`) · 상태 · [빼기](ghost, ×). 정상 행은 무채색 글자 "읽음"(**초록 아님**). 실패 행은 `unknown` 톤(6px 빗금 띠 + 사유 글자). `superseded`는 점선 테두리 + 글자 "쓰지 않음(같은 정보가 있음)".
- 360px: 카드형 — 이름이 첫 줄, 나머지는 `dl` 2열, [빼기]는 카드 오른쪽 위.

**BeforeAfterTable** — `<table class="cc-ba">` 열: 점검(DoorIcon 20 + 제목) · 이전(StateBadge sm + 대상 수) · `→`(`aria-hidden`) · 이번 · 바뀜(글자).
- 시각: 점검별 "위험 3 → 1". 비율 · 점수 · 개선율 없음. 바뀐 행은 700 + 왼쪽 2px 잉크 띠, 같은 행은 400. `became-unknown`("확인 불가가 됨")은 바뀜 칸에 LabelChip `--strong`. 맨 위 4시간 캐시 배너는 `info`. 
- 360px: 카드형(점검 이름 위, 이전 → 이번 한 줄, 바뀜 글자 아래).

**IdentityCompare** — `<div class="cc-idc"><section class="cc-idc__side">이전…</section><p aria-hidden="true">→</p><section class="cc-idc__side">이번…</section></div>`
- 시각: 두 카드(테두리 1px `--cc-line-strong` · 반경 6px · 패딩 16)가 ≥600에서 좌우, 미만에서 위아래. 카드 안: 라벨("이전"/"이번") 13px / 700 · 별칭 18px / 700 · 끝 4자리 고정폭 · 클라우드 · 수집 시각. 값이 다른 필드는 아래 2px 잉크 밑줄 + 글자. 불일치로 비교를 거부할 때는 아래에 `unknown` 배너.

**DemoSetPicker** — `<fieldset class="cc-ds"><legend>체험 세트</legend>` 카드 4개(라디오 카드) + AWS / Azure 전환(라디오 두 개)
- 시각: 카드(`.cc-card.cc-ds__c`) 테두리 2px `--cc-line-strong` · 선택됨 2px `--cc-ink` · 반경 6px · 패딩 16. 가짜 회사 이름 18px / 700, "무엇을 배우나" 한 줄 14px `--cc-ink-2`. 라디오 입력은 시각적으로 숨기고(`.cc-vh`) 형제 선택자로 포커스 링을 카드에 준다. ≥1024 4열 / ≥600 2열 / 미만 1열. 체험 모드 띠와 프레임은 이 화면부터 보인다(앱 루트 `data-mode="demo"`). Azure 선택 때 `demo` 배너: "Azure 실제 점검은 준비 중(실계정 검증 전)".

### 5-8. 부팅 · 보호 (2)

**BootFallback** — 정적 HTML 셸(스크립트가 실행되기 전 · 실패 시 보이는 내용). `<div class="cc-boot cc-banner cc-banner--strong" id="cc-boot" role="alert"><p class="cc-banner__t">판정 스크립트가 실행되지 않았습니다</p><p class="cc-banner__b">…</p></div>`
- 시각: `strong` 변형(잉크 반전). CSS는 `<head>`의 인라인 `<style>` 안에 있어 JS 없이 렌더된다. 이 블록과 V0 정적 내용은 `cc-` 기본 클래스만 쓴다. 스크립트가 부팅하면 JS가 `hidden`을 붙인다. `<noscript>` 안에도 같은 문구를 둔다(UX 문구).
- 인쇄: 숨김.

**MaskedValue** — 사용자 데이터를 그리는 유일한 통로(R-12 · R-13).
```html
<span class="cc-mv cc-any" translate="no"><bdi class="cc-mask-full">alice-prod</bdi><bdi class="cc-mask-short">user-003</bdi></span>   <!-- sensitive -->
<span class="cc-mv cc-any">eu-central-1</span>                                                                                               <!-- plain: 이중 렌더 없음 -->
<span class="cc-mv cc-mv--redacted">[가린 값]</span>                                                                                          <!-- redacted -->
```
- 화면 기본: `.cc-mask-full` 보임 / `.cc-mask-short` 숨김. 인쇄 기본(마스킹): 반대. `html.cc-print-full`(이름 · ID 표시 옵션)이면 인쇄에서도 전체. `html.cc-screen-masked`(화면 가리기 보기, P1)이면 화면에서도 마스킹본(§6-3).
- `<bdi>`로 방향을 격리하고 `.cc-any`(`overflow-wrap: anywhere`)로 긴 이름을 접는다. 제어 문자 치환 표시(`⟨U+202E⟩` 같은 형태)는 엔진이 값에 이미 넣는다. `flags`가 있으면 곁에 LabelChip "문자 치환됨".
- `redacted`: 화면은 잉크 반전 블록(고정폭 13px, 패딩 `0 6px`, 반경 4px), 인쇄는 1pt 테두리 + 검정 글자. 원값은 DOM에 없다.
- 이름 계열 값은 `translate="no"`(자동 번역 방지, 방향서 §2-4).

### 5-9. 공용 컨트롤 (표 · 버튼 · 입력 · 체크 · 대화상자)

기본 페르소나 산출물(버튼 · 인풋 · 카드 · 모달 · 네비게이션)에 해당하는 공용 규격이다. 토스트 · 탭바 · 사이드바는 **없다**(상태 알림은 `aria-live` 글자 줄, 탭은 PasteBox 전환용 `role="tablist"` 하나만 허용).

| 컨트롤 | 규격 |
|---|---|
| 버튼 `.cc-btn` | 높이 ≥44px · 패딩 `10px 16px` · 1.5px 잉크 테두리 · 반경 4px · 16px / 600. **primary** 잉크 채움(글자 `--cc-bg`) / **secondary** 투명(기본) / **ghost** 테두리 없음 + 밑줄 글자. 위험 버튼 없음. hover: secondary · ghost는 `--cc-hover`, primary는 `--cc-ink-2` 채움. `--sm`은 14px, 높이는 44px 유지. disabled: 점선 1.5px · `--cc-ink-3` · 채움 해제 |
| 입력 `.cc-in` `.cc-ta` | 높이 ≥44px · 패딩 `10px 12px` · 테두리 1.5px `--cc-line-strong`(3:1 이상) · 반경 4px · 16px. focus: 테두리 `--cc-ink` + 링. invalid: 테두리 2px 잉크 + 굵은 잉크 문장(빨강 금지). 레이블은 14px / 600 위쪽, 도움말 13px `--cc-ink-3` 아래 |
| 체크박스 `.cc-box` | 22px 정사각 · 2px 잉크 테두리 · 반경 4px · 체크 표시는 `::after`의 회전 테두리(문자 아님). 클릭 영역은 `.cc-opt` 전체(높이 44px) |
| 라디오 | 20px · `accent-color: var(--cc-ink)` · `.cc-opt` 줄 높이 44px |
| 선택 `.cc-sel` | 입력과 같은 규격(네이티브 화살표 유지) |
| 카드 `.cc-card` | 테두리 1px `--cc-line-strong` · 반경 6px · 패딩 16(≥600 24) · 바탕 `--cc-bg` · 그림자 없음. 선택 가능한 카드는 테두리 2px(선택됨 ink) |
| 대화상자 `<dialog class="cc-dlg">` | 폭 `calc(100% - 32px)` 최대 480px · 패딩 24 · 테두리 2px 잉크 · 반경 6px · 바탕 `--cc-bg`. `::backdrop`은 `--cc-scrim`. 제목 h2 20px. 버튼 줄: ≥600 오른쪽 정렬 가로, 미만 세로 전체 폭(취소 쪽 동작이 아래). 앱에서 이 하나만 쓴다(리포트 닫기 확인) |
| 표 | `<table>` · `th scope` 필수. 머리 바탕 `--cc-surface` · 13px / 700 · 행 구분선 1px. 숫자 `tabular-nums` |
| 건너뛰기 링크 `.cc-skip` | 첫 번째 포커스 가능 요소. 평소에는 화면 밖, 포커스 시 왼쪽 위에 잉크 반전 블록 |

### 5-10. 상태 매트릭스 (hover · focus-visible · disabled · 인쇄) 와 핵심 토큰

"—"는 해당 상태가 없다는 뜻이다(비인터랙티브). 인터랙티브 요소의 hover · focus-visible은 §5-0 공통 규칙을 따른다.

| 컴포넌트 | hover | focus-visible | disabled | 인쇄 | 핵심 토큰 |
|---|---|---|---|---|---|
| StateBadge | — | — | — | 배경 보존(exact), 모양 · 글자 · 테두리는 항상 | `--cc-st-*` · `--cc-r-1` |
| StateIcon | — | — | — | 그대로 | `--cc-*-icon` · `--cc-glyph` |
| DoorIcon | — | — | — | 그대로 | `--cc-ink` |
| LabelChip | — | — | `--soon` 변형이 비활성 표시 | 테두리 검정 | `--cc-line-strong` · `--cc-ink-2` |
| ExceptionBand | — | — | — | 띠(border) 인쇄 | `--cc-exc*` |
| ExternalLink | 밑줄 2px | 링 | — | `href` 전체를 뒤에 표시 | `--cc-ink` · `--cc-ink-2` |
| AppHeader | 링크 밑줄 2px | 링 | — | 숨김 | `--cc-line` · `--cc-surface` |
| Beta / DemoBand | — | — | — | 정적 한 줄(테두리) | `--cc-surface` · `--cc-demo*` |
| StickyContextBar | — | — | — | 숨김(인쇄 머리가 대신함) | `--cc-bg` · `--cc-line-strong` |
| ScopePanel | 거부 목록 `<summary>` hover | 링 | — | 그대로(거부 목록 펼침) | `--cc-surface` · `--cc-unknown-*` |
| DoorCollectionRow | — | — | — | 그대로 | `--cc-line-strong` · `--cc-ink-3` |
| DistributionChips | — | — | — | 배경 보존(exact) | `--cc-st-*` · `--cc-line` |
| Banner | 동작 버튼만 | 링(strong 안은 반전 링) | — | 변형별(strong은 이중 테두리) | 변형별 토큰(§5-3) |
| PriorityList / UnlockList | 버튼만 | 링 | 버튼 disabled 규칙 | 그대로(버튼 숨김) | `--cc-st-*` |
| DoorSection | — | — | — | 그대로(문 머리 쪽 나눔 방지) | `--cc-ink` · `--cc-ink-3` |
| RuleRow | `<summary>` `--cc-hover` | 링 | — | 위험 · 주의 · 확인 불가는 펼침, 이상 없음 · 해당 없음은 요약줄 | `--cc-st-*` · `--cc-unknown-line` |
| TargetTable | 행 `--cc-hover` | 버튼 링 | — | 그대로(행 쪽 나눔 방지) | `--cc-surface` · `--cc-line` · `--cc-exc` |
| ManualCheckList | 행 hover | 체크박스 링 | — | 손 체크 표(5mm 칸 · 메모 열 · 행 10mm) | `--cc-ink` |
| GuideCard | — | 라디오 링 | — | 그대로 | `--cc-unknown-*` |
| Disclaimer | — | — | — | 바닥, 위쪽 선 한 줄 | `--cc-ink-2` · `--cc-line` |
| PrintOptions | 버튼 hover | 링 | — | 숨김 | `--cc-ink` |
| ExceptionForm | — | 입력 테두리 ink + 링 | 입력 disabled(점선) | 숨김 | `--cc-exc*` |
| FixSteps | — | — | — | 그대로 | `--cc-ink` · `--cc-line` |
| CommandBlock | — | `pre` 링(블록 바깥) | — | 쓰기 블록 2.5pt, 머리 반전 해제 | `--cc-ink` · `--cc-surface` · `--cc-ph-bg` · `--cc-inv-*` |
| ImpactChip | — | — | — | 테두리 검정 | `--cc-ink` |
| ScriptViewer | `<summary>` hover | 스크롤 영역 링 | — | 숨김 | `--cc-surface` · `--cc-ink-3` |
| FootprintTable | 행 `--cc-hover` | — | — | 숨김(V1) | `--cc-ink` · `--cc-line` |
| HashDisplay | — | — | — | 그대로 | `--cc-surface` · `--cc-line-strong` |
| PathCard | 경계 ink | 링 | — | 숨김 | `--cc-line-strong` · `--cc-ink` |
| CloudChoiceCard | `--cc-hover` | 링 | 점선 + `--cc-ink-3` | 숨김 | `--cc-ink` |
| DropZone | — | `:focus-within` 링 | 읽는 중 `aria-busy` | 숨김 | `--cc-line-strong` · `--cc-surface` |
| PasteBox | — | 테두리 ink + 링 | 점선 + `--cc-ink-3` | 숨김 | `--cc-line-strong` |
| FileRecognitionList | [빼기] hover | 링 | — | 숨김 | `--cc-unknown-*` |
| BeforeAfterTable | 행 hover | — | — | 그대로 | `--cc-st-*` |
| IdentityCompare | — | — | — | 그대로 | `--cc-line-strong` |
| DemoSetPicker | 카드 경계 ink | 카드 링(형제 선택자) | — | 숨김 | `--cc-demo*`(프레임) · `--cc-ink` |
| BootFallback | — | 반전 링 | — | 숨김 | `--cc-inv-*` |
| MaskedValue | — | — | — | 마스킹 전환(§6-3) | `--cc-ink` · `--cc-inv-*`(redacted) |

---

## 6. CSS 골격

### 6-1. 파일 구성 · 로드 순서 · 예산

```
_client/styles/tokens.css   ← §1-2 (복사)
_client/styles/base.css     ← §6-2 (복사)
_client/styles/print.css    ← §6-3 (복사)
각 컴포넌트·화면 CSS         ← 컴포넌트개발자 · 페이지개발자 (§5 규격, §6-4 패턴)
```

- `main.tsx`의 import 순서: `tokens.css` → `base.css` → (컴포넌트 · 화면, 각 파일에서 import) → **`print.css` 가장 마지막**. esbuild는 CSS를 import 순서대로 이어 붙이므로 [일반 지식] 캐스케이드가 이 순서에 의존한다. G5에서 번들 CSS의 마지막 `@media print` 블록이 `print.css`의 것인지 확인한다.
- 다크용 `@media (prefers-color-scheme: dark)`는 `tokens.css`에만 둔다. 컴포넌트는 토큰만 쓰므로 다크가 공짜다.
- 금지(방향서 §2-3~2-4): `style` 속성 · JSX `style` prop · `@import` · 외부 `url()`(data: 포함 `url()`도 쓰지 않는다: 빗금은 그라디언트, 아이콘은 인라인 SVG) · Tailwind 유틸리티 이름의 클래스 · CSS-in-JS · `!important`(print.css와 `[hidden]`, reduced-motion 제외).

**예산 추정과 위험** [추정: 이 문서의 코드를 규칙별로 문자 수 손계산, esbuild 압축 후(주석 · 공백 제거, gzip 전) 기준]

방향서 §2-3의 'CSS 30 KiB 이하'는 기준 시점이 적혀 있지 않다. 번들 산출물(압축 후) 기준으로 읽었다 [미확인: 프론트팀장이 확정]. 소스 파일은 주석 · 들여쓰기 때문에 15~60% 더 크다(토큰 파일이 가장 크게 차이 난다).

| 구분 | 압축 후 바이트 | 비고 |
|---|---|---|
| tokens.css | 약 3,200 | 소스 약 5,200 |
| base.css | 약 6,900 | 소스 약 8,000 |
| print.css | 약 2,900 | |
| 아이콘 · 상태 리맵 · 빗금(§2-2 · §2-4 · §3-1) | 약 2,700 | |
| §6-4 발췌(컴포넌트 10군) | 약 8,400 | |
| 위에 없는 컴포넌트 약 25종 | 약 6,000~10,000 | 종당 250~400B 가정 |
| **합계** | **약 30,000~34,000** | 상한 30 KiB(30,720B)에 걸리거나 3KB 안팎 초과 |

- **골격 3파일(tokens · base · print) 합계는 약 13KB**로 안에 들어온다. 초과 위험은 컴포넌트 CSS에서 난다.
- **절감안(적용 순서)**: ① `forced-colors` 블록 삭제 -0.25KB ② 인쇄 URL 표시 삭제 -0.2KB ③ 문 아이콘 32px 변형 삭제 -0.1KB ④ `.cc-prose` · `.cc-display` · `.cc-gap-*` 유틸 정리 -0.6KB ⑤ `.cc-dc`와 `.cc-sb` 공통 선택자 합치기 -0.3KB ⑥ `.cc-cmd` 변형 정리 -0.2KB. **합계 약 1.65KB**라서 절감안만으로는 28.5~32.5KB다.
- **권고**: 구현하면서 바이트를 재고(컴포넌트개발자 보고 → 프론트팀장 합계), 30,720B를 넘기 직전에 절감안을 순서대로 적용한다. 그래도 넘으면 **CSS 상한을 36 KiB로 올리는 것을 기획팀장에게 요청**한다(방향서 §2-3: 올리려면 기획팀장 확인). CSS는 반복 문자열이 많아 gzip 후 증가가 1~2 KiB 수준이라 'HTML gzip 200 KiB' 목표에는 영향이 작다 [추정].
- 실측은 D4 통합 때 프론트팀장이 한다. 절감안으로 뺀 항목은 다음 릴리스에서 되살릴 수 있다.

### 6-2. `styles/base.css`

```css
/* styles/base.css — 리셋 · 타이포 · 링크 · 포커스 · 컨트롤 · details · dialog · 표 · reduced-motion */
*,*::before,*::after{box-sizing:border-box}
html{font-size:100%;-webkit-text-size-adjust:100%;text-size-adjust:100%;scroll-padding-top:88px}
body{margin:0;background:var(--cc-bg);color:var(--cc-ink);font:400 var(--cc-fs-16)/var(--cc-lh-body) var(--cc-font);font-variant-numeric:tabular-nums;word-break:keep-all;overflow-wrap:break-word}
h1,h2,h3,h4,p,ul,ol,dl,dd,figure,fieldset,blockquote,pre{margin:0}
ul,ol{padding:0;list-style:none}           /* 구조용 목록. 구조 <ul>에는 role="list"(Safari 낭독). 문장 목록은 .cc-prose 안에서만 마커 복원 */
fieldset{min-width:0;padding:0;border:0}
legend{padding:0}
h1,h2,h3,h4{font-weight:700;line-height:var(--cc-lh-head)}
h1{font-size:var(--cc-fs-20)}
h2{font-size:var(--cc-fs-18)}
h3{font-size:var(--cc-fs-16);font-weight:600}
h1[tabindex="-1"]:focus{outline:none}      /* 화면 전환 때 프로그램이 h1으로 옮기는 포커스 */
@media (min-width:600px){h1{font-size:var(--cc-fs-24)}h2{font-size:var(--cc-fs-20)}h3{font-size:var(--cc-fs-18)}}
.cc-display{font-size:var(--cc-fs-24);font-weight:700;line-height:var(--cc-lh-head)}
@media (min-width:600px){.cc-display{font-size:var(--cc-fs-30)}}
.cc-prose p+p,.cc-prose p+ul,.cc-prose ul+p{margin-top:var(--cc-sp-3)}
.cc-prose ul{padding-left:1.25em;list-style:disc}
small,.cc-small{font-size:var(--cc-fs-13);line-height:var(--cc-lh-ui)}
.cc-ui{font-size:var(--cc-fs-14);line-height:var(--cc-lh-ui)}
.cc-muted{color:var(--cc-ink-3)}
.cc-any{overflow-wrap:anywhere;word-break:normal}
code,kbd,samp,pre{font-family:var(--cc-mono);font-size:var(--cc-fs-14)}
hr{margin:var(--cc-sp-6) 0;border:0;border-top:1px solid var(--cc-line)}
[hidden]{display:none!important}

/* 링크 · 포커스: 링크는 밑줄 항상, 포커스는 2px 잉크 + 2px 간격 */
a{color:var(--cc-ink);text-decoration:underline;text-decoration-thickness:1px;text-underline-offset:.18em}
a:hover{text-decoration-thickness:2px}
:focus-visible{outline:2px solid var(--cc-focus);outline-offset:2px}
.cc-inv{background:var(--cc-inv-bg);color:var(--cc-inv-ink)}
.cc-inv a{color:inherit}
.cc-inv :focus-visible,.cc-banner--strong :focus-visible{outline-color:var(--cc-inv-ink)}
::placeholder{color:var(--cc-ink-3);opacity:1}

/* 유틸 */
.cc-vh{position:absolute;width:1px;height:1px;margin:-1px;padding:0;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap;border:0}
.cc-skip{position:absolute;z-index:100;top:-120px;left:var(--cc-sp-2);padding:var(--cc-sp-2) var(--cc-sp-4);background:var(--cc-inv-bg);color:var(--cc-inv-ink);font-weight:700}
.cc-skip:focus{top:var(--cc-sp-2)}
.cc-wrap{width:min(100% - 2*var(--cc-gutter),var(--cc-w-main));margin-inline:auto}
.cc-wrap--wide{width:min(100% - 2*var(--cc-gutter),var(--cc-w-wide))}
.cc-stack>*+*{margin-top:var(--cc-gap,var(--cc-sp-4))}
.cc-gap-2{--cc-gap:var(--cc-sp-2)}.cc-gap-3{--cc-gap:var(--cc-sp-3)}.cc-gap-6{--cc-gap:var(--cc-sp-6)}.cc-gap-8{--cc-gap:var(--cc-sp-8)}

/* 버튼: 높이 44px 이상, 위험(빨강) 변형 없음 */
button,input,select,textarea{font:inherit;color:inherit}
button{cursor:pointer}
.cc-btn{display:inline-flex;align-items:center;justify-content:center;gap:var(--cc-sp-2);min-height:var(--cc-hit);padding:10px 16px;border:1.5px solid var(--cc-ink);border-radius:var(--cc-r-1);background:transparent;color:var(--cc-ink);font-size:var(--cc-fs-16);font-weight:600;line-height:1.3;text-align:center;text-decoration:none}
.cc-btn:hover{background:var(--cc-hover)}
.cc-btn--primary{background:var(--cc-ink);color:var(--cc-bg)}
.cc-btn--primary:hover{background:var(--cc-ink-2);border-color:var(--cc-ink-2)}
.cc-btn--ghost{padding-inline:var(--cc-sp-2);border-color:transparent;text-decoration:underline;text-underline-offset:.18em}
.cc-btn--sm{padding-inline:12px;font-size:var(--cc-fs-14)}
.cc-btn[disabled],.cc-btn[aria-disabled="true"]{background:transparent;border:1.5px dashed var(--cc-line-strong);color:var(--cc-ink-3);cursor:not-allowed}

/* 입력: 경계 3:1 이상, 오류에 빨강 금지(굵은 잉크 테두리 + 문장) */
.cc-in,.cc-ta,.cc-sel{display:block;width:100%;min-height:var(--cc-hit);padding:10px 12px;border:1.5px solid var(--cc-line-strong);border-radius:var(--cc-r-1);background:var(--cc-bg);color:var(--cc-ink);font-size:var(--cc-fs-16);line-height:1.4}
.cc-ta{min-height:140px;resize:vertical;font-family:var(--cc-mono);font-size:var(--cc-fs-14);line-height:1.6}
.cc-in:focus-visible,.cc-ta:focus-visible,.cc-sel:focus-visible{border-color:var(--cc-ink)}
.cc-in[aria-invalid="true"],.cc-ta[aria-invalid="true"]{padding:9.5px 11.5px;border:2px solid var(--cc-ink)}
.cc-in:disabled,.cc-ta:disabled,.cc-sel:disabled{border-style:dashed;color:var(--cc-ink-3);cursor:not-allowed}
.cc-lab{display:block;margin-bottom:var(--cc-sp-1);font-size:var(--cc-fs-14);font-weight:600}
.cc-hint{margin-top:var(--cc-sp-1);color:var(--cc-ink-3);font-size:var(--cc-fs-13)}
.cc-err{margin-top:var(--cc-sp-1);font-size:var(--cc-fs-14);font-weight:700}
.cc-opt{display:flex;align-items:center;gap:var(--cc-sp-3);min-height:var(--cc-hit)}
.cc-box{appearance:none;-webkit-appearance:none;position:relative;flex:none;width:22px;height:22px;margin:0;border:2px solid var(--cc-ink);border-radius:var(--cc-r-1);background:var(--cc-bg)}
.cc-box:checked::after{content:"";position:absolute;left:5px;top:1px;width:5px;height:10px;border:solid var(--cc-ink);border-width:0 2.5px 2.5px 0;transform:rotate(45deg)}
input[type="radio"]{flex:none;width:20px;height:20px;margin:0;accent-color:var(--cc-ink)}

/* details/summary: 펼침 화살표 회전 + 내용 페이드인만 120ms */
summary{display:flex;align-items:center;gap:var(--cc-sp-2);min-height:var(--cc-hit);cursor:pointer;list-style:none}
summary::-webkit-details-marker{display:none}
summary:hover{background:var(--cc-hover)}
.cc-chev{flex:none;margin-left:auto;transition:transform var(--cc-dur)}
details[open]>summary .cc-chev{transform:rotate(180deg)}
details[open]>:not(summary){animation:cc-in var(--cc-dur) ease-out}
@keyframes cc-in{from{opacity:0}to{opacity:1}}

/* dialog: 앱에서 하나(리포트 닫기 확인) */
dialog{width:calc(100% - 2*var(--cc-sp-4));max-width:480px;padding:var(--cc-sp-6);border:2px solid var(--cc-ink);border-radius:var(--cc-r-2);background:var(--cc-bg);color:var(--cc-ink)}
dialog::backdrop{background:var(--cc-scrim)}
.cc-dlg__act{display:flex;flex-direction:column-reverse;gap:var(--cc-sp-2);margin-top:var(--cc-sp-6)}
@media (min-width:600px){.cc-dlg__act{flex-direction:row;justify-content:flex-end}}

/* 표 */
table{width:100%;border-collapse:collapse}
caption{padding:0 0 var(--cc-sp-2);text-align:left;font-weight:600}
th,td{padding:10px 12px;border-bottom:1px solid var(--cc-line);text-align:left;vertical-align:top;overflow-wrap:break-word}
th{background:var(--cc-surface);border-bottom:1.5px solid var(--cc-line-strong);color:var(--cc-ink-2);font-size:var(--cc-fs-13);font-weight:700}
tbody tr:hover{background:var(--cc-hover)}

/* 움직임 · 화면 높이 · 고대비 */
@media (prefers-reduced-motion:reduce){*,*::before,*::after{animation:none!important;transition:none!important;scroll-behavior:auto!important}}
@media (max-height:520px){.cc-band,.cc-ctx{position:static}}   /* 낮은 화면(가로 폰 · 200% 확대)에서 스티키가 내용을 가리지 않게 */
@media (forced-colors:active){
  .cc-si__s{fill:CanvasText;stroke:CanvasText}
  .cc-si__g{stroke:Canvas}
  .cc-si--na .cc-si__s{fill:none}
  .cc-si--na .cc-si__g{stroke:CanvasText}
}
```

- `tbody tr:hover`의 `--cc-hover` 위에서 `--cc-ink-3` 글자는 5.26(라이트) / 6.27(다크)로 AA 충족이다(§1-4). hover 위에서 `--cc-line-strong` 경계는 쓰지 않는다(§1-5).
- `.cc-box:checked::after`의 체크 위치(left 5px · top 1px)는 시각 확인 후 ±1px 미세 조정한다 [미확인].
- 구조 목록(`ul`/`ol`)은 `list-style: none`이라 Safari의 VoiceOver에서 목록 의미가 사라질 수 있다 [일반 지식]. 컴포넌트개발자는 구조 `<ul>`/`<ol>`에 `role="list"`를 붙인다(§8).

### 6-3. `styles/print.css`

A4 세로, 여백 14 / 12 / 16mm, 본문 10.5pt, 고정폭 9pt. **라이트 토큰 강제는 `tokens.css`의 `@media print` 블록이 맡고**, 이 파일은 구조와 숨김 · 마스킹 · `<details>` · 반전 해제를 맡는다. `main.tsx`에서 가장 마지막에 import한다.

```css
/* styles/print.css — 인쇄 · 마스킹 전환. 의미는 모양·글자·테두리에만 싣는다(배경은 장식). 마지막에 import */

/* ① 마스킹 이중 렌더(화면·인쇄 공용): 식별자마다 <bdi class="cc-mask-full">·<bdi class="cc-mask-short">를 함께 그린다 */
.cc-mask-short{display:none}
.cc-screen-masked .cc-mask-full{display:none}      /* 화면 가리기 보기(D11, P1) */
.cc-screen-masked .cc-mask-short{display:inline}

/* ② 화면에서는 숨기는 인쇄 전용 블록(머리·바닥 면책·체험 제목) */
.cc-print-only{display:none}

@page{size:A4 portrait;margin:14mm 12mm 16mm}

@media print{
  html{font-size:10.5pt;scroll-padding-top:0}
  body{background:#fff;color:#000;line-height:1.5}
  *,*::before,*::after{background:transparent!important;box-shadow:none!important;text-shadow:none!important;animation:none!important;transition:none!important}
  .cc-sb,.cc-dc{background:var(--cc-st-bg)!important;-webkit-print-color-adjust:exact;print-color-adjust:exact}   /* 배지·칩만 배경 보존 */

  /* 숨김 */
  .cc-noprint,.cc-skip,.cc-hdr,.cc-ctx,.cc-demo-frame,.cc-boot,.cc-drop,.cc-paste,.cc-sv,.cc-actions,.cc-popt,.cc-xf,.cc-btn,.cc-chev,dialog{display:none!important}
  .cc-print-only{display:revert}
  .cc-wrap,.cc-wrap--wide{width:auto;margin:0}
  .cc-band{position:static;padding:2mm 3mm;border:1pt solid #000}
  .cc-band__more{max-height:none}
  .cc-print-demo{margin:0 0 4mm;padding:3mm 4mm;border:2.5pt solid #000;font-size:1.6rem;font-weight:700;text-align:center}   /* '체험 모드 · 가짜 데이터'를 크게 */

  /* 마스킹: 인쇄 기본 = 마스킹본. '이름·ID 표시' 옵션은 루트 클래스만 바꾼다. Ctrl+P·브라우저 메뉴 인쇄도 같다 */
  .cc-mask-full,.cc-screen-masked .cc-mask-full{display:none}
  .cc-mask-short,.cc-screen-masked .cc-mask-short{display:inline}
  .cc-print-full .cc-mask-full{display:inline}
  .cc-print-full .cc-mask-short{display:none}

  /* <details>: 닫힌 내용은 인쇄되지 않는다. beforeprint에서 .cc-po를 열고 afterprint에서 되돌린다. .cc-pc는 요약줄만 */
  summary{min-height:0;list-style:none}
  summary:hover{background:none}
  details.cc-pc>:not(summary){display:none!important}
  .cc-rule{border-left-width:3pt;border-radius:0}
  .cc-rule.cc-st--unknown{border-left-width:4pt}

  /* 쪽 나눔 */
  h1,h2,h3,.cc-door__h,.cc-rule__sum{break-after:avoid}
  .cc-rule,.cc-tt tr,.cc-mc tr,.cc-cmd,.cc-banner,.cc-card{break-inside:avoid}
  .cc-manual{break-before:page}
  thead{display:table-header-group}
  p,li{orphans:3;widows:3}

  /* 링크: 종이에는 주소를 남긴다 */
  a{color:#000}
  .cc-ext[href]::after{content:" <" attr(href) ">";font-size:.8em;overflow-wrap:anywhere}
  .cc-ext__x{display:none}

  /* 반전 요소는 테두리형으로 (배경이 안 찍혀도 글자가 사라지지 않게) */
  .cc-banner--strong,.cc-inv,.cc-chip--inv{color:#000;border:2pt double #000}
  .cc-mv--redacted{color:#000;border:1pt solid #000}
  .cc-cmd--write{border:2.5pt solid #000}
  .cc-cmd--write .cc-cmd__cap{color:#000;border-bottom:1.5pt solid #000;font-weight:700}
  .cc-cmd__pre{white-space:pre-wrap;font-size:9pt}
  .cc-chip,.cc-impact{border-color:#000}

  /* 직접 볼 목록: 손으로 체크하는 표 */
  .cc-mc th,.cc-mc td{padding:2mm 2.5mm;border:.5pt solid #000;vertical-align:top}
  .cc-mc tr{height:10mm}
  .cc-mc__memo{display:table-cell;min-width:38mm}
  .cc-box{width:5mm;height:5mm;border:1pt solid #000;border-radius:0}

  /* '직접 볼 목록만 인쇄' — 루트 클래스 cc-print-manual */
  .cc-print-manual .cc-report>:not(.cc-manual):not(.cc-print-only){display:none!important}
}
```

- **화면에서만 숨기는 열**: ManualCheckList의 컴포넌트 CSS(화면 기본)에 `.cc-mc__memo{display:none}`을 두고, 위 인쇄 규칙(`display:table-cell`)이 `print.css`가 마지막에 로드되는 순서 덕분에 되돌린다.
- **JS 계약(페이지개발자)**: ① 인쇄 버튼 클릭 → 옵션에 따라 `<html>`에 `cc-print-full` / `cc-print-manual` 토글 → `window.print()` → `afterprint`에서 제거. ② `beforeprint`: `details.cc-po:not([open])`에 `open`을 주고 표식(`data-cc-auto`)을 남김, `afterprint`: 표식이 있는 것만 닫음. 브라우저 메뉴 인쇄에서도 두 이벤트가 발생하는지 3개 브라우저에서 확인한다 [일반 지식, STEP 5: 미확인]. ③ `document.title`에 별칭 · 계정 ID를 넣지 않는다(Chrome 인쇄의 PDF 기본 파일 이름이 된다 [일반 지식]).
- 인쇄 머리(제목 "문단속 5 리포트 · 올린 파일 기준 참고 자료" · 신원(마스킹) · 범위 · 수집 시각 KST/UTC · 수집기 · 페이지 버전 · 입력 파일 이름)와 바닥 면책은 `.cc-print-only` 블록으로 React가 그린다(문구는 UX).
- 도장 · 서명란 · '확인자' · '판정: 적합' 칸을 만들지 않는다.

### 6-4. 컴포넌트 CSS 핵심 패턴 (발췌 · 구현의 기준점)

나머지 컴포넌트는 §5의 값으로 같은 패턴을 따라 쓴다.

```css
/* StateBadge · 분포 칩 */
.cc-sb{display:inline-flex;align-items:center;gap:6px;min-height:28px;padding:2px 8px 2px 6px;border:1px solid var(--cc-st-line);border-radius:var(--cc-r-1);background:var(--cc-st-bg);color:var(--cc-st-ink);font-size:var(--cc-fs-14);font-weight:600;line-height:1.3;white-space:nowrap}
.cc-sb.cc-st--na,.cc-dc.cc-st--na{border-style:dashed}
.cc-sb--sm{min-height:24px;padding:1px 6px 1px 4px;font-size:var(--cc-fs-13)}
.cc-sb--lg{min-height:32px;gap:8px;padding:4px 10px 4px 8px;font-size:var(--cc-fs-16)}
.cc-dist{display:flex;flex-wrap:wrap;gap:var(--cc-sp-2)}
.cc-dc{display:inline-flex;align-items:center;gap:6px;min-height:36px;padding:4px 12px 4px 8px;border:1px solid var(--cc-st-line);border-radius:var(--cc-r-1);background:var(--cc-st-bg);color:var(--cc-st-ink);font-size:var(--cc-fs-14);font-weight:600}
.cc-dc__n{font-size:var(--cc-fs-18);font-weight:700;line-height:1.2}
.cc-dc--sm{min-height:28px;padding:2px 8px 2px 6px;font-size:var(--cc-fs-13)}
.cc-dc--sm .cc-dc__n{font-size:var(--cc-fs-14)}
.cc-dc--zero{border:1px solid var(--cc-line);background:transparent;color:var(--cc-ink-2);font-weight:400}
.cc-dc--zero .cc-dc__n{font-weight:400}

/* 칩 */
.cc-chip{display:inline-flex;align-items:center;min-height:24px;padding:0 8px;border:1px solid var(--cc-line-strong);border-radius:var(--cc-r-1);background:var(--cc-bg);color:var(--cc-ink-2);font-size:var(--cc-fs-13);font-weight:600;line-height:1.4}
.cc-chip--hint,.cc-chip--soon{border-style:dashed}
.cc-chip--strong{border:1.5px solid var(--cc-ink);color:var(--cc-ink)}
.cc-chip--inv{border-color:var(--cc-inv-bg);background:var(--cc-inv-bg);color:var(--cc-inv-ink)}
.cc-impact{display:inline-flex;align-items:center;min-height:24px;padding:0 8px;border:1px solid var(--cc-ink);border-radius:var(--cc-r-1);font-size:var(--cc-fs-13)}
.cc-impact--mid{border-width:1.5px;font-weight:600}
.cc-impact--high{border-width:2px;font-weight:700}

/* RuleRow */
.cc-rule{border:1px solid var(--cc-line);border-left:var(--cc-bar) solid var(--cc-st-icon);border-radius:var(--cc-r-2);background:var(--cc-bg)}
.cc-rule+.cc-rule{margin-top:var(--cc-sp-2)}
.cc-rule.cc-st--unknown{border-color:var(--cc-unknown-line);border-left:var(--cc-bar-unknown) solid var(--cc-unknown-icon)}   /* border-left를 border-color 뒤에 둔다: 띠는 더 진한 icon 색 */
.cc-rule.cc-st--na{border-left-style:dashed}
.cc-rule__sum{display:grid;grid-template-columns:1fr auto;gap:var(--cc-sp-2) var(--cc-sp-3);align-items:center;padding:var(--cc-sp-3) var(--cc-sp-4)}
.cc-rule__title{grid-column:1/-1;font-size:var(--cc-fs-16);font-weight:600;line-height:var(--cc-lh-head)}
.cc-rule__why{grid-column:1/-1;color:var(--cc-ink-2);font-size:var(--cc-fs-14)}
.cc-rule__body{padding:0 var(--cc-sp-4) var(--cc-sp-4)}
@media (min-width:600px){
  .cc-rule__sum{grid-template-columns:auto 1fr auto}
  .cc-rule__title{grid-column:2;font-size:var(--cc-fs-18)}
  .cc-rule__why{grid-column:2}
}

/* Banner 6변형 */
.cc-banner{padding:var(--cc-sp-3) var(--cc-sp-4);border:1px solid var(--cc-line-strong);border-left:var(--cc-bar) solid var(--cc-ink-2);border-radius:var(--cc-r-2);background:var(--cc-surface);font-size:var(--cc-fs-14);line-height:var(--cc-lh-ui)}
.cc-banner__t{font-weight:700}
.cc-banner--scope{border-style:dashed;background:transparent}
.cc-banner--unknown{position:relative;border-color:var(--cc-unknown-line);border-left:var(--cc-bar-unknown) solid var(--cc-unknown-icon);background:var(--cc-unknown-bg);color:var(--cc-unknown-ink)}
.cc-banner--exception{border-color:var(--cc-exc);background:var(--cc-exc-bg);color:var(--cc-exc-ink)}
.cc-banner--demo{border-color:var(--cc-demo);background:var(--cc-demo-bg);color:var(--cc-demo-ink)}
.cc-banner--strong{border-color:var(--cc-inv-bg);background:var(--cc-inv-bg);color:var(--cc-inv-ink);font-size:var(--cc-fs-16)}

/* 띠 · 프레임 · 맥락 줄 */
.cc-band{position:sticky;top:0;z-index:40;padding:5px var(--cc-gutter);border-bottom:1px solid var(--cc-line-strong);background:var(--cc-surface);color:var(--cc-ink);font-size:var(--cc-fs-13);line-height:18px}
.cc-band__tag{display:inline-block;margin-right:var(--cc-sp-2);padding:0 6px;border:1px solid currentColor;border-radius:var(--cc-r-1);font-weight:700}
.cc-band__more{max-height:4em;overflow:hidden;transition:max-height var(--cc-dur)}
.cc-compact .cc-band__more{max-height:0}
.cc-band--demo{border-bottom-color:var(--cc-demo);background:var(--cc-demo-bg);color:var(--cc-demo-ink)}
.cc-demo-frame{position:fixed;inset:0;z-index:50;border:4px solid var(--cc-demo);pointer-events:none}
.cc-ctx{position:sticky;top:var(--cc-band-h);z-index:30;display:flex;flex-wrap:wrap;align-items:center;gap:var(--cc-sp-1) var(--cc-sp-3);min-height:40px;padding:6px var(--cc-gutter);border-bottom:1px solid var(--cc-line-strong);background:var(--cc-bg);font-size:var(--cc-fs-14)}

/* CommandBlock */
.cc-cmd{margin:0;border:1px solid var(--cc-line-strong);border-radius:var(--cc-r-1);background:var(--cc-surface)}
.cc-cmd__cap{padding:var(--cc-sp-1) var(--cc-sp-3);border-bottom:1px solid var(--cc-line-strong);color:var(--cc-ink-2);font-size:var(--cc-fs-13);font-weight:600}
.cc-cmd__pre{padding:var(--cc-sp-3);font-size:var(--cc-fs-14);line-height:1.6;white-space:pre-wrap;overflow-wrap:anywhere;word-break:normal}
.cc-cmd--write{border:3px solid var(--cc-ink)}
.cc-cmd--write .cc-cmd__cap{border-bottom:0;background:var(--cc-inv-bg);color:var(--cc-inv-ink);font-size:var(--cc-fs-14);font-weight:700}
.cc-cmd--kql .cc-cmd__pre{-webkit-user-select:all;user-select:all}
.cc-ph{padding:0 2px;border-radius:2px;background:var(--cc-ph-bg);font-weight:700;text-decoration:underline dotted 2px;text-underline-offset:3px}

/* HashDisplay */
.cc-hash{display:block;padding:var(--cc-sp-3);border:1px solid var(--cc-line-strong);border-radius:var(--cc-r-1);background:var(--cc-surface);font-family:var(--cc-mono);font-size:var(--cc-fs-16);line-height:1.7;-webkit-user-select:all;user-select:all}
.cc-hash__g{margin-right:.75em}
.cc-hash__g:last-child{margin-right:0}

/* DropZone */
.cc-drop{display:flex;flex-direction:column;align-items:center;gap:var(--cc-sp-3);padding:var(--cc-sp-6) var(--cc-sp-4);border:2px dashed var(--cc-line-strong);border-radius:var(--cc-r-2);background:var(--cc-surface);text-align:center}
.cc-drop--over{border-style:solid;border-color:var(--cc-ink);background:var(--cc-hover)}
.cc-drop:focus-within{outline:2px solid var(--cc-focus);outline-offset:2px}
.cc-drop__hint{display:none}
@media (min-width:600px){.cc-drop{padding:var(--cc-sp-8) var(--cc-sp-4)}.cc-drop__hint{display:block}}

/* 표 → 카드(360px): thead는 시각적으로만 숨김, table/row/cell role은 마크업에서 명시 */
@media (max-width:599.98px){
  .cc-tt,.cc-tt tbody,.cc-tt tr,.cc-tt td,.cc-mc,.cc-mc tbody,.cc-mc tr,.cc-mc td,.cc-fp,.cc-fp tbody,.cc-fp tr,.cc-fp td{display:block}
  .cc-tt thead,.cc-mc thead,.cc-fp thead{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0)}
  .cc-tt tr,.cc-mc tr,.cc-fp tr{margin-top:var(--cc-sp-2);padding:var(--cc-sp-3) var(--cc-sp-4);border:1px solid var(--cc-line);border-radius:var(--cc-r-2)}
  .cc-tt td,.cc-mc td,.cc-fp td{padding:var(--cc-sp-1) 0;border:0}
  .cc-tt td[data-label]::before,.cc-mc td[data-label]::before,.cc-fp td[data-label]::before{content:attr(data-label);display:block;color:var(--cc-ink-3);font-size:var(--cc-fs-13)}
}

/* ScriptViewer 줄 번호(복사에 섞이지 않음) */
.cc-sv__code{margin:0;padding:var(--cc-sp-3) 0;overflow-x:auto;font-size:var(--cc-fs-13);line-height:1.6;counter-reset:ln}
.cc-sv__l{position:relative;display:block;padding:0 var(--cc-sp-3) 0 56px;white-space:pre;counter-increment:ln}
.cc-sv__l::before{content:counter(ln);position:absolute;left:0;width:44px;color:var(--cc-ink-3);text-align:right;-webkit-user-select:none;user-select:none}
.cc-sv__l--c{color:var(--cc-ink-3)}
```

- 확인 불가 빗금(`.cc-hatch`)은 §2-4의 코드를 그대로 쓴다. `RuleRow`(unknown) · `GuideCard` · `PriorityList`(unknown) · `Banner--unknown`에 붙인다.
- `unknown` 변형 Banner의 마크업에는 `cc-hatch` 클래스를 **함께** 붙인다(`<div class="cc-banner cc-banner--unknown cc-hatch">`). 빗금 `::before`는 `.cc-hatch` 규칙이 만들고 호스트에 `position: relative`가 필요하다(`.cc-hatch`와 `.cc-banner--unknown` 둘 다 이미 지정).

---

## 7. 띠 · 라벨 규격 · 자산 예산

### 7-1. 띠(스크린 가장자리)

| 띠 | 바탕 | 글자 | 테두리 · 형태 | 닫기 | 줄어듦 |
|---|---|---|---|---|---|
| **베타** | `--cc-surface` | `--cc-ink` | 바닥 1px `--cc-line-strong`. 태그 "베타"는 1px 현재색 테두리 · 700 | 없음 | 스크롤 24px 초과 → 보조 줄 접힘(28px) |
| **체험** | `--cc-demo-bg` | `--cc-demo-ink` | 바닥 1px `--cc-demo` + **화면 안쪽 4px 보라 프레임** (`position: fixed; inset: 0`) | 없음 | 베타와 같음. 프레임은 줄어들지 않음 |
| **예외**(라벨) | `--cc-exc-bg` | `--cc-exc-ink` | 라벨 1px `--cc-exc` + 행 **4px 왼쪽 띠**. 만료는 점선 | — | — |
| **강한 공지** | `--cc-inv-bg` | `--cc-inv-ink` | 같은 색 테두리, 16px | 없음 | — |

- 베타 띠는 인쇄 머리에 정적 한 줄로 들어간다. 체험 모드의 인쇄 머리에는 "체험 모드 · 가짜 데이터"가 크게 나온다(`.cc-print-demo`).
- 띠와 라벨은 **형태**(띠 · 테두리)로만 쓰고 배지로는 쓰지 않는다. 보라가 상태 칩 자리에 오지 않는다.

### 7-2. 라벨 요약

| 라벨 | 컴포넌트 | 형태 |
|---|---|---|
| 의도된 공개 후보 · 문자 치환됨 · 본인 응답 | LabelChip | 무채색 실선 칩 |
| 이름 힌트 · 오래된 버킷 힌트 · 준비 중 | LabelChip `--hint` / `--soon` | 무채색 **점선** 칩(추정이라는 표시) |
| 못 본 것 n · 직접 볼 것 n | LabelChip `--strong` | 1.5px 잉크 칩 |
| 권장 · 불일치 | LabelChip `--inv` | 잉크 반전(인쇄는 이중 테두리) |
| 운영 영향 | ImpactChip | 무채색, 테두리 굵기 차등 |
| 예외 표시 | ExceptionBand | 파랑 라벨 + 4px 띠 |

### 7-3. 자산 예산

| 항목 | 예산 | 이 스펙 |
|---|---|---|
| 폰트 | 0 | 시스템 폰트 스택 |
| 이미지 | 0 | 파비콘 data: SVG 하나(약 0.33KB) |
| 아이콘 | ≤8KB | 약 4KB(§3-6) |
| CSS | ≤30 KiB(압축 후, gzip 전) | 골격 3파일 약 13KB + 나머지 17~21KB 예상 → **합계 30~34KB, 경계 초과 위험**(§6-1, §9-1 #1) |

---

## 8. 구현 가드 · 인수 체크리스트 (컴포넌트개발자 · 프론트팀장)

1. **`style` 속성 / JSX `style` prop 0.** 동적 값은 변형 클래스(`cc-cols-2`)나 `data-*` 속성 선택자로 표현한다. SVG에도 `style`을 쓰지 않는다(방향서 §2-4 가드).
2. **모든 클래스는 `cc-` 접두.** Tailwind 유틸리티와 같은 이름(`flex` · `hidden` · `container` · `underline` …)의 클래스를 만들지 않는다. G5의 'Tailwind 산출 CSS 규칙 수 증가 0'을 지키기 위해서다.
3. **색은 토큰으로만.** 16진 색을 컴포넌트 CSS에 쓰지 않는다. 상태 색은 `.cc-st--*`가 정한 `--cc-st-*`만 읽는다. `-icon` 토큰을 글자색에 쓰지 않는다(§1-5).
4. **다크용 `@media`는 `tokens.css`에만.** 컴포넌트 CSS에 다크 분기를 넣지 않는다.
5. **상태 글자를 생략 · 축약하지 않는다.** 아이콘만 있는 상태 표시와 "OK" · "PASS" · "✓" 문자를 금지한다(체크는 SVG path).
6. **인터랙티브 대상 ≥44px** (버튼 · 입력 · `<summary>` · 체크/라디오 줄). 칩 · 배지는 비인터랙티브라 예외.
7. **고정 `height` 금지**(`min-height`만). 200% 확대 · 글자 간격 조정에서 잘리지 않아야 한다.
8. **구조 `<ul>`/`<ol>`에 `role="list"`**, 표를 카드로 바꿀 때 `table` · `row` · `cell` · `columnheader` role 명시(§5-4).
9. **외부 링크**는 관문 컴포넌트로만: `target="_blank" rel="noopener noreferrer"` + 호스트 표기 + 숨김 글자 "새 탭에서 열림". `LINK_HOSTS` 밖 금지.
10. **복사 버튼 0.** 아이콘 세트에 복사 아이콘이 없다. KQL 블록과 해시만 `user-select: all`.
11. **쓰기 명령 블록은 3px 잉크 테두리 + 반전 머리**, 읽기 블록과 구분이 한눈에 되어야 한다. 되돌리기 명령도 쓰기 블록이다.
12. **인쇄 전용 클래스**: 반전 요소를 새로 만들면 `print.css`에 테두리형 대체를 함께 추가한다.
13. **CSS 측정**: 컴포넌트개발자는 자기 CSS 바이트(비압축)를 보고하고, 프론트팀장이 합계를 §6-1 표에 기록한다. LF만 쓰고 `</style` 문자열을 넣지 않는다.
14. **`document.title`에 별칭 · 계정 ID를 넣지 않는다**(인쇄 PDF 기본 파일 이름).
15. **아이콘 파일 머리에 ISC 고지** `/*! … */`(§3-5)를 두고 G5에서 번들 끝 보존을 확인한다.
16. **`aria-hidden`**: 모든 장식 SVG(상태 · 문 · UI 아이콘)에 `aria-hidden="true"` + `focusable="false"`.

---

## 9. 디자인팀장 판단 쟁점 · 이월 · UX 접점

### 9-1. 판단이 필요한 쟁점

| # | 쟁점 | 이 문서의 권고 | 비고 |
|---|---|---|---|
| 1 | **CSS 예산 30 KiB가 이 스펙 전체를 구현하면 빠듯하거나 초과**(압축 후 약 30~34KB 예상) | 구현 중 측정 → 절감안(약 1.65KB) 순서 적용 → 그래도 넘으면 **상한 36 KiB 상향을 기획팀장에게 요청** | 방향서 §2-3은 "올리려면 기획팀장 확인". 예산 기준 시점(압축 전/후)도 프론트팀장이 확정해야 한다 [미확인]. 상세 §6-1 |
| 2 | 다크 `line-strong` · `na-line` 교체(#5D6572 → #646C79) | **채택 권고** | 원문이 bg 위(3.21)만 계산해 놓쳤다. surface 위 2.96 미달 → 3.28 |
| 3 | 토큰 이름 정정(`danger/warn/ok/unk` → `risk/caution/clear/unknown`) | 채택 권고 | 최종 토큰 CSS(`design-final`)에 이 이름으로 실어야 한다. UX 스펙의 클래스·용어와 대조 필요 |
| 4 | 입력 읽기 실패를 `unknown`(회색) 톤 배너로 묶음 | 원문 §1-1 g를 따름. 오독 방지를 위해 **상태 아이콘 미사용 + 제목 글자 + 빗금 띠** | 판정의 확인 불가와 시각적으로 같은 계열이 되는 점은 팀장 확인 필요 |
| 5 | Danger(빨강) 버튼 · 폼 오류 빨강 없음 | 예외 없이 적용 | 파괴적 동작은 확인 `<dialog>`. 기본 산출물 형식(버튼 4종)에서 Danger를 뺀 것 |
| 6 | 확인 불가 띠 6px(다른 상태 4px) | 빗금이 보이는 최소 폭 | 실브라우저 확인 전이면 [미확인]. 4px로 되돌려도 구조는 같다 |
| 7 | 워드마크 링크 밑줄 예외 | 채택 권고 | "링크는 밑줄 항상"의 유일한 예외 |
| 8 | 인쇄 반전 → 테두리형 전환, 배경 보존은 배지 · 칩에만 | 채택 권고 | 팀장 원문 §2-7("배지에만 exact")을 반전 요소까지 확장해 기술 |
| 9 | 분포 칩 0 표시 방식(`--zero`: 바탕 없음, 아이콘은 상태 색 유지) | 채택 권고 | 원문은 '0도 표시, 순서 고정'까지만 정함 |
| 10 | 아이콘 15종(lucide 5종 ISC). 고지 위치는 `icons.ts` `/*! */` | 채택 권고 | MIT(Feather) 목록 완전성은 [미확인]이라 두 고지를 같은 블록에 둠 |
| 11 | `light-dark()` 미사용(토큰 3벌 중복 +1.5KB) | 호환성 우선 | 목표 브라우저 범위(Safari 17.5 미만 포함 여부)를 팀장이 정하면 번복 가능 |
| 12 | 해시 묶음 방식(`<span>` + `<wbr>`)의 복사 결과 | STEP 5 검증 필요 | 이어지지 않으면 `inline-block` 대안 |
| 13 | `forced-colors` 블록(0.25KB) 포함 | P1(예산 압박 시 첫 삭제 후보) | Windows 고대비 사용자 |

### 9-2. UX 스펙과 맞춰야 할 접점 (병렬 작업이라 양쪽 확인 필요)

1. 상태 글자 5개와 문 이름 5개(PM 용어 병기)의 최종 문자열 — 이 문서는 예시값을 썼다.
2. 배너 매핑표(§5-3)의 `info / scope / strong` 배정, 특히 `collector-unknown-release`를 `info`로 둔 점.
3. 인쇄 머리 · 바닥 요소 구성과 `.cc-print-only` 블록의 문구, `.cc-manual` 섹션 id.
4. 화면 전환 때 포커스 이동 대상(h1, `tabindex="-1"`)과 `aria-live` 영역 위치.
5. `role` 결정(`note` / `alert` / `status`), 스크린리더 시나리오.
6. V8에 '오픈소스 고지' 접힘 블록 한 곳(ISC · MIT 고지 전문).
7. 프론트팀장(템플릿): `<meta name="color-scheme" content="light dark">`, 라이트 · 다크 `theme-color` 메타, 파비콘 data: 링크(§3-3).

### 9-3. STEP 5 이월 [미확인]

- 상태 아이콘 5종의 실브라우저 렌더(특히 16px에서의 글리프 가독성 · '?' 모양)와 흑백 출력 · 색각 이상 에뮬레이션(Chrome DevTools Rendering).
- 확인 불가 6px 빗금 띠의 가시성, 체크박스 체크 위치.
- `<summary>`에 `display: flex` · `display: grid`를 준 것의 Safari 동작(펼침 · 키보드 · 마커 숨김)과 `::-webkit-details-marker` 숨김.
- 해시 복사 결과 64자 연속 여부, `<wbr>` 동작(3개 브라우저).
- `beforeprint` / `afterprint`에서의 `<details>` 펼침 · 복원(Ctrl+P · 메뉴 인쇄), `print-color-adjust`(배지), SVG 인쇄 여부, 마스킹 기본 출력.
- 시스템 폰트 렌더(Windows · macOS · Android · iOS) — 줄바꿈 · 행간 · `keep-all`.
- 실제 CSS 바이트 합계, Tailwind 규칙 수 증가 0(G5).
- 파비콘 data: SVG의 3개 브라우저 탭 표시.
- SVG 프레젠테이션 속성의 CSP 영향 — 이 스펙은 전부 클래스로 우회해서 영향이 없도록 했다.

---

**근거**
- 입력 문서: `docs/planning/project-direction-cloudcheck.md`(§0~1, §2-2~2-4, §3, §5, §7), `docs/design/cloudcheck-lead-review.md`(§2, §3, §6-1), `docs/frontend/cloudcheck-lead-review.md`(§3-3 CSS 규칙, §3-4 생성 파이프라인), `docs/design/flight-ui-spec.md`(형식 관례).
- 대비: WCAG 2.1 상대 휘도 공식 손계산 4쌍 + WebAIM Contrast Checker API 교차(2026-10-19).
- 아이콘: lucide-icons/lucide main 브랜치 `icons/{door-closed,key-round,warehouse,cctv,file-text,…}.svg`와 `LICENSE`(2026-10-19 조회).
