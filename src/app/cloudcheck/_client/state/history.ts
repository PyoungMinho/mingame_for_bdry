// src/app/cloudcheck/_client/state/history.ts — pushState의 유일한 위치(방향서 §1-1 #3·§2-4, 디자인 G-D28). 소유: 페이지개발자.
//  - 인자는 `({ cc: <ScreenId> }, "")` 둘뿐이다(URL·해시 인자 없음). replaceState·location 대입은 쓰지 않는다(R-06).
//  - 부팅 때 history.state는 읽기만 한다. popstate는 화면 ID만 읽는다.
//  - pushState가 예외를 던지면(file:// 보안 오류 등) 한 번 잡아 '이력 없는 모드'로 전환한다. 사용자에게 문구를 보이지 않는다(UX §5 A4).
import { isScreenId, type ScreenId } from "./screens";

export interface HistoryGate {
  /** 화면 ID를 이력에 쌓는다. 쌓았으면 true, 이력 없는 모드이거나 실패하면 false */
  push(screen: ScreenId): boolean;
  /** 이 문서가 push한 적이 있는가([← 돌아가기]가 history.back()을 쓸 수 있는지) */
  readonly pushed: () => boolean;
  /** 이력 없는 모드인가 */
  readonly disabled: () => boolean;
  /** 브라우저 뒤로 */
  back(): void;
  /** 지금 history.state의 화면 ID(없으면 null) — 읽기만 한다 */
  current(): ScreenId | null;
  /** popstate 구독. 콜백은 e.state?.cc가 유효한 화면이면 그 ID, 아니면 null */
  onPop(cb: (screen: ScreenId | null) => void): () => void;
}

export function createHistoryGate(): HistoryGate {
  let pushedEver = false;
  let disabled = false;
  const readCc = (state: unknown): ScreenId | null => {
    if (typeof state !== "object" || state === null) return null;
    const cc = (state as { readonly cc?: unknown }).cc;
    return isScreenId(cc) ? cc : null;
  };
  return {
    push(screen) {
      if (disabled) return false;
      try {
        window.history.pushState({ cc: screen }, "");
        pushedEver = true;
        return true;
      } catch {
        disabled = true;
        return false;
      }
    },
    pushed: () => pushedEver,
    disabled: () => disabled,
    back() {
      window.history.back();
    },
    current() {
      try {
        return readCc(window.history.state);
      } catch {
        return null;
      }
    },
    onPop(cb) {
      const handler = (e: PopStateEvent): void => cb(readCc(e.state));
      window.addEventListener("popstate", handler);
      return () => window.removeEventListener("popstate", handler);
    },
  };
}
