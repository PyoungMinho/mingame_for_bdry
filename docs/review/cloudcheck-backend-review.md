# 「문단속 5」(cloudcheck) — 백엔드 최종 리뷰 (STEP 6)

> 검수자: @백엔드팀장(Opus) · 2026-10-20 04시대
> 범위: STEP 4 승인 뒤 QA 수정 2라운드에서 바뀐 백엔드 전부(수집기 · 계약 · parse · engine · rules · fixtures)와 남은 버그 CC-QA-24
> 방법: 승인본과 지금 수집기의 바이트 diff, jq 손 시험, 독립 바이트 검사, 레포 밖 프로브 3개(신원 집합 · 깨진 주소 마스킹 · SHA-256 비용), 스위트 직접 실행, 시험 변이 확인 2회
> 기준: 방향서 · 기획서 · `docs/backend/cloudcheck-lead-review.md` §6(위협 모델) · `docs/planning/cloudcheck-qa-decisions.md`(§6 베타 기준) · `docs/qa/cloudcheck-bug-report.md` §R
> 아키텍처 정본(갱신본): `docs/backend/cloudcheck-backend-final.md` §0-1 · §6-4 · §7-6 · §8-2~3 · §9~12
> 입장: 이 구조를 확정한 당사자지만, 여기서는 QA 판정과 독립적으로 다시 본다.

---

## 0. 판정

| 단계 | 판정 | 근거 |
|---|---|---|
| **A. 베타 배포(AWS · 띠 + noindex)** | **승인** | 백엔드 쪽 베타 차단 0. 결정 §6 보정 1(정상 경로의 근거 없는 이상 없음 · 범위 과장) 기준으로 남은 항목을 다시 봤고 해당 없음(§4 F-1이 가장 가까우며 차단이 아닌 이유를 적었다). 수집기 재검토 승인. 남은 베타 조건은 백엔드 밖(PM 수동 2건 · 메인 세션 재생성) |
| B. G8(PM V1) 착수 | **조건부** | B 묶음의 백엔드 버그는 끝났다(CC-QA-24 이번에 닫음). G8 전에 남은 것: CC-QA-01 AWS JSON 경로 정보 알림(`it.todo`), F-1 고지 문구 결정, F-3 정답지 기록, QA 문구 정리 2건 |
| C. Azure 실제 점검 공개 | **보류(예정대로)** | AZ-NET-1 목적지 좁힘(결정 §8-C) 미구현 · Azure 수집기 보안 결정 2건(TLS 검증 해제 변수 · `AzureCloud` 외 중단) · Azure PM V1 |

**한 줄**: 백엔드 관점 **베타 출시 승인** — fail-closed 4겹(타입 · 봉인 · 증명 객체 · 안전망)이 QA 수정 뒤에도 그대로이고, 바뀐 수집기 3줄은 위협 모델을 하나도 넓히지 않았다.

---

## 1. CC-QA-24 처리 — **수정 · 검증 완료**

| 항목 | 내용 |
|---|---|
| 원인 | `rules/aws/aws-net-1.ts`가 프로토콜 `/^(icmp\|icmpv6\|\d{1,3})$/`를 '포트 없는 프로토콜'로 보고 건너뛰었다 → `"256"` · `"999"` · `"006"` + 0.0.0.0/0 + 22번 규칙이 이상 없음(`sg-closed`) |
| 수정 | `isProtocolNumber(s) = /^(0\|[1-9]\d{0,2})$/.test(s) && Number(s) <= 255`. 순서: `-1` → 전체 포트 / `tcp` · `udp` · `6` · `17` → 포트 구간 / `icmp` · `icmpv6` · 정규 번호 0~255 → 포트 없음(건너뜀) / 그 밖(범위 밖 · 앞자리 0 · 부호 · 소수 · 모르는 이름) → 해석 불가. 해석 불가는 기존 흐름대로 그 그룹에 다른 발견이 없을 때만 확인 불가(`value-unrecognized`)를 만든다(INV-4 유지). Azure(AZ-NET-1)는 이미 닫힌 목록이라 해당 없음 |
| 시험 | micro 8개(명세를 읽고 기대값을 먼저 씀): 256 · 999 · `006` → 확인 불가 / 0 · 255 · 50(ESP) → 이상 없음 / 6 → 위험 / '256 규칙 + 같은 그룹 tcp 3389' → 위험 유지. QA `known-low.test.ts` CC-QA-24 `it.fails` → `it`(허용된 유일한 qa 변경) |
| 변이 확인 | 수정을 옛 정규식으로 되돌리면 7개(QA 1 + micro 6)가 실패 → 원복(sha256 일치) |
| 부작용 | 정답지 8개 · e2e · FO-06 오라클(`oracle-diff`, 오라클은 이미 0~255 규칙) · `mask-rejudge` · 판정 순수성 · 리포트 불변식 전부 초록. 회사 픽스처에는 이 모양이 없어 정답지 변경 0 |
| 남은 일 | QA실행자: 시험 제목의 "지금은 건너뛰어 이상 없음" → "수정 전: …"(QA 소유 문구라 바꾸지 않았다), 버그 리포트 상태 갱신 |

