import { describe, expect, it } from 'vitest';
import { ASSET_IDS } from './contract';
import {
  applyChoice,
  beginSettle,
  ChoiceError,
  endSettle,
  finalize,
  formatKRW,
  progress,
  newRun,
  restoreRun,
  settleTrade,
  visibleChoices,
  type RunState,
} from './engine';
import type { AssetId, Ending, MarketData, PricePoint, StoryNode } from './types';

const p = (krw: number): PricePoint => ({ krw, src: 'fixture' });
const years: MarketData['years'] = {};
for (let y = 2000; y <= 2025; y++) {
  years[y] = { year: y, fx: 1000, depositRate: 0, baseRate: 3, prices: { samsung: p(1000 * (y - 1999)), usd: p(1000), gold: p(50_000) } };
}
const DATA: MarketData = {
  years,
  final: { date: '2026-09-29', fx: 1000, prices: Object.fromEntries(ASSET_IDS.map((a) => [a, p(a === 'samsung' ? 100_000 : 1)])) as Record<AssetId, PricePoint> },
  events: {
    ev2000: { id: 'ev2000', date: '2000-03-01', label: '버블', prices: { samsung: p(500) } },
  },
  rules: {
    feeDomestic: [{ from: 2000, rate: 0 }],
    txTaxDomestic: [{ from: 2000, rate: 0 }],
    feeOverseas: [{ from: 2000, rate: 0 }],
    overseasGainTax: { from: 2000, rate: 0.22, deduction: 2_500_000 },
    feeCrypto: [{ from: 2000, rate: 0 }],
    goldRetailCostUntil: 2014,
    goldRetailCost: 0.1,
    ltv: [{ from: 2000, rate: 0.5 }],
    loanBanAbove: [],
    loanCap: [],
    aptAcquisitionTax: [{ from: 2000, rate: 0 }],
    giftTax: [{ upTo: Infinity, rate: 0.1, deduction: 0 }],
    giftDeduction: [{ from: 2000, minor: 0, adult: 0 }],
    penaltyFraud: [{ from: 2000, rate: 0.4 }],
    giftReportCredit: [{ from: 2000, rate: 0 }],
    totoTax: { rate: 0.22, floor: 10_000 },
    lateDaily: [{ from: 2000, rate: 0 }],
    loanSpread: 1.5,
    overseasFrom: 2007,
    cryptoDomesticFrom: 2013,
    adultYear: 2013,
  },
};

const node = (id: string, date: string, over: Partial<StoryNode>): StoryNode => ({ id, chapter: 1, date, scene: 's', title: id, body: ['본문'], choices: [], ...over });

const NODES: Record<string, StoryNode> = {
  start: node('start', '2000-01', {
    choices: [
      {
        id: 'buy',
        label: '세뱃돈으로 삼성을 산다',
        tags: ['hodl'],
        outcomes: [{ effects: { cash: 100_000, trades: [{ kind: 'buy', asset: 'samsung', pct: 1, at: 'ev2000' }] }, result: ['샀다'], next: 'y2003' }],
      },
      { id: 'save', label: '저금한다', tags: ['safe'], outcomes: [{ effects: { cash: 100_000 }, result: ['저금'], next: 'y2003' }] },
      { id: 'secret', label: '비밀', requires: { adult: true }, lockedHint: '어른이 되면…', outcomes: [{ result: ['x'], next: 'y2003' }] },
    ],
  }),
  y2003: node('y2003', '2003-05', {
    choices: [
      { id: 'honest', label: '신고한다', tags: ['honest'], outcomes: [{ effects: { transfer: 'declare' }, result: ['신고'], next: 'last' }] },
      { id: 'hide', label: '숨긴다', tags: ['sly'], outcomes: [{ effects: { transfer: 'hide', sus: 10 }, result: ['숨김'], next: 'last' }] },
    ],
  }),
  last: node('last', '2026-09', {
    choices: [{ id: 'fin', label: '끝', outcomes: [{ result: ['끝'], next: 'end' }] }],
  }),
};

const ENDINGS: Ending[] = [
  { id: 'rich', when: { minNetWorth: 1_000_000_000 }, title: '부자', scene: 's', body: ['부자다'], epitaph: '부' },
  { id: 'plain', title: '평범', scene: 's', body: ['평범', { when: { flags: ['sus40'] }, text: '수상했다' }], epitaph: '평' },
];

/** 결산을 끝까지 넘긴다(매매 없이) */
function drain(s: RunState): RunState {
  let cur = s;
  let guard = 0;
  while (cur.pending.length && guard++ < 50) cur = endSettle(beginSettle(cur, DATA));
  return cur;
}

