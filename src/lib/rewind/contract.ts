/**
 * 인생 2회차 — 레지스트리·게임 상수 (단일 출처).
 * 여기 있는 숫자는 "게임 규칙"(임계값·확률)이지 현실 시세가 아니다. 현실 수치는 전부 MarketData.
 */
import type { AssetId, ChapterId, StatKey, TraitTag } from './types';

export const STAT_META: Record<StatKey, { label: string }> = {
  trust: { label: '가족 신뢰' },
  happy: { label: '행복' },
  health: { label: '건강' },
  sus: { label: '수상함' },
};

export const START_STATS: Record<StatKey, number> = { trust: 60, happy: 60, health: 85, sus: 0 };

export const ASSETS: Record<AssetId, { name: string; unit: string; kind: 'domestic' | 'overseas' | 'crypto' | 'real' | 'gold' | 'fx'; short: string }> = {
  samsung: { name: '삼성전자', unit: '주', kind: 'domestic', short: '삼성' },
  aapl: { name: '애플', unit: '주', kind: 'overseas', short: '애플' },
  nvda: { name: '엔비디아', unit: '주', kind: 'overseas', short: '엔비' },
  tsla: { name: '테슬라', unit: '주', kind: 'overseas', short: '테슬라' },
  btc: { name: '비트코인', unit: 'BTC', kind: 'crypto', short: 'BTC' },
  apt: { name: '대치 은마 76㎡', unit: '채', kind: 'real', short: '은마' },
  gold: { name: '금', unit: '돈', kind: 'gold', short: '금' },
  usd: { name: '달러', unit: '달러', kind: 'fx', short: '달러' },
};

export const ASSET_IDS = Object.keys(ASSETS) as AssetId[];

export const CHAPTERS: Record<ChapterId, { name: string; years: string }> = {
  1: { name: '여덟 살의 서른셋', years: '2000~2002' },
  2: { name: '인생역전의 시대', years: '2003~2007' },
  3: { name: '바닥을 아는 자', years: '2008~2012' },
  4: { name: '어른의 명의', years: '2013~2016' },
  5: { name: '광풍', years: '2017~2019' },
  6: { name: '영끌의 시대', years: '2020~2022' },
  7: { name: '2회차의 끝', years: '2023~2026' },
};

export const START_YEAR = 2000;
/** 엔딩 정산 전 마지막 연말 결산 연도 */
export const LAST_SETTLE_YEAR = 2025;

// ─────────────────────────────── 게임 규칙 ───────────────────────────────

/** 미성년일 때 부모 명의 매매에 필요한 가족 신뢰 (아파트는 더 높음) */
export const PARENT_TRUST = 35;
export const PARENT_TRUST_APT = 60;

/** 수상함 자동 상승: 한 해 순이익이 전년 순자산의 이 비율을 넘고 이 금액 이상이면 */
export const SUS_GAIN_RATIO = 0.5;
export const SUS_GAIN_MIN = 30_000_000;
/** 수상함 단계 — 넘을 때 플래그가 켜진다(sus40/sus70/sus90) */
export const SUS_STEPS = [40, 70, 90] as const;
/** 세무조사 발동 */
export const AUDIT_SUS = 90;
/** 차명(hide) 자산 보유 시 매년 세무조사 확률(2015년부터) */
export const AUDIT_HIDDEN_CHANCE = 0.2;
export const AUDIT_HIDDEN_FROM = 2015;
/** 조사 후 수상함 */
export const SUS_AFTER_AUDIT = 30;
/** 무혐의라도 드는 세무 대리 비용(순자산 대비) — 게임 단순화 */
export const AUDIT_CLEAN_COST = 0.005;
/** 세무 대리 비용 상한(원) — 수임료가 순자산에 끝없이 비례하지는 않는다(게임 규칙) */
export const AUDIT_CLEAN_COST_MAX = 300_000_000;

/**
 * 시장 한도(게임 규칙 — 역사 수치가 아니다): 한 사람이 시장을 통째로 사는 걸 막는다.
 * 한 해에 한 자산을 살 수 있는 최대 금액(원). 이야기 속 순간 매매와 연말 결산 매매가 한도를 함께 쓴다.
 */
export const BUY_CAP_KRW = 100_000_000_000;
/** 초창기 비트코인은 시장 자체가 작았다 — until 년까지는 한 해 최대 qty 개 */
export const BTC_EARLY_CAP = { until: 2012, qty: 1_000 };
/** 아파트는 한 해 1채까지 */
export const APT_PER_YEAR = 1;

