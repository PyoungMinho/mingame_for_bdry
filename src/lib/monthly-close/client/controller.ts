/**
 * RoomController — 화면 코드가 보는 유일한 방 인터페이스. D0 동결 (소유: 프론트팀장).
 *
 * 구현 3벌이 같은 모양을 따른다(방향서 §4-7, §7 병렬 규칙 2):
 *  - useMcRoom(code)    실전. API sync/action + Broadcast 초인종 + 폴링. version이 더 클 때만 setState.
 *  - usePracticeRoom()  박대리 연습. 브라우저 안에서 engine만 실행(서버·지표 없음). kind = 'practice'.
 *  - mock 컨트롤러      D1~D2 화면 개발용(고정 RoomView를 돌려줌). 서버 준비 후 useMcRoom으로 교체해 같은 화면 테스트 통과.
 * 화면(_screens/**)은 이 인터페이스만 보고 한 벌로 짠다. `"use client"` 쪽 파일이므로 server/를 import하지 않는다.
 *
 * 구현 규칙
 *  1) 메서드 참조는 렌더 사이에 안정적이어야 한다(useCallback/ref). state만 바뀐다.
 *  2) 숨기기 전환은 이 컨트롤러를 기다리지 않는다. reportView()는 fire-and-forget(fetch keepalive)이다.
 *  3) 화면이 사라질 때 자동 leave를 하지 않는다(방향서 §4-7). 나가기는 leave()/resign() 버튼으로만.
 *  4) 판정은 서버 응답(또는 연습 엔진)만 따른다. 낙관적 판정 금지. 대기 중엔 state.pending = true("계산 중...").
 *  5) 카운트다운은 now()(서버 보정 시각)로만 계산한다. Date.now()를 화면에서 직접 쓰지 않는다.
 *  6) 액션 Promise는 reject하지 않는다. 네트워크 실패도 ActionOutcome { ok: false }로 돌려준다.
 *  7) [백엔드 D0] version 규칙의 유일한 예외: sync 응답의 presence(버전 없는 값)는 version이 같아도
 *     view.opp.lastSeenAt·hidden에 덮어써 새 view 객체로 반영한다(presence가 null이거나 view.opp가 null이면 무시).
 *  8) [백엔드 D0] 사건은 view.events(최근 EVENTS_KEEP개)로 온다. 컨트롤러가 처리한 마지막 seq를 기억해
 *     화면이 같은 사건으로 메모·상태줄을 두 번 띄우지 않게 한다(새로고침 직후 첫 view의 사건은 "이미 본 것"으로 둔다).
 *  9) [백엔드 D0] 오류 → entry: ROOM_NOT_FOUND → notFound, ROOM_FULL → full, NOT_JOINED → needJoin,
 *     SERVICE_DOWN·CAPACITY → down. 분기는 HTTP 상태가 아니라 본문 error 코드로 한다.
 */

import type { CellAddr, HintTarget, ShipPlacement } from '../coords';
import type { ErrorCode, InvalidReason, JoinBody, RoomView, Seat, TauntId, ViewState } from '../protocol';

/** 방 진입 상태(화면 분기: 입장 대화상자 / 시트 / 예외 대화상자 E2·E3·E4). */
export type RoomEntry =
  | { readonly kind: 'loading' } // "문서를 여는 중…"
  | { readonly kind: 'needJoin' } // 자리 없음 → 입장 대화상자(J)
  | { readonly kind: 'seated'; readonly seat: Seat }
  | { readonly kind: 'notFound' } // E3
  | { readonly kind: 'full' } // E2 (다른 브라우저 재입장도 여기, 보조 줄 otherBrowser)
  | { readonly kind: 'down' }; // E4 (SERVICE_DOWN·CAPACITY)

/**
 * 연결 상태(상태줄 "다시 연결 중…").
 *  - live         : 최근 sync 성공
 *  - reconnecting : 연속 실패 중(입력 잠금)
 *  - down         : SERVICE_DOWN 또는 장시간 실패
 *  - local        : 연습(서버 없음)
 */
export type ConnectionState = 'connecting' | 'live' | 'reconnecting' | 'down' | 'local';

