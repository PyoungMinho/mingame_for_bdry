// 오후의 패 — 신규 tick(턴 타임아웃 + 낼거없음 연쇄 자동패스, 방 종료 제거) 적대적 재현 테스트.
//
// 목적: src/app/api/pae/rooms/[code]/tick/route.ts 의 "재작성된" 심판 자동진행 알고리즘을
//       인메모리 DB로 정확히 복제해, turnAt 타임아웃 + hasPlayable 연쇄 패스가
//       (1) 턴 타임아웃 정확성 (2) 낼거없음 연쇄 무한/오작동 (3) 방 종료 제거 부작용
//       (4) 심판 동시성+turnAt (5)~(7) 회귀
//       시나리오에서 실제로 성립하는지 판정한다.
//
// ※ 소스는 무수정. 아래 simulateTick 은 route.ts 의 로직을 "그대로" 옮긴 재현체다.
//   route.ts 가 바뀌면 이 재현체도 함께 갱신해야 함(의도된 복제).
import { describe, it, expect } from "vitest";
import { forceAdvance, hasPlayable, play, pass, startGame, type GameState, type Player } from "@/lib/pae/engine";
import { toPublic, type PublicState } from "@/lib/pae/room-state";
import { classify, canBeat } from "@/lib/pae/combos";
import { makeRng, type Tile, type Suit } from "@/lib/pae/tiles";

// route.ts 상수 그대로
const AWAY_MS = 20000;
const TURN_MS = 10000;

const t = (n: number, suit: Suit): Tile => ({ n, suit });

// ── 인메모리 DB (rooms 1행 + room_players + hands) ──
interface Db {
  now: number;
  room: { host_uid: string | null; status: string; public_state: PublicState | null };
  players: { uid: string; seat: number; last_seen: number }[]; // last_seen: epoch ms
  hands: Map<string, Tile[]>; // uid -> tiles
  // saveGame이 turnAt=Date.now()를 쓰는 것을 재현하기 위한 가상 클럭 훅
  saveClock: number;
}

function seatUid(i: number) {
  return ["a", "b", "c", "d", "e"][i];
}

// makeDb: 초기 저장 시각(turnAt)을 명시적으로 넣을 수 있게 한다.
function makeDb(state: GameState, opts?: { host?: string; turnAt?: number; now?: number }): Db {
  const now = opts?.now ?? 1_000_000_000_000; // 고정 기준시각
  const pub = toPublic(state);
  pub.turnAt = opts?.turnAt ?? now; // saveGame이 기록했을 turnAt
  const db: Db = {
    now,
    room: { host_uid: opts?.host ?? state.players[0].id, status: "playing", public_state: pub },
    players: state.players.map((p, i) => ({ uid: p.id, seat: i, last_seen: now })),
    hands: new Map(state.players.map((p, i) => [p.id, state.hands[i]])),
    saveClock: opts?.turnAt ?? now,
  };
  return db;
}

// loadGame 재현: public_state + hands 로 GameState 복원 (turnAt은 GameState에 없음 — 공개상태에만 존재)
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
    totalRounds: 3,
    cumulative: pub.cumulative ?? pub.players.map(() => 0),
  };
}

// saveGame 재현: room-state.ts saveGame — public_state에 turnAt=Date.now() 기록.
// db.saveClock을 "현재 Date.now()"로 사용한다(호출자가 원하는 저장 시각을 지정).
function saveGame(db: Db, s: GameState, saveNow: number) {
  const pub = toPublic(s);
  pub.turnAt = saveNow;
  db.room.public_state = pub;
  db.room.status = s.phase;
  s.players.forEach((p, i) => db.hands.set(p.id, s.hands[i]));
  db.saveClock = saveNow;
}

// ── 재작성된 route.ts POST 로직의 재현체 ──
// callerUid = 이 tick을 호출한 클라이언트. snapshotNow = 이 요청이 읽고/판정하는 시각.
// saveNow = saveGame이 쓸 turnAt(Date.now()). 기본은 snapshotNow.
function simulateTick(
  db: Db,
  callerUid: string,
  snapshotNow: number,
  opts?: { heartbeat?: boolean; saveNow?: number },
): { publicState: PublicState | null; awaySeats: number[]; advanced?: boolean; timeoutFired?: boolean; chainCount?: number } {
  const saveNow = opts?.saveNow ?? snapshotNow;

  // 1) heartbeat — 나 살아있음 (route: 항상 실행)
  if (opts?.heartbeat !== false) {
    const me = db.players.find((p) => p.uid === callerUid);
    if (me) me.last_seen = snapshotNow;
  }

  // 2) 방/참가자 로드
  let state = loadGame(db);
  // route: phase !== "playing"이면 heartbeat만 하고 스킵
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
  const turnAt = db.room.public_state?.turnAt ?? now;

  let advanced = false;
  let timeoutFired = false;
  let chainCount = 0;

  if (mySeat === refereeSeat && refereeSeat >= 0) {
    // 방장 승계
    if (db.room.host_uid && isAway(db.room.host_uid)) {
      db.room.host_uid = state.players[refereeSeat].id;
    }

    // (a) 현재 턴이 10초 초과 → 자동 진행 1회
    if (now - turnAt > TURN_MS) {
      const r = forceAdvance(state);
      if (r.ok) {
        state = r.state;
        advanced = true;
        timeoutFired = true;
      }
    }
    // (b) 낼 게 없는 응수 차례는 즉시 연쇄 자동패스
    let guard = 0;
    while (
      state.phase === "playing" &&
      state.lead &&
      !hasPlayable(state.hands[state.turn], state.lead) &&
      guard++ < state.players.length
    ) {
      const r = forceAdvance(state);
      if (!r.ok) break;
      state = r.state;
      advanced = true;
      chainCount++;
    }
    if (advanced) saveGame(db, state, saveNow);
  }

  return { publicState: toPublic(state), awaySeats, advanced, timeoutFired, chainCount };
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
    totalRounds: 3,
    cumulative: [0, 0, 0, 0],
    ...over,
  };
}

