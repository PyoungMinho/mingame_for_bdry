/**
 * @QA실행자 — 가상 테이블 하네스(S 레벨, 설계서 §2-2 L2'·§8-2).
 *
 * 서버가 없는 게임이라 "기기 간 일치"는 같은 코드 → 같은 계산(결정론)으로만 성립한다. 그래서 실제 테이블을 흉내 낸다:
 *  - 방장 1 + 플레이어 n−1 = 기기 n대. 기기마다 **독립된** 사건 번들(JSON 복제본 — 캐시 공유 없음)·독립 시계(±10분 어긋남)·
 *    독립 메모리 저장소.
 *  - 모든 액션 직후 저장 → 다시 읽기(=새로고침)를 거쳐, 읽은 상태로 다음 액션을 이어 간다.
 *  - 플레이어는 코드를 손으로 친다(소문자·하이픈·공백 변형).
 *
 * 검사: 역할 합집합 = cast(각 1번) · 범인 1명 · 사건 표식 일치 · 같은 장소 = 같은 카드 · R3 기억 잠금 시점 ·
 *       NPC 카드 대상 · 플레이어 개인 지목 ↔ 방장 집계 적중 일치 · 저장 유실 후 재입장 동일 단서 · 같은 자리 두 폰.
 */
import { describe, expect, it } from 'vitest';
import { sejaCase } from './case-data';
import {
  applyAction,
  assignmentOf,
  getClue,
  getRoundBoard,
  getSheet,
  loadGame,
  makeRng,
  memoryStorage,
  newHostGame,
  newPlayerGame,
  parseRoomCode,
  publicSeat,
  reachedRound,
  resolveVerdict,
  activeSeats,
  resultOf,
  roundPlaces,
  saveGame,
  SEED_ALPHABET,
  type GameAction,
  type GameState,
  type GungCase,
  type PlayerCount,
  type RoundNo,
  type StorageLike,
} from './index';

const T0 = Date.UTC(2026, 9, 2, 12, 0, 0);

interface Device {
  name: string;
  c: GungCase;
  storage: StorageLike;
  clock: number;
  state: GameState;
}

const cloneCase = (): GungCase => JSON.parse(JSON.stringify(sejaCase));

function typedVariant(code: string, k: number): string {
  const v = [code, code.toLowerCase(), `${code.slice(0, 4)}-${code[4]}`, ` ${code.slice(0, 4).toLowerCase()} ${code[4]} `, `${code.slice(0, 4)}‐${code[4]}`];
  return v[k % v.length];
}

function boot(name: string, state: GameState | null, skewMs: number, c: GungCase): Device {
  if (!state) throw new Error(`${name}: 게임 생성 실패`);
  const d: Device = { name, c, storage: memoryStorage(), clock: T0 + skewMs, state };
  expect(saveGame(d.storage, state)).toBe(true);
  return d;
}

/** 액션 → 저장 → 새로고침(다시 읽기) → 읽은 상태로 교체. 저장 왕복이 상태를 바꾸면 실패 */
function act(d: Device, action: GameAction): void {
  d.clock += 900 + (d.clock % 7) * 100;
  const next = applyAction(d.state, action, { c: d.c, now: d.clock });
  expect(saveGame(d.storage, next), `${d.name} save`).toBe(true);
  const back = loadGame(d.storage, d.clock + 50, { caseId: d.c.id, caseVersion: d.c.version });
  expect(back.status, `${d.name} reload after ${action.type}`).toBe('ok');
  expect(back.state, `${d.name} round-trip after ${action.type}`).toEqual(next);
  d.state = back.state!;
}

const sheetOf = (d: Device) => getSheet(d.c, assignmentOf(d.c, d.state), d.state.seat, reachedRound(d.state.phase))!;
const MEMORY_LINES = sejaCase.roles.flatMap((r) => (r.memories ?? []).flatMap((m) => m.lines));

interface TableOptions {
  code: string;
  rng: () => number;
  /** 플레이어들이 게이트를 전혀 누르지 않는다(FLOW-20) */
  idlePlayers?: boolean;
}

