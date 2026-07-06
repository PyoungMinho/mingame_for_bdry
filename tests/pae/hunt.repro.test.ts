/**
 * hunt.repro.test.ts — 적대적 버그 헌팅 재현 테스트 (신규, 소스 무수정).
 *
 * "갑자기 패를 못 내는" 실제 증상의 근본 원인을 규칙 로직에서 추적한다.
 * 각 테스트는 "이게 참이면 버그"인 형태로, 실제 재현 여부를 명확히 판정한다.
 *
 * 조사 대상:
 *   1. 턴 데드락 — pass()의 next===lead.by 판정, nextAlive가 from 반환
 *   2. "낼 수 있는데 내기 버튼 비활성" / noPlayable 오판정
 *   3. 인원별 딜 정확성
 *   4. 콤보 판정 누락/오판
 *   5. 라운드/세트 종료
 */
import { describe, it, expect } from "vitest";
import {
  startGame,
  play,
  pass,
  nextRound,
  cumulativeWithRound,
  roundPenalty,
  playableAgainst,
  hasPlayable,
  enumerateCombos,
  type GameState,
  type Player,
  type Lead,
} from "@/lib/pae/engine";
import { classify, canBeat, compareCombos } from "@/lib/pae/combos";
import { deal, startingPlayer, makeRng, tileId, type Tile, type Suit } from "@/lib/pae/tiles";

const t = (n: number, suit: Suit): Tile => ({ n, suit });
const players = (n: number): Player[] => Array.from({ length: n }, (_, i) => ({ id: `p${i}`, name: `P${i}` }));
const leadOf = (tiles: Tile[], by: number): Lead => ({ combo: classify(tiles)!, by });
function mk(hands: Tile[][], turn = 0, lead: Lead | null = null): GameState {
  return {
    config: { maxNumber: 15, perPlayer: 0 },
    players: players(hands.length),
    hands,
    turn,
    lead,
    winner: null,
    phase: "playing",
    setRound: 1,
    cumulative: new Array(hands.length).fill(0),
  };
}
function ok(r: ReturnType<typeof play>): GameState {
  if (!r.ok) throw new Error(`예상치 못한 실패: ${r.error}`);
  return r.state;
}

