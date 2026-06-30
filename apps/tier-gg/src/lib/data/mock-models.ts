/**
 * mock-models.ts
 * Tier.gg MVP — 페이지개발자용 정적 목 데이터
 *
 * DB 설계자: @DB설계자 (Sonnet) — 2026-05-28
 *
 * 규칙
 * - 순수 데이터 파일: 사이드이펙트 없음, import만으로 동작
 * - snake_case(SQL) → camelCase(TS) 매핑 주석 명시
 * - source 필드 필수 (url + confidence + verifiedAt)
 * - 가격/벤치마크: 공개 정보 기반 합리적 추정 (2026-05-28 기준)
 */

// ============================================================
// Types — Supabase 스키마와 컬럼명 1:1 대응
// ============================================================

/** SQL: categories */
export interface Category {
  id: number;
  slug: string;          // SQL: slug
  name: string;          // SQL: name
}

/** SQL: providers */
export interface Provider {
  id: number;
  slug: string;          // SQL: slug
  name: string;          // SQL: name
  country: string;       // SQL: country
  website: string;       // SQL: website
  logoColor: string;     // SQL: logo_color
}

/** SQL: benchmarks */
export interface Benchmark {
  id: number;
  categoryId: number;    // SQL: category_id
  slug: string;          // SQL: slug
  name: string;          // SQL: name
  scale: number | null;  // SQL: scale
  unit: string;          // SQL: unit
  description: string;   // SQL: description
}

/** SQL: sources */
export interface Source {
  url: string;           // SQL: url
  type: 'official' | 'aggregator' | 'community';  // SQL: type
  confidence: 'T1' | 'T2' | 'T3';                // SQL: confidence
  verifiedAt: string;    // SQL: verified_at (ISO date string)
}

/** SQL: scores (benchmark slug → value 매핑, 페이지 소비용) */
export interface ModelScores {
  mmlu?: number;          // MMLU %
  humaneval?: number;     // HumanEval %
  gpqa?: number;          // GPQA Diamond %
  arenaElo?: number;      // Chatbot Arena Elo pts
  priceInput?: number;    // $/M tokens
  priceOutput?: number;   // $/M tokens
  contextWindow?: number; // K tokens
  speedTps?: number;      // tokens/s
}

/** SQL: entities + scores 조인 뷰 (페이지 컴포넌트 소비) */
export interface Model {
  id: number;
  categoryId: number;      // SQL: category_id
  slug: string;            // SQL: slug
  name: string;            // SQL: name
  providerSlug: string;    // SQL: provider_id → join → providers.slug
  status: 'draft' | 'review' | 'published';  // SQL: status
  releasedAt: string;      // SQL: released_at (ISO date)
  summary: string;         // SQL: summary
  attrs: {
    modality: ('text' | 'image' | 'code' | 'audio' | 'video')[];  // SQL: attrs.modality
    priceInput: number | null;   // SQL: attrs.priceInput
    priceOutput: number | null;  // SQL: attrs.priceOutput
    contextWindow: number | null;// SQL: attrs.contextWindow (K tokens)
    openSource: boolean;         // SQL: attrs.openSource
    apiAvailable: boolean;       // SQL: attrs.apiAvailable
  };
  scores: ModelScores;
  source: Source;
}

/** SQL: changelog */
export interface ChangelogEntry {
  id: number;
  entitySlug: string;   // SQL: entity_id → join → entities.slug
  field: string;        // SQL: field
  oldValue: unknown;    // SQL: old_value (JSONB)
  newValue: unknown;    // SQL: new_value (JSONB)
  changedAt: string;    // SQL: changed_at (ISO datetime)
  changedBy: string;    // SQL: changed_by
}

// ============================================================
// Static data — providers
// ============================================================

