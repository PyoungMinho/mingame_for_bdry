// @vitest-environment jsdom
/**
 * 다시 하기(docs/planning/witness-replay.md) 화면 흐름 — 되감기 · 새 수사 시트(수사 기억) · 읽은 대사 넘기기 · 기억 표시.
 * 엔진 상태는 엔진(playPath·judged·rewind)으로 '그 순간'까지 만들어 저장소에 심고, 그 뒤는 화면 클릭이다.
 *  A. 실패 엔딩 — [↺ 직전부터 다시] · 놓친 것 잠금 · 도장 접힘 · 새로고침 뒤에도 유지(U1·U3)
 *  B. 되감기 → 허브 → 지목 칸 미리 채움 · 소진 뒤 「되감기 끝」 · [전부 건너뛰기](attempts)
 *  C. 새 수사 시트 — 1회차 없음 · 2회차 두 버튼(위 기억/아래 처음부터) · 저장된 판 경고 · 직전 결과로 주 버튼 · 기억 판 표시(U4)
 *  D. [≫ 읽은 건 넘기기] — 처음 보는 줄에서 멈춤 · 끝까지 읽음 → 블록 종료 · 표정 이어받기 · 훑은 줄은 기록 안 함(U5·U6)
 *  (B 는 A 안에 함께 있다: 되감기 → 허브 → 칸 미리 채움 · 「되감기 끝」 · [전부 건너뛰기])
 *  E. 결과 카드 접힘 · 칩(`N회차·기억`·`되감기`) · 공유 꼬리 · 도감 최단 기록
 */
import { act, cleanup, fireEvent, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  CASE,
  RECALL_ELIGIBLE,
  STORAGE_KEYS,
  allBreakIds,
  enterLocation,
  examine,
  exit,
  openSet,
  present,
  applyResultToMeta,
  newMeta,
  newRun,
  openedReadKey,
  readLineKey,
  recallable,
  rewind,
  serializeRun,
  setSlot,
  startAccuse,
  pickCulprit,
  submitAccusation,
  type Accusation,
  type Dialogue,
  type RunState,
  type Step,
  type WitnessMeta,
} from '@/lib/witness';
import { freeClosure, playPath } from '@/lib/witness/validate';
import { COACH_TEXT, REPLAY_TEXT, TOAST } from './lib/copy';
import { BackStackProvider } from './lib/BackStack';
import { WtContext, type WtCtx } from './lib/context';
import { LONG_PRESS_MS, fxConfig } from './lib/fx';
import { HOLD_STEP_MS, DialogueBox } from './components/DialogueBox';
import { ResultCard } from './components/ResultCard';
import { WitnessApp } from './screens/WitnessApp';
import { click, clickText, closureUI, flush, q, qa, readRun, settle } from './testkit';

const ALL_COACH = ['firstDot', 'acquire', 'freeLook', 'lineNav', 'press', 'present', 'result', 'hudTour', 'hubLegend', 'firstSpend', 'firstHalf', 'firstRedirect', 'firstWrong', 'firstQuestion', 'firstStar', 'firstUpgrade', 'firstTrust1', 'hintAdvice', 'sheetTip1', 'sheetTip2', 'sheetTip3', 'timelineNote', 'skipRead'];
const PERFECT_PATH = ['L3', 'T05', 'L1', 'T03', 'T02', 'L2', 'T04', 'P:L2.h3'];
const CULPRIT = CASE.solution.culprit;
const INNOCENT = (['S1', 'S2', 'S3', 'S4'] as const).find((x) => x !== CULPRIT)!;
const SOL = CASE.solution.accept;
const RIGHT: Accusation = { culprit: CULPRIT, means: SOL.means[0], opportunity: SOL.opportunity[0], motive: SOL.motive[0] };
const SHORT: Accusation = { ...RIGHT, motive: 'E06' };
const WRONG: Accusation = { ...RIGHT, culprit: INNOCENT };
const OTHER = (['S1', 'S2', 'S3', 'S4'] as const).find((x) => x !== CULPRIT && x !== INNOCENT)!;

function must(s: Step): RunState {
  expect(s.error).toBeUndefined();
  return s.run;
}
function judged(run: RunState, a: Accusation): RunState {
  let r = must(startAccuse(run));
  r = must(pickCulprit(r, a.culprit));
  for (const sl of ['means', 'opportunity', 'motive'] as const) r = must(setSlot(r, sl, a[sl]));
  return must(submitAccusation(r));
}

const baseMeta = (extra: Partial<WitnessMeta> = {}): WitnessMeta => ({ ...newMeta(), plays: 1, coach: ALL_COACH, settings: { ...newMeta().settings, speed: 'instant' }, ...extra });

function seed(run: RunState | null, meta: WitnessMeta = baseMeta()): void {
  window.localStorage.clear();
  if (run) window.localStorage.setItem(STORAGE_KEYS.run, serializeRun(run));
  window.localStorage.setItem(STORAGE_KEYS.meta, JSON.stringify(meta));
}
/** 엔딩에 막 도착한 판 + 그 결과가 반영된 meta(pendingView) */
function seedEnded(end: RunState, extra: Partial<WitnessMeta> = {}): void {
  seed(end, applyResultToMeta(baseMeta({ plays: 0, ...extra }), end.result!, Date.now()));
}

async function boot(opts: { resume?: boolean } = {}): Promise<void> {
  render(<WitnessApp />);
  await flush();
  await flush();
  if (opts.resume) {
    click(q('[data-testid=title-resume]'), '이어하기');
    await flush();
  }
}

async function toEndingDetail(): Promise<void> {
  for (let i = 0; i < 40 && !q('.wt-ending-detail'); i++) {
    const tap = q('.wt-dialogue-tap');
    if (tap) click(tap);
    await flush();
  }
  expect(q('.wt-ending-detail'), '엔딩 결과 영역').toBeTruthy();
}

