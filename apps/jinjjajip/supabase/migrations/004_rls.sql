-- 004_rls.sql
-- Row Level Security 정책.
-- Storage 버킷은 Supabase 콘솔에서 별도 생성 필요(SQL로 버킷 생성 불가):
--   - listing-photos-original : private (비공개 버킷, 서명 URL만 발급)
--   - listing-photos-blurred  : public  (공개 버킷, blurred_path URL 직접 사용)

-- ──────────────────────────────────────────────
-- 공통 헬퍼
-- ──────────────────────────────────────────────
-- 현재 사용자의 role 반환. service_role JWT는 null(어드민 우회 불필요).
create or replace function auth_role()
returns text language sql stable security definer as $$
  select role from profiles where id = auth.uid();
$$;

-- 현재 사용자가 identity_verified=true 인지 확인.
create or replace function auth_identity_verified()
returns boolean language sql stable security definer as $$
  select coalesce(identity_verified, false)
  from profiles where id = auth.uid();
$$;

-- ──────────────────────────────────────────────
-- profiles
-- ──────────────────────────────────────────────
alter table profiles enable row level security;

-- 본인 행 읽기
create policy "profiles_select_own"
  on profiles for select
  using (id = auth.uid());

-- admin은 전체 읽기
create policy "profiles_select_admin"
  on profiles for select
  using (auth_role() = 'admin');

-- 본인 행 수정(role 변경은 service_role만 가능 — 앱에서 role 직접 변경 금지)
create policy "profiles_update_own"
  on profiles for update
  using (id = auth.uid())
  with check (id = auth.uid() and role = (select role from profiles where id = auth.uid()));

-- ──────────────────────────────────────────────
-- listings
-- ──────────────────────────────────────────────
alter table listings enable row level security;

-- anon/auth: taken_down 제외 전체 읽기.
-- reported 매물은 검색 리스트에서 idx 필터로 제외하지만, 직접 id 조회(상세 화면·검수)는 허용.
create policy "listings_select_public"
  on listings for select
  using (status <> 'taken_down' and deleted_at is null);

-- agent/admin: INSERT(새 매물 등록)
create policy "listings_insert_agent_admin"
  on listings for insert
  with check (auth_role() in ('agent', 'admin'));

-- agent: 자신의 매물 수정
create policy "listings_update_agent_own"
  on listings for update
  using (agent_id = auth.uid() and auth_role() = 'agent')
  with check (agent_id = auth.uid());

-- admin: 모든 매물 수정(takedown 포함)
create policy "listings_update_admin"
  on listings for update
  using (auth_role() = 'admin');

-- ──────────────────────────────────────────────
-- photos
-- ──────────────────────────────────────────────
alter table photos enable row level security;

-- 공개 조회: 승인된(approved) 사진의 blurred_path만.
-- original_path에 대한 접근은 이 정책으로는 막을 수 없으므로,
-- 비공개 버킷(listing-photos-original)의 Storage 정책으로 2중 차단.
create policy "photos_select_approved_public"
  on photos for select
  using (status = 'approved');

-- 본인(업로더) + admin: 미승인·rejected 포함 본인 업로드 사진 전체 읽기
create policy "photos_select_own_or_admin"
  on photos for select
  using (uploader_id = auth.uid() or auth_role() = 'admin');

-- INSERT: role='tenant' 이고 identity_verified=true 인 사용자만.
-- 이것이 허위매물 방지 핵심 게이트. 두 조건 모두 서버에서 검증.
create policy "photos_insert_tenant_verified"
  on photos for insert
  with check (
    auth_role() = 'tenant'
    and auth_identity_verified() = true
    and uploader_id = auth.uid()
  );

-- UPDATE: service_role(워커)만. 앱 클라이언트에서 직접 status 변경 금지.
-- (service_role은 RLS를 우회하므로 별도 정책 불필요 — 명시적 문서화 목적 주석)
-- 워커가 processing→approved/rejected 전환, blurred_path 기록.

-- ──────────────────────────────────────────────
-- score_items
-- ──────────────────────────────────────────────
alter table score_items enable row level security;

-- 전체 읽기 공개(매물 신뢰 투명성).
create policy "score_items_select_public"
  on score_items for select
  using (true);

-- 쓰기는 service_role(워커·트리거)만. 클라이언트 직접 쓰기 금지.
-- service_role은 RLS 우회. 앱 anon/auth JWT 에서 INSERT/UPDATE/DELETE 불가.

-- ──────────────────────────────────────────────
-- reports
-- ──────────────────────────────────────────────
alter table reports enable row level security;

-- 인증 사용자: 신고 접수
create policy "reports_insert_auth"
  on reports for insert
  with check (auth.uid() is not null and reporter_id = auth.uid());

-- 본인 신고 내역 조회
create policy "reports_select_own"
  on reports for select
  using (reporter_id = auth.uid());

-- admin: 전체 신고 조회
create policy "reports_select_admin"
  on reports for select
  using (auth_role() = 'admin');

-- ──────────────────────────────────────────────
-- uploads
-- ──────────────────────────────────────────────
alter table uploads enable row level security;

-- 본인 업로드 세션 읽기
create policy "uploads_select_own"
  on uploads for select
  using (uploader_id = auth.uid());

-- admin: 전체 읽기
create policy "uploads_select_admin"
  on uploads for select
  using (auth_role() = 'admin');

-- INSERT: tenant+identity_verified만(photos와 동일 게이트)
create policy "uploads_insert_tenant_verified"
  on uploads for insert
  with check (
    auth_role() = 'tenant'
    and auth_identity_verified() = true
    and uploader_id = auth.uid()
  );

-- UPDATE: service_role(워커)만. 완료 처리·score_delta 기록.
