/**
 * 레드라인 가드 — 외모·타인비교 요청 서버단 reject
 * 화이트리스트 방식: 금지 키워드 포함 시 E_REDLINE_REJECT
 */

import { Errors } from "./errors";

// ---------------------------------------------------------------------------
// 금지 필드명 (요청 body/query key)
// ---------------------------------------------------------------------------

const BLOCKED_FIELD_NAMES: ReadonlySet<string> = new Set([
  "compare_others",
  "other_users",
  "appearance",
  "looks",
  "face_score",
  "rank",
  "leaderboard",
  "body_score",
  "weight_compare",
  "attractiveness",
  "beauty_score",
]);

// ---------------------------------------------------------------------------
// 금지 텍스트 패턴 (코치챗 메시지 내용 검사)
// ---------------------------------------------------------------------------

const BLOCKED_TEXT_PATTERNS: ReadonlyArray<RegExp> = [
  /다른\s*(사람|유저|사용자)/,
  /타인\s*(비교|점수)/,
  /외모\s*(점수|평가|분석)/,
  /얼굴\s*(점수|평가)/,
  /몸매\s*(점수|평가|비교)/,
  /리더보드/,
  /랭킹\s*(순위|비교)/,
  /나보다\s*(잘생긴|예쁜|뚱뚱한|날씬한)/,
];

// ---------------------------------------------------------------------------
// 필드명 검사 (요청 객체 키 화이트리스트 검증)
// ---------------------------------------------------------------------------

/**
 * 요청 객체의 키를 검사. 금지 필드 포함 시 throw.
 * body 파싱 후, Zod 검증 전에 호출.
 */
export function assertNoRedlineFields(obj: Record<string, unknown>): void {
  for (const key of Object.keys(obj)) {
    const normalizedKey = key.toLowerCase().replace(/[-\s]/g, "_");
    if (BLOCKED_FIELD_NAMES.has(normalizedKey)) {
      throw Errors.redlineReject(key);
    }
  }
}

// ---------------------------------------------------------------------------
// 텍스트 내용 검사 (코치챗 메시지)
// ---------------------------------------------------------------------------

/**
 * 사용자 메시지 텍스트를 검사. 레드라인 패턴 포함 시 throw.
 * coach/chat 핸들러에서 호출.
 */
export function assertNoRedlineContent(text: string): void {
  for (const pattern of BLOCKED_TEXT_PATTERNS) {
    if (pattern.test(text)) {
      throw Errors.redlineReject("message_content");
    }
  }
}

// ---------------------------------------------------------------------------
// 응답 직전 출력 검증 (LLM 응답에 금지 내용 포함 방지)
// ---------------------------------------------------------------------------

const RESPONSE_BLOCKED_PATTERNS: ReadonlyArray<RegExp> = [
  /다른\s*(사람|유저)보다/,
  /평균\s*(점수|체중|외모)/,
  /상위\s*\d+\s*%/,
  /리더보드/,
  /랭킹\s*\d+위/,
];

/**
 * LLM 응답 텍스트가 레드라인 위반인지 검사.
 * 위반 시 응답 대신 안내 메시지로 대체.
 */
export function sanitizeAiResponse(text: string): string {
  for (const pattern of RESPONSE_BLOCKED_PATTERNS) {
    if (pattern.test(text)) {
      return "죄송합니다. 해당 내용은 오름의 코칭 정책에 맞지 않습니다. 본인의 어제 기록 대비 성장에 집중해 드릴게요.";
    }
  }
  return text;
}

// ---------------------------------------------------------------------------
// 복합 가드 (요청 전체를 한 번에 통과)
// ---------------------------------------------------------------------------

export interface RedlineGuardOptions {
  /** body 객체 키 검사 여부 (기본 true) */
  checkFields?: boolean;
  /** 메시지 텍스트 내용 검사 (코치챗용) */
  messageText?: string;
}

export function runRedlineGuard(
  body: Record<string, unknown>,
  options: RedlineGuardOptions = {}
): void {
  const { checkFields = true, messageText } = options;

  if (checkFields) {
    assertNoRedlineFields(body);
  }

  if (messageText !== undefined) {
    assertNoRedlineContent(messageText);
  }
}
