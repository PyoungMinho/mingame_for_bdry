/**
 * 실전 방 클라이언트 (React 없음). useMcRoom이 감싼다.
 *
 *  - sync 폴링: 주기 = SYNC_MS (초인종 있으면 play 2s / idle 5s, 없으면 playNoBell 1s / idleNoBell 3s, 탭이 가려지면 hiddenTab 5s).
 *  - 초인종: Supabase Realtime Broadcast `mc:<방 UUID>` 이벤트 'v' 페이로드 {v}. v가 내 version보다 크면 refresh()(300ms 간격 제한,
 *    제한 중 들어온 초인종은 뒤쪽 refresh 1개로 묶는다).
 *  - place 응답 대기 중 들어온 place는 마지막 1개만 남겨 앞 응답 뒤에 보낸다(배치 연속 조작). 다른 액션은 대기 중이면 WRONG_PHASE.
 *  - 첫 sync는 deps.firstSyncView(있으면)를 보고한다 — 숨김으로 시작할 새로고침이 RTT 동안 'game'으로 보이지 않게.
 *    연결이 안 되면(회사망 차단) 폴링만으로 돈다. 세션당 1회 transport 지표.
 *  - version이 더 클 때만 view를 갈아 끼운다. 단 sync의 presence는 같은 version이어도 view.opp.lastSeenAt·hidden에 덮어쓴다(규칙 7).
 *  - 판정은 서버 응답만 따른다(낙관적 판정 금지). 액션 중에는 pending = true.
 *  - 화면이 사라질 때 자동 leave 없음.
 *  - 기한(settleAt·deadlineAt·budgetEndsAt·placeDeadlineAt·rematch.expiresAt) 도달 시 refresh 1회 예약.
 *  - 판이 끝난 뒤(ended) 폴링(백엔드 리뷰 F1 — 결과 화면을 열어 둔 탭 하나가 시간당 720~1,200회 sync를 보내 Vercel Hobby 한도를 위협했다):
 *      재대결 요청 대기 중(expiresAt 전) = 지금과 같은 간격(idle 5s / 초인종 없음 3s) — 2분 상한
 *      그 밖 = 느리게(보이는 게임 화면 30s, 숨기기·탭 비활성 60s). 초인종이 오면 즉시 sync는 그대로
 *      멈춤 = 상대가 나감(opp.present false) · 재대결 기한이 지남(rematchExpired) · 판이 끝나고 ENDED_IDLE_STOP_MS 지남
 *      멈춘 뒤에도 초인종·내 액션([v8로 저장] 등)·기한 refresh는 동작하고, 응답 view가 다시 폴링 조건이면 이어서 돈다.
 *    대기(waiting)·배치·대전 중 간격(대전 20초 턴·경보 3초를 지키는 값)은 바꾸지 않는다.
 */

import { BELL_EVENT, type ActionPayload, type ErrorCode, type JoinBody, type PresenceView, type RoomView, type Seat, type SyncBody, type TauntId, type ViewState } from '../protocol';
import { BELL_SYNC_MIN_GAP_MS, SYNC_MS } from '../constants';
import type { CellAddr, HintTarget, ShipPlacement } from '../coords';
import type { ActionOutcome, ConnectionState, RoomController, RoomControllerState, RoomEntry, TransportMode } from './controller';
import { mcApi, type ApiOutcome } from './api';
import { ServerClock } from './serverClock';

export interface LiveRoomDeps {
  /** 지금 화면 상태(숨기기 여부) — viewStore.view */
  readonly getView: () => ViewState;
  /**
   * 첫 sync에만 보고할 화면 상태. 새로고침·다시 열기는 "자리가 있으면 숨김으로 시작"인데 숨김은 첫 응답 뒤 effect에서
   * 일어나므로, getView()만 보면 첫 sync가 서버에 'game'을 보고했다(BUG-17). 없으면 getView().
   */
  readonly firstSyncView?: () => ViewState;
  /** 초인종 구독(없으면 폴링만). 해제 함수를 돌려준다 */
  readonly subscribeBell?: (topic: string, onVersion: (v: number) => void, onStatus: (ok: boolean) => void) => () => void;
  readonly local?: () => number;
  /** 탭이 보이는가(기본 document.visibilityState) */
  readonly isTabVisible?: () => boolean;
}

