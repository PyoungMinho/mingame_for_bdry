# 「문단속 5」(cloudcheck) 프론트엔드 아키텍처 최종안 — STEP 4 통합

> 작성: @프론트팀장(Opus) · 기준일 2026-10-19(실측 21:54~22:45 KST, 최종 재생성 22:38)
> 입력: 방향서 `docs/planning/project-direction-cloudcheck.md`(§2·§3·§5·§7·§8) · 디자인 최종안 `docs/design/cloudcheck-design-final.md`(§5·§6·§11·§12) · 프론트 검토 `docs/frontend/cloudcheck-lead-review.md` · 팀원·백엔드 보고(컴포넌트개발자·페이지개발자·API설계자·DB설계자·백엔드팀장 리뷰 메모)
> 지위: STEP 4 프론트 최종본이자 STEP 5 QA의 입력. 방향서와 충돌하면 방향서가 우선한다(예산 목표 상향은 기획팀장 확인 대기 — §9).
> 주의: 이 문서를 쓰는 동안 디자인팀장이 `src/lib/cloudcheck/rules/i18n/ko*.ts` 문구를 다듬고 있었다. 끝나면 메인 세션이 `_generated/page.ts`를 한 번 더 재생성하므로 크기·해시는 몇 KiB 움직일 수 있다.

**표기**: [확인] 실행·측정으로 확인 / [확인: 실브라우저] Chrome 155 헤드리스(CDP)로 확인 / [확인: 라이브] 배포된 동류 라우트로 확인 / [미확인] 확인 못 함(→ STEP 5)

---

## 0. 결론

1. **실제 엔진을 연결했다.** `main.tsx`가 `state/deps.real.ts`(`REAL_DEPS`)를 쓴다. 미연결 자리표시(`deps.unwired.ts`)는 지웠다. E 카탈로그(`ENGINE_KO`, 694키)를 `i18n/index.ts`에 병합했다. 운영 번들에 목업이 없고 실제 엔진이 들어 있는지는 `generated.test.ts`의 배포 게이트가 번들 입력 목록으로 검사한다.
2. **통합 항목 ①~⑦**(아래 §8), redacted 표시 확인, 목업 가짜 키 7개, 가드 좁은 허용 1건(`parse/` → `collector/RELEASES.json`)을 모두 처리했다.
3. **실브라우저에서만 보이는 버그 3건을 찾아 고쳤다**: ① 화면을 옮기면 포커스가 `<body>`로 떨어짐(정적 셸의 숨은 `<main>`이 문서에서 먼저 나옴 — G-D28 위반) ② V7(판정 규칙)이 360px에서 576px로 가로 넘침(Azure 권한 이름 칩) ③ 이번에 더한 V1 안내 줄이 360px에서 넘침(고친 뒤 0). 모두 jsdom 시험으로는 못 잡는 종류라, ①은 커밋된 HTML을 jsdom에서 실제로 돌리는 회귀 시험을 더했다.
4. **백엔드팀장 요청 반영**: 수집기 원문 보기에서 약 1,170자 jq 줄이 가로 스크롤로만 보이던 것을 소프트 줄바꿈으로 바꿨다(구간 접기는 원래 있음). 문구 후보 2개는 V1 '예상 호출 목록' 아래 안내로 넣었다(⟨잠정⟩ — 디자인 확인 필요).
5. **검증**: type-check 0 · vitest 레포 전체 통과 · `next build`에서 `ƒ /cloudcheck`·`ƒ /cloudcheck/download`(First Load JS 0 B) · 로컬 `next start` 헤더 = 방향서 §2-2, 두 라우트 본문 = `PAGE.sha256`, 루트 layout 흔적 0, `/pae` `/moira` `/exam` `/witness` 200 · 헤드리스 Chrome에서 최초 로드 요청 1건(문서), 콘솔 오류·예외 0, CSP·Trusted Types 위반 0, 인쇄 마스킹 기본, `file://` 동작, Blob 내려받기 바이트 = `SHA256SUMS`.
6. **번들**: HTML 864.6 KiB(실패 기준 900) · gzip 222.9 KiB(실패 기준 260). 실패 기준은 통과, 목표(700·200·480·30·24)는 넘는다. Vercel이 함수 응답(text/html)도 brotli로 압축함을 라이브 동류 라우트로 확인했다 → 실제 전송량 약 186~207 KiB. 목표 상향안을 기획팀장에게 올린다(§9). 실패 기준까지 여유는 35.4 KiB(3.9%)뿐이다. 이 세션 동안 E 문구가 +6.4 KiB(마지막 11분에만 +2.1 KiB) 늘었으므로 문구가 더 늘면 닿을 수 있다.

---

## 1. 기술 스택(최종)

| 항목 | 확정 | 비고 |
|---|---|---|
| 서빙 | Next 14.2.3 Route Handler 2개, `force-dynamic`, nodejs 런타임 | route가 import하는 것은 `_generated`·`_serve`뿐 → UI 코드는 Next 번들 밖(First Load JS 0 B) [확인] |
| UI 런타임 | React 18.3.1(설치본) | `StrictMode` + `createRoot` + `flushSync` 첫 렌더 |
| 언어 | TypeScript 5.9.3 strict(레포 tsconfig) | `any` 0, 모델 타입은 G0 동결본 `lib/cloudcheck/model/report.ts` |
| 번들 | 간접 의존 esbuild 0.21.5 build API만 · iife · minify · `charset: "utf8"` · `legalComments: "eof"` · **target es2020**(D4에서 es2019 → es2020, §8) | 생성물 `_generated/page.ts` 커밋 → Vercel 빌드에 esbuild 불필요 |
| 스타일 | 손작성 CSS(`--cc-` 토큰, `cc-` 접두 클래스), 시스템 폰트, Tailwind 클래스·CSS-in-JS·`@import`·외부 `url()` 0 | 압축 후 31.6 KiB(32,378 B) |
| 상태 | 동기 외부 저장소(`useSyncExternalStore`) + reducer + 동작 모음(actions) | 서버 상태 없음, 영속 저장 0 |
| 검증 | vitest 1.6(jsdom은 파일별 지시어), RTL, TypeScript 컴파일러 API(AST 가드), jsdom으로 생성 HTML 실행(부팅 계약) | 패키지 추가 0 |

---

## 2. 프로젝트 구조

```
src/app/cloudcheck/
├─ route.ts                  GET → PAGE.html + 헤더(§2-2)                       [프론트팀장]
├─ download/route.ts         같은 바이트 + Content-Disposition                  [프론트팀장]
├─ _serve/headers.ts         CSP·헤더 조립 순수 함수(헤더와 meta CSP가 같은 함수) · serve.test.ts
├─ _build/                   generate.mjs · template.mjs · generated.test.ts · guards.test.ts
├─ _generated/page.ts        GENERATED(손수정 금지) — 프론트팀장만 재생성
└─ _client/                  esbuild 진입점(main.tsx). Next가 import하지 않음
   ├─ main.tsx, config.ts, shell.ts(템플릿 ↔ 클라이언트 id 계약)
   ├─ state/                 reducer · actions · controller · pipeline · history(pushState 관문) · clock · print · unload · drop
   │                         · deps.ts(EngineDeps 계약) · deps.real.ts(운영) · deps.mock.ts(시험 전용)
   ├─ screens/               V0 Start · V1 Prep · V2 Input · V3 Report · V4 Fix · V5 Compare · V6 Demo · V7 Catalog · V8 About · App · ErrorBoundary
   ├─ components/            컴포넌트 46개(관문 5종 MaskedValue·DocLink·StatusBadge·CliBlock·PasteBox + 부속 관문 DownloadLink 포함)
   ├─ styles/                tokens.css · base.css · print.css(맨 끝 import)
   ├─ i18n/                  index.ts(병합·키 타입·t()·keyOf·표기) · ko/components.ts(C) · ko/screens.ts(S)
   └─ mocks/                 손으로 만든 목업 Report A~D·적대값(시험 전용 — 운영 번들 0)
src/lib/cloudcheck/          React·DOM·node:* 0(가드). _client가 import할 수 있는 것은 허용 목록(§3)뿐
```

### 2-1. 라우트와 헤더 [확인: 로컬 next start]

