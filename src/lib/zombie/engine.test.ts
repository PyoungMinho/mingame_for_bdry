import { describe, expect, it } from 'vitest';
import {
  DEFAULT_SCENE_HOURS,
  INFECTION_SCENES,
  MIN_CHOICES_BEFORE_END,
  START_STATS,
  STARVING_HP,
  SUPPLY_DRAIN_BASE,
  SUPPLY_DRAIN_PER_COMPANION,
} from './contract';
import {
  applyChoice,
  checkCondition,
  ChoiceError,
  formatClock,
  formatSurvived,
  infectionLeft,
  newRun,
  resolveEnding,
  resolveParas,
  restoreRun,
  survivorType,
  visibleChoices,
  type RunState,
} from './engine';
import type { Ending, EndingId, StoryNode } from './types';

// ── 픽스처: 엔진 규칙만 검증하는 작은 이야기 ──
const n = (id: string, over: Partial<StoryNode>): StoryNode => ({
  id,
  chapter: 1,
  location: 'home',
  scene: 'home_living',
  title: id,
  body: ['본문'],
  choices: [],
  ...over,
});

const NODES: Record<string, StoryNode> = {
  c1_start: n('c1_start', {
    clock: 14,
    body: ['시작', { when: { companions: ['kongi'] }, text: '콩이가 있다' }, { when: { noCompanions: ['kongi'] }, text: '콩이가 없다' }],
    choices: [
      {
        id: 'bat',
        label: '방망이를 챙긴다',
        tags: ['careful'],
        outcomes: [{ effects: { addItems: ['bat'], hours: 1 }, result: ['챙겼다'], next: 'fight' }],
      },
      {
        id: 'leave_dog',
        label: '콩이를 두고 간다',
        tags: ['cold'],
        outcomes: [
          {
            effects: { removeCompanions: ['kongi'], setFlags: ['leftDog'], mental: -20 },
            result: [{ when: { companions: ['kongi'] }, text: '콩이가 짖는다' }, '문을 닫는다'],
            next: 'fight',
          },
        ],
      },
      {
        id: 'bitten',
        label: '물린다',
        outcomes: [{ effects: { infect: true }, result: ['물렸다'], next: 'loop' }],
      },
      {
        id: 'secret',
        label: '비밀 선택',
        requires: { flags: ['never'] },
        lockedHint: '뭔가 있었다면…',
        outcomes: [{ result: ['x'], next: 'fight' }],
      },
      {
        id: 'hidden',
        label: '숨은 선택',
        requires: { items: ['pass'] },
        outcomes: [{ result: ['x'], next: 'fight' }],
      },
    ],
  }),
  fight: n('fight', {
    chapter: 2,
    location: 'store',
    clock: 20,
    choices: [
      {
        id: 'swing',
        label: '휘두른다',
        tags: ['brave'],
        outcomes: [
          { when: { items: ['bat'] }, effects: { hp: -5 }, result: ['방망이 덕분에'], next: 'end:heli' },
          { chance: 0.5, effects: { hp: -30 }, result: ['간신히'], next: 'end:heli' },
          { effects: { hp: -200 }, result: ['당했다'], next: 'end:heli' },
        ],
      },
      { id: 'die', label: '뛰어내린다', outcomes: [{ effects: { hp: -100 }, result: ['...'], next: 'end:hero' }] },
      { id: 'break', label: '무너진다', outcomes: [{ effects: { mental: -100 }, result: ['...'], next: 'loop' }] },
    ],
  }),
  loop: n('loop', {
    chapter: 3,
    location: 'station',
    choices: [
      { id: 'wait', label: '기다린다', outcomes: [{ effects: { hours: 1 }, result: ['시간이 흐른다'], next: 'loop' }] },
      { id: 'starve', label: '굶는다', outcomes: [{ effects: { supply: -100 }, result: ['배고프다'], next: 'loop' }] },
      { id: 'fall', label: '떨어진다', outcomes: [{ effects: { hp: -200 }, result: ['쿵'], next: 'loop' }] },
    ],
  }),
};

