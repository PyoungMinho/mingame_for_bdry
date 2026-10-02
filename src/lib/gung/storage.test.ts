import { afterEach, describe, expect, it, vi } from 'vitest';
import { makeFixtureCase } from './fixtures';
import { applyAction, newHostGame, newPlayerGame, type GameAction, type GameState } from './game';
import { parseEntryParams } from './room';
import {
  DEFAULT_PREFS,
  GAME_TTL_MS,
  STORAGE_KEYS,
  clearGame,
  decideEntry,
  loadGame,
  loadPrefs,
  memoryStorage,
  openStorage,
  parsePrefs,
  sanitizeGame,
  saveGame,
  savePrefs,
  serializeGame,
  type StorageLike,
} from './storage';

const c = makeFixtureCase();
const T0 = 1_700_000_000_000;
const expected = { caseId: c.id, caseVersion: c.version };

function play(s: GameState, actions: GameAction[]): GameState {
  return actions.reduce((acc, a, i) => applyAction(acc, a, { c, now: T0 + i * 1000 }), s);
}

/** 방장: 롤콜·조사·지목·재지목·미션까지 진행된 풍부한 상태 */
function richHost(): GameState {
  let s = newHostGame(c, '7F3K4', T0)!;
  s = play(s, [
    { type: 'rollCall', seat: 2 },
    { type: 'advance' },
    { type: 'advance' },
    { type: 'advance' },
    { type: 'advance' }, // r1 select (타이머 running)
    { type: 'pickPlace', round: 1, placeId: 'clinic' },
    { type: 'openClue', round: 1 },
    { type: 'disclose', round: 1, value: 'public' },
    { type: 'openPublicClue', round: 1 },
    { type: 'timer', op: 'pause' },
    { type: 'syncPhase', phase: 'vote' },
    { type: 'advance' },
    { type: 'ballot', voter: 1, target: 3 },
    { type: 'ballot', voter: 2, target: 4 },
    { type: 'ballot', voter: 3, target: 4 },
    { type: 'ballot', voter: 4, target: 3 },
    { type: 'advance' }, // revote
    { type: 'ballot', voter: 1, target: 3 },
    { type: 'bonusAnswer', seat: 1, questionId: 'q1', option: 1 },
    { type: 'mission', seat: 2, missionId: 'secret', value: false },
  ]);
  return s;
}

