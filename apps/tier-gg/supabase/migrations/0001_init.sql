-- ============================================================
-- Tier.gg — 0001_init.sql
-- 모든 테이블, 인덱스, RLS 정책
-- DB 설계자: @DB설계자 (Sonnet) — 2026-05-28
-- ============================================================

-- updated_at 자동 갱신 함수
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- 1. categories
--    비교 도구 포털의 최상위 도메인 분류
--    예: ai_model, youtube_channel, certification
-- ============================================================
CREATE TABLE IF NOT EXISTS categories (
  id          BIGSERIAL    PRIMARY KEY,
  slug        TEXT         NOT NULL UNIQUE,           -- URL-safe 식별자
  name        TEXT         NOT NULL,
  schema      JSONB        NOT NULL DEFAULT '{}',      -- 카테고리별 가변 attrs 정의
  created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ,
  deleted_at  TIMESTAMPTZ
);

CREATE TRIGGER trg_categories_updated_at
  BEFORE UPDATE ON categories
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ============================================================
-- 2. providers
--    모델/서비스 제공사
-- ============================================================
CREATE TABLE IF NOT EXISTS providers (
  id          BIGSERIAL    PRIMARY KEY,
  slug        TEXT         NOT NULL UNIQUE,
  name        TEXT         NOT NULL,
  country     TEXT,
  website     TEXT,
  logo_color  TEXT,                                   -- 브랜드 대표 색상 hex
  created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ,
  deleted_at  TIMESTAMPTZ
);

CREATE TRIGGER trg_providers_updated_at
  BEFORE UPDATE ON providers
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ============================================================
-- 3. entities
--    카테고리 내 비교 대상 (AI 모델, 유튜브 채널, 자격증 등)
--    EAV 구조: 공통 컬럼 + 가변 attrs JSONB
-- ============================================================
-- status: 앱레벨 ENUM (draft | review | published)
CREATE TABLE IF NOT EXISTS entities (
  id           BIGSERIAL    PRIMARY KEY,
  category_id  BIGINT       NOT NULL REFERENCES categories(id) ON DELETE RESTRICT,
  slug         TEXT         NOT NULL UNIQUE,            -- 글로벌 유일, URL의 /models/[slug]
  name         TEXT         NOT NULL,
  provider_id  BIGINT       REFERENCES providers(id) ON DELETE SET NULL,
  status       TEXT         NOT NULL DEFAULT 'draft'    -- draft | review | published
                            CHECK (status IN ('draft', 'review', 'published')),
  released_at  DATE,
  summary      TEXT,
  attrs        JSONB        NOT NULL DEFAULT '{}',       -- 카테고리별 가변 속성
  created_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ,
  deleted_at   TIMESTAMPTZ,
  UNIQUE (category_id, slug)
);

CREATE INDEX idx_entities_category_status ON entities (category_id, status)
  WHERE deleted_at IS NULL;
CREATE INDEX idx_entities_slug ON entities (slug)
  WHERE deleted_at IS NULL;
CREATE INDEX idx_entities_provider ON entities (provider_id)
  WHERE deleted_at IS NULL;

CREATE TRIGGER trg_entities_updated_at
  BEFORE UPDATE ON entities
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ============================================================
-- 4. benchmarks
--    카테고리별 측정 지표 정의
-- ============================================================
CREATE TABLE IF NOT EXISTS benchmarks (
  id           BIGSERIAL    PRIMARY KEY,
  category_id  BIGINT       NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
  slug         TEXT         NOT NULL,
  name         TEXT         NOT NULL,
  scale        NUMERIC,                                -- 점수 최대 스케일 (null = 비율/원화 등)
  unit         TEXT,                                   -- 단위 문자열 (tokens/s, $/M, %, pts 등)
  description  TEXT,
  created_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ,
  deleted_at   TIMESTAMPTZ,
  UNIQUE (category_id, slug)
);

CREATE TRIGGER trg_benchmarks_updated_at
  BEFORE UPDATE ON benchmarks
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ============================================================
-- 5. sources
--    데이터 출처 (T1 공식 / T2 외부 집계 / T3 커뮤니티)
-- ============================================================
-- type: official | aggregator | community
-- confidence: T1 | T2 | T3
CREATE TABLE IF NOT EXISTS sources (
  id           BIGSERIAL    PRIMARY KEY,
  url          TEXT         NOT NULL,
  type         TEXT         NOT NULL
                            CHECK (type IN ('official', 'aggregator', 'community')),
  confidence   TEXT         NOT NULL
                            CHECK (confidence IN ('T1', 'T2', 'T3')),
  fetched_at   TIMESTAMPTZ,
  verified_at  TIMESTAMPTZ,
  created_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ,
  deleted_at   TIMESTAMPTZ
);

CREATE INDEX idx_sources_confidence ON sources (confidence);

CREATE TRIGGER trg_sources_updated_at
  BEFORE UPDATE ON sources
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ============================================================
-- 6. scores
--    entity × benchmark 측정값 (출처 연결)
-- ============================================================
CREATE TABLE IF NOT EXISTS scores (
  id            BIGSERIAL    PRIMARY KEY,
  entity_id     BIGINT       NOT NULL REFERENCES entities(id) ON DELETE CASCADE,
  benchmark_id  BIGINT       NOT NULL REFERENCES benchmarks(id) ON DELETE CASCADE,
  value         NUMERIC      NOT NULL,
  source_id     BIGINT       REFERENCES sources(id) ON DELETE SET NULL,
  measured_at   DATE,
  created_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ,
  deleted_at    TIMESTAMPTZ
);

