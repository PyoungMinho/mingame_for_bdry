/**
 * 효과음(0.05~1.5초) — 전부 synth.ts 부품으로 합성한다. 시각 t 에 Out(효과음 버스)으로 낸다.
 * 크기 기준(믹스 목표): '보통'에서 효과음 피크 ≈ 배경음악 피크 + 6 dB, 대사 타자음 ≈ −30 dBFS.
 * 휴대폰 스피커는 300Hz 아래를 거의 못 내므로, 저음 타격(쾅 · 둔탁음)에는 늘 중음(600Hz~1.2kHz) 몸통을 같이 넣는다.
 * 판정음은 판정 종류로만 갈린다(어느 줄·카드인지 모른다). 대사음은 화자 '종류'로만 갈린다.
 */
import type { SfxId } from './cues';
import { bell, blip, kick, mtof, noiseHit, revCymbal, stab, tone, type Out } from './synth';

type SfxFn = (o: Out, t: number, k: number) => void;

/** 대사음 피치 흔들림(연속 호출 번호 k 로 돌린다 — 결정론) */
const WOBBLE = [0, 2, -1, 3, 1, -2];

export const SFX: Record<SfxId, SfxFn> = {
  // ── 대사 타자음(아주 작게) ──
  type_ai: (o, t, k) => blip(o, t, 91 + WOBBLE[k % 6], 0.035, 0.42, 0.15, 0, 2),
  type_person: (o, t, k) => tone(o, t, { type: 'triangle', f0: mtof(72 + WOBBLE[k % 6]), peak: 0.05, a: 0.004, decay: 0.045, cut: 2400 }),
  type_me: (o, t, k) => tone(o, t, { type: 'triangle', f0: mtof(64 + WOBBLE[k % 6]), peak: 0.055, a: 0.004, decay: 0.05, cut: 1800 }),
  type_dev: (o, t, k) => blip(o, t, 81 + (k % 2) * 2, 0.03, 0.4, -0.1, 0, 2),

  // ── UI ──
  tap: (o, t) => tone(o, t, { f0: 1250, f1: 900, glide: 0.03, peak: 0.07, a: 0.002, decay: 0.035 }),
  paper: (o, t) => {
    noiseHit(o, t, { f0: 1800, f1: 3800, q: 0.8, peak: 0.16, a: 0.03, decay: 0.16, pan: -0.15 });
    noiseHit(o, t + 0.11, { f0: 3200, f1: 1500, q: 1.2, peak: 0.1, a: 0.01, decay: 0.12, pan: 0.15, seed: 4 });
  },

  // ── 추궁 · 제시 ──
  press: (o, t) => {
    noiseHit(o, t, { f0: 500, f1: 2600, q: 1.4, peak: 0.2, a: 0.08, decay: 0.12 });
    blip(o, t + 0.12, 86, 0.06, 0.6, 0, 0, 2);
  },
  present: (o, t) => {
    noiseHit(o, t, { f0: 420, f1: 3600, q: 1.1, peak: 0.26, a: 0.16, decay: 0.06, pan: -0.2 });
    kick(o, t + 0.22, 0.35, 140, 70, 0.28, 2);
    noiseHit(o, t + 0.22, { f0: 1800, q: 0.6, peak: 0.5, a: 0.002, decay: 0.07, seed: 6 });
    // '쾅'의 중음 몸통
    noiseHit(o, t + 0.22, { f0: 1100, q: 0.9, peak: 1.4, a: 0.002, decay: 0.1, seed: 24 });
  },

  // ── 판정 ──
  // 돌파: 판정이 뜨는 그 순간 타격(쾅) → 역재생 심벌이 차오르고 → 화음 스탭 + 또박이 '정정' 글리치
  break: (o, t) => {
    kick(o, t, 1.25, 150, 38, 0.6, 2);
    noiseHit(o, t, { type: 'highpass', f0: 2600, q: 0.5, peak: 0.2, a: 0.002, decay: 0.7, send: 0.3, seed: 8 });
    stab(o, t, [38, 50, 57], 1.0, 0.35, 900, 0, 0.3, 2);
    revCymbal(o, t + 0.06, 0.36, 0.8);
    const h = t + 0.42;
    stab(o, h, [50, 62, 65, 69, 76], 1.35, 0.95, 2800, 0, 0.45, 2);
    kick(o, h, 0.7, 120, 45, 0.3, 2);
    [93, 88, 84, 81].forEach((m, i) => blip(o, h + 0.3 + i * 0.07, m, 0.06, 0.5, i % 2 ? -0.4 : 0.4, 0.2, 2));
  },
  breakMinor: (o, t) => {
    kick(o, t, 1.0, 130, 42, 0.45, 2);
    noiseHit(o, t, { type: 'highpass', f0: 3000, q: 0.5, peak: 0.12, a: 0.002, decay: 0.4, seed: 9 });
    revCymbal(o, t + 0.05, 0.22, 0.6);
    const h = t + 0.27;
    stab(o, h, [62, 65, 69], 1.15, 0.6, 2400, 0, 0.35, 2);
    blip(o, h + 0.28, 88, 0.06, 0.5, 0.3, 0.2, 2);
  },
  // 반쯤 맞음: 모티프의 '안 끝난' 꼬리(D5 → E5 장2도, 둘째 음이 살짝 처진다) — 정답처럼 들리는 상행 5도를 피한 중립음
  half: (o, t) => {
    tone(o, t, { type: 'triangle', f0: mtof(74), peak: 0.2, a: 0.005, decay: 0.14, cut: 2500 });
    tone(o, t + 0.13, { type: 'triangle', f0: mtof(76), f1: mtof(75.7), glide: 0.3, peak: 0.16, a: 0.005, decay: 0.35, cut: 2500 });
  },
  redirect: (o, t) => {
    bell(o, t, 81, 1.7, -0.15, 0.3, 1.0, 2);
    bell(o, t + 0.14, 86, 1.5, 0.15, 0.3, 1.2, 2);
  },
  wrong: (o, t) => {
    for (const [f, d] of [
      [110, 0],
      [116.5, 0.03],
    ] as [number, number][])
      tone(o, t, { type: 'sawtooth', f0: f, f1: f * 0.94, glide: 0.4, peak: 0.13, a: 0.01, decay: 0.42 + d, cut: 1800 });
    // 한 옥타브 위 사각파 — 버저의 거친 성분이 휴대폰 대역에 들어오게
    for (const [f, d] of [
      [220, 0],
      [233, 0.03],
    ] as [number, number][])
      tone(o, t, { type: 'square', f0: f, f1: f * 0.94, glide: 0.4, peak: 0.08, a: 0.01, decay: 0.4 + d, cut: 2200 });
    noiseHit(o, t, { type: 'lowpass', f0: 700, q: 0.7, peak: 0.12, a: 0.004, decay: 0.12, seed: 12 });
  },
  // 신뢰 감소: 낮은 '쿵'(사인)은 작게, 둔탁음의 몸은 중음(사각파 190→120Hz 배음 + 650Hz 노이즈)으로
  trustDown: (o, t) => {
    tone(o, t, { f0: 95, f1: 48, glide: 0.2, peak: 0.08, a: 0.004, decay: 0.26 });
    tone(o, t, { type: 'square', f0: 190, f1: 120, glide: 0.15, peak: 0.07, a: 0.004, decay: 0.2, cut: 1400 });
    noiseHit(o, t, { f0: 650, q: 1.5, peak: 1.5, a: 0.003, decay: 0.11, seed: 13 });
    noiseHit(o, t, { type: 'lowpass', f0: 420, q: 0.8, peak: 0.06, a: 0.003, decay: 0.1, seed: 25 });
  },
  star: (o, t) => {
    [74, 81, 86, 89, 93].forEach((m, i) => bell(o, t + i * 0.055, m + 12, 1.1 - i * 0.05, i % 2 ? 0.25 : -0.25, 0.35, 0.8, 2));
    noiseHit(o, t + 0.05, { type: 'highpass', f0: 8000, q: 0.5, peak: 0.06, a: 0.15, decay: 0.35, seed: 14 });
  },

  // ── 진행 ──
  tick: (o, t) => {
    noiseHit(o, t, { f0: 3400, q: 3, peak: 0.24, a: 0.001, decay: 0.018, seed: 15 });
    tone(o, t, { f0: 2100, peak: 0.08, a: 0.001, decay: 0.03 });
    noiseHit(o, t + 0.12, { f0: 2200, q: 3, peak: 0.13, a: 0.001, decay: 0.018, seed: 16 });
  },
  pickup: (o, t) => {
    blip(o, t, 88, 0.07, 0.9, -0.1, 0.3, 2);
    blip(o, t + 0.08, 93, 0.12, 0.9, 0.1, 0.3, 2);
    noiseHit(o, t + 0.06, { type: 'highpass', f0: 7000, q: 0.5, peak: 0.05, a: 0.05, decay: 0.15, seed: 17 });
  },
  unlock: (o, t) => {
    noiseHit(o, t, { f0: 2200, q: 1, peak: 1.2, a: 0.001, decay: 0.035, seed: 18 });
    tone(o, t + 0.075, { type: 'square', f0: 2600, f1: 2200, glide: 0.02, peak: 0.12, a: 0.001, decay: 0.04, cut: 6000 });
    // 걸쇠가 '딸깍' 걸린 뒤의 짧은 금속 울림(폰 대역)
    tone(o, t + 0.08, { type: 'triangle', f0: 1320, f1: 1250, glide: 0.06, peak: 0.12, a: 0.002, decay: 0.09, cut: 4000 });
    tone(o, t + 0.075, { f0: 160, f1: 110, glide: 0.08, peak: 0.06, a: 0.002, decay: 0.12 });
    noiseHit(o, t + 0.075, { f0: 1500, q: 2, peak: 1.6, a: 0.001, decay: 0.07, seed: 19 });
  },
  siren: (o, t) => {
    // 짧은 두 음 경고(약 0.9초) — 두 번 오르내린다
    for (let i = 0; i < 2; i++) {
      tone(o, t + i * 0.42, { type: 'triangle', f0: 660, f1: 920, glide: 0.2, peak: 0.16, a: 0.02, decay: 0.38, cut: 2600 });
      tone(o, t + i * 0.42, { type: 'sawtooth', f0: 330, f1: 460, glide: 0.2, peak: 0.04, a: 0.02, decay: 0.36, cut: 1400 });
    }
  },
  accuse: (o, t) => {
    kick(o, t, 1.35, 120, 30, 0.85, 2);
    stab(o, t, [38, 45, 50, 57], 1.4, 1.1, 1100, 0, 0.4, 2);
    noiseHit(o, t, { type: 'highpass', f0: 2000, q: 0.5, peak: 0.22, a: 0.002, decay: 1.2, send: 0.3, seed: 20 });
  },
  slotOk: (o, t) => {
    kick(o, t, 0.7, 130, 45, 0.35, 2);
    bell(o, t, 74, 1.2, -0.2, 0.35, 1.0, 2);
    bell(o, t, 81, 1.0, 0.2, 0.35, 1.0, 2);
  },
  stamp: (o, t) => {
    kick(o, t, 0.25, 180, 70, 0.22, 2);
    noiseHit(o, t, { f0: 900, q: 0.7, peak: 1.2, a: 0.002, decay: 0.1, seed: 21 });
    // 도장 몸통(1.2kHz)
    noiseHit(o, t, { f0: 1200, q: 1, peak: 1.2, a: 0.002, decay: 0.09, seed: 26 });
  },
};

/**
 * 효과음별 음량 보정(렌더 하네스 metrics 로 맞춘 값). 엔진이 효과음마다 고정 GainNode 1개를 두고 이 값을 건다.
 * 목표: 판정·획득 계열 피크 ≈ 배경음악 피크 + 6 dB · UI(탭·틱·종이·추궁) 는 그보다 작게 · 타자음 ≈ −30 dBFS.
 */
export const SFX_GAIN: Partial<Record<SfxId, number>> = {
  present: 1.677,
  break: 1.901,
  breakMinor: 2.686,
  half: 4.771,
  redirect: 4.58,
  wrong: 4.98,
  trustDown: 4.533,
  star: 4.374,
  pickup: 10.268,
  unlock: 1.859,
  siren: 4.295,
  accuse: 2.195,
  slotOk: 3.573,
  stamp: 2.263,
  press: 3.814,
  tap: 2.83,
  tick: 3.19,
  paper: 4.305,
  type_ai: 1.35,
  type_dev: 1.517,
  type_me: 0.706,
  type_person: 0.78,
};

/** 대사음 묶음(엔진이 스로틀을 따로 다룬다) */
export const isTypeSfx = (id: SfxId): boolean => id.startsWith('type_');
