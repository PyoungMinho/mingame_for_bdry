# 프로젝트 방향서 — 「문단속 5」(cloudcheck) /cloudcheck

> 작성: @기획팀장(Opus) · STEP 2 팀장 합동 회의 종합(디자인·프론트·백엔드 팀장 검토 원문 통합)
> 기반: 기획서 `docs/planning/cloudcheck-plan.md`(STEP 1 확정본) · 검토 원문 `docs/design/cloudcheck-lead-review.md`, `docs/frontend/cloudcheck-lead-review.md`, `docs/backend/cloudcheck-lead-review.md` · 메인 세션 S1 브라우저 확인(2026-10-19)
> 기준일: 2026-10-19 · 대상 라우트: `/cloudcheck`(Vercel `project-orsrw.vercel.app/cloudcheck`, 베타는 noindex)
> 지위: **STEP 3 디자인·STEP 4 개발의 기준 문서.** 기획서·검토 원문과 충돌하면 이 문서가 우선한다. 기획서 본문은 고치지 않았고, 바뀐 점은 §12에 모았다.
> 상태: **결정 확정 + G0 동결 대상 코드 확정(스크래치패드 컴파일·실행 검증 완료) + PM 확인 질문은 기본안으로 진행**

**표기**: [확인] 1차 자료·레포·실행으로 확인 / [확인: 메인 세션] 메인 세션 브라우저 확인 / [일반 지식] 널리 알려진 사양, 원문 재확인 안 함 / [미확인] 확인 못 함. **[확인]이 아닌 사실과 통계 수치는 제품 문구에 쓰지 않는다**(기획서 원칙 유지).

---

## 0. 종합 결론

세 팀장의 검토는 기획서의 골격(5상태, fail-closed, 영수증, 자체 완결 HTML 한 장, 셸 붙여넣기 없음, 룰 18장)을 모두 지지했고, 충돌은 **"같은 개념을 서로 다른 이름과 위치로 설계한 것"**에 몰려 있었다. 그래서 이번 결정의 중심은 기능 추가가 아니라 **단일화**다. 문 ID(`mfa·key·net·sto·log`), 상태 문자열(`caution`), 사유 코드, 판정 결과 모델, 수집 계약, 금지어 목록을 하나씩만 두고, 그 코드를 이 문서에 그대로 실었다(§4, §5, §7-3). STEP 4 첫날 이 코드를 레포 파일로 옮겨 `npm run type-check`를 통과시키는 것이 G0이다.

핵심 판정 7가지:
1. **서빙**: ① 현 프로젝트 Route Handler + `force-dynamic`로 확정한다. S1에서 격리 조건이 로컬 기준으로 성립했다 [확인]. 정적 헤더의 Vercel 유지 여부는 [미확인]으로 남기고, 쓰지 않는 방식으로 우회한다.
2. **판정은 입력만의 함수**다. `judge(input)`는 현재 시각·예외 파일·본인 응답을 받지 않는다. 시간 배너와 예외 라벨은 별도 순수 함수가 덧씌운다. INV-8·INV-9를 테스트가 아니라 **함수 시그니처**로 보장한다.
3. **분포는 점검(룰) 단위**로 센다. 화면 용어는 '점검'(룰)과 '대상'(리소스)이고 '항목'은 화면에서 쓰지 않는다. 문 단위 종합 배지는 화면에 그리지 않는다.
4. **복사 버튼은 하나도 두지 않는다**(KQL 포함). `clipboard-write=()`로 플랫폼이 막는 상태를 지킨다. 긴 KQL은 클릭 한 번 전체 선택으로 실수를 줄인다.
5. **"전송 없음" 약속은 '이 페이지의 동작'으로 범위를 좁힌다.** 브라우저 확장·자동 번역·향상된 맞춤법 검사는 페이지가 막을 수 없다는 고지를 약속 옆에 항상 붙인다.
6. **뒤로 가기는 앱 안에서 처리한다.** 화면 ID만 담는 `pushState`를 단일 관문에서만 허용한다. 리포트 유실(휴먼에러 ⑦)을 막기 위해서다. URL은 바꾸지 않는다.
7. **룰 파라미터는 공개 기준을 우선한다.** 미사용 자격증명 45일(Security Hub IAM.22), 키 나이 90일(IAM.3), 위험 포트는 EC2.19 기반 2단계로 정했다. 세 가지 모두 이번에 1차 문서로 다시 확인했다 [확인].

---

## 1. 결정 표

### 1-1. 메인 세션이 올린 13개 쟁점

| # | 쟁점 | 결정 | 이유(채택·수정한 의견) |
|---|---|---|---|
| 1 | 분포 단위 | **점검(룰) 단위.** 분포 문장은 "점검 N개 — 위험 a · 주의 b · 확인 불가 d · 이상 없음 c · 해당 없음 e"이고, 순서는 STATUS_ORDER를 따른다. N은 그 클라우드의 출시 룰 수다(미수집 문의 룰 포함, AWS 10 · Azure 7). 모델은 `distribution.rules`와 `distribution.items`를 둘 다 낸다 | 디자인 D1·D3, 프론트, 백엔드가 모두 권고했다. 대상 단위로 세면 큰 계정에서 '이상 없음 214'처럼 초록이 부풀어 녹색 과신(④)을 부른다. 대상 수는 각 점검 안에서 보여 준다 |
| 2 | 문 단위 종합 배지 | **모델에는 둔다**(`DoorResult.worstStatus`, §5-3 집계). **화면에는 그리지 않는다.** 문 머리에는 상태별 개수 칩과 '직접 볼 것 n'만 둔다. `worstStatus`는 정렬, 인쇄 요약, 정답지(G3)에만 쓴다 | 디자인 D2를 채택했다. 문 색 하나가 작은 종합 판정이 되어, 콘솔 사용자가 0명이면 IdP MFA를 못 봤는데도 현관이 초록이 된다. 엔진 집계는 정답지가 검사하므로 모델에는 남긴다. 이름을 `status`에서 `worstStatus`로 바꿔 쓰임새를 드러냈다 |
| 3 | 뒤로 가기 / History API | **`history.pushState`를 단일 관문 모듈 `_client/state/history.ts`에서만 허용한다.** state에는 화면 ID(`ScreenId` 값)만 넣고 URL 인자는 쓰지 않는다. `replaceState`와 URL·해시 변경은 계속 금지한다. 데이터가 없는 화면으로 돌아오면 V0을 보인다. file://에서 예외가 나면 이력 없는 모드로 동작한다. `beforeunload`는 리포트가 메모리에 있을 때만 건다 | 디자인을 채택하고 프론트의 우려를 조건으로 넣었다. 뒤로 가기가 페이지 이탈이 되면 브라우저의 일반 확인창이 뜨는데, 습관적으로 '확인'을 누르면 30분 작업이 사라진다. 이것이 휴먼에러 ⑦이다. 화면 ID는 입력 데이터가 아니므로 R-06(입력 데이터를 URL·저장소에 남기지 않음)에 걸리지 않는다. 가드 테스트가 호출 위치를 관문 1곳으로 묶고 인자 모양을 검사한다(§2-4) |
| 4 | 판정 결과 모델(T2) 단일화 | **§5의 `model/report.ts` 하나로 확정한다.** 골격은 프론트 초안(판별 유니온, DisplayValue)이다. 여기에 디자인 요구 필드와 백엔드 엔진 개념(ScopeProof → ProvenCoverage, gaps, 해소법, population)을 합쳤다. 소유는 프론트팀장 + 백엔드팀장 공동, 위치는 `src/lib/cloudcheck/model/report.ts`, 동결 시점은 G0이다 | 상충 필드는 이렇게 정했다. 상태 `caution`(백엔드 `warn` 폐기), 문 ID `mfa·key·net·sto·log`(프론트 `entrance…` 폐기), judge의 now·예외 인자 제거(백엔드안), 정적 룰 데이터를 RULE_CATALOG로 분리(V7과 공용), 사유 코드 kebab-case(카탈로그 키 규칙과 일치). 세부는 §1-2와 §5-1 |
| 5 | 수집 계약 v1(T1) | **백엔드 zod 확정안을 채택하고 몇 가지를 보탰다**(§4). 보탠 것: 수집기가 직접 찍는 시각 3곳은 `Z` 고정, Azure 리소스 ID 대소문자 무시, truncated의 errorCode는 null, 크기·깊이 상한(LIMITS), 호출 카탈로그의 권한명 1:1, Resource Graph 쿼리에 `tenantId` 열 | 디자인 7요구: 1(키 끝 4자리)·3(구독 이름·상태)·5(공인 IP 3값 = 불리언 + 영수증 실패)·6(주체 유형·역할명)·7(보고서 시각 출처)은 원안에 이미 있다. 4(권한명 1:1)는 카탈로그로 충족했다. **2(`run{id, part}`)는 필드를 추가하지 않는다.** 실행 식별은 runKey(cloud·계정·collectedAt)로, 분할은 `--doors` 실행 단위로 하고, 문마다 가장 알맞은 입력 하나를 고른다(§4-8). 조각 분할 붙여넣기는 하지 않는다. 프론트 요구 6개(confirmed, doorsRequested, collectedAt Z, truncated, schema 우선 검사, 상한)는 모두 반영했다 |
| 6 | 룰 파라미터(T6) | 미사용 자격증명 **45일**, 키 나이 **90일 유지**, 위험 포트 **2단계**(메일 포트 25·110·143은 주의), priority는 **10 간격의 중복 없는 정수**(작을수록 먼저), 제목 7개를 **상태 중립형**으로, 금지어 '인증'에 **문맥 허용 목록**. 파라미터마다 '공개 기준/도구 기준'을 화면에 표기한다(§6) | 백엔드 제안을 채택했다. 이번에 1차 문서로 다시 확인했다: IAM.22 "IAM user credentials unused for 45 days should be removed"(비밀번호·액세스 키 모두, CIS v5.0.0/1.11), IAM.3 "rotated every 90 days or less", EC2.19 포트 24개(변경 불가), EC2.18 기본 허용 TCP 80·443 [확인]. 디자인 D7·D8도 채택했다 |
| 7 | 복사 버튼 | **KQL에도 복사 버튼을 두지 않는다.** `Permissions-Policy: clipboard-write=()`를 유지한다. KQL 블록은 CSS `user-select: all`로 클릭 한 번에 전체 선택되게 하고, "Ctrl+C(⌘C)로 복사하세요"를 안내한다. 쿼리의 `ccQuery` 열이 맞는 쿼리를 썼는지 검사한다. 쓰기 명령 블록에는 전체 선택도 적용하지 않는다 | 디자인 D6이 지적한 '긴 KQL을 손으로 선택하다 생기는 실수'는 전체 선택으로 해결한다. 예외를 하나 만들면 R-11의 플랫폼 강제(클립보드 차단 [확인: 메인 세션])가 깨지고, 가드 테스트에 예외 경로가 생기며, '웹에서 복사 → 콘솔에 붙이기' 습관(ClickFix 교육 메시지)과도 어긋난다 |
| 8 | "전송 없음" 문구 범위 | **약속은 '이 페이지(의 코드)가 하는 일'로 한정하고, 고지를 항상 함께 붙인다**(§7-2). §9-2 면책도 고친다. 기술 대응: 입력칸에서 맞춤법·자동완성 계열 끄기, 사용자 데이터 화면(V2~V5)과 MaskedValue에 `translate="no"`, `X-DNS-Prefetch-Control: off`, 가드로 최상위 이동·`window.open`·`RTCPeerConnection` 금지 | 프론트(맞춤법·번역·확장은 CSP로 못 막는다)와 백엔드(CSP는 최상위 이동·WebRTC·DNS 프리페치 유출을 못 막는다)의 지적을 모두 채택했다. 우리 코드에는 그런 경로가 없다는 것은 가드 테스트와 읽을 수 있는 단일 HTML로 보이고, 브라우저 자체 기능은 정직하게 고지한다 |
| 9 | Trusted Types·헤더 | **헤더 최종 문자열은 프론트 §2를 그대로 채택한다**(§2-2). Trusted Types 지시어 2개는 **조건부 채택**한다. STEP 5에서 Chrome 기준 전 화면(V0~V8, 체험 A~D, 드롭, 붙여넣기, 인쇄, 다운로드)의 TT 위반이 0이면 유지하고, 실패하면 그 2개만 같은 릴리스에서 빼고 기록한다 | innerHTML 대입이 TT로 차단되는 것은 확인했다 [확인: 메인 세션]. React 18의 실브라우저 렌더는 jsdom에서만 확인했다 [미확인]. 그래서 조건부로 둔다 |
| 10 | 디렉터리·담당 | **§3 표로 확정한다.** 프론트 T5안과 백엔드 T9안을 합쳤다. 컴포넌트개발자·페이지개발자·API설계자·DB설계자가 서로 다른 경로만 쓴다. `_generated/`는 프론트팀장만 재생성한다 | 이름 충돌은 이렇게 정리했다. `collector/`(백엔드 이름), `parse/`는 API설계자 소유로 분리, 모델은 `model/`(공동), 엔진이 내는 코드의 문장은 `rules/i18n/ko.ts`(DB설계자), 화면 고정 문구는 `_client/i18n/ko/*`, 금지어 모듈은 `model/banned-words.ts`(공동, 목록 변경은 기획팀장 확인), `qa/`는 STEP 5 QA |
| 11 | 기술 스택(T3·T4) | **승인한다.** ① Route Handler + `force-dynamic`(nodejs 런타임), 설치된 React 18.3.1, 간접 의존 esbuild 0.21.5(build API만) + 생성물 커밋, 손작성 CSS(`cc-` 접두, Tailwind 클래스 금지), `package.json` 무수정. 조건 4가지: esbuild `charset: 'utf8'`, 체험 데이터와 수집기 원문은 실행되지 않는 데이터 블록, 번들 예산 재설정(§2-3), JSX `style` prop 금지 | 프론트 측정값 [확인]을 따랐다. 기획팀장이 zod 번들을 따로 재 보니 zod 3.25.76이 60.5 KB(min)였다 [확인: 측정]. React와 합치면 기본 비용만 약 215 KiB라서 원안 예산(JS 330 KiB)은 빠듯하다 → 예산을 다시 잡았다. Preact는 v1.1 후보(`package.json` 변경이라 PM 승인 필요) |
| 12 | 게이트·테스트 조정 | G4의 "moto 실행"을 **"가짜 CLI shim 실행 테스트 + PM V1 실측"**으로 바꾼다. `test:redline`은 **N/A로 기록하고 PM 확인**만 받는다(코드는 고치지 않음, §10). bash 3.2 기준선(L-12)과 jq 1.6 호환 린트(L-13)를 G4에 명시한다. C-10의 "CI"는 "배포 게이트의 `npm run test`"로 읽는다(레포에 CI 없음 [확인: 백엔드]) | `test:redline` 대상 3파일은 2026-06-30 커밋 4b47f58에서 `_archive/`로 옮겨졌고 vitest include 밖이라 "No test files found"로 exit 1이다 [확인: 실행 로그, git log]. 이를 고치려면 공유 파일(`package.json`)을 바꿔야 하므로 cloudcheck 커밋에 섞지 않는다 |
| 13 | PM 확인 사항 | §11에 Q1~Q15로 정리했다. **답이 오기 전에는 기본안으로 진행한다.** Q10(S1 프리뷰 승인)은 필요 없어졌다 | `force-dynamic` 채택으로 정적 헤더 확인용 프리뷰가 필요 없다. 라이브 헤더는 첫 베타 배포(noindex)의 G5 라이브 점검에서 확인한다 |

### 1-2. 원문을 대조하다 추가로 찾은 충돌

| # | 충돌 | 결정 | 이유 |
|---|---|---|---|
| A | 파싱 실패 처리: 디자인은 "리포트를 만들지 않음", 프론트는 "전부 확인 불가인 Report를 돌려줌" | **파일 전체를 읽지 못하면 리포트를 만들지 않는다**(V2 오류 패널. 빈 파일, 형식 다름, JSON 파싱 실패, 문단속 5 파일 아님, 스키마 메이저 불일치, 키 파일, 크기·깊이 초과). **섹션 단위 실패는 리포트를 만들고** 그 영역을 확인 불가 + 배너로 둔다. `judge()` 자체는 빈 입력에도 예외 없이 전부 확인 불가를 돌려준다(INV-2 속성 테스트용) | 전부 회색인 리포트는 소음이다(디자인). 엔진 견고성(프론트)은 테스트 대상으로 남긴다 |
| B | 현재 시각을 어디서 쓰나: 프론트는 judge에 `now`를 넘김, 디자인·백엔드는 UI가 계산 | **judge는 now를 받지 않는다.** `timeNotices(report, now)`라는 별도 순수 함수(엔진 소유)가 '오래된 사진'(24시간·7일), '오래된 안내'(180일), '시계 차이'를 계산한다. 체험 모드에서는 빈 배열이다 | 같은 파일이면 Report가 바이트 단위로 같다. 골든 스냅샷과 INV-9 검사가 단순해진다. now를 쓰는 코드는 `_client`에서 시각을 읽어 넘기는 한 곳뿐이다 |
| C | 예외 파일: 프론트는 judge의 입력, 백엔드는 UI 오버레이 | **오버레이로 한다.** `overlayExceptions(report, file, today)`는 상태를 바꾸지 않고 라벨만 덧씌운다. 만료 기준은 사용자 기기의 오늘 날짜이고(`until`까지 유효), 만료된 예외는 '만료되어 해제됨' 라벨로 보인다 | 예외가 judge 시그니처에 아예 없으므로 INV-8이 타입으로 보장된다. 본인 응답(AZ-MFA-G)도 같은 원리로 UI 세션 상태로만 둔다 |
| D | 정적 룰 데이터의 위치: 프론트 초안은 RuleResult 안에 fix·guide·cannotSee를 넣음 | **`RULE_CATALOG: RuleCatalogEntry[]`로 분리한다.** RuleResult에는 동적 결과만 둔다. UI는 ruleId로 조인한다 | V7(판정 규칙 화면)과 V3·V4가 같은 원천을 본다. Report 스냅샷이 작아지고 중복이 사라진다 |
| E | 룰 문구 파일: 프론트 `rules/text.ko.ts`, 백엔드 `rules/i18n/ko.json` | **`rules/i18n/ko.ts`**(TS). 공통 코드(확인 불가 사유 21종, fact, 배너, 시간 알림, 입력 인식 상태)의 문장도 여기에 둔다. `satisfies Record<…, string>`으로 빠진 문구를 컴파일 오류로 잡는다 | 엔진이 내는 코드의 문장은 코드를 만드는 쪽(DB설계자)이 함께 관리하는 것이 누락을 막는다. 디자인은 톤과 금지어를 검수한다 |
| F | 고치는 법 명령: 백엔드 `cliExampleKey`(문구 키), 디자인 `<…>` 텍스트, 프론트 구조화 CliTemplate | **구조화 `CliTemplate`**로 한다. 자리표시자는 카탈로그 키 세그먼트이고, 쓰기 명령에는 자리표시자가 1개 이상 있어야 한다(registry 테스트) | 명령은 번역할 문장이 아니다. 자리표시자를 구조로 표현해야 '그대로 붙여 넣어도 실행되지 않음'(R-11)이 데이터 수준에서 보장된다 |
| G | 링크 허용 호스트: 프론트는 문서 3곳, 백엔드 근거 링크는 https 아무 곳 | **단일 `LINK_HOSTS`**(문서·사례·졸업 경로 11곳, §5-2)를 둔다. 번들 URL 검사와 DocLink 관문이 같은 목록을 쓴다. 추가는 프론트팀장 확인 | 사례 링크(보도·정식 보고)가 허용 목록 밖이면 번들 검사가 실패한다 |
| H | React `style` prop: 프론트는 CSSOM 경로라 허용, 디자인은 style 0 | **금지한다**(가드). 필요해지면 프론트팀장 승인 아래 CSSOM 단일 유틸로만 쓴다 | 디자인에 동적 폭 막대 같은 인라인 스타일 수요가 없다. 규칙이 예외 없이 단순할수록 CSP·TT 검증이 쉽다 |
| I | 입력 크기 상한: 프론트 "예: 20 MB", 백엔드 25 MB | **JSON 25 MB · CSV 20 MB · JSON 깊이 32**를 `LIMITS` 한 곳에 둔다 | 계약 스키마(CSV 원문 2천만 자)와 맞는 값을 골랐다 |
| J | 체험 데이터·한국어 문구의 크기가 원안 예산에서 빠짐 | §2-3으로 예산을 다시 잡는다 | 측정값 기준 |
| K | 마스킹 형식 미정(프론트 질문, 디자인 R-13) | **기본안 v1**: `*Id` 계열은 "••••" + 끝 4자리, 이름 계열은 "<유형>-<3자리 순번>"(예: user-003, 리포트 안에서 결정적), 파일 이름은 file-<순번>, 자유 텍스트는 "•••". PM 확인(Q13) | 이름 앞 2자 방식보다 노출이 적다. 골든 파일 가명화(백엔드 §5-2)와 형식을 맞췄다. 본인은 인쇄 옵션 '이름·ID 표시'로 실명을 볼 수 있다 |
| L | Azure CSV 경로의 신원: Resource Graph 쿼리에 테넌트 열이 없음 | **두 KQL에 `tenantId` 열을 추가한다**(§4-7) | 신원 패널, Before/After 계정 일치, 입력 병합의 기준이 생긴다 |
| M | 정답지의 상태 문자열(백엔드 예시 `warn`) | `caution`으로 쓴다 | 상태 문자열 단일화 |
| N | `_generated` 동기 테스트가 STEP 4 중 lib을 바꿀 때마다 실패함 | **정상으로 간주한다.** 팀원은 자기 경로 테스트(`npx vitest run <경로>`)로 작업하고, 통합 시점(D4, D8, QA 인계 전)에 프론트팀장이 재생성한다. 배포 게이트에서는 반드시 초록이어야 한다 | 건너뛰기 플래그를 두면 게이트가 그 플래그를 잊을 위험이 생긴다 |
| O | 배포 remote: CLAUDE.md·deploy.yaml은 `git push origin main`, 실제 라이브 소스는 `mingame` | **`git push mingame main`**(§10). 2026-10-19 기준 HEAD = mingame/main = cc95172, origin/main = d2beb3b [확인: git] | origin에 push하면 라이브에 반영되지 않는다 |
| P | Before/After 비교의 `schema-unsupported` 사유(프론트 초안) | **비교 사유에서 뺀다.** 스키마 문제는 입력 인식 단계에서 걸린다 | 두 리포트를 같은 엔진이 만들므로 비교 단계에서는 생길 수 없다 |
| Q | 디자인 D10(Azure 체험 선공개), D11(화면 가리기 토글) | D10 **채택**: "체험 모드 · 가짜 데이터" + "Azure 실제 점검은 준비 중(실계정 검증 전)" 표기. D11 **P1 채택**(스코프 컷 0순위) | 학습 가치가 크고, 이중 렌더를 이미 하므로 비용이 작다 |
| R | INV-7 표현: 디자인 `onlyThisDenied` 플래그, 백엔드 isolatedDenialFamilies | 주의 대상의 사유 코드 **`isolated-denial`**로 표현한다. UI는 이 코드를 보고 "이 대상만 점검 조회가 거부됨(점검을 막는 정책일 수 있습니다)"을 쓴다 | 플래그를 따로 두면 사유와 어긋날 수 있다 |

