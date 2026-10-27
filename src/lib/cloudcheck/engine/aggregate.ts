// src/lib/cloudcheck/engine/aggregate.ts — 구성원 → 룰 집계 (INV-1·4·5·6·7의 구조적 강제)
// 입력: 룰의 판정 함수가 돌려준 구성원 목록 + 범위 증명(또는 구멍).
// 출력: 룰 상태 5종 중 하나와 근거. 룰은 상태를 직접 반환할 수 없고, 이 함수만 상태를 정한다.
//
// 규칙(위에서부터 적용)
//  0) 구성원 정규화
//     - clear·excluded는 증거가 있고 전부 '답'(ok·empty·notconfigured 영수증 또는 CSV 칸)이어야 한다. 아니면 확인 불가(clear-without-evidence)로 강등.
//     - 룰의 maxStatus 위를 넘는 위험은 주의로 내린다(KEY-1 같은 '주의 상한' 룰).
//  1) INV-7: 확인 불가(denied) 구성원의 증거가 '일부 대상에서만 거부된' 호출이면(같은 호출이 다른 대상에서는 성공) 주의(isolated-denial)로 올린다.
//  2) 위험·주의가 하나라도 있으면 가장 나쁜 쪽이 룰 상태다. 부분 데이터에서도 유지한다(INV-4).
//  3) 그 밖에는 확인 불가에서 시작한다(INV-1). 진짜 ScopeProof가 있어야만 이상 없음·해당 없음으로 승격한다.
//     - 모든 구성원이 결과를 가져야 한다(구성원 수 = 증명된 모수, 증명이 구성원 신원 집합을 싣고 있으면 룰이 평가한 구성원의 신원 집합 = 그 집합). 하나라도 확인 불가면 룰은 확인 불가다.
//       개수만 맞는 바꿔치기(다른 구독의 항목으로 바꿈 · 같은 대상을 복제함)는 신원 집합이 다르므로 모수를 증명하지 못한 것(population-mismatch)이다 — 양성(위험·주의)은 그대로 두되 범위는 '증명되지 않음'으로 보인다(CC-QA-02 · 15).
//     - 적용 대상 = 모수 − 제외. 0이면 해당 없음(INV-5), 아니면 이상 없음(allowsClear일 때만).
//  4) 이상 없음·해당 없음에는 기준 시각이 필요하다. 없으면 확인 불가(field-missing).
import type { ReceiptFact, ReceiptKey } from "../contract/normalized";
import type { RuleSpec } from "./types";
import type { Member, RuleOutcome, ScopeProof, Gap, CallId } from "./types";
import type { UnknownReason } from "../model/report";
import { isGenuineProof } from "./proof";
import { msg } from "./msg";
import { sortReasons } from "./reasons";

export type AggStatus = "risk" | "caution" | "clear" | "unknown" | "na";

export interface AggEnv {
  readonly receipts: ReadonlyMap<ReceiptKey, ReceiptFact>;
  readonly inputCount: number;
  /** 룰의 기준 시각이 있는가(이상 없음·해당 없음의 필수 조건) */
  readonly hasAsOf: boolean;
}

export interface Aggregated {
  readonly status: AggStatus;
  /** 정규화·INV-7 승격이 끝난 구성원 중 보고서에 나올 것(제외 제외) */
  readonly members: readonly Member[];
  readonly excluded: readonly Member[];
  readonly proof: ScopeProof | null;
  /** 증명된 모수(제외 전)와 적용 대상 수. 증명이 없으면 null */
  readonly population: number | null;
  readonly applicable: number | null;
  /** 확인 불가일 때의 빈틈(정렬·중복 제거 완료, 1개 이상) */
  readonly gaps: readonly UnknownReason[];
  /** 룰 수준 빈틈 중 coverage(패밀리)에서 온 것 — 해소법·파라미터 계산용 */
  readonly coverageGaps: readonly UnknownReason[];
}

const ANSWER: ReadonlySet<string> = new Set(["ok", "empty", "notconfigured"]);

/** 증거 하나가 '답'인가: 영수증이 ok·empty·notconfigured이거나 CSV 칸. 영수증이 없거나 입력 번호가 범위 밖이면 아니다 */
function evidenceIsAnswer(src: Member["ev"][number]["src"], env: AggEnv): boolean {
  if (!Number.isInteger(src.input) || src.input < 0 || src.input >= env.inputCount) return false;
  if (src.receipt !== null) {
    const r = env.receipts.get(src.receipt);
    return r !== undefined && ANSWER.has(r.result);
  }
  return src.csv !== null;
}

function normalizeMember(m: Member, spec: RuleSpec, env: AggEnv): Member {
  if (m.s === "clear" || m.s === "excluded") {
    if (m.ev.length === 0 || !m.ev.every((e) => evidenceIsAnswer(e.src, env))) {
      return { s: "unknown", res: m.res, why: msg("clear-without-evidence"), ev: m.ev, facts: m.facts, labels: m.labels };
    }
    return m;
  }
  if (m.s === "risk" && spec.maxStatus !== "risk") return { ...m, s: "caution" };
  return m;
}

