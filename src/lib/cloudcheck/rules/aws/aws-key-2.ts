// AWS-KEY-2 자격증명 마지막 사용 — 열쇠 · priority 120 · 최고 주의
// 구성원: IAM 사용자(aws.key.users). 적용 대상 = 활성 자격증명(콘솔 비밀번호, 활성 액세스 키)이 하나라도 있는 사용자.
//  - 주의: 활성 자격증명을 마지막으로 쓴 지 45일을 넘었거나(Security Hub IAM.22 · CIS v5.0.0/1.11, 공개 기준), 한 번도 안 썼고 만든 지 7일이 지남(도구 기준 유예)
//  - 제외: 활성 자격증명이 하나도 없는 사용자. 전원이 제외되면 해당 없음.
//  - 필요한 패밀리: aws.key.access-keys(사용자별 키 목록이 완결이어야 '활성 키 없음'을 말할 수 있다)
//  - 시각 역전(CC-QA-01): 시각 칸이 기준 시각보다 허용치를 넘게 늦으면 나이를 말할 수 없다 → 확인 불가(stale-evidence). 같은 입력의 어느 칸이든(parse의 latestEvidence 포함) 늦으면 '45일 안에 사용'(이상 없음)을 내지 않는다. 오래 안 썼다는 주의는 유지한다.
import type { AsOfFact, AwsAccessKey, AwsIamUser, AwsKeyData, Instant, Src } from "../../contract/normalized";
import type { Ev, Member, RuleCtx } from "../../engine/types";
import type { UnknownReason } from "../../model/report";
import { CREDENTIAL_GRACE_DAYS, CREDENTIAL_UNUSED_DAYS } from "../params";
import { N, ageMs, buildSpec, dateOf, defineRule, evs, fact, findings, iamUserRes, inputEvidence, laterThanAsOfFact, mCaution, mClear, mExcluded, mUnknown, olderThanDays, read, reasons, reversedIn, uniqFacts, write } from "../kit";
import { keyDoorTimes, keyFact, keyState, reasonOf, staleReport } from "./creds";

const ID = "AWS-KEY-2" as const;
const R = reasons(ID);
const F = findings(ID);

export const spec = buildSpec({
  id: ID, door: "key", maxStatus: "caution", allowsClear: true, priority: 120,
  cond: ["caution", "clear", "na", "unknown"], impact: true, question: true,
  paths: ["csv", "collector"],
  params: [
    { name: "unused-days", value: CREDENTIAL_UNUSED_DAYS, basis: "public-standard" },
    { name: "grace-days", value: CREDENTIAL_GRACE_DAYS, basis: "tool-default" },
  ],
  cannotSee: 2, falsePositives: 2,
  fix: {
    impact: "high", prodImpact: true,
    observe: {
      doc: "https://docs.aws.amazon.com/IAM/latest/UserGuide/id_credentials_finding-unused.html",
      commands: [read("aws", "aws iam get-access-key-last-used --access-key-id [[access-key-id]]")],
    },
    change: {
      property: "AccessKey Status (Inactive) · LoginProfile",
      doc: "https://docs.aws.amazon.com/IAM/latest/UserGuide/id_credentials_finding-unused.html",
      commands: [write("aws", "aws iam update-access-key --user-name [[user-name]] --access-key-id [[access-key-id]] --status Inactive")],
    },
    revert: { commands: [write("aws", "aws iam update-access-key --user-name [[user-name]] --access-key-id [[access-key-id]] --status Active")] },
    runbook: null,
  },
  guide: null,
  asOfBasis: "credential-report",
  basis: [
    { name: "securityhub-iam-22", url: "https://docs.aws.amazon.com/securityhub/latest/userguide/iam-controls.html", kind: "benchmark" },
    { name: "find-unused", url: "https://docs.aws.amazon.com/IAM/latest/UserGuide/id_credentials_finding-unused.html", kind: "doc" },
  ],
  incident: null,
  lastVerified: "2026-10-19",
  families: { item: "aws.key.users", needs: ["aws.key.access-keys"] },
  calls: ["iam:GenerateCredentialReport", "iam:GetCredentialReport", "iam:GetAccountSummary", "iam:ListUsers", "iam:ListAccessKeys"],
  reasons: {
    "unused-credentials": ["n", "days"], "all-used": ["n", "days"], "na-no-active-credentials": [],
    "credential-unused": ["days"], "credentials-used": ["days"], "user-no-active-credentials": [],
  },
  facts: {
    "unused-console": ["d"], "unused-console-never": [], "unused-key-date": ["d"], "unused-key-none": [], "key-suffix": ["suffix"], "key-slot": ["slot"],
    "console-password": [], "evidence-later-than-as-of": ["evidence", "reference"],
  },
  how: true,
  fixtures: {
    pass: "micro/AWS-KEY-2/pass",
    violate: ["micro/AWS-KEY-2/unused-key", "micro/AWS-KEY-2/never-used-key"],
    denied: { call: "iam:GetCredentialReport", expect: "unknown" },
    truncated: { call: "iam:ListUsers", expect: "unknown" },
    missingField: { path: "doors.key.data.users", expect: "unknown" },
    versionMismatch: "auto",
  },
});

