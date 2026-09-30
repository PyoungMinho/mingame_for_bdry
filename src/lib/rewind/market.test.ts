/**
 * 시장 모듈 규칙 테스트 — 가짜(픽스처) 데이터로 계산식만 검증한다. 실제 시세는 data.test.ts 가 따로 본다.
 */
import { describe, expect, it } from 'vitest';
import { APT_PER_YEAR, ASSET_IDS, BTC_EARLY_CAP, BUY_CAP_KRW } from './contract';
import {
  access,
  aptLoan,
  buy,
  buyRoom,
  finalValuation,
  lotSize,
  giftTax,
  netWorth,
  newWallet,
  pay,
  rateAt,
  sell,
  settleYear,
  taxAudit,
  totoPayout,
  transfer,
  type Wallet,
} from './market';
import type { AssetId, MarketData, PricePoint } from './types';

const p = (krw: number): PricePoint => ({ krw, src: 'fixture' });
const allPrices = (krw: number) => Object.fromEntries(ASSET_IDS.map((a) => [a, p(krw)])) as Record<AssetId, PricePoint>;

const DATA: MarketData = {
  years: {
    2000: { year: 2000, fx: 1000, depositRate: 10, baseRate: 5, prices: { samsung: p(1000), gold: p(50_000), usd: p(1000), apt: p(100_000_000) } },
    2001: { year: 2001, fx: 1000, depositRate: 10, baseRate: 5, prices: { samsung: p(2000), gold: p(50_000), usd: p(1000), apt: p(100_000_000) } },
    2007: { year: 2007, fx: 1000, depositRate: 5, baseRate: 5, prices: { samsung: p(2000), aapl: p(10_000), usd: p(1000), apt: p(100_000_000) } },
    2013: { year: 2013, fx: 1000, depositRate: 3, baseRate: 3, prices: { samsung: p(4000), btc: p(1_000_000), aapl: p(20_000) } },
    2016: { year: 2016, fx: 1000, depositRate: 2, baseRate: 2, prices: { samsung: p(4000) } },
  },
  final: { date: '2026-09-29', fx: 1000, prices: allPrices(1) },
  events: { e1: { id: 'e1', date: '2000-02-18', label: 'x', prices: { samsung: p(500) } } },
  rules: {
    feeDomestic: [{ from: 2000, rate: 0.01 }],
    txTaxDomestic: [{ from: 2000, rate: 0.003 }],
    feeOverseas: [{ from: 2000, rate: 0.005 }],
    overseasGainTax: { from: 2000, rate: 0.22, deduction: 2_500_000 },
    feeCrypto: [{ from: 2000, rate: 0.0005 }],
    goldRetailCostUntil: 2014,
    goldRetailCost: 0.1,
    ltv: [
      { from: 2000, rate: 0.6 },
      { from: 2010, rate: 0.4 },
    ],
    loanBanAbove: [{ from: 2019, until: 2022, price: 1_500_000_000 }],
    loanCap: [{ from: 2025, max: 600_000_000 }],
    aptAcquisitionTax: [{ from: 2000, rate: 0.02 }],
    giftTax: [
      { upTo: 100_000_000, rate: 0.1, deduction: 0 },
      { upTo: 500_000_000, rate: 0.2, deduction: 10_000_000 },
      { upTo: Infinity, rate: 0.3, deduction: 60_000_000 },
    ],
    giftDeduction: [{ from: 2000, minor: 10_000_000, adult: 30_000_000 }],
    penaltyFraud: [{ from: 2000, rate: 0.4 }],
    giftReportCredit: [{ from: 2000, rate: 0 }],
    totoTax: { rate: 0.22, floor: 10_000 },
    lateDaily: [{ from: 2000, rate: 0.0003 }],
    loanSpread: 1.5,
    overseasFrom: 2007,
    cryptoDomesticFrom: 2013,
    adultYear: 2013,
  },
};

const funded = (cash: number, year = 2000): Wallet => ({ ...newWallet(year), cash, lastNetWorth: cash });

