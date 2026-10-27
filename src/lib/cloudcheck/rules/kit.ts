// src/lib/cloudcheck/rules/kit.ts — 룰 작성용 도구 모음 (판정 로직과 정적 데이터 조립을 짧게 쓰기 위한 것)
// 규칙
//  - 룰은 상태를 직접 반환하지 않는다. 구성원마다 mRisk·mCaution·mClear·mUnknown·mExcluded 중 하나를 만들고, 룰 상태는 core가 계산한다.
//  - 현재 시각·난수·DOM을 쓰지 않는다(INV-9). 나이는 ctx.asOf(파일의 수집 시각 또는 보고서 생성 시각) 기준이다.
//  - 사용자 데이터는 Raw로만 싣는다. 문장은 쓰지 않는다(코드 + 파라미터).
import type {
  BasisRef, CatalogKey, Cloud, CliTemplate, DoorId, ExternalLink, FactCode, FindingReason, FixGuide, GuideCard, IncidentRef, IsoDate, LinkHost,
  MaxStatus, RuleCatalogEntry, RuleId, RuleKind, RuleParamView, RuleReason, Status, UnknownReason,
} from "../model/report";
import type { AsOfFact, FamilyId, Instant, Slot, Src } from "../contract/normalized";
import type {
  CallId, DoorData, Ev, ExplainInput, Explained, FixtureCaseSpec, Member, ResourceDesc, RMsg, RParams, RuleCtx, RuleLabel, RuleModule, RuleOutcome, RuleSpec,
} from "../engine/types";
import { permissionOf } from "../engine/reasons";
import { msg } from "../engine/msg";
import { DAY_MS, FUTURE_SKEW_MINUTES, MINUTE_MS, REPORT_FRESHNESS_MS } from "./params";

/* ───────── 이름 규칙 ───────── */
export const lowerId = (id: RuleId): string => id.toLowerCase();
export const ruleKey = (id: RuleId, ...rest: readonly string[]): CatalogKey => `cc.rule.${lowerId(id)}${rest.map((r) => `.${r}`).join("")}`;
export const phKey = (name: string): CatalogKey => `cc.ph.${name}`;

/* ───────── 메시지 ───────── */
export { msg };
/** 룰 사유 코드 생성기: const R = reasons("AWS-MFA-2"); R("all-mfa", { n: ... }) */
export function reasons<I extends RuleId>(id: I): (slug: string, params?: RParams) => RMsg<RuleReason> {
  return (slug, params) => msg(`${id}:${slug}` as RuleReason, params);
}
export function findings<I extends RuleId>(id: I): (slug: string, params?: RParams) => RMsg<FindingReason> {
  return (slug, params) => msg(`${id}:${slug}` as FindingReason, params);
}
export const fact = (slug: string, params?: RParams): RMsg<FactCode> => msg(`fact:${slug}` as FactCode, params);
export const N = (n: number): { readonly n: number } => ({ n });
export const C = (c: string): { readonly c: string } => ({ c });

/* ───────── 증거 ───────── */
export function ev(src: Src | null | undefined, observed?: Ev["observed"]): Ev[] {
  if (src === null || src === undefined) return [];
  return observed === undefined ? [{ src }] : [{ src, observed }];
}
const srcKey = (s: Src): string => `${s.input}|${s.receipt ?? ""}|${s.csv?.kind ?? ""}|${s.csv?.row ?? ""}|${s.csv?.column ?? ""}`;
/** 여러 출처를 증거 목록으로(중복 제거, null 무시) */
export function evs(...items: readonly (Src | null | undefined | Ev)[]): Ev[] {
  const seen = new Set<string>();
  const out: Ev[] = [];
  for (const it of items) {
    if (it === null || it === undefined) continue;
    const e: Ev = "src" in it ? it : { src: it };
    const k = srcKey(e.src);
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(e);
  }
  return out;
}
/** 슬롯의 출처(missing은 null일 수 있다) */
export const srcOf = (s: Slot<unknown>): Src | null => s.src;

