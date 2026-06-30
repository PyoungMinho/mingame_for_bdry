"use client";

import { useEffect, useState, type ReactNode } from "react";
import { AlertTriangle, RotateCcw, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Member } from "@/lib/moira/mock";
import { AvatarStack } from "./MemberChip";
import { Button } from "./Button";
import { MoiraShell } from "./MoiraShell";

/** 시머 스켈레톤 프리미티브 */
export function Skeleton({ className }: { className?: string }) {
  return <span className={cn("block rounded-md moira-skeleton", className)} aria-hidden />;
}

/** 결과 카드 스켈레톤 — 계산중→결과 전환 시 레이아웃 점프 최소화 */
function SkeletonPlaceCard() {
  return (
    <div className="rounded-2xl bg-moira-surface p-4 ring-1 ring-moira-border">
      <div className="flex items-start gap-3">
        <Skeleton className="h-7 w-7 rounded-lg" />
        <div className="flex-1 space-y-2 pt-0.5">
          <Skeleton className="h-4 w-2/5" />
          <Skeleton className="h-3 w-3/5" />
        </div>
        <Skeleton className="h-6 w-6 rounded-full" />
      </div>
      <div className="mt-3.5 space-y-2.5 border-t border-moira-border pt-3.5">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="flex items-center gap-2.5">
            <Skeleton className="h-3 w-9" />
            <Skeleton className="h-2.5 flex-1 rounded-full" />
            <Skeleton className="h-3 w-6" />
          </div>
        ))}
      </div>
    </div>
  );
}

const COMPUTE_STEPS = [
  "출발지 좌표를 확인하고 있어요",
  "대중교통 이동시간을 재고 있어요",
  "후보 장소를 비교하고 있어요",
  "가장 공평한 지점을 고르고 있어요",
];

/**
 * ★ 시그니처 로딩 — 공평성 계산 중.
 * ODsay N×K 시간행렬 + 공평성 인덱스 연산을 '신뢰의 한순간'으로 연출한다.
 */
export function FairnessComputing({ members }: { members: Member[] }) {
  const [stepIdx, setStepIdx] = useState(0);
  useEffect(() => {
    const id = window.setInterval(() => {
      setStepIdx((i) => (i < COMPUTE_STEPS.length - 1 ? i + 1 : i));
    }, 650);
    return () => window.clearInterval(id);
  }, []);

  return (
    <MoiraShell step={2}>
      <section
        className="flex flex-col items-center pt-8 text-center"
        role="status"
        aria-live="polite"
      >
        {/* 멤버 레이더 */}
        <div className="relative flex h-28 w-28 items-center justify-center">
          <span className="absolute h-24 w-24 rounded-full bg-moira-brand/10" />
          <span className="absolute h-24 w-24 animate-ping rounded-full bg-moira-brand/10" />
          <span className="absolute h-16 w-16 rounded-full bg-moira-brand/15" />
          <AvatarStack members={members} size={38} />
        </div>

        <h1 className="mt-7 text-[22px] font-extrabold leading-snug tracking-[-0.02em] text-moira-ink">
          공평한 중간지점을
          <br />
          계산하고 있어요
        </h1>

        <p className="mt-3 inline-flex items-center gap-2 text-[14px] font-semibold text-moira-body">
          <span className="h-1.5 w-1.5 rounded-full bg-moira-brand moira-soft-pulse" />
          {COMPUTE_STEPS[stepIdx]}
        </p>

        {/* 인디터미닛 진행바 */}
        <div className="relative mt-6 h-1.5 w-44 overflow-hidden rounded-full bg-moira-track">
          <span className="absolute inset-y-0 left-0 block w-1/3 rounded-full bg-moira-brand moira-indeterminate" />
        </div>
      </section>

      {/* 결과 스켈레톤 미리보기 */}
      <div className="mt-9 space-y-3" aria-hidden>
        <SkeletonPlaceCard />
        <SkeletonPlaceCard />
        <SkeletonPlaceCard />
      </div>
    </MoiraShell>
  );
}

/** 빈 상태 — 점선 카드 + 아이콘 + 카피 + (선택)액션 */
export function EmptyState({
  icon: Icon,
  title,
  desc,
  action,
  className,
}: {
  icon: LucideIcon;
  title: string;
  desc: string;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center rounded-2xl border border-dashed border-moira-border bg-moira-surface/70 px-6 py-9 text-center",
        className,
      )}
    >
      <span className="flex h-12 w-12 items-center justify-center rounded-full bg-moira-brand-tint text-moira-brand">
        <Icon size={22} strokeWidth={2.25} />
      </span>
      <h3 className="mt-3.5 text-[15px] font-extrabold text-moira-ink">{title}</h3>
      <p className="mt-1 max-w-[260px] text-[13px] leading-relaxed text-moira-muted">{desc}</p>
      {action && <div className="mt-4 w-full max-w-[260px]">{action}</div>}
    </div>
  );
}

/** 에러 상태 — 본문 블록(호출부에서 MoiraShell로 감쌈) */
export function ErrorState({
  title = "중간지점을 찾지 못했어요",
  desc,
  onRetry,
  retryLabel = "다시 계산하기",
  secondaryLabel,
  onSecondary,
  className,
}: {
  title?: string;
  desc: string;
  onRetry?: () => void;
  retryLabel?: string;
  secondaryLabel?: string;
  onSecondary?: () => void;
  className?: string;
}) {
  return (
    <section className={cn("flex flex-col items-center pt-10 text-center", className)}>
      <span className="flex h-16 w-16 items-center justify-center rounded-full bg-rose-50">
        <AlertTriangle size={28} strokeWidth={2.25} className="text-moira-fair-bad" />
      </span>
      <h1 className="mt-4 text-[20px] font-extrabold tracking-[-0.02em] text-moira-ink">{title}</h1>
      <p className="mt-2 max-w-[280px] text-[14px] leading-relaxed text-moira-body">{desc}</p>
      <div className="mt-7 flex w-full max-w-[280px] flex-col gap-2">
        {onRetry && (
          <Button onClick={onRetry} leftIcon={<RotateCcw size={18} strokeWidth={2.5} />}>
            {retryLabel}
          </Button>
        )}
        {secondaryLabel && onSecondary && (
          <Button variant="ghost" onClick={onSecondary}>
            {secondaryLabel}
          </Button>
        )}
      </div>
    </section>
  );
}
