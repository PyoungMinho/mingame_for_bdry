/**
 * 월마감 서버 파이프라인 (소유: API설계자).
 * 인증(Identity) → 저장소 읽기(load) → 기한 처리(advance) → 엔진 → 버전 비교 저장(save, 최대 3회) → 초인종(Broadcast {v}) → 투영(view).
 *
 * 규칙
 *  - 판정·시각의 원천은 deps.now() 하나(서버 시각). 엔진에는 ctx로만 넘긴다.
 *  - 모든 라우트는 이 파일의 *Flow 함수 하나만 부른다. 라우트 파일에는 로직이 없다.
 *  - 서버는 한국어 문장을 보내지 않는다(코드·숫자만).
 *  - 자리 없는 사람에게는 view를 절대 싣지 않는다.
 *  - 오류 판정 순서(protocol ERROR_CODES 주석): 키 형식 → 방 없음 → 내 자리 → ROOM_FULL/NOT_JOINED.
 */

import { randomInt, randomUUID } from 'node:crypto';
import { z } from 'zod';
import {
  ACTION_ID_MAX,
  ACTIVE_ROOMS_CAP,
  ALARM_REACTION_MAX_MS,
  NICKNAME_MAX,
  NICKNAME_MIN,
  PRESENCE_MS,
  ROOM_CODE_MAX,
  ROOM_CODE_MIN,
  ROOM_IDLE_MS,
  SHIP_SLOTS,
  type IndustryId,
} from '../constants';
import {
  BELL_EVENT,
  BELL_TOPIC_PREFIX,
  ERROR_HTTP_STATUS,
  LINE_ID_RE,
  ROOM_CODE_RE,
  type ActionBody,
  type ActionOk,
  type ApiErr,
  type CreateRoomOk,
  type ErrorCode,
  type HealthOk,
  type InvalidReason,
  type JoinOk,
  type RoomView,
  type Seat,
  type SyncOk,
} from '../protocol';
import { advance, applyAction, createRoomState, isFull, joinSeat, markDelivered, reportAlarm, seatOfKey } from '../engine/core';
import type { EngineCtx, EngineEffect, PresencePair, Rng, RoomState, SeatPresence, Stepped } from '../engine/types';
import type { Identity } from './auth';
import { recordEvent, recordEvents, safeCleanup, type EventContext, type EventDraft } from './events';
import { screenNickname } from './nickname';
import { RATE_RULES, UNKNOWN_IP, sharedLimiter, type RateLimiter } from './rate';
import {
  StoreUnavailableError,
  type JsonObject,
  type McEnv,
  type RoomSnapshot,
  type RoomStore,
  type StoredPlayer,
} from './store';
import { presenceFor, projectFor } from './view';

// ─── 의존성 ───────────────────────────────────────────────────────────────────

export interface PipelineDeps {
  readonly store: RoomStore;
  readonly env: McEnv;
  /** 서버 시각 ms */
  now(): number;
  /** [0,1) 난수(엔진 주입) */
  rng: Rng;
  /** UUID 생성(방 id, 매치 id) */
  newId(): string;
  /** 방 번호 난수 [min, max] */
  randomCode(): string;
  /** 초인종. 실패해도 던지지 않는다 */
  bell(topic: string, version: number): Promise<void>;
  readonly limiter: RateLimiter;
}

export const cryptoRng: Rng = () => randomInt(0, 2 ** 32) / 2 ** 32;

export function randomRoomCode(): string {
  return String(randomInt(ROOM_CODE_MIN, ROOM_CODE_MAX + 1));
}

/** 운영 기본값 의존성 조립(라우트가 부른다). 초인종은 db.ts의 관리자 클라이언트로 httpSend. */
export async function defaultDeps(): Promise<PipelineDeps | null> {
  const { getStore, currentEnv, getSupabaseAdmin } = await import('./db');
  const store = getStore();
  if (!store) return null;
  return {
    store,
    env: currentEnv(),
    now: () => Date.now(),
    rng: cryptoRng,
    newId: () => randomUUID(),
    randomCode: randomRoomCode,
    limiter: sharedLimiter(),
    async bell(topic, version) {
      const admin = getSupabaseAdmin();
      if (!admin) return;
      const ch = admin.channel(topic);
      let timer: ReturnType<typeof setTimeout> | undefined;
      try {
        await Promise.race([ch.httpSend(BELL_EVENT, { v: version }), new Promise((r) => (timer = setTimeout(r, 1500)))]);
      } catch {
        /* 초인종은 없어도 폴링으로 돈다 */
      } finally {
        if (timer) clearTimeout(timer);
        void admin.removeChannel(ch).catch(() => undefined);
      }
    },
  };
}

