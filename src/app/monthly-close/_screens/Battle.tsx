'use client';

/**
 * 대전 (B) · 결과 직후 게임 탭 (R). 판 두 장 + 항목 표 ↔ 검산 표 + 변경 내역 + 검토 의견 + 힌트 고르기 + 도발.
 * 판정은 서버(또는 연습 엔진) 응답만 따른다. 낙관적 판정 없음.
 */

import { useCallback, useEffect, useRef, useState, type KeyboardEvent } from 'react';
import { ABSENT_AFTER_TIMEOUTS, QUIZ_VALUE_COUNT, TAUNT_COUNT } from '@/lib/monthly-close/constants';
import { COLS, hintRange, normalizeAddrInput, parseCell, type CellAddr, type Col, type HintTarget, type Row } from '@/lib/monthly-close/coords';
import { COMMON_PACK, formatClock, formatHM, quizLabel, quizWrongLine, memoLine, tauntLine, statusText } from '@/lib/monthly-close/copy/pick';
import { UI } from '@/lib/monthly-close/copy/ui-text';
import {
  addrToCR, boardAddr, hasGame, hintFormula, hintRangeText, hintResults, isMyTurn, myBoard, myItemRows, oppBoard, oppItemRows, parseQuizInput,
} from '@/lib/monthly-close/client/viewModel';
import type { ActionOutcome } from '@/lib/monthly-close/client/controller';
import type { GridMerge } from '../_components/sheet/SheetGrid';
import { Dropdown } from '../_components/overlays/Popovers';
import { key, type CellSpec } from './PaneGrid';
import type { PaneBundle, ScreenCtx } from './ctx';

const T = 9; // 10행(표 시작 줄, 0기준)
const LOG = 14; // 15행
/** 방금 반영한 칸을 이 시간 안에 다시 누르면 연타로 본다 */
const REPEAT_CLICK_MS = 1000;

/** 힌트 고르기 키보드: 열 글자(A~H) = 열, 숫자(1~8) = 행 */
function hintKeyTarget(k: string): HintTarget | null {
  const norm = normalizeAddrInput(k);
  if (/^[A-H]$/.test(norm)) return { kind: 'col', col: norm as Col };
  if (/^[1-8]$/.test(k)) return { kind: 'row', row: Number(k) as Row };
  return null;
}

/**
 * 검산 표(10~13행)가 보이게 가장 가까운 스크롤 상자를 내린다(BUG-25: 360×640·375×548 휴대폰에서 값·입력칸이 첫 화면 밖이었다).
 * 입력칸 아래끝이 보이도록 내리되, 표 제목 줄(10행)이 열 머리글(24px) 밑으로 숨지 않는 만큼만. 이미 보이면(PC) 아무것도 안 한다.
 * 페이지·셸(overflow: hidden)은 건드리지 않는다 — overflow auto/scroll 상자만.
 */
export function revealQuizRows(input: HTMLElement): void {
  const ir = input.getBoundingClientRect();
  if (ir.height === 0) return; // 숨기기 레이어(display: none) 등
  let sc: HTMLElement | null = input.parentElement;
  while (sc && !/(auto|scroll)/.test(getComputedStyle(sc).overflowY)) sc = sc.parentElement;
  if (!sc || sc.classList.contains('mc-root')) return;
  const sr = sc.getBoundingClientRect();
  const visBottom = sr.top + sc.clientHeight;
  const need = ir.bottom + 4 - visBottom;
  if (need <= 0) return;
  const head = input.closest('[role="grid"]')?.querySelector('[data-addr="A10"]')?.getBoundingClientRect();
  const room = (head ? head.top : ir.top) - (sr.top + 24);
  const by = Math.min(need, Math.max(0, room));
  if (by > 0) sc.scrollTop += by;
}