type Listener = () => void;

const FAIL_RECONNECTING = 2;
const FAIL_DOWN = 8;
/** 판이 끝난 뒤(재대결 대기 아님) 폴링 간격: 보이는 게임 화면 / 숨기기·탭 비활성 */
export const ENDED_POLL_MS = { visible: 30_000, hidden: 60_000 } as const;
/** 판이 끝나고 이만큼 지나면(재대결 대기 아님) 폴링을 멈춘다. 방은 30분 무활동 뒤 서버에서 만료될 수 있다 */
export const ENDED_IDLE_STOP_MS = 10 * 60_000;

export class LiveRoom {
  private state: RoomControllerState = { entry: { kind: 'loading' }, view: null, connection: 'connecting', transport: 'poll', pending: false, lastError: null };
  private readonly listeners = new Set<Listener>();
  private readonly clock: ServerClock;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private deadlineTimer: ReturnType<typeof setTimeout> | null = null;
  private inflight = false;
  private failures = 0;
  /** RATE_LIMITED 응답의 retryAfterMs(다음 재시도 하한) */
  private retryAfter = 0;
  private lastBellSyncAt = 0;
  /** 간격 제한 중 들어온 초인종들을 묶는 뒤쪽 refresh 1개(BUG-13: 메시지마다 예약했다) */
  private bellTimer: ReturnType<typeof setTimeout> | null = null;
  /** 첫 sync를 보냈는가(firstSyncView는 그때 한 번만) */
  private firstSyncSent = false;
  /** 지금 서버로 가는 액션 종류(place 응답 대기 중 들어온 place만 묶는다) */
  private inflightAction: ActionPayload['type'] | null = null;
  /** place 응답 대기 중 들어온 마지막 배치(BUG-06: 요청 없이 WRONG_PHASE로 버렸다) */
  private queuedPlace: { ships: readonly ShipPlacement[]; confirm: boolean } | null = null;
  private bellTopic: string | null = null;
  private unsubBell: (() => void) | null = null;
  private bellOk = false;
  /** 초인종 연결 결과(성공·실패)를 한 번이라도 받았는가. transport 지표는 이게 정해진 뒤에 보낸다 */
  private bellKnown = false;
  private pendingAlarm: { issuedAt: number; reactionMs: number } | null = null;
  private started = false;
  private disposed = false;
  private transportReported = false;
  private readonly local: () => number;
  private snapshotController: RoomController | null = null;
  /** 다음 폴링 예정 시각(로컬). 정책이 더 짧은 간격을 요구하면 당겨 다시 잡는다 */
  private timerDue = 0;
  /** 판이 끝난 것을 처음 본 시각(로컬)과 그 판 id */
  private endedSeen: { matchId: string; at: number } | null = null;

  constructor(
    readonly code: string,
    private readonly deps: LiveRoomDeps,
  ) {
    this.local = deps.local ?? (() => Date.now());
    this.clock = new ServerClock(this.local);
  }

  // ── 구독 ──
  readonly subscribe = (l: Listener): (() => void) => {
    this.listeners.add(l);
    return () => this.listeners.delete(l);
  };
  getState(): RoomControllerState {
    return this.state;
  }
  now = (): number => this.clock.now();

  /** 첫 sync 시작 + 폴링 시작 */
  start(): void {
    if (this.started) return;
    this.started = true;
    this.disposed = false;
    void this.syncOnce();
  }
  dispose(): void {
    this.disposed = true;
    this.started = false;
    if (this.timer) clearTimeout(this.timer);
    if (this.deadlineTimer) clearTimeout(this.deadlineTimer);
    if (this.bellTimer) clearTimeout(this.bellTimer);
    this.timer = this.deadlineTimer = this.bellTimer = null;
    this.unsubBell?.();
    this.unsubBell = null;
    // StrictMode(개발)의 마운트→해제→마운트에서 다시 start()하면 초인종을 새로 구독해야 한다
    this.bellTopic = null;
    this.bellOk = false;
    this.bellKnown = false;
  }

  private set(patch: Partial<RoomControllerState>): void {
    this.state = { ...this.state, ...patch };
    this.snapshotController = null;
    for (const l of this.listeners) l();
  }

