// src/lib/cloudcheck/fixtures/invariants.ts — NormalizedInput 불변식 검사기 + 얼리기 도구
// 불변식 검사(checkInvariants)는 API설계자가 공용 헬퍼로 올린 contract/normalized-invariants.ts의 것을 그대로 다시 내보낸다(NORMALIZED.md §5).
// 처음에는 같은 검사를 이 폴더에 사본으로 두었으나, 공용 헬퍼가 생겨 사본을 없앴다. micro 픽스처 · 변이 결과 · 회사 입력이 모두 같은 검사를 받는다.
export { checkInvariants } from "../contract/normalized-invariants";

type Obj = Record<string, unknown>;
const isObj = (x: unknown): x is Obj => typeof x === "object" && x !== null && !Array.isArray(x) && !(x instanceof Map);

export function walk(node: unknown, visit: (o: Obj, path: string) => void, path = "$"): void {
  if (Array.isArray(node)) { node.forEach((x, i) => walk(x, visit, `${path}[${i}]`)); return; }
  if (!isObj(node)) return;
  visit(node, path);
  for (const [k, v] of Object.entries(node)) walk(v, visit, `${path}.${k}`);
}

/** 깊은 freeze (Map은 객체만 freeze: 항목 변경까지는 막지 못한다). buildInput이 하는 것과 같은 모양을 만든다 */
export function deepFreeze<T>(x: T): T {
  if (typeof x !== "object" || x === null || Object.isFrozen(x)) return x;
  Object.freeze(x);
  const values = x instanceof Map ? [...x.values()] : Object.values(x as object);
  for (const v of values) deepFreeze(v);
  return x;
}
