/**
 * @QA실행자 — /gung 최종 회귀(3차) · 이번 수정 핵심을 **엔진 레벨에서 독립 재확인**.
 * 기존 테스트(qa-engine·round-lock·pm-decisions)의 픽스처·코드 탐색식을 쓰지 않고, 시드 난수로 판을 새로 뽑아 본다.
 *
 *  (c) 자리 비우기·되돌리기 — 진상 전 방장 상태 전이는 범인 자리와 무관하다(같은 조작열 → 범인 자리만 다른 두 판의 상태가 같다).
 *      비우기 → ↶ 왕복을 몇 번 하든 상태가 그대로 돌아온다(타이머는 '멈춤 복원' 규약대로).
 *  (d) R3 전 기억 비노출 · R3 후 노출 — 4·5·6인 × 모든 역할 × 라운드 0..3. 4·5인의 같은 정보(NPC 진술 ③)도 R3 전엔 어디에도 없다.
 *  (e) 결과 공유 — 문구·URL·카카오 템플릿·OG 파라미터에 범인(역할명·자리)·방 코드·시드·사건 표식이 없다(무작위 판 전수).
 */
import { describe, expect, it } from 'vitest';
import { sejaCase as c } from './case-data';
import {
  applyAction,
  assignFromCode,
  castFor,
  caseTag,
  formatRoomCode,
  gateTimeline,
  getClue,
  getSheet,
  hash32,
  HISTORY_LIMIT,
  makeRng,
  newHostGame,
  ogResultUrl,
  parseOgResultParams,
  PHASES,
  publicBoardUpTo,
  reachedRound,
  resolveBriefing,
  resolveVerdict,
  resultOf,
  resultPayload,
  resultShareInput,
  roundPlaces,
  SEED_ALPHABET,
  sharedTerms,
  timeTable,
  toOgParams,
  activeSeats,
  type GameAction,
  type GameState,
  type Phase,
  type PlayerCount,
  type RoundNo,
} from './index';

const T0 = Date.UTC(2026, 9, 2, 12, 0, 0);
const NS: PlayerCount[] = [4, 5, 6];

/** 시드 난수로 코드 뽑기(기존 테스트의 탐색식과 다른 경로) */
function codeStream(n: PlayerCount, salt: string): () => string {
  const rng = makeRng(hash32(`final-regression:${salt}:${n}`));
  return () => {
    let s = '';
    for (let i = 0; i < 4; i++) s += SEED_ALPHABET[Math.floor(rng() * SEED_ALPHABET.length)];
    return `${s}${n}`;
  };
}
function findCode(n: PlayerCount, salt: string, pred: (code: string) => boolean): string {
  const next = codeStream(n, salt);
  for (let i = 0; i < 50_000; i++) {
    const code = next();
    if (pred(code)) return code;
  }
  throw new Error(`no code ${n} ${salt}`);
}
const asg = (code: string) => assignFromCode(c, code)!;

/** 사건의 모든 역할 이름(NPC 포함) — 공유물에 하나라도 있으면 스포일러 */
const ROLE_WORDS = [...new Set(c.roles.flatMap((r) => [r.name, r.shortName ?? r.name]))];

/** 기억(라운드 잠금 블록) 본문 전부 — 기본·인원별·범인 덮어쓰기 포함 */
function memoryLinesOf(roleId: string): string[] {
  const r = c.roles.find((x) => x.id === roleId)!;
  const blocks = [r.memories, ...Object.values(r.byCount ?? {}).map((o) => o?.memories), r.asCulprit?.memories];
  return blocks.flatMap((list) => (list ?? []).flatMap((m) => m.lines));
}
const ALL_MEMORY_LINES = c.roles.flatMap((r) => memoryLinesOf(r.id));
/** R3 NPC 진술(4·5인 판에서 기억과 같은 정보를 공용으로 주는 카드) */
const R3_NPC = c.rounds.find((r) => r.no === 3)!.npcCards ?? [];

/** 긴 문장을 12자 창으로 잘라 탐침 — 띄어쓰기·문장부호가 달라도 한 조각이면 걸린다 */
function windows(text: string, size = 12, step = 6): string[] {
  const out: string[] = [];
  for (let i = 0; i + size <= text.length; i += step) out.push(text.slice(i, i + size));
  if (text.length < size) out.push(text);
  return out;
}

// ═══════════════════════════════ (c) 자리 비우기·되돌리기 ═══════════════════════════════

