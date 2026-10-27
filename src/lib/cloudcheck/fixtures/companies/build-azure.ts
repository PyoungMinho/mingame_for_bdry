// src/lib/cloudcheck/fixtures/companies/build-azure.ts — Azure 가짜 회사 빌더 (TS DSL → 수집기 결과 JSON)
// build-aws.ts와 같은 원칙: 정의는 "실제 모습"만, 영수증 · 개수 · 시각은 빌더가 수집기처럼 만든다. 정답은 answers/*.json에 사람이 따로 먼저 쓴다.
// 값은 문서 표본만 쓴다: 0으로 채운 GUID, 리소스 그룹 rg-…, 저장소 이름 st…, 문서용 IP 대역.
import type { AzureCollect } from "../../contract/collect-schema";
import { Recorder, applyList } from "./rec";
import type { Fault, Natural, Outcome } from "./rec";

export interface AzSubDef {
  readonly key: string; readonly id: string; readonly name: string;
  readonly inScope: boolean; readonly outOfScopeReason?: "other-tenant" | "not-enabled" | "not-requested"; readonly tenantId?: string;
}
export interface AzDiagDef {
  readonly name: string;
  readonly logs: readonly { readonly category: string | null; readonly categoryGroup: string | null; readonly enabled: boolean }[];
  readonly destinations: { readonly workspace?: boolean; readonly storage?: boolean; readonly eventHub?: boolean; readonly partner?: boolean };
}
export interface AzContainerDef { readonly name: string; readonly publicAccess: string | null }
export interface AzStorageDef {
  readonly name: string; readonly sub: string; readonly rg: string; readonly kind: string | null; readonly location: string;
  readonly allowBlobPublicAccess: boolean | null; readonly allowSharedKeyAccess: boolean | null;
  /** null = keyCreationTime 자체가 없다(옛 계정) */
  readonly keyCreation: { readonly key1: string | null; readonly key2: string | null } | null;
  readonly keyExpirationDays: number | null;
  readonly publicNetworkAccess: string | null; readonly networkDefaultAction: string | null;
  readonly containers: readonly AzContainerDef[]; readonly blobDiag: readonly AzDiagDef[];
}
export interface AzNsgRuleDef { readonly name: string; readonly priority: number; readonly access: "Allow" | "Deny"; readonly direction?: "Inbound" | "Outbound"; readonly protocol?: string; readonly sources: readonly string[]; readonly ports: readonly string[] }
export interface AzNsgDef { readonly name: string; readonly sub: string; readonly rg: string; readonly location: string; readonly rules: readonly AzNsgRuleDef[]; readonly nics: readonly string[]; readonly subnets: readonly string[] }
export interface AzNicDef { readonly name: string; readonly sub: string; readonly rg: string; readonly nsg: string | null; readonly configs: readonly { readonly subnet: string | null; readonly publicIp: string | null }[] }
export interface AzPublicIpDef { readonly name: string; readonly sub: string; readonly rg: string; readonly hasAddress: boolean; readonly allocation: "Static" | "Dynamic"; readonly attachedTo: string | null }

export interface AzureCompany {
  readonly setId: "A" | "B" | "C" | "D";
  readonly name: string;
  readonly tenantId: string;
  /** 현재 구독(subscriptions의 key) */
  readonly currentSub: string;
  readonly principal: "user" | "servicePrincipal" | "managedIdentity" | "unknown";
  readonly collectedAt: string;
  readonly subscriptions: readonly AzSubDef[];
  readonly storage: readonly AzStorageDef[];
  /** 구독 key → 활동 로그 진단 설정 */
  readonly activityLogs: Readonly<Record<string, readonly AzDiagDef[]>>;
  readonly nsgs: readonly AzNsgDef[];
  readonly nics: readonly AzNicDef[];
  readonly publicIps: readonly AzPublicIpDef[];
  readonly faults: readonly Fault[];
  /** 요청하지 않은 문(--doors). 열쇠(key)·창고(sto)·CCTV(log)는 저장소 목록을 함께 쓰므로 창문(net)만 건너뛸 수 있다. 현관(mfa)은 실제 수집기가 늘 'skipped'로 적는다(Entra 정보는 수집하지 않고 포털 안내만 한다) */
  readonly skipDoors?: readonly "net"[];
}

const BUDGET_LIMIT = 200;
type Data = NonNullable<AzureCollect["data"]>;