// ─── 응답 모양 ────────────────────────────────────────────────────────────────

export interface Out<T> {
  readonly status: number;
  readonly body: T | ApiErr;
  readonly retryAfterSec?: number;
}

function ok<T>(body: T): Out<T> {
  return { status: 200, body };
}

function err(now: number, error: ErrorCode, extra: { reason?: InvalidReason; view?: RoomView; retryAfterMs?: number } = {}): Out<never> {
  const body: ApiErr = {
    ok: false,
    serverNow: now,
    error,
    ...(extra.reason ? { reason: extra.reason } : {}),
    ...(extra.view ? { view: extra.view } : {}),
    ...(extra.retryAfterMs ? { retryAfterMs: extra.retryAfterMs } : {}),
  };
  return {
    status: ERROR_HTTP_STATUS[error],
    body,
    ...(extra.retryAfterMs ? { retryAfterSec: Math.ceil(extra.retryAfterMs / 1000) } : {}),
  };
}

// ─── 입력 검증 (zod) ──────────────────────────────────────────────────────────

const cellSchema = z.string().regex(/^[A-H][1-8]$/);
const industrySchema = z.union([z.literal(0), z.literal(1), z.literal(2)]);
const shipSchema = z
  .object({ slot: z.enum(SHIP_SLOTS), start: cellSchema, dir: z.enum(['h', 'v']) })
  .strict();
const hintTargetSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('col'), col: z.enum(['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H']) }).strict(),
  z.object({ kind: z.literal('row'), row: z.number().int().min(1).max(8) }).strict(),
  z.object({ kind: z.literal('block'), cell: cellSchema }).strict(),
]);

const nicknameSchema = z.string().max(64);
export const createRoomSchema = z.object({ nickname: nicknameSchema, industry: industrySchema, alarmOn: z.boolean() }).strict();
export const joinSchema = z.object({ nickname: nicknameSchema, industry: industrySchema }).strict();
export const syncSchema = z
  .object({
    knownVersion: z.number().int().min(-1),
    view: z.enum(['game', 'disguise']),
    alarm: z
      .object({ issuedAt: z.number().int(), reactionMs: z.number().int().min(0).max(ALARM_REACTION_MAX_MS) })
      .strict()
      .optional(),
  })
  .strict();

const actionId = z.string().min(1).max(ACTION_ID_MAX).regex(/^[A-Za-z0-9_\-:.]+$/);
export const actionSchema = z.discriminatedUnion('type', [
  z.object({ actionId, type: z.literal('place'), ships: z.array(shipSchema).max(3), confirm: z.boolean() }).strict(),
  z.object({ actionId, type: z.literal('fire'), cell: cellSchema }).strict(),
  z.object({ actionId, type: z.literal('answer'), quizId: z.string().min(1).max(32), value: z.number().int().min(-1e9).max(1e9) }).strict(),
  z.object({ actionId, type: z.literal('hint'), target: hintTargetSchema }).strict(),
  z.object({ actionId, type: z.literal('taunt'), tauntId: z.number().int().min(0).max(1000) }).strict(),
  z.object({ actionId, type: z.literal('rematch') }).strict(),
  z.object({ actionId, type: z.literal('resign') }).strict(),
  z.object({ actionId, type: z.literal('claimAbsent') }).strict(),
  z.object({ actionId, type: z.literal('leave') }).strict(),
]);

const codeField = z.string().regex(ROOM_CODE_RE);
const matchField = z.string().uuid();
const lineId = z.string().regex(LINE_ID_RE);
export const feedbackSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('feedback'), code: codeField, matchId: matchField, laugh: z.enum(['none', 'some', 'lol']) }).strict(),
  z.object({ type: z.literal('line_report'), code: codeField, matchId: matchField, lineId }).strict(),
  z.object({ type: z.literal('lines_shown'), code: codeField, matchId: matchField, lineIds: z.array(lineId).max(200) }).strict(),
  z.object({ type: z.literal('share_copied'), code: codeField, matchId: matchField, doc: z.enum(['reprimand', 'award', 'joint']) }).strict(),
  z.object({ type: z.literal('transport'), code: codeField.nullable(), bell: z.boolean() }).strict(),
]);

