// @vitest-environment jsdom
/**
 * 소리 연결(화면) — 가짜 AudioContext 로 앱 전체를 돌려 본다.
 *  - 제스처 전에는 AudioContext 를 만들지 않는다 / 첫 제스처에 1개만 만들고 엔진을 지연 로딩한다 / 터치 pointerdown 은 활성화가 아니라 건너뛴다
 *  - 첫 제스처가 '소리 끄기' 탭이면 엔진이 로드되자마자 잠든다(타이머 0)
 *  - 인트로 · 규칙 카드에도 소리 토글이 있다(1회차는 인트로를 건너뛸 수 없다)
 *  - 음소거 · 단계 저장/복원(토글 · 설정 시트)
 *  - 탭 숨김 → 재우기, 다시 보이면 깨우기(음소거면 그대로)
 *  - 새로고침 · 이어하기 직후 복원 때 효과음이 쏟아지지 않는다(첫 동기화 무음) — 그 뒤 바뀐 순간엔 울린다
 *  - 돌파 → 그 증언이 끝날 때까지 추격 곡, 다른 화면으로 가면 원래 곡
 *  - StrictMode 이중 마운트 · 언마운트에서 타이머가 남지 않는다
 */
import { act, cleanup, fireEvent, render, renderHook } from '@testing-library/react';
import { StrictMode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CASE, STORAGE_KEYS, loadMeta, openStorage, roomStatus, type RunState } from '@/lib/witness';
import { playPath } from '@/lib/witness/validate';
import { fxConfig } from '../lib/fx';
import { WitnessApp } from '../screens/WitnessApp';
import { click, flush, q, settle, spendIfAsked } from '../testkit';
import type { Scene } from './cues';
import { AudioEngine } from './engine';
import { FakeContext } from './fakeAudio';
import { __audioBridge as B, playVerdict, useGameAudio } from './useGameAudio';

const ALL_COACH = ['firstDot', 'acquire', 'freeLook', 'lineNav', 'press', 'present', 'result', 'hudTour', 'hubLegend', 'firstSpend', 'firstHalf', 'firstRedirect', 'firstWrong', 'firstQuestion', 'firstStar', 'firstUpgrade', 'firstTrust1', 'hintAdvice', 'sheetTip1', 'sheetTip2', 'sheetTip3', 'timelineNote'];

function seed(run: RunState | null, settings: Record<string, unknown> = {}): void {
  if (run) window.localStorage.setItem(STORAGE_KEYS.run, JSON.stringify(run));
  window.localStorage.setItem(
    STORAGE_KEYS.meta,
    JSON.stringify({ v: 1, plays: 1, endings: [], secrets: [], achievements: [], readLines: [], settings: { speed: 'instant', ...settings }, coach: ALL_COACH }),
  );
}

function setVisibility(v: 'visible' | 'hidden'): void {
  Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => v });
  act(() => {
    document.dispatchEvent(new Event('visibilitychange'));
  });
}

/** 동적 import(엔진 청크)가 끝날 때까지 */
async function engineReady(): Promise<AudioEngine> {
  for (let i = 0; i < 50 && !B.engine; i++) await flush(5);
  expect(B.engine).toBeTruthy();
  return B.engine!;
}

async function boot(el = <WitnessApp />) {
  const r = render(el);
  await flush();
  await flush();
  return r;
}

beforeEach(() => {
  window.localStorage.clear();
  window.sessionStorage.clear();
  fxConfig.scale = 0;
  FakeContext.instances = [];
  Object.assign(B, { ctx: null, engine: null, loading: false, failed: false, scene: null, pursuit: null });
  (window as unknown as { AudioContext?: unknown }).AudioContext = FakeContext;
  setVisibility('visible');
});
afterEach(() => {
  cleanup();
  B.engine?.release();
  vi.restoreAllMocks();
  fxConfig.scale = 1;
  delete (window as unknown as { AudioContext?: unknown }).AudioContext;
});

