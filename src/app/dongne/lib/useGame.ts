'use client';

/**
 * 동네고수 — 게임 본체 상태 머신 (페이지개발자 소유)
 *
 * 방향서 §2 자정 스냅샷: gameNo는 세션(마운트) 시작 시 1회 고정한다. 새로고침·재방문 시에만
 * 새 gameNo로 전환되고, 진행 중인 세션 도중에는 절대 바뀌지 않는다(공정성 — 도중 정답 변경 금지).
 *
 * 필수 가드(design-final §9): `today`(정답 Region 전체)는 정답 판정/힌트 계산을 위해 메모리에는
 * 항상 존재하지만, `today.name`/`today.centroid` 등은 `status !== 'playing'`이 될 때까지 이 훅을
 * 소비하는 페이지(page.tsx)가 화면에 렌더하면 안 된다 — 그 가드는 페이지 쪽 책임이다(이 훅은
 * 값만 제공한다).
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { computeHint, getRegionCodeForGame, getTodayGameNo, msUntilMidnightKST } from '@/lib/dongne/queue';
import * as storage from '@/lib/dongne/storage';
import type { GameState, GameStatus, Guess, PlayerStats, Region, Silhouette } from '@/lib/dongne/types';
import { getRegionByCode } from './manifest';

export type SilhouetteLoadState = 'loading' | 'ready' | 'error';

const DAY_MS = 86_400_000;

export function useDongneGame() {
  // 세션 시작 시 1회 고정(자정 스냅샷 가드) — 이후 리렌더에도 절대 재계산하지 않는다.
  const [gameNo] = useState(() => getTodayGameNo());

  const today = useMemo<Region | null>(() => {
    if (gameNo < 1) return null;
    return getRegionByCode(getRegionCodeForGame(gameNo)) ?? null;
  }, [gameNo]);

  const [guesses, setGuesses] = useState<Guess[]>([]);
  const [status, setStatus] = useState<GameStatus>('playing');
  const [stats, setStats] = useState<PlayerStats>(() => storage.defaultStats());
  const [onboarded, setOnboardedState] = useState(false);
  const [hometownCode, setHometownCodeState] = useState<string | null>(null);
  const [settingHometown, setSettingHometown] = useState(false);
  const [storageAvailable, setStorageAvailable] = useState(true);

  const [silhouette, setSilhouette] = useState<Silhouette | null>(null);
  const [silhouetteState, setSilhouetteState] = useState<SilhouetteLoadState>('loading');
  const [retryToken, setRetryToken] = useState(0);

  const [showStorageNotice, setShowStorageNotice] = useState(false);
  const [streakRiskDismissed, setStreakRiskDismissed] = useState(false);

  const pingFiredRef = useRef(false);

  // 초기 복원(마운트 1회) — localStorage 접근은 전부 여기서만(SSR-safe: 초기 useState 기본값은
  // 서버 렌더와 동일하게 유지하고, 실제 브라우저 스토리지 읽기는 effect 안에서만 수행한다).
  useEffect(() => {
    if (gameNo < 1) return;
    const saved = storage.loadGameState(gameNo);
    if (saved) {
      setGuesses(saved.guesses);
      setStatus(saved.status);
    }
    setStats(storage.loadStats());
    setOnboardedState(storage.isOnboarded());
    setHometownCodeState(storage.getHometownCode());
    setStreakRiskDismissed(storage.isStreakRiskDismissed(gameNo));

    const available = storage.isStorageAvailable();
    setStorageAvailable(available);
    if (!available) {
      setShowStorageNotice(storage.shouldShowStorageNotice());
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gameNo]);

  // 실루엣 온디맨드 동적 import(정적 import 아님 — 방향서 §2-1) — 오늘 코드 1개만,
  // 실패해도 non-blocking(게임 자체는 자동완성만으로 계속 진행 가능, design-final §4-3/§9-15).
  useEffect(() => {
    if (!today) return;
    let cancelled = false;
    setSilhouetteState('loading');
    import(`../data/silhouettes/${today.code}.json`)
      .then((mod) => {
        if (cancelled) return;
        setSilhouette((mod.default ?? mod) as Silhouette);
        setSilhouetteState('ready');
      })
      .catch(() => {
        if (cancelled) return;
        setSilhouetteState('error');
      });
    return () => {
      cancelled = true;
    };
  }, [today, retryToken]);

  const retrySilhouette = useCallback(() => setRetryToken((t) => t + 1), []);

  const guessedCodes = useMemo(() => guesses.map((g) => g.code), [guesses]);

  /** 첫 인터랙션 시 1회, KST 하루 1인 1회만(방향서 §5-1) — 실패는 조용히 무시(임무 지시) */
  const pingOnce = useCallback(() => {
    if (pingFiredRef.current || gameNo < 1) return;
    pingFiredRef.current = true;
    if (storage.hasPingedToday(gameNo)) return;
    const anonId = storage.getAnonId();
    fetch('/api/dongne/ping', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ anonId, gameNo }),
      keepalive: true,
    })
      .then((res) => {
        if (res.ok) storage.markPingedToday(gameNo);
      })
      .catch(() => {
        /* fire-and-forget — 실패 무시 */
      });
  }, [gameNo]);

  const submitGuess = useCallback(
    (region: Region) => {
      if (!today || status !== 'playing') return;
      const correct = region.code === today.code;
      const guess: Guess = correct
        ? { code: region.code, distanceKm: 0, direction: null, proximity: 100, correct: true }
        : { code: region.code, correct: false, ...computeHint(region.centroid, today.centroid) };

      const nextGuesses = [...guesses, guess];
      let nextStatus: GameStatus = 'playing';
      if (correct) nextStatus = 'won';
      else if (nextGuesses.length >= 6) nextStatus = 'lost';

      setGuesses(nextGuesses);
      setStatus(nextStatus);
      storage.saveGameState({ gameNo, guesses: nextGuesses, status: nextStatus, updatedAt: Date.now() });

      if (nextStatus !== 'playing') {
        setStats(storage.recordCompletedGame(gameNo, nextStatus === 'won', nextGuesses.length));
      }
    },
    [today, status, guesses, gameNo],
  );

  const dismissOnboarding = useCallback(() => {
    storage.setOnboarded();
    setOnboardedState(true);
  }, []);

  const dismissStorageNotice = useCallback(() => setShowStorageNotice(false), []);

  const dismissStreakRisk = useCallback(() => {
    storage.dismissStreakRisk(gameNo);
    setStreakRiskDismissed(true);
  }, [gameNo]);

  const registerHometown = useCallback((region: Region) => {
    storage.setHometownCode(region.code);
    setHometownCodeState(region.code);
    setSettingHometown(false);
  }, []);

  const openHometownPicker = useCallback(() => setSettingHometown(true), []);
  const closeHometownPicker = useCallback(() => setSettingHometown(false), []);

  // 스트릭 위험 넛지(§4-12) 조건: 오늘 미플레이 & streak>0 & KST≥21:00.
  // "KST 현재 시각"은 queue.ts의 msUntilMidnightKST()만으로 유도한다(중복 시간 로직 금지 가드).
  const kstHour = useMemo(() => Math.floor((DAY_MS - msUntilMidnightKST()) / 3_600_000), []);

  const showNudge =
    status === 'playing' &&
    !streakRiskDismissed &&
    stats.lastPlayedGameNo !== gameNo &&
    stats.currentStreak > 0 &&
    kstHour >= 21;

  return {
    gameNo,
    today,
    status,
    guesses,
    guessedCodes,
    silhouette,
    silhouetteState,
    retrySilhouette,
    submitGuess,
    stats,
    storageAvailable,
    onboarded,
    dismissOnboarding,
    hometownCode,
    settingHometown,
    openHometownPicker,
    closeHometownPicker,
    registerHometown,
    showStorageNotice,
    dismissStorageNotice,
    showNudge,
    dismissStreakRisk,
    pingOnce,
  };
}

export type DongneGame = ReturnType<typeof useDongneGame>;
