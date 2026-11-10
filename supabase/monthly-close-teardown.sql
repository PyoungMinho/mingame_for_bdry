-- 월마감(/monthly-close) — 제거 스크립트 (mc_ 객체만 지운다)
--
-- 실행 방법 (PM): Supabase 대시보드 → SQL Editor → 이 파일 전체를 붙여 넣고 Run.
-- 쓰는 때: 월마감을 접을 때 / 스키마를 처음부터 다시 만들고 싶을 때(그 뒤 monthly-close-schema.sql 재실행).
--
-- !! 경고 !!  mc_rooms / mc_players / mc_matches / mc_events 안의 모든 데이터가 영구 삭제된다.
--            게이트 판정 전이라면 먼저 monthly-close-gate.sql 결과를 docs/planning/monthly-close/ 에 저장할 것.
--            같은 프로젝트의 다른 서비스 테이블은 건드리지 않는다(여기에는 mc_ 이름만 있다).
--            CASCADE를 쓰지 않으므로 mc_ 밖의 객체가 이 테이블에 기대고 있으면 오류로 멈추고, 아무것도 지워지지 않는다.

begin;

-- 자식 → 부모 순서 (mc_players가 mc_rooms를 참조). 인덱스·제약·시퀀스(mc_events_id_seq)는 테이블과 함께 사라진다.
drop table if exists public.mc_players;
drop table if exists public.mc_matches;
drop table if exists public.mc_events;
drop table if exists public.mc_rooms;

commit;

-- ── 확인용 SELECT: remaining_mc_tables = 0 이면 성공 ──
select count(*) as remaining_mc_tables
from pg_tables
where schemaname = 'public' and tablename like 'mc\_%' escape '\';
