// src/app/cloudcheck/_client/mocks/build.ts — 목업 Report 조립 도우미. 소유: 프론트팀장.
// 목업은 '손으로 만든' 엔진 출력이다(모델 v1 타입 준수). 실제 엔진(DB설계자 D5 이후)이 나오면 같은 렌더 테스트를 judge() 출력으로 다시 돌린다(방향서 §3 규칙 2).
// 이 파일은 모델 v1의 집계 규칙(방향서 §5-2 주석, 결정 #1·#2)을 흉내 내 분포·정렬·worstStatus·firstLook을 계산한다 → 손으로 숫자를 맞추다 어긋나지 않게.
// 운영 번들에 넣지 않는다(_build/generated.test.ts의 번들 입력 검사가 막는다). --preview로 화면을 보려고 main.tsx에서 잠시 import하는 것은 괜찮다.
// 렌더 검사(G-D18)가 데이터 문자열도 읽으므로 가짜 이름·값에도 금지 토큰을 넣지 않는다(디자인 Q2).
import {
  DOORS,
  REPORT_MODEL,
  STATUS_ORDER,
  type AsOf,
  type Banner,
  type Cloud,
  type CollectionBlock,
  type Coverage,
  type DisplayValue,
  type Distribution,
  type DoorCollection,
  type DoorId,
  type DoorResult,
  type EvidenceRef,
  type FactCode,
  type FirstLook,
  type GlobalCannotSee,
  type IdentityBlock,
  type IsoDate,
  type IsoUtc,
  type ItemResult,
  type ItemStatusDetail,
  type Label,
  type ManualCheckItem,
  type MatchKey,
  type MessageCode,
  type MsgParam,
  type MsgRef,
  type PermissionsBlock,
  type ProvenCoverage,
  type ReceiptRef,
  type ReceiptResult,
  type Report,
  type Resolution,
  type ResourceRef,
  type ResourceType,
  type RuleId,
  type RuleReason,
  type RuleResult,
  type RuleStatusDetail,
  type ScopeBlock,
  type SensitiveType,
  type Status,
  type UnknownReason,
  type ValueFlag,
} from "../../../../lib/cloudcheck/model/report";

/* ───────── 룰 메타(방향서 §6-1 요약표) ───────── */
export interface RuleMeta {
  readonly cloud: Cloud;
  readonly door: DoorId;
  readonly priority: number;
}
export const RULE_META: Readonly<Record<RuleId, RuleMeta>> = {
  "AWS-STO-2": { cloud: "aws", door: "sto", priority: 10 },
  "AZ-STO-2": { cloud: "azure", door: "sto", priority: 20 },
  "AWS-NET-1": { cloud: "aws", door: "net", priority: 30 },
  "AZ-NET-1": { cloud: "azure", door: "net", priority: 40 },
  "AWS-KEY-4": { cloud: "aws", door: "key", priority: 50 },
  "AWS-MFA-1": { cloud: "aws", door: "mfa", priority: 60 },
  "AWS-MFA-2": { cloud: "aws", door: "mfa", priority: 70 },
  "AZ-MFA-1": { cloud: "azure", door: "mfa", priority: 80 },
  "AZ-MFA-G": { cloud: "azure", door: "mfa", priority: 90 },
  "AWS-KEY-3": { cloud: "aws", door: "key", priority: 100 },
  "AWS-KEY-1": { cloud: "aws", door: "key", priority: 110 },
  "AWS-KEY-2": { cloud: "aws", door: "key", priority: 120 },
  "AZ-KEY-1": { cloud: "azure", door: "key", priority: 130 },
  "AWS-STO-1": { cloud: "aws", door: "sto", priority: 140 },
  "AZ-STO-1": { cloud: "azure", door: "sto", priority: 150 },
  "AWS-LOG-1": { cloud: "aws", door: "log", priority: 160 },
  "AZ-LOG-1": { cloud: "azure", door: "log", priority: 170 },
  "AZ-LOG-2": { cloud: "azure", door: "log", priority: 180 },
};

