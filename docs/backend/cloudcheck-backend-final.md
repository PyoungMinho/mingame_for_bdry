# 「문단속 5」(cloudcheck) 백엔드 아키텍처 최종안

> 작성: @백엔드팀장 · STEP 4 마무리(2026-10-19) · **STEP 6 최종 갱신(2026-10-20)** · 검토 대상: @API설계자(계약·parse·수집기), @DB설계자(엔진·룰·픽스처)
> 기준 문서: `docs/planning/project-direction-cloudcheck.md`(방향서, 충돌 시 우선) · `docs/planning/cloudcheck-plan.md` · `docs/backend/cloudcheck-lead-review.md`(STEP 2 검토, 위협 모델 §6) · `src/lib/cloudcheck/contract/NORMALIZED.md` · STEP 5 `docs/planning/cloudcheck-qa-decisions.md`(QA 결정) · `docs/qa/cloudcheck-bug-report.md`(§R 재검증)
> 표기: [확인] 1차 문서·소스·로컬 실행으로 확인 / [일반 지식] 원문 재확인 안 함 / [미확인] → PM V1 실측 또는 QA
> STEP 6 검수 결과·판정 근거는 `docs/review/cloudcheck-backend-review.md`. 이 문서는 아키텍처 정본(최신본)이다. §0-1 · §4 · §7-6 · §8-2~3 · §9~12가 STEP 6에서 바뀌었다.

---

## 0-1. 최신 상태(STEP 6, 2026-10-20) — 이 절이 §0보다 우선

1. **백엔드 판정: 베타 출시 승인**(AWS · 띠 + noindex · QA 판정 '베타 배포 가능(조건부)'과 같은 조건). 백엔드 쪽 베타 차단 항목은 0이다. 남은 베타 조건은 PM 수동 2건(Safari Blob · 버튼 인쇄 2모드)과 메인 세션의 `_generated` 재생성이다.
2. **CC-QA-24 수정**(낮음 · B): AWS-NET-1은 IP 프로토콜 번호를 0~255의 정규 표기(앞자리 0 없는 10진 정수)만 '포트 없는 프로토콜'로 본다. 범위 밖(256 · 999)과 비정규 표기(006 · +6)는 해석 불가(`value-unrecognized`)다. micro 8개를 더했고 QA `it.fails` 1개를 `it`으로 바꿨다(§8-3).
3. **수집기 재검토 승인**: AWS `5547c91e…`는 STEP 4 승인본 `f223a053…`과 **3줄만 다르다**(219 D-2 · 220 주석 · 221 CC-QA-07②). 위협 모델 9항목이 모두 유지되고, 오류 글자(`LatestDeliveryError` 원문)는 jq 밖으로 나가지 않는다(§7-6). Azure `8bc7bd2f…`는 STEP 4와 같다.
4. **계약 추가 승인**: `FamilyCoverage.memberKeys?` · `InputFacts.asOfRejected?` · `InputFacts.latestEvidence?`(모두 선택 필드 · `cloudcheck.normalized/1` 유지), 모델 `Banner` `as-of-before-evidence`(합집합에 추가 · `cloudcheck.report/1` 유지 · 프론트 렌더 확인). 수집 계약 · 호출 카탈로그 · 예외 파일 계약은 STEP 4 이후 바뀐 바이트가 0이다.
5. **중복 상수 결정**: `rules/params.ts RESERVED_IPV4_RANGES`와 `parse/mask.ts keepIpv4`는 **한 상수로 묶지 않는다**. 대신 둘이 같다는 사실을 경계 주소 대조 시험으로 고정했다(§6-4).
6. **테스트**: `npm run type-check` 오류 0 · `src/lib/cloudcheck` 92파일 **3,353 통과 | todo 1**(STEP 6 전 3,316 → +37) · `guards.test.ts` 147 통과 · `generated.test.ts` 48 중 동기 1건만 실패(lib을 바꿨으므로 예상, 메인 세션 재생성).

---

## 0. 결론(STEP 4 기록 — 최신 상태는 §0-1)

1. **백엔드 산출물은 배포 가능한 품질이다.** 서버가 없는 구조(수집기 bash 2종 → 결과 JSON → 브라우저 안 순수 함수 판정)가 방향서대로 구현됐고, fail-closed가 타입·봉인·증명 객체·안전망 4겹으로 강제된다. lib 테스트 42파일 1,988개, 프론트 가드 147개, `npm run type-check` 모두 통과.
2. **보안 리뷰에서 fail-open(위험을 '이상 없음'으로 말할 수 있는 경로) 3건과 수집기 문제 2건을 찾아 직접 고쳤다.**
   - AZ-STO-2: 컨테이너 `publicAccess`를 읽지 못한 값(null)을 '비공개'로 보고 이상 없음을 냈다 → 확인 불가로. 가짜 회사 데이터도 실제 ARM 값(`"None"`)으로 맞췄다.
   - AZ-LOG-2: 구성이 문서로 확인되지 않은 범주 그룹 `audit`을 세 범주 전부로 보고 이상 없음을 냈다 → 확인 불가로(AZ-LOG-1과 같은 원칙).
   - AWS-KEY-4: `sts:Assume*` 같은 와일드카드 액션 문장을 건너뛰어 `Principal: "*"` 역할이 이상 없음이 될 수 있었다 → glob 판정으로.
   - AWS 수집기: 환경변수·설정 파일의 엔드포인트 지정(`AWS_ENDPOINT_URL*`, `endpoint_url`)을 막지 않았다 → `AWS_IGNORE_CONFIGURED_ENDPOINT_URLS=true`로 무력화(env-guard 결정).
   - Azure 수집기: 도구 버전 확인용 `az --version`이 매번 Microsoft 저장소로 최신 버전을 조회했다(카탈로그 밖 네트워크 요청) → 로컬 전용 `az version`으로.
3. **수집기는 아직 한 번도 공개되지 않았으므로(커밋·push 0건) v1.0.0 해시를 다시 썼다.** 추가 전용 원칙은 첫 공개부터 적용한다.
4. **프론트팀장은 `_generated/page.ts`를 재생성해야 한다**(수집기 원문·해시, 체험 데이터, 엔진·룰 번들이 바뀜). 지금 `generated.test.ts`의 동기 1건 실패는 방향서 §1-2 N에 따라 정상이다.

---

## 1. 기술 스택

