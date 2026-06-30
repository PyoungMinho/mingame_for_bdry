-- =============================================================================
-- Oreum (오름) — 004 Cron Jobs (pg_cron)
-- Supabase 대시보드: Extensions > pg_cron 활성화 필수
-- 모든 잡은 ON CONFLICT DO UPDATE 로 재실행 시 덮어쓰기 안전
-- 시각 기준: KST (UTC+9). pg_cron 은 UTC 기준 → KST 변환 표기 병기.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 사전 조건: pg_cron 확장 활성화
-- ---------------------------------------------------------------------------
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- =============================================================================
-- JOB 1: 90일 미접속 자동 익명화
-- KST 03:00 = UTC 18:00 (전날)
-- ---------------------------------------------------------------------------
-- 동작:
--   1. last_active_at < NOW() - 90 days 인 활성 유저 대상
--   2. display_name = '탈퇴유저'
--   3. is_anonymized = TRUE
--   4. Supabase Auth 이메일 마스킹은 별도 Edge Function 에서 처리
--      (auth.users 는 Postgres 트리거로 직접 수정 불가 — Supabase Admin API 경유)
--   5. score_snapshot, daily_checkin 은 user_id 기준 통계 유지 (삭제 X)
--   6. coach_chat.content 는 즉시 NULL 치환 (PII 포함 가능)
-- =============================================================================
SELECT cron.schedule(
  'oreum-anonymize-inactive-users',     -- 잡 이름 (ON CONFLICT 키)
  '0 18 * * *',                          -- UTC 18:00 = KST 03:00
  $$
  DO $$
  DECLARE
    v_count INTEGER;
  BEGIN
    -- 1. users 익명화
    UPDATE public.users
    SET
      display_name   = '탈퇴유저',
      is_anonymized  = TRUE,
      updated_at     = NOW()
    WHERE
      last_active_at < NOW() - INTERVAL '90 days'
      AND is_anonymized = FALSE
      AND deleted_at IS NULL;

    GET DIAGNOSTICS v_count = ROW_COUNT;
    RAISE NOTICE '[anonymize] users anonymized: %', v_count;

    -- 2. coach_chat content NULL 치환 (PII 포함 가능성)
    UPDATE public.coach_chat
    SET
      content    = '[익명화됨]',
      updated_at = NOW()
    WHERE
      user_id IN (
        SELECT id FROM public.users
        WHERE is_anonymized = TRUE AND deleted_at IS NULL
      )
      AND content != '[익명화됨]';

    GET DIAGNOSTICS v_count = ROW_COUNT;
    RAISE NOTICE '[anonymize] chat messages anonymized: %', v_count;
  END;
  $$;
  $$
)
ON CONFLICT (jobname) DO UPDATE
  SET schedule = EXCLUDED.schedule,
      command  = EXCLUDED.command;

-- =============================================================================
-- JOB 2: 일일 점수 스냅샷 계산·삽입
-- KST 00:30 = UTC 15:30 (전날)
-- ---------------------------------------------------------------------------
-- 동작:
--   1. 어제 날짜의 daily_checkin 행이 존재하는 유저 조회
--   2. score_formula.md 의 결정론적 가중치 공식 적용
--   3. score_snapshot 에 UPSERT
--   4. delta_from_yesterday = 오늘 total - 그저께 total
-- ---------------------------------------------------------------------------
-- NOTE: 실제 가중치 로직은 score_formula.md 참조.
--       잡 내부 SQL은 기본 가중치(0.25 균등)로 계산.
--       users.weights 커스텀 가중치는 Next.js API Route(/api/score/snapshot)에서
--       더 정교하게 처리하며, 잡은 미처리 행 백필(fallback) 역할 수행.
-- =============================================================================
SELECT cron.schedule(
  'oreum-daily-score-snapshot',
  '30 15 * * *',   -- UTC 15:30 = KST 00:30
  $$
  INSERT INTO public.score_snapshot (
    user_id, date,
    health, learning, relation, achievement, total,
    delta_from_yesterday,
    formula_version,
    created_at, updated_at
  )
  SELECT
    c.user_id,
    (NOW() AT TIME ZONE 'Asia/Seoul')::DATE - 1  AS target_date,

    -- 4축 원시값 (input_jsonb 에서 추출, 기본값 0)
    COALESCE((c.input_jsonb->>'health')::NUMERIC,      0) AS health,
    COALESCE((c.input_jsonb->>'learning')::NUMERIC,    0) AS learning,
    COALESCE((c.input_jsonb->>'relation')::NUMERIC,    0) AS relation,
    COALESCE((c.input_jsonb->>'achievement')::NUMERIC, 0) AS achievement,

    -- total = 균등 가중치 0.25 적용 (커스텀 가중치는 API Route 경유)
    ROUND(
      COALESCE((c.input_jsonb->>'health')::NUMERIC,      0) * 0.25 +
      COALESCE((c.input_jsonb->>'learning')::NUMERIC,    0) * 0.25 +
      COALESCE((c.input_jsonb->>'relation')::NUMERIC,    0) * 0.25 +
      COALESCE((c.input_jsonb->>'achievement')::NUMERIC, 0) * 0.25,
      2
    ) AS total,

    -- delta: 전일 스냅샷과의 total 차이
    (
      ROUND(
        COALESCE((c.input_jsonb->>'health')::NUMERIC,      0) * 0.25 +
        COALESCE((c.input_jsonb->>'learning')::NUMERIC,    0) * 0.25 +
        COALESCE((c.input_jsonb->>'relation')::NUMERIC,    0) * 0.25 +
        COALESCE((c.input_jsonb->>'achievement')::NUMERIC, 0) * 0.25,
        2
      ) - COALESCE(prev.total, 0)
    ) AS delta_from_yesterday,

    'v1' AS formula_version,
    NOW(), NOW()

  FROM public.daily_checkin c
  LEFT JOIN public.score_snapshot prev
    ON prev.user_id = c.user_id
    AND prev.date = (NOW() AT TIME ZONE 'Asia/Seoul')::DATE - 2

  WHERE
    c.date = (NOW() AT TIME ZONE 'Asia/Seoul')::DATE - 1
    AND c.deleted_at IS NULL

  ON CONFLICT (user_id, date) DO NOTHING;  -- API Route 선처리 시 중복 무시
  $$
)
ON CONFLICT (jobname) DO UPDATE
  SET schedule = EXCLUDED.schedule,
      command  = EXCLUDED.command;

