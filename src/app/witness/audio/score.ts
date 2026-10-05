/**
 * 곡 데이터 — 전부 오리지널. 마디마다 Ev[](데이터)를 만들어 내는 순수 함수다(같은 씨앗·같은 마디 = 같은 결과).
 *
 * 메인 모티프 「또박이 모티프」(5음, D 단조): D – A – F – G – E (근음 → 5도 위 → 단3도 → 4도 → 2도에서 멈춤)
 *   리듬 기본형: 점4분 · 8분 · 4분 · 4분 | 길게. 끝이 2도(E)에서 걸려 '아직 안 끝난 질문'처럼 들린다.
 *   - title        : 느린 일렉피아노 원형 + 답(F E D) · 비 · 패드
 *   - investigate  : 8마디마다 화성(5종, 씨앗 난수 · 바로 앞과 다르게)·드럼·베이스·선율·보이싱 결(60종)이 바뀌는 생성형 로파이.
 *                    8구간(약 3분)마다 드럼 없는 '숨 고르기' 구간(비 + 패드 + 일렉피아노 모티프)
 *   - testimony    : 블립 8분음 축소형 + 시계 틱 · 페달 베이스 펄스. 8마디 구간 16조합(편곡 4 × 2 × 2)을 보폭 5로 돈다 → 같은 구간은 약 4분 45초 뒤
 *   - pursuit      : 리드 8분음 축소형을 3도씩 올리는 시퀀스 → 상행 런. 구간 12조합(편곡 3 × 2 × 2) → 같은 구간은 약 2분 50초 뒤
 *   - accuse       : 모티프 5음을 8마디에 한 음씩 흩뿌림(드론 두 겹 + 심장박동 + 감화음 패드)
 *   - ending_good  : F 장조 쪽으로 풀어 F 에 닿지만 마지막 마디는 Dm(씁쓸)
 *   - ending_bad   : 피아노 독주, 마지막 음 E 에서 해결 없이 끝
 *   - ending_hidden: D 장조 오르골(D A F# G E → D 로 처음 해결) + 또박이 블립 대답
 * 음 높이는 MIDI(D4 = 62). 길이·위치는 박 단위.
 * 크기 기준: 곡마다 trim 으로 '보통'에서 300Hz 위 RMS ≈ −30 dBFS(휴대폰 스피커가 실제로 내는 대역)에 맞추고, 전체 RMS(−24±3)는 상한 확인용.
 */
import { rng, type Ev, type VoiceId } from './synth';
import type { TrackId } from './cues';

export interface TrackDef {
  id: TrackId;
  bpm: number;
  /** 조 · 설명(문서용) */
  key: string;
  /** 고정 루프 길이(마디) — 이음매 검사 · 미리듣기 루프 */
  loopBars: number;
  /** 곡 고유 음량 보정(믹스 목표: '보통'에서 300Hz 위 RMS ≈ −30 dBFS · 전체 RMS −24±3 dBFS) */
  trim: number;
  /** 긴장 레이어(남은 행동 ≤ 3)를 얹을 수 있는 곡 */
  tensionOk: boolean;
  bar: (i: number, seed: number) => Ev[];
}

// ─────────────────────────────── 재료 ───────────────────────────────

/** 모티프(근음 기준 반음 간격) */
export const MOTIF: readonly number[] = [0, 7, 3, 5, 2];
/** 장조 모티프(숨은 엔딩) */
export const MOTIF_MAJOR: readonly number[] = [0, 7, 4, 5, 2];

type Note = [beat: number, midi: number, dur: number, vel?: number];

const line = (v: VoiceId, notes: Note[], g = 0.6, extra: Partial<Ev> = {}): Ev[] => notes.map(([b, n, d, vel]) => ({ b, v, n, d, g: vel ?? g, ...extra }));

/** 모티프를 root 에서, 주어진 리듬(박 길이)으로 */
function motif(root: number, start: number, durs: readonly number[], shape: readonly number[] = MOTIF): Note[] {
  const out: Note[] = [];
  let b = start;
  shape.forEach((iv, k) => {
    const d = durs[k] ?? 1;
    out.push([b, root + iv, d]);
    b += d;
  });
  return out;
}

interface Chord {
  bass: number;
  notes: number[];
}

const C = (bass: number, ...notes: number[]): Chord => ({ bass, notes });

// D 단조 화음(중음역 보이싱)
const Dm9 = C(38, 53, 57, 60, 64);
const Bbmaj7 = C(34, 53, 57, 62, 65);
const Gm9 = C(31, 53, 58, 62, 69);
const A7sus = C(33, 55, 62, 64, 69);
const A7b9 = C(33, 55, 61, 64, 70);
const Ebmaj7 = C(39, 55, 58, 62, 69);
const Fmaj9 = C(41, 57, 60, 64, 67);
const Cadd9 = C(36, 55, 60, 62, 64);

const sortEv = (evs: Ev[]): Ev[] => evs.sort((a, b) => a.b - b.b);

/** 씨앗 섞기(마디·구간 번호와 합쳐 결정론 난수) */
export function mix(seed: number, a: number, b = 0): number {
  let h = (seed ^ 0x9e3779b9) >>> 0;
  h = Math.imul(h ^ (a + 0x7f4a7c15), 0x85ebca6b) >>> 0;
  h = Math.imul(h ^ (b + 0x165667b1), 0xc2b2ae35) >>> 0;
  return (h ^ (h >>> 16)) >>> 0;
}

// ─────────────────────────────── title (70 BPM) ───────────────────────────────

