// REDLINE: 타인 비교/외모 점수 UI 금지
// 그래프: 본인 과거치만 표시. "전체 사용자 평균" / "동년배 비교" 데이터 패치 차단 (client.ts 화이트리스트)
"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { fetchScoreHistory, MOCK_SCORE_HISTORY } from "@/lib/api/score";
import type { HistoryPeriod } from "@/lib/shared/schemas";

// ---------------------------------------------------------------------------
// 그래프 페이지 — 7/30/90일 산 능선 차트
// REDLINE: 본인 과거치만. 타인 비교 금지.
// ---------------------------------------------------------------------------

const PERIODS: { value: HistoryPeriod; label: string }[] = [
  { value: "7", label: "7일" },
  { value: "30", label: "30일" },
  { value: "90", label: "90일" },
];

// 4축 SVG 라인차트 메타
const AXIS_LINES = [
  { key: "health", label: "건강", color: "#2E9E55", shape: "●", strokeDash: "" },
  { key: "learning", label: "학습", color: "#2563EB", shape: "■", strokeDash: "6,3" },
  { key: "relation", label: "관계", color: "#C7307D", shape: "▲", strokeDash: "3,3" },
  { key: "achievement", label: "성취", color: "#EAB308", shape: "◆", strokeDash: "8,2,2,2" },
] as const;

// ---------------------------------------------------------------------------
// 산 능선 SVG 라인차트 (P1 컴포넌트 스텁 — W5+ 정교화)
// ---------------------------------------------------------------------------

interface MiniLineChartProps {
  data: Array<{ date: string; score: Record<string, number> }>;
  period: HistoryPeriod;
}

