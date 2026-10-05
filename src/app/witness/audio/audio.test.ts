/**
 * 소리 — 순수 로직 · 엔진(가짜 AudioContext) · 스포일러 가드.
 *  - cues: 화면 · 판정 · 남은 행동 → 곡 · 긴장 레이어 · 판정음 · 대사음
 *  - score: 생성형 변주가 2분 안에 똑같이 반복되지 않는다(수사 · 증언 · 추격) · 화성 진행은 바로 앞 구간과 다르다
 *  - engine: 노드 누수 없음 · 동시 소스 제한 · 백그라운드에서 스케줄러 폭주 없음 · 음소거/소리 끔이면 잠자기(타이머 0) · 정적 뒤 재진입 · 곡 위치 기억
 *  - 스포일러: 곡 · 대사음 · 판정음이 진상(범인 · 깰 수 있는 줄 · 정답 카드)과 무관함을 사건 데이터 전체로 확인
 * 범인 id 는 코드·이름에 쓰지 않고 CASE.solution 에서 읽는다.
 */
import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { CASE, type Dialogue, type EndingId, type Speaker, type SuspectId } from '@/lib/witness';
import { TRACK_IDS, SFX_IDS, blipEvery, blipFor, cueFor, endingTrack, levelGain, verdictCue, type Scene } from './cues';
import { AudioEngine, LOOKAHEAD, MAX_SOURCES, createEngine, renderScenario, renderSfx, renderTrack } from './engine';
import { FakeContext, FakeNode, FakeOfflineContext } from './fakeAudio';
import { TRACKS, investigateCombo, mix, pursuitCombo, testimonyCombo } from './score';
import { VoicePool } from './synth';

const play = (p: Partial<Scene>): Scene => ({ ready: true, view: 'play', phase: 'play', actions: 12, ...p });
const SUSPECTS: SuspectId[] = ['S1', 'S2', 'S3', 'S4'];

afterEach(() => {
  FakeContext.instances = [];
});

