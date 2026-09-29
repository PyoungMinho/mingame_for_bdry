'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { ENDING_IDS, START_NODE } from '@/lib/zombie/contract';
import { ENDINGS, NODES } from '@/lib/zombie/content';
import { applyChoice, newRun, resolveEnding, restoreRun, type Resolution, type RunState } from '@/lib/zombie/engine';
import type { EndingId, StoryNode } from '@/lib/zombie/types';
import { KEYS, readJSON, removeKey, writeJSON } from './storage';

export type FoundEndings = Partial<Record<EndingId, { count: number; first: number }>>;

function readFound(): FoundEndings {
  const raw = readJSON(KEYS.endings);
  if (!raw || typeof raw !== 'object') return {};
  const out: FoundEndings = {};
  for (const id of ENDING_IDS) {
    const v = (raw as Record<string, unknown>)[id];
    if (v && typeof v === 'object' && typeof (v as { count?: unknown }).count === 'number') {
      out[id] = v as { count: number; first: number };
    }
  }
  return out;
}

function randomSeed(): number {
  try {
    const a = new Uint32Array(1);
    crypto.getRandomValues(a);
    return a[0];
  } catch {
    return Math.floor(Math.random() * 2 ** 32);
  }
}

export type Screen = 'title' | 'game';

/**
 * 게임 상태 훅. 선택 즉시 결과 상태를 저장한다 — 새로고침으로 확률을 다시 굴릴 수 없다.
 * 화면 흐름: title → game(노드 ↔ 결과 패널) → 엔딩(state.ending && 결과 패널 닫힘)
 */
export function useZombieGame() {
  const [ready, setReady] = useState(false);
  const [screen, setScreen] = useState<Screen>('title');
  const [state, setState] = useState<RunState | null>(null);
  /** 결과 패널에 보여 줄 직전 선택의 처리 결과 (닫으면 state 가 다음 노드로 넘어간다) */
  const [pending, setPending] = useState<{ from: RunState; res: Resolution } | null>(null);
  const [saved, setSaved] = useState<RunState | null>(null);
  const [found, setFound] = useState<FoundEndings>({});
  const [storageOk, setStorageOk] = useState(true);

  useEffect(() => {
    setSaved(restoreRun(readJSON(KEYS.run), NODES));
    setFound(readFound());
    setStorageOk(writeJSON('zb:probe', 1));
    removeKey('zb:probe');
    setReady(true);
  }, []);

  const persist = useCallback((s: RunState) => {
    writeJSON(KEYS.run, s);
    setSaved(s);
  }, []);

  const start = useCallback(() => {
    const s = newRun(randomSeed(), NODES[START_NODE]);
    setPending(null);
    setState(s);
    persist(s);
    setScreen('game');
  }, [persist]);

  const resume = useCallback(() => {
    if (!saved) return;
    setPending(null);
    setState(saved);
    setScreen('game');
  }, [saved]);

  const choose = useCallback(
    (choiceId: string) => {
      if (!state || pending || state.ending) return;
      const res = applyChoice(state, NODES, choiceId);
      setPending({ from: state, res });
      persist(res.state);
      if (res.state.ending) {
        const id = res.state.ending;
        setFound((prev) => {
          const cur = prev[id];
          const next: FoundEndings = { ...prev, [id]: { count: (cur?.count ?? 0) + 1, first: cur?.first ?? Date.now() } };
          writeJSON(KEYS.endings, next);
          return next;
        });
      }
    },
    [state, pending, persist],
  );

  const advance = useCallback(() => {
    if (!pending) return;
    setState(pending.res.state);
    setPending(null);
  }, [pending]);

  /** 결말까지 저장된 판(마지막 결과 패널에서 새로고침한 경우 등)의 엔딩 화면을 다시 연다 */
  const viewEnding = useCallback(() => {
    if (!saved?.ending) return;
    setPending(null);
    setState(saved);
    setScreen('game');
  }, [saved]);

  const toTitle = useCallback(() => {
    setPending(null);
    setScreen('title');
  }, []);

  /** 화면에 그릴 노드: 결과 패널이 떠 있으면 방금 고른 노드, 아니면 현재 노드 */
  const node: StoryNode | null = useMemo(() => {
    const s = pending ? pending.from : state;
    return s ? NODES[s.nodeId] ?? null : null;
  }, [pending, state]);

  const ending = useMemo(() => (state && !pending ? resolveEnding(state, ENDINGS) : null), [state, pending]);

  return {
    ready,
    screen,
    state,
    view: pending ? pending.from : state,
    pending: pending?.res ?? null,
    node,
    ending,
    saved,
    found,
    storageOk,
    start,
    resume,
    viewEnding,
    choose,
    advance,
    toTitle,
  };
}

export type ZombieGame = ReturnType<typeof useZombieGame>;