/* ───────── 슬롯 ───────── */
/** 값이 '완결된 답'이 아니면 그 사유(missing·partial), 답이면 null. none(설정 없음)은 유효한 답이다 */
export function gapOfSlot(s: Slot<unknown>): UnknownReason | null {
  if (s.k === "missing") return s.why;
  if (s.k === "partial") return s.why;
  return null;
}

/* ───────── 시간 ───────── */
/**
 * 증거 시각이 기준 시각보다 늦어도 되는 정도(ms). 이만큼은 시계·캐시 차이로 본다.
 *  - 기본: 시계 차이 허용치(FUTURE_SKEW_MINUTES = 5분).
 *  - 기준 시각이 자격증명 보고서의 생성 시각(AWS 서버 시각)이고 증거가 실시간 호출(CSV 칸이 아님)에서 왔으면 보고서 캐시 시간(최대 4시간 5분):
 *    보고서가 캐시에서 온 뒤에 만든 키는 보고서보다 늦은 것이 정상이다.
 */
function aheadToleranceMs(asOf: AsOfFact, src: Src | null | undefined): number {
  if (asOf.source === "credential-report" && src !== null && src !== undefined && src.csv === null) return REPORT_FRESHNESS_MS;
  return FUTURE_SKEW_MINUTES * MINUTE_MS;
}
/**
 * 증거 t의 나이(ms, 0 이상). 증거가 기준 시각보다 허용치를 넘게 늦으면(시각 역전) null — 나이를 말할 수 없다.
 * null을 '0일 = 최근'으로 접으면 근거 없는 이상 없음이 나온다(CC-QA-01). 부르는 쪽은 null이면 확인 불가(stale-evidence)로 두고 laterThanAsOfFact를 붙인다.
 * 허용치 안의 어긋남은 0(방금 생김)으로 본다.
 */
export function ageMs(asOf: AsOfFact, t: Instant, src?: Src | null): number | null {
  const age = asOf.at.ms - t.ms;
  if (age < -aheadToleranceMs(asOf, src)) return null;
  return Math.max(0, age);
}
/** 나이(ms)가 days일을 엄격히 넘는가 */
export const olderThanDays = (age: number, days: number): boolean => age > days * DAY_MS;
/** 경과 일수(내림) */
export const wholeDays = (age: number): number => Math.floor(age / DAY_MS);
/** 정규형 시각의 날짜(YYYY-MM-DD) */
export const dateOf = (t: Instant): IsoDate => t.iso.slice(0, 10) as IsoDate;
/**
 * 입력 안의 시각 칸 중 기준 시각보다 허용치를 넘게 늦은 것이 있는가(있으면 가장 늦은 것). 있으면 기준 시각이 실제보다 이른 것이다 —
 * 이 입력의 기준 시각으로 잰 나이는 모두 실제보다 작게 나오므로, '최근이라 괜찮다'는 결론(이상 없음)은 내지 않는다(CC-QA-01: 늦은 PC 시계 · 틀린 파일 시각).
 * 오래됐다는 결론(주의)은 기준 시각이 이른 쪽으로 틀려도 더 오래된 것이라 그대로 유지한다.
 */
export function reversedIn(asOf: AsOfFact | null, times: readonly { readonly t: Instant; readonly src: Src | null }[]): Instant | null {
  if (asOf === null) return null;
  let worst: Instant | null = null;
  for (const { t, src } of times) if (ageMs(asOf, t, src) === null && (worst === null || t.ms > worst.ms)) worst = t;
  return worst;
}
/**
 * parse가 알려 준 '입력 안의 가장 늦은 증거 시각'(InputFacts.latestEvidence)을 reversedIn이 받는 모양으로 돌려준다(없으면 빈 목록).
 * 룰이 직접 읽는 칸 밖의 시각(비밀번호 변경 · 인증서 회전 …)도 기준 시각이 틀렸다는 증거가 된다. 보고서 CSV · 저장소 CSV · Azure 수집기에서 오는 값이라 CSV 칸과 같은 허용치(5분)로 견준다(src null).
 */
