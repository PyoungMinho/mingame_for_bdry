'use client';

/**
 * §12-1 lib/useGame.ts(여기선 useGungGame.ts) — 엔진(src/lib/gung) + 영속화(§6) + 진입 판정(§6-3 #6)을
 * 하나로 묶는 훅. 사건 데이터는 `sejaCase` 하나로 고정(§7-3 case-data.ts).
 *
 * 이 훅은 "게임이 시작된 뒤"의 GameState만 다룬다. 방 만들기 인원 선택(S2)·코드 입력(S4)·
 * 자리 고르기(S6)·이어하기 충돌(O9) 같은 **게임 시작 전 UI 흐름**은 로컬 상태라 `GungApp`(화면 레이어)이
 * 가지고, 이 훅의 `createHost`/`joinAsPlayer`/`hostRecover`/`resumeSaved`/`startFresh` 호출로 마무리한다.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import {
  type Assignment,
  type EntryDecision,
  type GameAction,
  type GameState,
  type GungPrefs,
  type PlayerCount,
  type RoomCode,
  assignmentOf,
  decideEntry,
  DEFAULT_PREFS,
  applyAction as engineApplyAction,
  generateRoomCode,
  loadGame,
  loadPrefs,
  newHostGame,
  newPlayerGame,
  openStorage,
  parseEntryParams,
  ROUTE_PATH,
  type StorageLike,
  saveGame,
  savePrefs,
  clearGame as storageClearGame,
  clearNote,
} from '@/lib/gung';
import { sejaCase } from '@/lib/gung/case-data';

export type GungScreenMode = 'booting' | 'home' | 'createRoom' | 'enterCode' | 'seatPick' | 'conflict' | 'badCode' | 'playing';

export interface PendingRoom {
  room: RoomCode;
  asHost: boolean;
}

/** 화면 레이어에 1회성으로 알릴 일(토스트·시트) — 소비하면 clearNotice() */
export type GungNotice =
  /** §2-D 새로고침 복원 토스트 "이어하는 중 · 3번 자리 · 조사 2" */
  | { kind: 'resumed'; seat: number; phase: GameState['phase'] }
  /** §2-D 방장 복구(?as=host / '내가 방장이에요') — O1 진행 단계 맞추기를 바로 연다 */
  | { kind: 'hostRecovered' }
  /** §2-E 늦게 온 사람(S6 「늦게 왔소」) — O1 진행 단계 맞추기를 바로 연다(QA BUG-23) */
  | { kind: 'lateJoin' };

export interface UseGungGame {
  ready: boolean;
  mode: GungScreenMode;
  state: GameState | null;
  assignment: Assignment | null;
  entry: EntryDecision | null;
  pendingRoom: PendingRoom | null;
  storagePersistent: boolean;
  /** §6-3 #9 저장된 게임의 사건 버전 ≠ 지금 번들 */
  saveVersionMismatch: boolean;
  /** §2-E 초대 링크 &v= ≠ 지금 번들(S5 경고 배너) */
  linkVersionMismatch: boolean;
  /** O9 충돌 시 기존 진행 중 게임(라벨용) */
  conflictSaved: GameState | null;
  notice: GungNotice | null;
  clearNotice: () => void;
  prefs: GungPrefs;
  setPrefs: (patch: Partial<GungPrefs>) => void;

  dispatch: (action: GameAction) => void;

  /** S1 "코드로 참가하기" 버튼 → S4 */
  goEnterCode: () => void;
  /** S1 "방 만들기(방장)" 버튼 → S2 */
  goCreateRoom: () => void;
  /** 어떤 모드에서든 S1 홈으로 */
  goHome: () => void;
  /** S4/O9 "새 사건으로 입장" — 유효한 코드 문자열(5자)을 받아 seatPick/conflict/resume 중 적절히 */
  submitCode: (code: string, asHost?: boolean) => boolean;
  /** S2 "방 열기" — 인원 n으로 새 방 생성 → 바로 playing(phase=lobby) */
  createHost: (n: PlayerCount) => RoomCode | null;
  /** S6 "자리 앉기" — late 면 입장 직후 O1 진행 단계 맞추기를 연다(§2-E 늦참) */
  joinAsPlayer: (seat: number, opts?: { late?: boolean }) => void;
  /** S5 "내가 방장이에요" — 저장이 없을 때 자리 1 방장 모드로 생성 */
  hostRecover: () => void;
  /** O9 "이어하기" */
  resumeSaved: () => void;
  /** O9 "새 사건으로 입장" — 기존 저장을 지우고 pendingRoom으로 진행 */
  startFreshFromConflict: () => void;
  /** 처음으로(O3 확인 이후 호출) — 저장을 지우고 S1으로 */
  resetToHome: () => void;
}

function nowMs(): number {
  return Date.now();
}

