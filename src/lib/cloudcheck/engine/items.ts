// src/lib/cloudcheck/engine/items.ts — 룰의 구성원(Member) → Report의 ItemResult 변환
// 사용자 데이터는 여기서 처음 DisplayValue가 된다(정리·마스킹). 룰이 준 Raw가 이 변환을 거치지 않고 Report에 실리는 길은 없다.
import type { ReceiptFact, ReceiptKey, Src } from "../contract/normalized";
import type {
  Cloud, DisplayValue, EvidenceRef, FactCode, ItemResult, Label, MatchKey, MessageCode, MsgParam, MsgRef, ReceiptRef, Resolution, ResourceRef, RuleId,
  UnknownReason,
} from "../model/report";
import type { Display } from "./display";
import type { Ev, Member, ResourceDesc, RMsg, RParam } from "./types";
import { permissionsOfDenied, resolutionFor } from "./reasons";

export interface BuildCtx {
  readonly cloud: Cloud;
  /** 계정(AWS) 또는 테넌트(Azure) 전체 ID: MatchKey의 두 번째 마디 */
  readonly accountKey: string;
  readonly display: Display;
  readonly receipts: ReadonlyMap<ReceiptKey, ReceiptFact>;
  /** 문(door) 상태: not-collected 해소법 선택용 */
  readonly doorState: (door: string) => "skipped" | "absent" | "selected";
}

const esc = (s: string): string => s.replace(/%/g, "%25").replace(/\|/g, "%7C");

/** <cloud>|<계정·테넌트>|<ResourceType>|<위치 또는 ->|<고유 ID>. 화면에 그리지 않는다(예외 파일·Before/After 키) */
export function matchKeyOf(cloud: Cloud, accountKey: string, res: ResourceDesc): MatchKey {
  const where = res.keyWhere === undefined ? res.where : res.keyWhere;
  const loc = where === null || where.kind === "global" ? "-" : where.value;
  return `${cloud}|${esc(accountKey)}|${res.type}|${esc(loc)}|${esc(res.id)}` as MatchKey;
}

export function toResourceRef(res: ResourceDesc, c: BuildCtx): ResourceRef {
  const name = "plain" in res.name ? c.display.plain(res.name.plain) : c.display.sens(res.name, res.type);
  let loc: ResourceRef["location"] = null;
  if (res.where !== null) {
    if (res.where.kind === "global") loc = { kind: "global", value: c.display.plain("global") };
    else if (res.where.kind === "region") loc = { kind: "region", value: c.display.plain(res.where.value) };
    else loc = { kind: "subscription", value: c.display.sens({ type: "subscriptionId", value: res.where.value }) };
  }
  return { type: res.type, name, location: loc, key: matchKeyOf(c.cloud, c.accountKey, res) };
}

export function toMsgParam(p: RParam, c: BuildCtx): MsgParam {
  if ("n" in p) return { n: p.n };
  if ("t" in p) return { t: p.t };
  if ("d" in p) return { d: p.d };
  if ("c" in p) return { c: c.display.constant(p.c) };
  return { v: c.display.sens(p.raw) };
}

export function toMsgRef<C extends MessageCode>(m: RMsg<C>, c: BuildCtx): MsgRef<C> {
  const params = m.params;
  if (params === undefined) return { code: m.code };
  const out: Record<string, MsgParam> = {};
  for (const k of Object.keys(params).sort()) out[k] = toMsgParam(params[k], c);
  return { code: m.code, params: out };
}

export function receiptRef(key: ReceiptKey, c: BuildCtx): ReceiptRef | null {
  const r = c.receipts.get(key);
  if (r === undefined) return null;
  const scope = r.subscription !== null
    ? c.display.sens({ type: "subscriptionId", value: r.subscription })
    : c.display.plain(r.region ?? "global");
  return { id: r.key, call: r.call, scope, result: r.result, count: r.count, errorCode: r.errorCode === null ? null : c.display.constant(r.errorCode), at: r.at.iso };
}

