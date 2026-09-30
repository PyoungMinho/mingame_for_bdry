/**
 * 인생 2회차 — 이야기 엔진 (순수 함수).
 *
 * 흐름: 장면(선택) → 결과 → 다음 장면. 다음 장면의 연도가 지금 연도보다 크면 그 사이 연말 결산이
 * 한 해씩 먼저 열린다(beginSettle → 결산 매매 → endSettle). 마지막 장면의 next 가 "end" 이면
 * 2025년까지 남은 결산 뒤 2026 기준일 가격으로 정산(finalize)하고 인생 결말을 고른다.
 * 결과 문단 조건은 "선택하던 순간(효과 전)" 상태로 평가한다(좀비 엔진과 같은 규칙).
 */
import { ASSET_IDS, ASSETS, LAST_SETTLE_YEAR, MIN_STORY_TRADE, PETTY_DEBT, START_STATS, START_YEAR, SUS_STEPS, TIERS, TRAITS } from './contract';
import {
  access,
  buy,
  finalValuation,
  netWorth,
  newWallet,
  pay,
  priceOf,
  sell,
  settleYear,
  snapParent,
  soldBetween,
  yearEndDate,
  totoPayout,
  transfer,
  type SettleReport,
  type TradeReceipt,
  type TransferReport,
  type Wallet,
} from './market';
import type {
  AssetId,
  Choice,
  Condition,
  Effect,
  Ending,
  EndingId,
  Gender,
  MarketData,
  Outcome,
  Para,
  StatKey,
  StoryNode,
  TraitTag,
} from './types';

export const SAVE_VERSION = 1;

export interface HistoryEntry {
  nodeId: string;
  title: string;
  date: string;
  choiceLabel: string;
}

export interface RunState {
  v: typeof SAVE_VERSION;
  seed: number;
  rng: number;
  gender: Gender;
  nodeId: string;
  stats: Record<StatKey, number>;
  flags: string[];
  traits: Record<TraitTag, number>;
  history: HistoryEntry[];
  wallet: Wallet;
  /** 결산해야 할 연도들(오름차순) */
  pending: number[];
  /** 결산 중인 해와 그 보고서 — null 이면 이야기 진행 중 */
  settling: { year: number; report: SettleReport; trades: TradeReceipt[] } | null;
  /** 마지막 장면을 지나 엔딩 정산을 기다리는 중 */
  toEnd: boolean;
  final: FinalResult | null;
}

export interface FinalResult {
  netWorth: number;
  baseline: number;
  tier: (typeof TIERS)[number];
  ending: { id: EndingId; title: string; scene: string; body: string[]; epitaph: string };
  trait: { tag: TraitTag; title: string; line: string };
}

export interface Delta {
  stats: Partial<Record<StatKey, number>>;
  cash: number;
  windfall: number;
  debt: number;
  trades: TradeReceipt[];
  lost: { asset: AssetId; qty: number }[];
  transfer: TransferReport | null;
  income: Effect['income'];
  bet: { stake: number; payout: number; tax: number; won: boolean } | null;
  /** 현금이 모자라 강제로 판 자산 */
  forced: { asset: AssetId; qty: number }[];
}

export interface Resolution {
  choice: Choice;
  outcome: Outcome;
  result: string[];
  delta: Delta;
  state: RunState;
}

// ─────────────────────────────── 난수 ───────────────────────────────

export function step(rng: number): [number, number] {
  const a = (rng + 0x6d2b79f5) >>> 0;
  let t = a;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return [((t ^ (t >>> 14)) >>> 0) / 4294967296, a];
}

// ─────────────────────────────── 생성·조회 ───────────────────────────────

const emptyTraits = (): Record<TraitTag, number> => ({ hodl: 0, trader: 0, estate: 0, family: 0, safe: 0, yolo: 0, honest: 0, sly: 0 });

export const yearOf = (date: string) => Number(date.slice(0, 4));

export function newRun(seed: number, gender: Gender, startNodeId: string): RunState {
  const s = seed >>> 0;
  return {
    v: SAVE_VERSION,
    seed: s,
    rng: s,
    gender,
    nodeId: startNodeId,
    stats: { ...START_STATS },
    flags: [],
    traits: emptyTraits(),
    history: [],
    wallet: { ...newWallet(START_YEAR), cashStart: 0 }, // 2000년 연초 현금은 0원 — 첫해 이자도 한 해 내내 있던 돈에만
    pending: [],
    settling: null,
    toEnd: false,
    final: null,
  };
}