-- =============================================================================
-- JOB 3: 데일리 미션 생성 큐잉
-- KST 05:00 = UTC 20:00 (전날)
-- ---------------------------------------------------------------------------
-- 동작:
--   1. 오늘 날짜 daily 미션이 없는 활성 유저를 조회
--   2. mission 테이블에 placeholder 행 삽입 (status=pending, source=ai)
--   3. 실제 AI 미션 내용(title, body)은 Next.js Edge Function이
--      이 pending 행을 감지 → Claude API 호출 → UPDATE 처리
--   4. AI 호출 실패 시 title = '오늘 하루 체크인을 완료하세요' 기본값 유지
-- =============================================================================
SELECT cron.schedule(
  'oreum-daily-mission-queue',
  '0 20 * * *',   -- UTC 20:00 = KST 05:00
  $$
  INSERT INTO public.mission (
    user_id, kind, title, body, due_date, status, source, created_at, updated_at
  )
  SELECT
    u.id,
    'daily',
    '오늘의 미션을 준비 중입니다...',  -- AI 처리 전 placeholder
    NULL,
    (NOW() AT TIME ZONE 'Asia/Seoul')::DATE,
    'pending',
    'ai',
    NOW(),
    NOW()
  FROM public.users u
  WHERE
    u.deleted_at IS NULL
    AND u.is_anonymized = FALSE
    -- 오늘 날짜 daily 미션이 이미 있으면 제외
    AND NOT EXISTS (
      SELECT 1 FROM public.mission m
      WHERE m.user_id = u.id
        AND m.kind = 'daily'
        AND m.due_date = (NOW() AT TIME ZONE 'Asia/Seoul')::DATE
        AND m.deleted_at IS NULL
    )
  ON CONFLICT DO NOTHING;
  $$
)
ON CONFLICT (jobname) DO UPDATE
  SET schedule = EXCLUDED.schedule,
      command  = EXCLUDED.command;

-- =============================================================================
-- JOB 4: PIPA 준수 — coach_chat 1년 경과 content 삭제
-- 매월 1일 KST 04:00 = UTC 19:00 (전달 말일)
-- ---------------------------------------------------------------------------
-- 동작:
--   1. created_at < NOW() - 1 year 인 coach_chat 행
--   2. content = '[만료됨]' 으로 치환 (행 자체는 유지, 토큰/비용 메타 보존)
--   3. deleted_at = NOW() 로 논리 삭제 플래그 설정
-- =============================================================================
SELECT cron.schedule(
  'oreum-pipa-chat-content-cleanup',
  '0 19 1 * *',   -- UTC 19:00 매월 1일 = KST 04:00 매월 1일
  $$
  UPDATE public.coach_chat
  SET
    content    = '[만료됨]',
    deleted_at = NOW(),
    updated_at = NOW()
  WHERE
    created_at < NOW() - INTERVAL '1 year'
    AND deleted_at IS NULL
    AND content NOT IN ('[만료됨]', '[익명화됨]');
  $$
)
ON CONFLICT (jobname) DO UPDATE
  SET schedule = EXCLUDED.schedule,
      command  = EXCLUDED.command;

-- ---------------------------------------------------------------------------
-- 잡 목록 확인 쿼리
-- SELECT jobid, jobname, schedule, active FROM cron.job ORDER BY jobname;
-- ---------------------------------------------------------------------------
