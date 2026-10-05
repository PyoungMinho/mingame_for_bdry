// @vitest-environment jsdom
/**
 * 화면 흐름 테스트 — 저장된 판을 심어 놓고(엔진으로 만든 상태) 화면 조작으로 분기를 확인한다.
 * 오답/반쯤/우회 · 수사 배제와 되감기 · 사이렌(★ 게이트 유/무) · 새로고침 복원(결과 카드, 줄 위치) · 마지막 행동 수첩 정리 · 키보드·접근성.
 */
import { act, cleanup, fireEvent, render } from '@testing-library/react';
import { renderToString } from 'react-dom/server';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  CASE,
  STORAGE_KEYS,
  enterLocation,
  examine,
  getEvidence,
  judgePresent,
  loadMeta,
  newRun,
  openSet,
  openStorage,
  present,
  setScreen,
  visibleLines,
  type RunState,
} from '@/lib/witness';
import { freeClosure, playPath } from '@/lib/witness/validate';
import { metadata, viewport } from './layout';
import { fxConfig } from './lib/fx';
import { WitnessApp } from './screens/WitnessApp';
import { click, clickText, flush, gotoLine, presentUI, q, qa, readRun, settle } from './testkit';

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
  click(q('[data-testid=title-resume]'), '이어하기');
  await settle();
}

beforeEach(() => {
  window.localStorage.clear();
  window.sessionStorage.clear();
  fxConfig.scale = 0;
});
afterEach(() => {
  cleanup();
  fxConfig.scale = 1;
});

/** 튜토리얼을 끝낸 2회차 시작 상태 + 다용도실 + 또박이 기록(T05) 열림 */
function atT05(): RunState {
  let r = freeClosure(newRun({ now: Date.now(), skipTutorial: true }));
  r = enterLocation(r, 'L3').run;
  for (const h of CASE.locations.find((l) => l.id === 'L3')!.hotspots) if (!h.precise) r = examine(r, h.id).run;
  return openSet(r, 'T05').run;
}

