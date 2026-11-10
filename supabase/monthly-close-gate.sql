-- 월마감(/monthly-close) — 14일 게이트 지표 조회 (읽기 전용: SELECT만, 데이터를 바꾸지 않는다)
--
-- 실행 방법 (PM): Supabase 대시보드 → SQL Editor.
--   1) 아래 [설정] 한 줄의 seeding_start(시딩 시작 시각, 한국 시간)를 실제 값으로 고친다.
--   2) 질의가 4개다. 편집기는 선택한 부분만 실행하므로 질의 하나씩 선택해서 Run 한다.
--      질의 1 = 게이트 요약표 / 질의 2 = 문구별 신고율 / 질의 3 = 기록 건수 점검 / 질의 4 = 힌트 승률·검산 정답률
--   3) 14일째 결과 표를 캡처·복사해 docs/planning/monthly-close/ 에 저장한다(프로젝트가 멈춰도 판정 근거가 남도록).
--
-- 집계 조건 (공통): env = 'production' 이고 is_test = false, 시딩 시작부터 14일.
--   로컬·프리뷰 기록과 테스트 표시 기록은 저장은 되지만 여기서 제외된다.
-- 한계: player_key는 "사람"이 아니라 "브라우저"다. 한 사람이 PC와 휴대폰을 쓰면 2명으로 센다.
-- 기준값: 기획서 sheetbattle-plan.md 출시 후 표. 기준이 없는 행의 pass는 null.
-- 판단: Go = 볼륨 + 핵심 4개 중 3개 + 웃음 / 접기 = 완료 판 40 미만 · 입장률 30% 미만 · 웃음 40% 미만 (기획서).

