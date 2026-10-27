// src/lib/cloudcheck/parse/normalize-azure.ts — Azure 입력(수집기 JSON · Resource Graph CSV · Entra 포털 CSV)을 NormalizedInput의 Azure 사실로 옮긴다
// 규칙(방향서 §4-7·§4-8): 리소스 ID·GUID는 소문자로 정규화(조인·MatchKey용) / 조회 범위 = 이 테넌트의 사용 가능한 구독 /
// Resource Graph CSV는 scopeProven = false 고정(권한 없는 리소스를 표시 없이 빼므로 '없음'을 증명할 수 없다) → items는 partial(csv-scope-unproven) /
// CSV 경로의 AZ-NET-1은 공인 IP 연결을 알 수 없으므로 nics·public-ips가 없다(not-collected).
import type { AzureCollect } from "../contract/collect-schema";
import { notCollectedCoverage } from "../contract/normalized";
import type {
  AsOfFact, AzureContainer, AzureDiagSetting, AzureDoors, AzureFamilyId, AzureIdentity, AzureKeyData, AzureLogData, AzureNetData, AzureNic, AzureNsg, AzureNsgRule,
  AzurePublicIp, AzureStoData, AzureStorageAccount, AzureSubscription, CoverageTable, DoorSelection, EntraUserRegistration, FamilyCoverage, Instant, PerSubscription,
  ReceiptKey, SectionIssue, Slot, Src, UnitCoverage,
} from "../contract/normalized";
import type { CsvKind } from "../contract/normalized";
import type { DoorId, PrincipalType, UnknownReason } from "../model/report";
import type { CollectorParsed, CsvParsed } from "./handle";
import { DuplicateTarget, InputCtx, SectionInvalid, evSlot, missing, noDup, part, seal, slotWhy, val } from "./normalize-common";
import { arrayCell, tristateCell } from "./rg-csv";
import type { RgRow } from "./rg-csv";
import { parseInstant } from "./strict-time";
import type { Redactor } from "./secrets";

type AzData = AzureCollect["data"];
type Sel = { readonly state: "selected"; readonly input: number } | { readonly state: "skipped"; readonly inputs: readonly number[] } | { readonly state: "absent" };
type StorageEntry = NonNullable<AzData["storageAccounts"]>[number];
type StorageItem = NonNullable<StorageEntry["items"]>[number];
type DiagRaw = NonNullable<StorageItem["blobDiagnostics"]["value"]>[number];

export interface AzureBuildArgs {
  readonly pick: Readonly<Record<DoorId, Sel>>;
  readonly asOf: (door: DoorId) => AsOfFact | null;
  readonly collectors: ReadonlyMap<number, InputCtx>;
  readonly csvs: ReadonlyMap<number, CsvParsed>;
  readonly red: Redactor;
  readonly issues: SectionIssue[];
  readonly identityInput: number;
}
export interface AzureBuilt { readonly identity: AzureIdentity; readonly doors: AzureDoors; readonly coverage: CoverageTable<AzureFamilyId> }

const lower = (s: string): string => s.toLowerCase();
const csvSrc = (input: number, kind: CsvKind, row: number | null, column: string | null = null): Src => ({ input, receipt: null, csv: { kind, row, column } });

/* ───────── 범위(구독 목록) ───────── */
interface ScopeView { readonly subscriptions: Slot<readonly AzureSubscription[]>; readonly requested: readonly string[] | null; readonly receipt: ReceiptKey | null }
function scopeOf(ctx: InputCtx, door: DoorId): ScopeView {
  const sc = ctx.p.envelope.scope as { subscriptions: { receipt: string; value: readonly { id: string; name: string; state: string; tenantId: string; inScope: boolean; outOfScopeReason: AzureSubscription["outOfScopeReason"] }[] | null }; subscriptionsRequested: readonly string[] | null };
  let receipt: ReceiptKey | null = null;
  const subscriptions = ctx.guard(door, "scope.subscriptions", () => {
    const f = ctx.link(sc.subscriptions.receipt, "azure:account.list");
    receipt = f.key;
    return evSlot(f, sc.subscriptions.value, (v): AzureSubscription[] => {
      const seen = new Set<string>();
      return v.map((s) => {
        const id = lower(s.id);
        if (seen.has(id)) throw new SectionInvalid("같은 구독이 두 번 나온다");
        seen.add(id);
        return { id, name: ctx.red.fix(s.name), state: s.state, tenantId: lower(s.tenantId), inScope: s.inScope, outOfScopeReason: s.outOfScopeReason };
      });
    });
  }, () => missing<readonly AzureSubscription[]>("schema-unsupported"));
  return { subscriptions, requested: sc.subscriptionsRequested ? sc.subscriptionsRequested.map(lower) : null, receipt };
}
const csvScope = (): ScopeView => ({ subscriptions: missing("not-collected"), requested: null, receipt: null });

