/**
 * §5-1 GuFrame — 화면 공통 레이아웃. 헤더/본문(스크롤)/액션바/탭바. 콘텐츠 max-width 중앙 정렬(§4-1 --gu-maxw).
 */
import type { ReactNode } from 'react';

export interface GuFrameProps {
  header: ReactNode;
  children: ReactNode;
  actionBar?: ReactNode;
  tabs?: ReactNode;
  /** Stage(공용, 방장 진행 탭·진상·결과) vs Private(개인) — 본문 타이포 스케일이 달라진다(§1-5) */
  surface?: 'stage' | 'private';
  className?: string;
}

export function GuFrame({ header, children, actionBar, tabs, surface = 'private', className }: GuFrameProps) {
  return (
    <div className={['gu-frame', className ?? ''].filter(Boolean).join(' ')} data-surface={surface} data-has-tabs={tabs ? '' : undefined}>
      {header}
      <main className="gu-frame-body">
        <div className="gu-frame-content">{children}</div>
      </main>
      {actionBar}
      {tabs}
    </div>
  );
}
