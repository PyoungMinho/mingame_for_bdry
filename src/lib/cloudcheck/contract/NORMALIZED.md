# NormalizedInput 경계 메모 (`contract/normalized.ts`)

> 2026-10-19 백엔드팀장 확정(D1). 대상: @API설계자(parse — 만든다) ↔ @DB설계자(engine — 먹는다). 코드와 주석이 기준이고, 이 메모는 경계만 적는다.
> 변경: 선택 필드 추가 = 두 담당 합의 + 백엔드팀장 승인 / 이름·의미 변경·삭제 = 백엔드팀장 승인 + `NORMALIZED_MODEL` 메이저 증가.

## 1. 흐름
```
recognize(입력 1개) ─▶ InputRecognition.handle = ParsedHandle (parse 전용 내부 객체, UI·engine은 열지 않음)
buildInput(핸들 여러 개) ─▶ NormalizedInput (리포트 1개분: 병합·문 단위 선택이 끝난 사실 묶음, 깊게 freeze)
judge(input) ─▶ Report        maskedCopy(input) ─▶ 마스킹 사본 JSON
```
UI는 `NormalizedInput`도 열지 않는다. buildInput의 반환값을 보관했다가 judge·maskedCopy에 그대로 넘긴다.
체험 모드도 같은 길로 간다: `recognize({ via: "demo", name: demoInputName(set, cloud) })`. parse가 이름에서 세트를 읽어 `mode`를 정한다.

## 2. parse가 계산한다(사실)
- 영수증 키 `<입력>:<r-id>`, `ReceiptFact.used`, 시각 엄격 파싱 → `Instant`(초 단위 Z 정규형 + ms), Azure ID·GUID 소문자화, 비밀 패턴 제거(`REDACTED_PREFIX`)
- 슬롯 상태 `value·partial·none·missing`: 영수증 result와 값을 보고 null의 뜻을 푼다(`Slot` 주석의 연결 규칙). 값을 읽지 못하면 그 슬롯만 `missing(value-unrecognized)`
- CSV를 같은 모델로 옮김: 자격증명 보고서 행 → root·users·keys, RG CSV → 스토리지 계정·NSG. 위치는 `Src.csv`(행·열)
- 수집기 경로의 사실 우선순위(§4-7): 실시간 호출 > 보고서, 키 슬롯을 last_rotated↔CreateDate로 조인, 키 Status 해석(`active`)
- 병합(§4-8): 계정·클라우드가 다른 입력 제외, runKey 중복 superseded, 문 단위 선택 → `DoorSelection`, `InputFacts.doors`
- `FamilyCoverage`: 열거 완결·모수·빈틈·범위 단위. 반드시 `sealCoverage`로 봉인한다. 문이 선택되지 않은 패밀리도 `notCollectedCoverage`로 채운다
- 배너 재료: `notices`(지운 값 수, 읽지 못한 섹션), `scopeProven`, `knownRelease`, `schema.support`, `asOf.source`, `identity.confirmed`
- 항목 단위 호출의 영수증에는 `resource`를 반드시 채운다(INV-7 재료)

## 3. engine이 판단한다
- 5상태·사유·배너·firstLook·권한 패널·직접 볼 목록·분포·정렬·DisplayValue(정리·마스킹, 정리 전에 `isRedacted` 확인)·MatchKey
- **적용 대상인지**: 콘솔 사용자인가, 활성 키인가, 관리자급 정책인가, 서비스 연결 역할인가, 루트 자격증명이 있는가
- 파라미터가 들어가는 판단: 키 나이 90일, 미사용 45일·유예 7일, 루트 로그인 90일, 보고서 신선도 4시간 5분(`stale-evidence`), 위험 포트
- 교차 확인(루트 행 ↔ accountSummary가 다르면 확인 불가), INV-7(receipts의 call·resource·result로 core가 계산), judgeLevel(kind + scopeProven), 룰별 asOf(보고서 기반 룰은 `credentialReport.generatedAt`)