/** 닉네임 정리: 제어문자·보이지 않는 방향 문자 제거, 공백 정리, 1~8자(코드포인트). 실패하면 null. 금칙어는 ./nickname(screenNickname). */
export function cleanNickname(raw: string): string | null {
  const s = raw
    .normalize('NFC')
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u001f\u007f-\u009f​-‏‪-‮⁠-⁯﻿]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  const n = [...s].length;
  return n >= NICKNAME_MIN && n <= NICKNAME_MAX ? s : null;
}

// ─── 공통 보조 ────────────────────────────────────────────────────────────────

const MAX_ATTEMPTS = 3;
const asState = (room: RoomSnapshot['room']) => room.state as unknown as RoomState;
const asJson = (s: RoomState) => s as unknown as JsonObject;
const oppOf = (s: Seat): Seat => (s === 0 ? 1 : 0);

function toPresence(p: StoredPlayer | { lastSeen: number; viewState: 'game' | 'disguise'; viewStateAt: number } | null): SeatPresence | null {
  return p ? { lastSeenAt: p.lastSeen, viewState: p.viewState, viewStateAt: p.viewStateAt } : null;
}

function engineCtx(deps: PipelineDeps, now: number, presence: PresencePair): EngineCtx {
  return { now, rng: deps.rng, newId: () => deps.newId(), presence };
}

function pairFor(snap: RoomSnapshot, seat: Seat, mine: SeatPresence | null): PresencePair {
  const o = toPresence(snap.players[oppOf(seat)]);
  return seat === 0 ? [mine, o] : [o, mine];
}

function eventCtx(deps: PipelineDeps, snap: RoomSnapshot, matchId: string | null, playerKey: string | null): EventContext {
  return { roomId: snap.room.id, matchId, playerKey, env: deps.env, isTest: snap.room.isTest };
}

/** 저장 성공 뒤 엔진 부수 효과(매치 행·지표). 전부 같은 id 재호출에 안전하고 던지지 않는다. */
async function applyEffects(deps: PipelineDeps, snap: RoomSnapshot, before: RoomState, after: RoomState, effects: readonly EngineEffect[], now: number): Promise<void> {
  const drafts: EventDraft[] = [];
  for (const fx of effects) {
    try {
      if (fx.type === 'matchStarted') {
        const k0 = after.seats[0]?.keyHash;
        const k1 = after.seats[1]?.keyHash;
        if (!k0 || !k1) continue;
        await deps.store.startMatch(
          {
            id: fx.matchId,
            roomId: snap.room.id,
            seq: fx.seq,
            rematchOf: fx.rematchOf,
            hostKey: k0,
            playerKeys: [k0, k1],
            startedAt: fx.startedAt,
            alarmOn: after.alarmOn,
            env: deps.env,
            isTest: snap.room.isTest,
          },
          now,
        );
        drafts.push({ type: 'match_started', props: { seq: fx.seq, rematch: fx.rematchOf !== null }, ctx: eventCtx(deps, snap, fx.matchId, null) });
      } else if (fx.type === 'matchEnded') {
        await deps.store.endMatch(
          fx.matchId,
          {
            endedAt: fx.endedAt,
            endReason: fx.reason,
            winnerSeat: fx.winner,
            rounds: fx.rounds,
            hints: fx.hints,
            quizzes: { items: fx.quizzes } as unknown as JsonObject,
            alarmOutcome: fx.alarmOutcome,
          },
          now,
        );
        drafts.push({ type: 'match_ended', props: { reason: fx.reason, rounds: fx.rounds, winner: fx.winner }, ctx: eventCtx(deps, snap, fx.matchId, null) });
      } else if (fx.type === 'rematchRequested') {
        drafts.push({
          type: 'rematch_requested',
          props: {},
          ctx: eventCtx(deps, snap, fx.matchId || null, after.seats[fx.seat]?.keyHash ?? null),
        });
      }
    } catch {
      /* 지표·매치 기록 실패는 게임을 막지 않는다 */
    }
  }
  if (drafts.length) await recordEvents(deps.store, drafts, now);
  // 손님이 대기·배치 중 나가 자리가 비면 DB 자리도 비운다(새 사람이 들어올 수 있게)
  if (before.seats[1] !== null && after.seats[1] === null) {
    try {
      await deps.store.removePlayer(snap.room.id, 1);
    } catch {
      /* 다음 입장 때 SEAT_TAKEN으로 보이면 재시도 */
    }
  }
}

