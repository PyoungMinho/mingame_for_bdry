# 「문단속 5」(cloudcheck) 테스트 설계서 — STEP 5 QA (@QA설계자)

> 작성: @QA설계자(Opus) · 2026-10-19 · 다음 단계: @QA실행자(테스트 구현·실행·버그 리포트 `docs/qa/cloudcheck-bug-report.md`)
> 기준 문서: 기획서 `docs/planning/cloudcheck-plan.md`(§5·§6·§8·§9·§13) · 방향서 `docs/planning/project-direction-cloudcheck.md`(§2·§4·§5·§6·§7·**§8 G0~G9**·§10) · 디자인 `docs/design/cloudcheck-design-final.md`(G-D1~28, §12) · 룰 문구 검수 `docs/design/cloudcheck-rule-copy-review.md`(F-1~10, K-1~6) · 프론트 `docs/frontend/cloudcheck-frontend-final.md` · 백엔드 `docs/backend/cloudcheck-backend-final.md`
> 코드 기준: 작업 트리의 `src/app/cloudcheck/**`, `src/lib/cloudcheck/**`(미커밋, 2026-10-19 23시 기준)
> 표기: **[확인: 실행]** 이번 세션에 레포 코드를 실제로 돌려 재현 / **[확인: 코드]** 코드를 읽어 확인 / **[미확인]** 확인 못 함
> 레포 변경: 이 문서 1개만. 탐색 스크립트는 세션 스크래치패드 `…/scratchpad/qa/probe1~5.ts`에 있다(레포 밖, §부록 A).

---

## 0. 결론 요약

1. **기존 자동화는 두텁다.** cloudcheck 경로만 85파일 2,896개 테스트가 49.5초에 통과한다 [확인: 실행 `npx vitest run src/lib/cloudcheck src/app/cloudcheck`]. 6케이스·정답지·INV 속성 테스트·가드(AST·번들)·수집기 린터·shim이 이미 있다.
2. **빈 곳은 세 가지다.** ① 원시 파일(수집 JSON·CSV) 수준의 **값 변조**에 대한 "이상 없음이 새로 생기지 않는다" 검사가 없다(파서 퍼즈는 불변식만 본다) ② 변이가 **문 데이터의 최상위 슬롯**까지만 내려간다(버킷·사용자·키 같은 대상별 슬롯은 안 건드림) ③ **실브라우저 행동**(전 화면 요청 수·저장소·CSP/TT 위반)과 **라이브** 확인이 남았다.
3. **탐색에서 fail-open(근거 없이 '이상 없음')을 9가지 재현했다** [확인: 실행]. 가장 큰 것은 **기준 시각보다 늦은 증거를 '0일 지남'으로 보는 문제**(CR-01, 높음)다. CSV 경로에서 PC 시계가 늦거나 파일 시각이 1970이면, 322일 된 액세스 키가 '이상 없음'이 되고 시간 알림도 뜨지 않는다. 나머지 8가지: ② Azure 활동 로그 모수의 신원 미검증(개수만 비교) ③ AWS-NET-1이 해석 못 한 포트·프로토콜을 조용히 버림 ④ '인터넷 전체'를 문자열로만 판정(0.0.0.0/1+128.0.0.0/1, AzureCloud 태그) ⑤ AWS-KEY-4의 모르는 Effect·와일드카드 플래그·빈 문장·ExternalId 연산자 ⑥ CloudTrail 고급 선택기 readOnly ⑦ CloudTrail 전송 오류(결정 필요) ⑧ Azure에서 요청했지만 보이지 않는 구독 ⑨ 프리픽스 리스트 출발지(결정 필요)(§3). 별도로, 위험·주의 행의 꼬리표가 일부만 본 경우에도 "확인한 범위: 계정 전체"라고 쓴다(CR-06, 표현).
4. **출시 판정(§10)**: 지금은 **G1·G7을 닫을 수 없다.** 차단 3건(CR-01, CR-06 꼬리표 과장, CR-02는 Azure 공개 전 차단)을 고치고 P0 자동 테스트가 초록이면 "베타 · 실계정 검증 전 + noindex" 배포가 가능하다. 값 해석 문제(CR-03·05)와 결정이 필요한 4건(D-1~D-4)은 G8(PM V1) 전까지 닫는다.
5. 제외(해당 없음) 경로 7곳은 백엔드 요청대로 같은 관점으로 다시 봤다. **읽지 못한 값이 '제외'로 빠지는 길은 없다** [확인: 코드, §6-3]. 회귀 테스트로 못 박는다(FO-07).

---

## 1. 테스트 범위

| 구분 | 포함 | 제외(이유) |
|---|---|---|
| 엔진·룰 | 18장(출시 17) 판정, 집계·증명·제외 경로, 시간 알림, 예외 오버레이, 비교 | AZ-MFA-1 판정 로직(`released:false`, 열 구성 미확인) — 리포트에 안 나오는 것만 확인 |
| 파서 | recognize·buildInput·정규화(AWS·Azure·CSV 3종)·비밀 가림·마스킹 사본·예외 파일 | Entra CSV 판정(AZ-MFA-1 편입 뒤) |
| 수집기 | 린터·shim 실행·해시·TTY 경로·bash 5 구문 | 실제 AWS·Azure 호출(PM V1 = G8) |
| 화면 | V0~V8, 체험 A~D×2, 드롭·붙여넣기·예외·인쇄·마스킹 사본·오프라인판·비교 | 일본어(v1.1) |
| 격리·전송 | 헤더, 요청 수, 저장소, CSP/TT, COOP, file:// | 브라우저 확장·자동 번역(페이지가 막을 수 없음 — 고지로 처리) |
| 브라우저 | Chrome(자동, CDP) | Safari·Firefox는 수동 표(§4-6 UI-10). 이 맥에 Firefox 없음, Safari 자동화는 사용자가 '원격 자동화 허용'을 켜야 함 [확인: 실행] |

---

## 2. 테스트 전략 — 게이트별 분류

열 뜻: **기존** 이미 자동화(통과 중) / **추가** QA실행자가 만들 자동 테스트(§4 ID) / **브라우저** 실브라우저·헤드리스 / **PM V1** 실계정 실측(G8) / **라이브** 배포 후

| 게이트 | 기존 | 추가 | 브라우저 | PM V1 | 라이브 |
|---|---|---|---|---|---|
| **G1 엔진** | `engine/judge.test.ts`(INV-1·2·4·7·9, 위조 증명, 던지는 룰, 시드 고정 변이), `fixtures/e2e.test.ts`(회사 8곳 × 증거 제거 변이: 새 이상 없음 0), `parse/mutation-fuzz.test.ts`(값 망가뜨려도 던지지 않음·불변식) | **FO-01** 원시 변이 단조성, **FO-02** 비정상 값, **FO-03** 대상별 슬롯 제거, **FO-04** 모수 신원, **FO-05** 시각 역전, **FO-06** 생성 속성 + 차등 오라클, **FO-07** 제외 경로 전수, **FO-08·09** 백엔드 요청 사례, **FO-10** CSV 경로 '없음' 불가, FO-11 순수성 보강 | — | CR-01 실측 근거(콘솔 CSV 파일 이름·lastModified) | — |
| **G2 룰** | `rules/six-cases`·`registry`·`micro-expectations`·`copy-review`·`boundaries`·`params` | EX-04(제목×상태 렌더), 명세 차이 기록(CR-04의 AZ-NET-1 서비스 태그·ASG 부분) | — | 콘솔 영문 라벨(F-2) | — |
| **G3 정답지** | `answers.test`(100%, tolerate 0), e2e 정답지 대조 | **AN-01** 사람 재판정 표본(≥60행), AN-03 "None" 변경 확인, AN-04 자동 생성 경로 0 | — | 실계정 정답지 대조(오탐률) | — |
| **G4 수집기** | `lint.test`(L-01~14 + 린터의 린터 408), shim AWS 16·Azure 8 시나리오, `release.test`(해시 3중), bash 3.2 `-n` | **CL-01** 우회 샘플 확장, CL-02 endpoint-guard 변이, **CL-03** TTY 경로(expect), CL-04 bash 5 `-n`(로컬 도커, 설치 없음), CL-05 시계 뒤처짐 shim, CL-06 요청 범위 밖 리전·구독 | — | jq 1.6·bash 5.x 실제 실행, CLI 출력 모양, 오류 문구 | 수집기 해시 = 페이지 = SHA256SUMS(G9) |
| **G5 격리** | `serve.test`(헤더 스냅샷·두 라우트 같은 바이트), `generated.test`(해시 4중·금지 토큰·데이터 블록·부팅 계약), `guards.test`(R-06·R-07 정적) | **ISO-02** 런타임 스파이(jsdom, 커밋된 HTML로 전 흐름) | **ISO-03** CDP 전 화면 스윕(요청·저장소·CSP/TT·콘솔), **ISO-04** file://, ISO-05 COOP·iframe, UI-10 Safari·Firefox 수동 | — | **LV-01~10**(헤더·br·해시·Network 1건·SW 0·회귀 라우트·LCP/CLS) |
| **G6 입력 안전** | `hostile.test`, `recognize.test`(상한·깊이·키 파일), `redaction-fuzz`, `leak-scan`, G-D8 적대 픽스처 렌더 | **IN-01~12**(XSS 전 필드 실엔진, 보이지 않는 문자, 크기·깊이 경계, 인코딩, 비밀 모양, 키 파일 변종, `__proto__`, 긴 이름, CSV 함정, 예외 파일) | IN-01·IN-09는 CDP에서도 | — | — |
| **G7 표현** | 카탈로그 정적 금지어(C·S·E), `demo-real`(체험 V3·V4 렌더), `render-lint`(내부 표기 누출) | **EX-01** 전 화면 렌더 + 속성 + `document.title`, EX-02 면책·고지, EX-03 파라미터 조합, EX-04 제목×상태, **EX-05** 꼬리표 정직성 | 인쇄 결과(UI-06) | — | — |

**우선순위 원칙**: P0 = 판정이 틀리거나(이상 없음 과신) 격리·입력 안전이 깨지는 것. P1 = 접근성·인쇄·화면 폭·키보드·수집기 실행 경로. P2 = 성능.

---

## 3. 탐색 실행 결과 (이번 세션 재현)

방법: 가짜 회사 JSON·CSV를 고쳐 `recognize → buildInput → judge` 전체 경로에 넣었다(레포 무변경, 스크립트는 부록 A). "기대"는 기획서·방향서 원칙(증거 없으면 초록 없음, P3 '모르는 열거값은 해석 불가')에서 나온 값이다.

