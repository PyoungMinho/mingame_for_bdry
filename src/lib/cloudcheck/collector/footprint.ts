// src/lib/cloudcheck/collector/footprint.ts — 예상 발자국 표 생성 (기획서 §7-5, 백엔드팀장 검토 §2-7)
// 호출 카탈로그(contract/calls.ts) 하나에서 표를 만든다: 명령 · 필요한 권한 · CloudTrail 이벤트 이름 · 문 · 호출 단위 · 쓰기 여부.
// footprint.test.ts가 이 표와 수집기 실제 호출(shim 실행 기록)이 어긋나지 않는지 문 단위로 대조한다.
//  - CloudTrail 이벤트 이름의 일부 예외 매핑(S3 목록 등)은 [일반 지식]이다 → PM V1(CloudTrail 이벤트 기록의 읽기 전용 필터를 푼 대조)에서 확인한다.
//  - Azure 활동 로그는 보통 읽기 작업을 기록하지 않아 대조할 수 없다 [확인: 기획서 R2 비평] → cloudTrailEvent는 null이다.
//  - "쓰기 0건"은 약속하지 않는다(GenerateCredentialReport가 CloudTrail에서 읽기로 기록되는지 [미확인]). 약속은 '예상 목록과 일치하는지 직접 확인할 수 있다'까지다.
import { AWS_CALLS, AZURE_CALLS } from "../contract/calls";
import type { CallPhase, CallUnit } from "../contract/calls";
import type { DoorId } from "../model/report";

export type FootprintCloud = "aws" | "azure";
export interface FootprintRow {
  readonly id: string;                     // 영수증 call 값(카탈로그 키)
  readonly cli: string;
  readonly permission: string | null;
  readonly phases: readonly CallPhase[];
  readonly unit: CallUnit;
  readonly readOnly: boolean;
  /** AWS: CloudTrail eventSource / eventName. Azure: null */
  readonly eventSource: string | null;
  readonly eventName: string | null;
}

const EVENT_SOURCE: Readonly<Record<string, string>> = {
  sts: "sts.amazonaws.com", iam: "iam.amazonaws.com", ec2: "ec2.amazonaws.com", s3: "s3.amazonaws.com", cloudtrail: "cloudtrail.amazonaws.com",
};
/** IAM 액션 이름과 CloudTrail 이벤트 이름이 다른 호출 [일반 지식, PM V1에서 대조] */
const EVENT_NAME_EXCEPTIONS: Readonly<Record<string, string>> = {
  "s3:ListAllMyBuckets": "ListBuckets",
};

export function footprintRows(cloud: FootprintCloud): FootprintRow[] {
  const catalog = (cloud === "aws" ? AWS_CALLS : AZURE_CALLS) as Readonly<Record<string, { cli: string; permission: string | null; phases: readonly CallPhase[]; unit: CallUnit; readOnly: boolean }>>;
  return Object.entries(catalog).map(([id, m]) => {
    const [svc, action] = id.split(":");
    return {
      id, cli: m.cli, permission: m.permission, phases: m.phases, unit: m.unit, readOnly: m.readOnly,
      eventSource: cloud === "aws" ? (EVENT_SOURCE[svc] ?? null) : null,
      eventName: cloud === "aws" ? (EVENT_NAME_EXCEPTIONS[id] ?? action ?? null) : null,
    };
  });
}

/** 문 하나를 요청했을 때 나가는 호출 종류(신원·범위는 항상 포함). 수집기의 실제 동작과 같아야 한다 — footprint.test.ts가 shim 실행 기록과 대조한다 */
export function callsForDoors(cloud: FootprintCloud, doors: readonly DoorId[]): string[] {
  return footprintRows(cloud)
    .filter((r) => r.phases.some((p) => p === "identity" || p === "scope" || doors.includes(p as DoorId)))
    .map((r) => r.id);
}

export interface EstimateInput {
  readonly doors?: readonly DoorId[];
  /** AWS */
  readonly users?: number; readonly groups?: number; readonly regions?: number; readonly buckets?: number; readonly bucketsWithoutRegion?: number; readonly trails?: number;
  /** 보고서 생성 폴링 횟수(1~10). 기본 1 */
  readonly reportPolls?: number;
  /** Azure */
  readonly subscriptions?: number; readonly storageAccountsPerSubscription?: number;
}
export const BUDGET = { awsUsers: 150, awsBuckets: 300, azureSubscriptions: 20, azureStorageAccounts: 100 } as const;

