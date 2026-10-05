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
  type EngineEvent,
  type RunState,
  type Step,
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
