-- =============================================================================
-- 모이라(Moira) — 개발용 시드 데이터
-- mock.ts 서울 4인 시나리오: 강남·노원·사당·홍대 → 을지로3가
-- 실행 전제: 001_moira_initial.sql + 002_moira_indexes.sql 적용 완료
-- ON CONFLICT DO NOTHING — 재실행 안전
-- =============================================================================

-- 고정 UUID (재실행 시 동일 ID 유지)
DO $$
DECLARE
  v_meetup_id   UUID := '00000001-0000-0000-0000-000000000001'::UUID;
  v_member_me   UUID := '00000002-0000-0000-0000-000000000001'::UUID;
  v_member_sy   UUID := '00000002-0000-0000-0000-000000000002'::UUID;
  v_member_jh   UUID := '00000002-0000-0000-0000-000000000003'::UUID;
  v_member_yr   UUID := '00000002-0000-0000-0000-000000000004'::UUID;

  v_cand_nogari  UUID := '00000003-0000-0000-0000-000000000001'::UUID;
  v_cand_gwang   UUID := '00000003-0000-0000-0000-000000000002'::UUID;
  v_cand_ddp     UUID := '00000003-0000-0000-0000-000000000003'::UUID;
  v_cand_myeong  UUID := '00000003-0000-0000-0000-000000000004'::UUID;
  v_cand_motif   UUID := '00000003-0000-0000-0000-000000000005'::UUID;

  -- 토큰 해시: moira_hash_token('dev-host-token-minho') 등의 결과값 사용
  -- 개발 환경이므로 고정 해시 문자열 사용 (64자 hex)
  v_host_hash    TEXT := 'a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2';
  v_sy_hash      TEXT := 'b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3';
  v_jh_hash      TEXT := 'c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4';
  v_yr_hash      TEXT := 'd4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5';
BEGIN

-- ---------------------------------------------------------------------------
-- 1. meetup
-- ---------------------------------------------------------------------------
INSERT INTO public.moira_meetups (
  id, host_token_hash, title, status,
  recommended_station_name, recommended_station_lines, recommended_station_reason,
  confirmed_candidate_id,
  appointment_date, appointment_time, appointment_address,
  expires_at
) VALUES (
  v_meetup_id,
  v_host_hash,
  '6월 을지로 번개',
  'confirmed',
  '을지로3가',
  ARRAY['2','3'],
  '네 명 모두에게 가장 공평한 중간 지점',
  v_cand_nogari,
  '2026-06-14',
  '오후 7:00',
  '서울 중구 을지로13길 일대',
  NOW() + INTERVAL '7 days'
) ON CONFLICT DO NOTHING;

-- ---------------------------------------------------------------------------
-- 2. members (민호·서연·지훈·예린)
-- ---------------------------------------------------------------------------
INSERT INTO public.moira_members (
  id, meetup_id, name, origin_address, origin_lat, origin_lng,
  avatar_color, status, invite_token_hash, submitted_at
) VALUES
  (v_member_me, v_meetup_id, '민호', '강남구 역삼동',    37.500720, 127.036564, '#6366F1', 'host', v_host_hash, NOW() - INTERVAL '10 minutes'),
  (v_member_sy, v_meetup_id, '서연', '노원구 상계동',    37.654280, 127.065512, '#0EA5E9', 'done', v_sy_hash,   NOW() - INTERVAL '8 minutes'),
  (v_member_jh, v_meetup_id, '지훈', '동작구 사당동',    37.476826, 126.981580, '#14B8A6', 'done', v_jh_hash,   NOW() - INTERVAL '6 minutes'),
  (v_member_yr, v_meetup_id, '예린', '마포구 동교동',    37.556590, 126.925250, '#A855F7', 'waiting', v_yr_hash, NULL)
ON CONFLICT DO NOTHING;

