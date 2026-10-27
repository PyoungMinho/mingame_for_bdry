// src/lib/cloudcheck/collector/__scenarios__/aws-base.ts — AWS 기본 시나리오(가짜 회사 '예시상회', 계정 111122223333)
// AWS CLI v2가 내는 모양(PascalCase, 들여쓰기 JSON)을 흉내 낸다. 수집기가 읽어도 되는 필드와 읽으면 안 되는 필드를 일부러 섞어 두었다.
//  - 읽으면 안 되는 필드에는 'POISON' 표식을 넣어, 출력에 한 글자라도 나오면 테스트가 잡게 한다(poison 시나리오가 더 넣는다).
import type { Scenario, ShimEntry } from "../testkit";
import { awsFail, b64, out } from "./types";

export const AWS_ACCOUNT = "111122223333";
export const AWS_BUCKET_LOGS = "amzn-s3-demo-logs";
export const AWS_BUCKET_ASSETS = "amzn-s3-demo-assets";
export const AWS_TRAIL_ARN = `arn:aws:cloudtrail:ap-northeast-2:${AWS_ACCOUNT}:trail/main-trail`;
export const AWS_KEY_ID_EXAMPLE = "AKIAIOSFODNN7EXAMPLE";

/** 자격증명 보고서 CSV(실제 출력처럼 true/false 소문자). 루트 + alice + build-bot */
export const AWS_REPORT_CSV = [
  "user,arn,user_creation_time,password_enabled,password_last_used,password_last_changed,password_next_rotation,mfa_active,access_key_1_active,access_key_1_last_rotated,access_key_1_last_used_date,access_key_1_last_used_region,access_key_1_last_used_service,access_key_2_active,access_key_2_last_rotated,access_key_2_last_used_date,access_key_2_last_used_region,access_key_2_last_used_service,cert_1_active,cert_1_last_rotated,cert_2_active,cert_2_last_rotated",
  `<root_account>,arn:aws:iam::${AWS_ACCOUNT}:root,2020-01-01T00:00:00+00:00,not_supported,2026-07-01T00:10:00+00:00,not_supported,not_supported,true,false,N/A,N/A,N/A,N/A,false,N/A,N/A,N/A,N/A,false,N/A,false,N/A`,
  `alice,arn:aws:iam::${AWS_ACCOUNT}:user/alice,2025-03-02T01:00:00+00:00,true,2026-10-18T09:00:00+00:00,2025-03-02T01:00:00+00:00,N/A,true,false,N/A,N/A,N/A,N/A,false,N/A,N/A,N/A,N/A,false,N/A,false,N/A`,
  `build-bot,arn:aws:iam::${AWS_ACCOUNT}:user/build-bot,2024-11-20T05:30:00+00:00,false,N/A,N/A,N/A,false,true,2026-01-05T00:00:00+00:00,2026-10-17T12:00:00+00:00,ap-northeast-2,s3,false,N/A,N/A,N/A,N/A,false,N/A,false,N/A`,
  "",
].join("\n");

const trust = (statements: unknown[]): unknown => ({ Version: "2012-10-17", Statement: statements });
const sgDefault = (id: string, region: string): unknown => ({
  GroupId: id, GroupName: "default", VpcId: `vpc-0${region === "us-east-1" ? "aa" : "bb"}1`, OwnerId: AWS_ACCOUNT,
  Description: "POISON default VPC security group", IpPermissions: [], IpPermissionsEgress: [{ IpProtocol: "-1", IpRanges: [{ CidrIp: "0.0.0.0/0" }] }],
});

/** 사용자 이름 목록으로 사용자별 응답을 만든다(처음 limit명만 호출됨 — 예산 시나리오에서 나머지를 일부러 비워 둔다) */
function userScenario(names: readonly string[], limit: number): Record<string, ShimEntry> {
  const o: Record<string, ShimEntry> = {};
  for (const n of names.slice(0, limit)) {
    o[`iam list-access-keys#${n}`] = out({ AccessKeyMetadata: [] });
    o[`iam list-mfa-devices#${n}`] = out({ MFADevices: [] });
    o[`iam list-attached-user-policies#${n}`] = out({ AttachedPolicies: [] });
    o[`iam list-groups-for-user#${n}`] = out({ Groups: [] });
  }
  return o;
}

