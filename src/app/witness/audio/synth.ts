/**
 * 악기 보이스(Web Audio 노드 묶음) — 음원 파일 없이 코드로만 합성한다. BaseAudioContext 기반이라 OfflineAudioContext 로도 같은 소리가 난다.
 *
 * 규칙
 *  - 모든 소리는 0.0001 에서 시작해 0.0001 로 끝난다(지수 램프) — 시작·끝 클릭 없음.
 *  - 소스가 끝나면(onended) 그 보이스의 노드를 전부 disconnect 한다(노드 누수 없음).
 *  - 동시 발음은 VoicePool 이 '소스 노드 수'(오실레이터·노이즈 버퍼)로 센다. 우선순위 0~1(장식·보통)은 상한(max)을 넘으면 버리고,
 *    2(곡의 바탕: 패드·드론·비·심장박동)는 max×1.2, 3(효과음)은 max×1.6 이 하드 상한이다. 저사양(lite)이면 상한을 낮추고 패드 디튠·햇 팬을 줄인다.
 *  - 노이즈는 엔진이 만든 버퍼 1개(결정론 PRNG)를 공유한다.
 * 팔레트: 따뜻한 FM 일렉피아노 · 아날로그 패드 · 서브 베이스 · 부드러운 신스 드럼 · 또박이 블립/벨 · 빗소리 · 오르골 · 드론.
 */

export type VoiceId = 'ep' | 'pad' | 'bass' | 'kick' | 'snare' | 'hat' | 'ohat' | 'blip' | 'bell' | 'box' | 'lead' | 'stab' | 'drone' | 'heart' | 'rain';

/** 곡 데이터 한 음(마디 안 박 위치 기준). 데이터만 담는다 — 같은 마디인지 비교·해시할 수 있다 */
export interface Ev {
  /** 마디 시작부터 몇 박 뒤 */
  b: number;
  v: VoiceId;
  /** MIDI 음(화음이면 배열) */
  n?: number | readonly number[];
  /** 길이(박) */
  d?: number;
  /** 세기 0..1 */
  g?: number;
  /** 우선순위(0 장식 · 1 보통 · 2 필수) */
  p?: 0 | 1 | 2;
  /** 't' = 긴장 레이어 버스로 */
  ch?: 't';
  /** 좌우 -1..1 */
  pan?: number;
  /** 보이스별 추가 값(필터 컷오프·씨앗 등) */
  x?: number;
}

/** 보이스가 소리를 내보낼 곳 */
export interface Out {
  ctx: BaseAudioContext;
  dry: AudioNode;
  /** 리버브 보내기(배경음악만) */
  wet?: AudioNode;
  noise: AudioBuffer;
  pool: VoicePool;
  /** 효과음 버스 — 풀에서 우선순위 3(곡보다 먼저)으로 센다 */
  sfx?: boolean;
}

/** 우선순위 2(곡의 바탕) · 3(효과음)의 하드 상한 배수 */
const HARD_CAP = [1, 1, 1.2, 1.6];

/** 동시 발음 수 제한 — (끝나는 시각, 소스 수)만 들고 있다가, 지난 것은 버린다 */
export class VoicePool {
  private ends: [end: number, w: number][] = [];
  private used = 0;
  constructor(
    public max = 40,
    /** 저사양 모드(코어 4개 이하) — 패드 디튠 1개 · 하이햇 팬 없음 */
    public lite = false,
  ) {}
  /** w = 이 보이스가 만드는 소스 노드 수 */
  take(t: number, len: number, prio: number, w = 1): boolean {
    if (this.ends.length) {
      this.ends = this.ends.filter((e) => e[0] > t);
      this.used = this.ends.reduce((a, e) => a + e[1], 0);
    }
    const cap = Math.round(this.max * (HARD_CAP[Math.max(0, Math.min(3, prio))] ?? 1));
    if (this.used + w > cap) return false;
    this.ends.push([t + len, w]);
    this.used += w;
    return true;
  }
  /** 지금 울리고 있는 소스 노드 수 */
  get active(): number {
    return this.used;
  }
}

/** 효과음이면 우선순위 3 */
const take = (o: Out, t: number, len: number, prio: number, w = 1): boolean => o.pool.take(t, len, o.sfx ? 3 : prio, w);

export const mtof = (m: number): number => 440 * Math.pow(2, (m - 69) / 12);

const EPS = 0.0001;

