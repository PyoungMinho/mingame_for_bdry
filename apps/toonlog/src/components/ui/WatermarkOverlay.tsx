/**
 * WatermarkOverlay — tier 분기 워터마크 오버레이
 * design-final §8.1 / ui-spec §12 / WATERMARK_CONFIG
 *
 * - 무료: 큰 워터마크(80×26px) + QR 32px, opacity 0.92, 우하단
 * - 베이직: 소형(56×18px), opacity 0.60, QR 없음
 * - 프로: 숨김 (show=false)
 *
 * ⚠️ 이 컴포넌트는 WatermarkOverlay이며 AIDisclosureBadge와 별개.
 *    프로 티어에서도 AIDisclosureBadge는 반드시 유지 (design-final §8.2)
 *
 * 사용 예시:
 *   <div className="relative">
 *     <img src={panelUrl} alt="4컷" />
 *     <WatermarkOverlay tier={user.tier} />
 *     <AIDisclosureBadge /> // 항상 유지
 *   </div>
 */

import * as React from "react";
import { cn } from "@/lib/utils";
import type { Tier } from "@/lib/contract";
import { WATERMARK_CONFIG } from "@/lib/constants";

/* ─── QR 플레이스홀더 (실제 QR은 서버에서 URL 기반 생성) ─── */

function QRPlaceholder({ size }: { size: number }) {
  return (
    <div
      aria-hidden="true"
      style={{ width: size, height: size }}
      className="bg-[var(--color-surface-raised)] rounded-sm border-2 border-[var(--color-line)] flex items-center justify-center overflow-hidden"
    >
      {/* QR SVG 패턴 플레이스홀더 — 실제 구현 시 qrcode 라이브러리 교체 */}
      <svg
        width={size}
        height={size}
        viewBox="0 0 32 32"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
      >
        <rect x="2" y="2" width="12" height="12" fill="none" stroke="#1A1A1A" strokeWidth="1.5"/>
        <rect x="4" y="4" width="8" height="8" fill="#1A1A1A"/>
        <rect x="18" y="2" width="12" height="12" fill="none" stroke="#1A1A1A" strokeWidth="1.5"/>
        <rect x="20" y="4" width="8" height="8" fill="#1A1A1A"/>
        <rect x="2" y="18" width="12" height="12" fill="none" stroke="#1A1A1A" strokeWidth="1.5"/>
        <rect x="4" y="20" width="8" height="8" fill="#1A1A1A"/>
        <rect x="18" y="18" width="4" height="4" fill="#1A1A1A"/>
        <rect x="24" y="18" width="4" height="4" fill="#1A1A1A"/>
        <rect x="22" y="22" width="4" height="4" fill="#1A1A1A"/>
        <rect x="18" y="26" width="4" height="4" fill="#1A1A1A"/>
        <rect x="26" y="26" width="4" height="4" fill="#1A1A1A"/>
      </svg>
    </div>
  );
}

/* ─── Props ─── */

export interface WatermarkOverlayProps {
  tier: Tier;
  /**
   * 컷 인덱스 (뷰어 컷별 워터마크용).
   * design-final §8.1: 무료=컷 우하단 + 카드 우하단 / 베이직=카드만(컷 내부 X).
   * → 베이직은 panelIndex가 있으면(=컷 오버레이) 렌더 안 함.
   */
  panelIndex?: number;
  /** 공유 카드 컨텍스트 (카드 우하단). 베이직도 카드에는 노출. */
  isShareCard?: boolean;
  /** 커스텀 위치 오버라이드 (기본: 우하단) */
  className?: string;
}

/* ─── 컴포넌트 ─── */

export function WatermarkOverlay({
  tier,
  panelIndex,
  isShareCard,
  className,
}: WatermarkOverlayProps) {
  const config = WATERMARK_CONFIG[tier];

  if (!config.show) return null;

  // 베이직: 컷 내부 워터마크 X, 카드 우하단만 (design-final §8.1)
  const isPanelContext = panelIndex !== undefined && !isShareCard;
  if (tier === "basic" && isPanelContext) return null;

  const isLarge = tier === "free";

  return (
    <div
      aria-hidden="true" // 워터마크는 시각적 브랜딩, 스크린리더 불필요
      className={cn(
        "absolute bottom-2 right-2 z-10",
        "flex items-end gap-1",
        "pointer-events-none select-none",
        className
      )}
      style={{ opacity: config.opacity }}
    >
      {/* QR (무료 only) */}
      {config.withQR && (
        <QRPlaceholder size={32} />
      )}

      {/* 워터마크 뱃지 — 잉크 라인+pop 그림자+하프톤 결 */}
      <div
        className={cn(
          "relative flex items-center justify-center overflow-hidden",
          "rounded-sm border-2 border-[var(--color-line)]",
          "font-display tracking-wide",
          "bg-[var(--color-lemon)] text-[var(--color-ink)]",
          "shadow-[var(--shadow-pop-xs)]",
          isLarge ? "-rotate-2 px-2 py-0.5 text-[10px]" : "-rotate-1 px-1.5 py-px text-[8px]"
        )}
        style={
          isLarge
            ? { minWidth: 80, height: 26 }
            : { minWidth: 56, height: 18 }
        }
      >
        <span className="tone-dots absolute inset-0 text-[var(--color-ink)] opacity-10" aria-hidden="true" />
        <span className="relative">Toonlog</span>
      </div>
    </div>
  );
}
