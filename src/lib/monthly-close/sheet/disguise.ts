/**
 * 숨기기 시트 데이터 — seed → 업종별 30행 × 10열, 소계·합계가 실제로 맞는다 (소유: 컴포넌트개발자).
 *
 * 순수 TS. 문구는 문구 팩(copy)의 `disguise` 필드를 그대로 받는다(DisguiseSpec은 그 모양의 구조적 부분집합).
 * 행 구성(디자인 B5): 1 제목 / 2 부제 / 3 머리 / 4~9 묶음1 / 10 소계1 / 11~15 묶음2 / 16 소계2 / 17 합계 /
 *                     18 빈 행 / 19~29 차트 영역 / 30 비고.
 * 계산 규칙: 입력 칸(정수)만 저장하고 나머지는 evaluate()가 매번 다시 계산한다. 범용 수식 파서는 없다.
 * 표시는 정수 기준이며 비율은 천분율 정수(rate10)로 계산해 부동소수 오차가 없다.
 *  - hr의 소수 1자리 일수는 내부에서 10배 정수(tenths)로 다룬다.
 */

import type { Pt } from './sheet-model';
import { colName } from '../coords';

export type DisguiseKind = 'accounting' | 'sales' | 'hr';
export type DisguiseFormat = 'code' | 'txt' | 'num' | 'dec1' | 'pct' | 'date';

type Range2 = readonly [number, number];

export type DisguiseRule =
  | {
      readonly kind: 'accounting';
      readonly current: Range2;
      readonly prevDeltaPct: number;
      readonly budgetPct: Range2;
      readonly classes: readonly string[];
      readonly owners: readonly string[];
    }
  | { readonly kind: 'sales'; readonly target: Range2; readonly achievePct: Range2; readonly count: Range2 }
  | {
      readonly kind: 'hr';
      readonly headcount: Range2;
      readonly vacancyMax: number;
      readonly accrualPerHead: Range2;
      readonly usagePct: Range2;
    };

export interface DisguiseSpec {
  readonly title: string;
  readonly subtitle: string;
  readonly columns: readonly {
    readonly head: string;
    readonly width: number;
    readonly format: DisguiseFormat;
    readonly maxChars: number;
  }[];
  readonly groups: readonly [DisguiseGroupSpec, DisguiseGroupSpec];
  readonly totalLabel: string;
  readonly rule: DisguiseRule;
  readonly chart: { readonly title: string; readonly baselinePct: number | null };
  readonly firstCell: string;
  readonly note: string;
}

export interface DisguiseGroupSpec {
  readonly name: string;
  readonly subtotal: string;
  readonly rows: readonly { readonly code: string; readonly name: string }[];
}

// ─── 행 구성 상수 ─────────────────────────────────────────────────────────────

export const DISGUISE_ROWS = 30;
export const DISGUISE_COLS = 10;
/** 0기준 행 인덱스 */
export const ROW = {
  title: 0,
  subtitle: 1,
  head: 2,
  g1: 3, // 3..8
  sub1: 9,
  g2: 10, // 10..14
  sub2: 15,
  total: 16,
  blank: 17,
  chartFrom: 18,
  chartTo: 28,
  note: 29,
} as const;

export type RowKind = 'title' | 'subtitle' | 'head' | 'data' | 'subtotal' | 'total' | 'blank' | 'chart' | 'note';

export function rowKindOf(r: number): RowKind {
  if (r === ROW.title) return 'title';
  if (r === ROW.subtitle) return 'subtitle';
  if (r === ROW.head) return 'head';
  if (r === ROW.sub1 || r === ROW.sub2) return 'subtotal';
  if (r === ROW.total) return 'total';
  if (r === ROW.blank) return 'blank';
  if (r >= ROW.chartFrom && r <= ROW.chartTo) return 'chart';
  if (r === ROW.note) return 'note';
  return 'data';
}

export const rowHeightOf = (r: number): number => (r === ROW.title ? 28 : 24);

// ─── 난수 (seed 고정, 결정적) ──────────────────────────────────────────────────