/** 결정론 PRNG(mulberry32) */
export function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** 흰 노이즈 2초(결정론) — 엔진당 1개 */
export function makeNoise(ctx: BaseAudioContext, seed = 7): AudioBuffer {
  const len = Math.floor(ctx.sampleRate * 2);
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const d = buf.getChannelData(0);
  const r = rng(seed);
  for (let i = 0; i < len; i++) d[i] = r() * 2 - 1;
  return buf;
}

/** 짧은 합성 임펄스(스테레오, 지수 감쇠 노이즈) — 리버브 1개를 모든 곡이 공유한다 */
export function makeImpulse(ctx: BaseAudioContext, sec = 1.6, decay = 3.2): AudioBuffer {
  const len = Math.floor(ctx.sampleRate * sec);
  const buf = ctx.createBuffer(2, len, ctx.sampleRate);
  for (let c = 0; c < 2; c++) {
    const d = buf.getChannelData(c);
    const r = rng(101 + c * 17);
    for (let i = 0; i < len; i++) {
      const k = i / len;
      // 앞 8ms 는 비워 둔다(초기 반사 지연) · 끝은 0 으로
      d[i] = i < ctx.sampleRate * 0.008 ? 0 : (r() * 2 - 1) * Math.pow(1 - k, decay);
    }
  }
  return buf;
}

// ─────────────────────────────── 노드 도우미 ───────────────────────────────

function osc(ctx: BaseAudioContext, type: OscillatorType, f: number, detune = 0): OscillatorNode {
  const o = ctx.createOscillator();
  o.type = type;
  o.frequency.value = f;
  if (detune) o.detune.value = detune;
  return o;
}

function gainNode(ctx: BaseAudioContext, v = 0): GainNode {
  const g = ctx.createGain();
  g.gain.value = v;
  return g;
}

function filter(ctx: BaseAudioContext, type: BiquadFilterType, f: number, q = 0.707): BiquadFilterNode {
  const b = ctx.createBiquadFilter();
  b.type = type;
  b.frequency.value = f;
  b.Q.value = q;
  return b;
}

/** 출력단(선택적 팬 + 리버브 보내기). 만든 노드를 nodes 에 더한다 */
function tail(o: Out, src: AudioNode, nodes: AudioNode[], pan = 0, send = 0): void {
  let last: AudioNode = src;
  if (pan && typeof o.ctx.createStereoPanner === 'function') {
    const p = o.ctx.createStereoPanner();
    p.pan.value = Math.max(-1, Math.min(1, pan));
    src.connect(p);
    nodes.push(p);
    last = p;
  }
  last.connect(o.dry);
  if (send > 0 && o.wet) {
    const s = gainNode(o.ctx, send);
    last.connect(s);
    s.connect(o.wet);
    nodes.push(s);
  }
}

/** 마지막으로 멈추는 소스가 끝나면 보이스 노드를 모두 끊는다 */
function cleanup(last: AudioScheduledSourceNode, nodes: AudioNode[]): void {
  last.onended = () => {
    for (const n of nodes) {
      try {
        n.disconnect();
      } catch {
        /* 이미 끊김 */
      }
    }
  };
}

/** 타악기형 엔벨로프: 어택 a 뒤 decay 동안 지수 감쇠 */
function perc(g: AudioParam, t: number, peak: number, a: number, decay: number): number {
  g.setValueAtTime(EPS, t);
  g.exponentialRampToValueAtTime(Math.max(EPS * 2, peak), t + a);
  g.exponentialRampToValueAtTime(EPS, t + a + decay);
  return t + a + decay;
}

/** 지속음 엔벨로프: 어택 → 유지 → 릴리스 */
function sustain(g: AudioParam, t: number, peak: number, a: number, len: number, rel: number): number {
  const hold = Math.max(t + a + 0.01, t + len);
  g.setValueAtTime(EPS, t);
  g.exponentialRampToValueAtTime(Math.max(EPS * 2, peak), t + a);
  g.setValueAtTime(Math.max(EPS * 2, peak), hold);
  g.exponentialRampToValueAtTime(EPS, hold + rel);
  return hold + rel;
}

function noiseSrc(o: Out, t: number, seed = 0): AudioBufferSourceNode {
  const s = o.ctx.createBufferSource();
  s.buffer = o.noise;
  s.loop = true;
  // 같은 구간이 겹쳐 울리지 않게 시작 위치를 흩는다(결정론)
  const off = ((seed * 0.6180339 + t * 0.37) % 1) * (o.noise.duration - 0.05);
  s.start(t, Math.max(0, off));
  return s;
}

