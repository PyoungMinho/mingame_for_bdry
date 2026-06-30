# 진짜집(Jinjjajip) 프론트엔드 최종 검수 — STEP 6

> 작성: @프론트팀장 (Opus) · 2026-06-03
> 대상: `apps/jinjjajip/src/` 전반 + `tests/` · 기준: `docs/design/real-estate-design-final.md`, `docs/qa/bug-report.md`
> 검증 도구 실측(프론트팀장 직접 실행):
> - `npm run type-check` → **exit 0** (tsc --noEmit, clean)
> - `npm test` (vitest run) → **16 파일 / 151 PASS / 0 SKIP / 0 FAIL** (8.43s)
> 판정 근거는 코드 라인(file:line) + 실행 결과. domain.ts(SSOT)·providers.tsx 불변, 커밋 없음.

---

## 0. 종합 판정

| 항목 | 판정 |
|---|---|
| 전반 | **조건부 합격 (Conditional Pass)** |
| 7대 절대제약(프론트측) | **준수 (위반 0)** |
| 버그수정 통합(BUG-01/02/03/04/07) | **회귀 없음 / 모두 반영** |
| 타입안전·테스트 | 합격 (strict clean, 151 GREEN, 동작 기반) |
| 성능·접근성 | 합격(소폭 개선 권고) |
| **M0 출시 프론트 준비도** | **조건부 GO** — 업로드 실전송 와이어링 + 검색→상세→verify 라우팅 미완이 유일한 차단성 잔여 |

핵심 요약: **데이터/상태/표시 레이어와 7대 제약은 견고하다.** 결함은 코드 품질이 아니라 **미완성 와이어링**(업로드 실전송, 상세→verify 진입 라우팅)에 집중되어 있으며, 이는 백엔드 매물 상세 연동과 묶여 M0 출시 직전/M1 초입에 닫아야 한다.

---

## 1. 아키텍처 — 합격

**폴더구조**: `components/`(common·layout·listing·trust·report·verify·ui) / `app/`(RSC 페이지·route 핸들러) / `lib/`(api 훅·store·data·types·supabase·utils·validation). 프레젠테이션(components) vs 컨테이너/데이터(app·lib/api·lib/data) 분리가 일관됨.

**SSOT 소비**: `src/lib/types/domain.ts` 를 프론트 전 계층이 단일 출처로 소비.
- 컴포넌트 Props: `ListingCard`(`ListingCardProps`), `TrustScoreBadge`, `ScoreBreakdown`(`ScoreBreakdownItem`+`SCORE_ITEM_LABELS` import), `StatusChip`, `ReportSheet`(`ReportPayload`/`ReportReason`) 모두 domain 타입을 직접 import.
- 데이터 레이어: `lib/data/listings.ts:20` 가 `aggregateTrustScore`/`SCORE_WEIGHTS` 를 SSOT 에서 가져와 매핑. 프론트 자체 점수 타입 재정의 없음.
- 라벨/배점/컷오프 하드코딩 부재: `SCORE_WEIGHTS`/`GRADE_CUTOFFS`/`SCORE_ITEM_LABELS` 가 도메인 한 곳에만 존재.

**재사용성**: `ErrorState`/`EmptyState` 가 page·verify Step4·verify Step3 가드에서 공용 재사용(`secondaryAction` 슬롯으로 홈 이동 동선 주입). 좋은 패턴.

**경미 관찰(비차단)**:
- `lib/data/listings.ts:92,182` 가 Supabase 쿼리에 `(supabase as any)` 캐스팅 사용. eslint-disable 주석 동반·이유 명시됨(제네릭 미적용). M1 에서 `supabase/types.ts` 제네릭 결선 시 제거 권고. SSOT/도메인 타입엔 `any` 없음 — strict 규약 위반 아님.

---

## 2. 상태관리 — 합격

**서버상태(React Query) vs 클라이언트상태(Zustand) 분리가 명확**:
- 서버상태: `useListingsQuery`(`lib/api/listings.ts:69`, staleTime 30s), `useReportMutation`(:83), `useUploadStatus`(`lib/api/upload.ts:95`), `useUploadInit`(:60).
- 업로드 플로우 로컬상태: `useUploadStore`(Zustand+persist, `lib/store/upload.ts`). step/listingId/uploadId/passToken/consent 만 persist(`partialize` :46-52) — `uploadResult`(서버 확정 점수/배지 포함)는 persist 제외 → **새로고침 시 낙관적 점수가 되살아나지 않음**. 제약2(낙관금지)와 정합.

