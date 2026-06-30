-- =============================================================================
-- Oreum (오름) — 001 Initial Schema
-- PostgreSQL 15+  /  Supabase Postgres
-- 모든 구문 idempotent (IF NOT EXISTS / OR REPLACE / ON CONFLICT DO NOTHING)
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 확장
-- ---------------------------------------------------------------------------
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_cron";     -- 004_cron_jobs.sql 에서 사용

-- ---------------------------------------------------------------------------
-- 헬퍼: updated_at 자동 갱신 함수 (003_indexes_and_triggers.sql 이전에 정의)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

-- =============================================================================
-- 1. users
--    Supabase auth.users 를 1:1 확장하는 프로필 테이블.
--    RLS: 본인 행만 SELECT/UPDATE 가능 (002_rls_policies.sql).
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.users (
  -- PK = Supabase Auth UID
  id                   UUID        PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,

  display_name         TEXT        NOT NULL DEFAULT '오름러',
  -- 생년(4자리). 가입 시점 만 16세 이상 검증용. 실제 생년월일은 저장 안 함(최소 수집).
  birth_year           SMALLINT    NOT NULL
                         CONSTRAINT chk_birth_year_range
                           CHECK (birth_year BETWEEN 1900 AND EXTRACT(YEAR FROM NOW())::SMALLINT),
  -- 앱레벨 ENUM: mentor | spartan | friend
  persona              TEXT        NOT NULL DEFAULT 'mentor'
                         CONSTRAINT chk_persona CHECK (persona IN ('mentor', 'spartan', 'friend')),
  north_star_statement TEXT        NOT NULL DEFAULT '',
  goal_90d_text        TEXT,
  -- 사용자 가중치 미세조정 JSON. 기본값은 score_formula.md 참조.
  -- 예: {"health":0.25,"learning":0.25,"relation":0.25,"achievement":0.25}
  weights              JSONB       NOT NULL DEFAULT '{"health":0.25,"learning":0.25,"relation":0.25,"achievement":0.25}'::JSONB,
  -- 90일 미접속 자동 익명화 플래그 (일배치 잡 설정)
  is_anonymized        BOOLEAN     NOT NULL DEFAULT FALSE,

  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_active_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at           TIMESTAMPTZ           -- 소프트 삭제

  -- NOTE: 만 16세 미만 차단은 서버 미들웨어(레드라인)에서 1차 차단.
  --       DB 레벨 CHECK는 birth_year <= CURRENT_YEAR - 16 를 런타임에 보장 못하므로
  --       앱 서버 레이어에서 (CURRENT_YEAR - birth_year) >= 16 재검증 필수.
);

COMMENT ON TABLE  public.users IS '오름 사용자 프로필 — Supabase auth.users 1:1 확장';
COMMENT ON COLUMN public.users.weights IS '4축 가중치 합산 = 1.0 강제는 앱 서버에서 검증';
COMMENT ON COLUMN public.users.is_anonymized IS 'TRUE 시 display_name = 탈퇴유저, email 마스킹 완료 상태';

-- =============================================================================
-- 2. daily_checkin
--    매일 1분 체크인 원천 데이터. 하루 1행 엄격히 제한.
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.daily_checkin (
  id           UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id      UUID        NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  date         DATE        NOT NULL,
  -- 4축 슬라이더 값. 예: {"health":72,"learning":68,"relation":55,"achievement":80}
  -- 각 축 0~100 범위 검증은 앱 서버에서 수행 (JSONB CHECK는 Postgres 15에서 경로 검사 가능하나 유지보수 복잡도 증가로 앱 레이어 위임)
  input_jsonb  JSONB       NOT NULL,
  note         TEXT,       -- 선택 1줄 메모 (NULL 허용)

  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at   TIMESTAMPTZ,

  CONSTRAINT uq_checkin_user_date UNIQUE (user_id, date)
);

COMMENT ON TABLE  public.daily_checkin IS '매일 1분 체크인 — (user_id, date) UNIQUE';
COMMENT ON COLUMN public.daily_checkin.input_jsonb IS '{"health":0~100,"learning":0~100,"relation":0~100,"achievement":0~100}';

