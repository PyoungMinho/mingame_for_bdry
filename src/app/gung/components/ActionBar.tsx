/**
 * §5-5 ActionBar — sticky bottom. "게임을 앞으로 미는 버튼"은 항상 이 자리(§1-4).
 */
import type { ReactNode } from 'react';

export interface ActionBarProps {
  /** 보통 <GuButton variant="primary">…</GuButton> */
  primary: ReactNode;
  /** 보조 버튼/링크(예: "자기소개 건너뛰기 ›") — primary 아래, 더 작게 */
  secondary?: ReactNode;
  /** 게이트 캡션: "방장이 '…'라고 외치면 누르세요" */
  caption?: string;
  /** 되돌리기 토스트 등, 액션바 바로 위 영역(§1-4) */
  toast?: ReactNode;
  className?: string;
}

export function ActionBar({ primary, secondary, caption, toast, className }: ActionBarProps) {
  return (
    <div className={['gu-actionbar-wrap', className ?? ''].filter(Boolean).join(' ')}>
      {toast && <div className="gu-actionbar-toast">{toast}</div>}
      <div className="gu-actionbar">
        {caption && <p className="gu-actionbar-caption">{caption}</p>}
        {primary}
        {secondary && <div className="gu-actionbar-secondary">{secondary}</div>}
      </div>
    </div>
  );
}