- `/cloudcheck`: `Content-Type: text/html; charset=utf-8` · CSP(`default-src 'none'; script-src 'sha256-…'; style-src 'sha256-…'; img-src data:; connect-src 'none'; … require-trusted-types-for 'script'; trusted-types 'none'; frame-ancestors 'none'`) · COOP same-origin · CORP same-origin · `Referrer-Policy: no-referrer` · nosniff · `X-Frame-Options: DENY` · Permissions-Policy(clipboard 포함 9종 차단) · `X-DNS-Prefetch-Control: off` · `X-Robots-Tag: noindex` · `Cache-Control: public, max-age=0, must-revalidate`. Next가 붙이는 `vary: RSC, …`만 더 있다.
- `/cloudcheck/download`: 같은 본문 + `Content-Disposition: attachment; filename="cloudcheck-0.1.0.html"`.
- 압축: `next start`는 Route Handler 응답을 압축하지 않는다(로컬은 원본 바이트 그대로) [확인]. Vercel은 함수가 낸 `text/html`도 brotli로 압축한다 — `/pae/room/[code]`(ƒ, 캐시 MISS)가 `content-encoding: br` [확인: 라이브]. Vercel 문서의 자동 압축 MIME 목록에는 `text/html`이 명시돼 있지 않아 라이브로 확인했다.

### 2-2. 생성 파이프라인(`_build/generate.mjs`)

1. esbuild로 `_client/main.tsx` 번들(JS·CSS) → 경고 0이어야 통과.
2. 후처리: JS의 `<!--`·`<script` 앞 `<`를 `\x3C`로, CR·NUL·`</script` 0, `vm.Script` 컴파일 확인. CSS는 `</style`·CR·NUL 0.
3. sha256(base64) → `_serve/headers.ts`의 `metaCsp()`로 meta CSP(헤더와 같은 함수).
4. 데이터 블록(실행 안 됨, CSP 해시·JS 밖): 수집기 원문 2개(text/plain, 파일 바이트 그대로) · 수집기 메타 · 릴리스(RELEASES.json) · 체험 4×2(JSON, `<` → `<`).
5. `template.mjs`로 조립(머리 순서 §2-2 + 정적 V0 셸·부팅 대체 안내·`<noscript>`·`#app`) → `_generated/page.ts`(시각·절대경로 없음, 결정적).
- 모드: 기본(쓰기, 프론트팀장) · `--check` · `--preview <레포 밖 경로> [--watch]`(팀원).

---

## 3. 코드 수준 강제(가드) — 4층

| 층 | 어디 | 무엇을 | 이번 통합에서 바꾼 것 |
|---|---|---|---|
| ① 소스 AST | `_build/guards.test.ts` | R-06·R-07·R-11·R-12·R3(한글 리터럴)·G-D1/2/5/10/15/22/28, `_client` → lib 허용 목록, lib 경계, 결정성(engine·rules·contract의 현재 시각·난수 0), `process.env` 0, NormalizedInput 내용 접근 0(타입 검사기) + 위반 샘플 자체 검사 | `rules/version`(값 `RULESET_VERSION`만) 허용 추가 · lib 경계의 **유일한 예외** `parse/` → `collector/RELEASES.json` import 선언 1건(메인 세션 결정). 다른 collector 파일·다른 폴더·다시 내보내기는 위반 — 샘플 7개 추가 |
| ② 번들 | `_build/generated.test.ts` | 동기(커밋본 = 지금 소스) · 해시 4중 일치 · 금지 토큰 · URL 호스트 = React 2곳 + `LINK_HOSTS` · 번들 입력 허용 경로 · 크기 예산 · 데이터 블록 = 원본 파일 · 부팅 계약(jsdom 실행) | **배포 게이트**: 번들 입력에 `deps.real.ts`·judge·recognize·catalog·E 카탈로그가 있고 `mocks/`·`deps.mock`·`deps.unwired`·`__tests__`가 없음 · 입력 허용에 RELEASES.json 1건 · 절대경로 검사를 `file:///`로 좁힘(AWS CLI `--policy-document file://<경로>`는 명령 내용) · **화면 전환 포커스 회귀 시험**(실제 HTML의 `<main>` 2개) · V1 안내 글자가 수집기 원문에 실제로 있는지 |
| ③ 플랫폼 | 헤더(CSP·TT·Permissions-Policy·COOP·XFO) | 네트워크·innerHTML·클립보드·프레임 차단 | — |
| ④ 행동 | RTL(목업) · **실제 엔진 RTL** · 헤드리스 Chrome | 렌더 가드 G-D3/4/7/8/9/12/13/23, 금지어, ⟦키⟧ 0 | `demo-real.test.tsx` 신설: 체험 4×2 실물(데이터 블록 + 실제 엔진)로 V3·V4 렌더 가드를 다시 돈다(§10) |

---

## 4. 컴포넌트 전략

- **프레젠테이션 / 컨테이너 분리**: `components/`는 props로 모델 조각만 받는다. `screens/`는 `useApp()`으로 상태·동작·엔진을 받아 조립한다.
- **관문 컴포넌트**: `MaskedValue`(사용자 데이터의 유일한 통로 — `DisplayValue.full/masked`를 읽는 곳은 이 파일뿐, 가드), `DocLink`(외부 링크 — `LINK_HOSTS`만, 새 탭 + noopener noreferrer), `StatusBadge`(상태 = 도형 + 글자 + 색), `CliBlock`(복사 버튼 0, 자리표시자 `<이름>`), `PasteBox`(값 보관 0, 맞춤법·자동완성 7속성), 부속 `DownloadLink`(href 관문 — 오프라인판 링크·Blob).
- **redacted 처리**: `InputRecognition.name`·`identityPreview.alias`가 `{kind:"redacted"}`로 오면 `MaskedValue`가 '가린 값'만 그린다(원값 개념이 DOM에 없음). 실제 파서로 비밀 패턴 파일 이름(`AKIA…`)과 별칭(`ghp_…`)을 넣어 V2 목록 → V3 맥락 줄까지 화면·속성·제목 어디에도 원값이 없음을 시험으로 고정했다 [확인].
- **문 구역(DoorSection) 규칙(통합 때 확정)**: 수집 안 한 문(not-collected)은 묶음 줄(`NotCollectedGroup`) 하나로 접되, **안내 카드가 있는 점검(`entry.guide` — AZ-MFA-G)은 일반 점검 행으로 그린다**(본인 응답 입력은 그 행 본문 한 곳뿐이라). 수집 줄의 사유는 정보가 있을 때만 붙인다(`shownCollectionReason` — 사유 코드 `not-collected`는 상태 글자를 되풀이할 뿐이라 뺀다).

---

## 5. i18n

- 세 파일 병합: C `_client/i18n/ko/components.ts`(384키) + S `ko/screens.ts`(328키) + E `lib/cloudcheck/rules/i18n/ko.ts`(694키). 첫 세그먼트로 소유가 갈린다(C·S·E 경계 린트, 중복 0).
- E 병합은 `ENGINE_KO satisfies EngineCatalog`로 컴파일 때 네임스페이스를 묶는다(다른 첫 세그먼트가 섞이면 type-check 실패).
- 조립 규약: `t()`(속성·제목·낭독 — `DisplayValue`를 타입으로 거부) / `<T>`(사용자 데이터 `{v}` → `MaskedValue`) / `<Msg>`(엔진 코드 → `keyOf`·`shortKeyOf` 단일 구현).
- **목업 시험과 실제 엔진 시험의 역할 분리**(통합 때 정함): 목업의 엔진 코드·카탈로그 키는 화면 개발용 가짜라 실제 E에 없는 것이 정상이다 → 목업 시험의 ⟦⟧ 검사는 C·S만 본다. **E 키 누락은 실제 엔진 시험**(real-engine · demo-real)이 실제 `judge()` 출력으로 `{ engine: true }`로 본다. 목업 키 이름 중 실제 규약과 다른 7개는 고쳤다(§8).

---

## 6. 상태 관리 · 의존성 주입

