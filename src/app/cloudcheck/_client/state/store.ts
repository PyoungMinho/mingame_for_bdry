// src/app/cloudcheck/_client/state/store.ts — 동기 외부 저장소(useSyncExternalStore용). 소유: 페이지개발자.
// 이유: 액션 함수가 dispatch 직후 getState()로 '방금 바뀐 상태'를 읽을 수 있어야 한다(예: report-ready 직후 show("report")의 데이터 가드).
// React의 useReducer는 렌더 뒤에야 상태를 주므로 이런 연쇄에서 낡은 상태를 읽는다. 이 저장소는 reducer를 즉시 적용한다.
export interface Store<S, A> {
  getState(): S;
  dispatch(action: A): void;
  subscribe(listener: () => void): () => void;
}

export function createStore<S, A>(reducer: (state: S, action: A) => S, initial: S): Store<S, A> {
  let state = initial;
  const listeners = new Set<() => void>();
  return {
    getState: () => state,
    dispatch(action) {
      const next = reducer(state, action);
      if (next === state) return;
      state = next;
      for (const l of [...listeners]) l();
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
}
