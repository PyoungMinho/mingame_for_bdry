import { describe, expect, it } from 'vitest';
import { makeFixtureCase } from './fixtures';
import {
  HISTORY_LIMIT,
  absentImpact,
  activeSeats,
  applyAction,
  assignmentOf,
  canAdvance,
  canUndo,
  canUndoDisclose,
  canUnpick,
  newHostGame,
  newPlayerGame,
  railStep,
  reachedRound,
  resolveVerdict,
  resultOf,
  revealBeats,
  rolesVisible,
  syncNeedsConfirm,
  syncOptions,
  tallyVotes,
  timerRemaining,
  voteOptions,
  type GameAction,
  type GameState,
} from './game';

const c = makeFixtureCase();
const T0 = 1_700_000_000_000;

/** 시각을 흘려 가며 액션을 적용 */
function run(s: GameState, actions: GameAction[], start = T0, step = 1000): GameState {
  let now = start;
  for (const a of actions) {
    s = applyAction(s, a, { c, now });
    now += step;
  }
  return s;
}
const adv = (k: number): GameAction[] => Array.from({ length: k }, () => ({ type: 'advance' }) as GameAction);
const host = (code = '22225') => newHostGame(c, code, T0)!;
const player = (seat = 3, code = '22225') => newPlayerGame(c, code, seat, T0)!;

/** 22225: 자리 1 queen · 2 consort(범인) · 3 eunuch · 4 courtLady · 5 physician */
describe('game — 생성', () => {
  it('방장 = 자리 1, 플레이어 = 2..n, 잘못된 코드는 null', () => {
    const h = host();
    expect(h).toMatchObject({ role: 'host', seat: 1, phase: 'lobby', code: '22225', caseId: 'fixture-case', caseVersion: 3 });
    expect(h.host!.rollCall).toEqual([1]);
    expect(newPlayerGame(c, '22225', 1, T0)).toBeNull();
    expect(newPlayerGame(c, '22225', 6, T0)).toBeNull();
    expect(newPlayerGame(c, 'XXXX9', 2, T0)).toBeNull();
    expect(newHostGame(c, 'bad', T0)).toBeNull();
    expect(assignmentOf(c, h).culpritSeat).toBe(2);
  });
});

