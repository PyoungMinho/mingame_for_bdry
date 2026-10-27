// AZ-LOG-1 활동 로그 내보내기 설정 — CCTV · priority 170 · 최고 주의
// 구성원: 범위 안 구독(azure.log.subscriptions). 활동 로그는 항상 수집되고 끌 수 없지만 90일 뒤 사라진다 [확인: 2026-10-19, activity-log].
//  - 이상 없음: Administrative·Security 범주를 Log Analytics 작업 영역 또는 스토리지 계정으로 내보내는 구독 진단 설정이 있음
//  - 주의: 진단 설정이 없음 / Administrative·Security 범주가 빠짐 / 내보내는 곳이 작업 영역·스토리지가 아님(이벤트 허브·파트너만)
//  - 해당 없음: 조회 범위 안 구독이 0개(na-no-subscriptions). 근거 줄이 '내보내지 않는 구독 0개'로 나가지 않게 따로 말한다(디자인 검수 K-2).
//  - 범주 그룹: allLogs는 '모든 범주'로 본다(문서 정의). audit은 활동 로그에서 어떤 범주를 담는지 문서에 없어(미확인) 쓰지 않는다 — audit만으로 판단이 갈리면 확인 불가.
import type { AzureDiagSetting, AzureLogData } from "../../contract/normalized";
import type { Member, RuleCtx } from "../../engine/types";
import { N, buildSpec, defineRule, evs, fact, findings, mCaution, mClear, mUnknown, reasons, write } from "../kit";
import { enabledCategories, hasAnyDestination, hasRetainedDestination, subscriptionRes, why } from "./common";

const ID = "AZ-LOG-1" as const;
const R = reasons(ID);
const F = findings(ID);
const DOC_ACTIVITY = "https://learn.microsoft.com/en-us/azure/azure-monitor/fundamentals/activity-log";
const DOC_DIAG = "https://learn.microsoft.com/en-us/azure/azure-monitor/data-collection/diagnostic-settings";
const NEED = ["administrative", "security"] as const;

export const spec = buildSpec({
  id: ID, door: "log", maxStatus: "caution", allowsClear: true, priority: 170,
  cond: ["caution", "clear", "na", "unknown"], impact: true, question: true,
  paths: ["collector"],
  params: [{ name: "categories", value: ["Administrative", "Security"], basis: "tool-default" }],
  cannotSee: 3, falsePositives: 2,
  fix: {
    impact: "low", prodImpact: false,
    observe: { doc: DOC_ACTIVITY, commands: [] },
    change: {
      property: "Diagnostic setting (Administrative · Security → Log Analytics workspace or Storage account)",
      doc: DOC_DIAG,
      commands: [write("az", "az monitor diagnostic-settings subscription create --name [[diagnostic-setting-name]] --location [[region]] --workspace [[workspace-resource-id]] --logs [[log-categories]]")],
    },
    revert: { commands: [write("az", "az monitor diagnostic-settings subscription delete --name [[diagnostic-setting-name]]")] },
    runbook: null,
  },
  guide: null,
  basis: [
    { name: "activity-log", url: DOC_ACTIVITY, kind: "doc" },
    { name: "diagnostic-settings", url: DOC_DIAG, kind: "doc" },
  ],
  incident: null,
  lastVerified: "2026-10-19",
  families: { item: "azure.log.subscriptions", needs: [] },
  calls: ["azure:account.list", "azure:monitor.diagnostic-settings.subscription.list"],
  reasons: {
    "subscriptions-no-export": ["n"], "all-exported": ["n"], "na-no-subscriptions": [], "no-export": [], "categories-missing": [], "destination-not-retained": [], "exported": [],
  },
  facts: { "missing-category": ["category"], "export-destination-workspace": [], "export-destination-storage": [] },
  how: true,
  fixtures: {
    pass: "micro/AZ-LOG-1/pass",
    violate: ["micro/AZ-LOG-1/no-export", "micro/AZ-LOG-1/categories-missing"],
    denied: { call: "azure:monitor.diagnostic-settings.subscription.list", expect: "unknown" },
    truncated: { call: "azure:monitor.diagnostic-settings.subscription.list", expect: "unknown" },
    missingField: { path: "doors.log.data.activityLogExports[0].items", expect: "unknown" },
    versionMismatch: "auto",
  },
});

const label = (c: string): string => (c === "administrative" ? "Administrative" : c === "security" ? "Security" : c);

function evalSettings(settings: readonly AzureDiagSetting[]): { slug: string; missing: string[]; unknown: boolean; dests: string[] } {
  const retained = enabledCategories(settings, hasRetainedDestination, null);
  const any = enabledCategories(settings, hasAnyDestination, null);
  const has = (cats: ReturnType<typeof enabledCategories>, c: string): boolean => cats.allLogs || cats.cats.has(c);
  if (NEED.every((c) => has(retained, c))) {
    const dests = [...new Set(settings.filter(hasRetainedDestination).flatMap((s) => [...(s.destinations.workspace ? ["workspace"] : []), ...(s.destinations.storage ? ["storage"] : [])]))];
    return { slug: "exported", missing: [], unknown: false, dests };
  }
  if (settings.length === 0) return { slug: "no-export", missing: NEED.map(label), unknown: false, dests: [] };
  if (retained.auditOnlyUnknown || any.auditOnlyUnknown) return { slug: "unknown", missing: [], unknown: true, dests: [] };
  if (NEED.every((c) => has(any, c))) return { slug: "destination-not-retained", missing: [], unknown: false, dests: [] };
  const missing = NEED.filter((c) => !has(retained, c)).map(label);
  return { slug: "categories-missing", missing, unknown: false, dests: [] };
}

function evaluate(ctx: RuleCtx<AzureLogData>) {
  const members: Member[] = [];
  for (const per of ctx.data.activityLogExports) {
    const res = subscriptionRes(ctx.data, per.subscription);
    const s = per.items;
    if (s.k !== "value") { members.push(mUnknown(res, why(s), evs(s.src))); continue; }
    const r = evalSettings(s.value);
    const e = evs(s.src);
    if (r.unknown) { members.push(mUnknown(res, "value-unrecognized", e)); continue; }
    const facts = [...r.missing.map((c) => fact("missing-category", { category: { c } })), ...r.dests.map((d) => fact(d === "workspace" ? "export-destination-workspace" : "export-destination-storage"))];
    members.push(r.slug === "exported" ? mClear(res, R("exported"), e, { facts }) : mCaution(res, F(r.slug), e, { facts }));
  }
  return { members, coverage: ctx.scope };
}

export const AZ_LOG_1 = defineRule<"azure", "log">({
  spec, evaluate,
  explain: (x) => (x.status === "na" ? { msg: R("na-no-subscriptions") } : x.status === "clear" ? { msg: R("all-exported", { n: N(x.applicable ?? x.members.length) }) } : { msg: R("subscriptions-no-export", { n: N(x.members.length) }) }),
});