function setAway(db: Db, seats: number[]) {
  for (const s of seats) db.players[s].last_seen = db.now - AWAY_MS - 5000;
}

// ════════════════════════════════════════════════════════════════
// 검증1 — 턴 타임아웃 정확성
// ════════════════════════════════════════════════════════════════
describe("[검증1] 턴 타임아웃 정확성 — now-turnAt>10s 판정, tick당 1회 제한", () => {
  it("T-1A: turnAt 이후 9초는 타임아웃 안 됨, 11초는 타임아웃", () => {
    const s = mkState({
      turn: 0,
      lead: null,
      hands: [[t(3, "cloud"), t(9, "sun")], [t(4, "star")], [t(5, "star")], [t(6, "star")]],
    });
    // 9초 경과
    const db9 = makeDb(s, { turnAt: 1_000_000_000_000, now: 1_000_000_009_000 });
    const r9 = simulateTick(db9, "a", db9.now, { heartbeat: false });
    expect(r9.timeoutFired).toBe(false);
    expect(r9.publicState!.turn).toBe(0); // 그대로

    // 11초 경과
    const db11 = makeDb(s, { turnAt: 1_000_000_000_000, now: 1_000_000_011_000 });
    const r11 = simulateTick(db11, "a", db11.now, { heartbeat: false });
    expect(r11.timeoutFired).toBe(true);
    // 좌석0 리드차례 → 최약싱글(구름3) 냄 → 턴 1로
    expect(r11.publicState!.turn).toBe(1);
    expect(r11.publicState!.handCounts[0]).toBe(1);
  });

  it("T-1B: [핵심] (a) 타임아웃은 while이 아니라 1회. 단 (a)로 응수패스 유발 후 (b) 연쇄가 이어질 수 있음", () => {
    // 응수 차례 4인. 좌석0이 리드 소유(by=0, 싱글9), turn=1 응수 차례.
    // 좌석1은 싱글10(>9) 낼 수 있음(hasPlayable=true). 그러나 타임아웃 (a)는 무조건 forceAdvance.
    // forceAdvance는 '낼 수 있는지' 안 보고 응수를 패스로 처리한다 → 좌석1이 강제 패스됨.
    // 그 뒤 (b) 연쇄: 좌석2(싱글5)·좌석3(싱글6)은 싱글9 못 이김 → 연쇄 패스 → lead.by=0 복귀 → lead=null.
    // 결과: turn=0, lead=null. (a)는 1회지만 (b) 연쇄로 트릭이 통째로 끝난다.
    const lead = { combo: classify([t(9, "sun")])!, by: 0 };
    const s = mkState({
      turn: 1,
      lead,
      hands: [
        [t(9, "cloud"), t(9, "moon")], // 좌석0 리드소유
        [t(10, "star")], // 좌석1 응수차례 — 싱글10>싱글9 낼 수 있으나 (a)가 강제 패스시킴
        [t(5, "star")], // 좌석2 못 이김
        [t(6, "star")], // 좌석3 못 이김
      ],
    });
    const db = makeDb(s, { turnAt: 1_000_000_000_000, now: 1_000_000_100_000, host: "a" });
    const r = simulateTick(db, "a", db.now, { heartbeat: false });
    expect(r.timeoutFired).toBe(true);
    // 실측 동작: (a) 좌석1 강제패스→turn2, (b) 좌석2·3 못이겨 패스→lead.by(0)복귀→lead=null,turn0.
    expect(r.publicState!.turn).toBe(0);
    expect(r.publicState!.lead).toBeNull();
    expect(r.publicState!.handCounts[1]).toBe(1); // 좌석1 손패 불변(강제 패스)
    // ⚠ 관찰: 좌석1은 낼 수 있는 패(싱글10)가 있었는데 타임아웃으로 응수권을 잃음.
    //   이는 "심판이 남의 응수 차례를 대신 패스"시키는 구조라, 자기 브라우저가 3초 tick만 놓쳐도
    //   (일시적 백그라운드 탭 등) 낼 수 있는 패를 강제로 패스당할 수 있다. 리포트 참고.
  });

  it("T-1C: [핵심-과다점프 후보] 저장된 turnAt이 갱신 안 되면 다음 tick에서 또 타임아웃 → 연쇄 스킵?", () => {
    // saveGame이 turnAt=saveNow로 갱신하므로, 자동진행 직후엔 turnAt이 최신이 되어
    //   바로 다음 tick(3초 후)에선 다시 타임아웃 안 나야 한다.
    const s = mkState({
      turn: 0,
      lead: null,
      hands: [[t(3, "cloud"), t(9, "sun")], [t(4, "star"), t(8, "moon")], [t(5, "star")], [t(6, "star")]],
    });
    const db = makeDb(s, { turnAt: 1_000_000_000_000, now: 1_000_000_011_000 });
    // tick1: 11초 경과 → 타임아웃, forceAdvance, saveGame(turnAt=11000시각)
    const r1 = simulateTick(db, "a", db.now, { heartbeat: false, saveNow: db.now });
    expect(r1.timeoutFired).toBe(true);
    const turnAfter1 = r1.publicState!.turn;
    // tick2: 3초 후. now-turnAt = 3초 < 10초 → 타임아웃 안 나야 정상
    const now2 = db.now + 3000;
    db.now = now2;
    const r2 = simulateTick(db, seatUid(0), now2, { heartbeat: false, saveNow: now2 });
    expect(r2.timeoutFired).toBe(false);
    expect(r2.publicState!.turn).toBe(turnAfter1); // 안 움직임
  });

  it("T-1D: [핵심 의심] 정상 액션(play)은 turnAt을 갱신하는가 — 액션 직후 타임아웃 오발동?", () => {
    // action route는 saveGame을 호출 → turnAt=Date.now() 갱신됨.
    // 재현: 좌석1이 방금 play해서 turn=2, turnAt=액션시각. 그 직후(3초) tick.
    const s = mkState({
      turn: 2,
      lead: { combo: classify([t(9, "sun")])!, by: 1 },
      hands: [[t(3, "cloud")], [t(4, "cloud")], [t(10, "star")], [t(6, "star")]],
    });
    // 액션이 방금(now) 저장되어 turnAt=now. tick은 3초 후.
    const actionAt = 1_000_000_000_000;
    const db = makeDb(s, { turnAt: actionAt, now: actionAt + 3000 });
    const r = simulateTick(db, "a", db.now, { heartbeat: false });
    // 좌석2는 싱글10>싱글9 낼 수 있음 → (b) 연쇄 안 걸림. (a) 타임아웃도 3초라 안 걸림.
    expect(r.timeoutFired).toBe(false);
    expect(r.advanced).toBe(false);
    expect(r.publicState!.turn).toBe(2);
  });
});

