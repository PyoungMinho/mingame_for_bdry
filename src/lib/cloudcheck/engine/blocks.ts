// src/lib/cloudcheck/engine/blocks.ts — Report의 리포트 수준 블록 조립 (신원·범위·수집·권한·배너·문·먼저 볼 것·직접 볼 목록)
// 모두 입력(NormalizedInput)과 룰 실행 결과(RuleRun)의 순수 함수다. 현재 시각을 보지 않는다(INV-9).
import { AWS_FAMILIES, AZURE_FAMILIES, familyDoor } from "../contract/normalized";
import type {
  AwsIdentity, AzureIdentity, AwsKeyData, AwsMfaData, AwsNetData, AzureScope, DoorSelection, FamilyCoverage, FamilyId, InputFacts, NormalizedInput,
  ReceiptFact, ReceiptKey, AzureSubscription,
} from "../contract/normalized";
import { SUPPORTED } from "../contract/collect-schema";
import { DOORS, STATUS_ORDER } from "../model/report";
import type {
  AsOf, Banner, CollectionBlock, DeniedCall, DisplayValue, DoorCollection, DoorId, DoorResult, FirstLook, IdentityBlock, InputSummary, IsoUtc,
  ManualCheckItem, PermissionHint, PermissionsBlock, PrincipalType, ReceiptResult, RuleId, RuleResult, ScopeBlock, Status, UnknownReason,
} from "../model/report";
import { isSoundComplete } from "./proof";
import type { CoverageLookup } from "./proof";
import type { Display } from "./display";
import { last4Of } from "./display";
import { ref } from "./msg";
import type { BuildCtx } from "./items";
import { permissionOf, resolutionFor, resolutionKey, sortReasons } from "./reasons";
import { FUTURE_SKEW_MINUTES, MINUTE_MS } from "../rules/params";
import { distributionOf } from "./run";
import type { RuleRun } from "./run";

const doorsOf = (input: NormalizedInput): Readonly<Record<DoorId, DoorSelection<unknown>>> => input.doors as unknown as Record<DoorId, DoorSelection<unknown>>;
const toAsOf = (a: { readonly at: { readonly iso: IsoUtc }; readonly source: AsOf["source"] } | null): AsOf | null => (a === null ? null : { at: a.at.iso, source: a.source });
const usedDoor = (f: InputFacts): boolean => DOORS.some((d) => f.doors[d] === "used");

/* ───────── 신원 ───────── */
export function buildIdentity(input: NormalizedInput, d: Display): IdentityBlock {
  const principalName = (name: string | null, t: PrincipalType): DisplayValue | null =>
    name === null ? null : d.sens({ type: t === "iam-user" ? "userName" : t === "assumed-role" ? "roleName" : "principal", value: name });
  if (input.cloud === "aws") {
    const id: AwsIdentity = input.identity;
    const account = d.sens({ type: "accountId", value: id.accountId });
    return {
      cloud: "aws", account, accountLast4: account.kind === "sensitive" ? last4Of(account.full) : "----",
      alias: id.alias.k === "value" ? d.sens({ type: "alias", value: id.alias.value }) : null,
      currentSubscription: null, principalType: id.principalType, principalName: principalName(id.principalName, id.principalType),
      source: id.source, confirmed: id.confirmed,
    };
  }
  const id: AzureIdentity = input.identity;
  const account = d.sens({ type: "tenantId", value: id.tenantId });
  return {
    cloud: "azure", account, accountLast4: account.kind === "sensitive" ? last4Of(account.full) : "----",
    alias: null, currentSubscription: id.currentSubscription === null ? null : d.sens({ type: "subscriptionId", value: id.currentSubscription }),
    principalType: id.principalType, principalName: null, source: id.source, confirmed: id.confirmed,
  };
}

/* ───────── 조회 범위 ───────── */
const familiesOf = (cloud: NormalizedInput["cloud"]): readonly FamilyId[] => (cloud === "aws" ? AWS_FAMILIES : AZURE_FAMILIES);

