// src/lib/cloudcheck/engine/reasons.ts — 확인 불가 사유의 정렬 순서, 해소법(Resolution) 계산, 호출 카탈로그 조회
import { AWS_CALLS, AZURE_CALLS } from "../contract/calls";
import type { CallMeta } from "../contract/calls";
import type { ReceiptFact, ReceiptKey } from "../contract/normalized";
import type { Resolution, UnknownReason } from "../model/report";

/** 사유 정렬 순서(작을수록 먼저). 모델의 UnknownReason 선언 순서와 같다. 새 사유가 생기면 컴파일 오류가 난다 */
export const UNKNOWN_REASON_ORDER = {
  denied: 0, error: 1, throttled: 2, truncated: 3, unsupported: 4, "budget-exceeded": 5,
  "region-missing": 6, "subscription-missing": 7, "scope-unproven": 8, "csv-scope-unproven": 9, "csv-row-ambiguous": 10,
  "field-missing": 11, "value-unrecognized": 12, "schema-unsupported": 13, "parse-failed": 14, "not-collected": 15,
  "stale-evidence": 16, "population-mismatch": 17, "clear-without-evidence": 18, "no-clear-rule": 19, "guide-only": 20,
} as const satisfies Record<UnknownReason, number>;

/** 중복을 없애고 UNKNOWN_REASON_ORDER 순으로 정렬한 사본 */
export function sortReasons(reasons: readonly UnknownReason[]): UnknownReason[] {
  return [...new Set(reasons)].sort((a, b) => UNKNOWN_REASON_ORDER[a] - UNKNOWN_REASON_ORDER[b]);
}

const AWS_META: Readonly<Record<string, CallMeta>> = AWS_CALLS;
const AZURE_META: Readonly<Record<string, CallMeta>> = AZURE_CALLS;
export const callMeta = (call: string): CallMeta | undefined => AWS_META[call] ?? AZURE_META[call];
export const permissionOf = (call: string): string | null => callMeta(call)?.permission ?? null;

/** 거부(denied) 영수증들이 요구하는 권한 이름(중복 없이 정렬) */
export function permissionsOfDenied(keys: readonly (ReceiptKey | null)[], receipts: ReadonlyMap<ReceiptKey, ReceiptFact>): string[] {
  const out = new Set<string>();
  for (const k of keys) {
    if (k === null) continue;
    const r = receipts.get(k);
    if (r === undefined || r.result !== "denied") continue;
    const p = permissionOf(r.call);
    if (p !== null) out.add(p);
  }
  return [...out].sort();
}

/**
 * 해소법. 권한이면 요청할 권한 이름을 싣는다. 거부 영수증을 못 찾으면 다시 수집으로 안내한다.
 * not-collected는 문을 --doors로 건너뛴 경우(skipped)에는 다시 수집, 입력에 그 문이 없는 경우(그 밖)에는 경로 안내다.
 */
export function resolutionFor(reason: UnknownReason, o: { readonly permissions?: readonly string[]; readonly doorState?: "skipped" | "absent" | "selected" } = {}): Resolution {
  const perms = o.permissions ?? [];
  switch (reason) {
    case "denied":
    case "region-missing":
    case "subscription-missing":
      return perms.length > 0 ? { kind: "permission", permissions: [...perms] } : { kind: "rerun", permissions: [] };
    case "error":
    case "throttled":
    case "truncated":
    case "budget-exceeded":
    case "field-missing":
    case "value-unrecognized":
    case "schema-unsupported":
    case "parse-failed":
    case "stale-evidence":
    case "population-mismatch":
    case "clear-without-evidence":
      return { kind: "rerun", permissions: [] };
    case "unsupported":
      return { kind: "portal", permissions: [] };
    case "scope-unproven":
    case "csv-scope-unproven":
    case "csv-row-ambiguous":
      return { kind: "path", permissions: [] };
    case "not-collected":
      return o.doorState === "skipped" ? { kind: "rerun", permissions: [] } : { kind: "path", permissions: [] };
    case "no-clear-rule":
    case "guide-only":
      return { kind: "guide", permissions: [] };
  }
}

/** 두 해소법이 같은가(먼저 볼 3개의 묶음 키) */
export const resolutionKey = (r: Resolution): string => `${r.kind}:${[...r.permissions].sort().join(",")}`;