- **서버 상태 없음, 클라이언트 상태만**: `createStore(reducer)` + `useSyncExternalStore`. 동작(actions)이 dispatch 직후 최신 상태를 읽어야 해서(예: `report-ready` 직후 `show("report")`의 데이터 가드) useReducer 대신 동기 저장소를 쓴다.
- **엔진 주입**: `EngineDeps`(방향서 §5-3 함수 9개 + 카탈로그 + 룰셋 버전). 운영 = `REAL_DEPS`, 시험 = `createMockDeps()` 또는 `REAL_DEPS`. 화면·reducer는 lib를 직접 부르지 않는다.
- **이력**: `pushState`는 `state/history.ts` 한 곳, 인자 `({ cc: ScreenId }, "")`뿐(가드). `file://`에서도 Chrome은 정상 동작 [확인: 실브라우저], 실패하면 이력 없는 모드.
- **시각**: 현재 시각을 읽는 곳은 `state/clock.ts` 하나(`timeNotices`·`overlayExceptions`에만 넘긴다). judge는 시각을 받지 않는다(INV-9).
- **리포트 유실 방지**: 실제 리포트가 있을 때만 `beforeunload`, 창 전체 드롭 가로채기, 새 점검 전 확인 대화상자, V4 → V3 복귀 시 스크롤·포커스 복원(눌렀던 버튼으로 돌아옴 [확인: 실브라우저]).
- **화면 전환 4단계**: h1 포커스 → `document.title` → 스크롤 → 낭독. h1 탐색은 숨은 정적 셸의 `<main>`을 건너뛴다(§8 버그 수정).

---

## 7. 엔진(API) 연동 방식

네트워크 요청은 0이다. "API 연동"은 lib 함수 호출이다.

```
파일·붙여넣기·체험 블록 → (UI가 크기 상한 먼저: LIMITS) → recognize() → [목록 표시: buildInput()이 superseded·계정/클라우드 불일치 반영]
  → [이 계정으로 리포트 보기] → buildInput() → judge() → Report
  → 표시 단계에서만 합침: report.banners + timeNotices(report, now) · overlayExceptions(report, file, today) · 본인 응답(세션 상태)
```

- 실패 처리: recognize는 던지지 않는다. buildInput이 거부하면 V2에 남는다. judge가 계약을 어기고 던져도 리포트를 만들지 않고 V2에 남는다(`buildReport`의 try). 예상 못 한 렌더 오류는 ErrorBoundary → 정적 셸(V0 머리 + 부팅 대체 안내 + 오프라인판 링크) 복구.
- 체험: 데이터 블록 JSON → `recognize({ via: "demo" })` → 같은 파이프라인 → `Report.mode = demo`(시간 알림 0).
- 마스킹 사본: `maskedCopy(state.input)` → Blob `cloudcheck-masked.json`. 예외 파일: `serializeExceptions`/`parseExceptions` 왕복 검사 뒤에만 반영.

---

## 8. 통합 때 바꾼 것(파일 · 이유)

| # | 파일 | 바꾼 것 | 이유 |
|---|---|---|---|
| ① | `_client/i18n/index.ts` | `CATALOG`에 `ENGINE_KO` 병합, `FILES.engine = ENGINE_KO`, `ENGINE_KO satisfies EngineCatalog` | E 문장 표시(⟦키⟧ 0), 네임스페이스 컴파일 검사 |
| ② | `_client/main.tsx` | `REAL_DEPS` 연결 · ErrorBoundary의 `root.unmount()`를 다음 틱으로 | 실제 엔진 연결 / `componentDidCatch`(커밋 단계) 안의 동기 언마운트 회피 |
| ② | `_client/state/deps.unwired.ts` | **삭제** | 쓰는 곳 0 — 운영 번들에 잘못 연결될 길을 없앰(배포 게이트가 재확인) |
| ③ | `_client/components/DoorSection.tsx` | not-collected 문에서도 `entry.guide` 점검은 RuleRow(+GuideCard), 나머지만 묶음 줄 · 빈 `<ul>` 안 그림 | 엔진은 Azure 현관을 not-collected로 두고 AZ-MFA-G를 확인 불가로 준다 → 본인 응답 입력이 사라지던 간극 |
| ④ | `_client/components/DoorCollectionRow.tsx` | `shownCollectionReason()` 추가(사유 `not-collected`·null은 빼고, 수집됨이면 사유 없음) | "수집: 수집 안 함 · 수집 안 함", "현관 수집 안 함 (수집 안 함)", "일부만 수집됨 · 수집 안 함" 중복 제거. 수집 줄·조회 범위 문별 줄이 같은 함수 |
| ④ | `_client/i18n/ko/components.ts` | C 키 2개: `cc.c.dsec.collect.partial-bare`("수집: 일부만 수집됨"), `none-bare`("수집: 수집 안 함") | 사유 없는 문장(전에는 사유 자리에 "-") |
| ⑤ | `_build/generate.mjs` | esbuild target es2019 → **es2020** | 런타임이 이미 ES2020(`matchAll`)이라 문법만 낮출 이유가 없음. JS −5.6 KiB(gzip −2 KiB) |
| ⑤ | `_generated/page.ts` | 재생성(마지막: §9-1) | — |
| ⑥ | `_client/state/deps.real.ts` | `RULESET_VERSION`을 `rules/version`에서 직접 import(`failClosedReport(null)` 우회 제거) | 허용 목록에 `rules/version` 추가 |
| ⑦ | `_build/guards.test.ts` | lib 경계 예외 1건(`parse/` → `collector/RELEASES.json` import 선언) + 위반·허용 샘플 | 메인 세션 결정(릴리스 기록 단일 원천) |
| — | `_client/state/controller.tsx` | `findHeading()`: 숨은 `<main>`을 건너뛰고 보이는 `<main>`의 h1을 찾음 | **실브라우저 버그**: 정적 셸의 `<main>`이 먼저라 포커스가 `<body>`로 떨어짐(G-D28) |
| — | `_client/screens/screens.css` | `.cc-pm`에 `max-width:100%; overflow-wrap:anywhere` | **실브라우저 버그**: V7이 360px에서 576px로 넘침(Azure 권한 이름 최대 약 90자). V1 Azure 권한 목록도 같은 칩 |
| — | `_client/components/ScriptViewer.css` | `.cc-sv__l{white-space:pre-wrap; overflow-wrap:anywhere}`(기준안 규칙 뒤 덧씀, `/* 추가(프론트팀장 …) */`) | 백엔드팀장 요청: 약 1,170자 jq 줄. 소프트 줄바꿈이라 복사하면 원래 한 줄 |
| — | `_client/config.ts` · `screens/Prep.tsx` · `i18n/ko/screens.ts` | V1 '예상 호출 목록' 아래 원문 읽기 안내 1줄(클라우드별). S 키 2개 ⟨잠정⟩: `cc.prep.fp.endpoint-note.aws`, `cc.prep.fp.local-note.azure`. 명령 글자는 `SCRIPT_NOTES`에서 `{code}`(`translate="no"`)로 | 백엔드팀장 문구 후보 반영. 원문에 그 글자가 있을 때만 보임(낡지 않게). "네트워크 요청 없음"처럼 확인 안 된 주장은 쓰지 않음 |
| — | `_client/mocks/catalog.ts` · `mocks/reports.ts` | 가짜 키 7개: `cc.incident.aws-sto-2` 삭제(실제처럼 incident null), `.manual.how` 5개 → `cc.rule.<id>.how`(out-of-scope 항목은 엔진과 같은 `cc.rule.common.how-not-collected`), `cc.rule.az-mfa-g.guide.how` → `cc.rule.az-mfa-g.how` | DB설계자 대조 |
| — | 시험 | `real-engine.test.tsx`: `.fails` 제거·강화, 고정 수치를 엔진 출력으로(백엔드가 testdata를 바꿔 '확인 불가 1개'가 0개가 됨), redacted 시험, deps 연결 시험 / `demo-real.test.tsx` 신설 / `error-boundary.test.tsx` 신설 / `harness.missingKeys(text, { engine })` / `report.test.tsx` 알림 순서를 문장 앞부분으로 / `DoorSection.test.tsx` 사례 줄은 시험 안에서 카탈로그를 만들어서 + 새 시험 2개 / `mocks.test.ts` 키 이름 시험 / `catalog.test.ts` C 384키 / `styles.test.ts` 추가 규칙 10파일 + 소프트 줄바꿈 / `basic.test.tsx` 낡은 문구 | — |

---

## 9. 번들 예산 결정

### 9-1. 실측(최종 재생성 22:38 — 디자인 문구 수정이 끝나면 메인 세션이 다시 잰다)