export function buildScope(input: NormalizedInput, table: CoverageLookup, d: Display): ScopeBlock {
  const none: ScopeBlock = { unit: "none", checked: null, visible: null, missing: [], outOfScope: [], subscriptions: [], proven: false };
  const doors = doorsOf(input);
  if (input.cloud === "aws") {
    const net = doors.net;
    if (net.state !== "selected") return none;
    const data = net.data as AwsNetData;
    if (data.regions.k !== "value") return none;
    const regions = [...data.regions.value].sort();
    const fams = ["aws.net.security-groups", "aws.net.enis"].map((f) => table[f]).filter((f): f is FamilyCoverage => f !== undefined);
    const requested = data.regionsRequested;
    let checked = 0;
    const missing: ScopeBlock["missing"][number][] = [];
    const outOfScope: ScopeBlock["outOfScope"][number][] = [];
    for (const r of regions) {
      if (requested !== null && !requested.includes(r)) { outOfScope.push({ name: d.plain(r), reason: "not-requested" }); continue; }
      const units = fams.map((f) => f.units.find((u) => u.unit === r));
      const bad = units.find((u) => u === undefined || u.state !== "ok");
      if (bad === undefined && units.length > 0) { checked++; continue; }
      const why: UnknownReason = bad !== undefined && bad.why !== null ? bad.why : "region-missing";
      missing.push({ name: d.plain(r), reason: why, receiptId: bad === undefined ? null : bad.receipt });
    }
    const proven = fams.length === 2 && missing.length === 0 && fams.every((f) => isSoundComplete(f, f.family));
    return { unit: "region", checked, visible: regions.length, missing, outOfScope, subscriptions: [], proven };
  }
  // Azure: 보이는 구독 목록은 선택된 문 중 값이 있는 첫 데이터에서
  let subs: readonly AzureSubscription[] | null = null;
  let requested: readonly string[] | null = null;
  for (const door of DOORS) {
    const sel = doors[door];
    if (sel.state !== "selected") continue;
    const data = sel.data as Partial<AzureScope>;
    const slot = data.subscriptions;
    if (slot !== undefined && slot.k === "value") { subs = slot.value; requested = data.subscriptionsRequested ?? null; break; }
  }
  if (subs === null) return none;
  const unitFams = familiesOf("azure").map((f) => table[f]).filter((f): f is FamilyCoverage => f !== undefined && f.units.length > 0);
  const stateOf = (id: string): ScopeBlock["subscriptions"][number]["queried"] => {
    const states = unitFams.flatMap((f) => f.units.filter((u) => u.unit === id).map((u) => u.state));
    if (states.length === 0) return "not-queried";
    if (states.includes("failed")) return "failed";
    if (states.includes("partial")) return "partial";
    if (states.every((s) => s === "not-queried")) return "not-queried";
    return "ok";
  };
  const sorted = [...subs].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  const inScope = sorted.filter((s) => s.inScope);
  const missing: ScopeBlock["missing"][number][] = [];
  let checked = 0;
  for (const s of inScope) {
    const st = stateOf(s.id);
    if (st === "ok") { checked++; continue; }
    if (st === "failed" || st === "partial") {
      const bad = unitFams.flatMap((f) => f.units.filter((u) => u.unit === s.id && u.state !== "ok"))[0];
      missing.push({ name: d.sens({ type: "subscriptionName", value: s.name }), reason: bad !== undefined && bad.why !== null ? bad.why : "subscription-missing", receiptId: bad === undefined ? null : bad.receipt });
    }
  }
  // --subscriptions로 요청했는데 보이는 구독 목록에 없는 구독: 범위 안이라고 말한 구독을 한 번도 못 봤으므로 빠진 구독이다 → 범위는 증명되지 않는다(CC-QA-11)
  const visibleIds = new Set(sorted.map((s) => s.id.trim().toLowerCase()));
  const unseen = [...new Set((requested ?? []).map((r) => r.trim().toLowerCase()))].filter((id) => id !== "" && !visibleIds.has(id)).sort();
  for (const id of unseen) missing.push({ name: d.sens({ type: "subscriptionId", value: id }), reason: "subscription-missing", receiptId: null });
  const outOfScope = sorted.filter((s) => !s.inScope && s.outOfScopeReason !== null)
    .map((s) => ({ name: d.sens({ type: "subscriptionName", value: s.name }), reason: s.outOfScopeReason as NonNullable<AzureSubscription["outOfScopeReason"]> }));
  const subscriptions = sorted.map((s) => ({ id: d.sens({ type: "subscriptionId", value: s.id }), name: d.sens({ type: "subscriptionName", value: s.name }), state: d.constant(s.state), queried: stateOf(s.id) }));
  const proven = inScope.length > 0 && missing.length === 0 && inScope.every((s) => stateOf(s.id) === "ok");
  return { unit: "subscription", checked, visible: sorted.length, missing, outOfScope, subscriptions, proven };
}