---

## 2. 서빙·기술 스택 확정 (T3·T4)

### 2-1. S1 스파이크 결과 요약

| 항목 | 결과 | 출처 |
|---|---|---|
| 헤더 13종이 정적·동적 두 모드에서 유지되고 본문이 바이트 단위로 같음 | [확인] | 프론트, `next build` + `next start` + curl |
| 응답 본문에 루트 layout 흔적 0건(jsdelivr·googleapis·adsbygoogle·`_next/static`) | [확인] | 프론트 |
| `_client` private 폴더가 라우트로 잡히지 않음, 약 469 KB 생성 문자열이 변형 없이 서빙됨, 두 라우트가 같은 바이트 | [확인] | 프론트 격리 프로브 |
| 해시 CSP 아래에서 인라인 스크립트 실행, 로드 시 문서 1건·하위 리소스 0건, CSP 위반 0 | [확인: 메인 세션] | 로컬 `next dev` |
| `fetch` 차단(connect-src), innerHTML 차단(TT), `setAttribute('style')` 차단·CSSOM 적용, `clipboard.writeText` 차단(Permissions-Policy) | [확인: 메인 세션] | 버튼 탐침 ②⑤⑥⑦ |
| 다른 페이지에서 iframe으로 삽입하면 로드 차단(frame-ancestors + XFO), 헤더 6종(CSP·COOP·XFO·X-Robots-Tag·Referrer-Policy·Permissions-Policy) 존재 | [확인: 메인 세션] | `/privacy`에서 시험 |
| Blob 다운로드 바이트 일치, 인쇄 대화상자, COOP 팝업 단절 동작, file:// meta CSP, React 18 + TT 실브라우저 렌더, `pushState`의 file:// 동작 | [미확인] → STEP 5 QA로 이월 | — |
| 정적 Route Handler 헤더가 Vercel에서 유지되는지 | [미확인] (간접 증거: 라이브 `/robots.txt`가 `.meta` 헤더 그대로 PRERENDER로 나감) | `force-dynamic` 채택으로 의존하지 않음 |

### 2-2. 서빙 방식과 헤더 최종 문자열

- `src/app/cloudcheck/route.ts`: `export const dynamic = "force-dynamic"`, nodejs 런타임. `_generated/page.ts`의 HTML 상수와 아래 헤더를 반환한다. route가 import하는 것은 `_generated`와 `_serve`뿐이다(UI 코드는 Next 번들 밖, First Load JS 0).
- `src/app/cloudcheck/download/route.ts`: 같은 바이트에 `Content-Disposition`만 더한다.
- `/cloudcheck`에 `page.tsx`를 두지 않는다. S1 스텁(`route.ts`, 탐침 코드 포함)은 STEP 4에서 통째로 교체한다. 탐침의 innerHTML·clipboard 사용은 가드 테스트가 막으므로 스텁이 남은 채 배포될 수 없다.

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
X-Robots-Tag: noindex                        ← 베타 기간에만(G9에서 제거). 헤더로만 단다(HTML 바이트와 무관)
Cache-Control: public, max-age=0, must-revalidate
Content-Disposition: attachment; filename="cloudcheck-<페이지 버전>.html"   ← /cloudcheck/download에만
```

- **HTML 머리 순서**: `<meta charset="utf-8">` → meta CSP(위 CSP에서 `frame-ancestors`만 뺀 문자열) → `<meta name="referrer" content="no-referrer">` → `<meta http-equiv="x-dns-prefetch-control" content="off">` → viewport·title → `<link rel="icon" href="data:image/svg+xml,…">`(열쇠 구멍 글리프) → `<style>` 1개 → 정적 머리(V0 정적 내용)·`<noscript>`·`#app` → 데이터 블록(수집기 원문 `text/plain`, 체험 데이터·릴리스 해시 `application/json`, `<`는 `\u003c`로) → `<script>` 1개.
- 기획서 §8-2 대비: `img-src`의 `blob:`과 `font-src data:`를 뺐다(쓸 곳이 없다). TT 2지시어(조건부), `X-Frame-Options`, `X-DNS-Prefetch-Control`을 더했고 Permissions-Policy를 넓혔다. `img-src`에 `'self'`를 넣지 않는 원칙(같은 origin의 `/api/*`로 내보낼 길 차단)은 유지한다.
- 정적 모드 전환은 하지 않는다. 필요해지면 프리뷰에서 `curl -sI`로 확인한 뒤 프론트팀장이 제안하고 PM이 승인한다.

### 2-3. 기술 스택과 번들 예산

| 항목 | 확정 | 비고 |
|---|---|---|
| UI 런타임 | React 18.3.1(설치본) | gzip 45.1 KiB [확인: 프론트]. JSX 자동 이스케이프, `dangerouslySetInnerHTML`은 AST 가드로 0 |
| 번들 | 간접 의존 esbuild 0.21.5(vite 5.4.21 경유) build API만, iife, 압축, **`charset: 'utf8'`**, `legalComments: 'eof'` | `charset`을 기본값(ascii)으로 두면 한국어 문구가 `\uXXXX`로 바뀌어 크기가 약 2배가 된다 [일반 지식]. 생성기는 serve 금지(GHSA-67mh-4wv8-2f99는 serve 한정 [확인: 프론트]). 출력이 결정적임 [확인: 프론트] |
| 생성물 | `_generated/page.ts` 커밋(HTML·해시·바이트 수·esbuild 버전·수집기 해시). 시각·절대경로 없음 | Vercel 빌드에는 esbuild가 필요 없다. 승격(devDependency 고정)은 버전 변동이나 감사 경고가 생길 때 PM 승인 |
| 후처리 | `<!--`·`<script`의 `<`를 `\x3C`로 치환, CR 금지, `vm.Script` 컴파일 확인 | 프론트가 찾은 파서 함정 [확인] |
| CSS | 손작성(`tokens.css`·`base.css`·`print.css` + 컴포넌트별), `--cc-` 토큰, 클래스 `cc-` 접두, Tailwind 클래스·CSS-in-JS·`@import`·외부 `url()` 금지, 시스템 폰트만 | 레포 9개 앱 선례 [확인: 프론트] |
| 데이터 블록 | 수집기 원문(text/plain), 체험 데이터 4×2(JSON), 알려진 수집기 릴리스 해시(JSON) | 실행되지 않으므로 CSP 해시와 JS 예산 밖이다. 소스 보기로 원문을 읽을 수 있고, Blob 바이트 = 파일 바이트 |

**측정값** [확인]: React 18.3.1 139.4 KiB(min) / zod 3.25.76 60.5 KB + 계약 코드 17.2 KB(min, gzip 합계 19.9 KB, 기획팀장 측정) / zod·계약 번들에서 금지 토큰(`new Function`, `eval(`, 저장소·네트워크 API, `<!--`, `<script`) 0건.

**예산(잠정, 예산 테스트 구조는 프론트 원안 그대로)**

| 대상 | 목표 | 실패 기준 |
|---|---|---|
| HTML 전체(원본) | 700 KiB 이하 | 900 KiB 초과 |
| HTML 전체(gzip) | 200 KiB 이하 | 260 KiB 초과 |
| 실행 JS | 480 KiB 이하 | — |
| CSS | 30 KiB 이하 | — |
| 수집기 원문 합계 | 24 KiB 이하 | — |
| 체험 데이터 합계(JSON 블록) | 100 KiB 이하 | — |

- D4 통합 때 실측해서 프론트팀장이 확정한다. 낮추는 방향은 자유고, 올리려면 기획팀장 확인을 받는다.
- 첫 화면(V0)은 정적 HTML로 먼저 그린다. 그래서 JS 크기와 무관하게 LCP를 확보한다(G5에서 실측).

### 2-4. 코드 수준 강제(가드) 조정분

프론트 §6의 4층 강제(AST·번들·플랫폼·행동)를 그대로 따르되, 다음을 바꾼다.

| 항목 | 조정 |
|---|---|
| `pushState` | `_client/state/history.ts` 한 파일에서만 허용. 인자는 `{ cc: <ScreenId> }`와 `""` 두 개뿐(URL 인자 없음). 번들 금지 토큰에서 `pushState`를 빼고 "번들 안 `pushState`는 1곳"으로 검사. `replaceState`는 계속 금지 |
| JSX `style` prop | 금지(예외 없음). SVG의 `style` 속성도 금지 |
| 이동·창 | `location.href`·`location.assign`·`location.replace` 대입, `window.open`, `RTCPeerConnection` 금지. 외부 링크는 `<a target="_blank" rel="noopener noreferrer">`로만 |
| `href` | 관문 컴포넌트(DocLink, 다운로드 관문)에서만. DocLink는 `LINK_HOSTS`만 허용 |
| 입력칸 | PasteBox와 예외 사유 입력에 `spellcheck={false}`, `autoComplete="off"`, `autoCorrect="off"`, `autoCapitalize="off"`, `data-gramm="false"`, `data-gramm_editor="false"`, `data-enable-grammarly="false"` |
| 번역 | V2~V5 화면 컨테이너와 MaskedValue에 `translate="no"`. V0·V1·V6·V7·V8은 번역을 허용한다(일본어 독자가 v1.1 전에 안내를 읽을 수 있게) |
| 전체 선택 | CSS `user-select: all`은 KQL 블록과 해시 표시에만 쓴다 |
| lib 경계 | `src/lib/cloudcheck/{model,contract,parse,engine,rules}`는 React·DOM·`node:*` import 금지(테스트 파일 제외). `engine/`·`rules/`·`contract/`에서 `Date.now`, 인자 없는 `new Date()`, `Math.random`, `performance.now` 금지(백엔드 소스 스캔) |
| 금지어 | 정적 검사·렌더 검사 모두 `model/banned-words.ts`의 `findBanned()` 하나를 쓴다(구현 두 벌 금지) |

---

## 3. 디렉터리·소유자와 병렬 작업 규칙 (T5·T9)

이 프로젝트는 서버가 없으므로, CLAUDE.md의 기본 백엔드 위치인 루트 `api/`는 쓰지 않고 `src/lib/cloudcheck/`로 대체한다.

| 경로 | 소유(STEP 4) | 내용 | 다른 사람 |
|---|---|---|---|
| `src/app/cloudcheck/route.ts`, `download/route.ts` | 프론트팀장 | 두 라우트(S1 스텁 교체) | — |
| `src/app/cloudcheck/_serve/**` | 프론트팀장 | `headers.ts`(CSP·헤더 조립 순수 함수), `serve.test.ts`(헤더 스냅샷, 두 라우트 본문 일치) | — |
| `src/app/cloudcheck/_build/**` | 프론트팀장 | `generate.mjs`, `template.mjs`, `generated.test.ts`, `guards.test.ts` | — |
| `src/app/cloudcheck/_generated/page.ts` | **프론트팀장만 재생성** | 생성물. 손수정 금지 | 팀원은 `--preview <레포 밖 경로>`만 쓴다 |
| `src/app/cloudcheck/_client/main.tsx`, `state/**`(+ `history.ts`), `screens/**`, `config.ts` | 페이지개발자 | 화면 V0~V8, reducer, 앱 설정(클라우드 공개 상태, 해시 채널, 페이지 버전) | — |
| `src/app/cloudcheck/_client/components/**`, `styles/**` | 컴포넌트개발자 | 관문 컴포넌트 5종(MaskedValue·DocLink·StatusBadge·CliBlock·PasteBox) 포함, 토큰·인쇄 CSS | — |
| `src/app/cloudcheck/_client/i18n/ko/components.ts` / `screens.ts` / `i18n/index.ts` | 컴포넌트개발자 / 페이지개발자 / 프론트팀장 | 화면 고정 문구만(엔진 코드의 문장은 `rules/i18n/ko.ts`) | — |
| `src/app/cloudcheck/_client/mocks/**` | 프론트팀장 | 손으로 만든 목업 Report A~D(모델 타입 기준) | — |
| `src/lib/cloudcheck/model/**` | **프론트팀장 + 백엔드팀장 공동(G0 동결)** | `report.ts`, `report.typetest.ts`, `banned-words.ts` | 전원 import만. 금지어 목록 변경은 기획팀장 확인 |
| `src/lib/cloudcheck/contract/**` | API설계자 | `calls.ts`, `collect-schema.ts`, `exceptions-schema.ts`(G0) + `normalized.ts`(D1, DB설계자와 합의) | DB설계자·프론트는 import만 |
| `src/lib/cloudcheck/parse/**` | API설계자 | recognize, JSON·CSV 파서, 정규화(buildInput, coverage·population 계산), 비밀 패턴 검사, 마스킹 사본, 예외 파일 읽기·쓰기, 누출 스캔 테스트 | — |
| `src/lib/cloudcheck/collector/**` | API설계자 | `cloudcheck-aws.sh`, `cloudcheck-azure.sh`, `SHA256SUMS`, `RELEASES.json`, 디렉터리 `.gitattributes`, `lint.ts`, `footprint.ts`, `__shims__`, `__scenarios__`, 테스트 | — |
| `src/lib/cloudcheck/engine/**` | DB설계자(백엔드팀장 코드 리뷰 필수) | proof, aggregate, judge, display(정리·마스킹), time, exceptions, compare | 프론트는 import만 |
| `src/lib/cloudcheck/rules/**` | DB설계자 | rule-schema, params, registry, catalog, 룰 18개 파일, `i18n/ko.ts`, version | 디자인이 문구 톤·금지어 검수 |
| `src/lib/cloudcheck/fixtures/**` | DB설계자(정답지는 QA 리뷰) | companies(4×2), micro, answers, `mutate.ts` | API설계자는 통합 테스트에서 읽기만 |
| `src/lib/cloudcheck/qa/**` | QA(STEP 5) | 속성 테스트, 렌더 금지어 검사 등 | 읽기 전용 |

**병렬 작업 규칙**
1. **G0 먼저**: 프론트팀장이 `model/` 3파일, API설계자가 `contract/` 3파일을 이 문서의 코드 그대로 만든다 → `npm run type-check` 통과 + 계약 스모크 테스트(§4-9) 통과 → 두 팀장과 백엔드팀장 확인 → 그다음 모두 착수한다.
2. **UI는 목업 Report로 먼저 간다.** 엔진이 준비되면(DB설계자 D5 이후) 실제 `judge()` 출력으로 바꾸고 같은 렌더 테스트를 통과시킨다.
3. **경로로 직접 import한다.** 공용 배럴 `index.ts`를 두지 않는다(같은 파일 동시 편집 방지).
4. **`_client` → lib import 허용 범위**: `model/*`, `contract/calls.ts`(발자국 표), 함수 진입점(§5-3), `rules/catalog.ts`, `rules/i18n/ko.ts`. lib → `_client` import는 금지다.
5. **공유 파일 수정 0**: `package.json`, lock, `tsconfig.json`, `vitest.config.ts`, `tailwind.config.ts`, `layout.tsx`, `providers.tsx`, `globals.css`, `vercel.json`. `next.config.*`와 `middleware.*`는 만들지 않는다.
6. **커밋은 에이전트가 하지 않는다**(메인 세션과 배포엔지니어만). `git add -A`는 금지다.
7. **모든 테스트는 vitest 자동 수집 위치**(`src/**/*.test.ts(x)`)에 둔다. RTL 테스트 파일 첫 줄에는 `// @vitest-environment jsdom`을 붙인다.

---

## 4. G0 동결 (a) — 수집 계약 v1.0

**소유·변경 규칙**: API설계자 소유. 변경은 백엔드팀장이 승인하고 프론트팀장에게 알린다. 동결 뒤에는 minor 추가만 허용한다(§4-8). 아래 코드는 스크래치패드에서 레포와 같은 조건(TypeScript 5.9.3, zod 3.25.76, strict·isolatedModules·target ES2017)으로 컴파일하고 실행 검증했다 [확인: 스크래치패드].

### 4-1. 호출 카탈로그 `src/lib/cloudcheck/contract/calls.ts`

