'use client';

/**
 * 게임 컨트롤러 훅 — 엔진(src/lib/witness)과 저장(localStorage)을 React 에 이어 준다.
 *
 *  - 하이드레이션 안전: 첫 렌더는 저장을 읽지 않는다(ready=false → 스켈레톤). 마운트 뒤 effect 에서 1회 읽는다.
 *  - 모든 행동은 act(fn): 엔진 Step 을 받아 상태·저장에 반영하고 Step 을 돌려준다(이벤트는 호출자가 연출한다).
 *  - 엔딩 도착(phase 가 ended 로 넘어가는 순간) = meta 갱신 + 진행 중인 판 저장 삭제(수사 배제는 되감기를 위해 남긴다).
 *  - 연출 중에는 holdRoute() 로 화면 전환을 잡아 둔다(상태는 이미 반영·저장돼 있다 — 새로고침해도 안전).
 *  - 플레이 시간은 탭이 보일 때만 센다(visibilitychange).
 *  - 저장이 막힌 브라우저에서는 메모리 폴백으로 끝까지 돈다(persistent=false → 안내 띠).
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  STORAGE_KEYS,
  addPlayTime,
  applyResultToMeta,
  clearRun,
  loadMeta,
  loadRun,
  markSeen,
  newMeta,
  newRun,
  openStorage,
  saveMeta,
  saveRun,
  setScreen,
  type OpenedStorage,
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
  startNew: (opts?: { skipTutorial?: boolean }) => void;
  resume: () => void;
  toTitle: () => void;
  clearProgress: () => void;
  wipeAll: () => void;
  leaveEnding: () => void;

  updateSettings: (p: Partial<Settings>) => void;
  markCoach: (id: string) => void;
  resetCoach: () => void;
  markRead: (keys: string[]) => void;
  isRead: (key: string) => boolean;
}

const EMPTY_STEP = (): Step => ({ run: newRun(), events: [], error: 'unknown' });

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
    (next: WitnessMeta) => {
      metaRef.current = next;
      setMetaState(next);
      if (!saveMeta(storage(), next)) setPersistent(false);
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
      return { ...m, readLines: lines.slice(0, 5000) };
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
      if (!r || (r.phase === 'ended' && r.result?.ending !== 'excluded')) {
        clearRun(st);
        return;
      }
      if (!saveRun(st, r)) {
        setPersistent(false);
        return;
      }
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
    },
    [flushRead, persistRun, updateMeta],
  );

  const takeTime = () => {
    const v = accum.current;
    accum.current = 0;
    return v;
  };
  const withTime = (r: RunState): RunState => (accum.current > 0 ? addPlayTime(r, takeTime()) : r);

  const act = useCallback(
    (fn: (r: RunState) => Step): Step => {
      const cur = runRef.current;
      if (!cur) return EMPTY_STEP();
      const base = withTime(cur);
      const step = fn(base);
      if (step.run !== base) commit(step.run, cur);
      else if (base !== cur) commit(base, cur);
      return step;
    },
    [commit],
  );

  const patch = useCallback(
    (fn: (r: RunState) => RunState) => {
      const cur = runRef.current;
      if (!cur) return;
      const base = withTime(cur);
      const next = fn(base);
      if (next !== cur) commit(next, cur);
    },
    [commit],
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
    (opts: { skipTutorial?: boolean } = {}) => {
      const prev = runRef.current;
      const r = newRun({ now: Date.now(), skipTutorial: opts.skipTutorial });
      accum.current = 0;
      commit(r, prev);
      updateMeta((m) => (m.lastEnding?.pendingView ? { ...m, lastEnding: { ...m.lastEnding, pendingView: false } } : m));
      setView('play');
    },
    [commit, setView, updateMeta],
  );

  const resume = useCallback(() => setView('play'), [setView]);
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
    commitMeta({ ...newMeta(), settings: keep });
  }, [clearProgress, commitMeta]);

  const updateSettings = useCallback(
    (p: Partial<Settings>) => updateMeta((m) => ({ ...m, settings: { ...m.settings, ...p } })),
    [updateMeta],
  );
  const markCoach = useCallback(
    (id: string) => updateMeta((m) => (m.coach.includes(id) ? m : { ...m, coach: [...m.coach, id] })),
    [updateMeta],
  );
  const resetCoach = useCallback(() => updateMeta((m) => ({ ...m, coach: [] })), [updateMeta]);

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
    setView(!loaded.run && m.lastEnding?.pendingView ? 'ending' : auto && loaded.run && loaded.run.phase !== 'ended' ? 'play' : 'title');
    setReady(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
      updateSettings,
      markCoach,
      resetCoach,
      markRead,
      isRead,
    }),
    [ready, run, meta, settings, fxMode, reducedMotion, persistent, notice, savedAt, view, setView, held, holdRoute, highlight, act, patch, anchor, seen, startNew, resume, toTitle, clearProgress, wipeAll, leaveEnding, updateSettings, markCoach, resetCoach, markRead, isRead],
  );
}
