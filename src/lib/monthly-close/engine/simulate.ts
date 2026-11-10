/**
 * 판 길이·밸런스 시뮬레이터 (G0-3). 순수 TS — 실제 엔진(createRoomState → place → fire → answer → advance …)을 그대로 돌린다.
 *
 * 봇("보통", 기획서 부록 B와 같은 정의): 맞힌 칸이 있으면 상하좌우를 쏘고, 없으면 무작위. 힌트가 있으면 3종 중 하나를 골라 쓰고
 * 그 정보(범위 안의 배 칸 수)로 후보 칸을 좁힌다. 시간은 가상 시계(차례마다 +8초)이고 시간 초과는 없다.
 * 검산: 풀 수 있는 사람은 solveProb 확률로 2~9초에 정답을 낸다(0이면 힌트 없는 판).
 *
 * 힌트 사용 모델(hintModel, D3 백엔드팀장 추가)
 *  - 'perfect'(기본): 받으면 그 차례에 바로 쓰고, 3×3은 미확인 칸이 가장 많은 곳, 값은 매 차례 완전히 활용한다.
 *  - 'human': 사람처럼 늦게·덜 효율적으로 쓴다. 상수는 HUMAN_HINT 참고. 사격 실력(사냥 규칙)은 두 모델이 같다.
 *
 * 잡음(noise, QA 수정 검증용 — 생략하면 예전과 같은 난수 소비·같은 결과)
 *  - notReady: 발사마다 이 확률로 한 사람의 접속 신호가 PRESENCE_MS보다 오래됨 → 그 발사로 시작하는 라운드는 검산·경보 출제 조건 불충족(미룸).
 *  - timeout: 차례마다 이 확률로 쏘지 않고 TURN_MS를 넘겨 시간 초과.
 *  BUG-15(미뤄진 검산 합침)·BUG-16(경보 실패 쉼 + 같은 차례 시간 초과 = 2턴 손실)은 이 잡음이 있어야 드러난다.
 */

import {
  ALL_CELLS,
  COLS,
  hintRange,
  placementCells,
  rangeCells,
  stepCell,
  type CellAddr,
  type HintTarget,
} from '../coords';
import { PRESENCE_MS, TURN_MS } from '../constants';
import type { Seat } from '../protocol';
import { advance, applyAction, createRoomState, joinSeat, markDelivered, reportAlarm } from './core';
import { randomFleet } from './placement';
import { seededRng } from './rng';
import type { EngineCtx, PresencePair, RoomState, Rng } from './types';

export type HintModel = 'perfect' | 'human';

/**
 * 'human' 힌트 모델 값(근거는 추정 — 플레이테스트로 갱신):
 *  - usePerTurn: 쓸 힌트가 있을 때 자기 차례마다 쓸 확률. 0.35면 평균 약 2.9차례 늦게 쓴다(아끼거나 잊음).
 *  - remember: 쓴 힌트 값을 이후 사격에 반영하는 확률(힌트마다 한 번 정함). 나머지는 보고 잊는다.
 *  - follow: 기억한 힌트가 있을 때, 이번 차례에 그 범위 안을 쏠 확률(나머지는 평소처럼 무작위·사냥).
 *  - 3×3 위치는 판 위 무작위(미확인 칸 최대 위치를 계산하지 않음).
 */
export const HUMAN_HINT = { usePerTurn: 0.35, remember: 0.6, follow: 0.6 } as const;

export interface SimOptions {
  games: number;
  seed: number;
  /** 검산을 풀 수 있는 사람이 정답을 내는 확률(0 = 힌트 없는 판) */
  solveProb: number;
  alarmOn: boolean;
  /** 기본 'perfect' */
  hintModel?: HintModel;
  /** 'human' 모델 값 덮어쓰기(민감도 분석용). 생략하면 HUMAN_HINT */
  human?: Partial<HumanHintParams>;
  /** 접속 끊김·시간 초과 잡음(생략 = 없음). 머리말 참고 */
  noise?: SimNoise;
}

