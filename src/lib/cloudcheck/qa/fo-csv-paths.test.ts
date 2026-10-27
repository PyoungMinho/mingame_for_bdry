// QA FO-10 — CSV 경로는 '없음'을 못 만든다(INV-4, 디자인 F-10) (설계서 §4-1)
// ① Azure 회사 4곳 수집 JSON에서 QA가 Resource Graph CSV 2종(cc-rg-storage/1 · cc-rg-nsg/1, contract/rg-queries.ts 열 계약)을 만들어 단독·조합으로 넣는다.
//    기대: AZ-STO-1 · AZ-KEY-1 · AZ-NET-1 이상 없음·해당 없음 0, AZ-NET-1 최고 주의(공인 IP 연결을 모른다), CSV 경로의 위험·주의 대상 ⊆ 수집기 경로의 위험·주의 대상.
// ② AWS 자격증명 보고서 CSV에서 additional_credentials_info 열을 지우거나 값을 넣으면 AWS-KEY-1 · KEY-2 이상 없음 0.
import { describe, expect, it } from "vitest";
import { RG_NSG_COLUMNS, RG_STORAGE_COLUMNS } from "../contract/rg-queries";
import type { Report, RuleId } from "../model/report";
import { COLLECTED_MS, companyCsv, companyJson, label, okReport, ruleOf, runFiles, runJson, SETS } from "./kit";
import type { Json, SetId } from "./kit";

const q = (v: unknown): string => {
  const s = v === null || v === undefined ? "" : String(v);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};
const line = (cells: readonly unknown[]): string => cells.map(q).join(",");
const rgOf = (id: string): string => /\/resourceGroups\/([^/]+)\//i.exec(id)?.[1] ?? "";
const tostr = (b: boolean | null | undefined): string => (b === null || b === undefined ? "" : String(b));

/** 수집 JSON → Resource Graph 저장소 CSV(쿼리 cc-rg-storage/1의 열 순서) */
function rgStorage(f: Json): string {
  const tenant = f.identity.tenantId as string;
  const rows = (f.data.storageAccounts as Json[]).flatMap((p) => (p.items ?? []).map((a: Json) => line([
    "cc-rg-storage/1", tenant, a.id, p.subscription, rgOf(a.id), a.name, a.kind ?? "", a.location,
    tostr(a.allowBlobPublicAccess), tostr(a.allowSharedKeyAccess), a.keyCreationTime?.key1 ?? "", a.keyCreationTime?.key2 ?? "",
    a.keyExpirationPeriodInDays ?? "", a.sasExpirationPeriod ?? "",
  ])));
  return [RG_STORAGE_COLUMNS.join(","), ...rows, ""].join("\n");
}
/** 수집 JSON → Resource Graph NSG CSV(규칙을 펼친 cc-rg-nsg/1). 규칙이 없는 NSG는 mv-expand로 빠진다 */
function rgNsg(f: Json): string {
  const tenant = f.identity.tenantId as string;
  const rows = (f.data.nsgs as Json[] | undefined ?? []).flatMap((p) => (p.items ?? []).flatMap((n: Json) => (n.rules as Json[]).map((r) => line([
    "cc-rg-nsg/1", tenant, n.id, p.subscription, n.name, n.location, r.name, r.direction, r.access, r.priority, r.protocol,
    r.sourcePrefixes.length === 1 ? r.sourcePrefixes[0] : "", r.sourcePrefixes.length === 1 ? "[]" : JSON.stringify(r.sourcePrefixes),
    r.destPortRanges.length === 1 ? r.destPortRanges[0] : "", r.destPortRanges.length === 1 ? "[]" : JSON.stringify(r.destPortRanges),
    n.nicIds.length, n.subnetIds.length,
  ]))));
  return [RG_NSG_COLUMNS.join(","), ...rows, ""].join("\n");
}
const csvIn = (name: string, text: string) => ({ content: text, name, via: "file" as const, lastModified: COLLECTED_MS });
const FINDING = new Set(["risk", "caution"]);
const findings = (r: Report, id: RuleId): Set<string> => new Set(ruleOf(r, id).items.filter((i) => FINDING.has(i.status)).map((i) => i.resource.key as string));
const RULES: readonly RuleId[] = ["AZ-STO-1", "AZ-KEY-1", "AZ-NET-1"];

