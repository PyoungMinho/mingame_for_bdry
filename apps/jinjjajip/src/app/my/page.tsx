"use client";

import Link from "next/link";
import { EmptyState } from "@/components/common/EmptyState";
import { BottomTabBar } from "@/components/layout/BottomTabBar";
import { Bell } from "lucide-react";

export default function MyPage() {
  return (
    <div className="min-h-dvh bg-realestate-neutral-50 pb-20">
      <header className="sticky top-0 z-40 bg-white border-b border-realestate-neutral-200 h-12 flex items-center justify-between px-4">
        <span className="text-base font-semibold text-realestate-neutral-900">내 활동</span>
        <button
          type="button"
          aria-label="알림"
          className="w-10 h-10 flex items-center justify-center rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-realestate-brand-primary"
        >
          <Bell size={20} strokeWidth={1.5} className="text-realestate-neutral-700" />
        </button>
      </header>

      <main className="flex flex-col items-center justify-center min-h-[60vh] px-4">
        <EmptyState
          message="아직 활동이 없습니다"
          description="방을 인증하면 등급과 인증서를 확인할 수 있어요"
          action={
            <Link
              href="/verify"
              className="px-6 py-3 bg-realestate-brand-primary text-white rounded-md text-sm font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-realestate-brand-primary"
            >
              방 인증하기
            </Link>
          }
        />
      </main>

      <BottomTabBar />
    </div>
  );
}
