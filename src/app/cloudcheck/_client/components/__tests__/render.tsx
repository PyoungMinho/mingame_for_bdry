// src/app/cloudcheck/_client/components/__tests__/render.tsx — 컴포넌트 RTL 테스트 공용 도우미(테스트 파일이 아니다 — vitest가 수집하지 않고 가드도 건너뛴다).
//  - unexpectedMissing: 렌더 결과의 ⟦키⟧ 중 '있어야 하는데 없는 C·S 키'만 돌려준다. E 네임스페이스(rules/i18n/ko.ts가 병합되기 전)와
//    s-keys.ts가 선언한 'S 대기'(페이지개발자가 screens.ts를 채우기 전)는 허용한다 — 나머지 C·S 키가 빠지면 실패.
//  - classTokens / attrValues: G-D15(클래스 cc- 접두)·G-D8(속성에 사용자 데이터 0) 렌더 검사용.
import { fileOfKey, hasKey } from "../../i18n/index";
import { allSKeys } from "../s-keys";

const MISSING_RE = /⟦([^⟧]+)⟧/g;

export function missingKeys(root: ParentNode): string[] {
  const text = (root as Node).textContent ?? "";
  return [...text.matchAll(MISSING_RE)].map((m) => m[1] ?? "");
}

export function unexpectedMissing(root: ParentNode): string[] {
  const pending = new Set(allSKeys());
  return missingKeys(root).filter((k) => {
    const file = fileOfKey(k);
    if (file === "engine") return false;
    if (file === "screens" && pending.has(k) && !hasKey(k)) return false;
    return true;
  });
}

/** 속성값 전부(이름=값) */
export function attrValues(root: ParentNode): string[] {
  const out: string[] = [];
  for (const el of Array.from(root.querySelectorAll("*"))) {
    for (const a of Array.from(el.attributes)) out.push(a.value);
  }
  return out;
}

export function classTokens(root: ParentNode): string[] {
  const out: string[] = [];
  for (const el of Array.from(root.querySelectorAll("*"))) {
    for (const c of Array.from(el.classList)) out.push(c);
  }
  return out;
}

/** 텍스트에서 ⟦…⟧ 조각을 지운 글자(금지어 검사는 키 이름이 아니라 화면 글자를 본다) */
export function visibleText(root: ParentNode): string {
  return ((root as Node).textContent ?? "").replace(MISSING_RE, "");
}