## 4. 모수와 '제외' (core 규칙)
- `population` = 열거된 구성원 수다. 적용 대상으로 거르지 않는다. engine은 이 값을 만들지도 바꾸지도 못한다(봉인 브랜드 + `normalized.test.ts` 가드: engine/·rules/에서 `sealCoverage`·`notCollectedCoverage` 사용과 `as FamilyCoverage`·`as CoverageTable` 캐스팅 금지)
- 룰은 **아이템 패밀리 1개 + 필요한 패밀리 0개 이상**을 선언한다. `DoorFamilies<cloud, door>`라서 자기 문 패밀리만 고를 수 있다. ScopeProof는 선언한 패밀리가 모두 complete일 때만 나온다
- core는 아이템 패밀리의 구성원마다 결과를 하나씩 요구한다: 위험·주의·이상 없음·확인 불가·**제외**. 제외도 이상 없음처럼 증거(`Src` 1개 이상)가 있어야 하며 Report에는 나오지 않는다
- Report `coverage.population` = 모수 − 제외 = 적용 대상 수. 해당 없음 ⇔ 증명된 열거 + 적용 대상 0(INV-5). 근거 문장 예: "IAM 사용자 4명 중 활성 키 0개" = 모수 4, 적용 0
- INV-3 속성 테스트는 증거를 지워서 이상 없음이 생기지 않는지와 함께 해당 없음·제외가 생기지 않는지도 본다

## 5. 테스트 분담
- **engine 단위 테스트**는 `NormalizedInput`을 직접 만드는 micro 픽스처(`fixtures/micro/**`, `sealCoverage` 사용 가능)로 한다. parse가 없어도 DB설계자가 바로 시작할 수 있다. 출발점은 `normalized.test.ts`의 두 리터럴과 생성기다
- **회사 4×2 정답지(G3)**는 종단 테스트다: 회사 빌더 → 수집기 JSON(+ 짝이 맞는 자격증명 CSV) → `recognize` → `buildInput` → `judge` → 사람이 먼저 쓴 정답지와 대조. `parse/normalize`가 머지된 뒤 통합 단계(D7~D8)에서 파일을 만든다(없는 모듈을 import하면 type-check가 실패한다). 그 전에는 정답지 JSON만 쓰고 QA 리뷰를 받는다
- **회사 빌더**(DB설계자)가 만드는 수집기 JSON이 곧 체험 모드 데이터(데이터 블록)다. `CollectFile` strict 검사를 통과해야 하고, 문서 표본 ID만 쓰고, 금지어 토큰을 넣지 않는다. `collector.sha256 = null`로 두어 knownRelease가 null이 되게 한다(체험에 collector-unknown-release 배너가 뜨지 않게)
- **parse 테스트**는 buildInput 결과에 `normalized.test.ts`의 `checkInvariants`를 그대로 적용한다. 공용 헬퍼(`contract/normalized-invariants.ts`)로 옮길 때는 API설계자가 만들고 백엔드팀장이 확인한다

## 6. parse 구현 메모 (API설계자 · STEP 4) — 경계를 바꾸지 않는 동작 설명
> 2026-10-19 백엔드팀장 STEP 4 검토: §6 승인(정정 1건 — 보고서 키 슬롯). `normalized-invariants.ts`(검사기 승격)·`normalized.test.ts` import 변경 승인. `normalized.ts` 변경 0 확인.
> 같은 날 parse 보강 1건: 활성 리전 목록이 빈 배열이면 net 패밀리는 `scope-unproven`(실제 계정에서 나올 수 없는 모양을 '0개 증명'으로 쓰지 않는다).
- **비밀 패턴(R-12)은 입구에서 한 번에 지운다**(`parse/sanitize.ts`): 받아들인 입력의 모든 문자열(수집기 JSON의 모든 칸, CSV의 모든 칸)이 리포트 단위 Redactor를 거친 복사본만 정규화가 읽는다. 같은 원문 = 같은 토큰이라 조인이 유지된다. `notices.redactions` = 지운 '서로 다른 문자열'의 수(사용자 이름과 그 이름이 든 ARN 칸은 2개). 화면 전에 `isRedacted(s)`를 확인한다
- **슬롯 사유**: `stale-evidence` = 보고서에 없는 사용자·키(보고서가 더 오래됨) / `budget-exceeded` = 호출 예산 밖(보고서에도 없으면 이 사유가 우선) / `not-collected` = 그 문이 수집되지 않았거나 호출하지 않음 / `value-unrecognized` = 값 해석 실패 또는 보고서의 `not_supported`(루트의 password_enabled) / `schema-unsupported` = 섹션 전체가 계약에 어긋남(`notices.sectionIssues`에도 남는다) / 보고서 호출이 실패하면 보고서에서 오는 칸의 사유는 그 호출 결과(`denied`·`error` …)
  - `not_supported`를 `none`으로 바꾸지 않는다(2026-10-19 백엔드팀장 결정): `none`은 '설정·대상 없음'이라는 유효한 답이라 `passwordEnabled`에서는 '비밀번호 없음'으로 읽혀 뜻이 반대가 된다. `missing(value-unrecognized)`로 두고, 루트 행에 한해 '비밀번호 있음'으로 해석하는 일은 AWS-MFA-1(engine)이 한다
