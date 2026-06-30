// REDLINE: 외모/체형 비교 UI 금지. 타인 점수 노출 금지.

"use client";

import * as React from "react";
import * as RadixSlider from "@radix-ui/react-slider";
import { cn } from "@/lib/utils";
import { colors, type AxisKey } from "@/components/tokens/colors";

// ── 4축 컬러 매핑 ────────────────────────────────────────────────────
const AXIS_COLOR: Record<AxisKey, { track: string; thumb: string; border: string }> = {
  health: {
    track: colors.health[500],
    thumb: colors.health[500],
    border: colors.health[500],
  },
  learn: {
    track: colors.learn[500],
    thumb: colors.learn[500],
    border: colors.learn[500],
  },
  relate: {
    // C2: 마젠타 #C7307D
    track: colors.relate[500],
    thumb: colors.relate[500],
    border: colors.relate[500],
  },
  achieve: {
    track: colors.achieve[500],
    thumb: colors.achieve[500],
    border: colors.achieve[500],
  },
};

// ── 4축 아이콘/레이블 보조 (색약 대응) ─────────────────────────────────
/** 축별 모양 기호 — 색약 보조 텍스트 기호 (ui-spec.md §5) */
const AXIS_SHAPE: Record<AxisKey, string> = {
  health: "○", // 원형 외곽
  learn: "□",  // 사각형 외곽
  relate: "◇", // 마름모 외곽
  achieve: "△", // 삼각형 외곽 (산 메타포)
};

// ── Props 인터페이스 ──────────────────────────────────────────────────
export interface CheckinSliderProps {
  /** 체크인 축 */
  axis: AxisKey;
  /** 축 한글 레이블 (색약 보조용) */
  label: string;
  /** 현재 값 0~100 */
  value: number;
  /** 값 변경 핸들러 */
  onValueChange: (value: number) => void;
  /** 슬라이더 비활성 */
  disabled?: boolean;
  className?: string;
  /** 보조 설명 텍스트 (선택) */
  description?: string;
}

// ── 메인 컴포넌트 ────────────────────────────────────────────────────
/**
 * 오름 CheckinSlider 컴포넌트 — 4축 체크인 슬라이더
 *
 * 0~100 범위. 각 축 컬러 토큰 자동 적용.
 * 색약 대응: 컬러 + 모양 기호 + 텍스트 레이블 3중 표기 (ui-spec.md §8)
 * 터치 타겟 thumb ≥ 44×44px (design-final.md §4-3)
 *
 * @example
 * <CheckinSlider
 *   axis="health"
 *   label="건강"
 *   value={75}
 *   onValueChange={(v) => setHealth(v)}
 * />
 */
