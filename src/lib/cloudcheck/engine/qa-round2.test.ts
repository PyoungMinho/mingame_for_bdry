// STEP 5 QA 2라운드(DB설계자) — 엔진 쪽: 구성원 신원 집합 대조(CC-QA-02 · 15), 요청했는데 보이지 않는 구독(CC-QA-11),
// 범위 미증명 위험·주의의 '나머지 대상'(CC-QA-06 짝), 기준 시각보다 늦은 기록 알림(CC-QA-01).
// 기대값은 결정 문서(docs/planning/cloudcheck-qa-decisions.md)와 디자인 §8-3 · §8-4에서 먼저 썼다.
import { describe, expect, it } from "vitest";
import { sealCoverage } from "../contract/normalized";
import type { FamilyCoverage, NormalizedInput, ReceiptKey, Src } from "../contract/normalized";
import { world as netWorld } from "../fixtures/micro/aws-net";
import { SUB, azWorld } from "../fixtures/micro/azure-world";
import { inst, withLatestEvidence } from "../fixtures/micro/kit";
import { resolveFixture } from "../fixtures/micro";
import { deny, truncate } from "../fixtures/mutate";
import { renderMsg } from "../fixtures/render";
import type { Report, RuleId, RuleResult } from "../model/report";
import { mClear, mRisk, msg } from "../rules/kit";
import { RULES } from "../rules/registry";
import { aggregate } from "./aggregate";
import type { AggEnv } from "./aggregate";
import { judge } from "./judge";
import { coverageLookup, proveScope } from "./proof";
import type { Member, RuleOutcome, RuleSpec, ScopeProof } from "./types";

const ruleOf = (r: Report, id: RuleId): RuleResult => r.doors.flatMap((d) => d.rules).find((x) => x.ruleId === id) as RuleResult;