| # | 입력(원본 → 변조) | 기대 | 실제 [확인: 실행] | 관련 지적 |
|---|---|---|---|---|
| E-01 | CSV 자격증명 보고서, 키 회전 2025-12-01·마지막 사용 2026-10-15, `lastModified` = 2026-01-01(PC 시계 늦음) | AWS-KEY-1 주의(실제 322일) | **이상 없음**, `timeNotices` 빈 배열(같은 시계라 못 잡음) | CR-01 |
| E-02 | 같은 CSV, 파일 이름 `status_reports_2026-01-01T00_00_00Z.csv` | 주의 | **이상 없음** | CR-01 |
| E-03 | CSV, 2020년 키(2020-02 이후 미사용), `lastModified` = 0(1970-01-01) | KEY-1·KEY-2 주의 | **KEY-1·KEY-2 이상 없음**(매우 오래된 사진 알림만) | CR-01 |
| E-04 | Azure 수집 JSON의 `collectedAt`을 키 생성 시각보다 이르게(로컬 CLI 시계 늦음) | AZ-KEY-1 대상 주의 유지 | 주의였던 대상 2개가 **이상 없음(keys-rotated)** | CR-01 |
| E-05 | Azure `activityLogExports`의 구독 b2 항목을 범위 밖 구독 b3로(개수 같음, 영수증 구독도 b3) | 확인 불가(b2를 못 봄) | **AZ-LOG-1 이상 없음** | CR-02 |
| E-06 | (대조) 같은 바꿔치기를 `storageAccounts`에 | 확인 불가 | 확인 불가(subscription-missing) — 이 패밀리는 맞게 막힘 | — |
| E-07 | AWS SG 인바운드 tcp `fromPort 3389 · toPort 22`(거꾸로), 0.0.0.0/0 | 확인 불가 | **AWS-NET-1 이상 없음** | CR-03 |
| E-08 | tcp `-1..-1`, 0.0.0.0/0 | 확인 불가 | **이상 없음** | CR-03 |
| E-09 | protocol `"TCP "`(뒤 공백), 22, 0.0.0.0/0 | 확인 불가 또는 위험 | **이상 없음** (Azure는 trim해서 위험) | CR-03 |
| E-10 | 22번 출발지 `0.0.0.0/1` + `128.0.0.0/1`(인터넷 전체와 같음), 공인 IP ENI 연결 | 위험(또는 최소 주의) | **이상 없음** | CR-04 |
| E-11 | Azure NSG 22번 출발지 `0.0.0.0/1`+`128.0.0.0/1` / `AzureCloud` | 위험·주의(기획서 §6-2: 서비스 태그·ASG는 주의) | **둘 다 이상 없음** | CR-04 |
| E-12 | AWS-KEY-4 `Principal:*`, Effect `"Allow "`·`""`·`"Permit"` | 확인 불가(모르는 값) | **이상 없음** (`"allow"`는 위험 — 대소문자만 처리) | CR-05 |
| E-13 | `aws:["*"]`인데 `wildcard:false` | 위험 | **이상 없음**(플래그만 믿음) | CR-05 |
| E-14 | 외부 계정 신뢰 + 조건 키 `Null:sts:ExternalId` / `StringNotEquals:sts:ExternalId` | 주의 | **이상 없음** | CR-05 |
| E-15 | 신뢰 정책 문장 0개 | 확인 불가 | **이상 없음** | CR-05 |
| E-16 | CloudTrail 고급 선택기 `eventCategory=Management` + `readOnly` Equals 빈 배열(NotEquals를 수집기가 버린 모양) | 확인 불가 | **이상 없음** | CR-07 |
| E-17 | CloudTrail `isLogging:true` + `hasDeliveryError:true` | 주의(로그가 저장 안 됨) — **결정 필요** | 이상 없음 | CR-07 / D-2 |
| E-18 | SG 22번 열림, ENI 목록 잘림(truncated) | 주의 + '연결 확인 못 함' | 주의지만 사유가 **'연결된 인터페이스 없음(sg-unattached)'** | CR-12 |
| E-19 | aws-C 버킷 목록 예산 초과(3개 중 2개만 조회) + 공개 버킷 | 위험 + 범위 일부 표시 | 위험, coverage `{account-global, proven:false}` → 화면 꼬리표 **"확인한 범위: 계정 전체"** | CR-06 |
| E-20 | 다른 계정(999988887777) 행을 이어 붙인 자격증명 CSV | 계정 섞임 거부·모호 | 계정 …3333으로 판정, `scopeProven:true`, 다른 계정 사용자가 MFA-2 위험으로 들어감 | CR-09 |
| E-21 | Azure `subscriptionsRequested`에 보이지 않는 구독 b9 포함 | 범위 미증명·알림 | `scope.proven:true`, 빠진 구독 0, AZ-LOG-1 이상 없음 | CR-10 |
| E-22 | IAM 사용자 이름 `admin` + U+3164(한글 채움)·U+00AD·U+180E·U+2061·U+FFA0·U+115F | V2·V3 모두 치환 + '특이 문자' 라벨 | V2는 치환, **V3(리포트)는 그대로·플래그 없음** | CR-08 |
| E-23 | 예외 파일 사유에 `AKIAIOSFODNN7EXAMPLE` | 화면에서 가림(R-12) | 화면 값 `full`에 원문 그대로(인쇄는 •••) | CR-11 |
| E-24 | `--regions`로 일부 리전만 | 확인 불가 | 확인 불가(region-missing) — 맞음 | — |
| E-25 | SG 22번 출발지가 프리픽스 리스트뿐(공인 IP ENI 연결) | 주의(내용을 못 봄) — **결정 필요** | 이상 없음(못 보는 것으로만 고지) | CR-17 / D-4 |

정답지 표본 재판정: 아슬아슬상회 AWS(C.aws)의 IAM 5룰(AWS-MFA-1·MFA-2·KEY-1·KEY-2·KEY-3) 14행을 회사 데이터와 명세만 보고 다시 판정했다 → **정답지와 전부 일치** [확인: 실행 데이터 덤프 + 수기 판정]. 나머지는 AN-01.

---

## 4. 테스트 케이스

### 공통 규칙(QA실행자)
- **위치**: 자동 테스트는 `src/lib/cloudcheck/qa/**`(방향서 §3: QA 소유)에 둔다. vitest 자동 수집 경로다. 화면 테스트 파일은 첫 줄에 `// @vitest-environment jsdom`. 화면 하네스는 `src/app/cloudcheck/_client/screens/__tests__/harness.tsx`와 `generated.test.ts`의 부팅 계약 코드를 import·참고한다. 파일을 더한 뒤 `npx vitest run src/app/cloudcheck/_build/guards.test.ts src/app/cloudcheck/_build/generated.test.ts`가 그대로 초록인지 확인한다.
- **헤드리스 브라우저 스크립트**는 레포 밖 스크래치패드(`…/scratchpad/qa/`)에 둔다. 프론트가 만든 `…/scratchpad/cdp-check.mjs`(CDP 드라이버, Chrome 경로 고정)를 복사해 확장한다.
- **확인된 버그를 담는 테스트**는 원하는 동작으로 쓰되 `it.fails(…)`로 표시하고 이름에 버그 ID를 붙인다(예: `it.fails("[CC-QA-01] CSV 기준 시각보다 늦은 증거는 이상 없음을 만들지 않는다", …)`). 레포 전체 `npm run test`는 다른 앱의 배포 게이트이기도 하므로 빨갛게 두지 않는다. 고쳐지면 `it`으로 바꿔 회귀 테스트가 된다. 차단 버그는 `.fails`가 남아 있으면 G1~G7을 닫지 않는다(§10).
- **오라클 재사용**: `fixtures/report-invariants.ts`의 `checkReport`, `contract/normalized-invariants.ts`의 `checkInvariants`, `model/banned-words.ts`의 `findBanned`. 상태 순위는 `clear·na`를 '없음 결론'으로 묶어 본다.
- **시간 예산**: QA 테스트 전체가 cloudcheck 스위트에 더하는 시간은 60초 이하. 큰 변이 집합은 시드 고정 표본(케이스당 ≤3,000회 파이프라인)으로 자른다.
- 정답 판단이 명세와 코드에서 갈리면 테스트를 지우지 말고 `docs/qa/cloudcheck-bug-report.md`에 '명세 확인 필요'로 올린다.

### 4-1. P0 — fail-open 탐색 (G1)

