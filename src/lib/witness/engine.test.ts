/**
 * 엔진 단위 — 비용·무료 재방문·추궁·제시 판정 순서(돌파 → HALF → 우회 → 오답)·신뢰도·해금·대질·사이렌·힌트·
 * 지목 판정·엔딩·등급·놓친 증거. 그리고 손으로 한 완벽 해결 한 판(경로 A).
 */
import { describe, expect, it } from 'vitest';
import { CASE } from './case-data';
import {
  RULES,
  STAR_TOTAL,
  accuseWarn,
  addAchievement,
  cancelAccuse,
  endInvestigation,
  starsToGate,
  applyResultToMeta,
  caseFileUnlocked,
  clock,
  continueAfterSiren,
  costOf,
  diffOpened,
  endingSlots,
  enterLocation,
  evidenceCount,
  examine,
  exit,
  fillTemplate,
  getEvidence,
  hint,
  hintFor,
  holdings,
  judgeAccusation,
  judgePresent,
  lastActionKind,
  minutesLeft,
  missed,
  newMeta,
  newRun,
  openSet,
  pickCulprit,
  present,
  press,
  profiles,
  questions,
  rewind,
  rewindOption,
  canAccuse,
  rewindSlotsLeft,
  keepSavedRun,
  gradeCapOf,
  endingTitle,
  core,
  RECALL_ELIGIBLE,
  tutorialEvidence,
  recallable,
  recallPlan,
  absorbFound,
  isRecalled,
  endInvestigation as endInv,
  roomStatus,
  setSlot,
  setStatus,
  stars,
  startAccuse,
  submitAccusation,
  summaries,
  timeline,
  verdictScript,
  visibleHotspots,
  visibleLines,
  type Accusation,
  type EngineEvent,
  type RunState,
  type Step,
  type WitnessMeta,
} from './engine';
import { freeClosure, playPath } from './validate';

const CULPRIT = CASE.solution.culprit;
const ALL_EVIDENCE_NAMES = CASE.evidence.map((e) => e.name);

function must(s: Step): RunState {
  expect(s.error).toBeUndefined();
  return s.run;
}
const verdictOf = (s: Step) => s.events.find((e): e is Extract<EngineEvent, { t: 'verdict' }> => e.t === 'verdict');

/** 튜토리얼까지 손으로: 거실 조사 → 브리핑 C01 */
function tutorial(): RunState {
  let r = newRun({ now: 1000 });
  r = must(enterLocation(r, 'L0'));
  for (const h of ['L0.h1', 'L0.h2', 'L0.h3', 'L0.h4']) r = must(examine(r, h));
  r = must(exit(r));
  r = must(openSet(r, 'T00'));
  r = must(present(r, 'T00.3', ['E01']));
  return must(exit(r));
}

describe('새 판 · 튜토리얼', () => {
  it('행동 13 · 신뢰 5 · 22:50 · 사건 소개부터(규칙 개정 rev 2)', () => {
    const r = newRun();
    expect(r).toMatchObject({ actions: 13, trust: 5, wrong: 0, hints: 0, phase: 'play', rev: 2, screen: { name: 'intro' } });
    expect(clock(r)).toBe('22:50');
    expect(minutesLeft(r)).toBe(130);
  });

  it('튜토리얼(거실·브리핑)은 무료, 증거 3장 + ◆ C01', () => {
    const r = tutorial();
    expect(r.actions).toBe(13);
    expect(r.evidence).toEqual(['E01', 'E02', 'E03']);
    expect(r.broken).toEqual(['C01']);
    expect(stars(r)).toBe(0);
  });

  it('튜토리얼에서 틀려도 신뢰·틀린 제시 그대로', () => {
    let r = newRun();
    r = must(enterLocation(r, 'L0'));
    r = must(examine(r, 'L0.h1'));
    r = must(openSet(r, 'T00'));
    const s = present(r, 'T00.1', ['E01']);
    expect(verdictOf(s)).toMatchObject({ kind: 'WRONG', tutorial: true });
    expect(s.run).toMatchObject({ trust: 5, wrong: 0 });
  });

  it('2회차 건너뛰기 = 튜토리얼 증거 자동 획득 + 돌파 처리, 행동 그대로', () => {
    const r = newRun({ skipTutorial: true });
    expect(r).toMatchObject({ actions: 13, trust: 5, evidence: ['E01', 'E02', 'E03'], broken: ['C01'], screen: { name: 'hub' } });
    expect(r.checkpoint).toBeUndefined();
  });
});

describe('행동 경제(시스템 2-1)', () => {
  it('장소 첫 진입 1 · 재방문 0', () => {
    let r = tutorial();
    expect(costOf(r, { location: 'L1' })).toBe(1);
    const s = enterLocation(r, 'L1');
    expect(s.events).toContainEqual({ t: 'spent', cost: 1, left: 12 });
    r = must(exit(s.run));
    expect(costOf(r, { location: 'L1' })).toBe(0);
    const again = enterLocation(r, 'L1');
    expect(again.events).toEqual([]);
    expect(again.run.actions).toBe(12);
    expect(clock(again.run)).toBe('23:00');
  });

  it('일반 핫스팟은 무료, 정밀 조사는 +1(처음 한 번)', () => {
    let r = must(enterLocation(tutorial(), 'L2'));
    r = must(examine(r, 'L2.h1'));
    expect(r.actions).toBe(12);
    expect(costOf(r, { hotspot: 'L2.h3' })).toBe(1);
    r = must(examine(r, 'L2.h3'));
    expect(r.actions).toBe(11);
    expect(r.evidence).toContain('E09');
    expect(must(examine(r, 'L2.h3')).actions).toBe(11);
  });

  it('정밀 조사는 장소에 들어가야 한다', () => {
    expect(examine(tutorial(), 'L2.h3').error).toBe('not-visited');
  });

  it('세트 첫 열람 1 · 재진입 0 · 추궁·제시 0', () => {
    let r = must(openSet(tutorial(), 'T01'));
    expect(r.actions).toBe(12);
    r = must(press(r, 'T01.1'));
    r = must(present(r, 'T01.1', ['E02']));
    expect(r.actions).toBe(12);
    r = must(exit(r));
    expect(must(openSet(r, 'T01')).actions).toBe(12);
  });

  it('★ 해금(chain) 세트는 무료, ◆ 해금 세트·장소는 기본 비용, 대질은 ◆ 섞여도 무료', () => {
    const r = playPath(['L2', 'T04']);
    expect(r.opened).toContain('T07');
    expect(costOf(r, { set: 'T08' })).toBe(1);
    expect(costOf(r, { location: 'L5' })).toBe(1);
    expect(costOf(r, { set: 'T09' })).toBe(0);
    expect(costOf(r, { set: 'T10' })).toBe(0);
    expect(setStatus(r, 'T07')).toMatchObject({ state: 'opened', cost: 0 });
  });

  it('잠긴 장소·세트는 못 들어간다(잠김 문구는 스포 없음)', () => {
    const r = tutorial();
    expect(enterLocation(r, 'L5').error).toBe('locked');
    expect(openSet(r, 'T10').error).toBe('locked');
    expect(roomStatus(r, 'L5')).toMatchObject({ state: 'locked', lockedLabel: '문이 안에서 잠겨 있다. 손님 짐이 있다.' });
  });

  it('행동이 모자라면 못 쓴다 · 확인 필요 구간 · 마지막 행동 종류', () => {
    let r = tutorial();
    r = { ...r, actions: 1 };
    expect(lastActionKind(r, { location: 'L1' })).toBe('location');
    expect(lastActionKind(r, { set: 'T01' })).toBe('set');
    expect(lastActionKind(r, { hotspot: 'L2.h3' })).toBe('precise');
    expect(lastActionKind(r, 'hint')).toBe('hint');
    expect(lastActionKind({ ...r, actions: 2 }, { location: 'L1' })).toBeNull();
  });
});

