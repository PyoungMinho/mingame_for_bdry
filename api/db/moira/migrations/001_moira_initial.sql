-- =============================================================================
-- 모이라(Moira) — 001 Initial Schema
-- PostgreSQL 15+  /  Supabase Postgres
-- 모든 구문 idempotent (IF NOT EXISTS / OR REPLACE / DO $$ ... END $$)
-- 무가입(auth.users 의존 없음) — 신원은 SHA-256 해시 토큰으로만 관리
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 확장
-- ---------------------------------------------------------------------------
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";   -- digest() 함수: SHA-256 해시 사용
CREATE EXTENSION IF NOT EXISTS "pg_cron";    -- 만료 정리 잡 (별도 마이그레이션에서 등록)

-- ---------------------------------------------------------------------------
-- 헬퍼: updated_at 자동 갱신 트리거 함수
-- 오름(Oreum)의 set_updated_at() 와 동명이므로 moira_ 네임스페이스 사용
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION moira_set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

-- ---------------------------------------------------------------------------
-- 헬퍼: SHA-256 토큰 해시 함수 (앱레벨에서도 동일 로직 적용 필수)
-- 사용법: SELECT moira_hash_token('raw-uuid-token-string');
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION moira_hash_token(raw TEXT)
RETURNS TEXT LANGUAGE sql IMMUTABLE STRICT AS $$
  SELECT encode(digest(raw, 'sha256'), 'hex');
$$;

-- =============================================================================
-- 1. meetups  — 약속 루트 엔터티
--    호스트가 생성. inviteUrl 공유 → 게스트 참여.
--    만료(expires_at) 후 PII 포함 하위 데이터 정리 대상.
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.moira_meetups (
  id                   UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),

  -- 호스트 식별: 평문 토큰은 앱 서버에서만 발급·검증. DB는 해시만 저장.
  -- 토큰 형식: crypto.randomUUID() 64자 — 앱레벨 생성
  host_token_hash      TEXT        NOT NULL
                         CONSTRAINT chk_meetup_host_hash CHECK (length(host_token_hash) = 64),

  -- 그룹 이름 (선택) — "지훈이랑 을지로", 없으면 NULL
  title                TEXT,

  -- 앱레벨 ENUM: pending(출발지 수집 중) | recommending(AI 추천 완료) |
  --             voting(투표 중) | confirmed(약속 확정) | expired(만료)
  status               TEXT        NOT NULL DEFAULT 'pending'
                         CONSTRAINT chk_meetup_status
                           CHECK (status IN ('pending', 'recommending', 'voting', 'confirmed', 'expired')),

  -- 추천 중간역 (AI가 채운다. 확정 전까지 NULL 가능)
  recommended_station_name  TEXT,
  recommended_station_lines TEXT[],    -- 예: ARRAY['2','3']
  recommended_station_reason TEXT,

  -- 확정 후보 (votes 집계 후 결정. 확정 전 NULL)
  confirmed_candidate_id  UUID,       -- FK는 moira_candidates 생성 후 추가 (순환 회피)

  -- 약속 확정 정보 (appointments 테이블 대신 여기 흡수 — 단발성 이벤트 특성상 정규화 불필요)
  appointment_date     DATE,          -- NULL = 미확정
  appointment_time     TEXT,          -- 예: '오후 7:00' (자유 형식)
  appointment_address  TEXT,          -- 도로명 주소

  -- 단발성 TTL: 생성 후 7일 기본. 배치 잡이 만료 행 정리.
  expires_at           TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '7 days'),

  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  -- 소프트 삭제 (호스트 명시적 삭제 or 만료 배치가 채움)
  deleted_at           TIMESTAMPTZ
);

COMMENT ON TABLE  public.moira_meetups IS '모이라 약속 루트 엔터티. 무가입 — auth.users 참조 없음.';
COMMENT ON COLUMN public.moira_meetups.host_token_hash IS 'SHA-256(raw_host_token) hex 64자. 평문 저장 금지.';
COMMENT ON COLUMN public.moira_meetups.expires_at IS '생성 후 7일. 배치 잡이 expired 상태로 전환 후 PII 삭제.';
COMMENT ON COLUMN public.moira_meetups.appointment_date IS 'appointments 테이블 없이 meetup 행에 흡수. 단발 이벤트이므로 1:1.';

-- updated_at 트리거
CREATE OR REPLACE TRIGGER trg_moira_meetups_updated_at
  BEFORE UPDATE ON public.moira_meetups
  FOR EACH ROW EXECUTE FUNCTION moira_set_updated_at();