describe('제스처 전에는 AudioContext 를 만들지 않는다', () => {
  it('렌더 · 하이드레이션만으로는 0개, 첫 pointerdown 에 1개(resume + 무음 버퍼 1회), 이후 제스처에도 1개', async () => {
    await boot();
    expect(FakeContext.instances.length).toBe(0);
    fireEvent.pointerDown(document.body);
    expect(FakeContext.instances.length).toBe(1);
    const ctx = FakeContext.instances[0];
    expect(ctx.calls).toContain('resume');
    expect(ctx.sources.some((s) => s.kind === 'buffer' && s.started === 0)).toBe(true);
    const e = await engineReady();
    expect(e.track).toBe('title');
    fireEvent.pointerDown(document.body);
    fireEvent.keyDown(window, { key: 'a' });
    expect(FakeContext.instances.length).toBe(1);
  });

  it('음소거 상태로 저장돼 있으면 제스처가 와도 만들지 않고, 소리 켜기 탭에서 연다', async () => {
    seed(null, { muted: true });
    await boot();
    fireEvent.pointerDown(document.body);
    expect(FakeContext.instances.length).toBe(0);
    const t = q('[data-testid=sound-toggle]')!;
    // 토글 버튼 이름은 고정, 상태는 aria-pressed 로만(WAI-ARIA)
    expect(t.getAttribute('aria-label')).toBe('소리 끄기');
    expect(t.getAttribute('aria-pressed')).toBe('true');
    click(t);
    await flush();
    expect(FakeContext.instances.length).toBe(1);
    await engineReady();
    expect(q('[data-testid=sound-toggle]')!.getAttribute('aria-label')).toBe('소리 끄기');
    expect(q('[data-testid=sound-toggle]')!.getAttribute('aria-pressed')).toBe('false');
  });

  it('터치의 pointerdown 은 사용자 활성화가 아니라 건너뛰고, 이어지는 pointerup 에서 만든다', async () => {
    await boot();
    const down = new Event('pointerdown', { bubbles: true });
    Object.defineProperty(down, 'pointerType', { value: 'touch' });
    document.body.dispatchEvent(down);
    expect(FakeContext.instances.length).toBe(0);
    const up = new Event('pointerup', { bubbles: true });
    Object.defineProperty(up, 'pointerType', { value: 'touch' });
    document.body.dispatchEvent(up);
    expect(FakeContext.instances.length).toBe(1);
    await engineReady();
  });

  it('첫 제스처가 「소리 끄기」 탭이면: 엔진이 로드되자마자 컨텍스트를 재우고 타이머를 켜지 않는다', async () => {
    await boot();
    const t = q('[data-testid=sound-toggle]')!;
    fireEvent.pointerDown(t);
    click(t);
    await flush();
    const e = await engineReady();
    const ctx = FakeContext.instances[0];
    expect(loadMeta(openStorage().storage).settings.muted).toBe(true);
    expect(ctx.calls[ctx.calls.length - 1]).toBe('suspend');
    expect(e.stats.timer).toBe(false);
    expect(e.track).toBe('title');
  });

  it('AudioContext 가 없는 브라우저에서도 게임은 그대로(조용히 포기)', async () => {
    delete (window as unknown as { AudioContext?: unknown }).AudioContext;
    await boot();
    fireEvent.pointerDown(document.body);
    click(q('[data-testid=title-new]'));
    await flush();
    expect(B.failed).toBe(true);
    expect(document.querySelector('.wt-screen')).toBeTruthy();
  });
});

