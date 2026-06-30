# 진짜집(Jinjjajip) 버그 리포트 — P0 QA 실행 결과

> 작성: @QA실행자 (Opus) · 2026-06-03
> 실행 환경: Vitest 1.6.1 + jsdom + @testing-library/react · Next.js 14 App Router · React Query v5
> 테스트 결과: **16 파일 / 151 PASS / 1 SKIP / 0 FAIL** · `npm run type-check` exit 0
> 근거: 모든 버그는 소스 문자열 매칭이 아니라 **실제 동작(렌더/응답/상태)** 으로 확정. 추정은 "추정" 명시.

---

## 0. 실행 요약

| 항목 | 수치 |
|---|---|
| 총 테스트 파일 | 16 (unit 3 + components 5 + state 3 + api 4 + constraints 1) |
| PASS | 151 |
| SKIP | 1 (ST-10 수정후-동작 가드 = BUG-02, 프론트 UI 영역이라 it.skip) |
| FAIL | 0 |
| type-check | exit 0 (clean) |
| 즉시 수정 적용 | **BUG-01** (providers.tsx `networkMode:'always'`) — 단위회귀 GREEN, 단 **런타임 미해소(§8)** |

추가한 테스트 파일:
- `tests/unit/domain-score.test.ts` (31) — SC-01~24 점수엔진 SSOT
- `tests/unit/utils-format.test.ts` (11) — UT-01~07 포맷 유틸
- `tests/unit/validation.test.ts` (21) — ZV-01~17 zod 계약
- `tests/components/trust-donut.test.tsx` (5) — CP-13~15 도넛 arc
- `tests/components/status-chip.test.tsx` (4) — CP-19 상태칩
- `tests/state/listings-query-state.test.tsx` (10) — ST-01~07 + **ST-05 회귀**
- `tests/state/upload-status-state.test.tsx` (5, 1 skip) — ST-08~10 화면분기
- `tests/state/upload-status-hook.test.tsx` (4) — ST-11~13 폴링제어
- `tests/api/listings-route.test.ts` (5) — API-01~03
- `tests/api/reports-route.test.ts` (6) — API-04~08
- `tests/api/photos-route.test.ts` (9) — API-09~14 허위매물 차단 게이트
- `tests/api/uploads-route.test.ts` (5) — API-15~17 폴링 응답
- `tests/constraints/absolute-constraints.test.tsx` (7) — RV-01·02·03·09·12·13·14
- `tests/helpers/supabase-mock.ts` — 체이너블 Supabase 모킹 헬퍼
- (기존 listing-card / score-breakdown / trust-score-badge 테스트는 무력화 없이 전부 유지)

---

## 1. 버그 표 (심각도순)

