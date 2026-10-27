// src/app/cloudcheck/_client/state/print.ts — 인쇄 버튼 흐름의 유일한 곳(디자인 최종안 §4-4 인쇄 JS 계약). 소유: 페이지개발자.
//  - 루트 클래스는 window.print() 동안만 붙는다. beforeprint·afterprint로 펼치고 접는 코드는 쓰지 않는다(펼침은 CSS가 강제한다).
//  - 브라우저 메뉴 인쇄(Ctrl+P)는 클래스가 없으므로 언제나 전체 리포트 + 마스킹본이다(D6).
export interface PrintOptions {
  readonly scope: "full" | "list";
  readonly unmask: boolean;
}

export function printReport(opts: PrintOptions): void {
  const root = document.documentElement;
  const cls: string[] = [];
  if (opts.scope === "list") cls.push("cc-print-list-only");
  if (opts.unmask) cls.push("cc-print-unmask");
  root.classList.add(...cls);
  const cleanup = (): void => root.classList.remove("cc-print-list-only", "cc-print-unmask");
  window.addEventListener("afterprint", cleanup, { once: true });
  try {
    window.print();
  } finally {
    // print()가 막지 않고 바로 돌아오는 브라우저에서는 마스킹본·전체 리포트로 인쇄된다(안전한 쪽으로 실패). STEP 5에서 iOS Safari 확인
    cleanup();
  }
}
