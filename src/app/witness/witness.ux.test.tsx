// @vitest-environment jsdom
/**
 * 블라인드 플레이어 UX 지적 회귀 테스트(프론트).
 *  ① HUD 안내 말풍선은 한 번 본 건 새로고침·이어하기 뒤에 다시 나오지 않는다(meta.coach 에 말풍선별로 기록)
 *  ② 증언·조사에서 나오면 허브가 마지막으로 보던 탭으로 돌아온다(새로고침해도)
 *  ③ 돌파 결과 카드는 닫기(X)·Esc 로 닫힌다(바깥 탭은 막는다) — 아무것도 잃지 않는다
 *  ④ 접근성: 이어하기·최종 지목 버튼과 범인 선택 라디오는 짧은 이름 + 설명, 라디오는 한 그룹 / ★ 직후 안내는 지연 없이
 *  ⑤ 저장 실패 토스트 1회 · 엔딩 등급 도장은 그림 밖 · 44px/14px
 *  ⑥ 템포: 기본 글자 속도 빠름 · 대사 길게 누르기 연속 넘김(마지막 줄에서 멈춤, 뗄 때 클릭 삼킴) · 키 반복 차단
 */
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { CASE, STORAGE_KEYS, newRun, openSet, setScreen, setStatus, stars, type Dialogue, type RunState } from '@/lib/witness';
import { playPath } from '@/lib/witness/validate';
import { COACH_TEXT, HUD_TOUR } from './lib/copy';
import { WtContext, type WtCtx } from './lib/context';
import { LONG_PRESS_MS, fxConfig } from './lib/fx';
import { nameOf } from './lib/format';
import { DialogueBox, HOLD_STEP_MS } from './components/DialogueBox';
import { HudBar } from './components/Hud';
import { WitnessApp } from './screens/WitnessApp';
import { click, clickText, enterRoom, exitToHub, flush, gotoLine, openSetUI, q, qa, readRun, settle, tab } from './testkit';

const ALL_COACH = ['firstDot', 'acquire', 'freeLook', 'lineNav', 'press', 'present', 'result', 'hudTour', 'hubLegend', 'firstSpend', 'firstHalf', 'firstRedirect', 'firstWrong', 'firstQuestion', 'firstStar', 'firstUpgrade', 'firstTrust1', 'hintAdvice', 'sheetTip1', 'sheetTip2', 'sheetTip3', 'timelineNote'];
const NO_TOUR = ALL_COACH.filter((c) => c !== 'hudTour' && c !== 'hubLegend');
const PATH = ['L3', 'T05', 'L1', 'T03', 'T02', 'L2', 'T04', 'P:L2.h3'];

function seed(run: RunState | null, meta: Record<string, unknown> = {}, settings: Record<string, unknown> = {}): void {
  if (run) window.localStorage.setItem(STORAGE_KEYS.run, JSON.stringify(run));
  window.localStorage.setItem(
    STORAGE_KEYS.meta,
    JSON.stringify({ v: 1, plays: 1, endings: [], secrets: [], achievements: [], readLines: [], settings: { speed: 'instant', ...settings }, coach: ALL_COACH, ...meta }),
  );
}

const metaCoach = (): string[] => (JSON.parse(window.localStorage.getItem(STORAGE_KEYS.meta) ?? '{}').coach ?? []) as string[];

async function boot(): Promise<void> {
  render(<WitnessApp />);
  await flush();
  await flush();
  const resume = q('[data-testid=title-resume]');
  if (resume) {
    click(resume, '이어하기');
    await flush();
  }
}

/** 새로고침 = 앱을 내렸다가 다시 올려 저장에서 이어하기 */
async function reload(): Promise<void> {
  cleanup();
  await boot();
}

const hubRun = (): RunState => newRun({ now: Date.now(), skipTutorial: true });

beforeEach(() => {
  window.localStorage.clear();
  window.sessionStorage.clear();
  fxConfig.scale = 0;
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.restoreAllMocks();
  fxConfig.scale = 1;
});