export function isAdultNow(s: RunState, data: MarketData): boolean {
  return s.wallet.year >= data.rules.adultYear;
}

export function checkCondition(s: RunState, c: Condition | undefined, data: MarketData): boolean {
  if (!c) return true;
  if (c.flags && !c.flags.every((f) => s.flags.includes(f))) return false;
  if (c.noFlags && c.noFlags.some((f) => s.flags.includes(f))) return false;
  if (c.min) for (const [k, v] of Object.entries(c.min) as [StatKey, number][]) if (s.stats[k] < v) return false;
  if (c.max) for (const [k, v] of Object.entries(c.max) as [StatKey, number][]) if (s.stats[k] > v) return false;
  if (c.gender && c.gender !== s.gender) return false;
  if (c.adult !== undefined && c.adult !== isAdultNow(s, data)) return false;
  if (c.holding && !c.holding.every((a) => s.wallet.qty[a] > 0)) return false;
  if (c.noHolding && c.noHolding.some((a) => s.wallet.qty[a] > 0)) return false;
  if (c.minCash !== undefined && s.wallet.cash < c.minCash) return false;
  if (c.maxCash !== undefined && s.wallet.cash > c.maxCash) return false;
  const nw = s.final ? s.final.netWorth : netWorth(s.wallet);
  if (c.minNetWorth !== undefined && nw < c.minNetWorth) return false;
  if (c.maxNetWorth !== undefined && nw > c.maxNetWorth) return false;
  return true;
}

export function resolveParas(s: RunState, paras: Para[], data: MarketData): string[] {
  const out: string[] = [];
  for (const p of paras) {
    if (typeof p === 'string') out.push(p);
    else if (checkCondition(s, p.when, data)) out.push(p.text);
  }
  return out;
}

export type ChoiceStatus = 'open' | 'locked' | 'hidden';

const emptyDelta = (): Delta => ({ stats: {}, cash: 0, windfall: 0, debt: 0, trades: [], lost: [], transfer: null, income: undefined, bet: null, forced: [] });

/** 현금이 어디 묶여 있나 — 가장 큰 보유 자산 이름(없으면 null) */
function tiedIn(w: Wallet): string | null {
  let best: AssetId | null = null;
  for (const a of ASSET_IDS) if (w.qty[a] > 0 && (!best || w.qty[a] * w.mark[a] > w.qty[best] * w.mark[best])) best = a;
  return best ? ASSETS[best].name : null;
}

/**
 * 이 결과의 매매가 지금 체결될 수 있는가 — 못 하면 실패 이유. 결과 문단은 체결을 전제로 쓰였으므로
 * 체결 못 할 결과는 고르지 않는다(돈이 없거나, 명의가 없거나, 팔 게 없거나, 1주 값도 안 되거나,
 * 체결액이 결심한 매매라 부르기 민망할 만큼 작거나 — MIN_STORY_TRADE).
 */
export function outcomeBlock(s: RunState, o: Outcome, data: MarketData, year: number, date?: string): string | null {
  if (!o.effects?.trades?.length) return null;
  const d = emptyDelta();
  applyEffect(s, o.effects, data, year, d, date);
  const tied = tiedIn(s.wallet);
  const cashOnly = tied ? ` — 돈이 ${tied}에 묶여 있다(이야기 속 매매는 현금으로만)` : '';
  const bad = d.trades.find((t) => !t.ok);
  if (bad) return bad.reason === '살 돈이 없다' && tied ? `현금이 없다${cashOnly}` : bad.reason ?? '거래할 수 없다';
  const min = Math.max(MIN_STORY_TRADE.krw, netWorth(s.wallet) * MIN_STORY_TRADE.ofNetWorth);
  const tiny = d.trades.find((t) => t.gross < min);
  if (!tiny) return null;
  return tiny.side === 'buy'
    ? `이 장면에 걸 만한 현금이 없다(현금 ${formatKRW(s.wallet.cash)})${cashOnly}`
    : `팔 만큼 없다(${ASSETS[tiny.asset].name} ${formatKRW(tiny.gross)}어치)`;
}