describe('cues — 화면 → 곡', () => {
  it('저장을 읽기 전엔 무음, 타이틀·인트로는 타이틀 곡, 규칙·허브·조사는 수사 곡', () => {
    expect(cueFor({ ready: false, view: 'title' }).track).toBeNull();
    expect(cueFor({ ready: true, view: 'title' }).track).toBe('title');
    expect(cueFor(play({ screen: 'intro' })).track).toBe('title');
    expect(cueFor(play({ screen: 'rules' })).track).toBe('investigate');
    expect(cueFor(play({ screen: 'hub' })).track).toBe('investigate');
    expect(cueFor(play({ screen: 'location' })).track).toBe('investigate');
  });

  it('증언은 증언 곡, 대질은 추격 곡, 돌파를 본 그 세트에서만 추격 곡', () => {
    expect(cueFor(play({ screen: 'testimony', setId: 'T02', setKind: 'first' })).track).toBe('testimony');
    expect(cueFor(play({ screen: 'testimony', setId: 'T09', setKind: 'confront' })).track).toBe('pursuit');
    expect(cueFor(play({ screen: 'testimony', setId: 'T02', setKind: 'first' }), 'T02').track).toBe('pursuit');
    expect(cueFor(play({ screen: 'testimony', setId: 'T03', setKind: 'first' }), 'T02').track).toBe('testimony');
    expect(cueFor(play({ screen: 'hub' }), 'T02').track).toBe('investigate');
  });

  it('지목·사이렌은 지목 곡, 엔딩은 엔딩 종류로', () => {
    expect(cueFor(play({ screen: 'accuse' })).track).toBe('accuse');
    expect(cueFor(play({ screen: 'siren', phase: 'siren', actions: 0 })).track).toBe('accuse');
    const cases: [EndingId, string][] = [
      ['perfect', 'ending_good'],
      ['short', 'ending_good'],
      ['hidden', 'ending_hidden'],
      ['timeout', 'ending_bad'],
      ['excluded', 'ending_bad'],
      ['wrong-S1', 'ending_bad'],
      ['wrong-S2', 'ending_bad'],
      ['wrong-S3', 'ending_bad'],
      ['wrong-S4', 'ending_bad'],
    ];
    for (const [e, t] of cases) {
      expect(endingTrack(e)).toBe(t);
      expect(cueFor(play({ screen: 'ending', phase: 'ended', ending: e })).track).toBe(t);
      expect(cueFor({ ready: true, view: 'ending', ending: e }).track).toBe(t);
    }
  });

  it('남은 행동 ≤ 3 이면 긴장 레이어(곡 교체 아님) — 수사·증언·추격 곡에서만', () => {
    for (const screen of ['hub', 'location'] as const) {
      expect(cueFor(play({ screen, actions: 4 }))).toEqual({ track: 'investigate', tension: false });
      expect(cueFor(play({ screen, actions: 3 }))).toEqual({ track: 'investigate', tension: true });
      expect(cueFor(play({ screen, actions: 0 }))).toEqual({ track: 'investigate', tension: true });
    }
    expect(cueFor(play({ screen: 'testimony', setId: 'T02', setKind: 'first', actions: 2 }))).toEqual({ track: 'testimony', tension: true });
    expect(cueFor(play({ screen: 'accuse', actions: 1 })).tension).toBe(false);
    expect(cueFor(play({ screen: 'siren', phase: 'siren', actions: 0 })).tension).toBe(false);
  });

  it('사이렌 뒤 허브·재방문(밸런스 R3·R6) — 곡은 수사·증언 그대로, 긴장 레이어는 계속 켜진다', () => {
    for (const screen of ['hub', 'location'] as const) expect(cueFor(play({ screen, phase: 'siren', actions: 0 }))).toEqual({ track: 'investigate', tension: true });
    expect(cueFor(play({ screen: 'testimony', setId: 'T02', setKind: 'first', phase: 'siren', actions: 0 }))).toEqual({ track: 'testimony', tension: true });
    // 지목(사이렌 뒤에도 취소·경고가 되는 지목 화면)은 지목 곡 — 긴장 레이어 없음
    expect(cueFor(play({ screen: 'accuse', phase: 'siren', actions: 0 }))).toEqual({ track: 'accuse', tension: false });
    // 끝난 뒤에는 없다
    expect(cueFor(play({ screen: 'ending', phase: 'ended', actions: 0, ending: 'timeout' })).tension).toBe(false);
  });
});

describe('cues — 판정 · 대사음 · 크기', () => {
  it('판정 종류 → 소리', () => {
    expect(verdictCue('BREAK', 'star')).toEqual({ sfx: 'break', duck: 'cut', silence: 1.2 });
    expect(verdictCue('BREAK', 'minor')).toMatchObject({ sfx: 'breakMinor', duck: 'cut' });
    expect(verdictCue('HALF')).toEqual({ sfx: 'half', duck: null });
    expect(verdictCue('REDIRECT')).toEqual({ sfx: 'redirect', duck: null });
    expect(verdictCue('WRONG')).toEqual({ sfx: 'wrong', duck: 'dip', follow: 'trustDown' });
    // 튜토리얼 오답은 신뢰가 줄지 않는다 → 신뢰 감소음 없음
    expect(verdictCue('WRONG', undefined, true)).toEqual({ sfx: 'wrong', duck: 'dip' });
  });

  it('대사음은 화자 종류만 — 용의자 넷과 형사는 같은 음색, 내레이션은 없음', () => {
    for (const s of SUSPECTS) expect(blipFor(s)).toBe('type_person');
    expect(blipFor('COP')).toBe('type_person');
    expect(blipFor('AI')).toBe('type_ai');
    expect(blipFor('ME')).toBe('type_me');
    expect(blipFor('DEV')).toBe('type_dev');
    expect(blipFor('NARR')).toBeNull();
    expect(blipEvery('normal')).toBe(2);
    expect(blipEvery('fast')).toBe(3);
    expect(blipEvery('instant')).toBe(0);
  });

  it('단계 → 게인(0 끔 · 1 작게 · 2 보통 · 3 크게)', () => {
    expect([0, 1, 2, 3].map(levelGain)).toEqual([0, 0.35, 0.6, 0.9]);
    expect(levelGain(9)).toBe(0.9);
    expect(levelGain(-1)).toBe(0);
  });
});