describe('판정 5종의 화면 결과', () => {
  it('오답: 신뢰 −1 · 틀린 제시 +1, 줄은 그대로(깨지지 않음)', async () => {
    const run = atT05();
    seed(run);
    await boot();
    expect(q('.wt-test-panel')).toBeTruthy();
    expect(readRun()!.trust).toBe(5);
    await gotoLine(0);
    await presentUI(['E01']);
    const after = readRun()!;
    expect(after.trust).toBe(4);
    expect(after.wrong).toBe(1);
    expect(after.broken).toEqual(run.broken);
    expect(q('.wt-hud meter, .wt-hud [role=meter]')?.getAttribute('aria-valuenow')).toBe('4');
    expect(q('[data-testid=present]')).toBeTruthy();
  });

  it('반쯤 맞음: 감점 없음 · 신뢰 칸 그대로 · 직후 시트를 다시 열면 직전 카드가 슬롯 A 에 남아 있다', async () => {
    // 서재·표준혁 증언 뒤 열리는 「불 꺼진 서재」 4번 줄에 E02(트로피)만 내면 반쯤 맞음
    const run = openSet(playPath(['L2', 'T04']), 'T07').run;
    expect(judgePresent(run, 'T07.4', ['E02']).kind).toBe('HALF');
    seed(run);
    await boot();
    const idx = visibleLines(run, 'T07').findIndex((r) => r.line.id === 'T07.4');
    await gotoLine(idx);
    await presentUI(['E02']);
    const after = readRun()!;
    expect(after.trust).toBe(run.trust);
    expect(after.wrong).toBe(run.wrong);
    expect(after.broken).toEqual(run.broken);
    click(q('[data-testid=present]'));
    await flush();
    expect(q('.wt-slots')?.textContent).toContain(getEvidence('E02')!.name);
  });

  it('조합 제시: 한 장 고르고 [하나 더 겹치기] → [함께 제시]로 두 장을 내면 돌파(C10 = 트로피 + 트로피 조각)', async () => {
    const base = playPath(['L2', 'T04']);
    const run = openSet({ ...base, evidence: [...base.evidence, 'E04'] }, 'T07').run;
    expect(judgePresent(run, 'T07.4', ['E02', 'E04']).kind).toBe('BREAK');
    seed(run);
    await boot();
    await gotoLine(visibleLines(run, 'T07').findIndex((r) => r.line.id === 'T07.4'));
    click(q('[data-testid=present]'));
    await flush();
    const tap = (id: string) => click(qa('.wt-sheet button.wt-card-hit').find((b) => (b.getAttribute('aria-label') ?? '').startsWith(getEvidence(id)!.name)) ?? null, id);
    tap('E02');
    await flush();
    expect(qa('.wt-sheet button').some((b) => (b.textContent ?? '').includes('함께 제시'))).toBe(false);
    clickText('하나 더 겹치기');
    await flush();
    tap('E04');
    await flush();
    expect(q('.wt-slots')?.textContent).toContain(getEvidence('E02')!.name);
    expect(q('.wt-slots')?.textContent).toContain(getEvidence('E04')!.name);
    clickText('함께 제시');
    await settle();
    expect(readRun()!.broken).toContain('C10');
    expect(readRun()!.wrong).toBe(run.wrong);
  });

  it('우회: 감점 없음 · 줄은 그대로', async () => {
    // 주방 태블릿(E05)을 선우강 4번 줄에 내면 「따질 곳은 여기가 아니다」
    let r = freeClosure(newRun({ now: Date.now(), skipTutorial: true }));
    r = enterLocation(r, 'L1').run;
    r = examine(r, 'L1.h1').run;
    r = openSet(r, 'T01').run;
    expect(judgePresent(r, 'T01.4', ['E05']).kind).toBe('REDIRECT');
    seed(r);
    await boot();
    await gotoLine(visibleLines(r, 'T01').findIndex((x) => x.line.id === 'T01.4'));
    await presentUI(['E05']);
    const after = readRun()!;
    expect(after.trust).toBe(5);
    expect(after.wrong).toBe(0);
    expect(after.broken).toEqual(r.broken);
  });

  it('튜토리얼 오답은 감점이 없다', async () => {
    let r = newRun({ now: Date.now() });
    r = enterLocation(r, 'L0').run;
    for (const h of CASE.locations[0].hotspots) if (!h.precise && !h.unlock) r = examine(r, h.id).run;
    r = openSet(r, 'T00').run;
    seed(r);
    await boot();
    await gotoLine(0);
    await presentUI(['E02']);
    expect(readRun()!.trust).toBe(5);
    expect(readRun()!.wrong).toBe(0);
  });
});

describe('수사 배제와 되감기', () => {
  it('신뢰 0 → 연출이 끝난 뒤 W65 → [↺ 직전부터 다시]: 신뢰는 최소 2칸, S 등급 불가(rewound)', async () => {
    let run = atT05();
    // 신뢰를 1로 만든다(엔진): 오답 4번
    for (let i = 0; i < 4; i++) run = present(run, 'T05.1', ['E01']).run;
    expect(run.trust).toBe(1);
    seed(run);
    await boot();
    await gotoLine(0);
    await presentUI(['E01']);
    await settle();
    expect(q('.wt-excluded')).toBeTruthy();
    expect(q('[data-testid=excluded-rewind-sub]')?.textContent).toBe('증언 직전으로 · 최고 A');
    // 도감에는 이미 기록(수사 배제는 도감만)
    expect(loadMeta(openStorage().storage).endings).toContain('excluded');
    click(q('[data-testid=excluded-rewind]'));
    await flush();
    const back = readRun()!;
    expect(back.phase).toBe('play');
    expect(back.rewound).toBe(true);
    expect(back.trust).toBeGreaterThanOrEqual(2);
    expect(q('.wt-hud--hub')).toBeTruthy();
  });
});