/**
 * 주소창을 "지금 활성 게임"에 맞춘다 — 방장은 /gung 에서 방을 만들기 때문에 그대로 두면 새로고침이 홈(S1)으로 떨어지고
 * '방 만들기' 한 번에 진행 중 게임이 덮어써진다. ?code= 가 있으면 §6-3 #6 대로 같은 코드 = 자동 복원.
 * (useSearchParams 는 마운트 때 1번만 읽으므로 replaceState 로 바꿔도 재판정되지 않는다.)
 */
function syncUrl(code: string | null): void {
  try {
    const url = code ? `${ROUTE_PATH}?code=${encodeURIComponent(code)}` : ROUTE_PATH;
    if (window.location.pathname + window.location.search !== url) window.history.replaceState(window.history.state, '', url);
  } catch {
    /* 일부 인앱 브라우저 history 제한 — 무시 */
  }
}

export function useGungGame(): UseGungGame {
  const searchParams = useSearchParams();
  const storageRef = useRef<{ storage: StorageLike; persistent: boolean } | null>(null);

  const [ready, setReady] = useState(false);
  const [mode, setMode] = useState<GungScreenMode>('booting');
  const [state, setState] = useState<GameState | null>(null);
  const [entry, setEntry] = useState<EntryDecision | null>(null);
  const [pendingRoom, setPendingRoom] = useState<PendingRoom | null>(null);
  const [prefs, setPrefsState] = useState<GungPrefs>(DEFAULT_PREFS);
  const [storagePersistent, setStoragePersistent] = useState(true);
  const [saveVersionMismatch, setSaveVersionMismatch] = useState(false);
  const [linkVersionMismatch, setLinkVersionMismatch] = useState(false);
  const [conflictSaved, setConflictSaved] = useState<GameState | null>(null);
  const [notice, setNotice] = useState<GungNotice | null>(null);
  const clearNotice = useCallback(() => setNotice(null), []);

  useEffect(() => {
    const opened = openStorage();
    storageRef.current = opened;
    setStoragePersistent(opened.persistent);
    const loaded = loadGame(opened.storage, nowMs(), { caseId: sejaCase.id, caseVersion: sejaCase.version });
    setSaveVersionMismatch(loaded.versionMismatch);
    const params = parseEntryParams(searchParams);
    setLinkVersionMismatch(params.caseVersion !== null && params.caseVersion !== sejaCase.version);
    const decision = decideEntry(loaded.state, params);
    setEntry(decision);
    setPrefsState(loadPrefs(opened.storage));

    switch (decision.kind) {
      case 'resume':
        setState(decision.state);
        setNotice({ kind: 'resumed', seat: decision.state.seat, phase: decision.state.phase });
        syncUrl(decision.state.code);
        setMode('playing');
        break;
      case 'home':
        setMode('home');
        break;
      case 'conflict':
        setPendingRoom({ room: decision.room, asHost: decision.asHost });
        setConflictSaved(decision.saved);
        setMode('conflict');
        break;
      case 'join':
        setPendingRoom({ room: decision.room, asHost: false });
        setMode('seatPick');
        break;
      case 'hostRecover':
        setPendingRoom({ room: decision.room, asHost: true });
        setMode('seatPick');
        break;
      case 'badCode':
        setMode('badCode');
        break;
    }
    setReady(true);
    // searchParams 는 최초 1회만 — 게임 중 URL 파라미터 변화로 다시 판정하지 않는다.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const persist = useCallback((next: GameState) => {
    const opened = storageRef.current;
    if (!opened) return;
    saveGame(opened.storage, next);
  }, []);

  const dispatch = useCallback(
    (action: GameAction) => {
      setState((prev) => {
        if (!prev) return prev;
        const next = engineApplyAction(prev, action, { c: sejaCase, now: nowMs() });
        if (next !== prev) persist(next);
        return next;
      });
    },
    [persist],
  );

  // pagehide 때 한 번 더 flush
  useEffect(() => {
    const flush = () => {
      const opened = storageRef.current;
      if (opened && state) saveGame(opened.storage, state);
    };
    window.addEventListener('pagehide', flush);
    return () => window.removeEventListener('pagehide', flush);
  }, [state]);

  const setPrefs = useCallback((patch: Partial<GungPrefs>) => {
    setPrefsState((prev) => {
      const next = { ...prev, ...patch };
      const opened = storageRef.current;
      if (opened) savePrefs(opened.storage, next);
      return next;
    });
  }, []);

  const goEnterCode = useCallback(() => setMode('enterCode'), []);
  const goCreateRoom = useCallback(() => setMode('createRoom'), []);
  const goHome = useCallback(() => setMode('home'), []);

  const submitCode = useCallback(
    (code: string, asHost = false): boolean => {
      const params = parseEntryParams(`code=${encodeURIComponent(code)}`);
      if (!params.room) return false;
      const opened = storageRef.current;
      const saved = opened ? loadGame(opened.storage, nowMs(), { caseId: sejaCase.id, caseVersion: sejaCase.version }).state : null;
      if (saved) {
        if (saved.code === params.room.code) {
          setState(saved);
          setNotice({ kind: 'resumed', seat: saved.seat, phase: saved.phase });
          syncUrl(saved.code);
          setMode('playing');
          return true;
        }
        setPendingRoom({ room: params.room, asHost });
        setConflictSaved(saved);
        setMode('conflict');
        return true;
      }
      setPendingRoom({ room: params.room, asHost });
      setMode(asHost ? 'playing' : 'seatPick');
      if (asHost) {
        const fresh = newHostGame(sejaCase, params.room.code, nowMs());
        if (!fresh) return false;
        setState(fresh);
        persist(fresh);
        syncUrl(fresh.code);
      }
      return true;
    },
    [persist],
  );

  const createHost = useCallback(
    (n: PlayerCount): RoomCode | null => {
      try {
        const room = generateRoomCode(n);
        const fresh = newHostGame(sejaCase, room.code, nowMs());
        if (!fresh) return null;
        // 새 방 — 개인 추리 수첩(gu:note:v1)도 비운다(R4)
        if (storageRef.current) clearNote(storageRef.current.storage);
        setState(fresh);
        persist(fresh);
        setPendingRoom(null);
        syncUrl(fresh.code);
        setMode('playing');
        return room;
      } catch {
        return null;
      }
    },
    [persist],
  );

  const joinAsPlayer = useCallback(
    (seat: number, opts?: { late?: boolean }) => {
      if (!pendingRoom) return;
      const fresh = newPlayerGame(sejaCase, pendingRoom.room.code, seat, nowMs());
      if (!fresh) return;
      setState(fresh);
      persist(fresh);
      setPendingRoom(null);
      if (opts?.late) setNotice({ kind: 'lateJoin' });
      syncUrl(fresh.code);
      setMode('playing');
    },
    [pendingRoom, persist],
  );

  const hostRecover = useCallback(() => {
    if (!pendingRoom) return;
    const fresh = newHostGame(sejaCase, pendingRoom.room.code, nowMs());
    if (!fresh) return;
    setState(fresh);
    persist(fresh);
    setPendingRoom(null);
    setNotice({ kind: 'hostRecovered' });
    syncUrl(fresh.code);
    setMode('playing');
  }, [pendingRoom, persist]);

  const resumeSaved = useCallback(() => {
    const opened = storageRef.current;
    const saved = opened ? loadGame(opened.storage, nowMs(), { caseId: sejaCase.id, caseVersion: sejaCase.version }).state : null;
    if (!saved) {
      // 그사이 만료·삭제됐으면 홈으로(버튼이 아무 반응 없는 상태를 만들지 않는다)
      setConflictSaved(null);
      setMode('home');
      return;
    }
    setState(saved);
    setPendingRoom(null);
    setConflictSaved(null);
    setNotice({ kind: 'resumed', seat: saved.seat, phase: saved.phase });
    syncUrl(saved.code);
    setMode('playing');
  }, []);

  const startFreshFromConflict = useCallback(() => {
    const opened = storageRef.current;
    if (opened) storageClearGame(opened.storage);
    if (!pendingRoom) {
      setMode('home');
      return;
    }
    if (pendingRoom.asHost) {
      const fresh = newHostGame(sejaCase, pendingRoom.room.code, nowMs());
      if (fresh) {
        setState(fresh);
        persist(fresh);
        setPendingRoom(null);
        setConflictSaved(null);
        setNotice({ kind: 'hostRecovered' });
        syncUrl(fresh.code);
        setMode('playing');
        return;
      }
    }
    setConflictSaved(null);
    setMode('seatPick');
  }, [pendingRoom, persist]);

  const resetToHome = useCallback(() => {
    const opened = storageRef.current;
    if (opened) {
      storageClearGame(opened.storage);
      clearNote(opened.storage); // '처음으로' — 수첩도 지운다(R4)
    }
    setState(null);
    setPendingRoom(null);
    setConflictSaved(null);
    setSaveVersionMismatch(false);
    setEntry({ kind: 'home', resume: null });
    syncUrl(null);
    setMode('home');
  }, []);

  const assignment = state ? assignmentOf(sejaCase, state) : null;

  return {
    ready,
    mode,
    state,
    assignment,
    entry,
    pendingRoom,
    storagePersistent,
    saveVersionMismatch,
    linkVersionMismatch,
    conflictSaved,
    notice,
    clearNotice,
    prefs,
    setPrefs,
    dispatch,
    goEnterCode,
    goCreateRoom,
    goHome,
    submitCode,
    createHost,
    joinAsPlayer,
    hostRecover,
    resumeSaved,
    startFreshFromConflict,
    resetToHome,
  };
}
