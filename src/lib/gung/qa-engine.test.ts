/**
 * @QA실행자 — 엔진 레벨(U) 신규 케이스. 설계서 docs/qa/gung-test-plan.md §3·§8-1 의 U 항목.
 *
 * 실데이터(sejaCase) + 고정/전수 코드로만 검사한다. 기대값은 원고 표(8-1·8-2)를 상수로 옮겨 독립 오라클로 대조한다
 * (엔진 구현을 그대로 베끼지 않는다).
 *
 * 케이스 ID 는 설계서와 같다. 버그 재현(BUG-xx)은 수정 후 초록이어야 하는 "기대 동작"으로 적었다.
 */
import fs from 'node:fs';
import path from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { sejaCase as c } from './case-data';
import {
  activeSeats,
  applyAction,
  assignFromCode,
  assignSeats,
  buildOgResultQuery,
  CODE_RE,
  caseTag,
  computeResult,
  decideEntry,
  DISCLOSE_UNDO_MS,
  extractRoomCode,
  formatRoomCode,
  generateRoomCode,
  genericPayload,
  getClue,
  getSheet,
  loadGame,
  makeRng,
  memoryStorage,
  newHostGame,
  newPlayerGame,
  normalizeCode,
  parseEntryParams,
  parseRoomCode,
  PHASES,
  resolveVerdict,
  resultOf,
  resultPayload,
  resultShareInput,
  revealBeats,
  roleAtSeat,
  saveGame,
  seatOfRole,
  SEED_ALPHABET,
  STORAGE_KEYS,
  toOgParams,
  verdictHeadline,
  type GameAction,
  type GameState,
  type PlayerCount,
  type RoomCode,
} from './index';

const T0 = Date.UTC(2026, 9, 2, 12, 0, 0);
const A = SEED_ALPHABET;
const COUNTS: PlayerCount[] = [4, 5, 6];

/** i 번째 시드(0 ≤ i < 31⁴) — 전수 순회용 */
const seedAt = (i: number) => A[i % 31] + A[Math.floor(i / 31) % 31] + A[Math.floor(i / 961) % 31] + A[Math.floor(i / 29791) % 31];
const SEED_SPACE = 31 ** 4;

function roomOf(seed: string, n: PlayerCount): RoomCode {
  return { code: seed + n, seed, n, display: `${seed}-${n}`, tag: '' };
}

/** 조건을 만족하는 결정론 코드(시드 순회) */
function findCode(n: PlayerCount, pred: (code: string) => boolean): string {
  for (let i = 0; i < SEED_SPACE; i++) {
    const code = seedAt((i * 7919) % SEED_SPACE) + n;
    if (pred(code)) return code;
  }
  throw new Error(`no code for ${n}`);
}
const culpritAt = (n: PlayerCount, seat: number) => findCode(n, (code) => assignFromCode(c, code)!.culpritSeat === seat);

function run(s: GameState, actions: GameAction[], start = T0, step = 1000): GameState {
  let now = start;
  for (const a of actions) {
    s = applyAction(s, a, { c, now });
    now += step;
  }
  return s;
}

/** 방장: 지목 입력 단계까지 */
function hostAtInput(code: string, absent: number[] = []): GameState {
  let s = newHostGame(c, code, T0)!;
  s = run(s, [{ type: 'syncPhase', phase: 'vote' }, ...absent.map((seat) => ({ type: 'setAbsent', seat, absent: true }) as GameAction), { type: 'advance' }]);
  expect(s.host!.vote!.sub).toBe('input');
  return s;
}

function castBallots(s: GameState, ballots: Record<number, number>): GameState {
  return run(
    s,
    Object.entries(ballots).map(([v, t]) => ({ type: 'ballot', voter: Number(v), target: t }) as GameAction),
  );
}

afterEach(() => {
  vi.restoreAllMocks();
});

// ─────────────────────────────── 3-A ROOM ───────────────────────────────

