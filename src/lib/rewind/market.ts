/**
 * 인생 2회차 — 시장 모듈 (순수 함수, React 비의존).
 *
 * 모든 현실 수치(시세·세율·수수료·금리)는 주입된 MarketData 에서만 읽는다.
 * 여기서 정하는 것은 게임 규칙(접근 조건, 결산 순서, 세무조사 계산식)뿐이다.
 */
import {
  ASSET_IDS,
  ASSETS,
  AUDIT_CLEAN_COST,
  AUDIT_CLEAN_COST_MAX,
  AUDIT_HIDDEN_CHANCE,
  AUDIT_HIDDEN_FROM,
  APT_PER_YEAR,
  AUDIT_SUS,
  BTC_EARLY_CAP,
  BUY_CAP_KRW,
  MINOR_PETTY_SPEND,
  PARENT_TRUST,
  PARENT_TRUST_APT,
  SECRET_SALE_CHANCE,
  SECRET_SALE_PCT,
  SECRET_SALE_TAKEN,
  SECRET_SALE_TRUST,
  SUS_AFTER_AUDIT,
  SUS_GAIN_MIN,
  SUS_GAIN_RATIO,
} from './contract';
import type { AssetId, MarketData, PricePoint, TransferMode, YearRate } from './types';

export type Qty = Record<AssetId, number>;

export interface Wallet {
  /** 진행 중인 연도(아직 결산 전) */
  year: number;
  cash: number;
  debt: number;
  qty: Qty;
  /** 보유분 총 매입원가(원) — 평균단가·해외주식 양도세 */
  cost: Qty;
  /** 자산별 마지막으로 본 시세(원) — 평가·HUD */
  mark: Qty;
  /** 연도별 해외주식 실현손익(원) */
  realizedOverseas: Record<number, number>;
  income: { perYear: number; label: string } | null;
  /** 같은 현금 흐름을 예금에만 뒀다면 — "원래 인생" 비교선 */
  baseline: number;
  /** 이번 해 평범한 현금 흐름 합계(수상함 계산에서 제외) */
  yearFlows: number;
  /** 성년 전 매수분이 부모 명의인가 */
  underParent: boolean;
  /** 몰래(차명) 가져온 금액과 그 연도 */
  hiddenGift: number;
  hiddenSince: number | null;
  /** 직전 결산 순자산 */
  lastNetWorth: number;
  history: { year: number; netWorth: number; baseline: number }[];
  /** 연초(직전 결산을 마친 뒤) 현금 — 예금 이자는 한 해 내내 있던 돈에만 붙는다 */
  cashStart?: number;
  /** 연초 부채 — 연중에 늘어난 부채는 첫해 이자를 반년 치만 */
  debtStart?: number;
  /** 성년이 된 순간 부모 명의였던 것 — 명의 이전은 이것만(성년 뒤 내 명의로 번 돈·산 자산은 빼고) */
  parentSnap?: { qty: Qty; cash: number; debt: number };
  /** 시장 한도 — 그해 자산별로 이미 산 금액(원)·수량 */
  bought?: { year: number; krw: Partial<Qty>; qty: Partial<Qty> };
}

export const zeroQty = (): Qty => ({ samsung: 0, btc: 0, aapl: 0, nvda: 0, tsla: 0, apt: 0, gold: 0, usd: 0 });

export function newWallet(startYear: number): Wallet {
  return {
    year: startYear,
    cash: 0,
    debt: 0,
    qty: zeroQty(),
    cost: zeroQty(),
    mark: zeroQty(),
    realizedOverseas: {},
    income: null,
    baseline: 0,
    yearFlows: 0,
    underParent: true,
    hiddenGift: 0,
    hiddenSince: null,
    lastNetWorth: 0,
    history: [],
  };
}

// ─────────────────────────────── 조회 ───────────────────────────────

export function rateAt(table: YearRate[], year: number): number {
  let r = table[0]?.rate ?? 0;
  for (const t of table) if (t.from <= year) r = t.rate;
  return r;
}

export type PriceRef = { year: number } | { event: string } | 'final';

