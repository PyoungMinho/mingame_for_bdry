import type { CSSProperties } from 'react';
import type { ChartData } from '@/lib/monthly-close/sheet/disguise';

export interface BarChartProps {
  data: ChartData;
  /** 시트 위 위치(px, 격자 inner 좌표) */
  left: number;
  top: number;
  width?: number;
  height?: number;
  selected?: boolean;
  onSelect?: () => void;
}

/** CSS 막대 차트(라이브러리 없음). 정적이고 값 라벨 없음. 계열 2개면 전월 회색 · 당월 accent. */
export function BarChart({ data, left, top, width = 400, height = 264, selected, onSelect }: BarChartProps) {
  const multi = data.series.length > 1;
  const style: CSSProperties = { left, top, width, height };
  return (
    <div
      className="mc-disguise-chart"
      style={style}
      data-selected={selected ? 'true' : undefined}
      role="img"
      aria-label={data.title}
      onClick={onSelect}
    >
      <div className="mc-disguise-chart__title">{data.title}</div>
      <div className="mc-disguise-chart__plot">
        {data.baselinePct !== null ? (
          <div className="mc-disguise-chart__base" style={{ bottom: `${Math.min(100, (data.baselinePct / data.max) * 100)}%` }} />
        ) : null}
        {data.bars.map((b, i) => (
          <div key={i} className="mc-disguise-chart__group">
            {b.values.map((v, s) => (
              <div
                key={s}
                className="mc-disguise-chart__bar"
                data-series={s}
                data-multi={multi ? 'true' : undefined}
                style={{ height: `${Math.max(0, Math.min(100, (v / data.max) * 100))}%` }}
              />
            ))}
          </div>
        ))}
      </div>
      <div className="mc-disguise-chart__labels">
        {data.bars.map((b, i) => (
          <span key={i}>{b.label}</span>
        ))}
      </div>
      {multi ? (
        <div className="mc-disguise-chart__legend">
          {data.series.map((n, s) => (
            <span key={s}>
              <i data-series={s} data-multi="true" />
              {n}
            </span>
          ))}
        </div>
      ) : null}
    </div>
  );
}
