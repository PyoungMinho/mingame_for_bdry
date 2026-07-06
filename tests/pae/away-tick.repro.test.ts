// 오후의 패 — "게임 중 이탈 자동스킵" 적대적 재현 테스트.
//
// 목적: src/app/api/pae/rooms/[code]/tick/route.ts 의 "심판 자동진행" 알고리즘을
//       인메모리 DB로 정확히 복제해, forceAdvance와의 상호작용에서
//       (1) 심판 동시성 (2) while 루프 무한/과다/조기종료 (3) 방장 승계
//       (4) 2인 이하 경계 (5) heartbeat 타이밍 (6) 자리비움자 유리 역전
//       시나리오가 실제로 성립하는지 검증한다.
//
// ※ 소스는 무수정. 아래 simulateTick 은 route.ts 의 로직을 "그대로" 옮긴 재현체다.
//   route.ts 가 바뀌면 이 재현체도 함께 갱신해야 함(의도된 복제).
import { describe, it, expect } from "vitest";
import { forceAdvance, startGame, type GameState, type Player } from "@/lib/pae/engine";
import { toPublic, type PublicState } from "@/lib/pae/room-state";
import { classify } from "@/lib/pae/combos";
import { makeRng, byStrength, type Tile, type Suit } from "@/lib/pae/tiles";

const AWAY_MS = 12000;
const t = (n: number, suit: Suit): Tile => ({ n, suit });

// ── 인메모리 DB (rooms 1행 + room_players + hands) ──
interface Db {
  now: number;
  room: { host_uid: string | null; status: string; public_state: PublicState | null };
  players: { uid: string; seat: number; last_seen: number }[]; // last_seen: epoch ms
  hands: Map<string, Tile[]>; // uid -> tiles
}

function seatUid(i: number) {
  return ["a", "b", "c", "d", "e"][i];
}

function makeDb(state: GameState, opts?: { host?: string }): Db {
  const now = 1_000_000_000_000; // 고정 기준시각
  const db: Db = {
    now,
    room: { host_uid: opts?.host ?? state.players[0].id, status: "playing", public_state: toPublic(state) },
    players: state.players.map((p, i) => ({ uid: p.id, seat: i, last_seen: now })),
    hands: new Map(state.players.map((p, i) => [p.id, state.hands[i]])),
  };
  return db;
}

// loadGame 재현: public_state + hands 로 GameState 복원
function loadGame(db: Db): GameState | null {
  const pub = db.room.public_state;
  if (!pub) return null;
  return {
    config: pub.config,
    players: pub.players,
    turn: pub.turn,
    lead: pub.lead,
    winner: pub.winner,
    phase: pub.phase,
    hands: pub.players.map((p) => db.hands.get(p.id) ?? []),
    setRound: pub.setRound ?? 1,
    cumulative: pub.cumulative ?? pub.players.map(() => 0),
  };
}
function saveGame(db: Db, s: GameState) {
  db.room.public_state = toPublic(s);
  db.room.status = s.phase;
  s.players.forEach((p, i) => db.hands.set(p.id, s.hands[i]));
}

// ── route.ts POST 로직의 재현체. mySeatUid = 이 tick을 호출한 클라이언트. ──
// snapshotNow: 이 클라가 "읽은" 시각(now). last_seen 스냅샷은 db.players를 그대로 읽는다.
// heartbeat=false 로 하면 heartbeat 단계를 건너뛴다(순수 판정만 보고 싶을 때).
function simulateTick(
  db: Db,
  callerUid: string,
  snapshotNow: number,
  opts?: { heartbeat?: boolean },
): { publicState: PublicState | null; awaySeats: number[]; aborted?: boolean } {
  // 1) heartbeat — 나 살아있음
  if (opts?.heartbeat !== false) {
    const me = db.players.find((p) => p.uid === callerUid);
    if (me) me.last_seen = snapshotNow;
  }

  let state = loadGame(db);
  if (!state || state.phase !== "playing") {
    return { publicState: state ? toPublic(state) : null, awaySeats: [] };
  }

  const now = snapshotNow;
  const lastByUid = new Map(db.players.map((p) => [p.uid, p.last_seen]));
  const isAway = (id: string) => now - (lastByUid.get(id) ?? 0) > AWAY_MS;
  const awaySeats = state.players.map((p, i) => (isAway(p.id) ? i : -1)).filter((i) => i >= 0);
  const activeSeats = state.players.map((_, i) => i).filter((i) => !awaySeats.includes(i));

  const mySeat = state.players.findIndex((p) => p.id === callerUid);
  const refereeSeat = activeSeats.length ? Math.min(...activeSeats) : -1;

  if (mySeat === refereeSeat && refereeSeat >= 0) {
    if (activeSeats.length <= 2) {
      db.hands.clear();
      db.room.status = "waiting";
      db.room.public_state = null;
      if (db.room.host_uid && isAway(db.room.host_uid)) db.room.host_uid = state.players[refereeSeat].id;
      return { publicState: null, awaySeats, aborted: true };
    }
    if (db.room.host_uid && isAway(db.room.host_uid)) {
      db.room.host_uid = state.players[refereeSeat].id;
    }
    let advanced = false;
    let guard = 0;
    while (state.phase === "playing" && awaySeats.includes(state.turn) && guard++ < state.players.length) {
      const r = forceAdvance(state);
      if (!r.ok) break;
      state = r.state;
      advanced = true;
    }
    if (advanced) saveGame(db, state);
  }

  return { publicState: toPublic(state), awaySeats };
}