/* ───────── 수집기: 구독별 목록 ───────── */

const diagOf = (red: Redactor) => (v: readonly DiagRaw[]): AzureDiagSetting[] => v.map((d) => ({
  name: red.fix(d.name), logs: d.logs.map((l) => ({ category: l.category, categoryGroup: l.categoryGroup, enabled: l.enabled })), destinations: { ...d.destinations },
}));

function accountOf(ctx: InputCtx, e: StorageEntry, it: StorageItem, i: number, src: Src): AzureStorageAccount {
  const sub = lower(e.subscription);
  const inBudget = i < e.budget.collected;
  const t = (v: string | null): Slot<Instant | null> => {
    if (v === null) return val<Instant | null>(null, src);
    const p = parseInstant(v);
    return p ? val<Instant | null>(p, src) : missing("value-unrecognized", src);
  };
  const detail = <V, T>(d: DoorId, ev: { receipt: string; value: V | null }, call: "azure:storage.container-rm.list" | "azure:monitor.diagnostic-settings.list", tf: (v: V) => T | null): Slot<T> => {
    if (!inBudget) return missing("budget-exceeded");
    if (!ctx.collected(d)) return missing("not-collected");
    const f = ctx.link(ev.receipt, call, { resource: it.id, subscription: sub });
    try {
      return evSlot(f, ev.value, tf);
    } catch (e) {
      if (!(e instanceof DuplicateTarget)) throw e;
      ctx.addIssue(d, "storageAccounts", "schema-section");           // 복제된 열거: 그 계정의 이 칸만 무효로 좁힌다(다른 계정의 사실은 그대로)
      return missing("schema-unsupported", { input: ctx.index, receipt: f.key, csv: null });
    }
  };
  return {
    src, id: lower(it.id), name: it.name, subscription: sub, kind: it.kind, location: it.location,
    allowBlobPublicAccess: val<boolean | null>(it.allowBlobPublicAccess, src), allowSharedKeyAccess: val<boolean | null>(it.allowSharedKeyAccess, src),
    key1CreatedAt: it.keyCreationTime === null ? val<Instant | null>(null, src) : t(it.keyCreationTime.key1),
    key2CreatedAt: it.keyCreationTime === null ? val<Instant | null>(null, src) : t(it.keyCreationTime.key2),
    keyExpirationPeriodInDays: val<number | null>(it.keyExpirationPeriodInDays, src), sasExpirationPeriod: val<string | null>(it.sasExpirationPeriod, src),
    publicNetworkAccess: val<string | null>(it.publicNetworkAccess, src), networkDefaultAction: val<string | null>(it.networkDefaultAction, src),
    // 같은 내용의 항목이 두 번이면(복제) 그 열거는 무효다. 이름만 같고 내용이 다른 항목은 서로 다른 대상으로 센다(키에 순번을 붙인다) — 개수만 맞추려고 복제한 열거를 막는다(CC-QA-15)
    containers: detail("sto", it.containers, "azure:storage.container-rm.list", (v): AzureContainer[] => { noDup(v.map((c) => JSON.stringify([c.name, c.publicAccess])), "같은 컨테이너"); return v.map((c) => ({ name: ctx.red.fix(c.name), publicAccess: c.publicAccess })); }),
    blobDiagnostics: detail("log", it.blobDiagnostics, "azure:monitor.diagnostic-settings.list", (v) => { noDup(v.map((d) => JSON.stringify(d)), "같은 진단 설정"); return diagOf(ctx.red)(v); }),
  };
}

function storageFromCollector(ctx: InputCtx, door: DoorId): PerSubscription<AzureStorageAccount>[] {
  const sec = ctx.section<readonly StorageEntry[]>("storageAccounts");
  if (sec === undefined) { ctx.addIssue(door, "storageAccounts", "field-missing"); return []; }
  if (sec === null) { ctx.addIssue(door, "storageAccounts", "schema-section"); return []; }
  try {
    const seen = new Set<string>();
    return sec.map((e): PerSubscription<AzureStorageAccount> => {
      const sub = lower(e.subscription);
      if (seen.has(sub)) throw new SectionInvalid("같은 구독이 두 번 나온다");
      seen.add(sub);
      const f = ctx.link(e.receipt, "azure:storage.account.list", { subscription: sub });
      const src: Src = { input: ctx.index, receipt: f.key, csv: null };
      if (e.items !== null && e.items.length !== e.budget.total) throw new SectionInvalid("budget.total ≠ 계정 수");
      const base = evSlot(f, e.items, (items) => items);
      if (base.k === "missing" || base.k === "none") return { subscription: sub, items: base as Slot<readonly AzureStorageAccount[]> };
      const names = new Set<string>();
      const accts = base.value.map((it, i) => { if (names.has(lower(it.id))) throw new SectionInvalid("같은 계정이 두 번 나온다"); names.add(lower(it.id)); return accountOf(ctx, e, it, i, src); });
      const items: Slot<readonly AzureStorageAccount[]> = base.k === "partial" ? part(accts, base.why, src) : e.budget.collected < e.budget.total ? part(accts, "budget-exceeded", src) : val(accts, src);
      return { subscription: sub, items };
    }).sort((a, b) => (a.subscription < b.subscription ? -1 : 1));
  } catch (x) {
    if (!(x instanceof SectionInvalid)) throw x;
    ctx.addIssue(door, "storageAccounts", "schema-section");
    return [];
  }
}