/* ───────── 원자 ───────── */
export const iso = (s: string): IsoUtc => s as IsoUtc;
export const day = (s: string): IsoDate => s as IsoDate;
export const plain = (text: string): DisplayValue => ({ kind: "plain", text });
export const sens = (type: SensitiveType, full: string, masked: string, flags: readonly ValueFlag[] = []): DisplayValue => ({ kind: "sensitive", type, full, masked, flags });
export const redacted = (why: "secret-pattern" | "invalid-encoding" = "secret-pattern"): DisplayValue => ({ kind: "redacted", why });
export function msg<C extends MessageCode>(code: C, params?: Readonly<Record<string, MsgParam>>): MsgRef<C> {
  return params === undefined ? { code } : { code, params };
}
export const n = (value: number): MsgParam => ({ n: value });
export const c = (value: string): MsgParam => ({ c: value });
export const v = (value: DisplayValue): MsgParam => ({ v: value });
export const t = (value: string): MsgParam => ({ t: iso(value) });
export const d = (value: string): MsgParam => ({ d: day(value) });
export const fact = (slug: string, params?: Readonly<Record<string, MsgParam>>): MsgRef<FactCode> => msg(`fact:${slug}`, params);
export const collectedAt = (at: string): AsOf => ({ at: iso(at), source: "collected-at" });

/** 안정 키: <cloud>|<계정·테넌트>|<ResourceType>|<위치 또는 ->|<고유 ID> */
export const matchKey = (cloud: Cloud, account: string, type: ResourceType, loc: string, id: string): MatchKey => `${cloud}|${account}|${type}|${loc}|${id}` as MatchKey;

export function resource(
  cloud: Cloud,
  account: string,
  type: ResourceType,
  id: string,
  name: DisplayValue,
  location: ResourceRef["location"] = { kind: "global", value: plain("global") },
): ResourceRef {
  const loc = location === null ? "-" : location.kind === "global" ? "-" : location.value.kind === "plain" ? location.value.text : id;
  return { type, name, location, key: matchKey(cloud, account, type, loc, id) };
}
export const region = (r: string): ResourceRef["location"] => ({ kind: "region", value: plain(r) });

/* ───────── 증거 ───────── */
export function receipt(id: string, call: string, scope: DisplayValue, result: ReceiptResult, at: string, count: number | null = null, errorCode: string | null = null): ReceiptRef {
  return { id, call, scope, result, count, errorCode, at: iso(at) };
}
export function ev(r: ReceiptRef, observed: EvidenceRef["observed"] = []): EvidenceRef {
  return { receipt: r, csv: null, observed };
}
export function evCsv(column: string, row: number): EvidenceRef {
  return { receipt: null, csv: { kind: "csv-credential-report", column, row }, observed: [] };
}

/* ───────── 범위 ───────── */
export const globalProven = (population: number): ProvenCoverage => ({ kind: "account-global", covered: 1, total: 1, proven: true, population });
export const regionsProven = (covered: number, population: number): ProvenCoverage => ({ kind: "regions", covered, total: covered, proven: true, population });
export const subsProven = (covered: number, population: number): ProvenCoverage => ({ kind: "subscriptions", covered, total: covered, proven: true, population });
export const naCoverage = (kind: ProvenCoverage["kind"], covered = 1, total = 1): ProvenCoverage & { readonly population: 0 } => ({ kind, covered, total, proven: true, population: 0 });
export const partialCoverage = (kind: Coverage["kind"], covered: number | null, total: number | null): Coverage => ({ kind, covered, total, proven: false, population: null });