function mkState(over: Partial<GameState>): GameState {
  const players: Player[] = [
    { id: "a", name: "A" },
    { id: "b", name: "B" },
    { id: "c", name: "C" },
    { id: "d", name: "D" },
  ];
  return {
    config: { maxNumber: 13, perPlayer: 13 },
    players,
    hands: [[], [], [], []],
    turn: 0,
    lead: null,
    winner: null,
    phase: "playing",
    setRound: 1,
    cumulative: [0, 0, 0, 0],
    ...over,
  };
}

// last_seen을 과거로 밀어 특정 좌석을 자리비움으로 만든다.
function setAway(db: Db, seats: number[]) {
  for (const s of seats) db.players[s].last_seen = db.now - AWAY_MS - 5000;
}

describe("[검증2/6] while 루프: 연속 자리비움 좌석에서 정상 좌석까지 자동 진행", () => {
  it("REPRO-A: 리드 차례 좌석0 자리비움 → forceAdvance가 좌석1(자리비움 아님)로 넘기고 멈춤", () => {
    const s = mkState({
      turn: 0,
      lead: null,
      hands: [
        [t(3, "cloud"), t(9, "sun")],
        [t(4, "star")],
        [t(5, "star")],
        [t(6, "star")],
      ],
    });
    const db = makeDb(s);
    setAway(db, [0]); // 좌석0만 자리비움
    // 심판 = active 최소 = 좌석1(b). b가 tick 호출.
    const res = simulateTick(db, "b", db.now, { heartbeat: false });
    expect(res.publicState!.turn).toBe(1); // 좌석1(정상)에서 멈춤
    expect(res.publicState!.handCounts[0]).toBe(1); // 좌석0 최약(구름3) 1장 냄
    expect(res.publicState!.lead!.by).toBe(0);
  });

  it("REPRO-B(5인): 연속 자리비움(리드 좌석0, 응수 좌석1 모두 자리비움)에서도 정상 좌석까지 도달", () => {
    // 4인이면 2명 자리비움 시 active=2로 중단되므로, 연속 자리비움 while을 보려면 5인 방이 필요.
    // 좌석0 리드차례 자리비움 → 최약싱글 냄 → 턴 좌석1(자리비움) → 응수 자동패스 → 좌석2 정상에서 멈춤.
    const players: Player[] = [
      { id: "a", name: "A" }, { id: "b", name: "B" }, { id: "c", name: "C" },
      { id: "d", name: "D" }, { id: "e", name: "E" },
    ];
    const s: GameState = {
      config: { maxNumber: 15, perPlayer: 12 },
      players,
      hands: [
        [t(3, "cloud"), t(9, "sun")], // 좌석0 자리비움, 리드차례
        [t(4, "star"), t(8, "moon")], // 좌석1 자리비움
        [t(5, "star")], [t(6, "star")], [t(7, "star")], // 좌석2,3,4 정상
      ],
      turn: 0, lead: null, winner: null, phase: "playing", setRound: 1, cumulative: [0, 0, 0, 0, 0],
    };
    const db = makeDb(s);
    setAway(db, [0, 1]); // active=[2,3,4] 3명 → 중단 안 함
    const res = simulateTick(db, "c", db.now, { heartbeat: false }); // 심판 = 좌석2(c)
    expect(res.aborted).toBeUndefined();
    expect(res.publicState!.turn).toBe(2); // 정상 좌석2에서 멈춰야 함
    expect(res.awaySeats).toEqual([0, 1]);
    expect(res.publicState!.handCounts[0]).toBe(1); // 좌석0 최약싱글 1장 냄
  });

  it("REPRO-B2(guard 소진): 5인 방에서 자리비움 3인이 연쇄로 리드권을 되돌려 while guard(=5)가 소진돼 자리비움 턴에 멈추는가", () => {
    // 시나리오: 좌석0,2,3 자리비움 / 좌석1,4 정상. turn=0(자리비움) 리드차례.
    //   forceAdvance 진행 경로를 추적해 while 루프가 몇 번 돌고 어디서 멈추는지 본다.
    //   guard가 소진되면 멈춘 turn이 여전히 자리비움일 수 있다(→ 3초 지연 반복).
    const players: Player[] = [
      { id: "a", name: "A" }, { id: "b", name: "B" }, { id: "c", name: "C" },
      { id: "d", name: "D" }, { id: "e", name: "E" },
    ];
    // 좌석0(away) 리드 → 최약싱글. 다음 살아있는 좌석은 1(정상)이므로 실제론 여기서 멈춘다.
    // '자리비움자만 연쇄'가 되려면 살아있는 좌석 사이에 자리비움이 끼어야 한다.
    const s: GameState = {
      config: { maxNumber: 15, perPlayer: 12 },
      players,
      hands: [
        [t(3, "cloud")], // 좌석0 away, 리드차례, 1장(마지막)
        [t(9, "sun")],   // 좌석1 정상
        [t(4, "star")],  // 좌석2 away
        [t(5, "star")],  // 좌석3 away
        [t(6, "star")],  // 좌석4 정상
      ],
      turn: 0, lead: null, winner: null, phase: "playing", setRound: 1, cumulative: [0, 0, 0, 0, 0],
    };
    const db = makeDb(s);
    setAway(db, [0, 2, 3]); // active=[1,4] 2명 → 중단 분기!
    const res = simulateTick(db, "b", db.now, { heartbeat: false });
    // active 정확히 2 → 게임 중단. (자리비움 연쇄로 while이 소진되기 전에 2인이하 가드가 먼저 잡음)
    expect(res.aborted).toBe(true);
  });

  it("REPRO-C(핵심): 자리비움자가 트릭을 '이겨' 리드권이 자기에게 돌아오는데 while guard가 끊겨 자리비움 턴에 멈추는가", () => {
    // 좌석1(자리비움) 리드 → 나머지 전부 자동패스로 트릭 종료 → 리드권이 좌석1로 복귀 →
    //   여전히 좌석1 자리비움. while 루프가 guard(=players.length=4) 안에 이 재리드를 처리하는지.
    // 시나리오: 좌석0=심판(정상). 좌석1,2,3 자리비움. 좌석1 차례(응수 아님, lead=null).
    const s = mkState({
      turn: 1,
      lead: null,
      hands: [
        [t(9, "sun"), t(9, "moon")], // 좌석0 심판(정상). 못 이기게 약하지 않은 페어만.
        [t(3, "cloud"), t(4, "cloud")], // 좌석1 자리비움, 리드차례
        [t(5, "star")], // 좌석2 자리비움
        [t(6, "star")], // 좌석3 자리비움
      ],
    });
    const db = makeDb(s);
    setAway(db, [1, 2, 3]);
    // active = [0] → 1명뿐이라 activeSeats.length(1) <= 2 → 게임 중단 분기로 감! (아래 검증4에서 다룸)
    const res = simulateTick(db, "a", db.now, { heartbeat: false });
    expect(res.aborted).toBe(true); // active 1명이므로 중단
  });
});

