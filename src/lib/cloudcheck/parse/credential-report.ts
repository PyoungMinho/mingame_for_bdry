// src/lib/cloudcheck/parse/credential-report.ts — IAM 자격증명 보고서 CSV 읽기 (방향서 §4-7)
// 경로 ①(콘솔 CSV)과 ②(수집기 JSON 안의 CSV 원문)가 같은 파서를 쓴다. 열은 위치가 아니라 헤더 이름으로 매핑한다(열이 늘어나도 견딘다).
// 행의 필드 수가 머리글과 다르면 그 행은 '모호한 행'이다: 추측해서 맞추지 않고, 이 출처의 범위 증명(scopeProven)을 false로 만든다.
import type { Instant } from "../contract/normalized";
import type { CsvTable } from "./csv";
import { parseInstant } from "./strict-time";

/** 필수 열: 하나라도 없으면 이 출처 전체가 field-missing */
export const REPORT_REQUIRED = [
  "user", "arn", "user_creation_time", "password_enabled", "password_last_used", "mfa_active",
  "access_key_1_active", "access_key_1_last_rotated", "access_key_1_last_used_date",
  "access_key_2_active", "access_key_2_last_rotated", "access_key_2_last_used_date",
] as const;
export const ROOT_USER = "<root_account>";

export interface ReportRow {
  /** 스프레드시트 행 번호(머리글 = 1) */
  readonly rowNumber: number;
  readonly user: string;
  readonly arn: string;
  /** 열 이름(소문자) → 값. 없는 열은 undefined */
  readonly get: (col: string) => string | undefined;
  /** 머리글 순서의 원본 칸(청소 단계가 칸마다 비밀 모양을 지울 때 쓴다) */
  readonly cells: readonly string[];
}
export interface ReportTable {
  readonly rows: readonly ReportRow[];
  readonly totalRows: number;
  /** 해석에 쓰지 못한 행 번호: 칸 수가 머리글과 다른 행 + 다른 계정(또는 계정을 알 수 없는 ARN)의 행. 이 출처의 범위 증명을 막는다 */
  readonly ambiguous: readonly number[];
  /** ambiguous 중 ARN의 계정이 이 보고서의 계정과 다른 행(다른 계정 행이 섞인 경우, CC-QA-10) */
  readonly foreign: readonly number[];
  readonly missingColumns: readonly string[];
  /** 머리글에 두 번 이상 나오는 열 이름(소문자). 값이 엇갈려도 첫 열만 읽게 되므로 출처가 모호하다 */
  readonly duplicateColumns: readonly string[];
  readonly hasAdditionalColumn: boolean;
  /** 열 이름(소문자) → 칸 위치 */
  readonly index: ReadonlyMap<string, number>;
  readonly root: ReportRow | null;
  /** 이 보고서의 12자리 계정 ID: 기대 계정이 주어지면 그것, 아니면 루트 행 ARN, 없으면 처음 읽히는 행의 ARN. 없으면 null */
  readonly accountId: string | null;
}

export function isCredentialReportHeader(header: readonly string[]): boolean {
  const h = new Set(header.map((x) => x.toLowerCase()));
  return h.has("user") && h.has("arn") && h.has("password_enabled");
}

const ARN_ACCOUNT = /^arn:aws[a-z-]*:iam::(\d{12}):/;
const accountOfArn = (arn: string): string | null => ARN_ACCOUNT.exec(arn)?.[1] ?? null;

/**
 * 보고서 표 읽기. expectedAccount가 있으면(수집기 JSON 안의 보고서: 신원의 계정) 그 계정의 행만 쓴다.
 * 없으면(콘솔 CSV) 루트 행(없으면 처음 읽히는 행)의 계정이 이 보고서의 계정이다. 다른 계정의 행은 사용자로 읽지 않고 모호한 행으로 센다(CC-QA-10)
 */
export function readCredentialReport(t: CsvTable, expectedAccount: string | null = null): ReportTable {
  const cols = t.header.map((h) => h.toLowerCase());
  const index = new Map<string, number>();
  const seen = new Set<string>();
  const dup = new Set<string>();
  cols.forEach((c, i) => { if (!index.has(c)) index.set(c, i); if (seen.has(c)) dup.add(c); seen.add(c); });
  const all: ReportRow[] = [];
  const ambiguous: number[] = [];
  t.rows.forEach((fields, k) => {
    const rowNumber = t.rowNumbers[k] ?? k + 2;
    if (fields.length !== cols.length) { ambiguous.push(rowNumber); return; }
    const get = (col: string): string | undefined => { const i = index.get(col); return i === undefined ? undefined : fields[i]; };
    all.push({ rowNumber, user: get("user") ?? "", arn: get("arn") ?? "", get, cells: fields });
  });
  let accountId: string | null = expectedAccount;
  if (accountId === null) accountId = accountOfArn((all.find((r) => r.user === ROOT_USER) ?? { arn: "" }).arn) ?? all.map((r) => accountOfArn(r.arn)).find((a) => a !== null) ?? null;
  const rows: ReportRow[] = [];
  const foreign: number[] = [];
  const users = new Set<string>();
  for (const r of all) {
    if (accountId !== null && accountOfArn(r.arn) !== accountId) { foreign.push(r.rowNumber); ambiguous.push(r.rowNumber); }
    else if (users.has(r.user)) ambiguous.push(r.rowNumber);          // 같은 사용자 행이 두 번: 뒤의 것은 쓰지 않는다(개수만 맞는 복제를 막는다, CC-QA-15)
    else { users.add(r.user); rows.push(r); }
  }
  ambiguous.sort((x, y) => x - y);
  return {
    rows, totalRows: t.rows.length, ambiguous, foreign,
    missingColumns: REPORT_REQUIRED.filter((c) => !index.has(c)),
    duplicateColumns: [...dup],
    hasAdditionalColumn: index.has("additional_credentials_info"), index,
    root: rows.find((r) => r.user === ROOT_USER) ?? null,
    accountId,
  };
}

/* ───────── 셀 해석 ───────── */
/** TRUE/FALSE(대소문자 무시)만 불리언. not_supported 등은 undefined(= 해석 불가) */
export function boolCell(s: string | undefined): boolean | undefined {
  if (s === undefined) return undefined;
  const v = s.trim().toLowerCase();
  return v === "true" ? true : v === "false" ? false : undefined;
}
export type TimeCell = { readonly kind: "time"; readonly at: Instant } | { readonly kind: "none" } | { readonly kind: "bad" };
/** none을 뜻하는 표기(N/A, no_information)를 허용하는 시각 셀. 그 밖의 문자열은 bad */
export function timeCell(s: string | undefined, noneTokens: readonly string[]): TimeCell {
  if (s === undefined) return { kind: "bad" };
  const v = s.trim();
  if (noneTokens.includes(v)) return { kind: "none" };
  const at = parseInstant(v);
  return at ? { kind: "time", at } : { kind: "bad" };
}
