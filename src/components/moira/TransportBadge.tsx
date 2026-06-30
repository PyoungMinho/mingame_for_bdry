"use client";

import { cn } from "@/lib/utils";
import { Train, Bus, Footprints, Car } from "lucide-react";
import { LINE_COLOR } from "@/lib/moira/transit";

// 이모지 0 — lucide 아이콘만 사용

type TransportMode = "subway" | "bus" | "walk" | "car";
type BadgeSize = "sm" | "md";

export interface TransportBadgeProps {
  mode: TransportMode;
  line?: string;   // subway 전용: "2", "4" 등
  size?: BadgeSize;
}

const ICON_SIZE: Record<BadgeSize, number> = { sm: 12, md: 15 };
const TEXT_SIZE: Record<BadgeSize, string> = {
  sm: "text-[11px]",
  md: "text-[13px]",
};
const PAD: Record<BadgeSize, string> = {
  sm: "px-1.5 py-0.5 gap-0.5",
  md: "px-2 py-1 gap-1",
};

const MODE_STYLE: Record<
  TransportMode,
  { icon: typeof Train; label: string; bg: string; text: string; showLabel: boolean }
> = {
  subway: {
    icon: Train,
    label: "지하철",
    bg: "bg-blue-50",
    text: "text-[#0052A4]",
    showLabel: false, // 호선 색+번호로 충분
  },
  bus: {
    icon: Bus,
    label: "버스",
    bg: "bg-moira-transport-bus-tint",
    text: "text-moira-transport-bus",
    // 버스: 대비 미달 방지 — 아이콘+"버스" 텍스트 동반 필수
    showLabel: true,
  },
  walk: {
    icon: Footprints,
    label: "도보",
    bg: "bg-moira-transport-walk-tint",
    text: "text-moira-transport-walk",
    showLabel: false,
  },
  car: {
    icon: Car,
    label: "자동차",
    bg: "bg-moira-transport-car-tint",
    text: "text-moira-transport-car",
    showLabel: false,
  },
};

/**
 * 교통수단 아이콘+색 칩
 * - 색 단독 의존 0: lucide 아이콘 항상 동반
 * - 버스: 대비 미달 → 아이콘+"버스" 텍스트 필수
 * - subway + line: 호선 색(LINE_COLOR) + 번호 배지
 */
export function TransportBadge({ mode, line, size = "md" }: TransportBadgeProps) {
  const { icon: Icon, label, bg, text, showLabel } = MODE_STYLE[mode];
  const iconSize = ICON_SIZE[size];

  // subway + 호선 번호가 있으면 LINE_COLOR 배지 표시
  if (mode === "subway" && line) {
    const lineColor = LINE_COLOR[line] ?? "#64748B";
    return (
      <span
        className={cn(
          "inline-flex items-center rounded-full font-bold",
          PAD[size],
          TEXT_SIZE[size],
        )}
        style={{ backgroundColor: `${lineColor}18`, color: lineColor }}
        aria-label={`지하철 ${line}호선`}
      >
        <Train size={iconSize} strokeWidth={2.5} aria-hidden />
        <span
          className="flex items-center justify-center rounded-full font-extrabold text-white"
          style={{
            backgroundColor: lineColor,
            width: iconSize + 4,
            height: iconSize + 4,
            fontSize: iconSize - 2,
          }}
          aria-hidden
        >
          {line}
        </span>
      </span>
    );
  }

  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full font-bold",
        PAD[size],
        TEXT_SIZE[size],
        bg,
        text,
      )}
      aria-label={label}
    >
      <Icon size={iconSize} strokeWidth={2.5} aria-hidden />
      {/* 버스는 텍스트 동반 필수(대비 기준) */}
      {showLabel && <span>{label}</span>}
    </span>
  );
}
