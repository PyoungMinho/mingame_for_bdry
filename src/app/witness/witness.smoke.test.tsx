// @vitest-environment jsdom
/**
 * 「목격자는 AI」 화면 스모크 — 엔진 최적 경로(완벽 해결 최단 = 유료 8)를 화면 조작(클릭)만으로 끝까지 돌린다.
 *   타이틀 → 새 수사 → 소개 8컷 → 규칙 카드 → 거실 튜토리얼 → 브리핑(추궁·제시·◆ 돌파) → 허브
 *   → 조사/심문 최단 경로 8곳 + 무료 closure → 최종 지목(범인·수단·기회·동기) → 판정 연출 → 엔딩 → 공유 → 다시 수사(2회차 건너뛰기)
 * 상태는 화면이 아니라 저장소(wt:save:v1)를 블랙박스 창으로 읽어 확인한다. 범인 id 는 코드에 쓰지 않고 CASE.solution 에서 읽는다.
 */
import { cleanup, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CASE, STAR_TOTAL, STORAGE_KEYS, loadMeta, openStorage, stars } from '@/lib/witness';
import { fxConfig } from './lib/fx';
import { WitnessApp } from './screens/WitnessApp';
import { cardLabel, click, clickText, closureUI, enterRoom, examineChip, exitToHub, flush, gotoLine, openSetUI, presentUI, q, qa, readRun, settle, spendIfAsked } from './testkit';

beforeEach(() => {
  window.localStorage.clear();
  window.sessionStorage.clear();
  fxConfig.scale = 0;
});
afterEach(() => {
  cleanup();
  fxConfig.scale = 1;
});

const PATH = ['L3', 'T05', 'L1', 'T03', 'T02', 'L2', 'T04', 'P:L2.h3'];

async function pay(key: string): Promise<void> {
  if (key.startsWith('P:')) {
    const hs = key.slice(2);
    const loc = CASE.locations.find((l) => l.hotspots.some((h) => h.id === hs))!;
    await enterRoom(loc.id);
    await examineChip(hs);
    await exitToHub();
  } else if (key.startsWith('L')) {
    await enterRoom(key);
    await exitToHub();
  } else {
    await openSetUI(key);
    await exitToHub();
  }
}