-- 핵심 조회 패턴: entity별 모든 점수, benchmark별 랭킹
CREATE INDEX idx_scores_entity ON scores (entity_id)
  WHERE deleted_at IS NULL;
CREATE INDEX idx_scores_benchmark ON scores (benchmark_id)
  WHERE deleted_at IS NULL;
CREATE INDEX idx_scores_entity_benchmark ON scores (entity_id, benchmark_id)
  WHERE deleted_at IS NULL;

CREATE TRIGGER trg_scores_updated_at
  BEFORE UPDATE ON scores
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ============================================================
-- 7. changelog
--    모델 데이터 변경 이력 (감사 로그)
-- ============================================================
CREATE TABLE IF NOT EXISTS changelog (
  id          BIGSERIAL    PRIMARY KEY,
  entity_id   BIGINT       REFERENCES entities(id) ON DELETE SET NULL,
  field       TEXT         NOT NULL,                  -- 변경된 필드명
  old_value   JSONB,
  new_value   JSONB,
  changed_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  changed_by  TEXT,                                   -- 관리자 식별자 (email/username)
  created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ,
  deleted_at  TIMESTAMPTZ
);

CREATE INDEX idx_changelog_entity ON changelog (entity_id, changed_at DESC);

CREATE TRIGGER trg_changelog_updated_at
  BEFORE UPDATE ON changelog
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ============================================================
-- RLS (Row Level Security)
-- public: SELECT 허용
-- INSERT / UPDATE / DELETE: service_role 전용
-- ============================================================

ALTER TABLE categories  ENABLE ROW LEVEL SECURITY;
ALTER TABLE providers   ENABLE ROW LEVEL SECURITY;
ALTER TABLE entities    ENABLE ROW LEVEL SECURITY;
ALTER TABLE benchmarks  ENABLE ROW LEVEL SECURITY;
ALTER TABLE sources     ENABLE ROW LEVEL SECURITY;
ALTER TABLE scores      ENABLE ROW LEVEL SECURITY;
ALTER TABLE changelog   ENABLE ROW LEVEL SECURITY;

-- PUBLIC SELECT (anon + authenticated 모두)
CREATE POLICY "public_select_categories"  ON categories  FOR SELECT USING (deleted_at IS NULL);
CREATE POLICY "public_select_providers"   ON providers   FOR SELECT USING (deleted_at IS NULL);
CREATE POLICY "public_select_entities"    ON entities    FOR SELECT USING (deleted_at IS NULL AND status = 'published');
CREATE POLICY "public_select_benchmarks"  ON benchmarks  FOR SELECT USING (deleted_at IS NULL);
CREATE POLICY "public_select_sources"     ON sources     FOR SELECT USING (deleted_at IS NULL);
CREATE POLICY "public_select_scores"      ON scores      FOR SELECT USING (deleted_at IS NULL);
CREATE POLICY "public_select_changelog"   ON changelog   FOR SELECT USING (deleted_at IS NULL);

-- service_role: 전체 접근 (Supabase 기본 service_role bypass RLS 활용)
-- 아래는 명시적 정책 (bypass 설정이 없는 환경 대비)
CREATE POLICY "service_insert_categories"  ON categories  FOR INSERT WITH CHECK (auth.role() = 'service_role');
CREATE POLICY "service_update_categories"  ON categories  FOR UPDATE USING (auth.role() = 'service_role');
CREATE POLICY "service_delete_categories"  ON categories  FOR DELETE USING (auth.role() = 'service_role');

CREATE POLICY "service_insert_providers"   ON providers   FOR INSERT WITH CHECK (auth.role() = 'service_role');
CREATE POLICY "service_update_providers"   ON providers   FOR UPDATE USING (auth.role() = 'service_role');
CREATE POLICY "service_delete_providers"   ON providers   FOR DELETE USING (auth.role() = 'service_role');

CREATE POLICY "service_insert_entities"    ON entities    FOR INSERT WITH CHECK (auth.role() = 'service_role');
CREATE POLICY "service_update_entities"    ON entities    FOR UPDATE USING (auth.role() = 'service_role');
CREATE POLICY "service_delete_entities"    ON entities    FOR DELETE USING (auth.role() = 'service_role');

CREATE POLICY "service_insert_benchmarks"  ON benchmarks  FOR INSERT WITH CHECK (auth.role() = 'service_role');
CREATE POLICY "service_update_benchmarks"  ON benchmarks  FOR UPDATE USING (auth.role() = 'service_role');
CREATE POLICY "service_delete_benchmarks"  ON benchmarks  FOR DELETE USING (auth.role() = 'service_role');

CREATE POLICY "service_insert_sources"     ON sources     FOR INSERT WITH CHECK (auth.role() = 'service_role');
CREATE POLICY "service_update_sources"     ON sources     FOR UPDATE USING (auth.role() = 'service_role');
CREATE POLICY "service_delete_sources"     ON sources     FOR DELETE USING (auth.role() = 'service_role');

CREATE POLICY "service_insert_scores"      ON scores      FOR INSERT WITH CHECK (auth.role() = 'service_role');
CREATE POLICY "service_update_scores"      ON scores      FOR UPDATE USING (auth.role() = 'service_role');
CREATE POLICY "service_delete_scores"      ON scores      FOR DELETE USING (auth.role() = 'service_role');

CREATE POLICY "service_insert_changelog"   ON changelog   FOR INSERT WITH CHECK (auth.role() = 'service_role');
CREATE POLICY "service_update_changelog"   ON changelog   FOR UPDATE USING (auth.role() = 'service_role');
CREATE POLICY "service_delete_changelog"   ON changelog   FOR DELETE USING (auth.role() = 'service_role');