// ════════════════════════════════════════════════════════════════
// 검증2 — 낼거없음 연쇄 자동패스 무한/오작동
// ════════════════════════════════════════════════════════════════
describe("[검증2] 낼거없음 연쇄 자동패스 — while(lead && !hasPlayable && guard<n)", () => {
  it("T-2A: 전원 못 이기는 트릭 → 리드권이 lead.by로 복귀, while이 lead=null로 정상 종료", () => {
    // 좌석0이 최강 페어2 리드(by=0). turn=1. 좌석1,2,3 모두 페어2 못 이김 → 전원 자동패스.
    // 리드권이 좌석0으로 복귀 → lead=null → while 종료. 좌석0은 새 리드 차례로 손패 그대로.
    const lead = { combo: classify([t(2, "sun"), t(2, "moon")])!, by: 0 };
    const s = mkState({
      turn: 1,
      lead,
      hands: [
        [t(2, "sun"), t(2, "moon"), t(9, "star")], // 좌석0 리드소유(페어2 이미 냄 가정이지만 여기선 손에 남긴 상태로 단순화)
        [t(4, "cloud"), t(4, "star")], // 좌석1 페어4 — 페어2 못 이김
        [t(5, "cloud"), t(5, "star")], // 좌석2 페어5 — 못 이김
        [t(6, "cloud"), t(6, "star")], // 좌석3 페어6 — 못 이김
      ],
    });
    const db = makeDb(s, { turnAt: 1_000_000_000_000, now: 1_000_000_005_000 }); // 5초(타임아웃 X)
    const r = simulateTick(db, "a", db.now, { heartbeat: false });
    // (a) 타임아웃 X. (b): turn=1 응수, 페어4 vs 페어2 못이김 → 패스 → turn2 → 패스 → turn3 → 패스 →
    //   nextAlive(3)=0=lead.by → lead=null, turn=0. while: lead=null → 종료.
    expect(r.publicState!.lead).toBeNull();
    expect(r.publicState!.turn).toBe(0); // 리드권 복귀
    // 아무 손패도 안 빠짐(전부 응수패스)
    expect(r.publicState!.handCounts).toEqual([3, 2, 2, 2]);
    // guard 소진 없이 정상. chainCount = 3(좌석1,2,3 패스)
    expect(r.chainCount).toBe(3);
  });

  it("T-2B: [핵심-무한 방어] guard가 players.length에서 정확히 끊기는가 — while 종료 보장", () => {
    // 리드 소유자도 못 이기게 만들 수는 없다(자기 리드보다 강한 게 필요없음, 자기 차례엔 lead=null).
    // 하지만 인위적으로 lead.by 좌석의 손패를 lead를 못 이기게 하고 turn이 lead.by로 안 돌아오게
    //   경계를 만들어 guard 상한(=players.length) 도달 여부를 관찰.
    // 정상 게임에선 nextAlive가 반드시 lead.by에 도달하므로 guard 소진 전에 lead=null 종료.
    // 그래도 guard 상한 자체는 안전망: n번 이내 무조건 종료.
    const lead = { combo: classify([t(2, "sun")])!, by: 0 };
    const s = mkState({
      turn: 1,
      lead,
      hands: [
        [t(3, "cloud"), t(4, "cloud")], // 좌석0 리드소유(싱글2 냈다 가정)
        [t(5, "cloud")], // 좌석1 싱글5 — 싱글2 못 이김
        [t(6, "cloud")], // 좌석2 못 이김
        [t(7, "cloud")], // 좌석3 못 이김
      ],
    });
    const db = makeDb(s, { turnAt: 1_000_000_000_000, now: 1_000_000_005_000 });
    const r = simulateTick(db, "a", db.now, { heartbeat: false });
    // turn1 패스→2 패스→3 패스→nextAlive(3)=0=lead.by→lead=null,turn=0. while 종료.
    expect(r.publicState!.lead).toBeNull();
    expect(r.publicState!.turn).toBe(0);
    expect(r.chainCount).toBeLessThanOrEqual(4); // guard 상한 이내
  });

  it("T-2C: [핵심-리드차례 while 진입 금지] lead=null이면 while 안 들어감(자동 최소패 금지)", () => {
    // (b) while 조건은 state.lead가 truthy일 때만. 리드 차례(lead=null)에 낼 게 있어도(손 있음)
    //   while 진입 안 함 → 리드 차례는 (b)로 자동 진행되지 않는다(타임아웃 (a)로만).
    const s = mkState({
      turn: 0,
      lead: null, // 리드 차례
      hands: [[t(3, "cloud"), t(9, "sun")], [t(4, "star")], [t(5, "star")], [t(6, "star")]],
    });
    const db = makeDb(s, { turnAt: 1_000_000_000_000, now: 1_000_000_005_000 }); // 5초(타임아웃 X)
    const r = simulateTick(db, "a", db.now, { heartbeat: false });
    // 타임아웃 X + lead=null이라 (b) while 진입 안 함 → 아무 진행 없음.
    expect(r.advanced).toBe(false);
    expect(r.chainCount).toBe(0);
    expect(r.publicState!.turn).toBe(0);
    expect(r.publicState!.handCounts[0]).toBe(2); // 손패 그대로
  });

  it("T-2D: [핵심-복합] 타임아웃 (a)로 리드 뚫고 → 뒤이어 전원 못이겨 (b) 연쇄까지 → 리드권 복귀", () => {
    // 좌석0 리드차례 타임아웃 → 최약싱글(구름3) 냄 → turn1. 좌석1,2,3 구름3 못 이김? 아니 싱글이라 이길 수 있음.
    // 못 이기게 하려면 나머지 손패를 구름3보다 약하게... 구름3이 최약이라 불가.
    // 대신 좌석0이 강한 싱글(해9)을 내게 하고 나머지가 못 이기게.
    const s = mkState({
      turn: 0,
      lead: null,
      hands: [
        [t(2, "sun"), t(9, "moon")], // 좌석0: 최약이 해9(sun9). sort하면 moon9<sun2. 최약싱글=moon9? numberRank(9)<(2)
        [t(3, "cloud")], // 좌석1
        [t(4, "cloud")], // 좌석2
        [t(5, "cloud")], // 좌석3
      ],
    });
    // 좌석0 최약싱글: numberRank(2)=14, numberRank(9)=6 → moon9가 약함. moon9 냄(strength=6*4+2).
    // 좌석1~3 싱글(3,4,5): numberRank 0,1,2 → 전부 moon9보다 약함 → 못 이김 → 연쇄 패스.
    const db = makeDb(s, { turnAt: 1_000_000_000_000, now: 1_000_000_011_000 }); // 11초 → 타임아웃
    const r = simulateTick(db, "a", db.now, { heartbeat: false });
    expect(r.timeoutFired).toBe(true);
    // 좌석0 moon9 냄 → lead by0, turn1. 좌석1~3 전부 못이겨 패스 → nextAlive=0=lead.by → lead=null,turn0.
    expect(r.publicState!.lead).toBeNull();
    expect(r.publicState!.turn).toBe(0);
    expect(r.publicState!.handCounts[0]).toBe(1); // 좌석0 moon9 1장 냄
    expect(r.publicState!.handCounts).toEqual([1, 1, 1, 1]); // 나머지 불변
  });

  it("T-2E: [무한루프 헌팅] 무작위 4/5인 상태에서 simulateTick이 항상 종료(guard 안전망)", () => {
    // 다양한 lead/turn/away 조합에서 한 번의 tick이 무한루프 없이 끝나는지.
    let checked = 0;
    for (let seed = 1; seed <= 60; seed++) {
      for (const n of [4, 5]) {
        const rng = makeRng(seed * 100 + n);
        let full = startGame(
          Array.from({ length: n }, (_, i) => ({ id: seatUid(i), name: `P${i}` })),
          rng,
        );
        // 몇 수 진행시켜 임의의 중간 상태 만들기
        let steps = Math.floor(rng() * 15);
        while (steps-- > 0 && full.phase === "playing") {
          const seat = full.turn;
          const opts = hasPlayable(full.hands[seat], full.lead);
          if (full.lead && !opts) {
            const r = pass(full, seat);
            if (r.ok) full = r.state;
            else break;
          } else {
            const r = forceAdvance(full);
            if (r.ok) full = r.state;
            else break;
          }
        }
        if (full.phase !== "playing") continue;
        const db = makeDb(full, { turnAt: 1_000_000_000_000, now: 1_000_000_011_000 });
        // 심판=좌석0
        const r = simulateTick(db, "a", db.now, { heartbeat: false });
        // chainCount는 guard 상한(=players.length) 이하여야 함
        expect((r.chainCount ?? 0)).toBeLessThanOrEqual(n);
        checked++;
      }
    }
    expect(checked).toBeGreaterThan(0);
  });
});