| ID | 목적 | 입력 | 기대 | 위치 | 현재 예상 |
|---|---|---|---|---|---|
| **FO-01** | 원시 파일 수준 증거 제거의 단조성 | 회사 JSON 8개 + AWS CSV 4개. 리프 변이: 값 `null`·삭제·빈 배열, 영수증 `result`를 `denied`/`error`/`throttled`/`truncated`로(실패면 값 `null`도 같이), 섹션 삭제, 리전·구독 항목 삭제. 시드 고정 표본 | 각 변이 뒤 **어떤 룰도 위험·주의·확인 불가 → 이상 없음·해당 없음으로 가지 않는다**, 같은 MatchKey 대상이 이상 없음이 아니던 것이 이상 없음이 되지 않는다, 거부된 파일(not-cloudcheck 등)은 통과로 본다, `checkReport` 위반 0 | `qa/fo-raw-mutation.test.ts` | 통과 예상 |
| **FO-02** | 모르는·비정상 값은 '해석 불가'(P3) | 아래 '열거형 필드 목록'의 각 값을 ① 앞뒤 공백 ② 빈 문자열 ③ 모르는 토큰(`"zzz"`, `"Allowed"`, `"Inbound "`) ④ 숫자: `-1`·`65536`·from/to 맞바꿈 ⑤ 시각: 수집 시각 + 2년 으로 바꾼다(회사 8개, 특히 C·B) | FO-01과 같은 오라클 + **원래 위험이던 룰이 이상 없음·해당 없음이 되지 않는다**(위험 → 확인 불가는 허용) | `qa/fo-unexpected-values.test.ts` | **실패 예상**(E-07~16): AWS-NET-1, AWS-KEY-4, AWS-LOG-1 → `it.fails` |
| **FO-03** | 대상별 슬롯 제거(중첩) | NormalizedInput에서 대상 하나의 슬롯을 `missing(field-missing)`·`partial`·`none`으로: 버킷 `publicAccessBlock·policyStatus·acl·ownership·website·region`, 사용자 `passwordEnabled·mfaActive·keys·createdAt·passwordLastUsed·attachedPolicyArns·groupNames`, 키 `active·createdAt·lastUsed`, trail `status·selectors`, 스토리지 계정 `allowBlobPublicAccess·allowSharedKeyAccess·key1/2CreatedAt·containers·blobDiagnostics`, NSG `rules[i]·nicIds·subnetIds`. 기존 `fixtures/mutate.ts`는 최상위·리전별 `items`까지만 내려간다 → QA 쪽에 중첩 변이 도우미를 새로 만든다(DB설계자 파일은 고치지 않음) | 이상 없음이 아니던 대상·룰이 이상 없음·해당 없음이 되지 않는다. `none` 변이는 '설정 없음' 뜻이 바뀌므로 결과 변화는 허용하되 **위험 → 이상 없음**만 금지 | `qa/fo-nested-drop.test.ts` | 통과 예상 |
| **FO-04** | 모수 신원(개수만 같으면 통과하는 구멍) | 대상 집합을 바꿔치기하되 개수를 유지: Azure `activityLogExports`·`storageAccounts`·`nsgs`·`nics`·`publicIps`의 구독 ID를 범위 밖 GUID로(영수증 구독도 같이), AWS 리전 항목의 `region`을 비활성 리전으로, 같은 사용자·버킷을 두 번 넣고 하나를 뺌 | 영향 룰은 확인 불가. 일반 속성: 이상 없음·해당 없음 룰의 (대상 + 제외) MatchKey 집합 = QA가 원시 파일에서 따로 센 열거 집합 | `qa/fo-population-identity.test.ts` | **AZ-LOG-1 실패 예상**(E-05) |
| **FO-05** | 기준 시각보다 늦은 증거 | ① CSV `lastModified`가 보고서 안 시각보다 이름(E-01) ② `lastModified` 0과 1980-01-01 ③ 파일 이름 시각이 내용보다 이름(E-02) ④ Azure `collectedAt` < `keyCreationTime`(E-04) ⑤ AWS 수집 JSON `collectedAt` < 보고서 `generatedTime` − 5분 ⑥ shim `fakeNow`를 실제보다 이르게 한 수집 결과(CL-05) | 해당 대상·룰은 이상 없음·해당 없음이 아니다(확인 불가: `stale-evidence` 또는 `value-unrecognized`). 권고: 리포트 알림 1개(예: 기준 시각과 파일 내용 시각이 맞지 않음) | `qa/fo-time-skew.test.ts` | **실패 예상**(전부) |
| **FO-06** | 생성 속성 + 차등 오라클 | fast-check(시드 고정, 룰당 200~300회)로 무작위 세계 생성: SG·규칙·ENI(공인 IP·IPv6), 버킷(계정·버킷 차단 4개, 정책 공개, ACL 부여, 소유권, 웹사이트), 역할 신뢰 문장, NSG 규칙·NIC·공인 IP, 컨테이너. 값에 비정상 값을 10% 섞는다. QA가 **명세 문장만 보고** 짠 최소 참조 판정기(AWS-NET-1, AWS-STO-2, AWS-KEY-4, AZ-NET-1, AZ-STO-2)와 엔진의 대상별 상태를 비교 | 불일치 0. 불일치는 '엔진 버그 / 명세 모호 / 참조기 버그'로 분류해 버그 리포트에 남긴다. 공통 속성: `checkReport` 위반 0, 이상 없음 대상의 증거 영수증은 모두 ok·empty·notconfigured | `qa/oracle-*.test.ts` | 비정상 값 섞인 회차에서 CR-03·04·05 재현 예상 |
| **FO-07** | 제외(해당 없음) 경로 전수(백엔드 요청 5) | 제외 7곳 각각에 대해 결정 슬롯을 `missing(denied·field-missing·value-unrecognized)`·`partial`·`none`·보고서 신선도 실패로: AWS-MFA-1:141(비밀번호 FALSE + 키 없음), MFA-2:74(콘솔 비밀번호 없음), KEY-1:78(비활성 키), KEY-2:136(활성 자격증명 없음), KEY-3:77·112(활성 키 없음·관리자 아님), KEY-4:120(서비스 연결 역할) | 제외가 아니라 확인 불가. 룰이 '해당 없음'이 되려면 모든 대상이 '답'인 증거로 제외될 때만 | `qa/fo-exclusion-paths.test.ts` | 통과 예상(§6-3) |
| **FO-08** | 백엔드 새 micro 사례를 변이 집합에 | `AZ-STO-2/access-unreadable`, `AWS-KEY-4/wildcard-action`, `AZ-LOG-2/audit-group` + FO-01·03 변이. 값 변종: `publicAccess` `"None"`·`"none "`·`"Private"`·`""`·`null`, 액션 `sts:Assume*`·`sts:AssumeRole?ithSAML`·`*`·`STS:ASSUMEROLE`·`sts:*`·`sts:TagSession`만·`iam:PassRole`만 | `audit-group` = 확인 불가 유지, `access-unreadable` = 확인 불가, 와일드카드 액션 = 위험, 역할 맡기 액션이 아닌 문장만 있으면 이상 없음(정상) | `qa/fo-backend-cases.test.ts` | 통과 예상 |
| **FO-09** | 입력 안전 사례(백엔드 요청 2) | 활성 리전 빈 배열, 신뢰 정책 `Statement`가 객체 하나(수집기 `trust:null`), `publicAccess` null·모르는 값, 와일드카드 액션 | 창문 = 확인 불가(scope-unproven), 그 역할 = 확인 불가, 컨테이너 = 확인 불가, 위험 | `qa/fo-backend-cases.test.ts` | 통과 예상 |
| **FO-10** | CSV 경로는 '없음'을 못 만든다(INV-4, F-10) | ① Azure 회사 4개 JSON에서 QA가 Resource Graph CSV 2종(`cc-rg-storage/1`, `cc-rg-nsg/1`)을 만들어 단독·조합 입력 ② AWS 보고서 CSV에서 `additional_credentials_info` 열 삭제·값 있음 | AZ-STO-1·AZ-KEY-1·AZ-NET-1 이상 없음·해당 없음 0, AZ-NET-1 최고 주의, CSV 경로 위험·주의 ⊆ 수집기 경로 위험·주의. AWS KEY-1·KEY-2 이상 없음 0 | `qa/fo-csv-paths.test.ts` | 통과 예상 |
| FO-11 | 순수성 보강 | Azure·CSV(lastModified 고정) 입력 두 번, 입력 순서 바꿈(CSV + JSON), `vi.setSystemTime` 다르게 | Report 바이트 동일, 시간 알림만 달라짐 | `qa/fo-purity.test.ts` | 통과 예상 |

**FO-02 열거형 필드 목록**(수집 JSON 경로)
- AWS: `iamRoles.value[].trust[].effect·actions[]·principal.wildcard·principal.aws[]·conditionKeys[]·path` / `securityGroups[].items[].ingress[].protocol·fromPort·toPort·cidrs[]·ipv6Cidrs[]` / `networkInterfaces[].items[].groupIds[]` / `buckets.items[].acl.value.publicGrants[].grantee·ownership.value.objectOwnership` / `trails.value[].selectors.value.basic[].readWriteType·advanced[].fields[].field·equals[]` / `iamUsers.items[].accessKeys.value[].status` / 보고서 CSV 칸 `password_enabled·mfa_active·access_key_N_active`(`True`, ` TRUE`, `yes`, `1`, `not_supported`)과 날짜 칸
- Azure: `storageAccounts[].items[].containers.value[].publicAccess·blobDiagnostics.value[].logs[].category·categoryGroup` / `activityLogExports[].items[].logs[]` / `nsgs[].items[].rules[].direction·access·protocol·priority·sourcePrefixes[]·destPortRanges[]`

### 4-2. P0 — 정답지 독립 검증 (G3)

| ID | 목적 | 방법 | 기대 | 위치 |
|---|---|---|---|---|
| **AN-01** | 사람 재판정 | 정답지 8개에서 **이상 없음·해당 없음 행 전부 + 위험 행 전부 + 확인 불가 사유가 둘 이상인 행**을 고른다(≥60행). `fixtures/companies/worlds-*.ts`의 정의와 회사 JSON·명세(기획서 §6-2, 방향서 §6)만 보고 상태·사유 slug를 QA가 직접 적는다(엔진·정답지 파일을 보지 않고 먼저 적는다). 결과를 데이터 파일로 남긴다(커밋은 메인 세션 몫) | QA 표 = 엔진 출력 = 정답지. 셋 중 하나라도 다르면 버그 리포트(정답지 오류인지 엔진 오류인지 명시) | `qa/answers-independent.data.ts` + `qa/answers-independent.test.ts` |
| AN-02 | 100% 일치·tolerate 0 | 기존 `answers.test`·e2e 실행 결과 기록 | 초록 | (기존) |
| AN-03 | Azure 비공개 컨테이너 `"None"` 변경 확인(백엔드 요청 4) | Azure 회사 4개의 모든 컨테이너 `publicAccess ∈ {"None","Blob","Container"}`, null 0 | 맞음 + 정답지 상태·사유 변화 0 | `qa/answers-independent.test.ts` |
| AN-04 | 정답지 자동 생성 경로 0 | 정적 검사: `fixtures/answers.ts`·`answers/*.json`을 쓰는 코드가 없고 `answers.ts`가 `engine/judge`를 import하지 않음 | 0건 | `qa/answers-independent.test.ts` |

이미 끝낸 표본: C.aws IAM 5룰 14행 일치(§3). AN-01 표에 그대로 옮겨 적는다.

### 4-3. P0 — 격리 (G5)

| ID | 목적 | 입력·절차 | 기대 | 위치 |
|---|---|---|---|---|
| ISO-01 | 헤더 | 기존 `serve.test` 스냅샷 확인 + (실행 권한이 있으면) 로컬 `next start`에서 `GET`과 `HEAD` 응답 헤더 비교. 권한이 없으면 LV-01로 미룬다 | 방향서 §2-2와 같고 HEAD = GET 헤더 | (기존) + LV-01 |
| **ISO-02** | 런타임 스파이(행동 가드) | 커밋된 `PAGE.html`을 jsdom에서 실행(generated.test의 부팅 계약 방식). 실행 전 `localStorage`·`sessionStorage`·`indexedDB.open`·`document.cookie` setter·`caches`·`navigator.serviceWorker.register`·`fetch`·`XMLHttpRequest`·`WebSocket`·`EventSource`·`navigator.sendBeacon`·`Image`·`window.open`·`history.replaceState`·`location.assign/replace`·`navigator.clipboard`에 스파이를 단다. 흐름: V0 → 체험 C(AWS) → V3 → V4 → 뒤로 → V7 → V8 → V1(수집기 내려받기) → V2(파일 2개 + 붙여넣기) → V3 → 예외 표시·내보내기·불러오기 → 마스킹 사본 → 인쇄 버튼(`window.print` 모의) → 새 점검 | 스파이 호출 0(Blob URL 생성·해제는 허용), `history.pushState` 인자는 `({cc:<ScreenId>}, "")`만 | `qa/isolation.runtime.test.ts` |
| **ISO-03** | 실브라우저 전 화면 스윕(Chrome, CDP) | 로컬 오프라인판 바이트를 `file://`로(ISO-04) 그리고 서버 URL(실행 권한이 있을 때)로. CDP `Network`·`Log`·`Audits`·`Runtime` 구독. V0~V8, 체험 A~D × AWS·Azure, 파일 드롭(`Input.dispatchDragEvent`), 파일 고르기(`DOM.setFileInputFiles`), 붙여넣기, 예외 불러오기, 인쇄 미디어(`Emulation.setEmulatedMedia print` + `Page.printToPDF`), 내려받기(`Browser.setDownloadBehavior` → 받은 파일 sha256), 1280×900과 360×780. 끝에 `DOMStorage`·`IndexedDB.requestDatabaseNames`·`Network.getAllCookies`·`CacheStorage.requestCacheNames`·서비스 워커 등록 조회 | 최초 요청 1건(문서) + 사용자가 누른 `/cloudcheck/download`만, CSP·Trusted Types 위반 0, 콘솔 오류·예외 0, 저장소 전부 빈 값, 수집기 내려받기 바이트 sha256 = `SHA256SUMS` | 스크래치패드 `qa/cdp-sweep.mjs` |
| ISO-04 | 오프라인판 | `/cloudcheck/download`와 같은 바이트(= `PAGE.html`)를 파일로 열기 | 부팅, `cc-file`, meta CSP 동작(CDP `Runtime.evaluate("fetch('https://example.com')")`가 CSP로 거부), `pushState` 동작 또는 이력 없는 모드, 오프라인판 버튼 숨김 | `qa/cdp-sweep.mjs` |
| ISO-05 | COOP·frame-ancestors | 다른 origin 페이지에서 `window.open(<url>)` 뒤 opener 단절, `<iframe src=<url>>` 차단 | `w.closed` 또는 `opener === null`, iframe 로드 차단 | 서버 필요 → 로컬 권한 또는 LV-07 |
| ISO-06 | 공유 파일·라우트 | 공유 파일 9종 sha256이 HEAD와 같음, `src` 전체 `serviceWorker` 0(기존 가드), 기존 가드·생성물 테스트 초록 | 변화 0 | 기존 + 확인 기록 |

