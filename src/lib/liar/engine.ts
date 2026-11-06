import { EVENTS } from './content';
import type {
  Applied,
  Choice,
  ChoiceEvent,
  Effects,
  EndingId,
  GameEvent,
  GameState,
  HearingEvent,
  HearingQuestion,
  Line,
  LieRecord,
  LieSpec,
  Rank,
  RecallEvent,
  RecallResult,
  ReviewEvent,
} from './types';

export const SUS_MAX = 100;
export const LEDGER_COST = 5;
const PROMOTION_RELIEF = 3;
const HEARING_MAX = 5;

export const RANK_LABEL: Record<Rank, string> = {
  intern: '인턴',
  staff: '사원',
  senior: '대리',
  manager: '과장',
  lead: '팀장',
  exec: '전무',
  ceo: '대표',
};

const clamp = (n: number) => Math.max(0, Math.min(100, n));

function settle(s: GameState): GameState {
  if (s.ending) return s;
  let i = s.eventIndex;
  while (i < EVENTS.length) {
    const ev = EVENTS[i];
    if (!ev.when || ev.when(s)) break;
    i += 1;
  }
  return { ...s, eventIndex: i, year: EVENTS[i]?.year ?? s.year };
}

export function newGame(): GameState {
  return settle({
    v: 2,
    eventIndex: 0,
    rank: 'intern',
    year: 1,
    perf: 10,
    sus: 0,
    flags: [],
    lies: [],
    grandma: 0,
    nearMisses: 0,
    ledgerOpens: 0,
    ledgerPaidAt: null,
    hearingStep: 0,
    confessed: 0,
    ending: null,
  });
}

export function currentEvent(s: GameState): GameEvent | null {
  return s.ending ? null : EVENTS[s.eventIndex] ?? null;
}

/** 다음 승진 심사의 실적 기준. 상태창 눈금에 쓴다. */
export function nextThreshold(s: GameState): number | null {
  for (let i = s.eventIndex; i < EVENTS.length; i += 1) {
    const ev = EVENTS[i];
    if (ev.type === 'review') return ev.threshold;
  }
  return null;
}

/** 임원이 된 뒤에 들통나거나 회계를 건드렸으면 퇴사로 끝나지 않는다. */
function exposureEnding(s: GameState): EndingId {
  return s.rank === 'exec' || s.rank === 'ceo' || s.flags.includes('fraud') ? 'arrested' : 'caught';
}

function applyFx(s: GameState, fx: Effects): { state: GameState; delta: { perf: number; sus: number } } {
  const perf = clamp(s.perf + (fx.perf ?? 0));
  const sus = clamp(s.sus + (fx.sus ?? 0));
  const state = { ...s, perf, sus };
  return {
    state: sus >= SUS_MAX ? { ...state, ending: exposureEnding(state) } : state,
    delta: { perf: perf - s.perf, sus: sus - s.sus },
  };
}

const advance = (s: GameState): GameState => settle({ ...s, eventIndex: s.eventIndex + 1 });

export function applyChoice(s: GameState, choiceId: string): Applied {
  const ev = currentEvent(s);
  if (!ev || ev.type !== 'choice') throw new Error('선택 사건이 아닙니다');
  const choice: Choice | undefined = (ev as ChoiceEvent).choices.find((c) => c.id === choiceId);
  if (!choice) throw new Error(`없는 선택지: ${choiceId}`);

  const { state, delta } = applyFx(s, choice.fx);
  const lie: LieRecord | undefined = choice.lie ? { ...choice.lie, rank: s.rank, year: s.year } : undefined;
  const next: GameState = {
    ...state,
    flags: choice.flags ? [...state.flags, ...choice.flags] : state.flags,
    lies: lie ? [...state.lies, lie] : state.lies,
    grandma: state.grandma + (choice.grandma ? 1 : 0),
    ending: state.ending ?? choice.ending ?? null,
  };
  return { state: advance(next), reply: choice.reply, delta, lie };
}

/** answer가 null이면 얼버무리기. 값은 플레이어가 그때 장부에 남긴 내용과 비교한다. */
export function applyRecall(s: GameState, answer: string | null): Applied {
  const ev = currentEvent(s);
  if (!ev || ev.type !== 'recall') throw new Error('추궁 사건이 아닙니다');
  const recall = ev as RecallEvent;
  const truth = s.lies.find((l) => l.id === recall.lieId)?.value;
  const result: RecallResult = answer === null ? 'dodge' : answer === truth ? 'correct' : 'wrong';
  const outcome = recall[result];
  const { state, delta } = applyFx(s, outcome.fx);
  const next = result === 'correct' ? state : { ...state, nearMisses: state.nearMisses + 1 };
  return { state: advance(next), reply: outcome.reply, delta, recall: result };
}

export function applyReview(s: GameState): Applied {
  const ev = currentEvent(s);
  if (!ev || ev.type !== 'review') throw new Error('심사 사건이 아닙니다');
  const review = ev as ReviewEvent;
  if (s.perf < review.threshold) {
    return { state: { ...s, ending: review.failEnding }, reply: review.fail, delta: { perf: 0, sus: 0 } };
  }
  const { state, delta } = applyFx(s, { sus: -PROMOTION_RELIEF });
  const promoted: GameState = { ...state, rank: review.next };
  if (review.next !== 'ceo') return { state: advance(promoted), reply: review.pass, delta, promoted: true };
  const ending: EndingId = s.lies.length === 0 ? 'ceo_clean' : s.confessed >= 3 ? 'ceo_confess' : 'ceo_liar';
  return { state: { ...promoted, ending }, reply: review.pass, delta, promoted: true };
}

