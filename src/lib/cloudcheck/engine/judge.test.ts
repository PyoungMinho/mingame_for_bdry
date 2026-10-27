// judge(input): Report — 순수 · 예외 없음 · fail-closed · 증거를 줄이면 절대 좋아지지 않는다(INV-3).
import fc from "fast-check";
import { describe, expect, it } from "vitest";
import type { NormalizedInput } from "../contract/normalized";
import { checkInvariants, deepFreeze } from "../fixtures/invariants";
import { MICRO, resolveFixture } from "../fixtures/micro";
import { bumpSchema, deny, dropField, evidenceRemovingMutations, removeUnit, truncate } from "../fixtures/mutate";
import type { Mutation } from "../fixtures/mutate";
import { checkReport } from "../fixtures/report-invariants";
import { DOORS, REPORT_MODEL } from "../model/report";
import type { Report, RuleResult, Status } from "../model/report";
import { mClear, msg } from "../rules/kit";
import { RULES } from "../rules/registry";
import { RULESET_VERSION } from "../rules/version";
import { ENGINE_VERSION, failClosedReport, judge } from "./judge";
import { createDisplay } from "./display";
import { coverageLookup } from "./proof";
import { runRule } from "./run";
import type { BuildCtx } from "./items";
import type { RuleModule } from "./types";

const ruleOf = (r: Report, id: string): RuleResult => r.doors.flatMap((d) => d.rules).find((x) => x.ruleId === id) as RuleResult;
const ALL_REFS = Object.entries(MICRO).flatMap(([rule, table]) => Object.keys(table).map((n) => `micro/${rule}/${n}`));

describe("Report 기본 모양", () => {
  it("모델 버전 · 엔진 버전 · 룰셋 버전이 실리고 AWS 입력에는 AWS 룰 10장만 나온다", () => {
    const r = judge(resolveFixture("micro/AWS-MFA-2/pass"));
    expect(r.model).toBe(REPORT_MODEL);
    expect(r.engine).toEqual({ version: ENGINE_VERSION, rulesetVersion: RULESET_VERSION });
    const ids = r.doors.flatMap((d) => d.rules.map((x) => x.ruleId)).sort();
    expect(ids).toEqual(RULES.filter((m) => m.spec.cloud === "aws").map((m) => m.spec.ruleId).sort());
    expect(r.doors.map((d) => d.door)).toEqual([...DOORS]);
  });
  it("Azure 입력에는 출시된 Azure 룰 7장만 나온다 (AZ-MFA-1은 편입 전)", () => {
    const r = judge(resolveFixture("micro/AZ-STO-1/pass"));
    const ids = r.doors.flatMap((d) => d.rules.map((x) => x.ruleId));
    expect(ids).toHaveLength(7);
    expect(ids).not.toContain("AZ-MFA-1");
    expect(ids).toContain("AZ-MFA-G");
  });
  it("모든 micro 픽스처의 Report가 불변식을 지킨다", () => {
    for (const ref of ALL_REFS) expect(checkReport(judge(resolveFixture(ref))), ref).toEqual([]);
  });
  it("수집하지 않은 문의 룰은 확인 불가(not-collected)이고 영역 하나로 직접 볼 목록에 오른다", () => {
    const r = judge(resolveFixture("micro/AWS-STO-1/pass"));
    const mfa = ruleOf(r, "AWS-MFA-1");
    expect(mfa.status).toBe("unknown");
    expect(mfa.why.code).toBe("not-collected");
    expect(r.manualChecklist.filter((m) => m.origin === "out-of-scope").map((m) => m.door)).toEqual(["mfa", "key", "net", "log"]);
  });
});

