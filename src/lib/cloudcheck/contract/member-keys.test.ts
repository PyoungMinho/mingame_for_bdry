// src/lib/cloudcheck/contract/member-keys.test.ts — FamilyCoverage.memberKeys(STEP 5 CC-QA-02·15): 봉인 규칙
// 완결인 패밀리만 구성원 신원 집합을 싣고, 중복이 있거나 개수가 모수와 다르면 미완결로 봉인한다. 싣지 않은 패밀리는 예전 모양 그대로다(추가만).
import { describe, expect, it } from "vitest";
import type { CoverageDraft } from "./normalized";
import { notCollectedCoverage, sealCoverage } from "./normalized";

const draft = (over: Partial<CoverageDraft<"aws.mfa.users">> = {}): CoverageDraft<"aws.mfa.users"> => ({
  family: "aws.mfa.users", input: 0, complete: true, population: 2, present: 2, expected: 2, gaps: [], receipts: [],
  unit: { kind: "account-global", covered: 1, total: 1 }, units: [], ...over,
});

describe("sealCoverage — memberKeys", () => {
  it("완결이면 정렬된 중복 없는 집합을 얼려서 싣는다", () => {
    const c = sealCoverage(draft({ memberKeys: ["jane.doe", "ci-deployer"] }));
    expect(c.complete).toBe(true);
    expect(c.memberKeys).toEqual(["ci-deployer", "jane.doe"]);
    expect(Object.isFrozen(c.memberKeys)).toBe(true);
  });
  it("싣지 않으면 속성 자체가 없다(예전 모양 그대로 — 기존 픽스처·비교가 깨지지 않는다)", () => {
    const c = sealCoverage(draft());
    expect("memberKeys" in c).toBe(false);
    expect("memberKeys" in notCollectedCoverage("aws.mfa.users")).toBe(false);
  });
  it("같은 신원이 두 번이면(개수는 맞아도) 미완결로 봉인한다 — population-mismatch", () => {
    const c = sealCoverage(draft({ memberKeys: ["jane.doe", "jane.doe"] }));
    expect(c).toMatchObject({ complete: false, population: null, gaps: ["population-mismatch"] });
    expect("memberKeys" in c).toBe(false);
  });
  it("집합 크기 ≠ 증명한 모수(present)이면 미완결로 봉인한다", () => {
    for (const keys of [["a"], ["a", "b", "c"], []]) {
      const c = sealCoverage(draft({ memberKeys: keys }));
      expect(c, JSON.stringify(keys)).toMatchObject({ complete: false, gaps: ["population-mismatch"] });
    }
  });
  it("문자열이 아닌 값이 섞이면 미완결로 봉인한다", () => {
    const c = sealCoverage(draft({ memberKeys: ["a", 7 as unknown as string] }));
    expect(c.complete).toBe(false);
  });
  it("미완결 초안에서는 집합을 버린다(증명하지 못한 모수의 신원을 싣지 않는다)", () => {
    const c = sealCoverage(draft({ complete: false, population: null, gaps: ["denied"], memberKeys: ["a", "b"] }));
    expect(c).toMatchObject({ complete: false, gaps: ["denied"] });
    expect("memberKeys" in c).toBe(false);
  });
  it("빈 모수(0명)도 빈 집합으로 증명된다", () => {
    const c = sealCoverage(draft({ population: 0, present: 0, expected: 0, memberKeys: [] }));
    expect(c).toMatchObject({ complete: true, population: 0 });
    expect(c.memberKeys).toEqual([]);
  });
  it("입력 배열을 바꾸지 않는다(복사본을 정렬한다)", () => {
    const keys = ["b", "a"];
    sealCoverage(draft({ memberKeys: keys }));
    expect(keys).toEqual(["b", "a"]);
  });
});