function titleBar(i: number): Ev[] {
  const bi = i % 8;
  const round = Math.floor(i / 8) % 2;
  const ch = [Dm9, Bbmaj7, Gm9, A7sus][bi >> 1];
  const out: Ev[] = [{ b: 0, v: 'rain', d: 4, g: 0.6, x: 3 + bi, p: 2 }];
  if (bi % 2 === 0) {
    // 7마디째(sus 마디)는 패드를 한 마디만 — 8마디째 A7b9 로 sus4(D) → 3음(C#) 해결이 흐려지지 않게
    out.push({ b: 0, v: 'pad', n: ch.notes, d: bi === 6 ? 4 : 8, g: 0.32, x: 900 });
    out.push({ b: 0, v: 'bass', n: ch.bass, d: 7.5, g: 0.42 });
  }
  if (bi === 7) out.push({ b: 0, v: 'pad', n: A7b9.notes, d: 4, g: 0.3, x: 900 });
  // 왼손: 화음 첫 박을 느리게 펼친다
  ch.notes.forEach((m, k) => {
    if (bi % 2 === 0) out.push({ b: k * 0.5, v: 'ep', n: m, d: 3, g: 0.22, pan: -0.15 });
  });
  const mel: Note[][] =
    round === 0
      ? [
          motif(74, 0, [1.5, 0.5, 1, 1, 3]).slice(0, 4),
          [[0, 76, 3]],
          [[0, 77, 1], [1, 76, 1], [2, 74, 2]],
          [[0, 69, 3]],
          motif(79, 0, [1.5, 0.5, 1, 1]).slice(0, 4),
          [[0, 81, 3]],
          [[0, 77, 1], [1, 76, 1], [2, 74, 1.5], [3.5, 73, 0.5]],
          [[0, 76, 2.5]],
        ]
      : [
          [[1, 74, 1], [2, 81, 2]],
          [[0.5, 77, 1], [1.5, 79, 1], [2.5, 76, 1.5]],
          [[2, 74, 1], [3, 72, 1]],
          [[0, 69, 2], [2.5, 72, 0.5], [3, 74, 1]],
          [[0, 70, 1.5], [1.5, 74, 0.5], [2, 77, 2]],
          [[1, 76, 1], [2, 74, 2]],
          [[0, 73, 1], [1, 76, 1], [2, 79, 2]],
          [[0, 76, 3]],
        ];
  out.push(...line('ep', mel[bi], 0.5, { pan: 0.1 }));
  // 또박이: 모티프 끝 두 음을 높은 벨로 메아리
  if (bi === 7) out.push(...line('bell', [[2.5, 93, 1, 0.22], [3, 88, 1, 0.18]], 0.2, { pan: 0.3 }));
  if (bi === 3 && round === 1) out.push({ b: 3, v: 'blip', n: 86, d: 0.15, g: 0.18, pan: 0.4, p: 0 });
  return sortEv(out);
}

// ─────────────────────────────── investigate (86 BPM, 생성형) ───────────────────────────────

const INV_PROGS: Chord[][] = [
  [Dm9, Gm9, Bbmaj7, A7sus],
  [Dm9, Bbmaj7, Gm9, A7sus],
  [Dm9, Ebmaj7, Gm9, A7b9],
  [Dm9, Fmaj9, Cadd9, A7sus],
  // 버금딸림(Gm)으로 시작해 Bb 에서 열어 둔다
  [Gm9, A7sus, Dm9, Bbmaj7],
];
/** D 단조 펜타토닉(즉흥 선율 재료) */
const PENTA = [62, 65, 67, 69, 72, 74, 77, 79, 81];
/** 몇 구간마다 드럼 없는 '숨 고르기' 구간(8구간 ≈ 3분) */
const INV_BREATH_EVERY = 8;

/** 구간별 화성 진행 번호 — 씨앗 난수로 고르되 바로 앞 구간과는 늘 다르다(3구간 주기로 같은 진행이 돌아오지 않게) */
let progMemo: { seed: number; section: number; p: number } | null = null;
function invProg(section: number, seed: number): number {
  const n = INV_PROGS.length;
  let k = 0;
  let p = mix(seed, 0, 5) % n;
  if (progMemo && progMemo.seed === seed && progMemo.section <= section) {
    k = progMemo.section;
    p = progMemo.p;
  }
  for (; k < section; ) {
    k += 1;
    p = (p + 1 + (mix(seed, k, 5) % (n - 1))) % n;
  }
  progMemo = { seed, section, p };
  return p;
}

/**
 * 8마디 구간마다 조합. 결(드럼 3 × 베이스 2 × 선율 5 × 보이싱 2 = 60)은 보폭 17(60 과 서로소)로 돌아 60구간(약 22분) 동안 겹치지 않고,
 * 화성 진행(5종)은 invProg 로 따로 고른다. breath = 드럼 없는 숨 고르기 구간.
 */
export function investigateCombo(section: number, seed: number): { prog: number; drum: number; bass: number; mel: number; voicing: number; breath: boolean } {
  const c = (section * 17 + (seed % 60)) % 60;
  return {
    prog: invProg(section, seed),
    drum: c % 3,
    bass: Math.floor(c / 3) % 2,
    mel: Math.floor(c / 6) % 5,
    voicing: Math.floor(c / 30) % 2,
    breath: section % INV_BREATH_EVERY === INV_BREATH_EVERY - 1,
  };
}