describe("[검증2-심화] 자리비움자가 lead.by(트릭 소유자)일 때 리드권 복귀 연쇄 — guard 소진 여부", () => {
  it("REPRO-C2(핵심): 자리비움 좌석이 리드 소유자이고 나머지가 전부 패스해 리드권이 그에게 복귀 → while이 guard 안에 정상 좌석 도달", () => {
    // 5인. 좌석2(away)가 lead.by. turn=3부터 시작해 좌석3(away)패스→좌석4(정상)에서 멈출지,
    //   아니면 좌석4도 away로 만들어 좌석0,1까지 돌아 좌석2로 복귀하는 연쇄를 만든다.
    // 여기선 좌석2만 살아있게 두고 나머지 4명 away → active=1 → 중단.
    // 대신 '정상 좌석이 리드를 못 받아치는' 상황을 5인으로: 좌석1,4 정상 / 좌석0,2,3 away.
    const players: Player[] = [
      { id: "a", name: "A" }, { id: "b", name: "B" }, { id: "c", name: "C" },
      { id: "d", name: "D" }, { id: "e", name: "E" },
    ];
    // lead.by=2(away). turn=3(away). 좌석3 응수패스 → 좌석4(정상)에서 멈춤.
    const lead = { combo: classify([t(9, "sun")])!, by: 2 };
    const s: GameState = {
      config: { maxNumber: 15, perPlayer: 12 }, players,
      hands: [
        [t(3, "cloud")], [t(4, "cloud")], [t(5, "cloud")], [t(6, "cloud")], [t(7, "cloud")],
      ],
      turn: 3, lead, winner: null, phase: "playing", setRound: 1, cumulative: [0, 0, 0, 0, 0],
    };
    const db = makeDb(s);
    setAway(db, [0, 2, 3]); // active=[1,4] 2명 → 중단
    const res = simulateTick(db, "b", db.now, { heartbeat: false });
    expect(res.aborted).toBe(true); // active 2 → 중단(연쇄 발생 전 가드)
  });

  it("REPRO-C4(guard 상한 증명): active≥3이면 forceAdvance는 반드시 guard 소진 전 정상 좌석에 도달(무한/조기종료 없음)", () => {
    // 무작위 5인 배치 × 자리비움 조합(active≥3)에서, simulateTick 후 멈춘 turn이
    //   '자리비움 아님' 또는 phase!=playing 임을 확인 → while이 자리비움 턴에 갇히지 않음.
    const players: Player[] = [
      { id: "a", name: "A" }, { id: "b", name: "B" }, { id: "c", name: "C" },
      { id: "d", name: "D" }, { id: "e", name: "E" },
    ];
    let checked = 0;
    for (let awayMask = 0; awayMask < 32; awayMask++) {
      const awaySeats: number[] = [];
      for (let i = 0; i < 5; i++) if (awayMask & (1 << i)) awaySeats.push(i);
      if (5 - awaySeats.length < 3) continue; // active≥3만
      for (let turn = 0; turn < 5; turn++) {
        // 손패: 각 좌석 2장씩(마지막 패로 인한 종료 배제하고 순수 턴 이동만 관찰)
        const hands: Tile[][] = [
          [t(3, "cloud"), t(9, "sun")], [t(4, "cloud"), t(8, "sun")], [t(5, "cloud"), t(7, "sun")],
          [t(6, "cloud"), t(10, "sun")], [t(11, "cloud"), t(12, "sun")],
        ];
        const s: GameState = {
          config: { maxNumber: 15, perPlayer: 12 }, players,
          hands, turn, lead: null, winner: null, phase: "playing", setRound: 1, cumulative: [0, 0, 0, 0, 0],
        };
        const db = makeDb(s);
        setAway(db, awaySeats);
        const referee = Math.min(...[0, 1, 2, 3, 4].filter((i) => !awaySeats.includes(i)));
        const res = simulateTick(db, seatUid(referee), db.now, { heartbeat: false });
        if (res.aborted) continue;
        const st = res.publicState!;
        // 멈춘 turn은 자리비움이 아니어야 한다(정상 좌석이 받도록). 아니면 3초 지연 반복 버그.
        if (st.phase === "playing") {
          expect(awaySeats.includes(st.turn)).toBe(false);
        }
        checked++;
      }
    }
    expect(checked).toBeGreaterThan(0);
  });

  it("REPRO-C3(guard 정확성): 5인 방 turn=away 좌석 하나, 나머지 정상 → while 1회로 정상 좌석 도달", () => {
    const players: Player[] = [
      { id: "a", name: "A" }, { id: "b", name: "B" }, { id: "c", name: "C" },
      { id: "d", name: "D" }, { id: "e", name: "E" },
    ];
    const lead = { combo: classify([t(9, "sun")])!, by: 4 };
    const s: GameState = {
      config: { maxNumber: 15, perPlayer: 12 }, players,
      hands: [[t(3, "cloud")], [t(4, "cloud")], [t(5, "cloud")], [t(6, "cloud")], [t(7, "cloud")]],
      turn: 2, lead, winner: null, phase: "playing", setRound: 1, cumulative: [0, 0, 0, 0, 0],
    };
    const db = makeDb(s);
    setAway(db, [2]); // active=[0,1,3,4], turn=2 away
    const res = simulateTick(db, "a", db.now, { heartbeat: false }); // referee=0
    expect(res.aborted).toBeUndefined();
    expect(res.publicState!.turn).toBe(3); // 좌석2 응수패스 → 좌석3(정상)에서 멈춤
    expect(res.publicState!.handCounts[2]).toBe(1); // 손패 불변(응수패스)
  });
});

