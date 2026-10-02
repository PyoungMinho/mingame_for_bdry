/**
 * 자리 → 역할 결정론 배정 + 내 패(역할 시트) 해석. (디자인 스펙 §7-2)
 *
 *  - 인원 N 이면 priority 1..N 역할만 플레이어(cast). 나머지는 NPC.
 *  - seats = shuffle(cast, makeRng(mix(hash32(caseId), hash32(seed)))) — 자리 1~N 에 1:1. 방장(자리 1)도 무작위.
 *  - 범인: case.culprit 단일이면 그 역할, 배열이면 같은 시드 트리에서 1명. 범인은 항상 cast 안(validateCase 가 보장).
 *  - 같은 (caseId, code) → 어느 기기에서나 같은 배정. Math.random·Date 사용 없음.
 *
 * 화면 규약: 개인 화면에는 getSheet(내 자리) 결과만 내린다. getAllSheets 는 진상·모두의 패 전용.
 * 라운드 잠금: getSheet(…, upToRound) — 그 폰의 로컬 진행 단계(reachedRound(phase))를 넘긴다. 생략하면 0(조사 전)
 *   으로 보고 잠긴 블록 본문을 내리지 않는다(빠뜨린 호출부가 R3 기억을 새게 하지 않도록 기본값이 "잠김").
 */
import { hash32, makeRng, mix, shuffle } from './rng';
import { parseRoomCode, type RoomCode } from './room';
import {
  DEFAULT_CULPRIT_IDENTITY,
  DEFAULT_INNOCENT_IDENTITY,
  type GlossaryTerm,
  type GungCase,
  type MissionDef,
  type PlayerCount,
  type RoleIconKey,
  type RoleId,
  type RoleOverride,
  type RoleSheet,
  type RoundNo,
  type TimedLine,
} from './types';

export interface Assignment {
  caseId: string;
  code: string;
  seed: string;
  n: PlayerCount;
  /** seats[i] = 자리 (i+1) 의 역할 id. 길이 n */
  seats: RoleId[];
  /** priority 순 플레이어 역할 */
  cast: RoleId[];
  /** priority 순 NPC 역할(6인이면 빈 배열) */
  npcs: RoleId[];
  culpritRole: RoleId;
  culpritSeat: number;
}

/** priority 오름차순 역할 목록 */
export function sortedRoles(c: GungCase): RoleSheet[] {
  return c.roles.slice().sort((a, b) => a.priority - b.priority);
}

export function roleById(c: GungCase, id: RoleId): RoleSheet | undefined {
  return c.roles.find((r) => r.id === id);
}

/** 인원 n 의 플레이어 역할(priority 1..n) */
export function castFor(c: GungCase, n: PlayerCount): RoleId[] {
  return sortedRoles(c)
    .filter((r) => r.priority <= n)
    .map((r) => r.id);
}

/** 인원 n 의 NPC 역할(priority > n) */
export function npcRolesFor(c: GungCase, n: PlayerCount): RoleId[] {
  return sortedRoles(c)
    .filter((r) => r.priority > n)
    .map((r) => r.id);
}

export function isPlayerRole(c: GungCase, n: PlayerCount, id: RoleId): boolean {
  const r = roleById(c, id);
  return Boolean(r && r.priority <= n);
}

export function culpritCandidates(c: GungCase): RoleId[] {
  return Array.isArray(c.culprit) ? c.culprit.slice() : [c.culprit];
}

/** 배정 시드 — 스펙 고정식. 바꾸면 기존 방 코드의 배정이 전부 바뀐다(caseVersion +1 필요). */
export function assignmentSeed(caseId: string, seed: string): number {
  return mix(hash32(caseId), hash32(seed));
}

export function assignSeats(c: GungCase, room: RoomCode): Assignment {
  const cast = castFor(c, room.n);
  if (cast.length !== room.n) throw new Error(`case ${c.id}: ${room.n}인 cast 가 ${cast.length}명`);
  const base = assignmentSeed(c.id, room.seed);
  const seats = shuffle(cast, makeRng(base));

  const candidates = culpritCandidates(c).filter((id) => cast.includes(id));
  if (!candidates.length) throw new Error(`case ${c.id}: ${room.n}인 판에 범인 후보가 플레이어로 없음`);
  const culpritRole =
    candidates.length === 1 ? candidates[0] : candidates[Math.floor(makeRng(mix(base, hash32('gung:culprit')))() * candidates.length)];

  return {
    caseId: c.id,
    code: room.code,
    seed: room.seed,
    n: room.n,
    seats,
    cast,
    npcs: npcRolesFor(c, room.n),
    culpritRole,
    culpritSeat: seats.indexOf(culpritRole) + 1,
  };
}