```ts
// src/lib/cloudcheck/contract/calls.ts — 호출 카탈로그 v1.0
// 린터(L-05 완전 일치)·예상 발자국 표·권한 패널·영수증 call enum의 단일 원천.
// G0 동결. 소유: API설계자. 호출 추가·삭제는 수집기 릴리스 + 스키마 minor 증가 + 백엔드팀장 승인.
import type { DoorId } from "../model/report";

export type CallPhase = "identity" | "scope" | DoorId;
export type CallUnit = "account" | "region" | "user" | "group" | "bucket" | "trail" | "subscription" | "storage-account" | "local";
export interface CallMeta {
  readonly cli: string;                // 수집기 안의 명령(인자 제외)
  readonly permission: string | null;  // 요청할 권한 이름. AWS = IAM 액션, Azure = RBAC 작업. 필요 없으면 null
  readonly phases: readonly CallPhase[]; // 이 호출의 데이터를 쓰는 단계·문(발자국 표 표기용)
  readonly unit: CallUnit;             // 호출 단위(호출 횟수 추정용)
  readonly readOnly: boolean;          // false는 iam:GenerateCredentialReport 1건뿐(C-03 명시 예외)
}

/** AWS 26종. get-caller-identity를 뺀 25개 권한은 관리형 SecurityAudit에 포함 [확인: 백엔드팀장, 정책 문서 대조] */
export const AWS_CALLS = {
  "sts:GetCallerIdentity": { cli: "aws sts get-caller-identity", permission: null, phases: ["identity"], unit: "account", readOnly: true },
  "iam:ListAccountAliases": { cli: "aws iam list-account-aliases", permission: "iam:ListAccountAliases", phases: ["identity"], unit: "account", readOnly: true },
  "ec2:DescribeRegions": { cli: "aws ec2 describe-regions", permission: "ec2:DescribeRegions", phases: ["scope"], unit: "account", readOnly: true },
  "iam:GenerateCredentialReport": { cli: "aws iam generate-credential-report", permission: "iam:GenerateCredentialReport", phases: ["mfa", "key"], unit: "account", readOnly: false },
  "iam:GetCredentialReport": { cli: "aws iam get-credential-report", permission: "iam:GetCredentialReport", phases: ["mfa", "key"], unit: "account", readOnly: true },
  "iam:GetAccountSummary": { cli: "aws iam get-account-summary", permission: "iam:GetAccountSummary", phases: ["mfa", "key"], unit: "account", readOnly: true },
  "iam:ListUsers": { cli: "aws iam list-users", permission: "iam:ListUsers", phases: ["mfa", "key"], unit: "account", readOnly: true },
  "iam:ListAccessKeys": { cli: "aws iam list-access-keys", permission: "iam:ListAccessKeys", phases: ["key"], unit: "user", readOnly: true },
  "iam:ListMFADevices": { cli: "aws iam list-mfa-devices", permission: "iam:ListMFADevices", phases: ["mfa"], unit: "user", readOnly: true },
  "iam:ListAttachedUserPolicies": { cli: "aws iam list-attached-user-policies", permission: "iam:ListAttachedUserPolicies", phases: ["key"], unit: "user", readOnly: true },
  "iam:ListGroupsForUser": { cli: "aws iam list-groups-for-user", permission: "iam:ListGroupsForUser", phases: ["key"], unit: "user", readOnly: true },
  "iam:ListAttachedGroupPolicies": { cli: "aws iam list-attached-group-policies", permission: "iam:ListAttachedGroupPolicies", phases: ["key"], unit: "group", readOnly: true },
  "iam:ListRoles": { cli: "aws iam list-roles", permission: "iam:ListRoles", phases: ["key"], unit: "account", readOnly: true },
  "ec2:DescribeSecurityGroups": { cli: "aws ec2 describe-security-groups", permission: "ec2:DescribeSecurityGroups", phases: ["net"], unit: "region", readOnly: true },
  "ec2:DescribeNetworkInterfaces": { cli: "aws ec2 describe-network-interfaces", permission: "ec2:DescribeNetworkInterfaces", phases: ["net"], unit: "region", readOnly: true },
  "s3:GetAccountPublicAccessBlock": { cli: "aws s3control get-public-access-block", permission: "s3:GetAccountPublicAccessBlock", phases: ["sto"], unit: "account", readOnly: true },
  "s3:ListAllMyBuckets": { cli: "aws s3api list-buckets", permission: "s3:ListAllMyBuckets", phases: ["sto"], unit: "account", readOnly: true },
  "s3:GetBucketLocation": { cli: "aws s3api get-bucket-location", permission: "s3:GetBucketLocation", phases: ["sto"], unit: "bucket", readOnly: true },
  "s3:GetBucketPublicAccessBlock": { cli: "aws s3api get-public-access-block", permission: "s3:GetBucketPublicAccessBlock", phases: ["sto"], unit: "bucket", readOnly: true },
  "s3:GetBucketPolicyStatus": { cli: "aws s3api get-bucket-policy-status", permission: "s3:GetBucketPolicyStatus", phases: ["sto"], unit: "bucket", readOnly: true },
  "s3:GetBucketAcl": { cli: "aws s3api get-bucket-acl", permission: "s3:GetBucketAcl", phases: ["sto"], unit: "bucket", readOnly: true },
  "s3:GetBucketOwnershipControls": { cli: "aws s3api get-bucket-ownership-controls", permission: "s3:GetBucketOwnershipControls", phases: ["sto"], unit: "bucket", readOnly: true },
  "s3:GetBucketWebsite": { cli: "aws s3api get-bucket-website", permission: "s3:GetBucketWebsite", phases: ["sto"], unit: "bucket", readOnly: true },
  "cloudtrail:DescribeTrails": { cli: "aws cloudtrail describe-trails", permission: "cloudtrail:DescribeTrails", phases: ["log"], unit: "account", readOnly: true },
  "cloudtrail:GetTrailStatus": { cli: "aws cloudtrail get-trail-status", permission: "cloudtrail:GetTrailStatus", phases: ["log"], unit: "trail", readOnly: true },
  "cloudtrail:GetEventSelectors": { cli: "aws cloudtrail get-event-selectors", permission: "cloudtrail:GetEventSelectors", phases: ["log"], unit: "trail", readOnly: true },
} as const satisfies Record<string, CallMeta>;

/** Azure 9종. RBAC 작업 이름은 [일반 지식], 구독 Reader로 충분한지는 [미확인] → PM V1에서 확인.
 *  데이터 평면 명령(storage container list, storage blob 등)은 계정 키를 암묵 조회할 수 있어 금지(L-06). 관리 평면 container-rm만 쓴다 */
export const AZURE_CALLS = {
  "azure:account.show": { cli: "az account show", permission: null, phases: ["identity"], unit: "local", readOnly: true },
  "azure:account.list": { cli: "az account list", permission: "Microsoft.Resources/subscriptions/read", phases: ["scope"], unit: "account", readOnly: true },
  "azure:storage.account.list": { cli: "az storage account list", permission: "Microsoft.Storage/storageAccounts/read", phases: ["key", "sto", "log"], unit: "subscription", readOnly: true },
  "azure:storage.container-rm.list": { cli: "az storage container-rm list", permission: "Microsoft.Storage/storageAccounts/blobServices/containers/read", phases: ["sto"], unit: "storage-account", readOnly: true },
  "azure:monitor.diagnostic-settings.list": { cli: "az monitor diagnostic-settings list", permission: "Microsoft.Insights/diagnosticSettings/read", phases: ["log"], unit: "storage-account", readOnly: true },
  "azure:monitor.diagnostic-settings.subscription.list": { cli: "az monitor diagnostic-settings subscription list", permission: "Microsoft.Insights/diagnosticSettings/read", phases: ["log"], unit: "subscription", readOnly: true },
  "azure:network.nsg.list": { cli: "az network nsg list", permission: "Microsoft.Network/networkSecurityGroups/read", phases: ["net"], unit: "subscription", readOnly: true },
  "azure:network.nic.list": { cli: "az network nic list", permission: "Microsoft.Network/networkInterfaces/read", phases: ["net"], unit: "subscription", readOnly: true },
  "azure:network.public-ip.list": { cli: "az network public-ip list", permission: "Microsoft.Network/publicIPAddresses/read", phases: ["net"], unit: "subscription", readOnly: true },
} as const satisfies Record<string, CallMeta>;

export type AwsCall = keyof typeof AWS_CALLS;
export type AzureCall = keyof typeof AZURE_CALLS;
export const AWS_CALL_IDS = Object.keys(AWS_CALLS) as [AwsCall, ...AwsCall[]];
export const AZURE_CALL_IDS = Object.keys(AZURE_CALLS) as [AzureCall, ...AzureCall[]];
```

### 4-2. 수집 파일 스키마 `src/lib/cloudcheck/contract/collect-schema.ts`

```ts
// src/lib/cloudcheck/contract/collect-schema.ts — 수집 계약 v1.0 (수집기 → 페이지)
// G0 동결. 소유: API설계자(변경 승인: 백엔드팀장, 프론트팀장 통보).
// 버전: schema "cloudcheck.collect/<major>.<minor>". minor = 필드·섹션 추가만, major = 이름 변경·삭제·의미 변경.
// 원칙: P1 사실만(영수증 + 데이터, 집계값 없음) / P2 실패해도 {receipt, value:null} 슬롯 보존 / P3 외부 열거형은 문자열
//       / P4 비밀·식별자 최소화 / P5 accountId 전체 보존(마스킹은 표시 단계) / P6 시각은 엄격 파서로
// 이 파일은 '모양'만 검사한다. 영수증 참조 연결 검사·섹션별 safeParse·비밀 패턴 검사는 parse/ 단계(§4-5)가 한다.
import { z } from "zod";
import { DOORS } from "../model/report";
import { AWS_CALL_IDS, AZURE_CALL_IDS } from "./calls";

/* ---------- 버전·상한 ---------- */
export const SCHEMA_RE = /^cloudcheck\.collect\/(\d+)\.(\d+)$/;
export const SUPPORTED = { major: 1, maxMinor: 0 } as const;
/** 파싱 전에 거부하는 상한(UI·파서 공용) */
export const LIMITS = {
  jsonBytes: 25 * 1024 * 1024,   // 수집기 JSON(파일·붙여넣기)
  csvBytes: 20 * 1024 * 1024,    // CSV 파일
  jsonDepth: 32,                 // JSON 중첩 깊이(파싱 전 반복 스캔)
  receipts: 100_000,
  credentialCsvChars: 20_000_000,
} as const;

/* ---------- 원자 ---------- */
export const RESULTS = ["ok", "empty", "notconfigured", "denied", "error", "throttled", "truncated", "unsupported"] as const;
export const ReceiptResult = z.enum(RESULTS);
export const ReceiptId = z.string().regex(/^r-\d{4,6}$/);
/** 수집기가 직접 찍는 시각(date -u +%Y-%m-%dT%H:%M:%SZ): Z 고정, 소수 초 없음 */
export const StampZ = z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/);
/** 클라우드 API가 주는 UTC 시각: 소수 초 0~9자리, Z 또는 +00:00. 해석은 Date.parse가 아니라 자체 엄격 파서로 */
export const IsoUtc = z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{1,9})?(Z|[+-]00:00)$/);
const Uuid = z.string().regex(/^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/);
const AwsRegion = z.string().regex(/^[a-z]{2}(-[a-z]+)+-\d{1,2}$/);
/** Azure 리소스 ID. API가 경로 대소문자를 섞어 돌려주는 경우가 있어 대소문자를 무시한다 */
const AzId = z.string().max(2048).regex(/^\/subscriptions\/[0-9a-f-]{36}\/resourcegroups\/[^/]+\/providers\/.+$/i);
const Str = (max: number) => z.string().max(max);
const Door = z.enum(DOORS);

/** 증거 슬롯: 실패해도 슬롯은 남는다. value = null의 뜻은 영수증 result가 정한다(notconfigured = '설정 없음'이라는 유효한 답) */
const Ev = <T extends z.ZodTypeAny>(v: T) => z.object({ receipt: ReceiptId, value: v.nullable() }).strict();
/** 리소스가 많아 일부만 조회했을 때(예산 초과). 조회 못 한 리소스는 항목 영수증이 없으므로 확인 불가가 된다 */
const Budget = z.object({ limit: z.number().int().positive(), total: z.number().int().nonnegative(), collected: z.number().int().nonnegative() }).strict()
  .refine((b) => b.collected <= b.total && b.collected <= b.limit, "budget 모순");

/* ---------- 영수증 ---------- */
const receiptBase = {
  id: ReceiptId,
  region: z.union([z.literal("global"), AwsRegion]).optional(),
  subscription: Uuid.optional(),
  resource: Str(2048).nullable().optional(),
  result: ReceiptResult,
  count: z.number().int().nonnegative().nullable(),
  /** 코드 토큰만. 오류 메시지 원문(ARN·UPN·이메일 포함)은 저장하지 않는다 */
  errorCode: z.string().regex(/^[A-Za-z0-9._:-]{1,80}$/).nullable(),
  at: StampZ,
};
type R = { result: (typeof RESULTS)[number]; count: number | null; errorCode: string | null };
const receiptRules = (r: R, ctx: z.RefinementCtx) => {
  const bad = (m: string) => ctx.addIssue({ code: z.ZodIssueCode.custom, message: m });
  switch (r.result) {
    case "ok": if (r.errorCode !== null || (r.count !== null && r.count < 1)) bad("ok: errorCode=null, count=null|>=1"); break;
    case "empty": if (r.errorCode !== null || r.count !== 0) bad("empty: count=0"); break;
    case "truncated": if (r.errorCode !== null || r.count === null) bad("truncated: errorCode=null, 받은 만큼 count"); break;
    default: if (r.errorCode === null || r.count !== null) bad(`${r.result}: errorCode 필수, count=null`);
  }
};
export const AwsReceipt = z.object({ ...receiptBase, call: z.enum(AWS_CALL_IDS) }).strict().superRefine(receiptRules);
export const AzureReceipt = z.object({ ...receiptBase, call: z.enum(AZURE_CALL_IDS) }).strict().superRefine(receiptRules);

/* ---------- 공통 봉투 ---------- */
const Collector = z.object({
  name: z.enum(["cloudcheck-aws", "cloudcheck-azure"]),
  version: z.string().regex(/^\d+\.\d+\.\d+$/),
  sha256: z.string().regex(/^[0-9a-f]{64}$/).nullable(),   // 버전 확인용. 보안 증거가 아니다(INV-10)
  tools: z.object({ cli: Str(64).nullable(), jq: Str(32).nullable(), bash: Str(32).nullable() }).strict(),
}).strict();
const DoorStatus = z.enum(["collected", "skipped"]);   // skipped = --doors로 요청하지 않음. 수집 실패는 영수증으로 표현
const Run = z.object({
  finishedAt: StampZ,
  confirmed: z.enum(["interactive", "flag-yes"]),      // C-05 계정 확인: Enter(대화형) 또는 --yes
  doors: z.object({ mfa: DoorStatus, key: DoorStatus, net: DoorStatus, sto: DoorStatus, log: DoorStatus }).strict(),
}).strict();

/* ---------- AWS data ---------- */
const Pab = z.object({ blockPublicAcls: z.boolean(), ignorePublicAcls: z.boolean(), blockPublicPolicy: z.boolean(), restrictPublicBuckets: z.boolean() }).strict();
const PolicyArn = z.string().max(2048).regex(/^arn:aws[a-z-]*:iam::(aws|\d{12}):policy\//);
const AwsData = z.object({
  credentialReport: z.object({
    generateReceipt: ReceiptId,
    receipt: ReceiptId,
    /** C-07 명시 예외: 자격증명 보고서 CSV 원문(23열, 비밀 열 없음). 열 allowlist는 정규화 단계에서 적용 */
    value: z.object({ generatedTime: IsoUtc, format: z.literal("text/csv"), csv: z.string().max(LIMITS.credentialCsvChars) }).strict().nullable(),
  }).strict(),
  accountSummary: Ev(z.object({
    Users: z.number().int().optional(), Groups: z.number().int().optional(), Roles: z.number().int().optional(),
    AccountMFAEnabled: z.number().int().optional(), AccountAccessKeysPresent: z.number().int().optional(),
    AccountSigningCertificatesPresent: z.number().int().optional(), MFADevicesInUse: z.number().int().optional(),
  }).strict()),
  iamUsers: z.object({
    receipt: ReceiptId, budget: Budget,
    items: z.array(z.object({
      userName: Str(128), createDate: IsoUtc, passwordLastUsed: IsoUtc.nullable(),
      /** 키 ID는 끝 4자리만(전체 ID는 수집기 프로세스 밖으로 나오지 않는다) */
      accessKeys: Ev(z.array(z.object({ status: Str(32), createDate: IsoUtc, idSuffix: z.string().regex(/^[A-Z0-9]{4}$/) }).strict())),
      mfaDevices: Ev(z.object({ count: z.number().int().nonnegative() }).strict()),
      attachedPolicyArns: Ev(z.array(PolicyArn)),
      groupNames: Ev(z.array(Str(128))),
    }).strict()).nullable(),
  }).strict(),
  iamGroups: z.array(z.object({ groupName: Str(128), attachedPolicyArns: Ev(z.array(PolicyArn)) }).strict()),
  iamRoles: Ev(z.array(z.object({
    roleName: Str(64), path: Str(512), createDate: IsoUtc,
    trust: z.array(z.object({
      effect: Str(16), actions: z.array(Str(128)), notPrincipal: z.boolean(),
      principal: z.object({ wildcard: z.boolean(), aws: z.array(Str(2048)), service: z.array(Str(256)), federated: z.array(Str(2048)), canonicalUserCount: z.number().int().nonnegative() }).strict(),
      conditionKeys: z.array(Str(256)),   // "StringEquals:sts:ExternalId" 형태. 조건 값은 수집하지 않는다
    }).strict()).nullable(),               // null = 신뢰 정책 형태를 해석하지 못함 → 그 역할만 확인 불가
  }).strict())),
  securityGroups: z.array(z.object({
    region: AwsRegion, receipt: ReceiptId,
    items: z.array(z.object({
      groupId: z.string().regex(/^sg-[0-9a-f]+$/), groupName: Str(255), vpcId: Str(64).nullable(),
      ingress: z.array(z.object({
        protocol: Str(16), fromPort: z.number().int().nullable(), toPort: z.number().int().nullable(),
        cidrs: z.array(Str(64)), ipv6Cidrs: z.array(Str(64)), prefixListIds: z.array(Str(64)), sgRefCount: z.number().int().nonnegative(),
      }).strict()),
    }).strict()).nullable(),
  }).strict()),
  networkInterfaces: z.array(z.object({
    region: AwsRegion, receipt: ReceiptId,
    items: z.array(z.object({
      eniId: z.string().regex(/^eni-[0-9a-f]+$/), groupIds: z.array(Str(64)),
      hasPublicIp: z.boolean(), hasIpv6: z.boolean(),   // IP 값 자체는 수집하지 않는다(있음/없음, 모름 = 영수증 실패)
      interfaceType: Str(64).nullable(), status: Str(32).nullable(), requesterManaged: z.boolean(),
    }).strict()).nullable(),
  }).strict()),
  accountPublicAccessBlock: Ev(Pab),
  buckets: z.object({
    receipt: ReceiptId, budget: Budget,
    items: z.array(z.object({
      name: z.string().min(3).max(63), createDate: IsoUtc.nullable(),
      region: z.object({ value: AwsRegion.nullable(), source: z.enum(["list", "location"]), receipt: ReceiptId.nullable() }).strict(),
      publicAccessBlock: Ev(Pab),
      policyStatus: Ev(z.object({ isPublic: z.boolean() }).strict()),
      acl: Ev(z.object({ publicGrants: z.array(z.object({ grantee: z.enum(["AllUsers", "AuthenticatedUsers"]), permission: Str(32) }).strict()) }).strict()),
      ownership: Ev(z.object({ objectOwnership: Str(64) }).strict()),
      website: Ev(z.object({ enabled: z.literal(true) }).strict()),
    }).strict()).nullable(),
  }).strict(),
  trails: Ev(z.array(z.object({
    name: Str(128), trailArn: Str(2048), homeRegion: AwsRegion,
    isMultiRegion: z.boolean(), isOrganizationTrail: z.boolean(), logFileValidationEnabled: z.boolean(),
    hasCloudWatchLogs: z.boolean(), hasCustomEventSelectors: z.boolean(),
    status: Ev(z.object({ isLogging: z.boolean(), hasDeliveryError: z.boolean() }).strict()),
    selectors: Ev(z.object({
      basic: z.array(z.object({ readWriteType: Str(16), includeManagementEvents: z.boolean() }).strict()),
      advanced: z.array(z.object({ fields: z.array(z.object({ field: Str(64), equals: z.array(Str(64)) }).strict()) }).strict()),
    }).strict()),
  }).strict())),
}).partial().strict();   // 실행하지 않은 문의 섹션은 없다(= 미수집)

/* ---------- Azure data ---------- */
const DiagSetting = z.object({
  name: Str(260),
  logs: z.array(z.object({ category: Str(64).nullable(), categoryGroup: Str(64).nullable(), enabled: z.boolean() }).strict()),
  destinations: z.object({ workspace: z.boolean(), storage: z.boolean(), eventHub: z.boolean(), partner: z.boolean() }).strict(),
}).strict();
const BySub = <T extends z.ZodTypeAny>(item: T) => z.object({ subscription: Uuid, receipt: ReceiptId, items: z.array(item).nullable() }).strict();
const AzureData = z.object({
  storageAccounts: z.array(z.object({
    subscription: Uuid, receipt: ReceiptId, budget: Budget,
    items: z.array(z.object({
      id: AzId, name: z.string().min(3).max(24), kind: Str(32).nullable(), location: Str(64),
      allowBlobPublicAccess: z.boolean().nullable(),   // null = 미설정(차단 아님 → 주의)
      allowSharedKeyAccess: z.boolean().nullable(),
      keyCreationTime: z.object({ key1: IsoUtc.nullable(), key2: IsoUtc.nullable() }).strict().nullable(),
      keyExpirationPeriodInDays: z.number().int().positive().nullable(),
      sasExpirationPeriod: Str(32).nullable(),
      publicNetworkAccess: Str(32).nullable(), networkDefaultAction: Str(16).nullable(),
      containers: Ev(z.array(z.object({ name: Str(63), publicAccess: Str(16).nullable() }).strict())),
      blobDiagnostics: Ev(z.array(DiagSetting)),
    }).strict()).nullable(),
  }).strict()),
  activityLogExports: z.array(BySub(DiagSetting)),
  nsgs: z.array(BySub(z.object({
    id: AzId, name: Str(80), location: Str(64),
    rules: z.array(z.object({
      name: Str(80), direction: Str(16), access: Str(16), priority: z.number().int(), protocol: Str(8),
      sourcePrefixes: z.array(Str(128)), sourceAsgCount: z.number().int().nonnegative(), destPortRanges: z.array(Str(32)),
    }).strict()),
    nicIds: z.array(AzId), subnetIds: z.array(AzId),
  }).strict())),
  nics: z.array(BySub(z.object({ id: AzId, nsgId: AzId.nullable(), ipConfigs: z.array(z.object({ subnetId: AzId.nullable(), publicIpId: AzId.nullable() }).strict()) }).strict())),
  publicIps: z.array(BySub(z.object({ id: AzId, hasAddress: z.boolean(), allocationMethod: Str(16).nullable(), attachedTo: Str(2048).nullable() }).strict())),
}).partial().strict();

/* ---------- 파일 ---------- */
const envelope = { schema: z.string().regex(SCHEMA_RE), collector: Collector, collectedAt: StampZ, run: Run };
export const AwsCollectFile = z.object({
  ...envelope, cloud: z.literal("aws"),
  identity: z.object({
    receipt: ReceiptId,
    accountId: z.string().regex(/^\d{12}$/),   // 전체 보존(KEY-4 외부 계정 판정, Before/After, 실행 식별). 마스킹은 표시·내보내기에서
    partition: z.literal("aws"),               // MVP는 상용 파티션만(aws-cn·aws-us-gov는 수집기가 중단 안내)
    principalType: z.enum(["user", "assumed-role", "root", "federated-user", "unknown"]),
    principalName: Str(128).nullable(),        // 사용자명 또는 역할명. 세션명(대개 이메일)은 버린다
    alias: Ev(Str(63)),
  }).strict(),
  scope: z.object({ regions: Ev(z.array(AwsRegion)), regionsRequested: z.array(AwsRegion).nullable() }).strict(),
  receipts: z.array(AwsReceipt).max(LIMITS.receipts),
  data: AwsData,
}).strict();
export const AzureCollectFile = z.object({
  ...envelope, cloud: z.literal("azure"),
  identity: z.object({
    receipt: ReceiptId, tenantId: Uuid, currentSubscription: Uuid, cloudName: Str(32),
    principalType: z.enum(["user", "servicePrincipal", "managedIdentity", "unknown"]),   // UPN은 수집하지 않는다
  }).strict(),
  scope: z.object({
    subscriptions: Ev(z.array(z.object({
      id: Uuid, name: Str(256), state: Str(32), tenantId: Uuid, inScope: z.boolean(),
      outOfScopeReason: z.enum(["other-tenant", "not-enabled", "not-requested"]).nullable(),
    }).strict())),
    subscriptionsRequested: z.array(Uuid).nullable(),
  }).strict(),
  receipts: z.array(AzureReceipt).max(LIMITS.receipts),
  data: AzureData,
}).strict();
export const CollectFile = z.discriminatedUnion("cloud", [AwsCollectFile, AzureCollectFile]);
export type CollectFile = z.infer<typeof CollectFile>;
export type AwsCollect = z.infer<typeof AwsCollectFile>;
export type AzureCollect = z.infer<typeof AzureCollectFile>;
export type CollectDoor = z.infer<typeof Door>;
/** 실행 식별 키(분할 수집 병합·중복 제거용). run.id 필드를 두지 않고 (cloud, 계정·테넌트, collectedAt)으로 식별한다 */
export const runKey = (f: CollectFile): string =>
  `${f.cloud}|${f.cloud === "aws" ? f.identity.accountId : f.identity.tenantId.toLowerCase()}|${f.collectedAt}`;
```

