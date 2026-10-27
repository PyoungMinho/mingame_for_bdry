# 「문단속 5」(cloudcheck) 프론트엔드 최종 검수 — STEP 6 (@프론트팀장)

> 작성: @프론트팀장(Opus) · 2026-10-20 04:10~04:40 KST · 읽기 중심 검수(레포에서 바꾼 파일은 이 문서 하나)
> 입력: 프론트 최종 `docs/frontend/cloudcheck-frontend-final.md`(§16-2까지) · 방향서 `docs/planning/project-direction-cloudcheck.md`(§2·§3·§8 G5·§10) · 기획서 R-01~R-15(`docs/planning/cloudcheck-plan.md` 467~481행) · QA 결정 `docs/planning/cloudcheck-qa-decisions.md` · 버그 리포트 `docs/qa/cloudcheck-bug-report.md` §R(재검증)
> 코드 기준: 작업 트리 `src/app/cloudcheck/**`·`src/lib/cloudcheck/**`(미커밋). 생성물 `_generated/page.ts`는 03:25 재생성본(PAGE.sha256 `ec20c201…dbb`)
> 표기: [확인] 이번에 직접 실행·대조함 / [QA] QA 04:05 실행 결과를 근거로 씀 / [미확인] 확인 못 함

**이번에 실행한 것**: `git diff`·blob 해시 비교, 생성물 HTML을 메모리에서 풀어 sha256·CSP 해시·URL 호스트·금지 토큰·크기 재계산, Tailwind 전역 CSS를 메모리에서 두 번 만들어 비교(HEAD 기준선 vs +cloudcheck), 비밀 모양 문자열 스캔. 스크립트와 출력은 모두 레포 밖 세션 스크래치패드(`…/scratchpad/fe-review/`)에 있다.
**실행하지 않은 것**: `next build`·`next start`(`.next`는 10-19 23:00 그대로), `generate.mjs`(쓰기·`--check`·`--preview` 모두), vitest. 동기·시험 상태는 QA의 04:05 최종 실행과 파일 수정 시각으로 판단했다(§3 F-3).

---

## 0. 판정

### **프론트 관점: 베타 출시 조건부 승인**

- 아키텍처(라우트 2개·생성 파이프라인·가드 4층·i18n 3파일 병합·동기 저장소·엔진 주입)는 프론트 최종 문서와 같다. 방향서 §2-2 헤더 문자열, §3 공유 파일 9종 무수정, `next.config`·`middleware` 미생성도 지켰다. R-01~R-15 중 프론트가 지는 항목은 모두 충족이다(§2-3).
- **베타를 막는 프론트 결함은 없다.** 이번 검수에서 새로 찾은 것은 배포 절차 쪽 3건과 무해한 G5 편차 1건이다(§3).
- 다만 백엔드팀장의 CC-QA-24 수정(04:26~04:30, `rules/aws/aws-net-1.ts`·`rules/params.ts`·`parse/mask.ts`·micro 픽스처)이 지금 들어오고 있다. 모두 번들 입력이라 **03:25 생성물은 이미 소스와 다르다.** 그래서 아래 조건 C1을 지킨 바이트만 배포할 수 있다.

| # | 조건 | 종류 | 담당 |
|---|---|---|---|
| **C1** | 백엔드 수정이 끝나면 `_generated/page.ts`를 재생성한다. 그다음 `generate.mjs --check`, `generated.test`(동기·예산 ≤ 900 KiB·gzip ≤ 260), cloudcheck 스위트, 레포 전체, type-check가 모두 초록이어야 한다. 새 바이트로 실브라우저 스모크도 한다(요청 1건·CSP/TT 위반 0·체험 V3·V2 Azure 차단). QA 재검증은 03:25 바이트 기준이었다 | **필수**(push 전) | 프론트팀장(재생성) · 메인 세션 · 배포엔지니어(게이트) |
| **C2** | PM 수동 확인 2건: Safari Blob 내려받기 1회, 버튼 인쇄 2모드('이 목록만'·'이름·ID 표시') | 필수(QA 조건 그대로) | PM |
| **C3** | GitHub 푸시 보호 대비를 정한다(§3 F-2). 시험 파일의 비밀 모양 카나리아 때문에 `git push mingame main`이 거부될 수 있다 | **STEP 7 전에 결정** | 메인 세션 → PM |
| **C4** | G5 'Tailwind 산출 CSS 규칙 수 증가 0'에서 벗어난다. 실제 증가는 +4이고 어떤 요소에도 걸리지 않는다(§3 F-1). 베타는 알려진 편차로 기록하고 v0.1.1에 고치기를 권한다 | 기록·수용 결정 | 기획팀장(최종 리뷰) |

---

## 1. 문서 ↔ 코드 대조(아키텍처)

