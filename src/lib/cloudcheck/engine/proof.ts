// src/lib/cloudcheck/engine/proof.ts — ScopeProof 발급(봉인된 coverage에서만)
// '없음'(이상 없음·해당 없음)을 말할 자격은 선언한 패밀리가 '모두 완결'로 봉인돼 있을 때만 생긴다.
//  - 증명 객체는 이 모듈만 만든다(WeakSet 등록). 룰이 비슷한 모양의 객체를 만들어 돌려줘도 isGenuineProof가 거른다 → 크래시 없이 확인 불가.
//  - 봉인 함수(sealCoverage)는 engine/·rules/에서 쓸 수 없다(가드 테스트). 여기서는 읽기만 하고, 봉인(freeze)·불변식을 한 번 더 확인한다(방어).
import type { FamilyCoverage, FamilyId, NormalizedInput } from "../contract/normalized";
import type { UnknownReason } from "../model/report";
import type { Gap, ScopeProof } from "./types";

export type CoverageLookup = Readonly<Record<string, FamilyCoverage | undefined>>;
/** 입력의 범위 표를 읽기 전용 조회 표로 본다(타입 확장만, 값은 그대로) */
export const coverageLookup = (input: NormalizedInput): CoverageLookup => input.coverage;

const minted = new WeakSet<object>();
export const isGenuineProof = (x: unknown): x is ScopeProof => typeof x === "object" && x !== null && minted.has(x);

const isCount = (n: unknown): n is number => typeof n === "number" && Number.isInteger(n) && n >= 0;

/** 봉인된 완결 coverage인가(방어적 재검사). 손상·위조·미봉인이면 false */
export function isSoundComplete(c: unknown, family: FamilyId): boolean {
  if (typeof c !== "object" || c === null) return false;
  const x = c as Partial<FamilyCoverage>;
  if (!Object.isFrozen(c)) return false;                       // sealCoverage의 결과는 깊게 freeze된다
  if (x.family !== family || x.complete !== true) return false;
  if (!Array.isArray(x.gaps) || x.gaps.length !== 0) return false;
  if (!isCount(x.population) || x.population !== x.present || !isCount(x.input)) return false;
  const u = x.unit;
  if (typeof u !== "object" || u === null || !isCount(u.covered) || u.covered !== u.total) return false;
  if (!Array.isArray(x.units) || x.units.some((unit) => unit.state !== "ok")) return false;
  if (x.expected !== null && x.expected !== undefined && x.expected !== x.present) return false;
  // 구성원 신원 집합이 있으면 문자열이고 중복이 없으며 개수가 모수와 같아야 한다(sealCoverage가 강제한 불변식을 한 번 더 확인)
  if (x.memberKeys !== undefined) {
    if (!Array.isArray(x.memberKeys) || x.memberKeys.length !== x.population || new Set(x.memberKeys).size !== x.memberKeys.length) return false;
    if (!x.memberKeys.every((k) => typeof k === "string")) return false;
  }
  return true;
}

/** 완결이 아닌 coverage의 빈틈 사유(없거나 손상이면 not-collected / scope-unproven) */
export function gapsOf(c: unknown): UnknownReason[] {
  if (typeof c !== "object" || c === null) return ["not-collected"];
  const g = (c as Partial<FamilyCoverage>).gaps;
  if (Array.isArray(g) && g.length > 0) return [...(g as UnknownReason[])];
  return ["scope-unproven"];
}

/**
 * 선언한 패밀리(아이템 1개 + 필요한 것들)가 모두 완결일 때만 ScopeProof. 하나라도 아니면 Gap(빈틈 합집합).
 * 예외를 던지지 않는다.
 */
export function proveScope(tableIn: CoverageLookup, itemFamily: FamilyId, needs: readonly FamilyId[]): ScopeProof | Gap {
  const table: CoverageLookup = typeof tableIn === "object" && tableIn !== null ? tableIn : {};     // 표 자체가 손상돼도 던지지 않는다
  const families: FamilyId[] = [...new Set<FamilyId>([itemFamily, ...needs])];
  const gaps: UnknownReason[] = [];
  const receipts: string[] = [];
  let item: FamilyCoverage | null = null;
  for (const f of families) {
    const c = table[f];
    if (c === undefined || !isSoundComplete(c, f)) { gaps.push(...gapsOf(c)); continue; }
    if (f === itemFamily) item = c;
    for (const r of c.receipts) receipts.push(r);
  }
  if (item === null || gaps.length > 0) return { gaps: dedupe(gaps.length > 0 ? gaps : ["scope-unproven"]) };
  const proof = Object.freeze({
    itemFamily,
    families: Object.freeze([...families]),
    population: item.population as number,
    memberKeys: item.memberKeys === undefined ? null : Object.freeze([...item.memberKeys]),
    input: item.input as number,
    receipts: Object.freeze([...new Set(receipts)]),
    unit: Object.freeze({ kind: item.unit.kind, covered: item.unit.covered as number, total: item.unit.total as number }),
  });
  minted.add(proof);
  return proof as unknown as ScopeProof;
}

const dedupe = <T>(xs: readonly T[]): T[] => [...new Set(xs)];

/** 증명이 없을 때 Report의 Coverage에 쓸 단위 정보: 완결이 아닌 첫 패밀리의 단위, 없으면 아이템 패밀리의 단위 */
export function unitForReport(table: CoverageLookup, itemFamily: FamilyId, needs: readonly FamilyId[]): FamilyCoverage["unit"] {
  const order: FamilyId[] = [itemFamily, ...needs];
  for (const f of order) {
    const c = table[f];
    if (c !== undefined && !isSoundComplete(c, f)) return c.unit;
  }
  const own = table[itemFamily];
  return own ? own.unit : { kind: "none", covered: null, total: null };
}
