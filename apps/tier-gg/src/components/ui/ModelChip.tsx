import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

export type Provider =
  | 'openai'
  | 'anthropic'
  | 'google'
  | 'meta'
  | 'mistral'
  | 'xai'
  | 'cohere'
  | 'other';

const PROVIDER_CONFIG: Record<
  Provider,
  { bg: string; initial: string; textColor: string; label: string }
> = {
  openai:    { bg: '#10B981', initial: 'O', textColor: '#FFFFFF', label: 'OpenAI' },
  anthropic: { bg: '#F59E0B', initial: 'A', textColor: '#0A0A0F', label: 'Anthropic' },
  google:    { bg: '#3B82F6', initial: 'G', textColor: '#FFFFFF', label: 'Google' },
  meta:      { bg: '#1D4ED8', initial: 'M', textColor: '#FFFFFF', label: 'Meta' },
  mistral:   { bg: '#8B5CF6', initial: 'M', textColor: '#FFFFFF', label: 'Mistral' },
  xai:       { bg: '#6B7280', initial: 'X', textColor: '#FFFFFF', label: 'xAI' },
  cohere:    { bg: '#06B6D4', initial: 'C', textColor: '#0A0A0F', label: 'Cohere' },
  other:     { bg: '#4B5563', initial: '?', textColor: '#FFFFFF', label: 'Other' },
};

const avatarSizeVariants = cva(
  'flex items-center justify-center rounded-full font-semibold shrink-0',
  {
    variants: {
      size: {
        sm: 'w-5 h-5 text-[10px]',
        md: 'w-7 h-7 text-[12px]',
        lg: 'w-16 h-16 text-[28px]',
      },
    },
    defaultVariants: { size: 'md' },
  }
);

export interface ModelChipProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof avatarSizeVariants> {
  modelName: string;
  provider: Provider;
  selected?: boolean;
  showFullName?: boolean;
  onClick?: () => void;
}

export const ModelChip = React.forwardRef<HTMLDivElement, ModelChipProps>(
  (
    {
      modelName,
      provider,
      size = 'md',
      selected = false,
      showFullName = true,
      onClick,
      className,
      ...props
    },
    ref
  ) => {
    const config = PROVIDER_CONFIG[provider] ?? PROVIDER_CONFIG.other;
    const initial =
      provider === 'other'
        ? (modelName[0] ?? '?').toUpperCase()
        : config.initial;

    const isInteractive = !!onClick;

    return (
      <div
        ref={ref}
        role={isInteractive ? 'button' : undefined}
        tabIndex={isInteractive ? 0 : undefined}
        onClick={onClick}
        onKeyDown={
          isInteractive
            ? (e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  onClick();
                }
              }
            : undefined
        }
        aria-label={`${config.label} ${modelName}${selected ? ' (선택됨)' : ''}`}
        aria-pressed={isInteractive ? selected : undefined}
        className={cn(
          'inline-flex items-center gap-2',
          isInteractive && 'cursor-pointer',
          selected && 'rounded-[var(--radius-sm)] bg-[var(--color-accent-subtle)] ring-1 ring-[var(--color-accent)] px-1',
          className
        )}
        title={modelName}
        {...props}
      >
        <span
          className={cn(avatarSizeVariants({ size }))}
          style={{ backgroundColor: config.bg, color: config.textColor }}
          aria-hidden="true"
        >
          {initial}
        </span>
        {showFullName && (
          <span className="text-[14px] font-medium text-[var(--color-text-primary)] leading-none">
            {modelName}
          </span>
        )}
      </div>
    );
  }
);

ModelChip.displayName = 'ModelChip';
