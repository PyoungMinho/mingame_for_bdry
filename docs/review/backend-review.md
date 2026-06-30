# 진짜집(Jinjjajip) 백엔드·보안 최종 검수 — STEP 6

> 작성: @백엔드팀장 (Opus) · 2026-06-03
> 범위: API 설계·계약 / DB·RLS·PostGIS / 보안 / 7대 절대제약(백엔드측) / 신뢰점수 엔진 SSOT / §5 라이브 통합검증 갭
> 대상 산출물: `apps/jinjjajip/src/app/api/**`, `apps/jinjjajip/src/lib/**`, `apps/jinjjajip/supabase/migrations/**`, `apps/jinjjajip/supabase/functions/**`
> 입력: `docs/qa/bug-report.md` (QA실행자 P0: 151 PASS / type-check clean)
> **판정: 조건부 합격 (CONDITIONAL GO)** — 코드/스키마/제약은 견고. 출시 차단은 §5 라이브 통합검증 미완 + 블러 스텁 교체에 한정.

---

## 0. 한 줄 결론

데이터·쿼리·RLS·트리거 레이어는 7대 절대제약을 **설계와 코드 양쪽에서 정합하게 구현**했고, service role 키 클라이언트 노출도 없다. M0 출시 게이트는 "코드 결함"이 아니라 **"라이브 환경에서만 검증 가능한 4종(§4) 통합 E2E"** + **블러 실모델 교체** 이며, 나머지는 권고(BUG-08 마스킹·이중 스코어라이터 정리)다.

---

## 1. 사전 정정 — 디렉토리 혼동 주의 (검수자 필독)

리포에 **서로 다른 3개 프로젝트의 백엔드 산출물이 공존**한다. 경로 혼동 금지:

| 경로 | 프로젝트 | 진짜집 검수 대상? |
|---|---|---|
| `api/db/migrations/001~004*.sql` | **Oreum(오름)** — users/daily_checkin/score_snapshot/mission/goal/coach_chat | ❌ 아님(중단 프로젝트) |
| `docs/backend/backend-final.md` | Oreum | ❌ 아님 |
| `docs/backend/melt-backend-final.md` | **Melt** — 부모-자녀 감정 카드 | ❌ 아님 |
| **`apps/jinjjajip/supabase/migrations/001~005*.sql`** | **진짜집** ✅ | **이것이 실제 진짜집 스키마/RLS/트리거** |
| `apps/jinjjajip/supabase/functions/{photo-pipeline,score-engine}/index.ts` | 진짜집 ✅ | Edge Function(Deno) |
| `apps/jinjjajip/src/**` | 진짜집 ✅ | 라우트핸들러 + lib |

> ⚠️ **문서 부채(비차단)**: `docs/backend/` 에 진짜집 전용 백엔드 최종안 문서가 없다(코드만 존재). M1 전 `docs/backend/jinjjajip-backend-final.md` 정리 권고.

---

## 2. 검수항목별 판정

### 2-1. API 설계·계약 — ✅ 합격

| 엔드포인트 | 메서드 | 판정 | 근거 |
|---|---|---|---|
| `/api/listings` | GET | ✅ | `src/app/api/listings/route.ts:15-57`. zod `listingSearchQuerySchema.safeParse`→400 분기, RSC `getListings()` 재사용으로 서버정렬 보장 |
| `/api/listings/[id]` | GET(상세) | ✅ 의도된 부재 | 라우트핸들러 없음. 상세는 **RSC `getListingById()`**(`src/app/listings/[id]/page.tsx:16`) → 원본 비노출 경로 일원화. 정상 설계 |
| `/api/listings/[id]/photos` | POST | ✅ | 인증→tenant·verified 게이트→매물검증→202 processing. 낙관응답 금지 준수 |
| `/api/listings/[id]/reports` | POST | ✅ | zod 검증→insert→204. status 전환은 DB 트리거 위임(정상) |
| `/api/uploads/[uploadId]` | GET | ✅ | `uploader_id=userId` 소유검증, done 필드로 완료판별 |
| `/api/auth/verify/callback` | GET | ✅(M0 모의) | PASS 콜백. M0 모의통과 명시, 실연동 TODO |

- **응답 envelope 일관**: 전 라우트 `{success, data, error, meta}` 통일. 에러코드 체계 일관.
- **zod 입력검증**(`src/lib/validation/index.ts`): 검색쿼리(coerce+limit 1~50), 신고(uuid+reason enum+detail≤200), 업로드(fileCount 1~10, size≤20MB, mime 화이트리스트). 견고.
- **HTTP 시맨틱 정확**: 업로드 202, 신고 204, 인증실패 401 vs 권한실패 403 구분 정확.