- **보고서 키 슬롯(루트·사용자 공통)**: `additional_credentials_info` 열이 있고 그 칸이 비었거나 `N/A`면 슬롯 1·2가 전부라서 `value`, 칸에 값이 있거나 열 자체가 없으면 `partial(field-missing)`이다(3번째 키부터 확인 불가). 수집기 경로에서 루트 키의 있음·없음은 `accountSummary.accountAccessKeysPresent`와 교차 확인하고, 어긋나면 engine이 확인 불가(stale-evidence)로 둔다. 루트 키 개수의 권위 있는 값은 계정 요약이다
  - 2026-10-19 백엔드팀장 정정: 이전 문장 "보고서만으로는 `root.keys`가 항상 `partial`"은 코드(`normalize-aws.ts reportKeys()`)·`normalized.ts` 주석과 달랐다. 코드가 맞다
- **`FamilyCoverage.expected`**: 보고서 = 계정 요약 Users + 루트 1 / 사용자 = 계정 요약 Users(없으면 목록 개수) / 버킷 = 목록 개수(목록을 못 받았으면 null, 0이 아니다). 다른 패밀리는 null
- **Azure**: 리소스 ID·GUID는 소문자. NSG·NIC·공인 IP의 `subscription`은 ID를 쪼개지 않고 그 목록의 구독이다. Azure 수집기는 mfa 문을 수집하지 않으므로 `doors.mfa`는 `skipped`가 아니라 `absent`다(Entra 등록 CSV가 있으면 `selected`). Entra CSV는 테넌트 ID가 없어 단독으로는 리포트를 만들 수 없다(`not-cloudcheck`)
- **CSV 경로는 완결을 만들지 않는다**: Resource Graph·Entra CSV의 항목은 `partial(csv-scope-unproven)`, 해당 패밀리는 `complete=false`(단위 `csv-rows`). 자격증명 보고서 CSV만 `scopeProven`이 될 수 있다(루트 행 + 모호한 행 0 + 필수 열)
- **`maskedCopy`** 는 정규화된 사실의 가명 사본(`cloudcheck.masked/1`)이지 수집 파일이 아니다. 루트 경로(`/`)와 서비스 연결 역할 경로(`/aws-service-role/<서비스>/`)·AWS 소유 정책 ARN·`0.0.0.0/0`·`::/0`·사설 주소·이름 힌트(`public`·`static`·`assets`·`cdn`·`$web`)는 보존한다. STEP 5부터 **넓은 출발지 대역**(IPv4 접두 ≤ /8 · IPv6 접두 ≤ /16 — 룰의 '넓은 공인 대역' 기준과 같은 값, 호스트 비트만 지워 네트워크 주소로 맞춘다)과 **Azure 서비스 태그 이름**(`AzureCloud`·`Storage.KoreaCentral`·`GatewayManager` …)도 보존한다 — 규칙 안 출발지 합집합이 전체를 덮는지, 넓은 공인 대역인지, 서비스 태그인지가 판정 재료라서다. 좁은 공인 CIDR·주소는 접두 길이를 지키며 문서용 주소(TEST-NET)로, 프리픽스 리스트 ID는 가명(`pl-<16진수>`)으로 바뀐다. `mask-rejudge.test.ts`가 사본을 다시 판정해 원본과 같은지 확인한다