---

## 2. 수집기 보안 재검토 — **승인**(AWS `5547c91e7f8a4b152c8693eca25ca33d68a886f70247ef9a91599c1dd1c3b988`)

### 2-1. 무엇이 바뀌었나

QA 1차가 내려받아 둔 STEP 4 승인본(sha256 `f223a053…` 확인)과 지금 파일을 `diff`했다. **다른 줄은 3줄**이고 줄 수는 257 그대로다(중간본 `25ff8e8f…`는 1라운드 결과로, 2라운드가 대체).

| 줄 | 변경 | 출력에 나가는 것 |
|---|---|---|
| 219 · D-2 | `hasDeliveryError: ((.LatestDeliveryError // null) != null)` → `(((.LatestDeliveryError // "") \| tostring \| length) > 0)` | 불리언 하나 |
| 220 | 마커 주석 문구 | 없음(주석) |
| 221 · CC-QA-07② | 고급 선택기의 `eventCategory` · `readOnly` 필드에 Equals 밖 연산자(5종)가 비어 있지 않게 있으면 `equals: []`, 아니면 Equals 값(≤ 64자) | `field`(두 리터럴) + `equals`(문자열 목록) — 다른 연산자의 값은 싣지 않음 |

### 2-2. 위협 모델 항목별

| 항목 | 판정 | 근거 |
|---|---|---|
| 허용 명령만 | 유지 | 바뀐 것은 jq 투영 문자열뿐. 명령 · 인자 · 호출 카탈로그(`contract/calls.ts`, 10-19 이후 변경 0) 그대로. 린터 L-04 · L-05 · shim 실행 기록 초록 |
| 비밀 반환 0 | 유지 | 새 호출 0 |
| 금지 옵션 0 | 유지 | 옵션 변경 0(L-11 · `FORBIDDEN_FLAGS`) |
| 데이터 평면 0 | 유지 | CloudTrail 관리 API 2개 그대로 |
| 오류 삼키기 0 | 유지 | jq 실패 → `transform-failed` 영수증 + 값 `null`. jq 오류 글자(입력 값이 섞일 수 있음)는 `$TMP/err`에만 남고 결과 · 화면에 나가지 않는다(`"Equals":"false"` 손 시험) |
| 출력 allowlist | 유지 | 219는 불리언, 221은 두 필드 이름 + Equals 값만. 선택기 이름 · `resources.ARN` 등은 지금처럼 버린다 |
| 송신 0 | 유지 | 새 도구 · 리디렉션 0 |
| Trojan Source 0 | 유지 | 독립 바이트 검사(레포 밖 스크립트): 두 파일 BOM · CR · 형식(Cf) · 제어 · U+2028/2029 0, 따옴표 · 주석 밖 비ASCII 0. 219 · 221은 순수 ASCII, 220 주석은 한글 · 가운뎃점만 |
| 엔드포인트 고정 | 유지 | 7행 `AWS_IGNORE_CONFIGURED_ENDPOINT_URLS=true` · shim 2차 방어 그대로 |

