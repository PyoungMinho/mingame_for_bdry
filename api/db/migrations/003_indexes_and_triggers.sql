-- =============================================================================
-- Oreum (오름) — 003 Indexes & Triggers
-- PostgreSQL 15+  /  IF NOT EXISTS 로 재실행 안전
-- =============================================================================

-- ---------------------------------------------------------------------------
-- A. 인덱스 전략
-- ---------------------------------------------------------------------------
-- 설계 원칙
--  1. (user_id, date DESC) — 시계열 조회 패턴 핵심 (checkin, snapshot)
--  2. (user_id, status)   — 미션 필터링 (pending 조회가 대부분)
--  3. (user_id, created_at DESC) — 코치챗 페이지네이션
--  4. (user_id, session_id)      — 세션 단위 대화 묶음 조회
--  5. partial index (deleted_at IS NULL) — 소프트 삭제 행 제외
-- ---------------------------------------------------------------------------

-- ---- users ------------------------------------------------------------------
-- last_active_at: 90일 미접속 익명화 잡 전용 (배치 효율)
CREATE INDEX IF NOT EXISTS idx_users_last_active
  ON public.users (last_active_at)
  WHERE deleted_at IS NULL AND is_anonymized = FALSE;

-- ---- daily_checkin ----------------------------------------------------------
-- 특정 유저의 날짜별 조회 (홈 화면, 오늘 체크인 여부 확인)
CREATE INDEX IF NOT EXISTS idx_checkin_user_date
  ON public.daily_checkin (user_id, date DESC)
  WHERE deleted_at IS NULL;

-- 날짜 범위 쿼리 (7일 / 30일 / 90일 구간 통계)
CREATE INDEX IF NOT EXISTS idx_checkin_date
  ON public.daily_checkin (date DESC)
  WHERE deleted_at IS NULL;

-- ---- score_snapshot ---------------------------------------------------------
-- 핵심: 특정 유저의 최신 점수 스냅샷 (홈 점수 표시, 전일 대비 delta)
CREATE INDEX IF NOT EXISTS idx_snapshot_user_date
  ON public.score_snapshot (user_id, date DESC)
  WHERE deleted_at IS NULL;

-- 배치 재계산: formula_version 별 재처리
CREATE INDEX IF NOT EXISTS idx_snapshot_formula_version
  ON public.score_snapshot (formula_version, date)
  WHERE deleted_at IS NULL;

-- ---- mission ----------------------------------------------------------------
-- pending 미션 조회 (홈 화면 오늘의 미션)
CREATE INDEX IF NOT EXISTS idx_mission_user_status
  ON public.mission (user_id, status)
  WHERE deleted_at IS NULL;

-- 데일리 미션 due_date 기준 조회 (배치 생성 중복 방지)
CREATE INDEX IF NOT EXISTS idx_mission_user_kind_due
  ON public.mission (user_id, kind, due_date)
  WHERE deleted_at IS NULL;

-- goal 연결 조회
CREATE INDEX IF NOT EXISTS idx_mission_goal_id
  ON public.mission (goal_id)
  WHERE goal_id IS NOT NULL AND deleted_at IS NULL;

-- ---- goal -------------------------------------------------------------------
-- 활성 목표 조회
CREATE INDEX IF NOT EXISTS idx_goal_user_status
  ON public.goal (user_id, status)
  WHERE deleted_at IS NULL;

-- end_date 기준 만료 처리 (배치 상태 갱신)
CREATE INDEX IF NOT EXISTS idx_goal_end_date
  ON public.goal (end_date)
  WHERE status = 'active' AND deleted_at IS NULL;

-- ---- subscription -----------------------------------------------------------
-- 결제 상태 빠른 조회 (API 미들웨어 paywall 판단)
CREATE INDEX IF NOT EXISTS idx_subscription_user_status
  ON public.subscription (user_id, status)
  WHERE deleted_at IS NULL;

-- 구독 만료 처리 배치 (current_period_end 기준)
CREATE INDEX IF NOT EXISTS idx_subscription_period_end
  ON public.subscription (current_period_end)
  WHERE status IN ('active', 'trialing') AND deleted_at IS NULL;