export function priceOf(data: MarketData, asset: AssetId, at: PriceRef): PricePoint | null {
  if (at === 'final') return data.final.prices[asset] ?? null;
  if ('event' in at) return data.events[at.event]?.prices[asset] ?? null;
  return data.years[at.year]?.prices[asset] ?? null;
}

export function holdingsValue(w: Wallet): number {
  let v = 0;
  for (const a of ASSET_IDS) v += w.qty[a] * w.mark[a];
  return v;
}

export function netWorth(w: Wallet): number {
  return Math.round(w.cash + holdingsValue(w) - w.debt);
}

export function isAdult(year: number, data: MarketData): boolean {
  return year >= data.rules.adultYear;
}

// ─────────────────────────────── 접근 규칙 ───────────────────────────────

export interface AccessCtx {
  year: number;
  trust: number;
  flags: string[];
}

export type Access = { ok: true; via: 'self' | 'parent' } | { ok: false; reason: string };

/** 그해 이 자산을 살 수 있는가 — 나이·제도·가족 신뢰 */
export function access(data: MarketData, ctx: AccessCtx, asset: AssetId, at: PriceRef = { year: ctx.year }): Access {
  if (!priceOf(data, asset, at)) return { ok: false, reason: `${ASSETS[asset].name}은(는) 아직 시장에 없다` };
  const r = data.rules;
  const kind = ASSETS[asset].kind;
  if (kind === 'overseas' && ctx.year < r.overseasFrom) return { ok: false, reason: '해외주식을 살 길이 아직 없다' };
  if (kind === 'crypto' && ctx.year < r.cryptoDomesticFrom && !ctx.flags.includes('btc_overseas')) {
    return { ok: false, reason: '국내 거래소가 아직 없다 — 해외 거래소 길을 뚫어야 한다' };
  }
  if (isAdult(ctx.year, data)) return { ok: true, via: 'self' };
  const need = asset === 'apt' ? PARENT_TRUST_APT : PARENT_TRUST;
  if (ctx.trust < need) return { ok: false, reason: `미성년자 — 부모님 명의가 필요한데 신뢰가 부족하다(${need} 필요)` };
  return { ok: true, via: 'parent' };
}

// ─────────────────────────────── 매매 단위(주식 분할) ───────────────────────────────

/**
 * 시세는 모두 오늘 기준 수정주가라, 분할 전에는 "1주" 가 수정주가 여러 개다(2차 감사 검증값).
 * 그 시절엔 1주 단위로만 살 수 있었다 — 삼성전자 2018-05-04 50:1(samsung.split.2018-05-04),
 * 애플·엔비디아·테슬라는 분할일(aapl/nvda/tsla.split.*) 이후 분할 배수만큼이 1주.
 * 해외주식 소수점 거래는 2018-10(overseas_stock.fractional_first)부터.
 */
export const SPLITS: Partial<Record<AssetId, { date: string; ratio: number }[]>> = {
  samsung: [{ date: '2018-05-04', ratio: 50 }],
  aapl: [
    { date: '2000-06-21', ratio: 2 },
    { date: '2005-02-28', ratio: 2 },
    { date: '2014-06-09', ratio: 7 },
    { date: '2020-08-31', ratio: 4 },
  ],
  nvda: [
    { date: '2000-06-27', ratio: 2 },
    { date: '2001-09-17', ratio: 2 },
    { date: '2006-04-07', ratio: 2 },
    { date: '2007-09-11', ratio: 1.5 },
    { date: '2021-07-20', ratio: 4 },
    { date: '2024-06-10', ratio: 10 },
  ],
  tsla: [
    { date: '2020-08-31', ratio: 5 },
    { date: '2022-08-25', ratio: 3 },
  ],
};
export const OVERSEAS_FRACTIONAL_FROM = '2018-10-15';

/** date(YYYY-MM[-DD]) 에 살 수 있는 최소 단위(수정주가 기준 수량). 0 이면 소수점 가능 */
export function lotSize(asset: AssetId, date: string): number {
  const d = date.length === 7 ? `${date}-15` : date;
  const splits = SPLITS[asset];
  if (!splits) return asset === 'apt' ? 1 : 0;
  if (ASSETS[asset].kind === 'overseas' && d >= OVERSEAS_FRACTIONAL_FROM) return 0;
  return splits.filter((x) => x.date > d).reduce((m, x) => m * x.ratio, 1);
}