-- ════════════════════════════════════════════════════════════════════════════
-- 질의 1. 게이트 요약표
-- ════════════════════════════════════════════════════════════════════════════
with params as (
  select timestamptz '2026-11-08 00:00:00+09' as seeding_start      -- [설정] 시딩 시작 시각(KST)
),
win as (
  select seeding_start as t0, seeding_start + interval '14 days' as t1 from params
),
ev as (                                     -- 창 안의 운영·비테스트 사건
  select e.* from public.mc_events e, win
  where e.env = 'production' and not e.is_test and e.at >= win.t0 and e.at < win.t1
),
mt as (                                     -- 창 안에서 시작한 운영·비테스트 판
  select m.* from public.mc_matches m, win
  where m.env = 'production' and not m.is_test and m.started_at >= win.t0 and m.started_at < win.t1
),
normal_mt as (                              -- 정상 종료(기권·부재·중도 이탈 제외)
  select * from mt where end_reason in ('sunk2', 'draw', 'cap')
),
-- 볼륨
players_started as (
  select count(distinct k) as n from mt, unnest(mt.player_keys) as k
),
-- 핵심① 입장률: 2번 자리까지 찬 방 / 만든 방
rooms_created as (
  select distinct room_id from ev where type = 'room_created' and room_id is not null
),
rooms_full as (
  select distinct room_id from ev
  where type = 'room_joined' and (props ->> 'seat') = '1' and room_id in (select room_id from rooms_created)
),
-- 핵심② 완주율: 첫 판이 정상 종료된 방 / 2명이 찬 방
rooms_first_done as (
  select distinct room_id from normal_mt where seq = 1 and room_id in (select room_id from rooms_full)
),
-- 핵심③ 재대결률: 같은 두 사람(쌍) 기준
pair_matches as (
  select id, started_at, ended_at, end_reason,
         least(player_keys[1], player_keys[2]) || ':' || greatest(player_keys[1], player_keys[2]) as pair
  from mt
),
pairs_done as (                             -- 한 판 이상 정상 종료한 쌍과 그 첫 정상 종료 시각
  select pair, min(ended_at) as first_done_at
  from pair_matches where end_reason in ('sunk2', 'draw', 'cap') and ended_at is not null
  group by pair
),
pairs_rematch as (                          -- 첫 정상 종료 후 24시간 안에 다른 판을 시작한 쌍
  select distinct d.pair
  from pairs_done d
  join pair_matches m on m.pair = d.pair
   and m.started_at > d.first_done_at
   and m.started_at <= d.first_done_at + interval '24 hours'
),
-- 핵심④ 전파 K: (완주 경험자가 연 방에 "처음 등장해서" 들어온 사람 수) / 완주한 사람 수
completers as (                             -- 완주 경험자와 첫 완주 시각
  select k as player_key, min(m.ended_at) as first_done_at
  from normal_mt m, unnest(m.player_keys) as k
  group by k
),
first_seen as (                             -- 사람별 첫 사건 시각(시딩 이전 기록까지 포함해 "처음"을 정확히 본다)
  select player_key, min(at) as first_at
  from public.mc_events
  where env = 'production' and not is_test and player_key is not null
  group by player_key
),
room_open as (                              -- 방을 연 시각
  select room_id, min(at) as opened_at from ev where type = 'room_created' and room_id is not null group by room_id
),
referred as (                               -- 2번 자리로 처음 등장해 들어온 사람, 방장이 방을 열기 전에 이미 완주한 경우만
  select distinct j.player_key
  from ev j
  join first_seen f on f.player_key = j.player_key and f.first_at = j.at
  join room_open o on o.room_id = j.room_id
  join completers c on c.player_key = (j.props ->> 'hostKey') and c.first_done_at < o.opened_at
  where j.type = 'room_joined' and (j.props ->> 'seat') = '1' and j.player_key is not null
),
-- 웃음
fb as (
  select count(*) as n, count(*) filter (where (props ->> 'laugh') in ('some', 'lol')) as pos
  from ev where type = 'feedback'
),
-- 안전장치
alarm_rate as (                             -- 1시간 이상 지난 판만(진행 중인 판이 분모를 키우지 않게)
  select alarm_on,
         count(*) as started,
         count(*) filter (where end_reason in ('sunk2', 'draw', 'cap')) as done
  from mt, win where started_at < now() - interval '1 hour'
  group by alarm_on
),
line_rates as (
  select s.line_id, s.shown, coalesce(r.reports, 0) as reports
  from (
    select l as line_id, count(*) as shown
    from ev, jsonb_array_elements_text(ev.props -> 'lineIds') as l
    where ev.type = 'lines_shown'
    group by l
  ) s
  left join (
    select props ->> 'lineId' as line_id, count(*) as reports from ev where type = 'line_report' group by 1
  ) r on r.line_id = s.line_id
),
transport as (
  select count(*) as n, count(*) filter (where (props ->> 'bell') = 'false') as bell_fail
  from ev where type = 'transport'
)
select * from (
  select 10 as ord, '볼륨: 정상 종료된 판'::text as metric,
         (select count(*) from normal_mt)::numeric as value,
         '≥ 100 (접기: < 40)'::text as target,
         (select count(*) from normal_mt) >= 100 as pass
  union all
  select 11, '볼륨: 판을 시작한 서로 다른 브라우저',
         (select n from players_started)::numeric, '≥ 100',
         (select n from players_started) >= 100
  union all
  select 20, '핵심①: 만든 방 수', (select count(*) from rooms_created)::numeric, '(분모)', null
  union all
  select 21, '핵심①: 2명이 찬 방 수', (select count(*) from rooms_full)::numeric, '(분자)', null
  union all
  select 22, '핵심① 입장률 %', round(100.0 * (select count(*) from rooms_full) / nullif((select count(*) from rooms_created), 0), 1),
         '≥ 50 (접기: < 30)',
         100.0 * (select count(*) from rooms_full) / nullif((select count(*) from rooms_created), 0) >= 50
  union all
  select 30, '핵심②: 첫 판 정상 종료 방 수', (select count(*) from rooms_first_done)::numeric, '(분자)', null
  union all
  select 31, '핵심② 완주율 %', round(100.0 * (select count(*) from rooms_first_done) / nullif((select count(*) from rooms_full), 0), 1),
         '≥ 60',
         100.0 * (select count(*) from rooms_first_done) / nullif((select count(*) from rooms_full), 0) >= 60
  union all
  select 40, '핵심③: 정상 종료 쌍 수', (select count(*) from pairs_done)::numeric, '(분모)', null
  union all
  select 41, '핵심③ 재대결률 % (24시간 안)', round(100.0 * (select count(*) from pairs_rematch) / nullif((select count(*) from pairs_done), 0), 1),
         '≥ 30',
         100.0 * (select count(*) from pairs_rematch) / nullif((select count(*) from pairs_done), 0) >= 30
  union all
  select 50, '핵심④: 완주한 브라우저 수', (select count(*) from completers)::numeric, '(분모)', null
  union all
  select 51, '핵심④: 완주자가 데려온 새 사람 수', (select count(*) from referred)::numeric, '(분자)', null
  union all
  select 52, '핵심④ 전파 K', round((select count(*) from referred)::numeric / nullif((select count(*) from completers), 0), 2),
         '≥ 0.5',
         (select count(*) from referred)::numeric / nullif((select count(*) from completers), 0) >= 0.5
  union all
  select 60, '웃음: 피식 응답 수', (select n from fb)::numeric, '≥ 30건이어야 유효', (select n from fb) >= 30
  union all
  select 61, '웃음: 약간 이상 %', round(100.0 * (select pos from fb) / nullif((select n from fb), 0), 1),
         '≥ 70 (접기: < 40, 응답 30건 이상일 때만 판정)',
         case when (select n from fb) >= 30 then 100.0 * (select pos from fb) / nullif((select n from fb), 0) >= 70 end
  union all
  select 70, '안전: 경보 켠 판 완주율 %',
         round(100.0 * coalesce((select done from alarm_rate where alarm_on), 0) / nullif((select started from alarm_rate where alarm_on), 0), 1),
         '꺼진 판과 차이 10%p 미만', null
  union all
  select 71, '안전: 경보 끈 판 완주율 %',
         round(100.0 * coalesce((select done from alarm_rate where not alarm_on), 0) / nullif((select started from alarm_rate where not alarm_on), 0), 1),
         '(비교 기준)', null
  union all
  select 72, '안전: 신고율 3% 초과 문구 수 (표본 20회 이상)',
         (select count(*) from line_rates where shown >= 20 and reports::numeric / shown > 0.03)::numeric,
         '0 이어야 함 (목록은 질의 2)',
         (select count(*) from line_rates where shown >= 20 and reports::numeric / shown > 0.03) = 0
  union all
  select 73, '안전: 초인종(Realtime) 연결 실패율 %',
         round(100.0 * (select bell_fail from transport) / nullif((select n from transport), 0), 1),
         '회사망 차단 신호(기준 없음)', null
) q
order by ord;


