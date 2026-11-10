/**
 * SupabaseStore — 운영용 RoomStore. 서비스 키(RLS 우회) 클라이언트를 생성자로 받는다(db.ts가 만든다).
 *
 * - 모든 테이블은 mc_ 접두. 읽기는 load 한 번에 방 + 자리를 끝낸다(PostgREST 리소스 임베딩).
 * - CAS: `UPDATE … SET version = expected + 1 WHERE id = ? AND version = expected` 한 문장. 0행이면 CONFLICT.
 * - 게임 규칙은 DB에 두지 않는다(함수·트리거 없음). 정리는 방 만들기마다 호출되는 cleanup()이 한다.
 * - 오류는 StoreUnavailableError로 감싼다. 메시지에는 테이블·연산 이름만 넣고 state·키 값은 넣지 않는다.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import type { IndustryId } from '../constants';
import type { AlarmOutcome, EndReason, RoomStatus, Seat, ViewState } from '../protocol';
import {
  DAY_MS,
  DEFAULT_CLEANUP,
  EXPIRY_EXTEND_MIN_GAP_MS,
  StoreUnavailableError,
  assertKeyHash,
  type AddPlayerResult,
  type CleanupLimits,
  type CleanupResult,
  type CreateRoomInput,
  type CreateRoomResult,
  type JsonObject,
  type McEnv,
  type MatchEnd,
  type NewEvent,
  type NewMatch,
  type NewPlayer,
  type RoomPatch,
  type RoomSnapshot,
  type RoomStore,
  type SaveResult,
  type StoredMatch,
  type StoredPlayer,
  type StoredRoom,
  type TouchInput,
  type TouchResult,
} from './store';

export const T_ROOMS = 'mc_rooms';
export const T_PLAYERS = 'mc_players';
export const T_MATCHES = 'mc_matches';
export const T_EVENTS = 'mc_events';

/** IN (...) 삭제 한 번에 보내는 id 수(URL 길이 제한 회피) */
const DELETE_CHUNK = 100;
const PG_UNIQUE_VIOLATION = '23505';

// ─── 행 모양(snake_case) ──────────────────────────────────────────────────────

interface RoomRow {
  id: string;
  code: string;
  status: string;
  version: number;
  state: JsonObject;
  settings: JsonObject;
  env: string;
  is_test: boolean;
  expires_at: string;
  created_at: string;
  updated_at: string;
}
interface PlayerRow {
  room_id: string;
  seat: number;
  player_key: string;
  nickname: string;
  industry: number;
  last_seen: string;
  view_state: string;
  view_state_at: string;
  created_at: string;
}
interface MatchRow {
  id: string;
  room_id: string;
  seq: number;
  rematch_of: string | null;
  host_key: string;
  player_keys: string[];
  started_at: string;
  ended_at: string | null;
  end_reason: string | null;
  winner_seat: number | null;
  rounds: number | null;
  hints: number[] | null;
  quizzes: JsonObject | null;
  alarm_on: boolean;
  alarm_outcome: (string | null)[] | null;
  env: string;
  is_test: boolean;
}
type RoomWithPlayers = RoomRow & { mc_players: PlayerRow[] | null };

// ─── 변환 ────────────────────────────────────────────────────────────────────

const iso = (ms: number): string => new Date(ms).toISOString();
const ms = (s: string): number => Date.parse(s);

export function toRoom(r: RoomRow): StoredRoom {
  return {
    id: r.id,
    code: r.code,
    status: r.status as RoomStatus,
    version: r.version,
    state: r.state,
    settings: r.settings,
    env: r.env as McEnv,
    isTest: r.is_test,
    expiresAt: ms(r.expires_at),
    createdAt: ms(r.created_at),
    updatedAt: ms(r.updated_at),
  };
}

export function toPlayer(p: PlayerRow): StoredPlayer {
  return {
    roomId: p.room_id,
    seat: p.seat as Seat,
    playerKey: p.player_key,
    nickname: p.nickname,
    industry: p.industry as IndustryId,
    lastSeen: ms(p.last_seen),
    viewState: p.view_state as ViewState,
    viewStateAt: ms(p.view_state_at),
    joinedAt: ms(p.created_at),
  };
}

