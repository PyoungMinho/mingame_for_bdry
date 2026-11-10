import { describe, expect, it } from 'vitest';
import { buildDisguise, chartData, DATA_ROWS, evaluate, formulaBarText, isEditableAddr, parseNumberInput, ROW, setInput, firstSelection, type DisguiseKind, type EvalRow } from './disguise';
import { DISGUISE_FIXTURES } from './disguise-fixtures';

const KINDS: DisguiseKind[] = ['accounting', 'sales', 'hr'];
const SEEDS = ['a', 'room-12345:key9', 'x', '777', '가나다', 'seed-6', 'seed-7', 'seed-8'];

const sumRaw = (rows: readonly EvalRow[], c: number) => rows.reduce((s, r) => s + (r.cells[c].raw ?? 0), 0);
const byR = (sheet: ReturnType<typeof evaluate>, r: number) => sheet.rows[r];
const dataRows = (sheet: ReturnType<typeof evaluate>, from: number, n: number) => sheet.rows.slice(from, from + n);

const INPUT_COLS: Record<DisguiseKind, number[]> = { accounting: [2, 3, 6], sales: [2, 3, 5, 7], hr: [2, 3, 4, 5] };

describe('disguise: 구조', () => {
  it.each(KINDS)('%s: 30행 × 10열, 행 종류가 디자인 B5와 같다', (kind) => {
    const sheet = evaluate(buildDisguise(DISGUISE_FIXTURES[kind], { seed: 's', asOf: '2026-11-07' }));
    expect(sheet.rows).toHaveLength(30);
    for (const r of sheet.rows) expect(r.cells).toHaveLength(10);
    expect(sheet.rows[ROW.sub1].kind).toBe('subtotal');
    expect(sheet.rows[ROW.total].kind).toBe('total');
    expect(sheet.rows[ROW.note].kind).toBe('note');
    expect(sheet.rows[ROW.title].height).toBe(28);
    expect(sheet.colWidths.every((w) => w % 8 === 0)).toBe(true);
  });

  it('같은 seed는 같은 숫자, 다른 seed는 다른 숫자', () => {
    const a = buildDisguise(DISGUISE_FIXTURES.accounting, { seed: 'k', asOf: 'd' });
    const b = buildDisguise(DISGUISE_FIXTURES.accounting, { seed: 'k', asOf: 'd' });
    const c = buildDisguise(DISGUISE_FIXTURES.accounting, { seed: 'k2', asOf: 'd' });
    expect(a.inputs).toEqual(b.inputs);
    expect(a.inputs).not.toEqual(c.inputs);
  });

  it('처음 선택 칸: 회계·영업 D4, 인사 F4', () => {
    expect(firstSelection(DISGUISE_FIXTURES.accounting)).toEqual({ c: 3, r: 3 });
    expect(firstSelection(DISGUISE_FIXTURES.hr)).toEqual({ c: 5, r: 3 });
  });
});

describe('disguise: 소계·합계가 실제로 맞는다 (seed 여러 개)', () => {
  for (const kind of KINDS) {
    it.each(SEEDS)(`${kind} seed=%s`, (seed) => {
      const sheet = evaluate(buildDisguise(DISGUISE_FIXTURES[kind], { seed, asOf: '2026-11-07' }));
      const g1 = dataRows(sheet, ROW.g1, 6);
      const g2 = dataRows(sheet, ROW.g2, 5);
      for (const c of INPUT_COLS[kind]) {
        expect(byR(sheet, ROW.sub1).cells[c].raw).toBe(sumRaw(g1, c));
        expect(byR(sheet, ROW.sub2).cells[c].raw).toBe(sumRaw(g2, c));
        expect(byR(sheet, ROW.total).cells[c].raw).toBe(sumRaw(g1, c) + sumRaw(g2, c));
      }
      // 눈으로 검산: 화면 글자(쉼표 제거)를 더해도 맞다 — 당월/실적/현원 칸(정수 칸)
      const textSum = (rows: readonly EvalRow[], c: number) => rows.reduce((s, r) => s + Number(r.cells[c].text.replace(/,/g, '').replace('-', '0')), 0);
      const c = 3;
      expect(Number(byR(sheet, ROW.sub1).cells[c].text.replace(/,/g, '').replace('-', '0'))).toBe(textSum(g1, c));
      expect(Number(byR(sheet, ROW.total).cells[c].text.replace(/,/g, '').replace('-', '0'))).toBe(textSum(g1, c) + textSum(g2, c));

      // 비율은 합계 칸 값으로 다시 계산한다
      const t = byR(sheet, ROW.total);
      if (kind === 'accounting') {
        expect(t.cells[4].raw).toBe((t.cells[3].raw as number) - (t.cells[2].raw as number));
        expect(t.cells[7].raw).toBe(Math.round(((t.cells[3].raw as number) * 1000) / (t.cells[6].raw as number)));
      } else if (kind === 'sales') {
        expect(t.cells[4].raw).toBe(Math.round(((t.cells[3].raw as number) * 1000) / (t.cells[2].raw as number)));
        expect(t.cells[8].raw).toBe(Math.round((t.cells[3].raw as number) / (t.cells[7].raw as number)));
      } else {
        expect(t.cells[6].raw).toBe((t.cells[4].raw as number) - (t.cells[5].raw as number));
        expect(t.cells[7].raw).toBe(Math.round(((t.cells[5].raw as number) * 1000) / (t.cells[4].raw as number)));
      }
    });
  }
});