/** 미성년 기간 신뢰가 낮으면 부모가 몰래 판다 */
export const SECRET_SALE_TRUST = 30;
export const SECRET_SALE_CHANCE = 0.35;
export const SECRET_SALE_PCT = 0.5;
/** 몰래 판 돈 중 가계(빚)로 사라지는 비율 */
export const SECRET_SALE_TAKEN = 0.7;
/** 미성년의 이 금액 이하 부족분은 부모 명의 주식을 팔지 않고 엄마가 먼저 내 준다(자잘한 빚 → 결산 때 갚음) */
export const MINOR_PETTY_SPEND = 10_000;
/**
 * 이야기 속 매매의 최소 체결액 — max(금액, 순자산 × 비율). 못 미치면 그 결과는 고를 수 없다
 * (결과 문단은 "결심한 매매"를 전제로 쓰였다. 커피값 체결에 손이 떨리는 장면이 붙지 않게).
 */
export const MIN_STORY_TRADE = { krw: 10_000, ofNetWorth: 0.0001 };

// ─────────────────────────────── 결과 ───────────────────────────────

/** 순자산 티어 — 위에서부터 첫 매치. apt: 은마(대치동)를 실제로 가졌을 때만 */
export const TIERS: { min: number; title: string; line: string; apt?: boolean }[] = [
  { min: 1_000_000_000_000, title: '한국 최고의 부자', line: '조(兆) 단위. 2회차가 아니라 치트키였다.' },
  { min: 100_000_000_000, title: '천억 클럽', line: '뉴스에 이름이 나오기 시작하는 숫자.' },
  { min: 10_000_000_000, title: '백억대 자산가', line: '건물 하나쯤은 농담이 아닌 숫자.' },
  { min: 1_000_000_000, title: '강남 입성', line: '미래를 아는 값은 했다.', apt: true },
  { min: 1_000_000_000, title: '십억대 자산가', line: '숫자로는 입성했다. 집은 아직이다.' },
  { min: 100_000_000, title: '내 집 마련 직전', line: '1회차보다는 확실히 낫다.' },
  { min: 0, title: '평범한 서른셋', line: '미래를 알아도 인생은 어렵다.' },
  { min: -Infinity, title: '빚더미', line: '알던 미래가 발목을 잡았다.' },
];

export const TRAITS: Record<TraitTag, { title: string; line: string }> = {
  hodl: { title: '존버의 신', line: '사고 나서 잊었다. 그게 정답이었다.' },
  trader: { title: '타이밍의 귀재', line: '고점과 저점 사이를 춤추듯 건넜다.' },
  estate: { title: '부동산 불패', line: '결국 땅이다. 한국인의 DNA.' },
  family: { title: '가족이 먼저', line: '돈보다 저녁 식탁을 먼저 챙겼다.' },
  safe: { title: '안전제일 예금러', line: '미래를 알아도 원금은 소중하다.' },
  yolo: { title: '영끌 몰빵러', line: '인생은 한 방. 두 번째 인생이니까.' },
  honest: { title: '정직한 납세자', line: '세금은 냈다. 떳떳하게.' },
  sly: { title: '차명의 달인', line: '들키지만 않으면… 들키지만 않으면.' },
};

// ─────────────────────────────── 씬 ───────────────────────────────

/** 씬 아트 id (src/app/rewind/scenes 의 레퍼런스 + 그룹 a~f) — 콘텐츠는 이 중에서만 고른다 */
export const SCENE_IDS = [
  'crt_living',
  'classroom_2000',
  'pc_bang',
  'worldcup_2002',
  'lotto_shop',
  'cyworld_room',
  'stock_floor',
  'model_house',
  'yeouido_crash',
  'school_night',
  'suneung_gate',
  'campus',
  'barracks',
  'oneroom_coin',
  'alphago',
  'hangang_night',
  'coin_frenzy',
  'office_job',
  'covid_street',
  'apt_night',
  'ai_boom',
  'penthouse',
  'family_table',
  'tax_office',
  'hospital_room',
] as const;

/** 엔진이 스스로 켜는 플래그 — audited: 세무조사를 한 번이라도 받음, audit_penalty: 조사에서 추징당함(차명 적발), gift_tax_paid: 증여세를 실제로 냄 */
export const ENGINE_FLAG_PATTERNS = [/^sus(40|70|90)$/, /^audited(_\d{4})?$/, /^audit_penalty$/, /^secret_sale_\d{4}$/, /^gift_tax_paid$/];
/** 결산이 끝날 때 남은 현금으로 자동으로 갚는 자잘한 빚(원) — 몇 원짜리 부채가 영원히 이자를 무는 일 방지 */
export const PETTY_DEBT = 10_000_000;
