<!-- STEP 2 팀장회의 검토 원문 (2026-10-19). 종합 결정은 docs/planning/project-direction-cloudcheck.md 가 우선한다. -->

# @프론트팀장 검토: 「문단속 5」(cloudcheck) STEP 2 팀장회의

## 0. 결론

1. **S1 로컬 스파이크는 통과했고, 서빙 방식 ①이 성립합니다.**
   - `src/app/cloudcheck/route.ts`가 자체 완결 HTML과 전용 헤더 13종을 반환합니다.
   - 응답 본문에 루트 layout 흔적은 0건입니다(jsdelivr·googleapis·adsbygoogle·`_next/static`).
   - 정적 모드와 `force-dynamic` 모드 모두 헤더가 유지되고, 본문은 두 모드에서 바이트 단위로 같습니다 [확인].
   - 다른 앱 때문에 빌드가 실패한 일은 없었습니다.
2. **T3 권고는 ① + `export const dynamic = "force-dynamic"`(베타)입니다.** 스텁도 이 상태로 두었습니다.
   - 정적 모드도 로컬에서는 문제가 없습니다. 헤더가 `.meta`와 prerender-manifest의 `initialHeaders`에 저장되고, 이 프로젝트의 라이브 `/robots.txt`도 `.meta` 헤더 그대로 PRERENDER로 나갑니다 [확인].
   - 다만 CSP·COOP 같은 보안 헤더가 Vercel 정적 응답에 실제로 실리는지는 배포 전에는 확인할 수 없습니다 [미확인].
   - `force-dynamic`은 함수가 헤더를 직접 내보내므로 확실합니다. 비용은 요청당 함수 실행 1회이고, 베타 규모에서는 무시할 수준입니다.
3. **T4 권고입니다.** `package.json`은 수정하지 않습니다.
   - UI 런타임: 설치된 React 18.3.1을 그대로 씁니다. 실측 비용은 gzip 45 KiB입니다.
   - 번들 생성: vite에 딸려 들어온 간접 의존성 esbuild 0.21.5로 만들고, 생성물을 커밋합니다.
   - CSS: 손으로 작성합니다. 레포 9개 앱이 이미 이렇게 합니다.
   - 해시 계산, 생성물 동기 검사, 크기 예산은 모두 vitest로 자동화합니다.
4. **T5**: 디렉터리 확정안은 §4에 있습니다. `_` private 폴더가 라우트로 잡히지 않는 것, 약 469 KB 생성 문자열이 변형 없이 서빙되는 것, 두 라우트가 같은 바이트를 내는 것을 격리 프로브로 확인했습니다 [확인].
5. **T2**: 판정 결과 모델 v1 초안을 TypeScript로 작성했고 tsc strict를 통과했습니다. 판별 유니온으로 두 규칙을 컴파일 단계에서 강제합니다.
   - "이상 없음"이면 범위 꼬리표가 반드시 있어야 합니다.
   - "확인 불가"에는 공통 사유 코드만 쓸 수 있습니다.
6. **새로 찾은 함정 2개**
   - esbuild는 `</script`는 이스케이프하지만, 문자열 안의 **`<!--`는 그대로 둡니다** [확인]. React 번들에는 `"<script>…"` 문자열이 1건 있습니다. 둘이 겹치면 HTML 파서가 인라인 스크립트를 잘못 끊을 수 있습니다. 생성기 후처리로 해결하고 검증까지 마쳤습니다.
   - 브라우저의 **향상된 맞춤법 검사, 자동 번역, 확장 프로그램**은 CSP와 상관없이 입력 내용을 외부로 보낼 수 있습니다. "올린 파일은 이 페이지 밖으로 나가지 않습니다"라는 문구의 정직성이 걸린 문제라서, 대응책과 문구 보완이 필요합니다.
7. **기획서 정정 2건**
   - §18의 Vercel 커뮤니티 링크(t/562)는 정적 헤더가 사라지는 사례가 아닙니다. 프리뷰의 **Deployment Protection("Authentication Required")이 요청을 가로챈 사례**입니다 [확인: 원문]. §14-1 '프리뷰 검증이 가려질 수 있음'의 근거로 옮겨야 합니다.
   - §8-2 헤더 기준값을 §2의 최종 문자열로 확정합니다.

---

## 1. S1 스파이크 실행 기록

### 1-1. 스텁 (만든 파일은 이것 하나)
- 경로: `/Users/pyoungminho/Desktop/무제 폴더/team_makes/src/app/cloudcheck/route.ts` (147줄)
  - 첫 줄은 `// S1 SPIKE STUB — STEP 4에서 교체`입니다.
  - 최종 상태는 `force-dynamic`입니다.
- HTML 구성
  - meta CSP, `referrer=no-referrer`, `x-dns-prefetch-control=off`
  - `<link rel="icon" href="data:,">`
  - 인라인 `<style>` 1개, `<script>` 1개
  - 실행되지 않는 데이터 블록 2개: `application/json` 1개, `text/plain` 가짜 수집기 1개
- CSP 해시는 `node:crypto`의 sha256으로 계산합니다. 확인용으로 `X-Spike-Html-Sha256` 헤더를 붙였습니다.
- 진단 버튼은 모두 클릭할 때만 동작합니다. 그래서 로드 시 추가 요청 0은 그대로 유지됩니다.
  - ① DOM 텍스트 변경
  - ② `fetch('/api/health')`가 차단되는지
  - ③ Blob 다운로드 (화면에 원문 sha256 표시)
  - ④ `window.print()`
  - ⑤ Trusted Types (innerHTML 대입 시도)
  - ⑥ style 속성 vs CSSOM
  - ⑦ `navigator.clipboard.writeText`
- 로드하자마자 화면에 표시되는 값: 스크립트 실행 여부, 데이터 블록 읽기 결과, `performance` 기준 요청 수, CSP 위반 이벤트 수.
- 주의: ⑤와 ⑦은 탐침이라 innerHTML과 clipboard를 일부러 씁니다. STEP 4 가드 테스트에 걸리므로 스텁은 반드시 교체해야 합니다.

### 1-2. 실행 명령과 실제 출력
| 단계 | 명령 | 결과 |
|---|---|---|
| 정적 빌드 | `npx next build` | EXIT 0, 23.7초. `○ /cloudcheck 0 B / 0 B` (Static, First Load JS 0) |
| 정적 산출물 | `.next/server/app/cloudcheck.body` (7,213 B), `cloudcheck.meta` | `.meta`에 헤더 13종이 모두 들어 있고, Next가 `x-next-cache-tags`를 추가함. `prerender-manifest.json` routes["/cloudcheck"].`initialHeaders`에도 같은 13종이 있음. `.body` sha256 `55a2d4dc…fe52e`가 헤더 값과 같음 |
| 정적 서빙 | `./node_modules/.bin/next start -p 3417`, `curl -sI`, `curl -s -D -` | 200. 헤더 13종이 그대로 나감. Next가 추가한 것은 `vary: RSC, Next-Router-State-Tree, Next-Router-Prefetch`와 `x-nextjs-cache: HIT`. `x-next-cache-tags`는 외부로 나가지 않음. 직접 지정한 Cache-Control도 유지됨 |
| 흔적 검사 | 본문 grep | jsdelivr, googleapis, gstatic, adsbygoogle, pagead, `_next/static`, `__next`, `next_f`, `rel="stylesheet"`, `src=` 모두 0건. `<script`는 3개(실행 1 + 데이터 2), href는 `data:,` 1개뿐 |
| 대조군 | 같은 grep을 `/privacy`에 | jsdelivr 2 · googleapis 4 · `_next/static` 13건이 나오고 우리 헤더는 없음. 검사 방법이 제대로 작동한다는 뜻 |
| 기타 | | `/cloudcheck/`는 308로 `/cloudcheck`에 리다이렉트. HEAD는 자동 처리됨 |
| 동적 빌드 | `force-dynamic` 추가 후 재빌드 | EXIT 0. `ƒ /cloudcheck`. `.body`/`.meta` 없고 prerender-manifest에도 없음 |
| 동적 서빙 | 같은 curl | 정적 대비 헤더 차이는 `x-nextjs-cache: HIT` 1줄뿐. 본문 `cmp` 결과 IDENTICAL. OPTIONS는 204(`allow: GET, HEAD, OPTIONS`), POST는 405. Cache-Control 덮어쓰기 없음 |
| 정리 | `kill`, `lsof` | 서버 종료, 3417 포트 비어 있음, 남은 프로세스 없음 |
| 공유 파일 확인 | sha256 비교, git status | 공유 파일 9종의 sha256 그대로(tsconfig, package.json, lock, vercel.json, tailwind, vitest, layout, providers, globals.css). git status에 새로 생긴 것은 `?? src/app/cloudcheck/`뿐 |

