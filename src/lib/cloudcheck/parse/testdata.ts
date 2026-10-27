// src/lib/cloudcheck/parse/testdata.ts — parse 테스트용 수집 파일 빌더 (테스트 전용)
// bash 수집기를 돌리지 않고(느리다) 계약을 지키는 수집 파일을 TS로 직접 만든다. 영수증 ID는 Rcpts가 순서대로 붙인다.
// 값은 문서 표본 범위만 쓴다: 계정 123456789012 · 210987654321(외부), GUID는 패턴형, IP는 TEST-NET(203.0.113.0/24 · 198.51.100.0/24), 버킷·이름은 가공.
import { recognize } from "./recognize";
import type { InputRecognition, InputVia } from "../model/report";

export type Json = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
export const T0 = "2026-10-19T03:12:00Z";
export const SELF = "123456789012";
export const EXTERNAL = "210987654321";
// GUID는 0으로 채운 표본형만 쓴다(누출 스캔 규칙). 끝을 a0xx로 둬서 마스킹 가명(…0001부터 순번)과 겹치지 않는다
export const TENANT = "00000000-0000-0000-0000-00000000a001";
export const OTHER_TENANT = "00000000-0000-0000-0000-00000000a002";
export const SUB = "00000000-0000-0000-0000-00000000a011";
export const SUB2 = "00000000-0000-0000-0000-00000000a012";
export const SUB3 = "00000000-0000-0000-0000-00000000a013";
export const PAB_ON = { blockPublicAcls: true, ignorePublicAcls: true, blockPublicPolicy: true, restrictPublicBuckets: true };

type Result = "ok" | "empty" | "notconfigured" | "denied" | "error" | "throttled" | "truncated" | "unsupported";
export class Rcpts {
  readonly list: Json[] = [];
  add(call: string, result: Result = "ok", o: { region?: string; resource?: string | null; subscription?: string; count?: number | null; errorCode?: string | null } = {}): string {
    const id = `r-${String(this.list.length + 1).padStart(4, "0")}`;
    let count: number | null = o.count === undefined ? null : o.count;
    let errorCode: string | null = o.errorCode === undefined ? null : o.errorCode;
    if (result === "empty") count = 0;
    if (result === "truncated" && count === null) count = 1;
    if (!["ok", "empty", "truncated"].includes(result)) { count = null; errorCode = errorCode ?? (result === "notconfigured" ? "NoSuchConfig" : result === "denied" ? "AccessDenied" : result === "throttled" ? "Throttling" : result === "unsupported" ? "cli-exit-252" : "cli-exit-255"); }
    else errorCode = null;
    const base: Json = { id, call };
    if (o.region !== undefined) base.region = o.region;
    if (o.subscription !== undefined) base.subscription = o.subscription;
    this.list.push({ ...base, resource: o.resource ?? null, result, count, errorCode, at: T0 });
    return id;
  }
}

export interface AwsOpts {
  doors?: Partial<Record<"mfa" | "key" | "net" | "sto" | "log", "collected" | "skipped">>;
  /** 사용자 IAM 목록 결과(기본 ok) */
  usersResult?: Result;
  /** 계정 요약의 Users를 바꿔 교차 확인을 깬다 */
  summaryUsers?: number;
  /** 보고서 CSV를 직접 지정 */
  csv?: string;
  mutate?: (f: Json, r: Rcpts) => void;
}

export const REPORT_HEADER = "user,arn,user_creation_time,password_enabled,password_last_used,password_last_changed,password_next_rotation,mfa_active,access_key_1_active,access_key_1_last_rotated,access_key_1_last_used_date,access_key_1_last_used_region,access_key_1_last_used_service,access_key_2_active,access_key_2_last_rotated,access_key_2_last_used_date,access_key_2_last_used_region,access_key_2_last_used_service,cert_1_active,cert_1_last_rotated,cert_2_active,cert_2_last_rotated";
export const reportCsv = (extra: string[] = [], account = SELF): string => [
  REPORT_HEADER,
  `<root_account>,arn:aws:iam::${account}:root,2020-01-01T00:00:00+00:00,not_supported,2026-07-01T00:10:00+00:00,not_supported,not_supported,true,false,N/A,N/A,N/A,N/A,false,N/A,N/A,N/A,N/A,false,N/A,false,N/A`,
  `jane.doe,arn:aws:iam::${account}:user/jane.doe,2025-03-02T01:00:00+00:00,true,2026-10-18T09:00:00+00:00,2025-03-02T01:00:00+00:00,N/A,true,false,N/A,N/A,N/A,N/A,false,N/A,N/A,N/A,N/A,false,N/A,false,N/A`,
  `ci-deployer,arn:aws:iam::${account}:user/ci-deployer,2024-11-20T05:30:00+00:00,false,N/A,N/A,N/A,false,true,2026-01-05T00:00:00+00:00,2026-10-17T12:00:00+00:00,ap-northeast-2,s3,false,N/A,N/A,N/A,N/A,false,N/A,false,N/A`,
  ...extra, "",
].join("\n");

