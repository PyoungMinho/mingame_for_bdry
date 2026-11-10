-- 월마감(/monthly-close) — Supabase 스키마 (멱등: 여러 번 실행해도 안전, drop 없음)
--
-- ┌─ 실행 방법 (PM, 1회) ──────────────────────────────────────────────────────┐
-- │ 1. Supabase 대시보드 → SQL Editor → New query                              │
-- │ 2. 이 파일 전체를 붙여 넣고 Run                                              │
-- │ 3. 마지막에 표 4줄이 나온다. 각 줄이 rls_on = true, policies = 0,            │
-- │    anon_has_any_privilege = false, authenticated_has_any_privilege = false,  │
-- │    in_realtime_publication = false 이면 성공이다.                            │
-- │ 4. 실패하면 아무것도 바뀌지 않는다(전체가 한 트랜잭션). 오류 문구를 알려 줄 것. │
-- └──────────────────────────────────────────────────────────────────────────┘
--
-- !! 경고 !!  pae-schema.sql 은 절대 다시 실행하지 말 것.
--            그 파일은 맨 위에서 기존 테이블을 지우고 새로 만든다. 같은 프로젝트에서 운영 중인
--            /pae 데이터가 사라진다. 이 파일은 mc_ 로 시작하는 객체만 만들고 다른 것은 건드리지 않는다.
--
-- 설계 요약
--  · 테이블 4개: mc_rooms(방+비밀 상태) / mc_players(자리 2개) / mc_matches(판 요약, 90일) / mc_events(지표 사건, 90일)
--  · RLS 켬 + 정책 0개 + anon·authenticated 권한 회수 = 브라우저의 공개 키로는 읽기·쓰기 전부 거부(이중 잠금).
--    서버(Vercel 함수)만 service_role 키로 접근한다(RLS 우회).
--  · Realtime 발행 목록에 넣지 않는다(초인종은 Broadcast라 테이블이 필요 없음).
--  · 게임 규칙·함수·트리거 없음. 동시성은 mc_rooms.version 비교 저장(UPDATE … WHERE version = ?)으로만 처리.
--  · 개인정보 최소화: IP·User-Agent·쿠키를 저장하는 칸이 없다. 닉네임은 mc_players에만 있고 방이 지워지면 함께 사라진다.
--    매치·이벤트에는 닉네임이 없고, 사람은 비밀키의 SHA-256 해시(player_key)로만 구분한다.
--  · 상태값(status, view_state, type, end_reason)은 앱에서 관리하므로 DB 열거형·CHECK를 두지 않는다.
--  · 방(mc_rooms)·자리(mc_players)는 개인정보 때문에 실제로 지운다(deleted_at 없음). mc_events는 추가 전용이라 updated_at이 없다.

begin;

-- ── 방: 공개 상태 + 비밀 상태(state)를 한 덩어리로. 브라우저는 이 행을 직접 읽지 못한다 ──
create table if not exists public.mc_rooms (
  id          uuid        primary key default gen_random_uuid(),
  code        text        not null,                       -- 5자리 숫자 방 번호(10000~99999)
  status      text        not null default 'waiting',     -- waiting | placing | playing | ended (앱에서 관리)
  version     integer     not null default 0,             -- 비교 저장용. 저장할 때마다 +1
  state       jsonb       not null,                       -- 엔진 상태(공개 + secret). 절대 브라우저에 그대로 내보내지 않음
  settings    jsonb       not null default '{}'::jsonb,   -- 방 설정(경보 등)
  env         text        not null default 'production',  -- production | preview | development (VERCEL_ENV)
  is_test     boolean     not null default false,         -- 테스트 표시가 붙은 방(지표 제외)
  expires_at  timestamptz not null,                       -- 활동할 때마다 +30분. 지나면 다음 정리 때 삭제
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  constraint mc_rooms_code_format check (code ~ '^[1-9][0-9]{4}$'),
  constraint mc_rooms_version_nonneg check (version >= 0)
);

