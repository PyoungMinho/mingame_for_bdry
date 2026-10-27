// micro/AWS-STO-1 · AWS-STO-2 — 계정 공개 차단 설정 + 버킷
import type { AwsBucket, AwsNormalizedInput, AwsPab, Slot } from "../../contract/normalized";
import { MicroAws, byReceipt, inst, miss, none, val } from "./kit";

export const PAB_ON: AwsPab = { blockPublicAcls: true, ignorePublicAcls: true, blockPublicPolicy: true, restrictPublicBuckets: true };
export const PAB_OFF: AwsPab = { blockPublicAcls: false, ignorePublicAcls: false, blockPublicPolicy: false, restrictPublicBuckets: false };

export interface BucketSpec {
  readonly name: string;
  readonly region?: string;
  readonly createdAt?: string;
  /** 버킷 공개 차단: 'on' | 'off' | 'none'(설정 없음) | 부분 값 */
  readonly pab?: "on" | "off" | "none" | AwsPab;
  /** 정책 상태: true/false(IsPublic) | 'none'(정책 없음) */
  readonly policy?: boolean | "none";
  readonly aclPublic?: readonly { grantee: "AllUsers" | "AuthenticatedUsers"; permission: string }[];
  readonly ownership?: string | "none";
  readonly website?: boolean;
  /** 버킷 리전 조회에 실패했다(리전 칸이 값 없음). 대상의 MatchKey는 달라지면 안 된다 */
  readonly regionUnknown?: boolean;
}
export interface StoWorld {
  readonly account: "on" | "off" | "none" | AwsPab;
  readonly buckets: readonly BucketSpec[];
}

const pabOf = (v: "on" | "off" | AwsPab): AwsPab => (v === "on" ? PAB_ON : v === "off" ? PAB_OFF : v);

export function stoWorld(w: StoWorld): { readonly m: MicroAws; build: () => AwsNormalizedInput } {
  const m = new MicroAws();
  const acct = m.rc("s3:GetAccountPublicAccessBlock", w.account === "none" ? "notconfigured" : "ok", w.account === "none" ? { errorCode: "NoSuchPublicAccessBlockConfiguration" } : {});
  const list = m.rc("s3:ListAllMyBuckets", w.buckets.length === 0 ? "empty" : "ok", { count: w.buckets.length });
  const buckets: AwsBucket[] = w.buckets.map((b) => {
    const region = b.region ?? "ap-northeast-2";
    const o = { region, resource: b.name };
    const kPab = m.rc("s3:GetBucketPublicAccessBlock", (b.pab ?? "on") === "none" ? "notconfigured" : "ok", (b.pab ?? "on") === "none" ? { ...o, errorCode: "NoSuchPublicAccessBlockConfiguration" } : o);
    const kPol = m.rc("s3:GetBucketPolicyStatus", b.policy === "none" || b.policy === undefined ? "notconfigured" : "ok", b.policy === "none" || b.policy === undefined ? { ...o, errorCode: "NoSuchBucketPolicy" } : o);
    const kAcl = m.rc("s3:GetBucketAcl", "ok", o);
    const kOwn = m.rc("s3:GetBucketOwnershipControls", b.ownership === "none" ? "notconfigured" : "ok", b.ownership === "none" ? { ...o, errorCode: "OwnershipControlsNotFoundError" } : o);
    const kWeb = m.rc("s3:GetBucketWebsite", b.website === true ? "ok" : "notconfigured", b.website === true ? o : { ...o, errorCode: "NoSuchWebsiteConfiguration" });
    const pab: Slot<AwsPab> = (b.pab ?? "on") === "none" ? none(byReceipt(kPab)) : val(pabOf(b.pab as "on" | "off" | AwsPab ?? "on"), byReceipt(kPab));
    return {
      src: byReceipt(list), name: b.name, createdAt: inst(b.createdAt ?? "2024-05-01T00:00:00Z"),
      region: b.regionUnknown === true ? miss<string>("field-missing", byReceipt(list)) : val(region, byReceipt(list)),
      publicAccessBlock: pab,
      policyStatus: b.policy === "none" || b.policy === undefined ? none(byReceipt(kPol)) : val({ isPublic: b.policy }, byReceipt(kPol)),
      acl: val({ publicGrants: [...(b.aclPublic ?? [])] }, byReceipt(kAcl)),
      ownership: b.ownership === "none" ? none(byReceipt(kOwn)) : val({ objectOwnership: b.ownership ?? "BucketOwnerEnforced" }, byReceipt(kOwn)),
      website: b.website === true ? val({ enabled: true as const }, byReceipt(kWeb)) : none(byReceipt(kWeb)),
    };
  });
  m.sto({
    accountPublicAccessBlock: w.account === "none" ? none(byReceipt(acct)) : val(pabOf(w.account), byReceipt(acct)),
    buckets: val(buckets, byReceipt(list)),
  });
  m.prove("aws.sto.account", { present: 1, receipts: [acct] });
  m.prove("aws.sto.buckets", { present: buckets.length, receipts: [list] });
  return { m, build: () => m.build() };
}

