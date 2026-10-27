// src/lib/cloudcheck/parse/sanitize.ts — R-12 입구 청소 (방향서 §4-5 ⑨): 받아들인 입력 안의 모든 문자열 값을 리포트 단위로 공유하는 Redactor에 한 번 통과시킨다.
// 비밀 모양(키 ID · 개인 키 · JWT · 연결 문자열 …)이 보이는 문자열은 지운 토큰으로 바뀐다. 같은 원문은 입력이 달라도 같은 토큰이라 조인(사용자 ↔ 영수증 ↔ 보고서 행)이 유지된다.
// 정규화 코드는 이 청소를 거친 입력만 읽는다 → 어느 칸을 옮기든 비밀이 NormalizedInput·마스킹 사본으로 새지 않는다(칸마다 fix를 붙이다 놓치는 일을 구조로 막는다).
// 원본(핸들 안의 ParsedInput)은 바꾸지 않는다: 같은 인식 결과로 buildInput을 몇 번 불러도 결과와 지운 개수가 같다.
import { ROOT_USER } from "./credential-report";
import type { ReportRow, ReportTable } from "./credential-report";
import type { EntraTable } from "./entra-csv";
import type { CollectorParsed, CsvParsed, Envelope, ParsedInput, SectionResult } from "./handle";
import type { RgRow, RgTable } from "./rg-csv";
import type { Redactor } from "./secrets";

const NO_KEYS: ReadonlySet<string> = new Set();
/** 칸 단위로 따로 청소하는 문자열 속성(자격증명 보고서 CSV 원문: 통째로 바꾸면 보고서를 읽을 수 없게 되므로 행·칸을 읽은 뒤에 칸마다 청소한다) */
const RAW_KEYS: ReadonlySet<string> = new Set(["csv"]);

function walk(x: unknown, red: Redactor, rawKeys: ReadonlySet<string>): unknown {
  if (typeof x === "string") return red.fix(x);
  if (Array.isArray(x)) return x.map((v) => walk(v, red, rawKeys));
  if (typeof x === "object" && x !== null) {
    return Object.fromEntries(Object.entries(x).map(([k, v]) => [k, typeof v === "string" && rawKeys.has(k) ? v : walk(v, red, rawKeys)]));
  }
  return x;
}

/** 값의 복사본: 문자열 잎은 모두 red.fix를 거친다(rawKeys에 든 이름의 문자열 속성은 그대로) */
export function cleanDeep<T>(x: T, red: Redactor, rawKeys: ReadonlySet<string> = NO_KEYS): T {
  return walk(x, red, rawKeys) as T;
}

/** 자격증명 보고서 표: 모든 칸을 청소한 새 표(행 번호·모호한 행·열 위치는 그대로) */
export function cleanReportTable(t: ReportTable, red: Redactor): ReportTable {
  const rows = t.rows.map((r): ReportRow => {
    const cells = r.cells.map((c) => red.fix(c));
    const get = (col: string): string | undefined => { const i = t.index.get(col); return i === undefined ? undefined : cells[i]; };
    return { rowNumber: r.rowNumber, user: get("user") ?? "", arn: get("arn") ?? "", get, cells };
  });
  return { ...t, rows, root: rows.find((r) => r.user === ROOT_USER) ?? null };
}

/** Resource Graph 표: 모든 칸을 청소한 새 표 */
export function cleanRgTable(t: RgTable, red: Redactor): RgTable {
  const rows = t.rows.map((r): RgRow => {
    const cells = r.cells.map((c) => red.fix(c));
    return { rowNumber: r.rowNumber, get: (col: string): string => { const i = t.index.get(col); return i === undefined ? "" : (cells[i] ?? "").trim(); }, cells };
  });
  return { ...t, rows };
}

/** Entra 등록 표: 사용자 이름과 열 이름을 청소한 새 표 */
export function cleanEntraTable(t: EntraTable, red: Redactor): EntraTable {
  return {
    ...t,
    rows: t.rows.map((r) => ({ ...r, user: red.fix(r.user), columns: { admin: red.fix(r.columns.admin), capable: red.fix(r.columns.capable), registered: red.fix(r.columns.registered) } })),
  };
}

/** 입력 1개의 청소본. 정규화는 이 복사본만 읽는다 */
export function sanitizeInput(p: ParsedInput, red: Redactor): ParsedInput {
  if (p.type === "csv") {
    const out: CsvParsed = {
      ...p, name: red.fix(p.name),
      report: p.report === null ? null : cleanReportTable(p.report, red),
      rg: p.rg === null ? null : cleanRgTable(p.rg, red),
      entra: p.entra === null ? null : cleanEntraTable(p.entra, red),
    };
    return out;
  }
  // 봉투의 data(섹션 검증 전 원본 레코드)는 정규화가 읽지 않는다 — 들고 가지 않는다
  const envelope = cleanDeep(Object.fromEntries(Object.entries(p.envelope).filter(([k]) => k !== "data")) as unknown as Envelope, red);
  const sections = new Map<string, SectionResult>();
  for (const [k, s] of p.sections) sections.set(k, s.ok ? { ok: true, value: cleanDeep(s.value, red, RAW_KEYS) } : s);
  const out: CollectorParsed = { ...p, name: red.fix(p.name), envelope, sections };
  return out;
}