describe('rateAt', () => {
  it('연도 구간 규칙', () => {
    expect(rateAt(DATA.rules.ltv, 2005)).toBe(0.6);
    expect(rateAt(DATA.rules.ltv, 2010)).toBe(0.4);
    expect(rateAt(DATA.rules.ltv, 2020)).toBe(0.4);
  });
});

describe('access', () => {
  const ctx = (year: number, trust = 60, flags: string[] = []) => ({ year, trust, flags });
  it('미성년은 부모 명의 — 신뢰가 모자라면 거절', () => {
    expect(access(DATA, ctx(2000), 'samsung')).toEqual({ ok: true, via: 'parent' });
    expect(access(DATA, ctx(2000, 20), 'samsung').ok).toBe(false);
    expect(access(DATA, ctx(2000, 50), 'apt').ok).toBe(false); // 아파트는 신뢰 60
  });
  it('성년이면 본인', () => {
    expect(access(DATA, ctx(2013, 0), 'samsung')).toEqual({ ok: true, via: 'self' });
  });
  it('해외주식은 overseasFrom 부터, 없는 자산은 불가', () => {
    expect(access(DATA, ctx(2000), 'aapl').ok).toBe(false); // 2000 가격 없음
    expect(access(DATA, ctx(2007), 'aapl').ok).toBe(true);
  });
  it('코인은 국내 거래소 전엔 해외 경로 플래그가 필요', () => {
    const d = { ...DATA, years: { ...DATA.years, 2011: { ...DATA.years[2013], year: 2011 } } };
    expect(access(d, ctx(2011), 'btc').ok).toBe(false);
    expect(access(d, ctx(2011, 60, ['btc_overseas']), 'btc').ok).toBe(true);
  });
});

describe('buy / sell', () => {
  it('국내주식: 수수료 떼고 수량, 매도는 수수료+거래세', () => {
    const b = buy(DATA, funded(100_000), 'samsung', 100_000, 1000, 2000);
    expect(b.receipt.ok).toBe(true);
    expect(b.wallet.qty.samsung).toBeCloseTo(99, 6); // 1% 수수료
    expect(b.wallet.cash).toBe(0);
    const s = sell(DATA, b.wallet, 'samsung', 1, 2000, 2001);
    // 99주 × 2000 = 198,000 − 수수료 1,980 − 거래세 594
    expect(s.wallet.cash).toBeCloseTo(198_000 - 1_980 - 594, 6);
    expect(s.wallet.qty.samsung).toBe(0);
    expect(s.wallet.cost.samsung).toBe(0);
  });

  it('금 실물은 2014년 전 매수 시 10% 추가 비용', () => {
    const b = buy(DATA, funded(110_000), 'gold', 110_000, 50_000, 2000);
    expect(b.wallet.qty.gold).toBeCloseTo((110_000 * 0.9) / 50_000, 9);
  });

  it('아파트: LTV 대출 + 취득세, 현금 부족이면 실패, 매도 시 대출부터 상환', () => {
    const poor = buy(DATA, funded(10_000_000), 'apt', 0, 100_000_000, 2000);
    expect(poor.receipt.ok).toBe(false);
    const b = buy(DATA, funded(50_000_000), 'apt', 0, 100_000_000, 2000);
    expect(b.receipt.ok).toBe(true);
    expect(b.wallet.debt).toBe(60_000_000);
    expect(b.wallet.cash).toBe(50_000_000 - 40_000_000 - 2_000_000);
    const s = sell(DATA, b.wallet, 'apt', 1, 150_000_000, 2001);
    expect(s.wallet.debt).toBe(0);
    expect(s.wallet.cash).toBe(8_000_000 + 150_000_000 - 60_000_000);
  });

  it('대출 규제: 고가주택 대출 금지 기간과 금액 상한', () => {
    expect(aptLoan(DATA, 2_000_000_000, 2018)).toBe(800_000_000); // LTV 40%
    expect(aptLoan(DATA, 2_000_000_000, 2020)).toBe(0); // 15억 초과 금지
    expect(aptLoan(DATA, 1_000_000_000, 2020)).toBe(400_000_000); // 15억 이하는 가능
    expect(aptLoan(DATA, 3_000_000_000, 2025)).toBe(600_000_000); // 6억 상한
  });

  it('해외주식 실현손익은 연도별로 쌓인다', () => {
    const b = buy(DATA, funded(10_000_000, 2007), 'aapl', 10_000_000, 10_000, 2007);
    const s = sell(DATA, b.wallet, 'aapl', 1, 20_000, 2007);
    expect(s.wallet.realizedOverseas[2007]).toBeGreaterThan(9_000_000);
  });

  it('pay: 현금이 모자라면 자산을 팔고, 그래도 모자라면 부채', () => {
    const b = buy(DATA, funded(100_000), 'samsung', 100_000, 1000, 2000);
    const paid = pay(DATA, b.wallet, 50_000, 2000);
    expect(paid.cash).toBeGreaterThanOrEqual(0);
    expect(paid.qty.samsung).toBeLessThan(99);
    const broke = pay(DATA, funded(0), 1_000, 2000);
    expect(broke.debt).toBe(1_000);
  });
});

