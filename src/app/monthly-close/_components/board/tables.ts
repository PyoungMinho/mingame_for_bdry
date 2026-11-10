import type { ExtraMap } from './extras';

/* 판 아래 표 만들기 — 전부 순수 함수. 문구는 호출자가 넣는다(문구 팩). 행 번호는 1부터. */

export interface ItemRow {
  name: string;
  /** 칸 수 */
  cells: number | string;
  /** 정상 / 1건 반려 / 종결 / 미확인 */
  status: string;
}

export interface ItemsTableOpts {
  /** [항목, 칸, 상태] */
  heads: readonly [string, string, string];
  items: readonly ItemRow[];
}

/** 10~13행: 항목 표. 10 머리 행, 11~13 항목 3줄. 이름 A~C 병합, D 칸 수, E~F 병합 상태. */
export function itemsExtras({ heads, items }: ItemsTableOpts, firstRow = 10): ExtraMap {
  const out: ExtraMap = {
    [`A${firstRow}`]: { text: heads[0], span: 3, tone: 'head', align: 'left' },
    [`D${firstRow}`]: { text: heads[1], tone: 'head' },
    [`E${firstRow}`]: { text: heads[2], span: 2, tone: 'head' },
  };
  items.slice(0, 3).forEach((it, i) => {
    const r = firstRow + 1 + i;
    out[`A${r}`] = { text: it.name, span: 3, align: 'left' };
    out[`D${r}`] = { text: String(it.cells) };
    out[`E${r}`] = { text: it.status, span: 2 };
  });
  return out;
}

export interface PlacementTableOpts {
  /** 10행 표 제목 (`배치 표`) */
  title: string;
  /** 11행 [항목, 칸, 상태] */
  heads: readonly [string, string, string];
  /** 12~14행: 긴 이름 A~D 병합 ≤14자, E 칸 수, F~G 병합 상태 */
  items: readonly ItemRow[];
  autoLabel: string;
  doneLabel: string;
  autoDisabled?: boolean;
  doneDisabled?: boolean;
  onAuto?: () => void;
  onDone?: () => void;
  /** 16행 `결재 경보: 포함` / `미포함` */
  alarmLine: string;
}

/** 10~16행: 배치 표(오른쪽 창, W·P 단계). 15행에 [자동 배치] [배치 완료] 버튼. */
export function placementExtras(o: PlacementTableOpts): ExtraMap {
  const out: ExtraMap = {
    A10: { text: o.title, span: 8, tone: 'title', align: 'left' },
    A11: { text: o.heads[0], span: 4, tone: 'head', align: 'left' },
    E11: { text: o.heads[1], tone: 'head' },
    F11: { text: o.heads[2], span: 2, tone: 'head' },
    A15: { span: 2, button: { cmd: 'auto-place', label: o.autoLabel, disabled: o.autoDisabled, onClick: o.onAuto } },
    E15: { span: 2, button: { cmd: 'place-done', label: o.doneLabel, disabled: o.doneDisabled, onClick: o.onDone } },
    A16: { text: o.alarmLine, span: 8, tone: 'faint', align: 'left' },
  };
  o.items.slice(0, 3).forEach((it, i) => {
    const r = 12 + i;
    out[`A${r}`] = { text: it.name, span: 4, align: 'left' };
    out[`E${r}`] = { text: String(it.cells) };
    out[`F${r}`] = { text: it.status, span: 2 };
  });
  return out;
}

export interface ReviewRow {
  range: string;
  value: string;
  time: string;
}

/** 15~17행 오른쪽 창: 검토 의견. 15 머리 행 [범위, 값, 시각], 16~17 내 3×3 결과. */
export function reviewExtras(heads: readonly [string, string, string], rows: readonly ReviewRow[]): ExtraMap {
  const out: ExtraMap = {
    A15: { text: heads[0], span: 2, tone: 'head' },
    C15: { text: heads[1], tone: 'head' },
    D15: { text: heads[2], span: 2, tone: 'head' },
  };
  rows.slice(0, 2).forEach((r, i) => {
    const row = 16 + i;
    out[`A${row}`] = { text: r.range, span: 2 };
    out[`C${row}`] = { text: r.value };
    out[`D${row}`] = { text: r.time, span: 2 };
  });
  return out;
}

export interface HintResults {
  /** 열 힌트: { E: 2 } → E9 */
  cols?: Readonly<Record<string, number>>;
  /** 행 힌트: { 3: 1 } → I3 */
  rows?: Readonly<Record<number, number>>;
}

/** 열 힌트 결과 = 9행, 행 힌트 결과 = I열. */
export function hintResultExtras({ cols = {}, rows = {} }: HintResults): ExtraMap {
  const out: ExtraMap = {};
  for (const [c, n] of Object.entries(cols)) out[`${c}9`] = { text: String(n), tone: 'bold' };
  for (const [r, n] of Object.entries(rows)) out[`I${r}`] = { text: String(n), tone: 'bold' };
  return out;
}
