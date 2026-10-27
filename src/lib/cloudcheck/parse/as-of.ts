// src/lib/cloudcheck/parse/as-of.ts — 기준 시각(asOf) 후보 고르기 + 증거 시각 (STEP 5 CC-QA-01)
// 기준 시각은 사용자 기기가 정한 값(파일 이름 시각 · 파일 수정 시각 · 수집기를 돌린 기기의 시계)이라 틀릴 수 있다. 틀린 값이 증거보다 이르면 나이가 짧게 나와 '근거 없는 이상 없음'이 된다.
// parse가 하는 일:
//  ① 2000-01-01보다 이른 후보(파일 시각 0 = 1970, FAT·ZIP의 1980 …)는 '시각 없음'과 같은 값이라 버린다 → asOf null + asOfRejected 기록
//  ② 입력 안의 가장 늦은 증거 시각(latestEvidence)을 알려 준다. asOf를 그 값으로 끌어올리지는 않는다 — 올리면 마지막 사용이 '방금'으로 보여 시각 역전이 가려진다.
//    역전(증거 > 기준 + 5분)을 보고 확인 불가로 만드는 일은 룰(rules/kit ageMs·reversedIn)이 한다.
import type { AsOfFact, AsOfRejected, Instant } from "../contract/normalized";
import { timeCell } from "./credential-report";
import type { ReportTable } from "./credential-report";
import type { RgTable } from "./rg-csv";
import { parseInstant } from "./strict-time";

/** 2000-01-01T00:00:00Z. 이보다 이른 기준 시각 후보는 믿지 않는다 */
export const MIN_PLAUSIBLE_AS_OF_MS = 946_684_800_000;

export interface AsOfDecision { readonly asOf: AsOfFact | null; readonly rejected?: AsOfRejected }
/** 우선순위대로 준 후보 중 믿을 수 있는 첫 번째를 고른다. 후보가 있었지만 모두 믿을 수 없으면 null + 첫 후보를 버린 기록 */
export function chooseAsOf(candidates: readonly (AsOfFact | null)[]): AsOfDecision {
  const present = candidates.filter((c): c is AsOfFact => c !== null);
  const good = present.find((c) => c.at.ms >= MIN_PLAUSIBLE_AS_OF_MS);
  if (good !== undefined) return { asOf: good };
  if (present.length > 0) return { asOf: null, rejected: { candidate: present[0], why: "early-implausible" } };
  return { asOf: null };
}

/** 가장 늦은 시각(없으면 null) */
export function latestOf(times: readonly (Instant | null | undefined)[]): Instant | null {
  let best: Instant | null = null;
  for (const t of times) if (t && (best === null || t.ms > best.ms)) best = t;
  return best;
}

/** 자격증명 보고서의 증거 시각 열: 생성·비밀번호 변경·마지막 사용·키/인증서 회전·키 마지막 사용. password_next_rotation은 미래 날짜라 뺀다 */
const REPORT_TIME_COLUMNS = [
  "user_creation_time", "password_last_used", "password_last_changed",
  "access_key_1_last_rotated", "access_key_1_last_used_date", "access_key_2_last_rotated", "access_key_2_last_used_date", "cert_1_last_rotated", "cert_2_last_rotated",
] as const;
export function reportLatestEvidence(t: ReportTable): Instant | null {
  const times: Instant[] = [];
  for (const row of t.rows) for (const col of REPORT_TIME_COLUMNS) {
    const c = timeCell(row.get(col), ["N/A", "no_information"]);
    if (c.kind === "time") times.push(c.at);
  }
  return latestOf(times);
}

/** Resource Graph 저장소 CSV의 키 생성 시각 */
export function rgLatestEvidence(t: RgTable): Instant | null {
  if (t.kind !== "csv-rg-storage") return null;
  const times: Instant[] = [];
  for (const row of t.rows) for (const col of ["key1CreationTime", "key2CreationTime"]) {
    const p = parseInstant(row.get(col));
    if (p) times.push(p);
  }
  return latestOf(times);
}
