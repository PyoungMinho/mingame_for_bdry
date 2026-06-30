"use client";

import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

export function StickyBottomBar({
  children,
  hint,
  className,
}: {
  children: ReactNode;
  hint?: ReactNode;
  className?: string;
}) {
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-0 z-40 flex justify-center">
      <div
        className={cn(
          "pointer-events-auto w-full max-w-[480px] px-5 pb-[max(16px,env(safe-area-inset-bottom))] pt-4",
          "bg-gradient-to-t from-moira-bg via-moira-bg/95 to-transparent",
          className,
        )}
      >
        {hint && (
          <p className="mb-2.5 text-center text-[13px] font-medium text-moira-muted">{hint}</p>
        )}
        <div className="flex gap-2.5">{children}</div>
      </div>
    </div>
  );
}