  // ── 화면 데이터 반영 ──
  private applyView(view: RoomView, opts: { force?: boolean; presence?: PresenceView | null } = {}): void {
    // 화면이 사라진 뒤 도착한 응답은 버린다 — watchBell이 초인종을 다시 구독해 채널 1개가 남았다(MC-FE-02)
    if (this.disposed) return;
    const cur = this.state.view;
    let next: RoomView | null = view;
    if (cur && view.room.code === cur.room.code && view.room.version < cur.room.version) next = cur;
    else if (cur && view.room.version === cur.room.version && !opts.force) next = cur;
    const pr = opts.presence;
    if (next && pr && next.opp && (next.opp.lastSeenAt !== pr.oppLastSeenAt || next.opp.hidden !== pr.oppHidden)) {
      next = { ...next, opp: { ...next.opp, lastSeenAt: pr.oppLastSeenAt, hidden: pr.oppHidden } } as RoomView;
    }
    const changed = next !== cur;
    const seat: Seat = (next ?? view).me.seat;
    const entry: RoomEntry = { kind: 'seated', seat };
    if (changed || this.state.entry.kind !== 'seated') this.set({ view: next, entry });
    if (next) this.watchBell(next.room.bellTopic);
    this.scheduleDeadline();
    this.reconcilePolling();
  }

  private mapError(error: ErrorCode | 'NETWORK'): RoomEntry | null {
    switch (error) {
      case 'ROOM_NOT_FOUND':
        return { kind: 'notFound' };
      case 'ROOM_FULL':
        return { kind: 'full' };
      case 'NOT_JOINED':
        return { kind: 'needJoin' };
      case 'SERVICE_DOWN':
      case 'CAPACITY':
        return { kind: 'down' };
      default:
        return null;
    }
  }

  private noteResponse<T>(r: ApiOutcome<T>, sentAt: number): void {
    if ('serverNow' in r && typeof r.serverNow === 'number') this.clock.sample(r.serverNow, sentAt, this.local());
  }

  // ── sync ──
  private async syncOnce(): Promise<void> {
    if (this.disposed || this.inflight) return;
    this.inflight = true;
    const cur = this.state.view;
    // 첫 sync: 숨김으로 시작할 화면이면 그 RTT 동안에도 서버가 'game'으로 보지 않게(BUG-17). 지금 이미 숨김이면 그대로 숨김
    const now = this.deps.getView();
    const view: ViewState = !this.firstSyncSent && this.deps.firstSyncView && now === 'game' ? this.deps.firstSyncView() : now;
    this.firstSyncSent = true;
    const body: SyncBody = { knownVersion: cur ? cur.room.version : -1, view };
    if (this.pendingAlarm) (body as { alarm?: SyncBody['alarm'] }).alarm = this.pendingAlarm;
    const sentAlarm = this.pendingAlarm;
    const t0 = this.local();
    const r = await mcApi.sync(this.code, body);
    this.inflight = false;
    if (this.disposed) return;
    this.noteResponse(r, t0);
    if (r.ok) {
      if (sentAlarm && this.pendingAlarm === sentAlarm) this.pendingAlarm = null;
      this.failures = 0;
      if (this.state.connection !== 'live') this.set({ connection: 'live' });
      if (r.changed) this.applyView(r.view, { presence: r.presence });
      else if (this.state.view && r.presence && this.state.view.opp) this.applyView(this.state.view, { force: true, presence: r.presence });
      else if (!this.state.view) this.set({ entry: { kind: 'needJoin' } });
      this.reportTransportOnce();
    } else {
      const entry = this.mapError(r.error);
      if (entry && r.error !== 'NETWORK') {
        this.failures = 0;
        this.set({ entry, connection: entry.kind === 'down' ? 'down' : 'live', lastError: { code: r.error, at: this.local() } });
        if (entry.kind !== 'down') {
          // 방 없음·꽉 참·입장 필요는 폴링하지 않는다(입장 후 join이 다시 시작시킨다). 점검은 계속 재시도
          return;
        }
      } else {
        if (r.error === 'RATE_LIMITED' && r.retryAfterMs) this.retryAfter = r.retryAfterMs;
        this.failures += 1;
        const connection: ConnectionState = this.failures >= FAIL_DOWN ? 'down' : this.failures >= FAIL_RECONNECTING ? 'reconnecting' : this.state.connection;
        this.set({ connection, lastError: { code: r.error, at: this.local() } });
      }
    }
    this.schedule();
  }

