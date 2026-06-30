-- seed.sql
-- 개발·프론트 QA용 샘플 데이터.
-- 목적: Gold/Silver/Unverified 등급 + pending(earned=NULL) 항목 표시 검증.
-- 실행 전제: 001~005 마이그레이션 완료 후 실행.
--
-- 참고 좌표(WGS84):
--   관악구 신림동 중심: 37.4845, 126.9293
--   관악구 봉천동 중심: 37.4784, 126.9531
--   마포구 합정동 중심: 37.5498, 126.9137
--   마포구 망원동 중심: 37.5559, 126.9051

-- ──────────────────────────────────────────────
-- 0. profiles (tenant × 2, agent × 2)
-- ──────────────────────────────────────────────
-- auth.users 는 Supabase Auth가 관리하므로 seed에서 직접 삽입 불가.
-- 개발 환경에서는 Supabase 대시보드에서 테스트 계정 생성 후 아래 uuid 교체 사용.
-- 여기서는 고정 uuid로 삽입(로컬 개발용).

insert into profiles (id, role, phone_verified, identity_verified, display_name)
values
  -- tenant: 본인인증 완료(사진 업로드 가능)
  ('00000000-0000-0000-0000-000000000001', 'tenant', true,  true,  '김지은'),
  -- tenant: 본인인증 미완료(업로드 불가 — RLS 검증용)
  ('00000000-0000-0000-0000-000000000002', 'tenant', false, false, '박준호'),
  -- agent: 중개사
  ('00000000-0000-0000-0000-000000000010', 'agent',  true,  true,  '한빛부동산'),
  ('00000000-0000-0000-0000-000000000011', 'agent',  true,  true,  '마포공인중개사')
on conflict (id) do nothing;

-- ──────────────────────────────────────────────
-- 1. listings (9건 — 직접 삽입, 트리거로 score_items 5행 자동 생성)
-- ──────────────────────────────────────────────
-- trg_listings_init_score_items 가 INSERT 후 score_items 5행 삽입.
-- 이후 각 매물별로 score_items를 update하여 등급 시뮬레이션.

insert into listings (
  id, title, address, region, building_type,
  deposit_manwon, monthly_rent_manwon,
  geo, status, agent_id,
  description, area_m2, floor
) values
  -- [A] 관악구 Gold 후보 (photo+exif+community+owner 충족)
  ('aaaaaaaa-0000-0000-0000-000000000001',
   '신림역 도보 3분 풀옵션 원룸', '서울 관악구 신림동 1234-5', 'gwanak', 'oneroom',
   1000, 45,
   st_geogfromtext('POINT(126.9293 37.4845)'), 'pending',
   '00000000-0000-0000-0000-000000000010',
   '세입자 직접 촬영 사진 포함, 역세권 풀옵션', 16.5, '3'),

  -- [B] 관악구 Silver 후보
  ('aaaaaaaa-0000-0000-0000-000000000002',
   '봉천역 5분 채광 좋은 원룸', '서울 관악구 봉천동 567-8', 'gwanak', 'oneroom',
   500, 38,
   st_geogfromtext('POINT(126.9531 37.4784)'), 'pending',
   '00000000-0000-0000-0000-000000000010',
   '남향, 채광 우수, 중개사 직촬 사진', 13.2, '2'),

  -- [C] 관악구 Unverified (점수 낮음)
  ('aaaaaaaa-0000-0000-0000-000000000003',
   '관악구 원룸 급매', '서울 관악구 신림동 999-1', 'gwanak', 'oneroom',
   300, 30,
   st_geogfromtext('POINT(126.9310 37.4830)'), 'pending',
   '00000000-0000-0000-0000-000000000010',
   '급매, 즉시 입주 가능', 10.0, '1'),

  -- [D] 관악구 Gold + pending 항목(transaction) 포함 — isLowerBound=true 검증용
  ('aaaaaaaa-0000-0000-0000-000000000004',
   '서울대입구역 오피스텔 신축급', '서울 관악구 봉천동 200-3', 'gwanak', 'officetel',
   3000, 70,
   st_geogfromtext('POINT(126.9520 37.4800)'), 'pending',
   '00000000-0000-0000-0000-000000000010',
   '신축급 오피스텔, 세입자 인증 사진', 22.0, '5'),

  -- [E] 마포구 Gold
  ('bbbbbbbb-0000-0000-0000-000000000001',
   '합정역 2분 역세권 오피스텔', '서울 마포구 합정동 100-2', 'mapo', 'officetel',
   5000, 90,
   st_geogfromtext('POINT(126.9137 37.5498)'), 'pending',
   '00000000-0000-0000-0000-000000000011',
   '역세권 오피스텔, 실거주 인증 완료', 25.0, '7'),

  -- [F] 마포구 Silver + pending(owner) 포함
  ('bbbbbbbb-0000-0000-0000-000000000002',
   '망원동 감성 원룸', '서울 마포구 망원동 33-5', 'mapo', 'oneroom',
   1000, 50,
   st_geogfromtext('POINT(126.9051 37.5559)'), 'pending',
   '00000000-0000-0000-0000-000000000011',
   '망원시장 도보권, 아늑한 원룸', 14.8, '2'),

  -- [G] 마포구 Unverified
  ('bbbbbbbb-0000-0000-0000-000000000003',
   '마포구 원룸 저렴', '서울 마포구 합정동 55-9', 'mapo', 'oneroom',
   200, 25,
   st_geogfromtext('POINT(126.9120 37.5490)'), 'pending',
   '00000000-0000-0000-0000-000000000011',
   '저가, 옵션 없음', 9.5, '1'),

  -- [H] 관악구 reported 매물 (신뢰도 검수 중)
  ('aaaaaaaa-0000-0000-0000-000000000005',
   '관악구 의심 매물', '서울 관악구 신림동 11-1', 'gwanak', 'oneroom',
   500, 40,
   st_geogfromtext('POINT(126.9280 37.4840)'), 'pending',
   '00000000-0000-0000-0000-000000000010',
   null, 11.0, '2'),

  -- [I] 마포구 Gold + community 신고 반영(delta_if_reported 검증용)
  ('bbbbbbbb-0000-0000-0000-000000000004',
   '합정동 신뢰 매물(신고 이력 있음)', '서울 마포구 합정동 77-3', 'mapo', 'officetel',
   4000, 80,
   st_geogfromtext('POINT(126.9145 37.5502)'), 'pending',
   '00000000-0000-0000-0000-000000000011',
   '신고 1건 처리 후 복원, 재검증 완료', 20.0, '4')
