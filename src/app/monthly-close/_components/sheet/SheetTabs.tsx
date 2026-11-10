import { ChevronLeft, ChevronRight, Plus } from 'lucide-react';

export type TabKind = 'game' | 'result' | 'disguise' | 'deco';

export interface SheetTabDef {
  id: string;
  label: string;
  kind: TabKind;
  /** 결과 탭이 막 생겼고 아직 안 열어 봄 → 글자만 파랑 */
  fresh?: boolean;
}

export interface SheetTabsProps {
  /** 호출자가 순서를 정한다. 게임 탭은 항상 첫 번째, 결과 탭은 그 바로 오른쪽(디자인 B9) */
  tabs: readonly SheetTabDef[];
  activeId: string;
  onTab: (id: string, kind: TabKind) => void;
  /** 탭 끝 [+] — 숨기기 */
  onAdd?: () => void;
  addLabel?: string;
}

/** 시트 탭 줄 28px. 게임·숨기기·장식 탭은 똑같은 모양이어야 한다. 눌림은 즉시 전환(지연 금지). */
export function SheetTabs({ tabs, activeId, onTab, onAdd, addLabel = '시트 추가' }: SheetTabsProps) {
  return (
    <div className="mc-tabs" role="tablist" aria-label="시트">
      <button type="button" className="mc-tabs__nav" tabIndex={-1} aria-hidden="true">
        <ChevronLeft size={14} strokeWidth={1.5} />
      </button>
      <button type="button" className="mc-tabs__nav" tabIndex={-1} aria-hidden="true">
        <ChevronRight size={14} strokeWidth={1.5} />
      </button>
      {tabs.map((t) => (
        <button
          key={t.id}
          type="button"
          role="tab"
          className="mc-tab"
          aria-selected={t.id === activeId}
          data-kind={t.kind}
          data-fresh={t.fresh ? 'true' : undefined}
          data-mc-tab={t.kind}
          onClick={() => onTab(t.id, t.kind)}
        >
          {t.label}
        </button>
      ))}
      <button type="button" className="mc-tab mc-tab--add" aria-label={addLabel} data-mc-tab="add" onClick={onAdd}>
        <Plus size={14} strokeWidth={1.5} />
      </button>
    </div>
  );
}