/* ───────── 대상·점검·문 ───────── */
export interface ItemSpec {
  readonly id: string;
  readonly resource: ResourceRef;
  readonly facts?: readonly MsgRef<FactCode>[];
  readonly labels?: readonly Label[];
}
export function item(ruleId: RuleId, spec: ItemSpec, detail: ItemStatusDetail): ItemResult {
  return { id: spec.id, ruleId, resource: spec.resource, facts: spec.facts ?? [], labels: spec.labels ?? [], ...detail };
}
export const riskItem = (why: MsgRef<RuleReason> | MsgRef<"isolated-denial">, ...evidence: EvidenceRef[]): ItemStatusDetail => ({ status: "risk", why, evidence });
export const cautionItem = (why: MsgRef<RuleReason> | MsgRef<"isolated-denial">, ...evidence: EvidenceRef[]): ItemStatusDetail => ({ status: "caution", why, evidence });
export const clearItem = (why: MsgRef<RuleReason>, first: EvidenceRef, ...more: EvidenceRef[]): ItemStatusDetail => ({ status: "clear", why, evidence: [first, ...more] });
export const unknownItem = (why: MsgRef<UnknownReason>, resolution: Resolution, ...evidence: EvidenceRef[]): ItemStatusDetail => ({ status: "unknown", why, evidence, resolution });

const statusRank = (s: Status): number => STATUS_ORDER.indexOf(s as (typeof STATUS_ORDER)[number]);

export function distOf(statuses: readonly Status[]): Distribution {
  const dist = { total: statuses.length, risk: 0, caution: 0, unknown: 0, clear: 0, na: 0 };
  for (const s of statuses) dist[s] += 1;
  return dist;
}
export function addDist(a: Distribution, b: Distribution): Distribution {
  return { total: a.total + b.total, risk: a.risk + b.risk, caution: a.caution + b.caution, unknown: a.unknown + b.unknown, clear: a.clear + b.clear, na: a.na + b.na };
}
export const EMPTY_DIST: Distribution = distOf([]);

/** 점검(룰) 결과. 대상은 위험 → 주의 → 확인 불가 → 이상 없음, 같은 상태 안에서는 MatchKey 순으로 정렬한다 */
export function rule(ruleId: RuleId, detail: RuleStatusDetail, items: readonly ItemResult[] = [], opts: { readonly labels?: readonly Label[]; readonly inputIndex?: number | null } = {}): RuleResult {
  const meta = RULE_META[ruleId];
  const sorted = [...items].sort((a, b) => statusRank(a.status) - statusRank(b.status) || (a.resource.key < b.resource.key ? -1 : a.resource.key > b.resource.key ? 1 : 0));
  return {
    ruleId,
    cloud: meta.cloud,
    door: meta.door,
    priority: meta.priority,
    items: sorted,
    distribution: distOf(sorted.map((i) => i.status)),
    labels: opts.labels ?? [],
    inputIndex: opts.inputIndex === undefined ? 0 : opts.inputIndex,
    ...detail,
  };
}

/** 문 결과. 점검은 상태(STATUS_ORDER) → priority 순. worstStatus = STATUS_ORDER에서 가장 앞의 상태(화면에 그리지 않음 — D2) */
export function door(id: DoorId, collection: DoorCollection, rules: readonly RuleResult[]): DoorResult {
  const sorted = [...rules].sort((a, b) => statusRank(a.status) - statusRank(b.status) || a.priority - b.priority);
  const worst = STATUS_ORDER.find((s) => sorted.some((r) => r.status === s)) ?? "na";
  return { door: id, worstStatus: worst, collection, rules: sorted, distribution: distOf(sorted.map((r) => r.status)), manualCount: 0 };
}
export const collected = (asOf: AsOf, inputIndex = 0): DoorCollection => ({ status: "collected", judgeLevel: "full", reason: null, asOf, inputIndex });
export const notCollected = (reason: UnknownReason = "not-collected"): DoorCollection => ({ status: "not-collected", judgeLevel: "none", reason: msg(reason), asOf: null, inputIndex: null });

