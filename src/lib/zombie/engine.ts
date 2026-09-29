/**
 * 좀비 터지면 — 게임 엔진 (순수 함수, React 비의존).
 *
 * 규칙 요약
 * - 선택 → outcomes 를 위에서부터 평가(when 거짓 skip, chance 굴림 실패 skip, 마지막은 폴백)
 * - 효과 적용 → 스탯 0~100 클램프 → 장면 경과(보급 소모·굶주림) → 강제 엔딩 판정 → 다음 노드 진입(clock 보정)
 * - 결과 문단의 조건은 "선택하던 순간"의 상태(효과 적용 전)로 평가한다.
 * - 난수는 상태에 저장된 시드로만 굴린다 → 새로고침해도 결과가 바뀌지 않는다(세이브 스커밍 방지).
 */
import {
  DEFAULT_SCENE_HOURS,
  ENDINGS_META,
  FORCED_ENDINGS,
  INFECTION_SCENES,
  MIN_CHOICES_BEFORE_END,
  START_CLOCK,
  START_COMPANIONS,
  START_NODE,
  START_STATS,
  STARVING_HP,
  STARVING_MENTAL,
  SUPPLY_DRAIN_BASE,
  SUPPLY_DRAIN_PER_COMPANION,
  TRAITS,
} from './contract';
import type {
  ChapterId,
  Choice,
  CompanionId,
  Condition,
  Effect,
  Ending,
  EndingId,
  ItemId,
  LocationId,
  Outcome,
  Para,
  StatKey,
  StoryNode,
  TraitTag,
} from './types';

export const SAVE_VERSION = 1;

export interface HistoryEntry {
  nodeId: string;
  title: string;
  chapter: ChapterId;
  location: LocationId;
  clock: number;
  choiceId: string;
  choiceLabel: string;
}

export type EndingCause = 'story' | 'hp' | 'mental' | 'infection';

export interface RunState {
  v: typeof SAVE_VERSION;
  seed: number;
  rng: number;
  nodeId: string;
  stats: Record<StatKey, number>;
  items: ItemId[];
  companions: CompanionId[];
  /** 한 번이라도 합류했다가 떠난/잃은 동료 */
  lost: CompanionId[];
  flags: string[];
  /** D+0 00:00 기준 경과 시간 */
  clock: number;
  /** 처리한 장면 수 */
  scenes: number;
  /** 감염된 시점의 scenes 값 (없으면 null) */
  infectedAt: number | null;
  /** 지나온 장소(연속 중복 제거) */
  route: LocationId[];
  history: HistoryEntry[];
  traits: Record<TraitTag, number>;
  ending: EndingId | null;
  endingCause: EndingCause | null;
}

export interface Delta {
  hp: number;
  supply: number;
  mental: number;
  itemsGained: ItemId[];
  itemsLost: ItemId[];
  joined: CompanionId[];
  left: CompanionId[];
  infected: boolean;
  cured: boolean;
  hours: number;
  /** 장면 경과로 인한 소모 (효과와 별도 표시) */
  upkeep: { supply: number; hp: number; mental: number };
  starving: boolean;
  /** 최소 선택 수 전이라 체력/정신력 0 을 1 로 버텼다 */
  clutch: boolean;
}

export interface Resolution {
  choice: Choice;
  outcome: Outcome;
  /** 확률 굴림이 있었다면 성공했는지 */
  rolled: 'none' | 'success' | 'fail';
  result: string[];
  delta: Delta;
  state: RunState;
  forced: Exclude<EndingCause, 'story'> | null;
}

export type ChoiceStatus = 'open' | 'locked' | 'hidden';

// ─────────────────────────────── 난수 ───────────────────────────────

/** mulberry32 한 스텝 — [0,1) 값과 다음 상태 */
export function step(rngState: number): [number, number] {
  const a = (rngState + 0x6d2b79f5) >>> 0;
  let t = a;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return [((t ^ (t >>> 14)) >>> 0) / 4294967296, a];
}

