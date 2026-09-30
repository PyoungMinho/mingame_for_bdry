'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { ENDINGS, NODES, START_NODE } from '@/lib/rewind/content';
import {
  applyChoice,
  endSettle,
  newRun,
  progress as advanceRun,
  repayDebt,
  restoreRun,
  settleTrade,
  type Resolution,
  type RunState,
} from '@/lib/rewind/engine';
import { MARKET } from '@/lib/rewind/market-data';
import type { TradeReceipt } from '@/lib/rewind/market';
import type { AssetId, Gender, StoryNode } from '@/lib/rewind/types';

const KEY_RUN = 'rw:run:v1';
const KEY_ENDINGS = 'rw:endings:v1';

function read(key: string): unknown {
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as unknown) : null;
  } catch {
    return null;
  }
}
function write(key: string, v: unknown): boolean {
  try {
    window.localStorage.setItem(key, JSON.stringify(v));
    return true;
  } catch {
    return false;
  }
}

export type FoundEndings = Record<string, { count: number; best: number }>;

function randomSeed(): number {
  try {
    const a = new Uint32Array(1);
    crypto.getRandomValues(a);
    return a[0];
  } catch {
    return Math.floor(Math.random() * 2 ** 32);
  }
}

const progress = (s: RunState) => advanceRun(s, MARKET, ENDINGS);

export function useRewindGame() {
  const [ready, setReady] = useState(false);
  const [screen, setScreen] = useState<'title' | 'game'>('title');
  const [state, setState] = useState<RunState | null>(null);
  const [pending, setPending] = useState<{ from: RunState; res: Resolution } | null>(null);
  const [saved, setSaved] = useState<RunState | null>(null);
  const [found, setFound] = useState<FoundEndings>({});
  const [lastTrade, setLastTrade] = useState<TradeReceipt | null>(null);

  useEffect(() => {
    const raw = read(KEY_RUN);
    const restored = restoreRun(raw, NODES);
    if (raw && !restored) {
      try {
        window.localStorage.removeItem(KEY_RUN); // 깨진 저장은 지운다
      } catch {
        /* 무시 */
      }
    }
    setSaved(restored);
    const f = read(KEY_ENDINGS);
    if (f && typeof f === 'object') setFound(f as FoundEndings);
    setReady(true);
  }, []);

  const commit = useCallback((s: RunState) => {
    setState(s);
    write(KEY_RUN, s);
    setSaved(s);
    if (s.final) {
      const id = s.final.ending.id;
      setFound((prev) => {
        const cur = prev[id];
        const next = { ...prev, [id]: { count: (cur?.count ?? 0) + 1, best: Math.max(cur?.best ?? -Infinity, s.final!.netWorth) } };
        write(KEY_ENDINGS, next);
        return next;
      });
    }
  }, []);

  const start = useCallback(
    (gender: Gender) => {
      setPending(null);
      setLastTrade(null);
      commit(newRun(randomSeed(), gender, START_NODE));
      setScreen('game');
    },
    [commit],
  );

  const resume = useCallback(() => {
    if (!saved) return;
    setPending(null);
    setLastTrade(null);
    // 결과 화면에서 닫았다면 밀린 결산·엔딩 정산부터(선택 결과는 이미 저장돼 있다)
    commit(progress(saved));
    setScreen('game');
  }, [saved, commit]);

  const choose = useCallback(
    (choiceId: string) => {
      if (!state || pending || state.settling || state.final || state.toEnd || state.pending.length) return;
      let res: Resolution;
      try {
        res = applyChoice(state, NODES, MARKET, choiceId);
      } catch {
        return; // 잠긴 선택 등 — 무시
      }
      setPending({ from: state, res });
      write(KEY_RUN, res.state); // 새로고침으로 확률을 다시 굴리지 못하게 즉시 저장
      setSaved(res.state);
    },
    [state, pending],
  );

  const advance = useCallback(() => {
    if (!pending) return;
    setPending(null);
    commit(progress(pending.res.state));
  }, [pending, commit]);

  const trade = useCallback(
    (t: { asset: AssetId; side: 'buy'; krw: number } | { asset: AssetId; side: 'sell'; pct: number }) => {
      if (!state?.settling) return;
      const r = settleTrade(state, MARKET, t);
      setLastTrade(r.receipt);
      commit(r.state);
    },
    [state, commit],
  );

  /** year: 누른 결산 화면의 해 — 더블클릭으로 다음 해 결산까지 넘어가지 않게 */
  const nextYear = useCallback(
    (year: number) => {
      if (!state?.settling || state.settling.year !== year) return;
      setLastTrade(null);
      commit(progress(endSettle(state)));
    },
    [state, commit],
  );

  const repay = useCallback(() => {
    if (!state?.settling) return;
    setLastTrade(null);
    commit(repayDebt(state));
  }, [state, commit]);

  const toTitle = useCallback(() => {
    setPending(null);
    setScreen('title');
  }, []);

  const node: StoryNode | null = useMemo(() => {
    const s = pending ? pending.from : state;
    return s ? NODES[s.nodeId] ?? null : null;
  }, [pending, state]);

  return {
    ready,
    screen,
    state,
    view: pending ? pending.from : state,
    pending: pending?.res ?? null,
    node,
    saved,
    found,
    lastTrade,
    start,
    resume,
    choose,
    advance,
    trade,
    repay,
    nextYear,
    toTitle,
  };
}

export type RewindGame = ReturnType<typeof useRewindGame>;
