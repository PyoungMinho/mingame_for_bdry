"use client";

import { cn } from "@/lib/utils";
import { Check } from "lucide-react";

const STEPS = ["생성", "결과", "투표", "확정"] as const;

export function Stepper({ current }: { current: 1 | 2 | 3 | 4 }) {
  return (
    <ol className="flex items-center">
      {STEPS.map((label, i) => {
        const n = i + 1;
        const done = n < current;
        const active = n === current;
        return (
          <li key={label} className="flex flex-1 items-center last:flex-none">
            <div className="flex flex-col items-center gap-1">
              <span
                className={cn(
                  "flex h-7 w-7 items-center justify-center rounded-full text-[13px] font-bold transition-colors duration-200",
                  done && "bg-moira-brand text-white",
                  active && "bg-moira-brand text-white ring-4 ring-moira-brand-tint",
                  !done && !active && "bg-white text-moira-muted ring-1 ring-moira-border",
                )}
              >
                {done ? <Check size={15} strokeWidth={3} /> : n}
              </span>
              <span
                className={cn(
                  "text-[11px] font-semibold",
                  active ? "text-moira-brand" : done ? "text-moira-ink" : "text-moira-muted",
                )}
              >
                {label}
              </span>
            </div>
            {n < STEPS.length && (
              <span
                className={cn(
                  "mx-1 mb-5 h-[2px] flex-1 rounded-full transition-colors duration-200",
                  done ? "bg-moira-brand" : "bg-moira-border",
                )}
              />
            )}
          </li>
        );
      })}
    </ol>
  );
}
