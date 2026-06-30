'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';

export interface ScoreBarProps extends React.HTMLAttributes<HTMLDivElement> {
  value: number;
  max?: number;
  color?: 'green' | 'red' | 'blue' | 'amber' | 'purple';
  label?: string;
  animated?: boolean;
}

const COLOR_MAP: Record<NonNullable<ScoreBarProps['color']>, string> = {
  green:  'var(--color-metric-price-low)',
  red:    'var(--color-metric-price-high)',
  blue:   'var(--color-metric-speed)',
  amber:  'var(--color-metric-quality)',
  purple: 'var(--color-metric-context)',
};

export const ScoreBar = React.forwardRef<HTMLDivElement, ScoreBarProps>(
  (
    {
      value,
      max = 100,
      color = 'green',
      label,
      animated = true,
      className,
      ...props
    },
    ref
  ) => {
    const [rendered, setRendered] = React.useState(!animated);
    const pct = Math.min(Math.max((value / max) * 100, 0), 100);
    const fillColor = COLOR_MAP[color];

    React.useEffect(() => {
      if (!animated) return;
      const id = requestAnimationFrame(() => setRendered(true));
      return () => cancelAnimationFrame(id);
    }, [animated]);

    return (
      <div ref={ref} className={cn('flex items-center gap-2', className)} {...props}>
        <div
          role="progressbar"
          aria-valuenow={value}
          aria-valuemin={0}
          aria-valuemax={max}
          aria-label={label ?? `${value} / ${max}`}
          className="flex-1 h-1.5 rounded-full bg-[var(--color-gray-600)] overflow-hidden"
        >
          <div
            className="h-full rounded-full"
            style={{
              width: rendered ? `${pct}%` : '0%',
              backgroundColor: fillColor,
              transition: animated
                ? 'width 600ms cubic-bezier(0.0, 0.0, 0.2, 1.0)'
                : undefined,
            }}
          />
        </div>
        {label && (
          <span className="text-[12px] text-[var(--color-text-muted)] whitespace-nowrap shrink-0">
            {label}
          </span>
        )}
      </div>
    );
  }
);

ScoreBar.displayName = 'ScoreBar';