describe('음소거 · 단계 — 저장과 복원', () => {
  it('토글: 즉시 저장되고, 새로 열어도 그대로', async () => {
    const r = await boot();
    fireEvent.pointerDown(document.body);
    const e = await engineReady();
    const spy = vi.spyOn(e, 'setLevels');
    click(q('[data-testid=sound-toggle]'));
    await flush();
    expect(loadMeta(openStorage().storage).settings.muted).toBe(true);
    expect(spy).toHaveBeenLastCalledWith(2, 2, true);
    r.unmount();
    await boot();
    const t = q('[data-testid=sound-toggle]')!;
    expect(t.getAttribute('aria-pressed')).toBe('true');
    expect(t.getAttribute('aria-label')).toBe('소리 끄기');
  });

  it('인트로 컷 · 규칙 카드에서도 바로 끌 수 있다(1회차는 인트로 건너뛰기가 없다)', async () => {
    await boot();
    click(q('[data-testid=title-new]'));
    await flush();
    expect(q('.wt-intro')).toBeTruthy();
    expect(q('[data-testid=intro-skip]')).toBeNull();
    click(q('.wt-intro [data-testid=sound-toggle]'));
    await flush();
    expect(loadMeta(openStorage().storage).settings.muted).toBe(true);
    // 컷을 끝까지 넘겨 규칙 카드로
    await settle();
    expect(q('.wt-rules-screen')).toBeTruthy();
    const rt = q('.wt-rules-screen [data-testid=sound-toggle]')!;
    expect(rt.getAttribute('aria-pressed')).toBe('true');
    click(rt);
    await flush();
    expect(loadMeta(openStorage().storage).settings.muted).toBe(false);
  });

  it('설정 시트 「소리」: 배경음악 · 효과음 4단계 + 전체 끄기', async () => {
    await boot();
    click(q('[data-testid=title-settings]'));
    await flush();
    expect(document.body.textContent).toContain('소리');
    click(q('[data-testid=set-bgm-3]'));
    click(q('[data-testid=set-sfx-0]'));
    click(q('[data-testid=set-mute]'));
    await flush();
    const st = loadMeta(openStorage().storage).settings;
    expect(st).toMatchObject({ bgm: 3, sfx: 0, muted: true });
    for (const v of ['0', '1', '2', '3']) expect(q(`[data-testid=set-bgm-${v}]`)).toBeTruthy();
  });

  it('옛 저장(소리 필드 없음)은 보통 · 보통 · 켬으로 연다', async () => {
    window.localStorage.setItem(STORAGE_KEYS.meta, JSON.stringify({ v: 1, plays: 2, endings: ['perfect'], secrets: [], achievements: [], readLines: [], settings: { speed: 'fast', text: 'l', haptics: false }, coach: [] }));
    await boot();
    fireEvent.pointerDown(document.body);
    const e = await engineReady();
    expect(B.levels).toEqual({ bgm: 2, sfx: 2, muted: false });
    expect(e.bgmLevel).toBeTruthy();
    expect(q('[data-testid=sound-toggle]')!.getAttribute('aria-pressed')).toBe('false');
  });
});

describe('가시성 · 수명주기', () => {
  it('숨기면 재우고, 다시 보이면 깨운다 · 음소거면 깨우지 않는다', async () => {
    await boot();
    fireEvent.pointerDown(document.body);
    const e = await engineReady();
    const ctx = FakeContext.instances[0];
    setVisibility('hidden');
    expect(ctx.calls[ctx.calls.length - 1]).toBe('suspend');
    expect(e.stats.timer).toBe(false);
    setVisibility('visible');
    expect(ctx.calls[ctx.calls.length - 1]).toBe('resume');
    click(q('[data-testid=sound-toggle]'));
    await flush(150);
    setVisibility('hidden');
    ctx.calls = [];
    setVisibility('visible');
    expect(ctx.calls).not.toContain('resume');
    act(() => {
      window.dispatchEvent(new Event('pagehide'));
    });
    expect(e.stats.timer).toBe(false);
  });

  it('StrictMode 이중 마운트 → 언마운트: 곡이 멈추고 타이머가 남지 않는다 · 다시 마운트하면 이어서 깨운다', async () => {
    const r = await boot(
      <StrictMode>
        <WitnessApp />
      </StrictMode>,
    );
    expect(B.mounted).toBe(1);
    fireEvent.pointerDown(document.body);
    const e = await engineReady();
    expect(e.track).toBe('title');
    expect(e.stats.timer).toBe(true);
    r.unmount();
    expect(B.mounted).toBe(0);
    expect(e.track).toBeNull();
    expect(e.stats.timer).toBe(false);
    await boot();
    expect(B.mounted).toBe(1);
    expect(e.track).toBe('title');
  });
});