export const mockProviders: Provider[] = [
  { id: 1,  slug: 'openai',      name: 'OpenAI',           country: 'US', website: 'https://openai.com',               logoColor: '#10A37F' },
  { id: 2,  slug: 'anthropic',   name: 'Anthropic',        country: 'US', website: 'https://anthropic.com',            logoColor: '#D97706' },
  { id: 3,  slug: 'google',      name: 'Google',           country: 'US', website: 'https://deepmind.google',          logoColor: '#4285F4' },
  { id: 4,  slug: 'meta',        name: 'Meta',             country: 'US', website: 'https://ai.meta.com',              logoColor: '#0866FF' },
  { id: 5,  slug: 'mistral',     name: 'Mistral',          country: 'FR', website: 'https://mistral.ai',               logoColor: '#FF7000' },
  { id: 6,  slug: 'deepseek',    name: 'DeepSeek',         country: 'CN', website: 'https://deepseek.com',             logoColor: '#1E90FF' },
  { id: 7,  slug: 'xai',         name: 'xAI',              country: 'US', website: 'https://x.ai',                    logoColor: '#1DA1F2' },
  { id: 8,  slug: 'cohere',      name: 'Cohere',           country: 'CA', website: 'https://cohere.com',               logoColor: '#39594D' },
  { id: 9,  slug: 'microsoft',   name: 'Microsoft',        country: 'US', website: 'https://microsoft.com',            logoColor: '#00A4EF' },
  { id: 10, slug: 'alibaba',     name: 'Alibaba',          country: 'CN', website: 'https://qwen.aliyun.com',          logoColor: '#FF6A00' },
  { id: 11, slug: 'stability',   name: 'Stability AI',     country: 'UK', website: 'https://stability.ai',             logoColor: '#9B59B6' },
  { id: 12, slug: 'blackforest', name: 'Black Forest Labs', country: 'DE', website: 'https://blackforestlabs.ai',      logoColor: '#2C3E50' },
  { id: 13, slug: 'github',      name: 'GitHub',           country: 'US', website: 'https://github.com/features/copilot', logoColor: '#24292E' },
  { id: 14, slug: 'anysphere',   name: 'Anysphere',        country: 'US', website: 'https://cursor.sh',               logoColor: '#1A1A1A' },
  { id: 15, slug: 'codeium',     name: 'Codeium',          country: 'US', website: 'https://codeium.com',              logoColor: '#09B6A2' },
  { id: 16, slug: 'replit',      name: 'Replit',           country: 'US', website: 'https://replit.com',               logoColor: '#F26207' },
  { id: 17, slug: 'exafunction', name: 'Exafunction',      country: 'US', website: 'https://windsurf.com',             logoColor: '#5C6BC0' },
];

// ============================================================
// Static data — benchmarks
// ============================================================

export const mockBenchmarks: Benchmark[] = [
  { id: 1, categoryId: 1, slug: 'mmlu',           name: 'MMLU',           scale: 100,  unit: '%',          description: '57개 학문 분야 5지선다' },
  { id: 2, categoryId: 1, slug: 'humaneval',      name: 'HumanEval',      scale: 100,  unit: '%',          description: 'Python 코딩 pass@1' },
  { id: 3, categoryId: 1, slug: 'gpqa',           name: 'GPQA Diamond',   scale: 100,  unit: '%',          description: '전문가 수준 과학 다지선다' },
  { id: 4, categoryId: 1, slug: 'arena_elo',      name: 'Arena Elo',      scale: null, unit: 'Elo pts',    description: 'LMSYS Chatbot Arena Elo' },
  { id: 5, categoryId: 1, slug: 'price_input',    name: 'Input Price',    scale: null, unit: '$/M tokens', description: '입력 토큰 1M당 USD' },
  { id: 6, categoryId: 1, slug: 'price_output',   name: 'Output Price',   scale: null, unit: '$/M tokens', description: '출력 토큰 1M당 USD' },
  { id: 7, categoryId: 1, slug: 'context_window', name: 'Context Window', scale: null, unit: 'K tokens',   description: '최대 컨텍스트 (K)' },
  { id: 8, categoryId: 1, slug: 'speed_tps',      name: 'Speed',          scale: null, unit: 'tokens/s',   description: '출력 속도 중앙값' },
];

// ============================================================
// Static data — models (30개)
// LLM 20 + 이미지 5 + 코딩 5
// 가격·벤치마크: 공개 정보 기반 합리적 추정 (2026-05-28)
// ============================================================