/** 문자열 → 32비트 시드 (xmur3). */
export function hashSeed(...parts: string[]): number {
  const str = parts.join('\u0001');
  let h = 1779033703 ^ str.length;
  for (let i = 0; i < str.length; i++) {
    h = Math.imul(h ^ str.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  h = Math.imul(h ^ (h >>> 16), 2246822507);
  h = Math.imul(h ^ (h >>> 13), 3266489909);
  return (h ^= h >>> 16) >>> 0;
}

function mulberry32(a: number): () => number {
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ─── 모델 ─────────────────────────────────────────────────────────────────────

export interface DisguiseModel {
  readonly kind: DisguiseKind;
  readonly spec: DisguiseSpec;
  /** 마지막 저장 날짜 yyyy-mm-dd (인사 I열·부제) */
  readonly asOf: string;
  /** 입력 칸 값(내부 단위). 키 = 주소("D4") */
  readonly inputs: Readonly<Record<string, number>>;
  /** 글자 칸(구분·담당) 값. 키 = 주소 */
  readonly texts: Readonly<Record<string, string>>;
}

export interface BuildOpts {
  readonly seed: number | string;
  readonly asOf: string;
}

const INPUT_LETTERS: Record<DisguiseKind, readonly string[]> = {
  accounting: ['C', 'D', 'G'],
  sales: ['C', 'D', 'F', 'H'],
  hr: ['C', 'D', 'E', 'F'],
};

/** 데이터 행(0기준) 목록: 묶음1 6행 + 묶음2 5행 */
export const DATA_ROWS: readonly number[] = [
  ...Array.from({ length: 6 }, (_, i) => ROW.g1 + i),
  ...Array.from({ length: 5 }, (_, i) => ROW.g2 + i),
];

const addrOf = (letter: string, r: number) => `${letter}${r + 1}`;

export function buildDisguise(spec: DisguiseSpec, opts: BuildOpts): DisguiseModel {
  const kind = spec.rule.kind;
  const rng = mulberry32(typeof opts.seed === 'number' ? opts.seed >>> 0 : hashSeed(opts.seed));
  const int = (lo: number, hi: number) => lo + Math.floor(rng() * (hi - lo + 1));
  const pick = <T,>(xs: readonly T[]): T => xs[Math.floor(rng() * xs.length)];
  const inputs: Record<string, number> = {};
  const texts: Record<string, string> = {};
  const rule = spec.rule;

  for (const r of DATA_ROWS) {
    if (rule.kind === 'accounting') {
      const cur = int(rule.current[0], rule.current[1]);
      const d = int(-rule.prevDeltaPct, rule.prevDeltaPct);
      const prev = Math.max(1, Math.round((cur * (100 + d)) / 100));
      const budget = Math.max(1, Math.round((cur * int(rule.budgetPct[0], rule.budgetPct[1])) / 100));
      inputs[addrOf('C', r)] = prev;
      inputs[addrOf('D', r)] = cur;
      inputs[addrOf('G', r)] = budget;
      texts[addrOf('I', r)] = pick(rule.classes);
      texts[addrOf('J', r)] = pick(rule.owners);
    } else if (rule.kind === 'sales') {
      const target = int(rule.target[0], rule.target[1]);
      const actual = Math.max(1, Math.round((target * int(rule.achievePct[0], rule.achievePct[1])) / 100));
      inputs[addrOf('C', r)] = target;
      inputs[addrOf('D', r)] = actual;
      inputs[addrOf('F', r)] = Math.max(1, Math.round((actual * int(85, 115)) / 100));
      inputs[addrOf('H', r)] = Math.max(1, int(rule.count[0], rule.count[1]));
    } else {
      const head = int(rule.headcount[0], rule.headcount[1]);
      const cur = Math.max(1, head - int(0, rule.vacancyMax));
      const perHeadTenths = int(Math.round(rule.accrualPerHead[0] * 10), Math.round(rule.accrualPerHead[1] * 10));
      const accrued = cur * perHeadTenths; // tenths
      const used = Math.round((accrued * int(rule.usagePct[0], rule.usagePct[1])) / 100); // tenths
      inputs[addrOf('C', r)] = head;
      inputs[addrOf('D', r)] = cur;
      inputs[addrOf('E', r)] = accrued;
      inputs[addrOf('F', r)] = used;
    }
  }
  return { kind, spec, asOf: opts.asOf, inputs, texts };
}

// ─── 평가 ─────────────────────────────────────────────────────────────────────

export type CfTone = 'bad' | 'warn' | 'good' | 'bar';
export type CellAlign = 'left' | 'right' | 'center';

export interface EvalCell {
  readonly addr: string;
  readonly c: number;
  readonly r: number;
  /** 화면 글자 */
  readonly text: string;
  /** 숫자 칸의 내부 단위 값(hr dec1은 10배 정수). 글자 칸은 null */
  readonly raw: number | null;
  /** 계산 칸의 수식 문자열(수식 입력줄용). 값 칸·글자 칸은 null */
  readonly formula: string | null;
  readonly editable: boolean;
  readonly align: CellAlign;
  readonly bold: boolean;
  readonly neg: boolean;
  readonly cf: CfTone | null;
  /** 데이터 막대 길이(0~100). 없으면 null */
  readonly barPct: number | null;
  /** 오른쪽으로 병합하는 칸 수(1 = 병합 없음). 병합에 덮인 칸은 hidden */
  readonly span: number;
  readonly hidden: boolean;
}

export interface EvalRow {
  readonly r: number;
  readonly kind: RowKind;
  readonly height: number;
  readonly cells: readonly EvalCell[];
}

export interface EvaluatedSheet {
  readonly kind: DisguiseKind;
  readonly rows: readonly EvalRow[];
  readonly colWidths: readonly number[];
  readonly spec: DisguiseSpec;
}

const thousands = (n: number) => String(Math.abs(Math.trunc(n))).replace(/\B(?=(\d{3})+(?!\d))/g, ',');

/** 회계 서식: 0 → '-', 음수 → (1,234) */
export function fmtNum(n: number): string {
  if (n === 0) return '-';
  return n < 0 ? `(${thousands(n)})` : thousands(n);
}

/** 10배 정수 → 소수 1자리. 0 → '-', 음수 → (1.5) */
export function fmtDec1(t: number): string {
  if (t === 0) return '-';
  const s = (Math.abs(t) / 10).toFixed(1);
  return t < 0 ? `(${s})` : s;
}

/** 천분율 정수 → 12.3% (분모 0이면 '-') */
export function fmtRate(rate10: number | null): string {
  if (rate10 === null) return '-';
  return `${(rate10 / 10).toFixed(1)}%`;
}

/** 분자/분모 → 천분율 정수. 분모 0이면 null. */
export function rate10Of(num: number, den: number): number | null {
  if (den === 0) return null;
  return Math.round((num * 1000) / den);
}

interface Spot {
  raw: number | null;
  text: string;
  formula?: string | null;
  editable?: boolean;
  neg?: boolean;
  cf?: CfTone | null;
  barPct?: number | null;
  bold?: boolean;
}

type Vals = Record<string, number>;
type Mode = 'data' | 'sub' | 'total';

function ref(l: string, r: number) {
  return `${l}${r + 1}`;
}

/** 한 행의 숫자 칸을 만든다. v = 입력 칸 값 + (sub/total이면 이미 합산된 값). */
function numericSpots(kind: DisguiseKind, v: Vals, r: number, mode: Mode, sumFrom?: readonly [number, number], parts?: readonly [number, number]): Record<string, Spot> {
  const out: Record<string, Spot> = {};
  const inLetters = INPUT_LETTERS[kind];
  const isData = mode === 'data';
  const sumFormula = (l: string): string | null => {
    if (mode === 'sub' && sumFrom) return `=SUM(${ref(l, sumFrom[0])}:${ref(l, sumFrom[1])})`;
    if (mode === 'total' && parts) return `=${ref(l, parts[0])}+${ref(l, parts[1])}`;
    return null;
  };
  const num = (l: string, fmt: (n: number) => string = fmtNum): Spot => ({
    raw: v[l],
    text: fmt(v[l]),
    editable: isData,
    formula: sumFormula(l),
    neg: v[l] < 0,
  });
  for (const l of inLetters) out[l] = num(l, kind === 'hr' && (l === 'E' || l === 'F') ? fmtDec1 : fmtNum);

  const calc = (raw: number | null, text: string, formula: string, extra: Partial<Spot> = {}): Spot => ({
    raw,
    text,
    formula,
    editable: false,
    neg: raw !== null && raw < 0 && !text.endsWith('%'),
    ...extra,
  });

  if (kind === 'accounting') {
    const diff = v.D - v.C;
    const f = rate10Of(diff, v.C);
    const h = rate10Of(v.D, v.G);
    out.E = calc(diff, fmtNum(diff), `=${ref('D', r)}-${ref('C', r)}`);
    out.F = calc(f, fmtRate(f), `=${ref('E', r)}/${ref('C', r)}`, {
      neg: false,
      cf: isData && f !== null && Math.abs(f) > 100 ? 'warn' : null,
    });
    out.H = calc(h, fmtRate(h), `=${ref('D', r)}/${ref('G', r)}`, {
      neg: false,
      cf: isData && h !== null && h > 1000 ? 'bad' : null,
    });
  } else if (kind === 'sales') {
    const rate = rate10Of(v.D, v.C);
    const diff = v.D - v.F;
    const avg = v.H === 0 ? 0 : Math.round(v.D / v.H);
    const arrow = diff > 0 ? `▲ ${fmtNum(diff)}` : diff < 0 ? `▼ ${fmtNum(diff)}` : '-';
    out.E = calc(rate, fmtRate(rate), `=${ref('D', r)}/${ref('C', r)}`, {
      neg: false,
      cf: isData && rate !== null ? (rate >= 1000 ? 'good' : rate < 800 ? 'bad' : null) : null,
      barPct: isData && rate !== null ? Math.max(0, Math.min(100, rate / 10)) : null,
      bold: isData && rate !== null && rate >= 1000,
    });
    out.G = calc(diff, arrow, `=${ref('D', r)}-${ref('F', r)}`);
    out.I = calc(avg, fmtNum(avg), `=${ref('D', r)}/${ref('H', r)}`);
  } else {
    const remain = v.E - v.F;
    const rate = rate10Of(v.F, v.E);
    out.G = calc(remain, fmtDec1(remain), `=${ref('E', r)}-${ref('F', r)}`);
    out.H = calc(rate, fmtRate(rate), `=${ref('F', r)}/${ref('E', r)}`, {
      neg: false,
      cf: isData && rate !== null ? (rate >= 700 ? 'bar' : rate >= 400 ? 'good' : null) : null,
    });
  }
  return out;
}

const NUM_LETTERS: Record<DisguiseKind, readonly string[]> = {
  accounting: ['C', 'D', 'E', 'F', 'G', 'H'],
  sales: ['C', 'D', 'E', 'F', 'G', 'H', 'I'],
  hr: ['C', 'D', 'E', 'F', 'G', 'H'],
};

function sumVals(kind: DisguiseKind, rows: readonly Vals[]): Vals {
  const out: Vals = {};
  for (const l of INPUT_LETTERS[kind]) out[l] = rows.reduce((s, x) => s + x[l], 0);
  return out;
}

export function evaluate(model: DisguiseModel): EvaluatedSheet {
  const { kind, spec } = model;
  const cols = spec.columns;
  const colWidths = cols.map((c) => c.width);
  const alignOf = (c: number): CellAlign => {
    const f = cols[c]?.format;
    return f === 'txt' ? 'left' : f === 'num' || f === 'dec1' || f === 'pct' ? 'right' : 'center';
  };

  const mkText = (c: number, r: number, text: string, extra: Partial<EvalCell> = {}): EvalCell => ({
    addr: addrOf(colName(c), r),
    c,
    r,
    text,
    raw: null,
    formula: null,
    editable: false,
    align: alignOf(c),
    bold: false,
    neg: false,
    cf: null,
    barPct: null,
    span: 1,
    hidden: false,
    ...extra,
  });

  const rows: EvalRow[] = [];
  const valsByRow: Record<number, Vals> = {};

  const spotRow = (r: number, kindOfRow: RowKind, mode: Mode, v: Vals, label: { a: string; b: string }, sum?: readonly [number, number], parts?: readonly [number, number]): EvalRow => {
    const spots = numericSpots(kind, v, r, mode, sum, parts);
    const cells: EvalCell[] = [];
    for (let c = 0; c < DISGUISE_COLS; c++) {
      const L = colName(c);
      if (c === 0) cells.push(mkText(c, r, label.a));
      else if (c === 1) cells.push(mkText(c, r, label.b, { align: 'left', bold: mode !== 'data' }));
      else if (spots[L]) {
        const s = spots[L];
        cells.push(
          mkText(c, r, s.text, {
            raw: s.raw,
            formula: s.formula ?? null,
            editable: !!s.editable,
            neg: !!s.neg,
            cf: s.cf ?? null,
            barPct: s.barPct ?? null,
            bold: mode !== 'data' || !!s.bold,
          }),
        );
      } else {
        // 글자 칸(구분·담당·기준일)
        let text = model.texts[addrOf(L, r)] ?? '';
        if (kind === 'hr' && L === 'I' && mode === 'data') text = model.asOf;
        cells.push(mkText(c, r, text, { bold: mode !== 'data' }));
      }
    }
    return { r, kind: kindOfRow, height: rowHeightOf(r), cells };
  };

  const blankRow = (r: number, kindOfRow: RowKind): EvalRow => ({
    r,
    kind: kindOfRow,
    height: rowHeightOf(r),
    cells: Array.from({ length: DISGUISE_COLS }, (_, c) => mkText(c, r, '')),
  });

  const baseVals = (r: number): Vals => {
    const v: Vals = {};
    for (const l of INPUT_LETTERS[kind]) v[l] = model.inputs[addrOf(l, r)] ?? 0;
    return v;
  };

  const groupRows = (g: 0 | 1) => (g === 0 ? Array.from({ length: 6 }, (_, i) => ROW.g1 + i) : Array.from({ length: 5 }, (_, i) => ROW.g2 + i));

  for (let r = 0; r < DISGUISE_ROWS; r++) {
    const k = rowKindOf(r);
    if (k === 'title') {
      const cells = Array.from({ length: DISGUISE_COLS }, (_, c) =>
        mkText(c, r, c === 0 ? spec.title : '', c === 0 ? { span: 5, bold: true, align: 'left' } : c < 5 ? { hidden: true } : {}),
      );
      rows.push({ r, kind: k, height: rowHeightOf(r), cells });
    } else if (k === 'subtitle') {
      const text = spec.subtitle.replace('{date}', model.asOf);
      const cells = Array.from({ length: DISGUISE_COLS }, (_, c) =>
        mkText(c, r, c === 0 ? text : '', c === 0 ? { span: DISGUISE_COLS, align: 'left' } : { hidden: true }),
      );
      rows.push({ r, kind: k, height: rowHeightOf(r), cells });
    } else if (k === 'head') {
      rows.push({
        r,
        kind: k,
        height: rowHeightOf(r),
        cells: cols.map((col, c) => mkText(c, r, col.head, { bold: true, align: 'center' })),
      });
    } else if (k === 'data') {
      const g = r >= ROW.g2 ? 1 : 0;
      const idx = r - (g === 0 ? ROW.g1 : ROW.g2);
      const gr = spec.groups[g].rows[idx];
      const v = baseVals(r);
      valsByRow[r] = v;
      rows.push(spotRow(r, k, 'data', v, { a: gr?.code ?? '', b: gr?.name ?? '' }));
    } else if (k === 'subtotal') {
      const g = r === ROW.sub1 ? 0 : 1;
      const rs = groupRows(g);
      const v = sumVals(kind, rs.map((x) => valsByRow[x]));
      valsByRow[r] = v;
      rows.push(spotRow(r, k, 'sub', v, { a: '', b: spec.groups[g].subtotal }, [rs[0], rs[rs.length - 1]]));
    } else if (k === 'total') {
      const v: Vals = {};
      for (const l of INPUT_LETTERS[kind]) v[l] = valsByRow[ROW.sub1][l] + valsByRow[ROW.sub2][l];
      valsByRow[r] = v;
      rows.push(spotRow(r, k, 'total', v, { a: '', b: spec.totalLabel }, undefined, [ROW.sub1, ROW.sub2]));
    } else if (k === 'note') {
      const cells = Array.from({ length: DISGUISE_COLS }, (_, c) =>
        mkText(c, r, c === 0 ? spec.note : '', c === 0 ? { span: DISGUISE_COLS, align: 'left' } : { hidden: true }),
      );
      rows.push({ r, kind: k, height: rowHeightOf(r), cells });
    } else {
      rows.push(blankRow(r, k));
    }
  }
  return { kind, rows, colWidths, spec };
}

export { NUM_LETTERS as DISGUISE_NUM_LETTERS };

// ─── 편집 ─────────────────────────────────────────────────────────────────────

export function isEditableAddr(model: DisguiseModel, addr: string): boolean {
  const m = /^([A-J])(\d+)$/.exec(addr);
  if (!m) return false;
  const r = Number(m[2]) - 1;
  return rowKindOf(r) === 'data' && INPUT_LETTERS[model.kind].includes(m[1]);
}

export function isEditablePt(model: DisguiseModel, p: Pt): boolean {
  return isEditableAddr(model, `${colName(p.c)}${p.r + 1}`);
}

/** "1,234" "(500)" "12.5" → 숫자. 숫자가 아니면 null. */
export function parseNumberInput(text: string): number | null {
  let t = text.trim().replace(/,/g, '').replace(/\s/g, '');
  if (t === '') return null;
  let neg = false;
  if (/^\(.*\)$/.test(t)) {
    neg = true;
    t = t.slice(1, -1);
  }
  if (!/^-?\d+(\.\d+)?$/.test(t)) return null;
  const n = Number(t);
  return neg ? -n : n;
}

/** 입력 칸 값을 바꾼다(표시 단위의 숫자). 편집 불가 칸·잘못된 값이면 같은 모델을 돌려준다. */
export function setInput(model: DisguiseModel, addr: string, value: number): DisguiseModel {
  if (!isEditableAddr(model, addr) || !Number.isFinite(value)) return model;
  const letter = addr[0];
  const tenths = model.kind === 'hr' && (letter === 'E' || letter === 'F');
  const internal = Math.max(0, tenths ? Math.round(value * 10) : Math.round(value));
  if (model.inputs[addr] === internal) return model;
  return { ...model, inputs: { ...model.inputs, [addr]: internal } };
}

/** 수식 입력줄에 보일 글자 — 값 칸은 값, 계산 칸은 수식, 글자 칸은 글자. */
export function formulaBarText(cell: EvalCell, model: DisguiseModel): string {
  if (cell.formula) return cell.formula;
  if (cell.raw === null) return cell.text;
  const letter = cell.addr[0];
  const tenths = model.kind === 'hr' && (letter === 'E' || letter === 'F');
  if (cell.editable || cell.raw !== null) return tenths ? (cell.raw / 10).toFixed(1) : String(cell.raw);
  return cell.text;
}

// ─── 차트 ─────────────────────────────────────────────────────────────────────

export interface ChartBar {
  readonly label: string;
  readonly values: readonly number[];
}

export interface ChartData {
  readonly title: string;
  readonly baselinePct: number | null;
  /** 계열 이름(회계 = 전월·당월, 나머지 = 한 계열) */
  readonly series: readonly string[];
  readonly bars: readonly ChartBar[];
  /** y축 상한 (막대 높이 = value / max) */
  readonly max: number;
  readonly unit: 'amount' | 'pct';
}

const niceMax = (x: number) => {
  if (x <= 0) return 1;
  const p = Math.pow(10, Math.floor(Math.log10(x)));
  const n = x / p;
  return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10) * p;
};

export function chartData(sheet: EvaluatedSheet): ChartData {
  const { spec, kind } = sheet;
  const rows = sheet.rows.filter((x) => x.r >= ROW.g1 && x.r < ROW.g1 + 6);
  const nameOf = (row: EvalRow) => row.cells[1].text;
  if (kind === 'accounting') {
    const bars = rows.map((row) => ({ label: nameOf(row), values: [row.cells[2].raw ?? 0, row.cells[3].raw ?? 0] }));
    const top = Math.max(1, ...bars.flatMap((b) => b.values));
    return {
      title: spec.chart.title,
      baselinePct: spec.chart.baselinePct,
      series: [spec.columns[2].head, spec.columns[3].head],
      bars,
      max: niceMax(top),
      unit: 'amount',
    };
  }
  const idx = kind === 'sales' ? 4 : 7;
  const bars = rows.map((row) => ({ label: nameOf(row), values: [(row.cells[idx].raw ?? 0) / 10] }));
  const top = Math.max(spec.chart.baselinePct ?? 100, ...bars.map((b) => b.values[0]));
  return {
    title: spec.chart.title,
    baselinePct: spec.chart.baselinePct,
    series: [spec.columns[idx].head],
    bars,
    max: niceMax(top * 1.1),
    unit: 'pct',
  };
}

/** 처음 선택 칸 → 좌표 */
export function firstSelection(spec: DisguiseSpec): Pt {
  const m = /^([A-J])(\d+)$/.exec(spec.firstCell);
  if (!m) return { c: 3, r: 3 };
  return { c: m[1].charCodeAt(0) - 65, r: Number(m[2]) - 1 };
}