/** 코드 문자열에서 바로 — 형식이 틀리면 null */
export function assignFromCode(c: GungCase, code: string): Assignment | null {
  const room = parseRoomCode(code);
  return room ? assignSeats(c, room) : null;
}

export function roleAtSeat(a: Assignment, seat: number): RoleId | null {
  return Number.isInteger(seat) && seat >= 1 && seat <= a.n ? a.seats[seat - 1] : null;
}

export function seatOfRole(a: Assignment, role: RoleId): number | null {
  const i = a.seats.indexOf(role);
  return i >= 0 ? i + 1 : null;
}

// ─────────────────────────────── 역할 시트 해석 ───────────────────────────────

/** 내 패 섹션 칩 — 모든 역할에 같은 7개, 같은 순서(D3) */
export const SHEET_SECTIONS = [
  { key: 'identity', label: '정체' },
  { key: 'profile', label: '신분' },
  { key: 'secret', label: '비밀' },
  { key: 'night', label: '그날 밤' },
  { key: 'lie', label: '거짓말' },
  { key: 'mission', label: '미션' },
  { key: 'speech', label: '말투' },
] as const;
export type SheetSectionKey = (typeof SHEET_SECTIONS)[number]['key'];

/**
 * 내 패의 라운드 잠금 블록. 잠긴 동안엔 lines 가 **아예 없다**(제목·라운드만) — 화면·props·DOM 어디에도 본문이 없게.
 */
export type SheetMemory =
  | { fromRound: RoundNo; heading: string; unlocked: true; lines: string[] }
  | { fromRound: RoundNo; heading: string; unlocked: false };

/** 0 = 조사 전, 1..3 = 그 조사 라운드에 들어섬(이후 단계는 3) */
export type SheetRound = 0 | RoundNo;

export interface ResolvedSheet {
  seat: number;
  n: PlayerCount;
  roleId: RoleId;
  name: string;
  shortName: string;
  subtitle?: string;
  icon: RoleIconKey;
  isCulprit: boolean;
  /** '정체' 섹션 — 범인/무고 텍스트만 다르고 구조는 같다 */
  identity: { headline: string; body?: string };
  profile: string;
  glance: string[];
  secrets: string[];
  /** 이 패를 계산한 라운드(로컬 진행 단계) — 「R2부터」 배지가 지금 유효한지 표시용 */
  round: SheetRound;
  /** 라운드 잠금 블록(「R3에 떠오르는 기억」) — upToRound < fromRound 이면 unlocked:false·본문 없음 */
  memories: SheetMemory[];
  motive?: string;
  night: TimedLine[];
  canLie: string[];
  mustTell: string[];
  lieTips: string[];
  missions: MissionDef[];
  speech: string[];
  secretLine?: string;
  /** 이 역할 카드 전용 용어 */
  terms: GlossaryTerm[];
}

function applyOverride(base: RoleSheet, o: RoleOverride | undefined): RoleSheet {
  return o ? { ...base, ...o } : base;
}

/** 공개 정보만(자리·역할명·아이콘) — 자기소개 이후 공용 화면 표기용 */
export interface PublicSeat {
  seat: number;
  roleId: RoleId;
  name: string;
  shortName: string;
  icon: RoleIconKey;
}

export function publicSeat(c: GungCase, a: Assignment, seat: number): PublicSeat | null {
  const id = roleAtSeat(a, seat);
  const r = id ? roleById(c, id) : undefined;
  if (!id || !r) return null;
  const merged = applyOverride(r, r.byCount?.[a.n]);
  return { seat, roleId: id, name: merged.name, shortName: merged.shortName ?? merged.name, icon: r.icon };
}

export function publicSeats(c: GungCase, a: Assignment): PublicSeat[] {
  return a.seats.map((_, i) => publicSeat(c, a, i + 1)).filter((s): s is PublicSeat => s !== null);
}

function normRound(r: number): SheetRound {
  return r >= 3 ? 3 : r >= 2 ? 2 : r >= 1 ? 1 : 0;
}

/**
 * 내 자리의 패 — 다른 자리 데이터는 포함하지 않는다.
 * upToRound: 이 폰이 들어선 조사 라운드(reachedRound(state.phase)). fromRound 가 그보다 큰 블록은 잠근다.
 */
