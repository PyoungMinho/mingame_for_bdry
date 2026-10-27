// micro/azure-world — Azure 스토리지·NSG·진단 설정 마이크로 세계 조립기 (수집기 경로: 구독마다 호출)
import type {
  AzureContainer, AzureDiagSetting, AzureKeyData, AzureLogData, AzureNetData, AzureNic, AzureNormalizedInput, AzureNsg, AzureNsgRule, AzurePublicIp,
  AzureStorageAccount, AzureStoData, AzureSubscription, Instant, PerSubscription, ReceiptKey, Slot, UnitCoverage,
} from "../../contract/normalized";
import { MicroAzure, byReceipt, guid, inst, miss, none, unit, val } from "./kit";

export const SUB = guid(11);
export const TENANT = guid(1);

export interface SaSpec {
  readonly name: string;
  readonly sub?: string;
  /** true | false | null(미설정) */
  readonly allowPublic?: boolean | null;
  readonly sharedKey?: boolean | null;
  /** keyCreationTime: ISO 문자열, null = 기록 없음 */
  readonly key1?: string | null;
  readonly key2?: string | null;
  readonly containers?: readonly { readonly name: string; readonly access: string | null }[];
  readonly blobDiag?: readonly AzureDiagSetting[];
  readonly keyPolicyDays?: number | null;
  /** 컨테이너 목록이 '빈 목록 + 값 없음'(none)으로 온다 — 컨테이너 0개를 정상으로 돌려준 것 */
  readonly containersNone?: boolean;
}
export interface NsgSpec { readonly name: string; readonly sub?: string; readonly rules: readonly Partial<AzureNsgRule>[]; readonly nicIds?: readonly string[]; readonly subnetIds?: readonly string[] }
export interface NicSpec { readonly name: string; readonly sub?: string; readonly nsg?: string; readonly subnet?: string; readonly publicIp?: string }
export interface IpSpec { readonly name: string; readonly sub?: string; readonly hasAddress: boolean }
export interface AzWorld {
  readonly doors: readonly ("key" | "sto" | "log" | "net")[];
  readonly accounts?: readonly SaSpec[];
  readonly activityExports?: readonly (readonly AzureDiagSetting[])[];
  readonly nsgs?: readonly NsgSpec[];
  readonly nics?: readonly NicSpec[];
  readonly publicIps?: readonly IpSpec[];
  readonly subs?: readonly string[];
  /** --subscriptions로 요청한 구독 ID(보이는 구독 목록에 없는 것을 섞어 요청 범위 밖 시험에 쓴다). 생략하면 요청 없음 */
  readonly requested?: readonly string[];
}

export const saId = (name: string, sub = SUB): string => `/subscriptions/${sub}/resourcegroups/rg-main/providers/microsoft.storage/storageaccounts/${name}`;
export const nsgId = (name: string, sub = SUB): string => `/subscriptions/${sub}/resourcegroups/rg-main/providers/microsoft.network/networksecuritygroups/${name}`;
export const nicId = (name: string, sub = SUB): string => `/subscriptions/${sub}/resourcegroups/rg-main/providers/microsoft.network/networkinterfaces/${name}`;
export const ipId = (name: string, sub = SUB): string => `/subscriptions/${sub}/resourcegroups/rg-main/providers/microsoft.network/publicipaddresses/${name}`;
export const subnetId = (name: string, sub = SUB): string => `/subscriptions/${sub}/resourcegroups/rg-main/providers/microsoft.network/virtualnetworks/vnet-main/subnets/${name}`;

export const diag = (logs: readonly { category?: string | null; categoryGroup?: string | null; enabled?: boolean }[], dest: Partial<AzureDiagSetting["destinations"]> = { workspace: true }, name = "export"): AzureDiagSetting => ({
  name,
  logs: logs.map((l) => ({ category: l.category ?? null, categoryGroup: l.categoryGroup ?? null, enabled: l.enabled ?? true })),
  destinations: { workspace: false, storage: false, eventHub: false, partner: false, ...dest },
});
export const ADMIN_SEC = [{ category: "Administrative" }, { category: "Security" }, { category: "Alert" }];
export const BLOB_ALL = [{ category: "StorageRead" }, { category: "StorageWrite" }, { category: "StorageDelete" }];

