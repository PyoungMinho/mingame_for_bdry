// src/lib/cloudcheck/engine/judge.ts — judge(input): Report  (순수 함수, 예외를 던지지 않는다)
//  - 현재 시각·예외 파일·본인 응답을 받지 않는다(INV-8, INV-9). 같은 입력이면 바이트 단위로 같은 Report가 나온다.
//  - 어떤 이유로든 판정이 깨지면 '전부 확인 불가 + 배너' Report를 돌려준다(INV-1, INV-2).
import { DOORS, REPORT_MODEL } from "../model/report";
import type { Cloud, Distribution, DoorId, DoorResult, IdentityBlock, Report, RuleResult } from "../model/report";
import type { NormalizedInput } from "../contract/normalized";
import { RULES } from "../rules/registry";
import { RULESET_VERSION } from "../rules/version";
import { buildBanners, buildCollection, buildDoors, buildFirstLook, buildIdentity, buildManual, buildPermissions, buildScope } from "./blocks";
import { createDisplay } from "./display";
import type { BuildCtx } from "./items";
import { coverageLookup } from "./proof";
import { resolutionFor } from "./reasons";
import { ref } from "./msg";
import { distributionOf, runRule } from "./run";
import type { RuleRun } from "./run";

export const ENGINE_VERSION = "1.0.0";

const GLOBAL_CANNOT_SEE = ["leaked-keys", "issued-sas-oauth", "other-accounts", "abandoned-test-envs", "app-vulnerabilities", "idp-mfa", "resource-policy-sharing"] as const;

function sumDistributions(ds: readonly Distribution[]): Distribution {
  const out = { total: 0, risk: 0, caution: 0, unknown: 0, clear: 0, na: 0 };
  for (const d of ds) { out.total += d.total; out.risk += d.risk; out.caution += d.caution; out.unknown += d.unknown; out.clear += d.clear; out.na += d.na; }
  return out;
}

function judgeInput(input: NormalizedInput): Report {
  const cloud: Cloud = input.cloud;
  if (cloud !== "aws" && cloud !== "azure") throw new Error("unknown cloud");
  const modules = RULES.filter((m) => m.spec.cloud === cloud && m.spec.released);
  const display = createDisplay();
  const doors = input.doors as unknown as Record<DoorId, { readonly state: "selected" | "skipped" | "absent" }>;
  const accountKey = input.cloud === "aws" ? input.identity.accountId : input.identity.tenantId;
  const build: BuildCtx = { cloud, accountKey, display, receipts: input.receipts, doorState: (door) => doors[door as DoorId]?.state ?? "absent" };
  const table = coverageLookup(input);

  const identity = buildIdentity(input, display);
  const scope = buildScope(input, table, display);
  const runs: RuleRun[] = modules.map((m) => runRule(m, { input, build, table }));
  const collection = buildCollection(input, display);
  const permissions = buildPermissions(input, runs, build);
  const banners = buildBanners(input);
  const manualChecklist = buildManual(input, table, runs);
  const manualByDoor = new Map<DoorId, number>();
  for (const m of manualChecklist) if (m.door !== null) manualByDoor.set(m.door, (manualByDoor.get(m.door) ?? 0) + 1);
  const doorResults = buildDoors(input, table, runs, manualByDoor);
  const results: RuleResult[] = runs.map((r) => r.result);

  return {
    model: REPORT_MODEL,
    engine: { version: ENGINE_VERSION, rulesetVersion: RULESET_VERSION },
    mode: input.mode,
    identity, scope, collection, permissions,
    cannotSee: [...GLOBAL_CANNOT_SEE],
    distribution: { rules: distributionOf(results.map((r) => r.status)), items: sumDistributions(results.map((r) => r.distribution)) },
    banners,
    doors: doorResults,
    firstLook: buildFirstLook(results),
    manualChecklist,
  };
}

