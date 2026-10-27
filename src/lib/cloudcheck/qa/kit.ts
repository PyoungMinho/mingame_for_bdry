// src/lib/cloudcheck/qa/kit.ts — QA 공용 도구(테스트가 아니다. vitest는 *.test.ts만 모은다). 소유: QA(방향서 §3).
// 원시 파일(수집기 JSON · 자격증명 보고서 CSV · Resource Graph CSV) → recognize → buildInput → judge 전체 경로를 한 줄로 돌리고,
// '증거를 줄여도 이상 없음이 새로 생기지 않는다'(INV-3 확장) 오라클과 대상(MatchKey) 단위 비교를 제공한다.
// 엔진 코드를 고치지 않는다. 오라클은 fixtures/report-invariants.ts(checkReport)를 재사용한다.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { NormalizedInput } from "../contract/normalized";
import { judge } from "../engine/judge";
import { checkReport } from "../fixtures/report-invariants";
import type { InputRecognition, InputVia, ItemResult, Report, RuleId, RuleResult, Status } from "../model/report";
import { buildInput } from "../parse/normalize";
import { recognize } from "../parse/recognize";

/* eslint-disable @typescript-eslint/no-explicit-any */
export type Json = any;

export const COMPANIES_DIR = join(__dirname, "..", "fixtures", "companies");
export const SETS = ["A", "B", "C", "D"] as const;
export type SetId = (typeof SETS)[number];
export type CloudId = "aws" | "azure";
/** 회사 파일의 기준 시각(worlds-*.ts COLLECTED) */
export const COLLECTED_ISO = "2026-10-19T03:15:00Z";
export const COLLECTED_MS = Date.UTC(2026, 9, 19, 3, 15, 0);
export const DAY = 86_400_000;

/** 회사 수집기 JSON(깊은 사본) */
export const companyJson = (cloud: CloudId, set: SetId): Json => JSON.parse(readFileSync(join(COMPANIES_DIR, `${cloud}-${set}.json`), "utf8"));
/** 회사 자격증명 보고서 CSV 원문 */
export const companyCsv = (set: SetId): string => readFileSync(join(COMPANIES_DIR, `aws-${set}.credential-report.csv`), "utf8");
/** 수집기 결과 파일 이름(파일 이름 시각 = 수집 시각) */
export const collectorName = (cloud: CloudId): string => (cloud === "aws" ? "cloudcheck-aws-3333-20261019T031500Z.json" : "cloudcheck-azure-0001-20261019T031500Z.json");

export const enc = (x: unknown): Uint8Array => new TextEncoder().encode(typeof x === "string" ? x : JSON.stringify(x));

export interface FileIn {
  readonly content: unknown;          // 문자열(원문) 또는 JSON 값
  readonly name?: string;
  readonly via?: InputVia;
  readonly lastModified?: number | null;
}
export type Run =
  | { readonly kind: "rejected"; readonly status: string; readonly recs: readonly InputRecognition[] }
  | { readonly kind: "build-fail"; readonly recs: readonly InputRecognition[] }
  | { readonly kind: "ok"; readonly input: NormalizedInput; readonly report: Report; readonly recs: readonly InputRecognition[] };

export function recOf(f: FileIn): InputRecognition {
  return recognize({ via: f.via ?? "file", name: f.name ?? "input.json", bytes: enc(f.content), lastModified: f.lastModified ?? null });
}

/** 파일 여러 개 → 리포트. 모든 입력이 거부되면 rejected, 정규화가 실패하면 build-fail */
export function runFiles(files: readonly FileIn[]): Run {
  const recs = files.map(recOf);
  if (recs.every((r) => r.status !== "ok")) return { kind: "rejected", status: recs.map((r) => r.status).join(","), recs };
  const b = buildInput(recs);
  if (!b.ok) return { kind: "build-fail", recs: b.recognitions };
  return { kind: "ok", input: b.input, report: judge(b.input), recs: b.recognitions };
}
export const runJson = (json: unknown, o: Omit<FileIn, "content"> = {}): Run => runFiles([{ content: json, name: o.name ?? collectorName(cloudOfJson(json)), via: o.via ?? "file", lastModified: o.lastModified ?? null }]);
export const runCsv = (text: string, o: Omit<FileIn, "content"> = {}): Run => runFiles([{ content: text, name: o.name ?? "credential-report.csv", via: o.via ?? "file", lastModified: o.lastModified === undefined ? COLLECTED_MS : o.lastModified }]);
const cloudOfJson = (j: unknown): CloudId => ((j as { cloud?: string } | null)?.cloud === "azure" ? "azure" : "aws");

/** ok가 아니면 던진다(전제 조건 확인용) */
export function okReport(r: Run, what = "입력"): Report {
  if (r.kind !== "ok") throw new Error(`${what}: ${r.kind}${r.kind === "rejected" ? ` (${r.status})` : ""}`);
  return r.report;
}

