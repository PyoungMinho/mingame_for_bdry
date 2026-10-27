// src/app/cloudcheck/_client/components/cx.ts — 클래스 이름 이어 붙이기(의존성 없음). 모든 토큰은 cc- 접두(디자인 G-D15)이며, 렌더 테스트가 DOM 전체에서 다시 검사한다.
export type ClassPart = string | false | null | undefined;

export function cx(...parts: readonly ClassPart[]): string {
  let out = "";
  for (const p of parts) {
    if (typeof p === "string" && p !== "") out += out === "" ? p : ` ${p}`;
  }
  return out;
}
