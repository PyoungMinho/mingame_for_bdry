// AWS-STO-2 버킷 공개 상태 — 창고 · priority 10 · 최고 위험
// 구성원: S3 버킷(aws.sto.buckets) + 필요한 패밀리: 계정 공개 차단 설정(aws.sto.account).
// 공개 차단 설정은 계정·버킷 값을 항목별로 합친다(가장 엄격한 쪽이 적용: Amazon S3 문서).
//  - 위험: 공개가 확인됨(정책 IsPublic=true 이거나 ACL이 AllUsers·AuthenticatedUsers에 권한) + 차단이 막지 않음 + 정적 웹사이트가 아님
//  - 주의: ① 정적 웹사이트 버킷이 공개됨(의도된 공개 후보) ② 공개는 아니지만 차단이 모두 꺼진 '공개 가능 상태' 또는 ACL 사용 중인데 IgnorePublicAcls가 꺼짐
//          ③ 공개 신호가 있으나 차단·웹사이트 여부를 확인하지 못함 ④ INV-7: 다른 버킷 조회는 성공했는데 이 버킷의 점검 조회만 거부됨(core)
//  - 이상 없음: 4개 차단이 모두 켜짐(계정 또는 버킷) / 공개가 아니고 ACL 공개 부여도 없고 '공개 가능 상태'도 아님
//  - 해당 없음: 버킷 0개(목록이 완결일 때)
// 이름 힌트(public·static·assets·cdn)와 생성 시기(2023-04 이전)는 라벨만 붙이고 판정은 바꾸지 않는다.
import type { AwsBucket, AwsPab, AwsStoData, Slot } from "../../contract/normalized";
import type { Ev, Member, RuleCtx, RuleLabel } from "../../engine/types";
import { LEGACY_BUCKET_BEFORE, NAME_HINTS } from "../params";
import { C, N, buildSpec, dateOf, defineRule, evs, fact, findings, inRegion, mCaution, mClear, mRisk, mUnknown, read, reasons, write, GLOBAL } from "../kit";
import { reasonOf } from "./creds";

const ID = "AWS-STO-2" as const;
const R = reasons(ID);
const F = findings(ID);
const DOC_BPA = "https://docs.aws.amazon.com/AmazonS3/latest/userguide/access-control-block-public-access.html";

export const spec = buildSpec({
  id: ID, door: "sto", maxStatus: "risk", allowsClear: true, priority: 10,
  cond: ["risk", "caution", "clear", "na", "unknown"], impact: true, question: true,
  paths: ["collector"],
  params: [
    { name: "name-hints", value: [...NAME_HINTS], basis: "tool-default" },
    { name: "legacy-before", value: LEGACY_BUCKET_BEFORE, basis: "tool-default" },
  ],
  cannotSee: 5, falsePositives: 3,
  fix: {
    impact: "medium", prodImpact: true,
    observe: {
      doc: DOC_BPA,
      commands: [
        read("aws", "aws s3api get-bucket-policy-status --bucket [[bucket-name]]"),
        read("aws", "aws s3api get-public-access-block --bucket [[bucket-name]]"),
      ],
    },
    change: {
      property: "BlockPublicAcls · IgnorePublicAcls · BlockPublicPolicy · RestrictPublicBuckets",
      doc: "https://docs.aws.amazon.com/AmazonS3/latest/userguide/configuring-block-public-access-bucket.html",
      commands: [write("aws", "aws s3api put-public-access-block --bucket [[bucket-name]] --public-access-block-configuration BlockPublicAcls=true,IgnorePublicAcls=true,BlockPublicPolicy=true,RestrictPublicBuckets=true")],
    },
    revert: { commands: [write("aws", "aws s3api put-public-access-block --bucket [[bucket-name]] --public-access-block-configuration [[previous-settings]]")] },
    runbook: null,
  },
  guide: null,
  basis: [
    { name: "block-public-access", url: DOC_BPA, kind: "doc" },
    { name: "bucket-setting", url: "https://docs.aws.amazon.com/AmazonS3/latest/userguide/configuring-block-public-access-bucket.html", kind: "doc" },
    { name: "static-website", url: "https://docs.aws.amazon.com/AmazonS3/latest/userguide/WebsiteHosting.html", kind: "doc" },
    { name: "object-ownership", url: "https://docs.aws.amazon.com/AmazonS3/latest/userguide/about-object-ownership.html", kind: "doc" },
  ],
  incident: null,
  lastVerified: "2026-10-19",
  families: { item: "aws.sto.buckets", needs: ["aws.sto.account"] },
  calls: [
    "s3:GetAccountPublicAccessBlock", "s3:ListAllMyBuckets", "s3:GetBucketLocation", "s3:GetBucketPublicAccessBlock", "s3:GetBucketPolicyStatus",
    "s3:GetBucketAcl", "s3:GetBucketOwnershipControls", "s3:GetBucketWebsite",
  ],
  isolatedDenial: ["s3:GetBucketPolicyStatus", "s3:GetBucketAcl", "s3:GetBucketPublicAccessBlock"],
  reasons: {
    "buckets-public": ["n"], "buckets-attention": ["n"], "all-private": ["n"], "na-no-buckets": [],
    "bucket-public-policy": [], "bucket-public-acl": [], "website-public": [], "public-unconfirmed": [],
    "public-possible": [], "acl-enabled": [], "block-all-on": [], "not-public": [],
  },
  facts: { "website-enabled": [], "policy-public": [], "acl-public-grant": ["grantee", "permission"], "block-off": [], "acl-in-use-bucket-owner-preferred": [], "acl-in-use-object-writer": [], "acl-in-use-unset": [], "acl-in-use-other": [], "created-date": ["d"] },
  how: true,
  fixtures: {
    pass: "micro/AWS-STO-2/pass",
    violate: ["micro/AWS-STO-2/public-policy", "micro/AWS-STO-2/website-public", "micro/AWS-STO-2/block-off"],
    denied: { call: "s3:GetBucketPolicyStatus", resource: "amzn-s3-demo-bucket-data", expect: "caution" },
    truncated: { call: "s3:ListAllMyBuckets", expect: "unknown" },
    missingField: { path: "doors.sto.data.buckets", expect: "unknown" },
    versionMismatch: "auto",
  },
});

