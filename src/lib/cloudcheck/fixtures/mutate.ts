// src/lib/cloudcheck/fixtures/mutate.ts — 증거를 지우는 변이 (6케이스의 나머지 4개를 pass에서 파생 · QA 속성 테스트 INV-3에서 재사용)
// 입력: 어떤 NormalizedInput이든(micro 픽스처, buildInput 결과). 출력: 변이된 새 NormalizedInput(깊게 freeze, 원본은 그대로).
//  deny(call, {resource?, region?, subscription?})  그 호출을 거부(denied)로 바꾼다. 그 영수증에 기댄 슬롯은 missing(denied), 그 영수증이 증명하던 범위는 미완결로 다시 봉인한다.
//  truncate(call)                                   응답이 잘렸다(truncated). 값 슬롯은 partial, '없음'을 증명하던 범위는 미완결.
//  dropField(path)                                  슬롯 하나를 지운다(필드 부재) → missing(field-missing). 경로는 'doors.sto.data.buckets[0].acl' 형태.
//  bumpSchema(door?)                                문(또는 전체)의 섹션이 이 페이지가 읽는 형식과 맞지 않는다 → 모든 슬롯 missing(schema-unsupported) + sectionIssues.
//  removeUnit(unit)                                 리전·구독 하나를 조회하지 못했다 → 그 단위의 데이터를 빼고 범위를 미완결로.
// 원칙: 변이는 '증거를 줄이는' 방향뿐이다. 어떤 변이 뒤에도 이전에 '이상 없음'이 아니던 대상이 '이상 없음'이 되면 안 된다(INV-3).
import { familyDoor, sealCoverage } from "../contract/normalized";
import type { CoverageDraft, FamilyCoverage, FamilyId, NormalizedInput, ReceiptFact, ReceiptKey, UnitCoverage } from "../contract/normalized";
import { DOORS } from "../model/report";
import type { DoorId, UnknownReason } from "../model/report";
import { deepFreeze } from "./invariants";

/* eslint-disable @typescript-eslint/no-explicit-any */
type Any = any;

export interface MutationOpts {
  readonly resource?: string;
  readonly region?: string;
  readonly subscription?: string;
  readonly errorCode?: string;
}

const SLOT_KINDS = new Set(["value", "partial", "none", "missing"]);
const isObj = (x: unknown): x is Record<string, Any> => typeof x === "object" && x !== null && !Array.isArray(x) && !(x instanceof Map);
const isSlot = (x: unknown): boolean => isObj(x) && typeof x.k === "string" && SLOT_KINDS.has(x.k) && ("src" in x || x.k === "missing");

/** 구조를 따라가며 슬롯을 바꾼다(바꾼 사본을 돌려준다). 슬롯의 값 안에 또 슬롯이 있는 구조(버킷 목록 슬롯 안의 버킷별 슬롯)도 따라 내려간다 */
function mapSlots(node: Any, fn: (slot: Any) => Any): Any {
  if (Array.isArray(node)) return node.map((x) => mapSlots(x, fn));
  if (!isObj(node)) return node;
  if (isSlot(node)) {
    const r = fn(node);
    return isObj(r) && (r.k === "value" || r.k === "partial") ? { ...r, value: mapSlots(r.value, fn) } : r;
  }
  const out: Record<string, Any> = {};
  for (const [k, v] of Object.entries(node)) out[k] = mapSlots(v, fn);
  return out;
}

const clone = (input: NormalizedInput): Any => structuredClone(input);
const familiesOf = (d: Any): FamilyId[] => Object.keys(d.coverage) as FamilyId[];

/** 영수증을 고쳐 쓴다. 맞는 영수증이 없으면 던진다(픽스처 선언이 틀렸다는 뜻) */
function patchReceipts(d: Any, call: string, opts: MutationOpts, patch: (r: ReceiptFact) => ReceiptFact): Set<ReceiptKey> {
  const keys = new Set<ReceiptKey>();
  for (const [key, r] of d.receipts as Map<ReceiptKey, ReceiptFact>) {
    if (r.call !== call) continue;
    if (opts.resource !== undefined && r.resource !== opts.resource) continue;
    if (opts.region !== undefined && r.region !== opts.region) continue;
    if (opts.subscription !== undefined && r.subscription !== opts.subscription) continue;
    d.receipts.set(key, patch(r));
    keys.add(key);
  }
  if (keys.size === 0) throw new Error(`변이할 영수증이 없다: ${call} ${JSON.stringify(opts)}`);
  return keys;
}

interface Reseal { readonly unitState: UnitCoverage["state"]; readonly unitWhy: UnknownReason; readonly unitGap: UnknownReason; readonly plainGap: UnknownReason }