-- ════════════════════════════════════════════════════════════════════════════
-- 질의 2. 문구별 신고율 (3% 넘는 문구는 바로 삭제 대상)
-- ════════════════════════════════════════════════════════════════════════════
with params as (
  select timestamptz '2026-11-08 00:00:00+09' as seeding_start      -- [설정] 질의 1과 같은 값
),
ev as (
  select e.* from public.mc_events e, params
  where e.env = 'production' and not e.is_test
    and e.at >= params.seeding_start and e.at < params.seeding_start + interval '14 days'
),
shown as (
  select l as line_id, count(*) as shown
  from ev, jsonb_array_elements_text(ev.props -> 'lineIds') as l
  where ev.type = 'lines_shown'
  group by l
),
reported as (
  select props ->> 'lineId' as line_id, count(*) as reports from ev where type = 'line_report' group by 1
)
select coalesce(s.line_id, r.line_id) as line_id,
       coalesce(s.shown, 0)           as shown,
       coalesce(r.reports, 0)         as reports,
       round(100.0 * coalesce(r.reports, 0) / nullif(coalesce(s.shown, 0), 0), 1) as report_pct
from shown s
full join reported r on r.line_id = s.line_id
order by report_pct desc nulls last, reports desc
limit 100;


-- ════════════════════════════════════════════════════════════════════════════
-- 질의 3. 기록 건수 점검 (환경별·테스트별로 얼마나 제외되는지)
-- ════════════════════════════════════════════════════════════════════════════
select 'events' as source, env, is_test, count(*) as rows, min(at) as first_at, max(at) as last_at
from public.mc_events group by env, is_test
union all
select 'matches', env, is_test, count(*), min(started_at), max(started_at)
from public.mc_matches group by env, is_test
order by source, env, is_test;


