import { Dropdown, type DropdownItem } from './Popovers';

export interface TauntPickerProps {
  /** 도발 목록(문구 팩의 의견 문구). aside = 쿨다운 보조 글자 ("2회차 뒤 가능") */
  items: readonly DropdownItem[];
  activeIndex?: number;
  onPick: (id: number) => void;
  /** 스크린리더 이름 (도구줄 버튼 이름과 같게) */
  label: string;
}

/** 도구줄 [의견 남기기 ▾] 아래 드롭다운. 쿨다운 중이면 모든 항목이 disabled + aside. */
export function TauntPicker({ items, activeIndex, onPick, label }: TauntPickerProps) {
  return <Dropdown items={items} activeIndex={activeIndex} onPick={(id) => onPick(Number(id))} cmdPrefix="taunt" label={label} />;
}