-- ---- coach_chat -------------------------------------------------------------
-- 유저별 대화 목록 페이지네이션 (최신순)
CREATE INDEX IF NOT EXISTS idx_chat_user_created
  ON public.coach_chat (user_id, created_at DESC);

-- 세션 단위 대화 묶음 조회
CREATE INDEX IF NOT EXISTS idx_chat_session
  ON public.coach_chat (session_id, created_at ASC);

-- 비용 집계 (월별 유저 AI 비용 상한 계산)
-- cost_krw 집계 쿼리: SUM(cost_krw) WHERE user_id=? AND created_at >= 이번달 01일
CREATE INDEX IF NOT EXISTS idx_chat_user_cost_month
  ON public.coach_chat (user_id, created_at DESC)
  WHERE cost_krw > 0;

-- PIPA 콘텐츠 삭제 대상 (1년 초과 행)
CREATE INDEX IF NOT EXISTS idx_chat_pipa_cleanup
  ON public.coach_chat (created_at)
  WHERE deleted_at IS NULL;

-- ---------------------------------------------------------------------------
-- B. updated_at 자동 갱신 트리거
--    set_updated_at() 함수는 001_initial_schema.sql 에서 정의
-- ---------------------------------------------------------------------------

-- users
DROP TRIGGER IF EXISTS trg_users_updated_at ON public.users;
CREATE TRIGGER trg_users_updated_at
  BEFORE UPDATE ON public.users
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- daily_checkin
DROP TRIGGER IF EXISTS trg_checkin_updated_at ON public.daily_checkin;
CREATE TRIGGER trg_checkin_updated_at
  BEFORE UPDATE ON public.daily_checkin
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- score_snapshot
DROP TRIGGER IF EXISTS trg_snapshot_updated_at ON public.score_snapshot;
CREATE TRIGGER trg_snapshot_updated_at
  BEFORE UPDATE ON public.score_snapshot
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- mission
DROP TRIGGER IF EXISTS trg_mission_updated_at ON public.mission;
CREATE TRIGGER trg_mission_updated_at
  BEFORE UPDATE ON public.mission
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- goal
DROP TRIGGER IF EXISTS trg_goal_updated_at ON public.goal;
CREATE TRIGGER trg_goal_updated_at
  BEFORE UPDATE ON public.goal
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- subscription
DROP TRIGGER IF EXISTS trg_subscription_updated_at ON public.subscription;
CREATE TRIGGER trg_subscription_updated_at
  BEFORE UPDATE ON public.subscription
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- coach_chat
DROP TRIGGER IF EXISTS trg_chat_updated_at ON public.coach_chat;
CREATE TRIGGER trg_chat_updated_at
  BEFORE UPDATE ON public.coach_chat
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ---------------------------------------------------------------------------
-- C. last_active_at 갱신 트리거
--    daily_checkin INSERT 시 users.last_active_at 자동 갱신.
--    90일 미접속 익명화 잡의 기준 타임스탬프 유지 목적.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION update_last_active_on_checkin()
RETURNS TRIGGER LANGUAGE plpgsql
SECURITY DEFINER  -- service_role 수준으로 실행 (RLS 우회)
SET search_path = public
AS $$
BEGIN
  UPDATE public.users
  SET last_active_at = NOW()
  WHERE id = NEW.user_id;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_checkin_last_active ON public.daily_checkin;
CREATE TRIGGER trg_checkin_last_active
  AFTER INSERT ON public.daily_checkin
  FOR EACH ROW EXECUTE FUNCTION update_last_active_on_checkin();

-- ---------------------------------------------------------------------------
-- D. mission.completed_at 자동 설정 트리거
--    status = 'done' 으로 변경 시 completed_at 자동 기록
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION set_mission_completed_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.status = 'done' AND OLD.status != 'done' THEN
    NEW.completed_at = NOW();
  ELSIF NEW.status != 'done' THEN
    NEW.completed_at = NULL;  -- done 취소 시 초기화
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_mission_completed_at ON public.mission;
CREATE TRIGGER trg_mission_completed_at
  BEFORE UPDATE OF status ON public.mission
  FOR EACH ROW EXECUTE FUNCTION set_mission_completed_at();
