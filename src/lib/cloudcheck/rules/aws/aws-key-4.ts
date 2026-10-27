// AWS-KEY-4 역할 신뢰 설정(외부 계정) — 열쇠 · priority 50 · 최고 위험
// 구성원: IAM 역할(서비스 연결 역할 포함, aws.key.roles). 서비스 연결 역할은 제외.
//  - 위험: 신뢰 정책(Allow)의 Principal이 '*'(또는 NotPrincipal)이고 Condition이 없음
//  - 주의: Principal '*'인데 Condition이 있음 / 자기 계정이 아닌 AWS 계정을 신뢰하면서 sts:ExternalId 조건이 없음.
//          aws:PrincipalOrgID · aws:SourceAccount 같은 조직·계정 조건이 있으면 주의는 유지하되 완화형 사유 코드를 쓴다.
//  - 제외: 서비스 주체(Service)·자기 계정만 신뢰하는 부분. 연합(Federated)은 보지 않는다(나중 범위).
//  - 이상 없음: 위에 걸리는 외부 주체가 없음
//  - 모르는 값은 건너뛰지 않는다(P3, CC-QA-05): Effect가 Allow · Deny(앞뒤 공백·대소문자는 무시) 밖이면 그 문장은 해석 불가, 형식 밖 Action 토큰('서비스:동작'이 아닌 것)은 역할 맡기를 덮는 것으로 본다,
//    Principal AWS 목록에 '*'가 있으면 와일드카드 플래그와 무관하게 와일드카드, 신뢰 문장이 0개인 역할은 해석 불가(AWS가 만들 수 없는 모양).
//    ExternalId 보호는 값이 맞아야 통과하는 연산자(StringEquals · StringEqualsIgnoreCase · StringLike, ForAnyValue: 접두 허용)만 인정한다. 부정형(StringNot…) · Null · …IfExists · ForAllValues는 보호가 아니다.
import type { AwsIamRole, AwsKeyData, AwsTrustStatement } from "../../contract/normalized";
import type { Ev, Member, RMsg, RuleCtx } from "../../engine/types";
import type { FactCode } from "../../model/report";
import { N, buildSpec, defineRule, evs, fact, findings, mCaution, mClear, mExcluded, mRisk, mUnknown, read, reasons, write } from "../kit";
import { reasonOf } from "./creds";

const ID = "AWS-KEY-4" as const;
const R = reasons(ID);
const F = findings(ID);

export const spec = buildSpec({
  id: ID, door: "key", maxStatus: "risk", allowsClear: true, priority: 50,
  cond: ["risk", "caution", "clear", "na", "unknown"], impact: true, question: true,
  paths: ["collector"],
  params: [],
  cannotSee: 4, falsePositives: 3,
  fix: {
    impact: "high", prodImpact: true,
    observe: {
      doc: "https://docs.aws.amazon.com/IAM/latest/UserGuide/id_roles_common-scenarios_third-party.html",
      commands: [read("aws", "aws iam get-role --role-name [[role-name]]")],
    },
    change: {
      property: "AssumeRolePolicyDocument (Principal · Condition sts:ExternalId)",
      doc: "https://docs.aws.amazon.com/IAM/latest/UserGuide/id_roles_common-scenarios_third-party.html",
      commands: [write("aws", "aws iam update-assume-role-policy --role-name [[role-name]] --policy-document file://[[trust-policy-file]]")],
    },
    revert: { commands: [write("aws", "aws iam update-assume-role-policy --role-name [[role-name]] --policy-document file://[[previous-trust-policy-file]]")] },
    runbook: null,
  },
  guide: null,
  basis: [
    { name: "third-party-external-id", url: "https://docs.aws.amazon.com/IAM/latest/UserGuide/id_roles_common-scenarios_third-party.html", kind: "doc" },
    { name: "confused-deputy", url: "https://docs.aws.amazon.com/IAM/latest/UserGuide/confused-deputy.html", kind: "doc" },
  ],
  incident: null,
  lastVerified: "2026-10-19",
  families: { item: "aws.key.roles", needs: [] },
  calls: ["iam:ListRoles"],
  reasons: {
    "roles-open": ["n"], "roles-external": ["n"], "no-external-trust": ["n"], "na-no-custom-roles": [],
    "trust-wildcard-open": [], "trust-wildcard-conditioned": [], "trust-wildcard-org-condition": [],
    "trust-external-no-external-id": [], "trust-external-org-condition": [], "trust-ok": [], "role-service-linked": [],
  },
  facts: { "trust-principal": ["principal"], "trust-wildcard": [], "trust-canonical-user": [] },
  how: true,
  fixtures: {
    pass: "micro/AWS-KEY-4/pass",
    violate: ["micro/AWS-KEY-4/wildcard", "micro/AWS-KEY-4/external-no-external-id"],
    denied: { call: "iam:ListRoles", expect: "unknown" },
    truncated: { call: "iam:ListRoles", expect: "unknown" },
    missingField: { path: "doors.key.data.roles", expect: "unknown" },
    versionMismatch: "auto",
  },
});