### 4-4. P0 — 입력 안전 (G6)

| ID | 목적 | 입력 | 기대 | 위치 |
|---|---|---|---|---|
| **IN-01** | XSS(실엔진, 전 필드) | 사용자 데이터가 들어가는 모든 문자열 칸(사용자·그룹·역할·버킷·trail·SG·NSG·규칙 이름, 구독 이름, 별칭, 파일 이름, 예외 사유)에 `<img src=x onerror=alert(1)>`, `</script><script>alert(1)</script>`, `"><svg onload=alert(1)>`, `javascript:alert(1)`, `</style><style>*{display:none}`, `{{constructor.constructor('alert(1)')()}}` | V2~V5·V7·인쇄 DOM에서 페이로드로 생긴 요소 0(`img`·`script`·`svg[onload]`·`iframe`·`style`), 글자로만 보임, 모든 속성 값·`document.title`에 원문 없음(G-D8), 마스킹 사본·예외 내보내기에 그대로 JSON 문자열 | `qa/ui/xss.test.tsx` + ISO-03에 같은 파일 |
| **IN-02** | 보이지 않는 문자 | `\p{Default_Ignorable_Code_Point}` 전부 + 양방향 제어 + C0/C1 + 태그 문자(U+E0000~E007F) + 이형 선택자를 이름 끝·가운데에 | V2와 V3가 **같은 함수**로 치환하고 둘 다 플래그 + `unusual-characters` 라벨 | `qa/in-invisible.test.ts` | 
| IN-03 | 크기 경계 | JSON 정확히 25 MiB(끝 공백으로 맞춤)·+1바이트, CSV 20 MiB·+1, 이름이 `.csv`인 JSON·`.json`인 CSV, 붙여넣기 25 MiB+1. UI 경로(`file.size` 선검사)와 `recognize` 경로 둘 다 | 경계 안 = 인식 진행, 밖 = `too-large`(바이트를 읽지 않음) | `qa/in-limits.test.ts` |
| IN-04 | 깊이 경계 | 깊이 32·33, 문자열 안 괄호 1만 개, 알려진 섹션 안 깊은 중첩 | 32 = 진행, 33 = `too-deep`, 문자열 안 괄호는 무시 | `qa/in-limits.test.ts` |
| IN-05 | 인코딩 | 잘못된 UTF-8, UTF-16 LE/BE(BOM 포함), UTF-8 BOM, NUL 바이트, JSON 이스케이프 짝 없는 서로게이트(`"\ud800"`) 이름 | 앞 둘·NUL = `wrong-type`, BOM = 정상, 짝 없는 서로게이트 = `redacted(invalid-encoding)` V2·V3 모두 | `qa/in-encoding.test.ts` |
| **IN-06** | 비밀 모양 | AKIA/ASIA 키, PEM, JWT, Azure 스토리지 키(86자+`==`), 연결 문자열, SAS `sig=`, `ghp_`, `xoxb-`, `AIza`, `sk-`를 각 사용자 데이터 칸·파일 이름·별칭·예외 사유에 | 화면·속성·인쇄·마스킹 사본·예외 내보내기 어디에도 원문 없음, 알림 `secrets-detected` 개수 = 서로 다른 값 수, `checkReport` AKIA 0. **예외 사유는 지금 화면에 나온다 → `it.fails`(CR-11)** | `qa/in-secrets.test.tsx` |
| **IN-07** | 키 파일 거부 | AWS credentials INI, config(`aws_session_token`), `export AWS_…`, IAM 콘솔 새 액세스 키 CSV(`Access key ID,Secret access key`), `aws sts assume-role` JSON, `az ad sp create-for-rbac` JSON, PEM, GCP 서비스 계정 JSON, 연결 문자열, SAS URL, `.env`, **`az account get-access-token` JSON**, 이 각각을 파일·붙여넣기로 | `credentials-file`, 값이 DOM·속성·제목·라이브 영역에 없음, 붙여넣기 칸 빈 값, assertive 낭독. `get-access-token` JSON은 지금 `not-cloudcheck`(CR-16) → 기대는 `credentials-file`로 적고 `it.fails` | `qa/in-keyfiles.test.tsx` |
| IN-08 | 프로토타입 이름 | 사용자·버킷·역할·그룹·구독 이름 `__proto__`·`constructor`·`prototype`·`hasOwnProperty`·`toString` | 정상 판정, 실행 뒤 `({}).polluted === undefined`, 마스킹 순번 정상 | `qa/in-proto.test.ts` |
| IN-09 | 아주 긴 이름 | 스키마 상한까지(사용자 128, 버킷 63, ARN 2048, NSG 80, 구독 이름 256) | `truncated` 플래그·'(일부)' 표시, 360px 가로 넘침 0(CDP) | `qa/in-limits.test.ts` + ISO-03 |
| IN-10 | CSV 함정 | 따옴표 안 쉼표·줄바꿈 사용자 이름, CRLF·CR만·BOM, 엑셀 재저장(날짜가 `2026-10-15 0:00` 꼴, 따옴표 변경), 열 순서 뒤섞음, 같은 열 이름 두 번, **다른 계정 ARN 행 섞임** | 날짜를 못 읽으면 이상 없음 0, 모호한 행 = `csv-row-ambiguous`, 다른 계정 행 → 그 출처 범위 미증명(CR-09 `it.fails`) | `qa/in-csv.test.ts` |
| IN-11 | 예외 파일 적대 입력 | 깊이 33, 4 MB 초과, 1001항목, 날짜 형식 오류, `until < createdAt`, 91일, 모르는 ruleId, 다른 계정 MatchKey, 같은 대상 예외 여럿 | 해당 issue 코드, 상태·분포·먼저 볼 3개 불변(INV-8, G-D21), 다른 계정 키는 `unmatched` | `qa/in-exceptions.test.ts` |
| IN-12 | 마스킹 사본·인쇄 카나리아(R-13) | 회사 8개의 모든 사용자 데이터 칸(이름·별칭·ARN 마지막 마디·구독 이름·리소스 그룹·파일 이름·IP·CIDR·계정 번호·GUID)에 고유 토큰(`canary-<n>`·고유 숫자·고유 IP)을 심는다 | `maskedCopy` 출력에 토큰 0, 인쇄 마스킹 DOM(`.cc-mask-short` 쪽)에 토큰 0, 자기·외부 계정 관계는 유지 | `qa/in-mask-canary.test.ts` |

### 4-5. P0 — 표현 (G7)

| ID | 목적 | 입력 | 기대 | 위치 |
|---|---|---|---|---|
| **EX-01** | 렌더 금지어 전 화면 | V0~V8 × {체험 A~D × AWS·Azure, 실제 `parse/testdata` AWS·Azure, CSV 단독, `failClosedReport`(전부 확인 불가), 비교 결과} — `textContent` + 모든 속성 값(`aria-label`·`title`·`alt`·`placeholder`) + `document.title` + 정적 셸·`<noscript>`(템플릿) | `findBanned` 0(허용 키 2개 글자는 빼고), ⟦키⟧·`{이름}` 0 | `qa/ui/expression.test.tsx` |
| EX-02 | 면책·고지 고정 노출(G-D19) | V0·V2·V3(화면 + 인쇄 전용 바닥)·V8 | `cc.promise.caveat`가 약속 바로 다음, `cc.disclaimer.body` V3·V8, 인쇄 DOM에 바닥 면책 | 같은 파일 |
| EX-03 | 파라미터 조합 | 파라미터가 있는 모든 카탈로그 키(C·S·E)에 숫자 0·1·7·45·90·180·1000, 시각, 날짜 | `findBanned` 0, `%` 0, 채워지지 않은 자리 0 | `qa/ex-params.test.ts` |
| EX-04 | 제목×상태(K-1 반영 뒤) | 룰마다 낼 수 있는 상태를 micro + 변이로 만들어 '[상태] 제목 — 사유' 줄 렌더 | 디자인 §9·문구 검수 §5 표와 같음, ✕ 0. AWS-NET-1·AZ-NET-1 해당 없음 근거 = "보안 그룹 0개(확인됨)"·"NSG 0개(확인됨)" | `qa/ui/title-status.test.tsx` |
| **EX-05** | 꼬리표 정직성 | 위험·주의 + `coverage.proven:false`(E-19, 리전 일부, 사용자 잘림) | 꼬리표가 '전체'·'전부'를 말하지 않고 일부만 봤음을 말한다. **지금은 "계정 전체" → `it.fails`(CR-06)** | `qa/ui/expression.test.tsx` |

### 4-6. P1 — 접근성·인쇄·360px·다크·키보드·수집기

