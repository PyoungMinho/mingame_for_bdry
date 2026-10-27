// 구성원 → 룰 집계 (INV-1 · 4 · 5 · 6 · 7). 룰은 상태를 직접 낼 수 없고 aggregate만 정한다.
import { describe, expect, it } from "vitest";
import type { NormalizedInput, ReceiptKey, Src } from "../contract/normalized";
import { resolveFixture } from "../fixtures/micro";
import { deny } from "../fixtures/mutate";
import { deepFreeze } from "../fixtures/invariants";
import { C, N, mCaution, mClear, mExcluded, mRisk, mUnknown, msg } from "../rules/kit";
import { RULES } from "../rules/registry";
import { aggregate } from "./aggregate";
import type { AggEnv } from "./aggregate";
import { coverageLookup, proveScope } from "./proof";
import type { Gap, Member, RuleOutcome, RuleSpec, ScopeProof } from "./types";

const base = RULES.find((m) => m.spec.ruleId === "AWS-STO-2")!.spec;
const spec = (over: Partial<RuleSpec> = {}): RuleSpec => ({ ...base, ...over });

const input: NormalizedInput = resolveFixture("micro/AWS-STO-2/pass");
const proof2 = proveScope(coverageLookup(input), "aws.sto.buckets", ["aws.sto.account"]) as ScopeProof;                       // 모수 2
const proof0 = proveScope(coverageLookup(resolveFixture("micro/AWS-STO-2/empty")), "aws.sto.buckets", ["aws.sto.account"]) as ScopeProof;   // 모수 0
const env = (over: Partial<AggEnv> = {}, i: NormalizedInput = input): AggEnv => ({ receipts: i.receipts, inputCount: i.inputs.length, hasAsOf: true, ...over });

const okKey = [...input.receipts.values()].find((r) => r.result === "ok")!.key;
const srcOf = (receipt: ReceiptKey | null): Src => ({ input: 0, receipt, csv: null });
const OK = [{ src: srcOf(okKey) }];
const res = (name: string) => ({ type: "s3-bucket" as const, name: { type: "resourceName" as const, value: name }, where: null, id: name });
const clear = (n: string): Member => mClear(res(n), msg("AWS-STO-2:not-public"), OK);
const outcome = (members: Member[], coverage: ScopeProof | Gap): RuleOutcome => ({ members, coverage });

describe("이상 없음 · 해당 없음은 증명이 있어야 한다 (INV-1)", () => {
  it("모든 구성원이 증거 있는 이상 없음이고 증명된 모수와 같으면 이상 없음", () => {
    const a = aggregate(spec(), outcome([clear("a"), clear("b")], proof2), env());
    expect(a).toMatchObject({ status: "clear", population: 2, applicable: 2, gaps: [] });
  });
  it("증명이 없으면(구멍) 구성원이 전부 이상 없음이어도 확인 불가이고 구멍 사유를 그대로 전한다", () => {
    const a = aggregate(spec(), outcome([clear("a"), clear("b")], { gaps: ["truncated"] }), env());
    expect(a.status).toBe("unknown");
    expect(a.gaps).toEqual(["truncated"]);
    expect(a.proof).toBeNull();
    expect(a.population).toBeNull();
  });
  it("위조한 증명(모양만 같은 객체)은 증명이 아니다: 크래시 없이 확인 불가", () => {
    const forged = { ...proof2 } as unknown as ScopeProof;
    const a = aggregate(spec(), outcome([clear("a"), clear("b")], forged), env());
    expect(a.status).toBe("unknown");
    expect(a.proof).toBeNull();
    expect(a.gaps).toEqual(["scope-unproven"]);
  });
  it("구멍도 증명도 아닌 값(null · 문자열 · 빈 객체)을 줘도 던지지 않고 확인 불가", () => {
    for (const junk of [null, undefined, "ok", 42, {}, { gaps: "x" }, []]) {
      const a = aggregate(spec(), outcome([clear("a"), clear("b")], junk as never), env());
      expect(a.status, JSON.stringify(junk)).toBe("unknown");
    }
  });
  it("구성원 수가 증명된 모수와 다르면 population-mismatch", () => {
    expect(aggregate(spec(), outcome([clear("a")], proof2), env())).toMatchObject({ status: "unknown", gaps: ["population-mismatch"] });
    expect(aggregate(spec(), outcome([clear("a"), clear("b"), clear("c")], proof2), env())).toMatchObject({ status: "unknown", gaps: ["population-mismatch"] });
  });
  it("기준 시각이 없으면 없음을 말하지 않는다 (field-missing)", () => {
    expect(aggregate(spec(), outcome([clear("a"), clear("b")], proof2), env({ hasAsOf: false }))).toMatchObject({ status: "unknown", gaps: ["field-missing"] });
    expect(aggregate(spec(), outcome([], proof0), env({ hasAsOf: false }, resolveFixture("micro/AWS-STO-2/empty")))).toMatchObject({ status: "unknown", gaps: ["field-missing"] });
  });
  it("하나라도 확인 불가인 구성원이 있으면 룰은 확인 불가 (사유는 구성원의 것)", () => {
    const a = aggregate(spec(), outcome([clear("a"), mUnknown(res("b"), "denied", OK)], proof2), env());
    expect(a).toMatchObject({ status: "unknown", gaps: ["denied"] });
  });
});

