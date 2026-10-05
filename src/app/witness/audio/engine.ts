/**
 * 오디오 엔진 — 첫 사용자 제스처 뒤에 지연 로딩된다(useGameAudio 의 dynamic import). React 비의존.
 *
 * 신호 흐름
 *   곡 플레이어(out) ─┐                         ┌─ 리버브(합성 임펄스 1개, 배경음악 공유) ─┐
 *   곡 플레이어(wet) ─┼→ bgmMix ← tensionBus ───┘                                          │
 *                     └→ bgmMix → 하이패스 32Hz → 로우셸프(110Hz −4dB) → bgmLevel(설정) → bgmGate(덕킹·정적) ─┐  │
 *   효과음 ───────────────────────→ sfxLevel(설정) ───────────────────┼→ master(음소거) → 컴프레서 → 소프트 리미터(천장 −1 dBFS) → 출력
 *
 *  - BaseAudioContext 기반: 같은 코드가 OfflineAudioContext 로도 렌더된다(renderTrack · renderSfx · renderScenario).
 *  - 룩어헤드 스케줄러: 25ms 타이머가 120ms 앞까지 음을 예약한다. 늦은 음은 버리고(탭 백그라운드에서 폭주 금지), 숨겨지면 타이머를 멈춘다.
 *  - 잠자기: 음소거 · (배경음악 끔 + 효과음 끔) · 숨김이면 컨텍스트를 suspend 하고 타이머도 켜지 않는다. 배경음악만 끔이면 컨텍스트는 깨어 있되(효과음)
 *    곡 예약 · 타이머는 멈춘다. 잠든 사이 바뀐 곡은 플레이어만 바꿔 두고 깨어날 때 예약한다.
 *  - 곡 전환: 0.9초 크로스페이드. 같은 곡이면 끊지 않는다. 돌파 스팅어 뒤 정적 동안 요청된 곡은 정적이 끝날 때 첫 박부터 들어온다.
 *  - 곡 위치 기억: 타이틀 · 수사 · 증언 곡은 나갈 때의 마디를 기억했다가, 다시 들어오면 다음 8마디 구간부터 잇는다(허브에 돌아올 때마다 같은 첫 구간이 나오지 않게).
 *  - 소리는 항상 비동기이고, 실패해도 예외를 밖으로 내지 않는다(게임 진행은 소리를 기다리지 않는다).
 */
import { TRACK_IDS, levelGain, type Cue, type SfxId, type TrackId, type VerdictCue } from './cues';
import { TRACKS, barSeconds, mix, tensionBar, type TrackDef } from './score';
import { SFX, SFX_GAIN, isTypeSfx } from './sfx';
import { VoicePool, makeImpulse, makeNoise, playEv, rng, type Ev, type Out } from './synth';

export const SCHED_MS = 25;
export const LOOKAHEAD = 0.12;
export const XFADE = 0.9;
/** 긴장 레이어 버스 크기 — 곡 trim 을 거치지 않는 버스라 따로 맞춘다(폰 대역에서 같은 곡보다 약 +2.5 dB) */
export const TENSION_GAIN = 1.5;
/** 동시 소스 노드(오실레이터 · 노이즈) 상한 — 우선순위 2 는 ×1.2, 효과음은 ×1.6 까지(synth.ts VoicePool) */
export const MAX_SOURCES = 40;
/** 저사양(코어 4개 이하) 상한 */
export const MAX_SOURCES_LITE = 28;
/** 나갔다 들어오면 이어 가는 곡(나머지는 매번 첫 구간부터 — 추격은 돌파 뒤 힘 있게, 지목·엔딩은 처음부터) */
const RESUME_TRACKS: readonly TrackId[] = ['title', 'investigate', 'testimony'];
/** 리미터 천장 −1 dBFS */
export const CEILING = Math.pow(10, -1 / 20);
/** 배경음악 · 효과음 버스 보정(설정 게인에 곱한다) — 컴프레서 자동 메이크업 게인 차이(약 −1.5 dB)를 렌더 측정으로 메운 값 */
export const BGM_TRIM = 1.195;
export const SFX_TRIM = 1.195;

export interface EngineOptions {
  bgm: number;
  sfx: number;
  muted: boolean;
  /** 생성형 변주 씨앗(없으면 매 접속 다르게) */
  seed?: number;
  /** 저사양 모드(없으면 실시간 컨텍스트에서 navigator.hardwareConcurrency ≤ 4 로 판단) */
  lite?: boolean;
}