describe('사이렌(시스템 2-5)', () => {
  it('행동 0이 된 세트는 끝까지 — 나오는 순간 사이렌, 새 곳은 막히고 이미 연 곳은 다시 열린다', () => {
    let r = { ...tutorial(), actions: 1 };
    r = must(openSet(r, 'T01'));
    expect(r.actions).toBe(0);
    r = must(press(r, 'T01.2'));
    expect(setStatus(r, 'T01').state).toBe('opened');
    const out = exit(r);
    expect(out.events).toContainEqual({ t: 'siren' });
    expect(out.run).toMatchObject({ phase: 'siren', screen: { name: 'siren' } });
    // 새로 돈이 드는 곳 — 막힘
    expect(openSet(out.run, 'T02').error).toBe('siren');
    expect(enterLocation(out.run, 'L1').error).toBe('siren');
    expect(roomStatus(out.run, 'L1').state).toBe('siren');
    expect(setStatus(out.run, 'T02').state).toBe('siren');
    // 이미 연 곳 — 무료로 다시(R3)
    expect(setStatus(out.run, 'T01').state).toBe('opened');
    expect(roomStatus(out.run, 'L0').state).toBe('visited');
    expect(must(openSet(out.run, 'T01')).actions).toBe(0);
    expect(must(enterLocation(out.run, 'L0')).actions).toBe(0);
  });

  it('사이렌 뒤: 이미 연 증언에서 추궁·제시가 정상 동작(R3) — 늦게 얻은 증거로 ★ 를 깰 수 있다(B10)', () => {
    // 13번째 행동이 정밀 조사(P:L5.h3 = E17) — 예전엔 그 증거를 증언에 못 썼다(12번째 행동 규칙)
    const before = playPath(['L3', 'T05', 'L1', 'T03', 'T02', 'L2', 'T04', 'P:L2.h3', 'T01', 'L5', 'T06', 'L4']);
    expect(before.actions).toBe(1);
    expect(before.evidence).not.toContain('E17');
    expect(stars(before)).toBe(5);
    const last = playPath(['P:L5.h3'], before);
    expect(last.actions).toBe(0);
    expect(last.phase).toBe('siren'); // closure 가 나오는 순간 사이렌
    expect(last.evidence).toContain('E17');
    expect(stars(last)).toBe(STAR_TOTAL); // 사이렌 뒤 이미 연 증언에서 E17 로 ★ 를 깼다
  });

  it('사이렌 뒤 비용 0 세트(해금된 chain·대질)는 첫 열람도 된다(R4) — 정밀 조사·수첩 정리는 no-actions(R5)', () => {
    // 행동을 다 쓴 채 T04 를 깨 T07(chain, 비용 0)을 연다 — 사이렌 뒤에도 T07 첫 열람
    let r = playPath(['T05', 'L2']);
    r = { ...r, actions: 1 };
    r = must(openSet(r, 'T04'));
    r = must(press(r, 'T04.1'));
    r = must(exit(r)); // 사이렌 전(행동 0 에서 처음 나감 → siren)
    expect(r.phase).toBe('siren');
    expect(r.opened).not.toContain('T07');
    expect(setStatus(r, 'T07').state).toBe('locked');
    // 사이렌 뒤에 T04 를 다시 열어 ★ 를 깨면 T07 이 열리고, 비용 0 이라 첫 열람이 허용된다
    r = must(openSet(r, 'T04'));
    r = must(present(r, 'T04.2', ['E06']));
    expect(setStatus(r, 'T07')).toMatchObject({ cost: 0 });
    expect(setStatus(r, 'T07').state).not.toBe('siren');
    r = must(openSet(r, 'T07'));
    expect(r.opened).toContain('T07');
    expect(r.actions).toBe(0);
    // 정밀 조사·수첩 정리는 행동이 필요하다
    expect(enterLocation(r, 'L2').error).toBeUndefined();
    expect(examine(must(enterLocation(r, 'L2')), 'L2.h3').error).toBe('no-actions');
    expect(hint(r).error).toBe('no-actions');
  });

  it('사이렌 뒤 일반 핫스팟(무료)은 이미 들어간 장소 안에서 조사할 수 있다', () => {
    let r = must(enterLocation({ ...tutorial(), actions: 2 }, 'L1'));
    r = must(exit(r));
    r = { ...r, actions: 1 };
    r = must(enterLocation(r, 'L2')); // 마지막 행동
    r = must(exit(r));
    expect(r.phase).toBe('siren');
    const again = must(enterLocation(r, 'L1'));
    expect(must(examine(again, 'L1.h1')).visited).toContain('L1.h1');
  });

  it('사이렌 뒤 ★ ≥ 3 이면 [지목하기] — 경고가 뜨고 취소할 수 있다(R6·R7)', () => {
    let r = playPath(['L2', 'T04', 'T05', 'L3']);
    expect(stars(r)).toBe(3);
    r = { ...r, actions: 0 };
    r = must(exit(r));
    expect(r.phase).toBe('siren');
    const hub = must(continueAfterSiren(r));
    expect(hub.screen.name).toBe('hub');
    expect(hub.phase).toBe('siren');
    expect(hub.accuse).toBeUndefined();
    expect(endInvestigation(hub).error).toBe('gate');
    const a = must(startAccuse(hub));
    expect(a.accuse).toMatchObject({ stage: 'suspect', forced: false });
    // 경고(B12): 사이렌 뒤에도 계산된다 — 옛 저장의 forced:true 도 무시한다
    const warn = accuseWarn(a);
    expect(accuseWarn({ ...a, accuse: { ...a.accuse!, forced: true } })).toEqual(warn);
    const back = must(cancelAccuse(a));
    expect(back).toMatchObject({ phase: 'siren', screen: { name: 'hub' } });
    expect(back.accuse).toBeUndefined();
  });

  it('사이렌 뒤 ★ < 3 이면 [수사 종료] → 시간 초과 · C (★ ≥ 3 이면 gate)', () => {
    const t = must(continueAfterSiren(must(exit({ ...tutorial(), actions: 0 }))));
    expect(t.phase).toBe('siren');
    expect(t.result).toBeUndefined();
    expect(starsToGate(t)).toBe(3);
    const end = endInvestigation(t);
    expect(end.events).toContainEqual({ t: 'ended', ending: 'timeout', grade: 'C' });
    expect(end.run.result).toMatchObject({ ending: 'timeout', grade: 'C', actionsLeft: 0 });
    // 사이렌 전(play)에는 쓸 수 없다
    expect(endInvestigation(tutorial()).error).toBe('gate');
    expect(endInvestigation(end.run).error).toBe('ended');
  });

  it('continueAfterSiren 은 사이렌 상태에서만(그 밖엔 gate / ended)', () => {
    expect(continueAfterSiren(tutorial()).error).toBe('gate');
  });

  it('사이렌 뒤에 증언에서 나가도 사이렌이 또 울리지 않는다(exit 은 허브로만)', () => {
    let r = must(exit({ ...tutorial(), actions: 0 }));
    r = must(continueAfterSiren(r));
    r = must(openSet(r, 'T00'));
    const out = exit(r);
    expect(out.events).toEqual([]);
    expect(out.run).toMatchObject({ phase: 'siren', screen: { name: 'hub' } });
  });

  it('사이렌 뒤에 연 증언에서 수사 배제 → 되감기는 사이렌 상태를 그대로 이어 간다(행동이 되살아나지 않음)', () => {
    let r = must(openSet({ ...tutorial(), actions: 1 }, 'T01'));
    r = must(continueAfterSiren(must(exit(r))));
    r = must(openSet(r, 'T01'));
    expect(r.checkpoint?.phase).toBe('siren');
    r = { ...r, trust: 1 };
    const dead = must(present(r, 'T01.1', ['E01']));
    expect(dead.phase).toBe('ended');
    expect(dead.result?.ending).toBe('excluded');
    const back = must(rewind(dead));
    expect(back).toMatchObject({ phase: 'siren', actions: 0, rewound: true });
    expect(openSet(back, 'T02').error).toBe('siren');
  });

  it('행동 0에서 깬 ★의 chain 세트는 같은 흐름으로 이어서 할 수 있다', () => {
    let r = playPath(['T05', 'L2']);
    r = { ...r, actions: 1 };
    r = must(openSet(r, 'T04'));
    r = must(present(r, 'T04.2', ['E06']));
    expect(r.final).toContain('T07');
    r = must(openSet(r, 'T07'));
    const s = present(r, 'T07.4', ['E02', 'E04']);
    expect(verdictOf(s)?.kind).toBe('BREAK');
  });

});

describe('추궁', () => {
  it('숨은 줄 · 메모형 증거 · 의문 · 플래그(새 핫스팟)', () => {
    let r = must(openSet(tutorial(), 'T05'));
    expect(visibleLines(r, 'T05').map((x) => x.line.id)).not.toContain('T05.6');
    expect(present(r, 'T05.6', ['E01']).error).toBe('hidden');
    const s3 = press(r, 'T05.3');
    expect(s3.events).toContainEqual({ t: 'revealed', line: 'T05.6' });
    expect(s3.events).toContainEqual({ t: 'question', id: 'Q02' });
    r = s3.run;
    expect(visibleLines(r, 'T05').find((x) => x.line.id === 'T05.6')?.isNew).toBe(true);
    const s2 = press(r, 'T05.2');
    expect(s2.events).toContainEqual({ t: 'acquired', id: 'E14' });
    const s5 = press(s2.run, 'T05.5');
    expect(s5.events).toContainEqual({ t: 'hotspotOpened', location: 'L0', hotspot: 'L0.h5' });
    r = s5.run;
    expect(roomStatus(r, 'L0')).toMatchObject({ state: 'visited', isNew: true, cost: 0 });
    expect(visibleHotspots(r, 'L0').find((h) => h.hotspot.id === 'L0.h5')).toMatchObject({ examined: false, isNew: true });
    expect(r.freePass).toContain('L0.h5');
    expect(questions(r)).toEqual([
      { id: 'Q02', text: '21:41부터 15분, 왜 기록이 비었나?', resolved: false },
      { id: 'Q04', text: '밤 청소를 싫어하는 집에서 청소기는 왜 22:20에?', resolved: false },
    ]);
  });

  it('두 번째 추궁은 효과 없음(무제한·무료)', () => {
    const r = must(press(must(openSet(tutorial(), 'T05')), 'T05.2'));
    const again = press(r, 'T05.2');
    expect(again.events).toEqual([]);
    expect(again.run.evidence.filter((e) => e === 'E14').length).toBe(1);
  });
});

