// 시간 알림 — 현재 시각은 UI가 한 곳에서 읽어 넘기는 값이고, 이 모듈은 Date.now를 부르지 않는다(INV-9).
import { describe, expect, it } from "vitest";
import { resolveFixture } from "../fixtures/micro";
import type { IsoUtc, Report } from "../model/report";
import { RULES } from "../rules/registry";
import { failClosedReport, judge } from "./judge";
import { dayNumber, parseIsoMs, timeNotices } from "./time";

const report: Report = judge(resolveFixture("micro/AWS-MFA-2/pass"));
const asOfMs = parseIsoMs((report.collection.asOf as { at: string }).at) as number;
const iso = (ms: number): IsoUtc => new Date(ms).toISOString().replace(/\.\d{3}Z$/, "Z") as IsoUtc;
const H = 3_600_000;
const D = 24 * H;
const kinds = (r: Report, now: IsoUtc): string[] => timeNotices(r, now).map((n) => n.kind + (n.kind === "snapshot-age" ? `:${n.level}` : ""));

describe("parseIsoMs (엄격한 UTC 파서)", () => {
  it("정규형 · 소수 초 · +00:00을 받는다", () => {
    expect(parseIsoMs("2026-10-19T03:00:00Z")).toBe(Date.UTC(2026, 9, 19, 3, 0, 0));
    expect(parseIsoMs("2026-10-19T03:00:00.123456Z")).toBe(Date.UTC(2026, 9, 19, 3, 0, 0));
    expect(parseIsoMs("2026-10-19T03:00:00+00:00")).toBe(Date.UTC(2026, 9, 19, 3, 0, 0));
    expect(parseIsoMs("2028-02-29T00:00:00Z")).not.toBeNull();
  });
  it("달력에 없는 날짜 · 범위 밖 값 · 다른 오프셋 · 다른 모양은 거부한다", () => {
    for (const bad of ["2026-02-29T00:00:00Z", "2026-02-30T00:00:00Z", "2026-13-01T00:00:00Z", "2026-00-10T00:00:00Z", "2026-10-19T24:00:00Z", "2026-10-19T03:60:00Z",
      "2026-10-19T03:00:60Z", "2026-10-19 03:00:00Z", "2026-10-19T03:00:00+09:00", "2026-10-19T03:00:00", "2026-10-19", "", "now", "2026-10-19T03:00:00ZZ"]) {
      expect(parseIsoMs(bad), bad).toBeNull();
    }
  });
  it("dayNumber는 UTC 일 번호", () => {
    expect(dayNumber("1970-01-01")).toBe(0);
    expect(dayNumber("2026-10-20")).toBe((dayNumber("2026-10-19") as number) + 1);
    expect(dayNumber("2026-02-30")).toBeNull();
    expect(dayNumber("2026-10-19T00:00:00Z")).toBeNull();
  });
});

describe("오래된 사진", () => {
  it("24시간 이하는 알림이 없다 (경계 포함)", () => {
    expect(kinds(report, iso(asOfMs))).toEqual([]);
    expect(kinds(report, iso(asOfMs + 24 * H))).toEqual([]);
  });
  it("24시간을 1초라도 넘으면 stale (경과 시간 내림)", () => {
    const n = timeNotices(report, iso(asOfMs + 24 * H + 1000));
    expect(n).toEqual([{ kind: "snapshot-age", level: "stale", ageHours: 24 }]);
    expect(timeNotices(report, iso(asOfMs + 5 * D + 7 * H))[0]).toEqual({ kind: "snapshot-age", level: "stale", ageHours: 127 });
  });
  it("7일 이하는 stale, 7일을 넘으면 very-stale", () => {
    expect(kinds(report, iso(asOfMs + 7 * D))).toEqual(["snapshot-age:stale"]);
    expect(kinds(report, iso(asOfMs + 7 * D + 1000))).toEqual(["snapshot-age:very-stale"]);
  });
});