async function ring(deps: PipelineDeps, snap: RoomSnapshot, version: number): Promise<void> {
  try {
    await deps.bell(`${BELL_TOPIC_PREFIX}${snap.room.id}`, version);
  } catch {
    /* noop */
  }
}

function mapStoreError(deps: PipelineDeps, e: unknown): Out<never> {
  if (e instanceof StoreUnavailableError) return err(deps.now(), 'SERVICE_DOWN');
  throw e;
}

export function serviceDown(now: number): Out<never> {
  return err(now, 'SERVICE_DOWN');
}

export function invalid(now: number, reason: InvalidReason): Out<never> {
  return err(now, 'INVALID', { reason });
}

/**
 * [D3 R4] 방 접근 실패(ROOM_NOT_FOUND·ROOM_FULL·NOT_JOINED)를 IP 단위로 센다(메모리, 저장 안 함).
 * 이미 한도를 넘은 IP에는 실제 사유 대신 RATE_LIMITED를 준다 → "그 번호에 방이 있는지" 신호도 더는 새지 않는다.
 * 자리가 있는 사람의 정상 요청은 이 버킷을 보지 않는다(같은 NAT의 남용자 때문에 판이 끊기지 않게).
 */
function accessFailed(deps: PipelineDeps, id: Identity, now: number, out: Out<never>): Out<never> {
  if (id.ip === UNKNOWN_IP) return out;
  const blocked = ipAccessBlocked(deps, id, now);
  if (blocked) return blocked;
  deps.limiter.record('access-fail-ip', id.ip, RATE_RULES.accessFailByIp, now);
  return out;
}

function ipAccessBlocked(deps: PipelineDeps, id: Identity, now: number): Out<never> | null {
  if (id.ip === UNKNOWN_IP) return null;
  const r = deps.limiter.peek('access-fail-ip', id.ip, RATE_RULES.accessFailByIp, now);
  return r.ok ? null : err(now, 'RATE_LIMITED', { retryAfterMs: r.retryAfterMs });
}

// ─── 방 만들기 ────────────────────────────────────────────────────────────────

export async function createRoomFlow(deps: PipelineDeps, id: Identity | null, raw: unknown): Promise<Out<CreateRoomOk>> {
  const now = deps.now();
  try {
    if (!id) return invalid(now, 'key');
    const parsed = createRoomSchema.safeParse(raw);
    const cleaned = parsed.success ? cleanNickname(parsed.data.nickname) : null;
    if (!parsed.success) return invalid(now, 'body');
    if (cleaned === null) return invalid(now, 'nickname');
    const nickname = screenNickname(cleaned, id.keyHash); // 금칙어 → 기본 닉네임(QA BUG-09)
    const byKey = deps.limiter.hit('create-key', id.keyHash, RATE_RULES.createByKey, now);
    if (!byKey.ok) return err(now, 'RATE_LIMITED', { retryAfterMs: byKey.retryAfterMs });
    const byIp = deps.limiter.hit('create-ip', id.ip, RATE_RULES.createByIp, now);
    if (!byIp.ok) return err(now, 'RATE_LIMITED', { retryAfterMs: byIp.retryAfterMs });

    await safeCleanup(deps.store, now);
    if ((await deps.store.countActiveRooms(now)) >= ACTIVE_ROOMS_CAP) return err(now, 'CAPACITY', { retryAfterMs: 30_000 });

    for (let i = 0; i < 5; i++) {
      const code = deps.randomCode();
      const state = createRoomState({
        code,
        keyHash: id.keyHash,
        nickname,
        industry: parsed.data.industry,
        alarmOn: parsed.data.alarmOn,
      });
      const res = await deps.store.createRoom(
        {
          id: deps.newId(),
          code,
          status: 'waiting',
          state: asJson(state),
          settings: { alarmOn: parsed.data.alarmOn },
          env: deps.env,
          isTest: id.isTest,
          expiresAt: now + ROOM_IDLE_MS,
          host: { playerKey: id.keyHash, nickname, industry: parsed.data.industry },
        },
        now,
      );
      if (!res.ok) continue;
      const snap = res.snapshot;
      await recordEvent(
        deps.store,
        'room_created',
        { industry: parsed.data.industry, alarmOn: parsed.data.alarmOn },
        eventCtx(deps, snap, null, id.keyHash),
        now,
      );
      const view = projectFor({
        roomId: snap.room.id,
        state: asState(snap.room),
        version: snap.room.version,
        seat: 0,
        now,
        oppPlayer: null,
      });
      return ok<CreateRoomOk>({ ok: true, serverNow: now, code, seat: 0, view });
    }
    return err(now, 'CONFLICT');
  } catch (e) {
    return mapStoreError(deps, e);
  }
}