/* ───────── 구성원 신원 집합 대조 ───────── */
describe("룰이 평가한 구성원의 신원 집합이 증명된 신원 집합과 같아야 모수가 증명된다 (CC-QA-02 · 15)", () => {
  const spec: RuleSpec = RULES.find((m) => m.spec.ruleId === "AWS-STO-2")!.spec;
  const input: NormalizedInput = resolveFixture("micro/AWS-STO-2/pass");
  const env: AggEnv = { receipts: input.receipts, inputCount: input.inputs.length, hasAsOf: true };
  const okKey: ReceiptKey = [...input.receipts.values()].find((r) => r.result === "ok")!.key;
  const OK = [{ src: { input: 0, receipt: okKey, csv: null } as Src }];

  /** 아이템 패밀리(aws.sto.buckets)가 주어진 구성원 신원 집합(개수 = 모수)을 증명하는 증명 */
  const proofWith = (keys: readonly string[] | undefined): ScopeProof => {
    const table: Record<string, FamilyCoverage | undefined> = { ...coverageLookup(input) };
    const c = table["aws.sto.buckets"] as FamilyCoverage;
    table["aws.sto.buckets"] = sealCoverage({
      family: c.family, input: c.input, complete: true, population: keys === undefined ? c.population : keys.length, present: keys === undefined ? c.present : keys.length,
      expected: null, gaps: [], receipts: [...c.receipts], unit: { kind: c.unit.kind, covered: c.unit.covered, total: c.unit.total }, units: c.units.map((u) => ({ ...u })),
      ...(keys === undefined ? {} : { memberKeys: keys }),
    });
    return proveScope(table, "aws.sto.buckets", ["aws.sto.account"]) as ScopeProof;
  };
  const res = (id: string, familyKey?: string) => ({ type: "s3-bucket" as const, name: { type: "resourceName" as const, value: id }, where: null, id, ...(familyKey === undefined ? {} : { familyKey }) });
  const clear = (id: string, familyKey?: string): Member => mClear(res(id, familyKey), msg("AWS-STO-2:not-public"), OK);
  const risk = (id: string): Member => mRisk(res(id), msg("AWS-STO-2:bucket-public-acl"), OK);
  const outcome = (members: Member[], coverage: ScopeProof): RuleOutcome => ({ members, coverage });

  it("증명이 신원 집합을 싣고 있으면 그 집합이 proof에 실린다(정렬 · 중복 없음)", () => {
    expect(proofWith(["b", "a"]).memberKeys).toEqual(["a", "b"]);
    expect(proofWith(undefined).memberKeys).toBeNull();
  });
  it("신원이 같으면 이상 없음", () => {
    expect(aggregate(spec, outcome([clear("b"), clear("a")], proofWith(["a", "b"])), env)).toMatchObject({ status: "clear", population: 2, applicable: 2 });
  });
  it("개수는 같지만 신원이 바뀌었으면(a, b → a, c) 모수를 증명하지 못한다: 확인 불가(population-mismatch)", () => {
    const a = aggregate(spec, outcome([clear("a"), clear("c")], proofWith(["a", "b"])), env);
    expect(a).toMatchObject({ status: "unknown", gaps: ["population-mismatch"], population: null, applicable: null });
    expect(a.proof).toBeNull();
  });
  it("같은 대상을 두 번 평가한 복제(a, a → a, b)도 신원 집합이 달라 모수를 증명하지 못한다", () => {
    expect(aggregate(spec, outcome([clear("a"), clear("a")], proofWith(["a", "b"])), env)).toMatchObject({ status: "unknown", gaps: ["population-mismatch"] });
  });
  it("양성은 신원이 맞지 않아도 유지하되 범위는 증명되지 않은 것으로 다룬다(proof 없음 · 모수 없음)", () => {
    const a = aggregate(spec, outcome([risk("a"), clear("c")], proofWith(["a", "b"])), env);
    expect(a.status).toBe("risk");
    expect(a.proof).toBeNull();
    expect(a.population).toBeNull();
    expect(a.applicable).toBeNull();
    expect(a.coverageGaps).toEqual(["population-mismatch"]);
  });
  it("개수가 달라도 같다 — 개수 비교는 신원 비교에 포함된다(구성원이 모자라거나 남는 경우)", () => {
    expect(aggregate(spec, outcome([clear("a")], proofWith(["a", "b"])), env)).toMatchObject({ status: "unknown", gaps: ["population-mismatch"] });
    expect(aggregate(spec, outcome([clear("a"), clear("b"), clear("c")], proofWith(["a", "b"])), env)).toMatchObject({ status: "unknown", gaps: ["population-mismatch"] });
  });
  it("범위 표의 신원 표기가 id와 다른 대상은 familyKey로 맞춘다(보안 그룹: <리전>/<ID>)", () => {
    expect(aggregate(spec, outcome([clear("sg-1", "r1/sg-1"), clear("sg-2", "r2/sg-2")], proofWith(["r1/sg-1", "r2/sg-2"])), env).status).toBe("clear");
    expect(aggregate(spec, outcome([clear("sg-1"), clear("sg-2")], proofWith(["r1/sg-1", "r2/sg-2"])), env)).toMatchObject({ status: "unknown", gaps: ["population-mismatch"] });
    // 같은 ID가 다른 리전에 있어도 서로 다른 신원이다
    expect(aggregate(spec, outcome([clear("sg-1", "r1/sg-1"), clear("sg-1", "r2/sg-1")], proofWith(["r1/sg-1", "r2/sg-1"])), env).status).toBe("clear");
  });
  it("이름이 같고 내용이 다른 대상(Azure 컨테이너)은 둘째부터 ~2 · ~3으로 센다(범위 표와 같은 규칙)", () => {
    expect(aggregate(spec, outcome([clear("acct/c"), clear("acct/c"), clear("acct/d")], proofWith(["acct/c", "acct/c~2", "acct/d"])), env).status).toBe("clear");
    expect(aggregate(spec, outcome([clear("acct/c"), clear("acct/c"), clear("acct/d")], proofWith(["acct/c", "acct/d", "acct/e"])), env)).toMatchObject({ status: "unknown", gaps: ["population-mismatch"] });
  });
  it("신원 집합이 없는 증명(micro 등)은 지금처럼 개수만 대조한다", () => {
    expect(aggregate(spec, outcome([clear("x"), clear("y")], proofWith(undefined)), env).status).toBe("clear");
  });

  it("종단: 보안 그룹의 신원을 다른 리전의 같은 ID로 바꿔치기한 범위 표는 AWS-NET-1을 이상 없음으로 만들지 못한다", () => {
    const sgs = [{ id: "sg-0a1b2c3d", name: "web", region: "ap-northeast-2", ingress: [{ protocol: "tcp", from: 443, to: 443 }] }];
    const ok = judge(netWorld({ sgs, enis: [] }).build());
    expect(ruleOf(ok, "AWS-NET-1").status).toBe("clear");
    const swapped = judge(netWorld({ sgs, enis: [], sgKeys: ["us-east-1/sg-0a1b2c3d"] }).build());
    const r = ruleOf(swapped, "AWS-NET-1");
    expect(r.status).toBe("unknown");
    if (r.status === "unknown") expect(r.gaps).toContain("population-mismatch");
    // 같은 바꿔치기에서도 찾은 위험은 남는다(양성 유지) — 단 범위는 증명되지 않은 것으로 보인다
    const open = [{ id: "sg-0bad0001", name: "bastion", region: "ap-northeast-2", ingress: [{ protocol: "tcp", from: 22, to: 22 }] }];
    const keptReport = judge(netWorld({ sgs: open, enis: [{ id: "eni-0f00", region: "ap-northeast-2", groups: ["sg-0bad0001"], publicIp: true }], sgKeys: ["us-east-1/sg-0bad0001"] }).build());
    const kept = ruleOf(keptReport, "AWS-NET-1");
    expect(kept.status).toBe("risk");
    expect(kept.coverage.proven).toBe(false);
    expect(kept.coverage.population).toBeNull();
    // 범위가 증명되지 않았으니 직접 볼 목록에 '보지 못한 나머지 대상'이 오르고 사유는 모수 불일치다
    const rest = keptReport.manualChecklist.filter((m) => m.id === "m|net|AWS-NET-1|rest");
    expect(rest).toHaveLength(1);
    expect(rest[0].why?.code).toBe("population-mismatch");
  });
  it("종단: 모든 micro 보안 그룹 픽스처는 신원 집합과 맞는다(정상 입력이 population-mismatch가 되지 않는다)", () => {
    for (const name of ["pass", "public-ssh", "unattached", "other-region", "split-world", "prefix-list", "mixed-caution"]) {
      const r = ruleOf(judge(resolveFixture(`micro/AWS-NET-1/${name}`)), "AWS-NET-1");
      expect(r.status === "unknown" && r.gaps.includes("population-mismatch"), name).toBe(false);
    }
  });
});

