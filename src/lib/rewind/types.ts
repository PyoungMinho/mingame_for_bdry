/**
 * 인생 2회차 (/rewind) — 스토리·시장 스키마.
 *
 * 콘텐츠(src/lib/rewind/content/*)는 이 타입으로만 쓴다. 시세·세율 등 숫자는 콘텐츠에 직접 쓰지 않고
 * 시장 데이터(MarketData — 2차 감사 verified-data.json 에서 생성)만 참조한다.
 */

// ─────────────────────────────── 기본 ───────────────────────────────

/** 가족 신뢰 · 행복 · 건강 · 수상함 (0~100) */
export type StatKey = 'trust' | 'happy' | 'health' | 'sus';

export type Gender = 'm' | 'f';

/** 매매 가능한 자산. 현금(예금)과 부채는 별도 필드. */
export type AssetId = 'samsung' | 'btc' | 'aapl' | 'nvda' | 'tsla' | 'apt' | 'gold' | 'usd';

export type ChapterId = 1 | 2 | 3 | 4 | 5 | 6 | 7;

/** 투자자 유형 태그 — 엔딩 공유 카드 */
export type TraitTag = 'hodl' | 'trader' | 'estate' | 'family' | 'safe' | 'yolo' | 'honest' | 'sly';

export type SceneId = string;
export type EndingId = string;

// ─────────────────────────────── 조건 · 효과 ───────────────────────────────

export interface Condition {
  flags?: string[];
  noFlags?: string[];
  min?: Partial<Record<StatKey, number>>;
  max?: Partial<Record<StatKey, number>>;
  gender?: Gender;
  /** 민법상 성년 여부(2013년부터) */
  adult?: boolean;
  /** 이 자산을 1단위라도 보유 */
  holding?: AssetId[];
  noHolding?: AssetId[];
  /** 현금(원) 이상/이하 */
  minCash?: number;
  maxCash?: number;
  /** 순자산(원, 현재 기준가) 이상/이하 */
  minNetWorth?: number;
  maxNetWorth?: number;
}

export type Para = string | { when: Condition; text: string };

/**
 * 매매. at 은 시장 데이터 EVENTS 의 id — 스토리 속 "순간 매매"는 반드시 사건 시점 가격으로 체결한다.
 * at 이 없으면 현재 연도의 직전 결산가(연말가)로 체결한다.
 */
export type Trade =
  | { kind: 'buy'; asset: AssetId; krw?: number; pct?: number; at?: string }
  | { kind: 'sell'; asset: AssetId; pct: number; at?: string };

/** 성년 명의 이전 방식 — 부모 명의로 굴린 자산을 어떻게 가져오나 */
export type TransferMode = 'declare' | 'keep' | 'hide';

export interface Effect {
  trust?: number;
  happy?: number;
  health?: number;
  sus?: number;
  /** 평범한 현금 흐름(용돈·세뱃돈·알바·월급·지출). "원래 인생" 비교선에도 똑같이 반영된다. */
  cash?: number;
  /** 요행·베팅 수익(토토·로또 당첨금 등). 실제 자산에만 반영(비교선에는 없음). */
  windfall?: number;
  /** 부채 증감(원) */
  debt?: number;
  trades?: Trade[];
  /** 해킹·파산·몰수 등으로 보유분 일부 소실 */
  lose?: { asset: AssetId; pct: number }[];
  /** 매년 결산 때 들어오는 저축(원/년). null 이면 중단. */
  income?: { perYear: number; label: string } | null;
  transfer?: TransferMode;
  /** 스포츠토토 베팅 — 판돈은 요행 계정에서 나가고, 적중이면 (당첨금 − 판돈)에 세금을 떼고 들어온다 */
  bet?: { stake: number; odds: number; won: boolean };
  setFlags?: string[];
  clearFlags?: string[];
}

/** 위에서부터 평가 — when 거짓이면 skip, chance 실패면 skip, 마지막은 무조건 폴백 */
export interface Outcome {
  when?: Condition;
  chance?: number;
  effects?: Effect;
  result: Para[];
  /** 다음 노드 id 또는 "end" (2026 엔딩 정산으로) */
  next: string;
}

export interface Choice {
  id: string;
  label: string;
  hint?: string;
  requires?: Condition;
  lockedHint?: string;
  tags?: TraitTag[];
  outcomes: Outcome[];
}

export type AlertKind = 'news' | 'sms' | 'call' | 'chat' | 'ticker';

export interface Alert {
  kind: AlertKind;
  from?: string;
  text: string;
}

