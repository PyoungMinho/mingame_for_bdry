// src/lib/cloudcheck/parse/csv.ts — RFC 4180 CSV 파서 (방향서 §4-7)
// 따옴표 · 이스케이프된 따옴표("") · 따옴표 안의 쉼표·줄바꿈 · CRLF/LF/CR · BOM 제거. 열 개수가 머리글과 다른 행도 그대로 돌려준다(추측해서 맞추지 않는다 → 호출자가 모호한 행으로 처리).
// IAM 사용자 이름에는 쉼표가 들어갈 수 있어 CSV 한 줄을 쉼표로 자르면 안 된다.
export interface CsvTable {
  readonly header: readonly string[];
  /** 데이터 행(머리글 제외). 빈 줄은 건너뛴다 */
  readonly rows: readonly (readonly string[])[];
  /** rows[i]의 스프레드시트 행 번호(머리글 = 1, 첫 데이터 행 = 2 · 빈 줄도 번호를 차지한다) */
  readonly rowNumbers: readonly number[];
}
export type CsvResult =
  | { readonly ok: true; readonly table: CsvTable }
  | { readonly ok: false; readonly reason: "empty" | "unterminated-quote"; readonly line: number; readonly col: number };

export function parseCsv(input: string): CsvResult {
  const text = input.charCodeAt(0) === 0xfeff ? input.slice(1) : input;
  const records: string[][] = [];
  const numbers: number[] = [];
  let row: string[] = [];
  let field = "", inQuotes = false, quoteLine = 1, quoteCol = 1;
  let line = 1, col = 1, record = 1;   // record = 스프레드시트 행 번호
  const end = (): void => {
    row.push(field);
    if (!(row.length === 1 && row[0] === "")) { records.push(row); numbers.push(record); }
    row = []; field = ""; record++;
  };
  const n = text.length;
  for (let i = 0; i < n; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') { if (text[i + 1] === '"') { field += '"'; i++; col += 2; continue; } inQuotes = false; col++; continue; }
      field += c;
      if (c === "\n") { line++; col = 1; } else col++;
      continue;
    }
    if (c === '"' && field === "") { inQuotes = true; quoteLine = line; quoteCol = col; col++; continue; }
    if (c === ",") { row.push(field); field = ""; col++; continue; }
    if (c === "\r" || c === "\n") { if (c === "\r" && text[i + 1] === "\n") i++; end(); line++; col = 1; continue; }
    field += c; col++;
  }
  if (inQuotes) return { ok: false, reason: "unterminated-quote", line: quoteLine, col: quoteCol };
  if (field !== "" || row.length > 0) end();
  if (records.length === 0) return { ok: false, reason: "empty", line: 1, col: 1 };
  return { ok: true, table: { header: records[0].map((h) => h.trim()), rows: records.slice(1), rowNumbers: numbers.slice(1) } };
}
