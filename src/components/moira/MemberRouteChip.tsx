"use client";

import { cn } from "@/lib/utils";
import { Avatar } from "./MemberChip";
import { TransportBadge } from "./TransportBadge";

type TransportMode = "subway" | "bus" | "walk" | "car";

export interface MemberRouteChipProps {
  memberId: string;
  name: string;
  avatar: string;   // hex 색
  minutes: number;
  mode: TransportMode;
  active: boolean;
  onToggle: (id: string) => void;
}

/**
 * 멤버 탭바 칩 — 경로 강조 토글.
 * - min-h-[44px]: 터치타겟 기준 준수.
 * - active: ring + 강조 배경.
 * - TransportBadge sm 포함(교통수단 아이콘 항상 노출).
 */
export function MemberRouteChip({
  memberId,
  name,
  avatar,
  minutes,
  mode,
  active,
  onToggle,
}: MemberRouteChipProps) {
  return (
    <button
      type="button"
      onClick={() => onToggle(memberId)}
      aria-pressed={active}
      aria-label={`${name} 경로 ${active ? "강조 해제" : "강조"} — ${minutes}분`}
      className={cn(
        // 터치타겟 ≥44px 확보
        "inline-flex min-h-[44px] items-center gap-2 rounded-xl px-3 py-2",
        "cursor-pointer select-none transition-all duration-150",
        "shrink-0", // 수평 스크롤 탭바 내 줄바꿈 방지
        active
          ? "bg-moira-brand-tint ring-2 ring-moira-brand/40 shadow-sm"
          : "bg-moira-surface ring-1 ring-moira-border hover:bg-slate-50",
      )}
    >
      {/* 아바타 */}
      <Avatar name={name} color={avatar} size={28} />

      {/* 이름 + 시간 */}
      <div className="flex flex-col items-start leading-tight">
        <span
          className={cn(
            "text-[13px] font-bold",
            active ? "text-moira-brand" : "text-moira-ink",
          )}
        >
          {name}
        </span>
        <span className="text-[11px] font-semibold tabular-nums text-moira-muted">
          {minutes}분
        </span>
      </div>

      {/* 교통수단 배지 sm */}
      <TransportBadge mode={mode} size="sm" />
    </button>
  );
}
