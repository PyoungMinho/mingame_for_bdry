// src/lib/cloudcheck/parse/normalize-aws.ts — AWS 입력(수집기 JSON · 자격증명 보고서 CSV)을 NormalizedInput의 AWS 사실로 옮긴다
// 규칙(방향서 §4-7): 수집기 경로의 사실 우선순위 = 실시간 호출 > 보고서 / 키 슬롯은 last_rotated↔CreateDate로 조인 / 키 Status 해석 /
// 보고서 행의 필드 수가 머리글과 다르면 모호한 행 / 사용자 수 교차 확인(IAM 사용자 행 수 = accountSummary.Users) / 루트 행 필수.
// 한 입력이 여러 문에 쓰이므로(mfa·key는 같은 보고서) 문마다 따로 만든다 — 같은 입력이면 내용은 같다.
import type { AwsCollect } from "../contract/collect-schema";
import { notCollectedCoverage } from "../contract/normalized";
import type {
  AwsAccessKey, AwsAccountSummary, AwsBucket, AwsCredentialReport, AwsDoors, AwsEni, AwsFamilyId, AwsIamGroup, AwsIamRole, AwsIamUser, AwsIdentity,
  AwsKeyData, AwsLogData, AwsMfaData, AwsNetData, AwsPab, AwsRoot, AwsSecurityGroup, AwsStoData, AwsTrail, AwsTrustStatement, CoverageTable,
  DoorSelection, FamilyCoverage, Instant, MissingReason, PerRegion, ReceiptKey, SectionIssue, Slot, Src, UnitCoverage,
} from "../contract/normalized";
import type { DoorId, PrincipalType, UnknownReason } from "../model/report";
import { parseCsv } from "./csv";
import { boolCell, readCredentialReport, timeCell } from "./credential-report";
import type { ReportRow, ReportTable } from "./credential-report";
import type { CollectorParsed, CsvParsed } from "./handle";
import { InputCtx, SectionInvalid, evSlot, keyOf, missing, noDup, none, part, seal, slotWhy, val } from "./normalize-common";
import { cleanReportTable } from "./sanitize";
import { parseInstant } from "./strict-time";
import type { Redactor } from "./secrets";

type AwsData = AwsCollect["data"];
type Sel = { readonly state: "selected"; readonly input: number } | { readonly state: "skipped"; readonly inputs: readonly number[] } | { readonly state: "absent" };

export interface AwsBuildArgs {
  readonly pick: Readonly<Record<DoorId, Sel>>;
  readonly asOf: (door: DoorId) => import("../contract/normalized").AsOfFact | null;
  readonly collectors: ReadonlyMap<number, InputCtx>;
  readonly csvs: ReadonlyMap<number, CsvParsed>;
  readonly red: Redactor;
  readonly issues: SectionIssue[];
  readonly identityInput: number;
}
export interface AwsBuilt { readonly identity: AwsIdentity; readonly doors: AwsDoors; readonly coverage: CoverageTable<AwsFamilyId> }

/* ───────── 보고서 ───────── */
interface ReportView {
  readonly slot: Slot<AwsCredentialReport>;
  readonly table: ReportTable | null;
  readonly byUser: ReadonlyMap<string, ReportRow>;
  readonly cell: (row: number | null, col?: string | null) => Src;
  readonly why: MissingReason;
  readonly receipt: ReceiptKey | null;     // 수집기 경로의 get-credential-report 영수증
}
const noView = (why: MissingReason, input: number, src: Src | null = null): ReportView => ({
  slot: missing(why, src), table: null, byUser: new Map(), cell: (row, col = null) => ({ input, receipt: null, csv: { kind: "csv-credential-report", row, column: col } }), why, receipt: null,
});

function viewFromTable(table: ReportTable, input: number, receipt: ReceiptKey | null, generatedAt: Instant | null, source: AwsCredentialReport["generatedAtSource"]): ReportView {
  const cell = (row: number | null, col: string | null = null): Src => ({ input, receipt, csv: { kind: "csv-credential-report", row, column: col } });
  const by = new Map<string, ReportRow>();
  for (const r of table.rows) if (!by.has(r.user)) by.set(r.user, r);
  const report: AwsCredentialReport = { generatedAt, generatedAtSource: source, rows: table.totalRows, ambiguousRows: table.ambiguous, rootRow: table.root?.rowNumber ?? null, hasAdditionalCredentialsColumn: table.hasAdditionalColumn };
  return { slot: val(report, cell(null)), table, byUser: by, cell, why: "not-collected", receipt };
}

function reportFromCollector(ctx: InputCtx, door: DoorId): ReportView {
  const sec = ctx.section<NonNullable<AwsData["credentialReport"]>>("credentialReport");
  if (sec === undefined) { ctx.addIssue(door, "credentialReport", "field-missing"); return noView("field-missing", ctx.index); }
  if (sec === null) { ctx.addIssue(door, "credentialReport", "schema-section"); return noView("schema-unsupported", ctx.index); }
  try {
    ctx.link(sec.generateReceipt, "iam:GenerateCredentialReport");
    const f = ctx.link(sec.receipt, "iam:GetCredentialReport");
    const s = evSlot(f, sec.value, (v) => v);
    if (s.k === "none") return noView("field-missing", ctx.index, s.src);
    if (s.k === "missing") return noView(s.why, ctx.index, s.src);
    const v = s.value;
    const csv = parseCsv(v.csv);
    if (!csv.ok) return noView("value-unrecognized", ctx.index, s.src);
    // CSV 원문은 칸 단위로 청소한다(R-12). 이 계정(신원)의 행만 쓴다 — 다른 계정의 행은 모호한 행이다(CC-QA-10)
    const table = cleanReportTable(readCredentialReport(csv.table, (ctx.p.envelope as { identity: { accountId: string } }).identity.accountId), ctx.red);
    if (table.missingColumns.length > 0) { ctx.addIssue(door, "credentialReport", "field-missing"); return noView("field-missing", ctx.index, s.src); }
    if (table.duplicateColumns.length > 0) { ctx.addIssue(door, "credentialReport", "schema-section"); return noView("csv-row-ambiguous", ctx.index, s.src); }
    return viewFromTable(table, ctx.index, f.key, parseInstant(v.generatedTime), "api");
  } catch (e) {
    if (!(e instanceof SectionInvalid)) throw e;
    ctx.addIssue(door, "credentialReport", "schema-section");
    return noView("schema-unsupported", ctx.index);
  }
}