function reseal(d: Any, family: FamilyId, how: Reseal, hit: (k: ReceiptKey) => boolean): void {
  const c = d.coverage[family] as FamilyCoverage;
  const touched = c.receipts.some(hit) || c.units.some((u) => u.receipt !== null && hit(u.receipt));
  if (!touched) return;
  const unitBased = c.units.length > 0;
  const units: UnitCoverage[] = c.units.map((u) => (u.receipt !== null && hit(u.receipt) ? { ...u, state: how.unitState, why: how.unitWhy } : { ...u }));
  const ok = units.filter((u) => u.state === "ok").length;
  const gap = unitBased ? how.unitGap : how.plainGap;
  const draft: CoverageDraft = {
    family, input: c.input, complete: false, population: null, present: c.present, expected: c.expected, gaps: [...c.gaps, gap],
    receipts: [...c.receipts], unit: { kind: c.unit.kind, covered: unitBased ? ok : 0, total: c.unit.total }, units,
  };
  d.coverage[family] = sealCoverage(draft);
}

const regionish = (input: NormalizedInput): "region-missing" | "subscription-missing" => (input.cloud === "aws" ? "region-missing" : "subscription-missing");

export function deny(input: NormalizedInput, call: string, opts: MutationOpts = {}): NormalizedInput {
  const d = clone(input);
  const code = opts.errorCode ?? (input.cloud === "aws" ? "AccessDenied" : "AuthorizationFailed");
  const keys = patchReceipts(d, call, opts, (r) => ({ ...r, result: "denied", count: null, errorCode: code }));
  d.doors = mapSlots(d.doors, (s) => (s.src?.receipt != null && keys.has(s.src.receipt) ? { k: "missing", why: "denied", src: s.src } : s));
  for (const f of familiesOf(d)) {
    reseal(d, f, { unitState: "failed", unitWhy: "denied", unitGap: regionish(input), plainGap: "denied" }, (k) => keys.has(k));
  }
  return deepFreeze(d as NormalizedInput);
}

export function truncate(input: NormalizedInput, call: string, opts: MutationOpts = {}): NormalizedInput {
  const d = clone(input);
  const keys = patchReceipts(d, call, opts, (r) => ({ ...r, result: "truncated", count: r.count ?? 1, errorCode: null }));
  d.doors = mapSlots(d.doors, (s) => {
    if (s.src?.receipt == null || !keys.has(s.src.receipt)) return s;
    if (s.k === "value") return { k: "partial", value: s.value, why: "truncated", src: s.src };
    if (s.k === "none") return { k: "missing", why: "error", src: s.src };
    return s;
  });
  for (const f of familiesOf(d)) {
    reseal(d, f, { unitState: "partial", unitWhy: "truncated", unitGap: "truncated", plainGap: "truncated" }, (k) => keys.has(k));
  }
  return deepFreeze(d as NormalizedInput);
}

/** 'doors.sto.data.buckets[0].acl' → ['doors','sto','data','buckets',0,'acl'] */
function tokens(path: string): (string | number)[] {
  const out: (string | number)[] = [];
  for (const part of path.split(".")) {
    const m = /^([^[\]]+)((?:\[\d+\])*)$/.exec(part);
    if (m === null) throw new Error(`경로 형식 오류: ${path}`);
    out.push(m[1]);
    for (const idx of m[2].matchAll(/\[(\d+)\]/g)) out.push(Number(idx[1]));
  }
  return out;
}

export function dropField(input: NormalizedInput, path: string): NormalizedInput {
  const d = clone(input);
  const t = tokens(path);
  let parent: Any = d;
  for (const key of t.slice(0, -1)) {
    parent = parent?.[key];
    if (parent === undefined || parent === null) throw new Error(`경로에 값이 없다: ${path}`);
  }
  const last = t[t.length - 1];
  const target: Any = parent[last];
  if (!isSlot(target)) throw new Error(`슬롯이 아니다: ${path}`);
  const rk: ReceiptKey | null = target.src?.receipt ?? null;
  parent[last] = { k: "missing", why: "field-missing", src: target.src ?? null };
  // 범위를 정하는 슬롯(활성 리전 목록, 보이는 구독 목록)이 사라지면 그 문의 모든 패밀리가 범위를 증명하지 못한다(실제 parse와 같다: scope-unproven)
  if (last === "regions" || last === "subscriptions") {
    const door = t[1];
    for (const f of familiesOf(d)) {
      if (familyDoor(f) !== door) continue;
      const c = d.coverage[f] as FamilyCoverage;
      d.coverage[f] = sealCoverage({
        family: f, input: c.input, complete: false, population: null, present: c.present, expected: c.expected, gaps: [...c.gaps, "scope-unproven"],
        receipts: [...c.receipts], unit: { kind: c.unit.kind, covered: c.unit.covered, total: null }, units: c.units.map((u) => ({ ...u })),
      });
    }
  } else if (rk !== null) {
    for (const f of familiesOf(d)) {
      reseal(d, f, { unitState: "failed", unitWhy: "field-missing", unitGap: "field-missing", plainGap: "field-missing" }, (k) => k === rk);
    }
  }
  return deepFreeze(d as NormalizedInput);
}