| ID | 목적 | 방법 | 기대 | 위치 |
|---|---|---|---|---|
| UI-01 | 키보드만으로 전 흐름 | RTL `user-event` Tab·Enter·Space·Esc + CDP `Input.dispatchKeyEvent` | 모든 동작 도달, 포커스 링(`:focus-visible`), `<dialog>` Esc = 돌아가기·포커스 복귀, 건너뛰기 = 버튼 + `focus()`(해시 불변) | `qa/ui/keyboard.test.tsx` + CDP |
| UI-02 | 접근 이름·낭독 | RTL `getByRole(name)`: 점검 행 버튼 "위험 콘솔 사용자 MFA, 접힘", `[빼기]` aria-labelledby, 라이브 영역 1회 낭독 | 이름에 사용자 데이터는 `aria-labelledby`로만 | `qa/ui/a11y.test.tsx` |
| UI-03 | axe 스윕 | 설치된 `node_modules/axe-core`를 CDP로 주입(`Page.setBypassCSP(true)`로 TT 우회) V0~V8 라이트·다크 | 위반 0(색 대비 포함) — 남는 것은 목록화 | `qa/cdp-sweep.mjs` |
| UI-04 | 360px·확대 | 360×780, 1280×900의 200%·400%, 높이 ≤600px | 가로 넘침 0(실제 긴 이름 리포트·Azure KQL 블록 포함), 맥락 줄 스티키 해제 | CDP |
| UI-05 | 다크 | `prefers-color-scheme: dark` 화면, 인쇄는 라이트 | 토큰 적용, 인쇄 미리보기 라이트 | CDP |
| UI-06 | 인쇄 | 메뉴 인쇄(Ctrl+P 에뮬레이트)·버튼 인쇄(전체·목록만·이름 표시) | 마스킹 기본, `cc-po` 펼침, 목록만 모드, '이름·ID 표시'는 그 인쇄 한 번만, 체험 큰 제목, 도장·서명란 0 | CDP `printToPDF` + 수동 |
| UI-07 | 상태 표시 | CDP `Emulation.setEmulatedVisionDeficiency`(achromatopsia·deuteranopia) | 도형 + 글자로 구분, 글자 생략 0(G-D3) | CDP |
| UI-08 | 리포트 유실 방지 | 실제 리포트에서 뒤로 가기·새로 고침·창 드롭·새 점검 | `beforeunload`는 실제 리포트만, 앱 안 뒤로, V3 드롭은 삼키고 안내, 확인 대화상자 | RTL + CDP |
| UI-09 | 체험 회사 전환 | A에서 본인 응답·예외 표시 → C로 전환 | 지금 동작을 기록(이어짐) → 디자인 결정 D-5 | RTL |
| UI-10 | Safari·Firefox(수동) | Blob 내려받기(수집기·마스킹 사본·예외: 다음 틱 해제로 끊기는지), `<dialog>`, V1·V7·V8 `<details>`, 인쇄(두 경로), `file://` `pushState`, 해시 묶음 복사 = 공백 없는 64자, `clipboard-read=()`에서 붙여넣기 | 모두 동작. 끊기면 CR-13 | 수동 표(실행자 또는 PM) |
| UI-11 | 오류 복구 | 체험 JSON 블록을 망가뜨린 HTML(스크래치)로 체험 열기 | 정적 셸 복구, 콘솔 오류 외 크래시 없음 | CDP |
| **CL-01** | 린터 우회 샘플 확장 | `$'\x63url'` 명령, `"$(printf curl)"`, `${!x}`, `IFS=`, `BASH_ENV=`, `exec 3<>/dev/tcp/…`, `read x </dev/tcp/…`, `cat /etc/passwd`, `jq -n 'input'`·`$ENV`·`env.X`, `command -p curl`, `trap 'curl x' EXIT`, `PROMPT_COMMAND=`, `jq()` 재정의, `<(…)`·`>(…)`, `coproc`, `\|&`, `aws … --endpoint-url`, `aws configure get`, `aws s3 cp`, `az rest`, `az storage account keys list`, `az account get-access-token`, `hash -p`, `enable -f` | 각 샘플이 해당 L-규칙 위반으로 잡힌다 | `qa/collector-lint-bypass.test.ts` |
| CL-02 | endpoint-guard 변이 | 수집기 원문에서 `AWS_IGNORE_CONFIGURED_ENDPOINT_URLS=true` 삭제·`false`·11줄 뒤로 이동, Azure에 `az --version` | 린트 실패 + shim이 aws 응답 거부 | 같은 파일 |
| **CL-03** | TTY 경로 | `/usr/bin/expect`로 shim 수집기 실행: ① 계정 확인 Enter ② 확인 단계 Ctrl+C ③ 마지막 "Enter = 삭제" ④ 비대화형 `--yes` 없음 | ① 결과 파일 생성 ② 결과·임시 파일 0, 호출 1건(신원) ③ 파일 삭제 ④ exit 3, 호출 1건 | `qa/collector-tty.test.ts`(expect 없으면 skip) |
| CL-04 | bash 5 구문 | 로컬 도커 이미지(`mariadb:10.11` bash 5.1, `hwp2pdf:latest` bash 5.2 — 설치 없이 있음 [확인: 실행])로 `bash -n` 두 수집기(읽기 전용 마운트) | 오류 0. shim 실제 실행은 이미지에 jq가 없어 **패키지 설치가 필요 → PM 승인 또는 PM V1** | 스크래치 명령 |
| CL-05 | 시계 뒤처짐 | shim `fakeNow`를 보고서 `GeneratedTime`·키 `CreateDate`보다 이르게 → 결과 JSON을 판정 | FO-05 기대와 같음 | `qa/fo-time-skew.test.ts` |
| CL-06 | 요청 범위 밖 | `--regions`에 비활성·오타 리전, Azure `--subscriptions`에 보이지 않는 ID | AWS: 그 리전 실패 영수증 → 확인 불가(맞음). Azure: 범위 미증명 + 알림 기대 → 지금은 조용히 무시(CR-10 `it.fails`) | shim + 판정 |

### 4-7. P2 — 성능

| ID | 목적 | 방법 | 기대(보고 기준) |
|---|---|---|---|
| PF-01 | 25 MB 입력(프론트 요청) | 합성 수집 JSON(사용자 150, 버킷 300, 17리전 × SG 수천) ≈ 24 MB: Node에서 `recognize`·`buildInput` ×2(V2 렌더 중 1회 + CTA 1회)·`judge` 시간, Chrome에서 Long Task | 측정 기록. 메인 스레드 한 번에 2초를 넘으면 V2 결과 재사용(프론트 제안)을 권고 |
| PF-02 | 예산 상한 리포트 렌더 | 위 입력의 V3 첫 렌더·펼침·인쇄 시간 | 기록 |
| PF-03 | 첫 화면 | CDP 모바일 에뮬레이션(Moto G 급, 4× CPU, Fast 3G) `file://`와 라이브: LCP·CLS·JS 파싱·실행 | LCP는 정적 V0 셸, CLS 0.1 이하, 기록 |
| PF-04 | 번들 예산 회귀 | 기존 `generated.test` 수치 기록 | 원본 900 KiB·gzip 260 KiB 이하(현재 여유 약 35 KiB) |
| PF-05 | 마스킹 사본 | PF-01 입력 `maskedCopy` 시간·크기 | 기록(2 MB 넘으면 한 줄 JSON) |

---

## 5. 엣지케이스 목록

**경계값(같음 = 초과 아님인지 하나씩)**: 키 나이 90일 정각·+1초 / 미사용 45일 정각 / 유예 7일 정각 / 루트 최근 로그인 90일 / 보고서 신선도 4시간 5분 정각·+1초 / 시간 알림 24시간·7일 / 시계 차이 5분 / 안내 오래됨 180일 / 예외 `until` = 오늘(유효)·어제(만료), 기간 90일·91일 / 수집 예산 사용자 150·151, 버킷 300·301, Azure 구독 20·21·계정 100·101 / `LIMITS` 25 MiB·20 MiB·깊이 32·영수증 100,000·보고서 2천만 자 / 포트 0·1·65535, 1~65535 전체(`all`), 80·443만(이상 없음), 25·110·143(주의), 20~23 범위(위험 포함), 위험 포트 바로 옆(2374·2377) / 대상 0개(해당 없음)·1개·예산 끝.
**시각 표기**: `Z`·`+00:00`·`-00:00`·소수 초 9자리·윤일 2024-02-29·달력에 없는 날짜·1970 이전·2200 이후, 한국 시간 자정 넘김(`fmtTime`).
**모양**: 빈 목록 `[]` vs `null`(답 없음) vs 영수증 `empty`, `notconfigured` 아래 값 있음(모순 → 섹션 무효), 영수증 `count` ≠ 목록 길이, 영수증 ID 중복(파일 거부), 같은 리전·구독·버킷 두 번(섹션 무효), 수집기 이름 ↔ 클라우드 불일치.
**다중 입력**: 같은 runKey 두 번(superseded), 수집기 JSON + CSV(문 단위 선택), 다른 계정 CSV(account-mismatch), 체험 + 실제(거부), 최대 8개 + 9번째, `--doors` 나눠 실행한 결과 합치기(asOfRange).
**동시성·순서**: '읽는 중'에 두 번째 드롭, CTA 두 번 연타, 읽는 중 화면 이동·뒤로 가기, 인쇄 중 접힘 토글, 예외 폼 편집 중 내보내기, 비교 모드에서 첫 파일 제거, 탭이 백그라운드일 때 읽기(`requestAnimationFrame` 멈춤 → 타이머 경주로 진행되는지).

---

## 6. 코드 리뷰 지적

심각도: **높음** = 실제로 일어날 수 있는 조건에서 근거 없이 '이상 없음' / **중간** = 비정상·드문 입력에서 '이상 없음', 또는 화면이 확인 범위를 과장 / **낮음** = 표시·일관성·기능 결함, 판정 방향은 안전.

### 6-1. 지적 목록

