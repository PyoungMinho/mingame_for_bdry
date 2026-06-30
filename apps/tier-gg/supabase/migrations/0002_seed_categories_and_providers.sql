-- ============================================================
-- Tier.gg — 0002_seed_categories_and_providers.sql
-- 초기 시드: categories / providers / benchmarks
-- DB 설계자: @DB설계자 (Sonnet) — 2026-05-28
-- ============================================================

-- ============================================================
-- 1. categories
-- ============================================================
INSERT INTO categories (slug, name, schema) VALUES
(
  'ai_model',
  'AI Models',
  '{
    "attrs": {
      "modality":       { "type": "string[]", "label": "Modality",          "example": ["text", "image", "code", "audio"] },
      "priceInput":     { "type": "number",   "label": "Input Price $/M",   "unit": "$/M tokens" },
      "priceOutput":    { "type": "number",   "label": "Output Price $/M",  "unit": "$/M tokens" },
      "contextWindow":  { "type": "number",   "label": "Context Window",    "unit": "tokens" },
      "openSource":     { "type": "boolean",  "label": "Open Source" },
      "apiAvailable":   { "type": "boolean",  "label": "API Available" }
    }
  }'::JSONB
)
ON CONFLICT (slug) DO NOTHING;

-- ============================================================
-- 2. providers
-- ============================================================
INSERT INTO providers (slug, name, country, website, logo_color) VALUES
  ('openai',    'OpenAI',    'US', 'https://openai.com',         '#10A37F'),
  ('anthropic', 'Anthropic', 'US', 'https://anthropic.com',      '#D97706'),
  ('google',    'Google',    'US', 'https://deepmind.google',    '#4285F4'),
  ('meta',      'Meta',      'US', 'https://ai.meta.com',        '#0866FF'),
  ('mistral',   'Mistral',   'FR', 'https://mistral.ai',         '#FF7000'),
  ('deepseek',  'DeepSeek',  'CN', 'https://deepseek.com',       '#1E90FF'),
  ('xai',       'xAI',       'US', 'https://x.ai',               '#1DA1F2'),
  ('cohere',    'Cohere',    'CA', 'https://cohere.com',         '#39594D'),
  ('microsoft', 'Microsoft', 'US', 'https://microsoft.com',      '#00A4EF'),
  ('alibaba',   'Alibaba',   'CN', 'https://qwen.aliyun.com',   '#FF6A00'),
  ('stability', 'Stability AI', 'UK', 'https://stability.ai',    '#9B59B6'),
  ('blackforest', 'Black Forest Labs', 'DE', 'https://blackforestlabs.ai', '#2C3E50'),
  ('github',    'GitHub',    'US', 'https://github.com/features/copilot', '#24292E'),
  ('anysphere', 'Anysphere', 'US', 'https://cursor.sh',          '#1A1A1A'),
  ('codeium',   'Codeium',   'US', 'https://codeium.com',        '#09B6A2'),
  ('replit',    'Replit',    'US', 'https://replit.com',         '#F26207'),
  ('exafunction', 'Exafunction', 'US', 'https://windsurf.com',   '#5C6BC0')
ON CONFLICT (slug) DO NOTHING;

-- ============================================================
-- 3. benchmarks (ai_model 카테고리)
--    category_id는 서브쿼리로 참조 (idempotent)
-- ============================================================
INSERT INTO benchmarks (category_id, slug, name, scale, unit, description)
SELECT
  c.id,
  b.slug,
  b.name,
  b.scale,
  b.unit,
  b.description
FROM categories c
CROSS JOIN (VALUES
  ('mmlu',           'MMLU',                 100,    '%',         '57개 학문 분야 5지선다 — 지식 폭/추론력 종합 지표'),
  ('humaneval',      'HumanEval',            100,    '%',         'OpenAI HumanEval 164개 Python 코딩 과제 pass@1'),
  ('gpqa',           'GPQA Diamond',         100,    '%',         '전문가 수준 과학 다지선다 — Graduate-level (Diamond subset)'),
  ('arena_elo',      'Arena Elo',            NULL,   'Elo pts',   'LMSYS Chatbot Arena 사용자 블라인드 평가 Elo 점수'),
  ('price_input',    'Input Price',          NULL,   '$/M tokens','입력 토큰 1M당 USD 비용 (API, 2026-05 기준)'),
  ('price_output',   'Output Price',         NULL,   '$/M tokens','출력 토큰 1M당 USD 비용 (API, 2026-05 기준)'),
  ('context_window', 'Context Window',       NULL,   'K tokens',  '최대 컨텍스트 윈도우 (K 단위)'),
  ('speed_tps',      'Speed',                NULL,   'tokens/s',  '출력 속도 — 외부 집계 기준 중앙값 tokens/sec')
) AS b(slug, name, scale, unit, description)
WHERE c.slug = 'ai_model'
ON CONFLICT (category_id, slug) DO NOTHING;