function MountainLineChart({ data, period }: MiniLineChartProps) {
  if (data.length === 0) return null;

  const WIDTH = 335;
  const HEIGHT = 160;
  const PADDING = { top: 8, bottom: 24, left: 4, right: 4 };

  const chartWidth = WIDTH - PADDING.left - PADDING.right;
  const chartHeight = HEIGHT - PADDING.top - PADDING.bottom;

  function toSvgPath(axisKey: string): string {
    const points = data.map((d, i) => {
      const x = PADDING.left + (i / Math.max(data.length - 1, 1)) * chartWidth;
      const val = (d.score as Record<string, number>)[axisKey] ?? 50;
      const y = PADDING.top + chartHeight - (val / 100) * chartHeight;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    });
    return `M ${points.join(" L ")}`;
  }

  // X축 레이블 (기간에 따라 샘플링)
  const xLabels: Array<{ label: string; x: number }> = (() => {
    const step = Math.max(1, Math.floor(data.length / 6));
    return data
      .filter((_, i) => i % step === 0 || i === data.length - 1)
      .map((d, _, arr) => {
        const idx = data.findIndex((p) => p.date === d.date);
        const x = PADDING.left + (idx / Math.max(data.length - 1, 1)) * chartWidth;
        const label = d.date.slice(5); // MM-DD
        return { label, x };
      });
  })();

  return (
    <div aria-label={`${period}일 성장 그래프`}>
      <svg
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        className="w-full"
        role="img"
        aria-describedby="chart-desc"
      >
        <desc id="chart-desc">
          최근 {period}일간 4축(건강·학습·관계·성취) 점수 추이 그래프
        </desc>

        {/* 그리드 라인 */}
        {[25, 50, 75].map((pct) => {
          const y = PADDING.top + chartHeight - (pct / 100) * chartHeight;
          return (
            <line
              key={pct}
              x1={PADDING.left}
              y1={y}
              x2={WIDTH - PADDING.right}
              y2={y}
              stroke="#E5E7EB"
              strokeWidth="1"
              aria-hidden="true"
            />
          );
        })}

        {/* 4축 라인 */}
        {AXIS_LINES.map(({ key, color, strokeDash }) => (
          <path
            key={key}
            d={toSvgPath(key)}
            fill="none"
            stroke={color}
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeDasharray={strokeDash}
          />
        ))}

        {/* X축 레이블 */}
        {xLabels.map(({ label, x }) => (
          <text
            key={label}
            x={x}
            y={HEIGHT - 4}
            textAnchor="middle"
            fontSize="10"
            fill="#9CA3AF"
            aria-hidden="true"
          >
            {label}
          </text>
        ))}
      </svg>

      {/* 범례 — 컬러 + 모양 병행 (design-final.md §7-C 색약 대응) */}
      <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2" aria-label="그래프 범례">
        {AXIS_LINES.map(({ key, label, color, shape }) => (
          <div key={key} className="flex items-center gap-1">
            <span style={{ color }} className="text-label font-bold" aria-hidden="true">
              {shape}
            </span>
            <span className="text-caption text-gray-500">{label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// 이번 달 하이라이트
// ---------------------------------------------------------------------------

function MonthHighlight({ data }: { data: Array<{ date: string; score: Record<string, number> }> }) {
  if (data.length < 3) return null;

  // 최고 총점 날짜 계산 (본인 과거치만)
  const bestDay = data.reduce((prev, curr) =>
    ((curr.score as Record<string, number>)["total"] ?? 0) >
    ((prev.score as Record<string, number>)["total"] ?? 0)
      ? curr
      : prev
  );
  const bestScore = (bestDay.score as Record<string, number>)["total"] ?? 0;

  return (
    <div className="rounded-xl bg-primary-50 border border-primary-100 p-4">
      <p className="text-caption text-primary-500 font-medium mb-1">이번 달 하이라이트</p>
      <p className="text-body-m font-semibold text-primary-800">
        {bestDay.date.slice(5).replace("-", "/")} 최고 기록 {bestScore}점 달성!
      </p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// 빈 상태 (데이터 부족)
// ---------------------------------------------------------------------------

function EmptyGraph() {
  return (
    <div className="flex flex-col items-center gap-4 py-12 text-center">
      <div
        className="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center"
        aria-hidden="true"
      >
        <svg
          width="28"
          height="28"
          viewBox="0 0 24 24"
          fill="none"
          stroke="#9CA3AF"
          strokeWidth="2"
        >
          <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
        </svg>
      </div>
      <div className="flex flex-col gap-1">
        <p className="text-body-m font-semibold text-primary-800">
          데이터가 쌓이는 중이에요
        </p>
        <p className="text-body-s text-gray-500">3일 후 그래프가 나타납니다.</p>
      </div>
      <Button asChild variant="primary" size="md">
        <a href="/home">체크인 하러 가기</a>
      </Button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// 메인 컴포넌트
// ---------------------------------------------------------------------------

export default function GraphPage() {
  const [period, setPeriod] = useState<HistoryPeriod>("7");

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["score", "history", period],
    queryFn: () => fetchScoreHistory(period),
    placeholderData: MOCK_SCORE_HISTORY[period],
  });

  const points = data?.points ?? [];

  return (
    <>
      {/* App Bar */}
      <header className="sticky top-0 z-30 bg-white border-b border-gray-100">
        <div className="h-14 flex items-center px-5 pt-safe">
          <h1 className="text-h4 font-bold text-primary-800">성장 그래프</h1>
        </div>
      </header>

      <div className="px-5 py-4 flex flex-col gap-4">
        {/* 기간 탭 */}
        <div
          className="flex bg-gray-100 rounded-lg p-1 gap-1"
          role="tablist"
          aria-label="그래프 기간 선택"
        >
          {PERIODS.map(({ value, label }) => (
            <button
              key={value}
              role="tab"
              aria-selected={period === value}
              onClick={() => setPeriod(value)}
              className={[
                "flex-1 h-9 rounded-md text-body-s font-medium transition-all duration-fast",
                period === value
                  ? "bg-white text-primary-800 shadow-sm"
                  : "text-gray-500 hover:text-primary-800",
              ].join(" ")}
            >
              {label}
            </button>
          ))}
        </div>

        {/* 차트 영역 */}
        <div className="rounded-xl bg-white border border-gray-100 shadow-sm p-4">
          {isLoading ? (
            <div className="h-40 bg-gray-100 rounded-lg animate-pulse" aria-label="그래프 로딩 중" />
          ) : isError ? (
            <div className="flex flex-col gap-3 py-4 items-center">
              <p className="text-body-s text-error text-center">
                그래프를 불러오지 못했습니다
              </p>
              <Button variant="secondary" size="sm" onClick={() => refetch()}>
                새로고침
              </Button>
            </div>
          ) : points.length < 3 ? (
            <EmptyGraph />
          ) : (
            <MountainLineChart data={points} period={period} />
          )}
        </div>

        {/* 하이라이트 */}
        {!isLoading && !isError && points.length >= 3 && (
          <MonthHighlight data={points} />
        )}

        {/* 30일 회고 CTA */}
        <button
          className="w-full flex items-center justify-between rounded-xl bg-white border border-gray-100 shadow-sm px-4 h-12 touch-target group"
          aria-label="30일 회고 보기"
        >
          <span className="text-body-m font-medium text-primary-800">30일 회고 보기</span>
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            className="text-gray-400 group-hover:translate-x-0.5 transition-transform duration-fast"
            aria-hidden="true"
          >
            <polyline points="9 18 15 12 9 6" />
          </svg>
        </button>
      </div>
    </>
  );
}