describe('시장 한도(게임 규칙)', () => {
  const rich = (): Wallet => ({ ...newWallet(2013), cash: BUY_CAP_KRW * 3 });
  it('한 해 한 자산 매수는 한도까지만 — 넘는 부분은 현금으로 남는다', () => {
    const r = buy(DATA, rich(), 'samsung', BUY_CAP_KRW * 2, 4000, 2013);
    expect(r.receipt).toMatchObject({ ok: true, capped: true });
    expect(r.wallet.cash).toBeCloseTo(BUY_CAP_KRW * 2, 0);
    expect(buy(DATA, r.wallet, 'samsung', 1_000_000, 4000, 2013).receipt.ok).toBe(false);
    expect(buy(DATA, r.wallet, 'samsung', 1_000_000, 4000, 2014).receipt.ok).toBe(true); // 해가 바뀌면 새 한도
    expect(buy(DATA, r.wallet, 'aapl', 1_000_000, 20_000, 2013).receipt.ok).toBe(true); // 자산마다 따로
  });
  it(`초창기 비트코인은 한 해 ${BTC_EARLY_CAP.qty}개까지`, () => {
    const w = { ...newWallet(2010), cash: 1_000_000_000 };
    const r = buy(DATA, w, 'btc', 1_000_000_000, 100, 2010);
    expect(r.wallet.qty.btc).toBeCloseTo(BTC_EARLY_CAP.qty, 6);
    expect(r.receipt.capped).toBe(true);
    expect(buyRoom(r.wallet, 'btc', 2010).qty).toBeCloseTo(0, 6);
    expect(buyRoom(r.wallet, 'btc', 2013).qty).toBe(Infinity);
  });
  it(`아파트는 한 해 ${APT_PER_YEAR}채까지`, () => {
    const w = { ...newWallet(2000), cash: 1_000_000_000 };
    const a = buy(DATA, w, 'apt', 0, 100_000_000, 2000);
    expect(a.receipt.ok).toBe(true);
    expect(buy(DATA, a.wallet, 'apt', 0, 100_000_000, 2000).receipt.ok).toBe(false);
    expect(buy(DATA, a.wallet, 'apt', 0, 100_000_000, 2001).receipt.ok).toBe(true);
  });
});

