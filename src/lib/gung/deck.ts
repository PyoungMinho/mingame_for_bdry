/**
 * 카드 덱 — 인원·라운드·장소·자리로 "보이는 카드"를 계산한다. (디자인 스펙 §7-2, 원고 4장·5장)
 *
 *  - 장소 카드: 조건(forCount/onlyWhen) 통과분이 1장이면 그 장소를 고른 모두가 같은 카드.
 *    여러 장이면 index = mix(hash32(seed), hash32(`${round}:${placeId}:${seat}`)) % len (자리별 결정론).
 *  - 교체 카드(원고 HW-1 ↔ HW-1b): onlyWhen.players / onlyWhen.npcs 또는 forCount 로 표현. 교체 사실은 노출하지 않는다.
 *  - 공용 카드(PB): 라운드 시작 때 방장 폰에 공개. 조건부 가능.
 *  - NPC 증언 카드: 그 역할이 NPC 인 판에서만 그 라운드에 공용 공개.
 *  - 용어: baseTerms 는 처음부터, 카드 연동 용어는 그 카드를 열었을 때만.
 *  - 내문 출입 타임라인: 열린 공용 카드의 gateLog 만 눈금(술시~축시 × 초·정·말)에 올린다(gateTimeline).
 */
import { castFor, npcRolesFor, roleById } from './assign';
import { GUIDE } from './guide-data';
import { hash32, mix } from './rng';
import {
  DEFAULT_NPC_HEADING,
  type CardCondition,
  type CardId,
  type ClueCardDef,
  type GateEntry,
  type GlossaryTerm,
  type GungCase,
  type PlaceDef,
  type PlaceId,
  type PlayerCount,
  type RoleId,
  type RoundDef,
  type RoundNo,
  type TermId,
} from './types';

export type CardKind = 'place' | 'public' | 'npc';

export interface VisibleCard {
  kind: CardKind;
  id: CardId;
  round: RoundNo;
  title: string;
  body: string;
  /** 장소 카드만 */
  placeId?: PlaceId;
  /** NPC 카드만 */
  roleId?: RoleId;
  /** 이 카드에 붙은 용어(카드를 연 뒤에만 노출할 것) */
  terms: GlossaryTerm[];
}

export function roundDef(c: GungCase, round: RoundNo): RoundDef {
  const r = c.rounds.find((x) => x.no === round) ?? c.rounds[round - 1];
  if (!r) throw new Error(`case ${c.id}: round ${round} 없음`);
  return r;
}

export function placeById(c: GungCase, id: PlaceId): PlaceDef | undefined {
  return c.places.find((p) => p.id === id);
}

/** 이 라운드에 열리는 장소(placeIds 순서) */
export function roundPlaces(c: GungCase, round: RoundNo): PlaceDef[] {
  return roundDef(c, round)
    .placeIds.map((id) => placeById(c, id))
    .filter((p): p is PlaceDef => Boolean(p));
}

export function isPlaceInRound(c: GungCase, round: RoundNo, placeId: PlaceId): boolean {
  return roundDef(c, round).placeIds.includes(placeId);
}

/** 카드 노출 조건 평가 */
export function cardVisible(c: GungCase, n: PlayerCount, cond: CardCondition): boolean {
  if (cond.forCount && !cond.forCount.includes(n)) return false;
  const w = cond.onlyWhen;
  if (w) {
    const cast = castFor(c, n);
    const npcs = npcRolesFor(c, n);
    if (w.players && !w.players.every((id) => cast.includes(id))) return false;
    if (w.npcs && !w.npcs.every((id) => npcs.includes(id))) return false;
  }
  return true;
}

function termsOf(c: GungCase, ids: TermId[] | undefined): GlossaryTerm[] {
  if (!ids?.length) return [];
  const g = c.glossary ?? [];
  return ids.map((id) => g.find((t) => t.id === id)).filter((t): t is GlossaryTerm => Boolean(t));
}