describe('game — 방장 단계 머신 전체 흐름', () => {
  it('대기→브리핑→패 확인→자기소개→R1~R3(선택·토론)→변론→지목→진상→결과', () => {
    let s = host();
    s = run(s, [{ type: 'rollCall', seat: 2 }, { type: 'rollCall', seat: 3 }]);
    expect(s.host!.rollCall).toEqual([1, 2, 3]);

    s = applyAction(s, { type: 'advance' }, { c, now: T0 + 10_000 });
    expect(s.phase).toBe('briefing');
    expect(s.host!.startedAt).toBe(T0 + 10_000);

    s = run(s, adv(2));
    expect(s.phase).toBe('intro');
    expect(s.host!.introCurrent).toBe(1);
    s = run(s, [{ type: 'introNext' }, { type: 'introNext' }, { type: 'introSet', seat: 5 }]);
    expect(s.host!.introCurrent).toBe(5);
    expect(applyAction(s, { type: 'introNext' }, { c, now: T0 })).toBe(s); // 마지막 뒤엔 비활성

    s = applyAction(s, { type: 'advance' }, { c, now: T0 + 60_000 });
    expect(s.phase).toBe('r1');
    expect(s.host!.roundSub).toBe('select');
    // 개선 묶음 1 G2: 낭독 먼저 — 조사 라운드에 들어서면 고르기 타이머는 멈춰 있고, 방장이 「고르기 2분 시작」으로 연다
    expect(s.host!.timer).toBeNull();
    s = applyAction(s, { type: 'timer', op: 'restart' }, { c, now: T0 + 90_000 });
    expect(s.host!.timer).toMatchObject({ kind: 'select', running: true, totalMs: 120_000, endsAt: T0 + 90_000 + 120_000 });

    s = run(s, adv(1));
    expect(s.host!.roundSub).toBe('discuss');
    expect(s.host!.timer).toMatchObject({ kind: 'discuss', totalMs: 420_000 });
    s = run(s, adv(1));
    expect([s.phase, s.host!.roundSub]).toEqual(['r2', 'select']);
    expect(s.host!.timer).toBeNull(); // G2: 토론 → 다음 조사도 멈춘 채로
    s = run(s, adv(3));
    expect([s.phase, s.host!.roundSub]).toEqual(['r3', 'discuss']);

    s = run(s, adv(1));
    expect(s.phase).toBe('defense');
    expect(s.host!.defense).toEqual({ order: [1, 2, 3, 4, 5], index: 0 });
    expect(s.host!.timer).toMatchObject({ kind: 'defense', totalMs: 60_000, running: true });
    s = run(s, adv(4));
    expect(s.host!.defense!.index).toBe(4);
    s = run(s, adv(1));
    expect(s.phase).toBe('vote');
    expect(s.host!.vote).toEqual({ sub: 'ready', first: {} });
    expect(s.host!.timer).toBeNull();

    s = run(s, adv(1));
    expect(s.host!.vote!.sub).toBe('input');
    expect(canAdvance(s, c, T0)).toBe(false); // 입력이 덜 됐으면 진행 불가
    s = run(s, [
      { type: 'ballot', voter: 1, target: 2 },
      { type: 'ballot', voter: 2, target: 1 },
      { type: 'ballot', voter: 3, target: 2 },
      { type: 'ballot', voter: 4, target: 2 },
    ]);
    expect(s.host!.vote!.sub).toBe('input');
    s = run(s, [{ type: 'ballot', voter: 5, target: 1 }]);
    expect(s.host!.vote!.sub).toBe('tally'); // 마지막 입력 → 집계 자동 전환

    s = run(s, adv(1));
    expect(s.phase).toBe('reveal');
    expect(s.host!.revealIndex).toBe(0);
    const beats = revealBeats(c);
    expect(beats.map((b) => b.kind)).toEqual(['dark', 'story', 'story', 'story', 'culpritLine', 'culprit', 'verdict']);
    s = run(s, adv(beats.length - 2), T0 + 50 * 60_000);
    expect(s.host!.revealIndex).toBe(beats.length - 2);
    expect(s.host!.endedAt).toBeUndefined();
    s = applyAction(s, { type: 'advance' }, { c, now: T0 + 52 * 60_000 });
    expect(s.host!.revealIndex).toBe(beats.length - 1);
    expect(s.host!.endedAt).toBe(T0 + 52 * 60_000); // 판결 비트 도달 시각
    s = run(s, adv(1), T0 + 60 * 60_000);
    expect(s.phase).toBe('result');
    expect(s.host!.endedAt).toBe(T0 + 52 * 60_000);
    expect(applyAction(s, { type: 'advance' }, { c, now: T0 })).toBe(s);

    const r = resultOf(c, s)!;
    expect(r.caught).toBe(true);
    expect(r.minutes).toBe(52 - 0); // startedAt=T0+10s → 51.8분 → 52
  });

  it('자기소개 건너뛰기: 패 확인 → 1라운드 직행(고르기 타이머는 멈춘 채 — G2)', () => {
    let s = run(host(), adv(2));
    expect(s.phase).toBe('cards');
    s = applyAction(s, { type: 'skipIntro' }, { c, now: T0 });
    expect(s.phase).toBe('r1');
    expect(s.host!.roundSub).toBe('select');
    expect(s.host!.timer).toBeNull();
    expect(applyAction(s, { type: 'skipIntro' }, { c, now: T0 })).toBe(s);
  });
});

describe('game — 플레이어 게이트', () => {
  it('게이트를 누를 때마다 한 단계씩, 결과에서 멈춤', () => {
    let s = player();
    const seen = [s.phase];
    for (let i = 0; i < 12; i++) {
      s = applyAction(s, { type: 'advance' }, { c, now: T0 + i });
      seen.push(s.phase);
    }
    expect(seen.slice(0, 11)).toEqual(['lobby', 'briefing', 'cards', 'intro', 'r1', 'r2', 'r3', 'defense', 'vote', 'reveal', 'result']);
    expect(s.phase).toBe('result');
    expect(applyAction(s, { type: 'undo' }, { c, now: T0 })).toBe(s); // 플레이어는 되돌리기 없음
    expect(s.host).toBeUndefined();
  });
});

