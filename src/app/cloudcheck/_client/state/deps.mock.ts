// src/app/cloudcheck/_client/state/deps.mock.ts — 목업 기반 EngineDeps(테스트·미리보기 전용). 소유: 페이지개발자.
// 운영 번들에 넣지 않는다: main.tsx는 이 파일을 import하지 않는다(미리보기용으로 잠시 import하는 것만 허용 — 최종 상태에는 import 0).
// 실제 엔진이 나오면(state/deps.real.ts) 같은 화면 테스트를 실제 judge() 출력으로 다시 돌린다(방향서 §3 규칙 2).
//
// 동작(파일 이름으로 시나리오를 고른다 — 내용은 보지 않는다):
//   cloudcheck-demo-<A|B|C|D>.<aws|azure>.json (via demo) → 그 세트의 체험 리포트
//   *.csv                       → 자격증명 보고서 CSV(현관·열쇠만)
//   이름에 empty / cut / exceptions / credentials / huge  → 각각 빈 파일 · 잘림 · 예외 파일 · 키 파일 · 크기 초과 거부
//   이름에 other                 → 다른 계정(끝 4자리 9999) — buildInput이 account-mismatch로 뺀다
//   이름에 azure                 → 다른 클라우드 — cloud-mismatch
//   이름에 after                 → 같은 계정, 더 늦은 수집 시각(재점검 비교용)
//   그 밖                        → 실제 모드 리포트(REPORT_REAL_D)
import type { ExceptionsFile } from "../../../../lib/cloudcheck/contract/exceptions-schema";
import type { NormalizedInput } from "../../../../lib/cloudcheck/contract/normalized";
import type {
  Comparison,
  CompareSide,
  DemoSetId,
  ExceptionOverlay,
  InputRecognition,
  IsoDate,
  IsoUtc,
  Label,
  ParsedHandle,
  Report,
  RuleChange,
  RuleId,
  Status,
  TimeNotice,
} from "../../../../lib/cloudcheck/model/report";
import { MOCK_ENGINE } from "../mocks/build";
import { MOCK_CATALOG } from "../mocks/catalog";
import {
  RECOG_CREDENTIALS_FILE,
  RECOG_EMPTY,
  RECOG_NOT_CLOUDCHECK,
  RECOG_OK_AWS,
  RECOG_OK_CSV,
  RECOG_PARSE_ERROR,
  RECOG_TOO_LARGE,
} from "../mocks/inputs";
import { MOCK_REPORTS, REPORT_AZURE_A, REPORT_REAL_D } from "../mocks/reports";
import type { BuildInputResult, EngineDeps, ParseExceptionsResult, RecognizeSource } from "./deps";

const DEMO_NAME = /^cloudcheck-demo-([ABCD])\.(aws|azure)\.json$/;
const AFTER_AS_OF: IsoUtc = "2026-10-19T07:00:00Z" as IsoUtc;

/** 핸들 안의 내용: 이 입력이 만들 리포트(UI는 열어 보지 않는다 — 목업만 읽는다) */
interface MockHandle {
  readonly report: Report;
}

const handleOf = (report: Report): ParsedHandle => ({ report } as MockHandle) as unknown as ParsedHandle;
const reportOf = (h: ParsedHandle | null): Report | null => (h === null ? null : (h as unknown as MockHandle).report);

/** 입력(NormalizedInput) → 리포트. 입력은 불투명 토큰이다 */
const INPUT_REPORT = new WeakMap<object, Report>();

function fileNameValue(name: string, index: number): InputRecognition["name"] {
  return { kind: "sensitive", type: "fileName", full: name, masked: `file-${String(index).padStart(3, "0")}`, flags: [] };
}

function demoReport(set: DemoSetId, cloud: "aws" | "azure"): Report {
  if (cloud === "azure") return REPORT_AZURE_A;
  return MOCK_REPORTS[set];
}

