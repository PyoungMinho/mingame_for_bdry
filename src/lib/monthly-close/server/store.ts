/**
 * 월마감 저장소 인터페이스 (DB설계자 소유, API설계자는 이것에만 의존한다).
 *
 * 구현 둘: store-supabase.ts(운영), store-memory.ts(로컬·테스트, Vercel 안에서는 생성 불가).
 * 선택은 db.ts의 getStore()가 한다.
 *
 * 규칙
 *  - 시각은 전부 epoch ms(number)로 주고받는다. 호출자가 `now`를 넘긴다(저장소는 시계를 읽지 않는다).
 *  - 사람 키(playerKey, hostKey)는 비밀키의 SHA-256 소문자 hex 64자만 받는다(원본 128비트 키 32자는 거부).
 *  - `load`는 방 + 두 자리 접속 정보를 한 번에 돌려준다(출제 조건·경보 판정·시계 정지에 필요).
 *  - 저장은 compare-and-set: `save(roomId, expectedVersion, …)`가 version이 같을 때만 쓰고 version+1을 돌려준다.
 *  - 접속 신호(touchPlayer)와 입퇴장(addPlayer/removePlayer)은 mc_rooms.version을 올리지 않는다.
 *  - DB 장애는 `StoreUnavailableError`를 던진다(API는 SERVICE_DOWN으로 매핑). 정상적인 경합은 예외가 아니라 결과값이다.
 */

import type { IndustryId } from '../constants';
import type { AlarmOutcome, EndReason, McEventType, RoomStatus, Seat, ViewState } from '../protocol';

// ─── 공통 ────────────────────────────────────────────────────────────────────

export type McEnv = 'production' | 'preview' | 'development';
export type JsonObject = Record<string, unknown>;

/** 비밀키의 SHA-256 소문자 hex. 원본 키(MC_KEY_RE, 32자)는 어디에도 저장하지 않는다. */
export const KEY_HASH_RE = /^[0-9a-f]{64}$/;

/** DB 연결·쿼리 실패. API는 SERVICE_DOWN(503)으로 바꾼다. 메시지에 상태(state)를 넣지 않는다. */
export class StoreUnavailableError extends Error {
  readonly code = 'STORE_UNAVAILABLE';
  constructor(message: string, readonly cause?: unknown) {
    super(message);
    this.name = 'StoreUnavailableError';
  }
}

/** 호출 규약 위반(잘못된 키 형식 등). 버그이므로 API는 잡지 말고 500으로 내려도 된다. */
export class StoreUsageError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'StoreUsageError';
  }
}

export function assertKeyHash(value: string, what: string): void {
  if (!KEY_HASH_RE.test(value)) throw new StoreUsageError(`${what}: SHA-256 hex(64자)만 저장할 수 있다`);
}

// ─── 행 모양 ──────────────────────────────────────────────────────────────────

export interface StoredRoom {
  readonly id: string;
  /** 5자리 숫자 문자열 */
  readonly code: string;
  readonly status: RoomStatus;
  /** mc_rooms.version. 엔진 상태의 version은 항상 이 값으로 맞춘다 */
  readonly version: number;
  /** 공개 + 비밀(secret) 상태. 브라우저에 그대로 내보내면 안 된다 */
  readonly state: JsonObject;
  readonly settings: JsonObject;
  readonly env: McEnv;
  readonly isTest: boolean;
  readonly expiresAt: number;
  readonly createdAt: number;
  readonly updatedAt: number;
}

export interface StoredPlayer {
  readonly roomId: string;
  readonly seat: Seat;
  /** SHA-256 hex */
  readonly playerKey: string;
  readonly nickname: string;
  readonly industry: IndustryId;
  readonly lastSeen: number;
  readonly viewState: ViewState;
  /** viewState가 마지막으로 바뀐 서버 시각(시계 정지 소급 기준). 입장 시각으로 시작 */
  readonly viewStateAt: number;
  readonly joinedAt: number;
}

/** load의 결과. players[seat]는 비어 있으면 null */
export interface RoomSnapshot {
  readonly room: StoredRoom;
  readonly players: readonly [StoredPlayer | null, StoredPlayer | null];
}