**캐시 무효화**: `useReportMutation.onSuccess`(:87-91) 가 `invalidateQueries(["listings"])` + `(["listing", id])` 만 호출, `setQueryData` 없음 → 신고 후 서버 재조회로 비공개 반영. 낙관적 제거 없음(제약2 준수, `absolute-constraints` RV-03 로 동작 고정).

**폴링 제어**: `useUploadStatus.refetchInterval`(:100-104) 가 `done || status==='error'` 시 `false`(중단), 그 외 3000ms. `enabled: uploadId != null`(:99) — null 이면 미실행. `upload-status-hook` ST-11~13 + processing 케이스로 동작 검증됨(모킹 없는 실제 훅 테스트).

**providers**: `networkMode:"always"`(queries·mutations, `providers.tsx:19,22`) — BUG-01 보강 유지(무해). 단 BUG-01 의 실제 런타임 해소는 page 분기(아래 §4)가 담당.

---

## 3. 7대 절대제약 (프론트측) — 위반 0

| 제약 | 판정 | 근거 (file:line) |
|---|---|---|
| ① 정렬=서버 sort_rank, 프론트 재정렬 금지 | ✅ | `lib/data/listings.ts:130` 기본 `.order("sort_rank",{ascending:false})`. page.tsx 는 `data.items` 를 `.map` 만(`page.tsx:229`), `.sort()` 호출 0. `absolute-constraints` RV-01(입력순 보존)/RV-02 동작 고정. |
| ② 낙관적 UI 금지 | ✅ | 신고: `useReportMutation` setQueryData 미사용(§2). 업로드: `PhotoUploader` 서버 확정 전 점수/배지 표시 없음(`status:"processing"` 만). Step5 점수/배지는 `result.scoreDelta`/`badgeAchieved`(서버 done 응답)에서만 렌더, `null/undefined` 가드(`verify/page.tsx:177,182`). store 가 uploadResult persist 제외. |
| ④ 매물 상세 = RSC("use client" 없음) | ✅ | `app/listings/[id]/page.tsx:1` 상단 지시어 없음, `export default async function`(:15) 서버 컴포넌트. 클라 인터랙션만 `ReportButton.tsx`(:1 "use client") 로 분리 — 원본 비노출 경로 유지. |
| ⑦ null=검증대기 ≠ 0점 | ✅ | `mapScoreItemRow`(`lib/data/listings.ts:66`) earned=null 보존(0 변환 없음). `ScoreBreakdown` BarFill(:55) earned===null → 점선바, RightText(:132) → "검증 대기 중"(숫자 아님). `aggregateTrustScore`(domain) pending 제외+`isLowerBound`. TrustScoreBadge "N점~"(:108). `score-breakdown` 테스트 L49-54(="0" 미노출), `absolute-constraints` RV-14(earned=0 은 0 유지 / null 은 null) 동작 고정. |

> 라이브 필요 제약(③세입자만 업로드·④본인인증 게이트·⑤원본 비공개 파이프라인·⑥신고 비공개 트리거)의 **서버측** 보장은 bug-report §5 라이브 4종으로 분리됨(프론트 검수 범위 밖). 프론트 데이터 레이어는 ⑤(공개=approved+blurred only, `listings.ts:219-221`)·⑥(쿼리 제외, `:112-113`)를 준수.

---

## 4. 버그수정 통합 품질 — 회귀 없음

| 버그 | 검증 결과 | 근거 (file:line) |
|---|---|---|
| **BUG-01** paused→EmptyState 낙하 | ✅ 종결 | `page.tsx:51` 에서 `isPaused`/`isSuccess` 구조분해. 분기 **배타성** 확인: ErrorState=`isError \|\| (isPaused && !data)`(:174), EmptyState=`isSuccess && items.length===0`(:181), 목록=`isSuccess && items.length>0`(:224), 카운트바=`isSuccess` 게이트(:131). RQ v5 `isSuccess` 는 data 확정 시에만 true → paused(pending)가 Empty/목록으로 낙하 불가. `listings-query-state` ST-05/05b/06/07 GREEN(ST-05b 는 networkMode='online'+paused 강제에서도 ErrorState 검증). |
| **BUG-02** Step4 데드엔드 | ✅ 종결 | `verify/page.tsx:108-128` `Step4Content` 에 `isError \|\| data?.status==='error' \|\| (isPaused && !data)` → ErrorState(재시도+홈으로). `done===true→step5`(:102) 보존. 무한 스피너 제거. `upload-status-state` ST-09/ST-10(활성화) GREEN. |
| **BUG-03** Step4 죽은 버튼 | ✅ 종결 | `verify/page.tsx:150-156` "나중에 확인하기"에 `onClick={()=>router.push("/")}`. 없는 알림기능 약속 제거(라벨 정직). |
| **BUG-04** Step5 죽은 버튼 | ✅ 종결 | `verify/page.tsx:211-217` "홈으로"에 `onClick={()=>router.push("/")}`. 게시 API 부재 상태에서 가짜 성공 대신 안전 동선. |
| **BUG-07** placeholder 매물ID | ⚠️ 가드 종결 / 라우팅 잔여 | `verify/page.tsx:253` `searchParams.get("listingId")` 로 읽음(하드코드 제거 확인). step3 도달 시 부재면 ErrorState 가드(:299-313 "매물 정보가 없어요"+홈으로). **잔여**: 검색홈/상세에서 `/verify?listingId=` 로 진입시키는 라우팅 와이어링 미완(아래 §7-A). |