-- 방 번호는 전체에서 하나(만료됐지만 아직 안 지워진 방은 서버가 같은 번호로 새로 만들 때 먼저 지운다)
create unique index if not exists mc_rooms_code_uq on public.mc_rooms (code);
create index if not exists mc_rooms_expires_at_idx on public.mc_rooms (expires_at);

-- ── 자리: 방마다 최대 2명. 방이 지워지면 함께 지워진다 ──
create table if not exists public.mc_players (
  id            uuid        primary key default gen_random_uuid(),
  room_id       uuid        not null references public.mc_rooms (id) on delete cascade,
  seat          smallint    not null,                      -- 0 | 1
  player_key    text        not null,                      -- 비밀키의 SHA-256 소문자 hex(64자). 원본 키는 저장하지 않음
  nickname      text        not null,                      -- 1~8자. 매치·이벤트에는 복사하지 않음
  industry      smallint    not null,                      -- 업종 번호 0~2
  last_seen     timestamptz not null default now(),        -- 접속 신호(version을 올리지 않음)
  view_state    text        not null default 'game',       -- game | disguise (앱에서 관리)
  view_state_at timestamptz not null default now(),        -- view_state가 마지막으로 바뀐 시각(시계 정지 소급 기준)
  created_at    timestamptz not null default now(),        -- = 입장 시각
  updated_at    timestamptz not null default now(),
  constraint mc_players_seat_range check (seat in (0, 1)),
  constraint mc_players_industry_range check (industry between 0 and 2),
  constraint mc_players_nickname_len check (char_length(nickname) between 1 and 8),
  constraint mc_players_key_format check (player_key ~ '^[0-9a-f]{64}$')
);

-- 자리 하나에 한 명 / 같은 브라우저(비밀키)가 두 자리를 차지하지 못함.
-- 이름에 room_seat / room_key가 들어 있어야 한다(서버가 위반 원인을 이름으로 구분함).
create unique index if not exists mc_players_room_seat_uq on public.mc_players (room_id, seat);
create unique index if not exists mc_players_room_key_uq on public.mc_players (room_id, player_key);

-- ── 판 요약: 방이 지워져도 남도록 외래키 없음. 90일 보관 ──
create table if not exists public.mc_matches (
  id            uuid        primary key default gen_random_uuid(),   -- 서버가 만든 UUID(상태의 matchId와 같음)
  room_id       uuid        not null,                               -- 외래키 없음(방이 지워져도 판 기록은 남음)
  seq           integer     not null,                               -- 판 순번. 1 = 첫 판
  rematch_of    uuid,                                               -- 직전 판 id
  host_key      text        not null,                               -- 방장의 player_key(해시)
  player_keys   text[]      not null,                               -- 두 사람의 player_key(해시), 자리 순서
  started_at    timestamptz not null,
  ended_at      timestamptz,                                        -- 비어 있고 1시간 지났으면 "중도 이탈"로 본다
  end_reason    text,                                               -- sunk2 | draw | cap | resign | absent
  winner_seat   smallint,                                           -- 0 | 1 | null
  rounds        integer,
  hints         jsonb,                                              -- [자리0 개수, 자리1 개수]
  quizzes       jsonb,                                              -- 출제·풀이·경과 ms 요약
  alarm_on      boolean     not null default false,
  alarm_outcome jsonb,                                              -- [pass|fail|excluded|null, …]
  env           text        not null default 'production',
  is_test       boolean     not null default false,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  constraint mc_matches_player_keys_len check (cardinality(player_keys) = 2),
  constraint mc_matches_seq_positive check (seq >= 1),
  constraint mc_matches_winner_range check (winner_seat is null or winner_seat in (0, 1))
);