// ─── 공통: 방 접근 + 변경 루프 ──────────────────────────────────────────────────

interface Access {
  snap: RoomSnapshot;
  state: RoomState;
  seat: Seat;
}

type AccessResult = { ok: true; a: Access } | { ok: false; out: Out<never> };

async function access(deps: PipelineDeps, code: string, id: Identity, now: number): Promise<AccessResult> {
  if (!ROOM_CODE_RE.test(code)) return { ok: false, out: err(now, 'ROOM_NOT_FOUND') };
  const snap = await deps.store.load(code, now);
  if (!snap) return { ok: false, out: err(now, 'ROOM_NOT_FOUND') };
  const state = asState(snap.room);
  const seat = seatOfKey(state, id.keyHash);
  if (seat === null) return { ok: false, out: err(now, isFull(state) ? 'ROOM_FULL' : 'NOT_JOINED') };
  return { ok: true, a: { snap, state, seat } };
}

/** 접속 신호: 요청 처음에 한 번만. 결과를 내 접속 정보로 쓴다. */
async function touch(deps: PipelineDeps, a: Access, view: 'game' | 'disguise' | undefined, now: number): Promise<SeatPresence | null> {
  const t = await deps.store.touchPlayer(
    a.snap.room.id,
    a.seat,
    { ...(view ? { viewState: view } : {}), extendRoomExpiryTo: now + ROOM_IDLE_MS },
    now,
  );
  return t ? toPresence(t.player) : toPresence(a.snap.players[a.seat]);
}

// ─── 입장 ────────────────────────────────────────────────────────────────────