describe('사이렌', () => {
  const sirenRun = (gate: boolean): RunState => {
    const base = gate ? playPath(['L3', 'T05', 'L1', 'T03', 'T02', 'L2', 'T04']) : playPath(['L3', 'T05']);
    return { ...base, actions: 0, phase: 'siren', final: [], screen: { name: 'siren' } };
  };

  it('★ ≥ 3: [계속] → 허브(자동 진행 없음) → [지목하기] — 지목 화면에서도 뒤로 갈 수 있다(밸런스 R6·R7)', async () => {
    seed(sirenRun(true));
    await boot();
    expect(q('.wt-siren')).toBeTruthy();
    expect(q('.wt-siren')?.textContent).toContain('새벽 1시. 사이렌이 들린다.');
    expect(q('.wt-siren')?.textContent).toContain('새 수사는 끝이다. 이미 연 곳을 다시 보고, 준비되면 지목하라.');
    click(q('[data-testid=siren-continue]'));
    await flush();
    // 허브로 돌아온다 — 강제 지목이 아니다
    expect(q('.wt-pick')).toBeNull();
    expect(q('.wt-screen--hub')).toBeTruthy();
    expect(readRun()).toMatchObject({ phase: 'siren', actions: 0 });
    expect(q('[data-testid=end-investigation]')).toBeNull();
    expect(q('[data-testid=accuse-bar]')?.textContent).toContain('지목하기');
    click(q('[data-testid=accuse-bar]'));
    await flush();
    expect(q('.wt-pick')).toBeTruthy();
    expect(q('.wt-pick-forced')).toBeNull();
    expect(readRun()!.accuse?.forced).toBe(false);
    const back = q('button[aria-label="지목 그만두고 돌아가기"]') as HTMLButtonElement;
    expect(back.disabled).toBe(false);
    click(back);
    await flush();
    expect(q('.wt-screen--hub')).toBeTruthy();
    expect(readRun()).toMatchObject({ phase: 'siren', actions: 0 });
  });

  it('옛 저장(사이렌 뒤 강제 지목 화면, forced:true)도 뒤로 갈 수 있다', async () => {
    const r = sirenRun(true);
    const old = { ...r, screen: { name: 'accuse' }, accuse: { stage: 'suspect', forced: true } } as unknown as RunState;
    seed(old);
    await boot();
    expect(q('.wt-pick')).toBeTruthy();
    expect(q('.wt-pick-forced')).toBeNull();
    expect((q('button[aria-label="지목 그만두고 돌아가기"]') as HTMLButtonElement).disabled).toBe(false);
  });

  it('★ < 3: [계속] → 허브 → [수사 종료](확인 시트, 기본 포커스 [더 본다]) → [끝낸다] → 「시간 초과」 · 등급 C', async () => {
    seed(sirenRun(false));
    await boot();
    expect(q('.wt-siren')?.textContent).toContain('새 수사는 끝이다. 이미 연 곳은 다시 볼 수 있다. 결정적 모순이 2개 더 필요하다.');
    click(q('[data-testid=siren-continue]'));
    await flush();
    expect(q('.wt-screen--hub')).toBeTruthy();
    expect(q('[data-testid=accuse-bar]')).toBeNull();
    click(q('[data-testid=end-investigation]'));
    await flush();
    expect(document.body.textContent).toContain('수사를 끝낼까요?');
    expect(document.body.textContent).toContain('지목하려면 결정적 모순이 2개 더 필요해요.');
    expect(document.activeElement?.textContent).toContain('더 본다');
    clickText('더 본다');
    await flush();
    expect(readRun()?.phase).toBe('siren'); // 취소하면 그대로
    click(q('[data-testid=end-investigation]'));
    await flush();
    click(q('[data-testid=end-yes]'));
    await flush();
    for (let i = 0; i < 20 && !q('.wt-ending-detail'); i++) {
      click(q('.wt-dialogue-tap'));
      await flush();
    }
    expect(q('.wt-ending-title')?.textContent).toBe(CASE.endings.timeout!.title);
    expect(q('.wt-grade')?.getAttribute('data-grade')).toBe('C');
    expect(window.localStorage.getItem(STORAGE_KEYS.run)).toBeNull();
  });

  it('사이렌 뒤 허브: 이미 연 곳은 무료로 다시 들어가고, 새 곳은 「사이렌 뒤엔 새로운 곳에 못 가요」', async () => {
    seed(sirenRun(false));
    await boot();
    click(q('[data-testid=siren-continue]'));
    await flush();
    const l1 = q('[data-testid=room-L1]');
    expect(l1?.getAttribute('data-state')).toBe('siren');
    click(l1);
    await flush();
    expect(document.body.textContent).toContain('사이렌 뒤엔 새로운 곳에 못 가요');
    expect(q('.wt-screen--loc')).toBeNull();
    const l3 = q('[data-testid=room-L3]');
    expect(l3?.getAttribute('data-state')).toBe('visited');
    click(l3);
    await flush();
    expect(q('.wt-screen--loc')).toBeTruthy();
    expect(readRun()).toMatchObject({ actions: 0, phase: 'siren' });
  });

  it('마지막 행동으로 수첩 정리를 쓰면 시트를 닫을 때 사이렌(그 전엔 시트가 열려 있다)', async () => {
    let r = playPath(['L3', 'T05', 'L1', 'T03', 'T02', 'L2', 'T04']);
    r = { ...r, actions: 1, screen: { name: 'hub', tab: 'notebook' } };
    seed(r);
    await boot();
    expect(q('.wt-notebook')).toBeTruthy();
    clickText('정리하기');
    await flush();
    // 마지막 행동 시트: 기본 포커스 [돌아간다]
    expect(document.body.textContent).toContain('이게 마지막 행동이다.');
    expect(document.activeElement?.textContent).toContain('돌아간다');
    click(q('[data-testid=spend-yes]'));
    await flush(10);
    expect(readRun()!.phase).toBe('siren');
    expect(q('.wt-siren')).toBeNull(); // 시트가 열려 있는 동안은 화면 전환을 잡아 둔다
    for (let i = 0; i < 6; i++) {
      const tap = q('.wt-sheet--hint .wt-dialogue-tap');
      if (!tap) break;
      click(tap);
      await flush();
    }
    click(q('[data-testid=hint-close]'));
    await flush();
    expect(q('.wt-siren')).toBeTruthy();
  });
});