export interface SimNoise {
  readonly notReady: number;
  readonly timeout: number;
}

export type HumanHintParams = { readonly usePerTurn: number; readonly remember: number; readonly follow: number };

export type HintDiff = '2-0' | '2-1' | '1-0';

export interface SimStats {
  games: number;
  medianRounds: number;
  p75Rounds: number;
  p90Rounds: number;
  /** 비율(0~1) */
  firstWin: number;
  secondWin: number;
  draw: number;
  capRate: number;
  drawSameRound: number;
  avgHintsPerGame: number;
  /** 힌트 수가 다른 판에서 힌트를 더 받은 쪽이 이긴 비율(승패가 갈린 판만) */
  moreHintsWinRate: number | null;
  moreHintsGames: number;
  /** 받은 힌트 차이별(많은 쪽-적은 쪽) 판 수와 많은 쪽 승 수 */
  moreHintsByDiff: Record<HintDiff, { games: number; wins: number }>;
  /** 받은 힌트 중 실제로 쓴 비율 */
  hintUseRate: number;
  quizzesIssued: number;
  /** 판당 출제된 검산 평균 */
  quizzesPerGame: number;
  quizzesSolvedRate: number;
  alarmFailRate: number | null;
  /** 시간 초과 총수(잡음 있을 때만) */
  timeouts: number;
  /** 경보 실패 쉼이 걸린 차례가 시간 초과된 횟수(BUG-16 경로) */
  alarmTimeoutOverlap: number;
  /** 그중 시간 초과 뒤에도 쉼이 남아 다음 자기 차례까지 잃게 된 횟수(수정 후 0이어야 함) */
  doubleTurnLoss: number;
}

function fresh(now: number): PresencePair {
  const p = { lastSeenAt: now, viewState: 'game' as const, viewStateAt: 0 };
  return [p, p];
}

/** 한 사람(1번 자리)의 접속 신호가 오래된 상태 — 출제 조건 불충족 */
function oneStale(now: number): PresencePair {
  return [
    { lastSeenAt: now, viewState: 'game', viewStateAt: 0 },
    { lastSeenAt: now - PRESENCE_MS - 1, viewState: 'game', viewStateAt: 0 },
  ];
}

interface BotMemory {
  hints: { cells: CellAddr[]; count: number }[];
}

interface BotStyle {
  model: HintModel;
  human: HumanHintParams;
}

const PERFECT: BotStyle = { model: 'perfect', human: HUMAN_HINT };

function neighbours(c: CellAddr): CellAddr[] {
  return [stepCell(c, 1, 0), stepCell(c, -1, 0), stepCell(c, 0, 1), stepCell(c, 0, -1)].filter((x) => x !== c);
}

function pick<T>(rng: Rng, xs: readonly T[]): T {
  return xs[Math.min(xs.length - 1, Math.floor(rng() * xs.length))];
}

/** 봇이 쏠 칸을 고른다. 상태에서 자기 사격 기록만 본다(상대 배는 보지 않는다). */
function chooseCell(s: RoomState, seat: Seat, mem: BotMemory, rng: Rng, style: BotStyle = PERFECT): CellAddr {
  const g = s.game!;
  const shot = new Map(g.shots[seat].map((x) => [x.cell, x.result] as const));
  const sunkCells = new Set(g.sunk[seat].flatMap((p) => placementCells(p) ?? []));
  const unshot = (c: CellAddr) => !shot.has(c);
  const hunting = g.shots[seat].filter((x) => x.result === 'hit' && !sunkCells.has(x.cell)).map((x) => x.cell);
  if (hunting.length) {
    const cand = hunting.flatMap(neighbours).filter(unshot);
    if (cand.length) {
      return pick(rng, cand);
    }
  }
  // 힌트 정보(사람 모델은 이번 차례에 힌트를 따를지부터 정한다)
  if (style.model === 'human' && mem.hints.length && rng() >= style.human.follow) {
    return pick(rng, ALL_CELLS.filter(unshot));
  }
  const excluded = new Set<CellAddr>();
  let best: CellAddr[] | null = null;
  for (const h of mem.hints) {
    const found = h.cells.filter((c) => shot.has(c) && shot.get(c) !== 'miss').length;
    const remaining = h.count - found;
    const open = h.cells.filter(unshot);
    if (remaining <= 0) open.forEach((c) => excluded.add(c));
    else if (open.length && (best === null || open.length < best.length)) best = open;
  }
  if (best) {
    const usable = best.filter((c) => !excluded.has(c));
    if (usable.length) return pick(rng, usable);
  }
  const free = ALL_CELLS.filter((c) => unshot(c) && !excluded.has(c));
  return pick(rng, free.length ? free : ALL_CELLS.filter(unshot));
}