const metaNow = (): WitnessMeta => JSON.parse(window.localStorage.getItem(STORAGE_KEYS.meta) ?? '{}') as WitnessMeta;

/** 지목 확인 → 제출 → 판정 연출 끝까지. [전부 건너뛰기]가 보였는지 돌려준다 */
async function submitFromSlots(): Promise<{ skipShown: boolean }> {
  click(q('[data-testid=slots-confirm]'));
  await flush();
  if (q('[data-testid=warn-go]')) {
    click(q('[data-testid=warn-go]'));
    await flush();
  }
  click(q('[data-testid=confirm-submit]'), '이대로 넘긴다');
  await flush();
  const skipShown = !!q('[data-testid=verdict-skip]');
  for (let i = 0; i < 40 && !q('[data-testid=verdict-finish]') && q('.wt-verdict'); i++) {
    const tap = q('.wt-verdict .wt-dialogue-tap');
    if (tap) click(tap);
    await flush();
  }
  if (q('[data-testid=verdict-finish]')) click(q('[data-testid=verdict-finish]'));
  await flush();
  return { skipShown };
}

async function accuseFromHub(): Promise<void> {
  click(q('.wt-accusebar-btn'), '최종 지목');
  await flush();
  if ((readRun()?.actions ?? 0) > 0) clickText('지목하러 간다');
  await flush();
}

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

// ═══════════════════════════════ A. 실패 엔딩의 되감기 ═══════════════════════════════

