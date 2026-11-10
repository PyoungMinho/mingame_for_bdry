import { describe, expect, it } from 'vitest';
import { createPracticeController } from './practiceController';
import { COACH, MY_SHIPS, PARTNER_SHIPS, PracticeSession } from './practiceSession';
import { createStaticController } from './staticController';
import { mockEndedView, mockPlayingView } from './mockViews';
import { placementCells, type CellAddr } from '../coords';
import { ALARM_HIDE_MS, QUIZ_LOCK_MS, QUIZ_MS } from '../constants';
import type { PlayingView } from '../protocol';

function setup() {
  let t = 1_000_000;
  const session = new PracticeSession({ industry: 0, now: () => t, partnerName: '박대리' });
  const handle = createPracticeController(session);
  const advance = (ms: number) => {
    t += ms;
    // 250ms 간격 tick을 흉내
    for (let i = 0; i < Math.ceil(ms / 250); i++) session.tick();
  };
  const playing = () => session.getView() as PlayingView;
  return { session, handle, advance, playing, time: () => t };
}

const cellsOf = (slot: 'L4' | 'L3' | 'L2') => placementCells(PARTNER_SHIPS.find((s) => s.slot === slot)!)!;

describe('박대리 연습 한 판 흐름 (서버 없이)', () => {
  it('시작: 박대리의 L2가 이미 종결, 코치 컷1', () => {
    const { session, playing, handle } = setup();
    const v = playing();
    expect(v.status).toBe('playing');
    expect(v.game.sunkByMe.map((s) => s.slot)).toEqual(['L2']);
    expect(v.opp.nickname).toBe('박대리');
    expect(session.getPractice()).toEqual({ cut: 1, totalCuts: 8, coachLine: COACH.firstFire, done: false });
    const c = handle.get();
    expect(c.kind).toBe('practice');
    expect(c.code).toBeNull();
    expect(c.state.connection).toBe('local');
  });

  it('메서드 참조는 렌더 사이에 안정적이다 (컨트롤러 규칙 1)', () => {
    const { handle, session } = setup();
    const a = handle.get();
    session.fire('A1');
    const b = handle.get();
    expect(b).not.toBe(a);
    expect(b.fire).toBe(a.fire);
    expect(b.reportView).toBe(a.reportView);
    expect(b.now).toBe(a.now);
  });

  it('컷 1~8을 끝까지: 발사 → 메모 → 의견 → 검산(오답 잠금 체험) → 힌트 → Tab 숨기기 → 경보 → 종결', async () => {
    const { session, advance, playing, handle } = setup();
    const c = () => handle.get();

    // 컷1: 첫 발(빗나감) → 컷2
    expect((await c().fire('A1')).ok).toBe(true);
    expect(session.getPractice().cut).toBe(2);
    expect(session.getPractice().coachLine).toBe(COACH.memo);
    expect(playing().game.myShots.at(-1)).toMatchObject({ cell: 'A1', result: 'miss' });
    expect(playing().game.oppShots).toHaveLength(1); // 박대리가 응수
    expect(playing().game.round).toBe(2);

    // 이미 검토한 칸: 턴 소모 없음
    const dup = await c().fire('A1');
    expect(dup).toEqual({ ok: false, error: 'INVALID', reason: 'already_fired' });
    expect(playing().game.round).toBe(2);

    // 컷2 → 컷3 (4.5초 뒤)
    advance(4600);
    expect(session.getPractice().cut).toBe(3);
    expect(session.getPractice().coachLine).toBe(COACH.taunt);

    // 컷3: 의견 남기기 → 박대리 응수 + 검산 시작(컷4)
    expect((await c().taunt(0)).ok).toBe(true);
    expect(handle.get().partnerTaunt).toEqual({ seq: 1, index: 0 });
    expect(session.getPractice().cut).toBe(4);
    const quiz = playing().game.quiz!;
    expect(quiz.kind).toBe('sum');
    expect(playing().game.phase).toBe('quiz');
    expect((await c().fire('B1')).ok).toBe(false); // 검산 중 발사 불가
    // 쿨다운
    expect(await c().taunt(1)).toEqual({ ok: false, error: 'INVALID', reason: 'taunt_cooldown' });

    // 오답 → #VALUE! 잠금 3초, 그동안 입력은 LOCKED
    const wrong = await c().answer(quiz.id, 1);
    expect(wrong.ok).toBe(true);
    expect(playing().me.quizLockUntil).not.toBeNull();
    expect(await c().answer(quiz.id, quiz.values.reduce((a, b) => a + b, 0))).toEqual({ ok: false, error: 'LOCKED' });
    advance(QUIZ_LOCK_MS + 100);
    expect(playing().me.quizLockUntil).toBeNull();

    // 정답 → 힌트 1개, 컷5
    const fresh = playing().game.quiz!;
    expect((await c().answer(fresh.id, fresh.values.reduce((a, b) => a + b, 0))).ok).toBe(true);
    expect(playing().game.quiz).toBeNull();
    expect(playing().me.hintsAvailable).toBe(1);
    expect(session.getPractice().cut).toBe(5);

    // 컷5: 힌트 (열 E → 박대리 L4 B2:E2 중 E2 한 칸)
    const h = await c().hint({ kind: 'col', col: 'E' });
    expect(h.ok).toBe(true);
    expect(playing().me.hints[0]).toMatchObject({ target: { kind: 'col', col: 'E' }, value: 2 }); // E2(L4) + E7(L2)
    expect(playing().me.hintsAvailable).toBe(0);
    expect(await c().hint({ kind: 'row', row: 1 })).toEqual({ ok: false, error: 'INVALID', reason: 'no_hint' });
    expect(session.getPractice().cut).toBe(6);
    expect(session.getPractice().coachLine).toBe(COACH.tab);

    // 컷6: Tab 숨기기 → 게임 탭 클릭 복귀 → 컷7
    c().reportView('disguise');
    expect(session.getPractice().cut).toBe(6);
    c().reportView('game');
    expect(session.getPractice().cut).toBe(7);
    expect(session.getPractice().coachLine).toBe(COACH.autoHide);

    // 컷7: 4초 뒤 경보 출제, 3초 안에 Tab → 통과(벌칙 없음)
    advance(4100);
    const alarm = playing().game.alarm;
    expect(alarm).not.toBeNull();
    expect(session.getPractice().coachLine).toBe(COACH.alarm);
    advance(1000);
    c().reportAlarm(alarm!.issuedAt, 1000);
    advance(300);
    expect(playing().game.alarm).toBeNull();
    expect(session.getPractice().cut).toBe(8);
    expect(session.getPractice().coachLine).toBe(COACH.alarmDone);
    const lastAlarm = playing().events.filter((e) => e.type === 'alarmResult').at(-1);
    expect(lastAlarm).toMatchObject({ type: 'alarmResult', outcomes: ['pass', 'pass'] });
    advance(5200);
    expect(session.getPractice().coachLine).toBe(COACH.finish);

    // 컷8: L3를 찾아 종결 → 끝
    for (const cell of cellsOf('L3')) {
      const r = await c().fire(cell);
      expect(r.ok).toBe(true);
    }
    const end = session.getView();
    expect(end.status).toBe('ended');
    if (end.status === 'ended') {
      expect(end.result).toMatchObject({ winner: 0, reason: 'sunk2' });
      expect(end.reveal).toEqual(PARTNER_SHIPS);
      expect(end.game.sunkByMe.map((s) => s.slot)).toEqual(['L2', 'L3']);
    }
    expect(session.getPractice()).toMatchObject({ done: true, coachLine: null });
    expect(session.isDone).toBe(true);
    // 끝난 뒤 발사 불가
    expect(await c().fire('H2')).toEqual({ ok: false, error: 'WRONG_PHASE' });
  });

  it('박대리는 이길 수 없다: 내 배를 한 번만 맞히고 30회차 상한까지 졌어도 내 배는 침몰하지 않는다', async () => {
    const { session, handle } = setup();
    const mine = new Set(MY_SHIPS.flatMap((s) => placementCells(s)!));
    const targets: CellAddr[] = ['A1', 'A2', 'A3', 'A4', 'A6', 'A7', 'A8', 'B1', 'B3', 'B4', 'B5', 'B6', 'B8', 'C1', 'C2', 'C3', 'C4', 'C5', 'C6', 'C7', 'C8', 'D1', 'D2', 'D3', 'D4', 'D5', 'D6', 'D8'];
    // 박대리의 ship 칸이 아닌 곳만 쏴서 판을 오래 끈다 (L3·L4를 안 건드림)
    const partner = new Set(PARTNER_SHIPS.flatMap((s) => placementCells(s)!));
    for (const t of targets) {
      if (partner.has(t)) continue;
      if (session.isDone) break;
      await handle.get().fire(t);
    }
    const v = session.getView();
    const sunkByOpp = v.status === 'playing' || v.status === 'ended' ? v.game.sunkByOpp : [];
    expect(sunkByOpp).toHaveLength(0);
    const shots = v.status === 'playing' || v.status === 'ended' ? v.game.oppShots : [];
    expect(shots.filter((s) => s.result === 'hit').length).toBeLessThanOrEqual(1);
    for (const s of shots) if (s.result === 'hit') expect(mine.has(s.cell)).toBe(true);
  });

  it('검산 10초 만료 → 새 문제(연습은 맞힐 때까지)', async () => {
    const { session, advance, handle, playing } = setup();
    await handle.get().fire('A1');
    advance(4600);
    await handle.get().taunt(2);
    const first = playing().game.quiz!.id;
    advance(QUIZ_MS + 300);
    expect(playing().game.quiz).not.toBeNull();
    expect(playing().game.quiz!.id).not.toBe(first);
    expect(session.getPractice().cut).toBe(4);
  });

  it('이미 숨어 있을 때 경보가 나오면 0ms 통과', async () => {
    const { session, advance, handle, playing } = setup();
    await handle.get().fire('A1');
    advance(4600);
    await handle.get().taunt(0);
    const q = playing().game.quiz!;
    await handle.get().answer(q.id, q.values.reduce((a, b) => a + b, 0));
    await handle.get().hint({ kind: 'row', row: 4 });
    handle.get().reportView('disguise');
    handle.get().reportView('game');
    handle.get().reportView('disguise'); // 경보 전에 다시 숨음
    advance(4500);
    expect(playing().game.alarm).toBeNull();
    const last = playing().events.filter((e) => e.type === 'alarmResult').at(-1);
    expect(last).toMatchObject({ outcomes: ['pass', 'pass'] });
    expect(session.getPractice().cut).toBe(8);
  });

  it('경보를 3초 넘겨 보고하면 실패여도 벌칙 없이 진행', async () => {
    const { session, advance, handle, playing } = setup();
    await handle.get().fire('A1');
    advance(4600);
    await handle.get().taunt(0);
    const q = playing().game.quiz!;
    await handle.get().answer(q.id, q.values.reduce((a, b) => a + b, 0));
    await handle.get().hint({ kind: 'col', col: 'A' });
    handle.get().reportView('disguise');
    handle.get().reportView('game');
    advance(4100);
    const a = playing().game.alarm!;
    handle.get().reportAlarm(a.issuedAt, ALARM_HIDE_MS + 500);
    const last = playing().events.filter((e) => e.type === 'alarmResult').at(-1);
    expect(last).toMatchObject({ outcomes: ['fail', 'pass'] });
    expect(playing().me.skipNextFire).toBe(false);
  });
});

