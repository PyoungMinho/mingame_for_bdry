/**
 * 경로 탐색 검증(BFS) — 실제 엔진 + 무료 행동 closure 로 유료 항목 부분집합을 층별로 탐색.
 * 시스템 2-3·6-8: 완벽 최단 8~9 · 첫 3수가 다른 완벽 경로 ≥ 2 · ★ 전부 10~11 · 전체 유료 14 · soft-lock 없음 ·
 * 필수 증거 획득 가능 · B 최저 · ★3 최단이 범인 사슬만으로 닫히지 않음(6-6 11번) · 엔딩 8종 도달.
 */
import { beforeAll, describe, expect, it } from 'vitest';
import { CASE } from './case-data';
import {
  STAR_TOTAL,
  continueAfterSiren,
  enterLocation,
  examine,
  exit,
  hint,
  newRun,
  openSet,
  pickCulprit,
  present,
  rewind,
  setSlot,
  stars,
  startAccuse,
  submitAccusation,
  type Accusation,
  type RunState,
} from './engine';
import type { EndingId, SuspectId } from './types';
import { accuseOptions, afterSiren, analyzeEconomy, freeClosure, paidItems, playPath, type EconomyReport } from './validate';

const CULPRIT = CASE.solution.culprit;
const INNOCENTS = (['S1', 'S2', 'S3', 'S4'] as SuspectId[]).filter((s) => s !== CULPRIT);
const PERFECT_MIN = ['L3', 'T05', 'L1', 'T03', 'T02', 'L2', 'T04', 'P:L2.h3'];

function accuse(run: RunState, a: Accusation): RunState {
  let r = startAccuse(run).run;
  expect(r.accuse).toBeTruthy();
  r = pickCulprit(r, a.culprit).run;
  r = setSlot(r, 'means', a.means).run;
  r = setSlot(r, 'opportunity', a.opportunity).run;
  r = setSlot(r, 'motive', a.motive).run;
  const s = submitAccusation(r);
  expect(s.error).toBeUndefined();
  return s.run;
}

const perfectAcc = (): Accusation => ({
  culprit: CULPRIT,
  means: CASE.solution.accept.means[0],
  opportunity: CASE.solution.accept.opportunity[0],
  motive: CASE.solution.accept.motive[0],
});

let R: EconomyReport;
beforeAll(() => {
  R = analyzeEconomy(12);
});

describe('행동 경제(BFS, 예산 12)', () => {
  it('유료 항목은 14개(처음 열림 10 + ◆ 해금 4)', () => {
    expect(R.items.length).toBe(14);
    expect(paidItems().filter((i) => i.kind === 'precise').length).toBe(2);
  });

  it('완벽 해결 최단 = 8 (∈ [8, 9]) — 필요 집합은 바이블 8-2 와 같다', () => {
    expect(R.minPerfect).toBe(8);
    expect(R.minPerfect! >= 8 && R.minPerfect! <= 9).toBe(true);
    expect(R.minPerfectSets.map((s) => [...s].sort())).toEqual([['L1', 'L2', 'L3', 'P:L2.h3', 'T02', 'T03', 'T04', 'T05']]);
  });

  it('첫 3수가 서로 다른 완벽 경로가 2개 이상', () => {
    expect(R.perfectFirst3.length).toBeGreaterThanOrEqual(2);
    const keys = R.perfectFirst3.map((s) => [...s].sort().join(','));
    // 바이블 경로 A·B·C 의 첫 3수
    expect(keys).toContain(['L1', 'L3', 'T05'].sort().join(','));
    expect(keys).toContain(['L2', 'P:L2.h3', 'T04'].sort().join(','));
    expect(keys).toContain(['L1', 'T02', 'T03'].sort().join(','));
  });

  it('★ 전부 최단 10, S(완벽 + ★ 전부) 최단 11 — 둘 다 [10, 11]', () => {
    expect(R.minAllStars).toBe(10);
    const sMin = R.layers.find((l) => l.sPerfect > 0)?.k;
    expect(sMin).toBe(11);
  });

  it('★3(지목 게이트) 최단 4 — 재료 출처 2곳 이상, 범인 세트만으로 닫히지 않음(6-6 11번)', () => {
    expect(R.minStar3).toBe(4);
    expect(R.star3MinSources).toBeGreaterThanOrEqual(2);
    expect(R.star3CulpritOnly).toBe(false);
  });

  it('B등급 최저 = 5 (바이블 8-5)', () => {
    expect(R.minB).toBe(5);
  });

  it('숨은 엔딩 최단 10, S + 숨은 엔딩 = 12(예산 전부, 마지막 행동 순서까지 펼침)', () => {
    expect(R.minHidden).toBe(10);
    expect(R.minSHidden).toBe(12);
  });

  it('soft-lock 없음 — 행동이 남았는데 할 것도 지목도 없는 상태 0', () => {
    expect(R.reachable).toBeGreaterThan(1000);
    expect(R.stuck).toBe(0);
  });

  it('무제한 행동이면 모든 콘텐츠가 열린다(돌파 15/15, 증거 18/18 + 갱신 2, 숨은 엔딩 조건)', () => {
    expect(R.full).toEqual({ items: 14, breaks: 15, breakTotal: 15, evidence: 18, evidenceTotal: 18, upgrades: 2, hidden: true, perfect: true });
  });

  it('예산 12로는 전부 못 본다(14 > 12) — 2개 이상은 반드시 놓친다', () => {
    expect(R.items.length - R.budget).toBeGreaterThanOrEqual(2);
  });
});