// ─────────────────────────────── 생성 ───────────────────────────────

const emptyTraits = (): Record<TraitTag, number> => ({ kind: 0, cold: 0, brave: 0, careful: 0, dog: 0, meme: 0 });

export function newRun(seed: number, startNode: StoryNode | undefined): RunState {
  const s = seed >>> 0;
  return {
    v: SAVE_VERSION,
    seed: s,
    rng: s,
    nodeId: START_NODE,
    stats: { ...START_STATS },
    items: [],
    companions: [...START_COMPANIONS],
    lost: [],
    flags: [],
    clock: Math.max(START_CLOCK, startNode?.clock ?? START_CLOCK),
    scenes: 0,
    infectedAt: null,
    route: [startNode?.location ?? 'home'],
    history: [],
    traits: emptyTraits(),
    ending: null,
    endingCause: null,
  };
}

// ─────────────────────────────── 조건 ───────────────────────────────

export function isInfected(s: RunState): boolean {
  return s.infectedAt !== null;
}

export function checkCondition(s: RunState, c: Condition | undefined): boolean {
  if (!c) return true;
  const has = <T>(arr: T[], x: T) => arr.includes(x);
  if (c.items && !c.items.every((i) => has(s.items, i))) return false;
  if (c.anyItems && !c.anyItems.some((i) => has(s.items, i))) return false;
  if (c.noItems && c.noItems.some((i) => has(s.items, i))) return false;
  if (c.companions && !c.companions.every((m) => has(s.companions, m))) return false;
  if (c.anyCompanions && !c.anyCompanions.some((m) => has(s.companions, m))) return false;
  if (c.noCompanions && c.noCompanions.some((m) => has(s.companions, m))) return false;
  if (c.flags && !c.flags.every((f) => has(s.flags, f))) return false;
  if (c.noFlags && c.noFlags.some((f) => has(s.flags, f))) return false;
  if (c.min) {
    for (const [k, v] of Object.entries(c.min) as [StatKey, number][]) if (s.stats[k] < v) return false;
  }
  if (c.max) {
    for (const [k, v] of Object.entries(c.max) as [StatKey, number][]) if (s.stats[k] > v) return false;
  }
  if (c.infected !== undefined && c.infected !== isInfected(s)) return false;
  return true;
}

export function resolveParas(s: RunState, paras: Para[]): string[] {
  const out: string[] = [];
  for (const p of paras) {
    if (typeof p === 'string') out.push(p);
    else if (checkCondition(s, p.when)) out.push(p.text);
  }
  return out;
}

export function choiceStatus(s: RunState, c: Choice): ChoiceStatus {
  if (checkCondition(s, c.requires)) return 'open';
  return c.lockedHint ? 'locked' : 'hidden';
}

export function visibleChoices(s: RunState, node: StoryNode): { choice: Choice; status: Exclude<ChoiceStatus, 'hidden'> }[] {
  const out: { choice: Choice; status: Exclude<ChoiceStatus, 'hidden'> }[] = [];
  for (const choice of node.choices) {
    const status = choiceStatus(s, choice);
    if (status !== 'hidden') out.push({ choice, status });
  }
  return out;
}

// ─────────────────────────────── 선택 처리 ───────────────────────────────

function pickOutcome(s: RunState, choice: Choice): { outcome: Outcome; rng: number; rolled: Resolution['rolled'] } {
  let rng = s.rng;
  let rolled: Resolution['rolled'] = 'none';
  for (let i = 0; i < choice.outcomes.length; i++) {
    const o = choice.outcomes[i];
    const last = i === choice.outcomes.length - 1;
    if (!last && !checkCondition(s, o.when)) continue;
    if (!last && o.chance !== undefined) {
      const [r, next] = step(rng);
      rng = next;
      if (r >= o.chance) {
        rolled = 'fail';
        continue;
      }
      return { outcome: o, rng, rolled: 'success' };
    }
    return { outcome: o, rng, rolled };
  }
  // 콘텐츠 무결성 테스트가 막지만, 방어적으로 마지막 결과를 쓴다
  return { outcome: choice.outcomes[choice.outcomes.length - 1], rng, rolled };
}

