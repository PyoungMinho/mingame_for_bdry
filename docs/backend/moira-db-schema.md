# 모이라(Moira) — DB 스키마 거버넌스 문서

> 관리자: @DB설계자 (백엔드팀)
> 최종 업데이트: 2026-06-09
> 대상: 백엔드팀 / QA팀 / 보안 감사

---

## 1. 디렉토리 구조

```
api/db/moira/
├── migrations/
│   ├── 001_moira_initial.sql    — 5개 테이블 DDL + 트리거 + 순환FK
│   └── 002_moira_indexes.sql   — 인덱스 전략 (001 후 실행)
└── seeds/
    └── dev_seed.sql             — 서울 4인 개발용 시드

docs/backend/
└── moira-db-schema.md           — 본 문서
```

마이그레이션 실행 순서: 001 → 002

격리 주의: `api/db/migrations/001~004*.sql` 은 오름(Oreum) 소유 — 절대 수정 금지.

---

## 2. ERD (Entity Relationship Diagram)

```
[moira_meetups]
     │ 1:N                   │ 1:1 (confirmed_candidate_id, SET NULL)
     │                       ▼
[moira_members]       [moira_candidates]
     │                       │ 1:N
     │ (member_id FK)        ▼
     └──────────── [moira_candidate_times] ◄── (candidate_id FK)
                             ▲
[moira_votes] ──────────────┘ (candidate_id FK)
     │
     └── meetup_id FK → [moira_meetups]
```

### 관계 상세

| 테이블 | 관계 | 대상 | 정책 |
|---|---|---|---|
| moira_members | N:1 | moira_meetups | ON DELETE CASCADE |
| moira_candidates | N:1 | moira_meetups | ON DELETE CASCADE |
| moira_candidate_times | N:1 | moira_candidates | ON DELETE CASCADE |
| moira_candidate_times | N:1 | moira_members | ON DELETE CASCADE |
| moira_votes | N:1 | moira_meetups | ON DELETE CASCADE |
| moira_votes | N:1 | moira_candidates | ON DELETE CASCADE |
| moira_meetups.confirmed_candidate_id | 1:1 | moira_candidates | ON DELETE SET NULL |

meetup 삭제 → CASCADE로 members, candidates, candidate_times, votes 전부 정리.

---

## 3. 테이블별 설명

### 3-1. moira_meetups

약속 루트 엔터티. 호스트가 생성하고 invite URL을 공유한다.

| 컬럼 | 타입 | 설명 |
|---|---|---|
| id | UUID PK | 약속 식별자 |
| host_token_hash | TEXT NOT NULL | SHA-256(raw_host_token) hex 64자 |
| title | TEXT | 약속 이름 (선택) |
| status | TEXT CHECK | pending / recommending / voting / confirmed / expired |
| recommended_station_name | TEXT | 추천 중간역 이름 |
| recommended_station_lines | TEXT[] | 호선 배열 (예: '{2,3}') |
| recommended_station_reason | TEXT | 추천 이유 한 줄 |
| confirmed_candidate_id | UUID FK | 확정 후보 (SET NULL) |
| appointment_date | DATE | 약속 날짜 (확정 후 채움) |
| appointment_time | TEXT | 약속 시간 ('오후 7:00') |
| appointment_address | TEXT | 도로명 주소 |
| expires_at | TIMESTAMPTZ | 생성+7일 기본 TTL |
| created_at / updated_at | TIMESTAMPTZ | 자동 관리 |
| deleted_at | TIMESTAMPTZ | 소프트 삭제 |

appointments 별도 테이블 없이 meetups에 흡수 결정 근거: 약속이 단발성 1:1 이벤트이므로 정규화 이득이 없다. API 응답에 meetup 행 하나로 약속 정보를 포함할 수 있어 JOIN 제거.

### 3-2. moira_members

약속 참여자. user_id 없음 — 완전 무가입.

| 컬럼 | 타입 | 설명 |
|---|---|---|
| id | UUID PK | |
| meetup_id | UUID FK | ON DELETE CASCADE |
| name | TEXT NOT NULL | 닉네임 (PII 아님) |
| origin_address | TEXT | 출발지 주소 — PII, 만료 후 NULL |
| origin_lat / origin_lng | NUMERIC(9,6) | 좌표 — PII, 만료 후 NULL |
| avatar_color | TEXT CHECK | '#RRGGBB' hex 정규식 |
| status | TEXT CHECK | host / done / waiting |
| invite_token_hash | TEXT NOT NULL | SHA-256(raw_invite_token) 64자 |
| submitted_at | TIMESTAMPTZ | 출발지 제출 시각 |
| UNIQUE(meetup_id, invite_token_hash) | | 동일 링크 재참여 방지 |

