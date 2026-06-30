-- ============================================================
-- quota_usage 원자 증가 RPC 함수
-- 20260603000002_quota_rpc.sql
--
-- 동시 요청(race condition) 방지:
--   SELECT FOR UPDATE 없이 INSERT ... ON CONFLICT DO UPDATE 로 원자성 보장.
--   PostgreSQL의 UPSERT는 row-level lock을 암묵적으로 획득하므로
--   동시 increment 요청이 들어와도 lost update 없음.
--
-- 사용:
--   free tier  → increment_quota_day
--   basic/pro  → increment_quota_month
-- ============================================================

-- ──────────────────────────────────────────
-- 1. 무료 티어: day_count + month_count 동시 증가
-- ──────────────────────────────────────────
CREATE OR REPLACE FUNCTION increment_quota_day(
  p_user_id uuid,
  p_date    date,
  p_month   text,
  p_n       integer DEFAULT 1
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO quota_usage (user_id, usage_date, day_count, period_month, month_count)
  VALUES (p_user_id, p_date, p_n, p_month, p_n)
  ON CONFLICT (user_id, usage_date)
  DO UPDATE SET
    day_count   = quota_usage.day_count   + p_n,
    month_count = quota_usage.month_count + p_n,
    updated_at  = now();
END;
$$;

-- ──────────────────────────────────────────
-- 2. 유료 티어: 오늘 행의 month_count 증가
--    동일 날짜 행이 없으면 새로 생성
-- ──────────────────────────────────────────
CREATE OR REPLACE FUNCTION increment_quota_month(
  p_user_id uuid,
  p_date    date,
  p_month   text,
  p_n       integer DEFAULT 1
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO quota_usage (user_id, usage_date, day_count, period_month, month_count)
  VALUES (p_user_id, p_date, p_n, p_month, p_n)
  ON CONFLICT (user_id, usage_date)
  DO UPDATE SET
    day_count   = quota_usage.day_count   + p_n,
    month_count = quota_usage.month_count + p_n,
    updated_at  = now();
END;
$$;

-- RPC 함수는 service role에서만 실행 (SECURITY DEFINER + anon 실행 권한 제거)
REVOKE EXECUTE ON FUNCTION increment_quota_day FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION increment_quota_month FROM anon, authenticated;
