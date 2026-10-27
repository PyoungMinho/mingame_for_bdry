// src/lib/cloudcheck/collector/__scenarios__/aws.ts — AWS shim 시나리오 16종 (백엔드팀장 검토 §3-3 매트릭스)
// 각 시나리오의 기대값은 collector.aws.test.ts가 id로 찾아 검사한다.
import type { Scenario, ShimEntry } from "../testkit";
import { AWS_ACCOUNT, AWS_BUCKET_ASSETS, AWS_BUCKET_LOGS, AWS_KEY_ID_EXAMPLE, AWS_REPORT_CSV, AWS_TRAIL_ARN, asScenario, awsBase, awsManyUsers } from "./aws-base";
import { awsFail, b64, out, type ScenarioCase, withScenario } from "./types";

export const AWS_BUCKET_DATA = "amzn-s3-demo-data";
// 독이 든 응답의 가짜 PEM 머리글은 실행 중에 조각을 이어 붙여 만든다(공개 저장소 푸시 보호: 소스 바이트에 완성된 비밀 모양을 남기지 않는다). 값은 예전 리터럴과 같다.
const j = (...parts: readonly string[]): string => parts.join("");
const bucketKeys = (name: string, region: string): Record<string, ShimEntry> => ({
  [`s3api get-public-access-block#${name}@${region}`]: out({ PublicAccessBlockConfiguration: { BlockPublicAcls: true, IgnorePublicAcls: true, BlockPublicPolicy: true, RestrictPublicBuckets: true } }),
  [`s3api get-bucket-policy-status#${name}@${region}`]: out({ PolicyStatus: { IsPublic: false } }),
  [`s3api get-bucket-acl#${name}@${region}`]: out({ Owner: { ID: "c0ffee00" }, Grants: [] }),
  [`s3api get-bucket-ownership-controls#${name}@${region}`]: out({ OwnershipControls: { Rules: [{ ObjectOwnership: "BucketOwnerEnforced" }] } }),
  [`s3api get-bucket-website#${name}@${region}`]: awsFail("NoSuchWebsiteConfiguration", "GetBucketWebsite", "The specified bucket does not have a website configuration"),
});