export const mockModels: Model[] = [

  // ----------------------------------------------------------
  // OpenAI LLMs
  // ----------------------------------------------------------
  {
    id: 1,
    categoryId: 1,
    slug: 'gpt-5',
    name: 'GPT-5',
    providerSlug: 'openai',
    status: 'published',
    releasedAt: '2025-05-20',
    summary: 'OpenAI의 플래그십 멀티모달 모델. 추론·코딩·비전 전 영역 최상위 성능.',
    attrs: { modality: ['text', 'image', 'code'], priceInput: 15.0, priceOutput: 60.0, contextWindow: 128, openSource: false, apiAvailable: true },
    scores: { mmlu: 92.0, humaneval: 93.5, gpqa: 82.0, arenaElo: 1380, priceInput: 15.0, priceOutput: 60.0, contextWindow: 128, speedTps: 65 },
    source: { url: 'https://openai.com/gpt-5', type: 'official', confidence: 'T1', verifiedAt: '2026-05-20' },
  },
  {
    id: 2,
    categoryId: 1,
    slug: 'gpt-4o',
    name: 'GPT-4o',
    providerSlug: 'openai',
    status: 'published',
    releasedAt: '2024-05-13',
    summary: '멀티모달(텍스트+비전+오디오) 통합 모델. 빠른 응답과 저렴한 가격.',
    attrs: { modality: ['text', 'image', 'audio', 'code'], priceInput: 2.5, priceOutput: 10.0, contextWindow: 128, openSource: false, apiAvailable: true },
    scores: { mmlu: 88.7, humaneval: 90.2, gpqa: 53.6, arenaElo: 1287, priceInput: 2.5, priceOutput: 10.0, contextWindow: 128, speedTps: 110 },
    source: { url: 'https://openai.com/blog/hello-gpt-4o', type: 'official', confidence: 'T1', verifiedAt: '2026-05-01' },
  },
  {
    id: 3,
    categoryId: 1,
    slug: 'gpt-4o-mini',
    name: 'GPT-4o mini',
    providerSlug: 'openai',
    status: 'published',
    releasedAt: '2024-07-18',
    summary: '비용 최적화 경량 모델. 대량 처리와 단순 태스크에 최적.',
    attrs: { modality: ['text', 'image', 'code'], priceInput: 0.15, priceOutput: 0.6, contextWindow: 128, openSource: false, apiAvailable: true },
    scores: { mmlu: 82.0, humaneval: 87.2, gpqa: 40.2, arenaElo: 1206, priceInput: 0.15, priceOutput: 0.6, contextWindow: 128, speedTps: 180 },
    source: { url: 'https://openai.com/blog/gpt-4o-mini-advancing-cost-efficient-intelligence', type: 'official', confidence: 'T1', verifiedAt: '2026-05-01' },
  },
  {
    id: 4,
    categoryId: 1,
    slug: 'o1',
    name: 'o1',
    providerSlug: 'openai',
    status: 'published',
    releasedAt: '2024-12-05',
    summary: '체인-오브-소트 강화학습 추론 특화 모델. 수학·과학·코딩 복잡 문제에 강함.',
    attrs: { modality: ['text', 'code'], priceInput: 15.0, priceOutput: 60.0, contextWindow: 200, openSource: false, apiAvailable: true },
    scores: { mmlu: 91.8, humaneval: 92.4, gpqa: 78.3, arenaElo: 1350, priceInput: 15.0, priceOutput: 60.0, contextWindow: 200, speedTps: 45 },
    source: { url: 'https://openai.com/o1', type: 'official', confidence: 'T1', verifiedAt: '2026-05-01' },
  },

  // ----------------------------------------------------------
  // Anthropic LLMs
  // ----------------------------------------------------------
  {
    id: 5,
    categoryId: 1,
    slug: 'claude-opus-4-7',
    name: 'Claude Opus 4.7',
    providerSlug: 'anthropic',
    status: 'published',
    releasedAt: '2026-05-20',
    summary: 'Anthropic 최상위 모델. 장문 추론, 코딩, 학술 분석에 탁월.',
    attrs: { modality: ['text', 'code'], priceInput: 15.0, priceOutput: 75.0, contextWindow: 200, openSource: false, apiAvailable: true },
    scores: { mmlu: 91.5, humaneval: 92.0, gpqa: 80.5, arenaElo: 1360, priceInput: 15.0, priceOutput: 75.0, contextWindow: 200, speedTps: 55 },
    source: { url: 'https://anthropic.com/claude/opus', type: 'official', confidence: 'T1', verifiedAt: '2026-05-20' },
  },
  {
    id: 6,
    categoryId: 1,
    slug: 'claude-sonnet-4-6',
    name: 'Claude Sonnet 4.6',
    providerSlug: 'anthropic',
    status: 'published',
    releasedAt: '2026-03-10',
    summary: '성능과 속도의 균형. 일반 작업·코딩·긴 문서 처리에 최적.',
    attrs: { modality: ['text', 'code'], priceInput: 3.0, priceOutput: 15.0, contextWindow: 200, openSource: false, apiAvailable: true },
    scores: { mmlu: 88.3, humaneval: 89.0, gpqa: 68.0, arenaElo: 1290, priceInput: 3.0, priceOutput: 15.0, contextWindow: 200, speedTps: 100 },
    source: { url: 'https://anthropic.com/claude', type: 'official', confidence: 'T1', verifiedAt: '2026-05-10' },
  },
  {
    id: 7,
    categoryId: 1,
    slug: 'claude-haiku-4-5',
    name: 'Claude Haiku 4.5',
    providerSlug: 'anthropic',
    status: 'published',
    releasedAt: '2026-01-15',
    summary: 'Anthropic 최경량·최고속 모델. 실시간 응답과 대량 배치에 적합.',
    attrs: { modality: ['text', 'code'], priceInput: 0.8, priceOutput: 4.0, contextWindow: 200, openSource: false, apiAvailable: true },
    scores: { mmlu: 79.0, humaneval: 80.5, gpqa: 45.0, arenaElo: 1190, priceInput: 0.8, priceOutput: 4.0, contextWindow: 200, speedTps: 220 },
    source: { url: 'https://anthropic.com/claude', type: 'official', confidence: 'T1', verifiedAt: '2026-05-10' },
  },

  // ----------------------------------------------------------
  // Google LLMs
  // ----------------------------------------------------------
  {
    id: 8,
    categoryId: 1,
    slug: 'gemini-2-0-flash',
    name: 'Gemini 2.0 Flash',
    providerSlug: 'google',
    status: 'published',
    releasedAt: '2025-02-05',
    summary: '구글의 고속·저비용 멀티모달 모델. 1M 컨텍스트 지원.',
    attrs: { modality: ['text', 'image', 'audio', 'code'], priceInput: 0.1, priceOutput: 0.4, contextWindow: 1000, openSource: false, apiAvailable: true },
    scores: { mmlu: 83.0, humaneval: 85.0, gpqa: 62.0, arenaElo: 1240, priceInput: 0.1, priceOutput: 0.4, contextWindow: 1000, speedTps: 200 },
    source: { url: 'https://ai.google.dev/gemini-api/docs/models/gemini', type: 'official', confidence: 'T1', verifiedAt: '2026-05-01' },
  },
  {
    id: 9,
    categoryId: 1,
    slug: 'gemini-2-0-pro',
    name: 'Gemini 2.0 Pro',
    providerSlug: 'google',
    status: 'published',
    releasedAt: '2025-03-10',
    summary: '구글 플래그십 멀티모달. 2M 컨텍스트, 복잡한 분석·코딩에 강함.',
    attrs: { modality: ['text', 'image', 'audio', 'code'], priceInput: 1.25, priceOutput: 5.0, contextWindow: 2000, openSource: false, apiAvailable: true },
    scores: { mmlu: 90.0, humaneval: 88.0, gpqa: 72.0, arenaElo: 1310, priceInput: 1.25, priceOutput: 5.0, contextWindow: 2000, speedTps: 90 },
    source: { url: 'https://ai.google.dev/gemini-api/docs/models/gemini', type: 'official', confidence: 'T1', verifiedAt: '2026-05-01' },
  },

  // ----------------------------------------------------------
  // Meta LLMs
  // ----------------------------------------------------------
  {
    id: 10,
    categoryId: 1,
    slug: 'llama-3-3-70b',
    name: 'Llama 3.3 70B',
    providerSlug: 'meta',
    status: 'published',
    releasedAt: '2024-12-06',
    summary: 'Meta 오픈소스 70B 모델. 자체 호스팅 가능, 비용 효율 최상.',
    attrs: { modality: ['text', 'code'], priceInput: 0.23, priceOutput: 0.4, contextWindow: 128, openSource: true, apiAvailable: true },
    scores: { mmlu: 86.0, humaneval: 88.4, gpqa: 50.5, arenaElo: 1256, priceInput: 0.23, priceOutput: 0.4, contextWindow: 128, speedTps: 85 },
    source: { url: 'https://llama.meta.com/', type: 'official', confidence: 'T1', verifiedAt: '2026-04-15' },
  },
  {
    id: 11,
    categoryId: 1,
    slug: 'llama-3-1-405b',
    name: 'Llama 3.1 405B',
    providerSlug: 'meta',
    status: 'published',
    releasedAt: '2024-07-23',
    summary: 'Meta 최대 오픈소스 모델. GPT-4급 성능, 완전 오픈 가중치.',
    attrs: { modality: ['text', 'code'], priceInput: 5.0, priceOutput: 15.0, contextWindow: 128, openSource: true, apiAvailable: true },
    scores: { mmlu: 88.6, humaneval: 89.0, gpqa: 51.1, arenaElo: 1267, priceInput: 5.0, priceOutput: 15.0, contextWindow: 128, speedTps: 30 },
    source: { url: 'https://llama.meta.com/', type: 'official', confidence: 'T1', verifiedAt: '2026-03-01' },
  },

  // ----------------------------------------------------------
  // Mistral LLMs
  // ----------------------------------------------------------
  {
    id: 12,
    categoryId: 1,
    slug: 'mistral-large-2',
    name: 'Mistral Large 2',
    providerSlug: 'mistral',
    status: 'published',
    releasedAt: '2024-07-24',
    summary: 'Mistral 플래그십 123B. 유럽산 최고 성능, 멀티링구얼 강점.',
    attrs: { modality: ['text', 'code'], priceInput: 2.0, priceOutput: 6.0, contextWindow: 128, openSource: false, apiAvailable: true },
    scores: { mmlu: 84.0, humaneval: 92.0, gpqa: 49.0, arenaElo: 1247, priceInput: 2.0, priceOutput: 6.0, contextWindow: 128, speedTps: 60 },
    source: { url: 'https://mistral.ai/news/mistral-large-2407/', type: 'official', confidence: 'T1', verifiedAt: '2026-04-01' },
  },
  {
    id: 13,
    categoryId: 1,
    slug: 'mixtral-8x22b',
    name: 'Mixtral 8x22B',
    providerSlug: 'mistral',
    status: 'published',
    releasedAt: '2024-04-17',
    summary: 'Mixture-of-Experts 오픈소스. 141B 파라미터 중 39B 활성화, 비용 대비 고성능.',
    attrs: { modality: ['text', 'code'], priceInput: 1.2, priceOutput: 1.2, contextWindow: 64, openSource: true, apiAvailable: true },
    scores: { mmlu: 77.8, humaneval: 75.0, gpqa: 35.0, arenaElo: 1151, priceInput: 1.2, priceOutput: 1.2, contextWindow: 64, speedTps: 70 },
    source: { url: 'https://mistral.ai/news/mixtral-8x22b/', type: 'official', confidence: 'T1', verifiedAt: '2026-03-01' },
  },

  // ----------------------------------------------------------
  // DeepSeek LLMs
  // ----------------------------------------------------------
  {
    id: 14,
    categoryId: 1,
    slug: 'deepseek-v3',
    name: 'DeepSeek V3',
    providerSlug: 'deepseek',
    status: 'published',
    releasedAt: '2024-12-26',
    summary: '685B MoE 오픈소스. 비용 대비 SOTA급 성능, 한국어·영어·중국어 강함.',
    attrs: { modality: ['text', 'code'], priceInput: 0.27, priceOutput: 1.1, contextWindow: 128, openSource: true, apiAvailable: true },
    scores: { mmlu: 88.5, humaneval: 91.6, gpqa: 59.1, arenaElo: 1300, priceInput: 0.27, priceOutput: 1.1, contextWindow: 128, speedTps: 55 },
    source: { url: 'https://api-docs.deepseek.com/', type: 'official', confidence: 'T1', verifiedAt: '2026-05-01' },
  },
  {
    id: 15,
    categoryId: 1,
    slug: 'deepseek-r1',
    name: 'DeepSeek R1',
    providerSlug: 'deepseek',
    status: 'published',
    releasedAt: '2025-01-20',
    summary: '오픈소스 추론 특화. o1과 동급 추론 성능, MIT 라이선스.',
    attrs: { modality: ['text', 'code'], priceInput: 0.55, priceOutput: 2.19, contextWindow: 128, openSource: true, apiAvailable: true },
    scores: { mmlu: 90.8, humaneval: 92.6, gpqa: 71.5, arenaElo: 1320, priceInput: 0.55, priceOutput: 2.19, contextWindow: 128, speedTps: 40 },
    source: { url: 'https://api-docs.deepseek.com/', type: 'official', confidence: 'T1', verifiedAt: '2026-05-01' },
  },

  // ----------------------------------------------------------
  // xAI LLMs
  // ----------------------------------------------------------
  {
    id: 16,
    categoryId: 1,
    slug: 'grok-2',
    name: 'Grok 2',
    providerSlug: 'xai',
    status: 'published',
    releasedAt: '2024-08-14',
    summary: 'xAI 플래그십. 실시간 X(트위터) 데이터 접근, 유머·코딩 특화.',
    attrs: { modality: ['text', 'image', 'code'], priceInput: 2.0, priceOutput: 10.0, contextWindow: 128, openSource: false, apiAvailable: true },
    scores: { mmlu: 87.5, humaneval: 88.0, gpqa: 56.0, arenaElo: 1282, priceInput: 2.0, priceOutput: 10.0, contextWindow: 128, speedTps: 90 },
    source: { url: 'https://x.ai/api', type: 'official', confidence: 'T1', verifiedAt: '2026-04-01' },
  },
  {
    id: 17,
    categoryId: 1,
    slug: 'grok-3',
    name: 'Grok 3',
    providerSlug: 'xai',
    status: 'published',
    releasedAt: '2025-02-17',
    summary: 'xAI 차세대 모델. 추론 강화 "Think" 모드 내장, 수학·코딩 개선.',
    attrs: { modality: ['text', 'image', 'code'], priceInput: 3.0, priceOutput: 15.0, contextWindow: 128, openSource: false, apiAvailable: true },
    scores: { mmlu: 90.0, humaneval: 91.0, gpqa: 68.0, arenaElo: 1340, priceInput: 3.0, priceOutput: 15.0, contextWindow: 128, speedTps: 75 },
    source: { url: 'https://x.ai/api', type: 'official', confidence: 'T1', verifiedAt: '2026-05-01' },
  },

  // ----------------------------------------------------------
  // Cohere LLMs
  // ----------------------------------------------------------
  {
    id: 18,
    categoryId: 1,
    slug: 'command-r-plus',
    name: 'Command R+',
    providerSlug: 'cohere',
    status: 'published',
    releasedAt: '2024-04-04',
    summary: 'RAG·엔터프라이즈 특화. 멀티스텝 RAG, 10개 언어 지원.',
    attrs: { modality: ['text', 'code'], priceInput: 2.5, priceOutput: 10.0, contextWindow: 128, openSource: false, apiAvailable: true },
    scores: { mmlu: 75.7, humaneval: 74.0, gpqa: 38.0, arenaElo: 1150, priceInput: 2.5, priceOutput: 10.0, contextWindow: 128, speedTps: 80 },
    source: { url: 'https://cohere.com/blog/command-r-plus-microsoft-azure', type: 'official', confidence: 'T1', verifiedAt: '2026-03-01' },
  },

  // ----------------------------------------------------------
  // Alibaba LLMs
  // ----------------------------------------------------------
  {
    id: 19,
    categoryId: 1,
    slug: 'qwen-2-5-72b',
    name: 'Qwen 2.5 72B',
    providerSlug: 'alibaba',
    status: 'published',
    releasedAt: '2024-09-19',
    summary: '알리바바 오픈소스 72B. 수학·코딩 강화, 128K 컨텍스트.',
    attrs: { modality: ['text', 'code'], priceInput: 0.35, priceOutput: 0.4, contextWindow: 128, openSource: true, apiAvailable: true },
    scores: { mmlu: 85.0, humaneval: 86.5, gpqa: 49.0, arenaElo: 1230, priceInput: 0.35, priceOutput: 0.4, contextWindow: 128, speedTps: 75 },
    source: { url: 'https://qwenlm.github.io/blog/qwen2.5/', type: 'official', confidence: 'T1', verifiedAt: '2026-03-01' },
  },

  // ----------------------------------------------------------
  // Microsoft LLMs
  // ----------------------------------------------------------
  {
    id: 20,
    categoryId: 1,
    slug: 'phi-4',
    name: 'Phi-4',
    providerSlug: 'microsoft',
    status: 'published',
    releasedAt: '2024-12-12',
    summary: 'Microsoft 14B 소형 모델. 수학·추론 특화, 엣지/온디바이스 적합.',
    attrs: { modality: ['text', 'code'], priceInput: 0.07, priceOutput: 0.14, contextWindow: 16, openSource: true, apiAvailable: true },
    scores: { mmlu: 84.8, humaneval: 82.6, gpqa: 56.1, arenaElo: 1195, priceInput: 0.07, priceOutput: 0.14, contextWindow: 16, speedTps: 160 },
    source: { url: 'https://azure.microsoft.com/en-us/blog/phi-4-microsofts-newest-small-language-model-specializing-in-complex-reasoning/', type: 'official', confidence: 'T1', verifiedAt: '2026-04-01' },
  },

  // ----------------------------------------------------------
  // Image Generation (5개)
  // ----------------------------------------------------------
  {
    id: 21,
    categoryId: 1,
    slug: 'gpt-image-1',
    name: 'GPT-image-1',
    providerSlug: 'openai',
    status: 'published',
    releasedAt: '2025-04-23',
    summary: 'OpenAI 최신 이미지 생성 모델. 텍스트 렌더링 정확도와 세밀한 지시 이행 강화.',
    attrs: { modality: ['image'], priceInput: null, priceOutput: null, contextWindow: null, openSource: false, apiAvailable: true },
    scores: {},
    source: { url: 'https://openai.com/index/gpt-image-1', type: 'official', confidence: 'T1', verifiedAt: '2026-05-01' },
  },
  {
    id: 22,
    categoryId: 1,
    slug: 'dall-e-3',
    name: 'DALL-E 3',
    providerSlug: 'openai',
    status: 'published',
    releasedAt: '2023-10-02',
    summary: 'ChatGPT 통합 이미지 생성. 프롬프트 이해력·스타일 다양성 우수.',
    attrs: { modality: ['image'], priceInput: null, priceOutput: null, contextWindow: null, openSource: false, apiAvailable: true },
    scores: {},
    source: { url: 'https://openai.com/dall-e-3', type: 'official', confidence: 'T1', verifiedAt: '2026-03-01' },
  },
  {
    id: 23,
    categoryId: 1,
    slug: 'imagen-3',
    name: 'Imagen 3',
    providerSlug: 'google',
    status: 'published',
    releasedAt: '2024-08-13',
    summary: 'Google 포토리얼리스틱 이미지 생성. 세밀한 디테일과 조명 표현이 강점.',
    attrs: { modality: ['image'], priceInput: null, priceOutput: null, contextWindow: null, openSource: false, apiAvailable: true },
    scores: {},
    source: { url: 'https://deepmind.google/technologies/imagen-3/', type: 'official', confidence: 'T1', verifiedAt: '2026-04-01' },
  },
  {
    id: 24,
    categoryId: 1,
    slug: 'stable-diffusion-3-5',
    name: 'Stable Diffusion 3.5',
    providerSlug: 'stability',
    status: 'published',
    releasedAt: '2024-10-22',
    summary: '오픈소스 이미지 생성 표준. 자체 호스팅 가능, 파인튜닝 생태계 최대.',
    attrs: { modality: ['image'], priceInput: null, priceOutput: null, contextWindow: null, openSource: true, apiAvailable: true },
    scores: {},
    source: { url: 'https://stability.ai/news/introducing-stable-diffusion-3-5', type: 'official', confidence: 'T1', verifiedAt: '2026-04-01' },
  },
  {
    id: 25,
    categoryId: 1,
    slug: 'flux-pro',
    name: 'FLUX.1 Pro',
    providerSlug: 'blackforest',
    status: 'published',
    releasedAt: '2024-08-01',
    summary: 'Black Forest Labs 플래그십. 포토리얼리즘·텍스트 정확도 업계 최상위.',
    attrs: { modality: ['image'], priceInput: null, priceOutput: null, contextWindow: null, openSource: false, apiAvailable: true },
    scores: {},
    source: { url: 'https://blackforestlabs.ai/#get-flux', type: 'official', confidence: 'T1', verifiedAt: '2026-05-01' },
  },

  // ----------------------------------------------------------
  // AI Coding Tools (5개)
  // ----------------------------------------------------------
  {
    id: 26,
    categoryId: 1,
    slug: 'github-copilot',
    name: 'GitHub Copilot',
    providerSlug: 'github',
    status: 'published',
    releasedAt: '2022-06-21',
    summary: 'IDE 통합 AI 코딩 어시스턴트 표준. VSCode·JetBrains·Neovim 지원.',
    attrs: { modality: ['code', 'text'], priceInput: null, priceOutput: null, contextWindow: null, openSource: false, apiAvailable: false },
    scores: { humaneval: 46.3 },
    source: { url: 'https://github.com/features/copilot', type: 'official', confidence: 'T1', verifiedAt: '2026-05-01' },
  },
  {
    id: 27,
    categoryId: 1,
    slug: 'cursor',
    name: 'Cursor',
    providerSlug: 'anysphere',
    status: 'published',
    releasedAt: '2023-03-14',
    summary: 'AI-first 코드 에디터. GPT-4/Claude 멀티모델 백엔드, 코드베이스 컨텍스트 이해.',
    attrs: { modality: ['code', 'text'], priceInput: null, priceOutput: null, contextWindow: null, openSource: false, apiAvailable: false },
    scores: {},
    source: { url: 'https://cursor.sh', type: 'official', confidence: 'T1', verifiedAt: '2026-05-01' },
  },
  {
    id: 28,
    categoryId: 1,
    slug: 'codeium',
    name: 'Codeium',
    providerSlug: 'codeium',
    status: 'published',
    releasedAt: '2022-12-01',
    summary: '무료 AI 코딩 자동완성. 70개 이상 언어, 엔터프라이즈 온프레미스 지원.',
    attrs: { modality: ['code'], priceInput: null, priceOutput: null, contextWindow: null, openSource: false, apiAvailable: false },
    scores: {},
    source: { url: 'https://codeium.com', type: 'official', confidence: 'T1', verifiedAt: '2026-04-01' },
  },
  {
    id: 29,
    categoryId: 1,
    slug: 'replit-ai',
    name: 'Replit AI',
    providerSlug: 'replit',
    status: 'published',
    releasedAt: '2023-05-10',
    summary: '클라우드 IDE 통합 AI. 브라우저 내 즉시 실행, 초보자·교육에 최적.',
    attrs: { modality: ['code', 'text'], priceInput: null, priceOutput: null, contextWindow: null, openSource: false, apiAvailable: false },
    scores: {},
    source: { url: 'https://replit.com/ai', type: 'official', confidence: 'T1', verifiedAt: '2026-04-01' },
  },
  {
    id: 30,
    categoryId: 1,
    slug: 'windsurf',
    name: 'Windsurf',
    providerSlug: 'exafunction',
    status: 'published',
    releasedAt: '2024-11-13',
    summary: 'Codeium 팀의 AI-native 에디터. Cascade 에이전트 모드로 멀티파일 편집.',
    attrs: { modality: ['code', 'text'], priceInput: null, priceOutput: null, contextWindow: null, openSource: false, apiAvailable: false },
    scores: {},
    source: { url: 'https://windsurf.com', type: 'official', confidence: 'T1', verifiedAt: '2026-05-01' },
  },
];

