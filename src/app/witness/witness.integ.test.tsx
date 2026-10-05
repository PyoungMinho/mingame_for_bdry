// @vitest-environment jsdom
/**
 * 그림(art/) ↔ 화면 통합 테스트 — 프론트팀장 통합 단계에서 붙인 연결만 확인한다.
 *  - 판정 연출이 그림 모듈의 사선 스트립 · 유리 균열 · 도장을 쓰고, 판정 순간 초상 표정이 바뀐다(★ → shock)
 *  - '줄이기'에서는 키프레임(.is-play)을 켜지 않는다(정지된 최종 모양 = 문구가 사라지지 않음)
 *  - 1회차 최종 판정에는 [전부 건너뛰기]가 없다(제출 순간 meta.plays 가 오르는 것과 무관하게)
 *  - 엔딩 등급 도장 · 도감 썸네일 · 기기 로그 시각 열 · 타이틀 진입 문구
 * 연출 타이밍을 보려고 fxConfig.scale 을 0.05 로 둔다(실제 타이머, 수십 ms).
 */
import { cleanup, fireEvent, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  CASE,
  STORAGE_KEYS,
  enterLocation,
  getEvidence,
  openSet,
  pickCulprit,
  setAccuseStage,
  setScreen,
  setSlot,
  startAccuse,
  type RunState,
} from '@/lib/witness';
import { playPath } from '@/lib/witness/validate';
import { fxConfig } from './lib/fx';
import { WitnessApp } from './screens/WitnessApp';
import { cardLabel, click, clickText, flush, gotoLine, q, qa, settle } from './testkit';

const ALL_COACH = ['firstDot', 'acquire', 'freeLook', 'lineNav', 'press', 'present', 'result', 'hudTour', 'hubLegend', 'firstSpend', 'firstHalf', 'firstRedirect', 'firstWrong', 'firstQuestion', 'firstStar', 'firstUpgrade', 'firstTrust1', 'hintAdvice', 'sheetTip1', 'sheetTip2', 'sheetTip3', 'timelineNote'];
const PATH = ['L3', 'T05', 'L1', 'T03', 'T02', 'L2', 'T04', 'P:L2.h3'];

function seed(run: RunState | null, meta: Record<string, unknown> = {}, settings: Record<string, unknown> = {}): void {
  if (run) window.localStorage.setItem(STORAGE_KEYS.run, JSON.stringify(run));
  window.localStorage.setItem(
    STORAGE_KEYS.meta,
    JSON.stringify({ v: 1, plays: 1, endings: [], secrets: [], achievements: [], readLines: [], settings: { speed: 'instant', ...settings }, coach: ALL_COACH, ...meta }),
  );
}

async function boot(): Promise<void> {
  render(<WitnessApp />);
  await flush();
  await flush();
  const resume = q('[data-testid=title-resume]');
  if (resume) {
    click(resume);
    await flush();
  }
}

/** 조건이 참이 될 때까지(실제 타이머) — 연출 단계 관찰용 */
async function until(pred: () => boolean, ms = 3000): Promise<boolean> {
  const t0 = Date.now();
  while (Date.now() - t0 < ms) {
    if (pred()) return true;
    await flush(5);
  }
  return pred();
}

/** 지금 화면에서 줄 idx 에 카드 1장을 낸다(연출은 기다리지 않는다) */
async function presentNoSettle(idx: number, cardId: string): Promise<void> {
  await gotoLine(idx);
  click(q('[data-testid=present]'), '증거 제시');
  await flush();
  const name = cardLabel(cardId);
  const btn = qa('.wt-sheet button.wt-card-hit').find((b) => (b.getAttribute('aria-label') ?? '').startsWith(name));
  click(btn ?? null, `카드 ${name}`);
  await flush();
  clickText('이걸로!');
}

/** T04 의 ★ 돌파 직전 상태(최적 경로 6수 뒤 T04 진입) + 그 줄·카드 */
function starSetup(): { run: RunState; idx: number; card: string } {
  const r = openSet(playPath(PATH.slice(0, 6)), 'T04').run;
  const set = CASE.sets.find((s) => s.id === 'T04')!;
  const idx = set.lines.findIndex((l) => l.breaks?.some((b) => b.tier === 'star' && b.evidence.every((c) => r.evidence.includes(c))));
  const brk = set.lines[idx].breaks!.find((b) => b.tier === 'star')!;
  return { run: setScreen(r, { name: 'testimony', ref: 'T04', line: 0 }), idx, card: brk.evidence[0] };
}

