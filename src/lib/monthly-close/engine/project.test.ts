import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { ALL_CELLS, placementCells, type CellAddr } from '../coords';
import { VIEW_FORBIDDEN_KEYS, type RoomView, type Seat } from '../protocol';
import { advance, applyAction, markDelivered } from './core';
import { countShipCellsInHint, judgeFire, randomFleet } from './placement';
import { viewFor } from './project';
import { seededRng } from './rng';
import { K0, K1, bothFresh, ctxOf, mkClock, playing, type Clock } from './testkit';
import type { RoomState } from './types';

const PCTX = (s: RoomState, seat: Seat, now: number) =>
  viewFor(s, seat, { version: 5, serverNow: now, bellTopic: 'mc:room', oppLastSeenAt: now, oppHidden: false });

/** 무작위 판을 steps 단계 진행(발사·검산·힌트·도발·경보 보고). */
function randomGame(seed: number, steps: number): { s: RoomState; c: Clock } {
  const c = mkClock(seed);
  c.presence = bothFresh(c.now);
  const rng = seededRng(seed ^ 0x9e3779b9);
  const fleets = [randomFleet(rng), randomFleet(rng)] as [ReturnType<typeof randomFleet>, ReturnType<typeof randomFleet>];
  let s = playing(c, { alarmOn: true, fleets });
  let aid = 0;
  const tryAct = (seat: Seat, body: Record<string, unknown>) => {
    const r = applyAction(s, seat, { actionId: `r${++aid}`, ...body } as never, ctxOf(c));
    if (r.ok) s = r.state;
    return r.ok;
  };
  for (let i = 0; i < steps && s.status === 'playing'; i++) {
    c.now += 700 + Math.floor(rng() * 800);
    c.presence = bothFresh(c.now);
    s = advance(s, ctxOf(c)).state;
    if (s.status !== 'playing') break;
    const g = s.game!;
    if (g.alarm) {
      c.now += 10;
      tryAct(0, { type: 'taunt', tauntId: 1 });
      continue;
    }
    if (g.quiz) {
      for (const seat of [0, 1] as const) s = markDelivered(s, seat, ctxOf(c)).state;
      const ans = s.secret.quiz!.answer;
      const seat = (rng() < 0.5 ? 0 : 1) as Seat;
      tryAct(seat, { type: 'answer', quizId: g.quiz.id, value: rng() < 0.3 ? ans + 1 : ans });
      c.now += 12_000;
      s = advance(s, ctxOf(c)).state;
      continue;
    }
    for (const seat of [0, 1] as const) {
      if (rng() < 0.3) tryAct(seat, { type: 'hint', target: { kind: 'block', cell: ALL_CELLS[Math.floor(rng() * 64)] } });
      if (rng() < 0.2) tryAct(seat, { type: 'taunt', tauntId: Math.floor(rng() * 10) });
    }
    const seat = g.turn;
    const free = ALL_CELLS.filter((x) => !g.shots[seat].some((y) => y.cell === x));
    tryAct(seat, { type: 'fire', cell: free[Math.floor(rng() * free.length)] });
  }
  return { s, c };
}

function allKeys(v: unknown, out = new Set<string>()): Set<string> {
  if (Array.isArray(v)) v.forEach((x) => allKeys(x, out));
  else if (v && typeof v === 'object') {
    for (const [k, x] of Object.entries(v)) {
      out.add(k);
      allKeys(x, out);
    }
  }
  return out;
}