function reportFromCsv(p: CsvParsed, input: number, door: DoorId, issues: SectionIssue[]): ReportView {
  const t = p.report;
  if (t === null) return noView("not-collected", input);
  if (t.missingColumns.length > 0) {
    if (!issues.some((i) => i.input === input && i.door === door && i.section === "credentialReport")) issues.push({ input, door, section: "credentialReport", reason: "field-missing" });
    return noView("field-missing", input);
  }
  if (t.duplicateColumns.length > 0) {   // 같은 열 이름이 두 번이면 첫 열만 읽게 된다 → 출처가 모호하다(CC-QA-10)
    if (!issues.some((i) => i.input === input && i.door === door && i.section === "credentialReport")) issues.push({ input, door, section: "credentialReport", reason: "schema-section" });
    return noView("csv-row-ambiguous", input);
  }
  const source: AwsCredentialReport["generatedAtSource"] = p.asOf?.source === "filename" ? "filename" : p.asOf?.source === "file-time" ? "file-time" : "unknown";
  return viewFromTable(t, input, null, p.asOf?.at ?? null, source);
}

/* ───────── 보고서 행 → 사실 ───────── */
interface ReportFacts {
  readonly createdAt: Slot<Instant>;
  readonly passwordEnabled: Slot<boolean>;
  readonly passwordLastUsed: Slot<Instant | null>;
  readonly mfaActive: Slot<boolean>;
  readonly keys: Slot<readonly AwsAccessKey[]>;
}
const NA = ["N/A"] as const;

function reportKeys(view: ReportView, row: ReportRow): Slot<readonly AwsAccessKey[]> {
  const keys: AwsAccessKey[] = [];
  for (const n of [1, 2] as const) {
    const col = `access_key_${n}_active`;
    const active = boolCell(row.get(col));
    const rotated = timeCell(row.get(`access_key_${n}_last_rotated`), NA);
    const exists = active === true || active === undefined || (active === false && rotated.kind === "time");
    if (!exists) continue;
    const used = timeCell(row.get(`access_key_${n}_last_used_date`), NA);
    const region = row.get(`access_key_${n}_last_used_region`);
    const service = row.get(`access_key_${n}_last_used_service`);
    keys.push({
      src: view.cell(row.rowNumber, col), slot: n, idSuffix: null, status: null,
      active: active === undefined ? missing("value-unrecognized", view.cell(row.rowNumber, col)) : val(active, view.cell(row.rowNumber, col)),
      createdAt: rotated.kind === "time" ? val(rotated.at, view.cell(row.rowNumber, `access_key_${n}_last_rotated`)) : missing(rotated.kind === "none" ? "field-missing" : "value-unrecognized", view.cell(row.rowNumber, `access_key_${n}_last_rotated`)),
      lastUsed: used.kind === "time" ? val<Instant | null>(used.at, view.cell(row.rowNumber, `access_key_${n}_last_used_date`)) : used.kind === "none" ? val<Instant | null>(null, view.cell(row.rowNumber, `access_key_${n}_last_used_date`)) : missing("value-unrecognized", view.cell(row.rowNumber, `access_key_${n}_last_used_date`)),
      lastUsedRegion: region === undefined || region === "N/A" || region === "" ? null : region,
      lastUsedService: service === undefined || service === "N/A" || service === "" ? null : service,
    });
  }
  const src = view.cell(row.rowNumber);
  // additional_credentials_info: 열이 없거나 값이 있으면 3번째 키부터는 확인 불가 → 보고서만으로는 '키 전체'를 증명하지 못한다(fail-closed)
  const extra = row.get("additional_credentials_info");
  const complete = view.table?.hasAdditionalColumn === true && (extra === undefined || extra.trim() === "" || extra.trim() === "N/A");
  return complete ? val(keys, src) : part(keys, "field-missing", src);
}

function factsOf(view: ReportView, row: ReportRow | undefined): ReportFacts {
  if (view.table === null) {
    const m = <T,>(): Slot<T> => missing(view.why);
    return { createdAt: m(), passwordEnabled: m(), passwordLastUsed: m(), mfaActive: m(), keys: m() };
  }
  if (row === undefined) {
    const m = <T,>(): Slot<T> => missing("stale-evidence");   // 보고서가 만들어진 뒤에 생긴 사용자일 수 있다
    return { createdAt: m(), passwordEnabled: m(), passwordLastUsed: m(), mfaActive: m(), keys: m() };
  }
  const at = (col: string): Src => view.cell(row.rowNumber, col);
  const pe = boolCell(row.get("password_enabled"));
  const mf = boolCell(row.get("mfa_active"));
  const pl = timeCell(row.get("password_last_used"), ["N/A", "no_information"]);
  const cr = timeCell(row.get("user_creation_time"), []);
  return {
    createdAt: cr.kind === "time" ? val(cr.at, at("user_creation_time")) : missing("value-unrecognized", at("user_creation_time")),
    passwordEnabled: pe === undefined ? missing("value-unrecognized", at("password_enabled")) : val(pe, at("password_enabled")),
    passwordLastUsed: pl.kind === "time" ? val<Instant | null>(pl.at, at("password_last_used")) : pl.kind === "none" ? val<Instant | null>(null, at("password_last_used")) : missing("value-unrecognized", at("password_last_used")),
    mfaActive: mf === undefined ? missing("value-unrecognized", at("mfa_active")) : val(mf, at("mfa_active")),
    keys: reportKeys(view, row),
  };
}

/* ───────── 계정 요약 ───────── */
const num = (v: number | undefined): number | null => (typeof v === "number" ? v : null);
function summaryFrom(ctx: InputCtx, door: DoorId): Slot<AwsAccountSummary> {
  const sec = ctx.section<NonNullable<AwsData["accountSummary"]>>("accountSummary");
  if (sec === undefined) { ctx.addIssue(door, "accountSummary", "field-missing"); return missing("field-missing"); }
  if (sec === null) { ctx.addIssue(door, "accountSummary", "schema-section"); return missing("schema-unsupported"); }
  return ctx.guard(door, "accountSummary", () => {
    const f = ctx.link(sec.receipt, "iam:GetAccountSummary");
    return evSlot(f, sec.value, (v): AwsAccountSummary => ({
      users: num(v.Users), groups: num(v.Groups), roles: num(v.Roles), accountMfaEnabled: num(v.AccountMFAEnabled),
      accountAccessKeysPresent: num(v.AccountAccessKeysPresent), accountSigningCertificatesPresent: num(v.AccountSigningCertificatesPresent), mfaDevicesInUse: num(v.MFADevicesInUse),
    }));
  }, () => missing("schema-unsupported"));
}

/* ───────── IAM 사용자 ───────── */
interface UsersBuilt {
  readonly slot: Slot<readonly AwsIamUser[]>;
  readonly users: readonly AwsIamUser[] | null;
  /** 사용자 목록의 출처: 실시간(list-users) 또는 보고서 행 */
  readonly from: "list" | "report" | "none";
  readonly listReceipt: ReceiptKey | null;
  readonly budgetTotal: number | null;
  readonly accessKeyReceipts: readonly ReceiptKey[];
  readonly gaps: readonly UnknownReason[];
}

