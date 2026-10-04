// @vitest-environment jsdom
/**
 * QA 설계자 코드 리뷰 회귀 테스트(2026-10-04) — 리뷰에서 재현한 버그가 다시 생기지 않게 막는다.
 *  R1 도감: 오인 체포 칸의 '위치'로 범인이 소거되지 않는다(본 칸이 먼저, 순서가 인물 순서를 따르지 않는다).
 *  R2 행동 0(마지막 행동으로 들어온 장소): 정밀 조사를 누르면 「0 → −1」 비용 프롬프트 대신 안내만.
 *  R3 행동 0(마지막 행동으로 연 증언)에서 돌파 → 결과 카드 [바로 가기]가 유료 대상이면 프롬프트 없이 안내만.
 *  R4 행동 0 대상 안에서 수첩 정리 메모 [그 장소로/그 증언으로]를 눌러도 사이렌이 울리지 않는다(나가기만 사이렌).
 *  R5 저장의 화면 앵커 종류가 어긋나면(심문 화면 + 장소 id) 폐기 — 앱이 죽지 않는다.
 *  R6 레일 칩 빠른 연타(패닝 중)로 같은 핫스팟이 두 번 열려 획득 카드·기기 로그가 사라지지 않는다.
 */
import { act, cleanup, fireEvent, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  CASE,
  STORAGE_KEYS,
  enterLocation,
  examine,
  exit,
  hint,
  newRun,
  openSet,
  type RunState,
} from '@/lib/witness';
import { CollectionView } from './components/Collection';
import { BackStackProvider } from './lib/BackStack';
import { WtContext, type WtCtx } from './lib/context';
import { fxConfig } from './lib/fx';
import { WitnessApp } from './screens/WitnessApp';
import { click, flush, gotoLine, presentUI, q, qa, readRun, settle } from './testkit';

const ALL_COACH = ['firstDot', 'acquire', 'freeLook', 'lineNav', 'press', 'present', 'result', 'hudTour', 'hubLegend', 'firstSpend', 'firstHalf', 'firstRedirect', 'firstWrong', 'firstQuestion', 'firstStar', 'firstUpgrade', 'firstTrust1', 'hintAdvice', 'sheetTip1', 'sheetTip2', 'sheetTip3', 'timelineNote'];

function seed(run: RunState, meta: Record<string, unknown> = {}): void {
  window.localStorage.setItem(STORAGE_KEYS.run, JSON.stringify(run));
  window.localStorage.setItem(
    STORAGE_KEYS.meta,
    JSON.stringify({ v: 1, plays: 1, endings: [], secrets: [], achievements: [], readLines: [], settings: { speed: 'instant' }, coach: ALL_COACH, ...meta }),
  );
}

async function boot(): Promise<void> {
  render(<WitnessApp />);
  await flush();
  await flush();
  const resume = q('[data-testid=title-resume]');
  if (resume) click(resume, '이어하기');
  await settle();
}

const must = (s: { run: RunState; error?: string }): RunState => {
  if (s.error) throw new Error(`엔진 오류: ${s.error}`);
  return s.run;
};
const base = (): RunState => newRun({ now: Date.now(), skipTutorial: true });
const toasts = (): string => qa('.wt-toast').map((t) => t.textContent ?? '').join(' | ');

beforeEach(() => {
  window.localStorage.clear();
  window.sessionStorage.clear();
  fxConfig.scale = 0;
});
afterEach(() => {
  cleanup();
  fxConfig.scale = 1;
});

