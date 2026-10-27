// src/lib/cloudcheck/engine/run.ts — 룰 하나를 실행해 RuleResult를 만든다 (예외를 던지지 않는다)
//  - 문(door)이 선택되지 않았으면 판정 함수를 부르지 않고 '수집 안 함'(확인 불가)으로 둔다.
//  - 가이드 룰은 항상 확인 불가(guide-only)다.
//  - 판정 함수가 던지거나 모양이 틀린 결과를 주면 그 룰만 확인 불가(parse-failed)다(INV-1: 실패하면 '없음'이 아니라 모름).
import type { AsOfFact, DoorSelection, FamilyCoverage, ReceiptFact, ReceiptKey, Slot, AwsCredentialReport } from "../contract/normalized";
import type {
  AsOf, Cloud, Coverage, Distribution, DoorId, FindingReason, ItemResult, Label, MsgRef, ProvenCoverage, Resolution, RuleReason, RuleResult, Status, UnknownReason,
} from "../model/report";
import { REPORT_FRESHNESS_MS } from "../rules/params";
import { aggregate } from "./aggregate";
import type { Aggregated } from "./aggregate";
import { msg } from "./msg";
import { coverageLookup, isSoundComplete, proveScope, unitForReport } from "./proof";
import type { CoverageLookup } from "./proof";
import { permissionsOfDenied, resolutionFor, sortReasons, UNKNOWN_REASON_ORDER } from "./reasons";
import { matchKeyOf, receiptsOf, resolutionOfMember, toItem, toMsgRef, unknownParams } from "./items";
import type { BuildCtx } from "./items";
import type { Member, RParam, RuleCtx, RuleModule, RuleOutcome } from "./types";
import type { NormalizedInput } from "../contract/normalized";

export interface RuleRun {
  readonly mod: RuleModule;
  readonly result: RuleResult;
  /** 권한 이름 → 이 룰에서 그 권한으로 풀리는 대상 수(권한 해제 힌트). 확인 불가가 없으면 빈 표 */
  readonly unlock: ReadonlyMap<string, number>;
  /** 원인이 된 거부 영수증(권한 패널의 ruleIds 계산용이 아니라 점검용) */
  readonly deniedCauses: readonly ReceiptKey[];
  readonly unknownItemCount: number;
  /**
   * 위험·주의 결과인데 범위가 증명되지 않았고(coverage.proven = false) 확인 불가 대상이 하나도 없을 때: 직접 볼 목록에 '보지 못한 나머지 대상' 한 건을 더할 재료
   * (예: 사용자 목록이 잘린 AWS-MFA-2 — 받은 범위의 위험·주의는 유효하지만 '없음'은 확정할 수 없다). why = 범위 빈틈 사유, resolution = 그 사유의 해소법. 그 밖에는 null(CC-QA-06).
   */
  readonly rest: { readonly why: MsgRef<UnknownReason>; readonly resolution: Resolution } | null;
}

export interface RunEnv {
  readonly input: NormalizedInput;
  readonly build: BuildCtx;
  readonly table: CoverageLookup;
}

const EMPTY_DIST: Distribution = { total: 0, risk: 0, caution: 0, unknown: 0, clear: 0, na: 0 };
const STATUS_RANK: Readonly<Record<Status, number>> = { risk: 0, caution: 1, unknown: 2, clear: 3, na: 4 };

export function distributionOf(statuses: readonly Status[]): Distribution {
  const d = { total: statuses.length, risk: 0, caution: 0, unknown: 0, clear: 0, na: 0 };
  for (const s of statuses) d[s]++;
  return d;
}

type FindingMember = Extract<Member, { readonly s: "risk" | "caution" }>;
type ClearMember = Extract<Member, { readonly s: "clear" }>;
const isFinding = (m: Member): m is FindingMember => m.s === "risk" || m.s === "caution";
const isClearMember = (m: Member): m is ClearMember => m.s === "clear";

const toAsOf = (a: AsOfFact | null): AsOf | null => (a === null ? null : { at: a.at.iso, source: a.source });

const doorsOf = (input: NormalizedInput): Readonly<Record<DoorId, DoorSelection<unknown>>> => input.doors as unknown as Record<DoorId, DoorSelection<unknown>>;

/** 보고서 기반 룰의 기준 시각: 보고서 생성 시각(있으면), 없으면 문의 기준 시각 */
function ruleAsOf(basis: "door" | "credential-report", sel: AsOfFact | null, data: unknown): AsOfFact | null {
  if (basis !== "credential-report") return sel;
  const rep = (data as { credentialReport?: Slot<AwsCredentialReport> } | null)?.credentialReport;
  if (rep !== undefined && (rep.k === "value" || rep.k === "partial") && rep.value.generatedAt !== null) {
    const src = rep.value.generatedAtSource;
    if (src === "api") return { at: rep.value.generatedAt, source: "credential-report" };
    if (src === "filename") return { at: rep.value.generatedAt, source: "filename" };
    if (src === "file-time") return { at: rep.value.generatedAt, source: "file-time" };
  }
  return sel;
}

