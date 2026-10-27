// AWS-KEY-1 액세스 키 나이 — 열쇠 · priority 110 · 최고 주의
// 구성원: 액세스 키 하나(aws.key.access-keys). 비활성 키는 제외. 활성 키가 만든 지 90일을 넘으면 주의(Security Hub IAM.3, 공개 기준).
// 루트 키는 AWS-MFA-1이 다룬다(여기서 중복 판정하지 않는다).
// 시각 역전: 키 생성 시각이 기준 시각보다 허용치를 넘게 늦으면(PC 시계 · 파일 시각이 틀림) 나이를 말할 수 없다 → 확인 불가(stale-evidence) + 시각 역전 사실(CC-QA-01).
//  같은 입력의 어느 칸이든(다른 사용자 행 · 비밀번호 변경 · 인증서 회전 — parse의 latestEvidence 포함) 기준 시각보다 늦으면 기준 시각이 틀린 것이라 '최근이라 괜찮다'(이상 없음)를 내지 않는다. 90일을 넘었다는 주의는 그대로 유지한다.
import type { AwsKeyData } from "../../contract/normalized";
import type { Member, RuleCtx } from "../../engine/types";
import { KEY_MAX_AGE_DAYS } from "../params";
import { N, accessKeyRes, ageMs, buildSpec, defineRule, evs, fact, findings, iamUserRes, inputEvidence, laterThanAsOfFact, mCaution, mClear, mExcluded, mUnknown, olderThanDays, read, reasons, reversedIn, wholeDays, write } from "../kit";
import { keyDoorTimes, keyFact, keyLabel, reasonOf, staleReport } from "./creds";

const ID = "AWS-KEY-1" as const;
const R = reasons(ID);
const F = findings(ID);
const DOC_ROTATE = "https://docs.aws.amazon.com/IAM/latest/UserGuide/id-credentials-access-keys-update.html";

export const spec = buildSpec({
  id: ID, door: "key", maxStatus: "caution", allowsClear: true, priority: 110,
  cond: ["caution", "clear", "na", "unknown"], impact: true, question: true,
  paths: ["csv", "collector"],
  params: [{ name: "max-age-days", value: KEY_MAX_AGE_DAYS, basis: "public-standard" }],
  cannotSee: 2, falsePositives: 2,
  fix: {
    impact: "high", prodImpact: true,
    observe: {
      doc: "https://docs.aws.amazon.com/IAM/latest/UserGuide/id_credentials_finding-unused.html",
      commands: [read("aws", "aws iam get-access-key-last-used --access-key-id [[access-key-id]]")],
    },
    change: {
      property: "AccessKey Status (Inactive)",
      doc: DOC_ROTATE,
      commands: [
        write("aws", "aws iam create-access-key --user-name [[user-name]]"),
        write("aws", "aws iam update-access-key --user-name [[user-name]] --access-key-id [[old-access-key-id]] --status Inactive"),
      ],
    },
    revert: { commands: [write("aws", "aws iam update-access-key --user-name [[user-name]] --access-key-id [[old-access-key-id]] --status Active")] },
    runbook: null,
  },
  guide: null,
  asOfBasis: "credential-report",
  basis: [
    { name: "securityhub-iam-3", url: "https://docs.aws.amazon.com/securityhub/latest/userguide/iam-controls.html", kind: "benchmark" },
    { name: "rotate-keys", url: DOC_ROTATE, kind: "doc" },
    { name: "credential-report", url: "https://docs.aws.amazon.com/IAM/latest/UserGuide/id_credentials_getting-report.html", kind: "doc" },
  ],
  incident: null,
  lastVerified: "2026-10-19",
  families: { item: "aws.key.access-keys", needs: [] },
  calls: ["iam:GenerateCredentialReport", "iam:GetCredentialReport", "iam:GetAccountSummary", "iam:ListUsers", "iam:ListAccessKeys"],
  reasons: {
    "keys-too-old": ["n", "days"], "all-recent": ["n", "days"], "na-no-active-keys": [],
    "key-too-old": ["days"], "key-recent": ["days"], "key-inactive": [],
  },
  facts: { "key-suffix": ["suffix"], "key-slot": ["slot"], "key-age-days": ["n"], "evidence-later-than-as-of": ["evidence", "reference"] },
  how: true,
  fixtures: {
    pass: "micro/AWS-KEY-1/pass",
    violate: ["micro/AWS-KEY-1/old-key"],
    denied: { call: "iam:ListAccessKeys", resource: "alice", expect: "unknown" },
    truncated: { call: "iam:ListUsers", expect: "unknown" },
    missingField: { path: "doors.key.data.users", expect: "unknown" },
    versionMismatch: "auto",
  },
});

