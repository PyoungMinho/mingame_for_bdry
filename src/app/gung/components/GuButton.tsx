'use client';

/**
 * §5-6 GuButton — 모든 "진행/확정" 액션의 유일한 모양. 취객 가드(§10-2):
 * 탭 후 debounceMs(기본 600ms) 동안 재입력을 무시해 더블탭으로 두 단계 전진하는 사고를 막는다.
 * 로직은 여기(프레젠테이션 레이어)에 두되, 게임 상태는 전혀 모른다 — onClick 콜백만 호출한다.
 */
import { MessageCircle } from 'lucide-react';
import { useRef, type ButtonHTMLAttributes, type ReactNode } from 'react';

export type GuButtonVariant = 'primary' | 'secondary' | 'danger' | 'ghost' | 'kakao';

const DEFAULT_HEIGHT: Record<GuButtonVariant, 48 | 52 | 64> = {
  primary: 64,
  secondary: 52,
  danger: 52,
  ghost: 48,
  kakao: 64,
};

export interface GuButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'className' | 'onClick' | 'disabled'> {
  variant?: GuButtonVariant;
  /** 기본 높이를 벗어나는 경우만(예: IncenseTimer 컨트롤 = Secondary 64) */
  size?: 48 | 52 | 64;
  icon?: ReactNode;
  iconPosition?: 'start' | 'end';
  children: ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  /** 비활성 사유를 라벨에 그대로 노출(§5-6: "장소를 고르시오") */
  disabledReason?: string;
  /** 더블탭 2단 전진 방지(§10-2). 0으로 끄기 가능(예: 카운트다운 건너뛰기 탭) */
  debounceMs?: number;
  fullWidth?: boolean;
  className?: string;
}

export function GuButton({
  variant = 'secondary',
  size,
  icon,
  iconPosition = 'start',
  children,
  onClick,
  disabled,
  disabledReason,
  debounceMs = 600,
  fullWidth = true,
  className,
  type = 'button',
  ...rest
}: GuButtonProps) {
  const lastRef = useRef(0);
  const height = size ?? DEFAULT_HEIGHT[variant];

  const handleClick = () => {
    if (disabled || !onClick) return;
    const now = Date.now();
    if (debounceMs > 0 && now - lastRef.current < debounceMs) return;
    lastRef.current = now;
    onClick();
  };

  const label = disabled && disabledReason ? disabledReason : children;
  const resolvedIcon = variant === 'kakao' && !icon ? <MessageCircle aria-hidden size={20} /> : icon;

  return (
    <button
      {...rest}
      type={type}
      className={['gu-btn', `gu-btn--${variant}`, fullWidth ? 'gu-btn--full' : '', className ?? ''].filter(Boolean).join(' ')}
      style={{ ['--gu-btn-h' as string]: `${height}px` }}
      disabled={disabled}
      aria-disabled={disabled || undefined}
      onClick={handleClick}
    >
      {resolvedIcon && iconPosition === 'start' && <span className="gu-btn-icon">{resolvedIcon}</span>}
      <span className="gu-btn-label">{label}</span>
      {resolvedIcon && iconPosition === 'end' && <span className="gu-btn-icon">{resolvedIcon}</span>}
    </button>
  );
}
