// Before/After 비교 — 점검자 휴먼에러(다른 계정 · 다른 클라우드 · 같은 파일 두 번)를 거부하고, 수집 시각 순으로 자동 정렬한다.
import { describe, expect, it } from "vitest";
import { resolveFixture } from "../fixtures/micro";
import type { AsOf, Report, Status } from "../model/report";
import { RULES } from "../rules/registry";
import { changeOf, compare } from "./compare";
import { judge } from "./judge";

const at = (r: Report, iso: string): Report => ({ ...r, collection: { ...r.collection, asOf: { ...(r.collection.asOf as AsOf), at: iso as AsOf["at"] } } });
const before = at(judge(resolveFixture("micro/AWS-KEY-1/old-key")), "2026-10-19T03:00:00Z");
const after = at(judge(resolveFixture("micro/AWS-KEY-1/pass")), "2026-10-20T03:00:00Z");

describe("changeOf", () => {
  const S: readonly Status[] = ["risk", "caution", "unknown", "clear", "na"];
  // 사람이 쓴 표: 행 = 이전, 열 = 이후 (S 순서)
  const want: readonly (readonly string[])[] = [
    /* risk    */ ["same", "better", "became-unknown", "better", "better"],
    /* caution */ ["worse", "same", "became-unknown", "better", "better"],
    /* unknown */ ["became-known", "became-known", "same", "became-known", "became-known"],
    /* clear   */ ["worse", "worse", "became-unknown", "same", "same"],
    /* na      */ ["worse", "worse", "became-unknown", "same", "same"],
  ];
  it.each(S.flatMap((b, i) => S.map((a, j) => [b, a, want[i][j]] as const)))("%s → %s = %s", (b, a, w) => {
    expect(changeOf(b, a)).toBe(w);
  });
});

describe("compare", () => {
  it("같은 계정의 서로 다른 시점이면 룰별 변화를 낸다 (priority 순)", () => {
    const c = compare(before, after);
    expect(c.ok).toBe(true);
    if (!c.ok) return;
    expect(c.reordered).toBe(false);
    expect(c.before.asOf?.at).toBe("2026-10-19T03:00:00Z");
    const r = c.rules.find((x) => x.ruleId === "AWS-KEY-1");
    expect(r).toMatchObject({ before: "caution", after: "clear", change: "better" });
    expect(r?.items.before.caution).toBe(1);
    expect(r?.items.after.clear).toBe(3);
    const expectedOrder = RULES.filter((m) => m.spec.cloud === "aws").sort((a, b) => a.spec.priority - b.spec.priority).map((m) => m.spec.ruleId);
    expect(c.rules.map((x) => x.ruleId)).toEqual(expectedOrder);
  });
  it("순서를 바꿔 넣어도 수집 시각이 앞선 쪽이 Before다 (reordered)", () => {
    const c = compare(after, before);
    expect(c.ok && c.reordered).toBe(true);
    if (c.ok) {
      expect(c.before.asOf?.at).toBe("2026-10-19T03:00:00Z");
      expect(c.rules.find((x) => x.ruleId === "AWS-KEY-1")?.change).toBe("better");
    }
  });
  it("같은 스냅샷을 두 번 올리면 거부한다", () => {
    const c = compare(before, { ...before });
    expect(c).toMatchObject({ ok: false, reason: "same-snapshot" });
  });
  it("다른 클라우드 · 다른 계정은 거부한다", () => {
    const azure = at(judge(resolveFixture("micro/AZ-KEY-1/pass")), "2026-10-20T03:00:00Z");
    expect(compare(before, azure)).toMatchObject({ ok: false, reason: "different-cloud" });
    const otherAccount: Report = { ...after, identity: { ...after.identity, account: { kind: "sensitive", type: "accountId", full: "999988887777", masked: "••••7777", flags: [] } } };
    expect(compare(before, otherAccount)).toMatchObject({ ok: false, reason: "different-account" });
  });
  it("계정 ID를 알 수 없으면(가려진 값) 다른 계정으로 거부한다", () => {
    const unknownAcct: Report = { ...after, identity: { ...after.identity, account: { kind: "plain", text: "-" } } };
    expect(compare(before, unknownAcct)).toMatchObject({ ok: false, reason: "different-account" });
  });
  it("확인 불가로 바뀌면 became-unknown, 벗어나면 became-known", () => {
    const broken = at(judge(resolveFixture("micro/AWS-KEY-1/pass")), "2026-10-21T03:00:00Z");
    const brokenReport: Report = {
      ...broken,
      doors: broken.doors.map((d) => ({ ...d, rules: d.rules.map((r) => (r.ruleId === "AWS-KEY-1" ? ({ ...r, status: "unknown", why: { code: "denied" }, gaps: ["denied"], resolution: { kind: "rerun", permissions: [] } } as never) : r)) })),
    };
    const c = compare(after, brokenReport);
    expect(c.ok && c.rules.find((x) => x.ruleId === "AWS-KEY-1")?.change).toBe("became-unknown");
    const back = compare(brokenReport, at(after, "2026-10-22T03:00:00Z"));
    expect(back.ok && back.rules.find((x) => x.ruleId === "AWS-KEY-1")?.change).toBe("became-known");
  });
  it("속성: 입력을 바꾸지 않는다", () => {
    const a = JSON.stringify(before);
    const b = JSON.stringify(after);
    compare(before, after);
    expect([JSON.stringify(before), JSON.stringify(after)]).toEqual([a, b]);
  });
});
