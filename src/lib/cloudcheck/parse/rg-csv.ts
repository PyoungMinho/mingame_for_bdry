// src/lib/cloudcheck/parse/rg-csv.ts — Azure Resource Graph CSV 읽기 (방향서 §4-7)
// 우리가 공개한 쿼리 2개(contract/rg-queries.ts)의 결과만 받는다. 쿼리 버전은 ccQuery 상수 열로 확인한다(INV-10).
// Resource Graph는 권한 없는 리소스를 표시 없이 빼므로 이 출처는 scopeProven = false로 고정이다(룰 수준 '없음'을 만들 수 없다).
import { RG_NSG_COLUMNS, RG_QUERY_ID_RE, RG_STORAGE_COLUMNS } from "../contract/rg-queries";
import type { CsvTable } from "./csv";

export type RgKind = "csv-rg-storage" | "csv-rg-nsg";
export interface RgRow {
  readonly rowNumber: number;
  readonly get: (col: string) => string;
  /** 머리글 순서의 원본 칸(청소 단계가 칸마다 비밀 모양을 지울 때 쓴다) */
  readonly cells: readonly string[];
}
export interface RgTable {
  readonly kind: RgKind;
  readonly rows: readonly RgRow[];
  readonly totalRows: number;
  readonly ambiguous: readonly number[];
  readonly missingColumns: readonly string[];
  /** 머리글에 두 번 이상 나오는 열 이름. 첫 열만 읽게 되므로 출처가 모호하다 */
  readonly duplicateColumns: readonly string[];
  readonly tenantId: string | null;
  /** 열 이름 → 칸 위치(첫 번째 같은 이름) */
  readonly index: ReadonlyMap<string, number>;
}
/** 쿼리마다 꼭 있어야 하는 열(나머지 열은 없어도 그 칸만 확인 불가) */
const CORE: Readonly<Record<RgKind, readonly string[]>> = {
  "csv-rg-storage": ["ccQuery", "tenantId", "id", "subscriptionId", "name", "location", "allowBlobPublicAccess"],
  "csv-rg-nsg": ["ccQuery", "tenantId", "nsgId", "subscriptionId", "nsgName", "ruleName", "direction", "access", "priority", "protocol"],
};
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type RgDetect =
  | { readonly status: "ok"; readonly kind: RgKind; readonly queryId: string }
  | { readonly status: "other-version"; readonly kind: RgKind; readonly version: number }
  | { readonly status: "not-ours" }
  | { readonly status: "unknown" };

/** 머리글과 첫 데이터 행의 ccQuery 값으로 어떤 쿼리의 결과인지 판별한다 */
export function detectRg(t: CsvTable): RgDetect {
  const header = t.header;
  const idx = header.indexOf("ccQuery");
  const hasStorage = RG_STORAGE_COLUMNS.every((c) => header.includes(c));
  const hasNsg = RG_NSG_COLUMNS.every((c) => header.includes(c));
  if (idx >= 0 && t.rows.length > 0) {
    const m = RG_QUERY_ID_RE.exec((t.rows[0][idx] ?? "").trim());
    if (!m) return { status: "not-ours" };
    const kind: RgKind = m[1] === "storage" ? "csv-rg-storage" : "csv-rg-nsg";
    const version = Number(m[2]);
    if (version !== 1) return { status: "other-version", kind, version };
    return { status: "ok", kind, queryId: `cc-rg-${m[1]}/${m[2]}` };
  }
  // 데이터 행이 없으면(결과 0건) 열 구성으로만 판별한다 — 결과 0건은 어차피 '없음'을 증명하지 못한다
  if (idx >= 0 && hasStorage) return { status: "ok", kind: "csv-rg-storage", queryId: "cc-rg-storage/1" };
  if (idx >= 0 && hasNsg) return { status: "ok", kind: "csv-rg-nsg", queryId: "cc-rg-nsg/1" };
  return idx >= 0 ? { status: "not-ours" } : { status: "unknown" };
}

export function readRg(t: CsvTable, kind: RgKind): RgTable {
  const index = new Map<string, number>();
  const seen = new Set<string>();
  const dup = new Set<string>();
  t.header.forEach((c, i) => { if (!index.has(c)) index.set(c, i); if (seen.has(c)) dup.add(c); seen.add(c); });
  const all: RgRow[] = [];
  const ambiguous: number[] = [];
  t.rows.forEach((fields, k) => {
    const rowNumber = t.rowNumbers[k] ?? k + 2;
    if (fields.length !== t.header.length) { ambiguous.push(rowNumber); return; }
    all.push({ rowNumber, get: (col: string): string => { const i = index.get(col); return i === undefined ? "" : (fields[i] ?? "").trim(); }, cells: fields });
  });
  // 이 표의 테넌트 = 처음 읽히는 행의 tenantId. 다른 테넌트의 행(또는 테넌트를 알 수 없는 행)은 쓰지 않고 모호한 행으로 센다(CC-QA-10과 같은 모양)
  let tenantId: string | null = null;
  for (const r of all) { const v = r.get("tenantId"); if (UUID_RE.test(v)) { tenantId = v.toLowerCase(); break; } }
  const rows: RgRow[] = [];
  for (const r of all) {
    const v = r.get("tenantId");
    if (tenantId === null || (UUID_RE.test(v) && v.toLowerCase() === tenantId)) rows.push(r);
    else ambiguous.push(r.rowNumber);
  }
  ambiguous.sort((x, y) => x - y);
  return { kind, rows, totalRows: t.rows.length, ambiguous, missingColumns: CORE[kind].filter((c) => !index.has(c)), duplicateColumns: [...dup], tenantId, index };
}

/** ARG tostring(array) → 문자열 배열. 빈 칸·"[]"·null은 빈 배열, JSON 배열이 아니면 null(해석 불가) */
export function arrayCell(s: string): string[] | null {
  const v = s.trim();
  if (v === "" || v === "[]" || v === "null") return [];
  try {
    const x: unknown = JSON.parse(v);
    return Array.isArray(x) && x.every((e) => typeof e === "string") ? (x as string[]) : null;
  } catch { return null; }
}
/** 불리언 칸: true/false(대소문자 무시) → boolean, 빈 칸 → null(미설정), 그 밖 → undefined(해석 불가) */
export function tristateCell(s: string): boolean | null | undefined {
  const v = s.trim().toLowerCase();
  if (v === "") return null;
  return v === "true" ? true : v === "false" ? false : undefined;
}
