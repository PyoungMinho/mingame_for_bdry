/**
 * §5-13 SeatRing — 자리 1을 12시, 시계 방향 배치. 원 지름 min(76vw, 280px)(gung.css). 노드 72(pick)/64.
 * 위치는 퍼센트 좌표(삼각함수)로 계산해 컨테이너 실제 픽셀 크기와 무관하게 동작한다.
 */
import { Check, UserX } from 'lucide-react';
import type { SeatRingItem } from './types';

export interface SeatRingProps {
  n: number;
  mode: 'pick' | 'rollcall' | 'progress' | 'absent';
  items: SeatRingItem[]; // length === n
  onTapSeat?: (seat: number) => void;
  hostSeat?: number;
  className?: string;
}

const RADIUS_PCT = 38;

export function SeatRing({ n, mode, items, onTapSeat, hostSeat = 1, className }: SeatRingProps) {
  const nodeSize = mode === 'pick' ? 72 : 64;
  return (
    <div className={['gu-seatring', className ?? ''].filter(Boolean).join(' ')} role="group" aria-label="자리">
      {items.map((item) => {
        const angleDeg = ((item.seat - 1) / n) * 360 - 90;
        const rad = (angleDeg * Math.PI) / 180;
        const x = 50 + RADIUS_PCT * Math.cos(rad);
        const y = 50 + RADIUS_PCT * Math.sin(rad);
        const isHost = item.seat === hostSeat;
        const interactive = !!onTapSeat && item.state !== 'disabled' && item.state !== 'absent';
        return (
          <button
            key={item.seat}
            type="button"
            className="gu-seat-node"
            data-state={item.state}
            style={{ left: `${x}%`, top: `${y}%`, width: nodeSize, height: nodeSize }}
            disabled={!interactive}
            onClick={() => onTapSeat?.(item.seat)}
            aria-label={`${item.seat}번${isHost ? ' · 방장' : ''}${item.label ? ` · ${item.label}` : ''}${item.state === 'checked' ? ' · 확인됨' : ''}`}
          >
            <span className="gu-seat-num gu-num">{item.seat}</span>
            {item.state === 'checked' && <Check aria-hidden size={16} className="gu-seat-icon" />}
            {item.state === 'absent' && <UserX aria-hidden size={16} className="gu-seat-icon" />}
            {isHost && <span className="gu-seat-tag">방장</span>}
            {item.label && <span className="gu-seat-label">{item.label}</span>}
          </button>
        );
      })}
    </div>
  );
}