/** 진상 전 방장 조작 무작위 생성기 — 진상·결과로 가는 조작은 만들지 않는다 */
function randomPreRevealAction(rng: () => number, s: GameState, n: number): GameAction {
  const seat = () => 1 + Math.floor(rng() * n);
  const pre: Phase[] = PHASES.filter((p) => p !== 'reveal' && p !== 'result');
  const r = rng();
  if (r < 0.22) return { type: 'advance' };
  if (r < 0.32) return { type: 'undo' };
  if (r < 0.44) return { type: 'setAbsent', seat: 2 + Math.floor(rng() * (n - 1)), absent: true };
  if (r < 0.58) return { type: 'ballot', voter: seat(), target: seat() };
  if (r < 0.62) return { type: 'clearBallot', voter: seat() };
  if (r < 0.66) return { type: 'startRevote' };
  if (r < 0.7) return { type: 'timer', op: (['pause', 'resume', 'add30', 'restart'] as const)[Math.floor(rng() * 4)] };
  if (r < 0.74) return { type: 'introNext' };
  if (r < 0.77) return { type: 'introSet', seat: seat() };
  if (r < 0.8) return { type: 'rollCall', seat: seat() };
  if (r < 0.84) return { type: 'bonusAnswer', seat: seat(), questionId: c.bonusQuestions?.[0]?.id ?? 'q1', option: Math.floor(rng() * 4) };
  if (r < 0.9) return { type: 'syncPhase', phase: pre[Math.floor(rng() * pre.length)] };
  const round = (1 + Math.floor(rng() * 3)) as RoundNo;
  const places = roundPlaces(c, round);
  if (r < 0.95) return { type: 'pickPlace', round, placeId: places[Math.floor(rng() * places.length)].id };
  void s;
  return { type: 'openClue', round };
}

/** 코드만 지운 상태 문자열(코드는 판마다 다르므로) */
const project = (s: GameState) => JSON.stringify({ ...s, code: '‹CODE›' });