type Tri = boolean | null;
const FLAGS = ["blockPublicAcls", "ignorePublicAcls", "blockPublicPolicy", "restrictPublicBuckets"] as const;
type Flag = (typeof FLAGS)[number];

/** 슬롯 → 플래그 값: 값이면 그 값, 설정 없음이면 모두 꺼짐, 답이 아니면 모름 */
const flagOf = (s: Slot<AwsPab>, f: Flag): Tri => (s.k === "value" ? s.value[f] : s.k === "none" ? false : null);
/** 계정·버킷 중 하나라도 켜져 있으면 켜짐(가장 엄격한 쪽), 둘 다 꺼짐이 확인돼야 꺼짐, 그 밖은 모름 */
function effective(acct: Slot<AwsPab>, bkt: Slot<AwsPab>, f: Flag): Tri {
  const a = flagOf(acct, f);
  const b = flagOf(bkt, f);
  if (a === true || b === true) return true;
  if (a === false && b === false) return false;
  return null;
}
const all = (xs: readonly Tri[]): Tri => (xs.every((x) => x === true) ? true : xs.some((x) => x === false) ? false : null);
const some = (xs: readonly Tri[]): Tri => (xs.some((x) => x === true) ? true : xs.every((x) => x === false) ? false : null);

function labelsOf(b: AwsBucket, website: Tri): RuleLabel[] {
  const out: RuleLabel[] = [];
  if (website === true) out.push({ kind: "intended-public-candidate", basis: "static-website" });
  const lower = b.name.toLowerCase();
  for (const hint of NAME_HINTS) if (lower.includes(hint)) { out.push({ kind: "name-hint", hint }); break; }
  if (b.createdAt !== null && b.createdAt.iso.slice(0, 10) < LEGACY_BUCKET_BEFORE) out.push({ kind: "legacy-hint", basis: "created-before-2023-04" });
  return out;
}

/** ACL을 쓰는 것으로 본 이유: 소유권 설정 값마다 따로 둔다(원시 값을 문장에 넣지 않는다 · 디자인 검수 K-5). 값 없음 = 설정 없음, 아는 값 밖 = 해석 못 함(둘 다 ACL을 쓰는 것으로 '봄') */
function aclInUseFact(own: AwsBucket["ownership"]) {
  if (own.k !== "value") return fact("acl-in-use-unset");
  switch (own.value.objectOwnership) {
    case "ObjectWriter": return fact("acl-in-use-object-writer");
    case "BucketOwnerPreferred": return fact("acl-in-use-bucket-owner-preferred");
    default: return fact("acl-in-use-other");
  }
}