- 제 빌드로 `.next/`를 덮어썼습니다. gitignore 대상입니다.
- 빌드 로그 경고 2건은 cloudcheck와 무관합니다: `MOIRA_TOKEN_SECRET is not set`(로컬 환경변수), 기존 og 라우트의 edge 런타임 경고.

### 1-3. Vercel에서 헤더가 유지될지
- **정적 모드**
  - Vercel 빌더가 읽는 `initialHeaders`에 헤더가 들어갑니다 [확인].
  - 라이브 간접 증거: `/robots.txt`·`/sitemap.xml`에 읽기 전용 HEAD 요청을 보냈습니다. 둘 다 `x-vercel-cache: PRERENDER`였고, `content-type: text/plain`이 charset 없이 `.meta` 값 그대로 나왔습니다 [확인]. 즉 이 프로젝트의 Vercel은 정적 Route Handler의 `.meta` 헤더를 적용합니다.
  - 그래도 CSP 같은 보안 헤더 자체는 [미확인]입니다.
- **force-dynamic**: 함수가 헤더를 직접 만듭니다. 기존 `/api/*`와 같은 경로입니다.
- **이중 방어**: 헤더가 빠지더라도 HTML 안의 meta CSP가 script·style·connect 제한을 유지합니다. 빠지는 것은 frame-ancestors, COOP, CORP, nosniff, Permissions-Policy, X-Robots-Tag입니다.
- **정적 전환은 선택 사항입니다.** Q10이 승인되면 프리뷰에서 정적 변형을 `curl -sI`로 확인한 뒤 결정합니다.

### 1-4. 기획서 §14-1 S1 항목 현황
| 항목 | 상태 |
|---|---|
| 헤더 유지 (정적 vs 동적) | 로컬은 둘 다 [확인]. Vercel은 동적 확실, 정적 [미확인, 간접 증거 있음] |
| 루트 layout 미적용 | [확인] |
| 문서 1건, 파비콘 인라인 | 마크업 기준 외부 참조 0, `data:,` [확인]. 실제 요청 수는 브라우저에서 봐야 함 |
| 인라인 실행, Blob 다운로드, 인쇄 | [미확인]. 메인 세션이 버튼 ①③④로 확인 |
| 파일로 열었을 때 meta CSP | [미확인]. 메인 세션 확인 |
| COOP, frame-ancestors | [미확인]. 메인 세션 확인 |
| private 폴더 비라우팅, 대용량 문자열 | [확인: 격리 프로브, §4-2] |

### 1-5. 메인 세션 브라우저 확인 가이드
- **실행**: `npx next build && ./node_modules/.bin/next start -p 3417` (약 25초). 확인 후 서버를 꼭 종료해 주세요.
- **로드 직후 기대값**
  - 화면: "실행됨", "문서 1건 · 하위 리소스 0건", "CSP 위반 0"
  - Network 탭: 1건
  - Console: 0건. Permissions-Policy "Unrecognized feature" 경고가 보이면 그 항목은 빼면 됩니다.
- **버튼 기대값**
  - ② "차단됨: TypeError"
  - ③ 받은 파일의 `shasum -a 256`이 화면의 '원문 sha256'과 같아야 함
  - ⑤ Chromium에서 "차단됨: TypeError"
  - ⑥ "속성 차단됨 · CSSOM 적용됨"
  - ⑦ "NotAllowedError"
- **frame-ancestors**: `/privacy` 콘솔에서 `document.body.append(Object.assign(document.createElement('iframe'),{src:'/cloudcheck'}))` → 거부되어야 함.
- **COOP**: `/privacy` 콘솔에서 `w=window.open('/cloudcheck')` → 로드 뒤 `w.closed === true`여야 함.
- **오프라인**: `curl -s localhost:3417/cloudcheck -o /tmp/cc.html` 후 file://로 엽니다. 버튼 ①은 동작하고 ②는 meta CSP로 차단되어야 합니다.
- **React 18 + 해시 CSP + Trusted Types**: `/private/tmp/claude-501/-Users-pyoungminho-Desktop-------team-makes/a8432358-e439-4607-8633-d54f9c3d981b/scratchpad/t4/react-csp-probe.html`을 file://로 엽니다. "렌더됨…"이 표시되고 콘솔 위반이 0이면 React 18이 Trusted Types 아래에서 동작한다는 뜻입니다. jsdom에서는 확인했고, 실제 브라우저에서는 [미확인]입니다.

---

## 2. T3: 서빙 방식 결정안과 헤더 최종 문자열

- 방식: ① Route Handler, nodejs 런타임, `dynamic = "force-dynamic"`.
- `/cloudcheck/download`는 같은 상수를 반환하고 `Content-Disposition: attachment; filename="cloudcheck-<버전>.html"`만 추가합니다. 바이트가 같다는 것은 프로브로 확인했습니다.

```
Content-Type: text/html; charset=utf-8
Content-Security-Policy: default-src 'none'; script-src 'sha256-<JS>'; style-src 'sha256-<CSS>'; img-src data:; connect-src 'none'; media-src 'none'; object-src 'none'; frame-src 'none'; child-src 'none'; worker-src 'none'; manifest-src 'none'; form-action 'none'; base-uri 'none'; require-trusted-types-for 'script'; trusted-types 'none'; frame-ancestors 'none'
Cross-Origin-Opener-Policy: same-origin
Cross-Origin-Resource-Policy: same-origin
Referrer-Policy: no-referrer
X-Content-Type-Options: nosniff
X-Frame-Options: DENY
Permissions-Policy: camera=(), microphone=(), geolocation=(), payment=(), usb=(), clipboard-read=(), clipboard-write=(), display-capture=(), browsing-topics=()
X-DNS-Prefetch-Control: off
X-Robots-Tag: noindex                      ← 베타 기간에만. HTML 바이트와 무관하게 헤더로만 단다
Cache-Control: public, max-age=0, must-revalidate
```
- **meta CSP**는 위 CSP에서 `frame-ancestors`만 뺀 것입니다(meta에서는 무시됨). `<meta charset>` 바로 다음, 다른 모든 요소보다 앞에 둡니다. `<meta name="referrer" content="no-referrer">`와 `x-dns-prefetch-control` meta도 함께 넣습니다.
- **기획서 §8-2 대비 변경점** (스텁은 기획서 기준값 그대로이고, STEP 4에서 조입니다)
  - img-src에서 `blob:`을 빼고, `font-src data:`도 뺍니다(쓸 곳이 없음).
  - 추가: `require-trusted-types-for`/`trusted-types 'none'`, `X-Frame-Options`, `X-DNS-Prefetch-Control`.
  - Permissions-Policy를 넓혔습니다. 특히 `clipboard-write=()`는 Chromium에서 R-11(원클릭 복사 금지)을 플랫폼 수준에서 강제합니다.
  - Trusted Types 지시어는 조건부 채택입니다. STEP 5 QA에서 Chrome 전 화면이 오류 없이 돌아야 하고, 문제가 생기면 이 2개 지시어만 빼면 됩니다.