-- =============================================================================
-- 2. members  — 약속 참여자 (호스트 포함)
--    무가입: user_id 없음. invite_token_hash 로만 식별.
--    status: host = 첫 번째 멤버(특수), done = 출발지 입력 완료, waiting = 미입력
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.moira_members (
  id                   UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  meetup_id            UUID        NOT NULL
                         REFERENCES public.moira_meetups(id) ON DELETE CASCADE,

  -- 표시 이름 (닉네임, 회원 아님 — PII 최소화)
  name                 TEXT        NOT NULL CHECK (length(trim(name)) >= 1),

  -- 출발지 원문(주소 문자열) — 만료 후 NULL 치환 대상 PII
  origin_address       TEXT,

  -- 지오코딩 결과. 앱 서버가 채운 뒤 저장.
  origin_lat           NUMERIC(9,6),
  origin_lng           NUMERIC(9,6),

  -- 아바타 배경색 (hex, 예: '#6366F1') — 프론트 mock.ts avatar 필드
  avatar_color         TEXT        CHECK (avatar_color ~ '^#[0-9A-Fa-f]{6}$'),

  -- 앱레벨 ENUM: host | done | waiting
  status               TEXT        NOT NULL DEFAULT 'waiting'
                         CONSTRAINT chk_member_status CHECK (status IN ('host', 'done', 'waiting')),

  -- 초대 토큰 해시 — 투표 권한 식별자
  -- 호스트: host_token_hash와 동일 값으로 채워도 무방 (별도 관리 가능)
  -- 게스트: 초대링크 /join/{raw_token} 에서 추출
  invite_token_hash    TEXT        NOT NULL
                         CONSTRAINT chk_member_invite_hash CHECK (length(invite_token_hash) = 64),

  -- 출발지 제출 시각
  submitted_at         TIMESTAMPTZ,

  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at           TIMESTAMPTZ,

  -- meetup당 토큰 유일성 (동일 초대링크 재사용 방지)
  CONSTRAINT uq_member_meetup_token UNIQUE (meetup_id, invite_token_hash)
);

COMMENT ON TABLE  public.moira_members IS '약속 참여자. 무가입 — 신원은 invite_token_hash 로만.';
COMMENT ON COLUMN public.moira_members.origin_address IS '만료 후 NULL 처리 대상 PII (도로명 주소).';
COMMENT ON COLUMN public.moira_members.origin_lat IS '만료 후 NULL 처리 대상 PII (좌표).';
COMMENT ON COLUMN public.moira_members.invite_token_hash IS 'SHA-256(raw_invite_token). 링크 공유 시 raw만 노출, DB는 해시 저장.';

CREATE OR REPLACE TRIGGER trg_moira_members_updated_at
  BEFORE UPDATE ON public.moira_members
  FOR EACH ROW EXECUTE FUNCTION moira_set_updated_at();

-- =============================================================================
-- 3. candidates  — 후보 장소 (AI가 추천역 주변으로 생성)
--    meetup당 보통 5~10개. place_id는 외부 지도 API ID (Google PlaceID 등).
--
--    공평성 점수 컬럼:
--      fair_gap     = max(minutes) - min(minutes) [fairness.ts gapOf]
--      fair_avg     = mean(minutes)               [fairness.ts avgOf]
--      fair_score   = α·avg + β·max + γ·stddev   [서버 계산 후 저장]
--      fair_level   = good|mid|bad                [fairness.ts fairLevel]
--      fair_rank    = 1-based 정렬 순위
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.moira_candidates (
  id                   UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  meetup_id            UUID        NOT NULL
                         REFERENCES public.moira_meetups(id) ON DELETE CASCADE,

  -- 외부 지도 API PlaceID (Google Places 등). NULL 허용(자체 크롤 데이터).
  external_place_id    TEXT,

  name                 TEXT        NOT NULL,
  -- 앱레벨 ENUM: 호프·포차 | 전통시장 | 칼국수 | 카페·전시 | 북카페 | 기타
  category             TEXT        NOT NULL,
  walk_min             SMALLINT    NOT NULL CHECK (walk_min >= 0),
  blurb                TEXT,         -- 한 줄 소개
  address              TEXT,

  -- 공평성 지표 (서버가 candidate_times 집계 후 채운다)
  fair_gap             SMALLINT,    -- 분 단위 격차 (NULL = 아직 계산 안 됨)
  fair_avg             NUMERIC(6,2),
  fair_score           NUMERIC(8,4), -- α·avg + β·max + γ·stddev
  fair_level           TEXT        CONSTRAINT chk_candidate_fair_level
                                     CHECK (fair_level IN ('good', 'mid', 'bad')),
  fair_rank            SMALLINT CHECK (fair_rank > 0),

  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at           TIMESTAMPTZ
);

COMMENT ON TABLE  public.moira_candidates IS '후보 장소. meetup 삭제 시 CASCADE 삭제.';
COMMENT ON COLUMN public.moira_candidates.fair_score IS 'α·avg + β·max + γ·stddev. α/β/γ는 fairness.ts 참조.';
COMMENT ON COLUMN public.moira_candidates.external_place_id IS 'Google Places PlaceID 등 외부 API 키. 재조회 캐시 용도.';

