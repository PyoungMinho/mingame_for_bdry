import { describe, expect, it } from 'vitest';
import type { CellAddr } from '../coords';
import { ALARM_HIDE_MS, HIDE_BUDGET_MS, PLACE_MS, QUIZ_LOCK_MS, QUIZ_MS, TURN_MS } from '../constants';
import { advance, applyAction, createRoomState, joinSeat, markDelivered, reportAlarm } from './core';
import { checkFleet, completeFleet, countShipCellsInHint, randomFleet } from './placement';
import { generateQuiz, quizShapeOk } from './quiz';
import { seededRng } from './rng';
import { FLEET0, FLEET1, K0, K1, act, bothFresh, ctxOf, emptyCells, fresh, missTurn, mkClock, playing } from './testkit';
import type { RoomState } from './types';

describe('배치 검증', () => {
  it('정상 함대·초안·맞닿음 허용', () => {
    expect(checkFleet(FLEET0, true)).toEqual({ ok: true });
    expect(checkFleet([], false)).toEqual({ ok: true });
    expect(checkFleet([{ slot: 'L2', start: 'A1', dir: 'h' }, { slot: 'L3', start: 'A2', dir: 'h' }], false).ok).toBe(true);
  });
  it('겹침·슬롯 중복·판 밖·개수 부족을 거부', () => {
    expect(checkFleet([{ slot: 'L4', start: 'A1', dir: 'h' }, { slot: 'L3', start: 'B1', dir: 'v' }], false).ok).toBe(false);
    expect(checkFleet([{ slot: 'L4', start: 'A1', dir: 'h' }, { slot: 'L4', start: 'A3', dir: 'h' }], false).ok).toBe(false);
    expect(checkFleet([{ slot: 'L4', start: 'F1', dir: 'h' }], false).ok).toBe(false);
    expect(checkFleet([{ slot: 'L4', start: 'A1', dir: 'h' }], true).ok).toBe(false);
    expect(checkFleet([{ slot: 'L9', start: 'A1', dir: 'h' }] as never, false).ok).toBe(false);
  });
  it('무작위·자동 완성 배치는 항상 유효', () => {
    const rng = seededRng(7);
    for (let i = 0; i < 500; i++) expect(checkFleet(randomFleet(rng), true).ok).toBe(true);
    const part = completeFleet([FLEET0[0]], rng);
    expect(checkFleet(part, true).ok).toBe(true);
    expect(part.find((p) => p.slot === 'L4')).toEqual(FLEET0[0]);
  });
});