export async function joinFlow(deps: PipelineDeps, code: string, id: Identity | null, raw: unknown): Promise<Out<JoinOk>> {
  const now = deps.now();
  try {
    if (!id) return invalid(now, 'key');
    const jr = deps.limiter.hit('join', id.keyHash, RATE_RULES.joinByKey, now);
    if (!jr.ok) return err(now, 'RATE_LIMITED', { retryAfterMs: jr.retryAfterMs });
    if (!ROOM_CODE_RE.test(code)) return accessFailed(deps, id, now, err(now, 'ROOM_NOT_FOUND'));
    const blocked = deps.limiter.peek('join-fail', id.keyHash, RATE_RULES.joinFailByKey, now);
    if (!blocked.ok) return err(now, 'RATE_LIMITED', { retryAfterMs: blocked.retryAfterMs });
    const parsed = joinSchema.safeParse(raw);
    if (!parsed.success) return invalid(now, 'body');
    const cleaned = cleanNickname(parsed.data.nickname);
    if (cleaned === null) return invalid(now, 'nickname');
    const nickname = screenNickname(cleaned, id.keyHash); // 금칙어 → 기본 닉네임(QA BUG-09). 재입장은 엔진이 처음 값을 유지
    const failed = (out: Out<never>): Out<never> => {
      deps.limiter.record('join-fail', id.keyHash, RATE_RULES.joinFailByKey, now);
      return out;
    };
    const failedAccess = (out: Out<never>): Out<never> => failed(accessFailed(deps, id, now, out));

    let placedPlayer = false;
    let staleCleared = false;
    for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
      const snap = await deps.store.load(code, now);
      if (!snap) return failedAccess(err(now, 'ROOM_NOT_FOUND'));
      const state = asState(snap.room);
      const existing = seatOfKey(state, id.keyHash);
      if (existing === null) {
        if (isFull(state)) return failedAccess(err(now, 'ROOM_FULL'));
        // 새 사람의 입장만 IP 실패 한도를 본다(무차별 대입으로 찾은 방에 들어오는 것을 막음). 재입장은 보지 않는다
        const ipBlocked = ipAccessBlocked(deps, id, now);
        if (ipBlocked) return ipBlocked;
        if (!placedPlayer) {
          const add = await deps.store.addPlayer(
            { roomId: snap.room.id, seat: 1, playerKey: id.keyHash, nickname, industry: parsed.data.industry },
            now,
          );
          if (!add.ok) {
            if (add.reason === 'SEAT_TAKEN') {
              // [D3 R3] 상태에는 손님 자리가 비었는데 행이 남아 있다(나가기 뒤 행 삭제 실패). 그 행의 접속 신호가
              // PRESENCE_MS보다 오래됐으면 남은 행으로 보고, 그 키일 때만 지운 뒤 다시 시도한다. 방금 들어온 사람
              // (행 추가 후 상태 저장 직전)은 접속 신호가 최신이라 지우지 않는다.
              const row = snap.players[1];
              if (
                !staleCleared &&
                state.seats[1] === null &&
                row !== null &&
                seatOfKey(state, row.playerKey) === null &&
                now - row.lastSeen > PRESENCE_MS
              ) {
                staleCleared = true;
                await deps.store.removePlayer(snap.room.id, 1, row.playerKey);
                continue;
              }
              return failed(err(now, 'ROOM_FULL'));
            }
            // KEY_EXISTS: 이미 이 키의 행이 있다(앞선 시도에서 넣었거나 상태만 비어 있음) → 계속 진행
          }
          placedPlayer = true;
        }
      }
      // 재입장·신규 모두: 접속 신호
      const fresh = (await deps.store.load(code, now)) ?? snap;
      const seatNow = existing ?? 1;
      const touched = await deps.store.touchPlayer(
        snap.room.id,
        seatNow,
        { viewState: 'game', extendRoomExpiryTo: now + ROOM_IDLE_MS },
        now,
      );
      const mine = touched ? toPresence(touched.player) : null;
      const ctx = engineCtx(deps, now, pairFor(fresh, seatNow, mine));
      const j = joinSeat(state, { keyHash: id.keyHash, nickname, industry: parsed.data.industry }, ctx);
      if (!j.ok) return failed(err(now, 'ROOM_FULL'));
      let cur = j.stepped.state;
      let changed = j.stepped.changed;
      const effects: EngineEffect[] = [...j.stepped.effects];
      const adv = advance(cur, ctx);
      if (adv.changed) {
        cur = adv.state;
        changed = true;
        effects.push(...adv.effects);
      }
      // [D3 R1] 이 응답에 검산이 실리면 배달 시각을 기록한다(새로고침 재입장 중 검산)
      const dlv = markDelivered(cur, j.seat, ctx);
      if (dlv.changed) {
        cur = dlv.state;
        changed = true;
      }
      let version = snap.room.version;
      if (changed) {
        const saved = await deps.store.save(
          snap.room.id,
          snap.room.version,
          { state: asJson(cur), status: cur.status, expiresAt: now + ROOM_IDLE_MS },
          now,
        );
        if (!saved.ok) continue; // CONFLICT: 다시 load해서 판단
        version = saved.version;
        await applyEffects(deps, snap, state, cur, effects, now);
        if (!j.rejoined) {
          await recordEvent(
            deps.store,
            'room_joined',
            { seat: j.seat, hostKey: state.seats[0]?.keyHash ?? id.keyHash },
            eventCtx(deps, snap, null, id.keyHash),
            now,
          );
        }
        await ring(deps, snap, version);
      }
      const view = projectFor({
        roomId: snap.room.id,
        state: cur,
        version,
        seat: j.seat,
        now,
        oppPlayer: fresh.players[oppOf(j.seat)],
      });
      return ok<JoinOk>({ ok: true, serverNow: now, seat: j.seat, rejoined: j.rejoined, view });
    }
    // 재시도 소진: 우리가 넣은 자리 행이 상태에 없으면 되돌린다
    if (placedPlayer) {
      const snap = await deps.store.load(code, now);
      if (snap && seatOfKey(asState(snap.room), id.keyHash) === null) await deps.store.removePlayer(snap.room.id, 1);
    }
    return failed(err(now, 'CONFLICT'));
  } catch (e) {
    return mapStoreError(deps, e);
  }
}

// ─── sync ────────────────────────────────────────────────────────────────────