describe('스포일러 가드 — 소리는 진상과 무관하다', () => {
  const culprit = CASE.solution.culprit;

  it('모든 증언 세트: 곡은 세트 종류로만 정해지고, 범인이 말하는 세트도 같은 종류면 같은 곡', () => {
    const byKind = new Map<string, Set<string>>();
    for (const set of CASE.sets) {
      for (const actions of [12, 3]) {
        const c = cueFor(play({ screen: 'testimony', setId: set.id, setKind: set.kind, actions }));
        const key = `${set.kind}:${actions}`;
        if (!byKind.has(key)) byKind.set(key, new Set());
        byKind.get(key)!.add(JSON.stringify(c));
      }
    }
    for (const [k, v] of byKind) expect(v.size, k).toBe(1);
    const withCulprit = CASE.sets.filter((s) => s.speakers.includes(culprit));
    const without = CASE.sets.filter((s) => !s.speakers.includes(culprit));
    expect(withCulprit.length).toBeGreaterThan(0);
    expect(without.length).toBeGreaterThan(0);
    for (const a of withCulprit)
      for (const b of without.filter((x) => x.kind === a.kind)) {
        expect(cueFor(play({ screen: 'testimony', setId: a.id, setKind: a.kind }))).toEqual(cueFor(play({ screen: 'testimony', setId: b.id, setKind: b.kind })));
      }
  });

  it('사건 데이터의 모든 대사: 대사음은 화자 종류로만(범인 줄과 다른 용의자 줄이 같은 소리)', () => {
    const lines: Dialogue[] = [];
    for (const s of CASE.sets) {
      lines.push(...s.intro, ...s.outro);
      for (const l of s.lines) {
        lines.push({ who: l.who, text: l.text }, ...l.press.lines, ...(l.redirect?.say ?? []));
        for (const b of l.breaks ?? []) lines.push(...b.reaction);
      }
    }
    for (const l of CASE.locations) for (const h of l.hotspots) lines.push(...h.lines);
    const sounds = new Map<Speaker, Set<string | null>>();
    for (const d of lines) {
      if (!sounds.has(d.who)) sounds.set(d.who, new Set());
      sounds.get(d.who)!.add(blipFor(d.who));
    }
    for (const v of sounds.values()) expect(v.size).toBe(1);
    const sus = SUSPECTS.filter((s) => sounds.has(s)).map((s) => [...sounds.get(s)!][0]);
    expect(new Set(sus).size).toBe(1);
  });

  it('cues.ts 는 사건 데이터를 읽지 않고, 소리 모듈은 엔진(@/lib/witness)을 타입으로만 가져온다', () => {
    const dir = path.join(__dirname);
    for (const f of readdirSync(dir).filter((x) => /\.(ts|tsx)$/.test(x) && !/test|fake/.test(x))) {
      const src = readFileSync(path.join(dir, f), 'utf8');
      expect(src, f).not.toMatch(/case-data/);
      expect(src, f).not.toMatch(/import[^;]*\bCASE\b/);
      expect(src, f).not.toMatch(/\bCASE\./);
      for (const m of src.matchAll(/^import\s+(type\s+)?[^;]*from '@\/lib\/witness';/gm)) expect(m[1], `${f}: ${m[0]}`).toBe('type ');
    }
  });

  it('판정음 함수의 입력은 판정 종류뿐 — 같은 종류면 어느 줄·어느 카드든 같은 소리', () => {
    // verdictCue 는 (kind, tier, tutorial) 만 받는다: 줄 id·카드·화자를 넘길 자리가 없다
    expect(verdictCue.length).toBeLessThanOrEqual(3);
    for (const set of CASE.sets) for (const l of set.lines) for (const b of l.breaks ?? []) expect(verdictCue('BREAK', b.tier).sfx).toBe(b.tier === 'star' ? 'break' : 'breakMinor');
  });
});