/* ───────── 요청했는데 보이지 않는 구독 (CC-QA-11) ───────── */
describe("--subscriptions로 요청했는데 보이는 구독 목록에 없는 구독은 빠진 구독이다 (CC-QA-11)", () => {
  const GHOST = "00000000-0000-0000-0000-0000000000b9";
  const net = (requested?: readonly string[]) => judge(azWorld({ doors: ["net"], nsgs: [], ...(requested === undefined ? {} : { requested }) }).build());

  it("요청한 구독이 모두 보이면 범위가 증명된다", () => {
    const s = net([SUB]).scope;
    expect([s.proven, s.missing.length, s.checked, s.visible]).toEqual([true, 0, 1, 1]);
  });
  it("보이지 않는 구독이 있으면 missing에 subscription-missing으로 오르고 범위는 증명되지 않는다", () => {
    const s = net([SUB, GHOST]).scope;
    expect(s.proven).toBe(false);
    expect(s.missing).toHaveLength(1);
    expect(s.missing[0].reason).toBe("subscription-missing");
    expect(s.missing[0].receiptId).toBeNull();
    expect(s.missing[0].name).toMatchObject({ kind: "sensitive", type: "subscriptionId", full: GHOST });
    // 보이는 구독 수 · 확인한 구독 수는 그대로다
    expect([s.checked, s.visible]).toEqual([1, 1]);
  });
  it("대소문자 · 앞뒤 공백이 달라도 같은 구독으로 본다, 같은 ID를 두 번 요청해도 한 번만 센다", () => {
    expect(net([` ${SUB.toUpperCase()} `]).scope.missing).toEqual([]);
    expect(net([SUB, GHOST, GHOST.toUpperCase()]).scope.missing).toHaveLength(1);
  });
  it("요청이 없으면(null) 영향이 없다", () => {
    expect(net().scope.proven).toBe(true);
  });
});