const notesOf = (n: Ev['n']): number[] => (n === undefined ? [] : typeof n === 'number' ? [n] : [...n]);

// ─────────────────────────────── 보이스 ───────────────────────────────

/** 따뜻한 FM 일렉피아노 — 변조 지수가 빠르게 줄어 '팅' 하는 어택 뒤 둥근 소리(필터 없이 FM 지수만으로 밝기를 줄인다 — 저사양 기기 부담) */
export function ep(o: Out, t: number, midi: number, durSec: number, vel = 0.6, pan = 0, send = 0.32): void {
  const end = t + Math.max(0.15, durSec) + 0.55;
  if (!take(o, t, end - t, 1, 2)) return;
  const { ctx } = o;
  const f = mtof(midi);
  const car = osc(ctx, 'sine', f);
  const mod = osc(ctx, 'sine', f);
  const modG = gainNode(ctx);
  const tine = osc(ctx, 'sine', f * 4.01);
  const tineG = gainNode(ctx);
  const amp = gainNode(ctx);
  // 변조 지수 엔벨로프(높은 음일수록 덜)
  const idx = f * (midi > 84 ? 1.1 : 1.8) * (0.6 + vel * 0.5);
  modG.gain.setValueAtTime(idx, t);
  modG.gain.exponentialRampToValueAtTime(idx * 0.12, t + 0.45);
  modG.gain.exponentialRampToValueAtTime(Math.max(1, idx * 0.04), end);
  mod.connect(modG);
  modG.connect(car.frequency);
  perc(tineG.gain, t, 0.12 * vel, 0.002, 0.12);
  tine.connect(tineG);
  tineG.connect(amp);
  car.connect(amp);
  const peak = 0.26 * vel;
  amp.gain.setValueAtTime(EPS, t);
  amp.gain.exponentialRampToValueAtTime(peak, t + 0.006);
  amp.gain.exponentialRampToValueAtTime(peak * 0.32, t + Math.min(0.7, (end - t) * 0.5));
  amp.gain.exponentialRampToValueAtTime(EPS, end);
  const nodes: AudioNode[] = [car, mod, modG, tine, tineG, amp];
  tail(o, amp, nodes, pan, send);
  for (const s of [car, mod, tine]) s.start(t);
  tine.stop(t + 0.2);
  mod.stop(end + 0.02);
  car.stop(end + 0.02);
  cleanup(car, nodes);
}

/** 아날로그 패드 — 화음마다 톱니 2개(디튠) → 로우패스(천천히 열림) */
export function pad(o: Out, t: number, notes: number[], durSec: number, vel = 0.35, cut = 1100, send = 0.45): void {
  const rel = 1.2;
  const end = t + durSec + rel;
  // 저사양이면 음마다 톱니 1개(디튠 없음) — 소스 수 절반
  const dets = o.pool.lite ? [0] : [-9, 8];
  if (!take(o, t, end - t, 2, notes.length * dets.length)) return;
  const { ctx } = o;
  const lp = filter(ctx, 'lowpass', cut * 0.6, 0.6);
  lp.frequency.setValueAtTime(cut * 0.55, t);
  lp.frequency.linearRampToValueAtTime(cut, t + durSec * 0.6);
  lp.frequency.linearRampToValueAtTime(cut * 0.7, end);
  const amp = gainNode(ctx);
  sustain(amp.gain, t, ((0.075 * vel) / Math.sqrt(Math.max(1, notes.length / 2))) * (dets.length === 1 ? 1.41 : 1), Math.min(0.9, durSec * 0.35), durSec, rel);
  const nodes: AudioNode[] = [lp, amp];
  const srcs: OscillatorNode[] = [];
  notes.forEach((m, i) => {
    for (const det of dets) {
      const s = osc(ctx, 'sawtooth', mtof(m), det + i * 1.5);
      s.connect(lp);
      srcs.push(s);
      nodes.push(s);
    }
  });
  lp.connect(amp);
  tail(o, amp, nodes, 0, send);
  for (const s of srcs) {
    s.start(t);
    s.stop(end + 0.02);
  }
  cleanup(srcs[srcs.length - 1], nodes);
}

