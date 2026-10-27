// QA FO-03 — 대상별 슬롯 제거(중첩) (설계서 §4-1, 빈 곳 ②)
// NormalizedInput에서 대상 하나의 슬롯(버킷 publicAccessBlock·policyStatus·acl·ownership·website·region, 사용자 passwordEnabled·mfaActive·keys·createdAt·
// passwordLastUsed·attachedPolicyArns·groupNames, 키 active·createdAt·lastUsed, trail status·selectors, 스토리지 계정 allowBlobPublicAccess·allowSharedKeyAccess·
// key1/2CreatedAt·containers·blobDiagnostics, NSG rules[i]·nicIds·subnetIds …)을 missing(field-missing)·partial·none으로 바꾼다.
// 기대: missing·partial — 이상 없음이 아니던 대상·룰이 이상 없음·해당 없음이 되지 않는다(전체 단조성).
//       none — '설정 없음' 뜻이 바뀌므로 결과 변화는 허용하되 위험 → 이상 없음·해당 없음만 금지.
import { describe, expect, it } from "vitest";
import { judge } from "../engine/judge";
import { checkReport } from "../fixtures/report-invariants";
import type { Report, Status } from "../model/report";
import { companyCsv, companyJson, monotoneViolations, rulesOf, runCsv, runJson, SETS } from "./kit";
import type { Run } from "./kit";
import { isNested, replaceSlot, slotPaths } from "./nested";
import type { NestedKind } from "./nested";

/** none 전용 오라클: 위험 → 없음 결론(룰) · 위험 → 이상 없음(대상)만 위반 */
function riskToClear(before: Report, after: Report, what: string): string[] {
  const out = checkReport(after).map((v) => `${what} checkReport: ${v}`);
  const was = new Map(rulesOf(before).map((x) => [x.ruleId, x]));
  for (const a of rulesOf(after)) {
    const b = was.get(a.ruleId);
    if (b === undefined) continue;
    if (b.status === "risk" && (a.status === "clear" || a.status === "na")) out.push(`${what} ${a.ruleId}: risk → ${a.status}`);
    const prev = new Map<string, Status>(b.items.map((i) => [i.resource.key as string, i.status]));
    for (const i of a.items) if (prev.get(i.resource.key) === "risk" && i.status === "clear") out.push(`${what} ${a.ruleId} ${i.resource.key}: risk → clear`);
  }
  return out;
}

function exercise(run: Run, label: string): { runs: number; nested: number; violations: string[] } {
  if (run.kind !== "ok") throw new Error(`${label}: ${run.kind}`);
  const before = run.report;
  let runs = 0;
  const violations: string[] = [];
  const paths = slotPaths(run.input).filter(isNested);
  for (const p of paths) {
    for (const kind of ["missing", "partial", "none"] as NestedKind[]) {
      const mutated = replaceSlot(run.input, p, kind);
      if (mutated === null) continue;
      runs++;
      const after = judge(mutated);
      const what = `[${label}] ${p.join(".")} → ${kind}`;
      violations.push(...(kind === "none" ? riskToClear(before, after, what) : monotoneViolations(before, after, what)));
    }
  }
  return { runs, nested: paths.length, violations };
}

describe("FO-03 수집기 JSON 경로: 대상 하나의 슬롯을 비워도 이상 없음이 새로 생기지 않는다", () => {
  for (const cloud of ["aws", "azure"] as const) for (const set of SETS) {
    it(`${cloud}-${set}`, () => {
      const t = exercise(runJson(companyJson(cloud, set)), `${cloud}-${set}`);
      expect(t.violations).toEqual([]);
      expect(t.nested).toBeGreaterThan(cloud === "aws" ? 20 : 10);
    });
  }
});

describe("FO-03 자격증명 보고서 CSV 경로", () => {
  for (const set of SETS) {
    it(`aws-${set}.credential-report.csv`, () => {
      const t = exercise(runCsv(companyCsv(set)), `csv-${set}`);
      expect(t.violations).toEqual([]);
    });
  }
});

describe("FO-03 도우미 자체 점검", () => {
  it("중첩 슬롯 목록에 설계서가 든 슬롯 종류가 모두 있다(AWS C · Azure C)", () => {
    const tails = (cloud: "aws" | "azure"): Set<string> => {
      const r = runJson(companyJson(cloud, "C"));
      if (r.kind !== "ok") throw new Error("C");
      return new Set(slotPaths(r.input).filter(isNested).map((p) => String(p[p.length - 1])));
    };
    const aws = tails("aws");
    for (const k of ["publicAccessBlock", "policyStatus", "acl", "ownership", "website", "region", "passwordEnabled", "mfaActive", "keys", "createdAt", "passwordLastUsed", "attachedPolicyArns", "groupNames", "active", "lastUsed", "status", "selectors"]) expect(aws.has(k), k).toBe(true);
    const az = tails("azure");
    for (const k of ["allowBlobPublicAccess", "allowSharedKeyAccess", "key1CreatedAt", "key2CreatedAt", "containers", "blobDiagnostics", "nicIds", "subnetIds"]) expect(az.has(k), k).toBe(true);
    // NSG 규칙은 배열 원소가 슬롯이다(rules[i])
    const r = runJson(companyJson("azure", "C"));
    if (r.kind !== "ok") throw new Error("C");
    expect(slotPaths(r.input).some((p) => p[p.length - 2] === "rules" && typeof p[p.length - 1] === "number")).toBe(true);
  });
});