type Cred =
  | { readonly kind: "ok"; readonly srcs: readonly (Src | null)[] }
  | { readonly kind: "stale"; readonly facts: ReturnType<typeof fact>[]; readonly srcs: readonly (Src | null)[] }
  | { readonly kind: "unknown"; readonly why: UnknownReason; readonly srcs: readonly (Src | null)[]; readonly facts?: ReturnType<typeof fact>[] };

/** 나이를 잴 수 없다: 증거 시각이 기준 시각보다 허용치를 넘게 늦다(시각 역전) → 확인 불가(stale-evidence) + 시각 역전 사실 */
const reversed = (ctx: RuleCtx<AwsKeyData>, t: Instant, srcs: readonly (Src | null)[]): Cred =>
  ({ kind: "unknown", why: "stale-evidence", srcs, facts: [laterThanAsOfFact(ctx.asOf as AsOfFact, t)] });

function keyCred(ctx: RuleCtx<AwsKeyData>, k: AwsAccessKey): Cred | null {
  const st = keyState(k);
  if (st === "inactive") return null;
  if (st === "unknown") return { kind: "unknown", why: reasonOf(k.active), srcs: [k.src, k.active.src] };
  if (k.lastUsed.k !== "value") return { kind: "unknown", why: reasonOf(k.lastUsed), srcs: [k.active.src, k.lastUsed.src] };
  if (ctx.asOf === null) return { kind: "unknown", why: "field-missing", srcs: [k.active.src, k.lastUsed.src] };
  const srcs = [k.active.src, k.lastUsed.src];
  const last = k.lastUsed.value;
  if (last !== null) {
    const age = ageMs(ctx.asOf, last, k.lastUsed.src);
    if (age === null) return reversed(ctx, last, srcs);
    return olderThanDays(age, CREDENTIAL_UNUSED_DAYS)
      ? { kind: "stale", facts: [keyFact(k), fact("unused-key-date", { d: { d: dateOf(last) } })], srcs }
      : { kind: "ok", srcs };
  }
  // 한 번도 안 썼다: 만든 지 유예 기간이 지난 경우만 주의
  if (k.createdAt.k !== "value") return { kind: "unknown", why: reasonOf(k.createdAt), srcs: [...srcs, k.createdAt.src] };
  const made = ageMs(ctx.asOf, k.createdAt.value, k.createdAt.src);
  if (made === null) return reversed(ctx, k.createdAt.value, [...srcs, k.createdAt.src]);
  return olderThanDays(made, CREDENTIAL_GRACE_DAYS)
    ? { kind: "stale", facts: [keyFact(k), fact("unused-key-none")], srcs: [...srcs, k.createdAt.src] }
    : { kind: "ok", srcs: [...srcs, k.createdAt.src] };
}

function consoleCred(ctx: RuleCtx<AwsKeyData>, u: AwsIamUser): Cred | null {
  const pw = u.passwordEnabled;
  if (pw.k !== "value") return { kind: "unknown", why: reasonOf(pw), srcs: [pw.src] };
  if (!pw.value) return null;
  if (u.passwordLastUsed.k !== "value") return { kind: "unknown", why: reasonOf(u.passwordLastUsed), srcs: [pw.src, u.passwordLastUsed.src] };
  if (ctx.asOf === null) return { kind: "unknown", why: "field-missing", srcs: [pw.src, u.passwordLastUsed.src] };
  const last = u.passwordLastUsed.value;
  const srcs = [pw.src, u.passwordLastUsed.src];
  if (last !== null) {
    const age = ageMs(ctx.asOf, last, u.passwordLastUsed.src);
    if (age === null) return reversed(ctx, last, srcs);
    return olderThanDays(age, CREDENTIAL_UNUSED_DAYS)
      ? { kind: "stale", facts: [fact("unused-console", { d: { d: dateOf(last) } })], srcs }
      : { kind: "ok", srcs };
  }
  if (u.createdAt.k !== "value") return { kind: "unknown", why: reasonOf(u.createdAt), srcs: [...srcs, u.createdAt.src] };
  const made = ageMs(ctx.asOf, u.createdAt.value, u.createdAt.src);
  if (made === null) return reversed(ctx, u.createdAt.value, [...srcs, u.createdAt.src]);
  return olderThanDays(made, CREDENTIAL_GRACE_DAYS)
    ? { kind: "stale", facts: [fact("unused-console-never")], srcs: [...srcs, u.createdAt.src] }
    : { kind: "ok", srcs: [...srcs, u.createdAt.src] };
}