function withAsOf(report: Report, at: IsoUtc): Report {
  return { ...report, collection: { ...report.collection, asOf: { at, source: "collected-at" } } };
}

export function mockRecognize(src: RecognizeSource): InputRecognition {
  const lower = src.name.toLowerCase();
  const name = fileNameValue(src.name, 1);
  const demo = DEMO_NAME.exec(src.name);
  if (src.via === "demo") {
    if (demo === null) return { ...RECOG_NOT_CLOUDCHECK, via: "demo", name };
    const set = demo[1] as DemoSetId;
    const cloud = demo[2] as "aws" | "azure";
    const report = demoReport(set, cloud);
    return {
      ...RECOG_OK_AWS,
      via: "demo",
      name: { kind: "plain", text: `cloudcheck-demo.${cloud}.json` },
      bytes: src.bytes.length,
      identityPreview: { cloud, accountLast4: report.identity.accountLast4, alias: report.identity.alias },
      handle: handleOf(report),
    };
  }
  const bytes = src.bytes.length;
  if (lower.includes("empty") || bytes === 0) return { ...RECOG_EMPTY, via: src.via, name, bytes };
  if (lower.includes("huge")) return { ...RECOG_TOO_LARGE, via: src.via, name, bytes };
  if (lower.includes("cut")) return { ...RECOG_PARSE_ERROR, via: src.via, name, bytes };
  if (lower.includes("exceptions")) return { ...RECOG_NOT_CLOUDCHECK, via: src.via, name, bytes };
  if (lower.includes("credentials")) return { ...RECOG_CREDENTIALS_FILE, via: src.via, name, bytes };
  if (lower.endsWith(".csv")) {
    return { ...RECOG_OK_CSV, via: src.via, name, bytes, handle: handleOf(REPORT_REAL_D) };
  }
  let report = REPORT_REAL_D;
  if (lower.includes("other")) report = { ...report, identity: { ...report.identity, accountLast4: "9999", alias: null } };
  if (lower.includes("azure")) report = { ...report, identity: { ...report.identity, cloud: "azure", accountLast4: "0000", alias: null } };
  if (lower.includes("after")) report = withAsOf(report, AFTER_AS_OF);
  const identity: NonNullable<InputRecognition["identityPreview"]> = { cloud: report.identity.cloud, accountLast4: report.identity.accountLast4, alias: report.identity.alias };
  return {
    ...RECOG_OK_AWS,
    via: src.via,
    name,
    bytes,
    identityPreview: identity,
    asOf: report.collection.asOf,
    handle: handleOf(report),
  };
}

export function mockBuildInput(recs: readonly InputRecognition[]): BuildInputResult {
  const out: InputRecognition[] = [];
  let first: InputRecognition | null = null;
  const seen = new Set<string>();
  for (const r of recs) {
    if (r.status !== "ok" || r.identityPreview === null) {
      out.push(r);
      continue;
    }
    if (first === null || first.identityPreview === null) {
      first = r;
      seen.add(`${r.identityPreview.cloud}|${r.identityPreview.accountLast4}|${r.asOf?.at ?? ""}`);
      out.push(r);
      continue;
    }
    if (r.identityPreview.cloud !== first.identityPreview.cloud) {
      out.push({ ...r, status: "cloud-mismatch", handle: null });
    } else if (r.identityPreview.accountLast4 !== first.identityPreview.accountLast4) {
      out.push({ ...r, status: "account-mismatch", handle: null });
    } else {
      const k = `${r.identityPreview.cloud}|${r.identityPreview.accountLast4}|${r.asOf?.at ?? ""}`;
      if (seen.has(k)) out.push({ ...r, status: "superseded", handle: null });
      else {
        seen.add(k);
        out.push(r);
      }
    }
  }
  const report = first === null ? null : reportOf(first.handle);
  if (first === null || report === null) return { ok: false, recognitions: out };
  const input = {} as unknown as NormalizedInput;
  INPUT_REPORT.set(input, report);
  return { ok: true, input, recognitions: out };
}