const clamp = (v: number) => Math.max(0, Math.min(100, Math.round(v)));
const uniq = <T>(arr: T[]) => Array.from(new Set(arr));

function applyEffect(s: RunState, e: Effect | undefined, delta: Delta): RunState {
  if (!e) return s;
  const before = s.stats;
  const stats = {
    hp: clamp(before.hp + (e.hp ?? 0)),
    supply: clamp(before.supply + (e.supply ?? 0)),
    mental: clamp(before.mental + (e.mental ?? 0)),
  };
  delta.hp += stats.hp - before.hp;
  delta.supply += stats.supply - before.supply;
  delta.mental += stats.mental - before.mental;

  let items = s.items;
  for (const i of e.addItems ?? []) {
    if (!items.includes(i)) {
      items = [...items, i];
      delta.itemsGained.push(i);
    }
  }
  for (const i of e.removeItems ?? []) {
    if (items.includes(i)) {
      items = items.filter((x) => x !== i);
      delta.itemsLost.push(i);
    }
  }

  let companions = s.companions;
  let lost = s.lost;
  for (const m of e.addCompanions ?? []) {
    if (!companions.includes(m)) {
      companions = [...companions, m];
      lost = lost.filter((x) => x !== m);
      delta.joined.push(m);
    }
  }
  for (const m of e.removeCompanions ?? []) {
    if (companions.includes(m)) {
      companions = companions.filter((x) => x !== m);
      lost = uniq([...lost, m]);
      delta.left.push(m);
    }
  }

  let flags = s.flags;
  if (e.setFlags?.length) flags = uniq([...flags, ...e.setFlags]);
  if (e.clearFlags?.length) flags = flags.filter((f) => !e.clearFlags!.includes(f));

  let infectedAt = s.infectedAt;
  if (e.cure && infectedAt !== null) {
    infectedAt = null;
    delta.cured = true;
  }
  if (e.infect && infectedAt === null) {
    infectedAt = s.scenes;
    delta.infected = true;
  }

  const hours = Math.max(0, e.hours ?? 0);
  delta.hours += hours;

  return { ...s, stats, items, companions, lost, flags, infectedAt, clock: s.clock + hours };
}

/** 장면 경과 — 보급 소모, 못 채우면 굶주림 */
function upkeep(s: RunState, delta: Delta): RunState {
  const need = SUPPLY_DRAIN_BASE + Math.floor(SUPPLY_DRAIN_PER_COMPANION * s.companions.length);
  const stats = { ...s.stats };
  if (stats.supply >= need) {
    stats.supply -= need;
    delta.upkeep.supply = -need;
  } else {
    delta.upkeep.supply = -stats.supply;
    stats.supply = 0;
    const hp = clamp(stats.hp - STARVING_HP);
    const mental = clamp(stats.mental - STARVING_MENTAL);
    delta.upkeep.hp = hp - stats.hp;
    delta.upkeep.mental = mental - stats.mental;
    stats.hp = hp;
    stats.mental = mental;
    delta.starving = true;
  }
  return { ...s, stats };
}

export class ChoiceError extends Error {}

/**
 * 선택을 처리해 다음 상태를 만든다. nodes 는 전체 스토리 노드 사전.
 * 엔딩에 도달하면 state.ending 이 채워지고 nodeId 는 마지막 노드에 머문다.
 */
