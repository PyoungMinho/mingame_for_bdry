import { MoreHorizontal } from 'lucide-react';
import { Button } from '../form/controls';
import { SheetTabs, type SheetTabsProps } from '../sheet/SheetTabs';

export interface MobileTopBarProps {
  fileName: string;
  shareLabel: string;
  /** 방 번호가 없으면(연습) 비활성 */
  shareDisabled?: boolean;
  onShare?: () => void;
  moreLabel: string;
  /** [⋯] 메뉴가 열려 있는가(aria-expanded) */
  moreOpen?: boolean;
  onMore: () => void;
}

/** 모바일 상단바 40px: 파일명(말줄임) + [공유] + [⋯]. 메뉴줄·도구줄 생략. */
export function MobileTopBar({ fileName, shareLabel, shareDisabled, onShare, moreLabel, moreOpen, onMore }: MobileTopBarProps) {
  return (
    <header className="mc-mtop">
      <span className="mc-mtop__file">{fileName}</span>
      <Button cmd="share" disabled={shareDisabled} onClick={onShare}>
        {shareLabel}
      </Button>
      <button
        type="button"
        className="mc-mtop__more"
        data-mc-cmd="more"
        aria-label={moreLabel}
        aria-haspopup="menu"
        aria-expanded={!!moreOpen}
        onClick={onMore}
      >
        <MoreHorizontal size={18} strokeWidth={1.5} />
      </button>
    </header>
  );
}

export interface MobileSheetTabsProps extends SheetTabsProps {
  /**
   * 숫자 키보드가 올라와 있을 때: 키보드 바로 위(visualViewport 아래 끝)에 붙인다.
   * 값 = 화면 아래 끝에서 키보드 높이(px). 없으면 평소 위치.
   * 탭을 한 번 누르면 입력칸 blur(키보드 내림) + 숨기기를 같은 탭에서 처리한다(페이지개발자가 onTab 에서).
   */
  keyboardOffset?: number | null;
}

/** 시트 탭 줄 44px(+safe-area). 평소 손동작(아래 탭 한 번)이 키보드 중에도 유지된다. */
export function MobileSheetTabs({ keyboardOffset, ...tabs }: MobileSheetTabsProps) {
  const kb = keyboardOffset != null;
  return (
    <div className="mc-mtabs" data-keyboard={kb ? 'true' : undefined} style={kb ? { bottom: keyboardOffset! } : undefined}>
      <SheetTabs {...tabs} />
    </div>
  );
}

export interface MemoLineProps {
  /** 메모가 있으면 메모, 없으면 상태 문장. 모바일은 상태줄이 없다 */
  text: string;
  /** 남은 시간 `00:14` 고정 표시 */
  time?: string;
}

/** 메모 줄 36px(최대 2줄) + 오른쪽 끝 남은 시간. */
export function MemoLine({ text, time }: MemoLineProps) {
  return (
    <div className="mc-memoline" role="status" aria-live="polite">
      <span className="mc-memoline__text">{text}</span>
      {time ? <span className="mc-memoline__time">{time}</span> : null}
    </div>
  );
}

export interface ConfirmRowProps {
  /** `B7 반영` / `확인` / `이 범위 검토` / `자동 배치` */
  label: string;
  onConfirm: () => void;
  disabled?: boolean;
}

/** 확정 줄 48px — 확정 버튼 1개(높이 44, 폭 96+). 같은 칸 다시 탭으로도 확정된다. */
export function ConfirmRow({ label, onConfirm, disabled }: ConfirmRowProps) {
  return (
    <div className="mc-confirmrow">
      <Button cmd="confirm" disabled={disabled} onClick={onConfirm}>
        {label}
      </Button>
    </div>
  );
}
