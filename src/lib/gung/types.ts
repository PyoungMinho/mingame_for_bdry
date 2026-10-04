/**
 * 세자 독살 사건 (/gung) — 사건 데이터 스키마.
 *
 * 디자인 스펙 §7-3 가정 + 사건 원고(docs/planning/gung-case.md) 구조를 합친 것.
 * 실제 사건 본문은 마지막 단계에서 src/lib/gung/case/*.ts 데이터 파일로만 들어온다.
 * 이 파일은 "모양"만 정의하고 어떤 본문도 하드코딩하지 않는다.
 *
 * 핵심 규약
 *  - 역할은 priority(1..6) 로 정렬된다. 인원 N 이면 priority 1..N 이 플레이어, 나머지는 NPC.
 *  - 범인 역할은 priority ≤ MIN_PLAYERS(4) 여야 한다(어떤 인원에서도 플레이어) — validateCase 가 강제.
 *  - 장소 카드: 같은 장소 = 같은 카드(1장). 여러 장이 보이면 자리별 결정론 배분.
 *  - 인원별 변형: 카드의 forCount / onlyWhen(플레이어·NPC 여부) 로 교체 카드를 표현한다.
 *  - NPC 증언 카드: 그 역할이 NPC 인 판에서만 라운드 시작 때 공용 공개.
 *  - 라운드 잠금(원고 3판): 역할의 memories 블록은 fromRound 조사가 시작되기 전엔 플레이어 화면에 내리지 않는다.
 *  - 현장 관찰(원고 6판 10장): scenes 는 인원·역할 무관 공용 정보. 관찰 줄은 fromRound 조사부터 보인다(scene.ts).
 *  - 설계자 메모(memo)는 앱 데이터에 넣지 않는다.
 */

// ─────────────────────────────── 기본 ───────────────────────────────

export const MIN_PLAYERS = 4;
export const MAX_PLAYERS = 6;
export type PlayerCount = 4 | 5 | 6;
export const PLAYER_COUNTS: readonly PlayerCount[] = [4, 5, 6];

export type RoundNo = 1 | 2 | 3;
export const ROUND_NOS: readonly RoundNo[] = [1, 2, 3];

/** 역할 id — 예정: 'queen' | 'consort' | 'eunuch' | 'physician' | 'courtLady' | 'crownPrincess'. 'self' 는 예약어. */
export type RoleId = string;
export type PlaceId = string;
export type CardId = string;
export type TermId = string;

/** 디자인 스펙 §5-21 아이콘 키 (lucide 매핑은 UI 쪽). */
export type RoleIconKey = 'crown' | 'flower' | 'scroll' | 'pill' | 'key' | 'sword' | 'person';
export type PlaceIconKey =
  | 'bed'
  | 'pot'
  | 'flask'
  | 'trees'
  | 'hall'
  | 'door'
  | 'flame'
  | 'waves'
  | 'book'
  | 'warehouse'
  | 'pin';

export const ROLE_ICON_KEYS: readonly RoleIconKey[] = ['crown', 'flower', 'scroll', 'pill', 'key', 'sword', 'person'];
export const PLACE_ICON_KEYS: readonly PlaceIconKey[] = [
  'bed',
  'pot',
  'flask',
  'trees',
  'hall',
  'door',
  'flame',
  'waves',
  'book',
  'warehouse',
  'pin',
];

/** 시각 + 한 줄. time 이 없으면 시각 없는 줄(예: "그날 밤 중궁전 밖으로는 한 발도…"). */
export interface TimedLine {
  time?: string;
  text: string;
}

// ─────────────────────────────── 용어 풀이 ───────────────────────────────

export interface GlossaryTerm {
  id: TermId;
  term: string; // '부자(附子)·초오(草烏)'
  desc: string;
}

// ─────────────────────────────── 역할 ───────────────────────────────

/**
 * 개인 미션 판정 방식.
 *  - manual        : 방장이 결과표에서 구술·거수 판정을 입력(비밀 유지 등)
 *  - votesAtLeast  : target 이 1차 지목에서 min 표 이상
 *  - votesAtMost   : target 이 1차 지목에서 max 표 이하
 *  - notTopVoted   : target 이 1차 지목 최다 득표자(동률 1위 포함)가 아님
 *  - votedCulprit  : 내가 1차 지목에서 진범을 짚음
 *  - bonusCorrect  : 보너스 문항 questionId 를 맞힘(방장이 보너스 답을 입력하지 않았으면 판정 보류)
 * target 'self' = 미션 주인 자신.
 */
