"use client";

import { useRef } from "react";
import * as AspectRatio from "@radix-ui/react-aspect-ratio";
import * as Tooltip from "@radix-ui/react-tooltip";
import { MapPin } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatDepositRent } from "@/lib/utils";
import type { ScoreBreakdownItem, TrustGrade } from "@/lib/types/domain";
import { TrustScoreBadge } from "@/components/trust/TrustScoreBadge";
import { ScoreBreakdown } from "@/components/trust/ScoreBreakdown";

export interface ListingCardProps {
  id: string;
  title: string;
  address: string;
  deposit: number;
  monthlyRent: number;
  trustScore: number;
  trustGrade: TrustGrade;
  naturalLabel: string;
  thumbnailUrl?: string | null;
  scoreBreakdown: ScoreBreakdownItem[];
  status?: "verified" | "pending" | "processing";
  /** 카드 클릭 → 상세 진입 (페이지팀이 라우터 주입) */
  onNavigate?: (id: string) => void;
  className?: string;
}

// reported는 이 컴포넌트가 렌더되지 않아야 함 (검색 리스트 제외 — §5.1)

export function ListingCard({
  id,
  title,
  address,
  deposit,
  monthlyRent,
  trustScore,
  trustGrade,
  naturalLabel,
  thumbnailUrl,
  scoreBreakdown,
  status = "verified",
  onNavigate,
  className,
}: ListingCardProps) {
  const cardRef = useRef<HTMLDivElement>(null);
  const isUnverified = trustGrade === "unverified";

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      onNavigate?.(id);
    }
  }

  const hasPending = scoreBreakdown.some((i) => i.earned === null || i.status === "pending");

  return (
    <Tooltip.Provider delayDuration={300}>
      <article
        ref={cardRef}
        role="article"
        tabIndex={0}
        onClick={() => onNavigate?.(id)}
        onKeyDown={handleKeyDown}
        aria-label={`${title}, ${address}, ${formatDepositRent(deposit, monthlyRent)}, 신뢰 등급 ${trustGrade}`}
        className={cn(
          "relative bg-white rounded-lg shadow-card-trust border border-realestate-neutral-200",
          "focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-realestate-brand-primary",
          "cursor-pointer select-none",
          // Unverified: 상단 border-top 4px 앰버 스트립
          isUnverified && "border-t-4 border-t-realestate-amber-warn-border",
          className
        )}
      >
        {/* 썸네일 16:9 */}
        <AspectRatio.Root ratio={16 / 9} className="rounded-t-lg overflow-hidden">
          {thumbnailUrl ? (
            <img
              src={thumbnailUrl}
              alt={`${title} 매물 사진`}
              className="w-full h-full object-cover"
              loading="lazy"
            />
          ) : (
            <div className="w-full h-full bg-realestate-neutral-100 flex items-center justify-center">
              <span className="text-trust-desc text-realestate-neutral-500">사진 없음</span>
            </div>
          )}
        </AspectRatio.Root>

        <div className="p-card-pad flex flex-col gap-card-gap">
          {/* 신뢰 배지 — 가격보다 시각 우선 (§1.2 원칙1, §3.2) */}
          <TrustScoreBadge
            grade={trustGrade}
            score={trustScore}
            naturalLabel={naturalLabel}
            showScore
            variant="compact"
          />

          {/* 가격 */}
          <p className="text-price font-serif text-realestate-neutral-900 tabular-nums">
            {formatDepositRent(deposit, monthlyRent)}
          </p>

          {/* 주소 */}
          <div className="flex items-center gap-1 text-trust-desc text-realestate-neutral-500">
            <MapPin size={12} strokeWidth={1.5} aria-hidden="true" />
            <span className="truncate">{address}</span>
          </div>

          {/* 미니 스코어 분해 + pending 경고 툴팁 */}
          <Tooltip.Root>
            <Tooltip.Trigger asChild>
              <div className="cursor-default" aria-label="항목별 신뢰 점수 미리보기">
                <ScoreBreakdown items={scoreBreakdown} variant="mini" grade={trustGrade} />
                {hasPending && (
                  <p className="text-trust-desc text-realestate-neutral-500 mt-1">
                    * 외부 확인 중 항목 있어 점수 변동 가능
                  </p>
                )}
              </div>
            </Tooltip.Trigger>
            <Tooltip.Content
              side="bottom"
              sideOffset={4}
              className="z-50 max-w-[220px] rounded-md bg-realestate-neutral-900 px-2.5 py-1.5 text-trust-desc text-white shadow-md"
            >
              {hasPending
                ? "검증 대기 중인 항목이 있어요. 완료 시 점수가 달라질 수 있어요."
                : "항목별 신뢰 점수입니다."}
              <Tooltip.Arrow className="fill-realestate-neutral-900" />
            </Tooltip.Content>
          </Tooltip.Root>

          {/* processing 상태 배너 */}
          {status === "processing" && (
            <div
              className="text-trust-desc text-realestate-state-processing bg-realestate-state-processing-bg rounded-sm px-2 py-1"
              aria-live="polite"
            >
              사진 분석 중…
            </div>
          )}
        </div>
      </article>
    </Tooltip.Provider>
  );
}
