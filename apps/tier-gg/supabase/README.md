# Tier.gg — Supabase 마이그레이션 가이드

DB 설계자: @DB설계자 (Sonnet) — 2026-05-28

---

## 디렉토리 구조

```
supabase/
  migrations/
    0001_init.sql                    # 전체 스키마 + RLS + 인덱스
    0002_seed_categories_and_providers.sql  # 초기 카테고리·프로바이더·벤치마크
  README.md                          # 이 파일
```

---

## 마이그레이션 적용 (Supabase CLI)

### 사전 준비

```bash
npm install -g supabase
supabase login
supabase link --project-ref <YOUR_PROJECT_REF>
```

### 마이그레이션 실행

```bash
# 전체 마이그레이션 적용 (원격 DB)
supabase db push

# 로컬 개발 환경 (Docker 필요)
supabase start
supabase db reset   # 로컬 DB 리셋 + 전체 마이그레이션 재실행
```

### 개별 파일 직접 실행 (Supabase Dashboard SQL 에디터)

1. Supabase Dashboard → SQL Editor
2. `0001_init.sql` 내용 전체 붙여넣기 → Run
3. `0002_seed_categories_and_providers.sql` 내용 전체 붙여넣기 → Run

---

## 시드 데이터 적용

시드는 `0002_seed_categories_and_providers.sql` 에 포함되어 있다.
모든 INSERT는 `ON CONFLICT DO NOTHING` 으로 멱등(idempotent) 실행 가능.

추가 모델 시드가 필요할 경우:

```sql
-- 예시: 새 모델 등록
INSERT INTO entities (category_id, slug, name, provider_id, status, released_at, summary, attrs)
SELECT
  c.id,
  'new-model-slug',
  'New Model Name',
  p.id,
  'review',
  '2026-06-01',
  '모델 설명',
  '{"modality":["text"],"priceInput":1.0,"priceOutput":4.0,"contextWindow":128,"openSource":false,"apiAvailable":true}'::JSONB
FROM categories c, providers p
WHERE c.slug = 'ai_model' AND p.slug = 'provider-slug';
```

---

## RLS (Row Level Security) 정책

| 테이블 | public (anon/auth) | service_role |
|---|---|---|
| categories | SELECT (deleted_at IS NULL) | INSERT / UPDATE / DELETE |
| providers | SELECT (deleted_at IS NULL) | INSERT / UPDATE / DELETE |
| entities | SELECT (deleted_at IS NULL AND status='published') | INSERT / UPDATE / DELETE |
| benchmarks | SELECT (deleted_at IS NULL) | INSERT / UPDATE / DELETE |
| sources | SELECT (deleted_at IS NULL) | INSERT / UPDATE / DELETE |
| scores | SELECT (deleted_at IS NULL) | INSERT / UPDATE / DELETE |
| changelog | SELECT (deleted_at IS NULL) | INSERT / UPDATE / DELETE |

**핵심**: entities 테이블은 `status = 'published'` 인 행만 공개 노출된다.
`draft` / `review` 상태 모델은 service_role 키를 가진 관리자 화면에서만 조회 가능.

프론트엔드 클라이언트는 반드시 `anon` 키만 사용할 것.
`service_role` 키는 서버 사이드(Next.js Route Handler, GitHub Actions) 전용.

---

## 향후 카테고리 추가 가이드

EAV 구조이므로 새 카테고리 추가 시 스키마 변경 없이 데이터만 삽입한다.

### 예시 1: YouTube 채널 분석

```sql
INSERT INTO categories (slug, name, schema) VALUES (
  'youtube_channel',
  'YouTube Channels',
  '{
    "attrs": {
      "subscriberCount": { "type": "number", "label": "Subscribers" },
      "avgViews":        { "type": "number", "label": "Avg Views/Video" },
      "uploadFrequency": { "type": "string", "label": "Upload Frequency" },
      "primaryLanguage": { "type": "string", "label": "Primary Language" }
    }
  }'::JSONB
);

-- 해당 카테고리 벤치마크 추가
INSERT INTO benchmarks (category_id, slug, name, unit, description)
SELECT id, 'subscriber_growth_rate', 'Subscriber Growth Rate', '%/month', '월 구독자 증가율'
FROM categories WHERE slug = 'youtube_channel';
```

### 예시 2: 자격증·시험 비교

```sql
INSERT INTO categories (slug, name, schema) VALUES (
  'certification',
  'Certifications',
  '{
    "attrs": {
      "passingScore":   { "type": "number", "label": "Passing Score (%)" },
      "examFee":        { "type": "number", "label": "Exam Fee (USD)" },
      "validityYears":  { "type": "number", "label": "Validity (years)" },
      "difficultyLevel":{ "type": "string", "label": "Difficulty" }
    }
  }'::JSONB
);
```

새 카테고리는 `/[category]/[entity-slug]` 라우팅으로 자동 지원된다.
프론트엔드 페이지 템플릿은 category.schema.attrs를 읽어 동적 렌더링.

---

## 인덱스 전략 요약

| 인덱스 | 대상 컬럼 | 쿼리 패턴 |
|---|---|---|
| idx_entities_category_status | (category_id, status) WHERE deleted_at IS NULL | 카테고리별 published 모델 목록 |
| idx_entities_slug | slug WHERE deleted_at IS NULL | /models/[slug] 단일 조회 |
| idx_entities_provider | provider_id WHERE deleted_at IS NULL | 프로바이더별 모델 필터 |
| idx_scores_entity | entity_id WHERE deleted_at IS NULL | 모델 상세 페이지 점수 로드 |
| idx_scores_benchmark | benchmark_id WHERE deleted_at IS NULL | 리더보드 metric별 정렬 |
| idx_scores_entity_benchmark | (entity_id, benchmark_id) WHERE deleted_at IS NULL | 비교 페이지 pair 조회 |
| idx_changelog_entity | (entity_id, changed_at DESC) | 모델 변경 이력 타임라인 |
| idx_sources_confidence | confidence | T1/T2/T3 신뢰도 필터 |