| 항목 | 프론트 최종 문서 | 코드에서 확인한 것 | 결과 |
|---|---|---|---|
| 라우트 | `route.ts`·`download/route.ts`, `force-dynamic`, nodejs, import는 `_generated`·`_serve`뿐 | 두 파일 모두 `dynamic = "force-dynamic"`·`runtime = "nodejs"`이다. import는 `PAGE`와 헤더 함수 둘뿐이다. `/cloudcheck` 아래에 `page`·`layout` 파일은 0개다 | 일치 [확인] |
| 헤더 | §2-1 = 방향서 §2-2 | `_serve/headers.ts`: CSP 15지시어(+헤더 전용 `frame-ancestors 'none'`)가 같은 순서로 있다. COOP·CORP same-origin, `no-referrer`, nosniff, XFO DENY, Permissions-Policy 9종(clipboard-read·write 포함), DNS 프리페치 off, `X-Robots-Tag: noindex`(`BETA_NOINDEX = true`), `Cache-Control: public, max-age=0, must-revalidate`. download는 여기에 `attachment; filename="cloudcheck-0.1.0.html"`만 더한다 | 문자 단위 일치 [확인] |
| HTML 머리 | charset → meta CSP → referrer → dns-prefetch → viewport·title → (X12: color-scheme·theme-color×2·description) → 파비콘 data: → style 1 | 생성물 HTML을 풀어 순서를 봤다. 같다. meta CSP는 헤더 CSP에서 `frame-ancestors`만 뺀 문자열이다 | 일치 [확인] |
| 생성물 무결성 | 해시 4중 일치 | sha256(PAGE.html) = `ec20c201…dbb` = PAGE.sha256이고 바이트는 915,844 = PAGE.bytes다. 실제 인라인 스크립트·스타일의 sha256 = `8b4sg4kH…`·`nhey7PpE…` = PAGE.scriptHash·styleHash = meta CSP 안의 값이다. 실행 `<script>` 1개, `<style>` 1개. 마크업의 `style=`·`on*=`·`src=`는 0이다 | 일치 [확인] |
| 데이터 블록 | 수집기 원문 2 + 메타 + 릴리스 + 체험 4×2 | 블록 12개(text/plain 2, JSON 10). 수집기 AWS 26,671 B `5547c91e…` · Azure 18,650 B `8bc7bd2f…`. 이 값은 파일 = `SHA256SUMS` = PAGE.collectors와 같다(3중). 수집기에 CR 0, `.gitattributes`로 LF 고정 | 일치 [확인] |
| 외부 호스트 | React 2곳 + `LINK_HOSTS` | 번들 URL 호스트: docs.aws.amazon.com 45 · learn.microsoft.com 17 · www.w3.org 13(SVG 이름공간) · reactjs.org 1(React 오류 안내) · www.helpnetsecurity.com 1(ClickFix 사례, `LINK_HOSTS` 안). 광고·분석·CDN 흔적(gtag·adsbygoogle·jsdelivr·googleapis·`_next/static`·`/_vercel/`)은 0이다 | 일치 [확인] |
| 금지 토큰 | 번들 층 ② | 번들에 `innerHTML` 5건, `location.href` 1건이 있다. 모두 React DOM 내부 코드다(SVG `setInnerHTML`, `contentWindow.location.href` 읽기). 앱 코드에는 0이다(AST 가드 + 독립 grep). `pushState` 1건은 `state/history.ts` 관문이다. 저장소·네트워크·`window.open` 토큰은 0이다 | 일치 [확인] |
| 엔진 주입 | `EngineDeps`(함수 9 + catalog + rulesetVersion), 운영 = `REAL_DEPS` | `main.tsx` → `state/deps.real.ts`. `deps.unwired.ts`는 없다. 목업·`deps.mock`·`__tests__`는 `generated.test`의 `INPUT_DENY`로 번들 입력에서 막힌다 | 일치 [확인] |
| i18n | C·S·E 병합, `ENGINE_KO satisfies EngineCatalog` | 키 수 C 387 · S 326 · E 729(common 163 + aws 343 + azure 223). §16-2 갱신분(S 미사용 3 삭제·D-6 1 추가, E 694 → 729)과 같다. `t()`·`<T>`·`<Msg>` 단일 구현이다 | 일치 [확인] |
| 상태 | 동기 저장소 + reducer + actions, 이력 관문, 시각 단일 | `createStore` + `useSyncExternalStore`. 현재 시각을 읽는 곳은 `state/clock.ts` 2줄뿐이다(나머지 `new Date(x)`는 날짜 산술). `pushState({cc}, "")`는 1곳, `replaceState`는 0이다 | 일치 [확인] |
| 리포트 유실 방지 | beforeunload(실제 리포트만)·창 드롭·확인 대화상자·V3 마운트 유지·V4 → V3 복원 | `unload.ts`·`drop.ts`·`ConfirmDialog`·`App.tsx`(V3를 `hidden`으로 유지)·`takeRestoreTarget`이 있다 | 일치 [확인] |
| 화면 전환 4단계 | h1 포커스(숨은 정적 셸 `<main>` 건너뜀) → title → 스크롤 → 낭독 | `controller.tsx` `findHeading()`이 `[hidden]` 안의 `<main>`을 건너뛴다. `navSeq === 0`(첫 화면)이면 포커스를 옮기지 않는다 | 일치 [확인] |
| 번역 차단 | V2~V5 컨테이너 + MaskedValue | `<main translate={noTranslate(screen) ? "no" : undefined}>`(input·report·fix·compare). 그 밖에 MaskedValue·CliBlock·ScriptViewer·HashDisplay·V1 코드 조각에도 붙어 있다 | 일치 [확인] |
| 전체 선택 | KQL·해시만 | `user-select:all`은 `CliBlock.css`(KQL)와 `HashDisplay.css` 두 곳뿐이다 | 일치 [확인] |
| V2 Azure 차단 | 화면 + `build()` 판정 전·후 두 번 | `Input.tsx`: `aria-disabled` + 이유 = `cc.start.azure-soon.note`. `actions.build()`: `uncollectableCloud`(판정 전) + `report.identity.cloud`(판정 뒤). 수집 JSON이 `ok`면 `recognize`가 신원 미리보기를 항상 채우고, Azure CSV는 입력 종류로 클라우드를 안다. 그래서 화면 단계 차단에 빈틈이 없다 | 일치 [확인] |
| 컴포넌트 | 46개, 관문 5 + DownloadLink | `components/*.tsx` 46개(시험 제외). `href`는 DocLink·DownloadLink에만 있다. 그 밖에는 Skip.tsx 주석 1줄뿐이다 | 일치 [확인] |

**문서에서 고칠 점(사소함, 다음 개정 때)**
1. 프론트 최종 §0-6·§1·§9-1의 수치(HTML 864.6 KiB, JS 693.5, CSS 31.6)는 D4 시점 값이다. 최신은 §16-2(894.4 · 233.2 · 722.3 · 32.0)다. 두 값이 섞여 읽히지 않게 §0에 '§16-2가 최신' 한 줄을 다는 게 좋다.
2. §11-3에 남긴 #3(V2 `buildInput()` 두 번 호출)과 #5(미사용 유틸 클래스 6개 `cc-gap-6`·`cc-gap-8`·`cc-hash__src`·`cc-inv`·`cc-sel`·`cc-ui`)는 그대로 남아 있다. #2(체험 간 본인 응답)는 D-5로, #4(미사용 S 키)는 §16-2로 닫혔다.
3. **G0 모델 변경 1건 — 공동 소유자로서 동의를 기록한다.** 방향서 §5-2 원문과 `src/lib/cloudcheck/model/report.ts`를 diff했다. 차이는 배너 종류 유니온에 추가된 `{ kind: "as-of-before-evidence" }` 하나뿐이다(CC-QA-01, 메인 세션 승인 주석). 추가형이라 '이름·의미 변경·삭제 = 메이저 증가' 규칙에 걸리지 않는다. `REPORT_MODEL = "cloudcheck.report/1"` 유지가 맞다. 화면(`ReportNotices` 순번 9)과 E 문구 2키도 반영돼 있다. 방향서 §5-2 본문은 다음 개정 때 §12 표로 옮기기를 요청한다.