describe('새로고침 복원', () => {
  it('판정 직후 결과 카드를 닫기 전에 새로고침하면 결과 카드부터 복원된다(screen.replay)', async () => {
    seed(atT05());
    await boot();
    // 공유기 기록 → ★ 돌파(3번 줄)
    const rows = visibleLines(readRun()!, 'T05');
    const idx = rows.findIndex((r) => r.line.breaks?.some((b) => b.id === 'C05'));
    expect(idx).toBeGreaterThanOrEqual(0);
    await gotoLine(idx);
    click(q('[data-testid=present]'));
    await flush();
    const card = qa('.wt-sheet button.wt-card-hit').find((b) => (b.getAttribute('aria-label') ?? '').startsWith(getEvidence('E11')!.name));
    click(card ?? null, '공유기 기록');
    await flush();
    clickText('이걸로!');
    // 결과 카드가 뜰 때까지(대사는 넘기되 카드는 닫지 않는다)
    for (let i = 0; i < 40 && !q('.wt-sheet--result'); i++) {
      await flush(3);
      const tap = q('.wt-dialogue-tap');
      if (tap) click(tap);
    }
    expect(q('.wt-sheet--result')).toBeTruthy();
    expect(readRun()!.screen.replay).toBe('C05');
    expect(readRun()!.screen.line).toBe(idx);
    cleanup();

    render(<WitnessApp />);
    await flush();
    await flush();
    click(q('[data-testid=title-resume]'));
    await flush();
    expect(q('.wt-sheet--result')).toBeTruthy();
    expect(q('.wt-result')?.getAttribute('data-tier')).toBe('star');
    expect(q('.wt-result-revised')?.textContent).toContain('정정 진술');
    click(q('[data-testid=result-continue]'));
    await flush();
    expect(readRun()!.screen.replay).toBeUndefined();
    // 같은 세트·같은 줄 위치
    expect(q(`.wt-linedot[aria-current="true"]`)?.getAttribute('aria-label')).toContain(`${idx + 1}번 줄`);
  });

  it('허브에서 마지막으로 본 탭이 복원된다', async () => {
    seed({ ...freeClosure(newRun({ now: Date.now(), skipTutorial: true })), screen: { name: 'hub', tab: 'people' } });
    await boot();
    expect(q('.wt-people')).toBeTruthy();
    expect(q('.wt-tab[data-active="1"]')?.textContent).toContain('사람');
  });
});