/** INV-7: 같은 호출이 다른 대상에서는 성공했는데 이 대상만 거부됨 → 주의(isolated-denial) */
function liftIsolatedDenials(members: readonly Member[], spec: RuleSpec, env: AggEnv): Member[] {
  const calls: readonly CallId[] = spec.isolatedDenial === null ? [] : spec.isolatedDenial.calls;
  if (calls.length === 0 || spec.maxStatus === "unknown") return [...members];
  // 호출별로 성공한 대상 집합(항목 단위 호출만: resource가 있는 영수증)
  const succeeded = new Map<string, Set<string>>();
  for (const r of env.receipts.values()) {
    if (!r.used || r.resource === null || !calls.includes(r.call) || !ANSWER.has(r.result)) continue;
    let set = succeeded.get(r.call);
    if (set === undefined) { set = new Set<string>(); succeeded.set(r.call, set); }
    set.add(r.resource);
  }
  return members.map((m): Member => {
    if (m.s !== "unknown" || m.why.code !== "denied") return m;
    for (const e of m.ev) {
      const r = e.src.receipt === null ? undefined : env.receipts.get(e.src.receipt);
      if (r === undefined || r.result !== "denied" || r.resource === null || !calls.includes(r.call)) continue;
      const others = succeeded.get(r.call);
      if (others !== undefined && [...others].some((x) => x !== r.resource)) {
        return { s: "caution", res: m.res, why: msg("isolated-denial"), ev: m.ev, facts: m.facts, labels: m.labels };
      }
    }
    return m;
  });
}

/**
 * 룰이 평가한 구성원(제외 포함)이 증명된 모수와 같은가: 개수가 같고, 증명이 신원 집합을 싣고 있으면 신원 집합도 같다.
 * 신원은 ResourceDesc.familyKey(없으면 id)다. 같은 신원이 겹치면(Azure 컨테이너처럼 이름이 같고 내용이 다른 대상) 두 번째부터 ~2, ~3을 붙여 범위 표와 같은 규칙으로 센다.
 */
function populationHolds(proof: ScopeProof, members: readonly Member[]): boolean {
  if (members.length !== proof.population) return false;
  const keys = proof.memberKeys;
  if (keys === null) return true;
  const seen = new Map<string, number>();
  const got: string[] = [];
  for (const m of members) {
    const base = m.res.familyKey === undefined ? m.res.id : m.res.familyKey;
    const n = (seen.get(base) ?? 0) + 1;
    seen.set(base, n);
    got.push(n === 1 ? base : `${base}~${n}`);
  }
  got.sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
  return got.length === keys.length && keys.every((k, i) => k === got[i]);
}

const gapsOfCoverage = (cov: ScopeProof | Gap): UnknownReason[] => {
  if (isGenuineProof(cov)) return [];
  const g = (cov as Partial<Gap> | null | undefined)?.gaps;          // 위조·손상된 증명도 크래시 없이 확인 불가로
  return Array.isArray(g) && g.length > 0 ? [...g] : ["scope-unproven"];
};

export function aggregate(spec: RuleSpec, outcome: RuleOutcome, env: AggEnv): Aggregated {
  const normalized = outcome.members.map((m) => normalizeMember(m, spec, env));
  const lifted = liftIsolatedDenials(normalized, spec, env);
  const excluded = lifted.filter((m) => m.s === "excluded");
  const members = lifted.filter((m) => m.s !== "excluded");
  const positives = members.filter((m) => m.s === "risk" || m.s === "caution");
  const unknownMembers = members.filter((m) => m.s === "unknown");
  // 진짜 증명이어도 룰이 평가한 구성원이 증명된 모수와 다르면(개수 · 신원 집합) 그 증명을 쓰지 않는다
  const genuine: ScopeProof | null = isGenuineProof(outcome.coverage) ? outcome.coverage : null;
  const mismatch = genuine !== null && !populationHolds(genuine, outcome.members);
  const proof: ScopeProof | null = mismatch ? null : genuine;
  const coverageGaps: UnknownReason[] = mismatch ? ["population-mismatch"] : gapsOfCoverage(outcome.coverage);
  const population = proof === null ? null : proof.population;
  const base = { members, excluded, proof, population, coverageGaps };

  // 2) 양성은 부분 데이터에서도 유지한다(INV-4). maxStatus로 상한
  if (positives.length > 0) {
    const worst: AggStatus = positives.some((m) => m.s === "risk") ? "risk" : "caution";
    const status: AggStatus = spec.maxStatus === "unknown" ? "unknown" : worst === "risk" && spec.maxStatus !== "risk" ? "caution" : worst;
    if (status === "unknown") return { ...base, status, gaps: ["guide-only"], applicable: null };
    return { ...base, status, gaps: [], applicable: proof === null ? null : proof.population - excluded.length };
  }

  const unknown = (gaps: readonly UnknownReason[]): Aggregated => ({
    ...base, status: "unknown", gaps: sortReasons(gaps.length > 0 ? gaps : ["scope-unproven"]), applicable: null,
  });
  const memberGaps = unknownMembers.map((m) => m.why.code as UnknownReason);

  // 3) 시작은 확인 불가(INV-1). 진짜 증명이 있어야만 승격한다
  if (spec.maxStatus === "unknown") return unknown(["guide-only"]);
  if (proof === null) return unknown([...coverageGaps, ...memberGaps]);
  if (unknownMembers.length > 0) return unknown(memberGaps);

  const applicable = proof.population - excluded.length;
  if (!env.hasAsOf) return unknown(["field-missing"]);                       // 기준 시각 없이는 '없음'을 말하지 않는다
  if (applicable === 0) return { ...base, status: "na", gaps: [], applicable: 0 };       // INV-5
  if (!spec.allowsClear) return unknown(["no-clear-rule"]);
  return { ...base, status: "clear", gaps: [], applicable };
}
