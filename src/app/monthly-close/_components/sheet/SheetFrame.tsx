import type { ReactNode } from 'react';
import { cx } from './cx';

export type ShellView = 'game' | 'disguise';

export interface SheetShellProps {
  /** 지금 보이는 레이어. 속성 하나만 바꾼다(두 레이어는 둘 다 미리 마운트) */
  view: ShellView;
  /** 1024px 미만 / 모바일 배치 */
  mobile?: boolean;
  /** 상단바~수식 입력줄(불변 크롬). 순서대로 넣는다: TopBar, MenuBar, ToolBar, FormulaBar */
  chrome: ReactNode;
  /** 게임 레이어 내용 (SplitPanes 등) — 메모·토스트·대화상자도 여기 안에 둔다(숨기면 자동으로 사라져야 하므로) */
  game: ReactNode;
  /** 숨기기 레이어 내용 (DisguiseSheet / DecoSheet) */
  disguise: ReactNode;
  /** 시트 탭 줄 + 상태줄 (불변 크롬) */
  footer: ReactNode;
  /** 크롬과 body 사이에 끼는 것 (모바일 메모 줄 등은 footer 쪽에 둔다) */
  className?: string;
}

/**
 * 시트 셸: `.mc-shell` (position: fixed; inset: 0; height: 100dvh).
 * 상단바~수식줄, 시트 탭, 상태줄은 레이어가 바뀌어도 1px도 움직이지 않는다.
 * 레이어 전환은 display: none 만 쓴다(투명도·좌표 이동·visibility 금지).
 */
export function SheetShell({ view, mobile, chrome, game, disguise, footer, className }: SheetShellProps) {
  return (
    <div className={cx('mc-shell', className)} data-view={view} data-mobile={mobile ? 'true' : undefined}>
      {chrome}
      <div className="mc-body">
        <div className="mc-layer mc-layer--game" data-layer="game">{game}</div>
        <div className="mc-layer mc-layer--disguise" data-layer="disguise">{disguise}</div>
      </div>
      {footer}
    </div>
  );
}

/** 같은 컴포넌트의 별칭 — 디자인 문서의 SheetFrame 이름. */
export const SheetFrame = SheetShell;