### 2-2. DB·RLS·PostGIS — ✅ 합격

**스키마(`002_schema.sql`)**
- 6테이블(profiles/listings/score_items/photos/reports/uploads) + CHECK 제약으로 enum 관리.
- `score_items.earned int`: **default 없음** + `check(earned is null or 0~100)`(L65-66) → **null(pending) vs 0 구분을 DB 레벨에서 강제**. 제약 ⑦ 근본 방어선. 우수.
- `delta_if_reported check(<=0)`(L72-73): 감점만 허용.
- `listings.geo geography(Point,4326)` PostGIS WGS84, `sort_rank double precision`.

**PostGIS(`001`+`003`)**: `postgis` 확장 + `idx_listings_geo using gist(geo) where deleted_at is null`(003:16-18). 반경검색(P1 지도뷰) GiST 인덱스 사전 구축.

**인덱스(`003`)**: 메인 검색 복합 `idx_listings_status_sort_rank (status, sort_rank desc) where deleted_at is null`(L6-8) — 실제 쿼리패턴(`.not(status in ...) + order(sort_rank desc)`)과 정확히 정합. FK 인덱스 완비.

**RLS(`004_rls.sql`) — 일반 사용자 권한 경계 ✅**
- 전 테이블 `enable row level security`. `auth_role()`·`auth_identity_verified()` `security definer` 헬퍼.
- **photos INSERT 게이트(L90-96)**: `auth_role()='tenant' AND auth_identity_verified()=true AND uploader_id=auth.uid()` — **허위매물 차단 핵심을 DB RLS에도 이중 구현**(앱 게이트와 별개). uploads INSERT 동일(L151-157).
- photos SELECT 공개는 `status='approved'` 만(L79-81). score_items 쓰기는 service_role 전용(anon/auth INSERT/UPDATE 불가).
- listings SELECT: `taken_down` 제외 + `deleted_at is null`(L51-53). reported는 RLS로는 노출(상세·검수 허용)하되 **리스트 쿼리에서 필터 제외**(설계 의도 일치).

### 2-3. 보안 — ✅ 합격 (service role 노출 없음) / 🟡 BUG-08 권고

**⭐ service role 키 클라이언트 노출: 없음 (안전 확정)**
- 전 코드베이스 grep: 진짜집 `SUPABASE_SERVICE_ROLE_KEY` 참조처 = `src/lib/supabase/server.ts:16`, `.../photos/route.ts:189`(triggerPhotoPipeline), Deno Edge 2종(`Deno.env.get`). **모두 서버/엣지 전용**.
- **`'use client'` 파일이 `supabase/server.ts` 를 import 하는 사례 0건**(전수 grep). 누출 import 경로 없음.
- `NEXT_PUBLIC_*SERVICE_ROLE` 오접두사 0건. 클라이언트는 `client.ts`(anon 키)만 사용.
- `.env.example`: "service role 키는 서버 전용. NEXT_PUBLIC_ 접두사 금지" 주석. 모범적.
- `getRequestUserId()`(server.ts:37-53): service role이 아니라 **anon 키 + `auth.getUser(token)`** 로 Bearer 토큰 검증→userId 추출 후 service client는 그 userId로 직접 필터. 설계 타당.

**🟡 BUG-08 (500 내부메시지 누출) — 미마스킹 확정, 출시 전 권고**
- `src/app/api/listings/route.ts:51-53`: `err.message` 를 그대로 `error.message` 응답 주입 → `getListings` throw 문구(supabase 원문 포함)가 클라에 노출.
- 영향: 컬럼명·내부 쿼리 구조 정보 누출(낮~중). **권장**: 서버 로그만 상세, 클라엔 "일시적 오류". 라우트 1줄 미세수정으로 해소.
- 참고: photos/reports/uploads 라우트는 catch에서 일반 메시지 사용 → **listings GET 한 곳만 누출**. 일관화 필요.

### 2-4. 7대 절대제약(백엔드측) — ✅ 전 항목 준수

