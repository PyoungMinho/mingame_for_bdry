// src/lib/cloudcheck/fixtures/companies/worlds-azure.ts — Azure 가짜 회사 4곳 (worlds-aws.ts와 같은 회사의 Azure판)
// 세트: A 반듯상회 · B 멈춘시계상회 · C 아슬아슬상회 · D 반쯤본상회. 판정 결과(정답)는 answers/*.json에 사람이 따로 먼저 쓴다.
// 기준 시각 2026-10-19T03:15:00Z. 모든 값은 문서 표본이다(0으로 채운 GUID).
import type { AzDiagDef, AzNicDef, AzNsgDef, AzPublicIpDef, AzStorageDef, AzSubDef, AzureCompany } from "./build-azure";

const TENANT = "00000000-0000-0000-0000-000000000001";
const OTHER_TENANT = "00000000-0000-0000-0000-000000000002";
const COLLECTED = "2026-10-19T03:15:00Z";
const LOC = "koreacentral";
const SUB = { prod: "00000000-0000-0000-0000-0000000000b1", dev: "00000000-0000-0000-0000-0000000000b2", legacy: "00000000-0000-0000-0000-0000000000b3", partner: "00000000-0000-0000-0000-0000000000c1" } as const;

const sub = (key: keyof typeof SUB, name: string, extra: Partial<AzSubDef> = {}): AzSubDef => ({ key, id: SUB[key], name, inScope: true, ...extra });

const activityToWorkspace: AzDiagDef = {
  name: "activity-to-law",
  logs: [{ category: "Administrative", categoryGroup: null, enabled: true }, { category: "Security", categoryGroup: null, enabled: true }, { category: "Policy", categoryGroup: null, enabled: true }],
  destinations: { workspace: true },
};
const blobToWorkspace: AzDiagDef = {
  name: "blob-to-law",
  logs: [{ category: "StorageRead", categoryGroup: null, enabled: true }, { category: "StorageWrite", categoryGroup: null, enabled: true }, { category: "StorageDelete", categoryGroup: null, enabled: true }],
  destinations: { workspace: true },
};

const storage = (name: string, s: "prod" | "dev" | "legacy", o: Partial<AzStorageDef>): AzStorageDef => ({
  name, sub: s, rg: s === "prod" ? "rg-prod" : s === "dev" ? "rg-dev" : "rg-legacy", kind: "StorageV2", location: LOC,
  allowBlobPublicAccess: false, allowSharedKeyAccess: false, keyCreation: { key1: "2026-09-10T00:00:00Z", key2: "2026-09-12T00:00:00Z" }, keyExpirationDays: 90,
  publicNetworkAccess: "Enabled", networkDefaultAction: "Deny", containers: [], blobDiag: [blobToWorkspace], ...o,
});
const nsg = (name: string, s: "prod" | "dev" | "legacy", o: Partial<AzNsgDef>): AzNsgDef => ({ name, sub: s, rg: "rg-net", location: LOC, rules: [], nics: [], subnets: [], ...o });
const nic = (name: string, s: "prod" | "dev" | "legacy", nsgName: string | null, publicIp: string | null): AzNicDef => ({ name, sub: s, rg: "rg-net", nsg: nsgName, configs: [{ subnet: "snet-main", publicIp }] });
const pip = (name: string, s: "prod" | "dev" | "legacy", attachedTo: string | null): AzPublicIpDef => ({ name, sub: s, rg: "rg-net", hasAddress: true, allocation: "Static", attachedTo });
const httpsFromInternet = { name: "allow-https-in", priority: 100, access: "Allow", sources: ["Internet"], ports: ["443"] } as const;
const sshFromOffice = (cidr: string) => ({ name: "allow-office-ssh", priority: 110, access: "Allow", sources: [cidr], ports: ["22"] }) as const;

