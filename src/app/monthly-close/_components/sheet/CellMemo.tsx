import type { CSSProperties } from 'react';
import type { MemoKind } from './Cell';

export interface CellMemoProps {
  kind: MemoKind;
  /** 머리 줄 ("B님 · 방금" / "검토 결과") 11px */
  head: string;
  /** 본문 12px, 최대 3줄 */
  body: string;
  /** 창(pane__body) 기준 위치(px). placeMemo()로 구한다 */
  x: number;
  y: number;
  /** 왼쪽으로 뒤집혔는가 (data 표식용) */
  flip?: boolean;
}

/**
 * 셀 메모 말풍선. 표시·닫힘은 즉시(페이드 금지), 꼬리·연결선 없음, title/dialog 금지.
 * 포인터를 가로채지 않고(pointer-events: none) 읽기 전용이다. 스크린리더에는 상태줄이 같은 결과를 낭독하므로 aria-live 없음.
 */
export function CellMemo({ kind, head, body, x, y, flip }: CellMemoProps) {
  const style: CSSProperties = { left: x, top: y };
  return (
    <div className="mc-memo" role="note" data-kind={kind} data-flip={flip ? 'true' : undefined} style={style} aria-live="off">
      <div className="mc-memo__head">{head}</div>
      <div className="mc-memo__body">{body}</div>
    </div>
  );
}