/** 역할을 맡기는 액션(소문자). 신뢰 문장의 Action이 이 중 하나라도 덮으면 그 문장을 본다 */
const ASSUME_ACTIONS = ["sts:assumerole", "sts:assumerolewithsaml", "sts:assumerolewithwebidentity"] as const;
/**
 * 액션 패턴(IAM 와일드카드 * ?)이 역할 맡기 액션을 덮는가. "sts:Assume*"·"sts:AssumeRole*"·"*" 같은 와일드카드도 덮는다.
 * '서비스:동작' 모양이 아닌 토큰('zzz'·'Allowed'·빈 값 …)은 덮는 것으로 본다 — 문장을 건너뛰어 이상 없음이 되는 fail-open을 막는다(2026-10-19 백엔드팀장, CC-QA-05)
 */
function coversAssume(action: string): boolean {
  const a = action.trim().toLowerCase();
  if (a === "*") return true;
  if (!/^[a-z0-9-]+:[a-z0-9*?]+$/.test(a)) return true;
  const re = new RegExp(`^${a.replace(/\*/g, ".*").replace(/\?/g, ".")}$`);
  return ASSUME_ACTIONS.some((x) => re.test(x));
}
const ORG_COND = /(^|:)aws:(principalorgid|principalorgpaths|sourceaccount|sourceorgid|sourceorgpaths)$/i;
/** ExternalId를 '값이 맞아야 통과'로 요구하는 조건 키("<연산자>:sts:ExternalId"). 부정형 · Null · IfExists · ForAllValues는 보호가 아니다 */
const EXTERNAL_ID = /^(forAnyValue:)?(stringequals|stringequalsignorecase|stringlike):sts:externalid$/i;
const UNIQUE_ID = /^A(ID|RO)A[A-Z0-9]{12,}$/;

function accountOf(p: string): string | null {
  if (/^\d{12}$/.test(p)) return p;
  const m = /^arn:aws[a-z-]*:(?:iam|sts)::(\d{12}):/.exec(p);          // 사용자 · 역할 · 루트(iam)와 역할 세션(sts) ARN 모두 계정 번호가 같은 자리에 있다
  return m === null ? null : m[1];
}

type Finding =
  | { readonly level: "risk"; readonly slug: string; readonly facts: RMsg<FactCode>[] }
  | { readonly level: "caution"; readonly slug: string; readonly facts: RMsg<FactCode>[] }
  | { readonly level: "unrecognized" };

