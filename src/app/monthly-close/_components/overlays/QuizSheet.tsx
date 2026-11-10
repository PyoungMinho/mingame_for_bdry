import type { ExtraMap } from '../board/extras';

export interface QuizSheetOpts {
  /** 10행 A10:G10 병합 라벨(≤24자) */
  label: string;
  /** H10 남은 시간 `00:07` */
  remain: string;
  /** 11행 머리: [A11 머리, 값 머리…] (값 머리는 B부터, 최대 3개) */
  heads: readonly string[];
  /** G11:H11 단위 `(단위: 만원)`. null 이면 비움 */
  unit: string | null;
  /** A12 라벨 (`금액` / `값`) */
  valueLabel: string;
  /** B12.. 값 */
  values: readonly string[];
  /** A13 입력 행 라벨 (`합계`/`부가세`/`차액`/`차이`) */
  rowLabel: string;
  /** E13:H13 흐린 안내 (≤14자) */
  inputHint: string;
  input: {
    value: string;
    placeholder: string;
    /** 오답 3초 잠금: 입력칸이 `#VALUE!` 로 바뀌고 입력 불가 */
    wrong?: boolean;
    /** 정답 제출 뒤 서버 대기 */
    locked?: boolean;
    onChange: (v: string) => void;
    onSubmit: (v: string) => void;
    ariaLabel: string;
  };
}

/**
 * 오른쪽 창 10~13행을 검산 표로 교체하는 칸 모음 (QuizSheet).
 * 확정은 Enter 만(Tab = 숨기기). 숫자 키패드 의도라 inputMode=numeric 은 BoardPane 이 붙인다.
 * 오답 메모는 입력 병합(B13:D13) 오른쪽 위에 CellMemo 로 붙인다(기준 칸 B13, 페이지개발자 — 디자인 리뷰 M2 정정).
 */
export function quizExtras(o: QuizSheetOpts): ExtraMap {
  const out: ExtraMap = {
    A10: { text: o.label, span: 7, align: 'left' },
    H10: { text: o.remain, align: 'right' },
    A11: { text: o.heads[0] ?? '', tone: 'head' },
    A12: { text: o.valueLabel, tone: 'label' },
    A13: { text: o.rowLabel, tone: 'label' },
    E13: { text: o.inputHint, span: 4, tone: 'faint', align: 'left' },
  };
  o.heads.slice(1, 4).forEach((h, i) => {
    out[`${'BCD'[i]}11`] = { text: h, tone: 'head' };
  });
  if (o.unit) out.G11 = { text: o.unit, span: 2, tone: 'faint', align: 'right' };
  o.values.slice(0, 3).forEach((v, i) => {
    out[`${'BCD'[i]}12`] = { text: v, align: 'right' };
  });
  out.B13 = {
    span: 3,
    tone: o.input.wrong ? 'error' : undefined,
    input: {
      value: o.input.wrong ? '#VALUE!' : o.input.value,
      placeholder: o.input.placeholder,
      locked: o.input.wrong || o.input.locked,
      ariaLabel: o.input.ariaLabel,
      onChange: o.input.onChange,
      onSubmit: o.input.onSubmit,
    },
  };
  return out;
}