describe("증거 없는 이상 없음은 강등된다 (clear-without-evidence)", () => {
  it("증거가 비어 있으면", () => {
    const a = aggregate(spec(), outcome([mClear(res("a"), msg("AWS-STO-2:not-public"), []), clear("b")], proof2), env());
    expect(a.status).toBe("unknown");
    expect(a.gaps).toEqual(["clear-without-evidence"]);
    expect(a.members.find((m) => m.res.id === "a")?.s).toBe("unknown");
  });
  it("증거의 영수증이 거부 · 오류 · 잘림이면 답이 아니다", () => {
    const denied = deny(input, "s3:ListAllMyBuckets");
    const k = [...denied.receipts.values()].find((r) => r.result === "denied")!.key;
    const a = aggregate(spec(), outcome([mClear(res("a"), msg("AWS-STO-2:not-public"), [{ src: srcOf(k) }]), clear("b")], proof2), env({}, denied));
    expect(a).toMatchObject({ status: "unknown", gaps: ["clear-without-evidence"] });
  });
  it("영수증이 없는 키 · 입력 번호가 범위 밖인 출처 · 출처가 하나도 없는 출처는 답이 아니다", () => {
    for (const bad of [srcOf("0:r-9999" as ReceiptKey), { input: 7, receipt: okKey, csv: null }, { input: -1, receipt: okKey, csv: null }, { input: 0, receipt: null, csv: null }]) {
      const a = aggregate(spec(), outcome([mClear(res("a"), msg("AWS-STO-2:not-public"), [{ src: bad }]), clear("b")], proof2), env());
      expect(a.status, JSON.stringify(bad)).toBe("unknown");
    }
  });
  it("CSV 칸이 출처면 답이다", () => {
    const csv: Src = { input: 0, receipt: null, csv: { kind: "csv-credential-report", row: 3, column: "mfa_active" } };
    const a = aggregate(spec(), outcome([mClear(res("a"), msg("AWS-STO-2:not-public"), [{ src: csv }]), clear("b")], proof2), env());
    expect(a.status).toBe("clear");
  });
  it("제외(excluded)도 증거가 답이어야 하고 아니면 확인 불가로 강등된다", () => {
    const a = aggregate(spec(), outcome([mExcluded(res("a"), msg("AWS-STO-2:not-public"), []), clear("b")], proof2), env());
    expect(a).toMatchObject({ status: "unknown", gaps: ["clear-without-evidence"] });
  });
});

describe("해당 없음 (INV-5)", () => {
  const i0 = resolveFixture("micro/AWS-STO-2/empty");
  it("증명된 모수 0이면 해당 없음 (구성원 없음)", () => {
    expect(aggregate(spec(), outcome([], proof0), env({}, i0))).toMatchObject({ status: "na", population: 0, applicable: 0 });
  });
  it("모수가 있어도 전원이 제외면 적용 대상 0 → 해당 없음", () => {
    const a = aggregate(spec(), outcome([mExcluded(res("a"), msg("AWS-STO-2:not-public"), OK), mExcluded(res("b"), msg("AWS-STO-2:not-public"), OK)], proof2), env());
    expect(a).toMatchObject({ status: "na", population: 2, applicable: 0 });
    expect(a.members).toEqual([]);
    expect(a.excluded).toHaveLength(2);
  });
  it("일부만 제외면 적용 대상 = 모수 − 제외, 이상 없음", () => {
    const a = aggregate(spec(), outcome([mExcluded(res("a"), msg("AWS-STO-2:not-public"), OK), clear("b")], proof2), env());
    expect(a).toMatchObject({ status: "clear", population: 2, applicable: 1 });
  });
  it("증명 없는 빈 목록은 해당 없음이 아니라 확인 불가다", () => {
    expect(aggregate(spec(), outcome([], { gaps: ["not-collected"] }), env()).status).toBe("unknown");
    expect(aggregate(spec(), outcome([], { gaps: [] }), env()).gaps).toEqual(["scope-unproven"]);
  });
  it("이상 없음을 줄 수 없는 룰은 적용 대상이 남으면 확인 불가(no-clear-rule), 0이면 해당 없음", () => {
    const noClear = spec({ allowsClear: false });
    expect(aggregate(noClear, outcome([clear("a"), clear("b")], proof2), env())).toMatchObject({ status: "unknown", gaps: ["no-clear-rule"] });
    const allExcluded = aggregate(noClear, outcome([mExcluded(res("a"), msg("AWS-STO-2:x"), OK), mExcluded(res("b"), msg("AWS-STO-2:x"), OK)], proof2), env());
    expect(allExcluded.status).toBe("na");
  });
});

