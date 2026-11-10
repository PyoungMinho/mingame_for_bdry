import { describe, expect, it } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import { DAY_MS, StoreUnavailableError, StoreUsageError, type NewEvent } from './store';
import { SupabaseStore } from './store-supabase';

// ─── 가짜 클라이언트: 호출을 기록하고, 핸들러가 정한 응답을 돌려준다 ───────────────────
interface Call {
  table: string;
  op: 'select' | 'insert' | 'update' | 'delete' | 'upsert';
  payload?: unknown;
  opts?: Record<string, unknown>;
  selectCols?: string;
  selectOpts?: Record<string, unknown>;
  filters: Array<[string, string, unknown]>;
  order?: [string, unknown];
  limit?: number;
  single?: 'single' | 'maybeSingle';
}
interface Reply {
  data?: unknown;
  error?: { code?: string; message?: string; details?: string } | null;
  count?: number | null;
}
type Handler = (c: Call, index: number) => Reply;

class FakeQuery implements PromiseLike<Reply> {
  constructor(
    readonly call: Call,
    private readonly run: () => Reply,
  ) {}
  select(cols?: string, opts?: Record<string, unknown>) {
    this.call.selectCols = cols ?? '*';
    this.call.selectOpts = opts;
    return this;
  }
  private f(kind: string, col: string, v: unknown) {
    this.call.filters.push([kind, col, v]);
    return this;
  }
  eq(c: string, v: unknown) { return this.f('eq', c, v); }
  neq(c: string, v: unknown) { return this.f('neq', c, v); }
  lt(c: string, v: unknown) { return this.f('lt', c, v); }
  lte(c: string, v: unknown) { return this.f('lte', c, v); }
  gt(c: string, v: unknown) { return this.f('gt', c, v); }
  is(c: string, v: unknown) { return this.f('is', c, v); }
  in(c: string, v: unknown) { return this.f('in', c, v); }
  order(c: string, o: unknown) { this.call.order = [c, o]; return this; }
  limit(n: number) { this.call.limit = n; return this; }
  single() { this.call.single = 'single'; return this; }
  maybeSingle() { this.call.single = 'maybeSingle'; return this; }
  then<R1 = Reply, R2 = never>(ok?: ((v: Reply) => R1 | PromiseLike<R1>) | null, ng?: ((e: unknown) => R2 | PromiseLike<R2>) | null) {
    return Promise.resolve().then(() => this.run()).then(ok, ng);
  }
}

function fake(handler: Handler) {
  const calls: Call[] = [];
  const make = (table: string, op: Call['op'], payload?: unknown, opts?: Record<string, unknown>) => {
    const call: Call = { table, op, payload, opts, filters: [] };
    calls.push(call);
    const index = calls.length - 1;
    return new FakeQuery(call, () => {
      const r = handler(call, index);
      return { data: r.data ?? null, error: r.error ?? null, count: r.count ?? null };
    });
  };
  const client = {
    from: (table: string) => ({
      select: (cols?: string, opts?: Record<string, unknown>) => make(table, 'select').select(cols, opts),
      insert: (p: unknown) => make(table, 'insert', p),
      update: (p: unknown) => make(table, 'update', p),
      delete: () => make(table, 'delete'),
      upsert: (p: unknown, o?: Record<string, unknown>) => make(table, 'upsert', p, o),
    }),
  };
  return { store: new SupabaseStore(client as unknown as SupabaseClient), calls };
}

const H = (c: string) => c.repeat(64);
const NOW = 1_800_000_000_000;
const iso = (ms: number) => new Date(ms).toISOString();
const roomRow = (over: Record<string, unknown> = {}) => ({
  id: 'room-1', code: '12345', status: 'waiting', version: 3, state: { a: 1 }, settings: { alarmOn: true },
  env: 'production', is_test: false, expires_at: iso(NOW + 1000), created_at: iso(NOW - 1000), updated_at: iso(NOW - 500), ...over,
});
const playerRow = (seat: number, over: Record<string, unknown> = {}) => ({
  room_id: 'room-1', seat, player_key: seat === 0 ? H('a') : H('b'), nickname: seat === 0 ? '가' : '나', industry: 1,
  last_seen: iso(NOW - 100), view_state: 'game', view_state_at: iso(NOW - 5000), created_at: iso(NOW - 9000), ...over,
});

