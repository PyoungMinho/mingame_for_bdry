/**
 * 읽은 대사(판을 넘어 남는 기록) — 키 형식 · 현재 대사 목록 · [≫ 읽은 건 넘기기] 계획. React 비의존.
 * 사양: docs/planning/witness-replay.md §f · d-2(readLines).
 *
 *  - 키 = `${readKey}#${i}~${h4(text)}` — 문구가 바뀌면 키도 바뀐다(고친 줄을 '읽음'으로 넘기지 않는다).
 *  - readKey 접두(화면이 DialogueBox 에 넘기는 값) — 아래 READ_PREFIXES 가 전부다. 새 접두를 쓰려면 여기 목록(readCatalog)에 더할 것.
 *    intro{i}(사건 소개 컷) · {hotspotId}(핫스팟 독백) · {setId}#intro(세트 소개) · {lineId}#press(추궁) · {breakId}#break(돌파 리액션) ·
 *    ending-{endingId}(엔딩 본문) · 그리고 표시 기록 {breakId}#opened(돌파 뒤 '새로 열린 것' 카드를 본 적 있음, openedReadKey).
 *  - meta 를 읽을 때(cleanReadLines): 해시 없는 옛 키·현재 대사에 없는 키는 버리고(1회 초기화), 최신 5000개만 남긴다.
 *  - 읽음 기록 규칙(X12): 일반 탭으로 지나간 줄만 기록. 길게 누르기 연속 넘김·[넘기기]로 지나간 줄은 새로 기록하지 않는다(화면 책임).
 */
import { CASE } from './case-data';
import type { Dialogue, Face, Speaker } from './types';

/** readLines 상한 — 최신(뒤쪽) 유지 */
export const READ_LINES_MAX = 5000;
/** [≫ 읽은 건 넘기기] 활성 조건 — 지금 줄 포함 연속 읽은 줄 수 */
export const SKIP_MIN_STREAK = 2;

/** 문구 해시 4자(FNV-1a 32 → base36 4자리). 충돌은 '읽음' 오판 한 줄뿐이라 이 정도면 충분 */
export function h4(text: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return (h % 1679616).toString(36).padStart(4, '0');
}

/** 읽은 대사 키 — DialogueBox 의 `${readKey}#${index}` 에 문구 해시를 붙인다 */
export function readLineKey(readKey: string, index: number, text: string): string {
  return `${readKey}#${index}~${h4(text)}`;
}

/** 블록의 줄별 키 */
export function readKeysOf(readKey: string, lines: readonly Pick<Dialogue, 'text'>[]): string[] {
  return lines.map((l, i) => readLineKey(readKey, i, l.text));
}

const OPENED_MARK = 'opened';
/** 돌파 뒤 '새로 열린 것' 카드를 한 번 본 표시(X15) — 읽음이면 다음부터 한 줄 칩으로 접는다 */
export function openedReadKey(breakId: string): string {
  return readLineKey(`${breakId}#${OPENED_MARK}`, 0, OPENED_MARK);
}

const KEY_RE = /^.+#\d+~[0-9a-z]{4}$/;

let catalog: Set<string> | null = null;
/** 지금 사건 대사로 만들 수 있는 읽음 키 전부(+ 열린 것 표시) */
export function readCatalog(): ReadonlySet<string> {
  if (catalog) return catalog;
  const out = new Set<string>();
  const add = (prefix: string, lines: readonly Dialogue[] | undefined) => {
    for (const k of readKeysOf(prefix, lines ?? [])) out.add(k);
  };
  CASE.intro.forEach((cut, i) => add(`intro${i}`, cut.lines));
  for (const l of CASE.locations) for (const h of l.hotspots) add(h.id, h.lines);
  for (const s of CASE.sets) {
    add(`${s.id}#intro`, s.intro);
    for (const line of s.lines) {
      add(`${line.id}#press`, line.press.lines);
      for (const b of line.breaks ?? []) {
        add(`${b.id}#break`, b.reaction);
        out.add(openedReadKey(b.id));
      }
    }
  }
  for (const [id, e] of Object.entries(CASE.endings)) add(`ending-${id}`, e?.lines);
  catalog = out;
  return out;
}

/**
 * 저장된 readLines 정리 — 문자열·해시 형식·현재 대사에 있는 키만, 중복 제거(처음 나온 자리), 최신 READ_LINES_MAX 개.
 * 해시 없는 옛 키(`intro0#0` 등)는 여기서 사라진다(사양 d-2 「1회 초기화」).
 */
export function cleanReadLines(v: unknown, max: number = READ_LINES_MAX): string[] {
  if (!Array.isArray(v)) return [];
  const cat = readCatalog();
  const seen = new Set<string>();
  for (const x of v) if (typeof x === 'string' && KEY_RE.test(x) && cat.has(x)) seen.add(x);
  return [...seen].slice(-max);
}

export interface SkipPlan {
  /** [≫ 읽은 건 넘기기] 누를 수 있나(지금 줄 포함 연속 읽은 줄 ≥ 2) */
  enabled: boolean;
  /** 지금 줄부터 연속으로 읽은 줄 수 */
  streak: number;
  /** 착지할 줄(처음 보는 줄). null = 블록 끝까지 읽음 → onDone */
  to: number | null;
  /** 건너뛴 구간에서 마지막으로 표정이 지정된 줄의 화자·표정(없으면 마지막 줄 화자만) — 착지 줄에 적용(M4) */
  carry: { who: Speaker; face?: Face } | null;
}

/**
 * 넘기기 계획(순수). isRead 는 화면의 game.isRead(키) 를 그대로 넘긴다.
 * readKey 가 없는 블록(판정 피드백 HALF·WRONG·REDIRECT 등)은 언제나 비활성.
 */
export function skipPlan(lines: readonly Dialogue[], readKey: string | null | undefined, index: number, isRead: (key: string) => boolean): SkipPlan {
  const none: SkipPlan = { enabled: false, streak: 0, to: index, carry: null };
  if (!readKey || index < 0 || index >= lines.length) return none;
  let j = index;
  while (j < lines.length && isRead(readLineKey(readKey, j, lines[j].text))) j++;
  const streak = j - index;
  if (streak === 0) return none;
  let withFace: Dialogue | undefined;
  for (let k = index; k < j; k++) if (lines[k].face) withFace = lines[k];
  const carry = withFace ? { who: withFace.who, face: withFace.face } : { who: lines[j - 1].who };
  return { enabled: streak >= SKIP_MIN_STREAK, streak, to: j < lines.length ? j : null, carry };
}
