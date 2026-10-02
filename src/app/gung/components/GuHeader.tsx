/**
 * §5-2 GuHeader — 56px sticky. 좌측 뒤로/되돌리기, 중앙 단계명(+있으면 레일), 우측 화면꺼짐방지·메뉴.
 */
import { ChevronLeft, CircleHelp, EllipsisVertical, Flame, Moon, Undo2 } from 'lucide-react';
import type { ReactNode } from 'react';
import { PhaseRail } from './PhaseRail';
import type { RailStep } from './types';

export interface GuHeaderProps {
  left?: 'back' | 'undo' | null;
  onLeft?: () => void;
  title: string;
  /** 있으면 title 아래 5기둥 레일을 렌더(§1-4). 없으면 title만(셋업 화면) */
  rail?: { current: RailStep; onTap?: () => void };
  /** 🕯 점등(ON) / 🌙 미지원(OFF) / 표시 안 함(NA) */
  wake?: 'on' | 'off' | 'na';
  onMenu?: () => void;
  /** 「?」 용어 풀이·시각표(원고 1-5·1-6) — 모든 폰·모든 역할에 같은 버튼 */
  onHelp?: () => void;
  rightExtra?: ReactNode;
  className?: string;
}

export function GuHeader({ left = null, onLeft, title, rail, wake = 'na', onMenu, onHelp, rightExtra, className }: GuHeaderProps) {
  return (
    <header className={['gu-header', className ?? ''].filter(Boolean).join(' ')}>
      <div className="gu-header-bar">
        <div className="gu-header-left">
          {left === 'back' && (
            <button type="button" className="gu-header-iconbtn" onClick={onLeft} aria-label="뒤로">
              <ChevronLeft aria-hidden />
            </button>
          )}
          {left === 'undo' && (
            <button type="button" className="gu-header-iconbtn" onClick={onLeft} aria-label="되돌리기">
              <Undo2 aria-hidden />
            </button>
          )}
        </div>
        <h1 className="gu-header-title gu-display">{title}</h1>
        <div className="gu-header-right">
          {wake !== 'na' &&
            (wake === 'on' ? (
              <Flame aria-hidden className="gu-header-wake" data-on="" />
            ) : (
              <Moon aria-hidden className="gu-header-wake" />
            ))}
          {rightExtra}
          {onHelp && (
            <button type="button" className="gu-header-iconbtn" onClick={onHelp} aria-label="용어 풀이·시각표">
              <CircleHelp aria-hidden />
            </button>
          )}
          {onMenu && (
            <button type="button" className="gu-header-iconbtn" onClick={onMenu} aria-label="메뉴">
              <EllipsisVertical aria-hidden />
            </button>
          )}
        </div>
      </div>
      {rail && <PhaseRail current={rail.current} onTap={rail.onTap} className="gu-header-rail" />}
    </header>
  );
}
