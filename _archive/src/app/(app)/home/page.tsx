// REDLINE: 타인 비교/외모 점수 UI 금지
"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { fetchScoreToday, MOCK_SCORE_TODAY } from "@/lib/api/checkin";
import { useAuthStore } from "@/lib/store/auth";
import { useCheckinStore } from "@/lib/store/checkin";
import { usePersonaStore } from "@/lib/store/persona";

// ---------------------------------------------------------------------------
// Home 페이지 — 체크인 + 점수 + 미션
// REDLINE: 타인 비교/외모 점수 UI 금지
// ---------------------------------------------------------------------------

// 4축 메타 정보
const AXIS_META = [
  { key: "health", label: "건강", color: "bg-health-500", shape: "●" },
  { key: "learning", label: "학습", color: "bg-learn-500", shape: "■" },
  { key: "relation", label: "관계", color: "bg-relate-500", shape: "▲" },
  { key: "achievement", label: "성취", color: "bg-achieve-500", shape: "◆" },
] as const;

// ---------------------------------------------------------------------------
// 드로어 메뉴
// ---------------------------------------------------------------------------

function Drawer({ open, onClose }: { open: boolean; onClose: () => void }) {
  const user = useAuthStore((s) => s.user);
  const clearAuth = useAuthStore((s) => s.clearAuth);

  if (!open) return null;

  return (
    <>
      {/* 오버레이 */}
      <div
        className="fixed inset-0 bg-surface-overlay z-40"
        onClick={onClose}
        aria-hidden="true"
      />
      {/* 드로어 패널 */}
      <nav
        aria-label="마이페이지 메뉴"
        className="fixed top-0 left-1/2 -translate-x-1/2 w-full max-w-mobile h-full z-50 flex"
      >
        <div className="w-72 bg-white h-full shadow-lg flex flex-col pt-safe">
          {/* 유저 정보 */}
          <div className="px-6 py-8 border-b border-gray-100">
            <div
              className="w-12 h-12 rounded-full bg-primary-800 flex items-center justify-center mb-3"
              aria-hidden="true"
            >
              <span className="text-white font-bold text-h3">
                {user?.nickname?.[0] ?? user?.email?.[0]?.toUpperCase() ?? "O"}
              </span>
            </div>
            <p className="text-body-m font-semibold text-primary-800">
              {user?.nickname ?? user?.email?.split("@")[0] ?? "오름 사용자"}님
            </p>
            {user?.subscription.tier === "pro" && (
              <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-accent-50 text-accent-600 text-caption font-medium mt-1">
                Pro
              </span>
            )}
          </div>

          {/* 메뉴 아이템 */}
          <ul className="flex-1 py-4" role="list">
            {[
              { label: "북극성 다짐 보기", href: "#" },
              { label: "90일 목표 관리", href: "/mission" },
              { label: "페르소나 변경", href: "#" },
              { label: "계정 설정", href: "#" },
              { label: "구독 관리", href: "/paywall" },
            ].map((item) => (
              <li key={item.label}>
                <a
                  href={item.href}
                  className="flex items-center px-6 h-12 text-body-m text-primary-800 hover:bg-gray-50 transition-colors duration-fast touch-target"
                  onClick={onClose}
                >
                  {item.label}
                </a>
              </li>
            ))}
          </ul>

          {/* 로그아웃 */}
          <div className="px-6 py-4 border-t border-gray-100 pb-safe">
            <button
              onClick={() => {
                clearAuth();
                onClose();
              }}
              className="text-body-s text-gray-400 hover:text-error transition-colors duration-fast touch-target"
            >
              로그아웃
            </button>
          </div>
        </div>
      </nav>
    </>
  );
}

// ---------------------------------------------------------------------------
// 점수 카드 스켈레톤
// ---------------------------------------------------------------------------

function ScoreCardSkeleton() {
  return (
    <div className="rounded-xl bg-white border border-gray-100 shadow-sm p-5 animate-pulse">
      <div className="h-4 bg-gray-200 rounded w-24 mb-3" />
      <div className="h-10 bg-gray-200 rounded w-20 mb-2" />
      <div className="h-4 bg-gray-200 rounded w-32" />
    </div>
  );
}