/** 검산 표 금액: 천 단위 쉼표(부가세 공급가 370000 → 370,000). 로캘에 기대지 않는다 */
export function formatQuizValue(v: number): string {
  return String(v).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

function errText(r: Extract<ActionOutcome, { ok: false }>): string | null {
  if (r.error === 'LOCKED') return null;
  if (r.error === 'NETWORK') return statusText('reconnecting');
  if (r.error === 'RATE_LIMITED') return statusText('rate');
  if (r.error === 'CONFLICT') return statusText('conflict');
  if (r.error === 'NOT_YOUR_TURN') return statusText('notYourTurn');
  if (r.error === 'WRONG_PHASE') return statusText('wrongPhase');
  if (r.error === 'INVALID') {
    if (r.reason === 'already_fired') return statusText('alreadyDone');
    if (r.reason === 'no_hint' || r.reason === 'hint_blocked') return statusText('hintNone');
    if (r.reason === 'cell') return statusText('badAddr');
    return statusText('wrongPhase');
  }
  return statusText('wrongPhase');
}

export function useBattle(ctx: ScreenCtx): PaneBundle {
  const { view, pack, controller, flash, memo, nowMs } = ctx;
  const [sel, setSel] = useState<CellAddr | null>(null);
  const [nameText, setNameText] = useState('');
  const [hintMode, setHintMode] = useState(false);
  const [target, setTarget] = useState<HintTarget | null>(null);
  const [tauntOpen, setTauntOpen] = useState(false);
  const [quizText, setQuizText] = useState('');
  const lastShot = useRef<CellAddr | null>(null);
  const quizInputRef = useRef<HTMLInputElement | null>(null);
  // 입력칸이 화면에 붙는 순간(검산 시작·모바일 [상대 시트] 전환) 검산 표가 보이게 내린다(BUG-25). 포커스는 옮기지 않는다(휴대폰 키보드가 갑자기 뜨지 않게)
  const quizInputMount = useCallback((el: HTMLInputElement | null) => {
    quizInputRef.current = el;
    if (el) window.requestAnimationFrame(() => revealQuizRows(el));
  }, []);
  const lastShotAt = useRef(0);
  const memoStore = useRef(new Map<string, { kind: 'miss' | 'hit' | 'sunk'; head: string; body: string }>());

  const g = hasGame(view) ? view.game : null;
  const ended = view.status === 'ended';
  const myTurn = isMyTurn(view);
  const pending = controller.state.pending;
  const quiz = g?.quiz ?? null;
  const locked = view.me.quizLockUntil !== null && view.me.quizLockUntil > nowMs;
  const hintBlocked = !g || ended || !!quiz || !!g.alarm;
  const hintOff = hintBlocked || view.me.hintsAvailable <= 0;
  /** 내가 아직 답할 수 있는 검산이 열려 있다 */
  const quizOpenNow = !!quiz && quiz.mine === 'open';

  const reset = useCallback(() => {
    setHintMode(false);
    setTarget(null);
    setTauntOpen(false);
  }, []);

  // 잠금이 풀리면 입력칸을 비운다
  useEffect(() => {
    if (!locked) setQuizText('');
  }, [locked]);
  useEffect(() => {
    if (!quiz) setQuizText('');
  }, [quiz?.id]);

  const fire = async (cell: CellAddr) => {
    if (pending) return;
    lastShot.current = cell;
    lastShotAt.current = Date.now();
    setSel(null);
    setNameText('');
    const r = await controller.fire(cell);
    if (!r.ok) {
      const t = errText(r);
      if (t) flash(t, 3000);
    }
  };

  const onRightDown = (c: number, r: number, e: { detail: number }) => {
    const addr = boardAddr(c, r);
    if (!addr) {
      return;
    }
    if (hintMode) {
      const t: HintTarget = { kind: 'block', cell: addr };
      setTarget(t);
      return;
    }
    const old = memoStore.current.get(addr);
    if (old) memo('opp', addr, old.kind, old.head, old.body);
    if (!myTurn || ended) {
      // 연타의 나머지(더블·트리플 클릭의 2·3번째, 방금 반영한 칸을 곧바로 다시 누름)는 조용히 무시한다 —
      // 첫 응답이 와서 상대 차례로 바뀐 뒤 도착한 세 번째 클릭이 "지금은 편집할 수 없습니다."를 띄우던 잡음(BUG-14)
      if (e.detail >= 2 || (addr === lastShot.current && Date.now() - lastShotAt.current < REPEAT_CLICK_MS)) return;
      setSel(addr);
      if (!ended) flash(statusText('notNow'), 2000);
      return;
    }
    if (sel === addr || e.detail >= 2) void fire(addr);
    else {
      setSel(addr);
      setNameText(addr);
    }
  };

  const onNameSubmit = (raw: string) => {
    if (hintMode) {
      return;
    }
    const cell = parseCell(raw);
    if (!cell) return flash(statusText('badAddr'), 3000);
    if (!myTurn) {
      setSel(cell);
      return flash(statusText('notNow'), 2000);
    }
    void fire(cell);
  };

  const onRightKey = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    // 검산이 열려 있으면 숫자·Enter = 검산 입력칸으로(BUG-22: Tab은 숨기기 전용이라 키보드로 입력칸에 들어갈 길이 없었다)
    if (quizOpenNow && !e.nativeEvent.isComposing && (/^[0-9]$/.test(e.key) || e.key === 'Enter')) {
      e.preventDefault();
      if (!locked && e.key !== 'Enter') setQuizText((t) => t + e.key);
      quizInputRef.current?.focus();
      return;
    }
    const moves: Record<string, [number, number]> = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] };
    const mv = moves[e.key];
    if (mv) {
      e.preventDefault();
      const cur = sel ? addrToCR(sel) : { c: 0, r: 0 };
      const next = sel ? boardAddr(Math.max(0, Math.min(7, cur.c + mv[0])), Math.max(0, Math.min(7, cur.r + mv[1]))) : 'A1';
      if (next) {
        setSel(next as CellAddr);
        // 힌트 고르기 중 방향키 = 그 칸 중심 3×3 범위 미리보기(BUG-23: 방향키가 범위를 바꾸지 않았다)
        if (hintMode) setTarget({ kind: 'block', cell: next as CellAddr });
        else setNameText(next);
      }
      return;
    }
    if (e.key === 'Enter' && !e.nativeEvent.isComposing) {
      e.preventDefault();
      if (hintMode) return void confirmHint(target ?? (sel ? { kind: 'block', cell: sel } : null));
      if (sel) onNameSubmit(sel);
      return;
    }
    if (hintMode && e.key.length === 1 && !e.nativeEvent.isComposing) {
      // 힌트 고르기 중 열 글자 = 열 전체, 숫자 = 행 전체 (머리글 클릭과 같다)
      const t = hintKeyTarget(e.key);
      if (t) {
        e.preventDefault();
        setTarget(t);
      }
      return;
    }
    if (e.key.length === 1 && !e.nativeEvent.isComposing) {
      const norm = normalizeAddrInput(e.key);
      if (/^[A-H]$/.test(norm)) {
        e.preventDefault();
        setNameText(norm);
        ctx.nameRef.current?.focus();
      }
    }
  };

  const confirmHint = async (pick: HintTarget | null = target) => {
    if (!pick) return;
    const r = await controller.hint(pick);
    if (r.ok) {
      flash(statusText('hintDone'), 3000);
      reset();
    } else {
      const t = errText(r);
      if (t) flash(t, 3000);
    }
  };

  const onHint = () => {
    if (hintOff) {
      flash(g?.quiz || g?.alarm ? statusText('wrongPhase') : statusText('hintNone'), 3000);
      return;
    }
    setTauntOpen(false);
    setHintMode((m) => !m);
    setTarget(null);
  };

  const tauntCooldown = Math.max(0, view.me.nextTauntRound - (g?.round ?? 1));
  const tauntOff = !g || ended || !!quiz;
  const onTaunt = () => {
    if (tauntOff) return flash(statusText('wrongPhase'), 3000);
    setHintMode(false);
    setTauntOpen((o) => !o);
  };
  const pickTaunt = async (id: number) => {
    setTauntOpen(false);
    const r = await controller.taunt(id);
    if (!r.ok) {
      const t = errText(r);
      if (t) flash(t, 3000);
    }
  };

  // ── 메모를 남겨 두었다가 삼각형을 누르면 다시 보인다 ──
  const rememberMemo = ctx.memo;
  void rememberMemo;

  // ── 왼쪽: 내 판 + 내 항목 + 변경 내역 ──
  const leftSpecs = new Map<string, CellSpec>();
  const leftMerges: GridMerge[] = [];
  for (const [addr, c] of myBoard(view, pack)) {
    const p = addrToCR(addr);
    leftSpecs.set(key(p.c, p.r), { state: c.state, label: c.label, strike: c.strike, memo: c.state === 'miss' ? 'miss' : c.state === 'mine' ? null : c.state === 'sunk' ? 'sunk' : 'hit' });
  }
  const table = (specs: Map<string, CellSpec>, merges: GridMerge[], rows: ReturnType<typeof myItemRows>) => {
    specs.set(key(0, T), { label: UI.battle.itemsHead[0], tone: 'head' });
    specs.set(key(3, T), { label: UI.battle.itemsHead[1], tone: 'head', align: 'center' });
    specs.set(key(4, T), { label: UI.battle.itemsHead[2], tone: 'head' });
    merges.push({ c: 0, r: T, cols: 3 }, { c: 4, r: T, cols: 2 });
    rows.forEach((it, i) => {
      const r = T + 1 + i;
      specs.set(key(0, r), { label: it.name });
      specs.set(key(3, r), { label: String(it.size), align: 'center' });
      specs.set(key(4, r), { label: it.status });
      merges.push({ c: 0, r, cols: 3 }, { c: 4, r, cols: 2 });
    });
  };
  table(leftSpecs, leftMerges, myItemRows(view, pack));
  if (g) {
    leftSpecs.set(key(0, LOG), { label: UI.battle.changeLog[0], tone: 'head' });
    leftSpecs.set(key(1, LOG), { label: UI.battle.changeLog[1], tone: 'head' });
    leftSpecs.set(key(2, LOG), { label: UI.battle.changeLog[2], tone: 'head' });
    const oppHints = g.log.filter((l) => l.by !== view.me.seat && l.type === 'hint').slice(-2);
    oppHints.forEach((l, i) => {
      if (l.type !== 'hint') return;
      leftSpecs.set(key(0, LOG + 1 + i), { label: formatHM(l.at) });
      leftSpecs.set(key(1, LOG + 1 + i), { label: hintRangeText(l.target) });
      leftSpecs.set(key(2, LOG + 1 + i), { label: l.target.kind === 'col' ? UI.battle.colReview : l.target.kind === 'row' ? UI.battle.rowReview : UI.battle.blockReview });
    });
  }

  // ── 오른쪽: 상대 판 + 힌트 결과 + (항목 표 | 검산 표) + 검토 의견 ──
  const rightSpecs = new Map<string, CellSpec>();
  const rightMerges: GridMerge[] = [];
  for (const [addr, c] of oppBoard(view, pack)) {
    const p = addrToCR(addr);
    rightSpecs.set(key(p.c, p.r), { state: c.state, label: c.label, memo: c.state === 'miss' ? 'miss' : c.state === 'hit' || c.state === 'sunk' ? (c.state === 'sunk' ? 'sunk' : 'hit') : null });
  }
  const hr = hintResults(view.me);
  for (const h of hr.cells) rightSpecs.set(key(h.c, h.r), { label: String(h.value), align: 'center' });
  const qValues = quiz?.values ?? [];
  const quizOpen = !!quiz && quiz.mine === 'open';
  const submitQuiz = async () => {
    if (!quiz || locked || pending) return;
    const n = parseQuizInput(quizText);
    if (n === null) return flash(statusText('wrongPhase'), 2000);
    const before = view.me.quizLockUntil;
    const r = await controller.answer(quiz.id, n);
    if (!r.ok) {
      const t = errText(r);
      if (t) flash(t, 3000);
    } else if (r.view.me.quizLockUntil !== before && r.view.me.quizLockUntil !== null) {
      // 입력 병합(B13:D13)의 시작 칸에 붙인다 → 병합 칸 오른쪽 위(D13 모서리). H13은 E13:H13 병합 안이라 칸이 없어 메모가 안 떴다(디자인 리뷰 M2)
      memo('opp', 'B13', 'note', UI.battle.memoHeadMine, quizWrongLine(Date.now()).text);
    }
  };
  if (quiz) {
    const kind = quiz.kind;
    const p = pack.quiz[kind];
    rightSpecs.set(key(0, T), { label: quizLabel(pack, kind, quiz.labelSeed).text });
    rightMerges.push({ c: 0, r: T, cols: 7 });
    const remain = quiz.deadlineAt - nowMs;
    rightSpecs.set(key(7, T), { label: formatClock(remain), align: 'right' });
    // 값이 1개(부가세 공급가 "370,000")면 값·머리를 B:D 3칸 병합 — 좁은 칸(56px·모바일 35px)에서 숫자 끝이 잘리지 않게. 아래 입력칸(B:D)과 폭이 같다
    const valueSpan = QUIZ_VALUE_COUNT[kind] === 1 ? 3 : 1;
    p.colHead.forEach((h, i) => rightSpecs.set(key(i, T + 1), { label: h, tone: 'head' }));
    if (valueSpan > 1) rightMerges.push({ c: 1, r: T + 1, cols: valueSpan });
    if (p.unit) {
      rightSpecs.set(key(6, T + 1), { label: `(단위: ${p.unit})`, tone: 'faint' });
      rightMerges.push({ c: 6, r: T + 1, cols: 2 });
    }
    rightSpecs.set(key(0, T + 2), { label: p.valueLabel });
    qValues.slice(0, QUIZ_VALUE_COUNT[kind]).forEach((v, i) => {
      rightSpecs.set(key(1 + i, T + 2), { label: formatQuizValue(v), align: 'right' });
      if (valueSpan > 1) rightMerges.push({ c: 1 + i, r: T + 2, cols: valueSpan });
    });
    rightSpecs.set(key(0, T + 3), { label: p.rowLabel });
    const closed = view.me.quizLockUntil === null && quiz.mine !== 'open';
    rightSpecs.set(key(1, T + 3), {
      children: (
        <input
          ref={quizInputMount}
          className="mc-cell__input"
          // `/` 명령 이동 모드의 첫 항목(검산 중에만) — 키보드로 바로 들어온다(BUG-22)
          data-mc-cmd={quizOpenNow ? 'quiz-input' : undefined}
          inputMode="numeric"
          autoComplete="off"
          aria-label={p.rowLabel}
          data-locked={locked ? 'true' : undefined}
          value={locked ? '#VALUE!' : closed ? '' : quizText}
          readOnly={locked || closed}
          placeholder={UI.battle.quizEnterHint}
          onChange={(e) => setQuizText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key !== 'Enter' || e.nativeEvent.isComposing) return;
            e.preventDefault();
            void submitQuiz();
          }}
        />
      ),
    });
    rightMerges.push({ c: 1, r: T + 3, cols: 3 });
    rightSpecs.set(key(4, T + 3), { label: p.inputHint, tone: 'faint' });
    rightMerges.push({ c: 4, r: T + 3, cols: 4 });
  } else {
    table(rightSpecs, rightMerges, oppItemRows(view, pack));
  }
  if (g) {
    rightSpecs.set(key(0, LOG), { label: UI.battle.review[0], tone: 'head' });
    rightSpecs.set(key(1, LOG), { label: UI.battle.review[1], tone: 'head', align: 'center' });
    rightSpecs.set(key(2, LOG), { label: UI.battle.review[2], tone: 'head' });
    hr.table.slice(-2).forEach((row, i) => {
      rightSpecs.set(key(0, LOG + 1 + i), { label: row.range });
      rightSpecs.set(key(1, LOG + 1 + i), { label: String(row.value), align: 'center' });
      rightSpecs.set(key(2, LOG + 1 + i), { label: formatHM(row.at) });
    });
  }

  const range = target ? (() => { const r = hintRange(target); const a = addrToCR(r.from); const b = addrToCR(r.to); return { c0: a.c, r0: a.r, c1: b.c, r1: b.r }; })() : null;
  const selCR = sel && !hintMode ? addrToCR(sel) : null;
  const absentShown = !ended && view.opp !== null && view.opp.consecutiveTimeouts >= ABSENT_AFTER_TIMEOUTS;

  const tauntItems = Array.from({ length: TAUNT_COUNT }, (_, i) => ({
    id: String(i),
    label: tauntLine(i).text,
    aside: undefined as string | undefined,
    disabled: tauntCooldown > 0,
  }));

  return {
    formula: hintMode
      ? {
          nameValue: target ? hintRangeText(target) : '',
          formula: target ? hintFormula(target) : '',
          armed: !!target,
          onCancel: reset,
          onConfirm: () => void confirmHint(),
        }
      : {
          nameValue: nameText,
          formula: sel && g ? (g.myShots.find((s) => s.cell === sel)?.result === 'miss' ? '0' : g.myShots.find((s) => s.cell === sel) ? '1' : '') : '',
          armed: !!sel && myTurn && !pending,
          onNameChange: setNameText,
          onNameSubmit,
          onCancel: () => {
            setSel(null);
            setNameText('');
          },
          onConfirm: () => sel && onNameSubmit(sel),
        },
    leftSpecs,
    rightSpecs,
    leftMerges,
    rightMerges,
    leftSelected: null,
    rightSelected: selCR,
    rightRange: range,
    rightTone: pending ? 'locked' : myTurn ? 'active' : 'readonly',
    rightHoverable: (myTurn && !ended && !pending) || hintMode,
    rightPick: hintMode ? { cols: true, rows: true } : null,
    pickedCols: target?.kind === 'col' ? [COLS.indexOf(target.col)] : [],
    pickedRows: target?.kind === 'row' ? [target.row - 1] : [],
    onPickCol: (c) => hintMode && c < 8 && setTarget({ kind: 'col', col: COLS[c]! }),
    onPickRow: (r) => hintMode && r < 8 && setTarget({ kind: 'row', row: (r + 1) as 1 }),
    onRightDown,
    onRightKey,
    rightHeadRight: absentShown ? (
      <button type="button" className="mc-btn" data-variant="text" data-mc-cmd="absent" onClick={() => window.dispatchEvent(new CustomEvent('mc-absent'))}>
        {UI.battle.absent}
      </button>
    ) : undefined,
    toolbar: {
      hintCount: view.me.hintsAvailable,
      hintOff,
      hintActive: hintMode,
      onHint,
      tauntOff,
      tauntOpen,
      onTaunt,
      tauntMenu: tauntOpen ? (
        <Dropdown
          label={UI.chrome.taunt}
          cmdPrefix="taunt"
          items={[
            ...(tauntCooldown > 0 ? [{ id: 'cd', label: UI.chrome.cooldown(tauntCooldown), disabled: true }] : []),
            ...tauntItems,
          ]}
          onPick={(id) => { void pickTaunt(Number(id)); }}
        />
      ) : null,
    },
    reset: () => {
      reset();
      setSel(null);
    },
    mobileConfirm: hintMode
      ? { label: UI.mobile.hintOk, cmd: 'confirm', onConfirm: () => void confirmHint(), disabled: !target || pending }
      : quizOpen
        ? { label: UI.mobile.quizOk, cmd: 'confirm', onConfirm: () => void submitQuiz(), disabled: locked || pending || quizText.trim() === '' }
        : {
            label: sel ? UI.mobile.apply(sel) : UI.mobile.applyIdle,
            cmd: 'confirm',
            onConfirm: () => sel && onNameSubmit(sel),
            disabled: !sel || !myTurn || pending || ended,
          },
  };
}

export { COMMON_PACK, memoLine };
