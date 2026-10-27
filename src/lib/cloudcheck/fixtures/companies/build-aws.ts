// src/lib/cloudcheck/fixtures/companies/build-aws.ts — AWS 가짜 회사 빌더 (TS DSL → 수집기 결과 JSON + 자격증명 보고서 CSV)
// 회사 정의(AwsCompany)는 "그 계정이 실제로 어떤 모습인가"만 적는다. 영수증 · 개수 · 키 순서 · 시각은 빌더가 수집기처럼 만든다.
// 장애(Fault)로 거부 · 잘림 · 오류 · 필드 부재를 넣는다. 정답은 이 파일이 아니라 answers/*.json에 사람이 따로 먼저 쓴다(빌더 출력을 정답으로 복사하지 않는다).
// 값은 문서 표본만 쓴다: 계정 111122223333, 키는 끝 4자리만, 버킷 amzn-s3-demo-…, 외부 계정 444455556666 · 999988887777, 문서용 IP 대역(203.0.113.0/24 · 198.51.100.0/24).
import type { AwsCollect } from "../../contract/collect-schema";
import { Recorder, applyList, awsTime } from "./rec";
import type { Fault, Natural, Outcome } from "./rec";

export type AwsDoorState = "collected" | "skipped";
export interface AwsKeyDef { readonly suffix: string; readonly status: "Active" | "Inactive"; readonly createdAt: string; readonly lastUsed: string | null; readonly usedRegion?: string; readonly usedService?: string }
export interface AwsUserDef {
  readonly name: string; readonly createdAt: string;
  /** 콘솔 비밀번호가 있는가 */
  readonly console: boolean; readonly passwordLastUsed: string | null; readonly mfa: boolean;
  readonly keys: readonly AwsKeyDef[]; readonly policies: readonly string[]; readonly groups: readonly string[];
}
export interface AwsRootDef {
  readonly createdAt: string;
  /** 보고서 루트 행의 password_enabled: 보통 not_supported, Organizations 신규 멤버는 false */
  readonly password: "not_supported" | "true" | "false";
  readonly passwordLastUsed: string | null; readonly mfa: boolean; readonly keys: readonly AwsKeyDef[];
}
export interface AwsTrustDef {
  readonly effect?: string; readonly actions?: readonly string[]; readonly notPrincipal?: boolean; readonly wildcard?: boolean;
  readonly aws?: readonly string[]; readonly service?: readonly string[]; readonly federated?: readonly string[]; readonly conditionKeys?: readonly string[];
}
export interface AwsRoleDef { readonly name: string; readonly path?: string; readonly createdAt: string; readonly trust: readonly AwsTrustDef[] | null }
export interface AwsIngressDef { readonly protocol: string; readonly from: number | null; readonly to: number | null; readonly cidrs?: readonly string[]; readonly ipv6?: readonly string[] }
export interface AwsSgDef { readonly id: string; readonly name: string; readonly vpcId: string | null; readonly ingress: readonly AwsIngressDef[] }
export interface AwsEniDef { readonly id: string; readonly groups: readonly string[]; readonly publicIp: boolean; readonly ipv6?: boolean }
export interface PabDef { readonly blockPublicAcls: boolean; readonly ignorePublicAcls: boolean; readonly blockPublicPolicy: boolean; readonly restrictPublicBuckets: boolean }
export interface AwsBucketDef {
  readonly name: string; readonly region: string; readonly createdAt: string;
  /** null = 버킷 차단 설정 없음(notconfigured) */
  readonly pab: PabDef | null;
  /** null = 버킷 정책 없음(notconfigured) */
  readonly policyPublic: boolean | null;
  readonly aclGrants: readonly { readonly grantee: "AllUsers" | "AuthenticatedUsers"; readonly permission: string }[];
  /** null = 소유권 설정 없음(notconfigured → ACL 사용 중) */
  readonly ownership: string | null;
  readonly website: boolean;
}
export interface AwsTrailDef {
  readonly name: string; readonly homeRegion: string; readonly multiRegion: boolean; readonly orgTrail?: boolean; readonly validation: boolean;
  readonly logging: boolean; readonly deliveryError?: boolean; readonly selectors: readonly { readonly readWriteType: string; readonly includeManagementEvents: boolean }[];
}