function detectLite(): boolean {
  try {
    const n = typeof navigator !== 'undefined' ? navigator.hardwareConcurrency : undefined;
    return typeof n === 'number' && n > 0 && n <= 4;
  } catch {
    return false;
  }
}

function softClipCurve(): Float32Array<ArrayBuffer> {
  const n = 2048;
  const c = new Float32Array(new ArrayBuffer(n * 4));
  const knee = 0.7;
  const room = CEILING - knee;
  for (let i = 0; i < n; i++) {
    const x = (i / (n - 1)) * 2 - 1;
    const a = Math.abs(x);
    const y = a <= knee ? a : knee + room * Math.tanh((a - knee) / room);
    c[i] = Math.sign(x) * Math.min(y, CEILING * 0.999);
  }
  return c;
}

class Player {
  readonly out: GainNode;
  readonly wet: GainNode;
  private barT: number;
  private bar = 0;
  private evs: Ev[] | null = null;
  private ei = 0;
  readonly spb: number;
  readonly barLen: number;
  stopAt = Infinity;
  /** 이 시각이 지나면 노드를 끊는다 */
  disposeAt = Infinity;

  constructor(
    private eng: AudioEngine,
    readonly def: TrackDef,
    t0: number,
    fadeIn: number,
    startBar = 0,
  ) {
    const ctx = eng.ctx;
    this.out = ctx.createGain();
    this.wet = ctx.createGain();
    this.out.connect(eng.bgmMix);
    this.wet.connect(eng.reverb);
    this.spb = 60 / def.bpm;
    this.barLen = barSeconds(def);
    this.barT = t0;
    this.bar = startBar;
    const g = this.out.gain;
    if (fadeIn > 0) {
      g.setValueAtTime(0, t0);
      g.linearRampToValueAtTime(def.trim, t0 + fadeIn);
    } else g.setValueAtTime(def.trim, t0);
    this.wet.gain.value = 1;
  }

  /** 지금 예약 중인 마디 번호 */
  get barIndex(): number {
    return this.bar;
  }

  private make(i: number): Ev[] {
    const evs = this.def.bar(i, this.eng.seed);
    if (this.def.tensionOk && this.eng.tension) return [...evs, ...tensionBar(i)].sort((a, b) => a.b - b.b);
    return evs;
  }

  /** until 앞까지 예약. now 보다 지난 음은 버린다 */
  pump(until: number, now: number): void {
    // 한참 뒤처졌으면(백그라운드 등) 마디 단위로 건너뛴다
    if (this.barT + this.barLen < now - 0.5) {
      const skip = Math.floor((now - this.barT) / this.barLen);
      this.bar += skip;
      this.barT += skip * this.barLen;
      this.evs = null;
      this.ei = 0;
    }
    for (let guard = 0; guard < 2048; guard++) {
      if (!this.evs) {
        this.evs = this.make(this.bar);
        this.ei = 0;
      }
      if (this.ei >= this.evs.length) {
        const next = this.barT + this.barLen;
        if (next >= until || next >= this.stopAt) return;
        this.bar += 1;
        this.barT = next;
        this.evs = null;
        continue;
      }
      const e = this.evs[this.ei];
      const t = this.barT + e.b * this.spb;
      if (t >= until || t >= this.stopAt) return;
      this.ei += 1;
      if (t < now - 0.02) continue;
      this.eng.voice(e, t, this);
    }
  }

  fadeOut(now: number, len: number): void {
    const g = this.out.gain;
    g.cancelScheduledValues(now);
    g.setValueAtTime(g.value, now);
    g.linearRampToValueAtTime(0, now + len);
    this.stopAt = now + len;
    // 마지막 음의 꼬리(패드 릴리스 등)까지 기다렸다가 끊는다
    this.disposeAt = now + len + 3;
  }

  dispose(): void {
    try {
      this.out.disconnect();
      this.wet.disconnect();
    } catch {
      /* 이미 끊김 */
    }
  }
}