// ════════════════════════════════════════════════════════════════
// 검증3 — 방 종료 제거 부작용
// ════════════════════════════════════════════════════════════════
describe("[검증3] 방 종료 제거 — 전원 자리비움/1인 잔존 시 게임 진행", () => {
  it("T-3A: [핵심] 전원 자리비움 → refereeSeat=-1 → 아무 진행 안 함(영구정지)", () => {
    // route: activeSeats.length===0이면 refereeSeat=-1 → if(mySeat===refereeSeat && refereeSeat>=0) 거짓
    //   → 자동진행 스킵. 게임은 playing인 채 멈춤(종료 로직 제거됨).
    const s = mkState({
      turn: 0,
      lead: null,
      hands: [[t(3, "cloud"), t(9, "sun")], [t(4, "star")], [t(5, "star")], [t(6, "star")]],
    });
    const db = makeDb(s, { turnAt: 1_000_000_000_000, now: 1_000_000_100_000 });
    setAway(db, [0, 1, 2, 3]); // 전원 자리비움
    // 아무나 tick (전부 away라 refereeSeat=-1). caller도 away지만 heartbeat로 살아날 수 있음.
    const r = simulateTick(db, "a", db.now, { heartbeat: false }); // heartbeat 없이 순수 판정
    expect(r.awaySeats).toEqual([0, 1, 2, 3]);
    expect(r.advanced).toBe(false); // refereeSeat=-1 → 진행 없음
    expect(db.room.status).toBe("playing"); // 종료 안 됨 (방 안 터짐)
    expect(db.room.public_state).not.toBeNull();
  });

  it("T-3B: [핵심] 활성 1명(heartbeat 유지) + 3명 자리비움 → 유령들 자동패스로 게임 정상 종료까지 진행", () => {
    // 좌석0 정상(심판, 브라우저가 3초마다 heartbeat 유지), 좌석1,2,3 자리비움.
    //   유령 차례는 심판(좌석0)의 타임아웃 tick이 진행, 좌석0 자기 차례는 사람이 직접 액션.
    //   ★ 실제 조건: 좌석0의 브라우저는 매 tick heartbeat로 last_seen을 계속 갱신한다.
    //     (이 갱신을 빼면 좌석0마저 away로 오판되어 refereeSeat=-1 정지 — T-3B-STALL에서 별도 관찰)
    const rng = makeRng(42);
    let full = startGame(
      [
        { id: "a", name: "A" }, { id: "b", name: "B" }, { id: "c", name: "C" }, { id: "d", name: "D" },
      ],
      rng,
    );
    const db = makeDb(full, { turnAt: 1_000_000_000_000 });
    setAway(db, [1, 2, 3]); // 좌석1,2,3 자리비움

    let iterations = 0;
    let clock = db.now;
    while (loadGame(db)!.phase === "playing" && iterations < 2000) {
      iterations++;
      clock += 100;
      db.now = clock;
      db.players[0].last_seen = clock; // 좌석0 브라우저 heartbeat 유지(실제 동작)
      const cur = loadGame(db)!;
      if (cur.turn === 0) {
        const opts = hasPlayable(cur.hands[0], cur.lead);
        if (cur.lead && !opts) {
          const r = pass(cur, 0);
          if (r.ok) saveGame(db, r.state, clock);
        } else {
          const hand = cur.hands[0];
          const single = hand
            .map((tile) => classify([tile])!)
            .filter((c) => !cur.lead || c.size === cur.lead.combo.size)
            .filter((c) => !cur.lead || canBeat(c, cur.lead.combo));
          if (single.length > 0) {
            const chosen = single.sort((x, y) => x.key - y.key)[0];
            const r = play(cur, 0, chosen.tiles);
            if (r.ok) saveGame(db, r.state, clock);
            else { if (cur.lead) { const p = pass(cur, 0); if (p.ok) saveGame(db, p.state, clock); } else break; }
          } else if (cur.lead) {
            const p = pass(cur, 0);
            if (p.ok) saveGame(db, p.state, clock);
          } else break;
        }
      } else {
        clock += TURN_MS + 1000; // 유령 차례 타임아웃 유발
        db.now = clock;
        db.players[0].last_seen = clock; // 심판(좌석0) heartbeat 유지
        simulateTick(db, "a", clock, { heartbeat: false, saveNow: clock });
      }
    }
    const final = loadGame(db)!;
    expect(iterations).toBeLessThan(2000); // 무한루프 아님
    expect(final.phase).toBe("ended"); // 끝까지 진행됨
    expect(final.winner).not.toBeNull();
  });

  it("T-3B-STALL: [부작용 관찰] 활성 1명이 heartbeat를 놓치면 refereeSeat=-1 → 게임 영구정지", () => {
    // T-3A의 확장: '활성 1명'이라도 그 1명의 브라우저 tick(heartbeat)이 끊기면
    //   activeSeats=[] → refereeSeat=-1 → 자동진행 스킵. 게임은 playing인 채 멈춘다.
    //   (방 종료 로직이 제거됐으므로 방은 안 터지지만, 아무도 없으면 좀비 방으로 영구 잔존)
    const s = mkState({
      turn: 1,
      lead: { combo: classify([t(9, "sun")])!, by: 0 },
      hands: [[t(3, "cloud")], [t(4, "cloud")], [t(5, "cloud")], [t(6, "cloud")]],
    });
    const db = makeDb(s, { turnAt: 1_000_000_000_000, now: 1_000_000_500_000 });
    setAway(db, [0, 1, 2, 3]); // 전원(좌석0 포함) heartbeat 끊김
    const before = JSON.stringify(db.room.public_state);
    for (let i = 0; i < 10; i++) {
      db.now += 5000;
      simulateTick(db, "a", db.now, { heartbeat: false });
    }
    expect(db.room.status).toBe("playing"); // 종료 안 됨(방 안 터짐)
    expect(JSON.stringify(db.room.public_state)).toBe(before); // 상태 완전 불변 = 좀비 방
  });

  it("T-3C: [정지 판정] 활성 0명 상태가 지속되면 game은 영원히 playing (사용자가 재접속해야 재개)", () => {
    // T-3A의 후속: 전원 away인 상태가 유지되는 한 tick은 매번 no-op. 상태 안 바뀜.
    const s = mkState({
      turn: 1,
      lead: { combo: classify([t(9, "sun")])!, by: 0 },
      hands: [[t(3, "cloud")], [t(4, "cloud")], [t(5, "cloud")], [t(6, "cloud")]],
    });
    const db = makeDb(s, { turnAt: 1_000_000_000_000, now: 1_000_000_500_000 });
    setAway(db, [0, 1, 2, 3]);
    const before = JSON.stringify(db.room.public_state);
    for (let i = 0; i < 5; i++) {
      db.now += 5000;
      simulateTick(db, "a", db.now, { heartbeat: false });
    }
    expect(JSON.stringify(db.room.public_state)).toBe(before); // 불변
  });
});

