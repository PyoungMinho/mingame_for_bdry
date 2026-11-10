'use client';

/**
 * 배치 (W 대기 · P 배치). 왼쪽 창에 내 배를 놓고 오른쪽 창에 배치 표를 그린다.
 * 범위 지정 3방식: 시작 칸 클릭 → 끝 칸 Shift+클릭(같은 줄·열이면 Shift 없이도) / 이름 상자에 `B2:E2` 입력 후 Enter·✓ / [자동 배치].
 * 놓인 항목은 마우스로 끌어 옮길 수 있다(D3, PC만 — 모바일은 UX §5대로 끌기 없음). 놓을 자리가 판 밖·겹침이면 빨간 점선 미리보기만.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { completeFleet } from '@/lib/monthly-close/engine/placement';
import { seededRng } from '@/lib/monthly-close/engine/rng';
import { normalizeAddrInput, parseRange, rangeToPlacement, shipCells, type CellAddr, type ShipPlacement } from '@/lib/monthly-close/coords';
import { SHIP_LENGTH, SHIP_SLOTS, type ShipSlot } from '@/lib/monthly-close/constants';
import { hashSeed, shipLongNames, statusText } from '@/lib/monthly-close/copy/pick';
import { UI } from '@/lib/monthly-close/copy/ui-text';
import { addrToCR, boardAddr, myBoard } from '@/lib/monthly-close/client/viewModel';
import type { CellSpec } from './PaneGrid';
import { key } from './PaneGrid';
import type { PaneBundle, ScreenCtx } from './ctx';
import { noopToolbar } from './ctx';
import type { GridMerge } from '../_components/sheet/SheetGrid';

const RIGHT_ROW = 9; // 10행

export function usePlacement(ctx: ScreenCtx): PaneBundle {
  const { view, pack, controller, flash } = ctx;
  const [draft, setDraft] = useState<ShipPlacement[]>(() => [...view.me.ships]);
  const [armed, setArmed] = useState<ShipSlot | null>(null);
  const [start, setStart] = useState<CellAddr | null>(null);
  const [nameText, setNameText] = useState('');
  /** 끌어 옮기기: 잡은 항목·잡은 칸 순번(0부터)·지금 마우스 아래 칸 */
  const [drag, setDrag] = useState<{ slot: ShipSlot; dir: 'h' | 'v'; grab: number; at: CellAddr | null } | null>(null);
  const serverKey = JSON.stringify(view.me.ships);
  const locked = view.me.placed;

  /**
   * 저장 줄 세우기(BUG-06): 응답을 기다리는 동안 들어온 배치는 버리지 않고 "마지막 초안 1개"로 묶어 둔다.
   * 앞 응답이 오면 그 초안을 이어서 보낸다. 줄이 빌 때까지는 서버의 중간 결과(앞 요청분 ships)로 초안을 덮지 않는다
   * — 덮으면 방금 놓은 배가 사라졌다. 줄이 비면 마지막 응답의 서버 값으로 맞춘다(서버가 거절했으면 서버 값으로 되돌림).
   */
  const inflight = useRef(false);
  const queued = useRef<{ ships: ShipPlacement[]; confirm: boolean } | null>(null);
  const serverShips = useRef(view.me.ships);
  serverShips.current = view.me.ships;

  useEffect(() => {
    if (inflight.current || queued.current) return;
    setDraft([...view.me.ships]);
  }, [serverKey]); // eslint-disable-line react-hooks/exhaustive-deps

  const send = useCallback(
    (ships: ShipPlacement[], confirm: boolean) => {
      inflight.current = true;
      void controller.place(ships, confirm).then((r) => {
        const next = queued.current;
        queued.current = null;
        if (next) {
          // 앞 요청의 실패 문구는 띄우지 않는다 — 뒤 초안이 그 상태를 덮어 다시 저장한다
          send(next.ships, next.confirm);
          return;
        }
        inflight.current = false;
        if (r.ok) setDraft([...r.view.me.ships]);
        else {
          setDraft([...serverShips.current]);
          flash(r.error === 'INVALID' ? statusText('overlap') : statusText('conflict'), 4000);
        }
      });
    },
    [controller, flash],
  );
  const enqueue = useCallback(
    (ships: ShipPlacement[], confirm: boolean) => {
      if (inflight.current) {
        // 마지막 초안이 이긴다. [배치 완료]를 누른 뒤 같은 줄에서 다시 고친 초안이 오면 확정은 다시 눌러야 한다
        queued.current = { ships, confirm };
        return;
      }
      send(ships, confirm);
    },
    [send],
  );

  const placedSlots = new Set(draft.map((s) => s.slot));
  const armedSlot: ShipSlot = armed && !locked ? armed : (SHIP_SLOTS.find((s) => !placedSlots.has(s)) ?? armed ?? 'L4');
  const longNames = useMemo(
    () => shipLongNames(pack, { fixedFirst: ctx.mode === 'practice' || view.room.matchSeq === 1, seed: `${view.room.code}:${view.room.matchSeq}:${view.me.seat}` }),
    [pack, ctx.mode, view.room.code, view.room.matchSeq, view.me.seat],
  );

  const save = useCallback(
    (next: ShipPlacement[], confirm: boolean) => {
      setDraft(next);
      enqueue(next, confirm);
    },
    [enqueue],
  );

  const tryPlace = useCallback(
    (slot: ShipSlot, range: { from: CellAddr; to: CellAddr }) => {
      const r = rangeToPlacement(range, SHIP_LENGTH[slot]);
      if (!r.ok) return flash(statusText('rangeLen'), 4000);
      const cells = shipCells(r.start, r.dir, SHIP_LENGTH[slot]);
      if (!cells) return flash(statusText('outOfBoard'), 4000);
      const others = draft.filter((s) => s.slot !== slot);
      const used = new Set(others.flatMap((s) => shipCells(s.start, s.dir, SHIP_LENGTH[s.slot]) ?? []));
      if (cells.some((c) => used.has(c))) return flash(statusText('overlap'), 4000);
      const next = [...others, { slot, start: r.start, dir: r.dir }];
      setStart(null);
      setNameText('');
      setArmed(null);
      save(next, false);
    },
    [draft, flash, save],
  );

  const onNameSubmit = (raw: string) => {
    if (locked) return;
    const pr = parseRange(raw);
    if (pr.ok) {
      tryPlace(armedSlot, { from: pr.range.from, to: pr.range.to });
      return;
    }
    flash(pr.reason === 'outOfBoard' ? statusText('outOfBoard') : statusText('badAddr'), 4000);
  };

  const onLeftDown = (c: number, r: number, e: { shiftKey: boolean }) => {
    if (locked) return;
    const addr = boardAddr(c, r);
    if (!addr) return;
    if (e.shiftKey && start) {
      tryPlace(armedSlot, { from: start, to: addr });
      return;
    }
    // 이미 놓인 배 위를 누르면 그 배를 다시 놓을 대상으로 고르고, 그대로 끌면 옮긴다
    const hit = draft.find((s) => (shipCells(s.start, s.dir, SHIP_LENGTH[s.slot]) ?? []).includes(addr));
    if (hit && !start) {
      setArmed(hit.slot);
      setStart(addr);
      setNameText(addr);
      const cells = shipCells(hit.start, hit.dir, SHIP_LENGTH[hit.slot]) ?? [];
      setDrag({ slot: hit.slot, dir: hit.dir, grab: Math.max(0, cells.indexOf(addr)), at: null });
      return;
    }
    // 같은 줄/열의 두 번째 클릭이면 바로 끝 칸으로 취급(Shift 없이도 놓을 수 있게)
    if (start && start !== addr && (start[0] === addr[0] || start[1] === addr[1])) {
      tryPlace(armedSlot, { from: start, to: addr });
      return;
    }
    setStart(addr);
    setNameText(addr);
  };

  // ── 끌어 옮기기 ──
  const dragTarget = (d: NonNullable<typeof drag>): { from: CellAddr; to: CellAddr; ok: boolean } | null => {
    if (!d.at) return null;
    const p = addrToCR(d.at);
    const len = SHIP_LENGTH[d.slot];
    const c0 = d.dir === 'h' ? p.c - d.grab : p.c;
    const r0 = d.dir === 'v' ? p.r - d.grab : p.r;
    const c1 = d.dir === 'h' ? c0 + len - 1 : c0;
    const r1 = d.dir === 'v' ? r0 + len - 1 : r0;
    const from = boardAddr(Math.max(0, Math.min(7, c0)), Math.max(0, Math.min(7, r0)));
    const to = boardAddr(Math.max(0, Math.min(7, c1)), Math.max(0, Math.min(7, r1)));
    if (!from || !to) return null;
    const inside = c0 >= 0 && r0 >= 0 && c1 <= 7 && r1 <= 7;
    const others = draft.filter((s) => s.slot !== d.slot);
    const used = new Set(others.flatMap((s) => shipCells(s.start, s.dir, SHIP_LENGTH[s.slot]) ?? []));
    const cells = inside ? (shipCells(from, d.dir, len) ?? []) : [];
    return { from, to, ok: inside && cells.length === len && !cells.some((c) => used.has(c)) };
  };
  const onLeftEnter = (c: number, r: number) => {
    if (!drag || locked) return;
    const addr = boardAddr(c, r);
    if (addr && addr !== drag.at) setDrag({ ...drag, at: addr });
  };
  const dragRef = useRef(drag);
  dragRef.current = drag;
  useEffect(() => {
    if (!drag) return;
    const up = () => {
      const d = dragRef.current;
      setDrag(null);
      if (!d || !d.at) return; // 움직이지 않았으면 클릭(다시 놓을 대상 고르기)으로 끝
      if (ctx.store.view === 'disguise') return; // 끌던 중 숨겼으면 놓지 않는다(숨김 중 게임 동작 0)
      const t = dragTarget(d);
      if (t?.ok) tryPlace(d.slot, { from: t.from, to: t.to });
      else {
        setStart(null);
        setNameText('');
        flash(statusText('overlap'), 3000);
      }
    };
    window.addEventListener('mouseup', up);
    return () => window.removeEventListener('mouseup', up);
  }, [drag !== null]); // eslint-disable-line react-hooks/exhaustive-deps

  const remove = (slot: ShipSlot) => {
    if (locked) return;
    save(draft.filter((s) => s.slot !== slot), false);
  };

  const onAuto = () => {
    if (locked) return;
    const rng = seededRng(hashSeed(`${Math.random()}:${view.room.code}`));
    save(completeFleet([], rng), false);
    flash(statusText('autoPlacedBtn'), 3000);
  };
  const onDone = () => {
    if (locked || draft.length !== 3) return;
    // 앞 저장이 아직 오가는 중이어도 같은 줄로 보낸다(BUG-06: 대기 중 [배치 완료]가 요청 없이 버려졌다)
    enqueue(draft, true);
  };

  // ── 왼쪽 창 ──
  const leftSpecs = new Map<string, CellSpec>();
  for (const [addr, c] of myBoard(view, pack, draft)) {
    const p = addrToCR(addr);
    leftSpecs.set(key(p.c, p.r), { state: c.state, label: c.label });
  }
  const startCR = start ? addrToCR(start) : null;
  const dt = drag ? dragTarget(drag) : null;
  const leftRange = dt
    ? (() => {
        const a = addrToCR(dt.from);
        const b = addrToCR(dt.to);
        return { c0: a.c, r0: a.r, c1: b.c, r1: b.r };
      })()
    : startCR
      ? { c0: startCR.c, r0: startCR.r, c1: startCR.c, r1: startCR.r }
      : null;

  // ── 오른쪽 창: 배치 표 ──
  const rightSpecs = new Map<string, CellSpec>();
  const rightMerges: GridMerge[] = [];
  const R = RIGHT_ROW;
  rightSpecs.set(key(0, R), { label: UI.placement.title, tone: 'bold' });
  rightMerges.push({ c: 0, r: R, cols: 8 });
  rightSpecs.set(key(0, R + 1), { label: UI.placement.head[0], tone: 'head' });
  rightMerges.push({ c: 0, r: R + 1, cols: 4 }, { c: 5, r: R + 1, cols: 2 });
  rightSpecs.set(key(4, R + 1), { label: UI.placement.head[1], tone: 'head', align: 'center' });
  rightSpecs.set(key(5, R + 1), { label: UI.placement.head[2], tone: 'head' });
  SHIP_SLOTS.forEach((slot, i) => {
    const r = R + 2 + i;
    const isPlaced = placedSlots.has(slot);
    const isArmed = armedSlot === slot && !locked;
    rightMerges.push({ c: 0, r, cols: 4 }, { c: 5, r, cols: 2 });
    rightSpecs.set(key(0, r), { label: `${isArmed ? '▶ ' : '  '}${longNames[slot]}`, onClick: () => !locked && setArmed(slot) });
    rightSpecs.set(key(4, r), { label: String(SHIP_LENGTH[slot]), align: 'center' });
    rightSpecs.set(key(5, r), {
      label: isPlaced ? UI.placement.placed : UI.placement.unplaced,
      children: isPlaced && !locked ? (
        <button type="button" className="mc-btn" data-variant="text" tabIndex={-1} onClick={() => remove(slot)}>
          {UI.placement.placed} ✕
        </button>
      ) : undefined,
    });
  });
  const br = R + 5;
  rightMerges.push({ c: 0, r: br, cols: 2 }, { c: 4, r: br, cols: 2 });
  rightSpecs.set(key(0, br), {
    children: (
      <button type="button" className="mc-btn" data-variant="secondary" data-mc-cmd="auto" aria-disabled={locked} onClick={onAuto}>
        {UI.placement.auto}
      </button>
    ),
  });
  rightSpecs.set(key(4, br), {
    children: (
      <button type="button" className="mc-btn" data-mc-cmd="done" aria-disabled={locked || draft.length !== 3} data-off={draft.length !== 3 ? 'true' : undefined} onClick={onDone}>
        {UI.placement.done}
      </button>
    ),
  });
  rightSpecs.set(key(0, br + 1), { label: view.room.alarmOn ? UI.placement.alarmOn : UI.placement.alarmOff, tone: 'faint' });
  rightMerges.push({ c: 0, r: br + 1, cols: 8 });

  const armedLen = SHIP_LENGTH[armedSlot];
  return {
    formula: {
      nameValue: nameText,
      formula: locked ? '' : `${armedLen}`,
      armed: !locked && nameText.length > 0,
      onNameChange: setNameText,
      onNameSubmit,
      onCancel: () => {
        setStart(null);
        setNameText('');
      },
      onConfirm: () => onNameSubmit(nameText),
    },
    leftSpecs,
    rightSpecs,
    leftMerges: [],
    rightMerges,
    leftSelected: dt ? null : startCR,
    rightSelected: null,
    leftRange,
    rangeBad: dt ? !dt.ok : undefined,
    onLeftEnter,
    leftHoverable: !locked,
    onLeftDown,
    onLeftKey: (e) => {
      // 열 글자(A~H)를 치면 대전처럼 이름 상자로 옮겨 범위(B2:E2)를 이어 친다(BUG-24: 키보드로 이름 상자에 들어갈 길이 없었다. Tab은 숨기기 전용)
      if (!locked && e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey && !e.nativeEvent.isComposing) {
        const norm = normalizeAddrInput(e.key);
        if (/^[A-H]$/.test(norm)) {
          e.preventDefault();
          setNameText(norm);
          ctx.nameRef.current?.focus();
          return;
        }
      }
      if (e.key === 'Delete' || e.key === 'Backspace') {
        const target = start ? draft.find((s) => (shipCells(s.start, s.dir, SHIP_LENGTH[s.slot]) ?? []).includes(start)) : undefined;
        if (target) {
          e.preventDefault();
          remove(target.slot);
        }
      }
    },
    toolbar: { ...noopToolbar },
    // 숨기는 순간: 범위 시작·고른 항목·끌기를 모두 취소(초안은 보존)
    reset: () => {
      setStart(null);
      setNameText('');
      setArmed(null);
      setDrag(null);
    },
    mobileConfirm: {
      label: UI.placement.auto,
      cmd: 'auto',
      onConfirm: onAuto,
      disabled: locked,
      secondary: { label: UI.placement.done, cmd: 'done', onConfirm: onDone, disabled: locked || draft.length !== 3 },
    },
  };
}
