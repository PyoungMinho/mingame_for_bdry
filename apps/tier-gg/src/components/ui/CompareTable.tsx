'use client';

import * as React from 'react';
import { X, Plus } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ModelChip, type Provider } from './ModelChip';
import { SourceBadge, type SourceBadgeProps } from './SourceBadge';
import { InfoTooltip } from './InfoTooltip';

export interface CompareMetric {
  value: number | string;
  unit?: string;
  source?: SourceBadgeProps;
}

export interface CompareModel {
  slug: string;
  name: string;
  provider: Provider;
  metrics: Record<string, CompareMetric>;
}

export interface CompareRow {
  key: string;
  label: string;
  highlight?: 'min' | 'max';
  numeric?: boolean;
}

export interface RowExplanation {
  oneLiner: string;
  betterWhen: 'higher' | 'lower';
}

export interface CompareTableProps extends React.HTMLAttributes<HTMLDivElement> {
  models: CompareModel[];
  rows: CompareRow[];
  onRemoveModel?: (slug: string) => void;
  onAddModel?: () => void;
  /** 행 key → 설명 매핑. 있는 행만 부가 텍스트 렌더 */
  explanations?: Record<string, RowExplanation>;
}

function buildTooltipContent(exp: RowExplanation): string {
  const betterLine = exp.betterWhen === 'lower' ? '낮을수록 좋음' : '높을수록 좋음';
  // oneLiner에 이미 better 정보가 포함되어 있으면 중복 추가 안 함
  const alreadyHasBetter =
    exp.oneLiner.includes('낮을수록') ||
    exp.oneLiner.includes('높을수록') ||
    exp.oneLiner.toLowerCase().includes('lower') ||
    exp.oneLiner.toLowerCase().includes('higher');
  return alreadyHasBetter ? exp.oneLiner : `${exp.oneLiner}\n${betterLine}`;
}

function findWinner(
  models: CompareModel[],
  rowKey: string,
  highlight?: 'min' | 'max'
): Set<string> {
  if (!highlight) return new Set();
  const values = models.map((m) => {
    const raw = m.metrics[rowKey]?.value;
    return { slug: m.slug, num: typeof raw === 'string' ? parseFloat(raw) : raw ?? NaN };
  });
  const valids = values.filter((v) => !isNaN(v.num));
  if (!valids.length) return new Set();
  const target =
    highlight === 'max'
      ? Math.max(...valids.map((v) => v.num))
      : Math.min(...valids.map((v) => v.num));
  return new Set(valids.filter((v) => v.num === target).map((v) => v.slug));
}