export function toMatch(m: MatchRow): StoredMatch {
  return {
    id: m.id,
    roomId: m.room_id,
    seq: m.seq,
    rematchOf: m.rematch_of,
    hostKey: m.host_key,
    playerKeys: [m.player_keys[0], m.player_keys[1]],
    startedAt: ms(m.started_at),
    endedAt: m.ended_at === null ? null : ms(m.ended_at),
    endReason: m.end_reason as EndReason | null,
    winnerSeat: m.winner_seat as Seat | null,
    rounds: m.rounds,
    hints: m.hints ? [m.hints[0], m.hints[1]] : null,
    quizzes: m.quizzes,
    alarmOn: m.alarm_on,
    alarmOutcome: m.alarm_outcome ? [m.alarm_outcome[0] as AlarmOutcome | null, m.alarm_outcome[1] as AlarmOutcome | null] : null,
    env: m.env as McEnv,
    isTest: m.is_test,
  };
}

function snapshotOf(row: RoomWithPlayers): RoomSnapshot {
  const slots: [StoredPlayer | null, StoredPlayer | null] = [null, null];
  for (const p of row.mc_players ?? []) {
    if (p.seat === 0 || p.seat === 1) slots[p.seat] = toPlayer(p);
  }
  const { mc_players: _omit, ...roomRow } = row;
  void _omit;
  return { room: toRoom(roomRow), players: slots };
}

interface PgErr {
  code?: string;
  message?: string;
  details?: string;
}
function fail(op: string, error: PgErr): never {
  throw new StoreUnavailableError(`mc store ${op}: ${error.code ?? 'ERR'}`, error);
}

// ─── 구현 ────────────────────────────────────────────────────────────────────

export class SupabaseStore implements RoomStore {
  readonly kind = 'supabase' as const;

  constructor(private readonly db: SupabaseClient) {}

  async health(): Promise<boolean> {
    try {
      const { error } = await this.db.from(T_ROOMS).select('id').limit(1);
      return !error;
    } catch {
      return false;
    }
  }

  async createRoom(input: CreateRoomInput, now: number): Promise<CreateRoomResult> {
    assertKeyHash(input.host.playerKey, 'host.playerKey');
    // 같은 번호의 만료된 방이 번호를 쥐고 있으면 먼저 치운다(살아 있는 방은 조건에 안 걸려 그대로 남는다)
    const purge = await this.db.from(T_ROOMS).delete().eq('code', input.code).lte('expires_at', iso(now));
    if (purge.error) fail('createRoom.purge', purge.error);

    const roomInsert: Record<string, unknown> = {
      code: input.code,
      status: input.status ?? 'waiting',
      version: 0,
      state: input.state,
      settings: input.settings,
      env: input.env,
      is_test: input.isTest,
      expires_at: iso(input.expiresAt),
      created_at: iso(now),
      updated_at: iso(now),
    };
    if (input.id) roomInsert.id = input.id;
    const r = await this.db.from(T_ROOMS).insert(roomInsert).select().single();
    if (r.error) {
      if (r.error.code === PG_UNIQUE_VIOLATION) return { ok: false, reason: 'CODE_TAKEN' };
      fail('createRoom.room', r.error);
    }
    const room = r.data as RoomRow;

    const p = await this.db
      .from(T_PLAYERS)
      .insert({
        room_id: room.id,
        seat: 0,
        player_key: input.host.playerKey,
        nickname: input.host.nickname,
        industry: input.host.industry,
        last_seen: iso(now),
        view_state: 'game',
        view_state_at: iso(now),
        created_at: iso(now),
        updated_at: iso(now),
      })
      .select()
      .single();
    if (p.error) {
      // 방만 남으면 번호만 쥐고 있는 유령 방이 된다 → 되돌리기(실패해도 만료 정리가 치운다)
      await this.db.from(T_ROOMS).delete().eq('id', room.id);
      fail('createRoom.host', p.error);
    }
    return { ok: true, snapshot: { room: toRoom(room), players: [toPlayer(p.data as PlayerRow), null] } };
  }

  async load(code: string, now: number): Promise<RoomSnapshot | null> {
    const { data, error } = await this.db
      .from(T_ROOMS)
      .select('*, mc_players(*)')
      .eq('code', code)
      .gt('expires_at', iso(now))
      .maybeSingle();
    if (error) fail('load', error);
    return data ? snapshotOf(data as unknown as RoomWithPlayers) : null;
  }

