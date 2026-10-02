/**
 * §5-14 SeatGrid — 지목 전용. 3열(후보 5~6)/2열(≤4), 타일 min 104×96. 선택 = cta 채움 + cta-ink.
 */
import { RoleIcon } from './icons';
import type { SeatGridItem } from './types';

export interface SeatGridProps {
  seats: SeatGridItem[];
  exclude?: number[];
  selected?: number | null;
  onSelect?: (seat: number) => void;
  /** intro 이후만 역할명 노출(§3 D16) */
  showRoles?: boolean;
  className?: string;
}

export function SeatGrid({ seats, exclude = [], selected, onSelect, showRoles = true, className }: SeatGridProps) {
  const visible = seats.filter((s) => !exclude.includes(s.seat));
  const cols = visible.length <= 4 ? 2 : 3;
  return (
    <div className={['gu-seatgrid', className ?? ''].filter(Boolean).join(' ')} data-cols={cols} role="group" aria-label="자리 선택">
      {visible.map((s) => {
        const isSelected = selected === s.seat;
        return (
          <button key={s.seat} type="button" className="gu-seatgrid-tile" data-selected={isSelected || undefined} onClick={() => onSelect?.(s.seat)} aria-label={`${s.seat}번${showRoles && s.roleName ? ` · ${s.roleName}` : ''}`}>
            <span className="gu-seatgrid-num gu-num">{s.seat}</span>
            {showRoles && s.icon && <RoleIcon iconKey={s.icon} size={20} />}
            {showRoles && s.roleName && <span className="gu-seatgrid-role gu-display">{s.roleName}</span>}
          </button>
        );
      })}
    </div>
  );
}