beforeEach(() => {
  window.localStorage.clear();
  window.sessionStorage.clear();
  fxConfig.scale = 0.05;
});
afterEach(() => {
  cleanup();
  fxConfig.scale = 1;
});

describe('판정 연출 ↔ 그림 모듈', () => {
  it('★ 돌파: 제시 스트립 → 균열 + ★ 스트립 + 결정적 도장, 판정 순간 초상이 shock', async () => {
    const { run, idx, card } = starSetup();
    expect(idx).toBeGreaterThanOrEqual(0);
    seed(run);
    await boot();
    await settle();
    expect(q('.wt-test-panel')).toBeTruthy();
    await presentNoSettle(idx, card);

    expect(await until(() => !!q('.wt-fx-strip[data-kind=present] svg.wt-art-cutin'))).toBe(true);
    expect(q('.wt-fx-strip[data-kind=present] svg.wt-art-cutin')?.classList.contains('is-play')).toBe(true);

    expect(await until(() => !!q('.wt-fx[data-verdict=BREAK][data-tier=star] .wt-fx-strip[data-kind=star]'))).toBe(true);
    expect(q('.wt-fx svg.wt-art-crack')).toBeTruthy();
    // 판정 확정 = 초상 표정 전환(돌파 → shock)
    expect(q('.wt-stage-slot[data-spk=S4] svg.wt-art-portrait')?.getAttribute('data-face')).toBe('shock');
    expect(await until(() => !!q('.wt-fx-stamp[data-kind=star] svg.wt-art-stamp'))).toBe(true);
    expect(q('.wt-fx-stamp[data-kind=star]')?.textContent).toContain('결정적');
    // 스크린 리더 한 문장
    expect(q('.wt-fx [role=alert]')?.textContent).toContain('결정적 모순 돌파');
  });

  it("화면 효과 '줄이기': 스트립·균열·도장이 키프레임 없이(정지 모양) 나온다", async () => {
    const { run, idx, card } = starSetup();
    seed(run, {}, { fx: 'reduced' });
    await boot();
    await settle();
    await presentNoSettle(idx, card);
    expect(await until(() => !!q('.wt-fx-strip[data-kind=star]'))).toBe(true);
    for (const el of qa('.wt-fx .wt-art-fx')) expect(el.classList.contains('is-play')).toBe(false);
    expect(document.querySelector('.wt-shell')?.getAttribute('data-fx')).toBe('reduced');
  });

  it('오답: 비웃음 오버레이(smirk) — 표정 전환이 판정 순간에 걸린다', async () => {
    const { run, idx, card } = starSetup();
    seed(run);
    await boot();
    await settle();
    // 정답이 아닌, 갖고 있는 다른 증거 하나
    const wrongId = run.evidence.find((id) => id !== card && getEvidence(id))!;
    await presentNoSettle(idx, wrongId);
    expect(await until(() => q('.wt-fx')?.getAttribute('data-verdict') === 'WRONG')).toBe(true);
    const smirkOn = () => {
      const g = q('.wt-stage-slot[data-spk=S4] [data-part="face-smirk"]');
      return !!g && g.getAttribute('display') !== 'none';
    };
    expect(smirkOn()).toBe(false);
    expect(await until(smirkOn)).toBe(true);
  });
});

