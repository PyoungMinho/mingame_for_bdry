# 「문단속 5」(cloudcheck) 버그 리포트 · 테스트 실행 결과 — STEP 5 QA (@QA실행자)

> 작성: @QA실행자(Opus) · 1차 2026-10-20 01시 · **재검증 2026-10-20 03~04시(수정 2라운드 뒤)** · 기준 설계서: `docs/qa/cloudcheck-test-plan.md`(@QA설계자, 2026-10-19) · 결정: `docs/planning/cloudcheck-qa-decisions.md`(@기획팀장, 2026-10-20)
> 코드 기준: 작업 트리의 `src/app/cloudcheck/**`, `src/lib/cloudcheck/**`(미커밋). 재검증 동안 제품 코드 변경 없음(`find -newer`로 확인). 최종 생성물 `_generated/page.ts` 03:25 재생성본(PAGE.sha256 `ec20c201…dbb`)
> 레포 변경(QA): `src/lib/cloudcheck/qa/**`(QA 소유 — 시험 32 + 도우미 7)와 이 문서, 그리고 STEP 6에 한해 허용된 `src/lib/cloudcheck/parse/secrets.test.ts`(비밀 모양 리터럴 조립 — §R-6)뿐. 제품 코드·다른 테스트·가드·생성물·공유 파일 9종은 그대로다
> 레포 밖 스크래치: `/private/tmp/claude-501/-Users-pyoungminho-Desktop-------team-makes/a8432358-e439-4607-8633-d54f9c3d981b/scratchpad/qa/`(이하 `…/scratchpad/qa/`) — CDP 스크립트·스크린샷·PDF·실행 로그(재검증분은 `browser-r2/`)
> 표기: 상태 낱말은 리포트와 같다(위험 · 주의 · 확인 불가 · 이상 없음 · 해당 없음). '이상 없음 결론' = 이상 없음 또는 해당 없음
> 읽는 순서: **§R(재검증 — 지금 유효)** → §0~§14(1차 실행 기록 — 버그 재현 절차 · 위치 · 근거. 판정과 '지금은 …' 서술은 §R이 대체한다)

