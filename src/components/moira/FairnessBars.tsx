"use client";

import { cn } from "@/lib/utils";
import { ArrowDown, ArrowUp } from "lucide-react";
import { avgOf, fairLevel, gapOf, FAIR_STYLE, type MemberTime } from "@/lib/moira/fairness";
import { CountUp, useMounted, useReducedMotion } from "./motion";

interface FairnessBarsProps {
  members: MemberTime[];
  /** 진입 시 막대 staggered 성장 + 숫자 카운트업 */
  animate?: boolean;
  className?: string;
}

/**
 * 제품의 시그니처 — 멤버별 이동시간 가로막대 + 격차 증명.
 * 색은 '오직 공평도'만 의미한다(격차 등급).
 */
export function FairnessBars({ members, animate = false, className }: FairnessBarsProps) {
  const reduced = useReducedMotion();
  const mounted = useMounted(60);
  const grow = !animate || reduced || mounted; // 최종 너비로 펼침

  const max = Math.max(...members.map((m) => m.minutes));
  const min = Math.min(...members.map((m) => m.minutes));
  const avg = avgOf(members);
  const gap = gapOf(members);
  const level = fairLevel(gap);
  const style = FAIR_STYLE[level];

  return (
    <div className={cn("space-y-2.5", className)}>
      <div className="relative">
        <ul className="space-y-2">
          {members.map((m, i) => {
            const isMax = m.minutes === max;
            const isMin = m.minutes === min;
            const width = `${(m.minutes / max) * 100}%`;
            return (
              <li key={`${m.name}-${i}`} className="flex items-center gap-2.5">
                <span className="w-9 shrink-0 text-[13px] font-bold text-moira-body">{m.name}</span>
                <div className="relative h-2.5 flex-1 overflow-hidden rounded-full bg-moira-track">
                  <div
                    className={cn(
                      "absolute left-0 top-0 h-full rounded-full transition-[width] duration-700 ease-[cubic-bezier(.22,1,.36,1)]",
                      style.bar,
                    )}
                    style={{
                      width: grow ? width : "0%",
                      transitionDelay: animate ? `${i * 70}ms` : "0ms",
                    }}
                  />
                </div>
                <span className="flex w-[52px] shrink-0 items-baseline justify-end gap-0.5">
                  <span className={cn("text-[14px] font-extrabold tabular-nums text-moira-ink")}>
                    {animate ? <CountUp to={m.minutes} delay={i * 70} duration={650} /> : m.minutes}
                  </span>
                  <span className="text-[11px] font-semibold text-moira-muted">분</span>
                  {isMax && (
                    <span className={cn("ml-0.5 inline-flex items-center", style.text)}>
                      <ArrowUp size={11} strokeWidth={3} aria-hidden />
                      <span className="sr-only">가장 오래 걸림</span>
                    </span>
                  )}
                  {isMin && (
                    <span className="ml-0.5 inline-flex items-center text-slate-300">
                      <ArrowDown size={11} strokeWidth={3} aria-hidden />
                      <span className="sr-only">가장 가까움</span>
                    </span>
                  )}
                </span>
              </li>
            );
          })}
        </ul>
      </div>

      {/* 증명 라인 — 격차가 주인공 */}
      <div className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2">
        <div className="flex items-baseline gap-1.5">
          <span className="text-[12px] font-semibold text-moira-muted">최대 격차</span>
          <span className={cn("text-[18px] font-extrabold tabular-nums", style.text)}>
            {animate ? <CountUp to={gap} delay={members.length * 70} duration={600} /> : gap}
          </span>
          <span className={cn("text-[12px] font-bold", style.text)}>분</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[12px] font-medium text-moira-muted">
            평균 <span className="font-bold text-moira-body tabular-nums">{avg}</span>분
          </span>
          <span
            className={cn(
              "rounded-full px-2 py-0.5 text-[11px] font-extrabold",
              style.chipBg,
              style.chipText,
            )}
          >
            {style.label}
          </span>
        </div>
      </div>
    </div>
  );
}