// ============================================================
// Changelog — 최근 변경 5건 (가상 이벤트, 합리적 추정)
// ============================================================

export const mockChangelog: ChangelogEntry[] = [
  {
    id: 1,
    entitySlug: 'gpt-5',
    field: 'attrs.priceInput',
    oldValue: 30.0,
    newValue: 15.0,
    changedAt: '2026-05-15T09:00:00Z',
    changedBy: 'admin@tier.gg',
  },
  {
    id: 2,
    entitySlug: 'claude-opus-4-7',
    field: 'status',
    oldValue: 'review',
    newValue: 'published',
    changedAt: '2026-05-20T00:00:00Z',
    changedBy: 'admin@tier.gg',
  },
  {
    id: 3,
    entitySlug: 'deepseek-r1',
    field: 'scores.arenaElo',
    oldValue: 1298,
    newValue: 1320,
    changedAt: '2026-05-10T14:30:00Z',
    changedBy: 'crawler@tier.gg',
  },
  {
    id: 4,
    entitySlug: 'gemini-2-0-flash',
    field: 'attrs.priceInput',
    oldValue: 0.075,
    newValue: 0.1,
    changedAt: '2026-05-05T00:00:00Z',
    changedBy: 'admin@tier.gg',
  },
  {
    id: 5,
    entitySlug: 'grok-3',
    field: 'scores.mmlu',
    oldValue: 88.7,
    newValue: 90.0,
    changedAt: '2026-04-28T11:00:00Z',
    changedBy: 'crawler@tier.gg',
  },
];

