// src/app/cloudcheck/_client/mocks/catalog.ts — 목업 RULE_CATALOG(18장, 모델 v1 RuleCatalogEntry). 소유: 프론트팀장.
// 진짜 카탈로그는 DB설계자의 rules/catalog.ts(RULE_CATALOG)다. 이 목업은 화면(V3 행·V4 고치는 법·V7 판정 규칙) 개발용이다.
//  - 키 이름은 UX §9 규칙(cc.rule.<id 소문자>.<필드>, cc.ph.<이름>)을 따르지만, 진짜 키·문구는 DB설계자 E 카탈로그가 정한다(D4에 대조).
//  - priority·최고 상태·이상 없음 가능 여부·수집 경로는 방향서 §6-1 표 그대로. 권한·기준값·명령·링크는 예시다(사실 확인 안 함 — 화면에 쓰지 말 것).
//  - 쓰기 명령에는 자리표시자를 1개 이상 둔다(registry 규칙과 같은 조건 — mocks.test.ts가 검사).
import type {
  BasisRef,
  CatalogKey,
  CliSegment,
  CliTemplate,
  ExternalLink,
  FixGuide,
  GuideCard,
  IncidentRef,
  LinkHost,
  MaxStatus,
  RuleCatalogEntry,
  RuleId,
  RuleKind,
  RuleParamView,
  Status,
} from "../../../../lib/cloudcheck/model/report";
import { day, RULE_META } from "./build";

const key = (id: RuleId, rest: string): CatalogKey => `cc.rule.${id.toLowerCase()}.${rest}`;
const link = (host: LinkHost, p: string): ExternalLink => ({ href: `https://${host}${p}`, host });
const txt = (v: string): CliSegment => ({ t: "text", v });
const ph = (name: string): CliSegment => ({ t: "ph", key: `cc.ph.${name}` });
const read = (shell: "aws" | "az", ...segments: CliSegment[]): CliTemplate<"read"> => ({ kind: "read", shell, segments });
const write = (shell: "aws" | "az", ...segments: CliSegment[]): CliTemplate<"write"> => ({ kind: "write", shell, segments });
const basis = (id: RuleId, n: number, l: ExternalLink, kind: BasisRef["kind"] = "doc"): BasisRef => ({ titleKey: key(id, `basis.${n}`), link: l, kind });
const param = (id: RuleId, name: string, value: RuleParamView["value"], b: RuleParamView["basis"]): RuleParamView => ({ key: key(id, `param.${name}`), value, basis: b });

function fix(id: RuleId, o: {
  impact: FixGuide["impact"];
  prodImpact: boolean;
  observeDoc?: ExternalLink | null;
  observe: CliTemplate<"read">[];
  property: string;
  changeDoc: ExternalLink;
  change: CliTemplate<"write">[];
  revert: CliTemplate<"write">[];
  runbook?: ExternalLink | null;
}): FixGuide {
  return {
    impact: o.impact,
    prodImpact: o.prodImpact,
    observe: { textKey: key(id, "fix.observe"), doc: o.observeDoc ?? null, commands: o.observe },
    change: { textKey: key(id, "fix.change"), property: o.property, doc: o.changeDoc, commands: o.change },
    revert: { textKey: key(id, "fix.revert"), commands: o.revert },
    runbook: o.runbook ?? null,
  };
}

interface EntrySpec {
  readonly kind?: RuleKind;
  readonly released?: boolean;
  readonly maxStatus: MaxStatus;
  readonly allowsClear: boolean;
  readonly statuses: readonly Status[];
  readonly impact?: boolean;
  readonly question?: boolean;
  readonly paths: RuleCatalogEntry["paths"];
  readonly permissions: readonly string[];
  readonly params?: readonly RuleParamView[];
  readonly cannotSee?: number;
  readonly falsePositive?: number;
  readonly fix?: FixGuide | null;
  readonly guide?: GuideCard | null;
  readonly basis: readonly BasisRef[];
  readonly incident?: IncidentRef | null;
}
function entry(id: RuleId, s: EntrySpec): RuleCatalogEntry {
  const meta = RULE_META[id];
  const conditionKeys: Partial<Record<Status, CatalogKey>> = {};
  for (const st of s.statuses) conditionKeys[st] = key(id, `cond.${st}`);
  return {
    ruleId: id,
    cloud: meta.cloud,
    door: meta.door,
    kind: s.kind ?? "auto",
    released: s.released ?? true,
    titleKey: key(id, "title"),
    summaryKey: key(id, "summary"),
    maxStatus: s.maxStatus,
    allowsClear: s.allowsClear,
    priority: meta.priority,
    conditionKeys,
    impactKey: s.impact === false ? null : key(id, "impact"),
    questionKey: s.question === true ? key(id, "question") : null,
    paths: s.paths,
    permissions: s.permissions,
    params: s.params ?? [],
    cannotSee: Array.from({ length: s.cannotSee ?? 3 }, (_, i) => key(id, `cannot.${i + 1}`)),
    falsePositiveKeys: Array.from({ length: s.falsePositive ?? 1 }, (_, i) => key(id, `fp.${i + 1}`)),
    fix: s.fix ?? null,
    guide: s.guide ?? null,
    basis: s.basis,
    incident: s.incident ?? null,
    lastVerified: day("2026-10-19"),
  };
}