// ════════════════════════════════════════════════════════════════
// 검증4 — 심판 동시성 + turnAt
// ════════════════════════════════════════════════════════════════
describe("[검증4] 심판 동시성 + turnAt — 경계 프레임 이중 forceAdvance / 턴 2칸 점프", () => {
  it("T-4A: [핵심] 두 클라가 같은 상태를 로드→forceAdvance→saveGame (LWW). 응수분기는 멱등", () => {
    // 응수 자동패스 분기: 손패 불변, 턴만 이동 → 두 클라 결과 동일 → LWW 안전.
    const lead = { combo: classify([t(9, "sun")])!, by: 3 };
    const s0 = mkState({
      turn: 1,
      lead,
      hands: [[t(3, "cloud"), t(4, "cloud")], [t(5, "star"), t(6, "moon")], [t(7, "star")], [t(8, "star")]],
    });
    const a = structuredClone(s0);
    const b = structuredClone(s0);
    const ra = forceAdvance(a);
    const rb = forceAdvance(b);
    expect(ra.ok && rb.ok).toBe(true);
    if (ra.ok && rb.ok) {
      expect(ra.state.turn).toBe(rb.state.turn);
      expect(ra.state.hands).toEqual(rb.state.hands);
    }
  });

  it("T-4B: [핵심] 타임아웃 경계에서 두 심판 후보가 동시에 forceAdvance → 리드분기 이중 소모?", () => {
    // refereeSeat=min(activeSeats). 경계: 좌석0이 한 요청엔 away, 다른 요청엔 active로 보임.
    //   요청X(좌석1이 심판): 좌석0 away로 봄 → referee=1 → turn(=0) away이지만 (b)는 lead 필요.
    //     리드차례(lead=null)면 (b) 진입 안 함. (a) 타임아웃만 유효.
    //   요청Y(좌석0이 심판): 좌석0 active로 봄 → referee=0 → turn=0은 자기.
    // 재현: turn=0 리드차례, turnAt 오래됨. 두 요청이 각각 심판이 되어 (a) forceAdvance 실행 시
    //   리드분기라 손패가 빠진다. 이중 실행이면 좌석0 손패 2장 빠짐.
    const s0 = mkState({
      turn: 0,
      lead: null,
      hands: [[t(3, "cloud"), t(9, "sun")], [t(4, "star")], [t(5, "star")], [t(6, "star")]],
    });
    // 요청X: 클라 b(좌석1). 좌석0 away로 판정 → referee=1. turnAt 오래됨(타임아웃).
    const dbX = makeDb(structuredClone(s0), { turnAt: 1_000_000_000_000, now: 1_000_000_011_000 });
    setAway(dbX, [0]);
    const rX = simulateTick(dbX, "b", dbX.now, { heartbeat: false });
    // 요청Y: 클라 a(좌석0). heartbeat로 자기 살림 → referee=0. turnAt 오래됨.
    const dbY = makeDb(structuredClone(s0), { turnAt: 1_000_000_000_000, now: 1_000_000_011_000 });
    const rY = simulateTick(dbY, "a", dbY.now, { heartbeat: true });
    // 두 요청 모두 turn=0 리드차례에서 (a) 타임아웃 forceAdvance → 좌석0 구름3 냄.
    // 각각 독립 DB지만, 실제로는 같은 DB에 순차 저장(LWW). forceAdvance는 결정적(최약싱글 고정).
    // → 두 결과 동일: 좌석0 1장 냄, turn=1.
    expect(rX.publicState!.handCounts[0]).toBe(1);
    expect(rY.publicState!.handCounts[0]).toBe(1);
    expect(rX.publicState!.turn).toBe(1);
    expect(rY.publicState!.turn).toBe(1);
    // LWW: 실제 단일 DB라면 마지막 저장이 이김. 둘 다 동일 결과 → 좌석0은 1장(2장 소모 아님).
    // 결정성 덕에 이중 forceAdvance라도 '한 턴만큼' 결과가 동일.
  });

  it("T-4D: [★확정 버그] turnAt/turn 세대 불일치 — route가 public_state를 두 번 따로 읽어 오발동", () => {
    // route.ts 취약: turnAt은 26줄 room 쿼리(1차 public_state)에서, turn(state)은 32줄
    //   loadGame(2차 public_state)에서 온다. 두 왕복 사이 다른 요청의 saveGame이 착지하면
    //   turnAt=구세대(오래됨) + turn=신세대(방금 진행됨) 조합 발생 → now-turnAt>10s 오판 →
    //   방금 정상 액션으로 넘어온 턴을 '또' 타임아웃 처리해 강제 진행(응수권 박탈).
    //
    // 재현: 아래는 route의 (a)/(b) 로직을 turnAt과 state를 '따로' 주입해 그대로 실행한다.
    const tickSplit = (turnAt: number, state: GameState, now: number, referee: number, mySeat: number) => {
      let advanced = false, timeoutFired = false;
      let st = state;
      if (mySeat === referee && referee >= 0) {
        if (now - turnAt > TURN_MS) {
          const r = forceAdvance(st);
          if (r.ok) { st = r.state; advanced = true; timeoutFired = true; }
        }
        let g = 0;
        while (st.phase === "playing" && st.lead && !hasPlayable(st.hands[st.turn], st.lead) && g++ < st.players.length) {
          const r = forceAdvance(st);
          if (!r.ok) break;
          st = r.state; advanced = true;
        }
      }
      return { state: st, advanced, timeoutFired };
    };

    // 신세대 상태: 좌석1이 방금 액션 → turn=2, lead by1(싱글4). 좌석2는 싱글9로 확실히 이길 수 있음.
    const g2: GameState = mkState({
      turn: 2,
      lead: { combo: classify([t(4, "star")])!, by: 1 },
      hands: [[t(3, "cloud")], [t(11, "star")], [t(9, "sun"), t(10, "sun")], [t(6, "star")]],
    });
    // 좌석2는 낼 수 있으니 (b) 연쇄는 절대 안 돈다. 오직 (a) 타임아웃 오발동만이 좌석2를 밀 수 있다.
    expect(hasPlayable(g2.hands[2], g2.lead)).toBe(true);

    const now = 103_000;
    const turnAtGen2 = 100_000; // 좌석1 액션 시각(신세대) — turn=2 시작
    const turnAtGen1 = 1_000; // 좌석1 '이전' 차례 시작(구세대)

    // 정상: turnAt/turn 같은 세대 → 3초 경과라 타임아웃 X → 좌석2 응수 대기
    const normal = tickSplit(turnAtGen2, structuredClone(g2), now, 0, 0);
    expect(normal.advanced).toBe(false);
    expect(normal.state.turn).toBe(2);

    // 버그: turnAt 구세대(1000) + turn 신세대(2) → now-turnAt=102s>10s 오발동
    const bug = tickSplit(turnAtGen1, structuredClone(g2), now, 0, 0);
    expect(bug.timeoutFired).toBe(true); // 타임아웃 오발동
    expect(bug.state.turn).toBe(3); // 좌석2 강제 스킵됨(turn 2→3)
    expect(bug.state.hands[2].length).toBe(2); // 좌석2 손패 그대로 = 낼 수 있었는데 응수권 박탈
    // ⟶ CONFIRMED: 세대 불일치 시 '낼 수 있는 응수자'가 강제 패스당해 한 턴 사라진다.
  });

  it("T-4C: [진짜 이중진행 시도] 단일 DB에 두 요청 순차 처리 — 두 번째가 이미 갱신된 turnAt/turn을 봄", () => {
    // route.ts는 각 요청이 loadGame으로 '현재 DB 상태'를 새로 읽는다.
    //   요청1이 saveGame으로 turn=1, turnAt=최신 저장.
    //   요청2가 그 후 loadGame → turn=1(이미 진행됨), turnAt 최신 → 타임아웃 안 남 → 이중진행 없음.
    // 문제는 두 요청이 '동시에'(둘 다 저장 전) loadGame한 경우인데, 그건 T-4B에서 결정성으로 커버.
    // 여기선 순차 처리가 안전함을 확인.
    const s0 = mkState({
      turn: 0,
      lead: null,
      hands: [[t(3, "cloud"), t(9, "sun")], [t(4, "star"), t(8, "moon")], [t(5, "star")], [t(6, "star")]],
    });
    const db = makeDb(s0, { turnAt: 1_000_000_000_000, now: 1_000_000_011_000 });
    // 요청1: 좌석0 심판, 타임아웃 → forceAdvance, saveGame(turnAt=now)
    const r1 = simulateTick(db, "a", db.now, { heartbeat: false, saveNow: db.now });
    expect(r1.publicState!.handCounts[0]).toBe(1);
    // 요청2: 같은 순간 도착했지만 순차 처리라 이미 저장된 turn=1, turnAt=now를 봄.
    //   now-turnAt=0 → 타임아웃 X. turn=1은 응수/리드 상황 따라. lead by0 존재, turn1.
    const r2 = simulateTick(db, "a", db.now, { heartbeat: false, saveNow: db.now });
    // 좌석0은 여전히 1장(이중 소모 없음)
    expect(r2.publicState!.handCounts[0]).toBe(1);
  });
});