describe('ROOM — 방 코드·사건 표식', () => {
  it('ROOM-01 대량 생성 형식: 4·5·6인 각 10만 회 전부 /^[2-9A-HJKMNP-Z]{4}[4-6]$/, 금지 문자 없음, 5번째 = n', () => {
    for (const n of COUNTS) {
      for (let i = 0; i < 100_000; i++) {
        const r = generateRoomCode(n);
        if (!CODE_RE.test(r.code) || /[0O1IL]/.test(r.code) || r.code[4] !== String(n) || r.n !== n) {
          throw new Error(`bad code ${r.code} for ${n}`);
        }
      }
    }
  });

  it('ROOM-02 거절 샘플링: 248~255 바이트는 버리고, 균등 바이트 31만 개의 31자 빈도는 카이제곱 p>0.01', () => {
    // 248..255 만 주다가 마지막에 0..3 → 0..3 만 쓰여야 한다
    let calls = 0;
    const rejectFirst = (len: number) => {
      calls++;
      return calls === 1 ? Uint8Array.from({ length: len }, (_, i) => 248 + (i % 8)) : Uint8Array.from({ length: len }, (_, i) => i);
    };
    expect(generateRoomCode(5, rejectFirst).seed).toBe(A.slice(0, 4));

    const rng = makeRng(20261002);
    const uniform = (len: number) => Uint8Array.from({ length: len }, () => Math.floor(rng() * 256));
    const freq = new Array(31).fill(0);
    for (let i = 0; i < 77_500; i++) for (const ch of generateRoomCode(4, uniform).seed) freq[A.indexOf(ch)]++;
    const total = freq.reduce((x, y) => x + y, 0);
    const expected = total / 31;
    const chi2 = freq.reduce((s, f) => s + (f - expected) ** 2 / expected, 0);
    expect(total).toBe(310_000);
    expect(chi2).toBeLessThan(50.892); // df=30, α=0.01
  });

  it('ROOM-03 crypto 없음: 기본 난수원은 throw(Math.random 대체 금지)', () => {
    const spy = vi.spyOn(Math, 'random');
    const saved = globalThis.crypto;
    Object.defineProperty(globalThis, 'crypto', { value: undefined, configurable: true });
    try {
      expect(() => generateRoomCode(5)).toThrow(/crypto/);
    } finally {
      Object.defineProperty(globalThis, 'crypto', { value: saved, configurable: true });
    }
    expect(spy).not.toHaveBeenCalled();
  });

  it('ROOM-04 정규화: 하이픈·공백·U+2010·소문자는 같은 코드, 틀린 형식은 invalid', () => {
    for (const ok of ['7f3k-5', '7F3K 5', '7F3K‐5', '7F3K5 ', ' 7f3k–5']) expect(parseRoomCode(ok)?.code).toBe('7F3K5');
    for (const bad of ['7F3K7', '7F3O5', '7F3K', '7F3K55', '7F3I5', '', '1234567']) expect(parseRoomCode(bad)).toBeNull();
    expect(formatRoomCode('7f3k5')).toBe('7F3K-5');
  });

  it('ROOM-08 [BUG-03] 인원 숫자 오타는 사건 표식으로 반드시 드러난다 — 전 시드 × (4·5·6) 표식이 서로 다르다', () => {
    let collisions = 0;
    for (let i = 0; i < SEED_SPACE; i++) {
      const seed = seedAt(i);
      const t4 = parseRoomCode(seed + 4)!.tag;
      const t5 = parseRoomCode(seed + 5)!.tag;
      const t6 = parseRoomCode(seed + 6)!.tag;
      if (t4 === t5 || t5 === t6 || t4 === t6) collisions++;
    }
    expect(collisions).toBe(0);
    // 설계서 재현 사례: 방장 7F3K5 vs 플레이어 7F3K6
    expect(parseRoomCode('7F3K5')!.tag).not.toBe(parseRoomCode('7F3K6')!.tag);
  });

  it('ROOM-08b 5인 표식은 예전 값 그대로(시드만 준 caseTag 와 같다) — 이미 공유된 5인 초대 문구와 어긋나지 않게', () => {
    expect(['7F3K', '2222', 'ZZZZ', 'ABCD'].map((s) => caseTag(s))).toEqual(['청자 석류', '대숲 까치', '촛불 연꽃', '옥빛 모란']);
    expect(parseRoomCode('7F3K5')!.tag).toBe('청자 석류');
    expect(caseTag('7F3K5')).toBe(parseRoomCode('7F3K5')!.tag);
    expect(caseTag('7F3K4')).toBe(parseRoomCode('7F3K4')!.tag);
  });

  it('ROOM-09 시드 1글자 오타 검출률 ≥ 93% (전 시드, 자리·대체 글자 순환)', () => {
    let same = 0;
    let tot = 0;
    for (let i = 0; i < SEED_SPACE; i++) {
      const seed = seedAt(i);
      const pos = i % 4;
      const ch = A[(A.indexOf(seed[pos]) + 1 + (i % 30)) % 31];
      const typo = seed.slice(0, pos) + ch + seed.slice(pos + 1);
      if (typo === seed) continue;
      tot++;
      const n = COUNTS[i % 3];
      if (parseRoomCode(typo + n)!.tag === parseRoomCode(seed + n)!.tag) same++;
    }
    expect(1 - same / tot).toBeGreaterThanOrEqual(0.93);
  });

  it('ROOM-05 표시형·저장형 분리: 저장/URL 은 하이픈 없는 5자, 표시만 하이픈', () => {
    const r = parseRoomCode('7f3k-5')!;
    expect(r).toMatchObject({ code: '7F3K5', display: '7F3K-5', seed: '7F3K', n: 5 });
    expect(normalizeCode(r.display)).toBe(r.code);
  });
});

// ─────────────────────────────── 3-B JOIN (엔진 부분) ───────────────────────────────

describe('JOIN — 진입 URL·코드 추출', () => {
  it('JOIN-03 잘못된 코드: 7F3O5·1234567 은 badCode, 빈 값은 홈', () => {
    expect(decideEntry(null, parseEntryParams('?code=7F3O5')).kind).toBe('badCode');
    expect(decideEntry(null, parseEntryParams('?code=1234567')).kind).toBe('badCode');
    expect(decideEntry(null, parseEntryParams('?code=')).kind).toBe('home');
  });

  it('JOIN-04 요청서 표기 ?r= 는 구현에 없는 파라미터 → 홈', () => {
    const p = parseEntryParams('?r=7F3K5');
    expect(p).toMatchObject({ room: null, invalidCode: false });
    expect(decideEntry(null, p).kind).toBe('home');
  });

  it('JOIN-05 사건 버전: v=2 는 숫자, v=abc·v=99999 는 무시', () => {
    expect(parseEntryParams('?code=7F3K5&v=2').caseVersion).toBe(2);
    expect(parseEntryParams('?code=7F3K5&v=abc').caseVersion).toBeNull();
    expect(parseEntryParams('?code=7F3K5&v=99999').caseVersion).toBeNull();
  });

  it('JOIN-11 [BUG-11] 초대 URL·문구를 통째로 붙여도 그 안의 code= 를 뽑는다(HTTP5 로 새지 않는다)', () => {
    expect(extractRoomCode('https://project-orsrw.vercel.app/gung?code=7F3K5')).toBe('7F3K5');
    expect(extractRoomCode('https://project-orsrw.vercel.app/gung?code=7F3K5&v=1')).toBe('7F3K5');
    expect(extractRoomCode('[세자 독살 사건] 방 코드 7F3K-5 (5인 · 청자 석류)\n입장 → https://project-orsrw.vercel.app/gung?code=7F3K5&v=1')).toBe('7F3K5');
    expect(extractRoomCode('7F3K-5')).toBe('7F3K5');
    expect(extractRoomCode(' 7f3k5 ')).toBe('7F3K5');
    // 코드가 없는 링크는 아무것도 채우지 않는다(HTTP5 금지)
    expect(extractRoomCode('https://project-orsrw.vercel.app/gung')).toBeNull();
    expect(extractRoomCode('https://project-orsrw.vercel.app/gung?code=7F3O5')).toBeNull();
  });
});

// ─────────────────────────────── 3-C ASG ───────────────────────────────