/* ───────── 수집 ───────── */
export function buildCollection(input: NormalizedInput, d: Display): CollectionBlock {
  const used = input.inputs.filter(usedDoor);
  const dated = used.filter((f) => f.asOf !== null).map((f) => f.asOf as NonNullable<InputFacts["asOf"]>);
  let asOf: AsOf | null = null;
  let range: CollectionBlock["asOfRange"] = null;
  if (dated.length > 0) {
    const sorted = [...dated].sort((a, b) => a.at.ms - b.at.ms);
    asOf = toAsOf(sorted[0]);
    const newest = sorted[sorted.length - 1];
    if (newest.at.ms !== sorted[0].at.ms) range = { oldest: sorted[0].at.iso, newest: newest.at.iso };
  }

  let credentialReport: CollectionBlock["credentialReport"] = null;
  if (input.cloud === "aws") {
    const doors = doorsOf(input);
    for (const door of ["key", "mfa"] as const) {
      const sel = doors[door];
      if (sel.state !== "selected") continue;
      const slot = (sel.data as AwsKeyData | AwsMfaData).credentialReport;
      if (slot.k === "value" || slot.k === "partial") {
        credentialReport = { generatedAt: slot.value.generatedAt === null ? null : slot.value.generatedAt.iso, source: slot.value.generatedAtSource };
        break;
      }
    }
  }

  const counts: Record<ReceiptResult, number> = { ok: 0, empty: 0, notconfigured: 0, denied: 0, error: 0, throttled: 0, truncated: 0, unsupported: 0 };
  let total = 0;
  for (const r of input.receipts.values()) if (r.used) { counts[r.result]++; total++; }

  const inputs: InputSummary[] = input.inputs.map((f) => ({
    index: f.index, kind: f.kind, via: f.via,
    name: f.via === "demo" ? d.plain(f.name) : d.sens({ type: "fileName", value: f.name }),
    bytes: f.bytes, asOf: toAsOf(f.asOf),
    collector: f.collector === null ? null : { name: f.collector.name, version: f.collector.version, knownRelease: f.collector.knownRelease },
    schema: f.schema, doors: f.doors, scopeProven: f.scopeProven,
  }));
  return { asOf, asOfRange: range, credentialReport, receipts: { ...counts, total }, inputs };
}

/* ───────── 권한 ───────── */
export function buildPermissions(input: NormalizedInput, runs: readonly RuleRun[], build: BuildCtx): PermissionsBlock {
  type Group = { call: string; permission: string | null; scope: DisplayValue; errorCode: string; ids: ReceiptKey[]; };
  const groups = new Map<string, Group>();
  for (const r of input.receipts.values()) {
    if (!r.used || r.result !== "denied") continue;
    const scopeKey = r.subscription ?? r.region ?? "global";
    const errorCode = r.errorCode ?? "-";
    const key = `${r.call}|${scopeKey}|${errorCode}`;
    let g = groups.get(key);
    if (g === undefined) {
      const scope = r.subscription !== null ? build.display.sens({ type: "subscriptionId", value: r.subscription }) : build.display.plain(r.region ?? "global");
      g = { call: r.call, permission: permissionOfCall(r), scope, errorCode: build.display.constant(errorCode), ids: [] };
      groups.set(key, g);
    }
    g.ids.push(r.key);
  }
  const ruleIdsOf = (call: string): RuleId[] =>
    runs.filter((x) => (x.mod.spec.calls as readonly string[]).includes(call)).map((x) => x.mod.spec.ruleId);
  const denied: DeniedCall[] = [...groups.values()].map((g) => ({
    call: g.call, permission: g.permission, scope: g.scope, errorCode: g.errorCode, receiptIds: [...g.ids].sort(), times: g.ids.length, ruleIds: ruleIdsOf(g.call),
  })).sort((a, b) => b.times - a.times || (a.call < b.call ? -1 : a.call > b.call ? 1 : 0) || (a.errorCode < b.errorCode ? -1 : a.errorCode > b.errorCode ? 1 : 0));

  const byPerm = new Map<string, { ruleId: RuleId; items: number; priority: number }[]>();
  for (const run of runs) {
    for (const [perm, n] of run.unlock) {
      if (n <= 0) continue;
      const list = byPerm.get(perm) ?? [];
      list.push({ ruleId: run.mod.spec.ruleId, items: n, priority: run.mod.spec.priority });
      byPerm.set(perm, list);
    }
  }
  const unlockHints: PermissionHint[] = [...byPerm.entries()].map(([permission, list]) => {
    const unlocks = [...list].sort((a, b) => b.items - a.items || a.priority - b.priority).map(({ ruleId, items }) => ({ ruleId, items }));
    return { permission, unlocks, total: unlocks.reduce((s, u) => s + u.items, 0) };
  }).sort((a, b) => b.total - a.total || (a.permission < b.permission ? -1 : a.permission > b.permission ? 1 : 0));
  return { denied, unlockHints };
}