const ending = (id: EndingId, kind: Ending['kind'], extra: Partial<Ending> = {}): Ending => ({
  id,
  kind,
  title: id,
  scene: 'helicopter',
  body: [`${id} 본문`],
  epitaph: `${id} 한 줄`,
  ...extra,
});

const ENDINGS = {
  heli: ending('heli', 'survived', {
    variants: [{ when: { companions: ['kongi'] }, title: '콩이와 헬기', body: ['콩이도 탔다'], epitaph: '콩이 몫' }],
  }),
  hero: ending('hero', 'special'),
  dead: ending('dead', 'dead'),
  breakdown: ending('breakdown', 'dead'),
  turned: ending('turned', 'turned'),
} as unknown as Record<EndingId, Ending>;

const start = (seed = 42) => newRun(seed, NODES.c1_start);

/** 선택 기록을 n 개 채운 상태 — 최소 선택 수 가드 이후의 규칙을 시험할 때 */
const veteran = (s: RunState, n = MIN_CHOICES_BEFORE_END) => ({
  ...s,
  history: Array.from({ length: n }, (_, i) => ({
    nodeId: 'loop',
    title: 'loop',
    chapter: 3 as const,
    location: 'station' as const,
    clock: 14 + i,
    choiceId: 'wait',
    choiceLabel: '기다린다',
  })),
});

describe('newRun', () => {
  it('시작 상태', () => {
    const s = start();
    expect(s.nodeId).toBe('c1_start');
    expect(s.stats).toEqual(START_STATS);
    expect(s.companions).toEqual(['kongi']);
    expect(s.clock).toBe(14);
    expect(s.route).toEqual(['home']);
    expect(formatClock(s.clock)).toBe('D+0 14:00');
  });
});

describe('조건·문단', () => {
  it('동행 조건부 문단', () => {
    const s = start();
    expect(resolveParas(s, NODES.c1_start.body)).toEqual(['시작', '콩이가 있다']);
    const noDog: RunState = { ...s, companions: [] };
    expect(resolveParas(noDog, NODES.c1_start.body)).toEqual(['시작', '콩이가 없다']);
  });

  it('min/max/infected', () => {
    const s = start();
    expect(checkCondition(s, { min: { hp: 100 } })).toBe(true);
    expect(checkCondition(s, { max: { supply: 59 } })).toBe(false);
    expect(checkCondition(s, { infected: false })).toBe(true);
    expect(checkCondition({ ...s, infectedAt: 0 }, { infected: true })).toBe(true);
    expect(checkCondition(s, { anyItems: ['bat', 'pass'] })).toBe(false);
  });

  it('잠금 선택지는 표시, lockedHint 없는 조건 불충족은 숨김', () => {
    const vis = visibleChoices(start(), NODES.c1_start).map((v) => `${v.choice.id}:${v.status}`);
    expect(vis).toContain('secret:locked');
    expect(vis.find((v) => v.startsWith('hidden'))).toBeUndefined();
  });

  it('잠긴 선택지는 고를 수 없다', () => {
    expect(() => applyChoice(start(), NODES, 'secret')).toThrow(ChoiceError);
  });
});