## 7. STEP 5 QA 수정으로 더한 계약 필드 (추가만 — 기존 필드의 이름·의미는 그대로)
> 2026-10-20 백엔드팀장 STEP 6 검토: §7 · §8 **승인**. 세 필드 모두 선택 필드라 하위 호환이고 `NORMALIZED_MODEL`(`cloudcheck.normalized/1`) 메이저는 그대로다. `sealCoverage`는 `memberKeys`가 없으면 예전과 같고, 잘못된 집합이면 미완결로 봉인한다(fail-closed). 실제 입력 경로(회사 8곳 JSON + 보고서 CSV 4개)의 완결 패밀리 95개가 모두 `memberKeys`를 싣는지 `parse/identity.test.ts`가 고정한다 — 엔진의 '신원 집합이 없으면 개수만 대조'는 micro 픽스처 호환용으로만 남는다.
- **`FamilyCoverage.memberKeys?: readonly string[]`** (CC-QA-02·15) — 완결(`complete`)인 패밀리가 증명한 모수의 **구성원 신원 집합**. 정렬된 중복 없는 문자열, 크기 = `population`. `sealCoverage`가 강제한다: 중복이 있거나 크기가 `present`와 다르면 `population-mismatch`로 미완결 봉인하고, 미완결이면 싣지 않는다. 싣지 않은 패밀리·예전 픽스처는 속성 자체가 없다(`"memberKeys" in c === false`).
  엔진은 구성원 **수**가 아니라 이 집합으로 룰의 구성원을 대조할 수 있다(개수만 맞는 바꿔치기·복제 방지). 키 규칙(룰이 구성원 `ResourceDesc.id`로 쓰는 값과 같다): `aws.mfa.users`·`aws.key.users` = 사용자 이름 / `aws.key.access-keys` = `<사용자>/<끝 4자리 또는 slotN>`(룰의 keyLabel) / `aws.key.roles` = 역할 이름 / `aws.net.security-groups`·`aws.net.enis` = `<리전>/<ID>` / `aws.sto.buckets` = 버킷 이름 / `aws.log.trails` = trail ARN / `aws.mfa.root` = `root` / `aws.sto.account`·`aws.log.account` = 계정 ID / `aws.*.credential-report` = 보고서 `user` 열(루트는 `<root_account>`) / `azure.*.storage-accounts`·`azure.net.nsgs`·`nics`·`public-ips` = 소문자 리소스 ID / `azure.sto.containers` = `<소문자 계정 ID>/<컨테이너 이름>`(이름이 겹치는 서로 다른 컨테이너는 `~2`, `~3` …) / `azure.log.subscriptions` = 범위 안 구독 ID(소문자). 비밀 모양으로 지운 이름은 지운 토큰 그대로. `maskedCopy`에는 싣지 않는다(원본 이름 목록이므로).