### 4-3. 예외 파일 스키마 `src/lib/cloudcheck/contract/exceptions-schema.ts`

```ts
// src/lib/cloudcheck/contract/exceptions-schema.ts — 예외 파일 v1.0 (cloudcheck-exceptions.json, 사용자 로컬 파일)
// G0 동결. 소유: API설계자. 예외는 상태를 바꾸지 않고 라벨만 붙인다(INV-8, R-10). judge()의 입력이 아니다.
// 이 파일은 다음 점검에서 다시 맞춰 보려고 실제 MatchKey(리소스 이름 포함)를 담는다. 마스킹 기본값(R-13)의 예외이며 UI가 그 사실을 고지한다.
import { z } from "zod";
import { RULE_IDS } from "../model/report";

export const EXCEPTIONS_SCHEMA_ID = "cloudcheck.exceptions/1.0" as const;
/** 예외 최대 기간(도구 기준) */
export const EXCEPTION_MAX_DAYS = 90;
const IsoDate = z.string().regex(/^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/);
const dayNumber = (d: string): number => Date.UTC(Number(d.slice(0, 4)), Number(d.slice(5, 7)) - 1, Number(d.slice(8, 10))) / 86_400_000;

export const ExceptionEntry = z.object({
  ruleId: z.enum(RULE_IDS),
  resource: z.string().min(1).max(1024),       // MatchKey: <cloud>|<계정·테넌트>|<ResourceType>|<위치 또는 ->|<고유 ID>
  reason: z.string().trim().min(1).max(500),   // 사유 필수
  until: IsoDate,                              // 만료일 필수. 만료 판정은 overlayExceptions(report, file, today)가 한다
  createdAt: IsoDate,
}).strict().superRefine((e, ctx) => {
  const span = dayNumber(e.until) - dayNumber(e.createdAt);
  if (!(span >= 1 && span <= EXCEPTION_MAX_DAYS)) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: `until은 createdAt 다음 날부터 ${EXCEPTION_MAX_DAYS}일 이내` });
  }
});
export const ExceptionsFile = z.object({
  schema: z.literal(EXCEPTIONS_SCHEMA_ID),
  entries: z.array(ExceptionEntry).max(1000),
}).strict();
export type ExceptionsFile = z.infer<typeof ExceptionsFile>;
export type ExceptionEntry = z.infer<typeof ExceptionEntry>;
```

### 4-4. 영수증 결과 코드와 CLI 오류 매핑

| result | 뜻 | count | errorCode | 판정에서의 뜻 |
|---|---|---|---|---|
| ok | 종료 0, JSON 객체, 투영 성공, 목록 1건 이상(단건 조회는 count = null) | null 또는 1 이상 | null | 증거 |
| empty | 위와 같지만 목록 길이 0 | 0 | null | 완결된 '없음'. 모수 0 증명의 재료 |
| notconfigured | "설정 없음" 오류 응답 | null | 필수 | **유효한 답**(INV-6) |
| denied | 권한 거부 | null | 필수 | 답이 아님. 같은 계열의 다른 리소스가 성공했으면 INV-7(주의) |
| throttled | CLI 재시도 뒤에도 한도 초과 | null | 필수 | 답이 아님 |
| truncated | 응답에 다음 페이지 토큰이 남음 | 받은 수 | null | 양성은 유효, '없음'은 불가 |
| unsupported | 리전·CLI 버전·리소스 종류 때문에 불가 | null | 필수 | 답이 아님 |
| error | 그 밖의 전부(합성 코드 포함) | null | 필수 | 답이 아님 |

예산 초과(리소스가 많아 일부만 조회)는 영수증이 아니라 섹션의 `budget{limit,total,collected}`로 표기한다. 조회하지 못한 리소스는 항목 영수증이 없으므로 확인 불가가 되고, 룰 수준의 '없음'은 줄 수 없다.

**AWS**: stderr의 `An error occurred (CODE)`에서 CODE만 뽑는다. 종료 코드는 252 문법·미지 파라미터, 253 설정·자격증명, 254 서비스 오류, 255 일반이다 [확인: 백엔드, AWS CLI 문서].

| result | 코드 |
|---|---|
| denied | AccessDenied, AccessDeniedException, UnauthorizedOperation, UnauthorizedAccess, AuthFailure, AllAccessDisabled |
| notconfigured | NoSuchPublicAccessBlockConfiguration [확인: 기획서 인용], NoSuchBucketPolicy, NoSuchWebsiteConfiguration, OwnershipControlsNotFoundError [일반 지식 → PM V1에서 실측] |
| throttled | Throttling, ThrottlingException, ThrottledException, RequestLimitExceeded, RequestThrottled(Exception), SlowDown, TooManyRequestsException |
| unsupported | OptInRequired, InvalidAction, UnsupportedOperation, UnknownOperationException, NotImplemented, 종료 코드 252·2 |
| error | ExpiredToken, InvalidClientTokenId, SignatureDoesNotMatch, RequestExpired, ServiceFailure, InternalError, ServiceUnavailable, NoSuchBucket, PermanentRedirect, AuthorizationHeaderMalformed, 폴링 뒤의 ReportExpired·ReportInProgress·ReportNotPresent, LimitExceeded, 종료 코드 253·255, 합성 `output-not-json`·`transform-failed`·`report-timeout`·`cli-exit-N` |
| truncated | 합성: 응답 어디든 NextToken·ContinuationToken·Marker가 남거나 IsTruncated = true |

**Azure**: 추출 순서는 `Code: X` → `ERROR: (X)` → `AADSTS\d+` → "az login" 문구 → `cli-exit-N`이다. 문구 형식은 [일반 지식]이라 PM V1에서 실측한다.

| result | 코드 |
|---|---|
| denied | AuthorizationFailed, LinkedAuthorizationFailed, AuthorizationPermissionMismatch, Forbidden, InvalidAuthenticationTokenTenant |
| throttled | TooManyRequests, SubscriptionRequestsThrottled, ResourceRequestsThrottled, TenantRequestsThrottled |
| unsupported | MissingSubscriptionRegistration, FeatureNotSupportedForAccount, NoRegisteredProviderFound, InvalidResourceType, 종료 코드 2 |
| notconfigured | MVP에서는 쓰지 않음(목록 호출은 '없음'을 빈 배열로 준다 → empty) |
| error | ExpiredAuthenticationToken, InvalidAuthenticationToken, AADSTS*, `not-logged-in`, SubscriptionNotFound, ResourceNotFound, ResourceGroupNotFound, 종료 코드 1·3, 합성 코드 |
| truncated | 예산 초과만 해당(az list는 nextLink를 끝까지 따른다 [일반 지식]) |

### 4-5. 파싱 절차와 무결성 연결

1. **크기**: UI가 `file.size`로 LIMITS를 먼저 본다(JSON 25 MB, CSV 20 MB). 넘으면 `too-large`.
2. **인코딩**: `TextDecoder('utf-8', { fatal: true })`로 읽는다. 실패하면 `wrong-type`(잘못된 인코딩).
3. **종류 판별**: JSON, 지원 CSV, 키 파일(`aws_access_key_id`, `AWS_SECRET_ACCESS_KEY=`, `-----BEGIN` 등)을 가린다. 키 파일이면 `credentials-file`로 **거부**하고, 화면에 그리지 않고, 입력칸을 비운다.
4. **JSON**: 깊이를 반복 스캔한다(32 초과면 `too-deep`) → `JSON.parse`(실패하면 `parse-error`. 줄·칸·잘림 추정을 detail에 넣는다).
5. **스키마 우선**: 최상위가 객체이고 `schema`가 SCHEMA_RE에 맞는지 본다. 아니면 `not-cloudcheck`. 메이저가 1이 아니면 `schema-major`이고 **리포트를 만들지 않는다**.
6. **봉투 검증**(schema, collector, collectedAt, run, cloud, identity, scope, receipts). 실패하거나 영수증 ID가 중복되면 파일 전체를 거부한다(`not-cloudcheck`).
7. **data 섹션은 섹션마다 따로 `safeParse`**한다. minor가 같거나 낮으면 strict, 높으면 strip이다(`makeSchemas('strict' | 'strip')` 팩토리. 받아들이는 모양은 이 문서의 strict 스키마와 같아야 한다). 실패한 섹션의 문만 확인 불가(`schema-unsupported`) + `areas-not-judged` 배너다.
8. **연결 검사**: ① 모든 `receipt` 참조가 존재하고, call·region·resource가 섹션의 기대와 맞아야 한다. ② 실패 영수증 아래에 데이터가 있으면 모순이므로 섹션 무효. ③ ok·empty 영수증에 대응하는 데이터가 없으면 `field-missing`.
9. **비밀 패턴 검사(R-12)**: 우리 수집기는 키 ID 전체(`AKIA…`)를 출력하지 않는다. 감지되면 그 값은 `redacted`로 바꾸고 `secrets-detected` 배너("수정되었거나 다른 도구로 만든 파일일 수 있습니다")를 띄운다.
10. 외부 문자열을 키로 쓰는 조회는 전부 `Map`으로 한다(IAM 사용자명 `__proto__` 대비).

### 4-6. data 섹션 허용 필드(allowlist)

- **AWS**: identity(계정 ID·파티션·주체 유형·주체 이름·별칭, ARN 세션명과 UserId는 버림) / 활성 리전 / 자격증명 보고서 **CSV 원문**(C-07 명시 예외: 경로 ①과 같은 산출물, 비밀 열 없음, 쉼표 포함 사용자명 때문에 TS 파서 하나로 처리, 룰이 늘어도 수집기 해시 불변) / 계정 요약 7개 키 / IAM 사용자(이름, 생성일, 비밀번호 마지막 사용, 키 {상태, 생성일, 끝 4자리}, MFA 장치 수, 붙은 정책 ARN, 그룹 이름) / 그룹 정책 ARN / 역할 신뢰 정책의 Principal 값·Condition 키 이름(조건 값·정책 전문 없음) / 보안 그룹 인바운드(프로토콜, 포트, CIDR, IPv6 CIDR, 프리픽스 리스트 ID, SG 참조 수) / ENI(그룹, 공인 IP 있음·없음, IPv6 있음·없음, 유형, 상태) / 계정·버킷 공개 차단 4개 / 버킷(이름, 생성일, 리전, 정책 상태 IsPublic, ACL의 AllUsers·AuthenticatedUsers 부여만, 소유권 설정, 웹사이트 켜짐) / trail(이름, ARN, 홈 리전, 다중 리전, 조직 trail, 로그 검증, CloudWatch 연결, 상태, 이벤트 선택기).
- **Azure**: identity(테넌트, 현재 구독, 클라우드 이름, 주체 유형. UPN·표시명·object id 없음) / 구독(ID, 이름, 상태, 테넌트, 범위 안, 범위 밖 사유) / 스토리지 계정(ID, 이름, 종류, 위치, allowBlobPublicAccess, allowSharedKeyAccess, keyCreationTime, keyPolicy·sasPolicy 기간, 공용 네트워크, 기본 동작, 컨테이너 {이름, 공개 수준}, Blob 진단 설정) / 구독 활동 로그 내보내기 / NSG(규칙의 방향·허용·우선순위·프로토콜·출발지·ASG 수·목적지 포트, 연결 NIC·서브넷) / NIC(NSG, IP 구성의 서브넷·공인 IP ID) / 공인 IP(주소 있음·없음, 할당 방식, 연결 대상). `categoryGroup`(audit, allLogs)도 받는다. 범주 그룹과 범주의 매핑은 [미확인] → DB설계자가 문서로 확인한다.
- **버리는 것(공통)**: 태그, 설명, 오류 메시지 원문, 정책 전문, IP·MAC 값, 키 값(애초에 읽지 않는다), 엔드포인트.

### 4-7. CSV 정규화 규칙

**자격증명 보고서 → `IamCredentialRow[]`**(경로 ①·② 공용 파서)
- RFC 4180(따옴표, 이스케이프된 따옴표, CRLF·LF), BOM 제거, 열은 **헤더 이름**으로 매핑한다. 행의 필드 수가 헤더와 다르면 그 행은 `csv-row-ambiguous`(확인 불가)이고 그 출처의 `scopeProven`은 false다. 추측해서 맞추지 않는다.
- 필수 열: `user`, `arn`, `user_creation_time`, `password_enabled`, `password_last_used`, `mfa_active`, `access_key_1·2_active / _last_rotated / _last_used_date`. 하나라도 없으면 그 출처 전체가 `field-missing`이다.
- 값 해석: `password_enabled`·`mfa_active`는 TRUE·FALSE 외에는 unknown(`not_supported` 포함). `password_last_used`의 `no_information`은 미사용 또는 2014-10-20 이전, `N/A`는 비밀번호 없음이다. `last_used`의 `N/A`는 키 없음·미사용·2015-04-22 이전이다 [확인: 백엔드, AWS IAM 문서]. `additional_credentials_info`에 값이 있으면 3번째 키부터 확인 불가다. 열 자체가 없을 때 CSV만으로 이상 없음을 줄지는 [미확인]이므로 기본은 fail-closed(KEY-1·KEY-2 이상 없음 불가)이고, PM V1에서 실제 열 구성을 보고 정한다.
- `scopeProven = true` 조건: 헤더 유효 + 모든 행 파싱 + 루트 행 존재. 수집기 경로에서는 여기에 더해 IAM 사용자 행 수 = `accountSummary.Users`여야 한다(다르면 보고서 생성 뒤 사용자가 바뀐 것).
- 수집기 경로의 사실 우선순위: MFA 유무 = `list-mfa-devices` > 보고서 / 키 상태·생성일 = `list-access-keys`(3번째 키 이상 포함) > 보고서 / 키 마지막 사용 = 보고서(슬롯을 last_rotated와 CreateDate로 조인) / 비밀번호 마지막 사용 = `list-users` > 보고서 / 루트 MFA·키 = 보고서 루트 행, `get-account-summary`와 불일치하면 확인 불가.
- 기준 시각: 수집기 경로는 `collectedAt`이고 보고서 신선도 조건은 `collectedAt - generatedTime ≤ 4시간 5분`이다(4시간 캐시 [확인: AWS 문서]). CSV 경로는 파일 이름에 시각이 있으면 그 시각, 없으면 `File.lastModified`이고, 고른 값과 출처를 NormalizedInput에 고정한다(INV-9). 이때 `collected-at-approximate` 배너("보고서는 최대 4시간 전 상태일 수 있습니다")를 띄운다. 콘솔 CSV에 생성 시각이 들어 있는지는 [미확인] → PM V1.

**Resource Graph CSV → 같은 내부 모델, `scopeProven = false` 고정**(권한 없는 리소스를 표시 없이 빼기 때문 [확인: 기획서]). 아래 열 구성은 [미확인]이며 PM이 Explorer에서 확인한다.

```kusto
// cc-rg-storage/1
resources
| where type =~ 'microsoft.storage/storageaccounts'
| project ccQuery='cc-rg-storage/1', tenantId, id, subscriptionId, resourceGroup, name, kind, location,
  allowBlobPublicAccess=tostring(properties.allowBlobPublicAccess),
  allowSharedKeyAccess=tostring(properties.allowSharedKeyAccess),
  key1CreationTime=tostring(properties.keyCreationTime.key1),
  key2CreationTime=tostring(properties.keyCreationTime.key2),
  keyExpirationPeriodInDays=tostring(properties.keyPolicy.keyExpirationPeriodInDays),
  sasExpirationPeriod=tostring(properties.sasPolicy.sasExpirationPeriod)
| order by id asc

// cc-rg-nsg/1  (규칙을 펼침)
resources
| where type =~ 'microsoft.network/networksecuritygroups'
| mv-expand rule = properties.securityRules
| project ccQuery='cc-rg-nsg/1', tenantId, nsgId=id, subscriptionId, nsgName=name, location,
  ruleName=tostring(rule.name), direction=tostring(rule.properties.direction),
  access=tostring(rule.properties.access), priority=toint(rule.properties.priority),
  protocol=tostring(rule.properties.protocol),
  sourcePrefix=tostring(rule.properties.sourceAddressPrefix), sourcePrefixes=tostring(rule.properties.sourceAddressPrefixes),
  destPortRange=tostring(rule.properties.destinationPortRange), destPortRanges=tostring(rule.properties.destinationPortRanges),
  nicCount=array_length(properties.networkInterfaces), subnetCount=array_length(properties.subnets)
```

- `ccQuery` 상수 열로 우리 쿼리의 버전을 확인한다. 열이 없거나 버전이 다르면 확인 불가다(INV-10).
- 불리언은 대소문자를 무시하고, 빈 칸은 null이다(allowBlobPublicAccess의 null은 "미설정 = 차단 아님" → 주의). 행 수가 CSV 한도에 닿으면 잘림 배너를 띄운다(한도는 [미확인] 파라미터).
- CSV 경로의 문 판정 수준은 `findings-only`다. **AZ-NET-1은 공인 IP 연결을 알 수 없으므로 CSV 경로에서 최고 주의**다.

### 4-8. 스키마 버전 정책과 다중 입력 병합

- `schema: "cloudcheck.collect/<major>.<minor>"`. 수집기 버전(semver)과는 별개다. patch = 주석만(출력 같음, 해시는 바뀜), minor = 필드·섹션 추가만, major = 이름 변경·삭제·의미 변경. 판정기는 `{major: 1, maxMinor: N}`을 지원한다. 파일 minor가 더 크면 알려진 필드만 쓰고 `schema-newer-minor` 배너를, 더 작으면 없는 섹션을 미수집으로 처리한다. 룰(판정 로직)을 바꿔도 스키마는 그대로다.
- **실행 식별**: `runKey = cloud | 계정 ID(Azure는 테넌트 ID 소문자) | collectedAt`. 같은 runKey가 두 번 들어오면 뒤의 것은 `superseded`.
- **병합 조건**: 한 리포트의 모든 입력은 클라우드와 계정(테넌트)이 같아야 한다. 다르면 `account-mismatch`·`cloud-mismatch`로 빼고 두 신원을 나란히 보여 준다.
- **문 단위 선택**: 문마다 그 문을 담은 입력 하나만 쓴다. 우선순위는 ① 수집기 JSON > CSV, ② 같은 종류끼리는 기준 시각이 최신인 것이다. 고르지 못한 입력의 그 문은 `superseded`이고, 하나도 쓰이지 않은 입력이 있으면 `duplicate-input-ignored` 배너를 띄운다. 문-입력 대응: 수집기 JSON = `run.doors`의 collected / 자격증명 CSV = mfa·key / `cc-rg-storage` = key·sto / `cc-rg-nsg` = net / Entra 등록 CSV = mfa(AZ-MFA-1 편입 시).
- 룰은 자기 문의 입력만 읽고, 그 입력의 기준 시각을 쓴다(IAM 보고서 기반 룰은 보고서 생성 시각). 문마다 시각이 다르면 리포트 머리는 `asOfRange`를 보여 준다.
- `--doors`로 나눠 실행한 결과를 각각 붙여 넣는 것이 디자인 F1-b(붙여넣기 분할)의 구현이다. 한 실행의 출력을 조각으로 나누는 기능은 만들지 않는다.

### 4-9. 계약 스모크 테스트(G0 통과 조건)

스크래치패드에서 아래 40개 케이스를 실행해 모두 기대대로였다 [확인: 스크래치패드]. API설계자는 G0에서 같은 케이스로 `contract/collect-schema.test.ts`, `contract/exceptions-schema.test.ts`를, 프론트팀장은 `model/banned-words.test.ts`를 만든다.

