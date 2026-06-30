# 진짜집 Supabase 스키마

## ERD (텍스트)

```
auth.users (Supabase 관리)
    │ 1:1
    ▼
profiles (id = auth.users.id)
    │ 1:N (agent_id)           │ 1:N (uploader_id)     │ 1:N (reporter_id)
    ▼                          ▼                        ▼
listings ──────── 1:N ──── photos            reports
    │ 1:5 (고정)               (uploader=tenant only)
    ▼
score_items (listing당 key별 unique 5행)
    photo / exif / community / owner / transaction

listings ──── 1:N ──── uploads
```

## 테이블 요약

| 테이블 | 행 주기 | 핵심 제약 |
|---|---|---|
| `profiles` | Auth 가입 시 1행 | role check('tenant','agent','admin') |
| `listings` | 중개사 등록 | trust_score/trust_grade/sort_rank = recompute 자동갱신 |
| `score_items` | listings INSERT 트리거로 5행 자동생성 | earned NULL=pending(0과 구분), unique(listing_id,key) |
| `photos` | 세입자 업로드 | INSERT=tenant+identity_verified만, original_path 비공개 버킷 |
| `reports` | 신고 접수 | INSERT 즉시 listings.status='reported' 전환(트리거) |
| `uploads` | 업로드 세션 단위 | UploadResult 타입 대응, score_delta/badge_achieved=워커 완료 후 채움 |

## RLS 핵심 규칙

**listings**
- anon/auth SELECT: `status <> 'taken_down'` 조건. reported 매물은 직접 id 조회 허용(검수 화면용).
- INSERT/UPDATE: agent/admin만.

**photos**
- INSERT: `role='tenant' AND identity_verified=true` — 서비스 핵심 게이트.
- SELECT(공개): `status='approved'`인 행만. original_path는 비공개 버킷(Storage 정책 2중 차단).
- 비공개 버킷 `listing-photos-original` / 공개 버킷 `listing-photos-blurred` 는 Supabase 콘솔에서 별도 생성 필요.

**score_items**
- SELECT: 전체 공개(신뢰 투명성).
- INSERT/UPDATE: service_role(워커)만. 클라이언트 직접 쓰기 불가.

**reports**
- INSERT: 인증 사용자(auth.uid() IS NOT NULL).
- SELECT: 본인 또는 admin.

## recompute_listing_score 와 domain.ts aggregateTrustScore 대응

`recompute_listing_score(p_listing_id uuid)` 는 `aggregateTrustScore(breakdown)` 의 SQL 미러링이다.

| domain.ts 로직 | SQL 함수 처리 |
|---|---|
| `earned === null OR status in ('pending','processing')` → hasPending=true, score 제외 | `rec.earned IS NULL OR rec.status IN ('pending','processing')` → `v_has_pending=true; continue` |
| `maxPossible += item.max` (항상) | 루프 첫 줄에서 `v_max_possible := v_max_possible + rec.max` |
| `status==='reported'` → `earned + deltaIfReported` (0 clamp) | `greatest(0, rec.earned + rec.delta_if_reported)` |
| `clampScore(score)` | `greatest(0, least(100, v_score))` |
| `computeGrade`: Gold>=80 / Silver>=55 / Unverified<55 | 동일 컷오프 if-elsif |

**pending(null) 처리 요약**: earned=NULL인 항목은 현재 점수 집계에서 제외되지만 max는 maxPossible에 포함된다. 이 상태에서 listings.trust_score는 "하한값"이며, 프론트는 `isLowerBound=true`로 "N점~" 표기를 한다. 워커가 earned를 채우면 트리거(`trg_score_items_recompute`)가 즉시 recompute를 호출해 점수를 갱신한다.

## 외부 데이터(등기/실거래) 처리 방침

- 외부 ACL 워커는 `score_items.earned=NULL, status='pending'`인 행(주로 `owner`, `transaction` key)을 조회해 처리한다.
- 외부 API 실패 또는 집주인 미동의 시: `status='pending'` 유지. 0점으로 강제하지 않는다.
- 성공 시: `earned` 값과 `verified_at` 기록 → 트리거가 recompute 자동 호출.
- 이로써 외부 장애가 전체 스코어 산출을 멈추지 않는다.

## 마이그레이션 파일 순서

```
001_extensions.sql      postgis, pgcrypto
002_schema.sql          테이블 + updated_at 트리거
003_indexes.sql         검색 성능 인덱스
004_rls.sql             RLS 정책 + 헬퍼 함수
005_functions_triggers.sql  recompute + score_items 트리거 + reports takedown + listings 초기화 트리거
```

`seed.sql` 은 마이그레이션 완료 후 개발 환경에서만 실행. Gold/Silver/Unverified/pending/reported 케이스를 모두 포함.