/** 결산(연말) 매매의 날짜 */
export const yearEndDate = (year: number) => `${year}-12-31`;

// ─────────────────────────────── 매매 ───────────────────────────────

export interface TradeReceipt {
  asset: AssetId;
  side: 'buy' | 'sell';
  qty: number;
  price: number;
  gross: number;
  fee: number;
  tax: number;
  /** 아파트 매수 시 대출 */
  loan: number;
  ok: boolean;
  reason?: string;
  /** 시장 한도로 일부만 체결 */
  capped?: boolean;
  /** 분할 전 1주 = 수정주가 몇 개(1 보다 클 때만) — 표시용 */
  lot?: number;
}

function tradeFeeRate(data: MarketData, asset: AssetId, year: number, side: 'buy' | 'sell'): number {
  const r = data.rules;
  switch (ASSETS[asset].kind) {
    case 'domestic':
      return rateAt(r.feeDomestic, year);
    case 'overseas':
      return rateAt(r.feeOverseas, year);
    case 'crypto':
      return rateAt(r.feeCrypto, year);
    case 'gold':
      return side === 'buy' && year < r.goldRetailCostUntil ? r.goldRetailCost : 0;
    default:
      return 0;
  }
}

const fail = (asset: AssetId, side: 'buy' | 'sell', reason: string): TradeReceipt => ({
  asset,
  side,
  qty: 0,
  price: 0,
  gross: 0,
  fee: 0,
  tax: 0,
  loan: 0,
  ok: false,
  reason,
});

/** 주담대 가능 금액 — LTV × 시가, 고가주택 대출 금지 기간이면 0, 금액 상한 적용 */
export function aptLoan(data: MarketData, price: number, year: number): number {
  const r = data.rules;
  if (r.loanBanAbove.some((b) => year >= b.from && year < b.until && price > b.price)) return 0;
  let loan = price * rateAt(r.ltv, year);
  let cap = Infinity;
  for (const c of r.loanCap) if (c.from <= year) cap = c.max;
  loan = Math.min(loan, cap);
  return Math.round(loan);
}

/** 그해 이 자산을 더 살 수 있는 한도 — 금액(원)과 수량 */
export function buyRoom(w: Wallet, asset: AssetId, year: number): { krw: number; qty: number } {
  const b = w.bought && w.bought.year === year ? w.bought : null;
  let krw = Math.max(0, BUY_CAP_KRW - (b?.krw[asset] ?? 0));
  let qty = Infinity;
  if (asset === 'apt') qty = Math.max(0, APT_PER_YEAR - (b?.qty.apt ?? 0));
  if (asset === 'btc' && year <= BTC_EARLY_CAP.until) qty = Math.max(0, BTC_EARLY_CAP.qty - (b?.qty.btc ?? 0));
  if (krw < 1) krw = 0;
  if (qty < 1e-6) qty = 0; // 부동소수 잔여
  return { krw, qty };
}

function track(w: Wallet, asset: AssetId, year: number, krw: number, qty: number): Wallet['bought'] {
  const b = w.bought && w.bought.year === year ? w.bought : { year, krw: {}, qty: {} };
  return { year, krw: { ...b.krw, [asset]: (b.krw[asset] ?? 0) + krw }, qty: { ...b.qty, [asset]: (b.qty[asset] ?? 0) + qty } };
}

/**
 * krw 만큼 산다(아파트는 1채 단위, 대출 포함). 체결가는 price. 시장 한도를 넘는 부분은 체결되지 않는다.
 * date 가 있으면 그날의 매매 단위(분할 전 1주)로 내림한다.
 */
