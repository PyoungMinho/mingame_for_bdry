/**
 * QA 'PM 결정 필요' 항목 — 결정한 동작을 엔진 레벨에서 고정한다(docs/qa/gung-bug-report.md §5-2 '결정').
 *
 *  - BUG-28 / S3·S4: 패 확인 3분 카운트다운(원고 1-8 ②), 동률자 30초 추가 변론(원고 8-1)
 *  - BUG-04 / S1: 공용 카드는 라운드 시작 때 공개(원고 1-7 규칙 4·4-1) — 타임라인도 라운드 시작부터
 *  - BUG-27 / S5: 용어 「?」 시트 = 기본 용어 + 공용 카드 용어(인원·라운드만으로 결정, 역할 전용 용어 제외) · 시각표(원고 1-5)
 *  - BUG-05 우회: 진행 단계 맞추기로 조사 라운드에 들어서는 길은 한 단계여도 확인
 *  - BUG-02 우회: 범인 자리 비움은 결과에서만(culpritAbsent → 판결 없음)
 *  - SCR-04: 조상궁 「중전이 최다 득표자가 아님」 = 1차 지목 기준·동률 1위도 최다로 침 / 내관 「최종 투표에서 0표」 = 1차 지목 기준
 */
import { describe, expect, it } from 'vitest';
import { sejaCase as c } from './case-data';
import {
  applyAction,
  assignFromCode,
  castFor,
  DEFAULT_TIMERS,
  gateRoundsShown,
  getSheet,
  loadGame,
  memoryStorage,
  newHostGame,
  PLAYER_COUNTS,
  resultOf,
  roundEntered,
  saveGame,
  seatOfRole,
  SEED_ALPHABET,
  sharedTerms,
  timeTable,
  type GameAction,
  type GameState,
  type PlayerCount,
} from './index';

const T0 = Date.UTC(2026, 9, 2, 12, 0, 0);

function run(s: GameState, actions: GameAction[], start = T0, step = 1000): GameState {
  let now = start;
  for (const a of actions) {
    s = applyAction(s, a, { c, now });
    now += step;
  }
  return s;
}
function findCode(n: PlayerCount, pred: (code: string) => boolean): string {
  const A = SEED_ALPHABET;
  for (let i = 0; i < 30000; i++) {
    const code = `${A[i % 31]}${A[Math.floor(i / 31) % 31]}${A[(i * 7) % 31]}${A[(i * 11 + 5) % 31]}${n}`;
    if (pred(code)) return code;
  }
  throw new Error('no code');
}
const asg = (code: string) => assignFromCode(c, code)!;