function perSubFrom<R, T>(ctx: InputCtx, door: DoorId, name: "nsgs" | "nics" | "publicIps" | "activityLogExports", call: "azure:network.nsg.list" | "azure:network.nic.list" | "azure:network.public-ip.list" | "azure:monitor.diagnostic-settings.subscription.list", itemKey: (item: R) => string, conv: (item: R, src: Src, sub: string) => T): PerSubscription<T>[] {
  const sec = ctx.section<readonly { subscription: string; receipt: string; items: readonly R[] | null }[]>(name);
  if (sec === undefined) { ctx.addIssue(door, name, "field-missing"); return []; }
  if (sec === null) { ctx.addIssue(door, name, "schema-section"); return []; }
  try {
    const seen = new Set<string>();
    return sec.map((e): PerSubscription<T> => {
      const sub = lower(e.subscription);
      if (seen.has(sub)) throw new SectionInvalid("같은 구독이 두 번 나온다");
      seen.add(sub);
      const f = ctx.link(e.receipt, call, { subscription: sub });
      const src: Src = { input: ctx.index, receipt: f.key, csv: null };
      return { subscription: sub, items: evSlot(f, e.items, (items) => { noDup(items.map(itemKey), "같은 대상"); return items.map((it) => conv(it, src, sub)); }) };
    }).sort((a, b) => (a.subscription < b.subscription ? -1 : 1));
  } catch (x) {
    if (!(x instanceof SectionInvalid)) throw x;
    ctx.addIssue(door, name, "schema-section");
    return [];
  }
}

type NsgRaw = NonNullable<AzData["nsgs"]>[number]["items"] extends infer I ? (I extends readonly (infer X)[] ? X : never) : never;
type NicRaw = NonNullable<AzData["nics"]>[number]["items"] extends infer I ? (I extends readonly (infer X)[] ? X : never) : never;
type PipRaw = NonNullable<AzData["publicIps"]>[number]["items"] extends infer I ? (I extends readonly (infer X)[] ? X : never) : never;

const nsgsFromCollector = (ctx: InputCtx): PerSubscription<AzureNsg>[] => perSubFrom<NsgRaw, AzureNsg>(ctx, "net", "nsgs", "azure:network.nsg.list", (n) => lower(n.id), (n, src, sub) => {
  return {
  src, id: lower(n.id), name: ctx.red.fix(n.name), location: n.location, subscription: sub,
  rules: n.rules.map((r): Slot<AzureNsgRule> => val({ name: ctx.red.fix(r.name), direction: r.direction, access: r.access, priority: r.priority, protocol: r.protocol, sourcePrefixes: r.sourcePrefixes.map((x) => ctx.red.fix(x)), sourceAsgCount: r.sourceAsgCount, destPortRanges: r.destPortRanges }, src)),
  nicIds: val(n.nicIds.map(lower), src), subnetIds: val(n.subnetIds.map(lower), src), nicCount: n.nicIds.length, subnetCount: n.subnetIds.length,
  };
});
const nicsFromCollector = (ctx: InputCtx): PerSubscription<AzureNic>[] => perSubFrom<NicRaw, AzureNic>(ctx, "net", "nics", "azure:network.nic.list", (n) => lower(n.id), (n, src, sub) => ({
  src, id: lower(n.id), subscription: sub, nsgId: n.nsgId === null ? null : lower(n.nsgId),
  ipConfigs: n.ipConfigs.map((c) => ({ subnetId: c.subnetId === null ? null : lower(c.subnetId), publicIpId: c.publicIpId === null ? null : lower(c.publicIpId) })),
}));
const pipsFromCollector = (ctx: InputCtx): PerSubscription<AzurePublicIp>[] => perSubFrom<PipRaw, AzurePublicIp>(ctx, "net", "publicIps", "azure:network.public-ip.list", (n) => lower(n.id), (n, src, sub) => ({
  src, id: lower(n.id), subscription: sub, hasAddress: n.hasAddress, allocationMethod: n.allocationMethod, attachedTo: n.attachedTo === null ? null : lower(n.attachedTo),
}));
const exportsFromCollector = (ctx: InputCtx): PerSubscription<AzureDiagSetting>[] => perSubFrom<DiagRaw, AzureDiagSetting>(ctx, "log", "activityLogExports", "azure:monitor.diagnostic-settings.subscription.list", (d) => JSON.stringify(d), (d) => ({
  name: ctx.red.fix(d.name), logs: d.logs.map((l) => ({ category: l.category, categoryGroup: l.categoryGroup, enabled: l.enabled })), destinations: { ...d.destinations },
}));

