/**
 * 월마감(/monthly-close) 공용 상수 — D0 동결 (프론트팀장 + 백엔드팀장 공동 소유).
 *
 * - 1부(§3 블록)는 방향서 `docs/planning/project-direction-monthly-close.md` §3 코드 블록을 그대로 옮겼다.
 *   ★ = 밸런스 값(바꿀 때 기획팀장 확인), 나머지 = 기술 값(바꿀 때 두 팀장 합의).
 * - 2부(D0 추가)는 §3에 없지만 계약 파일(protocol·coords·copy/schema)이 같이 써야 해서 D0에 고정한 값이다.
 *   출처를 줄마다 적었다. 전부 기술 값이며 ★는 없다.
 * - 이 파일은 React·DOM·node:* 를 import하지 않는다(브라우저·서버·엔진 공용).
 */

// ─────────────────────────────────────────────────────────────────────────────
// 1부. 방향서 §3 그대로 (D0 동결)
// ─────────────────────────────────────────────────────────────────────────────

export const BOARD_SIZE = 8;                         // ★ A~H × 1~8
export const SHIP_LENGTHS = [4, 3, 2] as const;      // ★
export const SUNK_TO_WIN = 2;                        // ★
export const ROUND_CAP = 30;                         // ★ 넘으면 명중 칸 수 비교, 같으면 무승부
export const PLACE_MS = 90_000;                      // ★ 두 자리가 찬 시점부터. 넘으면 남은 배 자동 배치
export const TURN_MS = 20_000;                       // ★ 검산 확정 후부터
export const HIDE_BUDGET_MS = 120_000;               // ★ 차례인 사람이 숨은 동안 시계 정지, 판당 누적 상한
export const ABSENT_AFTER_TIMEOUTS = 3;              // ★
export const QUIZ_ROUNDS = [4, 8, 12] as const;      // ★ 조건이 안 맞으면 다음 라운드로 미룸
export const QUIZ_MS = 10_000;                       // ★ 사람별 배달 시각부터
export const QUIZ_LOCK_MS = 3_000;                   // ★ 오답 #VALUE! 잠금
export const QUIZ_TIE_MS = 200;                      // ★ 경과시간 차이가 이 이내면 둘 다 지급
export const QUIZ_DELIVERY_GRACE_MS = 2_000;         // 이 안에 배달 못 하면 출제 시각 + 1초를 배달 시각으로
export const HINTS_PER_GAME = 2;                     // ★ 판당 받는 개수(사용 여부 무관)
export const ALARM_ROUND_MIN = 6;                    // ★
export const ALARM_ROUND_MAX = 15;                   // ★
export const ALARM_HIDE_MS = 3_000;                   // ★
export const ALARM_REPORT_WAIT_MS = 10_000;          // 접속 중인데 보고가 없으면 실패
export const TAUNT_GAP_ROUNDS = 3;                   // ★
export const PRESENCE_MS = 6_000;                    // 출제 조건·경보 벌칙 제외 판정
export const OFFLINE_LABEL_MS = 10_000;              // "다른 사용자 오프라인" 표시
export const ROOM_IDLE_MS = 30 * 60_000;             // 활동할 때마다 연장
export const REMATCH_WAIT_MS = 120_000;
export const SYNC_MS = { play: 2_000, playNoBell: 1_000, idle: 5_000, idleNoBell: 3_000, hiddenTab: 5_000 } as const;
export const ACTIVE_ROOMS_CAP = 200;

// ─────────────────────────────────────────────────────────────────────────────
// 2부. D0 추가 (기술 값, 두 팀장 합의 대상)
// ─────────────────────────────────────────────────────────────────────────────

/** 배 길이 슬롯. 방향서 §1 #4: 배는 길이 슬롯(L4/L3/L2)으로만 주고받고 이름은 보는 사람의 업종 팩에서 가져온다. */
export const SHIP_SLOTS = ['L4', 'L3', 'L2'] as const;
export type ShipSlot = (typeof SHIP_SLOTS)[number];