export function buy(data: MarketData, w: Wallet, asset: AssetId, krw: number, price: number, year: number, date?: string): { wallet: Wallet; receipt: TradeReceipt } {
  if (!(price > 0)) return { wallet: w, receipt: fail(asset, 'buy', '가격 없음') };
  const room = buyRoom(w, asset, year);
  if (room.krw <= 0 || room.qty <= 0) {
    return { wallet: w, receipt: fail(asset, 'buy', asset === 'apt' ? '아파트는 한 해에 한 채까지다' : '올해 이 자산의 시장 한도를 다 썼다(게임 규칙)') };
  }
  if (asset === 'apt') {
    const acq = price * rateAt(data.rules.aptAcquisitionTax, year);
    const loan = aptLoan(data, price, year);
    const need = price - loan + acq;
    if (w.cash < need) return { wallet: w, receipt: fail(asset, 'buy', `현금이 부족하다(${Math.round(need).toLocaleString()}원 필요)`) };
    const next: Wallet = {
      ...w,
      cash: w.cash - need,
      debt: w.debt + loan,
      qty: { ...w.qty, apt: w.qty.apt + 1 },
      cost: { ...w.cost, apt: w.cost.apt + price + acq },
      mark: { ...w.mark, apt: price },
      bought: track(w, 'apt', year, price, 1),
    };
    return { wallet: next, receipt: { asset, side: 'buy', qty: 1, price, gross: price, fee: 0, tax: acq, loan, ok: true } };
  }
  const want = Math.min(Math.max(0, krw), w.cash);
  if (want <= 0) return { wallet: w, receipt: fail(asset, 'buy', '살 돈이 없다') };
  const feeRate = tradeFeeRate(data, asset, year, 'buy');
  const qtyRoomKrw = Number.isFinite(room.qty) ? (room.qty * price) / (1 - feeRate) : Infinity;
  let spend = Math.min(want, room.krw, qtyRoomKrw);
  const capped = spend < want - 0.5;
  let q = (spend * (1 - feeRate)) / price;
  const lot = date ? lotSize(asset, date) : 0;
  if (lot > 0) {
    q = Math.floor(q / lot + 1e-9) * lot;
    if (q <= 0) {
      const one = Math.round((price * lot) / (1 - feeRate));
      return { wallet: w, receipt: fail(asset, 'buy', `${Math.floor(spend).toLocaleString()}원으로는 1주(${feeRate > 0 ? '수수료 포함 ' : ''}${one.toLocaleString()}원)도 살 수 없다`) };
    }
    spend = (q * price) / (1 - feeRate);
  }
  const fee = spend * feeRate;
  const next: Wallet = {
    ...w,
    cash: w.cash - spend,
    qty: { ...w.qty, [asset]: w.qty[asset] + q },
    cost: { ...w.cost, [asset]: w.cost[asset] + spend },
    mark: { ...w.mark, [asset]: price },
    bought: track(w, asset, year, spend, q),
  };
  return { wallet: next, receipt: { asset, side: 'buy', qty: q, price, gross: spend - fee, fee, tax: 0, loan: 0, ok: true, ...(capped ? { capped } : {}), ...(lot > 1 ? { lot } : {}) } };
}

/** 보유분의 pct(0~1)를 판다. 아파트는 1채 단위, 판 돈으로 대출부터 갚는다. date 가 있으면 1주 단위로 내림. */
export function sell(data: MarketData, w: Wallet, asset: AssetId, pct: number, price: number, year: number, date?: string): { wallet: Wallet; receipt: TradeReceipt } {
  const held = w.qty[asset];
  if (!(held > 0)) return { wallet: w, receipt: fail(asset, 'sell', `팔 ${ASSETS[asset].name}이(가) 없다`) };
  if (!(price > 0)) return { wallet: w, receipt: fail(asset, 'sell', '가격 없음') };
  let q = held * Math.min(1, Math.max(0, pct));
  if (asset === 'apt') q = Math.max(1, Math.round(q));
  const lot = date && asset !== 'apt' ? lotSize(asset, date) : 0;
  if (lot > 0 && pct < 1) {
    q = Math.floor(q / lot + 1e-9) * lot;
    if (q <= 0) q = Math.min(held, lot);
  }
  if (q <= 0) return { wallet: w, receipt: fail(asset, 'sell', '팔 수량이 없다') };
  q = Math.min(q, held);
  const gross = q * price;
  const fee = gross * tradeFeeRate(data, asset, year, 'sell');
  const tx = ASSETS[asset].kind === 'domestic' ? gross * rateAt(data.rules.txTaxDomestic, year) : 0;
  const basis = w.cost[asset] * (q / held);
  const realizedOverseas = { ...w.realizedOverseas };
  if (ASSETS[asset].kind === 'overseas') realizedOverseas[year] = (realizedOverseas[year] ?? 0) + (gross - fee - basis);
  let cash = w.cash + gross - fee - tx;
  let debt = w.debt;
  if (asset === 'apt' && debt > 0) {
    const repay = Math.min(debt, cash);
    cash -= repay;
    debt -= repay;
  }
  const remain = held - q;
  const next: Wallet = {
    ...w,
    cash,
    debt,
    qty: { ...w.qty, [asset]: remain < 1e-12 ? 0 : remain },
    cost: { ...w.cost, [asset]: remain < 1e-12 ? 0 : w.cost[asset] - basis },
    mark: { ...w.mark, [asset]: price },
    realizedOverseas,
  };
  return { wallet: next, receipt: { asset, side: 'sell', qty: q, price, gross, fee, tax: tx, loan: 0, ok: true, ...(lot > 1 ? { lot } : {}) } };
}