| 대상 | 실측 | 방향서 목표 | 실패 기준 | 판정 |
|---|---|---|---|---|
| HTML 원본 | **864.6 KiB**(885,304 B) | 700 | 900 | 실패 기준 통과(여유 35.4 KiB) · 목표 초과 |
| HTML gzip(-9) | **222.9 KiB** | 200 | 260 | 실패 기준 통과 · 목표 초과 |
| 실행 JS | 693.5 KiB(710,126 B) | 480 | — | 목표 초과 |
| CSS(압축 후) | 31.6 KiB(32,378 B) | 30 | — | 목표 근소 초과 |
| 수집기 원문 합계 | 44.0 KiB(AWS 26,424 B + Azure 18,650 B) | 24 | — | 목표 초과(원문은 해시 대상이라 줄일 수 없음) |
| 체험 데이터 | 91.2 KiB | 100 | — | 목표 안 |

### 9-2. 구성(JS 693.5 KiB의 출처, 최종본) [확인: esbuild metafile]

| 출처 | KiB | 줄일 수 있나 |
|---|---|---|
| react + react-dom + scheduler | 138.3 | Preact로 약 −120(v1.1 후보, `package.json` 변경 → PM 승인) |
| zod(계약 검증) | 58.5 | 클라이언트 경로에서 빼려면 파서 재작성(API설계자) — v1 비권장 |
| E 카탈로그(엔진·룰 문장) | 95.4 | 문장 그대로의 값. 쓰지 않는 키는 사실상 0(추정 1 KiB 미만) — 이번 세션 중 디자인 문구 작업으로 +6.4 KiB(89.0 → 95.4) |
| C·S 카탈로그(화면 문장) | 54.2 | 같은 이유. 미사용 S 키 3개는 합쳐 0.3 KiB 미만 |
| 룰 18장 | 75.5 | 판정에 필요 |
| parse | 70.9 | 정규화(AWS 23.3 · Azure 14.8) 등 판정에 필요 |
| engine | 33.9 | 필요 |
| contract + model | 18.7 | 필요 |
| UI(components·screens·state) | 144.5 | 필요 |

시험 도구·픽스처·목업이 번들에 섞이지 않았음을 입력 목록으로 확인했다(`mocks/`·`deps.mock`·`__tests__`·`fixtures`·`testdata` 0).

### 9-3. 전송량(압축) [확인]

| | 원본 | gzip -9 | brotli q5 | brotli q11 |
|---|---|---|---|---|
| HTML 전체 | 864.6 KiB | 222.9 KiB | 206.9 KiB | 185.9 KiB |
| 그중 JS | 693.5 | 193.8 | 180.8 | — |
| 체험 데이터 | 91.2 | 7.2 | 6.6 | — |

- 실제 전송은 Vercel이 brotli로 압축한다 [확인: 라이브 `/pae/room/[code]` = 함수 응답 `content-encoding: br`]. 그래서 사용자가 받는 양은 원본이 아니라 약 186~207 KiB다(Vercel의 brotli 품질 값은 [미확인] — 위 표의 q5·q11 사이로 본다). 원본 900 KiB 기준은 오프라인판 파일 크기·HTML 파싱의 대리 지표이고, 첫 화면 체감은 압축 전송량과 JS 파싱·실행이 정한다.
- 첫 화면: 정적 V0 셸이 스크립트보다 먼저 그려진다. JS 691 KiB의 파싱·실행 시간과 LCP·CLS는 G5에서 라이브(모바일)로 잰다 [미확인].

### 9-4. 결정

1. **실패 기준은 방향서 그대로 둔다**(원본 900 KiB · gzip 260 KiB, `generated.test.ts`가 강제). 지금 통과한다.
2. **목표(보고용)는 넘는다. 상향안을 기획팀장에게 올린다**(방향서: 올리려면 기획팀장 확인). 확인 전까지 시험의 목표 값은 방향서 값 그대로 두고 '목표 초과'로 보고만 한다.

| 대상 | 제안 목표 | 근거 |
|---|---|---|
| HTML 원본 | 880 KiB | 실측 864.6 + 문구 다듬기 여유. 실패 기준 900 유지 |
| HTML gzip | 230 KiB | 실측 222.9. 실패 기준 260 유지 |
| 실행 JS | 720 KiB | 고정비(React 138 + zod 59) + 한국어 문장 150 + 판정 코드·UI가 실측 693.5 |
| CSS | 34 KiB | 컴포넌트개발자 권고 상한, 실측 31.6 |
| 수집기 원문 | 48 KiB | 원문 260줄 상한(C-01) × 2, 실측 44.0. 해시 대상이라 화면 쪽에서 줄일 수 없음 |
| 체험 데이터 | 100 KiB(유지) | 실측 91.2 |

3. **줄이는 일을 이번에 한 것**: target es2020(−5.6 KiB), 미사용·시험 코드 유입 0 확인. 데이터 블록 압축 표기(아래 B)는 전송량을 줄이지 않고 원본 숫자만 줄이므로 지금은 하지 않는다.

### 9-5. 실패 기준(900 KiB)에 닿을 때의 선택지(순서대로)

- A. 문구 순증을 멈추고 재생성으로 확인(디자인팀장 · DB설계자). 디자인 수정 뒤 `node src/app/cloudcheck/_build/generate.mjs` 요약 줄의 html 값을 본다.
- B. 체험 데이터 블록을 빌드 때 deflate + base64로 넣고 `DecompressionStream`으로 푼다: 원본 약 −80 KiB, 전송량 변화 거의 0. 대신 비동기 체험 로딩·소스 보기 가독성 저하·Safari 16.4 미만 미지원 → 프론트팀장 판단으로 실행 가능(목표를 낮추는 방향).
- C. 원본 실패 기준 상향(예: 960 KiB, gzip 260 유지) — 기획팀장 확인.
- D. Preact(v1.1) — PM 승인.

---

## 10. 검증 결과

### 10-1. 시험 [확인]
- `npm run type-check`: 오류 0.
- `npx vitest run src/app/cloudcheck`: 40파일 801개 통과(최종 실행 전 기준).
- `npx vitest run`(레포 전체): 204파일 4,731개 통과(최종 실행 §15).
- 새로 더한 실제 엔진 시험: 체험 4세트 × AWS·Azure V3(⟦⟧ 0 E 포함 · 금지어 0 · V3 쓰기 명령 0 · 속성·제목 누출 0 · 분포 칩 = 엔진 분포 · 확인 불가면 '아직 판단하지 못한 점검' 줄과 직접 볼 목록 · 체험은 시간 알림 0 · G-D3/4/7/9/12/23) / 아슬아슬상회 위험 점검 전부의 V4(쓰기 명령이 카탈로그에 있으면 쓰기 블록·자리표시자) / Azure 반듯상회 AZ-MFA-G 본인 응답(상태·분포 불변) / V1 원문 읽기 안내와 가장 긴 줄 / redacted 이름·별칭 / deps 연결(룰셋 버전 = 리포트 값, 카탈로그 18장).

### 10-2. 빌드 [확인]
- `rm -rf .next && npm run build`: 성공. `├ ƒ /cloudcheck 0 B 0 B`, `├ ƒ /cloudcheck/download 0 B 0 B`.

### 10-3. 로컬 서빙(`next start -p 3917`, 확인 뒤 종료) [확인]
- 헤더: §2-1 그대로(방향서 §2-2와 일치), CSP의 해시 = `PAGE.scriptHash`·`PAGE.styleHash`.
- `/cloudcheck` 본문 sha256 = `/cloudcheck/download` 본문 sha256 = `PAGE.sha256`(`cmp` 동일), 바이트 수 = `PAGE.bytes`.
- 루트 layout 흔적(jsdelivr·googleapis·adsbygoogle·`_next/static`·`__next`·gtag) 0건.
- `/pae` `/moira` `/exam` `/witness` 모두 200.
- 서버 종료 확인(포트 3917 리스너 0). 6001번 포트의 다른 앱(사용자 프로젝트)은 건드리지 않았다.