describe('BUG-28 결정 — 패 확인 3분 · 동률 변론 30초', () => {
  it('기본값: 패 확인 3분, 동률 1인 30초(원고 1-8 ②·8-1)', () => {
    expect(DEFAULT_TIMERS.cardsMs).toBe(180_000);
    expect(DEFAULT_TIMERS.tieMs).toBe(30_000);
  });

  it('브리핑 → 패 확인에 들어서면 3분 카운트다운이 돌고, 자기소개로 넘어가면 멈춘다 · 단계 맞추기로 왔으면 restart 로 켠다', () => {
    let s = run(newHostGame(c, '7F3K5', T0)!, [{ type: 'advance' }]); // lobby → briefing
    expect(s.host!.timer).toBeNull();
    s = applyAction(s, { type: 'advance' }, { c, now: T0 + 10_000 });
    expect(s.phase).toBe('cards');
    expect(s.host!.timer).toMatchObject({ kind: 'cards', totalMs: 180_000, running: true, endsAt: T0 + 190_000 });
    s = applyAction(s, { type: 'advance' }, { c, now: T0 + 20_000 });
    expect(s.phase).toBe('intro');
    expect(s.host!.timer).toBeNull();
    // ↶ 하면 멈춘 채로 복원
    const back = applyAction(s, { type: 'undo' }, { c, now: T0 + 30_000 });
    expect(back.host!.timer).toMatchObject({ kind: 'cards', running: false });
    // 단계 맞추기로 패 확인에 오면 타이머 없음 → restart 로 3분
    let t = run(newHostGame(c, '7F3K5', T0)!, [{ type: 'syncPhase', phase: 'cards' }]);
    expect(t.host!.timer).toBeNull();
    t = applyAction(t, { type: 'timer', op: 'restart' }, { c, now: T0 + 5_000 });
    expect(t.host!.timer).toMatchObject({ kind: 'cards', totalMs: 180_000 });
  });

  it('동률 변론 타이머는 1차 집계가 동률일 때만 켜지고(30초, 다시 누르면 다음 사람 30초), 재지목에 들어서면 꺼진다', () => {
    const code = findCode(4, (k) => asg(k).culpritSeat === 3);
    let s = run(newHostGame(c, code, T0)!, [{ type: 'syncPhase', phase: 'vote' }, { type: 'advance' }]);
    // 지목 입력 중엔 안 켜진다
    expect(applyAction(s, { type: 'timer', op: 'restart' }, { c, now: T0 + 9_000 })).toBe(s);
    // 단독 1위(동률 아님) — 안 켜진다
    const single = run(s, [1, 2, 3, 4].map((v) => ({ type: 'ballot', voter: v, target: v === 3 ? 1 : 3 }) as GameAction));
    expect(single.host!.vote!.sub).toBe('tally');
    expect(applyAction(single, { type: 'timer', op: 'restart' }, { c, now: T0 + 20_000 })).toBe(single);
    // 1·2 동률
    s = run(s, [
      { type: 'ballot', voter: 1, target: 2 },
      { type: 'ballot', voter: 2, target: 1 },
      { type: 'ballot', voter: 3, target: 2 },
      { type: 'ballot', voter: 4, target: 1 },
    ]);
    expect(s.host!.vote!.sub).toBe('tally');
    s = applyAction(s, { type: 'timer', op: 'restart' }, { c, now: T0 + 30_000 });
    expect(s.host!.timer).toMatchObject({ kind: 'tie', totalMs: 30_000, running: true, endsAt: T0 + 60_000 });
    s = applyAction(s, { type: 'timer', op: 'restart' }, { c, now: T0 + 61_000 }); // 다음 사람
    expect(s.host!.timer).toMatchObject({ kind: 'tie', endsAt: T0 + 91_000 });
    const viaAdvance = applyAction(s, { type: 'advance' }, { c, now: T0 + 70_000 });
    expect(viaAdvance.host!.vote!.sub).toBe('revote');
    expect(viaAdvance.host!.timer).toBeNull();
    const viaStart = applyAction(s, { type: 'startRevote' }, { c, now: T0 + 70_000 });
    expect(viaStart.host!.vote!.sub).toBe('revote');
    expect(viaStart.host!.timer).toBeNull();
  });

  it('새 타이머 종류(cards·tie)도 저장 왕복된다', () => {
    const st = memoryStorage();
    for (const s of [
      run(newHostGame(c, '7F3K5', T0)!, [{ type: 'advance' }, { type: 'advance' }]),
      run(newHostGame(c, '7F3K4', T0)!, [
        { type: 'syncPhase', phase: 'vote' },
        { type: 'advance' },
        { type: 'ballot', voter: 1, target: 2 },
        { type: 'ballot', voter: 2, target: 1 },
        { type: 'ballot', voter: 3, target: 2 },
        { type: 'ballot', voter: 4, target: 1 },
        { type: 'timer', op: 'restart' },
      ]),
    ]) {
      expect(s.host!.timer).not.toBeNull();
      expect(saveGame(st, s)).toBe(true);
      expect(loadGame(st, T0 + 60_000).state!.host!.timer).toEqual(s.host!.timer);
    }
  });
});

describe('BUG-04 결정 — 공용 카드는 라운드 시작 때 공개', () => {
  it('출입 타임라인 라운드 = 들어선 라운드 전부(펼치기 동작 없이)', () => {
    let s = run(newHostGame(c, '7F3K6', T0)!, [{ type: 'syncPhase', phase: 'intro' }, { type: 'advance' }]);
    expect(s.phase).toBe('r1');
    expect(gateRoundsShown(s)).toEqual([1]);
    s = run(s, [{ type: 'advance' }, { type: 'advance' }]); // 토론 → 조사 2 장소 고르기
    expect(s.phase).toBe('r2');
    expect(s.host!.roundSub).toBe('select');
    expect(gateRoundsShown(s)).toEqual([1, 2]);
  });
});

describe('BUG-05 우회 — 조사 라운드 진입 판정', () => {
  it('roundEntered: 새로 들어서는 가장 늦은 라운드, 뒤로·제자리·라운드 밖은 null', () => {
    expect(roundEntered('intro', 'r1')).toBe(1);
    expect(roundEntered('r1', 'r2')).toBe(2);
    expect(roundEntered('r2', 'r3')).toBe(3);
    expect(roundEntered('r2', 'vote')).toBe(3);
    expect(roundEntered('lobby', 'r2')).toBe(2);
    expect(roundEntered('r3', 'defense')).toBeNull();
    expect(roundEntered('r3', 'r2')).toBeNull();
    expect(roundEntered('lobby', 'cards')).toBeNull();
  });
});