/* ───────── 먼저 볼 3개(방향서 §5-2 FirstLook 주석) ───────── */
export function computeFirstLook(rules: readonly RuleResult[]): FirstLook {
  const byPri = (a: RuleResult, b: RuleResult): number => statusRank(a.status) - statusRank(b.status) || a.priority - b.priority;
  const findings = rules.filter((r) => r.status === "risk" || r.status === "caution").sort(byPri);
  const unknowns = rules.filter((r) => r.status === "unknown").sort((a, b) => a.priority - b.priority);
  if (findings.length > 0) {
    const ids = findings.slice(0, 3).map((r) => r.ruleId);
    for (const u of unknowns) if (ids.length < 3) ids.push(u.ruleId);
    return { mode: "findings", ruleIds: ids };
  }
  if (unknowns.length > 0) {
    const groups = new Map<string, { resolution: Resolution; ruleIds: RuleId[]; minPri: number }>();
    for (const r of unknowns) {
      if (r.status !== "unknown") continue;
      const k = `${r.resolution.kind}|${[...r.resolution.permissions].sort().join(",")}`;
      const g = groups.get(k) ?? { resolution: r.resolution, ruleIds: [], minPri: r.priority };
      g.ruleIds.push(r.ruleId);
      g.minPri = Math.min(g.minPri, r.priority);
      groups.set(k, g);
    }
    const top = [...groups.values()].sort((a, b) => b.ruleIds.length - a.ruleIds.length || a.minPri - b.minPri).slice(0, 3);
    return { mode: "unlock", groups: top.map((g) => ({ resolution: g.resolution, ruleIds: g.ruleIds })) };
  }
  return { mode: "none-found" };
}

/* ───────── 리포트 ───────── */
export const ALL_CANNOT_SEE: readonly GlobalCannotSee[] = [
  "leaked-keys", "issued-sas-oauth", "other-accounts", "abandoned-test-envs", "app-vulnerabilities", "idp-mfa", "resource-policy-sharing",
];
export interface ReportSpec {
  readonly mode: Report["mode"];
  readonly identity: IdentityBlock;
  readonly scope: ScopeBlock;
  readonly collection: CollectionBlock;
  readonly permissions: PermissionsBlock;
  readonly banners: readonly Banner[];
  readonly doors: readonly DoorResult[];
  readonly manual: readonly ManualCheckItem[];
}
export const MOCK_ENGINE = { version: "0.0.0-mock", rulesetVersion: "2026.10.19-mock" } as const;

export function report(spec: ReportSpec): Report {
  const byId = new Map(spec.doors.map((x) => [x.door, x]));
  const doors = DOORS.map((id) => {
    const x = byId.get(id);
    if (x === undefined) throw new Error(`mock: 문 ${id}가 없습니다(DOORS 5개 고정)`);
    return { ...x, manualCount: spec.manual.filter((m) => m.door === id).length };
  });
  const rules = doors.flatMap((x) => x.rules);
  return {
    model: REPORT_MODEL,
    engine: MOCK_ENGINE,
    mode: spec.mode,
    identity: spec.identity,
    scope: spec.scope,
    collection: spec.collection,
    permissions: spec.permissions,
    cannotSee: ALL_CANNOT_SEE,
    distribution: {
      rules: doors.reduce((acc, x) => addDist(acc, x.distribution), EMPTY_DIST),
      items: rules.reduce((acc, r) => addDist(acc, r.distribution), EMPTY_DIST),
    },
    banners: spec.banners,
    doors,
    firstLook: computeFirstLook(rules),
    manualChecklist: spec.manual,
  };
}

/** 호출 기록 합계 */
export function receiptsSummary(counts: Partial<Record<ReceiptResult, number>>): CollectionBlock["receipts"] {
  const base: Record<ReceiptResult, number> = { ok: 0, empty: 0, notconfigured: 0, denied: 0, error: 0, throttled: 0, truncated: 0, unsupported: 0 };
  const merged = { ...base, ...counts };
  return { ...merged, total: Object.values(merged).reduce((a, b) => a + b, 0) };
}