describe('game — 되돌리기', () => {
  it('직전 단계·하위 단계로, 타이머는 멈춤 상태로 복원', () => {
    let s = run(host(), [...adv(4), { type: 'timer', op: 'restart' }], T0 - 1000); // → r1 select, G2: 방장이 타이머 시작(T0+3000)
    expect(s.phase).toBe('r1');
    const before = s;
    s = applyAction(s, { type: 'advance' }, { c, now: T0 + 3000 + 50_000 }); // 50초 뒤 토론으로
    expect(s.host!.roundSub).toBe('discuss');
    s = applyAction(s, { type: 'undo' }, { c, now: T0 + 3000 + 90_000 });
    expect(s.phase).toBe('r1');
    expect(s.host!.roundSub).toBe('select');
    expect(s.host!.timer).toMatchObject({ kind: 'select', running: false, endsAt: null, remainingMs: 70_000 });
    expect(s.host!.history).toHaveLength(before.host!.history.length);
    // 재개는 방장이
    s = applyAction(s, { type: 'timer', op: 'resume' }, { c, now: T0 + 200_000 });
    expect(timerRemaining(s.host!.timer!, T0 + 210_000)).toBe(60_000);
  });

  it('단계 전진·롤콜·지목 입력은 스택에 쌓이고, 타이머 조작은 쌓이지 않는다', () => {
    let s = run(host(), [{ type: 'rollCall', seat: 3 }, ...adv(4)]);
    const depth = s.host!.history.length;
    expect(depth).toBe(5);
    s = run(s, [{ type: 'timer', op: 'pause' }, { type: 'timer', op: 'add30' }, { type: 'timer', op: 'resume' }]);
    expect(s.host!.history).toHaveLength(depth);
    expect(canUndo(s)).toBe(true);
    s = run(s, Array.from({ length: depth }, () => ({ type: 'undo' }) as GameAction));
    expect(s.phase).toBe('lobby');
    expect(s.host!.rollCall).toEqual([1]);
    expect(canUndo(s)).toBe(false);
    expect(applyAction(s, { type: 'undo' }, { c, now: T0 })).toBe(s);
  });

  it(`스택은 최대 ${HISTORY_LIMIT}개`, () => {
    let s = host();
    for (let i = 0; i < 30; i++) s = applyAction(s, { type: 'rollCall', seat: 2 }, { c, now: T0 + i });
    expect(s.host!.history).toHaveLength(HISTORY_LIMIT);
  });

  it('진상 비트도 되돌린다', () => {
    let s = run(host(), [{ type: 'syncPhase', phase: 'reveal' }, ...adv(3)]);
    expect(s.host!.revealIndex).toBe(3);
    s = applyAction(s, { type: 'undo' }, { c, now: T0 });
    expect(s.host!.revealIndex).toBe(2);
    // QA BUG-15: '전체 한 번에 보기'는 범인 도장(자백) 비트까지 — 판결은 다음 탭
    s = applyAction(s, { type: 'revealAll' }, { c, now: T0 });
    expect(s.host!.revealIndex).toBe(revealBeats(c).findIndex((b) => b.kind === 'culprit'));
  });
});

describe('game — 타이머', () => {
  it('멈춤·재개·+30초·다시 시작', () => {
    let s = run(host(), [...adv(4), { type: 'timer', op: 'restart' }], T0 - 1000); // r1 select, G2: 방장이 시작(T0+3000)
    const t0 = T0 + 3000;
    s = applyAction(s, { type: 'timer', op: 'pause' }, { c, now: t0 + 20_000 });
    expect(s.host!.timer).toMatchObject({ running: false, remainingMs: 100_000 });
    expect(applyAction(s, { type: 'timer', op: 'pause' }, { c, now: t0 })).toBe(s);
    s = applyAction(s, { type: 'timer', op: 'add30' }, { c, now: t0 + 25_000 });
    expect(s.host!.timer).toMatchObject({ remainingMs: 130_000, totalMs: 150_000 });
    s = applyAction(s, { type: 'timer', op: 'resume' }, { c, now: t0 + 30_000 });
    expect(timerRemaining(s.host!.timer!, t0 + 40_000)).toBe(120_000);
    expect(timerRemaining(s.host!.timer!, t0 + 999_999)).toBe(0);
    s = applyAction(s, { type: 'timer', op: 'restart' }, { c, now: t0 + 50_000 });
    expect(s.host!.timer).toMatchObject({ kind: 'select', totalMs: 120_000, running: true, endsAt: t0 + 170_000 });
  });
});