/** 조건(when)과 체결 가능 여부로 이 결과가 후보인가 — 마지막 결과는 when 을 보지 않는다 */
function eligible(s: RunState, list: Outcome[], i: number, data: MarketData, year: number, date?: string): boolean {
  const o = list[i];
  if (i < list.length - 1 && !checkCondition(s, o.when, data)) return false;
  return outcomeBlock(s, o, data, year, date) === null;
}

export function choiceStatus(s: RunState, c: Choice, data: MarketData, year?: number, date?: string): ChoiceStatus {
  if (!checkCondition(s, c.requires, data)) return c.lockedHint ? 'locked' : 'hidden';
  if (year === undefined) return 'open';
  return c.outcomes.some((_, i) => eligible(s, c.outcomes, i, data, year, date)) ? 'open' : 'locked';
}

/** 선택지와 상태. 잠긴 이유(hint)는 콘텐츠의 lockedHint, 없으면 매매가 막힌 이유 */
export function visibleChoices(s: RunState, node: StoryNode, data: MarketData) {
  const year = yearOf(node.date);
  const out: { choice: Choice; status: 'open' | 'locked'; hint?: string }[] = [];
  for (const choice of node.choices) {
    const status = choiceStatus(s, choice, data, year, node.date);
    if (status === 'hidden') continue;
    let hint = choice.lockedHint;
    if (status === 'locked' && checkCondition(s, choice.requires, data)) {
      hint = outcomeBlock(s, choice.outcomes[choice.outcomes.length - 1], data, year, node.date) ?? choice.lockedHint;
    }
    out.push({ choice, status, hint: status === 'locked' ? hint : undefined });
  }
  return out;
}

// ─────────────────────────────── 선택 처리 ───────────────────────────────

function pickOutcome(s: RunState, choice: Choice, data: MarketData, year: number, date: string): { outcome: Outcome; rng: number } {
  let rng = s.rng;
  const list = choice.outcomes;
  let lastEligible: Outcome | null = null;
  for (let i = 0; i < list.length; i++) {
    if (!eligible(s, list, i, data, year, date)) continue;
    const o = list[i];
    lastEligible = o;
    if (i < list.length - 1 && o.chance !== undefined) {
      const [r, next] = step(rng);
      rng = next;
      if (r >= o.chance) continue;
    }
    return { outcome: o, rng };
  }
  // 확률에서 다 떨어졌는데 마지막(폴백)이 체결 불가면, 체결 가능한 마지막 후보
  return { outcome: lastEligible ?? list[list.length - 1], rng };
}

const clamp = (v: number) => Math.max(0, Math.min(100, Math.round(v)));
const uniq = <T>(a: T[]) => Array.from(new Set(a));

