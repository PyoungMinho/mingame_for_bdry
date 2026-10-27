// AZ-STO-1 익명 공개 차단 설정 — 창고 · priority 150 · 최고 주의
// 구성원: 스토리지 계정(azure.sto.storage-accounts). allowBlobPublicAccess가 true이거나 비어 있으면(null = 미설정, 차단이 아님) 주의, false면 이상 없음.
// Resource Graph CSV 경로: 개별 계정은 판정하지만 룰 수준의 '없음'은 주지 않는다(core가 coverage로 처리).
import type { AzureStoData } from "../../contract/normalized";
import type { Member, RuleCtx } from "../../engine/types";
import { N, buildSpec, defineRule, evs, fact, findings, mCaution, mClear, mUnknown, reasons, write } from "../kit";
import { storageAccountRes, why } from "./common";

const ID = "AZ-STO-1" as const;
const R = reasons(ID);
const F = findings(ID);
const DOC_PREVENT = "https://learn.microsoft.com/en-us/azure/storage/blobs/anonymous-read-access-prevent";

export const spec = buildSpec({
  id: ID, door: "sto", maxStatus: "caution", allowsClear: true, priority: 150,
  cond: ["caution", "clear", "na", "unknown"], impact: true, question: true,
  paths: ["csv", "collector"],
  params: [],
  cannotSee: 3, falsePositives: 1,
  fix: {
    impact: "medium", prodImpact: true,
    observe: { doc: DOC_PREVENT, commands: [] },
    change: {
      property: "allowBlobPublicAccess",
      doc: DOC_PREVENT,
      commands: [write("az", "az storage account update --name [[storage-account-name]] --resource-group [[resource-group-name]] --allow-blob-public-access false")],
    },
    revert: { commands: [write("az", "az storage account update --name [[storage-account-name]] --resource-group [[resource-group-name]] --allow-blob-public-access true")] },
    runbook: null,
  },
  guide: null,
  basis: [{ name: "anonymous-read-access", url: DOC_PREVENT, kind: "doc" }],
  incident: null,
  lastVerified: "2026-10-19",
  families: { item: "azure.sto.storage-accounts", needs: [] },
  calls: ["azure:account.list", "azure:storage.account.list"],
  reasons: { "allow-not-blocked": ["n"], "all-blocked": ["n"], "na-no-storage-accounts": [], "allow-true": [], "allow-unset": [], "allow-false": [] },
  facts: { "anon-allowed": [], "anon-unset": [], "anon-blocked": [] },
  how: true,
  fixtures: {
    pass: "micro/AZ-STO-1/pass",
    violate: ["micro/AZ-STO-1/allow-true", "micro/AZ-STO-1/allow-unset"],
    denied: { call: "azure:storage.account.list", expect: "unknown" },
    truncated: { call: "azure:storage.account.list", expect: "unknown" },
    missingField: { path: "doors.sto.data.storageAccounts[0].items", expect: "unknown" },
    versionMismatch: "auto",
  },
});

function evaluate(ctx: RuleCtx<AzureStoData>) {
  const members: Member[] = [];
  for (const per of ctx.data.storageAccounts) {
    if (per.items.k !== "value" && per.items.k !== "partial") continue;
    for (const sa of per.items.value) {
      const res = storageAccountRes(sa);
      const s = sa.allowBlobPublicAccess;
      if (s.k !== "value") { members.push(mUnknown(res, why(s), evs(sa.src, s.src))); continue; }
      const e = evs(sa.src, s.src);
      if (s.value === true) members.push(mCaution(res, F("allow-true"), e, { facts: [fact("anon-allowed")] }));
      else if (s.value === null) members.push(mCaution(res, F("allow-unset"), e, { facts: [fact("anon-unset")] }));
      else members.push(mClear(res, R("allow-false"), e, { facts: [fact("anon-blocked")] }));
    }
  }
  return { members, coverage: ctx.scope };
}

export const AZ_STO_1 = defineRule<"azure", "sto">({
  spec, evaluate,
  explain: (x) => (x.status === "na" ? { msg: R("na-no-storage-accounts") } : x.status === "clear" ? { msg: R("all-blocked", { n: N(x.applicable ?? x.members.length) }) } : { msg: R("allow-not-blocked", { n: N(x.members.length) }) }),
});