describe('SupabaseStore.load', () => {
  it('방 + 자리를 mc_rooms 한 번의 임베딩 조회로 읽고 만료 조건을 건다', async () => {
    const { store, calls } = fake(() => ({ data: { ...roomRow(), mc_players: [playerRow(1), playerRow(0)] } }));
    const snap = await store.load('12345', NOW);
    expect(calls).toHaveLength(1);
    expect(calls[0]).toMatchObject({ table: 'mc_rooms', op: 'select', selectCols: '*, mc_players(*)', single: 'maybeSingle' });
    expect(calls[0].filters).toEqual([['eq', 'code', '12345'], ['gt', 'expires_at', iso(NOW)]]);
    expect(snap?.room).toMatchObject({ id: 'room-1', version: 3, isTest: false, env: 'production', expiresAt: NOW + 1000 });
    expect(snap?.players[0]?.nickname).toBe('가');
    expect(snap?.players[1]?.nickname).toBe('나');
    expect(snap?.players[1]).toMatchObject({ lastSeen: NOW - 100, viewStateAt: NOW - 5000, joinedAt: NOW - 9000 });
  });

  it('방이 없으면 null, 자리가 하나만 있으면 다른 쪽은 null', async () => {
    expect(await fake(() => ({ data: null })).store.load('1', NOW)).toBeNull();
    const { store } = fake(() => ({ data: { ...roomRow(), mc_players: [playerRow(0)] } }));
    const snap = await store.load('12345', NOW);
    expect(snap?.players[1]).toBeNull();
  });

  it('DB 오류는 StoreUnavailableError(상태 내용은 메시지에 없음)', async () => {
    const { store } = fake(() => ({ error: { code: '57P01', message: 'secret state {"boards":1}' } }));
    const err = await store.load('12345', NOW).catch((e) => e);
    expect(err).toBeInstanceOf(StoreUnavailableError);
    expect(String(err.message)).not.toContain('boards');
  });
});

describe('SupabaseStore.save (비교 저장)', () => {
  it('WHERE id AND version = expected, SET version = expected+1 한 문장', async () => {
    const { store, calls } = fake(() => ({ data: [{ version: 8 }] }));
    const r = await store.save('room-1', 7, { state: { x: 1 }, status: 'playing', expiresAt: NOW + 5 }, NOW);
    expect(r).toEqual({ ok: true, version: 8 });
    expect(calls).toHaveLength(1);
    expect(calls[0]).toMatchObject({ table: 'mc_rooms', op: 'update', selectCols: 'version' });
    expect(calls[0].filters).toEqual([['eq', 'id', 'room-1'], ['eq', 'version', 7]]);
    expect(calls[0].payload).toEqual({ state: { x: 1 }, status: 'playing', expires_at: iso(NOW + 5), updated_at: iso(NOW), version: 8 });
  });

  it('settings를 주면 함께 쓰고, 0행이면 CONFLICT', async () => {
    const { store, calls } = fake(() => ({ data: [] }));
    const r = await store.save('room-1', 0, { state: {}, status: 'waiting', settings: { alarmOn: false }, expiresAt: NOW }, NOW);
    expect(r).toEqual({ ok: false, reason: 'CONFLICT' });
    expect((calls[0].payload as Record<string, unknown>).settings).toEqual({ alarmOn: false });
  });

  it('오류는 CONFLICT가 아니라 StoreUnavailableError', async () => {
    const { store } = fake(() => ({ error: { code: '08006' } }));
    await expect(store.save('r', 0, { state: {}, status: 'waiting', expiresAt: NOW }, NOW)).rejects.toBeInstanceOf(StoreUnavailableError);
  });
});