const mapPolicyArns = (red: Redactor) => (v: readonly string[]): string[] => v.map((a) => red.fix(a));
const mapNames = (red: Redactor) => (v: readonly string[]): string[] => v.map((a) => red.fix(a));

function usersFromCollector(ctx: InputCtx, door: DoorId, view: ReportView): UsersBuilt {
  const red = ctx.red;
  const sec = ctx.section<NonNullable<AwsData["iamUsers"]>>("iamUsers");
  const fromReport = (): UsersBuilt => usersFromReport(ctx.index, view, ctx.p.envelope.cloud === "aws" ? view.receipt : null);
  if (sec === undefined) { ctx.addIssue(door, "iamUsers", "field-missing"); return fromReport(); }
  if (sec === null) { ctx.addIssue(door, "iamUsers", "schema-section"); return fromReport(); }
  try {
    const f = ctx.link(sec.receipt, "iam:ListUsers");
    const listSrc: Src = { input: ctx.index, receipt: f.key, csv: null };
    if (f.result === "denied" || f.result === "error" || f.result === "throttled" || f.result === "unsupported") {
      if (sec.items !== null) throw new SectionInvalid("실패 영수증 아래에 사용자가 있다");
      return fromReport();
    }
    if (sec.items === null) return fromReport();
    if (f.result === "notconfigured") throw new SectionInvalid("ListUsers는 notconfigured가 될 수 없다");
    const items = sec.items;
    if (items.length !== sec.budget.total) throw new SectionInvalid("budget.total ≠ 사용자 수");
    noDup(items.map((x) => x.userName), "사용자");
    if (f.count !== null && f.result !== "empty" && f.count !== items.length) throw new SectionInvalid("영수증 count ≠ 사용자 수");
    if (f.result === "empty" && items.length > 0) throw new SectionInvalid("empty인데 사용자가 있다");
    const collectedN = sec.budget.collected;
    const doorCollected = (d: DoorId): boolean => ctx.collected(d);
    const accessKeyReceipts: ReceiptKey[] = [];
    const users: AwsIamUser[] = items.map((it, i): AwsIamUser => {
      const name = red.fix(it.userName);
      const rep = factsOf(view, view.byUser.get(it.userName) ?? view.byUser.get(name));
      const inBudget = i < collectedN;
      const slotOf = <V, T>(d: DoorId, ev: { receipt: string; value: V | null }, call: "iam:ListAccessKeys" | "iam:ListMFADevices" | "iam:ListAttachedUserPolicies" | "iam:ListGroupsForUser", tf: (v: V) => T | null): Slot<T> => {
        if (!inBudget) return missing("budget-exceeded");
        if (!doorCollected(d)) return missing("not-collected");
        const ff = ctx.link(ev.receipt, call, { resource: it.userName });
        return evSlot(ff, ev.value, tf);
      };
      const mfaS = slotOf("mfa", it.mfaDevices, "iam:ListMFADevices", (v: { count: number }) => v.count);
      const keysS = slotOf("key", it.accessKeys, "iam:ListAccessKeys", (v: readonly { status: string; createDate: string; idSuffix: string }[]) => v);
      const polS = slotOf("key", it.attachedPolicyArns, "iam:ListAttachedUserPolicies", mapPolicyArns(red));
      const grpS = slotOf("key", it.groupNames, "iam:ListGroupsForUser", mapNames(red));
      if (keysS.k === "value" || keysS.k === "partial") accessKeyReceipts.push(keysS.src.receipt as ReceiptKey);
      // 실시간 > 보고서. 예산 밖 사용자가 보고서에도 없으면 '조회 한도를 넘어서'가 진짜 이유다(보고서가 오래됐다는 뜻이 아니다)
      const overBudget = <T,>(s: Slot<T>): Slot<T> => (!inBudget && s.k === "missing" && s.why === "stale-evidence" ? missing("budget-exceeded") : s);
      const mfaActive: Slot<boolean> = mfaS.k === "value" ? val(mfaS.value > 0, mfaS.src) : overBudget(rep.mfaActive);
      const keys = keysS.k === "value" || keysS.k === "partial" ? liveKeys(keysS, view, view.byUser.get(it.userName), red) : overBudget(rep.keys);
      const created = parseInstant(it.createDate);
      const pw = it.passwordLastUsed === null ? val<Instant | null>(null, listSrc) : ((): Slot<Instant | null> => { const t = parseInstant(it.passwordLastUsed as string); return t ? val<Instant | null>(t, listSrc) : rep.passwordLastUsed; })();
      return {
        src: listSrc, name, createdAt: created ? val(created, listSrc) : rep.createdAt,
        passwordEnabled: rep.passwordEnabled, passwordLastUsed: pw, mfaActive,
        keys, mfaDevices: mfaS.k === "value" ? mfaS.value : null,
        attachedPolicyArns: polS.k === "value" || polS.k === "partial" ? ({ ...polS, value: polS.value } as Slot<readonly string[]>) : (polS as Slot<readonly string[]>),
        groupNames: grpS as Slot<readonly string[]>,
      };
    });
    const why: UnknownReason[] = [];
    const slot: Slot<readonly AwsIamUser[]> = f.result === "truncated" ? (why.push("truncated"), part(users, "truncated", listSrc))
      : collectedN < sec.budget.total ? (why.push("budget-exceeded"), part(users, "budget-exceeded", listSrc)) : val(users, listSrc);
    return { slot, users, from: "list", listReceipt: f.key, budgetTotal: sec.budget.total, accessKeyReceipts, gaps: why };
  } catch (e) {
    if (!(e instanceof SectionInvalid)) throw e;
    ctx.addIssue(door, "iamUsers", "schema-section");
    return fromReport();
  }
}