describe('game — 진행 단계 맞추기(O1)', () => {
  it('두 단계 이상 앞 / 새 조사 라운드 진입(한 단계여도 — QA BUG-05 우회 차단) / 진상·결과는 확인 필요', () => {
    expect(syncNeedsConfirm('r1', 'r2')).toBe(true); // 조사 2 진입 = 게이트와 같은 확인
    expect(syncNeedsConfirm('r2', 'r3')).toBe(true);
    expect(syncNeedsConfirm('intro', 'r1')).toBe(true);
    expect(syncNeedsConfirm('r1', 'r3')).toBe(true);
    expect(syncNeedsConfirm('vote', 'reveal')).toBe(true);
    expect(syncNeedsConfirm('r3', 'r1')).toBe(false);
    expect(syncNeedsConfirm('r3', 'defense')).toBe(false); // 새로 풀리는 정보 없음 — 한 단계
    expect(syncNeedsConfirm('briefing', 'cards')).toBe(false);
    const opts = syncOptions(player());
    expect(opts).toHaveLength(11);
    expect(opts.find((o) => o.current)!.phase).toBe('lobby');
    expect(opts.find((o) => o.phase === 'reveal')).toMatchObject({ spoiler: true, needsConfirm: true });
    expect(opts.find((o) => o.phase === 'r2')).toMatchObject({ entersRound: 2, needsConfirm: true });
    expect(opts.find((o) => o.phase === 'defense')).toMatchObject({ entersRound: 3 });
    expect(opts.find((o) => o.phase === 'cards')).toMatchObject({ entersRound: null });
  });

  it('플레이어: 바로 이동 / 방장: 하위 상태 초기화 + 스택', () => {
    const p = applyAction(player(), { type: 'syncPhase', phase: 'r2' }, { c, now: T0 });
    expect(p.phase).toBe('r2');
    expect(applyAction(p, { type: 'syncPhase', phase: 'r2' }, { c, now: T0 })).toBe(p);

    let h = applyAction(host(), { type: 'syncPhase', phase: 'vote' }, { c, now: T0 });
    expect(h.phase).toBe('vote');
    expect(h.host!.vote).toEqual({ sub: 'ready', first: {} });
    expect(h.host!.startedAt).toBe(T0);
    h = applyAction(h, { type: 'syncPhase', phase: 'r2' }, { c, now: T0 });
    expect(h.host!.roundSub).toBe('select');
    expect(h.host!.timer).toBeNull(); // 타이머는 재입력
    h = applyAction(h, { type: 'undo' }, { c, now: T0 });
    expect(h.phase).toBe('vote');
  });
});

describe('game — 장소 선택 잠금', () => {
  it('도달한 라운드만, 그 라운드에 열린 장소만, 한 번 고르면 잠금', () => {
    let s = player();
    expect(applyAction(s, { type: 'pickPlace', round: 1, placeId: 'hall' }, { c, now: T0 })).toBe(s); // 아직 조사 전
    s = run(s, adv(4)); // r1
    expect(reachedRound(s.phase)).toBe(1);
    expect(applyAction(s, { type: 'pickPlace', round: 2, placeId: 'hall' }, { c, now: T0 })).toBe(s); // 미래 라운드
    expect(applyAction(s, { type: 'pickPlace', round: 1, placeId: 'ghost' }, { c, now: T0 })).toBe(s);
    s = applyAction(s, { type: 'pickPlace', round: 1, placeId: 'hall' }, { c, now: T0 + 5 });
    expect(s.rounds[1]).toEqual({ placeId: 'hall', pickedAt: T0 + 5, opened: false, disclosure: 'undecided' });
    expect(applyAction(s, { type: 'pickPlace', round: 1, placeId: 'kitchen' }, { c, now: T0 })).toBe(s); // 잠금
  });

  it('단서를 열기 전까지만 되돌리기', () => {
    let s = run(player(), [...adv(4), { type: 'pickPlace', round: 1, placeId: 'hall' }]);
    expect(canUnpick(s, 1)).toBe(true);
    const undone = applyAction(s, { type: 'unpickPlace', round: 1 }, { c, now: T0 });
    expect(undone.rounds[1]).toBeUndefined();
    s = applyAction(s, { type: 'openClue', round: 1 }, { c, now: T0 });
    expect(s.rounds[1]!.opened).toBe(true);
    expect(canUnpick(s, 1)).toBe(false);
    expect(applyAction(s, { type: 'unpickPlace', round: 1 }, { c, now: T0 })).toBe(s);
  });

  it('늦참·복구: 지난 라운드는 나중에 골라도 된다', () => {
    let s = applyAction(player(), { type: 'syncPhase', phase: 'r3' }, { c, now: T0 });
    s = applyAction(s, { type: 'pickPlace', round: 1, placeId: 'clinic' }, { c, now: T0 });
    expect(applyAction(s, { type: 'pickPlace', round: 2, placeId: 'clinic' }, { c, now: T0 })).toBe(s); // R2 엔 약방 없음
    s = applyAction(s, { type: 'pickPlace', round: 2, placeId: 'pond' }, { c, now: T0 });
    expect(Object.keys(s.rounds)).toEqual(['1', '2']);
  });
});

