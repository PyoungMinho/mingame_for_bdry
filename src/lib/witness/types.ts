/**
 * 「목격자는 AI」(/witness) — 데이터 모델. React 비의존.
 *
 * 출처: docs/planning/witness-system.md 3-3(스키마) + 사건 바이블 부록 A(decoys 등) + 디자인 확정본 §7·§8.
 * 시스템 스키마를 그대로 따르고, 아래만 하위 호환으로 더했다(전부 선택 필드 또는 값 범위 확장).
 *  - Speaker 'DEV'   : 집 안 기기(냉장고 등)의 한 줄. 이름은 Dialogue.label 로 준다(사건 바이블 L1.h3 "냉장고:").
 *  - Dialogue.label  : 'DEV' 화자 이름표.
 *  - Location.cost / tutorial, TestimonySet.cost : 비용을 데이터로 명시(시스템 2-1 표 그대로 — validate 가 규칙과 대조).
 *  - Location.look / scene : 지도 겉모습 한 줄 · 장면 설명(플레이어 대본 4장).
 *  - Hotspot.preNote : 정밀 조사 누르기 전 문구(디자인 §8-3 A2).
 *  - Evidence.upgradeOf : 갱신 카드(E03a·E03b·E14b)의 원본 id. 증거 개수(18)에서 빠진다.
 *    (v3) 단계형 갱신: 갱신 카드도 다시 갱신될 수 있다(E03 → E03a 해석 정정 → E03b 위조 확정). 사슬은 한 줄기·순환 없음.
 *  - Reliability 'revised' (v3): 기계가 해석을 고친 기록(「해석 정정」 태그). raw → revised → forged 의 중간 단계.
 *  - Question.answer (v3) : 풀린 의문 아래에 적는 답. 없으면 풀어 준 돌파의 explain.
 *  - Break.half 의 카드 키(v3) : 그 줄을 '반쯤' 맞히는 카드(반쪽 카드). 정답 세트에 없어도 HALF(감점 없음).
 *  - Solution.decoys : 최종 칸 미끼(바이블 부록 A-1, 고아 증거 검사용).
 *  - CaseFile : 사건 소개·규칙·오답 리액션·엔딩·판정 대사 등 사건 텍스트 묶음(디자인 §8-3 A3).
 *
 * AI 표정(Face) ↔ LED: normal=시안(대기) · sweat=노랑(처리 중) · shock/break=보라(정정) · angry=빨강(권한 거부).
 */

export type Id = string;

export type SuspectId = 'S1' | 'S2' | 'S3' | 'S4';
export type Speaker = SuspectId | 'AI' | 'COP' | 'ME' | 'NARR' | 'DEV';
export type Face = 'normal' | 'sweat' | 'shock' | 'angry' | 'break';

/** 대사 한 줄(text ≤ 45자) */
export interface Dialogue {
  who: Speaker;
  face?: Face;
  text: string;
  /** who === 'DEV' 일 때 이름표(예: '냉장고') */
  label?: string;
}

export type Cond =
  | { all: Cond[] }
  | { any: Cond[] }
  | { broken: Id }
  | { hasEvidence: Id }
  | { flag: Id }
  | { visited: Id }
  | { not: Cond };

// ─────────────────────────────── 증거 · 프로필 ───────────────────────────────

export type EvidenceKind = 'item' | 'log' | 'doc' | 'photo' | 'memo';
export type Reliability = 'raw' | 'verified' | 'revised' | 'forged';
export type EvidenceRole = 'means' | 'opportunity' | 'motive' | 'key' | 'herring' | 'secret';
export type EvidenceFrom = 'start' | { location: Id; hotspot: Id } | { break: Id } | { press: Id };

export interface Evidence {
  /** 'E01'..'E18', 갱신본 'E03b' */
  id: Id;
  /** ≤ 12자 */
  name: string;
  kind: EvidenceKind;
  /** ≤ 45자 */
  summary: string;
  /** ≤ 3줄, 줄당 ≤ 45자 */
  detail: string[];
  /** 'HH:MM' → 타임라인 */
  time?: string;
  reliability?: Reliability;
  from: EvidenceFrom;
  /** 놓쳤을 때 결과 화면 문구(스포 금지) */
  missHint: string;
  /** 내부용, 화면 비노출 */
  role: EvidenceRole[];
  /** 갱신 카드면 원본 id(교체형, 18개 수에 넣지 않음) */
  upgradeOf?: Id;
}

