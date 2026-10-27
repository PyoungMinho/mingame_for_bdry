// src/app/cloudcheck/_client/components/Icon.tsx — UI 아이콘 5종(external·chevron·file·back·close). 잉크색, 상태 색 금지. 아이콘만 있는 버튼은 만들지 않는다(항상 글자가 곁에).
import type { ReactElement } from "react";
import { cx } from "./cx";
import { ICON_DEFAULT_SIZE, ICON_PATHS, type IconName } from "./icons";

export interface IconProps {
  readonly name: IconName;
  readonly size?: 16 | 20 | 24;
  /** 추가 클래스(cc- 접두 토큰만): 예 DocLink의 cc-ext__i(인쇄에서 숨김), 접힘 버튼의 cc-chev(회전) */
  readonly className?: string;
}

export function Icon({ name, size, className }: IconProps): ReactElement {
  const s = size ?? ICON_DEFAULT_SIZE[name];
  return (
    <svg className={cx("cc-ic", s !== 16 && `cc-ic--${s}`, className)} viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path d={ICON_PATHS[name]} />
    </svg>
  );
}
