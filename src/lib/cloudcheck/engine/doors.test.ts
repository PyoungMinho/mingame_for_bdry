// 문 단위 수집 현황과 직접 볼 목록의 영역 항목 — 선택된 문인데 아무것도 모으지 못한 경우, 가이드 룰만 있는 문(Azure 현관)
// (체험 데이터가 Azure 현관을 collected로 적어 실제 수집기와 다르게 보였던 일에서 나온 규칙)
import { describe, expect, it } from "vitest";
import { notCollectedCoverage } from "../contract/normalized";
import type { NormalizedInput } from "../contract/normalized";
import { resolveFixture } from "../fixtures/micro";
import { miss } from "../fixtures/micro/kit";
import type { DoorId, Report } from "../model/report";
import { judge } from "./judge";

const doorOf = (r: Report, door: DoorId) => r.doors.find((d) => d.door === door) as Report["doors"][number];
const manualOf = (r: Report, door: DoorId) => r.manualChecklist.filter((m) => m.door === door);

/**
 * 창고 문을 '선택됐지만 수집된 것이 없는' 모양으로 바꾼 사본: 선택된 문 그대로, 패밀리는 수집 안 함, 데이터 칸은 값 없음(not-collected).
 * keep에 적은 칸은 원래 데이터를 남긴다.
 */
function stoNothingCollected(input: NormalizedInput, families: readonly string[], keep: readonly ("accountPublicAccessBlock" | "buckets")[] = []): NormalizedInput {
  const coverage = { ...input.coverage } as Record<string, unknown>;
  for (const f of families) coverage[f] = notCollectedCoverage(f as never, 0);
  const sto = input.doors.sto as unknown as { readonly data: Record<string, unknown> };
  const data = {
    accountPublicAccessBlock: keep.includes("accountPublicAccessBlock") ? sto.data.accountPublicAccessBlock : miss("not-collected"),
    buckets: keep.includes("buckets") ? sto.data.buckets : miss("not-collected"),
  };
  return { ...input, coverage, doors: { ...input.doors, sto: { ...(input.doors.sto as object), data } } } as unknown as NormalizedInput;
}

describe("선택된 문인데 아무것도 모으지 못한 경우", () => {
  const base = resolveFixture("micro/AWS-STO-2/pass");

  it("정상 입력: 선택된 창고 문은 모두 완결이라 collected · full", () => {
    expect(doorOf(judge(base), "sto").collection).toMatchObject({ status: "collected", judgeLevel: "full", reason: null });
  });

  it("문의 패밀리가 전부 '수집 안 함'뿐이면 문은 수집 안 함이다 (일부만 수집됨이라고 말하지 않는다)", () => {
    const r = judge(stoNothingCollected(base, ["aws.sto.account", "aws.sto.buckets"]));
    expect(doorOf(r, "sto").collection).toEqual({ status: "not-collected", judgeLevel: "none", reason: { code: "not-collected" }, asOf: null, inputIndex: null });
  });

  it("점검 판정은 그대로 확인 불가(not-collected)이고, 점검마다 나열하지 않고 영역 하나로 직접 볼 목록에 오른다", () => {
    const r = judge(stoNothingCollected(base, ["aws.sto.account", "aws.sto.buckets"]));
    const rules = doorOf(r, "sto").rules;
    expect(rules.map((x) => x.status)).toEqual(["unknown", "unknown"]);
    expect(rules.every((x) => x.status === "unknown" && x.gaps.includes("not-collected"))).toBe(true);
    expect(manualOf(r, "sto").map((m) => m.origin)).toEqual(["out-of-scope"]);
  });

  it("하나라도 모은 패밀리가 있으면 일부만 수집됨(partial)이다 — 수집 안 함으로 올리지 않는다", () => {
    const r = judge(stoNothingCollected(base, ["aws.sto.buckets"], ["accountPublicAccessBlock"]));
    expect(doorOf(r, "sto").collection).toMatchObject({ status: "partial", judgeLevel: "full", reason: { code: "not-collected" } });
    expect(manualOf(r, "sto").some((m) => m.origin === "out-of-scope")).toBe(false);
  });

  it("시도한 흔적이 있으면 '수집 안 함'이 아니다: 거부 빈틈의 패밀리(영수증 있음)는 partial", () => {
    const cov = { ...base.coverage } as Record<string, unknown>;
    for (const f of ["aws.sto.account", "aws.sto.buckets"] as const) {
      const sound = (base.coverage as unknown as Record<string, object>)[f];
      cov[f] = Object.freeze({ ...sound, complete: false, gaps: Object.freeze(["denied"]), population: null, present: 0 });
    }
    expect((cov["aws.sto.account"] as { receipts: readonly unknown[] }).receipts.length).toBeGreaterThan(0);   // 기준: 거부된 호출도 영수증이 남는다
    const r = judge({ ...base, coverage: cov } as unknown as NormalizedInput);
    expect(doorOf(r, "sto").collection).toMatchObject({ status: "partial", reason: { code: "denied" } });
  });
});

describe("가이드 룰만 있는 문(Azure 현관): 영역 항목 없이 가이드 카드만", () => {
  const r = judge(resolveFixture("micro/AZ-STO-1/pass"));

  it("현관은 수집하지 않은 문이고(수집 안 함 · none), 직접 볼 것은 가이드 카드 하나다", () => {
    expect(doorOf(r, "mfa").collection).toMatchObject({ status: "not-collected", judgeLevel: "none" });
    expect(manualOf(r, "mfa").map((m) => m.origin)).toEqual(["guide-card"]);
    expect(manualOf(r, "mfa")[0].ruleId).toBe("AZ-MFA-G");
  });
  it("자동 판정 룰이 있는 문은 입력에 없으면 영역 하나로 알린다 (열쇠 · 창문 · CCTV)", () => {
    expect(r.manualChecklist.filter((m) => m.origin === "out-of-scope").map((m) => m.door)).toEqual(["key", "net", "log"]);
  });
  it("현관의 가이드 점검은 늘 확인 불가(guide-only)이고 해소법은 가이드다", () => {
    const g = doorOf(r, "mfa").rules[0];
    expect(g.ruleId).toBe("AZ-MFA-G");
    expect(g.status).toBe("unknown");
    expect(g.status === "unknown" && g.resolution.kind).toBe("guide");
  });
  it("AWS 현관은 자동 판정 룰이 있어 수집하지 않았으면 영역 항목이 선다", () => {
    const aws = judge(resolveFixture("micro/AWS-STO-1/pass"));
    expect(manualOf(aws, "mfa").map((m) => m.origin)).toEqual(["out-of-scope"]);
  });
});