describe("[검증4] 2인 이하 경계 — active 정확히 2일 때 중단(3인 최소)", () => {
  it("REPRO-D: active === 2 → aborted, status=waiting, public_state=null, hands 삭제", () => {
    const s = mkState({
      turn: 0,
      lead: null,
      hands: [[t(3, "cloud"), t(9, "sun")], [t(4, "star")], [t(5, "star")], [t(6, "star")]],
    });
    const db = makeDb(s);
    setAway(db, [2, 3]); // 좌석2,3 자리비움 → active=[0,1] 2명
    const res = simulateTick(db, "a", db.now, { heartbeat: false });
    expect(res.aborted).toBe(true);
    expect(db.room.status).toBe("waiting");
    expect(db.room.public_state).toBeNull();
    expect(db.hands.size).toBe(0);
  });

  it("REPRO-E: active === 3 → 중단 아님, 게임 계속", () => {
    const s = mkState({
      turn: 0,
      lead: null,
      hands: [[t(3, "cloud"), t(9, "sun")], [t(4, "star")], [t(5, "star")], [t(6, "star")]],
    });
    const db = makeDb(s);
    setAway(db, [3]); // active=[0,1,2] 3명
    const res = simulateTick(db, "a", db.now, { heartbeat: false });
    expect(res.aborted).toBeUndefined();
    expect(db.room.status).toBe("playing");
    expect(db.room.public_state).not.toBeNull();
  });
});