function investigateBar(i: number, seed: number): Ev[] {
  const sec = Math.floor(i / 8);
  const bi = i % 8;
  const cb = investigateCombo(sec, seed);
  const r = rng(mix(seed, i, 11));
  const ch = INV_PROGS[cb.prog][bi >> 1];
  const out: Ev[] = [{ b: 0, v: 'rain', d: 4, g: 0.28, x: 20 + bi, p: 2 }];
  const voiced = cb.voicing ? ch.notes.map((m, k) => (k === 0 ? m - 12 : m)) : ch.notes;
  if (bi % 2 === 0) out.push({ b: 0, v: 'pad', n: voiced, d: 8, g: cb.breath ? 0.28 : 0.22, x: 950 });
  if (cb.breath) {
    // 숨 고르기: 드럼 · 펄스 없이 비 + 패드 + 일렉피아노 모티프(약 3분에 한 번 밀도를 낮춘다)
    out.push({ b: 0, v: 'bass', n: ch.bass, d: 3.6, g: 0.32 });
    out.push({ b: 0, v: 'ep', n: voiced, d: 2, g: 0.18, pan: -0.12 });
    if (bi === 0 || bi === 4) out.push(...line('ep', motif(74, 0, [1.5, 0.5, 1, 1]).slice(0, 4), 0.42, { pan: 0.12 }));
    if (bi === 1) out.push(...line('ep', [[0, 76, 3]], 0.38, { pan: 0.12 }));
    if (bi === 5) out.push(...line('ep', [[0, 77, 1], [1, 76, 1], [2, 74, 2]], 0.36, { pan: 0.12 }));
    if (bi === 7) out.push({ b: 2.5, v: 'blip', n: 86, d: 0.12, g: 0.14, pan: 0.4, p: 0 });
    return sortEv(out);
  }
  // 드럼(D2 = 구간 첫 두 마디는 쉼)
  const drumsOn = !(cb.drum === 2 && bi < 2);
  if (drumsOn) {
    const sw = 0.58;
    if (cb.drum === 1) {
      out.push({ b: 0, v: 'kick', g: 0.5 });
      out.push({ b: 3, v: 'snare', g: 0.32, pan: 0.05 });
      for (let k = 0; k < 4; k++) out.push({ b: k + sw - 0.08, v: 'hat', g: 0.2 + r() * 0.12, pan: 0.25 });
    } else {
      out.push({ b: 0, v: 'kick', g: 0.55 });
      out.push({ b: 2.5, v: 'kick', g: 0.42 });
      if (r() < 0.3) out.push({ b: 1.75, v: 'kick', g: 0.25, p: 0 });
      out.push({ b: 1, v: 'snare', g: 0.3 });
      out.push({ b: 3, v: 'snare', g: 0.34 });
      for (let k = 0; k < 4; k++) {
        out.push({ b: k, v: 'hat', g: 0.22 + r() * 0.1, pan: 0.25, p: 0 });
        out.push({ b: k + sw, v: 'hat', g: 0.14 + r() * 0.1, pan: 0.25, p: 0 });
      }
    }
    if (bi === 7) out.push({ b: 3.5, v: 'ohat', g: 0.18, pan: 0.3, p: 0 });
  }
  // 베이스
  if (cb.bass === 0) out.push({ b: 0, v: 'bass', n: ch.bass, d: 3.6, g: 0.5 });
  else {
    out.push({ b: 0, v: 'bass', n: ch.bass, d: 1.2, g: 0.52 });
    out.push({ b: 2.5, v: 'bass', n: ch.bass + 7, d: 0.7, g: 0.4 });
    out.push({ b: 3.5, v: 'bass', n: ch.bass + 12, d: 0.4, g: 0.32 });
  }
  // 일렉피아노 반주
  out.push({ b: 0, v: 'ep', n: voiced, d: 1.5, g: 0.2 + r() * 0.06, pan: -0.12 });
  if (r() < 0.6) out.push({ b: 2.5 + (r() < 0.5 ? 0.08 : 0), v: 'ep', n: voiced.slice(1, 3), d: 1, g: 0.16, pan: -0.12 });
  // 선율 변주
  switch (cb.mel) {
    case 0:
      if (r() < 0.3) out.push({ b: 1 + Math.floor(r() * 3) + 0.5, v: 'blip', n: 86 + (r() < 0.5 ? 0 : 5), d: 0.12, g: 0.16, pan: 0.4, p: 0 });
      break;
    case 1:
      if (bi === 0) out.push(...line('ep', motif(74, 0, [1.5, 0.5, 1, 1]).slice(0, 4), 0.42, { pan: 0.12 }));
      if (bi === 1) out.push(...line('ep', [[0, 76, 2.5]], 0.4, { pan: 0.12 }));
      if (bi === 4) out.push(...line('ep', [[0, 77, 1], [1, 76, 1], [2, 74, 2]], 0.38, { pan: 0.12 }));
      break;
    case 2:
      if (bi === 2 || bi === 6) {
        const notes = motif(86, 1, [0.5, 0.5, 0.5, 0.5, 1]);
        out.push(...line('blip', notes, 0.22, { pan: 0.35 }));
        out.push(...line('blip', notes.slice(3).map(([b, n, d]) => [b + 0.75, n, d, 0.1] as Note), 0.1, { pan: -0.35, p: 0 }));
      }
      break;
    case 3:
      if (bi % 2 === 1) {
        const k = 2 + Math.floor(r() * 3);
        let b = r() < 0.5 ? 0.5 : 1;
        for (let j = 0; j < k && b < 3.75; j++) {
          out.push({ b, v: 'ep', n: PENTA[Math.floor(r() * PENTA.length)], d: 0.75, g: 0.3 + r() * 0.08, pan: 0.15 });
          b += r() < 0.5 ? 0.5 : 1;
        }
      }
      break;
    case 4:
      if (bi === 0) out.push(...line('bell', motif(86, 0, [1, 1, 1, 1]).slice(0, 4), 0.26, { pan: 0.2 }));
      if (bi === 4) out.push(...line('bell', [[0, 89, 1], [1, 88, 1], [2, 86, 2]], 0.22, { pan: 0.2 }));
      break;
  }
  return sortEv(out);
}

// ─────────────────────────────── testimony (108 BPM) ───────────────────────────────