export const CompareTable = React.forwardRef<HTMLDivElement, CompareTableProps>(
  ({ models, rows, onRemoveModel, onAddModel, explanations, className, ...props }, ref) => {
    return (
      <div ref={ref} className={cn('w-full', className)} {...props}>
        {/* Desktop table */}
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full border-collapse text-[14px]">
            <thead>
              <tr className="sticky top-0 z-10 bg-[var(--color-bg-base)] border-b border-[var(--color-border)]">
                <th
                  className="sticky left-0 z-20 bg-[var(--color-bg-base)] text-left py-3 px-4 text-[12px] font-medium text-[var(--color-text-muted)] w-48"
                  scope="col"
                >
                  속성
                </th>
                {models.map((model) => (
                  <th
                    key={model.slug}
                    scope="col"
                    className="py-3 px-4 text-center min-w-[160px]"
                  >
                    <div className="flex items-center justify-center gap-2">
                      <ModelChip
                        modelName={model.name}
                        provider={model.provider}
                        size="sm"
                        showFullName
                      />
                      {onRemoveModel && (
                        <button
                          onClick={() => onRemoveModel(model.slug)}
                          aria-label={`${model.name} 제거`}
                          className="text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] transition-colors"
                        >
                          <X size={12} />
                        </button>
                      )}
                    </div>
                  </th>
                ))}
                {onAddModel && models.length < 4 && (
                  <th scope="col" className="py-3 px-4">
                    <button
                      onClick={onAddModel}
                      aria-label="모델 추가"
                      className="flex items-center gap-1 text-[12px] text-[var(--color-text-muted)] hover:text-[var(--color-accent)] transition-colors"
                    >
                      <Plus size={14} />
                      <span>모델 추가</span>
                    </button>
                  </th>
                )}
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => {
                const winners = findWinner(models, row.key, row.highlight);
                return (
                  <tr
                    key={row.key}
                    className="border-b border-[var(--color-border)] hover:bg-[var(--color-bg-elevated)] transition-colors duration-[150ms]"
                  >
                    <td className="sticky left-0 bg-[var(--color-bg-surface)] py-3 px-4">
                      <span className="flex items-center gap-1 whitespace-nowrap text-[13px] font-medium text-[var(--color-text-secondary)]">
                        {row.label}
                        {explanations?.[row.key] && (
                          <InfoTooltip
                            content={buildTooltipContent(explanations[row.key])}
                            side="right"
                            iconSize={12}
                          />
                        )}
                      </span>
                    </td>
                    {models.map((model) => {
                      const metric = model.metrics[row.key];
                      const isWinner = winners.has(model.slug);
                      return (
                        <td
                          key={model.slug}
                          className={cn(
                            'py-3 px-4 text-center',
                            isWinner && 'bg-[var(--color-accent-subtle)]'
                          )}
                        >
                          <div className="flex flex-col items-center gap-1">
                            <span
                              className={cn(
                                'font-mono font-medium',
                                isWinner
                                  ? row.highlight === 'min'
                                    ? 'text-[var(--color-metric-price-low)]'
                                    : 'text-[var(--color-metric-quality)]'
                                  : 'text-[var(--color-text-primary)]'
                              )}
                              style={{ fontVariantNumeric: 'tabular-nums' }}
                            >
                              {isWinner && <span aria-hidden="true">★ </span>}
                              {metric?.value ?? '—'}
                              {metric?.unit && (
                                <span className="text-[11px] font-normal text-[var(--color-text-muted)] ml-0.5">
                                  {metric.unit}
                                </span>
                              )}
                            </span>
                            {metric?.source && (
                              <SourceBadge {...metric.source} inline />
                            )}
                          </div>
                        </td>
                      );
                    })}
                    {onAddModel && models.length < 4 && <td />}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Mobile: horizontal snap cards */}
        <div
          className="md:hidden flex gap-3 overflow-x-auto snap-x snap-mandatory pb-2"
          style={{ scrollbarWidth: 'none' }}
        >
          {models.map((model) => (
            <div
              key={model.slug}
              className="snap-start shrink-0 w-[85vw] rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-bg-surface)] overflow-hidden"
            >
              <div className="flex items-center justify-between p-4 border-b border-[var(--color-border)]">
                <ModelChip modelName={model.name} provider={model.provider} size="md" showFullName />
                {onRemoveModel && (
                  <button
                    onClick={() => onRemoveModel(model.slug)}
                    aria-label={`${model.name} 제거`}
                    className="text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]"
                  >
                    <X size={14} />
                  </button>
                )}
              </div>
              <div className="divide-y divide-[var(--color-border)]">
                {rows.map((row) => {
                  const metric = model.metrics[row.key];
                  const winners = findWinner(models, row.key, row.highlight);
                  const isWinner = winners.has(model.slug);
                  return (
                    <div key={row.key} className="flex items-start justify-between px-4 py-2.5 gap-2">
                      <div className="flex items-center gap-1 min-w-0">
                        <span className="text-[12px] text-[var(--color-text-muted)]">{row.label}</span>
                        {explanations?.[row.key] && (
                          <InfoTooltip
                            content={buildTooltipContent(explanations[row.key])}
                            side="bottom"
                            iconSize={11}
                          />
                        )}
                      </div>
                      <span
                        className={cn(
                          'font-mono text-[13px] font-medium',
                          isWinner
                            ? row.highlight === 'min'
                              ? 'text-[var(--color-metric-price-low)]'
                              : 'text-[var(--color-metric-quality)]'
                            : 'text-[var(--color-text-primary)]'
                        )}
                        style={{ fontVariantNumeric: 'tabular-nums' }}
                      >
                        {isWinner && <span aria-hidden="true">★ </span>}
                        {metric?.value ?? '—'}
                        {metric?.unit && (
                          <span className="text-[11px] font-normal text-[var(--color-text-muted)] ml-0.5">
                            {metric.unit}
                          </span>
                        )}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
          {onAddModel && models.length < 4 && (
            <button
              onClick={onAddModel}
              aria-label="모델 추가"
              className="snap-start shrink-0 w-24 flex flex-col items-center justify-center gap-2 rounded-[var(--radius-md)] border border-dashed border-[var(--color-border-strong)] text-[var(--color-text-muted)] hover:text-[var(--color-accent)] hover:border-[var(--color-accent)] transition-colors"
            >
              <Plus size={20} />
              <span className="text-[12px]">추가</span>
            </button>
          )}
        </div>
      </div>
    );
  }
);

CompareTable.displayName = 'CompareTable';