  async save(roomId: string, expectedVersion: number, patch: RoomPatch, now: number): Promise<SaveResult> {
    const update: Record<string, unknown> = {
      state: patch.state,
      status: patch.status,
      expires_at: iso(patch.expiresAt),
      updated_at: iso(now),
      version: expectedVersion + 1,
    };
    if (patch.settings) update.settings = patch.settings;
    const { data, error } = await this.db
      .from(T_ROOMS)
      .update(update)
      .eq('id', roomId)
      .eq('version', expectedVersion)
      .select('version');
    if (error) fail('save', error);
    if (!data || data.length === 0) return { ok: false, reason: 'CONFLICT' };
    return { ok: true, version: expectedVersion + 1 };
  }

  async addPlayer(input: NewPlayer, now: number): Promise<AddPlayerResult> {
    assertKeyHash(input.playerKey, 'playerKey');
    const { data, error } = await this.db
      .from(T_PLAYERS)
      .insert({
        room_id: input.roomId,
        seat: input.seat,
        player_key: input.playerKey,
        nickname: input.nickname,
        industry: input.industry,
        last_seen: iso(now),
        view_state: 'game',
        view_state_at: iso(now),
        created_at: iso(now),
        updated_at: iso(now),
      })
      .select()
      .single();
    if (error) {
      if (error.code === PG_UNIQUE_VIOLATION) {
        // 제약 이름(mc_players_room_key_uq / mc_players_room_seat_uq)으로 어느 쪽인지 가른다
        const text = `${error.message ?? ''} ${error.details ?? ''}`;
        if (text.includes('room_key')) return { ok: false, reason: 'KEY_EXISTS' };
        return { ok: false, reason: 'SEAT_TAKEN' };
      }
      fail('addPlayer', error);
    }
    return { ok: true, player: toPlayer(data as PlayerRow) };
  }

  async removePlayer(roomId: string, seat: Seat, onlyKey?: string): Promise<void> {
    let q = this.db.from(T_PLAYERS).delete().eq('room_id', roomId).eq('seat', seat);
    if (onlyKey !== undefined) q = q.eq('player_key', onlyKey);
    const { error } = await q;
    if (error) fail('removePlayer', error);
  }

  async touchPlayer(roomId: string, seat: Seat, input: TouchInput, now: number): Promise<TouchResult | null> {
    // ① last_seen 갱신(+ 필요하면 방 만료 연장, 서로 독립이라 함께 보낸다)
    const touch = this.db
      .from(T_PLAYERS)
      .update({ last_seen: iso(now), updated_at: iso(now) })
      .eq('room_id', roomId)
      .eq('seat', seat)
      .select()
      .maybeSingle();
    const extend =
      input.extendRoomExpiryTo !== undefined
        ? this.db
            .from(T_ROOMS)
            .update({ expires_at: iso(input.extendRoomExpiryTo) })
            .eq('id', roomId)
            .lt('expires_at', iso(input.extendRoomExpiryTo - EXPIRY_EXTEND_MIN_GAP_MS))
        : null;
    const [t, e] = await Promise.all([touch, extend]);
    if (t.error) fail('touchPlayer', t.error);
    if (e && e.error) fail('touchPlayer.extend', e.error);
    if (!t.data) return null;

    const before = toPlayer(t.data as PlayerRow); // viewState는 아직 옛 값
    const previous = { viewState: before.viewState, viewStateAt: before.viewStateAt };
    if (input.viewState === undefined || input.viewState === before.viewState) {
      return { player: before, viewStateChanged: false, previous };
    }

    // ② 바뀐 경우에만: 옛 값일 때만 바꾼다(탭 둘이 동시에 보고해도 시작 시각은 한 번만 기록)
    const v = await this.db
      .from(T_PLAYERS)
      .update({ view_state: input.viewState, view_state_at: iso(now), updated_at: iso(now) })
      .eq('room_id', roomId)
      .eq('seat', seat)
      .eq('view_state', before.viewState)
      .select()
      .maybeSingle();
    if (v.error) fail('touchPlayer.view', v.error);
    if (!v.data) return { player: before, viewStateChanged: false, previous };
    return { player: toPlayer(v.data as PlayerRow), viewStateChanged: true, previous };
  }

