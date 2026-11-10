import { afterEach, describe, expect, it, vi } from 'vitest';
import { DAY_MS, StoreUsageError, type CreateRoomInput, type NewMatch, type RoomPatch } from './store';
import { MemoryStore } from './store-memory';
import { getStore, resetDbForTests, currentEnv } from './db';

const H = (c: string) => c.repeat(64);
const KA = H('a');
const KB = H('b');
const NOW = 1_800_000_000_000;

const roomInput = (over: Partial<CreateRoomInput> = {}): CreateRoomInput => ({
  code: '12345',
  state: { phase: 'waiting', secret: { boards: [1] } },
  settings: { alarmOn: true },
  env: 'development',
  isTest: false,
  expiresAt: NOW + 30 * 60_000,
  host: { playerKey: KA, nickname: '김대리', industry: 0 },
  ...over,
});
const patch = (over: Partial<RoomPatch> = {}): RoomPatch => ({
  state: { phase: 'placing' },
  status: 'placing',
  expiresAt: NOW + 60 * 60_000,
  ...over,
});
const matchInput = (id: string, seq: number, over: Partial<NewMatch> = {}): NewMatch => ({
  id,
  roomId: 'r',
  seq,
  rematchOf: null,
  hostKey: KA,
  playerKeys: [KA, KB],
  startedAt: NOW,
  alarmOn: true,
  env: 'development',
  isTest: false,
  ...over,
});

afterEach(() => {
  vi.unstubAllEnvs();
  resetDbForTests();
});

async function setup() {
  const s = new MemoryStore();
  const c = await s.createRoom(roomInput(), NOW);
  if (!c.ok) throw new Error('create failed');
  return { s, snap: c.snapshot, id: c.snapshot.room.id };
}

describe('MemoryStore — 생성·load', () => {
  it('방 + 방장(0번)을 만들고 load가 두 자리를 한 번에 돌려준다', async () => {
    const { s, snap } = await setup();
    expect(snap.room.version).toBe(0);
    expect(snap.players[0]?.nickname).toBe('김대리');
    expect(snap.players[1]).toBeNull();
    const loaded = await s.load('12345', NOW + 1);
    expect(loaded?.room.id).toBe(snap.room.id);
    expect(loaded?.players[0]?.viewState).toBe('game');
    expect(loaded?.players[0]?.viewStateAt).toBe(NOW);
  });

  it('없는 번호 · 만료된 방은 null', async () => {
    const { s } = await setup();
    expect(await s.load('99999', NOW)).toBeNull();
    expect(await s.load('12345', NOW + 30 * 60_000)).toBeNull();
  });

  it('살아 있는 방과 같은 번호면 CODE_TAKEN, 만료된 방이 쥔 번호는 새 방이 가져간다', async () => {
    const { s, id } = await setup();
    expect(await s.createRoom(roomInput(), NOW + 1)).toEqual({ ok: false, reason: 'CODE_TAKEN' });
    const later = NOW + 31 * 60_000;
    const again = await s.createRoom(roomInput({ expiresAt: later + 60_000 }), later);
    expect(again.ok).toBe(true);
    if (again.ok) expect(again.snapshot.room.id).not.toBe(id);
    expect(s.debugCounts().rooms).toBe(1);
    expect(s.debugCounts().players).toBe(1);
  });

  it('load 결과를 고쳐도 저장소 안은 바뀌지 않는다(별칭 공유 없음)', async () => {
    const { s } = await setup();
    const a = await s.load('12345', NOW);
    (a!.room.state as { phase: string }).phase = 'HACKED';
    const b = await s.load('12345', NOW);
    expect((b!.room.state as { phase: string }).phase).toBe('waiting');
  });

  it('원본 비밀키 모양(32자)은 거부한다', async () => {
    const s = new MemoryStore();
    await expect(s.createRoom(roomInput({ host: { playerKey: 'a'.repeat(32), nickname: 'x', industry: 0 } }), NOW)).rejects.toBeInstanceOf(
      StoreUsageError,
    );
  });
});