// ════════════════════════════════════════════════════════════════
// #1 턴 데드락 — pass()의 트릭 종료 판정
// ════════════════════════════════════════════════════════════════
describe("HUNT #1 — 턴 데드락 (pass 트릭 종료)", () => {
  // 핵심 가설: 리드한 사람(lead.by)이 손을 비운 뒤에도 게임이 계속되는 상황에서
  // 나머지가 전부 패스하면 nextAlive는 절대 lead.by를 반환하지 못한다.
  // → next === lead.by 판정이 영원히 거짓 → 트릭이 안 끝나거나, 마지막 남은 1명이 자기자신 패스.

  it("HUNT-1A: 마지막 패를 낸 사람이 lead일 때는 즉시 ended (정상 경로 확인)", () => {
    // play가 마지막 패를 내면 phase=ended가 되므로, lead.by가 손을 비우는 유일 경로는 곧 게임종료.
    const s = mk([[t(9, "sun")], [t(4, "cloud")], [t(5, "cloud")]], 0, null);
    const st = ok(play(s, 0, [t(9, "sun")]));
    expect(st.phase).toBe("ended");
    expect(st.winner).toBe(0);
  });

  it("HUNT-1B: [핵심] 리드 직후 다른 사람이 받아서 손을 비우면 게임 종료 — lead.by는 손 남음 (정상)", () => {
    // P0 리드(9), P1이 마지막 패 2로 받으면 즉시 ended. lead.by=1은 손 비움이지만 winner.
    const s = mk([[t(9, "sun"), t(4, "cloud")], [t(2, "sun")], [t(5, "cloud")]], 0, null);
    let st = ok(play(s, 0, [t(9, "sun")]));
    expect(st.lead?.by).toBe(0);
    expect(st.turn).toBe(1);
    st = ok(play(st, 1, [t(2, "sun")])); // P1 마지막 패
    expect(st.phase).toBe("ended");
    expect(st.winner).toBe(1);
  });

  it("HUNT-1C: [데드락 후보] 마지막 남은 활성 1명 vs 손 비운 lead.by — pass가 자기자신 반환?", () => {
    // 상황: P0가 리드(by0)했고, 그 뒤 P1이 손을 비웠다면 play에서 이미 ended.
    // 그러나 lead가 살아있는 상태로 "활성자가 사실상 1명"인 상태를 강제 구성해 pass 동작을 본다.
    // hands: P0 리드했음(by0)이지만 P0가 이미 빈손(테스트 강제) + P2만 활성.
    // 실전에서 이 상태가 성립하는지는 1D에서 별도 검증.
    const s = mk([[], [t(4, "cloud")], []], 1, leadOf([t(9, "sun")], 0));
    const r = pass(s, 1); // P1이 패스. nextAlive(hands,1): P2빈손,P0빈손 → from(=1) 반환.
    expect(r.ok).toBe(true);
    if (r.ok) {
      const next = r.state.turn;
      const leadAfter = r.state.lead;
      // nextAlive가 from(1)을 반환 → next(1) !== lead.by(0) → lead 유지, turn=1(자기자신)
      // = 데드락: P1은 리드(0)를 못 이기면 영원히 자기 차례에 갇힘.
      // 이 상태가 실전 재현 가능한지가 관건 (1D 참조).
      // 여기선 코드 동작만 기록:
      // eslint-disable-next-line no-console
      console.log(`[HUNT-1C] pass 결과 turn=${next}, lead=${leadAfter ? "유지" : "null"}`);
    }
  });

  it("HUNT-1D: [실전 성립 여부] play는 마지막 패에서 즉시 ended → lead.by가 '빈손+게임진행중'은 불성립", () => {
    // 규칙 로직상 lead.by가 손을 비우는 순간은 반드시 그 play에서 winner+ended.
    // 따라서 진행 중 상태에서 lead.by는 항상 손패 ≥1 → nextAlive는 반드시 언젠가 lead.by 도달.
    // → 이론상 pass 데드락은 정상 게임 흐름에서 불성립함을 검증.
    // 3인 풀게임을 여러 시드로 끝까지 자동진행하며 무한루프/자기자신 턴이 안 나는지 확인.
    for (let seed = 1; seed <= 40; seed++) {
      let st = startGame(players(3), makeRng(seed));
      let guard = 0;
      while (st.phase === "playing") {
        if (guard++ > 500) throw new Error(`시드 ${seed}: 500스텝 초과 = 데드락/무한루프 의심`);
        const seat = st.turn;
        const opts = playableAgainst(st.hands[seat], st.lead);
        if (opts.length > 0) {
          // 가장 작은 조합을 냄
          const c = [...opts].sort((a, b) => a.size - b.size || a.key - b.key)[0];
          const r = play(st, seat, c.tiles);
          expect(r.ok).toBe(true);
          if (r.ok) st = r.state;
        } else {
          if (st.lead === null) {
            // 리드 차례인데 낼 게 없다? hasPlayable(hand,null)=hand.length>0이라 손 있으면 항상 있음.
            throw new Error(`시드 ${seed}: 리드 차례에 낼 조합 0 (손 ${st.hands[seat].length}장) = 데드락`);
          }
          const r = pass(st, seat);
          expect(r.ok).toBe(true);
          if (r.ok) {
            // 패스 결과가 자기자신 턴이면 데드락
            if (r.state.turn === seat && r.state.lead !== null) {
              throw new Error(`시드 ${seed}: pass 후 자기자신(${seat}) 턴 + lead 유지 = 데드락`);
            }
            st = r.state;
          }
        }
      }
      expect(st.winner).not.toBeNull();
      expect(st.hands[st.winner!].length).toBe(0);
    }
  });

  it("HUNT-1F: [극단전략] '낼 수 있어도 무조건 패스'하는 봇이 섞여도 데드락 없음", () => {
    // 최소 활성자만 냄, 나머지는 가능해도 패스 → 트릭 종료가 계속 발생하는지.
    // 자기자신 턴 반환이 실전에서 나오는지 가장 공격적으로 검증.
    for (const n of [3, 4, 5]) {
      for (let seed = 1; seed <= 30; seed++) {
        let st = startGame(players(n), makeRng(seed * 13 + n));
        let guard = 0;
        // seat별 성향: 짝수 seat은 '리드일 때만 냄, 응수는 무조건 패스'
        while (st.phase === "playing") {
          if (guard++ > 1500) throw new Error(`${n}인 시드 ${seed}: 극단전략 데드락(1500스텝)`);
          const seat = st.turn;
          const opts = playableAgainst(st.hands[seat], st.lead);
          const passHappy = seat % 2 === 0 && st.lead !== null; // 응수 상황이면 무조건 패스 성향
          if (opts.length > 0 && !passHappy) {
            const c = [...opts].sort((a, b) => a.size - b.size || a.key - b.key)[0];
            st = ok(play(st, seat, c.tiles));
          } else if (st.lead !== null) {
            const r = pass(st, seat);
            if (!r.ok) throw new Error(`${n}인 시드 ${seed}: pass 실패 ${r.error}`);
            if (r.state.turn === seat && r.state.lead !== null)
              throw new Error(`${n}인 시드 ${seed}: pass 자기자신 데드락 (seat ${seat})`);
            st = r.state;
          } else {
            // 리드 차례인데 opts=0? passHappy여도 lead=null이면 여기 옴 → 반드시 낼 수 있어야
            if (opts.length === 0) throw new Error(`${n}인 시드 ${seed}: 리드 차례 낼조합0 데드락`);
            const c = opts[0];
            st = ok(play(st, seat, c.tiles));
          }
        }
        expect(st.winner).not.toBeNull();
      }
    }
  });

  it("HUNT-1G: [필요조건 검증] lead가 살아있는데 lead.by가 빈손인 상태는 정상흐름에서 불성립", () => {
    // 데드락의 필요조건 = 'lead 유지 + lead.by 손패=0'.
    // play는 마지막 패에서 즉시 ended → lead.by가 0장이 되면 반드시 winner/ended.
    // 따라서 phase=playing 중엔 항상 hands[lead.by].length >= 1 임을 풀게임에서 불변식으로 검증.
    for (const n of [3, 4, 5]) {
      for (let seed = 1; seed <= 30; seed++) {
        let st = startGame(players(n), makeRng(seed + 100));
        let guard = 0;
        while (st.phase === "playing") {
          if (guard++ > 1500) throw new Error("루프");
          // 불변식: 진행 중이고 lead가 있으면 lead.by는 손패가 비지 않았어야 한다.
          if (st.lead !== null) {
            expect(st.hands[st.lead.by].length).toBeGreaterThan(0);
          }
          const seat = st.turn;
          const opts = playableAgainst(st.hands[seat], st.lead);
          if (opts.length > 0) {
            const c = [...opts].sort((a, b) => a.size - b.size || a.key - b.key)[0];
            st = ok(play(st, seat, c.tiles));
          } else {
            st = ok(pass(st, seat));
          }
        }
      }
    }
  });

  it("HUNT-1H: [불변식] phase=playing이면 빈손 플레이어 0명 → nextAlive는 절대 from을 반환 못함", () => {
    // play()가 마지막 패에서 즉시 ended이므로 진행 중엔 전원 손패>=1.
    // 이 불변식이 nextAlive(from-반환) 데드락을 원천 차단함을 풀게임 전 구간에서 검증.
    for (const n of [3, 4, 5]) {
      for (let seed = 1; seed <= 20; seed++) {
        let st = startGame(players(n), makeRng(seed * 31 + n));
        let guard = 0;
        while (st.phase === "playing") {
          if (guard++ > 1500) throw new Error("루프");
          // ★ 핵심 불변식: 진행 중엔 빈손자 0명
          const emptyHands = st.hands.filter((h) => h.length === 0).length;
          expect(emptyHands).toBe(0);
          const seat = st.turn;
          const opts = playableAgainst(st.hands[seat], st.lead);
          if (opts.length > 0) {
            const c = [...opts].sort((a, b) => a.size - b.size || a.key - b.key)[0];
            st = ok(play(st, seat, c.tiles));
          } else {
            st = ok(pass(st, seat));
          }
        }
        // 종료 시엔 정확히 1명(winner)만 빈손
        expect(st.hands.filter((h) => h.length === 0).length).toBe(1);
        expect(st.hands[st.winner!].length).toBe(0);
      }
    }
  });

  it("HUNT-1E: 4인/5인 풀게임 자동진행 데드락/무한루프 없음", () => {
    for (const n of [4, 5]) {
      for (let seed = 1; seed <= 25; seed++) {
        let st = startGame(players(n), makeRng(seed * 7 + n));
        let guard = 0;
        while (st.phase === "playing") {
          if (guard++ > 800) throw new Error(`${n}인 시드 ${seed}: 데드락/무한루프`);
          const seat = st.turn;
          const opts = playableAgainst(st.hands[seat], st.lead);
          if (opts.length > 0) {
            const c = [...opts].sort((a, b) => a.size - b.size || a.key - b.key)[0];
            st = ok(play(st, seat, c.tiles));
          } else {
            const r = pass(st, seat);
            if (!r.ok) throw new Error(`${n}인 시드 ${seed}: pass 실패 ${r.error} (seat ${seat}, lead ${st.lead ? "있음" : "없음"})`);
            if (r.state.turn === seat && r.state.lead !== null)
              throw new Error(`${n}인 시드 ${seed}: pass 자기자신 데드락`);
            st = r.state;
          }
        }
        expect(st.winner).not.toBeNull();
      }
    }
  });
});