/** 서브 베이스 — 사인 + 옥타브 위 삼각파(3·4배음까지 남겨 휴대폰 스피커에서도 음높이가 들리게) */
export function bass(o: Out, t: number, midi: number, durSec: number, vel = 0.6): void {
  const rel = 0.09;
  const end = t + durSec + rel;
  if (!take(o, t, end - t, 1, 2)) return;
  const { ctx } = o;
  const f = mtof(midi);
  const a = osc(ctx, 'sine', f);
  const h = osc(ctx, 'triangle', f * 2);
  const hg = gainNode(ctx, 0.8);
  const lp = filter(ctx, 'lowpass', 900);
  const amp = gainNode(ctx);
  const peak = 0.13 * vel;
  amp.gain.setValueAtTime(EPS, t);
  amp.gain.exponentialRampToValueAtTime(peak, t + 0.012);
  amp.gain.exponentialRampToValueAtTime(peak * 0.7, t + Math.min(durSec, 0.25));
  amp.gain.setValueAtTime(peak * 0.7, t + Math.max(durSec, 0.03));
  amp.gain.exponentialRampToValueAtTime(EPS, end);
  a.connect(amp);
  h.connect(hg);
  hg.connect(amp);
  amp.connect(lp);
  const nodes: AudioNode[] = [a, h, hg, lp, amp];
  tail(o, lp, nodes);
  a.start(t);
  h.start(t);
  a.stop(end + 0.02);
  h.stop(end + 0.02);
  cleanup(a, nodes);
}

/** 부드러운 킥 — 사인 피치 스윕 + 짧은 밴드패스 클릭(3.5kHz — 저음을 못 내는 휴대폰 스피커에서도 박이 들리게) */
export function kick(o: Out, t: number, vel = 0.7, f0 = 110, f1 = 44, decay = 0.34, prio: 0 | 1 | 2 = 1, click = true): void {
  const end = t + decay + 0.01;
  if (!take(o, t, end - t, prio, click ? 2 : 1)) return;
  const { ctx } = o;
  const s = osc(ctx, 'sine', f0);
  s.frequency.setValueAtTime(f0, t);
  s.frequency.exponentialRampToValueAtTime(f1, t + 0.11);
  const amp = gainNode(ctx);
  perc(amp.gain, t, 0.3 * vel, 0.003, decay);
  s.connect(amp);
  const nodes: AudioNode[] = [s, amp];
  if (click) {
    const n = noiseSrc(o, t, 2);
    const bp = filter(ctx, 'bandpass', 3500, 0.8);
    const cg = gainNode(ctx);
    perc(cg.gain, t, 0.06 * vel, 0.001, 0.012);
    n.connect(bp);
    bp.connect(cg);
    cg.connect(o.dry);
    n.stop(t + 0.03);
    nodes.push(n, bp, cg);
  }
  tail(o, amp, nodes);
  s.start(t);
  s.stop(end + 0.02);
  cleanup(s, nodes);
}

/** 스네어(림 느낌으로 부드럽게) — 밴드패스 노이즈 + 몸통 톤 */
export function snare(o: Out, t: number, vel = 0.5, pan = 0, send = 0.18): void {
  const end = t + 0.22;
  if (!take(o, t, end - t, 1, 2)) return;
  const { ctx } = o;
  const n = noiseSrc(o, t, 3);
  const bp = filter(ctx, 'bandpass', 1900, 0.9);
  const ng = gainNode(ctx);
  perc(ng.gain, t, 0.3 * vel, 0.002, 0.17);
  const body = osc(ctx, 'triangle', 196);
  body.frequency.setValueAtTime(220, t);
  body.frequency.exponentialRampToValueAtTime(170, t + 0.06);
  const bg = gainNode(ctx);
  perc(bg.gain, t, 0.22 * vel, 0.002, 0.08);
  n.connect(bp);
  bp.connect(ng);
  body.connect(bg);
  const mix = gainNode(ctx, 1);
  ng.connect(mix);
  bg.connect(mix);
  const nodes: AudioNode[] = [n, bp, ng, body, bg, mix];
  tail(o, mix, nodes, pan, send);
  body.start(t);
  body.stop(t + 0.12);
  n.stop(end + 0.02);
  cleanup(n, nodes);
}

