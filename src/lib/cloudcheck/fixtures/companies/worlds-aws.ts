// src/lib/cloudcheck/fixtures/companies/worlds-aws.ts — AWS 가짜 회사 4곳 (체험 모드 · 종단 시험의 입력)
// 세트: A 반듯상회(대체로 정리됨) · B 멈춘시계상회(몇 해 전에 설정이 멈춤) · C 아슬아슬상회(사고 직전) · D 반쯤본상회(조회 권한이 모자라 반쯤만 봄)
// 이 파일은 "그 계정이 실제로 어떤 모습인가"만 적는다. 판정 결과(정답)는 answers/*.json에 사람이 따로 먼저 쓴다.
// 기준 시각 2026-10-19T03:15:00Z. 모든 값은 문서 표본이다.
import type { AwsBucketDef, AwsCompany, AwsEniDef, AwsRoleDef, AwsSgDef, AwsTrailDef, PabDef } from "./build-aws";

const ACCOUNT = "111122223333";
const COLLECTED = "2026-10-19T03:15:00Z";
const REPORT_AT = "2026-10-19T03:12:09Z";
const PARTNER = "444455556666";
const VENDOR = "999988887777";
const KR = "ap-northeast-2";
const US = "us-east-1";

const PAB_ON: PabDef = { blockPublicAcls: true, ignorePublicAcls: true, blockPublicPolicy: true, restrictPublicBuckets: true };
const PAB_OFF: PabDef = { blockPublicAcls: false, ignorePublicAcls: false, blockPublicPolicy: false, restrictPublicBuckets: false };

const supportRole: AwsRoleDef = { name: "AWSServiceRoleForSupport", path: "/aws-service-role/support.amazonaws.com/", createdAt: "2023-05-01T00:00:00Z", trust: [{ service: ["support.amazonaws.com"] }] };
const lambdaRole: AwsRoleDef = { name: "app-lambda-exec", createdAt: "2024-02-10T00:00:00Z", trust: [{ service: ["lambda.amazonaws.com"] }] };
const partnerRole: AwsRoleDef = { name: "partner-readonly", createdAt: "2025-06-01T00:00:00Z", trust: [{ aws: [`arn:aws:iam::${PARTNER}:root`], conditionKeys: ["StringEquals:sts:ExternalId"] }] };

const mainTrail: AwsTrailDef = { name: "main-trail", homeRegion: KR, multiRegion: true, validation: true, logging: true, selectors: [{ readWriteType: "All", includeManagementEvents: true }] };
const web = (id: string, name = "web"): AwsSgDef => ({ id, name, vpcId: "vpc-0bb1", ingress: [{ protocol: "tcp", from: 443, to: 443 }, { protocol: "tcp", from: 80, to: 80 }] });
const office = (id: string, cidr: string): AwsSgDef => ({ id, name: "office-ssh", vpcId: "vpc-0bb1", ingress: [{ protocol: "tcp", from: 22, to: 22, cidrs: [cidr] }] });
const dflt = (id: string, vpc = "vpc-0bb1"): AwsSgDef => ({ id, name: "default", vpcId: vpc, ingress: [] });
const eni = (id: string, groups: string[], publicIp: boolean): AwsEniDef => ({ id, groups, publicIp });

const bucket = (name: string, createdAt: string, o: Partial<AwsBucketDef> = {}): AwsBucketDef => ({
  name, region: KR, createdAt, pab: PAB_ON, policyPublic: null, aclGrants: [], ownership: "BucketOwnerEnforced", website: false, ...o,
});

