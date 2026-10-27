// AZ-MFA-1 Entra 사용자 MFA 등록 현황(조건부) — 현관 · priority 80 · released: false
// 포털 CSV 열 구성·라이선스 요건이 PM Azure 검증(G8)으로 확인되기 전에는 리포트·분포에 넣지 않는다(RULE_CATALOG의 released 플래그).
//  - 위험: 관리자 역할 사용자가 MFA 가능 상태가 아님(해당 열이 있을 때) / 주의: 일반 사용자가 MFA를 등록하지 않음
//  - 이상 없음을 주지 않는다(등록 ≠ 강제, 최대 36시간 지연, 비활성 사용자 제외) → 그 밖은 확인 불가(no-clear-rule)
import type { AzureMfaData } from "../../contract/normalized";
import type { Member, RuleCtx } from "../../engine/types";
import { N, buildSpec, defineRule, evs, findings, mCaution, mRisk, mUnknown, reasons } from "../kit";
import { why } from "./common";

const ID = "AZ-MFA-1" as const;
const R = reasons(ID);
const F = findings(ID);

export const spec = buildSpec({
  id: ID, door: "mfa", kind: "conditional", released: false, maxStatus: "risk", allowsClear: false, priority: 80,
  cond: ["risk", "caution", "unknown"], impact: true, question: true,
  paths: ["portal-csv"],
  params: [],
  cannotSee: 3, falsePositives: 1,
  fix: null,
  guide: null,
  basis: [{ name: "security-defaults", url: "https://learn.microsoft.com/en-us/entra/fundamentals/security-defaults", kind: "doc" }],
  incident: null,
  lastVerified: "2026-10-19",
  families: { item: "azure.mfa.entra-users", needs: [] },
  calls: [],
  reasons: { "admins-not-capable": ["n"], "users-not-registered": ["n"], "admin-not-mfa-capable": [], "user-not-registered": [] },
  facts: {},
  how: true,
  fixtures: {
    pass: { na: "released:false(편입 전)이라 이상 없음을 주지 않는다" },
    violate: { na: "released:false(편입 전): 포털 CSV 열 구성 확정 뒤 픽스처를 만든다" },
    denied: { na: "포털 CSV 경로라 호출이 없다" },
    truncated: { na: "포털 CSV 경로라 호출이 없다" },
    missingField: { na: "released:false(편입 전)" },
    versionMismatch: "auto",
  },
});

function evaluate(ctx: RuleCtx<AzureMfaData>) {
  const users = ctx.data.entraUsers;
  const members: Member[] = [];
  if (users.k === "value" || users.k === "partial") {
    for (const u of users.value) {
      const res = { type: "entra-user" as const, name: { type: "upn" as const, value: u.user }, where: null, id: u.user };
      const e = evs(u.src);
      if (u.isAdmin.k === "value" && u.isAdmin.value) {
        if (u.mfaCapable.k === "value" && !u.mfaCapable.value) members.push(mRisk(res, F("admin-not-mfa-capable"), e));
        else if (u.mfaCapable.k !== "value") members.push(mUnknown(res, why(u.mfaCapable), e));
        continue;
      }
      if (u.mfaRegistered.k === "value" && !u.mfaRegistered.value) members.push(mCaution(res, F("user-not-registered"), e));
      else if (u.mfaRegistered.k !== "value") members.push(mUnknown(res, why(u.mfaRegistered), e));
    }
  }
  return { members, coverage: ctx.scope };
}

export const AZ_MFA_1 = defineRule<"azure", "mfa">({
  spec, evaluate,
  explain: (x) => (x.status === "risk" ? { msg: R("admins-not-capable", { n: N(x.members.length) }) } : { msg: R("users-not-registered", { n: N(x.members.length) }) }),
});