describe('복원 직후 효과음 폭주 없음', () => {
  it('사이렌 판을 이어하기: 첫 동기화는 무음(사이렌음 없음), 그 뒤 수첩을 열면 종이 소리', async () => {
    const base = playPath(['L3', 'T05']);
    seed({ ...base, actions: 0, phase: 'siren', final: [], screen: { name: 'siren' } });
    await boot();
    fireEvent.pointerDown(document.body);
    const e = await engineReady();
    const sfx = vi.spyOn(e, 'sfx');
    click(q('[data-testid=title-resume]'), '이어하기');
    await flush();
    await flush();
    expect(q('.wt-siren')).toBeTruthy();
    // 누른 버튼의 탭음 하나뿐 — 상태 복원으로 쏟아지는 소리(사이렌 · 틱 · 픽업 …)는 없다
    expect(sfx.mock.calls.map((c) => c[0])).toEqual(['tap']);
    sfx.mockClear();
    expect(e.track).toBe('accuse');
    const nb = [...document.querySelectorAll<HTMLButtonElement>('.wt-siren button')].find((b) => b.textContent?.includes('수첩'));
    click(nb ?? null, '수첩');
    await flush();
    expect(sfx.mock.calls.map((c) => c[0])).toEqual(['paper']);
  });

  it('허브(남은 행동 4)로 복원: 무음 → 유료 장소에 들어가면 시계 틱이 아니라 행동 3 경고 한 번 · 긴장 레이어', async () => {
    const base = playPath(['L3', 'T05']);
    seed({ ...base, actions: 4, screen: { name: 'hub', tab: 'house' } });
    await boot();
    fireEvent.pointerDown(document.body);
    const e = await engineReady();
    const sfx = vi.spyOn(e, 'sfx');
    click(q('[data-testid=title-resume]'), '이어하기');
    await flush();
    await flush();
    expect(sfx.mock.calls.map((c) => c[0])).toEqual(['tap']);
    sfx.mockClear();
    expect(e.track).toBe('investigate');
    expect(e.tension).toBe(false);
    // 아직 안 간 유료 장소 하나로
    const run = { ...base, actions: 4 };
    const loc = CASE.locations.find((l) => {
      const st = roomStatus(run, l.id);
      return st.cost > 0 && st.state !== 'locked' && st.state !== 'siren';
    });
    expect(loc).toBeTruthy();
    click(q(`[data-testid=room-${loc!.id}]`), '방');
    await spendIfAsked();
    await flush();
    const names = sfx.mock.calls.map((c) => c[0]);
    expect(names).toContain('siren');
    expect(names).not.toContain('tick');
    expect(e.tension).toBe(true);
  });
});

describe('돌파 → 추격 곡(그 증언이 끝날 때까지)', () => {
  it('증언 화면에서 돌파가 뜨면 추격 곡, 허브로 나가면 수사 곡, 같은 세트에 다시 들어가도 증언 곡부터', async () => {
    const ctx = new FakeContext();
    ctx.state = 'running';
    B.ctx = ctx as unknown as AudioContext;
    B.engine = new AudioEngine(ctx as unknown as BaseAudioContext, { bgm: 2, sfx: 2, muted: false, seed: 1 });
    const lv = { bgm: 2 as const, sfx: 2 as const, muted: false };
    const test: Scene = { ready: true, view: 'play', screen: 'testimony', setId: 'T02', setKind: 'first', phase: 'play', actions: 8 };
    const hub: Scene = { ready: true, view: 'play', screen: 'hub', phase: 'play', actions: 8 };
    const h = renderHook(({ s }) => useGameAudio(s, lv), { initialProps: { s: test } });
    expect(B.engine.track).toBe('testimony');
    act(() => playVerdict('HALF'));
    expect(B.engine.track).toBe('testimony');
    act(() => playVerdict('BREAK', 'star'));
    expect(B.pursuit).toBe('T02');
    expect(B.engine.track).toBe('pursuit');
    h.rerender({ s: hub });
    expect(B.pursuit).toBeNull();
    expect(B.engine.track).toBe('investigate');
    h.rerender({ s: test });
    expect(B.engine.track).toBe('testimony');
    h.unmount();
  });
});
