"use client";

/**
 * ArtStyleCard — 화풍 선택 카드 4종
 * design-final §5.3 / ui-spec §7.12
 *
 * 사용 예시:
 *   {ART_STYLES.map(style => (
 *     <ArtStyleCard
 *       key={style.key}
 *       artStyle={style}
 *       selected={current === style.key}
 *       onSelect={() => setCurrent(style.key)}
 *     />
 *   ))}
 */

import * as React from "react";
import { cn } from "@/lib/utils";
import type { ArtStyleKey } from "@/lib/contract";
import type { ArtStyleMeta } from "@/lib/constants";

/* ─── 화풍별 썸네일 팔레트 (실 이미지 에셋 전달 전까지 CSS 표현) ─── */

const ART_STYLE_PALETTE: Record<ArtStyleKey, { bg: string; accent: string; label: string }> = {
  emotional_line: { bg: "#FFE3ED", accent: "#FF3D7F", label: "감성" },
  bold_pen: { bg: "#EFE8D9", accent: "#16130F", label: "대담" },
  pop_cartoon: { bg: "#FFF6CC", accent: "#FF3D7F", label: "팝" },
  watercolor_touch: { bg: "#E1E6F7", accent: "#2541B2", label: "수채" },
};

/* ─── Props ─── */

export interface ArtStyleCardProps {
  artStyle: ArtStyleMeta;
  selected: boolean;
  onSelect: () => void;
  /** 실제 화풍 샘플 썸네일 이미지 URL (W2 디자인팀 전달 예정) */
  thumbnailUrl?: string;
  disabled?: boolean;
  className?: string;
}

/* ─── 컴포넌트 ─── */

export function ArtStyleCard({
  artStyle,
  selected,
  onSelect,
  thumbnailUrl,
  disabled,
  className,
}: ArtStyleCardProps) {
  const palette = ART_STYLE_PALETTE[artStyle.key];

  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      aria-label={`화풍: ${artStyle.name}. ${artStyle.desc}`}
      disabled={disabled}
      onClick={onSelect}
      className={cn(
        "w-full h-[100px] rounded-xl border-2 border-[var(--color-line)] overflow-hidden",
        "flex items-stretch",
        "transition-[transform,box-shadow] duration-150 ease-out",
        "focus-visible:outline-none focus-visible:shadow-[var(--shadow-focus)]",
        "disabled:opacity-50 disabled:cursor-not-allowed",
        selected
          ? "bg-[var(--color-primary-subtle)] shadow-[var(--shadow-pop)] -translate-x-px -translate-y-px"
          : "bg-[var(--color-surface-raised)] shadow-[var(--shadow-pop-sm)] hover:-translate-x-px hover:-translate-y-px hover:shadow-[var(--shadow-pop-lg)]",
        className
      )}
    >
      {/* 좌측 1/3 — 썸네일 */}
      <div
        aria-hidden="true"
        className="w-1/3 flex items-center justify-center overflow-hidden shrink-0"
        style={{ backgroundColor: palette.bg }}
      >
        {thumbnailUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={thumbnailUrl}
            alt=""
            className="w-full h-full object-cover"
            draggable={false}
          />
        ) : (
          /* 썸네일 에셋 미도달 전 CSS 프리뷰 */
          <div
            className="flex items-center justify-center h-full w-full"
            style={{ backgroundColor: palette.bg }}
          >
            <span
              className="text-[10px] font-bold rounded px-1"
              style={{ color: palette.accent, border: `1.5px solid ${palette.accent}` }}
            >
              {palette.label}
            </span>
          </div>
        )}
      </div>

      {/* 우측 2/3 — 설명 */}
      <div className="flex-1 flex items-center justify-between px-4 min-w-0">
        <div className="flex flex-col gap-1 text-left min-w-0">
          <span
            className={cn(
              "font-heading text-base leading-tight truncate",
              selected
                ? "text-[var(--color-primary)]"
                : "text-[var(--color-text-primary)]"
            )}
          >
            {artStyle.name}
          </span>
          <span className="text-xs text-[var(--color-text-muted)] leading-normal line-clamp-2">
            {artStyle.desc}
          </span>
        </div>

        {/* 라디오 인디케이터 */}
        <div
          aria-hidden="true"
          className={cn(
            "shrink-0 h-[22px] w-[22px] rounded-full border-2 border-[var(--color-line)] ml-3",
            "flex items-center justify-center",
            "transition-colors duration-150",
            selected
              ? "bg-[var(--color-primary)]"
              : "bg-[var(--color-surface-raised)]"
          )}
        >
          {selected && (
            <div className="h-2 w-2 rounded-full bg-[var(--color-primary-text)]" />
          )}
        </div>
      </div>
    </button>
  );
}