describe('흐름', () => {
  it('시작 상태', () => {
    const s = newRun(1, 'm', 'start');
    expect(s.wallet.year).toBe(2000);
    expect(s.gender).toBe('m');
    expect(visibleChoices(s, NODES.start, DATA).map((c) => `${c.choice.id}:${c.status}`)).toEqual(['buy:open', 'save:open', 'secret:locked']);
  });

  it('순간 매매는 사건 시세로 체결되고, 연도가 넘어가면 사이 결산이 쌓인다', () => {
    const r = applyChoice(newRun(1, 'm', 'start'), NODES, DATA, 'buy');
    expect(r.delta.trades[0]).toMatchObject({ ok: true, price: 500 });
    expect(r.state.wallet.qty.samsung).toBeCloseTo(200, 9);
    expect(r.state.pending).toEqual([2000, 2001, 2002]);
    expect(() => applyChoice(r.state, NODES, DATA, 'honest')).toThrow(ChoiceError); // 사이 결산을 건너뛸 수 없다
  });

  it('결산: 연말가 평가·기록, 결산 매매는 그해 연말가', () => {
    const r = applyChoice(newRun(1, 'm', 'start'), NODES, DATA, 'buy');
    let s = beginSettle(r.state, DATA);
    expect(s.settling?.year).toBe(2000);
    expect(s.wallet.mark.samsung).toBe(1000);
    expect(s.wallet.history.at(-1)).toMatchObject({ year: 2000, netWorth: 200_000 });
    const t = settleTrade(s, DATA, { asset: 'samsung', side: 'sell', pct: 0.5 });
    expect(t.receipt).toMatchObject({ ok: true, price: 1000 });
    s = endSettle(t.state);
    expect(s.pending).toEqual([2001, 2002]);
    expect(s.settling).toBeNull();
  });

  it('결산 중엔 선택 불가', () => {
    const r = applyChoice(newRun(1, 'm', 'start'), NODES, DATA, 'buy');
    const s = beginSettle(r.state, DATA);
    expect(() => applyChoice(s, NODES, DATA, 'honest')).toThrow(ChoiceError);
  });

  it('명의 이전 신고 → 증여세, 숨김 → 차명 기록', () => {
    const a = drain(applyChoice(newRun(1, 'm', 'start'), NODES, DATA, 'buy').state);
    const declared = applyChoice(a, NODES, DATA, 'honest');
    expect(declared.delta.transfer?.mode).toBe('declare');
    expect(declared.delta.transfer?.tax).toBeGreaterThan(0);
    const hidden = applyChoice(a, NODES, DATA, 'hide');
    expect(hidden.state.wallet.hiddenGift).toBeGreaterThan(0);
  });

  it('end → 2025년까지 결산 후 2026 기준일 가격으로 정산, 결말 선택', () => {
    let s = drain(applyChoice(newRun(1, 'm', 'start'), NODES, DATA, 'buy').state);
    s = applyChoice(s, NODES, DATA, 'honest').state;
    expect(s.pending[0]).toBe(2003);
    expect(s.pending.at(-1)).toBe(2025);
    s = drain(s);
    s = applyChoice(s, NODES, DATA, 'fin').state;
    expect(s.toEnd).toBe(true);
    expect(s.pending).toEqual([]);
    expect(() => finalize({ ...s, pending: [2025] }, DATA, ENDINGS)).toThrow(ChoiceError);
    s = finalize(s, DATA, ENDINGS);
    expect(s.final?.netWorth).toBeGreaterThan(0);
    expect(s.wallet.history.map((h) => h.year)).toEqual(Array.from({ length: 26 }, (_, i) => 2000 + i));
    expect(s.final?.trait.tag).toBe('hodl');
  });

  it('저금만 한 판과 산 판의 비교선은 같다(같은 현금 흐름)', () => {
    const buyer = drain(applyChoice(newRun(1, 'm', 'start'), NODES, DATA, 'buy').state);
    const saver = drain(applyChoice(newRun(1, 'm', 'start'), NODES, DATA, 'save').state);
    expect(buyer.wallet.baseline).toBe(saver.wallet.baseline);
  });

  it('저장 복원', () => {
    const s = applyChoice(newRun(1, 'f', 'start'), NODES, DATA, 'save').state;
    expect(restoreRun(JSON.parse(JSON.stringify(s)), NODES)).toEqual(s);
    expect(restoreRun({ ...s, gender: 'x' }, NODES)).toBeNull();
    expect(restoreRun({ ...s, nodeId: 'gone' }, NODES)).toBeNull();
  });
});

