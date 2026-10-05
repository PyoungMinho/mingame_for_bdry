// @vitest-environment jsdom
/**
 * 사이렌 경계 회귀 테스트 — 밸런스 v4 QA 지적(docs/qa/witness-bug-report.md §10).
 *  - QA-BAL-01: 행동 0 대상 안에서 수첩 '주장' 탭으로 다른 증언에 건너가지 않는다 / 행동 0 체크포인트로 되감으면 사이렌
 *  - QA-BAL-02: 사이렌 뒤 배제 → 되감기에서 사이렌 효과음이 다시 울리지 않는다
 *  - UX-2·3·4: 사이렌 뒤 허브 안내 줄 · 새로 열린 증언 점 · 「수사 종료」 시트
 */
import { cleanup, fireEvent, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { STORAGE_KEYS, enterLocation, hint, newRun, openSet, present, rewind, setStatus, type RunState } from '@/lib/witness';
import { applyItem, freeClosure, paidItems, playPath } from '@/lib/witness/validate';
import { AudioEngine } from './audio/engine';
import { FakeContext } from './audio/fakeAudio';
import { __audioBridge as B } from './audio/useGameAudio';
import { ACHIEVEMENT_INFO } from './lib/format';
import { fxConfig } from './lib/fx';
import { WitnessApp } from './screens/WitnessApp';
import { click, flush, gotoLine, presentUI, q, qa, readRun, settle } from './testkit';

const ALL_COACH = ['firstDot', 'acquire', 'freeLook', 'lineNav', 'press', 'present', 'result', 'hudTour', 'hubLegend', 'firstSpend', 'firstHalf', 'firstRedirect', 'firstWrong', 'firstQuestion', 'firstStar', 'firstUpgrade', 'firstTrust1', 'hintAdvice', 'sheetTip1', 'sheetTip2', 'sheetTip3', 'timelineNote'];

function seed(run: RunState): void {
  window.localStorage.setItem(STORAGE_KEYS.run, JSON.stringify(run));
  window.localStorage.setItem(STORAGE_KEYS.meta, JSON.stringify({ v: 1, plays: 1, endings: [], secrets: [], achievements: [], readLines: [], settings: { speed: 'instant' }, coach: ALL_COACH }));
}
async function boot(): Promise<void> {
  render(<WitnessApp />);
  await flush();
  await flush();
  click(q('[data-testid=title-resume]'), '이어하기');
  await settle();
}
async function engineReady(): Promise<AudioEngine> {
  for (let i = 0; i < 50 && !B.engine; i++) await flush(5);
  return B.engine!;
}

const items = paidItems();
function play(order: string[], hints = 0): RunState {
  let r = freeClosure(newRun({ now: Date.now(), skipTutorial: true }));
  for (let i = 0; i < hints; i++) r = hint(r).run;
  for (const k of order) {
    const a = applyItem(r, items.find((i) => i.key === k)!);
    if (a) r = freeClosure(a);
  }
  return r;
}
/** 행동 1 남기고 다 쓴 판 → 다용도실(L3)에 마지막 행동으로 들어감: phase play · 행동 0 · final [L3] */
function zeroInsideL3(): RunState {
  const r = play(['T01', 'L1', 'L2', 'T02', 'T03', 'T04', 'L4', 'T05', 'T06', 'P:L2.h3'], 2);
  expect(r.actions).toBe(1);
  const z = enterLocation(r, 'L3').run;
  expect(z).toMatchObject({ phase: 'play', actions: 0, final: ['L3'] });
  return z;
}

beforeEach(() => {
  window.localStorage.clear();
  window.sessionStorage.clear();
  fxConfig.scale = 0;
  FakeContext.instances = [];
  Object.assign(B, { ctx: null, engine: null, loading: false, failed: false, scene: null, pursuit: null });
  (window as unknown as { AudioContext: unknown }).AudioContext = FakeContext;
});
afterEach(() => {
  cleanup();
  B.engine?.release();
  vi.restoreAllMocks();
  fxConfig.scale = 1;
  delete (window as unknown as { AudioContext?: unknown }).AudioContext;
});

describe('QA-BAL-01 행동 0 대상 안', () => {
  it('수첩 타임라인 「주장」 탭 → 이동하지 않고 안내 토스트', async () => {
    seed(zeroInsideL3());
    await boot();
    const nbBtn = qa('button').find((b) => (b.getAttribute('aria-label') ?? '').includes('수첩'));
    click(nbBtn ?? null, '수첩');
    await flush();
    click(q('[data-testid=nbtab-timeline]'), '타임라인 탭');
    await flush();
    const claim = qa('.wt-tl-item[data-kind=claim]')[0];
    click(claim ?? null, '주장');
    await settle();
    expect(readRun()).toMatchObject({ phase: 'play', actions: 0, final: ['L3'], screen: { name: 'location', ref: 'L3' } });
    expect(qa('.wt-toast').map((t) => t.textContent).join(' ')).toContain('나가면 사이렌');
  });

  it('엔진: 행동 0 체크포인트에서 되감으면 사이렌으로(막힌 허브가 생기지 않는다)', () => {
    let r = openSet(zeroInsideL3(), 'T01').run; // 엔진 단독으로는 이미 연 증언에 들어갈 수 있다(체크포인트 = 행동 0·play)
    for (let i = 0; i < 5 && r.phase !== 'ended'; i++) r = present(r, 'T01.1', ['E01']).run;
    expect(r.result?.ending).toBe('excluded');
    const s = rewind(r);
    expect(s.error).toBeUndefined();
    expect(s.run).toMatchObject({ phase: 'siren', actions: 0, final: [], screen: { name: 'siren' } });
    expect(s.events).toContainEqual({ t: 'siren' });
  });

  it('화면: 배제 → [되감기] → 사이렌 화면 → [계속] → 허브에 [수사 종료] 또는 [지목하기]', async () => {
    let r = openSet(zeroInsideL3(), 'T01').run;
    for (let i = 0; i < 4; i++) r = present(r, 'T01.1', ['E01']).run;
    expect(r.trust).toBe(1);
    seed(r);
    await boot();
    await gotoLine(0);
    await presentUI(['E01']);
    await settle();
    expect(q('.wt-excluded')).toBeTruthy();
    click(q('[data-testid=excluded-rewind]'));
    await settle();
    expect(q('.wt-siren')).toBeTruthy();
    click(q('[data-testid=siren-continue]'));
    await flush();
    expect(q('.wt-screen--hub')).toBeTruthy();
    expect(q('[data-testid=end-investigation]') ?? q('[data-testid=accuse-bar]')).toBeTruthy();
  });
});

describe('QA-BAL-02 사이렌 효과음은 진입 때 한 번만', () => {
  it('사이렌 뒤 이미 연 증언에서 배제 → 되감기: 사이렌 효과음이 다시 울리지 않는다', async () => {
    let r = playPath(['L3', 'T05']);
    r = { ...r, actions: 0, phase: 'siren', final: [], screen: { name: 'hub', tab: 'people' } };
    r = openSet(r, 'T05').run;
    for (let i = 0; i < 4; i++) r = present(r, 'T05.1', ['E01']).run;
    expect(r).toMatchObject({ trust: 1, phase: 'siren' });
    seed(r);
    render(<WitnessApp />);
    await flush();
    await flush();
    fireEvent.pointerDown(document.body);
    const e = await engineReady();
    const sfx = vi.spyOn(e, 'sfx');
    click(q('[data-testid=title-resume]'), '이어하기');
    await settle();
    await gotoLine(0);
    await presentUI(['E01']);
    await settle();
    expect(q('.wt-excluded')).toBeTruthy();
    sfx.mockClear();
    click(q('[data-testid=excluded-rewind]'));
    await flush();
    await flush();
    expect(readRun()).toMatchObject({ phase: 'siren', actions: 0 });
    expect(sfx.mock.calls.map((c) => c[0])).not.toContain('siren');
  });
});

describe('UX 사이렌 뒤 허브', () => {
  const sirenHub = (path: string[]): RunState => ({ ...playPath(path), actions: 0, phase: 'siren', final: [], screen: { name: 'hub', tab: 'house' } });

  it('집 안 목표 줄 = 「사이렌 뒤 · 이미 연 곳은 다시 볼 수 있다 · ★ n개 더」(접힘과 무관)', async () => {
    seed(sirenHub(['L3', 'T05']));
    await boot();
    expect(q('[data-testid=siren-goal]')?.textContent).toBe('사이렌 뒤 · 이미 연 곳은 다시 볼 수 있다 · ★ 2개 더');
  });

  it('비용 0 새 증언이 열려 있으면 사람 탭에 점, 「수사 종료」 시트에 한 줄 · [끝낸다]는 위험 스타일', async () => {
    // 사이렌 뒤 T04 재방문에서 C08 을 깼고 「불 꺼진 서재」(T07, 비용 0)는 아직 안 열었다
    const base = sirenHub(['L2', 'T04']);
    const r: RunState = { ...base, opened: base.opened.filter((x) => x !== 'T07') };
    expect(setStatus(r, 'T07')).toMatchObject({ state: 'open', isNew: true });
    seed(r);
    await boot();
    expect(q('button[aria-label="사람 (새 증언 있음)"] .wt-dot')).toBeTruthy();
    click(q('[data-testid=end-investigation]'));
    await flush();
    const body = document.body.textContent ?? '';
    expect(body).toContain('끝내면 결과가 바로 나와요.');
    expect(q('[data-testid=end-newset]')?.textContent).toBe('새로 열린 증언이 있어요.');
    expect(q('[data-testid=end-yes]')?.className).toContain('wt-btn--danger');
    expect(document.activeElement?.textContent).toContain('더 본다');
  });

  it('새 증언이 없으면 점·한 줄이 없다', async () => {
    seed(sirenHub(['L3', 'T05']));
    await boot();
    expect(q('button[aria-label="사람 (새 증언 있음)"]')).toBeNull();
    click(q('[data-testid=end-investigation]'));
    await flush();
    expect(q('[data-testid=end-newset]')).toBeNull();
  });
});

describe('업적 문구', () => {
  it('「번개 수사」 설명은 엔진 기준(쓴 행동 ≤ 9 = 4 이상 남김)과 같다', () => {
    expect(ACHIEVEMENT_INFO.lightning.how).toBe('행동 4 이상 남기고 완벽 해결');
    expect(ACHIEVEMENT_INFO.lightning.how).not.toContain('3 이상');
  });
});