describe('score — 곡 데이터', () => {
  it('모든 곡이 마디마다 음을 만든다(결정론)', () => {
    for (const id of TRACK_IDS) {
      const def = TRACKS[id];
      expect(def.bpm).toBeGreaterThan(50);
      for (let i = 0; i < 16; i++) {
        const a = def.bar(i, 42);
        expect(a.length, `${id} bar ${i}`).toBeGreaterThan(0);
        expect(JSON.stringify(def.bar(i, 42))).toBe(JSON.stringify(a));
        for (const e of a) expect(e.b).toBeGreaterThanOrEqual(0);
      }
    }
  });

  it('BPM 범위(사양): 수사 80~90 · 증언 104~112 · 추격 128~140 · 타이틀 ≈70', () => {
    expect(TRACKS.investigate.bpm).toBeGreaterThanOrEqual(80);
    expect(TRACKS.investigate.bpm).toBeLessThanOrEqual(90);
    expect(TRACKS.testimony.bpm).toBeGreaterThanOrEqual(104);
    expect(TRACKS.testimony.bpm).toBeLessThanOrEqual(112);
    expect(TRACKS.pursuit.bpm).toBeGreaterThanOrEqual(128);
    expect(TRACKS.pursuit.bpm).toBeLessThanOrEqual(140);
    expect(Math.abs(TRACKS.title.bpm - 70)).toBeLessThanOrEqual(4);
  });

  it('수사 곡: 8마디마다 변주, 같은 8마디 구간은 2분 안에 다시 나오지 않는다(30분 범위)', () => {
    const def = TRACKS.investigate;
    const secSec = (8 * 4 * 60) / def.bpm;
    const minGap = Math.ceil(120 / secSec);
    for (const seed of [1, 20261005, 987654321]) {
      const sections = Math.ceil((30 * 60) / secSec);
      const hashes: string[] = [];
      for (let k = 0; k < sections; k++) {
        const evs = [];
        for (let b = 0; b < 8; b++) evs.push(def.bar(k * 8 + b, seed));
        hashes.push(JSON.stringify(evs));
      }
      for (let i = 0; i < hashes.length; i++) for (let j = i + 1; j < Math.min(hashes.length, i + minGap + 1); j++) expect(hashes[i] === hashes[j], `seed ${seed} sections ${i},${j}`).toBe(false);
      // 결(드럼·베이스·선율·보이싱)은 60구간 동안 겹치지 않고, 화성 진행은 바로 앞 구간과 늘 다르며 5종을 고루 쓴다
      const textures = new Set<string>();
      const progs = new Set<number>();
      for (let k = 0; k < 60; k++) {
        const { prog, breath, ...tex } = investigateCombo(k, seed);
        textures.add(JSON.stringify(tex));
        progs.add(prog);
        void breath;
        if (k > 0) expect(prog, `seed ${seed} section ${k}`).not.toBe(investigateCombo(k - 1, seed).prog);
        // 3구간(67초) 주기로 같은 진행이 '정확히' 돌아오지 않는다(한 번은 어긋난다)
      }
      expect(textures.size).toBe(60);
      expect(progs.size).toBe(5);
      const period3 = Array.from({ length: 30 }, (_, k) => investigateCombo(k, seed).prog === investigateCombo(k + 3, seed).prog);
      expect(period3.every(Boolean)).toBe(false);
      // 약 3분(8구간)에 한 번 드럼 없는 숨 고르기 구간
      const breaths = Array.from({ length: 16 }, (_, k) => investigateCombo(k, seed).breath).filter(Boolean).length;
      expect(breaths).toBe(2);
      expect(def.bar(7 * 8, seed).some((e) => e.v === 'kick' || e.v === 'snare' || e.v === 'hat')).toBe(false);
    }
    expect(mix(1, 2)).not.toBe(mix(1, 3));
  });

  it('증언 · 추격 곡: 8마디 구간 조합이 2분 안에 같게 돌아오지 않고, 이웃 구간은 편곡이 다르며, 첫 구간은 기본 편곡', () => {
    for (const [id, combo] of [
      ['testimony', testimonyCombo],
      ['pursuit', pursuitCombo],
    ] as const) {
      const def = TRACKS[id];
      const secSec = (8 * 4 * 60) / def.bpm;
      const minGap = Math.ceil(120 / secSec);
      for (const seed of [1, 20261005, 987654321]) {
        const keys = Array.from({ length: 60 }, (_, k) => JSON.stringify(combo(k, seed)));
        for (let i = 0; i < keys.length; i++) for (let j = i + 1; j < Math.min(keys.length, i + minGap + 1); j++) expect(keys[i] === keys[j], `${id} seed ${seed} ${i},${j}`).toBe(false);
        for (let k = 1; k < 60; k++) expect(combo(k, seed).arr, `${id} ${k}`).not.toBe(combo(k - 1, seed).arr);
        expect(combo(0, seed).arr).toBe(0);
        // 화성을 정하는 (편곡, alt) 는 2분 창 안에서 겹치지 않는다(햇 결 · 드럼 결만 다른 구간이 2분 안에 오지 않게)
        const harm = Array.from({ length: 60 }, (_, k) => {
          const c = combo(k, seed) as { arr: number; alt: boolean };
          return `${c.arr}:${c.alt}`;
        });
        if (id === 'testimony') for (let i = 0; i < 60; i++) for (let j = i + 1; j < Math.min(60, i + 7); j++) expect(harm[i] === harm[j], `${id} harm ${i},${j}`).toBe(false);
      }
    }
  });
});