/** 이 인원·라운드·장소에서 조건을 통과한 카드들 */
export function cardsAtPlace(c: GungCase, n: PlayerCount, round: RoundNo, placeId: PlaceId): ClueCardDef[] {
  const r = roundDef(c, round);
  if (!r.placeIds.includes(placeId)) return [];
  return (r.clues[placeId] ?? []).filter((card) => cardVisible(c, n, card));
}

/** 자리별 배분 인덱스(스펙 고정식) */
export function clueIndex(seed: string, round: RoundNo, placeId: PlaceId, seat: number, len: number): number {
  if (len <= 1) return 0;
  return mix(hash32(seed), hash32(`${round}:${placeId}:${seat}`)) % len;
}

/** 내가 이 장소에서 받는 장소 카드 — 다른 자리 카드는 계산하지 않는다 */
export function getClue(
  c: GungCase,
  room: { seed: string; n: PlayerCount },
  round: RoundNo,
  placeId: PlaceId,
  seat: number,
): VisibleCard | null {
  const cards = cardsAtPlace(c, room.n, round, placeId);
  if (!cards.length) return null;
  const card = cards[clueIndex(room.seed, round, placeId, seat, cards.length)];
  return { kind: 'place', id: card.id, round, placeId, title: card.title, body: card.body, terms: termsOf(c, card.terms) };
}

/** 라운드 공용 카드(PB) */
export function getPublicCards(c: GungCase, n: PlayerCount, round: RoundNo): VisibleCard[] {
  return (roundDef(c, round).publicCards ?? [])
    .filter((card) => cardVisible(c, n, card))
    .map((card) => ({ kind: 'public' as const, id: card.id, round, title: card.title, body: card.body, terms: termsOf(c, card.terms) }));
}

/** 라운드 NPC 증언 카드 — 그 역할이 NPC 인 판에서만 */
export function getNpcCards(c: GungCase, n: PlayerCount, round: RoundNo): VisibleCard[] {
  const npcs = npcRolesFor(c, n);
  return (roundDef(c, round).npcCards ?? [])
    .filter((card) => npcs.includes(card.roleId))
    .map((card) => ({
      kind: 'npc' as const,
      id: card.id,
      round,
      roleId: card.roleId,
      title: card.title,
      body: card.body,
      terms: termsOf(c, card.terms),
    }));
}

export interface RoundBoard {
  round: RoundNo;
  publicCards: VisibleCard[];
  npcCards: VisibleCard[];
  /** NPC 묶음 제목('추가 증언') — '빠진 역할' 같은 말은 쓰지 않는다 */
  npcHeading: string;
}

/** 라운드 시작 때 방장 폰에 열리는 공용 보드 */
export function getRoundBoard(c: GungCase, n: PlayerCount, round: RoundNo): RoundBoard {
  return {
    round,
    publicCards: getPublicCards(c, n, round),
    npcCards: getNpcCards(c, n, round),
    npcHeading: c.npcHeading ?? DEFAULT_NPC_HEADING,
  };
}

/**
 * 단서함(T2) — 1..upTo 라운드의 공용·NPC 카드. upTo = 이 폰이 들어선 조사 라운드(지금 라운드 포함).
 * 공용 카드는 라운드 시작 때 공개한다(원고 1-7 규칙 4·4-1·1-8 — QA BUG-04 결정): 방장 화면도 그 라운드 장소 고르기부터 보인다.
 */
export function publicBoardUpTo(c: GungCase, n: PlayerCount, upTo: number): VisibleCard[] {
  const out: VisibleCard[] = [];
  for (const r of [1, 2, 3] as RoundNo[]) {
    if (r > upTo) break;
    out.push(...getPublicCards(c, n, r), ...getNpcCards(c, n, r));
  }
  return out;
}

// ─────────────────────────────── 내문 출입 타임라인 ───────────────────────────────

