import { useState } from 'react';
import { Button, RadioRow, type RadioOption } from '../form/controls';
import { Popover } from '../overlays/Popovers';

export type ReportTarget = 'memo' | 'taunt' | 'doc';

export interface ReportPopoverProps {
  title: string;
  /** 메모 / 도발 / 문서 3택 */
  options: readonly [RadioOption<ReportTarget>, RadioOption<ReportTarget>, RadioOption<ReportTarget>];
  sendLabel: string;
  cancelLabel: string;
  onSend: (target: ReportTarget) => void;
  onCancel: () => void;
}

/** [불편한 문구 신고] 인라인 팝오버. 위로 열린다(작업 줄 아래가 화면 끝일 수 있음). */
export function ReportPopover({ title, options, sendLabel, cancelLabel, onSend, onCancel }: ReportPopoverProps) {
  const [target, setTarget] = useState<ReportTarget | null>(null);
  return (
    <Popover title={title} style={{ right: 0, bottom: '100%', marginBottom: 4, minWidth: 260 }}>
      <RadioRow label={title} options={options} value={target} onChange={setTarget} />
      <div className="mc-pop__row">
        <Button variant="secondary" cmd="report-cancel" onClick={onCancel}>
          {cancelLabel}
        </Button>
        <Button cmd="report-send" disabled={!target} onClick={() => target && onSend(target)}>
          {sendLabel}
        </Button>
      </div>
    </Popover>
  );
}
