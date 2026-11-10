/**
 * 월마감 프론트↔백엔드 계약 — D0 동결 (프론트팀장 + 백엔드팀장 공동 소유).
 *
 * 타입만 둔다. 런타임 값은 헤더·초인종 이름, 형식 정규식(MC_KEY_RE·ROOM_CODE_RE·LINE_ID_RE), 오류 코드 목록,
 * 상태 코드 표, 투영 금지 키 목록뿐이다(전부 순수 값 — 브라우저·서버·엔진 공용).
 * 서버는 한국어 문장을 보내지 않는다. 코드·숫자·문구 인덱스만 보내고, 문장은 각 브라우저가 자기 업종 팩으로 만든다.
 *
 * ── 숨긴 정보가 "타입에 존재할 수 없게" 한 설계 ──
 *  1) OppView에는 배 필드가 없다. 상대 배 위치는 EndedView.reveal 하나뿐이며, 이 필드는 status = 'ended'인
 *     변형에만 있다. PlayingView 객체 리터럴에 reveal을 넣으면 초과 속성 오류로 컴파일이 깨진다.
 *  2) QuizView에는 정답 필드가 없다(값·종류·라벨 시드·내 마감만).
 *  3) 상대 힌트는 LogEntry(type 'hint')로만 오고 값 필드가 없다. 힌트 값은 MeView.hints(내 것)에만 있다.
 *  4) 상대 오답·잠금, 경보 예정 라운드, 비밀키·해시는 어떤 뷰 타입에도 없다.
 *  5) 투영 속성 테스트(QA)가 직렬화 결과에서 찾을 금지 키를 VIEW_FORBIDDEN_KEYS로 제공한다.
 *
 * ── 문서 간 차이 처리(디자인 최종 > 방향서 > 백엔드·프론트 검토) ──
 *  - 오류 코드: 백엔드 검토의 ROOM_UNAVAILABLE 단일 코드 → 방향서 조건 2대로 ROOM_NOT_FOUND / ROOM_FULL 분리.
 *  - 경보 반응 ms: 백엔드 검토는 action 'alarm' → 방향서 §4-3대로 sync 본문(SyncBody.alarm)으로 보낸다.
 *  - 접속 판정 3초(기획서·백엔드) → 방향서 §2-G PRESENCE_MS 6초, 오프라인 표시 10초(constants).
 *  - serverNow: 방향서 §4-4는 room 안에 적었지만, sync "변경 없음" 응답과 오류 응답에도 필요하므로
 *    모든 응답 봉투(OkBase/ApiErr)에 한 번만 둔다(백엔드 검토 "모든 응답에 serverNow"와 일치).
 *  - room.status: TS 판별 유니언이 중첩 속성으로는 좁혀지지 않으므로 RoomView 최상위 `status`로 올렸다.
 *  - [D0 신설] NOT_JOINED: 자리 없는 비밀키로 sync/action을 보낸 경우(방이 꽉 찼으면 ROOM_FULL이 우선).
 *  - [D0 신설] sync "변경 없음" 응답에 presence(상대 접속·숨김)를 싣는다. 접속 신호는 mc_players에 따로 두어
 *    version을 올리지 않으므로(백엔드 §4-1), 이게 없으면 "상대 시트 · 오프라인"을 띄울 수 없다.
 *  - [D0 신설] 매치 id를 내려 feedback 요청이 어느 판인지 가리키게 했다(백엔드 검토 후 GameView.matchId로 이동).
 *
 * ── 백엔드팀장 D0 검토 반영 (2026-11-07, 기록: docs/backend/monthly-close-d0-freeze.md) ──
 *  B1 lastEvent(GameView, 1개) → RoomView 최상위 `events`(최근 EVENTS_KEEP개, seq 오름차순).
 *     joined·left·autoPlaced는 game이 없는 waiting·placing에서 나므로 GameView 안에서는 전달할 수 없었다.
 *  B2 fire 사건의 slot은 result = 'sunk'일 때만 존재(타입으로 강제). 반려(hit) 단계에서 슬롯을 주면
 *     맞힌 배의 길이가 새어 나간다. 내 판이 맞은 경우 슬롯은 me.ships로 클라가 계산한다.
 *  B3 QuizView: 내가 아직 풀이 중(mine = 'open')이면 status는 항상 'open', settleAt은 null(타입으로 강제).
 *     'settling'을 보이면 "상대가 이미 맞혔다"가 새어 나간다.
 *  B4 PresenceView에서 oppPresent 삭제. "자리에 있음"(OppView.present)은 나가기·입장으로만 바뀌는 버전 값이고,
 *     접속 여부는 lastSeenAt으로 판정한다. presence는 sync 응답 두 갈래 모두에 싣는다.
 *  B5 matchId: RoomInfo(null 가능) → GameView.matchId(항상 문자열). 매치 행은 status가 playing이 될 때 만든다.
 *  B6 TurnClock paused·hidden에 budgetEndsAt(숨기기 예산이 바닥나 시계가 다시 도는 서버 시각) 추가.
 *  B7 오류 코드 CAPACITY(503, 활성 방 상한) 추가, InvalidReason 'key'(비밀키 헤더 없음·형식 오류) 추가.
 *  B8 비밀키·방 번호 형식(MC_KEY_RE, ROOM_CODE_RE)을 계약에 고정.
 *
 * ── 버전(version)을 올리는 것 / 올리지 않는 것 (서버 규칙) ──
 *  올림: mc_rooms.state가 바뀌는 모든 것 — 액션, 기한 처리(시간 초과·자동 배치·검산 확정·경보 판정·재대결 만료),
 *        검산 배달 시각 기록, 차례인 사람의 숨기·복귀로 인한 발사 시계 정지·재개, 숨기기 예산 소진.
 *  안 올림: 접속 신호(last_seen)와 차례가 아닌 사람의 숨기·복귀(mc_players만 바뀜) → presence로 전달.
 */

