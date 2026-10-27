// AWS-MFA-2 콘솔 사용자 MFA — 현관 · priority 70 · 최고 위험
// 구성원: IAM 사용자(루트 제외, aws.mfa.users). 적용 대상 = 콘솔 비밀번호가 있는 사용자.
//  - 위험: 콘솔 비밀번호가 있는데 MFA가 꺼진 사용자 / 이상 없음: 콘솔 사용자가 1명 이상이고 전원 MFA 켜짐
//  - 제외: 콘솔 비밀번호 없는 사용자. 전원이 제외되면 해당 없음(콘솔 사용자 0명) → 직접 볼 목록에 'IdP MFA 직접 확인'(auto-notice)
//  - INV-7 해당 없음: MFA 유무는 보고서가 기본이고 실시간 호출은 보강이라 일부 거부가 대상을 모르게 만들지 않는다(MFA-2의 '주의' 칸은 비어 있다).
import type { AwsMfaData } from "../../contract/normalized";
import type { Member, RuleCtx } from "../../engine/types";
import { buildSpec, defineRule, evs, fact, findings, iamUserRes, mClear, mExcluded, mRisk, mUnknown, reasons, read, ruleKey, write, simpleExplain } from "../kit";
import { reasonOf, staleReport } from "./creds";

const ID = "AWS-MFA-2" as const;
const R = reasons(ID);
const F = findings(ID);

export const spec = buildSpec({
  id: ID, door: "mfa", maxStatus: "risk", allowsClear: true, priority: 70,
  cond: ["risk", "clear", "na", "unknown"], impact: true, question: false,
  paths: ["csv", "collector"],
  params: [],
  cannotSee: 3, falsePositives: 2,
  fix: {
    impact: "low", prodImpact: false,
    observe: {
      doc: "https://docs.aws.amazon.com/IAM/latest/UserGuide/id_credentials_getting-report.html",
      commands: [read("aws", "aws iam list-mfa-devices --user-name [[user-name]]")],
    },
    change: {
      property: "MFA device (Assign MFA device)",
      doc: "https://docs.aws.amazon.com/IAM/latest/UserGuide/id_credentials_mfa_enable_virtual.html",
      commands: [write("aws", "aws iam delete-login-profile --user-name [[user-name]]")],
    },
    revert: { commands: [write("aws", "aws iam deactivate-mfa-device --user-name [[user-name]] --serial-number [[mfa-serial-number]]")] },
    runbook: null,
  },
  guide: null,
  asOfBasis: "credential-report",
  basis: [
    { name: "virtual-mfa", url: "https://docs.aws.amazon.com/IAM/latest/UserGuide/id_credentials_mfa_enable_virtual.html", kind: "doc" },
    { name: "credential-report", url: "https://docs.aws.amazon.com/IAM/latest/UserGuide/id_credentials_getting-report.html", kind: "doc" },
    { name: "securityhub-iam", url: "https://docs.aws.amazon.com/securityhub/latest/userguide/iam-controls.html", kind: "benchmark" },
  ],
  incident: null,
  lastVerified: "2026-10-19",
  families: { item: "aws.mfa.users", needs: ["aws.mfa.credential-report"] },
  calls: ["iam:GenerateCredentialReport", "iam:GetCredentialReport", "iam:GetAccountSummary", "iam:ListUsers", "iam:ListMFADevices"],
  reasons: {
    "console-no-mfa": ["n"], "all-mfa": ["n"], "na-no-console-users": [],
    "user-no-mfa": [], "user-has-mfa": [], "user-no-console": [],
  },
  facts: { "console-password": [], "mfa-on": [], "mfa-off": [], "idp-mfa": [] },
  how: true,
  autoNotice: { what: "fact:idp-mfa", howKey: ruleKey(ID, "auto", "how") },
  fixtures: {
    pass: "micro/AWS-MFA-2/pass",
    violate: ["micro/AWS-MFA-2/no-mfa"],
    denied: { call: "iam:GetCredentialReport", expect: "unknown" },
    truncated: { call: "iam:ListUsers", expect: "unknown" },
    missingField: { path: "doors.mfa.data.users", expect: "unknown" },
    versionMismatch: "auto",
  },
});

function evaluate(ctx: RuleCtx<AwsMfaData>) {
  const users = ctx.data.users;
  const members: Member[] = [];
  if (users.k === "value" || users.k === "partial") {
    for (const u of users.value) {
      const res = iamUserRes(u.name);
      const pw = u.passwordEnabled;
      const mfa = u.mfaActive;
      const stale = staleReport(ctx, pw.src, mfa.src);
      if (pw.k !== "value") { members.push(mUnknown(res, reasonOf(pw), evs(u.src, pw.src))); continue; }
      if (!pw.value) {
        members.push(stale ? mUnknown(res, "stale-evidence", evs(pw.src)) : mExcluded(res, R("user-no-console"), evs(pw.src)));
        continue;
      }
      if (mfa.k !== "value") { members.push(mUnknown(res, reasonOf(mfa), evs(pw.src, mfa.src), { facts: [fact("console-password")] })); continue; }
      if (!mfa.value) {
        members.push(mRisk(res, F("user-no-mfa"), evs(pw.src, mfa.src), { facts: [fact("console-password"), fact("mfa-off")] }));
        continue;
      }
      members.push(stale ? mUnknown(res, "stale-evidence", evs(pw.src, mfa.src)) : mClear(res, R("user-has-mfa"), evs(pw.src, mfa.src), { facts: [fact("console-password"), fact("mfa-on")] }));
    }
  }
  // 사용자 목록 자체를 못 받았으면 구성원이 없다 → 범위 증명(coverage)의 빈틈이 확인 불가를 만든다
  return { members, coverage: ctx.scope };
}

export const AWS_MFA_2 = defineRule<"aws", "mfa">({
  spec, evaluate,
  explain: simpleExplain(ID, { risk: "console-no-mfa", clear: "all-mfa", na: "na-no-console-users" }),
});