/** 계약(collect-schema strict)을 통과하는 AWS 수집 파일 + 의미 있는 영수증 ID 모음 */
export function awsFile(o: AwsOpts = {}): { file: Json; ids: Record<string, string>; rc: Rcpts } {
  const rc = new Rcpts();
  const ids: Record<string, string> = {};
  const doors = { mfa: "collected", key: "collected", net: "collected", sto: "collected", log: "collected", ...o.doors } as Record<string, string>;
  ids.sts = rc.add("sts:GetCallerIdentity");
  ids.alias = rc.add("iam:ListAccountAliases", "ok", { count: 1 });
  ids.regions = rc.add("ec2:DescribeRegions", "ok", { count: 2 });
  const data: Json = {};
  if (doors.mfa === "collected" || doors.key === "collected") {
    ids.gen = rc.add("iam:GenerateCredentialReport");
    ids.report = rc.add("iam:GetCredentialReport");
    ids.summary = rc.add("iam:GetAccountSummary");
    data.credentialReport = { generateReceipt: ids.gen, receipt: ids.report, value: { generatedTime: "2026-10-19T03:11:58+00:00", format: "text/csv", csv: o.csv ?? reportCsv() } };
    data.accountSummary = { receipt: ids.summary, value: { Users: o.summaryUsers ?? 2, Groups: 1, Roles: 2, AccountMFAEnabled: 1, AccountAccessKeysPresent: 0, AccountSigningCertificatesPresent: 0, MFADevicesInUse: 1 } };
    const names = ["ci-deployer", "jane.doe"];
    ids.users = rc.add("iam:ListUsers", o.usersResult ?? "ok", { count: o.usersResult && o.usersResult !== "ok" && o.usersResult !== "truncated" ? null : names.length });
    const failed = !!o.usersResult && o.usersResult !== "ok" && o.usersResult !== "truncated";
    const items = failed ? null : names.map((userName) => {
      const hole = (call: string, door: string, value: unknown, extra: Json = {}): Json => {
        if (doors[door] !== "collected") return { receipt: ids.users, value: null };
        const id = rc.add(call, extra.result ?? "ok", { resource: userName, region: "global", count: extra.count });
        ids[`${call}#${userName}`] = id;
        return { receipt: id, value };
      };
      const isBot = userName === "ci-deployer";
      return {
        userName, createDate: isBot ? "2024-11-20T05:30:00+00:00" : "2025-03-02T01:00:00+00:00", passwordLastUsed: isBot ? null : "2026-10-18T09:00:00+00:00",
        accessKeys: hole("iam:ListAccessKeys", "key", isBot ? [{ status: "Active", createDate: "2026-01-05T00:00:00+00:00", idSuffix: "MPLE" }] : [], isBot ? { count: 1 } : { result: "empty" }),
        mfaDevices: hole("iam:ListMFADevices", "mfa", { count: isBot ? 0 : 1 }, isBot ? { result: "empty" } : { count: 1 }),
        attachedPolicyArns: hole("iam:ListAttachedUserPolicies", "key", isBot ? ["arn:aws:iam::aws:policy/AmazonS3ReadOnlyAccess"] : [], isBot ? { count: 1 } : { result: "empty" }),
        groupNames: hole("iam:ListGroupsForUser", "key", isBot ? [] : ["platform-admins"], isBot ? { result: "empty" } : { count: 1 }),
      };
    });
    data.iamUsers = { receipt: ids.users, budget: { limit: 150, total: items ? items.length : 0, collected: items ? items.length : 0 }, items };
    if (doors.key === "collected") {
      ids.groupPol = rc.add("iam:ListAttachedGroupPolicies", "ok", { resource: "platform-admins", region: "global", count: 1 });
      data.iamGroups = [{ groupName: "platform-admins", attachedPolicyArns: { receipt: ids.groupPol, value: ["arn:aws:iam::aws:policy/AdministratorAccess"] } }];
      ids.roles = rc.add("iam:ListRoles", "ok", { count: 2 });
      data.iamRoles = { receipt: ids.roles, value: [
        { roleName: "AWSServiceRoleForSupport", path: "/aws-service-role/support.amazonaws.com/", createDate: "2024-11-01T00:00:00+00:00", trust: [{ effect: "Allow", actions: ["sts:AssumeRole"], notPrincipal: false, principal: { wildcard: false, aws: [], service: ["support.amazonaws.com"], federated: [], canonicalUserCount: 0 }, conditionKeys: [] }] },
        { roleName: "vendor-access", path: "/", createDate: "2025-06-01T00:00:00+00:00", trust: [{ effect: "Allow", actions: ["sts:AssumeRole"], notPrincipal: false, principal: { wildcard: false, aws: [`arn:aws:iam::${EXTERNAL}:root`], service: [], federated: [], canonicalUserCount: 0 }, conditionKeys: ["StringEquals:sts:ExternalId"] }] },
      ] };
    }
  }
  if (doors.net === "collected") {
    ids.sgNe = rc.add("ec2:DescribeSecurityGroups", "ok", { region: "ap-northeast-2", count: 1 });
    ids.sgUe = rc.add("ec2:DescribeSecurityGroups", "ok", { region: "us-east-1", count: 1 });
    ids.eniNe = rc.add("ec2:DescribeNetworkInterfaces", "ok", { region: "ap-northeast-2", count: 1 });
    ids.eniUe = rc.add("ec2:DescribeNetworkInterfaces", "empty", { region: "us-east-1" });
    data.securityGroups = [
      { region: "ap-northeast-2", receipt: ids.sgNe, items: [{ groupId: "sg-0a1b2c3d4e5f60718", groupName: "bastion-ssh", vpcId: "vpc-0123456789abcdef0", ingress: [{ protocol: "tcp", fromPort: 22, toPort: 22, cidrs: ["0.0.0.0/0", "198.51.100.23/32"], ipv6Cidrs: ["::/0"], prefixListIds: ["pl-0123456789abcdef0"], sgRefCount: 0 }] }] },
      { region: "us-east-1", receipt: ids.sgUe, items: [{ groupId: "sg-0f0e0d0c0b0a09080", groupName: "default", vpcId: null, ingress: [] }] },
    ];
    data.networkInterfaces = [
      { region: "ap-northeast-2", receipt: ids.eniNe, items: [{ eniId: "eni-0aaaabbbbccccdddd", groupIds: ["sg-0a1b2c3d4e5f60718"], hasPublicIp: true, hasIpv6: false, interfaceType: "interface", status: "in-use", requesterManaged: false }] },
      { region: "us-east-1", receipt: ids.eniUe, items: [] },
    ];
  }
  if (doors.sto === "collected") {
    ids.pabAcct = rc.add("s3:GetAccountPublicAccessBlock", "notconfigured", { errorCode: "NoSuchPublicAccessBlockConfiguration" });
    data.accountPublicAccessBlock = { receipt: ids.pabAcct, value: null };
    ids.buckets = rc.add("s3:ListAllMyBuckets", "ok", { count: 2 });
    const mk = (name: string, region: string, pub: boolean): Json => {
      const b = (call: string, result: Result, value: unknown, code?: string): Json => {
        const id = rc.add(call, result, { resource: name, region, errorCode: code });
        ids[`${call}#${name}`] = id;
        return { receipt: id, value };
      };
      return {
        name, createDate: "2022-05-01T00:00:00+00:00", region: { value: region, source: "list", receipt: null },
        publicAccessBlock: b("s3:GetBucketPublicAccessBlock", "ok", PAB_ON),
        policyStatus: b("s3:GetBucketPolicyStatus", "notconfigured", null, "NoSuchBucketPolicy"),
        acl: b("s3:GetBucketAcl", "ok", { publicGrants: pub ? [{ grantee: "AllUsers", permission: "READ" }] : [] }),
        ownership: b("s3:GetBucketOwnershipControls", "ok", { objectOwnership: "BucketOwnerEnforced" }),
        website: pub ? b("s3:GetBucketWebsite", "ok", { enabled: true }) : b("s3:GetBucketWebsite", "notconfigured", null, "NoSuchWebsiteConfiguration"),
      };
    };
    data.buckets = { receipt: ids.buckets, budget: { limit: 300, total: 2, collected: 2 }, items: [mk("acme-public-assets", "us-east-1", true), mk("acme-prod-data", "ap-northeast-2", false)] };
  }
  if (doors.log === "collected") {
    ids.trails = rc.add("cloudtrail:DescribeTrails", "ok", { count: 1 });
    const arn = `arn:aws:cloudtrail:ap-northeast-2:${SELF}:trail/acme-org-trail`;
    ids.trailStatus = rc.add("cloudtrail:GetTrailStatus", "ok", { resource: arn, region: "ap-northeast-2" });
    ids.trailSel = rc.add("cloudtrail:GetEventSelectors", "ok", { resource: arn, region: "ap-northeast-2" });
    data.trails = { receipt: ids.trails, value: [{
      name: "acme-org-trail", trailArn: arn, homeRegion: "ap-northeast-2", isMultiRegion: true, isOrganizationTrail: false, logFileValidationEnabled: true, hasCloudWatchLogs: false, hasCustomEventSelectors: false,
      status: { receipt: ids.trailStatus, value: { isLogging: true, hasDeliveryError: false } },
      selectors: { receipt: ids.trailSel, value: { basic: [{ readWriteType: "All", includeManagementEvents: true }], advanced: [] } },
    }] };
  }
  const file: Json = {
    schema: "cloudcheck.collect/1.0",
    collector: { name: "cloudcheck-aws", version: "1.0.0", sha256: null, tools: { cli: "aws-cli/2.17.0", jq: "jq-1.6", bash: "5.2.15" } },
    collectedAt: T0,
    run: { finishedAt: T0, confirmed: "interactive", doors: { mfa: doors.mfa, key: doors.key, net: doors.net, sto: doors.sto, log: doors.log } },
    cloud: "aws",
    identity: { receipt: ids.sts, accountId: SELF, partition: "aws", principalType: "assumed-role", principalName: "SecurityAuditRole", alias: { receipt: ids.alias, value: "acme-prod" } },
    scope: { regions: { receipt: ids.regions, value: ["ap-northeast-2", "us-east-1"] }, regionsRequested: null },
    receipts: rc.list, data,
  };
  o.mutate?.(file, rc);
  return { file, ids, rc };
}