export function toEvidence(e: Ev, c: BuildCtx): EvidenceRef {
  const s: Src = e.src;
  return {
    receipt: s.receipt === null ? null : receiptRef(s.receipt, c),
    csv: s.csv === null ? null : { kind: s.csv.kind, column: s.csv.column ?? "", row: s.csv.row ?? 0 },
    observed: (e.observed ?? []).map((o) => ({ field: c.display.constant(o.field), value: typeof o.value === "string" ? c.display.plain(o.value) : c.display.sens(o.value) })),
  };
}

/** 증거에 들어 있는 영수증 사실 */
export function receiptsOf(evidence: readonly Ev[], c: BuildCtx): ReceiptFact[] {
  const out: ReceiptFact[] = [];
  for (const e of evidence) {
    if (e.src.receipt === null) continue;
    const r = c.receipts.get(e.src.receipt);
    if (r !== undefined) out.push(r);
  }
  return out;
}

/**
 * 확인 불가 사유 문장에 들어가는 파라미터를 엔진이 채운다(룰이 이미 넣었으면 그대로).
 * denied → permission, error·unsupported → errorCode. 값이 없으면 파라미터를 생략하는 대신 '-'를 넣어 문장이 깨지지 않게 한다.
 */
export function unknownParams(code: UnknownReason, related: readonly ReceiptFact[]): Readonly<Record<string, RParam>> | undefined {
  if (code === "denied") {
    const perms = permissionsOfDenied(related.map((r) => r.key), new Map(related.map((r) => [r.key, r])));
    const first = related.find((r) => r.result === "denied");
    return { permission: { c: perms.length > 0 ? perms.join(", ") : first === undefined ? "-" : first.call } };
  }
  if (code === "error" || code === "unsupported") {
    const r = related.find((x) => x.result === code && x.errorCode !== null);
    return { errorCode: { c: r === undefined || r.errorCode === null ? "-" : r.errorCode } };
  }
  return undefined;
}

export function resolutionOfMember(code: UnknownReason, related: readonly ReceiptFact[], door: string, c: BuildCtx): Resolution {
  const perms = permissionsOfDenied(related.map((r) => r.key), c.receipts);
  return resolutionFor(code, { permissions: perms, doorState: c.doorState(door) });
}

const unusual = (v: DisplayValue): boolean =>
  v.kind === "sensitive" && v.flags.some((f) => f === "control-chars-replaced" || f === "bidi-replaced");

const withParams = <C extends MessageCode>(m: RMsg<C>, params: Readonly<Record<string, RParam>> | undefined): RMsg<C> =>
  m.params !== undefined || params === undefined ? m : { code: m.code, params };

/** 구성원 하나를 ItemResult로. id는 호출자가 유일하게 만든다 */
export function toItem(m: Exclude<Member, { s: "excluded" }>, ruleId: RuleId, door: string, c: BuildCtx, id: string): ItemResult {
  const resource = toResourceRef(m.res, c);
  const evidence = m.ev.map((e) => toEvidence(e, c));
  const facts: MsgRef<FactCode>[] = (m.facts ?? []).map((f) => toMsgRef(f, c));
  const labels: Label[] = [...(m.labels ?? [])];
  if (unusual(resource.name) && !labels.some((l) => l.kind === "unusual-characters")) labels.push({ kind: "unusual-characters" });
  const base = { id, ruleId, resource, facts, labels };
  switch (m.s) {
    case "unknown": {
      const related = receiptsOf(m.ev, c);
      const why = toMsgRef(withParams(m.why, unknownParams(m.why.code, related)), c);
      return { ...base, status: "unknown", why, evidence, resolution: resolutionOfMember(m.why.code, related, door, c) };
    }
    case "clear": {
      const [first, ...rest] = evidence;
      // 증거 0개인 clear는 aggregate가 이미 확인 불가로 내렸다. 여기까지 오면 1개 이상이다
      return { ...base, status: "clear", why: toMsgRef(m.why, c), evidence: [first as EvidenceRef, ...rest] };
    }
    case "risk":
    case "caution":
      return { ...base, status: m.s, why: toMsgRef(m.why, c), evidence };
  }
}
