// @vitest-environment jsdom
/**
 * 다시 하기 — 소리·토스트 연결(기존 audio/ 구조 그대로, 효과음 id 만 재사용).
 *  - 되감기: 종이 넘기는 소리(paper). 되감은 뒤 지목 조건(★3)이 닫혔으면 토스트 「지목 조건이 다시 닫혔어요」 1회.
 *  - 기억 판 시작: 줍는 소리(pickup). 처음부터 시작에는 없다.
 * 엔진의 gateClosed 는 엔진 테스트가 맡는다 — 여기서는 rewind 를 감싸 그 이벤트를 켜서 화면 번역만 본다.
 */
import { cleanup, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CASE, RECALL_ELIGIBLE, STORAGE_KEYS, applyResultToMeta, newMeta, serializeRun, setSlot, startAccuse, pickCulprit, submitAccusation, type Accusation, type RunState, type Step, type WitnessMeta } from '@/lib/witness';
import { playPath } from '@/lib/witness/validate';
import { fxConfig } from './lib/fx';
import { WitnessApp } from './screens/WitnessApp';
import { click, flush, q, qa } from './testkit';

const played: string[] = [];
let forceGateClosed = false;

vi.mock('./audio/useGameAudio', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./audio/useGameAudio')>();
  return { ...actual, playSfx: (id: string) => void played.push(id) };
});
vi.mock('@/lib/witness', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/witness')>();
  return {
    ...actual,
    rewind: (run: RunState): Step => {
      const s = actual.rewind(run);
      return forceGateClosed ? { ...s, events: s.events.map((e) => (e.t === 'rewound' ? { ...e, gateClosed: true } : e)) } : s;
    },
  };
});

const ALL_COACH = ['firstDot', 'acquire', 'freeLook', 'lineNav', 'press', 'present', 'result', 'hudTour', 'hubLegend', 'firstSpend', 'firstHalf', 'firstRedirect', 'firstWrong', 'firstQuestion', 'firstStar', 'firstUpgrade', 'firstTrust1', 'hintAdvice', 'sheetTip1', 'sheetTip2', 'sheetTip3', 'timelineNote', 'skipRead'];
const PERFECT_PATH = ['L3', 'T05', 'L1', 'T03', 'T02', 'L2', 'T04', 'P:L2.h3'];
const SOL = CASE.solution.accept;
const SHORT: Accusation = { culprit: CASE.solution.culprit, means: SOL.means[0], opportunity: SOL.opportunity[0], motive: 'E06' };

function judged(run: RunState, a: Accusation): RunState {
  let r = startAccuse(run).run;
  r = pickCulprit(r, a.culprit).run;
  for (const sl of ['means', 'opportunity', 'motive'] as const) r = setSlot(r, sl, a[sl]).run;
  const s = submitAccusation(r);
  expect(s.error).toBeUndefined();
  return s.run;
}
const baseMeta = (extra: Partial<WitnessMeta> = {}): WitnessMeta => ({ ...newMeta(), plays: 1, coach: ALL_COACH, settings: { ...newMeta().settings, speed: 'instant' }, ...extra });

beforeEach(() => {
  window.localStorage.clear();
  window.sessionStorage.clear();
  fxConfig.scale = 0;
  played.length = 0;
  forceGateClosed = false;
});
afterEach(() => {
  cleanup();
  fxConfig.scale = 1;
});

describe('되감기 소리·토스트', () => {
  const seedEnding = () => {
    const end = judged(playPath(PERFECT_PATH), SHORT);
    window.localStorage.setItem(STORAGE_KEYS.run, serializeRun(end));
    window.localStorage.setItem(STORAGE_KEYS.meta, JSON.stringify(applyResultToMeta(baseMeta({ plays: 0 }), end.result!, Date.now())));
  };

  it('되감기 → 종이 소리 · 지목 조건이 닫히지 않았으면 토스트 없음', async () => {
    seedEnding();
    render(<WitnessApp />);
    await flush();
    await flush();
    played.length = 0;
    click(q('[data-testid=ending-rewind]'));
    await flush();
    expect(played).toContain('paper');
    expect(qa('.wt-toast').some((t) => (t.textContent ?? '').includes('지목 조건이 다시 닫혔어요'))).toBe(false);
  });

  it('gateClosed 이벤트면 「지목 조건이 다시 닫혔어요」 토스트가 한 번 뜬다', async () => {
    forceGateClosed = true;
    seedEnding();
    render(<WitnessApp />);
    await flush();
    await flush();
    click(q('[data-testid=ending-rewind]'));
    await flush();
    expect(qa('.wt-toast').filter((t) => (t.textContent ?? '').includes('지목 조건이 다시 닫혔어요')).length).toBe(1);
  });
});

describe('기억 판 시작 소리', () => {
  const seedTitle = () => {
    window.localStorage.setItem(STORAGE_KEYS.meta, JSON.stringify(baseMeta({ plays: 2, found: [...RECALL_ELIGIBLE] })));
  };
  it('기억 이어가기 → pickup', async () => {
    seedTitle();
    render(<WitnessApp />);
    await flush();
    await flush();
    click(q('[data-testid=title-new]'));
    await flush();
    played.length = 0;
    click(q('[data-testid=start-recall]'));
    await flush();
    expect(played).toContain('pickup');
  });
  it('처음부터 → pickup 없음', async () => {
    seedTitle();
    render(<WitnessApp />);
    await flush();
    await flush();
    click(q('[data-testid=title-new]'));
    await flush();
    played.length = 0;
    click(q('[data-testid=start-fresh]'));
    await flush();
    expect(played).not.toContain('pickup');
  });
});