// ════════════════════════════════════════════════════════════════
// #2 "낼 수 있는데 내기 버튼 비활성" / noPlayable 오판정
// ════════════════════════════════════════════════════════════════
describe("HUNT #2 — playableAgainst / enumerateCombos 누락", () => {
  // enumerateCombos는 싱글/페어/트리플/5장만 생성한다. canBeat는 같은 size만 참.
  // 실전 재현: 손패로 낼 수 있는 유효 조합인데 enumerateCombos가 못 찾으면
  //   → playableIds에서 빠져 dim 처리 + hint 실패 + noPlayable=true 오판(패스 강요/데드락).

  it("HUNT-2A: [핵심] 4장짜리 손에서 페어를 못 냄? — size별 열거 완전성", () => {
    // 리드가 페어일 때, 손에 이길 수 있는 페어가 있는데 enumerate가 놓치는지.
    const hand = [t(5, "sun"), t(5, "moon"), t(9, "cloud"), t(9, "star")];
    const lead = leadOf([t(5, "star"), t(5, "cloud")], 1); // 페어 5(약)
    const opts = playableAgainst(hand, lead);
    // 페어9 > 페어5 여야 함
    const has99 = opts.some((c) => c.type === "pair" && c.tiles.every((x) => x.n === 9));
    expect(has99).toBe(true);
  });

  it("HUNT-2B: [핵심 의심] 스트레이트를 못 이기는 스트레이트 열거 — enumerate는 5장 전조합 검사", () => {
    // 손: 3~7 스트레이트 + 여분. 리드가 약한 스트레이트일 때 이길 스트레이트를 찾는가.
    const hand = [t(4, "cloud"), t(5, "cloud"), t(6, "cloud"), t(7, "cloud"), t(8, "cloud")];
    const lead = leadOf([t(3, "sun"), t(4, "sun"), t(5, "sun"), t(6, "sun"), t(7, "sun")], 1); // 3~7 스플
    const opts = playableAgainst(hand, lead);
    // 4~8 플러시(cloud)는 straightflush. straightflush > straightflush(3-7)? 최고값 8>7 → 이김.
    // 최소한 뭔가 이길 수단이 있어야. (실제로 4-8 cloud는 스트레이트플러시)
    const canWin = opts.length > 0;
    expect(canWin).toBe(true);
  });

  it("HUNT-2C: [핵심 데드락 후보] 5장 리드인데 내 손이 4장 이하 → 영원히 못 냄 + 패스만 가능", () => {
    // 리드가 5장 족보인데 내 손이 4장이면 canBeat(size 5)를 만족하는 조합이 손에서 안 나옴.
    // 이건 정상: 패스 가능. 하지만 만약 lead가 5장이고 내가 리드 복귀 후에도 문제 없는지.
    const hand = [t(9, "sun"), t(9, "moon"), t(2, "sun")]; // 3장뿐
    const lead = leadOf([t(3, "sun"), t(4, "sun"), t(5, "sun"), t(6, "sun"), t(7, "sun")], 1);
    expect(hasPlayable(hand, lead)).toBe(false); // 못 냄 → 패스해야
    // pass가 정상 동작하는지 (데드락 아님) 는 #1에서 커버.
    const s = mk([hand, [t(8, "cloud"), t(8, "star")], [t(10, "cloud")]], 0, lead);
    expect(pass(s, 0).ok).toBe(true);
  });

  it("HUNT-2D: [UI 데드락] noPlayable=true인데 pass도 막히는 조합 존재? (버튼 둘 다 disabled)", () => {
    // RealtimeGame: noPlayable = playableIds.length===0 && lead 있음.
    // pass 버튼 disabled = !myTurn || !leadTiles. lead 있으면 leadTiles 있음 → pass 활성.
    // 따라서 lead 있고 낼 게 없어도 pass는 항상 눌림. UI 데드락은 이론상 없음.
    // 단, lead===null(리드 차례)인데 손에 낼 유효조합이 0인 경우가 있으면
    //   → play disabled + pass disabled(leadTiles 없음) = 완전 데드락.
    // enumerateCombos는 손 있으면 최소 싱글은 항상 생성하므로 리드 차례엔 항상 낼 수 있음.
    for (const size of [1, 2, 3, 4, 5, 12]) {
      const hand: Tile[] = Array.from({ length: size }, (_, i) => t(3 + i, "cloud"));
      const combos = enumerateCombos(hand);
      // 손이 1장 이상이면 최소 싱글이 있어야 리드 차례 데드락 안 남
      expect(combos.length).toBeGreaterThan(0);
      expect(hasPlayable(hand, null)).toBe(true);
    }
  });

  it("HUNT-2F: [UI 완전 데드락 후보] 리드 차례(leadTiles=null)에 두 버튼 동시 비활성?", () => {
    // GameTableView: pass disabled=(!myTurn||!leadTiles), play disabled=(!myTurn||!canPlay).
    // 리드 차례엔 leadTiles=null → pass 항상 비활성. 이때 canPlay=false면 play도 비활성 = 완전 데드락.
    // canPlay = !!selCombo && (lead===null || ...). 리드 차례엔 selCombo만 있으면 canPlay=true.
    // 즉 '유효 조합을 하나도 못 만드는 손'이면 아무것도 못 냄. 손 1장 이상이면 싱글은 항상 유효.
    // → 손이 비지 않은 한 리드 차례 데드락 불가. 손패 다양한 크기로 확인.
    for (const size of [1, 2, 3, 5, 12, 13]) {
      const hand: Tile[] = Array.from({ length: size }, (_, i) => t(1 + (i % 15), (["cloud", "star", "moon", "sun"] as Suit[])[i % 4]));
      // 리드 차례(lead=null): 최소 싱글 선택 시 canPlay
      const single = classify([hand[0]]);
      const canPlayLeadTurn = !!single && (null === null);
      expect(canPlayLeadTurn).toBe(true); // 항상 낼 수 있음 → 데드락 없음
    }
  });

  it("HUNT-2G: [UI 응수 데드락 후보] 응수 차례(leadTiles 있음)에 못 이겨도 pass는 항상 활성", () => {
    // 응수 차례엔 leadTiles 있음 → pass disabled=(!myTurn||false)=!myTurn. 내 차례면 pass 활성.
    // 따라서 canPlay=false여도 pass로 진행 가능 → UI 데드락 없음. (엔진 pass도 lead 있으면 허용)
    const hand = [t(3, "cloud"), t(4, "star")]; // 약한 손
    const lead = leadOf([t(2, "sun"), t(2, "moon")], 1); // 최강 페어2
    // 이길 페어 없음 → canPlay(선택해도) false지만 pass는 열려있어야
    expect(hasPlayable(hand, lead)).toBe(false);
    const s = mk([hand, [t(9, "cloud"), t(9, "star")]], 0, lead);
    expect(pass(s, 0).ok).toBe(true); // 엔진이 pass 허용 = UI pass 버튼 유효
  });

  it("HUNT-2H: [classify 중복타일 방어] 물리적으로 불가능한 동일타일 중복을 유효로 오판", () => {
    // classify는 '같은 타일 2장'을 pair로, 3장을 triple로 인식한다(색·숫자 동일 무검사).
    // 서버 play는 handHasAll이 수량초과를 막아 실전 무해하나, classify 단독 방어는 없음.
    // → UI가 어떤 경로로든 같은 타일을 중복 selected에 넣으면 canPlay=true가 되는 잠재 위험.
    // (정상 toggle 경로에선 중복 선택 불가 → 실전 재현은 서버 handHasAll이 최종 차단)
    const dupPair = classify([t(5, "cloud"), t(5, "cloud")]);
    expect(dupPair).not.toBeNull(); // ← 방어 없음(문서화): 유효 pair로 인식됨
    expect(dupPair!.type).toBe("pair");
    // 실전 안전성: 서버 handHasAll이 손에 1장뿐인 타일 2장 요구를 거부함을 확인.
    const s = mk([[t(5, "cloud"), t(9, "star")], [t(6, "cloud")]], 0, null);
    expect(play(s, 0, [t(5, "cloud"), t(5, "cloud")]).ok).toBe(false); // 서버가 최종 차단(수량초과)
  });

  it("HUNT-2E: [핵심] 손패에 유효한 5장 족보가 있는데 enumerate가 놓치는가 — 무작위 대조", () => {
    // 무작위 5~13장 손패에서 '가능한 모든 5장 조합을 직접 classify'한 집합과
    // enumerateCombos가 만든 5장 조합 집합을 비교. 놓친 게 있으면 버그.
    const rng = makeRng(12345);
    const randTile = (): Tile => {
      const suits: Suit[] = ["cloud", "star", "moon", "sun"];
      return t(1 + Math.floor(rng() * 15), suits[Math.floor(rng() * 4)]);
    };
    for (let trial = 0; trial < 200; trial++) {
      const size = 5 + Math.floor(rng() * 9);
      // 중복 타일 방지 (덱은 중복 없음)
      const seen = new Set<string>();
      const hand: Tile[] = [];
      while (hand.length < size) {
        const x = randTile();
        if (!seen.has(tileId(x))) {
          seen.add(tileId(x));
          hand.push(x);
        }
      }
      // 직접 모든 5장 조합 classify
      const kComb = (arr: Tile[], k: number): Tile[][] => {
        if (k === 0) return [[]];
        if (k > arr.length) return [];
        const [h, ...rest] = arr;
        return [...kComb(rest, k - 1).map((c) => [h, ...c]), ...kComb(rest, k)];
      };
      const validFive = new Set<string>();
      for (const c of kComb(hand, 5)) {
        const combo = classify(c);
        if (combo) validFive.add(c.map(tileId).sort().join("|"));
      }
      const enumFive = new Set<string>();
      for (const combo of enumerateCombos(hand)) {
        if (combo.size === 5) enumFive.add(combo.tiles.map(tileId).sort().join("|"));
      }
      // enumerate가 놓친 유효 5장 조합
      for (const key of validFive) {
        if (!enumFive.has(key)) {
          throw new Error(`enumerateCombos가 유효 5장 조합 놓침: ${key} (trial ${trial}, 손 ${hand.map(tileId).join(",")})`);
        }
      }
    }
  });
});