/**
 * 현금이 모자랄 때 보유 자산을 팔아 amount 를 마련한다. 매매 단위(분할 전 1주)를 지켜 필요한 만큼 올림해 판다 —
 * 달러부터, 그다음 잘게 팔 수 있는 것(1주 값이 작은 것)부터, 같으면 많이 가진 것부터(되도록 한 자산만 건드린다).
 * 아파트는 팔지 않는다 — 모자란 돈은 부채로 남기고(pay), 부채가 집값의 LTV 를 크게 넘을 때만 한 채씩 판다.
 * date 는 매매 단위를 정하는 날(이야기 장면 날짜, 없으면 그해 연말).
 */
export function raiseCash(data: MarketData, w: Wallet, amount: number, year: number, date: string = yearEndDate(year)): Wallet {
  let cur = w;
  const lotValue = (a: AssetId) => (a === 'usd' ? -1 : lotSize(a, date) * cur.mark[a]);
  const order = ASSET_IDS.filter((a) => a !== 'apt' && cur.qty[a] > 0 && cur.mark[a] > 0).sort(
    (a, b) => lotValue(a) - lotValue(b) || cur.qty[b] * cur.mark[b] - cur.qty[a] * cur.mark[a],
  );
  for (const a of order) {
    const lot = lotSize(a, date);
    const tx = ASSETS[a].kind === 'domestic' ? rateAt(data.rules.txTaxDomestic, year) : 0;
    const net = cur.mark[a] * (1 - tradeFeeRate(data, a, year, 'sell') - tx);
    for (let round = 0; round < 3 && cur.cash < amount && cur.qty[a] > 0; round++) {
      const held = cur.qty[a];
      let q = ((amount - cur.cash) / net) * (1 + 1e-9);
      if (lot > 0) q = Math.ceil(q / lot - 1e-9) * lot;
      cur = sell(data, cur, a, q >= held ? 1 : q / held, cur.mark[a], year, date).wallet;
    }
    if (cur.cash >= amount) break;
  }
  return cur;
}

/** 부채가 아파트 시가 × 0.8 을 넘으면(담보 부족) 한 채씩 판다 — 은행이 가만두지 않는다 */
function foreclose(data: MarketData, w: Wallet, year: number): Wallet {
  let cur = w;
  while (cur.qty.apt > 0 && cur.debt > cur.qty.apt * cur.mark.apt * 0.8) {
    cur = sell(data, cur, 'apt', 1 / cur.qty.apt, cur.mark.apt, year).wallet;
  }
  return cur;
}

export function pay(data: MarketData, w: Wallet, amount: number, year: number, date?: string): Wallet {
  if (amount <= 0) return w;
  // 미성년의 몇천 원짜리 지출로 부모 명의 주식을 팔지는 않는다 — 엄마가 먼저 내 주고(자잘한 빚) 결산 때 갚는다
  const petty = w.underParent && !isAdult(year, data) && amount - w.cash <= MINOR_PETTY_SPEND;
  const cur = petty ? w : raiseCash(data, w, amount, year, date);
  if (cur.cash >= amount - 1) return { ...cur, cash: Math.max(0, cur.cash - amount) }; // 1원 미만 부동소수 오차는 부채로 만들지 않는다
  return foreclose(data, { ...cur, debt: Math.round(cur.debt + (amount - cur.cash)), cash: 0 }, year);
}