export interface AzOpts { doors?: Partial<Record<"key" | "net" | "sto" | "log", "collected" | "skipped">>; mutate?: (f: Json, r: Rcpts) => void }
const azId = (sub: string, rg: string, rest: string): string => `/subscriptions/${sub}/resourceGroups/${rg}/providers/${rest}`;
export const AZ_ST = azId(SUB, "rg-web", "Microsoft.Storage/storageAccounts/stwebfiles01");
export const AZ_NSG = azId(SUB, "rg-web", "Microsoft.Network/networkSecurityGroups/nsg-web");
export const AZ_NIC = azId(SUB, "rg-web", "Microsoft.Network/networkInterfaces/nic-web1");
export const AZ_PIP = azId(SUB, "rg-web", "Microsoft.Network/publicIPAddresses/pip-web");

export function azureFile(o: AzOpts = {}): { file: Json; ids: Record<string, string>; rc: Rcpts } {
  const rc = new Rcpts();
  const ids: Record<string, string> = {};
  const doors = { key: "collected", net: "collected", sto: "collected", log: "collected", ...o.doors } as Record<string, string>;
  ids.show = rc.add("azure:account.show");
  ids.list = rc.add("azure:account.list", "ok", { count: 2 });
  const data: Json = {};
  if (["key", "sto", "log"].some((d) => doors[d] === "collected")) {
    ids.sa = rc.add("azure:storage.account.list", "ok", { subscription: SUB, count: 1 });
    const containers = doors.sto === "collected" ? { receipt: (ids.ct = rc.add("azure:storage.container-rm.list", "ok", { subscription: SUB, resource: AZ_ST, count: 1 })), value: [{ name: "assets", publicAccess: "Blob" }] } : { receipt: ids.sa, value: null };
    const diag = doors.log === "collected" ? { receipt: (ids.bd = rc.add("azure:monitor.diagnostic-settings.list", "empty", { subscription: SUB, resource: AZ_ST })), value: [] } : { receipt: ids.sa, value: null };
    data.storageAccounts = [{
      subscription: SUB, receipt: ids.sa, budget: { limit: 100, total: 1, collected: 1 },
      items: [{ id: AZ_ST, name: "stwebfiles01", kind: "StorageV2", location: "koreacentral", allowBlobPublicAccess: true, allowSharedKeyAccess: true, keyCreationTime: { key1: "2025-01-10T00:00:00.1234567+00:00", key2: null }, keyExpirationPeriodInDays: null, sasExpirationPeriod: null, publicNetworkAccess: "Enabled", networkDefaultAction: "Allow", containers, blobDiagnostics: diag }],
    }];
  }
  if (doors.net === "collected") {
    ids.nsg = rc.add("azure:network.nsg.list", "ok", { subscription: SUB, count: 1 });
    ids.nic = rc.add("azure:network.nic.list", "ok", { subscription: SUB, count: 1 });
    ids.pip = rc.add("azure:network.public-ip.list", "ok", { subscription: SUB, count: 1 });
    data.nsgs = [{ subscription: SUB, receipt: ids.nsg, items: [{ id: AZ_NSG, name: "nsg-web", location: "koreacentral", rules: [{ name: "allow-rdp", direction: "Inbound", access: "Allow", priority: 100, protocol: "Tcp", sourcePrefixes: ["*"], sourceAsgCount: 0, destPortRanges: ["3389"] }], nicIds: [AZ_NIC], subnetIds: [] }] }];
    data.nics = [{ subscription: SUB, receipt: ids.nic, items: [{ id: AZ_NIC, nsgId: AZ_NSG, ipConfigs: [{ subnetId: null, publicIpId: AZ_PIP }] }] }];
    data.publicIps = [{ subscription: SUB, receipt: ids.pip, items: [{ id: AZ_PIP, hasAddress: true, allocationMethod: "Static", attachedTo: `${AZ_NIC}/ipConfigurations/ipconfig1` }] }];
  }
  if (doors.log === "collected") {
    ids.act = rc.add("azure:monitor.diagnostic-settings.subscription.list", "ok", { subscription: SUB, count: 1 });
    data.activityLogExports = [{ subscription: SUB, receipt: ids.act, items: [{ name: "activity-to-law", logs: [{ category: "Administrative", categoryGroup: null, enabled: true }], destinations: { workspace: true, storage: false, eventHub: false, partner: false } }] }];
  }
  const file: Json = {
    schema: "cloudcheck.collect/1.0",
    collector: { name: "cloudcheck-azure", version: "1.0.0", sha256: null, tools: { cli: "azure-cli 2.60.0", jq: "jq-1.6", bash: "5.2.15" } },
    collectedAt: T0,
    run: { finishedAt: T0, confirmed: "flag-yes", doors: { mfa: "skipped", key: doors.key, net: doors.net, sto: doors.sto, log: doors.log } },
    cloud: "azure",
    identity: { receipt: ids.show, tenantId: TENANT, currentSubscription: SUB, cloudName: "AzureCloud", principalType: "user" },
    scope: { subscriptions: { receipt: ids.list, value: [
      { id: SUB, name: "운영 구독", state: "Enabled", tenantId: TENANT, inScope: true, outOfScopeReason: null },
      { id: SUB2, name: "보관 구독", state: "Disabled", tenantId: TENANT, inScope: false, outOfScopeReason: "not-enabled" },
    ] }, subscriptionsRequested: null },
    receipts: rc.list, data,
  };
  o.mutate?.(file, rc);
  return { file, ids, rc };
}

