/**
 * RoomView → 화면에 그릴 값 (순수 함수, React 없음).
 * 게임판 두 장(내 시트·상대 시트)의 칸 상태, 항목 표, 힌트 결과 칸, 힌트 수식 미리보기, 검산 입력 해석.
 */

import { ALL_CELLS, COLS, hintRange, formatRange, placementCells, toPoint, type CellAddr, type HintTarget, type ShipPlacement } from '../coords';
import { SHIP_LENGTH, SHIP_SLOTS, type ShipSlot } from '../constants';
import type { EndedView, MeView, PlayingView, RoomView } from '../protocol';
import type { IndustryPack } from '../copy/schema';
import { UI } from '../copy/ui-text';

export type CellStateName = 'empty' | 'mine' | 'miss' | 'hit' | 'sunk' | 'reveal';
export interface BoardCell {
  readonly state: CellStateName;
  readonly label?: string;
  /** 내 시트에서 맞은 칸(반려): 취소선 */
  readonly strike?: boolean;
}

type GameLike = PlayingView | EndedView;
export const hasGame = (v: RoomView): v is GameLike => v.status === 'playing' || v.status === 'ended';

const cellsOfShip = (p: ShipPlacement): CellAddr[] => placementCells(p) ?? [];

/** 내 시트: 내 배(짧은 이름) + 상대가 쏜 결과. 대기·배치 중에는 내 배(초안 포함)만 */
export function myBoard(view: RoomView, pack: IndustryPack, draft?: readonly ShipPlacement[]): Map<CellAddr, BoardCell> {
  const out = new Map<CellAddr, BoardCell>();
  const ships = draft ?? view.me.ships;
  for (const s of ships) for (const c of cellsOfShip(s)) out.set(c, { state: 'mine', label: pack.ships[s.slot].short });
  if (!hasGame(view)) return out;
  const g = view.game;
  const slotOf = new Map<CellAddr, ShipSlot>();
  for (const s of view.me.ships) for (const c of cellsOfShip(s)) slotOf.set(c, s.slot);
  const sunkSlots = new Set(g.sunkByOpp.map((s) => s.slot));
  for (const shot of g.oppShots) {
    const slot = slotOf.get(shot.cell);
    const label = slot ? pack.ships[slot].short : undefined;
    if (shot.result === 'miss') out.set(shot.cell, { state: 'miss', label: '0' });
    else if (slot && sunkSlots.has(slot)) out.set(shot.cell, { state: 'sunk', label });
    else out.set(shot.cell, { state: 'hit', label, strike: true });
  }
  return out;
}

/** 상대 시트: 내가 쏜 결과(0·1·종결 짧은 이름). 종료 후에는 못 맞힌 상대 배 칸을 공개(빗금) */
export function oppBoard(view: RoomView, pack: IndustryPack): Map<CellAddr, BoardCell> {
  const out = new Map<CellAddr, BoardCell>();
  if (!hasGame(view)) return out;
  const g = view.game;
  const sunkCells = new Map<CellAddr, ShipSlot>();
  for (const s of g.sunkByMe) for (const c of cellsOfShip(s)) sunkCells.set(c, s.slot);
  for (const shot of g.myShots) {
    const slot = sunkCells.get(shot.cell);
    if (slot) out.set(shot.cell, { state: 'sunk', label: pack.ships[slot].short });
    else if (shot.result === 'miss') out.set(shot.cell, { state: 'miss', label: '0' });
    else out.set(shot.cell, { state: 'hit', label: '1' });
  }
  if (view.status === 'ended') {
    for (const s of view.reveal) {
      for (const c of cellsOfShip(s)) if (!out.has(c)) out.set(c, { state: 'reveal', label: pack.ships[s.slot].short });
    }
  }
  return out;
}

export interface ItemRow {
  readonly slot: ShipSlot;
  readonly name: string;
  readonly size: number;
  readonly status: string;
}