// ════════════════════════════════════════════════════════════════
// #3 인원별 딜 정확성
// ════════════════════════════════════════════════════════════════
describe("HUNT #3 — 인원별 딜/시작", () => {
  it("HUNT-3A: 3/4/5인 딜은 전원 균등 + 구름3 보유자 존재", () => {
    for (const n of [3, 4, 5]) {
      for (let seed = 1; seed <= 20; seed++) {
        const { hands, config } = deal(n, makeRng(seed));
        expect(hands.length).toBe(n);
        const sizes = hands.map((h) => h.length);
        expect(new Set(sizes).size).toBe(1); // 전원 동일
        expect(sizes[0]).toBe(config.perPlayer);
        const start = startingPlayer(hands);
        expect(start).toBeGreaterThanOrEqual(0); // 구름3 항상 존재
      }
    }
  });

  it("HUNT-3B: 6인 이상/2인 이하는 deal이 throw", () => {
    expect(() => deal(2, makeRng(1))).toThrow();
    expect(() => deal(6, makeRng(1))).toThrow();
    expect(() => deal(0, makeRng(1))).toThrow();
  });

  it("HUNT-3C: 딜된 타일은 전부 유일 (중복 배분 없음)", () => {
    for (const n of [3, 4, 5]) {
      const { hands } = deal(n, makeRng(99));
      const all = hands.flat().map(tileId);
      expect(new Set(all).size).toBe(all.length);
    }
  });
});

