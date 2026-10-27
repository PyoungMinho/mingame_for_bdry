// QA FO-11 — 순수성 보강(INV-9) (설계서 §4-1)
// ① Azure 수집 JSON · AWS 보고서 CSV(lastModified 고정)를 두 번 읽어 판정 → Report 바이트 동일
// ② 시스템 시계를 바꿔도(vi.setSystemTime) judge 출력은 바이트 동일, 시간 알림(timeNotices)만 now 값에 따라 달라진다
// ③ 입력 순서를 바꾸면(JSON + CSV ↔ CSV + JSON) 판정(룰 상태·사유·대상 MatchKey·대상 상태)은 같다.
//    결정 N1(docs/planning/cloudcheck-qa-decisions.md §4): 판정은 입력 순서와 무관해야 하고(필수), Report 바이트 동일은 요구하지 않는다.
//    순서를 따라도 되는 표시 정보 = inputs 목록 순서 · 입력 번호(inputIndex) · 영수증 ID 접두(0: · 1:). 동률(같은 runKey · 같은 종류 + 같은 기준 시각)은 내용 지문으로 깬다.
import { afterEach, describe, expect, it, vi } from "vitest";
import { timeNotices } from "../engine/time";
import type { IsoUtc, Report } from "../model/report";
import type { Json } from "./kit";
import { collectorName, COLLECTED_MS, companyCsv, companyJson, csvRows, csvText, label, okReport, ruleOf, rulesOf, runCsv, runFiles, runJson, SETS } from "./kit";

const bytes = (r: Report): string => JSON.stringify(r);
const judgments = (r: Report): string => JSON.stringify(rulesOf(r).map((x) => [x.ruleId, x.status, x.why.code, x.items.map((i) => [i.resource.key, i.status, i.why.code])]));

afterEach(() => { vi.useRealTimers(); });

describe("FO-11 ① 같은 입력 두 번 = 같은 바이트", () => {
  for (const set of SETS) {
    it(`Azure ${set} 수집 JSON`, () => {
      expect(bytes(okReport(runJson(companyJson("azure", set))))).toBe(bytes(okReport(runJson(companyJson("azure", set)))));
    });
    it(`AWS ${set} 보고서 CSV(lastModified 고정)`, () => {
      expect(bytes(okReport(runCsv(companyCsv(set), { lastModified: COLLECTED_MS })))).toBe(bytes(okReport(runCsv(companyCsv(set), { lastModified: COLLECTED_MS }))));
    });
  }
});

describe("FO-11 ② 시스템 시계와 무관(judge는 현재 시각을 읽지 않는다)", () => {
  it("시계를 2020 · 2030으로 바꿔도 Azure C · AWS C · CSV C 판정 바이트가 같다", () => {
    const once = (): string[] => [bytes(okReport(runJson(companyJson("azure", "C")))), bytes(okReport(runJson(companyJson("aws", "C")))), bytes(okReport(runCsv(companyCsv("C"), { lastModified: COLLECTED_MS })))];
    vi.useFakeTimers();
    vi.setSystemTime(new Date(Date.UTC(2020, 0, 1)));
    const a = once();
    vi.setSystemTime(new Date(Date.UTC(2030, 5, 1)));
    const b = once();
    expect(a).toEqual(b);
  });
  it("시간 알림만 now에 따라 달라진다(같은 Report, now 2026-10-19 → 없음 / 2026-10-27 → 오래된 사진)", () => {
    const r = okReport(runJson(companyJson("azure", "C"), { name: collectorName("azure") }));
    expect(timeNotices(r, "2026-10-19T04:00:00Z" as IsoUtc)).toEqual([]);
    expect(timeNotices(r, "2026-10-27T04:00:00Z" as IsoUtc).map((n) => n.kind)).toEqual(["snapshot-age"]);
  });
});

describe("FO-11 ③ 입력 순서", () => {
  const j = { content: companyJson("aws", "C"), name: collectorName("aws"), via: "file" as const, lastModified: null };
  const c = { content: companyCsv("C"), name: "credential-report.csv", via: "file" as const, lastModified: COLLECTED_MS };
  it("JSON + CSV와 CSV + JSON의 판정(룰 상태 · 사유 · 대상 MatchKey · 대상 상태)이 같다", () => {
    expect(judgments(okReport(runFiles([c, j])))).toBe(judgments(okReport(runFiles([j, c]))));
  });
  it("[CC-QA-N1 · 결정] 판정은 입력 순서와 무관하다 — 표시 정보(inputs 순서 · 입력 번호 · 영수증 접두)를 뺀 Report 전체(분포 · 먼저 볼 3개 · 직접 볼 목록 · 범위 · 기준 시각 · 알림 포함)가 같다", () => {
    expect(decisionView(okReport(runFiles([c, j])))).toBe(decisionView(okReport(runFiles([j, c]))));
  });
  it("[CC-QA-N1 · 결정] 바이트 동일은 요구하지 않는다 — 같은 입력을 같은 순서로 넣으면 바이트가 같다", () => {
    expect(bytes(okReport(runFiles([j, c])))).toBe(bytes(okReport(runFiles([j, c]))));
  });
});