function reportFresh(basis: "door" | "credential-report", input: NormalizedInput, inputIndex: number, doorAsOf: AsOfFact | null, data: unknown): boolean {
  if (basis !== "credential-report") return true;
  if (input.inputs[inputIndex]?.kind !== "collector-json" || doorAsOf === null) return true;
  const rep = (data as { credentialReport?: Slot<AwsCredentialReport> } | null)?.credentialReport;
  if (rep === undefined || (rep.k !== "value" && rep.k !== "partial") || rep.value.generatedAt === null) return true;
  return doorAsOf.at.ms - rep.value.generatedAt.ms <= REPORT_FRESHNESS_MS;
}

const NONE_COVERAGE: Coverage = { kind: "none", covered: null, total: null, proven: false, population: null };

/** 문이 없거나 룰을 돌릴 수 없을 때의 룰 수준 확인 불가 결과 */
function unknownRule(mod: RuleModule, cloud: Cloud, inputIndex: number | null, asOf: AsOf | null, reason: UnknownReason, resolution: Resolution, coverage: Coverage = NONE_COVERAGE, items: readonly ItemResult[] = [], params?: Readonly<Record<string, RParam>>, build?: BuildCtx, gaps?: readonly UnknownReason[]): RuleResult {
  const why: MsgRef<UnknownReason> = params === undefined || build === undefined ? { code: reason } : toMsgRef(msg(reason, params), build);
  return {
    ruleId: mod.spec.ruleId, cloud, door: mod.spec.door, priority: mod.spec.priority, items, distribution: distributionOf(items.map((i) => i.status)),
    labels: [], inputIndex, status: "unknown", why, gaps: gaps ?? [reason], asOf, coverage, resolution,
  };
}

/** 대상 id를 리포트 안에서 유일하게(같은 id가 겹치면 ~2, ~3 …) */
function uniqueIds(ruleId: string, members: readonly Exclude<Member, { s: "excluded" }>[], build: BuildCtx): string[] {
  const seen = new Map<string, number>();
  return members.map((m) => {
    const where = m.res.keyWhere === undefined ? m.res.where : m.res.keyWhere;
    const base = `${ruleId}|${build.cloud}|${build.accountKey}|${m.res.type}|${where === null || where.kind === "global" ? "-" : where.value}|${m.res.id}`;
    const n = (seen.get(base) ?? 0) + 1;
    seen.set(base, n);
    return n === 1 ? base : `${base}~${n}`;
  });
}

function labelsOf(items: readonly ItemResult[]): Label[] {
  const seen = new Set<string>();
  const out: Label[] = [];
  for (const it of items) for (const l of it.labels) {
    const k = JSON.stringify(l);
    if (!seen.has(k)) { seen.add(k); out.push(l); }
  }
  return out.sort((a, b) => (a.kind < b.kind ? -1 : a.kind > b.kind ? 1 : JSON.stringify(a) < JSON.stringify(b) ? -1 : 1));
}

/** 거부 원인 영수증: 확인 불가 구성원의 증거 + 완결이 아닌 패밀리의 영수증·범위 단위 영수증 */
function causeReceipts(agg: Aggregated, families: readonly FamilyCoverage[], build: BuildCtx): ReceiptFact[] {
  const out = new Map<ReceiptKey, ReceiptFact>();
  for (const m of agg.members) if (m.s === "unknown") for (const r of receiptsOf(m.ev, build)) out.set(r.key, r);
  for (const f of families) {
    const keys: (ReceiptKey | null)[] = [...f.receipts, ...f.units.filter((u) => u.state !== "ok").map((u) => u.receipt)];
    for (const k of keys) {
      if (k === null) continue;
      const r = build.receipts.get(k);
      if (r !== undefined) out.set(k, r);
    }
  }
  return [...out.values()];
}

/** 룰 수준 확인 불가 사유 문장의 파라미터(엔진이 채우는 것만) */
function ruleUnknownParams(code: UnknownReason, related: readonly ReceiptFact[], families: readonly FamilyCoverage[]): Readonly<Record<string, RParam>> | undefined {
  const base = unknownParams(code, related);
  if (base !== undefined) return base;
  if (code === "region-missing") {
    const names = new Set<string>();
    for (const f of families) for (const u of f.units) if (u.state !== "ok") names.add(u.unit);
    return names.size === 0 ? undefined : { regions: { c: [...names].sort().join(", ") } };
  }
  if (code === "budget-exceeded") {
    const f = families.find((x) => x.gaps.includes("budget-exceeded"));
    if (f !== undefined && f.expected !== null) return { total: { n: f.expected }, collected: { n: f.present } };
  }
  return undefined;
}