describe('game — 공개/비공개', () => {
  const opened = () => run(player(), [...adv(4), { type: 'pickPlace', round: 1, placeId: 'hall' }]);

  it('한 번 연 뒤에만 고를 수 있다', () => {
    const s = opened();
    expect(applyAction(s, { type: 'disclose', round: 1, value: 'public' }, { c, now: T0 })).toBe(s);
  });

  it('공개 → 5초 안에만 되돌리기, 공개 → 비공개 불가', () => {
    let s = applyAction(opened(), { type: 'openClue', round: 1 }, { c, now: T0 });
    s = applyAction(s, { type: 'disclose', round: 1, value: 'public' }, { c, now: T0 + 100 });
    expect(s.rounds[1]).toMatchObject({ disclosure: 'public', disclosedAt: T0 + 100, disclosedFrom: 'undecided' });
    expect(applyAction(s, { type: 'disclose', round: 1, value: 'private' }, { c, now: T0 + 200 })).toBe(s);
    expect(canUndoDisclose(s, 1, T0 + 5_100)).toBe(true);
    expect(canUndoDisclose(s, 1, T0 + 5_101)).toBe(false);
    expect(applyAction(s, { type: 'undoDisclose', round: 1 }, { c, now: T0 + 6_000 })).toBe(s);
    const back = applyAction(s, { type: 'undoDisclose', round: 1 }, { c, now: T0 + 3_000 });
    expect(back.rounds[1]).toEqual({ placeId: 'hall', pickedAt: back.rounds[1]!.pickedAt, opened: true, disclosure: 'undecided' });
  });

  it('비공개는 언제든 공개로 바꿀 수 있고, 되돌리면 비공개로', () => {
    let s = applyAction(opened(), { type: 'openClue', round: 1 }, { c, now: T0 });
    s = applyAction(s, { type: 'disclose', round: 1, value: 'private' }, { c, now: T0 });
    expect(s.rounds[1]!.disclosure).toBe('private');
    s = applyAction(s, { type: 'disclose', round: 1, value: 'public' }, { c, now: T0 + 60_000 });
    expect(s.rounds[1]!.disclosure).toBe('public');
    s = applyAction(s, { type: 'undoDisclose', round: 1 }, { c, now: T0 + 61_000 });
    expect(s.rounds[1]!.disclosure).toBe('private');
  });
});

describe('game — 플레이어 지목·자리 바꾸기', () => {
  it('지목 단계에서만, 자기 자신 금지, 확정 후 잠금(바꾸려면 clearVote)', () => {
    let s = player(3);
    expect(applyAction(s, { type: 'castVote', target: 2 }, { c, now: T0 })).toBe(s);
    s = applyAction(s, { type: 'syncPhase', phase: 'vote' }, { c, now: T0 });
    expect(applyAction(s, { type: 'castVote', target: 3 }, { c, now: T0 })).toBe(s);
    expect(applyAction(s, { type: 'castVote', target: 9 }, { c, now: T0 })).toBe(s);
    s = applyAction(s, { type: 'castVote', target: 2 }, { c, now: T0 + 1 });
    expect(s.myVote).toEqual({ seat: 2, at: T0 + 1 });
    expect(applyAction(s, { type: 'castVote', target: 4 }, { c, now: T0 })).toBe(s);
    s = applyAction(s, { type: 'clearVote' }, { c, now: T0 });
    expect(s.myVote).toBeUndefined();
    s = applyAction(s, { type: 'castVote', target: 4 }, { c, now: T0 });
    expect(s.myVote!.seat).toBe(4);
  });

  it('자리 바꾸기 = 진행 기록 초기화(단계는 유지)', () => {
    let s = run(player(3), [...adv(4), { type: 'pickPlace', round: 1, placeId: 'hall' }]);
    s = applyAction(s, { type: 'changeSeat', seat: 4 }, { c, now: T0 });
    expect(s.seat).toBe(4);
    expect(s.rounds).toEqual({});
    expect(s.phase).toBe('r1');
    expect(applyAction(s, { type: 'changeSeat', seat: 1 }, { c, now: T0 })).toBe(s);
  });
});

/** 방장 지목 입력 헬퍼 */
function voteHost(code: string, first: Record<number, number>, revote?: Record<number, number>, absent: number[] = []): GameState {
  let s = applyAction(newHostGame(c, code, T0)!, { type: 'syncPhase', phase: 'vote' }, { c, now: T0 });
  for (const seat of absent) s = applyAction(s, { type: 'setAbsent', seat, absent: true }, { c, now: T0 });
  s = applyAction(s, { type: 'advance' }, { c, now: T0 });
  for (const [v, t] of Object.entries(first)) s = applyAction(s, { type: 'ballot', voter: Number(v), target: t }, { c, now: T0 });
  if (revote) {
    s = applyAction(s, { type: 'advance' }, { c, now: T0 });
    for (const [v, t] of Object.entries(revote)) s = applyAction(s, { type: 'ballot', voter: Number(v), target: t }, { c, now: T0 });
  }
  return s;
}

