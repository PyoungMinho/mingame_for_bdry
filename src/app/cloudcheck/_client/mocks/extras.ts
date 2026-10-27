// src/app/cloudcheck/_client/mocks/extras.ts — judge 밖 순수 함수 결과의 목업(TimeNotice · ExceptionOverlay · 예외 파일 · Comparison). 소유: 프론트팀장.
// 진짜 값은 DB설계자 engine/time.ts·exceptions.ts·compare.ts와 API설계자 parse/exceptions.ts가 만든다(방향서 §5-3).
import type { ExceptionsFile } from "../../../../lib/cloudcheck/contract/exceptions-schema";
import type { Comparison, CompareSide, ExceptionOverlay, Label, TimeNotice } from "../../../../lib/cloudcheck/model/report";
import { collectedAt, day, distOf, sens } from "./build";
import { AWS_ACCOUNT, REPORT_B } from "./reports";

/* ───────── 시간 알림(timeNotices — 체험이면 빈 배열) ───────── */
export const NOTICE_STALE: TimeNotice = { kind: "snapshot-age", level: "stale", ageHours: 30 };
export const NOTICE_VERY_STALE: TimeNotice = { kind: "snapshot-age", level: "very-stale", ageHours: 200 };
export const NOTICE_FUTURE: TimeNotice = { kind: "future-timestamp", aheadMinutes: 12 };
export const NOTICE_GUIDANCE_STALE: TimeNotice = { kind: "guidance-stale", ruleIds: ["AWS-NET-1", "AWS-KEY-2"] };
export const MOCK_TIME_NOTICES: readonly TimeNotice[] = [NOTICE_VERY_STALE, NOTICE_FUTURE, NOTICE_GUIDANCE_STALE];

/* ───────── 예외(overlayExceptions — 상태는 바꾸지 않고 라벨만, 위험·주의 대상에만) ───────── */
type ExceptionLabel = Extract<Label, { kind: "exception" }>;
const active: ExceptionLabel = {
  kind: "exception", state: "active", reason: sens("freeText", "레거시 사이트 자산. 다음 분기에 정리할 예정", "•••"), until: day("2026-12-31"), createdAt: day("2026-10-19"),
};
const expired: ExceptionLabel = {
  kind: "exception", state: "expired", reason: sens("freeText", "배치 이전 작업 중 임시 사용", "•••"), until: day("2026-10-01"), createdAt: day("2026-09-01"),
};
/** REPORT_B 기준: 레거시 버킷(주의) = 예외 적용, choi 키(주의) = 만료되어 해제, 1건은 대상 없음 */
export const MOCK_OVERLAY_B: ExceptionOverlay = {
  byItemId: new Map<string, ExceptionLabel>([["b-sto2-assets", active], ["b-key1-choi", expired]]),
  entries: [{ index: 0, state: "active" }, { index: 1, state: "expired" }, { index: 2, state: "unmatched" }],
  counts: { active: 1, expired: 1, unmatched: 1 },
};
const matchKeyOf = (itemId: string): string => {
  for (const dr of REPORT_B.doors) for (const ru of dr.rules) for (const it of ru.items) if (it.id === itemId) return it.resource.key;
  throw new Error(`mock: REPORT_B에 ${itemId}가 없습니다`);
};
/** 위 오버레이를 만든 예외 파일(실제 MatchKey를 담는다 — 마스킹 예외, UI가 고지) */
export const MOCK_EXCEPTIONS_FILE_B: ExceptionsFile = {
  schema: "cloudcheck.exceptions/1.0",
  entries: [
    { ruleId: "AWS-STO-2", resource: matchKeyOf("b-sto2-assets"), reason: "레거시 사이트 자산. 다음 분기에 정리할 예정", until: "2026-12-31", createdAt: "2026-10-19" },
    { ruleId: "AWS-KEY-1", resource: matchKeyOf("b-key1-choi"), reason: "배치 이전 작업 중 임시 사용", until: "2026-10-01", createdAt: "2026-09-01" },
    { ruleId: "AWS-NET-1", resource: `aws|${AWS_ACCOUNT}|security-group|ap-northeast-2|sg-0ffffffffffff0001`, reason: "지운 보안 그룹", until: "2026-11-30", createdAt: "2026-10-19" },
  ],
};

/* ───────── 재점검 비교(compare) ───────── */
const side = (at: string, last4 = "3333"): CompareSide => ({ cloud: "aws", accountLast4: last4, alias: null, asOf: collectedAt(at) });
/** 변화 다섯 종류(became-unknown · worse · better · became-known · same)를 모두 담은 비교 */
export const MOCK_COMPARISON_OK: Comparison = {
  ok: true,
  before: side("2026-10-12T03:00:00Z"),
  after: side("2026-10-19T03:12:00Z"),
  reordered: false,
  sameCredentialReport: false,
  rules: [
    { ruleId: "AWS-NET-1", before: "risk", after: "unknown", change: "became-unknown", items: { before: distOf(["risk", "risk", "caution", "clear"]), after: distOf(["unknown", "clear"]) } },
    { ruleId: "AWS-KEY-1", before: "clear", after: "caution", change: "worse", items: { before: distOf(["clear", "clear"]), after: distOf(["caution", "clear"]) } },
    { ruleId: "AWS-STO-2", before: "risk", after: "caution", change: "better", items: { before: distOf(["risk", "clear"]), after: distOf(["caution", "clear"]) } },
    { ruleId: "AWS-STO-1", before: "unknown", after: "clear", change: "became-known", items: { before: distOf(["unknown"]), after: distOf(["clear"]) } },
    { ruleId: "AWS-MFA-1", before: "clear", after: "clear", change: "same", items: { before: distOf(["clear"]), after: distOf(["clear"]) } },
    { ruleId: "AWS-MFA-2", before: "na", after: "na", change: "same", items: { before: distOf([]), after: distOf([]) } },
  ],
};
/** 다른 계정이라 비교하지 않음 */
export const MOCK_COMPARISON_REFUSED: Comparison = {
  ok: false,
  reason: "different-account",
  before: side("2026-10-12T03:00:00Z"),
  after: side("2026-10-19T03:12:00Z", "9999"),
};