describe('수첩·키보드·접근성', () => {
  it('수첩 4탭: 증거 18칸(못 얻은 칸은 실루엣) · 타임라인(기록/주장) · 의문/정리된 것', async () => {
    seed(playPath(['L3', 'T05', 'L1', 'T03']));
    await boot();
    click(qa('.wt-tabbar button').find((b) => (b.getAttribute('aria-label') ?? '').includes('수첩')) ?? null);
    await flush();
    expect(qa('.wt-cardgrid .wt-card--S').length).toBe(18);
    expect(qa('.wt-card--silhouette').length).toBeGreaterThan(0);
    click(q('[data-testid=nbtab-timeline]'));
    await flush();
    expect(qa('.wt-tl-item[data-kind="record"]').length).toBeGreaterThan(0);
    expect(qa('.wt-tl-item[data-kind="claim"]').length).toBeGreaterThan(0);
    click(q('[data-testid=nbtab-questions]'));
    await flush();
    expect(document.body.textContent).toContain('정리된 것');
    expect(document.body.textContent).toContain('수첩 정리 메모');
  });

  it('N 키로 수첩 시트를 연다(조사·심문 중) · Esc 로 닫는다', async () => {
    seed(atT05());
    await boot();
    expect(q('.wt-sheet--notebook')).toBeNull();
    fireEvent.keyDown(window, { key: 'n' });
    await flush();
    expect(q('.wt-sheet--notebook')).toBeTruthy();
    fireEvent.keyDown(window, { key: 'Escape' });
    await flush();
    expect(q('.wt-sheet--notebook')).toBeNull();
  });

  it('←/→ 로 증언 줄을 넘기고 마지막 다음은 1번으로 순환한다', async () => {
    seed(atT05());
    await boot();
    const dots = qa('.wt-linedot').length;
    expect(dots).toBeGreaterThanOrEqual(5);
    for (let i = 0; i < dots; i++) {
      fireEvent.keyDown(window, { key: 'ArrowRight' });
      await flush();
    }
    expect(q('.wt-linedot[aria-current="true"]')?.getAttribute('aria-label')).toContain('1번 줄');
  });

  it('핵심 접근성: HUD 상태 영역 · 신뢰 meter · 핫스팟 레일 버튼 라벨(상태 포함) · 판정 role=alert', async () => {
    let r = freeClosure(newRun({ now: Date.now(), skipTutorial: true }));
    r = enterLocation(r, 'L3').run;
    seed(r);
    await boot();
    expect(q('.wt-hud [role=status]')).toBeTruthy();
    expect(q('[role=meter]')?.getAttribute('aria-valuemax')).toBe('5');
    const chips = qa('.wt-railchip');
    expect(chips.length).toBeGreaterThanOrEqual(3);
    for (const c of chips) expect(c.getAttribute('aria-label')).toMatch(/조사/);
    expect(chips.find((c) => c.getAttribute('data-hid') === 'L3.h1')?.getAttribute('aria-label')).toContain('기기');
  });

  it('왼손 모드·글자 크기·화면 효과 설정은 쉘 속성으로 반영된다', async () => {
    seed(freeClosure(newRun({ now: Date.now(), skipTutorial: true })), { settings: { speed: 'instant', leftHand: true, text: 'l', fx: 'short' } });
    await boot();
    const shell = q('.wt-shell')!;
    expect(shell.getAttribute('data-hand')).toBe('left');
    expect(shell.getAttribute('data-text')).toBe('l');
    expect(shell.getAttribute('data-fx')).toBe('short');
  });
});