  private tabVisible(): boolean {
    return this.deps.isTabVisible ? this.deps.isTabVisible() : typeof document === 'undefined' || document.visibilityState === 'visible';
  }

  /** 다음 폴링까지 간격. null = 폴링하지 않음(판이 끝난 방의 멈춤 조건) */
  private interval(): number | null {
    const visible = this.tabVisible();
    const v = this.state.view;
    if (v?.status === 'ended') {
      if (!this.endedSeen || this.endedSeen.matchId !== v.game.matchId) this.endedSeen = { matchId: v.game.matchId, at: this.local() };
      if (!v.opp.present) return null;
      const exp = v.rematch.expiresAt;
      if (exp !== null && this.now() < exp) {
        // 재대결 요청 대기(최대 REMATCH_WAIT_MS): 상대 수락을 놓치지 않게 예전 간격
        if (!visible) return SYNC_MS.hiddenTab;
        return this.bellOk ? SYNC_MS.idle : SYNC_MS.idleNoBell;
      }
      if (exp !== null || v.events.some((e) => e.type === 'rematchExpired')) return null;
      if (this.local() - this.endedSeen.at >= ENDED_IDLE_STOP_MS) return null;
      return visible && this.deps.getView() === 'game' ? ENDED_POLL_MS.visible : ENDED_POLL_MS.hidden;
    }
    if (!visible) return SYNC_MS.hiddenTab;
    const active = v?.status === 'playing' || v?.status === 'placing';
    if (this.bellOk) return active ? SYNC_MS.play : SYNC_MS.idle;
    return active ? SYNC_MS.playNoBell : SYNC_MS.idleNoBell;
  }

  private schedule(): void {
    if (this.disposed) return;
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
    // 실패 중에는 5초 간격 재시도(방향서 X5)
    const ms = this.failures > 0 ? Math.max(5000, this.retryAfter) : this.interval();
    this.retryAfter = 0;
    if (ms === null) return; // 멈춤: 초인종·액션·기한 refresh가 다시 깨운다
    this.timerDue = this.local() + ms;
    this.timer = setTimeout(() => {
      this.timer = null;
      void this.syncOnce();
    }, ms);
  }

  /**
   * view가 바뀔 때 폴링 정책을 맞춘다: 멈춤 조건이면 타이머를 끄고, 멈춰 있었는데 다시 돌 조건이면(내 [v8로 저장] 응답 등) 다시 잡고,
   * 예정 시각이 새 간격보다 늦으면(결과 30초 → 재대결 대기 5초) 당긴다. sync 진행 중이면 그 끝의 schedule()이 맡는다.
   */
  private reconcilePolling(): void {
    if (this.disposed || !this.started || this.inflight || this.failures > 0) return;
    const ms = this.interval();
    if (ms === null) {
      if (this.timer) clearTimeout(this.timer);
      this.timer = null;
      return;
    }
    if (!this.timer || this.timerDue - this.local() > ms) this.schedule();
  }

  private scheduleDeadline(): void {
    if (this.deadlineTimer) clearTimeout(this.deadlineTimer);
    this.deadlineTimer = null;
    const v = this.state.view;
    if (!v) return;
    const times: number[] = [];
    if (v.status === 'placing') times.push(v.placeDeadlineAt);
    if (v.status === 'playing') {
      const g = v.game;
      if (g.clock.state === 'running') times.push(g.clock.deadlineAt);
      else if (g.clock.reason === 'hidden') times.push(g.clock.budgetEndsAt);
      if (g.quiz) {
        times.push(g.quiz.deadlineAt);
        if (g.quiz.settleAt !== null) times.push(g.quiz.settleAt);
      }
    }
    if (v.status === 'ended' && v.rematch.expiresAt !== null) times.push(v.rematch.expiresAt);
    const now = this.now();
    const future = times.filter((t) => t > now - 50).sort((a, b) => a - b)[0];
    if (future === undefined) return;
    this.deadlineTimer = setTimeout(() => this.refresh(), Math.max(0, future - now) + 150);
  }

