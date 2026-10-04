/**
 * QA 설계자 코드 리뷰 회귀(2026-10-04) — 엔진·저장 레벨.
 *  1) 제시 판정 순서의 전수 검사: 모든 줄 × 모든 1~2장 조합에서 돌파 → HALF → 우회 → 오답 우선순위가 성립한다.
 *  2) 무작위 행동 수천 걸음(시드 고정)으로 행동 소비 경계·사이렌·신뢰·저장 왕복 불변식을 확인한다.
 *  3) 도감 칸 순서(collectionSlots)가 오인 체포 위치로 범인을 드러내지 않는다.
 *  4) 저장 화면 앵커의 ref 종류가 화면과 어긋나면 손상으로 폐기한다.
 */
import { describe, expect, it } from 'vitest';
import { CASE } from './case-data';
import {
  KNOWN,
  RULES,
  collectionSlots,
  continueAfterSiren,
  endingSlots,
  enterLocation,
  evalCond,
  examine,
  exit,
  halfCards,
  hint,
  judgePresent,
  newRun,
  openSet,
  present,
  press,
  rewind,
  startAccuse,
  cancelAccuse,
  visibleHotspots,
  visibleLines,
  type RunState,
  type Step,
} from './engine';
import type { CardId, EndingId } from './types';
import { parseRun } from './storage';

const ALL_CARDS: CardId[] = [...KNOWN.cards];
const PAIRS: CardId[][] = [];
for (let i = 0; i < ALL_CARDS.length; i++) {
  PAIRS.push([ALL_CARDS[i]]);
  for (let j = i + 1; j < ALL_CARDS.length; j++) PAIRS.push([ALL_CARDS[i], ALL_CARDS[j]]);
}
const sameSet = (a: readonly string[], b: readonly string[]) => a.length === b.length && a.every((x) => b.includes(x));

describe('제시 판정 우선순위 — 전수(줄 × 1~2장 조합)', () => {
  // requires 가 있는 돌파는 '미충족' · '충족' 두 상태 모두 본다
  const states: { label: string; run: RunState }[] = [
    { label: '빈 판', run: newRun() },
    { label: '모든 플래그·돌파(대상 줄 제외)', run: { ...newRun(), flags: [...KNOWN.flags], broken: [] } },
  ];
  for (const { label, run } of states) {
    it(`${label}: BREAK ⇔ 정답 집합과 정확히 같음(요건 충족) · HALF ⇔ 정답·반쪽 카드 포함 · REDIRECT 는 둘 다 하나도 없을 때만`, () => {
      let checked = 0;
      for (const set of CASE.sets)
        for (const line of set.lines) {
          const breaks = line.breaks ?? [];
          for (const cards of PAIRS) {
            const j = judgePresent(run, line.id, cards);
            const exact = breaks.find((b) => [b.evidence, ...(b.accept ?? [])].some((s) => sameSet(cards, s)));
            // v3: half 객체의 카드 키(반쪽 카드)도 HALF
            const touches = breaks.some((b) => [b.evidence, ...(b.accept ?? [])].some((s) => cards.some((c) => s.includes(c))) || cards.some((c) => halfCards(b).includes(c)));
            const inRedirect = !!line.redirect && cards.every((c) => line.redirect!.cards.includes(c));
            if (exact) {
              const req = !exact.requires || evalCond(exact.requires, run);
              expect(j.kind, `${line.id} ${cards}`).toBe(req ? 'BREAK' : 'HALF');
            } else if (touches) expect(j.kind, `${line.id} ${cards}`).toBe('HALF');
            else if (inRedirect) expect(j.kind, `${line.id} ${cards}`).toBe('REDIRECT');
            else expect(j.kind, `${line.id} ${cards}`).toBe('WRONG');
            checked++;
          }
        }
      expect(checked).toBeGreaterThan(10000);
    });
  }

  it('우회 카드 목록에는 그 줄의 정답·반쪽 카드가 없다(있으면 HALF 에 가려 우회가 죽은 데이터가 된다)', () => {
    for (const set of CASE.sets)
      for (const line of set.lines) {
        if (!line.redirect) continue;
        const answer = new Set([...(line.breaks ?? []).flatMap((b) => [b.evidence, ...(b.accept ?? [])]).flat(), ...(line.breaks ?? []).flatMap((b) => halfCards(b))]);
        for (const c of line.redirect.cards) expect(answer.has(c), `${line.id} 우회 카드 ${c}`).toBe(false);
      }
  });

  it('깬 줄에 다시 내면 어떤 카드든 ALREADY(감점 없음)', () => {
    for (const set of CASE.sets)
      for (const line of set.lines) {
        if (!line.breaks?.length) continue;
        const run = { ...newRun(), broken: line.breaks.map((b) => b.id) };
        for (const cards of PAIRS.slice(0, 60)) expect(judgePresent(run, line.id, cards).kind).toBe('ALREADY');
      }
  });
});