/* ───── AWS-STO-1 ───── */
export const sto1 = {
  pass: (): AwsNormalizedInput => stoWorld({ account: "on", buckets: [] }).build(),
  partial: (): AwsNormalizedInput => stoWorld({ account: { ...PAB_ON, restrictPublicBuckets: false, blockPublicPolicy: false }, buckets: [] }).build(),
  noConfig: (): AwsNormalizedInput => stoWorld({ account: "none", buckets: [] }).build(),
};

/* ───── AWS-STO-2 ───── */
const logs: BucketSpec = { name: "amzn-s3-demo-bucket-logs", pab: "on", policy: false };
export const sto2 = {
  /** 차단 4개가 켜진 버킷 + 정책이 공개가 아니고 ACL 공개 부여도 없는 버킷(계정 차단은 일부만) */
  pass: (): AwsNormalizedInput => stoWorld({
    account: { ...PAB_ON, blockPublicAcls: false },
    buckets: [logs, { name: "amzn-s3-demo-bucket-data", pab: { ...PAB_ON, blockPublicAcls: false }, policy: false }],
  }).build(),
  publicPolicy: (): AwsNormalizedInput => stoWorld({ account: "off", buckets: [{ name: "amzn-s3-demo-bucket-open", pab: "off", policy: true }, logs] }).build(),
  publicAcl: (): AwsNormalizedInput => stoWorld({
    account: "off", buckets: [{ name: "amzn-s3-demo-bucket-acl", pab: "off", policy: false, ownership: "ObjectWriter", aclPublic: [{ grantee: "AllUsers", permission: "READ" }] }],
  }).build(),
  websitePublic: (): AwsNormalizedInput => stoWorld({ account: "off", buckets: [{ name: "amzn-s3-demo-bucket-site", pab: "off", policy: true, website: true }] }).build(),
  blockOff: (): AwsNormalizedInput => stoWorld({ account: "none", buckets: [{ name: "amzn-s3-demo-bucket-legacy", pab: "none", policy: false, createdAt: "2019-03-01T00:00:00Z" }] }).build(),
  /** 공개 정책이 있지만 RestrictPublicBuckets가 막는다(계정 차단 4개 모두 켜져 있지는 않음) */
  policyRestricted: (): AwsNormalizedInput => stoWorld({
    account: "none", buckets: [{ name: "amzn-s3-demo-bucket-restricted", pab: { ...PAB_OFF, restrictPublicBuckets: true, blockPublicPolicy: true }, policy: true }],
  }).build(),
  empty: (): AwsNormalizedInput => stoWorld({ account: "on", buckets: [] }).build(),
  /** 버킷 리전 조회에 실패했다: 판정은 그대로, 대상의 MatchKey도 그대로여야 한다(S3 버킷 이름은 전역에서 유일 — CC-QA-16) */
  regionUnknown: (): AwsNormalizedInput => stoWorld({ account: "off", buckets: [{ name: "amzn-s3-demo-bucket-open", pab: "off", policy: true, regionUnknown: true }, logs] }).build(),
  aclEnabled: (): AwsNormalizedInput => stoWorld({
    account: "none", buckets: [{ name: "amzn-s3-demo-bucket-acls", pab: { ...PAB_OFF, blockPublicPolicy: true }, policy: false, ownership: "ObjectWriter" }],
  }).build(),
  /** 소유권 설정이 BucketOwnerPreferred(ACL 사용) · 설정 없음(옛 기본) · 모르는 값: 사실 문구가 값마다 따로 나간다(디자인 검수 K-5) */
  aclEnabledPreferred: (): AwsNormalizedInput => stoWorld({
    account: "none", buckets: [{ name: "amzn-s3-demo-bucket-acls", pab: { ...PAB_OFF, blockPublicPolicy: true }, policy: false, ownership: "BucketOwnerPreferred" }],
  }).build(),
  aclEnabledUnset: (): AwsNormalizedInput => stoWorld({
    account: "none", buckets: [{ name: "amzn-s3-demo-bucket-acls", pab: { ...PAB_OFF, blockPublicPolicy: true }, policy: false, ownership: "none" }],
  }).build(),
  aclEnabledOther: (): AwsNormalizedInput => stoWorld({
    account: "none", buckets: [{ name: "amzn-s3-demo-bucket-acls", pab: { ...PAB_OFF, blockPublicPolicy: true }, policy: false, ownership: "SomethingNew" }],
  }).build(),
};