/** 하이햇(닫힘/열림) — 하이패스 노이즈 */
export function hat(o: Out, t: number, vel = 0.3, open = false, pan = 0.2): void {
  const decay = open ? 0.2 : 0.04;
  const end = t + decay + 0.01;
  if (!take(o, t, end - t, 0)) return;
  const { ctx } = o;
  const n = noiseSrc(o, t, 5);
  const hp = filter(ctx, 'highpass', 7200, 0.7);
  const amp = gainNode(ctx);
  perc(amp.gain, t, 0.16 * vel, 0.001, decay);
  n.connect(hp);
  hp.connect(amp);
  const nodes: AudioNode[] = [n, hp, amp];
  // 저사양이면 팬 노드를 만들지 않는다(햇은 가장 자주 울리는 보이스)
  tail(o, amp, nodes, o.pool.lite ? 0 : pan);
  n.stop(end + 0.02);
  cleanup(n, nodes);
}

/** 또박이 디지털 블립 — 사각파, 짧게 살짝 위로 휘는 피치 */
export function blip(o: Out, t: number, midi: number, durSec = 0.09, vel = 0.4, pan = 0, send = 0.25, prio: 0 | 1 | 2 = 1): void {
  const end = t + Math.max(0.03, durSec) + 0.02;
  if (!take(o, t, end - t, prio)) return;
  const { ctx } = o;
  const f = mtof(midi);
  const s = osc(ctx, 'square', f);
  s.frequency.setValueAtTime(f * 0.985, t);
  s.frequency.exponentialRampToValueAtTime(f, t + 0.015);
  const lp = filter(ctx, 'lowpass', Math.min(9000, f * 3.2));
  const amp = gainNode(ctx);
  perc(amp.gain, t, 0.07 * vel, 0.002, end - t - 0.002);
  s.connect(lp);
  lp.connect(amp);
  const nodes: AudioNode[] = [s, lp, amp];
  tail(o, amp, nodes, pan, send);
  s.start(t);
  s.stop(end + 0.02);
  cleanup(s, nodes);
}

/** 벨 — 비조화 배음(2.76·5.4·8.9) */
export function bell(o: Out, t: number, midi: number, vel = 0.5, pan = 0, send = 0.4, decay = 1.6, prio: 0 | 1 | 2 = 1): void {
  const end = t + decay + 0.02;
  const f = mtof(midi);
  if (!take(o, t, end - t, prio, f * 8.93 > 16000 ? 3 : 4)) return;
  const { ctx } = o;
  const mix = gainNode(ctx, 1);
  const nodes: AudioNode[] = [mix];
  const parts: [number, number, number][] = [
    [1, 1, decay],
    [2.76, 0.42, decay * 0.5],
    [5.4, 0.18, decay * 0.28],
    [8.93, 0.07, decay * 0.15],
  ];
  const srcs: OscillatorNode[] = [];
  for (const [r, a, d] of parts) {
    if (f * r > 16000) continue;
    const s = osc(ctx, 'sine', f * r);
    const g = gainNode(ctx);
    perc(g.gain, t, 0.09 * vel * a, 0.002, d);
    s.connect(g);
    g.connect(mix);
    nodes.push(s, g);
    s.start(t);
    s.stop(t + d + 0.03);
    srcs.push(s);
  }
  tail(o, mix, nodes, pan, send);
  cleanup(srcs[0], nodes);
}

/** 오르골 — 맑은 사인 + 짧은 금속 어택 */
export function box(o: Out, t: number, midi: number, vel = 0.5, pan = 0, send = 0.45): void {
  const decay = 1.3;
  const end = t + decay + 0.02;
  if (!take(o, t, end - t, 1, 3)) return;
  const { ctx } = o;
  const f = mtof(midi);
  const a = osc(ctx, 'sine', f, 3);
  const b = osc(ctx, 'sine', f * 3.0, -4);
  const c = osc(ctx, 'triangle', f * 5.95);
  const ga = gainNode(ctx);
  const gb = gainNode(ctx);
  const gc = gainNode(ctx);
  perc(ga.gain, t, 0.12 * vel, 0.002, decay);
  perc(gb.gain, t, 0.03 * vel, 0.001, decay * 0.35);
  perc(gc.gain, t, 0.025 * vel, 0.001, 0.05);
  const mix = gainNode(ctx, 1);
  a.connect(ga);
  b.connect(gb);
  c.connect(gc);
  ga.connect(mix);
  gb.connect(mix);
  gc.connect(mix);
  const nodes: AudioNode[] = [a, b, c, ga, gb, gc, mix];
  tail(o, mix, nodes, pan, send);
  a.start(t);
  b.start(t);
  c.start(t);
  c.stop(t + 0.08);
  b.stop(t + decay * 0.35 + 0.03);
  a.stop(end + 0.02);
  cleanup(a, nodes);
}