export interface StoredMatch {
  readonly id: string;
  readonly roomId: string;
  /** 1부터. 1 = 첫 판(v7) */
  readonly seq: number;
  readonly rematchOf: string | null;
  readonly hostKey: string;
  readonly playerKeys: readonly [string, string];
  readonly startedAt: number;
  readonly endedAt: number | null;
  readonly endReason: EndReason | null;
  readonly winnerSeat: Seat | null;
  readonly rounds: number | null;
  readonly hints: readonly [number, number] | null;
  readonly quizzes: JsonObject | null;
  readonly alarmOn: boolean;
  readonly alarmOutcome: readonly [AlarmOutcome | null, AlarmOutcome | null] | null;
  readonly env: McEnv;
  readonly isTest: boolean;
}

// ─── 입력 ────────────────────────────────────────────────────────────────────

export interface NewPlayer {
  readonly roomId: string;
  readonly seat: Seat;
  readonly playerKey: string;
  /** 1~8자는 API가 검증한다. 닉네임은 mc_players에만 저장되고 방과 함께 사라진다 */
  readonly nickname: string;
  readonly industry: IndustryId;
}

export interface CreateRoomInput {
  /** 생략하면 저장소가 UUID를 만든다 */
  readonly id?: string;
  readonly code: string;
  readonly status?: RoomStatus;
  readonly state: JsonObject;
  readonly settings: JsonObject;
  readonly env: McEnv;
  readonly isTest: boolean;
  readonly expiresAt: number;
  /** 방장은 방과 같이 0번 자리로 들어간다(방만 있고 사람이 없는 상태가 생기지 않게) */
  readonly host: Omit<NewPlayer, 'roomId' | 'seat'>;
}

export type CreateRoomResult =
  | { readonly ok: true; readonly snapshot: RoomSnapshot }
  /** 같은 번호의 살아 있는 방이 있다. API는 다른 번호로 최대 5회 다시 뽑는다 */
  | { readonly ok: false; readonly reason: 'CODE_TAKEN' };

export interface RoomPatch {
  readonly state: JsonObject;
  readonly status: RoomStatus;
  /** 생략하면 기존 settings 유지 */
  readonly settings?: JsonObject;
  /** 활동 시각 + 30분 등 API가 계산 */
  readonly expiresAt: number;
}

export type SaveResult =
  | { readonly ok: true; readonly version: number }
  /** version 불일치(또는 방이 이미 삭제됨). API는 다시 load → 재적용, 최대 3회. load가 null이면 ROOM_NOT_FOUND */
  | { readonly ok: false; readonly reason: 'CONFLICT' };

export type AddPlayerResult =
  | { readonly ok: true; readonly player: StoredPlayer }
  /** 그 자리에 이미 다른 사람이 있다(두 사람이 동시에 입장) */
  | { readonly ok: false; readonly reason: 'SEAT_TAKEN' }
  /** 같은 비밀키가 이 방에 이미 있다(같은 브라우저로 두 자리 차지 방지). API는 재입장 경로로 처리 */
  | { readonly ok: false; readonly reason: 'KEY_EXISTS' };

export interface TouchInput {
  /** 이번 요청이 보고한 위장 상태. 생략하면 last_seen만 갱신 */
  readonly viewState?: ViewState;
  /** 이 시각보다 만료가 이르면 늘린다(최대 60초 이내 중복 갱신은 건너뜀). 방 version은 올리지 않는다 */
  readonly extendRoomExpiryTo?: number;
}

export interface TouchResult {
  /** 갱신 후의 자리 */
  readonly player: StoredPlayer;
  /** 이번 호출로 viewState가 실제로 바뀌었는가 */
  readonly viewStateChanged: boolean;
  /** 갱신 직전의 값. 위장 해제 때 "숨어 있던 구간의 시작" = previous.viewStateAt */
  readonly previous: { readonly viewState: ViewState; readonly viewStateAt: number };
}

export interface NewMatch {
  /** API가 만든 UUID. 상태의 game.matchId와 같다. 같은 id로 두 번 호출해도 한 행(CAS 재시도 안전) */
  readonly id: string;
  readonly roomId: string;
  readonly seq: number;
  readonly rematchOf: string | null;
  readonly hostKey: string;
  readonly playerKeys: readonly [string, string];
  readonly startedAt: number;
  readonly alarmOn: boolean;
  readonly env: McEnv;
  readonly isTest: boolean;
}