**회귀 점검**: 테스트 재조정(ST-05b 기대값 반전, ST-10 skip→활성)이 커버리지 손실 없이 반영됨. 151 PASS 전체 GREEN. BUG-05(reported 감점 정책)·BUG-06(formatManwon 음수)·BUG-08(500 메시지 마스킹)은 "보고만" 항목으로 SSOT/정책/보안 영역 → 프론트 무수정 유지가 맞음(BUG-06 `utils.ts:13` `if(!manwon)return"0"` 음수 미가드 잔존하나, 음수 보증금/월세는 zod 차단 도메인 비정상값이라 비차단).

---

## 5. 타입안전 · 테스트 — 합격

- **TypeScript strict**: `tsc --noEmit` exit 0. 도메인/컴포넌트/훅에 `any` 없음(유일 예외 = data 레이어 Supabase 캐스팅 2곳, 주석·disable 동반 §1). `UploadResultWithDone`(`upload.ts:93`) 로 done 플래그를 SSOT 비수정 상태에서 프론트 교차타입으로 안전 처리 — 좋은 절충.
- **테스트 질(동작 검증)**: 문자열 매칭이 아닌 실제 렌더/상태/응답 검증.
  - 절대제약: `absolute-constraints` 가 실제 `getListings`/`useReportMutation` 실행 + spy 로 재정렬/낙관조작 부재를 동작으로 증명(RV-01/03/14).
  - 상태분기: `listings-query-state` 가 실제 QueryClient + `onlineManager` 로 paused 4상태 재현(ST-05b 가 page 단독 분기 검증).
  - pending≠0: `score-breakdown` L49-54 가 "0" 미노출을 명시 검증.
  - 폴링: `upload-status-hook` 가 모킹 없이 refetchInterval 실값(false/3000) 검증.
- **비차단 백로그 1건**: `tests/state/upload-status-state.test.tsx:97` `expect(btn...onclick !== null || true).toBe(true)` — `|| true` 로 항상 통과하는 **데드 어서션**(BUG-03 onClick 존재를 실제로 검증 못 함). 차기 QA 사이클에서 `fireEvent.click → router.push 호출` 형태로 교체 권고. (bug-report §9 에도 동일 백로그 기재됨.)

---

## 6. 성능 · 접근성 — 합격 (소폭 개선 권고)

**성능**:
- 상세 = RSC(§3 ④) → 초기 페이로드 경량, 원본 미전송.
- `next/image`(`listings/[id]/page.tsx:93` `priority`+`sizes="100vw"`) 대표사진 LCP 최적화. 카드 썸네일은 `loading="lazy"`(`ListingCard.tsx:84`).
- `staleTime`(목록 30s) 로 불필요 재요청 억제. 폴링은 done/error 즉시 중단.
- `motion-reduce:` 클래스 전반 적용(TrustDonut/StatusChip/ScoreBreakdown) — reduced-motion 대응.

**접근성**:
- 등급 = 색+형태 이중코드(`TrustScoreBadge` GradeIcon: gold ShieldCheck / silver Camera+MapPin / unverified HelpCircle+점선+앰버 스트립). 색맹 대응.
- `role` 적절: 카드 article, 배지 status, ErrorState alert, breakdown progressbar(pending 제외), stepper progressbar+aria-valuenow.
- 키보드: 카드 tabIndex=0+Enter/Space 핸들러, 전역 `focus-visible:ring`.
- `aria-live`: 카운트("N개 매물" polite), 업로드 진행/완료, 신고 접수.