/**
 * 증언 곡 화성 — 진행 4종 × 베이스 2종(D 페달 / 화음 근음을 따라 움직임). 끝 두 마디는 늘 A7 쪽으로 닫는다.
 * motifAt = [블립 모티프 마디, 일렉피아노 모티프 마디](D 단조 화음 쪽 마디에 둔다).
 */
const TEST_PROGS: { chords: number[][]; pedal: number[]; moving: number[]; motifAt: [blip: number, ep: number] }[] = [
  {
    // P0 Dm – Bb/D – Gm/D – C#dim7 – A7b9 (원래 진행)
    chords: [[53, 57, 62, 64], [53, 57, 62, 64], [53, 58, 62, 65], [53, 58, 62, 65], [55, 58, 62, 67], [55, 58, 62, 67], [52, 55, 58, 61], [55, 61, 64, 70]],
    pedal: [38, 38, 38, 38, 38, 38, 34, 33],
    moving: [38, 38, 34, 34, 31, 31, 37, 33],
    motifAt: [1, 5],
  },
  {
    // P1 Dm – Gm – Bb – Eb – A7b9
    chords: [[53, 57, 62, 64], [53, 57, 62, 64], [55, 58, 62, 67], [55, 58, 62, 67], [53, 58, 62, 65], [53, 58, 62, 65], [55, 58, 63, 67], [55, 61, 64, 70]],
    pedal: [38, 38, 38, 38, 38, 38, 38, 33],
    moving: [38, 38, 31, 31, 34, 34, 39, 33],
    motifAt: [1, 3],
  },
  {
    // P2 Gm – Dm – Eb – C#dim7 – A7b9(버금딸림에서 시작)
    chords: [[55, 58, 62, 67], [55, 58, 62, 67], [53, 57, 62, 64], [53, 57, 62, 64], [55, 58, 63, 67], [55, 58, 63, 67], [52, 55, 58, 61], [55, 61, 64, 70]],
    pedal: [38, 38, 38, 38, 38, 38, 34, 33],
    moving: [31, 31, 38, 38, 39, 39, 37, 33],
    motifAt: [3, 2],
  },
  {
    // P3 Dm – Fmaj7 – Cadd9 – A7sus → A7b9
    chords: [[53, 57, 62, 64], [53, 57, 62, 64], [53, 57, 60, 64], [53, 57, 60, 64], [55, 60, 62, 64], [55, 60, 62, 64], [55, 62, 64, 69], [55, 61, 64, 70]],
    pedal: [38, 38, 38, 38, 38, 38, 33, 33],
    moving: [38, 38, 41, 41, 36, 36, 33, 33],
    motifAt: [1, 0],
  },
];

/**
 * 증언 곡 8마디 구간 조합: 16 = 편곡 4 × alt 2 × 하이햇 결 2. 편곡마다 드럼 결이, (편곡, alt) 8가지마다 화성(진행 × 베이스)이 다르다.
 *   a: 기본(킥 1·3박, 스네어 4박)   b: 백비트(스네어 2·4박) + 베이스 근음/5도 교대
 *   c: 앞 4마디 숨 고르기(킥·스네어 없이 햇과 시계 틱)   d: 박마다 킥(초침) + 16분 햇 + 벨 모티프
 * 보폭 5(16 과 서로소)로 돌아 이웃 7구간 안에서는 (편곡, alt) 가 모두 달라 화성이 겹치지 않고,
 * 같은 조합은 16구간(약 4분 45초), 햇 결만 다른 조합도 8구간(약 2분 22초) 뒤에야 나온다. 첫 구간은 늘 (a).
 */
export function testimonyCombo(section: number, seed: number): { arr: number; alt: boolean; hats16: boolean } {
  const c = (section * 5 + (seed % 4) * 4) % 16;
  return { arr: c % 4, alt: ((c >> 2) & 1) === 1, hats16: ((c >> 3) & 1) === 1 };
}

/** (편곡 + 4 × alt) → [진행, 움직이는 베이스인지] — 8가지가 모두 다르다 */
const TEST_HARM: [prog: number, moving: boolean][] = [
  [0, false],
  [1, true],
  [2, false],
  [3, true],
  [0, true],
  [1, false],
  [2, true],
  [3, false],
];

