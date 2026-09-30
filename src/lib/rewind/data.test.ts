/**
 * 시장 데이터 무결성 — market-data.ts 가 2차 감사 verified-data.json 과 한 치도 다르지 않은지.
 * 누가 숫자를 손으로 고치면 여기서 깨진다.
 */
import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { ASSET_IDS } from './contract';
import { MARKET } from './market-data';
import { OVERSEAS_FRACTIONAL_FROM, SPLITS } from './market';
import type { PricePoint } from './types';

interface AuditItem {
  id: string;
  value: unknown;
  status: string;
}
const AUDIT: Record<string, AuditItem> = Object.fromEntries(
  (JSON.parse(fs.readFileSync(path.resolve(__dirname, '../../../docs/research/rewind/audit/verified-data.json'), 'utf8')).items as AuditItem[]).map((i) => [i.id, i]),
);

/** "audit:a×audit:b" 형태의 src 에서 감사 id 들을 뽑는다 */
function ids(src: string): string[] {
  return [...src.matchAll(/(?:audit:)?([a-z0-9_]+(?:\.[A-Za-z0-9_-]+)+)/g)].map((m) => m[1]).filter((id) => id in AUDIT);
}

function allPoints(): [string, PricePoint][] {
  const out: [string, PricePoint][] = [];
  for (const y of Object.values(MARKET.years)) for (const [a, p] of Object.entries(y.prices)) out.push([`${y.year}.${a}`, p!]);
  for (const [a, p] of Object.entries(MARKET.final.prices)) out.push([`final.${a}`, p]);
  for (const e of Object.values(MARKET.events)) for (const [a, p] of Object.entries(e.prices)) out.push([`${e.id}.${a}`, p!]);
  return out;
}

describe('시장 데이터', () => {
  it('2000~2025 모든 해에 환율·금리·핵심 자산 가격', () => {
    for (let y = 2000; y <= 2025; y++) {
      const r = MARKET.years[y];
      expect(r, `${y}`).toBeDefined();
      expect(r.fx).toBeGreaterThan(800);
      expect(r.depositRate).toBeGreaterThan(0);
      expect(r.baseRate).toBeGreaterThan(0);
      for (const a of ['samsung', 'aapl', 'nvda', 'gold', 'usd', 'apt'] as const) expect(r.prices[a]?.krw, `${y} ${a}`).toBeGreaterThan(0);
      expect(Boolean(r.prices.tsla), `${y} tsla`).toBe(y >= 2010);
      expect(Boolean(r.prices.btc), `${y} btc`).toBe(y >= 2010);
    }
  });

  it('엔딩 기준일(2026-09-29)에 8개 자산 전부', () => {
    for (const a of ASSET_IDS) expect(MARKET.final.prices[a]?.krw, a).toBeGreaterThan(0);
  });

  it('모든 가격의 출처는 verified/corrected 감사 항목이고, 원값이 감사값과 정확히 같다', () => {
    for (const [where, p] of allPoints()) {
      const refs = ids(p.src);
      expect(refs.length, `${where} 출처 없음: ${p.src}`).toBeGreaterThan(0);
      for (const id of refs) expect(['verified', 'corrected'], `${where} ← ${id}`).toContain(AUDIT[id].status);
      const main = AUDIT[refs[0]];
      const raw = p.usd ?? p.krw;
      const scale = refs[0].startsWith('eunma76') ? 10_000 : 1;
      expect(raw, `${where} 값이 감사값과 다름 (${refs[0]})`).toBeCloseTo(Number(main.value) * scale, 6);
      if (p.usd !== undefined && refs[1]?.startsWith('usdkrw')) {
        expect(p.krw, `${where} 환산`).toBeCloseTo(p.usd * Number(AUDIT[refs[1]].value), 3);
      }
    }
  });

  it('사건 시세: id·날짜 형식, 2008~2009 달러 추정 제외', () => {
    for (const e of Object.values(MARKET.events)) {
      expect(e.id).toBe(`ev-${e.date}`);
      expect(e.date).toMatch(/^20\d{2}-\d{2}(-\d{2})?$/);
      for (const [a, p] of Object.entries(e.prices)) {
        expect(p!.krw, `${e.id} ${a}`).toBeGreaterThan(0);
        if (p!.estimated) expect(['2008', '2009']).not.toContain(e.date.slice(0, 4));
      }
    }
  });

  it('주식 분할 표는 감사값(날짜·배수)과 같다', () => {
    for (const [asset, list] of Object.entries(SPLITS)) {
      for (const sp of list!) {
        const item = AUDIT[`${asset}.split.${sp.date}`];
        expect(item, `${asset}.split.${sp.date}`).toBeDefined();
        expect(['verified', 'corrected']).toContain(item.status);
        expect(Number(item.value)).toBe(sp.ratio);
      }
    }
    expect(['verified', 'corrected']).toContain(AUDIT['overseas_stock.fractional_first'].status);
    expect(OVERSEAS_FRACTIONAL_FROM.replace(/-/g, '').slice(0, 6)).toBe(String(AUDIT['overseas_stock.fractional_first'].value));
  });

  it('규칙: 성년 2013, 해외주식 2007, 증여세 최고 50%', () => {
    expect(MARKET.rules.adultYear).toBe(2013);
    expect(MARKET.rules.overseasFrom).toBe(2007);
    expect(MARKET.rules.giftTax.at(-1)?.rate).toBe(0.5);
  });
});