import type { CellAddr, HintTarget, ShipPlacement } from './coords';
import type { IndustryId, ShipSlot } from './constants';

// ─── 기본 열거 ─────────────────────────────────────────────────────────────────

export type Seat = 0 | 1;
/** 브라우저 화면 상태 보고값. game = 게임 레이어, disguise = 숨기기 시트. */
export type ViewState = 'game' | 'disguise';
export type RoomStatus = 'waiting' | 'placing' | 'playing' | 'ended';
export type GamePhase = 'quiz' | 'fire';
/** miss = 해당 없음(`0`), hit = 반려(`1`), sunk = 종결(짧은 이름). sunk는 배의 마지막 칸을 맞힌 발에만 붙는다. */
export type ShotResult = 'miss' | 'hit' | 'sunk';
export type QuizKind = 'sum' | 'vat' | 'diff';
/** sunk2 = 정상 종결, draw = 같은 라운드 동시 2척 종결, cap = 30라운드 상한(승자 있을 수도 무승부일 수도), resign = 기권, absent = 부재 처리 */
export type EndReason = 'sunk2' | 'draw' | 'cap' | 'resign' | 'absent';
/** excluded = 경보 당시 접속 끊김(PRESENCE_MS 초과)으로 벌칙 제외 */
export type AlarmOutcome = 'pass' | 'fail' | 'excluded';
export type LaughLevel = 'none' | 'some' | 'lol';
/** reprimand = 시말서(패), award = 포상 품의서(승), joint = 공동 경위서(무) */
export type ResultDocKind = 'reprimand' | 'award' | 'joint';
/** common 팩 taunts 배열의 인덱스(0 ~ TAUNT_COUNT-1). 업종과 무관하게 두 화면이 같은 문장을 본다(방향서 §1 #4). */
export type TauntId = number;
/**
 * 문구 식별자(신고·노출 지표용). 형식: `<팩>/<필드 경로>/<인덱스>` 예) "accounting/memo.hit/4", "common/taunts/0".
 * 만드는 쪽은 copy/pick.ts(페이지개발자). 서버는 LINE_ID_RE 형식만 검사하고 내용은 모른다.
 */
export type LineId = string;
export const LINE_ID_RE = /^(common|accounting|sales|hr)\/[A-Za-z0-9_.]{1,40}(\/\d{1,3})?$/;

// ─── 화면 데이터(투영) ──────────────────────────────────────────────────────────