/** date: 장면 날짜(강제 매도의 매매 단위) — 없으면 그해 연말 */
function applyEffect(s: RunState, e: Effect | undefined, data: MarketData, year: number, delta: Delta, date?: string): RunState {
  if (!e) return s;
  const stats = { ...s.stats };
  for (const k of ['trust', 'happy', 'health', 'sus'] as StatKey[]) {
    const v = e[k];
    if (v) {
      const before = stats[k];
      stats[k] = clamp(before + v);
      delta.stats[k] = (delta.stats[k] ?? 0) + (stats[k] - before);
    }
  }
  // 성년이 된 뒤 첫 선택 — 그 순간의 부모 명의 몫을 기록(명의 이전 평가용)
  let w = snapParent(data, s.wallet, year);
  // 매매 명의 판단은 선택하던 순간의 신뢰로(효과로 깎이는 신뢰가 먼저 적용돼 체결이 막히는 일 방지)
  const ctx = { year, trust: s.stats.trust, flags: s.flags };
  const qty0 = w.qty;

  if (e.cash) {
    // 평범한 현금 흐름 — 비교선에도 반영, 지출은 모자라면 자산 매도·부채.
    // 비교선(예금만 한 인생)이 감당 못 할 지출은 2회차 수익으로 낸 것 — 원래 인생엔 없던 지출이라 비교선에서 빼지 않는다
    w = e.cash > 0 ? { ...w, cash: w.cash + e.cash } : pay(data, w, -e.cash, year, date);
    w = { ...w, yearFlows: w.yearFlows + e.cash, baseline: w.baseline + e.cash >= 0 ? w.baseline + e.cash : w.baseline };
    delta.cash += e.cash;
  }
  if (e.windfall) {
    w = e.windfall > 0 ? { ...w, cash: w.cash + e.windfall } : pay(data, w, -e.windfall, year, date);
    delta.windfall += e.windfall;
  }
  if (e.bet) {
    const { stake, odds, won } = e.bet;
    w = pay(data, w, stake, year, date);
    const r = won ? totoPayout(data, stake, odds) : { payout: 0, tax: 0 };
    w = { ...w, cash: w.cash + r.payout };
    delta.windfall += r.payout - stake;
    delta.bet = { stake, payout: r.payout, tax: r.tax, won };
  }
  if (e.debt) {
    w = { ...w, debt: Math.max(0, w.debt + e.debt) };
    delta.debt += e.debt;
  }
  delta.forced.push(...soldBetween(qty0, w.qty));
  for (const t of e.trades ?? []) {
    const ref = t.at ? { event: t.at } : { year };
    const date = t.at ? data.events[t.at]?.date ?? yearEndDate(year) : yearEndDate(year);
    const price = priceOf(data, t.asset, ref);
    const acc = access(data, ctx, t.asset, ref);
    if (!price || !acc.ok) {
      delta.trades.push({ asset: t.asset, side: t.kind, qty: 0, price: price?.krw ?? 0, gross: 0, fee: 0, tax: 0, loan: 0, ok: false, reason: acc.ok ? '가격 없음' : acc.reason });
      continue;
    }
    const r =
      t.kind === 'buy'
        ? buy(data, w, t.asset, t.krw ?? Math.round(w.cash * (t.pct ?? 1)), price.krw, year, date)
        : sell(data, w, t.asset, t.pct, price.krw, year, date);
    w = r.wallet;
    delta.trades.push(r.receipt);
  }
  for (const l of e.lose ?? []) {
    const q = w.qty[l.asset] * Math.min(1, Math.max(0, l.pct));
    if (q > 0) {
      const ratio = q / w.qty[l.asset];
      w = { ...w, qty: { ...w.qty, [l.asset]: w.qty[l.asset] - q }, cost: { ...w.cost, [l.asset]: w.cost[l.asset] * (1 - ratio) } };
      delta.lost.push({ asset: l.asset, qty: q });
    }
  }
  if (e.income !== undefined) {
    w = { ...w, income: e.income };
    delta.income = e.income;
  }
  let flags = s.flags;
  if (e.transfer) {
    const before = w.qty;
    const r = transfer(data, w, e.transfer, year);
    w = r.wallet;
    delta.transfer = r.report;
    delta.forced.push(...soldBetween(before, w.qty));
    if (r.report.mode === 'declare' && r.report.tax > 0) flags = uniq([...flags, 'gift_tax_paid']);
  }
  if (e.setFlags?.length) flags = uniq([...flags, ...e.setFlags]);
  if (e.clearFlags?.length) flags = flags.filter((f) => !e.clearFlags!.includes(f));
  return { ...s, stats, wallet: w, flags };
}

export class ChoiceError extends Error {}

function range(from: number, toInclusive: number): number[] {
  const out: number[] = [];
  for (let y = from; y <= toInclusive; y++) out.push(y);
  return out;
}