### 2-3. 오류 글자(`LatestDeliveryError` 원문)가 출력에 실리는가 — **실리지 않는다**

- 투영이 그 값을 `tostring | length`로만 쓴다. 결과 객체에는 `isLogging` · `hasDeliveryError` 두 불리언뿐이다.
- jq 1.7.1 손 시험 10모양: 키 없음 · `null` · `""` · `false` → 거짓 / 글자 · `0` · 객체 · 배열 · `" "` → 참. 어느 경우에도 출력에 원문 0.
- 시험: `collector.aws.test.ts` ⑱ "오류 글자(버킷 이름 · 주소 …)는 출력에 실리지 않는다" + 독이 든 시나리오(`"AccessDenied: POISON-trail-bucket 203.0.113.77 kim@example.com <script>…"`) 누출 0.
- 영수증의 `errorCode`는 CLI가 실패했을 때 `An error occurred (코드)`의 코드 토큰만이며 이 필드와 무관하다.

### 2-4. 문서 대조와 남은 것

- [확인: AWS CloudTrail API Reference, 2026-10-20] `AdvancedFieldSelector`의 연산자는 Equals · StartsWith · EndsWith · NotEquals · NotStartsWith · NotEndsWith 6개뿐이고, "Equals는 readOnly · eventCategory · resources.type에 쓸 수 있는 유일한 연산자"다. 그래서 221의 다섯 연산자 목록에는 빠진 것이 없고, 그 분기는 정상 출력에서는 타지 않는 방어 코드다. 연산자 배열은 최소 1개라 빈 배열을 '없음'으로 보는 처리도 안전하다.
- `LatestDeliveryError`는 String이고, 오류가 없을 때 키가 없는지 빈 문자열인지는 문서에 없다. 두 경우 모두 거짓으로 처리하므로 판정은 같다. 회복 뒤에도 기록이 남는지는 [미확인] → PM V1 ★15.
- jq 1.6 실제 실행은 여전히 0회다(이 맥은 1.7.1, 로컬 이미지 6종에 jq가 없음 — 오프라인 · 읽기 전용 확인). 쓰인 구문은 모두 1.5부터 있다 → PM V1 ★3.
- 강화 후보(v1.0.x, 비차단): 221을 "`Field` · `Equals` 밖의 비어 있지 않은 키가 있으면 `[]`"로 바꾸면 미래 연산자에도 자동으로 해석 불가가 된다. 지금 문서 기준으로 빠진 연산자가 없고, 바꾸면 QA가 실브라우저 6경우로 확인한 내려받기 해시가 무효가 되므로 이번에는 바꾸지 않는다.
- 릴리스 절차: `src/lib/cloudcheck` · `src/app/cloudcheck`를 건드린 커밋이 모든 ref에서 0건(`git log --all`)이라 `--reset` 재작성은 규칙 안이다. `SHA256SUMS` = `RELEASES.json` = `release.test.ts` 원장 = 파일 바이트(`shasum -c` 통과). 첫 push 뒤부터는 추가 전용.

---

## 3. 아키텍처 · 불변식 최종 확인