describe('game — 지목·동률 재지목·범인 도주', () => {
  it('집계 · 자기 지목 무시 · 선택지', () => {
    expect(tallyVotes({ 1: 2, 2: 1, 3: 2, 4: 4 })).toEqual({ counts: { 1: 1, 2: 2 }, max: 2, top: [2] });
    expect(tallyVotes({})).toEqual({ counts: {}, max: 0, top: [] });
    expect(voteOptions(2, [1, 2, 3, 4])).toEqual([1, 3, 4]);
    expect(voteOptions(3, [1, 2, 3, 4], [3, 4])).toEqual([4]);
  });

  it('입력 규칙 — 자기 자신·없는 자리 거부, 집계 중 수정 가능, 지우면 입력 단계로', () => {
    let s = voteHost('22225', { 1: 2, 2: 1, 3: 2, 4: 2 });
    expect(applyAction(s, { type: 'ballot', voter: 5, target: 5 }, { c, now: T0 })).toBe(s);
    expect(applyAction(s, { type: 'ballot', voter: 5, target: 7 }, { c, now: T0 })).toBe(s);
    s = applyAction(s, { type: 'ballot', voter: 5, target: 1 }, { c, now: T0 });
    expect(s.host!.vote!.sub).toBe('tally');
    s = applyAction(s, { type: 'ballot', voter: 5, target: 3 }, { c, now: T0 });
    expect(s.host!.vote!.first[5]).toBe(3);
    expect(s.host!.vote!.sub).toBe('tally');
    s = applyAction(s, { type: 'clearBallot', voter: 5 }, { c, now: T0 });
    expect(s.host!.vote!.sub).toBe('input');
  });

  it('단독 1위 = 범인 → 검거', () => {
    const s = voteHost('22225', { 1: 2, 2: 1, 3: 2, 4: 2, 5: 1 });
    const v = resolveVerdict(s.host!.vote, [1, 2, 3, 4, 5], 2);
    expect(v).toMatchObject({ stage: 'decided', accusedSeat: 2, caught: true, revoted: false });
  });

  it('단독 1위 ≠ 범인 → 도주', () => {
    const s = voteHost('22225', { 1: 3, 2: 3, 3: 1, 4: 3, 5: 2 });
    const r = resultOf(c, s)!;
    expect(r.verdict.accusedSeat).toBe(3);
    expect(r.caught).toBe(false);
  });

  it('동률 → 재지목(후보만, 후보는 다른 후보만) → 단독이면 판결', () => {
    // 7F3K4: 1 queen · 2 eunuch · 3 consort(범인) · 4 physician
    let s = voteHost('7F3K4', { 1: 3, 2: 4, 3: 4, 4: 3 });
    expect(s.host!.vote!.sub).toBe('tally');
    expect(resolveVerdict(s.host!.vote, [1, 2, 3, 4], 3).stage).toBe('needsRevote');
    s = applyAction(s, { type: 'advance' }, { c, now: T0 });
    expect(s.phase).toBe('vote');
    expect(s.host!.vote!.sub).toBe('revote');
    expect(s.host!.vote!.revote).toEqual({ candidates: [3, 4], ballots: {} });
    expect(applyAction(s, { type: 'ballot', voter: 1, target: 2 }, { c, now: T0 })).toBe(s); // 후보 아님
    expect(applyAction(s, { type: 'ballot', voter: 3, target: 3 }, { c, now: T0 })).toBe(s); // 자기 자신
    s = run(s, [
      { type: 'ballot', voter: 1, target: 3 },
      { type: 'ballot', voter: 2, target: 3 },
      { type: 'ballot', voter: 3, target: 4 },
      { type: 'ballot', voter: 4, target: 3 },
    ]);
    expect(s.host!.vote!.sub).toBe('final');
    const r = resultOf(c, s)!;
    expect(r.verdict).toMatchObject({ stage: 'decided', accusedSeat: 3, caught: true, revoted: true });
    s = applyAction(s, { type: 'advance' }, { c, now: T0 });
    expect(s.phase).toBe('reveal');
  });

  it('재지목도 동률 → 아무도 지목 안 됨 = 범인 도주', () => {
    const s = voteHost('7F3K4', { 1: 3, 2: 4, 3: 4, 4: 3 }, { 1: 3, 2: 4, 3: 4, 4: 3 });
    expect(s.host!.vote!.sub).toBe('final');
    const r = resultOf(c, s)!;
    expect(r.verdict).toMatchObject({ stage: 'decided', accusedSeat: null, caught: false, revoted: true });
    expect(r.mvpSeats).toEqual([3]); // 오늘의 주인공: 범인
    expect(r.rows.find((x) => x.isCulprit)!.breakdown.escape).toBe(5);
  });

  it('startRevote 는 동률 집계에서만', () => {
    const tie = voteHost('7F3K4', { 1: 3, 2: 4, 3: 4, 4: 3 });
    expect(applyAction(tie, { type: 'startRevote' }, { c, now: T0 }).host!.vote!.sub).toBe('revote');
    const solo = voteHost('7F3K4', { 1: 3, 2: 3, 3: 4, 4: 3 });
    expect(applyAction(solo, { type: 'startRevote' }, { c, now: T0 })).toBe(solo);
  });

  it('자리 비우기 — 그 자리 표·그 자리로 간 표 삭제, 투표자·후보·판정자에서 제외', () => {
    let s = voteHost('22225', { 1: 2, 2: 1, 3: 2, 4: 3, 5: 2 });
    expect(s.host!.vote!.sub).toBe('tally');
    s = applyAction(s, { type: 'setAbsent', seat: 3, absent: true }, { c, now: T0 });
    expect(s.host!.absentSeats).toEqual([3]);
    expect(s.host!.vote!.first).toEqual({ 1: 2, 2: 1, 5: 2 }); // 3의 표, 3으로 간 4의 표 삭제
    expect(s.host!.vote!.sub).toBe('input'); // 4번이 다시 입력해야 함
    expect(applyAction(s, { type: 'ballot', voter: 4, target: 3 }, { c, now: T0 })).toBe(s);
    s = applyAction(s, { type: 'ballot', voter: 4, target: 2 }, { c, now: T0 });
    const r = resultOf(c, s)!;
    expect(r.judges).toBe(3); // n − 1 − 이탈 1
    expect(r.rows[2]).toMatchObject({ seat: 3, absent: true, rank: null, score: 0 });
    expect(activeSeats(5, [3])).toEqual([1, 2, 4, 5]);
    expect(absentImpact(c, s, 2)).toBe('culprit');
    expect(absentImpact(c, s, 3)).toBe('innocent');
    expect(applyAction(s, { type: 'setAbsent', seat: 1, absent: true }, { c, now: T0 })).toBe(s); // 방장 자리 불가
  });

  it('변론 중 자리 비우기 — 순서에서 빠진다', () => {
    let s = applyAction(host(), { type: 'syncPhase', phase: 'defense' }, { c, now: T0 });
    s = run(s, adv(2)); // index 2 → 3번 차례
    expect(s.host!.defense).toEqual({ order: [1, 2, 3, 4, 5], index: 2 });
    s = applyAction(s, { type: 'setAbsent', seat: 3, absent: true }, { c, now: T0 });
    expect(s.host!.defense).toEqual({ order: [1, 2, 4, 5], index: 2 }); // 다음 사람(4번)
  });
});