export type MissionCheck =
  | { kind: 'manual' }
  | { kind: 'votesAtLeast'; target: RoleId | 'self'; min: number }
  | { kind: 'votesAtMost'; target: RoleId | 'self'; max: number }
  | { kind: 'notTopVoted'; target: RoleId | 'self' }
  | { kind: 'votedCulprit' }
  | { kind: 'bonusCorrect'; questionId: string };

export interface MissionDef {
  id: string; // 역할 안에서 고유 ('secret', 'ambition' …)
  tag?: string; // '[비밀]' '[야망]' — 표시용
  text: string;
  /** 생략 시 scoring.mission */
  points?: number;
  check: MissionCheck;
  /** 범인 미션: 탈출했을 때만 인정(검거 시 0) */
  onlyIfEscaped?: boolean;
}

/**
 * 라운드 잠금 블록(원고 3판 「라운드 잠금」) — 예: 조상궁·세자빈의 「R3에 떠오르는 기억」.
 * 서버가 없으므로 "지금 라운드"는 그 폰의 로컬 진행 단계다(reachedRound(phase)).
 * fromRound 전엔 getSheet 가 본문(lines)을 아예 내리지 않고 잠김 표시(heading·fromRound)만 준다.
 */
export interface RoundGatedBlock {
  /** 이 조사 라운드가 시작될 때 펼친다 */
  fromRound: RoundNo;
  /** 'R3에 떠오르는 기억' — 표시용 제목(본문 아님, 잠긴 동안에도 보여도 되는 말만) */
  heading: string;
  lines: string[];
}

/** 인원별·범인 여부별 덮어쓰기. 배열은 통째로 교체된다(병합 아님). */
export type RoleOverride = Partial<Omit<RoleSheet, 'id' | 'priority' | 'icon' | 'byCount' | 'asCulprit'>>;

export interface RoleSheet {
  id: RoleId;
  /** 1..6 — 인원 N 이면 1..N 이 플레이어(원고 1-3 표의 번호) */
  priority: number;
  name: string; // '중전 서씨'
  shortName?: string; // '중전' — 좁은 UI(지목 그리드)
  subtitle?: string; // '중궁전의 주인, 계비'
  icon: RoleIconKey;
  /** 공개 프로필 = '신분' 섹션 · 자기소개 낭독용(공개) */
  profile: string;
  /** 한눈에 3줄 — 비밀 섹션 맨 위 */
  glance: string[];
  /** 비밀 ①②③… */
  secrets: string[];
  /** 라운드 잠금 블록(「R3에 떠오르는 기억」) — fromRound 전엔 플레이어 화면에 보이지 않는다 */
  memories?: RoundGatedBlock[];
  /** (남들 눈에 보이는) 동기 */
  motive?: string;
  /** 그날 밤 동선 */
  night: TimedLine[];
  /** 둘러대도 되는 것(거짓말 허용) */
  canLie: string[];
  /** 물으면 사실대로(숨김도 금지) */
  mustTell: string[];
  /** 추천 변명(주로 범인) */
  lieTips?: string[];
  missions: MissionDef[];
  /** 말투 예시 2~3 */
  speech: string[];
  /** 범인일 때 '정체' 섹션 본문(범인 후보 역할 필수) */
  crime?: string;
  /** 비밀 유지 판정(거수)용 한 줄 — 원고 8-3 */
  secretLine?: string;
  /** 이 역할 카드에만 붙는 용어(예: 활맥) */
  terms?: TermId[];
  byCount?: Partial<Record<PlayerCount, RoleOverride>>;
  /** 범인 변주 사건(Phase 2)용 — 이 역할이 범인으로 뽑힌 판에만 덮어씀 */
  asCulprit?: RoleOverride;
}

// ─────────────────────────────── 장소·카드 ───────────────────────────────

export interface PlaceDef {
  id: PlaceId;
  name: string; // '수라간'
  sub?: string; // '궁중 주방'
  icon: PlaceIconKey;
}

/** 카드 노출 조건. 둘 다 있으면 모두 만족해야 보인다. */
export interface CardCondition {
  /** 이 인원일 때만 */
  forCount?: PlayerCount[];
  /** players: 이 역할들이 모두 플레이어일 때만 · npcs: 이 역할들이 모두 NPC 일 때만 */
  onlyWhen?: { players?: RoleId[]; npcs?: RoleId[] };
}

export interface CardBase {
  id: CardId; // 'DG-2'
  title: string;
  body: string;
  /** 카드 연동 용어 — 이 카드를 열었을 때만 '?' 로 보임 */
  terms?: TermId[];
}

/** 장소 카드 */
export interface ClueCardDef extends CardBase, CardCondition {}

export type GateDir = 'in' | 'out';