| 불변식 | 판정 | 확인한 것 |
|---|---|---|
| 결정성(시계 · 난수 0) | 유지 | 소스 가드(`engine/source-scan.test.ts`)가 engine · rules · contract · parse를 덮는다(초록). `parse/digest.ts`는 순수 동기 SHA-256: 형식화 배열 · DataView만, 시계 · 난수 · 환경 · `crypto` 0. FIPS 벡터 + `node:crypto` 대조(길이 0~300 · 1 MiB). 동률은 16진 문자열의 코드 단위 비교로 깬다(`localeCompare` · `Intl` 0 — lib 전체 검색). `new Date(ms)`는 달력 검증용 왕복뿐. 비용 약 5.7 ms/MiB(최대 입력 25 MiB ≈ 145 ms) |
| `judge`가 던지지 않음 | 유지 | `judge` = `try { judgeInput } catch { failClosedReport }`, 안전망은 정적 데이터 + 안전한 읽기만. `judge.test`(위조 증명 · 던지는 룰 · Proxy 입력 · 엉뚱한 입력) 초록 |
| 정답지 자동 생성 경로 0 | 유지 | lib 안에서 `answers/`에 쓰는 코드 0(`writeFileSync` 전수 검색 — 생성기는 `companies/`만), 스냅샷 API 0, `answers.ts`에 Report → 정답지 함수 없음, AN-04 초록. 단 **정답지 1개가 기록 없이 바뀜**(§4 F-3 — 내용은 맞음) |
| 계약 하위 호환 | 유지 | `normalized.ts` 추가 3개 모두 선택 필드, 메이저 그대로. `sealCoverage`는 `memberKeys`가 없으면 예전과 같고, 잘못된 집합이면 미완결로 봉인(fail-closed). 모델 `Banner` 합집합에 1개 추가(`cloudcheck.report/1` 그대로 · 리포트는 저장 · 교환 형식이 아님 · `ReportNotices.tsx`가 렌더 · type-check 초록). 수집 계약 · 호출 카탈로그 · 예외 파일 계약 바이트 변경 0. `NORMALIZED.md` §7에 승인 기록 |
| 신원 집합 대조(CC-QA-02 · 15) | 유지 + 고정 | 엔진 `populationHolds`는 증명에 `memberKeys`가 없으면 개수만 본다(micro 호환). 프로브: 회사 8곳 JSON + 보고서 CSV 4개에서 parse가 만든 완결 패밀리 **95개 모두** `memberKeys`(크기 = 모수)를 싣는다 → 느슨한 길은 실제 입력 경로에서 쓰이지 않는다. 이를 `parse/identity.test.ts` 12개 시험으로 고정 |
| 계층 규칙 | 유지 | engine · rules → contract · model만(소스 가드 초록). 새 `rules/sources.ts`는 `./params`만, 새 `contract/clean-text.ts`는 import 0 |
| 중복 상수(`RESERVED_IPV4_RANGES` ↔ `keepIpv4`) | **결정: 두 곳 유지 + 대조 시험** | 목적이 다르다(판정 파라미터 vs 개인정보 정책). 묶으면 한쪽 편집이 다른 쪽을 몰래 바꾼다. 판정 정확성은 서로 기대지 않는다(≤ /8 값은 `keepIpv4`와 무관하게 보존, 룰 목록은 ≤ /8에만 쓰임). 대신 같은 9개라는 사실을 경계 주소 32개 대조 시험으로 고정(`parse/mask.test.ts`). 변이 확인: `keepIpv4`에서 169.254/16을 빼면 그 경계 2개가 검출됨 → 원복(해시 일치). 상세는 정본 §6-4 |

---

## 4. 새로 찾은 것