describe('제시 판정 순서 — 돌파 → HALF → 우회 → 오답(시스템 3-4)', () => {
  const t10 = () => playPath(['L3', 'T05', 'L1', 'T03', 'T02', 'L2', 'T04'], undefined);

  it('경로 A 직전: T10 이 무료로 열려 있고 C11·C13 은 아직(closure 가 C13 을 먼저 못 깸)', () => {
    const r = t10();
    expect(r.opened).toContain('T10');
    expect(r.broken).toEqual(expect.arrayContaining(['C11', 'C13']));
  });

  it('조합 모순: 한 장만 → HALF(카드별 대사, 감점 없음), 두 장 → 돌파', () => {
    let r = playPath(['L2', 'T04', 'T05']);
    r = { ...r, broken: r.broken.filter((b) => b !== 'C10') };
    const h1 = present(r, 'T07.4', ['E02']);
    expect(verdictOf(h1)).toMatchObject({ kind: 'HALF', breakId: 'C10' });
    expect(verdictOf(h1)!.lines[0].text).toBe('이 빠진 상패요? 몇 년 된 겁니다.');
    expect(h1.run.trust).toBe(r.trust);
    const h2 = present(r, 'T07.4', ['E04']);
    expect(verdictOf(h2)!.lines[0].text).toBe('유리 조각이야 어디서든 나오죠. 컵이겠죠.');
    const junk = present(r, 'T07.4', ['E02', 'E01']);
    expect(verdictOf(junk)?.kind).toBe('HALF');
    const b = present(r, 'T07.4', ['E04', 'E02']);
    expect(verdictOf(b)).toMatchObject({ kind: 'BREAK', tier: 'star', breakId: 'C10' });
  });

  it('requires 미충족 → HALF(requires 대사), 충족 뒤 같은 카드 → 돌파 + 증거 갱신', () => {
    const base = playPath(['L3', 'T05', 'L1', 'T03', 'T02', 'L2', 'T04']);
    let r: RunState = { ...base, broken: base.broken.filter((b) => b !== 'C11' && b !== 'C13'), evidence: base.evidence.map((e) => (e === 'E03b' ? 'E03' : e)) };
    const half = present(r, 'T10.4', ['E16']);
    expect(verdictOf(half)).toMatchObject({ kind: 'HALF', breakId: 'C13' });
    expect(verdictOf(half)!.lines[0].text).toBe('주방에 있었다 칩시다. 회장님 목소리랑 무슨 상관이죠?');
    // v3 단계형 갱신: C11 에서 '해석 정정', C13 에서 '위조 확정'
    const s11 = present(r, 'T10.2', ['E05', 'E15']);
    expect(s11.events).toContainEqual({ t: 'upgraded', from: 'E03', to: 'E03a' });
    r = must(s11);
    expect(r.evidence).toContain('E03a');
    expect(r.evidence).not.toContain('E03');
    expect(holdings(r).find((e) => e.id === 'E03a')?.reliability).toBe('revised');
    const s = present(r, 'T10.4', ['E16']);
    expect(verdictOf(s)?.kind).toBe('BREAK');
    expect(s.events).toContainEqual({ t: 'upgraded', from: 'E03a', to: 'E03b' });
    expect(s.run.evidence).toContain('E03b');
    expect(s.run.evidence).not.toContain('E03');
    expect(s.run.evidence).not.toContain('E03a');
    expect(s.events).toContainEqual({ t: 'cleared', set: 'T10', outro: CASE.sets.find((x) => x.id === 'T10')!.outro });
  });

  it('우회: 감점 없음·상태 변화 없음, 돌파·HALF 가 아닐 때만', () => {
    const r = playPath(['L3', 'T05', 'L1', 'T03', 'T02', 'L2', 'T04']);
    const s = present(r, 'T04.5', ['E05', 'E15']);
    expect(verdictOf(s)?.kind).toBe('REDIRECT');
    expect(s.run).toMatchObject({ trust: r.trust, wrong: r.wrong });
    // 우회 목록 밖 카드가 섞이면 오답
    const w = present(r, 'T04.5', ['E05', 'E06']);
    expect(verdictOf(w)?.kind).toBe('WRONG');
    // R-07: T10.4 에 E05 단독은 우회, E05+E16 은 HALF(정답 카드 포함)
    const fresh: RunState = { ...r, broken: r.broken.filter((b) => b !== 'C13') };
    expect(judgePresent(fresh, 'T10.4', ['E05']).kind).toBe('REDIRECT');
    expect(judgePresent(fresh, 'T10.4', ['E05', 'E16']).kind).toBe('HALF');
  });

  it('R-06: 권한 거부 줄에 raw 삭제 로그 → 우회, 관리자 키 → 권한 해제', () => {
    let r = playPath(['T05']);
    r = must(press(r, 'T05.3'));
    expect(judgePresent(r, 'T05.6', ['E14']).kind).toBe('REDIRECT');
    r = playPath(['T05', 'T01']);
    expect(r.evidence).toContain('E14b');
    expect(r.broken).toContain('C06');
    expect(setStatus(r, 'T06')).toMatchObject({ state: 'open', cost: 1, isNew: true });
  });

  it('대체 정답(accept) — C07 은 피해자 프로필·E03b·E05+E15 모두 인정', () => {
    const r = playPath(['T05', 'T01', 'T06']);
    const fresh: RunState = { ...r, broken: r.broken.filter((b) => b !== 'C07') };
    expect(judgePresent(fresh, 'T06.4', ['VICTIM']).kind).toBe('BREAK');
    expect(judgePresent(fresh, 'T06.4', ['E05', 'E15']).kind).toBe('BREAK');
    expect(judgePresent(fresh, 'T06.4', ['E03b']).kind).toBe('BREAK');
    expect(judgePresent(fresh, 'T06.4', ['E05']).kind).toBe('HALF');
  });

  it('오답: 신뢰 −1, 틀린 제시 +1, 인물 리액션은 wrong % 3 순환 + 독백', () => {
    let r = must(openSet(tutorial(), 'T01'));
    const s = present(r, 'T01.1', ['E01']);
    expect(verdictOf(s)!.lines.map((l) => l.text)).toEqual(['정확히는, 그건 아무 상관 없습니다.', '…헛다리였다.']);
    expect(s.events).toContainEqual({ t: 'trust', value: 4, delta: -1 });
    r = s.run;
    expect(verdictOf(present(r, 'T01.1', ['E01']))!.lines[0].text).toBe('해상도가 낮은 추리네요.');
  });

  it('이미 깬 줄 → 감점 없음', () => {
    const r = tutorial();
    const s = present(must(openSet(r, 'T00')), 'T00.3', ['E02']);
    expect(verdictOf(s)?.kind).toBe('ALREADY');
    expect(s.run.trust).toBe(5);
  });

  it('없는 카드·안 가진 카드·3장·중복은 거부(상태 그대로)', () => {
    const r = must(openSet(tutorial(), 'T01'));
    expect(present(r, 'T01.2', ['E14']).error).toBe('not-held');
    expect(present(r, 'T01.2', ['E99']).error).toBe('bad-cards');
    expect(present(r, 'T01.2', ['E01', 'E02', 'E03']).error).toBe('bad-cards');
    expect(present(r, 'T01.2', ['E01', 'E01']).error).toBe('bad-cards');
    expect(present(r, 'T01.2', []).error).toBe('bad-cards');
  });

  it('프로필은 언제나 제시 가능(인물 카드)', () => {
    const r = must(openSet(tutorial(), 'T01'));
    expect(present(r, 'T01.1', ['S1']).error).toBeUndefined();
  });

  it('안 연 세트의 줄은 못 건드린다', () => {
    expect(press(tutorial(), 'T01.1').error).toBe('not-opened');
  });
});

describe('신뢰도(시스템 3-5)', () => {
  it('★ 돌파 +1(최대 5), ◆ 변화 없음, 0이면 수사 배제', () => {
    let r = must(openSet(tutorial(), 'T01'));
    r = must(present(r, 'T01.1', ['E01']));
    r = must(present(r, 'T01.1', ['E01']));
    expect(r.trust).toBe(3);
    r = must(exit(r));
    r = must(enterLocation(r, 'L2'));
    r = must(examine(r, 'L2.h1'));
    r = must(openSet(r, 'T04'));
    const s = present(r, 'T04.2', ['E06']);
    expect(s.events).toContainEqual({ t: 'trust', value: 4, delta: 1 });
    expect(s.events).toContainEqual({ t: 'star', count: 1 });
    r = s.run;
    for (let i = 0; i < 3; i++) r = must(present(r, 'T04.1', ['E01']));
    const z = present(r, 'T04.1', ['E01']);
    expect(z.events.map((e) => e.t)).toEqual(['verdict', 'trust', 'excluded', 'ended']);
    expect(z.run.result).toMatchObject({ ending: 'excluded', grade: 'C' });
    expect(z.run.checkpoint?.opened).not.toContain('T04');
  });
});

describe('해금 · 결과 카드 목록(diffOpened)', () => {
  it('C08 → chain 세트가 맨 앞', () => {
    const before = must(openSet(must(examine(must(enterLocation(tutorial(), 'L2')), 'L2.h1')), 'T04'));
    const after = must(present(before, 'T04.2', ['E06']));
    expect(diffOpened(before, after)[0]).toEqual({ kind: 'set', id: 'T07', cost: 0, chain: true, confront: false });
  });

  it('C02 → 증거 갱신 · 새 장소(행동 1) · 비밀', () => {
    const before = must(openSet(playPath(['T05']), 'T01'));
    const after = present(before, 'T01.2', ['E14']);
    const items = diffOpened(before, after.run);
    expect(items).toContainEqual({ kind: 'location', id: 'L5', cost: 1 });
    expect(items).toContainEqual({ kind: 'upgrade', from: 'E14', to: 'E14b' });
    expect(items).toContainEqual({ kind: 'secret', who: 'S1', line: CASE.profiles.find((p) => p.id === 'S1')!.secretLine });
    expect(after.run.screen.replay).toBe('C02');
    expect(profiles(after.run).find((p) => p.id === 'S1')).toMatchObject({ revealed: true });
    expect(profiles(after.run).find((p) => p.id === 'S2')?.secretLine).toBeUndefined();
  });

  it('대질 1은 C05·C02·C04 가 다 깨져야 열린다(마지막이 ◆ 여도 무료)', () => {
    const a = playPath(['L3', 'T05', 'T01']);
    expect(setStatus(a, 'T09').state).toBe('locked');
    const b = playPath(['L3', 'T05', 'T01', 'T02']);
    expect(b.opened).toContain('T09');
    expect(b.actions).toBe(9);
  });
});