const ALL_LIES: LieSpec[] = EVENTS.flatMap((e) =>
  e.type === 'choice' ? e.choices.flatMap((c) => (c.lie ? [c.lie] : [])) : [],
);

/** 같은 입력이면 항상 같은 순서가 나오도록 하는 간단한 해시 */
function hash(text: string): number {
  let h = 7;
  for (let i = 0; i < text.length; i += 1) h = (h * 31 + text.charCodeAt(i)) >>> 0;
  return h;
}

function sortBySeed<T>(items: T[], key: (t: T) => string, seed: string): T[] {
  return [...items].sort((a, b) => hash(seed + key(a)) - hash(seed + key(b)));
}

/** 내가 안 한 말 중에서 그럴듯한 보기를 고른다. 같은 거짓말의 다른 값이 가장 헷갈린다. */
function decoys(s: GameState, lie: LieRecord): string[] {
  const told = new Set(s.lies.map((l) => l.claim));
  const pool = ALL_LIES.filter((l) => !told.has(l.claim));
  const tiers = [
    pool.filter((l) => l.id === lie.id),
    pool.filter((l) => l.id !== lie.id && l.label === lie.label),
    pool.filter((l) => l.id !== lie.id && l.label !== lie.label),
  ];
  const picked: string[] = [];
  for (const tier of tiers) {
    for (const l of sortBySeed(tier, (x) => x.claim, lie.id)) {
      if (picked.length < 2 && !picked.includes(l.claim)) picked.push(l.claim);
    }
  }
  return picked;
}

export function hearingQuestions(s: GameState): HearingQuestion[] {
  const count = Math.min(HEARING_MAX, s.lies.length);
  const out: HearingQuestion[] = [];
  for (let i = 0; i < count; i += 1) {
    const lie = s.lies[Math.floor((i * s.lies.length) / count)];
    out.push({
      lie,
      options: sortBySeed([lie.claim, ...decoys(s, lie)], (t) => t, lie.id),
    });
  }
  return out;
}

/** answer가 null이면 인정. 질문이 남아 있으면 같은 사건에 머문다. */
export function applyHearing(s: GameState, answer: string | null): Applied {
  const ev = currentEvent(s);
  if (!ev || ev.type !== 'hearing') throw new Error('이사회 사건이 아닙니다');
  const hearing = ev as HearingEvent;
  const questions = hearingQuestions(s);
  if (questions.length === 0) return { state: advance(s), reply: hearing.empty, delta: { perf: 0, sus: 0 } };

  const q = questions[s.hearingStep];
  const pick = (lines: Line[]) => [lines[s.hearingStep % lines.length]];
  let result: { fx: Effects; reply: Line[]; recall: RecallResult };
  if (answer === null) result = { fx: { perf: -3, sus: -6 }, reply: pick(hearing.confess), recall: 'dodge' };
  else if (answer === q.lie.claim) result = { fx: {}, reply: pick(hearing.correct), recall: 'correct' };
  else result = { fx: { sus: 18 }, reply: pick(hearing.wrong), recall: 'wrong' };

  const { state, delta } = applyFx(s, result.fx);
  const next: GameState = {
    ...state,
    hearingStep: s.hearingStep + 1,
    confessed: s.confessed + (answer === null ? 1 : 0),
    nearMisses: s.nearMisses + (result.recall === 'wrong' ? 1 : 0),
  };
  return {
    state: next.hearingStep >= questions.length ? advance(next) : next,
    reply: result.reply,
    delta,
    recall: result.recall,
  };
}

export function ledgerLocked(s: GameState): boolean {
  return currentEvent(s)?.type === 'hearing';
}

/** 장부는 언제든 볼 수 있지만, 사건마다 처음 열 때 의심도가 오른다. 이사회에서는 압수된다. */
export function openLedger(s: GameState): { state: GameState; charged: number } {
  if (ledgerLocked(s) || s.lies.length === 0 || s.ledgerPaidAt === s.eventIndex) return { state: s, charged: 0 };
  const { state, delta } = applyFx(s, { sus: LEDGER_COST });
  return {
    state: { ...state, ledgerOpens: state.ledgerOpens + 1, ledgerPaidAt: s.eventIndex },
    charged: delta.sus,
  };
}

export function isGameState(v: unknown): v is GameState {
  if (!v || typeof v !== 'object') return false;
  const s = v as Partial<GameState>;
  return (
    s.v === 2 &&
    typeof s.eventIndex === 'number' &&
    s.eventIndex >= 0 &&
    s.eventIndex < EVENTS.length &&
    typeof s.perf === 'number' &&
    typeof s.sus === 'number' &&
    Array.isArray(s.flags) &&
    Array.isArray(s.lies)
  );
}

export function resultTitle(s: GameState): string {
  const n = s.lies.length;
  if (s.flags.includes('fraud')) return '숫자도 속인 사람';
  if (s.grandma >= 3) return '할머니 세 분을 보내드린 사람';
  if (n === 0) return '거짓말 없이 버틴 사람';
  if (n >= 15) return '본인도 본인을 모르는 사람';
  if (n >= 8) return '장부 없이는 못 사는 사람';
  return '가끔 입이 먼저 움직이는 사람';
}

export function shareText(s: GameState, url: string): string {
  const facts = s.lies.slice(0, 3).map((l) => `· ${l.claim}`);
  return [
    `거짓말 ${s.lies.length}개로 ${RANK_LABEL[s.rank]}까지 왔다. 들통날 뻔한 횟수 ${s.nearMisses}번.`,
    `칭호: ${resultTitle(s)}`,
    ...(facts.length ? ['회사가 아는 나', ...facts] : []),
    url,
  ].join('\n');
}

export type { Line };
