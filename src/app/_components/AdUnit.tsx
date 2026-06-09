"use client";

import { useEffect, useRef } from "react";
import { ADSENSE_CLIENT, ADS_ENABLED } from "@/lib/ads";

declare global {
  interface Window {
    adsbygoogle?: unknown[];
  }
}

/**
 * 애드센스 광고 단위.
 * - 프로덕션 + 슬롯 ID 있음 → 실제 <ins> 광고 렌더 + push.
 * - 개발/데모 → 자리 표시(레이아웃 확인용 점선 박스).
 * - 프로덕션 + 슬롯 미설정 → 아무것도 렌더 안 함(빈 광고 박스 방지).
 */
export function AdUnit({
  slot,
  label = "광고 영역",
  className = "",
}: {
  slot?: string;
  label?: string;
  className?: string;
}) {
  const pushed = useRef(false);
  const live = ADS_ENABLED && !!slot;

  useEffect(() => {
    if (!live || pushed.current) return;
    try {
      (window.adsbygoogle = window.adsbygoogle || []).push({});
      pushed.current = true;
    } catch {
      /* 애드센스 스크립트 미로드/광고차단 → 무시 */
    }
  }, [live]);

  if (live) {
    return (
      <div className={className}>
        <ins
          className="adsbygoogle"
          style={{ display: "block" }}
          data-ad-client={ADSENSE_CLIENT}
          data-ad-slot={slot}
          data-ad-format="auto"
          data-full-width-responsive="true"
          aria-label="광고"
        />
      </div>
    );
  }

  // 프로덕션인데 슬롯 미설정 → 빈 박스 대신 미표시
  if (process.env.NODE_ENV === "production") return null;

  // 개발/데모 — 자리 표시
  return (
    <div className={className} aria-hidden>
      <div className="flex min-h-[90px] w-full items-center justify-center rounded-xl border border-dashed border-slate-300 bg-slate-50/70 px-4 text-center">
        <div>
          <div className="text-[10px] font-semibold uppercase tracking-[0.15em] text-slate-400">
            Advertisement
          </div>
          <div className="mt-0.5 text-[12px] text-slate-400">{label} · 무료 자습은 광고로 운영됩니다</div>
        </div>
      </div>
    </div>
  );
}