on conflict (id) do nothing;

-- ──────────────────────────────────────────────
-- 2. score_items 업데이트 (트리거로 생성된 행의 값 세팅)
-- ──────────────────────────────────────────────
-- [A] Gold 목표: photo=32, exif=18, community=18, owner=13, transaction=8 → 합계 89
update score_items set earned=32, status='verified', verified_at=now() - interval '2 days'
  where listing_id='aaaaaaaa-0000-0000-0000-000000000001' and key='photo';
update score_items set earned=18, status='verified', verified_at=now() - interval '1 day'
  where listing_id='aaaaaaaa-0000-0000-0000-000000000001' and key='exif';
update score_items set earned=18, status='verified', verified_at=now() - interval '1 day'
  where listing_id='aaaaaaaa-0000-0000-0000-000000000001' and key='community';
update score_items set earned=13, status='verified', verified_at=now() - interval '3 days'
  where listing_id='aaaaaaaa-0000-0000-0000-000000000001' and key='owner';
update score_items set earned=8,  status='verified', verified_at=now() - interval '5 days'
  where listing_id='aaaaaaaa-0000-0000-0000-000000000001' and key='transaction';

-- [B] Silver 목표: photo=28, exif=10, community=15, owner=8, transaction=5 → 합계 66
update score_items set earned=28, status='verified', verified_at=now() - interval '1 day'
  where listing_id='aaaaaaaa-0000-0000-0000-000000000002' and key='photo';
update score_items set earned=10, status='verified', verified_at=now()
  where listing_id='aaaaaaaa-0000-0000-0000-000000000002' and key='exif';
update score_items set earned=15, status='verified', verified_at=now()
  where listing_id='aaaaaaaa-0000-0000-0000-000000000002' and key='community';
update score_items set earned=8,  status='verified', verified_at=now() - interval '2 days'
  where listing_id='aaaaaaaa-0000-0000-0000-000000000002' and key='owner';
update score_items set earned=5,  status='verified', verified_at=now() - interval '4 days'
  where listing_id='aaaaaaaa-0000-0000-0000-000000000002' and key='transaction';

-- [C] Unverified: photo=10, exif=0, community=15, owner=5, transaction=0 → 합계 30
update score_items set earned=10, status='verified', verified_at=now()
  where listing_id='aaaaaaaa-0000-0000-0000-000000000003' and key='photo';
update score_items set earned=0,  status='verified', verified_at=now()
  where listing_id='aaaaaaaa-0000-0000-0000-000000000003' and key='exif';