- **선택 최적화** [미확인]
  - G5에서 TTFB가 길면 엣지 캐시(`s-maxage` 또는 `CDN-Cache-Control`)를 검토합니다.
  - 해시를 생성물에 미리 넣으면 route는 상수 반환뿐이라 `runtime='edge'`도 가능합니다. 로컬에서는 검증하지 않았습니다.

---

## 3. T4: 기술 스택 결정안

### 3-0. 아키텍처 요약
- **컴포넌트 전략**: 프레젠테이션(`components/`, props로 모델 조각을 받음)과 컨테이너(`screens/`, 세션 상태와 엔진 호출)를 나눕니다.
  - 아래 다섯 컴포넌트를 "관문 컴포넌트"로 지정하고, 관문 밖에서 같은 일을 하면 가드 테스트가 실패하게 합니다.

  | 관문 컴포넌트 | 역할 |
  |---|---|
  | `MaskedValue` | DisplayValue를 그리는 유일한 통로 |
  | `DocLink` | 외부 링크의 유일한 통로. 허용 도메인만, `rel="noopener noreferrer"` |
  | `StatusBadge` | 상태를 색 + 아이콘 + 글자로 표시 |
  | `CliBlock` | 자리표시자를 보여 주고, 복사 버튼은 두지 않음 |
  | `PasteBox` | 맞춤법·자동완성 계열 기능을 끔 |

- **상태 관리**: 서버 상태는 없습니다. `useReducer` + context로 메모리에만 둡니다.
  - History API는 쓰지 않고, 화면 전환은 상태로 처리합니다.
  - 리포트가 있을 때만 `beforeunload` 확인을 띄웁니다.
  - zustand, react-query는 쓰지 않습니다. 번들 크기와 persist 기능의 위험 때문입니다.
- **API 연동**: 네트워크 요청은 0입니다. 흐름은 파일·붙여넣기 → `parse`(lib) → `judge`(lib, 순수 함수) → Report → UI입니다.
  - 실패해도 예외를 던지지 않고, "전부 확인 불가 + 배너"인 Report를 돌려줍니다(INV-2).
  - UI 에러 경계는 부분 결과를 그리지 않습니다.
- **점진적 향상**: 정적 머리와 `<noscript>`만으로도 소개, 약속, 직접 확인하기, CSV 수집 안내를 읽을 수 있게 합니다. 판정 자체는 브라우저 JS가 본질이라 예외입니다.

### 3-1. UI 런타임
| 기준 | **React 18.3.1 (설치본)** | Preact 10 | 바닐라 TS |
|---|---|---|---|
| 런타임 번들 | 139.4 KiB, gzip 45.1, br 39.4 [확인: esbuild 실측] | 약 10 KiB 안팎 [일반 지식] | 0 |
| `package.json` | 무수정 | `preact`, `@testing-library/preact` 추가 필요(공유 파일 수정, PM 승인) | 무수정 |
| 테스트 | jsdom + RTL 그대로 [확인] | 별도 패키지가 필요하거나 vitest alias를 바꿔야 함(공유 설정) | `@testing-library/dom` 10.4.1로 가능하지만 불편 |
| CSP 해시 | 실행 스크립트 1개, 해시 1개 | 같음 | 같음 |
| R-12 | JSX 자동 이스케이프. 위험 경로는 `dangerouslySetInnerHTML`뿐이라 AST로 막을 수 있음 | 비슷함 | DOM을 전부 손으로 다뤄 실수 여지가 큼 |
| Trusted Types | `dangerouslySetInnerHTML`과 `<script>` 렌더만 피하면 호환 [일반 지식]. jsdom 렌더 확인 | 비슷함 | 호환 |
| 판정 | **채택** | 보류 (v1.1 크기 최적화 후보) | 기각 (화면 규모가 큼) |

### 3-2. 번들 생성 방식 (S4)
| 안 | 내용 | 판정 |
|---|---|---|
| A | 간접 의존 esbuild 0.21.5(vite 5.4.21 경유 [확인: npm ls]) + 생성물 커밋 | **채택 (조건부)**. `package.json`과 Vercel 빌드는 그대로이고, Vercel에 esbuild가 필요 없음. 출력이 결정적임 [확인: 2회 빌드 같은 해시, 절대경로 누출 0] |
| B | esbuild를 devDependency로 정확한 버전에 고정 (0.25.x) | A의 조건이 깨지면 승격. 공유 파일 수정이므로 PM 승인 필요 |
| C | Vercel 빌드 때 생성 (prebuild) | 기각. scripts와 빌드 명령을 바꿔야 하고, 실패하면 모든 앱 배포가 멈춤 |