export interface StoryNode {
  id: string;
  chapter: ChapterId;
  /** YYYY-MM — 연도가 넘어가면 그 사이 연말 결산이 먼저 열린다 */
  date: string;
  scene: SceneId;
  title: string;
  alert?: Alert;
  body: Para[];
  choices: Choice[];
}

export interface EndingVariant {
  when: Condition;
  title?: string;
  body: Para[];
  epitaph?: string;
}

/** 인생 결말. 위에서부터 첫 번째로 조건이 맞는 결말이 선택된다(마지막은 조건 없는 기본 결말). */
export interface Ending {
  id: EndingId;
  when?: Condition;
  title: string;
  scene: SceneId;
  body: Para[];
  epitaph: string;
  variants?: EndingVariant[];
}

// ─────────────────────────────── 시장 데이터 ───────────────────────────────

export interface PricePoint {
  /** 1단위 원화 가격 (주식 1주, BTC 1개, 아파트 1채, 금 1돈, 달러 1달러) */
  krw: number;
  /** 달러 자산이면 원가격 */
  usd?: number;
  /** 원천값이 없어 환산·추정한 값 */
  estimated?: boolean;
  src: string;
}

export interface YearData {
  year: number;
  /** 연말 원/달러 */
  fx: number;
  /** 1년 정기예금 금리(%) */
  depositRate: number;
  /** 한국은행 기준금리(%) — 부채 이자의 기준 */
  baseRate: number;
  /** 연말 가격. 없으면 그해엔 존재하지 않음(미상장·미탄생) */
  prices: Partial<Record<AssetId, PricePoint>>;
}

export interface MarketEvent {
  id: string;
  date: string;
  label: string;
  prices: Partial<Record<AssetId, PricePoint>>;
}

/** 연도 구간 규칙 — from 연도부터 다음 항목 전까지 적용 */
export interface YearRate {
  from: number;
  rate: number;
}

export interface GiftTaxBracket {
  /** 과세표준 상한(원). 마지막 구간은 Infinity */
  upTo: number;
  rate: number;
  /** 누진공제(원) */
  deduction: number;
}

export interface MarketRules {
  /** 국내주식 매매 수수료율(매수·매도 각각) */
  feeDomestic: YearRate[];
  /** 국내주식 매도 거래세율 */
  txTaxDomestic: YearRate[];
  /** 해외주식 매매 수수료율 */
  feeOverseas: YearRate[];
  /** 해외주식 양도세: from 연도부터, 연간 공제 후 세율 */
  overseasGainTax: { from: number; rate: number; deduction: number };
  /** 코인 거래 수수료율 */
  feeCrypto: YearRate[];
  /** 금 실물 매수 시 부가세 등 추가 비용률 — 이 연도 전까지 */
  goldRetailCostUntil: number;
  goldRetailCost: number;
  /** 주택담보대출 LTV (0~1) — 연도별 게임 단순 기준 */
  ltv: YearRate[];
  /** 시가가 price 를 넘는 주택은 주담대 금지 (from 연도 이상, until 연도 미만) */
  loanBanAbove: { from: number; until: number; price: number }[];
  /** 주담대 금액 상한(원) — from 연도부터 */
  loanCap: { from: number; max: number }[];
  /** 주택 취득세율(게임 단순 기준) */
  aptAcquisitionTax: YearRate[];
  /** 증여세 누진 구간 */
  giftTax: GiftTaxBracket[];
  /** 증여재산공제 — from 연도부터 [미성년, 성년] */
  giftDeduction: { from: number; minor: number; adult: number }[];
  /** 부정 무신고 가산세율 — 증여가 일어난 연도 기준 */
  penaltyFraud: YearRate[];
  /** 증여세 자진신고 세액공제율 */
  giftReportCredit: YearRate[];
  /** 토토 당첨소득 세율 — (당첨금 − 구입액)이 과세최저한을 넘을 때 */
  totoTax: { rate: number; floor: number };
  /** 납부지연 가산세(일 이율) — from 연도부터 */
  lateDaily: YearRate[];
  /** 부채 이자 = 기준금리 + 이 가산(%p) — 게임 단순화 */
  loanSpread: number;
  /** 해외주식 거래 가능 시작 연도, 국내 코인 거래소 시작 연도, 민법상 성년이 되는 연도 */
  overseasFrom: number;
  cryptoDomesticFrom: number;
  adultYear: number;
}

export interface MarketData {
  years: Record<number, YearData>;
  /** 엔딩 정산 기준일 가격 */
  final: { date: string; fx: number; prices: Record<AssetId, PricePoint> };
  events: Record<string, MarketEvent>;
  rules: MarketRules;
}
