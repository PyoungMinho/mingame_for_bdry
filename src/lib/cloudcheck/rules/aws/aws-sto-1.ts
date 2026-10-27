// AWS-STO-1 계정 전체 퍼블릭 액세스 차단 설정 — 창고 · priority 140 · 최고 주의
// 구성원: 계정 1개(aws.sto.account). 'NoSuchPublicAccessBlockConfiguration'(설정 없음)은 유효한 답이다(INV-6): 주의.
import type { AwsStoData } from "../../contract/normalized";
import type { Member, RuleCtx } from "../../engine/types";
import { awsAccountRes, buildSpec, defineRule, ev, fact, findings, read, reasons, reuseWhy, write, mCaution, mClear, mUnknown } from "../kit";

const ID = "AWS-STO-1" as const;
const R = reasons(ID);
const F = findings(ID);
const PAB = ["BlockPublicAcls", "IgnorePublicAcls", "BlockPublicPolicy", "RestrictPublicBuckets"] as const;
const KEYS = { BlockPublicAcls: "blockPublicAcls", IgnorePublicAcls: "ignorePublicAcls", BlockPublicPolicy: "blockPublicPolicy", RestrictPublicBuckets: "restrictPublicBuckets" } as const;

export const spec = buildSpec({
  id: ID, door: "sto", maxStatus: "caution", allowsClear: true, priority: 140,
  cond: ["caution", "clear", "unknown"], impact: true, question: true,
  paths: ["collector"],
  params: [],
  cannotSee: 3, falsePositives: 2,
  fix: {
    impact: "medium", prodImpact: true,
    observe: { doc: "https://docs.aws.amazon.com/AmazonS3/latest/userguide/access-control-block-public-access.html", commands: [read("aws", "aws s3control get-public-access-block --account-id [[account-id]]")] },
    change: {
      property: "BlockPublicAcls · IgnorePublicAcls · BlockPublicPolicy · RestrictPublicBuckets",
      doc: "https://docs.aws.amazon.com/AmazonS3/latest/userguide/configuring-block-public-access-account.html",
      commands: [write("aws", "aws s3control put-public-access-block --account-id [[account-id]] --public-access-block-configuration BlockPublicAcls=true,IgnorePublicAcls=true,BlockPublicPolicy=true,RestrictPublicBuckets=true")],
    },
    revert: { commands: [
      write("aws", "aws s3control put-public-access-block --account-id [[account-id]] --public-access-block-configuration [[previous-settings]]"),
      write("aws", "aws s3control delete-public-access-block --account-id [[account-id]]"),
    ] },
    runbook: null,
  },
  guide: null,
  basis: [
    { name: "block-public-access", url: "https://docs.aws.amazon.com/AmazonS3/latest/userguide/access-control-block-public-access.html", kind: "doc" },
    { name: "account-setting", url: "https://docs.aws.amazon.com/AmazonS3/latest/userguide/configuring-block-public-access-account.html", kind: "doc" },
  ],
  incident: null,
  lastVerified: "2026-10-19",
  families: { item: "aws.sto.account", needs: [] },
  calls: ["s3:GetAccountPublicAccessBlock"],
  reasons: { "block-partial": [], "no-config": [], "all-blocked": [] },
  facts: { "pab-on": ["name"], "pab-off": ["name"] },
  how: true,
  fixtures: {
    pass: "micro/AWS-STO-1/pass",
    violate: ["micro/AWS-STO-1/partial", "micro/AWS-STO-1/no-config"],
    denied: { call: "s3:GetAccountPublicAccessBlock", expect: "unknown" },
    truncated: { na: "단건 조회라 목록 잘림이 없다" },
    missingField: { path: "doors.sto.data.accountPublicAccessBlock", expect: "unknown" },
    versionMismatch: "auto",
  },
});

function evaluate(ctx: RuleCtx<AwsStoData>) {
  const slot = ctx.data.accountPublicAccessBlock;
  const res = awsAccountRes(ctx.accountId);
  const members: Member[] = [];
  if (slot.k === "value") {
    const p = slot.value;
    const facts = PAB.map((name) => fact(p[KEYS[name]] ? "pab-on" : "pab-off", { name: { c: name } }));
    const observed = PAB.map((name) => ({ field: name, value: String(p[KEYS[name]]) }));
    const off = PAB.filter((name) => !p[KEYS[name]]);
    members.push(off.length === 0
      ? mClear(res, R("all-blocked"), ev(slot.src, observed), { facts })
      : mCaution(res, F("block-partial"), ev(slot.src, observed), { facts }));
  } else if (slot.k === "none") {
    members.push(mCaution(res, F("no-config"), ev(slot.src)));
  } else {
    members.push(mUnknown(res, slot.why, ev(slot.src)));
  }
  return { members, coverage: ctx.scope };
}

export const AWS_STO_1 = defineRule<"aws", "sto">({
  spec, evaluate,
  explain: (x) => ({ msg: reuseWhy(x.members[0]) }),
});