export function applyChoice(s: RunState, nodes: Record<string, StoryNode>, data: MarketData, choiceId: string): Resolution {
  if (s.settling || s.toEnd || s.final || s.pending.length) throw new ChoiceError('지금은 선택할 수 없다');
  const node = nodes[s.nodeId];
  if (!node) throw new ChoiceError(`노드 없음: ${s.nodeId}`);
  const choice = node.choices.find((c) => c.id === choiceId);
  if (!choice) throw new ChoiceError(`선택지 없음: ${choiceId}`);
  const year = yearOf(node.date);
  if (choiceStatus(s, choice, data, year, node.date) !== 'open') throw new ChoiceError(`잠긴 선택지: ${choiceId}`);

  const { outcome, rng } = pickOutcome(s, choice, data, year, node.date);
  const result = resolveParas(s, outcome.result, data);
  const delta = emptyDelta();

  let next: RunState = { ...s, rng };
  next = applyEffect(next, outcome.effects, data, year, delta, node.date);

  const traits = { ...next.traits };
  for (const t of choice.tags ?? []) traits[t] += 1;
  next = {
    ...next,
    traits,
    history: [...next.history, { nodeId: node.id, title: node.title, date: node.date, choiceLabel: choice.label }],
  };

  if (outcome.next === 'end') {
    next = { ...next, toEnd: true, pending: range(next.wallet.year, LAST_SETTLE_YEAR) };
  } else {
    const target = nodes[outcome.next];
    if (!target) throw new ChoiceError(`다음 노드 없음: ${outcome.next}`);
    const ty = yearOf(target.date);
    next = { ...next, nodeId: target.id, pending: ty > next.wallet.year ? range(next.wallet.year, ty - 1) : [] };
  }
  return { choice, outcome, result, delta, state: next };
}

// ─────────────────────────────── 결산 ───────────────────────────────

/** 결산할 해가 남아 있으면 하나를 연다(자동 부분 계산). */
export function beginSettle(s: RunState, data: MarketData): RunState {
  if (s.settling || !s.pending.length) return s;
  const year = s.pending[0];
  const [r1, a] = step(s.rng);
  const [r2, b] = step(a);
  const { wallet, report, sus } = settleYear(data, snapParent(data, s.wallet, year), year, { trust: s.stats.trust, sus: s.stats.sus, rolls: [r1, r2] });
  const flags = [...s.flags];
  // 단계 플래그는 조사로 수상함이 내려가기 전(그해 최고치) 기준
  const peak = Math.max(sus, Math.min(100, s.stats.sus + report.susDelta));
  for (const t of SUS_STEPS) if (peak >= t && !flags.includes(`sus${t}`)) flags.push(`sus${t}`);
  if (report.audit) {
    flags.push(`audited_${year}`, 'audited');
    if (!report.audit.clean) flags.push('audit_penalty');
  }
  if (report.secretSale) flags.push(`secret_sale_${year}`);
  return {
    ...s,
    rng: b,
    wallet,
    stats: { ...s.stats, sus },
    flags: uniq(flags),
    settling: { year, report, trades: [] },
  };
}

/** 결산 매매 — 그해 연말가로 체결 */
export function settleTrade(
  s: RunState,
  data: MarketData,
  t: { asset: AssetId; side: 'buy'; krw: number } | { asset: AssetId; side: 'sell'; pct: number },
): { state: RunState; receipt: TradeReceipt } {
  if (!s.settling) throw new ChoiceError('결산 중이 아니다');
  const year = s.settling.year;
  const ref = { year };
  const price = priceOf(data, t.asset, ref);
  const acc = access(data, { year, trust: s.stats.trust, flags: s.flags }, t.asset, ref);
  if (!price || !acc.ok) {
    const receipt: TradeReceipt = { asset: t.asset, side: t.side, qty: 0, price: 0, gross: 0, fee: 0, tax: 0, loan: 0, ok: false, reason: acc.ok ? '가격 없음' : acc.reason };
    return { state: s, receipt };
  }
  const date = yearEndDate(year);
  const r = t.side === 'buy' ? buy(data, s.wallet, t.asset, t.krw, price.krw, year, date) : sell(data, s.wallet, t.asset, t.pct, price.krw, year, date);
  const nw = netWorth(r.wallet);
  const history = [...r.wallet.history];
  if (history.length) history[history.length - 1] = { ...history[history.length - 1], netWorth: nw };
  return {
    state: { ...s, wallet: { ...r.wallet, lastNetWorth: nw, history }, settling: { ...s.settling, trades: [...s.settling.trades, r.receipt] } },
    receipt: r.receipt,
  };
}

/** 결산을 닫는다. 남은 해가 있으면 다음 결산을, 엔딩 대기면 정산은 finalize 에서. */
export function endSettle(s: RunState): RunState {
  if (!s.settling) return s;
  let w = s.wallet;
  // 자잘한 빚은 남은 현금으로 갚는다
  if (w.debt > 0 && w.debt <= PETTY_DEBT && w.cash > 0) {
    const repay = Math.min(w.cash, w.debt);
    w = { ...w, cash: w.cash - repay, debt: w.debt - repay };
  }
  w = { ...w, cashStart: w.cash, debtStart: w.debt };
  return { ...s, wallet: w, settling: null, pending: s.pending.slice(1) };
}

