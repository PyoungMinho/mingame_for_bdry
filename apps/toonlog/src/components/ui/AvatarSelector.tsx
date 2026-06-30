"use client";

/**
 * AvatarSelector — 8종 2×4 그리드 + 커스텀 슬라이더 (헤어/상의/액세서리)
 * design-final §5.3 / ui-spec §7.11
 *
 * 사용 예시:
 *   <AvatarSelector
 *     value={avatarConfig}
 *     onChange={setAvatarConfig}
 *   />
 */

import * as React from "react";
import { cn } from "@/lib/utils";
import type { AvatarConfig, AvatarHairColor, AvatarTopStyle, AvatarAccessory } from "@/lib/contract";
import {
  AVATAR_HAIR_COLORS,
  AVATAR_TOP_STYLES,
  AVATAR_ACCESSORIES,
  DEFAULT_AVATAR,
} from "@/lib/constants";

/* ─── 아바타 프리셋 8종 레이블 ─── */

interface AvatarPreset {
  key: string;
  label: string;
  defaultConfig: Pick<AvatarConfig, "hairColor" | "topStyle" | "accessory">;
}

const AVATAR_PRESETS: AvatarPreset[] = [
  { key: "SHORT_HAIR_GIRL", label: "단발 소녀", defaultConfig: { hairColor: "black", topStyle: "white-top", accessory: "none" } },
  { key: "LONG_HAIR_GIRL", label: "긴머리 소녀", defaultConfig: { hairColor: "brown", topStyle: "casual", accessory: "none" } },
  { key: "SHORT_HAIR_BOY", label: "단발 소년", defaultConfig: { hairColor: "black", topStyle: "stripe", accessory: "none" } },
  { key: "CURLY_HAIR", label: "곱슬머리", defaultConfig: { hairColor: "blonde", topStyle: "hoodie", accessory: "none" } },
  { key: "TWIN_TAILS", label: "트윈테일", defaultConfig: { hairColor: "pink", topStyle: "uniform", accessory: "none" } },
  { key: "GLASSES_KID", label: "안경 쓴 아이", defaultConfig: { hairColor: "black", topStyle: "formal", accessory: "glasses" } },
  { key: "HAT_BOY", label: "모자 쓴 아이", defaultConfig: { hairColor: "brown", topStyle: "sport", accessory: "hat" } },
  { key: "EARPHONE_TEEN", label: "이어폰 소년", defaultConfig: { hairColor: "blue", topStyle: "vintage", accessory: "earphone" } },
];

/* ─── 헤어컬러 스와치 색 매핑 ─── */

const HAIR_COLOR_HEX: Record<AvatarHairColor, string> = {
  black: "#1A1A1A",
  brown: "#7B4F2E",
  blonde: "#F5C842",
  red: "#C0392B",
  pink: "#F48FB1",
  blue: "#4DABF7",
  green: "#2ECC71",
  white: "#EEEEEE",
};

const HAIR_COLOR_LABELS: Record<AvatarHairColor, string> = {
  black: "검정", brown: "갈색", blonde: "금색", red: "빨강",
  pink: "핑크", blue: "파랑", green: "초록", white: "흰색",
};

const TOP_STYLE_LABELS: Record<AvatarTopStyle, string> = {
  "white-top": "흰티", stripe: "줄무늬", hoodie: "후드",
  uniform: "교복", casual: "캐주얼", formal: "정장",
  sport: "스포츠", vintage: "빈티지",
};

const ACCESSORY_LABELS: Record<AvatarAccessory, string> = {
  glasses: "안경", hat: "모자", earphone: "이어폰", none: "없음",
};

/* ─── Props ─── */

export interface AvatarSelectorProps {
  value: Pick<AvatarConfig, "hairColor" | "topStyle" | "accessory"> & { preset?: string };
  onChange: (
    next: Pick<AvatarConfig, "hairColor" | "topStyle" | "accessory"> & { preset?: string }
  ) => void;
  className?: string;
}

/* ─── 컴포넌트 ─── */