export interface RoomInfo {
  /** 5자리 방 번호 */
  readonly code: string;
  /** 상태가 바뀔 때마다 +1. 클라는 더 클 때만 반영한다(헤더 주석의 "버전을 올리는 것" 참고). */
  readonly version: number;
  /** 판 순번(1부터). 파일명 버전 = FIRST_DOC_VERSION + matchSeq - 1 → v7, v8… */
  readonly matchSeq: number;
  readonly alarmOn: boolean;
  /** 이 문서의 전적. wins[seat] = 그 자리의 승 수. 상단바 "버전 기록 2:1". */
  readonly record: { readonly wins: readonly [number, number]; readonly draws: number };
  /** Broadcast 초인종 주제 `mc:<방 UUID>`(참가자 화면에만 존재). 내용은 BellPayload. */
  readonly bellTopic: string;
}

interface PlayerBase {
  readonly seat: Seat;
  readonly nickname: string;
  readonly industry: IndustryId;
  /** 배치 완료(confirm) 여부 */
  readonly placed: boolean;
  /** 연속 시간 초과 수. 상대 값이 ABSENT_AFTER_TIMEOUTS 이상이면 [부재 처리] 노출, 내 값 2면 경고 문장 */
  readonly consecutiveTimeouts: number;
}

export interface MyHint {
  readonly target: HintTarget;
  /** 범위 안의 상대 배 칸 수 */
  readonly value: number;
  readonly round: number;
  /** 서버 시각 ms (검토 의견 표 "14:30") */
  readonly at: number;
}

export interface MeView extends PlayerBase {
  /** 내 배. 배치 중에는 0~3개(초안 포함), 대전 이후 3개. */
  readonly ships: readonly ShipPlacement[];
  /** 숨기기로 시계를 멈출 수 있는 남은 시간(판당 HIDE_BUDGET_MS에서 차감) */
  readonly hideBudgetMs: number;
  /** 이번 판에 받은 힌트 수(쓴 것 포함, 상한 HINTS_PER_GAME) */
  readonly hintsEarned: number;
  /** 지금 쓸 수 있는 힌트 수 = 받은 수 − 쓴 수. [Σ(n)] 배지. */
  readonly hintsAvailable: number;
  /** 내가 쓴 힌트와 결과 값 */
  readonly hints: readonly MyHint[];
  /** 검산 오답 잠금 해제 시각(서버 ms). 잠금 아니면 null. */
  readonly quizLockUntil: number | null;
  /** 경보 실패 벌칙: 다음 발사 1회 자동 넘김 예정 */
  readonly skipNextFire: boolean;
  /** 다음 도발 가능 라운드(보낸 라운드 + TAUNT_GAP_ROUNDS). 한 번도 안 보냈으면 1. */
  readonly nextTauntRound: number;
}

/**
 * 상대 정보. 상대 배·힌트 값·오답·잠금 필드는 없다(추가 금지).
 * present는 버전 값, lastSeenAt·hidden은 버전 없는 값(접속 신호)이라 sync "변경 없음" 응답의 presence로 덮어쓴다.
 */
export interface OppView extends PlayerBase {
  /** 자리에 있음(문서를 닫고 나가면 false — 결과 화면 "공동 편집자가 문서를 닫았습니다"). 버전 값 */
  readonly present: boolean;
  /** 마지막 접속 신호(서버 ms). 오프라인 표시 = serverNow − lastSeenAt > OFFLINE_LABEL_MS. 버전 없는 값 */
  readonly lastSeenAt: number;
  /** 숨기기 시트를 보는 중(차례면 시계가 멈춘 이유 표시용). 버전 없는 값 */
  readonly hidden: boolean;
}

export interface ShotView {
  readonly cell: CellAddr;
  readonly result: ShotResult;
  readonly round: number;
}

/** 종결된 상대 배: 슬롯과 칸만(배 이름은 보내지 않음). 칸은 placementCells()로. */
export interface SunkView extends ShipPlacement {
  readonly round: number;
}

/** 종결된 내 배: 위치는 me.ships에 있으므로 슬롯과 라운드만. */
export interface MySunkView {
  readonly slot: ShipSlot;
  readonly round: number;
}