export function getSheet(c: GungCase, a: Assignment, seat: number, upToRound: number = 0): ResolvedSheet | null {
  const id = roleAtSeat(a, seat);
  const base = id ? roleById(c, id) : undefined;
  if (!id || !base) return null;
  const isCulprit = id === a.culpritRole;
  let r = applyOverride(base, base.byCount?.[a.n]);
  if (isCulprit) r = applyOverride(r, base.asCulprit);

  const round = normRound(upToRound);
  const glossary = c.glossary ?? [];
  const terms = (r.terms ?? [])
    .map((t) => glossary.find((g) => g.id === t))
    .filter((g): g is GlossaryTerm => Boolean(g));

  return {
    seat,
    n: a.n,
    roleId: id,
    name: r.name,
    shortName: r.shortName ?? r.name,
    subtitle: r.subtitle,
    icon: base.icon,
    isCulprit,
    identity: isCulprit
      ? { headline: c.culpritIdentity ?? DEFAULT_CULPRIT_IDENTITY, body: r.crime }
      : { headline: c.innocentIdentity ?? DEFAULT_INNOCENT_IDENTITY },
    profile: r.profile,
    glance: r.glance.slice(),
    secrets: r.secrets.slice(),
    round,
    memories: (r.memories ?? []).map(
      (m): SheetMemory =>
        m.fromRound <= round
          ? { fromRound: m.fromRound, heading: m.heading, unlocked: true, lines: m.lines.slice() }
          : { fromRound: m.fromRound, heading: m.heading, unlocked: false },
    ),
    motive: r.motive,
    night: r.night.map((l) => ({ ...l })),
    canLie: r.canLie.slice(),
    mustTell: r.mustTell.slice(),
    lieTips: (r.lieTips ?? []).slice(),
    missions: r.missions.map((m) => ({ ...m })),
    speech: r.speech.slice(),
    secretLine: r.secretLine,
    terms,
  };
}

/** 모두의 패(P10)·진상(H9/P9) 전용 — 게임이 끝난 뒤라 잠금 블록까지 전부(upToRound 기본 3) */
export function getAllSheets(c: GungCase, a: Assignment, upToRound: number = 3): ResolvedSheet[] {
  return a.seats.map((_, i) => getSheet(c, a, i + 1, upToRound)).filter((s): s is ResolvedSheet => s !== null);
}

/**
 * from → to 로 진행 단계가 넘어가며 새로 풀린 내 잠금 블록(「새 기억이 떠올랐다」 알림용).
 * 뒤로 가거나(to ≤ from) 풀린 게 없으면 빈 배열.
 */
export function memoriesUnlockedBetween(c: GungCase, a: Assignment, seat: number, from: number, to: number): SheetMemory[] {
  const f = normRound(from);
  const t = normRound(to);
  if (t <= f) return [];
  const sheet = getSheet(c, a, seat, t);
  return (sheet?.memories ?? []).filter((m) => m.unlocked && m.fromRound > f);
}

/**
 * 이 사건에서 잠금 블록(「R3에 떠오르는 기억」)이 풀리는 조사 라운드 — **어느 역할·어느 인원의 것이든** 합친다.
 * 「다시 확인하시오」 알림은 이 값만으로 정한다(내 역할·인원과 무관) — 기억 보유 역할만 알림을 받으면,
 * 특히 방장 폰(공용 화면)에선 그 알림이 곧 역할 노출이다(QA RISK-04). 인원별 구성도 흘리지 않게 인원 무관.
 */
export function memoryRounds(c: GungCase): RoundNo[] {
  const set = new Set<RoundNo>();
  for (const r of c.roles) {
    const blocks = [r.memories, ...Object.values(r.byCount ?? {}).map((o) => o?.memories), r.asCulprit?.memories];
    for (const list of blocks) for (const m of list ?? []) set.add(m.fromRound);
  }
  return [...set].sort((x, y) => x - y);
}

/**
 * from → to 로 진행 단계가 넘어가며 들어선, 「각자 내 패를 다시 확인하시오」를 띄울 조사 라운드(가장 늦은 것). 없으면 null.
 * 역할·자리·인원을 받지 않는다 — 모든 기기에 같은 순간 같은 문구가 뜬다.
 */
export function recheckRoundBetween(c: GungCase, from: number, to: number): RoundNo | null {
  const f = normRound(from);
  const t = normRound(to);
  if (t <= f) return null;
  const hits = memoryRounds(c).filter((r) => r > f && r <= t);
  return hits.length ? hits[hits.length - 1] : null;
}
