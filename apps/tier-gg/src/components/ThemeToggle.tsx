'use client';

import * as React from 'react';
import { Sun, Moon } from 'lucide-react';
import { cn } from '@/lib/utils';

type Theme = 'dark' | 'light';

function getInitialTheme(): Theme {
  if (typeof window === 'undefined') return 'dark';
  const stored = localStorage.getItem('theme') as Theme | null;
  if (stored === 'dark' || stored === 'light') return stored;
  if (window.matchMedia('(prefers-color-scheme: light)').matches) return 'light';
  return 'dark';
}

function applyTheme(theme: Theme) {
  document.documentElement.setAttribute('data-theme', theme);
  localStorage.setItem('theme', theme);
}

export interface ThemeToggleProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  size?: number;
}

export function ThemeToggle({ size = 16, className, ...props }: ThemeToggleProps) {
  const [theme, setTheme] = React.useState<Theme>('dark');
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => {
    const initial = getInitialTheme();
    setTheme(initial);
    applyTheme(initial);
    setMounted(true);
  }, []);

  const toggle = () => {
    const next: Theme = theme === 'dark' ? 'light' : 'dark';
    setTheme(next);
    applyTheme(next);
  };

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={theme === 'dark' ? '라이트 모드로 전환' : '다크 모드로 전환'}
      aria-pressed={theme === 'light'}
      className={cn(
        'flex items-center justify-center w-8 h-8 rounded-[var(--radius-sm)]',
        'text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]',
        'hover:bg-[var(--color-bg-elevated)]',
        'transition-colors duration-[150ms]',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-border-focus)]',
        className
      )}
      {...props}
    >
      {!mounted ? null : theme === 'dark' ? (
        <Sun size={size} aria-hidden="true" />
      ) : (
        <Moon size={size} aria-hidden="true" />
      )}
    </button>
  );
}