/** 추격 리드 — 톱니 + 사각(디튠) → 엔벨로프 로우패스 */
export function lead(o: Out, t: number, midi: number, durSec: number, vel = 0.5, pan = 0, send = 0.22): void {
  const rel = 0.12;
  const end = t + durSec + rel;
  if (!take(o, t, end - t, 1, 2)) return;
  const { ctx } = o;
  const f = mtof(midi);
  const a = osc(ctx, 'sawtooth', f, -5);
  const b = osc(ctx, 'square', f, 6);
  const bg = gainNode(ctx, 0.5);
  const lp = filter(ctx, 'lowpass', 900, 2.2);
  lp.frequency.setValueAtTime(700, t);
  lp.frequency.exponentialRampToValueAtTime(3200, t + 0.03);
  lp.frequency.exponentialRampToValueAtTime(1500, t + 0.25);
  const amp = gainNode(ctx);
  sustain(amp.gain, t, 0.06 * vel, 0.008, durSec, rel);
  a.connect(lp);
  b.connect(bg);
  bg.connect(lp);
  lp.connect(amp);
  const nodes: AudioNode[] = [a, b, bg, lp, amp];
  tail(o, amp, nodes, pan, send);
  a.start(t);
  b.start(t);
  a.stop(end + 0.02);
  b.stop(end + 0.02);
  cleanup(a, nodes);
}

/** 화음 스탭 — 톱니 화음이 짧게 터진다 */
export function stab(o: Out, t: number, notes: number[], vel = 0.5, decay = 0.24, cut = 2400, pan = 0, send = 0.3, prio: 0 | 1 | 2 = 1): void {
  const end = t + decay + 0.01;
  if (!take(o, t, end - t, prio, notes.length)) return;
  const { ctx } = o;
  const lp = filter(ctx, 'lowpass', cut, 1.2);
  lp.frequency.setValueAtTime(cut, t);
  lp.frequency.exponentialRampToValueAtTime(Math.max(200, cut * 0.3), end);
  const amp = gainNode(ctx);
  perc(amp.gain, t, (0.07 * vel) / Math.sqrt(Math.max(1, notes.length / 2)), 0.003, decay);
  const nodes: AudioNode[] = [lp, amp];
  const srcs: OscillatorNode[] = [];
  for (const m of notes) {
    const s = osc(ctx, 'sawtooth', mtof(m), 4);
    s.connect(lp);
    srcs.push(s);
    nodes.push(s);
  }
  lp.connect(amp);
  tail(o, amp, nodes, pan, send);
  for (const s of srcs) {
    s.start(t);
    s.stop(end + 0.02);
  }
  cleanup(srcs[srcs.length - 1], nodes);
}

/** 저음 드론 — 톱니 2개(맥놀이) + 사인 → 낮은 로우패스 */
export function drone(o: Out, t: number, notes: number[], durSec: number, vel = 0.5, cut = 260): void {
  const att = Math.min(1.6, durSec * 0.4);
  const rel = 1.6;
  const end = t + durSec + rel;
  if (!take(o, t, end - t, 2, notes.length * 2)) return;
  const { ctx } = o;
  const lp = filter(ctx, 'lowpass', cut, 1.1);
  const amp = gainNode(ctx);
  sustain(amp.gain, t, 0.12 * vel, att, durSec, rel);
  const nodes: AudioNode[] = [lp, amp];
  const srcs: OscillatorNode[] = [];
  for (const m of notes) {
    const f = mtof(m);
    for (const [type, det] of [
      ['sawtooth', -7],
      ['sawtooth', 6],
    ] as [OscillatorType, number][]) {
      const s = osc(ctx, type, f, det);
      s.connect(lp);
      srcs.push(s);
      nodes.push(s);
    }
  }
  lp.connect(amp);
  tail(o, amp, nodes);
  for (const s of srcs) {
    s.start(t);
    s.stop(end + 0.02);
  }
  cleanup(srcs[srcs.length - 1], nodes);
}

/** 심장박동 — 낮은 쿵(lub) · 약한 쿵(dub). 사인만으로는 휴대폰에서 안 들리므로 900Hz 노이즈 몸통을 같이 친다 */
export function heart(o: Out, t: number, vel = 0.6): void {
  kick(o, t, 0.85 * vel, 70, 38, 0.24, 2, false);
  kick(o, t + 0.22, 0.55 * vel, 64, 36, 0.22, 2, false);
  noiseHit(o, t, { f0: 900, q: 1.2, peak: 0.2 * vel, a: 0.002, decay: 0.05, seed: 22, prio: 2 });
  noiseHit(o, t + 0.22, { f0: 820, q: 1.2, peak: 0.13 * vel, a: 0.002, decay: 0.045, seed: 23, prio: 2 });
}