update score_items set earned=15, status='verified', verified_at=now()
  where listing_id='aaaaaaaa-0000-0000-0000-000000000003' and key='community';
update score_items set earned=5,  status='verified', verified_at=now()
  where listing_id='aaaaaaaa-0000-0000-0000-000000000003' and key='owner';
update score_items set earned=0,  status='verified', verified_at=now()
  where listing_id='aaaaaaaa-0000-0000-0000-000000000003' and key='transaction';

-- [D] Gold + pending(transaction) → isLowerBound=true.
--     현재 확정: photo=30, exif=17, community=16, owner=12 = 75. transaction=NULL(pending).
--     maxPossible=75+10=85. 75점이지만 "75점~" 표기, 최대 85점 가능.
update score_items set earned=30, status='verified', verified_at=now() - interval '1 day'
  where listing_id='aaaaaaaa-0000-0000-0000-000000000004' and key='photo';
update score_items set earned=17, status='verified', verified_at=now()
  where listing_id='aaaaaaaa-0000-0000-0000-000000000004' and key='exif';
update score_items set earned=16, status='verified', verified_at=now()
  where listing_id='aaaaaaaa-0000-0000-0000-000000000004' and key='community';
update score_items set earned=12, status='verified', verified_at=now() - interval '2 days'
  where listing_id='aaaaaaaa-0000-0000-0000-000000000004' and key='owner';
-- transaction: earned=NULL, status='pending' (외부 ACL 미완료)
-- 트리거 초기값(earned=null, status='pending') 그대로 유지 — 업데이트 불필요.

-- [E] 마포 Gold: photo=33, exif=19, community=19, owner=14, transaction=9 → 94
update score_items set earned=33, status='verified', verified_at=now() - interval '3 days'
  where listing_id='bbbbbbbb-0000-0000-0000-000000000001' and key='photo';
update score_items set earned=19, status='verified', verified_at=now() - interval '2 days'
  where listing_id='bbbbbbbb-0000-0000-0000-000000000001' and key='exif';
update score_items set earned=19, status='verified', verified_at=now() - interval '1 day'
  where listing_id='bbbbbbbb-0000-0000-0000-000000000001' and key='community';
update score_items set earned=14, status='verified', verified_at=now() - interval '4 days'
  where listing_id='bbbbbbbb-0000-0000-0000-000000000001' and key='owner';
update score_items set earned=9,  status='verified', verified_at=now() - interval '6 days'
  where listing_id='bbbbbbbb-0000-0000-0000-000000000001' and key='transaction';

-- [F] 마포 Silver + pending(owner). 현재: photo=25, exif=12, community=17, transaction=6 = 60.
--     owner=NULL(pending). maxPossible=60+15=75. "60점~" 표기.
update score_items set earned=25, status='verified', verified_at=now() - interval '1 day'
  where listing_id='bbbbbbbb-0000-0000-0000-000000000002' and key='photo';
update score_items set earned=12, status='verified', verified_at=now()
  where listing_id='bbbbbbbb-0000-0000-0000-000000000002' and key='exif';
update score_items set earned=17, status='verified', verified_at=now()
  where listing_id='bbbbbbbb-0000-0000-0000-000000000002' and key='community';
-- owner: pending(earned=null) 유지
update score_items set earned=6,  status='verified', verified_at=now() - interval '3 days'
  where listing_id='bbbbbbbb-0000-0000-0000-000000000002' and key='transaction';

-- [G] 마포 Unverified: photo=8, exif=0, community=12, owner=0, transaction=3 → 23
update score_items set earned=8,  status='verified', verified_at=now()
  where listing_id='bbbbbbbb-0000-0000-0000-000000000003' and key='photo';
update score_items set earned=0,  status='verified', verified_at=now()
  where listing_id='bbbbbbbb-0000-0000-0000-000000000003' and key='exif';
update score_items set earned=12, status='verified', verified_at=now()
  where listing_id='bbbbbbbb-0000-0000-0000-000000000003' and key='community';
update score_items set earned=0,  status='verified', verified_at=now()
  where listing_id='bbbbbbbb-0000-0000-0000-000000000003' and key='owner';
update score_items set earned=3,  status='verified', verified_at=now()
  where listing_id='bbbbbbbb-0000-0000-0000-000000000003' and key='transaction';

-- [H] reported 매물: photo=20, 나머지 pending(신고로 처리 중단)
update score_items set earned=20, status='verified', verified_at=now() - interval '1 day'
  where listing_id='aaaaaaaa-0000-0000-0000-000000000005' and key='photo';