CREATE OR REPLACE TRIGGER trg_moira_candidates_updated_at
  BEFORE UPDATE ON public.moira_candidates
  FOR EACH ROW EXECUTE FUNCTION moira_set_updated_at();

-- meetups.confirmed_candidate_id → candidates FK (순환 회피: meetups 먼저 생성 후 추가)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'fk_meetup_confirmed_candidate'
      AND table_name = 'moira_meetups'
  ) THEN
    ALTER TABLE public.moira_meetups
      ADD CONSTRAINT fk_meetup_confirmed_candidate
        FOREIGN KEY (confirmed_candidate_id)
          REFERENCES public.moira_candidates(id) ON DELETE SET NULL;
  END IF;
END;
$$;

-- =============================================================================
-- 4. candidate_times  — 후보 × 멤버 N×K 이동시간 행렬 (정규화 선택)
--
--    설계 결정: 정규화 vs JSONB 트레이드오프
--    -------------------------------------------------------
--    JSONB 방식: candidates.times_jsonb JSONB
--      장점: 후보 1행 조회로 전체 times 획득, JOIN 불필요
--      단점: 특정 멤버 시간 필터링 불가(GIN 인덱스 필요),
--            멤버 이름 변경 시 JSONB 전체 재작성,
--            fair_gap/fair_avg 계산을 SQL 집계 함수로 못 씀
--    정규화 방식 (채택):
--      장점: SUM/AVG/STDDEV SQL 집계로 fair_score 자동 계산 가능,
--            멤버 삭제 시 CASCADE 정리,
--            특정 멤버 행만 UPDATE 가능 (재계산 최적화)
--      단점: 결과 화면에서 candidate_id IN (...) + JOIN members 필요
--            → 후보 5~10개 × 멤버 4~8명 = 최대 80행, 부담 없음
--    결론: 정규화. 후보당 최대 ~10명 행 수준이므로 성능 이슈 없음.
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.moira_candidate_times (
  id                   UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  candidate_id         UUID        NOT NULL
                         REFERENCES public.moira_candidates(id) ON DELETE CASCADE,
  member_id            UUID        NOT NULL
                         REFERENCES public.moira_members(id) ON DELETE CASCADE,

  -- 대중교통 이동 시간(분). NULL = 경로 없음(도달 불가)
  minutes              SMALLINT    CHECK (minutes > 0),
  -- 환승 횟수
  transfers            SMALLINT    NOT NULL DEFAULT 0 CHECK (transfers >= 0),

  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- 후보×멤버 유일 (재계산 시 UPSERT 대상)
  CONSTRAINT uq_candidate_member UNIQUE (candidate_id, member_id)
);

COMMENT ON TABLE  public.moira_candidate_times IS '후보×멤버 N×K 이동시간 행렬. 정규화 설계 — SQL 집계로 fair_score 계산 가능.';
COMMENT ON COLUMN public.moira_candidate_times.minutes IS 'NULL = 해당 멤버 출발지에서 도달 불가.';

CREATE OR REPLACE TRIGGER trg_moira_candidate_times_updated_at
  BEFORE UPDATE ON public.moira_candidate_times
  FOR EACH ROW EXECUTE FUNCTION moira_set_updated_at();

-- =============================================================================
-- 5. votes  — 투표 (1인 1표 멱등 강제)
--    voter_token_hash: 투표자 식별. invite_token_hash와 동일 시드 사용 권장.
--    UNIQUE(meetup_id, voter_token_hash) — 중복 투표 DB 레벨 차단.
--    INSERT ON CONFLICT DO NOTHING 으로 폴링 클라이언트가 재투표 시 안전.
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.moira_votes (
  id                   UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  meetup_id            UUID        NOT NULL
                         REFERENCES public.moira_meetups(id) ON DELETE CASCADE,
  candidate_id         UUID        NOT NULL
                         REFERENCES public.moira_candidates(id) ON DELETE CASCADE,

  -- 투표자 토큰 해시. invite_token_hash 와 동일 값 사용 (앱레벨 결정).
  voter_token_hash     TEXT        NOT NULL
                         CONSTRAINT chk_vote_voter_hash CHECK (length(voter_token_hash) = 64),

  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- 1인 1표: meetup 내에서 voter_token 중복 불가
  CONSTRAINT uq_vote_meetup_voter UNIQUE (meetup_id, voter_token_hash)
);

COMMENT ON TABLE  public.moira_votes IS '투표. UNIQUE(meetup_id, voter_token_hash)로 1인1표 DB 레벨 강제.';
COMMENT ON COLUMN public.moira_votes.voter_token_hash IS 'SHA-256(raw_invite_token). INSERT ON CONFLICT DO NOTHING으로 멱등 처리.';
