// src/lib/cloudcheck/contract/calls.ts — 호출 카탈로그 v1.0
// 린터(L-05 완전 일치)·예상 발자국 표·권한 패널·영수증 call enum의 단일 원천.
// G0 동결. 소유: API설계자. 호출 추가·삭제는 수집기 릴리스 + 스키마 minor 증가 + 백엔드팀장 승인.
import type { DoorId } from "../model/report";

export type CallPhase = "identity" | "scope" | DoorId;
export type CallUnit = "account" | "region" | "user" | "group" | "bucket" | "trail" | "subscription" | "storage-account" | "local";
export interface CallMeta {
  readonly cli: string;                // 수집기 안의 명령(인자 제외)
  readonly permission: string | null;  // 요청할 권한 이름. AWS = IAM 액션, Azure = RBAC 작업. 필요 없으면 null
  readonly phases: readonly CallPhase[]; // 이 호출의 데이터를 쓰는 단계·문(발자국 표 표기용)
  readonly unit: CallUnit;             // 호출 단위(호출 횟수 추정용)
  readonly readOnly: boolean;          // false는 iam:GenerateCredentialReport 1건뿐(C-03 명시 예외)
}

/** AWS 26종. get-caller-identity를 뺀 25개 권한은 관리형 SecurityAudit에 포함 [확인: 백엔드팀장, 정책 문서 대조] */
export const AWS_CALLS = {
  "sts:GetCallerIdentity": { cli: "aws sts get-caller-identity", permission: null, phases: ["identity"], unit: "account", readOnly: true },
  "iam:ListAccountAliases": { cli: "aws iam list-account-aliases", permission: "iam:ListAccountAliases", phases: ["identity"], unit: "account", readOnly: true },
  "ec2:DescribeRegions": { cli: "aws ec2 describe-regions", permission: "ec2:DescribeRegions", phases: ["scope"], unit: "account", readOnly: true },
  "iam:GenerateCredentialReport": { cli: "aws iam generate-credential-report", permission: "iam:GenerateCredentialReport", phases: ["mfa", "key"], unit: "account", readOnly: false },
  "iam:GetCredentialReport": { cli: "aws iam get-credential-report", permission: "iam:GetCredentialReport", phases: ["mfa", "key"], unit: "account", readOnly: true },
  "iam:GetAccountSummary": { cli: "aws iam get-account-summary", permission: "iam:GetAccountSummary", phases: ["mfa", "key"], unit: "account", readOnly: true },
  "iam:ListUsers": { cli: "aws iam list-users", permission: "iam:ListUsers", phases: ["mfa", "key"], unit: "account", readOnly: true },
  "iam:ListAccessKeys": { cli: "aws iam list-access-keys", permission: "iam:ListAccessKeys", phases: ["key"], unit: "user", readOnly: true },
  "iam:ListMFADevices": { cli: "aws iam list-mfa-devices", permission: "iam:ListMFADevices", phases: ["mfa"], unit: "user", readOnly: true },
  "iam:ListAttachedUserPolicies": { cli: "aws iam list-attached-user-policies", permission: "iam:ListAttachedUserPolicies", phases: ["key"], unit: "user", readOnly: true },
  "iam:ListGroupsForUser": { cli: "aws iam list-groups-for-user", permission: "iam:ListGroupsForUser", phases: ["key"], unit: "user", readOnly: true },
  "iam:ListAttachedGroupPolicies": { cli: "aws iam list-attached-group-policies", permission: "iam:ListAttachedGroupPolicies", phases: ["key"], unit: "group", readOnly: true },
  "iam:ListRoles": { cli: "aws iam list-roles", permission: "iam:ListRoles", phases: ["key"], unit: "account", readOnly: true },
  "ec2:DescribeSecurityGroups": { cli: "aws ec2 describe-security-groups", permission: "ec2:DescribeSecurityGroups", phases: ["net"], unit: "region", readOnly: true },
  "ec2:DescribeNetworkInterfaces": { cli: "aws ec2 describe-network-interfaces", permission: "ec2:DescribeNetworkInterfaces", phases: ["net"], unit: "region", readOnly: true },
  "s3:GetAccountPublicAccessBlock": { cli: "aws s3control get-public-access-block", permission: "s3:GetAccountPublicAccessBlock", phases: ["sto"], unit: "account", readOnly: true },
  "s3:ListAllMyBuckets": { cli: "aws s3api list-buckets", permission: "s3:ListAllMyBuckets", phases: ["sto"], unit: "account", readOnly: true },
  "s3:GetBucketLocation": { cli: "aws s3api get-bucket-location", permission: "s3:GetBucketLocation", phases: ["sto"], unit: "bucket", readOnly: true },
  "s3:GetBucketPublicAccessBlock": { cli: "aws s3api get-public-access-block", permission: "s3:GetBucketPublicAccessBlock", phases: ["sto"], unit: "bucket", readOnly: true },
  "s3:GetBucketPolicyStatus": { cli: "aws s3api get-bucket-policy-status", permission: "s3:GetBucketPolicyStatus", phases: ["sto"], unit: "bucket", readOnly: true },
  "s3:GetBucketAcl": { cli: "aws s3api get-bucket-acl", permission: "s3:GetBucketAcl", phases: ["sto"], unit: "bucket", readOnly: true },
  "s3:GetBucketOwnershipControls": { cli: "aws s3api get-bucket-ownership-controls", permission: "s3:GetBucketOwnershipControls", phases: ["sto"], unit: "bucket", readOnly: true },
  "s3:GetBucketWebsite": { cli: "aws s3api get-bucket-website", permission: "s3:GetBucketWebsite", phases: ["sto"], unit: "bucket", readOnly: true },
  "cloudtrail:DescribeTrails": { cli: "aws cloudtrail describe-trails", permission: "cloudtrail:DescribeTrails", phases: ["log"], unit: "account", readOnly: true },
  "cloudtrail:GetTrailStatus": { cli: "aws cloudtrail get-trail-status", permission: "cloudtrail:GetTrailStatus", phases: ["log"], unit: "trail", readOnly: true },
  "cloudtrail:GetEventSelectors": { cli: "aws cloudtrail get-event-selectors", permission: "cloudtrail:GetEventSelectors", phases: ["log"], unit: "trail", readOnly: true },
} as const satisfies Record<string, CallMeta>;

