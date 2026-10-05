'use client';

/**
 * 게임 컨트롤러 훅 — 엔진(src/lib/witness)과 저장(localStorage)을 React 에 이어 준다.
 *
 *  - 하이드레이션 안전: 첫 렌더는 저장을 읽지 않는다(ready=false → 스켈레톤). 마운트 뒤 effect 에서 1회 읽는다.
 *  - 모든 행동은 act(fn): 엔진 Step 을 받아 상태·저장에 반영하고 Step 을 돌려준다(이벤트는 호출자가 연출한다).
 *  - 엔딩 도착(phase 가 ended 로 넘어가는 순간) = meta 갱신. 진행 중인 판 저장은 되감기 선택지가 있으면 남기고(keepSavedRun) 없으면 지운다.
 *  - 새 수사: 끝나지 않은 판을 버리면 그 판에서 찾은 방 증거를 meta.found 에 흡수(absorbFound). 기억 판은 plan(recallPlan)으로 시작.
 *  - 연출 중에는 holdRoute() 로 화면 전환을 잡아 둔다(상태는 이미 반영·저장돼 있다 — 새로고침해도 안전).
 *  - 플레이 시간은 탭이 보일 때만 센다(visibilitychange).
 *  - 저장이 막힌 브라우저에서는 메모리 폴백으로 끝까지 돈다(persistent=false → 안내 띠).
 *  - 두 탭(검토 A1): 이 탭이 마지막으로 읽거나 쓴 저장 문자열을 기억해 두고, 저장소 값이 그와 다르면 '다른 탭이 썼다'로 본다.
 *    · run: 행동(act·patch·startNew·resume) 전에 확인 → 다르면 이 탭의 행동은 버리고 저장을 다시 읽는다(낡은 탭이 진행·되감기를 덮지 못한다).
 *    · meta: 쓰기 직전에 확인 → 다르면 mergeMeta 로 합쳐 쓴다(도감·plays·best 를 잃지 않는다). 전체 초기화·코치 다시 보기만 그대로 쓴다.
 *    · storage 이벤트로 즉시, 이벤트가 안 오는 인앱 브라우저는 visibilitychange 의 patch 로 확인한다.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  READ_LINES_MAX,
  STORAGE_KEYS,
  absorbFound,
  addPlayTime,
  applyResultToMeta,
  clearRun,
  keepSavedRun,
  loadMeta,
  loadRun,
  markSeen,
  mergeMeta,
  newMeta,
  newRun,
  openStorage,
  parseMeta,
  saveMeta,
  saveRun,
  setScreen,
  type OpenedStorage,
  type StorageLike,
  type RecallPlan,
  type RunState,
  type Screen,
  type Settings,
  type Step,
  type WitnessMeta,
  type Id,
  type HintTarget,
} from '@/lib/witness';
import type { FxMode } from './fx';

export type View = 'title' | 'play' | 'ending';
export type LoadNotice = 'version' | 'corrupt' | null;

const SAVED_AT_KEY = 'wt:saved-at';
const READ_FLUSH_MS = 1000;
const PLAY_FLUSH_MS = 15000;

export interface Highlight {
  target: HintTarget;
  at: number;
}

export interface WitnessGame {
  ready: boolean;
  run: RunState | null;
  /** 항상 최신 run(이벤트 핸들러 안에서 stale closure 없이 읽는 용도) */
  getRun: () => RunState | null;
  meta: WitnessMeta;
  settings: Settings;
  fxMode: FxMode;
  reducedMotion: boolean;
  persistent: boolean;
  notice: LoadNotice;
  dismissNotice: () => void;
  savedAt: number | null;
  view: View;
  setView: (v: View) => void;
  /** 연출 중 화면 전환 잠금이 걸려 있으면 그 시점의 화면 */
  heldScreen: Screen | null;
  holdRoute: () => () => void;
  highlight: Highlight | null;
  setHighlight: (h: Highlight | null) => void;

  act: (fn: (run: RunState) => Step) => Step;
  patch: (fn: (run: RunState) => RunState) => void;
  anchor: (partial: Partial<Screen>) => void;
  seen: (ids: Id[]) => void;
  startNew: (opts?: { skipTutorial?: boolean; plan?: RecallPlan | null }) => void;
  resume: () => void;
  toTitle: () => void;
  clearProgress: () => void;
  wipeAll: () => void;
  leaveEnding: () => void;

  /** 다른 탭의 저장을 다시 읽은 횟수(바뀌면 화면이 안내 토스트) */
  synced: number;

  updateSettings: (p: Partial<Settings>) => void;
  markCoach: (id: string) => void;
  resetCoach: () => void;
  markRead: (keys: string[]) => void;
  isRead: (key: string) => boolean;
}