/**
 * 발사 차례 시계. 상태 전환(정지·재개)은 버전을 올린다.
 *  - running       : deadlineAt(서버 ms)까지 카운트다운
 *  - paused·quiz   : 검산이 열려 있음(확정 후 TURN_MS 시작). remainingMs = 멈춘 숫자
 *  - paused·hidden : 차례인 사람이 숨는 중. budgetEndsAt(서버 ms)에 그 사람의 숨기기 예산이 바닥나
 *                    시계가 remainingMs부터 다시 돈다(그 시각에 refresh 1회). 정지 시작은 숨기기 보고 시각
 *                    (mc_players의 view_state 변경 시각) 기준으로 소급한다 — 요청 순서 경합으로 정지를 놓쳐도 손해 없음.
 */
export type TurnClock =
  | { readonly state: 'running'; readonly deadlineAt: number }
  | { readonly state: 'paused'; readonly reason: 'quiz'; readonly remainingMs: number }
  | { readonly state: 'paused'; readonly reason: 'hidden'; readonly remainingMs: number; readonly budgetEndsAt: number };

interface QuizViewBase {
  readonly id: string;
  readonly kind: QuizKind;
  /** 표 숫자. 길이 = QUIZ_VALUE_COUNT[kind] */
  readonly values: readonly number[];
  /** 라벨 고르기 시드. 문장 = pack.quiz[kind].labels[labelSeed % 개수] */
  readonly labelSeed: number;
  /**
   * 내 마감 = 내 배달 시각 + QUIZ_MS (서버 ms).
   * 배달 시각 = 서버가 이 검산을 이 사람의 응답에 처음 실은 시각. 서버는 투영 전에 그 시각을 상태에 기록·저장한다(버전 +1).
   */
  readonly deadlineAt: number;
}

/**
 * 검산(퀴즈). 정답 필드는 없다. 확정되면 phase가 'fire'로 바뀌고 quiz는 null, 결과는 events의 'quizSettled'.
 * 내가 아직 풀이 중이면 상대가 맞혔는지 알 수 없다: status는 'open', settleAt은 null로만 온다.
 */
export type QuizView = QuizViewBase &
  (
    | { readonly mine: 'open'; readonly status: 'open'; readonly settleAt: null }
    | {
        /** 내 상태. 잠금은 me.quizLockUntil */
        readonly mine: 'correct' | 'expired';
        /** open = 상대가 아직 풀 수 있음, settling = 정답자가 나왔고 settleAt까지 동시 정답 대기("계산 중...") */
        readonly status: 'open' | 'settling';
        /** settling일 때 이 시각에 sync 1회로 확정시킨다 */
        readonly settleAt: number | null;
      }
  );

/** 진행 중인 결재 경보. 결과는 events의 'alarmResult'. */
export interface AlarmView {
  /** 출제 시각(서버 ms). 반응 보고 시 그대로 돌려보낸다(SyncBody.alarm.issuedAt). */
  readonly issuedAt: number;
  /** 내 반응 보고를 서버가 받았는지 */
  readonly reported: boolean;
}

/** 변경 내역(판 전체 누적). 상대 힌트는 범위만, 도발은 문구 인덱스만. */
export type LogEntry = {
  readonly seq: number;
  readonly at: number;
  readonly round: number;
  readonly by: Seat;
} & ({ readonly type: 'hint'; readonly target: HintTarget } | { readonly type: 'taunt'; readonly tauntId: TauntId });

/**
 * 사건(상태줄·메모 트리거). 방 전체에서 seq가 1씩 증가한다(재대결로 판이 바뀌어도 이어짐).
 * 화면 데이터에는 최근 EVENTS_KEEP개만 실린다. 클라는 처리한 마지막 seq보다 큰 것만 처리하고,
 * 빈틈(첫 seq > 마지막 + 1)이 있으면 놓친 것은 넘기고 마지막 사건만 문장으로 보인다(복귀 5초 요약은 상태 차이로).
 * 두 자리에 똑같이 보내도 되는 사건만 여기 둔다(상대 오답·잠금, 힌트 값은 사건이 아니다).
 */
