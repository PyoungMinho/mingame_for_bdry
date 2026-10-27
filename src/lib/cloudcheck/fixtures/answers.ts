// src/lib/cloudcheck/fixtures/answers.ts — 정답지(answers/<세트>.<클라우드>.json)와 Report를 맞대어 보는 도구
// 정답지는 사람이 룰 명세(docs/planning/cloudcheck-plan.md §6 · 각 룰 파일 머리 주석)와 회사 정의(companies/worlds-*.ts)를 읽고 먼저 쓴다.
// 엔진 출력에서 만들어 내지 않는다. 이 모듈에는 정답을 만드는 함수(Report → 정답지)가 없고, 그럴 길도 열지 않는다(스냅샷 갱신 경로 없음).
// summarizeReport(report)는 비교를 위해 Report를 정답지와 같은 모양으로 '줄여 보는' 함수일 뿐이다.
import type { Distribution, Report, RuleResult } from "../model/report";

export interface AnswerItem extends Array<unknown> { 0: string; 1: string; 2: string; 3?: string[] }
export interface AnswerRule {
  readonly status: string;
  /** 룰 수준 사유 코드: 위험·주의·이상 없음은 '<룰>:<slug>', 확인 불가는 첫 사유(UnknownReason), 해당 없음은 no-targets-proven */
  readonly why: string;
  /** 해당 없음의 근거 코드 */
  readonly basis?: string;
  /** 확인 불가: 정렬된 사유 전체 */
  readonly gaps?: readonly string[];
  /** 확인 불가: rerun | path | portal | guide | permission:<권한,…> */
  readonly resolution?: string;
  /** [상태, 이름, 사유 slug, (라벨)] — 순서와 무관하게 비교한다 */
  readonly items: readonly (readonly [string, string, string] | readonly [string, string, string, readonly string[]])[];
}
export interface AnswerFile {
  readonly schema: "cloudcheck.answers/1";
  readonly set: "A" | "B" | "C" | "D";
  readonly cloud: "aws" | "azure";
  readonly company: string;
  /** 어떻게 썼는지(사람이 쓴 근거) */
  readonly authoredFrom: string;
  readonly rules: Readonly<Record<string, AnswerRule>>;
  readonly distribution: { readonly rules: Dist; readonly items: Dist };
  readonly firstLook: { readonly mode: string; readonly ruleIds?: readonly string[]; readonly groups?: readonly { readonly resolution: string; readonly ruleIds: readonly string[] }[] };
  readonly banners: readonly string[];
  readonly unlockHints: readonly { readonly permission: string; readonly unlocks: readonly (readonly [string, number])[] }[];
  /** '<출처>:<룰 또는 문>' 목록(순서와 무관하게 비교) */
  readonly manual: readonly string[];
  readonly scope: { readonly proven: boolean; readonly missing: number; readonly outOfScope: number };
  /**
   * 문(현관 · 열쇠 · 창문 · 창고 · CCTV)별 수집 현황 [수집 상태, 판정 수준]. 상태 = collected(모두 완결) · partial(일부만) · not-collected(건너뜀 · 입력에 없음 · 아무것도 못 모음),
   * 수준 = full(조회 범위 목록을 얻음) · findings-only(찾은 것만) · none(수집 안 함). 키 순서는 현관 → 열쇠 → 창문 → 창고 → CCTV.
   * 체험 데이터와 실제 수집기의 문 상태가 달랐던 일(Azure 현관)이 정답지에서 보이지 않았던 틈을 메운다.
   */
  readonly doors: Readonly<Record<"mfa" | "key" | "net" | "sto" | "log", readonly [string, string]>>;
  /** 알려진 차이: 경로 → 오늘 허용하는 실제 값들(또는 "absent"). 고쳐지면 이 줄을 지운다. 정답지의 값은 명세대로 두고 그대로 둔다 */
  readonly tolerate?: Readonly<Record<string, { readonly accept: readonly string[]; readonly why: string; readonly owner: string }>>;
  /** 정답을 고치거나 판단이 갈릴 때 남기는 명세 근거(사람이 쓴 문장). 비교에는 쓰지 않는다 */
  readonly notes?: readonly string[];
}
export interface Dist { readonly risk: number; readonly caution: number; readonly unknown: number; readonly clear: number; readonly na: number }

export interface Diff { readonly path: string; readonly expected: unknown; readonly actual: unknown }

const nameOf = (r: RuleResult["items"][number]["resource"]): string => (r.name.kind === "sensitive" ? r.name.full : r.name.kind === "plain" ? r.name.text : "(가림)");
const labelText = (l: RuleResult["items"][number]["labels"][number]): string => {
  switch (l.kind) {
    case "intended-public-candidate": return `intended-public-candidate:${l.basis}`;
    case "name-hint": return `name-hint:${l.hint}`;
    case "legacy-hint": return `legacy-hint:${l.basis}`;
    default: return l.kind;
  }
};
const slugOf = (code: string): string => (code.includes(":") ? code.slice(code.indexOf(":") + 1) : code);
const distOf = (d: Distribution): Dist => ({ risk: d.risk, caution: d.caution, unknown: d.unknown, clear: d.clear, na: d.na });
const resolutionText = (r: { readonly kind: string; readonly permissions: readonly string[] }): string => (r.kind === "permission" ? `permission:${[...r.permissions].sort().join(",")}` : r.kind);