### 3-3. moira_candidates

AI가 추천역 주변에서 생성한 후보 장소.

| 컬럼 | 타입 | 설명 |
|---|---|---|
| id | UUID PK | |
| meetup_id | UUID FK | ON DELETE CASCADE |
| external_place_id | TEXT | Google Places ID 등 (캐시용) |
| name | TEXT NOT NULL | 장소명 |
| category | TEXT NOT NULL | 앱레벨 카테고리 |
| walk_min | SMALLINT | 역 도보(분) |
| blurb | TEXT | 한 줄 소개 |
| address | TEXT | 도로명 주소 |
| fair_gap | SMALLINT | max(minutes)-min(minutes) |
| fair_avg | NUMERIC(6,2) | 평균 이동시간(분) |
| fair_score | NUMERIC(8,4) | α·avg+β·max+γ·stddev |
| fair_level | TEXT CHECK | good / mid / bad |
| fair_rank | SMALLINT CHECK | 1-based 정렬 순위 |

### 3-4. moira_candidate_times

후보 × 멤버 N×K 이동시간 행렬. 정규화 선택.

| 컬럼 | 타입 | 설명 |
|---|---|---|
| id | UUID PK | |
| candidate_id | UUID FK | ON DELETE CASCADE |
| member_id | UUID FK | ON DELETE CASCADE |
| minutes | SMALLINT | 이동시간(분). NULL = 도달 불가 |
| transfers | SMALLINT DEFAULT 0 | 환승 횟수 |
| UNIQUE(candidate_id, member_id) | | UPSERT 재계산 안전 |

### 3-5. moira_votes

투표. 1인 1표 멱등 강제.

| 컬럼 | 타입 | 설명 |
|---|---|---|
| id | UUID PK | |
| meetup_id | UUID FK | ON DELETE CASCADE |
| candidate_id | UUID FK | ON DELETE CASCADE |
| voter_token_hash | TEXT NOT NULL CHECK | SHA-256(raw_invite_token) 64자 |
| UNIQUE(meetup_id, voter_token_hash) | | 1인 1표 DB 레벨 |

---

## 4. 무가입 권한 모델 — 결정 근거

### 결론: service_role + 앱레벨 토큰 검증 패턴 채택. RLS 미적용.

#### 왜 Supabase RLS를 쓰지 않는가

Supabase의 전통적 RLS는 `auth.uid()`를 신원 기반으로 한다. 모이라는 auth.users가 없으므로 `auth.uid() IS NULL`이 항상 참이어서 RLS 정책이 의미를 잃는다.

익명 세션(anon key + 임시 JWT)을 발급하는 방법도 있으나, 이는 Supabase Auth 의존성을 끌어들여 "무가입 핵심" 원칙과 충돌하고 세션 관리 복잡도를 높인다.

#### 채택 패턴

```
클라이언트
    │  raw_token (헤더 또는 쿠키)
    ▼
Next.js API Route (서버)
    │  moira_hash_token(raw_token) 계산
    │  → DB 조회: WHERE invite_token_hash = $hash AND meetup_id = $id
    │  → 일치하면 권한 부여, 불일치 403
    ▼
Supabase Postgres (service_role key 사용)
    │  RLS 비활성 — 앱레벨 필터로 대체
    ▼
결과 반환
```

#### 보안 보완책

1. raw_token은 서버 응답 헤더 또는 HttpOnly 쿠키로만 전달. URL 파라미터 노출 금지(초대 링크 제외).
2. moira_meetups, moira_members, moira_votes 전 테이블에 `ENABLE ROW LEVEL SECURITY`는 걸되, 정책은 `service_role` 전용으로 설정 — 실수로 anon key가 Supabase 클라이언트를 통해 직접 접근하더라도 전면 차단.
3. host_token_hash: meetup 수정·삭제·확정 권한. API Route에서 별도 검증.
4. invite_token_hash = voter_token_hash: 출발지 제출 + 투표 권한.

```sql
-- 추가 적용 권장 (서비스 롤 전용 RLS)
ALTER TABLE public.moira_meetups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.moira_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.moira_candidates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.moira_candidate_times ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.moira_votes ENABLE ROW LEVEL SECURITY;

-- anon/authenticated JWT는 전면 차단 (service_role만 통과)
CREATE POLICY "service_role only"
  ON public.moira_meetups FOR ALL
  USING (current_setting('role') = 'service_role');
-- 나머지 테이블 동일 패턴 적용
```