describe("시계 차이", () => {
  it("수집 시각이 기기 시계보다 5분 넘게 늦으면 future-timestamp (분은 내림)", () => {
    expect(kinds(report, iso(asOfMs - 5 * 60_000))).toEqual([]);
    expect(timeNotices(report, iso(asOfMs - 5 * 60_000 - 1000))).toEqual([{ kind: "future-timestamp", aheadMinutes: 5 }]);
    expect(timeNotices(report, iso(asOfMs - 3 * H))).toEqual([{ kind: "future-timestamp", aheadMinutes: 180 }]);
  });
  it("미래 시각이면 오래된 사진 알림은 함께 나오지 않는다", () => {
    expect(kinds(report, iso(asOfMs - 2 * H))).toEqual(["future-timestamp"]);
  });
});

describe("오래된 안내 (lastVerified + 180일)", () => {
  const day = (s: string): number => dayNumber(s) as number;
  const withoutSnapshot = (r: Report): Report => ({ ...r, collection: { ...r.collection, asOf: null } });
  const lastOf = (id: string): number => day(RULES.find((m) => m.spec.ruleId === id)!.spec.lastVerified);
  const prio = (id: string): number => RULES.find((m) => m.spec.ruleId === id)!.spec.priority;
  const present = report.doors.flatMap((d) => d.rules.map((x) => x.ruleId));
  const days = present.map(lastOf);
  const earliest = Math.min(...days);
  const latest = Math.max(...days);
  const noon = (dayNo: number): IsoUtc => iso(dayNo * D + 12 * H);
  const staleAt = (dayNo: number): string[] => {
    const n = timeNotices(withoutSnapshot(report), noon(dayNo));
    expect(n).toHaveLength(1);
    expect(n[0].kind).toBe("guidance-stale");
    if (n[0].kind !== "guidance-stale") return [];
    expect(n[0].ruleIds.map(prio)).toEqual(n[0].ruleIds.map(prio).slice().sort((a, b) => a - b));     // priority 순
    return [...n[0].ruleIds];
  };

  it("각 룰은 자기 확인일 + 180일까지는 알림이 없고 181일째부터 그 룰만 나온다(확인일이 룰마다 다를 수 있다)", () => {
    expect(timeNotices(withoutSnapshot(report), noon(earliest + 180))).toEqual([]);
    expect(staleAt(earliest + 181).sort()).toEqual(present.filter((id) => lastOf(id) === earliest).sort());
  });
  it("가장 늦은 확인일 + 181일이면 리포트에 있는 룰이 모두 나온다(리포트에 없는 룰은 나오지 않는다)", () => {
    const ids = staleAt(latest + 181);
    expect(ids.sort()).toEqual([...present].sort());
    expect(ids.every((id) => RULES.some((m) => m.spec.ruleId === id))).toBe(true);
  });
});

describe("예외 없는 방어", () => {
  it("체험 모드에서는 항상 빈 배열", () => {
    const demo: Report = { ...report, mode: { kind: "demo", setId: "A" } };
    expect(timeNotices(demo, iso(asOfMs + 30 * D))).toEqual([]);
  });
  it("now를 읽을 수 없으면 빈 배열", () => {
    for (const bad of ["", "지금", "2026-10-19", "2026-02-30T00:00:00Z"]) expect(timeNotices(report, bad as IsoUtc)).toEqual([]);
  });
  it("수집 시각이 없는 리포트(안전망)도 던지지 않는다", () => {
    expect(() => timeNotices(failClosedReport(null), iso(asOfMs))).not.toThrow();
  });
  it("전역 Date.now를 막아도 같은 결과 — 현재 시각을 읽지 않는다", () => {
    const real = Date.now;
    Date.now = () => { throw new Error("Date.now 사용 금지"); };
    try {
      expect(timeNotices(report, iso(asOfMs + 2 * D))).toEqual([{ kind: "snapshot-age", level: "stale", ageHours: 48 }]);
    } finally {
      Date.now = real;
    }
  });
});