/** 강제 매도 내역 — pay 전후 보유 수량 차이 */
export function soldBetween(before: Qty, after: Qty): { asset: AssetId; qty: number }[] {
  return ASSET_IDS.filter((a) => after[a] < before[a] - 1e-12).map((a) => ({ asset: a, qty: before[a] - after[a] }));
}

// ─────────────────────────────── 세금 ───────────────────────────────

/** 토토 적중 세후 수령액 — (당첨금 − 구입액)이 과세최저한을 넘으면 세율만큼 원천징수 */
export function totoPayout(data: MarketData, stake: number, odds: number): { payout: number; tax: number } {
  const payout = Math.round(stake * odds);
  const gain = payout - stake;
  const tax = gain > data.rules.totoTax.floor ? Math.round(gain * data.rules.totoTax.rate) : 0;
  return { payout: payout - tax, tax };
}

export function giftTax(data: MarketData, taxable: number): number {
  if (taxable <= 0) return 0;
  for (const b of data.rules.giftTax) {
    if (taxable <= b.upTo) return Math.max(0, Math.round(taxable * b.rate - b.deduction));
  }
  return 0;
}

export function giftDeduction(data: MarketData, year: number, adult: boolean): number {
  let d = data.rules.giftDeduction[0];
  for (const x of data.rules.giftDeduction) if (x.from <= year) d = x;
  return d ? (adult ? d.adult : d.minor) : 0;
}

export interface TransferReport {
  mode: TransferMode;
  value: number;
  tax: number;
}

/** 성년이 되는 순간의 부모 명의 몫을 기록한다(한 번만) — 이후 내 명의로 번 돈·산 자산은 명의 이전 대상이 아니다 */
export function snapParent(data: MarketData, w: Wallet, year: number): Wallet {
  if (!w.underParent || w.parentSnap || !isAdult(year, data)) return w;
  return { ...w, parentSnap: { qty: { ...w.qty }, cash: w.cash, debt: w.debt } };
}

/** 성년 명의 이전 — 부모 명의로 굴린 자산(성년이 된 순간 몫, 그 뒤 판 만큼은 빠진다)을 지금 시세로 */
export function transfer(data: MarketData, w: Wallet, mode: TransferMode, year: number): { wallet: Wallet; report: TransferReport } {
  // 부모 명의로 굴린 것(예금·자산)에서 딸린 대출을 뺀 값(부담부증여)
  const snap = w.parentSnap;
  const value = snap
    ? Math.max(0, Math.round(ASSET_IDS.reduce((m, a) => m + Math.min(snap.qty[a], w.qty[a]) * w.mark[a], 0) + Math.min(snap.cash, w.cash) - Math.min(snap.debt, w.debt)))
    : Math.max(0, Math.round(w.cash + holdingsValue(w) - w.debt));
  if (!w.underParent) return { wallet: w, report: { mode, value: 0, tax: 0 } };
  if (mode === 'declare') {
    const gross = giftTax(data, value - giftDeduction(data, year, true));
    const tax = Math.round(gross * (1 - rateAt(data.rules.giftReportCredit, year)));
    const paid = pay(data, { ...w, underParent: false }, tax, year);
    return { wallet: paid, report: { mode, value, tax } };
  }
  if (mode === 'hide') {
    return { wallet: { ...w, underParent: false, hiddenGift: value, hiddenSince: year }, report: { mode, value, tax: 0 } };
  }
  return { wallet: w, report: { mode, value, tax: 0 } };
}

export interface AuditReport {
  trigger: 'suspicion' | 'hidden';
  found: number;
  tax: number;
  penalty: number;
  late: number;
  total: number;
  clean: boolean;
}