describe('입장·배치·시작', () => {
  it('손님 입장 → 배치 90초, 재입장·꽉 참', () => {
    const c = mkClock();
    let s = createRoomState({ code: '12345', keyHash: K0, nickname: '가', industry: 0, alarmOn: false });
    expect(s.status).toBe('waiting');
    const j = joinSeat(s, { keyHash: K1, nickname: '나', industry: 1 }, ctxOf(c));
    if (!j.ok) throw new Error();
    s = j.stepped.state;
    expect(s.status).toBe('placing');
    expect(s.placeDeadlineAt).toBe(c.now + PLACE_MS);
    const again = joinSeat(s, { keyHash: K1, nickname: 'x', industry: 2 }, ctxOf(c));
    expect(again.ok && again.rejoined && again.stepped.state.seats[1]?.nickname).toBe('나');
    expect(joinSeat(s, { keyHash: 'c'.repeat(64), nickname: 'x', industry: 0 }, ctxOf(c))).toEqual({ ok: false, error: 'ROOM_FULL' });
  });

  it('방장은 대기 중에도 배치할 수 있고, 완료 후 수정은 거부', () => {
    const c = mkClock();
    const s = createRoomState({ code: '12345', keyHash: K0, nickname: '가', industry: 0, alarmOn: false });
    const r = applyAction(s, 0, { actionId: 'p', type: 'place', ships: FLEET0, confirm: true }, ctxOf(c));
    expect(r.ok && r.state.seats[0]?.placed).toBe(true);
    if (!r.ok) throw new Error();
    const r2 = applyAction(r.state, 0, { actionId: 'p2', type: 'place', ships: [], confirm: false }, ctxOf(c));
    expect(r2).toEqual({ ok: false, error: 'INVALID', reason: 'placed' });
  });

  it('둘 다 완료하면 시작, 첫 판 선공은 무작위·재대결은 교대', () => {
    const firsts = new Set<number>();
    for (let seed = 1; seed < 20; seed++) firsts.add(playing(mkClock(seed)).game!.firstSeat);
    expect(firsts.size).toBe(2);
  });

  it('90초가 지나면 남은 배를 자동 배치하고 시작', () => {
    const c = mkClock();
    let s = createRoomState({ code: '12345', keyHash: K0, nickname: '가', industry: 0, alarmOn: false });
    const j = joinSeat(s, { keyHash: K1, nickname: '나', industry: 1 }, ctxOf(c));
    if (!j.ok) throw new Error();
    s = act(c, j.stepped.state, 0, { type: 'place', ships: [FLEET0[0]], confirm: false });
    c.now += PLACE_MS - 1;
    expect(advance(s, ctxOf(c)).changed).toBe(false);
    c.now += 1;
    const a = advance(s, ctxOf(c));
    expect(a.state.status).toBe('playing');
    expect(a.state.seats[0]?.placed && a.state.seats[1]?.placed).toBe(true);
    expect(checkFleet(a.state.secret.boards[0], true).ok).toBe(true);
    expect(a.state.secret.boards[0].find((p) => p.slot === 'L4')).toEqual(FLEET0[0]);
    expect(a.state.events.some((e) => e.type === 'autoPlaced')).toBe(true);
    expect(a.effects.some((e) => e.type === 'matchStarted')).toBe(true);
  });

  it('손님이 배치 중 나가면 대기로 돌아가고 자리가 비며 방장 배치는 유지', () => {
    const c = mkClock();
    let s = createRoomState({ code: '12345', keyHash: K0, nickname: '가', industry: 0, alarmOn: false });
    const j = joinSeat(s, { keyHash: K1, nickname: '나', industry: 1 }, ctxOf(c));
    if (!j.ok) throw new Error();
    s = act(c, j.stepped.state, 0, { type: 'place', ships: FLEET0, confirm: true });
    s = act(c, s, 1, { type: 'leave' });
    expect(s.status).toBe('waiting');
    expect(s.seats[1]).toBeNull();
    expect(s.secret.boards[0]).toHaveLength(3);
    const j2 = joinSeat(s, { keyHash: 'c'.repeat(64), nickname: '다', industry: 2 }, ctxOf(c));
    expect(j2.ok && j2.stepped.state.status).toBe('placing');
  });
});

