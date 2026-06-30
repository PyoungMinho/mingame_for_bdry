"use client";

import { cn } from "@/lib/utils";
import { MapPin, Star } from "lucide-react";
import type { Member } from "@/lib/moira/mock";
import { fairLevel, FAIR_STYLE } from "@/lib/moira/fairness";
import { Avatar } from "./MemberChip";
import { CountUp } from "./motion";
import { LINE_COLOR } from "@/lib/moira/transit";

export function StationHero({
  station,
  lines,
  reason,
  gap,
  avg,
  members,
}: {
  station: string;
  lines: string[];
  reason: string;
  gap: number;
  avg: number;
  members: Member[];
}) {
  const level = fairLevel(gap);
  const style = FAIR_STYLE[level];
  return (
    <section className="overflow-hidden rounded-2xl bg-moira-surface p-5 shadow-[0_1px_2px_rgba(15,23,42,.04),0_10px_30px_rgba(79,70,229,.10)] ring-1 ring-moira-border">
      <div className="flex items-center gap-2">
        <span className="text-[12px] font-bold text-moira-muted">추천 중간 지점</span>
        <span className={cn("inline-flex items-center gap-0.5 rounded-full px-2 py-0.5 text-[11px] font-extrabold", style.chipBg, style.chipText)}>
          <Star size={11} strokeWidth={2.5} className="fill-current" aria-hidden />
          {style.label}
        </span>
      </div>

      <div className="mt-1.5 flex items-end gap-2">
        <h1 className="text-[30px] font-extrabold leading-none tracking-[-0.03em] text-moira-ink">
          {station}
        </h1>
        <div className="mb-1 flex gap-1">
          {lines.map((l) => (
            <span
              key={l}
              className="flex h-5 w-5 items-center justify-center rounded-full text-[11px] font-extrabold text-white"
              style={{ backgroundColor: LINE_COLOR[l] ?? "#64748B" }}
            >
              {l}
            </span>
          ))}
        </div>
      </div>
      <p className="mt-1 text-[14px] font-medium text-moira-body">{reason}</p>

      {/* 멤버 → 핀 수렴 모티프 */}
      <div className="mt-4 flex items-center gap-2 rounded-xl bg-moira-bg px-3 py-2.5">
        <div className="flex items-center">
          {members.map((m, i) => (
            <span key={m.id} style={{ marginLeft: i === 0 ? 0 : -9 }}>
              <Avatar name={m.name} color={m.avatar} size={26} ring />
            </span>
          ))}
        </div>
        <span className="flex-1 border-t-2 border-dashed border-slate-300" />
        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-moira-brand text-white shadow-[0_4px_10px_rgba(79,70,229,.35)]">
          <MapPin size={16} strokeWidth={2.5} />
        </span>
      </div>

      {/* 핵심 통계 */}
      <div className="mt-3 grid grid-cols-2 gap-2.5">
        <div className={cn("rounded-xl px-3.5 py-3", style.chipBg)}>
          <p className="text-[12px] font-semibold text-moira-body">멤버 간 최대 격차</p>
          <p className="mt-0.5 flex items-baseline gap-1">
            <span className={cn("text-[24px] font-extrabold tabular-nums", style.text)}>
              <CountUp to={gap} duration={700} />
            </span>
            <span className={cn("text-[13px] font-bold", style.text)}>분</span>
          </p>
        </div>
        <div className="rounded-xl bg-slate-50 px-3.5 py-3">
          <p className="text-[12px] font-semibold text-moira-body">평균 이동시간</p>
          <p className="mt-0.5 flex items-baseline gap-1">
            <span className="text-[24px] font-extrabold tabular-nums text-moira-ink">
              <CountUp to={avg} duration={700} />
            </span>
            <span className="text-[13px] font-bold text-moira-muted">분</span>
          </p>
        </div>
      </div>
    </section>
  );
}