describe('수첩 셀렉터', () => {
  it('타임라인: 기록(증거 time)·주장(claimTime) 시각순', () => {
    const r = playPath(['L2', 'T04']);
    const t = timeline(r);
    const times = t.map((x) => x.time);
    expect([...times].sort()).toEqual(times);
    expect(t).toContainEqual({ time: '21:40', kind: 'record', ref: 'E06', text: '서재 조명 기록' });
    expect(t.find((x) => x.ref === 'T04.2')).toMatchObject({ kind: 'claim', who: 'S4', broken: true });
  });

  it('정리된 것 = 깬 순서의 explain · 의문 해결 표시 · 풀린 의문엔 답(v3)', () => {
    const r = playPath(['T05', 'L3', 'T02']);
    expect(summaries(r).map((x) => x.breakId)).toEqual(['C01', 'C05', 'C04']);
    expect(questions(r).find((q) => q.id === 'Q01')).toMatchObject({ resolved: true, answer: '하늘. 유언장 문제로 다퉜다고 직접 말했다.' });
    // 답을 따로 적지 않은 의문은 풀어 준 돌파의 explain
    expect(questions(r).find((q) => q.id === 'Q02')).toMatchObject({ resolved: true, answer: CASE.sets.flatMap((s) => s.lines).flatMap((l) => l.breaks ?? []).find((b) => b.id === 'C05')!.explain });
    expect(questions(r).find((q) => q.id === 'Q04')).toEqual({ id: 'Q04', text: '밤 청소를 싫어하는 집에서 청소기는 왜 22:20에?', resolved: false });
  });

  it('Q07(아버지와 회장) — 특허 출원서를 손에 넣으면 풀리고 답이 적힌다(v3, 순서 무관)', () => {
    const before = playPath(['L2', 'T04']);
    expect(before.pressed).toContain('T07.5');
    expect(questions(before).find((q) => q.id === 'Q07')).toMatchObject({ resolved: false });
    const after = playPath(['P:L2.h3'], before);
    expect(questions(after).find((q) => q.id === 'Q07')).toMatchObject({ resolved: true, answer: "1999년 특허. 발명자 '…명환', 출원인은 회장." });
    // 파쇄기를 먼저 봐도 T07.5 를 추궁하는 순간 이미 풀린 의문으로 들어온다
    const first = playPath(['L2', 'P:L2.h3', 'T04']);
    expect(questions(first).find((q) => q.id === 'Q07')?.resolved).toBe(true);
    // T07.5 에 특허 출원서 → 감점 없는 우회(R-09)
    const t = { ...after, broken: after.broken };
    expect(judgePresent(t, 'T07.5', ['E09']).kind).toBe('REDIRECT');
  });

  it('보유 증거 · 개수(갱신본은 원본 칸으로 센다) · 놓친 증거(이름 없이 missHint)', () => {
    const r = playPath(['L3', 'T05', 'L1', 'T03', 'T02', 'L2', 'T04', 'P:L2.h3']);
    expect(holdings(r).some((e) => e.id === 'E03b')).toBe(true);
    expect(evidenceCount(r)).toBe(15);
    expect(missed(r).filter((m) => !m.upgrade).map((m) => m.id).sort()).toEqual(['E07', 'E17', 'E18']);
    // 원본(E14)은 있는데 갱신(선우강의 비밀)을 못 봤다 → 갱신 카드도 '놓친 것'
    expect(missed(r).filter((m) => m.upgrade).map((m) => m.id)).toEqual(['E14b']);
    const t = tutorial();
    expect(missed(t).filter((m) => !m.upgrade).length).toBe(15);
    // 단계형 갱신은 '다음 한 단계'를 놓친 것으로 적는다(E03 → E03a)
    expect(missed(t).some((m) => m.id === 'E03a' && m.upgrade)).toBe(true);
    expect(missed({ ...t, evidence: t.evidence.map((e) => (e === 'E03' ? 'E03a' : e)) }).some((m) => m.id === 'E03b' && m.upgrade)).toBe(true);
  });
});

describe('수첩 정리(힌트, 시스템 3-8)', () => {
  it('정답·증거 이름·줄 번호를 말하지 않는다 — 어디를·어떤 주제만', () => {
    let r = tutorial();
    for (let i = 0; i < 6; i++) {
      const h = hintFor(r);
      const text = h.text.join(' ');
      for (const n of ALL_EVIDENCE_NAMES) expect(text.includes(n)).toBe(false);
      expect(/T\d\d\.\d|E\d\d|C\d\d/.test(text)).toBe(false);
      r = playPath([['L3', 'T05', 'L1', 'T03', 'T02', 'L2'][i]], r);
    }
  });

  it('① 지금 깰 수 있는 것 — ★ 우선', () => {
    const r = must(exit(must(openSet(must(exit(must(examine(must(enterLocation(tutorial(), 'L3')), 'L3.h1')))), 'T05'))));
    const h = hintFor(r);
    expect(h.text).toEqual(['수첩을 펼쳐 지금까지를 정리했다.', '또박이의 「오늘 밤의 기록」.', "'공백' 얘기가 걸린다. 가진 걸로 충분하다."]);
    expect(h.target).toEqual({ kind: 'set', id: 'T05' });
  });

  it('② 재료가 모자라면 출처로 방향(장소 / 묻지 않은 사람 / 캐물을 말)', () => {
    expect(hintFor(tutorial()).text[1]).toBe('또박이에게 아직 묻지 않은 게 있다.');
    const r = must(exit(must(openSet(tutorial(), 'T05'))));
    expect(hintFor(r)).toMatchObject({ text: ['수첩을 펼쳐 지금까지를 정리했다.', '다용도실을 아직 덜 본 것 같다.'], target: { kind: 'location', id: 'L3' } });
  });

  it('③ 경로가 끝나면 지목 안내', () => {
    const r = playPath(['L3', 'T05', 'L1', 'T03', 'T02', 'L2', 'T04', 'P:L2.h3']);
    expect(hintFor(r)).toEqual({ text: ['수첩을 펼쳐 지금까지를 정리했다.', CASE.copy.hintDone], target: { kind: 'accuse' } });
  });

  it('행동 1 · 판당 2회 · 마지막 행동이면 바로 사이렌', () => {
    let r = tutorial();
    const s = hint(r);
    expect(s.events[0]).toEqual({ t: 'spent', cost: 1, left: 12 });
    expect(s.events[1]).toMatchObject({ t: 'hint' });
    r = must(hint(s.run));
    expect(r).toMatchObject({ hints: 2, actions: 11 });
    expect(r.hintLog?.length).toBe(2);
    expect(hint(r).error).toBe('no-hints');
    const last = hint({ ...tutorial(), actions: 1 });
    expect(last.events.map((e) => e.t)).toEqual(['spent', 'hint', 'siren']);
    expect(last.run.phase).toBe('siren');
  });

  it('조사 붙임(을/를) 처리', () => {
    expect(fillTemplate('{place}{을를} 본다', { place: '서재' })).toBe('서재를 본다');
    expect(fillTemplate('{place}{을를} 본다', { place: '주방' })).toBe('주방을 본다');
    expect(fillTemplate('{who}{이가}', { who: '또박이' })).toBe('또박이가');
  });
});

