// 룰 18장 × 6케이스 (방향서 §6-3 출시 기준 2): 성공-통과 · 성공-위반 · 거부 · 잘림 · 필드 부재 · 버전 불일치.
// pass·violate는 사람이 손으로 쓴 micro 픽스처, 나머지 네 케이스는 pass에서 mutate로 증거를 줄여 만든다.
// 룰이 선언한 기대(expect)와 엔진 결과가 다르면 실패한다. 성립하지 않는 케이스는 룰 데이터에 이유(na)가 적혀 있어야 한다.
import { describe, expect, it } from "vitest";
import type { NormalizedInput } from "../contract/normalized";
import { judge } from "../engine/judge";
import { checkInvariants } from "../fixtures/invariants";
import { bumpSchema, deny, dropField, truncate } from "../fixtures/mutate";
import { resolveFixture } from "../fixtures/micro";
import { checkReport } from "../fixtures/report-invariants";
import type { Report, RuleResult, Status } from "../model/report";
import { RULES } from "./registry";

const ruleOf = (report: Report, id: string): RuleResult | undefined => report.doors.flatMap((d) => d.rules).find((r) => r.ruleId === id);
const rank: Readonly<Record<Status, number>> = { risk: 0, caution: 1, unknown: 2, clear: 3, na: 4 };
const isNa = (x: unknown): boolean => typeof x === "object" && x !== null && "na" in x;

describe.each(RULES.map((m) => [m.spec.ruleId, m] as const))("%s 6케이스", (id, mod) => {
  const spec = mod.spec;
  const f = spec.fixtures;
  const run = (input: NormalizedInput): RuleResult => {
    const report = judge(input);
    expect(checkReport(report)).toEqual([]);
    const r = ruleOf(report, id);
    expect(r, `${id}가 리포트에 있어야 한다`).toBeDefined();
    return r as RuleResult;
  };
  const pass = (): NormalizedInput => resolveFixture(f.pass as string);

  if (!spec.released) {
    it("편입 전(released: false) 룰은 리포트에 나오지 않고 케이스 선언이 모두 이유(na)다", () => {
      expect([f.pass, f.violate, f.denied, f.truncated, f.missingField].every(isNa)).toBe(true);
      const some = RULES.find((m) => m.spec.cloud === spec.cloud && m.spec.released && !isNa(m.spec.fixtures.pass));
      const report = judge(resolveFixture((some?.spec.fixtures.pass as string)));
      expect(ruleOf(report, id)).toBeUndefined();
    });
    return;
  }

  if (spec.kind === "guide") {
    it("가이드 룰은 어떤 입력에서도 확인 불가(guide-only)이고 이유가 적혀 있다", () => {
      expect([f.pass, f.violate, f.denied, f.truncated, f.missingField].every(isNa)).toBe(true);
      const some = RULES.find((m) => m.spec.cloud === spec.cloud && !isNa(m.spec.fixtures.pass));
      const r = run(resolveFixture(some?.spec.fixtures.pass as string));
      expect(r.status).toBe("unknown");
      expect(r.why.code).toBe("guide-only");
      expect(r.items).toEqual([]);
    });
    return;
  }

  it("1) 성공-통과: 이상 없음 또는 해당 없음이고 입력 불변식을 지킨다", () => {
    expect(isNa(f.pass)).toBe(false);
    const input = pass();
    expect(checkInvariants(input)).toEqual([]);
    expect(["clear", "na"]).toContain(run(input).status);
  });

  it("2) 성공-위반: 모든 위반 픽스처가 위험 또는 주의이고 룰의 최고 상태를 넘지 않는다", () => {
    expect(Array.isArray(f.violate)).toBe(true);
    for (const ref of f.violate as readonly string[]) {
      const r = run(resolveFixture(ref));
      expect(["risk", "caution"], ref).toContain(r.status);
      if (spec.maxStatus === "caution") expect(r.status, ref).toBe("caution");
      expect(rank[r.status]).toBeGreaterThanOrEqual(rank[spec.maxStatus === "risk" ? "risk" : "caution"]);
    }
  });

  it("3) 거부: 선언한 호출을 거부하면 선언한 상태가 되고, 이상 없음·해당 없음으로 바뀌지 않는다", () => {
    const d = f.denied;
    if ("na" in d) return;
    const { call, resource, region, expect: want } = d;
    const r = run(deny(pass(), call, { ...(resource === undefined ? {} : { resource }), ...(region === undefined ? {} : { region }) }));
    expect(r.status).toBe(want);
    expect(["clear", "na"]).not.toContain(r.status);
  });

  it("4) 잘림: 선언한 호출의 응답이 잘리면 선언한 상태가 된다", () => {
    const d = f.truncated;
    if ("na" in d) return;
    const r = run(truncate(pass(), d.call));
    expect(r.status).toBe(d.expect);
  });

  it("5) 필드 부재: 선언한 슬롯이 지워지면 선언한 상태가 된다", () => {
    const d = f.missingField;
    if ("na" in d) return;
    const r = run(dropField(pass(), d.path));
    expect(r.status).toBe(d.expect);
  });

  it("6) 버전 불일치: 문의 섹션이 읽는 형식과 맞지 않으면 확인 불가(형식 불일치)이고 재수집을 안내한다", () => {
    const r = run(bumpSchema(pass(), spec.door));
    expect(r.status).toBe("unknown");
    if (r.status === "unknown") {
      expect(r.gaps).toContain("schema-unsupported");
      expect(r.resolution.kind).toBe("rerun");
    }
    expect(r.items.every((i) => i.status === "unknown")).toBe(true);
  });

  it("거부·잘림·필드 부재가 룰 선언의 호출·경로와 실제 영수증·슬롯에 연결돼 있다", () => {
    if (!("na" in f.denied)) expect(spec.calls).toContain(f.denied.call);
    if (!("na" in f.truncated)) expect(spec.calls).toContain(f.truncated.call);
    if (!("na" in f.missingField)) expect(f.missingField.path.split(".")[1]).toBe(spec.door);
  });
});