/** 눈금 위의 출입 표시 하나 */
export interface GateMark extends GateEntry {
  round: RoundNo;
  cardId: CardId;
  /** 눈금 번호 0..ticks-1 (술시 초 = 0, 술시 정 = 1, … 축시 말 = 11) */
  tick: number;
  /** 눈금 안 자리 0..1 — 같은 눈금의 기록을 적힌 순서대로 나눠 앉힌다(단독이면 0.5) */
  pos: number;
}

/** 레인 = 출입한 사람(역할). 기록에 처음 나온 순서 — 범인·우선순위 순으로 줄 세우지 않는다 */
export interface GateLane {
  roleId: RoleId;
  label: string;
}

/** 같은 사람의 入 → 出 이 둘 다 기록에 있을 때만 잇는다(기록 밖 체류는 추론하지 않는다) */
export interface GateSpan {
  roleId: RoleId;
  /** 눈금 단위 x (tick + pos) */
  from: number;
  to: number;
}

export interface GateTimeline {
  title: string;
  watches: string[];
  parts: string[];
  ticks: number;
  lanes: GateLane[];
  marks: GateMark[];
  spans: GateSpan[];
}

/**
 * 공개된 라운드(rounds)의 공용 카드 gateLog → 타임라인. 그릴 게 없으면 null.
 * rounds 는 "방장이 그 공용 카드를 열었거나 그 라운드가 지난" 라운드만 넘길 것(game.ts gateRoundsShown).
 */
export function gateTimeline(c: GungCase, n: PlayerCount, rounds: readonly RoundNo[]): GateTimeline | null {
  const axis = c.gateAxis;
  if (!axis || !axis.watches.length || !axis.parts.length) return null;
  const ticks = axis.watches.length * axis.parts.length;
  const tickOf = (time: string): number => {
    const [w, p] = time.split(' ');
    const wi = axis.watches.indexOf(w);
    const pi = axis.parts.indexOf(p);
    return wi < 0 || pi < 0 ? -1 : wi * axis.parts.length + pi;
  };

  type Raw = GateEntry & { round: RoundNo; cardId: CardId; tick: number };
  const raw: Raw[] = [];
  for (const round of [...new Set(rounds)].sort((x, y) => x - y)) {
    for (const card of roundDef(c, round).publicCards ?? []) {
      if (!cardVisible(c, n, card)) continue;
      for (const e of card.gateLog ?? []) {
        const tick = tickOf(e.time);
        if (tick >= 0) raw.push({ ...e, round, cardId: card.id, tick });
      }
    }
  }
  if (!raw.length) return null;

  // 같은 눈금 안 자리 — (라운드, 카드, seq) 묶음 단위로 적힌 순서대로
  const slotKey = (e: Raw) => `${e.round}:${e.cardId}:${e.seq}`;
  const slotsByTick = new Map<number, string[]>();
  for (const e of raw) {
    const list = slotsByTick.get(e.tick) ?? [];
    if (!list.includes(slotKey(e))) list.push(slotKey(e));
    slotsByTick.set(e.tick, list);
  }
  const marks: GateMark[] = raw.map((e) => {
    const list = slotsByTick.get(e.tick)!;
    return { ...e, pos: (list.indexOf(slotKey(e)) + 1) / (list.length + 1) };
  });

  const lanes: GateLane[] = [];
  for (const m of marks) {
    if (lanes.some((l) => l.roleId === m.roleId)) continue;
    const r = roleById(c, m.roleId);
    const o = r?.byCount?.[n];
    lanes.push({ roleId: m.roleId, label: o?.shortName ?? r?.shortName ?? o?.name ?? r?.name ?? m.who });
  }

  const spans: GateSpan[] = [];
  for (const lane of lanes) {
    const mine = marks.filter((m) => m.roleId === lane.roleId).sort((x, y) => x.tick + x.pos - (y.tick + y.pos));
    let open: number | null = null;
    for (const m of mine) {
      const x = m.tick + m.pos;
      if (m.dir === 'in') open = x;
      else if (open !== null) {
        spans.push({ roleId: lane.roleId, from: open, to: x });
        open = null;
      }
    }
  }

  return { title: axis.title, watches: axis.watches.slice(), parts: axis.parts.slice(), ticks, lanes, marks, spans };
}