  // ── 초인종 ──
  private watchBell(topic: string): void {
    if (this.disposed || !topic || topic === this.bellTopic || !this.deps.subscribeBell) return;
    this.unsubBell?.();
    this.bellTopic = topic;
    this.unsubBell = this.deps.subscribeBell(
      topic,
      (v) => {
        const known = this.state.view?.room.version ?? -1;
        if (v <= known) return;
        const t = this.local();
        const wait = this.lastBellSyncAt + BELL_SYNC_MIN_GAP_MS - t;
        if (wait > 0) {
          // 간격 제한 중: 뒤쪽 refresh 1개로 묶는다(이미 예약돼 있으면 더 예약하지 않음) → 초당 최대 1000/GAP회
          if (!this.bellTimer) {
            this.bellTimer = setTimeout(() => {
              this.bellTimer = null;
              this.lastBellSyncAt = this.local();
              this.refresh();
            }, wait);
          }
          return;
        }
        this.lastBellSyncAt = t;
        this.refresh();
      },
      (ok) => {
        this.bellOk = ok;
        this.bellKnown = true;
        const transport: TransportMode = ok ? 'bell' : 'poll';
        if (this.state.transport !== transport) this.set({ transport });
        this.reportTransportOnce();
      },
    );
  }

  /**
   * 세션당 1회 transport 지표. 초인종 구독이 있으면 연결 결과(onStatus)가 온 뒤에만 보낸다
   * (D3: 첫 sync 직후 보내면 구독이 끝나기 전이라 항상 bell:false로 기록됐다).
   */
  private reportTransportOnce(): void {
    if (this.transportReported || !this.state.view) return;
    if (this.deps.subscribeBell && !this.bellKnown) return;
    this.transportReported = true;
    void mcApi.feedback({ type: 'transport', code: this.code, bell: this.bellOk });
  }

  // ── 컨트롤러 동작 ──
  refresh = (): void => {
    if (this.disposed || !this.started) return;
    if (this.timer) clearTimeout(this.timer);
    void this.syncOnce();
  };

  private async act(payload: ActionPayload): Promise<ActionOutcome> {
    if (this.state.pending) {
      // 배치 초안 저장 응답을 기다리는 중 들어온 배치는 버리지 않고 "마지막 1개"로 묶어 앞 응답 뒤에 보낸다(BUG-06).
      // 호출자에게는 접수됐다는 뜻으로 지금 화면 데이터를 돌려준다(결과는 뒤 응답이 view로 반영). 다른 액션은 예전대로 거절.
      if (payload.type === 'place' && this.inflightAction === 'place' && this.state.view) {
        this.queuedPlace = { ships: payload.ships, confirm: payload.confirm };
        return { ok: true, view: this.state.view };
      }
      return { ok: false, error: 'WRONG_PHASE' };
    }
    this.set({ pending: true });
    this.inflightAction = payload.type;
    const t0 = this.local();
    const r = await mcApi.action(this.code, payload);
    this.inflightAction = null;
    this.noteResponse(r, t0);
    let out: ActionOutcome;
    if (r.ok) {
      this.failures = 0;
      this.applyView(r.view, { force: r.view.room.version >= (this.state.view?.room.version ?? -1) });
      this.set({ pending: false, lastError: null, connection: 'live' });
      out = { ok: true, view: r.view };
    } else {
      if (r.view) this.applyView(r.view);
      const entry = this.mapError(r.error);
      this.set({ pending: false, lastError: { code: r.error, reason: r.reason, at: this.local() }, ...(entry && r.error !== 'NETWORK' ? { entry } : {}) });
      out = { ok: false, error: r.error, reason: r.reason };
    }
    const next = this.queuedPlace;
    this.queuedPlace = null;
    if (next && !this.disposed && this.state.entry.kind === 'seated') void this.act({ type: 'place', ships: next.ships, confirm: next.confirm });
    return out;
  }

  join = async (body: JoinBody): Promise<ActionOutcome> => {
    this.set({ pending: true });
    const t0 = this.local();
    const r = await mcApi.join(this.code, body);
    this.noteResponse(r, t0);
    if (r.ok) {
      this.failures = 0;
      this.applyView(r.view, { force: true });
      this.set({ pending: false, lastError: null, connection: 'live', entry: { kind: 'seated', seat: r.seat } });
      this.started = true;
      this.schedule();
      return { ok: true, view: r.view };
    }
    const entry = this.mapError(r.error);
    this.set({ pending: false, lastError: { code: r.error, reason: r.reason, at: this.local() }, ...(entry ? { entry } : {}) });
    return { ok: false, error: r.error, reason: r.reason };
  };

