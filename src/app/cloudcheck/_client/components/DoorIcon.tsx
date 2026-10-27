// src/app/cloudcheck/_client/components/DoorIcon.tsx — 문 아이콘 5종(단색 선, 잉크색). 문은 판정이 아니므로 상태 색을 칠하지 않는다(UI 스펙 §3-1).
import type { ReactElement } from "react";
import type { DoorId } from "../../../../lib/cloudcheck/model/report";
import { cx } from "./cx";
import { DOOR_PATHS } from "./icons";

export interface DoorIconProps {
  readonly door: DoorId;
  readonly size?: 16 | 20 | 24 | 32;
}

export function DoorIcon({ door, size = 24 }: DoorIconProps): ReactElement {
  return (
    <svg className={cx("cc-di", size !== 16 && `cc-di--${size}`)} viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path d={DOOR_PATHS[door]} />
    </svg>
  );
}