describe('① HUD 안내 말풍선 — 한 번 본 건 다시 안 나온다', () => {
  const bubble = () => q('.wt-coach p')?.textContent ?? null;

  it('새로고침·이어하기를 거칠 때마다 안 본 다음 말풍선부터 — 같은 말풍선이 반복되지 않고, 다 보면 더 안 나온다', async () => {
    seed(hubRun(), { coach: NO_TOUR });
    await boot();
    expect(bubble()).toBe(HUD_TOUR[0].text);
    expect(metaCoach()).toContain('hudTour1');

    await reload();
    expect(bubble()).toBe(HUD_TOUR[1].text);
    expect(metaCoach()).toContain('hudTour2');

    await reload();
    expect(bubble()).toBe(HUD_TOUR[2].text);
    expect(metaCoach()).toContain('hudTour3');

    // 셋 다 봤다 → 투어는 끝, 범례 말풍선이 한 번
    await reload();
    expect(bubble()).toBe(COACH_TEXT.hubLegend);
    expect(metaCoach()).toContain('hudTour');
    expect(metaCoach()).toContain('hubLegend');

    await reload();
    expect(q('.wt-coach')).toBeNull();
  });

  it('차례로 닫으면(다음 → 다음 → 알겠어요) 투어가 끝나고 새로고침해도 다시 안 나온다', async () => {
    seed(hubRun(), { coach: NO_TOUR });
    await boot();
    for (let i = 0; i < HUD_TOUR.length; i++) {
      expect(bubble()).toBe(HUD_TOUR[i].text);
      click(q('.wt-coach-ok'), '말풍선 닫기');
      await flush();
    }
    expect(metaCoach()).toContain('hudTour');
    click(q('.wt-coach-ok'), '범례 닫기');
    await flush();
    expect(q('.wt-coach')).toBeNull();
    await reload();
    expect(q('.wt-coach')).toBeNull();
  });

  it('장소에 들어갔다 허브로 돌아와도 본 말풍선이 처음부터 다시 나오지 않는다', async () => {
    seed(hubRun(), { coach: NO_TOUR });
    await boot();
    expect(bubble()).toBe(HUD_TOUR[0].text);
    await enterRoom(CASE.locations.find((l) => !l.tutorial)!.id);
    await exitToHub();
    expect(bubble()).not.toBe(HUD_TOUR[0].text);
  });
});

describe('② 마지막 허브 탭 기억', () => {
  /** 처음부터 열려 있는 증언 세트(튜토리얼 제외) */
  const openSetId = (run: RunState): string => CASE.sets.find((s) => s.kind !== 'tutorial' && setStatus(run, s.id).state === 'open')!.id;

  it('[사람] 탭에서 증언에 들어갔다 나오면 [사람] 탭 — 집 안으로 튕기지 않는다', async () => {
    const run = hubRun();
    seed(run);
    await boot();
    const id = openSetId(run);
    await openSetUI(id);
    expect(readRun()!.screen.tab).toBe('people');
    await exitToHub();
    expect(q('.wt-tab[data-active="1"]')?.textContent).toContain('사람');
  });

  it('증언 안에서 새로고침해도(저장된 앵커) 나오면 [사람] 탭', async () => {
    const run = hubRun();
    seed(run);
    await boot();
    await openSetUI(openSetId(run));
    await reload();
    expect(q('.wt-test-panel')).toBeTruthy();
    await exitToHub();
    expect(q('.wt-tab[data-active="1"]')?.textContent).toContain('사람');
  });

  it('[집 안] 탭에서 장소에 들어갔다 나오면 [집 안] 탭(기존 동작 유지)', async () => {
    seed(hubRun());
    await boot();
    await tab('사람');
    await tab('집 안');
    const loc = CASE.locations.find((l) => !l.tutorial)!;
    await enterRoom(loc.id);
    await exitToHub();
    expect(q('.wt-tab[data-active="1"]')?.textContent).toContain('집 안');
  });
});