describe('SupabaseStore.createRoom', () => {
  const input = {
    code: '12345', state: { s: 1 }, settings: {}, env: 'preview' as const, isTest: true, expiresAt: NOW + 1800_000,
    host: { playerKey: H('a'), nickname: '가', industry: 2 as const },
  };

  it('만료된 같은 번호 방 삭제 → 방 insert → 방장 insert(0번)', async () => {
    const { store, calls } = fake((c) => {
      if (c.op === 'insert' && c.table === 'mc_rooms') return { data: roomRow({ version: 0 }) };
      if (c.op === 'insert' && c.table === 'mc_players') return { data: playerRow(0) };
      return {};
    });
    const r = await store.createRoom(input, NOW);
    expect(r.ok).toBe(true);
    expect(calls.map((c) => `${c.op}:${c.table}`)).toEqual(['delete:mc_rooms', 'insert:mc_rooms', 'insert:mc_players']);
    expect(calls[0].filters).toEqual([['eq', 'code', '12345'], ['lte', 'expires_at', iso(NOW)]]);
    expect(calls[1].payload).toMatchObject({ code: '12345', version: 0, env: 'preview', is_test: true, status: 'waiting' });
    expect(calls[2].payload).toMatchObject({ room_id: 'room-1', seat: 0, player_key: H('a'), nickname: '가', industry: 2, view_state: 'game' });
  });

  it('방 번호 고유 위반이면 CODE_TAKEN', async () => {
    const { store } = fake((c) => (c.op === 'insert' ? { error: { code: '23505', message: 'mc_rooms_code_uq' } } : {}));
    expect(await store.createRoom(input, NOW)).toEqual({ ok: false, reason: 'CODE_TAKEN' });
  });

  it('방장 insert가 실패하면 방을 되돌려 지우고 오류를 던진다', async () => {
    const { store, calls } = fake((c) => {
      if (c.op === 'insert' && c.table === 'mc_rooms') return { data: roomRow() };
      if (c.op === 'insert' && c.table === 'mc_players') return { error: { code: '57014' } };
      return {};
    });
    await expect(store.createRoom(input, NOW)).rejects.toBeInstanceOf(StoreUnavailableError);
    const last = calls[calls.length - 1];
    expect(last).toMatchObject({ op: 'delete', table: 'mc_rooms' });
    expect(last.filters).toEqual([['eq', 'id', 'room-1']]);
  });

  it('원본 키 모양은 쿼리 전에 막는다', async () => {
    const { store, calls } = fake(() => ({}));
    await expect(store.createRoom({ ...input, host: { ...input.host, playerKey: 'a'.repeat(32) } }, NOW)).rejects.toBeInstanceOf(StoreUsageError);
    expect(calls).toHaveLength(0);
  });
});

describe('SupabaseStore.addPlayer / removePlayer', () => {
  const p = { roomId: 'room-1', seat: 1 as const, playerKey: H('b'), nickname: '나', industry: 0 as const };

  it('성공 시 mc_players insert', async () => {
    const { store, calls } = fake(() => ({ data: playerRow(1) }));
    const r = await store.addPlayer(p, NOW);
    expect(r.ok).toBe(true);
    expect(calls[0]).toMatchObject({ table: 'mc_players', op: 'insert' });
  });

  it('제약 이름으로 SEAT_TAKEN / KEY_EXISTS를 구분', async () => {
    const seat = fake(() => ({ error: { code: '23505', message: 'duplicate key value violates unique constraint "mc_players_room_seat_uq"' } }));
    expect(await seat.store.addPlayer(p, NOW)).toEqual({ ok: false, reason: 'SEAT_TAKEN' });
    const key = fake(() => ({ error: { code: '23505', message: 'duplicate key value violates unique constraint "mc_players_room_key_uq"' } }));
    expect(await key.store.addPlayer(p, NOW)).toEqual({ ok: false, reason: 'KEY_EXISTS' });
  });

  it('그 밖의 오류는 던진다 / removePlayer는 방+자리로 delete', async () => {
    await expect(fake(() => ({ error: { code: '08006' } })).store.addPlayer(p, NOW)).rejects.toBeInstanceOf(StoreUnavailableError);
    const { store, calls } = fake(() => ({}));
    await store.removePlayer('room-1', 1);
    expect(calls[0]).toMatchObject({ table: 'mc_players', op: 'delete' });
    expect(calls[0].filters).toEqual([['eq', 'room_id', 'room-1'], ['eq', 'seat', 1]]);
  });
});

