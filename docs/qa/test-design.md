# 진짜집(Jinjjajip) 테스트 설계서 — QA설계자 산출물

> 작성: QA설계자 (STEP 5-1)
> 대상 앱: `apps/jinjjajip` (Next.js 14 App Router · React 18 · TS strict · React Query 5 · Supabase)
> 핸드오프 대상: QA실행자 (테스트 코드 구현)
> 검증 인프라: vitest 1.6 + jsdom + @testing-library/react, `vitest.config.ts` include = `tests/**/*.{test,spec}.{ts,tsx}`
> 베이스라인: 컴포넌트 테스트 29/29 통과, `type-check` clean, `build` 성공 (QA실행자 시작 전 확인됨)

---

## 0. 한눈 요약 (TL;DR)

- **전략 한 줄**: 라이브 Supabase가 없으므로 "순수함수·컴포넌트·zod 계약"을 자동화로 100% 조이고, RLS·트리거·Edge Function·API 통합은 정적 리뷰 + 라이브 보류 케이스로 분리한다.
- **최상위 리스크**: React Query `networkMode:'online'`의 **paused 상태가 isError를 우회**해 "오류"를 "빈 결과"로 둔갑시키는 상태처리 갭 (이미 검색 홈에서 발견됨). 데이터 의존 화면 전반의 형제 결함 여부가 릴리즈 게이트의 핵심.
- **7대 절대제약**: 각 제약마다 "깨뜨리는" 회귀 케이스를 배치. Quality Gate = **7대 제약 회귀 0건**.

---

## 1. 테스트 전략

### 1.1 범위 (In / Out)