describe('③ 돌파 결과 카드 — 닫기 제공', () => {
  /** T04 의 ★ 돌파 직전 상태 + 그 줄·카드 */
  function starSetup(): { run: RunState; idx: number; card: string } {
    const r = openSet(playPath(PATH.slice(0, 6)), 'T04').run;
    const set = CASE.sets.find((s) => s.id === 'T04')!;
    const idx = set.lines.findIndex((l) => l.breaks?.some((b) => b.tier === 'star' && b.evidence.every((c) => r.evidence.includes(c))));
    const brk = set.lines[idx].breaks!.find((b) => b.tier === 'star')!;
    return { run: setScreen(r, { name: 'testimony', ref: 'T04', line: 0 }), idx, card: brk.evidence[0] };
  }

  /** ★ 를 깨서 결과 카드가 뜰 때까지(대사는 탭으로 넘긴다) */
  async function breakToResult(): Promise<number> {
    const { run, idx, card } = starSetup();
    seed(run);
    await boot();
    await settle(); // 세트 도입 대사
    await gotoLine(idx);
    click(q('[data-testid=present]'), '증거 제시');
    await flush();
    const name = CASE.evidence.find((e) => e.id === card)!.name;
    const btn = qa('.wt-sheet button.wt-card-hit').find((b) => (b.getAttribute('aria-label') ?? '').startsWith(name));
    click(btn ?? null, `카드 ${name}`);
    await flush();
    clickText('이걸로!');
    for (let i = 0; i < 60 && !q('.wt-sheet--result'); i++) {
      const tap = q('.wt-dialogue-tap');
      if (tap) fireEvent.click(tap);
      await flush(3);
    }
    expect(q('.wt-sheet--result'), '결과 카드').toBeTruthy();
    return stars(run); // 깨기 전 ★ 개수
  }

  it('닫기(X)로 닫힌다 — 깬 모순·★ 는 그대로이고 나가기가 다시 열린다', async () => {
    await breakToResult();
    const before = readRun()!;
    expect(before.broken.length).toBeGreaterThan(0);
    const x = q('.wt-sheet--result button[aria-label="닫기"]');
    expect(x, '닫기 버튼').toBeTruthy();
    click(x);
    await flush(5);
    expect(q('.wt-sheet--result')).toBeNull();
    const after = readRun()!;
    expect(after.broken).toEqual(before.broken);
    expect(after.actions).toBe(before.actions);
    expect(q('button[aria-label="나가기(허브로)"]')?.hasAttribute('disabled')).toBe(false);
  });

  it('Esc 로도 닫히고, 바깥(스크림) 탭으로는 닫히지 않는다', async () => {
    await breakToResult();
    fireEvent.click(q('.wt-sheet--result .wt-sheet-scrim')!);
    await flush(3);
    expect(q('.wt-sheet--result')).toBeTruthy();
    fireEvent.keyDown(window, { key: 'Escape' });
    await flush(5);
    expect(q('.wt-sheet--result')).toBeNull();
  });

  it('카드가 뜨는 순간 몇 번째 ★ 인지 스크린 리더가 읽을 텍스트가 있다', async () => {
    const before = await breakToResult();
    expect(q('.wt-sheet--result .wt-result-title .wt-sr')?.textContent).toContain(`${before + 1}번째`);
  });
});

