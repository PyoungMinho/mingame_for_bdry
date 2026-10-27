// 리포트 수준 블록 — 먼저 볼 것(buildFirstLook) · 직접 볼 목록 · 알림 · 문별 집계를 합성 데이터로 확인한다 (회사 데이터 종단은 fixtures/e2e.test.ts)
import { describe, expect, it } from "vitest";
import type { Resolution, RuleId, RuleResult, Status } from "../model/report";
import { buildFirstLook } from "./blocks";
import { distributionOf } from "./run";

const mk = (ruleId: RuleId, priority: number, status: Status, resolution: Resolution = { kind: "rerun", permissions: [] }): RuleResult =>
  ({
    ruleId, cloud: "aws", door: "mfa", priority, items: [], distribution: distributionOf([]), labels: [], inputIndex: 0, status,
    why: { code: "x" }, gaps: ["denied"], asOf: null, coverage: { kind: "none", covered: null, total: null, proven: false, population: null }, resolution,
  }) as unknown as RuleResult;

describe("buildFirstLook", () => {
  it("위험 → 주의 순, 같으면 priority 순으로 앞에 서고 모자라면 확인 불가가 priority 순으로 채운다 (3개까지)", () => {
    const f = buildFirstLook([mk("AWS-KEY-1", 110, "caution"), mk("AWS-STO-2", 10, "unknown"), mk("AWS-MFA-1", 60, "risk"), mk("AWS-LOG-1", 160, "unknown")]);
    expect(f).toEqual({ mode: "findings", ruleIds: ["AWS-MFA-1", "AWS-KEY-1", "AWS-STO-2"] });
  });
  it("위험 · 주의가 3개를 넘으면 3개만, 확인 불가는 끼지 않는다", () => {
    const f = buildFirstLook([mk("AWS-STO-2", 10, "risk"), mk("AWS-NET-1", 30, "risk"), mk("AWS-KEY-4", 50, "risk"), mk("AWS-MFA-1", 60, "risk"), mk("AWS-KEY-3", 100, "caution"), mk("AWS-LOG-1", 160, "unknown")]);
    expect(f).toEqual({ mode: "findings", ruleIds: ["AWS-STO-2", "AWS-NET-1", "AWS-KEY-4"] });
  });
  it("위험 · 주의가 없고 확인 불가가 있으면 해소법이 같은 것끼리 묶고, 많이 푸는 묶음이 먼저다 (3묶음까지)", () => {
    const perm: Resolution = { kind: "permission", permissions: ["s3:ListAllMyBuckets"] };
    const f = buildFirstLook([
      mk("AWS-STO-2", 10, "unknown", perm), mk("AWS-STO-1", 140, "unknown", perm),
      mk("AWS-LOG-1", 160, "unknown", { kind: "rerun", permissions: [] }), mk("AWS-NET-1", 30, "unknown", { kind: "path", permissions: [] }),
      mk("AWS-MFA-1", 60, "unknown", { kind: "portal", permissions: [] }), mk("AWS-KEY-4", 50, "clear"),
    ]);
    expect(f.mode).toBe("unlock");
    if (f.mode !== "unlock") return;
    expect(f.groups).toHaveLength(3);
    expect(f.groups[0]).toEqual({ resolution: perm, ruleIds: ["AWS-STO-2", "AWS-STO-1"] });
    expect(f.groups.slice(1).map((g) => g.ruleIds)).toEqual([["AWS-NET-1"], ["AWS-MFA-1"]]);        // 같은 크기면 가장 앞선 priority의 묶음이 먼저
  });
  it("서로 다른 권한 집합은 다른 묶음이다", () => {
    const f = buildFirstLook([
      mk("AWS-STO-2", 10, "unknown", { kind: "permission", permissions: ["a"] }), mk("AWS-STO-1", 140, "unknown", { kind: "permission", permissions: ["b"] }),
    ]);
    expect(f.mode === "unlock" && f.groups.length).toBe(2);
  });
  it("전부 이상 없음 · 해당 없음이면 none-found, 룰이 없어도 none-found", () => {
    expect(buildFirstLook([mk("AWS-STO-2", 10, "clear"), mk("AWS-KEY-1", 110, "na")])).toEqual({ mode: "none-found" });
    expect(buildFirstLook([])).toEqual({ mode: "none-found" });
  });
});

describe("distributionOf", () => {
  it("상태별 개수와 합계", () => {
    expect(distributionOf(["risk", "risk", "caution", "unknown", "clear", "clear", "clear", "na"])).toEqual({ total: 8, risk: 2, caution: 1, unknown: 1, clear: 3, na: 1 });
    expect(distributionOf([])).toEqual({ total: 0, risk: 0, caution: 0, unknown: 0, clear: 0, na: 0 });
  });
});
