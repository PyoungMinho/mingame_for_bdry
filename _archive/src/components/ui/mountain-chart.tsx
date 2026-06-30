// REDLINE: 외모/체형 비교 UI 금지. 타인 점수 노출 금지.

"use client";

import * as React from "react";
import { motion, useAnimationControls } from "framer-motion";
import { cn } from "@/lib/utils";
import { colors, type AxisKey } from "@/components/tokens/colors";

// ── 타입 ─────────────────────────────────────────────────────────────
export interface ChartDataPoint {
  /** ISO 날짜 문자열 또는 레이블 */
  date: string;
  /** 점수 0~100 */
  value: number;
}

export interface ChartSeries {
  axis: AxisKey | "total";
  label: string;
  data: ChartDataPoint[];
  /** 컬러 오버라이드 — 기본값은 axis 컬러 */
  color?: string;
}

export interface MountainChartProps {
  series: ChartSeries[];
  /** 활성화된 축 키 목록 */
  activeAxes?: Array<AxisKey | "total">;
  /** 차트 높이 (px) */
  height?: number;
  /** 라인 드로우 모션 비활성 */
  skipAnimation?: boolean;
  className?: string;
  /** 그리드 라인 갯수 */
  gridLines?: number;
}

// ── 컬러 헬퍼 ────────────────────────────────────────────────────────
const AXIS_COLOR: Record<string, string> = {
  health: colors.health[500],
  learn: colors.learn[500],
  relate: colors.relate[500],
  achieve: colors.achieve[500],
  total: colors.accent[500],
};

function getSeriesColor(series: ChartSeries): string {
  return series.color ?? AXIS_COLOR[series.axis] ?? colors.accent[500];
}

// ── SVG 경로 계산 ────────────────────────────────────────────────────
function buildLinePath(
  points: { x: number; y: number }[]
): string {
  if (points.length === 0) return "";
  return points
    .map((p, i) => `${i === 0 ? "M" : "L"} ${p.x.toFixed(2)} ${p.y.toFixed(2)}`)
    .join(" ");
}

function buildAreaPath(
  points: { x: number; y: number }[],
  chartHeight: number
): string {
  if (points.length === 0) return "";
  const linePath = buildLinePath(points);
  const lastX = points[points.length - 1].x.toFixed(2);
  const firstX = points[0].x.toFixed(2);
  return `${linePath} L ${lastX} ${chartHeight} L ${firstX} ${chartHeight} Z`;
}

function dataToPoints(
  data: ChartDataPoint[],
  width: number,
  height: number,
  paddingV = 16
): { x: number; y: number }[] {
  if (data.length === 0) return [];
  const maxVal = 100;
  const minVal = 0;
  const xStep = width / Math.max(data.length - 1, 1);
  return data.map((d, i) => ({
    x: i * xStep,
    y:
      paddingV +
      ((maxVal - d.value) / (maxVal - minVal)) * (height - paddingV * 2),
  }));
}

// ── 단일 시리즈 라인 ──────────────────────────────────────────────────
const ChartLine: React.FC<{
  series: ChartSeries;
  width: number;
  height: number;
  skip: boolean;
  index: number;
}> = ({ series, width, height, skip, index }) => {
  const color = getSeriesColor(series);
  const points = dataToPoints(series.data, width, height);
  const linePath = buildLinePath(points);
  const areaPath = buildAreaPath(points, height);

  // SVG pathLength 기반 stroke-dashoffset 트윈 (ui-spec.md §4-2)
  const lineRef = React.useRef<SVGPathElement>(null);
  const [pathLen, setPathLen] = React.useState(0);
  const areaControls = useAnimationControls();

  React.useEffect(() => {
    if (lineRef.current) {
      setPathLen(lineRef.current.getTotalLength());
    }
  }, [linePath]);

  // 라인 드로우 완료 후 영역 Fill 페이드인 (ui-spec.md §4-2)
  React.useEffect(() => {
    if (skip || pathLen === 0) {
      areaControls.set({ opacity: 0.15 });
      return;
    }
    const timer = setTimeout(() => {
      areaControls.start({
        opacity: 0.15,
        transition: { duration: 0.4, ease: [0, 0, 0.2, 1] },
      });
    }, 1200 + 200); // 라인 드로우(1.2s) + 200ms
    return () => clearTimeout(timer);
  }, [pathLen, skip, areaControls]);

  const gradientId = `area-gradient-${series.axis}-${index}`;

  return (
    <g>
      {/* 영역 그라디언트 정의 */}
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="1" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>

      {/* 영역 Fill — 라인 완료 후 200ms 딜레이 페이드인 */}
      <motion.path
        d={areaPath}
        fill={`url(#${gradientId})`}
        initial={{ opacity: 0 }}
        animate={areaControls}
      />

      {/* 라인 — stroke-dashoffset pathLength 트윈 */}
      <motion.path
        ref={lineRef}
        d={linePath}
        fill="none"
        stroke={color}
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        initial={skip ? {} : { strokeDasharray: pathLen, strokeDashoffset: pathLen }}
        animate={skip ? {} : { strokeDashoffset: 0 }}
        transition={
          skip
            ? {}
            : {
                duration: 1.2,
                ease: [0.42, 0, 0.18, 1.0], // ui-spec.md §4-2
                delay: index * 0.1, // 다중 라인 순차 등장
              }
        }
      />

      {/* 데이터포인트 — hover 시 원형 표시 (기본 숨김) */}
      {points.map((pt, i) => (
        <circle
          key={i}
          cx={pt.x}
          cy={pt.y}
          r={4}
          fill={color}
          className="opacity-0 hover:opacity-100 transition-opacity duration-fast cursor-pointer"
          role="img"
          aria-label={`${series.data[i]?.date} ${series.data[i]?.value}점`}
        />
      ))}
    </g>
  );
};