/**
 * 빗소리 — 루프 노이즈 → 밴드패스·로우패스, 앞뒤 0.6초 등전력 크로스페이드(다음 마디의 비와 겹쳐 이음매가 없다) + 결정론 빗방울.
 */
export function rain(o: Out, t: number, durSec: number, vel = 0.5, seed = 1): void {
  const xf = 0.6;
  const end = t + Math.max(xf + 0.01, durSec) + xf;
  if (!take(o, t, end - t, 2)) return;
  const { ctx } = o;
  const n = noiseSrc(o, t, seed);
  const bp = filter(ctx, 'bandpass', 1400, 0.35);
  const lp = filter(ctx, 'lowpass', 5200, 0.5);
  const amp = gainNode(ctx);
  const lvl = 0.11 * vel;
  const up = new Float32Array(16);
  const down = new Float32Array(16);
  for (let i = 0; i < 16; i++) {
    const k = i / 15;
    up[i] = Math.max(EPS, lvl * Math.sin((k * Math.PI) / 2));
    down[i] = Math.max(EPS, lvl * Math.cos((k * Math.PI) / 2));
  }
  // 곡선 두 개만 둔다(같은 시각에 다른 자동화 이벤트가 겹치면 setValueCurveAtTime 이 예외를 던진다). 사이 구간은 up 의 끝값을 유지
  amp.gain.setValueCurveAtTime(up, t, xf);
  amp.gain.setValueCurveAtTime(down, t + Math.max(xf + 0.01, durSec), xf);
  n.connect(bp);
  bp.connect(lp);
  lp.connect(amp);
  const nodes: AudioNode[] = [n, bp, lp, amp];
  tail(o, amp, nodes, 0, 0.15);
  n.stop(end + 0.02);
  cleanup(n, nodes);
  // 빗방울(창에 부딪히는 작은 톡)
  const r = rng(seed * 977 + Math.floor(t * 10));
  const drops = Math.floor(durSec * 2.2 * vel);
  for (let i = 0; i < drops; i++) {
    const dt = t + xf * 0.5 + r() * Math.max(0.1, durSec - 0.2);
    const df = 2500 + r() * 4500;
    const dv = 0.4 + r() * 0.6;
    const dp = r() * 1.4 - 0.7;
    // 빗방울은 장식(우선순위 0) — 붐비면 버린다
    if (!take(o, dt, 0.04, 0)) continue;
    const dn = noiseSrc(o, dt, seed + i);
    const dbp = filter(ctx, 'bandpass', df, 3);
    const dg = gainNode(ctx);
    perc(dg.gain, dt, 0.05 * vel * dv, 0.001, 0.025);
    dn.connect(dbp);
    dbp.connect(dg);
    const dnodes: AudioNode[] = [dn, dbp, dg];
    tail(o, dg, dnodes, o.pool.lite ? 0 : dp);
    dn.stop(dt + 0.04);
    cleanup(dn, dnodes);
  }
}

/** 역재생 심벌 — 노이즈가 점점 커지다가 끝에서 짧게 닫힌다 */
export function revCymbal(o: Out, t: number, durSec: number, vel = 0.6): void {
  const end = t + durSec + 0.012;
  if (!take(o, t, end - t, 2)) return;
  const { ctx } = o;
  const n = noiseSrc(o, t, 9);
  const hp = filter(ctx, 'highpass', 3800, 0.6);
  hp.frequency.setValueAtTime(6000, t);
  hp.frequency.exponentialRampToValueAtTime(2600, t + durSec);
  const amp = gainNode(ctx);
  amp.gain.setValueAtTime(EPS, t);
  amp.gain.exponentialRampToValueAtTime(0.32 * vel, t + durSec);
  amp.gain.linearRampToValueAtTime(0, end);
  n.connect(hp);
  hp.connect(amp);
  const nodes: AudioNode[] = [n, hp, amp];
  tail(o, amp, nodes, 0, 0.35);
  n.stop(end + 0.02);
  cleanup(n, nodes);
}

