/**
 * MemoryStore — 로컬 개발·테스트·프리뷰 스크린샷용 RoomStore.
 *
 * - Vercel 안(VERCEL/VERCEL_ENV가 있는 환경)에서는 생성 자체가 실패한다. 운영·프리뷰 배포가 실수로 메모리 저장소로
 *   돌아가면 함수 인스턴스마다 방이 따로 생겨 "방이 사라지는" 장애가 되기 때문이다.
 * - 입출력은 JSON 직렬화를 거쳐 복사한다(DB를 지나는 것과 같게: undefined·함수가 사라지고 별칭 공유가 없다).
 * - 고유 조건·CAS·dedupeKey·정리 한도를 SupabaseStore/SQL과 같은 규칙으로 흉내 낸다.
 */

import { randomUUID } from 'node:crypto';
import type { Seat } from '../protocol';
import {
  DAY_MS,
  DEFAULT_CLEANUP,
  EXPIRY_EXTEND_MIN_GAP_MS,
  assertKeyHash,
  type AddPlayerResult,
  type CleanupLimits,
  type CleanupResult,
  type CreateRoomInput,
  type CreateRoomResult,
  type JsonObject,
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

export function isOnVercel(env: NodeJS.ProcessEnv = process.env): boolean {
  return Boolean(env.VERCEL || env.VERCEL_ENV);
}

const clone = <T>(v: T): T => JSON.parse(JSON.stringify(v)) as T;

export interface StoredEventRow extends NewEvent {
  readonly id: number;
}

export class MemoryStore implements RoomStore {
  readonly kind = 'memory' as const;

  private rooms = new Map<string, StoredRoom>();
  private codeToId = new Map<string, string>();
  private players = new Map<string, StoredPlayer>(); // `${roomId}:${seat}`
  private matches = new Map<string, StoredMatch>();
  private events: StoredEventRow[] = [];
  private dedupe = new Set<string>();
  private nextEventId = 1;

  constructor() {
    if (isOnVercel()) {
      throw new Error('MemoryStore는 Vercel 안에서 쓸 수 없다(운영·프리뷰는 SupabaseStore). db.ts의 getStore()를 쓸 것');
    }
  }

  // ── 테스트용 관찰 창구(RoomStore 계약 밖) ──
  debugEvents(): readonly StoredEventRow[] {
    return this.events.map((e) => clone(e));
  }
  debugCounts(): { rooms: number; players: number; matches: number; events: number } {
    return { rooms: this.rooms.size, players: this.players.size, matches: this.matches.size, events: this.events.length };
  }
  debugAllMatches(): readonly StoredMatch[] {
    return [...this.matches.values()].map((m) => clone(m));
  }
  /** 테스트에서 시각을 직접 심을 때(오래된 매치·이벤트 만들기) */
  debugPutEvent(e: NewEvent): void {
    this.events.push({ ...clone(e), id: this.nextEventId++ });
  }
  debugPutMatch(m: StoredMatch): void {
    this.matches.set(m.id, clone(m));
  }

  async health(): Promise<boolean> {
    return true;
  }

  async createRoom(input: CreateRoomInput, now: number): Promise<CreateRoomResult> {
    assertKeyHash(input.host.playerKey, 'host.playerKey');
    const existingId = this.codeToId.get(input.code);
    if (existingId) {
      const existing = this.rooms.get(existingId);
      if (existing && existing.expiresAt > now) return { ok: false, reason: 'CODE_TAKEN' };
      this.deleteRoom(existingId);
    }
    const id = input.id ?? randomUUID();
    const room: StoredRoom = {
      id,
      code: input.code,
      status: input.status ?? 'waiting',
      version: 0,
      state: clone(input.state),
      settings: clone(input.settings),
      env: input.env,
      isTest: input.isTest,
      expiresAt: input.expiresAt,
      createdAt: now,
      updatedAt: now,
    };
    this.rooms.set(id, room);
    this.codeToId.set(room.code, id);
    const host: StoredPlayer = {
      roomId: id,
      seat: 0,
      playerKey: input.host.playerKey,
      nickname: input.host.nickname,
      industry: input.host.industry,
      lastSeen: now,
      viewState: 'game',
      viewStateAt: now,
      joinedAt: now,
    };
    this.players.set(`${id}:0`, host);
    return { ok: true, snapshot: this.snapshot(room) };
  }

  async load(code: string, now: number): Promise<RoomSnapshot | null> {
    const id = this.codeToId.get(code);
    const room = id ? this.rooms.get(id) : undefined;
    if (!room || room.expiresAt <= now) return null;
    return this.snapshot(room);
  }

  async save(roomId: string, expectedVersion: number, patch: RoomPatch, now: number): Promise<SaveResult> {
    const room = this.rooms.get(roomId);
    if (!room || room.version !== expectedVersion) return { ok: false, reason: 'CONFLICT' };
    const next: StoredRoom = {
      ...room,
      version: room.version + 1,
      state: clone(patch.state),
      status: patch.status,
      settings: patch.settings ? clone(patch.settings) : room.settings,
      expiresAt: patch.expiresAt,
      updatedAt: now,
    };
    this.rooms.set(roomId, next);
    return { ok: true, version: next.version };
  }

  async addPlayer(input: NewPlayer, now: number): Promise<AddPlayerResult> {
    assertKeyHash(input.playerKey, 'playerKey');
    if (!this.rooms.has(input.roomId)) throw new Error('addPlayer: 방이 없다(외래키 위반)');
    for (const seat of [0, 1] as const) {
      const p = this.players.get(`${input.roomId}:${seat}`);
      if (p && p.playerKey === input.playerKey) return { ok: false, reason: 'KEY_EXISTS' };
    }
    if (this.players.has(`${input.roomId}:${input.seat}`)) return { ok: false, reason: 'SEAT_TAKEN' };
    const player: StoredPlayer = {
      roomId: input.roomId,
      seat: input.seat,
      playerKey: input.playerKey,
      nickname: input.nickname,
      industry: input.industry,
      lastSeen: now,
      viewState: 'game',
      viewStateAt: now,
      joinedAt: now,
    };
    this.players.set(`${input.roomId}:${input.seat}`, player);
    return { ok: true, player: clone(player) };
  }

  async removePlayer(roomId: string, seat: Seat, onlyKey?: string): Promise<void> {
    const key = `${roomId}:${seat}`;
    if (onlyKey !== undefined && this.players.get(key)?.playerKey !== onlyKey) return;
    this.players.delete(key);
  }

  async touchPlayer(roomId: string, seat: Seat, input: TouchInput, now: number): Promise<TouchResult | null> {
    const key = `${roomId}:${seat}`;
    const cur = this.players.get(key);
    if (!cur) return null;
    const previous = { viewState: cur.viewState, viewStateAt: cur.viewStateAt };
    const changed = input.viewState !== undefined && input.viewState !== cur.viewState;
    const next: StoredPlayer = {
      ...cur,
      lastSeen: now,
      viewState: changed ? input.viewState! : cur.viewState,
      viewStateAt: changed ? now : cur.viewStateAt,
    };
    this.players.set(key, next);
    if (input.extendRoomExpiryTo !== undefined) {
      const room = this.rooms.get(roomId);
      if (room && room.expiresAt < input.extendRoomExpiryTo - EXPIRY_EXTEND_MIN_GAP_MS) {
        this.rooms.set(roomId, { ...room, expiresAt: input.extendRoomExpiryTo });
      }
    }
    return { player: clone(next), viewStateChanged: changed, previous };
  }

  async startMatch(match: NewMatch, now: number): Promise<void> {
    assertKeyHash(match.hostKey, 'hostKey');
    for (const k of match.playerKeys) assertKeyHash(k, 'playerKeys');
    if (this.matches.has(match.id)) return;
    for (const m of this.matches.values()) {
      if (m.roomId === match.roomId && m.seq === match.seq) throw new Error('startMatch: (roomId, seq) 중복');
    }
    void now;
    this.matches.set(match.id, {
      id: match.id,
      roomId: match.roomId,
      seq: match.seq,
      rematchOf: match.rematchOf,
      hostKey: match.hostKey,
      playerKeys: [match.playerKeys[0], match.playerKeys[1]],
      startedAt: match.startedAt,
      endedAt: null,
      endReason: null,
      winnerSeat: null,
      rounds: null,
      hints: null,
      quizzes: null,
      alarmOn: match.alarmOn,
      alarmOutcome: null,
      env: match.env,
      isTest: match.isTest,
    });
  }

  async endMatch(matchId: string, end: MatchEnd, now: number): Promise<boolean> {
    void now;
    const m = this.matches.get(matchId);
    if (!m || m.endedAt !== null) return false;
    this.matches.set(matchId, {
      ...m,
      endedAt: end.endedAt,
      endReason: end.endReason,
      winnerSeat: end.winnerSeat,
      rounds: end.rounds,
      hints: [end.hints[0], end.hints[1]],
      quizzes: clone(end.quizzes) as JsonObject,
      alarmOutcome: end.alarmOutcome ? [end.alarmOutcome[0], end.alarmOutcome[1]] : null,
    });
    return true;
  }

  async getMatch(matchId: string): Promise<StoredMatch | null> {
    const m = this.matches.get(matchId);
    return m ? clone(m) : null;
  }

  async insertEvents(events: readonly NewEvent[]): Promise<number> {
    let n = 0;
    for (const e of events) {
      if (e.playerKey !== null) assertKeyHash(e.playerKey, 'event.playerKey');
      if (e.dedupeKey !== null) {
        if (this.dedupe.has(e.dedupeKey)) continue;
        this.dedupe.add(e.dedupeKey);
      }
      this.events.push({ ...clone(e), id: this.nextEventId++ });
      n += 1;
    }
    return n;
  }

  async countActiveRooms(now: number): Promise<number> {
    let n = 0;
    for (const r of this.rooms.values()) if (r.expiresAt > now) n += 1;
    return n;
  }

  async cleanup(now: number, limits: CleanupLimits = DEFAULT_CLEANUP): Promise<CleanupResult> {
    const expired = [...this.rooms.values()]
      .filter((r) => r.expiresAt <= now)
      .sort((a, b) => a.expiresAt - b.expiresAt)
      .slice(0, limits.maxRooms);
    for (const r of expired) this.deleteRoom(r.id);

    const cutoff = now - limits.retentionDays * DAY_MS;
    const oldMatches = [...this.matches.values()]
      .filter((m) => m.startedAt < cutoff)
      .sort((a, b) => a.startedAt - b.startedAt)
      .slice(0, limits.maxRows);
    for (const m of oldMatches) this.matches.delete(m.id);

    const oldEvents = this.events
      .filter((e) => e.at < cutoff)
      .sort((a, b) => a.at - b.at || a.id - b.id)
      .slice(0, limits.maxRows);
    const drop = new Set(oldEvents.map((e) => e.id));
    this.events = this.events.filter((e) => !drop.has(e.id));
    // 지워진 이벤트의 dedupeKey는 DB에서도 함께 사라지므로 집합에서도 뺀다
    for (const e of oldEvents) if (e.dedupeKey !== null) this.dedupe.delete(e.dedupeKey);

    return { rooms: expired.length, matches: oldMatches.length, events: oldEvents.length };
  }

  // ── 내부 ──
  private snapshot(room: StoredRoom): RoomSnapshot {
    const p0 = this.players.get(`${room.id}:0`) ?? null;
    const p1 = this.players.get(`${room.id}:1`) ?? null;
    return clone({ room, players: [p0, p1] as const }) as RoomSnapshot;
  }

  /** 방 삭제 + 자리 연쇄 삭제(ON DELETE CASCADE). 매치·이벤트는 남는다(외래키 없음) */
  private deleteRoom(id: string): void {
    const room = this.rooms.get(id);
    if (!room) return;
    this.rooms.delete(id);
    if (this.codeToId.get(room.code) === id) this.codeToId.delete(room.code);
    this.players.delete(`${id}:0`);
    this.players.delete(`${id}:1`);
  }
}