export interface AwsCompany {
  readonly setId: "A" | "B" | "C" | "D";
  /** 화면에 별칭 자리로 쓰는 가짜 회사 이름 */
  readonly name: string;
  readonly accountId: string;
  readonly principal: { readonly type: "user" | "assumed-role" | "root" | "federated-user" | "unknown"; readonly name: string | null };
  readonly collectedAt: string;
  /** 자격증명 보고서 생성 시각(수집 직전) */
  readonly reportAt: string;
  /** 현관(mfa)·열쇠(key)는 항상 수집한다(사용자 목록을 함께 쓴다). 나머지 문은 건너뛸 수 있다 */
  readonly skipDoors?: readonly ("net" | "sto" | "log")[];
  readonly regions: readonly string[];
  readonly root: AwsRootDef;
  readonly users: readonly AwsUserDef[];
  readonly groups: readonly { readonly name: string; readonly policies: readonly string[] }[];
  /** null = 파일에서 역할 섹션을 아예 뺀다(필드 부재) */
  readonly roles: readonly AwsRoleDef[] | null;
  readonly sgs: Readonly<Record<string, readonly AwsSgDef[]>>;
  readonly enis: Readonly<Record<string, readonly AwsEniDef[]>>;
  /** null = 계정 차단 설정 없음(notconfigured) */
  readonly accountPab: PabDef | null;
  readonly buckets: readonly AwsBucketDef[];
  readonly trails: readonly AwsTrailDef[];
  readonly faults: readonly Fault[];
}

const BUDGET_LIMIT = 200;
const ARN_ACCOUNT = (a: string): string => `arn:aws:iam::${a}`;
export const trailArn = (c: Pick<AwsCompany, "accountId">, t: Pick<AwsTrailDef, "name" | "homeRegion">): string => `arn:aws:cloudtrail:${t.homeRegion}:${c.accountId}:trail/${t.name}`;

/* ───────── 자격증명 보고서 CSV ───────── */
const HEADER = "user,arn,user_creation_time,password_enabled,password_last_used,password_last_changed,password_next_rotation,mfa_active,access_key_1_active,access_key_1_last_rotated,access_key_1_last_used_date,access_key_1_last_used_region,access_key_1_last_used_service,access_key_2_active,access_key_2_last_rotated,access_key_2_last_used_date,access_key_2_last_used_region,access_key_2_last_used_service,cert_1_active,cert_1_last_rotated,cert_2_active,cert_2_last_rotated,additional_credentials_info";
const na = (s: string | null | undefined): string => (s === null || s === undefined ? "N/A" : awsTime(s));
function keyCells(k: AwsKeyDef | undefined): string[] {
  if (k === undefined) return ["false", "N/A", "N/A", "N/A", "N/A"];
  return [k.status === "Active" ? "true" : "false", awsTime(k.createdAt), na(k.lastUsed), k.lastUsed === null ? "N/A" : k.usedRegion ?? "N/A", k.lastUsed === null ? "N/A" : k.usedService ?? "N/A"];
}
export function buildAwsCsv(c: AwsCompany): string {
  const rows: string[] = [HEADER];
  const r = c.root;
  const rootPw = r.password === "not_supported" ? "not_supported" : r.password;
  rows.push([
    "<root_account>", `${ARN_ACCOUNT(c.accountId)}:root`, awsTime(r.createdAt), rootPw,
    r.password === "false" ? "N/A" : r.passwordLastUsed === null ? "no_information" : awsTime(r.passwordLastUsed),
    r.password === "not_supported" ? "not_supported" : "N/A", r.password === "not_supported" ? "not_supported" : "N/A",
    String(r.mfa), ...keyCells(r.keys[0]), ...keyCells(r.keys[1]), "false", "N/A", "false", "N/A", "N/A",
  ].join(","));
  for (const u of c.users) {
    rows.push([
      u.name, `${ARN_ACCOUNT(c.accountId)}:user/${u.name}`, awsTime(u.createdAt), String(u.console),
      !u.console ? "N/A" : u.passwordLastUsed === null ? "no_information" : awsTime(u.passwordLastUsed),
      u.console ? awsTime(u.createdAt) : "N/A", "N/A", String(u.mfa), ...keyCells(u.keys[0]), ...keyCells(u.keys[1]), "false", "N/A", "false", "N/A", "N/A",
    ].join(","));
  }
  return `${rows.join("\n")}\n`;
}