---

## 5. N×K 이동시간 행렬 저장 설계

### 선택: 정규화 (`moira_candidate_times` 별도 테이블)

#### JSONB vs 정규화 트레이드오프

| 항목 | JSONB (candidates.times_jsonb) | 정규화 (candidate_times 테이블) |
|---|---|---|
| 후보 1건 조회 | 단일 행, JOIN 없음 | candidate_id IN (...) + JOIN |
| SQL 집계 | 불가 (GIN 필요) | SUM/AVG/STDDEV 직접 사용 |
| 멤버 삭제 연동 | 수동 JSONB 수정 | ON DELETE CASCADE 자동 |
| UPSERT 재계산 | 전체 JSONB 교체 | UNIQUE(candidate,member) ON CONFLICT |
| 스키마 변경 | JSONB 키 변경 앱 코드만 | ALTER TABLE |

#### 정규화 채택 이유

결과 화면에서 fair_gap/fair_avg/fair_score를 Postgres에서 `MAX(minutes)-MIN(minutes)` 등으로 직접 계산할 수 있다. 멤버가 출발지를 변경하면 해당 member_id 행만 UPDATE하면 되므로 재계산 범위가 최소화된다.

후보 5~10개 × 멤버 4~8명 = 최대 80행이므로 JOIN 비용은 무시 가능하다.

#### 결과 화면 쿼리 패턴

```sql
SELECT
  c.id, c.name, c.category, c.walk_min, c.blurb,
  c.fair_gap, c.fair_avg, c.fair_level, c.fair_rank,
  json_agg(
    json_build_object(
      'name', m.name,
      'minutes', ct.minutes,
      'transfers', ct.transfers
    ) ORDER BY m.created_at
  ) AS times
FROM moira_candidates c
JOIN moira_candidate_times ct ON ct.candidate_id = c.id
JOIN moira_members m           ON m.id = ct.member_id
WHERE c.meetup_id = $1
  AND c.deleted_at IS NULL
GROUP BY c.id
ORDER BY c.fair_rank ASC NULLS LAST;
```

---

## 6. 폴링 집계 — Postgres SoT + Redis 캐시 역할 분담

### 전략

| 역할 | 담당 |
|---|---|
| 투표 원천 기록 (SoT) | Postgres moira_votes |
| 실시간 득표 수 캐시 | Redis (Upstash) hash: `moira:votes:{meetup_id}` |
| 캐시 무효화 | 투표 INSERT 성공 후 Redis HINCRBY |
| 폴링 응답 | Redis 우선, MISS 시 Postgres GROUP BY |
| 확정 시점 최종 집계 | 반드시 Postgres SELECT COUNT(*) (Redis는 참고) |

### 폴링 흐름

```
클라이언트 (5초 간격 GET /api/meetups/{id}/votes)
    │
    ▼
API Route
    ├─ Redis HGETALL moira:votes:{meetup_id}  → HIT → 반환
    └─ MISS → Postgres GROUP BY candidate_id → Redis SET → 반환

투표 POST /api/meetups/{id}/votes
    │
    ├─ Postgres INSERT moira_votes
    │  ON CONFLICT (meetup_id, voter_token_hash) DO NOTHING  → 멱등
    │
    └─ 성공 시 Redis HINCRBY moira:votes:{meetup_id} {candidate_id} 1
```

Redis TTL = `moira_meetups.expires_at`과 동기화 (meetup 만료 시 Redis 키도 만료).

---

## 7. 인덱스 전략

| 패턴 | 인덱스 이름 | 컬럼 | 조건 |
|---|---|---|---|
| 호스트 권한 검증 | idx_moira_meetups_host_token | host_token_hash (UNIQUE) | deleted_at IS NULL |
| 만료 배치 조회 | idx_moira_meetups_expires_at | expires_at | deleted_at IS NULL AND status != 'expired' |
| meetup 상태 필터 | idx_moira_meetups_status | (status, created_at DESC) | deleted_at IS NULL |
| 멤버 목록 폴링 | idx_moira_members_meetup_id | meetup_id | deleted_at IS NULL |
| 초대 토큰 검증 | idx_moira_members_meetup_token | (meetup_id, invite_token_hash) | deleted_at IS NULL |
| 미제출 멤버 감지 | idx_moira_members_meetup_status | (meetup_id, status) | deleted_at IS NULL |
| 후보 목록 조회 | idx_moira_candidates_meetup_id | (meetup_id, fair_rank ASC) | deleted_at IS NULL |
| candidate_times 조회 | idx_moira_candidate_times_candidate | candidate_id | — |
| fair_score 재계산 | idx_moira_candidate_times_member | member_id | — |
| 득표 집계 폴링 | idx_moira_votes_meetup_candidate | (meetup_id, candidate_id) | — |
| voter 중복 확인 | idx_moira_votes_meetup_voter | (meetup_id, voter_token_hash) | — |

