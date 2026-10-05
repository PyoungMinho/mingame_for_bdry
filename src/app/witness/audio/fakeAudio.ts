/**
 * 테스트 전용 가짜 Web Audio(jsdom 에는 AudioContext 가 없다). 앱 코드는 이 파일을 import 하지 않는다(번들 제외).
 * 노드 생성 · connect/disconnect · 소스 start/stop · 컨텍스트 resume/suspend 를 기록해 누수 · 폭주 · 수명주기를 확인한다.
 */

export class FakeParam {
  value: number;
  events: { type: string; v?: number; t: number }[] = [];
  constructor(v = 0) {
    this.value = v;
  }
  setValueAtTime(v: number, t: number) {
    this.events.push({ type: 'set', v, t });
    return this;
  }
  linearRampToValueAtTime(v: number, t: number) {
    this.events.push({ type: 'lin', v, t });
    return this;
  }
  exponentialRampToValueAtTime(v: number, t: number) {
    if (!(v > 0)) throw new RangeError('exponential ramp target must be positive');
    this.events.push({ type: 'exp', v, t });
    return this;
  }
  setTargetAtTime(v: number, t: number) {
    this.events.push({ type: 'target', v, t });
    return this;
  }
  setValueCurveAtTime(_c: Float32Array, t: number, d: number) {
    for (const e of this.events) if (e.t >= t && e.t <= t + d) throw new Error('curve overlaps another event');
    this.events.push({ type: 'curve', t }, { type: 'curve-end', t: t + d });
    return this;
  }
  cancelScheduledValues(t: number) {
    this.events = this.events.filter((e) => e.t < t);
    return this;
  }
}

export class FakeNode {
  static live = new Set<FakeNode>();
  outs = new Set<FakeNode | FakeParam>();
  kind: string;
  constructor(
    public context: FakeContext,
    kind: string,
  ) {
    this.kind = kind;
    context.created.push(this);
  }
  connect(t: FakeNode | FakeParam) {
    this.outs.add(t);
    FakeNode.live.add(this);
    return t;
  }
  disconnect() {
    this.outs.clear();
    FakeNode.live.delete(this);
  }
}

class FakeGain extends FakeNode {
  gain: FakeParam;
  constructor(c: FakeContext) {
    super(c, 'gain');
    this.gain = new FakeParam(1);
  }
}
class FakeSource extends FakeNode {
  onended: (() => void) | null = null;
  started = -1;
  stopped = -1;
  frequency = new FakeParam(440);
  detune = new FakeParam(0);
  type = 'sine';
  buffer: unknown = null;
  loop = false;
  start(t = 0) {
    this.started = t;
    this.context.sources.push(this);
  }
  stop(t = 0) {
    this.stopped = t;
  }
}
class FakeFilter extends FakeNode {
  type = 'lowpass';
  frequency = new FakeParam(350);
  Q = new FakeParam(1);
  gain = new FakeParam(0);
}
class FakeComp extends FakeNode {
  threshold = new FakeParam(-24);
  knee = new FakeParam(30);
  ratio = new FakeParam(12);
  attack = new FakeParam(0.003);
  release = new FakeParam(0.25);
}
class FakePanner extends FakeNode {
  pan = new FakeParam(0);
}

export class FakeBuffer {
  private data: Float32Array[];
  constructor(
    public numberOfChannels: number,
    public length: number,
    public sampleRate: number,
  ) {
    this.data = Array.from({ length: numberOfChannels }, () => new Float32Array(length));
  }
  get duration() {
    return this.length / this.sampleRate;
  }
  getChannelData(c: number) {
    return this.data[c];
  }
}

export class FakeContext {
  static instances: FakeContext[] = [];
  currentTime = 0;
  sampleRate = 8000;
  state: 'running' | 'suspended' | 'closed' = 'suspended';
  created: FakeNode[] = [];
  sources: FakeSource[] = [];
  calls: string[] = [];
  destination: FakeNode;
  constructor() {
    FakeContext.instances.push(this);
    this.destination = new FakeNode(this, 'destination');
  }
  createGain() {
    return new FakeGain(this);
  }
  createOscillator() {
    return new FakeSource(this, 'osc');
  }
  createBufferSource() {
    return new FakeSource(this, 'buffer');
  }
  createBiquadFilter() {
    return new FakeFilter(this, 'filter');
  }
  createDynamicsCompressor() {
    return new FakeComp(this, 'comp');
  }
  createWaveShaper() {
    return Object.assign(new FakeNode(this, 'shaper'), { curve: null as unknown });
  }
  createConvolver() {
    return Object.assign(new FakeNode(this, 'convolver'), { buffer: null as unknown });
  }
  createStereoPanner() {
    return new FakePanner(this, 'panner');
  }
  createBuffer(ch: number, len: number, sr: number) {
    return new FakeBuffer(ch, len, sr);
  }
  resume() {
    this.calls.push('resume');
    this.state = 'running';
    return Promise.resolve();
  }
  suspend() {
    this.calls.push('suspend');
    this.state = 'suspended';
    return Promise.resolve();
  }
  close() {
    this.calls.push('close');
    this.state = 'closed';
    return Promise.resolve();
  }
  /** 지금까지 시작된 소스가 모두 끝났다고 치고 onended 를 부른다 */
  endAll() {
    for (const s of this.sources) s.onended?.();
    this.sources = [];
  }
}

/** OfflineAudioContext 흉내(startRendering 이 있으면 엔진이 오프라인으로 본다) */
export class FakeOfflineContext extends FakeContext {
  startRendering() {
    return Promise.resolve(null);
  }
}

/** 소스 노드(오실레이터 · 버퍼)를 빼고, 아직 연결이 남아 있는 '보이스' 노드 수 */
export function liveVoiceNodes(ctx: FakeContext, keep: Set<FakeNode>): number {
  let n = 0;
  for (const node of ctx.created) if (!keep.has(node) && node.outs.size > 0) n += 1;
  return n;
}