const AWS_DOC = "docs.aws.amazon.com" as const;
const MS_DOC = "learn.microsoft.com" as const;
const S3_BPA = link(AWS_DOC, "/AmazonS3/latest/userguide/access-control-block-public-access.html");
const SH_EC2 = link(AWS_DOC, "/securityhub/latest/userguide/ec2-controls.html");
const SH_IAM = link(AWS_DOC, "/securityhub/latest/userguide/iam-controls.html");
const IAM_ROOT = link(AWS_DOC, "/IAM/latest/UserGuide/id_root-user.html");
const IAM_MFA = link(AWS_DOC, "/IAM/latest/UserGuide/id_credentials_mfa_enable_virtual.html");
const IAM_KEYS = link(AWS_DOC, "/IAM/latest/UserGuide/id_credentials_access-keys.html");
const IAM_ROLES = link(AWS_DOC, "/IAM/latest/UserGuide/id_roles.html");
const CT_TRAIL = link(AWS_DOC, "/awscloudtrail/latest/userguide/cloudtrail-create-and-update-a-trail.html");
const AZ_ANON = link(MS_DOC, "/azure/storage/blobs/anonymous-read-access-prevent");
const AZ_NSG = link(MS_DOC, "/azure/virtual-network/network-security-groups-overview");
const AZ_KEYS = link(MS_DOC, "/azure/storage/common/storage-account-keys-manage");
const AZ_ACT = link(MS_DOC, "/azure/azure-monitor/essentials/activity-log");
const AZ_BLOBMON = link(MS_DOC, "/azure/storage/blobs/monitor-blob-storage");
const AZ_MFA = link(MS_DOC, "/entra/identity/authentication/concept-mfa-howitworks");

const DANGER_PORTS_EC2_19 = [20, 21, 22, 23, 135, 445, 1433, 1434, 3000, 3306, 3389, 4333, 5000, 5432, 5500, 5601, 8080, 8088, 8888, 9200, 9300];
const DANGER_PORTS_TOOL = [1521, 6379, 27017, 2375, 2376, 2379, 2380, 10250, 11211, 5900, 5985, 5986];
const MAIL_PORTS = [25, 110, 143];