export class AudioEngine {
  readonly ctx: BaseAudioContext;
  readonly realtime: boolean;
  readonly seed: number;
  readonly pool: VoicePool;
  readonly noise: AudioBuffer;
  readonly master: GainNode;
  readonly bgmMix: GainNode;
  readonly bgmLevel: GainNode;
  private readonly bgmHp: BiquadFilterNode;
  private readonly bgmShelf: BiquadFilterNode;
  readonly bgmGate: GainNode;
  readonly tensionBus: GainNode;
  readonly sfxLevel: GainNode;
  readonly reverb: ConvolverNode;
  private readonly comp: DynamicsCompressorNode;
  private readonly clip: WaveShaperNode;
  private cur: Player | null = null;
  private old: Player[] = [];
  private timer: ReturnType<typeof setInterval> | null = null;
  private silenceUntil = 0;
  private lastType = -1;
  private typeK = 0;
  private sfxK = 0;
  /** 효과음별 고정 보정 게인(최대 22개, 한 번 만들고 재사용) */
  private sfxTrim = new Map<SfxId, GainNode>();
  private levels = { bgm: 2, sfx: 2, muted: false };
  /** 곡별로 나갈 때의 다음 구간 첫 마디(RESUME_TRACKS) */
  private resumeBar = new Map<TrackId, number>();
  private hidden = false;
  private released = false;
  /** 오프라인 렌더 시계(실시간이면 null → ctx.currentTime) */
  clock: number | null = null;
  tension = false;
  /** 삼킨 예외 수(검증용) */
  errors = 0;

  constructor(ctx: BaseAudioContext, opts: EngineOptions) {
    this.ctx = ctx;
    this.realtime = typeof (ctx as AudioContext).close === 'function' && typeof (ctx as OfflineAudioContext).startRendering !== 'function';
    this.seed = opts.seed ?? Math.floor(Math.random() * 1e9);
    const lite = opts.lite ?? (this.realtime && detectLite());
    this.pool = new VoicePool(lite ? MAX_SOURCES_LITE : MAX_SOURCES, lite);
    this.noise = makeNoise(ctx);
    this.master = ctx.createGain();
    this.comp = ctx.createDynamicsCompressor();
    // 피크만 누르는 리미터형 설정(평소 믹스는 건드리지 않는다) + 뒤의 소프트 클리퍼가 천장 −1 dBFS 를 보장
    this.comp.threshold.value = -4;
    this.comp.knee.value = 4;
    this.comp.ratio.value = 12;
    this.comp.attack.value = 0.003;
    this.comp.release.value = 0.2;
    this.clip = ctx.createWaveShaper();
    this.clip.curve = softClipCurve();
    this.master.connect(this.comp);
    this.comp.connect(this.clip);
    this.clip.connect(ctx.destination);

    this.bgmMix = ctx.createGain();
    this.bgmLevel = ctx.createGain();
    this.bgmGate = ctx.createGain();
    this.tensionBus = ctx.createGain();
    this.tensionBus.gain.value = 0;
    this.reverb = ctx.createConvolver();
    this.reverb.buffer = makeImpulse(ctx);
    this.tensionBus.connect(this.bgmMix);
    this.reverb.connect(this.bgmMix);
    // 32Hz 아래(휴대폰 스피커가 못 내는 초저역)는 잘라 헤드룸을 아끼고, 110Hz 아래를 4dB 눌러 크기를 '들리는 대역'(300Hz 위)에서 맞춘다
    this.bgmHp = ctx.createBiquadFilter();
    this.bgmHp.type = 'highpass';
    this.bgmHp.frequency.value = 32;
    this.bgmShelf = ctx.createBiquadFilter();
    this.bgmShelf.type = 'lowshelf';
    this.bgmShelf.frequency.value = 110;
    this.bgmShelf.gain.value = -4;
    this.bgmMix.connect(this.bgmHp);
    this.bgmHp.connect(this.bgmShelf);
    this.bgmShelf.connect(this.bgmLevel);
    this.bgmLevel.connect(this.bgmGate);
    this.bgmGate.connect(this.master);
    this.sfxLevel = ctx.createGain();
    this.sfxLevel.connect(this.master);
    this.setLevels(opts.bgm, opts.sfx, opts.muted, true);
  }

  now(): number {
    return this.clock ?? this.ctx.currentTime;
  }

