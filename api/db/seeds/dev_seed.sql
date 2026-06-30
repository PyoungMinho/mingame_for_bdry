-- =============================================================================
-- Oreum (오름) — Dev Seed Data
-- 개발/테스트 환경 전용. 프로덕션 실행 금지.
-- 테스트 유저 3명 (멘토/스파르타/친구 페르소나) + 7일치 체크인·점수 샘플
-- =============================================================================
-- 주의: Supabase auth.users 에 먼저 테스트 계정을 생성한 뒤 UUID 를 아래에 반영.
--       로컬 개발: supabase start → Dashboard > Authentication > Users 에서 수동 생성
--       또는 supabase/seed.sql 로 auth mock 처리.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 0. UUID 상수 (변경 금지 — 다른 seed 파일에서 참조)
-- ---------------------------------------------------------------------------
DO $$
BEGIN
  -- 개발 전용 UUID 상수를 임시 테이블로 관리
  CREATE TEMP TABLE IF NOT EXISTS _seed_ids (key TEXT PRIMARY KEY, val UUID);
  INSERT INTO _seed_ids VALUES
    ('user_mentor',   'aaaaaaaa-0000-4000-8000-000000000001'),
    ('user_sparta',   'aaaaaaaa-0000-4000-8000-000000000002'),
    ('user_friend',   'aaaaaaaa-0000-4000-8000-000000000003')
  ON CONFLICT DO NOTHING;
END;
$$;

-- ---------------------------------------------------------------------------
-- 1. users (프로필)
-- ---------------------------------------------------------------------------
INSERT INTO public.users (id, display_name, birth_year, persona, north_star_statement, goal_90d_text, weights)
VALUES
  (
    'aaaaaaaa-0000-4000-8000-000000000001',
    '김성장',
    1993,                                   -- 만 33세 (2026 기준)
    'mentor',
    '나는 건강하고 지적으로 성숙한 사람이 된다',
    '3개월 안에 영어 회화를 유창하게 한다',
    '{"health":0.30,"learning":0.30,"relation":0.20,"achievement":0.20}'::JSONB
  ),
  (
    'aaaaaaaa-0000-4000-8000-000000000002',
    '박도전',
    1998,                                   -- 만 28세
    'spartan',
    '나는 최강의 커리어와 체력을 동시에 갖춘 사람이 된다',
    '체지방 15% 이하 달성 + 이직 성공',
    '{"health":0.40,"learning":0.20,"relation":0.10,"achievement":0.30}'::JSONB
  ),
  (
    'aaaaaaaa-0000-4000-8000-000000000003',
    '이친구',
    1995,                                   -- 만 31세
    'friend',
    '나는 관계가 풍부하고 매일 즐거운 사람이 된다',
    '새로운 취미 3개 만들기 + 인맥 30명 확장',
    '{"health":0.20,"learning":0.20,"relation":0.40,"achievement":0.20}'::JSONB
  )
ON CONFLICT (id) DO NOTHING;

-- ---------------------------------------------------------------------------
-- 2. subscription (기본 free 플랜)
-- ---------------------------------------------------------------------------
INSERT INTO public.subscription (user_id, plan, status, trial_started_at, trial_ends_at)
VALUES
  ('aaaaaaaa-0000-4000-8000-000000000001', 'pro',  'active',   NOW() - INTERVAL '10 days', NOW() + INTERVAL '20 days'),
  ('aaaaaaaa-0000-4000-8000-000000000002', 'basic','active',   NOW() - INTERVAL '5 days',  NOW() + INTERVAL '25 days'),
  ('aaaaaaaa-0000-4000-8000-000000000003', 'free', 'trialing', NOW(),                       NOW() + INTERVAL '3 days')
ON CONFLICT (user_id) DO NOTHING;