export type GameEventView = { readonly seq: number; readonly at: number; readonly round: number } & (
  | { readonly type: 'matchStarted'; readonly first: Seat }
  /** 해당 없음·반려: 슬롯 없음(맞힌 배의 길이가 새지 않게) */
  | { readonly type: 'fire'; readonly by: Seat; readonly cell: CellAddr; readonly result: 'miss' | 'hit' }
  /** 종결: 슬롯 공개(종결된 배 위치는 sunkByMe에도 있음) */
  | { readonly type: 'fire'; readonly by: Seat; readonly cell: CellAddr; readonly result: 'sunk'; readonly slot: ShipSlot }
  | { readonly type: 'timeout'; readonly seat: Seat }
  | { readonly type: 'skip'; readonly seat: Seat }
  | { readonly type: 'quizStarted' }
  | { readonly type: 'quizSettled'; readonly awarded: readonly Seat[]; readonly expired: boolean }
  | { readonly type: 'alarmResult'; readonly outcomes: readonly [AlarmOutcome, AlarmOutcome] }
  | { readonly type: 'hideBudgetOut'; readonly seat: Seat }
  | { readonly type: 'autoPlaced'; readonly seats: readonly Seat[] }
  | { readonly type: 'joined'; readonly seat: Seat }
  | { readonly type: 'left'; readonly seat: Seat }
  | { readonly type: 'ended' }
  | { readonly type: 'rematchRequested'; readonly seat: Seat }
  | { readonly type: 'rematchExpired' }
);

export interface GameView {
  /** 이 판의 매치 id(mc_matches.id). feedback 요청에 쓴다. 매치 행은 status가 playing이 될 때 만든다 */
  readonly matchId: string;
  readonly round: number;
  readonly phase: GamePhase;
  /** 지금 쏠 차례(phase = quiz면 검산 확정 뒤 쏠 사람) */
  readonly turn: Seat;
  /** 이 판의 선공(첫 판 무작위, 재대결은 번갈아) */
  readonly firstSeat: Seat;
  readonly clock: TurnClock;
  /** 내가 상대 판에 쏜 결과 */
  readonly myShots: readonly ShotView[];
  /** 상대가 내 판에 쏜 결과 */
  readonly oppShots: readonly ShotView[];
  /** 내가 종결시킨 상대 배(위치 공개됨) */
  readonly sunkByMe: readonly SunkView[];
  /** 상대가 종결시킨 내 배 */
  readonly sunkByOpp: readonly MySunkView[];
  readonly log: readonly LogEntry[];
  readonly quiz: QuizView | null;
  readonly alarm: AlarmView | null;
}

export interface ResultView {
  /** null = 무승부 */
  readonly winner: Seat | null;
  readonly reason: EndReason;
  /** 끝난 라운드({R}) */
  readonly round: number;
}

export interface RematchView {
  /** requested[seat] = 그 자리가 [v8로 저장]을 눌렀는지 */
  readonly requested: readonly [boolean, boolean];
  /** 먼저 누른 시각 + REMATCH_WAIT_MS. 아무도 안 눌렀으면 null */
  readonly expiresAt: number | null;
}

interface ViewCommon {
  readonly room: RoomInfo;
  readonly me: MeView;
  /** 최근 사건(최대 EVENTS_KEEP개, seq 오름차순). 대기·배치 중의 joined·left·autoPlaced도 여기로 온다 */
  readonly events: readonly GameEventView[];
}

/** 방장 혼자(배치는 미리 할 수 있음). 대기·배치 중 상대가 나가면 다시 waiting(내 배치 유지). */
export interface WaitingView extends ViewCommon {
  readonly status: 'waiting';
  readonly opp: null;
}

export interface PlacingView extends ViewCommon {
  readonly status: 'placing';
  readonly opp: OppView;
  /** 두 자리가 찬 시각 + PLACE_MS. 지나면 서버가 남은 배를 자동 배치 */
  readonly placeDeadlineAt: number;
}

export interface PlayingView extends ViewCommon {
  readonly status: 'playing';
  readonly opp: OppView;
  readonly game: GameView;
}

export interface EndedView extends ViewCommon {
  readonly status: 'ended';
  readonly opp: OppView;
  readonly game: GameView;
  readonly result: ResultView;
  /** 종료 후 공개: 상대 배 전체 위치(방향서 §1 #7). 이 변형에만 존재한다. */
  readonly reveal: readonly ShipPlacement[];
  readonly rematch: RematchView;
}

/** 보는 사람별 화면 데이터 = 서버 viewFor(state, seat)의 결과(허용 목록 방식으로 새 객체 생성). */
export type RoomView = WaitingView | PlacingView | PlayingView | EndedView;