---

## 2. 방향서 준수

### 2-1. §2 헤더 최종 문자열 — 일치 [확인]
§1 표의 '헤더'·'HTML 머리' 행과 같다. TT 2지시어는 조건부 채택(§1-1 #9)이다. QA 실브라우저에서 위반 0이었으므로 유지한다[QA].

### 2-2. §3 소유·공유 파일 — 무수정 [확인]

| 공유 파일 | `git diff --stat HEAD` | 작업 트리 blob = HEAD blob |
|---|---|---|
| `tsconfig.json` | 출력 없음 | `65893f97fab9` 같음 |
| `package.json` | 출력 없음 | `d10d38b3b8f1` 같음 |
| `package-lock.json` | 출력 없음 | `7325e0f877fd` 같음 |
| `vercel.json`(`regions: ["sin1"]`만) | 출력 없음 | `5d7b7617c3e9` 같음 |
| `tailwind.config.ts` | 출력 없음 | `26daf7353ef8` 같음 |
| `vitest.config.ts` | 출력 없음 | `a8f6af3cf6f3` 같음 |
| `src/app/layout.tsx` | 출력 없음 | `e4ca0cb9b5f9` 같음 |
| `src/app/providers.tsx` | 출력 없음 | `117277f07c91` 같음 |
| `src/app/globals.css` | 출력 없음 | `271588fbb7d5` 같음 |

- `git diff --cached`에도 9종은 없다. 루트·`src/`에 `next.config.*`·`middleware.*`도 없다(`apps/*` 아래 것은 별개 앱이 이미 추적하던 파일이다).
- 생성물은 프론트팀장만 재생성한다는 규칙을 지켰다. 마지막 재생성은 03:25이고 그 뒤 생성물을 손댄 기록은 없다.
- `_client` → lib import 허용 목록에는 방향서 §3 규칙 4보다 넓어진 항목이 있다(`contract/collect-schema`의 `LIMITS`, `exceptions-schema`의 `EXCEPTION_MAX_DAYS`, `normalized`의 `demoInputName`·`NormalizedInput` 타입, `rg-queries`, `model/banned-words`, `rules/version`의 `RULESET_VERSION`). 모두 기록된 결정(디자인 X11·메인 세션)이고, 이름 단위로 좁게 가드에 묶여 있다. lib 경계 예외는 `parse/` → `collector/RELEASES.json` 1건뿐이다.

### 2-3. R-01~R-15(프론트 관점)

| R | 요지 | 프론트 쪽 근거 | 판정 |
|---|---|---|---|
| R-01 | 기본 확인 불가, 증거 있을 때만 이상 없음 | 엔진 소관. UI는 상태를 만들거나 바꾸지 않는다(예외·본인 응답은 라벨, judge 시그니처에 없음) | 충족[QA G1] |
| R-02 | 수집기 영수증 | 백엔드 소관. UI는 범위 패널의 호출 기록·거부 호출을 그대로 보인다 | 해당 없음(표시만) |
| R-03 | 첫 화면 조회 범위·못 보는 것 고정 | `Report.tsx` D3 `ScopePanel` 접기 없음, `report.cannotSee` 전부 노출. 체험일 때만 접히는 안내 패널이 위에 온다(인쇄 제외) | 충족 [확인] |
| R-04 | 점수·등급·금지어 0 | 카탈로그 정적 검사와 렌더 검사가 `findBanned()` 하나를 쓴다 | 충족[QA EX] |
| R-05 | 수집기 원칙 | 백엔드 소관. 페이지의 원문 블록 = 파일 바이트(3중 일치) | 충족 [확인] |
| R-06 | 영속 저장 0 · URL 불변 · 테마는 미디어 쿼리만 | AST 가드, 번들 금지 토큰, 독립 grep 0. `pushState`는 화면 ID만, 해시·쿼리 변경 0. 다크는 `prefers-color-scheme`(tokens.css·screens.css)뿐이고 테마 토글·`data-theme`은 0 | 충족 [확인] |
| R-07 | 격리 (a)~(e) | (a) 마크업 리소스 참조 0, 외부 URL은 사용자가 누르는 링크(`LINK_HOSTS`)뿐 (b) 헤더 §2-2 (c) `unsafe-inline` 0 (d) 요청 1건[QA] (e) 공유 파일 무수정. 단 파생 산출물인 전역 Tailwind CSS가 +4 규칙 바뀐다(§3 F-1) | 충족(편차 1 기록) |
| R-08 | 오프라인 단일 HTML | `/download` = 같은 바이트(같은 `PAGE.html`). meta CSP에는 `frame-ancestors`가 없다. 해시 게시 채널(`HASH_CHANNELS`)은 G9까지 '준비 중' | 충족(게시는 G9) |
| R-09 | 룰 스키마 | 백엔드 소관 | — |
| R-10 | 예외는 로컬 파일·사유·만료·상태 불변 | `ExceptionForm` 사유 trim·만료 검증. `serialize → parse` 왕복 뒤 반영. `overlayExceptions`는 라벨만 바꾼다 | 충족 [확인] |
| R-11 | 쓰기 명령 분리·자리표시자·복사 버튼 0 | `CliBlock`: 복사 버튼 0, 자리표시자 `<…>`, 쓰기 블록은 V4에만. `clipboard-write=()` | 충족 [확인] |
| R-12 | 적대 입력·innerHTML 0·비밀 감지 | `dangerouslySetInnerHTML`·`innerHTML` 0(AST), TT `'none'`. 사용자 데이터 통로는 MaskedValue 하나, redacted는 원값이 DOM에 없다 | 충족 [확인][QA G6] |
| R-13 | 인쇄·내보내기 마스킹 기본 · 마스킹 사본 | 이중 렌더 + `print.css` 기본 마스킹, '이름·ID 표시'는 버튼 흐름에서만(`cc-print-unmask`). `maskedCopy` → Blob | 충족(버튼 2모드는 C2 PM 확인) |
| R-14 | 분석·텔레메트리 0, OG 라우트 금지 | HTML에 분석 흔적 0. cloudcheck 라우트는 2개뿐(OG·이미지 라우트 0) | 충족 [확인] |
| R-15 | 공급망 | 수집기 해시 3중 일치(시험 + 이번 대조). 2FA·태그·SHA256SUMS 게시는 G9(PM) | 부분(G9 몫) |

---

## 3. 이번 검수에서 새로 찾은 것

### F-1 · G5 편차 — Tailwind 전역 CSS에 무해한 규칙 4개가 생긴다(낮음, 베타 차단 아님)

- **측정** [확인]: 레포의 `tailwind.config.ts`와 `globals.css`로 Tailwind 3.4.19를 메모리에서 두 번 돌렸다. 기준선은 HEAD 추적 파일 358개(staged `/flight`·untracked `/office` 제외 = 지금 프로덕션), 비교는 기준선 + `src/app/cloudcheck/**` 142개다. 결과는 867 → **871 규칙**, 82,610 → 82,727 B(+117 B, 압축 전)였다.
  ```css
  .collapse { visibility: collapse; }
  .m-16 { margin: 4rem; }
  .m-7 { margin: 1.75rem; }
  .\[_\:\.-\] { _: .-; }
  ```
- **원인**: 루트 Tailwind는 `src/app/**`를 스캔한다. 네 규칙 모두 `_generated/page.ts`에서 나온다. 생성물만 넣어도 +4, 생성물을 빼면 +1(`.collapse`)이다.
  - `collapse`: 생성 CSS의 `border-collapse:collapse`, 그리고 C 키 `cc.c.banner.collapse`(`Banner.tsx`·`ko/components.ts`).
  - `m-16`·`m-7`: 번들 안 SHA-256 구현의 압축된 식 `t[m]=t[m-16]+b+t[m-7]+k`.
  - `[_:.-]`: `parse/as-of.ts` 파일 이름 시각 정규식.
- **영향**: HEAD의 `src/**`·`public/**` 어디에도 이 네 이름을 클래스로 쓰는 요소가 없다(같은 글자는 `gung.css`·`pae.css`의 CSS 속성 `border-collapse: collapse`뿐이다). Tailwind 플러그인도, 클래스 이름을 다는 UI 라이브러리도 없다(의존성 확인). 그래서 **어느 페이지의 모양도 바뀌지 않는다.** 남는 영향은 전역 CSS 파일 해시가 한 번 바뀌어 모든 페이지가 CSS를 한 번 새로 받는 것과 +0.1 KiB 정도다.
- **방향서 기준**: G5 "Tailwind 산출 CSS 규칙 수 증가 0(늘면 원인 토큰을 바꾼다)"에 문자 그대로는 맞지 않는다. S1 스파이크 때 측정값(762 → 762)은 생성 CSS와 해시 구현이 번들에 들어오기 전이었다.
- **권고**: 베타는 **알려진 편차 G5-TW1**로 기록하고 그대로 간다(C4). 고치려면 서빙 경로(생성물 위치나 저장 형식)를 바꿔야 하는데, QA가 끝난 지금 그 경로를 건드리는 위험이 이득보다 크다. v0.1.1에서 고친다(§7 P0-1): 생성물을 Tailwind 스캔 밖으로 옮기고(예: `src/lib/` 아래 생성 모듈, 또는 base64로 저장해 라우트가 모듈 로드 때 푸는 방식), C 키를 `cc.c.banner.fold-close` 같은 이름으로 바꾸고, `generated.test`에 'cloudcheck 파일만으로 생기는 Tailwind 유틸리티 0' 시험을 더한다.

### F-2 · STEP 7 위험 — 공개 저장소 push가 GitHub 푸시 보호에 거부될 수 있다(외부 요인, 결정 필요)

- **사실** [확인]:
  - 배포 저장소 `mingame_for_bdry`는 공개다(방향서 §10-7).
  - GitHub의 사용자 푸시 보호는 기본으로 켜져 있고 공개 저장소로의 push를 막는다. 막히면 push 전체가 거부된다. 이유('used in tests' 등)를 대고 우회할 수 있다.
  - 푸시 보호 대상에는 Azure Storage Account Key, AWS 키 ID + 비밀 키 쌍, AWS 임시 키, Azure SAS 토큰, GitHub PAT가 들어 있다(근거는 §8).
- **해당 문자열**: 모두 '키를 받지 않는다' 방어를 시험하는 가짜 카나리아다. 실제 서빙 바이트(`_generated/page.ts`)에는 0이다[확인]. 이번에 공개 저장소에 처음 올라가는 모양이다(HEAD 추적 파일에 선례 0).

  | 위험 | 위치 | 모양 |
  |---|---|---|
  | 높음 | `src/lib/cloudcheck/qa/in-keyfiles.test.tsx:25` | 완전한 Azure Storage 연결 문자열(`DefaultEndpointsProtocol=…;AccountKey=` + 88자 키) |
  | 높음 | `src/lib/cloudcheck/qa/in-keyfiles.test.tsx:26·39·46`, `src/lib/cloudcheck/parse/secrets.test.ts:70~72` | `sv=…&se=…&sig=…` 형태의 SAS URL |
  | 중간 | `src/lib/cloudcheck/qa/in-keyfiles.test.tsx:21`(+ `:14` `SECRET`), `src/lib/cloudcheck/parse/secrets.test.ts:43`, `src/lib/cloudcheck/qa/in-secrets.test.tsx:22` | STS 쌍 `ASIA…(생략)` + 비밀 키 |
  | 낮음 | 19파일(시험·시험 도우미 — AWS 문서의 공식 예시 값) | `AKIAIOSFODNN7EXAMPLE` / `wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY` |
  | 낮음 | `real-engine.test.tsx`, `foundation.test.ts` 외 | `ghp_0123…`(순번 모양 가짜 — 토큰 체크섬이 맞을 가능성 낮음 [미확인]), `xoxb-…`(형식 불완전), PEM 머리글 |

- 실제로 막힐지는 [미확인]이다. GitHub 패턴의 세부 조건을 알 수 없다. 다만 막히면 STEP 7이 push 단계에서 멈춘다. 그때 고르는 대응은 둘 중 하나다.
  - **(A, 권장)** 커밋 전에 위 리터럴을 실행 중 조립으로 바꾼다. 예: `"Account" + "Key="`, `["ASIA", "…(생략)"].join("")`(이 문서에도 전체 값은 적지 않는다). `secrets.test.ts`의 `ghp_${…}`가 이미 이렇게 한다. 시험의 뜻은 같다. 담당은 QA실행자(`qa/**`)와 API설계자(`parse/*.test.ts`)이고, 바꾼 뒤 cloudcheck 스위트를 다시 돈다. 공개 저장소에 스캐너용 리터럴을 남기지 않으므로 GitGuardian 같은 외부 스캐너 경보도 피한다.
  - **(B)** 막히면 PM이 GitHub가 준 주소에서 'It's used in tests'로 우회한다. 바깥을 향한 조치라 PM이 직접 결정해야 한다.
- 어느 쪽이든 **STEP 7 시작 전에 정해 두기를 권한다.** 막힌 push는 아무것도 올리지 않으므로 라이브에는 영향이 없다.

### F-3 · STEP 7 필수 — 생성물이 지금 소스와 다르다(C1)

- 03:25 재생성 → QA 04:05 최종 실행(동기 초록)까지는 맞았다. 그 뒤 번들 입력인 `rules/aws/aws-net-1.ts`(04:30:30), `rules/params.ts`(04:29:44), `parse/mask.ts`(04:30:21), `fixtures/micro/*`(04:26)가 바뀌었다[확인: 파일 시각]. 그래서 지금 `generated.test` 동기 검사는 실패하는 상태다. 방향서 §1-2 N에 따르면 정상이지만, 배포 게이트에서는 반드시 초록이어야 한다.
- CC-QA-24 시험은 이미 `it.fails` → `it`로 바뀌어 있다(`known-low.test.ts:125`, 같은 변경 원칙을 지킴).
- `mask.ts`는 R-13(마스킹 사본)에 닿는다. 그래서 C1의 '레포 전체 초록'에 `in-mask-canary`·`net-sources`(마스킹 재현)가 들어 있는지 확인한다.
- **예산**: 여유가 5,756 B뿐이다. 재생성 요약 줄의 html이 900.0 KiB(921,600 B)를 넘으면 push하지 않는다. 그때는 §6의 결정 순서를 밟는다.

### F-4 · 정보 — 점검 명령의 오탐 두 가지

- **`serviceWorker`**: `grep -rn serviceWorker src/`는 2건을 낸다. 둘 다 금지 목록을 적은 검사 코드다(`_build/guards.test.ts`, `_build/generated.test.ts`). 런타임 코드와 생성물에는 0이다[확인]. 판정 명령은 `grep -rln serviceWorker src | grep -v '/_build/'`(0이어야 함)로 쓴다.
- **`process.env`**: cloudcheck 안에 4곳이 나온다. `config.ts` 주석, `i18n/index.test.ts`(시험용 TZ), `generate.mjs`의 esbuild `define`(빌드 때 `"production"`으로 바뀜), `guards.test.ts`(규칙)이다. 라우트 2개·`_serve/headers.ts`·생성물에는 0이다 → **env 드리프트 해당 없음**.

### F-5 · 정보 — 최종 코드로는 `next build`가 아직 한 번도 돌지 않았다

- 마지막 빌드는 `.next/BUILD_ID` 10-19 23:00이다. 그 뒤 cloudcheck의 시험 외 파일 79개(생성물·lib·화면·픽스처)가 바뀌었다.
- STEP 7의 `rm -rf .next && npm run build`가 첫 실행이다. 그래도 큰 위험은 없다.
  - 루트에 ESLint 설정이 없어서 빌드 중 lint 실패는 없다.
  - 빌드의 타입 검사 범위는 `npm run type-check`와 같은 tsconfig이고, 이것은 QA 04:05에 오류 0이었다.
  - 라우트·헤더 파일은 10-19 19:21 이후 바뀌지 않았다.
- 출력에서 `ƒ /cloudcheck`·`ƒ /cloudcheck/download`(First Load JS 0 B)를 확인한다.

### F-6 · 정보 — 성능은 아직 재지 않았다

- PF-01~05와 LV-08은 미실행이다[QA].
- 정적 V0 셸이 먼저 그려지므로 LCP는 셸 글 블록 시각이 될 것으로 *기대*한다. 다만 앱 V0이 셸보다 큰 글 블록을 그리면 LCP가 JS 실행 뒤로 밀린다(JS 722 KiB, 4× CPU).
- LV-08에서 LCP 요소가 정적 셸 쪽인지 같이 기록한다. 이 측정은 §6의 결정 ②(원본 실패선 960) 근거로도 쓰인다.

---

## 4. 배포 전 점검표 미리보기(STEP 7 — @배포엔지니어)

'지금'은 이번 검수(04:10~04:40)에서 미리 돌린 결과다. 순서대로 진행하고, 하나라도 기대와 다르면 멈춘다.

| # | 항목 | 명령·방법 | 기대 | 지금 |
|---|---|---|---|---|
| 1 | 리모트·기준선 | `git remote -v` · `git fetch mingame` · `git rev-list --left-right --count mingame/main...HEAD` · 직전 정상 SHA 기록 | push 대상 `mingame`(origin 아님), 앞섬·뒤처짐 `0 0`, 기준선 `cc95172` | HEAD = mingame/main = `cc95172`. 로컬 기록 기준이고 마지막 fetch가 10-05라 **fetch가 필요하다** |
| 2 | 공유 파일 9종 | `git diff --stat HEAD -- tsconfig.json package.json package-lock.json vercel.json tailwind.config.ts vitest.config.ts src/app/layout.tsx src/app/providers.tsx src/app/globals.css` | 출력 없음 | 출력 없음, blob 9/9 = HEAD |
| 3 | 생성 금지 파일 | `ls next.config.* middleware.* src/middleware.* 2>/dev/null` | 없음 | 없음 |
| 4 | 서비스 워커 | `grep -rln serviceWorker src \| grep -v '/_build/'` | 0줄 | 0줄(F-4) |
| 5 | env 드리프트 | `grep -rn 'process\.env' src/app/cloudcheck/route.ts src/app/cloudcheck/download/route.ts src/app/cloudcheck/_serve src/app/cloudcheck/_generated` | 0 → 해당 없음 | 0 |
| 6 | Node | `node -v` | 22.x(`.nvmrc` 22) | v22.10.0 |
| 7 | **재생성(C1)** | 백엔드 수정이 끝난 것을 확인한 뒤 `node src/app/cloudcheck/_build/generate.mjs` → `--check` | "지금 소스와 같습니다", 대기 입력 0건 | **필요**(F-3) |
| 8 | 예산 | 7번 요약 줄의 `html`·`gzip` | html ≤ 900.0 KiB, gzip ≤ 260 KiB. 넘으면 push 금지 → §6 | 03:25 기준 894.4 KiB(여유 5,756 B) · gzip 233.2 KiB |
| 9 | 게이트 | `npm ci` → `npm run type-check` → `rm -rf .next && npm run build` → `npm run test` | 오류 0 · `ƒ /cloudcheck`·`ƒ /cloudcheck/download` 0 B · 전부 초록(CC-QA-24 `it` 포함) | QA 04:05: type-check 0 · 254파일 6,045 통과(그 뒤 lib 변경 → 다시 돈다) |
| 10 | `test:redline` | `npm run test:redline` | "No test files found" exit 1 → **N/A로 기록**(방향서 §10-4, Q15) | — |
| 11 | 새 바이트 스모크 | 헤드리스 Chrome으로 `PAGE.html`을 file://로 엶 | 요청 1건 · 콘솔 오류·CSP·TT 위반 0 · V0 → V6 → 체험 V3 ⟦⟧ 0 · V2 실제 Azure 파일 차단 | QA는 03:25 바이트로 확인함 |
| 12 | Tailwind 산출 CSS | 클린 빌드의 `.next/static/css/*.css` 규칙 수를 기록(라이브 CSS와 비교) | 기준선 + 4(F-1, 수용 시) | +4 [확인: 메모리 비교] |
| 13 | 경로 한정 스테이징 | §5 | cloudcheck 경로만 | 초안 §5 |
| 14 | 시크릿 스캔 | `git diff --cached`에서 provider 패턴 | 카나리아(F-2 표) 말고 0. 서빙 바이트에서 0 | 서빙 바이트 0 · 카나리아는 시험 파일에만 |
| 15 | 프리뷰 승인 | 로컬 `next start`로 V0 · 체험 C 리포트 · 인쇄 미리보기 스크린샷 → PM | 명시 승인 | — |
| 16 | push | `git push mingame main`(force 금지, 직렬화) | 거부 없음. GH013(푸시 보호)이면 F-2 (A)/(B) | 결정 필요(C3) |
| 17 | 라이브 LV-01~10 | 버그 리포트 §11 그대로. 기대 해시는 **7번에서 새로 만든 PAGE.sha256**(`ec20c201…`가 아님) | 헤더 §2-2 · `content-encoding: br` · 두 라우트 본문 = PAGE.sha256 · 고유 콘텐츠 "문단속 5"·베타 띠 · `/pae` `/moira` `/exam` `/witness` 회귀 없음 · LV-08 LCP·CLS 기록 | — |
| 18 | 롤백 | ① Vercel → Deployments → 직전 정상 배포 "Promote to Production" ② `git revert --no-edit <SHA> && git push mingame main` | — | 기준선 `cc95172` |

---

## 5. 커밋 경로 목록 초안

### 5-1. 넣을 것(cloudcheck만)

| 묶음 | 경로 | 지금 개수 |
|---|---|---|
| 앱 | `src/app/cloudcheck/`(라우트 2 · `_serve` · `_build` · `_generated` · `_client` 전체, 시험 포함) | 189 |
| lib | `src/lib/cloudcheck/`(model · contract · parse · engine · rules · collector(+`.gitattributes`·`SHA256SUMS`·`RELEASES.json`) · fixtures · qa) | 237 |
| 기획 | `docs/planning/cloudcheck-plan.md` · `docs/planning/project-direction-cloudcheck.md` · `docs/planning/cloudcheck-qa-decisions.md` | 3 |
| 디자인 | `docs/design/cloudcheck-ux-spec.md` · `docs/design/cloudcheck-ui-spec.md` · `docs/design/cloudcheck-design-final.md` · `docs/design/cloudcheck-lead-review.md` · `docs/design/cloudcheck-rule-copy-review.md` | 5 |
| 프론트 | `docs/frontend/cloudcheck-lead-review.md` · `docs/frontend/cloudcheck-frontend-final.md` | 2 |
| 백엔드 | `docs/backend/cloudcheck-lead-review.md` · `docs/backend/cloudcheck-backend-final.md` | 2 |
| QA | `docs/qa/cloudcheck-test-plan.md` · `docs/qa/cloudcheck-bug-report.md` | 2 |
| STEP 6 | `docs/review/cloudcheck-frontend-review.md`(이 문서) + 생기면 `docs/review/cloudcheck-design-review.md` · `docs/review/cloudcheck-backend-review.md` · 기획팀장 최종 리뷰(선례상 `docs/planning/cloudcheck-final-review.md` 또는 `docs/review/cloudcheck-final-review.md`) | 1 + α |

- 시험·픽스처·QA 파일도 넣는다. 다음 배포부터 `npm run test` 게이트의 일부다.
- 잡파일(`.DS_Store`·로그·이미지·PDF)은 이 두 디렉터리에 0이다[확인]. `.DS_Store`는 `.gitignore`에 있다.
- 가장 큰 파일은 `_generated/page.ts` 0.96 MB다(GitHub 경고 기준 50 MB보다 한참 작다).
- 개수는 백엔드 수정으로 조금 바뀔 수 있다. 스테이징 직전에 `git ls-files --others --exclude-standard -- src/app/cloudcheck src/lib/cloudcheck | wc -l`로 다시 센다.

### 5-2. 넣지 않을 것(다른 작업 — 상태를 그대로 둔다)

- **staged `/flight` 45파일**: `src/app/flight/**`, `src/lib/flight/**`, `docs/design/flight-*.md`, `docs/planning/flight-*.md`, `docs/planning/project-direction-flight.md`, `docs/qa/flight-*.md`. unstage·restage하지 않는다(PM 작업 상태 보존).
- **untracked**: `src/app/office/`(4) · `docs/design/office-clay-design.md` · `docs/design/office-clay-spec.json` · `docs/planning/dogpic-gallery.md` · `docs/planning/dogprompt-library.md` · `docs/planning/dogprompt-seeding-plan.md` · `docs/research/rewind/audit/ddg.html` · `docs/research/rewind/audit/naver.html`.
- 공유 파일 9종(바뀐 것도 없다).

### 5-3. 명령 초안(방향서 §10-2의 경로 한정 커밋 — `git add -A` 금지)

```bash
CC_DOCS="docs/planning/cloudcheck-plan.md docs/planning/project-direction-cloudcheck.md docs/planning/cloudcheck-qa-decisions.md \
docs/design/cloudcheck-ux-spec.md docs/design/cloudcheck-ui-spec.md docs/design/cloudcheck-design-final.md docs/design/cloudcheck-lead-review.md docs/design/cloudcheck-rule-copy-review.md \
docs/frontend/cloudcheck-lead-review.md docs/frontend/cloudcheck-frontend-final.md \
docs/backend/cloudcheck-lead-review.md docs/backend/cloudcheck-backend-final.md \
docs/qa/cloudcheck-test-plan.md docs/qa/cloudcheck-bug-report.md \
docs/review/cloudcheck-frontend-review.md"      # + STEP 6 다른 리뷰 문서(생긴 이름 그대로 추가)

git add -- src/app/cloudcheck src/lib/cloudcheck $CC_DOCS
git diff --cached --stat -- src/app/cloudcheck src/lib/cloudcheck $CC_DOCS | tail -1    # 파일 수 확인
git commit -m "feat: 문단속 5(/cloudcheck) — AWS 베타(띠 · noindex), 자체 완결 HTML + 오프라인판" -- src/app/cloudcheck src/lib/cloudcheck $CC_DOCS
```

*(zsh는 따옴표 없는 `$CC_DOCS`를 단어로 나누지 않는다. bash에서 돌리거나 경로를 직접 나열한다.)*

### 5-4. 커밋 뒤 확인

```bash
git show --name-only --format= HEAD | grep -vE '^(src/(app|lib)/cloudcheck/|docs/[a-z]+/cloudcheck-|docs/planning/project-direction-cloudcheck\.md$)'   # 출력 없어야 함
git diff --cached --name-only | wc -l                                       # 45 (/flight가 여전히 staged)
git status --porcelain -- src/app/office docs/research | head               # 그대로 untracked
git ls-files --eol -- src/lib/cloudcheck/collector/cloudcheck-aws.sh src/lib/cloudcheck/collector/cloudcheck-azure.sh   # i/lf
git show HEAD:src/app/cloudcheck/_generated/page.ts | shasum -a 256; shasum -a 256 src/app/cloudcheck/_generated/page.ts   # 같은 값
```

---

## 6. 번들 여유(5.6 KiB) 관리 방안

### 6-1. 지금(03:25 생성물) [확인]

| 대상 | 실측 | 실패선 | 여유 |
|---|---|---|---|
| HTML 원본 | 915,844 B(894.4 KiB) | 921,600 B(900 KiB) | **5,756 B(0.6%)** |
| HTML gzip -9 | 238,794 B(233.2 KiB) | 266,240 B(260 KiB) | 27,446 B(10.3%) |
| 실제 전송(brotli) | q5 215.9 KiB · q11 193.4 KiB | — | — |

- 구성: JS 722.3 KiB(그중 라이선스 주석 1.2) · 체험 91.2 · 수집기 원문 44.3(해시 고정) · CSS 32.0 · 마크업 3.9 · 메타 0.7.
- JS 안에서 보면 다음과 같다.
  - 화면·엔진 문장 값 약 109.0 KiB(E 75.9 · S 21.1 · C 12.0)
  - `cc.*` 키 문자열 52.6 KiB(서로 다른 키 1,442개, 등장 2,135회)
  - 한글 음절 바이트 88.6 KiB

### 6-2. 판단

- 결정 순서 ①(문구 순증 정지·중복 정리)로 확보할 수 있는 양은 작다. 같은 문장이 반복되는 묶음이 65개, 2.4 KiB이고, 미사용 CSS 6클래스는 1 KiB도 안 된다. **합쳐 3 KiB 정도**다.
- 결정문 §7은 다음 버그 회차를 +5~15 KiB로 예상했다(D-1b 수준). 그래서 ①만으로는 다음 회차를 흡수하지 못한다. 결정 ②(조건부 원본 실패선 960)를 **미리 측정해 두는 것이 현실적인 관리**다.
- ③(체험 데이터 압축)은 원본 숫자만 줄이고 전송량 이득은 0이다. 순서를 그대로 둔다.
- 키 축약(52.6 KiB)은 하지 않는다. `keyOf()`·`cc.status.${…}`처럼 실행 중에 조립하는 키가 많아서, 빌드 때 이름을 바꾸면 '없는 키'가 조용히 생긴다.

### 6-3. 운영 규칙(이번 릴리스부터)

1. **바이트 원장**: 번들 입력(`_client/**`, lib의 model·contract·parse·engine·rules(문구 포함))을 바꾸는 변경은 `generate.mjs --preview <레포 밖>` 요약 줄의 html·gzip 전후 값을 변경 설명에 붙인다.
2. **소프트 상한 897 KiB(918,528 B)**: 그 위 3 KiB는 핫픽스(판정 오류 수정) 전용이다. 새 문구·룰을 넣는 변경은 같은 변경 안에서 상쇄하거나 ②에 착수한다.
3. **재생성 때마다 기록**: STEP 7·핫픽스 배포 기록에 html·gzip 값을 남긴다. 900을 넘으면 push 금지(`generated.test`가 막음).
4. **② 준비(프론트팀장, v0.1.1 착수 즉시)**: 결정문 §7②의 조건(4× CPU·Fast 3G CDP 모바일 에뮬레이션, file://·로컬 서버, LCP ≤ 2.5초·CLS ≤ 0.1·JS ≤ 760 KiB·gzip ≤ 260)을 재는 스크립트를 지금 바이트로 한 번 돌려 기준선을 만든다. 900을 넘는 순간 기획팀장 1회 확인으로 끝나게 하기 위해서다.
5. **구조적 절감(v1.1, 승인 필요)**: Preact 약 −120 KiB(`package.json` 변경 → PM), 클라이언트 경로의 zod 제거 약 −58 KiB(API설계자 파서 재작성). 일본어는 **언어별 HTML**로 낸다(한 번들에 두 언어를 넣으면 문장 값 약 109 KiB가 거의 두 배가 된다).

---

## 7. 다음 릴리스 프론트 개선점(우선순위)

| 순위 | 항목 | 이유 · 기대 효과 | 시점 |
|---|---|---|---|
| **P0-1** | G5-TW1 해소: 생성물을 Tailwind 스캔 밖으로 옮김(또는 base64 저장) + C 키 `cc.c.banner.collapse` 이름 변경 + 'cloudcheck 파일 → Tailwind 유틸리티 0' 회귀 시험 | G5 문자 기준 회복, 공유 CSS 영향 0 고정(F-1) | v0.1.1 |
| P0-2 | 라이브 성능 측정(LV-08·PF-03): 모바일 LCP·CLS·JS 실행 시간, LCP 요소가 정적 셸인지 | 성능 예산(LCP 2.5초·CLS 0.1) 확인 + 결정 ② 기준선(§6-3 #4) | 배포 직후 |
| P0-3 | PM 수동 결과 반영: Safari Blob이 끊기면 `DownloadLink`의 `revokeObjectURL`을 수십 초 뒤로(CR-13). 비차단 `print()` 브라우저에서 '이 목록만'·'이름·ID 표시'가 무시되면 `print.ts`를 `afterprint`·`matchMedia('print')` 기반 정리로 바꿈(지금은 `finally`에서 바로 떼어 마스킹·전체로 안전하게 실패) | C2 결과에 따름 | C2 직후 |
| P0-4 | 시험 리터럴 위생: provider 패턴(Azure 키·SAS·STS 쌍)을 실행 중 조립으로 바꾸고, 새 시험에 그런 리터럴이 들어오면 실패하는 가드를 더함 | 공개 저장소 푸시 보호·외부 스캐너 경보 재발 방지(F-2) | v0.1.1(이번에 A를 고르면 그때 함께) |
| P1-1 | PF-01: 25 MB 입력의 메인 스레드 시간 측정. 2초를 넘으면 V2의 `buildInput()` 결과를 `build()`에서 재사용(지금 두 번 호출) | 큰 계정 사용자 체감 | G8 전 |
| P1-2 | 예산 원장 자동화: `generated.test` 출력에 소프트 상한(897 KiB) 경고 줄 | §6-3을 사람 기억에서 시험으로 | v0.1.1 |
| P1-3 | 정리: 미사용 CSS 6클래스 삭제, 같은 문장 65묶음 정리(디자인팀장·DB설계자 합의) | 약 3 KiB | v0.1.1 |
| P1-4 | 문서: 프론트 최종 §0 수치 각주, 방향서 §5-2에 `as-of-before-evidence` 반영 | 혼동 방지·G0 원문 동기 | 다음 개정 |
| P1-5 | Azure 공개(C 묶음 뒤): `CLOUD_AVAILABILITY.azure`만 바꾸면 V0·V1·V2 분기가 함께 열린다. 해제 체크리스트(V2 차단 시험 7개 기대값 반전 · Azure 실제 V3 실브라우저 · 띠 문구)를 미리 만든다 | 해제 실수 방지 | Azure 공개 전 |
| P2-1 | 정적 응답 전환 검토: 지금은 `force-dynamic` → 함수 호출(sin1)·콜드 스타트. 프리뷰에서 정적 헤더가 유지되는지 `curl -sI`로 확인 → PM 승인 | TTFB 단축 | v1.1 |
| P2-2 | Preact(PM 승인) · zod 경로 제거(API설계자) · 언어별 HTML(일본어) · 별도 origin(Q2 ②, G9 전) | 번들 −약 180 KiB, 일본어 수용, origin 분리로 Tailwind·공유 origin 걱정 제거 | v1.1 / G9 |

---

## 8. 근거

- 레포 대조(읽기): `src/app/cloudcheck/{route.ts,download/route.ts,_serve/headers.ts,_build/generate.mjs,_build/template.mjs,_build/generated.test.ts,_build/guards.test.ts}`, `_client/{main.tsx,config.ts,i18n/index.ts,state/*.ts(x),screens/{App,Input,Report}.tsx,components/{CliBlock,MaskedValue,ScopePanel,ExceptionForm}.tsx}`, `src/lib/cloudcheck/{model/report.ts,parse/recognize.ts,collector/{.gitattributes,SHA256SUMS}}`, `tailwind.config.ts`, `vercel.json`, `package.json`, `.nvmrc`, `.next/BUILD_ID`.
- 이번 실행(레포 밖 `…/scratchpad/fe-review/`):
  - `secret-scan.mjs`: 425파일 provider 패턴 스캔
  - `tw-delta.cjs`·`tw-delta2.cjs`·`tw-delta3.cjs`: Tailwind 3.4.19를 메모리에서 실행, HEAD 기준선 358파일 대 +cloudcheck 142파일, 원인 파일 분리
  - `dir-5-2.md`·`g0-report.ts`·`model.diff`: G0 모델 대조
  - 생성물 HTML 해석(Node 인라인)
- 외부 1차 자료:
  - [GitHub — Supported secret scanning patterns](https://docs.github.com/en/code-security/secret-scanning/introduction/supported-secret-scanning-patterns): Azure Storage Account Key · AWS 키 쌍 · AWS 세션 키 · Azure SAS · GitHub PAT 모두 푸시 보호 대상
  - [GitHub — Push protection(개념)](https://docs.github.com/en/code-security/concepts/secret-security/push-protection): 사용자 푸시 보호 기본 켜짐, 공개 저장소 push 차단, 이유를 대고 우회
  - [Help Net Security — GitHub push protection now on by default for public repositories (2024-03-04)](https://www.helpnetsecurity.com/2024/03/04/github-push-protection/)