function testimonyBar(i: number, seed: number): Ev[] {
  const bi = i % 8;
  const sec = Math.floor(i / 8);
  const cb = testimonyCombo(sec, seed);
  const alt = cb.alt;
  const [prog, moving] = TEST_HARM[cb.arr + (alt ? 4 : 0)];
  const pg = TEST_PROGS[prog];
  const breath = cb.arr === 2 && bi < 4;
  const r = rng(mix(seed, i, 23));
  const out: Ev[] = [];
  if (bi % 2 === 0 || bi >= 6) out.push({ b: 0, v: 'pad', n: pg.chords[bi], d: bi >= 6 ? 4 : 8, g: breath ? 0.3 : 0.26, x: 720 });
  // 베이스 펄스(8분음) — 마지막 8분은 옥타브 위. (b) 는 근음 · 5도 교대, 숨 고르기 마디는 가볍게
  const root = (moving ? pg.moving : pg.pedal)[bi];
  for (let k = 0; k < 8; k++) {
    const n = k === 7 ? root + 12 : cb.arr === 1 && k % 2 === 1 ? root + 7 : root;
    out.push({ b: k * 0.5, v: 'bass', n, d: 0.42, g: (k % 2 === 0 ? 0.38 : 0.26) * (breath ? 0.7 : 1) });
  }
  // 드럼(숨 고르기 마디는 킥 · 스네어 없이 햇과 시계 틱만)
  if (!breath) {
    if (cb.arr === 1) {
      out.push({ b: 0, v: 'kick', g: 0.4 });
      out.push({ b: 1.5, v: 'kick', g: 0.28 });
      out.push({ b: 2.5, v: 'kick', g: 0.3 });
      out.push({ b: 1, v: 'snare', g: 0.28 });
      out.push({ b: 3, v: 'snare', g: 0.3 });
    } else if (cb.arr === 3) {
      // (d) 박마다 낮은 킥(초침처럼) + 4박 스네어
      for (let k = 0; k < 4; k++) out.push({ b: k, v: 'kick', g: k === 0 ? 0.38 : 0.26 });
      out.push({ b: 3, v: 'snare', g: 0.26 });
    } else {
      out.push({ b: 0, v: 'kick', g: 0.4 });
      out.push({ b: 2, v: 'kick', g: 0.3 });
      if (alt && bi % 2 === 1) out.push({ b: 1.75, v: 'kick', g: 0.26, p: 0 });
      out.push({ b: 3, v: 'snare', g: 0.3 });
    }
  }
  const sixteen = bi === 7 || cb.arr === 3 || (cb.hats16 && bi >= 4);
  for (let k = 0; k < (sixteen ? 16 : 8); k++) {
    const b = sixteen ? k * 0.25 : k * 0.5;
    const acc = sixteen ? (k % 4 === 0 ? 0.24 : k % 2 === 0 ? 0.17 : 0.1) : k % 2 === 0 ? 0.24 : 0.15;
    out.push({ b, v: 'hat', g: acc + r() * 0.06, pan: 0.22, p: 0 });
  }
  // 시계 틱 — 박마다 높은 블립 두 음을 번갈아(스마트홈 시계)
  for (let k = 0; k < 4; k++) out.push({ b: k, v: 'blip', n: k % 2 === 0 ? 93 : 88, d: 0.05, g: 0.09, pan: k % 2 ? -0.35 : 0.35, p: 0 });
  // 모티프(D 단조 화음 마디에 둔다) — (d) 는 블립 대신 벨
  if (bi === pg.motifAt[0]) {
    if (cb.arr === 3) out.push(...line('bell', motif(86, 0, [0.5, 0.5, 0.5, 0.5, 1.5]), 0.22, { pan: 0.25 }));
    else out.push(...line('blip', motif(74, 0, [0.5, 0.5, 0.5, 0.5, 1.5]), 0.3, { pan: 0.25 }));
  }
  if (bi === pg.motifAt[1]) out.push(...line('ep', motif(62, 0, [0.5, 0.5, 0.5, 0.5, 2]), 0.42, { pan: -0.1 }));
  if (cb.arr === 0 && bi === 3) {
    if (alt) out.push(...line('ep', [[0, 77, 0.5], [0.5, 76, 0.5], [1, 74, 0.5], [1.5, 73, 1.5]], 0.36, { pan: 0.1 }));
    else out.push({ b: 2, v: 'ep', n: [65, 69], d: 1.5, g: 0.25 });
  }
  if (alt && cb.arr !== 0 && bi === 5) out.push({ b: 2, v: 'ep', n: [74, 77], d: 1.5, g: 0.22, pan: 0.1 });
  if (bi === 7) out.push({ b: 0, v: 'stab', n: [61, 64, 67, 70], g: 0.3, x: 0.4 });
  return sortEv(out);
}

// ─────────────────────────────── pursuit (134 BPM) ───────────────────────────────

const PUR_ROOTS = [38, 34, 31, 33, 38, 34, 36, 33];
const PUR_CHORDS: number[][] = [
  [62, 65, 69],
  [62, 65, 70],
  [62, 67, 70],
  [61, 64, 69],
  [62, 65, 69],
  [62, 65, 70],
  [60, 64, 67],
  [61, 64, 67, 69],
];
/** 진행 B: Dm – F – C – A | Dm – Bb – Gm – A7 */
const PUR_CHORDS_B: number[][] = [
  [62, 65, 69],
  [60, 65, 69],
  [60, 64, 67],
  [61, 64, 69],
  [62, 65, 69],
  [62, 65, 70],
  [62, 67, 70],
  [61, 64, 67, 69],
];
/**
 * 추격 곡 화성 4종(구간 조합의 alt · push 로 고른다). 리드 선율(PUR_LEAD)과 부딪치지 않게 고른 진행들이다.
 *   0 A: Dm – Bb – Gm – A | Dm – Bb – C – A7          1 B: Dm – F – C – A | Dm – Bb – Gm – A7
 *   2 C: Dm – C7 – Bb – A | Dm – C7 – Bb – A7(하강 베이스)   3 D: B 의 화음을 D 페달 위에(5·8마디만 A)
 */