/* ───────── A 반듯상회: 대체로 잘 정리된 회사 ───────── */
export const AZURE_A: AzureCompany = {
  setId: "A", name: "반듯상회", tenantId: TENANT, currentSub: "prod", principal: "user", collectedAt: COLLECTED,
  subscriptions: [sub("prod", "반듯상회-운영"), sub("dev", "반듯상회-개발")],
  storage: [
    storage("stbanjeutapp01", "prod", { containers: [{ name: "app-data", publicAccess: "None" }, { name: "backups", publicAccess: "None" }] }),
    storage("stbanjeutlogs02", "prod", { allowSharedKeyAccess: true, containers: [{ name: "insights-logs", publicAccess: "None" }] }),   // 공유 키를 허용하지만 두 키 모두 최근에 바꿈
    storage("stbanjeutdev03", "dev", { containers: [{ name: "scratch", publicAccess: "None" }] }),
  ],
  activityLogs: { prod: [activityToWorkspace], dev: [activityToWorkspace] },
  nsgs: [
    nsg("nsg-banjeut-web", "prod", { rules: [httpsFromInternet, sshFromOffice("203.0.113.0/24")], nics: ["nic-web-01"], subnets: [] }),
    nsg("nsg-banjeut-dev", "dev", { rules: [sshFromOffice("203.0.113.0/24")], nics: ["nic-dev-01"] }),
  ],
  nics: [nic("nic-web-01", "prod", "nsg-banjeut-web", "pip-web-01"), nic("nic-dev-01", "dev", "nsg-banjeut-dev", null)],
  publicIps: [pip("pip-web-01", "prod", "nic-web-01")],
  faults: [],
};

/* ───────── B 멈춘시계상회: 몇 해 전에 설정이 멈춘 회사. 위험은 없고 주의만 있다 ───────── */
export const AZURE_B: AzureCompany = {
  setId: "B", name: "멈춘시계상회", tenantId: TENANT, currentSub: "prod", principal: "user", collectedAt: COLLECTED,
  subscriptions: [sub("prod", "멈춘시계상회-운영"), sub("dev", "멈춘시계상회-개발")],
  storage: [
    storage("stoldshopfiles01", "prod", {
      allowBlobPublicAccess: null, allowSharedKeyAccess: null, keyCreation: { key1: "2025-02-01T00:00:00Z", key2: "2025-02-01T00:00:00Z" }, keyExpirationDays: null,
      containers: [{ name: "images", publicAccess: "None" }, { name: "$web", publicAccess: "None" }], blobDiag: [],      // 정적 웹사이트($web) + 접근 기록 없음
    }),
    storage("stoldshopbackup02", "prod", {
      allowBlobPublicAccess: null, allowSharedKeyAccess: true, keyCreation: { key1: "2025-01-15T00:00:00Z", key2: "2025-01-15T00:00:00Z" }, keyExpirationDays: null,
      containers: [{ name: "backup", publicAccess: "None" }], blobDiag: [],
    }),
    storage("stoldshopdev03", "dev", { allowBlobPublicAccess: null, allowSharedKeyAccess: null, keyCreation: null, keyExpirationDays: null, containers: [], blobDiag: [] }),   // 키 생성 기록이 없는 옛 계정
  ],
  activityLogs: { prod: [], dev: [] },
  nsgs: [nsg("nsg-oldshop", "prod", { rules: [httpsFromInternet], nics: ["nic-oldshop-01"] })],
  nics: [nic("nic-oldshop-01", "prod", "nsg-oldshop", "pip-oldshop-01")],
  publicIps: [pip("pip-oldshop-01", "prod", "nic-oldshop-01")],
  faults: [],
};

/* ───────── C 아슬아슬상회: 사고 직전. 위험 위주 ───────── */
export const AZURE_C: AzureCompany = {
  setId: "C", name: "아슬아슬상회", tenantId: TENANT, currentSub: "prod", principal: "user", collectedAt: COLLECTED,
  subscriptions: [sub("prod", "아슬아슬상회-운영"), sub("dev", "아슬아슬상회-개발")],
  storage: [
    storage("stacmeexports01", "prod", {
      allowBlobPublicAccess: true, allowSharedKeyAccess: true, keyCreation: { key1: "2024-11-05T00:00:00Z", key2: "2024-11-05T00:00:00Z" }, keyExpirationDays: null,
      containers: [{ name: "exports", publicAccess: "Container" }, { name: "reports", publicAccess: "Blob" }, { name: "private-data", publicAccess: "None" }], blobDiag: [],
    }),
    storage("stacmedev02", "dev", { allowBlobPublicAccess: null, allowSharedKeyAccess: false, keyCreation: null, keyExpirationDays: null, containers: [{ name: "tmp", publicAccess: "None" }], blobDiag: [] }),
  ],
  activityLogs: { prod: [], dev: [] },
  nsgs: [
    nsg("nsg-acme-jump", "prod", {
      rules: [
        { name: "allow-rdp-any", priority: 100, access: "Allow", sources: ["*"], ports: ["3389"] },
        { name: "allow-ssh-any", priority: 110, access: "Allow", sources: ["Internet"], ports: ["22"] },
        { ...httpsFromInternet, priority: 120 },
      ],
      nics: ["nic-jump-01"],
    }),
    nsg("nsg-acme-db", "prod", { rules: [{ name: "allow-sql-any", priority: 100, access: "Allow", sources: ["*"], ports: ["1433"] }], nics: ["nic-db-01"] }),
    nsg("nsg-acme-dev", "dev", { rules: [httpsFromInternet] }),
  ],
  nics: [nic("nic-jump-01", "prod", "nsg-acme-jump", "pip-jump-01"), nic("nic-db-01", "prod", "nsg-acme-db", "pip-db-01")],
  publicIps: [pip("pip-jump-01", "prod", "nic-jump-01"), pip("pip-db-01", "prod", "nic-db-01")],
  faults: [],
};