const CheckinSlider = React.forwardRef<HTMLDivElement, CheckinSliderProps>(
  (
    {
      axis,
      label,
      value,
      onValueChange,
      disabled = false,
      className,
      description,
      ...props
    },
    ref
  ) => {
    const axisColor = AXIS_COLOR[axis];
    const shapeSymbol = AXIS_SHAPE[axis];
    const sliderId = React.useId();

    return (
      <div
        ref={ref}
        className={cn("flex flex-col gap-2", className)}
        {...props}
      >
        {/* ── 레이블 행 — 축 이름(label) 좌측 + 현재값(h4) 우측 (ui-spec.md §3-3) ── */}
        <div className="flex items-baseline justify-between">
          <div className="flex items-center gap-1.5">
            {/* 색약 보조 모양 기호 */}
            <span
              className="text-[13px] font-medium leading-[1.4]"
              style={{ color: axisColor.track }}
              aria-hidden="true"
            >
              {shapeSymbol}
            </span>
            {/* 레이블 — label 13px/500 */}
            <label
              htmlFor={sliderId}
              className="text-[13px] font-medium leading-[1.4] text-gray-700 cursor-pointer"
            >
              {label}
            </label>
          </div>

          {/* 현재값 — h4 17px/600 */}
          <span
            className="text-[17px] font-semibold leading-[1.5] tabular-nums"
            style={{ color: axisColor.track }}
            aria-hidden="true"
          >
            {value}
          </span>
        </div>

        {/* ── Radix Slider ── */}
        <RadixSlider.Root
          id={sliderId}
          min={0}
          max={100}
          step={1}
          value={[value]}
          onValueChange={([v]) => onValueChange(v)}
          disabled={disabled}
          aria-label={`${label} 점수 ${value}점`}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={value}
          aria-valuetext={`${label} ${value}점`}
          className={cn(
            "relative flex items-center select-none touch-none w-full",
            // 터치 타겟 높이 44px 확보
            "h-11",
            disabled && "opacity-[0.38] cursor-not-allowed"
          )}
        >
          {/* Track */}
          <RadixSlider.Track
            className="relative grow h-1.5 rounded-full overflow-hidden"
            style={{ backgroundColor: "#E5E7EB" }} // gray-200
          >
            {/* Fill — 해당 축 컬러-500 */}
            <RadixSlider.Range
              className="absolute h-full rounded-full transition-all duration-fast"
              style={{ backgroundColor: axisColor.track }}
            />
          </RadixSlider.Track>

          {/* Thumb — 20px 원, surface-card 배경, 축 컬러 테두리 2px, shadow-md */}
          {/* 터치 타겟은 44×44px (padding으로 확장) */}
          <RadixSlider.Thumb
            className={cn(
              "block w-5 h-5 rounded-full bg-white shadow-md",
              "border-2 transition-all duration-fast",
              // 포커스 링
              "focus-visible:outline-none focus-visible:ring-0",
              "focus-visible:shadow-[0_0_0_3px_rgba(255,122,41,0.5)]",
              // 터치 타겟 확보 (padding)
              "p-[12px] -m-[12px]",
              "cursor-grab active:cursor-grabbing"
            )}
            style={{ borderColor: axisColor.border }}
            aria-label={`${label} 조절`}
          />
        </RadixSlider.Root>

        {/* 보조 설명 */}
        {description && (
          <p className="text-[12px] text-gray-500 leading-[1.5]" id={`${sliderId}-desc`}>
            {description}
          </p>
        )}
      </div>
    );
  }
);

CheckinSlider.displayName = "CheckinSlider";

// ── 4축 체크인 그룹 컴포넌트 (편의용) ──────────────────────────────────
export interface CheckinFormValues {
  health: number;
  learn: number;
  relate: number;
  achieve: number;
}

export interface CheckinSliderGroupProps {
  values: CheckinFormValues;
  onValueChange: (axis: AxisKey, value: number) => void;
  disabled?: boolean;
  className?: string;
}

/**
 * 4축 체크인 슬라이더 그룹 — Home 체크인 화면 전용
 *
 * @example
 * <CheckinSliderGroup
 *   values={{ health: 75, learn: 60, relate: 80, achieve: 70 }}
 *   onValueChange={(axis, v) => update(axis, v)}
 * />
 */
const CheckinSliderGroup = React.forwardRef<HTMLDivElement, CheckinSliderGroupProps>(
  ({ values, onValueChange, disabled, className, ...props }, ref) => {
    const axes: Array<{ axis: AxisKey; label: string }> = [
      { axis: "health", label: "건강" },
      { axis: "learn", label: "학습" },
      { axis: "relate", label: "관계" },
      { axis: "achieve", label: "성취" },
    ];

    return (
      <div
        ref={ref}
        className={cn("flex flex-col gap-5", className)}
        role="group"
        aria-label="4축 자기개선 체크인"
        {...props}
      >
        {axes.map(({ axis, label }) => (
          <CheckinSlider
            key={axis}
            axis={axis}
            label={label}
            value={values[axis]}
            onValueChange={(v) => onValueChange(axis, v)}
            disabled={disabled}
          />
        ))}
      </div>
    );
  }
);

CheckinSliderGroup.displayName = "CheckinSliderGroup";

export { CheckinSlider, CheckinSliderGroup };
