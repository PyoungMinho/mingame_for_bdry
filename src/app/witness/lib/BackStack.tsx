'use client';

/**
 * 뒤로가기·Esc 로 닫을 수 있는 층(시트·모달) 스택 — gung 의 useBackGuard 패턴을 witness 안에 복제·확장.
 * 시트가 열릴 때 push, 닫힐 때 pop. 하드웨어 뒤로가기/Esc 는 가장 위 층만 닫는다.
 */
import { createContext, useContext, useEffect, useMemo, useRef, type ReactNode } from 'react';

interface Layer {
  id: number;
  close: () => void;
  dismissible: boolean;
}

interface BackStackApi {
  push(close: () => void, dismissible?: boolean): { id: number; remove: () => void };
  /** 가장 위 층을 닫는다. 닫았으면 true(닫을 수 없는 층이 맨 위면 삼키고 true) */
  closeTop(): boolean;
  isTop(id: number): boolean;
  count(): number;
}

const Ctx = createContext<BackStackApi | null>(null);

export function BackStackProvider({ children }: { children: ReactNode }) {
  const layers = useRef<Layer[]>([]);
  const seq = useRef(0);
  const api = useMemo<BackStackApi>(
    () => ({
      push(close, dismissible = true) {
        const id = ++seq.current;
        layers.current.push({ id, close, dismissible });
        return {
          id,
          remove: () => {
            layers.current = layers.current.filter((l) => l.id !== id);
          },
        };
      },
      closeTop() {
        const top = layers.current[layers.current.length - 1];
        if (!top) return false;
        if (top.dismissible) top.close();
        return true;
      },
      isTop(id) {
        return layers.current[layers.current.length - 1]?.id === id;
      },
      count: () => layers.current.length,
    }),
    [],
  );
  return <Ctx.Provider value={api}>{children}</Ctx.Provider>;
}

export function useBackStack(): BackStackApi {
  const v = useContext(Ctx);
  if (!v) throw new Error('BackStackProvider 밖에서 사용할 수 없습니다.');
  return v;
}

/** active 인 동안 이 층을 스택에 올린다. 반환값 = 지금 이 층이 맨 위인지 확인하는 함수(포커스 트랩용) */
export function useBackLayer(active: boolean, onClose: () => void, dismissible = true): () => boolean {
  const stack = useBackStack();
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  const idRef = useRef(0);
  useEffect(() => {
    if (!active) return;
    const h = stack.push(() => closeRef.current(), dismissible);
    idRef.current = h.id;
    return () => {
      h.remove();
      idRef.current = 0;
    };
  }, [active, dismissible, stack]);
  return () => idRef.current !== 0 && stack.isTop(idRef.current);
}

/**
 * 하드웨어·브라우저 뒤로(popstate)를 가로챈다. history 센티널 1개를 심고, 뒤로가기가 오면
 *  ① 열린 층이 있으면 맨 위 층 닫기 ② 없으면 onFallback(한 단계 위 화면). 센티널은 매번 다시 심는다.
 * onFallback 이 'leave' 를 돌려주면 센티널을 다시 심지 않고 실제로 뒤로 간다(허브에서 두 번 연속 뒤로).
 */
export function useBackGuard(enabled: boolean, onFallback: () => 'handled' | 'leave'): void {
  const stack = useBackStack();
  const fbRef = useRef(onFallback);
  fbRef.current = onFallback;
  useEffect(() => {
    if (!enabled || typeof window === 'undefined') return;
    window.history.pushState({ wt: 1 }, '');
    const onPop = () => {
      if (stack.closeTop()) {
        window.history.pushState({ wt: 1 }, '');
        return;
      }
      if (fbRef.current() === 'leave') {
        window.removeEventListener('popstate', onPop);
        window.history.back();
        return;
      }
      window.history.pushState({ wt: 1 }, '');
    };
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, [enabled, stack]);

}

/** Esc 는 가장 위 층만 닫는다(화면과 무관하게 항상 켜 둔다) */
export function useEscClose(): void {
  const stack = useBackStack();
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && stack.count() > 0) {
        e.preventDefault();
        stack.closeTop();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [stack]);
}
