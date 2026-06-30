/**
 * S9 마이페이지 — 프로필/구독/설정. P1.
 * ux-spec §4 화면9.
 * 잉크 & 리소 에디션 — 프로필 잉크 카드, 구독 배지 리소, 숫자 font-english.
 */
"use client";

import { useRouter } from "next/navigation";
import { Button, Toggle, Card } from "@/components";
import { ROUTES, TIERS } from "@/lib/constants";
import { COPY } from "@/lib/copy";
import { useQuota } from "@/hooks/useQuota";
import { useThemeStore } from "@/store/themeStore";

export default function MypagePage() {
  const router = useRouter();
  const { data: quota } = useQuota();
  const { resolved: theme, toggle: toggleTheme } = useThemeStore();

  const tier = quota?.tier ?? "free";
  const tierMeta = TIERS[tier];

  return (
    <div className="relative mx-auto max-w-[480px] overflow-x-hidden px-5 py-4">
      {/* 배경 하프톤 데코 */}
      <span
        aria-hidden
        className="tone-dots-lg pointer-events-none absolute -right-10 top-10 h-40 w-40 rounded-full text-[var(--color-primary)] opacity-[0.07]"
      />

      {/* 페이지 타이틀 */}
      <h1 className="relative mb-5 font-display text-2xl text-[var(--color-text-primary)]">
        {COPY.mypage.title}
      </h1>

      {/* 프로필 카드 */}
      <Card className="relative mb-4 flex items-center gap-4 overflow-hidden p-4">
        <span
          aria-hidden
          className="tone-dots pointer-events-none absolute inset-0 text-[var(--color-secondary)] opacity-[0.08]"
        />
        {/* 아바타 — 잉크 원형 프레임 */}
        <div className="relative flex h-14 w-14 flex-shrink-0 items-center justify-center rounded-full border-2 border-[var(--color-line)] bg-[var(--color-bg-subtle)] text-2xl shadow-[var(--shadow-pop-sm)]">
          👤
        </div>
        <div className="relative min-w-0 flex-1">
          <p className="font-heading text-base text-[var(--color-text-primary)]">
            툰일기 사용자
          </p>
          <p className="font-sans text-sm text-[var(--color-text-muted)]">
            {tierMeta.name} 플랜
          </p>
        </div>
        {/* 티어 배지 — 리소 도장 */}
        <span
          className={`relative flex-shrink-0 rounded-full border-2 border-[var(--color-line)] px-3 py-0.5 font-heading text-xs shadow-[var(--shadow-pop-xs)] ${
            tier === "pro"
              ? "bg-[var(--color-lemon)] text-[var(--color-ink)]"
              : tier === "basic"
              ? "bg-[var(--color-secondary)] text-[var(--color-secondary-text)]"
              : "bg-[var(--color-bg-muted)] text-[var(--color-text-secondary)]"
          }`}
        >
          {tierMeta.name}
        </span>
      </Card>

      {/* 구독 현황 */}
      <Card className="relative mb-4 overflow-hidden p-4">
        <span
          aria-hidden
          className="tone-dots pointer-events-none absolute inset-0 text-[var(--color-accent)] opacity-[0.06]"
        />
        <div className="relative mb-3 flex items-center justify-between">
          <p className="font-heading text-base text-[var(--color-text-primary)]">
            현재 플랜
          </p>
        </div>
        <div className="relative mb-3 flex items-center justify-between">
          <span className="font-sans text-sm text-[var(--color-text-muted)]">이번 달 한도</span>
          <span className="font-english text-base text-[var(--color-text-primary)]">
            {quota ? `${quota.remaining}/${quota.limit}컷` : "···"}
          </span>
        </div>
        {tier !== "pro" && (
          <Button
            variant="primary"
            size="sm"
            className="relative w-full"
            onClick={() => router.push(ROUTES.upgrade)}
          >
            {COPY.mypage.ctaUpgrade}
          </Button>
        )}
      </Card>

      {/* 설정 카드 */}
      <Card className="mb-4 divide-y-2 divide-[var(--color-border-subtle)] p-0 overflow-hidden">
        <div className="flex items-center justify-between px-4 py-4">
          <span className="font-sans text-sm text-[var(--color-text-primary)]">
            {COPY.mypage.themeLabel}
          </span>
          <Toggle
            checked={theme === "dark"}
            onChange={toggleTheme}
            aria-label={COPY.mypage.themeLabel}
          />
        </div>
        <div className="flex items-center justify-between px-4 py-4">
          <span className="font-sans text-sm text-[var(--color-text-primary)]">
            {COPY.mypage.notificationLabel}
          </span>
          <Toggle
            checked={false}
            onChange={() => {
              /* 알림 설정 — 백엔드 API 의존 */
            }}
            aria-label={COPY.mypage.notificationLabel}
          />
        </div>
      </Card>

      {/* 계정 액션 */}
      <div className="flex flex-col gap-2">
        <Button
          variant="ghost"
          size="md"
          className="w-full"
          onClick={() => {
            /* 로그아웃 — /api/auth/logout */
            window.location.href = "/api/auth/logout";
          }}
        >
          {COPY.mypage.ctaLogout}
        </Button>
        <Button
          variant="danger"
          size="md"
          className="w-full"
          onClick={() => {
            if (window.confirm(COPY.mypage.deleteConfirm)) {
              /* 계정 삭제 API 호출 */
            }
          }}
        >
          {COPY.mypage.ctaDeleteAccount}
        </Button>
      </div>
    </div>
  );
}