// ════════════════════════════════════════════════════════════════
// 검증6 — tick 항상 실행 부작용 (waiting/ended)
// ════════════════════════════════════════════════════════════════
describe("[검증6] tick 항상 실행 — waiting/ended에서 heartbeat만, 자동진행 스킵", () => {
  it("T-6A: ended 상태 tick → heartbeat만, publicState 반환하되 자동진행 없음", () => {
    const s = mkState({
      turn: 0,
      lead: null,
      phase: "ended",
      winner: 0,
      hands: [[], [t(4, "star")], [t(5, "star")], [t(6, "star")]],
    });
    const db = makeDb(s, { turnAt: 1_000_000_000_000, now: 1_000_000_100_000 });
    db.room.status = "ended";
    const r = simulateTick(db, "a", db.now, { heartbeat: true });
    // phase!==playing → 조기 반환. publicState는 그대로.
    expect(r.publicState!.phase).toBe("ended");
    expect(r.advanced).toBeUndefined(); // 자동진행 블록 안 탐
    // heartbeat는 됐는지: 좌석0 last_seen 갱신됨
    expect(db.players[0].last_seen).toBe(db.now);
  });

  it("T-6B: waiting(public_state=null) tick → publicState=null, awaySeats=[]", () => {
    const db: Db = {
      now: 1_000_000_000_000,
      room: { host_uid: "a", status: "waiting", public_state: null },
      players: [
        { uid: "a", seat: 0, last_seen: 1_000_000_000_000 },
        { uid: "b", seat: 1, last_seen: 1_000_000_000_000 },
      ],
      hands: new Map(),
      saveClock: 1_000_000_000_000,
    };
    const r = simulateTick(db, "a", db.now, { heartbeat: true });
    expect(r.publicState).toBeNull();
    expect(r.awaySeats).toEqual([]);
    // heartbeat 됐는지
    expect(db.players[0].last_seen).toBe(db.now);
  });
});

