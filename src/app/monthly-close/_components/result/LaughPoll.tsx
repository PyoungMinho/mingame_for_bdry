import { SegmentedChoice, type SegmentedOption } from '../form/controls';

export type LaughValue = 'none' | 'some' | 'lol';

export interface LaughPollProps {
  /** "피식했나요?" */
  question: string;
  /** [아니요][약간][많이] */
  options: readonly [SegmentedOption<LaughValue>, SegmentedOption<LaughValue>, SegmentedOption<LaughValue>];
  value: LaughValue | null;
  onChange: (v: LaughValue) => void;
  /** 응답 뒤에는 버튼이 눌린 채 고정된다 */
  disabled?: boolean;
}

/** 피식 응답 — 1탭, 선택은 `✓ ` 접두 + aria-pressed(색에만 의존하지 않는다). */
export function LaughPoll({ question, options, value, onChange, disabled }: LaughPollProps) {
  return (
    <>
      <span className="mc-docbar__q">{question}</span>
      <SegmentedChoice label={question} options={options} value={value} onChange={onChange} cmdPrefix="laugh" disabled={disabled} />
    </>
  );
}