describe('최종 지목(시스템 1-8 · 4-2)', () => {
  const ready = () => playPath(['L3', 'T05', 'L1', 'T03', 'T02', 'L2', 'T04', 'P:L2.h3']);

  it('★ 3 미만이면 지목 불가', () => {
    expect(startAccuse(tutorial()).error).toBe('gate');
  });

  it('지목 경고: 위조 갱신본이 없으면 한결이 짚는다', () => {
    const r = must(startAccuse(playPath(['L2', 'T04', 'T05', 'L3'])));
    expect(accuseWarn(r)?.[0].text).toBe('선배님, 10시 20분 회장님 목소리 기록은 아직 그대로예요.');
    expect(accuseWarn(must(startAccuse(ready())))).toBeNull();
  });

  it('지목 경고(v3 단계별): 해석 정정(E03a)까지만 왔으면 "바꾼 사람"을 짚는다 · 판정 대사·업적', () => {
    const base = ready();
    const mid: RunState = { ...base, broken: base.broken.filter((b) => b !== 'C13'), evidence: base.evidence.map((e) => (e === 'E03b' ? 'E03a' : e)) };
    const r = must(startAccuse(mid));
    expect(accuseWarn(r)?.[0].text).toBe('선배님, 청소기 소리를 바꾼 사람은 아직 못 밝혔어요.');
    let x = must(pickCulprit(r, CULPRIT));
    x = must(setSlot(x, 'means', 'E02'));
    x = must(setSlot(x, 'opportunity', 'E03a'));
    x = must(setSlot(x, 'motive', 'E09'));
    const end = must(submitAccusation(x));
    expect(end.result).toMatchObject({ ending: 'short', grade: 'B' });
    expect(end.result?.achievements).not.toContain('trustedMachine');
    const v = verdictScript({ culprit: CULPRIT, means: 'E02', opportunity: 'E03a', motive: 'E09' });
    expect(v.steps[1]).toMatchObject({ ok: false });
    expect(v.steps[1].lines[0].text).toBe('청소기 소리였다 칩시다. 바꾼 게 저란 증거는요?');
  });

  it('또박이를 고르면 이스터에그(페널티 없음) → 업적', () => {
    const r = must(startAccuse(ready()));
    const s = pickCulprit(r, 'AI');
    expect(s.events[0]).toEqual({ t: 'easterEgg', lines: CASE.easterEgg });
    expect(s.run.accuse?.culprit).toBeUndefined();
    let x = must(pickCulprit(s.run, CULPRIT));
    x = must(setSlot(x, 'means', 'E02'));
    x = must(setSlot(x, 'opportunity', 'E03b'));
    x = must(setSlot(x, 'motive', 'E09'));
    expect(must(submitAccusation(x)).result?.achievements).toContain('arrestSpeaker');
  });

  it('같은 카드는 두 칸에 못 넣는다 — 옮긴다(디자인 D25) · 프로필·미보유 카드 거부', () => {
    let r = must(pickCulprit(must(startAccuse(ready())), CULPRIT));
    r = must(setSlot(r, 'means', 'E02'));
    const s = setSlot(r, 'opportunity', 'E02');
    expect(s.movedFrom).toBe('means');
    expect(s.run.accuse).toMatchObject({ opportunity: 'E02', means: undefined });
    expect(setSlot(r, 'motive', 'S4').error).toBe('not-held');
    expect(setSlot(r, 'motive', 'E17').error).toBe('not-held');
    expect(submitAccusation(s.run).error).toBe('bad-accusation');
  });

  it('판정: 범인 + 3칸 → 완벽 / 숨은 조건 → 숨은 / 2칸 → 증거 부족 B / 범인 오답 → 오인 체포', () => {
    const r = ready();
    const j = (culprit: typeof CULPRIT, means: string, opportunity: string, motive: string) => judgeAccusation(r, { culprit, means, opportunity, motive });
    expect(j(CULPRIT, 'E04', 'E03b', 'E09')).toMatchObject({ ending: 'perfect', correct: 3 });
    expect(j(CULPRIT, 'E02', 'E03', 'E09')).toMatchObject({ ending: 'short', correct: 2 });
    expect(judgeAccusation({ ...r, flags: [...r.flags, 'F_ALARM'], broken: [...r.broken, 'C02'] }, { culprit: CULPRIT, means: 'E02', opportunity: 'E03b', motive: 'E09' }).ending).toBe('hidden');
    const other = (['S1', 'S2', 'S3', 'S4'] as const).find((s) => s !== CULPRIT)!;
    expect(j(other, 'E02', 'E03b', 'E09').ending).toBe(`wrong-${other}`);
    expect(judgeAccusation(r, null).ending).toBe('timeout');
  });

  it('기회 칸에 raw 위조 원본 → 오답 + 업적 「기계를 너무 믿었다」 · 판정 대사는 카드별', () => {
    const r0 = playPath(['L2', 'T04', 'T05', 'L3', 'P:L2.h3']);
    let r = must(pickCulprit(must(startAccuse(r0)), CULPRIT));
    r = must(setSlot(r, 'means', 'E02'));
    r = must(setSlot(r, 'opportunity', 'E03'));
    r = must(setSlot(r, 'motive', 'E09'));
    const end = must(submitAccusation(r));
    expect(end.result).toMatchObject({ ending: 'short', grade: 'B', slots: { means: true, opportunity: false, motive: true } });
    expect(end.result?.achievements).toContain('trustedMachine');
    const v = verdictScript({ culprit: CULPRIT, means: 'E02', opportunity: 'E03', motive: 'E09' });
    expect(v.steps.map((x) => x.ok)).toEqual([true, false, true]);
    expect(v.steps[1].lines[0].text).toBe('보세요. 회장님 목소리라잖아요.');
    expect(v.call.text).toBe(`범인은— ${CASE.names[CULPRIT]}, 당신이다.`);
    expect(verdictScript({ culprit: 'S1' === CULPRIT ? 'S2' : 'S1', means: 'E02', opportunity: 'E03', motive: 'E09' }).wrongArrest).toBe(true);
  });

  it('제출 뒤에는 고칠 수 없다', () => {
    let r = must(pickCulprit(must(startAccuse(ready())), CULPRIT));
    r = must(setSlot(r, 'means', 'E02'));
    r = must(setSlot(r, 'opportunity', 'E03b'));
    r = must(setSlot(r, 'motive', 'E09'));
    const end = must(submitAccusation(r));
    expect(submitAccusation(end).error).toBe('ended');
    expect(present(end, 'T01.1', ['E01']).error).toBe('ended');
    expect(end.screen.name).toBe('ending');
  });

  it('업적: 무결점·번개 수사·힌트 없이(완벽 해결 기준)', () => {
    let r = must(pickCulprit(must(startAccuse(ready())), CULPRIT));
    r = must(setSlot(r, 'means', 'E02'));
    r = must(setSlot(r, 'opportunity', 'E03b'));
    r = must(setSlot(r, 'motive', 'E09'));
    const res = must(submitAccusation(r)).result!;
    expect(res.achievements.sort()).toEqual(['flawless', 'lightning', 'nohint']);
    expect(res.secretsRevealed).toContain(CULPRIT);
    expect(res.stars).toBe(5);
    expect(res.unbrokenStars).toBe(2);
  });
});

describe('meta(도감·업적)', () => {
  it('엔딩 반영 · 최고 등급 · 사건 파일 잠금 · 수사 배제는 도감만', () => {
    let m = newMeta();
    const res = must(
      submitAccusation(
        must(
          setSlot(
            must(setSlot(must(setSlot(must(pickCulprit(must(startAccuse(playPath(['L3', 'T05', 'L1', 'T03', 'T02', 'L2', 'T04', 'P:L2.h3']))), CULPRIT)), 'means', 'E02')), 'opportunity', 'E03b')),
            'motive',
            'E09',
          ),
        ),
      ),
    ).result!;
    m = applyResultToMeta(m, res, 42);
    expect(m).toMatchObject({ plays: 1, endings: ['perfect'], bestGrade: 'A', lastEnding: { ending: 'perfect', pendingView: true, at: 42 } });
    expect(caseFileUnlocked(m)).toBe(true);
    const ex = applyResultToMeta(m, { ...res, ending: 'excluded', grade: 'C' });
    expect(ex.plays).toBe(1);
    expect(ex.endings).toContain('excluded');
    expect(addAchievement(m, 'arrestSpeaker').achievements).toContain('arrestSpeaker');
    expect(caseFileUnlocked({ ...newMeta(), plays: 3 })).toBe(true);
    expect(caseFileUnlocked({ ...newMeta(), plays: 2 })).toBe(false);
  });

  it('도감 엔딩 칸 8 — 오인 체포는 범인을 뺀 3', () => {
    const slots = endingSlots();
    expect(slots.length).toBe(8);
    expect(slots).not.toContain(`wrong-${CULPRIT}`);
  });
});

describe('손으로 한 판 — 경로 A(유료 8, 완벽 해결)', () => {
  it('끝까지', () => {
    let r = tutorial();
    r = must(enterLocation(r, 'L3'));
    r = must(examine(r, 'L3.h1'));
    r = must(examine(r, 'L3.h2'));
    r = must(exit(r));
    r = must(openSet(r, 'T05'));
    r = must(press(r, 'T05.5'));
    r = must(press(r, 'T05.3'));
    r = must(present(r, 'T05.3', ['E11']));
    r = must(exit(r));
    r = must(enterLocation(r, 'L0'));
    r = must(examine(r, 'L0.h5'));
    r = must(exit(r));
    expect(r.evidence).toContain('E04');
    r = must(enterLocation(r, 'L1'));
    r = must(examine(r, 'L1.h1'));
    r = must(examine(r, 'L1.h2'));
    r = must(exit(r));
    r = must(openSet(r, 'T03'));
    r = must(present(r, 'T03.2', ['E13']));
    r = must(exit(r));
    expect(r.evidence).toContain('E15');
    r = must(openSet(r, 'T02'));
    r = must(present(r, 'T02.2', ['E12']));
    r = must(exit(r));
    expect(r.evidence).toContain('E16');
    r = must(enterLocation(r, 'L2'));
    r = must(examine(r, 'L2.h1'));
    r = must(exit(r));
    r = must(openSet(r, 'T04'));
    r = must(present(r, 'T04.2', ['E06']));
    r = must(openSet(r, 'T07'));
    r = must(present(r, 'T07.4', ['E02', 'E04']));
    r = must(exit(r));
    expect(stars(r)).toBe(3);
    r = must(enterLocation(r, 'L2'));
    r = must(examine(r, 'L2.h3'));
    r = must(exit(r));
    r = must(openSet(r, 'T10'));
    r = must(present(r, 'T10.2', ['E05', 'E15']));
    r = must(present(r, 'T10.4', ['E16']));
    r = must(exit(r));
    expect(r).toMatchObject({ actions: 5, trust: 5, wrong: 0 });
    expect(stars(r)).toBe(5);
    expect(clock(r)).toBe('00:10');
    r = must(startAccuse(r));
    r = must(pickCulprit(r, CULPRIT));
    r = must(setSlot(r, 'means', 'E02'));
    r = must(setSlot(r, 'opportunity', 'E03b'));
    r = must(setSlot(r, 'motive', 'E09'));
    const end = submitAccusation(r);
    expect(end.events).toContainEqual({ t: 'ended', ending: 'perfect', grade: 'A' });
    expect(end.run.result).toMatchObject({ ending: 'perfect', grade: 'A', title: '로그를 읽는 사람', actionsLeft: 5, evidence: 12, stars: 5 });
    expect(end.run.result?.achievements).toContain('lightning');
  });
});

describe('규칙 상수(시스템 7-1)', () => {
  it('normal', () => {
    expect(RULES.normal).toMatchObject({ actions: 13, minutesPerAction: 10, startMinute: 22 * 60 + 50, trustMax: 5, trustOnStar: 1, hintsMax: 2, hintCost: 1, starGate: 3, confirmWhenActionsLeq: 2, sMaxWrong: 2, rewindTrust: 2 });
  });

  it('freeClosure 는 시작 상태를 튜토리얼까지 진행한다', () => {
    const r = freeClosure(newRun());
    expect(r.broken).toEqual(['C01']);
    expect(r.actions).toBe(13);
  });
});

// ═══════════════════════════════ 다시 하기(docs/planning/witness-replay.md h-2) ═══════════════════════════════

const PERFECT_PATH = ['L3', 'T05', 'L1', 'T03', 'T02', 'L2', 'T04', 'P:L2.h3'];
const SOL = CASE.solution;
const INNOCENT = (['S1', 'S2', 'S3', 'S4'] as const).find((x) => x !== CULPRIT)!;
const RIGHT: Accusation = { culprit: CULPRIT, means: SOL.accept.means[0], opportunity: SOL.accept.opportunity[0], motive: SOL.accept.motive[0] };
/** 범인·수단·기회 맞고 동기만 틀림(증거 부족 B) — 완벽 경로에서 손에 있는 카드 */
const SHORT: Accusation = { ...RIGHT, motive: 'E06' };
const WRONG: Accusation = { ...RIGHT, culprit: INNOCENT };