describe('SupabaseStore.touchPlayer', () => {
  it('보통의 sync: UPDATE 한 번(last_seen), mc_rooms는 건드리지 않는다', async () => {
    const { store, calls } = fake(() => ({ data: playerRow(0) }));
    const r = await store.touchPlayer('room-1', 0, {}, NOW);
    expect(calls).toHaveLength(1);
    expect(calls[0]).toMatchObject({ table: 'mc_players', op: 'update' });
    expect(Object.keys(calls[0].payload as object).sort()).toEqual(['last_seen', 'updated_at']);
    expect(r?.viewStateChanged).toBe(false);
  });

  it('같은 viewState를 다시 보고하면 두 번째 쿼리가 없다', async () => {
    const { store, calls } = fake(() => ({ data: playerRow(0, { view_state: 'disguise' }) }));
    const r = await store.touchPlayer('room-1', 0, { viewState: 'disguise' }, NOW);
    expect(calls).toHaveLength(1);
    expect(r?.viewStateChanged).toBe(false);
  });

  it('viewState가 바뀌면 옛 값일 때만 바꾸는 UPDATE를 한 번 더 보내고 직전 값을 돌려준다', async () => {
    const { store, calls } = fake((c, i) => ({ data: i === 0 ? playerRow(0) : playerRow(0, { view_state: 'disguise', view_state_at: iso(NOW) }) }));
    const r = await store.touchPlayer('room-1', 0, { viewState: 'disguise' }, NOW);
    expect(calls).toHaveLength(2);
    expect(calls[1].payload).toMatchObject({ view_state: 'disguise', view_state_at: iso(NOW) });
    expect(calls[1].filters).toEqual([['eq', 'room_id', 'room-1'], ['eq', 'seat', 0], ['eq', 'view_state', 'game']]);
    expect(r).toMatchObject({ viewStateChanged: true, previous: { viewState: 'game', viewStateAt: NOW - 5000 } });
    expect(r?.player.viewState).toBe('disguise');
  });

  it('두 번째 UPDATE가 0행(다른 탭이 먼저)이면 changed=false', async () => {
    const { store } = fake((c, i) => ({ data: i === 0 ? playerRow(0) : null }));
    const r = await store.touchPlayer('room-1', 0, { viewState: 'disguise' }, NOW);
    expect(r?.viewStateChanged).toBe(false);
  });

  it('방 만료 연장은 "60초 넘게 늘어날 때만" 조건부 UPDATE, 자리가 없으면 null', async () => {
    const { store, calls } = fake((c) => (c.table === 'mc_players' ? { data: null } : {}));
    const r = await store.touchPlayer('room-1', 1, { extendRoomExpiryTo: NOW + 1_800_000 }, NOW);
    expect(r).toBeNull();
    const ext = calls.find((c) => c.table === 'mc_rooms')!;
    expect(ext.op).toBe('update');
    expect(ext.payload).toEqual({ expires_at: iso(NOW + 1_800_000) });
    expect(ext.filters).toEqual([['eq', 'id', 'room-1'], ['lt', 'expires_at', iso(NOW + 1_800_000 - 60_000)]]);
  });
});