describe('BUG-27 결정 — 용어 「?」·시각표', () => {
  it('공용 용어 목록 = 기본 용어 + 들어선 라운드 공용 카드 용어 · 역할 전용 용어(활맥)는 어느 인원·라운드에도 없다', () => {
    const base = (c.baseTerms ?? []).length;
    expect(base).toBeGreaterThan(0);
    for (const n of PLAYER_COUNTS) {
      expect(sharedTerms(c, n, 0)).toHaveLength(base);
      for (const r of [0, 1, 2, 3]) {
        const names = sharedTerms(c, n, r).map((t) => t.term);
        expect(names.some((t) => t.includes('활맥'))).toBe(false);
      }
      const pb1 = (c.rounds[0].publicCards ?? []).flatMap((p) => p.terms ?? []);
      for (const id of pb1) expect(sharedTerms(c, n, 1).map((t) => t.id)).toContain(id);
    }
  });

  it('역할 전용 용어는 그 역할 패(봉인 속)에만 — 어의 패엔 있고 다른 역할 패엔 없다', () => {
    const code = findCode(6, () => true);
    const a = asg(code);
    for (const role of castFor(c, 6)) {
      const sheet = getSheet(c, a, seatOfRole(a, role)!, 0)!;
      if (role === 'physician') expect(sheet.terms.map((t) => t.term).join()).toContain('활맥');
      else expect(sheet.terms).toEqual([]);
    }
  });

  it('시각표(원고 1-5): 사건에 나오는 시진만, 저녁→새벽 순 · 출입 눈금 시진엔 초·정·말', () => {
    const rows = timeTable(c);
    expect(rows.map((r) => r.name)).toEqual(['유시', '술시', '해시', '자시', '축시']);
    expect(rows.find((r) => r.name === '유시')).toMatchObject({ span: '17~19시', parts: undefined });
    expect(rows.find((r) => r.name === '술시')).toMatchObject({ span: '19~21시', parts: '초≈19시 · 정≈20시 · 말≈20시 반 넘어' });
    expect(rows.find((r) => r.name === '자시')).toMatchObject({ span: '23~01시', parts: '초≈23시 · 정≈자정 · 말≈0시 반 넘어' });
  });
});

describe('SCR-04 결정 — 미션 판정 해석(1차 지목 기준)', () => {
  it('조상궁 「중전이 최다 득표자가 되지 않게」: 중전이 동률 1위여도 실패', () => {
    const code = findCode(6, () => true);
    const a = asg(code);
    const q = seatOfRole(a, 'queen')!;
    const e = seatOfRole(a, 'eunuch')!;
    const cl = seatOfRole(a, 'courtLady')!;
    const y = [1, 2, 3, 4, 5, 6].find((x) => x !== q && x !== e)!;
    const [o1, o2, o3] = [1, 2, 3, 4, 5, 6].filter((x) => x !== q && x !== e && x !== y);
    // 중전 3표(y·e·o1) = y 3표(q·o2·o3) 동률
    const ballots = { [y]: q, [e]: q, [o1]: q, [q]: y, [o2]: y, [o3]: y };
    let s = run(newHostGame(c, code, T0)!, [{ type: 'syncPhase', phase: 'vote' }, { type: 'advance' }]);
    s = run(s, Object.entries(ballots).map(([v, t]) => ({ type: 'ballot', voter: Number(v), target: t }) as GameAction));
    const r = resultOf(c, s)!;
    expect(r.verdict.first.top).toEqual([q, y].sort((m, n) => m - n));
    const m = r.rows[cl - 1].missions.find((x) => x.auto && x.text.includes('중전'))!;
    expect(m.value).toBe(false);
  });

  it('내관 「최종 투표에서 0표」 = 1차 지목 기준: 1차에 표를 받았으면 재지목에서 0표여도 실패', () => {
    const code = findCode(6, () => true);
    const a = asg(code);
    const q = seatOfRole(a, 'queen')!;
    const e = seatOfRole(a, 'eunuch')!;
    const y = [1, 2, 3, 4, 5, 6].find((x) => x !== q && x !== e)!;
    const [o1, o2, o3] = [1, 2, 3, 4, 5, 6].filter((x) => x !== q && x !== e && x !== y);
    // 1차 2·2·2 동률(내관 2표) → 재지목에서 내관 0표
    const first = { [o1]: e, [o2]: e, [e]: q, [y]: q, [q]: y, [o3]: y };
    let s = run(newHostGame(c, code, T0)!, [{ type: 'syncPhase', phase: 'vote' }, { type: 'advance' }]);
    s = run(s, Object.entries(first).map(([v, t]) => ({ type: 'ballot', voter: Number(v), target: t }) as GameAction));
    expect(resultOf(c, s)!.verdict.stage).toBe('needsRevote');
    s = run(s, [{ type: 'startRevote' }]);
    const revote = { [e]: q, [q]: y, [y]: q, [o1]: q, [o2]: q, [o3]: q };
    s = run(s, Object.entries(revote).map(([v, t]) => ({ type: 'ballot', voter: Number(v), target: t }) as GameAction));
    const r = resultOf(c, s)!;
    expect(r.verdict.stage).toBe('decided');
    expect(r.verdict.revote!.counts[e] ?? 0).toBe(0);
    const m = r.rows[e - 1].missions.find((x) => x.auto && x.text.includes('0표'))!;
    expect(m.value).toBe(false);
  });
});