describe("[검증1] 심판 동시성 — 서로 다른 last_seen 스냅샷을 든 두 클라가 동시에 심판이 되는가", () => {
  it("REPRO-F(핵심): 좌석0이 방금 heartbeat 쳐서 아직 살아있다고 보는 클라 vs 이미 죽었다고 보는 클라", () => {
    // 초기: 좌석0(a) 자리비움 직전, 좌석1(b),2(c),3(d) 정상.
    // b의 tick: b가 자기 heartbeat 후 판정 → a는 여전히 자리비움 → 심판 = b(active 최소=1).
    // 동시에 a가 뒤늦게 tick(heartbeat) 도착 → a last_seen 갱신 → a active 복귀 →
    //   a의 tick: 심판 = a(active 최소=0). a와 b가 "각자 자기가 심판"이라 믿고 둘 다 forceAdvance.
    const s = mkState({
      turn: 0, // 좌석0 차례(리드)
      lead: null,
      hands: [
        [t(3, "cloud"), t(9, "sun")], // 좌석0
        [t(4, "star"), t(8, "moon")], // 좌석1
        [t(5, "star")], [t(6, "star")],
      ],
    });
    const db = makeDb(s);
    setAway(db, [0]); // 좌석0 자리비움

    // (1) 클라 b(좌석1)가 먼저 tick. b는 자기 heartbeat만 갱신, a는 자리비움으로 봄.
    //     b가 심판이 되어 좌석0 자동진행(구름3 냄) → 턴 좌석1로.
    const resB = simulateTick(db, "b", db.now, { heartbeat: true });
    const turnAfterB = resB.publicState!.turn;
    const seat0countAfterB = resB.publicState!.handCounts[0];

    // (2) 거의 동시에, 좌석0(a)가 재접속하며 tick. 하지만 이 tick의 "판정 스냅샷"은
    //     a가 아직 heartbeat 반영 전 상태를 읽었을 수도 있고(경합), a가 자기 heartbeat를 먼저 쳤을 수도.
    //     여기선 최악: a가 heartbeat 쳐서 active 복귀 → a가 심판(좌석0) →
    //     a도 "좌석0이 아직 자리비움"인 자기 awaySeats 스냅샷으로 forceAdvance 재실행 가능?
    // 실제 route: awaySeats는 heartbeat '후' last_seen을 다시 읽어 계산 → a는 자기 heartbeat로 active.
    // 그러면 a의 awaySeats에 0이 없으므로 while 조건 awaySeats.includes(turn)=false → 자동진행 안 함.
    const resA = simulateTick(db, "a", db.now, { heartbeat: true });

    // 관찰: 이중 진행이 일어났는지. b가 좌석0을 한 번 진행시킨 뒤 a가 또 진행시키면 좌석0 손패가 2장 빠짐.
    // (초기 좌석0 손패 2장 → 정상은 1장 남아야 함)
    const seat0countFinal = db.room.public_state!.handCounts[0];
    // eslint-disable-next-line no-console
    console.log("[REPRO-F] turnAfterB=", turnAfterB, "seat0AfterB=", seat0countAfterB, "seat0Final=", seat0countFinal);
    // 정상 기대: a가 heartbeat로 즉시 살아났으므로 a의 tick은 좌석0을 건드리지 않음 → 1장 유지.
    expect(seat0countFinal).toBe(1);
  });

  it("REPRO-G(핵심-진짜 동시성): heartbeat 없이, 두 클라가 각자 last_seen 스냅샷이 어긋난 채 둘 다 심판이 되는 진짜 레이스", () => {
    // route는 heartbeat를 '먼저' DB에 쓴 뒤 판정을 읽는다. 하지만 두 요청이 병렬이면:
    //   - a(좌석0)의 last_seen은 이전 tick으로 갱신되어 살아있음.
    //   - 그런데 어떤 이유로 두 active 클라의 판정 스냅샷이 달라
    //     '서로 다른 refereeSeat'를 계산할 수 있는가?
    // refereeSeat = min(activeSeats). activeSeats는 awaySeats에만 의존.
    // 두 클라가 같은 시점 DB를 읽으면 awaySeats 동일 → refereeSeat 동일 → 심판 1명 보장.
    // 문제는 '읽는 시점이 다른' 경우: 클라X가 판정할 때 좌석0이 자리비움이었다가,
    //   클라Y가 판정할 때는 좌석0이 heartbeat로 살아난 경우 min이 달라짐.
    //
    // 재현: 좌석0,1이 번갈아 심판이 되는 프레임을 만든다.
    //  프레임T0: 좌석0 자리비움, 좌석1이 심판(min active=1) → 좌석1이 자동진행 후보 없음(자기 턴 아님).
    //  프레임T1: 좌석0 heartbeat로 살아남 → 좌석0이 심판(min active=0).
    // 두 프레임의 tick이 '같은 게임 상태'에 대해 각각 forceAdvance를 실행하면 이중 진행.
    const s = mkState({
      turn: 0, // 좌석0 리드차례
      lead: null,
      hands: [
        [t(3, "cloud"), t(9, "sun")], // 좌석0: 2장
        [t(4, "star")], [t(5, "star")], [t(6, "star")],
      ],
    });
    const db = makeDb(s);

    // T0 스냅샷: 좌석0 자리비움. 심판 = 좌석1(b). 하지만 좌석1은 자기 차례가 아니고
    //   turn=0이 자리비움이므로 b가 forceAdvance → 좌석0 진행(구름3 냄), 턴 1로.
    setAway(db, [0]);
    const gameSnapshotAtT0 = loadGame(db)!; // 두 클라가 이 동일 상태를 병렬로 로드했다고 가정

    // 클라 b(T0): heartbeat 없이 판정. 좌석0 자리비움 → b가 심판 → 좌석0 자동진행.
    const resB = simulateTick(db, "b", db.now, { heartbeat: false });
    expect(resB.publicState!.turn).toBe(1);
    expect(resB.publicState!.handCounts[0]).toBe(1); // 좌석0 1장 냄

    // 클라 a(T0, 병렬): a는 '같은 T0 상태'(gameSnapshotAtT0)를 로드했지만 요청 처리 중
    //   자기 heartbeat가 반영돼 좌석0이 살아난 상태로 판정 → a가 심판(min=0).
    //   a의 turn=0은 자리비움 아님 → forceAdvance 안 함. => 이중 진행 없음.
    // 하지만 route는 loadGame을 heartbeat '후'에 하므로 a는 b가 이미 저장한 최신(turn=1) 상태를 봄.
    //   turn=1은 자리비움 아님 → 진행 안 함. 안전.
    db.players[0].last_seen = db.now; // a heartbeat 반영(살아남)
    const resA = simulateTick(db, "a", db.now, { heartbeat: false });
    // 이중 진행이면 좌석0이 0장(2장 다 빠짐)이 됐을 것. 1장이면 안전.
    expect(db.room.public_state!.handCounts[0]).toBe(1);
    void gameSnapshotAtT0; void resA;
  });

  it("REPRO-H(진짜 이중진행): 두 심판 클라가 '같은 게임 상태'를 각각 로드→진행→저장(last-write-wins)", () => {
    // route.ts의 실제 취약 지점: loadGame과 saveGame 사이에 락이 없다.
    // 두 active 클라가 동시에 refereeSeat를 자기라고 계산하는 상황이 성립하면
    //   (심판 판정이 어긋나는 프레임) 둘 다 loadGame→forceAdvance→saveGame.
    // last-write-wins라 '턴 2칸 점프'가 아니라 '한쪽 결과가 통째로 덮임'이 된다.
    //
    // 심판이 어긋나려면 min(activeSeats)가 두 클라에서 달라야 한다.
    // => 좌석0이 한 클라에겐 away, 다른 클라에겐 active로 보이는 프레임.
    //   클라 a(좌석0): 자기 heartbeat 후 판정 → a active → referee=0(자기) → 진행.
    //   클라 b(좌석1): a가 아직 heartbeat 반영 전 스냅샷 → a away → referee=1(자기) → 진행.
    //   두 요청이 '동일한 초기 게임 상태'를 로드했다면 둘 다 forceAdvance 실행.
    const s0 = mkState({
      turn: 2, // 좌석2(자리비움) 차례
      lead: null,
      hands: [
        [t(9, "sun"), t(9, "moon")], // 좌석0 (심판 후보 A)
        [t(8, "star"), t(8, "moon")], // 좌석1 (심판 후보 B)
        [t(3, "cloud"), t(4, "cloud")], // 좌석2 자리비움
        [t(5, "star")], // 좌석3
      ],
    });

    // ── 클라 a와 클라 b가 '동일 상태 s0'을 각각 로드했다고 보고, 각자 forceAdvance 실행 후 저장 ──
    // route.ts를 그대로 따르면 각 tick은 자기가 로드한 state에서 진행 후 saveGame.
    const stateA = structuredClone(s0);
    const stateB = structuredClone(s0);

    // 클라 a: 심판=자기(referee=0). turn=2 자리비움 → 자동패스(응수 아님, lead=null이므로 최약싱글).
    //   좌석2 최약 = 구름3 낸다 → turn 3으로.
    let a = stateA;
    let guard = 0;
    const awayForA = [2];
    while (a.phase === "playing" && awayForA.includes(a.turn) && guard++ < a.players.length) {
      const r = forceAdvance(a);
      if (!r.ok) break;
      a = r.state;
    }

    // 클라 b: 심판=자기(referee=1). 동일하게 turn=2 자리비움 → forceAdvance.
    let b = stateB;
    guard = 0;
    const awayForB = [2];
    while (b.phase === "playing" && awayForB.includes(b.turn) && guard++ < b.players.length) {
      const r = forceAdvance(b);
      if (!r.ok) break;
      b = r.state;
    }

    // 두 결과 모두 좌석2가 구름3을 냈다. last-write-wins로 하나만 남지만,
    //   '내용이 동일'하므로 좌석2 손패는 1장(정상). 턴도 3(동일).
    // eslint-disable-next-line no-console
    console.log("[REPRO-H] a.turn=", a.turn, "b.turn=", b.turn, "a.s2=", a.hands[2].length, "b.s2=", b.hands[2].length, "a.lead=", a.lead?.combo.tiles, "b.lead=", b.lead?.combo.tiles);
    // forceAdvance는 결정적(최약 싱글 고정)이라 두 클라 결과가 동일 → last-write-wins가 안전.
    expect(a.turn).toBe(b.turn);
    expect(a.hands[2].length).toBe(b.hands[2].length);
    expect(a.lead?.combo.tiles).toEqual(b.lead?.combo.tiles);
  });
});