| 버그ID | 심각도 | 제목 | 재현절차(요약) | 근본원인 (파일:라인) | 권장수정 | 상태 |
|---|---|---|---|---|---|---|
| **BUG-01** | 🔴치명 | 검색홈 paused 상태가 ErrorState 아닌 EmptyState 로 낙하 | ① 오프라인/네트워크 실패 ② 검색홈 진입 ③ 기대=ErrorState, 실제=빈 화면("현재 관악구·마포구에서 서비스 중입니다") | React Query 기본 `networkMode:"online"` → 실패 시 `fetchStatus:"paused"` + `status:"pending"` + `data:undefined` → isError 분기 우회. `src/app/providers.tsx:9-18`(수정 전 networkMode 부재) | `defaultOptions.queries.networkMode="always"` 추가. ST-05b 테스트로 버그 재현·ST-05 로 수정 검증 | **✅ 수정·런타임 검증완료(§9)** |
| **BUG-02** | 🟠높음 | 업로드 Step4 폴링 데드엔드 (error/paused 무한 스피너) | ① 사진 업로드 → step4 진입 ② 파이프라인 error 또는 네트워크 끊김 ③ 기대=에러 안내+재시도, 실제="사진 분석 중" 스피너 영구 표시 | `Step4Content` 가 `data?.done===true` 만 처리, error/paused 분기 없음. `src/app/verify/page.tsx:94-133`(L100 단일 조건) | error/paused 시 에러 UI + 재시도/홈 이동 버튼 렌더. **프론트팀 신규 UI 영역** → 보고만. 회귀는 `it.skip`(ST-10) | ✅ 수정완료·프론트(§9) |
| **BUG-03** | 🟠높음 | Step4 "알림 켜고 나중에 확인하기" 죽은 버튼 | ① step4 진입 ② 버튼 클릭 ③ 아무 동작 없음 | onClick 핸들러 부재. `src/app/verify/page.tsx:125-130` | 알림 등록/홈 이동 핸들러 연결 또는 버튼 제거. **프론트팀 영역** | ✅ 수정완료·프론트(§9) |
| **BUG-04** | 🟡중간 | Step5 "게시하기" 죽은 버튼 | ① 인증 완료(step5) ② "게시하기" 클릭 ③ 아무 동작 없음 | onClick 핸들러 부재. `src/app/verify/page.tsx:184-189` | 게시 API 연동 또는 핸들러 연결. **프론트팀 영역** | ✅ 수정완료·프론트(§9) |
| **BUG-05** | 🟡중간 | 신고매물(reported)이 deltaIfReported 없으면 감점 0 (만점 유지) | `aggregateTrustScore([{key:"photo",earned:30,max:35,status:"reported"}])` → score=30 (감점 미적용) | `if (item.status==="reported" && item.deltaIfReported)` — delta 미지정/0 이면 패널티 스킵. `src/lib/types/domain.ts:211-213` | "reported = 무조건 기본 감점" 정책이면 분기 수정 필요. **점수정책=기획/백엔드 결정(RV-C)** → SSOT 비수정, 보고만. 현재 동작은 SC-19 로 고정 | 🟡보고만 |
| **BUG-06** | 🟡중간 | formatManwon 음수 입력 시 빈 문자열("") 반환 | `formatManwon(-100)` → `""` (기대: "0" 또는 음수 표기) | `if(!manwon)return"0"` 는 -100(truthy) 통과 → eok/rest 둘 다 ≤0 으로 if 스킵 → `parts=[]`. `src/lib/utils.ts:12-20` | 입력 가드 `if(manwon<=0)return"0"` 또는 음수 명시 처리. 순수함수=안전수정 가능하나 **음수 보증금/월세는 도메인상 비정상값**이라 데이터 유효성(zod)에서 차단되는지 확인 후 결정 권고. 현재 동작은 UT-07 로 고정 | 🟡보고만 |
| **BUG-07** | 🟡중간 | RV-K: listingId 미존재 시 "placeholder-listing-id" 하드코드 | step 파라미터 없이 /verify 진입 → listingId="placeholder-listing-id" 로 세팅 | `setListingId("placeholder-listing-id")`. `src/app/verify/page.tsx:226-230` | 실제 매물 선택 플로우 연결(업로드 와이어링 미완). **미완성 기능=프론트팀(RV-F)** | ⚠️ 가드 수정·와이어링 잔여(§9) |
| **BUG-08** | 🟡중간 | GET /api/listings 500 응답에 내부 에러 메시지 그대로 노출 | getListings throw("...SELECT secret_col") → 500 body.error.message 에 원문 포함 | catch 에서 `err.message` 를 그대로 응답 body 에 주입. `src/app/api/listings/route.ts:51-53` | 서버 로그로만 상세 남기고 클라엔 일반 메시지("일시적 오류"). 정보누출=보안. **프로덕션 마스킹 권고**, 현재 동작은 API-02/02b 로 고정(보고만) | 🟡보고만 |

---

## 2. 절대제약 7대 검증 (RV-* 동작 확정)