const PUR_HARM: { roots: number[]; chords: number[][] }[] = [
  { roots: PUR_ROOTS, chords: PUR_CHORDS },
  { roots: [38, 41, 36, 33, 38, 34, 31, 33], chords: PUR_CHORDS_B },
  {
    roots: [38, 36, 34, 33, 38, 36, 34, 33],
    chords: [[62, 65, 69], [60, 64, 70], [62, 65, 70], [61, 64, 69], [62, 65, 69], [60, 64, 70], [62, 65, 70], [61, 64, 67, 69]],
  },
  { roots: [38, 38, 38, 33, 38, 38, 38, 33], chords: PUR_CHORDS_B },
];
const PUR_LEAD: Note[][] = [
  [[0, 74, 0.5], [0.5, 81, 0.5], [1, 77, 0.5], [1.5, 79, 0.5], [2, 76, 1], [3, 74, 0.5], [3.5, 76, 0.5]],
  [[0, 77, 0.5], [0.5, 82, 0.5], [1, 79, 0.5], [1.5, 81, 0.5], [2, 77, 1.5]],
  [[0, 79, 0.5], [0.5, 86, 0.5], [1, 82, 0.5], [1.5, 84, 0.5], [2, 81, 1], [3, 79, 0.5], [3.5, 77, 0.5]],
  [[0, 76, 1], [1, 77, 0.5], [1.5, 79, 0.5], [2, 81, 0.5], [2.5, 82, 0.5], [3, 85, 1]],
  [[0, 86, 4]],
  [[0, 82, 4]],
  [[0, 84, 2], [2, 81, 2]],
  [[0, 85, 2], [2, 88, 2]],
];
const STAB_PAT: number[][] = [
  [0, 1.5, 3],
  [0.5, 2, 3.5],
];
/** 편곡 (b): 리드 대신 16분 당김음 스탭 */
const STAB_SYNC = [0, 0.75, 1.5, 2.25, 3];
/** 편곡 (c) 브레이크다운: 모티프 원형을 한 옥타브 아래 리드로(마디별 화음음에 맞춘 꼬리) */
const PUR_DOWN: Note[][] = [
  motif(62, 0, [1.5, 0.5, 1, 1]).slice(0, 4),
  [[0, 64, 1], [1, 65, 3]],
  [[0, 67, 2], [2, 70, 2]],
  [[0, 69, 2], [2, 73, 2]],
  motif(62, 0, [1.5, 0.5, 1, 1]).slice(0, 4),
  [[0, 64, 1], [1, 65, 3]],
  [[0, 67, 2], [2, 64, 2]],
  [[0, 61, 2], [2, 64, 2]],
];
/** 벨 모티프(앞 구간 5~8마디) — 7마디(C)·8마디(A7)는 화음음으로 바꿔 리드 · 스탭과 반음으로 부딪치지 않게 */
const PUR_BELL: Record<number, number[]> = { 4: [86, 93, 89, 91], 5: [86, 93, 89, 91], 6: [84, 91, 88, 91], 7: [81, 88, 85, 91] };
/** 진행 C 의 7마디(Bb) 벨 — D F A F */
const PUR_BELL_C6 = [86, 89, 93, 89];

/**
 * 추격 곡 8마디 구간 조합: 12 = 편곡 3(a 기본 · b 스탭 당김음 · c 브레이크다운) × alt 2(리드 옥타브 · 벨/블립) × 드럼 결 2(곧게 / 끊어 치기).
 * 화성은 (alt, 드럼 결) 4가지로 PUR_HARM 에서 고른다. 보폭 5(12 와 서로소)로 돌아 같은 조합은 12구간(약 2분 50초) 뒤에야,
 * 같은 화성 · 같은 편곡도 12구간 뒤에야 다시 나온다. 첫 구간은 늘 (a) — 돌파 뒤 재진입은 힘 있게.
 */
export function pursuitCombo(section: number, seed: number): { arr: number; alt: boolean; push: boolean } {
  const c = (section * 5 + (seed % 4) * 3) % 12;
  return { arr: c % 3, alt: Math.floor(c / 3) % 2 === 1, push: Math.floor(c / 6) % 2 === 1 };
}

function pursuitBar(i: number, seed: number): Ev[] {
  const bi = i % 8;
  const cb = pursuitCombo(Math.floor(i / 8), seed);
  const alt = cb.alt;
  const down = cb.arr === 2;
  const r = rng(mix(seed, i, 31));
  const out: Ev[] = [];
  const harm = (alt ? 1 : 0) + (cb.push ? 2 : 0);
  const root = PUR_HARM[harm].roots[bi];
  const chord = PUR_HARM[harm].chords[bi];
  // 베이스: 기본은 8분 옥타브 펄스, (b) 는 스탭과 같은 당김음, (c) 브레이크다운은 길게
  if (down) out.push({ b: 0, v: 'bass', n: root, d: 3.6, g: 0.42 });
  else if (cb.arr === 1) for (const b of STAB_SYNC) out.push({ b, v: 'bass', n: b === 3 ? root + 12 : root, d: 0.6, g: 0.42 });
  else for (let k = 0; k < 8; k++) out.push({ b: k * 0.5, v: 'bass', n: k % 2 === 0 ? root : root + 12, d: 0.4, g: k % 2 === 0 ? 0.4 : 0.3 });
  // 킥: 곧게(4분) / 끊어 치기(1 · 1.75 · 3 · 3.75 박)
  const broken = cb.push && !down;
  for (const [b, g] of broken ? [[0, 0.42], [0.75, 0.3], [2, 0.4], [2.75, 0.3]] : [[0, 0.42], [1, 0.34], [2, 0.42], [3, 0.34]]) out.push({ b, v: 'kick', g });
  // 패드는 홀수 마디 화음과 부딪치지 않게 한 마디만(꼬리 1.2초가 다음 마디를 잇는다)
  if (bi % 2 === 0) out.push({ b: 0, v: 'pad', n: chord.map((m) => m - 12), d: 4, g: down ? 0.26 : 0.2, x: 1400 });
  if (down) {
    // 브레이크다운: 킥(4분) · 베이스 · 패드 위에 낮은 리드 모티프. 마지막 두 마디만 햇 · 스네어가 다시 차오른다
    out.push(...line('lead', PUR_DOWN[bi], 0.4, { pan: 0.05 }));
    if (bi >= 6) for (let k = 0; k < 8; k++) out.push({ b: k * 0.5, v: 'hat', g: 0.12 + k * 0.015 + r() * 0.04, pan: 0.25, p: 0 });
    if (bi === 7) for (let k = 0; k < 8; k++) out.push({ b: 2 + k * 0.25, v: 'snare', g: 0.14 + k * 0.04, p: 0 });
    return sortEv(out);
  }
  out.push({ b: 1, v: 'snare', g: 0.42 });
  out.push({ b: 3, v: 'snare', g: 0.42 });
  if (bi === 7) for (let k = 0; k < 4; k++) out.push({ b: 3 + k * 0.25, v: 'snare', g: 0.2 + k * 0.06, p: 0 });
  if (broken) for (let k = 0; k < 8; k++) out.push({ b: k * 0.5, v: k % 2 === 1 ? 'ohat' : 'hat', g: (k % 2 === 0 ? 0.24 : 0.16) + r() * 0.05, pan: 0.25, p: 0 });
  else for (let k = 0; k < 16; k++) out.push({ b: k * 0.25, v: k % 4 === 2 ? 'ohat' : 'hat', g: (k % 2 === 0 ? 0.24 : 0.14) + r() * 0.05, pan: 0.25, p: 0 });
  if (cb.arr === 1) {
    // (b) 리드 대신 16분 당김음 스탭
    for (const b of STAB_SYNC) out.push({ b, v: 'stab', n: chord, g: 0.34, x: 0.16 });
  } else {
    for (const b of STAB_PAT[(bi + (cb.push ? 1 : 0)) % 2]) out.push({ b, v: 'stab', n: chord, g: 0.36, x: 0.18 });
    const leadNotes = PUR_LEAD[bi].map(([b, n, d]) => [b, alt && bi < 4 ? n - 12 : n, d] as Note);
    out.push(...line('lead', leadNotes, 0.5, { pan: 0.05 }));
  }
  if (bi >= 4) {
    if (!alt) out.push(...line('bell', (harm === 2 && bi === 6 ? PUR_BELL_C6 : PUR_BELL[bi]).map((n, k) => [k, n, 1] as Note), 0.22, { pan: 0.3, x: 0.9 }));
    else for (let k = 0; k < 8; k++) out.push({ b: k * 0.5, v: 'blip', n: chord[k % chord.length] + 24, d: 0.1, g: 0.14, pan: k % 2 ? -0.3 : 0.3, p: 0 });
  }
  return sortEv(out);
}

