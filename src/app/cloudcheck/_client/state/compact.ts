// src/app/cloudcheck/_client/state/compact.ts — 스크롤하면 띠가 한 줄로 줄어든다(<html>에 cc-compact). 소유: 페이지개발자. 근거: UX §3-3, 디자인 §6-0.
//  - 24px 넘으면 붙이고 16px 아래로 오면 뗀다(8px 이력 — 경계에서 깜빡이지 않게). passive 리스너.
const ON = 24;
const OFF = 16;

export function installCompact(): () => void {
  const root = document.documentElement;
  const update = (): void => {
    const y = window.scrollY;
    if (y > ON) root.classList.add("cc-compact");
    else if (y < OFF) root.classList.remove("cc-compact");
  };
  window.addEventListener("scroll", update, { passive: true });
  update();
  return () => {
    window.removeEventListener("scroll", update);
    root.classList.remove("cc-compact");
  };
}