/* ───────── A 반듯상회: 대체로 잘 정리된 회사. IAM 사용자 0명(Identity Center), 루트는 MFA만 있고 키 없음 ───────── */
export const AWS_A: AwsCompany = {
  setId: "A", name: "반듯상회", accountId: ACCOUNT,
  principal: { type: "assumed-role", name: "SecurityAuditRole" },
  collectedAt: COLLECTED, reportAt: REPORT_AT,
  regions: [KR, US],
  root: { createdAt: "2019-04-02T01:00:00Z", password: "not_supported", passwordLastUsed: "2026-03-02T01:00:00Z", mfa: true, keys: [] },
  users: [], groups: [],
  roles: [supportRole, lambdaRole, partnerRole],
  sgs: { [KR]: [web("sg-0a1b2c3d"), office("sg-0b2c3d4e", "203.0.113.0/24"), dflt("sg-0c3d4e5f")], [US]: [dflt("sg-0d4e5f6a", "vpc-0aa1")] },
  enis: { [KR]: [eni("eni-0f00ba12", ["sg-0a1b2c3d"], true), eni("eni-0f00ba13", ["sg-0b2c3d4e"], false)], [US]: [] },
  accountPab: PAB_ON,
  buckets: [
    bucket("amzn-s3-demo-banjeut-logs", "2024-03-05T00:00:00Z"),
    bucket("amzn-s3-demo-banjeut-backup", "2024-03-05T00:00:00Z", { policyPublic: false }),
    bucket("amzn-s3-demo-banjeut-data", "2024-06-20T00:00:00Z", { pab: null, policyPublic: false }),   // 버킷 차단은 없고 계정 차단이 막는다
  ],
  trails: [mainTrail],
  faults: [],
};

/* ───────── B 멈춘시계상회: 몇 해 전에 설정이 멈춘 회사. 위험은 없고 주의만 있다 ───────── */
export const AWS_B: AwsCompany = {
  setId: "B", name: "멈춘시계상회", accountId: ACCOUNT,
  principal: { type: "assumed-role", name: "SecurityAuditRole" },
  collectedAt: COLLECTED, reportAt: REPORT_AT,
  regions: [KR, US],
  root: { createdAt: "2018-03-05T01:00:00Z", password: "not_supported", passwordLastUsed: "2025-06-20T04:00:00Z", mfa: true, keys: [] },
  users: [
    {
      name: "park-ops", createdAt: "2019-08-12T09:00:00Z", console: true, passwordLastUsed: "2026-10-12T02:00:00Z", mfa: true,
      keys: [{ suffix: "A1B2", status: "Active", createdAt: "2019-08-12T09:00:00Z", lastUsed: "2026-10-15T01:00:00Z", usedRegion: KR, usedService: "ec2" }],
      policies: ["AdministratorAccess"], groups: [],
    },
    {
      name: "old-deploy", createdAt: "2020-03-02T05:00:00Z", console: false, passwordLastUsed: null, mfa: false,
      keys: [{ suffix: "C3D4", status: "Active", createdAt: "2020-03-02T05:00:00Z", lastUsed: "2025-12-01T00:00:00Z", usedRegion: US, usedService: "s3" }],
      policies: ["AmazonS3FullAccess"], groups: ["deployers"],
    },
    { name: "intern-2021", createdAt: "2021-06-01T00:00:00Z", console: true, passwordLastUsed: "2021-06-30T08:00:00Z", mfa: true, keys: [], policies: [], groups: [] },
  ],
  groups: [{ name: "deployers", policies: ["AmazonEC2ReadOnlyAccess"] }],
  roles: [
    supportRole,
    { name: "legacy-backup-partner", createdAt: "2019-07-01T00:00:00Z", trust: [{ aws: [`arn:aws:iam::${VENDOR}:root`] }] },   // 외부 계정을 ExternalId 없이 믿는다
  ],
  sgs: { [KR]: [web("sg-0b0b0b01", "oldshop-web"), office("sg-0b0b0b02", "198.51.100.0/24")], [US]: [dflt("sg-0b0b0b03", "vpc-0aa1")] },
  enis: { [KR]: [eni("eni-0b0e0001", ["sg-0b0b0b01"], true)], [US]: [] },
  accountPab: null,
  buckets: [
    // 2023-04 이전에 만든 버킷: 차단 설정이 없다 → 공개될 수 있는 상태(옛 버킷 힌트 + 이름 힌트 assets)
    bucket("amzn-s3-demo-oldshop-assets", "2019-06-10T00:00:00Z", { pab: null, ownership: null }),
    // 정적 웹사이트 + 공개 정책 → 주의(의도된 공개 후보)
    bucket("amzn-s3-demo-oldshop-site", "2020-01-15T00:00:00Z", { pab: null, policyPublic: true, ownership: null, website: true }),
    bucket("amzn-s3-demo-oldshop-backup", "2019-06-10T00:00:00Z", { policyPublic: false }),
  ],
  trails: [],
  faults: [],
};