const EMPTY_STEP = (): Step => ({ run: newRun(), events: [], error: 'unknown' });

function rawGet(st: StorageLike, k: string): string | null {
  try {
    return st.getItem(k);
  } catch {
    return null;
  }
}

/** 새 방문자의 글자 속도 기본값 */
export const DEFAULT_SPEED: Settings['speed'] = 'fast';

/**
 * 허브에서 장소·증언으로 들어갈 때 허브 탭을 화면 앵커(screen.tab)에 실어 둔다.
 * 엔진 exit() 는 `tab ?? screen.tab ?? 'house'` 로 허브 탭을 정하므로, 실어 두면 나올 때 마지막으로 보던 탭('사람' 등)으로 돌아온다.
 * (엔진 openSet/enterLocation 은 screen 을 통째로 새로 써서 tab 이 사라진다 — 새로고침해도 이어지게 저장되는 앵커에 둔다)
 */
function carryHubTab(next: RunState | null, prev: RunState | null): RunState | null {
  if (!next || !prev) return next;
  const n = next.screen;
  if ((n.name !== 'location' && n.name !== 'testimony') || n.tab !== undefined || !prev.screen.tab) return next;
  return { ...next, screen: { ...n, tab: prev.screen.tab } };
}

export function useWitnessGame(): WitnessGame {
  const [ready, setReady] = useState(false);
  const [run, setRun] = useState<RunState | null>(null);
  const runRef = useRef<RunState | null>(null);
  const [meta, setMetaState] = useState<WitnessMeta>(() => newMeta());
  const metaRef = useRef<WitnessMeta>(meta);
  const storageRef = useRef<OpenedStorage | null>(null);
  const [persistent, setPersistent] = useState(true);
  const [notice, setNotice] = useState<LoadNotice>(null);
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [view, setViewState] = useState<View>('title');
  const viewRef = useRef<View>('title');
  const [held, setHeld] = useState<Screen | null>(null);
  const lockCount = useRef(0);
  const [highlight, setHighlight] = useState<Highlight | null>(null);
  const [reducedMotion, setReducedMotion] = useState(false);
  const accum = useRef(0);
  const readSet = useRef<Set<string>>(new Set());
  const readTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  /** 이 탭이 마지막으로 읽거나 쓴 저장 문자열(다른 탭이 썼는지 비교용, A1) */
  const lastRunRaw = useRef<string | null>(null);
  const lastMetaRaw = useRef<string | null>(null);
  const [synced, setSynced] = useState(0);

  const storage = useCallback(() => {
    if (!storageRef.current) {
      storageRef.current = openStorage();
      if (!storageRef.current.persistent) setPersistent(false);
    }
    return storageRef.current.storage;
  }, []);

  const setView = useCallback((v: View) => {
    viewRef.current = v;
    setViewState(v);
  }, []);

  // ───────── meta ─────────
  const commitMeta = useCallback(
    (next: WitnessMeta, force = false) => {
      const st = storage();
      let n = next;
      // 다른 탭이 그사이 meta 를 썼으면 덮지 않고 합친다(A1)
      const cur = rawGet(st, STORAGE_KEYS.meta);
      if (!force && cur !== null && cur !== lastMetaRaw.current) {
        n = mergeMeta(parseMeta(cur), next);
        for (const k of n.readLines) readSet.current.add(k);
      }
      metaRef.current = n;
      setMetaState(n);
      if (!saveMeta(st, n)) setPersistent(false);
      lastMetaRaw.current = rawGet(st, STORAGE_KEYS.meta);
    },
    [storage],
  );
  const updateMeta = useCallback(
    (fn: (m: WitnessMeta) => WitnessMeta) => {
      const next = fn(metaRef.current);
      if (next !== metaRef.current) commitMeta(next);
    },
    [commitMeta],
  );

  const flushRead = useCallback(() => {
    if (readTimer.current) {
      clearTimeout(readTimer.current);
      readTimer.current = null;
    }
    updateMeta((m) => {
      const lines = [...readSet.current];
      if (lines.length === m.readLines.length) return m;
      // 상한을 넘으면 최신(뒤쪽)을 남긴다
      return { ...m, readLines: lines.slice(-READ_LINES_MAX) };
    });
  }, [updateMeta]);

  const markRead = useCallback(
    (keys: string[]) => {
      let changed = false;
      for (const k of keys) {
        if (!readSet.current.has(k)) {
          readSet.current.add(k);
          changed = true;
        }
      }
      if (changed && !readTimer.current) readTimer.current = setTimeout(flushRead, READ_FLUSH_MS);
    },
    [flushRead],
  );
  const isRead = useCallback((key: string) => readSet.current.has(key), []);

  // 언마운트: 대기 중인 읽음 기록을 지금 쓰고 타이머를 지운다.
  // (안 지우면 1초 뒤 언마운트된 인스턴스가 자기 meta 스냅샷을 통째로 써서, 그사이 다른 인스턴스가 쓴 도감·플레이 횟수를 덮는다)
  useEffect(
    () => () => {
      if (readTimer.current) flushRead();
    },
    [flushRead],
  );

  // ───────── run ─────────
  const persistRun = useCallback(
    (r: RunState | null) => {
      const st = storage();
      // 되감기 선택지가 있는 끝난 판은 저장해 둔다 — 새로고침해도 [↺ 직전부터 다시]·칩이 남는다(사양 d-1 C1/X4)
      if (!r || !keepSavedRun(r)) {
        clearRun(st);
        lastRunRaw.current = null;
        return;
      }
      if (!saveRun(st, r)) {
        setPersistent(false);
        return;
      }
      lastRunRaw.current = rawGet(st, STORAGE_KEYS.run);
      const at = Date.now();
      try {
        st.setItem(SAVED_AT_KEY, String(at));
      } catch {
        /* 무시 */
      }
      setSavedAt(at);
    },
    [storage],
  );

  const commit = useCallback(
    (rawNext: RunState | null, prev: RunState | null) => {
      const next = carryHubTab(rawNext, prev);
      runRef.current = next;
      setRun(next);
      persistRun(next);
      if (next && prev && next.phase === 'ended' && prev.phase !== 'ended' && next.result) {
        const result = next.result;
        flushRead();
        updateMeta((m) => applyResultToMeta(m, result, Date.now()));
      }
      // 끝난 판이 되감겨 다시 플레이로 — 새로고침 복원용 '엔딩 보는 중' 표시를 내린다(QA-RP-03).
      // 안 내리면 되감은 판을 지운 뒤 새로고침했을 때 되감기 전 실패 엔딩이 잠금 없이 다시 뜬다. 다음 엔딩에서 applyResultToMeta 가 다시 세운다
      if (next && prev && prev.phase === 'ended' && next.phase !== 'ended')
        updateMeta((m) => (m.lastEnding?.pendingView ? { ...m, lastEnding: { ...m.lastEnding, pendingView: false } } : m));
    },
    [flushRead, persistRun, updateMeta],
  );

  /** 저장을 다시 읽는다(다른 탭이 썼을 때) — 이 탭의 판·연출 잠금·쌓인 플레이 시간은 버리고, meta 는 합친다(쓰지는 않는다) */
  const syncFromStorage = useCallback(() => {
    const st = storage();
    const loaded = loadRun(st);
    runRef.current = loaded.run;
    setRun(loaded.run);
    lastRunRaw.current = rawGet(st, STORAGE_KEYS.run);
    const raw = rawGet(st, STORAGE_KEYS.meta);
    if (raw !== null && raw !== lastMetaRaw.current) {
      const m = mergeMeta(parseMeta(raw), metaRef.current);
      for (const k of m.readLines) readSet.current.add(k);
      metaRef.current = m;
      setMetaState(m);
      lastMetaRaw.current = raw;
    }
    accum.current = 0;
    lockCount.current = 0;
    setHeld(null);
    if (!loaded.run && viewRef.current === 'play') {
      viewRef.current = 'title';
      setViewState('title');
    }
    setSynced((n) => n + 1);
  }, [storage]);

  /** 다른 탭이 run 을 썼나 — 그렇다면 다시 읽고 true(호출자는 이번 행동을 버린다) */
  const staleGuard = useCallback((): boolean => {
    const cur = rawGet(storage(), STORAGE_KEYS.run);
    if (cur === lastRunRaw.current) return false;
    syncFromStorage();
    return true;
  }, [storage, syncFromStorage]);

  const takeTime = () => {
    const v = accum.current;
    accum.current = 0;
    return v;
  };
  const withTime = (r: RunState): RunState => (accum.current > 0 ? addPlayTime(r, takeTime()) : r);

  const act = useCallback(
    (fn: (r: RunState) => Step): Step => {
      if (staleGuard()) return { ...EMPTY_STEP(), run: runRef.current ?? newRun(), error: 'stale' };
      const cur = runRef.current;
      if (!cur) return EMPTY_STEP();
      const base = withTime(cur);
      const step = fn(base);
      if (step.run !== base) commit(step.run, cur);
      else if (base !== cur) commit(base, cur);
      return step;
    },
    [commit, staleGuard],
  );

  const patch = useCallback(
    (fn: (r: RunState) => RunState) => {
      if (staleGuard()) return;
      const cur = runRef.current;
      if (!cur) return;
      const base = withTime(cur);
      const next = fn(base);
      if (next !== cur) commit(next, cur);
    },
    [commit, staleGuard],
  );

  const anchor = useCallback(
    (partial: Partial<Screen>) => {
      patch((r) => {
        const s = { ...r.screen, ...partial };
        for (const k of Object.keys(s) as (keyof Screen)[]) if (s[k] === undefined) delete s[k];
        const same = s.name === r.screen.name && s.ref === r.screen.ref && s.tab === r.screen.tab && s.line === r.screen.line && s.replay === r.screen.replay;
        return same ? r : setScreen(r, s);
      });
    },
    [patch],
  );

  const seen = useCallback((ids: Id[]) => patch((r) => markSeen(r, ids)), [patch]);

  const startNew = useCallback(
    (opts: { skipTutorial?: boolean; plan?: RecallPlan | null } = {}) => {
      // 다른 탭이 판을 바꿨으면 이 탭이 본 '저장된 판' 확인이 낡았다 — 다시 읽고 멈춘다(사람이 다시 고른다)
      if (staleGuard()) return;
      const prev = runRef.current;
      // 끝나지 않은 판을 버리면 그 판에서 방에서 찾은 증거를 먼저 흡수한다(사양 d-2 ②)
      if (prev && prev.phase !== 'ended') updateMeta((m) => absorbFound(m, prev));
      const plan = opts.plan ?? null;
      const r = newRun({ now: Date.now(), skipTutorial: opts.skipTutorial, ...(plan ? { recall: plan.ids, recallN: plan.n } : {}) });
      accum.current = 0;
      commit(r, prev);
      updateMeta((m) => (m.lastEnding?.pendingView ? { ...m, lastEnding: { ...m.lastEnding, pendingView: false } } : m));
      setView('play');
    },
    [commit, setView, staleGuard, updateMeta],
  );

  const resume = useCallback(() => {
    if (staleGuard() && !runRef.current) return;
    setView('play');
  }, [setView, staleGuard]);
  const toTitle = useCallback(() => {
    patch((r) => r);
    setView('title');
  }, [patch, setView]);

  const leaveEnding = useCallback(() => {
    updateMeta((m) => (m.lastEnding?.pendingView ? { ...m, lastEnding: { ...m.lastEnding, pendingView: false } } : m));
  }, [updateMeta]);

  const clearProgress = useCallback(() => {
    const st = storage();
    clearRun(st);
    lastRunRaw.current = null;
    try {
      st.removeItem(SAVED_AT_KEY);
    } catch {
      /* 무시 */
    }
    runRef.current = null;
    setRun(null);
    setSavedAt(null);
    setView('title');
  }, [setView, storage]);

  const wipeAll = useCallback(() => {
    clearProgress();
    readSet.current = new Set();
    const keep = metaRef.current.settings;
    commitMeta({ ...newMeta(), settings: keep }, true);
  }, [clearProgress, commitMeta]);

  const updateSettings = useCallback(
    (p: Partial<Settings>) => updateMeta((m) => ({ ...m, settings: { ...m.settings, ...p } })),
    [updateMeta],
  );
  const markCoach = useCallback(
    (id: string) => updateMeta((m) => (m.coach.includes(id) ? m : { ...m, coach: [...m.coach, id] })),
    [updateMeta],
  );
  // 코치 다시 보기는 지우는 동작이라 병합하지 않는다(합치면 다른 탭의 코치 기록이 되살아난다)
  const resetCoach = useCallback(() => commitMeta({ ...metaRef.current, coach: [] }, true), [commitMeta]);

  const holdRoute = useCallback(() => {
    if (lockCount.current === 0) setHeld(runRef.current?.screen ?? null);
    lockCount.current += 1;
    let done = false;
    return () => {
      if (done) return;
      done = true;
      lockCount.current -= 1;
      if (lockCount.current <= 0) {
        lockCount.current = 0;
        setHeld(null);
      }
    };
  }, []);

  // ───────── 하이드레이션 ─────────
  useEffect(() => {
    const st = storage();
    const rm = typeof window !== 'undefined' && typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    setReducedMotion(rm);
    let rawMeta: string | null = null;
    try {
      rawMeta = st.getItem(STORAGE_KEYS.meta);
    } catch {
      rawMeta = null;
    }
    let m = loadMeta(st);
    // 처음 방문: 글자 속도 기본 '빠름'(첫 플레이 25분 목표 — 대사마다 기다리는 시간을 줄인다). OS 모션 줄이기면 즉시(디자인 §5-18)
    if (rawMeta === null) m = { ...m, settings: { ...m.settings, speed: rm ? 'instant' : DEFAULT_SPEED } };
    metaRef.current = m;
    setMetaState(m);
    readSet.current = new Set(m.readLines);
    const loaded = loadRun(st);
    lastRunRaw.current = rawGet(st, STORAGE_KEYS.run);
    lastMetaRaw.current = rawMeta;
    if (loaded.status === 'version' || loaded.status === 'corrupt') setNotice(loaded.status);
    runRef.current = loaded.run;
    setRun(loaded.run);
    let at: number | null = null;
    try {
      const raw = st.getItem(SAVED_AT_KEY);
      at = raw ? Number(raw) : null;
      if (at !== null && !Number.isFinite(at)) at = null;
    } catch {
      at = null;
    }
    setSavedAt(loaded.run ? at : null);
    // 에러 경계의 [이어서 하기] — 한 번만 쓰는 플래그
    let auto = false;
    try {
      auto = window.sessionStorage.getItem('wt:autoresume') === '1';
      window.sessionStorage.removeItem('wt:autoresume');
    } catch {
      auto = false;
    }
    // 화면: 엔딩을 보다 닫았다면 엔딩 화면으로(저장된 끝난 판이면 run 이 살아 있어 [↺ 직전부터 다시]가 그대로 있다).
    // 수사 배제는 예전처럼 타이틀의 이어하기로 간다
    const endedKept = !!loaded.run && loaded.run.phase === 'ended' && loaded.run.result?.ending !== 'excluded';
    setView(
      !loaded.run && m.lastEnding?.pendingView
        ? 'ending'
        : endedKept && m.lastEnding?.pendingView
          ? 'play'
          : auto && loaded.run && loaded.run.phase !== 'ended'
            ? 'play'
            : 'title',
    );
    setReady(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ───────── 다른 탭의 저장(A1) — storage 이벤트로 즉시. 안 오는 브라우저는 visibilitychange 의 patch 가 staleGuard 로 잡는다 ─────────
  useEffect(() => {
    if (!ready) return;
    const on = (e: StorageEvent) => {
      if (e.key === null || e.key === STORAGE_KEYS.run) {
        if (rawGet(storage(), STORAGE_KEYS.run) !== lastRunRaw.current) syncFromStorage();
      } else if (e.key === STORAGE_KEYS.meta && e.newValue !== null && e.newValue !== lastMetaRaw.current) {
        const m = mergeMeta(parseMeta(e.newValue), metaRef.current);
        for (const k of m.readLines) readSet.current.add(k);
        metaRef.current = m;
        setMetaState(m);
        lastMetaRaw.current = e.newValue;
      }
    };
    window.addEventListener('storage', on);
    return () => window.removeEventListener('storage', on);
  }, [ready, storage, syncFromStorage]);

  // ───────── 플레이 시간(탭이 보일 때만) + 주기 저장 ─────────
  useEffect(() => {
    if (!ready) return;
    const tick = setInterval(() => {
      const r = runRef.current;
      if (typeof document !== 'undefined' && document.visibilityState === 'visible' && r && r.phase !== 'ended' && viewRef.current === 'play') accum.current += 1000;
    }, 1000);
    const flush = setInterval(() => {
      if (accum.current >= PLAY_FLUSH_MS) patch((r) => r);
    }, PLAY_FLUSH_MS);
    const onHide = () => {
      patch((r) => r);
      flushRead();
    };
    document.addEventListener('visibilitychange', onHide);
    window.addEventListener('pagehide', onHide);
    return () => {
      clearInterval(tick);
      clearInterval(flush);
      document.removeEventListener('visibilitychange', onHide);
      window.removeEventListener('pagehide', onHide);
    };
  }, [ready, patch, flushRead]);

  const settings = meta.settings;
  const fxMode: FxMode = settings.fx === 'auto' ? (reducedMotion ? 'reduced' : 'full') : settings.fx;

  return useMemo<WitnessGame>(
    () => ({
      ready,
      run,
      getRun: () => runRef.current,
      meta,
      settings,
      fxMode,
      reducedMotion,
      persistent,
      notice,
      dismissNotice: () => setNotice(null),
      savedAt,
      view,
      setView,
      heldScreen: held,
      holdRoute,
      highlight,
      setHighlight,
      act,
      patch,
      anchor,
      seen,
      startNew,
      resume,
      toTitle,
      clearProgress,
      wipeAll,
      leaveEnding,
      synced,
      updateSettings,
      markCoach,
      resetCoach,
      markRead,
      isRead,
    }),
    [ready, run, meta, settings, fxMode, reducedMotion, persistent, notice, savedAt, view, setView, held, holdRoute, highlight, act, patch, anchor, seen, startNew, resume, toTitle, clearProgress, wipeAll, leaveEnding, synced, updateSettings, markCoach, resetCoach, markRead, isRead],
  );
}