describe('발사·라운드·승패', () => {
  it('미스·반려·종결 판정, 이미 쏜 칸, 차례 아님', () => {
    const c = mkClock(3);
    let s = playing(c);
    const first = s.game!.firstSeat;
    const second = first === 0 ? 1 : 0;
    const f1 = first === 0 ? FLEET1 : FLEET0;
    expect(applyAction(s, second, { actionId: 'x', type: 'fire', cell: 'A1' }, ctxOf(c))).toEqual({ ok: false, error: 'NOT_YOUR_TURN' });
    // 첫 발: L2 (2칸) 한 칸 → 반려(hit), slot 없음
    const l2 = f1.find((p) => p.slot === 'L2')!;
    const l2cells = (l2.dir === 'h' ? [l2.start, `${String.fromCharCode(l2.start.charCodeAt(0) + 1)}${l2.start.slice(1)}`] : []) as CellAddr[];
    s = act(c, s, first, { type: 'fire', cell: l2cells[0] });
    const ev = s.events.find((e) => e.type === 'fire');
    expect(ev).toMatchObject({ type: 'fire', result: 'hit' });
    expect(ev && 'slot' in ev).toBe(false);
    expect(applyAction(s, first, { actionId: 'y', type: 'fire', cell: l2cells[0] }, ctxOf(c)).ok).toBe(false);
    s = act(c, s, second, { type: 'fire', cell: emptyCells(first === 0 ? FLEET0 : FLEET1)[0] });
    expect(s.game!.round).toBe(2);
    expect(applyAction(s, first, { actionId: 'z', type: 'fire', cell: l2cells[0] }, ctxOf(c))).toEqual({ ok: false, error: 'INVALID', reason: 'already_fired' });
    s = act(c, s, first, { type: 'fire', cell: l2cells[1] });
    expect(s.events.filter((e) => e.type === 'fire').pop()).toMatchObject({ result: 'sunk', slot: 'L2' });
    expect(s.game!.sunk[first]).toHaveLength(1);
  });

  const cellsOf = (f: typeof FLEET0, slot: string) => {
    const p = f.find((x) => x.slot === slot)!;
    const n = slot === 'L4' ? 4 : slot === 'L3' ? 3 : 2;
    return Array.from({ length: n }, (_, i) =>
      p.dir === 'h' ? `${String.fromCharCode(p.start.charCodeAt(0) + i)}${p.start.slice(1)}` : `${p.start[0]}${Number(p.start.slice(1)) + i}`,
    );
  };

  /** seat들이 번갈아 쏘되 targets 목록(각자)을 순서대로 쏜다. 목록이 떨어지면 미스. */
  function play(c: ReturnType<typeof mkClock>, s: RoomState, t0: string[], t1: string[]): RoomState {
    const lists: [string[], string[]] = [[...t0], [...t1]];
    while (s.status === 'playing') {
      const seat = s.game!.turn;
      const cell = lists[seat].shift();
      if (cell) {
        c.now += 500;
        s = act(c, s, seat, { type: 'fire', cell });
      } else s = missTurn(c, s);
    }
    return s;
  }

  it('먼저 2척 종결하면 후공 차례를 마친 뒤 승리(sunk2)', () => {
    const c = mkClock(5);
    const s0 = playing(c);
    const first = s0.game!.firstSeat;
    const opp = first === 0 ? FLEET1 : FLEET0;
    const lists: [string[], string[]] = [[], []];
    lists[first] = [...cellsOf(opp, 'L2'), ...cellsOf(opp, 'L3')];
    const s = play(c, s0, lists[0], lists[1]);
    expect(s.result).toMatchObject({ winner: first, reason: 'sunk2', round: 5 });
    expect(s.wins[first]).toBe(1);
  });

  it('같은 라운드에 둘 다 2척째를 종결하면 무승부(draw)', () => {
    const c = mkClock(5);
    const s0 = playing(c);
    const lists: [string[], string[]] = [
      [...cellsOf(FLEET1, 'L2'), ...cellsOf(FLEET1, 'L3')],
      [...cellsOf(FLEET0, 'L2'), ...cellsOf(FLEET0, 'L3')],
    ];
    const s = play(c, s0, lists[0], lists[1]);
    expect(s.result).toMatchObject({ winner: null, reason: 'draw' });
    expect(s.draws).toBe(1);
  });

  it('30라운드 상한: 명중 칸 수 비교, 같으면 무승부', () => {
    const c = mkClock(5);
    const s0 = playing(c);
    const first = s0.game!.firstSeat;
    const opp = first === 0 ? FLEET1 : FLEET0;
    const lists: [string[], string[]] = [[], []];
    lists[first] = [cellsOf(opp, 'L4')[0]]; // 한 칸 명중 + 나머지 미스
    const s = play(c, s0, lists[0], lists[1]);
    expect(s.result).toMatchObject({ winner: first, reason: 'cap', round: 30 });
    const c2 = mkClock(5);
    const s2 = play(c2, playing(c2), [], []);
    expect(s2.result).toMatchObject({ winner: null, reason: 'cap', round: 30 });
  });

  it('기권·나가기(대전 중)는 상대 승리, 부재 처리는 3연속 시간 초과 뒤', () => {
    const c = mkClock(2);
    const s0 = playing(c);
    expect(act(c, s0, 0, { type: 'resign' }).result).toMatchObject({ winner: 1, reason: 'resign' });
    expect(act(c, s0, 1, { type: 'leave' }).result).toMatchObject({ winner: 0, reason: 'resign' });
    expect(applyAction(s0, 0, { actionId: 'q', type: 'claimAbsent' }, ctxOf(c))).toEqual({ ok: false, error: 'INVALID', reason: 'absent_not_allowed' });
  });
});

