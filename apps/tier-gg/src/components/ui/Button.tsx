'use client';

import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const buttonVariants = cva(
  [
    'inline-flex items-center justify-center gap-2 font-medium select-none',
    'transition-all duration-[150ms] ease-out',
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-border-focus)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--color-bg-base)]',
    'disabled:opacity-30 disabled:cursor-not-allowed disabled:pointer-events-none',
    'active:scale-[0.96] active:transition-transform active:duration-[80ms]',
    'whitespace-nowrap',
  ].join(' '),
  {
    variants: {
      variant: {
        primary: [
          'bg-[var(--color-accent)] text-white',
          'hover:brightness-110',
        ].join(' '),
        secondary: [
          'bg-[var(--color-bg-elevated)] text-[var(--color-text-primary)]',
          'border border-[var(--color-border-strong)]',
          'hover:bg-[var(--color-bg-surface)]',
        ].join(' '),
        ghost: [
          'bg-transparent text-[var(--color-text-secondary)]',
          'hover:text-[var(--color-text-primary)] hover:bg-[var(--color-bg-elevated)]',
        ].join(' '),
        danger: [
          'bg-[rgba(220,38,38,0.12)] text-[#EF4444]',
          'border border-[rgba(220,38,38,0.30)]',
          'hover:bg-[rgba(220,38,38,0.20)]',
        ].join(' '),
      },
      size: {
        sm: 'h-7 px-[10px] text-[12px] rounded-[var(--radius-sm)]',
        md: 'h-9 px-[14px] text-[13px] rounded-[var(--radius-sm)]',
        lg: 'h-11 px-5 text-[15px] rounded-[var(--radius-sm)]',
      },
      iconOnly: {
        true: '',
        false: '',
      },
    },
    compoundVariants: [
      { size: 'sm', iconOnly: true, class: 'w-7 px-0 justify-center' },
      { size: 'md', iconOnly: true, class: 'w-9 px-0 justify-center' },
      { size: 'lg', iconOnly: true, class: 'w-11 px-0 justify-center' },
    ],
    defaultVariants: {
      variant: 'primary',
      size: 'md',
      iconOnly: false,
    },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  loading?: boolean;
  iconOnly?: boolean;
}

const Spinner = () => (
  <svg
    className="animate-spin"
    xmlns="http://www.w3.org/2000/svg"
    width="16"
    height="16"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <path d="M21 12a9 9 0 1 1-6.219-8.56" />
  </svg>
);

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    { className, variant, size, iconOnly, loading, disabled, children, ...props },
    ref
  ) => {
    return (
      <button
        ref={ref}
        className={cn(buttonVariants({ variant, size, iconOnly }), className)}
        disabled={disabled || loading}
        aria-busy={loading}
        {...props}
      >
        {loading ? (
          <>
            <span className="opacity-0 absolute">{children}</span>
            <Spinner />
          </>
        ) : (
          children
        )}
      </button>
    );
  }
);

Button.displayName = 'Button';
