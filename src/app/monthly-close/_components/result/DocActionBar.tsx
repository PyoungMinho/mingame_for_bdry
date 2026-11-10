import { Button } from '../form/controls';
import { Checkbox } from '../form/controls';
import { LaughPoll, type LaughPollProps } from './LaughPoll';

export interface DocActionBarProps {
  /** [v8로 저장] — 요청 중에는 `요청함…` 비활성 */
  saveLabel: string;
  saveDisabled?: boolean;
  onSave: () => void;
  /** 저장 버튼 옆 보조 글("공동 편집자가 문서를 닫았습니다.") */
  saveAside?: string;
  copyLabel: string;
  onCopy: () => void;
  newLabel: string;
  onNew: () => void;
  laugh: LaughPollProps;
  /** 상대 이름 넣기 체크(기본 꺼짐) */
  nameToggle?: { label: string; checked: boolean; onChange: (v: boolean) => void };
  reportLabel: string;
  onReport: () => void;
  /** 신고 팝오버 등을 이 줄 안에 붙인다 (position: relative 컨테이너) */
  reportSlot?: React.ReactNode;
}

/** 결과 문서 작업 줄(폭 640). PC는 문서 위, 모바일은 문서 아래(배치는 ResultSheet·CSS). 시각적 우선순위는 [v8로 저장] > [내용 복사]. */
export function DocActionBar(p: DocActionBarProps) {
  return (
    <div className="mc-docbar" role="group" aria-label={p.saveLabel}>
      <Button cmd="save-v8" size="md" disabled={p.saveDisabled} onClick={p.onSave}>
        {p.saveLabel}
      </Button>
      {p.saveAside ? <span className="mc-docbar__sub">{p.saveAside}</span> : null}
      <Button variant="secondary" cmd="copy-text" onClick={p.onCopy}>
        {p.copyLabel}
      </Button>
      <Button variant="secondary" cmd="new-doc" onClick={p.onNew}>
        {p.newLabel}
      </Button>
      <LaughPoll {...p.laugh} />
      {p.nameToggle ? (
        <Checkbox checked={p.nameToggle.checked} onChange={p.nameToggle.onChange} cmd="name-toggle">
          {p.nameToggle.label}
        </Checkbox>
      ) : null}
      <span className="mc-docbar__sp" />
      <span className="mc-docbar__report" style={{ position: 'relative' }}>
        <Button variant="text" quiet cmd="report" onClick={p.onReport}>
          {p.reportLabel}
        </Button>
        {p.reportSlot}
      </span>
    </div>
  );
}
