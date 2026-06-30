"use client";

import { Camera, ScanSearch, Users, BadgeCheck, TrendingDown, type LucideProps } from "lucide-react";
import { type ForwardRefExoticComponent, type RefAttributes } from "react";
import { cn } from "@/lib/utils";
import type { ScoreBreakdownItem, ScoreItemKey, TrustGrade } from "@/lib/types/domain";
import { SCORE_ITEM_LABELS } from "@/lib/types/domain";

export interface ScoreBreakdownProps {
  items: ScoreBreakdownItem[];
  variant?: "mini" | "detail";
  /**
   * 검증완료 막대 채움 색을 총점 등급에 맞춤 (디자인 §4.3 / ui-spec §2-3).
   * Gold=#B8860B / Silver=#5B6F7A / unverified(일반)=#2563EB.
   * 미지정 시 일반(#2563EB)으로 폴백.
   */
  grade?: TrustGrade;
  className?: string;
}

// 검증완료 막대 등급 컬러 (ui-spec §2-3 "일반=#2563EB")
const VERIFIED_FILL: Record<TrustGrade, string> = {
  gold: "#B8860B",
  silver: "#5B6F7A",
  unverified: "#2563EB",
};

type LucideIcon = ForwardRefExoticComponent<Omit<LucideProps, "ref"> & RefAttributes<SVGSVGElement>>;

// §6.4 아이콘 매핑
const ITEM_ICONS: Record<ScoreItemKey, LucideIcon> = {
  photo: Camera,
  exif: ScanSearch,
  community: Users,
  owner: BadgeCheck,
  transaction: TrendingDown,
};

function BarFill({
  earned,
  max,
  status,
  variant,
  grade = "unverified",
}: Pick<ScoreBreakdownItem, "earned" | "max" | "status"> & {
  variant: "mini" | "detail";
  grade?: TrustGrade;
}) {
  const barH = variant === "mini" ? "h-2" : "h-2.5";

  // processing 우선 판정: processing 항목은 earned===null 이어도 '분석 중' 막대로 표시.
  // (pending 과 구분 — 둘 다 earned=null 이라 순서가 중요)
  if (status === "processing") {
    return (
      <div
        className={cn("w-full rounded-full overflow-hidden", barH)}
        style={{ backgroundColor: "#E7E5E4" }}
        role="progressbar"
        aria-valuenow={0}
        aria-valuemax={max}
        aria-label="분석 중"
      >
        <div
          className="h-full rounded-full animate-pulse motion-reduce:animate-none"
          style={{ width: "60%", backgroundColor: "#2563EB" }}
        />
      </div>
    );
  }

  // pending: earned===null → 회색 점선 표시 (0점 표기 절대 금지)
  if (earned === null || status === "pending") {
    return (
      <div
        className={cn("relative w-full rounded-full overflow-hidden", barH)}
        style={{ backgroundColor: "#E7E5E4" }}
      >
        {/* 점선 오버레이 */}
        <div
          className="absolute inset-0 rounded-full"
          style={{
            backgroundImage:
              "repeating-linear-gradient(90deg, #A8A29E 0px, #A8A29E 4px, transparent 4px, transparent 8px)",
          }}
          aria-hidden="true"
        />
      </div>
    );
  }

  if (status === "reported") {
    const pct = Math.max(0, Math.min(100, (earned / max) * 100));
    return (
      <div
        className={cn("w-full rounded-full overflow-hidden", barH)}
        style={{ backgroundColor: "#E7E5E4" }}
        role="progressbar"
        aria-valuenow={earned}
        aria-valuemax={max}
      >
        <div
          className={cn("h-full rounded-full motion-reduce:transition-none")}
          style={{
            width: `${pct}%`,
            backgroundColor: "#DC2626",
            transition: "width 600ms ease-out",
          }}
        />
      </div>
    );
  }

  // verified: 100% 획득=등급 컬러, 부분=등급 컬러 70% 투명 (ui-spec §2-3 / 디자인 §4.3)
  const pct = Math.max(0, Math.min(100, (earned / max) * 100));
  const base = VERIFIED_FILL[grade];
  // 0점=트랙 동색(빈 상태), 부분=70% 투명(B3 ≈ 0.70 알파), 100%=등급 컬러
  const fillColor = pct <= 0 ? "#E7E5E4" : pct >= 99 ? base : `${base}B3`;
  return (
    <div
      className={cn("w-full rounded-full overflow-hidden", barH)}
      style={{ backgroundColor: "#E7E5E4" }}
      role="progressbar"
      aria-valuenow={earned}
      aria-valuemax={max}
    >
      <div
        className="h-full rounded-full motion-reduce:transition-none"
        style={{
          width: `${pct}%`,
          backgroundColor: fillColor,
          transition: "width 600ms ease-out",
        }}
      />
    </div>
  );
}

function RightText({ item }: { item: ScoreBreakdownItem }) {
  const { earned, max, status, deltaIfReported } = item;

  // processing 우선: processing 항목은 earned===null 이어도 '분석 중'. (pending 보다 먼저 판정)
  if (status === "processing") {
    return (
      <span className="text-trust-desc text-realestate-state-processing whitespace-nowrap shrink-0">
        분석 중
      </span>
    );
  }
  if (status === "pending" || earned === null) {
    return (
      <span className="text-trust-desc text-realestate-state-pending whitespace-nowrap shrink-0">
        검증 대기 중
      </span>
    );
  }
  if (status === "reported") {
    return (
      <span className="text-trust-desc text-realestate-state-reported whitespace-nowrap shrink-0">
        신고 접수됨{deltaIfReported ? ` ${deltaIfReported}점` : ""}
      </span>
    );
  }
  return (
    <span className="text-trust-desc text-realestate-neutral-500 whitespace-nowrap shrink-0 tabular-nums">
      {earned}/{max}
    </span>
  );
}

export function ScoreBreakdown({ items, variant = "detail", grade, className }: ScoreBreakdownProps) {
  const isDetail = variant === "detail";

  return (
    <ul
      className={cn("flex flex-col", isDetail ? "gap-3" : "gap-2", className)}
      aria-label="항목별 신뢰 점수"
    >
      {items.map((item) => {
        const Icon = ITEM_ICONS[item.key];
        const label = SCORE_ITEM_LABELS[item.key];
        // pending 전용 보조 카피 게이트 — processing 은 제외(processing 은 earned=null 이지만 '분석 중'으로 별도 처리)
        const isPending =
          item.status !== "processing" && (item.earned === null || item.status === "pending");

        return (
          <li key={item.key} className="flex flex-col gap-1">
            {/* 상단: 아이콘 + 라벨 + 우측 텍스트 */}
            <div className="flex items-center gap-1.5">
              <Icon
                size={16}
                className="text-realestate-neutral-500 shrink-0"
                strokeWidth={1.5}
                aria-hidden="true"
              />
              <span className="text-trust-desc text-realestate-neutral-700 flex-1 min-w-0 truncate">
                {label}
              </span>
              <RightText item={item} />
            </div>

            {/* 막대 */}
            <BarFill
              earned={item.earned}
              max={item.max}
              status={item.status}
              variant={variant}
              grade={grade}
            />

            {/* pending 보조 카피 (detail 모드만, §4.3) */}
            {isPending && isDetail && (
              <p className="text-trust-desc text-realestate-neutral-500 mt-0.5">
                이 항목의 미검증은 허위매물 신호가 아니에요 — 검증 완료 시 점수에 반영돼요.
              </p>
            )}
          </li>
        );
      })}
    </ul>
  );
}
