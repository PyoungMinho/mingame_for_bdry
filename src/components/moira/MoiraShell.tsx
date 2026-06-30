"use client";

import { cn } from "@/lib/utils";
import Link from "next/link";
import type { ReactNode } from "react";
import { Stepper } from "./Stepper";

/** moira 워드마크 — 'o'를 타겟 핀 점으로 치환한 데이터-허니스트 로고 */
export function MoiraWordmark({ className }: { className?: string }) {
  return (
    <Link
      href="/moira"
      className={cn(
        "inline-flex items-center gap-1.5 text-[19px] font-extrabold tracking-[-0.03em] text-moira-ink cursor-pointer",
        className,
      )}
      aria-label="모이라 홈"
    >
      <span className="relative flex h-5 w-5 items-center justify-center">
        <span className="absolute h-5 w-5 rounded-full border-[2.5px] border-moira-brand" />
        <span className="h-2 w-2 rounded-full bg-moira-brand" />
      </span>
      <span>
        m<span className="text-moira-brand">oi</span>ra
      </span>
    </Link>
  );
}

interface MoiraShellProps {
  children: ReactNode;
  step?: 1 | 2 | 3 | 4;
  header?: boolean;
  headerRight?: ReactNode;
  bottomBar?: ReactNode;
  /** 투표 웹뷰처럼 미니멀 프레임 */
  variant?: "app" | "webview";
}

export function MoiraShell({
  children,
  step,
  header = true,
  headerRight,
  bottomBar,
  variant = "app",
}: MoiraShellProps) {
  return (
    <div className="moira-scope min-h-[100dvh] bg-moira-bg text-moira-ink font-sans">
      <div className="relative mx-auto flex min-h-[100dvh] max-w-[480px] flex-col bg-moira-bg">
        {header && (
          <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-moira-border/70 bg-moira-bg/90 px-5 backdrop-blur-md">
            {variant === "webview" ? (
              <div className="flex items-center gap-2">
                <MoiraWordmark />
                <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-bold text-emerald-700">
                  로그인 없이 바로 투표
                </span>
              </div>
            ) : (
              <MoiraWordmark />
            )}
            <div className="flex items-center gap-1">{headerRight}</div>
          </header>
        )}

        {step && (
          <div className="px-5 pt-4">
            <Stepper current={step} />
          </div>
        )}

        <main className={cn("flex-1 px-5 pt-5", bottomBar ? "pb-36" : "pb-10")}>{children}</main>

        {bottomBar}
      </div>
    </div>
  );
}
