-- ============================================================
-- 툰일기(Toonlog) 초기 스키마
-- 20260603000001_initial_schema.sql
-- 설계 결정:
--   - balloons 는 panels.balloons jsonb[] 로 저장 (단순성·원자성)
--   - quota_usage 는 free=day단위/basic,pro=month단위 분리 컬럼
--   - RLS: 모든 사용자 데이터는 auth.uid() = user_id 본인 전용
--   - 소프트 삭제(deleted_at) 전체 적용
--   - ENUM은 앱 레이어에서 관리, DB는 text 타입 + CHECK 제약
--   - 타임스탬프: created_at/updated_at 트리거로 자동 관리
-- ============================================================

-- ──────────────────────────────────────────
-- 0. 헬퍼 함수: updated_at 자동 갱신 트리거
-- ──────────────────────────────────────────
CREATE OR REPLACE FUNCTION toonlog_set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- ──────────────────────────────────────────
-- 1. profiles — auth.users 1:1 확장
--    tier / avatar / default_art_style / theme / beta_earlybird
-- ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS profiles (
  -- auth.users 의 id 를 PK 겸 FK 로 사용
  id                  uuid        PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,

  tier                text        NOT NULL DEFAULT 'free'
                                  CHECK (tier IN ('free', 'basic', 'pro')),

  -- AvatarConfig (contract.ts) 전체를 jsonb 로 저장
  -- { preset, hairColor, topStyle, accessory, seed }
  avatar              jsonb       NOT NULL DEFAULT '{
    "hairColor": "black",
    "topStyle": "white-top",
    "accessory": "none",
    "seed": 0
  }'::jsonb,

  -- 마지막 사용 화풍 기억 (constants.DEFAULT_ART_STYLE = emotional_line)
  default_art_style   text        NOT NULL DEFAULT 'emotional_line'
                                  CHECK (default_art_style IN (
                                    'emotional_line','bold_pen','pop_cartoon','watercolor_touch'
                                  )),

  -- 사용자 테마 설정: 'system' | 'light' | 'dark'
  theme               text        NOT NULL DEFAULT 'system'
                                  CHECK (theme IN ('system','light','dark')),

  -- 베타 얼리버드 30% 할인 대상 여부 (project-direction §3.2)
  beta_earlybird      boolean     NOT NULL DEFAULT false,

  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now(),
  deleted_at          timestamptz
);

CREATE TRIGGER trg_profiles_updated_at
  BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION toonlog_set_updated_at();

-- 인덱스: 소프트 삭제 필터링용
CREATE INDEX IF NOT EXISTS idx_profiles_deleted_at ON profiles (deleted_at) WHERE deleted_at IS NULL;

-- RLS
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY profiles_select_own ON profiles
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY profiles_insert_own ON profiles
  FOR INSERT WITH CHECK (auth.uid() = id);

CREATE POLICY profiles_update_own ON profiles
  FOR UPDATE USING (auth.uid() = id);

-- 삭제는 소프트 삭제(deleted_at 갱신)만 허용, 하드 삭제는 service role만
CREATE POLICY profiles_delete_own ON profiles
  FOR DELETE USING (false); -- 하드 삭제 금지

-- ──────────────────────────────────────────
-- 2. diaries — 일기 원문 + 생성 상태
--    text 컬럼: 앱 레이어에서 AES-256-GCM 암호화 후 저장
--               (암호화 키 = Supabase Vault 또는 환경변수 DIARY_ENCRYPTION_KEY)
-- ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS diaries (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- 일기 원문(50~300자). 앱 레이어 암호화 적용. DB는 text로 저장(암호문=base64)
  -- ⚠️  저장 전 반드시 lib/db/crypto.ts encryptDiary() 를 거칠 것
  text        text        NOT NULL,

  art_style   text        NOT NULL
              CHECK (art_style IN ('emotional_line','bold_pen','pop_cartoon','watercolor_touch')),

  -- 생성 요청 시점의 AvatarConfig 스냅샷 (이후 프로필 변경에 영향받지 않음)
  avatar      jsonb       NOT NULL DEFAULT '{}'::jsonb,

  status      text        NOT NULL DEFAULT 'draft'
              CHECK (status IN ('draft','queued','generating','completed','failed')),

  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  deleted_at  timestamptz
);

CREATE TRIGGER trg_diaries_updated_at
  BEFORE UPDATE ON diaries
  FOR EACH ROW EXECUTE FUNCTION toonlog_set_updated_at();