export interface Summary {
  readonly rules: Record<string, AnswerRule & { readonly items: readonly (readonly [string, string, string, readonly string[]])[] }>;
  readonly distribution: { readonly rules: Dist; readonly items: Dist };
  readonly firstLook: { readonly mode: string; readonly ruleIds?: readonly string[]; readonly groups?: readonly { readonly resolution: string; readonly ruleIds: readonly string[] }[] };
  readonly banners: readonly string[];
  readonly unlockHints: readonly { readonly permission: string; readonly unlocks: readonly (readonly [string, number])[] }[];
  readonly manual: readonly string[];
  readonly scope: { readonly proven: boolean; readonly missing: number; readonly outOfScope: number };
  readonly doors: Readonly<Record<string, readonly [string, string]>>;
}

/** Report를 정답지와 같은 모양으로 줄여 본다(비교 전용) */
export function summarizeReport(report: Report): Summary {
  const rules: Summary["rules"] = {};
  for (const r of report.doors.flatMap((d) => d.rules)) {
    const items = r.items.map((i) => [i.status, nameOf(i.resource), slugOf(i.why.code), i.labels.map(labelText).sort()] as const);
    rules[r.ruleId] = {
      status: r.status, why: r.status === "na" ? r.why.code : r.status === "unknown" ? r.why.code : r.why.code,
      ...(r.status === "na" ? { basis: r.basis.code } : {}),
      ...(r.status === "unknown" ? { gaps: [...r.gaps], resolution: resolutionText(r.resolution) } : {}),
      items,
    };
  }
  const fl = report.firstLook;
  return {
    rules,
    distribution: { rules: distOf(report.distribution.rules), items: distOf(report.distribution.items) },
    firstLook: fl.mode === "findings" ? { mode: fl.mode, ruleIds: [...fl.ruleIds] }
      : fl.mode === "unlock" ? { mode: fl.mode, groups: fl.groups.map((g) => ({ resolution: resolutionText(g.resolution), ruleIds: [...g.ruleIds] })) } : { mode: fl.mode },
    banners: report.banners.map((b) => b.kind),
    unlockHints: report.permissions.unlockHints.map((h) => ({ permission: h.permission, unlocks: h.unlocks.map((u) => [u.ruleId, u.items] as const) })),
    manual: report.manualChecklist.map((m) => `${m.origin}:${m.ruleId ?? m.door ?? "-"}`),
    scope: { proven: report.scope.proven, missing: report.scope.missing.length, outOfScope: report.scope.outOfScope.length },
    doors: Object.fromEntries(report.doors.map((d) => [d.door, [d.collection.status, d.collection.judgeLevel] as const])),
  };
}

const sortedJson = (xs: readonly unknown[]): string[] => xs.map((x) => JSON.stringify(x)).sort();

/** 정답지와 요약의 차이 목록(경로로 가리킨다). 알려진 차이(tolerate)는 걸러서 돌려준다 */
export function diffAnswer(answer: AnswerFile, actual: Summary): { diffs: Diff[]; tolerated: Diff[] } {
  const all: Diff[] = [];
  const push = (path: string, expected: unknown, got: unknown): void => { if (JSON.stringify(expected) !== JSON.stringify(got)) all.push({ path, expected, actual: got }); };

  const ruleIds = [...new Set([...Object.keys(answer.rules), ...Object.keys(actual.rules)])].sort();
  for (const id of ruleIds) {
    const e = answer.rules[id];
    const a = actual.rules[id];
    if (e === undefined || a === undefined) { all.push({ path: `rules.${id}`, expected: e === undefined ? "absent" : "present", actual: a === undefined ? "absent" : "present" }); continue; }
    push(`rules.${id}.status`, e.status, a.status);
    push(`rules.${id}.why`, e.why, a.why);
    push(`rules.${id}.basis`, e.basis ?? null, a.basis ?? null);
    push(`rules.${id}.gaps`, e.gaps ?? null, a.gaps ?? null);
    push(`rules.${id}.resolution`, e.resolution ?? null, a.resolution ?? null);
    const want = e.items.map((i) => [i[0], i[1], i[2], i[3] ?? []] as const);
    push(`rules.${id}.items`, sortedJson(want), sortedJson(a.items));
  }
  push("distribution", answer.distribution, actual.distribution);
  push("firstLook", answer.firstLook, actual.firstLook);
  push("banners", answer.banners, actual.banners);
  push("manual", [...answer.manual].sort(), [...actual.manual].sort());
  push("scope", answer.scope, actual.scope);
  push("doors", answer.doors, actual.doors);

  // 권한 힌트는 권한 이름 단위로 맞댄다(오늘 허용하는 차이를 권한별로 적을 수 있게)
  const perms = [...new Set([...answer.unlockHints.map((h) => h.permission), ...actual.unlockHints.map((h) => h.permission)])].sort();
  for (const p of perms) {
    const e = answer.unlockHints.find((h) => h.permission === p);
    const a = actual.unlockHints.find((h) => h.permission === p);
    push(`unlockHints.${p}`, e === undefined ? "absent" : e.unlocks, a === undefined ? "absent" : a.unlocks);
  }
  push("unlockHints.order", answer.unlockHints.map((h) => h.permission).filter((p) => actual.unlockHints.some((h) => h.permission === p)), actual.unlockHints.map((h) => h.permission).filter((p) => answer.unlockHints.some((h) => h.permission === p)));

  const diffs: Diff[] = [];
  const tolerated: Diff[] = [];
  for (const d of all) {
    const t = answer.tolerate?.[d.path];
    const shown = typeof d.actual === "string" ? d.actual : d.actual === null || d.actual === undefined ? "absent" : JSON.stringify(d.actual);
    if (t !== undefined && t.accept.includes(shown)) tolerated.push(d);
    else diffs.push(d);
  }
  return { diffs, tolerated };
}