function chooseHint(s: RoomState, seat: Seat, rng: Rng, style: BotStyle = PERFECT): HintTarget {
  if (style.model === 'human') {
    const roll = rng();
    if (roll < 0.34) return { kind: 'col', col: pick(rng, COLS) };
    if (roll < 0.67) return { kind: 'row', row: (1 + Math.floor(rng() * 8)) as 1 };
    return { kind: 'block', cell: pick(rng, ALL_CELLS) };
  }
  const g = s.game!;
  const shot = new Set(g.shots[seat].map((x) => x.cell));
  // 아직 안 쏜 칸이 가장 많은 3×3 블록(동률은 무작위)
  let bestScore = -1;
  let bestCells: CellAddr[] = [];
  for (const c of ALL_CELLS) {
    const unknown = rangeCells(hintRange({ kind: 'block', cell: c })).filter((x) => !shot.has(x)).length;
    if (unknown > bestScore) {
      bestScore = unknown;
      bestCells = [c];
    } else if (unknown === bestScore) bestCells.push(c);
  }
  const roll = rng();
  if (roll < 0.34) return { kind: 'col', col: pick(rng, COLS) };
  if (roll < 0.67) return { kind: 'row', row: (1 + Math.floor(rng() * 8)) as 1 };
  return { kind: 'block', cell: pick(rng, bestCells) };
}

interface GameOutcome {
  rounds: number;
  firstSeat: Seat;
  winner: Seat | null;
  reason: string;
  hints: [number, number];
  hintsUsed: [number, number];
  quizzes: { issued: number; solved: number; eligibleSeats: number };
  alarmOutcomes: ('pass' | 'fail' | 'excluded')[];
  timeouts: number;
  alarmTimeoutOverlap: number;
  doubleTurnLoss: number;
}