| # | 제약 | 판정 | 근거(file:line) |
|---|---|---|---|
| ① | 정렬=서버 sort_rank | ✅ | `data/listings.ts:130` 기본 `.order("sort_rank",desc)`, 커서 `lt(sort_rank)`(L137). sort_rank는 `recompute_listing_score`(005:82-83) 사전계산. 클라 매물 `.sort()` 0건 |
| ③ | EXIF/블러 100% 서버 | ✅ | `photo-pipeline/index.ts` 워커 전담. 라우트(`photos/route.ts:11`)는 "블러/EXIF 여기서 안 함" 명시, 비공개버킷 저장만 |
| ⑤ | 원본 비공개·공개=approved+블러본만 | ✅(코드) | 업로드=`listing-photos-original`(비공개, `photos/route.ts:21,135`). 공개=`getListingById`(`data/listings.ts:219-221`) `status==='approved' && blurred_path!=null` 만. RLS도 approved 한정(004:79-81). 3중 방어. ⚠️ 단 블러 자체가 현재 스텁(§4-4) |
| ⑥ | 신고→즉시 reported·비공개·리스트제외 | ✅(트리거) | 리스트 제외=`data/listings.ts:112` `.not(status in (reported,taken_down))`. status 전환=DB 트리거 `trg_reports_takedown`(005:132-149). 라우트는 트리거 위임(정상). ⚠️ 트리거 발화는 라이브 검증 필요(§4-1) |
| ⑦ | null=검증대기(0 변환 금지) | ✅ | DB `score_items.earned` default 없음+null(002:65). `mapScoreItemRow`(`data/listings.ts:66`) null 보존. `aggregateTrustScore`(domain.ts:206) pending 제외+isLowerBound. SQL recompute(005:47-52)·Edge(score-engine:69) 동일 |

> ②낙관 UI 금지·④본인인증 게이트는 bug-report §2에서 별도 확인. 백엔드측 ④는 RLS+앱 게이트 이중 구현(2-2).

### 2-5. 신뢰점수 엔진 SSOT 무결성 — ✅ 검토만(수정 안 함)

`src/lib/types/domain.ts`(SSOT, mtime 06-03 13:25 불변 확인, 미수정):
- **가중치 35/20/20/15/10**(L39-45)=direction.md 재설계본. 합계 100. ✅
- **컷오프 Gold≥80 / Silver≥55**(L50). ✅
- `aggregateTrustScore`(L199-225): pending(earned null OR status pending/processing)→점수 제외+maxPossible 포함+isLowerBound=true. reported는 `deltaIfReported` 음수만 0-clamp 반영. **기획 의도 정확 반영**.
- **3-소스 미러 일관**: SSOT ↔ SQL `recompute_listing_score`(005) ↔ Edge `score-engine`(가중치·컷오프·pending 규칙 동일).
- 🟡 BUG-05(reported인데 deltaIfReported 미지정/0이면 감점 0): **정책 결정 사항**. SSOT 비수정 원칙대로 보류. "reported=무조건 기본감점" 정책이면 분기 수정 필요하나 기획/백엔드 합의 후 처리 권고(현 동작 SC-19 고정).

### 2-6. ⚠️ 신규 발견 — 이중 스코어 라이터(dual-writer) 분기 위험 (중간, M1 활성화 전 정리 필수)

`listings.trust_score/trust_grade/sort_rank/natural_label` 를 **두 구현이 동시에 갱신**하며 결과가 **분기**한다:

| 항목 | SQL `recompute_listing_score`(005:82-102) | Edge `score-engine`(index.ts:89-93,54-58) |
|---|---|---|
| sort_rank 공식 | `score*1000 - 경과일수` | `gradeBonus(200/100/0) + score` ← **완전히 다른 스케일** |
| natural_label(silver) | "현장 확인 완료" | "현장에서 촬영한 사진 있음" ← **다른 문구** |
| natural_label(unverified) | "인증 정보 수집 중" | "현장 미검증 매물" ← 다른 문구 |
| 호출 시점 | score_items 변경 트리거(자동) | photo-pipeline 후 직접/신고 후(수동) |

- **리스크**: 두 라이터가 섞이면 sort_rank 스케일 혼재 → **정렬 일관성 붕괴**(트리거가 score*1000 기록 후 Edge가 200+score로 덮으면 리스트 내 두 스케일 공존). natural_label도 매물별 불일치.
- **현재 M0 안전판**: photo-pipeline은 `recompute_listing_score` RPC만 호출(`photo-pipeline:313`)하고 score-engine의 listings 갱신은 미트리거(주석 "M1에서" — `photo-pipeline:320-321`). 즉 **현재 활성 경로는 SQL 한 쪽**이라 당장은 충돌 미발생.
- **권고**: **SQL `recompute_listing_score`를 단일 권위 소스로 채택**, Edge `score-engine`의 listings 갱신부는 비활성/RPC 위임으로 통일(M1 활성화 전 必). community 점수(신고수 기반)는 SQL recompute에 흡수하거나 Edge는 score_items만 갱신하고 listings는 트리거 위임으로 분리.