/** 지목 3단계를 한 번에(시작 → 범인 → 칸 → 제출) */
function judge(run: RunState, a: Accusation): Step {
  let r = must(startAccuse(run));
  r = must(pickCulprit(r, a.culprit));
  for (const sl of ['means', 'opportunity', 'motive'] as const) r = must(setSlot(r, sl, a[sl]));
  return submitAccusation(r);
}
const judged = (run: RunState, a: Accusation): RunState => must(judge(run, a));

/** 행동 0 → 사이렌 → [계속] → [수사 종료] = 시간 초과(★ < 3 일 때). 마지막 유료 행동은 수첩 정리 */
function timeoutVia(run: RunState): RunState {
  const h = hint({ ...run, actions: 1 });
  expect(h.events.some((e) => e.t === 'siren')).toBe(true);
  return must(endInv(must(continueAfterSiren(h.run))));
}

describe('다시 하기 — 되감기 3종(사양 a)', () => {
  it('E1 완벽 최단 경로 → 칸만 틀림(short) → 되감기: accuse·칸 1·허브·신뢰 ≥ 2·행동 불변·지난 지목 미리 채움', () => {
    const before = playPath(PERFECT_PATH);
    const end = judged(before, SHORT);
    expect(end.result).toMatchObject({ ending: 'short', grade: 'B', attempt: 1 });
    expect(rewindOption(end)).toEqual({ kind: 'accuse', cost: 1, last: false });
    const s = rewind(end);
    const back = must(s);
    expect(s.events[0]).toEqual({ t: 'rewound', kind: 'accuse', cost: 1, gateClosed: false });
    expect(back).toMatchObject({ phase: 'play', screen: { name: 'hub' }, actions: before.actions, rewound: true, rewinds: { judged: 1, excluded: 0 }, attempts: 1 });
    expect(back.trust).toBeGreaterThanOrEqual(2);
    expect(back.result).toBeUndefined();
    // 칸만 틀림: 범인 그대로 + 안 통한 칸(동기) 표시
    expect(back.prevAccuse).toEqual({ ...SHORT, miss: ['motive'] });
    // 지목 화면은 '칸' 단계부터, 지난 선택이 채워져 있다(miss 는 초안에 안 들어간다)
    const acc = must(startAccuse(back)).accuse;
    expect(acc).toEqual({ stage: 'slots', ...SHORT, forced: false });
    expect(rewindSlotsLeft(back)).toBe(1);
  });

  it('E2 칸 오답 3번 — 3번째 판정 뒤엔 선택지 null · rewind → no-rewind · 판 그대로', () => {
    let r = playPath(PERFECT_PATH);
    r = must(rewind(judged(r, SHORT)));
    const second = judged(r, SHORT);
    expect(second.result?.attempt).toBe(2);
    expect(rewindOption(second)).toEqual({ kind: 'accuse', cost: 1, last: true });
    r = must(rewind(second));
    const third = judged(r, SHORT);
    expect(third.result?.attempt).toBe(3);
    expect(rewindOption(third)).toBeNull();
    const s = rewind(third);
    expect(s.error).toBe('no-rewind');
    expect(s.run).toBe(third);
    expect(rewindSlotsLeft(third)).toBe(0);
  });

  it('E2b 범인 오답 1번 → 칸 2개(last) → 다음 판정 뒤 null — 범인 적중 4명 중 2번 기회(찍기 방지 X1)', () => {
    const end = judged(playPath(PERFECT_PATH), WRONG);
    expect(end.result?.ending).toBe(`wrong-${INNOCENT}`);
    expect(rewindOption(end)).toEqual({ kind: 'accuse', cost: 2, last: true });
    const back = must(rewind(end));
    expect(back.rewinds).toEqual({ judged: 2, excluded: 0 });
    // 칸만 틀려도, 범인을 또 틀려도 그 뒤엔 없다
    expect(rewindOption(judged(back, SHORT))).toBeNull();
    expect(rewindOption(judged(back, WRONG))).toBeNull();
    // QA-RP-02: 범인이 틀렸으면 범인은 비우고(그 인물은 notCulprit) 카드만 채워 '범인' 단계부터 — 같은 오답으로 마지막 판정을 날리지 않게
    expect(back.prevAccuse).toEqual({ means: WRONG.means, opportunity: WRONG.opportunity, motive: WRONG.motive, notCulprit: INNOCENT });
    expect(must(startAccuse(back)).accuse).toEqual({ stage: 'suspect', means: WRONG.means, opportunity: WRONG.opportunity, motive: WRONG.motive, forced: false });
    // 칸 하나 남았을 때 범인 틀림은 남은 1칸만 쓴다
    const one = judged(must(rewind(judged(playPath(PERFECT_PATH), SHORT))), WRONG);
    expect(rewindOption(one)).toEqual({ kind: 'accuse', cost: 1, last: true });
  });

  it('E3 ① 행동 1 수첩 정리 → 사이렌 뒤 오답 → 지목 되감기: 사이렌 뒤 허브·행동 0·수첩 정리 횟수 판 전체 값(공짜 힌트 0)', () => {
    const at1 = { ...playPath(PERFECT_PATH), actions: 1 };
    const h = must(hint(at1));
    expect(h).toMatchObject({ phase: 'siren', actions: 0, hints: 1 });
    const end = judged(must(continueAfterSiren(h)), SHORT);
    const back = must(rewind(end));
    expect(back).toMatchObject({ phase: 'siren', actions: 0, hints: 1, screen: { name: 'hub' } });
    expect(back.hintLog).toHaveLength(1);
  });

  it('E3 ①′ 시간 초과 한 수 전(action)은 수첩 정리 직전으로 가도 횟수·기록은 되돌리지 않는다(C2)', () => {
    const star2 = playPath(['L2', 'T04', 'T05']);
    expect(stars(star2)).toBe(2);
    const end = timeoutVia(star2);
    expect(end.result?.ending).toBe('timeout');
    const back = must(rewind(end));
    expect(back).toMatchObject({ phase: 'play', actions: 1, hints: 1, final: [], screen: { name: 'hub' } });
    expect(back.hintLog).toHaveLength(1);
    // 수첩 정리는 판당 2번 — 되감아도 이미 쓴 1번은 쓴 것
    expect(must(hint(back)).hints).toBe(2);
  });

  it('E3 ② 행동 1 자발 오답 → 되감기 → 마지막 행동 → 사이렌 뒤 오답 → 되감기: 행동 0 유지(되살아나지 않는다)', () => {
    const at1 = { ...playPath(PERFECT_PATH), actions: 1 };
    let r = must(rewind(judged(at1, SHORT)));
    expect(r.actions).toBe(1);
    r = must(enterLocation(r, 'L4'));
    r = must(continueAfterSiren(must(exit(r))));
    expect(r).toMatchObject({ phase: 'siren', actions: 0 });
    const end = judged(r, SHORT);
    expect(rewindOption(end)).toEqual({ kind: 'accuse', cost: 1, last: true });
    const back = must(rewind(end));
    expect(back).toMatchObject({ phase: 'siren', actions: 0 });
    expect(back.actions).toBeLessThanOrEqual(1);
  });

  it('E4 되감기 종류별 스냅샷 정리(a-4)', () => {
    // accuse: checkpoint = accuseCp, accuseCp 삭제, actCp 유지
    const end = judged(playPath(PERFECT_PATH), SHORT);
    const a = must(rewind(end));
    expect(a.checkpoint).toEqual(end.accuseCp);
    expect(a.accuseCp).toBeUndefined();
    expect(a.actCp).toEqual(end.actCp);
    // action: checkpoint = actCp, 둘 다 삭제
    const t = timeoutVia(playPath(['L2', 'T04', 'T05']));
    const b = must(rewind(t));
    expect(b.checkpoint).toEqual(t.actCp);
    expect(b.accuseCp).toBeUndefined();
    expect(b.actCp).toBeUndefined();
    // excluded: checkpoint 그대로, 나머지 둘 삭제
    let x = must(openSet(playPath(PERFECT_PATH), 'T01'));
    x = { ...x, trust: 1, accuseCp: core(x) };
    const dead = must(present(x, 'T01.1', ['E01']));
    expect(rewindOption(dead)).toEqual({ kind: 'excluded', cost: 0, last: false });
    const c = must(rewind(dead));
    expect(c.checkpoint).toEqual(dead.checkpoint);
    expect(c.accuseCp).toBeUndefined();
    expect(c.actCp).toBeUndefined();
    expect(c.rewinds).toEqual({ judged: 0, excluded: 1 });
  });

  it('E5 core()·JSON 은 스냅샷 중첩 0', () => {
    const end = judged(playPath(PERFECT_PATH), SHORT);
    expect(end.checkpoint && end.accuseCp && end.actCp).toBeTruthy();
    for (const k of ['checkpoint', 'accuseCp', 'actCp'] as const) {
      const snap = JSON.parse(JSON.stringify(end[k])) as Record<string, unknown>;
      for (const j of ['checkpoint', 'accuseCp', 'actCp']) expect(snap[j]).toBeUndefined();
    }
    const c = core(end) as unknown as Record<string, unknown>;
    for (const j of ['checkpoint', 'accuseCp', 'actCp']) expect(c[j]).toBeUndefined();
  });

  it('E6 actCp 는 유료 4곳(첫 입장·정밀 첫 조사·첫 열람 cost 1·수첩 정리)에서만 바뀐다', () => {
    let r = tutorial();
    expect(r.actCp).toBeUndefined(); // 튜토리얼(L0·T00)은 무료
    const paid = (s: Step) => {
      const n = must(s);
      expect(n.actCp).toEqual(core(r));
      r = n;
    };
    const free = (s: Step) => {
      const n = must(s);
      expect(n.actCp).toBe(r.actCp);
      r = n;
    };
    paid(enterLocation(r, 'L2'));
    free(examine(r, 'L2.h1'));
    paid(examine(r, 'L2.h3'));
    free(exit(r));
    free(enterLocation(r, 'L2')); // 재입장
    free(exit(r));
    free(enterLocation(r, 'L0'));
    free(exit(r));
    paid(openSet(r, 'T04'));
    free(press(r, 'T04.1'));
    free(present(r, 'T04.2', ['E06'])); // C08 → T07(비용 0) 해금
    free(exit(r));
    free(openSet(r, 'T04')); // 재열람
    free(exit(r));
    free(openSet(r, 'T07')); // 비용 0 세트
    free(exit(r));
    paid(hint(r));
  });

  it('E7 행동 0 → 사이렌 → [수사 종료] → 시간 초과: ★2 → action(행동 1·final []·허브·사이렌 해제) / ★1 → null', () => {
    const t2 = timeoutVia(playPath(['L2', 'T04', 'T05']));
    expect(rewindOption(t2)).toEqual({ kind: 'action', cost: 1, last: false });
    const back = must(rewind(t2));
    expect(back).toMatchObject({ phase: 'play', actions: 1, final: [], screen: { name: 'hub' }, rewinds: { judged: 1, excluded: 0 } });
    expect(canAccuse(back)).toBe(false);
    const one = playPath(['L3', 'T05']);
    expect(stars(one)).toBe(1);
    const t1 = timeoutVia(one);
    expect(t1.result?.ending).toBe('timeout');
    expect(rewindOption(t1)).toBeNull();
    // 완벽·숨은은 되감기 없음
    expect(rewindOption(judged(playPath(PERFECT_PATH), RIGHT))).toBeNull();
  });

  it('E8 actCp 가 없는 판(배포 전)의 시간 초과 ★ ≥ 2 → 오류 없이 null', () => {
    const t = timeoutVia(playPath(['L2', 'T04', 'T05']));
    const old = { ...t, actCp: undefined };
    expect(rewindOption(old)).toBeNull();
    expect(rewind(old).error).toBe('no-rewind');
    // 배포 전 지목 판(accuseCp 없음)도 마찬가지
    const w = judged(playPath(PERFECT_PATH), SHORT);
    expect(rewindOption({ ...w, accuseCp: undefined })).toBeNull();
  });

  it('지목 조건이 되감기로 다시 닫히면 rewound 이벤트 gateClosed', () => {
    // 수사 배제 체크포인트가 ★ 3 이전이면 닫힌다
    let r = playPath(['L2', 'T04', 'T05']);
    r = must(openSet(r, 'T01'));
    r = { ...r, broken: [...r.broken, ...['C05', 'C08', 'C10'].filter((b) => !r.broken.includes(b))] };
    expect(stars(r)).toBeGreaterThanOrEqual(3);
    const dead = must(present({ ...r, trust: 1 }, 'T01.1', ['E01']));
    const s = rewind(dead);
    expect(s.events[0]).toMatchObject({ t: 'rewound', kind: 'excluded', gateClosed: true });
  });

  it('keepSavedRun — 진행 중·되감기 가능한 끝난 판은 저장 유지, 선택지 없으면 지운다(C1/X4)', () => {
    const end = judged(playPath(PERFECT_PATH), SHORT);
    expect(keepSavedRun(playPath(PERFECT_PATH))).toBe(true);
    expect(keepSavedRun(end)).toBe(true);
    expect(keepSavedRun(judged(playPath(PERFECT_PATH), RIGHT))).toBe(false);
    const t1 = timeoutVia(playPath(['L3', 'T05']));
    expect(keepSavedRun(t1)).toBe(false);
  });
});

