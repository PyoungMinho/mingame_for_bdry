"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Crosshair, Link2, Check, Search, Plus, UserPlus } from "lucide-react";
import { MoiraShell } from "@/components/moira/MoiraShell";
import { Button } from "@/components/moira/Button";
import { MemberChip } from "@/components/moira/MemberChip";
import { StickyBottomBar } from "@/components/moira/StickyBottomBar";
import { EmptyState } from "@/components/moira/States";
import { cn } from "@/lib/utils";
import { MEMBERS, type Member } from "@/lib/moira/mock";
import { ORIGIN_PRESETS, resolveOriginId } from "@/lib/moira/scenario";

export default function MoiraCreatePage() {
  const router = useRouter();
  const [origin, setOrigin] = useState("강남역");
  const [copied, setCopied] = useState(false);
  const [members, setMembers] = useState<Member[]>(MEMBERS);

  // 호스트 칩 출발지는 위 입력값과 동기화(프리셋 선택 반영)
  const displayMembers = members.map((m) => (m.status === "host" ? { ...m, origin } : m));
  const friends = members.filter((m) => m.status !== "host");
  const friendsDone = friends.filter((m) => m.status === "done").length;
  const ready = members.filter((m) => m.status !== "waiting").length;
  const canStart = ready >= 2;

  const removeMember = (id: string) => setMembers((prev) => prev.filter((m) => m.id !== id));

  const onShare = async () => {
    try {
      await navigator.clipboard?.writeText("https://moira.app/j/8Kd2xq");
    } catch {
      /* 데모: 클립보드 미지원 무시 */
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const shareButton = (
    <Button variant="kakao" size="md" onClick={onShare} leftIcon={<Plus size={18} strokeWidth={2.5} />}>
      카톡으로 링크 보내기
    </Button>
  );

  return (
    <MoiraShell
      step={1}
      bottomBar={
        <StickyBottomBar hint={canStart ? `${ready}명의 출발지가 모였어요` : "친구 2명 이상의 주소가 모이면 시작해요"}>
          <Button
            disabled={!canStart}
            onClick={() =>
              router.push(`/moira/result?from=${resolveOriginId(origin)}&addr=${encodeURIComponent(origin)}`)
            }
          >
            중간지점 찾기
          </Button>
        </StickyBottomBar>
      }
    >
      {/* 히어로 카피 */}
      <header className="pb-1">
        <h1 className="text-[26px] font-extrabold leading-[1.25] tracking-[-0.02em] text-moira-ink">
          모두에게 공평한
          <br />
          중간 지점을 찾아요
        </h1>
        <p className="mt-2 text-[15px] leading-relaxed text-moira-body">
          출발지만 모으면 가장 공평한 약속 장소를 추천하고,
          <br />
          카톡으로 <span className="font-bold text-moira-brand">1초 무가입 투표</span>까지.
        </p>
      </header>

      {/* 내 출발지 */}
      <section className="mt-5">
        <h2 className="mb-2 text-[13px] font-bold text-moira-muted">내 출발지</h2>
        <div className="flex gap-2">
          <div className="flex flex-1 items-center gap-2 rounded-xl bg-moira-surface px-3.5 ring-1 ring-moira-border focus-within:ring-2 focus-within:ring-moira-brand">
            <Search size={18} className="shrink-0 text-moira-muted" />
            <input
              value={origin}
              onChange={(e) => setOrigin(e.target.value)}
              placeholder="동·역 이름으로 검색"
              className="h-12 w-full bg-transparent text-[15px] font-medium text-moira-ink outline-none placeholder:text-moira-muted"
              aria-label="내 출발지"
            />
          </div>
          <button
            type="button"
            onClick={() => setOrigin("강남역")}
            className="flex h-12 w-12 shrink-0 cursor-pointer items-center justify-center rounded-xl bg-moira-brand-tint text-moira-brand transition-colors hover:bg-indigo-100"
            aria-label="현재 위치로 설정"
          >
            <Crosshair size={20} strokeWidth={2.5} />
          </button>
        </div>

        {/* 빠른 선택 프리셋 — 데모: 이 역들은 실제로 추천이 다시 계산됨 */}
        <div className="mt-2.5 flex flex-wrap gap-1.5">
          {ORIGIN_PRESETS.map((p) => {
            const active = resolveOriginId(origin) === p.id;
            return (
              <button
                key={p.id}
                type="button"
                onClick={() => setOrigin(p.label)}
                aria-pressed={active}
                className={cn(
                  "cursor-pointer rounded-full px-3 py-1.5 text-[13px] font-semibold ring-1 transition-colors",
                  active
                    ? "bg-moira-brand text-white ring-moira-brand"
                    : "bg-moira-surface text-moira-body ring-moira-border hover:bg-moira-brand-tint",
                )}
              >
                {p.label}
              </button>
            );
          })}
        </div>
      </section>

      {/* 친구 주소 요청 */}
      <section className="mt-6">
        <div className="mb-2 flex items-center justify-between">
          <h2 className="text-[13px] font-bold text-moira-muted">함께 갈 친구 {friends.length}명</h2>
          {friends.length > 0 && (
            <span className="text-[12px] font-semibold text-emerald-600">{friendsDone}명 입력완료</span>
          )}
        </div>

        <ul className="space-y-2">
          {displayMembers.map((m) => (
            <MemberChip key={m.id} member={m} onRemove={() => removeMember(m.id)} />
          ))}
        </ul>

        {friends.length === 0 ? (
          <div className="mt-3">
            <EmptyState
              icon={UserPlus}
              title="아직 초대한 친구가 없어요"
              desc="링크를 보내면 친구는 가입 없이 출발지만 입력하면 끝나요."
              action={shareButton}
            />
          </div>
        ) : (
          <div className="mt-3 rounded-2xl border border-dashed border-moira-border bg-moira-surface/60 p-4">
            <p className="flex items-center gap-1.5 text-[14px] font-bold text-moira-ink">
              <Link2 size={16} className="text-moira-brand" />
              친구에게 주소 요청 링크 보내기
            </p>
            <p className="mt-1 text-[13px] leading-relaxed text-moira-muted">
              링크를 받은 친구는 <b className="font-bold text-moira-body">가입 없이</b> 출발지만 입력하면 끝.
            </p>
            <div className="mt-3 flex gap-2">{shareButton}</div>
          </div>
        )}

        {copied && (
          <p className="mt-2 inline-flex items-center gap-1 text-[12px] font-bold text-emerald-600">
            <Check size={13} strokeWidth={3} />
            초대 링크가 복사됐어요
          </p>
        )}
      </section>
    </MoiraShell>
  );
}