/** 다음으로 넘어가기 — 결산이 남았으면 열고, 엔딩 대기인데 결산이 끝났으면 정산한다(저장 복원 직후에도 호출) */
export function progress(s: RunState, data: MarketData, endings: Ending[]): RunState {
  if (s.settling || s.final) return s;
  if (s.pending.length) return beginSettle(s, data);
  if (s.toEnd) return finalize(s, data, endings);
  return s;
}

/** 결산 중 대출 상환 — 남은 현금으로 갚을 수 있는 만큼 */
export function repayDebt(s: RunState, amount?: number): RunState {
  if (!s.settling) throw new ChoiceError('결산 중이 아니다');
  const w = s.wallet;
  const repay = Math.max(0, Math.min(w.cash, w.debt, amount ?? Infinity));
  if (repay <= 0) return s;
  return { ...s, wallet: { ...w, cash: w.cash - repay, debt: w.debt - repay } };
}

// ─────────────────────────────── 엔딩 ───────────────────────────────

export function investorType(s: RunState): { tag: TraitTag; title: string; line: string } {
  // 이야기 속 선택 태그 + 마지막에 무엇을 들고 있었나(결산 매매도 성향이다 — 선택 태그 총합의 3할, 최소 3)
  const score = { ...s.traits };
  const w = s.wallet;
  const value = (pred: (a: AssetId) => boolean) => ASSET_IDS.filter(pred).reduce((m, a) => m + w.qty[a] * w.mark[a], 0);
  const total = Math.max(1, w.cash + value(() => true));
  const weight = Math.max(3, Math.round(Object.values(s.traits).reduce((m, v) => m + v, 0) * 0.3));
  const risky = value((a) => ASSETS[a].kind === 'crypto' || ASSETS[a].kind === 'domestic' || ASSETS[a].kind === 'overseas') / total;
  const safeShare = (w.cash + value((a) => a === 'usd' || a === 'gold')) / total;
  if (value((a) => a === 'apt') / total >= 0.5) score.estate += weight;
  else if (risky >= 0.6) score[w.debt >= total * 0.05 ? 'yolo' : 'hodl'] += weight; // 빚을 끼고 몰빵했으면 영끌
  else if (w.cash / total >= 0.6) score.safe += weight;
  // 안전제일은 실제로 안전하게(현금·달러·금) 들고 있을 때만
  if (safeShare < 0.5) score.safe = 0;
  const order: TraitTag[] = ['family', 'hodl', 'estate', 'trader', 'yolo', 'honest', 'sly', 'safe'];
  let best: TraitTag = safeShare >= 0.5 ? 'safe' : 'hodl';
  let n = 0;
  for (const t of order) {
    if (score[t] > n) {
      best = t;
      n = score[t];
    }
  }
  return { tag: best, ...TRAITS[best] };
}

/** 순자산 티어 — '강남 입성'은 은마를 실제로 가졌을 때만 */
export function tierOf(nw: number, hasApt = false) {
  return TIERS.find((t) => nw >= t.min && (!t.apt || hasApt)) ?? TIERS[TIERS.length - 1];
}

/** 모든 결산이 끝난 뒤 2026 기준일 가격으로 정산하고 인생 결말을 고른다. */
export function finalize(s: RunState, data: MarketData, endings: Ending[]): RunState {
  if (!s.toEnd || s.pending.length || s.settling) throw new ChoiceError('아직 정산할 수 없다');
  const { wallet, netWorth: nw } = finalValuation(data, s.wallet);
  const withNw: RunState = { ...s, wallet, final: { netWorth: nw } as FinalResult };
  const ending = endings.find((e) => checkCondition(withNw, e.when, data)) ?? endings[endings.length - 1];
  const variant = ending.variants?.find((v) => checkCondition(withNw, v.when, data));
  const final: FinalResult = {
    netWorth: nw,
    baseline: wallet.baseline,
    tier: tierOf(nw, wallet.qty.apt > 0),
    ending: {
      id: ending.id,
      title: variant?.title ?? ending.title,
      scene: ending.scene,
      body: resolveParas(withNw, variant?.body ?? ending.body, data),
      epitaph: variant?.epitaph ?? ending.epitaph,
    },
    trait: investorType(withNw),
  };
  return { ...withNw, final };
}

