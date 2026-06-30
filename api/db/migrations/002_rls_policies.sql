-- =============================================================================
-- Oreum (오름) — 002 RLS Policies
-- Supabase Row Level Security — 전 테이블 적용
-- 레드라인: user_id != auth.uid() 인 행은 어떤 정책에서도 노출 불가
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 패턴 요약
--  - 일반 사용자 (authenticated): USING (user_id = auth.uid())
--  - 서버 전용 INSERT: service_role 역할만 허용 (클라이언트 차단)
--  - anon 역할: 모든 테이블 접근 거부 (기본 deny)
-- ---------------------------------------------------------------------------

-- =============================================================================
-- 1. users
-- =============================================================================
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

-- 본인 행만 조회
DROP POLICY IF EXISTS "users_select_own" ON public.users;
CREATE POLICY "users_select_own"
  ON public.users
  FOR SELECT
  TO authenticated
  USING (id = auth.uid());

-- 본인 행만 수정 (is_anonymized, id 는 앱 서버가 service_role 로 갱신)
DROP POLICY IF EXISTS "users_update_own" ON public.users;
CREATE POLICY "users_update_own"
  ON public.users
  FOR UPDATE
  TO authenticated
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

-- 최초 프로필 생성은 Supabase Auth 트리거 또는 서버(service_role) 전담
-- authenticated 직접 INSERT 차단 → 가입 플로우는 서버 미들웨어 경유
DROP POLICY IF EXISTS "users_insert_server_only" ON public.users;
CREATE POLICY "users_insert_server_only"
  ON public.users
  FOR INSERT
  TO service_role
  WITH CHECK (TRUE);

-- 소프트 삭제 처리도 서버 전담 (DELETE 차단)
-- authenticated 에게 DELETE 정책 없음 = 전면 차단

-- =============================================================================
-- 2. daily_checkin
-- =============================================================================
ALTER TABLE public.daily_checkin ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "checkin_select_own" ON public.daily_checkin;
CREATE POLICY "checkin_select_own"
  ON public.daily_checkin
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- 체크인 INSERT: authenticated 허용 (사용자가 직접 제출)
-- 단, user_id 를 auth.uid() 로 강제 → 타인 ID 삽입 불가
DROP POLICY IF EXISTS "checkin_insert_own" ON public.daily_checkin;
CREATE POLICY "checkin_insert_own"
  ON public.daily_checkin
  FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

-- 체크인 UPDATE: 당일 수정 허용 (서버 미들웨어에서 날짜 범위 추가 검증)
DROP POLICY IF EXISTS "checkin_update_own" ON public.daily_checkin;
CREATE POLICY "checkin_update_own"
  ON public.daily_checkin
  FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- =============================================================================
-- 3. score_snapshot
--    클라이언트 INSERT/UPDATE 완전 차단 — 일배치 잡(service_role)만 허용
-- =============================================================================
ALTER TABLE public.score_snapshot ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "snapshot_select_own" ON public.score_snapshot;
CREATE POLICY "snapshot_select_own"
  ON public.score_snapshot
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- 서버 전용 INSERT
DROP POLICY IF EXISTS "snapshot_insert_server_only" ON public.score_snapshot;
CREATE POLICY "snapshot_insert_server_only"
  ON public.score_snapshot
  FOR INSERT
  TO service_role
  WITH CHECK (TRUE);

-- 서버 전용 UPDATE (formula_version 업그레이드 시 재계산)
DROP POLICY IF EXISTS "snapshot_update_server_only" ON public.score_snapshot;
CREATE POLICY "snapshot_update_server_only"
  ON public.score_snapshot
  FOR UPDATE
  TO service_role
  USING (TRUE)
  WITH CHECK (TRUE);

-- =============================================================================
-- 4. mission
-- =============================================================================
ALTER TABLE public.mission ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "mission_select_own" ON public.mission;
CREATE POLICY "mission_select_own"
  ON public.mission
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- AI 자동 생성(source=ai)은 서버, 사용자 직접 생성(source=user)은 authenticated 허용
DROP POLICY IF EXISTS "mission_insert_own" ON public.mission;
CREATE POLICY "mission_insert_own"
  ON public.mission
  FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid() AND source = 'user');

DROP POLICY IF EXISTS "mission_insert_server" ON public.mission;
CREATE POLICY "mission_insert_server"
  ON public.mission
  FOR INSERT
  TO service_role
  WITH CHECK (TRUE);

-- 상태(status) 업데이트만 허용 (사용자 액션: done / skipped)
DROP POLICY IF EXISTS "mission_update_own" ON public.mission;
CREATE POLICY "mission_update_own"
  ON public.mission
  FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- =============================================================================
-- 5. goal
-- =============================================================================
ALTER TABLE public.goal ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "goal_select_own" ON public.goal;
CREATE POLICY "goal_select_own"
  ON public.goal
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "goal_insert_own" ON public.goal;
CREATE POLICY "goal_insert_own"
  ON public.goal
  FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "goal_update_own" ON public.goal;
CREATE POLICY "goal_update_own"
  ON public.goal
  FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- =============================================================================
-- 6. subscription
--    결제 상태는 서버(Toss/RevenueCat 웹훅 처리)만 변경 가능.
--    클라이언트: SELECT 만 허용.
-- =============================================================================
ALTER TABLE public.subscription ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "subscription_select_own" ON public.subscription;
CREATE POLICY "subscription_select_own"
  ON public.subscription
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- INSERT / UPDATE: 서버 전용 (결제 웹훅 처리)
DROP POLICY IF EXISTS "subscription_insert_server" ON public.subscription;
CREATE POLICY "subscription_insert_server"
  ON public.subscription
  FOR INSERT
  TO service_role
  WITH CHECK (TRUE);

DROP POLICY IF EXISTS "subscription_update_server" ON public.subscription;
CREATE POLICY "subscription_update_server"
  ON public.subscription
  FOR UPDATE
  TO service_role
  USING (TRUE)
  WITH CHECK (TRUE);

-- =============================================================================
-- 7. coach_chat
--    SELECT: 본인만
--    INSERT: 서버(service_role)만 — 클라이언트가 대화 내용을 직접 삽입 불가
--    (클라 → API Route → service_role → coach_chat 삽입 흐름 강제)
-- =============================================================================
ALTER TABLE public.coach_chat ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "chat_select_own" ON public.coach_chat;
CREATE POLICY "chat_select_own"
  ON public.coach_chat
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- 서버 전용 INSERT
DROP POLICY IF EXISTS "chat_insert_server_only" ON public.coach_chat;
CREATE POLICY "chat_insert_server_only"
  ON public.coach_chat
  FOR INSERT
  TO service_role
  WITH CHECK (TRUE);

-- PIPA 콘텐츠 삭제(content = NULL 치환)도 서버 전담
DROP POLICY IF EXISTS "chat_update_server_only" ON public.coach_chat;
CREATE POLICY "chat_update_server_only"
  ON public.coach_chat
  FOR UPDATE
  TO service_role
  USING (TRUE)
  WITH CHECK (TRUE);

-- =============================================================================
-- 검증 쿼리 (실행 후 아래 결과 확인)
-- SELECT tablename, policyname, roles, cmd
-- FROM pg_policies
-- WHERE schemaname = 'public'
-- ORDER BY tablename, cmd;
-- =============================================================================
