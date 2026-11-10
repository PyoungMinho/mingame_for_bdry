import type { ReactNode } from 'react';
import { cx } from './cx';

/** 창 머리 띠 24px — 문구는 props(디자인 §4-2). 숨기기 레이어에서는 필터 줄로 쓴다. */
export function PaneHead({ left, right, className }: { left: ReactNode; right?: ReactNode; className?: string }) {
  return (
    <div className={cx('mc-pane__head', className)}>
      <span>{left}</span>
      {/* 오른쪽은 "마지막 저장 HH:MM"처럼 현재 시각이 들어가 서버·브라우저 렌더가 1분 차이로 어긋날 수 있다 */}
      {right ? <span suppressHydrationWarning>{right}</span> : null}
    </div>
  );
}

export interface PaneProps {
  /** 창 머리 왼쪽 글자 */
  head: ReactNode;
  headRight?: ReactNode;
  /** "내 시트" 등 (data-pane 표식) */
  id: string;
  children: ReactNode;
  /** 창 위에 떠 있는 것(메모·토스트·팝오버). pane 좌표계 absolute */
  overlay?: ReactNode;
  className?: string;
}

export function Pane({ head, headRight, id, children, overlay, className }: PaneProps) {
  return (
    <section className={cx('mc-pane', className)} data-pane={id}>
      <PaneHead left={head} right={headRight} />
      <div className="mc-pane__body">
        {children}
        {overlay}
      </div>
    </section>
  );
}

/** 분할 창 2개. 가운데 5px 경계 막대(드래그 불가). 모바일에서는 호출자가 창 1개만 넘긴다. */
export function SplitPanes({ left, right }: { left: ReactNode; right?: ReactNode }) {
  return (
    <div className="mc-split">
      {left}
      {right ? (
        <>
          <div className="mc-split__bar" aria-hidden="true" />
          {right}
        </>
      ) : null}
    </div>
  );
}