/** 기본(정상) 시나리오: 모든 호출이 성공하거나 '설정 없음'으로 답한다 */
export function awsBase(): Record<string, ShimEntry | readonly ShimEntry[]> {
  const bucketCommon = (name: string, region: string): Record<string, ShimEntry> => ({
    [`s3api get-public-access-block#${name}@${region}`]: out({ PublicAccessBlockConfiguration: { BlockPublicAcls: true, IgnorePublicAcls: true, BlockPublicPolicy: true, RestrictPublicBuckets: true } }),
    [`s3api get-bucket-policy-status#${name}@${region}`]: awsFail("NoSuchBucketPolicy", "GetBucketPolicyStatus", "The bucket policy does not exist"),
    [`s3api get-bucket-acl#${name}@${region}`]: out({ Owner: { DisplayName: "POISON-owner", ID: "c0ffee00c0ffee00c0ffee00c0ffee00c0ffee00c0ffee00c0ffee00c0ffee00" }, Grants: [{ Grantee: { DisplayName: "POISON-owner", ID: "c0ffee00c0ffee00c0ffee00c0ffee00c0ffee00c0ffee00c0ffee00c0ffee00", Type: "CanonicalUser" }, Permission: "FULL_CONTROL" }] }),
    [`s3api get-bucket-ownership-controls#${name}@${region}`]: out({ OwnershipControls: { Rules: [{ ObjectOwnership: "BucketOwnerEnforced" }] } }),
    [`s3api get-bucket-website#${name}@${region}`]: awsFail("NoSuchWebsiteConfiguration", "GetBucketWebsite", "The specified bucket does not have a website configuration"),
  });
  const base: Record<string, ShimEntry | readonly ShimEntry[]> = {
    "sts get-caller-identity": out({ UserId: "AROAEXAMPLEEXAMPLE0:kim@example.com", Account: AWS_ACCOUNT, Arn: `arn:aws:sts::${AWS_ACCOUNT}:assumed-role/SecurityAuditRole/kim@example.com` }),
    "iam list-account-aliases": out({ AccountAliases: ["example-corp"] }),
    "ec2 describe-regions": out({ Regions: [
      { Endpoint: "ec2.us-east-1.amazonaws.com", RegionName: "us-east-1", OptInStatus: "opt-in-not-required" },
      { Endpoint: "ec2.ap-northeast-2.amazonaws.com", RegionName: "ap-northeast-2", OptInStatus: "opt-in-not-required" },
    ] }),
    "iam generate-credential-report": [out({ State: "STARTED", Description: "No report exists. Starting a new report generation task" }), out({ State: "INPROGRESS" }), out({ State: "COMPLETE" })],
    "iam get-credential-report": out({ Content: b64(AWS_REPORT_CSV), ReportFormat: "text/csv", GeneratedTime: "2026-10-19T03:11:58+00:00" }),
    "iam get-account-summary": out({ SummaryMap: { Users: 2, UsersQuota: 5000, Groups: 1, GroupsQuota: 300, Roles: 2, RolesQuota: 1000, AccountMFAEnabled: 1, MFADevicesInUse: 1, AccountAccessKeysPresent: 0, AccountSigningCertificatesPresent: 0, AccountPasswordPresent: 1, ServerCertificates: 0 } }),
    "iam list-users": out({ Users: [
      { Path: "/", UserName: "build-bot", UserId: "AIDAEXAMPLEEXAMPLE02", Arn: `arn:aws:iam::${AWS_ACCOUNT}:user/build-bot`, CreateDate: "2024-11-20T05:30:00+00:00", Tags: [{ Key: "owner", Value: "POISON-tag" }] },
      { Path: "/", UserName: "alice", UserId: "AIDAEXAMPLEEXAMPLE01", Arn: `arn:aws:iam::${AWS_ACCOUNT}:user/alice`, CreateDate: "2025-03-02T01:00:00+00:00", PasswordLastUsed: "2026-10-18T09:00:00+00:00" },
    ] }),
    "iam list-access-keys#alice": out({ AccessKeyMetadata: [] }),
    "iam list-access-keys#build-bot": out({ AccessKeyMetadata: [{ UserName: "build-bot", AccessKeyId: AWS_KEY_ID_EXAMPLE, Status: "Active", CreateDate: "2026-01-05T00:00:00+00:00" }] }),
    "iam list-mfa-devices#alice": out({ MFADevices: [{ UserName: "alice", SerialNumber: `arn:aws:iam::${AWS_ACCOUNT}:mfa/alice`, EnableDate: "2025-03-02T01:05:00+00:00" }] }),
    "iam list-mfa-devices#build-bot": out({ MFADevices: [] }),
    "iam list-attached-user-policies#alice": out({ AttachedPolicies: [] }),
    "iam list-attached-user-policies#build-bot": out({ AttachedPolicies: [{ PolicyName: "AmazonS3ReadOnlyAccess", PolicyArn: "arn:aws:iam::aws:policy/AmazonS3ReadOnlyAccess" }] }),
    "iam list-groups-for-user#alice": out({ Groups: [{ Path: "/", GroupName: "devs", GroupId: "AGPAEXAMPLEEXAMPLE01", Arn: `arn:aws:iam::${AWS_ACCOUNT}:group/devs`, CreateDate: "2025-03-01T00:00:00+00:00" }] }),
    "iam list-groups-for-user#build-bot": out({ Groups: [] }),
    "iam list-attached-group-policies#devs": out({ AttachedPolicies: [{ PolicyName: "ReadOnlyAccess", PolicyArn: "arn:aws:iam::aws:policy/ReadOnlyAccess" }] }),
    "iam list-roles": out({ Roles: [
      { Path: "/aws-service-role/support.amazonaws.com/", RoleName: "AWSServiceRoleForSupport", RoleId: "AROAEXAMPLEEXAMPLE01", Arn: `arn:aws:iam::${AWS_ACCOUNT}:role/aws-service-role/support.amazonaws.com/AWSServiceRoleForSupport`, CreateDate: "2024-11-01T00:00:00+00:00", Description: "POISON-role-description",
        AssumeRolePolicyDocument: trust([{ Effect: "Allow", Principal: { Service: "support.amazonaws.com" }, Action: "sts:AssumeRole" }]) },
      { Path: "/", RoleName: "partner-readonly", RoleId: "AROAEXAMPLEEXAMPLE02", Arn: `arn:aws:iam::${AWS_ACCOUNT}:role/partner-readonly`, CreateDate: "2025-06-01T00:00:00+00:00",
        AssumeRolePolicyDocument: trust([{ Effect: "Allow", Principal: { AWS: "arn:aws:iam::444455556666:root" }, Action: "sts:AssumeRole", Condition: { StringEquals: { "sts:ExternalId": "POISON-external-id-value" } } }]) },
    ] }),
    "ec2 describe-security-groups@ap-northeast-2": out({ SecurityGroups: [
      sgDefault("sg-0b1b1b1b", "ap-northeast-2"),
      { GroupId: "sg-0a1b2c3d", GroupName: "bastion-ssh", VpcId: "vpc-0bb1", OwnerId: AWS_ACCOUNT, Description: "POISON <img src=x onerror=alert(1)>", Tags: [{ Key: "Name", Value: "POISON-sg-tag" }],
        IpPermissions: [{ IpProtocol: "tcp", FromPort: 22, ToPort: 22, IpRanges: [{ CidrIp: "0.0.0.0/0", Description: "POISON-rule-description" }], Ipv6Ranges: [], PrefixListIds: [], UserIdGroupPairs: [] }],
        IpPermissionsEgress: [] },
    ] }),
    "ec2 describe-security-groups@us-east-1": out({ SecurityGroups: [sgDefault("sg-0a1a1a1a", "us-east-1")] }),
    "ec2 describe-network-interfaces@ap-northeast-2": out({ NetworkInterfaces: [
      { NetworkInterfaceId: "eni-0f00ba12", Description: "POISON-eni-description", MacAddress: "0a:00:00:00:00:01", PrivateIpAddress: "10.0.0.8", Status: "in-use", InterfaceType: "interface", RequesterManaged: false,
        Groups: [{ GroupId: "sg-0a1b2c3d", GroupName: "bastion-ssh" }], Association: { PublicIp: "203.0.113.9", PublicDnsName: "POISON.example.com" },
        PrivateIpAddresses: [{ Primary: true, PrivateIpAddress: "10.0.0.8", Association: { PublicIp: "203.0.113.9" } }], Ipv6Addresses: [], TagSet: [{ Key: "Name", Value: "POISON-eni-tag" }] },
    ] }),
    "ec2 describe-network-interfaces@us-east-1": out({ NetworkInterfaces: [] }),
    "s3control get-public-access-block": awsFail("NoSuchPublicAccessBlockConfiguration", "GetPublicAccessBlock", "The public access block configuration was not found"),
    "s3api list-buckets": out({ Buckets: [
      { Name: AWS_BUCKET_LOGS, CreationDate: "2022-05-01T00:00:00+00:00", BucketRegion: "ap-northeast-2" },
      { Name: AWS_BUCKET_ASSETS, CreationDate: "2023-02-10T12:00:00+00:00" },   // 목록에 BucketRegion이 없는 옛 형태 → get-bucket-location으로 보충
    ], Owner: { DisplayName: "POISON-owner", ID: "c0ffee00c0ffee00c0ffee00c0ffee00c0ffee00c0ffee00c0ffee00c0ffee00" } }),
    [`s3api get-bucket-location#${AWS_BUCKET_ASSETS}`]: out({ LocationConstraint: null }),   // null = us-east-1
    ...bucketCommon(AWS_BUCKET_LOGS, "ap-northeast-2"),
    ...bucketCommon(AWS_BUCKET_ASSETS, "us-east-1"),
    "cloudtrail describe-trails": out({ trailList: [
      { Name: "main-trail", S3BucketName: "POISON-trail-bucket", IncludeGlobalServiceEvents: true, IsMultiRegionTrail: true, HomeRegion: "ap-northeast-2", TrailARN: AWS_TRAIL_ARN, LogFileValidationEnabled: true, KmsKeyId: "POISON-kms-key", HasCustomEventSelectors: false, HasInsightSelectors: false, IsOrganizationTrail: false },
    ] }),
    [`cloudtrail get-trail-status#${AWS_TRAIL_ARN}@ap-northeast-2`]: out({ IsLogging: true, LatestDeliveryTime: "2026-10-19T02:00:00+00:00", LatestDeliveryError: null }),
    [`cloudtrail get-event-selectors#${AWS_TRAIL_ARN}@ap-northeast-2`]: out({ TrailARN: AWS_TRAIL_ARN, EventSelectors: [{ ReadWriteType: "All", IncludeManagementEvents: true, DataResources: [{ Type: "AWS::S3::Object", Values: ["arn:aws:s3:::POISON-data-bucket/"] }] }] }),
  };
  // assets 버킷: 정적 웹사이트 + AllUsers READ (공개 후보)
  base[`s3api get-bucket-acl#${AWS_BUCKET_ASSETS}@us-east-1`] = out({ Owner: { ID: "c0ffee00" }, Grants: [
    { Grantee: { Type: "Group", URI: "http://acs.amazonaws.com/groups/global/AllUsers" }, Permission: "READ" },
    { Grantee: { Type: "CanonicalUser", ID: "c0ffee00", DisplayName: "POISON-owner" }, Permission: "FULL_CONTROL" },
  ] });
  base[`s3api get-bucket-website#${AWS_BUCKET_ASSETS}@us-east-1`] = out({ IndexDocument: { Suffix: "index.html" }, ErrorDocument: { Key: "POISON-error.html" } });
  base[`s3api get-bucket-policy-status#${AWS_BUCKET_ASSETS}@us-east-1`] = out({ PolicyStatus: { IsPublic: false } });
  base[`cloudtrail get-trail-status#${AWS_TRAIL_ARN}@ap-northeast-2`] = out({ IsLogging: true, LatestDeliveryTime: "2026-10-19T02:00:00+00:00" });
  return base;
}

/** 사용자 n명(처음 limit명만 호출 응답이 있다) — 예산 시나리오 */
export function awsManyUsers(n: number, limit = 150): Record<string, ShimEntry | readonly ShimEntry[]> {
  const names = Array.from({ length: n }, (_, i) => `user-${String(i).padStart(3, "0")}`);
  const base = awsBase();
  for (const k of Object.keys(base)) if (/^iam (list-access-keys|list-mfa-devices|list-attached-user-policies|list-groups-for-user)#/.test(k)) delete base[k];
  delete base["iam list-attached-group-policies#devs"];
  const users = names.map((UserName, i) => ({ Path: "/", UserName, UserId: `AIDAEXAMPLEEXAMPLE${String(i).padStart(2, "0")}`, Arn: `arn:aws:iam::${AWS_ACCOUNT}:user/${UserName}`, CreateDate: "2025-01-01T00:00:00+00:00" }));
  return { ...base, "iam list-users": out({ Users: users }), ...userScenario(names, limit) };
}

/** 모든 호출 응답을 읽기만 하는 형태로 노출(시나리오 변형이 키를 찾을 때 쓴다) */
export const asScenario = (o: Record<string, ShimEntry | readonly ShimEntry[]>): Scenario => o;