describe('바이블 경로 재생(실제 엔진)', () => {
  it('경로 A(AI 기록부터) — 유료 8, 완벽 해결 A, 강력팀 도착 40분 전', () => {
    const run = playPath(PERFECT_MIN);
    expect(run.actions).toBe(4);
    expect(accuseOptions(run).perfect).toBe(true);
    const end = accuse(run, perfectAcc());
    expect(end.result).toMatchObject({ ending: 'perfect', grade: 'A', actionsLeft: 4, hiddenTeaser: true });
  });

  it('경로 B(준혁 알리바이부터) — 유료 8', () => {
    const run = playPath(['L2', 'P:L2.h3', 'T04', 'T05', 'L3', 'L1', 'T03', 'T02']);
    expect(run.actions).toBe(4);
    expect(accuseOptions(run).perfect).toBe(true);
  });

  it('경로 C(사람의 비밀부터) — 유료 8', () => {
    const run = playPath(['T03', 'L1', 'T02', 'L3', 'T05', 'L2', 'T04', 'P:L2.h3']);
    expect(accuseOptions(run).perfect).toBe(true);
  });

  it('필수 증거(정답 칸)는 전부 완벽 경로에서 얻는다', () => {
    const run = playPath(PERFECT_MIN);
    for (const slot of ['means', 'opportunity', 'motive'] as const)
      expect(CASE.solution.accept[slot].some((id) => run.evidence.includes(id))).toBe(true);
  });

  it('하나라도 빼면 완벽 해결 불가(필요 집합의 최소성)', () => {
    for (let i = 0; i < PERFECT_MIN.length; i++) {
      const keys = PERFECT_MIN.filter((_, j) => j !== i);
      let run: RunState | null = null;
      try {
        run = playPath(keys);
      } catch {
        run = null; // P1 은 서재 없이 못 한다
      }
      if (run) expect(accuseOptions(run).perfect).toBe(false);
    }
  });
});

describe('엔딩 8종 도달', () => {
  const reached = new Set<EndingId>();

  it('완벽 해결', () => {
    const end = accuse(playPath(PERFECT_MIN), perfectAcc());
    reached.add(end.result!.ending);
    expect(end.result!.ending).toBe('perfect');
  });

  it('숨은 엔딩(완벽 + T06.5 추궁 + 비밀 셋) — 유료 10', () => {
    const run = playPath([...PERFECT_MIN, 'T01', 'T06']);
    const end = accuse(run, perfectAcc());
    reached.add(end.result!.ending);
    expect(end.result).toMatchObject({ ending: 'hidden', grade: 'A', hiddenTeaser: false });
  });

  it('S 등급 = 완벽 + ★ 7/7 + 틀린 제시 ≤ 2 — 유료 11', () => {
    const run = playPath([...PERFECT_MIN, 'T01', 'L5', 'P:L5.h3']);
    expect(stars(run)).toBe(STAR_TOTAL);
    const end = accuse(run, perfectAcc());
    expect(end.result).toMatchObject({ ending: 'perfect', grade: 'S', title: CASE.titles.S });
  });

  it('범인 맞힘·증거 부족 — 2칸이면 B, 1칸이면 C (B 최저 유료 5)', () => {
    const run = playPath(['L2', 'P:L2.h3', 'T04', 'T05', 'L3']);
    expect(stars(run)).toBeGreaterThanOrEqual(3);
    const b = accuse(run, { culprit: CULPRIT, means: 'E02', opportunity: 'E04', motive: 'E09' });
    reached.add(b.result!.ending);
    expect(b.result).toMatchObject({ ending: 'short', grade: 'B', title: CASE.titles.B });
    const c = accuse(run, { culprit: CULPRIT, means: 'E06', opportunity: 'E04', motive: 'E09' });
    expect(c.result).toMatchObject({ ending: 'short', grade: 'C', title: CASE.titles.short });
  });

  it('오인 체포 ×3 — 지목한 사람마다 다른 엔딩, C', () => {
    const run = playPath(['L2', 'P:L2.h3', 'T04', 'T05', 'L3']);
    for (const s of INNOCENTS) {
      const end = accuse(run, { culprit: s, means: 'E02', opportunity: 'E04', motive: 'E09' });
      reached.add(end.result!.ending);
      expect(end.result).toMatchObject({ ending: `wrong-${s}`, grade: 'C', title: CASE.titles.wrong });
    }
  });

  it('시간 초과 — 행동 0 + ★ < 3 → 사이렌 → 시간 초과', () => {
    // 제시 없이 돌아다니기만 10번 + 수첩 정리 2번 = 12
    const run = wander(freeClosure(newRun()), ['L1', 'L2', 'L3', 'L4', 'T01', 'T02', 'T03', 'T04', 'T05', 'P:L2.h3']);
    expect(run.actions).toBe(2);
    const h1 = hint(run).run;
    const last = hint(h1);
    expect(last.events.some((e) => e.t === 'siren')).toBe(true);
    expect(stars(last.run)).toBeLessThan(3);
    const end = continueAfterSiren(last.run).run;
    reached.add(end.result!.ending);
    expect(end.result).toMatchObject({ ending: 'timeout', grade: 'C', title: CASE.titles.timeout, actionsLeft: 0 });
  });

  it('수사 배제 — 신뢰 0 → 엔딩, 되감기는 신뢰 max(체크포인트, 2)', () => {
    let run = playPath(['T01']);
    for (let i = 0; i < 3; i++) run = present(run, 'T01.1', ['E01']).run;
    expect(run.trust).toBe(2);
    run = exit(run).run;
    run = openSet(run, 'T02').run;
    const actionsBefore = run.actions + 1;
    for (let i = 0; i < 2; i++) run = present(run, 'T02.1', ['E01']).run;
    expect(run.phase).toBe('ended');
    reached.add(run.result!.ending);
    expect(run.result).toMatchObject({ ending: 'excluded', grade: 'C', title: CASE.titles.excluded });
    const back = rewind(run).run;
    expect(back).toMatchObject({ phase: 'play', trust: 2, rewound: true, actions: actionsBefore });
    expect(back.opened).not.toContain('T02');
  });

  it('되감기를 쓴 판은 ★ 전부 + 무결점이어도 S 불가(A)', () => {
    let run = playPath(['T01']);
    for (let i = 0; i < 5; i++) run = present(run, 'T01.1', ['E01']).run;
    expect(run.result?.ending).toBe('excluded');
    const back = rewind(run).run;
    expect(back).toMatchObject({ trust: 5, wrong: 0, rewound: true });
    const solved = playPath([...PERFECT_MIN, 'T01', 'L5', 'P:L5.h3'], freeClosure(back));
    expect(stars(solved)).toBe(STAR_TOTAL);
    const end = accuse(solved, perfectAcc());
    expect(end.result).toMatchObject({ ending: 'perfect', grade: 'A' });
  });

  it('8종 전부', () => {
    expect([...reached].sort()).toEqual(['excluded', 'hidden', 'perfect', 'short', 'timeout', ...INNOCENTS.map((s) => `wrong-${s}`)].sort());
  });
});