**개선 권고(비차단)**:
1. **카드 중복 인터랙션**(`page.tsx:231`): `ListingCard`(tabIndex=0, role=article, onClick, Enter/Space 핸들러)를 `<Link tabIndex={-1} aria-hidden="true">` 로 감쌌으나 `onNavigate` 미주입 → 카드 onClick/keyDown 은 no-op, 실제 이동은 부모 `<a>` 기본동작 의존. 결과: **마우스 클릭은 동작하나 카드 자체 포커스에서 Enter 키 이동 불가**(부모 a 가 aria-hidden+tabIndex=-1 라 포커스 비수신). 권고: (a) Link 제거하고 `onNavigate={(id)=>router.push(...)}` 주입, 또는 (b) 카드의 tabIndex/role/onClick 제거하고 Link 를 포커스 대상으로. 현재도 클릭 동선은 유효하므로 비차단.
2. 헤더 "알림" 버튼(`page.tsx:83`, `my/page.tsx:13`)은 onClick 없음 — 단 M0 알림 미구현으로 의도된 placeholder. 라벨만 있는 비기능 버튼이므로 차기 구현 또는 비활성 표기 권고.

---

## 7. M0 잔여 프론트 리스크 (우선순위)

### A. 🟠 업로드 실전송 + 상세→verify 라우팅 미완 (최우선, 차단성)
- **실전송 미연결**: `useUploadInit`(실제 `POST /api/listings/[id]/photos`, `upload.ts:60`)이 **코드베이스 어디에서도 호출되지 않음**(grep 확인). `PhotoUploader.handleSubmit`(`PhotoUploader.tsx:82-120`)은 실제 fetch 없이 `uploadId: pending-${Date.now()}`(:107) 가짜 ID를 합성해 `onUploadComplete` 호출 → `verify/page.tsx:258` `handleUploadComplete` 가 그 가짜 ID를 `setUploadId` → Step4 `useUploadStatus(가짜ID)` 가 서버에 없는 uploadId 폴링 → 실패. **BUG-02 수정 덕에 데드엔드가 아닌 ErrorState 로 빠지므로 사용자 고착은 없으나, 업로드 자체가 성립하지 않음.** P0 핵심 가치(세입자 사진 업로드)가 E2E 미완.
- **진입 라우팅**: 검색홈/상세에 `/verify?listingId=<id>` 진입점 없음(BUG-07 가드만 완료). 상세 하단 CTA(`listings/[id]/page.tsx:202` "문의하기")도 onClick 미연결.
- **닫는 법**: `PhotoUploader` 가 `onUploadComplete` 전에 `useUploadInit().mutateAsync({listingId, files})` 를 실제 호출하고 그 서버 응답(real uploadId)을 전달하도록 결선 + 상세→verify 진입 버튼 와이어링. 백엔드 매물 상세 연동과 묶임. **M0 출시를 "업로드 가능"으로 정의한다면 차단, "조회/신뢰표시 중심 베타"로 정의하면 비차단.**

### B. 🟡 알림/문의/공유/저장 비기능 버튼 (비차단)
- 헤더 알림, 상세 공유/저장(`listings/[id]/page.tsx:71-84`), 문의하기 onClick 미연결. M0 범위 외 의도된 placeholder. 출시 정의에 따라 숨김/비활성 표기 권고.

### C. 🟡 agent 표시 하드코딩 (비차단)
- `lib/data/listings.ts:232` agent 가 `{name:"중개사",verified:false}` 하드코드(TODO M1: profiles 조인). 상세 중개사 표기가 실데이터 아님. M1 처리.

### D. ⏳ 라이브 의존 (프론트 범위 밖, bug-report §5)
- 신고 비공개 트리거·본인인증 PASS(현재 `auth/verify` mock 토큰 `pass_mock_*`)·RLS·photo-pipeline Edge 의 실런타임은 통합/스테이징 검증 필요. 프론트는 계약 준수 상태로 대기.

---

## 8. 최종 결론

프론트엔드 코드 품질·아키텍처·7대 제약·버그수정 통합은 **출시 가능 수준**이다. 타입/테스트 그린(151 PASS, 0 SKIP, strict clean), 절대제약 위반 0, BUG-01~04/07 회귀 없음.

유일한 실질 차단 요소는 **업로드 실전송 와이어링 미완(§7-A)** 이며, 이는 코드 결함이 아니라 백엔드 매물 상세 연동과 묶인 미완성 기능이다. 따라서:
- M0 정의 = "매물 조회 + 신뢰점수 시각화 + 신고" 중심이면 → **프론트 GO**.
- M0 정의 = "세입자 업로드까지 E2E 동작"이면 → **§7-A 결선 완료 후 GO(조건부)**.

권고: §7-A(업로드 결선 + verify 진입 라우팅)를 M0 출시 직전 단일 스프린트로 닫고, §5 데드 어서션·§6 카드 인터랙션은 차기 QA/리팩터 사이클로 이월.