/**
 * 출입 기록 한 줄(공용 카드 PB-2·PB-3 본문의 '· 해시 초: 숙의 연씨 入(궁녀는 문밖 대기)').
 * 그 카드 본문에 적힌 것만 옮긴다 — 진상 타임라인·설계 메모·추론(누가 안에 있었나)은 넣지 않는다.
 */
export interface GateEntry {
  /** '해시 초' — `${gateAxis.watches[i]} ${gateAxis.parts[j]}` */
  time: string;
  /** 출입한 사람의 역할(타임라인 레인) */
  roleId: RoleId;
  /** 카드에 적힌 이름 그대로 '상약 내관 오득구' */
  who: string;
  dir: GateDir;
  /** 카드의 괄호 덧말 '탕약 받으러' */
  note?: string;
  /** 카드 안 기록 순번(1..) — 같은 조각의 '·' 묶음(동시 출입)은 같은 번호 */
  seq: number;
}

/** 출입 타임라인 눈금 — 원고: 술시~축시, 초·정·말 */
export interface GateAxisDef {
  title: string; // '내문 출입'
  watches: string[]; // ['술시','해시','자시','축시']
  parts: string[]; // ['초','정','말']
}

/** 공용 카드(PB) — 라운드 시작 때 방장 폰에 자동 공개 */
export interface PublicCardDef extends CardBase, CardCondition {
  /** 이 카드가 공개하는 출입 기록(방장 화면 '내문 출입 타임라인'용). 카드가 열리기 전엔 그리지 않는다 */
  gateLog?: GateEntry[];
}

/** NPC 증언 카드 — roleId 가 NPC 인 판에서만 그 라운드에 공용 공개 */
export interface NpcCardDef extends CardBase {
  roleId: RoleId;
}

export interface RoundDef {
  no: RoundNo;
  title?: string; // '첫째 조사'
  /** 이 라운드에 열리는 장소(1~7곳) */
  placeIds: PlaceId[];
  /** placeId → 카드들(조건 통과분이 1장이면 공유, n장이면 자리별 배분) */
  clues: Record<PlaceId, ClueCardDef[]>;
  publicCards?: PublicCardDef[];
  npcCards?: NpcCardDef[];
  hostCue?: { select?: string; discuss?: string };
}

// ─────────────────────────────── 현장 관찰(원고 6판 10장) ───────────────────────────────

/**
 * 관찰 한 줄 — 그 라운드에 **새로** 열리는 줄(원고 10-3 R1~R3 칸). 앞 라운드 줄은 남고 새 줄이 아래에 붙는다.
 * 숨길 수 없는 공용 정보(다 같이 보는 화면)라 조건 필드가 없다 — 인원(4·5·6)·역할과 무관하게 같다(원고 10-1 「중립」).
 */
export interface ObservationLineDef {
  fromRound: RoundNo;
  /** 40자 이내(공백 포함) — 원고 10-3 */
  text: string;
}

/** 그림 속 물건(핫스팟) 하나 */
export interface SceneObjectDef {
  /** 'OB-DG1' — 핫스팟·본 물건 기록의 키 */
  id: string;
  /** '탕약 사발' */
  name: string;
  /** 그림 안 핫스팟 중심 [가로 %, 세로 %] (0~100) */
  pos: [number, number];
  /** fromRound 오름차순, 라운드당 최대 1줄 */
  lines: ObservationLineDef[];
}

/** 장소 그림 한 장 */
export interface SceneDef {
  placeId: PlaceId;
  /** 배경 그림 키('scene-dg') — UI 가 그림 자산에 매핑한다 */
  art: string;
  objects: SceneObjectDef[];
}

// ─────────────────────────────── 브리핑·진상·점수 ───────────────────────────────

/**
 * 브리핑 문단 토큰
 *  - {{cast}} : 플레이어 역할 이름을 priority 순으로 호명("중전 서씨. 숙의 연씨. 그리고 어의 백인수.")
 *  - {{npcs}} : NPC 역할 이름. 이 토큰이 든 문단은 NPC 가 없는 판(6인)에서 **통째로 빠진다**.
 */
export interface BriefingDef {
  heading: string;
  paragraphs: string[];
  hostCue?: string;
}

export interface TruthDef {
  /** 두루마리 비트(방장 탭 1회 = 1비트). culpritLine 전까지 범인 이름 금지 */
  beats: TimedLine[];
  /** '탕약에 독을 탄 자는…' */
  culpritLine: string;
  /** 범인 도장 비트의 자백문 */
  confession: string;
  /** 정리 문단(판결 비트) */
  summary?: string;
  epilogue?: string;
  /** 요약 타임라인(P9·모두의 패) */
  timeline?: TimedLine[];
}

