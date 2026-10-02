/**
 * §5-9 SectionChips — 7칩 2줄 고정 그리드(4+3). 모든 역할에 같은 순서·같은 개수(D3: 범인/무고 화면 동일).
 */
import { SECTION_LABEL, SECTION_ORDER, type SectionKey } from './types';

export interface SectionChipsProps {
  active: SectionKey;
  onChange: (section: SectionKey) => void;
  /** 기본값 SECTION_ORDER(7개 전부) — 다른 순서/부분집합이 필요할 때만 넘긴다 */
  sections?: readonly SectionKey[];
  className?: string;
}

export function SectionChips({ active, onChange, sections = SECTION_ORDER, className }: SectionChipsProps) {
  return (
    <div className={['gu-chips', className ?? ''].filter(Boolean).join(' ')} role="tablist" aria-label="내 패 섹션">
      {sections.map((s) => (
        <button key={s} type="button" role="tab" aria-selected={active === s} className="gu-chip" data-active={active === s || undefined} onClick={() => onChange(s)}>
          {SECTION_LABEL[s]}
        </button>
      ))}
    </div>
  );
}