export async function syncFlow(deps: PipelineDeps, code: string, id: Identity | null, raw: unknown): Promise<Out<SyncOk>> {
  const now = deps.now();
  try {
    if (!id) return invalid(now, 'key');
    const rl = deps.limiter.hit('sync', id.keyHash, RATE_RULES.syncByKey, now);
    if (!rl.ok) return err(now, 'RATE_LIMITED', { retryAfterMs: rl.retryAfterMs });
    const parsed = syncSchema.safeParse(raw);
    if (!parsed.success) return invalid(now, 'body');
    const body = parsed.data;

    let mine: SeatPresence | null | undefined;
    for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
      const acc = await access(deps, code, id, now);
      if (!acc.ok) return accessFailed(deps, id, now, acc.out);
      const { snap, state, seat } = acc.a;
      if (mine === undefined) mine = await touch(deps, acc.a, body.view, now);
      const ctx = engineCtx(deps, now, pairFor(snap, seat, mine ?? null));

      let cur = state;
      let changed = false;
      const effects: EngineEffect[] = [];
      const step = (s: Stepped) => {
        if (!s.changed) return;
        cur = s.state;
        changed = true;
        effects.push(...s.effects);
      };
      step(advance(cur, ctx));
      if (body.alarm) step(reportAlarm(cur, seat, body.alarm, ctx));
      step(markDelivered(cur, seat, ctx));

      let version = snap.room.version;
      if (changed) {
        const saved = await deps.store.save(
          snap.room.id,
          snap.room.version,
          { state: asJson(cur), status: cur.status, expiresAt: now + ROOM_IDLE_MS },
          now,
        );
        if (!saved.ok) continue;
        version = saved.version;
        await applyEffects(deps, snap, state, cur, effects, now);
        await ring(deps, snap, version);
      }
      const opp = snap.players[oppOf(seat)];
      const presence = presenceFor(opp);
      if (!changed && body.knownVersion === version) {
        return ok<SyncOk>({ ok: true, serverNow: now, presence, changed: false, version });
      }
      const view = projectFor({ roomId: snap.room.id, state: cur, version, seat, now, oppPlayer: opp });
      return ok<SyncOk>({ ok: true, serverNow: now, presence, changed: true, view });
    }
    return err(now, 'CONFLICT');
  } catch (e) {
    return mapStoreError(deps, e);
  }
}

// ─── action ──────────────────────────────────────────────────────────────────

export async function actionFlow(deps: PipelineDeps, code: string, id: Identity | null, raw: unknown): Promise<Out<ActionOk>> {
  const now = deps.now();
  try {
    if (!id) return invalid(now, 'key');
    const rl = deps.limiter.hit('action', id.keyHash, RATE_RULES.actionByKey, now);
    if (!rl.ok) return err(now, 'RATE_LIMITED', { retryAfterMs: rl.retryAfterMs });
    const parsed = actionSchema.safeParse(raw);
    if (!parsed.success) return invalid(now, bodyReason(raw));
    const body = parsed.data as unknown as ActionBody;

    let mine: SeatPresence | null | undefined;
    for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
      const acc = await access(deps, code, id, now);
      if (!acc.ok) return accessFailed(deps, id, now, acc.out);
      const { snap, state, seat } = acc.a;
      if (mine === undefined) mine = await touch(deps, acc.a, undefined, now);
      const ctx = engineCtx(deps, now, pairFor(snap, seat, mine ?? null));
      const opp = snap.players[oppOf(seat)];
      const view = (s: RoomState, version: number) => projectFor({ roomId: snap.room.id, state: s, version, seat, now, oppPlayer: opp });

      const effects: EngineEffect[] = [];
      const adv = advance(state, ctx);
      let cur = adv.state;
      let changed = adv.changed;
      effects.push(...adv.effects);

      const res = applyAction(cur, seat, body, ctx);
      if (!res.ok) {
        // 거부: 그 전에 처리한 기한(시간 초과 등)만 저장한다(경합이면 다음 요청이 다시 처리)
        // [D3 R1] 거부 응답에도 화면 데이터가 실리므로, 거기 검산이 처음 실리면 배달 시각도 함께 저장한다
        const rdlv = markDelivered(cur, seat, ctx);
        if (rdlv.changed) {
          cur = rdlv.state;
          changed = true;
        }
        let version = snap.room.version;
        if (changed) {
          const saved = await deps.store.save(
            snap.room.id,
            snap.room.version,
            { state: asJson(cur), status: cur.status, expiresAt: now + ROOM_IDLE_MS },
            now,
          );
          if (saved.ok) {
            version = saved.version;
            await applyEffects(deps, snap, state, cur, effects, now);
            await ring(deps, snap, version);
          } else {
            cur = state; // 저장 못 했으니 옛 상태로 보여 준다
          }
        }
        return err(now, res.error, { ...(res.reason ? { reason: res.reason } : {}), view: view(cur, version) });
      }
      if (res.changed) {
        cur = res.state;
        changed = true;
        effects.push(...res.effects);
      }
      const dlv = markDelivered(cur, seat, ctx);
      if (dlv.changed) {
        cur = dlv.state;
        changed = true;
      }
      let version = snap.room.version;
      if (changed) {
        const saved = await deps.store.save(
          snap.room.id,
          snap.room.version,
          { state: asJson(cur), status: cur.status, expiresAt: now + ROOM_IDLE_MS },
          now,
        );
        if (!saved.ok) continue; // CONFLICT: 다시 load → 다시 적용(actionId가 중복을 막는다)
        version = saved.version;
        await applyEffects(deps, snap, state, cur, effects, now);
        await ring(deps, snap, version);
      }
      // [D3 R6] 대기·배치 중 손님이 나가면 자리가 사라져 화면 데이터를 만들 수 없다(전에는 투영이 throw → 500).
      // 나가기는 저장됐고, 이제 이 키는 자리가 없으므로 NOT_JOINED로 답한다(재전송도 같은 답). 클라는 홈으로 간다.
      if (cur.seats[seat] === null) return err(now, 'NOT_JOINED');
      return ok<ActionOk>({ ok: true, serverNow: now, view: view(cur, version), duplicate: res.duplicate });
    }
    return err(now, 'CONFLICT');
  } catch (e) {
    return mapStoreError(deps, e);
  }
}

