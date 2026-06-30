-- 002_schema.sql
-- 진짜집 핵심 스키마. enum은 DB 레벨 ENUM 타입 대신 CHECK 제약으로 관리(앱 레벨 확장 용이).
-- 모든 테이블: id(uuid PK), created_at, updated_at. 소프트 삭제는 listings/profiles만 deleted_at 적용.

-- ──────────────────────────────────────────────
-- profiles
-- ──────────────────────────────────────────────
-- auth.users.id 와 1:1. Supabase Auth 가입 시 트리거로 자동 생성(앱 레이어 또는 Edge Function 담당).
create table if not exists profiles (
  id                  uuid        primary key references auth.users(id) on delete cascade,
  role                text        not null check (role in ('tenant', 'agent', 'admin'))
                                  default 'tenant',
  phone_verified      boolean     not null default false,
  identity_verified   boolean     not null default false,  -- PASS 본인인증 완료 여부
  display_name        text,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

-- ──────────────────────────────────────────────
-- listings
-- ──────────────────────────────────────────────
-- sort_rank: recompute_listing_score() 가 사전계산. 프론트는 이 컬럼으로만 정렬.
-- trust_score/trust_grade: recompute_listing_score() 가 단일 권위 소스로 갱신.
-- natural_label: "실거주 세입자가 직접 찍음" 같은 사람 언어 라벨(워커가 등급 결정 후 채움).
create table if not exists listings (
  id                  uuid        primary key default gen_random_uuid(),
  title               text        not null,
  address             text        not null,
  region              text        not null check (region in ('gwanak', 'mapo')),
  building_type       text        not null check (building_type in ('oneroom', 'officetel')),
  deposit_manwon      int         not null check (deposit_manwon >= 0),
  monthly_rent_manwon int         not null check (monthly_rent_manwon >= 0),
  geo                 geography(Point, 4326),               -- PostGIS 좌표(WGS84)
  status              text        not null
                                  check (status in ('verified', 'pending', 'processing', 'reported', 'taken_down'))
                                  default 'pending',
  agent_id            uuid        references profiles(id) on delete set null,
  natural_label       text,                                  -- 서버 사전계산 자연어 라벨
  trust_score         int         not null default 0
                                  check (trust_score >= 0 and trust_score <= 100),
  trust_grade         text        not null
                                  check (trust_grade in ('gold', 'silver', 'unverified'))
                                  default 'unverified',
  sort_rank           double precision not null default 0,   -- 신뢰순 정렬 사전계산키
  thumbnail_url       text,
  description         text,
  area_m2             numeric(6, 2),
  floor               text,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  deleted_at          timestamptz                            -- 소프트 삭제
);

-- ──────────────────────────────────────────────
-- score_items
-- ──────────────────────────────────────────────
-- 매물당 5개 고정 행(key별 unique). 워커/트리거가 earned·status·verified_at 을 채운다.
-- earned IS NULL = pending(검증 대기). 0은 "검증했으나 0점". 절대 구분.
-- delta_if_reported: status='reported' 시 earned 에 더할 음수값(예: -5).
create table if not exists score_items (
  id              uuid        primary key default gen_random_uuid(),
  listing_id      uuid        not null references listings(id) on delete cascade,
  key             text        not null check (key in ('photo', 'exif', 'community', 'owner', 'transaction')),
  earned          int                    -- NULL = pending (default 없음 — 0 혼동 방지)
                              check (earned is null or (earned >= 0 and earned <= 100)),
  max             int         not null check (max > 0 and max <= 100),
  status          text        not null
                              check (status in ('verified', 'pending', 'processing', 'reported'))
                              default 'pending',
  verified_at     timestamptz,           -- 항목 신선도 표기용
  delta_if_reported int       not null default 0
                              check (delta_if_reported <= 0),  -- 반드시 0 이하(감점)
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (listing_id, key)
);

-- ──────────────────────────────────────────────
-- photos
-- ──────────────────────────────────────────────
-- original_path: 비공개 버킷(listing-photos-original). 절대 공개 URL 사용 금지.
-- blurred_path:  공개 버킷(listing-photos-blurred). AI 블러 통과 + 승인된 것만 기록.
-- exif:          서버 EXIF 파싱 결과(GPS·타임스탬프 등). 클라 데이터 신뢰 금지.
-- liveness_score: 생활흔적 AI 스코어(0~1).
create table if not exists photos (
  id              uuid        primary key default gen_random_uuid(),
  listing_id      uuid        not null references listings(id) on delete cascade,
  uploader_id     uuid        not null references profiles(id) on delete restrict,
  original_path   text        not null,  -- 비공개 버킷 경로
  blurred_path    text,                  -- 공개 버킷 경로(블러 승인 후 채워짐)
  status          text        not null
                              check (status in ('processing', 'approved', 'rejected'))
                              default 'processing',
  exif            jsonb,                 -- 서버 파싱 결과
  liveness_score  numeric(5, 4),         -- 0.0000~1.0000
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

-- ──────────────────────────────────────────────
-- reports
-- ──────────────────────────────────────────────
-- 신고 접수 즉시 listings.status='reported' 전환(005 트리거 담당).
-- evidence_photo_id: 신고자가 첨부한 증거 사진(photos 테이블 참조).
create table if not exists reports (
  id                  uuid        primary key default gen_random_uuid(),
  listing_id          uuid        not null references listings(id) on delete cascade,
  reporter_id         uuid        not null references profiles(id) on delete restrict,
  reason              text        not null
                                  check (reason in (
                                    'fake_listing', 'wrong_photo', 'wrong_price',
                                    'already_taken', 'duplicate', 'other'
                                  )),
  detail              text        check (detail is null or length(detail) <= 200),
  evidence_photo_id   uuid        references photos(id) on delete set null,
  status              text        not null default 'received'
                                  check (status in ('received', 'reviewing', 'resolved', 'dismissed')),
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

-- ──────────────────────────────────────────────
-- uploads
-- ──────────────────────────────────────────────
-- 업로드 세션 단위 기록. API의 UploadResult 타입과 1:1 대응.
-- score_delta / badge_achieved: 파이프라인 완료 후 워커가 채움(낙관적 채움 금지).
create table if not exists uploads (
  id              uuid        primary key default gen_random_uuid(),
  listing_id      uuid        not null references listings(id) on delete cascade,
  uploader_id     uuid        not null references profiles(id) on delete restrict,
  accepted_count  int         not null default 0 check (accepted_count >= 0),
  rejected_count  int         not null default 0 check (rejected_count >= 0),
  status          text        not null
                              check (status in ('processing', 'error', 'done'))
                              default 'processing',
  score_delta     int,                  -- 처리 완료 후 채워짐(NULL = 미완료)
  badge_achieved  text        check (badge_achieved is null or badge_achieved in ('gold', 'silver', 'unverified')),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

-- ──────────────────────────────────────────────
-- updated_at 자동 갱신 함수
-- ──────────────────────────────────────────────
create or replace function set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger trg_profiles_updated_at
  before update on profiles
  for each row execute function set_updated_at();

create trigger trg_listings_updated_at
  before update on listings
  for each row execute function set_updated_at();

create trigger trg_score_items_updated_at
  before update on score_items
  for each row execute function set_updated_at();

create trigger trg_photos_updated_at
  before update on photos
  for each row execute function set_updated_at();

create trigger trg_reports_updated_at
  before update on reports
  for each row execute function set_updated_at();

create trigger trg_uploads_updated_at
  before update on uploads
  for each row execute function set_updated_at();
