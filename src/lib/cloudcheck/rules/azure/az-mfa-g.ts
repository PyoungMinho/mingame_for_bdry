// AZ-MFA-G Entra MFA 적용 여부(직접 확인) — 현관 · priority 90 · 가이드 카드(항상 확인 불가)
// 자동으로 판정하지 않는다. 포털에서 확인할 3단계를 안내한다. 사용자가 고른 본인 응답은 UI 세션 상태로만 두고 상태를 바꾸지 않는다(INV-8).
import { buildSpec, defineRule } from "../kit";

const ID = "AZ-MFA-G" as const;

export const spec = buildSpec({
  id: ID, door: "mfa", kind: "guide", maxStatus: "unknown", allowsClear: false, priority: 90,
  cond: ["unknown"], impact: false, question: false,
  paths: ["guide"],
  params: [],
  cannotSee: 3, falsePositives: 0,
  fix: null,
  guide: {
    steps: [
      { id: "security-defaults", doc: "https://learn.microsoft.com/en-us/entra/fundamentals/security-defaults" },
      { id: "conditional-access-all", doc: "https://learn.microsoft.com/en-us/entra/identity/conditional-access/policy-all-users-mfa-strength" },
      { id: "admin-roles", doc: "https://learn.microsoft.com/en-us/entra/identity/conditional-access/policy-old-require-mfa-admin" },
    ],
  },
  basis: [
    { name: "security-defaults", url: "https://learn.microsoft.com/en-us/entra/fundamentals/security-defaults", kind: "doc" },
    { name: "conditional-access-all-users", url: "https://learn.microsoft.com/en-us/entra/identity/conditional-access/policy-all-users-mfa-strength", kind: "doc" },
  ],
  incident: null,
  lastVerified: "2026-10-19",
  families: null,
  calls: [],
  reasons: {},
  facts: {},
  how: true,
  fixtures: {
    pass: { na: "가이드 카드는 항상 확인 불가라 통과 케이스가 없다" },
    violate: { na: "가이드 카드는 위험·주의를 내지 않는다" },
    denied: { na: "자동 판정을 하지 않아 호출이 없다" },
    truncated: { na: "자동 판정을 하지 않아 호출이 없다" },
    missingField: { na: "읽는 데이터가 없다" },
    versionMismatch: "auto",
  },
});

export const AZ_MFA_G = defineRule<"azure", "mfa">({ spec });
