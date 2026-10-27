// QA IN-11 — 예외 파일 적대 입력 (설계서 §4-4)
// 깊이 33 · 4 MB 초과 · 1001항목 · 날짜 형식 오류 · until < createdAt · 91일 · 모르는 ruleId · 다른 계정 MatchKey · 같은 대상 예외 여럿.
// 기대: 해당 issue 코드, 상태·분포·먼저 볼 3개 불변(INV-8 · G-D21), 다른 계정 키는 unmatched.
import { describe, expect, it } from "vitest";
import { overlayExceptions } from "../engine/exceptions";
import type { IsoDate, Report } from "../model/report";
import { parseExceptions } from "../parse/exceptions";
import { companyJson, okReport, ruleOf, runJson } from "./kit";

const report = (): Report => okReport(runJson(companyJson("aws", "C")));
const target = (r: Report): string => ruleOf(r, "AWS-STO-2").items[0].resource.key;
const entry = (o: Partial<Record<"ruleId" | "resource" | "reason" | "until" | "createdAt", string>> = {}) => ({ ruleId: "AWS-STO-2", resource: "aws|111122223333|s3-bucket|ap-northeast-2|amzn-s3-demo-acme-customer-export", reason: "의도된 공개(QA)", until: "2026-11-30", createdAt: "2026-10-19", ...o });
const file = (entries: unknown[]): string => JSON.stringify({ schema: "cloudcheck.exceptions/1.0", entries });
const issues = (text: string): string[] => { const r = parseExceptions(text); return r.ok ? [] : r.issues; };

describe("IN-11 예외 파일 거부 코드", () => {
  it("정상 파일은 읽힌다(전제)", () => expect(parseExceptions(file([entry()])).ok).toBe(true));
  it("깊이 33 → format", () => {
    let deep: unknown = "x";
    for (let i = 0; i < 33; i++) deep = [deep];
    expect(issues(JSON.stringify({ schema: "cloudcheck.exceptions/1.0", entries: [], x: deep }))).toEqual(["format"]);
  });
  it("4 MB(400만 자) 초과 → too-many(읽지 않음)", () => {
    expect(issues(file([entry({ reason: "가".repeat(10) })]) + " ".repeat(4_000_001))).toEqual(["too-many"]);
  });
  it("1001항목 → too-many, 1000항목은 정상", () => {
    expect(issues(file(Array.from({ length: 1001 }, () => entry())))).toEqual(["too-many"]);
    expect(parseExceptions(file(Array.from({ length: 1000 }, () => entry()))).ok).toBe(true);
  });
  it("날짜 형식 오류 → until(기간 코드와 겹치지 않음)", () => {
    expect(issues(file([entry({ until: "2026/11/30" })]))).toEqual(["until"]);
    expect(issues(file([entry({ createdAt: "2026-13-01" })]))).toEqual(["until"]);
  });
  it("until < createdAt · 같은 날 · 91일 → span, 90일 = 정상", () => {
    expect(issues(file([entry({ until: "2026-10-18" })]))).toEqual(["span"]);
    expect(issues(file([entry({ until: "2026-10-19" })]))).toEqual(["span"]);
    expect(issues(file([entry({ until: "2027-01-18" })]))).toEqual(["span"]);       // 91일
    expect(parseExceptions(file([entry({ until: "2027-01-17" })])).ok).toBe(true);  // 90일
  });
  it("모르는 ruleId → rule, 빈 사유(공백만) → reason, 모르는 키 → format", () => {
    expect(issues(file([entry({ ruleId: "AWS-ZZZ-9" })]))).toEqual(["rule"]);
    expect(issues(file([entry({ reason: "   " })]))).toEqual(["reason"]);
    expect(issues(file([{ ...entry(), extra: 1 }]))).toEqual(["format"]);
  });
});

describe("IN-11 예외 오버레이: 상태·분포·먼저 볼 3개 불변(INV-8), 다른 계정은 unmatched", () => {
  it("예외를 덧씌워도 Report 바이트가 그대로다(오버레이는 별도 표)", () => {
    const r = report();
    const before = JSON.stringify(r);
    const parsed = parseExceptions(file([entry({ resource: target(r) })]));
    if (!parsed.ok) throw new Error("parse");
    const ov = overlayExceptions(r, parsed.file, "2026-10-20" as IsoDate);
    expect(ov.counts).toEqual({ active: 1, expired: 0, unmatched: 0 });
    expect(JSON.stringify(r)).toBe(before);
  });
  it("다른 계정(999988887777)의 MatchKey는 unmatched", () => {
    const r = report();
    const parsed = parseExceptions(file([entry({ resource: target(r).replace("111122223333", "999988887777") })]));
    if (!parsed.ok) throw new Error("parse");
    expect(overlayExceptions(r, parsed.file, "2026-10-20" as IsoDate).counts).toEqual({ active: 0, expired: 0, unmatched: 1 });
  });
  it("같은 대상 예외 여럿: 유효 > 만료, 같으면 만료일이 늦은 것", () => {
    const r = report();
    const k = target(r);
    const parsed = parseExceptions(file([
      entry({ resource: k, until: "2026-10-19", createdAt: "2026-10-01", reason: "만료됨" }),
      entry({ resource: k, until: "2026-11-01", reason: "유효-이른" }),
      entry({ resource: k, until: "2026-12-01", reason: "유효-늦은" }),
    ]));
    if (!parsed.ok) throw new Error("parse");
    const ov = overlayExceptions(r, parsed.file, "2026-10-20" as IsoDate);
    expect(ov.counts).toEqual({ active: 2, expired: 1, unmatched: 0 });
    const label = [...ov.byItemId.values()][0];
    expect(label.state).toBe("active");
    expect(label.until).toBe("2026-12-01");
    expect(label.reason.kind === "sensitive" ? label.reason.full : "").toBe("유효-늦은");
  });
  it("만료일 = 오늘은 유효, 어제는 만료", () => {
    const r = report();
    const parsed = parseExceptions(file([entry({ resource: target(r), until: "2026-10-20", createdAt: "2026-10-01" })]));
    if (!parsed.ok) throw new Error("parse");
    expect(overlayExceptions(r, parsed.file, "2026-10-20" as IsoDate).counts.active).toBe(1);
    expect(overlayExceptions(r, parsed.file, "2026-10-21" as IsoDate).counts.expired).toBe(1);
  });
});