/* ───────── Resource Graph CSV ───────── */
const ts = (s: string, src: Src): Slot<Instant | null> => { if (s === "") return val<Instant | null>(null, src); const p = parseInstant(s); return p ? val<Instant | null>(p, src) : missing("value-unrecognized", src); };
const tri = (s: string, src: Src): Slot<boolean | null> => { const v = tristateCell(s); return v === undefined ? missing("value-unrecognized", src) : val<boolean | null>(v, src); };
const intCell = (s: string): number | null | undefined => (s === "" ? null : /^\d{1,9}$/.test(s) ? Number(s) : undefined);

interface RgBuilt<T> { readonly list: PerSubscription<T>[]; readonly rowsParsed: number; readonly rowsTotal: number; readonly receipt: null }

function storageFromRg(input: number, p: CsvParsed, red: Redactor): RgBuilt<AzureStorageAccount> {
  const rg = p.rg;
  if (rg === null || rg.missingColumns.length > 0 || rg.duplicateColumns.length > 0) return { list: [], rowsParsed: 0, rowsTotal: rg?.totalRows ?? 0, receipt: null };
  const bySub = new Map<string, AzureStorageAccount[]>();
  let parsed = 0;
  for (const r of rg.rows) {
    const id = r.get("id");
    const sub = lower(r.get("subscriptionId"));
    if (id === "" || sub === "") continue;
    const at = (col: string): Src => csvSrc(input, "csv-rg-storage", r.rowNumber, col);
    const exp = intCell(r.get("keyExpirationPeriodInDays"));
    const a: AzureStorageAccount = {
      src: at("id"), id: lower(id), name: red.fix(r.get("name")), subscription: sub, kind: r.get("kind") === "" ? null : r.get("kind"), location: r.get("location"),
      allowBlobPublicAccess: tri(r.get("allowBlobPublicAccess"), at("allowBlobPublicAccess")), allowSharedKeyAccess: tri(r.get("allowSharedKeyAccess"), at("allowSharedKeyAccess")),
      key1CreatedAt: ts(r.get("key1CreationTime"), at("key1CreationTime")), key2CreatedAt: ts(r.get("key2CreationTime"), at("key2CreationTime")),
      keyExpirationPeriodInDays: exp === undefined ? missing("value-unrecognized", at("keyExpirationPeriodInDays")) : val<number | null>(exp, at("keyExpirationPeriodInDays")),
      sasExpirationPeriod: val<string | null>(r.get("sasExpirationPeriod") === "" ? null : r.get("sasExpirationPeriod"), at("sasExpirationPeriod")),
      publicNetworkAccess: missing("not-collected"), networkDefaultAction: missing("not-collected"), containers: missing("not-collected"), blobDiagnostics: missing("not-collected"),
    };
    (bySub.get(sub) ?? bySub.set(sub, []).get(sub) as AzureStorageAccount[]).push(a);
    parsed++;
  }
  const list = [...bySub.entries()].sort(([x], [y]) => (x < y ? -1 : 1)).map(([subscription, accts]): PerSubscription<AzureStorageAccount> => ({
    subscription, items: part(accts.sort((x, y) => (x.id < y.id ? -1 : 1)), "csv-scope-unproven", csvSrc(input, "csv-rg-storage", null)),
  }));
  return { list, rowsParsed: parsed, rowsTotal: rg.totalRows, receipt: null };
}