/** Azure 9종. RBAC 작업 이름은 [일반 지식], 구독 Reader로 충분한지는 [미확인] → PM V1에서 확인.
 *  데이터 평면 명령(storage container list, storage blob 등)은 계정 키를 암묵 조회할 수 있어 금지(L-06). 관리 평면 container-rm만 쓴다 */
export const AZURE_CALLS = {
  "azure:account.show": { cli: "az account show", permission: null, phases: ["identity"], unit: "local", readOnly: true },
  "azure:account.list": { cli: "az account list", permission: "Microsoft.Resources/subscriptions/read", phases: ["scope"], unit: "account", readOnly: true },
  "azure:storage.account.list": { cli: "az storage account list", permission: "Microsoft.Storage/storageAccounts/read", phases: ["key", "sto", "log"], unit: "subscription", readOnly: true },
  "azure:storage.container-rm.list": { cli: "az storage container-rm list", permission: "Microsoft.Storage/storageAccounts/blobServices/containers/read", phases: ["sto"], unit: "storage-account", readOnly: true },
  "azure:monitor.diagnostic-settings.list": { cli: "az monitor diagnostic-settings list", permission: "Microsoft.Insights/diagnosticSettings/read", phases: ["log"], unit: "storage-account", readOnly: true },
  "azure:monitor.diagnostic-settings.subscription.list": { cli: "az monitor diagnostic-settings subscription list", permission: "Microsoft.Insights/diagnosticSettings/read", phases: ["log"], unit: "subscription", readOnly: true },
  "azure:network.nsg.list": { cli: "az network nsg list", permission: "Microsoft.Network/networkSecurityGroups/read", phases: ["net"], unit: "subscription", readOnly: true },
  "azure:network.nic.list": { cli: "az network nic list", permission: "Microsoft.Network/networkInterfaces/read", phases: ["net"], unit: "subscription", readOnly: true },
  "azure:network.public-ip.list": { cli: "az network public-ip list", permission: "Microsoft.Network/publicIPAddresses/read", phases: ["net"], unit: "subscription", readOnly: true },
} as const satisfies Record<string, CallMeta>;

export type AwsCall = keyof typeof AWS_CALLS;
export type AzureCall = keyof typeof AZURE_CALLS;
export const AWS_CALL_IDS = Object.keys(AWS_CALLS) as [AwsCall, ...AwsCall[]];
export const AZURE_CALL_IDS = Object.keys(AZURE_CALLS) as [AzureCall, ...AzureCall[]];
