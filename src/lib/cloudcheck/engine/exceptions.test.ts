// 예외 오버레이 — 라벨만 붙이고 상태 · 분포 · 정렬은 건드리지 않는다 (INV-8, R-10).
import { describe, expect, it } from "vitest";
import type { ExceptionsFile } from "../contract/exceptions-schema";
import { resolveFixture } from "../fixtures/micro";
import type { IsoDate, Report } from "../model/report";
import { judge } from "./judge";
import { overlayExceptions } from "./exceptions";

const report: Report = judge(resolveFixture("micro/AWS-KEY-2/unused-key"));
const rule = report.doors.flatMap((d) => d.rules).find((r) => r.ruleId === "AWS-KEY-2")!;
const flagged = rule.items.find((i) => i.status === "caution")!;
const other = rule.items.find((i) => i.status === "clear")!;
const entry = (over: Partial<ExceptionsFile["entries"][number]> = {}): ExceptionsFile["entries"][number] => ({
  ruleId: "AWS-KEY-2", resource: flagged.resource.key, reason: "분기마다 한 번 쓰는 정산용 키", until: "2026-12-31", createdAt: "2026-10-01", ...over,
});
const file = (...entries: ExceptionsFile["entries"]): ExceptionsFile => ({ schema: "cloudcheck.exceptions/1.0", entries: [...entries] });
const today = "2026-10-19" as IsoDate;
const snapshot = (r: Report): string => JSON.stringify(r);

describe("overlayExceptions", () => {
  it("파일이 없으면 빈 오버레이", () => {
    const o = overlayExceptions(report, null, today);
    expect(o.byItemId.size).toBe(0);
    expect(o.entries).toEqual([]);
    expect(o.counts).toEqual({ active: 0, expired: 0, unmatched: 0 });
  });

  it("MatchKey가 맞는 대상에 유효 라벨을 붙인다. 사유는 가려진 채 담긴다", () => {
    const o = overlayExceptions(report, file(entry()), today);
    expect(o.counts).toEqual({ active: 1, expired: 0, unmatched: 0 });
    expect(o.entries).toEqual([{ index: 0, state: "active" }]);
    const label = o.byItemId.get(flagged.id);
    expect(label).toMatchObject({ kind: "exception", state: "active", until: "2026-12-31", createdAt: "2026-10-01" });
    expect(label?.reason).toMatchObject({ kind: "sensitive", type: "freeText", masked: "•••", full: "분기마다 한 번 쓰는 정산용 키" });
    expect(o.byItemId.has(other.id)).toBe(false);
  });

  it("만료일 당일까지 유효하고 다음 날부터 만료다", () => {
    expect(overlayExceptions(report, file(entry({ until: "2026-10-19" })), "2026-10-19" as IsoDate).counts.active).toBe(1);
    const expired = overlayExceptions(report, file(entry({ until: "2026-10-19" })), "2026-10-20" as IsoDate);
    expect(expired.counts).toEqual({ active: 0, expired: 1, unmatched: 0 });
    expect(expired.byItemId.get(flagged.id)).toMatchObject({ state: "expired" });
  });

  it("현재 리포트에 없는 대상은 unmatched이고 어떤 라벨도 붙지 않는다", () => {
    const o = overlayExceptions(report, file(entry({ resource: "aws|111122223333|iam-user|-|nobody" }), entry({ ruleId: "AWS-KEY-1" })), today);
    expect(o.counts).toEqual({ active: 0, expired: 0, unmatched: 2 });
    expect(o.byItemId.size).toBe(0);
  });

  it("같은 대상에 예외가 여럿이면 유효한 것 > 만료된 것, 같으면 만료일이 늦은 것", () => {
    const o = overlayExceptions(report, file(entry({ until: "2026-10-18", createdAt: "2026-10-01", reason: "만료된 것" }), entry({ until: "2026-11-01", reason: "유효 (이른)" }), entry({ until: "2026-12-01", reason: "유효 (늦은)" })), today);
    const label = o.byItemId.get(flagged.id);
    expect(label).toMatchObject({ state: "active", until: "2026-12-01" });
    expect(o.counts).toEqual({ active: 2, expired: 1, unmatched: 0 });
  });

  it("리포트를 바꾸지 않는다: 상태 · 분포 · 정렬 · 직접 볼 목록이 그대로다 (INV-8)", () => {
    const before = snapshot(report);
    overlayExceptions(report, file(entry(), entry({ resource: "x" })), today);
    expect(snapshot(report)).toBe(before);
    const frozen = JSON.parse(before) as Report;
    expect(() => overlayExceptions(Object.freeze(frozen) as Report, file(entry()), today)).not.toThrow();
  });

  it("손상된 파일 모양이 들어와도 던지지 않는다", () => {
    expect(() => overlayExceptions(report, { entries: "x" } as never, today)).not.toThrow();
    expect(overlayExceptions(report, { entries: [null] } as never, today).byItemId.size).toBe(0);
  });
});
