-- 001_extensions.sql
-- PostGIS: 지리 좌표 쿼리(geo 컬럼, 반경 검색)
-- pgcrypto: gen_random_uuid() 폴백 (Postgres 13+ 는 gen_random_uuid() 기본 제공이나 명시)

create extension if not exists postgis;
create extension if not exists pgcrypto;