| ID | 심각도 · 묶음 | 내용 | 담당 · 권고 |
|---|---|---|---|
| **F-1** | 낮음 · G8 전 권장(차단 아님) | AWS-KEY-4는 신뢰 정책 조건을 `연산자:키`로만 받는다(값은 준비밀값이라 수집하지 않음 — 설계). 그래서 `StringLike: {"sts:ExternalId": "*"}`처럼 실제로는 아무 값이나 통과하는 조건도 '보호 있음'이 되어 외부 계정 역할이 이상 없음이 된다. **차단이 아닌 이유**: 이상 없음 문장("외부 AWS 계정을 ExternalId 조건 없이 믿는 역할이 없음")은 글자 그대로 참이고, 룰 명세가 묻는 것도 조건이 있느냐다. 와일드카드 ExternalId는 드문 안티패턴이다[일반 지식]. 다만 '못 보는 것'에 값 미확인이 빠져 있어 고지가 모자라다 | 디자인팀장 + DB설계자: `cannot` 한 줄("ExternalId 조건의 값 — 와일드카드처럼 실제로 막지 않는 값은 구분하지 못함") 추가 여부 결정(문구 키 · copy-review · 제목×상태 시험이 함께 바뀜). v1.1: 수집기가 'StringLike 값에 `*` · `?` 포함' 불리언만 투영(계약 추가) |
| **F-2** | 낮음 · D(허용) → v1.0.x | 가명 사본(`maskedCopy`)이 옥텟이 255를 넘는 IPv4 모양 값(`1.2.3.300/32` · `52.300.0.0/16`)을 **유효한** 문서용 주소(`203.0.113.1/…`)로 바꾼다. 원본은 해석 불가(확인 불가)인데 사본을 다시 판정하면 이상 없음이다(프로브로 확인). 느슨한 IPv6 모양(`2600:::1/64`)도 같은 종류다. 사용자 리포트 판정에는 영향이 없다(사본은 다시 불러올 수 없고, AWS가 내지 않는 P3 값). 골든 파일 · 상담 공유 사본의 대표성만 깨진다 | API설계자: 유효한 주소만 가명으로 바꾸고, 깨진 모양은 '깨진 채로' 가명 처리한다(그대로 두면 오타 난 실제 주소의 앞자리가 샐 수 있으므로 그대로 두지는 않는다). `mask-rejudge`에 사례 추가 |
| **F-3** | 정보 · 추적성 · G8 전 | `fixtures/answers/D.azure.json`이 STEP 5 1라운드(10-20 01:53)에 바뀌었다. API설계자 보고서는 '정답지를 건드리지 않음'이고, `notes`에 그날 기록이 없으며, QA 리포트 G3 행은 "정답지 변경 0"이라고 적었다. 바뀐 칸은 복원할 수 없었다(백업 없음). **내용은 맞다**: 회사 정의(`worlds-azure.ts AZURE_D`)에서 다시 도출했다 — AZ-LOG-1 구독 3개(운영 exported · 개발 · 레거시 denied), 범위 missing 2(레거시 계정 목록 거부 · 개발 목록 잘림) · outOfScope 1(협력사-공유). QA가 엔진을 보기 전에 쓴 독립 표(AN-01)와도 겹치는 행이 모두 같다 | DB설계자: `notes`에 바뀐 칸 · 근거 한 줄. QA실행자: G3 문구 정정. 원칙 재확인: 정답지를 고칠 때는 이유를 같은 파일 `notes`에 남긴다 |
| F-4 | 정보 | QA 시험 제목 "… — 지금은 건너뛰어 이상 없음"(CC-QA-24)이 수정 뒤 상황과 맞지 않는다. 지시 범위(`it.fails` → `it`만) 때문에 고치지 않았다 | QA실행자: "수정 전: …" |
| F-5 | 정보 | 수집기 221의 연산자 목록 방식(§2-4 강화 후보) | API설계자 v1.0.x(첫 공개 뒤면 `CC_VERSION` 올림) |

---

## 5. 시험 결과(직접 실행)

| 실행 | 결과 |
|---|---|
| `npm run type-check` | exit 0 |
| `npx vitest run src/lib/cloudcheck` | 92파일 · **3,353 통과 · todo 1 · 실패 0**(검수 전 기준선 3,316 → +37) |
| 그중 QA `src/lib/cloudcheck/qa` | 32파일 · 451 통과 · todo 1 · `it.fails` **0** |
| `npx vitest run src/app/cloudcheck/_build/guards.test.ts` | 147 통과 |
| `src/app/cloudcheck` 전체 | 40파일 · 822 통과 · 실패 1 = `generated.test.ts` 동기(예상 — lib 변경, 메인 세션 재생성. 수집기 해시 · 내려받기 시험은 초록) |
| 표적 묶음(micro 정답표 · known-low · qa-round2 · judge · copy-review · render-lint · oracle-diff · fo-unexpected-values · mask-rejudge · boundaries) | 10파일 · 1,008 통과 |
| 변이 2회 | CC-QA-24 되돌림 → 7 실패, `keepIpv4` 대역 제거 → 대조 시험 실패. 둘 다 원복 · sha256 일치 |

레포 전체 `npx vitest run`은 이번에 돌리지 않았다(바뀐 것이 cloudcheck lib과 그 시험뿐). STEP 7 로컬 게이트에서 재생성 뒤 돌린다.

---

## 6. 남은 위험