/** 문(또는 선택된 모든 문)의 섹션이 읽는 형식과 맞지 않는다 */
export function bumpSchema(input: NormalizedInput, door?: DoorId): NormalizedInput {
  const d = clone(input);
  const targets: DoorId[] = door === undefined ? DOORS.filter((x) => d.doors[x].state === "selected") : [door];
  for (const x of targets) {
    const sel = d.doors[x];
    if (sel.state !== "selected") continue;
    sel.data = mapSlots(sel.data, () => ({ k: "missing", why: "schema-unsupported", src: null }));
    d.notices = { ...d.notices, sectionIssues: [...d.notices.sectionIssues, { input: sel.input, door: x, section: "*", reason: "schema-section" }] };
    for (const f of familiesOf(d)) {
      if (familyDoor(f) !== x) continue;
      const c = d.coverage[f] as FamilyCoverage;
      d.coverage[f] = sealCoverage({
        family: f, input: c.input, complete: false, population: null, present: c.present, expected: c.expected, gaps: [...c.gaps, "schema-unsupported"],
        receipts: [...c.receipts], unit: { kind: c.unit.kind, covered: null, total: c.unit.total }, units: c.units.map((u) => ({ ...u, state: "failed" as const, why: "schema-unsupported" as const })),
      });
    }
  }
  return deepFreeze(d as NormalizedInput);
}

/** 리전·구독 하나를 조회하지 못했다: 그 단위의 데이터가 빠지고 범위가 미완결이 된다 */
export function removeUnit(input: NormalizedInput, unitName: string): NormalizedInput {
  const d = clone(input);
  let touched = false;
  const prune = (node: Any): Any => {
    if (Array.isArray(node)) {
      const kept = node.filter((e) => !(isObj(e) && (e.region === unitName || e.subscription === unitName) && "items" in e));
      if (kept.length !== node.length) touched = true;
      return kept.map(prune);
    }
    if (!isObj(node)) return node;
    const out: Record<string, Any> = {};
    for (const [k, v] of Object.entries(node)) out[k] = prune(v);
    return out;
  };
  d.doors = prune(d.doors);
  const gap = regionish(input);
  for (const f of familiesOf(d)) {
    const c = d.coverage[f] as FamilyCoverage;
    if (!c.units.some((u) => u.unit === unitName)) continue;
    touched = true;
    const units = c.units.map((u) => (u.unit === unitName ? { ...u, state: "not-queried" as const, why: gap, receipt: null } : { ...u }));
    d.coverage[f] = sealCoverage({
      family: f, input: c.input, complete: false, population: null, present: c.present, expected: c.expected, gaps: [...c.gaps, gap],
      receipts: [...c.receipts], unit: { kind: c.unit.kind, covered: units.filter((u) => u.state === "ok").length, total: c.unit.total }, units,
    });
  }
  if (!touched) throw new Error(`제거할 단위가 없다: ${unitName}`);
  return deepFreeze(d as NormalizedInput);
}

/* ───────── 속성 테스트용: 입력에서 적용 가능한 '증거를 줄이는' 변이 전부 ───────── */
export interface Mutation { readonly name: string; apply(input: NormalizedInput): NormalizedInput }

export function evidenceRemovingMutations(input: NormalizedInput): Mutation[] {
  const out: Mutation[] = [];
  const seen = new Set<string>();
  for (const r of input.receipts.values()) {
    if (!r.used) continue;
    const key = `${r.call}|${r.resource ?? ""}|${r.region ?? ""}|${r.subscription ?? ""}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const opts: MutationOpts = { ...(r.resource === null ? {} : { resource: r.resource }), ...(r.region === null || r.region === "global" ? {} : { region: r.region }), ...(r.subscription === null ? {} : { subscription: r.subscription }) };
    out.push({ name: `deny ${key}`, apply: (i) => deny(i, r.call, opts) });
    out.push({ name: `truncate ${key}`, apply: (i) => truncate(i, r.call, opts) });
  }
  // 문 데이터의 최상위 슬롯과 리전·구독별 슬롯
  for (const door of DOORS) {
    const sel = input.doors[door];
    if (sel.state !== "selected") continue;
    out.push({ name: `bumpSchema ${door}`, apply: (i) => bumpSchema(i, door) });
    const data = sel.data as Record<string, Any>;
    for (const [field, value] of Object.entries(data)) {
      if (isSlot(value)) out.push({ name: `dropField doors.${door}.data.${field}`, apply: (i) => dropField(i, `doors.${door}.data.${field}`) });
      else if (Array.isArray(value)) value.forEach((e, idx) => { if (isObj(e) && isSlot(e.items)) out.push({ name: `dropField doors.${door}.data.${field}[${idx}].items`, apply: (i) => dropField(i, `doors.${door}.data.${field}[${idx}].items`) }); });
    }
  }
  const units = new Set<string>();
  for (const c of Object.values(input.coverage) as FamilyCoverage[]) for (const u of c.units) units.add(u.unit);
  for (const u of [...units].sort()) out.push({ name: `removeUnit ${u}`, apply: (i) => removeUnit(i, u) });
  return out;
}