/* ───────── C 아슬아슬상회: 사고 직전. 위험 위주 ───────── */
export const AWS_C: AwsCompany = {
  setId: "C", name: "아슬아슬상회", accountId: ACCOUNT,
  principal: { type: "user", name: "poc-admin" },
  collectedAt: COLLECTED, reportAt: REPORT_AT,
  regions: [KR, US],
  root: {
    createdAt: "2018-01-10T01:00:00Z", password: "not_supported", passwordLastUsed: "2026-10-01T09:00:00Z", mfa: false,
    keys: [{ suffix: "R00T", status: "Active", createdAt: "2019-02-01T00:00:00Z", lastUsed: "2026-10-10T00:00:00Z", usedRegion: US, usedService: "s3" }],
  },
  users: [
    {
      name: "dev-kim", createdAt: "2022-04-01T00:00:00Z", console: true, passwordLastUsed: "2026-10-17T06:00:00Z", mfa: false,
      keys: [{ suffix: "KM01", status: "Active", createdAt: "2025-12-01T00:00:00Z", lastUsed: "2026-10-17T05:00:00Z", usedRegion: KR, usedService: "s3" }],
      policies: [], groups: ["engineers"],
    },
    {
      name: "ci-runner", createdAt: "2021-09-01T00:00:00Z", console: false, passwordLastUsed: null, mfa: false,
      keys: [
        { suffix: "CI01", status: "Active", createdAt: "2024-01-10T05:00:00Z", lastUsed: "2026-10-18T22:00:00Z", usedRegion: KR, usedService: "s3" },
        { suffix: "CI02", status: "Active", createdAt: "2023-02-01T05:00:00Z", lastUsed: null },
      ],
      policies: [], groups: [],
    },
    {
      name: "admin-lee", createdAt: "2020-05-05T00:00:00Z", console: true, passwordLastUsed: "2026-10-18T10:00:00Z", mfa: true,
      keys: [{ suffix: "LE01", status: "Active", createdAt: "2025-03-03T00:00:00Z", lastUsed: "2026-10-19T01:00:00Z", usedRegion: KR, usedService: "iam" }],
      policies: ["AdministratorAccess"], groups: [],
    },
    { name: "ex-employee", createdAt: "2019-09-09T00:00:00Z", console: true, passwordLastUsed: "2022-05-05T00:00:00Z", mfa: false, keys: [], policies: [], groups: [] },
  ],
  groups: [{ name: "engineers", policies: ["PowerUserAccess"] }],
  roles: [
    supportRole,
    { name: "cross-acct-admin", createdAt: "2022-08-08T00:00:00Z", trust: [{ wildcard: true }] },                       // 아무나 이 역할로 전환할 수 있다
    { name: "vendor-access", createdAt: "2023-03-03T00:00:00Z", trust: [{ aws: [`arn:aws:iam::${VENDOR}:root`] }] },
  ],
  sgs: {
    [KR]: [
      { id: "sg-0c0ffee1", name: "bastion-ssh", vpcId: "vpc-0bb1", ingress: [{ protocol: "tcp", from: 22, to: 22 }] },
      { id: "sg-0c0ffee2", name: "rds-open", vpcId: "vpc-0bb1", ingress: [{ protocol: "tcp", from: 3306, to: 3306 }] },
      dflt("sg-0c0ffee3"),
    ],
    [US]: [dflt("sg-0c0ffee4", "vpc-0aa1")],
  },
  enis: { [KR]: [eni("eni-0c0f0001", ["sg-0c0ffee1"], true), eni("eni-0c0f0002", ["sg-0c0ffee2"], false)], [US]: [] },
  accountPab: PAB_OFF,
  buckets: [
    bucket("amzn-s3-demo-acme-customer-export", "2024-07-01T00:00:00Z", { pab: PAB_OFF, policyPublic: true }),
    bucket("amzn-s3-demo-acme-public-site", "2023-09-01T00:00:00Z", { pab: null, policyPublic: true, ownership: null, website: true }),
    bucket("amzn-s3-demo-acme-logs", "2024-01-15T00:00:00Z", { policyPublic: false }),
  ],
  trails: [{ ...mainTrail, logging: false }],
  faults: [],
};