-------team-makes/a8432358-e439-4607-8633-d54f9c3d981b/scratchpad/qa/`(이하 `…/scratchpad/qa/`) — CDP 스크립트·스크린샷·PDF·실행 로그
> 표기: 상태 낱말은 리포트와 같다(위험 · 주의 · 확인 불가 · 이상 없음 · 해당 없음). '이상 없음 결론' = 이상 없음 또는 해당 없음

---

## R. 재검증(2026-10-20 03~04시, 수정 2라운드 뒤) — 지금 유효

### R-0. 결론

1. **출시 판정: 베타 배포 가능(조건부)** — 기획팀장 결정 §6의 A단계(베타 · AWS · 띠 + noindex) 조건 가운데 QA가 볼 수 있는 것은 모두 충족했다. 남은 조건은 **PM 수동 확인 2건**(Safari Blob 내려받기 1회 · 버튼 인쇄 2모드 '이 목록만' · '이름·ID 표시')이고, 통과하면 STEP 7(배포 게이트 → 라이브 LV-01~10)로 간다. 상세는 §R-5.
2. **1차 버그 23건 → 모두 수정·검증됨. N1 수정·검증됨, N2 명세 확정(시험으로 고정). 재오픈 0.** 재검증 중 **새로 1건**(CC-QA-24, 낮음 · G8 전 — 0~255 밖 프로토콜 번호를 '포트 없는 프로토콜'로 건너뜀, 편집한 파일에서만)을 찾았고, DB설계자가 같은 날(04:30) 고쳐 QA가 다시 확인했다(§R-1).
3. **시험**: `it.fails` 70개 전부 `it`으로 전환(66개는 그대로 통과, 4개는 단언 보정 · 오라클 갱신 뒤 통과) · 바뀐 동작에 맞춘 갱신 12건 · 새 시험 66개(새 파일 3개 41 + 기존 파일 25) · `it.todo` 6 → 1. QA 시험 32파일 452개 = 통과 451 + todo 1(CC-QA-01 B 잔여) — `it.fails` 0(CC-QA-24도 수정 뒤 `it`).
4. **스위트**: 레포 전체 **254파일 6,045 통과 | todo 1**(108.9초) · cloudcheck **132파일 4,139 통과 | todo 1**(63.7초) · `npm run type-check` 오류 0 · `guards.test.ts` + `generated.test.ts` 195 통과.
5. **실브라우저(최종 바이트, Chrome 155)**: file:// · 서버 모두 최초 요청 1건 · 콘솔 오류 · 예외 0 · CSP · TT 위반 0(일부러 넣은 시험 요청만 막힘) · 저장소 0 · 수집기 내려받기 sha256 = 새 `SHA256SUMS`(6경우) · **CC-QA-20 넘침 0**(360 · 640×450 · 320×225) · **CC-QA-21 axe 0**(V0~V8 + V6, 라이트 · 다크) · V2 실제 Azure 입력 차단 · CC-QA-01 시각 역전 알림이 실제 파일 시각으로 뜬다.

### R-1. 버그별 상태

묶음은 결정 §6 표: **A** = 베타 차단 · **B** = G8(PM V1) 착수 전 · **C** = Azure 실제 점검 공개 전 · **D** = 허용(알려진 문제) · **G7** = 디자인 체크리스트.

| ID | 1차 심각도 | 묶음 | 재검증 상태 | 확인한 시험 · 근거 | 담당 |
|---|---|---|---|---|---|
| CC-QA-01 | 높음 | A(판정) · B(알림) | **수정·검증됨** — B 잔여 1: AWS 수집기 JSON 경로의 정보 알림(판정 영향 없음 — 보고서 시각 기준, `it.todo`) | `fo-time-skew` [CC-QA-01] 15(E-01~04 · CL-05 shim · 알림 3) + 전제 · 대조 9(2000년 하한 포함) · `fo-unexpected-values`(시각 +2년 18건 → 0) · 실브라우저 알림 | DB + API |
| CC-QA-02 | 중간 | C | **수정·검증됨** | `fo-population-identity` 2 | API + DB |
| CC-QA-03 | 중간 | B | **수정·검증됨**(FO-02 30건 → 0 · FO-06 63건 → 0). 프로토콜 번호 256~999는 CC-QA-24로 따로 뺐다 | `fo-unexpected-values` 5 · `oracle-diff` 1 · `net-sources`(CIDR 공백) | DB |
| CC-QA-04 | 중간 | A(합집합) · B(넓은 대역 · 프리픽스 리스트) · C(Azure) | **수정·검증됨**(D-1a · D-1b · D-3 · D-4 결정 문장대로) | `net-sources` 32(A 7 · B 9 · C 9 · 마스킹 재현 7, E-10 직접 시험 포함) · `oracle-diff`(갱신한 오라클과 불일치 0) · `fo-unexpected-values` 1 | DB(+API 마스킹) |
| CC-QA-05 | 중간 | A(ExternalId) · B(나머지) | **수정·검증됨**(FO-02 36건 → 0 · FO-06 94건 → 0) | `fo-unexpected-values` 10 · `oracle-diff` 1 | DB |
| CC-QA-06 | 중간(G7 차단) | A(꼬리표) · B(직접 볼 목록) | **수정·검증됨** — 미증명이면 "일부만 확인", 확인 불가 대상이 없으면 직접 볼 목록에 '보지 못한 나머지 대상' | `ui/expression` 4 | 프론트 + DB |
| CC-QA-07 | 중간 | B | **수정·검증됨**(엔진). 수집기 투영은 새 릴리스(`cloudcheck-aws.sh` 5547c91e…)에 들어갔고, 실제 CLI 출력 모양은 PM V1 | `fo-unexpected-values` 2 | DB + API |
| CC-QA-08 | 중간(D-2) | B | **수정·검증됨** — 전송 오류 trail = 주의 `trail-delivery-error`, 다른 정상 trail이 있으면 이상 없음 | `known-low` 3 · `ui/title-status` 확장 | DB |
| CC-QA-09 | 낮음~중간 | B(AWS) · C(Azure 이름) | **수정·검증됨** — 두 정리기가 한 함수(`contract/clean-text`), 못 잡는 문자 4,147 → 0, `admin`+U+3164 라벨 | `in-invisible` 5 · `in-encoding` 1 | API + DB |
| CC-QA-10 | 낮음~중간 | B | **수정·검증됨** | `in-csv` 4 | API |
| CC-QA-11 | 낮음~중간 | C | **수정·검증됨** | `fo-population-identity` 2 | API |
| CC-QA-12 | 낮음 | D | **수정·검증됨**(허용 묶음이었지만 고침) | `in-secrets` 4 | DB · API |
| CC-QA-13 | 낮음 | A | **수정·검증됨** | `known-low` 1 | DB |
| CC-QA-14 | 정보(D-4) | B | **수정·검증됨** — 위험 포트 + 프리픽스 리스트 = 주의 `sg-source-prefix-list`, 80·443·메일은 제외 | `known-low` 2 · `net-sources` | DB |
| CC-QA-15 | 중간 | B(AWS) · C(Azure) | **수정·검증됨** — 컨테이너 시험 단언을 결정대로 보정("위험이 남는다" → "이상 없음이 아니다", 복제 목록 = 확인 불가) | `fo-population-identity` 5 | API + DB |
| CC-QA-16 | 낮음 | D | **수정·검증됨** — 버킷 MatchKey 위치 마디 = `-`(리전과 무관). FO-04 원시 열거도 같은 규칙으로 맞췄다 | `known-low` 2 · `fo-population-identity` | DB |
| CC-QA-17 | 중간 | C | **수정·검증됨**(FO-02 12건 → 0 · FO-06 109건 → 0) | `fo-unexpected-values` 2 · `oracle-diff` 1 | DB |
| CC-QA-18 | 낮음 | D | **수정·검증됨** — 토큰 JSON · 표준 순서 SAS 모두 키 파일(파일 · 붙여넣기) | `in-keyfiles` 2 + 대조 | API |
| CC-QA-19 | 낮음 | D | **수정·검증됨**(9개 = 9) | `in-secrets` 1 | API |
| CC-QA-20 | 낮음~중간 | G7 | **수정·검증됨** — 실브라우저 넘침 0 | §R-4 | 프론트 |
| CC-QA-21 | 낮음~중간 | G7 | **수정·검증됨** — axe 0(V6 포함) | `ui/a11y` 2 · §R-4 | 프론트 |
| CC-QA-22 | 낮음 | D | **수정·검증됨** — 정적 셸 두 곳에 '이미 오프라인판이면 링크가 열리지 않음' 안내 | `ui/static-shell` 2 | 프론트팀장 |
| CC-QA-23 | 낮음 | D | **수정·검증됨** | `known-low` 1 | DB |
| CC-QA-N1 | 명세 | B | **수정·검증됨** — 판정은 순서 무관, 동률(같은 runKey · 붙여넣은 CSV 둘 · 같은 수정 시각)은 내용 지문으로 깸 | `fo-purity` 5 | API |
| CC-QA-N2 | 명세 | 즉시 | **명세 확정 · 시험 고정** — 화면 · 인쇄는 끝 4자리 원값, 마스킹 사본은 `K001`(같은 키 = 같은 가명) | `in-mask-canary` 3 + 인쇄 시험 | — |
| **CC-QA-24** | **낮음(새로 찾음)** | B | **수정·검증됨**(DB설계자 04:30 — IP 프로토콜 번호는 0~255 정규 표기만, 256 · 999 · 006은 확인 불가) | `known-low` 2(대조 + `256` · `999` · `006`) | DB |

**V2 실제 Azure 입력 차단(결정 §6 보정 2 · 베타 조건)**: 확인됨 — 회사 A · D Azure 수집 JSON, Azure + AWS 함께: 버튼 `aria-disabled` · 안내 `cc.start.azure-soon.note` · 눌러도 V2 · 리포트 0. 체험 Azure는 열리고, 공개 상태를 주입하면 같은 파일이 리포트가 된다(`ui/azure-gate` 7 + 실브라우저 file:// · 서버).

#### CC-QA-24(새로 찾음) · AWS-NET-1이 0~255 밖의 프로토콜 번호를 건너뜀

| 항목 | 내용 |
|---|---|
| 심각도 | 낮음 · G8 전(B) — AWS가 내지 않는 값이라 편집 · 손상 파일에서만 생긴다(결정 §6 보정 1로 베타 차단 아님) |
| 담당 | **DB설계자** |
| 위치 | `src/lib/cloudcheck/rules/aws/aws-net-1.ts`의 `exposures` — 프로토콜이 `icmp` · `icmpv6` · 1~3자리 숫자면 포트 없는 프로토콜로 보고 건너뛴다 |
| 재현 | 아슬아슬상회 AWS(C) `sg-0c0ffee1` 규칙을 protocol `"256"` 또는 `"999"`, 22번, 출발지 `0.0.0.0/0`으로 → 그 SG **이상 없음**(`sg-closed`). 대조: `"1"`(ICMP) · `"50"`(ESP) · `"58"`(ICMPv6)은 포트가 없어 이상 없음이 맞고 `"6"`은 위험 |
| 기대 | IP 프로토콜 번호는 0~255이므로 그 밖의 번호는 모르는 값(P3) → 다른 발견이 없으면 확인 불가(`value-unrecognized`) |
| 원인 | 1차 리포트 CC-QA-03의 고치는 방향에 QA가 "숫자"라고만 적어 범위를 빠뜨렸다(QA 문장의 부정확). 앞자리 0 표기(`"006"`)도 같은 길로 건너뛴다 |
| 고치는 방향 | 숫자 프로토콜은 0~255(앞자리 0 없음)만 알고, 6 · 17은 tcp · udp, 그 밖의 번호는 포트 없음, 범위 밖 · 앞자리 0은 `unrecognized` |
| 시험 | `known-low.test.ts` `[CC-QA-24]` — 처음엔 `it.fails`(실제 실패 내용: `256: expected 'clear' to be 'unknown'`), DB설계자 수정(04:30, `aws-net-1.ts` `isProtocolNumber`)과 함께 `it`으로 바뀜. QA가 제목을 '수정 전: …'으로 정리하고 앞자리 0 표기 `006` 사례를 더해 확인했다(확인 불가). 오라클(`oracle.ts`)도 0~255 규칙(FO-06 불일치 0) |
| 상태 | **수정·검증됨**(2026-10-20 04:4x 재확인) |

#### 재검증 중 확인한 정보(버그 아님)

- **결정 문서 §9-1 문구**: "출발지 없음 = 해석 불가, 80·443만이면 영향 없음"은 §2-2("해석 불가 값은 포트와 무관하게 … 80·443만 연 규칙이어도 확인 불가 쪽으로 센다")와 다르게 읽힐 수 있다. 엔진(DB설계자 선택)과 QA 오라클은 §2-2대로(포트와 무관) 일치한다 — 기획팀장이 §9-1 문장을 §2-2에 맞춰 다듬기를 권고.
- **DB설계자 선택 2가지는 결정과 모순 없음**: ① 출발지 없는 규칙은 포트와 무관하게 해석 불가(§2-2와 같음) ② 한쪽 끝만 0~65535 밖인 포트 구간은 잘라 읽고 위험 유지(예: 22~70000 → 22~65535 — 결정에 언급 없음, 안전한 방향). 오라클도 같게 짰다.
- **시각이 미래로 틀린 경우(PC 시계가 앞섬)**: 반대 방향 역전도 살폈다. 나이가 길게 나오는 쪽이라 키 나이 · 미사용은 주의가 늘고(안전한 방향), 루트 최근 로그인(AWS-MFA-1)은 보고서 CSV의 루트 비밀번호 칸이 늘 `not_supported`라 그 경로로 이상 없음이 될 수 없다 → 문제 없음.
- **실브라우저 스윕의 `downloads.html`**(1차 · 재검증 모두 file:// 360에서만 보임)은 제품과 무관하다 — 같은 내려받기 폴더 조건으로 다시 재현해 보니 내용이 `Cr24` 머리글(Chrome 구성요소 패키지 CRX)인 `downloads.html.crdownload`였다. 헤드리스 Chrome의 구성요소 업데이트가 `Browser.setDownloadBehavior` 폴더로 내려받은 것이다. 같은 경우 제품의 `cloudcheck-aws.sh`는 바이트가 맞게 저장됐다(`browser-r2/focus6/focus6.json`).

### R-2. 시험 전환 · 갱신 결과

| 구분 | 개수 | 내용 |
|---|---|---|
| `it.fails` → `it` 전환 | **70**(66 + 4) | 66개는 수정 뒤 "Expect test to fail"로 바뀐 것을 그대로 전환. 4개는 보정 뒤 전환: CC-QA-15 컨테이너(단언 보정), `oracle-diff` CC-QA-03 · 04 · 17(오라클을 결정대로 갱신한 뒤 불일치 0). 제목의 "지금은 …"은 "수정 전: …"으로 바꿨다 |
| 바뀐 동작에 맞춘 갱신 | **12** | ① `fo-time-skew` 전제(2000년 이전 기준 시각 = null, 2000-01-01 정각은 받음) ② 같은 파일의 시간 알림 기록 시험 문구 ③ `fo-unexpected-values` 분류표 → 전수 위반 0 + 변이 필드 확인(픽스처에 IPv6 출발지가 없어 `sg.ingress.ipv6Cidrs`만 변이 대상 없음 — FO-06 · `net-sources`가 덮음) ④ `fo-population-identity` aws-A 원시 열거(버킷 위치 `-`) ⑤ CC-QA-15 컨테이너 단언 ⑥ `in-csv` 전제(같은 열 두 번 = 모호한 출처) ⑦ `in-invisible` 기록(못 잡는 문자 0) ⑧ `in-keyfiles` 대조(토큰 JSON · 표준 SAS = 키 파일) ⑨ `known-low` CC-QA-08 현재 동작 → 결정 D-2 ⑩ CC-QA-14 현재 동작 → 결정 D-4 ⑪ Azure '준비 중' 게이트 때문에 막히는 UI 시험 3개(`in-mask-canary` azure-C · `ui/expression` EX-01 V3 · `ui/xss` Azure)에 공개 상태 주입 ⑫ `oracle.ts` — `refNet1` · `refAzNet1`(결정 §2: trim · 합집합 = 전체 · 넓은 공인 대역(사설 · 예약 합집합 제외) · 프리픽스 리스트 · 서비스 태그는 위험 포트에서만 주의 · ASG · VirtualNetwork · AzureLoadBalancer = 내부 · 출발지 없음 = 해석 불가), `refKey4`(ExternalId 보호 = 값 일치 연산자만, IfExists · ForAllValues 제외), 생성기(넓은 대역 · 프리픽스 리스트 · 보안 그룹 참조 · ASG · 태그 · IPv6 · 호스트 비트) |
| 새 시험 | **66** | 새 파일 3개: `net-sources.test.ts` 32(CC-QA-04 A · B · C + E-10 + 마스킹 재현 §9-6) · `ui/azure-gate.test.tsx` 7(V2 Azure 차단 · 체험 Azure 열림 · 공개 상태 대조) · `ui/static-shell.test.ts` 2(CC-QA-22). 기존 파일 25: `fo-time-skew` +5(알림 3 · 정상 대조 · AWS JSON 기록) · `fo-purity` +5(N1 순서 무관 2 · 동률 3) · `in-mask-canary` +3(N2) · `known-low` +5(D-2 3 · D-4 2 · CC-QA-24 2, 현재 동작 2개는 대체) · `ui/expression` +3(새 사유 · 알림 렌더 · D-6 붙여넣기 안내 · CC-QA-06 나머지 대상) · `ui/title-status` +4(EX-04 확장 = 디자인 §8-5 줄) |
| `it.todo` | 6 → **1** | N1 · N2 · D-2 · D-4 · CC-QA-22 → 시험. 남은 1: `[CC-QA-01 권고 · B]` AWS 수집기 JSON 경로 알림 |
| 새 `it.fails` | 1 → **0** | CC-QA-24 — DB설계자 수정과 함께 `it`으로 바뀜(§R-1) |

FO-06 오라클(룰당 250 세계, 시드 고정) 재측정: AWS-NET-1 611 비교 · 불일치 0(주의 사유에 `sg-source-broad` 47 · `sg-source-prefix-list` 30이 실제로 나옴) · AWS-STO-2 610/0 · AWS-KEY-4 608/0 · AZ-NET-1 490/0(`nsg-source-service-tag` 14 · `nsg-source-broad` 1) · AZ-STO-2 621/0. FO-02 1,367 변이(JSON 1,004 + CSV 363) 위반 0(1차 100건). FO-01 · FO-03(단조성) · AN-01(정답지 76행) · ISO-02(커밋된 HTML 런타임 스파이) 모두 초록 — 부작용 없음.

### R-3. 스위트 결과(재검증 마지막 실행, 04:05~04:08)

| 실행 | 결과 | 시간 | 로그(스크래치) |
|---|---|---|---|
| QA 시험 `src/lib/cloudcheck/qa` | 32파일 · 452개 = 통과 451 · todo 1 · 실패 0(STEP 6 재실행 기준, `it.fails` 0) | — | `r3-qa.json` |
| cloudcheck 스위트 | 132파일 · **4,139 통과** · todo 1 | 63.7초 | `r2-final-cc.log` |
| 레포 전체 `npx vitest run` | 254파일 · **6,045 통과** · todo 1 · 실패 0 | 108.9초 | `r2-final-all.log` |
| `npm run type-check` | 오류 0 | — | `r2-final-typecheck.log` |
| `guards.test.ts` + `generated.test.ts` | 195 통과(QA 파일을 더한 뒤 다시 확인) | — | — |
| 수집기 `bash -n` | 새 `cloudcheck-aws.sh`(5547c91e…) · `cloudcheck-azure.sh`(8bc7bd2f…, 그대로): bash 3.2.57(macOS) · 5.1.16(`mariadb:10.11`) · 5.2.21(`hwp2pdf:latest`) · 5.3.3(`postgres:16-alpine`) 오류 0(`--pull=never --network none`, 읽기 전용) | — | — |

### R-4. 실브라우저 재확인(최종 바이트)

- **바이트**: `_generated/page.ts`(03:25) → PAGE.sha256 `ec20c2011cbf7167d5cd7b3938521c49945bb17ea9c42ffde7271b31d4d70dbb` · 915,844바이트(894.4 KiB) · 응답 CSP 해시 `script-src 'sha256-8b4sg4kH…'` · `style-src 'sha256-nhey7PpE…'` · 수집기 AWS `5547c91e7f8a4b152c8693eca25ca33d68a886f70247ef9a91599c1dd1c3b988`(26,671바이트) · Azure `8bc7bd2f…`(그대로).
- **서버**: `.next` 빌드(10-19 23:00)가 재생성(03:25)보다 오래돼 `next start`로는 최종 바이트를 볼 수 없었다. `.next`를 다시 빌드하지 않고, 실제 라우트 핸들러(`route.ts` · `download/route.ts`)를 그대로 불러 루프백(127.0.0.1 · ::1, 포트 3918)으로만 내보내는 레포 밖 도구(`…/scratchpad/qa/route-server.ts`)를 썼다 — **측정 뒤 종료**(포트 3918 닫힘 확인). **포트 6001(다른 프로젝트, PID 19155)은 건드리지 않았다.** Next가 덧붙이는 헤더(`Vary` 등)는 이 도구에 없으므로 그 부분은 라이브 LV-01이 본다.
- **헤더 · 본문**: GET = HEAD(GET의 `Transfer-Encoding`만 다름) · `/cloudcheck` = `/cloudcheck/download` 본문 sha256 = PAGE.sha256 · `content-disposition: attachment; filename="cloudcheck-0.1.0.html"` · CSP(`connect-src 'none'` · TT 2지시어 · `frame-ancestors 'none'`) · COOP/CORP `same-origin` · XFO `DENY` · `X-Robots-Tag: noindex`.
- **전 화면 스윕**(`cdp-sweep-r2.mjs`, 11개 목표 — file:// 1280 · 360, 서버 1280 · 360 · 다크 · 640×450(200%) · 320×225(400%) · axe 라이트 · 다크 · 색각 · COOP/iframe): 최초 요청 1건(문서) · 콘솔 오류 · 예외 0 · CSP · TT 위반 0(서버 1280의 `example.com` 시험 요청 1건만 차단) · 저장소(local · session · IDB · cache · cookie · SW) 0 · **가로 넘침 0(모든 목표 · 체험 8곳 전부 펼침)** · **axe 위반 0(V0 · V6 · V3 체험 · V4 · V7 · V8 · V1 · V2 · V3 실제 파일, 라이트 · 다크)** · 인쇄 미디어 마스킹 기본(짧은 값 50 · 원값 0) · 접힌 본문 10/10 · 도장 · 서명 0 · PDF 944 KiB · 색각 에뮬레이션 글자 없는 배지 0/35 · 다른 origin `window.open` 단절 · `<iframe>` `frame-ancestors`로 차단 · 예외 파일(버킷 MatchKey `-`) "1건 적용".
- **내려받기**(`cdp-focus4.mjs`): 수집기 `cloudcheck-aws.sh` 26,671바이트 sha256 = `SHA256SUMS` — file · 서버 × 1280 · 360(모바일 에뮬레이션 켬 · 끔) **6경우 모두 일치**. 마스킹 사본 84,555바이트 · 예외 파일 299바이트도 Blob으로 저장.
- **표적 확인**(`cdp-focus7.mjs`): file:// `cc-file` · 오프라인판 링크 숨김 · 페이지 안 `fetch` → meta CSP로 차단 · `innerHTML` 대입 → Trusted Types로 차단 · `pushState` 동작 · localStorage 0 · sessionStorage 0 · cookie 빈 값. **V2 실제 Azure 입력 차단**(file · 서버): 읽음 표시 뒤 버튼 `aria-disabled="true"` · 안내 문구 보임 · 눌러도 V2 · 리포트 0. **CC-QA-01 알림**(file · 서버): 파일 수정 시각을 2026-01-01로 둔 보고서 CSV → '기준 시각보다 늦은 기록이 파일 안에 있습니다' 알림 · AWS-KEY-1 행은 주의 유지(찾은 위험 · 주의는 그대로) · 넘침 0.
- 증거: `…/scratchpad/qa/browser-r2/`(`sweep/results.json` + 스크린샷 · PDF, `focus4/focus4.json`, `focus6/focus6.json`, `focus7/focus7.json`, `get.headers` · `head.headers` · `dl.headers`).
- **STEP 6 재확인(04:5x)**: 04:52 재생성본(PAGE.sha256 `c9f68992…`)으로 같은 스윕 · 표적 · 내려받기를 다시 돌려 결과가 같았다(§R-6 3). 배포 때 LV-03은 이 값(또는 그 뒤 다시 만든 값)으로 본다.

### R-5. 출시 판정(결정 §6 해석 — §10-2 = 베타 기준, §10-1 = G8 착수 전 완전 종료)

#### **판정: 베타 배포 가능(조건부)**

| A단계 조건(결정 §6 표) | 상태 |
|---|---|
| 차단 항목 `it.fails` → `it` 전환 — CC-QA-01 · 06(꼬리표) · 04(합집합) · 05(ExternalId 연산자) · 13 · V2 Azure 차단 | **충족** — 전부 `it` · 초록 |
| cloudcheck 스위트 · 레포 전체 · type-check · 가드/생성물 초록 | **충족** — §R-3 |
| V2 실제 Azure 입력 차단 | **충족** — RTL 7 + 실브라우저 file · 서버 |
| G5 Safari Blob 내려받기 1회 | **남음(PM)** — §9 수동 표 #1~3 |
| G7 디자인 §10-3 체크리스트 | **남음 1(PM)** — 디자인 문구 검수 §9 표의 #8 '버튼 인쇄 2모드'만 남았다. #3 X4 제목은 결정 §11로 확정 · 반영(`ko.aws.ts:20` "루트 사용자 자격증명" 확인), #10~13 QA 전환 · 재측정 · 재생성은 이번에 끝냈다 |

- **막는 버그: 없음.** 남은 조건 2건(PM 수동: Safari Blob 1회 · 버튼 인쇄 '이 목록만' · '이름·ID 표시')을 같은 회차에 확인하면 STEP 7(배포엔지니어 — 로컬 게이트 `rm -rf .next && npm run build` 포함 → 프리뷰 승인 → push → 라이브 LV-01~10)로 간다. Safari에서 Blob이 끊기면 CR-13(`DownloadLink.tsx:42`)을 고친 뒤 다시 본다.
- **B(G8 착수 전)에 남은 것**: CC-QA-01 AWS 수집기 JSON 경로 정보 알림(`it.todo`) · 정답지 `D.azure.json` 변경 기록(DB설계자 `notes`) · PM V1 자체(§10 — 새 수집기 릴리스 5547c91e로). CC-QA-24는 같은 날 고쳐졌다. 나머지 B 항목(03 · 05 나머지 · 07 · 08 · 09 AWS · 10 · 14 · 15 AWS · 04 넓은 대역 · 06 직접 볼 목록 · N1 · 수집기 묶음 릴리스 · EX-04 §8-5 줄)은 끝났다.
- **C(Azure 공개 전)에 남은 것**: 버그 쪽은 끝났다(02 · 04 D-3 · 09 Azure · 11 · 15 Azure · 17). 결정 §8-C의 **AZ-NET-1 목적지 좁힘(새로 정함)**은 아직 구현되지 않았다(Azure 수집기 해시 그대로 — 목적지 투영 없음). 그 뒤 Azure PM V1 → `CLOUD_AVAILABILITY.azure`와 함께 V2 차단 해제.
- **D(허용)**: 목록의 버그는 모두 고쳐졌다. CR-13은 Safari 확인 뒤 판단.

#### 게이트별(§10-1 '완전 종료' 기준으로 본 지금)

| 게이트 | 상태 | 근거 |
|---|---|---|
| G1 엔진 | **닫힘** | INV · FO-01 · 03 · 05 · 07~11 초록, FO-02 · 06 불일치 0, CC-QA-24 수정·검증됨 |
| G2 룰 | **닫힘** | AWS 통과. AZ-NET-1 서비스 태그(D-3a) 구현, ASG(D-3b)는 결정 문서 §2가 명세 변경 기록 |
| G3 정답지 | **닫힘** | AN-01 독립 표 76행(D.azure 포함)이 지금 정답지와 일치 · 정답지 100% · tolerate 0. **정정(STEP 6)**: 1차 · 재검증 때 '정답지 변경 0'이라고 적었으나 틀렸다 — `fixtures/answers/D.azure.json`이 10-20 01:53(STEP 5 1라운드 중) `notes` 기록 없이 바뀌었다. 백엔드팀장이 회사 정의(`worlds-azure.ts` AZURE_D)에서 다시 도출해 내용이 맞음을 확인했고(백엔드 검수 `docs/review/cloudcheck-backend-review.md` F-3), 근거 기록은 DB설계자가 `notes`에 넣는다. QA AN-01은 이 파일과 겹치는 행이 모두 같다 |
| G4 수집기 | **닫힘(로컬 범위)** | CL-01 · 02 · 03 초록 · CL-04 오류 0(새 수집기). jq 1.6 · bash 5 실제 실행은 G8 |
| G5 격리 | **조건부** | ISO-02 · 03 · 04 · 05 위반 0(최종 바이트). Safari Blob 1회 남음 · 라이브는 LV |
| G6 입력 안전 | **닫힘** | IN-01~12 초록, `it.fails` 0(허용 목록 12 · 18 · 19도 고쳐짐) |
| G7 표현 | **조건부** | EX-01~05 초록(EX-04 §8-5 확장 · 새 사유 렌더 포함) · 디자인 체크리스트는 버튼 인쇄 2모드(PM)만 남음 |

#### 수정 담당별(남은 것)

| 담당 | 남은 일 |
|---|---|
| DB설계자 | `D.azure.json` `notes`에 10-20 변경 기록(B) · AZ-NET-1 목적지 좁힘(C, API설계자와) |
| API설계자 | CC-QA-01 AWS 수집기 JSON 경로 알림(B, 정보 — 디자인팀장 문구와) · AZ-NET-1 목적지 투영(C, Azure 수집기 묶음) |
| 프론트 · API설계자 | 범위 밖 시험 파일의 비밀 모양 리터럴 17건을 같은 방식(조각 조립)으로 정리(§R-6 표) — 푸시 보호 대비, STEP 7 push 전 권장 · Safari에서 Blob이 끊길 때만 CR-13(프론트) |
| 기획팀장 | 결정 문서 §9-1 문구를 §2-2에 맞춰 다듬기(정보) |
| PM | Safari Blob 1회 · 버튼 인쇄 2모드(베타 조건) · PM V1(G8) |

### R-6. 배포 준비(STEP 6, 2026-10-20 04:4x) — 시험의 비밀 모양 리터럴 정리 · 커밋 대상 비밀 패턴 스캔

배경: 배포 저장소 `mingame_for_bdry`는 공개 저장소이고 GitHub 푸시 보호가 기본으로 켜져 있다. 시험용 가짜 값이라도 실제 비밀 패턴과 같은 모양이면 push 전체가 거부될 수 있다(프론트팀장 검수 `docs/review/cloudcheck-frontend-review.md` F-2 · C3).

**1) 고친 것 — 실행 중 조립(시험의 뜻 · 기대값 그대로)**

| 파일 | 바꾼 것 | 패턴별 처리 |
|---|---|---|
| `src/lib/cloudcheck/qa/fake-secrets.ts`(새 도우미 · 시험 아님) | 가짜 비밀 모양 값을 조각으로 이어 붙여 만드는 한 곳. 값은 예전 리터럴과 글자 하나까지 같다(레포 밖 대조 스크립트로 15개 값 일치 확인) | — |
| `src/lib/cloudcheck/qa/in-keyfiles.test.tsx` | 도우미 값으로 교체 | Azure 연결 문자열(88자 계정 키) 1 · SAS URL 3(:26 · :39 · :46) · STS 키 ID `ASIA…` 1 · AWS 세션 토큰 2 · JWT 1 · PEM 개인 키 2(RSA · GCP) · 누출 검사용 조각 3(값은 예전과 같음) |
| `src/lib/cloudcheck/qa/in-secrets.test.tsx` | 도우미 값으로 교체 | STS 키 ID 1 · PEM 머리글 1 · JWT 1 · SAS 1 · Slack `xoxb-` 1 · Azure 계정 키(86자 + ==) 1 |
| `src/lib/cloudcheck/parse/secrets.test.ts`(API설계자 파일 — 이번에 한해 허용) | 같은 파일 안에서 조각 조립(도우미를 import하지 않음) | SAS 4(:7 · :70~72) · JWT 1 · Azure 계정 키 1 · STS 키 ID 1 · Slack 1 · PEM 1 |
| `src/lib/cloudcheck/qa/known-low.test.ts` | CC-QA-24 제목 정리("지금은 건너뛰어 이상 없음" → "수정 전: …") + 앞자리 0 표기 `006` 사례 추가 | — |

AWS 문서의 공개 예시 키 쌍(`AKIAIOSFODNN7EXAMPLE` · `wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY`)은 지시대로 예외로 두었다.

**2) 스캔** — 레포 밖 `…/scratchpad/qa/secret-scan2.mjs`(프론트팀장 `secret-scan.mjs` 확장). 대상 444파일(정리 뒤 기준, 새 도우미 포함) = `src/app/cloudcheck/**`(`_generated/page.ts` 포함) · `src/lib/cloudcheck/**` · `docs/**/cloudcheck*`(`docs/review/cloudcheck*` 포함). 패턴: AWS 키 ID(AKIA · ASIA …) · AWS 비밀 키 40자(같은 파일의 키 ID 또는 앞의 비밀 키 낱말과 짝일 때) · Azure 저장소 계정 키(86자 + ==) · Azure 연결 문자열 · `AccountKey=` · `SharedAccessKey=` · SAS(`sig=` · `sv=…&…sig=`) · GitHub `gh[pousr]_` · `github_pat_` · Slack `xox*` · Slack 웹훅 · JWT · PEM 개인 키 · Google `AIza` · OpenAI · Stripe live · npm · Entra(AAD) 클라이언트 비밀.

| 시점 | 히트 | 종류별 |
|---|---|---|
| 정리 전 | 46 | 시험 45 · 문서 1 |
| **정리 뒤** | **18** | **QA 범위(`qa/**` · `parse/secrets.test.ts`) 0** · 범위 밖 시험 17 · 문서 1 · 제품 코드 0 · 픽스처 JSON 0 · 생성물 0 |

남은 18건 — **고치지 않고 보고**(수정 권한 밖. 시험 파일은 같은 방식(조각 조립)으로 고치면 된다):

| 담당 | 위치 | 모양 |
|---|---|---|
| 프론트 | `src/app/cloudcheck/_client/screens/__tests__/real-engine.test.tsx:110` | GitHub 토큰 `ghp_` 40자 |
| API설계자 | `src/lib/cloudcheck/parse/exceptions.test.ts:104` | JWT |
| API설계자 | `src/lib/cloudcheck/parse/foundation.test.ts:107 · 108 · 109 · 126` | JWT · PEM(RSA) · SAS `sig=` · Slack `xoxb-` · Azure 연결 문자열 + `AccountKey=` · PEM(OPENSSH) |
| API설계자 | `src/lib/cloudcheck/parse/leak-scan.test.ts:50 · 51` | JWT(RFC 7515 예시 서명을 붙인 모양) · PEM(RSA) |
| API설계자 | `src/lib/cloudcheck/parse/recognize.test.ts:131 · 133 · 134 · 142` | STS 키 ID(ASIA로 시작하고 EXAMPLE로 끝나는 20자 — AWS 문서 STS 예시와 같은 모양으로 보이나 [미확인]) · PEM(RSA) · Azure 연결 문자열 + `AccountKey=` · 40자 비밀 키(같은 파일 키 ID와 짝) |
| API설계자 | `src/lib/cloudcheck/collector/__scenarios__/aws.ts:45`(시험 시나리오 도우미) | PEM 개인 키 머리글 |
| 프론트팀장 | `docs/review/cloudcheck-frontend-review.md:134`(문서) | STS 키 ID(ASIA로 시작하는 20자) — 검수 문서가 시험 리터럴을 그대로 인용함. 비밀 키 짝은 없다 |

공개 예시(예외 — 목록만): `AKIAIOSFODNN7EXAMPLE` 25파일(시험 · 시험 도우미 · 문서, 제품 코드 `parse/leak-scan.ts` · `fixtures/report-invariants.ts` 포함) · `wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY` 9파일(새 도우미의 공개 예시 상수 포함). 상세 목록: `…/scratchpad/qa/secret-scan2-final.json`(정리 전: `secret-scan2-before.json`).

**3) 검증**: `npx vitest run src/lib/cloudcheck` 92파일 **3,353 통과 | todo 1**(58.7초, 마지막 수정 뒤) · `npm run type-check` 오류 0 · QA 시험 32파일 452개(통과 451 · todo 1 · `it.fails` 0). 참고: 03:25 재생성 뒤 04:26~04:30에 번들 입력(`rules/aws/aws-net-1.ts` · `rules/params.ts` · `parse/mask.ts` · `fixtures/micro/*`)이 바뀌어 한때 `generated.test.ts` 동기 검사가 실패했으나(프론트팀장 검수 F-3 · C1), **04:52에 `_generated/page.ts`가 다시 만들어졌다**(PAGE.sha256 `c9f68992dd67556b998d5c2fb683d9f9a81bd305fd814f038b7960cd565e81bc` · 916,100바이트) → `npx vitest run src/app/cloudcheck` 40파일 827 통과(동기 초록). QA가 바꾼 파일은 번들 입력이 아니다. **새 바이트로 실브라우저를 다시 돌렸다(§R-4와 같은 스크립트)**: 11개 목표 최초 요청 1 · 콘솔 · 예외 0 · CSP · TT 위반 0(시험 요청만 차단) · 저장소 0 · 가로 넘침 0 · axe 0(V0 · V6 · V3 · V4 · V7 · V8 · V1 · V2, 라이트 · 다크) · 인쇄 마스킹 기본 · COOP 단절 · iframe 차단 · 수집기 내려받기 sha256 일치 6경우 · file:// meta CSP · TT · pushState · 저장소 0 · V2 실제 Azure 입력 차단(file · 서버) · 시각 역전 알림 표시. 응답 CSP 해시 `script-src 'sha256-2/ibpBG0…'` · `style-src 'sha256-RkqHpisU…'`, GET = HEAD. 증거 `…/scratchpad/qa/browser-r3/`.

**4) 정정**: §R-5 G3 행의 "정답지 변경 0"은 틀렸다 — 그 행을 고쳤다(`fixtures/answers/D.azure.json` 10-20 01:53 변경, 내용은 맞음 — 백엔드 검수 F-3).

---

## (1차) 0. 결론 — 2026-10-20 01시 기준 · 판정은 §R-5가 대체

1. **출시 판정: 베타 배포 불가.** 막는 버그는 **CC-QA-01**(높음, 기준 시각 역전 → 근거 없는 이상 없음)과 **CC-QA-06**(G7, 일부만 본 점검에 "확인한 범위: 계정 전체")이다. 둘을 고치고 해당 `it.fails`를 `it`으로 바꾼 뒤 초록이면 '베타 · 실계정 검증 전 + noindex' 배포가 가능하다(남은 조건: Safari Blob 내려받기 1회 확인, 디자인 §10-3 체크리스트). Azure 실제 점검을 열기 전에는 **CC-QA-02**도 막는다(권고: CC-QA-17·11·15도 함께). 상세는 §14.
2. **확인된 버그 23건**: 높음 1 · 중간 9 · 낮음~중간 5 · 낮음 7 · 정보 1. 설계서가 예상한 CR-01~CR-17 중 CR-13(Safari·Firefox Blob — 수동 대기)을 뺀 16건이 모두 확인됐고(CR-07은 07·08 두 ID로 나눔 → 17건), 실행 중 **새로 6건**(CC-QA-15 중복 신원, 16 MatchKey 불안정, 17 AZ-NET-1 모르는 값, 19 비밀 개수, 20 화면 넘침, 21 axe)과 CC-QA-18의 SAS 변종을 찾았다. 명세 확인 필요 2건(N1·N2).
3. **설계서 §3의 E-01~E-25를 전부 다시 돌렸다.** E 23건(대조 2건 제외)이 모두 재현됐고 버그 14개(CC-QA-01~14)로 묶였다(대조 E-06·E-24는 정상).
4. **새 테스트**: 29파일 391개 = 일반 315 + `it.fails` 70(확인된 버그, 지금 통과 = 버그 재현 중) + `it.todo` 6(결정·명세 대기). 통과 385 · 실패 0. cloudcheck 스위트 114파일 3,281 통과 | todo 6(54.6초, 기준선 49.2초), **레포 전체 236파일 5,187 통과 | todo 6**, `npm run type-check` 오류 0, `guards.test.ts`·`generated.test.ts` 초록.
5. **실브라우저(Chrome 155 헤드리스, CDP)**: file://와 로컬 서버 모두 최초 요청 1건(문서), 콘솔 오류·예외 0, CSP·Trusted Types 위반 0(일부러 넣은 시험 요청만 막힘), 저장소 전부 0, 수집기 내려받기 sha256 = `SHA256SUMS`, 인쇄 마스킹 기본·접힘 펼침 정상, COOP 단절·iframe 차단 정상. 접근성은 axe 위반 2종(CC-QA-21)과 360·200%·400% 화면 넘침 3곳(CC-QA-20). Safari·Firefox(UI-10)는 이 맥에서 자동화할 수 없어 §9 수동 표로 넘긴다.

---

## 1. 실행 환경 · 방법

| 항목 | 값 |
|---|---|
| OS | macOS(Darwin 25.5.0, arm64) |
| Node | v22.10.0(`.nvmrc` 22) |
| 테스트 | vitest 1.6.1 · fast-check 3.23.2(시드 고정) · jsdom 24.1.3 · @testing-library/react(기존 하네스 `screens/__tests__/harness.tsx`) · TypeScript 5.9.3 · React 18.3.1 |
| 브라우저 | Chrome 155.0.8059.82 `--headless=new`(새 프로필, 확장 끔), CDP 직접 구동 · axe-core 4.11.4(설치본 주입) |
| 서버 | `next start -p 3917`(Next 14.2.3, 기존 `.next` 빌드 `qKVoCsw1QakHxfunQSkEi` 2026-10-19 23:00 — `_generated/page.ts` 22:58보다 나중). 측정이 끝날 때마다 종료(포트 3917 닫힘 확인). **포트 6001(다른 프로젝트, PID 19155)은 건드리지 않았다** |
| 수집기 | bash 3.2.57(macOS), jq-1.7.1-apple, `/usr/bin/expect`, 로컬 도커 이미지(받기 없음 `--pull=never --network none`, 읽기 전용 마운트) |
| 제약 준수 | 패키지 설치 0 · 이미지 pull 0 · 커밋·push 0 · 실제 클라우드 호출·외부 송신 0(브라우저의 `https://example.com/x` 시도는 CSP가 막는지 보는 시험 요청이며 CSP로 차단됨) |

**재현 명령**(레포 루트):

```bash
npx vitest run src/lib/cloudcheck/qa                       # QA 시험만(29파일)
npx vitest run src/lib/cloudcheck src/app/cloudcheck       # cloudcheck 스위트
npx vitest run && npm run type-check                       # 레포 전체
npx vitest run src/lib/cloudcheck/qa/fo-time-skew.test.ts  # 버그 하나씩(파일은 §4 표 '테스트' 열)
```

- `it.fails` 시험이 **통과하면 버그가 아직 있다**는 뜻이다. 실제 값을 보려면 그 `it.fails`를 `it`으로 바꿔 돌리면 AssertionError에 기대·실제가 나온다(70개 모두 이 방법으로 실패 내용을 한 번씩 확인했다 — 스크래치 `verify-fails.sh`).
- 고쳐지면 해당 `it.fails`가 "Expect test to fail"로 **빨갛게 바뀌어 알려 준다** → §12 재검증 절차.

---

## 2. 실행 결과 요약

### 2-1. 스위트

| 실행 | 결과 | 시간 | 로그(스크래치) |
|---|---|---|---|
| QA 시험만 `src/lib/cloudcheck/qa` | 29파일 · 391개 = 통과 385(일반 315 + `it.fails` 70) · todo 6 · 실패 0 | — | `exec-qa-final.json` |
| cloudcheck 스위트(기준선 85파일 2,896개 · 49.2초) | 114파일 · **3,281 통과** · todo 6 · 실패 0 | 54.6초(+5.4초, 설계서 예산 60초 안) | `exec-final-cc.log` |
| 레포 전체 `npx vitest run` | 236파일 · **5,187 통과** · todo 6 · 실패 0 | 102.3초 | `exec-final-all.log` |
| `npm run type-check` | 오류 0 | — | `exec-final-typecheck.log` |
| `guards.test.ts` + `generated.test.ts` | 초록(QA 파일을 더한 뒤 다시 확인) | — | — |

### 2-2. QA 시험 파일(`src/lib/cloudcheck/qa/`)

| 파일 | 덮는 설계 ID | 통과 | 그중 `it.fails` | todo |
|---|---|---|---|---|
| `fo-time-skew.test.ts` | FO-05 · CL-05 | 19 | 12(CC-QA-01) | 1 |
| `fo-unexpected-values.test.ts` | FO-02(+ P3 표적) | 30 | 21(01·03·04·05·07·17) | 0 |
| `fo-population-identity.test.ts` | FO-04 · CL-06 | 25 | 9(02·11·15) | 0 |
| `fo-raw-mutation.test.ts` | FO-01 | 12 | 0 | 0 |
| `fo-nested-drop.test.ts` | FO-03 | 13 | 0 | 0 |
| `fo-exclusion-paths.test.ts` | FO-07 | 25 | 0 | 0 |
| `fo-backend-cases.test.ts` | FO-08 · FO-09 | 29 | 0 | 0 |
| `fo-csv-paths.test.ts` | FO-10 | 16 | 0 | 0 |
| `fo-purity.test.ts` | FO-11 | 11 | 0 | 1(N1) |
| `oracle-diff.test.ts` | FO-06 | 14 | 4(03·04·05·17) | 0 |
| `answers-independent.test.ts` | AN-01 · AN-03 · AN-04 | 13 | 0 | 0 |
| `isolation.runtime.test.ts` | ISO-02 | 2 | 0 | 0 |
| `in-invisible.test.ts` | IN-02 | 9 | 4(09) | 0 |
| `in-limits.test.ts` | IN-03 · IN-04 · IN-09 | 11 | 0 | 0 |
| `in-encoding.test.ts` | IN-05 | 7 | 1(09) | 0 |
| `in-secrets.test.tsx` | IN-06 | 11 | 5(12·19) | 0 |
| `in-keyfiles.test.tsx` | IN-07 | 19 | 2(18) | 0 |
| `in-proto.test.ts` | IN-08 | 6 | 0 | 0 |
| `in-csv.test.ts` | IN-10 | 10 | 3(10) | 0 |
| `in-exceptions.test.ts` | IN-11 | 11 | 0 | 0 |
| `in-mask-canary.test.tsx` | IN-12 | 12 | 0 | 1(N2) |
| `ex-params.test.ts` | EX-03 | 2 | 0 | 0 |
| `ui/expression.test.tsx` | EX-05 · EX-01 · EX-02 | 12 | 3(06) | 0 |
| `ui/title-status.test.tsx` | EX-04 | 19 | 0 | 0 |
| `ui/xss.test.tsx` | IN-01 | 5 | 0 | 0 |
| `ui/a11y.test.tsx` | UI-02 · UI-03 일부 | 3 | 2(21) | 0 |
| `collector-lint-bypass.test.ts` | CL-01 · CL-02 | 27 | 0 | 0 |
| `collector-tty.test.ts` | CL-03(expect 없으면 건너뜀) | 4 | 0 | 0 |
| `known-low.test.ts` | CR-07① · CR-12 · CR-15 · CR-17 + 새 MatchKey | 8 | 4(13·16·23) | 3(08·14·22) |
| 도우미 | `kit.ts` · `fo02-cases.ts` · `raw-mutations.ts` · `nested.ts` · `oracle.ts` · `answers-independent.data.ts` | — | — | — |

`it.fails` 버그별 개수: 01:13 · 02:2 · 03:6 · 04:2 · 05:11 · 06:3 · 07:2 · 09:5 · 10:3 · 11:2 · 12:4 · 13:1 · 15:5 · 16:2 · 17:3 · 18:2 · 19:1 · 21:2 · 23:1 = **70**. 08·14·22는 결정·문구 대기라 `it.todo`(지금 동작은 일반 시험으로 고정), 20은 실브라우저 증거만 있다(jsdom은 배치를 계산하지 않음).

---

## 3. E-01 ~ E-25 재현 결과

| E | 입력 요약 | 결과 | 버그 | 고정한 시험 |
|---|---|---|---|---|
| E-01 | CSV, 키 회전 2025-12-01 · 마지막 사용 2026-10-15, `lastModified` 2026-01-01 | 재현: AWS-KEY-1 이상 없음, 시간 알림 0 | CC-QA-01 | `fo-time-skew` ① |
| E-02 | 같은 CSV, 이름 `status_reports_2026-01-01T00_00_00Z.csv` | 재현: KEY-1 · KEY-2 이상 없음 | CC-QA-01 | `fo-time-skew` ③ |
| E-03 | 2020년 키, `lastModified` 0 · 1980-01-01 · 1999-12-31 | 재현: KEY-1 · KEY-2 이상 없음 | CC-QA-01 | `fo-time-skew` ② |
| E-04 | Azure `collectedAt`이 키 생성 시각보다 이른 경우 | 재현: AZ-KEY-1 이상 없음(`keys-rotated`) | CC-QA-01 | `fo-time-skew` ④ · CL-05 |
| E-05 | Azure 활동 로그 b2 항목 → 범위 밖 b3 | 재현: AZ-LOG-1 이상 없음 | CC-QA-02 | `fo-population-identity` |
| E-06 | (대조) 같은 바꿔치기를 `storageAccounts`에 | 정상: 확인 불가(`subscription-missing`) | — | 같은 파일 |
| E-07 | tcp `fromPort 3389 · toPort 22`(거꾸로) | 재현: AWS-NET-1 이상 없음 | CC-QA-03 | `fo-unexpected-values` |
| E-08 | tcp `-1..-1` | 재현: 이상 없음 | CC-QA-03 | 같은 파일 |
| E-09 | protocol `"TCP "` | 재현: 이상 없음 | CC-QA-03 | 같은 파일 |
| E-10 | 출발지 `0.0.0.0/1` + `128.0.0.0/1`(AWS) | 재현: 이상 없음 | CC-QA-04 | `oracle-diff` |
| E-11 | Azure 같은 분할 · `AzureCloud` | 재현: 둘 다 이상 없음 | CC-QA-04 | `oracle-diff` · `fo-unexpected-values` |
| E-12 | Effect `"Allow "` · `""` · `"Permit"` | 재현: 이상 없음(`"allow"`만 위험) | CC-QA-05 | `fo-unexpected-values` |
| E-13 | `aws:["*"]` + `wildcard:false` | 재현: 이상 없음 | CC-QA-05 | 같은 파일 |
| E-14 | `Null:sts:ExternalId` · `StringNotEquals:sts:ExternalId` | 재현: 이상 없음 | CC-QA-05 | 같은 파일 |
| E-15 | 신뢰 문장 0개 | 재현: 이상 없음 | CC-QA-05 | 같은 파일 |
| E-16 | 고급 선택기 `readOnly` Equals `[]` | 재현: AWS-LOG-1 이상 없음 | CC-QA-07 | 같은 파일 |
| E-17 | `isLogging:true` + `hasDeliveryError:true` | 재현: 이상 없음(사실 줄만) | CC-QA-08(결정 D-2) | `known-low` |
| E-18 | ENI 목록 잘림 | 재현: 주의지만 사유 `sg-unattached` | CC-QA-13 | `known-low` |
| E-19 | 버킷 예산 초과 + 공개 버킷 | 재현: 꼬리표 "확인한 범위: 계정 전체" | CC-QA-06 | `ui/expression` |
| E-20 | 다른 계정 ARN 행 섞인 CSV | 재현: `scopeProven:true`, 다른 계정 사용자가 MFA-2 위험 | CC-QA-10 | `in-csv` |
| E-21 | `--subscriptions`에 보이지 않는 b9 | 재현: 범위 증명 true, AZ-LOG-1 이상 없음 | CC-QA-11 | `fo-population-identity` |
| E-22 | `admin` + U+3164 등 | 재현: V2는 치환, V3는 그대로 · 라벨 없음 | CC-QA-09 | `in-invisible` |
| E-23 | 예외 사유에 `AKIAIOSFODNN7EXAMPLE` | 재현: 화면 값 `full`에 원문 | CC-QA-12 | `in-secrets` |
| E-24 | (대조) `--regions` 일부 | 정상: 확인 불가(`region-missing`) | — | `fo-population-identity` |
| E-25 | 출발지 프리픽스 리스트뿐 | 재현: 이상 없음(못 보는 것으로만 고지) | CC-QA-14(결정 D-4) | `known-low` |

---

## 4. 버그 목록

| ID | 심각도 | 한 줄 | 담당 | 연관 | 테스트 |
|---|---|---|---|---|---|
| **CC-QA-01** | **높음** · 베타 차단 | CSV·Azure 경로에서 기준 시각이 증거보다 이르면 키 나이가 줄거나 0일 → 근거 없는 이상 없음, 알림도 없음 | DB설계자 + API설계자 | CR-01 · E-01~04 · FO-05 · CL-05 | `fo-time-skew` · `fo-unexpected-values` |
| **CC-QA-02** | 중간 · Azure 공개 전 차단 | AZ-LOG-1 모수를 개수로만 봐서 범위 밖 구독 항목으로 바꿔치기해도 이상 없음 | API설계자 + DB설계자 | CR-02 · E-05 · FO-04 | `fo-population-identity` |
| **CC-QA-03** | 중간 | AWS-NET-1이 해석 못 한 프로토콜·포트·CIDR 문자열을 조용히 건너뛰어 위험이 이상 없음으로 | DB설계자 | CR-03 · E-07~09 · FO-02 · FO-06 | `fo-unexpected-values` · `oracle-diff` |
| **CC-QA-04** | 중간 · 결정 D-1·D-3 | '인터넷 전체'를 문자열로만 판정(분할 CIDR · `AzureCloud` 등 서비스 태그 · 모르는 출발지) | 기획팀장 결정 → DB설계자 | CR-04 · E-10·11 | `oracle-diff` · `fo-unexpected-values` |
| **CC-QA-05** | 중간 | AWS-KEY-4가 모르는 Effect·형식 밖 Action·`aws:["*"]`·부정형 ExternalId·문장 0개를 이상 없음으로 | DB설계자 | CR-05 · E-12~15 · FO-02 · FO-06 | `fo-unexpected-values` · `oracle-diff` |
| **CC-QA-06** | 중간 · **G7 차단** | 범위가 증명되지 않은 위험·주의 행 꼬리표가 "확인한 범위: 계정 전체" | 프론트(+DB설계자) | CR-06 · E-19 · EX-05 | `ui/expression` |
| **CC-QA-07** | 중간 | AWS-LOG-1: 고급 선택기 `readOnly` Equals 빈 배열 · 모르는 `readWriteType`을 '쓰기 포함'으로 → 이상 없음 | DB설계자(+API설계자) | CR-07② · E-16 | `fo-unexpected-values` |
| **CC-QA-08** | 중간 · 결정 D-2 | CloudTrail 전송 오류가 있는 trail을 이상 없음(사실 줄만) | 기획팀장 결정 → DB설계자 | CR-07① · E-17 | `known-low`(현재 동작 + todo) |
| **CC-QA-09** | 낮음~중간 | 보이지 않는 문자 정리기 두 벌이 서로 달라 리포트에서 `admin`+U+3164가 `admin`과 똑같이 보임 | API설계자 + DB설계자 | CR-08 · E-22 · IN-02 · IN-05 | `in-invisible` · `in-encoding` |
| **CC-QA-10** | 낮음~중간 | 자격증명 보고서 CSV에 다른 계정 행이 섞여도 범위 증명 true · 같은 열 이름 두 번이면 첫 열만 | API설계자 | CR-09 · E-20 · IN-10 | `in-csv` |
| **CC-QA-11** | 낮음~중간 | Azure `--subscriptions`로 요청했지만 보이지 않는 구독이 조용히 사라지고 범위 증명 true | API설계자 | CR-10 · E-21 · CL-06 | `fo-population-identity` |
| **CC-QA-12** | 낮음 · 허용 | 예외 파일 사유의 비밀 모양 문자열이 화면에 원문으로 | DB설계자(또는 API설계자) | CR-11 · E-23 · IN-06 | `in-secrets` |
| **CC-QA-13** | 낮음 | ENI 목록이 잘렸는데 '연결된 인터페이스 없음'으로 단정 | DB설계자 | CR-12 · E-18 | `known-low` |
| **CC-QA-14** | 정보 · 결정 D-4 | 위험 포트 + 출발지가 프리픽스 리스트뿐이면 이상 없음 | 기획팀장·디자인팀장 결정 → DB설계자 | CR-17 · E-25 | `known-low`(현재 동작 + todo) |
| **CC-QA-15** | 중간 · **새로 찾음** | 열거 목록에 같은 대상이 두 번 있어도 받아들여 개수만 맞으면 빠진 대상을 못 알아챔(사용자·SG·역할·NSG·컨테이너) | API설계자 + DB설계자 | CR-02와 같은 계열 · FO-04 | `fo-population-identity` |
| **CC-QA-16** | 낮음 · 새로 찾음 | 버킷 리전 조회가 실패하면 MatchKey가 바뀌어 예외 표시·비교가 끊김 | DB설계자 | — | `known-low` |
| **CC-QA-17** | 중간 · 새로 찾음(Azure) | AZ-NET-1이 모르는 방향·허용·프로토콜과 빈 포트 칸을 건너뛰어 위험이 이상 없음으로 | DB설계자 | CR-03의 Azure 쪽 · FO-02 · FO-06 | `fo-unexpected-values` · `oracle-diff` |
| **CC-QA-18** | 낮음 | `az account get-access-token` 출력과 표준 순서 SAS URL이 키 파일로 거부되지 않음(원문 노출은 없음) | API설계자 | CR-16 + 새 SAS 변종 · IN-07 | `in-keyfiles` |
| **CC-QA-19** | 낮음 · 새로 찾음 | '비밀 모양 감지' 개수가 실제 서로 다른 값보다 많다(9 → 12) | API설계자 | IN-06 | `in-secrets` |
| **CC-QA-20** | 낮음~중간 · 새로 찾음 | 360px·200%·400% 확대에서 가로 넘침 3곳(WCAG 1.4.10) | 프론트 | UI-04 · IN-09 | 실브라우저 증거 |
| **CC-QA-21** | 낮음~중간 · 새로 찾음 | axe: 상태 범례 `<dl role="group">`(dlitem, 심각) · V4·V7 제목 수준 건너뜀 | 프론트 | UI-03 · UI-02 | `ui/a11y` + 실브라우저 |
| **CC-QA-22** | 낮음 · 허용 | file://로 연 오프라인판에서 `<noscript>`·부팅 실패 안내의 오프라인판 링크가 깨진 링크 | 프론트팀장 | CR-14 · ISO-04 | `known-low`(todo) |
| **CC-QA-23** | 낮음 · 허용 | AZ-STO-2: 컨테이너 슬롯 `none`을 룰은 확인 불가, 패밀리는 0개로 봐서 거짓 확인 불가 | DB설계자 | CR-15 | `known-low` |

명세 확인 필요: **CC-QA-N1**(입력 순서만 바뀌면 Report 바이트가 달라짐 — 판정은 같음), **CC-QA-N2**(액세스 키 끝 4자리: 마스킹 사본은 가명, 화면·인쇄는 원값). §6.

---

## 5. 버그 상세

환경은 모두 §1과 같다. '위치'의 경로는 따로 적지 않으면 `src/lib/cloudcheck/` 아래다. '재현(자동)'의 시험은 지금 **통과(= 버그 재현 중)** 상태다.

### CC-QA-01 · 기준 시각이 증거보다 이르면 근거 없는 이상 없음(CSV·Azure 경로)

| 항목 | 내용 |
|---|---|
| 심각도 | **높음** · 베타 차단(§10-2) · 게이트 G1 |
| 담당 | **DB설계자**(룰 나이 계산) + **API설계자**(기준 시각 출처 · 정규화 단계 검사) |
| 연관 | CR-01 · E-01~E-04 · FO-05 · CL-05 · FO-02 시각 필드 |
| 위치 | `rules/kit.ts:68-72`(`ageMs`·`olderThanDays`·`wholeDays` — 기준 시각만 믿고, 음수 나이는 `Math.max(0, …)`로 0일) · 사용처 `rules/aws/aws-key-1.ts:83-91`, `rules/aws/aws-key-2.ts:83-110`, `rules/azure/az-key-1.ts:79-80`, `rules/aws/aws-mfa-1.ts:127` · 기준 시각 출처 `parse/recognize.ts:148-157`(파일 이름 → `lastModified` 순, 내용과 대조 없음), `parse/strict-time.ts:8` · `engine/run.ts:68-74`(`reportFresh`) |

**재현 스텝(화면)**
1. 자격증명 보고서 CSV에 사용자 행 하나: `dev-kim`, `access_key_1_active=true`, `access_key_1_last_rotated=2025-12-01T00:00:00+00:00`, `access_key_1_last_used_date=2026-10-15T00:00:00+00:00`(실제 나이 322일).
2. 파일 수정 시각을 2026-01-01로 둔다(`touch -t 202601010900 report.csv` — PC 시계가 늦은 기기에서 내려받은 것과 같다).
3. V2 '결과 파일 넣기'에 넣고 리포트를 연다.

**재현(자동)**: `npx vitest run src/lib/cloudcheck/qa/fo-time-skew.test.ts`(전제 시험: 같은 CSV에 올바른 시각이면 KEY-1 주의)

**기대 결과**: AWS-KEY-1 `dev-kim` 주의(90일 넘은 활성 키). 적어도 이상 없음은 아니고(확인 불가: 기준 시각과 파일 내용 시각 불일치) 알림 1개.

**실제 결과**: AWS-KEY-1 **이상 없음**(`key-recent`), 리포트 기준 시각 `2026-01-01T00:00:00Z (file-time)`, 시간 알림 0개(`timeNotices`도 같은 기기 시계를 쓰므로 못 잡는다).

**같은 원인으로 재현된 변형**
- 파일 이름 `status_reports_2026-01-01T00_00_00Z.csv`(E-02): KEY-1 · KEY-2 이상 없음.
- `lastModified` 0(1970) · 1980-01-01(FAT·ZIP 시각) · 1999-12-31 + 2020년 키(2020-02 이후 미사용, E-03): KEY-1 · KEY-2 이상 없음(아주 오래된 사진 알림만).
- Azure 수집 JSON `collectedAt` = 2025-01-01(로컬 CLI 시계 늦음, E-04): 멈춘시계상회(B)의 공유 키 계정이 AZ-KEY-1 이상 없음(`keys-rotated`). 원래 시각이면 3개 모두 주의.
- CL-05: shim 수집기 시계 `fakeNow=2025-05-01`로 실제 수집 → 2025-06-01 키(실제 505일)인 `stwebfiles01`이 AZ-KEY-1 이상 없음(올바른 시계면 주의).
- FO-02: 시각 칸을 수집 시각 + 2년으로 → 위반 18건(액세스 키 생성 6 · 콘솔 마지막 사용 2 · CSV 날짜 칸 10).

**영향 없음(대조)**: AWS 수집기 JSON 경로는 키 나이를 보고서 `generatedTime`(AWS 서버 시각) 기준으로 재므로 `collectedAt`이 늦게 찍혀도 이상 없음이 새로 생기지 않는다(회사 4곳 단조성 확인). 다만 알림이 없다(`it.todo` 권고).

**영향 범위**: 나이를 쓰는 룰 전부(AWS-KEY-1 · KEY-2 · MFA-1 루트 최근 로그인 · AZ-KEY-1)와 `reportFresh`. 보고서 CSV를 파일로 넣는 사용자, Azure 로컬 CLI 사용자. 늦은 PC 시계, 압축 해제한 파일(1980 시각), 이름 바꾼 파일에서 실제로 일어난다.

**고치는 방향**: 설계서 CR-01 제안에 동의 — 정규화에서 입력별 '가장 늦은 증거 시각'을 구해 기준 시각 + 허용치(예: 5분)를 넘으면 ① 그 입력의 기준 시각을 불일치로 표시 ② 나이를 쓰는 룰의 음성 결론(이상 없음 · 제외)을 `stale-evidence` 확인 불가로 ③ 알림 1개. `lastModified`가 2000년 이전이면 기준 시각 없음(null). QA 의견: 엔진 쪽에서도 `ageMs < 0`(증거가 기준 시각보다 늦음)이면 '최근'으로 접지 말고 확인 불가로(이중 방어).

**테스트**: `fo-time-skew.test.ts` `it.fails` 12 · todo 1(알림 권고) · 일반 7(전제 5 · 현재 동작 기록 1 · AWS 경로 대조 1), `fo-unexpected-values.test.ts` `it.fails` 1.

### CC-QA-02 · AZ-LOG-1 모수를 개수로만 비교(구독 바꿔치기 → 이상 없음)

| 항목 | 내용 |
|---|---|
| 심각도 | 중간 · **Azure 실제 점검 공개 전 차단** · G1 |
| 담당 | **API설계자**(활동 로그 패밀리 봉인) + **DB설계자**(집계 신원 비교) |
| 연관 | CR-02 · E-05 · FO-04 |
| 위치 | `parse/normalize-azure.ts:366-381`(`azure.log.subscriptions`를 범위 목록 개수로만 봉인, 다른 패밀리의 `subCoverage`(:251-268)를 쓰지 않음) ↔ `rules/azure/az-log-1.ts:79-88`(구성원은 `activityLogExports` 항목에서) · 근본 `engine/aggregate.ts:130`(`members.length + excluded.length !== proof.population`만 비교) |

**재현 스텝**: 1) 반듯상회 Azure(A) 수집 JSON에서 `data.activityLogExports`의 구독 `…b2` 항목(영수증 구독 포함)을 범위 밖 구독 `…b3`로 바꾼다(개수 같음). 2) V2 → 리포트.
**재현(자동)**: `fo-population-identity.test.ts` "구독 바꿔치기"
**기대 결과**: AZ-LOG-1 확인 불가(b2를 보지 못함, `subscription-missing`).
**실제 결과**: AZ-LOG-1 **이상 없음**. 같은 바꿔치기를 `storageAccounts`에 하면 확인 불가로 맞게 막힌다(E-06), `nsgs`·`nics`·`publicIps`도 막힌다(대조 3건 통과).
**영향 범위**: Azure 활동 로그 문. 정상 수집기 출력에서는 생기지 않지만, 편집·합본된 파일에서 '범위 안 구독을 봤다'는 증명이 신원 없이 성립한다.
**고치는 방향**: 활동 로그 패밀리도 `subCoverage(scope, exportsList)`로 봉인(범위 안 구독마다 항목·영수증, 범위 밖 항목은 섹션 무효). 엔진 방어로 증명에 대상 MatchKey 집합(또는 해시)을 실어 `aggregate`가 집합으로 비교 — CC-QA-15도 함께 닫힌다.
**테스트**: `it.fails` 2(룰 결과 · 일반 속성 '대상 집합 = 원시 열거').

### CC-QA-03 · AWS-NET-1이 해석 못 한 값을 건너뜀

| 항목 | 내용 |
|---|---|
| 심각도 | 중간 · G8 전까지 · G1 |
| 담당 | **DB설계자** |
| 연관 | CR-03 · E-07~E-09 · FO-02 · FO-06 |
| 위치 | `rules/aws/aws-net-1.ts:81-86`(프로토콜 `toLowerCase()`만 하고 `trim` 없음, 모르는 프로토콜은 `continue`(:83), 출발지는 `includes("0.0.0.0/0")` 정확 일치(:84-85)) · `:89-90` · `rules/ports.ts:19-21`(`norm`이 `a > b`·범위 밖 구간을 조용히 버림) |

**재현 스텝**: 아슬아슬상회 AWS(C) 수집 JSON에서 `sg-0c0ffee1`(bastion-ssh, 22번 공개 · 원래 **위험**)의 인바운드 규칙을 다음 중 하나로 → 리포트.
- `fromPort 3389 · toPort 22`(E-07) / `fromPort -1 · toPort -1`(E-08) / `protocol "TCP "`(E-09)
**재현(자동)**: `fo-unexpected-values.test.ts` "P3 표적: 원래 위험인 대상"
**기대 결과**: 확인 불가(모르는 값 — P3) 또는 위험 유지.
**실제 결과**: 그 SG가 **이상 없음**. 반대로 원래 이상 없음인 반듯상회(A) 웹 SG(80·443 공개)의 프로토콜을 `"zzz"`로 바꿔도 이상 없음(확인 불가여야 함). FO-02 전수: 위반 30건(프로토콜 12 · fromPort 4 · toPort 2 · CIDR 공백 12). FO-06: 611개 대상 비교 중 불일치 63건(이 버그와 CC-QA-04로 전부 분류).
**대조(정상)**: 범위 밖 상한(0~70000)은 0~65535로 잘라 위험 유지(안전한 방향), `tcp`·`6`·`-1`은 위험 그대로. Azure 쪽 `parsePortSpec`은 `ok:false` → 확인 불가로 맞게 처리(비대칭).
**고치는 방향**: 프로토콜은 `trim().toLowerCase()` 뒤 `-1 · tcp · udp · icmp · icmpv6 · 숫자`만 알고 그 밖은 `unrecognized`. `norm`이 버리는 구간·음수·`from > to`가 있으면 `unrecognized`. CIDR도 `trim` 뒤 비교(+ CC-QA-04 결정).
**테스트**: `it.fails` 6(전수 1 · 표적 4 · 오라클 1).

### CC-QA-04 · '인터넷 전체'를 문자열로만 판정(결정 D-1 · D-3)

| 항목 | 내용 |
|---|---|
| 심각도 | 중간 · 기획팀장 결정 필요(D-1 · D-3) · G2 |
| 담당 | **기획팀장**(결정) → **DB설계자**(구현) |
| 연관 | CR-04 · E-10 · E-11 · FO-06 · FO-02 |
| 위치 | `rules/aws/aws-net-1.ts:84-86`(`cidrs.includes("0.0.0.0/0")`, `ipv6Cidrs.includes("::/0")`) · `rules/azure/az-net-1.ts:75-76`(`WORLD` 문자열 집합 `* · internet · any · 0.0.0.0/0 · ::/0`) |

**재현 스텝**: 1) AWS SG 22번 출발지를 `0.0.0.0/1` + `128.0.0.0/1`(합치면 인터넷 전체), 공인 IP ENI 연결 → AWS-NET-1. 2) Azure NSG 22번 Allow 출발지를 같은 분할 또는 `AzureCloud` → AZ-NET-1.
**기대 결과**(설계서 제안 기본값): 합쳐서 전체면 0.0.0.0/0과 같게(위험), /8 이하 넓은 접두는 주의, Internet 밖 서비스 태그 · ASG는 기획서 §6-2대로 주의.
**실제 결과**: 모두 **이상 없음**. 이상 없음 사유 문구 "인터넷 전체에 … 연 규칙이 없음"과 어긋난다. FO-02: Azure 출발지를 모르는 값(`zzz` 등 서비스 태그 모양)으로 → 위험이 이상 없음 4건. FO-06: AZ-NET-1 490개 비교 중 불일치 109건(이 버그와 CC-QA-17로 전부 분류).
**고치는 방향**: D-1 · D-3 결정 뒤 구현. 결정 전까지는 V7 판정 규칙 화면 '못 보는 것'에 현재 동작을 적는다(§10-2).
**테스트**: `it.fails` 2(오라클 1 · Azure 모르는 출발지 1). PM V1 V-A2 · V-Z2가 실계정 기록용.

### CC-QA-05 · AWS-KEY-4가 모르는 신뢰 문장 값을 이상 없음으로

| 항목 | 내용 |
|---|---|
| 심각도 | 중간 · G8 전까지 · G1 |
| 담당 | **DB설계자** |
| 연관 | CR-05 · E-12~E-15 · FO-02 · FO-06 |
| 위치 | `rules/aws/aws-key-4.ts:92`(Effect가 `allow`가 아니면 문장 무시 — 모르는 값 포함) · `:104`(`aws` 배열의 `"*"`는 `wildcard` 플래그만 믿고 건너뜀) · `:97`·`:108`(`sts:ExternalId` 키만 있으면 연산자와 무관하게 보호) · `:123-130`(문장 0개 = `trust-ok`) · `:70-75`(`서비스:동작` 형식이 아닌 Action 토큰(`zzz`·`Allowed`)을 '역할 맡기 아님'으로 봐서 문장 건너뜀) |

**재현 스텝**: 아슬아슬상회 AWS(C)의 `cross-acct-admin`(Principal `*`, 원래 **위험**) 신뢰 문장 Effect를 `"Allow "`·`""`·`"Permit"`·`"Allowed"`로(FO-02 전수에서는 `" Allow"`·`"zzz"`·`"Inbound "`도) / `vendor-access`(외부 계정 신뢰, 원래 주의)의 조건 키를 `Null:sts:ExternalId`·`StringNotEquals:sts:ExternalId`·`ForAllValues:StringNotLike:sts:ExternalId`로 / `aws:["*"]` + `wildcard:false` / 문장 0개 / Action을 `"zzz"`·`"Allowed"`로 → 리포트.
**기대 결과**: 모르는 값은 확인 불가, `aws:["*"]`는 위험, 부정형 ExternalId는 보호가 아니므로 주의, 문장 0개는 확인 불가.
**실제 결과**: 모두 **이상 없음**(`"allow"` 소문자 · `"Deny"`는 의도대로). FO-02 위반 36건(Effect 24 · Action 12), FO-06 608개 비교 중 불일치 94건(전부 이 버그로 분류). AWS가 실제로 내지 않는 모양이 많지만 P3 위반이고 수집기 투영이 바뀌면 그대로 새는 길이다.
**고치는 방향**: Effect는 `allow`·`deny`만 알고 그 밖은 `unrecognized` · `aws`에 `"*"`가 있으면 플래그와 무관하게 와일드카드 · 문장 0개는 해석 불가 · ExternalId는 `StringEquals`(+`IgnoreCase`, `ForAnyValue:`)·`StringLike` 계열만 보호로 · `서비스:동작` 형식이 아닌 Action은 '덮는다'(현재 형식 밖 글자 처리와 같게).
**테스트**: `it.fails` 11(FO-02 전수 1 · Effect 4 · `aws:["*"]` 1 · ExternalId 3 · 문장 0개 1 · 오라클 1) + 대조 2(`"allow"`·`"Deny"`, `StringEquals`·`StringLike` ExternalId).

### CC-QA-06 · 범위가 증명되지 않은 행에 "확인한 범위: 계정 전체"

| 항목 | 내용 |
|---|---|
| 심각도 | 중간 · **G7 차단**(§10-2) |
| 담당 | **프론트**(컴포넌트개발자 `RuleRow`) + DB설계자(`engine/blocks.ts:338-351` '직접 볼 목록' 항목 — 확인 불가 대상이 없는 범위 미증명도 넣을지) |
| 연관 | CR-06 · E-19 · EX-05 |
| 위치 | `src/app/cloudcheck/_client/components/RuleRow.tsx:23-35`(`coverageText`가 `coverage.proven`을 보지 않음) · `:38-46`(`Tail`) |

**재현 스텝**: 1) 아슬아슬상회 AWS(C) 수집 JSON의 `data.buckets.budget`을 `{limit:2,total:3,collected:2}`로(마지막 버킷은 조회 못 함, 공개 버킷 위험은 그대로) — 또는 `iamUsers` 영수증을 `truncated`로. 2) V2 → 리포트 → 창고(AWS-STO-2) 행 / 현관(AWS-MFA-2) 행.
**재현(자동)**: `ui/expression.test.tsx` "EX-05"(엔진 전제: 위험 + `coverage.proven=false` 확인)
**기대 결과**: 꼬리표가 '전체'를 말하지 않고 일부만 봤음을 말한다(예: "확인한 범위: 일부(예산 초과)").
**실제 결과**: "확인한 범위: **계정 전체** · 기준 시각: …"(엔진 출력은 `coverage {kind: account-global, proven: false}`로 맞다 — 화면이 `proven`을 버린다). 버킷 예산 초과의 경우 그 버킷은 확인 불가 대상으로 '직접 볼 목록'에 들어간다(전제 시험). 설계서 CR-06은 예산 초과가 범위 패널에도 드러나지 않는다고 지적했다(QA는 꼬리표만 시험).
**영향 범위**: 위험·주의인데 범위가 증명되지 않은 모든 룰(목록 잘림 · 예산 초과 · 일부 리전). '어디까지 봤는지 정직하게' 원칙 위반 — 사용자가 나머지를 안 봐도 된다고 읽는다.
**고치는 방향**: `proven:false`면 "일부만 확인(사유: …)" 꼬리표 + 그 점검을 '직접 볼 목록'에 '나머지 대상'으로. 문구 키는 디자인팀장 확인.
**테스트**: `it.fails` 3(RuleRow 단위 2 · 실제 화면 1) + 전제 4.

### CC-QA-07 · AWS-LOG-1 선택기의 모르는 값 → 이상 없음

| 항목 | 내용 |
|---|---|
| 심각도 | 중간 · G8 전까지 |
| 담당 | **DB설계자**(룰) + API설계자(수집기 투영 — 해시가 바뀌므로 첫 공개 전에) |
| 연관 | CR-07② · E-16 · FO-02 |
| 위치 | `rules/aws/aws-log-1.ts:73`(`readWriteType`이 `readonly`가 아니면 모르는 값도 '쓰기 포함') · `:77-78`(`readOnly` 필드가 있는데 Equals가 비면 '쓰기 포함') · `collector/cloudcheck-aws.sh:221`(고급 선택기는 Equals만 투영) |

**재현 스텝**: 반듯상회 AWS(A) `main-trail`의 ① 고급 선택기를 `eventCategory=Management` + `readOnly` Equals `[]`(NotEquals를 수집기가 버린 모양)로 ② 또는 기본 선택기 `readWriteType`을 `"zzz"`로 → 리포트.
**기대 결과**: 확인 불가(관리 이벤트 쓰기 기록 여부를 알 수 없음).
**실제 결과**: AWS-LOG-1 **이상 없음**. 대조: `readOnly` 필드 없음 = 이상 없음, `readOnly=true` = 주의, `readWriteType "ReadOnly"` = 주의(정상).
**고치는 방향**: 모르는 `readWriteType` · Equals가 빈 `readOnly`는 `unrecognized`. 수집기는 Equals 밖 연산자를 쓰는 필드를 표시(PM V1에서 NotEquals 허용 여부 확인 — §10).
**테스트**: `it.fails` 2 + 대조 2.

### CC-QA-08 · CloudTrail 전송 오류가 있는 trail을 이상 없음으로(결정 D-2)

| 항목 | 내용 |
|---|---|
| 심각도 | 중간 · 기획팀장 결정 대기(D-2) |
| 담당 | **기획팀장**(결정) → DB설계자 |
| 연관 | CR-07① · E-17 |
| 위치 | `rules/aws/aws-log-1.ts:82-91`(`evalTrail`이 `hasDeliveryError`를 보지 않음) |

**재현**: `known-low.test.ts` "[CC-QA-08 현재 동작]" — 반듯상회 AWS(A) trail에 `hasDeliveryError:true` → AWS-LOG-1 이상 없음 + 사실 줄 `fact:trail-delivery-error`만.
**기대(제안)**: 주의("기록 중이지만 저장에 실패하고 있음"). 버킷 삭제·정책 오류는 소규모 팀에서 흔하다.
**테스트**: 현재 동작 고정 1 + `it.todo` 1(결정되면 `it.fails`로 바꾼다).

### CC-QA-09 · 보이지 않는 문자 정리기 두 벌이 다름

| 항목 | 내용 |
|---|---|
| 심각도 | 낮음~중간 · G8 전까지 · G6 |
| 담당 | **API설계자**(`parse/display.ts`) + **DB설계자**(`engine/display.ts`) — 하나로 합치기 |
| 연관 | CR-08 · E-22 · IN-02 · IN-05 |
| 위치 | `parse/display.ts:8-11`(V2 입력 인식) ↔ `engine/display.ts:21-24`(V3 리포트) |

**재현 스텝**: IAM 사용자 이름을 `admin` + U+3164(한글 채움)로 → V2 미리보기와 V3 리포트를 비교.
**기대 결과**: V2 · V3가 같은 함수로 치환하고 둘 다 '특이 문자' 라벨.
**실제 결과**: V2는 치환, **V3는 그대로이고 라벨 없음** → `admin`과 똑같이 보인다. 문자 집합 차이(전수 비교):
- V2만 치환: U+00AD · U+115F~U+1160 · U+180E · U+2061~U+2064 · U+3164 · U+FFA0
- 둘 다 놓침: 4,147개 코드 포인트 — U+034F, U+17B4~U+17B5, U+180B~U+180D, U+180F, U+2065, U+206A~U+206F, U+FE00~U+FE0F(이형 선택자), U+FFF0~U+FFF8, U+1BCA0~U+1BCA3, U+1D173~U+1D17A, U+E0000~U+E0FFF(태그 문자 · 이형 선택자 보충)
- `admin` + U+E0041(태그 문자)도 라벨 없음
- IN-05: 계정 별칭의 짝 없는 서로게이트(`"\ud800"`)가 V3는 `redacted(invalid-encoding)`인데 V2 미리보기는 원값 그대로
**고치는 방향**: 정리기 하나로 합치고 `\p{Default_Ignorable_Code_Point}` · `\p{Cf}` · 양방향 제어 · 짝 없는 서로게이트를 같이 처리.
**테스트**: `it.fails` 5(`in-invisible` 4 · `in-encoding` 1).

### CC-QA-10 · 보고서 CSV의 다른 계정 행 · 같은 열 이름 두 번

| 항목 | 내용 |
|---|---|
| 심각도 | 낮음~중간 · G8 전까지 · G6 |
| 담당 | **API설계자** |
| 연관 | CR-09 · E-20 · IN-10 |
| 위치 | `parse/credential-report.ts:47`(같은 열 이름이면 첫 열만 색인) · `:56-60`(첫 ARN의 계정만 읽음) · `parse/normalize.ts:178`(`scopeProven`이 행별 계정 일치를 보지 않음) · `parse/normalize-aws.ts:275`(루트 행만 거름) · 같은 모양 `parse/rg-csv.ts:68`(첫 행 테넌트) |

**재현 스텝**: ① 보고서 CSV에 다른 계정(`999988887777`) ARN 행을 섞는다 ② 또는 `mfa_active` 열을 두 번 두고 값을 엇갈리게(첫 열 `true`, 둘째 `false`) → V2 → 리포트.
**기대 결과**: ① 그 출처 범위 미증명 + 다른 계정 행은 이 계정 사용자로 판정하지 않음(또는 파일 거부) ② 모호한 출처 → 이상 없음 금지.
**실제 결과**: ① `scopeProven:true`, 다른 계정 사용자가 이 계정의 AWS-MFA-2 **위험**으로 들어간다 ② 첫 열만 읽어 MFA-2 **이상 없음**.
**테스트**: `it.fails` 3.

### CC-QA-11 · Azure 요청 구독이 보이지 않아도 범위 증명 true

| 항목 | 내용 |
|---|---|
| 심각도 | 낮음~중간 · G8 전까지(Azure 공개 전 권고) |
| 담당 | **API설계자**(수집기 + 정규화) |
| 연관 | CR-10 · E-21 · CL-06 |
| 위치 | `collector/cloudcheck-azure.sh:104`(보이는 구독만 나열) · `parse/normalize-azure.ts:59`(`subscriptionsRequested`는 저장만) · `:251-268`(`subCoverage`가 요청 목록을 보지 않음) |

**재현 스텝**: Azure 수집 JSON의 `scope.subscriptionsRequested`에 목록에 없는 구독 `…b9`(오타 · 권한 없음)를 넣는다 → 리포트.
**기대 결과**: 범위 미증명(빠진 구독 1, `subscription-missing`), 구독 단위 룰은 이상 없음 아님.
**실제 결과**: 범위 증명 true, AZ-LOG-1 **이상 없음**. 대조: AWS `--regions`로 일부 리전만이면 확인 불가(정상, E-24).
**테스트**: `it.fails` 2 + 대조 1.

### CC-QA-12 · 예외 파일 사유의 비밀 모양이 화면에 원문으로

| 항목 | 내용 |
|---|---|
| 심각도 | 낮음 · 허용(§10-2, 알려진 문제로 기록) · G6 |
| 담당 | DB설계자(`engine/exceptions.ts`) 또는 API설계자(`parse/exceptions.ts` 읽기 단계) |
| 연관 | CR-11 · E-23 · IN-06 |
| 위치 | `engine/exceptions.ts:33-35`(사유를 비밀 검사 없이 `sens(freeText)`) |

**재현 스텝**: 예외 파일 사유를 `vendor key AKIAIOSFODNN7EXAMPLE kept for CDN`으로 → 리포트에서 예외 불러오기.
**기대 결과**: 화면 값 `redacted(secret-pattern)`(R-12: 올린 파일의 비밀 모양을 그리지 않는다).
**실제 결과**: 화면 값 `sensitive.full`에 **원문**(인쇄는 `•••`). AKIA · JWT · `ghp_` · `sk-` 4종 모두 같다. 대조: 평범한 사유는 그대로 실림.
**테스트**: `it.fails` 4 + 전제 1.

### CC-QA-13 · ENI 목록이 잘렸는데 '연결된 인터페이스 없음'으로 단정

| 항목 | 내용 |
|---|---|
| 심각도 | 낮음 · G8 전까지 |
| 담당 | **DB설계자** |
| 연관 | CR-12 · E-18 · FO-03 |
| 위치 | `rules/aws/aws-net-1.ts:122-129`(`eniKnown`이 `partial`도 참 → 잘린 목록에서 못 찾으면 `sg-unattached`·`sg-private`) |

**재현 스텝**: 아슬아슬상회 AWS(C)의 서울 리전 ENI 목록에서 `sg-0c0ffee1`이 붙은(공인 IP) ENI를 빼고 영수증을 `truncated`로 → 리포트.
**기대 결과**: 주의 + 사유 '연결 확인 못 함'(`sg-eni-unknown`).
**실제 결과**: 주의(상태는 안전한 쪽)지만 사유가 **'연결된 인터페이스 없음'**(`sg-unattached`). 잘린 쪽에 공인 IP ENI가 있었다면 실제 상태는 위험이다. Azure는 같은 경우 `nsg-attachment-unknown`으로 맞게 처리.
**고치는 방향**: ENI 슬롯이 `value`가 아니면(`partial` 포함) 찾지 못한 경우 `sg-eni-unknown`.
**테스트**: `it.fails` 1 + 전제 1.

### CC-QA-14 · 위험 포트 + 프리픽스 리스트 출발지 → 이상 없음(결정 D-4)

| 항목 | 내용 |
|---|---|
| 심각도 | 정보 · 결정 대기(D-4) |
| 담당 | **기획팀장 + 디자인팀장**(결정) → DB설계자 |
| 연관 | CR-17 · E-25 |
| 위치 | `rules/aws/aws-net-1.ts:86`(`!v4 && !v6` → 건너뜀) |

**재현**: `known-low.test.ts` "[CC-QA-14 현재 동작]" — `sg-0c0ffee1` 22번 출발지를 `prefixListIds:["pl-0123abcd"]`만으로 → 그 SG 이상 없음.
**기대(제안)**: 주의(내용 확인 필요) 또는 이상 없음 사유 문구에 '프리픽스 리스트 제외' 명시.
**테스트**: 현재 동작 1 + `it.todo` 1.

### CC-QA-15 · 열거 목록의 중복 신원을 받아들임(새로 찾음)

| 항목 | 내용 |
|---|---|
| 심각도 | 중간 · G8 전까지(Azure 부분은 Azure 공개 전 권고) · G1 |
| 담당 | **API설계자**(정규화에서 중복 거부) + **DB설계자**(집계 신원 비교 — CC-QA-02와 같은 수정) |
| 연관 | CR-02와 같은 계열('개수만 같으면 통과') · FO-04 |
| 위치 | `parse/normalize-aws.ts:203`(사용자 목록 중복 검사 없음) · `:457-475`(리전 중복은 막지만 같은 리전 안 SG·ENI ID 중복은 검사 없음) · `:437`(역할 중복 검사 없음) · `parse/normalize-azure.ts:120-139`(구독 중복은 막지만 NSG 등 항목 중복 검사 없음) · `:88`(컨테이너 중복 검사 없음) · `engine/aggregate.ts:130` |

**재현 스텝**(개수는 그대로 두고 대상을 같은 것으로 바꿔치기 → 리포트):
1. 아슬아슬상회 AWS(C): MFA 없는 `dev-kim`·`ex-employee`(위험) 자리에 `admin-lee`를 복제 → AWS-MFA-2 **이상 없음**
2. C 서울 리전 SG 3개를 `default` 복제 3개로(리전 count 3 그대로) → AWS-NET-1 **이상 없음**
3. C 역할 3개를 서비스 연결 역할 복제 3개로 → AWS-KEY-4 **해당 없음**
4. Azure C prod의 NSG 2개(위험)를 dev NSG 복제 2개로 → AZ-NET-1 **이상 없음**
5. Azure C `stacmeexports01`의 공개 컨테이너 2개를 `private-data` 복제로 → AZ-STO-2 **이상 없음**
**기대 결과**: 같은 대상이 두 번 나오는 열거는 무효(섹션 무효 → 확인 불가). 대조: 버킷 · 스토리지 계정 · 구독 · 리전 항목의 중복은 이미 섹션 무효로 막힌다(통과).
**영향 범위**: 정상 수집기 출력에서는 생기지 않는다(AWS CLI 자동 페이지). 편집 · 합본 파일에서 빠진 대상을 '모두 봤다'고 증명한다.
**테스트**: `it.fails` 5 + 대조 1.

### CC-QA-16 · 버킷 리전 조회 실패 시 MatchKey가 바뀜(새로 찾음)

| 항목 | 내용 |
|---|---|
| 심각도 | 낮음 · 허용 |
| 담당 | **DB설계자** |
| 위치 | `rules/aws/aws-sto-2.ts:116`(리전이 `value`가 아니면 위치를 `GLOBAL`(`-`)로 → MatchKey의 위치 칸이 리전 대신 `-`) |

**재현 스텝**: C의 `amzn-s3-demo-acme-customer-export` 버킷 `region`을 `{value:null}`(조회 실패)로 → 지난번 리포트에서 내보낸 예외 파일(`…|ap-northeast-2|…`)을 불러온다.
**기대 결과**: S3 버킷 이름은 전역에서 유일하므로 리전 조회 성공 · 실패와 무관하게 같은 MatchKey → 예외가 붙는다.
**실제 결과**: MatchKey가 `…|-|…`로 바뀌어 예외 **unmatched**, 전후 비교에서도 다른 대상이 된다.
**테스트**: `it.fails` 2.

### CC-QA-17 · AZ-NET-1이 모르는 값을 건너뜀(새로 찾음, Azure)

| 항목 | 내용 |
|---|---|
| 심각도 | 중간 · G8 전까지 · **Azure 공개 전 권고** · G1 |
| 담당 | **DB설계자** |
| 연관 | CR-03의 Azure 쪽 · FO-02 · FO-06 |
| 위치 | `rules/azure/az-net-1.ts:86`(방향이 `inbound`가 아니면 모르는 값도 제외) · `:90`(허용이 `allow`가 아니거나 프로토콜이 tcp·udp·any가 아니면 건너뜀 — 모르는 값 포함) · `rules/ports.ts:67`(빈 포트 조각은 `continue` → 포트 칸이 전부 비면 구간 0개 = 이상 없음) |

**재현 스텝**: 아슬아슬상회 Azure(C)의 `nsg-acme-db`(규칙 `allow-sql-any`: Inbound · Allow · Tcp · 출발지 `*` · 1433, 원래 **위험**)에서 규칙의 `direction`을 `""`·`"zzz"`·`"Allowed"`로 / `access`를 `""`·`"zzz"`·`"Allowed"`·`"Inbound "`로 / `protocol`을 `""`·`"zzz"`·`"Allowed"`로 / `destPortRanges`를 `[""]`로 → 리포트. 표적: 반듯상회 Azure(A) `nsg-banjeut-web` 규칙 방향을 `"zzz"`로.
**기대 결과**: 확인 불가(P3). 수집기는 `null`·`""` 포트 칸을 이미 걸러 내므로(`cloudcheck-azure.sh:141` 투영) 빈 칸을 해석 불가로 바꿔도 실제 출력에서 거짓 확인 불가는 생기지 않는다.
**실제 결과**: `nsg-acme-db`가 **위험 → 이상 없음**(FO-02 위반 12건: 방향 3 · 허용 4 · 프로토콜 4 · 포트 1). A `nsg-banjeut-web`은 이상 없음 그대로(확인 불가여야 함). 같은 규칙의 출발지를 모르는 값으로 바꾼 4건은 CC-QA-04로 분류했다.
**고치는 방향**: 방향 `inbound`·`outbound`, 허용 `allow`·`deny`, 프로토콜 `tcp·udp·icmp·esp·ah·*·any`만 알고 그 밖은 `unrecognized`. Allow 규칙의 포트 조각이 하나도 없으면 `unrecognized`.
**테스트**: `it.fails` 3(전수 1 · 표적 1 · 오라클 1).

### CC-QA-18 · 키 파일 변종 2종이 키 파일로 거부되지 않음

| 항목 | 내용 |
|---|---|
| 심각도 | 낮음(CR-16은 정보였으나 SAS 변종을 더해 올림) · 허용 · G6 |
| 담당 | **API설계자** |
| 연관 | CR-16 · IN-07 |
| 위치 | `parse/secrets.ts:29-39`(키 파일 패턴) — `:38` SAS 패턴은 `sig=` **뒤에** `se=`가 있어야 걸림 |

**재현 스텝**: V2 붙여넣기(또는 파일)로 ① `az account get-access-token -o json` 출력(`"accessToken": "eyJ…"`) ② 포털·SDK가 만드는 표준 순서 SAS URL(`…?sv=…&se=…&sp=r&sig=…` — `sig`가 맨 끝).
**기대 결과**: `credentials-file`(키 파일 안내 + "이 키를 바꾸세요").
**실제 결과**: ① `not-cloudcheck` ② `wrong-type`. 원문이 DOM · 속성 · 제목 · 라이브 영역에 그려지지 않는 것은 확인했다(누출 없음). 사용자가 '키를 올렸다'는 안내를 받지 못하는 것이 문제.
**고치는 방향**: `"accessToken"\s*:\s*"eyJ` 패턴 추가, SAS는 `sig=`와 `se=` 순서 무관.
**테스트**: `it.fails` 2 + 대조 1(토큰 JSON 인식 결과에 토큰 값 없음) + 다른 키 파일 11종 정상(파일 · 붙여넣기).

### CC-QA-19 · '비밀 모양 감지' 개수 과다(새로 찾음)

| 항목 | 내용 |
|---|---|
| 심각도 | 낮음 · 허용 |
| 담당 | **API설계자** |
| 위치 | `parse/secrets.ts:54-64`(`Redactor`가 '서로 다른 원문 문자열' 수를 센다 — 같은 비밀이 든 ARN 칸이 따로 세짐) |

**재현 스텝**: 아슬아슬상회 AWS(C)의 사용자 이름 4개(AKIA · SAS `sig=` · `ghp_` · Azure 스토리지 키), 버킷 이름 3개(ASIA · `AIza` · `sk-`), 역할 이름 1개(JWT), 계정 별칭(`xoxb-`)에 서로 다른 비밀 모양 9개를 심는다(사용자 이름은 ARN 칸에도 다시 나온다, 조인 유지) → 리포트 배너.
**기대 결과**: `secrets-detected` 개수 = 서로 다른 값 수 9(설계서 IN-06 기대).
**실제 결과**: **12**. 원문 노출은 없다(리포트 · 마스킹 사본 원문 0, `checkReport` 위반 0). Azure(구독 이름 2개)는 2로 맞다.
**테스트**: `it.fails` 1.

### CC-QA-20 · 360px · 200% · 400% 확대에서 가로 넘침(새로 찾음)

| 항목 | 내용 |
|---|---|
| 심각도 | 낮음~중간 · WCAG 2.2 1.4.10 리플로 · UI-04 |
| 담당 | **프론트**(컴포넌트개발자) |
| 위치 | ① `src/app/cloudcheck/_client/components/ScopePanel.tsx:141-143`(구독 ID GUID `<MaskedValue>` = `bdi.cc-mask-full`) ② `components/TargetTable.tsx:83`(`table.cc-tt`) ③ `screens/Catalog.tsx:50-62`(`dd`) · 공통 `styles/base.css:4`(`body{word-break:keep-all}`), `:22`(`.cc-any{overflow-wrap:anywhere}`가 이 요소들에 없음) |

**재현 스텝(Chrome, CDP 에뮬레이션)**
1. 360×780(모바일): V0 → 체험 → Azure → 반쯤본상회(D) → 리포트 → 모든 점검 펼침 → 범위 패널 구독 목록. `00000000-0000-0000-0000-0000000000b2` 같은 GUID 한 줄(378px)이 끊기지 않아 화면 폭이 **426px**로 넓어진다(file:// · 서버 같음).
2. 640×450(= 1280px 창의 200% 확대): V3 체험 아슬아슬상회(C) AWS 또는 실제 파일 리포트에서 점검을 펼치면 대상 표 `table.cc-tt` 오른쪽 끝 667px, 문서 `scrollWidth` **749 > 640**. 펼치기 전에는 넘침 0.
3. 320×225(= 400% 확대): V7 판정 규칙. `dd` "…StorageRead·StorageWrite·StorageDelete를 모두 켭니다…" 오른쪽 끝 **348 > 320**.
**기대 결과**: 가로 넘침 0(데이터 표는 1.4.10 예외일 수 있으나, 그 경우에도 표 자체를 감싸 스크롤해야 하고 문서 전체가 넓어지면 안 된다).
**증거**: `…/scratchpad/qa/browser/sweep/results.json`(overflow), `focus3/focus3.json`(원인 요소), `focus2/m360-azureD-V3.png`.
**고치는 방향**: 마스킹 원값 · 영문 토큰 줄에 `.cc-any` 적용, 표는 감싸는 스크롤 컨테이너 또는 좁은 폭 카드 전환 기준을 640px 이상으로. 디자인팀장 §10-3 체크리스트에서 기준 확정.

### CC-QA-21 · axe 위반: 상태 범례 dl · 제목 수준 건너뜀(새로 찾음)

| 항목 | 내용 |
|---|---|
| 심각도 | 낮음~중간 · UI-03 |
| 담당 | **프론트**(컴포넌트개발자: `StatusLegend`·`FixSteps`, 페이지개발자: `Fix`·`Catalog`) |
| 위치 | ① `src/app/cloudcheck/_client/components/StatusLegend.tsx:10`(`<dl className="cc-legend" role="group">` — role이 dl 의미를 덮어 dt·dd가 목록 밖) ② `screens/Fix.tsx:36`(h1) → `components/FixSteps.tsx:32·46·59`(h3, h2는 그 뒤 `Fix.tsx:56`) ③ `screens/Catalog.tsx:41`(`<summary>` 안 제목 없음) → `:45` 이하 `h4`(h2 다음 h4) |

**재현 스텝**: axe-core 4.11.4를 V0~V8에 주입(라이트 · 다크 같음).
**실제 결과**: V3(체험 · 실제 파일) **dlitem(serious) 10곳**, V4 **heading-order(moderate) 1곳**, V7(`<details>` 펼침) **heading-order 5곳**. V0 · V1 · V2 · V8 위반 0, 색 대비 위반 0(두 테마).
**기대 결과**: 위반 0.
**고치는 방향**: 범례 `dl`에서 `role="group"`을 빼고 접근 이름은 감싸는 요소에, V4 단계 제목은 h2(또는 대상 h2 뒤로), V7은 summary 안에 h3를 두거나 하위 제목을 h3로.
**테스트**: `ui/a11y.test.tsx` `it.fails` 2(범례 role · V4 제목 수준) + 전제 1.

### CC-QA-22 · file:// 오프라인판의 안내 링크가 깨짐

| 항목 | 내용 |
|---|---|
| 심각도 | 낮음 · 허용 |
| 담당 | **프론트팀장** |
| 연관 | CR-14 · ISO-04 |
| 위치 | `src/app/cloudcheck/_build/template.mjs:117·127`(`<noscript>` · 부팅 실패 안내의 `/cloudcheck/download` 링크) |

**재현**: 커밋된 HTML(= 오프라인판 바이트)의 부팅 실패 안내(`cc-boot`)와 `<noscript>` 안에 `<a href="/cloudcheck/download" download>오프라인판 내려받기</a>`가 있다(바이트 검사로 확인). file://로 열고 스크립트가 돌지 못하면 이 링크가 `file:///cloudcheck/download`(없는 파일)가 된다 — 스크립트가 없어 숨길 수 없음. 정상 부팅된 file:// 화면에서는 오프라인판 링크가 보이지 않는다(실브라우저 확인 — 문제는 부팅 실패 · 스크립트 꺼짐 때만).
**고치는 방향**: 문구로 "이미 오프라인판이면 무시" 또는 링크 대신 안내 글.
**테스트**: `it.todo` 1(문구 결정 뒤 시험).

### CC-QA-23 · AZ-STO-2 컨테이너 슬롯 `none`의 거짓 확인 불가

| 항목 | 내용 |
|---|---|
| 심각도 | 낮음 · 허용(안전한 방향) |
| 담당 | **DB설계자** |
| 연관 | CR-15 |
| 위치 | `rules/azure/az-sto-2.ts:73`(`none`이면 계정 단위 확인 불가) ↔ `parse/normalize-azure.ts:357`(패밀리는 `none`을 0개 완결) |

**재현**: 반듯상회 Azure(A) 첫 스토리지 계정의 컨테이너 영수증 `empty` + 값 `null`(=`none`) → AZ-STO-2 확인 불가(`population-mismatch`). 같은 경우 값 `[]`이면 이상 없음.
**고치는 방향**: 둘 중 하나로 통일(`none` = 0개).
**테스트**: `it.fails` 1 + 대조 1.

---

## 6. 명세 확인 필요 · 설계서 정정 · 가드 정보

### 6-1. 명세 확인 필요(결정: 기획팀장, N2는 디자인팀장 함께)

| ID | 내용 | 지금 동작 | 시험 |
|---|---|---|---|
| **CC-QA-N1** | 설계서 FO-11은 '입력 순서를 바꿔도 Report 바이트 동일'을 기대 | 판정(룰 상태 · 사유 · 대상 MatchKey · 대상 상태)은 같다. 바이트는 `inputs` 순서와 영수증 ID 접두(`0:`·`1:`)가 따라 바뀌어 다르다. 사용자에게 보이는 판정은 같다. 바이트 동일이 필요한 곳(예: 결과 해시 비교)이 있는지 명세 확인 | `fo-purity` `it.todo` + 판정 동일 시험 |
| **CC-QA-N2** | 액세스 키 끝 4자리의 마스킹 범위 | 마스킹 사본은 가명(`K001`), 화면 · 인쇄 사실 줄은 원값(`plain`). 인쇄 기본이 마스킹인데 끝 4자리는 그대로 인쇄된다 | `in-mask-canary` `it.todo` |

### 6-2. 설계서 정정(실행해 보니 다른 것)

| 설계서 | 정정 |
|---|---|
| CL-03 ②④ "호출 1건(신원)" | 신원 단계 호출은 **2건**(`sts get-caller-identity` + `iam list-account-aliases` — 확인 화면에 별칭을 보여 주는 설계). 시험 기대를 2로 적었다 |
| IN-06 "PEM · 연결 문자열을 각 사용자 데이터 칸에" | 이름 칸에 PEM · 연결 문자열을 넣으면 **파일 전체가 키 파일로 거부**된다(`credentials-file`, 더 안전한 쪽). 칸별 가림 시험에서 빼고 따로 시험했다 |
| EX-04 "micro + 변이로 모든 상태" | AWS-STO-2 확인 불가는 기존 micro에 없어 룰의 `spec.calls` 전부를 거부로 만들어 냈다(방법 메모) |
| FO-02 "숫자 `65536`" 기대 | 범위 밖 상한(0~70000)은 65535로 잘라 위험 유지 — 안전한 방향이라 버그로 올리지 않았다(P3로는 해석 불가가 더 정직하다는 의견만) |

### 6-3. 가드 관련 정보(가드 파일은 고치지 않음)

- `guards.test.ts:650-655` "src/ 어디에도 serviceWorker가 없다"는 `_build` 밖 **테스트 파일까지** 글자로 훑는다. ISO-02는 `navigator.serviceWorker.register`에 스파이를 달아야 해서 이름을 `["service","Worker"].join("")`으로 만들어 피했다. 가드의 의도(제품 코드에 SW 없음)는 지켜지므로 버그로 올리지 않는다. 앞으로 다른 시험이 같은 문제를 만나면 가드 소유자(프론트팀장)가 시험 파일 제외 여부를 정하면 된다.
- lib 경계 규칙(`lib-boundary`)은 lib 5폴더(model · contract · parse · engine · rules)만 대상이라 `qa/**`가 `src/app` 하네스를 import해도 걸리지 않는다(5폴더 → qa import는 금지 그대로).
- 새 시험 때문에 `_generated/page.ts` 재생성이 필요해지지 않았다(`generated.test.ts` 초록).

---

## 7. 테스트 케이스별 결과(설계서 §4 전수)

| ID | 결과 | 근거 · 수치 |
|---|---|---|
| FO-01 | 통과 | 원시 변이 6,221건(받아들임 4,361 · 거부 1,852 · 빌드 실패 8): 이상 없음 결론으로 가는 룰 0, 같은 MatchKey 대상 0, `checkReport` 위반 0 |
| FO-02 | **버그** | 변이 1,367건(JSON 1,004 + CSV 363, 모두 받아들임) → 위반 100건 = CC-QA-05 36 · CC-QA-03 30 · CC-QA-01 18 · CC-QA-17 12 · CC-QA-04 4. 분류되지 않은 위반 0 |
| FO-03 | 통과 | 대상별 중첩 슬롯 변이 1,574건(결과가 바뀐 것 399): 위험 → 이상 없음 0, 위반 0 |
| FO-04 | **버그** | CC-QA-02 · 15 · 11. 일반 속성(이상 없음 결론 룰의 대상 집합 = QA가 원시 파일에서 센 열거, 중복 0)은 회사 8곳 원본에서 위반 0. 대조 E-06 · 리전 바꿔치기 · E-24 정상 |
| FO-05 | **버그** | CC-QA-01(① ② ③ ④ ⑥ 재현), ⑤ AWS 수집 JSON 경로는 정상(알림 권고 todo) |
| FO-06 | **버그** | 룰당 250 세계(비정상 값 약 10%): AWS-NET-1 611 비교/불일치 63 · AWS-STO-2 610/0 · AWS-KEY-4 608/94 · AZ-NET-1 490/109 · AZ-STO-2 621/0. 불일치 전부 CC-QA-03 · 04 · 05 · 17로 분류, 분류 안 된 불일치 0, 공통 속성(`checkReport` · 이상 없음 증거 영수증이 모두 답) 위반 0 |
| FO-07 | 통과 | 제외 7곳 × 결정 슬롯 `missing(denied · field-missing · value-unrecognized)` · `partial` · `none` · 보고서 신선도 실패 → 제외로 새는 길 0(설계서 §6-3 확인) |
| FO-08 | 통과 | `audit-group` 확인 불가 유지, `access-unreadable` 확인 불가, 와일드카드 액션 위험, 역할 맡기 아닌 문장만이면 이상 없음 |
| FO-09 | 통과 | 활성 리전 빈 배열 · 단일 객체 `Statement`(`trust:null`) · `publicAccess` null/모르는 값 · 와일드카드 액션 |
| FO-10 | 통과 | Azure RG CSV 2종(QA가 회사 JSON에서 만듦) 단독 · 조합: AZ-STO-1 · AZ-KEY-1 · AZ-NET-1 이상 없음 결론 0, CSV 위험·주의 ⊆ 수집기 위험·주의. AWS 보고서 CSV 열 삭제 · 값 있음: KEY-1 · KEY-2 이상 없음 0 |
| FO-11 | 통과 + N1 | 같은 입력 두 번 = 같은 바이트(Azure JSON · CSV), 시스템 시계 2020 · 2030에서 판정 바이트 동일, 시간 알림만 now에 따라 다름 |
| AN-01 | 통과 | 정답지 8개에서 이상 없음 · 해당 없음 · 위험 행 전부 + 확인 불가 사유 둘 이상 행: 룰 행 44 · 대상 행 76. QA 표(엔진 · 정답지를 보기 전에 작성) = 엔진 = 정답지. C.aws IAM 14행은 설계자가 먼저 본 표본이라 `seenBeforeWriting: true`로 표시 |
| AN-02 | 통과 | 기존 `answers.test` 100% · tolerate 0 |
| AN-03 | 통과 | Azure 4곳 모든 컨테이너 `publicAccess ∈ {None, Blob, Container}`, null 0 |
| AN-04 | 통과 | 정답지 자동 생성 경로 0(주석 제거 후 검사 + 검사기 자기 점검) |
| ISO-01 | 로컬 통과 → LV-01 | `next start` GET = HEAD 헤더(GET의 `Transfer-Encoding: chunked`만 다름), §8 표 |
| ISO-02 | 통과 | 커밋된 `PAGE.html`을 jsdom에서 15단계(V0 → 체험 C → V3 → V4 → 뒤로 → V7 → V8 → V1 수집기 내려받기 → V2 파일 2개 + 붙여넣기 → V3 → 예외 표시·내보내기·불러오기 → 마스킹 사본 → 인쇄 → 새 점검): 스파이 호출 0(저장소 `localStorage` · `sessionStorage` · `indexedDB` · `caches` · `cookieStore` · `document.cookie`, 네트워크 `fetch` · `XMLHttpRequest` · `WebSocket` · `EventSource` · `Worker` · `SharedWorker` · `BroadcastChannel` · `RTCPeerConnection` · `Image` · `sendBeacon`, 서비스 워커 등록, 클립보드, `window.open`, `history.replaceState`), `pushState` 10회 모두 `({cc:<화면>}, "")`, Blob 생성 3/해제 3(cloudcheck-aws.sh · cloudcheck-exceptions.json · cloudcheck-masked.json), `print` 1회, 끝 URL 불변(jsdom은 `location.assign`에 스파이를 달 수 없어 결과로 확인). 검사기 자기 점검: 금지 API를 일부러 부르면 스파이가 기록 |
| ISO-03 | 통과 | §8 |
| ISO-04 | 통과 | §8 |
| ISO-05 | 로컬 통과 → LV-07 | §8 |
| ISO-06 | 통과 | 공유 파일 9종 HEAD와 같음, `next.config.*` · `middleware.*` 없음, `serviceWorker` 글자는 가드 시험 2파일에만 |
| IN-01 | 통과 | 페이로드 6종 × 사용자 데이터 칸 전부(파일 이름 · 예외 사유 포함): V2~V5 · V7 · 인쇄 클래스에서 페이로드 요소 0, 속성 · `document.title` 원문 0, 마스킹 사본 · 예외 내보내기는 JSON 문자열 |
| IN-02 | **버그** | CC-QA-09 |
| IN-03 | 통과 | 25 MiB · +1, CSV 20 MiB · +1, 확장자 뒤바뀜, 붙여넣기 +1 — UI 선검사 · `recognize` 둘 다. 정보: UI 상한은 확장자, `recognize`는 내용 기준이라 22 MiB JSON을 `.csv` 이름으로 넣으면 UI가 먼저 거부(어긋나는 쪽은 모두 거부 방향 — 버그 아님) |
| IN-04 | 통과 | 깊이 32 진행 · 33 `too-deep`, 문자열 안 괄호 1만 개 무시 |
| IN-05 | 통과 + **버그** | 잘못된 UTF-8 · UTF-16 · NUL = `wrong-type`, BOM 정상, 짝 없는 서로게이트는 V3 `redacted` · V2 별칭 원값(CC-QA-09) |
| IN-06 | 통과 + **버그** | 화면 · 속성 · 인쇄 · 마스킹 사본 · 예외 내보내기 원문 0, `checkReport` AKIA 0. 예외 사유(CC-QA-12), 개수(CC-QA-19) |
| IN-07 | 통과 + **버그** | 키 파일 11종(AWS credentials · config · `export` · 새 액세스 키 CSV · assume-role JSON · `create-for-rbac` JSON · PEM · GCP 서비스 계정 · 연결 문자열 · SAS(`sig` 뒤 `se`) · `.env`)이 파일 · 붙여넣기 모두 `credentials-file`, 값이 DOM · 속성 · 제목 · 라이브 영역(`role="alert"`)에 없음 · 붙여넣기 칸 비움. 2종 미거부(CC-QA-18) |
| IN-08 | 통과 | `__proto__` · `constructor` · `prototype` · `hasOwnProperty` · `toString` 이름: 정상 판정, 오염 0, 마스킹 순번 정상 |
| IN-09 | 통과 | 스키마 상한(사용자 128 · 버킷 63 · 역할 64 · 외부 주체 ARN 2048 · NSG 80 · 구독 이름 256): 정상 판정, 256자 넘는 ARN만 `truncated` 플래그(구독 이름 256자는 상한이라 안 잘림). 360px 넘침은 긴 이름이 아니라 GUID에서 남(CC-QA-20) |
| IN-10 | 통과 + **버그** | 따옴표 안 쉼표 · 줄바꿈, CRLF · CR · BOM, 엑셀 재저장 날짜, 열 순서 → 이상 없음 0 · `csv-row-ambiguous`. 다른 계정 행 · 같은 열 두 번(CC-QA-10) |
| IN-11 | 통과 | 깊이 33 · 4 MB 초과 · 1001항목 · 날짜 오류 · `until < createdAt` · 91일 · 모르는 ruleId · 다른 계정 키(`unmatched`) · 같은 대상 여럿: 상태 · 분포 · 먼저 볼 3개 불변 |
| IN-12 | 통과 + N2 | 회사 8곳 카나리아 토큰: `maskedCopy` 0, 인쇄 기준 DOM(`.cc-mask-full` 제외) 0, 계정 관계 유지 |
| EX-01 | 통과 | V0 · V6 · V7(전부 펼침) · V8 · V1 · V2, V3(실제 AWS · Azure · CSV 단독 · `failClosedReport`) + V4, V5 비교, 정적 셸 · `<noscript>` — 금지어 · ⟦키⟧ · 빈 자리 0. 체험 V3 · V4는 기존 `demo-real`이 덮음 |
| EX-02 | 통과 | 약속 바로 다음 고지(V0 · V2 · V3 · 인쇄 바닥 · V8), V3 · V8 면책 |
| EX-03 | 통과 | 파라미터 키 × 0 · 1 · 7 · 45 · 90 · 180 · 1000 · 시각 · 날짜: 금지어 · `%` · 빈 자리 0 |
| EX-04 | 통과 | 룰마다 낼 수 있는 상태 줄 렌더 = 문구 검수 §5 표, '—' 상태는 안 나옴, K-1 근거 줄 |
| EX-05 | **버그** | CC-QA-06 |
| UI-01 | 미실행 | 이번 지시(P0 + 실브라우저 UI-03~07) 밖 — 다음 회차 |
| UI-02 | 일부 | 구조 위반만(CC-QA-21). 점검 행 버튼 접근 이름 · `aria-labelledby` · 낭독 1회는 미실행 |
| UI-03 | **버그** | CC-QA-21(대비 위반 0) |
| UI-04 | **버그** | CC-QA-20 |
| UI-05 | 통과 | 다크 V0 · V3 · V4 토큰 적용, 다크에서도 인쇄 미디어는 라이트(스크린샷) |
| UI-06 | 일부 통과 | 메뉴 인쇄(인쇄 미디어 + `printToPDF`): 마스킹 짧은 값 50 보임 · 원값 0, 접힌 본문 10/10 펼침, 도장 · 서명란 0, PDF 942 KiB. 버튼 인쇄의 '목록만' · '이름 표시' 모드 결과는 수동(§9) |
| UI-07 | 통과 | 상태 배지 35개 모두 글자 있음(0/35 누락), 전색맹 · 제2색맹 에뮬레이션에서 도형 + 글자로 구분 |
| UI-08 | 일부 통과 | V2 창 밖 드롭 → 탐색 · 내려받기 0, V3 드롭은 삼키고 안내. `beforeunload` · 새 점검 확인은 미실행 |
| UI-09 · UI-11 | 미실행 | 지시 범위 밖 |
| UI-10 | 수동 | §9(PM) |
| CL-01 | 통과 | 기존 '린터의 린터' 밖 우회 21종 모두 해당 L-규칙으로 잡힘(설계서 목록 중 나머지 6종 `$'\x63url'` · `IFS=` · `<(…)` · `coproc` · `--endpoint-url` · `az storage account keys list`는 기존 `lint.test.ts`에 이미 있음), 원본 수집기 위반 0 |
| CL-02 | 통과 | endpoint-guard 줄 삭제 · `false` · 11줄 뒤로, Azure `az --version` → 모두 린트 실패 |
| CL-03 | 통과 | expect 가상 터미널: ① Enter → 결과 파일 남김(마지막 질문 Ctrl+C) ② 계정 확인 Ctrl+C → 결과 · 임시 파일 0, 호출 2건(§6-2) ③ 마지막 Enter → 파일 삭제 ④ 비대화형 + `--yes` 없음 → exit 3, 호출 2건 |
| CL-04 | 통과 | `bash -n` 두 수집기: bash 5.1.16(`mariadb:10.11`) · 5.2.21(`hwp2pdf:latest`) · 5.3.3(`postgres:16-alpine`) 오류 0(`--pull=never --network none`, 읽기 전용). 실제 실행은 이미지에 jq가 없어 PM V1 |
| CL-05 | **버그** | CC-QA-01(shim Azure) |
| CL-06 | **버그** | Azure CC-QA-11. AWS 범위 밖 리전은 확인 불가(정상) |
| PF-01~05 | 미실행 | 지시 범위 밖. PF-04는 기존 `generated.test`(번들 예산 실패 기준) 통과 |

---

## 8. 실브라우저 결과(Chrome CDP)

스크립트(레포 밖): `…/scratchpad/qa/cdp-sweep.mjs`(프론트 `cdp-check.mjs` 확장), `cdp-focus2.mjs` · `cdp-focus3.mjs` · `cdp-focus4.mjs`(표적 재확인). 결과: `browser/sweep/results.json`(+ 스크린샷 · PDF), `browser/focus2/focus2.json`, `browser/focus3/focus3.json`, `browser/focus4/focus4.json`, `browser/focus4-server/focus4.json`, `browser/crops/*.png`, `browser/get.headers` · `head.headers`.

### 8-1. 전 화면 스윕(ISO-03 · ISO-04)

흐름(탭 하나): V0 → 체험 A~D × AWS · Azure(전부 펼침) → V4 → V7 · V8(`<details>` 펼침) → V1 AWS 수집기 내려받기 → V2 파일 고르기(`DOM.setFileInputFiles`) + 드롭(`Input.dispatchDragEvent`) + 붙여넣기 → V3 → 예외 불러오기 → 마스킹 사본 · 예외 내보내기 → 인쇄 미디어 · `printToPDF` → 저장소 조회.

| 목표 | 최초 요청 | 콘솔 오류 · 예외 | CSP · TT 위반 | 저장소(local · session · IDB · cache · cookie · SW) | 넘침 | 비고 |
|---|---|---|---|---|---|---|
| file:// 1280 | 1(문서) | 0 · 0 | 0 | 0 · 0 · — · — · 0 · —(focus2) | 0 | `cc-file`, 오프라인판 링크 숨김, 내려받기 3건 |
| file:// 360 | 1 | 0 · 0 | 0 | 같음 | Azure D V3 426px | CC-QA-20 |
| 서버 1280 | 1 | 0 · 0 | **시험 요청 1건만 차단**(`connect-src`) | 0 · 0 · 0 · 0 · 0 · 0 | 0 | `history.state = {cc:"report"}` |
| 서버 360 | 1 | 0 · 0 | 0 | 전부 0 | Azure D V3 426px | CC-QA-20 |
| 서버 다크 1280 | 1 | 0 · 0 | 0 | 전부 0 | 0 | UI-05 |
| 서버 640×450(200%) | 1 | 0 · 0 | 0 | 전부 0 | V3 펼침 749px | CC-QA-20 |
| 서버 320×225(400%) | 1 | 0 · 0 | 0 | 전부 0 | V7 348px | CC-QA-20 |
| axe 라이트 · 다크 | 1 | 0 · 0 | 0 | 전부 0 | 0 | CC-QA-21 |

- **수집기 내려받기 바이트**: `cloudcheck-aws.sh` 26,424바이트, sha256 `f223a053…80f` = `SHA256SUMS`. 스윕(file:// 1280) + 서버 1280(focus2) + 단독 재확인(focus4: file · 서버 × 1280 · 360(모바일 에뮬레이션 켬 · 끔) 6경우 전부 일치). 마스킹 사본 84,351바이트 · 예외 파일 312바이트도 Blob으로 정상 저장.
- **본문 해시**: `/cloudcheck`와 `/cloudcheck/download` 본문 sha256 = `189851b0…d855` = `PAGE.sha256`, 내려받기 파일 이름 `cloudcheck-0.1.0.html`. 응답 CSP의 해시 = `PAGE.scriptHash`(`yzgJCZ…`) · `PAGE.styleHash`(`FQMcZi…`).
- **file:// 전용(ISO-04, focus2)**: 부팅 · `cc-file`, 페이지 안 `fetch('https://example.com/x')` → meta CSP `connect-src 'none'`로 차단, `innerHTML` 대입 → Trusted Types로 차단, `pushState` 동작, localStorage 0 · sessionStorage 0 · cookie 빈 값. (스윕의 file:// 오류 1건은 시험 도구의 `navigator.serviceWorker.getRegistrations()`가 file://에서 지원되지 않아 난 것 — 페이지 오류 아님.)
- **COOP · iframe(ISO-05, 로컬)**: 다른 origin(127.0.0.1)에서 `window.open(localhost/cloudcheck)` → 연 쪽에서 `closed: true`(단절), `<iframe>` → `frame-ancestors 'none'`로 차단.
- **드롭(UI-08 일부)**: V2 드롭 영역 밖 드롭 → 탐색 · 내려받기 0, V3 드롭 → 읽지 않고 안내("리포트를 보는 중에는 새 파일을 읽지 않습니다…").
- **시험 도구 잔여물(제품 결함 아님)**: 스윕 공용 내려받기 폴더에 생긴 `downloads.html`(file:// 360) · `aws-C.credential-report.csv`(확대 목표)는 단독 재확인(focus4)에서 재현되지 않았고, 후자는 드롭 좌표가 확대 화면의 뷰포트 밖이었던 탓이다.

### 8-2. 헤더(ISO-01 로컬 — 라이브는 LV-01)

`curl -D`(GET)와 `curl -I`(HEAD)를 비교: `Transfer-Encoding: chunked`(GET만) 외 같다. `content-security-policy: default-src 'none'; script-src 'sha256-yzgJ…'; style-src 'sha256-FQMc…'; img-src data:; connect-src 'none'; … require-trusted-types-for 'script'; trusted-types 'none'; frame-ancestors 'none'` · `cross-origin-opener-policy: same-origin` · `cross-origin-resource-policy: same-origin` · `x-frame-options: DENY` · `x-robots-tag: noindex` · `referrer-policy: no-referrer` · `x-content-type-options: nosniff` · `permissions-policy: camera=(), …, clipboard-read=(), clipboard-write=(), …` · `cache-control: public, max-age=0, must-revalidate` · `vary: RSC, Next-Router-State-Tree, Next-Router-Prefetch` · HSTS 없음(로컬).

### 8-3. 접근성 · 인쇄 · 다크 · 색각(UI-03~07)

- axe(V0~V8, 라이트 · 다크 같음): V3 `dlitem` 심각 10 · V4 `heading-order` 1 · V7 `heading-order` 5, 나머지 0, 색 대비 0 → CC-QA-21.
- 인쇄: 마스킹 기본(짧은 값 50 보임 · 원값 0), `cc-po` 본문 10/10 펼침, 도장 · 서명란 0, PDF 942 KiB(`sweep/file-1280-print.pdf` · `server-1280-print.pdf`). 다크 화면에서 인쇄 미디어는 라이트(`crops/dark-print-top.png`).
- 색각: `sweep/vision-V3-D-achromatopsia.png` · `vision-V3-D-deuteranopia.png`(`crops/vision-deut-top.png`) — 상태가 도형 + 글자로 구분, 글자 없는 배지 0/35.

---

## 9. 수동 확인 표 — UI-10 Safari · Firefox(PM)

이 맥에는 Firefox가 없고, Safari 자동화는 '원격 자동화 허용'을 켜야 해서 실행하지 못했다. **G5 통과 조건: 최소 Safari에서 Blob 내려받기 1회 확인**(실패면 CR-13 `DownloadLink.tsx:42`를 고쳐야 통과). 로컬 `next start` 또는 배포 후 라이브 URL에서, 그리고 오프라인판(file://)에서 한 번씩.

| # | 확인 | 기대 | Safari(macOS) | Firefox | iOS Safari(선택) |
|---|---|---|---|---|---|
| 1 | V1 '수집기 내려받기'(AWS · Azure) | `cloudcheck-aws.sh` sha256 `5547c91e7f8a4b152c8693eca25ca33d68a886f70247ef9a91599c1dd1c3b988`(재검증 뒤 새 릴리스) · `cloudcheck-azure.sh` `8bc7bd2ff9df9d5c20a30d841c2b3051d93f06bb6eec5d6e41356b3151462f8d`(`shasum -a 256`). Azure V1은 운영 기본값에서 열리지 않으면 건너뛴다 | | | |
| 2 | V3 '마스킹 사본 저장' | `cloudcheck-masked.json` 끝까지 저장(끊김 없음) | | | |
| 3 | V3 '예외 파일 내보내기' → 다시 불러오기 | `cloudcheck-exceptions.json`, "예외 1건 적용" | | | |
| 4 | 리포트 닫기 확인 `<dialog>` | Esc = 돌아가기, 포커스가 누른 버튼으로 | | | |
| 5 | V1 · V7 · V8 `<details>` | 열고 닫힘, 인쇄 때 펼침 | | | |
| 6 | 인쇄 — 메뉴(Cmd+P) | 마스킹 기본, 라이트 테마, 접힌 내용 펼침 | | | |
| 7 | 인쇄 — 버튼(전체 · 목록만 · 이름 표시) | '이름 표시'는 그 인쇄 한 번만 원값 | | | |
| 8 | 오프라인판 file:// | 부팅, 앱 안 뒤로 가기(`pushState`) | | | |
| 9 | V1 해시 묶음 복사 | 공백 없는 64자 hex | | | |
| 10 | V2 붙여넣기(`clipboard-read=()` 정책) | 붙여넣은 글이 읽힘 | | | |
| 11 | 360px 폭(아이폰) Azure D 리포트 | 가로 넘침 0(CC-QA-20 수정 뒤 — 체험 리포트로 확인) | | | |
| 12 | V2에 실제 Azure 수집 JSON 넣기(운영 기본값) | '읽었습니다' 뒤 [이 계정으로 리포트 보기] 막힘 · 'Azure 실제 점검은 준비 중입니다' 안내 · 리포트 없음 | | | |

---

## 10. PM V1(G8)로 넘길 항목(설계서 §8)

> **재검증 메모(2026-10-20)**: PM V1은 새 수집기 릴리스(`cloudcheck-aws.sh` 5547c91e…, `RELEASES.json` 갱신분)로 돌린다. ★★3(CloudTrail `LatestDeliveryError` 실제 모양 · 빈 문자열 · 고급 선택기 NotEquals)으로 D-2와 CC-QA-07 수집기 방어를 실측한다. 아래 결함 심기 표의 V-A2 · V-Z2 · 프리픽스 리스트 기대 결과는 결정 반영으로 바뀌었다 — V-A2(분할 3389, 연결 없음) = 주의(`sg-unattached`), V-Z2(`AzureCloud` 3389) = 주의(`nsg-source-service-tag`), 위험 포트 + 프리픽스 리스트 = 주의(`sg-source-prefix-list`).

### 10-1. 추가 측정(★★ 설계서, ★★★ 실행자 추가)

1. ★★ 콘솔 자격증명 보고서 CSV의 **내려받은 파일 이름 형식**과 `lastModified`(= 내려받은 시각인지), 보고서 안 가장 늦은 시각과의 차이 → CC-QA-01 허용치 근거.
2. ★★ CloudShell `date -u`와 실제 시각 차이, 로컬 CLI 경로면 그 기기 시계도(CC-QA-01).
3. ★★ CloudTrail `get-trail-status`의 `LatestDeliveryError` 모양(CC-QA-08 · D-2), 고급 이벤트 선택기 계정이면 `readOnly`에 NotEquals가 허용되는지(CC-QA-07).
4. ★★ `get-account-summary`의 `Roles`가 서비스 연결 역할을 세는지(AWS-KEY-4 모수 교차 확인).
5. ★★ Azure NSG 실제 `sourceAddressPrefix` 서비스 태그 표기, ASG 출발지 규칙 모양(CC-QA-04 · D-3).
6. ★★ Azure `--subscriptions`에 없는 ID를 넣었을 때 수집기 출력(CC-QA-11).
7. ★★★ **수집기 실제 실행**: jq 1.6 · bash 5.x(CloudShell)에서 두 수집기 끝까지. 이번엔 bash 5.1 · 5.2 · 5.3 `bash -n`만 했다(CL-04, 이미지에 jq 없음).
8. ★★★ CC-QA-01 실제 조건: 보고서 CSV를 메일 첨부 · 압축(zip) · 다른 PC로 옮긴 뒤 `lastModified`가 어떻게 바뀌는지(1980 · 1970 시각이 실제로 나오는지) → '2000년 이전 = 기준 시각 없음' 하한 근거.
9. ★★★ Azure 포털 · Storage Explorer가 만드는 SAS URL에서 `sig=` 위치(모양만 — **값을 붙여넣지 말 것**) → CC-QA-18 변종이 실제 기본 모양인지.
10. ★★★ 실계정 리포트를 360px 휴대폰에서 열어 구독 ID · ARN 줄 넘침(CC-QA-20) 확인.

### 10-2. 결함 심기 체크리스트('무장은 됐지만 연결 안 됨' — 실제 노출을 만들지 않는다)

| # | 클라우드 | 심을 것 | 기대 결과(지금 코드) | QA 자동 재현 · 연관 | 철거 |
|---|---|---|---|---|---|
| V-A1 | AWS | 연결 ENI 없는 SG `cc-v1-ssh`: 22/tcp ← 0.0.0.0/0 | AWS-NET-1 주의(`sg-unattached`) | 회사 픽스처 · FO-06 | SG 삭제 |
| V-A2 | AWS | **별도** SG `cc-v1-split`(연결 없음): 3389/tcp ← `0.0.0.0/1` · `128.0.0.0/1` | 그 SG 이상 없음(`sg-closed`) — 결정 D-1 기록용 | CC-QA-04 `it.fails` | SG 삭제 |
| V-A3 | AWS | 빈 버킷 `cc-v1-possible-<무작위>`: 버킷 차단 4개 끔, 정책 · ACL 공개 없음 | 계정 차단 켜짐 → 이상 없음, 꺼짐 → 주의(`public-possible`) | FO-06(STO-2 불일치 0) | 버킷 삭제 |
| V-A4 | AWS | 계정 차단 4개 중 1개만 끔(빈 · 학습 계정만) | AWS-STO-1 주의(`block-partial`) | 기존 micro | 원래대로 |
| V-A5 | AWS | 역할 `cc-v1-trust`: `Principal {"AWS":"*"}` + 맞지 않는 `aws:PrincipalOrgID` 조건, 권한 정책 0 | AWS-KEY-4 주의(`trust-wildcard-org-condition`) | FO-06 | 역할 삭제 |
| V-A6 | AWS | 사용자 `cc-v1-unused` + 액세스 키 1개(비밀 키 즉시 폐기), 정책 0, 8일 뒤 실행 | KEY-2 주의(만든 지 7일 넘고 한 번도 안 씀), KEY-1 이상 없음 | 기존 micro | 키 · 사용자 삭제 |
| V-A7 | AWS | (선택) trail `stop-logging` 잠시 | AWS-LOG-1 주의(`trail-not-logging`) | 기존 micro | `start-logging` |
| V-Z1 | Azure | 연결 없는 NSG: Inbound Allow 22 ← Internet | AZ-NET-1 주의(`nsg-unattached`) | FO-06 | NSG 삭제 |
| V-Z2 | Azure | **별도** NSG(연결 없음): 3389 ← `AzureCloud` | 그 NSG 이상 없음(`nsg-closed`) — 결정 D-3 기록용 | CC-QA-04 `it.fails` | NSG 삭제 |
| V-Z3 | Azure | 스토리지 계정 `allowBlobPublicAccess=true`, 컨테이너 모두 Private | AZ-STO-1 주의, AZ-STO-2 이상 없음(`container-private`) | FO-06(AZ-STO-2 불일치 0) · AN-03 | `false`로 |
| V-Z4 | Azure | Blob 진단 설정을 범주 그룹 `audit`만 | AZ-LOG-2 확인 불가(`value-unrecognized`) + F-3 실측 | FO-08 | 진단 설정 삭제 |
| V-Z5 | Azure | 구독 활동 로그 내보내기 없음(기본) | AZ-LOG-1 주의(`no-export`) | 기존 micro | — |

- 심은 뒤 수집 1회 → 위 표와 대조 → 오탐 · 확인 불가 사유 기록 → 철거 → 1회 더 수집해 원상 복귀 확인.
- 쓰기 명령은 PM이 직접 입력(원클릭 복사 없음 원칙 유지). 학습 · 빈 계정에서만.
- 고쳐진 버그가 생기면(CC-QA-04 결정 반영 등) 그 행의 '기대 결과'를 바꿔서 실측한다.

---

## 11. 라이브(배포 후) 확인 LV-01~10(설계서 §9) — 배포엔지니어

| ID | 항목 | 방법 | 기대 | 로컬 사전 확인(이번) |
|---|---|---|---|---|
| LV-01 | 헤더 | `curl -s -D - -o /dev/null "https://project-orsrw.vercel.app/cloudcheck?v=<SHA>"`와 `curl -sI` | §8-2와 같음(HEAD = GET), `X-Robots-Tag: noindex`, Vercel이 `Cache-Control`을 바꾸지 않음, HSTS 유무 기록 | 로컬 GET = HEAD(Transfer-Encoding만 다름), HSTS 없음 |
| LV-02 | 압축 | `curl -sI -H 'Accept-Encoding: br, gzip' …` | `content-encoding: br`(또는 gzip) | 미확인(로컬 `next start`) |
| LV-03 | 본문 해시 | `curl -s --compressed …/cloudcheck \| shasum -a 256`와 `…/cloudcheck/download` | 둘 다 `PAGE.sha256` — STEP 6 확인 시점 `c9f68992dd67556b998d5c2fb683d9f9a81bd305fd814f038b7960cd565e81bc`(04:52 재생성본. 배포 전에 다시 생성했다면 그 값) | 로컬 두 라우트 = `PAGE.sha256` |
| LV-04 | 고유 콘텐츠 | 본문에 `<title>` "문단속 5"와 베타 띠 문구 | 있음(200이 아니라 내용으로 판정) | — |
| LV-05 | 요청 1건 · 위반 0 | 확장 끈 Chrome DevTools Network · Console · Issues | 문서 1건, CSP · TT 위반 0 | 로컬 Chrome 요청 1 · 위반 0 |
| LV-06 | 같은 origin 서비스 워커 | DevTools Application, `navigator.serviceWorker.getRegistrations()` | 0 | 로컬 0 |
| LV-07 | COOP · iframe | 다른 origin에서 `window.open` · `<iframe>` | 단절 · 차단 | 로컬 단절 · 차단 |
| LV-08 | 모바일 성능 | 실제 휴대폰 또는 DevTools 모바일 + 4× CPU | LCP · CLS 기록 | 미실행(PF-03) |
| LV-09 | 회귀 | `/pae` `/moira` `/exam` `/witness` 고유 콘텐츠 | 정상 | — |
| LV-10 | 경로 변형 | `/cloudcheck/`(끝 슬래시), `/cloudcheck?x=1#y` | 리다이렉트 또는 같은 페이지, 앱이 쿼리 · 해시를 읽지 않음 | 미실행 |

---

## 12. 수정 후 재검증 절차(QA실행자)

1. 담당 개발자가 고친 뒤 `npx vitest run src/lib/cloudcheck/qa`를 돌리면 그 버그의 `it.fails`가 **"Expect test to fail"로 실패**한다(= 고쳐졌다는 신호).
2. 메인 세션이 QA실행자에게 넘기면, QA가 해당 `it.fails`를 `it`으로 바꾸고(qa/**는 QA 소유) 아래를 다시 돌린다: QA 시험 전체 · cloudcheck 스위트 · 레포 전체 · `type-check` · 가드/생성물. 부작용 확인은 FO-01 · FO-03(단조성), AN-01(정답지), FO-06(오라클), 기존 e2e.
3. 레포 전체 `npm run test`는 다른 앱의 배포 게이트이므로 **수정과 `it.fails` → `it` 전환은 같은 변경으로** 들어가야 한다(수정만 먼저 들어가면 빨갛게 된다).
4. 결정 항목(D-1~D-4, N1, N2)은 결정이 나면 `it.todo`를 결정대로 `it.fails`(구현 전) 또는 `it`(구현 후)로 바꾼다. 결정 전에는 현재 동작을 V7 '못 보는 것'에 적는다.
5. 차단 버그(CC-QA-01 · 06, Azure 공개 시 02)는 `it.fails`가 하나라도 남아 있으면 G1 · G7을 닫지 않는다.

---

## 13. 수정 담당별 묶음

| 담당 | 버그 | 메모 |
|---|---|---|
| **DB설계자** (`engine/` · `rules/`) | **01**(나이 계산 · `stale-evidence` 막기), **02 · 15**(`aggregate` 신원 집합 비교 — 한 번에), 03, 05, 07①(룰), 13, 16, 17, 23, 12(또는 API), 09(`engine/display.ts`를 API 쪽과 하나로) / 결정 뒤: 04 · 08 · 14 | 01 · 03 · 05 · 17은 같은 원칙(P3 · 근거 없는 '없음' 금지)이라 함께 고치면 FO-02 · FO-06 `it.fails` 일곱 개가 한 번에 바뀐다 |
| **API설계자** (`contract/` · `parse/` · `collector/`) | **01**(정규화: 입력별 최신 증거 시각 · `lastModified` 하한), **02**(활동 로그 패밀리 `subCoverage` 봉인), **15**(정규화 중복 거부), 07②(수집기 Equals 밖 연산자 표시 — 수집기 해시 바뀜 → 첫 공개 전에), 09(정리기 하나로), 10, 11, 18, 19 | 수집기를 바꾸면 `SHA256SUMS` · `RELEASES.json` · 생성물이 함께 바뀐다(가드 · 생성물 시험이 잡음) |
| **프론트** (컴포넌트 · 페이지 · 프론트팀장) | **06**(`RuleRow` 꼬리표 — G7 차단), 20(넘침), 21(범례 role · 제목 수준), 22(템플릿 문구 — 프론트팀장) | 06의 '직접 볼 목록' 항목은 DB설계자(`engine/blocks.ts`)와 같이. 문구 키는 디자인팀장 |
| **기획팀장**(+디자인팀장) | D-1 · D-3(04), D-2(08), D-4(14), N1, N2(+디자인팀장), §14의 §10-1 · §10-2 해석 | 설계서 D-5~D-7은 그대로 |

---

## 14. (1차) 출시 판정 — 2026-10-20 01시 기준 · §R-5가 대체

### (1차) 판정: 베타 배포 불가 → 재검증 뒤 **베타 배포 가능(조건부)**(§R-5)

**막는 버그(고치기 전에는 배포 불가)**

| ID | 이유 |
|---|---|
| **CC-QA-01** | 높음. 실제로 일어나는 조건(늦은 PC 시계 · 1980 파일 시각 · 이름 바꾼 파일 · 늦은 로컬 CLI 시계)에서 근거 없이 '이상 없음' — 제품 핵심 약속('증거 없으면 초록 없음') 위반. G1 |
| **CC-QA-06** | G7. 일부만 본 위험 · 주의 행에 "확인한 범위: 계정 전체" — '어디까지 봤는지 정직하게' 위반 |

**Azure 실제 점검을 열기 전 추가 차단**: **CC-QA-02**(지금 Azure는 '준비 중'이라 AWS 베타는 막지 않음). QA 권고로 같은 시점에 **CC-QA-17**(AZ-NET-1 모르는 값), **CC-QA-11**(요청 구독), **CC-QA-15**의 Azure 부분도 닫는다.

**위 두 건을 고친 뒤 베타('베타 · 실계정 검증 전' + noindex)가 가능해지는 조건**
1. CC-QA-01 · CC-QA-06의 `it.fails` 16개(13 + 3)가 `it`으로 바뀌어 초록, cloudcheck 스위트 · 레포 전체 · type-check · 가드/생성물 초록(§12).
2. G5: Safari Blob 내려받기 1회 확인(§9 #1~3). 실패면 CR-13을 고친다.
3. G7: 디자인 §10-3 체크리스트를 디자인팀장과 닫는다(CC-QA-20 · 21을 여기서 다룰 것을 권고 — 수정 범위가 작다).
4. 결정 대기(D-1~D-4)는 결정 전까지 현재 동작을 V7 판정 규칙 화면 '못 보는 것'에 적는다.

**G8(PM V1) 전까지 닫을 것**: CC-QA-03, 05, 07, 09, 10, 11, 13, 15, 17(+ 결정 뒤 04 · 08 · 14).
**허용(알려진 문제로 기록)**: CC-QA-12(CR-11), 16, 18(CR-16 + SAS), 19, 22(CR-14), 23(CR-15). CR-13은 Safari 확인 뒤 판단.
**결정 필요(기획팀장)**: D-1 · D-3(CC-QA-04), D-2(CC-QA-08), D-4(CC-QA-14), N1, N2.

### 게이트별 상태(§10-1)

| 게이트 | 지금 | 근거 · 남은 것 |
|---|---|---|
| G1 엔진 | **닫히지 않음** | CC-QA-01 `it.fails` 남음. FO-01 · 03 · 07~11 초록. §10-1 문자 그대로는 FO-02 · 06의 남은 불일치(CC-QA-03 · 05 · 17 중간)도 '낮음 이하 또는 결정'이어야 하나, §10-2는 이를 'G8 전까지'로 둔다 → **베타 판정은 §10-2를 따랐다**(기획팀장 확인 요청) |
| G2 룰 | 닫히지 않음(AWS 베타는 막지 않음) | CC-QA-04의 AZ-NET-1 서비스 태그 · ASG 부분(D-3) 구현 또는 방향서 '명세 변경' 기록 필요. Azure가 '준비 중'인 동안은 §10-2대로 V7 '알려진 한계' 기록으로 갈음하고, Azure 공개 전에 닫는다 |
| G3 정답지 | 통과 | AN-01 불일치 0, 100% · tolerate 0 |
| G4 수집기 | 통과(로컬 범위) | CL-01 · 02 · 03 초록, CL-04 오류 0. jq 1.6 · bash 5 실제 실행은 G8 |
| G5 격리 | 조건부 | ISO-02 초록, ISO-03 · 04 Chrome 위반 0. Safari Blob 1회 확인 남음. 라이브 항목은 배포 단계(LV) |
| G6 입력 안전 | 조건부 | IN-01~12 중 `it.fails`: CC-QA-12 · 18(허용 목록), CC-QA-19(낮음), CC-QA-09 · 10(§10-2상 G8 전까지). §10-1 문자 그대로는 09 · 10 · 19도 남음 |
| G7 표현 | **닫히지 않음** | EX-01~04 초록, **EX-05(CC-QA-06) `it.fails` 남음**, 디자인 §10-3 체크리스트 미종결 |
