// REDLINE: 타인 비교/외모 점수 UI 금지
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

// ---------------------------------------------------------------------------
// Pro Paywall 페이지 (바텀시트 모달 or 풀스크린)
// ux-spec.md 화면 6 + design-final.md U2 (Q5=B 반영)
// ---------------------------------------------------------------------------

interface PlanFeature {
  label: string;
  free: string | boolean;
  pro: string | boolean;
}

const PLAN_FEATURES: PlanFeature[] = [
  { label: "기본 점수 확인", free: true, pro: true },
  { label: "일일 미션", free: true, pro: true },
  { label: "7일 그래프", free: true, pro: false },
  { label: "90일 전체 그래프", free: false, pro: true },
  { label: "AI 코치챗", free: "3일 무료", pro: "무제한" },
  { label: "90일 목표 관리", free: false, pro: true },
  { label: "30일 회고", free: false, pro: true },
];

const USER_REVIEWS = [
  {
    id: "1",
    text: "3주 만에 독서 습관이 생겼어요",
    author: "김**님",
  },
  {
    id: "2",
    text: "코치가 매일 격려해줘서 포기하지 않을 수 있었어요",
    author: "이**님",
  },
];

// ---------------------------------------------------------------------------
// 기능 비교 테이블
// ---------------------------------------------------------------------------

function FeatureTable() {
  return (
    <div className="rounded-xl overflow-hidden border border-gray-200">
      <div className="grid grid-cols-3 bg-primary-800 text-white text-caption font-semibold">
        <div className="px-3 py-2.5">기능</div>
        <div className="px-3 py-2.5 text-center">Free</div>
        <div className="px-3 py-2.5 text-center text-accent-400">Pro</div>
      </div>
      {PLAN_FEATURES.map((feature, idx) => (
        <div
          key={feature.label}
          className={[
            "grid grid-cols-3 text-body-s",
            idx % 2 === 0 ? "bg-white" : "bg-gray-50",
          ].join(" ")}
        >
          <div className="px-3 py-2.5 text-primary-800">{feature.label}</div>
          <div className="px-3 py-2.5 text-center">
            {typeof feature.free === "boolean" ? (
              feature.free ? (
                <span className="text-health-500 font-bold" aria-label="포함">✓</span>
              ) : (
                <span className="text-gray-300 font-bold" aria-label="미포함">✕</span>
              )
            ) : (
              <span className="text-gray-500">{feature.free}</span>
            )}
          </div>
          <div className="px-3 py-2.5 text-center">
            {typeof feature.pro === "boolean" ? (
              feature.pro ? (
                <span className="text-accent-500 font-bold" aria-label="포함">✓</span>
              ) : (
                <span className="text-gray-300 font-bold" aria-label="미포함">✕</span>
              )
            ) : (
              <span className="text-accent-600 font-medium">{feature.pro}</span>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// 사용자 리뷰 (사회적 증거)
// ---------------------------------------------------------------------------

function UserReviews() {
  return (
    <div className="flex flex-col gap-3">
      {USER_REVIEWS.map((review) => (
        <figure key={review.id} className="rounded-xl bg-primary-50 border border-primary-100 p-4">
          <blockquote className="text-body-m text-primary-800 font-medium">
            &ldquo;{review.text}&rdquo;
          </blockquote>
          <figcaption className="text-caption text-gray-400 mt-1.5">— {review.author}</figcaption>
        </figure>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// 메인 컴포넌트
// ---------------------------------------------------------------------------

export default function PaywallPage() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);

  async function handleStartTrial() {
    setIsLoading(true);
    try {
      // TODO: 토스페이먼츠 결제 시트 연동 (백엔드팀 paywall API 완성 후)
      await new Promise((r) => setTimeout(r, 800));
      router.replace("/home");
    } catch {
      alert("결제에 실패했습니다. 카드 정보를 확인해주세요.");
    } finally {
      setIsLoading(false);
    }
  }

  function handleDismiss() {
    router.back();
  }

  return (
    <div className="min-h-dvh flex flex-col bg-surface-bg">
      {/* 헤더 */}
      <header className="sticky top-0 z-30 bg-white border-b border-gray-100">
        <div className="h-14 flex items-center justify-between px-5 pt-safe">
          <button
            onClick={handleDismiss}
            aria-label="닫기"
            className="w-9 h-9 flex items-center justify-center rounded-lg hover:bg-gray-100 touch-target"
          >
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              aria-hidden="true"
            >
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
          <span className="text-h4 font-bold text-primary-800">오름 Pro</span>
          <div className="w-9" aria-hidden="true" />
        </div>
      </header>

      {/* 콘텐츠 */}
      <div className="flex-1 px-5 py-6 flex flex-col gap-6 overflow-y-auto pb-32">
        {/* 헤드라인 */}
        <div className="text-center flex flex-col gap-2">
          <h1 className="text-h2 font-bold text-primary-800">
            지금보다 더 빠르게
            <br />
            성장하는 방법
          </h1>
          <p className="text-body-m text-gray-500">
            AI 코치와 함께라면 혼자보다 3배 빠릅니다
          </p>
        </div>

        {/* 기능 비교 */}
        <FeatureTable />

        {/* 사용자 리뷰 */}
        <UserReviews />

        {/* 가격 안내 */}
        <div className="rounded-xl bg-white border border-gray-200 shadow-sm p-5 flex flex-col gap-1">
          <div className="flex items-center justify-between">
            <span className="text-body-m text-primary-800 font-semibold">Pro 구독</span>
            <span className="text-body-m font-bold text-primary-800">월 19,900원</span>
          </div>
          <p className="text-caption text-gray-400">7일 무료 체험 후 자동 결제. 언제든지 해지 가능.</p>
        </div>
      </div>

      {/* 하단 CTA — 고정 */}
      <div className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-mobile bg-white border-t border-gray-100 px-5 py-4 pb-safe flex flex-col gap-2">
        <Button
          variant="primary"
          size="lg"
          className="w-full"
          loading={isLoading}
          onClick={handleStartTrial}
        >
          7일 무료로 시작하기
        </Button>
        <Button
          variant="ghost"
          size="md"
          className="w-full text-gray-400"
          onClick={handleDismiss}
        >
          나중에
        </Button>
      </div>
    </div>
  );
}