-- ---------------------------------------------------------------------------
-- 3. goal (90일 목표)
-- ---------------------------------------------------------------------------
INSERT INTO public.goal (id, user_id, statement, start_date, milestones_jsonb, status)
VALUES
  (
    'bbbbbbbb-0000-4000-8000-000000000001',
    'aaaaaaaa-0000-4000-8000-000000000001',
    '3개월 안에 영어 회화를 유창하게 한다',
    CURRENT_DATE - 21,
    '[
      {"week":1,"title":"영어 단어 100개 암기","done":true},
      {"week":2,"title":"팝캐스트 매일 30분 청취","done":true},
      {"week":3,"title":"원어민 화상 튜터 주 2회","done":true},
      {"week":4,"title":"일상 주제 5분 스피킹 연습","done":false},
      {"week":5,"title":"비즈니스 이메일 10개 작성","done":false},
      {"week":6,"title":"토익 스피킹 모의 응시","done":false}
    ]'::JSONB,
    'active'
  ),
  (
    'bbbbbbbb-0000-4000-8000-000000000002',
    'aaaaaaaa-0000-4000-8000-000000000002',
    '체지방 15% 이하 달성 + 이직 성공',
    CURRENT_DATE - 14,
    '[
      {"week":1,"title":"헬스장 등록 + PT 상담","done":true},
      {"week":2,"title":"식단 기록 앱 연동","done":true},
      {"week":3,"title":"이력서 업데이트","done":false},
      {"week":4,"title":"포트폴리오 프로젝트 1개 완성","done":false}
    ]'::JSONB,
    'active'
  ),
  (
    'bbbbbbbb-0000-4000-8000-000000000003',
    'aaaaaaaa-0000-4000-8000-000000000003',
    '새로운 취미 3개 만들기 + 인맥 30명 확장',
    CURRENT_DATE - 7,
    '[
      {"week":1,"title":"클라이밍 입문 클래스 등록","done":true},
      {"week":2,"title":"독서모임 참가","done":false},
      {"week":3,"title":"사진 스터디 참가","done":false}
    ]'::JSONB,
    'active'
  )
ON CONFLICT (id) DO NOTHING;

-- ---------------------------------------------------------------------------
-- 4. daily_checkin — 7일치 (D-6 ~ D-0)
-- 각 유저별 성격에 맞는 체크인 패턴 반영
-- ---------------------------------------------------------------------------

-- 멘토 페르소나 (균형형 — 학습·건강 중시)
INSERT INTO public.daily_checkin (user_id, date, input_jsonb, note)
VALUES
  ('aaaaaaaa-0000-4000-8000-000000000001', CURRENT_DATE - 6, '{"health":70,"learning":80,"relation":60,"achievement":72}'::JSONB, '영어 단어 100개 완료'),
  ('aaaaaaaa-0000-4000-8000-000000000001', CURRENT_DATE - 5, '{"health":72,"learning":78,"relation":65,"achievement":70}'::JSONB, NULL),
  ('aaaaaaaa-0000-4000-8000-000000000001', CURRENT_DATE - 4, '{"health":68,"learning":85,"relation":62,"achievement":75}'::JSONB, '화상 튜터 첫 수업'),
  ('aaaaaaaa-0000-4000-8000-000000000001', CURRENT_DATE - 3, '{"health":75,"learning":82,"relation":68,"achievement":78}'::JSONB, NULL),
  ('aaaaaaaa-0000-4000-8000-000000000001', CURRENT_DATE - 2, '{"health":73,"learning":88,"relation":70,"achievement":80}'::JSONB, '주간 베스트 학습점수'),
  ('aaaaaaaa-0000-4000-8000-000000000001', CURRENT_DATE - 1, '{"health":76,"learning":86,"relation":72,"achievement":82}'::JSONB, NULL),
  ('aaaaaaaa-0000-4000-8000-000000000001', CURRENT_DATE,     '{"health":78,"learning":90,"relation":74,"achievement":84}'::JSONB, '오늘도 성장 중')
ON CONFLICT (user_id, date) DO NOTHING;

