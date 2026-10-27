// src/app/cloudcheck/_client/state/live.ts — 라이브 영역(polite · assertive) 문구 상태. 소유: 페이지개발자. 근거: UX §6-4, 디자인 §6-0 live 행.
//  - 문구는 t()로 만든 문자열만 받는다(사용자 데이터 없음). "완료"를 쓰지 않는다.
//  - 같은 문구를 연달아 알려도 다시 읽히도록 끝에 NBSP를 번갈아 붙인다(내용이 같으면 스크린리더가 변화로 보지 않는다).
export interface LiveState {
  readonly polite: string;
  readonly assertive: string;
}
export const EMPTY_LIVE: LiveState = { polite: "", assertive: "" };
const NBSP = " ";

/** 새 문구를 알린다. 이전과 같은 글자면 NBSP를 붙이거나 떼어 내용을 바꾼다 */
export function announce(prev: LiveState, kind: "polite" | "assertive", text: string): LiveState {
  const before = prev[kind];
  const next = before === text ? text + NBSP : text;
  return kind === "polite" ? { polite: next, assertive: prev.assertive } : { polite: prev.polite, assertive: next };
}