describe('engine — 가짜 AudioContext', () => {
  const busNodes = (ctx: FakeContext, upto: number) => new Set(ctx.created.slice(0, upto));

  it('오프라인 렌더: 곡 · 효과음 · 장면을 예외 없이 예약한다', () => {
    for (const id of TRACK_IDS) {
      const ctx = new FakeOfflineContext();
      const e = renderTrack(ctx as unknown as BaseAudioContext, id, 8);
      expect(e.realtime).toBe(false);
      expect(e.errors, id).toBe(0);
      expect(ctx.sources.length, id).toBeGreaterThan(5);
    }
    for (const id of SFX_IDS) {
      const ctx = new FakeOfflineContext();
      const e = renderSfx(ctx as unknown as BaseAudioContext, id);
      expect(e.errors, id).toBe(0);
      expect(ctx.sources.length, id).toBeGreaterThan(0);
    }
    const ctx = new FakeOfflineContext();
    expect(renderScenario(ctx as unknown as BaseAudioContext, 14).errors).toBe(0);
    expect(renderTrack(new FakeOfflineContext() as unknown as BaseAudioContext, 'investigate', 6, { tension: true }).errors).toBe(0);
  });

  it('소스가 끝나면 보이스 노드를 모두 끊는다(노드 누수 없음)', () => {
    const ctx = new FakeOfflineContext();
    const e = new AudioEngine(ctx as unknown as BaseAudioContext, { bgm: 2, sfx: 2, muted: false, seed: 3 });
    const keep = busNodes(ctx, ctx.created.length);
    e.clock = 0;
    e.setCue({ track: 'pursuit', tension: true }, { fadeIn: 0 });
    const playerNodes = new Set(ctx.created.slice(keep.size, keep.size + 2));
    e.advance(12);
    for (const id of SFX_IDS) e.sfx(id, 12);
    expect(ctx.sources.length).toBeGreaterThan(100);
    ctx.endAll();
    const leaked = ctx.created.filter((n) => !keep.has(n) && !playerNodes.has(n) && n.outs.size > 0 && n.kind !== 'gain-trim');
    // 효과음별 고정 보정 게인(최대 22개)만 남는다
    expect(leaked.every((n) => n.kind === 'gain')).toBe(true);
    expect(leaked.length).toBeLessThanOrEqual(SFX_IDS.length);
  });

  it('동시 소스 제한: 소스 수로 세고, 장식·보통은 상한에서, 곡의 바탕은 ×1.2, 효과음은 ×1.6 에서 막힌다', () => {
    const p = new VoicePool(MAX_SOURCES);
    let ok = 0;
    for (let i = 0; i < 60; i++) if (p.take(1, 2, 1, 2)) ok++;
    expect(ok).toBe(MAX_SOURCES / 2);
    expect(p.active).toBe(MAX_SOURCES);
    let bed = 0;
    while (p.take(1, 2, 2)) bed++;
    expect(bed).toBe(Math.round(MAX_SOURCES * 1.2) - MAX_SOURCES);
    let fx = 0;
    while (p.take(1, 2, 3)) fx++;
    expect(p.active).toBe(Math.round(MAX_SOURCES * 1.6));
    expect(fx).toBeGreaterThan(0);
    expect(p.take(5, 1, 1)).toBe(true); // 앞의 것들이 끝난 뒤
    expect(p.active).toBe(1);
  });

  it('실제 곡 · 크로스페이드 · 스팅어가 겹쳐도 동시 소스가 하드 상한(효과음 포함)을 넘지 않는다', () => {
    const ctx = new FakeOfflineContext();
    const e = new AudioEngine(ctx as unknown as BaseAudioContext, { bgm: 2, sfx: 2, muted: false, seed: 777, lite: false });
    e.clock = 0;
    e.setCue({ track: 'investigate', tension: true });
    e.advance(30);
    e.setCue({ track: 'testimony', tension: true });
    e.advance(31);
    e.sfx('present');
    e.advance(31.6);
    e.verdict(verdictCue('BREAK', 'star'));
    e.sfx('star', 32.2);
    e.setCue({ track: 'pursuit', tension: true });
    e.advance(45);
    const evs: [number, number][] = [];
    for (const s of ctx.sources) evs.push([s.started, 1], [s.stopped > 0 ? s.stopped : s.started + 99, -1]);
    evs.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
    let cur = 0;
    let peak = 0;
    for (const [, d] of evs) peak = Math.max(peak, (cur += d));
    expect(peak).toBeLessThanOrEqual(Math.round(MAX_SOURCES * 1.6));
    expect(e.errors).toBe(0);
  });

  it('실시간: 스케줄러는 룩어헤드만큼만 예약하고, 백그라운드로 한참 밀려도 지난 음을 몰아서 내지 않는다', () => {
    const ctx = new FakeContext();
    ctx.state = 'running';
    const e = createEngine(ctx as unknown as BaseAudioContext, { bgm: 2, sfx: 2, muted: false, seed: 5 });
    expect(e.realtime).toBe(true);
    e.setCue({ track: 'pursuit', tension: false });
    const n0 = ctx.sources.length;
    ctx.currentTime = 0.1;
    e.pump();
    const after = ctx.sources.filter((s) => s.started >= 0);
    expect(after.every((s) => s.started <= 0.1 + LOOKAHEAD + 0.6)).toBe(true);
    // 10분 뒤로 시계가 튀어도 그 사이 음을 예약하지 않는다
    ctx.currentTime = 600;
    const before = ctx.sources.length;
    e.pump();
    const burst = ctx.sources.slice(before);
    expect(burst.length).toBeLessThan(120);
    expect(burst.every((s) => s.started >= 599.9)).toBe(true);
    expect(n0).toBeGreaterThanOrEqual(0);
    e.release();
  });

  it('음소거: 50ms 램프 후 컨텍스트를 재우고, 효과음을 내지 않는다 · 풀면 깨운다', async () => {
    const ctx = new FakeContext();
    ctx.state = 'running';
    const e = createEngine(ctx as unknown as BaseAudioContext, { bgm: 2, sfx: 2, muted: false, seed: 5 });
    e.setLevels(2, 2, true);
    const master = e.master.gain as unknown as { events: { type: string; v?: number; t: number }[] };
    expect(master.events.some((x) => x.type === 'lin' && x.v === 0 && Math.abs(x.t - 0.05) < 1e-9)).toBe(true);
    await new Promise((r) => setTimeout(r, 120));
    expect(ctx.calls).toContain('suspend');
    const n = ctx.sources.length;
    e.sfx('break');
    expect(ctx.sources.length).toBe(n);
    e.setLevels(2, 2, false);
    expect(ctx.calls[ctx.calls.length - 1]).toBe('resume');
    e.release();
  });

  it('생성 시점에 이미 음소거(첫 제스처가 소리 끄기 탭): 바로 재우고, 곡이 바뀌어도 타이머 · 예약 없음 · 풀면 그때 예약', () => {
    const ctx = new FakeContext();
    ctx.state = 'running';
    const e = createEngine(ctx as unknown as BaseAudioContext, { bgm: 2, sfx: 2, muted: true, seed: 5 });
    expect(ctx.calls).toContain('suspend');
    const n = ctx.sources.length;
    e.setCue({ track: 'title', tension: false });
    e.setCue({ track: 'investigate', tension: false });
    expect(e.stats.timer).toBe(false);
    expect(ctx.sources.length).toBe(n);
    e.setLevels(2, 2, false);
    expect(ctx.calls[ctx.calls.length - 1]).toBe('resume');
    expect(e.stats.timer).toBe(true);
    e.pump();
    expect(ctx.sources.length).toBeGreaterThan(n);
    e.release();
  });

  it('음소거 중 화면 전환: 25ms 타이머를 다시 켜지 않는다', async () => {
    const ctx = new FakeContext();
    ctx.state = 'running';
    const e = createEngine(ctx as unknown as BaseAudioContext, { bgm: 2, sfx: 2, muted: false, seed: 5 });
    e.setCue({ track: 'testimony', tension: false });
    e.setLevels(2, 2, true);
    await new Promise((r) => setTimeout(r, 120));
    expect(e.stats.timer).toBe(false);
    e.setCue({ track: 'investigate', tension: false });
    expect(e.stats.timer).toBe(false);
    e.release();
  });

  it('배경음악 끔: 곡을 예약하지 않고 타이머도 멈춘다(효과음은 그대로) · 둘 다 끔이면 컨텍스트를 재운다 · 다시 켜면 깨운다', async () => {
    const ctx = new FakeContext();
    ctx.state = 'running';
    const e = createEngine(ctx as unknown as BaseAudioContext, { bgm: 0, sfx: 2, muted: false, seed: 5 });
    expect(ctx.calls).not.toContain('suspend');
    e.setCue({ track: 'pursuit', tension: true });
    expect(e.stats.timer).toBe(false);
    expect(ctx.sources.length).toBe(0);
    e.sfx('tap');
    expect(ctx.sources.length).toBeGreaterThan(0);
    const n = ctx.sources.length;
    e.setLevels(2, 2, false);
    expect(e.stats.timer).toBe(true);
    e.pump();
    expect(ctx.sources.length).toBeGreaterThan(n);
    e.setLevels(0, 0, false);
    expect(e.stats.timer).toBe(false);
    await new Promise((r) => setTimeout(r, 120));
    expect(ctx.calls[ctx.calls.length - 1]).toBe('suspend');
    e.setLevels(0, 1, false);
    expect(ctx.calls[ctx.calls.length - 1]).toBe('resume');
    expect(e.stats.timer).toBe(false);
    e.release();
  });

  it('곡 위치 기억: 허브(수사 곡)로 돌아올 때마다 다음 8마디 구간부터 잇는다(같은 첫 구간 반복 없음)', () => {
    const ctx = new FakeOfflineContext();
    const e = new AudioEngine(ctx as unknown as BaseAudioContext, { bgm: 2, sfx: 2, muted: false, seed: 12345 });
    e.clock = 0;
    const prints: string[] = [];
    let t = 0;
    for (let k = 0; k < 3; k++) {
      e.setCue({ track: 'investigate', tension: false });
      const start = e.now();
      e.advance(t + 20);
      prints.push(
        ctx.sources
          .filter((s) => s.started >= start + 1 && s.started < start + 20 && s.kind === 'osc')
          .map((s) => `${(s.started - start).toFixed(3)}:${Math.round(s.frequency.events[0]?.v ?? s.frequency.value)}`)
          .join(','),
      );
      t += 20;
      e.setCue({ track: 'testimony', tension: false });
      e.advance(t + 30);
      t += 30;
    }
    expect(prints[0]).not.toBe(prints[1]);
    expect(prints[1]).not.toBe(prints[2]);
    expect(prints[0]).not.toBe(prints[2]);
  });

  it('증거 제시: 쾅 직전에 BGM 을 살짝 내렸다가 되돌린다(정답 여부와 무관하게 늘 같다)', () => {
    const ctx = new FakeOfflineContext();
    const e = new AudioEngine(ctx as unknown as BaseAudioContext, { bgm: 2, sfx: 2, muted: false, seed: 1 });
    e.clock = 0;
    e.setCue({ track: 'testimony', tension: false }, { fadeIn: 0 });
    e.advance(2);
    e.sfx('present');
    const gate = e.bgmGate.gain as unknown as { events: { type: string; v?: number; t: number }[] };
    const down = gate.events.find((x) => x.type === 'lin' && x.v !== undefined && x.v < 1)!;
    expect(down.t).toBeGreaterThan(2.15);
    expect(down.t).toBeLessThan(2.3);
    expect(gate.events.some((x) => x.type === 'lin' && x.v === 1 && x.t > down.t)).toBe(true);
  });

  it('숨김 → 재우고 타이머 정지, 다시 보이면 깨운다(음소거면 그대로)', () => {
    const ctx = new FakeContext();
    ctx.state = 'running';
    const e = createEngine(ctx as unknown as BaseAudioContext, { bgm: 2, sfx: 2, muted: false, seed: 5 });
    e.setCue({ track: 'investigate', tension: false });
    expect(e.stats.timer).toBe(true);
    e.setHidden(true);
    expect(ctx.calls).toContain('suspend');
    expect(e.stats.timer).toBe(false);
    e.setHidden(false);
    expect(ctx.calls[ctx.calls.length - 1]).toBe('resume');
    expect(e.stats.timer).toBe(true);
    e.setLevels(2, 2, true);
    e.setHidden(true);
    ctx.calls = [];
    e.setHidden(false);
    expect(ctx.calls).not.toContain('resume');
    e.release();
    expect(e.stats.timer).toBe(false);
  });

  it('돌파: BGM 을 0.1초 안에 내리고, 정적 동안 요청된 곡은 정적이 끝날 때 들어온다 · 같은 곡이면 이어 간다', () => {
    const ctx = new FakeOfflineContext();
    const e = new AudioEngine(ctx as unknown as BaseAudioContext, { bgm: 2, sfx: 2, muted: false, seed: 1 });
    e.clock = 0;
    e.setCue({ track: 'testimony', tension: false }, { fadeIn: 0 });
    e.advance(4);
    e.verdict(verdictCue('BREAK', 'star'));
    const gate = e.bgmGate.gain as unknown as { events: { type: string; v?: number; t: number }[] };
    const down = gate.events.find((x) => x.type === 'lin' && x.v === 0)!;
    expect(down.t - 4).toBeLessThanOrEqual(0.1);
    const up = gate.events.find((x) => x.type === 'lin' && x.v === 1)!;
    expect(up.t - 4).toBeGreaterThanOrEqual(1.2);
    const n = ctx.sources.length;
    e.setCue({ track: 'pursuit', tension: false });
    e.advance(5.2);
    // 정적(약 1.28초) 동안은 새 곡의 음이 없다
    expect(ctx.sources.slice(n).filter((s) => s.started > 4.2 && s.started < 5.25).length).toBe(0);
    e.advance(7);
    expect(ctx.sources.slice(n).some((s) => s.started >= 5.28)).toBe(true);
    expect(e.track).toBe('pursuit');
    e.setCue({ track: 'pursuit', tension: true });
    expect(e.track).toBe('pursuit');
  });

  it('대사음 스로틀 — 35ms 안에 겹친 호출은 한 번만', () => {
    const ctx = new FakeOfflineContext();
    const e = new AudioEngine(ctx as unknown as BaseAudioContext, { bgm: 2, sfx: 2, muted: false, seed: 1 });
    e.clock = 0;
    const n = ctx.sources.length;
    e.sfx('type_ai', 1);
    e.sfx('type_ai', 1.01);
    e.sfx('type_person', 1.02);
    const one = ctx.sources.length - n;
    e.sfx('type_ai', 1.1);
    expect(one).toBeGreaterThan(0);
    expect(ctx.sources.length - n).toBe(one * 2);
    // 효과음 0단계면 아무것도 만들지 않는다
    e.setLevels(2, 0, false);
    const m = ctx.sources.length;
    e.sfx('break', 2);
    expect(ctx.sources.length).toBe(m);
  });
});

// 미사용 경고 방지(타입 확인용)
void FakeNode;
