// src/lib/cloudcheck/contract/rg-queries.test.ts — KQL 원문과 열 계약이 어긋나지 않는지 본다
import { describe, expect, it } from "vitest";
import {
  RG_NSG_COLUMNS, RG_NSG_ID, RG_NSG_KQL, RG_QUERIES, RG_QUERY_ID_RE, RG_STORAGE_COLUMNS, RG_STORAGE_ID, RG_STORAGE_KQL,
} from "./rg-queries";

/** KQL의 project 절에서 열 이름을 순서대로 뽑는다(괄호 안의 쉼표는 무시) */
function projectedColumns(kql: string): string[] {
  const code = kql.split("\n").filter((l) => !l.trim().startsWith("//")).join("\n");
  const m = /\|\s*project\s+([\s\S]*?)(?:\n\||$)/.exec(code);
  if (!m) return [];
  const out: string[] = [];
  let depth = 0, cur = "";
  for (const ch of m[1]) {
    if (ch === "(") depth++;
    if (ch === ")") depth--;
    if (ch === "," && depth === 0) { out.push(cur); cur = ""; continue; }
    cur += ch;
  }
  if (cur.trim()) out.push(cur);
  return out.map((s) => s.trim()).filter(Boolean).map((s) => (s.includes("=") ? s.slice(0, s.indexOf("=")).trim() : s));
}

describe("Resource Graph 쿼리 계약", () => {
  it("project 열 순서 = 열 계약(스토리지·NSG)", () => {
    expect(projectedColumns(RG_STORAGE_KQL)).toEqual([...RG_STORAGE_COLUMNS]);
    expect(projectedColumns(RG_NSG_KQL)).toEqual([...RG_NSG_COLUMNS]);
  });

  it("첫 열은 ccQuery 상수 열이고 값은 쿼리 ID와 같다 · tenantId 열이 있다", () => {
    expect(RG_STORAGE_KQL).toContain(`ccQuery='${RG_STORAGE_ID}'`);
    expect(RG_NSG_KQL).toContain(`ccQuery='${RG_NSG_ID}'`);
    for (const q of RG_QUERIES) {
      expect(q.columns[0]).toBe("ccQuery");
      expect(q.columns).toContain("tenantId");
      expect(q.columns).toContain("subscriptionId");
      expect(RG_QUERY_ID_RE.test(q.id)).toBe(true);
      expect(q.kql.split("\n")[0]).toContain(q.id);   // 첫 줄 주석에도 ID가 있다
    }
  });

  it("방향서 §4-7 쿼리 본문 핵심을 담는다(대소문자 무시 type 비교, order by, mv-expand)", () => {
    expect(RG_STORAGE_KQL).toContain("where type =~ 'microsoft.storage/storageaccounts'");
    expect(RG_STORAGE_KQL).toContain("order by id asc");
    expect(RG_NSG_KQL).toContain("where type =~ 'microsoft.network/networksecuritygroups'");
    expect(RG_NSG_KQL).toContain("mv-expand rule = properties.securityRules");
  });

  it("텍스트 위생: 탭·CR·백틱·제어 문자 없음(복사해 붙여 넣을 문자열)", () => {
    for (const q of RG_QUERIES) {
      expect(/[\t\r`]/.test(q.kql)).toBe(false);
      // eslint-disable-next-line no-control-regex
      expect(/[\u0000-\u0008\u000b-\u001f\u007f]/.test(q.kql)).toBe(false);
      expect(q.kql.endsWith("\n")).toBe(false);
    }
  });

  it("쿼리 → 입력 종류·문 대응", () => {
    expect(RG_QUERIES.map((q) => [q.kind, q.doors])).toEqual([["csv-rg-storage", ["key", "sto"]], ["csv-rg-nsg", ["net"]]]);
  });

  it("ccQuery ID 형식: cc-rg-<종류>/<버전>", () => {
    expect(RG_QUERY_ID_RE.exec("cc-rg-storage/1")?.slice(1)).toEqual(["storage", "1"]);
    expect(RG_QUERY_ID_RE.exec("cc-rg-nsg/12")?.slice(1)).toEqual(["nsg", "12"]);
    expect(RG_QUERY_ID_RE.test("cc-rg-storage")).toBe(false);
    expect(RG_QUERY_ID_RE.test("cc-rg-other/1")).toBe(false);
  });
});
