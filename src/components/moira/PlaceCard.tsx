"use client";

import { cn } from "@/lib/utils";
import { Footprints, Star } from "lucide-react";
import type { Place } from "@/lib/moira/mock";
import { FairnessBars } from "./FairnessBars";

export function PlaceCard({
  place,
  rank,
  best = false,
  selected = false,
  onSelect,
  animate = false,
}: {
  place: Place;
  rank: number;
  best?: boolean;
  selected?: boolean;
  onSelect?: () => void;
  animate?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      className={cn(
        "w-full cursor-pointer rounded-2xl bg-moira-surface p-4 text-left transition-all duration-200 ease-[cubic-bezier(.4,0,.2,1)] active:scale-[.995]",
        selected
          ? "ring-2 ring-moira-brand shadow-[0_8px_24px_rgba(79,70,229,.14)]"
          : "ring-1 ring-moira-border hover:ring-slate-300 shadow-[0_1px_2px_rgba(15,23,42,.04)]",
      )}
    >
      <div className="flex items-start gap-3">
        <span
          className={cn(
            "mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-[14px] font-extrabold",
            best ? "bg-moira-brand text-white" : "bg-slate-100 text-moira-body",
          )}
        >
          {rank}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <h3 className="truncate text-[17px] font-extrabold text-moira-ink">{place.name}</h3>
            {best && (
              <span className="inline-flex shrink-0 items-center gap-0.5 rounded-full bg-moira-brand-tint px-2 py-0.5 text-[11px] font-extrabold text-moira-brand">
                <Star size={11} strokeWidth={2.5} className="fill-current" aria-hidden />
                가장 공평
              </span>
            )}
          </div>
          <div className="mt-0.5 flex items-center gap-2 text-[13px] text-moira-muted">
            <span className="font-semibold text-moira-body">{place.category}</span>
            <span className="text-moira-border">·</span>
            <span className="inline-flex items-center gap-0.5">
              <Footprints size={13} strokeWidth={2.5} />역 {place.walkMin}분
            </span>
          </div>
          <p className="mt-1 truncate text-[13px] text-moira-muted">{place.blurb}</p>
        </div>
        {/* 선택 라디오 */}
        <span
          className={cn(
            "mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 transition-colors",
            selected ? "border-moira-brand bg-moira-brand" : "border-moira-border bg-white",
          )}
          aria-hidden
        >
          {selected && <span className="h-2.5 w-2.5 rounded-full bg-white" />}
        </span>
      </div>

      <div className="mt-3.5 border-t border-moira-border pt-3.5">
        <FairnessBars members={place.times} animate={animate} />
      </div>
    </button>
  );
}