/**
 * 상대 접속 정보(version을 올리지 않는 값). sync 응답 두 갈래 모두에 싣는다. 상대 자리가 비었으면 null.
 * 클라는 version을 바꾸지 않고 view.opp.lastSeenAt·hidden만 이 값으로 덮어쓴다.
 */
export interface PresenceView {
  readonly oppLastSeenAt: number;
  readonly oppHidden: boolean;
}

/**
 * 투영 속성 테스트용 금지 키. 직렬화한 화면 데이터(대전 중)에 이 키가 나오면 실패.
 * 서버 내부 상태는 비밀 필드에 이 이름들을 쓴다(그래야 실수로 복사됐을 때 이 검사에 걸린다):
 *   state.secret.boards / secret.quiz.answer / secret.alarmRound / seats[n].keyHash·hostKey·actionIds·deliveredAt
 * 키 이름 검사는 1차 방어일 뿐이다. QA 속성 테스트는 따로 ① opp 객체에 ships 키가 없는지 ② 상대 배 칸 중
 * 아직 맞지 않은 칸 주소가 직렬화 결과 어디에도 없는지 ③ 대전 중 reveal이 없는지를 본다.
 */
export const VIEW_FORBIDDEN_KEYS = [
  'secret',
  'boards',
  'answer',
  'quizAnswer',
  'alarmRound',
  'playerKey',
  'keyHash',
  'hostKey',
  'actionIds',
  'deliveredAt',
  'oppShips',
  'oppHints',
  'oppLockUntil',
  'reveal',
] as const;

// ─── 요청 ────────────────────────────────────────────────────────────────────

/** 비밀키 헤더(128비트, localStorage `mc:key`). URL에는 절대 넣지 않는다. */
export const MC_KEY_HEADER = 'x-mc-key';
/**
 * 비밀키 형식: crypto.getRandomValues 16바이트 → 소문자 hex 32자. 헤더가 없거나 형식이 다르면 INVALID(reason 'key').
 * 서버는 SHA-256(hex) 해시만 저장·비교하고, 원문을 로그·오류·화면 데이터에 남기지 않는다.
 */
export const MC_KEY_RE = /^[0-9a-f]{32}$/;
/** 방 번호 형식(ROOM_CODE_MIN~MAX). 라우트 [code]·API 경로 공용. 아니면 ROOM_NOT_FOUND. */
export const ROOM_CODE_RE = /^[1-9]\d{4}$/;
/** 테스트 표시 헤더(localStorage `mc:test`가 있으면 "1"). 방·매치·이벤트가 is_test로 기록된다. */
export const MC_TEST_HEADER = 'x-mc-test';
/** Broadcast 초인종 */
export const BELL_TOPIC_PREFIX = 'mc:';
export const BELL_EVENT = 'v';
export interface BellPayload {
  readonly v: number;
}

/** POST /api/monthly-close/rooms */
export interface CreateRoomBody {
  readonly nickname: string;
  readonly industry: IndustryId;
  readonly alarmOn: boolean;
}

/**
 * POST /api/monthly-close/rooms/[code]/join — 같은 비밀키면 원래 자리로 재입장(rejoined = true).
 * 재입장 때 본문의 닉네임·업종은 무시하고 처음 값을 유지한다(판 도중 문구 팩이 바뀌지 않게).
 */
export interface JoinBody {
  readonly nickname: string;
  readonly industry: IndustryId;
}

/** POST /api/monthly-close/rooms/[code]/sync */
export interface SyncBody {
  /** 클라가 가진 version(없으면 -1). 같으면 서버는 변경 없음 응답 */
  readonly knownVersion: number;
  readonly view: ViewState;
  /** 경보 반응 보고: 토스트 표시 → 위장 전환까지 ms(0 ~ ALARM_REACTION_MAX_MS). 경보 전부터 숨어 있었으면 0 */
  readonly alarm?: { readonly issuedAt: number; readonly reactionMs: number };
}

/** POST /api/monthly-close/rooms/[code]/action */
export type ActionBody = {
  /** 클라가 만든 중복 제거 키(≤ ACTION_ID_MAX). 같은 id 재전송이면 다시 적용하지 않고 최신 화면만 준다 */
  readonly actionId: string;
} & ActionPayload;