describe("양성은 부분 데이터에서도 유지된다 (INV-4)", () => {
  it("구멍이 있어도 위험이 하나라도 있으면 위험", () => {
    const a = aggregate(spec(), outcome([mRisk(res("a"), msg("AWS-STO-2:bucket-public-policy"), OK), mUnknown(res("b"), "denied", OK)], { gaps: ["truncated"] }), env());
    expect(a).toMatchObject({ status: "risk", applicable: null });
  });
  it("위험과 주의가 섞이면 위험, 주의만이면 주의", () => {
    const risk = mRisk(res("a"), msg("AWS-STO-2:bucket-public-policy"), OK);
    const caution = mCaution(res("b"), msg("AWS-STO-2:website-public"), OK);
    expect(aggregate(spec(), outcome([caution, risk], proof2), env()).status).toBe("risk");
    expect(aggregate(spec(), outcome([caution, clear("a")], proof2), env()).status).toBe("caution");
  });
  it("룰의 최고 상태가 주의면 위험 구성원은 주의로 내려간다", () => {
    const a = aggregate(spec({ maxStatus: "caution" }), outcome([mRisk(res("a"), msg("AWS-STO-2:bucket-public-policy"), OK), clear("b")], proof2), env());
    expect(a.status).toBe("caution");
    expect(a.members.find((m) => m.res.id === "a")?.s).toBe("caution");
  });
  it("확인 불가 고정 룰(가이드)은 어떤 구성원이 와도 guide-only", () => {
    const g = spec({ maxStatus: "unknown", allowsClear: false });
    expect(aggregate(g, outcome([mRisk(res("a"), msg("AWS-STO-2:bucket-public-policy"), OK)], proof2), env())).toMatchObject({ status: "unknown", gaps: ["guide-only"] });
    expect(aggregate(g, outcome([], proof0), env())).toMatchObject({ status: "unknown", gaps: ["guide-only"] });
  });
});

describe("일부 대상만 조회가 거부되면 주의로 올린다 (INV-7)", () => {
  const withIsolation = (over: Partial<RuleSpec> = {}) => spec({ isolatedDenial: { calls: ["s3:GetBucketPolicyStatus"] }, ...over });
  const denied = deny(input, "s3:GetBucketPolicyStatus", { resource: "amzn-s3-demo-bucket-data" });
  const deniedKey = [...denied.receipts.values()].find((r) => r.result === "denied")!.key;
  const deniedMember = mUnknown(res("amzn-s3-demo-bucket-data"), "denied", [{ src: srcOf(deniedKey) }]);

  it("같은 호출이 다른 대상에서는 성공했다면 주의(isolated-denial)", () => {
    const a = aggregate(withIsolation(), outcome([deniedMember, clear("amzn-s3-demo-bucket-logs")], proof2), env({}, denied));
    expect(a.status).toBe("caution");
    expect(a.members.find((m) => m.res.id === "amzn-s3-demo-bucket-data")).toMatchObject({ s: "caution", why: { code: "isolated-denial" } });
  });
  it("모든 대상에서 거부됐다면(성공한 곳이 없으면) 주의가 아니라 확인 불가", () => {
    const all = deny(denied, "s3:GetBucketPolicyStatus", { resource: "amzn-s3-demo-bucket-logs" });
    const k2 = [...all.receipts.values()].filter((r) => r.result === "denied").map((r) => r.key);
    const a = aggregate(withIsolation(), outcome([
      mUnknown(res("amzn-s3-demo-bucket-data"), "denied", [{ src: srcOf(k2[0]) }]), mUnknown(res("amzn-s3-demo-bucket-logs"), "denied", [{ src: srcOf(k2[1]) }]),
    ], proof2), env({}, all));
    expect(a.status).toBe("unknown");
    expect(a.gaps).toEqual(["denied"]);
  });
  it("룰이 부분 거부 승격을 선언하지 않았으면 올리지 않는다", () => {
    const a = aggregate(spec({ isolatedDenial: null }), outcome([deniedMember, clear("amzn-s3-demo-bucket-logs")], proof2), env({}, denied));
    expect(a.status).toBe("unknown");
  });
  it("거부가 아닌 확인 불가(잘림 등)는 올리지 않는다", () => {
    const a = aggregate(withIsolation(), outcome([mUnknown(res("amzn-s3-demo-bucket-data"), "truncated", [{ src: srcOf(deniedKey) }]), clear("amzn-s3-demo-bucket-logs")], proof2), env({}, denied));
    expect(a.status).toBe("unknown");
  });
});

describe("순수성", () => {
  it("입력(구성원 · 결과 · 환경)을 바꾸지 않는다: 얼려 둔 입력에서도 같은 결과", () => {
    const members = deepFreeze([clear("a"), mRisk(res("b"), msg("AWS-STO-2:bucket-public-policy"), OK, { facts: [msg("fact:block-off", { x: N(1), y: C("z") })] })]);
    const o = deepFreeze(outcome(members, proof2));
    const a1 = aggregate(spec(), o, env());
    const a2 = aggregate(spec(), o, env());
    expect(JSON.stringify(a1)).toBe(JSON.stringify(a2));
  });
});