/* ───────── D 반쯤본상회: 조회 권한이 모자라 반쯤만 본 회사. Organizations 멤버 계정, IAM 사용자 0명(Identity Center) ───────── */
export const AWS_D: AwsCompany = {
  setId: "D", name: "반쯤본상회", accountId: ACCOUNT,
  principal: { type: "assumed-role", name: "LimitedAudit" },
  collectedAt: COLLECTED, reportAt: REPORT_AT,
  skipDoors: ["log"],                                                                                              // --doors mfa,key,net,sto
  regions: [KR, "ap-southeast-1", US],
  root: { createdAt: "2024-11-02T00:00:00Z", password: "false", passwordLastUsed: null, mfa: false, keys: [] },      // 루트 자격증명이 없는 멤버 계정
  users: [], groups: [],
  roles: [lambdaRole, partnerRole, supportRole],
  sgs: { [KR]: [dflt("sg-0d0d0d01"), web("sg-0d0d0d02")], "ap-southeast-1": [dflt("sg-0d0d0d03", "vpc-0cc1")], [US]: [dflt("sg-0d0d0d04", "vpc-0aa1")] },
  enis: { [KR]: [eni("eni-0d0e0001", ["sg-0d0d0d02"], true)], "ap-southeast-1": [], [US]: [] },
  accountPab: PAB_ON,                                                                                              // 조회가 거부돼 파일에는 값이 없다
  buckets: [
    bucket("amzn-s3-demo-halfseen-alpha", "2024-05-01T00:00:00Z", { pab: null, policyPublic: false }),
    bucket("amzn-s3-demo-halfseen-beta", "2024-05-02T00:00:00Z", { pab: null, policyPublic: false }),
    bucket("amzn-s3-demo-halfseen-gamma", "2024-05-03T00:00:00Z", { region: "ap-southeast-1", pab: null, policyPublic: null }),
  ],
  trails: [],
  faults: [
    { call: "ec2:DescribeSecurityGroups", region: US, kind: "denied" },                                              // 리전 하나를 못 봄
    { call: "ec2:DescribeNetworkInterfaces", region: "ap-southeast-1", kind: "throttled" },
    { call: "iam:ListRoles", kind: "truncated", keep: 1 },                                                          // 목록이 잘림
    { call: "s3:GetAccountPublicAccessBlock", kind: "denied" },                                                    // 권한 하나로 두 점검이 막힘
    { call: "s3:GetBucketPolicyStatus", resource: "amzn-s3-demo-halfseen-beta", kind: "denied" },                  // 특정 버킷만 거부(INV-7)
    { call: "s3:GetBucketAcl", resource: "amzn-s3-demo-halfseen-gamma", kind: "ok-null" },                         // 응답에서 필드가 빠짐
  ],
};

export const AWS_COMPANIES = { A: AWS_A, B: AWS_B, C: AWS_C, D: AWS_D } as const;