describe('④ 접근성 이름', () => {
  it("타이틀 [이어하기] 의 접근 가능한 이름은 '이어하기' 이고 요약은 설명으로 따라온다", async () => {
    seed(hubRun());
    render(<WitnessApp />);
    await flush();
    await flush();
    const btn = screen.getByRole('button', { name: '이어하기' });
    const descId = btn.getAttribute('aria-describedby');
    expect(descId).toBeTruthy();
    expect(document.getElementById(descId!)?.textContent).toMatch(/\S/);
  });

  it("허브 [최종 지목] 버튼(★ 3)과 HUD ★ 게이지 버튼의 이름은 '최종 지목'", async () => {
    const full = playPath(PATH);
    expect(stars(full)).toBeGreaterThanOrEqual(3);
    seed({ ...full, phase: 'play', screen: { name: 'hub', tab: 'house' } });
    await boot();
    expect(screen.getAllByRole('button', { name: '최종 지목' }).length).toBe(2);
    expect(q('.wt-accusebar-btn')?.getAttribute('aria-label')).toBe('최종 지목');
  });

  it('★ 가 모자랄 땐 HUD 버튼 이름이 「최종 지목 (아직 불가)」, 개수는 설명', async () => {
    seed(hubRun());
    await boot();
    const b = screen.getByRole('button', { name: '최종 지목 (아직 불가)' });
    const d = document.getElementById(b.getAttribute('aria-describedby')!);
    expect(d?.textContent).toContain('결정적 모순 0개');
  });

  it('범인 선택 라디오 5개는 이름이 사람 이름이고, 전부 한 라디오 그룹 안에 있다(또박이 포함)', async () => {
    const full = playPath(PATH);
    seed({ ...full, phase: 'play', screen: { name: 'accuse' }, accuse: { stage: 'suspect', forced: false } });
    await boot();
    const radios = screen.getAllByRole('radio');
    expect(radios.length).toBe(5);
    for (const id of ['S1', 'S2', 'S3', 'S4'] as const) expect(screen.getByRole('radio', { name: nameOf(id) })).toBeTruthy();
    expect(screen.getByRole('radio', { name: '또박이' })).toBeTruthy();
    const groups = new Set(radios.map((r) => r.closest('[role=radiogroup]')));
    expect(groups.size).toBe(1);
    expect([...groups][0]).toBeTruthy();
    click(q('[data-testid=pick-S1]'));
    await flush();
    expect(screen.getByRole('radio', { name: nameOf('S1') }).getAttribute('aria-checked')).toBe('true');
  });
});

describe('④ 첫 ★ 직후 안내 — 갱신 시점', () => {
  const starId = CASE.sets.flatMap((s) => s.lines).flatMap((l) => l.breaks ?? []).find((b) => b.tier === 'star')!.id;
  const live = () => q('.wt-hud [role=status].wt-sr')?.textContent ?? '';

  it('★ 개수가 바뀌면 HUD 안내가 600ms 를 기다리지 않고 바로 갱신된다 — 다른 값은 모아서 읽는다', () => {
    vi.useFakeTimers();
    const r0 = newRun({ now: 0 });
    const { rerender } = render(<HudBar variant="compact" run={r0} />);
    expect(live()).toContain('결정적 모순 0');

    // 행동·시계만 바뀜 → 600ms 모은다
    rerender(<HudBar variant="compact" run={{ ...r0, actions: r0.actions - 1 }} />);
    expect(live()).toContain(`행동 ${r0.actions} 남음`);
    act(() => {
      vi.advanceTimersByTime(650);
    });
    expect(live()).toContain(`행동 ${r0.actions - 1} 남음`);

    // ★ 변화 → 즉시
    rerender(<HudBar variant="compact" run={{ ...r0, actions: r0.actions - 1, broken: [starId] }} />);
    expect(live()).toContain('결정적 모순 1');
  });
});