const permissionOfCall = (r: ReceiptFact): string | null => permissionOf(r.call);

/* ───────── 배너 ───────── */
export function buildBanners(input: NormalizedInput): Banner[] {
  const out: Banner[] = [];
  if (input.notices.redactions > 0) out.push({ kind: "secrets-detected", count: input.notices.redactions });
  for (const reason of ["schema-section", "field-missing"] as const) {
    const doors = DOORS.filter((door) => input.notices.sectionIssues.some((i) => i.door === door && i.reason === reason));
    if (doors.length > 0) out.push({ kind: "areas-not-judged", doors, reason });
  }
  const newer = input.inputs.filter((f) => f.schema !== null && f.schema.support === "newer-minor");
  if (newer.length > 0) {
    const minors = newer.map((f) => (f.schema === null ? "" : f.schema.id.split("/")[1] ?? "")).sort((a, b) => Number(a.split(".")[1] ?? 0) - Number(b.split(".")[1] ?? 0));
    out.push({ kind: "schema-newer-minor", got: minors[minors.length - 1], supported: `${SUPPORTED.major}.${SUPPORTED.maxMinor}` });
  }
  if (input.identity.confirmed === null) out.push({ kind: "identity-unconfirmed" });
  if (input.inputs.some((f) => f.collector !== null && f.collector.knownRelease === false)) out.push({ kind: "collector-unknown-release" });
  const used = input.inputs.filter(usedDoor);
  if (used.some((f) => f.kind !== "collector-json" && !f.scopeProven)) out.push({ kind: "csv-scope-unproven" });
  if (used.some((f) => f.asOf !== null && (f.asOf.source === "filename" || f.asOf.source === "file-time"))) out.push({ kind: "collected-at-approximate" });
  // 입력 안에 기준 시각보다 허용치(5분)를 넘게 늦은 기록이 있다: 수집한 기기의 시계가 늦었거나 기준 시각을 파일 이름·수정 시각에서 잘못 읽었다(CC-QA-01).
  // 기준 시각 후보를 2000년 이전이라는 이유로 버린 입력(asOfRejected)은 기준 시각이 없어 비교할 수 없다 — 그 설명 문구는 아직 없어 알림을 더하지 않는다
  if (used.some((f) => f.asOf !== null && f.latestEvidence !== undefined && f.latestEvidence !== null && f.latestEvidence.ms > f.asOf.at.ms + FUTURE_SKEW_MINUTES * MINUTE_MS)) out.push({ kind: "as-of-before-evidence" });
  const skipped = DOORS.filter((door) => doorsOf(input)[door].state === "skipped");
  if (skipped.length > 0) out.push({ kind: "doors-skipped", doors: skipped });
  const ignored = input.inputs.filter((f) => !usedDoor(f)).length;
  if (ignored > 0) out.push({ kind: "duplicate-input-ignored", count: ignored });
  return out;
}

/* ───────── 문 ───────── */
/** 이 패밀리에서 아무것도 모으지 못했다: 범위 표에 없거나, 미완결이고 영수증 0 · 항목 0 · 빈틈이 '수집 안 함'뿐이다. 손상된 값은 '모았다'로 본다(보수적으로 일부 수집) */
function nothingCollectedIn(c: unknown): boolean {
  if (c === undefined) return true;
  if (typeof c !== "object" || c === null) return false;
  const x = c as Partial<FamilyCoverage>;
  return x.complete === false && x.present === 0 && Array.isArray(x.receipts) && x.receipts.length === 0
    && Array.isArray(x.gaps) && x.gaps.length > 0 && x.gaps.every((g) => g === "not-collected");
}
/**
 * 문이 '선택'됐는데 그 문의 패밀리가 전부 '수집 안 함'뿐이면 실제로는 아무것도 수집하지 않은 것이다.
 * 일부만 수집됐다고 말하면 과장이므로 문 단위로는 수집 안 함으로 다룬다(체험 데이터가 Azure 현관을 '수집함'으로 적어 '일부만 수집됨'으로 보였던 일에서 확인).
 * 판정 자체는 그대로다: 룰은 확인 불가(not-collected)이고, 증거를 줄이거나 늘리지 않는다.
 */