describe('mock(정지) 컨트롤러', () => {
  it('고정 view를 돌려주고 동작은 아무것도 바꾸지 않는다', async () => {
    const view = mockPlayingView(1);
    const c = createStaticController(view);
    expect(c.state.view).toBe(view);
    expect(c.state.entry).toEqual({ kind: 'seated', seat: 0 });
    expect(await c.fire('B7')).toEqual({ ok: true, view });
    expect(c.state.view).toBe(view);
  });

  it('셀 상태 8종 재료가 모두 있다 (빈칸·내 항목·내 항목 반려·해당 없음·반려·종결 + 종료 후 공개)', () => {
    const p = mockPlayingView(0);
    const kinds = new Set<string>();
    for (const s of p.game.myShots) kinds.add(`opp:${s.result}`);
    for (const s of p.game.oppShots) kinds.add(`mine:${s.result}`);
    expect(kinds).toEqual(new Set(['opp:miss', 'opp:hit', 'opp:sunk', 'mine:miss', 'mine:hit']));
    expect(p.me.ships).toHaveLength(3); // 내 항목
    expect(64 - p.game.myShots.length).toBeGreaterThan(0); // 빈칸
    const e = mockEndedView(2);
    expect(e.reveal).toHaveLength(3); // 종료 후 공개
    expect(e.me.industry).toBe(2);
  });

  it('mock view는 대전 중에 reveal·상대 배 키를 갖지 않는다', () => {
    const json = JSON.stringify(mockPlayingView(0));
    expect(json.includes('reveal')).toBe(false);
    expect(json.includes('"ships"')).toBe(true); // me.ships뿐
    const opp = (mockPlayingView(0) as PlayingView).opp as unknown as Record<string, unknown>;
    expect('ships' in opp).toBe(false);
  });
});
