import type { ExtraMap } from '../board/extras';

export interface ChangeLogRow {
  time: string;
  range: string;
  /** 값 없음 — 상대가 어디를 조회했는지만 (`열 검토`) */
  note: string;
}

/**
 * 15~17행 왼쪽 창: 변경 내역. 15 머리 행 [시각, 범위, 내용], 16~17 상대 조회 기록(값 없음).
 * BoardPane 의 extras 에 넣는다.
 */
export function changeLogExtras(heads: readonly [string, string, string], rows: readonly ChangeLogRow[]): ExtraMap {
  const out: ExtraMap = {
    A15: { text: heads[0], span: 2, tone: 'head' },
    C15: { text: heads[1], span: 2, tone: 'head' },
    E15: { text: heads[2], span: 4, tone: 'head', align: 'left' },
  };
  // 최신 2건만 보인다
  rows.slice(-2).forEach((r, i) => {
    const row = 16 + i;
    out[`A${row}`] = { text: r.time, span: 2 };
    out[`C${row}`] = { text: r.range, span: 2 };
    out[`E${row}`] = { text: r.note, span: 4, align: 'left' };
  });
  return out;
}
