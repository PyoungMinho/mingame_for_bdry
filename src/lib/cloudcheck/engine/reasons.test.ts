// 확인 불가 사유의 정렬과 해소법(Resolution) — 먼저 볼 3개의 묶음과 권한 안내가 이 표에서 나온다.
import { describe, expect, it } from "vitest";
import { AWS_CALLS, AZURE_CALLS } from "../contract/calls";
import type { ReceiptFact, ReceiptKey } from "../contract/normalized";
import type { UnknownReason } from "../model/report";
import { UNKNOWN_REASON_ORDER, callMeta, permissionOf, permissionsOfDenied, resolutionFor, resolutionKey, sortReasons } from "./reasons";

const ALL: readonly UnknownReason[] = Object.keys(UNKNOWN_REASON_ORDER) as UnknownReason[];

describe("사유 정렬", () => {
  it("21종이고 순서 번호가 0부터 빠짐없이 이어진다", () => {
    expect(ALL).toHaveLength(21);
    expect(Object.values(UNKNOWN_REASON_ORDER).sort((a, b) => a - b)).toEqual(Array.from({ length: 21 }, (_, i) => i));
  });
  it("중복을 없애고 정해진 순서(권한 → 오류 → … → 안내 전용)로 정렬한다", () => {
    expect(sortReasons(["guide-only", "denied", "truncated", "denied", "field-missing"])).toEqual(["denied", "truncated", "field-missing", "guide-only"]);
    expect(sortReasons([])).toEqual([]);
  });
  it("원본 배열을 바꾸지 않는다", () => {
    const xs: UnknownReason[] = ["truncated", "denied"];
    sortReasons(xs);
    expect(xs).toEqual(["truncated", "denied"]);
  });
});

describe("해소법", () => {
  it("권한 문제는 권한 이름이 있으면 permission, 없으면 다시 수집", () => {
    expect(resolutionFor("denied", { permissions: ["s3:ListAllMyBuckets"] })).toEqual({ kind: "permission", permissions: ["s3:ListAllMyBuckets"] });
    expect(resolutionFor("denied")).toEqual({ kind: "rerun", permissions: [] });
    expect(resolutionFor("region-missing", { permissions: ["ec2:DescribeRegions"] }).kind).toBe("permission");
    expect(resolutionFor("subscription-missing").kind).toBe("rerun");
  });
  it("일시적 문제와 파일 문제는 다시 수집", () => {
    for (const r of ["error", "throttled", "truncated", "budget-exceeded", "field-missing", "value-unrecognized", "schema-unsupported", "parse-failed", "stale-evidence", "population-mismatch", "clear-without-evidence"] as const) {
      expect(resolutionFor(r), r).toEqual({ kind: "rerun", permissions: [] });
    }
  });
  it("지원하지 않는 환경은 포털, 범위를 알 수 없는 CSV는 경로 안내, 안내 전용은 guide", () => {
    expect(resolutionFor("unsupported").kind).toBe("portal");
    for (const r of ["scope-unproven", "csv-scope-unproven", "csv-row-ambiguous"] as const) expect(resolutionFor(r).kind, r).toBe("path");
    for (const r of ["no-clear-rule", "guide-only"] as const) expect(resolutionFor(r).kind, r).toBe("guide");
  });
  it("수집하지 않은 문: 건너뛴 문은 다시 수집, 입력에 없는 문은 경로 안내", () => {
    expect(resolutionFor("not-collected", { doorState: "skipped" }).kind).toBe("rerun");
    expect(resolutionFor("not-collected", { doorState: "absent" }).kind).toBe("path");
    expect(resolutionFor("not-collected").kind).toBe("path");
  });
  it("21종 모두 해소법이 정해진다", () => {
    for (const r of ALL) expect(["permission", "rerun", "path", "portal", "guide"], r).toContain(resolutionFor(r).kind);
  });
  it("묶음 키는 해소법 종류와 정렬된 권한 이름", () => {
    expect(resolutionKey({ kind: "permission", permissions: ["b", "a"] })).toBe("permission:a,b");
    expect(resolutionKey({ kind: "rerun", permissions: [] })).toBe("rerun:");
  });
});

describe("호출 카탈로그 조회", () => {
  it("AWS · Azure 호출의 권한 이름을 찾는다", () => {
    expect(permissionOf("iam:GetCredentialReport")).toBe("iam:GetCredentialReport");
    expect(permissionOf("azure:storage.account.list")).toBe("Microsoft.Storage/storageAccounts/read");
    expect(permissionOf("sts:GetCallerIdentity")).toBeNull();
    expect(permissionOf("no:such")).toBeNull();
    expect(callMeta("no:such")).toBeUndefined();
  });
  it("모든 호출이 조회된다", () => {
    for (const c of [...Object.keys(AWS_CALLS), ...Object.keys(AZURE_CALLS)]) expect(callMeta(c), c).toBeDefined();
  });
  it("거부 영수증이 요구하는 권한만 중복 없이 정렬해 모은다", () => {
    const rc = (key: string, call: string, result: ReceiptFact["result"]): [ReceiptKey, ReceiptFact] => [key as ReceiptKey, { key, call, result } as unknown as ReceiptFact];
    const m = new Map<ReceiptKey, ReceiptFact>([rc("0:r-0001", "s3:ListAllMyBuckets", "denied"), rc("0:r-0002", "iam:ListUsers", "denied"), rc("0:r-0003", "s3:ListAllMyBuckets", "denied"), rc("0:r-0004", "ec2:DescribeRegions", "ok")]);
    expect(permissionsOfDenied(["0:r-0003", "0:r-0002", "0:r-0001", "0:r-0004", null, "0:r-9999" as ReceiptKey] as (ReceiptKey | null)[], m)).toEqual(["iam:ListUsers", "s3:ListAllMyBuckets"]);
  });
});
