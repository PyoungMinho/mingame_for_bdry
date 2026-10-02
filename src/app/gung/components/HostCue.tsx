/**
 * §5-28 HostCue — 「」 포함 Song Myung 19 gold-ink, 좌측 2px cta 라인.
 * 어떤 문구를 보여줄지(기본 §13 vs 사건 데이터 `hostCue`)는 화면 레이어가 결정해 children으로 넘긴다.
 */
import type { ReactNode } from 'react';

export interface HostCueProps {
  children: ReactNode;
  className?: string;
}

export function HostCue({ children, className }: HostCueProps) {
  const text = typeof children === 'string' && !children.trim().startsWith('「') ? `「${children}」` : children;
  return <p className={['gu-hostcue', 'gu-display', className ?? ''].filter(Boolean).join(' ')}>{text}</p>;
}