const natural = (n: number): Natural => (n === 0 ? { result: "empty" } : { result: "ok", count: n });
const evList = <T>(o: Outcome, list: readonly T[]): { receipt: string; value: T[] | null } => ({ receipt: o.id, value: applyList(o, list) });
const azTime = (stamp: string): string => stamp.replace(/Z$/, ".000000+00:00");   // az CLI가 내는 모양

export const subId = (c: AzureCompany, key: string): string => {
  const s = c.subscriptions.find((x) => x.key === key);
  if (s === undefined) throw new Error(`없는 구독 key: ${key}`);
  return s.id;
};
const base = (c: AzureCompany, sub: string, rg: string): string => `/subscriptions/${subId(c, sub)}/resourceGroups/${rg}/providers`;
export const storageId = (c: AzureCompany, a: Pick<AzStorageDef, "sub" | "rg" | "name">): string => `${base(c, a.sub, a.rg)}/Microsoft.Storage/storageAccounts/${a.name}`;
export const nsgId = (c: AzureCompany, n: Pick<AzNsgDef, "sub" | "rg" | "name">): string => `${base(c, n.sub, n.rg)}/Microsoft.Network/networkSecurityGroups/${n.name}`;
const nicId = (c: AzureCompany, n: Pick<AzNicDef, "sub" | "rg" | "name">): string => `${base(c, n.sub, n.rg)}/Microsoft.Network/networkInterfaces/${n.name}`;
const pipId = (c: AzureCompany, n: Pick<AzPublicIpDef, "sub" | "rg" | "name">): string => `${base(c, n.sub, n.rg)}/Microsoft.Network/publicIPAddresses/${n.name}`;
const subnetId = (c: AzureCompany, sub: string, rg: string, name: string): string => `${base(c, sub, rg)}/Microsoft.Network/virtualNetworks/vnet-main/subnets/${name}`;

interface DiagOut { name: string; logs: { category: string | null; categoryGroup: string | null; enabled: boolean }[]; destinations: { workspace: boolean; storage: boolean; eventHub: boolean; partner: boolean } }
const diagOut = (d: AzDiagDef): DiagOut => ({
  name: d.name, logs: d.logs.map((l) => ({ category: l.category, categoryGroup: l.categoryGroup, enabled: l.enabled })),
  destinations: { workspace: d.destinations.workspace ?? false, storage: d.destinations.storage ?? false, eventHub: d.destinations.eventHub ?? false, partner: d.destinations.partner ?? false },
});