describe('disguise: 숫자 규칙', () => {
  it.each(SEEDS)('회계: 당월·전월·예산이 범위 안 (seed=%s)', (seed) => {
    const m = buildDisguise(DISGUISE_FIXTURES.accounting, { seed, asOf: 'x' });
    for (const r of DATA_ROWS) {
      const cur = m.inputs[`D${r + 1}`];
      const prev = m.inputs[`C${r + 1}`];
      const bud = m.inputs[`G${r + 1}`];
      expect(cur).toBeGreaterThanOrEqual(1000);
      expect(cur).toBeLessThanOrEqual(90000);
      expect(prev).toBeGreaterThanOrEqual(Math.floor(cur * 0.75) - 1);
      expect(prev).toBeLessThanOrEqual(Math.ceil(cur * 1.25) + 1);
      expect(bud).toBeGreaterThanOrEqual(Math.floor(cur * 0.9) - 1);
      expect(bud).toBeLessThanOrEqual(Math.ceil(cur * 1.2) + 1);
    }
  });

  it('인사: 현원 ≤ 정원, 사용 ≤ 발생, 기준일은 모든 행 같은 날짜, 사람 이름 없음', () => {
    for (const seed of SEEDS) {
      const m = buildDisguise(DISGUISE_FIXTURES.hr, { seed, asOf: '2026-11-07' });
      const s = evaluate(m);
      for (const r of DATA_ROWS) {
        expect(m.inputs[`D${r + 1}`]).toBeLessThanOrEqual(m.inputs[`C${r + 1}`]);
        expect(m.inputs[`F${r + 1}`]).toBeLessThanOrEqual(m.inputs[`E${r + 1}`]);
        expect(s.rows[r].cells[8].text).toBe('2026-11-07');
      }
    }
  });

  it('영(0)은 -로 표시, 음수는 괄호', () => {
    const m = buildDisguise(DISGUISE_FIXTURES.accounting, { seed: 'z', asOf: 'x' });
    const m2 = { ...m, inputs: { ...m.inputs, C4: 5000, D4: 3000 } };
    const e = evaluate(m2).rows[3];
    expect(e.cells[4].text).toBe('(2,000)');
    expect(e.cells[4].neg).toBe(true);
    expect(e.cells[5].text).toBe('-40.0%');
  });
});