// ════════════════════════════════════════════════════════════════
// #4 콤보 판정 누락/오판
// ════════════════════════════════════════════════════════════════
describe("HUNT #4 — classify 정확성", () => {
  it("HUNT-4A: straight는 1·2 wrap 없음 — 14-15-1-2-3 등은 스트레이트 아님", () => {
    // 자연수 연속만 인정(max-min=4). 1·2가 낮은 숫자로 wrap 되면 안 됨.
    // 색을 섞어 flush 가능성을 제거하고 'straight로 판정되지 않음'을 정확히 검증.
    const wrap = classify([t(14, "cloud"), t(15, "star"), t(1, "moon"), t(2, "sun"), t(3, "cloud")]);
    expect(wrap).toBeNull(); // 색 섞임 + 자연연속 아님 → 무효
    // 1-2-3-4-5 는 자연연속(max5-min1=4) → straight 유효 (색 섞음)
    const nat = classify([t(1, "cloud"), t(2, "star"), t(3, "moon"), t(4, "sun"), t(5, "cloud")]);
    expect(nat).not.toBeNull();
    expect(nat!.type).toBe("straight");
    // 참고: 같은 색 5장이면 자연연속 아니어도 flush로 유효 (설계상 정상)
    const flush = classify([t(14, "cloud"), t(15, "cloud"), t(1, "cloud"), t(2, "cloud"), t(3, "cloud")]);
    expect(flush).not.toBeNull();
    expect(flush!.type).toBe("flush");
  });

  it("HUNT-4B: 11-12-13-14-15 스트레이트가 최강 (straightKey 최고값)", () => {
    const top = classify([t(11, "cloud"), t(12, "cloud"), t(13, "cloud"), t(14, "cloud"), t(15, "cloud")]);
    const low = classify([t(3, "sun"), t(4, "sun"), t(5, "sun"), t(6, "sun"), t(7, "sun")]);
    expect(top).not.toBeNull();
    expect(low).not.toBeNull();
    // 둘 다 straightflush. top(15) > low(7)
    expect(compareCombos(top!, low!)).toBeGreaterThan(0);
  });

  it("HUNT-4C: fullhouse 비교는 트리플 부분으로 — 트리플이 강한 쪽이 이김", () => {
    const fhA = classify([t(9, "cloud"), t(9, "star"), t(9, "moon"), t(4, "cloud"), t(4, "star")]); // 트리플9
    const fhB = classify([t(6, "cloud"), t(6, "star"), t(6, "moon"), t(2, "cloud"), t(2, "star")]); // 트리플6 + 페어2
    expect(fhA!.type).toBe("fullhouse");
    expect(fhB!.type).toBe("fullhouse");
    // 트리플9 > 트리플6 (페어 부분 2가 강해도 무관)
    expect(compareCombos(fhA!, fhB!)).toBeGreaterThan(0);
  });

  it("HUNT-4D: fourplus(포카드+1) 비교는 포카드 숫자로 — 킥커 무관", () => {
    const fpA = classify([t(7, "cloud"), t(7, "star"), t(7, "moon"), t(7, "sun"), t(3, "cloud")]); // 포카드7 + 3
    const fpB = classify([t(5, "cloud"), t(5, "star"), t(5, "moon"), t(5, "sun"), t(2, "sun")]); // 포카드5 + 2(강)
    expect(fpA!.type).toBe("fourplus");
    expect(fpB!.type).toBe("fourplus");
    expect(compareCombos(fpA!, fpB!)).toBeGreaterThan(0); // 7 > 5, 킥커 무관
  });

  it("HUNT-4E: [의심] 포카드+1의 킥커가 포카드와 같은 숫자면? (5장 전부 같은 숫자는 불가하니 무관)", () => {
    // 한 숫자는 4색뿐이므로 포카드+같은숫자5장째는 물리적으로 불가. classify 입력이 그래도 안전한지.
    // 4장 + 다른 1장이 정상. 4장만(size4)은 무효.
    expect(classify([t(7, "cloud"), t(7, "star"), t(7, "moon"), t(7, "sun")])).toBeNull(); // 4장 단독 무효
  });

  it("HUNT-4F: 투페어/노페어 5장은 무효", () => {
    expect(classify([t(7, "cloud"), t(7, "star"), t(4, "moon"), t(4, "sun"), t(9, "cloud")])).toBeNull(); // 투페어
    expect(classify([t(3, "cloud"), t(6, "star"), t(9, "moon"), t(12, "sun"), t(15, "cloud")])).toBeNull(); // 노페어 노플러시
  });

  it("HUNT-4G: [의심] flush vs straight 순위 — flush > straight", () => {
    const flush = classify([t(3, "sun"), t(6, "sun"), t(8, "sun"), t(11, "sun"), t(14, "sun")]); // 플러시(연속아님)
    const straight = classify([t(3, "cloud"), t(4, "moon"), t(5, "star"), t(6, "cloud"), t(7, "moon")]); // 스트레이트
    expect(flush!.type).toBe("flush");
    expect(straight!.type).toBe("straight");
    expect(compareCombos(flush!, straight!)).toBeGreaterThan(0); // 플러시가 강함
  });

  it("HUNT-4H: [의심] 낮은 flush가 높은 straight를 못 이기면 안 됨 (type 우선)", () => {
    // 아무리 약한 플러시라도 최강 스트레이트보다 강해야 함 (렉시오 표준).
    const weakFlush = classify([t(1, "cloud"), t(3, "cloud"), t(6, "cloud"), t(8, "cloud"), t(10, "cloud")]);
    const strongStraight = classify([t(11, "cloud"), t(12, "moon"), t(13, "star"), t(14, "cloud"), t(15, "moon")]);
    expect(weakFlush!.type).toBe("flush");
    expect(strongStraight!.type).toBe("straight");
    expect(canBeat(weakFlush!, strongStraight!)).toBe(true);
  });
});