export type ActionType = ActionPayload['type'];

export type ActionPayload =
  /** 배치 저장. ships는 현재 놓은 배 전체(0~3개, 초안 허용). confirm = [배치 완료](3개 모두일 때만, 이후 수정 불가) */
  | { readonly type: 'place'; readonly ships: readonly ShipPlacement[]; readonly confirm: boolean }
  | { readonly type: 'fire'; readonly cell: CellAddr }
  /** value = 클라가 해석한 정수(쉼표·전각·"원" 제거 후) */
  | { readonly type: 'answer'; readonly quizId: string; readonly value: number }
  | { readonly type: 'hint'; readonly target: HintTarget }
  | { readonly type: 'taunt'; readonly tauntId: TauntId }
  | { readonly type: 'rematch' }
  | { readonly type: 'resign' }
  | { readonly type: 'claimAbsent' }
  | { readonly type: 'leave' };

/**
 * POST /api/monthly-close/feedback → 204 (비밀키 헤더 필요).
 * 서버는 matchId가 그 방 번호의 매치이고 보낸 비밀키가 그 매치의 참가자인지 확인한다. feedback은 매치·사람당 1건.
 * 클라는 status = 'ended'일 때의 game.matchId를 들고 있다가 쓴다(재대결로 화면이 바뀐 뒤에도 같은 값).
 */
export type FeedbackBody =
  | { readonly type: 'feedback'; readonly code: string; readonly matchId: string; readonly laugh: LaughLevel }
  | { readonly type: 'line_report'; readonly code: string; readonly matchId: string; readonly lineId: LineId }
  | { readonly type: 'lines_shown'; readonly code: string; readonly matchId: string; readonly lineIds: readonly LineId[] }
  | { readonly type: 'share_copied'; readonly code: string; readonly matchId: string; readonly doc: ResultDocKind }
  /** 세션당 1회: 초인종(웹소켓) 연결 성공 여부 — 회사망 차단 신호 */
  | { readonly type: 'transport'; readonly code: string | null; readonly bell: boolean };

// ─── 응답 ────────────────────────────────────────────────────────────────────

interface OkBase {
  readonly ok: true;
  /** 서버 시각 ms. 클라는 왕복 절반을 보정해 카운트다운에만 쓴다 */
  readonly serverNow: number;
}

export interface CreateRoomOk extends OkBase {
  readonly code: string;
  readonly seat: Seat;
  readonly view: RoomView;
}

export interface JoinOk extends OkBase {
  readonly seat: Seat;
  /** 같은 비밀키로 원래 자리에 돌아옴 */
  readonly rejoined: boolean;
  readonly view: RoomView;
}

/** 변경 없음이면 version·presence만(짧은 응답), 변경 있으면 화면 데이터 전체 + presence. */
export type SyncOk = OkBase & { readonly presence: PresenceView | null } & (
    | { readonly changed: false; readonly version: number }
    | { readonly changed: true; readonly view: RoomView }
  );

export interface ActionOk extends OkBase {
  readonly view: RoomView;
  /** 같은 actionId 재전송이라 다시 적용하지 않음 */
  readonly duplicate: boolean;
}

/** GET /api/monthly-close/health (비밀 없음, 캐시 금지) */
export interface HealthOk {
  readonly db: 'ok' | 'down';
}

/**
 * 오류 코드. 방 접근 판정 순서(join·sync·action 공통):
 *   비밀키 헤더 검사(INVALID 'key') → 방 없음·만료(ROOM_NOT_FOUND) → 내 자리 있음(통과)
 *   → [join] 빈자리 없으면 ROOM_FULL / [sync·action] 두 자리 다 찼으면 ROOM_FULL, 아니면 NOT_JOINED.
 * view는 자리가 있는 사람에게만 담는다(ROOM_*·NOT_JOINED·CAPACITY·SERVICE_DOWN에는 없음).
 */