/** 한 판 전체 — 방장 진행 + 플레이어 각자 진행. 판이 끝난 기기 목록을 돌려준다 */
function playTable({ code, rng, idlePlayers }: TableOptions): { host: Device; players: Device[] } {
  const room = parseRoomCode(code)!;
  const n = room.n;
  const host = boot('host', newHostGame(cloneCase(), code, T0), 0, cloneCase());
  host.c = cloneCase();
  const players: Device[] = [];
  for (let seat = 2; seat <= n; seat++) {
    const c = cloneCase();
    const typed = parseRoomCode(typedVariant(code, seat))!; // 손으로 친 코드
    expect(typed.code).toBe(code);
    // ROOM-07: 방장 화면 표식 == 플레이어 화면 표식
    expect(typed.tag).toBe(room.tag);
    const skew = Math.round((rng() * 2 - 1) * 10 * 60_000);
    players.push(boot(`p${seat}`, newPlayerGame(c, typed.code, seat, T0 + skew), skew, c));
  }
  const all = [host, ...players];

  // ASG-02: 기기별 '내 패'의 합집합 = cast 정확히 1번씩, 범인 1명, 방장 배정의 범인 자리와 일치
  const sheets = all.map(sheetOf);
  const cast = sejaCase.roles.filter((r) => r.priority <= n).map((r) => r.id);
  expect(sheets.map((s) => s.roleId).sort()).toEqual([...cast].sort());
  expect(sheets.filter((s) => s.isCulprit)).toHaveLength(1);
  const culpritSeat = sheets.find((s) => s.isCulprit)!.seat;
  for (const d of all) expect(assignmentOf(d.c, d.state).culpritSeat).toBe(culpritSeat);
  // NPC 증언 카드는 이 판 플레이어 역할의 것이 아니다
  for (const r of [1, 2, 3] as RoundNo[]) {
    const board = getRoundBoard(host.c, n, r);
    for (const card of board.npcCards) expect(cast).not.toContain(card.roleId);
  }

  // 대기실 — 롤콜
  for (let seat = 2; seat <= n; seat++) act(host, { type: 'rollCall', seat });

  const hostTo = (phase: GameState['phase']) => {
    for (let g = 0; host.state.phase !== phase && g < 10; g++) act(host, { type: 'advance' });
    expect(host.state.phase).toBe(phase);
  };
  const playersTo = (phase: GameState['phase']) => {
    if (idlePlayers) return;
    for (const p of players) {
      for (let g = 0; p.state.phase !== phase && g < 12; g++) act(p, { type: 'advance' });
      expect(p.state.phase, p.name).toBe(phase);
    }
  };

  hostTo('briefing');
  playersTo('briefing');
  hostTo('cards');
  playersTo('cards');
  hostTo('intro');
  playersTo('intro');

  const cardsByRound: Record<number, Map<string, string>> = {};
  for (const r of [1, 2, 3] as RoundNo[]) {
    const phase = (`r${r}`) as GameState['phase'];
    // 방장 'advance' 는 조사 단계 안에서 하위 단계(select→discuss)를 먼저 밟는다
    if (host.state.phase !== phase) hostTo(phase);
    playersTo(phase);
    // R3 잠금: 각 기기의 로컬 진행 단계 기준
    for (const d of idlePlayers ? [host] : all) {
      const sh = sheetOf(d);
      const unlocked = sh.memories.filter((m) => m.unlocked);
      if (r < 3) expect(unlocked, `${d.name} r${r}`).toHaveLength(0);
      else expect(unlocked.length, `${d.name} r3`).toBe(sh.memories.length);
      const text = JSON.stringify(sh);
      if (r < 3) for (const l of MEMORY_LINES) expect(text).not.toContain(l);
    }
    // 장소 선택 — 일부는 일부러 같은 장소
    const places = roundPlaces(host.c, r).map((p) => p.id);
    cardsByRound[r] = new Map();
    for (const d of idlePlayers ? [host] : all) {
      const placeId = rng() < 0.5 ? places[0] : places[Math.floor(rng() * places.length)];
      act(d, { type: 'pickPlace', round: r, placeId });
      act(d, { type: 'openClue', round: r });
      if (rng() < 0.5) act(d, { type: 'disclose', round: r, value: rng() < 0.5 ? 'public' : 'private' });
      const card = getClue(d.c, assignmentOf(d.c, d.state), r, placeId, d.state.seat)!;
      expect(card, `${d.name} r${r} ${placeId}`).not.toBeNull();
      // CLUE-03: 같은 라운드·같은 장소 = 모든 기기에서 같은 카드
      const prev = cardsByRound[r].get(placeId);
      if (prev) expect(card.id, `${d.name} r${r} ${placeId}`).toBe(prev);
      else cardsByRound[r].set(placeId, card.id);
    }
    act(host, { type: 'advance' }); // select → discuss
    act(host, { type: 'openPublicClue', round: r });
  }

  hostTo('defense');
  playersTo('defense');
  hostTo('vote');
  playersTo('vote');

  // P8 — 각 플레이어가 자기 폰에 지목 확정 → 방장이 그 표를 그대로 받아 적는다(방장 자신도)
  const active = activeSeats(n, host.state.host!.absentSeats);
  const myVotes: Record<number, number> = {};
  for (const d of all) {
    const opts = active.filter((s) => s !== d.state.seat);
    const target = rng() < 0.5 ? (culpritSeat !== d.state.seat ? culpritSeat : opts[0]) : opts[Math.floor(rng() * opts.length)];
    myVotes[d.state.seat] = target;
    if (d.state.role === 'player' && !idlePlayers) act(d, { type: 'castVote', target });
  }
  act(host, { type: 'advance' }); // ready → input
  for (const [voter, target] of Object.entries(myVotes)) act(host, { type: 'ballot', voter: Number(voter), target });
  expect(host.state.host!.vote!.sub).toBe('tally');
  if (resolveVerdict(host.state.host!.vote, active, culpritSeat).stage === 'needsRevote') {
    act(host, { type: 'advance' }); // → revote
    const cands = host.state.host!.vote!.revote!.candidates;
    for (const voter of active) {
      const opts = cands.filter((s) => s !== voter);
      if (opts.length) act(host, { type: 'ballot', voter, target: opts[Math.floor(rng() * opts.length)] });
    }
  }
  for (let g = 0; host.state.phase !== 'result' && g < 30; g++) act(host, { type: 'advance' });
  expect(host.state.phase).toBe('result');

  // 결과 — 방장 단일 진실원 ↔ 플레이어 개인 기록
  const result = resultOf(host.c, host.state)!;
  expect(result.decided).toBe(true);
  expect(result.culpritSeat).toBe(culpritSeat);
  if (!idlePlayers) {
    let hits = 0;
    for (const p of players) {
      // P9 적중 칩 계산(PlayerScreens.playerTruth 와 같은 식)을 플레이어 자기 번들로
      const a = assignmentOf(p.c, p.state);
      const mine = p.state.myVote?.seat;
      const hit = mine !== undefined && mine === a.culpritSeat;
      const row = result.rows[p.state.seat - 1];
      if (row.isCulprit) {
        expect(row.correct).toBeNull();
      } else {
        expect(row.correct, p.name).toBe(hit);
        if (hit) hits++;
      }
      // 진상 화면 범인 표기 = 방장과 같은 자리·이름
      expect(publicSeat(p.c, a, a.culpritSeat)).toEqual(publicSeat(host.c, assignmentOf(host.c, host.state), culpritSeat));
    }
    const hostRow = result.rows[0];
    if (!hostRow.isCulprit && hostRow.correct) hits++;
    expect(result.hits).toBe(hits);
    playersTo('result');
  }
  return { host, players };
}

