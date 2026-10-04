// @vitest-environment jsdom
/**
 * 블라인드 공정성 지적(v3 · 2026-10-05) 화면 회귀 — 엔진 판정은 src/lib/witness/fairness.test.ts.
 *  F1 「불 꺼진 서재」 5번 줄에 특허 출원서 → 감점 없는 우회(R-09) · 수첩 의문 Q07 이 풀리고 답이 적힌다.
 *  F2 「치킨은 죄가 없다」 3번 줄에 청소기 예약 기록 → 반쯤 맞음(감점 없음).
 *  F3 대질 「또박이는 들었다」: 2번 줄 돌파 즉시 음성 명령 카드가 「해석 정정」, 4번 줄 돌파 뒤 「위조」.
 *  F4 관리자 키로 연 줄(T05.6)에 「권한 해제」 + 진술이 보인다(빈 「정정」 칸 버그).
 */
import { cleanup, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { STORAGE_KEYS, getEvidence, judgePresent, openSet, visibleLines, type RunState } from '@/lib/witness';
import { playPath } from '@/lib/witness/validate';
import { fxConfig } from './lib/fx';
import { WitnessApp } from './screens/WitnessApp';
import { click, flush, gotoLine, presentUI, q, qa, readRun, settle } from './testkit';

const ALL_COACH = ['firstDot', 'acquire', 'freeLook', 'lineNav', 'press', 'present', 'result', 'hudTour', 'hubLegend', 'firstSpend', 'firstHalf', 'firstRedirect', 'firstWrong', 'firstQuestion', 'firstStar', 'firstUpgrade', 'firstTrust1', 'hintAdvice', 'sheetTip1', 'sheetTip2', 'sheetTip3', 'timelineNote'];

function seed(run: RunState): void {
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
  const resume = q('[data-testid=title-resume]');
  if (resume) click(resume, '이어하기');
  await settle();
}

async function openNotebook(tabId: 'evidence' | 'questions'): Promise<void> {
  click(q('button[aria-label^="수첩"]'), '수첩 버튼');
  await flush();
  click(q(`[data-testid=nbtab-${tabId}]`), `수첩 ${tabId} 탭`);
  await flush();
}

const lineIndex = (run: RunState, setId: string, lineId: string) => visibleLines(run, setId).findIndex((x) => x.line.id === lineId);

beforeEach(() => {
  window.localStorage.clear();
  window.sessionStorage.clear();
  fxConfig.scale = 0;
});
afterEach(() => {
  cleanup();
  fxConfig.scale = 1;
});

describe('블라인드 공정성 지적 — 화면', () => {
  it('F1 T07.5 에 특허 출원서: 신뢰·오답 그대로(우회) · 의문 Q07 풀림 + 답', async () => {
    const run = openSet(playPath(['L2', 'P:L2.h3', 'T04']), 'T07').run;
    expect(judgePresent(run, 'T07.5', ['E09']).kind).toBe('REDIRECT');
    seed(run);
    await boot();
    await gotoLine(lineIndex(run, 'T07', 'T07.5'));
    await presentUI(['E09']);
    const after = readRun()!;
    expect(after).toMatchObject({ trust: run.trust, wrong: run.wrong });
    await openNotebook('questions');
    const ans = qa('.wt-q-ans').map((x) => x.textContent ?? '');
    expect(ans.some((t) => t.includes("1999년 특허. 발명자 '…명환', 출원인은 회장."))).toBe(true);
  });

  it('F2 T08.3 에 청소기 예약 기록: 반쯤 맞음(감점 없음), 줄은 그대로', async () => {
    const run = openSet(playPath(['L1', 'T03', 'T08']), 'T08').run;
    expect(run.evidence).toContain('E05');
    expect(judgePresent(run, 'T08.3', ['E05']).kind).toBe('HALF');
    seed(run);
    await boot();
    await gotoLine(lineIndex(run, 'T08', 'T08.3'));
    await presentUI(['E05']);
    const after = readRun()!;
    expect(after).toMatchObject({ trust: run.trust, wrong: run.wrong });
    expect(after.broken).not.toContain('C14');
  });

  it('F3 대질 T10: 2번 줄 돌파 → 「해석 정정」 카드, 4번 줄 돌파 → 「위조」 카드', async () => {
    const base = playPath(['L3', 'T05', 'L1', 'T03', 'T02', 'L2', 'T04']);
    const run = openSet(
      { ...base, broken: base.broken.filter((b) => b !== 'C11' && b !== 'C13'), evidence: base.evidence.map((e) => (e === 'E03b' ? 'E03' : e)) },
      'T10',
    ).run;
    seed(run);
    await boot();
    await gotoLine(lineIndex(run, 'T10', 'T10.2'));
    await presentUI(['E05', 'E15']);
    let after = readRun()!;
    expect(after.broken).toContain('C11');
    expect(after.evidence).toContain('E03a');
    expect(after.evidence).not.toContain('E03');
    await gotoLine(lineIndex(after, 'T10', 'T10.4'));
    await presentUI(['E16']);
    after = readRun()!;
    expect(after.evidence).toContain('E03b');
    expect(after.evidence).not.toContain('E03a');
    await openNotebook('evidence');
    const forged = qa('.wt-chip--forged').length;
    expect(forged).toBeGreaterThan(0);
    expect(getEvidence('E03a')?.reliability).toBe('revised');
  });

  it('F3b 해석 정정 카드는 수첩에서 「해석 정정」 태그로 보인다', async () => {
    const base = playPath(['L3', 'T05', 'L1', 'T03', 'T02', 'L2', 'T04']);
    const run = { ...base, broken: base.broken.filter((b) => b !== 'C13'), evidence: base.evidence.map((e) => (e === 'E03b' ? 'E03a' : e)), screen: { name: 'hub' as const, tab: 'house' as const } };
    seed(run);
    await boot();
    await openNotebook('evidence');
    expect(qa('.wt-chip--revised').some((x) => (x.textContent ?? '').includes('해석 정정'))).toBe(true);
  });

  it('F4 관리자 키로 연 T05.6 — 「권한 해제」 + 진술이 비지 않는다', async () => {
    const run = openSet(playPath(['T05', 'T01']), 'T05').run;
    expect(run.broken).toContain('C06');
    seed(run);
    await boot();
    await gotoLine(lineIndex(run, 'T05', 'T05.6'));
    const rev = q('.wt-linecard-revised');
    expect(rev?.textContent).toContain('권한 해제');
    expect(rev?.textContent).toContain('관리자 권한 확인. 공백의 상세를 말씀드립니다.');
  });
});
