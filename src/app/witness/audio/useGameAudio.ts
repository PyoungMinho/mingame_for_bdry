'use client';

/**
 * 소리 연결(React) — 항상 번들에 들어가는 얇은 다리. 엔진(engine.ts · synth · score · sfx)은 첫 사용자 제스처 때 dynamic import 한다.
 *
 *  - 제스처 전에는 AudioContext 를 만들지 않는다(자동재생 경고 0). '사용자 활성화'로 쳐지는 이벤트(마우스 pointerdown · 터치 pointerup ·
 *    touchend · Esc 가 아닌 keydown) 안에서만 동기로 만들고 resume + 무음 버퍼 1회로 iOS Safari 를 연다.
 *    터치의 pointerdown 은 활성화가 아니라서(만들면 suspended + 크롬 경고) 거른다. navigator.audioSession 은 건드리지 않는다(무음 스위치 존중).
 *  - 탭 숨김 · pagehide → 잠재우기(타이머도 멈춤), 다시 보이면 음소거가 아닐 때만 깨운다.
 *  - 앱이 언마운트되면(다른 라우트 · StrictMode 이중 마운트) 곡을 멈추고 잠든다. 다시 마운트되면 이어서 깨운다.
 *  - 효과음 함수(playSfx 등)는 엔진이 없거나 음소거면 조용히 아무것도 안 한다 — 게임 진행은 소리를 기다리지 않는다.
 *  - 스포일러: 장면(Scene)은 화면에 보이는 값만 담는다. 판정음은 판정이 화면에 뜨는 순간 화면 코드가 직접 부른다.
 */
import { useEffect, useRef } from 'react';
import type { Settings, Speaker } from '@/lib/witness';
import { blipFor, cueFor, verdictCue, type Scene, type SfxId, type VerdictSound } from './cues';
import type { AudioEngine } from './engine';

type Ctor = new () => AudioContext;

interface Bridge {
  ctx: AudioContext | null;
  engine: AudioEngine | null;
  loading: boolean;
  failed: boolean;
  levels: { bgm: number; sfx: number; muted: boolean };
  scene: Scene | null;
  /** 이번 방문에서 돌파를 본 증언 세트(그 증언이 끝날 때까지 추격 곡) */
  pursuit: string | null;
  mounted: number;
}

const B: Bridge = { ctx: null, engine: null, loading: false, failed: false, levels: { bgm: 2, sfx: 2, muted: false }, scene: null, pursuit: null, mounted: 0 };

/** 테스트용 들여다보기(번들에서는 쓰지 않는다) */
export const __audioBridge = B;

function audioCtor(): Ctor | null {
  if (typeof window === 'undefined') return null;
  const w = window as unknown as { AudioContext?: Ctor; webkitAudioContext?: Ctor };
  return w.AudioContext ?? w.webkitAudioContext ?? null;
}

const pageHidden = (): boolean => typeof document !== 'undefined' && document.visibilityState === 'hidden';

function pushCue(): void {
  if (!B.engine || !B.scene) return;
  try {
    B.engine.setCue(cueFor(B.scene, B.pursuit));
  } catch {
    /* 소리 실패는 게임에 영향 없음 */
  }
}

/** 낼 소리가 없다(음소거 · 배경음악과 효과음 모두 끔) — 제스처가 와도 컨텍스트를 만들거나 깨우지 않는다 */
const silentLevels = (): boolean => B.levels.muted || (B.levels.bgm <= 0 && B.levels.sfx <= 0);

/**
 * 사용자 제스처 안에서 부른다. 처음이면 AudioContext 를 만들고 엔진을 불러온다. 이미 있으면 멈춘 컨텍스트를 깨운다.
 * force = 음소거를 막 풀거나 꺼져 있던 크기를 올린 그 탭(설정 반영 effect 보다 먼저 온다).
 */
export function unlockAudio(force = false): void {
  if (B.failed || B.mounted <= 0) return;
  if (silentLevels() && !force) return;
  if (B.ctx) {
    // iOS: pointerdown 이 활성화로 안 쳐졌거나(구형) 전화 등으로 'interrupted' 가 됐으면 다음 제스처(touchend)에서 다시 연다
    if (B.ctx.state !== 'running' && !pageHidden()) kick(B.ctx);
    return;
  }
  const C = audioCtor();
  if (!C) {
    B.failed = true;
    return;
  }
  let ctx: AudioContext;
  try {
    ctx = new C();
  } catch {
    B.failed = true;
    return;
  }
  B.ctx = ctx;
  kick(ctx);
  B.loading = true;
  import('./engine')
    .then((m) => {
      B.loading = false;
      const e = m.createEngine(ctx, { ...B.levels });
      B.engine = e;
      if (pageHidden()) e.setHidden(true);
      if (B.mounted <= 0) e.release();
      pushCue();
    })
    .catch(() => {
      B.loading = false;
      B.failed = true;
    });
}

/** 제스처 안에서: resume + 무음 1샘플 재생(iOS Safari 언락) */
function kick(ctx: AudioContext): void {
  try {
    ctx.resume().catch(() => undefined);
    const src = ctx.createBufferSource();
    src.buffer = ctx.createBuffer(1, 1, 22050);
    src.connect(ctx.destination);
    src.onended = () => src.disconnect();
    src.start(0);
  } catch {
    /* 무시 */
  }
}