/** 필터 노이즈 한 번(휙·종이·쾅의 노이즈 부분) */
export function noiseHit(o: Out, t: number, opts: { type?: BiquadFilterType; f0: number; f1?: number; q?: number; peak: number; a?: number; decay: number; pan?: number; send?: number; seed?: number; prio?: 0 | 1 | 2 }): void {
  const a = opts.a ?? 0.003;
  const end = t + a + opts.decay + 0.01;
  if (!take(o, t, end - t, opts.prio ?? 2)) return;
  const { ctx } = o;
  const n = noiseSrc(o, t, opts.seed ?? 11);
  const f = filter(ctx, opts.type ?? 'bandpass', opts.f0, opts.q ?? 1);
  if (opts.f1) {
    f.frequency.setValueAtTime(opts.f0, t);
    f.frequency.exponentialRampToValueAtTime(opts.f1, t + a + opts.decay);
  }
  const amp = gainNode(ctx);
  perc(amp.gain, t, opts.peak, a, opts.decay);
  n.connect(f);
  f.connect(amp);
  const nodes: AudioNode[] = [n, f, amp];
  tail(o, amp, nodes, opts.pan ?? 0, opts.send ?? 0);
  n.stop(end + 0.02);
  cleanup(n, nodes);
}

/** 단순 톤 한 번(효과음 부품) — 피치 미끄럼 선택 */
export function tone(o: Out, t: number, opts: { type?: OscillatorType; f0: number; f1?: number; glide?: number; peak: number; a?: number; decay: number; cut?: number; pan?: number; send?: number }): void {
  const a = opts.a ?? 0.003;
  const end = t + a + opts.decay + 0.01;
  if (!take(o, t, end - t, 2)) return;
  const { ctx } = o;
  const s = osc(ctx, opts.type ?? 'sine', opts.f0);
  if (opts.f1) {
    s.frequency.setValueAtTime(opts.f0, t);
    s.frequency.exponentialRampToValueAtTime(opts.f1, t + (opts.glide ?? opts.decay));
  }
  const amp = gainNode(ctx);
  perc(amp.gain, t, opts.peak, a, opts.decay);
  const nodes: AudioNode[] = [s, amp];
  let last: AudioNode = s;
  if (opts.cut) {
    const lp = filter(ctx, 'lowpass', opts.cut);
    s.connect(lp);
    nodes.push(lp);
    last = lp;
  }
  last.connect(amp);
  tail(o, amp, nodes, opts.pan ?? 0, opts.send ?? 0);
  s.start(t);
  s.stop(end + 0.02);
  cleanup(s, nodes);
}

/** 곡 데이터 한 음 → 보이스 호출 */
export function playEv(o: Out, e: Ev, t: number, spb: number): void {
  const g = e.g ?? 0.6;
  const dur = (e.d ?? 1) * spb;
  const ns = notesOf(e.n);
  switch (e.v) {
    case 'ep':
      for (const m of ns) ep(o, t, m, dur, g, e.pan ?? 0);
      return;
    case 'pad':
      pad(o, t, ns, dur, g, e.x ?? 1100);
      return;
    case 'bass':
      if (ns[0] !== undefined) bass(o, t, ns[0], dur, g);
      return;
    case 'kick':
      kick(o, t, g, 110, 44, 0.34, e.p ?? 1);
      return;
    case 'snare':
      snare(o, t, g, e.pan ?? 0);
      return;
    case 'hat':
      hat(o, t, g, false, e.pan ?? 0.2);
      return;
    case 'ohat':
      hat(o, t, g, true, e.pan ?? 0.2);
      return;
    case 'blip':
      for (const m of ns) blip(o, t, m, Math.min(0.25, dur), g, e.pan ?? 0, 0.3, e.p ?? 1);
      return;
    case 'bell':
      for (const m of ns) bell(o, t, m, g, e.pan ?? 0, 0.4, e.x ?? 1.6, e.p ?? 1);
      return;
    case 'box':
      for (const m of ns) box(o, t, m, g, e.pan ?? 0);
      return;
    case 'lead':
      if (ns[0] !== undefined) lead(o, t, ns[0], dur, g, e.pan ?? 0);
      return;
    case 'stab':
      stab(o, t, ns, g, e.x ?? 0.24, 2400, e.pan ?? 0, 0.3, e.p ?? 1);
      return;
    case 'drone':
      drone(o, t, ns, dur, g, e.x ?? 260);
      return;
    case 'heart':
      heart(o, t, g);
      return;
    case 'rain':
      rain(o, t, dur, g, e.x ?? 1);
      return;
  }
}