/** 세무조사 — 차명 자산이 있으면 증여세 + 부정 무신고 가산세 + 납부지연 가산세, 없으면 대리 비용만 */
export function taxAudit(data: MarketData, w: Wallet, year: number, trigger: AuditReport['trigger']): { wallet: Wallet; report: AuditReport } {
  const since = w.hiddenSince ?? year;
  const owed = w.hiddenGift > 0 ? giftTax(data, w.hiddenGift - giftDeduction(data, since, true)) : 0;
  if (owed > 0) {
    const tax = owed;
    const penalty = Math.round(tax * rateAt(data.rules.penaltyFraud, since));
    const days = Math.max(0, year - since) * 365;
    const late = Math.round(tax * rateAt(data.rules.lateDaily, year) * days);
    const total = tax + penalty + late;
    const paid = pay(data, w, total, year);
    return {
      wallet: { ...paid, hiddenGift: 0, hiddenSince: null },
      report: { trigger, found: w.hiddenGift, tax, penalty, late, total, clean: false },
    };
  }
  // 차명이 없거나, 드러났어도 증여재산공제 안이라 낼 세금이 없다 — 세무 대리 비용만
  const cost = Math.max(0, Math.min(AUDIT_CLEAN_COST_MAX, Math.round(netWorth(w) * AUDIT_CLEAN_COST)));
  const found = w.hiddenGift;
  return {
    wallet: { ...pay(data, w, cost, year), hiddenGift: 0, hiddenSince: null },
    report: { trigger, found, tax: 0, penalty: 0, late: 0, total: cost, clean: true },
  };
}

// ─────────────────────────────── 연말 결산 ───────────────────────────────

export interface SettleReport {
  year: number;
  interest: number;
  income: number;
  debtInterest: number;
  overseasTax: number;
  netWorthBefore: number;
  netWorth: number;
  gain: number;
  susDelta: number;
  secretSale: { sold: number; taken: number } | null;
  audit: AuditReport | null;
  /** 이자·세금을 낼 현금이 없어 강제로 판 자산 */
  forced: { asset: AssetId; qty: number }[];
}

export interface SettleCtx {
  trust: number;
  sus: number;
  /** 0~1 난수 두 개(부모 몰래 매도, 차명 조사) — 엔진이 시드로 만든다 */
  rolls: [number, number];
}

/**
 * year 의 연말 결산(자동 부분). 매매는 이 뒤 UI 에서 같은 해 연말가로 한다.
 * 순서: 이자·저축 → 연말가 평가 → 부채 이자 → 작년 해외주식 양도세(5월 신고분) → 부모 몰래 매도 → 수상함 → 세무조사 → 기록
 */