// ─────────────────────────────── 용어 ───────────────────────────────

/** 처음부터 보이는 기본 용어 */
export function baseTerms(c: GungCase): GlossaryTerm[] {
  return termsOf(c, c.baseTerms);
}

/** 기본 용어 + 열어 본 카드들의 연동 용어(중복 제거, 등장 순) */
export function visibleTerms(c: GungCase, openedCards: readonly Pick<VisibleCard, 'terms'>[]): GlossaryTerm[] {
  const seen = new Set<string>();
  const out: GlossaryTerm[] = [];
  for (const t of [...baseTerms(c), ...openedCards.flatMap((card) => card.terms)]) {
    if (seen.has(t.id)) continue;
    seen.add(t.id);
    out.push(t);
  }
  return out;
}

/**
 * 용어 풀이 「?」 시트(원고 1-6)에 올릴 용어 — 기본 용어 + 이 폰이 들어선 라운드까지의 공용·NPC 카드 연동 용어.
 * 인원·라운드만 받는다(역할·자리 무관) → 같은 판 같은 단계면 모든 폰에서 같은 목록. 장소 카드 연동 용어는 그 카드를
 * 열었을 때 카드 안(봉인 속)에서만, 역할 전용 용어(활맥)는 내 패 봉인 속에서만 보인다 — 목록 길이가 역할·고른 장소를 흘리지 않게.
 */
export function sharedTerms(c: GungCase, n: PlayerCount, upToRound: number): GlossaryTerm[] {
  return visibleTerms(c, publicBoardUpTo(c, n, upToRound));
}

// ─────────────────────────────── 시각표 ───────────────────────────────

/** 십이시 — 일반 상식(사건 본문 아님). start = 시작 시각(24시). 저녁부터 새벽 순 */
const TWELVE_WATCHES: readonly { name: string; hanja: string; start: number }[] = [
  { name: '오시', hanja: '午時', start: 11 },
  { name: '미시', hanja: '未時', start: 13 },
  { name: '신시', hanja: '申時', start: 15 },
  { name: '유시', hanja: '酉時', start: 17 },
  { name: '술시', hanja: '戌時', start: 19 },
  { name: '해시', hanja: '亥時', start: 21 },
  { name: '자시', hanja: '子時', start: 23 },
  { name: '축시', hanja: '丑時', start: 1 },
  { name: '인시', hanja: '寅時', start: 3 },
  { name: '묘시', hanja: '卯時', start: 5 },
  { name: '진시', hanja: '辰時', start: 7 },
  { name: '사시', hanja: '巳時', start: 9 },
];

export interface WatchRow {
  /** '술시' */
  name: string;
  /** '戌時' */
  hanja: string;
  /** '19~21시' */
  span: string;
  /** '초≈19시 · 정≈20시 · 말≈20시 반 넘어' — 출입 눈금(gateAxis)에 쓰는 시진만 */
  parts?: string;
}

const h24 = (h: number) => ((h % 24) + 24) % 24;
const pad2 = (h: number) => String(h24(h)).padStart(2, '0');

/**
 * 시각표(원고 1-5 「방장 폰 상단 고정 표시 권장」) — 사건 데이터에 나오는 시진만 골라 지금 시각으로 옮긴다.
 * 시진 이름은 출입 눈금·그날 밤 동선·진상 비트·출입 기록의 `time` 칸에서 모은다(본문 자유 텍스트는 뒤지지 않는다).
 */
