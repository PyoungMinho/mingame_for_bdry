-- ============================================================
-- 툰일기 시드 데이터
-- 화풍/아바타는 코드 상수(constants.ts)가 진실의 소스.
-- DB 시드는 최소화 — 개발/테스트용 샘플 유저만.
--
-- 실행 방법:
--   supabase db reset  (마이그레이션 + 시드 함께 실행)
--   또는 supabase db push --include-seed
--
-- ⚠️ 프로덕션에서는 절대 실행 금지.
-- ============================================================

-- 개발용 테스트 유저 (auth.users 에 직접 삽입은 Supabase 제약상 불가)
-- 실제 시드는 supabase/tests/seed_helpers.ts 에서 createUser() 사용.
-- 여기서는 초기 quota_usage 참조 데이터와 beta_earlybird 플래그 예시만 포함.

-- 화풍 메타는 코드 ART_STYLES 배열이 SSOT → DB 테이블 불필요
-- 아바타 프리셋도 코드 AVATAR_HAIR_COLORS/TOP_STYLES/ACCESSORIES 가 SSOT

-- 빈 시드 (최소화 원칙)
-- 필요 시 개발팀이 직접 추가.
SELECT 'toonlog seed loaded — no initial data (code constants are SSOT)' AS info;