describe('(c) 자리 비우기·되돌리기 — 진상 전 방장 상태는 범인 자리와 무관', () => {
  for (const n of NS) {
    it(`${n}인: 같은 조작열(비우기·↶·지목·재지목·단계 맞추기 섞음 400판 × 60수)을 범인 자리만 다른 판들에 넣으면 진상 전까지 상태가 매 수 같다`, () => {
      // 같은 인원·같은 방장 역할(중전)에서 범인 자리 2..n 을 하나씩 가진 판 — 범인 자리만 다르다
      const codes = Array.from({ length: n - 1 }, (_, i) =>
        findCode(n, `c-${i}`, (k) => asg(k).culpritSeat === i + 2 && asg(k).seats[0] === 'queen'),
      );
      expect(new Set(codes.map((k) => asg(k).culpritSeat)).size).toBe(n - 1);
      const rng = makeRng(hash32(`c-actions-${n}`));
      let compared = 0;
      for (let game = 0; game < 400; game++) {
        let states = codes.map((k) => newHostGame(c, k, T0)!);
        let now = T0;
        for (let step = 0; step < 60; step++) {
          const act = randomPreRevealAction(rng, states[0], n);
          now += 1000;
          const next = states.map((s) => applyAction(s, act, { c, now }));
          if (next.some((s) => s.phase === 'reveal' || s.phase === 'result')) {
            // 진상에 들어서는 수 자체도 범인과 무관해야 한다(모두 같이 들어선다)
            expect(next.every((s) => s.phase === next[0].phase)).toBe(true);
            break;
          }
          states = next;
          const base = project(states[0]);
          for (const s of states.slice(1)) expect(project(s)).toBe(base);
          compared++;
        }
      }
      expect(compared).toBeGreaterThan(5_000);
    });
  }

  it('지목 판정 — 범인 자리에 따라 달라지는 건 caught 하나뿐(4·5·6인 × 무작위 표 6,000판 × 모든 범인 자리 × 이탈 0~1)', () => {
    const rng = makeRng(hash32('c-verdict'));
    for (const n of NS) {
      for (let i = 0; i < 2_000; i++) {
        const absent = rng() < 0.4 ? [2 + Math.floor(rng() * (n - 1))] : [];
        const active = activeSeats(n, absent);
        const first: Record<number, number> = {};
        for (const v of active) if (rng() < 0.92) first[v] = active[Math.floor(rng() * active.length)];
        const top = Object.values(first);
        const revote = rng() < 0.5 && top.length ? { candidates: active.slice(0, 2 + Math.floor(rng() * 2)), ballots: {} as Record<number, number> } : undefined;
        if (revote) for (const v of active) if (rng() < 0.9) revote.ballots[v] = revote.candidates[Math.floor(rng() * revote.candidates.length)];
        const vote = { sub: 'tally' as const, first, revote };
        const views = Array.from({ length: n }, (_, k) => {
          const { caught: _caught, ...rest } = resolveVerdict(vote, active, k + 1);
          void _caught;
          return JSON.stringify(rest);
        });
        expect(new Set(views).size).toBe(1);
      }
    }
  });

  it('비우기 → ↶ 왕복(자리 2..n × 3회)은 상태를 그대로 돌린다 — 되돌리기 스택 길이·비운 자리·지목·변론 순서 모두(타이머만 멈춤 복원)', () => {
    const rng = makeRng(hash32('c-roundtrip'));
    let checked = 0;
    for (const n of NS) {
      const code = findCode(n, 'c-rt', () => true);
      for (let game = 0; game < 60; game++) {
        let s = newHostGame(c, code, T0)!;
        let now = T0;
        const steps = 5 + Math.floor(rng() * 40);
        for (let i = 0; i < steps; i++) {
          const act = randomPreRevealAction(rng, s, n);
          const nx = applyAction(s, act, { c, now: (now += 1000) });
          if (nx.phase === 'reveal' || nx.phase === 'result') break;
          s = nx;
        }
        // 되돌리기 스택은 최대 HISTORY_LIMIT — 꽉 찬 상태면 비우기가 가장 오래된 기록을 밀어내므로(설계) 스택 비교는 그 미만에서만
        // 타이머: ↶ 은 '멈춤 상태로 복원'(설계) — 그사이 흐른 시간만큼 남은 시간이 줄어드는 건 정상이라 종류·총길이만 본다
        const strip = (x: GameState) =>
          JSON.stringify({
            ...x,
            updatedAt: 0,
            host: { ...x.host!, history: [], timer: x.host!.timer ? { kind: x.host!.timer.kind, totalMs: x.host!.timer.totalMs } : null },
          });
        const before = strip(s);
        const hist = s.host!.history.length;
        const histJson = JSON.stringify(s.host!.history);
        for (let rep = 0; rep < 3; rep++) {
          for (let seat = 2; seat <= n; seat++) {
            if (s.host!.absentSeats.includes(seat)) continue;
            const gone = applyAction(s, { type: 'setAbsent', seat, absent: true }, { c, now: (now += 1000) });
            expect(gone.host!.absentSeats).toContain(seat);
            const back = applyAction(gone, { type: 'undo' }, { c, now: (now += 1000) });
            expect(strip(back)).toBe(before);
            expect(back.host!.absentSeats).toEqual(s.host!.absentSeats);
            if (hist < HISTORY_LIMIT) {
              expect(gone.host!.history.length).toBe(hist + 1);
              expect(JSON.stringify(back.host!.history)).toBe(histJson);
            }
            s = back;
            checked++;
          }
        }
      }
    }
    expect(checked).toBeGreaterThan(500);
  });

  it('범인 자리를 비운 판은 진상 뒤 결과에서만 culpritAbsent·판결 없음 — 무고 자리를 비운 같은 조작은 정상 판결', () => {
    for (const n of NS) {
      const code = findCode(n, 'c-res', (k) => asg(k).culpritSeat >= 2);
      const a = asg(code);
      for (let seat = 2; seat <= n; seat++) {
        let s = newHostGame(c, code, T0)!;
        let now = T0;
        const go = (act: GameAction) => (s = applyAction(s, act, { c, now: (now += 1000) }));
        go({ type: 'syncPhase', phase: 'vote' });
        go({ type: 'setAbsent', seat, absent: true });
        go({ type: 'advance' }); // ready → input
        const active = activeSeats(n, [seat]);
        const target = active.find((x) => x !== 1)!;
        for (const v of active) go({ type: 'ballot', voter: v, target: v === target ? 1 : target });
        go({ type: 'advance' }); // tally → reveal
        expect(s.phase).toBe('reveal');
        const r = resultOf(c, s)!;
        expect(r.culpritAbsent).toBe(seat === a.culpritSeat);
        expect(r.decided).toBe(seat !== a.culpritSeat);
      }
    }
  });
});