describe('A. 실패 엔딩 — [↺ 직전부터 다시]', () => {
  it('오인 체포: 제목 바로 아래 주 버튼(지목 직전으로 · 최고 A · 마지막 1번) · 놓친 것 잠금 · 도장 접힘 · 공유는 작은 링크', async () => {
    const end = judged(playPath(PERFECT_PATH), WRONG); // 범인 틀림 = 칸 2개 → 마지막 1번
    seedEnded(end);
    await boot();
    expect(q('.wt-ending')).toBeTruthy();
    const btn = q('[data-testid=ending-rewind]')!;
    expect(btn.textContent).toContain(REPLAY_TEXT.rewind);
    expect(btn.classList.contains('wt-btn--primary')).toBe(true);
    expect(q('[data-testid=ending-rewind-sub]')?.textContent).toBe('지목 직전으로 · 최고 A · 마지막 1번');
    // 제목 다음 형제들 중 첫 번째가 되감기 블록(칩이 없을 때) — 본문보다 위
    const title = q('.wt-ending-title')!;
    expect(title.nextElementSibling?.classList.contains('wt-rewind')).toBe(true);
    expect(q('.wt-ending-text')!.compareDocumentPosition(q('.wt-rewind')!) & Node.DOCUMENT_POSITION_PRECEDING).toBeTruthy();
    expect(q('[data-testid=ending-chips]')).toBeNull();

    await toEndingDetail();
    expect(q('[data-testid=ending-rewind]')).toBeTruthy(); // 결과 단계에서도 같은 자리
    // U1: 놓친 것·못 깬 모순 수를 감춘다
    expect(q('[data-testid=missed-locked]')?.textContent).toContain('되감기를 마치면 보여요');
    expect(q('.wt-missed-list')).toBeNull();
    expect(document.body.textContent).not.toContain('깨지 못한 결정적 모순');
    expect(document.body.textContent).not.toContain('놓친 증거');
    // 도장·통계는 접혀 있다 → 펼치면 보인다
    expect(q('.wt-grade')).toBeNull();
    expect(q('.wt-stats')).toBeNull();
    click(q('[data-testid=ending-fold]'));
    await flush();
    expect(q('.wt-grade')).toBeTruthy();
    expect(q('.wt-stats')).toBeTruthy();
    // 주 버튼은 되감기 하나 — [새 수사]·[엔딩 도감]은 보조, 공유는 링크
    expect(q('[data-testid=ending-again]')!.classList.contains('wt-btn--primary')).toBe(false);
    expect(q('[data-testid=ending-share]')!.classList.contains('wt-link')).toBe(true);
    expect(q('[data-testid=rewind-over]')).toBeNull();
  });

  it('칸만 틀림은 칸 1개 — 첫 판정이면 「A등급까지」, 되감은 뒤 또 틀리면 「마지막 1번」 · 칩 「되감기」', async () => {
    const first = judged(playPath(PERFECT_PATH), SHORT);
    seedEnded(first);
    await boot();
    expect(q('[data-testid=ending-rewind-sub]')?.textContent).toBe('지목 직전으로 · 최고 A');
    cleanup();

    const second = judged(must(rewind(first)), SHORT);
    seedEnded(second);
    await boot();
    expect(q('[data-testid=ending-rewind-sub]')?.textContent).toBe('지목 직전으로 · 최고 A · 마지막 1번');
    expect(q('[data-testid=ending-chips]')?.textContent).toBe('되감기');
  });

  it('[↺] → 허브로(되감기 칩) → 지목은 지난 선택이 채워진 「칸」 단계부터 · 소리는 종이 넘기는 소리', async () => {
    const end = judged(playPath(PERFECT_PATH), SHORT);
    seedEnded(end);
    await boot();
    click(q('[data-testid=ending-rewind]'));
    await flush();
    const back = readRun()!;
    expect(back).toMatchObject({ phase: 'play', rewound: true, rewinds: { judged: 1, excluded: 0 } });
    expect(q('.wt-hud--hub')).toBeTruthy();
    expect(q('[data-testid=hud-modes]')?.textContent).toBe('되감기');
    await accuseFromHub();
    expect(readRun()!.accuse?.stage).toBe('slots');
    expect(q('.wt-slotboard')).toBeTruthy();
    expect(q('[data-testid=slot-motive]')?.textContent).toContain(CASE.evidence.find((e) => e.id === 'E06')!.name);
  });

  it('새로고침: 끝난 판이 저장돼 있어 엔딩 화면·버튼이 그대로 · 제목으로 → 이어하기 → 같은 화면(U3)', async () => {
    const end = judged(playPath(PERFECT_PATH), SHORT);
    seedEnded(end);
    await boot();
    expect(q('[data-testid=ending-rewind]')).toBeTruthy();
    cleanup();
    await boot(); // 새로고침 — pendingView 라 곧장 엔딩
    expect(q('.wt-ending')).toBeTruthy();
    expect(q('[data-testid=ending-rewind]')).toBeTruthy();
    await toEndingDetail();
    clickText('제목으로');
    await flush();
    expect(q('[data-testid=title-resume]')?.textContent).toContain('방금 수사 결과');
    cleanup();
    await boot(); // 제목에서 새로고침 → 타이틀(이어하기)
    expect(q('.wt-title-screen')).toBeTruthy();
    click(q('[data-testid=title-resume]'));
    await flush();
    expect(q('.wt-ending')).toBeTruthy();
    expect(q('[data-testid=ending-rewind]')).toBeTruthy();
  });

  it('화면에서 오인 체포 → 끝난 판이 저장에 남고, 범인을 또 틀려 칸을 다 쓰면 저장이 지워지고 「되감기 끝」·[새 수사] 주 버튼·놓친 것 공개', async () => {
    seed(playPath(PERFECT_PATH));
    await boot({ resume: true });
    await accuseFromHub();
    click(q(`[data-testid=pick-${INNOCENT}]`));
    click(q('[data-testid=pick-submit]'));
    await flush();
    for (const [slot, card] of [['means', RIGHT.means], ['opportunity', RIGHT.opportunity], ['motive', RIGHT.motive]] as const) {
      click(q(`[data-testid=slot-${slot}]`));
      await flush();
      const name = CASE.evidence.find((e) => e.id === card)!.name;
      click(qa('.wt-sheet button.wt-card-hit').find((b) => (b.getAttribute('aria-label') ?? '').startsWith(name)) ?? null, card);
      await flush();
    }
    await submitFromSlots();
    await toEndingDetail();
    // 되감기 선택지가 있는 끝난 판은 저장에 남는다(S6)
    expect(readRun()).toMatchObject({ phase: 'ended', result: { ending: `wrong-${INNOCENT}` } });
    expect(q('[data-testid=ending-rewind-sub]')?.textContent).toBe('지목 직전으로 · 최고 A · 마지막 1번');

    click(q('[data-testid=ending-rewind]'));
    await flush();
    await accuseFromHub();
    // 범인이 틀렸던 판은 '범인' 단계부터(세 칸은 미리 채움) — 틀렸던 인물은 고를 수 없다(QA-RP-02)
    expect(q('.wt-slotboard')).toBeNull();
    expect((q(`[data-testid=pick-${INNOCENT}]`) as HTMLButtonElement).disabled).toBe(true);
    click(q(`[data-testid=pick-${OTHER}]`));
    click(q('[data-testid=pick-submit]'));
    await flush();
    expect(q('.wt-slotboard')).toBeTruthy();
    const { skipShown } = await submitFromSlots();
    expect(skipShown).toBe(true);
    await toEndingDetail();
    // 칸 소진 → 선택지 없음: 저장 삭제 · 「되감기 끝」 · 주 버튼은 [새 수사] · 놓친 것은 열림
    expect(readRun()).toBeNull();
    expect(q('[data-testid=ending-rewind]')).toBeNull();
    expect(q('[data-testid=rewind-over]')?.textContent).toBe('되감기 끝');
    expect(q('[data-testid=ending-again]')!.classList.contains('wt-btn--primary')).toBe(true);
    expect(q('[data-testid=ending-again]')!.textContent).toContain('새 수사');
    expect(q('[data-testid=missed-locked]')).toBeNull();
    expect(q('.wt-grade')).toBeTruthy();
    expect(q('[data-testid=ending-chips]')?.textContent).toBe('되감기');
  });

  it('[전부 건너뛰기]: 1회차(plays 0)여도 같은 판의 두 번째 판정(attempts ≥ 1)부터 보인다', async () => {
    const back = must(rewind(judged(playPath(PERFECT_PATH), WRONG)));
    expect(back.attempts).toBe(1);
    seed(back, baseMeta({ plays: 0 }));
    await boot({ resume: true });
    await accuseFromHub();
    // QA-RP-02: 범인이 틀렸던 판은 '범인' 단계부터 — 틀렸던 인물은 고를 수 없고, 카드는 채워져 있다
    expect(q('.wt-slotboard')).toBeNull();
    const ruled = q(`[data-testid=pick-${INNOCENT}]`) as HTMLButtonElement;
    expect(ruled.disabled).toBe(true);
    expect(ruled.textContent).toContain('지난번 아니었다');
    click(q(`[data-testid=pick-${CULPRIT}]`));
    click(q('[data-testid=pick-submit]'));
    await flush();
    expect(q('.wt-slotboard')).toBeTruthy();
    click(q('[data-testid=slots-confirm]'));
    await flush();
    if (q('[data-testid=warn-go]')) {
      click(q('[data-testid=warn-go]'));
      await flush();
    }
    click(q('[data-testid=confirm-submit]'));
    await flush();
    expect(q('[data-testid=verdict-skip]')).toBeTruthy();
  });

  it('수사 배제: 부제는 「증언 직전으로 · 최고 A」, 새 수사 버튼 문구는 「새 수사」', async () => {
    // 신뢰 5 → 0: 같은 줄에 틀린 카드를 5번(엔진 테스트와 같은 방법) → 수사 배제(체크포인트 있음)
    let r = freeClosure(newRun({ now: Date.now(), skipTutorial: true }));
    r = must(enterLocation(r, 'L3'));
    for (const h of CASE.locations.find((l) => l.id === 'L3')!.hotspots) if (!h.precise) r = must(examine(r, h.id));
    r = must(openSet(r, 'T05'));
    for (let i = 0; i < 5; i++) r = present(r, 'T05.1', ['E01']).run;
    expect(r.phase).toBe('ended');
    expect(r.result?.ending).toBe('excluded');
    const excluded = r;
    seed(excluded, baseMeta({ plays: 1 }));
    await boot({ resume: true });
    await settle(); // 배제 본문을 넘긴다
    expect(q('.wt-excluded')).toBeTruthy();
    expect(q('[data-testid=excluded-rewind]')!.textContent).toContain(REPLAY_TEXT.rewind);
    expect(q('[data-testid=excluded-rewind-sub]')?.textContent).toBe('증언 직전으로 · 최고 A');
    expect(q('[data-testid=excluded-new]')!.textContent?.trim()).toBe('새 수사');
    expect(document.body.textContent).not.toContain('엔딩 도감에 기록하고');
  });
});