  /** 곡 보이스 한 음 */
  voice(e: Ev, t: number, p: Player): void {
    const o: Out = { ctx: this.ctx, dry: e.ch === 't' ? this.tensionBus : p.out, wet: e.ch === 't' ? undefined : p.wet, noise: this.noise, pool: this.pool };
    try {
      playEv(o, e, t, p.spb);
    } catch {
      // 보이스 하나 실패는 무시(검증 하네스가 개수를 본다)
      this.errors += 1;
    }
  }

  // ───────── 설정 ─────────

  /** 아무 소리도 낼 일이 없다(음소거 · 배경음악 끔 + 효과음 끔) → 컨텍스트를 재운다 */
  get dormant(): boolean {
    return this.levels.muted || (levelGain(this.levels.bgm) <= 0 && levelGain(this.levels.sfx) <= 0);
  }

  /** 배경음악 끔 → 곡을 예약하지 않는다(타이머도 멈춤) */
  private get bgmOff(): boolean {
    return levelGain(this.levels.bgm) <= 0;
  }

  setLevels(bgm: number, sfx: number, muted: boolean, immediate = false): void {
    const prevDormant = this.dormant;
    const prevBgmOff = this.bgmOff;
    this.levels = { bgm, sfx, muted };
    const t = this.now();
    const ramp = (p: AudioParam, v: number, len: number) => {
      if (immediate) {
        p.value = v;
        return;
      }
      p.cancelScheduledValues(t);
      p.setValueAtTime(p.value, t);
      p.linearRampToValueAtTime(v, t + len);
    };
    ramp(this.bgmLevel.gain, levelGain(bgm) * BGM_TRIM, 0.12);
    ramp(this.sfxLevel.gain, levelGain(sfx) * SFX_TRIM, 0.05);
    // 음소거는 50ms 램프로 즉시
    ramp(this.master.gain, muted ? 0 : 1, 0.05);
    if (!this.realtime) return;
    if (immediate) {
      // 생성 시점에 이미 잠잘 상태면(첫 제스처가 '소리 끄기' 탭이었던 경우 등) 바로 재운다
      if (this.dormant) this.suspendCtx();
      return;
    }
    if (this.dormant && !prevDormant) setTimeout(() => this.dormant && this.suspendCtx(), 90);
    else if (!this.dormant && prevDormant) this.wake();
    if (this.bgmOff && !prevBgmOff) {
      // 배경음악만 껐다: 곡 예약 · 타이머를 멈추고, 꺼진 곡의 지난 플레이어는 바로 정리
      this.stopTimer();
      for (const p of this.old) p.dispose();
      this.old = [];
    } else if (!this.bgmOff && prevBgmOff) this.wake();
  }

  /** 곡 · 긴장 레이어 */
  setCue(cue: Cue, opts: { fadeIn?: number } = {}): void {
    const t = this.now();
    if (cue.tension !== this.tension) {
      this.tension = cue.tension;
      const g = this.tensionBus.gain;
      g.cancelScheduledValues(t);
      g.setValueAtTime(g.value, t);
      g.linearRampToValueAtTime(cue.tension ? TENSION_GAIN : 0, t + 1.5);
    }
    if ((this.cur?.def.id ?? null) === cue.track) return;
    const prev = this.cur;
    const silent = this.silenceUntil > t + 0.05;
    if (prev) {
      prev.fadeOut(t, silent ? 0.08 : XFADE);
      // 다음에 이 곡으로 돌아오면 다음 8마디 구간부터(구간 첫 박이라 어색하지 않다)
      if (RESUME_TRACKS.includes(prev.def.id)) this.resumeBar.set(prev.def.id, Math.ceil((prev.barIndex + 1) / 8) * 8);
      if (this.realtime && this.bgmOff) prev.dispose();
      else this.old.push(prev);
    }
    this.cur = null;
    if (!cue.track || !TRACK_IDS.includes(cue.track)) return;
    const def = TRACKS[cue.track];
    // 정적 중이면 정적이 끝나는 순간 첫 박으로 재진입(짧게), 아니면 크로스페이드
    const t0 = silent ? this.silenceUntil : t + 0.03;
    const fadeIn = opts.fadeIn ?? (silent ? 0.04 : prev ? XFADE : 1.2);
    this.cur = new Player(this, def, t0, fadeIn, this.resumeBar.get(def.id) ?? 0);
    // 잠들어 있거나 배경음악이 꺼져 있으면 플레이어만 바꿔 두고, 예약은 깨어날 때(wake → 타이머)
    if (this.realtime && (this.dormant || this.bgmOff || this.hidden)) return;
    this.pump();
    this.startTimer();
  }