// ─────────────────────────────── 무작위 걸음(불변식) ───────────────────────────────

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

describe('무작위 걸음 — 행동 소비·사이렌·신뢰·저장 왕복 불변식', () => {
  const R = RULES.normal;
  it('시드 고정 400판 × 최대 120걸음', () => {
    let steps = 0;
    for (let seed = 1; seed <= 400; seed++) {
      const rnd = mulberry32(seed);
      const pick = <T,>(xs: readonly T[]): T => xs[Math.floor(rnd() * xs.length)];
      let run = newRun({ skipTutorial: seed % 2 === 0 });
      let spentTotal = R.actions - run.actions;
      for (let k = 0; k < 160; k++) {
        // 수사 배제는 대개 되감는다(되감기 경로까지 걷게), 그 밖의 엔딩이면 이 판은 끝
        if (run.phase === 'ended' && !(run.result?.ending === 'excluded' && rnd() < 0.85)) break;
        const before = run;
        const scr = run.screen;
        const choices: (() => Step)[] = [
          () => enterLocation(run, pick(CASE.locations).id),
          () => openSet(run, pick(CASE.sets).id),
          () => exit(run),
          () => hint(run),
          () => continueAfterSiren(run),
          () => startAccuse(run),
          () => cancelAccuse(run),
        ];
        if (scr.name === 'location' && scr.ref) {
          const hs = visibleHotspots(run, scr.ref);
          if (hs.length) choices.push(() => examine(run, pick(hs).hotspot.id), () => examine(run, pick(hs).hotspot.id));
        }
        if (scr.name === 'testimony' && scr.ref) {
          const ls = visibleLines(run, scr.ref);
          if (ls.length) {
            const held = [...run.evidence, ...CASE.profiles.map((p) => p.id)];
            choices.push(() => press(run, pick(ls).line.id), () => press(run, pick(ls).line.id));
            // 무작위 제시는 가끔만(대부분 수사 배제로 끝나 경계까지 못 간다)
            if (rnd() < 0.3)
              choices.push(
                () => present(run, pick(ls).line.id, [pick(held)]),
                () => present(run, pick(ls).line.id, [...new Set([pick(held), pick(held)])]),
              );
            // 정답을 아는 플레이어도 섞는다(돌파·chain·대질 경로까지 닿게)
            const ready = ls.flatMap((l) => (l.line.breaks ?? []).map((b) => ({ id: l.line.id, cards: b.evidence })));
            if (ready.length) {
              const t = pick(ready);
              choices.push(() => present(run, t.id, t.cards), () => present(run, t.id, t.cards), () => present(run, t.id, t.cards));
            }
          }
        }
        const s = run.phase === 'ended' ? rewind(run) : pick(choices)();
        steps++;
        const r = s.run;
        if (s.error) {
          // 실패한 행동은 상태를 바꾸지 않는다
          expect(r).toBe(before);
          continue;
        }
        // I1: 행동은 spent 이벤트로만, 정확히 그만큼 준다(되감기는 체크포인트 값으로 돌아감)
        const spent = s.events.filter((e) => e.t === 'spent').reduce((a, e) => a + (e.t === 'spent' ? e.cost : 0), 0);
        if (before.phase === 'ended') spentTotal = R.actions - r.actions;
        else {
          spentTotal += spent;
          expect(r.actions, `seed ${seed} step ${k}`).toBe(R.actions - spentTotal);
        }
        expect(r.actions).toBeGreaterThanOrEqual(0);
        // I2: 이미 들어간 장소·연 세트·조사한 핫스팟 재방문은 무료
        const byHint = s.events.some((e) => e.t === 'hint');
        for (const e of s.events)
          if (e.t === 'spent' && !byHint) {
            const target = r.screen.ref;
            if (r.screen.name === 'location' && target) {
              // 장소 첫 진입 또는 정밀 조사만 비용
              const newHotspot = r.visited.filter((x) => !before.visited.includes(x));
              expect(newHotspot.length, `seed ${seed} step ${k} 재방문 과금`).toBeGreaterThan(0);
            }
            if (r.screen.name === 'testimony' && target) expect(before.opened.includes(target)).toBe(false);
          }
        // I3: 진행 중 · 행동 0 · 지목 화면이 아니면 끝까지 마칠 대상이 하나 이상 있다(없으면 갇힌다)
        if (r.phase === 'play' && r.actions === 0 && r.screen.name !== 'accuse') expect(r.final.length, `seed ${seed} step ${k} 갇힘`).toBeGreaterThan(0);
        // I4: 신뢰 범위 · 진행 중이면 신뢰 > 0 · 끝났으면 결과
        expect(r.trust).toBeGreaterThanOrEqual(0);
        expect(r.trust).toBeLessThanOrEqual(R.trustMax);
        if (r.phase === 'play') expect(r.trust).toBeGreaterThan(0);
        if (r.phase === 'ended') expect(r.result).toBeTruthy();
        // I5: 증거 중복 없음 · 원본과 갱신본을 동시에 들지 않는다
        expect(new Set(r.evidence).size).toBe(r.evidence.length);
        for (const e of CASE.evidence) if (e.upgradeOf && r.evidence.includes(e.id)) expect(r.evidence.includes(e.upgradeOf)).toBe(false);
        // I6: 사이렌·엔딩 뒤에는 행동을 쓰지 않는다
        if (before.phase !== 'play') expect(spent).toBe(0);
        // I7: 저장 왕복 — 엔진이 만든 모든 상태는 저장 검증을 통과한다(정상 플레이가 '손상'으로 폐기되면 안 된다)
        const back = parseRun(JSON.stringify(r));
        expect(back, `seed ${seed} step ${k} 저장 왕복 실패 screen=${JSON.stringify(r.screen)}`).not.toBeNull();
        run = r;
      }
    }
    expect(steps).toBeGreaterThan(20000);
  });
});

