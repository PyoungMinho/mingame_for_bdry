import type { CellTone } from '../sheet/Cell';

/** 판 바깥 표의 칸 한 개. 키는 주소("A10"). 병합은 왼쪽 위 칸에 span. */
export interface ExtraCell {
  text?: string;
  /** 오른쪽으로 병합하는 칸 수 */
  span?: number;
  tone?: CellTone;
  align?: 'left' | 'center' | 'right';
  button?: { cmd: string; label: string; disabled?: boolean; onClick?: () => void };
  input?: {
    value: string;
    placeholder?: string;
    locked?: boolean;
    ariaLabel: string;
    onChange?: (v: string) => void;
    /** Enter (한글 조합 중 제외). Tab 은 가로채지 않는다(Tab = 숨기기) */
    onSubmit?: (v: string) => void;
  };
}

export type ExtraMap = Record<string, ExtraCell>;

export const merge = (...maps: (ExtraMap | undefined)[]): ExtraMap => Object.assign({}, ...maps.filter(Boolean));

/** 문자열 짧게(칸 글자 수 제한용 방어) */
export const clip = (s: string, n: number): string => (Array.from(s).length > n ? Array.from(s).slice(0, n).join('') : s);