// ════════════════════════════════════════════════════════════════
// 검증7 — 회귀 (turnAt 없어도 무해)
// ════════════════════════════════════════════════════════════════
describe("[검증7] 회귀 — turnAt 미존재 시 tick 기본값(now) 사용, toPublic엔 turnAt 없음", () => {
  it("T-7A: public_state에 turnAt이 없으면 tick은 now로 대체 → 즉시 타임아웃 안 남", () => {
    // action route의 toPublic 결과엔 turnAt 없음(saveGame만 붙임). 하지만 DB엔 항상 saveGame 경유라 있음.
    // 만약 어떤 이유로 turnAt이 없으면(?? now) → now-now=0 → 타임아웃 안 남(안전).
    const s = mkState({
      turn: 0,
      lead: null,
      hands: [[t(3, "cloud"), t(9, "sun")], [t(4, "star")], [t(5, "star")], [t(6, "star")]],
    });
    const db = makeDb(s, { now: 1_000_000_000_000 });
    delete db.room.public_state!.turnAt; // turnAt 제거
    const r = simulateTick(db, "a", db.now, { heartbeat: false });
    expect(r.timeoutFired).toBe(false); // now-now=0 → 타임아웃 X
    expect(r.advanced).toBe(false);
  });

  it("T-7B: toPublic 결과엔 turnAt 필드가 없다(saveGame이 별도 부착)", () => {
    const s = mkState({
      turn: 0,
      lead: null,
      hands: [[t(3, "cloud")], [t(4, "star")], [t(5, "star")], [t(6, "star")]],
    });
    const pub = toPublic(s);
    expect("turnAt" in pub).toBe(false); // toPublic 단독 결과엔 없음 → 클라가 없어도 무해
  });
});