A안의 가드레일입니다.
1. 생성기는 `createRequire(<repo>/package.json)`로 esbuild를 찾습니다. 찾지 못하면 바로 실패합니다.
2. 버전 고정은 lockfile이 맡습니다. 생성물에 `esbuildVersion`을 기록하고, 현재 버전과 다르면 테스트가 실패해 재생성을 강제합니다. 재생성하면 해시가 바뀌므로 새 릴리스가 됩니다.
3. build API만 씁니다. 0.21.5는 [GHSA-67mh-4wv8-2f99](https://osv.dev/vulnerability/GHSA-67mh-4wv8-2f99) 해당 버전이지만(≤0.24.2, 0.25.0에서 수정), 이 권고는 `serve` 개발 서버의 CORS 문제라 build API 사용에는 해당하지 않습니다. 가드 테스트로 생성기에서 serve 사용을 금지합니다.
4. 승격 트리거: vite 업데이트로 esbuild 버전이나 위치(hoisting)가 바뀌거나, 감사 도구가 막는 경우.

### 3-3. CSS
- **손으로 작성합니다.**
  - 파일 구성: `tokens.css`(디자인 토큰을 CSS 변수로), `base.css`, `print.css`, 컴포넌트·화면별 `.css`. 각 TSX에서 import하면 esbuild가 하나로 묶고 압축합니다.
  - 근거: 9개 앱이 앱별 CSS + CSS 변수를 씁니다(witness 변수 141개, gung 97, flight 71) [확인]. 도구도 esbuild 하나로 끝납니다.
- **Tailwind 대안**: Tailwind CLI + 전용 config도 가능합니다.
  - 루트 Tailwind는 `src/app/**`를 스캔합니다. 그래도 React 번들 `.ts`를 넣었을 때 루트 CSS 규칙은 762개 그대로였습니다(+0) [확인]. 따라서 Tailwind 오염은 결정 요인이 아닙니다.
- **규칙**
  - HTML 마크업에 `style=""` 금지. React `style` prop은 CSSOM 경로라 허용됩니다(스텁 ⑥으로 확인 예정).
  - CSS-in-JS 런타임 금지.
  - `@import`, 외부 `url()` 금지.
  - 시스템 폰트만 사용.
  - 클래스 이름은 `cc-` 접두.

### 3-4. 생성 파이프라인 (`_build/generate.mjs`)
1. **esbuild 실행**
   - 진입점: `_client/main.tsx`
   - 출력: iife 형식, 압축, `jsx:'automatic'`, `NODE_ENV=production`
   - `legalComments:'eof'`: React MIT 고지를 보존합니다(4줄 [확인]).
   - `absWorkingDir`는 레포 루트로 둡니다.
   - 결과로 JS와 CSS가 나옵니다.
2. **후처리** [확인: 2곳 치환, `vm.Script` 컴파일 성공, parse5에서 스크립트가 정확히 닫힘, 적대 문자열 원문 그대로 렌더, `<img>` 주입 0]
   ```js
   const js = raw.replace(/<(?=!--|script)/gi, "\\x3C"); // 문자열·정규식·템플릿 안에만 나타남 → 실행 시 값은 같음
   // 이후 검사: /<!--|<script|<\/script|\r/i 0건 + new vm.Script(js) 컴파일 통과
   ```
   CR 문자도 막습니다. HTML 파서가 CRLF를 LF로 바꾸기 때문에, CR이 남아 있으면 해시가 어긋납니다. CSS에도 `</style`와 CR이 없어야 합니다.
3. **해시 계산**: sha256(base64)을 구하고, 헤더와 meta가 같이 쓰는 함수(`_serve/headers.ts`)로 CSP 문자열을 만듭니다.
4. **템플릿 조립**: `<meta charset>` → meta CSP → 나머지 meta → `<link rel=icon data:>` → `<style>` → 정적 머리, `<noscript>`, `#app` → 데이터 블록 → `<script>` 순서입니다.
   - 수집기 원문은 JS 문자열이 아니라 **`text/plain` 데이터 블록**으로 넣습니다.
   - 이점: 페이지 소스 보기에서 원문 그대로 읽히고, Blob 다운로드 바이트가 파일 바이트와 같으며, 실행되지 않으므로 CSP 해시 대상이 아닙니다.
   - JSON 블록은 `<`를 `<`로 바꿔 넣습니다.
5. **기록**: `_generated/page.ts`에 아래 필드를 씁니다. 시각과 절대경로는 넣지 않습니다.
   - `{version, esbuildVersion, html, sha256, scriptHash, styleHash, bytes, collectors}`
6. **실행 모드**
   - 기본: 쓰기
   - `--check`: 불일치 시 exit 1
   - `--preview <레포 밖 경로> [--watch]`: 개발 중 미리보기를 file://로 열면 실제 CSP가 그대로 적용됩니다. `_generated`에 쓰기 경합이 생기지 않습니다.

### 3-5. 동기·무결성 테스트
두 파일 모두 vitest가 자동으로 수집하는 위치에 둡니다. 따라서 배포 게이트의 `npm run test`에서 push 전에 걸립니다.

**`_build/generated.test.ts`**
1. `generate()`의 메모리 결과가 커밋된 생성물과 같은지 (동기 검사)
2. 해시 4중 일치
   - 문서 해시: sha256(html) = 저장된 sha256
   - 스크립트·스타일 해시: 다시 계산한 값 = 저장된 값 = meta CSP 안의 값 = 헤더 CSP 안의 값
3. 스크립트에 `<!--`, `<script`, `</script`, CR이 0건인지
4. 마크업(스크립트 제외)에 아래가 없는지
   - `http`, ` style=`, ` on*=` 속성, `src=`
   - `<link>`는 icon 1건만 허용
5. JS 안 URL의 호스트가 허용 목록 안인지
   - 허용: `www.w3.org`, `reactjs.org`, 고치는 법 문서 도메인
   - React 번들에 든 URL은 이 6개뿐임을 확인했습니다 [확인].
6. 번들 금지 토큰 0건 (React 번들에 없는 것만 골랐습니다 [확인])
   - `localStorage`, `sessionStorage`, `indexedDB`, `sendBeacon`, `XMLHttpRequest`, `WebSocket`, `EventSource`
   - `serviceWorker`, `document.cookie`, `fetch(`, `import(`, `new Worker`
   - `pushState`, `replaceState`, `execCommand`, `navigator.clipboard`, `eval(`, `new Function`
7. 크기 예산 (§3-6)
8. `/Users/` 문자열 0건
9. 수집기 블록 텍스트 = 파일 바이트 = SHA256SUMS

**`_serve/serve.test.ts`**
- 두 라우트의 `GET()`을 직접 호출해 헤더 맵 스냅샷과 본문 일치를 봅니다. 서버 없이 CI에서 헤더를 미리 검사하는 셈입니다.

### 3-6. 크기 예산
| 대상 | 목표 | 실패 기준 |
|---|---|---|
| HTML 전체 (원본) | 400 KiB 이하 | 500 KiB 초과 |
| HTML 전체 (gzip) | 120 KiB 이하 | 150 KiB 초과 |
| JS | 330 KiB 이하 (React 약 140 + 나머지 190 이하) | — |
| CSS | 30 KiB 이하 | — |
| 수집기 원문 합계 | 24 KiB 이하 | — |

- **LCP**: gzip 120 KiB를 1.6 Mbps로 받으면 약 0.6초입니다. 여기에 TTFB와 파싱·실행 시간이 더해져도 2.5초 안에 들어올 것으로 봅니다 [추정, G5에서 실측].
- **CLS**: 정적 머리를 HTML에 두고 `#app`을 그 아래에 렌더해 0.1 이하를 노립니다.

---

## 4. T5: 디렉터리 확정안

### 4-1. 구조와 담당
```
src/app/cloudcheck/
├─ route.ts               GET → PAGE.html + 헤더                          [프론트팀장]
├─ download/route.ts      같은 바이트 + attachment                        [프론트팀장]
├─ _serve/                headers.ts(CSP·헤더 조립 순수 함수), serve.test.ts [프론트팀장]
├─ _build/                generate.mjs, template.mjs, generated.test.ts, guards.test.ts [프론트팀장]
├─ _generated/page.ts     GENERATED — 손수정 금지                          [통합 때 프론트팀장만 재생성]
└─ _client/               esbuild 진입점. Next는 import하지 않음(서버·클라이언트 번들 밖)
   ├─ main.tsx, state/, screens/ (+*.test.tsx)                            [페이지개발자]
   ├─ components/ (+각 .css, *.test.tsx)                                  [컴포넌트개발자]
   ├─ styles/ tokens.css · base.css · print.css                           [컴포넌트개발자]
   ├─ i18n/ko/ components.ts [컴포넌트] · screens.ts [페이지] · index.ts(키 타입)
   └─ mocks/ 목업 Report A~D (모델 타입 기준)                              [프론트팀장]
src/lib/cloudcheck/       React·DOM import 금지(가드로 강제)                 [백엔드팀]
├─ contract/   수집 계약 v1 zod (T1)                                       [API설계자]
├─ parse/      JSON·CSV 파서, 정규화, 비밀 패턴 탐지                        [API설계자]
├─ collectors/ cloudcheck-aws.sh · cloudcheck-azure.sh · SHA256SUMS · 린트 테스트 [API설계자]
├─ rules/      룰 18장 데이터 + 판정 함수 + text.ko.ts(룰 문구)             [DB설계자]
├─ engine/     집계·불변식·judge()                                         [DB설계자]
├─ fixtures/   가짜 회사 A~D × AWS·Azure, 정답지, 적대 픽스처                [DB설계자·QA]
└─ model/report.ts  판정 결과 모델 v1 (T2) — 양 팀장 공동 소유, G0에서 동결
```
- 이 프로젝트는 서버가 없으므로, CLAUDE.md의 기본값인 루트 `api/`는 쓰지 않고 `src/lib/cloudcheck/`로 대체합니다.

### 4-2. 검증한 사실
- **private 폴더**: scratchpad에 Next 14.2.3 격리 앱을 만들어 `_client/page.tsx`를 넣어 봤습니다. 라우트 목록에 나타나지 않았고 `/cloudcheck/_client`는 404였습니다 [확인].
- **대용량 생성물**: 468,885 B짜리 문자열을 `.ts` 모듈로 두었습니다.
  - `/cloudcheck`와 `/download` 본문의 sha256이 생성 시점 값(`871f7fe3…`)과 같았습니다 [확인].
  - 문자열은 두 라우트가 공유하는 서버 청크(472,814 B)에 한 번만 들어가고, route.js는 1.2~1.4 KB입니다.
- **번들 경계**: route가 import하는 것은 `_generated`와 `_serve`뿐입니다. 그래서 UI 코드가 Next 번들에 들어가지 않습니다(First Load JS 0 B).
- **도구 설정**
  - tsconfig `src/**`가 타입 검사를 맡고, vitest `src/**/*.test.*`가 테스트를 자동 수집합니다 [확인].
  - vitest 기본 환경이 node라서, RTL 테스트 파일 첫 줄에는 `// @vitest-environment jsdom`을 붙입니다 [확인: vitest.config 주석].

### 4-3. 병렬 작업 규칙
- 개발 중에 팀원은 `_generated`를 직접 쓰지 않고 `--preview`만 씁니다.
- i18n 카탈로그는 파일 단위로 담당을 나눕니다.
- 엔진이 아직 없어도 목업 Report로 UI 작업을 진행하고, D4에 실제 엔진 출력으로 바꿔 같은 렌더 테스트를 통과시킵니다.

---

## 5. T2: 판정 결과 모델 v1 초안 (tsc strict 통과)
전체 파일: `/private/tmp/claude-501/-Users-pyoungminho-Desktop-------team-makes/a8432358-e439-4607-8633-d54f9c3d981b/scratchpad/t2/report.ts`

```ts
// src/lib/cloudcheck/model/report.ts — 판정 결과 모델 v1 (엔진 → UI 계약)
// 원칙: ① 직렬화 가능한 순수 데이터, 같은 입력+옵션 → 같은 Report(INV-9)
//       ② 문구 없음: 코드+파라미터만 → 문구·금지어 검사는 UI 카탈로그에서
//       ③ 사용자 데이터 문자열은 전부 DisplayValue(마스킹·제어문자·비밀값 차단의 단일 통로)
//       ④ 상태별 필수 정보는 판별 유니온으로 컴파일 단계에서 강제
import type { NormalizedInput, ExceptionsFile } from "../contract"; // T1에서 정의

export const REPORT_MODEL = "cloudcheck.report/1" as const;
export type Cloud = "aws" | "azure";
export const DOORS = ["entrance", "keys", "windows", "storage", "cctv"] as const; // 화면 고정 순서
export type DoorId = (typeof DOORS)[number];
export type Status = "risk" | "caution" | "clear" | "unknown" | "na"; // 위험·주의·이상 없음·확인 불가·해당 없음
export const STATUS_ORDER = ["risk", "caution", "unknown", "clear", "na"] as const satisfies readonly Status[];
export type ReceiptResult = "ok" | "empty" | "notconfigured" | "denied" | "error" | "throttled" | "truncated" | "unsupported";
export type RuleId =
  | "AWS-MFA-1" | "AWS-MFA-2" | "AWS-KEY-1" | "AWS-KEY-2" | "AWS-KEY-3" | "AWS-KEY-4"
  | "AWS-NET-1" | "AWS-STO-1" | "AWS-STO-2" | "AWS-LOG-1"
  | "AZ-MFA-G" | "AZ-MFA-1" | "AZ-KEY-1" | "AZ-NET-1" | "AZ-STO-1" | "AZ-STO-2" | "AZ-LOG-1" | "AZ-LOG-2";
export type InputKind = "collector-json" | "pasted-json" | "csv-credential-report" | "csv-resource-graph" | "csv-entra-registration" | "demo";
declare const brand: unique symbol;
type Brand<T, B extends string> = T & { readonly [brand]: B };
export type IsoUtc = Brand<string, "IsoUtc">;
export type IsoDate = Brand<string, "IsoDate">;
export type MatchKey = Brand<string, "MatchKey">; // 예외 매칭·Before/After용. 화면에 그리지 않음(가드)

/* 사용자 데이터 단일 통로 (R-12·R-13) */
export type SensitiveType = "accountId" | "tenantId" | "subscriptionId" | "userName" | "upn" | "resourceName" | "arn" | "ipAddress" | "principal" | "fileName" | "freeText";
export type ValueFlag = "truncated" | "control-chars-replaced" | "bidi-replaced";
export type DisplayValue =
  | { readonly kind: "plain"; readonly text: string }                       // 비식별 상수(리전·포트 등)
  | { readonly kind: "sensitive"; readonly type: SensitiveType; readonly full: string; readonly masked: string; readonly flags: readonly ValueFlag[] } // 화면=full, 인쇄·내보내기=masked 기본. full은 엔진이 정리(제어·양방향 문자 치환, 256자)
  | { readonly kind: "redacted"; readonly why: "secret-pattern" | "invalid-encoding" }; // 원값 미적재

/* 사유 */
export type UnknownReason =
  | "denied" | "error" | "throttled" | "truncated" | "scope-incomplete" | "field-missing" | "value-unrecognized"
  | "schema-unsupported" | "not-collected" | "parse-failed" | "stale-evidence" | "csv-scope-unproven" | "guide-only";
export type RuleReason = `${RuleId}:${string}`; // STEP 4: 룰 카탈로그의 닫힌 튜플로 교체
export type ReasonCode = UnknownReason | "no-targets-proven" | RuleReason;
export type ReasonParam = { readonly n: number } | { readonly t: IsoUtc } | { readonly c: string } | { readonly v: DisplayValue };
export interface ReasonRef { readonly code: ReasonCode; readonly params?: Readonly<Record<string, ReasonParam>> }

/* 증거·리소스·라벨 */
export interface ReceiptRef { readonly id: string; readonly call: string; readonly scope: string; readonly result: ReceiptResult; readonly count: number | null; readonly errorCode: string | null; readonly at: IsoUtc }
export interface EvidenceRef {
  readonly receipt: ReceiptRef | null; // CSV 출처면 null
  readonly csv: { readonly source: "csv-credential-report" | "csv-resource-graph" | "csv-entra-registration"; readonly column: string; readonly row: number } | null;
  readonly observed: readonly { readonly field: string; readonly value: DisplayValue }[]; // allowlist 필드만
}
export type ResourceType = "root" | "iam-user" | "access-key" | "iam-role" | "security-group" | "eni" | "s3-account" | "s3-bucket" | "trail"
  | "entra-tenant" | "entra-user" | "storage-account" | "nsg" | "nic" | "blob-container" | "subscription";
export interface ResourceRef { readonly type: ResourceType; readonly name: DisplayValue; readonly location: { readonly kind: "global" | "region" | "subscription"; readonly value: DisplayValue } | null; readonly key: MatchKey }
export type Label = // 라벨은 상태를 바꾸지 않음(INV-8)
  | { readonly kind: "exception"; readonly reason: DisplayValue; readonly until: IsoDate; readonly createdAt: IsoDate }
  | { readonly kind: "intended-public-candidate"; readonly basis: "static-website" | "web-container" }
  | { readonly kind: "name-hint"; readonly hint: "public" | "static" | "assets" | "cdn" }
  | { readonly kind: "legacy-hint"; readonly basis: "created-before-2023-04" }
  | { readonly kind: "self-report-available" } // 응답 내용은 UI 세션 상태(메모리)
  | { readonly kind: "unusual-characters" };

/* 상태별 필수 정보 */
export interface ScopeTag { readonly asOf: IsoUtc; readonly scope: ReasonRef } // "(확인한 범위·기준 시각)"
export interface PermissionHint { readonly permission: string; readonly unlocks: readonly { readonly ruleId: RuleId; readonly items: number }[]; readonly total: number }
export type StatusDetail =
  | { readonly status: "risk" | "caution"; readonly why: ReasonRef }
  | { readonly status: "clear"; readonly why: ReasonRef; readonly scopeTag: ScopeTag }                     // 꼬리표 없으면 컴파일 오류
  | { readonly status: "unknown"; readonly why: ReasonRef & { readonly code: UnknownReason }; readonly unlock: PermissionHint | null } // 사유 + 해소법
  | { readonly status: "na"; readonly why: ReasonRef & { readonly code: "no-targets-proven" }; readonly basis: ReasonRef }; // 근거 1줄
export type ItemResult = { readonly id: string; readonly ruleId: RuleId; readonly resource: ResourceRef; readonly evidence: readonly EvidenceRef[]; readonly labels: readonly Label[] } & StatusDetail;

/* 고치는 법 (R-11: CLI는 룰 데이터에서만, 사용자 리소스 이름을 채우지 않음) */
export type AllowedDocHost = "docs.aws.amazon.com" | "aws.amazon.com" | "learn.microsoft.com";
export interface DocUrl { readonly href: `https://${string}`; readonly host: AllowedDocHost }
export interface FixStep { readonly textKey: string; readonly docUrl: DocUrl | null }
export interface CliTemplate { readonly shell: "aws" | "az"; readonly segments: readonly ({ readonly t: "text"; readonly v: string } | { readonly t: "placeholder"; readonly name: string })[] }
export interface FixGuide {
  readonly impact: "low" | "medium" | "high"; readonly prodImpact: boolean;
  readonly observe: FixStep; readonly change: FixStep & { readonly property: string; readonly cli: CliTemplate | null }; readonly revert: FixStep;
  readonly basis: readonly DocUrl[]; readonly lastVerified: IsoDate; readonly guidanceStale: boolean; // 180일 경과(배너용, 상태와 무관)
}
export interface GuideCard { readonly steps: readonly { readonly id: string; readonly textKey: string; readonly docUrl: DocUrl | null }[] } // AZ-MFA-G
export type GlobalCannotSee = "leaked-keys" | "issued-sas-oauth" | "other-accounts" | "abandoned-test-envs" | "app-vulnerabilities" | "idp-mfa" | "resource-policy-sharing";

/* 룰·문 */
export interface Distribution { readonly total: number; readonly risk: number; readonly caution: number; readonly clear: number; readonly unknown: number; readonly na: number }
export type RuleResult = {
  readonly ruleId: RuleId; readonly cloud: Cloud; readonly door: DoorId; readonly kind: "auto" | "guide" | "conditional";
  readonly maxStatus: Status; readonly allowsClear: boolean; readonly priority: number;
  readonly items: readonly ItemResult[]; readonly distribution: Distribution; readonly cannotSee: readonly string[];
  readonly fix: FixGuide | null; readonly guide: GuideCard | null;
  readonly sources: readonly { readonly call: string | null; readonly csvColumn: string | null }[]; readonly labels: readonly Label[];
} & StatusDetail;
export interface DoorResult { readonly door: DoorId; readonly status: Status; readonly collection: "collected" | "partial" | "not-collected"; readonly rules: readonly RuleResult[]; readonly distribution: Distribution }

/* 첫 화면(접을 수 없는 영역) */
export interface IdentityBlock {
  readonly cloud: Cloud; readonly account: DisplayValue; readonly accountLast4: string; readonly alias: DisplayValue | null;
  readonly subscriptions: readonly { readonly id: DisplayValue; readonly name: DisplayValue }[];
  readonly principalType: "root" | "iam-user" | "assumed-role" | "federated" | "entra-user" | "service-principal" | "managed-identity" | "unknown";
  readonly confirmedByUser: boolean | null; // C-05 Enter 통과 여부, CSV면 null
}
export interface ScopeBlock {
  readonly unit: "region" | "subscription" | "none"; readonly checked: number | null; readonly visible: number | null;
  readonly missing: readonly { readonly name: DisplayValue; readonly reason: UnknownReason; readonly receiptId: string | null }[];
  readonly proven: boolean; readonly outOfScope: readonly string[];
}
export interface CollectionBlock {
  readonly collectedAt: IsoUtc | null; readonly collectedAtSource: "collector" | "csv-column" | "file-time" | "unknown";
  readonly evaluatedAt: IsoUtc; // 배너 계산에만 사용
  readonly collector: { readonly name: string; readonly version: string; readonly supported: boolean } | null;
  readonly schema: { readonly id: string; readonly supported: boolean } | null;
  readonly credentialReportGeneratedAt: IsoUtc | null;
  readonly receipts: Readonly<Record<ReceiptResult, number>> & { readonly total: number };
  readonly doors: Readonly<Record<DoorId, "collected" | "partial" | "not-collected">>; // 수집 현황 격자
  readonly inputs: readonly { readonly kind: InputKind; readonly name: DisplayValue; readonly bytes: number; readonly status: "parsed" | "partial" | "rejected"; readonly why: ReasonRef | null }[];
}
export interface PermissionsBlock { readonly denied: readonly { readonly call: string; readonly scope: string; readonly receiptId: string; readonly times: number }[]; readonly unlockHints: readonly PermissionHint[] }
export type Banner =
  | { readonly kind: "undetermined"; readonly count: number }
  | { readonly kind: "snapshot-age"; readonly level: "stale" | "very-stale"; readonly ageHours: number }
  | { readonly kind: "schema-unsupported"; readonly area: "file" | DoorId; readonly got: string; readonly supported: readonly string[] }
  | { readonly kind: "parse-failed"; readonly input: InputKind; readonly why: ReasonRef }
  | { readonly kind: "secrets-detected"; readonly count: number }
  | { readonly kind: "csv-scope-unproven" } | { readonly kind: "collected-at-approximate" } | { readonly kind: "identity-unconfirmed" }
  | { readonly kind: "exceptions"; readonly applied: number; readonly expired: number; readonly targetMissing: number }
  | { readonly kind: "guidance-stale"; readonly ruleIds: readonly RuleId[] };
export interface ManualCheckItem {
  readonly id: string; readonly origin: "unknown-item" | "unknown-rule" | "guide-card" | "out-of-scope" | "auto-notice";
  readonly ruleId: RuleId | null; readonly resource: ResourceRef | null; readonly what: ReasonRef; readonly how: ReasonRef; readonly unlock: PermissionHint | null;
}
export interface Report {
  readonly model: typeof REPORT_MODEL; readonly engine: { readonly version: string; readonly rulesetVersion: string };
  readonly mode: { readonly kind: "real" } | { readonly kind: "demo"; readonly setId: "A" | "B" | "C" | "D" };
  readonly identity: IdentityBlock; readonly scope: ScopeBlock; readonly collection: CollectionBlock; readonly permissions: PermissionsBlock;
  readonly cannotSee: readonly GlobalCannotSee[];                                // 첫 화면 고정
  readonly distribution: { readonly rules: Distribution; readonly items: Distribution };
  readonly banners: readonly Banner[];                                           // 표시 순서 = 배열 순서
  readonly doors: readonly DoorResult[];                                         // 5개 고정(미수집 문 포함)
  readonly firstLook: readonly { readonly ruleId: RuleId; readonly itemId: string | null }[]; // 먼저 볼 3개
  readonly manualChecklist: readonly ManualCheckItem[];
}
export type Comparison =
  | { readonly ok: false; readonly reason: "different-account" | "different-cloud" | "schema-unsupported" | "same-snapshot" }
  | { readonly ok: true; readonly rules: readonly { readonly ruleId: RuleId; readonly before: Status; readonly after: Status; readonly riskItems: { readonly before: number; readonly after: number } }[]; readonly credentialReportCacheWarning: boolean };
export interface JudgeOptions { readonly now: IsoUtc; readonly exceptions: ExceptionsFile | null; readonly params?: Readonly<Record<string, number | readonly number[] | readonly string[]>> }
export type Judge = (input: NormalizedInput, opts: JudgeOptions) => Report; // 순수 함수(백엔드 소유)
```

**설계 메모**
- 카탈로그 타입을 `Record<ReasonCode, string>`으로 두면, 문구 하나라도 빠졌을 때 컴파일 오류가 납니다.
- INV-9 검사: 상태와 집계는 `now`와 무관하고, `now`는 배너와 `evaluatedAt`에만 쓰입니다. QA는 "`now`만 다르게 두 번 호출해도 doors와 distribution이 같다"는 속성 테스트를 돌리면 됩니다.
- 예외는 엔진 입력으로 받아 라벨만 붙입니다(INV-8을 테스트할 수 있음). 본인 응답은 UI 세션 상태로 둡니다.

**디자인팀장·기획팀장이 정할 질문**
1. 리포트 머리에 보일 분포를 무엇으로 셀지
   - **룰 단위**: 18장 기준이라 숫자가 안정적입니다. 권고안입니다.
   - **항목 단위**: 기획서의 "N개 항목" 표기와 맞습니다.
   - 모델은 둘 다 제공합니다.
2. `firstLook`(먼저 볼 3개) 선정 기준: 상태 순 → priority 순으로 할지.
3. 마스킹 형식: 예) 계정 ID `••••••••9012`, 이름은 앞 2자만.
4. 미수집 문도 격자에 5개 모두 표시할지.

**T1(수집 계약)에 프론트가 요구하는 필드**
- `identity.confirmed`: 수집기에서 Enter로 계정 확인을 했는지, `--yes`로 건너뛰었는지.
- `doorsRequested`: '선택하지 않아 미수집'과 '수집 실패'를 구분하려면 필요합니다.
- `collectedAt`: 필수, UTC `Z` 형식.
- `truncated` 영수증에는 페이지 토큰이 남았는지 표시.
- 최상위 `schema`를 먼저 검사합니다.
- 파일 크기 상한(예: 20 MB), 문자열 길이·JSON 깊이 제한. UI가 파싱 전에 거부합니다.

---

## 6. R-04 · R-06 · R-11 · R-12 코드 수준 강제

### 강제 수단 4층
| 층 | 수단 | 비고 |
|---|---|---|
| ① 소스 정적 검사 | `_build/guards.test.ts`. TypeScript 5.9.3 compiler API로 AST를 검사 | 주석·문자열 속 단어로 오탐하지 않음. ESLint 설정은 루트 공유 설정이라 쓰지 않음 |
| ② 번들 검사 | 최종 JS에서 금지 토큰 탐지 | React 내부에 있는 토큰은 제외 |
| ③ 런타임(플랫폼) | CSP, Trusted Types, Permissions-Policy | 브라우저가 직접 막음 |
| ④ 행동 테스트 | RTL + jsdom | 실제 렌더 결과로 확인 |

### 요구사항별 적용
**R-06 (영속 저장 0)**
- ① 소스: 아래 식별자·속성 사용을 금지합니다. 대상은 `_client/**`와 `src/lib/cloudcheck/**`입니다.
  - 저장소: `localStorage`, `sessionStorage`, `indexedDB`, `caches`, `cookieStore`, `document.cookie`
  - 백그라운드: `navigator.serviceWorker`, `BroadcastChannel`, `Worker`
  - URL·창 상태: `pushState`/`replaceState`, `location.hash`·`location.search` 대입, `window.name` 대입
  - 파일 시스템: `showSaveFilePicker`
- ② 번들: 같은 토큰 0건. React에는 없습니다 [확인].
- ③ 런타임: `worker-src 'none'`, `connect-src 'none'`.
- ④ 행동: 체험 세트와 파일을 로드한 뒤 확인합니다.
  - `setItem`, cookie setter, `pushState` 스파이 호출 0
  - `location.href` 불변

**R-07(d)·R-14 (추가 요청 0)**
- ① 소스: 네트워크 API 금지 — `fetch`, `XMLHttpRequest`, `WebSocket`, `EventSource`, `sendBeacon`, `import()`, `new Image`, `RTCPeerConnection`.
- ① 소스: JSX 요소 금지 — `<img>`, `<iframe>`, `<script>`, `<link>`, `<object>`, `<embed>`, `<video>`, `<audio>`, `<source>`.
- ② 번들: 같은 토큰 0건 + URL 호스트 허용 목록.
- ③ 런타임: `default-src 'none'`, `img-src data:`.

**R-11 (원클릭 복사 0)**
- ① 소스: `navigator.clipboard`, `execCommand`, `ClipboardItem` 금지. CLI는 `CliBlock`으로만 그립니다.
- ② 번들: `navigator.clipboard`, `execCommand` 0건.
- ③ 런타임: `clipboard-write=()`.
- ④ 행동: `CliBlock` 안에 button 0개, 자리표시자가 그대로 보이는지.

**R-12 (innerHTML 0, 이스케이프)**
- ① 소스: 아래 사용을 금지합니다.
  - HTML 문자열 대입: `innerHTML`, `outerHTML`, `insertAdjacentHTML`, `document.write`
  - HTML 파싱: `DOMParser`, `createContextualFragment`, `srcdoc`
  - 문자열 실행: `eval`, `new Function`, 문자열을 넘긴 `setTimeout`
  - JSX: `dangerouslySetInnerHTML`
- ① 소스: `DisplayValue.full` 접근은 `MaskedValue.tsx`에서만, `href`는 `DocLink.tsx`에서만 허용합니다.
- ② 번들: React 내부에 innerHTML이 5건 있어 번들 검사로는 못 잡습니다. ①과 ④가 맡습니다.
- ③ 런타임: Trusted Types. Chromium에서 문자열 HTML 대입이 즉시 TypeError가 됩니다.
- ④ 행동: 적대 픽스처를 렌더합니다(`<img onerror>`, `</script>`, U+202E, 아주 긴 이름).
  - 기대값: `img` 0개, 텍스트는 원문 그대로. jsdom 프로브와 같은 방식입니다 [확인].
  - 비밀 패턴이 있으면 값을 그리지 않습니다.

**R-04 (금지어)**
- ① 소스: 카탈로그 문자열을 §9-1 목록으로 검사합니다. 대상은 `_client/i18n/ko/*`와 `rules/text.ko.ts`입니다.
  - 예: 안전, 문제없, 통과, 합격, 적합, 준수, 인증, 보증, 점수, 등급, %, 평균, 순위, 완료, 완벽, OK, `\d+\s*(분|초)`, 쓰기 0건
  - 면책 문구처럼 금지어가 꼭 들어가야 하는 문구는 키 단위 허용 목록으로 뺍니다. 각 항목에 사유 주석을 달고 기획팀장이 확인합니다.
- ④ 행동: 가짜 회사 A~D 리포트를 렌더한 뒤 `body.textContent`에서 허용 문구를 지우고 금지어가 0건인지 봅니다. 실행 중에 조합되는 문구까지 잡힙니다.

### CSP로 못 막는 브라우저 기능 [일반 지식]
- **향상된 맞춤법 검사**: 붙여넣기 칸과 예외 사유 입력칸에 아래 속성을 넣습니다.
  - `spellcheck={false}`, `autoComplete="off"`, `autoCorrect="off"`, `autoCapitalize="off"`, `data-gramm="false"`
- **자동 번역**: 사용자 데이터를 보여 주는 요소에 `translate="no"`를 붙입니다.
- **확장 프로그램**: '직접 확인하기'에 "확장을 끈 프로필이나 시크릿 창 권장"을 적습니다. 약속 문구의 범위도 조정해야 합니다(기획팀장 결정).
- **자동완성 기록**: `form-action 'none'`이라 폼이 제출되지 않으므로 저장되지 않습니다.

---

## 7. 프론트 리스크
| 리스크 | 대응 | 잔여 |
|---|---|---|
| 정적 응답의 헤더가 Vercel에서 빠짐 | force-dynamic 채택, G5에서 `curl -sI` 확인 | 낮음 |
| Trusted Types가 특정 React 경로에서 예외를 냄 | React 프로브, STEP 5 Chrome 전 화면 QA. 실패하면 지시어 2개만 제거 | 중→낮음 |
| 인라인 스크립트 파서 함정(`<!--`, `<script`), CRLF 때문에 해시 불일치 | 후처리 + 테스트 [확인] | 낮음 |
| 간접 의존 esbuild의 버전 변동·감사 경고 | lockfile 고정, 없으면 실패, 필요 시 B안으로 승격 | 낮음 |
| 생성물을 갱신하지 않은 채 push | 동기 테스트가 `npm run test`에 포함됨 | 낮음 |
| 거대 입력 파일로 화면이 멈춤 | 크기 상한, 청크 단위 파싱, 진행 표시. CSP상 Worker는 쓸 수 없음 | 중 |
| 브라우저 기능(맞춤법·번역·확장)으로 내용이 유출 | §6의 속성 적용 + 고지 문구 | 중 (문구 결정 필요) |
| 번들 비대 | 예산 테스트 | 낮음 |
| History API를 안 써서 뒤로가기 시 결과가 사라짐 | 리포트가 있을 때 `beforeunload` 확인 | 낮음 |
| 인쇄본에 실명 노출 | 인쇄는 기본 마스킹(span 2개 + `@media print`), 화면에서 가리기 토글 | 낮음 |
| 같은 origin의 다른 앱(Service Worker, `/api/*`) | SW 등록 0 [확인: grep], `img-src`에 'self' 없음, G5에 grep 게이트 | 낮음 |
| 오프라인 파일에서 `/download` 링크가 깨짐 | http(s)로 열렸을 때만 링크 표시 | 낮음 |

**T7(배포 게이트)에 넣을 프론트 항목**
- **로컬**
  - `npm run test`: 동기 검사, 가드, 헤더 스냅샷이 모두 포함됩니다.
  - 클린 빌드에서 `ƒ /cloudcheck`인지 확인합니다.
  - `scratchpad/s1-check.sh`와 같은 방식의 curl 검사.
- **라이브**
  - 헤더의 CSP 해시가 `PAGE.scriptHash`·`PAGE.styleHash`와 같은지.
  - `curl -s | shasum -a 256` 결과가 `PAGE.sha256`, `/download` 해시와 같은지.
  - 브라우저에서 Network 1건, CSP 위반 0.
  - `grep -rn serviceWorker src`가 0건인지.
  - 기존 `/pae`, `/moira`, `/exam` 회귀 없음.

---

## 8. 일정 (STEP 4 프론트, G0 이후)
| 일차 | 프론트팀장 | 컴포넌트개발자 | 페이지개발자 |
|---|---|---|---|
| D1 | 생성기·템플릿·후처리, 헤더 모듈, 두 라우트, `--preview`, 목업 Report A~D, 테스트 골격 | 토큰·base·print CSS, StatusBadge·MaskedValue·DocLink·CliBlock | reducer, 화면 골격, i18n 키 구조, Landing |
| D2–3 | 가드(AST)·번들·예산·URL 테스트, 리뷰 | ScopePanel·BannerStack·DoorCard·RuleCard·ItemRow·EvidenceList·FixSteps·DropZone·PasteBox·ManualChecklist + RTL | Collect·Report·Fix·RuleCatalog·Demo·Exceptions (+Compare는 컷 1순위) |
| D4 | 통합: 실제 엔진 연결, 렌더 금지어 검사, G5 로컬 브라우저 점검 | 수정 | 수정 |
| D5 | 버퍼, QA 인계 | | |

- 프론트 기준 약 5일입니다.
- 크리티컬 패스는 G0(T1·T2 동결)과 디자인 스펙입니다. 엔진이 늦어져도 목업 Report로 D1~D3는 진행할 수 있습니다.

---

## 9. 결정·승인 요청 (@기획팀장)
1. T3: ① + force-dynamic으로 확정. 정적 전환은 Q10 승인 시 프리뷰에서 확인한 뒤 선택.
2. T4: React 18, 간접 esbuild + 생성물 커밋, 손작성 CSS. `package.json` 무수정. esbuild 승격(B안)은 조건이 생길 때 PM 승인.
3. 헤더 최종 문자열(§2) 채택. Trusted Types는 QA 통과를 조건으로 채택하고, §17-1의 해당 항목을 갱신.
4. 리포트 머리 분포를 룰 단위로 할지 항목 단위로 할지 결정 (디자인팀장과 함께).
5. 약속 문구 옆에 "브라우저 확장·자동 번역은 이 페이지가 막을 수 없습니다" 고지를 넣을지.
6. §5의 T1 요구 필드 반영 (백엔드팀장).
7. 기획서 §18의 링크 위치 정정.

**하지 않은 것**: 커밋, push, 배포, 패키지 설치, `package.json` 수정을 하지 않았습니다. 레포에서 만든 파일은 스텁 하나뿐입니다. 라이브 사이트에는 읽기 전용 HEAD 요청 3건만 보냈습니다.

## 10. 파일
- S1 스텁(force-dynamic): `/Users/pyoungminho/Desktop/무제 폴더/team_makes/src/app/cloudcheck/route.ts`
- scratchpad: `/private/tmp/claude-501/-Users-pyoungminho-Desktop-------team-makes/a8432358-e439-4607-8633-d54f9c3d981b/scratchpad/`

  | 경로 | 내용 |
  |---|---|
  | `s1-check.sh` | curl 검사 스크립트. G5 로컬에서 재사용 가능 |
  | `static/`, `dynamic/` | 응답 헤더·본문 캡처 |
  | `build-static.log`, `build-dynamic.log` | 빌드 로그 |
  | `t4/react-csp-probe.html` | React 18 + 해시 CSP + Trusted Types 확인용 |
  | `t2/report.ts` | T2 모델 초안 (tsc strict 통과본) |
  | `nextprobe/` | 격리 Next 앱 |

출처:
- [OSV: GHSA-67mh-4wv8-2f99](https://osv.dev/vulnerability/GHSA-67mh-4wv8-2f99)
- [GitLab Advisory: esbuild GHSA-67mh-4wv8-2f99](https://advisories.gitlab.com/pkg/npm/esbuild/GHSA-67mh-4wv8-2f99/)
- [Vercel Community t/562 (Deployment Protection 사례)](https://community.vercel.com/t/content-headers-from-nextjs-route-handlers/562)