// ═══════════════════════════════ C. 새 수사 시트 ═══════════════════════════════

describe('C. 새 수사 — 시트 1개(기억 이어가기 위 · 처음부터 아래)', () => {
  const FULL = [...RECALL_ELIGIBLE];
  const lastEnding = (ending: string) => ({
    ending,
    grade: 'C',
    stars: 2,
    evidence: 8,
    wrong: 0,
    hints: 0,
    actionsLeft: 3,
    playMs: 600000,
    missed: [],
    unbrokenStars: 1,
    hiddenTeaser: false,
    newAchievements: [],
    at: 1,
    pendingView: false,
  });

  it('1회차(plays 0)는 시트가 없다 · 기억할 증거가 0개여도 없다', async () => {
    seed(null, baseMeta({ plays: 0, found: FULL }));
    await boot();
    click(q('[data-testid=title-new]'));
    await flush();
    expect(q('.wt-sheet--start')).toBeNull();
    expect(q('.wt-intro')).toBeTruthy();
    cleanup();

    seed(null, baseMeta({ plays: 1, found: [] }));
    await boot();
    click(q('[data-testid=title-new]'));
    await flush();
    expect(q('.wt-sheet--start')).toBeNull();
    expect(q('.wt-intro')).toBeTruthy();
  });

  it('2회차: 두 버튼이 위(기억)·아래(처음부터) 고정 · 부제 문구 · 실패 직후엔 기억이 주 버튼', async () => {
    seed(null, baseMeta({ plays: 2, found: FULL, lastEnding: lastEnding('short') as WitnessMeta['lastEnding'] }));
    await boot();
    click(q('[data-testid=title-new]'));
    await flush();
    const opts = qa('.wt-start-opts button');
    expect(opts.map((b) => b.getAttribute('data-testid'))).toEqual(['start-recall', 'start-fresh']);
    const n = recallable(FULL).length;
    expect(q('[data-testid=start-recall]')!.textContent).toBe(`기억 이어가기증거 ${n}개 들고 · 최고 B`);
    expect(q('[data-testid=start-fresh]')!.textContent).toBe('처음부터빈손 · 최고 S · 최단 기록');
    expect(q('[data-testid=start-recall]')!.getAttribute('data-primary')).toBe('1');
    expect(q('[data-testid=start-fresh]')!.getAttribute('data-primary')).toBeNull();
    expect(q('[data-testid=start-warn]')).toBeNull(); // 저장된 판 없음
    // 시트 안에 두 버튼 말고 별도 확인 단계가 없다(3탭 아님) — 기억 이어가기 1탭으로 허브
    click(q('[data-testid=start-recall]'));
    await flush();
    const r = readRun()!;
    expect(r.recall).toEqual({ n: 3, ids: recallable(FULL) });
    expect(r.screen.name).toBe('hub');
    expect(q('.wt-sheet--start')).toBeNull();
  });

  it('완벽·숨은 직후엔 「처음부터」가 주 버튼 · 처음부터를 고르면 기억 판이 아니다', async () => {
    seed(null, baseMeta({ plays: 2, found: FULL, lastEnding: lastEnding('perfect') as WitnessMeta['lastEnding'] }));
    await boot();
    click(q('[data-testid=title-new]'));
    await flush();
    expect(q('[data-testid=start-fresh]')!.getAttribute('data-primary')).toBe('1');
    expect(q('[data-testid=start-recall]')!.getAttribute('data-primary')).toBeNull();
    click(q('[data-testid=start-fresh]'));
    await flush();
    expect(q('.wt-intro')).toBeTruthy(); // 타이틀에서는 소개부터(건너뛰기 가능) — 현행과 같다
    expect(readRun()!.recall).toBeUndefined();
  });

  it('기억 판: HUD 「기억」 칩 · 지도 ✓ · 수첩에 「기억」 표시·아래쪽 정렬·NEW 점 없음 · 소개·튜토리얼 없이 허브', async () => {
    seed(null, baseMeta({ plays: 2, found: FULL }));
    await boot();
    click(q('[data-testid=title-new]'));
    await flush();
    click(q('[data-testid=start-recall]'));
    await flush();
    expect(q('.wt-hud--hub')).toBeTruthy();
    expect(q('[data-testid=hud-modes]')?.textContent).toBe('기억');
    // 지도 ✓ — 증거를 전부 기억으로 가진 방에만, 문구 없음
    const marks = qa('[data-testid^=recalled-]');
    expect(marks.length).toBeGreaterThan(0);
    expect(marks.every((m) => m.getAttribute('aria-hidden') === 'true' && !(m.textContent ?? '').trim())).toBe(true);
    // 수첩
    click(qa('.wt-tabbar button').find((b) => (b.getAttribute('aria-label') ?? '').includes('수첩')) ?? null);
    await flush();
    const cards = qa('.wt-nbbody .wt-card--S:not(.wt-card--silhouette)');
    const badged = cards.map((c) => !!c.querySelector('.wt-card-badge'));
    expect(badged.some(Boolean)).toBe(true);
    expect(qa('.wt-card-badge').every((b) => b.textContent === '기억')).toBe(true);
    // 기억 카드에는 NEW 점이 없다(본 것으로 시작)
    expect(cards.filter((c) => c.querySelector('.wt-card-badge')).every((c) => !c.querySelector('.wt-card-new'))).toBe(true);
    // 정렬: 기억 카드는 전부 뒤쪽(앞에 기억이 아닌 카드, 그 뒤에 기억 카드)
    const first = badged.indexOf(true);
    expect(badged.slice(first).every(Boolean)).toBe(true);
  });

  it('저장된 판이 있으면 시트에 경고 한 줄 · 그 판에서 찾은 증거도 「증거 n개」에 합쳐 센다(기억 흡수)', async () => {
    const saved = playPath(['L3']); // 진행 중인 판(거실·서재 증거를 들고 있다)
    seed(saved, baseMeta({ plays: 1, found: [] }));
    await boot();
    click(q('[data-testid=title-new]'));
    await flush();
    expect(q('[data-testid=start-warn]')?.textContent).toBe('저장된 수사는 사라져요');
    const count = recallable(RECALL_ELIGIBLE.filter((id) => saved.evidence.includes(id))).length;
    expect(count).toBeGreaterThan(0);
    expect(q('[data-testid=start-recall]')!.textContent).toContain(`증거 ${count}개 들고`);
    click(q('[data-testid=start-recall]'));
    await flush();
    expect(readRun()!.recall?.ids.length).toBe(count);
    // 버린 판의 증거가 meta.found 에 들어갔다(튜토리얼 지급분 포함해 방 증거 전부)
    expect(metaNow().found?.length).toBe(RECALL_ELIGIBLE.filter((id) => saved.evidence.includes(id)).length);
  });

  it('처음부터(plays ≥ 1)에 저장된 판만 있고 기억이 없으면 현행 확인 시트(취소가 기본 포커스)', async () => {
    seed(playPath(['L3']), baseMeta({ plays: 0, found: [] }));
    await boot();
    click(q('[data-testid=title-new]'));
    await flush();
    expect(q('.wt-sheet--start')).toBeNull();
    expect(document.body.textContent).toContain('지금 수사 기록이 지워져요');
    expect(document.activeElement?.textContent).toContain('취소');
  });

  it('엔딩·배제 화면에서도 같은 시트가 뜬다(진입 3곳 공통)', async () => {
    const end = judged(playPath(PERFECT_PATH), SHORT);
    seedEnded(end);
    await boot();
    await toEndingDetail();
    click(q('[data-testid=ending-again]'));
    await flush();
    // 방금 판정에서 방 증거를 찾았으므로 기억할 것이 있다 + 되감기 가능한 판이 저장돼 있어 경고도 함께
    expect(q('.wt-sheet--start')).toBeTruthy();
    expect(q('[data-testid=start-warn]')).toBeTruthy();
  });
});