describe('SupabaseStore 매치·이벤트', () => {
  const match = { id: 'm1', roomId: 'room-1', seq: 1, rematchOf: null, hostKey: H('a'), playerKeys: [H('a'), H('b')] as const, startedAt: NOW, alarmOn: true, env: 'production' as const, isTest: false };

  it('startMatch: id 충돌은 무시하는 upsert, 닉네임 같은 열이 없다', async () => {
    const { store, calls } = fake(() => ({}));
    await store.startMatch(match, NOW);
    expect(calls[0]).toMatchObject({ table: 'mc_matches', op: 'upsert', opts: { onConflict: 'id', ignoreDuplicates: true } });
    const row = calls[0].payload as Record<string, unknown>;
    expect(row).toMatchObject({ id: 'm1', room_id: 'room-1', seq: 1, player_keys: [H('a'), H('b')], started_at: iso(NOW) });
    expect(Object.keys(row).some((k) => /nick|name|ip|agent/i.test(k))).toBe(false);
  });

  it('endMatch: ended_at이 비어 있을 때만 UPDATE → 갱신 행 유무가 반환값', async () => {
    const end = { endedAt: NOW, endReason: 'cap' as const, winnerSeat: null, rounds: 30, hints: [1, 2] as const, quizzes: { n: 1 }, alarmOutcome: null };
    const hit = fake(() => ({ data: [{ id: 'm1' }] }));
    expect(await hit.store.endMatch('m1', end, NOW)).toBe(true);
    expect(hit.calls[0].filters).toEqual([['eq', 'id', 'm1'], ['is', 'ended_at', null]]);
    expect(hit.calls[0].payload).toMatchObject({ end_reason: 'cap', winner_seat: null, rounds: 30, hints: [1, 2], alarm_outcome: null });
    expect(await fake(() => ({ data: [] })).store.endMatch('m1', end, NOW)).toBe(false);
  });

  it('getMatch 변환', async () => {
    const { store } = fake(() => ({
      data: { id: 'm1', room_id: 'room-1', seq: 2, rematch_of: 'm0', host_key: H('a'), player_keys: [H('a'), H('b')], started_at: iso(NOW), ended_at: iso(NOW + 9), end_reason: 'sunk2', winner_seat: 1, rounds: 9, hints: [1, 0], quizzes: {}, alarm_on: false, alarm_outcome: ['pass', null], env: 'production', is_test: false },
    }));
    const m = await store.getMatch('m1');
    expect(m).toMatchObject({ seq: 2, rematchOf: 'm0', endedAt: NOW + 9, winnerSeat: 1, hints: [1, 0], alarmOutcome: ['pass', null] });
  });

  const ev = (over: Partial<NewEvent> = {}): NewEvent => ({ at: NOW, type: 'feedback', roomId: 'room-1', matchId: 'm1', playerKey: H('b'), props: { laugh: 'lol' }, env: 'production', isTest: false, dedupeKey: 'feedback:m1:b', ...over });

  it('insertEvents: dedupe_key 충돌은 무시하는 upsert, 넣은 행 수를 돌려준다', async () => {
    const { store, calls } = fake(() => ({ data: [{ id: 1 }] }));
    expect(await store.insertEvents([ev(), ev({ dedupeKey: null })])).toBe(1);
    expect(calls[0]).toMatchObject({ table: 'mc_events', op: 'upsert', opts: { onConflict: 'dedupe_key', ignoreDuplicates: true } });
    const rows = calls[0].payload as Array<Record<string, unknown>>;
    expect(rows[0]).toEqual({ at: iso(NOW), type: 'feedback', room_id: 'room-1', match_id: 'm1', player_key: H('b'), props: { laugh: 'lol' }, dedupe_key: 'feedback:m1:b', env: 'production', is_test: false });
  });

  it('빈 배열은 쿼리 없음', async () => {
    const { store, calls } = fake(() => ({}));
    expect(await store.insertEvents([])).toBe(0);
    expect(calls).toHaveLength(0);
  });
});