/** 실시간 list-access-keys → AwsAccessKey[]. 보고서의 같은 키는 CreateDate ↔ last_rotated로 조인해 마지막 사용을 붙인다 */
function liveKeys(s: Extract<Slot<readonly { status: string; createDate: string; idSuffix: string }[]>, { k: "value" | "partial" }>, view: ReportView, row: ReportRow | undefined, red: Redactor): Slot<readonly AwsAccessKey[]> {
  void red;
  const usedSlots = new Set<number>();
  const keys: AwsAccessKey[] = s.value.map((k) => {
    const created = parseInstant(k.createDate);
    const st = k.status;
    const active: Slot<boolean> = st === "Active" ? val(true, s.src) : st === "Inactive" || st === "Expired" ? val(false, s.src) : missing("value-unrecognized", s.src);
    let slot: 1 | 2 | null = null;
    if (row && created && view.table) {
      for (const n of [1, 2] as const) {
        if (usedSlots.has(n)) continue;
        const rot = timeCell(row.get(`access_key_${n}_last_rotated`), NA);
        if (rot.kind === "time" && rot.at.ms === created.ms) { slot = n; usedSlots.add(n); break; }
      }
    }
    const col = slot ? `access_key_${slot}_last_used_date` : null;
    const used = slot && row ? timeCell(row.get(col as string), NA) : null;
    return {
      src: s.src, slot, idSuffix: k.idSuffix, status: k.status, active,
      createdAt: created ? val(created, s.src) : missing("value-unrecognized", s.src),
      lastUsed: !slot || !row || !used ? missing(view.table === null ? view.why : "stale-evidence") : used.kind === "time" ? val<Instant | null>(used.at, view.cell(row.rowNumber, col)) : used.kind === "none" ? val<Instant | null>(null, view.cell(row.rowNumber, col)) : missing("value-unrecognized", view.cell(row.rowNumber, col)),
      lastUsedRegion: slot && row ? ((v) => (v === undefined || v === "N/A" || v === "" ? null : v))(row.get(`access_key_${slot}_last_used_region`)) : null,
      lastUsedService: slot && row ? ((v) => (v === undefined || v === "N/A" || v === "" ? null : v))(row.get(`access_key_${slot}_last_used_service`)) : null,
    };
  });
  return s.k === "partial" ? part(keys, s.why, s.src) : val(keys, s.src);
}

function usersFromReport(input: number, view: ReportView, receipt: ReceiptKey | null): UsersBuilt {
  if (view.table === null) return { slot: missing(view.why), users: null, from: "none", listReceipt: null, budgetTotal: null, accessKeyReceipts: [], gaps: [view.why] };
  const t = view.table;
  const rows = t.rows.filter((r) => r.user !== "<root_account>");
  const users: AwsIamUser[] = rows.map((r) => {
    const f = factsOf(view, r);
    const src = view.cell(r.rowNumber);
    return {
      src, name: r.user, createdAt: f.createdAt, passwordEnabled: f.passwordEnabled, passwordLastUsed: f.passwordLastUsed, mfaActive: f.mfaActive, mfaDevices: null,
      keys: f.keys, attachedPolicyArns: missing("not-collected"), groupNames: missing("not-collected"),
    };
  });
  void input; void receipt;
  const gaps: UnknownReason[] = [];
  if (t.ambiguous.length > 0) gaps.push("csv-row-ambiguous");
  const src = view.cell(null);
  const slot: Slot<readonly AwsIamUser[]> = gaps.length > 0 ? part(users, "csv-row-ambiguous", src) : val(users, src);
  return { slot, users, from: "report", listReceipt: null, budgetTotal: null, accessKeyReceipts: [], gaps };
}

/** 이름이 보고서와 목록에서 같은 사람인지 맞추기 위해, 사용자 이름은 값 그대로(비밀 패턴이면 지운 토큰) 비교한다 */

/* ───────── 문별 데이터 ───────── */
interface IamCore { readonly view: ReportView; readonly summary: Slot<AwsAccountSummary>; readonly users: UsersBuilt; readonly root: Slot<AwsRoot> }

function rootSlot(view: ReportView): Slot<AwsRoot> {
  if (view.table === null) return missing(view.why);
  const row = view.table.root;
  if (row === null) return missing(view.table.ambiguous.length > 0 ? "csv-row-ambiguous" : "field-missing", view.cell(null));
  const f = factsOf(view, row);
  const root: AwsRoot = { src: view.cell(row.rowNumber), passwordEnabled: f.passwordEnabled, passwordLastUsed: f.passwordLastUsed, mfaActive: f.mfaActive, keys: f.keys };
  return val(root, view.cell(row.rowNumber));
}

function iamCore(a: AwsBuildArgs, input: number, door: DoorId): IamCore {
  const ctx = a.collectors.get(input);
  if (ctx) {
    const view = reportFromCollector(ctx, door);
    return { view, summary: summaryFrom(ctx, door), users: usersFromCollector(ctx, door, view), root: rootSlot(view) };
  }
  const csv = a.csvs.get(input) as CsvParsed;
  const view = reportFromCsv(csv, input, door, a.issues);
  return { view, summary: missing("not-collected"), users: usersFromReport(input, view, null), root: rootSlot(view) };
}

const asKeys = (users: readonly AwsIamUser[] | null): number => (users ?? []).reduce((n, u) => n + (u.keys.k === "value" || u.keys.k === "partial" ? u.keys.value.length : 0), 0);

/* ───────── 범위(coverage) ───────── */
const summaryUsers = (s: Slot<AwsAccountSummary>): number | null => (s.k === "value" ? s.value.users : null);

function reportCoverage(family: "aws.mfa.credential-report" | "aws.key.credential-report", input: number, core: IamCore, collector: boolean): FamilyCoverage<typeof family> {
  const { view } = core;
  const t = view.table;
  const gaps: UnknownReason[] = [];
  const su = summaryUsers(core.summary);
  if (t === null) gaps.push(view.why);
  else {
    if (t.ambiguous.length > 0) gaps.push("csv-row-ambiguous");
    if (t.root === null) gaps.push("field-missing");
    if (collector) {
      if (su === null) gaps.push("scope-unproven");
      else if (t.rows.length - (t.root ? 1 : 0) !== su) gaps.push("population-mismatch");
    }
  }
  const present = t ? t.rows.length : 0;
  return seal({
    family, input, complete: gaps.length === 0, present, expected: collector && su !== null ? su + 1 : null, gaps,
    memberKeys: t ? t.rows.map((r) => r.user) : [],
    receipts: view.receipt ? [view.receipt] : [],
    unit: collector ? { kind: "account-global", covered: gaps.length === 0 ? 1 : 0, total: 1 } : { kind: "csv-rows", covered: t ? t.rows.length : 0, total: t ? t.totalRows : 0 },
  });
}

function usersCoverage(family: "aws.mfa.users" | "aws.key.users", input: number, core: IamCore, collector: boolean, repCov: FamilyCoverage): FamilyCoverage<typeof family> {
  const u = core.users;
  const present = u.users ? u.users.length : 0;
  const su = summaryUsers(core.summary);
  const gaps: UnknownReason[] = [];
  if (u.from === "list") {
    gaps.push(...u.gaps);
    const expected = su ?? u.budgetTotal;
    if (expected !== null && expected !== present && u.gaps.length === 0) gaps.push("population-mismatch");
    return seal({ family, input, complete: gaps.length === 0, present, expected, gaps, memberKeys: (u.users ?? []).map((x) => x.name), receipts: u.listReceipt ? [u.listReceipt] : [], unit: { kind: "account-global", covered: gaps.length === 0 ? 1 : 0, total: 1 } });
  }
  // 보고서 행이 모수의 출처(실시간 목록이 없거나 실패)
  gaps.push(...repCov.gaps);
  if (u.from === "none" && gaps.length === 0) gaps.push("not-collected");
  const t = core.view.table;
  return seal({
    family, input, complete: gaps.length === 0, present, expected: collector && su !== null ? su : null, gaps, memberKeys: (u.users ?? []).map((x) => x.name), receipts: repCov.receipts,
    unit: collector ? { kind: "account-global", covered: gaps.length === 0 ? 1 : 0, total: 1 } : { kind: "csv-rows", covered: t ? t.rows.length : 0, total: t ? t.totalRows : 0 },
  });
}