export function inputEvidence(ctx: Pick<RuleCtx, "input" | "inputIndex">): { readonly t: Instant; readonly src: Src | null }[] {
  const t = ctx.input.inputs[ctx.inputIndex]?.latestEvidence;
  return t === undefined || t === null ? [] : [{ t, src: null }];
}
/** 같은 사실(코드 + 값)이 겹치면 한 번만 남긴다 — 여러 자격증명이 같은 원인으로 확인 불가가 될 때 같은 줄이 반복되지 않게 */
export function uniqFacts(facts: readonly RMsg<FactCode>[]): RMsg<FactCode>[] {
  const seen = new Set<string>();
  const out: RMsg<FactCode>[] = [];
  for (const f of facts) {
    const k = JSON.stringify(f);
    if (!seen.has(k)) { seen.add(k); out.push(f); }
  }
  return out;
}
/** 시각 역전 사실: 증거 시각이 기준 시각보다 늦다(PC 시계 · 파일 시각 · 파일 이름 시각이 틀렸을 수 있다) */
export const laterThanAsOfFact = (asOf: AsOfFact, t: Instant): RMsg<FactCode> =>
  fact("evidence-later-than-as-of", { evidence: { d: dateOf(t) }, reference: { t: asOf.at.iso } });

/* ───────── 구성원 생성 ───────── */
interface Opt { readonly facts?: readonly RMsg<FactCode>[]; readonly labels?: readonly RuleLabel[] }
export const mRisk = (res: ResourceDesc, why: RMsg<FindingReason>, ev_: readonly Ev[], o: Opt = {}): Member => ({ s: "risk", res, why, ev: ev_, ...o });
export const mCaution = (res: ResourceDesc, why: RMsg<FindingReason>, ev_: readonly Ev[], o: Opt = {}): Member => ({ s: "caution", res, why, ev: ev_, ...o });
export const mClear = (res: ResourceDesc, why: RMsg<RuleReason>, ev_: readonly Ev[], o: Opt = {}): Member => ({ s: "clear", res, why, ev: ev_, ...o });
export const mUnknown = (res: ResourceDesc, why: UnknownReason | RMsg<UnknownReason>, ev_: readonly Ev[], o: Opt = {}): Member =>
  ({ s: "unknown", res, why: typeof why === "string" ? msg(why) : why, ev: ev_, ...o });
export const mExcluded = (res: ResourceDesc, why: RMsg<RuleReason>, ev_: readonly Ev[], o: Opt = {}): Member => ({ s: "excluded", res, why, ev: ev_, ...o });

/* ───────── 리소스 설명 ───────── */
export const GLOBAL = { kind: "global", value: "global" } as const;
export const inRegion = (region: string): ResourceDesc["where"] => ({ kind: "region", value: region });
export const inSubscription = (id: string): ResourceDesc["where"] => ({ kind: "subscription", value: id });
export const awsAccountRes = (accountId: string): ResourceDesc => ({ type: "aws-account", name: { type: "accountId", value: accountId }, where: GLOBAL, id: accountId });
export const iamUserRes = (name: string): ResourceDesc => ({ type: "iam-user", name: { type: "userName", value: name }, where: GLOBAL, id: name });
export const accessKeyRes = (user: string, key: string): ResourceDesc => ({ type: "access-key", name: { type: "userName", value: user }, where: GLOBAL, id: `${user}/${key}` });

/* ───────── 정적 데이터 조립 ───────── */
const ALLOWED_HOSTS: readonly string[] = ["docs.aws.amazon.com", "aws.amazon.com", "learn.microsoft.com"];
export { ALLOWED_HOSTS as RULE_LINK_HOSTS };

/** 외부 링크. 호스트가 허용 목록 밖이면 rule-schema 테스트가 실패한다(여기서는 던지지 않는다: 번들 로드를 깨지 않는다) */
export function link(url: string): ExternalLink {
  const m = /^https:\/\/([^/]+)/.exec(url);
  return { href: url as `https://${string}`, host: (m ? m[1] : "") as LinkHost };
}