describe('ASG — 배정 결정론·불변식', () => {
  it('ASG-03 코드 공간 전수(31⁴ × 3 = 2,768,343): cast 길이 n · 중복 0 · 범인(숙의) 포함 · 범인 자리 1..n · NPC 는 자리에 없음', () => {
    let checked = 0;
    for (const n of COUNTS) {
      const castSet = new Set(c.roles.filter((r) => r.priority <= n).map((r) => r.id));
      const npcs = c.roles.filter((r) => r.priority > n).map((r) => r.id);
      for (let i = 0; i < SEED_SPACE; i++) {
        const a = assignSeats(c, roomOf(seedAt(i), n));
        checked++;
        if (
          a.seats.length !== n ||
          new Set(a.seats).size !== n ||
          !a.seats.every((r) => castSet.has(r)) ||
          a.culpritRole !== 'consort' ||
          a.seats[a.culpritSeat - 1] !== 'consort' ||
          a.culpritSeat < 1 ||
          a.culpritSeat > n ||
          npcs.some((r) => a.seats.includes(r))
        ) {
          throw new Error(`invariant broken at ${seedAt(i)}${n}`);
        }
      }
    }
    expect(checked).toBe(SEED_SPACE * 3);
  });

  it('ASG-04 범인 자리 분포 = 1/n ± 1.5%p (전수). 방장(1번)이 범인일 확률도 1/n', () => {
    for (const n of COUNTS) {
      const hist = new Array(n + 1).fill(0);
      for (let i = 0; i < SEED_SPACE; i++) hist[assignSeats(c, roomOf(seedAt(i), n)).culpritSeat]++;
      for (let seat = 1; seat <= n; seat++) expect(Math.abs(hist[seat] / SEED_SPACE - 1 / n)).toBeLessThan(0.015);
    }
  });

  it('ASG-05a 엔진 소스에 Math.random·Date.now·new Date·로케일 API 호출이 없다(주석 제외)', () => {
    const dir = path.resolve(__dirname);
    const files = fs.readdirSync(dir).filter((f) => f.endsWith('.ts') && !f.endsWith('.test.ts') && f !== 'fixtures.ts');
    const offenders: string[] = [];
    for (const f of files) {
      const code = fs
        .readFileSync(path.join(dir, f), 'utf8')
        .replace(/\/\*[\s\S]*?\*\//g, '')
        .replace(/(^|[^:])\/\/.*$/gm, '$1');
      for (const bad of ['Math.random(', 'Date.now(', 'new Date(', 'toLocaleString(', 'toLocaleDateString(', 'Intl.']) {
        if (code.includes(bad)) offenders.push(`${f}: ${bad}`);
      }
    }
    expect(offenders).toEqual([]);
  });

  it('ASG-05b Math.random 이 throw 해도 배정·단서·게임 진행·결과·공유 문구가 전부 돌아간다', () => {
    vi.spyOn(Math, 'random').mockImplementation(() => {
      throw new Error('Math.random called');
    });
    const code = '7F3K5';
    const a = assignFromCode(c, code)!;
    for (let seat = 1; seat <= 5; seat++) getSheet(c, a, seat, 3);
    for (const round of [1, 2, 3] as const) for (const p of c.rounds[round - 1].placeIds) getClue(c, a, round, p, 2);
    let s = hostAtInput(code);
    s = castBallots(s, { 1: a.culpritSeat === 1 ? 2 : a.culpritSeat, 2: a.culpritSeat === 2 ? 1 : a.culpritSeat, 3: a.culpritSeat === 3 ? 1 : a.culpritSeat, 4: a.culpritSeat === 4 ? 1 : a.culpritSeat, 5: a.culpritSeat === 5 ? 1 : a.culpritSeat });
    const r = resultOf(c, s)!;
    resultPayload(resultShareInput(r, 5, '20261002'));
    genericPayload();
    expect(r.verdict.stage).toBe('decided');
  });

  it('ASG-07 NPC 자리(4인 5·6번, 5인 6번)는 시트가 없다', () => {
    expect(getSheet(c, assignFromCode(c, '7F3K4')!, 5)).toBeNull();
    expect(getSheet(c, assignFromCode(c, '7F3K4')!, 6)).toBeNull();
    expect(getSheet(c, assignFromCode(c, '7F3K5')!, 6)).toBeNull();
  });
});

// ─────────────────────────────── 3-E·3-F FLOW/LOCK (엔진) ───────────────────────────────

describe('FLOW — 되돌리기·단계 맞추기(엔진)', () => {
  it('FLOW-13 [BUG-08] 결과 화면에서 ↶ 를 해도 미션 판정은 남는다', () => {
    const code = culpritAt(4, 2);
    let s = castBallots(hostAtInput(code), { 1: 2, 2: 1, 3: 2, 4: 2 });
    s = run(s, [{ type: 'advance' }]); // → reveal
    while (s.phase === 'reveal') s = run(s, [{ type: 'advance' }]);
    expect(s.phase).toBe('result');
    s = run(s, [
      { type: 'mission', seat: 1, missionId: 'secret', value: true },
      { type: 'mission', seat: 3, missionId: 'secret', value: false },
    ]);
    s = run(s, [{ type: 'undo' }]); // 판결 비트로
    expect(s.phase).toBe('reveal');
    s = run(s, [{ type: 'advance' }]); // 점수 보기
    expect(s.phase).toBe('result');
    expect(s.host!.missions).toEqual({ 1: { secret: true }, 3: { secret: false } });
    const r = resultOf(c, s)!;
    expect(r.rows[0].missions.find((m) => m.id === 'secret')!.value).toBe(true);
  });

  it('FLOW-08 / TMR-10 엔진: 단계 맞추기 뒤 타이머는 꺼져 있고(null) restart 로 그 단계 타이머를 켤 수 있다', () => {
    let s = run(newHostGame(c, '7F3K5', T0)!, [{ type: 'syncPhase', phase: 'r2' }]);
    expect(s.host!.timer).toBeNull();
    s = run(s, [{ type: 'timer', op: 'restart' }]);
    expect(s.host!.timer).toMatchObject({ kind: 'select', running: true, totalMs: 60_000 });
    s = run(s, [{ type: 'syncPhase', phase: 'defense' }, { type: 'timer', op: 'restart' }]);
    expect(s.host!.timer).toMatchObject({ kind: 'defense', totalMs: 45_000 });
  });

  it('RVL-04 [BUG-15] "전체 한 번에 보기"는 범인 도장(자백) 비트까지만 — 판결로 바로 건너뛰지 않는다', () => {
    const beats = revealBeats(c);
    const culpritIdx = beats.findIndex((b) => b.kind === 'culprit');
    let s = run(newHostGame(c, '7F3K5', T0)!, [{ type: 'syncPhase', phase: 'reveal' }]);
    s = run(s, [{ type: 'revealAll' }]);
    expect(s.host!.revealIndex).toBe(culpritIdx);
    s = run(s, [{ type: 'advance' }]);
    expect(beats[s.host!.revealIndex].kind).toBe('verdict');
    // 범인 비트 이후엔 더 건너뛸 게 없다
    expect(run(s, [{ type: 'revealAll' }])).toBe(s);
  });

  it('RVL-08 소요 시간: endedAt = 판결 비트 도달 시각, 분 = round(Δ/60000) ∈ 1..300', () => {
    const code = culpritAt(5, 3);
    let s = newHostGame(c, code, T0)!;
    s = applyAction(s, { type: 'advance' }, { c, now: T0 }); // lobby → briefing: startedAt
    s = applyAction(s, { type: 'syncPhase', phase: 'vote' }, { c, now: T0 + 1 });
    s = applyAction(s, { type: 'advance' }, { c, now: T0 + 2 });
    s = castBallots(s, { 1: 3, 2: 3, 3: 1, 4: 3, 5: 3 });
    s = applyAction(s, { type: 'advance' }, { c, now: T0 + 10 }); // reveal
    const last = revealBeats(c).length - 1;
    let now = T0 + 52 * 60_000;
    while (s.host!.revealIndex < last) s = applyAction(s, { type: 'advance' }, { c, now: now++ });
    expect(s.host!.endedAt).toBe(now - 1);
    expect(resultOf(c, s)!.minutes).toBe(52);
    // 상한·하한
    const long = { ...s.host!, startedAt: T0, endedAt: T0 + 9 * 3600_000 };
    expect(computeResult(c, assignFromCode(c, code)!, long).minutes).toBe(300);
    const short = { ...s.host!, startedAt: T0, endedAt: T0 + 5_000 };
    expect(computeResult(c, assignFromCode(c, code)!, short).minutes).toBe(1);
  });

  it('LOCK 엔진: 플레이어 게이트 1번(조사 2 → 조사 3)이면 바로 R3 기억이 풀린다 — 그래서 화면에 확인 단계가 필요(BUG-05)', () => {
    const code = findCode(6, (k) => (assignFromCode(c, k)!.seats.indexOf('courtLady') + 1) >= 2);
    const a = assignFromCode(c, code)!;
    const seat = seatOfRole(a, 'courtLady')!;
    let p = run(newPlayerGame(c, code, seat, T0)!, [{ type: 'syncPhase', phase: 'r2' }]);
    expect(getSheet(c, a, seat, 2)!.memories.every((m) => !m.unlocked)).toBe(true);
    p = run(p, [{ type: 'advance' }]);
    expect(p.phase).toBe('r3');
    expect(getSheet(c, a, seat, 3)!.memories.every((m) => m.unlocked)).toBe(true);
  });
});

// ─────────────────────────────── 3-G CLUE (엔진) ───────────────────────────────

describe('CLUE — 공개 되돌리기 창', () => {
  it('CLUE-06 공개 되돌리기 5초 경계: 4,999·5,000ms 성공 / 5,001ms 실패', () => {
    const base = run(newPlayerGame(c, '7F3K5', 2, T0)!, [{ type: 'syncPhase', phase: 'r1' }, { type: 'pickPlace', round: 1, placeId: 'dg' }, { type: 'openClue', round: 1 }]);
    const at = T0 + 100_000;
    const pub = applyAction(base, { type: 'disclose', round: 1, value: 'public' }, { c, now: at });
    expect(applyAction(pub, { type: 'undoDisclose', round: 1 }, { c, now: at + 4_999 }).rounds[1]!.disclosure).toBe('undecided');
    expect(applyAction(pub, { type: 'undoDisclose', round: 1 }, { c, now: at + DISCLOSE_UNDO_MS }).rounds[1]!.disclosure).toBe('undecided');
    expect(applyAction(pub, { type: 'undoDisclose', round: 1 }, { c, now: at + 5_001 })).toBe(pub);
  });
});

// ─────────────────────────────── 3-J VOTE ───────────────────────────────

describe('VOTE — 동률·극단값·판결 미정', () => {
  it('VOTE-06 6인 2-2-2 → 후보 3명, 후보 본인은 다른 후보만 / 4인 1-1-1-1 → 후보 = 전원', () => {
    const code6 = culpritAt(6, 6);
    let s = castBallots(hostAtInput(code6), { 1: 2, 2: 1, 3: 4, 4: 3, 5: 6, 6: 5 });
    expect(resolveVerdict(s.host!.vote, activeSeats(6), 6).stage).toBe('needsRevote');
    s = run(s, [{ type: 'advance' }]);
    expect(s.host!.vote!.revote!.candidates).toEqual([1, 2, 3, 4, 5, 6]);

    let t = castBallots(hostAtInput(code6), { 1: 2, 2: 1, 3: 2, 4: 1, 5: 6, 6: 5 }); // 2-2-1-1 → 1·2 동률
    t = run(t, [{ type: 'advance' }]);
    expect(t.host!.vote!.revote!.candidates).toEqual([1, 2]);
    // 후보 1번은 2번만, 2번은 1번만 — 자기 자신·비후보 거부
    expect(run(t, [{ type: 'ballot', voter: 1, target: 1 }])).toEqual(t);
    expect(run(t, [{ type: 'ballot', voter: 1, target: 3 }])).toEqual(t);
    t = castBallots(t, { 1: 2, 2: 1, 3: 2, 4: 2, 5: 2, 6: 1 });
    expect(t.host!.vote!.sub).toBe('final');
    expect(resolveVerdict(t.host!.vote, activeSeats(6), 6)).toMatchObject({ stage: 'decided', accusedSeat: 2, caught: false, revoted: true });

    const code4 = culpritAt(4, 3);
    let u = castBallots(hostAtInput(code4), { 1: 2, 2: 3, 3: 4, 4: 1 });
    u = run(u, [{ type: 'advance' }]);
    expect(u.host!.vote!.revote!.candidates).toEqual([1, 2, 3, 4]);
  });

  it('VOTE-13 활성 1명(4인 중 2·3·4번 비움): 입력 단계에서 막히지 않고 판결까지 간다', () => {
    const code = culpritAt(4, 1);
    let s = hostAtInput(code, [2, 3, 4]);
    expect(activeSeats(4, s.host!.absentSeats)).toEqual([1]);
    s = run(s, [{ type: 'advance' }]); // input → tally (낼 표가 없다)
    expect(s.host!.vote!.sub).toBe('tally');
    s = run(s, [{ type: 'advance' }]);
    expect(s.phase).toBe('reveal');
    const r = resultOf(c, s)!;
    expect(r.verdict.stage).toBe('decided');
    expect(r.judges).toBe(0);
  });

  it('VOTE-14 [BUG-06] 지목 없이 결과로 가면 판결은 미정(pending)이고 decided=false — "도주"로 집계되지 않는다', () => {
    const code = culpritAt(5, 2);
    const s = run(newHostGame(c, code, T0)!, [{ type: 'syncPhase', phase: 'r1' }, { type: 'syncPhase', phase: 'result' }]);
    const r = resultOf(c, s)!;
    expect(r.verdict.stage).toBe('pending');
    expect(r.decided).toBe(false);
    expect(r.caught).toBe(false);
    expect(r.rows.find((x) => x.isCulprit)!.breakdown.escape).toBe(0);
    expect(r.mvpSeats).toEqual([]);
    // 재지목이 필요한데 안 한 채 끝난 경우도 미정
    let t = castBallots(hostAtInput(code), { 1: 2, 2: 1, 3: 2, 4: 1, 5: 3 });
    t = run(t, [{ type: 'syncPhase', phase: 'result' }]);
    expect(resultOf(c, t)!.verdict.stage).toBe('needsRevote');
    expect(resultOf(c, t)!.decided).toBe(false);
  });

  it('VOTE-09 [BUG-02 결정] 범인 자리를 비운 판 → 검거도 도주도 아닌 판결 없음(culpritAbsent), 범인 탈출 점수 0, 명판관 없음', () => {
    const code = culpritAt(5, 3);
    let s = hostAtInput(code, [3]);
    s = castBallots(s, { 1: 2, 2: 1, 4: 2, 5: 2 });
    const r = resultOf(c, s)!;
    expect(r.verdict.stage).toBe('decided'); // 집계 자체는 끝났지만
    expect(r).toMatchObject({ caught: false, decided: false, culpritAbsent: true, judges: 4, hits: 0 });
    expect(r.rows[2]).toMatchObject({ absent: true, score: 0, rank: null });
    expect(r.rows[2].breakdown.escape).toBe(0);
    expect(r.mvpSeats).toEqual([]);
    // 무고 자리를 비운 판은 그대로 판결이 난다
    let t = hostAtInput(code, [4]);
    t = castBallots(t, { 1: 3, 2: 3, 3: 1, 5: 3 });
    expect(resultOf(c, t)!).toMatchObject({ decided: true, culpritAbsent: false, caught: true });
  });
});

// ─────────────────────────────── 3-K SCR — 원고 8-2 오라클 ───────────────────────────────

/** 원고 8-1·8-2 를 그대로 옮긴 표(엔진 상수를 읽지 않는다) */
const RULE = {
  correctVote: 3,
  bonusEach: 1,
  secret: 2,
  escape: 5,
  mission2: { queen: 1, consort: 1, eunuch: 1, physician: 1, courtLady: 1, crownPrincess: 2 } as Record<string, number>,
};
const BONUS_TEXT = { q1: '빈궁의 석청', q2: '세자빈' };

interface Scenario {
  code: string;
  n: PlayerCount;
  absent: number[];
  first: Record<number, number>;
  revote?: Record<number, number>;
  bonus: Record<number, Record<string, number>>;
  manual: Record<number, Record<string, boolean | null>>;
}

/** 독립 오라클 — 원고 8-2 를 손으로 계산 */
function oracle(sc: Scenario) {
  const a = assignFromCode(c, sc.code)!;
  const active = Array.from({ length: sc.n }, (_, i) => i + 1).filter((s) => !sc.absent.includes(s));
  const count = (ballots: Record<number, number>, targets: number[]) => {
    const m: Record<number, number> = {};
    for (const v of active) {
      const t = ballots[v];
      if (t === undefined || t === v || !targets.includes(t)) continue;
      m[t] = (m[t] ?? 0) + 1;
    }
    return m;
  };
  const tops = (m: Record<number, number>) => {
    const max = Math.max(0, ...Object.values(m));
    return max === 0 ? [] : Object.keys(m).map(Number).filter((k) => m[k] === max).sort((x, y) => x - y);
  };
  const firstCounts = count(sc.first, active);
  const firstTop = tops(firstCounts);
  let accused: number | null = firstTop.length === 1 ? firstTop[0] : null;
  if (firstTop.length > 1) {
    const rt = tops(count(sc.revote ?? {}, firstTop));
    accused = rt.length === 1 ? rt[0] : null;
  }
  const caught = accused !== null && accused === a.culpritSeat;
  const votes = (seat: number | null) => (seat === null ? 0 : firstCounts[seat] ?? 0);
  const answers = c.bonusQuestions!;
  const rows = a.seats.map((role, i) => {
    const seat = i + 1;
    if (sc.absent.includes(seat)) return { seat, score: 0, successes: 0, absent: true, isCulprit: seat === a.culpritSeat };
    const isCulprit = seat === a.culpritSeat;
    const secret = sc.manual[seat]?.secret === true;
    let score = 0;
    let successes = 0;
    if (isCulprit) {
      if (!caught) {
        score += RULE.escape;
        if (secret) (score += RULE.secret), successes++;
        if (votes(seatOfRole(a, 'physician')) >= 2) (score += RULE.mission2.consort), successes++;
      }
      return { seat, score, successes, absent: false, isCulprit };
    }
    const myVote = sc.first[seat];
    if (myVote === a.culpritSeat) score += RULE.correctVote;
    for (const q of answers) {
      const ans = sc.bonus[seat]?.[q.id];
      if (ans !== undefined && q.options[ans] === BONUS_TEXT[q.id as 'q1' | 'q2']) score += RULE.bonusEach;
    }
    if (secret) (score += RULE.secret), successes++;
    let m2: boolean | null;
    switch (role) {
      case 'queen':
        m2 = votes(seatOfRole(a, 'consort')) >= 2;
        break;
      case 'eunuch':
        m2 = votes(seat) === 0;
        break;
      case 'physician': {
        const ans = sc.bonus[seat]?.q1;
        m2 = ans !== undefined ? answers[0].options[ans] === BONUS_TEXT.q1 : sc.manual[seat]?.pride ?? null;
        break;
      }
      case 'courtLady':
        m2 = !firstTop.includes(seatOfRole(a, 'queen')!);
        break;
      case 'crownPrincess':
        m2 = myVote === a.culpritSeat;
        break;
      default:
        m2 = null;
    }
    if (m2 === true) (score += RULE.mission2[role]), successes++;
    return { seat, score, successes, absent: false, isCulprit };
  });
  const live = rows.filter((r) => !r.absent);
  const ranking = live
    .slice()
    .sort((x, y) => y.score - x.score || x.seat - y.seat)
    .map((r) => r.seat);
  let mvp: number[] = [];
  if (caught) {
    const pool = live.filter((r) => !r.isCulprit);
    const best = Math.max(...pool.map((r) => r.score));
    let tied = pool.filter((r) => r.score === best);
    const bm = Math.max(...tied.map((r) => r.successes));
    tied = tied.filter((r) => r.successes === bm);
    mvp = tied.map((r) => r.seat);
  } else if (live.some((r) => r.isCulprit)) mvp = [a.culpritSeat];
  const hits = live.filter((r) => !r.isCulprit && sc.first[r.seat] === a.culpritSeat).length;
  return { caught, accused, rows, ranking, mvp, hits, judges: live.filter((r) => !r.isCulprit).length };
}

/** 시나리오 → 실제 앱 액션 순서로 방장 게임을 끝까지 */
function play(sc: Scenario): GameState {
  let s = hostAtInput(sc.code, sc.absent);
  s = castBallots(s, sc.first);
  if (s.host!.vote!.sub === 'tally' && resolveVerdict(s.host!.vote, activeSeats(sc.n, sc.absent), 0).stage === 'needsRevote') {
    s = run(s, [{ type: 'startRevote' }]);
    s = castBallots(s, sc.revote ?? {});
  }
  for (const [seat, qs] of Object.entries(sc.bonus)) {
    for (const [q, opt] of Object.entries(qs)) s = run(s, [{ type: 'bonusAnswer', seat: Number(seat), questionId: q, option: opt }]);
  }
  for (let guard = 0; s.phase !== 'result' && guard < 40; guard++) s = run(s, [{ type: 'advance' }]);
  expect(s.phase).toBe('result');
  for (const [seat, ms] of Object.entries(sc.manual)) {
    for (const [id, v] of Object.entries(ms)) s = run(s, [{ type: 'mission', seat: Number(seat), missionId: id, value: v }]);
  }
  return s;
}

function randomScenario(rng: () => number): Scenario {
  const n = COUNTS[Math.floor(rng() * 3)];
  const seed = Array.from({ length: 4 }, () => A[Math.floor(rng() * 31)]).join('');
  const code = seed + n;
  const absent = rng() < 0.3 ? [2 + Math.floor(rng() * (n - 1))] : [];
  const active = Array.from({ length: n }, (_, i) => i + 1).filter((s) => !absent.includes(s));
  const pick = (opts: number[]) => opts[Math.floor(rng() * opts.length)];
  const a = assignFromCode(c, code)!;
  const first: Record<number, number> = {};
  // 범인 쪽으로 몰리게(검거 판도 충분히 나오게) 섞는다
  for (const v of active) {
    const opts = active.filter((t) => t !== v);
    first[v] = rng() < 0.45 && opts.includes(a.culpritSeat) ? a.culpritSeat : pick(opts);
  }
  const cnt: Record<number, number> = {};
  for (const v of active) cnt[first[v]] = (cnt[first[v]] ?? 0) + 1;
  const max = Math.max(...Object.values(cnt));
  const top = Object.keys(cnt).map(Number).filter((k) => cnt[k] === max);
  let revote: Record<number, number> | undefined;
  if (top.length > 1) {
    revote = {};
    for (const v of active) {
      const opts = top.filter((t) => t !== v);
      if (opts.length) revote[v] = pick(opts);
    }
  }
  const bonus: Scenario['bonus'] = {};
  const manual: Scenario['manual'] = {};
  for (const s of active) {
    if (rng() < 0.6) bonus[s] = { q1: Math.floor(rng() * 4), ...(rng() < 0.7 ? { q2: Math.floor(rng() * 4) } : {}) };
    const v = rng();
    manual[s] = { secret: v < 0.4 ? true : v < 0.7 ? false : null };
    if (roleAtSeat(a, s) === 'physician' && rng() < 0.5) manual[s].pride = rng() < 0.5;
  }
  return { code, n, absent, first, revote, bonus, manual };
}

describe('SCR — 원고 8-2 점수표 대조(독립 오라클)', () => {
  it('SCR-01a 원고 8-1 보너스 정답 글자가 데이터의 정답 보기와 같다', () => {
    const [q1, q2] = c.bonusQuestions!;
    expect(q1.options[q1.answer]).toBe(BONUS_TEXT.q1);
    expect(q2.options[q2.answer]).toBe(BONUS_TEXT.q2);
  });

  it('SCR-01 무작위 600판(4/5/6인·이탈·동률→재지목·보너스·구술 판정) — 자리별 점수·순위·명탐정·적중 수가 원고 오라클과 같다', () => {
    const rng = makeRng(0x6a6e67);
    let caughtN = 0;
    let escN = 0;
    let revN = 0;
    for (let i = 0; i < 600; i++) {
      const sc = randomScenario(rng);
      const s = play(sc);
      const r = resultOf(c, s)!;
      const o = oracle(sc);
      const ctx = `#${i} ${sc.code} ${JSON.stringify(sc)}`;
      expect(r.caught, ctx).toBe(o.caught);
      expect(r.verdict.accusedSeat, ctx).toBe(o.accused);
      expect(r.rows.map((x) => x.score), ctx).toEqual(o.rows.map((x) => x.score));
      expect(r.ranking, ctx).toEqual(o.ranking);
      expect(r.mvpSeats, ctx).toEqual(o.mvp);
      expect([r.hits, r.judges], ctx).toEqual([o.hits, o.judges]);
      expect(r.rows.every((x) => x.breakdown.teamCatch === 0), ctx).toBe(true); // 원고: 팀 보너스 없음
      if (o.caught) caughtN++;
      else escN++;
      if (sc.revote) revN++;
    }
    // 표본이 한쪽으로 쏠리지 않았는지
    expect(caughtN).toBeGreaterThan(100);
    expect(escN).toBeGreaterThan(100);
    expect(revN).toBeGreaterThan(30);
  });

  it('SCR-02 점수 상한(원고 8-4): 무고 8 · 세자빈 9 · 범인 탈출 8', () => {
    // 6인, 범인 = 6번이 아닌 판에서 전원 진범 지목(세자빈·중전 등 최대) → 검거
    const code = culpritAt(6, 2);
    const a = assignFromCode(c, code)!;
    const others = [1, 3, 4, 5, 6];
    const ballots: Record<number, number> = { 2: 1 };
    for (const v of others) ballots[v] = 2;
    // 조상궁 미션(중전 최다 아님) 성공 · 내관 0표 · 중전 미션(숙의 2표 이상)
    let s = castBallots(hostAtInput(code), ballots);
    for (const seat of others) {
      s = run(s, [
        { type: 'bonusAnswer', seat, questionId: 'q1', option: 1 },
        { type: 'bonusAnswer', seat, questionId: 'q2', option: 1 },
      ]);
    }
    while (s.phase !== 'result') s = run(s, [{ type: 'advance' }]);
    for (const seat of others) s = run(s, [{ type: 'mission', seat, missionId: 'secret', value: true }]);
    const r = resultOf(c, s)!;
    const byRole = Object.fromEntries(r.rows.map((x) => [roleAtSeat(a, x.seat)!, x.score]));
    // 내관은 1번에게서 1표를 받는다(범인 표) → 0표 미션 실패라 7. 나머지 무고 8, 세자빈 9
    expect(byRole).toMatchObject({ queen: 8, physician: 8, courtLady: 8, crownPrincess: 9, consort: 0 });
    expect(Math.max(...r.rows.filter((x) => !x.isCulprit).map((x) => x.score))).toBe(9);

    // 범인 탈출 최대: 어의 2표 이상 + 비밀 유지
    const code2 = culpritAt(5, 3);
    const a2 = assignFromCode(c, code2)!;
    const phys = seatOfRole(a2, 'physician')!;
    const b2: Record<number, number> = {};
    for (let v = 1; v <= 5; v++) b2[v] = v === phys ? (phys === 1 ? 2 : 1) : phys;
    let e = castBallots(hostAtInput(code2), b2);
    while (e.phase !== 'result') e = run(e, [{ type: 'advance' }]);
    e = run(e, [{ type: 'mission', seat: 3, missionId: 'secret', value: true }]);
    expect(resultOf(c, e)!.rows[2]).toMatchObject({ isCulprit: true, score: 8 });
  });

  it('SCR-04 해석 고정: 중전이 동률 1위면 조상궁 미션 실패 / 내관 0표는 1차 지목 기준(재지목 표 무관)', () => {
    const code = findCode(5, (k) => {
      const a = assignFromCode(c, k)!;
      return a.culpritSeat === 2 && roleAtSeat(a, 3) === 'queen' && roleAtSeat(a, 4) === 'courtLady' && roleAtSeat(a, 5) === 'eunuch';
    });
    // 1차: 2번 2표, 3번(중전) 2표 동률 → 재지목에서 5번(내관)은 후보가 아니므로 0표 유지
    let s = castBallots(hostAtInput(code), { 1: 3, 2: 3, 3: 2, 4: 2, 5: 1 });
    s = run(s, [{ type: 'startRevote' }]);
    s = castBallots(s, { 1: 2, 2: 3, 3: 2, 4: 2, 5: 2 });
    const r = resultOf(c, s)!;
    expect(r.verdict.first.top).toEqual([2, 3]);
    expect(r.rows[3].missions.find((m) => m.id === 'loyalty')!.value).toBe(false); // 동률 1위도 최다
    expect(r.rows[4].missions.find((m) => m.id === 'lifeline')!.value).toBe(true); // 1차 0표
    expect(r.caught).toBe(true);
  });

  it('SCR-09 미판정 수에서 무효(void) 미션은 빠진다 / SCR-11 이탈자는 점수 0·순위·랭킹 제외', () => {
    const code = culpritAt(4, 2);
    let s = hostAtInput(code, [4]);
    s = castBallots(s, { 1: 2, 2: 1, 3: 2 }); // 검거 → 범인 미션 2개 void
    const r = resultOf(c, s)!;
    expect(r.caught).toBe(true);
    const culprit = r.rows[1];
    expect(culprit.missions.every((m) => m.void)).toBe(true);
    const expectedPending = r.rows
      .filter((x) => !x.absent)
      .reduce((sum, x) => sum + x.missions.filter((m) => m.value === null && !m.void).length, 0);
    expect(r.pendingMissions).toBe(expectedPending);
    expect(r.rows[3]).toMatchObject({ absent: true, score: 0, rank: null });
    expect(r.ranking).not.toContain(4);
  });
});

// ─────────────────────────────── 3-M SHR ───────────────────────────────

describe('SHR — 결과 공유 스포일러 프리', () => {
  const FORBIDDEN_WORDS = Array.from(new Set(['숙의', '연씨', ...c.roles.flatMap((r) => [r.name, r.shortName ?? r.name])]));

  it('SHR-03 4/5/6인 × 모든 범인 자리 × (검거·도주·재지목 도주): title·description·text·copyText·imageUrl·링크에 역할명·방 코드·code=·result= 0건', () => {
    let cases = 0;
    for (const n of COUNTS) {
      for (let k = 1; k <= n; k++) {
        const code = culpritAt(n, k);
        const room = parseRoomCode(code)!;
        const others = Array.from({ length: n }, (_, i) => i + 1).filter((s) => s !== k);
        const caughtB: Record<number, number> = { [k]: others[0] };
        for (const v of others) caughtB[v] = k;
        const escB: Record<number, number> = {};
        for (let v = 1; v <= n; v++) escB[v] = v === others[0] ? others[1] : others[0];
        for (const ballots of [caughtB, escB]) {
          const s = castBallots(hostAtInput(code), ballots);
          const r = resultOf(c, s)!;
          const p = resultPayload(resultShareInput(r, n, '20261002'));
          const blob = JSON.stringify(p);
          for (const w of FORBIDDEN_WORDS) expect(blob, `${code} ${w}`).not.toContain(w);
          for (const w of [room.code, room.display, room.seed, 'code=', 'result=', 'seat', 'as=host']) expect(blob, `${code} ${w}`).not.toContain(w);
          const q = new URL(p.kakao.content.imageUrl).searchParams;
          expect([...q.keys()].sort()).toEqual(['d', 'h', 'j', 'm', 'n', 'o', 'r']);
          cases++;
        }
      }
    }
    expect(cases).toBe(2 * (4 + 5 + 6));
    const g = JSON.stringify(genericPayload());
    for (const w of FORBIDDEN_WORDS) expect(g).not.toContain(w);
  });

  it('SHR-04 판결 문구 버킷 6종 + 엣지(검거인데 판정자 0명 → 만장일치로 나오는지 기록)', () => {
    expect(verdictHeadline({ caught: true, hits: 4, judges: 4, revoted: false })).toMatch(/만장일치/);
    expect(verdictHeadline({ caught: true, hits: 2, judges: 4, revoted: true })).toMatch(/재지목/);
    expect(verdictHeadline({ caught: true, hits: 2, judges: 4, revoted: false })).toMatch(/끈질긴/);
    expect(verdictHeadline({ caught: false, hits: 0, judges: 4, revoted: true })).toMatch(/완전범죄/);
    expect(verdictHeadline({ caught: false, hits: 1, judges: 4, revoted: true })).toMatch(/끝내 동률/);
    expect(verdictHeadline({ caught: false, hits: 1, judges: 4, revoted: false })).toMatch(/빠져나갔다/);
    // 엣지 — 정책 확인용 기록: 0/0 검거는 "만장일치"
    expect(verdictHeadline({ caught: true, hits: 0, judges: 0, revoted: false })).toMatch(/만장일치/);
  });

  it('SHR-03b OG 쿼리는 숫자·열거형 7개뿐 — 자유 텍스트 자리가 없다', () => {
    const q = buildOgResultQuery(toOgParams({ caught: true, hits: 3, judges: 4, minutes: 52.4, revoted: false, n: 5, date: '20261002' }));
    expect(q).toBe('o=c&n=5&h=3&j=4&m=52&r=0&d=20261002');
  });
});

// ─────────────────────────────── 3-Q STO ───────────────────────────────

describe('STO — 저장 깨짐', () => {
  const expected = { caseId: c.id, caseVersion: c.version };

  function hostMid(): GameState {
    const code = culpritAt(5, 2);
    let s = castBallots(hostAtInput(code), { 1: 2, 2: 1, 3: 2, 4: 1, 5: 3 });
    s = run(s, [{ type: 'startRevote' }, { type: 'bonusAnswer', seat: 3, questionId: 'q1', option: 1 }]);
    return s;
  }

  it('STO-01 손상: 잘린 JSON · v:2 · 문자열 seat · 엉뚱한 타입 → 폐기·키 삭제, throw 없음', () => {
    const good = JSON.stringify(hostMid());
    const variants = [
      good.slice(0, good.length / 2),
      good.replace('"v":1', '"v":2'),
      good.replace('"seat":1', '"seat":"1"'),
      good.replace('"phase":"vote"', '"phase":"party"'),
      good.replace(/"rollCall":\[[^\]]*\]/, '"rollCall":"all"'),
      'null',
      '[]',
      '{}',
      '"string"',
    ];
    for (const raw of variants) {
      const st = memoryStorage();
      st.setItem(STORAGE_KEYS.game, raw);
      const res = loadGame(st, T0 + 1000, expected);
      expect(res.state, raw.slice(0, 40)).toBeNull();
      expect(res.status).toBe('invalid');
      expect(st.getItem(STORAGE_KEYS.game)).toBeNull();
    }
  });

  it('STO-01 퍼즈 3000회: 저장 JSON 의 임의 필드를 지우거나 타입을 바꿔도 loadGame 은 throw 하지 않고, 살아남은 상태로 엔진·화면 계산이 돌아간다', () => {
    const rng = makeRng(77);
    const bases = [hostMid(), run(newPlayerGame(c, '7F3K5', 3, T0)!, [{ type: 'syncPhase', phase: 'r2' }, { type: 'pickPlace', round: 2, placeId: 'sr' }])];
    const junk: unknown[] = [null, -1, 0, 1.5, 99, '', 'x', true, [], {}, [1, 2], { a: 1 }, 1e308, 'vote'];
    let survived = 0;
    for (let i = 0; i < 3000; i++) {
      const obj = JSON.parse(JSON.stringify(bases[i % 2])) as Record<string, unknown>;
      // 임의 경로 하나를 골라 변조
      const paths: (string | number)[][] = [];
      const walk = (o: unknown, p: (string | number)[]) => {
        if (p.length) paths.push(p);
        if (o && typeof o === 'object') for (const k of Object.keys(o as object)) walk((o as Record<string, unknown>)[k], [...p, k]);
      };
      walk(obj, []);
      const target = paths[Math.floor(rng() * paths.length)];
      let parent: Record<string | number, unknown> = obj;
      for (const k of target.slice(0, -1)) parent = parent[k] as Record<string | number, unknown>;
      const last = target[target.length - 1];
      if (rng() < 0.3) delete parent[last];
      else parent[last] = junk[Math.floor(rng() * junk.length)];
      const st = memoryStorage();
      st.setItem(STORAGE_KEYS.game, JSON.stringify(obj));
      let res: ReturnType<typeof loadGame>;
      expect(() => (res = loadGame(st, T0 + 1000, expected))).not.toThrow();
      const s = res!.state;
      if (!s) continue;
      survived++;
      // 화면 레이어가 기대하는 불변식
      expect(PHASES).toContain(s.phase);
      if (s.role === 'host') {
        expect(s.host).toBeTruthy();
        if (s.phase === 'vote') expect(s.host!.vote, `vote phase without vote: ${JSON.stringify(target)}`).not.toBeNull();
        expect(() => resultOf(c, s)).not.toThrow();
        expect(() => applyAction(s, { type: 'advance' }, { c, now: T0 + 2000 })).not.toThrow();
        expect(() => applyAction(s, { type: 'undo' }, { c, now: T0 + 2000 })).not.toThrow();
      } else {
        const a = assignFromCode(c, s.code)!;
        expect(getSheet(c, a, s.seat, 3)).not.toBeNull();
        for (const [r, pick] of Object.entries(s.rounds)) expect(() => getClue(c, a, Number(r) as 1 | 2 | 3, pick!.placeId, s.seat)).not.toThrow();
      }
      expect(saveGame(memoryStorage(), s)).toBe(true);
    }
    expect(survived).toBeGreaterThan(100);
  });

  it('STO-04 [BUG-19] 지목 단계인데 vote 가 null 인 저장 → 복원하면 지목 준비 상태로 메워진다(크래시 방지)', () => {
    const s = run(newHostGame(c, '7F3K5', T0)!, [{ type: 'syncPhase', phase: 'vote' }]);
    const raw = JSON.parse(JSON.stringify(s));
    raw.host.vote = null;
    const st = memoryStorage();
    st.setItem(STORAGE_KEYS.game, JSON.stringify(raw));
    const res = loadGame(st, T0 + 1000, expected);
    expect(res.status).toBe('ok');
    expect(res.state!.phase).toBe('vote');
    expect(res.state!.host!.vote).toEqual({ sub: 'ready', first: {} });
  });

  it('STO-03 진행 중 저장소가 용량 초과로 바뀌어도 saveGame 은 false 만 돌려준다(throw 없음)', () => {
    let full = false;
    const st = memoryStorage();
    const flaky = {
      getItem: st.getItem,
      removeItem: st.removeItem,
      setItem: (k: string, v: string) => {
        if (full) throw Object.assign(new Error('QuotaExceededError'), { name: 'QuotaExceededError' });
        st.setItem(k, v);
      },
    };
    let s = newPlayerGame(c, '7F3K5', 2, T0)!;
    expect(saveGame(flaky, s)).toBe(true);
    full = true;
    s = run(s, [{ type: 'syncPhase', phase: 'r3' }]);
    expect(saveGame(flaky, s)).toBe(false);
    expect(loadGame(flaky, T0 + 1000, expected).state!.phase).toBe('lobby'); // 마지막 성공 저장
  });
});