-- 아카이브 캘린더용 인덱스 (project-direction §4: 365편 아카이브)
-- user_id + created_at DESC 복합 인덱스로 월별/연별 조회 최적화
CREATE INDEX IF NOT EXISTS idx_diaries_user_created
  ON diaries (user_id, created_at DESC) WHERE deleted_at IS NULL;

-- status 필터링 (생성 중인 작업 조회)
CREATE INDEX IF NOT EXISTS idx_diaries_user_status
  ON diaries (user_id, status) WHERE deleted_at IS NULL;

-- RLS
ALTER TABLE diaries ENABLE ROW LEVEL SECURITY;

CREATE POLICY diaries_select_own ON diaries
  FOR SELECT USING (auth.uid() = user_id AND deleted_at IS NULL);

CREATE POLICY diaries_insert_own ON diaries
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY diaries_update_own ON diaries
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY diaries_delete_own ON diaries
  FOR DELETE USING (false); -- 소프트 삭제만 허용

-- ──────────────────────────────────────────
-- 3. panels — 4컷 이미지 + 말풍선 메타
--    balloons jsonb[] 선택 이유:
--      - BalloonMeta 는 패널에 종속, 독립 조회 필요 없음
--      - 패널 조회 = 말풍선 동시 조회 → JOIN 비용 제거
--      - 말풍선 순서·원자성 보장 (트랜잭션 단위가 패널 전체)
--      - 별도 테이블 시 패널 4개 × 말풍선 n개 = 최대 ~12행 → 오버헤드
-- ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS panels (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  diary_id    uuid        NOT NULL REFERENCES diaries(id) ON DELETE CASCADE,

  -- 컷 번호: 1~4
  panel_index smallint    NOT NULL CHECK (panel_index BETWEEN 1 AND 4),

  -- 원본 이미지 URL (GCS / R2)
  image_url   text,

  -- 무료 티어 512px 미리보기 URL (있으면 뷰어에서 우선 노출)
  preview_url text,

  -- LLM 생성 장면 요약 (접근성 alt 텍스트)
  caption     text,

  -- BalloonMeta[] (contract.ts) — jsonb 배열
  -- [{ id, type, tail, x, y, w, h, suggested_text }]
  balloons    jsonb       NOT NULL DEFAULT '[]'::jsonb,

  created_at  timestamptz NOT NULL DEFAULT now()
);

-- 다이어리당 컷 번호 유일성 보장
CREATE UNIQUE INDEX IF NOT EXISTS idx_panels_diary_index
  ON panels (diary_id, panel_index);

-- 다이어리별 전체 패널 조회 (결과 화면, SSE done 이벤트)
CREATE INDEX IF NOT EXISTS idx_panels_diary_id
  ON panels (diary_id);

-- RLS: diary 소유권 조인 검사
ALTER TABLE panels ENABLE ROW LEVEL SECURITY;

CREATE POLICY panels_select_own ON panels
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM diaries d
      WHERE d.id = diary_id AND d.user_id = auth.uid() AND d.deleted_at IS NULL
    )
  );

CREATE POLICY panels_insert_own ON panels
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM diaries d
      WHERE d.id = diary_id AND d.user_id = auth.uid()
    )
  );

CREATE POLICY panels_update_own ON panels
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM diaries d
      WHERE d.id = diary_id AND d.user_id = auth.uid()
    )
  );

CREATE POLICY panels_delete_own ON panels
  FOR DELETE USING (false);

-- ──────────────────────────────────────────
-- 4. generation_jobs — 생성 작업 추적 (SSE 상태 관리)
-- ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS generation_jobs (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  diary_id        uuid        NOT NULL REFERENCES diaries(id) ON DELETE CASCADE,

  stage           text        NOT NULL DEFAULT 'queued'
                  CHECK (stage IN ('queued','splitting','drawing','checking','finalizing')),

  -- 완성된 컷 수 (0~4) — SSE progress 이벤트 source
  completed_panels smallint   NOT NULL DEFAULT 0 CHECK (completed_panels BETWEEN 0 AND 4),

  total_panels    smallint    NOT NULL DEFAULT 4 CHECK (total_panels = 4),

  -- GenerationErrorCode (contract.ts) — 실패 시 기록
  error_code      text,

  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE TRIGGER trg_generation_jobs_updated_at
  BEFORE UPDATE ON generation_jobs
  FOR EACH ROW EXECUTE FUNCTION toonlog_set_updated_at();

-- diary_id 로 진행 중인 잡 조회
CREATE INDEX IF NOT EXISTS idx_generation_jobs_diary
  ON generation_jobs (diary_id);

-- 진행 중인 잡만 빠르게 조회 (큐 관리)
CREATE INDEX IF NOT EXISTS idx_generation_jobs_stage
  ON generation_jobs (stage) WHERE stage NOT IN ('finalizing');

-- RLS: diary 소유권 조인
ALTER TABLE generation_jobs ENABLE ROW LEVEL SECURITY;

CREATE POLICY jobs_select_own ON generation_jobs
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM diaries d
      WHERE d.id = diary_id AND d.user_id = auth.uid()
    )
  );