describe('세금', () => {
  it('토토: (당첨금 − 구입액) 22% — 스페인전 10만원 × 45.07 = 세후 약 354만원', () => {
    const r = totoPayout(DATA, 100_000, 45.07);
    expect(r.tax).toBe(Math.round((4_507_000 - 100_000) * 0.22));
    expect(r.payout).toBe(4_507_000 - r.tax);
    expect(totoPayout(DATA, 1_000, 5).tax).toBe(0); // 과세최저한 이하
  });

  it('증여세 누진', () => {
    expect(giftTax(DATA, 50_000_000)).toBe(5_000_000);
    expect(giftTax(DATA, 200_000_000)).toBe(30_000_000);
    expect(giftTax(DATA, 1_000_000_000)).toBe(240_000_000);
    expect(giftTax(DATA, -1)).toBe(0);
  });

  it('명의 이전: 신고하면 증여세, 숨기면 차명 기록, 두면 그대로', () => {
    const b = buy(DATA, funded(200_000_000), 'samsung', 200_000_000, 1000, 2000).wallet;
    const declared = transfer(DATA, b, 'declare', 2013);
    expect(declared.report.tax).toBe(giftTax(DATA, declared.report.value - 30_000_000));
    expect(declared.wallet.underParent).toBe(false);
    const hidden = transfer(DATA, b, 'hide', 2013);
    expect(hidden.wallet.hiddenGift).toBe(hidden.report.value);
    expect(hidden.report.tax).toBe(0);
    expect(transfer(DATA, b, 'keep', 2013).wallet.underParent).toBe(true);
  });

  it('세무조사: 차명이면 증여세+부정 가산세 40%+납부지연, 깨끗하면 대리 비용만', () => {
    const w: Wallet = { ...funded(500_000_000, 2016), hiddenGift: 200_000_000, hiddenSince: 2013 };
    const r = taxAudit(DATA, w, 2016, 'hidden');
    const tax = giftTax(DATA, 200_000_000 - 30_000_000);
    expect(r.report.tax).toBe(tax);
    expect(r.report.penalty).toBe(Math.round(tax * 0.4));
    expect(r.report.late).toBe(Math.round(tax * 0.0003 * 3 * 365));
    expect(r.wallet.cash).toBe(500_000_000 - r.report.total);
    expect(r.wallet.hiddenGift).toBe(0);
    const clean = taxAudit(DATA, funded(100_000_000, 2016), 2016, 'suspicion');
    expect(clean.report.clean).toBe(true);
    expect(clean.report.total).toBe(Math.round(100_000_000 * 0.005));
  });
});

