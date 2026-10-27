// ScopeProof — '없음'을 말할 자격은 봉인된 완결 범위에서만 나온다. 위조·손상·미봉인 입력은 크래시 없이 구멍(Gap)이 된다.
import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { resolveFixture } from "../fixtures/micro";
import { deny, truncate } from "../fixtures/mutate";
import { coverageLookup, gapsOf, isGenuineProof, isSoundComplete, proveScope, unitForReport } from "./proof";
import type { Gap, ScopeProof } from "./types";

const isGap = (x: ScopeProof | Gap): x is Gap => "gaps" in x;

describe("proveScope", () => {
  const input = resolveFixture("micro/AWS-STO-2/pass");
  const table = coverageLookup(input);

  it("선언한 패밀리가 모두 완결이면 진짜 증명을 낸다 (모수 · 출처 입력 · 단위가 봉인 값 그대로)", () => {
    const p = proveScope(table, "aws.sto.buckets", ["aws.sto.account"]);
    expect(isGap(p)).toBe(false);
    expect(isGenuineProof(p)).toBe(true);
    const proof = p as ScopeProof;
    expect(proof.population).toBe(2);
    expect(proof.itemFamily).toBe("aws.sto.buckets");
    expect(proof.families).toEqual(["aws.sto.buckets", "aws.sto.account"]);
    expect(proof.unit).toEqual({ kind: "account-global", covered: 1, total: 1 });
    expect(Object.isFrozen(proof)).toBe(true);
    expect(proof.receipts.length).toBeGreaterThan(0);
    expect(new Set(proof.receipts).size).toBe(proof.receipts.length);
  });

  it("같은 입력이면 같은 증명 내용이다 (결정적)", () => {
    const a = proveScope(table, "aws.sto.buckets", ["aws.sto.account"]) as ScopeProof;
    const b = proveScope(table, "aws.sto.buckets", ["aws.sto.account"]) as ScopeProof;
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
    expect(a).not.toBe(b);
  });

  it("필요한 패밀리 하나라도 미완결이면 구멍이다 (거부 · 잘림)", () => {
    const denied = coverageLookup(deny(input, "s3:ListAllMyBuckets"));
    const g1 = proveScope(denied, "aws.sto.buckets", ["aws.sto.account"]);
    expect(isGap(g1) && g1.gaps.length > 0).toBe(true);
    const cut = coverageLookup(truncate(input, "s3:ListAllMyBuckets"));
    const g2 = proveScope(cut, "aws.sto.buckets", ["aws.sto.account"]);
    expect(isGap(g2) && g2.gaps).toContain("truncated");
    expect(isGenuineProof(g2)).toBe(false);
  });

  it("없는 패밀리 · 손상된 항목 · 봉인되지 않은 사본은 증명하지 못한다", () => {
    expect(isGap(proveScope({}, "aws.sto.buckets", []))).toBe(true);
    const unsealed = { ...table, "aws.sto.buckets": structuredClone(table["aws.sto.buckets"]) };
    const g = proveScope(unsealed, "aws.sto.buckets", []);
    expect(isGap(g)).toBe(true);
    expect(isSoundComplete(unsealed["aws.sto.buckets"], "aws.sto.buckets")).toBe(false);
    const wrongFamily = { ...table, "aws.sto.buckets": table["aws.sto.account"] };
    expect(isGap(proveScope(wrongFamily, "aws.sto.buckets", []))).toBe(true);
  });

  it("구멍의 사유는 중복 없이 모이고 비어 있지 않다", () => {
    const g = proveScope({}, "aws.sto.buckets", ["aws.sto.account"]) as Gap;
    expect(g.gaps.length).toBeGreaterThan(0);
    expect(new Set(g.gaps).size).toBe(g.gaps.length);
  });

  it("속성: 어떤 쓰레기 표를 받아도 던지지 않고 증명을 내지 않는다", () => {
    fc.assert(fc.property(fc.anything(), (junk) => {
      const r = proveScope(junk as never, "aws.sto.buckets", ["aws.sto.account"]);
      expect(isGenuineProof(r)).toBe(false);
    }), { numRuns: 200, seed: 20261019 });
  });
});

describe("isGenuineProof", () => {
  it("모양이 같은 객체 · 복사본 · 원시값은 진짜가 아니다", () => {
    const input = resolveFixture("micro/AWS-STO-2/pass");
    const p = proveScope(coverageLookup(input), "aws.sto.buckets", []) as ScopeProof;
    expect(isGenuineProof(p)).toBe(true);
    expect(isGenuineProof({ ...p })).toBe(false);
    expect(isGenuineProof(structuredClone(p))).toBe(false);
    expect(isGenuineProof(JSON.parse(JSON.stringify(p)))).toBe(false);
    for (const x of [null, undefined, 0, "proof", [], {}, { gaps: [] }]) expect(isGenuineProof(x)).toBe(false);
  });
});

describe("gapsOf · unitForReport", () => {
  it("coverage가 없거나 손상이면 not-collected / scope-unproven", () => {
    expect(gapsOf(undefined)).toEqual(["not-collected"]);
    expect(gapsOf(null)).toEqual(["not-collected"]);
    expect(gapsOf({})).toEqual(["scope-unproven"]);
    expect(gapsOf({ gaps: ["truncated", "denied"] })).toEqual(["truncated", "denied"]);
  });
  it("증명이 없을 때 쓸 단위: 미완결인 첫 패밀리의 단위, 없으면 아이템 패밀리의 단위", () => {
    const input = resolveFixture("micro/AWS-NET-1/pass");
    const table = coverageLookup(input);
    expect(unitForReport(table, "aws.net.security-groups", ["aws.net.enis"]).kind).toBe("regions");
    expect(unitForReport({}, "aws.net.security-groups", [])).toEqual({ kind: "none", covered: null, total: null });
  });
});