| ID | 심각도 | 위치 | 문제 | 고치는 방향(제안) | 테스트 |
|---|---|---|---|---|---|
| **CR-01** | **높음** | `src/lib/cloudcheck/rules/kit.ts:68-72` (`ageMs`·`olderThanDays`·`wholeDays`) · 사용처 `rules/aws/aws-key-1.ts:83-91`, `rules/aws/aws-key-2.ts:83-91·103-110`, `rules/azure/az-key-1.ts:79-80` · 기준 시각 출처 `parse/recognize.ts:148-157`, `parse/strict-time.ts:8` · `engine/run.ts:68-74` | 증거 시각이 기준 시각보다 늦으면 나이가 음수 → '최근'으로 보고 **이상 없음**. CSV 경로의 기준 시각(파일 이름·`lastModified`)은 사용자 기기 값이라 늦은 PC 시계, 0(1970)·1980(FAT·ZIP) 시각, 잘못된 이름에서 그대로 일어난다(E-01~04). `timeNotices`는 같은 기기 시계를 쓰므로 못 잡는다. 수집기 로컬 CLI 경로(사용자 노트북 시계)도 같다. `reportFresh`도 생성 시각이 수집 시각보다 늦으면 '신선'으로 본다 | 정규화 단계에서 입력별 '최신 증거 시각'을 구해, 기준 시각보다 허용치(예: 5분)를 넘게 늦은 증거가 있으면 ① 그 입력의 기준 시각을 '불일치'로 표시하고 ② 나이를 쓰는 룰의 음성 결론(이상 없음·제외)을 `stale-evidence`로 막고 ③ 알림 1개를 낸다. `lastModified`가 2000년 이전이면 기준 시각 없음(null)으로 | FO-05, CL-05 |
| **CR-02** | 중간(Azure 공개 전 차단) | `parse/normalize-azure.ts:372-379` (`azure.log.subscriptions`가 범위 목록의 개수만 모수로 봉인) ↔ `rules/azure/az-log-1.ts:79-88`(구성원은 `activityLogExports` 항목에서) · 근본 `engine/aggregate.ts:130`(구성원 수 = 모수 개수만 비교) | 범위 안 구독 b2 대신 다른 구독 b3 항목이 들어오면 개수가 같아 **이상 없음**(E-05). 다른 구독 단위 패밀리는 `subCoverage`가 구독 ID로 맞춰 보지만 이 패밀리만 빠졌다 | 활동 로그 패밀리도 `subCoverage(scope, exportsList)`로 봉인(범위 안 구독마다 항목·영수증 확인, 범위 밖 항목은 섹션 무효). 엔진 쪽 방어로 증명에 대상 MatchKey 집합(또는 해시)을 실어 `aggregate`가 집합으로 비교 | FO-04 |
| **CR-03** | 중간 | `rules/aws/aws-net-1.ts:81-91` · `rules/ports.ts:19-21`(`norm`이 잘못된 구간을 조용히 버림) | tcp/udp인데 `fromPort > toPort`·음수·범위 밖이면 구간이 사라져 **이상 없음**(E-07·08). 프로토콜을 `trim` 없이 비교해 `"TCP "`도 건너뜀(E-09). Azure 쪽은 `parsePortSpec`가 `ok:false` → 확인 불가로 맞게 처리한다(비대칭) | 버려지는 구간·모르는 프로토콜 문자열이 있으면 `unrecognized = true`. 프로토콜은 `trim().toLowerCase()` 후 `-1·tcp·udp·icmp·icmpv6·숫자`만 알고 그 밖은 해석 불가 | FO-02, FO-06 |
| **CR-04** | 중간(결정 필요 D-1·D-3) | `rules/aws/aws-net-1.ts:84-86`(`cidrs.includes("0.0.0.0/0")`) · `rules/azure/az-net-1.ts:75-78`(`WORLD` 문자열 집합) | '인터넷 전체'를 문자열 일치로만 본다. `0.0.0.0/1`+`128.0.0.0/1`처럼 합치면 전체인 출발지, 아주 넓은 접두(/1~/8), Azure 서비스 태그(`AzureCloud` 등)·ASG 출발지는 건너뛰어 **이상 없음**(E-10·11). 이상 없음 사유 문구 "인터넷 전체에 … 연 규칙이 없음"과 어긋난다. 기획서 §6-2 AZ-NET-1 주의 조건("ASG나 서비스 태그가 섞여 단순 평가가 불확실함")이 구현되지 않았고 방향서 §12 변경표에도 없다 | 출발지 접두를 합쳐 0.0.0.0/0(또는 ::/0)을 덮으면 같은 취급, 접두 길이 ≤ /8(IPv6 ≤ /16)은 '넓은 출발지' 주의, Internet 밖 서비스 태그·ASG는 기획서대로 주의(또는 확인 불가) — 기획팀장 결정 | FO-02, FO-06 |
| **CR-05** | 중간 | `rules/aws/aws-key-4.ts:92`(Effect가 allow가 아니면 문장 무시), `:104`(`"*"`는 `wildcard` 플래그만 믿고 건너뜀), `:123-130`(문장 0개 = 이상 없음), `:77·97·108`(`sts:ExternalId` 키만 있으면 연산자와 무관하게 보호로 봄) | 모르는 Effect(`"Allow "`·`""`), `aws:["*"]`+`wildcard:false`, 문장 0개, `Null:`·`StringNotEquals:sts:ExternalId`에서 **이상 없음**(E-12~15). AWS가 실제로 내지 않는 값이 많지만 P3(모르는 열거값은 해석 불가) 위반이고 수집기 투영이 바뀌면 그대로 새는 길이다 | Effect는 `allow`·`deny`만 알고 그 밖은 `unrecognized`, `aws` 배열에 `"*"`가 있으면 플래그와 무관하게 와일드카드, 문장 0개는 해석 불가, ExternalId는 `StringEquals`(+`IgnoreCase`, `ForAnyValue:`) 연산자만 보호로 인정하고 그 밖은 주의 | FO-02, FO-06, FO-08 |
| **CR-06** | 중간(G7 차단) | `src/app/cloudcheck/_client/components/RuleRow.tsx:23-35·38-45` (`coverageText`·`Tail`) | 꼬리표가 `coverage.proven`을 보지 않는다. 위험·주의인데 범위가 증명되지 않은 경우(사용자·버킷 목록 잘림·예산 초과)도 "확인한 범위: 계정 전체"라고 쓴다(E-19). '어디까지 봤는지 정직하게'에 정면으로 어긋나고, 예산 초과는 범위 패널에도 드러나지 않는다(리전·구독 단위만 보임) | `proven:false`면 "일부만 확인(사유: …)" 꼬리표 + 그 점검을 직접 볼 목록에 '나머지 대상' 항목으로(`engine/blocks.ts:338-351`은 확인 불가 대상이 있을 때만 넣는다) | EX-05 |
| **CR-07** | 중간(결정 필요 D-2) | `rules/aws/aws-log-1.ts:82-91`(`evalTrail`이 `hasDeliveryError`를 안 봄), `:74-79`(고급 선택기 readOnly) · `collector/cloudcheck-aws.sh:221`(Equals만 투영) | ① 기록 중이지만 전송 오류(버킷 삭제·정책 오류 — 소규모 팀에서 흔함)인 trail을 **이상 없음**으로 본다(E-17). 사실 줄만 붙는다 ② 고급 선택기에서 `readOnly` 필드가 있는데 Equals 값이 비면 '쓰기 포함'으로 본다(E-16). NotEquals가 API에서 허용되는지는 [미확인] | ① 전송 오류는 주의(사유 신설) — 기획팀장 결정 ② 수집기가 Equals 밖 연산자를 쓰는 필드를 표시(투영 추가는 수집기 변경 = 해시 변경이므로 첫 공개 전에), 엔진은 그 필드가 있으면 확인 불가 | FO-02, PM V1 |
| CR-08 | 낮음~중간 | `src/lib/cloudcheck/engine/display.ts:21-24`(리포트 정리기) ↔ `src/lib/cloudcheck/parse/display.ts:8-11`(입력 인식 정리기) | 같은 일을 하는 정리기가 두 벌이고 문자 집합이 다르다. 리포트 쪽은 U+3164(한글 채움)·U+FFA0·U+115F·U+1160·U+00AD·U+180E·U+2061~2064를 통과시켜, `admin`+U+3164 같은 사용자가 `admin`과 똑같이 보이고 '특이 문자' 라벨도 안 붙는다(E-22). 둘 다 태그 문자(U+E0000~)·이형 선택자는 놓친다 | 정리기 하나로 합치고 `\p{Default_Ignorable_Code_Point}`·`\p{Cf}`·양방향 제어를 함께 치환 | IN-02 |
| CR-09 | 낮음~중간 | `src/lib/cloudcheck/parse/credential-report.ts:56-60`(첫 ARN의 계정만 읽음) · `parse/normalize-aws.ts:275`(루트만 거름) · 같은 모양 `parse/rg-csv.ts:68`(첫 행 테넌트) | 다른 계정의 행이 섞인 보고서를 이 계정 사용자로 판정하고 `scopeProven:true`(E-20). 휴먼에러 ② '엉뚱한 계정'을 막는 제품 원칙과 어긋난다 | 행마다 ARN 계정(RG는 tenantId)을 확인, 다르면 그 행을 `csv-row-ambiguous`로 + 출처 범위 미증명(또는 파일 거부) | IN-10 |
| CR-10 | 낮음~중간 | `collector/cloudcheck-azure.sh:104`(보이는 구독만 나열) · `parse/normalize-azure.ts:59`(`subscriptionsRequested` 저장만) · `:251-268`(`subCoverage`가 요청 목록을 안 봄) | `--subscriptions`로 요청했는데 보이지 않는 구독(오타·권한 없음)이 조용히 사라지고 범위 증명이 그대로 true(E-21) | 요청했지만 목록에 없는 구독은 범위 빠짐(`subscription-missing`) 단위로 기록 | CL-06 |
| CR-11 | 낮음 | `src/lib/cloudcheck/engine/exceptions.ts:33-35` | 예외 파일 사유를 비밀 검사 없이 `sens(freeText)`로 → 화면에 원문(인쇄는 •••)(E-23). R-12는 올린 파일의 비밀 모양을 화면에 그리지 말라고 한다 | `findSecret`이 걸리면 `redacted`. 예외 파일 읽기 단계(`parse/exceptions.ts`)에서 처리해도 됨 | IN-06 |
| CR-12 | 낮음 | `rules/aws/aws-net-1.ts:122-129` | ENI 목록이 잘렸거나(partial) 일부인데 연결 ENI를 못 찾으면 '연결된 인터페이스 없음'(`sg-unattached`)·'사설만'(`sg-private`)으로 단정(E-18). 상태(주의)는 맞지만 사유가 증명 없는 '없음'이다. Azure는 같은 경우 `nsg-attachment-unknown`으로 맞게 처리 | ENI 슬롯이 `value`가 아니면 `sg-eni-unknown` | FO-03 |
| CR-13 | 낮음 | `src/app/cloudcheck/_client/components/DownloadLink.tsx:42` | Blob URL을 다음 틱에 해제. Chrome은 정상 [확인: 프론트], Safari·Firefox는 내려받기가 끊긴 사례가 알려져 있다 [일반 지식] | 수십 초 뒤 해제 또는 `visibilitychange` 뒤 해제 | UI-10 |
| CR-14 | 낮음 | `src/app/cloudcheck/_build/template.mjs:117·127` | 부팅 실패·`<noscript>` 안내의 오프라인판 링크(`/cloudcheck/download`)가 `file://`에서는 깨진 링크(스크립트가 없어 숨길 수 없음) | 문구로 "이미 오프라인판이면 무시" 또는 링크 대신 안내 | ISO-04 |
| CR-15 | 낮음 | `rules/azure/az-sto-2.ts:73` ↔ `parse/normalize-azure.ts:357` | 컨테이너 목록 슬롯 `none`(빈 목록 + null)을 룰은 '계정 단위 확인 불가'로, 패밀리는 '0개 완결'로 봐서 모수 불일치 → 확인 불가. 안전한 방향이지만 거짓 확인 불가 | 둘 중 하나로 통일(`none` = 0개) | FO-03 |
| CR-16 | 정보 | `src/lib/cloudcheck/parse/secrets.ts:29-39` | `az account get-access-token` 출력(JSON `accessToken`)·MSAL 토큰 캐시는 키 파일로 거부되지 않고 `not-cloudcheck`로 끝난다(원문은 그리지 않음 — 누출은 없음) | `"accessToken"\s*:\s*"eyJ` 패턴 추가 → 키 파일 안내 | IN-07 |
| CR-17 | 정보(결정 D-4) | `rules/aws/aws-net-1.ts:86`(`!v4 && !v6` → 건너뜀) | 출발지가 프리픽스 리스트뿐인 위험 포트 규칙은 이상 없음(못 보는 것으로 고지됨). 이상 없음 사유 문구가 이를 덮지 못한다 | 위험 포트 + 프리픽스 리스트 출발지는 주의(확인 필요) 또는 문구 보강 | FO-06 |

### 6-2. 리뷰했지만 문제를 찾지 못한 곳(근거)