| 제약 | 케이스 | 결과 | 근거(테스트) |
|---|---|---|---|
| 1. 정렬=서버 사전계산값 | RV-01/02 | ✅ 준수 | getListings 기본 `.order("sort_rank",{ascending:false})`, 프론트 재정렬 없음(입력순 보존). `constraints` RV-01/02 |
| 2. 낙관적 UI 금지 | RV-03 | ✅ 준수 | useReportMutation onSuccess = invalidateQueries 만, setQueryData 미호출. `constraints` RV-03 / 업로드는 done 전 scoreDelta·badge null(API-17) |
| 3. 세입자만 업로드 | RV / API-09~11 | ✅ 준수 | role≠tenant·미인증·identity_verified=false·프로필부재 전부 403. `photos-route` API-09~11b |
| 4. 본인인증 게이트 | API-11 | ✅ 준수 | identity_verified=false → 403. (실제 PASS 게이트 라이브검증은 인프라 영역) |
| 5. 원본 비공개/공개=블러통과본만 | RV-09 / API-14 | ✅ 준수 | 업로드는 `listing-photos-original`(비공개 버킷) 저장, getListingById.photoUrls 는 status="approved" && blurred_path!=null 만. `constraints` RV-09 / `photos-route` API-14 |
| 6. 신고/내림 매물 리스트 제외 | RV-12/13 | ✅ 준수(쿼리) | getListings 에 `.not("status","in",'("reported","taken_down")')` + `.is("deleted_at",null)`. `constraints` RV-12/13. ⚠️ 신고→status='reported' 전환은 **DB 트리거(라이브 필요)** = 정적리뷰 분리 |
| 7. pending(null) ≠ 0점 | RV-14 | ✅ 준수 | mapScoreItemRow 가 earned=null 보존(0 변환 안 함), aggregateTrustScore 가 pending 제외+isLowerBound=true, 0점은 0 유지. `constraints` RV-14 / `domain-score` SC-13~18 |

---

## 3. RV-* 코드리뷰 항목 — 확정/반증/보류

| 항목 | 판정 | 근거 |
|---|---|---|
| RV-A (Step4 폴링 에러화면 부재) | **확정** | BUG-02. error/paused 시 분기 없음(verify/page.tsx:94-133). 수정은 프론트 UI 영역 |
| RV-C (reported 감점 정책) | **확정(정책결정 보류)** | BUG-05. delta 없으면 감점 0. SSOT 비수정 → 기획/백엔드 결정 필요 |
| RV-D (score sort_rank 공식: Edge vs DB) | **보류(라이브 필요)** | 정렬값 적용 자체는 RV-02 로 확인. 공식 산출 위치/정확도는 Edge·트리거 실행 필요 → 정적 분리 |
| RV-F (업로드 와이어링 미완) | **확정** | BUG-07. placeholder-listing-id. 미완성 기능=프론트 영역 |
| RV-I (500 내부메시지 누출) | **확정** | BUG-08. API-02 에서 body.error.message 에 throw 메시지 노출 실측 |
| RV-K (placeholder listingId) | **확정** | = RV-F/BUG-07 |
| RV-01·02·03·09·12·13·14 | **확정(준수)** | §2 표 참조. 모두 동작 기반 PASS |
| RV-07 (상세페이지 RSC, "use client" 없음) | **확정(준수)** | 상세 페이지는 서버 컴포넌트로 원본 비노출 경로 유지 |
| RV-06/10/11 (RLS·트리거·Edge Function) | **반증 아님 / 라이브 보류** | 단위 환경에서 검증 불가. 신고→비공개 트리거, 본인인증 PASS, photo-pipeline Edge 는 통합/스테이징에서 검증 필요(아래 §5) |
| 폴링 중단 로직 (useUploadStatus) | **확정(준수)** | done/error → refetchInterval=false, uploadId=null → enabled=false. `upload-status-hook` ST-11~13 |