- **받아야 함**: 정상 AWS 파일(IAM 사용자명 `__proto__`, ok·empty·denied·notconfigured·truncated 혼합) / 정상 Azure 파일(리소스 ID 경로가 `resourcegroups` 소문자) / 스키마 2.0 파일의 모양 통과(메이저 거부는 파싱 단계 일) / 정상 예외 파일.
- **거부해야 함**: collectedAt이 `+00:00` / 영수증 at에 소수 초 / ok인데 errorCode / denied인데 코드 없음 / empty인데 count 3 / truncated인데 errorCode / 카탈로그 밖 호출(`secretsmanager:GetSecretValue`) / AWS 파일 안의 Azure 호출 / data 항목의 추가 필드(Tags) / 모르는 data 섹션 / budget 모순 / 12자리가 아닌 계정 ID / 키 ID 전체(`AKIAIOSFODNN7EXAMPLE`)를 끝 4자리 자리에 넣음 / `run.doors`에서 문 하나 누락 / 파티션 aws-cn / Azure 잘못된 리소스 ID / 예외: 공백 사유, 90일 초과, until이 createdAt보다 앞섬, 없는 룰 ID, 옛 `version` 키.
- **값 검사**: runKey 형식, 카탈로그 26·9종, 비조회 호출은 `iam:GenerateCredentialReport` 1건뿐, 룰 ID 18개, SUPPORTED가 메이저 2를 거부.
- **금지어**: "다단계 인증", "Entra ID 인증 방법", "서명 인증서" → 0건 / "보안 인증을 받은" → 인증 / "문단속 끝! 안전합니다" → 완료·안전 / "5분이면 점검 완료" → 시간 약속·완료 / "24시간 초과 · 7일 초과" → 0건 / 분포 문장 → 0건 / "네트워크 통과" → 통과 / "어디에도 전송되지 않았습니다" → 무전송 과장 / "OK" → OK.

---

## 5. G0 동결 (b) — 판정 결과 모델 v1

### 5-1. 세 초안을 합친 방식

| 영역 | 채택 | 출처 |
|---|---|---|
| 골격 | 판별 유니온으로 상태별 필수 정보를 컴파일 단계에서 강제. 이상 없음 = `ProvenCoverage` + `AsOf`, 해당 없음 = 모수 0, 확인 불가 = 공통 사유 + gaps + 해소법 | 프론트 초안 + 백엔드 ScopeProof |
| 사용자 데이터 | `DisplayValue`(plain·sensitive{full, masked}·redacted) 단일 통로 | 프론트 초안 + 디자인 {full, masked} |
| 문구 | 코드 + 파라미터만(`MsgRef`). 엔진 출력에 문장 없음 | 디자인 원칙 1 |
| 기준 시각·범위 | 모든 점검에 `asOf`·`coverage`. 문마다 `DoorCollection{status, judgeLevel, reason, asOf}` | 디자인 evidenceAsOf·scopeTag·doorCollection |
| 먼저 볼 3개·권한 해제 | 엔진이 계산(`firstLook`, `permissions.unlockHints`) → 정답지로 검사 가능 | 디자인 원칙 5 |
| 직접 볼 목록 | `ManualCheckItem{origin, door, what, why, howKey, resolution}` | 프론트 + 디자인 F |
| 비교·입력 인식 | `Comparison`, `InputRecognition`(V2), `TimeNotice`, `ExceptionOverlay` | 디자인 G·H + 이번 결정 B·C |
| 정적 룰 데이터 | `RuleCatalogEntry`(V7·V4 공용) | 결정 D |
| 안정 키 | `MatchKey` = `<cloud>\|<계정·테넌트>\|<ResourceType>\|<위치 또는 ->\|<고유 ID>` | 디자인 원칙 3 |

### 5-2. `src/lib/cloudcheck/model/report.ts`

**소유·변경 규칙**: 프론트팀장 + 백엔드팀장 공동 소유. 선택 필드 추가는 두 팀장 합의로 한다. 이름·의미 변경과 삭제는 기획팀장 확인과 `REPORT_MODEL` 메이저 증가가 필요하다. 엔진 쪽 산출 구현은 DB설계자가 맡는다.

```ts
// src/lib/cloudcheck/model/report.ts — 판정 결과 모델 v1 (엔진 → UI 계약)
// G0 동결: docs/planning/project-direction-cloudcheck.md §5-2. 소유: 프론트팀장 + 백엔드팀장 공동.
// 변경 규칙: 선택 필드 추가는 두 팀장 합의. 이름·의미 변경과 삭제는 기획팀장 확인 + REPORT_MODEL 메이저 증가.
// 원칙
//  1) 직렬화 가능한 순수 데이터. Report = judge(input). 현재 시각·예외 파일·본인 응답은 judge의 입력이 아니다(INV-8, INV-9).
//  2) 문장 없음. 화면 문구는 코드 + 파라미터로만 넘기고, 문장은 UI 카탈로그가 만든다(i18n, 금지어 린트).
//  3) 사용자 데이터에서 온 문자열은 전부 DisplayValue로만 넘긴다(R-12, R-13). 화면 렌더는 MaskedValue 관문 하나.
//  4) 상태별 필수 정보는 판별 유니온으로 컴파일 단계에서 강제한다(이상 없음 = 증명된 범위 + 기준 시각).
//  5) 이 파일은 아무것도 import하지 않는다. contract·engine·UI가 모두 이 파일을 import한다.

export const REPORT_MODEL = "cloudcheck.report/1" as const;

/* ───────── 어휘 ───────── */
export type Cloud = "aws" | "azure";
/** 현관(MFA)·열쇠·창문·창고·CCTV. 배열 순서 = 화면 고정 순서. 수집기 --doors 값과 같다 */
export const DOORS = ["mfa", "key", "net", "sto", "log"] as const;
export type DoorId = (typeof DOORS)[number];
/** 위험·주의·이상 없음·확인 불가·해당 없음 */
export type Status = "risk" | "caution" | "clear" | "unknown" | "na";
/** 정렬·분포 표기 순서(D3). 문 집계(§5-3)도 이 순서에서 가장 앞에 오는 상태를 고른다 */
export const STATUS_ORDER = ["risk", "caution", "unknown", "clear", "na"] as const satisfies readonly Status[];
/** 룰이 낼 수 있는 최고 상태 */
export type MaxStatus = "risk" | "caution" | "unknown";
export const RULE_IDS = [
  "AWS-MFA-1", "AWS-MFA-2", "AWS-KEY-1", "AWS-KEY-2", "AWS-KEY-3", "AWS-KEY-4",
  "AWS-NET-1", "AWS-STO-1", "AWS-STO-2", "AWS-LOG-1",
  "AZ-MFA-G", "AZ-MFA-1", "AZ-KEY-1", "AZ-NET-1", "AZ-STO-1", "AZ-STO-2", "AZ-LOG-1", "AZ-LOG-2",
] as const;
export type RuleId = (typeof RULE_IDS)[number];
export type RuleKind = "auto" | "guide" | "conditional";
/** C-06 영수증 결과 코드 */
export type ReceiptResult = "ok" | "empty" | "notconfigured" | "denied" | "error" | "throttled" | "truncated" | "unsupported";
export type InputKind = "collector-json" | "csv-credential-report" | "csv-rg-storage" | "csv-rg-nsg" | "csv-entra-registration";
export type InputVia = "file" | "paste" | "demo";
export type DemoSetId = "A" | "B" | "C" | "D";

declare const brand: unique symbol;
type Brand<T, B extends string> = T & { readonly [brand]: B };
/** UTC 시각(ISO 8601). 엔진이 엄격 파서로 검증한 값만 */
export type IsoUtc = Brand<string, "IsoUtc">;
/** 날짜(YYYY-MM-DD) */
export type IsoDate = Brand<string, "IsoDate">;
/** 예외 매칭·Before/After용 안정 키. 형식 <cloud>|<계정 ID·테넌트 ID>|<ResourceType>|<리전·구독 또는 ->|<고유 ID>. 화면에 그리지 않는다 */
export type MatchKey = Brand<string, "MatchKey">;
/** UI 메시지 카탈로그 키. 형식 cc.<소문자·숫자·점·하이픈> */
export type CatalogKey = `cc.${string}`;
/** recognize()가 돌려주는 불투명 핸들. UI는 내용을 보지 않고 buildInput()에 그대로 넘긴다 */
export type ParsedHandle = Brand<object, "ParsedHandle">;

/* ───────── 사용자 데이터 단일 통로(R-12, R-13) ───────── */
export type SensitiveType =
  | "accountId" | "tenantId" | "subscriptionId" | "subscriptionName" | "alias"
  | "userName" | "upn" | "roleName" | "groupName" | "resourceName" | "arn" | "principal" | "fileName" | "freeText";
export type ValueFlag = "truncated" | "control-chars-replaced" | "bidi-replaced";
/**
 * plain: 비식별 상수(리전, 포트, CIDR, AWS 관리형 정책 이름 등).
 * sensitive: 화면에는 full, 인쇄·내보내기에는 masked가 기본. full은 엔진이 정리한 값(제어·양방향 문자 치환, 256자 상한).
 *   masked 형식 v1: *Id 계열 = "••••" + 끝 4자리 / 이름 계열 = "<유형>-<3자리 순번>"(예: user-003, bucket-012. 리포트 안에서 결정적)
 *   / fileName = "file-<순번>" / freeText = "•••".
 * redacted: 원값을 싣지 않는다(비밀 패턴, 잘못된 인코딩).
 */
export type DisplayValue =
  | { readonly kind: "plain"; readonly text: string }
  | { readonly kind: "sensitive"; readonly type: SensitiveType; readonly full: string; readonly masked: string; readonly flags: readonly ValueFlag[] }
  | { readonly kind: "redacted"; readonly why: "secret-pattern" | "invalid-encoding" };

/* ───────── 메시지(코드 + 파라미터) ───────── */
/** 확인 불가 사유(공통 21종). 카탈로그 키는 cc.reason.unknown.<코드> */
export type UnknownReason =
  | "denied" | "error" | "throttled" | "truncated" | "unsupported" | "budget-exceeded"
  | "region-missing" | "subscription-missing" | "scope-unproven" | "csv-scope-unproven" | "csv-row-ambiguous"
  | "field-missing" | "value-unrecognized" | "schema-unsupported" | "parse-failed" | "not-collected"
  | "stale-evidence" | "population-mismatch" | "clear-without-evidence" | "no-clear-rule" | "guide-only";
/** 룰별 사유. 형식 <RuleId>:<kebab-slug>(예: "AWS-MFA-1:root-key-active"). 닫힌 목록은 각 룰 데이터가 선언하고 registry 테스트가 강제 */
export type RuleReason = `${RuleId}:${string}`;
/** 위험·주의 사유 = 룰별 사유 + INV-7(다른 대상은 조회됐는데 이 대상만 점검 조회가 거부됨) */
export type FindingReason = RuleReason | "isolated-denial";
/** 대상 표의 사실 표기(키 끝 4자리, 나이, 포트 등). 형식 fact:<kebab-slug> */
export type FactCode = `fact:${string}`;
export type MessageCode = UnknownReason | FindingReason | "no-targets-proven" | FactCode;
export type MsgParam =
  | { readonly n: number }           // 개수·일수
  | { readonly t: IsoUtc }           // 시각
  | { readonly d: IsoDate }          // 날짜
  | { readonly c: string }           // 비식별 상수(리전, "22/tcp", CIDR, 권한 이름, 호출 이름). 사용자 데이터 금지
  | { readonly v: DisplayValue };    // 사용자 데이터
export interface MsgRef<C extends MessageCode = MessageCode> {
  readonly code: C;
  readonly params?: Readonly<Record<string, MsgParam>>;
}

/* ───────── 기준 시각·범위 ───────── */
export type AsOfSource = "collected-at" | "credential-report" | "filename" | "file-time";
export interface AsOf { readonly at: IsoUtc; readonly source: AsOfSource }
export type CoverageKind = "account-global" | "regions" | "subscriptions" | "csv-rows" | "none";
export interface Coverage {
  readonly kind: CoverageKind;
  readonly covered: number | null;    // 조회에 성공한 리전·구독 수(account-global은 1)
  readonly total: number | null;      // 활성 리전 수·보이는 구독 수
  readonly proven: boolean;           // 5조건 ①②③ 충족 = 엔진이 ScopeProof를 발급함
  readonly population: number | null; // 판정 대상 수(증명됐을 때만)
}
export interface ProvenCoverage extends Coverage {
  readonly proven: true;
  readonly covered: number;
  readonly total: number;
  readonly population: number;
}

/* ───────── 증거·대상·라벨 ───────── */
export interface ReceiptRef {
  readonly id: string;               // 입력 번호를 붙인 영수증 ID(예: "0:r-0012")
  readonly call: string;             // 호출 카탈로그 키(예: "s3:GetBucketAcl")
  readonly scope: DisplayValue;      // global, 리전(plain) 또는 구독(sensitive)
  readonly result: ReceiptResult;
  readonly count: number | null;
  readonly errorCode: string | null;
  readonly at: IsoUtc;
}
export interface EvidenceRef {
  readonly receipt: ReceiptRef | null;   // CSV 출처면 null
  readonly csv: { readonly kind: Exclude<InputKind, "collector-json">; readonly column: string; readonly row: number } | null;
  readonly observed: readonly { readonly field: string; readonly value: DisplayValue }[];  // allowlist 필드만
}
export type ResourceType =
  | "aws-account" | "root" | "iam-user" | "access-key" | "iam-role" | "region" | "security-group" | "eni" | "s3-bucket" | "trail"
  | "entra-tenant" | "entra-user" | "subscription" | "storage-account" | "blob-container" | "nsg" | "nic";
export interface ResourceRef {
  readonly type: ResourceType;
  readonly name: DisplayValue;
  readonly location: { readonly kind: "global" | "region" | "subscription"; readonly value: DisplayValue } | null;
  readonly key: MatchKey;
}
/** 라벨은 상태를 바꾸지 않는다(INV-8). exception 라벨은 overlayExceptions()만 만들고 Report 안에는 없다 */
export type Label =
  | { readonly kind: "intended-public-candidate"; readonly basis: "static-website" | "web-container" }
  | { readonly kind: "name-hint"; readonly hint: "public" | "static" | "assets" | "cdn" }
  | { readonly kind: "legacy-hint"; readonly basis: "created-before-2023-04" }
  | { readonly kind: "unusual-characters" }
  | { readonly kind: "exception"; readonly state: "active" | "expired"; readonly reason: DisplayValue; readonly until: IsoDate; readonly createdAt: IsoDate };

/* ───────── 해소법 ───────── */
export interface Resolution {
  readonly kind: "permission" | "path" | "portal" | "rerun" | "guide";
  readonly permissions: readonly string[];   // kind = permission일 때 요청할 권한 이름(호출 카탈로그의 permission)
}
export interface PermissionHint {
  readonly permission: string;
  readonly unlocks: readonly { readonly ruleId: RuleId; readonly items: number }[];
  readonly total: number;                    // 이 권한으로 풀리는 확인 불가 대상 수 합계
}

/* ───────── 대상(항목) 결과 ───────── */
export interface ItemBase {
  readonly id: string;                       // 리포트 안에서 유일. 렌더 키, 예외 오버레이 키
  readonly ruleId: RuleId;
  readonly resource: ResourceRef;
  readonly facts: readonly MsgRef<FactCode>[];
  readonly labels: readonly Label[];
}
export type ItemStatusDetail =
  | { readonly status: "risk" | "caution"; readonly why: MsgRef<FindingReason>; readonly evidence: readonly EvidenceRef[] }
  | { readonly status: "clear"; readonly why: MsgRef<RuleReason>; readonly evidence: readonly [EvidenceRef, ...EvidenceRef[]] }
  | { readonly status: "unknown"; readonly why: MsgRef<UnknownReason>; readonly evidence: readonly EvidenceRef[]; readonly resolution: Resolution };
/** 대상에는 '해당 없음'이 없다(해당 없음은 점검 단위의 '모수 0' 판정) */
export type ItemResult = ItemBase & ItemStatusDetail;

/* ───────── 점검(룰) 결과 ───────── */
export interface Distribution {
  readonly total: number; readonly risk: number; readonly caution: number;
  readonly unknown: number; readonly clear: number; readonly na: number;
}
export interface RuleBase {
  readonly ruleId: RuleId;
  readonly cloud: Cloud;
  readonly door: DoorId;
  readonly priority: number;                 // RULE_CATALOG와 같은 값(정렬 편의). 작을수록 먼저
  readonly items: readonly ItemResult[];     // 위험 → 주의 → 확인 불가 → 이상 없음, 같은 상태 안에서는 MatchKey 순
  readonly distribution: Distribution;       // 대상 단위 상태별 개수
  readonly labels: readonly Label[];
  readonly inputIndex: number | null;        // 판정에 쓴 입력(collection.inputs의 index)
}
export type RuleStatusDetail =
  | { readonly status: "risk" | "caution"; readonly why: MsgRef<FindingReason>; readonly asOf: AsOf | null; readonly coverage: Coverage }
  | { readonly status: "clear"; readonly why: MsgRef<RuleReason>; readonly asOf: AsOf; readonly coverage: ProvenCoverage }
  | { readonly status: "unknown"; readonly why: MsgRef<UnknownReason>; readonly gaps: readonly UnknownReason[]; readonly asOf: AsOf | null; readonly coverage: Coverage; readonly resolution: Resolution }
  | { readonly status: "na"; readonly why: MsgRef<"no-targets-proven">; readonly basis: MsgRef<RuleReason>; readonly asOf: AsOf; readonly coverage: ProvenCoverage & { readonly population: 0 } };
export type RuleResult = RuleBase & RuleStatusDetail;

/* ───────── 문 ───────── */
export interface DoorCollection {
  readonly status: "collected" | "partial" | "not-collected";
  /** findings-only = 찾은 위험·주의는 보여 주지만 '없음'은 확정하지 못함(INV-4, Resource Graph CSV 경로) */
  readonly judgeLevel: "full" | "findings-only" | "none";
  readonly reason: MsgRef<UnknownReason> | null;   // partial·not-collected의 사유(예: not-collected = --doors로 건너뜀)
  readonly asOf: AsOf | null;
  readonly inputIndex: number | null;
}
export interface DoorResult {
  readonly door: DoorId;
  /** §5-3 집계 결과. 정렬과 인쇄 요약에만 쓴다. 화면에 문 단위 상태 배지로 그리지 않는다(D2) */
  readonly worstStatus: Status;
  readonly collection: DoorCollection;
  readonly rules: readonly RuleResult[];     // 상태(STATUS_ORDER) → priority 순
  readonly distribution: Distribution;       // 이 문의 점검(룰) 단위 상태별 개수. 문 머리 칩
  readonly manualCount: number;              // 이 문에서 직접 볼 목록으로 간 항목 수
}

/* ───────── 리포트 머리(접을 수 없는 영역) ───────── */
export type PrincipalType =
  | "root" | "iam-user" | "assumed-role" | "federated-user"
  | "entra-user" | "service-principal" | "managed-identity" | "unknown";
export interface IdentityBlock {
  readonly cloud: Cloud;
  readonly account: DisplayValue;            // AWS 계정 ID 또는 Azure 테넌트 ID
  readonly accountLast4: string;
  readonly alias: DisplayValue | null;       // AWS 계정 별칭
  readonly currentSubscription: DisplayValue | null;   // Azure
  readonly principalType: PrincipalType;
  readonly principalName: DisplayValue | null;         // 사용자명·역할명(세션명·UPN은 수집하지 않음)
  readonly source: "collector" | "csv-arn" | "csv-tenant";
  readonly confirmed: "interactive" | "flag-yes" | null;  // 수집기 계정 확인(C-05). CSV면 null
}
export interface ScopeBlock {
  readonly unit: "region" | "subscription" | "none";
  readonly checked: number | null;
  readonly visible: number | null;
  readonly missing: readonly { readonly name: DisplayValue; readonly reason: UnknownReason; readonly receiptId: string | null }[];
  readonly outOfScope: readonly { readonly name: DisplayValue; readonly reason: "other-tenant" | "not-enabled" | "not-requested" }[];
  readonly subscriptions: readonly {
    readonly id: DisplayValue; readonly name: DisplayValue; readonly state: string;
    readonly queried: "ok" | "partial" | "failed" | "not-queried";
  }[];
  readonly proven: boolean;
}
export interface InputSummary {
  readonly index: number;
  readonly kind: InputKind;
  readonly via: InputVia;
  readonly name: DisplayValue;
  readonly bytes: number;
  readonly asOf: AsOf | null;
  readonly collector: { readonly name: string; readonly version: string; readonly knownRelease: boolean | null } | null;
  readonly schema: { readonly id: string; readonly support: "exact" | "newer-minor" | "older-minor" } | null;
  readonly doors: Readonly<Record<DoorId, "used" | "superseded" | "skipped" | "absent">>;
  readonly scopeProven: boolean;
}
export interface CollectionBlock {
  readonly asOf: AsOf | null;                // 대표 기준 시각 = 판정에 쓴 입력 중 가장 오래된 것
  readonly asOfRange: { readonly oldest: IsoUtc; readonly newest: IsoUtc } | null;
  readonly credentialReport: { readonly generatedAt: IsoUtc | null; readonly source: "api" | "filename" | "file-time" | "unknown" } | null;
  readonly receipts: Readonly<Record<ReceiptResult, number>> & { readonly total: number };
  readonly inputs: readonly InputSummary[];
}
export interface DeniedCall {
  readonly call: string;
  readonly permission: string | null;
  readonly scope: DisplayValue;
  readonly errorCode: string;
  readonly receiptIds: readonly string[];
  readonly times: number;
  readonly ruleIds: readonly RuleId[];
}
export interface PermissionsBlock {
  readonly denied: readonly DeniedCall[];           // 많이 거부된 순
  readonly unlockHints: readonly PermissionHint[];  // 많이 푸는 순
}
/** 첫 화면 고정 '이 도구가 보지 못하는 것' 7개 */
export type GlobalCannotSee =
  | "leaked-keys" | "issued-sas-oauth" | "other-accounts" | "abandoned-test-envs"
  | "app-vulnerabilities" | "idp-mfa" | "resource-policy-sharing";
/** 엔진이 만드는 배너(현재 시각과 무관). 표시 순서 = 배열 순서 */
export type Banner =
  | { readonly kind: "secrets-detected"; readonly count: number }
  | { readonly kind: "areas-not-judged"; readonly doors: readonly DoorId[]; readonly reason: "schema-section" | "field-missing" }
  | { readonly kind: "schema-newer-minor"; readonly got: string; readonly supported: string }
  | { readonly kind: "identity-unconfirmed" }
  | { readonly kind: "collector-unknown-release" }
  | { readonly kind: "csv-scope-unproven" }
  | { readonly kind: "collected-at-approximate" }
  | { readonly kind: "doors-skipped"; readonly doors: readonly DoorId[] }
  | { readonly kind: "duplicate-input-ignored"; readonly count: number };
export interface ManualCheckItem {
  readonly id: string;
  readonly origin: "unknown-item" | "unknown-rule" | "guide-card" | "out-of-scope" | "auto-notice";
  readonly door: DoorId | null;
  readonly ruleId: RuleId | null;
  readonly resource: ResourceRef | null;
  readonly what: MsgRef;
  readonly why: MsgRef<UnknownReason> | null;
  readonly howKey: CatalogKey | null;        // 콘솔 위치·속성 안내(룰 데이터의 문구 키)
  readonly resolution: Resolution | null;
}
export type FirstLook =
  /** 위험·주의를 (상태, priority) 순으로 최대 3개. 모자라면 확인 불가 점검을 priority 순으로 채운다 */
  | { readonly mode: "findings"; readonly ruleIds: readonly RuleId[] }
  /** 위험·주의 0개 + 확인 불가 1개 이상: 많이 푸는 해소법 순으로 최대 3묶음 */
  | { readonly mode: "unlock"; readonly groups: readonly { readonly resolution: Resolution; readonly ruleIds: readonly RuleId[] }[] }
  /** 전부 이상 없음·해당 없음 */
  | { readonly mode: "none-found" };

/* ───────── 리포트 ───────── */
export interface Report {
  readonly model: typeof REPORT_MODEL;
  readonly engine: { readonly version: string; readonly rulesetVersion: string };
  readonly mode: { readonly kind: "real" } | { readonly kind: "demo"; readonly setId: DemoSetId };
  readonly identity: IdentityBlock;
  readonly scope: ScopeBlock;
  readonly collection: CollectionBlock;
  readonly permissions: PermissionsBlock;
  readonly cannotSee: readonly GlobalCannotSee[];
  readonly distribution: { readonly rules: Distribution; readonly items: Distribution };  // 화면 = rules(D1)
  readonly banners: readonly Banner[];
  readonly doors: readonly DoorResult[];     // DOORS 순서 5개 고정(미수집 문 포함)
  readonly firstLook: FirstLook;
  readonly manualChecklist: readonly ManualCheckItem[];
}

/* ───────── 룰 카탈로그(정적 데이터, '판정 규칙' 화면과 고치는 법) ───────── */
/** 외부 링크 허용 호스트. 번들 URL 검사와 DocLink 관문이 같은 목록을 쓴다. 추가는 프론트팀장 확인 */
export const LINK_HOSTS = [
  "docs.aws.amazon.com", "aws.amazon.com", "learn.microsoft.com", "azure.microsoft.com",
  "byline.network", "rocket-boys.co.jp", "scan.netsecurity.ne.jp", "www.helpnetsecurity.com", "www.securityweek.com",
  "docs.prowler.com", "github.com",
] as const;
export type LinkHost = (typeof LINK_HOSTS)[number];
export interface ExternalLink { readonly href: `https://${string}`; readonly host: LinkHost }
/** 고치는 법 명령. 자리표시자는 구조로 표현해 그대로 붙여 넣어도 실행되지 않게 한다(R-11) */
export type CliSegment = { readonly t: "text"; readonly v: string } | { readonly t: "ph"; readonly key: CatalogKey };
export interface CliTemplate<K extends "read" | "write" = "read" | "write"> {
  readonly kind: K;
  readonly shell: "aws" | "az";
  readonly segments: readonly CliSegment[];  // write는 ph를 1개 이상 포함(registry 테스트)
}
export interface FixGuide {
  readonly impact: "low" | "medium" | "high";
  readonly prodImpact: boolean;
  readonly observe: { readonly textKey: CatalogKey; readonly doc: ExternalLink | null; readonly commands: readonly CliTemplate<"read">[] };
  readonly change: { readonly textKey: CatalogKey; readonly property: string; readonly doc: ExternalLink; readonly commands: readonly CliTemplate<"write">[] };
  readonly revert: { readonly textKey: CatalogKey; readonly commands: readonly CliTemplate<"write">[] };
  readonly runbook: ExternalLink | null;
}
export interface GuideCard { readonly steps: readonly { readonly id: string; readonly textKey: CatalogKey; readonly doc: ExternalLink | null }[] }
export interface BasisRef { readonly titleKey: CatalogKey; readonly link: ExternalLink; readonly kind: "doc" | "benchmark" | "regulator" | "incident" | "advisory" }
export interface IncidentRef { readonly titleKey: CatalogKey; readonly date: IsoDate; readonly link: ExternalLink; readonly sourceName: string }
export interface RuleParamView {
  readonly key: CatalogKey;
  readonly value: number | string | readonly (number | string)[];
  readonly basis: "public-standard" | "tool-default";   // 화면에 '공개 기준'/'도구 기준'으로 표기
}
export interface RuleCatalogEntry {
  readonly ruleId: RuleId;
  readonly cloud: Cloud;
  readonly door: DoorId;
  readonly kind: RuleKind;
  readonly released: boolean;                // false면 리포트·분포에 넣지 않는다(AZ-MFA-1은 PM Azure 검증 전 false)
  readonly titleKey: CatalogKey;
  readonly summaryKey: CatalogKey;
  readonly maxStatus: MaxStatus;
  readonly allowsClear: boolean;
  readonly priority: number;                 // 18장 전체에서 중복 없는 정수, 작을수록 먼저
  readonly conditionKeys: Readonly<Partial<Record<Status, CatalogKey>>>;
  readonly impactKey: CatalogKey | null;
  readonly questionKey: CatalogKey | null;
  readonly paths: readonly ("csv" | "collector" | "portal-csv" | "guide")[];
  readonly permissions: readonly string[];
  readonly params: readonly RuleParamView[];
  readonly cannotSee: readonly CatalogKey[];
  readonly falsePositiveKeys: readonly CatalogKey[];
  readonly fix: FixGuide | null;
  readonly guide: GuideCard | null;
  readonly basis: readonly BasisRef[];
  readonly incident: IncidentRef | null;
  readonly lastVerified: IsoDate;
}

