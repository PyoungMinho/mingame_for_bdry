// @vitest-environment jsdom
/**
 * 밸런스 개정(행동 13 · 사이렌 뒤 재방문 · 「수사 종료」) 화면 테스트 — docs/planning/witness-balance.md.
 * 문구·HUD 점 개수·마지막 행동 시트·규칙 카드·옛 저장 이어하기. 사이렌 뒤 흐름 자체는 witness.flows 의 '사이렌' 묶음.
 */
import { cleanup, render } from '@testing-library/react';
import { renderToStaticMarkup } from 'react-dom/server';
import { createElement as h } from 'react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { CASE, RULES, STORAGE_KEYS, newRun, setScreen, type RunState } from '@/lib/witness';
import { HOOKS } from '@/lib/witness/share';
import { freeClosure, playPath } from '@/lib/witness/validate';
import { IntroCutArt } from './art/intro/IntroCut';
import { metadata } from './layout';
import { END_SHEET, GLOSSARY, HUD_TOUR, LAST_ACTION, SIREN_SUB, TITLE_TEXT, TOAST } from './lib/copy';
import { fxConfig } from './lib/fx';
import { WitnessApp } from './screens/WitnessApp';
import { click, flush, q, qa, readRun, settle } from './testkit';

const ALL_COACH = ['firstDot', 'acquire', 'freeLook', 'lineNav', 'press', 'present', 'result', 'hudTour', 'hubLegend', 'firstSpend', 'firstHalf', 'firstRedirect', 'firstWrong', 'firstQuestion', 'firstStar', 'firstUpgrade', 'firstTrust1', 'hintAdvice', 'sheetTip1', 'sheetTip2', 'sheetTip3', 'timelineNote'];