export const ERROR_CODES = [
  'ROOM_NOT_FOUND', // 없는 방·만료·형식 오류 번호 → E3
  'ROOM_FULL', // 두 자리 다 참 → E2
  'NOT_JOINED', // [D0 신설] 자리 없는 비밀키로 sync/action(빈자리 있음) → 입장 대화상자
  'NOT_YOUR_TURN',
  'WRONG_PHASE',
  'LOCKED', // 검산 오답 잠금 중
  'INVALID', // 본문·값 검증 실패(세부는 reason)
  'CONFLICT', // 버전 비교 저장 3회 재시도 후에도 실패
  'RATE_LIMITED', // 비밀키·IP 단위 제한. retryAfterMs 동봉
  'CAPACITY', // [D0 백엔드] 503: 활성 방 ACTIVE_ROOMS_CAP 초과(방 만들기만). 클라는 SERVICE_DOWN과 같은 화면(E4)
  'SERVICE_DOWN', // 503: DB 연결 불가, 또는 Vercel에서 Supabase 키 없음(조건 4)
] as const;
export type ErrorCode = (typeof ERROR_CODES)[number];

/** INVALID의 세부 사유(상태줄 문장 고르기용). 새 사유는 두 팀장 합의 후 추가. */
export type InvalidReason =
  | 'body' // 스키마 불일치
  | 'key' // 비밀키 헤더 없음·MC_KEY_RE 불일치
  | 'nickname'
  | 'cell' // 판 밖·형식 오류
  | 'already_fired' // 이미 검토한 셀(턴 소모 없음)
  | 'ships' // 배치 모양·겹침·슬롯 중복
  | 'placed' // 이미 배치 완료(수정 불가)
  | 'quiz_stale' // 끝났거나 다른 검산 id
  | 'no_hint' // 쓸 힌트 없음
  | 'hint_blocked' // 검산·경보·숨기기 중
  | 'taunt_cooldown'
  | 'taunt_id'
  | 'absent_not_allowed' // 상대 연속 시간 초과 < ABSENT_AFTER_TIMEOUTS
  | 'rematch_closed';

export interface ApiErr {
  readonly ok: false;
  readonly serverNow: number;
  readonly error: ErrorCode;
  readonly reason?: InvalidReason;
  /** 자리가 있는 사람에게는 거부 응답에도 최신 화면 데이터를 담는다(방향서 §4-3) */
  readonly view?: RoomView;
  /** RATE_LIMITED·CAPACITY일 때 다시 시도까지 ms(서버는 Retry-After 헤더도 단다) */
  readonly retryAfterMs?: number;
}

export type ApiResult<T extends OkBase> = T | ApiErr;

/**
 * 오류 코드 → HTTP 상태(서버 응답용). 클라 분기는 상태 숫자가 아니라 본문의 error 코드로 한다
 * (409가 셋이라 숫자로는 구분 불가). 모든 응답에 Cache-Control: no-store, X-Robots-Tag: noindex.
 */
export const ERROR_HTTP_STATUS: Readonly<Record<ErrorCode, number>> = {
  ROOM_NOT_FOUND: 404,
  ROOM_FULL: 409,
  NOT_JOINED: 403,
  NOT_YOUR_TURN: 409,
  WRONG_PHASE: 409,
  LOCKED: 423,
  INVALID: 400,
  CONFLICT: 409,
  RATE_LIMITED: 429,
  CAPACITY: 503,
  SERVICE_DOWN: 503,
};

// ─── 지표 이벤트 (mc_events.type / props, 서버 전용 기록) ─────────────────────────

/** mc_events.props 허용 키(백엔드 §9-1). player_key·env·is_test는 열(column)로 따로 둔다. 닉네임·IP·UA 금지. */
export interface McEventProps {
  readonly room_created: { readonly industry: IndustryId; readonly alarmOn: boolean };
  /** hostKey = 방장 player_key(SHA-256 해시, 전파 K 계산용). 화면 데이터에는 절대 싣지 않는다 */
  readonly room_joined: { readonly seat: Seat; readonly hostKey: string };
  readonly match_started: { readonly seq: number; readonly rematch: boolean };
  readonly match_ended: { readonly reason: EndReason; readonly rounds: number; readonly winner: Seat | null };
  readonly rematch_requested: Record<string, never>;
  readonly feedback: { readonly laugh: LaughLevel };
  readonly line_report: { readonly lineId: LineId };
  readonly lines_shown: { readonly lineIds: readonly LineId[] };
  readonly share_copied: { readonly doc: ResultDocKind };
  readonly transport: { readonly bell: boolean };
}
export type McEventType = keyof McEventProps;