describe('R1 도감 — 오인 체포 칸 위치로 범인이 드러나지 않는다', () => {
  const ctx = { game: { reducedMotion: true, meta: { coach: [] } }, fx: 'reduced' } as unknown as WtCtx;
  const layoutFor = (endings: string[]): string[] => {
    const meta = { v: 1, plays: endings.length, endings, secrets: [], achievements: [], readLines: [], settings: {}, coach: [] };
    const { unmount } = render(
      <BackStackProvider>
        <WtContext.Provider value={ctx}>
          <CollectionView open meta={meta as never} onClose={() => {}} onCaseFile={() => {}} />
        </WtContext.Provider>
      </BackStackProvider>,
    );
    const out = qa('.wt-coll-grid .wt-coll-item').map((li) => `${li.getAttribute('data-got') ?? '-'}:${li.querySelector('small')?.textContent ?? ''}`);
    unmount();
    return out;
  };

  it('오인 체포 하나만 본 도감은 누구를 잘못 지목했든 칸 배치가 같다', () => {
    const innocents = (['S1', 'S2', 'S3', 'S4'] as const).filter((s) => s !== CASE.solution.culprit);
    const layouts = innocents.map((s) => layoutFor([`wrong-${s}`]));
    for (const l of layouts) expect(l).toEqual(layouts[0]);
    // 본 오인 체포 칸은 오인 체포 칸들 중 맨 앞
    const firstWrong = layouts[0].findIndex((x) => x.endsWith('오인 체포'));
    expect(layouts[0][firstWrong].startsWith('1:')).toBe(true);
  });

  it('두 개를 봐도 배치는 인물 순서와 무관하다', () => {
    const innocents = (['S1', 'S2', 'S3', 'S4'] as const).filter((s) => s !== CASE.solution.culprit);
    const a = layoutFor([`wrong-${innocents[0]}`, `wrong-${innocents[2]}`]);
    const b = layoutFor([`wrong-${innocents[1]}`, `wrong-${innocents[2]}`]);
    expect(a).toEqual(b);
  });
});

describe('R2·R3·R4 — 행동 0(마지막 행동 대상 안) 경계', () => {
  it('R2 마지막 행동으로 들어온 장소: 정밀 조사는 비용 프롬프트(0 → −1) 없이 안내만, 행동·증거 그대로', async () => {
    const precise = CASE.locations.find((l) => l.initial && l.cost === 1 && l.hotspots.some((h) => h.precise && !h.unlock))!;
    let r = { ...base(), actions: 1 };
    r = must(enterLocation(r, precise.id));
    expect(r.actions).toBe(0);
    expect(r.final).toEqual([precise.id]);
    seed(r);
    await boot();
    const h = precise.hotspots.find((x) => x.precise)!;
    click(q(`.wt-railchip[data-hid="${h.id}"]`), '정밀 조사 칩');
    await flush(5);
    expect(q('[data-testid=spend-yes]')).toBeNull();
    expect(document.body.textContent).not.toContain('0 → -1');
    expect(toasts()).toMatch(/행동/);
    const after = readRun()!;
    expect(after.actions).toBe(0);
    expect(after.visited).not.toContain(h.id);
    expect(after.phase).toBe('play');
    expect(q('.wt-rail')).toBeTruthy();
  });

  it('R3 마지막 행동으로 연 증언에서 ◆ 돌파 → [바로 가기](유료 새 증언)는 프롬프트 없이 안내, 세트에 그대로', async () => {
    // C03: T03 줄에 E13(주방) → 새 증언 T08(행동 1) 해금
    let r = base();
    r = must(enterLocation(r, 'L1'));
    r = must(examine(r, 'L1.h2'));
    r = must(exit(r));
    r = { ...r, actions: 1 };
    r = must(openSet(r, 'T03'));
    expect(r.actions).toBe(0);
    seed(r);
    await boot();
    expect(q('.wt-test-panel')).toBeTruthy();
    const idx = CASE.sets.find((s) => s.id === 'T03')!.lines.findIndex((l) => l.breaks?.some((b) => b.id === 'C03'));
    await gotoLine(idx);
    // presentUI 는 결과 카드를 settle 로 [계속] 눌러 버리므로 직접 낸다
    click(q('[data-testid=present]'), '제시');
    await flush();
    const card = qa('.wt-sheet button.wt-card-hit').find((b) => (b.getAttribute('aria-label') ?? '').startsWith(CASE.evidence.find((e) => e.id === 'E13')!.name));
    click(card ?? null, 'E13 카드');
    await flush();
    click([...document.querySelectorAll('button')].find((b) => b.textContent?.includes('이걸로!')) ?? null, '이걸로');
    for (let i = 0; i < 40 && !q('[data-testid=result-goto]'); i++) {
      const tap = q('.wt-dialogue-tap');
      if (tap) fireEvent.click(tap);
      await flush(3);
    }
    expect(readRun()!.broken).toContain('C03');
    click(q('[data-testid=result-goto]'), '바로 가기');
    await flush(5);
    expect(q('[data-testid=spend-yes]')).toBeNull();
    expect(document.body.textContent).not.toContain('0 → -1');
    expect(toasts()).toContain('사이렌');
    const after = readRun()!;
    expect(after.phase).toBe('play');
    expect(after.screen).toMatchObject({ name: 'testimony', ref: 'T03' });
    expect(after.opened).not.toContain('T08');
  });

  it('R4 행동 0 대상 안에서 수첩 정리 메모의 [그 장소로]를 눌러도 사이렌이 울리지 않는다', async () => {
    let r = base();
    r = must(hint(r));
    expect(r.hintLog?.[0]?.target).toBeTruthy();
    r = { ...r, actions: 1 };
    r = must(openSet(r, 'T01'));
    expect(r.actions).toBe(0);
    seed(r);
    await boot();
    expect(q('.wt-test-panel')).toBeTruthy();
    click(q('button[aria-label^="수첩"]'), '수첩 버튼');
    await flush();
    click(q('[data-testid=nbtab-questions]'), '의문 탭');
    await flush();
    const go = qa('.wt-memo button')[0];
    click(go ?? null, '메모 바로 가기');
    await flush(5);
    const after = readRun()!;
    expect(after.phase).toBe('play');
    expect(after.screen).toMatchObject({ name: 'testimony', ref: 'T01' });
    expect(q('.wt-siren')).toBeNull();
    expect(toasts()).toContain('사이렌');
  });
});