CREATE POLICY jobs_insert_own ON generation_jobs
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM diaries d
      WHERE d.id = diary_id AND d.user_id = auth.uid()
    )
  );

CREATE POLICY jobs_update_own ON generation_jobs
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM diaries d
      WHERE d.id = diary_id AND d.user_id = auth.uid()
    )
  );

-- ──────────────────────────────────────────
-- 5. subscriptions — 구독 정보
--    결제(Toss Payments) 연동 후 upsert
-- ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS subscriptions (
  id                uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  tier              text        NOT NULL CHECK (tier IN ('basic','pro')),
  period            text        NOT NULL CHECK (period IN ('monthly','yearly')),

  -- Toss Payments 빌링키 (서버사이드 보관, 클라이언트 노출 금지)
  toss_billing_key  text,

  -- 구독 상태: active / cancelled / expired / paused
  status            text        NOT NULL DEFAULT 'active'
                    CHECK (status IN ('active','cancelled','expired','paused')),

  started_at        timestamptz NOT NULL DEFAULT now(),
  expires_at        timestamptz,

  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now(),
  deleted_at        timestamptz
);

CREATE TRIGGER trg_subscriptions_updated_at
  BEFORE UPDATE ON subscriptions
  FOR EACH ROW EXECUTE FUNCTION toonlog_set_updated_at();

-- 유저당 활성 구독 조회
CREATE INDEX IF NOT EXISTS idx_subscriptions_user_active
  ON subscriptions (user_id, status) WHERE deleted_at IS NULL;

-- 만료 스케줄러용 (만료 예정 구독 배치 조회)
CREATE INDEX IF NOT EXISTS idx_subscriptions_expires
  ON subscriptions (expires_at) WHERE status = 'active';

-- RLS
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY subscriptions_select_own ON subscriptions
  FOR SELECT USING (auth.uid() = user_id AND deleted_at IS NULL);

-- insert/update/delete 는 service role 전용 (결제 서버에서만 처리)
CREATE POLICY subscriptions_no_client_write ON subscriptions
  FOR INSERT WITH CHECK (false);

-- ──────────────────────────────────────────
-- 6. credits_ledger — 크레딧 팩 원장
--    잔액은 집계(SUM) or 뷰로 계산.
--    비정규화(balance 컬럼 직접 관리) 하지 않음 — 정합성 우선.
--    고빈도 집계 필요 시 별도 credits_balance 테이블로 Phase 2 비정규화 가능.
-- ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS credits_ledger (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- 양수 = 구매/환불, 음수 = 사용
  delta         integer     NOT NULL,

  -- 'purchase' | 'consume' | 'refund' | 'admin_adjust'
  reason        text        NOT NULL,

  -- 이 레코드 삽입 직후 잔액 스냅샷 (감사 추적용, 집계 보조)
  balance_after integer     NOT NULL DEFAULT 0,

  created_at    timestamptz NOT NULL DEFAULT now()
  -- credits_ledger 는 불변 원장: updated_at / deleted_at 없음
);

-- 유저별 최근 원장 조회
CREATE INDEX IF NOT EXISTS idx_credits_ledger_user_created
  ON credits_ledger (user_id, created_at DESC);

-- RLS
ALTER TABLE credits_ledger ENABLE ROW LEVEL SECURITY;

CREATE POLICY credits_ledger_select_own ON credits_ledger
  FOR SELECT USING (auth.uid() = user_id);

-- 쓰기는 service role 전용
CREATE POLICY credits_ledger_no_client_write ON credits_ledger
  FOR INSERT WITH CHECK (false);