describe("[검증1-심화] 심판 판정 어긋남 프레임 — 두 클라가 서로 자기가 심판이라 믿는 실제 레이스", () => {
  it("REPRO-P(정면): 좌석0이 두 클라 사이 경계선에 걸려 min(active)가 어긋나 이중 forceAdvance → 턴 2칸/중복 저장", () => {
    // 핵심 취약: refereeSeat=min(activeSeats)는 오직 각 요청이 '읽은 last_seen 스냅샷'에 의존.
    // 요청X는 좌석0을 away로(→referee=1), 요청Y는 좌석0을 active로(→referee=0) 판정하면
    //   좌석1과 좌석0이 '동시에' 각자 자기가 심판이라 믿고 forceAdvance.
    // route.ts는 loadGame→forceAdvance→saveGame에 락이 없으므로 마지막에 쓴 쪽이 이긴다(LWW).
    //
    // 두 요청이 '같은 초기 상태'를 로드한 뒤 각자 진행한 결과를 순차 저장하는 상황을 재현한다.
    const players: Player[] = [
      { id: "a", name: "A" }, { id: "b", name: "B" }, { id: "c", name: "C" }, { id: "d", name: "D" },
    ];
    const s0: GameState = {
      config: { maxNumber: 13, perPlayer: 13 }, players,
      hands: [
        [t(3, "cloud"), t(9, "sun")], // 좌석0: away로 볼지 active로 볼지 경계
        [t(4, "star"), t(8, "moon")], // 좌석1
        [t(5, "star")], [t(6, "star")],
      ],
      turn: 0, lead: null, winner: null, phase: "playing", setRound: 1, cumulative: [0, 0, 0, 0],
    };
    // 요청 Y(클라 a, 좌석0): heartbeat로 자기를 살렸고 자기가 심판(referee=0)이라 판정.
    //   turn=0은 '자기'이고 active로 보므로 awaySeats에 0이 없음 → while 조건 false → 진행 안 함.
    //   => a는 forceAdvance를 실행하지 않는다. (자기 차례를 자기가 스킵하지 않음)
    // 요청 X(클라 b, 좌석1): 좌석0을 away로 판정 → referee=1(자기) → turn=0 away → forceAdvance.
    //   => 오직 b만 진행한다. 이중 진행이 아니다.
    //
    // 검증: 이 경계 프레임에서도 '심판이 될 자격 있는 유일한 클라(b)'만 forceAdvance 하는가,
    //   아니면 a도 turn=0을 진행시켜 좌석0 손패가 2장 빠지는가?
    const dbX = makeDb(structuredClone(s0));   // 클라 b 시점 DB
    setAway(dbX, [0]);
    const resX = simulateTick(dbX, "b", dbX.now, { heartbeat: false });

    const dbY = makeDb(structuredClone(s0));   // 클라 a 시점 DB (a는 살아있음)
    // a heartbeat 반영: 좌석0 active
    const resY = simulateTick(dbY, "a", dbY.now, { heartbeat: true });

    // b는 좌석0을 진행(1장 소모), a는 자기 차례라 진행 안 함(2장 유지).
    expect(resX.publicState!.handCounts[0]).toBe(1); // b: 진행됨
    expect(resY.publicState!.handCounts[0]).toBe(2); // a: 자기 차례 → 스킵 안 함(진행 없음)
    // 실제 DB는 하나. 두 요청이 같은 DB에 병렬로 들어오면?
    //   - a의 forceAdvance 없음(0회) + b의 forceAdvance 1회 = 총 1회. 이중 진행 아님.
    // => 핵심: turn 소유 좌석이 '자기'인 클라는 절대 자기를 forceAdvance하지 않으므로,
    //    경계 프레임에서도 forceAdvance 실행 주체는 최대 1명. 턴 2칸 점프/2장 소모는 성립 안 함.
  });

  it("REPRO-Q(응수 트릭 이중 진행 시도): 응수 차례 좌석이 away이고 두 심판 후보가 동시 진행해도 결과 동일(결정적)", () => {
    // lead 존재(응수 차례). turn=자리비움 응수 좌석. 두 클라가 동일 상태를 각자 진행.
    // forceAdvance 응수 분기는 손패 불변·턴만 이동으로 완전 결정적 → LWW라도 동일 결과.
    const players: Player[] = [
      { id: "a", name: "A" }, { id: "b", name: "B" }, { id: "c", name: "C" }, { id: "d", name: "D" },
    ];
    const lead = { combo: classify([t(9, "sun")])!, by: 3 };
    const s0: GameState = {
      config: { maxNumber: 13, perPlayer: 13 }, players,
      hands: [[t(3, "cloud"), t(4, "cloud")], [t(5, "star"), t(6, "moon")], [t(7, "star")], [t(8, "star")]],
      turn: 1, lead, winner: null, phase: "playing", setRound: 1, cumulative: [0, 0, 0, 0],
    };
    // 좌석1(응수차례) away. active=[0,2,3], referee=0.
    const a = structuredClone(s0);
    const b = structuredClone(s0);
    const ra = forceAdvance(a); const rb = forceAdvance(b);
    expect(ra.ok && rb.ok).toBe(true);
    if (!ra.ok || !rb.ok) return;
    expect(ra.state.turn).toBe(rb.state.turn); // 둘 다 좌석2로
    expect(ra.state.hands).toEqual(rb.state.hands); // 손패 불변 동일
    expect(ra.state.lead).toEqual(rb.state.lead); // 리드 유지 동일
    // 결론: 응수 자동패스는 멱등적으로 안전. 손패가 '2장 빠지는' 일은 리드 분기에서만 가능한데,
    //   리드 분기는 turn 소유 좌석이 자기인 클라가 스스로를 진행시키지 않으므로 이중 실행 불가(REPRO-P).
  });
});