/** 호출 횟수 추정(예상 소요 계산용). 반환은 호출 id별 횟수와 합계 */
export function estimateCalls(cloud: FootprintCloud, e: EstimateInput): { total: number; byCall: Record<string, number> } {
  const doors = e.doors ?? (cloud === "aws" ? ["mfa", "key", "net", "sto", "log"] : ["key", "net", "sto", "log"]);
  const has = (d: DoorId): boolean => doors.includes(d);
  const by: Record<string, number> = {};
  const add = (id: string, n: number): void => { if (n > 0) by[id] = (by[id] ?? 0) + n; };
  if (cloud === "aws") {
    add("sts:GetCallerIdentity", 1); add("iam:ListAccountAliases", 1); add("ec2:DescribeRegions", 1);
    if (has("mfa") || has("key")) {
      const users = Math.min(e.users ?? 0, BUDGET.awsUsers);
      add("iam:GenerateCredentialReport", e.reportPolls ?? 1); add("iam:GetCredentialReport", 1); add("iam:GetAccountSummary", 1); add("iam:ListUsers", 1);
      if (has("mfa")) add("iam:ListMFADevices", users);
      if (has("key")) {
        add("iam:ListAccessKeys", users); add("iam:ListAttachedUserPolicies", users); add("iam:ListGroupsForUser", users);
        add("iam:ListAttachedGroupPolicies", e.groups ?? 0); add("iam:ListRoles", 1);
      }
    }
    if (has("net")) { add("ec2:DescribeSecurityGroups", e.regions ?? 0); add("ec2:DescribeNetworkInterfaces", e.regions ?? 0); }
    if (has("sto")) {
      const b = Math.min(e.buckets ?? 0, BUDGET.awsBuckets);
      add("s3:GetAccountPublicAccessBlock", 1); add("s3:ListAllMyBuckets", 1); add("s3:GetBucketLocation", Math.min(e.bucketsWithoutRegion ?? 0, b));
      for (const id of ["s3:GetBucketPublicAccessBlock", "s3:GetBucketPolicyStatus", "s3:GetBucketAcl", "s3:GetBucketOwnershipControls", "s3:GetBucketWebsite"]) add(id, b);
    }
    if (has("log")) { add("cloudtrail:DescribeTrails", 1); add("cloudtrail:GetTrailStatus", e.trails ?? 0); add("cloudtrail:GetEventSelectors", e.trails ?? 0); }
  } else {
    const subs = Math.min(e.subscriptions ?? 0, BUDGET.azureSubscriptions);
    const accts = Math.min(e.storageAccountsPerSubscription ?? 0, BUDGET.azureStorageAccounts);
    add("azure:account.show", 1); add("azure:account.list", 1);
    if (has("key") || has("sto") || has("log")) {
      add("azure:storage.account.list", subs);
      if (has("sto")) add("azure:storage.container-rm.list", subs * accts);
      if (has("log")) add("azure:monitor.diagnostic-settings.list", subs * accts);
    }
    if (has("net")) { add("azure:network.nsg.list", subs); add("azure:network.nic.list", subs); add("azure:network.public-ip.list", subs); }
    if (has("log")) add("azure:monitor.diagnostic-settings.subscription.list", subs);
  }
  return { total: Object.values(by).reduce((a, b) => a + b, 0), byCall: by };
}

const DOOR_KO: Readonly<Record<string, string>> = { identity: "신원 확인", scope: "범위", mfa: "현관", key: "열쇠", net: "창문", sto: "창고", log: "CCTV" };
/** 문서·저장소용 마크다운 표(페이지의 표와 같은 원천) */
export function renderFootprintMarkdown(cloud: FootprintCloud): string {
  const rows = footprintRows(cloud);
  const head = cloud === "aws"
    ? "| 명령 | 필요한 권한 | CloudTrail 이벤트(소스 / 이름) | 단계·문 | 호출 단위 | 종류 |\n|---|---|---|---|---|---|"
    : "| 명령 | 필요한 권한(RBAC 작업) | 단계·문 | 호출 단위 | 종류 |\n|---|---|---|---|---|";
  const lines = rows.map((r) => {
    const doors = r.phases.map((p) => DOOR_KO[p] ?? p).join("·");
    const kind = r.readOnly ? "조회" : "생성 요청(유일한 비조회 호출)";
    const perm = r.permission ?? "(권한 필요 없음)";
    return cloud === "aws"
      ? `| \`${r.cli}\` | \`${perm}\` | ${r.eventSource ?? "-"} / ${r.eventName ?? "-"} | ${doors} | ${r.unit} | ${kind} |`
      : `| \`${r.cli}\` | \`${perm}\` | ${doors} | ${r.unit} | ${kind} |`;
  });
  return [head, ...lines].join("\n");
}
