"use client";

import { Clock, Loader2, Flag, CircleDashed } from "lucide-react";
import { cn } from "@/lib/utils";

export interface StatusChipProps {
  status: "pending" | "processing" | "reported";
  className?: string;
}

const CONFIG = {
  pending: {
    label: "검증 대기 중",
    containerClass:
      "bg-realestate-state-pending-bg text-realestate-state-pending border border-dashed border-realestate-neutral-300",
    Icon: Clock,
    iconClass: "text-realestate-state-pending",
    spin: false,
  },
  processing: {
    label: "분석 중",
    containerClass:
      "bg-realestate-state-processing-bg text-realestate-state-processing border border-realestate-state-processing",
    // reduced-motion 시 정적 CircleDashed로 교체 — CSS media query 적용
    Icon: Loader2,
    iconClass: "text-realestate-state-processing",
    spin: true,
  },
  reported: {
    label: "신고 접수됨",
    containerClass:
      "bg-realestate-state-reported-bg text-realestate-state-reported border border-realestate-state-reported",
    Icon: Flag,
    iconClass: "text-realestate-state-reported",
    spin: false,
  },
} as const;

export function StatusChip({ status, className }: StatusChipProps) {
  const cfg = CONFIG[status];
  const { label, containerClass, Icon, iconClass, spin } = cfg;

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 px-badge-pad-x py-badge-pad-y rounded-badge text-trust-label",
        containerClass,
        className
      )}
      aria-label={label}
    >
      {/* processing: 스피너 (reduced-motion 시 정적 아이콘으로 교체) */}
      {spin ? (
        <>
          <Loader2
            size={12}
            className={cn(iconClass, "animate-spin motion-reduce:hidden")}
            aria-hidden="true"
          />
          <CircleDashed
            size={12}
            className={cn(iconClass, "hidden motion-reduce:block")}
            aria-hidden="true"
          />
        </>
      ) : (
        <Icon size={12} className={iconClass} strokeWidth={2} aria-hidden="true" />
      )}
      <span>{label}</span>
    </span>
  );
}