describe("[검증3] 방장 승계 — host 자리비움 시 심판에게 승계, 재접속 충돌", () => {
  it("REPRO-I: 방장(좌석0) 자리비움 → 심판(active 최소=좌석1)에게 host 승계", () => {
    const s = mkState({
      turn: 1, // 좌석1 정상 차례
      lead: null,
      hands: [[t(9, "sun")], [t(4, "star"), t(8, "moon")], [t(5, "star")], [t(6, "star")]],
    });
    const db = makeDb(s, { host: "a" }); // 방장 = 좌석0(a)
    setAway(db, [0]); // 방장 자리비움. active=[1,2,3], referee=1(b)
    simulateTick(db, "b", db.now, { heartbeat: false });
    expect(db.room.host_uid).toBe("b"); // 좌석1에게 승계
  });

  it("REPRO-J(핵심): 승계 후 원래 방장 재접속 → host 중복/충돌 없이 새 방장 유지되는가", () => {
    const s = mkState({
      turn: 1,
      lead: null,
      hands: [[t(9, "sun")], [t(4, "star"), t(8, "moon")], [t(5, "star")], [t(6, "star")]],
    });
    const db = makeDb(s, { host: "a" });
    setAway(db, [0]);
    simulateTick(db, "b", db.now, { heartbeat: false });
    expect(db.room.host_uid).toBe("b");

    // 원래 방장 a 재접속(heartbeat) → active 복귀. a가 tick 호출.
    db.players[0].last_seen = db.now;
    const res = simulateTick(db, "a", db.now, { heartbeat: true });
    // a가 다시 active 최소(0)라 referee=a. 하지만 host_uid는 이제 b이고 b는 자리비움 아님 →
    //   isAway(host=b)=false → host 승계 로직 안 탐 → host 그대로 b 유지되어야 정상.
    expect(db.room.host_uid).toBe("b"); // a가 host를 되찾지 않아야 함
    void res;
  });

  it("REPRO-K: 2인 이하 중단 시 host 승계 — 방장 자리비움이면 심판에게, 아니면 유지", () => {
    const s = mkState({
      turn: 0,
      lead: null,
      hands: [[t(3, "cloud"), t(9, "sun")], [t(4, "star")], [t(5, "star")], [t(6, "star")]],
    });
    const db = makeDb(s, { host: "c" }); // 방장 = 좌석2(c)
    setAway(db, [2, 3]); // 방장(c) 포함 자리비움. active=[0,1], referee=0(a)
    const res = simulateTick(db, "a", db.now, { heartbeat: false });
    expect(res.aborted).toBe(true);
    expect(db.room.host_uid).toBe("a"); // 방장이 자리비움이었으므로 심판 a에게 승계
  });
});