export function runRule(mod: RuleModule, env: RunEnv): RuleRun {
  const spec = mod.spec;
  const { input, build, table } = env;
  const cloud = input.cloud;
  const wrap = (result: RuleResult, unlock: ReadonlyMap<string, number> = new Map(), deniedCauses: readonly ReceiptKey[] = [], unknownItemCount = 0, rest: RuleRun["rest"] = null): RuleRun =>
    ({ mod, result, unlock, deniedCauses, unknownItemCount, rest });

  try {
    if (spec.kind === "guide" || mod.evaluate === undefined || spec.families === null) {
      return wrap(unknownRule(mod, cloud, null, null, "guide-only", resolutionFor("guide-only")));
    }
    const sel = doorsOf(input)[spec.door];
    if (sel.state !== "selected") {
      const state = sel.state;
      return wrap(unknownRule(mod, cloud, null, null, "not-collected", resolutionFor("not-collected", { doorState: state })));
    }

    const familyIds = [spec.families.item, ...spec.families.needs];
    const families = familyIds.map((f) => table[f]).filter((f): f is FamilyCoverage => f !== undefined);
    const scope = proveScope(table, spec.families.item, spec.families.needs);
    const asOfFact = ruleAsOf(spec.asOfBasis, sel.asOf, sel.data);
    const asOf = toAsOf(asOfFact);
    const ctx: RuleCtx<unknown> = {
      cloud, input, data: sel.data, inputIndex: sel.input, asOf: asOfFact, scope,
      accountId: build.accountKey, receipt: (k) => (k === null || k === undefined ? undefined : build.receipts.get(k)),
      reportFresh: reportFresh(spec.asOfBasis, input, sel.input, sel.asOf, sel.data),
    };

    let outcome: RuleOutcome | null = null;
    try {
      const o = mod.evaluate(ctx);
      outcome = o !== null && typeof o === "object" && Array.isArray(o.members) ? o : null;
    } catch {
      outcome = null;
    }
    if (outcome === null) {
      return wrap(unknownRule(mod, cloud, sel.input, asOf, "parse-failed", resolutionFor("parse-failed"), { ...unitCoverage(table, spec), proven: false, population: null }));
    }

    const agg = aggregate(spec, outcome, { receipts: build.receipts, inputCount: input.inputs.length, hasAsOf: asOf !== null });

    // 대상(구성원) → ItemResult. 상태 → MatchKey 순으로 먼저 정렬해서 가명 순번이 룰 내부 순회 순서와 무관하게 정해진다
    const rank = (m: Member): number => (m.s === "risk" ? 0 : m.s === "caution" ? 1 : m.s === "unknown" ? 2 : 3);
    const keyed = agg.members
      .filter((m): m is Exclude<Member, { s: "excluded" }> => m.s !== "excluded")
      .map((m) => ({ m, key: matchKeyOf(cloud, build.accountKey, m.res) }))
      .sort((a, b) => rank(a.m) - rank(b.m) || (a.key < b.key ? -1 : a.key > b.key ? 1 : 0));
    const ids = uniqueIds(spec.ruleId, keyed.map((k) => k.m), build);
    const items = keyed.map((k, i) => toItem(k.m, spec.ruleId, spec.door, build, ids[i]));
    const distribution = items.length === 0 ? EMPTY_DIST : distributionOf(items.map((i) => i.status));
    const base = { ruleId: spec.ruleId, cloud, door: spec.door, priority: spec.priority, items, distribution, labels: labelsOf(items), inputIndex: sel.input };

    // 범위(Coverage)
    const unit = agg.proof !== null ? agg.proof.unit : unitForReport(table, spec.families.item, spec.families.needs);
    const covBase = { kind: unit.kind, covered: unit.covered, total: unit.total };

    // 권한 해제 힌트 재료
    const related = causeReceipts(agg, families.filter((f) => !isSoundComplete(f, f.family)), build);
    const unlock = new Map<string, number>();
    let unknownItemCount = 0;
    for (const m of agg.members) {
      if (m.s !== "unknown") continue;
      unknownItemCount++;
      for (const p of permissionsOfDenied(receiptsOf(m.ev, build).map((r) => r.key), build.receipts)) unlock.set(p, (unlock.get(p) ?? 0) + 1);
    }
    const denied = related.filter((r) => r.result === "denied").map((r) => r.key);
    // 룰 수준 원인(완결이 아닌 패밀리의 거부 영수증)은 대상 하나에 매이지 않아도 그 권한으로 풀리는 점검에 센다. 위험·주의가 있는 룰도 마찬가지다(더 보려면 필요한 권한)
    const perms = permissionsOfDenied(denied, build.receipts);
    for (const p of perms) if (!unlock.has(p)) unlock.set(p, 1);

    if (agg.status === "unknown") {
      const gaps = sortReasons(agg.gaps);
      const primary = gaps[0];
      if (unknownItemCount === 0) unknownItemCount = 1;
      const params = ruleUnknownParams(primary, related, families.filter((f) => !isSoundComplete(f, f.family)));
      return wrap(
        unknownRule(mod, cloud, sel.input, asOf, primary, resolutionFor(primary, { permissions: perms, doorState: "selected" }),
          { ...covBase, proven: false, population: null }, items, params, build, gaps),
        unlock, denied, unknownItemCount,
      );
    }

    const explainFor = (status: "risk" | "caution" | "clear" | "na", members: readonly Member[]): MsgRef<RuleReason> | null => {
      if (mod.explain === undefined) return null;
      try {
        const e = mod.explain({ status, members, population: agg.population, applicable: agg.applicable, excluded: agg.excluded.length, unitTotal: agg.proof === null ? null : agg.proof.unit.total });
        return toMsgRef(e.msg, build);
      } catch {
        return null;
      }
    };

    if (agg.status === "risk" || agg.status === "caution") {
      const status = agg.status;
      const own = agg.members.filter(isFinding).filter((m) => m.s === status && m.why.code !== "isolated-denial");
      const fallback: MsgRef<FindingReason> = own.length > 0 ? toMsgRef(own[0].why, build) : { code: "isolated-denial" };
      const why: MsgRef<FindingReason> = (own.length > 0 ? explainFor(status, own) : null) ?? fallback;
      const coverage: Coverage = { ...covBase, proven: agg.proof !== null, population: agg.proof !== null ? agg.applicable : null };
      // 범위가 증명되지 않았는데 확인 불가 대상이 하나도 없으면 '보지 못한 나머지 대상'이 있다는 사실을 직접 볼 목록에 남긴다
      let rest: RuleRun["rest"] = null;
      if (agg.proof === null && unknownItemCount === 0) {
        const primary = sortReasons(agg.coverageGaps.length > 0 ? agg.coverageGaps : ["scope-unproven"])[0];
        const params = ruleUnknownParams(primary, related, families.filter((f) => !isSoundComplete(f, f.family)));
        rest = {
          why: params === undefined ? { code: primary } : toMsgRef(msg(primary, params), build),
          resolution: resolutionFor(primary, { permissions: perms, doorState: "selected" }),
        };
      }
      return wrap({ ...base, status, why, asOf, coverage }, unlock, denied, unknownItemCount, rest);
    }

    // clear · na: 기준 시각과 증명된 범위가 있다(aggregate가 보장)
    if (asOf === null || agg.proof === null || agg.applicable === null) {
      return wrap(unknownRule(mod, cloud, sel.input, asOf, "scope-unproven", resolutionFor("scope-unproven"), { ...covBase, proven: false, population: null }, items), unlock, denied, unknownItemCount);
    }
    const proven: ProvenCoverage = { kind: unit.kind, covered: agg.proof.unit.covered, total: agg.proof.unit.total, proven: true, population: agg.applicable };
    if (agg.status === "na") {
      const basis: MsgRef<RuleReason> = explainFor("na", agg.excluded) ?? { code: `${spec.ruleId}:na` };
      return wrap({ ...base, status: "na", why: { code: "no-targets-proven" }, basis, asOf, coverage: { ...proven, population: 0 } }, unlock, denied, unknownItemCount);
    }
    const clearMembers = agg.members.filter(isClearMember);
    const why: MsgRef<RuleReason> = explainFor("clear", clearMembers) ?? toMsgRef(clearMembers[0].why, build);
    return wrap({ ...base, status: "clear", why, asOf, coverage: proven }, unlock, denied, unknownItemCount);
  } catch {
    // 어떤 이유로든 룰 실행이 깨지면 그 룰만 확인 불가(parse-failed)로 남긴다
    return wrap(unknownRule(mod, cloud, null, null, "parse-failed", resolutionFor("parse-failed")));
  }
}

function unitCoverage(table: CoverageLookup, spec: RuleModule["spec"]): { readonly kind: Coverage["kind"]; readonly covered: number | null; readonly total: number | null } {
  if (spec.families === null) return { kind: "none", covered: null, total: null };
  const u = unitForReport(table, spec.families.item, spec.families.needs);
  return { kind: u.kind, covered: u.covered, total: u.total };
}

export { coverageLookup, resolutionOfMember, STATUS_RANK, UNKNOWN_REASON_ORDER };
