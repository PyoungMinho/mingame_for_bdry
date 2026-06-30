"use client";

import { cn } from "@/lib/utils";
import type { Member } from "@/lib/moira/mock";
import { Check, Clock, X } from "lucide-react";

export function Avatar({
  name,
  color,
  size = 36,
  ring,
}: {
  name: string;
  color: string;
  size?: number;
  ring?: boolean;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center justify-center rounded-full font-bold text-white",
        ring && "ring-2 ring-white",
      )}
      style={{
        width: size,
        height: size,
        backgroundColor: color,
        fontSize: size * 0.42,
      }}
      aria-hidden
    >
      {name.slice(0, 1)}
    </span>
  );
}

/** 멤버 리스트 한 줄 — 출발지 + 상태. onRemove 주어지면 호스트 제외하고 빼기 버튼 노출 */
export function MemberChip({ member, onRemove }: { member: Member; onRemove?: () => void }) {
  const isHost = member.status === "host";
  const isDone = member.status === "done";
  return (
    <li className="flex items-center gap-3 rounded-xl bg-moira-surface px-3.5 py-3 ring-1 ring-moira-border">
      <Avatar name={member.name} color={member.avatar} />
      <div className="min-w-0 flex-1">
        <p className="flex items-center gap-1.5 text-[15px] font-bold text-moira-ink">
          {member.name}
          {isHost && (
            <span className="rounded bg-moira-brand-tint px-1.5 py-0.5 text-[11px] font-bold text-moira-brand">
              나
            </span>
          )}
        </p>
        <p className="truncate text-[13px] text-moira-muted">{member.origin || "주소 입력 대기 중"}</p>
      </div>
      <div className="flex shrink-0 items-center gap-1.5">
        {isHost || isDone ? (
          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-[12px] font-bold text-emerald-700">
            <Check size={13} strokeWidth={3} />
            입력완료
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-1 text-[12px] font-bold text-amber-600">
            <Clock size={13} strokeWidth={2.5} />
            대기중
          </span>
        )}
        {onRemove && !isHost && (
          <button
            type="button"
            onClick={onRemove}
            aria-label={`${member.name} 빼기`}
            className="-mr-1 flex h-7 w-7 cursor-pointer items-center justify-center rounded-full text-moira-muted transition-colors hover:bg-slate-100 hover:text-moira-body"
          >
            <X size={16} strokeWidth={2.5} />
          </button>
        )}
      </div>
    </li>
  );
}

/** 작은 아바타 스택 (겹친 원) */
export function AvatarStack({
  members,
  size = 28,
  max = 5,
}: {
  members: Member[];
  size?: number;
  max?: number;
}) {
  const shown = members.slice(0, max);
  return (
    <div className="flex items-center">
      {shown.map((m, i) => (
        <span key={m.id} style={{ marginLeft: i === 0 ? 0 : -size * 0.32 }}>
          <Avatar name={m.name} color={m.avatar} size={size} ring />
        </span>
      ))}
    </div>
  );
}