/* ───────── 입력 인식(리포트 이전, V2 화면) ───────── */
export type RecognitionStatus =
  | "ok" | "empty" | "wrong-type" | "parse-error" | "not-cloudcheck" | "schema-major" | "credentials-file"
  | "too-large" | "too-deep" | "account-mismatch" | "cloud-mismatch" | "superseded";
export interface InputRecognition {
  readonly via: InputVia;
  readonly name: DisplayValue;
  readonly bytes: number;
  readonly status: RecognitionStatus;
  readonly kind: InputKind | null;
  readonly detail: Readonly<Record<string, MsgParam>> | null;   // 예: parse-error {line, col, maybeTruncated}
  readonly identityPreview: { readonly cloud: Cloud; readonly accountLast4: string; readonly alias: DisplayValue | null } | null;
  readonly asOf: AsOf | null;
  readonly doors: readonly DoorId[];
  readonly handle: ParsedHandle | null;      // status = "ok"일 때만 non-null
}

/* ───────── 현재 시각·예외·비교(judge 밖의 순수 함수 결과) ───────── */
/** timeNotices(report, now)의 결과. 체험 모드에서는 빈 배열 */
export type TimeNotice =
  | { readonly kind: "snapshot-age"; readonly level: "stale" | "very-stale"; readonly ageHours: number }
  | { readonly kind: "future-timestamp"; readonly aheadMinutes: number }
  | { readonly kind: "guidance-stale"; readonly ruleIds: readonly RuleId[] };
/** overlayExceptions(report, file, today)의 결과. 상태는 바꾸지 않고 라벨만 덧씌운다(INV-8) */
export interface ExceptionOverlay {
  readonly byItemId: ReadonlyMap<string, Extract<Label, { kind: "exception" }>>;
  readonly entries: readonly { readonly index: number; readonly state: "active" | "expired" | "unmatched" }[];
  readonly counts: { readonly active: number; readonly expired: number; readonly unmatched: number };
}
export interface CompareSide { readonly cloud: Cloud; readonly accountLast4: string; readonly alias: DisplayValue | null; readonly asOf: AsOf | null }
/** better·worse는 위험 > 주의 > (이상 없음 = 해당 없음) 순위로 비교. 확인 불가로 바뀌면 became-unknown, 확인 불가에서 벗어나면 became-known */
export type RuleChange = "better" | "worse" | "same" | "became-unknown" | "became-known";
export type Comparison =
  | { readonly ok: false; readonly reason: "different-account" | "different-cloud" | "same-snapshot"; readonly before: CompareSide; readonly after: CompareSide }
  | {
      readonly ok: true; readonly before: CompareSide; readonly after: CompareSide;
      readonly reordered: boolean;               // 수집 시각 순으로 자동 정렬했는지
      readonly sameCredentialReport: boolean;    // 두 파일의 자격증명 보고서 생성 시각이 같음 → 4시간 캐시 배너
      readonly rules: readonly {
        readonly ruleId: RuleId; readonly before: Status; readonly after: Status; readonly change: RuleChange;
        readonly items: { readonly before: Distribution; readonly after: Distribution };
      }[];
    };
```

**컴파일 단계 회귀 파일 `src/lib/cloudcheck/model/report.typetest.ts`**(`.test.ts`가 아니므로 vitest가 아니라 `npm run type-check`가 검사한다)

```ts
// src/lib/cloudcheck/model/report.typetest.ts — 판정 결과 모델의 컴파일 단계 불변식(npm run type-check가 검사)
// 각 줄은 '컴파일 오류가 나야 정상'이다. 오류가 사라지면(@ts-expect-error 미사용) type-check가 실패한다.
import type { IsoUtc, RuleStatusDetail, ItemStatusDetail, CliTemplate, BasisRef, RuleId } from "./report";

const asOf = { at: "2026-10-19T03:12:00Z" as IsoUtc, source: "collected-at" } as const;

// @ts-expect-error 이상 없음인데 범위가 증명되지 않음(proven: false)
export const t1: RuleStatusDetail = { status: "clear", why: { code: "AWS-MFA-2:all-mfa" }, asOf, coverage: { kind: "account-global", covered: 1, total: 1, proven: false, population: 4 } };
// @ts-expect-error 이상 없음인데 기준 시각 없음
export const t2: RuleStatusDetail = { status: "clear", why: { code: "AWS-MFA-2:all-mfa" }, asOf: null, coverage: { kind: "account-global", covered: 1, total: 1, proven: true, population: 4 } };
// @ts-expect-error 확인 불가에 룰별 사유(공통 UnknownReason만 허용)
export const t3: RuleStatusDetail = { status: "unknown", why: { code: "AWS-MFA-2:all-mfa" }, gaps: [], asOf: null, coverage: { kind: "none", covered: null, total: null, proven: false, population: null }, resolution: { kind: "rerun", permissions: [] } };
// @ts-expect-error 해당 없음인데 모수가 0이 아님(INV-5)
export const t4: RuleStatusDetail = { status: "na", why: { code: "no-targets-proven" }, basis: { code: "AWS-KEY-1:na-no-active-keys" }, asOf, coverage: { kind: "account-global", covered: 1, total: 1, proven: true, population: 2 } };
// @ts-expect-error 위험 사유에 확인 불가 코드
export const t5: RuleStatusDetail = { status: "risk", why: { code: "denied" }, asOf, coverage: { kind: "account-global", covered: 1, total: 1, proven: true, population: 1 } };
// @ts-expect-error 이상 없음 대상인데 증거 0개
export const t6: ItemStatusDetail = { status: "clear", why: { code: "AWS-STO-2:not-public" }, evidence: [] };
// @ts-expect-error 대상에는 '해당 없음'이 없다
export const t7: ItemStatusDetail = { status: "na", why: { code: "no-targets-proven" }, evidence: [] };
// @ts-expect-error 고치는 법 '먼저 확인' 단계에 쓰기 명령
export const t8: CliTemplate<"read"> = { kind: "write", shell: "aws", segments: [] };
// @ts-expect-error 허용 목록 밖 링크 호스트
export const t9: BasisRef = { titleKey: "cc.basis.x", link: { href: "https://example.com/x", host: "example.com" }, kind: "doc" };
// @ts-expect-error 없는 룰 ID
export const t10: RuleId = "AWS-NET-2";
```

[확인: 스크래치패드] 위 10줄은 지시어를 빼면 각각 의도한 이유로 오류가 난다(범위 미증명, 기준 시각 없음, 확인 불가에 룰 사유, 모수 2, 위험에 확인 불가 코드, 증거 0개, 대상의 해당 없음, read 자리에 write, 허용 밖 호스트, 없는 룰 ID). 정상 AWS 리포트 객체(현관·열쇠 판정, 나머지 미수집)도 타입을 통과했다.

### 5-3. UI가 부르는 함수(시그니처 동결)

```ts
// parse/recognize.ts (API설계자) — 크기·깊이 상한, 종류 판별, 봉투 검증, 신원 미리보기. 예외를 던지지 않는다
export function recognize(src: { via: InputVia; name: string; bytes: Uint8Array; lastModified: number | null }): InputRecognition;
// parse/normalize.ts (API설계자) — 계정·클라우드 불일치, superseded, 문 단위 선택(§4-8). NormalizedInput은 contract/normalized.ts(D1)
export function buildInput(recs: readonly InputRecognition[]):
  | { ok: true; input: NormalizedInput; recognitions: InputRecognition[] }
  | { ok: false; recognitions: InputRecognition[] };
