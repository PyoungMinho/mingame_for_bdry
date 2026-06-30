// REDLINE: 타인 비교/외모 점수 UI 금지
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

// ---------------------------------------------------------------------------
// 4탭 바텀 내비게이션 (design-final.md U1 확정 — 4탭)
// ---------------------------------------------------------------------------

interface TabItem {
  href: string;
  label: string;
  /** aria-label에 사용하는 전체 이름 */
  ariaLabel: string;
  /** SVG path d 값 */
  iconPath: string;
}

const TABS: TabItem[] = [
  {
    href: "/home",
    label: "홈",
    ariaLabel: "홈",
    iconPath: "M3 9.5L12 3l9 6.5V20a1 1 0 01-1 1H4a1 1 0 01-1-1V9.5z",
  },
  {
    href: "/graph",
    label: "그래프",
    ariaLabel: "성장 그래프",
    iconPath:
      "M3 17l4-6 4 3 4-8 4 4",
  },
  {
    href: "/mission",
    label: "미션",
    ariaLabel: "미션 및 목표",
    iconPath:
      "M9 11l3 3L22 4M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11",
  },
  {
    href: "/coach",
    label: "코치",
    ariaLabel: "AI 코치챗",
    iconPath:
      "M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2v10z",
  },
];

function TabBar() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="주요 메뉴"
      className={[
        "fixed bottom-0 left-1/2 -translate-x-1/2",
        "w-full max-w-mobile",
        "bg-white border-t border-gray-100 shadow-sm",
        "pb-safe",
        "z-40",
      ].join(" ")}
    >
      <div className="flex items-center">
        {TABS.map((tab) => {
          const isActive = pathname === tab.href || pathname.startsWith(tab.href + "/");
          return (
            <Link
              key={tab.href}
              href={tab.href}
              aria-label={tab.ariaLabel}
              aria-current={isActive ? "page" : undefined}
              className={[
                "flex-1 flex flex-col items-center justify-center gap-0.5",
                // 탭바 아이콘 터치 영역 48×48 (design-final.md §7-B)
                "h-14 min-w-[48px]",
                "transition-colors duration-fast",
                isActive ? "text-accent-500" : "text-gray-400 hover:text-gray-600",
              ].join(" ")}
            >
              <svg
                width="24"
                height="24"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth={isActive ? "2.5" : "2"}
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d={tab.iconPath} />
              </svg>
              <span
                className={[
                  "text-[10px] leading-none font-medium",
                  isActive ? "text-accent-500" : "text-gray-400",
                ].join(" ")}
              >
                {tab.label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

// ---------------------------------------------------------------------------
// (app) 레이아웃
// ---------------------------------------------------------------------------

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-dvh bg-surface-bg">
      {/* 페이지 콘텐츠 — 탭바 높이(80px) 패딩 확보 */}
      <main className="pb-20">{children}</main>
      <TabBar />
    </div>
  );
}