describe('SupabaseStore.countActiveRooms / health / cleanup', () => {
  it('countActiveRooms: head count + 만료 조건', async () => {
    const { store, calls } = fake(() => ({ count: 42 }));
    expect(await store.countActiveRooms(NOW)).toBe(42);
    expect(calls[0]).toMatchObject({ table: 'mc_rooms', selectOpts: { count: 'exact', head: true } });
    expect(calls[0].filters).toEqual([['gt', 'expires_at', iso(NOW)]]);
  });

  it('health: 오류/예외면 false', async () => {
    expect(await fake(() => ({ data: [] })).store.health()).toBe(true);
    expect(await fake(() => ({ error: { code: 'x' } })).store.health()).toBe(false);
    expect(await fake(() => { throw new Error('net'); }).store.health()).toBe(false);
  });

  it('cleanup: 오래된 순으로 한도만큼 id를 고르고 100개씩 나눠 지운다', async () => {
    const ids = (n: number, prefix: string) => Array.from({ length: n }, (_, i) => ({ id: `${prefix}${i}` }));
    const { store, calls } = fake((c) => {
      if (c.op === 'select') return { data: c.table === 'mc_rooms' ? ids(50, 'r') : c.table === 'mc_matches' ? ids(250, 'm') : ids(3, 'e') };
      return {};
    });
    const res = await store.cleanup(NOW);
    expect(res).toEqual({ rooms: 50, matches: 250, events: 3 });

    const sel = calls.filter((c) => c.op === 'select');
    expect(sel.map((c) => [c.table, c.limit])).toEqual([['mc_rooms', 50], ['mc_matches', 500], ['mc_events', 500]]);
    expect(sel[0].filters).toEqual([['lte', 'expires_at', iso(NOW)]]);
    expect(sel[1].filters).toEqual([['lt', 'started_at', iso(NOW - 90 * DAY_MS)]]);
    expect(sel[2].filters).toEqual([['lt', 'at', iso(NOW - 90 * DAY_MS)]]);
    expect(sel[0].order).toEqual(['expires_at', { ascending: true }]);

    const dels = calls.filter((c) => c.op === 'delete');
    expect(dels.map((c) => c.table)).toEqual(['mc_rooms', 'mc_matches', 'mc_matches', 'mc_matches', 'mc_events']);
    expect((dels[1].filters[0][2] as string[]).length).toBe(100);
    expect((dels[3].filters[0][2] as string[]).length).toBe(50);
  });

  it('cleanup: 지울 것이 없으면 delete를 보내지 않는다', async () => {
    const { store, calls } = fake(() => ({ data: [] }));
    expect(await store.cleanup(NOW)).toEqual({ rooms: 0, matches: 0, events: 0 });
    expect(calls.some((c) => c.op === 'delete')).toBe(false);
  });
});

describe('SupabaseStore — 모든 쿼리가 mc_ 테이블만 쓴다', () => {
  it('createRoom~cleanup 전 경로의 table 이름', async () => {
    const { store, calls } = fake((c) => {
      if (c.op === 'select') return { data: c.single ? { ...roomRow(), mc_players: [] } : [{ id: 'x' }], count: 0 };
      if (c.op === 'insert') return { data: c.table === 'mc_rooms' ? roomRow() : playerRow(0) };
      return { data: [{ id: 1, version: 1 }] };
    });
    await store.createRoom({ code: '12345', state: {}, settings: {}, env: 'production', isTest: false, expiresAt: NOW, host: { playerKey: H('a'), nickname: 'a', industry: 0 } }, NOW);
    await store.load('12345', NOW);
    await store.save('r', 0, { state: {}, status: 'waiting', expiresAt: NOW }, NOW);
    await store.touchPlayer('r', 0, { viewState: 'disguise', extendRoomExpiryTo: NOW + 999_999 }, NOW);
    await store.countActiveRooms(NOW);
    await store.cleanup(NOW);
    await store.health();
    expect(calls.length).toBeGreaterThan(10);
    for (const c of calls) expect(c.table).toMatch(/^mc_(rooms|players|matches|events)$/);
  });
});