describe("순수성 (INV-9)", () => {
  it("같은 입력을 두 번 판정하면 바이트 단위로 같다", () => {
    for (const ref of ALL_REFS) {
      const input = resolveFixture(ref);
      expect(JSON.stringify(judge(input)), ref).toBe(JSON.stringify(judge(input)));
    }
  });
  it("같은 내용의 새 입력(깊은 복사)이면 같은 Report다 — 객체 동일성 · 순회 순서에 기대지 않는다", () => {
    for (const ref of ["micro/AWS-KEY-1/old-key", "micro/AWS-NET-1/other-region", "micro/AZ-STO-2/public-container"]) {
      const a = resolveFixture(ref);
      const b = deepFreeze(structuredClone(a));
      expect(JSON.stringify(judge(b)), ref).toBe(JSON.stringify(judge(a)));
    }
  });
  it("얼린 입력을 건드리지 않는다 (판정 전후 입력이 같다)", () => {
    for (const ref of ALL_REFS) {
      const input = deepFreeze(structuredClone(resolveFixture(ref)));
      const before = JSON.stringify(input, (_k, v: unknown) => (v instanceof Map ? [...v.entries()] : v));
      judge(input);
      expect(JSON.stringify(input, (_k, v: unknown) => (v instanceof Map ? [...v.entries()] : v)), ref).toBe(before);
    }
  });
  it("판정이 시계 · 난수에 기대지 않는다: 전역 Date · Math.random이 막혀 있어도 같은 결과", () => {
    const input = resolveFixture("micro/AWS-KEY-2/unused-key");
    const expected = JSON.stringify(judge(input));
    const realDate = globalThis.Date;
    const realRandom = Math.random;
    try {
      globalThis.Date = new Proxy(realDate, { construct: () => { throw new Error("Date 사용 금지"); }, get: (t, p) => { if (p === "now") throw new Error("Date.now 사용 금지"); return Reflect.get(t, p); } });
      Math.random = () => { throw new Error("Math.random 사용 금지"); };
      expect(JSON.stringify(judge(input))).toBe(expected);
    } finally {
      globalThis.Date = realDate;
      Math.random = realRandom;
    }
  });
});

describe("실패해도 던지지 않고 '없음'을 만들지 않는다 (INV-1 · INV-2)", () => {
  const garbage: unknown[] = [null, undefined, 0, "x", [], {}, { cloud: "gcp" }, { cloud: "aws" }, { cloud: "azure", doors: null }, { cloud: "aws", doors: {}, coverage: {}, inputs: [] }];
  it("엉뚱한 입력은 전부 확인 불가 + 배너 Report가 된다", () => {
    for (const g of garbage) {
      const r = judge(g as NormalizedInput);
      expect(checkReport(r), JSON.stringify(g)).toEqual([]);
      const rules = r.doors.flatMap((d) => d.rules);
      expect(rules.length).toBeGreaterThan(0);
      expect(rules.every((x) => x.status === "unknown"), JSON.stringify(g)).toBe(true);
      expect(r.banners.some((b) => b.kind === "areas-not-judged")).toBe(true);
    }
  });
  it("속성에 닿으면 던지는 입력(Proxy)도 안전망 Report가 된다", () => {
    const bomb = new Proxy({}, { get: () => { throw new Error("접근 금지"); }, has: () => { throw new Error("접근 금지"); }, ownKeys: () => { throw new Error("접근 금지"); } });
    const r = judge(bomb as unknown as NormalizedInput);
    expect(r.doors.flatMap((d) => d.rules).every((x) => x.status === "unknown" && x.why.code === "parse-failed")).toBe(true);
  });
  it("안전망 Report는 불변식을 지키고 먼저 볼 것은 해소법 묶음이며 문마다 직접 확인을 안내한다", () => {
    const r = failClosedReport({ cloud: "azure", mode: { kind: "demo", setId: "A" } });
    expect(checkReport(r)).toEqual([]);
    expect(r.identity.cloud).toBe("azure");
    expect(r.mode).toEqual({ kind: "demo", setId: "A" });
    expect(r.firstLook.mode).toBe("unlock");
    expect(r.manualChecklist).toHaveLength(DOORS.length);
    expect(r.doors.every((d) => d.worstStatus === "unknown" && d.collection.status === "not-collected")).toBe(true);
    expect(failClosedReport(null).identity.cloud).toBe("aws");
  });
  it("룰 하나의 판정 함수가 던지면 그 룰만 확인 불가(parse-failed)이고 나머지 룰은 그대로다", () => {
    const input = resolveFixture("micro/AWS-STO-2/public-policy");
    const broken: RuleModule = { ...RULES.find((m) => m.spec.ruleId === "AWS-STO-2")!, evaluate: () => { throw new Error("boom"); } };
    const build: BuildCtx = { cloud: "aws", accountKey: "111122223333", display: createDisplay(), receipts: input.receipts, doorState: () => "selected" };
    const run = runRule(broken, { input, build, table: coverageLookup(input) });
    expect(run.result.status).toBe("unknown");
    expect(run.result.why.code).toBe("parse-failed");
    const whole = judge(input);
    expect(ruleOf(whole, "AWS-STO-2").status).toBe("risk");
  });
});