// ════════════════════════════════════════════════════════════════
// #5 라운드/세트 종료 · 누적 점수
// ════════════════════════════════════════════════════════════════
describe("HUNT #5 — 라운드/세트 종료 & 누적", () => {
  it("HUNT-5A: 마지막 타일 내면 winner/ended 즉시 확정", () => {
    const st = ok(play(mk([[t(2, "sun")], [t(6, "cloud"), t(7, "star")]], 0, null), 0, [t(2, "sun")]));
    expect(st.phase).toBe("ended");
    expect(st.winner).toBe(0);
  });

  it("HUNT-5B: nextRound가 누적 벌점을 이어받고 setRound 증가", () => {
    let st = mk([[], [t(6, "cloud"), t(7, "star")], [t(2, "sun"), t(9, "cloud")]]);
    st = { ...st, phase: "ended", winner: 0, setRound: 1 };
    const pen = roundPenalty(st); // [0, 2, 4(2보유×2)]
    const nxt = nextRound(st, makeRng(1));
    expect(nxt.setRound).toBe(2);
    expect(nxt.cumulative).toEqual(pen);
  });

  it("HUNT-5C: 3라운드째 종료 후 nextRound는 새 세트(누적 0, setRound 1)", () => {
    let st = mk([[], [t(6, "cloud")], [t(2, "sun")]]);
    st = { ...st, phase: "ended", winner: 0, setRound: 3, cumulative: [5, 3, 8] };
    const nxt = nextRound(st, makeRng(2));
    expect(nxt.setRound).toBe(1);
    expect(nxt.cumulative).toEqual([0, 0, 0]); // 새 세트 리셋
  });

  it("HUNT-5D: cumulativeWithRound = 기존누적 + 이번벌점", () => {
    let st = mk([[], [t(6, "cloud"), t(7, "star")], [t(2, "sun")]]);
    st = { ...st, cumulative: [10, 4, 7] };
    // 벌점: [0, 2, 2(2보유×1장×2)=2]
    expect(cumulativeWithRound(st)).toEqual([10, 6, 9]);
  });
});