function regionUnits(want: readonly string[] | null, per: readonly PerRegion<unknown>[]): { units: UnitCoverage[]; gaps: UnknownReason[]; ok: number } {
  const units: UnitCoverage[] = [];
  const gaps = new Set<UnknownReason>();
  const seen = new Set<string>();
  for (const p of per) {
    seen.add(p.region);
    const s = p.items;
    const receipt = s.k === "missing" || s.k === "value" || s.k === "partial" || s.k === "none" ? (s.src?.receipt ?? null) : null;
    if (s.k === "value" || s.k === "none") units.push({ unit: p.region, state: "ok", why: null, receipt });
    else if (s.k === "partial") { units.push({ unit: p.region, state: "partial", why: s.why, receipt }); gaps.add("truncated"); }
    else { units.push({ unit: p.region, state: "failed", why: s.why, receipt }); gaps.add("region-missing"); }
  }
  for (const r of want ?? []) if (!seen.has(r)) { units.push({ unit: r, state: "not-queried", why: "region-missing", receipt: null }); gaps.add("region-missing"); }
  units.sort((a, b) => (a.unit < b.unit ? -1 : a.unit > b.unit ? 1 : 0));
  return { units, gaps: [...gaps], ok: units.filter((u) => u.state === "ok").length };
}

function netCoverage<T extends { readonly id: string }>(family: "aws.net.security-groups" | "aws.net.enis", input: number, net: AwsNetData, per: readonly PerRegion<T>[], count: (items: readonly unknown[]) => number): FamilyCoverage<typeof family> {
  const active = net.regions.k === "value" || net.regions.k === "partial" ? net.regions.value : null;
  const { units, gaps, ok } = regionUnits(active, per);
  const g = [...gaps];
  // 활성 리전이 0개인 목록은 실제 계정에서 나올 수 없는 모양이다(현재 리전은 항상 활성) → '보안 그룹 0개(해당 없음)'로 증명하지 않는다(백엔드팀장 STEP 4)
  if (active === null || active.length === 0) g.push("scope-unproven");
  // 요청 리전이 활성 리전 전부가 아니면 범위를 증명하지 못한다(units에서 not-queried로 이미 반영)
  let present = 0;
  for (const p of per) if (p.items.k === "value" || p.items.k === "partial") present += count(p.items.value as readonly unknown[]);
  const complete = g.length === 0 && active !== null && units.length > 0 ? true : g.length === 0 && active !== null && units.length === 0;
  const memberKeys = per.flatMap((p) => (p.items.k === "value" || p.items.k === "partial" ? p.items.value.map((x) => `${p.region}/${x.id}`) : []));   // 리전 단위 ID라 리전을 앞에 붙인다
  return seal({
    family, input, complete, present, expected: null, gaps: g, memberKeys, receipts: units.flatMap((u) => (u.receipt ? [u.receipt] : [])),
    unit: { kind: "regions", covered: ok, total: active === null ? null : units.length }, units,
  });
}

/* ───────── 문 데이터 ───────── */
function mfaData(a: AwsBuildArgs, input: number): { data: AwsMfaData; core: IamCore } {
  const core = iamCore(a, input, "mfa");
  return { data: { credentialReport: core.view.slot, accountSummary: core.summary, root: core.root, users: core.users.slot }, core };
}

function groupsOf(ctx: InputCtx | undefined, door: DoorId): AwsIamGroup[] {
  if (!ctx) return [];
  const sec = ctx.section<NonNullable<AwsData["iamGroups"]>>("iamGroups");
  if (sec === undefined) return [];
  if (sec === null) { ctx.addIssue(door, "iamGroups", "schema-section"); return []; }
  try {
    noDup(sec.map((g) => g.groupName), "그룹");
    return sec.map((g) => {
      const f = ctx.link(g.attachedPolicyArns.receipt, "iam:ListAttachedGroupPolicies", { resource: g.groupName });
      return { name: ctx.red.fix(g.groupName), attachedPolicyArns: evSlot(f, g.attachedPolicyArns.value, mapPolicyArns(ctx.red)) };
    }).sort((x, y) => (x.name < y.name ? -1 : x.name > y.name ? 1 : 0));
  } catch (e) {
    if (!(e instanceof SectionInvalid)) throw e;
    ctx.addIssue(door, "iamGroups", "schema-section");
    return [];
  }
}

function trustOf(red: Redactor, t: NonNullable<NonNullable<AwsData["iamRoles"]>["value"]>[number]["trust"]): readonly AwsTrustStatement[] | null {
  if (t === null) return null;
  return t.map((s): AwsTrustStatement => ({
    effect: s.effect, actions: s.actions.map((x) => red.fix(x)), notPrincipal: s.notPrincipal,
    principal: { wildcard: s.principal.wildcard, aws: s.principal.aws.map((x) => red.fix(x)), service: s.principal.service.map((x) => red.fix(x)), federated: s.principal.federated.map((x) => red.fix(x)), canonicalUserCount: s.principal.canonicalUserCount },
    conditionKeys: s.conditionKeys.map((x) => red.fix(x)),
  }));
}

function rolesOf(ctx: InputCtx | undefined, door: DoorId): Slot<readonly AwsIamRole[]> {
  if (!ctx) return missing("not-collected");
  const sec = ctx.section<NonNullable<AwsData["iamRoles"]>>("iamRoles");
  if (sec === undefined) { if (ctx.collected("key")) ctx.addIssue(door, "iamRoles", "field-missing"); return missing(ctx.collected("key") ? "field-missing" : "not-collected"); }
  if (sec === null) { ctx.addIssue(door, "iamRoles", "schema-section"); return missing("schema-unsupported"); }
  return ctx.guard(door, "iamRoles", () => {
    const f = ctx.link(sec.receipt, "iam:ListRoles");
    return evSlot(f, sec.value, (v): AwsIamRole[] => { noDup(v.map((r) => r.roleName), "역할"); return v.map((r) => {
      const src: Src = { input: ctx.index, receipt: f.key, csv: null };
      const trust = trustOf(ctx.red, r.trust);
      return { src, name: ctx.red.fix(r.roleName), path: r.path, createdAt: parseInstant(r.createDate), trust: trust === null ? missing("value-unrecognized", src) : val(trust, src) };
    }); });
  }, () => missing("schema-unsupported"));
}