/**
 * 판정 보기: 입력 순서를 따라도 되는 표시 정보를 뺀 Report(결정 N1 §4-2). inputs는 순서 없는 묶음으로 본다(입력별 상태·쓰인 문은 내용을 따라가야 한다).
 * 빼는 것: 입력 번호(inputIndex · index), 영수증 ID 접두(0: · 1:), 입력 목록의 파일 이름 가명(file-001 · file-002 — 넣은 순서로 번호를 매긴다).
 */
function decisionView(r: Report): string {
  const strip = (x: unknown, alsoMasked = false): unknown => JSON.parse(JSON.stringify(x, (k, v) => (k === "inputIndex" || k === "index" || (alsoMasked && k === "masked") ? undefined : typeof v === "string" && /^\d+:/.test(v) ? v.replace(/^\d+:/, "#:") : v)));
  const inputs = (r.collection.inputs as readonly unknown[]).map((i) => JSON.stringify(strip(i, true))).sort();
  return JSON.stringify({ ...(strip({ ...r, collection: { ...r.collection, inputs: [] } }) as object), inputs });
}

describe("CC-QA-N1 동률 3가지 — 순서를 바꿔 넣어도 판정이 같고, 같은 내용이 쓰인다(입력 위치로 고르지 않는다)", () => {
  it("같은 runKey(같은 계정 · 같은 collectedAt) · 다른 내용의 수집기 JSON 두 개: 어느 순서든 같은 쪽이 쓰여 AWS-STO-2가 같다", () => {
    const a = companyJson("aws", "C");
    const b = companyJson("aws", "C");
    for (const x of b.data.buckets.items as Json[]) { if (x.policyStatus?.value) x.policyStatus.value.isPublic = false; if (x.acl?.value) x.acl.value.publicGrants = []; }
    expect(label(ruleOf(okReport(runJson(a)), "AWS-STO-2"))).not.toBe(label(ruleOf(okReport(runJson(b)), "AWS-STO-2")));   // 전제: 내용 차이가 판정을 바꾼다
    const fa = { content: a, name: "cloudcheck-aws-a.json", via: "file" as const, lastModified: null };
    const fb = { content: b, name: "cloudcheck-aws-b.json", via: "file" as const, lastModified: null };
    const r1 = okReport(runFiles([fa, fb])), r2 = okReport(runFiles([fb, fa]));
    expect(decisionView(r1)).toBe(decisionView(r2));
    expect(r1.collection.inputs.filter((i) => Object.values(i.doors).every((d) => d !== "used")).length).toBe(1);   // 하나는 쓰이지 않음(superseded)
  });
  const pair = (): [string, string] => {
    const one = companyCsv("C");
    const rows = csvRows(one);
    const mi = rows[0].indexOf("mfa_active");
    return [one, csvText(rows.map((r, i) => (i === 2 ? r.map((x, k) => (k === mi ? (x === "true" ? "false" : "true") : x)) : r)))];
  };
  it("붙여넣은 보고서 CSV 두 개(기준 시각 없음 — 동률) · 내용이 다름: 순서와 무관하게 판정이 같다", () => {
    const [x, y] = pair();
    const px = { content: x, name: "붙여넣기", via: "paste" as const, lastModified: null };
    const py = { content: y, name: "붙여넣기", via: "paste" as const, lastModified: null };
    expect(decisionView(okReport(runFiles([px, py])))).toBe(decisionView(okReport(runFiles([py, px]))));
  });
  it("수정 시각(lastModified)이 같은 보고서 CSV 파일 두 개 · 내용이 다름: 순서와 무관하게 판정이 같다", () => {
    const [x, y] = pair();
    const fx = { content: x, name: "credential-report.csv", via: "file" as const, lastModified: COLLECTED_MS };
    const fy = { content: y, name: "credential-report (1).csv", via: "file" as const, lastModified: COLLECTED_MS };
    expect(decisionView(okReport(runFiles([fx, fy])))).toBe(decisionView(okReport(runFiles([fy, fx]))));
  });
});
