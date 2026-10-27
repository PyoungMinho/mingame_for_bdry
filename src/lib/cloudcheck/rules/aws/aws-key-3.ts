// AWS-KEY-3 관리자 권한 액세스 키 — 열쇠 · priority 100 · 최고 주의(이상 없음 없음)
// 구성원: IAM 사용자(aws.key.users). 적용 대상 = 관리자급 관리형 정책이 직접 또는 그룹으로 붙어 있고 활성 액세스 키가 있는 사용자.
//  - 주의: 위 조건에 해당(IP 제한·임시 자격증명 전환을 권장. 이 도구는 정책 조건을 해석하지 않는다)
//  - 제외: 활성 키가 없거나 관리자급 정책이 없는 사용자. 전원 제외되면 해당 없음. 이상 없음은 주지 않는다(allowsClear = false).
//  - 관리자급: AdministratorAccess · PowerUserAccess · IAMFullAccess · AWSOrganizationsFullAccess (params.ts에 검토 근거)
import type { AwsIamUser, AwsKeyData } from "../../contract/normalized";
import type { Member, RuleCtx } from "../../engine/types";
import { ADMIN_POLICY_NAMES } from "../params";
import { C, buildSpec, defineRule, evs, fact, findings, iamUserRes, mCaution, mExcluded, mUnknown, N, read, reasons, write, reuseWhy } from "../kit";
import { awsManagedPolicyName, keyFact, reasonOf } from "./creds";

const ID = "AWS-KEY-3" as const;
const R = reasons(ID);
const F = findings(ID);

export const spec = buildSpec({
  id: ID, door: "key", maxStatus: "caution", allowsClear: false, priority: 100,
  cond: ["caution", "na", "unknown"], impact: true, question: true,
  paths: ["collector"],
  params: [{ name: "admin-policies", value: [...ADMIN_POLICY_NAMES], basis: "tool-default" }],
  cannotSee: 3, falsePositives: 2,
  fix: {
    impact: "high", prodImpact: true,
    observe: {
      doc: "https://docs.aws.amazon.com/IAM/latest/UserGuide/id_credentials_finding-unused.html",
      commands: [
        read("aws", "aws iam list-attached-user-policies --user-name [[user-name]]"),
        read("aws", "aws iam list-groups-for-user --user-name [[user-name]]"),
      ],
    },
    change: {
      property: "Access key use restriction (aws:SourceIp) · temporary credentials",
      doc: "https://docs.aws.amazon.com/IAM/latest/UserGuide/access-keys_inline-policy.html",
      commands: [write("aws", "aws iam update-access-key --user-name [[user-name]] --access-key-id [[access-key-id]] --status Inactive")],
    },
    revert: { commands: [write("aws", "aws iam update-access-key --user-name [[user-name]] --access-key-id [[access-key-id]] --status Active")] },
    runbook: null,
  },
  guide: null,
  basis: [
    { name: "restrict-key-use", url: "https://docs.aws.amazon.com/IAM/latest/UserGuide/access-keys_inline-policy.html", kind: "doc" },
    { name: "deny-source-ip", url: "https://docs.aws.amazon.com/IAM/latest/UserGuide/reference_policies_examples_aws_deny-ip.html", kind: "doc" },
    { name: "iam-best-practices", url: "https://docs.aws.amazon.com/IAM/latest/UserGuide/best-practices.html", kind: "doc" },
  ],
  incident: null,
  lastVerified: "2026-10-19",
  families: { item: "aws.key.users", needs: ["aws.key.access-keys"] },
  calls: ["iam:ListUsers", "iam:ListAccessKeys", "iam:ListAttachedUserPolicies", "iam:ListGroupsForUser", "iam:ListAttachedGroupPolicies"],
  reasons: {
    "admin-users-with-keys": ["n"], "na-no-admin-keys": [],
    "admin-active-key": [], "user-no-active-key": [], "user-not-admin": [],
  },
  facts: { "admin-policy": ["policy"], "admin-policy-group": ["policy", "group"], "key-suffix": ["suffix"], "key-slot": ["slot"] },
  how: true,
  fixtures: {
    pass: "micro/AWS-KEY-3/pass",
    violate: ["micro/AWS-KEY-3/admin-key"],
    denied: { call: "iam:ListAttachedUserPolicies", resource: "alice", expect: "unknown" },
    truncated: { call: "iam:ListUsers", expect: "unknown" },
    missingField: { path: "doors.key.data.users", expect: "unknown" },
    versionMismatch: "auto",
  },
});