function nothingCollected(input: NormalizedInput, table: CoverageLookup, door: DoorId): boolean {
  const fams = familiesOf(input.cloud).filter((f) => familyDoor(f) === door);
  return fams.length > 0 && fams.every((f) => nothingCollectedIn(table[f]));
}

export function buildDoorCollection(input: NormalizedInput, table: CoverageLookup, door: DoorId): DoorCollection {
  const sel = doorsOf(input)[door];
  if (sel.state !== "selected" || nothingCollected(input, table, door)) {
    return { status: "not-collected", judgeLevel: "none", reason: ref("not-collected"), asOf: null, inputIndex: null };
  }
  const fams = familiesOf(input.cloud).filter((f) => familyDoor(f) === door).map((f) => table[f]).filter((f): f is FamilyCoverage => f !== undefined);
  const incomplete = fams.filter((f) => !isSoundComplete(f, f.family));
  const gaps = sortReasons(incomplete.flatMap((f) => [...f.gaps]));
  const proven = input.inputs[sel.input]?.scopeProven === true;
  return {
    status: incomplete.length === 0 ? "collected" : "partial",
    judgeLevel: proven ? "full" : "findings-only",
    reason: gaps.length === 0 ? null : ref(gaps[0]),
    asOf: toAsOf(sel.asOf), inputIndex: sel.input,
  };
}

const statusRank = (s: Status): number => STATUS_ORDER.indexOf(s);

export function buildDoors(input: NormalizedInput, table: CoverageLookup, runs: readonly RuleRun[], manualByDoor: ReadonlyMap<DoorId, number>): DoorResult[] {
  return DOORS.map((door): DoorResult => {
    const rules: RuleResult[] = runs.filter((r) => r.mod.spec.door === door).map((r) => r.result)
      .sort((a, b) => statusRank(a.status) - statusRank(b.status) || a.priority - b.priority);
    const worst = rules.length === 0 ? "unknown" : rules.reduce<Status>((w, r) => (statusRank(r.status) < statusRank(w) ? r.status : w), rules[0].status);
    return {
      door, worstStatus: worst, collection: buildDoorCollection(input, table, door), rules,
      distribution: distributionOf(rules.map((r) => r.status)), manualCount: manualByDoor.get(door) ?? 0,
    };
  });
}

/* ───────── 먼저 볼 것 ───────── */
export function buildFirstLook(rules: readonly RuleResult[]): FirstLook {
  const positives = rules.filter((r) => r.status === "risk" || r.status === "caution")
    .sort((a, b) => statusRank(a.status) - statusRank(b.status) || a.priority - b.priority);
  const unknowns = rules.filter((r) => r.status === "unknown").sort((a, b) => a.priority - b.priority);
  if (positives.length > 0) {
    const ids = [...positives, ...unknowns].slice(0, 3).map((r) => r.ruleId);
    return { mode: "findings", ruleIds: ids };
  }
  if (unknowns.length > 0) {
    const groups = new Map<string, { resolution: NonNullable<Extract<RuleResult, { status: "unknown" }>["resolution"]>; rules: RuleResult[] }>();
    for (const r of unknowns) {
      if (r.status !== "unknown") continue;
      const k = resolutionKey(r.resolution);
      const g = groups.get(k) ?? { resolution: r.resolution, rules: [] };
      g.rules.push(r);
      groups.set(k, g);
    }
    const list = [...groups.entries()].map(([key, g]) => ({ key, resolution: g.resolution, ruleIds: g.rules.map((r) => r.ruleId), minPriority: Math.min(...g.rules.map((r) => r.priority)) }))
      .sort((a, b) => b.ruleIds.length - a.ruleIds.length || a.minPriority - b.minPriority || (a.key < b.key ? -1 : a.key > b.key ? 1 : 0))
      .slice(0, 3).map((g) => ({ resolution: g.resolution, ruleIds: g.ruleIds }));
    return { mode: "unlock", groups: list };
  }
  return { mode: "none-found" };
}