/* ───────── 수집기 결과 JSON ───────── */
type Data = NonNullable<AwsCollect["data"]>;
const listNatural = (n: number): Natural => (n === 0 ? { result: "empty" } : { result: "ok", count: n });
const evOf = <T>(o: Outcome, value: T): { receipt: string; value: T | null } => ({ receipt: o.id, value: o.noValue ? null : value });
const evList = <T>(o: Outcome, list: readonly T[]): { receipt: string; value: T[] | null } => ({ receipt: o.id, value: applyList(o, list) });

type TrustOut = NonNullable<NonNullable<NonNullable<Data["iamRoles"]>["value"]>[number]["trust"]>[number];
function trustOut(t: AwsTrustDef): TrustOut {
  return {
    effect: t.effect ?? "Allow", actions: [...(t.actions ?? ["sts:AssumeRole"])], notPrincipal: t.notPrincipal ?? false,
    principal: { wildcard: t.wildcard ?? false, aws: [...(t.aws ?? [])], service: [...(t.service ?? [])], federated: [...(t.federated ?? [])], canonicalUserCount: 0 },
    conditionKeys: [...(t.conditionKeys ?? [])],
  };
}

export function buildAwsCollect(c: AwsCompany): AwsCollect {
  const rec = new Recorder(c.collectedAt, c.faults);
  const skipped = new Set(c.skipDoors ?? []);
  const state = (d: "net" | "sto" | "log"): AwsDoorState => (skipped.has(d) ? "skipped" : "collected");

  // 신원 · 범위
  const idRc = rec.call("sts:GetCallerIdentity", { region: "global" }, { result: "ok" });
  const aliasRc = rec.call("iam:ListAccountAliases", { region: "global" }, { result: "ok" });
  const regionsRc = rec.call("ec2:DescribeRegions", { region: "global" }, listNatural(c.regions.length));

  const data: Data = {};

  // 보고서 · 요약 · 사용자 (현관 + 열쇠)
  const gen = rec.call("iam:GenerateCredentialReport", { region: "global" }, { result: "ok" });
  const get = rec.call("iam:GetCredentialReport", { region: "global" }, { result: "ok" });
  data.credentialReport = {
    generateReceipt: gen.id, receipt: get.id,
    value: get.noValue ? null : { generatedTime: awsTime(c.reportAt), format: "text/csv", csv: buildAwsCsv(c) },
  };
  const sum = rec.call("iam:GetAccountSummary", { region: "global" }, { result: "ok" });
  const rootActiveKeys = c.root.keys.filter((k) => k.status === "Active").length;
  data.accountSummary = evOf(sum, {
    Users: c.users.length, Groups: c.groups.length, Roles: c.roles?.length ?? 0, AccountMFAEnabled: c.root.mfa ? 1 : 0,
    AccountAccessKeysPresent: rootActiveKeys, AccountSigningCertificatesPresent: 0, MFADevicesInUse: c.users.filter((u) => u.mfa).length + (c.root.mfa ? 1 : 0),
  });

  const list = rec.call("iam:ListUsers", { region: "global" }, listNatural(c.users.length));
  const shown = applyList(list, c.users);
  data.iamUsers = {
    receipt: list.id, budget: { limit: BUDGET_LIMIT, total: shown === null ? 0 : shown.length, collected: shown === null ? 0 : shown.length },
    items: shown === null ? null : shown.map((u) => {
      const keys = rec.call("iam:ListAccessKeys", { region: "global", resource: u.name }, listNatural(u.keys.length));
      const mfa = rec.call("iam:ListMFADevices", { region: "global", resource: u.name }, listNatural(u.mfa ? 1 : 0));
      const pol = rec.call("iam:ListAttachedUserPolicies", { region: "global", resource: u.name }, listNatural(u.policies.length));
      const grp = rec.call("iam:ListGroupsForUser", { region: "global", resource: u.name }, listNatural(u.groups.length));
      return {
        userName: u.name, createDate: awsTime(u.createdAt), passwordLastUsed: u.passwordLastUsed === null ? null : awsTime(u.passwordLastUsed),
        accessKeys: evList(keys, u.keys.map((k) => ({ status: k.status, createDate: awsTime(k.createdAt), idSuffix: k.suffix }))),
        mfaDevices: evOf(mfa, { count: u.mfa ? 1 : 0 }),
        attachedPolicyArns: evList(pol, u.policies.map((p) => (p.startsWith("arn:") ? p : `arn:aws:iam::aws:policy/${p}`))),
        groupNames: evList(grp, u.groups),
      };
    }),
  };
  data.iamGroups = c.groups.map((g) => {
    const rc = rec.call("iam:ListAttachedGroupPolicies", { region: "global", resource: g.name }, listNatural(g.policies.length));
    return { groupName: g.name, attachedPolicyArns: evList(rc, g.policies.map((p) => (p.startsWith("arn:") ? p : `arn:aws:iam::aws:policy/${p}`))) };
  });
  if (c.roles !== null) {
    const rc = rec.call("iam:ListRoles", { region: "global" }, listNatural(c.roles.length));
    data.iamRoles = evList(rc, c.roles.map((r) => ({ roleName: r.name, path: r.path ?? "/", createDate: awsTime(r.createdAt), trust: r.trust === null ? null : r.trust.map(trustOut) })));
  }

  // 창문
  if (state("net") === "collected") {
    data.securityGroups = c.regions.map((region) => {
      const sgs = c.sgs[region] ?? [];
      const rc = rec.call("ec2:DescribeSecurityGroups", { region }, listNatural(sgs.length));
      return { region, receipt: rc.id, items: applyList(rc, sgs)?.map((s) => ({
        groupId: s.id, groupName: s.name, vpcId: s.vpcId,
        ingress: s.ingress.map((i) => ({ protocol: i.protocol, fromPort: i.from, toPort: i.to, cidrs: [...(i.cidrs ?? ["0.0.0.0/0"])], ipv6Cidrs: [...(i.ipv6 ?? [])], prefixListIds: [], sgRefCount: 0 })),
      })) ?? null };
    });
    data.networkInterfaces = c.regions.map((region) => {
      const enis = c.enis[region] ?? [];
      const rc = rec.call("ec2:DescribeNetworkInterfaces", { region }, listNatural(enis.length));
      return { region, receipt: rc.id, items: applyList(rc, enis)?.map((e) => ({
        eniId: e.id, groupIds: [...e.groups], hasPublicIp: e.publicIp, hasIpv6: e.ipv6 ?? false, interfaceType: "interface", status: "in-use", requesterManaged: false,
      })) ?? null };
    });
  }

  // 창고
  if (state("sto") === "collected") {
    const acct = rec.call("s3:GetAccountPublicAccessBlock", { region: "global" }, c.accountPab === null ? { result: "notconfigured", errorCode: "NoSuchPublicAccessBlockConfiguration" } : { result: "ok" });
    data.accountPublicAccessBlock = evOf(acct, c.accountPab === null ? null : { ...c.accountPab });
    const lb = rec.call("s3:ListAllMyBuckets", { region: "global" }, listNatural(c.buckets.length));
    const shownB = applyList(lb, c.buckets);
    data.buckets = {
      receipt: lb.id, budget: { limit: BUDGET_LIMIT, total: shownB === null ? 0 : shownB.length, collected: shownB === null ? 0 : shownB.length },
      items: shownB === null ? null : shownB.map((b) => {
        const o = { region: b.region, resource: b.name };
        const pab = rec.call("s3:GetBucketPublicAccessBlock", o, b.pab === null ? { result: "notconfigured", errorCode: "NoSuchPublicAccessBlockConfiguration" } : { result: "ok" });
        const pol = rec.call("s3:GetBucketPolicyStatus", o, b.policyPublic === null ? { result: "notconfigured", errorCode: "NoSuchBucketPolicy" } : { result: "ok" });
        const acl = rec.call("s3:GetBucketAcl", o, { result: "ok" });
        const own = rec.call("s3:GetBucketOwnershipControls", o, b.ownership === null ? { result: "notconfigured", errorCode: "OwnershipControlsNotFoundError" } : { result: "ok" });
        const web = rec.call("s3:GetBucketWebsite", o, b.website ? { result: "ok" } : { result: "notconfigured", errorCode: "NoSuchWebsiteConfiguration" });
        return {
          name: b.name, createDate: awsTime(b.createdAt), region: { value: b.region, source: "list" as const, receipt: null },
          publicAccessBlock: evOf(pab, b.pab === null ? null : { ...b.pab }),
          policyStatus: evOf(pol, b.policyPublic === null ? null : { isPublic: b.policyPublic }),
          acl: evOf(acl, { publicGrants: b.aclGrants.map((g) => ({ grantee: g.grantee, permission: g.permission })) }),
          ownership: evOf(own, b.ownership === null ? null : { objectOwnership: b.ownership }),
          website: evOf(web, b.website ? { enabled: true as const } : null),
        };
      }),
    };
  }

  // CCTV
  if (state("log") === "collected") {
    const dt = rec.call("cloudtrail:DescribeTrails", { region: "global" }, listNatural(c.trails.length));
    const shownT = applyList(dt, c.trails);
    data.trails = {
      receipt: dt.id,
      value: shownT === null ? null : shownT.map((t) => {
        const arn = trailArn(c, t);
        const st = rec.call("cloudtrail:GetTrailStatus", { region: t.homeRegion, resource: arn }, { result: "ok" });
        const sel = rec.call("cloudtrail:GetEventSelectors", { region: t.homeRegion, resource: arn }, { result: "ok" });
        return {
          name: t.name, trailArn: arn, homeRegion: t.homeRegion, isMultiRegion: t.multiRegion, isOrganizationTrail: t.orgTrail ?? false, logFileValidationEnabled: t.validation,
          hasCloudWatchLogs: false, hasCustomEventSelectors: false,
          status: evOf(st, { isLogging: t.logging, hasDeliveryError: t.deliveryError ?? false }),
          selectors: evOf(sel, { basic: t.selectors.map((x) => ({ readWriteType: x.readWriteType, includeManagementEvents: x.includeManagementEvents })), advanced: [] }),
        };
      }),
    };
  }

  const alias = evOf(aliasRc, c.name);
  return {
    schema: "cloudcheck.collect/1.0",
    collector: { name: "cloudcheck-aws", version: "1.0.0", sha256: null, tools: { cli: "aws-cli/2.17.30", jq: "jq-1.7.1", bash: "5.2.21" } },
    collectedAt: c.collectedAt,
    run: { finishedAt: rec.finishedAt(), confirmed: "interactive", doors: { mfa: "collected", key: "collected", net: state("net"), sto: state("sto"), log: state("log") } },
    cloud: "aws",
    identity: { receipt: idRc.id, accountId: c.accountId, partition: "aws", principalType: c.principal.type, principalName: c.principal.name, alias },
    scope: { regions: evList(regionsRc, c.regions), regionsRequested: null },
    receipts: rec.receipts as AwsCollect["receipts"],
    data,
  };
}

/** 파일에 저장하는 바이트: 한 줄 JSON + 줄바꿈 (실제 수집기 출력과 같은 모양) */
export const awsJson = (c: AwsCompany): string => `${JSON.stringify(buildAwsCollect(c))}\n`;
