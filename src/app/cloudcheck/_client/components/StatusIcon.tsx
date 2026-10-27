// src/app/cloudcheck/_client/components/StatusIcon.tsx — 상태 도형 5종(▲◆●■◌). 디자인 R2·G-D2: import는 StatusBadge·DistributionChips·StatusLegend 셋뿐.
// 항상 aria-hidden — 상태는 옆의 상태 글자가 전한다(도형만 있는 상태 표시 0, G-D3). 색·굵기는 클래스(.cc-si--<status>)가 준다.
import type { ReactElement } from "react";
import type { Status } from "../../../../lib/cloudcheck/model/report";
import { cx } from "./cx";
import { STATUS_SHAPES } from "./icons";

export interface StatusIconProps {
  readonly status: Status;
  readonly size?: 16 | 20 | 24;
}

export function StatusIcon({ status, size = 16 }: StatusIconProps): ReactElement {
  const shape = STATUS_SHAPES[status];
  return (
    <svg className={cx("cc-si", `cc-si--${status}`, size === 20 && "cc-si--20", size === 24 && "cc-si--24")} viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      {shape.circle ? <circle className="cc-si__s" cx="12" cy="12" r="9" /> : <path className="cc-si__s" d={shape.d} />}
      <path className="cc-si__g" d={shape.glyph} />
    </svg>
  );
}