/* ───────── 직접 볼 목록 ───────── */
export function buildManual(input: NormalizedInput, table: CoverageLookup, runs: readonly RuleRun[]): ManualCheckItem[] {
  const out: { door: DoorId; priority: number; order: number; item: ManualCheckItem }[] = [];
  const doors = doorsOf(input);
  const howNotCollected = "cc.rule.common.how-not-collected" as const;
  for (const door of DOORS) {
    const sel = doors[door];
    const doorRuns = runs.filter((r) => r.mod.spec.door === door);
    if (doorRuns.length === 0) continue;
    const uncollected = sel.state !== "selected" || nothingCollected(input, table, door);
    // 문 전체가 수집되지 않았다: 점검마다 나열하지 않고 영역 하나로 알린다(회색 과다 방지)
    // 가이드 룰(AZ-MFA-G)은 문 수집 여부와 무관하게 안내 카드를 낸다. 가이드 룰만 있는 문(Azure 현관)은 영역 항목을 따로 내지 않는다:
    // 나열을 대신할 자동 판정 룰이 없고, 가이드 카드가 그 문의 안내를 맡으며, '수집기를 다시 실행할 때 이 문을 포함'은 Azure 현관에는 맞지 않는 안내다(수집기에 mfa 문이 없다)
    if (uncollected && doorRuns.some((r) => r.mod.spec.kind !== "guide")) {
      out.push({
        door, priority: 0, order: 0,
        item: {
          id: `m|${door}|-|out-of-scope`, origin: "out-of-scope", door, ruleId: null, resource: null,
          what: ref("fact:out-of-scope" as const), why: null, howKey: howNotCollected, resolution: resolutionFor("not-collected", { doorState: sel.state }),
        },
      });
    }
    for (const run of doorRuns) {
      const spec = run.mod.spec;
      const res = run.result;
      if (spec.kind === "guide") {
        out.push({
          door, priority: spec.priority, order: 1,
          item: { id: `m|${door}|${spec.ruleId}|guide`, origin: "guide-card", door, ruleId: spec.ruleId, resource: null, what: ref("fact:guide-card" as const), why: null, howKey: spec.manualHowKey, resolution: { kind: "guide", permissions: [] } },
        });
        continue;
      }
      if (uncollected) continue;
      if (res.status === "na" && spec.autoNotice !== null) {
        out.push({
          door, priority: spec.priority, order: 2,
          item: { id: `m|${door}|${spec.ruleId}|auto`, origin: "auto-notice", door, ruleId: spec.ruleId, resource: null, what: ref(spec.autoNotice.what), why: null, howKey: spec.autoNotice.howKey, resolution: null },
        });
      }
      const unknownItems = res.items.filter((i) => i.status === "unknown");
      unknownItems.forEach((it, idx) => {
        if (it.status !== "unknown") return;
        out.push({
          door, priority: spec.priority, order: 3 + idx / 1e6,
          item: { id: `m|${door}|${spec.ruleId}|${it.id}`, origin: "unknown-item", door, ruleId: spec.ruleId, resource: it.resource, what: ref("fact:manual-check" as const), why: it.why, howKey: spec.manualHowKey, resolution: it.resolution },
        });
      });
      if (res.status === "unknown" && unknownItems.length === 0) {
        out.push({
          door, priority: spec.priority, order: 4,
          item: { id: `m|${door}|${spec.ruleId}|rule`, origin: "unknown-rule", door, ruleId: spec.ruleId, resource: null, what: ref("fact:manual-check" as const), why: res.why, howKey: spec.manualHowKey, resolution: res.resolution },
        });
      }
      // 위험·주의인데 범위가 증명되지 않았고 확인 불가 대상이 없다: 보지 못한 나머지 대상이 있다는 사실 한 건(CC-QA-06 — 꼬리표가 '일부만'을 말하는 점검에 짝)
      if ((res.status === "risk" || res.status === "caution") && run.rest !== null) {
        out.push({
          door, priority: spec.priority, order: 5,
          item: { id: `m|${door}|${spec.ruleId}|rest`, origin: "unknown-rule", door, ruleId: spec.ruleId, resource: null, what: ref("fact:manual-rest" as const), why: run.rest.why, howKey: spec.manualHowKey, resolution: run.rest.resolution },
        });
      }
    }
  }
  const doorIndex = (d: DoorId): number => DOORS.indexOf(d);
  return out.sort((a, b) => doorIndex(a.door) - doorIndex(b.door) || a.priority - b.priority || a.order - b.order).map((x) => x.item);
}