function randomCode(rng: () => number, n: PlayerCount): string {
  return Array.from({ length: 4 }, () => SEED_ALPHABET[Math.floor(rng() * 31)]).join('') + n;
}

describe('가상 테이블 — 같은 코드, 독립된 n대', () => {
  it.each(['22224', '22225', '22226', '7F3K5', 'ZZZZ6', '7F3K4'])('ASG-02·ROOM-07·CLUE-03·LOCK: 고정 코드 %s 한 판 완주', (code) => {
    playTable({ code, rng: makeRng(code.charCodeAt(0) * 31 + code.charCodeAt(4)) });
  });

  it('ASG-02 무작위 코드 90판(4/5/6인 각 30) — 기기 간 역할·범인·카드·적중 일치', () => {
    const rng = makeRng(424242);
    for (const n of [4, 5, 6] as PlayerCount[]) {
      for (let i = 0; i < 30; i++) playTable({ code: randomCode(rng, n), rng });
    }
  });

  it('FLOW-20 플레이어가 아무것도 안 눌러도(대기실 그대로) 방장은 결과까지 가고, 플레이어는 단계 맞추기로 언제든 합류', () => {
    const { host, players } = playTable({ code: '7F3K6', rng: makeRng(9), idlePlayers: true });
    expect(host.state.phase).toBe('result');
    for (const p of players) {
      expect(p.state.phase).toBe('lobby');
      act(p, { type: 'syncPhase', phase: 'reveal' });
      expect(sheetOf(p).memories.every((m) => m.unlocked)).toBe(true);
    }
  });

  it('CLUE-09 저장이 날아간 플레이어: 같은 코드·같은 자리로 다시 들어와 같은 장소를 고르면 같은 단서', () => {
    const code = '7F3K5';
    const c = cloneCase();
    const p = boot('p3', newPlayerGame(c, code, 3, T0), 0, c);
    act(p, { type: 'syncPhase', phase: 'r2' });
    act(p, { type: 'pickPlace', round: 2, placeId: 'ny' });
    const before = getClue(p.c, assignmentOf(p.c, p.state), 2, 'ny', 3)!;
    // 저장 유실(카톡 인앱 캐시 삭제) → 새 기기처럼 재입장
    p.storage.removeItem('gu:game:v1');
    expect(loadGame(p.storage, p.clock, { caseId: c.id, caseVersion: c.version }).status).toBe('none');
    const c2 = cloneCase();
    const again = boot('p3b', newPlayerGame(c2, code.toLowerCase(), 3, T0 + 3600_000), 3600_000, c2);
    act(again, { type: 'syncPhase', phase: 'r2' });
    act(again, { type: 'pickPlace', round: 2, placeId: 'ny' });
    expect(getClue(again.c, assignmentOf(again.c, again.state), 2, 'ny', 3)).toEqual(before);
    expect(sheetOf(again)).toEqual(getSheet(c, assignmentOf(c, p.state), 3, 2));
  });

  it('JOIN-16 두 폰이 같은 자리(3번): 같은 역할·같은 단서를 받는다(앱은 감지 못 함 — 롤콜에서 방장이 잡아야 함)', () => {
    const code = '22226';
    const a = cloneCase();
    const b = cloneCase();
    const p1 = boot('a', newPlayerGame(a, code, 3, T0), 0, a);
    const p2 = boot('b', newPlayerGame(b, code, 3, T0 + 5000), 5000, b);
    expect(sheetOf(p1)).toEqual(sheetOf(p2));
    for (const d of [p1, p2]) act(d, { type: 'syncPhase', phase: 'r1' });
    for (const placeId of roundPlaces(a, 1).map((x) => x.id)) {
      expect(getClue(a, assignmentOf(a, p1.state), 1, placeId, 3)).toEqual(getClue(b, assignmentOf(b, p2.state), 1, placeId, 3));
    }
  });

  it('자리 바꾸기(JOIN-17): 3→4번이면 4번 기기의 패와 똑같아지고, 고른 장소·지목 기록은 지워진다', () => {
    const code = '7F3K5';
    const c3 = cloneCase();
    const c4 = cloneCase();
    const p3 = boot('p3', newPlayerGame(c3, code, 3, T0), 0, c3);
    const p4 = boot('p4', newPlayerGame(c4, code, 4, T0), 0, c4);
    act(p3, { type: 'syncPhase', phase: 'r1' });
    act(p3, { type: 'pickPlace', round: 1, placeId: 'dg' });
    act(p3, { type: 'syncPhase', phase: 'vote' });
    act(p3, { type: 'castVote', target: 2 });
    act(p3, { type: 'changeSeat', seat: 4 });
    expect(p3.state).toMatchObject({ seat: 4, phase: 'vote', rounds: {} });
    expect(p3.state.myVote).toBeUndefined();
    act(p4, { type: 'syncPhase', phase: 'vote' });
    expect(sheetOf(p3)).toEqual(sheetOf(p4));
  });
});