export type ProfileId = SuspectId | 'AI' | 'VICTIM';

/** 인물 프로필 — 증거처럼 제시할 수 있다(최종 지목 칸에는 못 넣는다) */
export interface Profile {
  id: ProfileId;
  name: string;
  age?: number;
  /** 공개 프로필 3줄 */
  summary: string[];
  /** 비밀이 풀리면 더해지는 한 줄 */
  secretLine?: string;
}

/** 제시 카드 = 증거 id 또는 프로필 id */
export type CardId = Id;

// ─────────────────────────────── 장소 ───────────────────────────────

export interface Hotspot {
  id: Id;
  /** 일러스트 상대좌표(%) */
  x: number;
  y: number;
  label: string;
  /** 스마트 기기 → 로그 UI */
  device?: boolean;
  /** 정밀 조사(+1 행동) */
  precise?: boolean;
  /** 정밀 조사 누르기 전 작가 문구(≤ 45자) */
  preNote?: string;
  /** 미충족이면 점·레일 모두 그리지 않는다(디자인 D09) */
  unlock?: Cond;
  /** 독백 ≤ 3줄 */
  lines: Dialogue[];
  gives?: Id[];
  /** 증거 없는 유머·분위기 핫스팟 */
  flavor?: boolean;
}

export interface Location {
  id: Id;
  name: string;
  /** 장면 아트 키 */
  art: string;
  initial: boolean;
  /** 첫 진입 비용(시스템 2-1). 튜토리얼 0, 그 밖 1 */
  cost: 0 | 1;
  tutorial?: boolean;
  unlock?: Cond;
  /** 잠김 문구(스포 금지) */
  lockedLabel?: string;
  /** 지도 겉모습 한 줄 */
  look: string;
  /** 조사 화면 장면 설명 */
  scene: string;
  /** 3~5 */
  hotspots: Hotspot[];
}

// ─────────────────────────────── 증언 ───────────────────────────────

export type SetKind = 'tutorial' | 'first' | 'second' | 'confront' | 'ai';

export interface TestimonySet {
  id: Id;
  title: string;
  /** 대질이면 2명 */
  speakers: Speaker[];
  kind: SetKind;
  initial: boolean;
  /** 첫 열람 비용(시스템 2-1). 튜토리얼·chain·★ 해금(대질) 0, 그 밖 1 */
  cost: 0 | 1;
  unlock?: Cond;
  /** ≤ 3 */
  intro: Dialogue[];
  /** ≤ 6 (숨은 줄 포함) */
  lines: Line[];
  /** 「다 털었다」 시 ≤ 2 */
  outro: Dialogue[];
}

export type Truth = 'true' | 'lie' | 'mistaken' | 'record' | 'inference' | 'refusal';

export interface Question {
  id: Id;
  /** ≤ 45자 */
  text: string;
  /** 돌파 id 또는 증거 id — 하나라도 깨졌거나(돌파) 손에 있으면(증거, 갱신본 포함) 풀린다 */
  resolvedBy: Id[];
  /** 풀린 뒤 적는 답(≤ 45자). 없으면 풀어 준 돌파의 explain */
  answer?: string;
}

export interface Press {
  /** ≤ 3 */
  lines: Dialogue[];
  /** 숨은 줄 삽입 */
  reveals?: Id;
  /** 메모형 증거 */
  gives?: Id;
  question?: Question;
  flag?: Id;
}

export interface Redirect {
  /** 1~2장. 낸 카드가 전부 이 안이면 감점 없이 say */
  cards: CardId[];
  /** ≤ 3 */
  say: Dialogue[];
}

export interface Line {
  /** 'T03.4' */
  id: Id;
  who: Speaker;
  /** ≤ 45자 */
  text: string;
  truth: Truth;
  /** record 전용: 범인이 꾸민 사건을 기록한 줄 */
  forged?: boolean;
  claimTime?: string;
  hidden?: boolean;
  redirect?: Redirect;
  press: Press;
  breaks?: Break[];
}

export type CardSet = [CardId] | [CardId, CardId];
/**
 * HALF 대사. 배열이면 공통. 객체면 카드별(+ 'requires' = 요건 미충족).
 * (v3) 객체의 카드 키는 '반쪽 카드'다 — 정답 세트에 없는 카드라도 키에 있으면 그 줄에서 HALF(감점 없음).
 */
