"use client";

import { cn } from "@/lib/utils";
import { Check, Footprints } from "lucide-react";
import type { Place } from "@/lib/moira/mock";

export function VoteOption({
  place,
  votes,
  total,
  voted = false,
  leading = false,
  onVote,
}: {
  place: Place;
  votes: number;
  total: number;
  voted?: boolean;
  leading?: boolean;
  onVote: () => void;
}) {
  const pct = total > 0 ? Math.round((votes / total) * 100) : 0;
  return (
    <button
      type="button"
      onClick={onVote}
      aria-pressed={voted}
      className={cn(
        "w-full cursor-pointer rounded-2xl bg-moira-surface p-4 text-left transition-all duration-200 ease-[cubic-bezier(.4,0,.2,1)] active:scale-[.99]",
        voted
          ? "ring-2 ring-moira-brand shadow-[0_8px_24px_rgba(79,70,229,.14)]"
          : "ring-1 ring-moira-border hover:ring-slate-300",
      )}
    >
      <div className="flex items-center gap-3">
        <span
          className={cn(
            "flex h-7 w-7 shrink-0 items-center justify-center rounded-full border-2 transition-colors",
            voted ? "border-moira-brand bg-moira-brand text-white" : "border-moira-border text-transparent",
          )}
          aria-hidden
        >
          <Check size={15} strokeWidth={3} />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <h3 className="truncate text-[16px] font-extrabold text-moira-ink">{place.name}</h3>
            {leading && votes > 0 && (
              <span className="shrink-0 rounded-full bg-moira-brand-tint px-1.5 py-0.5 text-[10px] font-extrabold text-moira-brand">
                1위
              </span>
            )}
          </div>
          <p className="mt-0.5 flex items-center gap-1.5 text-[12px] text-moira-muted">
            <span className="font-semibold text-moira-body">{place.category}</span>
            <span className="text-moira-border">·</span>
            <span className="inline-flex items-center gap-0.5">
              <Footprints size={12} strokeWidth={2.5} />역 {place.walkMin}분
            </span>
          </p>
        </div>
        <div className="shrink-0 text-right">
          <p className="text-[18px] font-extrabold tabular-nums text-moira-ink">{votes}</p>
          <p className="-mt-1 text-[11px] font-semibold text-moira-muted">표</p>
        </div>
      </div>

      {/* 실시간 집계 진행바 */}
      <div className="mt-3 flex items-center gap-2">
        <div className="h-2 flex-1 overflow-hidden rounded-full bg-moira-track">
          <div
            className={cn(
              "h-full rounded-full transition-[width] duration-500 ease-[cubic-bezier(.22,1,.36,1)]",
              voted ? "bg-moira-brand" : "bg-slate-300",
            )}
            style={{ width: `${pct}%` }}
          />
        </div>
        <span className="w-9 shrink-0 text-right text-[12px] font-bold tabular-nums text-moira-muted">
          {pct}%
        </span>
      </div>
    </button>
  );
}