// ═══════════════════════════════ D. 읽은 대사 넘기기 ═══════════════════════════════

describe('D. [≫ 읽은 건 넘기기]', () => {
  const NARR = (text: string, extra: Partial<Dialogue> = {}): Dialogue => ({ who: 'NARR', text, ...extra }) as Dialogue;
  const lines = [NARR('가.'), NARR('나.'), NARR('다.'), NARR('라.'), NARR('마.'), NARR('바.')];
  const keys = lines.map((l, i) => readLineKey('blk', i, l.text));

  function mount(opts: { read: number[]; plays?: number; coach?: string[]; onDone?: () => void; onLine?: (l: Dialogue, i: number) => void; lines?: Dialogue[]; speed?: 'instant' | 'normal' }) {
    const ls = opts.lines ?? lines;
    const readSet = new Set(opts.read.map((i) => readLineKey('blk', i, ls[i].text)));
    const markRead = vi.fn(); // 읽음 집합은 고정(기록 호출만 본다)
    const markCoach = vi.fn();
    const coach = opts.coach ?? ALL_COACH;
    const ctx = {
      game: { isRead: (k: string) => readSet.has(k), markRead, markCoach, meta: { plays: opts.plays ?? 1, coach }, settings: { speed: opts.speed ?? 'instant', readFast: false } },
      fx: 'full',
      coachSeen: (id: string) => coach.includes(id),
    } as unknown as WtCtx;
    const onDone = opts.onDone ?? vi.fn();
    render(
      <WtContext.Provider value={ctx}>
        <DialogueBox lines={ls} playKey="p" readKey="blk" onDone={onDone} onLine={opts.onLine} />
      </WtContext.Provider>,
    );
    return { markRead, markCoach, onDone: onDone as ReturnType<typeof vi.fn> };
  }
  const logText = () => q('.wt-dialogue [role=log]')?.textContent ?? '';
  const skipBtn = () => q<HTMLButtonElement>('[data-testid=skip-read]')!;

  it('연속으로 읽은 줄이 2개 이상일 때만 켜지고, 처음 보는 줄에서 멈춘다', () => {
    mount({ read: [0, 1, 3, 4] });
    expect(skipBtn().textContent).toBe('≫ 읽은 건 넘기기');
    expect(skipBtn().getAttribute('data-on')).toBe('1');
    expect(skipBtn().disabled).toBe(false);
    expect(logText()).toBe('가.');
    click(skipBtn());
    expect(logText()).toBe('다.'); // 처음 보는 줄
    // 처음 보는 줄에서는 꺼져 있다(자리는 그대로 — 슬롯 예약)
    expect(skipBtn().disabled).toBe(true);
    expect(skipBtn().getAttribute('data-on')).toBeNull();
    expect(skipBtn().getAttribute('aria-hidden')).toBe('true');
  });

  it('지금 줄만 읽었고 다음이 처음이면(연속 1개) 꺼져 있다 · 처음 보는 줄도 꺼져 있다', () => {
    mount({ read: [0, 2, 3] });
    expect(skipBtn().disabled).toBe(true);
    cleanup();
    mount({ read: [] });
    expect(skipBtn().disabled).toBe(true);
  });

  it('끝까지 다 읽은 블록이면 눌러서 곧바로 블록 종료(onDone)', () => {
    const m = mount({ read: [0, 1, 2, 3, 4, 5] });
    click(skipBtn());
    expect(m.onDone).toHaveBeenCalledTimes(1);
  });

  it('건너뛴 줄은 읽음으로 새로 기록하지 않는다 — 기록은 지금 줄(탭으로 읽은 줄)뿐', () => {
    const m = mount({ read: [0, 1, 3, 4] });
    click(skipBtn());
    const recorded = m.markRead.mock.calls.flat(2) as string[];
    for (const k of [keys[1], keys[3], keys[4]]) expect(recorded.filter((x) => x === k).length).toBe(0);
    expect(recorded.includes(keys[2])).toBe(true); // 착지한 줄은 일반 읽기로 기록
  });

  it('건너뛴 구간의 마지막 표정을 착지 줄에 이어 준다(M4)', () => {
    const withFace: Dialogue[] = [
      { who: 'S1', text: '하나.' },
      { who: 'S1', text: '둘.', face: 'sweat' },
      { who: 'S1', text: '셋.' },
      { who: 'S1', text: '넷.' },
    ] as Dialogue[];
    const onLine = vi.fn();
    mount({ read: [0, 1, 2], lines: withFace, onLine });
    onLine.mockClear();
    click(skipBtn());
    expect(logText()).toContain('넷.');
    // 착지 줄 알림 전에 이어받은 표정이 한 번 먼저 나간다
    expect(onLine.mock.calls[0][0]).toMatchObject({ who: 'S1', face: 'sweat' });
    expect(onLine.mock.calls[onLine.mock.calls.length - 1][0]).toMatchObject({ text: '넷.' });
  });

  it('길게 눌러 훑은 줄은 읽음으로 기록하지 않는다(탭으로 지나간 줄만)', () => {
    vi.useFakeTimers();
    const m = mount({ read: [] });
    const tap = q('.wt-dialogue-tap')!;
    fireEvent.pointerDown(tap);
    act(() => {
      vi.advanceTimersByTime(LONG_PRESS_MS);
    });
    for (let i = 0; i < 4; i++)
      act(() => {
        vi.advanceTimersByTime(HOLD_STEP_MS);
      });
    fireEvent.pointerUp(tap);
    const recorded = m.markRead.mock.calls.flat(2) as string[];
    // 길게 누르는 동안 넘어간 줄(1~)은 기록되지 않는다
    for (const k of keys.slice(1, 5)) expect(recorded.includes(k)).toBe(false);
  });

  it('1회차(plays 0)에는 안내가 없고, 2회차에 처음 켜질 때 한 번만 안내한다', () => {
    const a = mount({ read: [0, 1], plays: 0, coach: [] });
    expect(q('.wt-coach')).toBeNull();
    expect(a.markCoach).not.toHaveBeenCalled();
    cleanup();
    const b = mount({ read: [0, 1], plays: 1, coach: [] });
    expect(q('.wt-coach p')?.textContent).toBe(COACH_TEXT.skipRead);
    expect(b.markCoach).toHaveBeenCalledWith('skipRead');
    cleanup();
    const c = mount({ read: [0, 1], plays: 1 }); // 이미 본 안내
    expect(q('.wt-coach')).toBeNull();
    expect(c.markCoach).not.toHaveBeenCalled();
  });

  it('readKey 가 없는 블록(판정 피드백)에는 버튼이 없다', () => {
    const ctx = { game: { isRead: () => true, markRead: vi.fn(), markCoach: vi.fn(), meta: { plays: 1, coach: ALL_COACH }, settings: { speed: 'instant', readFast: false } }, fx: 'full', coachSeen: () => true } as unknown as WtCtx;
    render(
      <WtContext.Provider value={ctx}>
        <DialogueBox lines={lines} playKey="q" onDone={() => undefined} />
      </WtContext.Provider>,
    );
    expect(q('[data-testid=skip-read]')).toBeNull();
  });
});