// ─────────────────────────────── accuse (60 BPM) ───────────────────────────────

function accuseBar(i: number): Ev[] {
  const bi = i % 8;
  const out: Ev[] = [{ b: 0, v: 'heart', g: 0.55, p: 2 }];
  if (bi % 4 === 0) {
    // 드론 두 겹: 낮은 D2·A2(몸) + 휴대폰에서도 들리는 D3·A3, 그 위 감화음 패드(D4 F4 Ab4)
    out.push({ b: 0, v: 'drone', n: [38, 45], d: 16, g: 0.55, x: 240 });
    out.push({ b: 0, v: 'drone', n: [50, 57], d: 16, g: 0.25, x: 700 });
    out.push({ b: 0, v: 'pad', n: [62, 65, 68], d: 16, g: 0.22, x: 1400 });
  }
  const mel: Record<number, Note[]> = { 1: [[0, 74, 3]], 3: [[0, 81, 3]], 5: [[0, 77, 2], [2, 79, 2]], 7: [[0, 76, 4]] };
  if (mel[bi]) out.push(...line('ep', mel[bi], 0.5, { pan: 0.1 }));
  if (bi === 2) out.push({ b: 2.5, v: 'blip', n: 86, d: 0.12, g: 0.14, pan: 0.4 });
  if (bi === 6) out.push({ b: 2.5, v: 'blip', n: 81, d: 0.12, g: 0.14, pan: -0.4 });
  return sortEv(out);
}

// ─────────────────────────────── endings ───────────────────────────────

const GOOD: Chord[] = [C(34, 53, 57, 62, 65), C(36, 55, 60, 62, 65), C(33, 55, 60, 64, 67), C(38, 53, 57, 60, 64), C(31, 53, 58, 62, 69), C(36, 55, 58, 60, 65), C(41, 53, 57, 60, 64), C(38, 53, 57, 60, 64)];
const GOOD_MEL: Note[][] = [
  motif(74, 0, [1.5, 0.5, 1, 1]).slice(0, 4),
  [[0, 76, 2], [2, 77, 1], [3, 79, 1]],
  [[0, 76, 1.5], [1.5, 72, 0.5], [2, 69, 2]],
  [[0, 72, 1], [1, 74, 1], [2, 76, 2]],
  motif(74, 0, [1.5, 0.5, 1, 1]).slice(0, 4),
  [[0, 76, 1], [1, 77, 1], [2, 79, 2]],
  [[0, 77, 3.5]],
  [[1, 74, 1], [2, 76, 2]],
];

function goodBar(i: number): Ev[] {
  const bi = i % 8;
  const ch = GOOD[bi];
  const out: Ev[] = [{ b: 0, v: 'rain', d: 4, g: 0.22, x: 40 + bi, p: 2 }];
  out.push({ b: 0, v: 'pad', n: ch.notes, d: 4, g: 0.24, x: 1300 });
  out.push({ b: 0, v: 'bass', n: ch.bass, d: 3.6, g: 0.4 });
  ch.notes.forEach((m, k) => out.push({ b: k * 0.33, v: 'ep', n: m, d: 2.5, g: 0.17, pan: -0.15 }));
  out.push(...line('ep', GOOD_MEL[bi], 0.46, { pan: 0.1 }));
  for (let k = 0; k < 4; k++) out.push({ b: k + 0.5, v: 'hat', g: 0.12, pan: 0.3, p: 0 });
  if (bi % 2 === 1) out.push({ b: 3, v: 'snare', g: 0.16 });
  if (bi === 6) out.push({ b: 3.5, v: 'bell', n: 93, g: 0.14, pan: 0.35 });
  return sortEv(out);
}

const BAD: Chord[] = [C(38, 50, 57, 60, 65), C(34, 50, 57, 62, 65), C(31, 55, 58, 62, 64), C(33, 55, 57, 62, 64)];
const BAD_MEL: Note[][] = [
  [[0, 74, 2], [2, 81, 2]],
  [[0, 77, 3]],
  [[0, 79, 2], [2, 76, 2]],
  [],
  [[0, 74, 1.5], [1.5, 81, 0.5], [2, 77, 2]],
  [[0, 79, 4]],
  [],
  [[0, 76, 3.5]],
];