// engine/judge.ts (DB설계자) — 순수 함수. 예외를 던지지 않는다. now·예외 파일·본인 응답 인자는 없다
export function judge(input: NormalizedInput): Report;
// engine/time.ts (DB설계자) — 24시간·7일·180일·시계 차이 5분. 체험 모드면 []
export function timeNotices(report: Report, now: IsoUtc): TimeNotice[];
// engine/exceptions.ts (DB설계자) — 상태 불변(INV-8). today = 사용자 기기의 오늘 날짜, until까지 유효
export function overlayExceptions(report: Report, file: ExceptionsFile | null, today: IsoDate): ExceptionOverlay;
// engine/compare.ts (DB설계자) — 수집 시각 순으로 자동 정렬, 다른 계정·클라우드면 거부
export function compare(a: Report, b: Report): Comparison;
// parse/mask.ts (API설계자) — R-13 마스킹 사본(결정적 가명화 JSON 텍스트)
export function maskedCopy(input: NormalizedInput): string;
// parse/exceptions.ts (API설계자)
export function parseExceptions(text: string): { ok: true; file: ExceptionsFile } | { ok: false; issues: string[] };
export function serializeExceptions(file: ExceptionsFile): string;
// rules/catalog.ts (DB설계자) — 18장. released = false인 룰은 리포트·분포에 넣지 않는다
export const RULE_CATALOG: readonly RuleCatalogEntry[];
```

- UI는 `NormalizedInput`과 `ParsedHandle`의 내용을 보지 않는다.
- 체험 모드: UI가 데이터 블록의 체험 JSON을 `recognize({ via: "demo", … })`로 넘긴다. 실제 점검과 같은 파이프라인을 타고, Report의 `mode`는 demo가 된다.
- 리포트 화면의 시간 배너 = `report.banners` + `timeNotices(report, now)`, 예외 표시 = `overlayExceptions(…)`. 셋은 표시 단계에서만 합친다.

---

## 6. 룰 18장 최종 표 (T6)

### 6-1. 요약표(priority 순. 작을수록 먼저, 같은 상태 안에서만 순서를 정한다)

| priority | ID | 문 | 제목(상태 중립형) | 최고 상태 | 이상 없음 | 수집 경로 | 파라미터(근거) |
|---|---|---|---|---|---|---|---|
| 10 | AWS-STO-2 | 창고 | **버킷 공개 상태** | 위험 | 가능 | 수집기 | 정적 웹사이트면 주의 + 의도된 공개 후보 / 이름 힌트 public·static·assets·cdn은 라벨만 / INV-7 |
| 20 | AZ-STO-2 | 창고 | **컨테이너 공개 상태** | 위험 | 가능 | 수집기 | `$web`은 주의 + 의도된 공개 후보 / INV-7 |
| 30 | AWS-NET-1 | 창문 | **관리·DB 포트의 인터넷 노출** | 위험 | 가능 | 수집기 | 위험 포트 33개·주의 포트(§6-3), `0.0.0.0/0`·`::/0` |
| 40 | AZ-NET-1 | 창문 | **관리·DB 포트의 인터넷 노출(NSG)** | 위험(CSV 경로는 주의) | 수집기만 | CSV(찾은 것만)·수집기 | 같은 포트 목록, 출발지 `*`·`Internet`·`0.0.0.0/0`·`Any` |
| 50 | AWS-KEY-4 | 열쇠 | **역할 신뢰 설정(외부 계정)** | 위험 | 가능 | 수집기 | 제외: 서비스 주체·자기 계정·서비스 연결 역할 / `aws:PrincipalOrgID`·`aws:SourceAccount` 조건이 있으면 주의 유지 + 완화형 사유 |
| 60 | AWS-MFA-1 | 현관 | 루트 계정 문단속 | 위험 | 가능 | CSV·수집기 | 루트 최근 로그인 90일(도구 기준) / 보고서 신선도 4시간 5분(AWS 문서) / Organizations 신규 멤버(루트 자격증명 없음)는 해당 없음 |
| 70 | AWS-MFA-2 | 현관 | 콘솔 사용자 MFA | 위험 | 가능 | CSV·수집기 | 콘솔 사용자 0명이면 해당 없음 + 직접 볼 목록에 "IdP MFA 직접 확인"(auto-notice) |
| 80 | AZ-MFA-1 | 현관 | Entra 사용자 MFA 등록 현황(조건부) | 위험 | 불가 | 포털 CSV | `released: false`. PM Azure 검증(라이선스·열 구성) 뒤 편입 |
| 90 | AZ-MFA-G | 현관 | Entra MFA 포털 확인(가이드) | 확인 불가 고정 | 불가 | 안내 | 포털 3단계 + 본인 응답(상태 불변, UI 세션 상태) |
| 100 | AWS-KEY-3 | 열쇠 | 관리자 열쇠 출입 제한 안내 | 주의 | 불가 | 수집기 | 관리자급 정책 4종(§6-4) |
| 110 | AWS-KEY-1 | 열쇠 | **액세스 키 나이** | 주의 | 가능 | CSV·수집기 | 90일(Security Hub IAM.3, 공개 기준) |
| 120 | AWS-KEY-2 | 열쇠 | **자격증명 마지막 사용** | 주의 | 가능 | CSV·수집기 | **45일**(Security Hub IAM.22·CIS v5.0.0/1.11, 공개 기준) / 신규 자격증명 유예 7일(도구 기준) / 콘솔 비밀번호도 같은 기준 |
| 130 | AZ-KEY-1 | 열쇠 | 스토리지 공유 키 회전 | 주의 | 수집기만 | CSV(찾은 것만)·수집기 | 90일(도구 기준. MS·CIS Azure 권고 일수는 DB설계자가 원문 확인) / 키 값을 읽는 명령 금지 |
| 140 | AWS-STO-1 | 창고 | 계정 전체 퍼블릭 액세스 차단 | 주의 | 가능 | 수집기 | `NoSuchPublicAccessBlockConfiguration`은 유효한 답(주의) |
| 150 | AZ-STO-1 | 창고 | **익명 공개 차단 설정** | 주의 | 수집기만 | CSV(찾은 것만)·수집기 | null·속성 없음 = 미설정(차단 아님) → 주의 |
| 160 | AWS-LOG-1 | CCTV | CloudTrail 장기 기록 | 주의 | 가능 | 수집기 | "trail 없음 = 로그 없음"이라고 쓰지 않는다 |
| 170 | AZ-LOG-1 | CCTV | 활동 로그 장기 보관 | 주의 | 가능 | 수집기 | Administrative·Security 범주(범주 그룹 매핑 [미확인]) |
| 180 | AZ-LOG-2 | CCTV | Blob 접근 기록 | 주의 | 가능 | 수집기 | StorageRead·StorageWrite·StorageDelete |

- 굵은 제목은 디자인 §5-2의 상태 중립형 개정이다. 나머지는 원래 제목을 유지한다. STEP 3 카피 덱에서 모든 제목을 허용된 상태 배지와 하나씩 붙여 읽는 검토 표를 만든다.
- '위험'을 낼 수 있는 룰은 8장(STO-2, AZ-STO-2, NET-1, AZ-NET-1, KEY-4, MFA-1, MFA-2, AZ-MFA-1)으로 기획서와 같다. 이상 없음을 주지 않는 룰은 AWS-KEY-3, AZ-MFA-1, AZ-MFA-G다.
- 룰 데이터 스키마(DB설계자, `rules/rule-schema.ts`)는 백엔드 초안을 따르되 다음을 바꾼다: `maxState` → `maxStatus`(`risk | caution | unknown`), `allowsGreen` → `allowsClear`, `cliExampleKey` → `fix.*.commands: CliTemplate[]`, 각 룰이 자기 사유 코드의 닫힌 목록 `reasonCodes`를 선언, 근거 링크는 `LINK_HOSTS`만. registry 테스트: 18개, ID·priority 고유, 스키마 통과, 모든 사유 코드·문구 키가 `rules/i18n/ko.ts`에 존재, 쓰기 CliTemplate에 자리표시자 1개 이상, 금지어 0.
- 6케이스 픽스처는 사람이 pass·violate만 쓰고 나머지 4개(denied·truncated·missingField·versionMismatch)는 `mutate.ts`로 파생한다. 성립하지 않는 케이스는 `{na: "이유"}`를 적는다(백엔드안 채택).

### 6-2. 공통 파라미터

| 파라미터 | 값 | 근거 표기 |
|---|---|---|
| 오래된 사진 배너 | 24시간 / 7일(강조) | 도구 기준(기획서) |
| 오래된 안내 배너 | `lastVerified` + 180일 | 도구 기준(기획서) |
| 시계 차이 알림 | 수집 시각이 기기 시계보다 5분 넘게 늦음 | 도구 기준 |
| 자격증명 보고서 신선도 | 4시간 5분 | AWS 문서(4시간 캐시) [확인] |
| 예외 최대 기간 | 90일(`EXCEPTION_MAX_DAYS`) | 도구 기준 |
| 수집 예산 | AWS 사용자 150·버킷 300, Azure 구독 20·구독당 스토리지 계정 100 | 도구 기준. PM V1 실측 뒤 조정 |

### 6-3. 위험 포트 2단계(인바운드 출발지가 `0.0.0.0/0` 또는 `::/0`. 포트 범위가 겹치면 해당. 프로토콜 `-1`이나 전체 범위는 위험)

- **위험(33개)**: EC2.19 목록 24개 [확인]에서 메일 포트 25·110·143을 뺀 21개(20, 21, 22, 23, 135, 445, 1433, 1434, 3000, 3306, 3389, 4333, 5000, 5432, 5500, 5601, 8080, 8088, 8888, 9200, 9300) + 도구 기준 12개(1521 Oracle, 6379 Redis, 27017 MongoDB, 2375·2376 Docker API, 2379·2380 etcd, 10250 kubelet, 11211 Memcached, 5900 VNC, 5985·5986 WinRM).
- **주의**: 80·443을 뺀 그 밖의 모든 포트, 그리고 메일 포트 25·110·143("메일 서버라면 의도된 공개일 수 있습니다"). 근거: EC2.18의 기본 허용 TCP가 80·443이다 [확인].
- TCP·UDP 모두 같은 목록으로 본다(EC2.19 문서에는 프로토콜 범위가 적혀 있지 않다 [확인: 원문에 없음]). Azure NSG에도 같은 목록을 쓴다.
- 화면에는 "EC2.19 기반 + 도구 기준 추가"로 근거를 나눠 적는다. 3000·5000·8080·8888처럼 개발용 웹 포트가 위험인 것은 EC2.19의 판단을 따른 것이다. 고치는 법에는 "의도한 웹 서비스라면 80·443 뒤의 로드밸런서로" 안내를 넣는다.

### 6-4. 관리자급 정책(AWS-KEY-3)과 KEY-4 보완

- 핵심 4개: `AdministratorAccess`, `PowerUserAccess`, `IAMFullAccess`(스스로 관리자 권한을 줄 수 있어 사실상 같음), `AWSOrganizationsFullAccess`. ARN 접미 `:iam::aws:policy/<이름>`으로 파티션과 무관하게 비교한다.
- 검토 후보(DB설계자가 정책 문서를 대조해 STEP 4에서 결정): `AdministratorAccess-Amplify`, `AdministratorAccess-AWSElasticBeanstalk`, `job-function/SystemAdministrator`.
- KEY-4: Federated 주체와 조건 키도 수집하므로, 나중에 GitHub OIDC `sub` 조건 누락 룰을 수집기 변경 없이 추가할 수 있다(나중 범위).

---

## 7. 표현 기준 갱신

### 7-1. 화면 용어

| 내부 용어 | 화면 용어 |
|---|---|
| rule | **점검**(예: "점검 10개 중"). 룰 목록 화면 이름은 '판정 규칙' |
| item·resource | **대상**. '항목'은 화면에서 쓰지 않는다 |
| asOf | 기준 시각 |
| coverage·scope | 확인한 범위 / 조회 범위 |
| receipt | 호출 기록 |
| collect JSON | 결과 파일 |
| exception / self-answer | 예외 표시 / 본인 응답 |
| 영수증 결과 `ok` | 성공(내부 식별자는 금지어 검사 대상이 아님) |

- 권한 해제 문구: "이 권한이 있으면 확인 불가 점검 n개(대상 m개)를 풀 수 있습니다."
- 미판정 고정 문구: "아직 판단하지 못한 점검이 d개 있습니다 → 직접 볼 목록."

### 7-2. 약속 문구와 전송 고지(확정)

| 위치 | 문구 |
|---|---|
| 한 줄 약속(V0, 그대로) | "열쇠는 맡기지 않습니다. 읽기는 당신의 셸에서, 판정은 당신의 브라우저에서. 어디까지 봤고 무엇을 못 봤는지도 그대로 말합니다." |
| 무전송 약속(V0·V2 드롭존 옆·V8) | "이 페이지는 올린 파일을 어디로도 보내지 않습니다. 판정은 이 브라우저 안에서만 합니다. 이 페이지가 외부로 요청을 보내지 못하도록 브라우저 설정(응답 헤더)을 걸어 두었습니다. 직접 확인하는 방법 3가지 →" |
| **고지(약속 바로 아래, 항상)** | "다만 브라우저 확장 프로그램, 자동 번역, 향상된 맞춤법 검사 같은 브라우저 자체 기능은 이 페이지가 막을 수 없습니다. 확장을 끈 창이나 오프라인판(파일로 열기)을 권합니다." |
| 직접 확인하기 3가지 | ① 오프라인판을 내려받아 네트워크를 끊고 파일로 열어 보기 ② 개발자 도구 Network 탭에서 요청이 문서 1건뿐인지 보기 ③ 응답 헤더에서 `Content-Security-Policy`(`connect-src 'none'` 등) 보기 |
| §9-2 면책(리포트 머리·인쇄 바닥, 수정본) | "이 리포트는 올린 파일에 담긴 범위만, 그 파일의 수집 시각 기준으로 보여 줍니다. 보안을 보증하거나 규정 준수를 인증하지 않습니다. '확인 불가' 항목과 '이 도구가 보지 못하는 것'은 직접 확인해야 합니다. 판정은 이 브라우저 안에서만 이루어졌고, 이 페이지는 올린 파일을 어디로도 보내거나 저장하지 않았습니다(브라우저 확장·자동 번역 같은 브라우저 기능은 이 페이지가 막을 수 없습니다)." |
| 수집기 설명(디자인 #8 유지) | "설정을 바꾸는 명령은 넣지 않았습니다. 예외 1개: 자격증명 보고서 생성 요청. 예상 호출 목록과 일치하는지 직접 확인할 수 있습니다." |

- 면책 문구의 '보증·준수·인증'은 부정문이라 키 단위 허용(`cc.disclaimer.body`)으로 금지어 검사에서 뺀다.
- "외부 요청 0건", "100% 로컬", "어디에도 전송되지 않았습니다"(절대 표현), "쓰기 0건", "서버 없음"은 금지다.

### 7-3. 금지어 모듈 `src/lib/cloudcheck/model/banned-words.ts`(G0)

```ts
// src/lib/cloudcheck/model/banned-words.ts — 표현 기준(R-04, §9) 단일 원천
// G0 동결. 소유: 프론트팀장 + 백엔드팀장 공동, 목록 변경은 기획팀장 확인.
// 쓰는 곳: ① UI 카탈로그(_client/i18n/ko/*)와 룰 문구(rules/i18n/ko.ts) 정적 검사
//          ② 체험 리포트 A~D를 렌더한 뒤 body 텍스트 검사(실행 중 조합되는 문구까지)
// 내부 식별자(영수증 결과 ok 등)는 검사 대상이 아니다. 화면 표시는 카탈로그를 거치므로 '성공' 같은 말로 바뀐다.
import type { CatalogKey } from "./report";

export interface BannedRule { readonly re: RegExp; readonly label: string; readonly instead: string }

export const BANNED_KO: readonly BannedRule[] = [
  { re: /안전/g, label: "안전", instead: "이상 없음(확인한 범위·기준 시각)" },
  { re: /문제\s?없|양호/g, label: "문제없음·양호", instead: "분포 표기(점검 N개 — 위험 a · 주의 b …)" },
  { re: /불?합격|통과/g, label: "통과·합격", instead: "일치 / 허용 / 기준과 다름" },
  { re: /부?적합|미?준수/g, label: "적합·준수", instead: "참고 대응표(비인증) / 기준과 다름" },
  { re: /인증|보증|보장/g, label: "인증·보증·보장", instead: "(쓰지 않음. 기술 용어는 문맥 허용 목록)" },
  { re: /점수|등급|순위|평균|퍼센트|%/g, label: "점수·등급·비율", instead: "(쓰지 않음)" },
  { re: /완료|완벽|문단속\s?끝/g, label: "완료·완벽", instead: "파일을 읽었습니다 / 리포트를 만들었습니다" },
  { re: /\bOK\b|\bPASS\b|✓/g, label: "OK·PASS·✓", instead: "상태 글자 전체" },
  { re: /\d+\s?(분|초)/g, label: "시간 약속", instead: "(시간 약속 없음)" },
  { re: /해킹\s?차단|방어|침해\s?예방/g, label: "방어 약속", instead: "위험 신호를 찾습니다" },
  { re: /100%\s?로컬|외부\s?요청\s?0|쓰기\s?0건|서버\s?없음|어디에도\s?전송되지/g, label: "무전송 과장", instead: "이 페이지는 올린 파일을 어디로도 보내지 않습니다(+ 브라우저 기능 고지)" },
];

/** 기술 용어로서의 '인증'(authentication)은 허용한다. 검사 전에 이 문맥을 가린다 */
export const ALLOWED_CONTEXT_KO: readonly RegExp[] = [
  /다단계\s?인증/g, /다중\s?인증/g, /2단계\s?인증/g, /Entra(\s?ID)?\s?인증/g, /공유\s?키\s?인증/g,
  /인증\s?(방법|앱|수단|모드)/g, /인증서/g,
];

/** 금지어가 부정문으로 꼭 들어가야 하는 문구(키 단위). 항목마다 사유를 적고, 추가는 기획팀장 확인 */
export const ALLOWED_KEYS: Readonly<Partial<Record<CatalogKey, string>>> = {
  "cc.disclaimer.body": "§9-2 면책: '보안을 보증하거나 규정 준수를 인증하지 않습니다'(부정문)",
  "cc.about.not-certification": "V8: 이 도구가 인증·감사 증적이 아니라는 설명(부정문)",
};

export interface BannedHit { readonly label: string; readonly match: string; readonly index: number }