describe('시간 초과·숨기기 시계', () => {
  it('시간 초과는 advance 한 번에 1회만, 3연속이면 부재 처리 가능', () => {
    const c = mkClock(4);
    let s = playing(c);
    const first = s.game!.firstSeat;
    c.now += TURN_MS * 50; // 오래 끊겼다 돌아옴
    const a = advance(s, ctxOf(c));
    expect(a.state.events.filter((e) => e.type === 'timeout')).toHaveLength(1);
    expect(a.state.game!.turn).not.toBe(first);
    expect(a.state.game!.clock!.deadlineAt).toBe(c.now + TURN_MS);
    // first가 3번 연속 시간 초과 → 상대는 부재 처리 가능
    s = a.state;
    const absent = first;
    let guard = 0;
    while (s.seats[absent]!.consecutiveTimeouts < 3 && ++guard < 20) {
      if (s.game!.turn === absent) {
        c.now += TURN_MS + 1;
        s = advance(s, ctxOf(c)).state;
      } else s = missTurn(c, s);
    }
    expect(s.seats[absent]!.consecutiveTimeouts).toBe(3);
    const other = absent === 0 ? 1 : 0;
    s = act(c, s, other, { type: 'claimAbsent' });
    expect(s.result).toMatchObject({ winner: other, reason: 'absent' });
  });

  it('차례인 사람이 숨으면 시계가 서고(소급) 복귀하면 남은 시간으로 재개', () => {
    const c = mkClock(4);
    c.presence = bothFresh(c.now);
    let s = playing(c);
    const t = s.game!.turn;
    const T = s.game!.clock!.startedAt;
    const hidden = (hid: 'game' | 'disguise', at: number, now: number) => {
      c.now = now;
      const p = fresh(now, hid, at);
      c.presence = t === 0 ? [p, fresh(now)] : [fresh(now), p];
    };
    hidden('disguise', T + 5000, T + 30_000);
    s = advance(s, ctxOf(c)).state;
    expect(s.game!.clock!.pause).toEqual({ since: T + 5000, remainingMs: TURN_MS - 5000 });
    expect(s.events.some((e) => e.type === 'timeout')).toBe(false);
    hidden('game', T + 65_000, T + 66_000);
    s = advance(s, ctxOf(c)).state;
    expect(s.game!.clock!.pause).toBeNull();
    expect(s.game!.clock!.deadlineAt).toBe(T + 65_000 + TURN_MS - 5000);
    expect(s.seats[t]!.hideUsedMs).toBe(60_000);
  });

  it('숨기기 예산이 바닥나면 시계가 다시 돌고 hideBudgetOut 사건', () => {
    const c = mkClock(4);
    c.presence = bothFresh(c.now);
    let s = playing(c);
    const t = s.game!.turn;
    const T = s.game!.clock!.startedAt;
    const mk = (now: number) => {
      c.now = now;
      const p = fresh(now, 'disguise', T + 1000);
      c.presence = t === 0 ? [p, fresh(now)] : [fresh(now), p];
    };
    mk(T + 2000);
    s = advance(s, ctxOf(c)).state;
    mk(T + 1000 + HIDE_BUDGET_MS + 1);
    s = advance(s, ctxOf(c)).state;
    expect(s.events.some((e) => e.type === 'hideBudgetOut')).toBe(true);
    expect(s.game!.clock!.pause).toBeNull();
    expect(s.game!.clock!.deadlineAt).toBe(T + 1000 + HIDE_BUDGET_MS + (TURN_MS - 1000));
  });

  it('이미 숨어 있다 시작한 차례는 시작 시각부터 정지', () => {
    const c = mkClock(4);
    const p = fresh(c.now, 'disguise', c.now - 10_000);
    c.presence = [p, p];
    const s = advance(playing(c), ctxOf(c)).state;
    expect(s.game!.clock!.pause!.since).toBe(s.game!.clock!.startedAt);
  });

  it('숨은 뒤 마감 시각이 지나고 나서 보고된 숨기기는 시간 초과를 막지 못한다', () => {
    const c = mkClock(4);
    c.presence = bothFresh(c.now);
    const s0 = playing(c);
    const t = s0.game!.turn;
    const T = s0.game!.clock!.startedAt;
    c.now = T + TURN_MS + 500;
    const p = fresh(c.now, 'disguise', T + TURN_MS + 100);
    c.presence = t === 0 ? [p, fresh(c.now)] : [fresh(c.now), p];
    const s = advance(s0, ctxOf(c)).state;
    expect(s.events.some((e) => e.type === 'timeout')).toBe(true);
  });
});