describe("룰이 속이려 해도 속지 않는다", () => {
  const input = resolveFixture("micro/AWS-STO-2/pass");
  const build: BuildCtx = { cloud: "aws", accountKey: "111122223333", display: createDisplay(), receipts: input.receipts, doorState: () => "selected" };
  const real = RULES.find((m) => m.spec.ruleId === "AWS-STO-2")!;
  const okKey = [...input.receipts.values()].find((r) => r.result === "ok")!.key;
  const res = (n: string) => ({ type: "s3-bucket" as const, name: { type: "resourceName" as const, value: n }, where: null, id: n });
  const withEvaluate = (evaluate: RuleModule["evaluate"]): RuleModule => ({ ...real, evaluate });
  const run = (mod: RuleModule) => runRule(mod, { input, build, table: coverageLookup(input) }).result;

  it("위조한 범위 증명으로 이상 없음을 주장하면 확인 불가다", () => {
    const forged = { itemFamily: "aws.sto.buckets", families: ["aws.sto.buckets"], population: 2, input: 0, receipts: [], unit: { kind: "account-global", covered: 1, total: 1 } };
    const r = run(withEvaluate(() => ({
      members: [mClear(res("a"), msg("AWS-STO-2:not-public"), [{ src: { input: 0, receipt: okKey, csv: null } }]), mClear(res("b"), msg("AWS-STO-2:not-public"), [{ src: { input: 0, receipt: okKey, csv: null } }])],
      coverage: forged as never,
    })));
    expect(r.status).toBe("unknown");
  });
  it("증거 없이 이상 없음을 주장하면 확인 불가다", () => {
    const r = run(withEvaluate((ctx) => ({ members: [mClear(res("a"), msg("AWS-STO-2:not-public"), []), mClear(res("b"), msg("AWS-STO-2:not-public"), [])], coverage: ctx.scope })));
    expect(r.status).toBe("unknown");
    expect(r.items.every((i) => i.status === "unknown")).toBe(true);
  });
  it("모양이 틀린 결과(null · 구성원 없음)를 주면 확인 불가(parse-failed)다", () => {
    for (const bad of [null, undefined, 3, {}, { members: "x" }]) {
      const r = run(withEvaluate((() => bad) as never));
      expect(r.status, JSON.stringify(bad)).toBe("unknown");
      expect(r.why.code).toBe("parse-failed");
    }
  });
  it("사유 선택 함수(explain)가 던져도 판정은 유지된다", () => {
    const r = runRule({ ...RULES.find((m) => m.spec.ruleId === "AWS-STO-2")!, explain: () => { throw new Error("explain boom"); } }, { input: resolveFixture("micro/AWS-STO-2/public-policy"), build: { ...build, receipts: resolveFixture("micro/AWS-STO-2/public-policy").receipts }, table: coverageLookup(resolveFixture("micro/AWS-STO-2/public-policy")) }).result;
    expect(r.status).toBe("risk");
    expect(r.why.code.startsWith("AWS-STO-2:")).toBe(true);
  });
});

describe("부분 데이터에서도 찾은 위험은 유지된다 (INV-4)", () => {
  it("다른 리전의 위험이 있고 한 리전 조회가 거부돼도 위험이 유지된다", () => {
    const input = deny(resolveFixture("micro/AWS-NET-1/other-region"), "ec2:DescribeSecurityGroups", { region: "ap-northeast-2" });
    const r = ruleOf(judge(input), "AWS-NET-1");
    expect(r.status).toBe("risk");
    expect(r.coverage.proven).toBe(false);
    expect(r.items.some((i) => i.status === "risk")).toBe(true);
  });
  it("위험이 없는데 한 리전이 거부되면 이상 없음이 아니라 확인 불가이고 권한 이름이 안내된다", () => {
    const input = deny(resolveFixture("micro/AWS-NET-1/pass"), "ec2:DescribeSecurityGroups", { region: "us-east-1" });
    const report = judge(input);
    const r = ruleOf(report, "AWS-NET-1");
    expect(r.status).toBe("unknown");
    if (r.status === "unknown") {
      expect(r.resolution).toEqual({ kind: "permission", permissions: ["ec2:DescribeSecurityGroups"] });
      expect(r.gaps).toContain("region-missing");
    }
    expect(report.permissions.denied.map((d) => d.call)).toEqual(["ec2:DescribeSecurityGroups"]);
    expect(report.permissions.unlockHints[0]?.permission).toBe("ec2:DescribeSecurityGroups");
  });
  it("Azure: 한 구독의 컨테이너 목록만 거부돼도 다른 구독의 위험이 유지된다 (INV-7 포함)", () => {
    const input = deny(resolveFixture("micro/AZ-STO-2/public-container"), "azure:storage.container-rm.list", {});
    const r = ruleOf(judge(input), "AZ-STO-2");
    expect(["unknown", "caution", "risk"]).toContain(r.status);
    expect(r.status === "clear" || r.status === "na").toBe(false);
  });
});