describe('투영 속성: 숨긴 정보 유출 0건 (무작위 판 1,000개)', () => {
  it('대전 중 직렬화에 금지 키·reveal·원본 키 해시가 없고, opp에 배 필드가 없다', () => {
    let playingViews = 0;
    let endedViews = 0;
    fc.assert(
      fc.property(fc.integer({ min: 1, max: 2 ** 30 }), fc.integer({ min: 0, max: 90 }), (seed, steps) => {
        const { s, c } = randomGame(seed, steps);
        for (const seat of [0, 1] as const) {
          const v = PCTX(s, seat, c.now);
          const json = JSON.stringify(v);
          const keys = allKeys(v);
          if (v.status === 'ended') {
            endedViews++;
            expect(keys.has('reveal')).toBe(true);
          } else {
            playingViews++;
            for (const k of VIEW_FORBIDDEN_KEYS) expect(keys.has(k), `금지 키 ${k}`).toBe(false);
          }
          for (const k of VIEW_FORBIDDEN_KEYS) if (k !== 'reveal') expect(keys.has(k), `금지 키 ${k}`).toBe(false);
          expect(json).not.toContain(K0);
          expect(json).not.toContain(K1);
          if (v.opp) {
            expect('ships' in v.opp).toBe(false);
            expect('hints' in v.opp).toBe(false);
            expect('quizLockUntil' in v.opp).toBe(false);
          }
          // 아직 맞지 않은 상대 배의 "배치 정의"({slot,start,dir})는 직렬화 어디에도 없다(종결·종료 후 제외)
          if (v.status !== 'ended') {
            const oppBoard = s.secret.boards[seat === 0 ? 1 : 0];
            const sunk = new Set((v.status === 'playing' ? v.game.sunkByMe : []).map((x) => `${x.slot}|${x.start}|${x.dir}`));
            for (const p of oppBoard) {
              if (sunk.has(`${p.slot}|${p.start}|${p.dir}`)) continue;
              // 두 판의 좌표계는 같아서, 내 배와 우연히 같은 정의면 비교에서 뺀다
              if (s.secret.boards[seat].some((q) => q.slot === p.slot && q.start === p.start && q.dir === p.dir)) continue;
              const frag = JSON.stringify({ slot: p.slot, start: p.start, dir: p.dir });
              expect(json.includes(frag.slice(1, -1)), `배치 정의 ${frag}`).toBe(false);
            }
          }
        }
      }),
      { numRuns: 1000 },
    );
    expect(playingViews).toBeGreaterThan(1000);
    expect(endedViews).toBeGreaterThan(0);
  }, 120_000);

  it('비간섭: 숨긴 값(검산 정답·경보 라운드·상대 힌트 값·배달/보고 시각·상대 키)을 바꿔도 내 화면이 그대로다', () => {
    fc.assert(
      fc.property(fc.integer({ min: 1, max: 2 ** 30 }), fc.integer({ min: 0, max: 60 }), (seed, steps) => {
        const { s, c } = randomGame(seed, steps);
        if (s.status !== 'playing') return;
        for (const seat of [0, 1] as const) {
          const o = (seat === 0 ? 1 : 0) as Seat;
          const base = JSON.stringify(PCTX(s, seat, c.now));
          const m = structuredClone(s);
          if (m.secret.quiz) m.secret.quiz.answer += 7;
          m.secret.alarmRound = (m.secret.alarmRound ?? 0) + 3;
          m.seats[o]!.keyHash = 'f'.repeat(64);
          m.seats[o]!.actionIds = ['zzz'];
          m.seats[o]!.hints = m.seats[o]!.hints.map((h) => ({ ...h, value: h.value + 1 }));
          m.seats[o]!.quizLockUntil = c.now + 123_456;
          if (m.game!.quiz) {
            m.game!.quiz.deliveredAt[o] = (m.game!.quiz.deliveredAt[o] ?? 0) + 17;
          }
          if (m.game!.alarm) m.game!.alarm.reactionMs[o] = 4242;
          expect(JSON.stringify(PCTX(m, seat, c.now))).toBe(base);
        }
      }),
      { numRuns: 400 },
    );
  }, 120_000);

  it('비간섭: 관측과 모순되지 않는 다른 상대 배치로 바꿔도 내 화면이 그대로다(아직 안 맞은 칸 정보 0)', () => {
    let verified = 0;
    let tried = 0;
    fc.assert(
      fc.property(fc.integer({ min: 1, max: 2 ** 30 }), fc.integer({ min: 0, max: 14 }), (seed, steps) => {
        const { s, c } = randomGame(seed, steps);
        if (s.status !== 'playing') return;
        const rng = seededRng(seed + 1);
        for (const seat of [0, 1] as const) {
          const o = (seat === 0 ? 1 : 0) as Seat;
          tried++;
          const g = s.game!;
          const base = JSON.stringify(PCTX(s, seat, c.now));
          let alt = null as ReturnType<typeof randomFleet> | null;
          for (let t = 0; t < 400 && !alt; t++) {
            const f = randomFleet(rng);
            // 관측과 일치: 내 사격 결과, 종결된 배, 내 힌트 값
            const hit = new Set<CellAddr>();
            let ok = true;
            for (const sh of g.shots[seat]) {
              const j = judgeFire(f, sh.cell, hit);
              if (j.result !== sh.result) {
                ok = false;
                break;
              }
              if (j.result !== 'miss') hit.add(sh.cell);
            }
            if (!ok) continue;
            for (const k of g.sunk[seat]) if (!f.some((p) => p.slot === k.slot && p.start === k.start && p.dir === k.dir)) ok = false;
            for (const h of s.seats[seat]!.hints) if (countShipCellsInHint(f, h.target) !== h.value) ok = false;
            if (ok) alt = f;
          }
          if (!alt) continue;
          const m = structuredClone(s);
          m.secret.boards[o] = alt;
          expect(JSON.stringify(PCTX(m, seat, c.now))).toBe(base);
          verified++;
        }
      }),
      { numRuns: 400 },
    );
    expect(verified).toBeGreaterThan(100);
    expect(tried).toBeGreaterThanOrEqual(verified);
  }, 120_000);

  it('종료 후에만 상대 배치 공개: ended는 reveal 3척, 그 전에는 없음', () => {
    const c = mkClock(5);
    c.presence = bothFresh(c.now);
    let s = playing(c);
    expect(JSON.stringify(PCTX(s, 0, c.now))).not.toContain('reveal');
    const r = applyAction(s, 0, { actionId: 'x', type: 'resign' }, ctxOf(c));
    if (!r.ok) throw new Error();
    s = r.state;
    const v = PCTX(s, 0, c.now) as Extract<RoomView, { status: 'ended' }>;
    expect(v.reveal).toHaveLength(3);
    expect(v.reveal.map((p) => placementCells(p)?.length)).toEqual([4, 3, 2]);
    expect(v.result).toMatchObject({ winner: 1, reason: 'resign' });
  });
});