/* ───────── 보지 못한 나머지 대상 (CC-QA-06 짝) ───────── */
describe("범위가 증명되지 않은 위험·주의에서 확인 불가 대상이 없으면 직접 볼 목록에 '보지 못한 나머지 대상'이 오른다", () => {
  const restOf = (r: Report, id: RuleId) => r.manualChecklist.filter((m) => m.ruleId === id && m.id.endsWith("|rest"));

  it("사용자 목록이 잘린 AWS-MFA-2(위험 + 범위 미증명): 한 건, 사유는 목록이 끝까지 오지 않음", () => {
    const report = judge(truncate(resolveFixture("micro/AWS-MFA-2/no-mfa"), "iam:ListUsers"));
    const rule = ruleOf(report, "AWS-MFA-2");
    expect(rule.status).toBe("risk");
    expect(rule.coverage.proven).toBe(false);
    expect(rule.items.filter((i) => i.status === "unknown")).toEqual([]);
    const rest = restOf(report, "AWS-MFA-2");
    expect(rest).toHaveLength(1);
    expect(rest[0]).toMatchObject({ id: "m|mfa|AWS-MFA-2|rest", origin: "unknown-rule", door: "mfa", ruleId: "AWS-MFA-2", resource: null });
    expect(rest[0].what.code).toBe("fact:manual-rest");
    expect(renderMsg(rest[0].what)).toBe("보지 못한 나머지 대상");
    expect(rest[0].why?.code).toBe("truncated");
    expect(renderMsg(rest[0].why!)).toBe("목록이 끝까지 오지 않았습니다. 받은 범위의 위험·주의는 유효하지만 '없음'은 확정할 수 없습니다. 다시 수집하세요.");
    expect(rest[0].howKey).toBe("cc.rule.aws-mfa-2.how");
    expect(rest[0].resolution?.kind).toBe("rerun");
    expect(report.doors.find((d) => d.door === "mfa")!.manualCount).toBeGreaterThanOrEqual(1);
  });
  it("범위가 증명된 위험·주의에는 나머지 대상 항목이 없다", () => {
    const report = judge(resolveFixture("micro/AWS-MFA-2/no-mfa"));
    expect(ruleOf(report, "AWS-MFA-2").coverage.proven).toBe(true);
    expect(restOf(report, "AWS-MFA-2")).toEqual([]);
  });
  it("모든 micro 픽스처와 선언된 변이(거부 · 잘림)에서: 나머지 대상 항목은 위험·주의 + 범위 미증명 + 확인 불가 대상 0개일 때만, 그리고 그때는 반드시 한 건 있다", () => {
    let positivesWithoutProof = 0;
    let checked = 0;
    for (const m of RULES.filter((x) => x.spec.released && x.spec.kind !== "guide")) {
      const f = m.spec.fixtures;
      if (typeof f.pass !== "string") continue;
      const bases = [f.pass, ...(Array.isArray(f.violate) ? f.violate : [])];
      for (const ref of bases) {
        const input = resolveFixture(ref);
        const variants: NormalizedInput[] = [input];
        for (const mutate of [
          () => ("na" in f.truncated ? null : truncate(input, f.truncated.call)),
          () => ("na" in f.denied ? null : deny(input, f.denied.call, { ...(f.denied.resource === undefined ? {} : { resource: f.denied.resource }), ...(f.denied.region === undefined ? {} : { region: f.denied.region }) })),
        ]) {
          try { const v = mutate(); if (v !== null) variants.push(v); } catch { /* 이 픽스처에는 그 호출의 영수증이 없다 */ }
        }
        for (const v of variants) {
          const report = judge(v);
          for (const rule of report.doors.flatMap((d) => d.rules)) {
            checked++;
            const rest = report.manualChecklist.filter((x) => x.ruleId === rule.ruleId && x.id.endsWith("|rest"));
            const positive = rule.status === "risk" || rule.status === "caution";
            const want = positive && !rule.coverage.proven && !rule.items.some((i) => i.status === "unknown") ? 1 : 0;
            expect(rest.length, `${ref} ${rule.ruleId} ${rule.status}`).toBe(want);
            if (positive && !rule.coverage.proven) positivesWithoutProof++;
          }
        }
      }
    }
    expect(checked).toBeGreaterThan(500);
    expect(positivesWithoutProof).toBeGreaterThan(0);               // 이 검사가 의미 있으려면 범위 미증명 양성이 실제로 나와야 한다
  });
  it("확인 불가인 룰은 지금처럼 '점검 자체' 항목 하나뿐이다(나머지 대상 항목이 겹치지 않는다)", () => {
    const report = judge(truncate(resolveFixture("micro/AWS-MFA-2/pass"), "iam:ListUsers"));
    const rule = ruleOf(report, "AWS-MFA-2");
    expect(rule.status).toBe("unknown");
    expect(restOf(report, "AWS-MFA-2")).toEqual([]);
    expect(report.manualChecklist.filter((m) => m.ruleId === "AWS-MFA-2").map((m) => m.id)).toEqual(["m|mfa|AWS-MFA-2|rule"]);
  });
});

