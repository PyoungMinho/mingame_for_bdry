/**
 * 문구 팩 로더 + 고르기 + 조사 처리 (소유: 페이지개발자).
 *
 * - 팩 JSON은 여기서 import하고 타입만 단언한다(zod 검사는 copy.test.ts가 한다 → 클라이언트 번들에 스키마를 싣지 않음).
 * - 서버는 문장을 보내지 않는다. 화면은 이 모듈로 자기 업종 팩에서 문장을 만든다(방향서 §1 #4).
 * - 조사 토큰: `{배:을}` `{배:이}` `{배:은}`을 받침으로 처리(디자인 D3). `{c}`·`{좌표}` 뒤에 바로 붙은 을/를·은/는·이/가도
 *   좌표 끝 숫자의 읽기(1 일, 2 이, 3 삼…)로 다시 고른다.
 * - 무작위는 시드 기반이라 테스트에서 재현된다. 한 판 안 중복 금지(Picker.used), 회계 첫 판·연습의 L4 긴 이름 고정(D1).
 */

import type { CommonPack, IndustryPack } from './schema';
import type { IndustryId, IndustryKey, ShipSlot } from '../constants';
import { INDUSTRIES } from '../constants';
import type { LineId, ShotResult } from '../protocol';
import accounting from './accounting.json';
import common from './common.json';
import hr from './hr.json';
import sales from './sales.json';

export const COMMON_PACK = common as unknown as CommonPack;
export const INDUSTRY_PACKS: Readonly<Record<IndustryKey, IndustryPack>> = {
  accounting: accounting as unknown as IndustryPack,
  sales: sales as unknown as IndustryPack,
  hr: hr as unknown as IndustryPack,
};

export function industryKey(id: IndustryId): IndustryKey {
  return INDUSTRIES[id] ?? 'accounting';
}
export function packOf(id: IndustryId): IndustryPack {
  return INDUSTRY_PACKS[industryKey(id)];
}

// ─── 조사 ───────────────────────────────────────────────────────────────────────

/** 숫자를 우리말로 읽을 때 받침이 있나: 0 영, 1 일, 3 삼, 6 육, 7 칠, 8 팔 */
const DIGIT_BATCHIM = new Set(['0', '1', '3', '6', '7', '8']);

/** 마지막 글자에 받침이 있는가. 한글 음절·숫자만 판정, 그 밖(영문 등)은 없음으로 본다. */
export function hasBatchim(word: string): boolean {
  const chars = Array.from(word.trimEnd());
  const last = chars[chars.length - 1];
  if (!last) return false;
  const code = last.charCodeAt(0);
  if (code >= 0xac00 && code <= 0xd7a3) return (code - 0xac00) % 28 !== 0;
  if (last >= '0' && last <= '9') return DIGIT_BATCHIM.has(last);
  return false;
}

export type JosaKind = '을' | '이' | '은';
const JOSA_PAIR: Readonly<Record<JosaKind, readonly [string, string]>> = {
  을: ['을', '를'],
  이: ['이', '가'],
  은: ['은', '는'],
};
/** 단어 뒤에 붙을 조사 하나. josa('법카 내역', '을') → '을', josa('미수금', '이') → '이', josa('영수증','을') → '을' */
export function josa(word: string, kind: JosaKind): string {
  const [withB, without] = JOSA_PAIR[kind];
  return hasBatchim(word) ? withB : without;
}
const JOSA_ANY: Readonly<Record<string, JosaKind>> = { 을: '을', 를: '을', 이: '이', 가: '이', 은: '은', 는: '은' };

// ─── 토큰 채우기 ─────────────────────────────────────────────────────────────────

export type CopyVars = Readonly<Record<string, string | number | undefined>>;

/**
 * `{이름}` → vars[이름], `{이름:을|이|은}` → vars[이름] + 조사.
 * `{c}`·`{좌표}` 바로 뒤의 을/를/은/는/이/가는 좌표 읽기에 맞춰 다시 고른다.
 * 값이 없는 토큰은 그대로 둔다(테스트가 잡도록).
 */
