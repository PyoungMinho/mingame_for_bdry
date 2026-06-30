'use client';

import * as React from 'react';
import { Search, X } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface SearchInputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'size'> {
  size?: 'sm' | 'md' | 'lg';
  onClear?: () => void;
  showCmdK?: boolean;
}

const SIZE_CLASSES = {
  sm: 'h-8 text-[13px] pl-8 pr-3',
  md: 'h-10 text-[14px] pl-10 pr-4',
  lg: 'h-12 text-[15px] pl-12 pr-5',
};

const ICON_SIZE = {
  sm: 14,
  md: 16,
  lg: 18,
};

const ICON_OFFSET = {
  sm: 'left-2.5',
  md: 'left-3',
  lg: 'left-3.5',
};

export const SearchInput = React.forwardRef<HTMLInputElement, SearchInputProps>(
  (
    {
      size = 'md',
      className,
      value,
      onChange,
      onClear,
      showCmdK = true,
      placeholder = '모델 검색...',
      ...props
    },
    ref
  ) => {
    const hasValue = value !== undefined ? String(value).length > 0 : false;

    React.useEffect(() => {
      if (!showCmdK) return;
      const handleKeyDown = (e: KeyboardEvent) => {
        if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
          e.preventDefault();
          if (ref && typeof ref === 'object' && ref.current) {
            ref.current.focus();
          }
        }
      };
      window.addEventListener('keydown', handleKeyDown);
      return () => window.removeEventListener('keydown', handleKeyDown);
    }, [showCmdK, ref]);

    return (
      <div className="relative flex items-center w-full">
        <Search
          size={ICON_SIZE[size]}
          className={cn(
            'absolute z-10 pointer-events-none text-[var(--color-text-muted)]',
            ICON_OFFSET[size]
          )}
          aria-hidden="true"
        />

        <input
          ref={ref}
          type="search"
          role="searchbox"
          aria-label={placeholder}
          placeholder={placeholder}
          value={value}
          onChange={onChange}
          className={cn(
            'w-full rounded-[var(--radius-sm)]',
            'bg-[var(--color-bg-elevated)] border border-[var(--color-border)]',
            'text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)]',
            'outline-none',
            'focus:border-[var(--color-border-focus)] focus:ring-1 focus:ring-[var(--color-border-focus)]',
            'transition-all duration-[150ms]',
            '[&::-webkit-search-cancel-button]:hidden',
            SIZE_CLASSES[size],
            hasValue && 'pr-16',
            className
          )}
          {...props}
        />

        <div className="absolute right-3 flex items-center gap-2 pointer-events-none">
          {hasValue && onClear && (
            <button
              type="button"
              onClick={onClear}
              aria-label="검색어 지우기"
              className="pointer-events-auto text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] transition-colors"
            >
              <X size={14} />
            </button>
          )}
          {showCmdK && !hasValue && (
            <kbd
              className="text-[11px] text-[var(--color-text-muted)] bg-[var(--color-bg-surface)] border border-[var(--color-border)] rounded px-1 py-0.5 font-mono leading-none"
              aria-label="단축키 Cmd+K"
            >
              ⌘K
            </kbd>
          )}
        </div>
      </div>
    );
  }
);

SearchInput.displayName = 'SearchInput';
