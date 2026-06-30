"use client";

/**
 * TabBar + FAB — 4탭 하단 네비게이션 + 중앙 작성+ FAB 돌출
 * design-final §5.2 (누락 보강) / ux-spec §2
 *
 * 구조: [홈] [아카이브] [작성+(FAB 돌출)] [마이]
 * - 높이: 56px (--spacing-14)
 * - safe-area-inset-bottom 패딩 (iOS 홈 인디케이터 영역)
 * - aria-selected / role=tab / nav
 * - 작성+ FAB: 중앙 돌출, 코랄 배경, shadow-ink
 *
 * 사용 예시:
 *   <TabBar />  // 라우트 자동 인식 (권장 — (tabs) 레이아웃)
 *   <TabBar activeTab="home" onTabChange={setTab} onFABClick={...} />  // 수동 제어
 */

import * as React from "react";
import { usePathname, useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { ROUTES } from "@/lib/constants";

/* ─── 탭 타입 ─── */

export type TabId = "home" | "archive" | "mypage";

export interface TabBarProps {
  /** 현재 활성 탭 (미전달 시 pathname 자동 인식) */
  activeTab?: TabId;
  /** 탭 변경 콜백 (미전달 시 router.push) */
  onTabChange?: (tab: TabId) => void;
  /** 중앙 FAB(작성+) 클릭 콜백 (미전달 시 /diary/new 이동) */
  onFABClick?: () => void;
  className?: string;
}

/** pathname → TabId 매핑 */
function resolveActiveTab(pathname: string | null): TabId {
  if (!pathname) return "home";
  if (pathname.startsWith("/archive")) return "archive";
  if (pathname.startsWith("/mypage")) return "mypage";
  return "home";
}

const TAB_ROUTES: Record<TabId, string> = {
  home: ROUTES.home,
  archive: ROUTES.archive,
  mypage: ROUTES.mypage,
};

/* ─── 인라인 SVG 아이콘 ─── */

function HomeIcon({ filled }: { filled: boolean }) {
  return filled ? (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z" />
    </svg>
  ) : (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
      <polyline points="9 22 9 12 15 12 15 22" />
    </svg>
  );
}

function ArchiveIcon({ filled }: { filled: boolean }) {
  return filled ? (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M20 2H4c-1.1 0-2 .9-2 2v3.01c0 .72.43 1.34 1 1.72V20c0 1.1 1.1 2 2 2h14c.9 0 2-.9 2-2V8.72c.57-.38 1-.99 1-1.71V4c0-1.1-.9-2-2-2zm-5 12H9v-2h6v2zm5-7H4V4h16v3z" />
    </svg>
  ) : (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <polyline points="21 8 21 21 3 21 3 8" />
      <rect x="1" y="3" width="22" height="5" />
      <line x1="10" y1="12" x2="14" y2="12" />
    </svg>
  );
}

function MypageIcon({ filled }: { filled: boolean }) {
  return filled ? (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" />
    </svg>
  ) : (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
      <circle cx="12" cy="7" r="4" />
    </svg>
  );
}

/* ─── 탭 아이템 정의 ─── */

interface TabItem {
  id: TabId;
  label: string;
  icon: (filled: boolean) => React.ReactNode;
}

const TABS: TabItem[] = [
  { id: "home", label: "홈", icon: (f) => <HomeIcon filled={f} /> },
  { id: "archive", label: "아카이브", icon: (f) => <ArchiveIcon filled={f} /> },
  { id: "mypage", label: "마이", icon: (f) => <MypageIcon filled={f} /> },
];

/* ─── 컴포넌트 ─── */

export function TabBar({
  activeTab: activeTabProp,
  onTabChange,
  onFABClick,
  className,
}: TabBarProps) {
  const pathname = usePathname();
  const router = useRouter();

  const activeTab = activeTabProp ?? resolveActiveTab(pathname);

  const handleTabChange = React.useCallback(
    (tab: TabId) => {
      if (onTabChange) onTabChange(tab);
      else router.push(TAB_ROUTES[tab]);
    },
    [onTabChange, router]
  );

  const handleFABClick = React.useCallback(() => {
    if (onFABClick) onFABClick();
    else router.push(ROUTES.diaryNew);
  }, [onFABClick, router]);

  return (
    <nav
      aria-label="하단 탭 네비게이션"
      className={cn(
        "fixed bottom-0 left-0 right-0 z-[var(--z-sticky)]",
        "bg-[var(--color-surface-raised)]",
        "border-t-2 border-[var(--color-line)]",
        // safe-area-inset-bottom (iOS 노치 대응)
        "pb-[env(safe-area-inset-bottom)]",
        className
      )}
    >
      <div
        role="tablist"
        aria-label="탭 목록"
        className="flex items-end justify-around h-14 px-2"
      >
        {/* 홈 탭 */}
        <TabButton
          tab={TABS[0]}
          isActive={activeTab === "home"}
          onClick={() => handleTabChange("home")}
        />

        {/* 아카이브 탭 */}
        <TabButton
          tab={TABS[1]}
          isActive={activeTab === "archive"}
          onClick={() => handleTabChange("archive")}
        />

        {/* 중앙 FAB — 작성+ (돌출) */}
        <div className="relative flex items-center justify-center">
          <button
            type="button"
            role="tab"
            aria-label="새 일기 작성"
            aria-selected={false}
            onClick={handleFABClick}
            className={cn(
              "flex items-center justify-center",
              // 돌출: 탭바 높이(56px)보다 크게 올라옴
              "-mt-6 h-16 w-16 rounded-full",
              "bg-[var(--color-primary)] text-[var(--color-primary-text)]",
              "border-[3px] border-[var(--color-line)] shadow-[var(--shadow-pop)]",
              "transition-[transform,box-shadow,background-color] duration-150 ease-out",
              "hover:bg-[var(--color-primary-hover)] hover:-translate-y-0.5 hover:shadow-[var(--shadow-pop-lg)]",
              "active:translate-y-0.5 active:shadow-[var(--shadow-pop-sm)]",
              "focus-visible:outline-none focus-visible:shadow-[var(--shadow-focus)]"
            )}
          >
            {/* + 아이콘 */}
            <svg
              width="28"
              height="28"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              aria-hidden="true"
            >
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
          </button>
        </div>

        {/* 마이 탭 */}
        <TabButton
          tab={TABS[2]}
          isActive={activeTab === "mypage"}
          onClick={() => handleTabChange("mypage")}
        />
      </div>
    </nav>
  );
}

/* ─── TabButton (재사용) ─── */

function TabButton({
  tab,
  isActive,
  onClick,
}: {
  tab: TabItem;
  isActive: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={isActive}
      aria-label={tab.label}
      onClick={onClick}
      className={cn(
        "flex flex-col items-center justify-center gap-0.5",
        "min-h-[44px] min-w-[44px] flex-1 py-1",
        "transition-colors duration-200",
        "focus-visible:outline-none focus-visible:shadow-[var(--shadow-focus)] rounded",
        isActive
          ? "text-[var(--color-primary)]"
          : "text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)]"
      )}
    >
      {tab.icon(isActive)}
      <span
        className={cn(
          "font-heading text-[11px] leading-tight",
          isActive ? "text-[var(--color-primary)]" : "text-[var(--color-text-muted)]"
        )}
      >
        {tab.label}
      </span>
    </button>
  );
}
