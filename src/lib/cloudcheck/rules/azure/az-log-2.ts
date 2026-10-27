// AZ-LOG-2 Blob 접근 기록 설정 — CCTV · priority 180 · 최고 주의
// 구성원: 스토리지 계정(azure.log.storage-accounts). 리소스 로그는 진단 설정을 만들기 전에는 수집되지 않는다 [확인: 2026-10-19, monitor-blob-storage].
//  - 이상 없음: Blob 서비스(blobServices/default)의 진단 설정이 StorageRead·StorageWrite·StorageDelete를 모두 켬(내보내는 곳은 묻지 않는다)
//  - 주의: 진단 설정이 없음 / 세 범주 중 일부가 빠짐
//  - 범주 그룹: allLogs는 '모든 범주'로 본다(문서 정의). audit이 Blob 서비스에서 세 범주를 모두 담는지는 문서에 없다(미확인: 지원 로그 표에 그룹 소속이 없음,
//    2026-10-19 백엔드팀장 확인) → audit만으로 판단이 갈리면 이상 없음도 주의도 아닌 확인 불가(value-unrecognized). AZ-LOG-1과 같은 원칙. PM V1 실측 뒤 정한다.
//  - 해당 없음: 스토리지 계정 0개(목록이 완결일 때)
import type { AzureLogData } from "../../contract/normalized";
import type { Member, RuleCtx } from "../../engine/types";
import { N, buildSpec, defineRule, evs, fact, findings, mCaution, mClear, mUnknown, reasons } from "../kit";
import { enabledCategories, storageAccountRes, why } from "./common";

const ID = "AZ-LOG-2" as const;
const R = reasons(ID);
const F = findings(ID);
const DOC_MONITOR = "https://learn.microsoft.com/en-us/azure/storage/blobs/monitor-blob-storage";
const DOC_DIAG = "https://learn.microsoft.com/en-us/azure/azure-monitor/data-collection/diagnostic-settings";
const NEED = ["storageread", "storagewrite", "storagedelete"] as const;
const NAMES: Readonly<Record<(typeof NEED)[number], string>> = { storageread: "StorageRead", storagewrite: "StorageWrite", storagedelete: "StorageDelete" };

export const spec = buildSpec({
  id: ID, door: "log", maxStatus: "caution", allowsClear: true, priority: 180,
  cond: ["caution", "clear", "na", "unknown"], impact: true, question: true,
  paths: ["collector"],
  params: [{ name: "categories", value: ["StorageRead", "StorageWrite", "StorageDelete"], basis: "tool-default" }],
  cannotSee: 3, falsePositives: 1,
  fix: {
    impact: "low", prodImpact: false,
    observe: { doc: DOC_MONITOR, commands: [] },
    change: {
      property: "Diagnostic setting on blobServices/default (StorageRead · StorageWrite · StorageDelete)",
      doc: DOC_DIAG,
      commands: [],
    },
    revert: { commands: [] },
    runbook: null,
  },
  guide: null,
  basis: [
    { name: "monitor-blob-storage", url: DOC_MONITOR, kind: "doc" },
    { name: "diagnostic-settings", url: DOC_DIAG, kind: "doc" },
  ],
  incident: null,
  lastVerified: "2026-10-19",
  families: { item: "azure.log.storage-accounts", needs: [] },
  calls: ["azure:account.list", "azure:storage.account.list", "azure:monitor.diagnostic-settings.list"],
  reasons: {
    "accounts-not-logged": ["n"], "all-logged": ["n"], "na-no-storage-accounts": [], "no-diagnostics": [], "categories-missing": [], "blob-logged": [],
  },
  facts: { "missing-category": ["category"] },
  how: true,
  fixtures: {
    pass: "micro/AZ-LOG-2/pass",
    violate: ["micro/AZ-LOG-2/no-diagnostics", "micro/AZ-LOG-2/categories-missing"],
    denied: { call: "azure:monitor.diagnostic-settings.list", expect: "unknown" },
    truncated: { call: "azure:monitor.diagnostic-settings.list", expect: "unknown" },
    missingField: { path: "doors.log.data.storageAccounts[0].items", expect: "unknown" },
    versionMismatch: "auto",
  },
});

function evaluate(ctx: RuleCtx<AzureLogData>) {
  const members: Member[] = [];
  for (const per of ctx.data.storageAccounts) {
    if (per.items.k !== "value" && per.items.k !== "partial") continue;
    for (const sa of per.items.value) {
      const res = storageAccountRes(sa);
      const d = sa.blobDiagnostics;
      if (d.k !== "value") { members.push(mUnknown(res, why(d), evs(sa.src, d.src))); continue; }
      const e = evs(sa.src, d.src);
      const cats = enabledCategories(d.value, () => true, null);
      const missing = NEED.filter((c) => !cats.allLogs && !cats.cats.has(c));
      if (missing.length === 0) { members.push(mClear(res, R("blob-logged"), e)); continue; }
      // audit 그룹이 빠진 범주를 담는지 모른다 → 단정하지 않는다(fail-closed)
      if (cats.auditOnlyUnknown) { members.push(mUnknown(res, "value-unrecognized", e)); continue; }
      const facts = missing.map((c) => fact("missing-category", { category: { c: NAMES[c] } }));
      members.push(mCaution(res, F(d.value.length === 0 ? "no-diagnostics" : "categories-missing"), e, { facts }));
    }
  }
  return { members, coverage: ctx.scope };
}

export const AZ_LOG_2 = defineRule<"azure", "log">({
  spec, evaluate,
  explain: (x) => (x.status === "na" ? { msg: R("na-no-storage-accounts") } : x.status === "clear" ? { msg: R("all-logged", { n: N(x.applicable ?? x.members.length) }) } : { msg: R("accounts-not-logged", { n: N(x.members.length) }) }),
});