describe('최종 판정 · 엔딩 · 도감', () => {
  function confirmState(): RunState {
    let a = startAccuse(playPath(PATH)).run;
    a = pickCulprit(a, CASE.solution.culprit).run;
    a = setSlot(a, 'means', CASE.solution.accept.means[0]).run;
    a = setSlot(a, 'opportunity', CASE.solution.accept.opportunity[0]).run;
    a = setSlot(a, 'motive', CASE.solution.accept.motive[0]).run;
    return setAccuseStage(a, 'confirm').run;
  }

  it('1회차 최종 판정엔 [전부 건너뛰기]가 없고, 2회차엔 있다', async () => {
    seed(confirmState(), { plays: 0 });
    await boot();
    click(q('[data-testid=confirm-submit]'), '이대로 넘긴다');
    await flush();
    expect(q('.wt-verdict')).toBeTruthy();
    expect(q('[data-testid=verdict-skip]')).toBeNull();
    cleanup();
    window.localStorage.clear();

    seed(confirmState(), { plays: 1 });
    await boot();
    click(q('[data-testid=confirm-submit]'), '이대로 넘긴다');
    await flush();
    expect(q('[data-testid=verdict-skip]')).toBeTruthy();
  });

  it('엔딩 등급 도장은 그림 모듈(GradeStamp), 도감엔 본 엔딩만 키아트 썸네일', async () => {
    seed(confirmState(), { plays: 0 });
    await boot();
    click(q('[data-testid=confirm-submit]'));
    await flush();
    // 탭 진행(칸마다 쾅 → 대사) — 대사창이 뜰 때마다 넘긴다
    expect(
      await until(() => {
        const tap = q('.wt-verdict .wt-dialogue-tap');
        if (tap) fireEvent.click(tap);
        return !!q('[data-testid=verdict-finish]');
      }, 5000),
    ).toBe(true);
    click(q('[data-testid=verdict-finish]'), '결과 보기');
    await flush();
    expect(await until(() => !!q('.wt-ending'))).toBe(true);
    clickText('결과 바로 보기');
    await flush();
    const grade = q('.wt-grade')?.getAttribute('data-grade');
    expect(grade).toMatch(/^[SABC]$/);
    expect(q(`.wt-grade svg.wt-art-stamp[data-grade="${grade}"]`)).toBeTruthy();

    click(q('[data-testid=ending-collection]'));
    await flush();
    expect(qa('.wt-coll-thumb').length).toBe(1);
    expect(q('.wt-coll-thumb .wt-art-ending')?.getAttribute('data-ending')).toBe('perfect');
    // 못 본 칸은 실루엣(그림 없음)
    expect(qa('.wt-coll-item:not([data-got]) .wt-art-ending').length).toBe(0);
  });
});

describe('기타 통합', () => {
  it('기기 로그: 시각이 없는 기록은 시각 열을 접는다', async () => {
    const mid = playPath(['L3', 'T05', 'L1']);
    seed(setScreen(enterLocation(mid, 'L2').run, { name: 'location', ref: 'L2' }));
    await boot();
    await settle();
    click(q('.wt-railchip[data-hid="L2.h1"]'), '조명 패널');
    await flush();
    // 기기 앞 대사(있으면)를 넘기면 로그 시트가 열린다
    expect(
      await until(() => {
        const tap = q('.wt-dialogue-tap');
        if (!q('.wt-sheet--log') && tap) fireEvent.click(tap);
        return !!q('.wt-sheet--log');
      }),
    ).toBe(true);
    const rows = q('.wt-sheet--log .wt-logrows');
    expect(rows).toBeTruthy();
    const ev = CASE.locations.find((l) => l.id === 'L2')!.hotspots.find((h) => h.id === 'L2.h1')!.gives![0];
    const lines = [getEvidence(ev)!.summary, ...getEvidence(ev)!.detail];
    const timed = lines.some((l) => /^\d{1,2}:\d{2}(?::\d{2})?\s/.test(l));
    expect(rows!.getAttribute('data-notime')).toBe(timed ? null : '1');
    expect(qa('.wt-sheet--log .wt-logtime').length).toBe(timed ? lines.length : 0);
  });

  it('타이틀 진입 문구: 첫 방문엔 훅 3줄(스포일러 없음), 저장이 있으면 이어하기 카드', async () => {
    render(<WitnessApp />);
    await flush();
    await flush();
    const hook = q('.wt-title-hook')?.textContent ?? '';
    expect(hook).toContain('용의자는 넷, 증인은 스피커 하나.');
    expect(hook).toContain('행동 13번');
    for (const s of ['S1', 'S2', 'S3', 'S4'] as const) expect(hook).not.toContain(CASE.names[s]);
    expect(document.body.textContent).toContain('혼자서');
    cleanup();

    seed(setScreen(playPath(['L3']), { name: 'hub', tab: 'house' }));
    render(<WitnessApp />);
    await flush();
    await flush();
    expect(q('.wt-title-hook')).toBeNull();
    expect(q('[data-testid=title-resume]')).toBeTruthy();
  });
});
