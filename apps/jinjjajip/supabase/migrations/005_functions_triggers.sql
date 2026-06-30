-- 005_functions_triggers.sql
-- 1) recompute_listing_score(p_listing_id uuid) — 스코어 집계 함수
-- 2) trg_score_items_recompute — score_items 변경 시 자동 재계산
-- 3) trg_reports_takedown — 신고 접수 즉시 매물 status 전환

-- ══════════════════════════════════════════════════════════════
-- 1. recompute_listing_score
-- ══════════════════════════════════════════════════════════════
-- domain.ts aggregateTrustScore() 와 동일 로직. SQL 구현체.
--
-- 집계 규칙:
--   a) earned IS NULL OR status IN ('pending','processing')
--      → hasPending = true. 해당 항목은 score 합산 제외. max 는 maxPossible 에 포함.
--   b) status = 'reported'
--      → earned + delta_if_reported 를 0 clamp 후 합산.
--   c) status = 'verified', earned IS NOT NULL
--      → earned 그대로 합산.
--
-- sort_rank 공식: trust_score * 1000 - (unix_epoch_now - unix_epoch_created) / 86400
--   → 신뢰 점수 우선, 동점 시 최신 매물이 위로.
--   → epoch 차이를 일(day) 단위로 환산해 소폭 보정(1일 = 1점 격차).

create or replace function recompute_listing_score(p_listing_id uuid)
returns void
language plpgsql
security definer
as $$
declare
  v_score       int := 0;
  v_max_possible int := 0;
  v_has_pending  boolean := false;
  v_grade        text;
  v_sort_rank    double precision;
  v_earned_adj   int;
  v_created_epoch double precision;
  rec            record;
begin
  -- score_items 순회(listing_id 기준, 최대 5행)
  for rec in
    select earned, max, status, delta_if_reported
    from score_items
    where listing_id = p_listing_id
  loop
    -- maxPossible 항상 누적
    v_max_possible := v_max_possible + rec.max;

    if rec.earned is null
       or rec.status in ('pending', 'processing')
    then
      -- pending: 현재 점수 제외, maxPossible 에 max 포함(위에서 누적 완료)
      v_has_pending := true;
      continue;
    end if;

    -- reported: delta_if_reported(음수) 반영 후 0 clamp
    if rec.status = 'reported' then
      v_earned_adj := greatest(0, rec.earned + rec.delta_if_reported);
    else
      v_earned_adj := rec.earned;
    end if;

    v_score := v_score + v_earned_adj;
  end loop;

  -- clamp 0~100
  v_score        := greatest(0, least(100, v_score));
  v_max_possible := greatest(0, least(100, v_max_possible));

  -- computeGrade: Gold>=80 / Silver>=55 / Unverified<55
  if v_score >= 80 then
    v_grade := 'gold';
  elsif v_score >= 55 then
    v_grade := 'silver';
  else
    v_grade := 'unverified';
  end if;

  -- sort_rank: trust_score * 1000 - 경과일수(최신 우선)
  select extract(epoch from created_at) into v_created_epoch
  from listings where id = p_listing_id;

  v_sort_rank := (v_score * 1000.0)
                 - ((extract(epoch from now()) - v_created_epoch) / 86400.0);

  -- listings 갱신(단일 UPDATE)
  update listings
  set
    trust_score = v_score,
    trust_grade = v_grade,
    sort_rank   = v_sort_rank,
    -- pending 있으면 "처리중" 상태 유지, 없고 score>0이면 verified, 아니면 pending
    status = case
               when status in ('reported', 'taken_down') then status  -- 신고/내림은 유지
               when v_has_pending then 'processing'
               when v_score > 0   then 'verified'
               else 'pending'
             end,
    natural_label = case
                      when v_grade = 'gold'       then '실거주 세입자가 직접 찍음'
                      when v_grade = 'silver'     then '현장 확인 완료'
                      else                             '인증 정보 수집 중'
                    end
  where id = p_listing_id;
end;
$$;

-- ══════════════════════════════════════════════════════════════
-- 2. score_items AFTER INSERT/UPDATE → recompute 자동 호출
-- ══════════════════════════════════════════════════════════════
create or replace function fn_score_items_recompute()
returns trigger
language plpgsql
security definer
as $$
begin
  -- INSERT 또는 UPDATE 모두 해당 listing 재계산
  perform recompute_listing_score(new.listing_id);
  return new;
end;
$$;

create trigger trg_score_items_recompute
  after insert or update on score_items
  for each row
  execute function fn_score_items_recompute();

-- ══════════════════════════════════════════════════════════════
-- 3. reports INSERT → 매물 즉시 reported 전환 (notice-and-takedown)
-- ══════════════════════════════════════════════════════════════
-- 신고 접수 즉시 비공개 전환. 검수 후 admin이 resolved/dismissed 처리.
-- dismissed 시 listings.status 복원은 admin 수동(또는 별도 워커).
create or replace function fn_reports_takedown()
returns trigger
language plpgsql
security definer
as $$
begin
  update listings
  set status = 'reported'
  where id = new.listing_id
    and status not in ('taken_down');  -- 이미 내려진 매물은 변경 불필요
  return new;
end;
$$;

create trigger trg_reports_takedown
  after insert on reports
  for each row
  execute function fn_reports_takedown();

-- ══════════════════════════════════════════════════════════════
-- 4. 초기 score_items 행 자동 생성 (listings INSERT 시 5개 고정 행)
-- ══════════════════════════════════════════════════════════════
-- 매물 등록 즉시 5개 항목 행 생성. earned=NULL(pending), max는 배점표 고정.
-- 워커가 이후 earned·status·verified_at 을 채운다.
create or replace function fn_listings_init_score_items()
returns trigger
language plpgsql
security definer
as $$
begin
  insert into score_items (listing_id, key, earned, max, status)
  values
    (new.id, 'photo',       null, 35, 'pending'),
    (new.id, 'exif',        null, 20, 'pending'),
    (new.id, 'community',   null, 20, 'pending'),
    (new.id, 'owner',       null, 15, 'pending'),
    (new.id, 'transaction', null, 10, 'pending');
  return new;
end;
$$;

create trigger trg_listings_init_score_items
  after insert on listings
  for each row
  execute function fn_listings_init_score_items();
