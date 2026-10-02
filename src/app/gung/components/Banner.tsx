/**
 * §5-27 Banner — 인라인, surface + 좌측 4px(blue/red) + 닫기 48.
 */
import { X } from 'lucide-react';
import type { ReactNode } from 'react';

export interface BannerProps {
  tone: 'info' | 'warn';
  icon?: ReactNode;
  children: ReactNode;
  action?: ReactNode;
  onDismiss?: () => void;
  className?: string;
}

export function Banner({ tone, icon, children, action, onDismiss, className }: BannerProps) {
  return (
    <div className={['gu-banner', className ?? ''].filter(Boolean).join(' ')} data-tone={tone} role={tone === 'warn' ? 'alert' : 'status'}>
      {icon && <span className="gu-banner-icon">{icon}</span>}
      <div className="gu-banner-body">
        <p className="gu-banner-text">{children}</p>
        {action && <div className="gu-banner-action">{action}</div>}
      </div>
      {onDismiss && (
        <button type="button" className="gu-banner-close" onClick={onDismiss} aria-label="닫기">
          <X aria-hidden size={18} />
        </button>
      )}
    </div>
  );
}
