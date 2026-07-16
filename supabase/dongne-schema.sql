-- 동네고수 — DAU 게이트 스키마 (멱등: 재실행 안전)
-- 사용법: Supabase 대시보드 → SQL Editor에 전체 붙여넣어 실행 (PM 1회 수동 실행 전제).
-- 이미 다른 서비스(오후의 패)가 같은 Supabase 프로젝트를 쓰고 있다 — 이 파일은 그 프로젝트에
-- dongne_dau 테이블 1개만 "추가"한다. 기존 rooms/room_players/hands 테이블은 건드리지 않는다.
--
-- 설계 원칙(방향서 §2·§5-1 DAU 게이트 진실 소스 = anon_id distinct count):
--   게이트는 "직전 7일 평균 DAU(순 방문자) ≥ 500"이다(기획서 §6). 그 "순 방문자"를 정확히 세려면
--   방문자별 구분자(anon_id)가 반드시 있어야 한다 → 이 테이블은 (KST날짜, anon_id) 한 쌍을 저장한다.
--   anon_id = 클라이언트가 localStorage에 1회 발급하는 무작위 UUID(예: crypto.randomUUID()).
--     · 개인정보 아님: IP·User-Agent·쿠키·계정·기기지문 그 어떤 것도 저장/연결하지 않는다.
--     · 특정 개인을 식별할 수 없는 익명 난수 토큰(Wordle·프라이버시 친화 애널리틱스와 동일 개념).
--   즉 "누가(실명)"는 전혀 모르되 "서로 다른 방문자 몇 명인지"만 셀 수 있는 최소 설계다.
--   중복 집계 방지 2중: (1)클라 localStorage 플래그 `dongne:ping:{YYYYMMDD}`로 하루 1회만 POST,
--   (2)서버 PK(day_kst, anon_id) + on-conflict-do-nothing → 재전송/더블파이어도 하루 1인 1행으로 수렴.

-- ── DAU 원천 (KST 날짜 × 익명 방문자) ──
create table if not exists public.dongne_dau (
  day_kst    date        not null,   -- KST 캘린더 날짜. 서버가 UTC+9 산술로 스탬프(src/lib/dongne/queue.ts 재사용, 클라 날짜 미신뢰)
  anon_id    text        not null,   -- 클라 발급 무작위 UUID. 개인정보 아님(IP/UA/쿠키/계정 미연결)
  created_at timestamptz not null default now(),
  primary key (day_kst, anon_id),    -- 하루 1인 1행 강제 → count(distinct anon_id) == count(*)
  constraint dongne_dau_anon_id_len check (char_length(anon_id) between 8 and 64)  -- 쓰레기값 폭주 방어(UUIDv4=36자)
);

comment on table public.dongne_dau is '동네고수 DAU 게이트 원천. (KST날짜, 익명 anon_id) 쌍. IP/개인정보 컬럼 없음.';
comment on column public.dongne_dau.day_kst is 'KST(UTC+9) 캘린더 날짜. src/lib/dongne/queue.ts 산술과 동일 소스에서 서버가 계산.';
comment on column public.dongne_dau.anon_id is '클라 localStorage 무작위 UUID. 개인 식별 불가 익명 토큰(IP/UA/쿠키/계정 미저장·미연결).';

-- ── RLS: anon/authenticated는 테이블 접근 전부 불가. service_role(API route)만 가능 ──
alter table public.dongne_dau enable row level security;
-- 정책을 하나도 만들지 않는다 = anon/authenticated는 select/insert/update/delete 전부 거부(default deny).
-- service_role 키는 RLS를 우회하므로 API route(getSupabaseAdmin)는 정상 동작한다. (pae-schema.sql 선례와 동일 패턴)
-- 테이블 쓰기 권한은 Supabase 기본 권한(default privileges)이 service_role에 부여 → pae와 동일하게 별도 grant 불필요.

-- ============================================================================
-- 게이트 판정 쿼리 — 직전 7일(완결일) 평균 DAU(순 방문자)
-- ============================================================================
-- PM이 필요할 때마다(런칭 30일 시점 등) 아래 SELECT만 다시 실행하면 된다. (위 DDL은 최초 1회만)
--
-- "완결일"이란: 아직 집계가 끝나지 않은 오늘(진행 중인 KST 날짜)을 평균에서 제외한다는 뜻이다.
-- Postgres current_date는 서버 세션 타임존(보통 UTC) 기준이라 KST와 어긋날 수 있어 쓰지 않는다 —
-- 대신 테이블에 이미 저장된 day_kst 값들 중 "가장 최근 날짜"를 진행 중인 날로 간주하고 그 이전 7일만 쓴다.
with latest as (
  select max(day_kst) as latest_day_kst from public.dongne_dau
),
daily_dau as (                                    -- 날짜별 순 방문자 수(= 그 날 distinct anon_id 수 = 그 날 행 수)
  select d.day_kst, count(*) as dau
  from public.dongne_dau d, latest
  where d.day_kst < latest.latest_day_kst          -- 가장 최근(=오늘, 진행 중일 가능성) 제외
  group by d.day_kst
),
recent_7_complete_days as (
  select day_kst, dau
  from daily_dau
  order by day_kst desc
  limit 7
)
select
  count(*)                    as days_counted,     -- 7 미만이면 아직 완결일이 7일치 안 쌓인 것(게이트 시점엔 항상 7)
  round(avg(dau), 1)          as avg_dau_last_7d,   -- 이 값이 게이트 숫자(직전 7일 평균 순 방문자)
  round(avg(dau), 1) >= 500   as gate_pass          -- 방향서 §0/§6 킬 스위치: 직전 7일 평균 DAU ≥ 500
from recent_7_complete_days;

-- 참고용 — 일자별 DAU 추이 확인 (최근 30일):
-- select day_kst, count(*) as dau
-- from public.dongne_dau
-- group by day_kst order by day_kst desc limit 30;