describe('다시 하기 — 판정 횟수·meta(사양 b-2.4 · d-2)', () => {
  it('E9 한 판 판정 3번 + 수사 배제 1번 → plays +1 · 도감 합집합 · 배제 엔딩에서도 found 갱신', () => {
    let m: WitnessMeta = newMeta();
    let r = playPath(PERFECT_PATH);
    let end = judged(r, SHORT);
    m = applyResultToMeta(m, end.result!, 1);
    expect(m.plays).toBe(1);
    r = must(rewind(end));
    // 수사 배제 한 번(되감기 칸 안 씀)
    let x = must(openSet(r, 'T01'));
    while (x.phase !== 'ended') x = must(present(x, 'T01.1', ['E01']));
    expect(x.result?.ending).toBe('excluded');
    const mx = applyResultToMeta({ ...m, found: [] }, x.result!, 2);
    expect(mx.plays).toBe(1);
    expect(mx.found?.length).toBeGreaterThan(0);
    expect(mx.found).toEqual(RECALL_ELIGIBLE.filter((id) => !x.result!.missed.some((mm) => mm.id === id)));
    m = applyResultToMeta(m, x.result!, 2);
    r = must(rewind(x));
    end = judged(r, WRONG);
    expect(end.result?.attempt).toBe(2);
    m = applyResultToMeta(m, end.result!, 3);
    r = must(rewind(end));
    end = judged(r, SHORT);
    expect(end.result?.attempt).toBe(3);
    m = applyResultToMeta(m, end.result!, 4);
    expect(m.plays).toBe(1);
    expect([...m.endings].sort()).toEqual(['excluded', 'short', `wrong-${INNOCENT}`].sort());
    expect(m.lastEnding).toMatchObject({ ending: 'short', rewinds: 3, at: 4 });
    expect(caseFileUnlocked(m)).toBe(false); // 같은 판 되감기로 사건 파일이 열리지 않는다
  });

  it('E10 등급 상한 — 되감기 A · 기억 B(칭호는 A 용) · 둘 다 B · 실력 업적은 처음부터·무되감기만 · allclear 는 기억 판 제외', () => {
    const S_PATH = [...PERFECT_PATH, 'T01', 'L5', 'P:L5.h3'];
    const clean = judged(playPath(S_PATH), RIGHT).result!;
    expect(clean.grade).toBe('S');
    expect(clean.achievements).toEqual(expect.arrayContaining(['flawless', 'nohint']));
    // 되감기(지목) 뒤 같은 완벽 → A, 실력 업적 0, allclear 는 그대로
    const rw = judged(must(rewind(judged(playPath(S_PATH), SHORT))), RIGHT).result!;
    expect(rw).toMatchObject({ grade: 'A', title: CASE.titles.A, rewinds: 1, attempt: 2 });
    for (const a of ['flawless', 'lightning', 'nohint'] as const) expect(rw.achievements).not.toContain(a);
    expect(rw.achievements.includes('allclear')).toBe(clean.achievements.includes('allclear'));
    // 기억 판 완벽 → B, 칭호는 A 용
    const memStartRun = freeClosure(newRun({ recall: RECALL_ELIGIBLE, recallN: 3 }));
    const mem = judged(playPath(['T02', 'T03', 'T04', 'T05', 'T01', 'L5'], memStartRun), RIGHT).result!;
    expect(mem).toMatchObject({ grade: 'B', title: CASE.titles.A, recallRun: 3 });
    expect(stars(playPath(['T02', 'T03', 'T04', 'T05', 'T01', 'L5'], memStartRun))).toBe(STAR_TOTAL);
    for (const a of ['flawless', 'lightning', 'nohint', 'allclear'] as const) expect(mem.achievements).not.toContain(a);
    // 기억 + 되감기 → B
    const both = judged(must(rewind(judged(playPath(['T02', 'T03', 'T04', 'T05'], memStartRun), SHORT))), RIGHT).result!;
    expect(both).toMatchObject({ grade: 'B', title: CASE.titles.A, recallRun: 3, rewinds: 1 });
    // 기억 판 증거 부족(2칸) → B 칭호 그대로
    expect(judged(playPath(['T02', 'T03', 'T04', 'T05'], memStartRun), SHORT).result).toMatchObject({ grade: 'B', title: CASE.titles.B });
    // 새로고침 뒤(lastEnding 은 등급만) 칭호 복원도 같은 규칙
    expect(endingTitle('perfect', 'B')).toBe(CASE.titles.A);
    expect(endingTitle('hidden', 'S')).toBe(CASE.titles.S);
    expect(endingTitle('short', 'B')).toBe(CASE.titles.B);
    expect(endingTitle('timeout', 'C')).toBe(CASE.titles.timeout);
    expect(gradeCapOf({ rewound: false })).toBeNull();
    expect(gradeCapOf({ rewound: true })).toBe('A');
    expect(gradeCapOf({ rewound: false, recall: { n: 2, ids: ['E05'] } })).toBe('B');
  });

  it('E11 미리 채우기는 지금 손에 있는 카드만(범인은 유지) — 더 이른 시점으로 돌아가면 칸이 빈다', () => {
    let r = playPath(['L2', 'T04', 'T05']);
    r = must(openSet(r, 'T01'));
    r = { ...r, trust: 1, prevAccuse: { culprit: CULPRIT, means: 'E02', opportunity: 'E03b', motive: 'E09' } };
    const dead = must(present(r, 'T01.1', ['E01']));
    const back = must(rewind(dead));
    expect(back.evidence).not.toContain('E03b');
    expect(back.prevAccuse).toEqual({ culprit: CULPRIT, means: 'E02' });
    for (const sl of ['means', 'opportunity', 'motive'] as const) {
      const c = back.prevAccuse?.[sl];
      if (c) expect(back.evidence).toContain(c);
    }
    // ★ 3 이 되면 지목 화면이 '칸' 단계부터 — 들고 있는 카드만 채워져 있다
    const s3 = { ...back, broken: [...back.broken, 'C10'] };
    expect(must(startAccuse(s3)).accuse).toMatchObject({ stage: 'slots', culprit: CULPRIT, means: 'E02' });
    expect(must(startAccuse(s3)).accuse?.opportunity).toBeUndefined();
  });

  it('E12 최단 기록(best) — 처음부터·무되감기 완벽/숨은만, 쓴 행동 수 기준(같으면 유지)', () => {
    const fast = judged(playPath(PERFECT_PATH), RIGHT).result!;
    let m = applyResultToMeta(newMeta(), fast, 10);
    expect(m.best).toEqual({ used: 8, ms: fast.playMs, grade: 'A', at: 10 });
    m = applyResultToMeta(m, { ...fast, actionsLeft: 4 }, 11); // 9 — 더 느림
    expect(m.best?.at).toBe(10);
    m = applyResultToMeta(m, fast, 12); // 같음 — 유지
    expect(m.best?.at).toBe(10);
    m = applyResultToMeta(m, { ...fast, actionsLeft: 7, rewinds: 1 }, 13); // 되감기 판
    expect(m.best?.at).toBe(10);
    m = applyResultToMeta(m, { ...fast, actionsLeft: 9, recallRun: 2 }, 14); // 기억 판
    expect(m.best?.at).toBe(10);
    m = applyResultToMeta(m, { ...fast, actionsLeft: 6 }, 15);
    expect(m.best).toMatchObject({ used: 7, at: 15 });
    m = applyResultToMeta(m, { ...fast, ending: 'short', actionsLeft: 12, attempt: 1 }, 16);
    expect(m.best?.used).toBe(7);
  });
});