function nsgsFromRg(input: number, p: CsvParsed, red: Redactor): RgBuilt<AzureNsg> {
  const rg = p.rg;
  if (rg === null || rg.missingColumns.length > 0 || rg.duplicateColumns.length > 0) return { list: [], rowsParsed: 0, rowsTotal: rg?.totalRows ?? 0, receipt: null };
  const hasSrc = (r: RgRow): boolean => r.get("sourcePrefix") !== "" || r.get("sourcePrefixes") !== "";
  const byNsg = new Map<string, { head: RgRow; rules: Slot<AzureNsgRule>[] }>();
  let parsed = 0;
  for (const r of rg.rows) {
    const id = lower(r.get("nsgId"));
    const sub = lower(r.get("subscriptionId"));
    if (id === "" || sub === "") continue;
    const at = (col: string): Src => csvSrc(input, "csv-rg-nsg", r.rowNumber, col);
    const entry = byNsg.get(id) ?? byNsg.set(id, { head: r, rules: [] }).get(id) as { head: RgRow; rules: Slot<AzureNsgRule>[] };
    const prio = /^-?\d{1,9}$/.test(r.get("priority")) ? Number(r.get("priority")) : null;
    const sp = arrayCell(r.get("sourcePrefixes") || "[]");
    const dp = arrayCell(r.get("destPortRanges") || "[]");
    if (prio === null || sp === null || dp === null || !hasSrc(r) || (r.get("destPortRange") === "" && dp.length === 0)) entry.rules.push(missing("value-unrecognized", at("priority")));
    else entry.rules.push(val({
      name: red.fix(r.get("ruleName")), direction: r.get("direction"), access: r.get("access"), priority: prio, protocol: r.get("protocol"),
      sourcePrefixes: [...(r.get("sourcePrefix") === "" ? [] : [r.get("sourcePrefix")]), ...sp].map((x) => red.fix(x)), sourceAsgCount: null,
      destPortRanges: [...(r.get("destPortRange") === "" ? [] : [r.get("destPortRange")]), ...dp],
    }, at("ruleName")));
    parsed++;
  }
  const bySub = new Map<string, AzureNsg[]>();
  for (const [id, e] of byNsg) {
    const r = e.head;
    const sub = lower(r.get("subscriptionId"));
    const nic = intCell(r.get("nicCount")), sn = intCell(r.get("subnetCount"));
    const nsg: AzureNsg = {
      src: csvSrc(input, "csv-rg-nsg", r.rowNumber, "nsgId"), id, name: red.fix(r.get("nsgName")), location: r.get("location"), subscription: sub, rules: e.rules,
      nicIds: missing("not-collected"), subnetIds: missing("not-collected"), nicCount: nic === undefined ? null : nic, subnetCount: sn === undefined ? null : sn,
    };
    (bySub.get(sub) ?? bySub.set(sub, []).get(sub) as AzureNsg[]).push(nsg);
  }
  const list = [...bySub.entries()].sort(([x], [y]) => (x < y ? -1 : 1)).map(([subscription, nsgs]): PerSubscription<AzureNsg> => ({
    subscription, items: part(nsgs.sort((x, y) => (x.id < y.id ? -1 : 1)), "csv-scope-unproven", csvSrc(input, "csv-rg-nsg", null)),
  }));
  return { list, rowsParsed: parsed, rowsTotal: rg.totalRows, receipt: null };
}

function entraSlot(input: number, p: CsvParsed, red: Redactor): Slot<readonly EntraUserRegistration[]> {
  const t = p.entra;
  const src = csvSrc(input, "csv-entra-registration", null);
  if (t === null) return missing("not-collected");
  if (t.missingColumns.length > 0) return missing("field-missing", src);
  if (t.duplicateColumns.length > 0) return missing("csv-row-ambiguous", src);
  const users = t.rows.map((r): EntraUserRegistration => {
    const at = (col: string): Src => csvSrc(input, "csv-entra-registration", r.rowNumber, col);
    const b = (v: boolean | undefined, col: string): Slot<boolean> => (v === undefined ? missing("value-unrecognized", at(col)) : val(v, at(col)));
    return { src: at(r.columns.registered), user: red.fix(r.user), isAdmin: b(r.isAdmin, r.columns.admin), mfaCapable: b(r.mfaCapable, r.columns.capable), mfaRegistered: b(r.mfaRegistered, r.columns.registered) };
  });
  return part(users, "csv-scope-unproven", src);
}

/* ───────── 범위(coverage) ───────── */
interface SubCov { readonly units: UnitCoverage[]; readonly gaps: UnknownReason[]; readonly ok: number; readonly total: number | null; readonly known: boolean }
/**
 * 구독 단위 범위. identityOnly = true면 구독의 '항목'이 아니라 구독 자체가 구성원인 패밀리(활동 로그)용이다: 범위 안 구독마다 항목(내보내기 목록)이 '있기만' 하면
 * 그 구독의 신원은 덮인 것이다(목록을 못 읽은 구독은 구성원이 확인 불가일 뿐 모수에서 빠지지 않는다 — INV-7)
 */