-- 같은 방의 같은 순번은 하나(재시도로 다른 id가 들어오는 버그를 막음)
create unique index if not exists mc_matches_room_seq_uq on public.mc_matches (room_id, seq);
create index if not exists mc_matches_started_at_idx on public.mc_matches (started_at);

-- ── 지표 사건: 추가 전용. 90일 보관. 닉네임·IP·UA 없음 ──
create table if not exists public.mc_events (
  id         bigint      generated always as identity primary key,
  at         timestamptz not null default now(),        -- 사건 시각(= 생성 시각)
  type       text        not null,                      -- room_created | room_joined | match_started | match_ended |
                                                        -- rematch_requested | feedback | line_report | lines_shown | share_copied | transport
  room_id    uuid,                                      -- 외래키 없음
  match_id   uuid,
  player_key text,                                      -- SHA-256 hex 또는 null
  props      jsonb       not null default '{}'::jsonb,  -- 작은 JSON, 서버가 허용한 키만
  dedupe_key text,                                      -- 같은 값은 한 번만 기록(feedback은 매치·사람당 1건 등). null은 중복 허용
  env        text        not null default 'production',
  is_test    boolean     not null default false,
  constraint mc_events_player_key_format check (player_key is null or player_key ~ '^[0-9a-f]{64}$')
);

create unique index if not exists mc_events_dedupe_key_uq on public.mc_events (dedupe_key);
create index if not exists mc_events_type_at_idx on public.mc_events (type, at);
create index if not exists mc_events_player_key_idx on public.mc_events (player_key);
create index if not exists mc_events_room_id_idx on public.mc_events (room_id);

-- ── 잠금: RLS 켬 + 정책 0개 + 공개 역할 권한 회수 ──
alter table public.mc_rooms   enable row level security;
alter table public.mc_players enable row level security;
alter table public.mc_matches enable row level security;
alter table public.mc_events  enable row level security;
-- 정책을 하나도 만들지 않는다 = anon·authenticated는 select/insert/update/delete 전부 거부.

revoke all on table public.mc_rooms   from anon, authenticated;
revoke all on table public.mc_players from anon, authenticated;
revoke all on table public.mc_matches from anon, authenticated;
revoke all on table public.mc_events  from anon, authenticated;
revoke all on sequence public.mc_events_id_seq from anon, authenticated;

-- 서버 키(service_role)는 RLS를 우회하며, 표 권한은 아래로 명시한다(이미 있어도 무해)
grant all on table public.mc_rooms   to service_role;
grant all on table public.mc_players to service_role;
grant all on table public.mc_matches to service_role;
grant all on table public.mc_events  to service_role;
grant all on sequence public.mc_events_id_seq to service_role;

commit;

-- ── 확인용 SELECT (표 4줄) ──
-- 기대값: table_exists = true, rls_on = true, policies = 0,
--         anon_has_any_privilege = false, authenticated_has_any_privilege = false, in_realtime_publication = false
select
  t.name                                                            as table_name,
  c.oid is not null                                                 as table_exists,
  coalesce(c.relrowsecurity, false)                                 as rls_on,
  (select count(*) from pg_policies p
     where p.schemaname = 'public' and p.tablename = t.name)        as policies,
  coalesce(has_table_privilege('anon', c.oid,
           'select,insert,update,delete,truncate,references,trigger'), false)          as anon_has_any_privilege,
  coalesce(has_table_privilege('authenticated', c.oid,
           'select,insert,update,delete,truncate,references,trigger'), false)          as authenticated_has_any_privilege,
  exists (select 1 from pg_publication_tables pt
            where pt.pubname = 'supabase_realtime' and pt.schemaname = 'public' and pt.tablename = t.name) as in_realtime_publication
from (values ('mc_rooms'), ('mc_players'), ('mc_matches'), ('mc_events')) as t(name)
left join pg_class c
  on c.relname = t.name and c.relnamespace = 'public'::regnamespace and c.relkind = 'r'
order by t.name;
