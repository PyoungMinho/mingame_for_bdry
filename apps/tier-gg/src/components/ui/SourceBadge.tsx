import * as React from 'react';
import { ExternalLink } from 'lucide-react';
import { cn } from '@/lib/utils';

export type SourceTier = 'T1' | 'T2' | 'T3';
export type Confidence = 'high' | 'mid' | 'low';

export interface SourceBadgeProps extends React.HTMLAttributes<HTMLAnchorElement> {
  sourceName: string;
  sourceUrl: string;
  verifiedAt: string;
  confidence: Confidence;
  tier?: SourceTier;
  inline?: boolean;
}

const CONFIDENCE_CONFIG: Record<
  Confidence,
  { symbol: string; label: string; colorClass: string; tierLabel: string }
> = {
  high: { symbol: '●', label: '높음', colorClass: 'text-[#16A34A]', tierLabel: 'T1' },
  mid:  { symbol: '○', label: '중간', colorClass: 'text-[#D97706]', tierLabel: 'T2' },
  low:  { symbol: '△', label: '낮음', colorClass: 'text-[#DC2626]', tierLabel: 'T3' },
};

function formatRelativeDate(isoDate: string): { text: string; isStale: boolean; isVeryStale: boolean } {
  const date = new Date(isoDate);
  const now = new Date();
  const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return { text: '오늘', isStale: false, isVeryStale: false };
  if (diffDays === 1) return { text: '1일 전', isStale: false, isVeryStale: false };
  return {
    text: `${diffDays}일 전`,
    isStale: diffDays >= 8 && diffDays <= 30,
    isVeryStale: diffDays > 30,
  };
}

export const SourceBadge = React.forwardRef<HTMLAnchorElement, SourceBadgeProps>(
  (
    {
      sourceName,
      sourceUrl,
      verifiedAt,
      confidence,
      tier,
      inline = false,
      className,
      ...props
    },
    ref
  ) => {
    const config = CONFIDENCE_CONFIG[confidence];
    const resolvedTier = tier ?? config.tierLabel;
    const { text: relDate, isStale, isVeryStale } = formatRelativeDate(verifiedAt);

    const dateColorClass = isVeryStale
      ? 'text-[#D97706]'
      : isStale
      ? 'text-[#F59E0B]'
      : 'text-[var(--color-text-muted)]';

    const staleTitle = isVeryStale
      ? '데이터가 오래됐습니다. 갱신이 필요합니다.'
      : isStale
      ? '30일 이내 데이터입니다. 확인을 권장합니다.'
      : undefined;

    return (
      <a
        ref={ref}
        href={sourceUrl}
        target="_blank"
        rel="noopener noreferrer"
        aria-label={`출처: ${sourceName}, ${relDate} 확인, 신뢰도 ${config.label}`}
        title={staleTitle}
        className={cn(
          'inline-flex items-center gap-1 text-[12px] no-underline',
          'hover:text-[var(--color-text-primary)] transition-colors duration-[150ms]',
          inline ? 'gap-1' : 'gap-1.5',
          className
        )}
        {...props}
      >
        <span className="font-mono text-[10px] text-[var(--color-text-muted)] bg-[var(--color-bg-elevated)] px-1 rounded">
          {resolvedTier}
        </span>
        <span className="text-[var(--color-text-secondary)]">{sourceName}</span>
        <span className="text-[var(--color-text-muted)]">·</span>
        <span className={dateColorClass}>{relDate}</span>
        <span
          className={config.colorClass}
          aria-label={`신뢰도 ${config.label}`}
          title={`신뢰도: ${config.label}`}
        >
          {config.symbol}
        </span>
        <ExternalLink size={10} className="text-[var(--color-text-muted)]" aria-hidden="true" />
      </a>
    );
  }
);

SourceBadge.displayName = 'SourceBadge';