describe('다시 하기 — 수사 기억(사양 c)', () => {
  const ALL_IDS = CASE.evidence.map((e) => e.id);

  it('이월 범위 = 방에서 줍는 원본 15장 — 돌파·추궁·갱신 카드(E03a·E03b·E14·E14b·E15·E16)는 안 넘어간다', () => {
    expect(RECALL_ELIGIBLE).toHaveLength(15);
    expect(tutorialEvidence()).toEqual(['E01', 'E02', 'E03']);
    expect(recallable(ALL_IDS)).toEqual(RECALL_ELIGIBLE.filter((id) => !['E01', 'E02', 'E03'].includes(id)));
    const r = newRun({ recall: ALL_IDS, recallN: 4 });
    for (const id of ['E03a', 'E03b', 'E14', 'E14b', 'E15', 'E16']) expect(r.evidence).not.toContain(id);
    expect(r.evidence).toEqual(expect.arrayContaining([...RECALL_ELIGIBLE]));
    expect(r.recall).toEqual({ n: 4, ids: recallable(ALL_IDS) });
    // 머리 쓰는 부분은 0 부터
    expect(r).toMatchObject({ actions: 13, trust: 5, wrong: 0, hints: 0, rewound: false, broken: ['C01'], opened: ['T00'], pressed: [], revealed: [], flags: [], secrets: [], phase: 'play', screen: { name: 'hub' } });
    // 장소는 거실만 '들어간 곳' — 나머지 장소 입장은 행동 1 그대로
    expect(r.visited.filter((v) => CASE.locations.some((l) => l.id === v))).toEqual(['L0']);
    expect(costOf(r, { location: 'L2' })).toBe(1);
    // 정밀 조사(L2.h3)는 조사 완료로 들어와 다시 돈이 들지 않는다
    expect(costOf(r, { hotspot: 'L2.h3' })).toBe(0);
    const in2 = must(enterLocation(r, 'L2'));
    expect(in2.actions).toBe(12);
    expect(visibleHotspots(in2, 'L2').filter((h) => h.examined).map((h) => h.hotspot.id)).toEqual(expect.arrayContaining(['L2.h1', 'L2.h2', 'L2.h3']));
    // NEW 점 0 · 「기억」 표시
    for (const id of r.recall!.ids) {
      expect(r.seen).toContain(id);
      expect(isRecalled(r, id)).toBe(true);
    }
    expect(isRecalled(r, 'E01')).toBe(false);
    // 지도: 기억으로 다 가진 방 ✓, 잠긴 방은 표시 안 함
    expect(roomStatus(r, 'L1').allRecalled).toBe(true);
    expect(roomStatus(r, 'L5').state).toBe('locked');
    expect(roomStatus(r, 'L5').allRecalled).toBeUndefined();
    const part = newRun({ recall: ['E05'] });
    expect(roomStatus(part, 'L1').allRecalled).toBeUndefined();
    expect(roomStatus(newRun({ skipTutorial: true }), 'L1').allRecalled).toBeUndefined();
  });

  it('기억 판도 행동 13 · 22:50(rulesOf) · 튜토리얼만 지급된 건 기억 판이 아니다', () => {
    const r = newRun({ recall: RECALL_ELIGIBLE });
    expect(r.actions).toBe(RULES.normal.actions);
    expect(clock(r)).toBe('22:50');
    expect(r.recall?.n).toBe(2);
    const t = newRun({ recall: ['E01', 'E02', 'E03'] });
    expect(t.recall).toBeUndefined();
    expect(newRun({ recall: [] }).screen.name).toBe('intro');
  });

  it('recallPlan — 1회차·들고 갈 게 없으면 null, 그 밖엔 ids·회차(plays+1)·개수', () => {
    const m: WitnessMeta = { ...newMeta(), plays: 0, found: [...RECALL_ELIGIBLE] };
    expect(recallPlan(m)).toBeNull();
    expect(recallPlan({ ...m, plays: 2, found: ['E01', 'E02', 'E03'] })).toBeNull();
    expect(recallPlan({ ...m, plays: 2, found: undefined })).toBeNull();
    expect(recallPlan({ ...m, plays: 2, found: ['E01', 'E05', 'E09'] })).toEqual({ ids: ['E05', 'E09'], n: 3, count: 2 });
  });

  it('absorbFound — 버리는 판에서 방에서 찾은 것만 더한다(갱신본을 들었으면 원본 칸으로)', () => {
    const r = playPath(PERFECT_PATH);
    const m = absorbFound(newMeta(), r);
    expect(m.found).toEqual(RECALL_ELIGIBLE.filter((id) => missed(r).every((x) => x.id !== id)));
    expect(m.found).toContain('E03'); // E03b 를 들고 있어도 원본 칸 E03 으로
    expect(absorbFound(m, r)).toBe(m); // 멱등 — 바뀐 게 없으면 같은 객체
  });
});

describe('다시 하기 — 무작위 걸음(되감기 전부 · 기억 판 · v2 저장 왕복)', () => {
  it('시드 고정 150판: 행동 범위 · 판정 ≤ 3 · 칸 ≤ 2 · 저장 왕복', async () => {
    const { parseRun, serializeRun } = await import('./storage');
    let a = 99;
    const rnd = () => {
      a = (Math.imul(a, 1664525) + 1013904223) >>> 0;
      return a / 4294967296;
    };
    const pick = <T,>(xs: readonly T[]): T => xs[Math.floor(rnd() * xs.length)];
    let rewinds = 0;
    const kinds = new Set<string>();
    for (let seed = 0; seed < 150; seed++) {
      const run0 = seed % 3 === 0 ? newRun({ recall: RECALL_ELIGIBLE, recallN: 2 }) : newRun({ skipTutorial: true });
      let run = seed % 2 === 0 ? freeClosure(run0) : run0;
      for (let k = 0; k < 80; k++) {
        let s: Step;
        if (run.phase === 'ended') {
          if (!rewindOption(run)) break;
          s = rewind(run);
          rewinds++;
          for (const e of s.events)
            if (e.t === 'rewound') {
              kinds.add(e.kind);
              // QA-RP-04: 지목 조건이 다시 닫히는 건 수사 배제 되감기뿐(시간 초과는 ★<3 에서만, 지목 직전 스냅샷은 ★ 같음)
              if (e.kind !== 'excluded') expect(e.gateClosed).toBe(false);
            }
        } else {
          const choices: (() => Step)[] = [
            () => enterLocation(run, pick(CASE.locations).id),
            () => openSet(run, pick(CASE.sets).id),
            () => exit(run),
            () => hint(run),
            () => continueAfterSiren(run),
            () => endInv(run),
          ];
          if (canAccuse(run))
            choices.push(() => {
              // 손에 든 카드로 아무렇게나(가끔 정답 카드를 섞는다) — 실패하면 그 단계 오류를 그대로
              const held = run.evidence.filter((id) => getEvidence(id));
              const cards = [...new Set([pick(held), pick(held), pick(held), ...held])].slice(0, 3);
              if (cards.length < 3) return { run, events: [], error: 'bad-accusation' };
              const a = rnd() < 0.3 && [RIGHT.means, RIGHT.opportunity, RIGHT.motive].every((c) => held.includes(c)) ? RIGHT : { culprit: pick(['S1', 'S2', 'S3', 'S4'] as const), means: cards[0], opportunity: cards[1], motive: cards[2] };
              let st = startAccuse(run);
              if (!st.error) st = pickCulprit(st.run, a.culprit);
              for (const sl of ['means', 'opportunity', 'motive'] as const) if (!st.error) st = setSlot(st.run, sl, a[sl]);
              return st.error ? st : submitAccusation(st.run);
            });
          const st = run.screen;
          if (st.name === 'testimony' && st.ref) {
            const ls = visibleLines(run, st.ref);
            if (ls.length && run.evidence.length) choices.push(() => present(run, pick(ls).line.id, [pick(run.evidence)]));
          }
          const c = pick(choices)();
          // 실패한 행동 자리에 가끔 '할 수 있는 무료 행동 전부'(돌파 포함)를 끼워 진행시킨다
          s = c.error ? { run: rnd() < 0.2 ? freeClosure(run) : run, events: [] } : c;
        }
        const r = s.run;
        expect(r.actions).toBeGreaterThanOrEqual(0);
        expect(r.actions).toBeLessThanOrEqual(RULES.normal.actions);
        expect(r.attempts ?? 0).toBeLessThanOrEqual(3);
        expect(r.rewinds?.judged ?? 0).toBeLessThanOrEqual(RULES.normal.rewindSlots);
        if (r.phase === 'play') expect(r.trust).toBeGreaterThan(0);
        if (r.recall && r.result) expect(['B', 'C']).toContain(r.result.grade);
        if (r.rewound && r.result) expect(r.result.grade).not.toBe('S');
        const back = parseRun(serializeRun(r));
        expect(back, `seed ${seed} step ${k}`).not.toBeNull();
        run = r;
      }
    }
    expect(rewinds).toBeGreaterThan(20);
    expect([...kinds].sort()).toEqual(['accuse', 'action', 'excluded']);
  });
});