export function applyChoice(s: RunState, nodes: Record<string, StoryNode>, choiceId: string): Resolution {
  if (s.ending) throw new ChoiceError('이미 끝난 게임');
  const node = nodes[s.nodeId];
  if (!node) throw new ChoiceError(`노드 없음: ${s.nodeId}`);
  const choice = node.choices.find((c) => c.id === choiceId);
  if (!choice) throw new ChoiceError(`선택지 없음: ${choiceId}`);
  if (choiceStatus(s, choice) !== 'open') throw new ChoiceError(`잠긴 선택지: ${choiceId}`);

  const { outcome, rng, rolled } = pickOutcome(s, choice);
  const result = resolveParas(s, outcome.result);

  const delta: Delta = {
    hp: 0,
    supply: 0,
    mental: 0,
    itemsGained: [],
    itemsLost: [],
    joined: [],
    left: [],
    infected: false,
    cured: false,
    hours: 0,
    upkeep: { supply: 0, hp: 0, mental: 0 },
    starving: false,
    clutch: false,
  };

  let next: RunState = { ...s, rng };
  next = applyEffect(next, outcome.effects, delta);
  if (outcome.effects?.hours === undefined) next = { ...next, clock: next.clock + DEFAULT_SCENE_HOURS };

  const traits = { ...next.traits };
  for (const t of choice.tags ?? []) traits[t] += 1;
  next = {
    ...next,
    traits,
    scenes: next.scenes + 1,
    history: [
      ...next.history,
      {
        nodeId: node.id,
        title: node.title,
        chapter: node.chapter,
        location: node.location,
        clock: s.clock,
        choiceId: choice.id,
        choiceLabel: choice.label,
      },
    ],
  };

  const storyEnding = outcome.next.startsWith('end:') ? (outcome.next.slice(4) as EndingId) : null;
  if (!storyEnding) next = upkeep(next, delta);

  // 강제 엔딩: 스토리 엔딩이 "생존"류면 체력/정신력 0 이 우선한다. 감염은 스토리 엔딩을 존중(변형이 처리).
  let forced: Resolution['forced'] = null;
  const storyKind = storyEnding ? ENDINGS_META[storyEnding].kind : null;
  const overridable = !storyEnding || storyKind === 'survived';
  // 최소 선택 수 전에는 강제 엔딩을 내지 않는다 — 0 이 된 스탯은 1 로 버티고, 변이는 미뤄진다
  const early = next.history.length < MIN_CHOICES_BEFORE_END;
  if (early && !storyEnding && (next.stats.hp <= 0 || next.stats.mental <= 0)) {
    // 되돌린 1 만큼 결과 칩의 손실도 보정한다 — 굶주림(장면 경과)이 마지막으로 깎았다면 그쪽에서
    for (const k of ['hp', 'mental'] as const) {
      if (next.stats[k] > 0) continue;
      if (delta.upkeep[k] < 0) delta.upkeep[k] += 1;
      else delta[k] += 1;
    }
    next = { ...next, stats: { ...next.stats, hp: Math.max(1, next.stats.hp), mental: Math.max(1, next.stats.mental) } };
    delta.clutch = true;
  }
  if (overridable && next.stats.hp <= 0) forced = 'hp';
  else if (overridable && next.stats.mental <= 0) forced = 'mental';
  else if (!storyEnding && !early && next.infectedAt !== null && next.scenes - next.infectedAt >= INFECTION_SCENES) forced = 'infection';

  if (forced) {
    next = { ...next, ending: FORCED_ENDINGS[forced], endingCause: forced };
  } else if (storyEnding) {
    next = { ...next, ending: storyEnding, endingCause: 'story' };
  } else {
    const target = nodes[outcome.next];
    if (!target) throw new ChoiceError(`다음 노드 없음: ${outcome.next}`);
    const clock = target.clock !== undefined ? Math.max(next.clock, target.clock) : next.clock;
    const route = next.route[next.route.length - 1] === target.location ? next.route : [...next.route, target.location];
    next = { ...next, nodeId: target.id, clock, route };
  }

  return { choice, outcome, rolled, result, delta, state: next, forced };
}