function evaluate(ctx: RuleCtx<AwsKeyData>) {
  const members: Member[] = [];
  const users = ctx.data.users;
  if (users.k !== "value" && users.k !== "partial") return { members, coverage: ctx.scope };
  // 입력 안에 기준 시각보다 늦은 시각이 하나라도 있으면 기준 시각이 이른 것이다: '최근이라 괜찮다'는 결론은 내지 않는다
  const skew = reversedIn(ctx.asOf, [...keyDoorTimes(ctx.data), ...inputEvidence(ctx)]);
  for (const u of users.value) {
    const keys = u.keys;
    if (keys.k === "missing") { members.push(mUnknown(iamUserRes(u.name), keys.why, evs(keys.src))); continue; }
    if (keys.k !== "value" && keys.k !== "partial") continue;
    for (const k of keys.value) {
      const res = accessKeyRes(u.name, keyLabel(k));
      const suffix = [keyFact(k)];
      if (k.active.k !== "value") { members.push(mUnknown(res, reasonOf(k.active), evs(k.src, k.active.src), { facts: suffix })); continue; }
      if (!k.active.value) {
        members.push(staleReport(ctx, k.active.src) ? mUnknown(res, "stale-evidence", evs(k.active.src)) : mExcluded(res, R("key-inactive"), evs(k.active.src), { facts: suffix }));
        continue;
      }
      if (k.createdAt.k !== "value") { members.push(mUnknown(res, reasonOf(k.createdAt), evs(k.active.src, k.createdAt.src), { facts: suffix })); continue; }
      if (ctx.asOf === null) { members.push(mUnknown(res, "field-missing", evs(k.active.src, k.createdAt.src), { facts: suffix })); continue; }
      const age = ageMs(ctx.asOf, k.createdAt.value, k.createdAt.src);
      if (age === null) {
        // 키가 기준 시각보다 늦게 만들어졌다고 적혀 있다: 나이를 알 수 없으니 '최근'으로 보지 않는다
        members.push(mUnknown(res, "stale-evidence", evs(k.active.src, k.createdAt.src), { facts: [...suffix, laterThanAsOfFact(ctx.asOf, k.createdAt.value)] }));
        continue;
      }
      const facts = [...suffix, fact("key-age-days", { n: N(wholeDays(age)) })];
      if (olderThanDays(age, KEY_MAX_AGE_DAYS)) {
        members.push(mCaution(res, F("key-too-old", { days: N(KEY_MAX_AGE_DAYS) }), evs(k.active.src, k.createdAt.src), { facts }));
      } else if (skew !== null) {
        members.push(mUnknown(res, "stale-evidence", evs(k.active.src, k.createdAt.src), { facts: [...suffix, laterThanAsOfFact(ctx.asOf, skew)] }));
      } else if (staleReport(ctx, k.active.src, k.createdAt.src)) {
        members.push(mUnknown(res, "stale-evidence", evs(k.active.src, k.createdAt.src), { facts }));
      } else {
        members.push(mClear(res, R("key-recent", { days: N(KEY_MAX_AGE_DAYS) }), evs(k.active.src, k.createdAt.src), { facts }));
      }
    }
  }
  return { members, coverage: ctx.scope };
}

export const AWS_KEY_1 = defineRule<"aws", "key">({
  spec, evaluate,
  explain: (x) => {
    const days = { days: N(KEY_MAX_AGE_DAYS) };
    if (x.status === "na") return { msg: R("na-no-active-keys") };
    if (x.status === "clear") return { msg: R("all-recent", { n: N(x.applicable ?? x.members.length), ...days }) };
    return { msg: R("keys-too-old", { n: N(x.members.length), ...days }) };
  },
});