/* ───────── D 반쯤본상회: 조회 권한이 모자라 반쯤만 본 회사 ───────── */
export const AZURE_D: AzureCompany = {
  setId: "D", name: "반쯤본상회", tenantId: TENANT, currentSub: "prod", principal: "user", collectedAt: COLLECTED,
  subscriptions: [
    sub("prod", "반쯤본상회-운영"), sub("dev", "반쯤본상회-개발"), sub("legacy", "반쯤본상회-레거시"),
    sub("partner", "협력사-공유", { inScope: false, outOfScopeReason: "other-tenant", tenantId: OTHER_TENANT }),
  ],
  skipDoors: ["net"],                                                                                               // --doors mfa,key,sto,log
  storage: [
    storage("stdemoapp01", "prod", { containers: [{ name: "app-data", publicAccess: "None" }] }),
    storage("stdemodata02", "prod", { containers: [{ name: "datasets", publicAccess: "None" }] }),                       // 컨테이너 목록 조회만 거부(INV-7)
    storage("stdemodev03", "dev", { containers: [{ name: "scratch", publicAccess: "None" }] }),
    storage("stdemodev04", "dev", { containers: [{ name: "tmp", publicAccess: "None" }] }),                              // 목록이 잘려 이 계정은 못 받음
  ],
  activityLogs: { prod: [activityToWorkspace], dev: [activityToWorkspace], legacy: [activityToWorkspace] },
  nsgs: [nsg("nsg-demo-app", "prod", { rules: [httpsFromInternet], nics: ["nic-app-01"] }), nsg("nsg-demo-dev", "dev", { rules: [sshFromOffice("203.0.113.0/24")] })],
  nics: [nic("nic-app-01", "prod", "nsg-demo-app", "pip-app-01")],
  publicIps: [pip("pip-app-01", "prod", "nic-app-01")],
  faults: [
    { call: "azure:storage.account.list", subscription: SUB.legacy, kind: "denied" },                                  // 구독 하나를 통째로 못 봄
    { call: "azure:storage.account.list", subscription: SUB.dev, kind: "truncated", keep: 1 },                        // 목록이 잘림
    { call: "azure:monitor.diagnostic-settings.subscription.list", subscription: SUB.dev, kind: "denied" },          // 진단 설정 조회 거부
    { call: "azure:monitor.diagnostic-settings.subscription.list", subscription: SUB.legacy, kind: "denied" },
    { call: "azure:storage.container-rm.list", resource: `/subscriptions/${SUB.prod}/resourceGroups/rg-prod/providers/Microsoft.Storage/storageAccounts/stdemodata02`, kind: "denied" },
    { call: "azure:monitor.diagnostic-settings.list", resource: `/subscriptions/${SUB.prod}/resourceGroups/rg-prod/providers/Microsoft.Storage/storageAccounts/stdemoapp01`, kind: "denied" },        // 진단 설정 조회 거부
    { call: "azure:monitor.diagnostic-settings.list", resource: `/subscriptions/${SUB.prod}/resourceGroups/rg-prod/providers/Microsoft.Storage/storageAccounts/stdemodata02`, kind: "ok-null" },     // 응답에서 필드가 빠짐
    { call: "azure:monitor.diagnostic-settings.list", resource: `/subscriptions/${SUB.dev}/resourceGroups/rg-dev/providers/Microsoft.Storage/storageAccounts/stdemodev03`, kind: "unsupported" },  // 이 계정 유형은 지원하지 않음
  ],
};

export const AZURE_COMPANIES = { A: AZURE_A, B: AZURE_B, C: AZURE_C, D: AZURE_D } as const;