function keyData(a: AwsBuildArgs, input: number): { data: AwsKeyData; core: IamCore; roles: Slot<readonly AwsIamRole[]> } {
  const core = iamCore(a, input, "key");
  const ctx = a.collectors.get(input);
  const roles = rolesOf(ctx, "key");
  return { data: { credentialReport: core.view.slot, accountSummary: core.summary, users: core.users.slot, groups: groupsOf(ctx, "key"), roles }, core, roles };
}

/* ───────── 네트워크 · 창고 · CCTV ───────── */
function netData(a: AwsBuildArgs, input: number): AwsNetData {
  const ctx = a.collectors.get(input) as InputCtx;
  const sc = ctx.p.envelope.scope as { regions: { receipt: string; value: readonly string[] | null }; regionsRequested: readonly string[] | null };
  const regions = ctx.guard("net", "scope.regions", () => evSlot(ctx.link(sc.regions.receipt, "ec2:DescribeRegions"), sc.regions.value, (v) => [...v]), () => missing<readonly string[]>("schema-unsupported"));
  const perRegion = <S, T>(name: "securityGroups" | "networkInterfaces", call: "ec2:DescribeSecurityGroups" | "ec2:DescribeNetworkInterfaces", idOf: (item: S) => string, conv: (receipt: string, region: string, item: S) => T): PerRegion<T>[] => {
    const sec = ctx.section<readonly { region: string; receipt: string; items: readonly S[] | null }[]>(name);
    if (sec === undefined) { ctx.addIssue("net", name, "field-missing"); return []; }
    if (sec === null) { ctx.addIssue("net", name, "schema-section"); return []; }
    try {
      const seen = new Set<string>();
      const out = sec.map((e): PerRegion<T> => {
        if (seen.has(e.region)) throw new SectionInvalid("같은 리전이 두 번 나온다");
        seen.add(e.region);
        const f = ctx.link(e.receipt, call, { region: e.region });
        return { region: e.region, items: evSlot(f, e.items, (items) => { noDup(items.map(idOf), "같은 대상"); return items.map((it) => conv(e.receipt, e.region, it)); }) };
      });
      return out.sort((x, y) => (x.region < y.region ? -1 : x.region > y.region ? 1 : 0));
    } catch (e) {
      if (!(e instanceof SectionInvalid)) throw e;
      ctx.addIssue("net", name, "schema-section");
      return [];
    }
  };
  type Sg = NonNullable<AwsData["securityGroups"]>[number]["items"] extends infer I ? (I extends readonly (infer X)[] ? X : never) : never;
  type En = NonNullable<AwsData["networkInterfaces"]>[number]["items"] extends infer I ? (I extends readonly (infer X)[] ? X : never) : never;
  const securityGroups = perRegion<Sg, AwsSecurityGroup>("securityGroups", "ec2:DescribeSecurityGroups", (sg) => sg.groupId, (receipt, region, sg) => ({
    src: ctx.src(receipt), id: sg.groupId, name: ctx.red.fix(sg.groupName), vpcId: sg.vpcId, region,
    ingress: sg.ingress.map((r) => ({ protocol: r.protocol, fromPort: r.fromPort, toPort: r.toPort, cidrs: r.cidrs, ipv6Cidrs: r.ipv6Cidrs, prefixListIds: r.prefixListIds, sgRefCount: r.sgRefCount })),
  }));
  const networkInterfaces = perRegion<En, AwsEni>("networkInterfaces", "ec2:DescribeNetworkInterfaces", (e) => e.eniId, (receipt, region, e) => ({
    src: ctx.src(receipt), id: e.eniId, region, groupIds: e.groupIds, hasPublicIp: e.hasPublicIp, hasIpv6: e.hasIpv6, interfaceType: e.interfaceType, status: e.status, requesterManaged: e.requesterManaged,
  }));
  return { regions, regionsRequested: sc.regionsRequested, securityGroups, networkInterfaces };
}

const toPab = (v: { blockPublicAcls: boolean; ignorePublicAcls: boolean; blockPublicPolicy: boolean; restrictPublicBuckets: boolean }): AwsPab => ({ ...v });

function stoData(a: AwsBuildArgs, input: number): { data: AwsStoData; budgetTotal: number | null; listFact: ReceiptKey | null } {
  const ctx = a.collectors.get(input) as InputCtx;
  const acctSec = ctx.section<NonNullable<AwsData["accountPublicAccessBlock"]>>("accountPublicAccessBlock");
  const accountPublicAccessBlock: Slot<AwsPab> = acctSec === undefined ? (ctx.addIssue("sto", "accountPublicAccessBlock", "field-missing"), missing("field-missing"))
    : acctSec === null ? (ctx.addIssue("sto", "accountPublicAccessBlock", "schema-section"), missing("schema-unsupported"))
      : ctx.guard("sto", "accountPublicAccessBlock", () => evSlot(ctx.link(acctSec.receipt, "s3:GetAccountPublicAccessBlock"), acctSec.value, toPab), () => missing<AwsPab>("schema-unsupported"));
  const sec = ctx.section<NonNullable<AwsData["buckets"]>>("buckets");
  let listKey: ReceiptKey | null = null;
  let budgetTotal: number | null = null;
  const buckets: Slot<readonly AwsBucket[]> = sec === undefined ? (ctx.addIssue("sto", "buckets", "field-missing"), missing("field-missing"))
    : sec === null ? (ctx.addIssue("sto", "buckets", "schema-section"), missing("schema-unsupported"))
      : ctx.guard("sto", "buckets", () => {
        const f = ctx.link(sec.receipt, "s3:ListAllMyBuckets");
        listKey = f.key;
        if (sec.items !== null) budgetTotal = sec.budget.total;   // 목록을 못 받았으면(거부 등) 기대 개수를 모른다 — 0건이 아니다
        const listSrc: Src = { input: ctx.index, receipt: f.key, csv: null };
        if (sec.items !== null && sec.items.length !== sec.budget.total) throw new SectionInvalid("budget.total ≠ 버킷 수");
        const base = evSlot(f, sec.items, (items) => items);
        if (base.k === "missing" || base.k === "none") return base as Slot<readonly AwsBucket[]>;
        const names = new Set<string>();
        const out: AwsBucket[] = base.value.map((b, i): AwsBucket => {
          if (names.has(b.name)) throw new SectionInvalid("같은 버킷이 두 번 나온다");
          names.add(b.name);
          const inBudget = i < sec.budget.collected;
          const item = <V, T>(ev: { receipt: string; value: V | null }, call: "s3:GetBucketPublicAccessBlock" | "s3:GetBucketPolicyStatus" | "s3:GetBucketAcl" | "s3:GetBucketOwnershipControls" | "s3:GetBucketWebsite", tf: (v: V) => T | null): Slot<T> =>
            inBudget ? evSlot(ctx.link(ev.receipt, call, { resource: b.name }), ev.value, tf) : missing("budget-exceeded");
          const region: Slot<string> = !inBudget ? (b.region.value ? val(b.region.value, listSrc) : missing("budget-exceeded"))
            : b.region.source === "list" ? (b.region.value ? val(b.region.value, listSrc) : missing("field-missing", listSrc))
              : (b.region.receipt === null ? missing("field-missing") : evSlot(ctx.link(b.region.receipt, "s3:GetBucketLocation", { resource: b.name }), b.region.value, (v) => v));
          return {
            src: listSrc, name: ctx.red.fix(b.name), createdAt: b.createDate ? parseInstant(b.createDate) : null, region,
            publicAccessBlock: item(b.publicAccessBlock, "s3:GetBucketPublicAccessBlock", toPab),
            policyStatus: item(b.policyStatus, "s3:GetBucketPolicyStatus", (v) => ({ isPublic: v.isPublic })),
            acl: item(b.acl, "s3:GetBucketAcl", (v) => ({ publicGrants: v.publicGrants.map((g) => ({ grantee: g.grantee, permission: g.permission })) })),
            ownership: item(b.ownership, "s3:GetBucketOwnershipControls", (v) => ({ objectOwnership: v.objectOwnership })),
            website: item(b.website, "s3:GetBucketWebsite", (v) => ({ enabled: v.enabled })),
          };
        });
        if (base.k === "partial") return part(out, base.why, listSrc);
        return sec.budget.collected < sec.budget.total ? part(out, "budget-exceeded", listSrc) : val(out, listSrc);
      }, () => missing<readonly AwsBucket[]>("schema-unsupported"));
  return { data: { accountPublicAccessBlock, buckets }, budgetTotal, listFact: listKey };
}