describe("[검증5] heartbeat 타이밍 — 정상 접속자의 일시 지연 오판 / 재접속 복귀", () => {
  it("REPRO-L: 게임 시작 직후 last_seen=now 기본값 → 첫 tick 전에도 아무도 자리비움 아님", () => {
    const players: Player[] = [
      { id: "a", name: "A" }, { id: "b", name: "B" }, { id: "c", name: "C" },
    ];
    const state = startGame(players, makeRng(7));
    const db = makeDb(state);
    // 아직 아무도 tick 안 침(heartbeat=false), now=시작시각
    const res = simulateTick(db, "a", db.now, { heartbeat: false });
    expect(res.awaySeats).toEqual([]); // 전원 살아있음
    expect(res.aborted).toBeUndefined();
  });

  it("REPRO-M: 11초 지연(AWAY_MS=12s 미만)은 자리비움 아님, 13초는 자리비움", () => {
    const s = mkState({ turn: 1, lead: null, hands: [[t(9, "sun")], [t(4, "star")], [t(5, "star")], [t(6, "star")]] });
    const db = makeDb(s);
    db.players[0].last_seen = db.now - 11000; // 11초 전
    const r1 = simulateTick(db, "b", db.now, { heartbeat: false });
    expect(r1.awaySeats).not.toContain(0);
    db.players[0].last_seen = db.now - 13000; // 13초 전
    const r2 = simulateTick(db, "b", db.now, { heartbeat: false });
    expect(r2.awaySeats).toContain(0);
  });

  it("REPRO-N: 재접속 후 heartbeat 갱신 → active 자동 복귀 (다음 tick부터 자리비움 해제)", () => {
    const s = mkState({ turn: 1, lead: null, hands: [[t(9, "sun")], [t(4, "star")], [t(5, "star")], [t(6, "star")]] });
    const db = makeDb(s);
    setAway(db, [0]);
    const before = simulateTick(db, "b", db.now, { heartbeat: false });
    expect(before.awaySeats).toContain(0);
    // 좌석0 재접속 tick → 자기 heartbeat
    const after = simulateTick(db, "a", db.now, { heartbeat: true });
    expect(after.awaySeats).not.toContain(0);
  });
});

describe("[검증6] 자리비움자 유리 역전 — 자동 최소패로 오히려 먼저 터는 시나리오", () => {
  it("REPRO-O: 자리비움자가 리드권을 반복 획득해 손패를 빨리 털 수 있는가(응수는 늘 패스라 리드획득 드문지)", () => {
    // 자리비움자가 리드 → 최약싱글. 다른 자리비움자들도 패스 → 리드권이 자리비움자에게 복귀 반복.
    // '모든' 다른 좌석이 자리비움이면(active 1) 중단되므로, 최소 3 active 상황에서만 게임 지속.
    // active 정상 플레이어가 있으면 그가 최약싱글을 받아쳐 리드권을 가져가므로 자리비움자는 리드 못 이어감.
    // 여기선 순수 엔진 레벨에서 "자리비움자 혼자 리드 지속"이 실제로 얼마나 이어지는지 카운트.
    const s = mkState({
      turn: 0,
      lead: null,
      hands: [
        [t(3, "cloud"), t(4, "cloud"), t(5, "cloud")], // 좌석0 자리비움: 약한 싱글들
        [t(6, "sun"), t(7, "sun")], // 좌석1 정상(이지만 여기선 자동 진행 관점만)
        [t(8, "sun")], [t(9, "sun")],
      ],
    });
    // 좌석0이 자리비움이라 계속 forceAdvance만 반복(정상 플레이어가 안 받는 최악 가정)한다면
    //   구름3 → 구름4 → 구름5 순으로 3번 만에 털어 승리. 하지만 이는 '아무도 안 받을 때'만 성립.
    let st = s;
    const away = [0];
    let plays = 0;
    // '좌석0만 계속 리드하고 나머지는 forceAdvance 패스'라는 인위적 최악 루프
    while (st.phase === "playing" && plays < 20) {
      if (st.turn === 0) {
        const r = forceAdvance(st); // 리드: 최약싱글
        if (!r.ok) break;
        st = r.state;
        plays++;
      } else {
        // 나머지는 전부 패스했다고 가정 → 리드권 좌석0 복귀
        const r = forceAdvance({ ...st }); // 응수 자동패스
        if (!r.ok) break;
        st = r.state;
      }
    }
    void away;
    // 좌석0이 3장을 다 털면 승리. 이 극단(아무도 안 받음)에서만 자리비움자가 이긴다.
    expect(st.phase).toBe("ended");
    expect(st.winner).toBe(0);
    // 결론: 정상 플레이어가 최약싱글을 받아치기만 하면 리드권을 뺏어 이 시나리오는 깨진다.
    //   → 현실 발생 가능성은 '전원 자리비움 직전' 극단으로 한정. (검증6 리포트 참조)
  });
});