function subCoverage(scope: ScopeView, per: readonly PerSubscription<unknown>[], identityOnly = false): SubCov {
  const subs = scope.subscriptions.k === "value" || scope.subscriptions.k === "partial" ? scope.subscriptions.value : null;
  if (subs === null) return { units: per.map((p) => ({ unit: p.subscription, state: p.items.k === "value" || p.items.k === "none" ? "ok" as const : "failed" as const, why: slotWhy(p.items), receipt: null })), gaps: ["scope-unproven"], ok: 0, total: null, known: false };
  const gaps = new Set<UnknownReason>();
  const units: UnitCoverage[] = [];
  for (const s of subs) {
    if (!s.inScope && s.outOfScopeReason !== "not-requested") continue;
    if (!s.inScope) { units.push({ unit: s.id, state: "not-queried", why: "subscription-missing", receipt: null }); gaps.add("subscription-missing"); continue; }
    const e = per.find((p) => p.subscription === s.id);
    if (!e) { units.push({ unit: s.id, state: "not-queried", why: "subscription-missing", receipt: null }); gaps.add("subscription-missing"); continue; }
    const it = e.items;
    const receipt = it.src === null ? null : it.src.receipt;   // 실패한 구독도 거부 영수증을 싣는다(권한 안내가 어떤 호출이 막혔는지 알 수 있게)
    if (identityOnly) { units.push({ unit: s.id, state: "ok", why: null, receipt }); continue; }
    if (it.k === "value" || it.k === "none") units.push({ unit: s.id, state: "ok", why: null, receipt });
    else if (it.k === "partial") { units.push({ unit: s.id, state: "partial", why: it.why, receipt }); gaps.add(it.why === "budget-exceeded" ? "budget-exceeded" : "truncated"); }
    else { units.push({ unit: s.id, state: "failed", why: it.why, receipt }); gaps.add("subscription-missing"); }
  }
  // 요청했지만 목록에 보이지 않는 구독(오타·권한 없음)은 조용히 사라지지 않는다 — 빠진 구독으로 센다(CC-QA-11)
  const listed = new Set(subs.map((x) => x.id));
  for (const id of new Set(scope.requested ?? [])) {
    if (!listed.has(id)) { units.push({ unit: id, state: "not-queried", why: "subscription-missing", receipt: null }); gaps.add("subscription-missing"); }
  }
  return { units, gaps: [...gaps], ok: units.filter((u) => u.state === "ok").length, total: units.length, known: true };
}

/**
 * 범위 안 구독의 항목만 받는다. 범위 목록에 없거나 범위 밖인 구독의 항목이 섞여 있으면 그 섹션은 무효다(항목 이동·바꿔치기로 개수만 맞추는 것을 막는다, CC-QA-02).
 * 범위 목록을 못 받았으면 어느 항목이 범위 밖인지 알 수 없으니 그대로 둔다(범위 증명이 이미 막힌다)
 */
function inScopeOnly<T>(ctx: InputCtx, door: DoorId, section: string, scope: ScopeView, per: PerSubscription<T>[]): PerSubscription<T>[] {
  const subs = scope.subscriptions.k === "value" || scope.subscriptions.k === "partial" ? scope.subscriptions.value : null;
  if (subs === null || per.length === 0) return per;
  const ok = new Set(subs.filter((x) => x.inScope).map((x) => x.id));
  if (per.every((p) => ok.has(p.subscription))) return per;
  ctx.addIssue(door, section, "schema-section");
  return [];
}
const countOf = (per: readonly PerSubscription<unknown>[]): number => per.reduce((n, p) => n + (p.items.k === "value" || p.items.k === "partial" ? (p.items.value as readonly unknown[]).length : 0), 0);
const receiptsOf = (units: readonly UnitCoverage[]): ReceiptKey[] => units.flatMap((u) => (u.receipt ? [u.receipt] : []));

function subFamily<F extends AzureFamilyId, T>(family: F, input: number, scope: ScopeView, per: readonly PerSubscription<T>[], keyOf: (x: T) => string): FamilyCoverage<F> {
  const c = subCoverage(scope, per);
  const complete = c.known && c.gaps.length === 0 && c.units.every((u) => u.state === "ok");
  const memberKeys = per.flatMap((p) => (p.items.k === "value" || p.items.k === "partial" ? p.items.value.map(keyOf) : []));
  return seal({ family, input, complete, present: countOf(per), expected: null, gaps: c.gaps, receipts: receiptsOf(c.units), unit: { kind: "subscriptions", covered: c.ok, total: c.total }, units: c.units, memberKeys });
}
function csvFamily<F extends AzureFamilyId>(family: F, input: number, present: number, parsed: number, total: number): FamilyCoverage<F> {
  return seal({ family, input, complete: false, present, expected: null, gaps: ["csv-scope-unproven"], receipts: [], unit: { kind: "csv-rows", covered: parsed, total } });
}