function evalStatement(st: AwsTrustStatement, accountId: string): Finding[] {
  const effect = st.effect.trim().toLowerCase();
  if (effect === "deny") return [];
  if (effect !== "allow") return [{ level: "unrecognized" }];          // 모르는 Effect(Permit · 빈 값 …): 건너뛰지 않는다
  if (st.actions.length > 0 && !st.actions.some(coversAssume)) return [];
  const out: Finding[] = [];
  const hasCond = st.conditionKeys.length > 0;
  const orgCond = st.conditionKeys.some((k) => ORG_COND.test(k.trim()));
  const externalId = st.conditionKeys.some((k) => EXTERNAL_ID.test(k.trim()));
  if (st.principal.wildcard || st.notPrincipal || st.principal.aws.includes("*")) {
    out.push(!hasCond
      ? { level: "risk", slug: "trust-wildcard-open", facts: [fact("trust-wildcard")] }
      : { level: "caution", slug: orgCond ? "trust-wildcard-org-condition" : "trust-wildcard-conditioned", facts: [fact("trust-wildcard")] });
  }
  for (const p of st.principal.aws) {
    if (p === "*") continue;                           // wildcard로 이미 처리
    if (UNIQUE_ID.test(p)) continue;                   // 삭제된 주체의 고유 ID: 아무도 쓸 수 없다
    const acct = accountOf(p);
    if (acct === null) { out.push({ level: "unrecognized" }); continue; }
    if (acct === accountId || externalId) continue;
    out.push({ level: "caution", slug: orgCond ? "trust-external-org-condition" : "trust-external-no-external-id", facts: [fact("trust-principal", { principal: { raw: { type: "arn", value: p } } })] });
  }
  if (st.principal.canonicalUserCount > 0 && !externalId) {
    // CanonicalUser는 '모든 주체'가 아니라 특정 S3 정식 사용자 ID다 — trust-wildcard 사실을 붙이지 않는다(디자인 검수 K-3)
    out.push({ level: "caution", slug: "trust-external-no-external-id", facts: [fact("trust-canonical-user")] });
  }
  return out;
}

function evalRole(r: AwsIamRole, accountId: string): Member {
  const res = { type: "iam-role" as const, name: { type: "roleName" as const, value: r.name }, where: { kind: "global" as const, value: "global" }, id: r.name };
  if (r.path.startsWith("/aws-service-role/")) return mExcluded(res, R("role-service-linked"), evs(r.src));
  const trust = r.trust;
  if (trust.k !== "value") return mUnknown(res, reasonOf(trust), evs(r.src, trust.src));
  // 신뢰 문장이 하나도 없는 역할은 AWS가 만들 수 없는 모양이다: 이상 없음으로 접지 않는다
  if (trust.value.length === 0) return mUnknown(res, "value-unrecognized", evs(r.src, trust.src));
  const findings_: Finding[] = trust.value.flatMap((st) => evalStatement(st, accountId));
  const ev_: Ev[] = evs(r.src, trust.src);
  const risks = findings_.filter((f): f is Extract<Finding, { level: "risk" }> => f.level === "risk");
  if (risks.length > 0) return mRisk(res, F(risks[0].slug), ev_, { facts: risks.flatMap((f) => f.facts).slice(0, 4) });
  const cautions = findings_.filter((f): f is Extract<Finding, { level: "caution" }> => f.level === "caution");
  if (cautions.length > 0) return mCaution(res, F(cautions[0].slug), ev_, { facts: cautions.flatMap((f) => f.facts).slice(0, 4) });
  if (findings_.some((f) => f.level === "unrecognized")) return mUnknown(res, "value-unrecognized", ev_);
  return mClear(res, R("trust-ok"), ev_);
}

function evaluate(ctx: RuleCtx<AwsKeyData>) {
  const roles = ctx.data.roles;
  if (roles.k !== "value" && roles.k !== "partial") return { members: [] as Member[], coverage: ctx.scope };
  return { members: roles.value.map((r) => evalRole(r, ctx.accountId)), coverage: ctx.scope };
}

export const AWS_KEY_4 = defineRule<"aws", "key">({
  spec, evaluate,
  explain: (x) => {
    if (x.status === "na") return { msg: R("na-no-custom-roles") };
    if (x.status === "clear") return { msg: R("no-external-trust", { n: N(x.applicable ?? x.members.length) }) };
    return { msg: x.status === "risk" ? R("roles-open", { n: N(x.members.length) }) : R("roles-external", { n: N(x.members.length) }) };
  },
});