export function settleYear(data: MarketData, w0: Wallet, year: number, ctx: SettleCtx): { wallet: Wallet; report: SettleReport; sus: number } {
  const y = data.years[year];
  if (!y) throw new Error(`시장 데이터에 ${year}년이 없다`);
  let w = { ...w0 };
  const before = w0.lastNetWorth;

  // 1) 예금 이자 + 연간 저축 (비교선도 같은 흐름) — 이자는 한 해 내내 있던 현금(연초 현금과 지금 현금 중 적은 쪽)에만
  const held = Math.max(0, Math.min(w.cash, w.cashStart ?? w.cash));
  const interest = held > 0 ? Math.round((held * y.depositRate) / 100) : 0;
  const income = w.income?.perYear ?? 0;
  w.cash += interest + income;
  w.baseline = Math.round(Math.max(0, w.baseline) * (1 + y.depositRate / 100) + income);
  const flows = w.yearFlows + income;

  // 2) 연말가 평가 — 이자·세금 때문에 파는 일이 생기면 올해 연말가로
  const mark = { ...w.mark };
  for (const a of ASSET_IDS) {
    const p = y.prices[a];
    if (p) mark[a] = p.krw;
  }
  w.mark = mark;
  const qtyBefore = w.qty;

  // 3) 부채 이자 — 연초부터 있던 부채는 1년 치, 연중에 늘어난 부채는 반년 치
  const debtHeld = Math.min(w.debt, w.debtStart ?? w.debt);
  const debtInterest = w.debt > 0 ? Math.round(((debtHeld + (w.debt - debtHeld) * 0.5) * (y.baseRate + data.rules.loanSpread)) / 100) : 0;
  if (debtInterest > 0) w = pay(data, w, debtInterest, year);

  // 4) 해외주식 양도세 — 작년 실현손익분(이듬해 5월 신고·납부). 작년 연말 결산 매도까지 포함된다
  const overseasTax = overseasGainTax(data, w.realizedOverseas[year - 1] ?? 0, year - 1);
  if (overseasTax > 0) w = pay(data, w, overseasTax, year);

  // 5) 미성년 + 낮은 신뢰 → 부모 몰래 매도
  let secretSale: SettleReport['secretSale'] = null;
  if (w.underParent && ctx.trust < SECRET_SALE_TRUST && ctx.rolls[0] < SECRET_SALE_CHANCE) {
    const cashBefore = w.cash;
    const date = yearEndDate(year);
    for (const a of ASSET_IDS) {
      if (a === 'apt' || !(w.qty[a] > 0)) continue;
      // 1주 단위로 판다 — 이미 소수 주로 남은 보유분(예전 저장본)만 비율 그대로
      const lot = lotSize(a, date);
      const aligned = lot <= 1 || Math.abs(w.qty[a] / lot - Math.round(w.qty[a] / lot)) < 1e-6;
      w = sell(data, w, a, SECRET_SALE_PCT, w.mark[a], year, aligned ? date : undefined).wallet;
    }
    const sold = w.cash - cashBefore;
    if (sold > 0) {
      const taken = Math.round(sold * SECRET_SALE_TAKEN);
      w.cash -= taken;
      secretSale = { sold, taken };
    }
  }

  // 6) 수상함 — 평범한 현금 흐름을 뺀 순이익이 비정상이면
  const nwMid = netWorth(w);
  const gain = nwMid - before - flows;
  let susDelta = 0;
  if (gain > SUS_GAIN_MIN && gain > Math.max(before, 1_000_000) * SUS_GAIN_RATIO) {
    susDelta = Math.min(25, Math.max(5, Math.round(5 + 6 * Math.log10(gain / SUS_GAIN_MIN))));
  }
  let sus = Math.min(100, ctx.sus + susDelta);

  // 7) 세무조사
  let audit: AuditReport | null = null;
  const hiddenHit = w.hiddenGift > 0 && year >= AUDIT_HIDDEN_FROM && ctx.rolls[1] < AUDIT_HIDDEN_CHANCE;
  if (sus >= AUDIT_SUS || hiddenHit) {
    const r = taxAudit(data, w, year, sus >= AUDIT_SUS ? 'suspicion' : 'hidden');
    w = r.wallet;
    audit = r.report;
    sus = Math.min(sus, SUS_AFTER_AUDIT);
  }

  const forced = soldBetween(qtyBefore, w.qty);
  const nw = netWorth(w);
  w = {
    ...w,
    year: year + 1,
    yearFlows: 0,
    lastNetWorth: nw,
    history: [...w.history, { year, netWorth: nw, baseline: w.baseline }],
  };
  return {
    wallet: w,
    sus,
    report: { year, interest, income, debtInterest, overseasTax, netWorthBefore: before, netWorth: nw, gain, susDelta, secretSale, audit, forced },
  };
}

/** 해외주식 양도세 — 한 해 실현손익에서 기본공제를 빼고 세율 */
export function overseasGainTax(data: MarketData, realized: number, gainYear: number): number {
  const og = data.rules.overseasGainTax;
  return gainYear >= og.from && realized > og.deduction ? Math.round((realized - og.deduction) * og.rate) : 0;
}

/**
 * 엔딩 정산 — 2026 기준일 가격으로 평가. 아직 안 낸 해외주식 양도세
 * (2025년분은 2026년 5월 납부, 2026년분은 낼 세금)도 빼고 계산한다.
 */
export function finalValuation(data: MarketData, w: Wallet): { wallet: Wallet; netWorth: number; overseasTax: number } {
  const mark = { ...w.mark };
  for (const a of ASSET_IDS) {
    const p = data.final.prices[a];
    if (p) mark[a] = p.krw;
  }
  let next: Wallet = { ...w, mark };
  const lastSettled = Math.max(0, ...w.history.map((h) => h.year));
  let overseasTax = 0;
  for (const [y, v] of Object.entries(w.realizedOverseas)) if (Number(y) >= lastSettled) overseasTax += overseasGainTax(data, v, Number(y));
  if (overseasTax > 0) next = pay(data, next, overseasTax, lastSettled + 1);
  return { wallet: next, netWorth: netWorth(next), overseasTax };
}