describe('MemoryStore — 비교 저장(CAS)', () => {
  it('version이 같으면 저장되고 +1, 다르면 CONFLICT', async () => {
    const { s, id } = await setup();
    expect(await s.save(id, 0, patch(), NOW + 5)).toEqual({ ok: true, version: 1 });
    expect(await s.save(id, 0, patch(), NOW + 6)).toEqual({ ok: false, reason: 'CONFLICT' });
    expect(await s.save(id, 1, patch({ status: 'playing' }), NOW + 7)).toEqual({ ok: true, version: 2 });
    const l = await s.load('12345', NOW + 8);
    expect(l?.room.version).toBe(2);
    expect(l?.room.status).toBe('playing');
    expect(l?.room.expiresAt).toBe(NOW + 60 * 60_000);
    expect(l?.room.settings).toEqual({ alarmOn: true }); // settings 생략 시 유지
  });

  it('같은 version으로 동시에 저장하면 정확히 하나만 이긴다', async () => {
    const { s, id } = await setup();
    const results = await Promise.all(
      Array.from({ length: 20 }, (_, i) => s.save(id, 0, patch({ state: { writer: i } }), NOW + i)),
    );
    expect(results.filter((r) => r.ok)).toHaveLength(1);
    expect((await s.load('12345', NOW))?.room.version).toBe(1);
  });

  it('충돌한 쪽이 다시 읽어 재시도하면 모두 반영된다(최대 3회 규칙 시뮬레이션)', async () => {
    const { s, id } = await setup();
    const writer = async (n: number) => {
      for (let tries = 0; tries < 20; tries++) {
        const snap = await s.load('12345', NOW);
        const cur = (snap!.room.state as { n?: number }).n ?? 0;
        const r = await s.save(id, snap!.room.version, patch({ state: { n: cur + 1 } }), NOW + n);
        if (r.ok) return;
      }
      throw new Error('starved');
    };
    await Promise.all([writer(1), writer(2), writer(3), writer(4)]);
    const final = await s.load('12345', NOW);
    expect((final!.room.state as { n: number }).n).toBe(4);
    expect(final!.room.version).toBe(4);
  });

  it('지워진 방에 대한 저장은 CONFLICT', async () => {
    const { s } = await setup();
    expect(await s.save('00000000-0000-0000-0000-00000000dead', 0, patch(), NOW)).toEqual({ ok: false, reason: 'CONFLICT' });
  });
});

describe('MemoryStore — 자리·접속(presence)', () => {
  it('addPlayer: 빈 자리는 성공, 같은 자리/같은 키는 구분된 이유로 거부', async () => {
    const { s, id } = await setup();
    const ok = await s.addPlayer({ roomId: id, seat: 1, playerKey: KB, nickname: '박과장', industry: 1 }, NOW + 10);
    expect(ok.ok).toBe(true);
    expect(await s.addPlayer({ roomId: id, seat: 1, playerKey: H('c'), nickname: 'z', industry: 2 }, NOW + 11)).toEqual({
      ok: false,
      reason: 'SEAT_TAKEN',
    });
    // 같은 브라우저가 다른 자리 요청 → KEY_EXISTS (자리가 비어 있어도)
    await s.removePlayer(id, 1);
    expect(await s.addPlayer({ roomId: id, seat: 1, playerKey: KA, nickname: 'z', industry: 2 }, NOW + 12)).toEqual({
      ok: false,
      reason: 'KEY_EXISTS',
    });
  });

  it('동시에 두 사람이 같은 자리에 들어오면 한 명만', async () => {
    const { s, id } = await setup();
    const rs = await Promise.all([
      s.addPlayer({ roomId: id, seat: 1, playerKey: H('c'), nickname: '가', industry: 0 }, NOW),
      s.addPlayer({ roomId: id, seat: 1, playerKey: H('d'), nickname: '나', industry: 0 }, NOW),
    ]);
    expect(rs.filter((r) => r.ok)).toHaveLength(1);
  });

  it('입퇴장은 방 version을 올리지 않는다', async () => {
    const { s, id } = await setup();
    await s.addPlayer({ roomId: id, seat: 1, playerKey: KB, nickname: '박', industry: 0 }, NOW);
    await s.removePlayer(id, 1);
    expect((await s.load('12345', NOW))?.room.version).toBe(0);
  });

  it('touchPlayer: last_seen만 갱신, version 불변, 자리 없으면 null', async () => {
    const { s, id } = await setup();
    const r = await s.touchPlayer(id, 0, {}, NOW + 2000);
    expect(r?.player.lastSeen).toBe(NOW + 2000);
    expect(r?.viewStateChanged).toBe(false);
    expect((await s.load('12345', NOW + 2000))?.room.version).toBe(0);
    expect(await s.touchPlayer(id, 1, {}, NOW)).toBeNull();
  });

  it('touchPlayer: viewState가 바뀔 때만 viewStateAt이 갱신되고 직전 값을 돌려준다', async () => {
    const { s, id } = await setup();
    const hide = await s.touchPlayer(id, 0, { viewState: 'disguise' }, NOW + 5000);
    expect(hide).toMatchObject({ viewStateChanged: true, previous: { viewState: 'game', viewStateAt: NOW } });
    expect(hide?.player.viewStateAt).toBe(NOW + 5000);
    const again = await s.touchPlayer(id, 0, { viewState: 'disguise' }, NOW + 7000);
    expect(again?.viewStateChanged).toBe(false);
    expect(again?.player.viewStateAt).toBe(NOW + 5000);
    expect(again?.player.lastSeen).toBe(NOW + 7000);
    const back = await s.touchPlayer(id, 0, { viewState: 'game' }, NOW + 9000);
    expect(back?.previous).toEqual({ viewState: 'disguise', viewStateAt: NOW + 5000 });
  });

  it('touchPlayer: 방 만료는 60초 넘게 늘어날 때만 연장', async () => {
    const { s, id } = await setup();
    const base = NOW + 30 * 60_000;
    await s.touchPlayer(id, 0, { extendRoomExpiryTo: base + 30_000 }, NOW);
    expect((await s.load('12345', NOW))?.room.expiresAt).toBe(base);
    await s.touchPlayer(id, 0, { extendRoomExpiryTo: base + 90_000 }, NOW);
    expect((await s.load('12345', NOW))?.room.expiresAt).toBe(base + 90_000);
  });
});