| 영역 | 본 것 | 결론 |
|---|---|---|
| 엔진 집계 | `engine/aggregate.ts` 전체, `proof.ts`(WeakSet 발급·동결 재검사), `run.ts`(예외 격리·`parse-failed`), `judge.ts`(`failClosedReport`) | fail-closed 구조는 탄탄하다. 남은 구멍은 '개수만 비교'(CR-02)뿐 |
| 라우트 헤더 | `route.ts`·`download/route.ts`·`_serve/headers.ts` | 방향서 §2-2와 같다. 라이브에서 HEAD 응답(Route Handler는 GET만 내보냄 — Next가 HEAD를 대신 처리하는지 [미확인])과 Vercel이 `Cache-Control`을 바꾸는지만 LV-01에서 본다 |
| 생성기 이스케이프 | `_build/template.mjs`(`esc`, `assertRaw`: `<!--`·`<script`·`</script`·CR·NUL), 데이터 블록 `text/plain`·JSON(`<`→`\u003c`) | 스크립트 데이터 상태 탈출 길 없음. 속성은 큰따옴표만 쓰고 `esc`가 `"`를 바꾼다 |
| 사용자 데이터 통로 | `MaskedValue`, `CliBlock`(쓰기 명령에 사용자 데이터 없음, 자리표시자만), `TargetTable`(DOM id에 대상 id 안 씀), `ErrorBoundary`(오류 메시지 안 그림) | 문제 없음 |
| 마스킹 사본 | `parse/mask.ts`(ARN·Azure ID·GUID·sg-/eni- ID·IPv4·IPv6·계정 번호·이름 필드) | 빈틈을 찾지 못했다. 회귀로 '카나리아' 테스트를 둔다(IN-12) |
| 수집기 | 신뢰 정책 투영(`Statement` 배열 아니면 null, 문자열 Principal → `{AWS:[…]}`), 영수증 분류, 린터 L-08(`/dev/tcp` 포함)·L-10·L-11·L-14 | 투영은 맞다. 남은 것은 CR-07②(Equals만), CR-10(요청 구독) |

### 6-3. 제외(해당 없음) 경로 재검토 결과(백엔드 요청 5)

| 위치 | 제외 조건 | 읽지 못한 값이 제외로 가는가 |
|---|---|---|
| `aws-mfa-1.ts:141` | 비밀번호 슬롯이 `value:false` + 키 목록 완결 + 키 상태 전부 답 + 보고서 신선 | 아니오. `none`·해석 불가는 '비밀번호 있음'으로 보아 제외로 못 감 |
| `aws-mfa-2.ts:74` | 비밀번호 `value:false` + 신선 | 아니오(`missing` → 확인 불가) |
| `aws-key-1.ts:78` | 키 `active` = `value:false` + 신선 | 아니오(상태 문자열 모름 → `value-unrecognized`) |
| `aws-key-2.ts:136` | 콘솔 없음(`value:false`) + 키 목록 `value` + 모든 키 비활성(답) + 신선 | 아니오(`partial`·`none`·`missing` → 확인 불가) |
| `aws-key-3.ts:77·112` | 키 목록 `value`·상태 전부 답·활성 0 / 직접·그룹 정책 슬롯 전부 `value`이고 관리자급 없음 | 아니오(`none`도 `reasonOf` 대체 사유로 확인 불가) |
| `aws-key-4.ts:120` | 경로 `/aws-service-role/` | 아니오(AWS 예약 경로) |

→ 회귀 테스트로 고정(FO-07). 집계는 제외 구성원도 '답'인 증거를 요구한다(`aggregate.ts:60-63`).

---

## 7. 다른 팀 이월 항목 처리표

| 출처 | 이월 항목 | 덮는 케이스 / 넘길 곳 |
|---|---|---|
| 프론트 | V2 드롭·붙여넣기·25 MB, V5, 실제 파일로 V3·V4 | ISO-03, IN-03, PF-01, UI-08 |
| 프론트 | Safari·Firefox Blob(다음 틱 해제)·`<dialog>`·`<details>`·인쇄 | UI-10(수동), CR-13 |
| 프론트 | 라이브 `content-encoding: br`, 압축 해제 본문 해시, 모바일 LCP·CLS | LV-02·03·08 |
| 프론트 | 체험 회사 전환 때 본인 응답·예외 이어짐 | UI-09 → 디자인 결정 D-5 |
| 프론트 | V2 `buildInput` 두 번 시간 | PF-01 |
| 프론트·디자인 | V1 잠정 안내 2키·수집 줄 새 키 2개·미사용 S 키 3개 | 디자인팀장 확인(§11). QA는 EX-01 금지어·EX-03만 |
| 프론트 | 번들 목표 초과(864.9 / 700 KiB 등) | PF-04 기록, 기획팀장 결정(실패 기준은 통과) |
| 백엔드 1 | 새 micro 2건 + `audit-group` 기대 변경을 변이에 | FO-08 |
| 백엔드 2 | 와일드카드 액션·null/모르는 `publicAccess`·빈 리전·단일 객체 `Statement` | FO-08·09 |
| 백엔드 3 | endpoint-guard, 로컬 `az version` 규칙, 정답지 100% | CL-02, AN-02 |
| 백엔드 4 | 비공개 컨테이너 `"None"` | AN-03 |
| 백엔드 5 | '해당 없음(제외)' 경로 재검토 | §6-3, FO-07 |
| 백엔드 | jq 1.6·bash 5.x·TTY·실제 출력 모양 | CL-03(TTY 로컬), CL-04(bash 5 `-n`), 나머지 PM V1 |
| 디자인 | F-1~F-10 | F-3·F-10 → FO-08·FO-10(코드 반영 확인), F-1·F-2·F-6·F-7·F-8 → PM V1(§8), F-4·F-9 → DB설계자 문서 대조, F-5 → 문구 근거 수준 차이 확인(검수 기록만) |
| 디자인 | G7 제목×상태(K-1 뒤) | EX-04. K-1~K-6 문구 키가 모두 있음을 확인 [확인: 코드 `rules/i18n/ko.aws.ts:212·236·238`, `ko.azure.ts:76·101·103·185·203`] |
| 디자인 | DB설계자 `acl-in-use` 4문구 | 코드 경로와 맞는지 확인: `unset` = 소유권 설정 없음(`none`)일 때만, `other` = 값 해석 불가일 때만 [확인: 코드 `aws-sto-2.ts:106-113·166-170`]. 톤은 디자인팀장 |
| DB설계자 | 선택된 문인데 아무것도 못 모으면 not-collected, 가이드 룰만 있는 문은 범위 밖 항목 없음 | 기존 e2e로 확인됨. EX-01에 Azure 현관 화면 포함 |

---

## 8. PM V1(G8)로 넘길 항목

백엔드 최종안 §11 체크리스트를 그대로 쓰고, QA가 아래를 더한다.

### 8-1. 추가 측정(★★ = QA 추가)
1. ★★ 콘솔 자격증명 보고서 CSV의 **내려받은 파일 이름 형식**과 파일의 `lastModified`(= 내려받은 시각인지), 보고서 안 가장 늦은 시각과의 차이 → CR-01 고치는 방향의 허용치 근거.
2. ★★ CloudShell `date -u`와 실제 시각 차이(수집 시각 신뢰), 로컬 CLI 경로를 쓰면 그 기기 시계도.
3. ★★ CloudTrail: 기존 trail이 있으면 `get-trail-status`의 `LatestDeliveryError` 모양, 고급 이벤트 선택기를 쓰는 계정이면 `readOnly`에 NotEquals가 허용되는지 → CR-07.
4. ★★ `get-account-summary`의 `Roles`가 서비스 연결 역할을 세는지(AWS-KEY-4 모수 교차 확인이 거짓 확인 불가를 만드는지).
5. ★★ Azure NSG 규칙의 실제 `sourceAddressPrefix` 값(서비스 태그 표기), ASG 출발지 규칙 모양 → CR-04.
6. ★★ Azure `--subscriptions`에 없는 ID를 넣었을 때 수집기 출력 → CR-10.

### 8-2. 결함 심기 체크리스트('무장은 됐지만 연결 안 됨' — 실제 노출을 만들지 않는다)

| # | 클라우드 | 심을 것 | 기대 결과 | 철거 |
|---|---|---|---|---|
| V-A1 | AWS | 연결된 ENI가 없는 SG `cc-v1-ssh`: 22/tcp ← 0.0.0.0/0 | AWS-NET-1 주의(`sg-unattached`) | SG 삭제 |
| V-A2 | AWS | **별도** SG `cc-v1-split`(ENI 연결 없음): 3389/tcp ← `0.0.0.0/1`·`128.0.0.0/1` | 지금 코드: 그 SG 대상이 이상 없음(`sg-closed`) — CR-04, 결정 D-1 기록용 | SG 삭제 |
| V-A3 | AWS | 빈 버킷 `cc-v1-possible-<무작위>`: 버킷 차단 4개 끔, 정책·ACL 공개 없음(계정 차단이 켜져 있으면 계정 차단은 그대로 두고 버킷만) | 계정 차단 켜짐이면 이상 없음, 꺼짐이면 주의(`public-possible`) | 버킷 삭제 |
| V-A4 | AWS | 계정 차단 4개 중 1개만 끔(빈·학습 계정에서만) | AWS-STO-1 주의(`block-partial`) | 원래대로 4개 켬 |
| V-A5 | AWS | 역할 `cc-v1-trust`: `Principal {"AWS":"*"}` + 절대 맞지 않는 조건 `aws:PrincipalOrgID = o-xxxxxxxxxx`(가짜), 권한 정책 0 | AWS-KEY-4 주의(`trust-wildcard-org-condition`) | 역할 삭제 |
| V-A6 | AWS | 사용자 `cc-v1-unused` + 액세스 키 1개(비밀 키는 저장하지 않고 즉시 폐기), 정책 0, 8일 뒤 실행 | AWS-KEY-2 주의(만든 지 7일 넘고 한 번도 안 씀), KEY-1 이상 없음 | 키·사용자 삭제 |
| V-A7 | AWS | (선택) trail이 있으면 `stop-logging` 잠시 | AWS-LOG-1 주의(`trail-not-logging`) | `start-logging` |
| V-Z1 | Azure | 어디에도 연결 안 된 NSG: Inbound Allow 22 ← Internet | AZ-NET-1 주의(`nsg-unattached`) | NSG 삭제 |
| V-Z2 | Azure | **별도** NSG(연결 없음): 3389 ← `AzureCloud` | 지금 코드: 그 NSG 대상이 이상 없음(`nsg-closed`) — CR-04, 결정 D-3 기록용 | NSG 삭제 |
| V-Z3 | Azure | 스토리지 계정 `allowBlobPublicAccess=true`, 컨테이너는 모두 Private | AZ-STO-1 주의, AZ-STO-2 이상 없음(`container-private`) | `false`로 |
| V-Z4 | Azure | Blob 진단 설정을 범주 그룹 `audit`만으로 | AZ-LOG-2 확인 불가(value-unrecognized) + F-3 실측(어느 범주가 기록되는지) | 진단 설정 삭제 |
| V-Z5 | Azure | 구독 활동 로그 내보내기 없음(기본) | AZ-LOG-1 주의(`no-export`) | — |