/** 슬롯 → 길이. SHIP_LENGTHS와 같은 순서·값이어야 한다(아래 타입 단언이 어긋나면 type-check 실패). */
export const SHIP_LENGTH: Readonly<Record<ShipSlot, (typeof SHIP_LENGTHS)[number]>> = { L4: 4, L3: 3, L2: 2 };

/** 업종 번호(0~2) ↔ 문구 팩 키. 네트워크에는 번호만 보낸다(방향서 §4-3 방 만들기 "업종 번호 0~2"). */
export const INDUSTRIES = ['accounting', 'sales', 'hr'] as const;
export type IndustryKey = (typeof INDUSTRIES)[number];
export type IndustryId = 0 | 1 | 2;

/** 방 번호: 5자리 숫자 10000~99999 (방향서 §5-1, 백엔드 §7). */
export const ROOM_CODE_LENGTH = 5;
export const ROOM_CODE_MIN = 10_000;
export const ROOM_CODE_MAX = 99_999;

/** 닉네임 1~8자 (백엔드 §6-1 `nickname(8자)`, §7 입력 검증). */
export const NICKNAME_MIN = 1;
export const NICKNAME_MAX = 8;

/** 첫 판 파일명 버전. 판 순번 1 → v7, 재대결마다 +1 (방향서 §4-4 "판 순번(v7, v8…)"). */
export const FIRST_DOC_VERSION = 7;

/** 도발(의견 남기기) 공통 문구 수. 도발은 문구 인덱스(0~9)로 주고받는다(방향서 §6 "도발 10"). */
export const TAUNT_COUNT = 10;

/** 검산 종류별 값 칸 수 (디자인 §4-3: 합계 3칸, 부가세 1칸, 차액 2칸). 머리글 수 = 값 칸 + 1. */
export const QUIZ_VALUE_COUNT = { sum: 3, vat: 1, diff: 2 } as const;

/** 3×3 힌트 한 변 (방향서 §2-R: 가장자리면 판 안쪽으로 밀어 항상 3×3). */
export const HINT_BLOCK_SIZE = 3;

/** 초인종으로 시작하는 sync 최소 간격 (방향서 §1-1 조건 1). */
export const BELL_SYNC_MIN_GAP_MS = 300;

/** 한 요청의 actionId 최대 길이(클라 생성, 중복 제거 키). */
export const ACTION_ID_MAX = 64;

/** 판 끝 `lines_shown` 한 번에 보내는 문구 id 상한(지표 분모, 남용 방지). */
export const LINES_SHOWN_MAX = 200;

/** 경보 반응 ms 허용 범위 상한(백엔드 §7 "반응 ms(0~10,000)") = ALARM_REPORT_WAIT_MS. */
export const ALARM_REACTION_MAX_MS = ALARM_REPORT_WAIT_MS;

/**
 * 화면 데이터에 싣는 최근 사건 수(protocol RoomView.events, 백엔드 D0 검토).
 * 한 sync 간격(최대 SYNC_MS.hiddenTab 5초) 사이에 날 수 있는 사건(발사 2 + 시간 초과·넘김 + 검산·경보 + 판 끝)을 덮는다.
 */
export const EVENTS_KEEP = 8;

// ─── 컴파일 단언: 1부 값을 바꾸면 2부·coords 타입이 따라오는지 type-check가 잡는다 ───
type Assert<T extends true> = T;
/** coords.ts의 Col('A'~'H')·Row(1~8) 리터럴 타입은 BOARD_SIZE = 8을 전제로 한다. */
export type _AssertBoard8 = Assert<typeof BOARD_SIZE extends 8 ? true : false>;
/** SHIP_SLOTS와 SHIP_LENGTHS의 개수가 같다. */
export type _AssertSlots = Assert<(typeof SHIP_SLOTS)['length'] extends (typeof SHIP_LENGTHS)['length'] ? true : false>;