// ═══════════════════════════════ E. 결과 카드 접힘 · 칩 · 공유 · 도감 ═══════════════════════════════

describe('E. 표기 — 결과 카드 접힘 · 칩 · 공유 꼬리 · 최단 기록', () => {
  it('돌파 뒤 「새로 열린 것」: 처음엔 펼쳐서 보여 주며 봤다고 기록하고, 이미 본 것은 한 줄 칩으로 접힌다(탭하면 펼침)', async () => {
    const items = [{ kind: 'location' as const, id: 'L1', cost: 1 as const }];
    const props = { open: true, tier: 'minor' as const, items, trustDelta: null, onContinue: () => undefined, onGoto: () => undefined };
    const wrap = (el: React.ReactElement) => render(<BackStackProvider>{el}</BackStackProvider>);
    wrap(<ResultCard {...props} />);
    expect(q('.wt-result-list')).toBeTruthy();
    expect(q('[data-testid=result-fold]')).toBeNull();
    cleanup();
    wrap(<ResultCard {...props} folded />);
    expect(q('.wt-result-list')).toBeNull();
    expect(q('[data-testid=result-fold]')?.textContent).toBe('새로 열린 것 1개');
    click(q('[data-testid=result-fold]'));
    expect(q('.wt-result-list')).toBeTruthy();
  });

  it('화면에서 돌파하면 「새로 열린 것」을 봤다는 표시(openedReadKey)가 meta 에 남는다', async () => {
    // 증언 T03 을 열기만 하고 모순은 아직 안 깬 판 — 새로 열리는 것(증언·증거·비밀)이 있는 모순이 화면 조작으로 남아 있다
    let r = playPath(['L3', 'T05', 'L1']);
    r = must(exit(must(openSet(r, 'T03'))));
    seed(r, baseMeta({ plays: 1 }));
    await boot({ resume: true });
    await closureUI();
    expect(readRun()!.broken.length).toBeGreaterThan(r.broken.length);

    cleanup(); // 언마운트에서 읽음 기록을 쓴다
    const lines = metaNow().readLines;
    const opened = allBreakIds().filter((id) => lines.includes(openedReadKey(id)));
    expect(opened.length).toBeGreaterThan(0);
    // 대사 읽음 키는 문구 해시를 포함한 형식(`…#i~xxxx`)
    expect(lines.every((k) => /#\d+~[0-9a-z]{4}$/.test(k))).toBe(true);
  }, 60_000);

  it('기억 판 완벽(B등급)이 새로고침 뒤에도 A 칭호 + 칩 「3회차·기억」 · 공유 꼬리 · 공유엔 이름 없음', async () => {
    seed(null, {
      ...baseMeta({ plays: 3 }),
      lastEnding: { ending: 'perfect', grade: 'B', stars: 5, evidence: 15, wrong: 0, hints: 0, actionsLeft: 7, playMs: 400000, missed: [], unbrokenStars: 0, hiddenTeaser: true, newAchievements: [], at: 1, pendingView: true, recallRun: 3 },
    });
    await boot();
    expect(q('[data-testid=ending-chips]')?.textContent).toBe('3회차·기억');
    await toEndingDetail();
    expect(q('.wt-grade')?.getAttribute('data-grade')).toBe('B');
    expect(q('.wt-grade-title')?.textContent).toContain(CASE.titles.A);
    expect(q('.wt-grade-title')?.textContent).not.toContain(CASE.titles.B);
    click(q('[data-testid=ending-share]'));
    await flush();
    const text = q('.wt-sharecard')?.textContent ?? '';
    expect(text).toContain('B등급 · ' + CASE.titles.A + ' · 3회차·기억');
    expect(text).not.toMatch(/범인|진상|위조/);
  });

  it('도감: 처음부터·무되감기 최단 기록을 행동 수로 한 줄', async () => {
    seed(null, baseMeta({ plays: 2, best: { used: 8, ms: 600000, grade: 'S', at: 1 } }));
    await boot();
    click(q('[data-testid=title-collection]'));
    await flush();
    expect(q('[data-testid=coll-best]')?.textContent).toBe('최단 기록 행동 8번');
  });

  it('도감: 기록이 없으면 그 줄이 없다', async () => {
    seed(null, baseMeta({ plays: 1 }));
    await boot();
    click(q('[data-testid=title-collection]'));
    await flush();
    expect(q('[data-testid=coll-best]')).toBeNull();
  });
});

// ═══════════════════════════════ E. 검토 수정(QA-RP · UX · A) ═══════════════════════════════

describe('E. 검토 수정', () => {
  it('QA-RP-01: 기억 판 실패의 되감기 부제는 「최고 B」(시트와 같은 상한)', async () => {
    const mem = playPath(['T02', 'T03', 'T04', 'T05'], freeClosure(newRun({ now: Date.now(), recall: RECALL_ELIGIBLE, recallN: 2 })));
    seedEnded(judged(mem, SHORT), { plays: 1 });
    await boot();
    expect(q('[data-testid=ending-rewind-sub]')?.textContent).toBe('지목 직전으로 · 최고 B');
  });

  it('QA-RP-03: 되감으면 엔딩 복원 표시(pendingView)가 내려간다 → 판을 지우고 새로고침해도 옛 실패 엔딩이 안 뜬다', async () => {
    seedEnded(judged(playPath(PERFECT_PATH), SHORT));
    await boot();
    expect(metaNow().lastEnding?.pendingView).toBe(true);
    click(q('[data-testid=ending-rewind]'));
    await flush();
    expect(metaNow().lastEnding?.pendingView).toBe(false);
    window.localStorage.removeItem(STORAGE_KEYS.run); // 설정 「진행 중인 수사 지우기」와 같은 효과
    cleanup();
    await boot();
    expect(q('.wt-ending')).toBeNull();
    expect(q('.wt-title-screen')).toBeTruthy();
  });

  it('A2·UX-1: 되감기를 기다리는 판에선 사건 파일이 잠긴다(엔딩 버튼 없음 · 도감 버튼 잠금 · 시트 안 열림)', async () => {
    seedEnded(judged(playPath(PERFECT_PATH), SHORT), { plays: 3 });
    await boot();
    await toEndingDetail();
    expect(q('[data-testid=ending-casefile]')).toBeNull();
    click(q('[data-testid=ending-collection]'));
    await flush();
    expect(q('[data-testid=coll-casefile]')?.textContent).toContain('되감기를 마치면 열려요');
    click(q('[data-testid=coll-casefile]'));
    await flush();
    expect(q('[data-testid=casefile-open]')).toBeNull();
    expect(q('.wt-casefile-lock')?.textContent).toContain('되감기를 마치면 열려요');
    expect(document.body.textContent).not.toContain('내가 깸');
  });

  it('UX-2: 되감기 판의 본문 건너뛰기 버튼은 「본문 넘기기」', async () => {
    seedEnded(judged(playPath(PERFECT_PATH), SHORT));
    await boot();
    expect(document.body.textContent).toContain('본문 넘기기');
    expect(document.body.textContent).not.toContain('결과 바로 보기');
  });

  it('A4: [전부 건너뛰기]도 칸별 요약을 보여 주고, 되감은 뒤 안 통한 칸에 「지난번 안 통함」', async () => {
    seed(playPath(PERFECT_PATH), baseMeta({ plays: 1 }));
    await boot({ resume: true });
    await accuseFromHub();
    click(q(`[data-testid=pick-${CULPRIT}]`));
    click(q('[data-testid=pick-submit]'));
    await flush();
    for (const [slot, card] of [['means', SHORT.means], ['opportunity', SHORT.opportunity], ['motive', SHORT.motive]] as const) {
      click(q(`[data-testid=slot-${slot}]`));
      await flush();
      const name = CASE.evidence.find((e) => e.id === card)!.name;
      click(qa('.wt-sheet button.wt-card-hit').find((b) => (b.getAttribute('aria-label') ?? '').startsWith(name)) ?? null, card);
      await flush();
    }
    click(q('[data-testid=slots-confirm]'));
    await flush();
    if (q('[data-testid=warn-go]')) {
      click(q('[data-testid=warn-go]'));
      await flush();
    }
    click(q('[data-testid=confirm-submit]'));
    await flush();
    click(q('[data-testid=verdict-skip]'), '전부 건너뛰기');
    await flush();
    const sum = q('.wt-verdict-sum')!;
    expect(sum).toBeTruthy();
    expect(qa('.wt-verdict-sum li').map((li) => li.getAttribute('data-ok'))).toEqual(['1', '1', '0']);
    click(q('[data-testid=verdict-finish]'));
    await flush();
    await toEndingDetail();
    click(q('[data-testid=ending-rewind]'));
    await flush();
    await accuseFromHub();
    expect(q('[data-testid=slot-miss-motive]')?.textContent).toContain('지난번 안 통함');
    expect(q('[data-testid=slot-miss-means]')).toBeNull();
  });

  it('A1: 다른 탭이 판을 바꾸면(storage 이벤트) 다시 읽고 안내 — 낡은 판으로 덮어쓰지 않는다', async () => {
    const hub = playPath(PERFECT_PATH);
    seed(hub);
    await boot({ resume: true });
    // 다른 탭: 같은 판에서 지목해 끝냄
    const other = judged(hub, WRONG);
    const raw = serializeRun(other);
    act(() => {
      window.localStorage.setItem(STORAGE_KEYS.run, raw);
      window.dispatchEvent(new StorageEvent('storage', { key: STORAGE_KEYS.run, newValue: raw }));
    });
    await flush();
    expect(document.body.textContent).toContain(TOAST.synced);
    expect(q('.wt-ending')).toBeTruthy(); // 다른 탭이 낸 결과를 따라간다
    expect(readRun()).toMatchObject({ phase: 'ended', result: { ending: `wrong-${INNOCENT}` } });
  });

  it('A1: 이벤트가 안 와도 행동 직전에 확인 — 낡은 탭의 지목은 버리고 저장된 판을 다시 읽는다', async () => {
    const hub = playPath(PERFECT_PATH);
    seed(hub);
    await boot({ resume: true });
    const other = judged(hub, WRONG);
    window.localStorage.setItem(STORAGE_KEYS.run, serializeRun(other)); // 이벤트 없이(인앱 브라우저)
    click(q('.wt-accusebar-btn'), '최종 지목');
    await flush();
    // 지목 화면으로 가지 않고, 다른 탭의 끝난 판을 그대로 둔다(되감기 칸을 새로 만들지 못한다)
    expect(q('.wt-slotboard, .wt-pick')).toBeNull();
    const now = readRun()!;
    expect(now.phase).toBe('ended');
    expect(now.rewinds).toBeUndefined();
    expect(JSON.parse(window.localStorage.getItem(STORAGE_KEYS.run)!).result.ending).toBe(`wrong-${INNOCENT}`);
  });

  it('A1: 다 쓴 판이 다른 탭에서 지워졌으면 낡은 엔딩 탭의 [↺]는 되감지 않는다', async () => {
    seedEnded(judged(playPath(PERFECT_PATH), WRONG));
    await boot();
    window.localStorage.removeItem(STORAGE_KEYS.run); // 다른 탭이 칸을 다 써서 저장이 지워짐
    click(q('[data-testid=ending-rewind]'));
    await flush();
    expect(readRun()).toBeNull();
    expect(q('.wt-hud--hub')).toBeNull();
  });

  it('A1: meta 는 덮지 않고 합친다 — 다른 탭이 남긴 엔딩·plays·best 를 잃지 않는다', async () => {
    seed(playPath(PERFECT_PATH), baseMeta({ plays: 1, endings: ['short'] }));
    await boot();
    const otherMeta = { ...metaNow(), plays: 4, endings: ['short', 'perfect'], best: { used: 9, ms: 1000, grade: 'S' as const, at: 5 } };
    window.localStorage.setItem(STORAGE_KEYS.meta, JSON.stringify(otherMeta)); // 이벤트 없이
    // 이 탭이 meta 를 쓴다(설정 변경)
    click(q('[data-testid=title-settings]'));
    await flush();
    click(q('[data-testid=set-text-xl]'), '글자 크게');
    await flush();
    const m = metaNow();
    expect(m.settings.text).toBe('xl');
    expect(m.plays).toBe(4);
    expect(m.endings).toEqual(expect.arrayContaining(['short', 'perfect']));
    expect(m.best?.used).toBe(9);
  });
});