/** 한 판. 반환: 결과 요약. 엔진 오류가 나면 throw(시뮬이 곧 엔진 통합 테스트). */
export function simulateOne(opts: Pick<SimOptions, 'solveProb' | 'alarmOn' | 'hintModel' | 'human' | 'noise'>, rng: Rng): GameOutcome {
  const style: BotStyle = { model: opts.hintModel ?? 'perfect', human: { ...HUMAN_HINT, ...opts.human } };
  const noise = opts.noise;
  let t = 1_000_000;
  let idn = 0;
  let ready = true;
  const mk = (): EngineCtx => ({ now: t, rng, newId: () => `m${++idn}`, presence: ready ? fresh(t) : oneStale(t) });
  let timeouts = 0;
  let overlap = 0;
  let doubleLoss = 0;
  let s = createRoomState({ code: '12345', keyHash: 'a'.repeat(64), nickname: 'A', industry: 0, alarmOn: opts.alarmOn });
  const j = joinSeat(s, { keyHash: 'b'.repeat(64), nickname: 'B', industry: 1 }, mk());
  if (!j.ok) throw new Error('join failed');
  s = j.stepped.state;
  let aid = 0;
  for (const seat of [0, 1] as const) {
    t += 10;
    const r = applyAction(s, seat, { actionId: `p${++aid}`, type: 'place', ships: randomFleet(rng), confirm: true }, mk());
    if (!r.ok) throw new Error(`place failed ${r.error}`);
    s = r.state;
  }
  if (s.status !== 'playing') throw new Error(`not playing: ${s.status}`);

  const mem: [BotMemory, BotMemory] = [{ hints: [] }, { hints: [] }];
  const quizzes = { issued: 0, solved: 0, eligibleSeats: 0 };
  let guard = 0;
  while (s.status === 'playing') {
    if (++guard > 400) throw new Error('sim loop guard');
    const g = s.game!;
    if (g.alarm) {
      const issuedAt = g.alarm.issuedAt;
      for (const seat of [0, 1] as const) {
        const ms = Math.floor(rng() * 4500);
        t += 5;
        s = reportAlarm(s, seat, { issuedAt, reactionMs: ms }, mk()).state;
      }
      continue;
    }
    if (g.phase === 'quiz' && g.quiz) {
      const q = g.quiz;
      quizzes.issued += 1;
      const t0 = t;
      t += 5;
      for (const seat of [0, 1] as const) s = markDelivered(s, seat, { ...mk(), now: t0 }).state;
      const answerKey = s.secret.quiz!.answer;
      const plan = ([0, 1] as const)
        .filter((seat) => q.eligible[seat])
        .map((seat) => ({ seat, ms: 2000 + Math.floor(rng() * 7000), solve: rng() < opts.solveProb }))
        .sort((a, b) => a.ms - b.ms);
      quizzes.eligibleSeats += plan.length;
      for (const p of plan) {
        if (!p.solve) continue;
        t = t0 + p.ms;
        const r = applyAction(s, p.seat, { actionId: `a${++aid}`, type: 'answer', quizId: q.id, value: answerKey }, mk());
        if (r.ok) {
          s = r.state;
          quizzes.solved += 1;
        }
      }
      t = Math.max(t, t0 + 16_000);
      s = advance(s, mk()).state;
      continue;
    }
    // 발사 차례
    const seat = g.turn;
    const me = s.seats[seat]!;
    if (noise) {
      ready = rng() >= noise.notReady;
      if (rng() < noise.timeout) {
        // 쏘지 않고 차례를 넘긴다. beginTurn이 쉼을 먼저 소진하므로 여기서 쉼이 켜져 있으면 이 차례 도중 경보 실패로 걸린 것
        const skipBefore = me.skipNextFire;
        const seqBefore = s.eventSeq;
        t += TURN_MS;
        s = advance(s, mk()).state;
        timeouts++;
        if (skipBefore) {
          overlap++;
          // 2턴 손실 = 쉼이 남았거나(다음 자기 차례에 쉼), 같은 advance 안에서 이미 자기 차례를 skip으로 넘김(둘 다 실패한 경우)
          const skippedNow = s.events.some((e) => e.seq > seqBefore && e.type === 'skip' && (e as { seat: Seat }).seat === seat);
          if (s.seats[seat]!.skipNextFire || skippedNow) doubleLoss++;
        }
        continue;
      }
    }
    if (me.hintsEarned - me.hints.length > 0 && (style.model === 'perfect' || rng() < style.human.usePerTurn)) {
      const target = chooseHint(s, seat, rng, style);
      t += 20;
      const r = applyAction(s, seat, { actionId: `h${++aid}`, type: 'hint', target }, mk());
      if (!r.ok) throw new Error(`hint failed ${r.error} ${r.reason ?? ''}`);
      s = r.state;
      const mine = s.seats[seat]!.hints[s.seats[seat]!.hints.length - 1];
      if (style.model === 'perfect' || rng() < style.human.remember) {
        mem[seat].hints.push({ cells: rangeCells(hintRange(mine.target)), count: mine.value });
      }
    }
    const cell = chooseCell(s, seat, mem[seat], rng, style);
    t += 8000;
    const r = applyAction(s, seat, { actionId: `f${++aid}`, type: 'fire', cell }, mk());
    if (!r.ok) throw new Error(`fire failed ${r.error} ${r.reason ?? ''} ${cell}`);
    s = r.state;
    s = advance(s, mk()).state;
  }
  const res = s.result!;
  return {
    rounds: res.round,
    firstSeat: s.game!.firstSeat,
    winner: res.winner,
    reason: res.reason,
    hints: [s.seats[0]!.hintsEarned, s.seats[1]!.hintsEarned],
    hintsUsed: [s.seats[0]!.hints.length, s.seats[1]!.hints.length],
    quizzes,
    alarmOutcomes: s.game!.stats.alarmOutcome ?? [],
    timeouts,
    alarmTimeoutOverlap: overlap,
    doubleTurnLoss: doubleLoss,
  };
}