export type HalfLines = Dialogue[] | Partial<Record<CardId | 'requires', Dialogue[]>>;

export interface Break {
  /** 'C05' */
  id: Id;
  tier: 'star' | 'minor';
  type: 'contradiction' | 'permission';
  evidence: CardSet;
  accept?: CardSet[];
  requires?: Cond;
  half?: HalfLines;
  /** ≤ 4 */
  reaction: Dialogue[];
  revisedText?: string;
  unlocks: Unlock[];
  hintTopic: string;
  /** ≤ 45자 */
  explain: string;
}

export type Unlock =
  | { set: Id; chain?: boolean }
  | { location: Id }
  | { hotspot: Id }
  | { evidence: Id }
  | { upgrade: [from: Id, to: Id] }
  | { flag: Id }
  | { secret: SuspectId };

// ─────────────────────────────── 최종 판정 ───────────────────────────────

export type Slot = 'means' | 'opportunity' | 'motive';
export const SLOTS: readonly Slot[] = ['means', 'opportunity', 'motive'];

export interface Solution {
  culprit: SuspectId;
  /** 칸마다 정답 1~2 */
  accept: Record<Slot, Id[]>;
  hiddenEnding: Cond;
  /** (v3) 지목 직전 경고 — 위에서부터 처음 맞는 하나만 */
  accuseWarn?: { when: Cond; lines: Dialogue[] }[];
  /** 최종 칸 미끼(고아 증거 검사용, UI 비사용) */
  decoys?: Partial<Record<Slot, Id[]>>;
}

export type EndingId = 'perfect' | 'hidden' | 'short' | `wrong-${SuspectId}` | 'timeout' | 'excluded';
export type Grade = 'S' | 'A' | 'B' | 'C';

export interface EndingText {
  title: string;
  /** 본문 ≤ 10줄 */
  lines: Dialogue[];
}

export interface VerdictLines {
  /** '{name}' 자리에 지목한 사람 이름 */
  call: Dialogue;
  means: { ok: Dialogue[]; ng: Dialogue[] };
  opportunity: { ok: Dialogue[]; ng: Dialogue[]; byCard?: Partial<Record<Id, Dialogue[]>> };
  motive: { ok: Dialogue[]; ng: Dialogue[] };
}

export type AchievementId = 'flawless' | 'lightning' | 'nohint' | 'allclear' | 'arrestSpeaker' | 'trustedMachine';

export interface IntroCut {
  art: string;
  /** ≤ 3줄 */
  lines: Dialogue[];
}

export interface CaseCopy {
  /** 반쯤 맞음 공통(감점 없음) */
  half: Dialogue;
  /** 이미 깬 줄 */
  already: Dialogue;
  /** 오답 리액션 뒤 독백 */
  wrongMonologue: Dialogue;
  /** 수첩 정리(힌트) 첫 줄 */
  hintLead: string;
  /** '{who}' '{title}' */
  hintBreakable: [string, string];
  /** '{place}' */
  hintPlace: string;
  hintRevisit: string;
  /** '{who}' */
  hintAsk: string;
  hintPress: string;
  hintDone: string;
}

export interface CaseFile {
  id: 'witness-01';
  /** 「스마트홈 살인사건 — 목격자는 AI 스피커」 */
  title: string;
  /** 「목격자는 AI」 */
  shortTitle: string;
  names: Record<Speaker, string>;
  intro: IntroCut[];
  rules: string[];
  cutIns: { press: string; present: string; break: string };
  profiles: Profile[];
  evidence: Evidence[];
  locations: Location[];
  sets: TestimonySet[];
  solution: Solution;
  /** 수첩 정리용 완벽 해결 경로(돌파 id 순서) */
  hintRoute: Id[];
  /** 인물당 3종 */
  wrongReactions: Partial<Record<Speaker, string[]>>;
  /** 신뢰 단계별 한결 말풍선(UX 4-5 초안) */
  copTrustLines: Record<1 | 2 | 3 | 4 | 5, string>;
  endings: Partial<Record<EndingId, EndingText>>;
  easterEgg: Dialogue[];
  verdict: VerdictLines;
  titles: { S: string; A: string; B: string; short: string; wrong: string; timeout: string; excluded: string };
  copy: CaseCopy;
}