export function timeTable(c: GungCase): WatchRow[] {
  const times: string[] = [...(c.gateAxis?.watches ?? [])];
  for (const r of c.roles) {
    for (const o of [r, ...Object.values(r.byCount ?? {}), r.asCulprit]) for (const l of o?.night ?? []) if (l.time) times.push(l.time);
  }
  for (const b of [...c.truth.beats, ...(c.truth.timeline ?? [])]) if (b.time) times.push(b.time);
  for (const rd of c.rounds) for (const pc of rd.publicCards ?? []) for (const e of pc.gateLog ?? []) times.push(e.time);
  const used = new Set(TWELVE_WATCHES.filter((w) => times.some((t) => t.trim().startsWith(w.name))).map((w) => w.name));
  const axis = new Set(c.gateAxis?.watches ?? []);
  return TWELVE_WATCHES.filter((w) => used.has(w.name)).map((w) => ({
    name: w.name,
    hanja: w.hanja,
    span: `${pad2(w.start)}~${pad2(w.start + 2)}시`,
    parts: axis.has(w.name)
      ? `초≈${h24(w.start)}시 · 정≈${h24(w.start + 1) === 0 ? '자정' : `${h24(w.start + 1)}시`} · 말≈${h24(w.start + 1)}시 반 넘어`
      : undefined,
  }));
}

/** 시각표 아래 한 줄(원고 1-5) */
export const TIME_TABLE_NOTE = '반 시진 ≈ 1시간';

/**
 * 시각 어림 한 줄(개선 묶음 1 · R3) — timeTable(c)에서 만든다(하드코딩 금지). 출입 눈금(gateAxis)에 쓰는 시진의 '초' 시각만 골라
 * 「시각 어림 — 술시 초 19시 · … · 정은 초에서 1시간 뒤 · 말은 1시간 반 넘어 · 반 시진 ≈ 1시간」. 공용 단서 목록 아래(방장·플레이어 공통).
 */
export function timeHint(c: GungCase): string {
  const starts = timeTable(c)
    .filter((r) => r.parts)
    .map((r) => {
      const m = /초≈([^\s·]+)/.exec(r.parts ?? '');
      return m ? `${r.name} 초 ${m[1]}` : null;
    })
    .filter((x): x is string => x !== null);
  return `${GUIDE.timeHintHead} — ${[...starts, ...GUIDE.timeHintTail, TIME_TABLE_NOTE].join(' · ')}`;
}

// ─────────────────────────────── 브리핑 ───────────────────────────────

function roleName(c: GungCase, id: RoleId, n: PlayerCount): string {
  const r = roleById(c, id);
  if (!r) return id;
  return r.byCount?.[n]?.name ?? r.name;
}

/** '중전 서씨. 숙의 연씨. 그리고 어의 백인수.' */
export function joinCastNames(names: string[]): string {
  if (!names.length) return '';
  if (names.length === 1) return `${names[0]}.`;
  return `${names.slice(0, -1).join('. ')}. 그리고 ${names[names.length - 1]}.`;
}

export interface ResolvedBriefing {
  heading: string;
  paragraphs: string[];
  hostCue?: string;
  /** 낭독 예상 분(300자/분, 최소 1) */
  readMinutes: number;
}

/** {{cast}}·{{npcs}} 치환. {{npcs}} 문단은 NPC 없는 판에서 통째로 빠진다(조건 문구 노출 금지). */
export function resolveBriefing(c: GungCase, n: PlayerCount): ResolvedBriefing {
  const cast = joinCastNames(castFor(c, n).map((id) => roleName(c, id, n)));
  const npcIds = npcRolesFor(c, n);
  const npcs = npcIds.map((id) => roleName(c, id, n)).join(', ');
  const paragraphs = c.briefing.paragraphs
    .filter((p) => !(p.includes('{{npcs}}') && npcIds.length === 0))
    .map((p) => p.split('{{cast}}').join(cast).split('{{npcs}}').join(npcs));
  return {
    heading: c.briefing.heading,
    paragraphs,
    hostCue: c.briefing.hostCue,
    readMinutes: estimateReadMinutes(paragraphs),
  };
}

export function estimateReadMinutes(paragraphs: readonly string[]): number {
  const chars = paragraphs.reduce((s, p) => s + p.replace(/\s/g, '').length, 0);
  return Math.max(1, Math.ceil(chars / 300));
}