/* ───────── 리포트 읽기 ───────── */
export const rulesOf = (r: Report): RuleResult[] => r.doors.flatMap((d) => d.rules);
export function ruleOf(r: Report, id: RuleId): RuleResult {
  const x = rulesOf(r).find((y) => y.ruleId === id);
  if (x === undefined) throw new Error(`룰 없음: ${id}`);
  return x;
}
export const statusOf = (r: Report, id: RuleId): Status => ruleOf(r, id).status;
/** 룰 상태 + 확인 불가면 (첫 사유) — 실패 메시지용 */
export const label = (x: RuleResult): string => (x.status === "unknown" ? `unknown(${x.why.code})` : x.status);
export const nameText = (i: ItemResult): string => (i.resource.name.kind === "sensitive" ? i.resource.name.full : i.resource.name.kind === "plain" ? i.resource.name.text : "(가림)");
/** 룰 하나의 대상들: [상태, 이름, 사유 slug] */
export const itemsOf = (x: RuleResult): string[] => x.items.map((i) => `${i.status}:${nameText(i)}:${i.why.code.includes(":") ? i.why.code.slice(i.why.code.indexOf(":") + 1) : i.why.code}`);
/** 리포트 전체의 대상 상태: `${ruleId}|${MatchKey}` → 상태들 */
export function itemStatuses(r: Report): Map<string, Status[]> {
  const m = new Map<string, Status[]>();
  for (const x of rulesOf(r)) for (const i of x.items) { const k = `${x.ruleId}|${i.resource.key}`; m.set(k, [...(m.get(k) ?? []), i.status]); }
  return m;
}

export const NEGATIVE: ReadonlySet<Status> = new Set<Status>(["clear", "na"]);
const ITEM_RANK: Readonly<Record<Status, number>> = { risk: 0, caution: 1, unknown: 2, clear: 3, na: 4 };

/**
 * 단조성 오라클(INV-3을 원시 파일까지 확장): before에서 '없음 결론'(이상 없음·해당 없음)이 아니던 룰이 after에서 없음 결론이 되면 위반.
 * 대상 단위: before에 있던 같은 (룰, MatchKey) 대상이 이상 없음이 아니었는데 after에서 이상 없음이 되면 위반.
 * after의 checkReport 위반도 함께 돌려준다.
 */
export function monotoneViolations(before: Report, after: Report, what = ""): string[] {
  const out = checkReport(after).map((v) => `${what} checkReport: ${v}`);
  const was = new Map(rulesOf(before).map((x) => [x.ruleId, x]));
  for (const a of rulesOf(after)) {
    const b = was.get(a.ruleId);
    if (b === undefined) continue;
    if (!NEGATIVE.has(b.status) && NEGATIVE.has(a.status)) out.push(`${what} ${a.ruleId}: ${label(b)} → ${label(a)}`);
    const prev = new Map<string, Status>();
    for (const i of b.items) { const p = prev.get(i.resource.key); if (p === undefined || ITEM_RANK[i.status] < ITEM_RANK[p]) prev.set(i.resource.key, i.status); }
    for (const i of a.items) {
      const p = prev.get(i.resource.key);
      if (p !== undefined && p !== "clear" && i.status === "clear") out.push(`${what} ${a.ruleId} ${i.resource.key}: ${p} → clear`);
    }
  }
  return out;
}

