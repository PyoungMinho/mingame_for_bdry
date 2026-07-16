"use client";

import { useId, useState } from "react";
import { ChevronDown } from "lucide-react";
import type { PlayerStats } from "@/lib/dongne/types";

export interface StatsHistogramProps {
  stats: PlayerStats;
  /** 오늘 결과의 히스토그램 인덱스(0~5=1~6회 성공, 6=실패) — 막대 하이라이트용. 오늘 미플레이 등은 생략 */
  todayResultIndex?: number;
  /** 기본 접힘(§4-11) */
  defaultOpen?: boolean;
  triggerLabel?: string;
  className?: string;
}

const ROW_LABELS = ["1", "2", "3", "4", "5", "6", "실패"] as const;

/**
 * 통계 히스토그램 (design-final §4-11, F4 확정). 결과 카드 안의 **인라인 아코디언** —
 * 모달을 쓰지 않는다(자체 open/close 상태를 내장한 headless 아코디언).
 * localStorage 자체가 없어 stats를 못 만든 경우 이 컴포넌트를 아예 렌더하지 않는 것은
 * 페이지 책임이다(§4-11 "localStorage 불가 시 이 섹션 자체 비노출").
 */
export default function StatsHistogram({
  stats,
  todayResultIndex,
  defaultOpen = false,
  triggerLabel = "내 통계 보기",
  className = "",
}: StatsHistogramProps) {
  const [open, setOpen] = useState(defaultOpen);
  const panelId = useId();

  const winRate = stats.totalPlays > 0 ? Math.round((stats.wins / stats.totalPlays) * 100) : 0;
  const maxCount = Math.max(1, ...stats.histogram);

  return (
    <div className={`dn-stats ${className}`.trim()}>
      <button
        type="button"
        className={`dn-stats-trigger touch-target${open ? " is-open" : ""}`}
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((v) => !v)}
      >
        {triggerLabel}
        <span className="dn-stats-trigger-caret" aria-hidden="true">
          <ChevronDown size={16} />
        </span>
      </button>

      <div className={`dn-stats-panel${open ? " is-open" : ""}`}>
        <div className="dn-stats-panel-inner">
          <div id={panelId} className="dn-stats-panel-content">
            <div className="dn-stats-summary">
              <div className="dn-stats-summary-chip">
                <span className="dn-stats-summary-value dn-text-mono-num">{stats.totalPlays}</span>
                <span className="dn-stats-summary-label dn-text-body-sm">총 플레이</span>
              </div>
              <div className="dn-stats-summary-chip">
                <span className="dn-stats-summary-value dn-text-mono-num">{winRate}%</span>
                <span className="dn-stats-summary-label dn-text-body-sm">승률</span>
              </div>
              <div className="dn-stats-summary-chip">
                <span className="dn-stats-summary-value dn-text-mono-num">
                  {stats.currentStreak} / {stats.maxStreak}
                </span>
                <span className="dn-stats-summary-label dn-text-body-sm">현재/최고 스트릭</span>
              </div>
            </div>

            <div className="dn-stats-bars">
              {stats.histogram.map((count, i) => (
                <div className="dn-stats-bar-row" key={ROW_LABELS[i]}>
                  <span className="dn-stats-bar-label">{ROW_LABELS[i]}</span>
                  <span className="dn-stats-bar-track">
                    <span
                      className={`dn-stats-bar-fill${todayResultIndex === i ? " is-today" : ""}`}
                      style={{ width: `${(count / maxCount) * 100}%` }}
                    />
                  </span>
                  <span className="dn-stats-bar-count dn-text-mono-num">{count}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