/** 변경 알림 경로. poll이면 SYNC_MS.*NoBell 주기. 연습은 local. */
export type TransportMode = 'bell' | 'poll' | 'local';

export interface ControllerError {
  readonly code: ErrorCode | 'NETWORK';
  readonly reason?: InvalidReason;
  /** 클라 시각 ms(상태줄 문장을 몇 초 보일지 계산용) */
  readonly at: number;
}

export interface RoomControllerState {
  readonly entry: RoomEntry;
  /** 최신 화면 데이터. 자리가 생기기 전·예외 화면에서는 null */
  readonly view: RoomView | null;
  readonly connection: ConnectionState;
  readonly transport: TransportMode;
  /** 액션 왕복 중(상태줄 "계산 중...", 격자 클릭 무시, 선택 테두리 회색) */
  readonly pending: boolean;
  /** 마지막 거부·실패. 화면이 copy.status로 문장을 고른다 */
  readonly lastError: ControllerError | null;
}

export type ActionOutcome =
  | { readonly ok: true; readonly view: RoomView }
  | { readonly ok: false; readonly error: ErrorCode | 'NETWORK'; readonly reason?: InvalidReason };

/** 연습 전용 정보(실전은 null). 코치 문장은 copy common.practice.coach[coachLine]. */
export interface PracticeInfo {
  /** 현재 컷(1부터) */
  readonly cut: number;
  readonly totalCuts: number;
  /** 지금 띄울 코치 문장 인덱스. 없으면 null */
  readonly coachLine: number | null;
  readonly done: boolean;
}

export interface RoomController {
  readonly kind: 'live' | 'practice';
  /** 방 번호(연습은 null) */
  readonly code: string | null;
  readonly state: RoomControllerState;
  readonly practice: PracticeInfo | null;

  /** 서버 보정 시각 ms(연습은 Date.now()). 카운트다운·기한 비교에만 쓴다 */
  now(): number;

  /** 입장·재입장. 성공하면 entry가 seated로 바뀐다 */
  join(body: JoinBody): Promise<ActionOutcome>;
  /** 배치 저장(초안 포함 현재 전체). confirm = [배치 완료] */
  place(ships: readonly ShipPlacement[], confirm: boolean): Promise<ActionOutcome>;
  fire(cell: CellAddr): Promise<ActionOutcome>;
  /** 검산 답(클라가 쉼표·전각·"원"을 정리한 정수) */
  answer(quizId: string, value: number): Promise<ActionOutcome>;
  /** 힌트 사용(검토 의견). 이름이 use로 시작하면 훅 규칙에 걸리므로 hint */
  hint(target: HintTarget): Promise<ActionOutcome>;
  taunt(id: TauntId): Promise<ActionOutcome>;
  /** [v8로 저장] 재대결 요청·수락 */
  rematch(): Promise<ActionOutcome>;
  /** 대전 중 문서 닫기(기권) */
  resign(): Promise<ActionOutcome>;
  /** 상대 연속 시간 초과 ≥ ABSENT_AFTER_TIMEOUTS일 때 [부재 처리] */
  claimAbsent(): Promise<ActionOutcome>;
  /** 대기·배치 중 문서 닫기, 결과 후 나가기 */
  leave(): Promise<ActionOutcome>;

  /** 숨기기·복귀 즉시 보고(fire-and-forget, keepalive). 화면 전환은 이 호출을 기다리지 않는다 */
  reportView(view: ViewState): void;
  /** 경보 반응 보고: 토스트 표시 → 위장 전환까지 ms. 이미 숨어 있었으면 0 */
  reportAlarm(issuedAt: number, reactionMs: number): void;
  /** 즉시 sync(탭 복귀, settleAt·기한 도달, 초인종 수신) */
  refresh(): void;
}

/** 실전 훅 시그니처(페이지개발자 구현). */
export type UseLiveRoom = (code: string) => RoomController;
/** 연습 훅 시그니처(페이지개발자 구현). 반환값의 kind = 'practice', practice ≠ null */
export type UsePracticeRoom = () => RoomController;