export interface ScoringRule {
  /** 비범인이 1차 지목에서 범인을 짚음 */
  correctVote: number;
  /** 범인 검거 시 비범인 전원(이탈자 제외) */
  teamCatch: number;
  /** MissionDef.points 생략 시 기본 점수 */
  mission: number;
  /** 범인 도주 */
  culpritEscape: number;
  /** 보너스 문항 1개 정답당(범인 제외) */
  bonusCorrect: number;
}

/** 디자인 스펙 §7-3 기본값 */
export const DEFAULT_SCORING: ScoringRule = {
  correctVote: 3,
  teamCatch: 1,
  mission: 2,
  culpritEscape: 5,
  bonusCorrect: 1,
};

export interface BonusQuestion {
  id: string; // 'q1'
  prompt: string;
  options: string[];
  /** 정답 options 인덱스 */
  answer: number;
}

export interface TimerConfig {
  /** 현장 보기(조사 라운드 첫 하위 단계) — 0초에도 징 없이 조용히 끝난다(UX 스펙 §2-3) */
  sceneMs: number;
  selectMs: number;
  discussMs: number;
  /** 최종 변론 1인분 */
  defenseMs: number;
  /** 패 확인 카운트다운(「각자 폰을 가리고 확인하세요」) */
  cardsMs: number;
  /** 동률자 추가 변론 1인분(원고 8-1 「동률자만 30초씩 추가 변론 → 재투표」) */
  tieMs: number;
}

/**
 * 6판 압축 흐름(docs/design/gung-compact-scene-spec.md §2-3) — 조사 1라운드 = 현장 1 + 고르기 1 + 토론 5 = 7분.
 * 실측 뒤 숫자만 여기서 고친다(UI 문구·진행표는 이 값에서 계산할 것).
 */
export const DEFAULT_TIMERS: TimerConfig = {
  sceneMs: 60_000,
  selectMs: 60_000,
  discussMs: 5 * 60_000,
  defenseMs: 45_000,
  cardsMs: 2 * 60_000,
  tieMs: 30_000,
};

// ─────────────────────────────── 사건 ───────────────────────────────

export interface GungCase {
  id: string; // 'seja-poison'
  /** 본문·배정 로직이 바뀌면 +1 (URL &v= 와 저장 caseVersion 대조) */
  version: number;
  title: string;
  /** 자기소개 이후 공용 화면에 역할명 표기(D16). 기본 true */
  rolesPublicAfterIntro: boolean;
  briefing: BriefingDef;
  /** 6명분. priority 로 정렬해 쓴다 */
  roles: RoleSheet[];
  /** 단일 = 고정 범인. 배열 = 시드로 1명(변주 사건, Phase 2) */
  culprit: RoleId | RoleId[];
  places: PlaceDef[];
  rounds: [RoundDef, RoundDef, RoundDef];
  truth: TruthDef;
  glossary?: GlossaryTerm[];
  /** 처음부터 보이는 기본 용어 */
  baseTerms?: TermId[];
  bonusQuestions?: BonusQuestion[];
  scoring?: Partial<ScoringRule>;
  timers?: Partial<TimerConfig>;
  /** 무고자 '정체' 문구 오버라이드 */
  innocentIdentity?: string;
  /** 무고자 '정체' 둘째 문단 오버라이드(없으면 DEFAULT_INNOCENT_BODY) */
  innocentBody?: string;
  /** 범인 '정체' 머리 문구 오버라이드 */
  culpritIdentity?: string;
  /** NPC 카드 묶음 제목 — 원고: '추가 증언' */
  npcHeading?: string;
  /** 공용 카드 gateLog 를 그릴 눈금. 없으면 타임라인을 그리지 않는다 */
  gateAxis?: GateAxisDef;
  /** 현장 관찰(원고 10장) — 장소 그림별 물건·관찰 줄. 없으면 현장 화면에 그릴 것이 없다 */
  scenes?: SceneDef[];
}

export const DEFAULT_INNOCENT_IDENTITY = '당신은 범인이 아니오. 진범을 찾으시오.';
/**
 * 무고자 '정체' 둘째 문단(개선 묶음 1 · G4) — 범인 패는 머리 + crime 한 줄, 무고자 패는 머리 + 이 한 줄.
 * 열린 정체 칸의 실루엣(도장·문단 수)을 범인과 같게 맞춘다. 사건 정보 없음(표시 형식) — docs/planning/gung-improve-spec.md G4.
 */
export const DEFAULT_INNOCENT_BODY = '제 비밀은 지키되, 범인은 반드시 물증으로 가려내시오.';
export const DEFAULT_CULPRIT_IDENTITY = '당신이 범인이오.';
export const DEFAULT_NPC_HEADING = '추가 증언';
