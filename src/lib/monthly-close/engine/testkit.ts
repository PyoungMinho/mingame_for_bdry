/** 엔진 테스트 보조(운영 코드에서 import 금지). 시각·난수는 인자/시드로만 쓴다. */
import type { CellAddr, ShipPlacement } from '../coords';
import type { Seat } from '../protocol';
import { advance, applyAction, createRoomState, joinSeat } from './core';
import { seededRng } from './rng';
import type { EngineCtx, PresencePair, RoomState, SeatPresence } from './types';

export const K0 = 'a'.repeat(64);
export const K1 = 'b'.repeat(64);

export const FLEET0: ShipPlacement[] = [
  { slot: 'L4', start: 'A1', dir: 'h' }, // A1 B1 C1 D1
  { slot: 'L3', start: 'A3', dir: 'h' }, // A3 B3 C3
  { slot: 'L2', start: 'A5', dir: 'h' }, // A5 B5
];
export const FLEET1: ShipPlacement[] = [
  { slot: 'L4', start: 'E1', dir: 'v' }, // E1 E2 E3 E4
  { slot: 'L3', start: 'G1', dir: 'v' }, // G1 G2 G3
  { slot: 'L2', start: 'F6', dir: 'h' }, // F6 G6
];

export interface Clock {
  now: number;
  rng: () => number;
  presence: PresencePair;
  n: number;
}

export function fresh(now: number, viewState: 'game' | 'disguise' = 'game', viewStateAt = 0): SeatPresence {
  return { lastSeenAt: now, viewState, viewStateAt };
}

/** 두 자리 다 최신 접속·게임 화면 */
export function bothFresh(now: number): PresencePair {
  return [fresh(now), fresh(now)];
}

export function mkClock(seed = 1, start = 1_000_000): Clock {
  return { now: start, rng: seededRng(seed), presence: [null, null], n: 0 };
}

export function ctxOf(c: Clock): EngineCtx {
  return { now: c.now, rng: c.rng, newId: () => `match-${++c.n}`, presence: c.presence };
}

/** 두 사람이 들어와 배치(고정 함대)까지 마친 playing 상태. presence는 호출자가 c.presence로 정한다. */
export function playing(c: Clock, opts: { alarmOn?: boolean; fleets?: [ShipPlacement[], ShipPlacement[]] } = {}): RoomState {
  let s = createRoomState({ code: '12345', keyHash: K0, nickname: '가', industry: 0, alarmOn: opts.alarmOn ?? false });
  const j = joinSeat(s, { keyHash: K1, nickname: '나', industry: 1 }, ctxOf(c));
  if (!j.ok) throw new Error('join');
  s = j.stepped.state;
  const f = opts.fleets ?? [FLEET0, FLEET1];
  for (const seat of [0, 1] as const) {
    const r = applyAction(s, seat, { actionId: `place${seat}`, type: 'place', ships: f[seat], confirm: true }, ctxOf(c));
    if (!r.ok) throw new Error(`place ${r.error}`);
    s = r.state;
  }
  if (s.status !== 'playing') throw new Error('not playing');
  return s;
}

let aid = 0;
/** 액션 적용(성공 가정) 후 advance */
export function act(c: Clock, s: RoomState, seat: Seat, body: Record<string, unknown>): RoomState {
  const r = applyAction(s, seat, { actionId: `t${++aid}`, ...body } as never, ctxOf(c));
  if (!r.ok) throw new Error(`action ${String(body.type)} failed: ${r.error} ${r.reason ?? ''}`);
  return advance(r.state, ctxOf(c)).state;
}

/** 상대 판에서 배가 없는 칸들(미스용), 정해진 순서 */
export function emptyCells(fleet: ShipPlacement[]): CellAddr[] {
  const used = new Set<string>();
  for (const p of fleet) {
    const n = p.slot === 'L4' ? 4 : p.slot === 'L3' ? 3 : 2;
    const c0 = p.start.charCodeAt(0);
    const r0 = Number(p.start.slice(1));
    for (let i = 0; i < n; i++) used.add(p.dir === 'h' ? `${String.fromCharCode(c0 + i)}${r0}` : `${p.start[0]}${r0 + i}`);
  }
  const out: CellAddr[] = [];
  for (let r = 1; r <= 8; r++) for (const col of 'ABCDEFGH') if (!used.has(`${col}${r}`)) out.push(`${col}${r}` as CellAddr);
  return out;
}

/** 지금 차례인 사람이 미스 한 발. */
export function missTurn(c: Clock, s: RoomState): RoomState {
  const g = s.game!;
  const seat = g.turn;
  const fleet = s.secret.boards[seat === 0 ? 1 : 0];
  const free = emptyCells(fleet).filter((x) => !g.shots[seat].some((y) => y.cell === x));
  c.now += 1000;
  return act(c, s, seat, { type: 'fire', cell: free[0] });
}