### 10-4. 헤드리스 Chrome 155(CDP, 스크린샷은 레포 밖 세션 스크래치패드) [확인: 실브라우저]
- 경로: V0 → V6 → 체험 아슬아슬상회 V3 → V4(AWS-MFA-1) → [돌아가기] V3 → 인쇄 미디어 / V7(전부 펼침) · V8 · V1(AWS, 수집기 내려받기, 원문 전부 펼침). 1280×900과 360×780(모바일).
- 최초 로드 요청 1건(문서), 하위 리소스 0. 콘솔 error·warning 0, 예외 0, Audits(CSP·Trusted Types 위반 포함) 0 — **React 18 + TT 2지시어 조건부 채택(방향서 §1-1 #9)의 Chrome 몫 일부를 확인**(V2 드롭·붙여넣기, V5, 실제 파일 경로는 STEP 5).
- 360px 가로 넘침: V0·V1(두 경로)·V2·V3·V4·V6·V7·V8 모두 0(고친 뒤). 
- 포커스: 화면 이동마다 새 화면 h1('체험 모드' → '체험 리포트'), V4 → V3 복귀는 눌렀던 [고치는 법] 버튼.
- 인쇄(`printToPDF`, 실제 인쇄 미디어): 라이트 색, 마스킹 기본(alias-001 · user-001 · '이름과 ID는 가려서 인쇄했습니다'), 체험 큰 제목, 머리 메뉴·체험 안내 패널 숨김, 위험 행 펼침.
- `file://`(오프라인판 바이트 그대로): 부팅, `cc-file` 클래스, 오류·위반 0, `pushState` 동작, Blob 내려받기 `cloudcheck-aws.sh` 26,424 B · sha256 `f223a053…480f` = `SHA256SUMS` = 파일.
- 수집기 원문 보기: 가장 긴 줄 1,177자가 줄바꿈되어 코드 영역 가로 넘침 0(1280·360).

---

## 11. 팀원 코드 리뷰

### 11-1. 잘 된 점
- 관문 5종 + DownloadLink가 스펙 시그니처대로이고, 가드가 관문 밖 사용을 막는다. `DisplayValue.full`을 읽는 곳이 MaskedValue 하나다.
- 상태: 동기 저장소 + 순수 reducer + React를 모르는 actions로 화면 없이 시험할 수 있다. `EngineDeps` 주입 덕에 목업 → 실제 엔진 전환이 import 한 줄이었다.
- 리포트 유실 방지 장치(이력 관문·beforeunload·창 드롭·확인 대화상자·V3 마운트 유지)가 디자인 의도대로다.
- 접근성: 접힘은 버튼 + 영역(aria-expanded/controls), 표는 role 명시(모바일 카드), 라이브 영역 2개(같은 문구 재낭독), 글자 없는 버튼 0.
- 시험: 컴포넌트 315 + 화면·상태 시험이 금지어·누출·쓰기 명령 위치를 렌더로 검사한다.

### 11-2. 고친 것(통합 단계, §8)
- 화면 전환 포커스(`findHeading`), V7·V1 권한 칩 넘침(`.cc-pm`), not-collected 문의 안내 카드 점검, 수집 줄 중복 문구, ErrorBoundary 언마운트 시점, 목업 가짜 키, 낡은 시험 기대값.

### 11-3. 남긴 것(작음 — STEP 5에서 판단)
1. `DownloadLink`가 `revokeObjectURL`을 다음 틱에 부른다. Chrome은 정상 [확인], Safari·Firefox에서 내려받기가 끊기는지 확인 필요(끊기면 수십 초 뒤 해제로).
2. 체험 회사를 바꿀 때(`otherCompany`) 본인 응답·예외 표시가 이전 체험에서 이어진다(새 점검 전 초기화는 실제 리포트만). 의도인지 UX 확인.
3. V2는 `buildInput()`을 렌더 중 `useMemo`로 한 번, [리포트 보기]에서 한 번 더 부른다. 25 MB 입력에서 메인 스레드 시간을 잴 것(필요하면 결과 재사용).
4. 미사용 S 키 3개(`cc.prep.path2.tag`, `cc.prep.hash.heading`, `cc.about.paths.guide-link`) — 디자인이 쓰거나 지운다.
5. 쓰지 않는 유틸 클래스 6개(`cc-gap-6`·`cc-gap-8`·`cc-hash__src`·`cc-inv`·`cc-sel`·`cc-ui`) — 1 KiB 미만.

---

## 12. lib 쪽 보고(고치지 않음)

| # | 대상 | 내용 | 제안 |
|---|---|---|---|
| L1 | 백엔드팀장 · DB설계자 — `fixtures/companies/build-azure.ts:149` | Azure 체험 데이터가 `run.doors.mfa: "collected"`인데 실제 수집기는 항상 `"skipped"`(`collector/cloudcheck-azure.sh:168`). 그래서 **체험** Azure 현관은 '수집: 일부만 수집됨'(엔진 partial + 사유 not-collected), **실제** Azure 현관은 '수집: 수집 안 함'으로 다르게 보인다 | 픽스처를 `"skipped"`로 맞추고 Azure 정답지(A~D)의 현관 수집 상태를 함께 확인. 아울러 `engine/blocks.ts buildDoorCollection`: 선택된 문의 모든 가족이 수집 안 됨이면 not-collected로 볼지 판단 |
| L2 | 디자인팀장 — `rules/i18n/ko*.ts` | 이 세션 동안 E 카탈로그 번들 기여분이 89.0 → 95.4 KiB(+6.4 KiB, 첫 통합 측정 21:57 → 최종 22:38). 원본 실패 기준(900 KiB)까지 여유 35.4 KiB | 문구 순증을 작게, 수정 뒤 생성기 요약 줄의 html 값으로 확인(§9-5) |
| L3 | 백엔드팀장 — `contract/calls.ts` | `az account show`는 로컬 조회(unit `local`)로 예상 호출 목록에 있는데 `az version`은 없다. UI는 안내 줄로 설명했다 | 목록에 넣는 기준을 `calls.ts` 주석에 한 줄로 |
| L4 | DB설계자 — `rules/catalog.ts` | 18장 모두 `incident: null`, `cc.incident.*` 키 0 → 문 구역의 '실제 사례' 줄은 v1에서 나오지 않는다(렌더 경로는 시험으로 유지) | 사례를 넣을 때 키·데이터를 함께 |
| L5 | API설계자 — `parse/testdata.ts` | AWS 표본 파일이 이제 확인 불가 점검을 내지 않는다(AWS-KEY-3 → 해당 없음) | 정보. 화면 시험은 엔진 출력 기준으로 바꿨고 확인 불가 화면은 체험 반쯤본상회로 본다 |
| L6 | 디자인팀장 | 이번에 더한 문구 4키: C `cc.c.dsec.collect.partial-bare`·`none-bare`, S ⟨잠정⟩ `cc.prep.fp.endpoint-note.aws`·`cc.prep.fp.local-note.azure` | 톤·금지어(자동 린트는 통과) 확인. S 2키는 백엔드팀장 문구 후보를 사실 확인된 범위로 줄여 쓴 것("네트워크 요청 없음"은 쓰지 않음) |

---

## 13. 알려진 문제 · STEP 5 QA 이월

**알려진 문제**
- 체험·실제 Azure 현관 수집 표기 불일치(L1, lib).
- 원본 크기 여유 4.2%(§9-5).

**STEP 5 이월(방향서 G5 + 디자인 §12에 더해)**
1. 실브라우저 나머지: V2(파일 드롭·붙여넣기·폴더·키 파일 거부·25 MB), V5(재점검 비교), 실제 파일 경로 V3·V4, 예외 내보내기·불러오기에서 CSP·TT 위반 0 — 이번 CDP 스크립트 방식(Audits·Runtime·Log 구독)으로 그대로 확장 가능.
2. Safari·Firefox: Blob 내려받기(즉시 해제, 11-3 #1), `<dialog>`, V1·V7·V8 `<details>`, 인쇄(버튼 경로 `cc-print-list-only`·`cc-print-unmask` 포함), `file://` `pushState`.
3. 라이브(G5): `curl -sI -H 'Accept-Encoding: br, gzip' …/cloudcheck` → `content-encoding: br` 확인, 본문 해시는 압축을 푼 바이트(`curl --compressed` 또는 Accept-Encoding 없이)로 `PAGE.sha256`과 대조. LCP·CLS(모바일)·JS 실행 시간 실측.
4. 360px: 실제 리포트의 긴 리소스 이름(MaskedValue `cc-any`), Azure V1 KQL 블록(코드 영역 안 스크롤), 알림 최대 밀도.
5. ErrorBoundary 경로(렌더 오류 주입 → 정적 셸 복구) 실브라우저.
6. 11-3의 #2(체험 간 본인 응답·예외 이어짐 의도), #3(대용량 입력 시간).
7. 디자인 확인: L6의 4키, 미사용 S 키 3개.
8. 예산 목표 상향(§9-4) 기획팀장 확인.

---

## 14. 파일

- 라우트·서빙: `src/app/cloudcheck/route.ts`, `src/app/cloudcheck/download/route.ts`, `src/app/cloudcheck/_serve/headers.ts`
- 생성·가드: `src/app/cloudcheck/_build/generate.mjs`, `src/app/cloudcheck/_build/template.mjs`, `src/app/cloudcheck/_build/generated.test.ts`, `src/app/cloudcheck/_build/guards.test.ts`, 생성물 `src/app/cloudcheck/_generated/page.ts`
- 연결: `src/app/cloudcheck/_client/main.tsx`, `src/app/cloudcheck/_client/state/deps.real.ts`, `src/app/cloudcheck/_client/i18n/index.ts`
- 새 시험: `src/app/cloudcheck/_client/screens/__tests__/demo-real.test.tsx`, `src/app/cloudcheck/_client/screens/__tests__/error-boundary.test.tsx`

---

## 15. 최종 실행 기록(22:38~22:45 KST)

| 단계 | 명령 | 결과 |
|---|---|---|
| 재생성 | `node src/app/cloudcheck/_build/generate.mjs` → `--check` | html 864.6 KiB(gzip 222.9) · js 693.5 · css 31.6 · 수집기 44.0 · 체험 91.2 / sha256 `f8ddc5969a973048e26a43fadbeef5b87ba698c3646e2b055464a716d5559ddc` / "지금 소스와 같습니다" |
| 수집기 해시(페이지 기록) | — | AWS `f223a053…480f`(26,424 B) · Azure `8bc7bd2f…462f8d`(18,650 B) = `SHA256SUMS` |
| 타입 | `npx tsc --noEmit` | 오류 0 |
| 시험 | `npx vitest run`(레포 전체) | 204파일 · 4,731개 통과(`generated.test.ts` 동기 검사 포함 초록) |
| 빌드 | `rm -rf .next && npm run build` | 성공 · `ƒ /cloudcheck` · `ƒ /cloudcheck/download`(0 B · 0 B) |
| 로컬 서빙 | `next start -p 3917` → curl → 종료 | 헤더 11종 일치 · 두 라우트 본문 = `PAGE.sha256` · CSP 해시 = `PAGE.scriptHash` · layout 흔적 0 · `/pae` `/moira` `/exam` `/witness` 200 · 리스너 0(종료 확인) |
| 실브라우저 | 최종 바이트를 `file://`로 · CDP | 요청 1건 · 콘솔·예외·로그·Audits(CSP·TT) 0(1280·360) · V3 ⟦⟧ 0 · 360px 넘침 0(V0·V1·V2·V6·V7·V8) · 화면 이동 포커스 = 새 h1 · V4 → V3 복귀 포커스 = 눌렀던 버튼 |

- 이 뒤에 디자인팀장의 `rules/i18n` 문구 수정이 끝나면 메인 세션이 재생성 → `generated.test.ts`(동기·예산) 초록을 다시 확인한다. 문구가 늘면 §9-5를 본다.
- 이 세션의 스크린샷·PDF·CDP 스크립트는 레포 밖(세션 스크래치패드)에 있다. 레포에는 시험만 남겼다.

---

## 16. STEP 5 QA 수정(2026-10-20, 프론트 담당분 — `docs/qa/cloudcheck-bug-report.md`)

`_generated/page.ts`는 재생성하지 않았다(API·DB설계자 lib 동시 수정 중 — 메인 세션이 마지막에 재생성). 확인은 `generate.mjs --preview <레포 밖>` + 헤드리스 Chrome 155(CDP, file://).

| 버그 | 처리 | 바꾼 파일 |
|---|---|---|
| **CC-QA-06**(G7 차단) | 범위 미증명(`coverage.proven = false`) 위험·주의 행의 꼬리표에 '계정 전체'·'… 전부'를 쓰지 않는다. 계정 단위·수가 다 찬 리전/구독 → "확인한 범위: 일부만(전체를 확인하지 못함)", 리전·구독 수가 모자라면 기존 "리전 n개(활성 m개 중)"(이미 '일부'를 말함). 기준 시각이 없는 미증명 행은 범위만 그린다. 증명된 행은 그대로("계정 전체") | `components/RuleRow.tsx`, `i18n/ko/components.ts`(C 2키 ⟨잠정⟩ `cc.c.rule.coverage.unproven` · `cc.c.rule.tail-scope`), `components/RuleRow.test.tsx`(+4) |
| **CC-QA-20** | 리플로: 식별자(`code`·`bdi`)·정의 목록 설명(`dd`)에 `overflow-wrap:anywhere`(최소 폭에도 반영), 범위 패널·V7 정의 목록·V4 머리 줄의 grid/flex 칸 `min-width:0`, 직접 볼 목록 권한 칩 폭 제한. 대상 표 등 카드 전환 기준 600 → **768px 미만(화면만, 인쇄는 표 유지)** | `screens/screens.css`, `components/table-card.css` |
| **CC-QA-21** | 범례: `<dl>`의 `role="group"` 제거, 접근 이름은 감싸는 `div role=group`에. V4 단계 제목 h3 → h2(모양은 h3 — `.cc-fixstep__h`). V7 펼친 본문 소제목 h4 → h3. **axe가 새로 잡은 V6** 회사 카드 제목 h3 → h2(크기는 `.cc-card__t`) | `components/StatusLegend.tsx`, `components/FixSteps.tsx`·`.css`, `screens/Catalog.tsx`, `components/Demo.tsx`, 시험 3곳(제목 수준 기대값) |
| **CC-QA-22** | 정적 셸(부팅 대체 안내·`<noscript>`)의 오프라인판 링크 바로 아래에 "이미 파일로 연 오프라인판이라면 이 링크는 열리지 않습니다. 지금 연 파일이 오프라인판입니다." ⟨잠정⟩. 스크립트 없이는 file://를 알 수 없어 링크를 숨기지 않고 글로 알린다 | `_build/template.mjs`(+`STATIC_KEYS`), `i18n/ko/components.ts`(`cc.boot.download-note`), `components/catalog.test.ts`(387키·그리지 않는 이유), `_build/generated.test.ts`(템플릿 단위 시험) |
| (확인 중 발견) | 강한 공지(잉크 반전) 안의 링크가 배경과 같은 색이라 **부팅 대체 안내·`<noscript>`의 '오프라인판 내려받기'가 보이지 않았다**(라이트·다크 둘 다, 스크립트가 돌면 숨어 axe에 안 잡힘) → `.cc-banner--strong a{color:inherit}`. 대비 17.8:1(라이트)·15.5:1(다크) | `components/Banner.css`, `components/styles.test.ts`(추가 규칙 12파일) |

**실브라우저(Chrome 155, preview file://)**
- 넘침 스윕 68회(V0·V1 두 경로·V2·V6·V7·V8·체험 4×2 V3 전부 펼침·V4 AWS/Azure × 360×780 모바일·640×450·320×225·1280×900): 문서 가로 넘침 0, 콘솔 오류·예외·CSP·TT 위반 0. 수정 전 재현: Azure 반쯤본상회 V3 360px → 556px(전부 펼침), 아슬아슬상회 V3 640px → 749px, V7 320px → 348px.
- axe-core 4.11.4(QA와 같은 판): V0·V1·V2·V3(AWS C·Azure D 전부 펼침)·V4·V6·V7·V8 × 라이트·다크 위반 0(수정 전 V3 dlitem 10 · V4 heading-order 1 · V7 heading-order 5 · V6 heading-order 1).
- 스크립트 끔(file://): 두 안내 모두 링크 + 새 안내 줄이 보인다.

**시험**: `npm run type-check` 0 · `npx vitest run src/app/cloudcheck` 806개 중 2개만 실패 — 둘 다 `_generated` 재생성 전이라 예상된 것(동기 검사, 정적 셸 키 검사) · QA `it.fails` 5개(CC-QA-06 ×3, CC-QA-21 ×2)가 "Expect test to fail"로 바뀜(= 고쳐짐, `it` 전환은 QA실행자).

**DB설계자 요청**: (1) 위험·주의인데 `coverage.proven = false`인 점검에 미증명 사유(`gaps` 같은 사유 코드 목록)를 모델에 실어 주면 꼬리표에 '일부만(사유: 잘림)'을 쓸 수 있다 — 지금 모델의 위험·주의 결과에는 사유가 없어 화면은 '일부만'까지만 말한다(모델 G0 변경 → 프론트·백엔드팀장 합의). (2) 같은 경우 확인 불가 대상이 없으면(예: 사용자 목록 잘림 AWS-MFA-2) '직접 볼 목록'에 '나머지 대상 직접 확인' 항목이 없다 — `engine/blocks.ts`에서 넣을지(QA 고치는 방향).

### 16-1. 기획팀장 결정 반영(2026-10-20, `docs/planning/cloudcheck-qa-decisions.md` §7·§8-A·§8-B)

- **V2 실제 Azure 입력 차단(베타 조건)**: `canCollect("azure")`가 거짓인 동안(운영 기본값 Azure '준비 중') V2의 실제 입력(수집기 JSON·Resource Graph CSV 등)으로는 리포트를 만들지 않는다. 판정 기준은 `state/pipeline.ts` `uncollectableCloud()`(읽은 입력의 신원 미리보기 → 입력 종류 순, 체험 via demo 제외). 막는 곳 둘: 화면(V2 버튼 `aria-disabled` + 이유 = 기존 키 `cc.start.azure-soon.note`, V0과 같은 보라 안내 + [Azure 체험 보기] — 새 키 없음)과 `actions.build()`(판정 전 인식 결과, 판정 뒤 리포트 신원 두 번 — 화면을 우회해도 막힘). 읽는 즉시 즉시 알림(role=alert)으로도 알린다. 체험(`openDemo`)은 그대로 열린다. 풀 때는 `config.ts` `CLOUD_AVAILABILITY.azure`만 바꾸면 된다(§8-C).
- 시험: `real-engine.test.tsx` 차단 5개(수집기 JSON·RG CSV 막힘, [Azure 체험 보기] → 체험 리포트, 공개 상태를 열면 리포트, AWS는 그대로), `state.test.ts` 5개(판별 함수·build() 이중 차단·체험 무관). 실제 Azure 리포트를 그리던 앱 시험 4개(real-engine 3 · extra 1)는 `availability: { aws: "beta", azure: "beta" }`를 주입했다. QA 시험 중 V2로 실제 Azure 파일을 넣는 3개(in-mask-canary IN-12 azure-C · ui/expression EX-01 · ui/xss Azure V2→V3)는 QA실행자가 같은 주입을 한다(§9-7).
- 실브라우저(preview file://, 1280·360): 실제 Azure 파일 → '읽었습니다' · 버튼 막힘(이유 글자 = 안내) · 즉시 알림 · 버튼을 눌러도 V2 그대로(리포트 0) · 가로 넘침 0 · 콘솔·CSP 0.
- **예산 표**: `generated.test.ts` `BUDGET` 보고용 목표를 HTML 880 · gzip 230 · JS 720 · CSS 34 · 수집기 48 · 체험 100으로(실패선 900 · 260 그대로). preview 실측 877.2 · 227.0 · 705.2 · 32.0 · 44.2 · 91.2 KiB — 모두 목표 안이지만 HTML은 목표까지 2.8 KiB, 실패선까지 22.8 KiB.

### 16-2. STEP 5 프론트 마무리(2026-10-20 03:2x — lib 동결 뒤)

- **새 알림 `as-of-before-evidence`(베타 차단, CC-QA-01)**: `ReportNotices`에 일반 알림(접힘, 제목·본문 E 키 `cc.banner.as-of-before-evidence.title/.body`)으로 넣고 순서를 `collected-at-approximate`(8) 바로 다음(9)으로. 뒤 순번을 하나씩 밀었다(doors-skipped 10 · duplicate 11 · stale 12 · future 13 · guidance 14 · 예외 요약 15 — 이름 있는 상수). type-check 오류 2건(TS2741 · TS2366) 해소. 목업 '실제 D'(알림 최대 밀도)에 넣어 8종, `ReportNotices.test`·`report.test` 순서 목록 갱신.
- **D-5**: 다른 체험 리포트가 있는 상태에서 체험 회사를 열면(`openDemo`) 본인 응답·예외 표시를 비운다(reducer `clear-annotations`). 뒤로 가기로 같은 리포트에 돌아가면 그대로.
- **D-6**: 붙여 넣은 CSV(기준 시각 없음 — `asOf = null`)이면 V2 그 줄 바로 아래에 `cc.input.paste-no-asof`(디자인 문장 그대로). 판별 `pastedCsvWithoutAsOf()`(pipeline), 표 컴포넌트는 `rowNote` 칸만 받는다(S 키는 화면이 만든다).
- **S 키**: 미사용 3개 삭제(`cc.prep.path2.tag` · `cc.prep.hash.heading` · `cc.about.paths.guide-link`), D-6 1개 추가 → 326키(남은 미사용 0). 디자인이 고친 ⟨잠정⟩ 문구 2개(`cc.boot.download-note` · `cc.prep.fp.endpoint-note.aws`)는 이미 반영돼 있었다.
- **재생성(03:25)**: `_generated/page.ts` sha256 `ec20c2011cbf7167d5cd7b3938521c49945bb17ea9c42ffde7271b31d4d70dbb`, 수집기 AWS `5547c91e…988`. HTML **894.4 KiB**(gzip 233.2) · JS 722.3 · CSS 32.0 · 수집기 44.3 · 체험 91.2 KiB.
- **예산 판정**: 실패선 HTML 900 · gzip 260 **통과**(HTML 여유 5.6 KiB = 0.6%) → 결정 순서(문구 순증 억제 → 960 조건 측정)는 이번에 발동하지 않는다. 보고용 목표는 HTML(880)·gzip(230)·JS(720)를 넘는다(CSS·수집기·체험은 안). 늘어난 몫은 대부분 lib 수정(E 카탈로그 694 → 729키, 판정 코드)이다. **다음에 문구·룰이 조금만 늘어도 900을 넘는다** → 그때 결정 ②(960 조건: gzip ≤ 260 · JS ≤ 760 · 모바일 LCP ≤ 2.5s · CLS ≤ 0.1을 느린 4G 스로틀로 측정)를 밟는다.
- **검증**: `npm run type-check` 0 · `npx vitest run src/app/cloudcheck` 40파일 823개 전부 초록(generated.test 동기·예산·데이터 블록 포함). 헤드리스 Chrome(최종 바이트 file://, 1280 · 360): V0 요청 1건 · 체험 아슬아슬상회 V3 ⟦⟧ 0 · V2 실제 Azure 파일 차단(버튼 막힘 · 이유 = 안내 · 누른 뒤에도 V2 · 리포트 0 · 즉시 알림) · E-01류(보고서 CSV 파일 시각 2026-10-10 < 안의 기록 2026-10-18) 리포트에서 알림 순서 '수집한 지 9일' → 신원 미확인 → 시각 추정 → **기준 시각보다 늦은 기록**, 본문 펼침 · 가로 넘침 0 · 콘솔·예외·CSP·TT 위반 0.

### 16-3. STEP 6 디자인 검수 수정(2026-10-20 04:5x — `docs/review/cloudcheck-design-review.md` F1~F4)

| # | 수정 | 파일 |
|---|---|---|
| F1(베타 조건 A) | 인쇄 머리 두 벌(`PrintHead` full·list)을 `<header>` 밖 `.cc-report`의 직계 자식으로 옮겼다 — print.css '직접 볼 목록만' 규칙이 직계 자식(`.cc-manual`·`.cc-print-only`)만 남기기 때문. 화면에서는 숨은 머리 때문에 `.cc-report>*+*`(32px)가 header에 걸리지 않게 `.cc-report>.cc-report__head{margin-top:0}`(화면 배치 그대로 — h1 위 4px는 숨은 형제 탓이던 여백이라 없어진다) | `screens/Report.tsx`, `screens/screens.css` |
| F2(베타 조건 B) | 600px 미만 `order:1`을 토글 버튼 안 제목으로 좁힘(`.cc-rule__tog>.cc-rule__title`) — '먼저 볼 3개'·요약 행 h3는 제자리 | `components/RuleRow.css` |
| F3(권고) | 높이 600px 이하 맥락 줄 스티키 해제를 `StickyContextBar.css` 끝에(번들에서 스티키 선언 뒤) | `components/StickyContextBar.css` |
| F4(권고) | 600px 이상에서 요약 행(동작 칸 없음)의 사유·꼬리표를 1열에 | `components/RuleRow.css` |

- **시험 보강**: `report.test`(인쇄 머리 두 벌 = `.cc-report` 직계 · cc-print-only · header 안 0 · 목록만 인쇄에서 남는 직계 = 머리 + 직접 볼 목록), `styles.test`(order는 직계 결합자로 좁힌 선택자 하나뿐 — F2, 요약 행 1열 — F4, 추가 규칙 파일 13개), `generated.test`(번들 CSS에서 낮은 화면 해제가 마지막 `.cc-ctx` 스티키 선언 뒤 — F3). 넷 다 고치기 전 코드에서는 실패한다.
- **재생성**: sha256 `c9f68992dd67556b998d5c2fb683d9f9a81bd305fd814f038b7960cd565e81bc`(백엔드팀장 CC-QA-24 수정 포함), 916,100 B = 894.6 KiB(gzip 233.3 · JS 722.4 · CSS 32.2 · 수집기 44.3 · 체험 91.2). 실패선 900 KiB(921,600 B)까지 5,500 B. `--check` 같음.
- **검증**: type-check 0 · `npx vitest run src/app/cloudcheck` 40파일 827개 초록. 디자인 스모크(`design-review.mjs`, 새 바이트 file://): `ONLY=d,m` 콘솔·예외·Audits 0, `PRINT[V3-real-btn-list]` 목록 머리 1·머리 글자·list-note·마스킹 안내 true·원값 누출 0(1쪽), `PRINT[V3-D-btn-list]` 목록 머리 1·list-note true·체험 큰 제목 1개·빈 칸 7·메모 8(3쪽), 메뉴 인쇄 4종 그대로(머리 full 1, 누출 0), 360 '먼저 볼 3개' [상태][제목] 먼저(`m360--V3-D-first.png`), 가로 넘침 0. `ONLY=lh`: 640×450·320×225 맥락 줄 `static`(띠만 줄어든 채 고정). CDP 탐침: 360 요약 행·먼저 볼 3개 h3 order 0(제목이 사유 위), 토글 안 제목 order 1 유지, 1280 요약 행 사유 1열·제목 아래. V1 `bannedAll`의 '%'는 수집기 원문(`printf '%s'`)이라 기준선과 같음(보이는 글자 금지어 0).
- **push 보호 대비(같은 라운드 추가 2건)**: `real-engine.test.tsx`의 GitHub 토큰 모양 별칭을 실행 중 조립(`["gh","p_",…].join("")`, 값 40자 그대로 — 원 리터럴과 같음을 node로 확인), `docs/review/cloudcheck-frontend-review.md`의 STS 키 ID 인용을 `ASIA…(생략)`으로(조립 예시에서도 전체 값을 뺌). QA 스캔(`secret-scan2.mjs`) 결과 `src/app/cloudcheck`(생성물 포함)·리뷰 문서 0건, 공개 예시(`AKIAIOSFODNN7EXAMPLE`·`wJalrXUtnFEMI/…EXAMPLEKEY`)만 예외 목록. 남은 16건은 모두 `src/lib/cloudcheck/parse/*.test.ts`·`collector/__scenarios__/aws.ts`(API설계자 담당 — 이번 라운드 손대지 않음). 시험 파일만 바뀌어 번들은 그대로(`--check` 같음).

### 16-4. STEP 7 직전 마지막 프론트 작업(2026-10-20 05:3x — 기획팀장 최종 리뷰 `docs/review/cloudcheck-final-review.md` §2-3 · D-E)

| # | 수정 | 파일 |
|---|---|---|
| 1 | 수집기 Blob 내려받기 MIME `text/plain` → `application/octet-stream`(`COLLECTOR_MIME`). Safari가 `.sh.txt`로 저장해 V1의 두 줄(`sha256sum`·`bash` + 파일 이름)이 실패하는 것을 막는다. 바이트·해시 그대로 | `screens/constants.ts`, `screens/Prep.tsx` |
| 1' | 나머지 내려받기는 이미 맞음: 마스킹 사본·예외 파일 = `.json` + `application/json`, 오프라인판 = `.html` + `text/html; charset=utf-8` + `Content-Disposition: attachment; filename="cloudcheck-0.1.0.html"` | (변경 없음) |
| 2 | **스모크에서 발견·수정**: V5에서 끝 4자리·별칭이 같은 다른 계정을 엔진이 `different-account`로 거부할 때 신원 칸에 '같은 계정입니다.'가 함께 보였다(IdentityCompare가 끝 4자리로 단정). 엔진 판정(`ok` 또는 `same-snapshot`)일 때만 그 문장을 쓰고, 아니면 두 계정 칸에 밑줄. 새 글자 0 | `components/Compare.tsx`, `screens/Compare.tsx` |

- **시험**: `basic.test`(수집기 이름 `cloudcheck-aws.sh` · Blob `application/octet-stream` · 화면의 두 줄이 같은 이름 — MIME을 `text/plain`으로 되돌리면 실패함을 확인), `report.test`(예외 파일 이름 + MIME, 마스킹 사본 MIME), `DownloadLink.test`(예시 짝을 `.sh` + octet-stream으로), `input-compare-demo.test`(sameAccount 필수 + 끝 4자리 같은 다른 계정), `real-engine.test`(실제 엔진 V5: 끝 4자리 같은 다른 계정 → 거부 + '같은 계정입니다' 없음 + 밑줄 2 — 고치기 전 코드에서 실패 확인, 같은 수집 결과 거부에는 '같은 계정입니다' 유지).
- **재생성**: sha256 `6cfc12bdfafddfbdc5a3b5945fd7b3cb6d7eaa0b2d53bb80f4c7d4946f40379e`, 916,238 B = 894.8 KiB(gzip 233.3 · JS 722.5 · CSS 32.2 · 수집기 44.3 · 체험 91.2). 실패선까지 5,362 B. `--check` 같음.
- **검증**: type-check 0 · `npx vitest run src/app/cloudcheck` 40파일 829개 초록 · 비밀 스캔(`secret-scan2.mjs`) 445파일 0건(공개 예시만).
- **실브라우저 스모크**(Chrome 155 헤드리스, 새 바이트, file:// + 레포 밖 HTTP 하네스[생성물 + `pageHeaders`/`downloadHeaders` 그대로] 두 방식, 시나리오마다 콘솔·예외·Log·Audits·securitypolicyviolation 0):
  - 내려받기: 수집기 `cloudcheck-aws.sh` 26,671 B · sha256 `5547c91e…` = 메타 · Blob octet-stream / 마스킹 사본 `.json`(실제 계정·별칭·사용자 이름 없음, 가명만) / 예외 파일 `.json` / (HTTP) 오프라인판 `cloudcheck-0.1.0.html` = PAGE 바이트.
  - V5(실제 엔진): 같은 계정 1시간 뒤 + 22번 고침 → '바뀐 점검 1개' + 4시간 캐시 배너 + '같은 계정입니다.' · 끝 4자리 다른 계정 → V2 [비교 보기] aria-disabled + 이유 글자 · 끝 4자리 같은 다른 계정 → V5 거부 + 밑줄(수정 뒤) · 같은 파일 → '같은 수집 결과' 거부 · 오래된 파일 → 순서 바꿈 배너. 1280·360 가로 넘침 0.
  - beforeunload(`Page.close`): V0 · 체험 리포트 = 확인창 없음, 실제 리포트 = 확인창 → 머물기면 리포트 그대로 → 다시 닫기 → 떠나기면 닫힘.
  - 키보드만 V0 → V1 → V2 → V3 → V4 → V3: 첫 Tab = '본문으로 건너뛰기', 화면마다 포커스 h1 · 제목 갱신, V1 방법 라디오 화살표 전환, V2 [파일 고르기] Enter = 선택창, V3 점검 줄 Space/Enter 펼침·접힘, V4 [← 리포트로] Space → 누른 [고치는 법]으로 포커스 복귀. 이상 0(보이지 않는 요소 포커스·포커스 표시 없음·body로 빠짐 0).
- **남는 것(비차단)**: V2 계정 칸의 '비교 대상과 같은 계정입니다'는 끝 4자리 기준이다(V2 인식 결과에 전체 ID가 없음). 끝 4자리가 같은 다른 계정이면 V2는 같다고 하고 V5가 거부한다 → v0.1.1 문구(디자인팀장) 또는 비민감 계정 지문(API설계자) 후보. Safari 실기기 이름 확인은 PM 수동 B-1 그대로.
