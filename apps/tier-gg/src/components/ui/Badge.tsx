import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const badgeVariants = cva(
  'inline-flex items-center gap-1 font-medium text-[12px] leading-none rounded-[var(--radius-xs)] px-2 py-[3px] border',
  {
    variants: {
      variant: {
        provider: [
          'bg-[var(--color-bg-elevated)] text-[var(--color-text-primary)]',
          'border-[var(--color-border)]',
        ].join(' '),
        'score-high': [
          'bg-[rgba(34,197,94,0.15)] text-[#22C55E]',
          'border-[rgba(34,197,94,0.30)]',
        ].join(' '),
        'score-mid': [
          'bg-[rgba(245,158,11,0.15)] text-[#F59E0B]',
          'border-[rgba(245,158,11,0.30)]',
        ].join(' '),
        'score-low': [
          'bg-[rgba(239,68,68,0.15)] text-[#EF4444]',
          'border-[rgba(239,68,68,0.30)]',
        ].join(' '),
        'status-verified': [
          'bg-[rgba(22,163,74,0.15)] text-[#16A34A]',
          'border-transparent',
        ].join(' '),
        'status-stale': [
          'bg-[rgba(217,119,6,0.12)] text-[#D97706]',
          'border-transparent',
        ].join(' '),
        'status-unverified': [
          'bg-[rgba(90,90,114,0.15)] text-[var(--color-text-muted)]',
          'border-transparent',
        ].join(' '),
      },
    },
    defaultVariants: {
      variant: 'provider',
    },
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {}

export const Badge = React.forwardRef<HTMLSpanElement, BadgeProps>(
  ({ className, variant, children, ...props }, ref) => (
    <span
      ref={ref}
      className={cn(badgeVariants({ variant }), className)}
      {...props}
    >
      {children}
    </span>
  )
);

Badge.displayName = 'Badge';