| 위험 | 크기 | 대응 |
|---|---|---|
| 실제 CLI 출력 모양(AWS) — 고급 선택기 · `LatestDeliveryError` · 프로토콜 표기 · jq 1.6 | 중 | 모양이 다르면 확인 불가로 떨어지게 짜여 있다(이상 없음 아님). PM V1 ★3 · ★15~17 |
| 레포 권한 탈취 시 해시 3중 일치가 그대로 통과 | 중(낮은 확률) | GitHub · Vercel 2FA, PDF 인쇄 해시 · 라이브 해시 주기 대조(G9). 첫 push 뒤 `RELEASES.json` 추가 전용 |
| F-1 와일드카드 ExternalId | 낮음 | 고지 문구(G8 전) → v1.1 불리언 투영 |
| F-2 사본의 깨진 주소 | 낮음 | v1.0.x |
| Azure 쪽(목적지 좁힘 미구현 · 수집기 보안 결정 2건 · 실계정 0회) | 공개 전 차단 | V2 실제 Azure 입력 차단이 베타 조건으로 걸려 있다(QA 확인). C 묶음 닫힌 뒤 해제 |
| 정답지 변경 기록 공백(F-3) | 낮음(추적성) | notes · 원칙 재확인 |
| 첫 공개 뒤 버전 규율 | 중(절차) | 수집기 · 룰을 고치면 `CC_VERSION` · `RULESET_VERSION`을 올리고 `--reset` 금지 — 배포엔지니어 체크리스트에 넣었다(정본 §12-0) |

---

## 7. 넘길 것

| 받는 쪽 | 할 일 |
|---|---|
| 메인 세션 | `_generated/page.ts` 재생성 → `generated.test.ts` 초록 확인(배포 게이트 필수) |
| @기획팀장 | 이 판정(백엔드 베타 승인)을 최종 리뷰 보고서에 반영. F-1은 기획팀장이 베타 차단으로 올리고 싶다면 이 문서의 근거로 판단(백엔드 권고: 차단 아님, G8 전 고지) |
| @배포엔지니어(STEP 7) | 재생성 뒤 레포 전체 시험 · 라이브 `/cloudcheck/download` 수집기 sha256 = `5547c91e…` · `8bc7bd2f…` 확인. 첫 push 뒤 버전 규율 |
| @QA실행자 | F-4 제목 · CC-QA-24 상태 · G3 문구(F-3) |
| @DB설계자 | F-3 `notes` · F-1 문구(디자인팀장과) |
| @API설계자 | F-2(v1.0.x) · F-5(v1.0.x) |
| PM | V1은 새 수집기 릴리스(`5547c91e…`)로, 정본 §11 ★15~17 포함 |

### 이번에 고친 파일(STEP 6)

`src/lib/cloudcheck/rules/aws/aws-net-1.ts` · `fixtures/micro/aws-net.ts` · `fixtures/micro/index.ts` · `rules/micro-expectations.test.ts` · `qa/known-low.test.ts`(`it.fails` → `it` 1개만) · `parse/mask.test.ts` · `parse/identity.test.ts` · `rules/params.ts`(주석) · `parse/mask.ts`(주석) · `contract/NORMALIZED.md`(승인 기록) · `docs/backend/cloudcheck-backend-final.md` · 이 문서. 수집기 · `src/app/**` · `_generated` · 공유 파일 변경 0, 설치 · 커밋 · push · 서버 0.

### 근거 출처

- AWS CloudTrail API Reference — AdvancedFieldSelector: https://docs.aws.amazon.com/awscloudtrail/latest/APIReference/API_AdvancedFieldSelector.html
- AWS CloudTrail API Reference — GetTrailStatus: https://docs.aws.amazon.com/awscloudtrail/latest/APIReference/API_GetTrailStatus.html
- 레포 밖 증거(스크래치 `…/scratchpad/lead-final/`): `bytecheck.mjs`(바이트 검사) · `probe-memberkeys.ts` · `probe-mask-octet.ts` · `bench-digest.ts` · 실행 로그(`baseline-cc.log` · `final-cc.log` · `final-qa.log` · `final-app.log` · `final-guards.log` · `final-generated.log` · `typecheck.log`). 승인본 수집기 바이트 사본 `…/scratchpad/aws-f223.sh.txt`