-- 스파르타 페르소나 (건강·성취 중시, 관계는 낮음)
INSERT INTO public.daily_checkin (user_id, date, input_jsonb, note)
VALUES
  ('aaaaaaaa-0000-4000-8000-000000000002', CURRENT_DATE - 6, '{"health":85,"learning":60,"relation":30,"achievement":88}'::JSONB, '3대 운동 PR 경신'),
  ('aaaaaaaa-0000-4000-8000-000000000002', CURRENT_DATE - 5, '{"health":80,"learning":65,"relation":32,"achievement":85}'::JSONB, NULL),
  ('aaaaaaaa-0000-4000-8000-000000000002', CURRENT_DATE - 4, '{"health":88,"learning":58,"relation":28,"achievement":90}'::JSONB, '체지방 측정 16.5%'),
  ('aaaaaaaa-0000-4000-8000-000000000002', CURRENT_DATE - 3, '{"health":82,"learning":70,"relation":35,"achievement":87}'::JSONB, '이력서 초안 완성'),
  ('aaaaaaaa-0000-4000-8000-000000000002', CURRENT_DATE - 2, '{"health":90,"learning":72,"relation":30,"achievement":92}'::JSONB, '주간 체력 최고치'),
  ('aaaaaaaa-0000-4000-8000-000000000002', CURRENT_DATE - 1, '{"health":87,"learning":68,"relation":33,"achievement":89}'::JSONB, NULL),
  ('aaaaaaaa-0000-4000-8000-000000000002', CURRENT_DATE,     '{"health":91,"learning":75,"relation":36,"achievement":93}'::JSONB, '목표까지 1.5%')
ON CONFLICT (user_id, date) DO NOTHING;

-- 친구 페르소나 (관계 중시, 전반적으로 소폭 성장)
INSERT INTO public.daily_checkin (user_id, date, input_jsonb, note)
VALUES
  ('aaaaaaaa-0000-4000-8000-000000000003', CURRENT_DATE - 6, '{"health":60,"learning":55,"relation":80,"achievement":58}'::JSONB, '클라이밍 첫 수업'),
  ('aaaaaaaa-0000-4000-8000-000000000003', CURRENT_DATE - 5, '{"health":62,"learning":57,"relation":82,"achievement":60}'::JSONB, NULL),
  ('aaaaaaaa-0000-4000-8000-000000000003', CURRENT_DATE - 4, '{"health":65,"learning":60,"relation":85,"achievement":63}'::JSONB, '독서모임 가입'),
  ('aaaaaaaa-0000-4000-8000-000000000003', CURRENT_DATE - 3, '{"health":63,"learning":62,"relation":88,"achievement":65}'::JSONB, '새 친구 3명'),
  ('aaaaaaaa-0000-4000-8000-000000000003', CURRENT_DATE - 2, '{"health":67,"learning":64,"relation":86,"achievement":67}'::JSONB, NULL),
  ('aaaaaaaa-0000-4000-8000-000000000003', CURRENT_DATE - 1, '{"health":68,"learning":66,"relation":90,"achievement":69}'::JSONB, '관계 점수 신기록'),
  ('aaaaaaaa-0000-4000-8000-000000000003', CURRENT_DATE,     '{"health":70,"learning":68,"relation":88,"achievement":70}'::JSONB, '즐거운 하루')
ON CONFLICT (user_id, date) DO NOTHING;

-- ---------------------------------------------------------------------------
-- 5. score_snapshot — 7일치 (결정론적 균등 가중치 적용)
-- ---------------------------------------------------------------------------

-- 멘토 김성장 스냅샷 (커스텀 가중치 0.30/0.30/0.20/0.20 적용)
INSERT INTO public.score_snapshot (user_id, date, health, learning, relation, achievement, total, delta_from_yesterday, formula_version)
VALUES
  ('aaaaaaaa-0000-4000-8000-000000000001', CURRENT_DATE-6, 70, 80, 60, 72, 71.40, NULL,  'v1'),
  ('aaaaaaaa-0000-4000-8000-000000000001', CURRENT_DATE-5, 72, 78, 65, 70, 72.00, 0.60,  'v1'),
  ('aaaaaaaa-0000-4000-8000-000000000001', CURRENT_DATE-4, 68, 85, 62, 75, 74.50, 2.50,  'v1'),
  ('aaaaaaaa-0000-4000-8000-000000000001', CURRENT_DATE-3, 75, 82, 68, 78, 76.70, 2.20,  'v1'),
  ('aaaaaaaa-0000-4000-8000-000000000001', CURRENT_DATE-2, 73, 88, 70, 80, 78.40, 1.70,  'v1'),
  ('aaaaaaaa-0000-4000-8000-000000000001', CURRENT_DATE-1, 76, 86, 72, 82, 79.20, 0.80,  'v1'),
  ('aaaaaaaa-0000-4000-8000-000000000001', CURRENT_DATE,   78, 90, 74, 84, 81.00, 1.80,  'v1')