// ═══════════════════════════════ (d) R3 전 기억 비노출 ═══════════════════════════════

describe('(d) 라운드 잠금 — R3 전 기억 비노출 · R3 후 노출 (4·5·6인 × 모든 역할)', () => {
  it('탐침 유효성: 이 사건엔 R3 기억이 있다(조상궁·세자빈) · R3 NPC 진술(5C·6C)이 있다', () => {
    expect(memoryLinesOf('courtLady').length).toBeGreaterThan(0);
    expect(memoryLinesOf('crownPrincess').length).toBeGreaterThan(0);
    expect(R3_NPC.map((x) => x.id).sort()).toEqual(['NPC-5C', 'NPC-6C']);
    const rounds = c.roles.flatMap((r) => (r.memories ?? []).map((m) => m.fromRound));
    expect(rounds.every((x) => x === 3)).toBe(true);
  });

  for (const n of NS) {
    it(`${n}인: 모든 역할 × 모든 자리 × 범인/무고 — 라운드 0·1·2 패엔 기억 본문 0, 라운드 3엔 자기 기억만 전부`, () => {
      for (const role of castFor(c, n)) {
        for (let seat = 1; seat <= n; seat++) {
          const code = findCode(n, `d-${role}-${seat}`, (k) => asg(k).seats[seat - 1] === role);
          const a = asg(code);
          const mine = memoryLinesOf(role);
          const others = ALL_MEMORY_LINES.filter((l) => !mine.includes(l));
          for (const r of [0, 1, 2] as const) {
            const json = JSON.stringify(getSheet(c, a, seat, r));
            const leaked = ALL_MEMORY_LINES.filter((l) => json.includes(l) || windows(l).some((w) => json.includes(w)));
            expect(leaked, `${n}인 ${role}@${seat} r${r}`).toEqual([]);
            // 잠긴 블록은 제목·라운드만 — lines 키 자체가 없다
            for (const m of getSheet(c, a, seat, r)!.memories) {
              expect(m.unlocked).toBe(false);
              expect('lines' in m).toBe(false);
            }
          }
          const json3 = JSON.stringify(getSheet(c, a, seat, 3));
          for (const l of mine) expect(json3, `${n}인 ${role}@${seat} r3 자기 기억`).toContain(l);
          for (const l of others) expect(json3, `${n}인 ${role}@${seat} r3 남의 기억`).not.toContain(l);
        }
      }
    });

    it(`${n}인: R3 전에 보이는 모든 것(브리핑·시각표·용어·공용/NPC 카드·출입 타임라인·라운드 1·2 장소 카드 전부)에 R3 기억·R3 NPC 진술 조각이 없다`, () => {
      const code = findCode(n, `d-pub`, () => true);
      const a = asg(code);
      // 같은 화자의 R1·R2 진술에 이미 있는 머리말(「해시 정, 빈궁마마를 모시고 중궁전…」 — NPC-5A)은 R3 정보가 아니다.
      // 그 조각만 빼고, R3 에서만 나오는 사실은 따로 손으로 고른 핵심 탐침(KEY_R3)으로도 본다.
      const earlierSameSpeaker = c.rounds
        .filter((rd) => rd.no < 3)
        .flatMap((rd) => rd.npcCards ?? [])
        .filter((card) => R3_NPC.some((x) => x.roleId === card.roleId))
        .map((card) => card.body)
        .join('\n');
      const probes = [...ALL_MEMORY_LINES, ...R3_NPC.map((x) => x.body)].flatMap((t) => windows(t)).filter((w) => !earlierSameSpeaker.includes(w));
      expect(probes.length).toBeGreaterThan(20);
      const KEY_R3 = ['차 한 잔 식을 동안', '연분홍 노리개', '나비매듭이 아니라 외매듭', '동온돌로 건너'];
      const r3Text = [...ALL_MEMORY_LINES, ...R3_NPC.map((x) => x.body)].join('\n');
      for (const k of KEY_R3) expect(r3Text, `탐침 유효성 ${k}`).toContain(k);
      for (const r of [0, 1, 2] as const) {
        const visible: unknown[] = [
          resolveBriefing(c, n),
          timeTable(c),
          sharedTerms(c, n, r),
          publicBoardUpTo(c, n, r),
          gateTimeline(c, n, ([1, 2] as RoundNo[]).filter((x) => x <= r)),
        ];
        for (const round of ([1, 2] as RoundNo[]).filter((x) => x <= r)) {
          for (const p of roundPlaces(c, round)) for (let seat = 1; seat <= n; seat++) visible.push(getClue(c, a, round, p.id, seat));
        }
        const blob = JSON.stringify(visible);
        const hit = probes.filter((p) => blob.includes(p));
        expect(hit, `${n}인 r${r}`).toEqual([]);
        expect(KEY_R3.filter((k) => blob.includes(k)), `${n}인 r${r} 핵심 사실`).toEqual([]);
        // R3 공용·NPC 카드는 목록에 없다
        expect(publicBoardUpTo(c, n, r).some((x) => x.round === 3)).toBe(false);
        const tl = gateTimeline(c, n, ([1, 2] as RoundNo[]).filter((x) => x <= r));
        expect((tl?.marks ?? []).some((m) => m.round === 3)).toBe(false);
      }
      // R3 에 들어서면 — 4인은 5C·6C, 5인은 6C(세자빈이 NPC), 6인은 NPC 없음(기억으로 대신)
      const ids3 = publicBoardUpTo(c, n, 3).map((x) => x.id);
      // 정보 동등성(핵심 사실): R3 공용 보드 + 그 판 플레이어들의 R3 패를 합치면 핵심 사실이 전부 나온다
      const r3All = JSON.stringify(publicBoardUpTo(c, n, 3)) + JSON.stringify(a.seats.map((_, i) => getSheet(c, a, i + 1, 3)));
      for (const k of KEY_R3) expect(r3All, `${n}인 r3 ${k}`).toContain(k);
      const expectNpc = n === 4 ? ['NPC-5C', 'NPC-6C'] : n === 5 ? ['NPC-6C'] : [];
      expect(ids3.filter((id) => id.endsWith('C') && id.startsWith('NPC')).sort()).toEqual(expectNpc);
      // 정보 동등성: R3 진술의 주인이 플레이어면 기억으로, NPC 면 공용 진술로 — 어느 쪽이든 R3 에서만
      for (const card of R3_NPC) {
        const isPlayer = castFor(c, n).includes(card.roleId);
        expect(ids3.includes(card.id)).toBe(!isPlayer);
        if (isPlayer) expect(memoryLinesOf(card.roleId).length).toBeGreaterThan(0);
      }
    });
  }

  it('조사 3 장소는 R3 전엔 고를 수 없다(엔진이 거절) — 4·5·6인 × 조사 전·1·2 단계', () => {
    for (const n of NS) {
      const code = findCode(n, 'd-pick', () => true);
      for (const phase of ['lobby', 'briefing', 'cards', 'intro', 'r1', 'r2'] as Phase[]) {
        const s0 = newHostGame(c, code, T0)!;
        const s = applyAction(s0, { type: 'syncPhase', phase }, { c, now: T0 + 1000 });
        expect(reachedRound(s.phase)).toBeLessThan(3);
        for (const p of roundPlaces(c, 3)) {
          const t = applyAction(s, { type: 'pickPlace', round: 3, placeId: p.id }, { c, now: T0 + 2000 });
          expect(t).toBe(s);
        }
      }
    }
  });
});