function quantile(sorted: number[], q: number): number {
  return sorted[Math.min(sorted.length - 1, Math.floor(q * sorted.length))];
}

export function simulate(opts: SimOptions): SimStats {
  const rng = seededRng(opts.seed);
  const rounds: number[] = [];
  let first = 0;
  let second = 0;
  let draw = 0;
  let cap = 0;
  let drawSame = 0;
  let hintsTotal = 0;
  let moreWins = 0;
  let moreGames = 0;
  let hintsUsedTotal = 0;
  const byDiff: Record<HintDiff, { games: number; wins: number }> = { '2-0': { games: 0, wins: 0 }, '2-1': { games: 0, wins: 0 }, '1-0': { games: 0, wins: 0 } };
  let qIssued = 0;
  let qSolved = 0;
  let qSeats = 0;
  let alarmN = 0;
  let alarmFail = 0;
  let timeouts = 0;
  let overlap = 0;
  let doubleLoss = 0;
  for (let i = 0; i < opts.games; i++) {
    const o = simulateOne(opts, rng);
    rounds.push(o.rounds);
    if (o.reason === 'cap') cap++;
    if (o.reason === 'draw') drawSame++;
    if (o.winner === null) draw++;
    hintsTotal += o.hints[0] + o.hints[1];
    hintsUsedTotal += o.hintsUsed[0] + o.hintsUsed[1];
    qIssued += o.quizzes.issued;
    qSolved += o.quizzes.solved;
    qSeats += o.quizzes.eligibleSeats;
    timeouts += o.timeouts;
    overlap += o.alarmTimeoutOverlap;
    doubleLoss += o.doubleTurnLoss;
    for (const a of o.alarmOutcomes) {
      if (a !== 'excluded') {
        alarmN++;
        if (a === 'fail') alarmFail++;
      }
    }
    if (o.winner !== null) {
      if (o.winner === o.firstSeat) first++;
      else second++;
      if (o.hints[0] !== o.hints[1]) {
        moreGames++;
        const more: Seat = o.hints[0] > o.hints[1] ? 0 : 1;
        const key = `${o.hints[more]}-${o.hints[more === 0 ? 1 : 0]}` as HintDiff;
        if (byDiff[key]) byDiff[key].games++;
        if (o.winner === more) {
          moreWins++;
          if (byDiff[key]) byDiff[key].wins++;
        }
      }
    }
  }
  rounds.sort((a, b) => a - b);
  return {
    games: opts.games,
    medianRounds: quantile(rounds, 0.5),
    p75Rounds: quantile(rounds, 0.75),
    p90Rounds: quantile(rounds, 0.9),
    firstWin: first / opts.games,
    secondWin: second / opts.games,
    draw: draw / opts.games,
    capRate: cap / opts.games,
    drawSameRound: drawSame / opts.games,
    avgHintsPerGame: hintsTotal / opts.games,
    moreHintsWinRate: moreGames ? moreWins / moreGames : null,
    moreHintsGames: moreGames,
    moreHintsByDiff: byDiff,
    hintUseRate: hintsTotal ? hintsUsedTotal / hintsTotal : 0,
    quizzesIssued: qIssued,
    quizzesPerGame: qIssued / opts.games,
    quizzesSolvedRate: qSeats ? qSolved / qSeats : 0,
    alarmFailRate: alarmN ? alarmFail / alarmN : null,
    timeouts,
    alarmTimeoutOverlap: overlap,
    doubleTurnLoss: doubleLoss,
  };
}