describe('검산(퀴즈)', () => {
  /** 4라운드 시작까지 미스로 진행 → 검산 발행 */
  function toQuiz() {
    const c = mkClock(9);
    c.presence = bothFresh(c.now);
    let s = playing(c);
    while (!s.game!.quiz) {
      c.presence = bothFresh(c.now);
      s = missTurn(c, s);
    }
    return { c, s };
  }

  it('4라운드에 출제, 발사 시계 정지·발사 거부, 정답은 상태 비밀에만', () => {
    const { c, s } = toQuiz();
    expect(s.game!.round).toBe(4);
    expect(s.game!.phase).toBe('quiz');
    expect(s.game!.clock).toBeNull();
    expect(applyAction(s, s.game!.turn, { actionId: 'f', type: 'fire', cell: 'H8' }, ctxOf(c))).toEqual({ ok: false, error: 'WRONG_PHASE' });
    expect(Number.isInteger(s.secret.quiz!.answer)).toBe(true);
    expect(JSON.stringify(s.game)).not.toContain('answer');
  });

  it('오답은 3초 잠금(LOCKED), 잠금이 풀리면 정답 가능', () => {
    const { c, s: s0 } = toQuiz();
    let s = markDelivered(s0, 0, ctxOf(c)).state;
    s = markDelivered(s, 1, ctxOf(c)).state;
    const q = s.game!.quiz!;
    const ans = s.secret.quiz!.answer;
    c.now += 1000;
    s = act(c, s, 0, { type: 'answer', quizId: q.id, value: ans + 1 });
    expect(s.seats[0]!.quizLockUntil).toBe(c.now + QUIZ_LOCK_MS);
    c.now += 500;
    expect(applyAction(s, 0, { actionId: 'l', type: 'answer', quizId: q.id, value: ans }, ctxOf(c))).toEqual({ ok: false, error: 'LOCKED' });
    c.now += QUIZ_LOCK_MS;
    s = act(c, s, 0, { type: 'answer', quizId: q.id, value: ans });
    expect(s.game!.quiz!.elapsedMs[0]).not.toBeNull();
    expect(applyAction(s, 0, { actionId: 'z', type: 'answer', quizId: 'old', value: ans }, ctxOf(c))).toEqual({ ok: false, error: 'INVALID', reason: 'quiz_stale' });
  });

  it('사람별 경과 시간 비교: 0.2초 이내면 둘 다, 아니면 빠른 쪽만(나중에 도착해도)', () => {
    const run = (deliverB: number, answerA: number, answerB: number) => {
      const { c, s: s0 } = toQuiz();
      const t0 = c.now;
      let s = markDelivered(s0, 0, { ...ctxOf(c), now: t0 }).state;
      s = markDelivered(s, 1, { ...ctxOf(c), now: t0 + deliverB }).state;
      const q = s.game!.quiz!;
      const ans = s.secret.quiz!.answer;
      const ev: [number, 0 | 1][] = [[answerA, 0], [answerB, 1]];
      ev.sort((a, b) => a[0] - b[0]);
      for (const [at, seat] of ev) {
        c.now = at;
        s = act(c, s, seat, { type: 'answer', quizId: q.id, value: ans });
      }
      c.now = t0 + 20_000;
      s = advance(s, ctxOf(c)).state;
      const settled = s.events.find((e) => e.type === 'quizSettled') as { awarded: number[] } | undefined;
      return { awarded: settled?.awarded, s };
    };
    const t0 = 0; void t0;
    // A: 배달 0, 답 3000(경과 3000). B: 배달 500, 답 3300(경과 2800) → 차 200 → 둘 다
    const base = (() => { const { c } = toQuiz(); return c.now; })();
    expect(run(500, base + 3000, base + 3300).awarded).toEqual([0, 1]);
    // B 경과 3500 vs A 3000 → A만
    expect(run(1000, base + 3000, base + 4500).awarded).toEqual([0]);
    // 늦게 도착한 B가 경과는 더 짧다: A 4000, B 배달 1500 답 5000(3500) → B만
    expect(run(1500, base + 4000, base + 5000).awarded).toEqual([1]);
  });

  it('아무도 못 풀면 마감 뒤 expired 확정, 그때부터 20초 시계', () => {
    const { c, s: s0 } = toQuiz();
    let s = markDelivered(s0, 0, ctxOf(c)).state;
    s = markDelivered(s, 1, ctxOf(c)).state;
    c.now += QUIZ_MS + 1;
    s = advance(s, ctxOf(c)).state;
    expect(s.events.find((e) => e.type === 'quizSettled')).toMatchObject({ awarded: [], expired: true });
    expect(s.game!.phase).toBe('fire');
    expect(s.game!.clock!.deadlineAt).toBe(c.now + TURN_MS);
  });

  it('배달이 2초 안에 안 되면 출제 + 1초가 배달 시각', () => {
    const { c, s: s0 } = toQuiz();
    const issued = s0.game!.quiz!.issuedAt;
    c.now = issued + 2000;
    const s = advance(s0, ctxOf(c)).state;
    expect(s.game!.quiz!.deliveredAt).toEqual([issued + 1000, issued + 1000]);
  });

  it('조건이 안 맞으면(한쪽 숨김/접속 끊김) 다음 라운드로 미룬다', () => {
    const c = mkClock(9);
    let s = playing(c);
    while (s.game!.round < 5) {
      c.presence = [fresh(c.now), fresh(c.now, 'disguise', c.now)];
      s = missTurn(c, s);
    }
    expect(s.game!.quiz).toBeNull();
    expect(s.game!.pendingQuiz).toBe(true);
    c.presence = bothFresh(c.now);
    s = missTurn(c, s);
    s = missTurn(c, s);
    expect(s.game!.quiz).not.toBeNull();
  });
});

