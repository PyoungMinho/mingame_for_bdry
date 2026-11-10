'use client';

import { useSyncExternalStore } from 'react';
import { chartData, DISGUISE_COLS, DISGUISE_ROWS, type DisguiseKind } from '@/lib/monthly-close/sheet/disguise';
import { ptToAddr, rangeEdges, selectionRange } from '@/lib/monthly-close/sheet/sheet-model';
import { Cell } from '../sheet/Cell';
import { PaneHead } from '../sheet/Panes';
import { SheetGrid, type GridMerge } from '../sheet/SheetGrid';
import { BarChart } from './BarChart';
import type { DisguiseController } from './useDisguiseSheet';

export interface DisguiseSheetProps {
  controller: DisguiseController;
  /** 스크린리더 이름 (업종 시트 탭 이름) */
  label: string;
  /** 필터 줄 문구 `보기: 기본 │ 필터: 없음 │ 정렬: 없음` — 문구 팩 */
  filterLeft: string;
  /** 필터 줄 오른쪽 `마지막 저장 HH:MM` */
  filterRight: string;
  /** 모바일 4열(선택만, 편집 없음, 차트 없음) */
  mobile?: boolean;
  /** id 접두사 (한 화면에 두 개를 그릴 일은 없지만 aria-activedescendant 용) */
  idPrefix?: string;
}

const PAD_COLS = 6;
/** 데이터 아래 빈 줄: 창을 채우는 만큼만(최소 MIN, 최대 MAX). 늘 8줄을 그리던 것이 대전 화면 DOM 1,500 초과의 큰 몫이었다(BUG-10) */
const PAD_ROWS_MIN = 2;
const PAD_ROWS_MAX = 8;
/** 셸 크롬(상단바~수식줄 + 탭 줄·상태줄 ≈ 184px)보다 작게 잡아 빈 줄이 모자라지 않게 한다 */
const CHROME_ESTIMATE_PX = 160;
const CHART_ROWS_BEFORE = 18; // 차트 시작 = 19행

function subscribeResize(cb: () => void): () => void {
  if (typeof window === 'undefined') return () => undefined;
  window.addEventListener('resize', cb);
  return () => window.removeEventListener('resize', cb);
}
const viewportHeight = () => (typeof window === 'undefined' ? 0 : window.innerHeight);

/** 창 높이를 채우는 데 필요한 빈 줄 수(순수 함수, 테스트용) */
export function padRowsFor(viewportH: number, dataRowsHeight: number): number {
  const need = Math.ceil((viewportH - CHROME_ESTIMATE_PX - dataRowsHeight) / 24);
  return Math.max(PAD_ROWS_MIN, Math.min(PAD_ROWS_MAX, need + PAD_ROWS_MIN));
}
const MOBILE_VISIBLE: Record<DisguiseKind, readonly number[]> = {
  accounting: [1, 2, 3, 4], // B C D E
  sales: [1, 2, 3, 4],
  hr: [0, 5, 6, 7], // A F G H
};
const MOBILE_WIDTHS: Record<DisguiseKind, readonly number[]> = {
  accounting: [120, 80, 80, 80],
  sales: [120, 80, 80, 88],
  hr: [64, 72, 72, 80],
};

/**
 * 숨기기 시트 — 단일 창 + 틀 고정선(1~3행·A열) + 필터 줄 + 조건부 서식 + 편집·재계산 + 막대 차트.
 * 열 폭은 8px 배수로 서로 다르다(균일하면 게임판처럼 보인다). 계산 칸은 선택만 되고 입력은 받지 않는다.
 */