function evalUser(ctx: RuleCtx<AwsKeyData>, u: AwsIamUser, skew: Instant | null): Member {
  const res = iamUserRes(u.name);
  const creds: Cred[] = [];
  const consoleC = consoleCred(ctx, u);
  if (consoleC !== null) creds.push(consoleC);
  const keys = u.keys;
  if (keys.k === "value" || keys.k === "partial") {
    for (const k of keys.value) { const c = keyCred(ctx, k); if (c !== null) creds.push(c); }
    // 보고서만으로는 3번째 키부터 모른다(additional_credentials_info) → 그 사용자의 '없음'은 말할 수 없다
    if (keys.k === "partial") creds.push({ kind: "unknown", why: keys.why, srcs: [keys.src] });
  } else {
    creds.push({ kind: "unknown", why: reasonOf(keys), srcs: [keys.src] });
  }
  const allSrc = (cs: readonly Cred[]): Ev[] => evs(...cs.flatMap((c) => c.srcs));
  const stale = creds.filter((c): c is Extract<Cred, { kind: "stale" }> => c.kind === "stale");
  if (stale.length > 0) {
    return mCaution(res, F("credential-unused", { days: N(CREDENTIAL_UNUSED_DAYS) }), allSrc(stale), { facts: stale.flatMap((c) => c.facts) });
  }
  const unknowns = creds.filter((c): c is Extract<Cred, { kind: "unknown" }> => c.kind === "unknown");
  if (unknowns.length > 0) return mUnknown(res, unknowns[0].why, allSrc(creds), { facts: uniqFacts(unknowns.flatMap((c) => c.facts ?? [])).slice(0, 4) });
  // 입력 안에 기준 시각보다 늦은 시각이 있으면 기준 시각이 이른 것이다: '최근에 썼다'는 결론(이상 없음)은 내지 않는다. 활성 자격증명이 없어 제외하는 것은 나이와 무관하다
  if (skew !== null && ctx.asOf !== null && creds.length > 0) {
    return mUnknown(res, "stale-evidence", allSrc(creds), { facts: [laterThanAsOfFact(ctx.asOf, skew)] });
  }
  const anyStale = staleReport(ctx, ...creds.flatMap((c) => c.srcs), u.passwordEnabled.src);
  if (creds.length === 0) {
    return anyStale ? mUnknown(res, "stale-evidence", evs(u.passwordEnabled.src, keys.src))
      : mExcluded(res, R("user-no-active-credentials"), evs(u.passwordEnabled.src, keys.src));
  }
  if (anyStale) return mUnknown(res, "stale-evidence", allSrc(creds));
  return mClear(res, R("credentials-used", { days: N(CREDENTIAL_UNUSED_DAYS) }), allSrc(creds), { facts: creds.length > 0 && consoleC !== null && consoleC.kind === "ok" ? [fact("console-password")] : [] });
}

function evaluate(ctx: RuleCtx<AwsKeyData>) {
  const users = ctx.data.users;
  if (users.k !== "value" && users.k !== "partial") return { members: [] as Member[], coverage: ctx.scope };
  const skew = reversedIn(ctx.asOf, [...keyDoorTimes(ctx.data), ...inputEvidence(ctx)]);
  return { members: users.value.map((u) => evalUser(ctx, u, skew)), coverage: ctx.scope };
}

export const AWS_KEY_2 = defineRule<"aws", "key">({
  spec, evaluate,
  explain: (x) => {
    const days = { days: N(CREDENTIAL_UNUSED_DAYS) };
    if (x.status === "na") return { msg: R("na-no-active-credentials") };
    if (x.status === "clear") return { msg: R("all-used", { n: N(x.applicable ?? x.members.length), ...days }) };
    return { msg: R("unused-credentials", { n: N(x.members.length), ...days }) };
  },
});