describe('힌트·도발', () => {
  it('힌트 값은 범위 안 배 칸 수(맞힌 칸 포함), 3종, 가장자리 3×3은 안쪽으로', () => {
    expect(countShipCellsInHint(FLEET1, { kind: 'col', col: 'E' })).toBe(4);
    expect(countShipCellsInHint(FLEET1, { kind: 'row', row: 6 })).toBe(2);
    expect(countShipCellsInHint(FLEET1, { kind: 'block', cell: 'A1' })).toBe(0); // A1:C3
    expect(countShipCellsInHint(FLEET1, { kind: 'block', cell: 'H8' })).toBe(2); // F6:H8 → F6 G6
  });

  it('받은 힌트가 없으면 거부, 검산 중에는 막힘, 쓰면 턴·시계를 쓰지 않음', () => {
    const c = mkClock(9);
    c.presence = bothFresh(c.now);
    let s = playing(c);
    expect(applyAction(s, 0, { actionId: 'h', type: 'hint', target: { kind: 'col', col: 'A' } }, ctxOf(c))).toEqual({ ok: false, error: 'INVALID', reason: 'no_hint' });
    s.seats[0]!.hintsEarned = 1;
    const deadline = s.game!.clock!.deadlineAt;
    const turn = s.game!.turn;
    s = act(c, s, 0, { type: 'hint', target: { kind: 'col', col: 'E' } });
    expect(s.seats[0]!.hints[0]).toMatchObject({ value: 4 });
    expect(s.game!.turn).toBe(turn);
    expect(s.game!.clock!.deadlineAt).toBe(deadline);
    expect(s.game!.log[0]).toMatchObject({ type: 'hint', by: 0 });
    expect(applyAction(s, 0, { actionId: 'h2', type: 'hint', target: { kind: 'col', col: 'A' } }, ctxOf(c))).toMatchObject({ reason: 'no_hint' });
    // 검산 중에는 막힘
    s.seats[1]!.hintsEarned = 1;
    s.game!.phase = 'quiz';
    expect(applyAction(s, 1, { actionId: 'h3', type: 'hint', target: { kind: 'col', col: 'A' } }, ctxOf(c))).toEqual({ ok: false, error: 'INVALID', reason: 'hint_blocked' });
  });

  it('힌트 2개를 받은 사람은 다음 검산에서 빠진다(판당 받은 개수로 센다)', () => {
    const c = mkClock(9);
    c.presence = bothFresh(c.now);
    let s = playing(c);
    s.seats[0]!.hintsEarned = 2;
    s.seats[0]!.hints = [
      { target: { kind: 'col', col: 'A' }, value: 0, round: 1, at: 0 },
      { target: { kind: 'col', col: 'B' }, value: 0, round: 1, at: 0 },
    ]; // 다 써도 새 퀴즈 자격 없음
    while (!s.game!.quiz) {
      c.presence = bothFresh(c.now);
      s = missTurn(c, s);
    }
    expect(s.game!.quiz!.eligible).toEqual([false, true]);
  });

  it('도발: 라운드 쿨다운(3), 문구 id 범위', () => {
    const c = mkClock(9);
    let s = playing(c);
    s = act(c, s, 0, { type: 'taunt', tauntId: 3 });
    expect(applyAction(s, 0, { actionId: 'a', type: 'taunt', tauntId: 4 }, ctxOf(c))).toEqual({ ok: false, error: 'INVALID', reason: 'taunt_cooldown' });
    expect(applyAction(s, 1, { actionId: 'b', type: 'taunt', tauntId: 10 }, ctxOf(c))).toEqual({ ok: false, error: 'INVALID', reason: 'taunt_id' });
    expect(s.game!.log).toHaveLength(1);
    while (s.game!.round < 4) s = missTurn(c, s);
    s = act(c, s, 0, { type: 'taunt', tauntId: 5 });
    expect(s.game!.log).toHaveLength(2);
  });
});