export function AvatarSelector({ value, onChange, className }: AvatarSelectorProps) {
  const [showCustomizer, setShowCustomizer] = React.useState(false);

  const selectPreset = (preset: AvatarPreset) => {
    onChange({ preset: preset.key, ...preset.defaultConfig });
    setShowCustomizer(true);
  };

  const updateField = <K extends keyof typeof value>(key: K, val: (typeof value)[K]) => {
    onChange({ ...value, [key]: val });
  };

  return (
    <div className={cn("flex flex-col gap-5", className)}>
      {/* 아바타 프리셋 그리드 — 2열 × 4행 */}
      <div
        role="radiogroup"
        aria-label="아바타 선택"
        className="grid grid-cols-2 gap-3"
      >
        {AVATAR_PRESETS.map((preset) => {
          const isSelected = value.preset === preset.key;
          return (
            <button
              key={preset.key}
              type="button"
              role="radio"
              aria-checked={isSelected}
              onClick={() => selectPreset(preset)}
              className={cn(
                "flex flex-col items-center justify-center gap-2",
                "p-3 rounded-xl border-2 border-[var(--color-line)]",
                "min-h-[72px] w-full",
                "transition-[transform,box-shadow] duration-150 ease-out",
                "focus-visible:outline-none focus-visible:shadow-[var(--shadow-focus)]",
                isSelected
                  ? "bg-[var(--color-primary-subtle)] shadow-[var(--shadow-pop)] -translate-x-px -translate-y-px"
                  : "bg-[var(--color-surface-raised)] shadow-[var(--shadow-pop-xs)] hover:-translate-x-px hover:-translate-y-px hover:shadow-[var(--shadow-pop-sm)]",
                "active:translate-x-[2px] active:translate-y-[2px] active:shadow-[var(--shadow-pop-xs)]",
              )}
            >
              {/* 아바타 썸네일 플레이스홀더 (실제 SVG 에셋은 W2~W3 디자인 팀 전달 예정) */}
              <div
                aria-hidden="true"
                className={cn(
                  "relative h-10 w-10 rounded-full flex items-center justify-center",
                  "border-2 border-[var(--color-line)]",
                  "text-lg overflow-hidden",
                  isSelected
                    ? "bg-[var(--color-primary)]"
                    : "bg-[var(--color-bg-muted)]"
                )}
              >
                <span className="tone-dots absolute inset-0 text-[var(--color-text-muted)] opacity-20" />
                {/* SVG 에셋 수령 후 <img src={avatarSvg} /> 교체 예정 */}
                <span aria-hidden="true" className="relative">
                  {["👧", "👩", "👦", "🧑", "👧", "🧓", "🧒", "🧑"][AVATAR_PRESETS.indexOf(preset)]}
                </span>
              </div>
              <span className="font-heading text-xs text-[var(--color-text-secondary)]">
                {preset.label}
              </span>
            </button>
          );
        })}
      </div>

      {/* 커스터마이저 — 아바타 선택 후 표시 */}
      {showCustomizer && (
        <div className="flex flex-col gap-4 border-t-2 border-[var(--color-border-subtle)] pt-4">
          <h3 className="font-heading text-sm text-[var(--color-text-primary)]">캐릭터 꾸미기</h3>

          {/* 헤어 컬러 */}
          <div className="flex flex-col gap-2">
            <span className="font-heading text-xs text-[var(--color-text-secondary)]">머리 색</span>
            <div
              role="radiogroup"
              aria-label="머리 색 선택"
              className="flex gap-2 overflow-x-auto pb-1"
            >
              {AVATAR_HAIR_COLORS.map((color) => {
                const isSelected = value.hairColor === color;
                return (
                  <button
                    key={color}
                    type="button"
                    role="radio"
                    aria-checked={isSelected}
                    aria-label={HAIR_COLOR_LABELS[color]}
                    onClick={() => updateField("hairColor", color)}
                    className={cn(
                      "flex-shrink-0",
                      "min-h-[44px] min-w-[44px]",
                      "flex items-center justify-center",
                      "transition-[transform,box-shadow] duration-150 ease-out",
                      "focus-visible:outline-none focus-visible:shadow-[var(--shadow-focus)]",
                      isSelected
                        ? "-translate-x-px -translate-y-px"
                        : "hover:-translate-x-px hover:-translate-y-px"
                    )}
                  >
                    <span
                      aria-hidden="true"
                      className={cn(
                        "h-6 w-6 rounded-full block",
                        "border-2 border-[var(--color-line)]",
                        isSelected
                          ? "shadow-[var(--shadow-pop-sm)]"
                          : "shadow-[var(--shadow-pop-xs)]"
                      )}
                      style={{ backgroundColor: HAIR_COLOR_HEX[color] }}
                    />
                  </button>
                );
              })}
            </div>
          </div>

          {/* 상의 스타일 */}
          <div className="flex flex-col gap-2">
            <span className="font-heading text-xs text-[var(--color-text-secondary)]">상의</span>
            <div
              role="radiogroup"
              aria-label="상의 스타일 선택"
              className="flex flex-wrap gap-2"
            >
              {AVATAR_TOP_STYLES.map((top) => {
                const isSelected = value.topStyle === top;
                return (
                  <button
                    key={top}
                    type="button"
                    role="radio"
                    aria-checked={isSelected}
                    onClick={() => updateField("topStyle", top)}
                    className={cn(
                      "px-3 h-8 rounded-full font-heading text-xs",
                      "border-2 border-[var(--color-line)]",
                      "transition-[transform,box-shadow] duration-150 ease-out",
                      "focus-visible:outline-none focus-visible:shadow-[var(--shadow-focus)]",
                      isSelected
                        ? "bg-[var(--color-primary)] text-[var(--color-primary-text)] shadow-[var(--shadow-pop-sm)]"
                        : "bg-[var(--color-surface-raised)] text-[var(--color-text-secondary)] shadow-[var(--shadow-pop-xs)] hover:-translate-y-px hover:shadow-[var(--shadow-pop-sm)]",
                      "active:translate-y-[2px] active:shadow-[var(--shadow-pop-xs)]",
                    )}
                  >
                    {TOP_STYLE_LABELS[top]}
                  </button>
                );
              })}
            </div>
          </div>

          {/* 액세서리 */}
          <div className="flex flex-col gap-2">
            <span className="font-heading text-xs text-[var(--color-text-secondary)]">액세서리</span>
            <div
              role="radiogroup"
              aria-label="액세서리 선택"
              className="flex gap-2 flex-wrap"
            >
              {AVATAR_ACCESSORIES.map((acc) => {
                const isSelected = value.accessory === acc;
                const icons: Record<AvatarAccessory, string> = {
                  glasses: "👓", hat: "🧢", earphone: "🎧", none: "✕",
                };
                return (
                  <button
                    key={acc}
                    type="button"
                    role="radio"
                    aria-checked={isSelected}
                    aria-label={ACCESSORY_LABELS[acc]}
                    onClick={() => updateField("accessory", acc)}
                    className={cn(
                      "flex flex-col items-center justify-center gap-1",
                      "min-h-[44px] min-w-[44px] px-3",
                      "rounded-xl border-2 border-[var(--color-line)] text-sm",
                      "transition-[transform,box-shadow] duration-150 ease-out",
                      "focus-visible:outline-none focus-visible:shadow-[var(--shadow-focus)]",
                      isSelected
                        ? "bg-[var(--color-primary-subtle)] shadow-[var(--shadow-pop-sm)] -translate-x-px -translate-y-px"
                        : "bg-[var(--color-surface-raised)] shadow-[var(--shadow-pop-xs)] hover:-translate-x-px hover:-translate-y-px hover:shadow-[var(--shadow-pop-sm)]",
                      "active:translate-x-[2px] active:translate-y-[2px] active:shadow-[var(--shadow-pop-xs)]",
                    )}
                  >
                    <span aria-hidden="true">{icons[acc]}</span>
                    <span className="font-heading text-[10px] text-[var(--color-text-secondary)]">
                      {ACCESSORY_LABELS[acc]}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export { DEFAULT_AVATAR };
