// REDLINE: 외모/체형 비교 UI 금지. 타인 점수 노출 금지.

"use client";

import * as React from "react";
import { motion, useMotionValue, useTransform, animate } from "framer-motion";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";
import { cn } from "@/lib/utils";
import { colors, type AxisKey } from "@/components/tokens/colors";

// ── 4축 미니 막대 타입 ────────────────────────────────────────────────
export interface AxisScore {
  /** 축 키 */
  axis: AxisKey;
  /** 0~100 점수 */
  value: number;
  /** 축 한글 레이블 (색약 보조) */
  label: string;
}

// ── Props 인터페이스 ──────────────────────────────────────────────────
export interface ScoreDisplayProps {
  /** 총점 (0~100) */
  score: number;
  /** 이전 대비 변화량 (양수=+, 음수=-, undefined=첫 기록) */
  delta?: number;
  /** 4축 미니 막대 데이터 */
  axes?: AxisScore[];
  /** 카운트업 애니메이션 비활성화 (prefers-reduced-motion 또는 SSR) */
  skipAnimation?: boolean;
  className?: string;
  /** aria-label 오버라이드 */
  ariaLabel?: string;
}

// ── 4축 컬러 매핑 ────────────────────────────────────────────────────
const AXIS_COLOR: Record<AxisKey, string> = {
  health: colors.health[500],
  learn: colors.learn[500],
  relate: colors.relate[500],
  achieve: colors.achieve[500],
};

// ── 4축 미니 막대 ────────────────────────────────────────────────────
const AxisMiniBar: React.FC<{ axis: AxisScore }> = ({ axis }) => {
  const barColor = AXIS_COLOR[axis.axis];
  return (
    <div className="flex flex-col items-center gap-0.5" aria-label={`${axis.label} ${axis.value}점`}>
      {/* 막대 컨테이너 */}
      <div
        className="w-1.5 bg-gray-200 rounded-full overflow-hidden"
        style={{ height: 32 }}
        role="img"
        aria-hidden="true"
      >
        <motion.div
          className="w-full rounded-full origin-bottom"
          style={{ backgroundColor: barColor }}
          initial={{ height: "0%" }}
          animate={{ height: `${axis.value}%` }}
          transition={{
            duration: 0.6,
            ease: [0, 0, 0.2, 1],
            delay: 0.4,
          }}
        />
      </div>
      {/* 레이블 — 색약 보조 텍스트 */}
      <span className="text-[9px] text-gray-500 font-medium leading-none">
        {axis.label.slice(0, 2)}
      </span>
    </div>
  );
};

// ── 카운트업 숫자 ────────────────────────────────────────────────────
const AnimatedScore: React.FC<{ target: number; skip: boolean }> = ({
  target,
  skip,
}) => {
  const count = useMotionValue(skip ? target : 0);
  const rounded = useTransform(count, (v) => Math.round(v));

  React.useEffect(() => {
    if (skip) {
      count.set(target);
      return;
    }
    const controls = animate(count, target, {
      duration: 0.6,
      ease: [0, 0, 0.2, 1], // ease-out (ui-spec.md §4-1)
    });
    return () => controls.stop();
  }, [target, skip, count]);

  return (
    <motion.span className="tabular-nums" aria-hidden="true">
      {rounded}
    </motion.span>
  );
};

// ── 변화량 표시 ────────────────────────────────────────────────────
const DeltaBadge: React.FC<{ delta: number }> = ({ delta }) => {
  const isPositive = delta > 0;
  const isNeutral = delta === 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{
        delay: 0.7, // 카운트업 완료(0.6s) + 100ms (ui-spec.md §4-1)
        duration: 0.2,
        ease: [0, 0, 0.2, 1],
      }}
      className={cn(
        "flex items-center gap-0.5 text-body-s font-medium",
        isNeutral && "text-gray-400",
        isPositive && "text-[#2E9E55]",
        !isPositive && !isNeutral && "text-[#DC2626]"
      )}
      aria-label={`변화량 ${delta > 0 ? "+" : ""}${delta.toFixed(1)}`}
    >
      {isNeutral ? (
        <Minus size={16} aria-hidden="true" />
      ) : isPositive ? (
        <TrendingUp size={16} aria-hidden="true" />
      ) : (
        <TrendingDown size={16} aria-hidden="true" />
      )}
      <span className="tabular-nums text-[14px]">
        {isPositive ? "+" : ""}
        {delta.toFixed(1)}
      </span>
    </motion.div>
  );
};

// ── 메인 컴포넌트 ────────────────────────────────────────────────────
/**
 * 오름 ScoreDisplay 컴포넌트 — 시그니처
 *
 * 총점 카운트업(0.6s) + 변화량 델타 + 4축 미니 막대
 * design-final.md D1: 홈=총점+미니 막대 (Graph=레이더는 별도)
 *
 * @example
 * <ScoreDisplay
 *   score={72}
 *   delta={3.2}
 *   axes={[
 *     { axis: "health", value: 80, label: "건강" },
 *     { axis: "learn",  value: 65, label: "학습" },
 *     { axis: "relate", value: 70, label: "관계" },
 *     { axis: "achieve",value: 75, label: "성취" },
 *   ]}
 * />
 */
const ScoreDisplay = React.forwardRef<HTMLDivElement, ScoreDisplayProps>(
  (
    {
      score,
      delta,
      axes = [],
      skipAnimation = false,
      className,
      ariaLabel,
      ...props
    },
    ref
  ) => {
    // prefers-reduced-motion 대응 (design-final.md §4-3)
    const [prefersReduced, setPrefersReduced] = React.useState(false);
    React.useEffect(() => {
      const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
      setPrefersReduced(mq.matches);
    }, []);

    const shouldSkip = skipAnimation || prefersReduced;

    return (
      <div
        ref={ref}
        role="region"
        aria-label={ariaLabel ?? `오름 점수 ${score}점`}
        className={cn("flex items-end gap-3", className)}
        {...props}
      >
        {/* ── 좌측: 총점 블록 ── */}
        <div className="flex items-baseline gap-1">
          {/* 점수 숫자 — h1 32px/700 (ui-spec.md §3-9) */}
          <span
            className="text-[32px] font-bold leading-[1.3] tracking-[-0.01em] text-primary-800 dark:text-white tabular-nums"
            aria-live="polite"
            aria-atomic="true"
          >
            <AnimatedScore target={score} skip={shouldSkip} />
          </span>
          {/* 단위 — body-s 14px gray-500 (ui-spec.md §3-9) */}
          <span className="text-[14px] text-gray-500 leading-[1.6] mb-0.5" aria-hidden="true">
            점
          </span>
        </div>

        {/* ── 우측: 변화량 + 4축 미니 막대 ── */}
        <div className="flex flex-col items-start gap-2 pb-0.5">
          {delta !== undefined && <DeltaBadge delta={delta} />}

          {/* 4축 미니 막대 — 색약 보조: 컬러+레이블 병행 */}
          {axes.length > 0 && (
            <div
              className="flex items-end gap-1.5"
              role="group"
              aria-label="4축 점수"
            >
              {axes.map((a) => (
                <AxisMiniBar key={a.axis} axis={a} />
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }
);

ScoreDisplay.displayName = "ScoreDisplay";

export { ScoreDisplay };