> **반증된 항목**: 사전 의심되던 "프론트 재정렬 존재(RV-01)", "낙관적 캐시조작(RV-03)", "pending→0점 변환(RV-14)", "공개 경로에 원본 포함(RV-09)" 은 **모두 거짓으로 확인**(코드가 제약을 준수). 즉 데이터/쿼리 레이어는 7대 제약을 잘 지키고 있으며, 결함은 **프론트 상태분기(BUG-01~04)** 와 **정책/보안 마감(BUG-05·08)** 에 집중.

---

## 4. 즉시 수정 적용 상세 — BUG-01

**파일**: `src/app/providers.tsx`
**변경**: `defaultOptions.queries.networkMode = "always"` + `mutations.networkMode = "always"` 추가.
**근거**: 기본 `"online"` 에서 오프라인/실패가 paused 로 멈춰 isError 를 우회 → 검색홈이 빈 결과로 오인. `"always"` 면 실패가 즉시 error 로 표면화.
**검증**:
- `ST-05b`(버그 재현): networkMode 미설정 → `fetchStatus="paused"`, `status="pending"`, EmptyState 오표시 — 실측 고정.
- `ST-05`(수정 검증): networkMode="always" → ErrorState("잠시 연결이 끊겼습니다") 표시, EmptyState 미노출 — GREEN.
- 부수효과: 기존 151 테스트 무력화 없음, type-check clean.

> 이 수정은 QA 작업범위의 "허용된 안전수정(헤드라인 paused 근본수정)" 에 해당. 그 외 프론트 신규화면/정책결정/미완기능/라이브인프라는 **보고만** 처리.

---

## 5. 라이브/통합 검증 필요 (단위환경 검증 불가 — 출시 전 필수)

1. **신고 즉시 비공개 트리거** — reports insert 후 listings.status='reported' 전환(DB설계자 트리거). 통합DB에서 신고→리스트 즉시 제외 E2E 확인.
2. **본인인증 PASS 게이트** — identity_verified 실제 갱신 흐름(외부 PASS 연동).
3. **RLS 정책** — service_role 우회 외 일반 사용자 권한 경계(M0 이후).
4. **photo-pipeline Edge Function** — 블러 처리·status=approved 승격·score_delta 산출(현재 로컬은 SUPABASE_FUNCTIONS_URL 미설정으로 트리거 스킵 로그 확인됨).

---

## 6. 출시 차단(release-blocking) 잔여 이슈

- 🔴 **BUG-01** — ⚠️ providers.tsx 수정 적용했으나 **PM 브라우저 검증서 paused 잔존**(§8). 단위테스트만 GREEN, 런타임 재검증 필요.
- 🟠 **BUG-02** — Step4 데드엔드. 사용자가 업로드 실패 시 빠져나올 길이 없음 → **프론트팀 에러화면 필수**. 미해결 시 출시 위험.
- 🟠 **BUG-03/BUG-07** — 죽은 버튼 + placeholder 매물ID. 업로드 플로우 미완 → **프론트 와이어링 필요**.
- 🟡 **BUG-05/BUG-08** — 점수정책 확정(기획/백엔드) + 500 메시지 마스킹(보안). 출시 전 권고.
- ⏳ **§5 라이브 4종** — 통합/스테이징 검증 없이는 7대 제약 중 "신고 비공개·본인인증·원본 비공개(파이프라인)" 의 실런타임 보장 불가.

---

## 7. 보고용 결론 (5줄)

