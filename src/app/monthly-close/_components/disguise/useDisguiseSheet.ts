'use client';

import { useCallback, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import {
  buildDisguise, evaluate, firstSelection, formulaBarText, isEditablePt, parseNumberInput, setInput, DISGUISE_COLS,
  DISGUISE_ROWS, type DisguiseModel, type DisguiseSpec, type EvalCell, type EvaluatedSheet,
} from '@/lib/monthly-close/sheet/disguise';
import {
  addrToPt, initSheetState, keyToAction, ptToAddr, rangeLabel, selectionRange, sheetReducer, type SheetAction, type SheetState,
} from '@/lib/monthly-close/sheet/sheet-model';

export interface UseDisguiseSheetOpts {
  /** 방 번호 + 비밀키 해시 앞부분 등. 같은 seed = 같은 숫자 */
  seed: number | string;
  /** 마지막 저장 날짜 yyyy-mm-dd */
  asOf: string;
}

export interface DisguiseController {
  model: DisguiseModel;
  sheet: EvaluatedSheet;
  state: SheetState;
  dispatch: (a: SheetAction) => void;
  /** 선택된 칸 */
  cell: EvalCell;
  /** FormulaBar 에 그대로 펼친다 */
  formulaBar: {
    nameValue: string;
    onNameValueChange: (v: string) => void;
    onNameSubmit: (v: string) => void;
    formula: string;
    onFormulaChange?: (v: string) => void;
    armed: boolean;
    onCancel: () => void;
    onConfirm: () => void;
  };
  /** 격자 루트 onKeyDown 에 연결 */
  onGridKeyDown: (e: KeyboardEvent<HTMLElement>) => void;
  /** 편집 입력칸 onKeyDown 에 연결 */
  onEditKeyDown: (e: KeyboardEvent<HTMLElement>) => void;
}

/**
 * 숨기기 시트 상태 한 벌: 데이터 모델 + 선택·편집 리듀서 + 이름 상자 연결.
 * 숨기는 순간 게임 값을 지우는 쪽은 호출자(게임 레이어)이고, 이 훅은 게임 값을 전혀 모른다.
 * Tab·Shift+Tab 은 여기서는 "다음/이전 칸"이다(UX §6-2). 게임으로 돌아가지 않는다.
 */
export function useDisguiseSheet(spec: DisguiseSpec, opts: UseDisguiseSheetOpts): DisguiseController {
  const [model, setModel] = useState(() => buildDisguise(spec, opts));
  const [state, setState] = useState<SheetState>(() => initSheetState({ cols: DISGUISE_COLS, rows: DISGUISE_ROWS }, firstSelection(spec)));
  const [draft, setDraft] = useState<string | null>(null);
  const sheet = useMemo(() => evaluate(model), [model]);
  const ref = useRef({ model, state, sheet });
  ref.current = { model, state, sheet };

  const dispatch = useCallback((a: SheetAction) => {
    const { model: m, state: s, sheet: sh } = ref.current;
    const ctx = {
      canEdit: (p: { c: number; r: number }) => isEditablePt(m, p),
      textAt: (p: { c: number; r: number }) => {
        const c = sh.rows[p.r]?.cells[p.c];
        return c ? formulaBarText(c, m) : '';
      },
    };
    const next = sheetReducer(s, a, ctx);
    if (next === s) return;
    let nm = m;
    if (next.lastCommit && next.lastCommit.seq !== s.lastCommit?.seq) {
      const n = parseNumberInput(next.lastCommit.text);
      if (n !== null) nm = setInput(m, ptToAddr(next.lastCommit.at), n);
    }
    const nsheet = nm === m ? sh : evaluate(nm);
    ref.current = { model: nm, state: next, sheet: nsheet };
    setState(next);
    if (nm !== m) setModel(nm);
    setDraft(null);
  }, []);

  const keyAct = (e: KeyboardEvent<HTMLElement>) => {
    const act = keyToAction(ref.current.state, {
      key: e.key,
      shiftKey: e.shiftKey,
      ctrlKey: e.ctrlKey,
      metaKey: e.metaKey,
      altKey: e.altKey,
      isComposing: e.nativeEvent.isComposing,
    });
    if (!act) return false;
    e.preventDefault();
    e.stopPropagation();
    dispatch(act);
    return true;
  };

  const onGridKeyDown = (e: KeyboardEvent<HTMLElement>) => {
    // 입력칸(편집 입력·이름 상자·수식 입력줄) 안의 키는 그쪽이 처리한다
    if ((e.target as HTMLElement).tagName === 'INPUT') return;
    keyAct(e);
  };
  const onEditKeyDown = (e: KeyboardEvent<HTMLElement>) => {
    keyAct(e);
  };

  const cell = sheet.rows[state.sel.r].cells[state.sel.c];
  const editing = !!state.edit;
  const addrLabel = rangeLabel(selectionRange(state));

  const formulaBar: DisguiseController['formulaBar'] = {
    nameValue: draft ?? addrLabel,
    onNameValueChange: setDraft,
    onNameSubmit: (v) => {
      const pt = addrToPt(v.trim().toUpperCase().replace(/\$/g, ''));
      if (pt && pt.c < DISGUISE_COLS && pt.r < DISGUISE_ROWS) dispatch({ type: 'select', at: pt });
      else setDraft(null);
    },
    formula: state.edit ? state.edit.text : formulaBarText(cell, model),
    onFormulaChange: editing ? (v) => dispatch({ type: 'change', text: v }) : undefined,
    armed: editing,
    onCancel: () => dispatch({ type: 'cancelEdit' }),
    onConfirm: () => dispatch({ type: 'commit', advance: 'down' }),
  };

  return { model, sheet, state, dispatch, cell, formulaBar, onGridKeyDown, onEditKeyDown };
}
