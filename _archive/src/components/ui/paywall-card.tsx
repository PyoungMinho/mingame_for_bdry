// REDLINE: 외모/체형 비교 UI 금지. 타인 점수 노출 금지.

"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

// ── Props 인터페이스 ──────────────────────────────────────────────────
export interface PaywallCardProps {
  /** Pro 구독 CTA 클릭 */
  onSubscribe: () => void;
  /** 닫기 (Ghost 버튼) */
  onDismiss?: () => void;
  /** 남은 무료 사용 횟수 (Q5-B: 3일 무료 체험) */
  freeTrialDaysLeft?: number;
  className?: string;
}

/**
 * 오름 PaywallCard 컴포넌트
 *
 * Q5 사장 확정(B): 3일 무료 체험 후 코치챗 게이트 노출
 * 카피: "3일 무료 체험 후 ₩9,900/월"
 *
 * TODO (페이지개발자 의존):
 * - 토스페이먼츠 결제 플로우 연결 (onSubscribe)
 * - RevenueCat 앱 내 구매 연결 (W18 앱 후속)
 * - 무료 체험 잔여일 카운터 백엔드 연동
 * - BottomSheet 내부 렌더 or 인라인 카드 렌더 결정
 *
 * @see design-final.md §6 Q5-B, project-direction.md Q5
 */
const PaywallCard = React.forwardRef<HTMLDivElement, PaywallCardProps>(
  ({ onSubscribe, onDismiss, freeTrialDaysLeft, className, ...props }, ref) => {
    const hasFreeTrial =
      freeTrialDaysLeft !== undefined && freeTrialDaysLeft > 0;

    return (
      <div
        ref={ref}
        className={cn(
          "flex flex-col gap-4 p-5 bg-white rounded-xl shadow-md",
          "border border-gray-100",
          className
        )}
        role="dialog"
        aria-label="Pro 구독 안내"
        {...props}
      >
        {/* 헤더 */}
        <div className="flex flex-col gap-1">
          <span className="text-[12px] font-medium text-accent-500 uppercase tracking-wider">
            오름 Pro
          </span>
          <h2 className="text-[20px] font-semibold leading-[1.4] text-primary-800">
            AI 코치와 함께 성장하세요
          </h2>
        </div>

        {/* 무료 체험 잔여일 카운터 (Q5-B) */}
        {hasFreeTrial && (
          <div className="flex items-center gap-2 px-3 py-2 bg-accent-50 rounded-lg">
            <span className="text-[13px] font-medium text-accent-700">
              무료 체험 {freeTrialDaysLeft}일 남음
            </span>
          </div>
        )}

        {/* 기능 목록 */}
        {/* TODO: 실제 Pro 기능 목록 확정 후 교체 */}
        <ul className="flex flex-col gap-2" aria-label="Pro 기능">
          {[
            "AI 코치챗 무제한",
            "30일 회고 분석",
            "페르소나 3종 전환",
          ].map((feature) => (
            <li
              key={feature}
              className="flex items-center gap-2 text-[14px] text-gray-700 leading-[1.6]"
            >
              <span className="w-1.5 h-1.5 rounded-full bg-accent-500 shrink-0" aria-hidden="true" />
              {feature}
            </li>
          ))}
        </ul>

        {/* 가격 — 핵심 카피 (Q5-B 사장 확정) */}
        <div className="flex flex-col gap-0.5">
          <span className="text-[24px] font-bold leading-[1.3] text-primary-800 tabular-nums">
            ₩9,900
            <span className="text-[15px] font-normal text-gray-500">/월</span>
          </span>
          <span className="text-[13px] text-gray-500 leading-[1.4]">
            3일 무료 체험 후 ₩9,900/월 · 언제든지 해지 가능
          </span>
        </div>

        {/* CTA 버튼 */}
        <Button
          variant="primary"
          size="lg"
          className="w-full"
          onClick={onSubscribe}
          aria-label="Pro 구독 시작 — 3일 무료 체험 후 월 9,900원"
        >
          {hasFreeTrial ? "무료로 시작하기" : "Pro 시작하기"}
        </Button>

        {/* 닫기 */}
        {onDismiss && (
          <Button
            variant="ghost"
            size="sm"
            className="w-full text-gray-400"
            onClick={onDismiss}
            aria-label="닫기"
          >
            나중에 할게요
          </Button>
        )}
      </div>
    );
  }
);

PaywallCard.displayName = "PaywallCard";

export { PaywallCard };
