/**
 * 게임 ↔ 숨기기 화면 상태 저장소 (외부 저장소, React 렌더를 기다리지 않는다).
 *
 * - 두 레이어(게임·숨기기 시트)는 둘 다 미리 마운트되어 있고, 보이는 쪽은 `.mc-shell[data-view]` 속성이 정한다.
 *   hide()/show()는 속성을 **동기로** 바꾼 다음 구독자에게 알린다(방향서 §4-7, 지연 p95 ≤ 50ms).
 * - 한 방향: 숨기기는 hide()로만 들어가고, 복귀는 show()뿐이다. show()는 게임 시트 탭 클릭 핸들러만 부른다.
 * - 복귀 후에도 숨긴 채 유지하는 규칙은 창 이탈 쪽(useHideKeys)이 hide()만 부르는 것으로 자연스럽게 지켜진다.
 * - performance.measure('mc-hide'): 키/이벤트 시작 mark → hide() 직후 measure (QA V26).
 */

import { useSyncExternalStore } from 'react';
import type { ViewState } from '../protocol';

export type HideReason =
  | 'tab'
  | 'shift-tab'
  | 'esc'
  | 'blur'
  | 'visibility'
  | 'pagehide'
  | 'tabclick' // 숨기기·장식·[+] 시트 탭 클릭
  | 'alarm' // 경보 토스트 클릭
  | 'init'; // 새로고침·입장 직후 숨김으로 시작

export interface ViewSnapshot {
  readonly view: ViewState;
  /** hide/show가 일어날 때마다 +1 (구독 컴포넌트가 리셋 키로 쓴다) */
  readonly version: number;
  /** 마지막으로 숨긴 시각 ms(Date.now, 숨김 시간 표시용이 아니라 디버깅·테스트용) */
  readonly hiddenAt: number | null;
  readonly lastReason: HideReason | null;
}

type Listener = () => void;
export type ViewChangeHandler = (view: ViewState, reason: HideReason | 'return') => void;

const MARK_START = 'mc-hide-start';
/** 공유 시트가 열릴 때 blur ↔ visibilitychange 사이 간격 상한(같은 이탈로 보는 창) */
const LEAVE_PAIR_MS = 1000;

/** 숨기기 직전 시각을 남긴다(키 처리기가 hide() 직전에 부른다). */
export function markHideStart(): void {
  if (typeof performance !== 'undefined' && typeof performance.mark === 'function') {
    try {
      performance.mark(MARK_START);
    } catch {
      /* 무시 */
    }
  }
}

export class ViewStore {
  private snap: ViewSnapshot;
  private readonly listeners = new Set<Listener>();
  private readonly handlers = new Set<ViewChangeHandler>();
  private shell: HTMLElement | null = null;
  /** navigator.share 같은 우리가 연 시트로 창을 벗어나는 경우 1회 예외 */
  private leaveGrace = 0;
  /**
   * 예외 1회 = 이탈 "한 번". 기기에 따라 공유 시트 하나에 blur와 visibilitychange가 연달아 오므로(BUG-21),
   * 첫 신호를 소비한 뒤 잠깐(LEAVE_PAIR_MS) 동안 **다른 종류**의 신호는 같은 이탈로 보고 함께 소비한다. 같은 종류가 다시 오면 새 이탈 → 숨김.
   */
  private leavePair: { until: number; kinds: Set<string> } | null = null;

  constructor(initial: ViewState = 'game') {
    this.snap = { view: initial, version: 0, hiddenAt: initial === 'disguise' ? Date.now() : null, lastReason: initial === 'disguise' ? 'init' : null };
  }

  // ── useSyncExternalStore 규약 ──
  readonly subscribe = (l: Listener): (() => void) => {
    this.listeners.add(l);
    return () => this.listeners.delete(l);
  };
  readonly getSnapshot = (): ViewSnapshot => this.snap;

  get view(): ViewState {
    return this.snap.view;
  }

  /** 셸 DOM 요소를 붙인다(ref). 붙는 즉시 현재 data-view를 맞춘다. */
  readonly attachShell = (el: HTMLElement | null): void => {
    this.shell = el;
    if (el) el.setAttribute('data-view', this.snap.view);
  };

  /** 전환 이벤트 구독(reportView, 제목 고정, 지표용). 해제 함수를 돌려준다. */
  onChange(h: ViewChangeHandler): () => void {
    this.handlers.add(h);
    return () => this.handlers.delete(h);
  }

  /** 숨긴다. 이미 숨어 있으면 false(아무 일도 없다). */
  hide(reason: HideReason): boolean {
    if (this.snap.view === 'disguise') return false;
    this.shell?.setAttribute('data-view', 'disguise'); // React보다 먼저, 같은 프레임
    this.snap = { view: 'disguise', version: this.snap.version + 1, hiddenAt: Date.now(), lastReason: reason };
    this.measure();
    this.emit('disguise', reason);
    return true;
  }

  /** 게임 시트 탭 클릭으로 복귀. 이미 게임이면 false. */
  show(): boolean {
    if (this.snap.view === 'game') return false;
    this.shell?.setAttribute('data-view', 'game');
    this.snap = { view: 'game', version: this.snap.version + 1, hiddenAt: null, lastReason: this.snap.lastReason };
    this.emit('game', 'return');
    return true;
  }

  /** 다음 창 이탈 신호 1회를 무시한다(공유 시트 열기 직전). 2초 안에 소비되지 않으면 사라진다. */
  graceNextLeave(): void {
    this.leaveGrace = Date.now() + 2000;
    this.leavePair = null;
  }
  /**
   * 창 이탈 신호 하나가 예외로 소비되는가. `kind`(blur·visibility·pagehide)를 주면 첫 신호 직후 짝으로 오는
   * 다른 종류 신호도 같은 이탈로 소비한다(공유 시트 1번 = 숨김 0번). 종류를 안 주면 예전처럼 정확히 1회.
   */
  consumeLeaveGrace(kind?: string): boolean {
    const now = Date.now();
    const pair = this.leavePair;
    // pagehide(페이지를 떠남·bfcache)는 짝으로 소비하지 않는다 — 돌아왔을 때 게임 화면이 남아 있으면 안 되므로 안전 쪽
    if (pair && kind && kind !== 'pagehide' && now <= pair.until && !pair.kinds.has(kind)) {
      pair.kinds.add(kind);
      return true;
    }
    this.leavePair = null;
    if (this.leaveGrace > now) {
      this.leaveGrace = 0;
      if (kind) this.leavePair = { until: now + LEAVE_PAIR_MS, kinds: new Set([kind]) };
      return true;
    }
    this.leaveGrace = 0;
    return false;
  }

  private measure(): void {
    if (typeof performance === 'undefined' || typeof performance.measure !== 'function') return;
    try {
      if (performance.getEntriesByName(MARK_START).length > 0) {
        performance.measure('mc-hide', MARK_START);
        performance.clearMarks(MARK_START);
      }
    } catch {
      /* 무시 */
    }
  }

  private emit(view: ViewState, reason: HideReason | 'return'): void {
    for (const l of this.listeners) l();
    for (const h of this.handlers) h(view, reason);
  }
}

export function useViewSnapshot(store: ViewStore): ViewSnapshot {
  return useSyncExternalStore(store.subscribe, store.getSnapshot, store.getSnapshot);
}
