"use client";

import { useEffect, useRef, useState } from "react";

/** prefers-reduced-motion 감지 */
export function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduced(mq.matches);
    const on = () => setReduced(mq.matches);
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, []);
  return reduced;
}

/** 마운트 직후 true → 진입 트랜지션 트리거용 */
export function useMounted(delay = 0): boolean {
  const [on, setOn] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setOn(true), delay);
    return () => clearTimeout(t);
  }, [delay]);
  return on;
}

/** 숫자 카운트업 — reduced-motion이면 즉시 최종값 */
export function CountUp({
  to,
  duration = 700,
  delay = 0,
  className,
  suffix = "",
}: {
  to: number;
  duration?: number;
  delay?: number;
  className?: string;
  suffix?: string;
}) {
  const reduced = useReducedMotion();
  const [val, setVal] = useState(reduced ? to : 0);
  const raf = useRef<number>();

  useEffect(() => {
    // 모션 비활성 또는 숨겨진 탭(rAF 정지)에선 즉시 최종값 — 숫자가 어중간하게 멈추지 않게
    if (reduced || document.hidden) {
      setVal(to);
      return;
    }
    let startTs = 0;
    const tick = (now: number) => {
      if (!startTs) startTs = now;
      const p = Math.min(1, (now - startTs) / duration);
      const eased = 1 - Math.pow(1 - p, 3); // easeOutCubic
      setVal(Math.round(eased * to));
      if (p < 1) raf.current = requestAnimationFrame(tick);
    };
    const start = setTimeout(() => {
      raf.current = requestAnimationFrame(tick);
    }, delay);
    // 안전장치: rAF가 throttle/정지돼도 최종값은 반드시 도달
    const settle = setTimeout(() => setVal(to), delay + duration + 120);
    // 애니메이션 중 탭이 숨겨지면 최종값으로 스냅
    const onHide = () => {
      if (document.hidden) setVal(to);
    };
    document.addEventListener("visibilitychange", onHide);
    return () => {
      clearTimeout(start);
      clearTimeout(settle);
      document.removeEventListener("visibilitychange", onHide);
      if (raf.current) cancelAnimationFrame(raf.current);
    };
  }, [to, duration, delay, reduced]);

  return (
    <span className={className} style={{ fontVariantNumeric: "tabular-nums" }}>
      {val}
      {suffix}
    </span>
  );
}