-- =============================================================================
-- 3. score_snapshot
--    00:30 일배치 잡이 daily_checkin 을 집계해 생성. 클라이언트 직접 INSERT 불가(RLS).
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.score_snapshot (
  id                    UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id               UUID        NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  date                  DATE        NOT NULL,

  health                NUMERIC(5,2) NOT NULL CHECK (health    BETWEEN 0 AND 100),
  learning              NUMERIC(5,2) NOT NULL CHECK (learning  BETWEEN 0 AND 100),
  relation              NUMERIC(5,2) NOT NULL CHECK (relation  BETWEEN 0 AND 100),
  achievement           NUMERIC(5,2) NOT NULL CHECK (achievement BETWEEN 0 AND 100),
  total                 NUMERIC(5,2) NOT NULL CHECK (total     BETWEEN 0 AND 100),

  delta_from_yesterday  NUMERIC(6,2),  -- NULL = 첫 날 (전일 없음)
  formula_version       TEXT        NOT NULL DEFAULT 'v1',

  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at            TIMESTAMPTZ,

  CONSTRAINT uq_snapshot_user_date UNIQUE (user_id, date)
);

COMMENT ON TABLE  public.score_snapshot IS '일배치 계산 결과 — 서버만 INSERT 가능 (RLS)';
COMMENT ON COLUMN public.score_snapshot.delta_from_yesterday IS '어제 total 대비 오늘 total 차이. NULL = 기록 첫 날';

-- =============================================================================
-- 4. mission
--    데일리 미션(AI 자동 생성 daily) + 90일 마일스톤(milestone).
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.mission (
  id           UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id      UUID        NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  -- 앱레벨 ENUM: daily | milestone
  kind         TEXT        NOT NULL CONSTRAINT chk_mission_kind CHECK (kind IN ('daily', 'milestone')),
  title        TEXT        NOT NULL,
  body         TEXT,
  due_date     DATE,
  -- 앱레벨 ENUM: pending | done | skipped
  status       TEXT        NOT NULL DEFAULT 'pending'
                 CONSTRAINT chk_mission_status CHECK (status IN ('pending', 'done', 'skipped')),
  -- 앱레벨 ENUM: ai | user
  source       TEXT        NOT NULL DEFAULT 'ai'
                 CONSTRAINT chk_mission_source CHECK (source IN ('ai', 'user')),
  -- goal 과 연결 (nullable — goal 없이 미션만 생성 가능)
  goal_id      UUID        REFERENCES public.goal(id) ON DELETE SET NULL,

  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  deleted_at   TIMESTAMPTZ
);

COMMENT ON TABLE  public.mission IS '데일리 미션(kind=daily) + 90일 마일스톤(kind=milestone)';
COMMENT ON COLUMN public.mission.kind IS 'daily = 매일 1개 자동 생성 / milestone = 90일 목표 AI 분해 결과';

-- =============================================================================
-- 5. goal
--    90일 목표 — mission(kind=milestone) 과 1:N 관계.
--    NOTE: mission 테이블의 goal_id FK 때문에 mission 테이블 이전에 생성해야 한다.
--          실제 DDL 실행 순서: goal → mission (아래 ALTER TABLE 로 처리).
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.goal (
  id                UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id           UUID        NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  statement         TEXT        NOT NULL,
  start_date        DATE        NOT NULL DEFAULT CURRENT_DATE,
  end_date          DATE        NOT NULL
                      GENERATED ALWAYS AS (start_date + INTERVAL '90 days')::DATE STORED,
  -- AI 분해 결과. 예: [{"week":1,"title":"영어 단어 100개","done":false},...]
  milestones_jsonb  JSONB       NOT NULL DEFAULT '[]'::JSONB,
  -- 앱레벨 ENUM: active | completed | abandoned
  status            TEXT        NOT NULL DEFAULT 'active'
                      CONSTRAINT chk_goal_status CHECK (status IN ('active', 'completed', 'abandoned')),

  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at        TIMESTAMPTZ
);

COMMENT ON TABLE  public.goal IS '90일 목표 — end_date = start_date + 90일 (Generated Column)';
COMMENT ON COLUMN public.goal.milestones_jsonb IS '[{"week":N,"title":"...","done":bool}, ...]';