export function mockJudge(input: NormalizedInput): Report {
  const report = INPUT_REPORT.get(input);
  if (report === undefined) throw new Error("mock: unknown input");
  return report;
}

const HOUR_MS = 3_600_000;
export function mockTimeNotices(report: Report, now: IsoUtc): TimeNotice[] {
  if (report.mode.kind === "demo") return [];
  const asOf = report.collection.asOf;
  if (asOf === null) return [];
  const diff = Date.parse(now) - Date.parse(asOf.at);
  const hours = Math.floor(diff / HOUR_MS);
  const out: TimeNotice[] = [];
  if (hours >= 168) out.push({ kind: "snapshot-age", level: "very-stale", ageHours: hours });
  else if (hours >= 24) out.push({ kind: "snapshot-age", level: "stale", ageHours: hours });
  if (diff < -5 * 60_000) out.push({ kind: "future-timestamp", aheadMinutes: Math.round(-diff / 60_000) });
  return out;
}

type ExceptionLabel = Extract<Label, { kind: "exception" }>;
export function mockOverlayExceptions(report: Report, file: ExceptionsFile | null, today: IsoDate): ExceptionOverlay {
  const byItemId = new Map<string, ExceptionLabel>();
  const entries: { index: number; state: "active" | "expired" | "unmatched" }[] = [];
  const counts = { active: 0, expired: 0, unmatched: 0 };
  (file === null ? [] : file.entries).forEach((e, index) => {
    let matched = false;
    for (const door of report.doors) {
      for (const rule of door.rules) {
        if (rule.ruleId !== e.ruleId) continue;
        for (const item of rule.items) {
          if (item.resource.key !== e.resource || (item.status !== "risk" && item.status !== "caution")) continue;
          matched = true;
          const state = e.until >= today ? "active" : "expired";
          byItemId.set(item.id, {
            kind: "exception",
            state,
            reason: { kind: "sensitive", type: "freeText", full: e.reason, masked: "•••", flags: [] },
            until: e.until as IsoDate,
            createdAt: e.createdAt as IsoDate,
          });
          counts[state] += 1;
          entries.push({ index, state });
        }
      }
    }
    if (!matched) {
      counts.unmatched += 1;
      entries.push({ index, state: "unmatched" });
    }
  });
  return { byItemId, entries, counts };
}

const RANK: Readonly<Record<Status, number>> = { risk: 3, caution: 2, clear: 1, na: 1, unknown: 0 };
function changeOf(before: Status, after: Status): RuleChange {
  if (before !== "unknown" && after === "unknown") return "became-unknown";
  if (before === "unknown" && after !== "unknown") return "became-known";
  if (before === "unknown" && after === "unknown") return "same";
  if (RANK[after] < RANK[before]) return "better";
  if (RANK[after] > RANK[before]) return "worse";
  return "same";
}
const sideOf = (r: Report): CompareSide => ({ cloud: r.identity.cloud, accountLast4: r.identity.accountLast4, alias: r.identity.alias, asOf: r.collection.asOf });