/** 효과음 한 번 */
export function playSfx(id: SfxId): void {
  const e = B.engine;
  if (!e || B.levels.muted || pageHidden()) return;
  try {
    e.sfx(id);
  } catch {
    /* 무시 */
  }
}

/** 대사 타자음 — 화자 '종류'만 본다(용의자 넷은 같은 음색) */
export function playBlip(who: Speaker): void {
  const id = blipFor(who);
  if (id) playSfx(id);
}

/** 판정이 화면에 뜨는 순간. 돌파면 그 증언이 끝날 때까지 추격 곡 */
export function playVerdict(kind: VerdictSound, tier?: 'star' | 'minor', tutorial?: boolean): void {
  const s = B.scene;
  if (kind === 'BREAK' && s?.view === 'play' && s.screen === 'testimony' && s.setId) B.pursuit = s.setId;
  const e = B.engine;
  if (e && !B.levels.muted && !pageHidden()) {
    try {
      e.verdict(verdictCue(kind, tier, tutorial));
    } catch {
      /* 무시 */
    }
  }
  pushCue();
}

function sceneKey(s: Scene): string {
  return [s.ready ? 1 : 0, s.view, s.screen ?? '', s.setId ?? '', s.setKind ?? '', s.phase ?? '', s.actions ?? '', s.ending ?? ''].join('|');
}

/** 이 이벤트가 '사용자 활성화'인가 — 아니면(터치 pointerdown · Esc) 컨텍스트를 만들지 않고 다음 이벤트(pointerup · touchend)를 기다린다 */
function activates(e: Event): boolean {
  const pt = (e as PointerEvent).pointerType;
  if (e.type === 'pointerdown' && pt && pt !== 'mouse') return false;
  const ua = typeof navigator !== 'undefined' ? (navigator as Navigator & { userActivation?: { isActive: boolean } }).userActivation : undefined;
  if (ua && !ua.isActive) return false;
  return true;
}

/** 앱 루트에서 한 번 — 장면 → 곡, 설정 → 음량, 제스처 · 가시성 → 언락 · 잠재우기 */
export function useGameAudio(scene: Scene, s: Pick<Settings, 'bgm' | 'sfx' | 'muted'>): void {
  useEffect(() => {
    B.mounted += 1;
    B.engine?.acquire();
    const onGesture = (e: Event) => {
      if (activates(e)) unlockAudio();
    };
    const onVis = () => B.engine?.setHidden(pageHidden());
    const onHide = () => B.engine?.setHidden(true);
    const opts = { capture: true, passive: true } as const;
    window.addEventListener('pointerdown', onGesture, opts);
    window.addEventListener('pointerup', onGesture, opts);
    window.addEventListener('touchend', onGesture, opts);
    window.addEventListener('keydown', onGesture, opts);
    document.addEventListener('visibilitychange', onVis);
    window.addEventListener('pagehide', onHide);
    window.addEventListener('pageshow', onVis);
    return () => {
      window.removeEventListener('pointerdown', onGesture, opts);
      window.removeEventListener('pointerup', onGesture, opts);
      window.removeEventListener('touchend', onGesture, opts);
      window.removeEventListener('keydown', onGesture, opts);
      document.removeEventListener('visibilitychange', onVis);
      window.removeEventListener('pagehide', onHide);
      window.removeEventListener('pageshow', onVis);
      B.mounted = Math.max(0, B.mounted - 1);
      if (B.mounted === 0) {
        B.pursuit = null;
        B.scene = null;
        B.engine?.release();
      }
    };
  }, []);

  useEffect(() => {
    B.levels = { bgm: s.bgm, sfx: s.sfx, muted: s.muted };
    B.engine?.setLevels(s.bgm, s.sfx, s.muted);
  }, [s.bgm, s.sfx, s.muted]);

  const key = sceneKey(scene);
  const sceneRef = useRef(scene);
  sceneRef.current = scene;
  useEffect(() => {
    const sc = sceneRef.current;
    B.scene = sc;
    // 추격 곡은 돌파를 본 그 증언 안에서만 — 다른 화면으로 가면 끝
    if (B.pursuit && !(sc.view === 'play' && sc.screen === 'testimony' && sc.setId === B.pursuit)) B.pursuit = null;
    pushCue();
  }, [key]);
}

/**
 * 값이 false → true 로 바뀌는 순간 효과음. armed 가 꺼져 있던 동안의 변화와 첫 동기화는 무음
 * (새로고침 · 이어하기 직후 복원 때 효과음이 쏟아지지 않게).
 */
export function useSfxOnRise(on: boolean, id: SfxId, armed = true): void {
  const prev = useRef<boolean | null>(null);
  useEffect(() => {
    if (!armed) {
      prev.current = null;
      return;
    }
    if (prev.current === null) {
      prev.current = on;
      return;
    }
    if (on && !prev.current) playSfx(id);
    prev.current = on;
  }, [on, armed, id]);
}