describe('MemoryStore — 매치·이벤트', () => {
  it('startMatch는 같은 id 재호출을 무시하고, endMatch는 첫 마감만 인정', async () => {
    const s = new MemoryStore();
    await s.startMatch(matchInput('m1', 1), NOW);
    await s.startMatch(matchInput('m1', 1), NOW + 1);
    expect(s.debugCounts().matches).toBe(1);
    const end = {
      endedAt: NOW + 1000,
      endReason: 'sunk2' as const,
      winnerSeat: 0 as const,
      rounds: 12,
      hints: [2, 1] as const,
      quizzes: { n: 3 },
      alarmOutcome: ['pass', 'fail'] as const,
    };
    expect(await s.endMatch('m1', end, NOW + 1000)).toBe(true);
    expect(await s.endMatch('m1', { ...end, winnerSeat: 1 }, NOW + 2000)).toBe(false);
    expect(await s.endMatch('nope', end, NOW)).toBe(false);
    const m = await s.getMatch('m1');
    expect(m).toMatchObject({ endReason: 'sunk2', winnerSeat: 0, rounds: 12, hints: [2, 1], alarmOutcome: ['pass', 'fail'] });
    expect(await s.getMatch('zzz')).toBeNull();
  });

  it('같은 방의 같은 순번을 다른 id로 만들면 거부(고유 조건)', async () => {
    const s = new MemoryStore();
    await s.startMatch(matchInput('m1', 1), NOW);
    await expect(s.startMatch(matchInput('m2', 1), NOW)).rejects.toThrow();
  });

  it('insertEvents: dedupeKey가 같으면 한 줄, null은 모두 기록', async () => {
    const s = new MemoryStore();
    const ev = (dedupeKey: string | null) => ({
      at: NOW,
      type: 'feedback' as const,
      roomId: null,
      matchId: null,
      playerKey: KA,
      props: { laugh: 'lol' },
      env: 'development' as const,
      isTest: false,
      dedupeKey,
    });
    expect(await s.insertEvents([ev('k1'), ev('k1'), ev(null), ev(null)])).toBe(3);
    expect(await s.insertEvents([ev('k1')])).toBe(0);
    expect(s.debugEvents()).toHaveLength(3);
  });

  it('원본 키 모양의 player_key 이벤트는 거부', async () => {
    const s = new MemoryStore();
    await expect(
      s.insertEvents([{ at: NOW, type: 'transport', roomId: null, matchId: null, playerKey: 'a'.repeat(32), props: {}, env: 'development', isTest: false, dedupeKey: null }]),
    ).rejects.toBeInstanceOf(StoreUsageError);
  });
});