ON CONFLICT (user_id, date) DO NOTHING;

-- 스파르타 박도전 스냅샷 (가중치 0.40/0.20/0.10/0.30)
INSERT INTO public.score_snapshot (user_id, date, health, learning, relation, achievement, total, delta_from_yesterday, formula_version)
VALUES
  ('aaaaaaaa-0000-4000-8000-000000000002', CURRENT_DATE-6, 85, 60, 30, 88, 73.40, NULL,  'v1'),
  ('aaaaaaaa-0000-4000-8000-000000000002', CURRENT_DATE-5, 80, 65, 32, 85, 71.70, -1.70, 'v1'),
  ('aaaaaaaa-0000-4000-8000-000000000002', CURRENT_DATE-4, 88, 58, 28, 90, 76.00, 4.30,  'v1'),
  ('aaaaaaaa-0000-4000-8000-000000000002', CURRENT_DATE-3, 82, 70, 35, 87, 75.00, -1.00, 'v1'),
  ('aaaaaaaa-0000-4000-8000-000000000002', CURRENT_DATE-2, 90, 72, 30, 92, 79.80, 4.80,  'v1'),
  ('aaaaaaaa-0000-4000-8000-000000000002', CURRENT_DATE-1, 87, 68, 33, 89, 77.60, -2.20, 'v1'),
  ('aaaaaaaa-0000-4000-8000-000000000002', CURRENT_DATE,   91, 75, 36, 93, 81.10, 3.50,  'v1')
ON CONFLICT (user_id, date) DO NOTHING;

-- 친구 이친구 스냅샷 (가중치 0.20/0.20/0.40/0.20)
INSERT INTO public.score_snapshot (user_id, date, health, learning, relation, achievement, total, delta_from_yesterday, formula_version)
VALUES
  ('aaaaaaaa-0000-4000-8000-000000000003', CURRENT_DATE-6, 60, 55, 80, 58, 65.60, NULL,  'v1'),
  ('aaaaaaaa-0000-4000-8000-000000000003', CURRENT_DATE-5, 62, 57, 82, 60, 67.20, 1.60,  'v1'),
  ('aaaaaaaa-0000-4000-8000-000000000003', CURRENT_DATE-4, 65, 60, 85, 63, 69.60, 2.40,  'v1'),
  ('aaaaaaaa-0000-4000-8000-000000000003', CURRENT_DATE-3, 63, 62, 88, 65, 71.40, 1.80,  'v1'),
  ('aaaaaaaa-0000-4000-8000-000000000003', CURRENT_DATE-2, 67, 64, 86, 67, 72.00, 0.60,  'v1'),
  ('aaaaaaaa-0000-4000-8000-000000000003', CURRENT_DATE-1, 68, 66, 90, 69, 74.20, 2.20,  'v1'),
  ('aaaaaaaa-0000-4000-8000-000000000003', CURRENT_DATE,   70, 68, 88, 70, 74.40, 0.20,  'v1')
ON CONFLICT (user_id, date) DO NOTHING;

