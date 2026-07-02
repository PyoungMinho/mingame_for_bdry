-- 오후의 패 — Supabase 스키마 + RLS (멱등: 재실행 안전)
-- 사용법: Supabase 대시보드 → SQL Editor에 전체 붙여넣어 실행.
-- 사전: Authentication → Providers → "Anonymous" 활성화 (무가입 익명 인증).

-- ── 기존 테이블 정리 (개발 초기 — 데이터 없음) ──
drop table if exists public.hands        cascade;
drop table if exists public.room_players cascade;
drop table if exists public.rooms        cascade;

-- ── 방 (공개 상태: 손패 제외) ──
create table public.rooms (
  code         text primary key,                       -- 5자리 방코드
  status       text not null default 'waiting',        -- waiting | playing | ended
  host_uid     uuid,
  public_state jsonb,                                  -- turn, lead, winner, phase, players, handCounts, scores
  updated_at   timestamptz default now()
);

-- ── 참가자 ──
create table public.room_players (
  room_code text not null references public.rooms(code) on delete cascade,
  uid       uuid not null,                             -- 익명 auth uid
  name      text not null,
  seat      int,
  joined_at timestamptz default now(),
  primary key (room_code, uid)
);

-- 같은 방에서 seat 중복 금지 (B-5). 재정렬/딜 시 seat 충돌 방지.
alter table public.room_players add constraint uq_seat unique (room_code, seat);

-- ── 손패 (RLS로 본인만 열람) ──
create table public.hands (
  room_code text not null references public.rooms(code) on delete cascade,
  uid       uuid not null,
  tiles     jsonb not null default '[]'::jsonb,
  primary key (room_code, uid)
);

-- ── RLS ──
alter table public.rooms        enable row level security;
alter table public.room_players enable row level security;
alter table public.hands        enable row level security;

drop policy if exists "rooms_read"      on public.rooms;
drop policy if exists "players_read"    on public.room_players;
drop policy if exists "hands_self_read" on public.hands;

-- 방·참가자: 누구나 읽기 (공개 정보, 손패 없음)
create policy "rooms_read"   on public.rooms        for select using (true);
create policy "players_read" on public.room_players for select using (true);

-- 손패: 오직 본인 행만 읽기 (← 치팅 방지의 핵심)
create policy "hands_self_read" on public.hands for select using (auth.uid() = uid);

-- 쓰기 정책 없음 → anon 클라이언트는 INSERT/UPDATE 불가.
-- 모든 상태 변이는 service_role 키를 쓰는 Next API route에서만 (RLS 우회).

-- ── Realtime 발행 ──
alter publication supabase_realtime add table public.rooms;
alter publication supabase_realtime add table public.room_players;
alter publication supabase_realtime add table public.hands;
