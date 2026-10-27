// src/app/cloudcheck/_client/components/StatusBadge.tsx — 관문 ③: 상태 표시의 유일한 통로. 디자인 최종안 §5-1.
//  - 상태 글자를 줄이거나 숨기는 prop이 없다. 모양(StatusIcon) + 글자 + 색 + 선 스타일이 함께 간다. white-space:nowrap(좁으면 배지째 다음 줄).
//  - 크기: md = 점검 행·먼저 볼 3개, sm = 표·맥락 줄('확인 불가 n'), lg = V4 머리.
import type { ReactElement } from "react";
import type { Status } from "../../../../lib/cloudcheck/model/report";
import { fmtNum, t } from "../i18n/index";
import { cx } from "./cx";
import { StatusIcon } from "./StatusIcon";
import "./StatusBadge.css";

export interface StatusBadgeProps {
  readonly status: Status;
  readonly size?: "sm" | "md" | "lg";
  /** 개수(맥락 줄의 '확인 불가 n'처럼). 상태 글자 뒤에 붙는다 */
  readonly count?: number;
}

export function StatusBadge({ status, size = "md", count }: StatusBadgeProps): ReactElement {
  return (
    <span className={cx("cc-sb", `cc-st--${status}`, size === "sm" && "cc-sb--sm", size === "lg" && "cc-sb--lg")}>
      <StatusIcon status={status} size={size === "lg" ? 20 : 16} />
      <span className="cc-sb__t">{t(`cc.status.${status}`)}</span>
      {count === undefined ? null : <span className="cc-sb__n">{` ${fmtNum(count)}`}</span>}
    </span>
  );
}