export function azWorld(w: AzWorld): { readonly m: MicroAzure; build: () => AzureNormalizedInput } {
  const m = new MicroAzure();
  const subs = w.subs ?? [SUB];
  m.subscriptions = [...subs];
  const sc = m.rc("azure:account.list", subs.length === 0 ? "empty" : "ok", { count: subs.length });
  const subList: AzureSubscription[] = subs.map((id, i) => ({ id, name: `sub-${i + 1}`, state: "Enabled", tenantId: TENANT, inScope: true, outOfScopeReason: null }));
  const scope = { subscriptions: val(subList, byReceipt(sc)), subscriptionsRequested: w.requested === undefined ? null : [...w.requested] };
  const accounts = w.accounts ?? [];

  const unitsOf = (keys: Map<string, ReceiptKey>): UnitCoverage[] => subs.map((s) => unit(s, "ok", keys.get(s) ?? sc));
  const unitInfo = { kind: "subscriptions" as const, covered: subs.length, total: subs.length };

  // 스토리지 계정 목록: 구독마다 한 번
  const listKeys = new Map<string, ReceiptKey>();
  for (const s of subs) listKeys.set(s, m.rc("azure:storage.account.list", accounts.some((a) => (a.sub ?? SUB) === s) ? "ok" : "empty", { subscription: s, count: accounts.filter((a) => (a.sub ?? SUB) === s).length }));

  const containerKeys: ReceiptKey[] = [];
  let containerCount = 0;
  const saFacts = (a: SaSpec): AzureStorageAccount => {
    const sub = a.sub ?? SUB;
    const src = byReceipt(listKeys.get(sub) as ReceiptKey);
    const cList = a.containersNone === true ? [] : a.containers ?? [];
    const ck = m.rc("azure:storage.container-rm.list", cList.length === 0 ? "empty" : "ok", { subscription: sub, resource: a.name, count: cList.length });
    containerKeys.push(ck);
    containerCount += cList.length;
    const dk = m.rc("azure:monitor.diagnostic-settings.list", "ok", { subscription: sub, resource: a.name });
    const t = (v: string | null | undefined): Slot<Instant | null> => val(v === undefined || v === null ? null : inst(v), src);
    return {
      src, id: saId(a.name, sub), name: a.name, subscription: sub, kind: "StorageV2", location: "koreacentral",
      allowBlobPublicAccess: val<boolean | null>(a.allowPublic === undefined ? false : a.allowPublic, src),
      allowSharedKeyAccess: val<boolean | null>(a.sharedKey === undefined ? false : a.sharedKey, src),
      key1CreatedAt: t(a.key1), key2CreatedAt: t(a.key2),
      keyExpirationPeriodInDays: val<number | null>(a.keyPolicyDays ?? null, src), sasExpirationPeriod: val<string | null>(null, src),
      publicNetworkAccess: val<string | null>("Enabled", src), networkDefaultAction: val<string | null>("Allow", src),
      containers: a.containersNone === true ? none<readonly AzureContainer[]>(byReceipt(ck)) : val<readonly AzureContainer[]>(cList.map((c) => ({ name: c.name, publicAccess: c.access })), byReceipt(ck)),
      blobDiagnostics: val<readonly AzureDiagSetting[]>([...(a.blobDiag ?? [])], byReceipt(dk)),
    };
  };
  const perSub = <T,>(items: readonly T[], subOf: (t: T) => string, srcKey: (s: string) => ReceiptKey): PerSubscription<T>[] =>
    subs.map((s) => ({ subscription: s, items: val(items.filter((i) => subOf(i) === s), byReceipt(srcKey(s))) }));

  const accountFacts = accounts.map(saFacts);
  const storagePer = perSub(accountFacts, (a) => a.subscription, (s) => listKeys.get(s) as ReceiptKey);

  if (w.doors.includes("key")) {
    const data: AzureKeyData = { ...scope, storageAccounts: storagePer };
    m.key(data);
    m.prove("azure.key.storage-accounts", { present: accounts.length, receipts: [...listKeys.values()], unit: unitInfo, units: unitsOf(listKeys) });
  }
  if (w.doors.includes("sto")) {
    const data: AzureStoData = { ...scope, storageAccounts: storagePer };
    m.sto(data);
    m.prove("azure.sto.storage-accounts", { present: accounts.length, receipts: [...listKeys.values()], unit: unitInfo, units: unitsOf(listKeys) });
    m.prove("azure.sto.containers", { present: containerCount, receipts: containerKeys, unit: unitInfo, units: unitsOf(listKeys) });
  }
  if (w.doors.includes("log")) {
    const dsKeys = new Map<string, ReceiptKey>();
    for (const s of subs) dsKeys.set(s, m.rc("azure:monitor.diagnostic-settings.subscription.list", "ok", { subscription: s }));
    const exportsPer: PerSubscription<AzureDiagSetting>[] = subs.map((s, i) => ({ subscription: s, items: val([...((w.activityExports ?? [])[i] ?? [])], byReceipt(dsKeys.get(s) as ReceiptKey)) }));
    const data: AzureLogData = { ...scope, activityLogExports: exportsPer, storageAccounts: storagePer };
    m.log(data);
    m.prove("azure.log.subscriptions", { present: subs.length, receipts: [...dsKeys.values()], unit: unitInfo, units: unitsOf(dsKeys) });
    m.prove("azure.log.storage-accounts", { present: accounts.length, receipts: [...listKeys.values()], unit: unitInfo, units: unitsOf(listKeys) });
  }
  if (w.doors.includes("net")) {
    const nsgKeys = new Map<string, ReceiptKey>();
    const nicKeys = new Map<string, ReceiptKey>();
    const ipKeys = new Map<string, ReceiptKey>();
    for (const s of subs) {
      nsgKeys.set(s, m.rc("azure:network.nsg.list", "ok", { subscription: s }));
      nicKeys.set(s, m.rc("azure:network.nic.list", "ok", { subscription: s }));
      ipKeys.set(s, m.rc("azure:network.public-ip.list", "ok", { subscription: s }));
    }
    const nsgFacts: AzureNsg[] = (w.nsgs ?? []).map((n) => {
      const sub = n.sub ?? SUB;
      const src = byReceipt(nsgKeys.get(sub) as ReceiptKey);
      return {
        src, id: nsgId(n.name, sub), name: n.name, location: "koreacentral", subscription: sub,
        rules: n.rules.map((r, i) => val<AzureNsgRule>({
          name: r.name ?? `rule-${i}`, direction: r.direction ?? "Inbound", access: r.access ?? "Allow", priority: r.priority ?? 100 + i, protocol: r.protocol ?? "Tcp",
          sourcePrefixes: r.sourcePrefixes ?? ["*"], sourceAsgCount: r.sourceAsgCount ?? 0, destPortRanges: r.destPortRanges ?? ["22"],
        }, src)),
        nicIds: val([...(n.nicIds ?? [])], src), subnetIds: val([...(n.subnetIds ?? [])], src), nicCount: (n.nicIds ?? []).length, subnetCount: (n.subnetIds ?? []).length,
      };
    });
    const nicFacts: AzureNic[] = (w.nics ?? []).map((n) => {
      const sub = n.sub ?? SUB;
      return { src: byReceipt(nicKeys.get(sub) as ReceiptKey), id: nicId(n.name, sub), subscription: sub, nsgId: n.nsg === undefined ? null : nsgId(n.nsg, sub), ipConfigs: [{ subnetId: n.subnet === undefined ? null : subnetId(n.subnet, sub), publicIpId: n.publicIp === undefined ? null : ipId(n.publicIp, sub) }] };
    });
    const ipFacts: AzurePublicIp[] = (w.publicIps ?? []).map((p) => {
      const sub = p.sub ?? SUB;
      return { src: byReceipt(ipKeys.get(sub) as ReceiptKey), id: ipId(p.name, sub), subscription: sub, hasAddress: p.hasAddress, allocationMethod: "Static", attachedTo: null };
    });
    const data: AzureNetData = {
      ...scope,
      nsgs: perSub(nsgFacts, (n) => n.subscription, (s) => nsgKeys.get(s) as ReceiptKey),
      nics: perSub(nicFacts, (n) => n.subscription, (s) => nicKeys.get(s) as ReceiptKey),
      publicIps: perSub(ipFacts, (n) => n.subscription, (s) => ipKeys.get(s) as ReceiptKey),
    };
    m.net(data);
    m.prove("azure.net.nsgs", { present: nsgFacts.length, receipts: [...nsgKeys.values()], unit: unitInfo, units: unitsOf(nsgKeys) });
    m.prove("azure.net.nics", { present: nicFacts.length, receipts: [...nicKeys.values()], unit: unitInfo, units: unitsOf(nicKeys) });
    m.prove("azure.net.public-ips", { present: ipFacts.length, receipts: [...ipKeys.values()], unit: unitInfo, units: unitsOf(ipKeys) });
  }
  // Azure 현관 문: 수집기가 집어 가는 데이터가 없다(Entra 사용자 정보는 가이드 카드로 안내)
  m.mfa({ entraUsers: miss("not-collected") });
  return { m, build: () => m.build() };
}