**In scope (이번 QA 사이클)**
- 신뢰점수 순수함수 (`clampScore`, `computeGrade`, `aggregateTrustScore`) — 경계값·pending·신고감점 전수
- 신뢰 컴포넌트 상태 분기 (TrustScoreBadge, ScoreBreakdown, TrustDonut, ListingCard) — pending≠0 핵심 계약
- 데이터 의존 화면의 loading/empty/error/**paused** 상태처리 (검색 홈, 상세, verify 폴링)
- zod 스키마 계약 (검색쿼리·신고·업로드 init) — 경계·거부 케이스
- API Route 핸들러의 분기·인증·검증 로직 (Supabase 클라이언트 모킹)
- SQL/RLS/트리거/Edge Function **정적 리뷰** (실행 아님, 코드 독해 기반 결함 도출)

**Out of scope (이번 사이클 제외, 사유 명시)**
- 실제 PostgreSQL에서의 RLS 정책 실행 검증 → 라이브 Supabase 필요 (보류)
- Edge Function(Deno) 실 런타임 EXIF/블러/스토리지 I/O → ML·스토리지 의존, 라이브 필요 (보류)
- E2E 브라우저 플로우 (Playwright 등) → 인프라 미구성, 별도 사이클 권장
- 성능(부하·동시접속), PostGIS 반경 검색 → M1 범위
- 실 PASS/통신사 본인인증 연동 → M0는 모의 통과 (`auth/verify/callback` 스텁)

### 1.2 테스트 레이어와 라이브 가능 여부

| 레이어 | 대상 | 라이브 없이 가능? | 도구 |
|---|---|---|---|
| L1 유닛(순수함수) | `domain.ts` 3함수, `utils.ts` 포맷 | ✅ 100% 가능 | vitest (node) |
| L2 컴포넌트 | trust/listing/report/verify 컴포넌트 | ✅ 가능 | vitest + jsdom + RTL |
| L2.5 상태처리(hook) | React Query 훅 paused/error/empty 분기 | ✅ 가능 (QueryClient 주입 + fetch 모킹) | vitest + RTL + QueryClientProvider |
| L3 계약(zod) | `validation/index.ts` 스키마 | ✅ 100% 가능 | vitest (node) |
| L4 API 통합 | Route 핸들러 분기·인증·검증 | △ 부분 (Supabase 모킹) | vitest (node) + 모킹 |
| L5 DB/RLS/트리거 | `migrations/*.sql` | ❌ 정적 리뷰만 (실행=라이브) | 코드 리뷰 + (보류)pgTAP |
| L6 Edge Function | `functions/*` (Deno) | ❌ 정적 리뷰만 | 코드 리뷰 + (보류)Deno test |

### 1.3 우선순위 기준 (리스크 기반)

- **P0**: 7대 절대제약 위반 가능 지점 + 신뢰점수 정확성 + 발견된 paused 버그/형제 결함 + pending≠0 구분. (사용자를 직접 오인시키거나 허위매물 차단 메커니즘을 무력화)
- **P1**: 입력 검증 경계, 인증/인가 분기, 상태 전이, 접근성 핵심.
- **P2**: 표시 포맷, 보조 카피, 비핵심 UI 디테일.

### 1.4 Quality Gate (릴리즈 가능 조건)

1. **7대 절대제약 회귀 0건** (각 제약 회귀 케이스 전부 green).
2. 신뢰점수 순수함수 케이스 100% green, 라인 커버리지 `domain.ts` ≥ 95%.
3. pending(null) vs 0점 구분 케이스 100% green (UI + 집계 양쪽).
4. paused 상태처리 케이스 + 형제 결함 케이스 100% green (수정 후).
5. P0 케이스 전수 green, P1 ≥ 90% green.
6. 신규 테스트 추가 후에도 `type-check` exit 0 유지, 기존 29 테스트 회귀 0.
7. (라이브 보류 케이스는 게이트에서 제외하되, "보류" 명시 — 미검증 사실을 숨기지 않음).

---

## 2. 케이스 매트릭스

> 라이브필요 = "N"은 지금 자동화 가능, "Y"는 실 Supabase/Deno 필요(이번 사이클 보류).
> 대상 파일 경로는 모두 `apps/jinjjajip` 기준.

### 2.1 신뢰점수 순수함수 (`src/lib/types/domain.ts`) — 최우선 P0

| ID | 대상(함수) | 입력 | 기대결과 | 우선 | 라이브 |
|---|---|---|---|---|---|
| SC-01 | clampScore | `-5` | `0` (하한 클램프) | P0 | N |
| SC-02 | clampScore | `150` | `100` (상한 클램프) | P0 | N |
| SC-03 | clampScore | `79.6` | `80` (반올림) | P0 | N |
| SC-04 | clampScore | `NaN` | `0` (NaN 가드) | P0 | N |
| SC-05 | clampScore | `0` | `0` (0 통과) | P1 | N |
| SC-06 | computeGrade | `80` | `"gold"` (Gold 하한 경계) | P0 | N |
| SC-07 | computeGrade | `79` | `"silver"` (Gold 직전) | P0 | N |
| SC-08 | computeGrade | `55` | `"silver"` (Silver 하한 경계) | P0 | N |
| SC-09 | computeGrade | `54` | `"unverified"` (Silver 직전) | P0 | N |
| SC-10 | computeGrade | `0` | `"unverified"` | P1 | N |
| SC-11 | computeGrade | `100` | `"gold"` | P1 | N |
| SC-12 | computeGrade | `79.5` (반올림→80) | `"gold"` (clamp 후 등급) | P0 | N |
| SC-13 | aggregateTrustScore | 5항목 전부 verified 만점 | `score=100, maxPossible=100, isLowerBound=false, badge="gold"` | P0 | N |
| SC-14 | aggregateTrustScore | photo=null/pending, 나머지 verified | `isLowerBound=true`, score는 photo 제외 합, maxPossible=100 | P0 | N |
| SC-15 | aggregateTrustScore | 전 항목 pending(null) | `score=0, isLowerBound=true, maxPossible=100` | P0 | N |
| SC-16 | aggregateTrustScore | community=processing(earned=null) | processing도 pending 취급 → score 제외 + isLowerBound=true | P0 | N |
| SC-17 | aggregateTrustScore | transaction reported earned=5 delta=-5 | 해당항목 0 반영, 나머지 합산 | P0 | N |
| SC-18 | aggregateTrustScore | reported earned=3 delta=-10 | `Math.max(0,-7)=0` (음수 클램프, 0 하한) | P0 | N |
| SC-19 | aggregateTrustScore | reported earned=30 **delta 없음(undefined)** | **현재 구현은 30점 전액 합산** → 회귀 고정(아래 RV-01 참조) | P0 | N |
| SC-20 | aggregateTrustScore | verified인데 earned=null (모순 데이터) | earned===null 우선 → pending 취급, score 제외 | P1 | N |
| SC-21 | aggregateTrustScore | maxPossible 합>100 (malformed max) | maxPossible 100으로 클램프 | P1 | N |
| SC-22 | aggregateTrustScore | reported인데 earned=null | pending 분기 우선(null 체크 먼저) → 감점 미적용, score 제외 | P1 | N |
| SC-23 | aggregateTrustScore | 빈 배열 `[]` | `score=0, maxPossible=0, isLowerBound=false, badge="unverified"` | P1 | N |
| SC-24 | SCORE_WEIGHTS/SCORE_TOTAL | 상수 합 | photo35+exif20+community20+owner15+transaction10 === SCORE_TOTAL(100) | P0 | N |

> SC-19 메모: QA실행자는 "현재 동작(30점 합산)"을 회귀로 고정하되, RV-01 결함을 함께 리포트하라. 두 줄 주석으로 "의도 vs 현재" 명시.

### 2.2 포맷 유틸 (`src/lib/utils.ts`) — P1

| ID | 대상 | 입력 | 기대결과 | 우선 | 라이브 |
|---|---|---|---|---|---|
| UT-01 | formatManwon | `0` | `"0"` | P1 | N |
| UT-02 | formatManwon | `500` | `"500만"` | P1 | N |
| UT-03 | formatManwon | `10000` | `"1억"` | P1 | N |
| UT-04 | formatManwon | `11500` | `"1억 1,500만"` | P1 | N |
| UT-05 | formatDepositRent | `(1000, 0)` | `"전세 1,000만"` (월세0=전세) | P1 | N |
| UT-06 | formatDepositRent | `(1000, 50)` | `"1,000만 / 월 50"` | P1 | N |
| UT-07 | formatManwon | 음수 `-100` | (현재 falsy 아님 → "-100만" 류) 동작 고정 + 결함 검토 | P2 | N |

### 2.3 zod 계약 (`src/lib/validation/index.ts`) — P0/P1

| ID | 대상(스키마) | 입력 | 기대결과 | 우선 | 라이브 |
|---|---|---|---|---|---|
| ZV-01 | listingSearchQuery | `{}` | sort 기본 `"trust"`, limit 기본 `20` | P0 | N |
| ZV-02 | listingSearchQuery | `region:"busan"` | 거부(enum 위반) | P1 | N |
| ZV-03 | listingSearchQuery | `limit:"30"`(문자) | coerce → `30` 통과 | P1 | N |
| ZV-04 | listingSearchQuery | `limit:0` | 거부(min 1) | P1 | N |
| ZV-05 | listingSearchQuery | `limit:51` | 거부(max 50) | P1 | N |
| ZV-06 | listingSearchQuery | `depositMax:-1` | 거부(nonnegative) | P1 | N |
| ZV-07 | reportPayload | `listingId:"not-uuid"` | 거부(UUID 메시지) | P0 | N |
| ZV-08 | reportPayload | `reason:"spam"` | 거부(enum) | P1 | N |
| ZV-09 | reportPayload | detail 201자 | 거부(max 200) | P1 | N |
| ZV-10 | reportPayload | detail 200자 정확 | 통과(경계) | P1 | N |
| ZV-11 | reportPayload | 정상 `fake_listing`+uuid | 통과 | P0 | N |
| ZV-12 | uploadInit | `fileCount:0` | 거부(min 1) | P0 | N |
| ZV-13 | uploadInit | `fileCount:11` | 거부(max 10) | P0 | N |
| ZV-14 | uploadInit | fileMetas size `20MB+1` | 거부(20MB 초과) | P0 | N |
| ZV-15 | uploadInit | mimeType `image/gif` | 거부(허용 4종 외) | P0 | N |
| ZV-16 | uploadInit | mimeType `image/heic` | 통과(허용) | P1 | N |
| ZV-17 | uploadInit | fileMetas size `0` | 거부(positive) | P1 | N |

### 2.4 컴포넌트 — pending≠0 + 등급 표시 (제약 7) — P0

| ID | 대상 | 시나리오/입력 | 기대결과 | 우선 | 라이브 |
|---|---|---|---|---|---|
| CP-01 | ScoreBreakdown | earned=null status=pending | "검증 대기 중" 표기, "0/35" 류 없음 | P0 | N |
| CP-02 | ScoreBreakdown | earned=0 status=verified | "0/20" 정상 표기 (0점은 보여줌) | P0 | N |
| CP-03 | ScoreBreakdown | earned=null status=processing | "분석 중" (pending과 구분) | P0 | N |
| CP-04 | ScoreBreakdown | pending detail variant | 보조카피 "허위매물 신호가 아니에요" 노출 | P1 | N |
| CP-05 | ScoreBreakdown | pending mini variant | 보조카피 미노출 | P2 | N |
| CP-06 | ScoreBreakdown | reported earned=5 delta=-5 | "신고 접수됨 -5점" 표기 | P1 | N |
| CP-07 | ScoreBreakdown | pending 항목 progressbar role | pending엔 progressbar role 없음(점선만) | P1 | N |
| CP-08 | TrustScoreBadge | scoreIsLowerBound=true score=72 | "72점~" 하한 표기 (제약 7) | P0 | N |
| CP-09 | TrustScoreBadge | scoreIsLowerBound=false score=82 | "82점" (틸드 없음) | P0 | N |
| CP-10 | TrustScoreBadge | grade=unverified | 앰버 경고 스트립 자동 노출 | P1 | N |
| CP-11 | TrustScoreBadge | lowerBound+maxPossible=92 standard | "최대 92점까지 가능" | P1 | N |
| CP-12 | TrustScoreBadge | compact variant | 자연어 라벨 미노출 | P2 | N |
| CP-13 | TrustDonut | score=0 | 아크 길이 0 (빈 도넛), aria "0점" | P1 | N |
| CP-14 | TrustDonut | score=3 (5 미만) | 최소 아크 8px 보장(빈 도넛 방지) | P2 | N |
| CP-15 | TrustDonut | score=120 (초과) | clamp 100, aria "100점" | P1 | N |
| CP-16 | ListingCard | pending 항목 포함 | "점수 변동 가능" 보조 텍스트 노출 | P1 | N |
| CP-17 | ListingCard | status=processing | "사진 분석 중" 배너 | P1 | N |
| CP-18 | ListingCard | trustGrade=unverified | 앰버 border-t-4 클래스 | P2 | N |
| CP-19 | StatusChip | status="processing" | 처리중 칩 렌더 (현재 미테스트 컴포넌트) | P2 | N |

### 2.5 ★발견 버그 + 상태처리(loading/empty/error/paused) — P0

> 핵심: React Query 훅을 QueryClientProvider로 감싸고 `fetch`를 모킹해 상태 분기를 직접 검증한다.
> paused 재현: `networkMode` 기본값 환경에서 fetch reject 후 `navigator.onLine` 조작 또는 QueryClient의 onlineManager로 paused 유도.
> 대안(더 안정적): 페이지 분기 로직을 "상태 → 렌더 종류" 매핑 함수로 보고, `{isLoading,isError,fetchStatus,data}` 조합을 입력으로 한 **렌더 결정 테이블** 테스트.

| ID | 대상 | 시나리오/입력 | 기대결과 | 우선 | 라이브 |
|---|---|---|---|---|---|
| ST-01 | `app/page.tsx` 분기 | isLoading=true | 스켈레톤(6개) 렌더, EmptyState/ErrorState 없음 | P0 | N |
| ST-02 | `app/page.tsx` 분기 | isError=true | ErrorState("잠시 연결이 끊겼습니다") + 재시도 버튼 | P0 | N |
| ST-03 | `app/page.tsx` 분기 | data=빈 items, 필터없음 | EmptyState "현재 관악구·마포구에서 서비스 중입니다" | P0 | N |
| ST-04 | `app/page.tsx` 분기 | data=빈 items, 필터있음 | EmptyState "조건에 맞는 매물이 없어요" + 필터초기화 | P1 | N |
| **ST-05** | **`app/page.tsx`+useListingsQuery** | **fetch 500 후 paused (isLoading=F,isError=F,data=undefined)** | **현재: EmptyState 오표시(버그). 수정 후: ErrorState 표시** | **P0** | N |
| ST-06 | useListingsQuery | fetch 거부 1회 후 retry:1 소진 | 최종 isError=true (paused 아닌 정상 네트워크 시) | P0 | N |
| ST-07 | `app/page.tsx` 카운트바 | isError=true | "N개 매물" 카운트/정렬바 미노출 | P1 | N |
| ST-08 | `verify` Step4Content | useUploadStatus data.done=true | onComplete 호출 → step5 전환 | P0 | N |
| ST-09 | `verify` Step4Content | data.status="error" | step5 전환 안 함(폴링 화면 유지), 에러 안내 부재 결함 검토 | P0 | N |
| **ST-10** | **`verify` Step4Content** | **폴링 fetch 500 후 paused (data=undefined 지속)** | **무한 스피너 "사진 분석 중" 고착 여부 점검 (형제 결함 후보)** | **P0** | N |
| ST-11 | useUploadStatus | data.done=true | refetchInterval=false (폴링 중단) | P0 | N |
| ST-12 | useUploadStatus | data.status="error" | refetchInterval=false (폴링 중단) | P0 | N |
| ST-13 | useUploadStatus | uploadId=null | enabled=false (쿼리 비실행) | P1 | N |
| ST-14 | ErrorState | onRetry 주입 | 버튼 클릭 시 onRetry 호출 | P1 | N |
| ST-15 | `listings/[id]` (RSC) | getListingById=null | notFound() 호출 (404) — 상세는 RSC라 paused 무관(제약 4 검증) | P0 | Y* |

> ST-15 라이브* : RSC 자체 분기는 `getListingById` 모킹으로 N 가능하나, 실 데이터 흐름은 라이브 필요. 모킹 단위는 N, 통합은 Y.

### 2.6 7대 절대제약 회귀 — 각 제약 "깨뜨리는" 케이스 — P0

| ID | 제약# | 검증 방식 | 입력/시나리오 | 기대결과(준수) | 우선 | 라이브 |
|---|---|---|---|---|---|---|
| RV-01 | 1 정렬=서버 | 코드 정적 + 데이터 | `app/page.tsx`가 `data.items`를 **재정렬하지 않고** 그대로 map. 의도적으로 역순 데이터 주입 | 서버 제공 순서 그대로 렌더(.sort 호출 부재) | P0 | N |
| RV-02 | 1 정렬=서버 | `data/listings.ts` 정적 | sort 분기가 항상 `.order(sort_rank desc)` 기본 | 프론트 정렬 코드 없음 확인 | P0 | N |
| RV-03 | 2 낙관금지 | useReportMutation | mutation onSuccess가 **invalidateQueries만** 수행(낙관 제거 없음) | 캐시 직접 setQueryData 제거 없음 | P0 | N |
| RV-04 | 2 낙관금지 | upload 흐름 | PhotoUploader/Step5가 서버 done 전 점수/배지 미표시 | done=true 전엔 scoreDelta/badge 렌더 안 함 | P0 | N |
| RV-05 | 3 EXIF/블러=서버 | 정적 리뷰 | 클라(`PhotoUploader`)에 EXIF 파싱/블러 코드 부재 | 클라엔 파일선택·UI상태만 | P0 | N |
| RV-06 | 3 EXIF/블러=서버 | 정적 리뷰 | EXIF/블러 로직은 `functions/photo-pipeline`에만 존재 | 워커 전담 확인 | P0 | Y(실행) |
| RV-07 | 4 상세=RSC | 정적 | `listings/[id]/page.tsx` 에 `"use client"` 부재 + async 서버컴포넌트 | RSC 렌더 확인 | P0 | N |
| RV-08 | 5 원본 비공개 | photos route 정적 | 업로드는 `listing-photos-original`(private)에만 저장 | PRIVATE_BUCKET 상수 사용 확인 | P0 | N |
| RV-09 | 5 공개=블러통과본 | `data/listings.ts` 정적 | photoUrls = `status='approved' && blurred_path!=null`만 | original_path 노출 부재 | P0 | N |
| RV-10 | 5 원본 비공개 | RLS 정적 | `004_rls.sql` photos select 정책이 approved만 공개 | original 접근 차단(+버킷정책 주석) | P0 | Y(실행) |
| RV-11 | 6 신고즉시비공개 | reports route + 트리거 정적 | insert 후 `trg_reports_takedown`이 status='reported' | 신고 즉시 전환 경로 확인 | P0 | Y(실행) |
| RV-12 | 6 리스트제외 | `data/listings.ts` 정적 | `.not("status","in",'("reported","taken_down")')` 존재 | 신고/내림 매물 리스트 제외 | P0 | N |
| RV-13 | 6 리스트제외 | getListings 데이터 | reported 로우 모킹 주입 시 결과 제외(쿼리 필터 신뢰) | 쿼리 필터 체인 검증 | P0 | N |
| RV-14 | 7 pending≠0 | `data/listings.ts` mapScoreItemRow | earned=null 로우 → ScoreBreakdownItem.earned===null (0 변환 금지) | null 보존 | P0 | N |
| RV-15 | 7 pending≠0 | UI 통합 | CP-01/CP-08과 연동: null→"검증 대기 중"+"N점~" | 0 표기 절대 부재 | P0 | N |

### 2.7 API Route 핸들러 (Supabase 모킹) — P0/P1

> 모킹 전략: `@/lib/supabase/server`의 `createServerClient`/`getRequestUserId`를 vi.mock으로 대체.
> from().select().eq()... 체이너블 mock 또는 thenable mock 빌더 필요(QA실행자가 작성).

| ID | 대상 | 시나리오 | 기대결과 | 우선 | 라이브 |
|---|---|---|---|---|---|
| API-01 | GET /api/listings | 잘못된 limit=999 | 400 VALIDATION_ERROR | P1 | N |
| API-02 | GET /api/listings | getListings throw | 500 INTERNAL_ERROR(메시지 노출 검토) | P1 | N |
| API-03 | GET /api/listings | 정상 | success:true + data.items + meta.cursor | P1 | N |
| API-04 | POST reports | userId=null(미인증) | 401 UNAUTHORIZED | P0 | N |
| API-05 | POST reports | body JSON 파싱 실패 | 400 PARSE_ERROR | P1 | N |
| API-06 | POST reports | listingId가 path와 합쳐져 검증 | path id 우선 주입 확인 | P1 | N |
| API-07 | POST reports | 매물 없음 | 404 NOT_FOUND | P1 | N |
| API-08 | POST reports | 정상 insert | 204 No Content | P0 | N |
| API-09 | POST photos | userId=null | 403(로그인 필요) | P0 | N |
| API-10 | POST photos | role!=tenant | 403 (허위매물 차단 게이트) | P0 | N |
| API-11 | POST photos | identity_verified=false | 403 (게이트) | P0 | N |
| API-12 | POST photos | listing status=reported | 403(신고매물 업로드 금지) | P0 | N |
| API-13 | POST photos | fileCount=0/11 | 400 | P1 | N |
| API-14 | POST photos | 정상 | 202 + status:"processing", done:false (낙관금지) | P0 | N |
| API-15 | GET uploads/[id] | uploader_id≠userId | 404 (타인 업로드 차단) | P0 | N |
| API-16 | GET uploads/[id] | status=done | done:true + scoreDelta/badge 채움 | P1 | N |
| API-17 | GET uploads/[id] | status=processing | done:false + scoreDelta=null | P0 | N |
| API-18 | GET auth/verify/callback | result=fail | /verify?auth_error=pass_failed 리다이렉트 | P1 | Y* |
| API-19 | GET auth/verify/callback | token 없음 | 실패 리다이렉트 | P1 | Y* |

### 2.8 RLS / 트리거 / Edge Function 정적 리뷰 (라이브 보류) — P0 (리뷰), 실행 Y

| ID | 대상 | 검증 포인트 | 기대 | 우선 | 라이브 |
|---|---|---|---|---|---|
| DB-01 | `004_rls.sql` photos insert | tenant + identity_verified + uploader=uid 3조건 | 허위매물 차단 게이트 정합 | P0 | Y |
| DB-02 | `004_rls.sql` photos select | approved만 공개 정책 | 원본 차단(제약5) | P0 | Y |
| DB-03 | `004_rls.sql` score_items | 클라 write 정책 부재(service_role만) | 점수 위변조 차단 | P0 | Y |
| DB-04 | `005_*.sql` recompute | null/pending 제외 + reported 0클램프 = domain.ts 동치 | 서버·프론트 점수 일치 | P0 | Y |
| DB-05 | `005_*.sql` trg_reports_takedown | insert AFTER → status='reported' | 신고 즉시 비공개(제약6) | P0 | Y |
| DB-06 | `005_*.sql` init_score_items | listing insert 시 5행 earned=null pending | pending 시작(제약7) | P0 | Y |
| DB-07 | photo-pipeline | original 비공개 유지 + blurred만 공개버킷 | 제약3·5 | P0 | Y |
| DB-08 | photo-pipeline | EXIF 검증 0점 vs pending 구분(검증실패=0, 미조회=null) | 제약7 의미론 | P0 | Y |

---

## 3. 코드 리뷰 발견사항

> 실제 파일을 읽고 발견한 것만 기재. 심각도: 🔴치명 / 🟠높음 / 🟡중간 / 🔵낮음(개선).
> "추측"은 추측으로 명시.

### 🔴 RV-A. paused 상태 형제 결함 — `verify` 폴링 (Step4Content)
**파일**: `src/app/verify/page.tsx` L94-133 + `src/lib/api/upload.ts` L95-107
**근본 동일성**: 검색 홈 버그와 **동일한 networkMode 메커니즘**. `useUploadStatus`는 `useQuery`이고 `app/providers.tsx`의 기본 `networkMode`(=online)를 상속한다. 폴링 중 GET `/api/uploads/[id]`가 1회라도 실패하면 React Query가 `fetchStatus:'paused'`로 멈출 수 있고, 그러면 `data`는 `undefined`로 고착된다.
**증상(코드상)**: Step4Content는 `data?.done === true`일 때만 step5로 전환하고, 그 외엔 무조건 "사진 분석 중" 스피너를 렌더한다(L105-132). 에러/paused 분기가 **전혀 없다**. 즉 폴링이 죽으면 사용자는 **영원히 "분석 중" 화면에 갇힌다**(검색 홈의 "빈 결과 오인"과 대칭되는 "무한 로딩 오인").
**확정 vs 추측**: 코드상 에러 분기 부재는 **확정**. 실제 paused 진입은 검색 홈과 동일 메커니즘이므로 **고확률(라이브 미검증)**.
**권고**: (1) QueryClient 기본 `networkMode:'always'` 설정으로 paused 자체를 제거(검색 홈 + 폴링 동시 해결, 단일 수정점). (2) Step4Content에 `isError`/`status==='error'` 분기 추가 + 재시도/이탈 동선. (3) 폴링 최대 시도/타임아웃(예: 40회=2분) 후 타임아웃 화면.

### 🟠 RV-B. `useListingsQuery`/`useUploadStatus`에 networkMode 미설정 (근본원인 일원화 부재)
**파일**: `src/app/providers.tsx` L9-18, `src/lib/api/listings.ts` L72-77, `src/lib/api/upload.ts` L96-107
**내용**: 발견 버그의 근본원인은 React Query 기본 `networkMode:'online'`. 현재 어디에도 `networkMode`가 명시되지 않아 모든 쿼리가 paused 위험에 노출된다. 화면별 분기 보강(ErrorState 추가)도 필요하지만, **단일 진실의 수정점은 providers.tsx**다. 화면마다 paused 분기를 따로 다는 것은 누락 위험이 크다.
**권고**: `defaultOptions.queries.networkMode = 'always'`(또는 mutations 포함) 추가를 1순위 수정으로. 이후 ST-05/ST-10 회귀 테스트로 고정.

### 🟠 RV-C. `aggregateTrustScore` — reported 항목에 `deltaIfReported`가 없으면 감점 0, 전액 합산
**파일**: `src/lib/types/domain.ts` L211-214
**증거(내가 실행)**: `aggregateTrustScore([{key:"photo",earned:30,max:35,status:"reported"}])` → `score:30`. 즉 status가 reported여도 delta가 undefined면 30점이 그대로 신뢰점수에 들어간다.
**영향**: 제약6은 "신고 매물 리스트 제외 + 즉시 비공개"라 **리스트엔 영향 없음**. 그러나 상세(`getListingById`)는 reported 매물도 조회 가능(RLS `listings_select_public`이 taken_down만 제외)하고, 이때 trust.breakdown 집계에 reported 항목이 전액 반영되면 "신고된 항목인데 만점"인 모순 표시가 가능. 단, 상세에서 score는 서버 `trust_score`로 덮어쓰므로(L228) 표시 점수 자체는 서버값. **breakdown 막대/문구만 모순 위험**.
**확정 vs 추측**: 함수 동작은 **확정**. UI 모순 노출은 reported 상세 진입 시에만이며 **조건부(추측 일부)**.
**권고**: (a) reported 항목은 delta 유무와 무관하게 earned를 0 또는 max-delta 규약으로 강제, 또는 (b) 백엔드가 reported 시 delta_if_reported를 반드시 채우도록 계약 고정. SC-19로 현재 동작 회귀 고정 후 결정.

### 🟠 RV-D. `score-engine` Edge Function이 sort_rank 공식을 DB 함수와 다르게 계산 (이중 권위 충돌)
**파일**: `functions/score-engine/index.ts` L89-93 vs `005_functions_triggers.sql` L78-83
**내용**: 두 곳이 모두 sort_rank를 계산하는데 **공식이 다르다**.
- DB `recompute_listing_score`: `trust_score*1000 - 경과일수` (제약1의 서버 사전계산 SSOT, 동점 시 최신 우선).
- Edge `computeSortRank`: `gradeBonus(gold200/silver100) + score` (전혀 다른 스케일·의미).
photo-pipeline은 완료 후 `recompute_listing_score`(DB)를 호출하므로(L313) 최종 권위는 DB일 가능성이 높지만, score-engine이 별도로 호출되면(신고 처리 등 L9-12 주석) listings.sort_rank를 자기 공식으로 덮어쓴다. **정렬 기준이 호출 경로에 따라 뒤바뀐다** → 제약1(정렬=서버 사전계산값의 일관성) 잠재 위반.
**확정 vs 추측**: 공식 불일치는 **확정**. 실제 충돌은 score-engine 호출 시점/빈도에 의존 **(라이브 미검증)**.
**권고**: sort_rank 계산을 **DB 함수 단일 출처로 통일**, score-engine은 점수만 갱신 후 `recompute_listing_score` 호출하도록 일원화. DB-04에 정렬 공식 동치 검증 추가.

### 🟡 RV-E. `ReportSheet.handleSubmit`가 실패를 삼켜 성공처럼 처리할 위험
**파일**: `src/components/report/ReportSheet.tsx` L44-59
**내용**: `try { await onSubmit(...); setSubmitted(true);} finally { setIsSubmitting(false);}` — **catch가 없다**. `onSubmit`(=ReportButton의 mutateAsync)이 reject하면 예외가 위로 전파되어 `setSubmitted(true)`는 실행되지 않지만(다행), **사용자에게 에러 메시지가 표시되지 않는다**. 화면은 그냥 폼 상태로 남고 버튼만 다시 활성화된다. 신고 실패를 사용자가 인지 못 함 → "신고했다고 믿지만 접수 안 됨" 위험.
**확정**: 코드상 에러 UI 부재 확정.
**권고**: catch 추가 → 인라인 에러 표시. 테스트: onSubmit reject 시 submitted=false 유지 + 에러 노출(현재는 에러 노출 케이스가 실패할 것 → 결함 고정용).

### 🟡 RV-F. `PhotoUploader`가 실제 업로드를 하지 않고 가짜 uploadId로 SUCCESS 표시
**파일**: `src/components/verify/PhotoUploader.tsx` L82-120
**내용**: `handleSubmit`이 네트워크 호출 없이 `uploadId: pending-${Date.now()}` 가짜 결과로 `onUploadComplete` 호출 후 `setPhase("SUCCESS")`. 주석상 "페이지팀이 실제 fetch를 onUploadComplete 전에 수행"하도록 설계됐으나, `verify/page.tsx`의 `handleUploadComplete`(L232-238)는 **실제 fetch 없이** `setUploadId(result.uploadId)`만 한다. 즉 현재 verify 플로우는 **실제 업로드 API를 호출하지 않는다**(`useUploadInit` 훅이 어디서도 사용되지 않음 — grep 확인됨).
**영향**: M0 미완성(와이어링 누락)으로 판단. 가짜 uploadId가 Step4 폴링으로 넘어가면 GET `/api/uploads/pending-xxx`가 404 → ST-10 무한 스피너로 직결.
**확정**: `useUploadInit` 미사용은 **확정**(import 부재). 이는 기능 미완성이자 RV-A를 악화시키는 통합 결함.
**권고**: Step3→실제 `useUploadInit` 호출로 와이어링. 이 결함은 "기능 미구현"이므로 QA실행자는 통합 테스트보다 **버그 리포트 + 단위 보호 테스트**로 다루고, 와이어링은 개발팀 재작업 항목으로 에스컬레이션.

### 🟡 RV-G. 인증 토큰을 localStorage에서 직접 읽음 (XSS 노출면)
**파일**: `src/lib/api/upload.ts` L37-43, L72-77
**내용**: `localStorage.getItem("sb-access-token")`로 access token을 읽어 Authorization 헤더에 수동 첨부. XSS가 발생하면 토큰 탈취가 쉬워진다(httpOnly 쿠키 대비 취약). 서버는 `getRequestUserId`가 Bearer 헤더에서 토큰을 검증(`server.ts` L37-53)하므로 동작은 하나, 보안상 권장 패턴 아님.
**확정 vs 추측**: localStorage 사용 **확정**. 실제 탈취는 XSS 존재 전제 **(추측)**.
**권고**: M1에서 `@supabase/ssr` 쿠키 세션으로 전환(서버 클라이언트 주석 L10-12와 정합). M0는 위험 인지 + 백로그.

### 🟡 RV-H. `getRequestUserId`가 토큰 **유효성**만 보고 만료/위조 구분 메시지 없음 + 모든 API가 service_role로 RLS 우회
**파일**: `src/lib/supabase/server.ts` L14-30, 전 API route
**내용**: `createServerClient`가 **service_role 키로 RLS를 우회**(주석 L7-9 명시). 따라서 photos/reports/uploads의 RLS 게이트(DB-01 등)는 **현재 런타임에서 실제로 적용되지 않고**, 대신 각 Route 핸들러의 수동 검증(role/identity_verified 체크 등)이 유일한 방어선이다. 즉 **RLS는 "이중 안전망"이 아니라 현재 비활성 상태**. 핸들러 검증에 구멍이 있으면 바로 뚫린다.
**영향**: 예) `POST photos`는 role/verified를 직접 검사(L51-59)하므로 OK. 그러나 향후 신규 엔드포인트가 검증을 빠뜨리면 RLS가 못 막는다. 또한 `reports` insert의 reporter_id를 서버가 userId로 강제(L80-85)하므로 위조는 막힘.
**확정**: service_role 우회 **확정**(코드+주석). 핸들러가 유일 방어선인 것도 **확정**.
**권고**: (1) "RLS는 M1 ssr 전환 전까지 비활성"임을 팀 공유(보안 가정 문서화). (2) API 통합 테스트(API-09~12)로 핸들러 게이트를 강하게 고정. (3) DB-01~03 정적 리뷰로 RLS 자체 정합성은 유지(전환 시 즉시 유효).

### 🔵 RV-I. `/api/listings` GET이 500 시 내부 에러 메시지를 그대로 노출
**파일**: `src/app/api/listings/route.ts` L50-56
**내용**: `const message = err instanceof Error ? err.message : "내부 서버 오류"`를 응답 body에 노출. `getListings` 실패 메시지(예: "getListings 쿼리 실패: <DB 상세>")가 클라이언트로 새어나가 스키마/내부 구조 정보 누출 가능. reports route는 일반 메시지로 가린 것과 대조적(L88-92).
**권고**: 프로덕션에서 일반 메시지로 마스킹, 상세는 서버 로그로. P2.

### 🔵 RV-J. `app/page.tsx` 카드 링크 접근성 — 중첩 인터랙티브
**파일**: `src/app/page.tsx` L231-247
**내용**: `<Link tabIndex={-1} aria-hidden="true">` 안에 `<ListingCard>`(role=article, tabIndex=0, onClick/onKeyDown 보유)를 중첩. Link를 aria-hidden 처리했지만 article은 포커스 가능. ListingCard의 `onNavigate`는 여기서 주입 안 됨(클릭은 Link가 처리). 키보드 Enter는 article의 handleKeyDown이 `onNavigate?.()`를 부르지만 onNavigate가 undefined라 **키보드로는 상세 진입 불가**(Link는 tabIndex=-1이라 탭 포커스도 안 됨).
**확정**: 키보드 내비 단절 **확정**(코드 독해). 마우스는 동작.
**권고**: 카드 자체를 Link로 만들거나 onNavigate에 router.push 주입. 접근성 P1. 테스트: 카드 키보드 Enter 시 라우팅(현재 실패 예상 → 결함 고정).

### 🔵 RV-K. `verify/page.tsx`가 listingId를 하드코딩 placeholder로 설정
**파일**: `src/app/verify/page.tsx` L226-230
**내용**: `setListingId("placeholder-listing-id")`. UUID가 아니므로 실제 `POST photos`(zod `listingId.uuid()`) 호출 시 즉시 400. RV-F(와이어링 누락)와 결합해 M0 인증 플로우가 실제로는 동작 불가. **확정**(코드). 통합 미완성 증거.
**권고**: 실제 매물 선택/생성 동선 필요. 버그 리포트 항목.

### 정적 리뷰 — 양호 확인 사항 (회귀 보호 가치 있음)
- `data/listings.ts`가 earned=null을 0으로 변환하지 않음(L66 주석+코드) → 제약7 준수. ✅ RV-14로 고정.
- 리스트 쿼리가 reported/taken_down 제외(L112) + deleted_at null(L113) → 제약6 준수. ✅ RV-12.
- 상세 photoUrls가 approved+blurred_path만(L219-221) → 제약5 준수. ✅ RV-09.
- `listings/[id]/page.tsx`에 `"use client"` 없음 + async 서버컴포넌트 → 제약4(RSC) 준수. ✅ RV-07.
- `recompute_listing_score`(SQL)와 `aggregateTrustScore`(TS)의 집계 규칙이 의미상 일치(pending 제외, reported 0클램프) → DB-04로 동치 검증 가치. (단 sort_rank는 RV-D 불일치).

---

## 4. QA실행자 핸드오프 — 구현 순서와 파일 제안

> 원칙: **라이브 불필요 + P0**부터. 순수함수→계약→컴포넌트→상태처리(버그)→API 모킹 순.
> 모든 신규 파일은 `tests/` 하위, include 패턴(`tests/**/*.{test,spec}.{ts,tsx}`) 준수. `@/` alias 사용 가능.
> `domain.ts`/`validation`/`utils`/Route 핸들러는 jsdom 불필요(node)이나, 단일 jsdom 환경에서도 무해하게 통과하므로 별도 환경 분리는 선택.

### Phase 1 — 순수함수·계약 (라이브 N, 최우선, 빠른 ROI)
1. `tests/unit/domain-score.test.ts` — SC-01~SC-24. **가장 먼저.** 신뢰점수 SSOT. SC-19는 현재 동작 고정 + RV-C 결함 주석.
2. `tests/unit/utils-format.test.ts` — UT-01~UT-07.
3. `tests/unit/validation.test.ts` — ZV-01~ZV-17. (zod safeParse success/error)

### Phase 2 — 컴포넌트 pending≠0 + 등급 (라이브 N)
4. `tests/components/trust-donut.test.tsx` — CP-13~CP-15 (신규, 현재 미테스트).
5. `tests/components/status-chip.test.tsx` — CP-19 (신규, 현재 미테스트).
6. 기존 `score-breakdown`/`trust-score-badge`/`listing-card` 테스트에 CP-02/CP-03/CP-06/CP-07/CP-16 보강(누락 케이스만 추가, 기존 29 회귀 금지).

### Phase 3 — ★상태처리(발견 버그 + paused 형제 결함) (라이브 N, P0 최중요)
7. `tests/state/listings-query-state.test.tsx` — ST-01~ST-07. **ST-05(paused→EmptyState 오표시) 회귀 케이스 필수.**
   - 권장 구현: `QueryClientProvider` + `global.fetch` 모킹으로 SearchHomePage 렌더, 4상태(loading/error/empty/paused) 검증.
   - paused 재현이 까다로우면 **렌더 결정 함수 추출 제안**: page.tsx의 분기를 `decideListView({isLoading,isError,data})` 순수함수로 빼서 테이블 테스트(개발팀 협의). 추출 전이라도 `onlineManager.setOnline(false)` + fetch reject로 paused 유도 시도.
   - **수정 검증**: providers에 `networkMode:'always'` 적용 후 ST-05가 ErrorState로 바뀌는지 확인.
8. `tests/state/upload-status-state.test.tsx` — ST-08~ST-13. **ST-10(폴링 paused 무한 스피너) 형제 결함 고정.**

### Phase 4 — API Route 핸들러 (라이브 N, Supabase 모킹)
9. `tests/api/listings-route.test.ts` — API-01~03.
10. `tests/api/reports-route.test.ts` — API-04~08.
11. `tests/api/photos-route.test.ts` — API-09~14. (허위매물 차단 게이트 = 보안 핵심)
12. `tests/api/uploads-route.test.ts` — API-15~17.
    - 공통: `tests/helpers/supabase-mock.ts`에 체이너블 mock 빌더 작성(`from().select().eq()...maybeSingle()` 패턴). `vi.mock("@/lib/supabase/server")`.

### Phase 5 — 7대 제약 회귀 (라이브 N 부분)
13. `tests/constraints/absolute-constraints.test.ts` — RV-01~RV-15 중 라이브 N 항목(RV-01~05, 07~09, 12~15). 정적 항목은 소스 문자열/AST가 아닌 **동작 기반**으로 작성(예: RV-12는 getListings에 reported 로우 모킹 주입 후 결과 제외 검증).

### Phase 6 — 정적 리뷰 산출물 (라이브 Y는 보류, 리뷰는 문서로)
14. RLS/트리거/Edge(DB-01~08, RV-06/10/11)는 **자동화 보류**. QA실행자는 본 문서 §3 발견사항을 **버그 리포트(`docs/qa/bug-report.md` 신규 또는 갱신)**로 정리하고, 라이브 환경 확보 시 pgTAP/Deno test 스켈레톤만 TODO로 남길 것.

### 버그 리포트로 반드시 올릴 항목 (개발팀 에스컬레이션)
- RV-A/RV-B (paused — 검색홈 확정 버그 + verify 폴링 형제 결함) → **수정 필수, 릴리즈 차단급**
- RV-F/RV-K (verify 업로드 미와이어링 + placeholder listingId) → M0 기능 미완성
- RV-E (신고 실패 무알림) → 사용자 신뢰 직결
- RV-D (sort_rank 이중 권위) → 제약1 잠재 위반
- RV-C (reported 항목 delta 누락 시 전액 합산) → 계약 명확화 필요
- RV-J (카드 키보드 내비 단절) → 접근성

### 실행 명령
```bash
cd apps/jinjjajip
npm run test          # 전체 (vitest run)
npm run test:watch    # 개발 중
npm run type-check    # 신규 테스트 후 타입 회귀 확인 (게이트 6)
```

---

## 부록 A — paused 재현/검증 메모 (QA실행자용)
- React Query 기본 `networkMode:'online'`: 네트워크 오프라인 판단 시 fetch를 `paused`로 두고 `isLoading=false & isError=false & data=undefined`를 만든다.
- 검색 홈 버그 경로: page.tsx 분기 순서가 `isLoading → isError → (else) empty`라서 paused는 isError를 건너뛰고 empty(EmptyState)로 낙하.
- **단일 수정점**: `app/providers.tsx`에서 `networkMode:'always'`. 이 한 줄이 검색홈(ST-05)과 폴링(ST-10) 양쪽을 동시 해소할 가능성이 높다 → 회귀 테스트로 before/after 고정 권장.
- 화면별 보강(ErrorState/타임아웃 분기)은 방어적 추가로 함께 권장하나, 누락 위험 때문에 providers 수정이 1순위.