describe('settleYear', () => {
  it('이자·저축·평가·기록, 비교선은 같은 현금 흐름을 예금에', () => {
    const w: Wallet = { ...funded(1_000_000), income: { perYear: 100_000, label: '용돈' }, baseline: 1_000_000 };
    const r = settleYear(DATA, w, 2000, { trust: 60, sus: 0, rolls: [0.9, 0.9] });
    expect(r.report.interest).toBe(100_000);
    expect(r.wallet.cash).toBe(1_200_000);
    expect(r.wallet.baseline).toBe(1_200_000);
    expect(r.wallet.year).toBe(2001);
    expect(r.wallet.history).toEqual([{ year: 2000, netWorth: 1_200_000, baseline: 1_200_000 }]);
    expect(r.report.susDelta).toBe(0);
  });

  it('비정상 수익이면 수상함이 오르고, 90 넘으면 세무조사', () => {
    // 1억 → 삼성 2배 (1000→2000) 로 순이익 약 1억
    const b = buy(DATA, funded(100_000_000), 'samsung', 100_000_000, 1000, 2000).wallet;
    const w: Wallet = { ...b, year: 2001, lastNetWorth: 100_000_000 };
    const r = settleYear(DATA, w, 2001, { trust: 60, sus: 0, rolls: [0.9, 0.9] });
    expect(r.report.susDelta).toBeGreaterThan(0);
    const hot = settleYear(DATA, w, 2001, { trust: 60, sus: 88, rolls: [0.9, 0.9] });
    expect(hot.report.audit?.clean).toBe(true);
    expect(hot.sus).toBe(30);
  });

  it('미성년 + 낮은 신뢰면 부모가 몰래 판다(확률)', () => {
    const b = buy(DATA, funded(1_000_000), 'samsung', 1_000_000, 1000, 2000).wallet;
    const r = settleYear(DATA, b, 2000, { trust: 10, sus: 0, rolls: [0.1, 0.9] });
    expect(r.report.secretSale).not.toBeNull();
    expect(r.wallet.qty.samsung).toBeCloseTo(b.qty.samsung / 2, 6);
    const safe = settleYear(DATA, b, 2000, { trust: 10, sus: 0, rolls: [0.9, 0.9] });
    expect(safe.report.secretSale).toBeNull();
  });

  it('부채 이자는 기준금리 + 가산', () => {
    const w: Wallet = { ...funded(10_000_000), debt: 10_000_000 };
    const r = settleYear(DATA, w, 2000, { trust: 60, sus: 0, rolls: [0.9, 0.9] });
    expect(r.report.debtInterest).toBe(650_000);
    expect(netWorth(r.wallet)).toBe(10_000_000 + 1_000_000 - 650_000 - 10_000_000);
  });

  it('해외주식 양도세: 공제 초과분 22% — 이듬해 결산(5월 신고분)에 낸다, 연말 결산 매도분도 포함', () => {
    const b = buy(DATA, funded(10_000_000, 2012), 'aapl', 10_000_000, 10_000, 2012).wallet;
    const s = sell(DATA, b, 'aapl', 1, 20_000, 2012).wallet;
    const realized = s.realizedOverseas[2012];
    expect(realized).toBeGreaterThan(2_500_000);
    const r = settleYear(DATA, { ...s, lastNetWorth: 10_000_000 }, 2013, { trust: 60, sus: 0, rolls: [0.9, 0.9] });
    expect(r.report.overseasTax).toBe(Math.round((realized - 2_500_000) * 0.22));
  });
  it('엔딩 정산은 아직 안 낸 해외주식 양도세를 뺀다', () => {
    const b = buy(DATA, funded(10_000_000, 2025), 'aapl', 10_000_000, 10_000, 2025).wallet;
    const s = { ...sell(DATA, b, 'aapl', 1, 20_000, 2025).wallet, history: [{ year: 2024, netWorth: 0, baseline: 0 }] };
    const f = finalValuation(DATA, s);
    expect(f.overseasTax).toBe(Math.round((s.realizedOverseas[2025] - 2_500_000) * 0.22));
    expect(f.netWorth).toBe(netWorth(s) - f.overseasTax);
  });
  it('현금이 모자라면 수수료까지 감안해 팔고, 아파트는 팔지 않고 부채로 둔다', () => {
    let w: Wallet = { ...newWallet(2000), cash: 1_000_000_000 };
    w = buy(DATA, w, 'apt', 0, 100_000_000, 2000).wallet;
    w = buy(DATA, w, 'samsung', w.cash, 1000, 2000).wallet;
    const need = 1_000_000;
    const paid = pay(DATA, { ...w, cash: 0 }, need, 2000);
    expect(paid.qty.apt).toBe(1);
    expect(paid.debt).toBe(w.debt);
    const noLiquid = pay(DATA, { ...w, cash: 0, qty: { ...w.qty, samsung: 0 } }, need, 2000);
    expect(noLiquid.qty.apt).toBe(1);
    expect(noLiquid.debt).toBe(w.debt + need);
  });
  it('분할 전 주식은 1주 단위 — 삼성 2018-05-04 전엔 수정주가 50개가 1주', () => {
    expect(lotSize('samsung', '2000-10-18')).toBe(50);
    expect(lotSize('samsung', '2018-12-31')).toBe(1);
    expect(lotSize('aapl', '2007-01-09')).toBe(28);
    expect(lotSize('nvda', '2016-12-31')).toBe(40);
    expect(lotSize('tsla', '2018-12-31')).toBe(0); // 소수점 거래
    expect(lotSize('btc', '2010-07-17')).toBe(0);
    const w = { ...newWallet(2000), cash: 100_000 };
    expect(buy(DATA, w, 'samsung', 100_000, 2420, 2000, '2000-10-18').receipt).toMatchObject({ ok: false });
    const r = buy(DATA, { ...w, cash: 300_000 }, 'samsung', 300_000, 2420, 2000, '2000-10-18');
    expect(r.wallet.qty.samsung).toBe(100);
  });
});
