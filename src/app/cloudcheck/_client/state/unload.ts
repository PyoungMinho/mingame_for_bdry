// src/app/cloudcheck/_client/state/unload.ts — beforeunload 확인(리포트 유실 방지 장치 1). 소유: 페이지개발자. 근거: 디자인 Q7, UX §6-2.
//  - 실제 리포트(report.mode.kind === "real")가 메모리에 있을 때만 건다. 없어지면 뗀다(필요할 때만 걸어야 뒤로 가기 캐시를 덜 막는다).
//  - 체험 리포트에는 걸지 않는다(다시 만들 수 있는 것에 경고를 걸면 소음이 된다). 확인창 문구는 브라우저가 정한다.
let installed: ((e: BeforeUnloadEvent) => void) | null = null;

const guard = (e: BeforeUnloadEvent): void => {
  e.preventDefault();
  e.returnValue = "";
};

/** active가 true면 리스너를 걸고(이미 걸려 있으면 그대로), false면 뗀다 */
export function syncUnloadGuard(active: boolean): void {
  if (active && installed === null) {
    installed = guard;
    window.addEventListener("beforeunload", guard);
  } else if (!active && installed !== null) {
    window.removeEventListener("beforeunload", installed);
    installed = null;
  }
}

export const unloadGuardActive = (): boolean => installed !== null;