/** 판정이 깨졌을 때의 안전망: 모든 점검이 확인 불가(parse-failed)이고 배너가 이유를 알린다. 정적 데이터만 쓰므로 입력이 어떤 모양이어도 만들어진다 */
/** 속성에 닿으면 던지는 입력(손상된 객체 · Proxy)에도 안전망이 깨지지 않게, 읽기를 전부 감싼다 */
function attempt<T>(read: () => T, fallback: T): T {
  try { return read(); } catch { return fallback; }
}

export function failClosedReport(input: unknown): Report {
  const guess = attempt(() => (input as { cloud?: unknown } | null | undefined)?.cloud, undefined);
  const cloud: Cloud = guess === "azure" ? "azure" : "aws";
  const safeMode: Report["mode"] = attempt((): Report["mode"] => {
    const mode = (input as { mode?: Report["mode"] } | null | undefined)?.mode;
    if (mode === undefined || mode === null) return { kind: "real" };
    if (mode.kind === "demo") return { kind: "demo", setId: mode.setId };
    return { kind: "real" };
  }, { kind: "real" });
  const modules = RULES.filter((m) => m.spec.cloud === cloud && m.spec.released);
  const resolution = resolutionFor("parse-failed");
  const results: RuleResult[] = modules.map((m) => ({
    ruleId: m.spec.ruleId, cloud, door: m.spec.door, priority: m.spec.priority, items: [], distribution: distributionOf([]), labels: [], inputIndex: null,
    status: "unknown", why: ref("parse-failed"), gaps: ["parse-failed"], asOf: null,
    coverage: { kind: "none", covered: null, total: null, proven: false, population: null }, resolution,
  }));
  const doorResults: DoorResult[] = DOORS.map((door) => {
    const rules = results.filter((r) => r.door === door).sort((a, b) => a.priority - b.priority);
    return {
      door, worstStatus: "unknown", rules, distribution: distributionOf(rules.map((r) => r.status)), manualCount: 1,
      collection: { status: "not-collected", judgeLevel: "none", reason: ref("parse-failed"), asOf: null, inputIndex: null },
    };
  });
  const unknownId: IdentityBlock = {
    cloud, account: { kind: "plain", text: "-" }, accountLast4: "----", alias: null, currentSubscription: null,
    principalType: "unknown", principalName: null, source: cloud === "aws" ? "csv-arn" : "csv-tenant", confirmed: null,
  };
  return {
    model: REPORT_MODEL,
    engine: { version: ENGINE_VERSION, rulesetVersion: RULESET_VERSION },
    mode: safeMode,
    identity: unknownId,
    scope: { unit: "none", checked: null, visible: null, missing: [], outOfScope: [], subscriptions: [], proven: false },
    collection: { asOf: null, asOfRange: null, credentialReport: null, receipts: { ok: 0, empty: 0, notconfigured: 0, denied: 0, error: 0, throttled: 0, truncated: 0, unsupported: 0, total: 0 }, inputs: [] },
    permissions: { denied: [], unlockHints: [] },
    cannotSee: [...GLOBAL_CANNOT_SEE],
    distribution: { rules: distributionOf(results.map((r) => r.status)), items: distributionOf([]) },
    banners: [{ kind: "areas-not-judged", doors: [...DOORS], reason: "schema-section" }],
    doors: doorResults,
    firstLook: { mode: "unlock", groups: [{ resolution, ruleIds: results.map((r) => r.ruleId) }] },
    manualChecklist: DOORS.map((door) => ({
      id: `m|${door}|-|out-of-scope`, origin: "out-of-scope" as const, door, ruleId: null, resource: null, what: ref("fact:out-of-scope" as const), why: null,
      howKey: "cc.rule.common.how-not-collected" as const, resolution,
    })),
  };
}

export function judge(input: NormalizedInput): Report {
  try {
    return judgeInput(input);
  } catch {
    return failClosedReport(input);
  }
}
