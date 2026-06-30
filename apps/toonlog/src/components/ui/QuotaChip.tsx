"use client";

/**
 * QuotaChip — 잔여 한도 표시
 * 0일 때 error색 + 경고 아이콘 + 텍스트 3중 (design-final §9.3 색 외 정보 3중)
 * design-final §5.2 누락 보강 P0
 *
 * 사용 예시:
 *   <QuotaChip remaining={3} limit={30} />   // "3컷 남음"
 *   <QuotaChip remaining={0} limit={30} />   // 에러 색 + 아이콘 + "한도 소진"
 */

import * as React from "react";
import { cn } from "@/lib/utils";
import type { QuotaInfo } from "@/lib/contract";

/* ─── Props ─── */

export interface QuotaChipProps {
  /** 잔여 한도 (quota prop 미전달 시 사용) */
  remaining?: number;
  /** 주기 한도 (quota prop 미전달 시 사용) */
  limit?: number;
  /** QuotaInfo 객체 직접 전달 (페이지 편의 — remaining/limit보다 우선). undefined면 로딩 표시 */
  quota?: QuotaInfo | null;
  /** 한도 소진 시 클릭 → 업그레이드로 유도 */
  onUpgradeClick?: () => void;
  className?: string;
}

/* ─── 컴포넌트 ─── */

export function QuotaChip({
  remaining: remainingProp,
  limit: limitProp,
  quota,
  onUpgradeClick,
  className,
}: QuotaChipProps) {
  // quota 객체 우선, 없으면 remaining/limit prop, 둘 다 없으면 0/1 (로딩 안전값)
  const remaining = quota?.remaining ?? remainingProp ?? 0;
  const limit = quota?.limit ?? limitProp ?? 1;
  const isEmpty = remaining <= 0;
  const isLow = !isEmpty && remaining <= Math.ceil(limit * 0.1); // 10% 이하 경고

  // 색 + 아이콘 + 텍스트 3중 — 접근성 의무 (design-final §9.3)
  const statusConfig = isEmpty
    ? {
        label: "한도 소진",
        ariaLabel: `잔여 생성 한도 소진. 업그레이드 필요`,
        bgClass: "bg-[var(--color-error-subtle)]",
        textClass: "text-[var(--color-error)]",
        borderClass: "border-[var(--color-border-error)]",
        shadowClass: "shadow-[var(--shadow-pop-xs)]",
        icon: (
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
        ),
      }
    : isLow
    ? {
        label: `${remaining}컷 남음`,
        ariaLabel: `잔여 생성 한도 ${remaining}컷, 소진 임박`,
        bgClass: "bg-[var(--color-warning-subtle)]",
        textClass: "text-[var(--color-warning)]",
        borderClass: "border-[var(--color-line)]",
        shadowClass: "shadow-[var(--shadow-pop-xs)]",
        icon: (
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
            <line x1="12" y1="9" x2="12" y2="13" />
            <line x1="12" y1="17" x2="12.01" y2="17" />
          </svg>
        ),
      }
    : {
        label: `${remaining}컷 남음`,
        ariaLabel: `잔여 생성 한도 ${remaining}컷`,
        bgClass: "bg-[var(--color-surface-raised)]",
        textClass: "text-[var(--color-text-secondary)]",
        borderClass: "border-[var(--color-line)]",
        shadowClass: "shadow-[var(--shadow-pop-xs)]",
        icon: (
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <circle cx="12" cy="12" r="10" />
            <polyline points="12 6 12 12 16 14" />
          </svg>
        ),
      };

  const Wrapper = isEmpty && onUpgradeClick ? "button" : "span";
  const wrapperProps =
    isEmpty && onUpgradeClick
      ? {
          type: "button" as const,
          onClick: onUpgradeClick,
          "aria-label": `${statusConfig.ariaLabel}. 업그레이드 하기`,
        }
      : {};

  return (
    <Wrapper
      aria-label={statusConfig.ariaLabel}
      aria-live={isEmpty ? "polite" : undefined}
      className={cn(
        "inline-flex items-center gap-1",
        "h-8 px-3 rounded-full",
        "border-2",
        "font-heading text-xs",
        "transition-[transform,box-shadow] duration-150 ease-out",
        statusConfig.bgClass,
        statusConfig.textClass,
        statusConfig.borderClass,
        statusConfig.shadowClass,
        isEmpty && onUpgradeClick && [
          "cursor-pointer",
          "hover:-translate-x-px hover:-translate-y-px hover:shadow-[var(--shadow-pop-sm)]",
          "active:translate-x-[2px] active:translate-y-[2px] active:shadow-[var(--shadow-pop-xs)]",
          "focus-visible:outline-none focus-visible:shadow-[var(--shadow-focus)]",
        ],
        className
      )}
      {...wrapperProps}
    >
      {statusConfig.icon}
      <span className="font-english">{statusConfig.label}</span>
      {isEmpty && (
        <span className="sr-only">색상으로 표시된 위험 상태: 한도 소진</span>
      )}
      {isLow && (
        <span className="sr-only">색상으로 표시된 경고 상태: 한도 임박</span>
      )}
    </Wrapper>
  );
}

/** QuotaInfo 타입에서 바로 렌더하는 편의 컴포넌트 */
export function QuotaChipFromInfo({
  quotaInfo,
  onUpgradeClick,
  className,
}: {
  quotaInfo: QuotaInfo;
  onUpgradeClick?: () => void;
  className?: string;
}) {
  return (
    <QuotaChip
      remaining={quotaInfo.remaining}
      limit={quotaInfo.limit}
      onUpgradeClick={onUpgradeClick}
      className={className}
    />
  );
}