describe('결재 경보', () => {
  function toAlarm(alarmRound = 2) {
    const c = mkClock(11);
    c.presence = bothFresh(c.now);
    let s = playing(c, { alarmOn: true });
    s.secret.alarmRound = alarmRound;
    while (!s.game!.alarm) {
      c.presence = bothFresh(c.now);
      s = missTurn(c, s);
    }
    return { c, s };
  }

  it('경보 라운드에 출제, 둘 다 보고하면 즉시 판정: 3초 이내 통과·초과 실패 → 다음 발사 쉼', () => {
    const { c, s: s0 } = toAlarm();
    expect(s0.game!.round).toBe(2);
    const at = s0.game!.alarm!.issuedAt;
    let s = reportAlarm(s0, 0, { issuedAt: at, reactionMs: 800 }, ctxOf(c)).state;
    expect(s.game!.alarm).not.toBeNull();
    s = reportAlarm(s, 1, { issuedAt: at, reactionMs: ALARM_HIDE_MS + 1 }, ctxOf(c)).state;
    expect(s.game!.alarm).toBeNull();
    expect(s.events.find((e) => e.type === 'alarmResult')).toMatchObject({ outcomes: ['pass', 'fail'] });
    expect(s.seats[1]!.skipNextFire).toBe(true);
    expect(s.seats[0]!.skipNextFire).toBe(false);
    // 다른 issuedAt 보고는 무시
    expect(reportAlarm(s0, 0, { issuedAt: at + 1, reactionMs: 1 }, ctxOf(c)).changed).toBe(false);
  });

  it('보고가 없으면 10초 뒤: 접속 중이면 실패, 끊겼으면 제외. 숨은 시간 포함 없이도 3초 경계는 포함', () => {
    const { c, s: s0 } = toAlarm();
    const at = s0.game!.alarm!.issuedAt;
    let s = reportAlarm(s0, 0, { issuedAt: at, reactionMs: ALARM_HIDE_MS }, ctxOf(c)).state;
    c.now = at + 10_000;
    c.presence = [fresh(c.now), fresh(c.now - 7000)];
    s = advance(s, ctxOf(c)).state;
    expect(s.events.find((e) => e.type === 'alarmResult')).toMatchObject({ outcomes: ['pass', 'excluded'] });
    expect(s.seats[1]!.skipNextFire).toBe(false);
  });

  it('쉬기로 한 사람의 다음 차례는 skip 사건으로 건너뛴다', () => {
    const { c, s: s0 } = toAlarm();
    const at = s0.game!.alarm!.issuedAt;
    let s = reportAlarm(s0, 0, { issuedAt: at, reactionMs: 100 }, ctxOf(c)).state;
    s = reportAlarm(s, 1, { issuedAt: at, reactionMs: 9000 }, ctxOf(c)).state;
    const before = s.game!.round;
    for (let i = 0; i < 4 && !s.events.some((e) => e.type === 'skip'); i++) s = missTurn(c, s);
    expect(s.events.some((e) => e.type === 'skip' && e.seat === 1)).toBe(true);
    expect(s.game!.round).toBeGreaterThanOrEqual(before);
  });

  it('alarmOn이 꺼져 있으면 경보 라운드가 없다', () => {
    const c = mkClock(1);
    expect(playing(c, { alarmOn: false }).secret.alarmRound).toBeNull();
    const r = playing(mkClock(1), { alarmOn: true }).secret.alarmRound!;
    expect(r).toBeGreaterThanOrEqual(6);
    expect(r).toBeLessThanOrEqual(15);
  });
});