describe("결론에 필요 없는 증거가 빠져도 결론은 유지된다", () => {
  it("계정 차단 조회가 거부돼도 버킷 자신의 차단이 4개 모두 켜져 있으면 그 버킷은 이상 없음이다. 계정 설정에 기대는 버킷은 확인 불가다", () => {
    const report = judge(deny(resolveFixture("micro/AWS-STO-2/pass"), "s3:GetAccountPublicAccessBlock"));
    const rule = ruleOf(report, "AWS-STO-2");
    const bySlug = Object.fromEntries(rule.items.map((i) => [i.why.code.split(":")[1] ?? i.why.code, i.status]));
    expect(bySlug).toEqual({ "block-all-on": "clear", denied: "unknown" });
    expect(rule.status).toBe("unknown");     // 계정 범위가 미완결이라 룰 수준 '없음'은 말하지 못한다
    expect(ruleOf(report, "AWS-STO-1").status).toBe("unknown");
  });
});

describe("INV-3: 증거를 줄이면 절대 좋아지지 않는다", () => {
  const rank: Readonly<Record<Status, number>> = { risk: 0, caution: 1, unknown: 2, clear: 3, na: 4 };
  const noClearOrNa = (s: Status): boolean => s !== "clear" && s !== "na";

  function check(label: string, before: Report, after: Report): void {
    expect(checkReport(after), label).toEqual([]);
    for (const b of before.doors.flatMap((d) => d.rules)) {
      const a = ruleOf(after, b.ruleId);
      // 룰: 이상 없음·해당 없음이 아니던 룰이 그렇게 되지 않는다
      if (noClearOrNa(b.status)) expect(noClearOrNa(a.status), `${label} ${b.ruleId}: ${b.status} → ${a.status}`).toBe(true);
      // 대상: 이상 없음이 아니던 대상이 같은 키로 이상 없음이 되지 않는다
      const was = new Map(b.items.map((i) => [i.resource.key, i.status]));
      for (const i of a.items) {
        const w = was.get(i.resource.key);
        if (w !== undefined && w !== "clear") expect(i.status, `${label} ${b.ruleId} ${i.resource.key}`).not.toBe("clear");
      }
      // 위험 → 주의 → 확인 불가 순서의 '개선'(위험이 사라지는 것)은 증거를 줄여서 일어나지 않는다: 위험이었던 대상이 확인 불가로 바뀌는 것은 허용(증거 부족), 이상 없음은 안 된다
      expect(rank[a.status] >= 0).toBe(true);
    }
  }

  it("micro 픽스처 전부 × 적용 가능한 변이 하나씩 (전수)", () => {
    let count = 0;
    for (const ref of ALL_REFS) {
      const input = resolveFixture(ref);
      const before = judge(input);
      for (const m of evidenceRemovingMutations(input)) {
        let mutated: NormalizedInput;
        try { mutated = m.apply(input); } catch { continue; }
        expect(checkInvariants(mutated), `${ref} ${m.name}`).toEqual([]);
        check(`${ref} ${m.name}`, before, judge(mutated));
        count++;
      }
    }
    expect(count).toBeGreaterThan(300);
  });

  it("무작위 변이 2~3개를 이어 적용해도 마찬가지다 (속성 테스트, 시드 고정)", () => {
    const refArb = fc.constantFrom(...ALL_REFS);
    fc.assert(fc.property(refArb, fc.array(fc.nat(), { minLength: 2, maxLength: 3 }), (ref, picks) => {
      let input = resolveFixture(ref);
      const original = input;
      for (const pick of picks) {
        const options: Mutation[] = evidenceRemovingMutations(input);
        if (options.length === 0) break;
        const m = options[pick % options.length];
        try { input = m.apply(input); } catch { /* 이미 적용된 변이는 건너뛴다 */ }
      }
      check(ref, judge(original), judge(input));
    }), { numRuns: 300, seed: 20261019 });
  });

  it("거부 · 잘림 · 필드 부재 · 형식 불일치 · 단위 제거는 어떤 룰도 이상 없음으로 만들지 않는다 (직접 확인)", () => {
    const base = resolveFixture("micro/AWS-NET-1/pass");
    for (const m of [
      deny(base, "ec2:DescribeSecurityGroups", { region: "us-east-1" }), truncate(base, "ec2:DescribeNetworkInterfaces"),
      dropField(base, "doors.net.data.regions"), bumpSchema(base, "net"), removeUnit(base, "us-east-1"),
    ]) {
      const r = ruleOf(judge(m), "AWS-NET-1");
      expect(r.status).toBe("unknown");
    }
  });
});