/** 명령 줄의 [[이름]] 표시를 자리표시자 조각으로 */
function segmentsOf(line: string): CliTemplate["segments"] {
  const parts = line.split(/\[\[([a-z0-9-]+)\]\]/);
  const segs: ({ readonly t: "text"; readonly v: string } | { readonly t: "ph"; readonly key: CatalogKey })[] = [];
  parts.forEach((p, i) => {
    if (i % 2 === 1) segs.push({ t: "ph", key: phKey(p) });
    else if (p !== "") segs.push({ t: "text", v: p });
  });
  return segs;
}
export function read(shell: "aws" | "az", line: string): CliTemplate<"read"> { return { kind: "read", shell, segments: segmentsOf(line) }; }
export function write(shell: "aws" | "az", line: string): CliTemplate<"write"> { return { kind: "write", shell, segments: segmentsOf(line) }; }

export interface FixInput {
  readonly impact: FixGuide["impact"];
  readonly prodImpact: boolean;
  readonly observe: { readonly doc: string | null; readonly commands: readonly CliTemplate<"read">[] };
  readonly change: { readonly property: string; readonly doc: string; readonly commands: readonly CliTemplate<"write">[] };
  readonly revert: { readonly commands: readonly CliTemplate<"write">[] };
  readonly runbook?: string | null;
}
export interface GuideInput { readonly steps: readonly { readonly id: string; readonly doc: string | null }[] }

export interface SpecInput {
  readonly id: RuleId;
  readonly door: DoorId;
  readonly kind?: RuleKind;
  readonly released?: boolean;
  readonly maxStatus: MaxStatus;
  readonly allowsClear: boolean;
  readonly priority: number;
  /** 상태별 조건 문구(cc.rule.<id>.cond.<status>)를 둘 상태 */
  readonly cond: readonly Status[];
  readonly impact: boolean;
  readonly question: boolean;
  readonly paths: RuleCatalogEntry["paths"];
  readonly params: readonly { readonly name: string; readonly value: RuleParamView["value"]; readonly basis: RuleParamView["basis"] }[];
  readonly cannotSee: number;
  readonly falsePositives: number;
  readonly fix: FixInput | null;
  readonly guide: GuideInput | null;
  readonly basis: readonly { readonly name: string; readonly url: string; readonly kind: BasisRef["kind"] }[];
  readonly incident: { readonly name: string; readonly date: string; readonly url: string; readonly sourceName: string } | null;
  readonly lastVerified: string;
  readonly asOfBasis?: RuleSpec["asOfBasis"];
  readonly families: RuleSpec["families"];
  readonly calls: readonly CallId[];
  readonly isolatedDenial?: readonly CallId[];
  readonly reasons: Readonly<Record<string, readonly string[]>>;
  readonly facts: Readonly<Record<string, readonly string[]>>;
  readonly how: boolean;
  readonly autoNotice?: { readonly what: FactCode; readonly howKey: CatalogKey };
  readonly fixtures: FixtureCaseSpec;
}

export const cloudOf = (id: RuleId): Cloud => (id.startsWith("AWS-") ? "aws" : "azure");