function bodyReason(raw: unknown): InvalidReason {
  const r = raw as { type?: unknown; cell?: unknown; ships?: unknown } | null;
  if (r && r.type === 'fire') return 'cell';
  if (r && r.type === 'place') return 'ships';
  if (r && r.type === 'taunt') return 'taunt_id';
  return 'body';
}

// ─── feedback · health ───────────────────────────────────────────────────────

export async function feedbackFlow(deps: PipelineDeps, id: Identity | null, raw: unknown): Promise<Out<{ ok: true; serverNow: number }>> {
  const now = deps.now();
  try {
    if (!id) return invalid(now, 'key');
    const rl = deps.limiter.hit('feedback', id.keyHash, RATE_RULES.feedbackByKey, now);
    if (!rl.ok) return err(now, 'RATE_LIMITED', { retryAfterMs: rl.retryAfterMs });
    if (id.ip !== UNKNOWN_IP) {
      const ipr = deps.limiter.hit('feedback-ip', id.ip, RATE_RULES.feedbackByIp, now);
      if (!ipr.ok) return err(now, 'RATE_LIMITED', { retryAfterMs: ipr.retryAfterMs });
    }
    const parsed = feedbackSchema.safeParse(raw);
    if (!parsed.success) return invalid(now, 'body');
    const b = parsed.data;
    if (b.type === 'transport') {
      await recordEvent(deps.store, 'transport', { bell: b.bell }, { roomId: null, matchId: null, playerKey: id.keyHash, env: deps.env, isTest: id.isTest }, now);
      return ok({ ok: true, serverNow: now });
    }
    const match = await deps.store.getMatch(b.matchId);
    const snap = await deps.store.load(b.code, now);
    if (!match || !snap || match.roomId !== snap.room.id || !match.playerKeys.includes(id.keyHash)) return err(now, 'ROOM_NOT_FOUND');
    const ctx: EventContext = { roomId: snap.room.id, matchId: match.id, playerKey: id.keyHash, env: deps.env, isTest: snap.room.isTest };
    if (b.type === 'feedback') await recordEvent(deps.store, 'feedback', { laugh: b.laugh }, ctx, now);
    else if (b.type === 'line_report') await recordEvent(deps.store, 'line_report', { lineId: b.lineId }, ctx, now);
    else if (b.type === 'lines_shown') await recordEvent(deps.store, 'lines_shown', { lineIds: b.lineIds }, ctx, now);
    else await recordEvent(deps.store, 'share_copied', { doc: b.doc }, ctx, now);
    return ok({ ok: true, serverNow: now });
  } catch (e) {
    return mapStoreError(deps, e);
  }
}

export async function healthFlow(deps: PipelineDeps | null): Promise<HealthOk> {
  if (!deps) return { db: 'down' };
  try {
    return { db: (await deps.store.health()) ? 'ok' : 'down' };
  } catch {
    return { db: 'down' };
  }
}

export type { IndustryId };