1. **P0 151 테스트 GREEN / 1 SKIP(의도된 BUG-02 가드) / type-check clean** — 점수엔진·zod·포맷·컴포넌트·상태·API·7대제약을 동작 기반으로 검증.
2. **헤드라인 BUG-01(검색홈 paused→빈화면)** — providers.tsx networkMode='always' 적용·ST-05 단위회귀 GREEN. **단, PM 브라우저 검증서 런타임 paused 잔존(§8) → 미해소·재검증 필요**(단위테스트 거짓양성 사례).
3. **데이터/쿼리 레이어는 7대 절대제약 전부 준수** — 의심됐던 재정렬·낙관조작·pending 0점·원본노출은 모두 반증(거짓).
4. **결함은 프론트 마감에 집중** — BUG-02(데드엔드)/03·04(죽은버튼)/07(placeholder) = 프론트팀 영역, 보고만.
5. **출시 전 필수**: BUG-02 에러화면 + §5 라이브 4종(트리거·본인인증·RLS·Edge) 통합검증. BUG-05(정책)·BUG-08(보안마스킹) 권고.

---

## 8. PM 브라우저 런타임 검증 노트 (BUG-01 재평가) — 2026-06-03

> @QA실행자 단위테스트(ST-05)는 GREEN 이나, PM이 **실제 dev 서버(localhost:3002)** 를 띄워 브라우저로 확인한 결과 BUG-01 의 **런타임 증상이 그대로 재현**됨. 단위테스트가 런타임 수정 효과를 보장하지 못한 사례로 기록한다.

**확정 사실 (브라우저 실측):**
- providers.tsx 수정이 반영된 새 번들에서 라이브 `QueryClient.getDefaultOptions().queries.networkMode === "always"`, 해당 쿼리 `options.networkMode === "always"` 확인.
- 그럼에도 `/api/listings` 실패 후 쿼리가 `status:"pending" / fetchStatus:"paused" / failureCount:1` 로 **여전히 멈춤** → 화면은 ErrorState 가 아니라 **EmptyState("0개 매물")** 유지. 강제 `q.fetch()` 재호출에도 paused 지속.
- `navigator.onLine === true`, `document.hasFocus() === false`. 합성 online/focus/visibilitychange 이벤트로는 해제되지 않음.

**해석:**
- `networkMode:"always"` 는 React Query 의 **온라인 게이트(canFetch)** 를 우회하는데도 paused 가 유지됨 → BUG-01 의 pause 원인이 단순 online 판정이 아님. 임베디드 프리뷰 탭이 **비포커스(hasFocus=false)** 인 점이 유력한 환경 요인(실사용자 탭은 포커스 상태).
- 따라서 (a) **networkMode 수정만으로 프리뷰 런타임 증상이 해소되지 않음**, (b) ST-05 는 online/focus 매니저를 모킹으로 우회하므로 **런타임 수정의 증거가 되지 못함**(거짓 양성).

**재평가:**
- 심각도: 🔴치명 → **🟠높음 / 판정보류**. 포커스+온라인 실사용자가 서버 500 을 만나는 일반 케이스는 RQ 의미상 pause 를 지나 error→ErrorState 로 갈 가능성이 높음(미확인). 증상은 주로 **비포커스/백그라운드/실오프라인 + 캐시 없음** 조건에서 발생.
- 상태: "✅ 수정함" → **⚠️ 수정 적용·런타임 미검증**.

**권장 후속:**
1. 포커스된 실제 브라우저(또는 Playwright 등 E2E)에서 서버 오류·오프라인을 각각 재현해 ErrorState 노출을 직접 확인.
2. 데이터 없음 + paused 일 때 EmptyState 대신 중립 로딩/오프라인 안내를 보이도록 page 분기에 `isPaused`(또는 `fetchStatus==="paused"`) 처리 추가 검토 — BUG-02(폴링 데드엔드)와 동일 계열 결함.
3. networkMode 변경은 무해하므로 유지 가능하나, **단독으로 "해결"로 간주하지 말 것**.

---

## 9. 프론트팀 수정 사이클 + 런타임 재검증 (BUG-01/02/03/04/07 종결) — 2026-06-03

> §8 에서 "런타임 미검증"으로 남았던 BUG-01 을 포함해, 프론트팀(페이지개발자 구현 → 프론트팀장 리뷰)이 결함을 수정하고 PM이 브라우저로 재검증했다. §8 의 권장 후속(2번: page 분기에 paused 처리 추가)을 그대로 반영한 결과다.