// ---------------------------------------------------------------------------
// 메인 점수 카드
// ---------------------------------------------------------------------------

function ScoreCard({
  total,
  delta,
  hasCheckedIn,
  onCheckin,
}: {
  total: number;
  delta: number | null;
  hasCheckedIn: boolean;
  onCheckin: () => void;
}) {
  const isPositive = delta !== null && delta > 0;
  const isNegative = delta !== null && delta < 0;

  return (
    <div className="rounded-xl bg-white border border-gray-100 shadow-sm p-5">
      <p className="text-caption text-gray-500 mb-1">오늘의 오름 지수</p>
      <div className="flex items-end gap-3 mb-2">
        <span
          className="text-display font-bold text-primary-800 leading-none"
          aria-label={`오름 지수 ${total}점`}
        >
          {total}
        </span>
        <span className="text-body-m text-gray-400 mb-1">/ 100</span>
      </div>

      {delta !== null && (
        <p
          className={[
            "text-body-s font-medium mb-4",
            isPositive ? "text-health-500" : isNegative ? "text-error" : "text-gray-400",
          ].join(" ")}
          aria-live="polite"
        >
          {isPositive && `어제보다 +${delta}점 ↑`}
          {isNegative && `어제보다 ${delta}점 ↓`}
          {delta === 0 && "어제와 동일"}
        </p>
      )}

      {!hasCheckedIn && (
        <Button variant="primary" size="md" className="w-full" onClick={onCheckin}>
          체크인 하기
        </Button>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// 4축 미니 막대 (design-final.md D1 — 홈=총점+미니 막대)
// ---------------------------------------------------------------------------

function AxisMiniBars({
  health,
  learning,
  relation,
  achievement,
}: {
  health: number;
  learning: number;
  relation: number;
  achievement: number;
}) {
  const scores = { health, learning, relation, achievement };

  return (
    <div className="flex flex-col gap-2" aria-label="4축 점수 미니 막대">
      {AXIS_META.map(({ key, label, color, shape }) => (
        <div key={key} className="flex items-center gap-3">
          {/* 색약 대응: 컬러 + 모양 + 레이블 3중 표기 (design-final.md §7-C) */}
          <span className="text-caption text-gray-500 w-12 shrink-0" aria-hidden="true">
            {shape} {label}
          </span>
          <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-slow ${color}`}
              style={{ width: `${scores[key]}%` }}
              role="progressbar"
              aria-valuenow={scores[key]}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label={`${label} ${scores[key]}점`}
            />
          </div>
          <span className="text-caption text-gray-400 w-8 text-right">{scores[key]}</span>
        </div>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// 미션 카드
// ---------------------------------------------------------------------------

function MissionCard({ title }: { title: string }) {
  const [accepted, setAccepted] = useState(false);
  const [skipped, setSkipped] = useState(false);

  if (skipped) return null;

  return (
    <div className="rounded-xl bg-white border border-gray-100 shadow-sm p-4">
      <p className="text-caption text-gray-500 mb-2">오늘의 미션</p>
      <p className="text-body-m font-medium text-primary-800 mb-3">{title}</p>
      {!accepted ? (
        <div className="flex gap-2">
          <Button
            variant="primary"
            size="sm"
            onClick={() => setAccepted(true)}
            className="flex-1"
          >
            수락
          </Button>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => setSkipped(true)}
            className="flex-1"
          >
            패스
          </Button>
        </div>
      ) : (
        <p className="text-body-s text-health-500 font-medium">미션을 수락했어요!</p>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// 스트릭 뱃지
// ---------------------------------------------------------------------------

function StreakBadge({ count }: { count: number }) {
  return (
    <div
      className="flex items-center gap-1.5"
      aria-label={`${count}일 연속 체크인`}
    >
      {/* 불꽃 SVG 아이콘 (이모지 의존 X — design-final.md §UI 의존 4) */}
      <svg
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill="currentColor"
        className="text-accent-500"
        aria-hidden="true"
      >
        <path d="M12 2C8.5 8 7 11.5 8 14a4 4 0 008 0c0-2.5-1.5-6-4-12z" />
      </svg>
      <span className="text-body-s font-semibold text-primary-800">
        {count}일 연속
      </span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// 메인 컴포넌트
// ---------------------------------------------------------------------------

export default function HomePage() {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const user = useAuthStore((s) => s.user);
  const isProUser = user?.subscription.tier === "pro";
  const persona = usePersonaStore((s) => s.selected);

  // 오늘 점수 조회
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["score", "today"],
    queryFn: fetchScoreToday,
    // W1~W2: mock 데이터 폴백
    placeholderData: MOCK_SCORE_TODAY,
  });

  const hasCheckedIn = data?.hasCheckedInToday ?? false;
  const score = data?.score;
  const delta = data?.delta?.total ?? null;

  function handleCheckin() {
    // TODO: 체크인 오버레이 열기 (W3~W4 구현)
    // 현재는 mock — checkin 스토어 연동 예정
  }

  return (
    <>
      <Drawer open={drawerOpen} onClose={() => setDrawerOpen(false)} />

      {/* App Bar */}
      <header className="sticky top-0 z-30 bg-white border-b border-gray-100">
        <div className="flex items-center justify-between h-14 px-5 pt-safe">
          <button
            onClick={() => setDrawerOpen(true)}
            aria-label="메뉴 열기"
            className="w-11 h-11 flex items-center justify-center -ml-2 rounded-lg hover:bg-gray-100 touch-target"
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
              <line x1="3" y1="6" x2="21" y2="6" />
              <line x1="3" y1="12" x2="21" y2="12" />
              <line x1="3" y1="18" x2="21" y2="18" />
            </svg>
          </button>

          <span className="text-h4 font-bold text-primary-800">오름</span>

          {isProUser && (
            <span className="px-2 py-0.5 rounded-full bg-accent-50 text-accent-600 text-caption font-medium">
              Pro
            </span>
          )}
          {!isProUser && <div className="w-11" aria-hidden="true" />}
        </div>
      </header>

      {/* 스크롤 콘텐츠 */}
      <div className="px-5 py-4 flex flex-col gap-4">
        {/* 스트릭 */}
        <StreakBadge count={3} />

        {/* 메인 점수 카드 */}
        {isLoading ? (
          <ScoreCardSkeleton />
        ) : isError ? (
          <div className="rounded-xl bg-white border border-error-bg p-5 flex flex-col gap-3">
            <p className="text-body-m text-error">점수를 불러오지 못했습니다.</p>
            <Button variant="secondary" size="sm" onClick={() => refetch()}>
              다시 불러오기
            </Button>
          </div>
        ) : (
          <ScoreCard
            total={score?.total ?? 0}
            delta={delta}
            hasCheckedIn={hasCheckedIn}
            onCheckin={handleCheckin}
          />
        )}

        {/* 미션 카드 */}
        <MissionCard title="물 2L 마시기" />

        {/* 4축 미니 막대 */}
        {score && (
          <div className="rounded-xl bg-white border border-gray-100 shadow-sm p-4">
            <AxisMiniBars
              health={score.health}
              learning={score.learning}
              relation={score.relation}
              achievement={score.achievement}
            />
          </div>
        )}

        {/* 코치챗 CTA */}
        <button
          onClick={() => {
            window.location.href = "/coach";
          }}
          className="w-full flex items-center justify-between rounded-xl bg-white border border-gray-100 shadow-sm px-4 h-12 touch-target group"
          aria-label={isProUser ? "코치와 이야기하기" : "Pro에서 코치와 이야기하기"}
        >
          <span className="text-body-m font-medium text-primary-800">
            {persona === "mentor" ? "지수" : persona === "spartan" ? "강" : "민"} 코치와
            이야기하기
          </span>
          <div className="flex items-center gap-1.5">
            {!isProUser && (
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="currentColor"
                className="text-gray-400"
                aria-hidden="true"
              >
                <rect x="3" y="11" width="18" height="11" rx="2" />
                <path d="M7 11V7a5 5 0 0110 0v4" />
              </svg>
            )}
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              className="text-gray-400 group-hover:translate-x-0.5 transition-transform duration-fast"
              aria-hidden="true"
            >
              <polyline points="9 18 15 12 9 6" />
            </svg>
          </div>
        </button>
      </div>
    </>
  );
}