-- ---------------------------------------------------------------------------
-- 6. mission (오늘의 미션 + 마일스톤 샘플)
-- ---------------------------------------------------------------------------
INSERT INTO public.mission (user_id, kind, title, body, due_date, status, source, goal_id)
VALUES
  -- 멘토 — 오늘 미션
  ('aaaaaaaa-0000-4000-8000-000000000001', 'daily',
   '영어 팟캐스트 30분 청취',
   '어제 학습 점수가 높았어요! 오늘은 듣기 실력을 한 단계 더 올려봐요.',
   CURRENT_DATE, 'pending', 'ai', 'bbbbbbbb-0000-4000-8000-000000000001'),

  -- 멘토 — 마일스톤
  ('aaaaaaaa-0000-4000-8000-000000000001', 'milestone',
   '4주차 일상 주제 스피킹 연습',
   '5분 이상 영어로 오늘 하루를 설명해보세요.',
   CURRENT_DATE + 7, 'pending', 'ai', 'bbbbbbbb-0000-4000-8000-000000000001'),

  -- 스파르타 — 오늘 미션
  ('aaaaaaaa-0000-4000-8000-000000000002', 'daily',
   '인터벌 러닝 20분 + 식단 기록',
   '체지방 목표까지 1.5%! 오늘도 포기 없이.',
   CURRENT_DATE, 'pending', 'ai', 'bbbbbbbb-0000-4000-8000-000000000002'),

  -- 친구 — 오늘 미션 (완료된 것)
  ('aaaaaaaa-0000-4000-8000-000000000003', 'daily',
   '독서모임 친구에게 책 추천 메시지 보내기',
   '관계를 따뜻하게 유지하는 작은 행동이 큰 차이를 만들어요.',
   CURRENT_DATE, 'done', 'ai', 'bbbbbbbb-0000-4000-8000-000000000003')
ON CONFLICT DO NOTHING;

-- ---------------------------------------------------------------------------
-- 7. coach_chat (샘플 대화 — service_role 삽입 시뮬레이션)
-- ---------------------------------------------------------------------------
INSERT INTO public.coach_chat (user_id, session_id, role, content, persona, tokens_in, tokens_out, cost_krw, model)
VALUES
  -- 멘토 김성장 대화
  ('aaaaaaaa-0000-4000-8000-000000000001',
   'cccccccc-0000-4000-8000-000000000001',
   'user',
   '오늘 영어 공부가 잘 안 되는데 어떻게 하면 좋을까요?',
   'mentor', 18, 0, 0, 'claude-sonnet'),

  ('aaaaaaaa-0000-4000-8000-000000000001',
   'cccccccc-0000-4000-8000-000000000001',
   'assistant',
   '오늘 학습 점수가 어제보다 4점 올랐어요. 이미 성장하고 있는 거 알고 있나요? 완벽한 날을 기다리지 말고, 10분만 단어 복습부터 시작해봐요. 시작이 반이에요.',
   'mentor', 18, 68, 0.0034, 'claude-sonnet'),

  -- 스파르타 박도전 대화
  ('aaaaaaaa-0000-4000-8000-000000000002',
   'cccccccc-0000-4000-8000-000000000002',
   'user',
   '오늘 운동 빠지고 싶은데 봐줄게요?',
   'spartan', 14, 0, 0, 'claude-sonnet'),

  ('aaaaaaaa-0000-4000-8000-000000000002',
   'cccccccc-0000-4000-8000-000000000002',
   'assistant',
   '안 봐줘요. 체지방 15% 목표, 본인이 세운 겁니다. 15분이라도 하세요.',
   'spartan', 14, 28, 0.0014, 'claude-sonnet')
ON CONFLICT DO NOTHING;

-- ---------------------------------------------------------------------------
-- 완료 확인 쿼리
-- ---------------------------------------------------------------------------
-- SELECT 'users' AS t, COUNT(*) FROM public.users
-- UNION ALL SELECT 'daily_checkin', COUNT(*) FROM public.daily_checkin
-- UNION ALL SELECT 'score_snapshot', COUNT(*) FROM public.score_snapshot
-- UNION ALL SELECT 'mission', COUNT(*) FROM public.mission
-- UNION ALL SELECT 'goal', COUNT(*) FROM public.goal
-- UNION ALL SELECT 'subscription', COUNT(*) FROM public.subscription
-- UNION ALL SELECT 'coach_chat', COUNT(*) FROM public.coach_chat;