// ── 메인 컴포넌트 ────────────────────────────────────────────────────
/**
 * 오름 MountainChart 컴포넌트 — 시그니처
 *
 * SVG 산 능선 라인 차트. stroke-dashoffset 1.2s 드로우 모션.
 * design-final.md D1: Graph 화면 전용 (홈=ScoreDisplay 미니 막대)
 *
 * @example
 * <MountainChart
 *   series={[{ axis: "total", label: "총점", data: [...] }]}
 *   activeAxes={["total"]}
 *   height={200}
 * />
 */
const MountainChart = React.forwardRef<HTMLDivElement, MountainChartProps>(
  (
    {
      series,
      activeAxes,
      height = 200,
      skipAnimation = false,
      className,
      gridLines = 4,
      ...props
    },
    ref
  ) => {
    const containerRef = React.useRef<HTMLDivElement>(null);
    const [width, setWidth] = React.useState(335); // 기본 375px 기준 콘텐츠 폭

    // prefers-reduced-motion 대응
    const [prefersReduced, setPrefersReduced] = React.useState(false);
    React.useEffect(() => {
      const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
      setPrefersReduced(mq.matches);
    }, []);

    // 반응형 너비 감지
    React.useEffect(() => {
      if (!containerRef.current) return;
      const observer = new ResizeObserver(([entry]) => {
        setWidth(entry.contentRect.width);
      });
      observer.observe(containerRef.current);
      return () => observer.disconnect();
    }, []);

    const shouldSkip = skipAnimation || prefersReduced;
    const filteredSeries = activeAxes
      ? series.filter((s) => activeAxes.includes(s.axis))
      : series;

    // 수평 그리드 라인 Y 위치 계산
    const gridYPositions = Array.from({ length: gridLines + 1 }, (_, i) =>
      (i / gridLines) * height
    );

    return (
      <div
        ref={(node) => {
          containerRef.current = node;
          if (typeof ref === "function") ref(node);
          else if (ref) ref.current = node;
        }}
        className={cn("w-full", className)}
        role="img"
        aria-label="오름 점수 추이 차트"
        {...props}
      >
        <svg
          width="100%"
          height={height}
          viewBox={`0 0 ${width} ${height}`}
          preserveAspectRatio="none"
          className="overflow-visible"
        >
          {/* 수평 그리드 라인 (수직선 없음 — ui-spec.md §3-12) */}
          {gridYPositions.map((y, i) => (
            <line
              key={i}
              x1={0}
              y1={y}
              x2={width}
              y2={y}
              stroke="#F3F4F6" // gray-100
              strokeWidth="1"
              aria-hidden="true"
            />
          ))}

          {/* 시리즈 라인 렌더 */}
          {filteredSeries.map((s, i) => (
            <ChartLine
              key={s.axis}
              series={s}
              width={width}
              height={height}
              skip={shouldSkip}
              index={i}
            />
          ))}
        </svg>

        {/* 축 레이블 — caption 12px gray-500 */}
        {filteredSeries.length > 0 && filteredSeries[0].data.length > 0 && (
          <div className="flex justify-between mt-1 px-0">
            <span className="text-[12px] text-gray-500 leading-[1.5]">
              {filteredSeries[0].data[0].date}
            </span>
            <span className="text-[12px] text-gray-500 leading-[1.5]">
              {filteredSeries[0].data[filteredSeries[0].data.length - 1]?.date}
            </span>
          </div>
        )}
      </div>
    );
  }
);

MountainChart.displayName = "MountainChart";

export { MountainChart };