  get track(): TrackId | null {
    return this.cur?.def.id ?? null;
  }

  // ───────── 효과음 ─────────

  sfx(id: SfxId, at?: number): void {
    if (this.levels.muted || this.levels.sfx <= 0 || this.released) return;
    const t = at ?? this.now() + (this.realtime ? 0.01 : 0);
    const typing = isTypeSfx(id);
    if (typing) {
      // 대사음 스로틀(35ms) — 글자 2~3자마다 오는 호출을 한 번 더 거른다
      if (t - this.lastType < 0.035) return;
      this.lastType = t;
    }
    const fn = SFX[id];
    if (!fn) return;
    let dry = this.sfxTrim.get(id);
    if (!dry) {
      dry = this.ctx.createGain();
      dry.gain.value = SFX_GAIN[id] ?? 1;
      dry.connect(this.sfxLevel);
      this.sfxTrim.set(id, dry);
    }
    try {
      fn({ ctx: this.ctx, dry, noise: this.noise, pool: this.pool, sfx: true }, t, typing ? this.typeK++ : this.sfxK++);
    } catch {
      this.errors += 1;
    }
    // 증거 제시의 '쾅'(0.22초 뒤)이 곡에 묻히지 않게 살짝 덕킹 — 정답 여부와 무관하게 늘 같다
    if (id === 'present') this.dip(t + 0.18, 0.55, 0.5);
  }

  /** BGM 을 depth 까지 짧게 내렸다가(0.06초) hold 뒤 0.5초에 걸쳐 되돌린다. 돌파 정적 중이면 건드리지 않는다 */
  private dip(t: number, depth: number, hold: number): void {
    if (this.silenceUntil >= t) return;
    const g = this.bgmGate.gain;
    g.cancelScheduledValues(t);
    g.setValueAtTime(g.value, t);
    g.linearRampToValueAtTime(depth, t + 0.06);
    g.setValueAtTime(depth, t + hold);
    g.linearRampToValueAtTime(1, t + hold + 0.55);
  }

  /** 판정 — BGM 덕킹/정지 + 판정음(+ 신뢰 감소음) */
  verdict(v: VerdictCue): void {
    const t = this.now();
    const g = this.bgmGate.gain;
    if (v.duck === 'cut') {
      const sil = v.silence ?? 1.2;
      g.cancelScheduledValues(t);
      g.setValueAtTime(g.value, t);
      g.linearRampToValueAtTime(0, t + 0.08);
      g.setValueAtTime(0, t + 0.08 + sil);
      g.linearRampToValueAtTime(1, t + 0.08 + sil + 0.06);
      this.silenceUntil = t + 0.08 + sil;
    } else if (v.duck === 'dip') this.dip(t, 0.35, 0.55);
    this.sfx(v.sfx, t + (this.realtime ? 0.01 : 0));
    if (v.follow) this.sfx(v.follow, t + 0.28);
  }

  // ───────── 스케줄러 ─────────

  pump(): void {
    const now = this.now();
    const until = now + LOOKAHEAD;
    // 배경음악 끔: 예약하지 않는다(다시 켜면 Player.pump 가 지난 마디를 건너뛰고 지금 위치부터 잇는다)
    if (this.realtime && this.bgmOff) return;
    try {
      this.cur?.pump(until, now);
      for (const p of this.old) p.pump(until, now);
    } catch {
      /* 무시 */
    }
    // 오프라인 렌더는 예약이 렌더보다 먼저 끝나므로(끊으면 처음부터 끊긴 그래프가 된다) 끊지 않는다
    if (this.old.length && this.realtime) {
      this.old = this.old.filter((p) => {
        if (now < p.disposeAt) return true;
        p.dispose();
        return false;
      });
    }
  }

  /** 오프라인 렌더: until 까지 시계를 옮기며 예약 */
  advance(until: number, step = 0.05): void {
    let t = this.clock ?? 0;
    while (t < until) {
      t = Math.min(until, t + step);
      this.clock = t;
      this.pump();
    }
  }