export function findBanned(text: string): BannedHit[] {
  let masked = text;
  for (const re of ALLOWED_CONTEXT_KO) masked = masked.replace(re, (m) => "□".repeat(m.length));
  const hits: BannedHit[] = [];
  for (const rule of BANNED_KO) {
    for (const m of masked.matchAll(rule.re)) hits.push({ label: rule.label, match: m[0], index: m.index ?? 0 });
  }
  return hits.sort((a, b) => a.index - b.index);
}
```

- 일본어 목록(安全です, 問題なし, 合格, 準拠, 認証, 保証, スコア, ランク 등)과 '認証(多要素認証)' 문맥 허용은 v1.1에서 같은 구조로 더한다.
- 디자인 §5-1의 고위험 지점 16곳 대안 카피를 STEP 3 카피 덱의 기준으로 채택한다.

### 7-4. 복사·선택 규칙

- 원클릭 복사 버튼은 어디에도 없다(쓰기 명령, 읽기 명령, KQL, 해시, 수집기 명령 모두).
- 사용자가 셸에 직접 입력하는 것은 `sha256sum <파일>`과 `bash <파일>` 두 줄뿐이다(기획서 유지).
- KQL 블록과 해시 표시는 클릭 한 번에 전체가 선택된다. 해시는 8자리씩 8묶음으로 보이되 간격은 CSS로만 주므로, 복사하면 64자가 이어진 그대로 나온다(디자인 §2-6).
- 쓰기 명령은 V4(고치는 법)에만 나온다. 두꺼운 잉크 테두리에 "쓰기 명령 · 계정 설정을 바꿉니다" 머리표를 달고, 자리표시자는 점선 밑줄로 강조한다.

---

## 8. 게이트 G0~G9 갱신본

| 게이트 | 내용 | 담당 |
|---|---|---|
| **G0 착수** | (a) 수집 계약 v1.0(§4-1~4-3)과 (b) 판정 결과 모델 v1·타입 회귀·금지어(§5-2, §7-3)를 이 문서 그대로 레포에 옮긴다 → `npm run type-check` 통과 + 스모크 테스트(§4-9) 통과 → 프론트팀장·백엔드팀장 확인. 서빙 방식은 ① + force-dynamic으로 확정됨 | 프론트팀장, API설계자, 백엔드팀장 |
| G1 엔진 | 빈 입력에서 이상 없음 0개, INV-1~10 속성 테스트(fast-check, 변이는 `mutate.ts` 재사용), judge의 순수성(같은 입력 2회 = 같은 Report, `vi.setSystemTime` 무관), 위조 증명 → 확인 불가(크래시 없음), judge가 예외를 던지지 않음 | QA |
| G2 룰 | 18장이 모두 스키마 통과(6케이스, 오탐 시나리오, 못 보는 것, 근거, lastVerified), 사유 코드 닫힘, 모든 문구 키 존재, 쓰기 명령 자리표시자 | DB설계자, QA |
| G3 정답지 | 가짜 회사 4세트 × AWS·Azure 정답지 100% 일치. 정답지는 **사람이 룰 명세를 보고 먼저 쓰고** QA가 리뷰한다. 엔진 출력으로 자동 생성·갱신하는 경로는 두지 않는다 | QA |
| G4 수집기 | 린트 L-01~L-14 위반 0 + 규칙별 위반 샘플이 모두 잡힘("린터의 린터"), **가짜 CLI shim 실행 테스트**(AWS 16·Azure 8 시나리오, 시나리오 밖 호출은 실패, 독이 든 응답에서 태그·정책 전문·키 ID 전체·IP·XSS 문자열 0), bash 3.2 기준선(L-12), jq 1.6 호환(L-13), 해시 일치(파일 = SHA256SUMS = 페이지 데이터 블록 = TextEncoder 바이트), RELEASES.json 추가 전용. PM 실측은 G8 | API설계자, 백엔드팀장, QA |
| G5 격리 | 헤더가 §2-2와 같음(`serve.test.ts` 스냅샷 + 라이브 `curl -sI`), CSP 해시 = `PAGE.scriptHash`·`PAGE.styleHash`, `/cloudcheck` 바이트 = `/download` 바이트 = `PAGE.sha256`, 최초 로드 문서 1건·하위 리소스 0·CSP 위반 0, 영속 저장 0(가드 + 행동), 오프라인 실행, 공유 파일 9종 sha256 불변, `serviceWorker` grep 0, Tailwind 산출 CSS 규칙 수 증가 0(프론트 측정 방식. 늘면 원인 토큰을 바꾼다), 클린 빌드에서 `ƒ /cloudcheck`, 기존 대표 라우트(/pae·/moira·/exam·/witness) 회귀 없음. **STEP 5 이월 브라우저 항목**: Blob 다운로드 바이트, 인쇄(마스킹 기본·`<details>` 펼침), COOP 팝업 단절(`w.closed`), file:// meta CSP, React 18 + TT(Chrome 전 화면), `pushState`의 https·file:// 동작과 실패 시 대체 | 프론트팀장, QA, 배포엔지니어 |
| G6 입력 안전 | XSS(`<img onerror>`, `</script>`), RTL·zero-width 문자, 아주 긴 이름, `__proto__`·`constructor` 이름, 거대 파일(상한), 깊은 JSON, 잘못된 인코딩, 비밀 패턴, 키 파일 거부, innerHTML·dangerouslySetInnerHTML 0(AST) | QA |
| G7 표현 | 금지어 0(카탈로그 정적 검사 + 체험 A~D 렌더 텍스트), 면책·고지 고정 노출, 제목×상태 검토 표 완료, 디자인 고위험 16곳 점검 | QA, 디자인팀장 |
| → G1~G7 통과 | **프로덕션 배포 가능**: "베타 · 실계정 검증 전" 띠 + noindex, 홍보 없음 | 배포엔지니어 |
| G8 실계정 | 클라우드별 PM 검증 V1(빈·학습 계정에 결함 심기) → V2(비프로덕션). §11-2 체크리스트 포함. 통과한 클라우드부터 띠를 뗀다(새 릴리스) | PM, QA |
| G9 공개 링크 | 최종 주소 결정(①유지 또는 ② 별도 origin, Q2), 수집기 저장소·태그·SHA256SUMS 게시(외부 조치 → PM 승인), PDF 인쇄 해시 = 라이브 = 저장소, GitHub·Vercel 2FA, noindex 해제 → PDF와 홍보. 이후 PDF 해시와 라이브 해시를 주기적으로 수동 대조 | PM, 배포엔지니어 |

---

## 9. STEP 3~7 일정과 크리티컬 패스

| 단계 | 내용 | 기간(세션·일) | 선행 |
|---|---|---|---|
| STEP 3-a | @UX디자이너(흐름 F1~F5, V0~V8 텍스트 와이어, 상태 매트릭스, 카피 덱 + 금지어 자체 점검 + 제목×상태 표, 직접 볼 목록·인쇄, 체험 세트 이름, 키보드·스크린리더) ∥ @UI디자이너(`--cc-` 토큰 라이트·다크·인쇄, 상태 아이콘 SVG, 컴포넌트 규격, 자산 예산) | 1세션(병렬) | 이 방향서 |
| STEP 3-b | @디자인팀장: `cloudcheck-design-final.md`(충돌 해소, 최종 토큰 CSS, **§5 모델 ↔ 화면 요소 대조표**, 개발 핸드오프 체크리스트) | 1세션 | 3-a |
| (선택) 백엔드 선행 | G0 반영 + API설계자 D1~D3(카탈로그·스키마·AWS 수집기·shim) + DB설계자 D1~D3(룰 스키마·엔진 core·mutate) | STEP 3과 병행 | **PM 승인 시에만**(Q14, 오케스트레이션 규칙 1의 예외) |
| STEP 4 D0 | G0(레포 반영 + type-check + 스모크) | 0.5일 | STEP 3 완료(또는 선행 승인) |
| STEP 4 프론트 | D1 생성기·헤더·두 라우트·`--preview`·목업 Report·토큰·관문 컴포넌트·reducer·화면 골격 → D2~D3 가드·예산·컴포넌트·화면 → D4 통합(실제 엔진 연결, 렌더 금지어 검사, G5 로컬) → D5 버퍼·QA 인계 | 약 5일 | G0, 디자인 스펙 |
| STEP 4 백엔드 | API설계자 약 8~9일(카탈로그·스키마 → AWS 수집기 + shim → 린터·발자국·해시 → Azure 수집기 → CSV 파서·정규화 → Resource Graph·마스킹 → 적대 시나리오·통합) / DB설계자 약 9~10일(룰 스키마·엔진 core → 변이·회사 빌더 → AWS 판정 함수 → Azure 판정 함수 → 회사 4×2 + 정답지) | 약 10일(병렬) | G0 |
| STEP 4 문구 | 룰 18장 문구: DB설계자 초안 → 디자인 톤·금지어·제목×상태 검토 → 린트 | STEP 4 전반(D1~D4) | 디자인 카피 덱 |
| STEP 5 QA | G1~G7 + 이월 브라우저 항목 + 체험 D로 '확인 불가' 이해도 사전 점검(내부 2~3명) + 3개 브라우저 인쇄·4개 OS 폰트 | 2~3일 | STEP 4 |
| STEP 6 리뷰 | 기획 의도(약속, 금지어, 범위, 이 결정 표) 대비 검수 | 1세션 | STEP 5 |
| STEP 7 배포 | AWS 베타(띠 + noindex) → PM V1·V2(G8) → 띠 해제 릴리스 → Azure 같은 순서 → G9 | — | STEP 6, PM 승인 |

- **크리티컬 패스**: G0 → DB설계자(룰 18장 + 엔진 + 픽스처·정답지, 약 9~10일) → 통합 → QA → 배포. 프론트는 목업으로 앞서 가므로 경로에서 빠진다. 프론트 D4의 실제 엔진 연결은 DB설계자 D5 이후에 가능하므로, 프론트 D5 버퍼를 통합 대기에 쓴다.
- 두 번째 경로는 룰 문구 검수다(디자인 지적: 전체에서 가장 오래 걸리는 일). 제목부터 확정하고 템플릿·린트·검수 순서를 고정한다.
- **스코프 컷 순서**(위에서부터): 0. 화면 가리기 토글(D11) → 1. Before/After → v1.1 → 2. 쌍둥이 비교 보기 → v1.1 → 3. 예외 파일 내보내기·불러오기(리포트 안 표시만 남김) → 4. AZ-LOG-2 → 5. AWS-KEY-3을 안내 카드로 축소 → 6. (최후) Azure 전체 v1.1. **끝까지 지킬 것**: R-01~R-08, R-12, 5상태, 조회 범위 패널, 불변식, 정답지, 고치는 법 3단계, 금지어 린트, 다중 입력 병합(Azure CSV 경로에 필요).

---

## 10. 배포 시 주의(배포엔지니어 지침)

1. **remote는 `mingame`**이다. CLAUDE.md와 `teams/workflows/deploy.yaml`의 `git push origin main` 표기는 낡았다. 사전확인에서 `git remote -v`, `git fetch mingame`, `mingame/main` 대비 앞섬·뒤처짐, 직전 정상 SHA(롤백 기준선)를 기록한다. 2026-10-19 기준 HEAD = mingame/main = cc95172 [확인].
2. **다른 작업을 커밋에 섞지 않는다.** 지금 작업 트리에는 `/flight` 관련 45파일(코드·문서)이 **staged** 상태로 있고, `src/app/office/`와 다른 기획 문서가 untracked다 [확인: git status]. 그래서 deploy.yaml의 "`git status --porcelain` 공백" 조건이 성립하지 않는다. 대신 **경로 한정 커밋**을 쓴다.
   ```
   git add -- src/app/cloudcheck src/lib/cloudcheck <cloudcheck 문서 경로들>
   git commit -m "<메시지>" -- src/app/cloudcheck src/lib/cloudcheck <같은 문서 경로들>
   git show --stat HEAD     # cloudcheck 경로만 있는지
   git status               # /flight가 여전히 staged인지
   ```
   경로를 주고 커밋하면 다른 staged 변경은 커밋에 들어가지 않고 staged로 남는다 [확인: 스크래치 저장소에서 실험]. `/flight`를 unstage·restage하지 않는다(PM 작업 상태 보존). `git add -A`는 금지다.
3. **게이트**: `node -v` = 22(.nvmrc) → `npm ci` → `npm run type-check` → `rm -rf .next && npm run build`(출력에 `ƒ /cloudcheck`) → `npm run test`(생성물 동기, 가드, 헤더 스냅샷, 계약, 룰, 정답지, 수집기 린트·shim·해시가 모두 여기에 들어 있다).
4. **`npm run test:redline`**: 대상 3파일이 `_archive/tests/server/`로 옮겨져 "No test files found"로 exit 1이 난다 [확인]. **결과를 "N/A(대상 파일 아카이브됨)"로 기록하고 PM 확인을 받는다.** cloudcheck 커밋에서 `package.json`을 고치지 않는다. 스크립트 정리나 deploy.yaml 갱신은 별도 결정이다(Q15).
5. **env 드리프트**: cloudcheck는 `process.env`를 쓰지 않는다(grep 0) → 해당 없음.
6. **공유 파일**: 9종(tsconfig, package.json, lock, vercel.json, tailwind, vitest, layout, providers, globals.css) sha256 불변, `git diff --cached --stat`에 없음, `next.config.*`·`middleware.*` 미생성.
7. **시크릿 스캔**: 픽스처는 문서 표본 값만 쓴다(계정 ID 111122223333 등, 키 형태는 `AKIAIOSFODNN7EXAMPLE` 외 0, 0으로 채운 GUID). 누출 스캔 테스트 통과를 확인한다. 배포 저장소 `mingame_for_bdry`는 공개다 [확인: 기획서].
8. **프리뷰 승인**: 로컬 `next build && next start`에서 `/cloudcheck`(V0, 체험 C 리포트, 인쇄 미리보기) 스크린샷 → PM 명시 승인.
9. **push**: `git push mingame main`. force 금지, 배포 직렬화.
10. **라이브 검증**(최대 8~10분 폴링): `curl -sI "https://project-orsrw.vercel.app/cloudcheck?v=<SHA>"` 헤더가 §2-2와 같고 CSP 해시 = `PAGE.scriptHash`·`PAGE.styleHash` / 본문 sha256 = `PAGE.sha256` = `/cloudcheck/download` 본문 sha256 / 고유 콘텐츠(`<title>`의 "문단속 5", 베타 띠 문구) / 브라우저에서 Network 1건·CSP 위반 0 / `/pae`·`/moira`·`/exam`·`/witness` 회귀.
11. **롤백**: ① Vercel 대시보드 → Deployments → 직전 정상 배포 "Promote to Production"(권장, 재빌드 없음) ② `git revert --no-edit <SHA> && git push mingame main`.
12. 첫 배포는 프로덕션이지만 베타 띠 + noindex이고 홍보하지 않는다. sitemap은 손대지 않는다(수동 나열이라 미등록 [확인: 기획서]). 수집기 릴리스 태그와 SHA256SUMS 게시는 G9의 별도 외부 조치이며 PM 승인이 필요하다.

---

## 11. PM 확인 질문(최종)과 PM이 직접 할 일

### 11-1. 질문(답이 오기 전에는 기본안으로 진행)

| # | 질문 | 기본안 |
|---|---|---|
| Q1 | 화면 언어 | 한국어만. 일본어는 v1.1(원어민 검수 후). MVP에는 i18n 키 구조와 용어집 초안만 |
| Q2 | 주소 | 베타는 `project-orsrw.vercel.app/cloudcheck`. G9(PDF 공개) 전에 ① 유지와 ② 별도 Vercel 프로젝트·자체 도메인 중 결정. **기술 권고는 ②**(같은 origin의 `/api/*`와 미래의 Service Worker에서 분리. HTML이 같아 옮기는 비용이 작다 — 백엔드 의견). 자체 도메인(예: boundaryworks.team 하위) 보유·사용 의향 |
| Q3 | 이름 | 「문단속 5」(가제), 일본어 「戸締まりチェック」(가제) |
| Q4 | 출시 순서 | AWS 베타 → PM Azure 검증 → Azure 베타. PDF 링크는 검증 뒤 |
| Q5 | 측정 | 분석 도구 없음. 베타 인터뷰와 저장소 지표로만 |
| Q6 | 수익 | 광고 없는 무료 |
| Q7 | 소스 공개 | 베타는 배포 저장소(공개) 그대로. PDF에 인쇄할 수집기 전용 공개 저장소를 만들지는 G9 전에 결정 |
| Q8 | Azure 검증 환경 | 검증용 구독·Entra 테넌트, Entra ID P1/P2 라이선스 유무(AZ-MFA-1 편입 판단) |
| Q9 | 사람 | 베타 테스터 5~10명, v1.1 일본어 원어민 검수자 |
| Q10 | S1 프리뷰 배포 승인 | **필요 없음**(force-dynamic 채택. 라이브 헤더는 첫 베타 배포에서 확인) |
| Q11 | 만든 곳 표기 | V8과 페이지 바닥에 "만든 곳: Boundaryworks" + 저장소 링크(PDF와의 신뢰 연결) |
| Q12 | 가짜 회사 이름 | 반듯상회 · 멈춘시계상회 · 아슬아슬상회 · 반쯤본상회(STEP 3에서 확정. 실존 상호·상표 충돌 여부는 [미확인]) |
| Q13 | 인쇄·내보내기 마스킹 형식 | ID는 "••••" + 끝 4자리, 이름은 "<유형>-<순번>"(user-003). 대안: 이름 앞 2자 표시 |
| Q14 | 백엔드 선행 착수(STEP 3과 병행) | **기본은 순차**(오케스트레이션 규칙 1 준수). 팀장 권고는 **병행 허용**: 수집기·계약·엔진은 디자인 산출물이 필요 없고 크리티컬 패스가 줄어든다 |
| Q15 | `test:redline` 처리 | cloudcheck 배포에서는 N/A로 기록하고 진행. 스크립트 제거나 deploy.yaml 갱신은 별도 커밋으로 할지 PM이 결정 |

### 11-2. PM이 직접 할 일(우리 팀은 실계정에 접근할 수 없다)

검증 순서는 V1 빈·학습 계정 → V2 비프로덕션 → V3(선택) 프로덕션 읽기 전용이다. 기획서 §16-2를 유지하고, 백엔드가 추가한 항목을 넣었다.

- **AWS**: CloudShell 실행·업로드·다운로드 / `bash --version`, `jq --version`, `aws --version` 기록 / 자격증명 보고서 CSV의 열 목록(특히 `additional_credentials_info`)과 파일 이름의 시각 포함 여부 / 수집기 실행(SecurityAudit 역할 1회, 본인 권한 1회) — 걸린 시간·호출 수·막힌 호출 / 거부 오류 문구 1건 실측 / V1용 '무장은 됐지만 연결 안 된' 결함 심기와 철거(QA 체크리스트, 실제 노출은 만들지 않음) / CloudTrail 이벤트 기록 필터를 풀고 발자국 대조 / 정답지 대조(오탐·확인 불가 사유 기록) / 마스킹 골든 파일(기본은 '형태 스냅샷'만 커밋, 값이 필요한 회귀만 마스킹본 → 누출 스캔 → QA설계자·백엔드팀장 2인 승인 → PM 최종 확인) / Organizations 소속 여부.
- **Azure**: Cloud Shell(임시 세션 포함) 업로드·다운로드 / 구독 Reader만으로 `storage account list`·`container-rm list`·`nsg list`·`diagnostic-settings` 성공 여부 / `az account list --refresh` 동작 / 진단 설정 출력 형태(`value` 래퍼 여부) / 거부 오류 문구 1건 / Resource Graph 쿼리 2개의 CSV 열 구성 / Entra 라이선스·역할과 '사용자 등록 세부 정보' CSV(AZ-MFA-1 편입 판단).
- **공통**: GitHub·Vercel 2FA 확인 / ②를 고르면 Vercel 프로젝트와 도메인 생성 / G9에서 PDF 개정판에 정식 주소·저장소·수집기 전체 해시 인쇄.

---

## 12. 기획서 대비 변경(기획서 본문은 고치지 않음)

| 기획서 위치 | 변경 |
|---|---|
| §3-6 휴먼에러 | ⑦ **리포트 유실**(HTML 한 장 + 메모리 전용이라 생기는 실수)을 추가하고, 디자인 §1-3의 장치 6개(beforeunload, 외부 링크 새 탭 + 도메인 표기, 창 전체 드롭 가로채기, 새 점검 전 확인, V4→V3 복원, 유실 고지)와 `pushState` 관문을 채택 |
| §5-3 집계 | 분포 단위 = 점검(룰). 문장 순서는 위험 → 주의 → 확인 불가 → 이상 없음 → 해당 없음. 문 단위 상태는 엔진에만 두고 화면 배지로 그리지 않음. '항목'은 화면에서 '점검'·'대상'으로 |
| §5-4 INV-8·9 구현 | judge는 현재 시각·예외·본인 응답을 받지 않음. 시간 배너는 `timeNotices`, 예외는 `overlayExceptions`(만료 기준 = 오늘) |
| §5-5 / R-03 | "리포트 첫 화면" = 리포트 화면 최상단 블록(2열 압축)으로 해석(디자인 (f)) |
| §6 룰 제목 | 7개를 상태 중립형으로(§6-1 굵은 제목) |
| §6-1 공통 파라미터 | 미사용 90 → **45일**, 위험 포트 2단계(§6-3), 관리자급 정책 4종, 파라미터마다 공개 기준/도구 기준 표기, priority 10 간격 고유 정수 |
| §6-3 룰 데이터 필드 | `maxState` → `maxStatus`, `allowsGreen` → `allowsClear`, `cliExample` → 구조화 `CliTemplate`, 사유 코드 닫힌 목록 `reasonCodes` |
| §7-1 경로 표시 | '2개 + 대체 1개'(붙여넣기는 V2의 탭) |
| §7-2 수집기 원칙 | C-01 하드 상한 260줄 + 스타일 규칙(`\|\|`는 `\|\| rc=$?` 형태만, 행 끝 주석 금지, 배열 금지) / C-03 호출 26·9종 카탈로그(실시간 교차 확인용 `get-account-summary`·`list-users`·`list-access-keys`·`list-mfa-devices`·`list-account-aliases` 추가, 모두 SecurityAudit 포함) / C-04 예외: jq `@base64d` 1곳 / C-07 예외: 자격증명 보고서 CSV 원문 / C-10 "CI" = 배포 게이트 `npm run test` / C-11 수집기 주석은 한국어 + 마커 ID, 일본어는 페이지 오버레이(해시 고정) / 엔드포인트 변조 금지(L-11), 데이터 평면 명령 금지 / MVP는 AWS 상용 파티션만 |
| §7-4 수집 계약 | 스키마 ID `cloudcheck.collect/1.0`, `regionsSucceeded/Failed` 삭제(영수증에서 계산), `{receipt, value}` 슬롯, `run{finishedAt, confirmed, doors}`, `collector.tools`, `budget`, 수집기가 찍는 시각은 `Z` 고정, 다중 입력은 문 단위 선택(§4-8), Resource Graph 쿼리에 `tenantId`, CSV 경로 AZ-NET-1 최고 주의, CSV 기준 시각은 파일 이름 또는 `lastModified`(+ 배너) |
| §8-2 헤더 | 최종 문자열 §2-2(`blob:`·`font-src` 제거, TT 조건부, XFO, DNS 프리페치 off, Permissions-Policy 확장) |
| §8-3 격리 방식 | ① + `force-dynamic` 확정. 정적 헤더 유지 여부는 [미확인]으로 두되 의존하지 않음. G9 전 ② 권고(Q2) |
| §9-1·9-2 표현 | 무전송 약속 범위 축소 + 상시 고지, 면책 수정본(§7-2), 금지어 문맥 허용 목록과 키 단위 허용, 금지어에 '양호·보장·PASS·✓·어디에도 전송되지' 추가 |
| §10 예외 | 파일 형식 `{schema: "cloudcheck.exceptions/1.0", entries:[{ruleId, resource, reason, until, createdAt}]}`(`version` 키 → `schema`), 최대 90일, 만료되면 '만료되어 해제됨' 라벨 |
| §11 픽스처 | ② moto 실행 → 가짜 CLI shim 실행(+ PM V1 실측). 6케이스 중 4개는 변이로 파생. 정답지는 사람이 먼저 작성, 자동 갱신 금지 |
| §13 게이트 | §8 갱신본(G0 정의, G4 문구, G5 항목 보강, STEP 5 이월 항목) |
| §14-3 백엔드 역할 | CSV 파서·정규화·마스킹 사본은 API설계자, 엔진 core와 모델 산출 구현은 DB설계자, 금지어 목록은 `model/` 공동(변경은 기획팀장) |
| §14-4 스코프 컷 | 0순위로 화면 가리기 토글(D11) 추가, '끝까지 지킬 것'에 다중 입력 병합 추가 |
| §17-1 보류 | 서빙 위치 → ① 확정(G9 전 ② 재검토) / `require-trusted-types-for` → 조건부 채택 / CIS 미사용 기준일 → 45일 [확인] |
| §18 근거 | Vercel 커뮤니티 t/562는 정적 헤더가 사라진 사례가 아니라 **프리뷰 Deployment Protection이 요청을 가로챈 사례**다 → §14-1 '프리뷰 검증이 가려질 수 있음'의 근거로 옮긴다(프론트 정정) |

---

## 13. 남은 리스크와 미확인 이월

| 리스크 | 영향 | 대응 | 확인 시점 |
|---|---|---|---|
| 번들 비대(React + zod·계약 기본 약 215 KiB, 한국어 문구, 체험 데이터) | 첫 로드 지연 | `charset: 'utf8'`, 데이터 블록, 예산 테스트, V0 정적 렌더. 넘치면 문구·체험 데이터 축소 → 그래도 넘치면 Preact(v1.1, PM 승인) | D4 실측, G5 |
| Azure 출력 형태(진단 설정 `value` 래퍼, keyCreationTime 유무, Reader로 container-rm 가능 여부) [미확인] | Azure 판정 정확도 | 두 형태를 모두 받는 정규화, fail-closed, Azure 베타를 나중에 | PM V1(G8) |
| CloudShell jq 1.6 이하 [미확인] | MFA·KEY 수집 실패 | L-13 린트, `transform-failed` → 확인 불가 + CSV 경로 안내 | PM V1 |
| React 18 + Trusted Types 실브라우저 [미확인] | 화면 오류 | STEP 5 Chrome 전 화면, 실패 시 2지시어만 제거 | STEP 5 |
| `pushState`의 file:// 동작 [미확인] | 오프라인판 뒤로 가기 | try/catch → 이력 없는 모드 | STEP 5 |
| 룰 문구 분량(18장 × 7필드) | 일정 | 템플릿 + 린트 + 검수 순서 고정, 제목부터 | STEP 4 전반 |
| DB설계자 부하(크리티컬 패스) | 전체 일정 | 정답지 초안을 QA설계자가 일부 분담할 수 있게 STEP 5 착수 시점 조정, 스코프 컷 순서 적용 | STEP 4 중간 점검(D5) |
| 공개 저장소로 실명 유출 | 매우 큼 | 형태 스냅샷 기본, 누출 스캔, 2인 승인 + PM | G8 이후 골든 파일 커밋 때마다 |
| 수집기 해시가 자주 바뀌어 PDF와 어긋남 | 신뢰 | 주석 언어 고정, 일본어 오버레이, 수집기 동결 뒤 G9 | G9 |
| 배포 계정 탈취 시 레포 안 3중 일치는 그대로 통과 | 공급망 | 2FA, RELEASES.json 추가 전용, PDF 해시와 라이브 해시 수동 대조, 서명은 나중 | G9 이후 주기 |
| 간접 의존 esbuild의 버전·위치 변동 | 생성 실패 | lockfile 고정, 생성물에 버전 기록, 불일치면 테스트 실패 → 재생성 또는 B안(PM 승인) | 상시 |
| Tailwind가 `src/app/**`(생성물 포함)를 스캔 | 전역 CSS 바이트 변화 | G5에서 규칙 수 +0 확인 | G5 |

**미확인 사실 목록(제품 문구 금지)**: 정적 헤더의 Vercel 유지 / 콘솔 자격증명 CSV의 생성 시각 / `GenerateCredentialReport`가 CloudTrail에서 읽기로 기록되는지 / Azure Reader 권한 범위와 RBAC 작업 이름 / Azure Cloud Shell 임시 세션 업로드·다운로드 / Resource Graph CSV 열 구성과 행 한도 / AZ-LOG-1 범주 그룹 매핑 / CloudShell jq 버전 / Azure 오류 문구 형식 / EC2.19의 프로토콜 범위 / 가짜 회사 이름의 상표 충돌.

---

## 부록. 근거

- 이번 라운드 1차 확인: [Security Hub IAM 컨트롤(IAM.3, IAM.22)](https://docs.aws.amazon.com/securityhub/latest/userguide/iam-controls.html) · [Security Hub EC2 컨트롤(EC2.18, EC2.19)](https://docs.aws.amazon.com/securityhub/latest/userguide/ec2-controls.html)
- 레포·실행 확인: `git rev-parse`(HEAD = mingame/main = cc95172, origin/main = d2beb3b), `git log`(4b47f58에서 redline 테스트 아카이브), `tailwind.config.ts`(`src/app/**` 스캔), `src` 전체 `serviceWorker` 0건, 설치 버전(esbuild 0.21.5, zod 3.25.76, typescript 5.9.3, react 18.3.1, vite 5.4.21), 경로 한정 커밋 실험, G0 코드 컴파일·실행(스크래치패드 `g0/`)
- 검토 원문의 근거(각 원문의 출처 목록 유지): 백엔드(AWS IAM 자격증명 보고서, GetCredentialReport·GenerateCredentialReport API, AWS CLI 반환 코드, S3 ListBuckets 2024-10, CloudShell 환경, SecurityAudit, az storage container-rm, az monitor diagnostic-settings subscription, Azure CLI README) · 프론트(OSV GHSA-67mh-4wv8-2f99, Vercel Community t/562) · 기획서 §18