// ─────────────────────────────── 파생 정보 ───────────────────────────────

/** 감염 후 남은 장면 수 (감염 아니면 null) */
export function infectionLeft(s: RunState): number | null {
  if (s.infectedAt === null) return null;
  // 엔진의 강제 변이 판정과 같은 규칙 — 6장면 경과와 최소 선택 수를 둘 다 채워야 변이한다
  return Math.max(0, INFECTION_SCENES - (s.scenes - s.infectedAt), MIN_CHOICES_BEFORE_END - s.history.length);
}

export function formatClock(hours: number): string {
  const whole = Math.floor(hours);
  const min = Math.round((hours - whole) * 60);
  const day = Math.floor(whole / 24);
  const hh = String(whole % 24).padStart(2, '0');
  const mm = String(min === 60 ? 0 : min).padStart(2, '0');
  return `D+${day} ${hh}:${mm}`;
}

/** 생존 시간 (시작 시각부터) — "45분", "7시간", "2일 4시간" */
export function formatSurvived(s: RunState): string {
  const total = Math.max(0, s.clock - START_CLOCK);
  if (total < 1) return `${Math.round(total * 60)}분`;
  const h = Math.floor(total);
  const d = Math.floor(h / 24);
  const r = h % 24;
  if (d === 0) return `${r}시간`;
  return r ? `${d}일 ${r}시간` : `${d}일`;
}

export function survivorType(s: RunState): { tag: TraitTag; title: string; line: string } {
  const order: TraitTag[] = ['dog', 'kind', 'brave', 'careful', 'cold', 'meme'];
  let best: TraitTag = 'careful';
  let bestN = -1;
  for (const t of order) {
    if (s.traits[t] > bestN) {
      best = t;
      bestN = s.traits[t];
    }
  }
  return { tag: best, ...TRAITS[best] };
}

export interface ResolvedEnding {
  id: EndingId;
  kind: Ending['kind'];
  title: string;
  scene: Ending['scene'];
  body: string[];
  epitaph: string;
}

export function resolveEnding(s: RunState, endings: Record<EndingId, Ending>): ResolvedEnding | null {
  if (!s.ending) return null;
  const e = endings[s.ending];
  if (!e) return null;
  const v = e.variants?.find((x) => checkCondition(s, x.when));
  const body = resolveParas(s, v?.body ?? e.body);
  return {
    id: e.id,
    kind: e.kind,
    title: v?.title ?? e.title,
    scene: e.scene,
    body: body.length ? body : resolveParas(s, e.body),
    epitaph: v?.epitaph ?? e.epitaph,
  };
}

// ─────────────────────────────── 저장 ───────────────────────────────

/** localStorage 에서 읽은 값을 검증해 복원. 노드가 사라졌거나 형식이 다르면 null. */
export function restoreRun(raw: unknown, nodes: Record<string, StoryNode>): RunState | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Partial<RunState>;
  if (r.v !== SAVE_VERSION || typeof r.nodeId !== 'string' || !nodes[r.nodeId]) return null;
  if (!r.stats || typeof r.stats.hp !== 'number' || typeof r.stats.supply !== 'number' || typeof r.stats.mental !== 'number') return null;
  if (!Array.isArray(r.items) || !Array.isArray(r.companions) || !Array.isArray(r.flags) || !Array.isArray(r.history)) return null;
  if (typeof r.rng !== 'number' || typeof r.clock !== 'number' || typeof r.scenes !== 'number') return null;
  return {
    ...(r as RunState),
    lost: Array.isArray(r.lost) ? r.lost : [],
    route: Array.isArray(r.route) && r.route.length ? r.route : [nodes[r.nodeId].location],
    traits: { ...emptyTraits(), ...(r.traits ?? {}) },
    infectedAt: typeof r.infectedAt === 'number' ? r.infectedAt : null,
    ending: r.ending ?? null,
    endingCause: r.endingCause ?? null,
  };
}