  async startMatch(match: NewMatch, now: number): Promise<void> {
    assertKeyHash(match.hostKey, 'hostKey');
    for (const k of match.playerKeys) assertKeyHash(k, 'playerKeys');
    const { error } = await this.db.from(T_MATCHES).upsert(
      {
        id: match.id,
        room_id: match.roomId,
        seq: match.seq,
        rematch_of: match.rematchOf,
        host_key: match.hostKey,
        player_keys: [match.playerKeys[0], match.playerKeys[1]],
        started_at: iso(match.startedAt),
        alarm_on: match.alarmOn,
        env: match.env,
        is_test: match.isTest,
        created_at: iso(now),
        updated_at: iso(now),
      },
      { onConflict: 'id', ignoreDuplicates: true },
    );
    if (error) fail('startMatch', error);
  }

  async endMatch(matchId: string, end: MatchEnd, now: number): Promise<boolean> {
    const { data, error } = await this.db
      .from(T_MATCHES)
      .update({
        ended_at: iso(end.endedAt),
        end_reason: end.endReason,
        winner_seat: end.winnerSeat,
        rounds: end.rounds,
        hints: [end.hints[0], end.hints[1]],
        quizzes: end.quizzes,
        alarm_outcome: end.alarmOutcome ? [end.alarmOutcome[0], end.alarmOutcome[1]] : null,
        updated_at: iso(now),
      })
      .eq('id', matchId)
      .is('ended_at', null)
      .select('id');
    if (error) fail('endMatch', error);
    return Boolean(data && data.length > 0);
  }

  async getMatch(matchId: string): Promise<StoredMatch | null> {
    const { data, error } = await this.db.from(T_MATCHES).select('*').eq('id', matchId).maybeSingle();
    if (error) fail('getMatch', error);
    return data ? toMatch(data as unknown as MatchRow) : null;
  }

  async insertEvents(events: readonly NewEvent[]): Promise<number> {
    if (events.length === 0) return 0;
    for (const e of events) if (e.playerKey !== null) assertKeyHash(e.playerKey, 'event.playerKey');
    const rows = events.map((e) => ({
      at: iso(e.at),
      type: e.type,
      room_id: e.roomId,
      match_id: e.matchId,
      player_key: e.playerKey,
      props: e.props,
      dedupe_key: e.dedupeKey,
      env: e.env,
      is_test: e.isTest,
    }));
    const { data, error } = await this.db
      .from(T_EVENTS)
      .upsert(rows, { onConflict: 'dedupe_key', ignoreDuplicates: true })
      .select('id');
    if (error) fail('insertEvents', error);
    return data ? data.length : 0;
  }

  async countActiveRooms(now: number): Promise<number> {
    const { count, error } = await this.db
      .from(T_ROOMS)
      .select('id', { count: 'exact', head: true })
      .gt('expires_at', iso(now));
    if (error) fail('countActiveRooms', error);
    return count ?? 0;
  }

  async cleanup(now: number, limits: CleanupLimits = DEFAULT_CLEANUP): Promise<CleanupResult> {
    const cutoff = iso(now - limits.retentionDays * DAY_MS);
    const rooms = await this.purge(T_ROOMS, 'id', 'expires_at', 'lte', iso(now), limits.maxRooms);
    const matches = await this.purge(T_MATCHES, 'id', 'started_at', 'lt', cutoff, limits.maxRows);
    const events = await this.purge(T_EVENTS, 'id', 'at', 'lt', cutoff, limits.maxRows);
    return { rooms, matches, events };
  }

  /** 오래된 순으로 최대 limit개를 골라 지운다(supabase-js delete에는 limit이 없어 id를 먼저 고른다) */
  private async purge(
    table: string,
    idCol: string,
    timeCol: string,
    cmp: 'lt' | 'lte',
    bound: string,
    limit: number,
  ): Promise<number> {
    if (limit <= 0) return 0;
    const base = this.db.from(table).select(idCol);
    const picked = await (cmp === 'lt' ? base.lt(timeCol, bound) : base.lte(timeCol, bound)).order(timeCol, { ascending: true }).limit(limit);
    if (picked.error) fail(`cleanup.${table}.select`, picked.error);
    const ids = (picked.data as unknown as Record<string, string | number>[] | null)?.map((r) => r[idCol]) ?? [];
    for (let i = 0; i < ids.length; i += DELETE_CHUNK) {
      const del = await this.db.from(table).delete().in(idCol, ids.slice(i, i + DELETE_CHUNK));
      if (del.error) fail(`cleanup.${table}.delete`, del.error);
    }
    return ids.length;
  }
}