-- ════════════════════════════════════════════════════════════════════════════
-- 질의 4. 힌트 승률 · 검산 10초 정답률 (기획서 §4 조정 기준, 기획팀장 최종 리뷰 §3-4)
-- ════════════════════════════════════════════════════════════════════════════
-- 기록 모양 (코드로 확인): mc_matches.hints = [자리0이 "받은" 힌트 수, 자리1이 받은 수] (engine hintsEarned, 쓴 수 아님)
--   mc_matches.winner_seat = 0 | 1 | null (무승부·cap·기권 등은 null 가능)
--   mc_matches.quizzes = {"items":[{"round":4,"kind":"..","awarded":[0],"elapsedMs":[3100,null]}, ...]}
--   awarded가 비어 있지 않음 = 누군가 QUIZ_MS(10초) 안에 맞혀 힌트가 지급된 검산. 빈 배열 = 아무도 못 맞힘.
-- 판정 규칙 (힌트): 승패가 갈린 정상 종료(sunk2) 판 중 두 사람의 받은 힌트 수가 다른 판만 센다.
--   n ≥ 50 일 때만 판정한다. 승률 > 60% 이면 HINTS_PER_GAME을 1로 검토, 60% 이하면 2 유지.
--   n < 50 이면 판정하지 않고 2 유지(pass = null, 다음 측정으로 넘김).
-- 검산: 기획서 기준 "퀴즈의 50~70%가 10초 안에 풀려야 하고, 30% 미만이면 QUIZ_MS를 15초로 늘린다".
--   pass = 50% 이상(30% 미만이면 false, 30~50%는 null = 경계 구간, 사람이 본다). 출제 20회 미만이면 판정 안 함.
with params as (
  select timestamptz '2026-11-08 00:00:00+09' as seeding_start      -- [설정] 질의 1과 같은 값
),
mt as (
  select m.* from public.mc_matches m, params
  where m.env = 'production' and not m.is_test
    and m.started_at >= params.seeding_start and m.started_at < params.seeding_start + interval '14 days'
),
hint_games as (                             -- 승패가 갈렸고 받은 힌트 수가 다른 판
  select (case when (hints ->> winner_seat::int)::int > (hints ->> (1 - winner_seat)::int)::int then 1 else 0 end) as more_won
  from mt
  where end_reason = 'sunk2' and winner_seat is not null and hints is not null
    and (hints ->> 0)::int <> (hints ->> 1)::int
),
hg as (
  select count(*) as n, count(*) filter (where more_won = 1) as won from hint_games
),
quiz_items as (                             -- 정상·기권 포함, 끝난 판에 기록된 모든 출제
  select jsonb_array_length(coalesce(quizzes -> 'items', '[]'::jsonb)) as issued,
         (select count(*) from jsonb_array_elements(coalesce(quizzes -> 'items', '[]'::jsonb)) i
           where jsonb_array_length(coalesce(i -> 'awarded', '[]'::jsonb)) > 0) as solved
  from mt where quizzes is not null
),
qz as (
  select coalesce(sum(issued), 0) as issued, coalesce(sum(solved), 0) as solved from quiz_items
)
select ord, metric, value, target, pass
from (
  select 1 as ord, '힌트: 승패 갈리고 힌트 수 다른 판 수(n)' as metric, (select n from hg)::numeric as value,
         '≥ 50 이어야 판정' as target, (select n from hg) >= 50 as pass
  union all
  select 2, '힌트: 더 받은 쪽 승률 %',
         round(100.0 * (select won from hg) / nullif((select n from hg), 0), 1),
         '≤ 60 이면 HINTS_PER_GAME 2 유지, 초과면 1 검토 (n ≥ 50일 때만)',
         case when (select n from hg) >= 50 then 100.0 * (select won from hg) / (select n from hg) <= 60 end
  union all
  select 3, '검산: 출제 횟수', (select issued from qz)::numeric, '(분모)', null
  union all
  select 4, '검산: 10초 안에 정답이 나온 횟수', (select solved from qz)::numeric, '(분자)', null
  union all
  select 5, '검산: 10초 안 정답률 %',
         round(100.0 * (select solved from qz) / nullif((select issued from qz), 0), 1),
         '50~70 (30 미만이면 QUIZ_MS 15초로, 출제 20회 이상일 때만 판정)',
         case when (select issued from qz) >= 20 then 100.0 * (select solved from qz) / (select issued from qz) >= 50 end
) q
order by ord;