/* ───────── 조립 ───────── */
function identityOf(a: AzureBuildArgs): AzureIdentity {
  const ctx = a.collectors.get(a.identityInput);
  if (ctx) {
    const e = ctx.p.envelope as Extract<CollectorParsed["envelope"], { cloud: "azure" }>;
    const f = ctx.fact(e.identity.receipt);
    const t = e.identity.principalType;
    const principalType: PrincipalType = t === "user" ? "entra-user" : t === "servicePrincipal" ? "service-principal" : t === "managedIdentity" ? "managed-identity" : "unknown";
    return { input: ctx.index, principalType, confirmed: e.run.confirmed, receipt: f.key, source: "collector", tenantId: lower(e.identity.tenantId), currentSubscription: lower(e.identity.currentSubscription), cloudName: e.identity.cloudName };
  }
  const csv = a.csvs.get(a.identityInput) as CsvParsed;
  return { input: a.identityInput, principalType: "unknown", confirmed: null, receipt: null, source: "csv-tenant", tenantId: csv.identityId as string, currentSubscription: null, cloudName: null };
}

export function buildAzure(a: AzureBuildArgs): AzureBuilt {
  const cov: Record<string, FamilyCoverage> = {};
  const sel = <D,>(door: DoorId, make: (input: number) => D): DoorSelection<D> => {
    const p = a.pick[door];
    if (p.state === "selected") return { state: "selected", input: p.input, asOf: a.asOf(door), data: make(p.input) };
    return p.state === "skipped" ? { state: "skipped", inputs: p.inputs } : { state: "absent" };
  };
  const selectedInput = (door: DoorId): number | null => (a.pick[door].state === "selected" ? (a.pick[door] as { input: number }).input : null);
  const nc = (f: AzureFamilyId, door: DoorId): FamilyCoverage => notCollectedCoverage(f, selectedInput(door));

  const mfa = sel("mfa", (i): { entraUsers: Slot<readonly EntraUserRegistration[]> } => {
    const csv = a.csvs.get(i);
    const slot = csv ? entraSlot(i, csv, a.red) : missing<readonly EntraUserRegistration[]>("not-collected");
    cov["azure.mfa.entra-users"] = slot.k === "partial" ? csvFamily("azure.mfa.entra-users", i, slot.value.length, csv?.entra?.rows.length ?? 0, csv?.entra?.totalRows ?? 0) : notCollectedCoverage("azure.mfa.entra-users", i);
    return { entraUsers: slot };
  });
  if (!cov["azure.mfa.entra-users"]) cov["azure.mfa.entra-users"] = nc("azure.mfa.entra-users", "mfa");

  const storageCtx = (i: number, door: "key" | "sto" | "log"): { scope: ScopeView; accounts: PerSubscription<AzureStorageAccount>[]; csv: RgBuilt<AzureStorageAccount> | null } => {
    const ctx = a.collectors.get(i);
    if (ctx) { const scope = scopeOf(ctx, door); return { scope, accounts: inScopeOnly(ctx, door, "storageAccounts", scope, storageFromCollector(ctx, door)), csv: null }; }
    const rg = storageFromRg(i, a.csvs.get(i) as CsvParsed, a.red);
    return { scope: csvScope(), accounts: rg.list, csv: rg };
  };

  const key = sel("key", (i): AzureKeyData => {
    const s = storageCtx(i, "key");
    cov["azure.key.storage-accounts"] = s.csv ? csvFamily("azure.key.storage-accounts", i, countOf(s.accounts), s.csv.rowsParsed, s.csv.rowsTotal) : subFamily("azure.key.storage-accounts", i, s.scope, s.accounts, (x) => x.id);
    return { subscriptions: s.scope.subscriptions, subscriptionsRequested: s.scope.requested, storageAccounts: s.accounts };
  });
  if (!cov["azure.key.storage-accounts"]) cov["azure.key.storage-accounts"] = nc("azure.key.storage-accounts", "key");

  const net = sel("net", (i): AzureNetData => {
    const ctx = a.collectors.get(i);
    if (ctx) {
      const scope = scopeOf(ctx, "net");
      const nsgs = inScopeOnly(ctx, "net", "nsgs", scope, nsgsFromCollector(ctx)), nics = inScopeOnly(ctx, "net", "nics", scope, nicsFromCollector(ctx)), pips = inScopeOnly(ctx, "net", "publicIps", scope, pipsFromCollector(ctx));
      cov["azure.net.nsgs"] = subFamily("azure.net.nsgs", i, scope, nsgs, (x) => x.id);
      cov["azure.net.nics"] = subFamily("azure.net.nics", i, scope, nics, (x) => x.id);
      cov["azure.net.public-ips"] = subFamily("azure.net.public-ips", i, scope, pips, (x) => x.id);
      return { subscriptions: scope.subscriptions, subscriptionsRequested: scope.requested, nsgs, nics, publicIps: pips };
    }
    const rg = nsgsFromRg(i, a.csvs.get(i) as CsvParsed, a.red);
    cov["azure.net.nsgs"] = csvFamily("azure.net.nsgs", i, countOf(rg.list), rg.rowsParsed, rg.rowsTotal);
    cov["azure.net.nics"] = notCollectedCoverage("azure.net.nics", i);
    cov["azure.net.public-ips"] = notCollectedCoverage("azure.net.public-ips", i);
    return { subscriptions: missing("not-collected"), subscriptionsRequested: null, nsgs: rg.list, nics: [], publicIps: [] };
  });
  for (const f of ["azure.net.nsgs", "azure.net.nics", "azure.net.public-ips"] as const) if (!cov[f]) cov[f] = nc(f, "net");

  const sto = sel("sto", (i): AzureStoData => {
    const s = storageCtx(i, "sto");
    const sa = s.csv ? csvFamily("azure.sto.storage-accounts", i, countOf(s.accounts), s.csv.rowsParsed, s.csv.rowsTotal) : subFamily("azure.sto.storage-accounts", i, s.scope, s.accounts, (x) => x.id);
    cov["azure.sto.storage-accounts"] = sa;
    if (s.csv) cov["azure.sto.containers"] = notCollectedCoverage("azure.sto.containers", i);
    else {
      const gaps: UnknownReason[] = sa.complete ? [] : [...sa.gaps];
      let present = 0;
      const receipts: ReceiptKey[] = [];
      const memberKeys: string[] = [];
      for (const p of s.accounts) for (const acct of p.items.k === "value" || p.items.k === "partial" ? p.items.value : []) {
        const c = acct.containers;
        if (c.k === "value" || c.k === "partial") {
          present += c.value.length;
          const seen = new Map<string, number>();
          for (const x of c.value) { const base = `${acct.id}/${x.name}`; const n = (seen.get(base) ?? 0) + 1; seen.set(base, n); memberKeys.push(n === 1 ? base : `${base}~${n}`); }   // 이름이 겹치는(내용은 다른) 컨테이너는 ~2, ~3 …(엔진의 대상 ID 규칙과 같다)
          if (c.src.receipt) receipts.push(c.src.receipt);
          if (c.k === "partial") gaps.push("truncated");
        }
        else if (c.k === "none") { if (c.src.receipt) receipts.push(c.src.receipt); }    // 컨테이너 0개(빈 목록) = 완결
        else if (sa.complete) gaps.push(slotWhy(c) ?? "not-collected");
      }
      cov["azure.sto.containers"] = seal({ family: "azure.sto.containers", input: i, complete: gaps.length === 0, present, expected: null, gaps: [...new Set(gaps)], receipts, unit: { kind: "subscriptions", covered: sa.unit.covered, total: sa.unit.total }, units: [...sa.units], memberKeys });
    }
    return { subscriptions: s.scope.subscriptions, subscriptionsRequested: s.scope.requested, storageAccounts: s.accounts };
  });
  for (const f of ["azure.sto.storage-accounts", "azure.sto.containers"] as const) if (!cov[f]) cov[f] = nc(f, "sto");

  const log = sel("log", (i): AzureLogData => {
    const ctx = a.collectors.get(i) as InputCtx;
    const scope = scopeOf(ctx, "log");
    const exportsList = inScopeOnly(ctx, "log", "activityLogExports", scope, exportsFromCollector(ctx));
    const accounts = inScopeOnly(ctx, "log", "storageAccounts", scope, storageFromCollector(ctx, "log"));
    // 활동 로그 패밀리는 개수가 아니라 구독 신원으로 봉인한다(CC-QA-02): 범위 안 구독마다 내보내기 목록(영수증)이 있어야 하고, 완결이면 그 구독 ID 집합이 모수의 신원이다
    const c = subCoverage(scope, exportsList, true);
    const gaps: UnknownReason[] = c.known ? c.gaps : [slotWhy(scope.subscriptions) ?? "scope-unproven"];
    const okIds = c.units.filter((u) => u.state === "ok").map((u) => u.unit);
    cov["azure.log.subscriptions"] = seal({
      family: "azure.log.subscriptions", input: i, complete: c.known && c.gaps.length === 0 && c.units.every((u) => u.state === "ok"), present: c.ok, expected: null, gaps,
      receipts: [...(scope.receipt ? [scope.receipt] : []), ...receiptsOf(c.units)], unit: { kind: "subscriptions", covered: c.ok, total: c.total }, units: c.units, memberKeys: okIds,
    });
    cov["azure.log.storage-accounts"] = subFamily("azure.log.storage-accounts", i, scope, accounts, (x) => x.id);
    return { subscriptions: scope.subscriptions, subscriptionsRequested: scope.requested, activityLogExports: exportsList, storageAccounts: accounts };
  });
  for (const f of ["azure.log.subscriptions", "azure.log.storage-accounts"] as const) if (!cov[f]) cov[f] = nc(f, "log");

  return { identity: identityOf(a), doors: { mfa, key, net, sto, log }, coverage: cov as unknown as CoverageTable<AzureFamilyId> };
}
