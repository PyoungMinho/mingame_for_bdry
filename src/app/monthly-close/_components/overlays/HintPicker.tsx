import { hintRange, formatRange, type HintTarget } from '@/lib/monthly-close/coords';
import { Dropdown, type DropdownItem } from './Popovers';

export type HintPickKind = HintTarget['kind'];

/** 범위 고르기 중 이름 상자·수식 입력줄에 넣을 미리보기 (UX §4-8). 결과값은 붙이지 않는다. */
export function hintPreview(target: HintTarget): { name: string; formula: string } {
  const name = formatRange(hintRange(target));
  return { name, formula: `=COUNTIF(${name},">0")` };
}

export interface HintPickerProps {
  /** 세 가지 고르기 방식의 이름 (열 / 행 / 칸 3×3) — 문구 팩 */
  labels: Readonly<Record<HintPickKind, string>>;
  active: HintPickKind | null;
  onChoose: (kind: HintPickKind) => void;
  label: string;
}

/**
 * [Σ(n)] 아래에서 고르기 방식을 바꾸고 싶을 때 쓰는 작은 드롭다운(선택 사항).
 * 기본 흐름은 Σ 를 누르면 곧바로 범위 고르기 모드이고, 실제 고르기는 상대 시트의
 * 열 머리글(열 전체)·행 번호(행 전체)·칸(3×3)을 눌러서 한다 → BoardPane 의 `pick` props.
 */
export function HintPicker({ labels, active, onChoose, label }: HintPickerProps) {
  const kinds: HintPickKind[] = ['col', 'row', 'block'];
  const items: DropdownItem[] = kinds.map((k) => ({ id: k, label: `${active === k ? '✓ ' : ''}${labels[k]}` }));
  return <Dropdown items={items} onPick={(id) => onChoose(id as HintPickKind)} cmdPrefix="hint-kind" label={label} />;
}