  place = (ships: readonly ShipPlacement[], confirm: boolean) => this.act({ type: 'place', ships, confirm });
  fire = (cell: CellAddr) => this.act({ type: 'fire', cell });
  answer = (quizId: string, value: number) => this.act({ type: 'answer', quizId, value });
  hint = (target: HintTarget) => this.act({ type: 'hint', target });
  taunt = (id: TauntId) => this.act({ type: 'taunt', tauntId: id });
  rematch = () => this.act({ type: 'rematch' });
  resign = () => this.act({ type: 'resign' });
  claimAbsent = () => this.act({ type: 'claimAbsent' });
  /**
   * 나가기. 대기·배치 중 손님이 나가면 서버는 자리를 비운 뒤라 성공해도 403 NOT_JOINED로 답한다(D3 백엔드).
   * 이 경우를 성공으로 보고 entry를 needJoin으로 바꾸지 않는다(입장 대화상자가 잠깐 비치지 않게). 폴링도 멈춘다.
   */
  leave = async (): Promise<ActionOutcome> => {
    const before = this.state.view;
    if (this.state.pending) return { ok: false, error: 'WRONG_PHASE' };
    this.set({ pending: true });
    const t0 = this.local();
    const r = await mcApi.action(this.code, { type: 'leave' });
    this.noteResponse(r, t0);
    if (r.ok) {
      this.applyView(r.view, { force: true });
      this.set({ pending: false, lastError: null });
      return { ok: true, view: r.view };
    }
    if (r.error === 'NOT_JOINED' && before) {
      this.set({ pending: false, lastError: null });
      this.stopPolling();
      return { ok: true, view: before };
    }
    if (r.view) this.applyView(r.view);
    const entry = this.mapError(r.error);
    this.set({ pending: false, lastError: { code: r.error, reason: r.reason, at: this.local() }, ...(entry && r.error !== 'NETWORK' ? { entry } : {}) });
    return { ok: false, error: r.error, reason: r.reason };
  };

  /** 나간 뒤: 폴링·기한 타이머만 멈춘다(초인종 해제 포함). 화면 이동은 호출자가 한다 */
  private stopPolling(): void {
    this.started = false;
    if (this.timer) clearTimeout(this.timer);
    if (this.deadlineTimer) clearTimeout(this.deadlineTimer);
    if (this.bellTimer) clearTimeout(this.bellTimer);
    this.timer = this.deadlineTimer = this.bellTimer = null;
    this.unsubBell?.();
    this.unsubBell = null;
    this.bellTopic = null;
  }

  /** 숨기기·복귀 즉시 보고. fire-and-forget(keepalive). 화면 전환은 기다리지 않는다 */
  reportView = (view: ViewState): void => {
    if (!this.started || this.state.entry.kind !== 'seated') return;
    const known = this.state.view?.room.version ?? -1;
    void mcApi.sync(this.code, { knownVersion: known, view }, { keepalive: true }).then((r) => {
      if (this.disposed) return;
      // 시계 정지·재개로 version이 올랐을 수 있다 → 짧게 뒤에 한 번 더 sync
      if (r.ok) setTimeout(() => this.refresh(), 250);
    });
  };

  reportAlarm = (issuedAt: number, reactionMs: number): void => {
    this.pendingAlarm = { issuedAt, reactionMs: Math.max(0, Math.round(reactionMs)) };
    this.refresh();
  };

  /** 안정적인 컨트롤러 객체(메서드 참조 고정, state만 바뀜) */
  controller = (): RoomController => {
    if (this.snapshotController) return this.snapshotController;
    const self = this;
    const c: RoomController = {
      kind: 'live',
      code: this.code,
      state: this.state,
      practice: null,
      now: this.now,
      join: self.join,
      place: self.place,
      fire: self.fire,
      answer: self.answer,
      hint: self.hint,
      taunt: self.taunt,
      rematch: self.rematch,
      resign: self.resign,
      claimAbsent: self.claimAbsent,
      leave: self.leave,
      reportView: self.reportView,
      reportAlarm: self.reportAlarm,
      refresh: self.refresh,
    };
    this.snapshotController = c;
    return c;
  };
}

export { BELL_EVENT };