describe('세무조사 플래그', () => {
  it('조사로 수상함이 30으로 내려가도 그해 최고치로 sus 단계가 켜지고, audited·audit_penalty 가 남는다', () => {
    let s = applyChoice(newRun(1, 'm', 'start'), NODES, DATA, 'buy').state;
    s = drain(s);
    s = applyChoice(s, NODES, DATA, 'hide').state; // 차명
    s = { ...s, stats: { ...s.stats, sus: 95 }, pending: [2003] };
    s = beginSettle(s, DATA);
    expect(s.settling?.report.audit).toBeTruthy();
    expect(s.stats.sus).toBe(30);
    expect(s.flags).toEqual(expect.arrayContaining(['sus90', 'audited', 'audited_2003', 'audit_penalty']));
  });
});

describe('저장 복원과 진행', () => {
  it('마지막 선택 직후 저장 → 복원 → progress 만으로 엔딩까지 간다(소프트락 없음)', () => {
    let s = drain(applyChoice(newRun(1, 'm', 'start'), NODES, DATA, 'buy').state);
    s = drain(applyChoice(s, NODES, DATA, 'honest').state);
    s = applyChoice(s, NODES, DATA, 'fin').state;
    let r = restoreRun(JSON.parse(JSON.stringify(s)), NODES)!;
    expect(r).not.toBeNull();
    expect(() => applyChoice(r, NODES, DATA, 'fin')).toThrow(ChoiceError);
    for (let i = 0; i < 40 && !r.final; i++) r = r.settling ? endSettle(r) : progress(r, DATA, ENDINGS);
    expect(r.final).toBeTruthy();
  });
  it('깨진 저장은 거부한다', () => {
    expect(restoreRun({ v: 1, nodeId: 'start', gender: 'm', wallet: { cash: 0 }, stats: {}, flags: [] }, NODES)).toBeNull();
    const ok = newRun(1, 'm', 'start');
    expect(restoreRun({ ...ok, pending: [1999] }, NODES)).toBeNull();
    expect(restoreRun({ ...ok, settling: { year: 2000 } }, NODES)).toBeNull();
  });
});

describe('체결 가능한 결과만', () => {
  const TN: Record<string, StoryNode> = {
    a: node('a', '2000-10', {
      choices: [
        { id: 'buy', label: '산다', outcomes: [{ when: { max: { trust: 34 } }, result: ['거절'], next: 'z' }, { effects: { trust: -30, trades: [{ kind: 'buy', asset: 'samsung', pct: 1, at: 'ev2000' }] }, result: ['체결'], next: 'z' }] },
        { id: 'wait', label: '구경', outcomes: [{ result: ['구경'], next: 'z' }] },
      ],
    }),
    z: node('z', '2000-12', { choices: [{ id: 'fin', label: '끝', outcomes: [{ result: ['끝'], next: 'end' }] }] }),
  };
  it('현금이 없으면 매매 선택지는 이유와 함께 잠긴다', () => {
    const s = newRun(1, 'm', 'a');
    const v = visibleChoices(s, TN.a, DATA);
    expect(v[0]).toMatchObject({ status: 'locked', hint: '살 돈이 없다' });
    expect(() => applyChoice(s, TN, DATA, 'buy')).toThrow(ChoiceError);
  });
  it('신뢰를 깎는 효과가 있어도 명의 판단은 선택 전 신뢰로 — 체결된다', () => {
    const s = { ...newRun(1, 'm', 'a'), wallet: { ...newRun(1, 'm', 'a').wallet, cash: 1_000_000 } };
    const r = applyChoice(s, TN, DATA, 'buy');
    expect(r.result).toEqual(['체결']);
    expect(r.delta.trades[0].ok).toBe(true);
    expect(r.state.stats.trust).toBe(30);
  });
  it('신뢰가 낮으면 매매 없는 거절 결과로', () => {
    const s = { ...newRun(1, 'm', 'a'), stats: { trust: 20, happy: 60, health: 85, sus: 0 } };
    expect(applyChoice(s, TN, DATA, 'buy').result).toEqual(['거절']);
  });
});

describe('formatKRW', () => {
  it('한국식 금액', () => {
    expect(formatKRW(5000)).toBe('5,000원');
    expect(formatKRW(48_000)).toBe('4만 8,000원');
    expect(formatKRW(123_450_000)).toBe('1억 2,345만원');
    expect(formatKRW(2_500_000_000_000)).toBe('2조 5,000억원');
    expect(formatKRW(-30_000_000)).toBe('−3,000만원');
  });
});
