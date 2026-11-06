export type CharId =
  | 'bujang'
  | 'ogwajang'
  | 'seoyun'
  | 'insa'
  | 'sangmu'
  | 'client'
  | 'junior'
  | 'it'
  | 'chairman'
  | 'heir'
  | 'director';
export type Mood = 'calm' | 'happy' | 'sus' | 'angry';
export type Rank = 'intern' | 'staff' | 'senior' | 'manager' | 'lead' | 'exec' | 'ceo';
export type ChoiceKind = 'exaggerate' | 'excuse' | 'frame' | 'honest' | 'tact';
export type ArtId =
  | 'hoesik'
  | 'office'
  | 'excel'
  | 'phone'
  | 'groupware'
  | 'mountain'
  | 'wedding'
  | 'meeting'
  | 'hr'
  | 'lobby'
  | 'receipt'
  | 'dinner'
  | 'review'
  | 'box'
  | 'dusty'
  | 'promotion'
  | 'gift'
  | 'blind'
  | 'wreath'
  | 'golf'
  | 'board'
  | 'chicken'
  | 'jail';

export interface Line {
  who: CharId | 'me' | 'narr';
  text: string;
  mood?: Mood;
}

export interface Effects {
  perf?: number;
  sus?: number;
}

export interface LieSpec {
  id: string;
  /** 장부에 쓰이는 짧은 분류 */
  label: string;
  /** 회사가 사실로 알게 된 내용 */
  claim: string;
  /** 나중에 기억해서 맞춰야 하는 값 */
  value?: string;
}

export interface LieRecord extends LieSpec {
  rank: Rank;
  year: number;
}

export interface Choice {
  id: string;
  kind: ChoiceKind;
  text: string;
  fx: Effects;
  lie?: LieSpec;
  flags?: string[];
  grandma?: boolean;
  /** 고르면 게임이 그 엔딩으로 끝난다 */
  ending?: EndingId;
  reply: Line[];
}

interface EventBase {
  id: string;
  year: number;
  art: ArtId;
  title: string;
  lines: Line[];
  when?: (s: GameState) => boolean;
}

export interface ChoiceEvent extends EventBase {
  type: 'choice';
  choices: Choice[];
}

export interface RecallOutcome {
  fx: Effects;
  reply: Line[];
}

export interface RecallEvent extends EventBase {
  type: 'recall';
  lieId: string;
  question: string;
  options: string[];
  correct: RecallOutcome;
  wrong: RecallOutcome;
  dodge: RecallOutcome & { text: string };
}

export interface ReviewEvent extends EventBase {
  type: 'review';
  threshold: number;
  next: Rank;
  pass: Line[];
  fail: Line[];
  failEnding: EndingId;
}

/** 이사회 추궁. 질문은 플레이어의 장부로 만들어지고, 그동안 장부는 압수된다. */
export interface HearingEvent extends EventBase {
  type: 'hearing';
  correct: Line[];
  wrong: Line[];
  confess: Line[];
  /** 장부가 비어 있을 때 */
  empty: Line[];
}

export type GameEvent = ChoiceEvent | RecallEvent | ReviewEvent | HearingEvent;

export type EndingId =
  | 'caught'
  | 'arrested'
  | 'contract_end'
  | 'stuck_staff'
  | 'stuck_senior'
  | 'stuck_manager'
  | 'stuck_lead'
  | 'chicken'
  | 'ceo_liar'
  | 'ceo_confess'
  | 'ceo_clean';

export interface Ending {
  id: EndingId;
  art: ArtId;
  stamp: string;
  title: string;
  body: string;
}

export interface GameState {
  v: 2;
  eventIndex: number;
  rank: Rank;
  year: number;
  perf: number;
  sus: number;
  flags: string[];
  lies: LieRecord[];
  grandma: number;
  /** 추궁에서 틀렸거나 얼버무린 횟수 */
  nearMisses: number;
  ledgerOpens: number;
  /** 같은 사건 안에서는 장부 비용을 한 번만 받는다 */
  ledgerPaidAt: number | null;
  /** 이사회에서 몇 번째 질문까지 왔는지 */
  hearingStep: number;
  /** 이사회에서 인정한 횟수 */
  confessed: number;
  ending: EndingId | null;
}

export type RecallResult = 'correct' | 'wrong' | 'dodge';

export interface HearingQuestion {
  lie: LieRecord;
  options: string[];
}

export interface Applied {
  state: GameState;
  reply: Line[];
  delta: { perf: number; sus: number };
  lie?: LieRecord;
  recall?: RecallResult;
  promoted?: boolean;
}