describe('⑤ 저장 실패 토스트 · 엔딩 도장 · 크기', () => {
  it('플레이 중 저장이 막히면 토스트로 한 번만 안내한다', async () => {
    seed(hubRun());
    await boot();
    const spy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('quota', 'QuotaExceededError');
    });
    const toastTexts = () => qa('.wt-toast').map((t) => t.textContent ?? '');
    expect(toastTexts().filter((t) => t.includes('저장을 막'))).toHaveLength(0);
    await tab('사람'); // 앵커 저장 시도 → 실패
    await flush(5);
    expect(toastTexts().filter((t) => t.includes('저장을 막'))).toHaveLength(1);
    // 토스트가 사라진 뒤 또 저장이 실패해도 다시 띄우지 않는다
    await flush(600);
    expect(toastTexts().filter((t) => t.includes('저장을 막'))).toHaveLength(0);
    await tab('집 안');
    await flush(5);
    expect(toastTexts().filter((t) => t.includes('저장을 막'))).toHaveLength(0);
    spy.mockRestore();
  });

  it('엔딩 등급 도장은 그림(.wt-ending-art) 밖에 있다', async () => {
    seed(
      null,
      {
        lastEnding: { ending: 'perfect', grade: 'A', stars: 7, evidence: 18, wrong: 0, hints: 0, actionsLeft: 2, playMs: 600000, missed: [], unbrokenStars: 0, hiddenTeaser: false, newAchievements: [], at: Date.now(), pendingView: true },
      },
    );
    render(<WitnessApp />);
    await flush();
    await flush();
    expect(q('.wt-ending')).toBeTruthy();
    for (let i = 0; i < 40 && !q('.wt-ending-detail'); i++) {
      const tap = q('.wt-dialogue-tap');
      if (tap) fireEvent.click(tap);
      await flush();
    }
    const stamp = q('.wt-ending-stamp');
    expect(stamp, '등급 도장').toBeTruthy();
    expect(stamp!.closest('.wt-ending-art')).toBeNull();
    expect(q('.wt-ending-art .wt-grade')).toBeNull();
    expect(stamp!.querySelector('.wt-grade')).toBeTruthy();
  });

  const css = readFileSync(resolve(__dirname, 'witness.css'), 'utf8');
  const rule = (sel: string): string => {
    const i = css.indexOf(`${sel} {`);
    expect(i, sel).toBeGreaterThan(-1);
    return css.slice(i, css.indexOf('}', i));
  };

  it('보조 버튼은 44px 이상 · 마지막 행동 시트의 규칙 문장은 14px(작은 글자 토큰)', () => {
    expect(rule('.wt-shell .wt-railchip')).toContain('height: var(--wt-tap-min)');
    expect(rule('.wt-shell .wt-iconbtn--sm')).toContain('height: var(--wt-tap-min)');
    expect(rule('.wt-shell .wt-slot-x')).toContain('height: var(--wt-tap-min)');
    expect(rule('.wt-shell .wt-card-info')).toContain('height: var(--wt-tap-min)');
    expect(rule('.wt-shell button.wt-stargate')).toContain('min-height: var(--wt-tap-min)');
    expect(css).toMatch(/--wt-tap-min: 44px/);
    expect(css).toMatch(/--wt-fs-small: calc\(14px /);
    expect(rule('.wt-shell .wt-last-sub')).toContain('font-size: var(--wt-fs-small)');
    expect(rule('.wt-shell .wt-last-note')).toContain('font-size: var(--wt-fs-small)');
  });
});

