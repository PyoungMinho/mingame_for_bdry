"use client";

import { useEffect, useState } from "react";
import { msUntilMidnightKST } from "@/lib/dongne/queue";

export interface CountdownParts {
  hours: number;
  minutes: number;
  seconds: number;
  totalMs: number;
}

const DAY_MS = 86_400_000;

function computeParts(): CountdownParts {
  // KST 자정 정각에는 msUntilMidnightKST()가 정확히 86_400_000(=24h)을 반환한다.
  // 그대로 두면 시(hour)가 24로 계산되어 카운트다운이 한 틱 "24:00:00"으로 플래시한다(QA BUG-2).
  // [0, DAY_MS) 로 클램프해 HH를 0~23으로 유지한다(자정 정각 → 00:00:00).
  const totalMs = Math.max(0, msUntilMidnightKST()) % DAY_MS;
  const totalSec = Math.floor(totalMs / 1000);
  return {
    hours: Math.floor(totalSec / 3600),
    minutes: Math.floor((totalSec % 3600) / 60),
    seconds: totalSec % 60,
    totalMs,
  };
}

/**
 * 다음 KST 자정까지 남은 시간을 1초 간격으로 리싱크하는 내부 훅.
 * `src/lib/dongne/queue.ts`의 `msUntilMidnightKST()`만 사용한다(KST 고정 UTC+9 산술
 * 단일 진실 소스 — design-final §9-3 가드. `toLocaleString`/로컬 타임존 금지).
 * `visibilitychange`로 탭이 숨겨지면 타이머를 멈추고, 복귀 시 즉시 재계산해서
 * 드리프트·자정 넘김 오차를 방지한다(CountdownChip·NudgeBanner 공용).
 */
export function useMidnightCountdown(): CountdownParts {
  const [parts, setParts] = useState<CountdownParts>(() => computeParts());

  useEffect(() => {
    let timer: ReturnType<typeof setInterval> | null = null;

    function start() {
      setParts(computeParts());
      timer = setInterval(() => setParts(computeParts()), 1000);
    }
    function stop() {
      if (timer) {
        clearInterval(timer);
        timer = null;
      }
    }
    function handleVisibility() {
      if (document.hidden) stop();
      else start();
    }

    start();
    document.addEventListener("visibilitychange", handleVisibility);
    return () => {
      stop();
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, []);

  return parts;
}

/** HH:MM:SS 고정폭 표기(§4-10, tabular-nums와 함께 사용). */
export function formatHMS(parts: CountdownParts): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(parts.hours)}:${pad(parts.minutes)}:${pad(parts.seconds)}`;
}