/** 목업 룰 카탈로그 18장(priority 순) */
export const MOCK_CATALOG: readonly RuleCatalogEntry[] = [
  entry("AWS-STO-2", {
    maxStatus: "risk", allowsClear: true, statuses: ["risk", "caution", "clear", "unknown", "na"], question: true,
    paths: ["collector"], permissions: ["s3:GetBucketPolicyStatus", "s3:GetBucketAcl", "s3:GetBucketPublicAccessBlock", "s3:GetBucketWebsite"],
    fix: fix("AWS-STO-2", {
      impact: "high", prodImpact: true,
      observe: [read("aws", txt("aws s3api get-bucket-policy-status --bucket "), ph("bucket-name"))],
      property: "PublicAccessBlockConfiguration", changeDoc: S3_BPA,
      change: [write("aws", txt("aws s3api put-public-access-block --bucket "), ph("bucket-name"), txt(" --public-access-block-configuration BlockPublicAcls=true,IgnorePublicAcls=true,BlockPublicPolicy=true,RestrictPublicBuckets=true"))],
      revert: [write("aws", txt("aws s3api delete-public-access-block --bucket "), ph("bucket-name"))],
    }),
    basis: [basis("AWS-STO-2", 1, S3_BPA)],
    // 실제 RULE_CATALOG 18장은 incident가 모두 null이고 cc.incident.* 키가 없다(DB설계자, D4 대조) → 목업도 null.
    // '그 문의 실제 사례' 줄 렌더는 DoorSection.test.tsx가 실제로 있는 키로 incident를 넣은 카탈로그를 따로 만들어 시험한다.
  }),
  entry("AZ-STO-2", {
    maxStatus: "risk", allowsClear: true, statuses: ["risk", "caution", "clear", "unknown", "na"], question: true,
    paths: ["collector"], permissions: ["Microsoft.Storage/storageAccounts/blobServices/containers/read"],
    fix: fix("AZ-STO-2", {
      impact: "high", prodImpact: true,
      observe: [read("az", txt("az storage container-rm show --storage-account "), ph("storage-account"), txt(" --name "), ph("container-name"))],
      property: "publicAccess", changeDoc: AZ_ANON,
      change: [write("az", txt("az storage container-rm update --storage-account "), ph("storage-account"), txt(" --name "), ph("container-name"), txt(" --public-access off"))],
      revert: [write("az", txt("az storage container-rm update --storage-account "), ph("storage-account"), txt(" --name "), ph("container-name"), txt(" --public-access "), ph("previous-value"))],
    }),
    basis: [basis("AZ-STO-2", 1, AZ_ANON)],
  }),
  entry("AWS-NET-1", {
    maxStatus: "risk", allowsClear: true, statuses: ["risk", "caution", "clear", "unknown"], question: true,
    paths: ["collector"], permissions: ["ec2:DescribeSecurityGroups", "ec2:DescribeNetworkInterfaces"],
    params: [param("AWS-NET-1", "ports-ec2-19", DANGER_PORTS_EC2_19, "public-standard"), param("AWS-NET-1", "ports-tool", DANGER_PORTS_TOOL, "tool-default"), param("AWS-NET-1", "mail-ports", MAIL_PORTS, "public-standard")],
    cannotSee: 5,
    fix: fix("AWS-NET-1", {
      impact: "medium", prodImpact: true,
      observe: [read("aws", txt("aws ec2 describe-network-interfaces --filters Name=group-id,Values="), ph("sg-id"))],
      property: "IpPermissions", changeDoc: SH_EC2,
      change: [
        write("aws", txt("aws ec2 authorize-security-group-ingress --group-id "), ph("sg-id"), txt(" --protocol tcp --port "), ph("port"), txt(" --cidr "), ph("allowed-cidr")),
        write("aws", txt("aws ec2 revoke-security-group-ingress --group-id "), ph("sg-id"), txt(" --protocol tcp --port "), ph("port"), txt(" --cidr 0.0.0.0/0")),
      ],
      revert: [write("aws", txt("aws ec2 authorize-security-group-ingress --group-id "), ph("sg-id"), txt(" --protocol tcp --port "), ph("port"), txt(" --cidr "), ph("removed-cidr"))],
    }),
    basis: [basis("AWS-NET-1", 1, SH_EC2, "benchmark")],
  }),
  entry("AZ-NET-1", {
    maxStatus: "risk", allowsClear: true, statuses: ["risk", "caution", "clear", "unknown"], question: true,
    paths: ["portal-csv", "collector"], permissions: ["Microsoft.Network/networkSecurityGroups/read", "Microsoft.Network/networkInterfaces/read", "Microsoft.Network/publicIPAddresses/read"],
    params: [param("AZ-NET-1", "ports-ec2-19", DANGER_PORTS_EC2_19, "public-standard"), param("AZ-NET-1", "ports-tool", DANGER_PORTS_TOOL, "tool-default")],
    fix: fix("AZ-NET-1", {
      impact: "medium", prodImpact: true,
      observe: [read("az", txt("az network nsg rule show -g "), ph("resource-group"), txt(" --nsg-name "), ph("nsg-name"), txt(" -n "), ph("rule-name"))],
      property: "securityRules", changeDoc: AZ_NSG,
      change: [write("az", txt("az network nsg rule delete -g "), ph("resource-group"), txt(" --nsg-name "), ph("nsg-name"), txt(" -n "), ph("rule-name"))],
      revert: [write("az", txt("az network nsg rule create -g "), ph("resource-group"), txt(" --nsg-name "), ph("nsg-name"), txt(" -n "), ph("rule-name"), txt(" --priority "), ph("priority"), txt(" --source-address-prefixes "), ph("removed-cidr"), txt(" --destination-port-ranges "), ph("port"))],
    }),
    basis: [basis("AZ-NET-1", 1, AZ_NSG)],
  }),
  entry("AWS-KEY-4", {
    maxStatus: "risk", allowsClear: true, statuses: ["risk", "caution", "clear", "unknown", "na"], question: true,
    paths: ["collector"], permissions: ["iam:ListRoles"],
    fix: fix("AWS-KEY-4", {
      impact: "medium", prodImpact: true,
      observe: [read("aws", txt("aws iam get-role --role-name "), ph("role-name"))],
      property: "AssumeRolePolicyDocument", changeDoc: IAM_ROLES,
      change: [write("aws", txt("aws iam update-assume-role-policy --role-name "), ph("role-name"), txt(" --policy-document file://"), ph("trust-policy-file"))],
      revert: [write("aws", txt("aws iam update-assume-role-policy --role-name "), ph("role-name"), txt(" --policy-document file://"), ph("previous-trust-policy-file"))],
    }),
    basis: [basis("AWS-KEY-4", 1, IAM_ROLES)],
  }),
  entry("AWS-MFA-1", {
    maxStatus: "risk", allowsClear: true, statuses: ["risk", "caution", "clear", "unknown", "na"],
    paths: ["csv", "collector"], permissions: ["iam:GenerateCredentialReport", "iam:GetCredentialReport", "iam:GetAccountSummary"],
    params: [param("AWS-MFA-1", "root-login-days", 90, "tool-default"), param("AWS-MFA-1", "report-freshness-minutes", 245, "public-standard")],
    fix: fix("AWS-MFA-1", {
      impact: "low", prodImpact: false,
      observe: [read("aws", txt("aws iam get-account-summary"))],
      property: "AccountAccessKeysPresent", changeDoc: IAM_ROOT,
      change: [],
      revert: [],
    }),
    basis: [basis("AWS-MFA-1", 1, IAM_ROOT)],
  }),
  entry("AWS-MFA-2", {
    maxStatus: "risk", allowsClear: true, statuses: ["risk", "clear", "unknown", "na"],
    paths: ["csv", "collector"], permissions: ["iam:GetCredentialReport", "iam:ListUsers", "iam:ListMFADevices"],
    falsePositive: 2,
    fix: fix("AWS-MFA-2", {
      impact: "low", prodImpact: false,
      observe: [read("aws", txt("aws iam list-mfa-devices --user-name "), ph("user-name"))],
      property: "MFADevice", changeDoc: IAM_MFA,
      change: [write("aws", txt("aws iam delete-login-profile --user-name "), ph("user-name"))],
      revert: [write("aws", txt("aws iam deactivate-mfa-device --user-name "), ph("user-name"), txt(" --serial-number "), ph("mfa-serial"))],
    }),
    basis: [basis("AWS-MFA-2", 1, IAM_MFA)],
  }),
  entry("AZ-MFA-1", {
    kind: "conditional", released: false, maxStatus: "risk", allowsClear: false, statuses: ["risk", "caution", "unknown"],
    paths: ["portal-csv"], permissions: [],
    basis: [basis("AZ-MFA-1", 1, AZ_MFA)],
  }),
  entry("AZ-MFA-G", {
    kind: "guide", maxStatus: "unknown", allowsClear: false, statuses: ["unknown"], impact: false,
    paths: ["guide"], permissions: [],
    guide: {
      steps: [
        { id: "portal-1", textKey: key("AZ-MFA-G", "guide.1"), doc: AZ_MFA },
        { id: "portal-2", textKey: key("AZ-MFA-G", "guide.2"), doc: null },
        { id: "portal-3", textKey: key("AZ-MFA-G", "guide.3"), doc: null },
      ],
    },
    basis: [basis("AZ-MFA-G", 1, AZ_MFA)],
  }),
  entry("AWS-KEY-3", {
    maxStatus: "caution", allowsClear: false, statuses: ["caution", "unknown", "na"], question: true,
    paths: ["collector"], permissions: ["iam:ListAttachedUserPolicies", "iam:ListGroupsForUser", "iam:ListAttachedGroupPolicies", "iam:ListAccessKeys"],
    params: [param("AWS-KEY-3", "admin-policies", ["AdministratorAccess", "PowerUserAccess", "IAMFullAccess", "AWSOrganizationsFullAccess"], "tool-default")],
    fix: fix("AWS-KEY-3", {
      impact: "medium", prodImpact: true,
      observe: [read("aws", txt("aws iam list-attached-user-policies --user-name "), ph("user-name"))],
      property: "AccessKey.Status", changeDoc: IAM_KEYS,
      change: [write("aws", txt("aws iam update-access-key --user-name "), ph("user-name"), txt(" --access-key-id "), ph("access-key-id"), txt(" --status Inactive"))],
      revert: [write("aws", txt("aws iam update-access-key --user-name "), ph("user-name"), txt(" --access-key-id "), ph("access-key-id"), txt(" --status Active"))],
    }),
    basis: [basis("AWS-KEY-3", 1, IAM_KEYS)],
  }),
  entry("AWS-KEY-1", {
    maxStatus: "caution", allowsClear: true, statuses: ["caution", "clear", "unknown", "na"], question: true,
    paths: ["csv", "collector"], permissions: ["iam:ListAccessKeys", "iam:GetCredentialReport"],
    params: [param("AWS-KEY-1", "max-age-days", 90, "public-standard")],
    fix: fix("AWS-KEY-1", {
      impact: "medium", prodImpact: true,
      observe: [read("aws", txt("aws iam list-access-keys --user-name "), ph("user-name"))],
      property: "AccessKey", changeDoc: IAM_KEYS,
      change: [
        write("aws", txt("aws iam create-access-key --user-name "), ph("user-name")),
        write("aws", txt("aws iam update-access-key --user-name "), ph("user-name"), txt(" --access-key-id "), ph("old-access-key-id"), txt(" --status Inactive")),
      ],
      revert: [write("aws", txt("aws iam update-access-key --user-name "), ph("user-name"), txt(" --access-key-id "), ph("old-access-key-id"), txt(" --status Active"))],
    }),
    basis: [basis("AWS-KEY-1", 1, SH_IAM, "benchmark")],
  }),
  entry("AWS-KEY-2", {
    maxStatus: "caution", allowsClear: true, statuses: ["caution", "clear", "unknown", "na"], question: true,
    paths: ["csv", "collector"], permissions: ["iam:GetCredentialReport", "iam:ListUsers", "iam:ListAccessKeys"],
    params: [param("AWS-KEY-2", "unused-days", 45, "public-standard"), param("AWS-KEY-2", "grace-days", 7, "tool-default")],
    fix: fix("AWS-KEY-2", {
      impact: "low", prodImpact: false,
      observe: [read("aws", txt("aws iam list-access-keys --user-name "), ph("user-name"))],
      property: "AccessKey.Status", changeDoc: SH_IAM,
      change: [write("aws", txt("aws iam update-access-key --user-name "), ph("user-name"), txt(" --access-key-id "), ph("access-key-id"), txt(" --status Inactive"))],
      revert: [write("aws", txt("aws iam update-access-key --user-name "), ph("user-name"), txt(" --access-key-id "), ph("access-key-id"), txt(" --status Active"))],
    }),
    basis: [basis("AWS-KEY-2", 1, SH_IAM, "benchmark")],
  }),
  entry("AZ-KEY-1", {
    maxStatus: "caution", allowsClear: true, statuses: ["caution", "clear", "unknown"], question: true,
    paths: ["portal-csv", "collector"], permissions: ["Microsoft.Storage/storageAccounts/read"],
    params: [param("AZ-KEY-1", "max-age-days", 90, "tool-default")],
    fix: fix("AZ-KEY-1", {
      impact: "high", prodImpact: true,
      observe: [read("az", txt("az storage account show --name "), ph("storage-account"), txt(" --query keyCreationTime"))],
      property: "allowSharedKeyAccess", changeDoc: AZ_KEYS,
      change: [write("az", txt("az storage account update --name "), ph("storage-account"), txt(" --allow-shared-key-access false"))],
      revert: [write("az", txt("az storage account update --name "), ph("storage-account"), txt(" --allow-shared-key-access "), ph("previous-value"))],
    }),
    basis: [basis("AZ-KEY-1", 1, AZ_KEYS)],
  }),
  entry("AWS-STO-1", {
    maxStatus: "caution", allowsClear: true, statuses: ["caution", "clear", "unknown"], question: true,
    paths: ["collector"], permissions: ["s3:GetAccountPublicAccessBlock"],
    fix: fix("AWS-STO-1", {
      impact: "high", prodImpact: true,
      observe: [read("aws", txt("aws s3control get-public-access-block --account-id "), ph("account-id"))],
      property: "PublicAccessBlockConfiguration", changeDoc: S3_BPA,
      change: [write("aws", txt("aws s3control put-public-access-block --account-id "), ph("account-id"), txt(" --public-access-block-configuration BlockPublicAcls=true,IgnorePublicAcls=true,BlockPublicPolicy=true,RestrictPublicBuckets=true"))],
      revert: [write("aws", txt("aws s3control delete-public-access-block --account-id "), ph("account-id"))],
    }),
    basis: [basis("AWS-STO-1", 1, S3_BPA)],
  }),
  entry("AZ-STO-1", {
    maxStatus: "caution", allowsClear: true, statuses: ["caution", "clear", "unknown"], question: true,
    paths: ["portal-csv", "collector"], permissions: ["Microsoft.Storage/storageAccounts/read"],
    fix: fix("AZ-STO-1", {
      impact: "high", prodImpact: true,
      observe: [read("az", txt("az storage account show --name "), ph("storage-account"), txt(" --query allowBlobPublicAccess"))],
      property: "allowBlobPublicAccess", changeDoc: AZ_ANON,
      change: [write("az", txt("az storage account update --name "), ph("storage-account"), txt(" --allow-blob-public-access false"))],
      revert: [write("az", txt("az storage account update --name "), ph("storage-account"), txt(" --allow-blob-public-access "), ph("previous-value"))],
    }),
    basis: [basis("AZ-STO-1", 1, AZ_ANON)],
  }),
  entry("AWS-LOG-1", {
    maxStatus: "caution", allowsClear: true, statuses: ["caution", "clear", "unknown"], question: true,
    paths: ["collector"], permissions: ["cloudtrail:DescribeTrails", "cloudtrail:GetTrailStatus", "cloudtrail:GetEventSelectors"],
    fix: fix("AWS-LOG-1", {
      impact: "low", prodImpact: false,
      observe: [read("aws", txt("aws cloudtrail describe-trails"))],
      property: "IsMultiRegionTrail", changeDoc: CT_TRAIL,
      change: [
        write("aws", txt("aws cloudtrail create-trail --name "), ph("trail-name"), txt(" --s3-bucket-name "), ph("bucket-name"), txt(" --is-multi-region-trail")),
        write("aws", txt("aws cloudtrail start-logging --name "), ph("trail-name")),
      ],
      revert: [write("aws", txt("aws cloudtrail stop-logging --name "), ph("trail-name"))],
    }),
    basis: [basis("AWS-LOG-1", 1, CT_TRAIL)],
  }),
  entry("AZ-LOG-1", {
    maxStatus: "caution", allowsClear: true, statuses: ["caution", "clear", "unknown"], question: true,
    paths: ["collector"], permissions: ["Microsoft.Insights/diagnosticSettings/read"],
    fix: fix("AZ-LOG-1", {
      impact: "low", prodImpact: false,
      observe: [read("az", txt("az monitor diagnostic-settings subscription list"))],
      property: "diagnosticSettings", changeDoc: AZ_ACT,
      change: [write("az", txt("az monitor diagnostic-settings subscription create --name "), ph("setting-name"), txt(" --location "), ph("location"), txt(" --workspace "), ph("workspace-id"), txt(" --logs "), ph("log-categories"))],
      revert: [write("az", txt("az monitor diagnostic-settings subscription delete --name "), ph("setting-name"))],
    }),
    basis: [basis("AZ-LOG-1", 1, AZ_ACT)],
  }),
  entry("AZ-LOG-2", {
    maxStatus: "caution", allowsClear: true, statuses: ["caution", "clear", "unknown", "na"], question: true,
    paths: ["collector"], permissions: ["Microsoft.Insights/diagnosticSettings/read"],
    fix: fix("AZ-LOG-2", {
      impact: "low", prodImpact: false,
      observe: [read("az", txt("az monitor diagnostic-settings list --resource "), ph("blob-service-id"))],
      property: "diagnosticSettings", changeDoc: AZ_BLOBMON,
      change: [write("az", txt("az monitor diagnostic-settings create --name "), ph("setting-name"), txt(" --resource "), ph("blob-service-id"), txt(" --workspace "), ph("workspace-id"), txt(" --logs "), ph("log-categories"))],
      revert: [write("az", txt("az monitor diagnostic-settings delete --name "), ph("setting-name"), txt(" --resource "), ph("blob-service-id"))],
    }),
    basis: [basis("AZ-LOG-2", 1, AZ_BLOBMON)],
  }),
];

/** ruleId → 항목(화면 조인용) */
export const MOCK_CATALOG_BY_ID: ReadonlyMap<RuleId, RuleCatalogEntry> = new Map(MOCK_CATALOG.map((e) => [e.ruleId, e]));