// ═══════════════════════════════ (e) 결과 공유 ═══════════════════════════════

/** 무작위 한 판을 진행해 결과 화면 상태로 — 이탈 0~2(범인 자리 포함 가능), 동률·재지목 섞음 */
function playRandomGame(code: string, rng: () => number): GameState {
  const n = asg(code).n;
  let s = newHostGame(c, code, T0)!;
  let now = T0;
  const go = (act: GameAction) => (s = applyAction(s, act, { c, now: (now += 30_000 + Math.floor(rng() * 400_000)) }));
  go({ type: 'advance' }); // lobby → briefing (startedAt)
  go({ type: 'syncPhase', phase: 'vote' });
  const absentCount = Math.floor(rng() * 3);
  for (let i = 0; i < absentCount; i++) go({ type: 'setAbsent', seat: 2 + Math.floor(rng() * (n - 1)), absent: true });
  go({ type: 'advance' }); // ready → input
  const active = activeSeats(n, s.host!.absentSeats);
  for (const v of active) {
    const opts = active.filter((x) => x !== v);
    if (opts.length) go({ type: 'ballot', voter: v, target: opts[Math.floor(rng() * opts.length)] });
  }
  if (s.host!.vote?.sub === 'tally') {
    const v = resolveVerdict(s.host!.vote, active, asg(code).culpritSeat);
    if (v.stage === 'needsRevote') {
      go({ type: 'startRevote' });
      const cands = s.host!.vote!.revote!.candidates;
      for (const voter of active) {
        const opts = cands.filter((x) => x !== voter);
        if (opts.length) go({ type: 'ballot', voter, target: opts[Math.floor(rng() * opts.length)] });
      }
    }
  }
  for (let i = 0; i < 20 && s.phase !== 'result'; i++) go({ type: 'advance' });
  if (s.phase !== 'result') go({ type: 'syncPhase', phase: 'result' });
  return s;
}