export interface MatchEnd {
  readonly endedAt: number;
  readonly endReason: EndReason;
  readonly winnerSeat: Seat | null;
  readonly rounds: number;
  readonly hints: readonly [number, number];
  /** 출제·풀이·경과 ms 요약. 닉네임·IP·UA 금지 */
  readonly quizzes: JsonObject;
  readonly alarmOutcome: readonly [AlarmOutcome | null, AlarmOutcome | null] | null;
}

export interface NewEvent {
  readonly at: number;
  readonly type: McEventType;
  readonly roomId: string | null;
  readonly matchId: string | null;
  /** SHA-256 hex 또는 null */
  readonly playerKey: string | null;
  readonly props: JsonObject;
  readonly env: McEnv;
  readonly isTest: boolean;
  /** 같은 값이면 한 번만 기록(feedback은 매치·사람당 1건, 시작·종료 사건은 CAS 재시도에도 1건) */
  readonly dedupeKey: string | null;
}

export interface CleanupLimits {
  readonly maxRooms: number;
  readonly maxRows: number;
  /** 매치·이벤트 보관일 */
  readonly retentionDays: number;
}

export const DEFAULT_CLEANUP: CleanupLimits = { maxRooms: 50, maxRows: 500, retentionDays: 90 };

export interface CleanupResult {
  readonly rooms: number;
  readonly matches: number;
  readonly events: number;
}

// ─── 인터페이스 ───────────────────────────────────────────────────────────────

export interface RoomStore {
  readonly kind: 'supabase' | 'memory';

  /** 가벼운 연결 확인(health 라우트). 실패해도 던지지 않고 false */
  health(): Promise<boolean>;

  /** 같은 번호의 만료된 방은 지우고 만든다. 방 + 방장(0번 자리)을 함께 만든다. version 0으로 시작 */
  createRoom(input: CreateRoomInput, now: number): Promise<CreateRoomResult>;

  /** 코드로 방 + 두 자리를 한 번에. 만료됐거나(expiresAt <= now) 없으면 null */
  load(code: string, now: number): Promise<RoomSnapshot | null>;

  /** compare-and-set. 성공하면 version+1을 돌려준다(저장소가 올린다) */
  save(roomId: string, expectedVersion: number, patch: RoomPatch, now: number): Promise<SaveResult>;

  /** 빈 자리에 사람 추가. 고유 조건이 경합을 판정한다. 방 version은 올리지 않는다(상태 저장은 API가 save로) */
  addPlayer(input: NewPlayer, now: number): Promise<AddPlayerResult>;

  /**
   * 자리 비우기(대기방 손님 나가기). 없으면 무시.
   * onlyKey를 주면 그 자리의 player_key가 같을 때만 지운다(남은 행 정리가 방금 들어온 사람을 지우지 않게, D3 R3).
   */
  removePlayer(roomId: string, seat: Seat, onlyKey?: string): Promise<void>;

  /** last_seen(+viewState) 갱신. version을 올리지 않는다. 자리가 없으면 null */
  touchPlayer(roomId: string, seat: Seat, input: TouchInput, now: number): Promise<TouchResult | null>;

  /** 매치 행 생성(status가 playing이 되는 요청에서). 같은 id 재호출은 무시 */
  startMatch(match: NewMatch, now: number): Promise<void>;

  /** 매치 마감. 이미 마감됐으면 false(첫 마감만 인정) */
  endMatch(matchId: string, end: MatchEnd, now: number): Promise<boolean>;

  /** feedback이 matchId–방–참가자를 대조할 때 쓴다 */
  getMatch(matchId: string): Promise<StoredMatch | null>;

  /** 지표 이벤트 기록. dedupeKey가 겹치면 건너뛴다. 실제로 들어간 수를 돌려준다 */
  insertEvents(events: readonly NewEvent[]): Promise<number>;

  /** 만료되지 않은 방 수(활성 방 상한 200 판단용) */
  countActiveRooms(now: number): Promise<number>;

  /** 만료 방(최대 maxRooms) · 보관 기간 지난 매치/이벤트(각 최대 maxRows) 삭제. 방 만들기마다 호출 */
  cleanup(now: number, limits?: CleanupLimits): Promise<CleanupResult>;
}

/** 하루 ms */
export const DAY_MS = 86_400_000;

/** touchPlayer의 방 만료 연장 최소 간격: 이 안의 중복 연장은 건너뛴다(2초 sync마다 mc_rooms를 쓰지 않으려는 조건) */
export const EXPIRY_EXTEND_MIN_GAP_MS = 60_000;