describe('applyChoice', () => {
  it('아이템 획득·시간·다음 노드 clock 보정·경로', () => {
    const r = applyChoice(start(), NODES, 'bat');
    expect(r.delta.itemsGained).toEqual(['bat']);
    expect(r.state.items).toEqual(['bat']);
    expect(r.state.nodeId).toBe('fight');
    expect(r.state.clock).toBe(20); // 14+1 → fight.clock 20 으로 당겨짐
    expect(r.state.route).toEqual(['home', 'store']);
    expect(r.state.traits.careful).toBe(1);
    expect(r.state.history[0]).toMatchObject({ nodeId: 'c1_start', choiceId: 'bat', clock: 14 });
  });

  it('hours 없는 결과도 기본 15분은 흐른다 (시계 정지 방지)', () => {
    const r = applyChoice(start(), NODES, 'bitten'); // effects 에 hours 없음, loop 노드는 clock 없음
    expect(r.state.clock).toBe(14 + DEFAULT_SCENE_HOURS);
    expect(r.delta.hours).toBe(0); // 결과 칩에는 표시하지 않는다
    expect(formatClock(r.state.clock)).toBe('D+0 14:15');
    expect(formatSurvived(r.state)).toBe('15분');
    const later = applyChoice(r.state, NODES, 'wait');
    expect(formatSurvived(later.state)).toBe('1시간');
  });

  it('장면 경과 보급 소모 = 기본 + ⌊동행 수 × 계수⌋', () => {
    const r = applyChoice(start(), NODES, 'bat');
    const drain = SUPPLY_DRAIN_BASE + Math.floor(SUPPLY_DRAIN_PER_COMPANION * 1);
    expect(r.delta.upkeep.supply).toBe(-drain);
    expect(r.state.stats.supply).toBe(START_STATS.supply - drain);
  });

  it('결과 문단은 선택하던 순간(효과 전) 상태로 평가', () => {
    const r = applyChoice(start(), NODES, 'leave_dog');
    expect(r.result).toEqual(['콩이가 짖는다', '문을 닫는다']);
    expect(r.state.companions).toEqual([]);
    expect(r.state.lost).toEqual(['kongi']);
    expect(r.delta.left).toEqual(['kongi']);
    expect(r.state.flags).toContain('leftDog');
  });

  it('when 조건 outcome 이 우선', () => {
    const s = applyChoice(start(), NODES, 'bat').state;
    const r = applyChoice(s, NODES, 'swing');
    expect(r.result).toEqual(['방망이 덕분에']);
    expect(r.rolled).toBe('none');
    expect(r.state.ending).toBe('heli');
  });

  it('chance 는 시드 결정론적이고 성공·실패 모두 나온다', () => {
    const seen = new Set<string>();
    for (let seed = 1; seed <= 60; seed++) {
      const s = applyChoice(start(seed), NODES, 'leave_dog').state;
      const a = applyChoice(s, NODES, 'swing');
      const b = applyChoice(s, NODES, 'swing');
      expect(a.result).toEqual(b.result); // 같은 상태 → 같은 결과
      seen.add(a.rolled);
    }
    expect(seen).toEqual(new Set(['success', 'fail']));
  });

  it('생존 엔딩이어도 체력 0 이면 사망이 우선', () => {
    let s = applyChoice(start(3), NODES, 'leave_dog').state;
    // 확률 실패 경로를 찾을 때까지 시드를 돌린다
    for (let seed = 1; seed < 200; seed++) {
      s = { ...s, rng: seed };
      const r = applyChoice(s, NODES, 'swing');
      if (r.result[0] === '당했다') {
        expect(r.forced).toBe('hp');
        expect(r.state.ending).toBe('dead');
        return;
      }
    }
    throw new Error('실패 경로를 못 찾음');
  });

  it('특별 엔딩(hero)은 체력 0 이어도 스토리 엔딩 유지', () => {
    const s = applyChoice(start(), NODES, 'bat').state;
    const r = applyChoice(s, NODES, 'die');
    expect(r.state.ending).toBe('hero');
    expect(r.forced).toBeNull();
  });

  it('정신력 0 → breakdown (최소 선택 수 이후)', () => {
    const s = veteran(applyChoice(start(), NODES, 'bat').state);
    const r = applyChoice(s, NODES, 'break');
    expect(r.state.ending).toBe('breakdown');
    expect(r.state.endingCause).toBe('mental');
  });

  it('감염 카운트다운 → turned (최소 선택 수 전이면 그때까지 미뤄진다)', () => {
    let r = applyChoice(start(), NODES, 'bitten');
    expect(r.delta.infected).toBe(true);
    expect(infectionLeft(r.state)).toBe(Math.max(INFECTION_SCENES, MIN_CHOICES_BEFORE_END) - 1);
    let guard = 0;
    while (!r.state.ending && guard++ < 30) r = applyChoice(r.state, NODES, 'wait');
    expect(r.state.ending).toBe('turned');
    expect(r.state.scenes).toBe(Math.max(INFECTION_SCENES, MIN_CHOICES_BEFORE_END));
  });

  it('HUD 감염 카운트다운은 실제 변이 직전에 0 이 된다', () => {
    let r = applyChoice(start(), NODES, 'bitten');
    const seen: number[] = [];
    let guard = 0;
    while (!r.state.ending && guard++ < 30) {
      seen.push(infectionLeft(r.state)!);
      r = applyChoice(r.state, NODES, 'wait');
    }
    expect(r.state.ending).toBe('turned');
    // 매 장면 1씩 줄고, 변이 직전 장면에서 1 → 변이
    expect(seen).toEqual(Array.from({ length: seen.length }, (_, i) => seen.length - i));
  });

  it('최소 선택 수 전에는 체력·정신력 0 이어도 1 로 버틴다 (구사일생)', () => {
    const a = applyChoice(start(), NODES, 'bitten');
    const r = applyChoice(a.state, NODES, 'fall');
    expect(r.state.ending).toBeNull();
    expect(r.state.stats.hp).toBe(1);
    expect(r.delta.clutch).toBe(true);
    // 결과 칩의 손실 = 실제 변화 (효과 + 굶주림)
    expect(r.delta.hp + r.delta.upkeep.hp).toBe(r.state.stats.hp - a.state.stats.hp);
    const m = applyChoice(applyChoice(start(), NODES, 'bat').state, NODES, 'break'); // fight 노드의 정신력 −100
    expect(m.state.ending).toBeNull();
    expect(m.state.stats.mental).toBe(1);
  });

  it('최소 선택 수째 선택부터는 강제 엔딩이 난다', () => {
    const s = veteran(applyChoice(start(), NODES, 'bitten').state, MIN_CHOICES_BEFORE_END - 1);
    const r = applyChoice(s, NODES, 'fall'); // 이 선택이 MIN 번째
    expect(r.state.history.length).toBe(MIN_CHOICES_BEFORE_END);
    expect(r.state.ending).toBe('dead');
    expect(r.delta.clutch).toBe(false);
  });

  it('보급을 못 채우면 굶주림으로 체력이 깎인다', () => {
    let r = applyChoice(start(), NODES, 'bitten');
    r = applyChoice(r.state, NODES, 'starve');
    expect(r.state.stats.supply).toBe(0);
    expect(r.delta.starving).toBe(true);
    expect(r.delta.upkeep.hp).toBe(-STARVING_HP);
  });

  it('엔딩 이후 선택은 거부', () => {
    const s = applyChoice(start(), NODES, 'bat').state;
    const r = applyChoice(s, NODES, 'swing');
    expect(() => applyChoice(r.state, NODES, 'swing')).toThrow(ChoiceError);
  });
});