describe('도감 칸 순서(collectionSlots)', () => {
  const culprit = CASE.solution.culprit;
  const innocents = (['S1', 'S2', 'S3', 'S4'] as const).filter((s) => s !== culprit);

  it('칸 집합은 endingSlots 와 같고(8칸) 앞·뒤 고정 칸은 그대로', () => {
    const base = endingSlots();
    for (const got of [[], ['wrong-' + innocents[2]], ['perfect', 'wrong-' + innocents[1]]] as EndingId[][]) {
      const s = collectionSlots(got);
      expect(s).toHaveLength(base.length);
      expect([...s].sort()).toEqual([...base].sort());
      expect(s.slice(0, 3)).toEqual(['perfect', 'hidden', 'short']);
      expect(s.slice(-2)).toEqual(['timeout', 'excluded']);
    }
  });

  it('본 오인 체포의 위치(본 칸 여부 배열)는 누구를 지목했는지와 무관하다', () => {
    const shape = (got: EndingId[]) => collectionSlots(got).map((e) => (got.includes(e) ? 1 : 0));
    const one = innocents.map((s) => shape([`wrong-${s}` as EndingId]));
    for (const x of one) expect(x).toEqual(one[0]);
    const two = [
      shape([`wrong-${innocents[0]}`, `wrong-${innocents[1]}`] as EndingId[]),
      shape([`wrong-${innocents[2]}`, `wrong-${innocents[0]}`] as EndingId[]),
      shape([`wrong-${innocents[1]}`, `wrong-${innocents[2]}`] as EndingId[]),
    ];
    for (const x of two) expect(x).toEqual(two[0]);
  });
});

describe('저장 화면 앵커 — ref 종류 검증', () => {
  const ok = newRun({ skipTutorial: true });
  const withScreen = (screen: unknown) => JSON.stringify({ ...ok, screen });
  it('심문 + 세트 id / 조사 + 장소 id 는 통과', () => {
    expect(parseRun(withScreen({ name: 'testimony', ref: 'T01', line: 0 }))).not.toBeNull();
    expect(parseRun(withScreen({ name: 'location', ref: 'L1' }))).not.toBeNull();
  });
  it('심문 + 장소 id · 조사 + 세트 id 는 손상으로 폐기(렌더에서 getSet(...)! 가 죽는다)', () => {
    expect(parseRun(withScreen({ name: 'testimony', ref: 'L1', line: 0 }))).toBeNull();
    expect(parseRun(withScreen({ name: 'location', ref: 'T01' }))).toBeNull();
  });
});