describe('R5 저장 화면 앵커 — 종류가 어긋나면 폐기(앱이 죽지 않는다)', () => {
  it('심문 화면인데 ref 가 장소 id → 이어하기 없이 안내 띠, 오류 경계로 가지 않는다', async () => {
    const r = { ...base(), screen: { name: 'testimony', ref: 'L1', line: 0 } } as unknown as RunState;
    seed(r);
    render(<WitnessApp />);
    await flush();
    await flush();
    expect(q('[data-testid=title-resume]')).toBeNull();
    expect(q('.wt-banner')).toBeTruthy();
    expect(window.localStorage.getItem(STORAGE_KEYS.run)).toBeNull();
  });

  it('조사 화면인데 ref 가 세트 id → 폐기', async () => {
    const r = { ...base(), screen: { name: 'location', ref: 'T01' } } as unknown as RunState;
    seed(r);
    render(<WitnessApp />);
    await flush();
    await flush();
    expect(q('[data-testid=title-resume]')).toBeNull();
  });
});

describe('R6 레일 칩 연타(패닝 중)', () => {
  it('같은 칩을 빠르게 두 번 눌러도 기기 로그·획득 카드가 사라지지 않는다', async () => {
    const loc = CASE.locations.find((l) => l.id === 'L1')!;
    const h = loc.hotspots.find((x) => !x.precise && !x.unlock && (x.gives?.length ?? 0) > 0)!;
    let r = base();
    r = must(enterLocation(r, loc.id));
    seed(r);
    await boot();
    expect(q('.wt-rail')).toBeTruthy();
    fxConfig.scale = 1; // 레일 패닝 지연(220ms)을 켠다
    const chip = q(`.wt-railchip[data-hid="${h.id}"]`);
    fireEvent.click(chip!);
    await flush(30);
    fireEvent.click(q(`.wt-railchip[data-hid="${h.id}"]`)!);
    await act(async () => {
      await new Promise((res) => setTimeout(res, 500));
    });
    fxConfig.scale = 0;
    expect(readRun()!.visited).toContain(h.id);
    // 대사를 넘기면 기기 로그 시트(기기) 또는 획득 카드가 나와야 한다
    let sawAcquire = false;
    for (let i = 0; i < 30; i++) {
      if (q('.wt-sheet--log') || q('.wt-acquire-ok')) {
        sawAcquire = true;
        break;
      }
      const tap = q('.wt-dialogue-tap');
      if (tap) fireEvent.click(tap);
      await flush(5);
    }
    expect(sawAcquire).toBe(true);
  });
});