/** 내 항목 표(정상 / N건 반려 / 종결) */
export function myItemRows(view: RoomView, pack: IndustryPack): ItemRow[] {
  const sunk = hasGame(view) ? new Set(view.game.sunkByOpp.map((s) => s.slot)) : new Set<ShipSlot>();
  const shots = hasGame(view) ? new Set(view.game.oppShots.filter((s) => s.result !== 'miss').map((s) => s.cell)) : new Set<CellAddr>();
  return SHIP_SLOTS.map((slot) => {
    const ship = view.me.ships.find((s) => s.slot === slot);
    const hits = ship ? cellsOfShip(ship).filter((c) => shots.has(c)).length : 0;
    const status = sunk.has(slot) ? UI.battle.stateSunk : hits > 0 ? UI.battle.stateHit(hits) : UI.battle.stateOk;
    return { slot, name: pack.ships[slot].table, size: SHIP_LENGTH[slot], status };
  });
}

/** 상대 항목 표(미확인 / 종결). 어느 배가 맞았는지는 종결 전엔 알 수 없다 */
export function oppItemRows(view: RoomView, pack: IndustryPack): ItemRow[] {
  const sunk = hasGame(view) ? new Set(view.game.sunkByMe.map((s) => s.slot)) : new Set<ShipSlot>();
  return SHIP_SLOTS.map((slot) => ({
    slot,
    name: pack.ships[slot].table,
    size: SHIP_LENGTH[slot],
    status: sunk.has(slot) ? UI.battle.stateSunk : UI.battle.stateUnknown,
  }));
}

// ─── 힌트 ───────────────────────────────────────────────────────────────────────

/** 힌트 대상의 범위 문자열 "E1:E8" */
export function hintRangeText(t: HintTarget): string {
  return formatRange(hintRange(t));
}

/** 수식 입력줄 미리보기 `=COUNTIF(E1:E8,">0")` (결과값은 붙이지 않는다) */
export function hintFormula(t: HintTarget): string {
  return `=COUNTIF(${hintRangeText(t)},">0")`;
}

export interface HintCell {
  /** 0기준 열(8 = I열) / 행(8 = 9행) */
  readonly c: number;
  readonly r: number;
  readonly value: number;
}
export interface HintTableRow {
  readonly range: string;
  readonly value: number;
  readonly at: number;
}

/** 내 힌트 결과를 칸 위치로: 열 힌트 → 9행 해당 열, 행 힌트 → I열 해당 행, 3×3 → 검토 의견 표 */
export function hintResults(me: MeView): { cells: HintCell[]; table: HintTableRow[] } {
  const cells: HintCell[] = [];
  const table: HintTableRow[] = [];
  for (const h of me.hints) {
    if (h.target.kind === 'col') cells.push({ c: COLS.indexOf(h.target.col), r: 8, value: h.value });
    else if (h.target.kind === 'row') cells.push({ c: 8, r: h.target.row - 1, value: h.value });
    else table.push({ range: hintRangeText(h.target), value: h.value, at: h.at });
  }
  return { cells, table };
}

// ─── 검산 입력 ──────────────────────────────────────────────────────────────────

/** 쉼표·전각 숫자·"원"·공백을 정리한 정수. 해석 못 하면 null */
export function parseQuizInput(raw: string): number | null {
  let s = '';
  for (const ch of raw) {
    const code = ch.charCodeAt(0);
    if (code >= 0xff10 && code <= 0xff19) s += String.fromCharCode(code - 0xfee0);
    else if (ch === '，' || ch === ',' || ch === ' ' || ch === '　' || ch === '원' || ch === ' ') continue;
    else if (ch === '－' || ch === '−') s += '-';
    else s += ch;
  }
  if (!/^-?\d{1,9}$/.test(s)) return null;
  return Number(s);
}

// ─── 기타 ───────────────────────────────────────────────────────────────────────

/** 8×8 안의 칸인가(칸 점→주소) */
export function boardAddr(c: number, r: number): CellAddr | null {
  if (c < 0 || c > 7 || r < 0 || r > 7) return null;
  return `${COLS[c]}${r + 1}` as CellAddr;
}
export function addrToCR(addr: CellAddr): { c: number; r: number } {
  const p = toPoint(addr);
  return { c: p.c, r: p.r };
}
export { ALL_CELLS };

/** 내 차례인가(검산 중이 아니고 차례가 나일 때) */
export function isMyTurn(view: RoomView): boolean {
  return view.status === 'playing' && view.game.phase === 'fire' && view.game.turn === view.me.seat;
}

/** 승패 한 단어: 'win' | 'lose' | 'draw' */
export function outcomeOf(view: EndedView): 'win' | 'lose' | 'draw' {
  const w = view.result.winner;
  if (w === null) return 'draw';
  return w === view.me.seat ? 'win' : 'lose';
}