/* ───────── 기준 시각보다 늦은 기록 알림 (CC-QA-01) ───────── */
describe("입력 안의 기록이 기준 시각보다 허용치(5분)를 넘게 늦으면 as-of-before-evidence 알림이 선다 (CC-QA-01)", () => {
  const base = resolveFixture("micro/AZ-KEY-1/pass");                 // 수집 시각 2026-10-19T03:00:00Z
  const banners = (input: NormalizedInput): string[] => judge(input).banners.map((b) => b.kind);

  it("5분 안의 어긋남은 시계 차이로 보고 알림이 없다, 5분을 넘으면 선다", () => {
    expect(banners(withLatestEvidence(base, "2026-10-19T03:05:00Z"))).not.toContain("as-of-before-evidence");
    expect(banners(withLatestEvidence(base, "2026-10-19T03:05:01Z"))).toContain("as-of-before-evidence");
    expect(banners(withLatestEvidence(base, "2026-10-19T02:59:00Z"))).not.toContain("as-of-before-evidence");
  });
  it("가장 늦은 기록이 없거나 null이면 알림이 없다", () => {
    expect(banners(base)).not.toContain("as-of-before-evidence");
    const nulled = { ...base, inputs: base.inputs.map((f) => ({ ...f, latestEvidence: null })) } as NormalizedInput;
    expect(banners(nulled)).not.toContain("as-of-before-evidence");
  });
  const withInput = (input: NormalizedInput, patch: Record<string, unknown>): NormalizedInput =>
    ({ ...input, inputs: input.inputs.map((f, i) => (i === 0 ? { ...f, ...patch } : f)) }) as NormalizedInput;
  it("기준 시각이 없는 입력(후보를 버린 입력 포함)은 견줄 수 없어 알림을 더하지 않는다", () => {
    expect(banners(withInput(base, { asOf: null, latestEvidence: inst("2026-10-19T09:00:00Z") }))).not.toContain("as-of-before-evidence");
  });
  it("알림은 파라미터가 없는 종류이고, '수집 시각을 추정했습니다' 알림 바로 다음에 선다", () => {
    const csv = withInput(base, { asOf: { at: base.inputs[0].asOf!.at, source: "file-time" }, latestEvidence: inst("2026-10-19T04:00:00Z") });
    const report = judge(csv);
    const order = report.banners.map((b) => b.kind);
    expect(order.indexOf("collected-at-approximate")).toBeGreaterThanOrEqual(0);
    expect(order.indexOf("as-of-before-evidence")).toBe(order.indexOf("collected-at-approximate") + 1);
    expect(report.banners.find((b) => b.kind === "as-of-before-evidence")).toEqual({ kind: "as-of-before-evidence" });
  });
  it("판정을 바꾸지 않는다: 같은 입력에서 알림만 더해질 뿐 나이를 쓰지 않는 룰의 상태는 그대로다", () => {
    const a = judge(base);
    const b = judge(withLatestEvidence(base, "2026-10-19T09:00:00Z"));
    const pick = (r: Report): string[] => r.doors.flatMap((d) => d.rules).filter((x) => x.ruleId !== "AZ-KEY-1").map((x) => `${x.ruleId}:${x.status}`);
    expect(pick(b)).toEqual(pick(a));
  });
  it("정의: 모델 알림 종류는 10개이고 문구 키(제목 · 본문)가 둘 다 있다", async () => {
    const { ENGINE_KO } = await import("../rules/i18n/ko");
    const KO: Readonly<Record<string, string>> = ENGINE_KO;
    expect(KO["cc.banner.as-of-before-evidence.title"]).toBe("기준 시각보다 늦은 기록이 파일 안에 있습니다");
    expect(KO["cc.banner.as-of-before-evidence.body"]).toContain("수집한 컴퓨터의 시계가 늦었거나");
    expect(KO["cc.banner.as-of-before-evidence.body"]).toContain("찾은 위험·주의는 그대로입니다.");
    expect(Object.keys(KO).filter((k) => /^cc\.banner\..+\.title$/.test(k))).toHaveLength(10);
  });
});