/** 02: 신원·별칭 외 전부 거부 */
function deniedAll(): Scenario {
  const o: Record<string, ShimEntry | readonly ShimEntry[]> = {};
  for (const k of Object.keys(awsBase())) {
    if (k === "sts get-caller-identity" || k === "iam list-account-aliases") o[k] = awsBase()[k];
    else o[k] = awsFail("AccessDenied", k.split(/[#@]/)[0].replace(/-/g, " "), "User is not authorized to perform this action");
  }
  return o;
}

/** 08: 버킷 3개 중 1개만 ACL·정책 상태 조회가 거부된다(INV-7 패턴) */
function isolatedDenial(): Scenario {
  const b = awsBase();
  return withScenario(asScenario(b), {
    "s3api list-buckets": out({ Buckets: [
      { Name: AWS_BUCKET_LOGS, CreationDate: "2022-05-01T00:00:00+00:00", BucketRegion: "ap-northeast-2" },
      { Name: AWS_BUCKET_ASSETS, CreationDate: "2023-02-10T12:00:00+00:00", BucketRegion: "us-east-1" },
      { Name: AWS_BUCKET_DATA, CreationDate: "2024-03-03T00:00:00+00:00", BucketRegion: "ap-northeast-2" },
    ] }),
    ...bucketKeys(AWS_BUCKET_DATA, "ap-northeast-2"),
    [`s3api get-bucket-acl#${AWS_BUCKET_DATA}@ap-northeast-2`]: awsFail("AccessDenied", "GetBucketAcl", "Access Denied", 254),
    [`s3api get-bucket-policy-status#${AWS_BUCKET_DATA}@ap-northeast-2`]: awsFail("AccessDenied", "GetBucketPolicyStatus", "Access Denied", 254),
  });
}

/** 10: 독이 든 응답 — 읽으면 안 되는 필드 곳곳에 비밀·태그·정책 전문·IP·XSS를 넣는다 */
export const POISON_MARKERS = ["POISON", "wJalrXUtnFEMI", "eyJhbGciOiJIUzI1NiJ9", "BEGIN PRIVATE KEY", "203.0.113.", "10.0.0.8", "onerror", "<script", "kim@example.com"] as const;
function poison(): Scenario {
  const b = awsBase();
  const secrets = { SecretAccessKey: "wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY", Token: "eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJQT0lTT04ifQ.sig", Key: j("-----BEGIN ", "PRIVATE", " KEY", "-----POISON"), Note: "<script>alert(1)</script>" };
  return withScenario(asScenario(b), {
    "iam list-users": out({ Users: [
      { Path: "/POISON/", UserName: "build-bot", UserId: "AIDAEXAMPLEEXAMPLE02", Arn: `arn:aws:iam::${AWS_ACCOUNT}:user/POISON/build-bot`, CreateDate: "2024-11-20T05:30:00+00:00", Tags: [{ Key: "mail", Value: "kim@example.com" }], PermissionsBoundary: { PermissionsBoundaryArn: "arn:aws:iam::aws:policy/POISON" }, ...secrets },
      { Path: "/", UserName: "alice", UserId: "AIDAEXAMPLEEXAMPLE01", Arn: `arn:aws:iam::${AWS_ACCOUNT}:user/alice`, CreateDate: "2025-03-02T01:00:00+00:00", PasswordLastUsed: "2026-10-18T09:00:00+00:00", Tags: [{ Key: "x", Value: "<img src=x onerror=alert(1)>" }] },
    ] }),
    "iam list-access-keys#build-bot": out({ AccessKeyMetadata: [{ UserName: "build-bot", AccessKeyId: AWS_KEY_ID_EXAMPLE, Status: "Active", CreateDate: "2026-01-05T00:00:00+00:00", ...secrets }] }),
    "iam list-attached-user-policies#build-bot": out({ AttachedPolicies: [{ PolicyName: "POISON", PolicyArn: "arn:aws:iam::aws:policy/AmazonS3ReadOnlyAccess", PolicyDocument: { Statement: [{ Resource: "arn:aws:s3:::POISON-bucket/*" }] } }] }),
    "ec2 describe-security-groups@ap-northeast-2": out({ SecurityGroups: [{
      GroupId: "sg-0a1b2c3d", GroupName: "bastion-ssh", VpcId: "vpc-0bb1", Description: "<img src=x onerror=alert(1)> POISON", Tags: [{ Key: "Name", Value: "POISON <script>alert(1)</script>" }],
      IpPermissions: [{ IpProtocol: "tcp", FromPort: 22, ToPort: 22, IpRanges: [{ CidrIp: "0.0.0.0/0", Description: "POISON 203.0.113.77" }], Ipv6Ranges: [], PrefixListIds: [], UserIdGroupPairs: [{ GroupId: "sg-POISON", UserId: "999999999999" }], ...secrets }], IpPermissionsEgress: [],
    }] }),
    "ec2 describe-network-interfaces@ap-northeast-2": out({ NetworkInterfaces: [{
      NetworkInterfaceId: "eni-0f00ba12", Description: "POISON", MacAddress: "0a:00:00:00:00:01", PrivateIpAddress: "10.0.0.8", Status: "in-use", InterfaceType: "interface", RequesterManaged: false,
      Groups: [{ GroupId: "sg-0a1b2c3d", GroupName: "POISON-name" }], Association: { PublicIp: "203.0.113.9", PublicDnsName: "POISON.example.com", IpOwnerId: "amazon" },
      PrivateIpAddresses: [{ Primary: true, PrivateIpAddress: "10.0.0.8", Association: { PublicIp: "203.0.113.9" } }], Ipv6Addresses: [{ Ipv6Address: "2001:db8::1" }], TagSet: [{ Key: "k", Value: "POISON" }], ...secrets,
    }] }),
    [`s3api get-bucket-acl#${AWS_BUCKET_LOGS}@ap-northeast-2`]: out({ Owner: { DisplayName: "POISON-owner", ID: "c0ffee00c0ffee00c0ffee00c0ffee00c0ffee00c0ffee00c0ffee00c0ffee00" }, Grants: [
      { Grantee: { Type: "CanonicalUser", DisplayName: "POISON", ID: "c0ffee00", EmailAddress: "kim@example.com" }, Permission: "FULL_CONTROL" },
      { Grantee: { Type: "Group", URI: "http://acs.amazonaws.com/groups/global/AuthenticatedUsers" }, Permission: "READ_ACP" },
    ] }),
    [`s3api get-bucket-website#${AWS_BUCKET_ASSETS}@us-east-1`]: out({ IndexDocument: { Suffix: "<script>alert(1)</script>" }, ErrorDocument: { Key: "POISON" } }),
    "iam list-roles": out({ Roles: [{
      Path: "/", RoleName: "partner-readonly", RoleId: "AROAEXAMPLEEXAMPLE02", Arn: `arn:aws:iam::${AWS_ACCOUNT}:role/partner-readonly`, CreateDate: "2025-06-01T00:00:00+00:00", Description: "<img src=x onerror=alert(1)>", Tags: [{ Key: "k", Value: "POISON" }],
      AssumeRolePolicyDocument: { Version: "2012-10-17", Statement: [{ Sid: "POISON-sid", Effect: "Allow", Principal: { AWS: "arn:aws:iam::444455556666:root" }, Action: "sts:AssumeRole", Condition: { StringEquals: { "sts:ExternalId": "POISON-external-id-value" }, IpAddress: { "aws:SourceIp": "203.0.113.0/24" } } }] },
      RoleLastUsed: { LastUsedDate: "2026-10-01T00:00:00+00:00", Region: "POISON" },
    }] }),
    "cloudtrail describe-trails": out({ trailList: [{
      Name: "main-trail", S3BucketName: "POISON-trail-bucket", SnsTopicARN: "arn:aws:sns:ap-northeast-2:111122223333:POISON", IncludeGlobalServiceEvents: true, IsMultiRegionTrail: true, HomeRegion: "ap-northeast-2",
      TrailARN: `arn:aws:cloudtrail:ap-northeast-2:${AWS_ACCOUNT}:trail/main-trail`, LogFileValidationEnabled: true, KmsKeyId: "arn:aws:kms:ap-northeast-2:111122223333:key/POISON", CloudWatchLogsLogGroupArn: "arn:aws:logs:ap-northeast-2:111122223333:log-group:POISON:*", HasCustomEventSelectors: true, IsOrganizationTrail: false,
    }] }),
    // 전송 오류 글자(S3 오류 문구)에는 버킷 이름·IP·이메일이 들어 있을 수 있다 → 출력에는 '오류 기록이 있다'(참/거짓)만 남아야 한다
    [`cloudtrail get-trail-status#${AWS_TRAIL_ARN}@ap-northeast-2`]: out({ IsLogging: true, LatestDeliveryTime: "2026-10-19T02:00:00+00:00", LatestDeliveryError: "AccessDenied: POISON-trail-bucket 203.0.113.77 kim@example.com <script>alert(1)</script>", ...secrets }),
  });
}

/** 15: 명령 주입을 노린 이름 — 셸이 해석하면 작업 디렉터리에 PWNED 파일이 생긴다 */
function injectionNames(): Scenario {
  const users = ["$(touch PWNED)", "a b;touch PWNED", "`touch PWNED`"];
  const csv = [AWS_REPORT_CSV.split("\n")[0], ...users.map((u) => `"${u}",arn:aws:iam::${AWS_ACCOUNT}:user/x,2025-03-02T01:00:00+00:00,false,N/A,N/A,N/A,false,false,N/A,N/A,N/A,N/A,false,N/A,N/A,N/A,N/A,false,N/A,false,N/A`), ""].join("\n");
  const base = awsBase();
  for (const k of Object.keys(base)) if (/^iam (list-access-keys|list-mfa-devices|list-attached-user-policies|list-groups-for-user)#/.test(k)) delete base[k];
  const per: Record<string, ShimEntry> = {};
  for (const u of users) {
    per[`iam list-access-keys#${u}`] = out({ AccessKeyMetadata: [] });
    per[`iam list-mfa-devices#${u}`] = out({ MFADevices: [] });
    per[`iam list-attached-user-policies#${u}`] = out({ AttachedPolicies: [] });
    per[`iam list-groups-for-user#${u}`] = out({ Groups: [{ GroupName: "$(touch PWNED)" }] });
  }
  return { ...base, ...per,
    "iam get-credential-report": out({ Content: b64(csv), ReportFormat: "text/csv", GeneratedTime: "2026-10-19T03:11:58+00:00" }),
    "iam list-users": out({ Users: users.map((UserName) => ({ UserName, CreateDate: "2025-03-02T01:00:00+00:00" })) }),
    "iam list-attached-group-policies#$(touch PWNED)": out({ AttachedPolicies: [] }),
    "s3api list-buckets": out({ Buckets: [{ Name: "$(touch PWNED)", CreationDate: "2022-05-01T00:00:00+00:00", BucketRegion: "ap-northeast-2" }] }),
    ...bucketKeys("$(touch PWNED)", "ap-northeast-2"),
  };
}

export const AWS_SCENARIOS: readonly ScenarioCase[] = [
  { id: "aws-01-normal", title: "정상(가짜 회사): 모든 호출이 성공하거나 '설정 없음'으로 답한다", scenario: asScenario(awsBase()), args: ["--yes"] },
  { id: "aws-02-denied-all", title: "신원 외 전부 거부", scenario: deniedAll(), args: ["--yes"] },
  { id: "aws-03-region-denied", title: "리전 하나(us-east-1)의 보안 그룹만 UnauthorizedOperation", scenario: withScenario(asScenario(awsBase()), {
    "ec2 describe-security-groups@us-east-1": awsFail("UnauthorizedOperation", "DescribeSecurityGroups", "You are not authorized to perform this operation. User: arn:aws:sts::111122223333:assumed-role/SecurityAuditRole/kim@example.com"),
  }), args: ["--yes"] },
  { id: "aws-04-buckets-truncated", title: "list-buckets 응답에 ContinuationToken이 남음", scenario: withScenario(asScenario(awsBase()), {
    "s3api list-buckets": out({ Buckets: [
      { Name: AWS_BUCKET_LOGS, CreationDate: "2022-05-01T00:00:00+00:00", BucketRegion: "ap-northeast-2" },
      { Name: AWS_BUCKET_ASSETS, CreationDate: "2023-02-10T12:00:00+00:00", BucketRegion: "us-east-1" },
    ], ContinuationToken: "POISON-next-page-token" }),
  }), args: ["--yes"] },
  { id: "aws-05-throttled", title: "ThrottlingException(재시도 소진)과 SlowDown", scenario: withScenario(asScenario(awsBase()), {
    [`s3api get-bucket-acl#${AWS_BUCKET_LOGS}@ap-northeast-2`]: awsFail("ThrottlingException", "GetBucketAcl", "(reached max retries: 5): Rate exceeded"),
    [`s3api get-bucket-website#${AWS_BUCKET_LOGS}@ap-northeast-2`]: awsFail("SlowDown", "GetBucketWebsite", "Please reduce your request rate."),
  }), args: ["--yes"] },
  { id: "aws-06-old-cli-252", title: "종료 코드 252(옛 CLI가 모르는 명령)", scenario: withScenario(asScenario(awsBase()), {
    [`s3api get-bucket-ownership-controls#${AWS_BUCKET_LOGS}@ap-northeast-2`]: { stderr: "usage: aws [options] <command> <subcommand> [<subcommand> ...] [parameters]\naws: error: argument operation: Invalid choice\n", rc: 252 },
  }), args: ["--yes"] },
  { id: "aws-07-not-json", title: "list-users의 표준 출력이 JSON이 아니다", scenario: withScenario(asScenario(awsBase()), {
    "iam list-users": { stdout: "Traceback (most recent call last):\n  File \"aws\", line 1\nSyntaxError: this is not json\n", rc: 0 },
  }), args: ["--yes"] },
  { id: "aws-08-isolated-denial", title: "버킷 3개 중 1개만 ACL·정책 상태 조회가 거부된다(INV-7 패턴)", scenario: isolatedDenial(), args: ["--yes"] },
  { id: "aws-09-report-timeout", title: "보고서 생성이 끝나지 않는다(폴링 10회 뒤 ReportInProgress)", scenario: withScenario(asScenario(awsBase()), {
    "iam generate-credential-report": [out({ State: "STARTED" }), out({ State: "INPROGRESS" })],
    "iam get-credential-report": awsFail("ReportInProgress", "GetCredentialReport", "The report is still being generated"),
  }), args: ["--yes"] },
  { id: "aws-10-poison", title: "독이 든 응답: 태그·정책 전문·전체 키 ID·IP·XSS·이메일이 곳곳에", scenario: poison(), args: ["--yes"] },
  { id: "aws-11-no-jq", title: "jq가 없다 → 클라우드 호출 0건으로 종료", scenario: asScenario(awsBase()), args: ["--yes"], withoutTools: ["jq"] },
  { id: "aws-12-no-aws", title: "aws가 없다 → 클라우드 호출 0건으로 종료", scenario: asScenario(awsBase()), args: ["--yes"], withoutTools: ["aws"] },
  { id: "aws-13-doors-net", title: "--doors net → 신원·범위·net 호출만", scenario: asScenario(awsBase()), args: ["--yes", "--doors", "net"] },
  { id: "aws-14-no-yes", title: "비대화형인데 --yes 없음 → 신원 호출 뒤 종료, 파일 없음", scenario: asScenario(awsBase()), args: [] },
  { id: "aws-15-injection-names", title: "$(touch PWNED) 같은 리소스 이름 → 셸이 해석하지 않는다", scenario: injectionNames(), args: ["--yes"] },
  { id: "aws-16-users-200", title: "사용자 200명 → 예산 150, 나머지는 영수증 없음(--doors mfa로 호출 수를 줄여 시험)", scenario: asScenario(awsManyUsers(200)), args: ["--yes", "--doors", "mfa"] },
];
export const awsCase = (id: string): ScenarioCase => {
  const c = AWS_SCENARIOS.find((x) => x.id === id);
  if (!c) throw new Error(`없는 시나리오: ${id}`);
  return c;
};