/* ───────── 인식 도우미 ───────── */
export const enc = (x: unknown): Uint8Array => new TextEncoder().encode(typeof x === "string" ? x : JSON.stringify(x));
export function rec(x: unknown, o: { name?: string; via?: InputVia; lastModified?: number | null } = {}): InputRecognition {
  return recognize({ via: o.via ?? "file", name: o.name ?? "cloudcheck-result.json", bytes: enc(x), lastModified: o.lastModified ?? null });
}
export function recCsv(text: string, name = "report.csv", lastModified: number | null = null): InputRecognition {
  return recognize({ via: "file", name, bytes: enc(text), lastModified });
}

/* ───────── Resource Graph CSV ───────── */
export const RG_STORAGE_HEADER = "ccQuery,tenantId,id,subscriptionId,resourceGroup,name,kind,location,allowBlobPublicAccess,allowSharedKeyAccess,key1CreationTime,key2CreationTime,keyExpirationPeriodInDays,sasExpirationPeriod";
export const rgStorageCsv = (rows: string[] = [`cc-rg-storage/1,${TENANT},${AZ_ST},${SUB},rg-web,stwebfiles01,StorageV2,koreacentral,,true,2025-01-10T00:00:00.1234567Z,,,`]): string => [RG_STORAGE_HEADER, ...rows, ""].join("\n");
export const RG_NSG_HEADER = "ccQuery,tenantId,nsgId,subscriptionId,nsgName,location,ruleName,direction,access,priority,protocol,sourcePrefix,sourcePrefixes,destPortRange,destPortRanges,nicCount,subnetCount";
export const rgNsgCsv = (rows: string[] = [`cc-rg-nsg/1,${TENANT},${AZ_NSG},${SUB},nsg-web,koreacentral,allow-rdp,Inbound,Allow,100,Tcp,*,[],3389,[],1,0`]): string => [RG_NSG_HEADER, ...rows, ""].join("\n");