export function DisguiseSheet({ controller: k, label, filterLeft, filterRight, mobile, idPrefix = 'mc-ds' }: DisguiseSheetProps) {
  const { sheet, state } = k;
  const baseWidths = sheet.colWidths;
  let widths: (number | null)[] = [...baseWidths, ...Array.from({ length: PAD_COLS }, () => null)];
  if (mobile) {
    const vis = MOBILE_VISIBLE[sheet.kind];
    const ws = MOBILE_WIDTHS[sheet.kind];
    widths = widths.map((w, c) => {
      const i = vis.indexOf(c);
      return i >= 0 ? ws[i] : 0;
    });
  }
  const merges: GridMerge[] = [];
  for (const row of sheet.rows) for (const c of row.cells) if (c.span > 1 && !c.hidden) merges.push({ c: c.c, r: c.r, cols: c.span });

  const rng = selectionRange(state);
  const multi = !!state.anchor;
  const vh = useSyncExternalStore(subscribeResize, viewportHeight, () => 0);
  const dataH = sheet.rows.reduce((a, row) => a + row.height, 0);
  // 선택이 빈 줄까지 내려가 있으면 그 줄은 남긴다(창을 줄여도 선택 칸이 사라지지 않게)
  const totalRows = Math.max(DISGUISE_ROWS + padRowsFor(vh, dataH), state.sel.r + 1, rng.r1 + 1);
  const heightOf = (r: number) => (r < DISGUISE_ROWS ? sheet.rows[r].height : 24);
  const chartTop = 24 + Array.from({ length: CHART_ROWS_BEFORE }, (_, r) => heightOf(r)).reduce((a, b) => a + b, 0);
  const chartLeft = 40 + (baseWidths[0] ?? 72);

  return (
    <div className="mc-pane mc-pane--single" data-pane="disguise" data-kind={sheet.kind}>
      <PaneHead left={filterLeft} right={filterRight} />
      <div className="mc-pane__body">
        <SheetGrid
          label={label}
          colWidths={widths}
          rowCount={totalRows}
          rowHeight={(r) => (r < DISGUISE_ROWS ? sheet.rows[r].height : undefined)}
          rowKind={(r) => (r < DISGUISE_ROWS ? sheet.rows[r].kind : undefined)}
          selected={state.sel}
          range={multi ? rng : null}
          frozen={{ rows: 3, cols: 1 }}
          merges={merges}
          activeId={`${idPrefix}-${ptToAddr(state.sel)}`}
          onKeyDown={k.onGridKeyDown}
          overlay={
            mobile ? null : (
              <BarChart data={chartData(sheet)} left={chartLeft} top={chartTop} />
            )
          }
          renderCell={(c, r, ctx) => {
            const addr = ptToAddr({ c, r });
            const id = `${idPrefix}-${addr}`;
            const isSel = state.sel.c === c && state.sel.r === r;
            const pt = { c, r };
            const edges = multi ? rangeEdges(rng, pt) : null;
            if (c >= DISGUISE_COLS || r >= DISGUISE_ROWS) {
              return (
                <Cell
                  key={c}
                  id={id}
                  addr={addr}
                  w={ctx.w}
                  selected={isSel}
                  range={edges}
                  onMouseDown={() => k.dispatch({ type: 'select', at: pt })}
                />
              );
            }
            const ec = sheet.rows[r].cells[c];
            const rk = sheet.rows[r].kind;
            const editingHere = !mobile && state.edit && state.edit.at.c === c && state.edit.at.r === r;
            const tone = rk === 'title' ? 'title' : rk === 'subtitle' || rk === 'note' ? 'sub' : undefined;
            return (
              <Cell
                key={c}
                id={id}
                addr={addr}
                w={ctx.w}
                label={editingHere ? undefined : ec.text}
                align={ec.align}
                tone={tone}
                neg={ec.neg}
                cf={ec.cf}
                barPct={ec.barPct}
                rowKind={rk === 'data' ? undefined : rk}
                freezeCol={ctx.freezeCol}
                selected={isSel}
                range={edges}
                onMouseDown={() => k.dispatch({ type: 'select', at: pt })}
                onDoubleClick={mobile ? undefined : () => k.dispatch({ type: 'startEdit', mode: 'keep' })}
              >
                {/* 글자는 칸에 바로 넣는다(감싸는 span 없음 — 칸 300개 상시 마운트라 요소 수를 줄인다, BUG-10). 스크린리더 이름은 label */}
                {editingHere && state.edit ? (
                  <input
                    className="mc-cell__input"
                    autoFocus
                    inputMode="decimal"
                    aria-label={addr}
                    value={state.edit.text}
                    onChange={(e) => k.dispatch({ type: 'change', text: e.target.value })}
                    onKeyDown={k.onEditKeyDown}
                    style={{ textAlign: ec.align }}
                  />
                ) : ec.text !== '' ? (
                  ec.text
                ) : undefined}
              </Cell>
            );
          }}
        />
      </div>
    </div>
  );
}