export function mockCompare(a: Report, b: Report): Comparison {
  const ordered = (a.collection.asOf?.at ?? "") <= (b.collection.asOf?.at ?? "");
  const before = ordered ? a : b;
  const after = ordered ? b : a;
  if (before.identity.cloud !== after.identity.cloud) return { ok: false, reason: "different-cloud", before: sideOf(before), after: sideOf(after) };
  if (before.identity.accountLast4 !== after.identity.accountLast4) return { ok: false, reason: "different-account", before: sideOf(before), after: sideOf(after) };
  if ((before.collection.asOf?.at ?? "") === (after.collection.asOf?.at ?? "")) return { ok: false, reason: "same-snapshot", before: sideOf(before), after: sideOf(after) };
  const byId = (r: Report): Map<RuleId, (typeof r.doors)[number]["rules"][number]> =>
    new Map(r.doors.flatMap((d) => d.rules).map((x) => [x.ruleId, x] as const));
  const bm = byId(before);
  const am = byId(after);
  const ids = [...new Set([...bm.keys(), ...am.keys()])];
  const rules = ids.map((id) => {
    const x = bm.get(id);
    const y = am.get(id);
    const bs: Status = x === undefined ? "na" : x.status;
    const as: Status = y === undefined ? "na" : y.status;
    const dist = (r: typeof x): Dist => (r === undefined ? EMPTY : r.distribution);
    return { ruleId: id, before: bs, after: as, change: changeOf(bs, as), items: { before: dist(x), after: dist(y) } };
  });
  return { ok: true, before: sideOf(before), after: sideOf(after), reordered: !ordered, sameCredentialReport: false, rules };
}
type Dist = Report["distribution"]["rules"];
const EMPTY: Dist = { total: 0, risk: 0, caution: 0, unknown: 0, clear: 0, na: 0 };

export function mockParseExceptions(text: string): ParseExceptionsResult {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    return { ok: false, issues: ["format"] };
  }
  if (typeof data !== "object" || data === null) return { ok: false, issues: ["format"] };
  const obj = data as { readonly schema?: unknown; readonly entries?: unknown };
  if (obj.schema !== "cloudcheck.exceptions/1.0" || !Array.isArray(obj.entries)) return { ok: false, issues: ["format"] };
  if (obj.entries.length > 1000) return { ok: false, issues: ["too-many"] };
  const issues = new Set<string>();
  const known = new Set(MOCK_CATALOG.map((e) => e.ruleId as string));
  const entries: ExceptionsFile["entries"] = [];
  for (const raw of obj.entries as unknown[]) {
    const e = (typeof raw === "object" && raw !== null ? raw : {}) as Record<string, unknown>;
    const reason = typeof e.reason === "string" ? e.reason.trim() : "";
    if (reason === "" || reason.length > 500) issues.add("reason");
    const until = typeof e.until === "string" && /^\d{4}-\d{2}-\d{2}$/.test(e.until) ? e.until : null;
    const created = typeof e.createdAt === "string" && /^\d{4}-\d{2}-\d{2}$/.test(e.createdAt) ? e.createdAt : null;
    if (until === null || created === null) issues.add("until");
    else {
      const span = (Date.parse(until) - Date.parse(created)) / 86_400_000;
      if (!(span >= 1 && span <= 90)) issues.add("span");
    }
    if (typeof e.ruleId !== "string" || !known.has(e.ruleId)) issues.add("rule");
    if (typeof e.resource !== "string" || e.resource === "") issues.add("format");
    if (issues.size === 0) {
      entries.push({ ruleId: e.ruleId as RuleId, resource: e.resource as string, reason, until: until as string, createdAt: created as string });
    }
  }
  if (issues.size > 0) return { ok: false, issues: [...issues] };
  return { ok: true, file: { schema: "cloudcheck.exceptions/1.0", entries } };
}

export const mockSerializeExceptions = (file: ExceptionsFile): string => `${JSON.stringify(file, null, 2)}\n`;
export const mockMaskedCopy = (): string => `${JSON.stringify({ masked: true })}\n`;

export function createMockDeps(overrides: Partial<EngineDeps> = {}): EngineDeps {
  return {
    recognize: mockRecognize,
    buildInput: mockBuildInput,
    judge: mockJudge,
    timeNotices: mockTimeNotices,
    overlayExceptions: mockOverlayExceptions,
    compare: mockCompare,
    maskedCopy: mockMaskedCopy,
    parseExceptions: mockParseExceptions,
    serializeExceptions: mockSerializeExceptions,
    catalog: MOCK_CATALOG,
    rulesetVersion: MOCK_ENGINE.rulesetVersion,
    ...overrides,
  };
}