-- ---------------------------------------------------------------------------
-- 3. candidates (5개 후보장소)
-- ---------------------------------------------------------------------------
INSERT INTO public.moira_candidates (
  id, meetup_id, name, category, walk_min, blurb, address,
  fair_gap, fair_avg, fair_score, fair_level, fair_rank
) VALUES
  (v_cand_nogari, v_meetup_id, '을지로 노가리골목',   '호프·포차',  2, '노포 감성 야장, 4인 테이블 여유',   '서울 중구 을지로13길 일대',  6, 25, 25.4, 'good', 1),
  (v_cand_gwang,  v_meetup_id, '광장시장 먹자골목',   '전통시장',   5, '빈대떡·마약김밥, 가성비 끝판왕',   '서울 종로구 창경궁로 88',    6, 27, 27.1, 'good', 2),
  (v_cand_ddp,    v_meetup_id, 'DDP 디자인장터',      '카페·전시',  6, '전시 보고 카페, 사진 맛집',          '서울 중구 을지로 281',        5, 29, 29.6, 'good', 3),
  (v_cand_myeong, v_meetup_id, '명동 백년칼국수',     '칼국수',     8, '줄서는 노포, 진한 사골',             '서울 중구 명동',              14, 27, 31.2, 'mid',  4),
  (v_cand_motif,  v_meetup_id, '충무로 모티프원',     '북카페',     4, '조용한 책방 카페, 대화 집중',         '서울 중구 충무로2길 19',       8, 28, 29.9, 'good', 5)
ON CONFLICT DO NOTHING;

-- ---------------------------------------------------------------------------
-- 4. candidate_times (후보 × 멤버 N×K 이동시간 행렬)
-- ---------------------------------------------------------------------------

-- 을지로 노가리골목
INSERT INTO public.moira_candidate_times (candidate_id, member_id, minutes, transfers) VALUES
  (v_cand_nogari, v_member_me, 22, 0),
  (v_cand_nogari, v_member_sy, 28, 1),
  (v_cand_nogari, v_member_jh, 26, 1),
  (v_cand_nogari, v_member_yr, 24, 1)
ON CONFLICT (candidate_id, member_id) DO NOTHING;

-- 광장시장 먹자골목
INSERT INTO public.moira_candidate_times (candidate_id, member_id, minutes, transfers) VALUES
  (v_cand_gwang, v_member_me, 24, 0),
  (v_cand_gwang, v_member_sy, 30, 1),
  (v_cand_gwang, v_member_jh, 27, 1),
  (v_cand_gwang, v_member_yr, 25, 1)
ON CONFLICT (candidate_id, member_id) DO NOTHING;

-- DDP 디자인장터
INSERT INTO public.moira_candidate_times (candidate_id, member_id, minutes, transfers) VALUES
  (v_cand_ddp, v_member_me, 26, 0),
  (v_cand_ddp, v_member_sy, 28, 1),
  (v_cand_ddp, v_member_jh, 31, 1),
  (v_cand_ddp, v_member_yr, 29, 1)
ON CONFLICT (candidate_id, member_id) DO NOTHING;

-- 명동 백년칼국수
INSERT INTO public.moira_candidate_times (candidate_id, member_id, minutes, transfers) VALUES
  (v_cand_myeong, v_member_me, 20, 0),
  (v_cand_myeong, v_member_sy, 34, 2),
  (v_cand_myeong, v_member_jh, 28, 1),
  (v_cand_myeong, v_member_yr, 26, 1)
ON CONFLICT (candidate_id, member_id) DO NOTHING;

-- 충무로 모티프원
INSERT INTO public.moira_candidate_times (candidate_id, member_id, minutes, transfers) VALUES
  (v_cand_motif, v_member_me, 23, 0),
  (v_cand_motif, v_member_sy, 31, 1),
  (v_cand_motif, v_member_jh, 29, 1),
  (v_cand_motif, v_member_yr, 27, 1)
ON CONFLICT (candidate_id, member_id) DO NOTHING;

-- ---------------------------------------------------------------------------
-- 5. votes (노가리 2표 — mock.ts votes:2 반영)
-- ---------------------------------------------------------------------------
INSERT INTO public.moira_votes (meetup_id, candidate_id, voter_token_hash) VALUES
  (v_meetup_id, v_cand_nogari, v_host_hash),
  (v_meetup_id, v_cand_nogari, v_sy_hash)
ON CONFLICT (meetup_id, voter_token_hash) DO NOTHING;

END;
$$;
