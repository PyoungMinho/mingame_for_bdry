// src/lib/cloudcheck/qa/nested.ts — FO-03 중첩 슬롯 변이 도우미(테스트가 아니다). DB설계자의 fixtures/mutate.ts는 고치지 않는다.
// mutate.ts는 문 데이터의 최상위 슬롯·리전/구독별 items까지만 내려간다. 여기서는 대상(버킷·사용자·키·trail·스토리지 계정·NSG …) 안의 슬롯 하나를
// missing(field-missing) · partial(truncated) · none으로 바꾼 NormalizedInput을 만든다. 범위(coverage)는 일부러 다시 봉인하지 않는다:
// '범위는 완결이라고 말하는데 대상 하나의 슬롯이 비어 있는' 불일치 입력에서도 엔진이 이상 없음을 만들지 않는지 본다(엔진 쪽 방어).
import type { NormalizedInput } from "../contract/normalized";
import { deepFreeze } from "../fixtures/invariants";
import { setAt } from "./kit";
import type { Json, Path } from "./kit";

const SLOT_KINDS = new Set(["value", "partial", "none", "missing"]);
const isObj = (x: unknown): x is Record<string, Json> => typeof x === "object" && x !== null && !Array.isArray(x) && !(x instanceof Map);
export const isSlot = (x: unknown): boolean => isObj(x) && typeof x.k === "string" && SLOT_KINDS.has(x.k) && ("src" in x || x.k === "missing");

/** 문 데이터 안의 모든 슬롯 경로(최상위 포함, 값 안의 중첩 슬롯까지). 경로는 input 기준(doors.<문>.data…) */
export function slotPaths(input: NormalizedInput): Path[] {
  const out: Path[] = [];
  const walk = (x: unknown, path: Path): void => {
    if (Array.isArray(x)) { x.forEach((v, i) => walk(v, [...path, i])); return; }
    if (!isObj(x)) return;
    if (isSlot(x)) out.push(path);
    for (const [k, v] of Object.entries(x)) if (k !== "src") walk(v, [...path, k]);
  };
  const doors = input.doors as unknown as Record<string, { state: string; data?: unknown }>;
  for (const [d, sel] of Object.entries(doors)) if (sel.state === "selected") walk(sel.data, ["doors", d, "data"]);
  return out;
}
/** 대상 하나 안의 슬롯인가(문 데이터 최상위·리전/구독별 items가 아닌 것) */
export function isNested(p: Path): boolean {
  const tail = p.slice(3);   // doors.<문>.data 뒤
  if (tail.length === 1) return false;                                  // 최상위 슬롯(users, buckets, …)
  if (tail.length === 3 && tail[2] === "items") return false;          // 리전·구독별 items
  return true;
}

export type NestedKind = "missing" | "partial" | "none";
/** 슬롯 하나를 바꾼 깊은 사본(깊게 freeze) — 바꿀 수 없으면(partial인데 값이 목록이 아님) null. missing의 사유는 why(기본 field-missing) */
export function replaceSlot(input: NormalizedInput, path: Path, kind: NestedKind, why = "field-missing"): NormalizedInput | null {
  let cur: Json = input;
  for (const k of path) cur = cur[k];
  const slot = cur as Json;
  let next: Json;
  if (kind === "missing") next = { k: "missing", why, src: slot.src ?? null };
  else if (kind === "none") { if (slot.src === null || slot.src === undefined) return null; next = { k: "none", src: slot.src }; }
  else {
    if (!(slot.k === "value" && Array.isArray(slot.value))) return null;
    next = { k: "partial", value: slot.value, why: "truncated", src: slot.src };
  }
  if (JSON.stringify(next) === JSON.stringify(slot)) return null;
  const d = structuredClone(input) as Json;
  setAt(d, path, next);
  return deepFreeze(d as NormalizedInput);
}
