/**
 * §5-12 PlaceGrid — 2열, 타일 min-h 100. 선택 = cta 보더+glow+Check. 잠김 = 선택 외 타일 40%.
 */
import { Check } from 'lucide-react';
import { PlaceIcon } from './icons';
import type { PlaceSummary } from './types';

export interface PlaceGridProps {
  places: PlaceSummary[];
  selected?: string | null;
  onSelect: (id: string) => void;
  /** 선택 확정 후 — 선택 외 타일은 흐리게, 탭 무시 */
  locked?: boolean;
  className?: string;
}

export function PlaceGrid({ places, selected, onSelect, locked, className }: PlaceGridProps) {
  return (
    <div className={['gu-placegrid', className ?? ''].filter(Boolean).join(' ')}>
      {places.map((p) => {
        const isSelected = selected === p.id;
        const dim = locked && !isSelected;
        return (
          <button key={p.id} type="button" className="gu-place-tile" data-selected={isSelected || undefined} data-dim={dim || undefined} disabled={locked && !isSelected} onClick={() => onSelect(p.id)}>
            {isSelected && <Check aria-hidden size={16} className="gu-place-check" />}
            <PlaceIcon iconKey={p.icon} size={28} />
            <span className="gu-place-name gu-display">{p.name}</span>
            {p.sub && <span className="gu-place-sub">{p.sub}</span>}
          </button>
        );
      })}
    </div>
  );
}