  private startTimer(): void {
    if (!this.realtime || this.timer || this.hidden || this.released || this.dormant || this.bgmOff) return;
    this.timer = setInterval(() => {
      if ((this.ctx as AudioContext).state !== 'running') return;
      this.pump();
    }, SCHED_MS);
  }

  private stopTimer(): void {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }

  // ───────── 수명주기 ─────────

  private suspendCtx(): void {
    this.stopTimer();
    const c = this.ctx as AudioContext;
    // resume 이 아직 끝나지 않은(state 가 곧 running 이 될) 컨텍스트도 재운다 — 두 요청은 순서대로 처리된다
    if (this.realtime && c.state !== 'closed') c.suspend().catch(() => undefined);
  }

  /** 다시 들릴 수 있으면 깨운다(음소거 · 소리 전부 끔 · 숨김 · 해제 상태면 그대로) */
  wake(): void {
    if (!this.realtime || this.dormant || this.hidden || this.released) return;
    const c = this.ctx as AudioContext;
    if (c.state !== 'running') c.resume().catch(() => undefined);
    this.startTimer();
  }

  /** 탭 숨김·pagehide */
  setHidden(hidden: boolean): void {
    this.hidden = hidden;
    if (hidden) this.suspendCtx();
    else this.wake();
  }

  /** 앱 화면이 사라질 때(다른 라우트로 이동 · StrictMode 언마운트): 곡을 멈추고 잠든다 */
  release(): void {
    this.setCue({ track: null, tension: false });
    this.released = true;
    this.stopTimer();
    if (this.realtime) setTimeout(() => this.released && this.suspendCtx(), 600);
  }

  /** 다시 마운트 */
  acquire(): void {
    this.released = false;
    this.wake();
  }

  get stats(): { voices: number; players: number; timer: boolean; errors: number } {
    return { voices: this.pool.active, players: (this.cur ? 1 : 0) + this.old.length, timer: !!this.timer, errors: this.errors };
  }
}

export function createEngine(ctx: BaseAudioContext, opts: EngineOptions): AudioEngine {
  return new AudioEngine(ctx, opts);
}

// ─────────────────────────────── 오프라인 렌더(검증 · 미리듣기) ───────────────────────────────

/** 곡 하나를 seconds 길이로 예약한다. 호출자가 ctx.startRendering() 한다 */
export function renderTrack(ctx: BaseAudioContext, id: TrackId, seconds: number, opts: { seed?: number; tension?: boolean; bgm?: number } = {}): AudioEngine {
  const eng = new AudioEngine(ctx, { bgm: opts.bgm ?? 2, sfx: 2, muted: false, seed: opts.seed ?? 20261005 });
  eng.clock = 0;
  eng.setCue({ track: id, tension: !!opts.tension }, { fadeIn: 0 });
  if (opts.tension) eng.tensionBus.gain.value = TENSION_GAIN;
  eng.advance(seconds);
  return eng;
}

/** 효과음 하나(0.05초 뒤 시작) */
export function renderSfx(ctx: BaseAudioContext, id: SfxId, opts: { sfx?: number } = {}): AudioEngine {
  const eng = new AudioEngine(ctx, { bgm: 2, sfx: opts.sfx ?? 2, muted: false, seed: 1 });
  eng.clock = 0;
  if (id.startsWith('type_')) {
    // 대사 한 줄처럼 0.06초 간격 8번
    for (let i = 0; i < 8; i++) eng.sfx(id, 0.05 + i * 0.06);
  } else eng.sfx(id, 0.05);
  return eng;
}

/** 장면: 증언 곡 → 4초에 돌파(정지 · 스팅어 · 정적) → 추격 곡 재진입 → 9초에 오답 덕킹 */
export function renderScenario(ctx: BaseAudioContext, seconds = 14): AudioEngine {
  const eng = new AudioEngine(ctx, { bgm: 2, sfx: 2, muted: false, seed: 7 });
  eng.clock = 0;
  eng.setCue({ track: 'testimony', tension: false }, { fadeIn: 0 });
  eng.advance(4);
  eng.verdict({ sfx: 'break', duck: 'cut', silence: 1.2 });
  eng.setCue({ track: 'pursuit', tension: false });
  eng.advance(9);
  eng.verdict({ sfx: 'wrong', duck: 'dip', follow: 'trustDown' });
  eng.advance(seconds);
  return eng;
}

export { TRACK_IDS, TRACKS, rng, mix };