describe('disguise: 편집·재계산', () => {
  it('입력 칸을 고치면 소계·합계·증감이 바뀐다', () => {
    const m = buildDisguise(DISGUISE_FIXTURES.accounting, { seed: 'e', asOf: 'x' });
    const before = evaluate(m);
    const next = setInput(m, 'D4', 12345);
    const after = evaluate(next);
    expect(after.rows[3].cells[3].raw).toBe(12345);
    expect(after.rows[3].cells[4].raw).toBe(12345 - (after.rows[3].cells[2].raw as number));
    const delta = 12345 - (before.rows[3].cells[3].raw as number);
    expect(after.rows[ROW.sub1].cells[3].raw).toBe((before.rows[ROW.sub1].cells[3].raw as number) + delta);
    expect(after.rows[ROW.total].cells[3].raw).toBe((before.rows[ROW.total].cells[3].raw as number) + delta);
  });

  it('계산 칸·글자 칸·머리 행은 편집 불가(같은 모델 반환)', () => {
    const m = buildDisguise(DISGUISE_FIXTURES.accounting, { seed: 'e', asOf: 'x' });
    for (const a of ['E4', 'F4', 'H4', 'B4', 'C10', 'D17', 'C3', 'A1', 'I4']) {
      expect(isEditableAddr(m, a)).toBe(false);
      expect(setInput(m, a, 1)).toBe(m);
    }
    expect(isEditableAddr(m, 'C4')).toBe(true);
  });

  it('인사 발생·사용은 소수 1자리로 입력한다', () => {
    const m = buildDisguise(DISGUISE_FIXTURES.hr, { seed: 'h', asOf: 'x' });
    const n = setInput(m, 'E4', 12.5);
    expect(n.inputs.E4).toBe(125);
    const cell = evaluate(n).rows[3].cells[4];
    expect(cell.text).toBe('12.5');
    expect(formulaBarText(cell, n)).toBe('12.5');
  });

  it('수식 입력줄: 값 칸 = 값, 계산 칸 = 수식', () => {
    const m = buildDisguise(DISGUISE_FIXTURES.accounting, { seed: 'f', asOf: 'x' });
    const s = evaluate(m);
    expect(formulaBarText(s.rows[3].cells[4], m)).toBe('=D4-C4');
    expect(formulaBarText(s.rows[3].cells[5], m)).toBe('=E4/C4');
    expect(formulaBarText(s.rows[ROW.sub1].cells[3], m)).toBe('=SUM(D4:D9)');
    expect(formulaBarText(s.rows[ROW.total].cells[3], m)).toBe('=D10+D16');
    expect(formulaBarText(s.rows[3].cells[3], m)).toBe(String(m.inputs.D4));
  });

  it('숫자 입력 해석', () => {
    expect(parseNumberInput('1,234')).toBe(1234);
    expect(parseNumberInput(' (500) ')).toBe(-500);
    expect(parseNumberInput('12.5')).toBe(12.5);
    expect(parseNumberInput('abc')).toBeNull();
    expect(parseNumberInput('')).toBeNull();
  });
});

describe('disguise: 조건부 서식·차트', () => {
  it('영업: 달성률 100% 이상 good, 80% 미만 bad, 막대는 100 상한', () => {
    const m = buildDisguise(DISGUISE_FIXTURES.sales, { seed: 'cf', asOf: 'x' });
    const forced = { ...m, inputs: { ...m.inputs, C4: 1000, D4: 1200, C5: 1000, D5: 700, C6: 1000, D6: 900 } };
    const s = evaluate(forced);
    expect(s.rows[3].cells[4].cf).toBe('good');
    expect(s.rows[3].cells[4].barPct).toBe(100);
    expect(s.rows[4].cells[4].cf).toBe('bad');
    expect(s.rows[5].cells[4].cf).toBeNull();
    expect(s.rows[3].cells[6].text.startsWith('▲') || s.rows[3].cells[6].text.startsWith('▼') || s.rows[3].cells[6].text === '-').toBe(true);
  });

  it('회계: 집행률 > 100% bad, |증감률| > 10% warn', () => {
    const m = buildDisguise(DISGUISE_FIXTURES.accounting, { seed: 'cf', asOf: 'x' });
    const forced = { ...m, inputs: { ...m.inputs, C4: 1000, D4: 1200, G4: 1000 } };
    const row = evaluate(forced).rows[3];
    expect(row.cells[7].cf).toBe('bad');
    expect(row.cells[5].cf).toBe('warn');
  });

  it.each(KINDS)('%s 차트: 묶음1 6막대', (kind) => {
    const sheet = evaluate(buildDisguise(DISGUISE_FIXTURES[kind], { seed: 'c', asOf: 'x' }));
    const ch = chartData(sheet);
    expect(ch.bars).toHaveLength(6);
    expect(ch.series).toHaveLength(kind === 'accounting' ? 2 : 1);
    expect(ch.max).toBeGreaterThan(0);
    for (const b of ch.bars) for (const v of b.values) expect(v).toBeLessThanOrEqual(ch.max);
  });
});
