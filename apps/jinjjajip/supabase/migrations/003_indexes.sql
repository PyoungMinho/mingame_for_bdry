-- 003_indexes.sql
-- 쿼리 패턴 기준 인덱스. 설명이 자명하지 않은 경우만 주석.

-- listings: 메인 검색 정렬(신뢰순). status 필터 + sort_rank DESC 복합.
-- taken_down 제외 필터가 항상 붙으므로 (status, sort_rank) 순서가 선택도 최적.
create index if not exists idx_listings_status_sort_rank
  on listings (status, sort_rank desc)
  where deleted_at is null;

-- listings: 지역·유형 필터 검색.
create index if not exists idx_listings_region_building_type
  on listings (region, building_type)
  where deleted_at is null;

-- listings: PostGIS 지리 검색(반경 필터, 지도뷰 P1 대비).
create index if not exists idx_listings_geo
  on listings using gist (geo)
  where deleted_at is null;

-- listings: 에이전트별 매물 조회.
create index if not exists idx_listings_agent_id
  on listings (agent_id)
  where deleted_at is null;

-- photos: 매물별 사진 목록 조회.
create index if not exists idx_photos_listing_id
  on photos (listing_id);

-- photos: 특정 업로더의 사진 조회(본인 확인·원본 접근 RLS).
create index if not exists idx_photos_uploader_id
  on photos (uploader_id);

-- photos: 승인 사진만 공개 조회(status='approved').
create index if not exists idx_photos_listing_id_status
  on photos (listing_id, status);

-- score_items: 매물별 점수 항목 조회(recompute 함수 + 상세 화면).
create index if not exists idx_score_items_listing_id
  on score_items (listing_id);

-- reports: 매물별 신고 목록(관리자 검수 큐).
create index if not exists idx_reports_listing_id
  on reports (listing_id);

-- reports: 신고자별 신고 내역(본인 조회 RLS).
create index if not exists idx_reports_reporter_id
  on reports (reporter_id);

-- uploads: 매물별 업로드 세션 조회.
create index if not exists idx_uploads_listing_id
  on uploads (listing_id);