-- 나머지 exif/community/owner/transaction: pending 유지(신고 후 재검증 중)

-- [I] Gold + community=reported(delta_if_reported=-5). 신고 감점 반영.
--     photo=32, exif=18, community=reported(earned=18, delta=-5→실질 13), owner=13, transaction=8
--     집계: 32+18+13+13+8 = 84점 → Gold 유지
update score_items set earned=32, status='verified', verified_at=now() - interval '2 days'
  where listing_id='bbbbbbbb-0000-0000-0000-000000000004' and key='photo';
update score_items set earned=18, status='verified', verified_at=now() - interval '1 day'
  where listing_id='bbbbbbbb-0000-0000-0000-000000000004' and key='exif';
update score_items set earned=18, status='reported', delta_if_reported=-5, verified_at=now() - interval '1 day'
  where listing_id='bbbbbbbb-0000-0000-0000-000000000004' and key='community';
update score_items set earned=13, status='verified', verified_at=now() - interval '3 days'
  where listing_id='bbbbbbbb-0000-0000-0000-000000000004' and key='owner';
update score_items set earned=8,  status='verified', verified_at=now() - interval '5 days'
  where listing_id='bbbbbbbb-0000-0000-0000-000000000004' and key='transaction';

-- ──────────────────────────────────────────────
-- 3. score_items 업데이트가 완료됐으므로 recompute_listing_score 수동 호출
--    (트리거는 score_items 변경 시 자동 실행되지만, seed 환경에서 확인 목적)
-- ──────────────────────────────────────────────
select recompute_listing_score('aaaaaaaa-0000-0000-0000-000000000001');
select recompute_listing_score('aaaaaaaa-0000-0000-0000-000000000002');
select recompute_listing_score('aaaaaaaa-0000-0000-0000-000000000003');
select recompute_listing_score('aaaaaaaa-0000-0000-0000-000000000004');
select recompute_listing_score('bbbbbbbb-0000-0000-0000-000000000001');
select recompute_listing_score('bbbbbbbb-0000-0000-0000-000000000002');
select recompute_listing_score('bbbbbbbb-0000-0000-0000-000000000003');
select recompute_listing_score('aaaaaaaa-0000-0000-0000-000000000005');
select recompute_listing_score('bbbbbbbb-0000-0000-0000-000000000004');

-- [H] 신고 삽입 (trg_reports_takedown 이 listings.status='reported' 로 전환)
insert into reports (id, listing_id, reporter_id, reason, detail, status)
values (
  'cccccccc-0000-0000-0000-000000000001',
  'aaaaaaaa-0000-0000-0000-000000000005',
  '00000000-0000-0000-0000-000000000002',
  'fake_listing',
  '사진이 다른 매물 사진임',
  'received'
) on conflict (id) do nothing;

-- ──────────────────────────────────────────────
-- 4. 샘플 photos (tenant 김지은이 업로드한 승인 사진)
-- ──────────────────────────────────────────────
insert into photos (id, listing_id, uploader_id, original_path, blurred_path, status, liveness_score)
values
  ('dddddddd-0000-0000-0000-000000000001',
   'aaaaaaaa-0000-0000-0000-000000000001',
   '00000000-0000-0000-0000-000000000001',
   'listing-photos-original/aaaa01/photo1.jpg',
   'listing-photos-blurred/aaaa01/photo1_blurred.jpg',
   'approved', 0.87),
  ('dddddddd-0000-0000-0000-000000000002',
   'aaaaaaaa-0000-0000-0000-000000000001',
   '00000000-0000-0000-0000-000000000001',
   'listing-photos-original/aaaa01/photo2.jpg',
   'listing-photos-blurred/aaaa01/photo2_blurred.jpg',
   'approved', 0.92),
  ('dddddddd-0000-0000-0000-000000000003',
   'bbbbbbbb-0000-0000-0000-000000000001',
   '00000000-0000-0000-0000-000000000001',
   'listing-photos-original/bbbb01/photo1.jpg',
   'listing-photos-blurred/bbbb01/photo1_blurred.jpg',
   'approved', 0.95)
on conflict (id) do nothing;

-- thumbnail_url 업데이트 (블러 통과 공개본 경로)
update listings set thumbnail_url = 'listing-photos-blurred/aaaa01/photo1_blurred.jpg'
  where id = 'aaaaaaaa-0000-0000-0000-000000000001';
update listings set thumbnail_url = 'listing-photos-blurred/bbbb01/photo1_blurred.jpg'
  where id = 'bbbbbbbb-0000-0000-0000-000000000001';