// ============================================================
// Popular pairs — 비교 페이지 SSG 우선 대상
// ============================================================

export const mockPopularPairs: [string, string][] = [
  ['gpt-5',           'claude-opus-4-7'],
  ['gpt-4o',          'claude-sonnet-4-6'],
  ['deepseek-r1',     'o1'],
  ['gemini-2-0-flash','gpt-4o-mini'],
];

// ============================================================
// Helper functions
// ============================================================

/** slug로 단일 모델 조회 */
export function getMockModelBySlug(slug: string): Model | undefined {
  return mockModels.find((m) => m.slug === slug);
}

/** 모든 프로바이더 반환 */
export function getMockProviders(): Provider[] {
  return mockProviders;
}

/** 모든 벤치마크 정의 반환 */
export function getMockBenchmarks(): Benchmark[] {
  return mockBenchmarks;
}

/** providerSlug로 해당 프로바이더의 모델 필터링 */
export function getMockModelsByProvider(providerSlug: string): Model[] {
  return mockModels.filter((m) => m.providerSlug === providerSlug && m.status === 'published');
}

/** 특정 benchmark slug 기준 내림차순 정렬 (상위 N개) */
export function getMockLeaderboard(
  benchmarkSlug: keyof ModelScores,
  limit = 10,
): Model[] {
  return [...mockModels]
    .filter((m) => m.status === 'published' && m.scores[benchmarkSlug] != null)
    .sort((a, b) => (b.scores[benchmarkSlug] ?? 0) - (a.scores[benchmarkSlug] ?? 0))
    .slice(0, limit);
}