function evalBucket(b: AwsBucket, acct: Slot<AwsPab>): Member {
  const where = b.region.k === "value" ? inRegion(b.region.value) : GLOBAL;
  // S3 버킷 이름은 전역에서 유일하다: MatchKey에는 리전을 넣지 않는다(리전 조회가 실패해도 같은 키 — CC-QA-16). 화면의 위치는 where(리전)를 그대로 보인다
  const res = { type: "s3-bucket" as const, name: { type: "resourceName" as const, value: b.name }, where, keyWhere: GLOBAL, id: b.name };
  const pol = b.policyStatus;
  const acl = b.acl;
  const own = b.ownership;
  const web = b.website;

  const eff = (f: Flag): Tri => effective(acct, b.publicAccessBlock, f);
  const all4 = all(FLAGS.map(eff));
  const anyOn = some(FLAGS.map(eff));
  const ignoreAcls = eff("ignorePublicAcls");
  const restrict = eff("restrictPublicBuckets");

  const polPublic: Tri = pol.k === "value" ? pol.value.isPublic : pol.k === "none" ? false : null;
  const aclGrants = acl.k === "value" ? acl.value.publicGrants : null;
  const aclPublic: Tri = aclGrants === null ? null : aclGrants.length > 0;
  const website: Tri = web.k === "value" ? true : web.k === "none" ? false : null;

  const polExposed: Tri = polPublic === true ? (restrict === false ? true : restrict === true ? false : null) : polPublic;
  const aclExposed: Tri = aclPublic === true ? (ignoreAcls === false ? true : ignoreAcls === true ? false : null) : aclPublic;

  const allEv: Ev[] = evs(b.src, acct.src, b.publicAccessBlock.src, pol.src, acl.src, own.src, web.src);
  const facts = [
    ...(website === true ? [fact("website-enabled")] : []),
    ...(polPublic === true ? [fact("policy-public")] : []),
    ...(aclGrants ?? []).slice(0, 2).map((g) => fact("acl-public-grant", { grantee: C(g.grantee), permission: C(g.permission) })),
    ...(anyOn === false ? [fact("block-off")] : []),
    ...(b.createdAt === null ? [] : [fact("created-date", { d: { d: dateOf(b.createdAt) } })]),
  ];
  const withLabels = (labels: RuleLabel[]) => ({ facts, labels });
  const labels = labelsOf(b, website);

  // 4개 차단이 모두 켜져 있으면 공개될 수 없다. 버킷 자신의 차단이 4개 모두 켜져 있으면 계정 설정은 필요 없다(계정 조회가 거부돼도 결론은 같다)
  if (all4 === true) {
    const bucketAlone = FLAGS.every((f) => flagOf(b.publicAccessBlock, f) === true);
    return mClear(res, R("block-all-on"), bucketAlone ? evs(b.publicAccessBlock.src, b.src) : evs(acct.src, b.publicAccessBlock.src, b.src), { facts });
  }

  // 공개가 확인되고 차단이 막지 않음
  if (polExposed === true || aclExposed === true) {
    if (website === true) return mCaution(res, F("website-public"), allEv, withLabels(labels));
    if (website === false) return mRisk(res, F(polExposed === true ? "bucket-public-policy" : "bucket-public-acl"), allEv, withLabels(labels));
    return mCaution(res, F("public-unconfirmed"), allEv, withLabels(labels));
  }
  // 공개 신호는 있는데 차단 설정을 확인하지 못함
  if ((polPublic === true && polExposed === null) || (aclPublic === true && aclExposed === null)) {
    return mCaution(res, F("public-unconfirmed"), allEv, withLabels(labels));
  }

  // 지금 공개는 아니지만 공개될 수 있는 상태
  const aclsEnabled: Tri = own.k === "value" ? own.value.objectOwnership !== "BucketOwnerEnforced" : own.k === "none" ? true : null;
  if (anyOn === false) return mCaution(res, F("public-possible"), allEv, withLabels(labels));
  const aclRisk: Tri = aclsEnabled === true ? (ignoreAcls === false ? true : ignoreAcls === true ? false : null) : aclsEnabled === false ? false : null;
  if (aclRisk === true) {
    return mCaution(res, F("acl-enabled"), allEv, { facts: [...facts, aclInUseFact(own)], labels });
  }

  // 여기까지 오면 판단에 필요한 사실이 모두 답이어야 이상 없음
  const needed: readonly Slot<unknown>[] = [pol, acl, own, b.publicAccessBlock, acct];
  const bad = needed.find((s) => s.k === "missing" || s.k === "partial");
  if (bad !== undefined || polExposed === null || aclExposed === null || anyOn === null || aclRisk === null) {
    return mUnknown(res, bad === undefined ? "value-unrecognized" : reasonOf(bad), allEv, { facts, labels });
  }
  return mClear(res, R("not-public"), allEv, { facts });
}

function evaluate(ctx: RuleCtx<AwsStoData>) {
  const buckets = ctx.data.buckets;
  if (buckets.k !== "value" && buckets.k !== "partial") return { members: [] as Member[], coverage: ctx.scope };
  return { members: buckets.value.map((b) => evalBucket(b, ctx.data.accountPublicAccessBlock)), coverage: ctx.scope };
}

export const AWS_STO_2 = defineRule<"aws", "sto">({
  spec, evaluate,
  explain: (x) => {
    if (x.status === "na") return { msg: R("na-no-buckets") };
    if (x.status === "clear") return { msg: R("all-private", { n: N(x.applicable ?? x.members.length) }) };
    return { msg: x.status === "risk" ? R("buckets-public", { n: N(x.members.length) }) : R("buckets-attention", { n: N(x.members.length) }) };
  },
});