function logData(a: AwsBuildArgs, input: number): AwsLogData {
  const ctx = a.collectors.get(input) as InputCtx;
  const sec = ctx.section<NonNullable<AwsData["trails"]>>("trails");
  if (sec === undefined) { ctx.addIssue("log", "trails", "field-missing"); return { trails: missing("field-missing") }; }
  if (sec === null) { ctx.addIssue("log", "trails", "schema-section"); return { trails: missing("schema-unsupported") }; }
  const trails = ctx.guard("log", "trails", () => {
    const f = ctx.link(sec.receipt, "cloudtrail:DescribeTrails");
    return evSlot(f, sec.value, (list): AwsTrail[] => { noDup(list.map((t) => t.trailArn), "trail"); return list.map((t) => {
      const src: Src = { input: ctx.index, receipt: f.key, csv: null };
      return {
        src, name: ctx.red.fix(t.name), arn: ctx.red.fix(t.trailArn), homeRegion: t.homeRegion, isMultiRegion: t.isMultiRegion, isOrganizationTrail: t.isOrganizationTrail,
        logFileValidationEnabled: t.logFileValidationEnabled, hasCloudWatchLogs: t.hasCloudWatchLogs, hasCustomEventSelectors: t.hasCustomEventSelectors,
        status: evSlot(ctx.link(t.status.receipt, "cloudtrail:GetTrailStatus", { resource: t.trailArn }), t.status.value, (v) => ({ isLogging: v.isLogging, hasDeliveryError: v.hasDeliveryError })),
        selectors: evSlot(ctx.link(t.selectors.receipt, "cloudtrail:GetEventSelectors", { resource: t.trailArn }), t.selectors.value, (v) => ({
          basic: v.basic.map((b) => ({ readWriteType: b.readWriteType, includeManagementEvents: b.includeManagementEvents })),
          advanced: v.advanced.map((x) => ({ fields: x.fields.map((fl) => ({ field: fl.field, equals: [...fl.equals] })) })),
        })),
      };
    }); });
  }, () => missing<readonly AwsTrail[]>("schema-unsupported"));
  return { trails };
}

/* ───────── 조립 ───────── */
function identityOf(a: AwsBuildArgs): AwsIdentity {
  const ctx = a.collectors.get(a.identityInput);
  if (ctx) {
    const e = ctx.p.envelope as Extract<CollectorParsed["envelope"], { cloud: "aws" }>;
    const f = ctx.fact(e.identity.receipt);
    const principalType: PrincipalType = e.identity.principalType === "user" ? "iam-user" : e.identity.principalType;
    const alias = ctx.guard("mfa", "identity.alias", () => evSlot(ctx.link(e.identity.alias.receipt, "iam:ListAccountAliases"), e.identity.alias.value, (v) => (v === "" ? null : ctx.red.fix(v))), () => missing<string>("schema-unsupported"));
    return {
      input: ctx.index, principalType, confirmed: e.run.confirmed, receipt: f.key, source: "collector", accountId: e.identity.accountId,
      alias, principalName: e.identity.principalName === null ? null : ctx.red.fix(e.identity.principalName),
    };
  }
  const csv = a.csvs.get(a.identityInput) as CsvParsed;
  return { input: a.identityInput, principalType: "unknown", confirmed: null, receipt: null, source: "csv-arn", accountId: csv.identityId as string, alias: missing("not-collected"), principalName: null };
}