describe('⑥ 템포', () => {
  it("첫 방문의 기본 글자 속도는 '빠름' — 이미 저장된 설정은 그대로", async () => {
    render(<WitnessApp />);
    await flush();
    await flush();
    expect(q('.wt-shell')?.getAttribute('data-speed')).toBe('fast');
    cleanup();
    window.localStorage.clear();
    seed(null, {}, { speed: 'normal' });
    render(<WitnessApp />);
    await flush();
    await flush();
    expect(q('.wt-shell')?.getAttribute('data-speed')).toBe('normal');
  });

  const ctx = {
    game: { isRead: () => false, markRead: () => undefined, meta: { plays: 0 }, settings: { speed: 'instant', readFast: false } },
    fx: 'full',
  } as unknown as WtCtx;
  const LINES: Dialogue[] = ['하나.', '둘.', '셋.', '넷.', '다섯.'].map((text) => ({ who: 'NARR', text }) as Dialogue);
  const logText = () => q('.wt-dialogue [role=log]')?.textContent ?? '';
  const mount = (onDone: () => void, speed: 'instant' | 'normal' = 'instant') => {
    const c = { ...ctx, game: { ...(ctx.game as object), settings: { speed, readFast: false } } } as unknown as WtCtx;
    render(
      <WtContext.Provider value={c}>
        <DialogueBox lines={LINES} playKey="k" onDone={onDone} />
      </WtContext.Provider>,
    );
    return q('.wt-dialogue-tap')!;
  };

  it('길게 누르면 줄이 연속으로 넘어가고 마지막 줄에서 멈춘다 — 끝내기(onDone)는 탭으로, 뗄 때 따라오는 클릭은 삼킨다', () => {
    vi.useFakeTimers();
    const onDone = vi.fn();
    const tap = mount(onDone);
    expect(logText()).toBe('하나.');

    fireEvent.pointerDown(tap);
    act(() => {
      vi.advanceTimersByTime(LONG_PRESS_MS - 10);
    });
    expect(logText()).toBe('하나.'); // 아직 길게 누르기가 아니다
    act(() => {
      vi.advanceTimersByTime(10);
    });
    expect(logText()).toBe('둘.');
    // 간격마다 한 줄씩(틱 사이에 화면이 갱신된다)
    for (const want of ['셋.', '넷.', '다섯.']) {
      act(() => {
        vi.advanceTimersByTime(HOLD_STEP_MS);
      });
      expect(logText()).toBe(want);
    }
    // 마지막 줄에서 더 눌러도 멈춰 있다
    for (let i = 0; i < 4; i++) {
      act(() => {
        vi.advanceTimersByTime(HOLD_STEP_MS);
      });
    }
    expect(logText()).toBe('다섯.');
    expect(onDone).not.toHaveBeenCalled();

    fireEvent.pointerUp(tap);
    fireEvent.click(tap); // 손을 뗄 때의 클릭 — 삼킨다
    expect(onDone).not.toHaveBeenCalled();
    expect(logText()).toBe('다섯.');
    fireEvent.click(tap); // 이제 탭 한 번 = 대사 닫기
    expect(onDone).toHaveBeenCalledTimes(1);
  });

  it('짧게 누르면 연속 넘김이 아니라 탭 1번 = 다음 줄', () => {
    vi.useFakeTimers();
    const onDone = vi.fn();
    const tap = mount(onDone);
    fireEvent.pointerDown(tap);
    act(() => {
      vi.advanceTimersByTime(100);
    });
    fireEvent.pointerUp(tap);
    fireEvent.click(tap);
    expect(logText()).toBe('둘.');
    act(() => {
      vi.advanceTimersByTime(HOLD_STEP_MS * 5);
    });
    expect(logText()).toBe('둘.');
  });

  it('글자가 나오는 중의 탭은 그 줄을 즉시 완성하고, 다음 탭에서 넘어간다(기존 동작 유지)', () => {
    vi.useFakeTimers();
    fxConfig.scale = 1; // 타이핑을 켠다(이 파일은 기본으로 연출을 꺼 둔다)
    const onDone = vi.fn();
    const tap = mount(onDone, 'normal');
    expect(q('.wt-dialogue-text')?.textContent).toBe('');
    fireEvent.click(tap);
    expect(q('.wt-dialogue-text')?.textContent).toBe('하나.');
    expect(logText()).toBe('하나.');
    fireEvent.click(tap);
    expect(logText()).toBe('둘.');
  });

  it('길게 누르는 도중 타이머는 언마운트하면 남지 않는다', () => {
    vi.useFakeTimers();
    const onDone = vi.fn();
    const tap = mount(onDone);
    const base = vi.getTimerCount();
    fireEvent.pointerDown(tap);
    expect(vi.getTimerCount()).toBe(base + 1);
    cleanup();
    expect(vi.getTimerCount()).toBeLessThanOrEqual(base);
  });

  it('키를 누르고 있어도(Enter 자동 반복) 줄이 줄줄이 넘어가지 않는다', () => {
    const onDone = vi.fn();
    const tap = mount(onDone);
    const notCanceled = fireEvent.keyDown(tap, { key: 'Enter', repeat: true });
    expect(notCanceled).toBe(false); // preventDefault → 키 반복이 클릭으로 이어지지 않는다
    expect(fireEvent.keyDown(tap, { key: 'Enter', repeat: false })).toBe(true);
  });
});