function seed(run: unknown): void {
  window.localStorage.setItem(STORAGE_KEYS.run, JSON.stringify(run));
  window.localStorage.setItem(
    STORAGE_KEYS.meta,
    JSON.stringify({ v: 1, plays: 1, endings: [], secrets: [], achievements: [], readLines: [], settings: { speed: 'instant' }, coach: ALL_COACH }),
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

describe('문구 — 행동 13', () => {
  it('규칙 상수 13 · 22:50, 문구 전부 13번(12번이 남지 않았다)', () => {
    expect(RULES.normal.actions).toBe(13);
    expect(RULES.normal.startMinute).toBe(22 * 60 + 50);
    expect(String(metadata.description)).toContain('행동 13번 안에 거짓말을 깨라');
    expect(TITLE_TEXT.hook.join(' ')).toContain('행동 13번');
    expect(HOOKS[3]).toContain('행동 13번');
    expect(HUD_TOUR[0].text).toBe('시계와 점은 행동이에요. 13번이 다 지나면 사이렌이 울려요.');
    expect(GLOSSARY.find((g) => g.term === '행동')!.desc).toContain('13번');
    expect(CASE.rules[0]).toContain('행동 13번');
    const all = [String(metadata.description), ...TITLE_TEXT.hook, ...HOOKS, HUD_TOUR[0].text, GLOSSARY[0].desc, ...CASE.rules].join(' ');
    expect(all).not.toMatch(/12번/);
  });

  it('사이렌 안내·마지막 행동 시트·토스트 문구', () => {
    expect(LAST_ACTION.body2).toBe('끝나면 새 수사는 끝. 이미 연 곳은 다시 볼 수 있다.');
    expect(SIREN_SUB.short(2)).toBe('새 수사는 끝이다. 이미 연 곳은 다시 볼 수 있다. 결정적 모순이 2개 더 필요하다.');
    expect(SIREN_SUB.ready).toContain('이미 연 곳을 다시 보고');
    expect(TOAST.sirenLocked).toBe('사이렌 뒤엔 새로운 곳에 못 가요');
    expect(TOAST.zeroInside).toContain('이미 연 곳은 그 뒤에도 다시 볼 수 있다');
    expect(END_SHEET).toMatchObject({ title: '수사를 끝낼까요?', no: '더 본다', yes: '끝낸다' });
    expect(END_SHEET.body(2)).toBe('지목하려면 결정적 모순이 2개 더 필요해요.');
    // 금지 단어(제한·불가·페널티)를 새 문구에 쓰지 않는다
    for (const t of [LAST_ACTION.body2, SIREN_SUB.ready, SIREN_SUB.short(1), TOAST.sirenLocked, TOAST.zeroInside, END_SHEET.title, END_SHEET.lead, END_SHEET.body(1), END_SHEET.newSet]) expect(t).not.toMatch(/제한|불가|페널티/);
  });

  it('인트로 시계 컷은 22:50', () => {
    const html = renderToStaticMarkup(h(IntroCutArt, { art: 'clock' }));
    expect(html).toContain('22:50');
    expect(html).not.toContain('23:00');
  });
});

describe('화면 — 행동 13', () => {
  it('허브 HUD 점 13개(켜진 점 13) · 시계 22:50 · 읽어 주는 문구', async () => {
    seed(setScreen(freeClosure(newRun({ now: Date.now(), skipTutorial: true })), { name: 'hub', tab: 'house' }));
    await boot();
    expect(qa('.wt-hud--hub .wt-pips .wt-pip').length).toBe(13);
    expect(qa('.wt-hud--hub .wt-pips .wt-pip.is-on').length).toBe(13);
    expect(q('[aria-label^="행동 13번 남음"]')).toBeTruthy();
    expect(q('.wt-hud--hub .wt-clock')?.textContent).toBe('22:50');
    expect(q('.wt-hud-row3')?.textContent).toContain('130분');
  });

  it('조사 HUD 가는 줄(hairline) 13칸', async () => {
    const r = freeClosure(newRun({ now: Date.now(), skipTutorial: true }));
    seed({ ...r, screen: { name: 'location', ref: 'L0' } });
    await boot();
    expect(qa('.wt-hair .wt-hair-seg').length).toBe(13);
  });

  it('마지막 행동 시트 본문(남은 행동 1)', async () => {
    const r = playPath(['L3', 'T05', 'L1', 'T03', 'T02', 'L2', 'T04']);
    seed({ ...r, actions: 1, screen: { name: 'hub', tab: 'notebook' } });
    await boot();
    const btn = [...document.querySelectorAll('button')].find((b) => (b.textContent ?? '').includes('정리하기'));
    click(btn ?? null, '정리하기');
    await flush();
    const body = document.body.textContent ?? '';
    expect(body).toContain('이게 마지막 행동이다.');
    expect(body).toContain('끝나면 새 수사는 끝. 이미 연 곳은 다시 볼 수 있다.');
    // v4 축소(UX-6): ★ ≥ 3 이면 변형 줄·보조 줄이 없다
    expect(q('.wt-sheet--last .wt-last-note')).toBeNull();
    expect(q('.wt-sheet--last .wt-last-sub')).toBeNull();
    expect(body).not.toContain('다시 못 들어간다');
    expect(body).not.toContain('최종 지목 칸엔 넣을 수 있다');
  });
});

describe('옛 저장(행동 12 규칙) 이어하기', () => {
  it('진행 중인 옛 판 — 이어하기 카드에 행동 +1, 허브가 같은 자리에서 열린다', async () => {
    const r = playPath(['L3', 'T05', 'L1']);
    expect(r.actions).toBe(10);
    const old = JSON.parse(JSON.stringify({ ...r, actions: 9, screen: { name: 'hub', tab: 'house' } })) as Record<string, unknown>;
    delete old.rev; // 옛 규칙 저장 — 남은 9
    seed(old);
    render(<WitnessApp />);
    await flush();
    await flush();
    expect(q('[data-testid=title-resume]')?.textContent).toContain('행동 10 남음');
    click(q('[data-testid=title-resume]'));
    await settle();
    expect(q('.wt-screen--hub')).toBeTruthy();
    expect(q('[aria-label^="행동 10번 남음"]')).toBeTruthy();
    const run = readRun() as RunState;
    expect(run.actions).toBe(10);
    expect(run.rev).toBe(2);
    expect(run.evidence).toEqual(r.evidence);
  });
});