describe('엔딩·유형·저장', () => {
  it('엔딩 변형은 조건이 맞으면 덮어쓴다', () => {
    const s = applyChoice(start(), NODES, 'bat').state;
    const withDog = applyChoice(s, NODES, 'swing').state;
    expect(resolveEnding(withDog, ENDINGS)).toMatchObject({ title: '콩이와 헬기', epitaph: '콩이 몫', body: ['콩이도 탔다'] });
    const noDog = applyChoice(applyChoice(start(), NODES, 'leave_dog').state, NODES, 'die').state;
    expect(resolveEnding(noDog, ENDINGS)).toMatchObject({ title: 'hero', body: ['hero 본문'] });
  });

  it('생존자 유형은 가장 많이 고른 성향', () => {
    const s = applyChoice(start(), NODES, 'bat').state;
    expect(survivorType(s).tag).toBe('careful');
  });

  it('저장 복원: 정상/깨짐/사라진 노드', () => {
    const s = applyChoice(start(), NODES, 'bat').state;
    expect(restoreRun(JSON.parse(JSON.stringify(s)), NODES)).toEqual(s);
    expect(restoreRun({ ...s, nodeId: 'gone' }, NODES)).toBeNull();
    expect(restoreRun({ ...s, v: 99 }, NODES)).toBeNull();
    expect(restoreRun('junk', NODES)).toBeNull();
    expect(restoreRun(null, NODES)).toBeNull();
  });
});