-- ──────────────────────────────────────────
-- 7. quota_usage — 사용 한도 추적
--    무료: 일 1회 (FREE_DAILY_LIMIT=1) → day + day_count
--    베이직: 월 30회 → period_month + month_count
--    프로:   월 150회 → period_month + month_count
--    설계 결정: 복합 PK(user_id, date) → UPSERT가 단순함
-- ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS quota_usage (
  user_id       uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- 날짜 (UTC 기준, 무료 티어 일일 리셋)
  usage_date    date        NOT NULL DEFAULT CURRENT_DATE,

  -- 해당 날 생성 횟수 (무료 티어 판단 기준)
  day_count     smallint    NOT NULL DEFAULT 0,

  -- 월 표기 (YYYY-MM) — 베이직/프로 월별 집계
  period_month  text        NOT NULL DEFAULT to_char(CURRENT_DATE, 'YYYY-MM'),

  -- 해당 월 생성 횟수 (베이직/프로 판단 기준)
  month_count   smallint    NOT NULL DEFAULT 0,

  updated_at    timestamptz NOT NULL DEFAULT now(),

  PRIMARY KEY (user_id, usage_date)
);

CREATE TRIGGER trg_quota_usage_updated_at
  BEFORE UPDATE ON quota_usage
  FOR EACH ROW EXECUTE FUNCTION toonlog_set_updated_at();

-- 인덱스: (user_id, usage_date) — 무료 일별 조회
CREATE INDEX IF NOT EXISTS idx_quota_usage_user_date
  ON quota_usage (user_id, usage_date DESC);

-- period_month 기준 월별 합산 조회 (베이직/프로)
CREATE INDEX IF NOT EXISTS idx_quota_usage_user_month
  ON quota_usage (user_id, period_month);

-- RLS
ALTER TABLE quota_usage ENABLE ROW LEVEL SECURITY;

CREATE POLICY quota_usage_select_own ON quota_usage
  FOR SELECT USING (auth.uid() = user_id);

-- UPSERT는 service role 전용 (tryConsumeQuota 함수에서 처리)
CREATE POLICY quota_usage_no_client_write ON quota_usage
  FOR INSERT WITH CHECK (false);

-- ──────────────────────────────────────────
-- 8. share_cards — 공유 카드 URL 캐싱 (선택)
--    Satori 렌더링 결과를 캐싱해 재요청 시 재생성 방지.
--    On-demand(16:9, 9:16)는 생성 후 여기에 저장.
-- ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS share_cards (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  diary_id    uuid        NOT NULL REFERENCES diaries(id) ON DELETE CASCADE,

  -- '1:1' | '16:9' | '9:16'
  ratio       text        NOT NULL CHECK (ratio IN ('1:1','16:9','9:16')),

  -- 렌더링된 공유 카드 URL (CDN)
  url         text        NOT NULL,

  created_at  timestamptz NOT NULL DEFAULT now()
);

-- 다이어리 + 비율로 기존 카드 조회
CREATE UNIQUE INDEX IF NOT EXISTS idx_share_cards_diary_ratio
  ON share_cards (diary_id, ratio);

-- RLS: diary 소유권 조인 (공유 수신자는 /share/:id 공개 엔드포인트 사용)
ALTER TABLE share_cards ENABLE ROW LEVEL SECURITY;

CREATE POLICY share_cards_select_own ON share_cards
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM diaries d
      WHERE d.id = diary_id AND d.user_id = auth.uid() AND d.deleted_at IS NULL
    )
  );

CREATE POLICY share_cards_insert_own ON share_cards
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM diaries d
      WHERE d.id = diary_id AND d.user_id = auth.uid()
    )
  );

-- ──────────────────────────────────────────
-- 9. 크레딧 잔액 뷰 (집계 편의)
--    getCredits() 함수에서 사용
-- ──────────────────────────────────────────
CREATE OR REPLACE VIEW credits_balance AS
  SELECT
    user_id,
    COALESCE(SUM(delta), 0)::integer AS balance
  FROM credits_ledger
  GROUP BY user_id;

-- ──────────────────────────────────────────
-- 10. 신규 유저 프로필 자동 생성 트리거
--     auth.users INSERT 시 profiles 행 생성
-- ──────────────────────────────────────────
CREATE OR REPLACE FUNCTION toonlog_handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO profiles (id, tier, avatar, default_art_style, theme, beta_earlybird)
  VALUES (
    NEW.id,
    'free',
    '{"hairColor":"black","topStyle":"white-top","accessory":"none","seed":0}'::jsonb,
    'emotional_line',
    'system',
    false
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION toonlog_handle_new_user();