/** 결정적 의사 난수(mulberry32) — 시드 고정 표본용 */
export function rng(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
/** 배열에서 n개를 시드 고정으로 고른다(순서 유지). n ≥ 길이면 전부 */
export function sample<T>(xs: readonly T[], n: number, seed: number): T[] {
  if (n >= xs.length) return [...xs];
  const r = rng(seed);
  const idx = xs.map((_, i) => i);
  for (let i = idx.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [idx[i], idx[j]] = [idx[j], idx[i]]; }
  return idx.slice(0, n).sort((a, b) => a - b).map((i) => xs[i]);
}

/* ───────── 원시 JSON 도우미 ───────── */
export type Path = readonly (string | number)[];
export const clone = <T>(x: T): T => structuredClone(x);
export function getAt(root: Json, path: Path): Json {
  let cur = root;
  for (const k of path) cur = cur?.[k];
  return cur;
}
export function setAt(root: Json, path: Path, value: unknown): void {
  let cur = root;
  for (const k of path.slice(0, -1)) cur = cur[k];
  cur[path[path.length - 1]] = value;
}
export function deleteAt(root: Json, path: Path): void {
  let cur = root;
  for (const k of path.slice(0, -1)) cur = cur[k];
  const last = path[path.length - 1];
  if (Array.isArray(cur)) cur.splice(Number(last), 1);
  else delete cur[last];
}
/** 패턴(문자열 키 · 숫자 · "*" = 아무 키·인덱스)에 맞는 실제 경로들(값이 있는 것만) */
export function pathsMatching(root: Json, pattern: Path): Path[] {
  const out: Path[] = [];
  const go = (cur: Json, i: number, path: Path): void => {
    if (cur === undefined) return;
    if (i === pattern.length) { out.push(path); return; }
    const p = pattern[i];
    if (p === "*") {
      if (Array.isArray(cur)) cur.forEach((v, k) => go(v, i + 1, [...path, k]));
      else if (typeof cur === "object" && cur !== null) for (const [k, v] of Object.entries(cur)) go(v, i + 1, [...path, k]);
      return;
    }
    if (typeof cur !== "object" || cur === null) return;
    go(cur[p], i + 1, [...path, p]);
  };
  go(root, 0, []);
  return out;
}
/** 모든 리프(원시 값) 경로. 빈 배열·빈 객체는 리프로 본다 */
export function leafPaths(x: unknown, path: Path = [], out: Path[] = []): Path[] {
  if (Array.isArray(x)) { if (x.length === 0) out.push(path); x.forEach((v, i) => leafPaths(v, [...path, i], out)); }
  else if (typeof x === "object" && x !== null) { const e = Object.entries(x); if (e.length === 0) out.push(path); for (const [k, v] of e) leafPaths(v, [...path, k], out); }
  else out.push(path);
  return out;
}
/** 영수증 id → 그 영수증을 가리키는 {receipt, value|items} 객체 경로들 */
export function receiptRefs(file: Json): Map<string, Path[]> {
  const out = new Map<string, Path[]>();
  const walk = (x: unknown, path: Path): void => {
    if (Array.isArray(x)) { x.forEach((v, i) => walk(v, [...path, i])); return; }
    if (typeof x !== "object" || x === null) return;
    const o = x as Record<string, unknown>;
    if (typeof o.receipt === "string" && path[0] !== "receipts") out.set(o.receipt, [...(out.get(o.receipt) ?? []), path]);
    for (const [k, v] of Object.entries(o)) if (k !== "receipt") walk(v, [...path, k]);
  };
  walk(file, []);
  return out;
}
export const receiptById = (file: Json, id: string): Json => (file.receipts as Json[]).find((r) => r.id === id);

/** 실패 결과의 오류 코드(수집기 표기 흉내) */
export const FAIL_CODE: Readonly<Record<"denied" | "error" | "throttled" | "unsupported", string>> = {
  denied: "AccessDenied", error: "InternalError", throttled: "Throttling", unsupported: "UnsupportedOperation",
};

/* ───────── 이름 바꾸기(조인 유지: 목록 · 보고서 CSV 원문 · 영수증 resource를 함께) ───────── */
export function renameUser(f: Json, from: string, to: string): void {
  const u = (f.data.iamUsers.items as Json[]).find((x) => x.userName === from);
  if (u === undefined) throw new Error(`사용자 없음 ${from}`);
  u.userName = to;
  const csvTo = /[",\n\r]/.test(to) ? `"${to.replace(/"/g, '""')}"` : to;
  f.data.credentialReport.value.csv = (f.data.credentialReport.value.csv as string).split(`\n${from},arn:aws:iam::`).join(`\n${csvTo},arn:aws:iam::`).split(`:user/${from},`).join(`:user/${to.replace(/[",\n\r]/g, "_")},`);
  for (const r of f.receipts as Json[]) if (r.resource === from) r.resource = to;
}
export function renameBucket(f: Json, from: string, to: string): void {
  const b = (f.data.buckets.items as Json[]).find((x) => x.name === from);
  if (b === undefined) throw new Error(`버킷 없음 ${from}`);
  b.name = to;
  for (const r of f.receipts as Json[]) if (r.resource === from) r.resource = to;
}
export function renameRole(f: Json, from: string, to: string): void {
  const r = (f.data.iamRoles.value as Json[]).find((x) => x.roleName === from);
  if (r === undefined) throw new Error(`역할 없음 ${from}`);
  r.roleName = to;
}
export function renameGroup(f: Json, from: string, to: string): void {
  for (const g of f.data.iamGroups as Json[]) if (g.groupName === from) g.groupName = to;
  for (const u of f.data.iamUsers.items as Json[]) if (Array.isArray(u.groupNames?.value)) u.groupNames.value = u.groupNames.value.map((n: string) => (n === from ? to : n));
  for (const r of f.receipts as Json[]) if (r.resource === from) r.resource = to;
}

/** CSV 한 줄을 칸으로(따옴표 없는 단순 CSV 전용 — 회사 CSV는 따옴표를 쓰지 않는다) */
export const csvRows = (text: string): string[][] => text.split(/\r?\n/).filter((l) => l !== "").map((l) => l.split(","));
export const csvText = (rows: readonly (readonly string[])[]): string => `${rows.map((r) => r.join(",")).join("\n")}\n`;
/** 자격증명 보고서 CSV에서 열 이름으로 칸을 고친다 */
export function csvSet(text: string, user: string, col: string, value: string): string {
  const rows = csvRows(text);
  const ci = rows[0].indexOf(col);
  if (ci < 0) throw new Error(`열 없음: ${col}`);
  let hit = false;
  for (const r of rows.slice(1)) if (r[0] === user) { r[ci] = value; hit = true; }
  if (!hit) throw new Error(`행 없음: ${user}`);
  return csvText(rows);
}