describe('화면 스모크 — 처음부터 끝까지', () => {
  it('타이틀 → 튜토리얼 → 허브 → 완벽 해결 → 엔딩 → 공유 → 다시 수사', async () => {
    render(<WitnessApp />);
    await flush();
    await flush();

    // ── 타이틀 ──
    expect(document.body.textContent).toContain('목격자는');
    expect(document.body.textContent).toContain('혼자서');
    expect(document.body.textContent).toContain('약 25분');
    expect(document.body.textContent).toContain('가입 없음');
    expect(q('[data-testid=title-resume]')).toBeNull();
    click(q('[data-testid=title-new]'), '새 수사');
    await settle();

    // ── 소개 8컷은 건너뛸 수 없다(1회차) → 규칙 카드 3장 ──
    expect(q('[data-testid=intro-skip]')).toBeNull();
    expect(q('.wt-rulecard')).toBeTruthy();
    click(q('[data-testid=rules-next]'));
    await flush();
    click(q('[data-testid=rules-next]'));
    await flush();
    expect(q('.wt-rulecard-extra')?.textContent).toBeUndefined(); // 3번째 카드에는 카드 2의 괄호 문구가 없다
    click(q('[data-testid=rules-next]'), '수사 시작');
    await settle();

    // ── 거실 튜토리얼: 첫 점만 활성 ──
    expect(q('.wt-rail')).toBeTruthy();
    expect((q('.wt-railchip[data-hid="L0.h2"]') as HTMLButtonElement).disabled).toBe(true);
    expect(q('[data-testid=briefing-start]')).toBeNull();
    await examineChip('L0.h1');
    expect(readRun()!.evidence.length).toBeGreaterThanOrEqual(1);
    for (const h of ['L0.h2', 'L0.h3', 'L0.h4']) await examineChip(h);
    expect(readRun()!.evidence.length).toBe(3);

    // ── 브리핑: 심문 T00, 추궁 → 제시(◆ 돌파) ──
    click(q('[data-testid=briefing-start]'), '브리핑 시작');
    await settle();
    expect(q('.wt-test-panel')).toBeTruthy();
    const tut = CASE.sets.find((s) => s.kind === 'tutorial')!;
    const tutLine = tut.lines.findIndex((l) => l.breaks?.length);
    await gotoLine(0);
    click(q('[data-testid=press]'));
    await settle();
    expect(readRun()!.pressed).toContain(tut.lines[0].id);
    await gotoLine(tutLine);
    await presentUI([...tut.lines[tutLine].breaks![0].evidence]);

    // ── 튜토리얼이 끝나면 허브 + HUD 투어 ──
    await settle();
    const afterTut = readRun()!;
    expect(afterTut.screen.name).toBe('hub');
    expect(afterTut.broken).toContain(tut.lines[tutLine].breaks![0].id);
    expect(afterTut.actions).toBe(12);
    expect(q('.wt-hud--hub')).toBeTruthy();
    expect(q('[aria-label^="행동 12번 남음"]')).toBeTruthy();

    // ── 허브: 방 타일 칩(엔진 셀렉터가 만든 상태) ──
    expect(q('[data-testid=room-L5]')?.getAttribute('aria-label')).toContain('잠김');
    expect(q('[data-testid=room-L1]')?.getAttribute('aria-label')).toContain('행동 1');
    expect(q('[data-testid=room-L0]')?.getAttribute('aria-label')).toContain('다녀옴');

    // ── 유료 8 + 무료 closure(완벽 해결 최단 경로) ──
    await closureUI();
    for (const key of PATH) {
      await pay(key);
      await closureUI();
    }
    const run = readRun()!;
    expect(run.actions).toBe(4);
    expect(stars(run)).toBeGreaterThanOrEqual(3);
    expect(STAR_TOTAL).toBeGreaterThanOrEqual(3);
    expect(run.evidence).toEqual(expect.arrayContaining([...CASE.solution.accept.opportunity, ...CASE.solution.accept.motive]));
    expect(q('.wt-accusebar-btn')).toBeTruthy();

    // ── 최종 지목: 확인 시트 → 범인 → 3칸 → 확인 ──
    click(q('.wt-accusebar-btn'));
    await flush();
    clickText('지목하러 간다');
    await flush();
    expect(q('.wt-pick')).toBeTruthy();
    // 또박이는 용의자가 아니라 증인 카드다(이스터에그 — 페널티 없음)
    click(q('[data-testid=pick-AI]'));
    click(q('[data-testid=pick-submit]'));
    await settle();
    expect(readRun()!.egg).toBe(true);
    expect(readRun()!.accuse?.stage).toBe('suspect');
    click(q(`[data-testid=pick-${CASE.solution.culprit}]`));
    click(q('[data-testid=pick-submit]'));
    await flush();
    expect(readRun()!.accuse?.stage).toBe('slots');

    // 빈 칸이 있으면 오류 문구
    click(q('[data-testid=slots-confirm]'));
    await flush();
    expect(q('.wt-sb-error')?.textContent).toContain('한 칸이 비었다');
    for (const [slot, id] of [
      ['means', CASE.solution.accept.means[0]],
      ['opportunity', CASE.solution.accept.opportunity[0]],
      ['motive', CASE.solution.accept.motive[0]],
    ] as const) {
      click(q(`[data-testid=slot-${slot}]`));
      await flush();
      const name = cardLabel(id);
      const card = qa('.wt-sheet button.wt-card-hit').find((b) => (b.getAttribute('aria-label') ?? '').startsWith(name));
      click(card ?? null, `칸 카드 ${name}`);
      await flush();
    }
    click(q('[data-testid=slots-confirm]'));
    await flush();
    expect(q('.wt-confirm-sum')?.textContent).toContain(cardLabel(CASE.solution.accept.motive[0]));
    click(q('[data-testid=confirm-submit]'));
    await settle();

    // ── 판정 연출(탭 진행) → 엔딩 ──
    expect(q('.wt-verdict')).toBeTruthy();
    for (let i = 0; i < 30 && !q('[data-testid=verdict-finish]'); i++) {
      click(q('.wt-dialogue-tap'));
      await flush();
    }
    expect(qa('.wt-verdict-sum li').map((li) => li.getAttribute('data-ok'))).toEqual(['1', '1', '1']);
    click(q('[data-testid=verdict-finish]'));
    await flush();
    for (let i = 0; i < 40 && !q('.wt-ending-detail'); i++) {
      click(q('.wt-dialogue-tap'));
      await flush();
    }
    expect(q('.wt-ending-title')?.textContent).toBe(CASE.endings.perfect!.title);
    expect(q('.wt-grade')?.getAttribute('data-grade')).toBe('A');
    expect(q('.wt-stats')?.textContent).toContain(`${stars(run)}/${STAR_TOTAL}`);
    expect(q('.wt-teaser')?.textContent).toContain('AI가 아직 하지 않은 말이 하나 있다');

    // 엔딩 도착 = meta 갱신 + 진행 중인 판 저장 삭제
    expect(window.localStorage.getItem(STORAGE_KEYS.run)).toBeNull();
    const meta = loadMeta(openStorage().storage);
    expect(meta.plays).toBe(1);
    expect(meta.endings).toContain('perfect');
    expect(meta.achievements).toContain('arrestSpeaker');

    // ── 공유: 스포일러 없는 텍스트 ──
    click(q('[data-testid=ending-share]'));
    await flush();
    const share = q('.wt-sharecard')?.textContent ?? '';
    expect(share).toContain('A등급');
    expect(share).toContain('결정적 모순');
    for (const n of Object.values(CASE.names)) if (n && n.length > 1) expect(share).not.toContain(n);
    expect(share).not.toContain('S4');
    click(q('.wt-sheet--share button[aria-label="닫기"]'));
    await flush();

    // ── 사건 파일: 완벽 해결 1회라 열린다(스포일러 경고 먼저) ──
    click(q('[data-testid=ending-casefile]'));
    await flush();
    expect(q('[data-testid=casefile-back]')).toBeTruthy();
    click(q('[data-testid=casefile-open]'));
    await flush();
    expect(q('.wt-casefile-truth')?.textContent).toContain(CASE.names[CASE.solution.culprit]);
    click(q('.wt-sheet--casefile button[aria-label="닫기"]'));
    await flush();

    // ── 엔딩에서 새로고침해도 엔딩 화면으로(meta.lastEnding.pendingView) — 이어하기 카드가 아니다 ──
    cleanup();
    render(<WitnessApp />);
    await flush();
    await flush();
    expect(q('.wt-ending-title')?.textContent).toBe(CASE.endings.perfect!.title);
    expect(q('[data-testid=title-resume]')).toBeNull();
    clickText('결과 바로 보기');
    await flush();
    expect(q('.wt-grade')?.getAttribute('data-grade')).toBe('A');

    // ── 다시 수사: 2회차는 소개·튜토리얼을 건너뛰고 허브로(증거 3, 행동 12, 신뢰 5) ──
    click(q('[data-testid=ending-again]'));
    await flush();
    const again = readRun()!;
    expect(again.screen.name).toBe('hub');
    expect(again.evidence.length).toBe(3);
    expect(again.actions).toBe(12);
    expect(again.trust).toBe(5);
    expect(q('.wt-hud--hub')).toBeTruthy();
  }, 120_000);
});