describe('game — 점수', () => {
  /** 22225 검거판: 1→2, 2→1, 3→2, 4→2, 5→1 · 보너스 1번 q1 정답, 5번 q1 정답 */
  function caughtGame(): GameState {
    let s = voteHost('22225', { 1: 2, 2: 1, 3: 2, 4: 2, 5: 1 });
    s = run(s, [
      { type: 'bonusAnswer', seat: 1, questionId: 'q1', option: 1 },
      { type: 'bonusAnswer', seat: 1, questionId: 'q2', option: 0 },
      { type: 'bonusAnswer', seat: 5, questionId: 'q1', option: 1 },
      { type: 'mission', seat: 1, missionId: 'secret', value: true },
      { type: 'mission', seat: 2, missionId: 'secret', value: true }, // 범인 — 검거라 무효
      { type: 'mission', seat: 3, missionId: 'secret', value: false },
      { type: 'mission', seat: 5, missionId: 'secret', value: true },
    ]);
    return s;
  }

  it('범인 검거 × 미션 성공/실패 — 항목별 점수', () => {
    const r = resultOf(c, caughtGame())!;
    expect(r.caught).toBe(true);
    expect(r.hits).toBe(3);
    expect(r.judges).toBe(4);
    const by = Object.fromEntries(r.rows.map((x) => [x.seat, x]));
    // 1 queen: 적중 3 + 비밀 2 + 야망(역할2 2표↑) 1 + 보너스 q1 1 = 7
    expect(by[1]).toMatchObject({ score: 7, correct: true, vote: 2, rank: 1 });
    expect(by[1].breakdown).toEqual({ correctVote: 3, teamCatch: 0, bonus: 1, missions: 3, escape: 0 });
    // 2 consort(범인): 검거 → 탈출 전용 미션 무효, 0점
    expect(by[2]).toMatchObject({ score: 0, isCulprit: true, correct: null, rank: 5, votesReceived: 3 });
    expect(by[2].missions.every((m) => m.void && m.value === null)).toBe(true);
    // 3 eunuch: 적중 3 + 비밀 실패 0 + 0표 1 = 4
    expect(by[3]).toMatchObject({ score: 4, rank: 2 });
    expect(by[3].missions.find((m) => m.id === 'zero')).toMatchObject({ value: true, auto: true });
    // 4 courtLady: 적중 3 + 비밀 미판정 + 충심(역할1 최다 아님) 1 = 4
    expect(by[4]).toMatchObject({ score: 4, rank: 2 });
    expect(by[4].missions.find((m) => m.id === 'secret')!.value).toBeNull();
    // 5 physician: 오지목 0 + 비밀 2 + q1 미션 1 + 보너스 1 = 4
    expect(by[5]).toMatchObject({ score: 4, correct: false, rank: 2 });
    expect(r.ranking).toEqual([1, 3, 4, 5, 2]);
    expect(r.mvpSeats).toEqual([1]);
    expect(r.pendingMissions).toBe(1);
  });

  it('범인 도주 × 미션 성공 — 탈출 +5 + 탈출 전용 미션 인정', () => {
    let s = voteHost('22225', { 1: 3, 2: 3, 3: 1, 4: 3, 5: 2 });
    s = applyAction(s, { type: 'mission', seat: 2, missionId: 'secret', value: true }, { c, now: T0 });
    const r = resultOf(c, s)!;
    const culprit = r.rows[1];
    expect(r.caught).toBe(false);
    expect(culprit.breakdown).toEqual({ correctVote: 0, teamCatch: 0, bonus: 0, missions: 2, escape: 5 });
    expect(culprit.missions.find((m) => m.id === 'drag')).toMatchObject({ value: false, void: false }); // 역할4 0표
    expect(r.rows[2].missions.find((m) => m.id === 'zero')!.value).toBe(false); // 역할3 3표
    expect(r.hits).toBe(1);
    expect(r.mvpSeats).toEqual([2]);
    expect(r.ranking[0]).toBe(2);
  });

  it('teamCatch(스펙 기본 1) · 미션 기본 점수 — 사건 scoring 으로 덮인다', () => {
    const spec = { ...makeFixtureCase(), scoring: undefined };
    const s = caughtGame();
    const r = resultOf(spec, s)!;
    expect(r.rows[0].breakdown.teamCatch).toBe(1);
    expect(r.rows[0].score).toBe(8);
  });

  it('공동 순위 · 명탐정 동점이면 미션 성공 수로, 그래도 같으면 공동', () => {
    let s = voteHost('22225', { 1: 2, 2: 1, 3: 2, 4: 2, 5: 2 });
    // 1: 3+1(야망) = 4 · 3: 3+1(0표) = 4 · 4: 3+1(충심) = 4 · 5: 3 = 3
    let r = resultOf(c, s)!;
    expect(r.rows.map((x) => x.score)).toEqual([4, 0, 4, 4, 3]);
    expect(r.rows.map((x) => x.rank)).toEqual([1, 5, 1, 1, 4]);
    expect(r.mvpSeats).toEqual([1, 3, 4]);
    s = applyAction(s, { type: 'mission', seat: 3, missionId: 'secret', value: true }, { c, now: T0 });
    r = resultOf(c, s)!;
    expect(r.mvpSeats).toEqual([3]);
  });

  it('지목이 덜 끝났으면 표 기반 미션은 판정 보류(null)', () => {
    const s = voteHost('22225', { 1: 2 });
    const r = resultOf(c, s)!;
    expect(r.verdict.stage).toBe('pending');
    expect(r.rows[2].missions.find((m) => m.id === 'zero')!.value).toBeNull();
    expect(r.rows[1].breakdown.escape).toBe(0);
    expect(r.mvpSeats).toEqual([]);
  });

  it('보너스 답을 안 받았으면 bonusCorrect 미션은 방장 판정으로', () => {
    let s = voteHost('22225', { 1: 2, 2: 1, 3: 2, 4: 2, 5: 1 });
    expect(resultOf(c, s)!.rows[4].missions.find((m) => m.id === 'q1')!.value).toBeNull();
    s = applyAction(s, { type: 'mission', seat: 5, missionId: 'q1', value: true }, { c, now: T0 });
    expect(resultOf(c, s)!.rows[4].missions.find((m) => m.id === 'q1')).toMatchObject({ value: true, auto: false });
  });

  it('플레이어 상태에는 결과가 없다(방장 단일 진실원)', () => {
    expect(resultOf(c, player())).toBeNull();
  });
});

describe('game — 표시 규칙', () => {
  it('역할명 공개 시점(D16)', () => {
    expect(rolesVisible(c, 'intro')).toBe(false);
    expect(rolesVisible(c, 'r1')).toBe(true);
    const hidden = { ...makeFixtureCase(), rolesPublicAfterIntro: false };
    expect(rolesVisible(hidden, 'vote')).toBe(false);
    expect(rolesVisible(hidden, 'reveal')).toBe(true);
  });

  it('헤더 레일', () => {
    expect(['lobby', 'intro', 'r1', 'r3', 'defense', 'vote', 'result'].map((p) => railStep(p as never))).toEqual([
      'prep',
      'prep',
      1,
      3,
      'defense',
      'vote',
      'done',
    ]);
  });
});