---

## 8. 만료 정책 (TTL + PII 삭제)

### 기본 TTL: 생성 후 7일

meetup 생성 시 `expires_at = NOW() + INTERVAL '7 days'`. 호스트가 확정 후 명시적으로 연장 가능(API 제공 예정).

### 만료 처리 배치 (pg_cron 권장)

```sql
-- 매시간 실행: 만료된 meetup을 expired 상태로 전환 + PII 즉시 삭제
SELECT cron.schedule(
  'moira-expire-meetups',
  '0 * * * *',   -- 매시 정각
  $$
    -- 1. status 업데이트
    UPDATE public.moira_meetups
    SET status = 'expired', updated_at = NOW()
    WHERE expires_at < NOW()
      AND status != 'expired'
      AND deleted_at IS NULL;

    -- 2. 만료 meetup의 멤버 PII 삭제 (주소·좌표 NULL 치환)
    UPDATE public.moira_members m
    SET
      origin_address = NULL,
      origin_lat     = NULL,
      origin_lng     = NULL,
      updated_at     = NOW()
    FROM public.moira_meetups mt
    WHERE mt.id = m.meetup_id
      AND mt.status = 'expired'
      AND m.origin_address IS NOT NULL;

    -- 3. 만료 후 30일 경과 행 하드 삭제 (선택적)
    DELETE FROM public.moira_meetups
    WHERE expires_at < NOW() - INTERVAL '30 days'
      AND status = 'expired';
  $$
);
```

### PII 목록 및 처리

| 데이터 | 테이블.컬럼 | 만료 처리 |
|---|---|---|
| 출발지 주소 | moira_members.origin_address | NULL 치환 |
| 출발지 좌표 | moira_members.origin_lat/lng | NULL 치환 |
| 닉네임 | moira_members.name | 유지 (식별 불가 수준) |
| 토큰 해시 | *_hash 컬럼 | meetup CASCADE 삭제 시 자동 제거 |

한국 개인정보보호법(PIPA) 관점: 이름+주소 조합은 식별가능정보. 만료 즉시 주소·좌표 삭제, 30일 후 행 전체 삭제.

---

## 9. 데이터 볼륨 예측

기준 시나리오: MAU 3,000 meetup(약속) 생성 가정

| 테이블 | 약속당 행수 | 월 증가 | 6개월 누적 | 비고 |
|---|---|---|---|---|
| moira_meetups | 1 | 3,000 | 18,000 | 만료 삭제로 실 보유량 감소 |
| moira_members | 평균 4 | 12,000 | 72,000 | |
| moira_candidates | 평균 6 | 18,000 | 108,000 | |
| moira_candidate_times | 4멤버×6후보=24 | 72,000 | 432,000 | |
| moira_votes | 평균 3 | 9,000 | 54,000 | |

파티셔닝 필요 시점: MAU 50,000 meetup 초과 시 candidate_times 검토 (created_at 기준 월별 파티션). 현재 예상 규모에서는 불필요.

---

## 10. 보안 주의 사항

1. service_role 키는 서버 환경 변수(.env.local)에만. 클라이언트 번들 절대 금지.
2. raw_token은 서버 메모리에만 존재. DB, 로그, 에러 메시지에 절대 노출 금지.
3. moira_hash_token() 함수는 SHA-256 사용. 앱레벨에서 동일 로직 적용 필수 (`crypto.createHash('sha256').update(raw).digest('hex')`).
4. 초대 링크 `/join/{raw_token}` — raw_token이 URL에 포함되나 단회용(제출 후 만료 처리 권장). HTTPS 필수.
5. `UNIQUE(meetup_id, voter_token_hash)` — DB 레벨 1인 1표. 앱레벨 중복 체크는 UX 보조일 뿐.
6. confirmed_candidate_id 업데이트는 host_token_hash 검증 후에만 허용 (API Route 미들웨어).
7. 오름(Oreum) DB와 동일 Supabase 프로젝트 사용 시 테이블명 충돌 없음 (`moira_` 접두사 적용).