describe('저장·이어하기', () => {
  it('진행 중인 판이 있으면 타이틀에 이어하기 카드(요약) → 같은 화면으로 복원', async () => {
    render(<WitnessApp />);
    await flush();
    click(q('[data-testid=title-new]'));
    await settle();
    expect(q('.wt-rulecard')).toBeTruthy();
    cleanup();

    // 새로고침 = 다시 마운트. 소개/규칙은 처음 컷부터 복원한다
    render(<WitnessApp />);
    await flush();
    await flush();
    const resume = q('[data-testid=title-resume]');
    expect(resume).toBeTruthy();
    expect(resume!.textContent).toContain('행동 12 남음');
    // 새 수사는 확인 시트(취소가 기본 포커스)
    click(q('[data-testid=title-new]'));
    await flush();
    expect(document.body.textContent).toContain('지금 수사 기록이 지워져요');
    expect(document.activeElement?.textContent).toContain('취소');
    clickText('취소');
    click(resume);
    await flush();
    expect(q('.wt-intro, .wt-rules-screen')).toBeTruthy();
  });

  it('깨진 저장은 폐기하고 안내 띠(도감 보존) — 앱은 죽지 않는다', async () => {
    window.localStorage.setItem(STORAGE_KEYS.run, '{"v":1,"caseId":"witness-01","actions":"x"}');
    window.localStorage.setItem(STORAGE_KEYS.meta, JSON.stringify({ v: 1, plays: 2, endings: ['perfect'], secrets: [], achievements: [], readLines: [], settings: {}, coach: [] }));
    render(<WitnessApp />);
    await flush();
    await flush();
    expect(document.body.textContent).toContain('기록을 읽지 못해 새 수사로 시작해요');
    expect(q('[data-testid=title-resume]')).toBeNull();
    expect(window.localStorage.getItem(STORAGE_KEYS.run)).toBeNull();
    expect(loadMeta(openStorage().storage).endings).toEqual(['perfect']);
    expect(q('[data-testid=title-collection]')?.textContent).toContain('1/8');
  });

  it('2회차(plays ≥ 1)는 소개 [건너뛰기]가 있고, 누르면 튜토리얼 증거를 받고 허브로', async () => {
    window.localStorage.setItem(STORAGE_KEYS.meta, JSON.stringify({ v: 1, plays: 1, endings: [], secrets: [], achievements: [], readLines: [], settings: {}, coach: [] }));
    render(<WitnessApp />);
    await flush();
    click(q('[data-testid=title-new]'));
    await flush();
    click(q('[data-testid=intro-skip]'), '건너뛰기');
    await flush();
    expect(readRun()!.screen.name).toBe('hub');
    expect(readRun()!.evidence.length).toBe(3);
  });
});