export function buildAws(a: AwsBuildArgs): AwsBuilt {
  const cov: Record<string, FamilyCoverage> = {};
  const accountId = identityOf(a).accountId;
  const sel = <D,>(door: DoorId, make: (input: number) => D): DoorSelection<D> => {
    const p = a.pick[door];
    if (p.state === "selected") return { state: "selected", input: p.input, asOf: a.asOf(door), data: make(p.input) };
    return p.state === "skipped" ? { state: "skipped", inputs: p.inputs } : { state: "absent" };
  };
  const selectedInput = (door: DoorId): number | null => (a.pick[door].state === "selected" ? (a.pick[door] as { input: number }).input : null);
  const nc = (f: AwsFamilyId, door: DoorId): FamilyCoverage => notCollectedCoverage(f, selectedInput(door));

  // 현관(mfa)
  const mfa = sel("mfa", (i) => {
    const { data, core } = mfaData(a, i);
    const collector = a.collectors.has(i);
    const rep = reportCoverage("aws.mfa.credential-report", i, core, collector);
    cov["aws.mfa.credential-report"] = rep;
    const rootComplete = core.view.table !== null && core.view.table.root !== null;
    cov["aws.mfa.root"] = seal({
      family: "aws.mfa.root", input: i, complete: rootComplete, present: rootComplete ? 1 : 0, expected: rootComplete ? 1 : null, memberKeys: ["root"],
      gaps: core.view.table === null ? [core.view.why] : [core.view.table.ambiguous.length > 0 ? "csv-row-ambiguous" : "field-missing"],
      receipts: core.view.receipt ? [core.view.receipt] : [], unit: collector ? { kind: "account-global", covered: rootComplete ? 1 : 0, total: 1 } : { kind: "csv-rows", covered: core.view.table?.rows.length ?? 0, total: core.view.table?.totalRows ?? 0 },
    });
    cov["aws.mfa.users"] = usersCoverage("aws.mfa.users", i, core, collector, rep);
    return data;
  });
  for (const f of ["aws.mfa.credential-report", "aws.mfa.root", "aws.mfa.users"] as const) if (!cov[f]) cov[f] = nc(f, "mfa");

  // 열쇠(key)
  const key = sel("key", (i) => {
    const { data, core, roles } = keyData(a, i);
    const collector = a.collectors.has(i);
    const rep = reportCoverage("aws.key.credential-report", i, core, collector);
    cov["aws.key.credential-report"] = rep;
    const uc = usersCoverage("aws.key.users", i, core, collector, rep);
    cov["aws.key.users"] = uc;
    const keyGaps: UnknownReason[] = uc.complete ? [] : [...uc.gaps];
    if (uc.complete) {
      for (const u of core.users.users ?? []) { const why = u.keys.k === "value" ? null : slotWhy(u.keys); if (why) { keyGaps.push(why); break; } }
    }
    cov["aws.key.access-keys"] = seal({
      family: "aws.key.access-keys", input: i, complete: keyGaps.length === 0, present: asKeys(core.users.users), expected: null, gaps: keyGaps,
      memberKeys: (core.users.users ?? []).flatMap((u) => (u.keys.k === "value" || u.keys.k === "partial" ? u.keys.value.map((k) => `${u.name}/${k.idSuffix ?? (k.slot === null ? "?" : `slot${k.slot}`)}`) : [])),
      receipts: core.users.accessKeyReceipts, unit: collector ? { kind: "account-global", covered: keyGaps.length === 0 ? 1 : 0, total: 1 } : { kind: "csv-rows", covered: core.view.table?.rows.length ?? 0, total: core.view.table?.totalRows ?? 0 },
    });
    const rolesOk = roles.k === "value";
    const rolesWhy = slotWhy(roles);
    cov["aws.key.roles"] = seal({
      family: "aws.key.roles", input: i, complete: rolesOk, present: roles.k === "value" || roles.k === "partial" ? roles.value.length : 0, expected: rolesOk ? (core.summary.k === "value" ? core.summary.value.roles : null) : null,
      memberKeys: roles.k === "value" || roles.k === "partial" ? roles.value.map((r) => r.name) : [],
      gaps: rolesWhy ? [rolesWhy] : roles.k === "none" ? ["not-collected"] : [], receipts: roles.k === "missing" || roles.src === null ? [] : [roles.src.receipt as ReceiptKey].filter(Boolean),
      unit: { kind: "account-global", covered: rolesOk ? 1 : 0, total: 1 },
    });
    return data;
  });
  for (const f of ["aws.key.credential-report", "aws.key.users", "aws.key.access-keys", "aws.key.roles"] as const) if (!cov[f]) cov[f] = nc(f, "key");

  // 창문(net) — 수집기 전용
  const net = sel("net", (i) => {
    const d = netData(a, i);
    cov["aws.net.security-groups"] = netCoverage("aws.net.security-groups", i, d, d.securityGroups, (x) => x.length);
    cov["aws.net.enis"] = netCoverage("aws.net.enis", i, d, d.networkInterfaces, (x) => x.length);
    return d;
  });
  for (const f of ["aws.net.security-groups", "aws.net.enis"] as const) if (!cov[f]) cov[f] = nc(f, "net");

  // 창고(sto)
  const sto = sel("sto", (i) => {
    const r = stoData(a, i);
    const acc = r.data.accountPublicAccessBlock;
    const accWhy = acc.k === "missing" ? acc.why : null;
    cov["aws.sto.account"] = seal({ family: "aws.sto.account", input: i, complete: acc.k === "value" || acc.k === "none", present: 1, expected: null, memberKeys: [accountId], gaps: accWhy ? [accWhy] : [], receipts: acc.k === "missing" && acc.src === null ? [] : [acc.src?.receipt as ReceiptKey].filter(Boolean), unit: { kind: "account-global", covered: acc.k === "value" || acc.k === "none" ? 1 : 0, total: 1 } });
    const b = r.data.buckets;
    const bw = slotWhy(b);
    cov["aws.sto.buckets"] = seal({
      family: "aws.sto.buckets", input: i, complete: b.k === "value", present: b.k === "value" || b.k === "partial" ? b.value.length : 0, expected: r.budgetTotal,
      memberKeys: b.k === "value" || b.k === "partial" ? b.value.map((x) => x.name) : [],
      gaps: bw ? [bw] : b.k === "none" ? ["not-collected"] : [], receipts: r.listFact ? [r.listFact] : [], unit: { kind: "account-global", covered: b.k === "value" ? 1 : 0, total: 1 },
    });
    return r.data;
  });
  for (const f of ["aws.sto.account", "aws.sto.buckets"] as const) if (!cov[f]) cov[f] = nc(f, "sto");

  // CCTV(log)
  const log = sel("log", (i) => {
    const d = logData(a, i);
    const t = d.trails;
    const w = slotWhy(t);
    const receipts = t.k === "missing" || !t.src.receipt ? [] : [t.src.receipt];
    cov["aws.log.account"] = seal({ family: "aws.log.account", input: i, complete: t.k === "value", present: 1, expected: null, memberKeys: [accountId], gaps: w ? [w] : t.k === "none" ? ["not-collected"] : [], receipts, unit: { kind: "account-global", covered: t.k === "value" ? 1 : 0, total: 1 } });
    cov["aws.log.trails"] = seal({ family: "aws.log.trails", input: i, complete: t.k === "value", present: t.k === "value" || t.k === "partial" ? t.value.length : 0, expected: null, memberKeys: t.k === "value" || t.k === "partial" ? t.value.map((x) => x.arn) : [], gaps: w ? [w] : t.k === "none" ? ["not-collected"] : [], receipts, unit: { kind: "account-global", covered: t.k === "value" ? 1 : 0, total: 1 } });
    return d;
  });
  for (const f of ["aws.log.account", "aws.log.trails"] as const) if (!cov[f]) cov[f] = nc(f, "log");

  return {
    identity: identityOf(a),
    doors: { mfa, key, net, sto, log },
    coverage: cov as unknown as CoverageTable<AwsFamilyId>,
  };
}

void keyOf; void none;