describe('MemoryStore — 정리(cleanup)', () => {
  it('만료 방을 최대 50개까지, 자리와 함께 지운다. 매치·이벤트는 방과 무관', async () => {
    const s = new MemoryStore();
    for (let i = 0; i < 60; i++) {
      const r = await s.createRoom(roomInput({ code: String(10_000 + i), host: { playerKey: H('a'), nickname: 'x', industry: 0 }, expiresAt: NOW + 1000 }), NOW);
      expect(r.ok).toBe(true);
    }
    await s.createRoom(roomInput({ code: '55555', expiresAt: NOW + DAY_MS }), NOW); // 살아 있는 방
    const first = await s.cleanup(NOW + 5000);
    expect(first.rooms).toBe(50);
    expect(s.debugCounts()).toMatchObject({ rooms: 11, players: 11 });
    const second = await s.cleanup(NOW + 5000);
    expect(second.rooms).toBe(10);
    expect(s.debugCounts()).toMatchObject({ rooms: 1, players: 1 });
    expect(await s.load('55555', NOW + 5000)).not.toBeNull();
  });

  it('90일 지난 매치·이벤트를 각 최대 500행 지운다(경계 이전만)', async () => {
    const s = new MemoryStore();
    const now = NOW + 200 * DAY_MS;
    const old = now - 91 * DAY_MS;
    const fresh = now - 89 * DAY_MS;
    const ev = (at: number) => ({ at, type: 'transport' as const, roomId: null, matchId: null, playerKey: null, props: {}, env: 'production' as const, isTest: false, dedupeKey: null });
    for (let i = 0; i < 520; i++) s.debugPutEvent(ev(old + i));
    s.debugPutEvent(ev(fresh));
    for (let i = 0; i < 3; i++) await s.startMatch(matchInput(`old${i}`, i + 1, { startedAt: old }), now);
    await s.startMatch(matchInput('fresh', 9, { startedAt: fresh }), now);
    const r = await s.cleanup(now);
    expect(r).toEqual({ rooms: 0, matches: 3, events: 500 });
    expect(s.debugCounts()).toMatchObject({ matches: 1, events: 21 });
    expect((await s.cleanup(now)).events).toBe(20);
    expect(s.debugCounts().events).toBe(1);
  });

  it('countActiveRooms는 만료되지 않은 방만 센다', async () => {
    const s = new MemoryStore();
    await s.createRoom(roomInput({ code: '11111', expiresAt: NOW + 10 }), NOW);
    await s.createRoom(roomInput({ code: '22222', expiresAt: NOW + 10_000 }), NOW);
    expect(await s.countActiveRooms(NOW + 100)).toBe(1);
  });
});

describe('MemoryStore — Vercel 가드 · db.ts 선택', () => {
  it('VERCEL / VERCEL_ENV가 있으면 생성 자체가 실패한다', () => {
    vi.stubEnv('VERCEL', '1');
    expect(() => new MemoryStore()).toThrow(/Vercel/);
    vi.unstubAllEnvs();
    vi.stubEnv('VERCEL_ENV', 'preview');
    expect(() => new MemoryStore()).toThrow(/Vercel/);
  });

  it('getStore: 키가 없고 Vercel 밖이면 메모리 싱글톤, Vercel 안이면 null(몰래 메모리로 바꾸지 않음)', () => {
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', '');
    vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', '');
    const a = getStore();
    expect(a?.kind).toBe('memory');
    expect(getStore()).toBe(a);
    resetDbForTests();
    vi.stubEnv('VERCEL_ENV', 'production');
    expect(getStore()).toBeNull();
  });

  it('getStore: URL + 서비스 키가 있으면 supabase', () => {
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'http://127.0.0.1:1');
    vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', 'service-key-for-test');
    expect(getStore()?.kind).toBe('supabase');
  });

  it('currentEnv: production/preview만 그대로, 나머지는 development', () => {
    expect(currentEnv({ VERCEL_ENV: 'production' } as never)).toBe('production');
    expect(currentEnv({ VERCEL_ENV: 'preview' } as never)).toBe('preview');
    expect(currentEnv({ VERCEL_ENV: 'development' } as never)).toBe('development');
    expect(currentEnv({} as never)).toBe('development');
  });
});
