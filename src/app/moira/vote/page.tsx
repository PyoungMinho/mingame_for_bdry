"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Lock, Sparkles } from "lucide-react";
import { MoiraShell } from "@/components/moira/MoiraShell";
import { Button } from "@/components/moira/Button";
import { VoteOption } from "@/components/moira/VoteOption";
import { StickyBottomBar } from "@/components/moira/StickyBottomBar";
import { AvatarStack } from "@/components/moira/MemberChip";
import { MEMBERS, PLACES, RECOMMENDED_STATION } from "@/lib/moira/mock";
import { gapOf } from "@/lib/moira/fairness";

export default function MoiraVotePage() {
  const router = useRouter();
  const [myVote, setMyVote] = useState<string | null>(null);

  // 표 변동에도 카드가 튀지 않도록 초기 순서 고정(초기 득표 desc, 격차 asc)
  const ordered = useMemo(
    () => [...PLACES].sort((a, b) => b.votes - a.votes || gapOf(a.times) - gapOf(b.times)),
    [],
  );

  const baseVoted = PLACES.reduce((s, p) => s + p.votes, 0); // 3
  const votedCount = baseVoted + (myVote ? 1 : 0);
  const total = MEMBERS.length; // 4

  const votesFor = (id: string) => {
    const base = PLACES.find((p) => p.id === id)?.votes ?? 0;
    return base + (myVote === id ? 1 : 0);
  };
  const leadingId = ordered
    .map((p) => ({ id: p.id, v: votesFor(p.id) }))
    .sort((a, b) => b.v - a.v)[0]?.id;

  return (
    <MoiraShell
      variant="webview"
      bottomBar={
        <StickyBottomBar hint="주최자 민호님이 확정하면 약속이 잡혀요">
          <Button onClick={() => router.push("/moira/confirm")}>결과 확정하고 약속 잡기</Button>
        </StickyBottomBar>
      }
    >
      {/* 타이틀 */}
      <header className="pb-1">
        <p className="inline-flex items-center gap-1 text-[12px] font-bold text-moira-brand">
          <Lock size={12} strokeWidth={2.5} />
          가입·로그인 없이 바로 투표
        </p>
        <h1 className="mt-1.5 text-[24px] font-extrabold tracking-[-0.02em] text-moira-ink">
          어디서 만날까요?
        </h1>
        <p className="mt-1 text-[14px] font-medium text-moira-body">
          {RECOMMENDED_STATION.name} 근처 · {total}명 약속
        </p>
      </header>

      {/* 집계 상태 */}
      <div className="mt-3 flex items-center justify-between rounded-xl bg-moira-surface px-4 py-3 ring-1 ring-moira-border">
        <div className="flex items-center gap-2.5">
          <AvatarStack members={MEMBERS} size={28} />
          <span className="text-[13px] font-bold text-moira-body">
            {total}명 중 <span className="text-moira-brand">{votedCount}명</span> 투표
          </span>
        </div>
        <span className="flex items-center gap-1 text-[12px] font-bold text-emerald-600">
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
          </span>
          실시간 집계
        </span>
      </div>

      {/* 투표 완료 배너 */}
      {myVote && (
        <div className="mt-3 flex items-center gap-2 rounded-xl bg-moira-brand-tint px-4 py-3">
          <Sparkles size={18} className="text-moira-brand" />
          <p className="text-[14px] font-bold text-moira-brand">투표 완료! 결과를 실시간으로 모으는 중이에요</p>
        </div>
      )}

      {/* 투표 옵션 — 득표율 분모는 '던져진 표 수'(votedCount)라 막대 합이 100%가 된다.
          상단 참여율(total=4명 중 N명)과는 의미가 다르다. */}
      <div className="mt-4 space-y-3">
        {ordered.map((place) => (
          <VoteOption
            key={place.id}
            place={place}
            votes={votesFor(place.id)}
            total={votedCount}
            voted={myVote === place.id}
            leading={leadingId === place.id}
            onVote={() => setMyVote(place.id)}
          />
        ))}
      </div>

      <p className="mt-4 flex items-center justify-center gap-1 text-center text-[12px] text-moira-muted">
        <Check size={13} strokeWidth={3} className="text-emerald-500" />한 번 더 누르면 언제든 바꿀 수 있어요
      </p>
    </MoiraShell>
  );
}