- **`InputFacts.asOfRejected?: { candidate: AsOfFact; why: "early-implausible" }`** (CC-QA-01) — 기준 시각 후보가 2000-01-01보다 이르다(파일 시각 0 = 1970, FAT·ZIP 1980 …)는 이유로 버려져 `asOf`가 `null`이 된 입력의 기록. 그 밖은 생략.
- **`InputFacts.latestEvidence?: Instant | null`** (CC-QA-01) — 입력 데이터 안의 가장 늦은 증거 시각(보고서 CSV의 생성·회전·마지막 사용(미래 날짜인 `password_next_rotation` 제외) / RG 저장소 CSV·Azure 수집기의 키 생성 시각). AWS 수집기 JSON은 서버 시각(보고서 생성 시각)이 기준이라 계산하지 않고 생략한다. `latestEvidence.ms > asOf.at.ms + 5분`이면 기준 시각이 증거보다 이른 것이다. **`asOf`를 이 값으로 끌어올리지 않는다**(끌어올리면 마지막 사용이 '방금'으로 보여 역전이 가려진다) — 역전을 확인 불가로 만드는 일은 룰(`rules/kit` `ageMs`·`reversedIn`)이 한다.
- **정리기 정본**: `contract/clean-text.ts`(`cleanText`·`hasLoneSurrogate`·`stripLoneSurrogates`·`BIDI_RANGES`·`INVISIBLE_RANGES`) — 입력 인식(`parse/display.ts`)과 리포트(`engine/display.ts`)가 같은 함수를 쓴다(엔진은 parse를 가져올 수 없어 contract에 둔다). `Default_Ignorable_Code_Point` 전부 + Cf 일부 + C0·C1·줄/문단 구분을 U+FFFD로 바꾸고 플래그한다.
- 파서 동작 변경(경계 불변): 비밀 값 개수(`notices.redactions`)는 **지운 서로 다른 비밀 값**의 수(같은 비밀이 이름 칸과 ARN 칸에 나와도 1개) / 열거 목록의 중복 대상은 섹션 무효 / 자격증명 보고서의 다른 계정 행은 모호한 행 / 같은 열 이름 두 번은 출처 모호(`csv-row-ambiguous` + `sectionIssues`) / Azure `subscriptionsRequested` 중 목록에 보이지 않는 구독은 `not-queried(subscription-missing)` 단위 / 범위 밖 구독의 항목이 섞인 섹션은 무효 / 활동 로그 패밀리(`azure.log.subscriptions`)는 범위 안 구독마다 내보내기 목록 **항목이 있는지**(신원)로 봉인(목록을 못 읽은 구독도 모수에는 남고 그 구성원만 확인 불가 — INV-7) / 예외 파일 사유의 비밀 모양은 읽는 단계에서 지운 토큰으로.

## 8. STEP 5 2라운드 — 판정의 순서 무관(N1) · 수집기 전송 오류 투영(D-2) · 마스킹 보존 (경계 불변)
- **입력 순서와 무관한 판정(N1)**: `buildInput`은 동률을 입력 위치가 아니라 **내용**으로 깬다. 내용 = 인식 단계에서 구한 원본 바이트의 SHA-256(`parse/digest.ts`, `CollectorParsed.digest`·`CsvParsed.digest` — 핸들 안쪽 값이라 계약 필드가 아니다). 작은 지문이 이긴다.
  - 같은 수집 실행(`runKey`) 중복: 지문이 가장 작은 하나만 쓰고 나머지는 `superseded`.
  - 문 단위 선택: 수집기 JSON > CSV, 같은 종류끼리는 기준 시각이 최신인 것, 기준 시각까지 같으면(둘 다 없음 포함) 지문이 작은 것.
  - 신원 출처(`identity.input`): 수집기 JSON 중 최신(같으면 지문이 작은 것), 없으면 CSV 중 최신(같으면 지문이 작은 것).
  - 내용까지 같으면(같은 바이트) 어느 쪽을 골라도 판정이 같으므로 예전 동작(runKey 중복은 먼저 넣은 것, 문 선택은 나중에 넣은 것)을 지킨다.
  - 순서를 따르는 것은 표시 정보뿐이다: `inputs` 목록 순서 · 영수증 ID 접두(`0:` · `1:`) · 문 → 입력 번호 · 신원 출처 입력 번호. 입력 정렬(바이트 정규화)은 하지 않는다. `order.test.ts`가 모든 순서로 넣어 리포트가 같은지(위 표시 정보만 빼고) 확인한다.
  - 비밀 모양으로 지운 값의 토큰 번호(`REDACTED_PREFIX` + 순번, 대상 MatchKey에 들어간다)는 처음 본 순서로 매겨지므로 입력을 넣은 순서가 아니라 내용 순서(지문)로 청소해 번호도 순서와 무관하다.
- **수집기 `hasDeliveryError`(D-2)**: `get-trail-status`의 `LatestDeliveryError`가 **비어 있지 않은 값**이면 참이다(키 없음 · `null` · 빈 문자열 = 거짓). 오류 글자 자체는 싣지 않는다(버킷 이름 등이 들어 있을 수 있다). 계약(`collect-schema.ts`)은 그대로 `hasDeliveryError: boolean`이다.
- **마스킹 보존**: 위 §6 `maskedCopy` 항목 참고.