describe('(e) 결과 공유 — 범인·방 코드 비노출', () => {
  it('resultShareInput 은 숫자·불리언 7키뿐 — 범인 자리·역할·코드가 들어갈 자리가 없다', () => {
    const code = findCode(5, 'e-keys', () => true);
    const s = playRandomGame(code, makeRng(1));
    const r = resultOf(c, s)!;
    const input = resultShareInput(r, 5, '20261002');
    expect(Object.keys(input).sort()).toEqual(['caught', 'date', 'hits', 'judges', 'minutes', 'n', 'revoted']);
  });

  for (const n of NS) {
    it(`${n}인 무작위 1,500판: 판결이 난 판의 공유 문구·URL·카카오 템플릿·OG 쿼리에 역할명·범인 자리·코드·시드·표식이 없다`, () => {
      const rng = makeRng(hash32(`e-games-${n}`));
      const next = codeStream(n, 'e-games');
      let decided = 0;
      let undecided = 0;
      const outcomes = new Set<string>();
      for (let g = 0; g < 1_500; g++) {
        const code = next();
        const a = asg(code);
        const s = playRandomGame(code, rng);
        expect(s.phase).toBe('result');
        const r = resultOf(c, s)!;
        if (!r.decided) {
          undecided++;
          continue; // 화면이 공유를 막는다(UI 테스트에서 확인)
        }
        decided++;
        outcomes.add(`${r.caught}|${r.revoted}`);
        const input = resultShareInput(r, n, '20261002');
        for (const origin of ['https://project-orsrw.vercel.app', 'http://localhost:3000', `https://example.com/?code=${code}`.replace(/\?.*$/, '')]) {
          const p = resultPayload({ ...input, origin });
          const og = ogResultUrl(input);
          const ogLocal = ogResultUrl({ ...input, imageOrigin: origin });
          const blob = JSON.stringify(p) + og + ogLocal;
          const forbidden = [
            ...ROLE_WORDS,
            code,
            formatRoomCode(code),
            code.slice(0, 4),
            caseTag(code),
            `${r.culpritSeat}번`,
            'code=',
            'as=host',
          ];
          const leaked = forbidden.filter((w) => blob.includes(w));
          expect(leaked, `${code} 범인 ${a.culpritSeat}번`).toEqual([]);
          expect(blob).not.toMatch(/\d+\s*번/);
          // 링크는 전부 홈(쿼리 없음)
          for (const u of [p.url, p.kakao.content.link.webUrl, p.kakao.content.link.mobileWebUrl, ...p.kakao.buttons.flatMap((b) => [b.link.webUrl, b.link.mobileWebUrl])]) {
            expect(new URL(u).search).toBe('');
            expect(new URL(u).pathname).toBe('/gung');
          }
          // OG 쿼리 = 정확히 7키, 전부 숫자/열거형, 왕복 파싱 일치
          for (const u of [og, ogLocal, p.kakao.content.imageUrl]) {
            const q = new URL(u).searchParams;
            expect([...q.keys()].sort()).toEqual(['d', 'h', 'j', 'm', 'n', 'o', 'r']);
            for (const [k, v] of q) expect(v, k).toMatch(k === 'o' ? /^[ce]$/ : /^\d+$/);
            expect(parseOgResultParams(q)).toEqual(toOgParams(input));
          }
        }
      }
      expect(decided).toBeGreaterThan(300);
      expect(undecided).toBeGreaterThan(0); // 범인 자리 비움 판도 섞였다(탐침 유효성)
      expect(outcomes.size).toBeGreaterThanOrEqual(3); // 검거·도주·재지목 섞임
    });
  }
});