function adminPolicyNames(arns: readonly string[]): string[] {
  return arns.map(awsManagedPolicyName).filter((n): n is string => n !== null && ADMIN_POLICY_NAMES.includes(n));
}

function evalUser(data: AwsKeyData, u: AwsIamUser): Member {
  const res = iamUserRes(u.name);
  const keys = u.keys;
  const keyList = keys.k === "value" || keys.k === "partial" ? keys.value : null;
  const activeKeys = keyList === null ? [] : keyList.filter((k) => k.active.k === "value" && k.active.value);

  // 활성 키가 없음이 확인되면 정책을 볼 필요가 없다
  if (keys.k === "value" && keyList !== null && keyList.every((k) => k.active.k === "value") && activeKeys.length === 0) {
    return mExcluded(res, R("user-no-active-key"), evs(keys.src, ...keyList.map((k) => k.active.src)));
  }

  // 관리자급 정책: 직접 + 그룹
  const direct = u.attachedPolicyArns;
  const names = u.groupNames;
  const found: { policy: string; group: string | null }[] = [];
  let infoGap: ReturnType<typeof reasonOf> | null = null;
  const srcs = [direct.src, names.src];
  if (direct.k === "value" || direct.k === "partial") for (const p of adminPolicyNames(direct.value)) found.push({ policy: p, group: null });
  if (direct.k !== "value") infoGap = reasonOf(direct);
  if (names.k === "value" || names.k === "partial") {
    for (const gName of names.value) {
      const g = data.groups.find((x) => x.name === gName);
      if (g === undefined) { infoGap = infoGap ?? "field-missing"; continue; }
      srcs.push(g.attachedPolicyArns.src);
      if (g.attachedPolicyArns.k === "value" || g.attachedPolicyArns.k === "partial") for (const p of adminPolicyNames(g.attachedPolicyArns.value)) found.push({ policy: p, group: gName });
      if (g.attachedPolicyArns.k !== "value") infoGap = infoGap ?? reasonOf(g.attachedPolicyArns);
    }
  }
  if (names.k !== "value") infoGap = infoGap ?? reasonOf(names);

  if (found.length > 0) {
    if (activeKeys.length > 0) {
      const facts = [
        ...found.slice(0, 3).map((f) => (f.group === null ? fact("admin-policy", { policy: C(f.policy) }) : fact("admin-policy-group", { policy: C(f.policy), group: { raw: { type: "groupName", value: f.group } } }))),
        ...activeKeys.slice(0, 2).map((k) => keyFact(k)),
      ];
      return mCaution(res, F("admin-active-key"), evs(...srcs, ...activeKeys.map((k) => k.active.src)), { facts });
    }
    // 관리자급 정책은 확인됐는데 활성 키 여부를 모른다
    return mUnknown(res, keys.k === "value" ? "value-unrecognized" : reasonOf(keys), evs(...srcs, keys.src));
  }
  if (infoGap !== null) return mUnknown(res, infoGap, evs(...srcs));
  if (keys.k !== "value") return mUnknown(res, reasonOf(keys), evs(...srcs, keys.src));
  return mExcluded(res, R("user-not-admin"), evs(...srcs));
}

function evaluate(ctx: RuleCtx<AwsKeyData>) {
  const users = ctx.data.users;
  if (users.k !== "value" && users.k !== "partial") return { members: [] as Member[], coverage: ctx.scope };
  return { members: users.value.map((u) => evalUser(ctx.data, u)), coverage: ctx.scope };
}

export const AWS_KEY_3 = defineRule<"aws", "key">({
  spec, evaluate,
  explain: (x) => (x.status === "na" ? { msg: R("na-no-admin-keys") } : x.status === "caution" ? { msg: R("admin-users-with-keys", { n: N(x.members.length) }) } : { msg: reuseWhy(x.members[0]) }),
});