export function buildAzureCollect(c: AzureCompany): AzureCollect {
  const rec = new Recorder(c.collectedAt, c.faults);
  const idRc = rec.call("azure:account.show", {}, { result: "ok" });
  const subsRc = rec.call("azure:account.list", {}, natural(c.subscriptions.length));
  const inScope = c.subscriptions.filter((s) => s.inScope);
  const data: Data = {};

  // 저장소 계정 (열쇠 · 창고 · CCTV가 함께 읽는다)
  data.storageAccounts = inScope.map((s) => {
    const accts = c.storage.filter((a) => a.sub === s.key);
    const rc = rec.call("azure:storage.account.list", { subscription: s.id }, natural(accts.length));
    const shown = applyList(rc, accts);
    return {
      subscription: s.id, receipt: rc.id,
      budget: { limit: BUDGET_LIMIT, total: shown === null ? 0 : shown.length, collected: shown === null ? 0 : shown.length },
      items: shown === null ? null : shown.map((a) => {
        const id = storageId(c, a);
        const cont = rec.call("azure:storage.container-rm.list", { subscription: s.id, resource: id }, natural(a.containers.length));
        const diag = rec.call("azure:monitor.diagnostic-settings.list", { subscription: s.id, resource: id }, natural(a.blobDiag.length));
        return {
          id, name: a.name, kind: a.kind, location: a.location,
          allowBlobPublicAccess: a.allowBlobPublicAccess, allowSharedKeyAccess: a.allowSharedKeyAccess,
          keyCreationTime: a.keyCreation === null ? null : { key1: a.keyCreation.key1 === null ? null : azTime(a.keyCreation.key1), key2: a.keyCreation.key2 === null ? null : azTime(a.keyCreation.key2) },
          keyExpirationPeriodInDays: a.keyExpirationDays, sasExpirationPeriod: null,
          publicNetworkAccess: a.publicNetworkAccess, networkDefaultAction: a.networkDefaultAction,
          containers: evList(cont, a.containers.map((x) => ({ name: x.name, publicAccess: x.publicAccess }))),
          blobDiagnostics: evList(diag, a.blobDiag.map(diagOut)),
        };
      }),
    };
  });

  // 활동 로그 내보내기 (구독별)
  data.activityLogExports = inScope.map((s) => {
    const list = c.activityLogs[s.key] ?? [];
    const rc = rec.call("azure:monitor.diagnostic-settings.subscription.list", { subscription: s.id }, natural(list.length));
    return { subscription: s.id, receipt: rc.id, items: applyList(rc, list)?.map(diagOut) ?? null };
  });

  // 창문: NSG · NIC · 공인 IP (구독별)
  const netOn = !(c.skipDoors ?? []).includes("net");
  if (netOn) {
    data.nsgs = inScope.map((s) => {
      const list = c.nsgs.filter((n) => n.sub === s.key);
      const rc = rec.call("azure:network.nsg.list", { subscription: s.id }, natural(list.length));
      return { subscription: s.id, receipt: rc.id, items: applyList(rc, list)?.map((n) => ({
        id: nsgId(c, n), name: n.name, location: n.location,
        rules: n.rules.map((r) => ({ name: r.name, direction: r.direction ?? "Inbound", access: r.access, priority: r.priority, protocol: r.protocol ?? "Tcp", sourcePrefixes: [...r.sources], sourceAsgCount: 0, destPortRanges: [...r.ports] })),
        nicIds: n.nics.map((x) => nicId(c, { sub: n.sub, rg: n.rg, name: x })), subnetIds: n.subnets.map((x) => subnetId(c, n.sub, n.rg, x)),
      })) ?? null };
    });
    data.nics = inScope.map((s) => {
      const list = c.nics.filter((n) => n.sub === s.key);
      const rc = rec.call("azure:network.nic.list", { subscription: s.id }, natural(list.length));
      return { subscription: s.id, receipt: rc.id, items: applyList(rc, list)?.map((n) => ({
        id: nicId(c, n), nsgId: n.nsg === null ? null : nsgId(c, { sub: n.sub, rg: n.rg, name: n.nsg }),
        ipConfigs: n.configs.map((k) => ({ subnetId: k.subnet === null ? null : subnetId(c, n.sub, n.rg, k.subnet), publicIpId: k.publicIp === null ? null : pipId(c, { sub: n.sub, rg: n.rg, name: k.publicIp }) })),
      })) ?? null };
    });
    data.publicIps = inScope.map((s) => {
      const list = c.publicIps.filter((n) => n.sub === s.key);
      const rc = rec.call("azure:network.public-ip.list", { subscription: s.id }, natural(list.length));
      return { subscription: s.id, receipt: rc.id, items: applyList(rc, list)?.map((n) => ({
        id: pipId(c, n), hasAddress: n.hasAddress, allocationMethod: n.allocation, attachedTo: n.attachedTo === null ? null : nicId(c, { sub: n.sub, rg: n.rg, name: n.attachedTo }),
      })) ?? null };
    });
  }

  return {
    schema: "cloudcheck.collect/1.0",
    collector: { name: "cloudcheck-azure", version: "1.0.0", sha256: null, tools: { cli: "azure-cli/2.64.0", jq: "jq-1.7.1", bash: "5.2.21" } },
    collectedAt: c.collectedAt,
    run: { finishedAt: rec.finishedAt(), confirmed: "interactive", doors: { mfa: "skipped", key: "collected", net: netOn ? "collected" : "skipped", sto: "collected", log: "collected" } },
    cloud: "azure",
    identity: { receipt: idRc.id, tenantId: c.tenantId, currentSubscription: subId(c, c.currentSub), cloudName: "AzureCloud", principalType: c.principal },
    scope: {
      subscriptions: evList(subsRc, c.subscriptions.map((s) => ({
        id: s.id, name: s.name, state: "Enabled", tenantId: s.tenantId ?? c.tenantId, inScope: s.inScope, outOfScopeReason: s.inScope ? null : s.outOfScopeReason ?? "not-requested",
      }))),
      subscriptionsRequested: null,
    },
    receipts: rec.receipts as AzureCollect["receipts"],
    data,
  };
}

/** 파일에 저장하는 바이트: 한 줄 JSON + 줄바꿈 */
export const azureJson = (c: AzureCompany): string => `${JSON.stringify(buildAzureCollect(c))}\n`;
