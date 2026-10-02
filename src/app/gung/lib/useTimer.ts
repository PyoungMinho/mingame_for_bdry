'use client';

/**
 * §12-1 useTimer — 엔진 TimerState(endsAt 기반)를 1초 틱으로 살려 IncenseTimerValue로 뿌린다.
 *
 *  - 남은 "초"가 바뀔 때만 상태를 갱신한다(250ms 폴링, 렌더는 초당 1회) — 앱 전체가 초당 4번 다시 그려지지 않게.
 *  - 탭 전환/화면 복귀(visibilitychange) 때 즉시 재계산 — setInterval 누적 오차·백그라운드 드리프트 보정.
 *  - 징(onFinish)은 "이 화면에서 돌던 타이머가 0을 지나는 순간"에만 1번. §6-3 #4: 새로고침으로 이미 끝난
 *    타이머를 복원하면 '끝' 상태로 보이되 징은 다시 울리지 않는다.
 */
import { useEffect, useRef, useState } from 'react';
import { timerRemaining, type TimerState } from '@/lib/gung';
import type { IncenseTimerValue } from '../components/types';

function timerId(t: TimerState): string {
  return `${t.kind}:${t.totalMs}:${t.running ? t.endsAt : 'p'}:${t.running ? '' : t.remainingMs}`;
}

export function useTimer(timer: TimerState | null, onFinish?: () => void): IncenseTimerValue | null {
  const [tickState, setTickState] = useState<{ id: string; sec: number } | null>(null);
  const finishRef = useRef(onFinish);
  finishRef.current = onFinish;
  /** 지금 지켜보는 타이머 id + 그 타이머를 처음 봤을 때/마지막으로 봤을 때 끝나 있었는가 */
  const seenRef = useRef<{ id: string; finished: boolean } | null>(null);

  useEffect(() => {
    if (!timer) {
      seenRef.current = null;
      setTickState(null);
      return;
    }
    const id = timerId(timer);
    const tick = () => {
      const remaining = timerRemaining(timer, Date.now());
      const sec = Math.ceil(remaining / 1000);
      setTickState((prev) => (prev && prev.id === id && prev.sec === sec ? prev : { id, sec }));
      const finished = remaining <= 0;
      const seen = seenRef.current;
      if (!seen || seen.id !== id) {
        // 처음 보는 타이머 — 이미 끝나 있으면(복원) 징 없이 '끝'으로만
        seenRef.current = { id, finished };
        return;
      }
      if (finished && !seen.finished) {
        seen.finished = true;
        finishRef.current?.();
      }
    };
    tick();
    if (!timer.running) return;
    const iv = window.setInterval(tick, 250);
    const onVis = () => {
      if (!document.hidden) tick();
    };
    document.addEventListener('visibilitychange', onVis);
    return () => {
      window.clearInterval(iv);
      document.removeEventListener('visibilitychange', onVis);
    };
  }, [timer]);

  if (!timer) return null;
  // 타이머가 막 바뀐 첫 렌더(effect 전)엔 이전 타이머의 초가 남아 있으므로 직접 계산(클라이언트 전용 상태라 SSR 불일치 없음)
  const remainingMs =
    tickState && tickState.id === timerId(timer) ? Math.max(0, tickState.sec * 1000) : Math.ceil(timerRemaining(timer, Date.now()) / 1000) * 1000;
  return { remainingMs, totalMs: timer.totalMs, running: timer.running };
}
