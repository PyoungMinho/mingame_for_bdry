// src/lib/cloudcheck/parse/entra-csv.ts — Entra '사용자 등록 세부 정보' 포털 CSV 읽기 (AZ-MFA-1 조건부, released: false)
// 포털 CSV의 열 구성은 [미확인]이다 → 열 이름을 느슨하게(대소문자·공백·밑줄 무시) 매칭하고, 해석하지 못한 칸은 그 칸만 확인 불가로 둔다.
// 이 CSV에는 테넌트 ID가 없다: 신원 출처가 될 수 없고, 다른 Azure 입력이 있어야 한 리포트에 합쳐진다.
import type { CsvTable } from "./csv";

export interface EntraRow { readonly rowNumber: number; readonly user: string; readonly isAdmin: boolean | undefined; readonly mfaCapable: boolean | undefined; readonly mfaRegistered: boolean | undefined; readonly columns: { readonly admin: string; readonly capable: string; readonly registered: string } }
export interface EntraTable {
  readonly rows: readonly EntraRow[]; readonly totalRows: number; readonly ambiguous: readonly number[]; readonly missingColumns: readonly string[];
  /** 정규화한 열 이름이 겹치는 머리글(같은 뜻의 열이 두 개). 첫 열만 읽게 되므로 출처가 모호하다 */
  readonly duplicateColumns: readonly string[];
}

const norm = (s: string): string => s.toLowerCase().replace(/[^a-z0-9]/g, "");
const find = (h: readonly string[], ...names: string[]): number => h.findIndex((x) => names.includes(norm(x)));

export function isEntraHeader(header: readonly string[]): boolean {
  const n = header.map(norm);
  return (n.includes("userprincipalname") || n.includes("upn")) && (n.includes("ismfaregistered") || n.includes("ismfacapable") || n.includes("mfaregistered"));
}
const boolish = (s: string): boolean | undefined => {
  const v = s.trim().toLowerCase();
  return v === "true" || v === "yes" ? true : v === "false" || v === "no" ? false : undefined;
};

export function readEntra(t: CsvTable): EntraTable {
  const iUpn = find(t.header, "userprincipalname", "upn");
  const iName = find(t.header, "name", "displayname", "username");
  const iAdmin = find(t.header, "isadmin", "admin");
  const iCap = find(t.header, "ismfacapable", "mfacapable");
  const iReg = find(t.header, "ismfaregistered", "mfaregistered");
  const missing = [["userPrincipalName", iUpn], ["isMfaRegistered", iReg]].filter(([, i]) => i === -1).map(([n]) => String(n));
  const rows: EntraRow[] = [];
  const ambiguous: number[] = [];
  t.rows.forEach((f, k) => {
    const rowNumber = t.rowNumbers[k] ?? k + 2;
    if (f.length !== t.header.length) { ambiguous.push(rowNumber); return; }
    const cell = (i: number): string => (i >= 0 ? (f[i] ?? "") : "");
    rows.push({
      rowNumber, user: (iUpn >= 0 ? cell(iUpn) : cell(iName)).trim(),
      isAdmin: iAdmin >= 0 ? boolish(cell(iAdmin)) : undefined, mfaCapable: iCap >= 0 ? boolish(cell(iCap)) : undefined, mfaRegistered: iReg >= 0 ? boolish(cell(iReg)) : undefined,
      columns: { admin: iAdmin >= 0 ? t.header[iAdmin] : "", capable: iCap >= 0 ? t.header[iCap] : "", registered: iReg >= 0 ? t.header[iReg] : "" },
    });
  });
  const names = t.header.map(norm);
  const duplicateColumns = [...new Set(names.filter((n, i) => n !== "" && names.indexOf(n) !== i))];
  return { rows, totalRows: t.rows.length, ambiguous, missingColumns: missing, duplicateColumns };
}