export function buildSpec(i: SpecInput): RuleSpec {
  const id = i.id;
  const cloud = cloudOf(id);
  const conditionKeys: Partial<Record<Status, CatalogKey>> = {};
  for (const st of i.cond) conditionKeys[st] = ruleKey(id, "cond", st);
  const nth = (kind: string, n: number): CatalogKey[] => Array.from({ length: n }, (_, k) => ruleKey(id, kind, String(k + 1)));
  const permissions = [...new Set(i.calls.map((c) => permissionOf(c)).filter((p): p is string => p !== null))];
  const fix: FixGuide | null = i.fix === null ? null : {
    impact: i.fix.impact,
    prodImpact: i.fix.prodImpact,
    observe: { textKey: ruleKey(id, "fix", "observe"), doc: i.fix.observe.doc === null ? null : link(i.fix.observe.doc), commands: i.fix.observe.commands },
    change: { textKey: ruleKey(id, "fix", "change"), property: i.fix.change.property, doc: link(i.fix.change.doc), commands: i.fix.change.commands },
    revert: { textKey: ruleKey(id, "fix", "revert"), commands: i.fix.revert.commands },
    runbook: i.fix.runbook === undefined || i.fix.runbook === null ? null : link(i.fix.runbook),
  };
  const guide: GuideCard | null = i.guide === null ? null : {
    steps: i.guide.steps.map((s) => ({ id: s.id, textKey: ruleKey(id, "guide", s.id), doc: s.doc === null ? null : link(s.doc) })),
  };
  const incident: IncidentRef | null = i.incident === null ? null : {
    titleKey: `cc.incident.${i.incident.name}`, date: i.incident.date as IsoDate, link: link(i.incident.url), sourceName: i.incident.sourceName,
  };
  return {
    ruleId: id, cloud, door: i.door, kind: i.kind ?? "auto", released: i.released ?? true,
    titleKey: ruleKey(id, "title"), summaryKey: ruleKey(id, "summary"),
    maxStatus: i.maxStatus, allowsClear: i.allowsClear, priority: i.priority,
    conditionKeys,
    impactKey: i.impact ? ruleKey(id, "impact") : null,
    questionKey: i.question ? ruleKey(id, "question") : null,
    paths: i.paths, permissions,
    params: i.params.map((p) => ({ key: ruleKey(id, "param", p.name), value: p.value, basis: p.basis })),
    cannotSee: nth("cannot", i.cannotSee),
    falsePositiveKeys: nth("fp", i.falsePositives),
    fix, guide,
    basis: i.basis.map((b) => ({ titleKey: `cc.basis.${lowerId(id)}.${b.name}`, link: link(b.url), kind: b.kind })),
    incident,
    lastVerified: i.lastVerified as IsoDate,
    asOfBasis: i.asOfBasis ?? "door",
    families: i.families,
    calls: i.calls,
    isolatedDenial: i.isolatedDenial === undefined ? null : { calls: i.isolatedDenial },
    reasons: i.reasons,
    facts: i.facts,
    manualHowKey: i.how ? ruleKey(id, "how") : null,
    autoNotice: i.autoNotice ?? null,
    fixtures: i.fixtures,
  };
}

/* ───────── 모듈 정의 ───────── */
export interface RuleDefinition<C extends Cloud, D extends DoorId> {
  readonly spec: RuleSpec;
  readonly evaluate?: (ctx: RuleCtx<DoorData<C, D>>) => RuleOutcome;
  readonly explain?: (x: ExplainInput) => Explained;
}
export function defineRule<C extends Cloud, D extends DoorId>(def: RuleDefinition<C, D>): RuleModule {
  return { id: def.spec.ruleId, spec: def.spec, evaluate: def.evaluate, explain: def.explain };
}

/** 가장 흔한 사유 선택기: 상태별 slug 하나와 {n}(대상 수)만 쓰는 룰용 */
export function simpleExplain(id: RuleId, slugs: { readonly risk?: string; readonly caution?: string; readonly clear?: string; readonly na?: string }): (x: ExplainInput) => Explained {
  const R = reasons(id);
  return (x) => {
    const slug = slugs[x.status] ?? slugs.na ?? "unknown";
    const n = x.status === "clear" ? (x.applicable ?? x.members.length) : x.status === "na" ? 0 : x.members.length;
    return { msg: x.status === "na" ? R(slug) : R(slug, { n: N(n) }) };
  };
}

/** 이 파일이 쓰는 FamilyId 타입 재노출(룰 파일 import 줄이기) */
export type { FamilyId };

/** 구성원의 사유를 룰 수준 사유 코드로 재사용(위험·주의 구성원 중 isolated-denial은 core가 미리 뺀다) */
export function reuseWhy(m: Member): RMsg<RuleReason> {
  return m.why.params === undefined ? { code: m.why.code as RuleReason } : { code: m.why.code as RuleReason, params: m.why.params };
}
