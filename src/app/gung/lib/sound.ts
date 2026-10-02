/**
 * §12-6 소리·진동(방장 폰) — 파일 0, WebAudio 합성.
 * 징 = 사인 110/165/220Hz 배음 + 지수 감쇠 2.5s. 탁(카운트다운) = 80ms 노이즈 버스트 bandpass 1.2kHz.
 * AudioContext는 사용자 탭 핸들러 안에서 생성·resume(iOS 자동재생 정책) — `ensureAudio()`를 그 핸들러에서 먼저 호출한다.
 */

let ctx: AudioContext | null = null;

export function ensureAudio(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctor) return null;
  if (!ctx) ctx = new Ctor();
  if (ctx.state === 'suspended') void ctx.resume();
  return ctx;
}

function playTone(ac: AudioContext, freq: number, gain: number, start: number, decay: number) {
  const osc = ac.createOscillator();
  const g = ac.createGain();
  osc.frequency.value = freq;
  osc.type = 'sine';
  g.gain.setValueAtTime(gain, ac.currentTime + start);
  g.gain.exponentialRampToValueAtTime(0.0001, ac.currentTime + start + decay);
  osc.connect(g).connect(ac.destination);
  osc.start(ac.currentTime + start);
  osc.stop(ac.currentTime + start + decay + 0.05);
}

/** 징 — 타이머 0초·진상 공개 전환 등에 */
export function playGong(enabled: boolean): void {
  if (!enabled) return;
  const ac = ensureAudio();
  if (!ac) return;
  playTone(ac, 110, 0.5, 0, 2.5);
  playTone(ac, 165, 0.3, 0, 2.2);
  playTone(ac, 220, 0.2, 0, 1.8);
}

/** 탁 — 카운트다운 셋·둘·하나 */
export function playTock(enabled: boolean): void {
  if (!enabled) return;
  const ac = ensureAudio();
  if (!ac) return;
  const dur = 0.08;
  const buf = ac.createBuffer(1, ac.sampleRate * dur, ac.sampleRate);
  const data = buf.getChannelData(0);
  // 노이즈는 고정 LCG — 게임 규칙(§7-2 "Math.random 은 방 생성 시에만")을 소리에서도 지킨다
  let x = 0x2545f491;
  for (let i = 0; i < data.length; i++) {
    x = (Math.imul(x, 1664525) + 1013904223) >>> 0;
    data[i] = (x / 2147483648 - 1) * (1 - i / data.length);
  }
  const src = ac.createBufferSource();
  src.buffer = buf;
  const filter = ac.createBiquadFilter();
  filter.type = 'bandpass';
  filter.frequency.value = 1200;
  const g = ac.createGain();
  g.gain.value = 0.6;
  src.connect(filter).connect(g).connect(ac.destination);
  src.start();
}

export function vibrate(pattern: number | number[]): void {
  try {
    navigator.vibrate?.(pattern);
  } catch {
    /* 무시 */
  }
}