describe('재대결·중복 제거', () => {
  it('두 사람이 모두 누르면 판 순번 +1, 선공 교대, 전적 유지; 2분이 지나면 요청 만료', () => {
    const c = mkClock(2);
    let s = playing(c);
    const first = s.game!.firstSeat;
    s = act(c, s, 0, { type: 'resign' });
    s = act(c, s, 0, { type: 'rematch' });
    expect(s.rematch.requested).toEqual([true, false]);
    c.now += 120_001;
    s = advance(s, ctxOf(c)).state;
    expect(s.rematch.requested).toEqual([false, false]);
    s = act(c, s, 0, { type: 'rematch' });
    s = act(c, s, 1, { type: 'rematch' });
    expect(s.status).toBe('placing');
    expect(s.matchSeq).toBe(2);
    expect(s.wins).toEqual([0, 1]);
    expect(s.seats[0]!.placed).toBe(false);
    for (const seat of [0, 1] as const) s = act(c, s, seat, { type: 'place', ships: seat === 0 ? FLEET0 : FLEET1, confirm: true });
    expect(s.game!.firstSeat).toBe(first === 0 ? 1 : 0);
    expect(s.game!.matchId).not.toBe('');
  });

  it('상대가 나갔으면 재대결 거부', () => {
    const c = mkClock(2);
    let s = playing(c);
    s = act(c, s, 0, { type: 'resign' });
    s = act(c, s, 1, { type: 'leave' });
    expect(applyAction(s, 0, { actionId: 'r', type: 'rematch' }, ctxOf(c))).toEqual({ ok: false, error: 'INVALID', reason: 'rematch_closed' });
  });

  it('같은 actionId 재전송은 다시 적용하지 않는다', () => {
    const c = mkClock(2);
    const s = playing(c);
    const seat = s.game!.turn;
    const body = { actionId: 'dup1', type: 'fire', cell: 'H8' } as const;
    const r1 = applyAction(s, seat, body, ctxOf(c));
    if (!r1.ok) throw new Error();
    const r2 = applyAction(r1.state, seat, body, ctxOf(c));
    expect(r2.ok && r2.duplicate).toBe(true);
    expect(r2.ok && r2.changed).toBe(false);
  });
});

describe('검산 생성', () => {
  it('정답은 항상 정수, 값 개수는 종류 규격과 같고 암산 수준', () => {
    const rng = seededRng(3);
    const kinds = new Set<string>();
    for (let i = 0; i < 2000; i++) {
      const q = generateQuiz(rng);
      kinds.add(q.kind);
      expect(Number.isInteger(q.answer)).toBe(true);
      expect(q.answer).toBeGreaterThan(0);
      expect(quizShapeOk(q.kind, q.values)).toBe(true);
      if (q.kind === 'vat') expect(q.values[0] % 10_000).toBe(0);
      if (q.kind === 'diff') expect(q.values[0]).toBeGreaterThan(q.values[1]);
    }
    expect(kinds.size).toBe(3);
  });
});