describe('사이렌 규칙이 경로에 주는 영향(시스템 2-5)', () => {
  it('12번째 행동이 정밀 조사면 그 증거는 증언에 못 쓴다(★7 불가)', () => {
    const run = playPath([...PERFECT_MIN, 'T01', 'L5', 'T06', 'P:L5.h3']);
    expect(run.evidence).toContain('E17');
    expect(stars(run)).toBe(5);
    expect(run.phase).toBe('siren');
  });

  it('T06 을 12번째로 열면 끝까지 해서 숨은 엔딩 + ★7(S) 가능', () => {
    const run = playPath([...PERFECT_MIN, 'T01', 'L5', 'P:L5.h3', 'T06']);
    expect(run.phase).toBe('siren');
    expect(stars(run)).toBe(STAR_TOTAL);
    expect(accuseOptions(run).hidden).toBe(true);
    const forced = afterSiren(run);
    expect(forced.accuse?.forced).toBe(true);
    const end = submitAccusation(pickSlots(forced, perfectAcc())).run;
    expect(end.result).toMatchObject({ ending: 'hidden', grade: 'S', actionsLeft: 0 });
  });
});

// ── 도우미 ──

function pickSlots(run: RunState, a: Accusation): RunState {
  let r = pickCulprit(run, a.culprit).run;
  r = setSlot(r, 'means', a.means).run;
  r = setSlot(r, 'opportunity', a.opportunity).run;
  return setSlot(r, 'motive', a.motive).run;
}

/** 유료 항목을 쓰되 제시는 하지 않는다(장소는 일반 핫스팟만 보고 나옴) */
function wander(from: RunState, keys: string[]): RunState {
  let r = from;
  for (const k of keys) {
    const it = paidItems().find((x) => x.key === k)!;
    if (it.kind === 'set') {
      const s = openSet(r, it.id);
      expect(s.error).toBeUndefined();
      r = exit(s.run).run;
      continue;
    }
    const loc = CASE.locations.find((l) => l.id === it.id || l.hotspots.some((h) => h.id === it.id))!;
    const e = enterLocation(r, loc.id);
    expect(e.error).toBeUndefined();
    r = e.run;
    for (const h of loc.hotspots) {
      if (h.precise && h.id !== it.id) continue;
      if (!h.precise && it.kind === 'precise') continue;
      const x = examine(r, h.id);
      if (!x.error) r = x.run;
    }
    r = exit(r).run;
  }
  return r;
}