---

## 3. QA 발견(bug-report) 백엔드 관점 처리

| 버그 | 영역 | 백엔드 판정 |
|---|---|---|
| BUG-08 | 보안(500 누출) | 🟡 출시 전 마스킹 권고(2-3). listings/route.ts:51-53 |
| BUG-05 | 점수정책 | 🟡 정책 결정 대기. SSOT 비수정(2-5) |
| BUG-01~04,07 | 프론트 | 백엔드 무관(프론트 사이클 종결, bug-report §9) |

---

## 4. §5 출시 전 라이브 통합검증 4종 — 단위환경 미검증 갭

단위 테스트(Vitest)는 Supabase 모킹 기반이라 **DB 트리거·RLS·외부연동·Edge 실행**은 구조적으로 검증 불가. 출시 전 **스테이징 통합 E2E 필수**:

| # | 항목 | 미검증 이유 | 출시 전 검증 시나리오 |
|---|---|---|---|
| 1 | **신고→즉시 비공개 트리거** | `trg_reports_takedown`(005:146)은 라이브 DB에서만 발화. 모킹 불가 | reports insert → listings.status='reported' 전환 → GET /api/listings 즉시 제외 E2E |
| 2 | **본인인증 PASS 게이트** | callback이 M0 모의통과(`verify/callback:37`). 실 PASS 미연동 | 실 PASS 토큰 → identity_verified 갱신 → 미인증자 업로드 403 |
| 3 | **RLS 정책(일반 사용자 경계)** | service_role 우회 사용 중이라 anon/auth JWT 경계가 런타임 미발화 | authenticated JWT로 타인 uploads/reports 조회 차단, 비tenant photos insert 차단 침투테스트 |
| 4 | **photo-pipeline Edge Function** | 로컬 `SUPABASE_FUNCTIONS_URL` 미설정→트리거 스킵(`photos/route.ts:191-193`). 블러는 스텁 | Edge 배포 후 업로드→블러→approved 승격→blurred_path 기록→recompute로 score_delta 산출 E2E |

> 🔴 **#4 보충 경고(차단급)**: `runBlurGate`(photo-pipeline:125-140)가 **현재 블러 미적용·원본을 공개버킷에 복사**하는 스텁이다(주석도 "실제 운영 금지 — PoC용"). **실 블러 모델 연동 전 공개버킷 노출은 제약⑤ 실질 위반**. M0 데모를 넘어 실사용자 사진을 받는 순간부터 실 블러 파이프라인 교체가 선행되어야 한다.

---

## 5. M0 출시 백엔드 준비도

| 영역 | 상태 |
|---|---|
| API 계약/envelope/zod | ✅ GO |
| DB 스키마/인덱스/PostGIS | ✅ GO |
| RLS 정책 정의 | ✅ 정의 완료 (라이브 발화검증 §4-3 필요) |
| 7대 제약 코드 구현 | ✅ GO |
| 점수엔진 SSOT 정합 | ✅ GO |
| service role 보안 | ✅ GO (노출 없음) |
| BUG-08 마스킹 | 🟡 권고(경미) |
| 이중 스코어라이터 정리 | 🟡 M1 Edge 활성화 전 必(현재 단일경로라 비차단) |
| §4 라이브 4종 | ⏳ **스테이징 통합검증 미완 = 출시 게이트** |
| 블러 실모델(§4-4) | 🔴 실사용자 사진 수신 전 **차단급** |

**종합 판정: 조건부 GO**
- 코드/스키마/제약/보안 = **합격**.
- **출시 차단 조건**: (a) §4 라이브 4종 스테이징 E2E 통과, (b) 블러 스텁→실모델 교체(실사용자 사진 수신 시점부터 필수).
- **출시 전 권고(비차단)**: BUG-08 500 마스킹, 이중 스코어라이터 단일화(M1 전), 진짜집 백엔드 문서 정리, BUG-05 감점정책 기획 합의.

---

## 부록 — 확인 방법(재현)
- service role 누출: `grep -rl "supabase/server" apps/jinjjajip/src --include="*.tsx" --include="*.ts"` 후 각 파일 head 3줄 `'use client'` 부재 확인 → 0건.
- domain.ts SSOT 불변: mtime `Jun 3 13:25` 유지, 본 검수 중 미수정. git 커밋 없음.
