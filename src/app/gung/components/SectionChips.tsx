/**
 * §5-9 SectionChips — 6칩 2줄 고정 그리드(3+3, 6판에서 '말투' 삭제). 모든 역할에 같은 순서·같은 개수(D3: 범인/무고 화면 동일).
 * 개선 묶음 1(R1 P1): 한 번 연 칩엔 작은 점 — 내가 연 기록일 뿐(저장 안 함, 새 판이면 지움). 역할과 무관하다.
 */
import { SECTION_LABEL, SECTION_ORDER, type SectionKey } from './types';

export interface SectionChipsProps {
  active: SectionKey;
  onChange: (section: SectionKey) => void;
  /** 기본값 SECTION_ORDER(6개 전부) — 다른 순서/부분집합이 필요할 때만 넘긴다 */
  sections?: readonly SectionKey[];
  /** 한 번 열어 본 섹션 — 칩에 '봤음' 점 */
  seen?: Partial<Record<SectionKey, boolean>>;
  className?: string;
}

export function SectionChips({ active, onChange, sections = SECTION_ORDER, seen, className }: SectionChipsProps) {
  return (
    <div className={['gu-chips', className ?? ''].filter(Boolean).join(' ')} role="tablist" aria-label="내 패 섹션">
      {sections.map((s) => (
        <button
          key={s}
          type="button"
          role="tab"
          aria-selected={active === s}
          className="gu-chip"
          data-active={active === s || undefined}
          data-seen={seen?.[s] || undefined}
          onClick={() => onChange(s)}
        >
          {SECTION_LABEL[s]}
          {/* 장식 점 — 탭 이름(접근성 이름)은 그대로 둔다 */}
          {seen?.[s] && <span className="gu-chip-seen" aria-hidden />}
        </button>
      ))}
    </div>
  );
}