// ─────────────────────────────── 표시용 ───────────────────────────────

/** 1,234,567,890 → "12억 3,456만원" (조 단위면 만 이하 생략, 1,000만 미만은 원 단위까지 — 시세가 깎여 보이지 않게) */
export function formatKRW(v: number): string {
  const sign = v < 0 ? '−' : '';
  const abs = Math.round(Math.abs(v));
  if (abs < 10_000) return `${sign}${abs.toLocaleString()}원`;
  if (abs < 10_000_000) {
    const man = Math.floor(abs / 1e4);
    const rest = abs % 1e4;
    return `${sign}${man.toLocaleString()}만${rest ? ` ${rest.toLocaleString()}` : ''}원`;
  }
  const jo = Math.floor(abs / 1e12);
  const eok = Math.floor((abs % 1e12) / 1e8);
  const man = Math.floor((abs % 1e8) / 1e4);
  const parts: string[] = [];
  if (jo) parts.push(`${jo.toLocaleString()}조`);
  if (eok) parts.push(`${eok.toLocaleString()}억`);
  if (man && !jo) parts.push(`${man.toLocaleString()}만`);
  return `${sign}${parts.join(' ')}원`;
}

export function holdingsList(s: RunState) {
  return ASSET_IDS.filter((a) => s.wallet.qty[a] > 0).map((a) => ({ asset: a, qty: s.wallet.qty[a], value: s.wallet.qty[a] * s.wallet.mark[a] }));
}

// ─────────────────────────────── 저장 ───────────────────────────────

const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
const isQty = (q: unknown) => !!q && typeof q === 'object' && ASSET_IDS.every((a) => isNum((q as Record<string, unknown>)[a]));

/** 저장본 복원 — 모양이 하나라도 어긋나면 null(깨진 저장으로 화면이 죽지 않게) */
export function restoreRun(raw: unknown, nodes: Record<string, StoryNode>): RunState | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Partial<RunState>;
  if (r.v !== SAVE_VERSION || typeof r.nodeId !== 'string' || !nodes[r.nodeId]) return null;
  if (r.gender !== 'm' && r.gender !== 'f') return null;
  if (!isNum(r.seed) || !isNum(r.rng) || !Array.isArray(r.flags) || !r.flags.every((f) => typeof f === 'string')) return null;
  if (!r.stats || !(['trust', 'happy', 'health', 'sus'] as StatKey[]).every((k) => isNum(r.stats![k]))) return null;
  const w = r.wallet;
  if (!w || !isNum(w.year) || !isNum(w.cash) || !isNum(w.debt) || !isNum(w.baseline) || !isNum(w.yearFlows) || !isNum(w.lastNetWorth) || !isNum(w.hiddenGift)) return null;
  if (!isQty(w.qty) || !isQty(w.cost) || !isQty(w.mark) || !Array.isArray(w.history) || !w.realizedOverseas || typeof w.underParent !== 'boolean') return null;
  if (w.year < START_YEAR || w.year > LAST_SETTLE_YEAR + 1) return null;
  if (!Array.isArray(r.history)) return null;
  if (r.pending !== undefined && (!Array.isArray(r.pending) || !r.pending.every((y) => isNum(y) && y >= START_YEAR && y <= LAST_SETTLE_YEAR))) return null;
  if (r.settling && (!isNum(r.settling.year) || !r.settling.report || !Array.isArray(r.settling.trades))) return null;
  if (r.final && (!isNum(r.final.netWorth) || !r.final.ending || !r.final.tier || !r.final.trait)) return null;
  return {
    ...(r as RunState),
    traits: { ...emptyTraits(), ...(r.traits ?? {}) },
    pending: Array.isArray(r.pending) ? r.pending : [],
    settling: r.settling ?? null,
    toEnd: Boolean(r.toEnd),
    final: r.final ?? null,
  };
}