| 영역 | 확정 | 비고 |
|---|---|---|
| 수집기 런타임 | bash 3.2 부분집합(macOS 3.2 = 기준선, CloudShell 5.x) + 사전 설치된 `aws`·`az`·`jq`(1.6 호환 문법) | 설치 0. 린터 L-12(bash)·L-13(jq)로 강제 |
| 판정기 런타임 | 브라우저 안 TypeScript 순수 함수(React와 같은 번들, esbuild) | 서버·DB·외부 API 없음. `process.env` 0 |
| 스키마 검증 | zod 3.25.76(설치본) | 수집 계약·예외 파일·룰 데이터 |
| 배포 | 프론트 생성물(`_generated/page.ts`) + Route Handler(`force-dynamic`) | 방향서 §2·§10. CLAUDE.md의 루트 `api/`는 쓰지 않는다 |
| 테스트 | vitest(설치본), 가짜 CLI shim(bash) | moto 대신 shim + PM V1 실측(방향서 §1-1 #12) |

---

## 2. 시스템 구조도

```
[사용자 셸: CloudShell / Cloud Shell]                         [브라우저: /cloudcheck 한 장]
 cloudcheck-aws.sh (26종 조회)  ─┐                             recognize(입력 1개)  ── 크기·깊이·인코딩·키 파일 거부·스키마 우선·봉투
 cloudcheck-azure.sh (9종 조회) ─┼─▶ 결과 JSON(권한 600) ──▶      │  (ParsedHandle: parse 전용)
 콘솔 CSV(자격증명 보고서 · RG) ─┘     업로드·붙여넣기            buildInput(여러 개) ── 병합·문 단위 선택·Redactor(R-12)·FamilyCoverage 봉인
                                                                   │  (NormalizedInput: 깊게 freeze)
                                                                 judge(input) ── 룰 18장(출시 AWS 10·Azure 7) → aggregate(증명 있을 때만 승격)
                                                                   │  (Report: 직렬화 가능, 문장 없음)
                                                     UI 표시 단계: timeNotices(report, now) · overlayExceptions(report, file, today) · compare(a, b) · maskedCopy(input)
```

- **계층 규칙**(가드 테스트로 강제): `engine`·`rules`는 `contract`·`model`만 import, `parse`·`collector`·`fixtures`·화면 import 0. `parse` → `collector/RELEASES.json` 한 건만 예외(메인 세션 결정, 프론트 가드가 좁게 허용).
- **결정성**: `engine`·`rules`·`contract`·`parse`에서 시계·난수·타이머·네트워크·DOM·환경·console·eval 0건(소스 가드). 현재 시각은 UI가 `timeNotices`에만 넘긴다.

### 2-1. 디렉터리(`src/lib/cloudcheck/`)

| 경로 | 내용 | 담당 |
|---|---|---|
| `model/` | `report.ts`(판정 결과 모델 v1, G0 동결) · `banned-words.ts` | 프론트팀장 + 백엔드팀장 |
| `contract/` | `calls.ts`(호출 카탈로그 26·9종) · `collect-schema.ts`(수집 계약 v1.0) · `exceptions-schema.ts` · `normalized.ts`(정규화 입력 계약, D1) · `normalized-invariants.ts`(검사기) · `rg-queries.ts` · `NORMALIZED.md` | API설계자 |
| `parse/` | `recognize` · `normalize(-aws·-azure·-common)` · `sanitize`/`secrets`(R-12 입구 청소) · `mask`(R-13) · `exceptions` · `leak-scan`(테스트 도구) · CSV 파서 | API설계자 |
| `engine/` | `proof`(ScopeProof, WeakSet) · `aggregate`(상태 결정 유일 지점) · `run`(룰 1개, 예외 격리) · `judge`(안전망) · `blocks`·`items`·`display`·`reasons`·`msg` · `time` · `exceptions`(오버레이) · `compare` | DB설계자 |
| `rules/` | 룰 18장(`aws/` 10 + `azure/` 8) · `rule-schema`·`registry`·`catalog`·`params`·`ports`·`kit`·`version` · `i18n/ko*.ts`(문구, 디자인팀장 검수 중) | DB설계자 |
| `collector/` | `cloudcheck-aws.sh`(257줄) · `cloudcheck-azure.sh`(193줄) · `SHA256SUMS` · `RELEASES.json` · `.gitattributes` · `lint.ts` · `footprint.ts` · `markers.ts` · `make-release.mjs` · `__shims__` · `__scenarios__` | API설계자 |
| `fixtures/` | `micro/`(손으로 쓴 사례) · `companies/`(가짜 회사 4×2 빌더 + JSON 8 + CSV 4 = 체험 데이터) · `answers/`(사람이 쓴 정답지 8) · `mutate.ts` · `invariants.ts` · `report-invariants.ts` | DB설계자(정답지는 QA 리뷰) |

---

## 3. "API" 확정 — UI가 부르는 함수(방향서 §5-3, 시그니처 변경 0)

| 함수 | 위치 | 계약 |
|---|---|---|
| `recognize({via, name, bytes, lastModified})` → `InputRecognition` | `parse/recognize.ts` | 예외 없음. 실패는 상태 코드(empty·too-large·wrong-type·parse-error·not-cloudcheck·schema-major·credentials-file·too-deep). 키 파일은 어떤 값도 싣지 않음 |
| `buildInput(recs)` → `{ok, input}` \| `{ok:false}` | `parse/normalize.ts` | 계정·클라우드 불일치 제외, runKey 중복 superseded, 문 단위 선택, 비밀 패턴 제거, coverage 봉인, 깊은 freeze |
| `judge(input)` → `Report` | `engine/judge.ts` | 순수 함수. 예외를 던지지 않는다(try/catch → `failClosedReport`: 전부 확인 불가 + 배너). now·예외 파일·본인 응답 인자 없음(INV-8·9) |
| `timeNotices(report, now)` | `engine/time.ts` | 24시간·7일·180일·시계 차이 5분. 체험이면 [] |
| `overlayExceptions(report, file, today)` | `engine/exceptions.ts` | 상태 불변, 라벨만 |
| `compare(a, b)` | `engine/compare.ts` | 수집 시각순 자동 정렬, 다른 계정·클라우드 거부 |
| `maskedCopy(input)` | `parse/mask.ts` | 결정적 가명 사본(`cloudcheck.masked/1`). 다시 불러올 수 없음(설계) |
| `parseExceptions` / `serializeExceptions` | `parse/exceptions.ts` | 예외 파일 v1.0 |
| `RULE_CATALOG` | `rules/catalog.ts` | 18장. `released:false`(AZ-MFA-1)는 리포트·분포 밖 |

## 4. "DB 스키마" 확정 — 데이터 계약

| 계약 | 버전 | 상태 |
|---|---|---|
| 수집 계약 `collect-schema.ts` | `cloudcheck.collect/1.0` | G0 동결 그대로. 변경 0(STEP 5 · 6에도 파일 바이트 변경 0 — `hasDeliveryError: boolean` 그대로) |
| 호출 카탈로그 `calls.ts` | AWS 26 · Azure 9 | 변경 0. 쓰기 호출은 `iam:GenerateCredentialReport` 1건 |
| 정규화 입력 `normalized.ts` | `cloudcheck.normalized/1` | STEP 5에 **선택 필드 3개 추가**(`FamilyCoverage.memberKeys?` · `InputFacts.asOfRejected?` · `InputFacts.latestEvidence?`) — STEP 6 백엔드팀장 승인. 기존 필드 이름·의미 변경 0, 메이저 그대로(NORMALIZED.md §7) |
| 판정 결과 `model/report.ts` | `cloudcheck.report/1` | STEP 5에 `Banner` 종류 `as-of-before-evidence`(파라미터 없음) 추가 — 메인 세션 승인, STEP 6 백엔드팀장 동의(리포트는 저장·교환 형식이 아니라 같은 번들 안에서만 만들고 읽는다) |
| 예외 파일 `exceptions-schema.ts` | `cloudcheck.exceptions/1.0` | 변경 0 |
| 정리기 정본 `contract/clean-text.ts` | — | STEP 5 새 파일(CC-QA-09). parse 입력 인식과 엔진 리포트 표시가 같은 함수를 쓴다(엔진은 parse를 가져올 수 없어 contract에 둔다) |
| 릴리스 이력 `RELEASES.json` | `cloudcheck.releases/1` | v1.0.0 2건. AWS 해시는 STEP 5에 두 번 다시 썼다(`--reset`, 공개 전 — §7-6 표) |
| 룰셋 `rules/version.ts` | `1.0.0` | STEP 5 · 6에 판정 로직을 여러 번 고쳤지만 첫 공개 전이라 1.0.0 유지(첫 공개 뒤에는 올린다) |

---

## 5. 수집기 사용법 · 필요 권한 · 발자국

### 5-1. 사용법(페이지·PDF 안내와 같아야 함)

| | AWS | Azure(베타 '준비 중', 실계정 검증 전) |
|---|---|---|
| 실행 위치 | AWS CloudShell(권장) 또는 aws CLI v2 + jq가 있는 셸 | Azure Cloud Shell(bash) |
| 사용자 입력 | `sha256sum cloudcheck-aws.sh`(페이지·PDF 해시와 대조) → `bash cloudcheck-aws.sh` | `sha256sum cloudcheck-azure.sh` → `bash cloudcheck-azure.sh` |
| 옵션 | `--doors mfa,key,net,sto,log` · `--regions r1,r2` · `--yes` · `--print` · `--help` · `--version` | `--doors key,net,sto,log` · `--subscriptions ID1,ID2` · `--yes` · `--print` |
| 계정 확인(C-05) | 계정 ID·별칭·실행 주체 표시 → Enter(대화형) 또는 `--yes`. 비대화형 + `--yes` 없음이면 신원 호출 1건 뒤 종료(exit 3, 파일 없음) | 테넌트·현재 구독 이름 표시 → 같음 |
| 결과 | 현재 폴더에 `cloudcheck-aws-<계정 끝4>-<UTC>.json`(권한 600, 한 줄 JSON). 대화형이면 끝에 "내려받았으면 Enter = 삭제" | `cloudcheck-azure-<테넌트 끝4>-<UTC>.json` |
| 중단 | 신원 실패·비상용 파티션(aws-cn·aws-us-gov)·도구 없음 → 호출 없이 종료(exit 4), 결과 파일 없음 | 로그인 안 됨·ID 형식 오류 → exit 4 |
| 예산(도구 기준) | 사용자 150 · 버킷 300(넘으면 나머지는 `budget-exceeded` 확인 불가) | 구독 20 · 구독당 스토리지 계정 100 |

### 5-2. 필요 권한

- **AWS**: 관리형 정책 **SecurityAudit** 하나로 25개 IAM 액션이 모두 덮인다(`sts:GetCallerIdentity`는 권한 불필요) [확인: STEP 2, 정책 문서 대조]. 쓰기 성격의 호출은 `iam:GenerateCredentialReport` 1건(보고서 생성 요청, 4시간 안의 보고서가 있으면 그대로 돌려줌, 폴링 최대 10회).
- **Azure**: 구독 **Reader**에 9개 RBAC 읽기 작업이 포함된다고 본다 [미확인 → PM V1]. 데이터 평면 명령·키·SAS·연결 문자열은 호출하지 않는다.

### 5-3. 발자국(호출 횟수, `footprint.ts estimateCalls`)

| 예 | 호출 수 |
|---|---|
| AWS: 사용자 20 · 그룹 3 · 리전 17 · 버킷 30 · trail 2 · 보고서 폴링 2 | **283회** |
| AWS: 예산 상한(사용자 150 · 그룹 10 · 리전 17 · 버킷 300 · trail 3 · 폴링 3) | 2,163회 |
| Azure: 구독 3 × 계정 5 | **47회** |
| Azure: 예산 상한(구독 20 × 계정 100) | 4,102회 ← 실행 시간 위험(§10, PM V1) |

- 영수증 1건 = 호출 1건(shim 테스트가 강제). 로컬 버전 조회 1건(`aws --version` / `az version`)은 네트워크 요청이 없고 영수증·발자국에 넣지 않는다.
- 페이지의 발자국 표는 `footprint.ts` 한 원천에서 만든다(CloudTrail 이벤트 이름 예외 매핑 `s3:ListAllMyBuckets → ListBuckets` [일반 지식 → PM V1]).

---

## 6. 확정한 판단

### 6-1. API설계자 계약 변경 2건 — **승인**

| 변경 | 판단 | 근거 |
|---|---|---|
| `contract/normalized-invariants.ts`(검사기 승격) | 승인 | NORMALIZED.md §5가 정한 절차대로 API설계자가 만들고 팀장이 확인. 검사 항목(입력 번호, 문 선택↔used, 범위 표 키·봉인·불변식, 영수증 키, Src·CSV 종류, 슬롯 출처, Instant 정규형)이 모두 살아 있고 테스트 전용 모듈이다(번들 미포함) |
| `normalized.test.ts` import 한 줄 | 승인 | 동작 변경 없음. 봉인 함수 사용 금지 가드(engine·rules)는 그대로 |
| `NORMALIZED.md` §6 "parse 구현 메모" | **승인(정정 1건)** | "보고서만으로는 `root.keys`가 항상 partial" 문장이 코드(`reportKeys()`: `additional_credentials_info` 열이 있고 비어 있으면 value)·`normalized.ts` 주석과 달랐다 → 코드 기준으로 고쳐 썼다(DB설계자 지적이 맞음). `normalized.ts` 변경 0 확인 |

### 6-2. API설계자에게 온 요청 처리

| 요청 | 처리 |
|---|---|
| NORMALIZED.md 루트 키 문장 정정 | 반영(위) |
| 루트 `password_enabled = not_supported` → `none` | **기각**. `none`은 '설정·대상 없음'이라는 유효한 답이라 `passwordEnabled`에서는 '비밀번호 없음'으로 읽혀 의도와 정반대가 된다. `missing(value-unrecognized)` 유지, 루트 행에 한해 '비밀번호 있음'으로 해석하는 일은 AWS-MFA-1이 한다(이미 그렇게 구현됨). 현행 AWS 문서는 루트 행 값을 TRUE/FALSE로만 설명한다 [확인: IAM 자격증명 보고서 문서] → 실제 루트 행 값은 PM V1 |

### 6-3. DB설계자 판단 ①~⑧

| # | 판단 | 결정 | 근거 |
|---|---|---|---|
| ① | D.azure AZ-LOG-2 해소법 = `diagnosticSettings/read` + `storageAccounts/read` 두 권한 | **확정** | Resolution.permissions = 요청할 권한 이름(방향서 §5-2). 레거시 구독의 계정 목록 거부와 stdemoapp01 진단 설정 거부를 둘 다 풀어야 룰이 풀린다. `answers.test`가 해소법 = 권한 힌트 집합 일치를 강제 |
| ② | AZ-LOG-2: 범주 그룹 `allLogs`·`audit`이 StorageRead/Write/Delete를 모두 담는다 | **`allLogs`만 확정, `audit`은 기각 → 코드 수정** | `allLogs` = 모든 범주는 진단 설정 문서 정의. `audit`의 Blob 서비스 구성은 지원 로그 표에 그룹 소속이 없다 [확인: MS Learn supported-logs blobServices, 2026-08-21판]. 미확인 매핑으로 '이상 없음'을 내면 fail-open → `audit`이 판단을 가르면 확인 불가(value-unrecognized). **PM V1 실측** 뒤 다시 정한다 |
| ③ | AZ-LOG-1: `audit` 단독은 확인 불가 | **확정** | fail-closed. 구독 활동 로그 진단 설정이 범주 그룹을 지원하는지부터 [미확인 → PM V1] |
| ④ | AWS-STO-2: 객체 소유권 설정 없음(none) = ACL 사용 중 | **확정**(보수적) | 'ACL 꺼짐'은 BucketOwnerEnforced 설정이 있을 때만 성립한다 [확인: S3 Object Ownership 문서]. 미설정 = 옛 기본(ObjectWriter)은 [일반 지식]. 결과는 최대 '주의'라 오판 방향이 안전. 2023-04 이전 버킷이 있으면 PM V1 실측 |
| ⑤ | AWS-KEY-3 관리자급 4종, Amplify·EB·SystemAdministrator 제외 | **확정** | `params.ts` 정책 문서 대조. 4종 밖·인라인·고객 관리형은 '못 보는 것'(cannot.2)으로 고지, '해당 없음' 문구가 "(기준 4종)"을 밝힌다(과장 없음). 이상 없음을 주지 않는 룰 |
| ⑥ | AWS-KEY-4 연합(Federated) 신뢰 미평가 | **확정** | 방향서 §6-4 "나중 범위". cannot.4 "OIDC·SAML(연합) 신뢰의 조건이 적정한지"로 고지 |
| ⑦ | Azure 키 회전 90일 = 도구 기준 | **확정** | MS 문서는 정기 회전만 권고하고 일수가 없다(DB설계자 확인). 파라미터 문구가 '도구 기준'을 밝힌다 |
| ⑧ | AWS-MFA-1: 루트 키는 계정 요약이 권위 | **확정** | 보고서와 실시간 요약이 다르면 양성까지 보류(확인 불가 stale-evidence). 비활성 루트 키의 보고서 표기는 PM V1(어긋나면 확인 불가로 떨어질 뿐, 위험을 숨기지 않음) |

### 6-4. STEP 6 결정 — 사설·예약 대역 상수(DB설계자 질문 · 결정 문서 §2-3 ④ "한 상수로 둘 위치는 백엔드팀장이 정한다")

| 항목 | 결정 |
|---|---|
| 결론 | **두 곳에 둔다**(`rules/params.ts RESERVED_IPV4_RANGES` · `parse/mask.ts keepIpv4`). 한 상수로 묶지 않는다 |
| 이유 ① 목적이 다르다 | 룰 쪽은 '넓은 공인 대역' 판정에서 뺄 범위다. 판정 파라미터이고 V7에 근거(공개 기준)와 함께 보이며, 바뀌면 `PARAMS_FINGERPRINT` → 룰셋 버전 신호가 된다. 마스킹 쪽은 '어느 회사의 것도 아니라 그대로 둬도 되는 주소'라는 개인정보 정책이다. 묶으면 판정을 위해 고친 값이 가명 사본의 노출 범위를 몰래 바꾼다(반대 방향도 같다) |
| 이유 ② 판정 정확성이 서로 기대지 않는다 | 접두 ≤ /8 값은 `keepIpv4`와 무관하게 `wideIpv4`가 그대로 둔다. 룰의 예약 대역 목록은 접두 ≤ /8 값에만 쓰인다. 그래서 두 목록이 달라져도 `judge(maskedCopy(x)) = judge(x)`는 깨지지 않는다 |
| 이유 ③ 늦은 단계의 변경 최소화 | QA가 최종 바이트로 검증한 마스킹 출력을 바꾸지 않는다(제품 동작 변경 0) |
| 대신 한 것 | 두 목록이 지금 같은 9개라는 사실을 **경계 주소 대조 시험**으로 고정했다(`parse/mask.test.ts` — 대역마다 첫·끝 주소와 바로 바깥 주소 32개를 마스킹해, 그대로 남는 주소 = 룰 목록 안의 주소인지 대조). 한쪽만 바꾸면 이 시험이 깨지므로, 고치는 사람이 다른 쪽도 바꿀지(또는 시험을 이유와 함께 바꿀지) 정해야 한다. 시험이 실제로 잡는지는 `keepIpv4`에서 169.254/16을 일부러 뺀 변이로 확인했다(경계 주소 2개 검출 → 원복, 해시 일치). 두 파일 주석에 이 결정을 적었다 |

---

## 7. 보안 리뷰 결과

### 7-1. 수집기 줄 단위 점검(체크리스트)

| 항목 | 결과 | 근거·강제 지점 |
|---|---|---|
| 허용 명령만 | 통과 | 추출한 명령 집합 = 카탈로그(완전 일치, 미사용 카탈로그도 실패) — L-04·L-05 토크나이저 린터 + shim 실행 기록(2차 방어). 래퍼 밖 aws/az는 로컬 버전 조회 2개 형태만 허용 |
| 비밀 반환 명령 0 | 통과 | L-06 금지 목록(45개, 허용 목록과 교집합 0 테스트). `list-access-keys`는 키 ID 끝 4자리만 남김(전체 ID는 프로세스 밖으로 안 나감, 결과에 `AKIA…` 0 — 테스트) |
| 금지 옵션 0 | 통과 | `--endpoint-url`·`--debug`·`--no-verify-ssl`·`--ca-bundle`·`--cli-input-*` — L-11 + 실행 argv 검사(`FORBIDDEN_FLAGS`) |
| 엔드포인트 변조(환경변수·설정 파일) | **고침** | `AWS_IGNORE_CONFIGURED_ENDPOINT_URLS=true` 내보냄 [확인: AWS SDKs·Tools 참조 가이드 — env·config의 엔드포인트 설정을 모두 무시]. L-11 `endpoint-guard`(머리 10줄 안, 값 `true` 고정) + shim이 값이 없으면 모든 aws 호출 거부 |
| Azure 데이터 평면 0 | 통과 | 9개 명령 모두 관리 평면(`container-rm`). `storage container list`·`storage blob`·키·SAS·연결 문자열 L-06 금지 |
| 오류 삼키기 0 | 통과 | `||`는 `|| rc=$?`만(L-09), `/dev/null`·`|| true`·`set +e`·`2>&-` 0. 호출 실패는 영수증으로 남고 다음 호출로 진행, 내부 오류는 `set -e`로 중단(결과 파일 없음) |
| 출력 allowlist | 통과 | 26+9개 jq 투영을 하나씩 확인. 버리는 것: 태그·설명·정책 전문·조건 값·키 값·IP·MAC·소유자 ID·세션명·UPN·오류 메시지 원문·엔드포인트·트레일 대상 버킷. zod strict + 독이 든 응답(POISON) 테스트 |
| 네트워크 송신 0 | **고침** | 스크립트에 송신 도구 0(L-08 + 독립 grep). `az --version`이 매번 `azcliprod.blob.core.windows.net`으로 최신 버전을 조회함을 확인 [확인: azure-cli `util.py _update_latest_from_ame_storage`] → 로컬 전용 `az version`으로 교체, `az --version`은 린터가 거부. az 텔레메트리는 `AZURE_CORE_COLLECT_TELEMETRY=false` |
| Trojan Source 0 | 통과 | L-02(숨은·bidi·제어 문자, 따옴표 밖 비ASCII) + 독립 바이트 검사: 두 파일 BOM·CR·형식 문자 0, 따옴표·주석 밖 비ASCII 0 |
| 부분 복붙 | 통과 | 마지막 줄 `main "$@"`, 잘린 파일은 아무것도 실행 안 함(테스트). 원문 복사 버튼 없음 |
| 셸 주입 | 통과 | 모든 변수 인용, 사용자·그룹·버킷 이름은 줄 단위 `read -r`, CLI stdin은 빈 파일. `$(touch PWNED)` 이름 시험 통과. 이름이 `-`로 시작하는 IAM 사용자·그룹은 CLI 인자 파싱이 실패(252) → 그 대상만 확인 불가(값으로 오인되거나 전역 옵션이 요청을 보내는 일 없음, fail-closed) |
| 터미널 이스케이프 | 통과 | 화면에 내는 별칭·주체·구독 이름은 jq `@json`으로 이스케이프 |
| 파일 위생 | 통과 | `umask 077`, `mktemp`(600) 후 `mv` 1회, 임시 디렉터리 `trap … EXIT` 정리 |

### 7-2. 위협 모델별 판정(STEP 2 §6-1 기준)

| 위협 | 판정 | 남은 위험 |
|---|---|---|
| 사칭 페이지 | 대응 유지: 사용자가 직접 `sha256sum`, PDF·저장소 해시(독립 채널, G9), 모르는 수집기 해시면 리포트에 `collector-unknown-release` 배너(INV-10, sha256은 자기 신고값이라 보안 증거 아님) | 해시를 대조하지 않는 사용자 |
| 배포 계정 탈취 | 레포 안 3중 일치(파일 = SHA256SUMS = RELEASES.json = 페이지)는 그대로 통과된다는 한계 유지 → 2FA, RELEASES.json 추가 전용(첫 공개부터), PDF 해시와 라이브 해시 주기적 수동 대조 | 레포 권한 탈취 |
| 부분 복붙 | 해소 | — |
| 과수집 | 해소(7-1 출력 allowlist) | 자격증명 보고서 CSV 원문은 C-07 명시 예외(비밀 열 없음) |
| 과권한 | 정확한 허용 목록 + 쓰기 1건 + SecurityAudit·Reader 권장 | 관리자 권한으로 실행하는 '현실 모드'는 사용자 책임(읽고 실행) |
| 공급망 | 수집기 설치 0, 판정기는 React·zod만, 런타임 외부 코드 0 | aws·az·jq 자체(클라우드 사업자 신뢰), az 사용자 설정 `auto-upgrade.enable`(기본 꺼짐 [확인: azure-cli `__main__.py`]) |
| 습관 학습 | 셸 붙여넣기 없음, 파일 + 해시, 발자국 표 | — |

### 7-3. env-guard 결정(API설계자 미구현 항목)

- **결정: '경고'가 아니라 '무력화'로 구현했다(AWS).** `export … AWS_IGNORE_CONFIGURED_ENDPOINT_URLS=true` 한 토큰과 주석 한 줄. 환경을 덤프하지 않고(L-10 유지), 변수를 하나씩 검사하는 코드도 필요 없으며, `AWS_ENDPOINT_URL`, `AWS_ENDPOINT_URL_<SERVICE>`, config의 `endpoint_url`(프로필·services 섹션)을 한 번에 막는다. 우리 호출은 모두 기본 공용 엔드포인트로 가야 하므로 잃는 것이 없고, 맞춤 엔드포인트가 꼭 필요한 망이면 호출이 실패해 확인 불가가 될 뿐 엉뚱한 곳의 데이터를 판정하지 않는다(LocalStack 환경변수가 남은 개발자 셸 대비).
- **프록시·CA 번들(`HTTPS_PROXY`, `AWS_CA_BUNDLE`, `REQUESTS_CA_BUNDLE`)은 건드리지 않는다.** 전송 경로 설정이라 사용자가 평소 aws·az를 쓰는 경로와 같고, 수집기가 노출을 늘리지 않는다. 바꾸면 사내 TLS 검사 환경에서 정상 사용자가 막힌다. → 페이지 고지 문구 후보로 넘긴다(§11).
- **Azure는 지금 바꾸지 않는다.** 목적지는 활성 클라우드(`az cloud set`)가 정하고 수집기가 `identity.cloudName`에 기록한다. `AZURE_CLI_DISABLE_CONNECTION_VERIFICATION`(TLS 검증 해제)을 빈 값으로 무력화하는 방법과 `AzureCloud`가 아니면 중단하는 방법은 둘 다 0줄로 넣을 수 있지만, 무력화 동작이 [미확인]이고 Azure는 실계정 검증 전 '준비 중'이라 **Azure 베타 전 결정 항목**으로 남긴다(§10).
- 수집기 줄 수 판단: **AWS 257줄 · Azure 193줄, 하드 상한 260(C-01) 안이라 승인.** 목표 '약 200줄'을 넘는 이유는 호출마다 붙는 한국어 마커 주석(L-03, 26개)과 문 단위 구간 표식이다. 실제 가독성 비용은 줄 수보다 긴 jq 줄(최장 약 1,170자, 4줄)에 있으므로 페이지는 구간 접기(마커)와 줄 바꿈 보기를 제공해야 한다. AWS 여유가 3줄뿐이라 v1.0.x에서 기능을 더하려면 다른 줄을 줄여야 한다(상한은 올리지 않는다).

### 7-4. 판정기 fail-open 점검('이상 없음'을 내는 지점 18곳 · 룰 15장 전수)

| 룰 | 결과 | 조치 |
|---|---|---|
| AZ-STO-2 | **fail-open**: `publicAccess = null`(필드를 못 읽음) → '비공개' → 이상 없음. 수집기 shim 시나리오는 실제 ARM처럼 `"None"`을 쓰는데 가짜 회사는 `null`을 써서 테스트가 이 경로를 못 봤다 | null·모르는 열거값 → 확인 불가(아는 값 None·Blob·Container만 해석). 가짜 회사 13곳 `"None"`으로, 회사 JSON 재생성(정답지 변경 0으로 일치 확인). micro `access-unreadable` 추가 |
| AZ-LOG-2 | **fail-open**: `audit` 그룹 = 세 범주(미확인) → 이상 없음 | `audit`이 판단을 가르면 확인 불가. micro `audit-group` 기대 clear → unknown |
| AWS-KEY-4 | **fail-open**: 액션 판별 `^(\*|sts:\*|sts:assumerole[a-z]*)$` — `sts:Assume*`·`sts:AssumeRole*` 문장을 건너뜀 → `Principal: "*"`가 이상 없음 | IAM 와일드카드(* ?) glob으로 역할 맡기 액션 3종을 덮는지 판정, 예상 밖 글자는 덮는 것으로. micro `wildcard-action`(위험) 추가 |
| 그 밖 15곳 | 안전 | AWS-STO-1(4개 설정이 모두 켜진 값일 때만), AWS-STO-2(필요 사실 전부 '답'일 때만), AWS-NET-1·AZ-NET-1(미인식 포트·규칙 → 확인 불가), AWS-LOG-1(읽지 못한 trail이 갖췄을 수 있으면 보류), KEY-1·KEY-2·MFA-1·MFA-2·AZ-KEY-1·AZ-STO-1(빈칸 → 확인 불가) |
| parse 보강 | 활성 리전 목록이 빈 배열이면(실제 계정에서 불가능한 모양) 보안 그룹·ENI 패밀리가 '0개 완결'로 증명됐다 → 창문 문 '해당 없음' | `scope-unproven`으로(테스트 추가) |

### 7-5. 불변식 강제 지점(INV-1~10)

| INV | 구조적 강제 | 테스트 |
|---|---|---|
| 1 fail-closed | 룰은 상태를 직접 못 낸다. `aggregate`가 확인 불가에서 시작해 진짜 ScopeProof(WeakSet 발급)가 있을 때만 승격. 증거가 '답'(ok·empty·notconfigured·CSV 칸)이 아닌 이상 없음·제외는 강등. 룰 1개 예외 → 그 룰만 parse-failed, `judge` 예외 → 안전망 Report | `engine/judge.test.ts`(위조 증명·증거 없는 이상 없음·던지는 룰·Proxy 입력) |
| 2 빈·엉뚱한 입력 | `failClosedReport`(정적 데이터만) | `judge.test` "엉뚱한 입력은 전부 확인 불가 + 배너" |
| 3 증거 삭제 변이 | `fixtures/mutate.ts`(deny·truncate·dropField·bumpSchema·removeUnit) 단조성 | `judge.test` 전수·무작위(시드 고정) 변이, `parse/mutation-fuzz.test.ts` |
| 4 비대칭 | 양성은 부분 데이터에서도 유지, RG·Entra CSV는 `complete=false` 고정 | `judge.test` "다른 리전의 위험 유지" |
| 5 모수 0 | 해당 없음 = 증명된 열거 + 적용 대상 0. 타입 `ProvenCoverage & {population: 0}` | `report.typetest.ts`, micro na 사례 |
| 6 notconfigured | Slot `none` = 유효한 답, `ANSWER` 집합에 포함 | `normalize.*.test` 슬롯 표 |
| 7 고립 거부 | `aggregate.liftIsolatedDenials`(같은 호출이 다른 대상에서 성공) → 주의 `isolated-denial` | D 세트 정답지, `judge.test` Azure INV-7 |
| 8 예외·본인 응답 | `judge(input)` 시그니처에 없음, 오버레이는 상태 불변 | 타입 + `engine/exceptions.test.ts` |
| 9 순수성 | 소스 가드(engine·rules + **이번에 contract·parse 추가**), 엄격 시각 파서(Date.parse 금지) | `source-scan.test`, `judge.test` "전역 Date·Math.random이 막혀도 같은 결과", "두 번 판정하면 바이트 단위로 같다" |
| 10 버전 | 스키마 메이저 거부, 섹션별 strict/strip, `knownRelease`(RELEASES.json), `ccQuery` 열 | `recognize.test`, `rg-queries.test` |

- 정답지 자동 생성 경로 **0**: 생성기(`companies/generate.ts`)는 회사 데이터만 쓰고, `answers.ts`에는 Report → 정답지 함수가 없고, 스냅샷 갱신 경로도 없다. 알려진 차이(`tolerate`)는 8개 정답지 모두 0건이며 **이번에 "tolerate 0건"을 G3 테스트로 못 박았다.**
- 누출 스캔 범위: 시나리오 · collector · contract · parse · fixtures · maskedCopy 출력 + **이번에 rules(문구 포함) · engine · model 추가**(모두 깨끗).

### 7-6. STEP 6 수집기 재검토(AWS `5547c91e…`) — **승인**

**해시 이력**(모두 v1.0.0 · 공개 전 `make-release.mjs --reset` — `src/lib/cloudcheck`·`src/app/cloudcheck`를 건드린 커밋이 모든 ref에서 0건임을 `git log --all`로 확인):

| 순서 | AWS `cloudcheck-aws.sh` sha256 | 바이트 · 줄 | 변경 | 승인 |
|---|---|---|---|---|
| 1 | `f223a0530345ebe4e52662cec5d3f056083e98e4528387da60b665818f24480f` | 26,424 · 257 | STEP 4 엔드포인트 고정 | STEP 4 백엔드팀장 |
| 2 | `25ff8e8fcfaddc1601f6cf68dad6402f591f1daa9f0ff2f9e6a6d1b87238d4dd` | — · 257 | STEP 5 1라운드: CC-QA-07② 고급 선택기 투영 | (중간본 — 3으로 대체) |
| 3 | `5547c91e7f8a4b152c8693eca25ca33d68a886f70247ef9a91599c1dd1c3b988` | 26,671 · 257 | STEP 5 2라운드: D-2 `hasDeliveryError` 빈 문자열 방어 | **STEP 6 백엔드팀장** |

Azure `cloudcheck-azure.sh` = `8bc7bd2ff9df9d5c20a30d841c2b3051d93f06bb6eec5d6e41356b3151462f8d`(18,650바이트 · 193줄, STEP 4와 같음).

**방법**: QA 1차가 내려받아 둔 바이트(해시 = `f223a053…`, 레포 밖 스크래치)와 지금 파일을 `diff`했다. 다른 줄은 정확히 3줄이다.

| 줄 | 내용 | 판정 |
|---|---|---|
| 219 (D-2) | `hasDeliveryError: ((.LatestDeliveryError // null) != null)` → `(((.LatestDeliveryError // "") \| tostring \| length) > 0)` | 출력은 불리언 하나. 오류 글자는 jq 안에서 길이로만 쓰이고 밖으로 나가지 않는다. 키 없음 · `null` · `""` = 거짓, 글자 있음 = 참, 문자열이 아닌 모양(숫자 · 객체 · 배열)은 참(보수적 — 주의 쪽) |
| 220 | 마커 주석 문구만(`# @cc:log.selectors …`) | 주석 안 한글 · 가운뎃점만, 형식 · 양방향 문자 0 |
| 221 (CC-QA-07②) | 고급 선택기 `eventCategory` · `readOnly` 필드: `NotEquals` · `StartsWith` · `EndsWith` · `NotStartsWith` · `NotEndsWith` 중 비어 있지 않은 것이 하나라도 있으면 `equals: []`, 아니면 Equals 값(문자열화, 64자 자름) | 다른 연산자의 **값은 싣지 않는다**(있다는 사실만 빈 목록으로). 필드 이름은 `select`로 두 리터럴만. 선택기 이름 · `resources.ARN` · `eventName` 등은 지금처럼 버린다 |

**위협 모델 항목별**(STEP 2 §6 · 이 문서 §7-1):

| 항목 | 결과 | 근거 |
|---|---|---|
| 허용 명령만 | 유지 | 바뀐 것은 `call`의 jq 투영 문자열뿐. 명령 · 인자 · 호출 카탈로그(`calls.ts`, 10-19 이후 바이트 변경 0) 그대로 |
| 비밀 반환 0 | 유지 | 새 호출 0 |
| 금지 옵션 0 | 유지 | 옵션 변경 0 |
| 데이터 평면 0 | 유지 | CloudTrail 관리 API 2개(get-trail-status · get-event-selectors) 그대로 |
| 오류 삼키기 0 | 유지 | jq가 실패하면 `call`이 `transform-failed` 영수증(값 `null`)을 남기고 jq 오류 글자는 `$TMP/err`에만 남는다. 손으로 시험: `"Equals":"false"`(배열 아님) → jq 오류(입력 값이 오류 글자에 들어가지만 출력 0) |
| 출력 allowlist | 유지 | 219: `{isLogging, hasDeliveryError}` 불리언 2개. 221: `field`(두 리터럴) + `equals`(≤64자 문자열 목록). 시험: 독이 든 응답(`LatestDeliveryError: "AccessDenied: POISON-trail-bucket 203.0.113.77 kim@example.com <script>…"`)과 ⑱ "오류 글자는 출력에 실리지 않는다" 통과 |
| 송신 0 | 유지 | 새 도구 · 리디렉션 0 |
| Trojan Source 0 | 유지 | 독립 바이트 검사(레포 밖 스크립트): 두 파일 BOM · CR · 형식(Cf) · 제어 · 줄/문단 구분 문자 0, 따옴표 · 주석 밖 비ASCII 0. 219 · 221은 순수 ASCII |
| 엔드포인트 고정 | 유지 | 7행 `AWS_IGNORE_CONFIGURED_ENDPOINT_URLS=true` 그대로, shim 2차 방어 그대로 |

- **문서 대조**[확인: AWS CloudTrail API Reference `AdvancedFieldSelector` · `GetTrailStatus`, 2026-10-20 조회]: 연산자는 Field 외 6개(Equals · StartsWith · EndsWith · NotEquals · NotStartsWith · NotEndsWith)뿐이라 221의 다섯 개 목록은 빠짐이 없다. 그리고 "Equals는 `readOnly` · `eventCategory` · `resources.type`에 쓸 수 있는 유일한 연산자"라서 221의 다른 연산자 분기는 정상 출력에서는 나오지 않는 방어 코드다. 각 연산자 배열은 최소 1개라 빈 배열을 '없음'으로 보는 처리도 정상 출력과 어긋나지 않는다. `LatestDeliveryError`는 String이고, 오류가 없을 때의 값은 문서에 없다 → 회복 뒤에도 남는지 · 빈 문자열이 오는지는 [미확인] → PM V1(§11 ★).
- **jq 1.6**: 쓰인 구문(`//` · `tostring` · `length` · `if-then-else-end` · `map` · `select` · 배열 자르기)은 모두 1.5부터 있다. 실제 1.6 실행은 이 맥과 로컬 이미지 6종(오프라인 · 읽기 전용으로 확인)에 jq 1.6이 없어 여전히 PM V1이다.
- **강화 후보(v1.0.x, 비차단)**: 221을 "알려진 다섯 연산자"가 아니라 "`Field` · `Equals` 밖의 비어 있지 않은 키가 하나라도 있으면 `[]`"로 바꾸면 AWS가 연산자를 새로 더해도 자동으로 해석 불가가 된다. 지금 API 문서 기준으로 빠진 연산자가 없고, 바꾸면 QA가 실브라우저로 확인한 내려받기 해시(6경우)를 다시 봐야 하므로 이번에는 바꾸지 않는다. 첫 공개 뒤에 바꾸면 `CC_VERSION`을 올린다.
- `RELEASES.json`의 AWS v1.0.0 `date`는 `--reset`이 원래 항목의 날짜를 지키므로 `2026-10-19`로 남는다(바이트는 10-20 것). 공개 전 개발용 재작성이라 그대로 둔다(정보).

---

## 8. 고친 파일

### 8-1. STEP 4 마무리(백엔드팀장, 2026-10-19)

| 파일 | 변경 |
|---|---|
| `collector/cloudcheck-aws.sh` | 엔드포인트 고정(`AWS_IGNORE_CONFIGURED_ENDPOINT_URLS=true`) + 주석 1줄(256 → 257줄) |
| `collector/cloudcheck-azure.sh` | `az --version` → `az version -o json --only-show-errors` + 주석 1줄(192 → 193줄), 도구 버전 표기 `azure-cli/<버전>` |
| `collector/SHA256SUMS` · `RELEASES.json` | `make-release.mjs --reset`: AWS `f223a0530345ebe4e52662cec5d3f056083e98e4528387da60b665818f24480f`, Azure `8bc7bd2ff9df9d5c20a30d841c2b3051d93f06bb6eec5d6e41356b3151462f8d` |
| `collector/release.test.ts` | 못 박은 이력 해시 갱신 + 재작성 근거(첫 공개 전) 주석 |
| `collector/lint.ts` | export 허용 목록에 고정 변수, L-11 `endpoint-guard`(값·위치 강제), 래퍼 밖 로컬 버전 조회 정확한 인자열만(`az --version` 거부) |
| `collector/lint.test.ts` | 로컬 버전 제외 비교, '린터의 린터' 샘플 3개 추가, `-o json` 샘플이 호출 줄을 겨냥하게 수정 |
| `collector/__shims__/cli.sh` | `az version` 응답, 엔드포인트 고정이 없으면 aws 응답 거부(2차 방어) |
| `collector/testcommon.ts` | 로컬 버전 조회를 실제 호출에서 제외 |
| `collector/collector.aws.test.ts` · `collector.azure.test.ts` | 엔드포인트 무력화·대조군, `az --version` 미사용 시험, 도구 버전 기대값 |
| `contract/NORMALIZED.md` | §6 승인 표기, 보고서 키 슬롯 정정, `not_supported` 결정, parse 보강 기록 |
| `parse/normalize-aws.ts` · `parse/normalize.aws.test.ts` | 빈 활성 리전 목록 → `scope-unproven` + 테스트 |
| `parse/leak-scan.test.ts` | 누출 스캔 범위에 rules·engine·model 추가 |
| `engine/source-scan.test.ts` | contract·parse 결정성 가드 추가 |
| `rules/azure/az-sto-2.ts` | null·모르는 `publicAccess` → 확인 불가 |
| `rules/azure/az-log-2.ts` | `audit` 그룹 → 확인 불가 |
| `rules/aws/aws-key-4.ts` | 와일드카드 액션 glob 판정 |
| `rules/micro-expectations.test.ts` | AZ-LOG-2 audit 기대 변경, 새 micro 2건 기대 |
| `fixtures/micro/azure-cases.ts` · `aws-iam-cases.ts` · `index.ts` | 비공개 컨테이너 `"None"`, `access-unreadable`·`wildcard-action` 추가 |
| `fixtures/companies/worlds-azure.ts` + `azure-{A..D}.json` | 비공개 컨테이너 `"None"`(13곳), 생성기로 재생성(AWS·CSV 무변화) |
| `fixtures/answers.test.ts` | G3 "tolerate 0건" 가드 |

문구(`rules/i18n/**`)와 `model/**`, `src/app/**`는 고치지 않았다.

### 8-2. STEP 5 QA 수정 2라운드(API설계자 · DB설계자, 2026-10-20) — 요지

근거: `docs/qa/cloudcheck-bug-report.md` §R(23건 수정 · 검증), `docs/planning/cloudcheck-qa-decisions.md`(D-1~D-4 · N1 · N2), `contract/NORMALIZED.md` §6~8.

| 영역 | 바뀐 것 | 관련 |
|---|---|---|
| 수집기(AWS) | 고급 선택기 투영(Equals 밖 연산자 → `equals: []`) · `hasDeliveryError` 빈 문자열 방어 · 해시 2회 재작성(§7-6) | CC-QA-07② · D-2 |
| 계약 | `FamilyCoverage.memberKeys?` · `InputFacts.asOfRejected?` · `InputFacts.latestEvidence?` · 새 `contract/clean-text.ts` · 모델 `Banner` `as-of-before-evidence` | CC-QA-01 · 02 · 09 · 15 |
| parse | 기준 시각 2000-01-01 이전 버림 · `latestEvidence` · 열거 목록 중복 = 섹션 무효 · 활동 로그 패밀리 구독 신원 봉인 · 보고서 CSV 다른 계정 행 · 같은 열 두 번 = 모호 · Azure 요청 구독 누락 = 미완결 · 예외 사유 비밀 가림 · 키 파일 거부 확장(토큰 JSON · 표준 SAS) · 비밀 개수 = 서로 다른 비밀 값 · N1 동률 = 원본 바이트 SHA-256(새 `parse/digest.ts`, 순수 동기 구현) · 마스킹이 넓은 대역(≤ /8 · ≤ /16)과 서비스 태그를 보존(+ `mask-rejudge.test.ts`) · `leak-scan`이 넓은 대역을 건너뜀 | CC-QA-01 · 02 · 10 · 11 · 12 · 15 · 18 · 19 · N1 · D-1 · D-3 · D-4 |
| engine · rules | 나이 역전 → `stale-evidence` · 새 `rules/sources.ts`(출발지 주소 범위 해석: 합집합 = 전체 · 넓은 공인 대역 · 프리픽스 리스트 · 서비스 태그 · ASG 제외 · 출발지 없음 = 해석 불가) · KEY-4 Effect · ExternalId 연산자 · LOG-1 선택기 · 전송 오류 · ENI 잘림 · 버킷 MatchKey 위치 `-` 고정 · aggregate 신원 집합 대조(`ScopeProof.memberKeys` · `ResourceDesc.familyKey`) · `buildScope` 구독 누락 · 직접 볼 목록 '보지 못한 나머지 대상' · 새 알림 | CC-QA-01 · 03 · 04 · 05 · 06 · 07 · 08 · 13 · 14 · 16 · 17 |
| 정답지 | 변경은 `fixtures/answers/D.azure.json` 1개(10-20 01:53, 1라운드 중 — API설계자 보고서는 '정답지를 건드리지 않음'). 백엔드팀장이 회사 정의(`worlds-azure.ts AZURE_D`)에서 다시 도출해 내용이 맞음을 확인했다(§10 · 리뷰 문서 F-3). `notes`에 그날 변경 기록이 없다 | G3 |

### 8-3. STEP 6(백엔드팀장, 2026-10-20)

| 파일 | 변경 |
|---|---|
| `rules/aws/aws-net-1.ts` | **CC-QA-24**: `isProtocolNumber`(`/^(0\|[1-9]\d{0,2})$/` + ≤ 255) — 6 · 17 밖의 정규 번호만 '포트 없음'으로 건너뛰고, 범위 밖 · 앞자리 0 · 부호는 해석 불가. 머리 주석에 규칙 추가 |
| `fixtures/micro/aws-net.ts` · `fixtures/micro/index.ts` | micro 8개: `protocol-number-256` · `-999` · `protocol-leading-zero`(→ 확인 불가), `protocol-number-0` · `-255` · `-esp`(→ 이상 없음, 경계 · 대조), `protocol-number-tcp`(→ 위험), `protocol-out-of-range-plus-risk`(모르는 번호 규칙 + 같은 그룹 3389 → 위험 유지, INV-4) |
| `rules/micro-expectations.test.ts` | 위 8개 기대값(명세를 읽고 먼저 씀) |
| `qa/known-low.test.ts` | CC-QA-24 `it.fails` 1개 → `it`(허용된 유일한 qa 변경. 제목의 "지금은 …" 문구는 QA 규칙대로 QA실행자가 "수정 전: …"으로 바꾼다) |
| `parse/mask.test.ts` | 사설·예약 대역 경계 주소 대조 시험 1개(§6-4) |
| `parse/identity.test.ts` | 회사 8곳 JSON + 보고서 CSV 4개: parse가 만든 완결 패밀리 95개가 모두 `memberKeys`(크기 = 모수)를 싣는지 12개 시험 — 엔진의 '신원 집합이 없으면 개수만 대조' 느슨한 길이 실제 입력 경로에서 쓰이지 않음을 고정 |
| `rules/params.ts` · `parse/mask.ts` | 주석만(§6-4 결정 · 시험 위치) |

변이 확인: CC-QA-24 수정을 되돌리면 7개 시험(QA 1 + micro 6)이 실패하고, `keepIpv4`에서 대역 하나를 빼면 대조 시험이 실패한다(둘 다 원복 · 해시 확인).

---

## 9. 테스트 요약

### 9-1. STEP 6 최종(2026-10-20 04:3x, 백엔드팀장 직접 실행)

| 검사 | 결과 |
|---|---|
| `npm run type-check` | exit 0 |
| `npx vitest run src/lib/cloudcheck` | **92파일 · 3,353 통과 · todo 1 · 실패 0**(STEP 6 전 같은 범위 3,316 → micro 24 + memberKeys 12 + 마스킹 대조 1 = +37) |
| 그중 `src/lib/cloudcheck/qa` | 32파일 · 451 통과 · todo 1(CC-QA-01 B 잔여) · **`it.fails` 0** |
| `npx vitest run src/app/cloudcheck/_build/guards.test.ts` | 147 통과 |
| `src/app/cloudcheck` 전체 | 40파일 · 822 통과 · 실패 1 = `generated.test.ts` 동기("커밋된 `_generated/page.ts` = 지금 소스로 만든 결과") — lib을 바꿨으므로 예상. 메인 세션이 재생성하면 초록(수집기 바이트는 그대로라 해시 · 내려받기 시험은 이미 초록) |
| 수집기 | 3줄 diff 검토 · jq 1.7.1 손 시험(219 · 221, 이상한 모양 포함) · 독립 바이트 검사 · `collector.aws.test.ts` ⑰ ⑱ 포함 전부 통과 |
| 레포 전체 `npx vitest run` | 이번에는 돌리지 않았다(바뀐 것이 cloudcheck lib · 그 시험뿐). 배포 게이트(STEP 7)에서 재생성 뒤 돌린다 |

### 9-2. STEP 4 마무리(2026-10-19 22:18 기준 — 기록)

| 검사 | 결과 |
|---|---|
| `npm run type-check` | exit 0. (동시에 돌던 프론트 빌드가 `.next/types`를 지우는 순간에 한 번 TS6053이 났고, `.next/types`를 뺀 같은 범위 검사도 0건으로 확인) |
| `npx vitest run src/lib/cloudcheck` | **42파일 · 1,988개 통과**(마무리 전 1,972개 → 이번에 16개 추가) |
| `npx vitest run src/app/cloudcheck/_build/guards.test.ts` | **147개 통과**(lib 관련 실패 0, RELEASES.json 예외는 이미 허용됨) |
| `src/app/cloudcheck/_build/generated.test.ts` | 45개 중 동기 1건 실패 — 재생성 필요(프론트팀장, 정상) |
| 수집기 | 린터 408개(L-01~L-14 + 샘플), AWS shim 16 시나리오 + 옵션, Azure 8 시나리오 + 옵션, 해시·릴리스, bash 3.2 `-n` |

---

## 10. 알려진 한계·남은 위험

| 구분 | 내용 | 대응 |
|---|---|---|
| 실행 환경 | jq 1.6 실제 실행 0회(이 맥은 1.7.1, 린터 `checkJq`로만 강제), bash 5.x는 `-n`만, 대화형 TTY 경로 미시험, 실제 aws·az 출력 모양은 문서 기준 모사 | PM V1(§11) |
| 실행 시간 | Azure 예산 상한 4,102회 호출 — az 1회 실행 지연이 1초대면 1시간을 넘을 수 있다 [일반 지식] | PM V1 실측 뒤 예산 하향(구독당 계정 100 → 30 안팎) 또는 `--doors` 분할 안내 |
| Azure 출력 모양 | `container-rm list`의 `publicAccess` 위치(최상위인지), 진단 설정 `value` 래퍼, keyCreationTime 유무 | 모양이 다르면 이제 확인 불가로 떨어진다(이상 없음 아님). PM V1 |
| AZ-LOG-1·2 범주 그룹 | `audit` 구성, 구독 진단 설정의 그룹 지원 여부 | 확인 불가 처리. PM V1 뒤 확정 |
| Azure 수집기 보안 결정 | `AZURE_CLI_DISABLE_CONNECTION_VERIFICATION` 무력화, `AzureCloud` 외 중단 여부 | Azure 베타 전 결정(둘 다 0줄 변경 가능) |
| 신뢰 정책 모양 | `Statement`가 배열이 아닌 단일 객체면 그 역할은 확인 불가(수집기가 null로 둠) | fail-closed. PM V1에서 분포 확인 |
| 이름이 `-`로 시작하는 IAM 사용자·그룹 | CLI 인자 파싱 실패 → 그 대상 확인 불가 | fail-closed. `--user-name="$u"` 형식은 v1.0.x 후보(린터·shim 함께 수정) |
| AWS CLI 사용자 설정 | `cli_auto_prompt = on`이면 호출이 실패할 수 있음 | 확인 불가로 떨어짐. PM V1 |
| az 자동 업그레이드 | 사용자가 `auto-upgrade.enable`을 켠 경우 명령 뒤 업그레이드가 돌 수 있음(설정 이름에 `-`가 있어 환경변수로 끌 수 없음) | 기본 꺼짐. 안내 문구 후보 |
| maskedCopy | 다시 불러올 수 없는 가명 사본(설계) | 골든 파일은 형태 스냅샷 기본 |
| 해시 신뢰 | 레포 안 3중 일치는 배포 계정 탈취를 못 막는다 | 2FA, PDF 해시 수동 대조(G9) |
| 고급 이벤트 선택기 | ~~Equals만 투영~~ → **STEP 5에 해소**(CC-QA-07②: 다른 연산자가 섞이면 `equals: []` → 룰은 해석 불가). 문서로도 두 필드는 Equals만 허용[확인, §7-6] | 새 연산자 자동 대응은 v1.0.x 강화 후보(§7-6) |
| (STEP 6) CloudTrail 전송 오류 | `LatestDeliveryError`가 회복 뒤에도 남는지 · 빈 문자열이 오는지 [미확인] | 남는다면 D-2 주의가 회복 뒤에도 뜬다(안전한 방향) → PM V1 ★ 뒤 문구 조정(결정 §10) |
| (STEP 6) AWS-KEY-4 ExternalId 값 | 수집기는 조건 키(`연산자:키`)만 싣고 값은 싣지 않는다(ExternalId는 준비밀값). `StringLike`에 `*` 같은 와일드카드 값이면 보호가 없는데도 이상 없음이 될 수 있다. 이상 없음 문장("ExternalId 조건 없이 믿는 역할이 없음")은 글자 그대로는 참이지만 '못 보는 것'에 값 미확인이 없다 | G8 전: 디자인팀장 · DB설계자가 `cannot` 한 줄("ExternalId 조건의 값 — 와일드카드 값처럼 실제로 막지 않는 조건은 구분하지 못함")을 더할지 결정. v1.1: 수집기가 'StringLike 값에 `*` · `?` 포함' 불리언만 투영(계약 추가) |
| (STEP 6) 마스킹 사본의 깨진 주소 | 옥텟이 255를 넘는 IPv4 모양 값(`1.2.3.300/32` · `52.300.0.0/16`)을 가명 사본이 **유효한** 문서용 주소로 바꾼다 → 원본은 확인 불가인데 사본을 다시 판정하면 이상 없음(프로브로 확인). 느슨한 IPv6 모양(`2600:::1/64`)도 같은 종류. 사용자 리포트에는 영향 없음(사본은 다시 불러올 수 없음, 정상 출력에 없는 P3 값) | API설계자 v1.0.x: 유효한 주소만 가명으로 바꾸고, 깨진 모양은 '깨진 채로' 가명 처리(원래 숫자를 남기지 않으면서 해석 불가가 유지되는 값 — 그대로 두면 오타 난 실제 주소 앞자리가 샐 수 있어 그대로 두지는 않는다) + `mask-rejudge` 사례 |
| (STEP 6) 정답지 변경 기록 | `D.azure.json`이 STEP 5 1라운드(10-20 01:53)에 바뀌었는데 `notes`에 기록이 없고, QA 리포트 G3 행은 "정답지 변경 0"이라고 적었다. 내용은 맞다(§8-2) | DB설계자가 `notes`에 그날 바뀐 칸과 근거(명세 · 결정) 한 줄, QA실행자가 G3 문구 정정 — G8 전 |
| (STEP 6) 순수 SHA-256 비용 | `parse/digest.ts`는 이 맥에서 약 5.7 ms/MiB(최대 입력 25 MiB ≈ 145 ms). 저사양 모바일은 몇 배 | 허용. 큰 파일에서 '읽는 중' 표시가 이미 있으면 충분 |

---

## 11. PM V1 실측 체크리스트(방향서 §11-2 + 이번 추가분 ★)

검증 순서: V1 빈·학습 계정 → V2 비프로덕션 → V3(선택) 프로덕션 읽기 전용. 실제 노출을 만들지 않는다(결함 심기는 '무장은 됐지만 연결 안 된' 형태).

> **STEP 6 갱신**: PM V1은 **새 수집기 릴리스로** 돌린다 — AWS `5547c91e7f8a4b152c8693eca25ca33d68a886f70247ef9a91599c1dd1c3b988`(26,671바이트, 257줄), Azure `8bc7bd2ff9df9d5c20a30d841c2b3051d93f06bb6eec5d6e41356b3151462f8d`(그대로). 예전 해시 `f223a053…` · `25ff8e8f…` 파일로 돌린 결과는 쓰지 않는다(리포트에 `collector-unknown-release`가 뜬다). 새 항목은 ★(STEP 6).

**AWS**
1. CloudShell 업로드·다운로드, 결과 파일 권한 600, `sha256sum` 결과 = 페이지 해시(`5547c91e…`).
2. ★ `bash --version` · `jq --version`(**1.6인지**) · `aws --version`(**2.13 이상인지**: 엔드포인트 무시 설정 지원) 기록.
3. ★ jq 1.6이면 결과 파일의 영수증에 `transform-failed`·`output-not-json`이 0건인지(특히 자격증명 보고서 `@base64d`, 신원 `capture`, list-roles 투영).
4. 수집기 2회 실행(SecurityAudit 역할 / 본인 권한): 걸린 시간, 호출 수(= 영수증 수), 거부된 호출.
5. ★ 대화형 경로: 계정 확인 Enter, 확인 단계에서 Ctrl+C 시 결과·임시 파일이 남지 않는지, 마지막 "Enter = 삭제" 동작.
6. ★ 셸에 `export AWS_ENDPOINT_URL=http://127.0.0.1:9` 를 걸고 실행해도 정상 수집되는지(무력화 실측).
7. 자격증명 보고서 CSV: 열 목록(특히 `additional_credentials_info`), ★ 루트 행 `password_enabled` 실제 값(`not_supported`/TRUE/FALSE), ★ 비활성 키의 `access_key_N_last_rotated`가 N/A인지 날짜인지, 콘솔 CSV 파일 이름에 시각이 있는지.
8. 거부 오류 문구 1건(`An error occurred (AccessDenied)` 형식)과 종료 코드.
9. ★ notconfigured 코드 실측: `NoSuchPublicAccessBlockConfiguration`(계정·버킷), `NoSuchBucketPolicy`(get-bucket-policy-status), `NoSuchWebsiteConfiguration`, `OwnershipControlsNotFoundError`(2023-04 이전 버킷이 있으면).
10. ★ `list-buckets` 응답의 `BucketRegion` 유무, 남은 `ContinuationToken` 여부.
11. ★ `describe-trails`가 조직 trail·다른 리전 단일 trail을 어떻게 보이는지, 멤버 계정에서 조직 trail `get-trail-status`가 되는지.
12. CloudTrail 이벤트 기록(읽기 전용 필터 해제)으로 발자국 대조: 이벤트 이름(ListBuckets 등), `GenerateCredentialReport`가 읽기·쓰기 중 무엇으로 기록되는지.
13. 정답지 대조(V1 결함 심기): 오탐·확인 불가 사유를 기록. ★ 신뢰 정책이 단일 객체인 역할·이름이 `-`로 시작하는 사용자가 있으면 결과.
14. Organizations 소속 여부. 마스킹 골든 파일은 형태 스냅샷 기본(값이 필요하면 누출 스캔 → QA설계자·백엔드팀장 2인 승인 → PM).
15. ★(STEP 6 · D-2) 정상 trail의 `aws cloudtrail get-trail-status` 원문에 `LatestDeliveryError` 키가 **없는지**(또는 빈 문자열인지) 기록 → 결과 파일 `hasDeliveryError: false`. V1 빈 계정에서만: 결함 심기로 trail 대상 버킷 정책을 CloudTrail 쓰기를 막도록 바꿔 오류를 만든 뒤 → `true`·AWS-LOG-1 주의(`trail-delivery-error`) 확인 → 버킷 정책을 되돌리고 다시 실행해 **오류 기록이 언제 사라지는지**(사라지지 않으면 결정 §10대로 문구 조정). 오류 글자가 결과 파일에 없는지도 본다.
16. ★(STEP 6 · CC-QA-07②) 고급 이벤트 선택기를 쓰는 trail이 있으면(없으면 V1 빈 계정에 관리 이벤트 · `readOnly` Equals `false` 선택기로 하나 만든다) 결과 파일 `selectors.advanced`가 `[{fields:[{field:"eventCategory",equals:["Management"]},{field:"readOnly",equals:["false"]}]}]` 모양인지, AWS-LOG-1 판정이 콘솔 설정과 맞는지.
17. ★(STEP 6 · CC-QA-24) 보안 그룹 규칙의 `IpProtocol` 실제 값이 `tcp`·`udp`·`icmp`·`icmpv6`·`-1`·정규 숫자(예: `50`)뿐인지, 숫자 `6`·`17`로 만든 규칙을 `describe-security-groups`가 `tcp`·`udp`로 돌려주는지(어느 쪽이든 판정은 같다 — 기록만).

**Azure**
1. Cloud Shell(임시 세션 포함) 업로드·다운로드, 해시(`8bc7bd2f…`).
2. ★ `az version` 출력에 `"azure-cli"` 키가 있는지(도구 버전 기록), `bash`·`jq` 버전.
3. 구독 **Reader만으로** storage account list · container-rm list · nsg/nic/public-ip list · diagnostic-settings list · subscription diagnostic-settings list가 되는지.
4. ★ `az storage container-rm list` 출력에서 `publicAccess`가 **최상위 키**이고 비공개가 `"None"`인지(아니면 AZ-STO-2가 전부 확인 불가가 된다).
5. 진단 설정 출력 형태(`value` 래퍼 여부), ★ `categoryGroup` 표기, ★ 구독 활동 로그 진단 설정이 범주 그룹을 지원하는지.
6. ★ Blob 진단 설정에서 `audit` 그룹만 고르면 StorageRead·StorageWrite·StorageDelete 중 무엇이 기록되는지(AZ-LOG-2 확정 근거).
7. `az account list --all`/`--refresh` 필요 여부, 비활성·다른 테넌트 구독 표시. ★ keyCreationTime이 null인 계정 비율.
8. 거부 오류 문구 1건(`Code:`/`ERROR: (…)` 형식), 종료 코드.
9. ★ 실행 시간: az 1회 실행 지연과 전체 소요 → 예산(구독 20 × 계정 100) 조정.
10. Resource Graph 쿼리 2개의 CSV 열 구성·행 한도. Entra 라이선스·'사용자 등록 세부 정보' CSV(AZ-MFA-1 편입 판단).
11. ★ `az cloud show --query name`(AzureCloud), 셸에 TLS 검증 해제 변수가 없는지 → Azure 베타 전 결정(§10)의 근거.

**공통**: GitHub·Vercel 2FA, G9에서 PDF에 정식 주소·저장소·수집기 전체 해시 인쇄.

---

## 12. 넘길 것

### 12-0. STEP 6 → 메인 세션 · STEP 7 (최신)

| 받는 쪽 | 할 일 | 시점 |
|---|---|---|
| 메인 세션 | `_generated/page.ts` 재생성(`node src/app/cloudcheck/_build/generate.mjs`) → `generated.test.ts` 48개 초록 확인. 수집기 바이트는 그대로라 내려받기 해시(`5547c91e…`)는 바뀌지 않는다. 바뀌는 것은 엔진 번들(AWS-NET-1)과 주석 | 배포 게이트 전 필수 |
| 배포엔지니어(STEP 7) | 로컬 게이트에 레포 전체 `npx vitest run`(재생성 뒤) 포함. 라이브 LV에서 `/cloudcheck/download`의 수집기 sha256 = `SHA256SUMS`(AWS `5547c91e…` · Azure `8bc7bd2f…`) 확인. 첫 push 뒤부터 수집기 · 룰을 고치면 `CC_VERSION` · `RULESET_VERSION`을 올리고 `--reset` 금지 | STEP 7 |
| QA실행자 | `qa/known-low.test.ts` CC-QA-24 제목의 "지금은 건너뛰어 이상 없음" → "수정 전: …"(QA 규칙). 버그 리포트 CC-QA-24 상태 '수정·검증됨', G3 행 "정답지 변경 0" 문구 정정(§10) | G8 전 |
| DB설계자 | `fixtures/answers/D.azure.json` `notes`에 10-20 변경 기록 한 줄(바뀐 칸 · 근거) | G8 전 |
| API설계자 | 마스킹 사본의 깨진 주소 처리(§10 · 리뷰 F-2) · 수집기 고급 선택기 강화 후보(§7-6, v1.0.x — 첫 공개 뒤면 버전 올림) | v1.0.x |
| 디자인팀장 + DB설계자 | AWS-KEY-4 `cannot`에 'ExternalId 조건의 값은 보지 않음' 한 줄을 더할지 결정(§10 · 리뷰 F-1) — 문구 키 · copy-review · 제목×상태 시험이 함께 바뀐다 | G8 전 권장 |
| PM | V1을 새 수집기 릴리스로(§11 · ★15~17 포함) | G8 |

### 12-1. STEP 4 기록 — 프론트팀장
1. **`_generated/page.ts` 재생성**: `node src/app/cloudcheck/_build/generate.mjs` — 수집기 원문·해시(AWS `f223a053…`, Azure `8bc7bd2f…`), 체험 데이터(Azure 회사 4개 파일), 엔진·룰·parse 번들 변경 반영. 재생성 뒤 `generated.test.ts` 초록 확인(배포 게이트 필수).
2. 수집기 해시 표시·다운로드 바이트는 생성기가 맞춘다(`release.test`의 3중 일치는 lib 쪽에서 통과).
3. 화면은 도구 버전 문자열에 기대지 않으므로 `azure-cli/<버전>` 표기 변경의 영향은 없다(grep 0건).
4. 디자인팀장과 결정할 문구 후보(키 추가는 `_client/i18n` 소관): ① 수집기 설명에 "로컬 버전 조회 1건(네트워크 없음)은 발자국 표에 넣지 않습니다", ② "수집기는 셸의 프록시·인증서 설정을 평소 aws·az 명령처럼 따릅니다. 엔드포인트 지정 설정은 무시합니다(AWS)".
5. 페이지의 수집기 원문 보기에 구간 접기 + 줄 바꿈(최장 약 1,170자 jq 줄 4개).

### 12-2. STEP 4 기록 — QA(STEP 5)
1. G1: 새 micro 2건(`AZ-STO-2/access-unreadable`, `AWS-KEY-4/wildcard-action`)과 기대 변경(`AZ-LOG-2/audit-group` clear → unknown)을 변이·속성 테스트에 포함.
2. G6 추가 사례: `publicAccess` null·모르는 값(`"Private"` 등), 신뢰 정책 액션 패턴(`sts:Assume*`, `sts:AssumeRole?ithSAML`, `*`, `STS:ASSUMEROLE`), 빈 활성 리전 목록, 단일 객체 `Statement`.
3. G4: L-11 `endpoint-guard`, 로컬 버전 조회 규칙, shim 2차 방어(`endpoint-guard-missing`). jq 1.6·bash 5.x 실제 실행은 컨테이너가 있으면 QA, 없으면 PM V1.
4. G3: 정답지 100% + tolerate 0 가드. 정답지 리뷰 때 Azure 회사의 비공개 컨테이너가 `"None"`으로 바뀐 것을 확인(상태·사유 변화 없음).
5. 이번에 전수로 본 '이상 없음' 지점 18곳 외에 '해당 없음(제외)' 경로도 같은 관점(읽지 못한 값이 제외가 되는지)으로 한 번 더 본다.

### 12-3. STEP 4 기록 — API설계자·DB설계자(참고)
- 수집기·린터·shim·testcommon, NORMALIZED.md, normalize-aws, leak-scan 테스트(API설계자 영역)와 AZ-STO-2·AZ-LOG-2·AWS-KEY-4, micro·회사 정의, answers·source-scan 테스트(DB설계자 영역)를 고쳤다(§8). 판정 의도는 각 파일 머리 주석에 남겼다.
- 첫 push 뒤에는 수집기를 고치면 반드시 `CC_VERSION`을 올리고 `make-release.mjs`(`--reset` 금지)로 새 항목을 추가한다. 룰 판정 로직을 바꾸면 `RULESET_VERSION`을 올린다.

---

### 근거(STEP 4 · 6 1차 확인)
- AWS SDKs and Tools Reference Guide — Service-specific endpoints(`ignore_configured_endpoint_urls` / `AWS_IGNORE_CONFIGURED_ENDPOINT_URLS`): https://docs.aws.amazon.com/sdkref/latest/guide/feature-ss-endpoints.html
- azure-cli 소스 `src/azure-cli-core/azure/cli/core/util.py`(`get_az_version_string` → `_update_latest_from_ame_storage`, `https://azcliprod.blob.core.windows.net/cli`), `src/azure-cli/azure/cli/__main__.py`(`auto-upgrade.enable` 기본 False): https://github.com/Azure/azure-cli
- IAM 자격증명 보고서 형식(`password_enabled`, `additional_credentials_info`, 4시간 캐시): https://docs.aws.amazon.com/IAM/latest/UserGuide/id_credentials_getting-report.html
- S3 Object Ownership: https://docs.aws.amazon.com/AmazonS3/latest/userguide/about-object-ownership.html
- Azure Monitor 지원 로그(blobServices, 범주 그룹 소속 표기 없음): https://learn.microsoft.com/en-us/azure/azure-monitor/reference/supported-logs/microsoft-storage-storageaccounts-blobservices-logs
- (STEP 6) AWS CloudTrail API Reference — `AdvancedFieldSelector`(연산자 6개, "Equals는 readOnly · eventCategory · resources.type에 쓸 수 있는 유일한 연산자", 연산자 배열 최소 1개): https://docs.aws.amazon.com/awscloudtrail/latest/APIReference/API_AdvancedFieldSelector.html
- (STEP 6) AWS CloudTrail API Reference — `GetTrailStatus`(`LatestDeliveryError`: String, S3 버킷 문제로 로그 파일 전달에 실패했을 때의 S3 오류. 오류가 없을 때의 값은 문서에 없음): https://docs.aws.amazon.com/awscloudtrail/latest/APIReference/API_GetTrailStatus.html