describe('저장이 막힌 브라우저', () => {
  it('localStorage 가 막혀도(사파리 프라이빗 등) 안내 띠만 띄우고 끝까지 돈다(메모리 폴백)', async () => {
    const setItem = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('QuotaExceededError', 'QuotaExceededError');
    });
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => null);
    render(<WitnessApp />);
    await flush();
    await flush();
    expect(document.body.textContent).toContain('이 브라우저는 저장을 막고 있어요');
    click(q('[data-testid=title-new]'));
    await settle();
    expect(q('.wt-rulecard')).toBeTruthy();
    click(q('[data-testid=rules-next]'));
    click(q('[data-testid=rules-next]'));
    click(q('[data-testid=rules-next]'));
    await settle();
    expect(q('.wt-rail')).toBeTruthy();
    await examineChip('L0.h1');
    expect(q('.wt-railchip[data-hid="L0.h1"]')?.getAttribute('data-state')).toBe('seen');
    expect(setItem).toHaveBeenCalled();
    vi.restoreAllMocks();
  });
});

describe('비용 프롬프트·설정', () => {
  it('유료 행동은 2탭: 칸을 탭해도 행동은 그대로이고, [들어간다]를 눌러야 쓴다', async () => {
    window.localStorage.setItem(STORAGE_KEYS.meta, JSON.stringify({ v: 1, plays: 1, endings: [], secrets: [], achievements: [], readLines: [], settings: {}, coach: ['hudTour', 'hubLegend', 'firstSpend'] }));
    render(<WitnessApp />);
    await flush();
    click(q('[data-testid=title-new]'));
    await flush();
    click(q('[data-testid=intro-skip]'));
    await flush();
    click(q('[data-testid=room-L1]'));
    await flush();
    expect(q('.wt-spend')?.textContent).toContain('처음 들어간다');
    expect(q('.wt-spend')?.textContent).toContain('12 → 11');
    expect(readRun()!.actions).toBe(12);
    clickText('닫기', q('.wt-spend')!);
    await flush();
    expect(q('.wt-spend')).toBeNull();
    expect(readRun()!.actions).toBe(12);
    click(q('[data-testid=room-L1]'));
    await flush();
    click(q('[data-testid=spend-yes]'));
    await flush();
    expect(readRun()!.actions).toBe(11);
    expect(readRun()!.screen.name).toBe('location');
  });

  it('남은 행동 1: 마지막 행동 시트(기본 포커스 [돌아간다]) · 2: 확인 시트(기본 포커스 [돌아간다])', async () => {
    window.localStorage.setItem(STORAGE_KEYS.meta, JSON.stringify({ v: 1, plays: 1, endings: [], secrets: [], achievements: [], readLines: [], settings: {}, coach: ['hudTour', 'hubLegend', 'firstSpend'] }));
    render(<WitnessApp />);
    await flush();
    click(q('[data-testid=title-new]'));
    await flush();
    click(q('[data-testid=intro-skip]'));
    await flush();
    // 행동을 2·1로 줄인다(저장 조작 대신 실제 화면 조작: 서재·주방·다용도실·옥상·증언들을 연다)
    for (const loc of ['L1', 'L2', 'L3', 'L4']) {
      await enterRoom(loc);
      await exitToHub();
    }
    for (const set of ['T01', 'T02', 'T03', 'T04']) {
      await openSetUI(set);
      await exitToHub();
    }
    expect(readRun()!.actions).toBe(4);
    await openSetUI('T05');
    await exitToHub();
    expect(readRun()!.actions).toBe(3);
    // 3 → 인라인(여기서 T06 은 잠김이라 열 수 없다) — 손님방도 잠김. 남은 유료 항목이 없으므로 수첩 정리(2회)로 2, 1을 만든다
    await tab_notebook();
    clickText('정리하기');
    await flush();
    click(q('[data-testid=spend-yes]'));
    await flush();
    await closeHintSheet();
    expect(readRun()!.actions).toBe(2);
    clickText('정리하기');
    await flush();
    // 남은 행동 2 → 확인 시트
    expect(q('.wt-sheet [data-testid=spend-yes]')).toBeTruthy();
    expect(document.activeElement?.textContent).toContain('돌아간다');
    expect(document.body.textContent).toContain('남은 행동 2 → 1');
    click(q('[data-testid=spend-yes]'));
    await flush();
    await closeHintSheet();
    expect(readRun()!.actions).toBe(1);
    expect(readRun()!.hints).toBe(2);
  });

  it('설정: 글자 크기·화면 효과가 쉘 속성에 즉시 반영되고 저장된다', async () => {
    render(<WitnessApp />);
    await flush();
    click(q('[data-testid=title-settings]'));
    await flush();
    expect(document.body.textContent).toContain('혼자서 즐기는 1인용 게임이에요. 기록은 이 기기에만 저장돼요.');
    click(q('[data-testid="set-text-xl"]'));
    click(q('[data-testid="set-fx-reduced"]'));
    click(q('[data-testid="set-speed-fast"]'));
    await flush();
    const shell = q('.wt-shell')!;
    expect(shell.getAttribute('data-text')).toBe('xl');
    expect(shell.getAttribute('data-fx')).toBe('reduced');
    expect(shell.getAttribute('data-speed')).toBe('fast');
    const meta = loadMeta(openStorage().storage);
    expect(meta.settings).toMatchObject({ text: 'xl', fx: 'reduced', speed: 'fast' });
  });
});

async function tab_notebook(): Promise<void> {
  const b = qa('.wt-tabbar button').find((x) => (x.getAttribute('aria-label') ?? '').includes('수첩'));
  click(b ?? null, '수첩 탭');
  await flush();
}

async function closeHintSheet(): Promise<void> {
  await flush(10);
  for (let i = 0; i < 6; i++) {
    const tap = q('.wt-sheet--hint .wt-dialogue-tap');
    if (!tap) break;
    click(tap);
    await flush();
  }
  click(q('[data-testid=hint-close]'), '수첩 정리 닫기');
  await flush();
}

void spendIfAsked;