function badBar(i: number): Ev[] {
  const bi = i % 8;
  const ch = BAD[bi >> 1];
  // 비는 배경으로(피아노보다 6dB 이상 작게)
  const out: Ev[] = [{ b: 0, v: 'rain', d: 4, g: 0.4, x: 60 + bi, p: 2 }];
  if (bi % 2 === 0) {
    out.push({ b: 0, v: 'bass', n: ch.bass, d: 7, g: 0.26 });
    ch.notes.forEach((m, k) => out.push({ b: k * 0.75, v: 'ep', n: m, d: 4, g: 0.24, pan: -0.15 }));
  } else out.push({ b: 2, v: 'ep', n: ch.notes.slice(1, 3), d: 2, g: 0.15, pan: -0.15 });
  out.push(...line('ep', BAD_MEL[bi], 0.5, { pan: 0.08 }));
  return sortEv(out);
}

const HID: Chord[] = [C(38, 54, 57, 61, 64), C(43, 54, 59, 62, 66), C(35, 54, 57, 62, 66), C(33, 54, 57, 62, 64)];

function hiddenBar(i: number): Ev[] {
  const bi = i % 8;
  const ch = HID[bi >> 1];
  const out: Ev[] = [];
  if (bi % 2 === 0) {
    out.push({ b: 0, v: 'pad', n: ch.notes, d: 8, g: 0.24, x: 1500 });
    out.push({ b: 0, v: 'bass', n: ch.bass, d: 7.5, g: 0.3 });
  }
  // 오르골 반주(펼친 화음)
  const arp = [ch.notes[0] + 12, ch.notes[2] + 12, ch.notes[1] + 12, ch.notes[3] + 12];
  arp.forEach((m, k) => out.push({ b: 0.5 + k, v: 'box', n: m, g: 0.24, pan: -0.2 }));
  const mel: Record<number, Note[]> = {
    0: motif(86, 0, [1.5, 0.5, 1, 1], MOTIF_MAJOR).slice(0, 4),
    1: [[0, 88, 2], [2, 86, 2]],
    4: motif(86, 0, [1.5, 0.5, 1, 1], MOTIF_MAJOR).slice(0, 4),
    5: [[0, 88, 1], [1, 90, 1], [2, 86, 2]],
  };
  if (mel[bi]) out.push(...line('box', mel[bi], 0.46, { pan: 0.15 }));
  // 또박이 대답(블립 두 음)
  if (bi === 2 || bi === 6) out.push(...line('blip', [[1, 93, 0.12], [1.5, 98, 0.12]], 0.2, { pan: 0.35 }));
  if (bi === 7) out.push({ b: 2, v: 'bell', n: 98, g: 0.16, pan: 0.3 });
  return sortEv(out);
}

// ─────────────────────────────── 긴장 레이어 ───────────────────────────────

/**
 * 남은 행동 ≤ 3: 지금 곡 위에 심장박동(박 1·3, 900Hz 몸통 포함) + D3·A3 드론(2마디마다) + 8분음 시계 틱(박마다 좌우 번갈아). 긴장 버스로 보낸다.
 * 드론을 D2 대신 D3·A3 로 둔다 — 휴대폰에서도 들리고, 수사 곡 Eb 마디의 Eb2 베이스와 맥놀이하지 않는다.
 */
export function tensionBar(i: number): Ev[] {
  const out: Ev[] = [
    { b: 0, v: 'heart', g: 0.62, ch: 't', p: 2 },
    { b: 2, v: 'heart', g: 0.5, ch: 't', p: 2 },
  ];
  if (i % 2 === 0) out.push({ b: 0, v: 'drone', n: [50, 57], d: 8, g: 0.5, ch: 't', x: 700 });
  for (let k = 0; k < 8; k++) out.push({ b: k * 0.5, v: 'blip', n: 93, d: 0.03, g: k % 2 === 0 ? 0.16 : 0.1, ch: 't', pan: Math.floor(k / 2) % 2 ? -0.3 : 0.3, p: 0 });
  return out;
}

// ─────────────────────────────── 곡 목록 ───────────────────────────────

export const TRACKS: Record<TrackId, TrackDef> = {
  title: { id: 'title', bpm: 70, key: 'D 단조', loopBars: 8, trim: 1.158, tensionOk: false, bar: (i) => titleBar(i) },
  investigate: { id: 'investigate', bpm: 86, key: 'D 단조(도리아 색)', loopBars: 8, trim: 2.326, tensionOk: true, bar: investigateBar },
  testimony: { id: 'testimony', bpm: 108, key: 'D 단조(D 페달)', loopBars: 8, trim: 2.251, tensionOk: true, bar: testimonyBar },
  pursuit: { id: 'pursuit', bpm: 134, key: 'D 단조', loopBars: 8, trim: 2.932, tensionOk: true, bar: pursuitBar },
  accuse: { id: 'accuse', bpm: 60, key: 'D 단조(드론)', loopBars: 8, trim: 1.632, tensionOk: false, bar: (i) => accuseBar(i) },
  ending_good: { id: 'ending_good', bpm: 76, key: 'F 장조 → Dm', loopBars: 8, trim: 1.338, tensionOk: false, bar: (i) => goodBar(i) },
  ending_bad: { id: 'ending_bad', bpm: 64, key: 'D 단조', loopBars: 8, trim: 1.839, tensionOk: false, bar: (i) => badBar(i) },
  ending_hidden: { id: 'ending_hidden', bpm: 72, key: 'D 장조', loopBars: 8, trim: 2.793, tensionOk: false, bar: (i) => hiddenBar(i) },
};

export const barSeconds = (def: TrackDef): number => (4 * 60) / def.bpm;
