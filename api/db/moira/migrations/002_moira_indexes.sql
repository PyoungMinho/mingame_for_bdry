-- =============================================================================
-- 모이라(Moira) — 002 Indexes & Constraints
-- 001_moira_initial.sql 실행 후 적용
-- idempotent: CREATE INDEX IF NOT EXISTS
-- =============================================================================

-- ---------------------------------------------------------------------------
-- moira_meetups 인덱스
-- ---------------------------------------------------------------------------

-- 호스트 토큰으로 meetup 조회 (PUT/DELETE 권한 검증)
-- 호스트가 자기 방 관리할 때 사용: WHERE host_token_hash = $1
CREATE UNIQUE INDEX IF NOT EXISTS idx_moira_meetups_host_token
  ON public.moira_meetups (host_token_hash)
  WHERE deleted_at IS NULL;

-- 만료 배치 잡: expires_at < NOW() AND status != 'expired'
CREATE INDEX IF NOT EXISTS idx_moira_meetups_expires_at
  ON public.moira_meetups (expires_at)
  WHERE deleted_at IS NULL AND status != 'expired';

-- status별 필터링 (관리자 대시보드, 통계)
CREATE INDEX IF NOT EXISTS idx_moira_meetups_status
  ON public.moira_meetups (status, created_at DESC)
  WHERE deleted_at IS NULL;

-- ---------------------------------------------------------------------------
-- moira_members 인덱스
-- ---------------------------------------------------------------------------

-- meetup_id로 멤버 목록 조회 (폴링 폴링링 /api/meetups/[id]/members)
CREATE INDEX IF NOT EXISTS idx_moira_members_meetup_id
  ON public.moira_members (meetup_id)
  WHERE deleted_at IS NULL;

-- 초대 토큰으로 멤버 신원 확인 (출발지 제출 / 투표 권한 검증)
-- WHERE meetup_id = $1 AND invite_token_hash = $2
CREATE INDEX IF NOT EXISTS idx_moira_members_meetup_token
  ON public.moira_members (meetup_id, invite_token_hash)
  WHERE deleted_at IS NULL;

-- status=waiting 멤버 수 집계 (모든 멤버 제출 완료 감지)
CREATE INDEX IF NOT EXISTS idx_moira_members_meetup_status
  ON public.moira_members (meetup_id, status)
  WHERE deleted_at IS NULL;

-- ---------------------------------------------------------------------------
-- moira_candidates 인덱스
-- ---------------------------------------------------------------------------

-- meetup별 후보 목록 조회 (결과/투표 화면)
CREATE INDEX IF NOT EXISTS idx_moira_candidates_meetup_id
  ON public.moira_candidates (meetup_id, fair_rank ASC NULLS LAST)
  WHERE deleted_at IS NULL;

-- ---------------------------------------------------------------------------
-- moira_candidate_times 인덱스
-- ---------------------------------------------------------------------------

-- 특정 candidate의 모든 멤버 times 조회 (결과 화면 렌더링)
-- JOIN moira_members ON member_id 와 함께 사용
CREATE INDEX IF NOT EXISTS idx_moira_candidate_times_candidate
  ON public.moira_candidate_times (candidate_id);

-- 특정 멤버의 모든 candidate times 조회 (fair_score 재계산 트리거 시)
CREATE INDEX IF NOT EXISTS idx_moira_candidate_times_member
  ON public.moira_candidate_times (member_id);

-- ---------------------------------------------------------------------------
-- moira_votes 인덱스
-- ---------------------------------------------------------------------------

-- 실시간 득표 집계: GROUP BY candidate_id WHERE meetup_id = $1
-- COUNT(*) 폴링 쿼리 최적화 (Redis 카운터가 캐시 역할, Postgres가 SoT)
CREATE INDEX IF NOT EXISTS idx_moira_votes_meetup_candidate
  ON public.moira_votes (meetup_id, candidate_id);

-- voter_token 중복 검사 (UNIQUE 제약 보조, 선택)
CREATE INDEX IF NOT EXISTS idx_moira_votes_meetup_voter
  ON public.moira_votes (meetup_id, voter_token_hash);
