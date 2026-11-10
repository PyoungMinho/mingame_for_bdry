/**
 * 지표 이벤트 기록 (백엔드 §9). 원자적인 사건만 남기고 지표 정의는 gate SQL에서 한다.
 *
 * - 허용된 props 키만 통과(나머지는 버림), 값 모양이 틀리면 기록 자체를 버린다. 닉네임·IP·UA를 받을 자리가 없다.
 * - playerKey/hostKey는 SHA-256 hex(64자)만. 원본 비밀키(32자)가 실수로 들어오면 기록하지 않는다.
 * - 기록 실패는 게임 진행을 막지 않는다(recordEvent는 던지지 않는다).
 * - dedupeKey: 같은 사건이 CAS 재시도·재전송으로 두 번 와도 한 줄. feedback은 매치·사람당 1건.
 * - env·is_test는 호출자가 컨텍스트로 넘긴다. 로컬·프리뷰·테스트 표시 기록은 저장하되 gate SQL이 제외한다.
 */

import { LINES_SHOWN_MAX, ROUND_CAP } from '../constants';
import { LINE_ID_RE, type McEventProps, type McEventType } from '../protocol';
import { KEY_HASH_RE, type CleanupResult, type JsonObject, type McEnv, type NewEvent, type RoomStore } from './store';

export interface EventContext {
  readonly roomId: string | null;
  readonly matchId: string | null;
  /** SHA-256 hex 또는 null */
  readonly playerKey: string | null;
  readonly env: McEnv;
  readonly isTest: boolean;
}

const END_REASONS = ['sunk2', 'draw', 'cap', 'resign', 'absent'] as const;
const LAUGH = ['none', 'some', 'lol'] as const;
const DOCS = ['reprimand', 'award', 'joint'] as const;

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const isInt = (v: unknown, lo: number, hi: number): v is number => typeof v === 'number' && Number.isInteger(v) && v >= lo && v <= hi;
const oneOf = <T extends string>(list: readonly T[], v: unknown): v is T => typeof v === 'string' && (list as readonly string[]).includes(v);

/** type별 허용 키만 새 객체로 복사. 모양이 틀리면 null */
export function sanitizeProps(type: McEventType, raw: unknown): JsonObject | null {
  const p = isObj(raw) ? raw : {};
  switch (type) {
    case 'room_created':
      return isInt(p.industry, 0, 2) && typeof p.alarmOn === 'boolean' ? { industry: p.industry, alarmOn: p.alarmOn } : null;
    case 'room_joined':
      return (p.seat === 0 || p.seat === 1) && typeof p.hostKey === 'string' && KEY_HASH_RE.test(p.hostKey)
        ? { seat: p.seat, hostKey: p.hostKey }
        : null;
    case 'match_started':
      return isInt(p.seq, 1, 10_000) && typeof p.rematch === 'boolean' ? { seq: p.seq, rematch: p.rematch } : null;
    case 'match_ended':
      return oneOf(END_REASONS, p.reason) && isInt(p.rounds, 0, ROUND_CAP) && (p.winner === 0 || p.winner === 1 || p.winner === null)
        ? { reason: p.reason, rounds: p.rounds, winner: p.winner }
        : null;
    case 'rematch_requested':
      return {};
    case 'feedback':
      return oneOf(LAUGH, p.laugh) ? { laugh: p.laugh } : null;
    case 'line_report':
      return typeof p.lineId === 'string' && LINE_ID_RE.test(p.lineId) ? { lineId: p.lineId } : null;
    case 'lines_shown':
      return Array.isArray(p.lineIds) &&
        p.lineIds.length <= LINES_SHOWN_MAX &&
        p.lineIds.every((x) => typeof x === 'string' && LINE_ID_RE.test(x))
        ? { lineIds: [...(p.lineIds as string[])] }
        : null;
    case 'share_copied':
      return oneOf(DOCS, p.doc) ? { doc: p.doc } : null;
    case 'transport':
      return typeof p.bell === 'boolean' ? { bell: p.bell } : null;
  }
}

/** 한 번만 기록해야 하는 사건의 중복 제거 키. 없으면 null(여러 번 기록 가능) */
export function dedupeKeyFor(type: McEventType, ctx: EventContext): string | null {
  switch (type) {
    case 'feedback':
      return ctx.matchId && ctx.playerKey ? `feedback:${ctx.matchId}:${ctx.playerKey}` : null;
    case 'match_started':
      return ctx.matchId ? `match_started:${ctx.matchId}` : null;
    case 'match_ended':
      return ctx.matchId ? `match_ended:${ctx.matchId}` : null;
    case 'room_created':
      return ctx.roomId ? `room_created:${ctx.roomId}` : null;
    case 'room_joined':
      return ctx.roomId && ctx.playerKey ? `room_joined:${ctx.roomId}:${ctx.playerKey}` : null;
    default:
      return null;
  }
}

/** 이벤트 행을 만든다. props가 틀리거나 playerKey가 해시 모양이 아니면 null */
export function buildEvent<T extends McEventType>(type: T, props: McEventProps[T], ctx: EventContext, now: number): NewEvent | null {
  if (ctx.playerKey !== null && !KEY_HASH_RE.test(ctx.playerKey)) return null;
  const clean = sanitizeProps(type, props);
  if (!clean) return null;
  return {
    at: now,
    type,
    roomId: ctx.roomId,
    matchId: ctx.matchId,
    playerKey: ctx.playerKey,
    props: clean,
    env: ctx.env,
    isTest: ctx.isTest,
    dedupeKey: dedupeKeyFor(type, ctx),
  };
}

/** 한 건 기록. 절대 던지지 않는다. 실제로 새로 들어갔으면 true */
export async function recordEvent<T extends McEventType>(
  store: RoomStore,
  type: T,
  props: McEventProps[T],
  ctx: EventContext,
  now: number,
): Promise<boolean> {
  const row = buildEvent(type, props, ctx, now);
  if (!row) return false;
  try {
    return (await store.insertEvents([row])) > 0;
  } catch {
    return false;
  }
}

export interface EventDraft<T extends McEventType = McEventType> {
  readonly type: T;
  readonly props: McEventProps[T];
  readonly ctx: EventContext;
}

/** 여러 건을 한 번의 쓰기로. 유효하지 않은 건은 건너뛰고, 넣은 수를 돌려준다. 절대 던지지 않는다 */
export async function recordEvents(store: RoomStore, drafts: readonly EventDraft[], now: number): Promise<number> {
  const rows: NewEvent[] = [];
  for (const d of drafts) {
    const row = buildEvent(d.type, d.props as never, d.ctx, now);
    if (row) rows.push(row);
  }
  if (rows.length === 0) return 0;
  try {
    return await store.insertEvents(rows);
  } catch {
    return 0;
  }
}

/** 방 만들기마다 호출하는 정리. 실패해도 방 만들기를 막지 않는다 */
export async function safeCleanup(store: RoomStore, now: number): Promise<CleanupResult> {
  try {
    return await store.cleanup(now);
  } catch {
    return { rooms: 0, matches: 0, events: 0 };
  }
}