- 심은 뒤 수집기 1회 → 리포트를 위 표와 대조 → 오탐·확인 불가 사유 기록 → 철거 → 철거 뒤 1회 더 수집해 원래 상태로 돌아왔는지 확인.
- 쓰기 명령은 PM이 직접 입력한다(원클릭 복사 없음 원칙 유지). 학습·빈 계정에서만 한다.

---

## 9. 라이브(배포 후) 확인 항목

| ID | 항목 | 방법 | 기대 |
|---|---|---|---|
| LV-01 | 헤더 | `curl -s -D - -o /dev/null "https://project-orsrw.vercel.app/cloudcheck?v=<SHA>"`와 `curl -sI` 둘 다 | 방향서 §2-2와 같음(HEAD = GET), `X-Robots-Tag: noindex`, Vercel이 `Cache-Control`을 바꾸지 않음, HSTS 유무 기록 |
| LV-02 | 압축 | `curl -sI -H 'Accept-Encoding: br, gzip' …` | `content-encoding: br`(또는 gzip) |
| LV-03 | 본문 해시 | `curl -s --compressed …/cloudcheck \| shasum -a 256` 와 `…/cloudcheck/download` | 둘 다 `PAGE.sha256`, CSP 해시 = `PAGE.scriptHash`·`PAGE.styleHash` |
| LV-04 | 고유 콘텐츠 | 본문에 `<title>` "문단속 5"와 베타 띠 문구 | 있음(200이 아니라 내용으로 판정) |
| LV-05 | 요청 1건·위반 0 | Chrome DevTools(확장 끈 창) Network·Console·Issues | 문서 1건, CSP·TT 위반 0 |
| LV-06 | 같은 origin 서비스 워커 | DevTools Application → Service workers, `navigator.serviceWorker.getRegistrations()` | 0 |
| LV-07 | COOP·iframe | 다른 origin에서 `window.open`·`<iframe>` | 단절·차단 |
| LV-08 | 모바일 성능 | 실제 휴대폰 또는 DevTools 모바일 + 4× CPU | LCP·CLS 기록 |
| LV-09 | 회귀 | `/pae` `/moira` `/exam` `/witness` 고유 콘텐츠 | 정상 |
| LV-10 | 경로 변형 | `/cloudcheck/`(끝 슬래시), `/cloudcheck?x=1#y` | 리다이렉트 또는 같은 페이지, 앱이 쿼리·해시를 읽지 않음 |

---

## 10. Quality Gate — 출시 판정 기준

### 10-1. 게이트별 통과 조건

| 게이트 | 통과 조건 |
|---|---|
| G1 | 기존 INV 테스트 초록 + FO-01·03·07·08·09·10·11 초록 + **FO-05(CR-01) `.fails` 제거** + FO-02·06에서 남은 불일치는 모두 버그 ID가 붙고 심각도 '낮음' 이하이거나 기획팀장 결정으로 닫힘 |
| G2 | 기존 초록 + CR-04의 AZ-NET-1 서비스 태그·ASG 부분(D-3)이 구현되거나 방향서에 '명세 변경'으로 기록됨 |
| G3 | 100% 일치·tolerate 0 + AN-01 불일치 0(또는 정답지·엔진 중 하나를 고쳐 0) |
| G4 | 기존 초록 + CL-01·02·03 초록 + CL-04 오류 0. jq 1.6·bash 5 실제 실행은 G8 |
| G5 | 기존 초록 + ISO-02 초록 + ISO-03·04를 Chrome에서 위반 0으로 마침(보고서에 CDP 로그 요약) + UI-10 중 Blob 내려받기는 최소 Safari 1회 확인(실패면 CR-13을 고쳐야 통과). 라이브 항목은 배포 단계에서 |
| G6 | IN-01~12 초록(CR-11·CR-16 `.fails`는 '낮음'이라 허용하되 버그로 남김) |
| G7 | EX-01~04 초록 + **EX-05(CR-06) `.fails` 제거** + 디자인 §10-3 체크리스트를 디자인팀장과 닫음 |

### 10-2. 베타 배포(G1~G7 → '베타 · 실계정 검증 전' + noindex) 판정

- **차단(고치기 전에는 배포 불가)**: CR-01(높음), CR-06(G7). Azure 실제 점검을 열기 전에는 CR-02도 차단(지금 Azure는 '준비 중'이라 AWS 베타는 막지 않는다).
- **G8(PM V1) 전까지 닫을 것**: CR-03, CR-05, CR-07②, CR-08, CR-09, CR-10, CR-12.
- **결정 필요(기획팀장, §11)**: D-1~D-4. 결정 전에는 현재 동작을 '알려진 한계'로 V7 판정 규칙 화면·못 보는 것에 적는다.
- **허용(알려진 문제로 기록)**: CR-11, CR-13(Safari 확인 뒤), CR-14~17.
- 판정 결과는 `docs/qa/cloudcheck-bug-report.md` 끝에 '출시 판정: 가능 / 조건부 / 불가'와 근거로 적는다.

---

## 11. 결정이 필요한 항목

| # | 결정 | 제안 기본값 | 대상 |
|---|---|---|---|
| D-1 | '인터넷 전체'와 같은 출발지(합쳐서 0.0.0.0/0, /8 이하 넓은 접두) | 합쳐서 전체면 0.0.0.0/0과 같게, /8 이하는 주의 | 기획팀장 + DB설계자 |
| D-2 | CloudTrail 전송 오류가 있는 trail | 주의(새 사유 "기록 중이지만 저장에 실패하고 있음") | 기획팀장 |
| D-3 | AZ-NET-1 서비스 태그·ASG 출발지(기획서 §6-2 주의 조건) | 기획서대로 주의 | 기획팀장 |
| D-4 | 위험 포트 + 프리픽스 리스트 출발지(AWS) | 주의(내용 확인 필요) 또는 이상 없음 사유 문구에 '프리픽스 리스트 제외' 명시 | 기획팀장 + 디자인팀장 |
| D-5 | 체험 회사 전환 때 본인 응답·예외 표시 유지 | 전환 때 비움(체험끼리 섞이지 않게) | 디자인팀장 |
| D-6 | 붙여넣은 CSV(기준 시각 없음) 안내 | V2에서 "파일로 넣어야 기준 시각을 알 수 있습니다" 안내 | 디자인팀장 |
| D-7 | 번들 목표 상향 | 프론트 제안 표(§9-4) | 기획팀장 |

---

## 12. 자동화 전략

| 층 | 도구 | 위치 | 실행 |
|---|---|---|---|
| 엔진·파서 속성·변이 | vitest 1.6 + fast-check 3(설치본), 시드 고정 | `src/lib/cloudcheck/qa/*.test.ts` | `npx vitest run src/lib/cloudcheck/qa` |
| 화면(실엔진) | RTL + jsdom(파일 지시어), 기존 하네스 | `src/lib/cloudcheck/qa/ui/*.test.tsx` | 같음 |
| 커밋된 HTML 행동 | jsdom에서 `PAGE.html` 실행 + API 스파이 | `qa/isolation.runtime.test.ts` | 같음 |
| 수집기 | 기존 shim 키트(`collector/testkit.ts`), `/usr/bin/expect`, 로컬 도커 `bash -n` | `qa/collector-*.test.ts` + 스크래치 명령 | expect 없으면 skip |
| 실브라우저 | Chrome 헤드리스 CDP(`/Applications/Google Chrome.app`), axe-core(설치본) 주입 | 스크래치패드 `qa/cdp-sweep.mjs` | `node cdp-sweep.mjs file://… <out>` |
| 수동 | Safari·Firefox·스크린리더·실기기 | 표 양식 `docs/qa/cloudcheck-bug-report.md` 부록 | — |

- 레포 안에는 시험만 남기고 스크린샷·PDF·CDP 로그는 스크래치패드에 둔다(프론트 관례).
- 새 테스트 때문에 `_generated/page.ts` 재생성이 필요해지면 안 된다(시험 파일은 번들 입력이 아님). 생기면 그 자체가 버그다.

---

## 13. QA실행자에게 넘기는 지시 요약

1. **먼저 재현**: 부록 A의 프로브 5개를 돌려 §3 표의 E-01~25가 그대로인지 확인하고, 확인된 것마다 버그 ID(CC-QA-NN)를 붙여 `docs/qa/cloudcheck-bug-report.md`에 올린다(재현 명령·입력·기대·실제·심각도·관련 CR).
2. **P0 구현 순서**: FO-05 → FO-02 → FO-04 → EX-05 → FO-01·03·07~11 → AN-01 → ISO-02 → IN-01~12 → EX-01~04 → FO-06(차등 오라클). 확인된 버그를 담는 테스트는 `it.fails` + 버그 ID.
3. **실브라우저**: ISO-03·04를 Chrome CDP로(프론트 스크립트 확장), UI-03~07 같은 스크립트에서. Safari·Firefox(UI-10)는 수동 표로 남기고 할 수 없으면 PM 몫으로 표시.
4. **P1·P2**: CL-01~06, UI-01·02·08·09, PF-01~05.
5. **제약**: 레포 변경은 `src/lib/cloudcheck/qa/**`와 `docs/qa/cloudcheck-bug-report.md`(+ 필요하면 이 문서의 결과 칸)만. 패키지 설치·도커 이미지 받기·커밋·push 금지. 로컬 서버(`next start`)가 필요한 항목(ISO-01 HEAD, ISO-05)은 권한이 없으면 라이브 항목으로 넘긴다.
6. **끝낼 때**: `npx vitest run src/lib/cloudcheck src/app/cloudcheck`(지금 85파일 2,896개 기준) + 레포 전체 `npx vitest run` + `npm run type-check` 초록, 출시 판정(§10-2)을 버그 리포트 끝에 적는다.

---

## 부록 A. 탐색 프로브(레포 밖)

위치: `/private/tmp/claude-501/-Users-pyoungminho-Desktop-------team-makes/a8432358-e439-4607-8633-d54f9c3d981b/scratchpad/qa/`
실행: 레포 루트에서 `npx vite-node <위 경로>/probeN.ts`

| 파일 | 재현 |
|---|---|
| `probe1.ts` | E-07~10, E-12~18, E-25(AWS-NET-1·KEY-4·LOG-1 값 변조, ENI 잘림, 프리픽스 리스트) |
| `probe2.ts` | E-05·06(Azure 모수 신원), E-20(다계정 CSV), E-24(`--regions`), E-11(AZ-NET-1 출발지) |
| `probe3.ts` | E-01·02(CSV 기준 시각 역전, 시간 알림 0), 붙여넣기 CSV = 기준 시각 없음 → 확인 불가 |
| `probe4.ts` | E-19(양성 + 범위 미증명), E-04(Azure 수집 시각 역전), E-03(`lastModified` 0) |
| `probe5.ts` | E-22(정리기 차이), E-21(요청 구독), E-23(예외 사유 비밀) |
| `baseline-vitest.log` | 기준선 85파일 2,896개 통과 기록 |