describe("FO-10 ① Resource Graph CSV 경로(Azure 4곳 × 저장소 단독 · NSG 단독 · 조합)", () => {
  for (const set of SETS) {
    const f = companyJson("azure", set);
    const combos: readonly (readonly [string, ReturnType<typeof csvIn>[]])[] = [
      ["저장소 단독", [csvIn("rg-storage.csv", rgStorage(f))]],
      ["NSG 단독", f.data.nsgs ? [csvIn("rg-nsg.csv", rgNsg(f))] : []],
      ["조합", [csvIn("rg-storage.csv", rgStorage(f)), ...(f.data.nsgs ? [csvIn("rg-nsg.csv", rgNsg(f))] : [])]],
    ];
    for (const [title, files] of combos) {
      if (files.length === 0) continue;
      it(`Azure ${set} · ${title}: 이상 없음·해당 없음 0, AZ-NET-1 최고 주의, 위험·주의 ⊆ 수집기 경로`, () => {
        const run = runFiles(files);
        if (run.kind !== "ok") throw new Error(`${set} ${title}: ${run.kind} ${run.kind === "rejected" ? run.status : ""}`);
        const csv = run.report;
        const collector = okReport(runJson(f));
        const problems: string[] = [];
        for (const id of RULES) {
          const x = ruleOf(csv, id);
          if (x.status === "clear" || x.status === "na") problems.push(`${id}: ${x.status}`);
          if (id === "AZ-NET-1" && x.status === "risk") problems.push("AZ-NET-1: CSV 경로인데 위험(공인 IP 연결을 알 수 없다)");
          const sub = [...findings(csv, id)].filter((k) => !findings(collector, id).has(k));
          if (sub.length > 0) problems.push(`${id}: CSV에만 있는 위험·주의 ${sub.join(", ")}`);
        }
        expect(problems).toEqual([]);
      });
    }
  }
  it("전제: QA가 만든 CSV가 실제로 인식되고 대상이 판정된다(C 조합: 저장소 2 · NSG 3)", () => {
    const f = companyJson("azure", "C");
    const run = runFiles([csvIn("rg-storage.csv", rgStorage(f)), csvIn("rg-nsg.csv", rgNsg(f))]);
    if (run.kind !== "ok") throw new Error(run.kind);
    expect(run.recs.map((r) => [r.status, r.kind])).toEqual([["ok", "csv-rg-storage"], ["ok", "csv-rg-nsg"]]);
    expect(ruleOf(run.report, "AZ-STO-1").items.length).toBe(2);
    expect(ruleOf(run.report, "AZ-NET-1").items.length).toBe(3);
    expect(label(ruleOf(run.report, "AZ-NET-1"))).toBe("caution");
  });
});

/* ───────── ② AWS 보고서 CSV의 additional_credentials_info ───────── */
const H = "user,arn,user_creation_time,password_enabled,password_last_used,password_last_changed,password_next_rotation,mfa_active,access_key_1_active,access_key_1_last_rotated,access_key_1_last_used_date,access_key_1_last_used_region,access_key_1_last_used_service,access_key_2_active,access_key_2_last_rotated,access_key_2_last_used_date,access_key_2_last_used_region,access_key_2_last_used_service,cert_1_active,cert_1_last_rotated,cert_2_active,cert_2_last_rotated,additional_credentials_info";
const ROOT = "<root_account>,arn:aws:iam::111122223333:root,2019-04-02T01:00:00+00:00,not_supported,2026-03-02T01:00:00+00:00,not_supported,not_supported,true,false,N/A,N/A,N/A,N/A,false,N/A,N/A,N/A,N/A,false,N/A,false,N/A,N/A";
/** 최근에 회전했고 최근에 쓴 키 1개 + 최근 콘솔 사용 → KEY-1·KEY-2 이상 없음인 기준 보고서 */
const FRESH = (extra: string): string => `fresh,arn:aws:iam::111122223333:user/fresh,2025-01-01T00:00:00+00:00,true,2026-10-15T00:00:00+00:00,2025-01-01T00:00:00+00:00,N/A,true,true,2026-09-01T00:00:00+00:00,2026-10-15T00:00:00+00:00,ap-northeast-2,s3,false,N/A,N/A,N/A,N/A,false,N/A,false,N/A,${extra}`;
const report = (rows: string[], header = H): string => [header, ...rows, ""].join("\n");
const dropCol = (text: string, col: string): string => {
  const lines = text.split("\n");
  const i = lines[0].split(",").indexOf(col);
  return lines.map((l) => (l === "" ? l : l.split(",").filter((_, k) => k !== i).join(","))).join("\n");
};
const csvReport = (text: string): Report => {
  const run = runFiles([{ content: text, name: "credential-report.csv", via: "file", lastModified: Date.UTC(2026, 9, 19, 3, 0, 0) }]);
  return okReport(run);
};

describe("FO-10 ② AWS 보고서 CSV additional_credentials_info", () => {
  it("전제: 열이 있고 비어 있으면 KEY-1 · KEY-2 이상 없음(시험 입력이 의미 있다)", () => {
    const r = csvReport(report([ROOT, FRESH("")]));
    expect(ruleOf(r, "AWS-KEY-1").status).toBe("clear");
    expect(ruleOf(r, "AWS-KEY-2").status).toBe("clear");
  });
  it("열이 없으면 KEY-1 · KEY-2 이상 없음 0(3번째 키부터 모른다)", () => {
    const r = csvReport(dropCol(report([ROOT, FRESH("")]), "additional_credentials_info"));
    expect([label(ruleOf(r, "AWS-KEY-1")), label(ruleOf(r, "AWS-KEY-2"))]).not.toContain("clear");
    expect(ruleOf(r, "AWS-KEY-1").status).not.toBe("na");
  });
  it("값이 있으면(추가 키 표기) KEY-1 · KEY-2 이상 없음 0", () => {
    for (const v of ["1 additional access key", "x", "N/A1"]) {
      const r = csvReport(report([ROOT, FRESH(v)]));
      expect([ruleOf(r, "AWS-KEY-1").status, ruleOf(r, "AWS-KEY-2").status], v).not.toContain("clear");
    }
  });
  it("회사 4곳 CSV에서 열을 지워도 KEY-1 · KEY-2 이상 없음 0(사용자가 있는 회사)", () => {
    for (const set of SETS as readonly SetId[]) {
      const r = csvReport(dropCol(companyCsv(set), "additional_credentials_info"));
      for (const id of ["AWS-KEY-1", "AWS-KEY-2"] as const) expect(ruleOf(r, id).status, `${set} ${id}`).not.toBe("clear");
    }
  });
});