describe('하이드레이션 · 뒤로가기', () => {
  it('서버 렌더는 타이틀 스켈레톤이다 — 저장을 읽지 않아 이어하기 카드가 없다(SSR/CSR 불일치 방지)', () => {
    seed(atT05());
    const html = renderToString(<WitnessApp />);
    expect(html).toContain('목격자는');
    expect(html).toContain('aria-busy="true"');
    expect(html).not.toContain('이어하기');
    expect(html).not.toContain('행동 13 남음');
  });

  it('뒤로가기(popstate): 열린 시트부터 닫고 → 조사·심문은 허브로 → 허브에서는 안내 토스트(두 번째는 나감)', async () => {
    seed(atT05());
    await boot();
    // 시트 열기 → 뒤로 = 시트만 닫힘
    fireEvent.keyDown(window, { key: 'n' });
    await flush();
    expect(q('.wt-sheet--notebook')).toBeTruthy();
    await act(async () => {
      window.dispatchEvent(new PopStateEvent('popstate'));
    });
    await flush();
    expect(q('.wt-sheet--notebook')).toBeNull();
    expect(q('.wt-test-panel')).toBeTruthy();
    // 심문 → 허브
    await act(async () => {
      window.dispatchEvent(new PopStateEvent('popstate'));
    });
    await flush();
    expect(readRun()!.screen.name).toBe('hub');
    expect(q('.wt-hud--hub')).toBeTruthy();
    // 허브에서 뒤로 = 토스트
    await act(async () => {
      window.dispatchEvent(new PopStateEvent('popstate'));
    });
    await flush();
    expect(document.body.textContent).toContain('한 번 더 누르면 나가요');
    expect(q('.wt-hud--hub')).toBeTruthy();
  });
});

describe('스포일러 가드 · 메타', () => {
  it('메타데이터·뷰포트에 인물·증거·트릭 어휘가 없다', () => {
    const text = JSON.stringify(metadata) + JSON.stringify(viewport);
    for (const n of Object.values(CASE.names)) if (n && n.length > 1) expect(text).not.toContain(n);
    for (const w of ['목소리', '녹음', '위조', '트로피', '특허', '청소기', '음성팩']) expect(text).not.toContain(w);
    expect(JSON.stringify(metadata)).toContain('혼자서 25분');
  });

  it('지목 1단계: 용의자 4명 카드의 DOM 구조가 같다(범인 표식 없음)', async () => {
    const full = playPath(['L3', 'T05', 'L1', 'T03', 'T02', 'L2', 'T04', 'P:L2.h3']);
    seed({ ...full, phase: 'play', screen: { name: 'accuse' }, accuse: { stage: 'suspect', forced: false } });
    await boot();
    const cards = qa('.wt-pickcard');
    expect(cards.length).toBe(4);
    const skeleton = (el: Element) =>
      el.outerHTML
        .replace(/<svg[\s\S]*?<\/svg>/g, '<svg/>') // 그림은 인물마다 다르다 — 틀(카드 구조)만 비교
        .replace(/data-testid="[^"]*"/g, '')
        .replace(/data-spk="[^"]*"/g, '')
        .replace(/ id="[^"]*"/g, '')
        .replace(/url\(#[^)]*\)/g, '')
        .replace(/#[0-9A-Fa-f]{6}/g, '#')
        .replace(/>[^<]+</g, '><')
        .replace(/aria-label="[^"]*"/g, '')
        .replace(/aria-describedby="[^"]*"/g, ''); // 직업 설명을 가리키는 id 참조(인물마다 id 가 다르다) — 틀만 비교
    const first = skeleton(cards[0]);
    for (const c of cards) expect(skeleton(c)).toBe(first);
    for (const c of cards) expect(c.getAttribute('class')).toBe(cards[0].getAttribute('class'));
  });
});

void setScreen;
