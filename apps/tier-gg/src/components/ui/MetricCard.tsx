import * as React from 'react';
import { DollarSign, BookOpen, Zap, Star, Info } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ScoreBar } from './ScoreBar';
import type { ScoreBarProps } from './ScoreBar';

export type MetricKind = 'price-in' | 'price-out' | 'context' | 'speed' | 'quality';

export type MetricTrend = 'up' | 'down' | 'neutral';

export interface MetricCardProps extends React.HTMLAttributes<HTMLDivElement> {
  kind: MetricKind;
  value: number | string;
  unit?: string;
  trend?: MetricTrend;
  scoreValue?: number;
  scoreMax?: number;
  scoreLabel?: string;
  stale?: boolean;
  loading?: boolean;
}

const KIND_CONFIG: Record<
  MetricKind,
  {
    label: string;
    color: ScoreBarProps['color'];
    barColor: string;
    textColor: string;
    icon: React.ReactNode;
  }
> = {
  'price-in': {
    label: '입력 가격',
    color: 'green',
    barColor: 'var(--color-metric-price-low)',
    textColor: 'var(--color-metric-price-low)',
    icon: <DollarSign size={14} aria-hidden="true" />,
  },
  'price-out': {
    label: '출력 가격',
    color: 'red',
    barColor: 'var(--color-metric-price-high)',
    textColor: 'var(--color-metric-price-high)',
    icon: <DollarSign size={14} aria-hidden="true" />,
  },
  context: {
    label: '컨텍스트 창',
    color: 'purple',
    barColor: 'var(--color-metric-context)',
    textColor: 'var(--color-metric-context)',
    icon: <BookOpen size={14} aria-hidden="true" />,
  },
  speed: {
    label: '속도 (TPS)',
    color: 'blue',
    barColor: 'var(--color-metric-speed)',
    textColor: 'var(--color-metric-speed)',
    icon: <Zap size={14} aria-hidden="true" />,
  },
  quality: {
    label: '품질 점수',
    color: 'amber',
    barColor: 'var(--color-metric-quality)',
    textColor: 'var(--color-metric-quality)',
    icon: <Star size={14} aria-hidden="true" />,
  },
};

const SkeletonBar = () => (
  <div className="h-3 w-24 rounded bg-[var(--color-gray-700)] animate-pulse" />
);

export const MetricCard = React.forwardRef<HTMLDivElement, MetricCardProps>(
  (
    {
      kind,
      value,
      unit,
      trend: _trend,
      scoreValue,
      scoreMax = 100,
      scoreLabel,
      stale = false,
      loading = false,
      className,
      ...props
    },
    ref
  ) => {
    const config = KIND_CONFIG[kind];

    return (
      <div
        ref={ref}
        className={cn(
          'relative flex flex-col gap-3 p-4 rounded-[var(--radius-md)]',
          'bg-[var(--color-bg-surface)] border border-[var(--color-border)]',
          stale && 'opacity-70',
          className
        )}
        {...props}
      >
        {stale && (
          <span
            className="absolute top-2 right-2 text-[11px] px-1.5 py-0.5 rounded bg-[rgba(217,119,6,0.15)] text-[#D97706]"
            role="status"
          >
            갱신 필요
          </span>
        )}

        <div className="flex items-center gap-1.5 text-[12px]" style={{ color: config.textColor }}>
          {config.icon}
          <span className="font-medium">{config.label}</span>
          {!stale && (
            <Info
              size={12}
              className="ml-auto text-[var(--color-text-muted)]"
              aria-hidden="true"
            />
          )}
        </div>

        <div>
          {loading ? (
            <SkeletonBar />
          ) : (
            <>
              <span
                className="font-mono text-[28px] font-bold text-[var(--color-text-primary)]"
                style={{ fontVariantNumeric: 'tabular-nums' }}
              >
                {value}
              </span>
              {unit && (
                <span className="ml-1 text-[12px] text-[var(--color-text-muted)]">
                  {unit}
                </span>
              )}
            </>
          )}
        </div>

        {(scoreValue !== undefined || loading) && (
          <ScoreBar
            value={loading ? 0 : scoreValue ?? 0}
            max={scoreMax}
            color={config.color}
            label={loading ? undefined : scoreLabel}
            animated={!loading}
          />
        )}
      </div>
    );
  }
);

MetricCard.displayName = 'MetricCard';