function richPlayer(): GameState {
  let s = newPlayerGame(c, '7F3K5', 3, T0)!;
  s = play(s, [
    { type: 'syncPhase', phase: 'r2' },
    { type: 'pickPlace', round: 1, placeId: 'hall' },
    { type: 'openClue', round: 1 },
    { type: 'disclose', round: 1, value: 'private' },
    { type: 'pickPlace', round: 2, placeId: 'pond' },
    { type: 'syncPhase', phase: 'vote' },
    { type: 'castVote', target: 2 },
  ]);
  return s;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('storage — 저장·복원', () => {
  it('방장 상태 왕복(되돌리기 스택·지목·재지목·타이머·미션 포함)', () => {
    const st = memoryStorage();
    const s = richHost();
    expect(s.host!.vote!.sub).toBe('revote');
    expect(s.host!.history.length).toBeGreaterThan(5);
    expect(saveGame(st, s)).toBe(true);
    const r = loadGame(st, s.updatedAt + 1000, expected);
    expect(r).toEqual({ status: 'ok', state: s, versionMismatch: false });
    // 복원한 상태로 계속 진행 가능
    const next = applyAction(r.state!, { type: 'undo' }, { c, now: T0 });
    expect(next).not.toBe(r.state);
  });

  it('플레이어 상태 왕복', () => {
    const st = memoryStorage();
    const s = richPlayer();
    saveGame(st, s);
    expect(loadGame(st, s.updatedAt, expected).state).toEqual(s);
  });

  it('사건 본문·모르는 필드는 저장되지 않는다(화이트리스트)', () => {
    const s = richPlayer() as GameState & Record<string, unknown>;
    const dirty = {
      ...s,
      sheet: { secrets: ['역할3 비밀 ①'] },
      sealOpen: true,
      rounds: { ...s.rounds, 1: { ...s.rounds[1]!, body: '[픽스처] 사발이 있다.' } },
    };
    const json = serializeGame(dirty as GameState)!;
    expect(json).not.toContain('비밀');
    expect(json).not.toContain('사발');
    expect(json).not.toContain('sealOpen');
    expect(JSON.parse(json)).toEqual(JSON.parse(JSON.stringify(s)));
    expect(Object.keys(JSON.parse(json)).sort()).toEqual(['caseId', 'caseVersion', 'code', 'createdAt', 'myVote', 'phase', 'role', 'rounds', 'seat', 'updatedAt', 'v']);
  });

  it('깨진 저장은 폐기(키 삭제)', () => {
    const cases: unknown[] = [
      '{not json',
      JSON.stringify({ ...richPlayer(), v: 2 }),
      JSON.stringify({ ...richPlayer(), code: '7F3K9' }),
      JSON.stringify({ ...richPlayer(), code: '7f3k5' }), // 정규화 안 된 코드
      JSON.stringify({ ...richPlayer(), seat: 1 }), // 플레이어가 1번
      JSON.stringify({ ...richPlayer(), seat: 6 }),
      JSON.stringify({ ...richPlayer(), phase: 'party' }),
      JSON.stringify({ ...richPlayer(), rounds: { 4: richPlayer().rounds[1] } }),
      JSON.stringify({ ...richPlayer(), rounds: { 1: { placeId: 'hall', opened: 'yes' } } }),
      JSON.stringify({ ...richPlayer(), myVote: { seat: 3, at: 1 } }), // 자기 자신 지목
      JSON.stringify({ ...richHost(), host: undefined }),
      JSON.stringify({ ...richHost(), host: { ...richHost().host, timer: { kind: 'select', running: true, endsAt: null } } }),
      JSON.stringify({ ...richHost(), host: { ...richHost().host, vote: { sub: 'revote', first: {} } } }), // revote 인데 재지목 없음
      JSON.stringify({ ...richHost(), host: { ...richHost().host, vote: { sub: 'input', first: { 2: 9 } } } }),
      JSON.stringify({ ...richHost(), seat: 2 }),
      JSON.stringify([]),
      JSON.stringify(null),
    ];
    for (const raw of cases) {
      const st = memoryStorage();
      st.setItem(STORAGE_KEYS.game, raw as string);
      const r = loadGame(st, T0, expected);
      expect(r.status, String(raw).slice(0, 80)).toBe('invalid');
      expect(r.state).toBeNull();
      expect(st.getItem(STORAGE_KEYS.game)).toBeNull();
    }
  });

  it('되돌리기 스냅샷 하나가 깨지면 그것만 버리고 게임은 살린다', () => {
    const s = richHost();
    const raw = JSON.parse(JSON.stringify(s));
    raw.host.history[0] = { phase: 'nope', host: {} };
    raw.host.history[1].host.revealIndex = -1;
    const back = sanitizeGame(raw)!;
    expect(back).not.toBeNull();
    expect(back.host!.history).toHaveLength(s.host!.history.length - 2);
  });

  it('12시간 무활동 → 만료·삭제 / 경계값은 유지', () => {
    const st = memoryStorage();
    const s = richPlayer();
    saveGame(st, s);
    expect(loadGame(st, s.updatedAt + GAME_TTL_MS, expected).status).toBe('ok');
    const r = loadGame(st, s.updatedAt + GAME_TTL_MS + 1, expected);
    expect(r).toEqual({ status: 'expired', state: null, versionMismatch: false });
    expect(st.getItem(STORAGE_KEYS.game)).toBeNull();
  });

  it('다른 사건 저장은 폐기, 같은 사건 다른 버전은 복원 + 경고 플래그', () => {
    const st = memoryStorage();
    saveGame(st, richPlayer());
    expect(loadGame(st, T0, { caseId: 'other', caseVersion: 3 }).status).toBe('invalid');
    saveGame(st, richPlayer());
    const r = loadGame(st, T0, { caseId: c.id, caseVersion: 4 });
    expect(r.status).toBe('ok');
    expect(r.versionMismatch).toBe(true);
  });

  it('없으면 none, clearGame 으로 삭제', () => {
    const st = memoryStorage();
    expect(loadGame(st, T0)).toEqual({ status: 'none', state: null, versionMismatch: false });
    saveGame(st, richPlayer());
    clearGame(st);
    expect(st.getItem(STORAGE_KEYS.game)).toBeNull();
  });
});

describe('storage — 절대 throw 하지 않는다', () => {
  const broken: StorageLike = {
    getItem: () => {
      throw new Error('SecurityError');
    },
    setItem: () => {
      throw new Error('QuotaExceededError');
    },
    removeItem: () => {
      throw new Error('SecurityError');
    },
  };

  it('setItem·getItem·removeItem 이 던져도 게임 진행 가능', () => {
    expect(saveGame(broken, richPlayer())).toBe(false);
    expect(loadGame(broken, T0)).toEqual({ status: 'none', state: null, versionMismatch: false });
    expect(() => clearGame(broken)).not.toThrow();
    expect(savePrefs(broken, DEFAULT_PREFS)).toBe(false);
    expect(loadPrefs(broken)).toEqual(DEFAULT_PREFS);
  });

  it('openStorage — localStorage 없음(노드) / 막힘 → 메모리 폴백(persistent=false)', () => {
    vi.stubGlobal('localStorage', undefined);
    expect(openStorage().persistent).toBe(false);
    vi.stubGlobal('localStorage', broken);
    const o = openStorage();
    expect(o.persistent).toBe(false);
    expect(saveGame(o.storage, richPlayer())).toBe(true); // 메모리에는 저장됨
    vi.stubGlobal('localStorage', memoryStorage());
    expect(openStorage().persistent).toBe(true);
  });

  it('깨진 상태는 저장하지 않는다', () => {
    const st = memoryStorage();
    expect(saveGame(st, { ...richPlayer(), phase: 'nope' as never })).toBe(false);
    expect(st.getItem(STORAGE_KEYS.game)).toBeNull();
  });
});

describe('storage — 설정', () => {
  it('기본값 · 틀린 필드만 기본값으로 · 왕복', () => {
    expect(parsePrefs(null)).toEqual(DEFAULT_PREFS);
    expect(parsePrefs({ revealMode: 'tap', sound: 'yes', stageScale: 2, seenPeekTip: true })).toEqual({
      ...DEFAULT_PREFS,
      revealMode: 'tap',
      seenPeekTip: true,
    });
    const st = memoryStorage();
    expect(loadPrefs(st)).toEqual(DEFAULT_PREFS);
    savePrefs(st, { ...DEFAULT_PREFS, sound: false, stageScale: 1.2 });
    expect(loadPrefs(st)).toEqual({ ...DEFAULT_PREFS, sound: false, stageScale: 1.2 });
    st.setItem(STORAGE_KEYS.prefs, '{broken');
    expect(loadPrefs(st)).toEqual(DEFAULT_PREFS);
  });
});

describe('storage — 진입 판정(§6-3 #6)', () => {
  const saved = richPlayer(); // 7F3K5
  it('코드 없음 → 홈(이어하기 카드)', () => {
    expect(decideEntry(saved, parseEntryParams(''))).toEqual({ kind: 'home', resume: saved });
    expect(decideEntry(null, parseEntryParams(''))).toEqual({ kind: 'home', resume: null });
  });
  it('같은 코드 → 자동 복원(?as=host 여도 저장 우선)', () => {
    expect(decideEntry(saved, parseEntryParams('?code=7f3k-5'))).toEqual({ kind: 'resume', state: saved });
    expect(decideEntry(saved, parseEntryParams('?code=7F3K5&as=host')).kind).toBe('resume');
  });
  it('다른 코드 → O9 충돌', () => {
    const d = decideEntry(saved, parseEntryParams('?code=ABCD4&as=host'));
    expect(d).toMatchObject({ kind: 'conflict', saved, asHost: true });
    expect(d.kind === 'conflict' && d.room.code).toBe('ABCD4');
  });
  it('저장 없음 → 초대 랜딩 / 방장 복구', () => {
    expect(decideEntry(null, parseEntryParams('?code=ABCD4'))).toMatchObject({ kind: 'join', room: { code: 'ABCD4', n: 4 } });
    expect(decideEntry(null, parseEntryParams('?code=ABCD4&as=host'))).toMatchObject({ kind: 'hostRecover' });
  });
  it('형식 오류 코드 → badCode', () => {
    expect(decideEntry(saved, parseEntryParams('?code=0000'))).toEqual({ kind: 'badCode', resume: saved });
  });
});
