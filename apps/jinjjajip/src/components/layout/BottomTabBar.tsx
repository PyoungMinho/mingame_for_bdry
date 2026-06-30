"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, Upload, Activity } from "lucide-react";
import { cn } from "@/lib/utils";

const TABS = [
  { href: "/", label: "홈", icon: Home, ariaLabel: "홈·검색" },
  { href: "/verify", label: "업로드", icon: Upload, ariaLabel: "세입자 인증 업로드" },
  { href: "/my", label: "내 활동", icon: Activity, ariaLabel: "내 활동" },
] as const;

const HIDDEN_PREFIXES = ["/listings/", "/auth/verify"];

export function BottomTabBar() {
  const pathname = usePathname();

  const isHidden = HIDDEN_PREFIXES.some((prefix) => pathname.startsWith(prefix));
  if (isHidden) return null;

  return (
    <nav
      aria-label="주요 탭 메뉴"
      className="fixed bottom-0 left-0 right-0 z-50 bg-white border-t border-realestate-neutral-200"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <ul className="flex h-14" role="list">
        {TABS.map(({ href, label, icon: Icon, ariaLabel }) => {
          const isActive =
            href === "/" ? pathname === "/" : pathname.startsWith(href);
          return (
            <li key={href} className="flex-1">
              <Link
                href={href}
                aria-label={ariaLabel}
                aria-current={isActive ? "page" : undefined}
                className={cn(
                  "flex flex-col items-center justify-center w-full h-full gap-0.5 text-xs font-medium",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-realestate-brand-primary focus-visible:ring-inset",
                  isActive
                    ? "text-realestate-brand-primary"
                    : "text-realestate-neutral-500",
                )}
              >
                <Icon
                  size={22}
                  strokeWidth={isActive ? 2 : 1.5}
                  aria-hidden="true"
                />
                <span>{label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