**수정 내용 (전부 `src/app/` 한정, domain.ts·providers.tsx 불변):**
- **BUG-01** `page.tsx` — `useListingsQuery` 에서 `isPaused`/`isSuccess` 추가 구조분해 후 분기 재구성. ErrorState=`isError || (isPaused && !data)`, EmptyState=`isSuccess && items.length===0`, 목록=`isSuccess && items.length>0`, 카운트바=`isSuccess` 게이트. React Query v5 의 `isSuccess` 는 data 확정 시에만 true → paused(pending) 가 Empty/목록으로 낙하 불가(분기 배타).
- **BUG-02** `verify/page.tsx` `Step4Content` — `isError || data?.status==='error' || (isPaused && !data)` → ErrorState(재시도+홈으로). `done===true → step5` 전환은 보존. 데드엔드 제거.
- **BUG-03** Step4 "알림 켜고 나중에 확인하기" → onClick `router.push("/")`, 라벨 "나중에 확인하기"(없는 알림기능 약속 제거).
- **BUG-04** Step5 "게시하기" → 게시 API 부재로 가짜 성공 대신 onClick `router.push("/")`, 라벨 "홈으로".
- **BUG-07** `placeholder-listing-id` 하드코드 제거 → `searchParams.get("listingId")` 로 읽고, step3 도달 시 부재면 ErrorState 가드("매물 정보가 없어요"+홈으로). **잔여**: 검색홈→상세→`/verify?listingId=` 라우팅 와이어링은 백엔드 매물 상세 연동 후 완성 필요(가드만 완료).

**테스트 재조정 (커버리지 무손실):**
- `listings-query-state` ST-05b: 버그 동작(paused→EmptyState) 기대값을 **올바른 동작(paused+무데이터→ErrorState, EmptyState 부재)** 로 반전.
- `upload-status-state` ST-10: `it.skip → it` 활성화, paused→"연결이 끊겼습니다"+재시도+홈·스피너 부재 검증.

**독립 재검증 (프론트팀장, 실측):** `tsc --noEmit` exit 0 · `vitest run` → **16파일 / 151 PASS / 0 SKIP / 0 FAIL**. domain.ts·providers.tsx 불변(mtime 교차확인). 7대 절대제약 유지. 판정 **승인(APPROVED)**. (비차단 백로그 1건: `upload-status-state.test.tsx:97` 의 `onclick !== null || true` 데드 어서션 — 차기 QA 사이클 정리 권고.)

**PM 브라우저 런타임 재검증 (BUG-01 — §8 거짓양성 종결):**
- 새 번들(localhost:3002) `/` 진입, placeholder Supabase 로 `/api/listings` 실패 유도.
- **결과: ErrorState("잠시 연결이 끊겼습니다" + "다시 시도" 버튼) 표시, EmptyState 미노출** — 스크린샷·접근성 스냅샷·DOM 텍스트 매칭 3중 확인, 콘솔 에러 0.
- 결정적: `document.hasFocus() === false`(비포커스 프리뷰 = §8 에서 paused 잔존을 유발하던 바로 그 조건)에서도 ErrorState 로 정상 표면화. 즉 `(isPaused && !data)` 분기가 networkMode 와 무관하게 증상을 해소함.

**상태 전환:** BUG-01 🟠판정보류 → **🟢 종결(런타임 검증완료)**. BUG-02/03/04 → **종결(프론트)**. BUG-07 → 가드 종결, 라우팅 와이어링만 잔여.

**여전히 출시 전 필수(이번 사이클 범위 밖):** §5 라이브 4종(신고 비공개 트리거·본인인증 PASS·RLS·photo-pipeline Edge) 통합검증, BUG-05(reported 감점 정책=기획/백엔드 결정), BUG-08(500 내부메시지 마스킹=보안).