-- goal 테이블 생성 후 mission.goal_id FK 추가 (순환 참조 회피)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'fk_mission_goal'
      AND table_name = 'mission'
  ) THEN
    ALTER TABLE public.mission
      ADD CONSTRAINT fk_mission_goal
        FOREIGN KEY (goal_id) REFERENCES public.goal(id) ON DELETE SET NULL;
  END IF;
END;
$$;

-- =============================================================================
-- 6. subscription
--    구독 상태 — 유저당 1개 행 (현재 구독). 이력은 provider 웹훅으로 갱신.
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.subscription (
  id                       UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id                  UUID        NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  -- 앱레벨 ENUM: free | basic | pro
  plan                     TEXT        NOT NULL DEFAULT 'free'
                             CONSTRAINT chk_sub_plan CHECK (plan IN ('free', 'basic', 'pro')),
  -- 앱레벨 ENUM: toss | revenuecat
  provider                 TEXT        CONSTRAINT chk_sub_provider CHECK (provider IN ('toss', 'revenuecat')),
  provider_subscription_id TEXT,       -- 외부 구독 ID (Toss 주문번호 or RevenueCat subscriptionId)
  trial_started_at         TIMESTAMPTZ,
  trial_ends_at            TIMESTAMPTZ,
  current_period_end       TIMESTAMPTZ,
  -- 앱레벨 ENUM: trialing | active | canceled | past_due
  status                   TEXT        NOT NULL DEFAULT 'trialing'
                             CONSTRAINT chk_sub_status CHECK (status IN ('trialing', 'active', 'canceled', 'past_due')),

  created_at               TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at               TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at               TIMESTAMPTZ,

  -- 유저당 활성 구독 1개 제한 (삭제되지 않은 행)
  CONSTRAINT uq_subscription_user UNIQUE (user_id)
);

COMMENT ON TABLE  public.subscription IS '현재 구독 상태 — paywall 게이트: plan=free AND (NOW()-users.created_at > 3 days)';
COMMENT ON COLUMN public.subscription.provider_subscription_id IS 'Toss 주문번호 or RevenueCat subscriptionId';

-- =============================================================================
-- 7. coach_chat
--    AI 코치 대화 기록. 클라가 직접 INSERT 불가 — 서버(service_role)만 삽입.
--    cost_krw 누적으로 ₩200/유저/월 상한 관리 (Upstash Redis 카운터 보조).
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.coach_chat (
  id         UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id    UUID        NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  session_id UUID        NOT NULL DEFAULT uuid_generate_v4(),  -- 대화 세션 묶음
  -- 앱레벨 ENUM: user | assistant
  role       TEXT        NOT NULL CONSTRAINT chk_chat_role CHECK (role IN ('user', 'assistant')),
  content    TEXT        NOT NULL,
  -- 페르소나 스냅샷 (대화 시점 페르소나, users.persona 변경 영향 없이 보존)
  persona    TEXT        NOT NULL CONSTRAINT chk_chat_persona CHECK (persona IN ('mentor', 'spartan', 'friend')),
  tokens_in  INTEGER     NOT NULL DEFAULT 0 CHECK (tokens_in >= 0),
  tokens_out INTEGER     NOT NULL DEFAULT 0 CHECK (tokens_out >= 0),
  -- 원화 비용 소수점 4자리 (예: ₩0.0012 = 0.0012)
  cost_krw   NUMERIC(10,4) NOT NULL DEFAULT 0 CHECK (cost_krw >= 0),
  -- 앱레벨 ENUM: claude-sonnet | claude-haiku | gpt-4o-mini
  model      TEXT        NOT NULL DEFAULT 'claude-sonnet',

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  -- PIPA 1년 후 content 삭제 정책: content 를 NULL 로 치환, 메타(tokens, cost) 유지
  deleted_at TIMESTAMPTZ  -- NULL = 활성. NOT NULL = content 삭제 예약
);

COMMENT ON TABLE  public.coach_chat IS 'AI 코치 대화 기록 — 클라 INSERT 불가(RLS service_role only). PIPA 1년 후 content 삭제';
COMMENT ON COLUMN public.coach_chat.cost_krw IS '₩200/유저/월 상한 관리. Upstash Redis 카운터와 병행 사용';
COMMENT ON COLUMN public.coach_chat.content IS '1년 경과 후 NULL 처리 (메타는 유지, PIPA 최소수집 정책)';