export function fillCopy(text: string, vars: CopyVars): string {
  let out = text.replace(/\{([^{}:]+):([을이은])\}/g, (m, key: string, kind: JosaKind) => {
    const v = vars[key];
    return v === undefined ? m : `${v}${josa(String(v), kind)}`;
  });
  out = out.replace(/\{(c|좌표)\}([을를은는이가])/g, (m, key: string, j: string) => {
    const v = vars[key];
    return v === undefined ? m : `${v}${josa(String(v), JOSA_ANY[j] as JosaKind)}`;
  });
  out = out.replace(/\{([^{}]+)\}/g, (m, key: string) => {
    const v = vars[key];
    return v === undefined ? m : String(v);
  });
  return out;
}

/** 파일명: `월마감_최종_진짜최종_v{n}` + 버전 숫자 */
export function fileNameOf(pack: IndustryPack, version: number): string {
  return fillCopy(pack.fileName, { n: version });
}

/** 남은 시간 표시 "00:14" (올림). 음수는 00:00 */
export function formatClock(ms: number): string {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

/** 시각 "HH:MM" (로컬) */
export function formatHM(ms: number): string {
  const d = new Date(ms);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

/** 닉네임 앞 4자({상대}) */
export function shortName(nickname: string): string {
  return Array.from(nickname).slice(0, 4).join('');
}

// ─── 시드 난수와 고르기 ──────────────────────────────────────────────────────────

/** 문자열 → 32비트 시드 (FNV-1a) */
export function hashSeed(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** mulberry32: 0 이상 1 미만 */
export function makeRng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export interface PickedLine {
  readonly text: string;
  /** 지표용 문구 id: `<팩>/<필드 경로>/<인덱스>` */
  readonly id: LineId;
}

export function lineIdOf(pack: IndustryKey | 'common', path: string, index?: number): LineId {
  return index === undefined ? `${pack}/${path}` : `${pack}/${path}/${index}`;
}

/**
 * 한 판 안 중복 금지 고르기. 같은 목록에서 아직 안 쓴 문구를 먼저 고르고, 다 쓰면 처음부터 다시 쓴다.
 * 시드는 (방 번호 + 판 순번 + 사람)처럼 두 화면이 달라도 되는 값으로 만든다(문구는 각자 자기 팩이라 같을 필요 없음).
 */
export class Picker {
  private readonly rng: () => number;
  private readonly used = new Map<string, Set<number>>();
  constructor(seed: number | string) {
    this.rng = makeRng(typeof seed === 'string' ? hashSeed(seed) : seed);
  }
  /** 목록에서 한 줄. key는 목록 이름(중복 추적 단위) */
  pick(list: readonly string[], key: string): { text: string; index: number } {
    const used = this.used.get(key) ?? new Set<number>();
    if (used.size >= list.length) used.clear();
    const candidates: number[] = [];
    for (let i = 0; i < list.length; i++) if (!used.has(i)) candidates.push(i);
    const index = candidates[Math.floor(this.rng() * candidates.length)] ?? 0;
    used.add(index);
    this.used.set(key, used);
    return { text: list[index] ?? '', index };
  }
  /** 같은 key의 중복 기록을 잊는다(판이 바뀔 때) */
  reset(): void {
    this.used.clear();
  }
}

// ─── 업종 문구 만들기 ────────────────────────────────────────────────────────────

/** 긴 이름(배치 단계). 회계 첫 판·연습이면 L4는 0번("부장님 법카 내역") 고정, 나머지는 시드로 */
export function shipLongNames(
  pack: IndustryPack,
  opts: { readonly fixedFirst: boolean; readonly seed: string },
): Readonly<Record<ShipSlot, string>> {
  const rng = makeRng(hashSeed(opts.seed));
  const pickOne = (slot: ShipSlot) => {
    const list = pack.ships[slot].long;
    if (slot === 'L4' && opts.fixedFirst && pack.id === 'accounting') return list[0] ?? '';
    return list[Math.floor(rng() * list.length)] ?? list[0] ?? '';
  };
  return { L4: pickOne('L4'), L3: pickOne('L3'), L2: pickOne('L2') };
}

/** 칸 결과 메모. miss/hit은 목록에서, sunk는 슬롯별 목록에서 고른다 */
export function memoLine(
  pack: IndustryPack,
  picker: Picker,
  result: ShotResult,
  cell: string,
  slot?: ShipSlot,
): PickedLine {
  if (result === 'sunk' && slot) {
    const list = pack.memo.sunk[slot];
    const p = picker.pick(list, `memo.sunk.${slot}`);
    return { text: fillCopy(p.text, { c: cell }), id: lineIdOf(pack.id, `memo.sunk.${slot}`, p.index) };
  }
  const key = result === 'miss' ? 'miss' : 'hit';
  const p = picker.pick(pack.memo[key], `memo.${key}`);
  return { text: fillCopy(p.text, { c: cell }), id: lineIdOf(pack.id, `memo.${key}`, p.index) };
}

export type QuizKindKey = 'sum' | 'vat' | 'diff';
export function quizLabel(pack: IndustryPack, kind: QuizKindKey, labelSeed: number): PickedLine {
  const list = pack.quiz[kind].labels;
  const index = Math.abs(labelSeed) % list.length;
  return { text: list[index] ?? '', id: lineIdOf(pack.id, `quiz.${kind}.labels`, index) };
}

export function tauntLine(index: number): PickedLine {
  const text = COMMON_PACK.taunts[index] ?? '';
  return { text, id: lineIdOf('common', 'taunts', index) };
}

export function alarmLine(pack: IndustryPack, seed: number): PickedLine {
  const index = Math.abs(seed) % pack.alarm.length;
  return { text: pack.alarm[index] ?? '', id: lineIdOf(pack.id, 'alarm', index) };
}

/** 검산 오답 한 줄 메모 */
export function quizWrongLine(seed: number): PickedLine {
  const list = COMMON_PACK.quizWrong;
  const index = Math.abs(seed) % list.length;
  return { text: list[index] ?? '', id: lineIdOf('common', 'quizWrong', index) };
}

/** 상태줄 문장 한 줄 */
export function statusText(key: keyof CommonPack['status'], vars: CopyVars = {}): string {
  const raw = (COMMON_PACK.status as Record<string, string>)[key] ?? '';
  return fillCopy(raw, vars);
}

/** 결과 문서 본문: 종류별 변형을 시드로 고르고 토큰을 채운다 */
export function resultBody(
  pack: IndustryPack,
  kind: 'reprimand' | 'award' | 'joint',
  vars: CopyVars,
  seed: number,
): PickedLine {
  const list = pack.result[kind];
  const index = Math.abs(seed) % list.length;
  return { text: fillCopy(list[index] ?? '', vars), id: lineIdOf(pack.id, `result.${kind}`, index) };
}

/** [내용 복사] 5줄 텍스트(\n 구분). 경위는 첫 문장 60자에서 …로 자른다 */
export function shareText(args: {
  readonly docKind: 'reprimand' | 'award' | 'joint';
  readonly fileName: string;
  readonly round: number;
  readonly mine: number;
  readonly theirs: number;
  readonly body: string;
}): string {
  const s = COMMON_PACK.share;
  const docTitle = COMMON_PACK.resultDocs.titles[args.docKind];
  const resultWord = args.docKind === 'award' ? s.results.win : args.docKind === 'reprimand' ? s.results.lose : s.results.draw;
  const firstSentence = (args.body.match(/^.*?[.。](?=\s|$)/)?.[0] ?? args.body).trim();
  const chars = Array.from(firstSentence);
  const gist = chars.length > 60 ? `${chars.slice(0, 60).join('')}…` : firstSentence;
  return [
    fillCopy(s.line1, { 문서종류: docTitle, 파일명: args.fileName }),
    fillCopy(s.line2, { R: args.round, a: args.mine, b: args.theirs, 결과: resultWord }),
    fillCopy(s.line3, { 경위: gist }),
    s.line4,
    s.line5,
  ].join('\n');
}
