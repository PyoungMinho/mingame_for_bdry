import { Cell, CELL_STATES, type CellProps } from './Cell';

interface Sample {
  key: string;
  caption: string;
  props: Omit<CellProps, 'addr'>;
}

/** 셀 상태 전부를 정지 화면으로 보이는 샘플. 페이지개발자가 /practice 에 그려 PM 눈테스트 스크린샷을 찍는다. */
export const CELL_SAMPLES: readonly Sample[] = [
  { key: 'empty', caption: '1 기본(빈칸)', props: { state: 'empty' } },
  { key: 'hover', caption: '2 호버(쏠 수 있는 창)', props: { state: 'empty', hoverable: true, demoHover: true } },
  { key: 'selected', caption: '3 선택(파랑 2px + 핸들)', props: { state: 'empty', selected: true } },
  { key: 'range', caption: '4 범위(점선)', props: { state: 'empty', range: { t: true, b: true, l: true, r: true } } },
  { key: 'mine', caption: '5 내 항목', props: { state: 'mine', label: '법카' } },
  { key: 'miss', caption: '6 해당 없음', props: { state: 'miss', label: '0', memo: 'miss' } },
  { key: 'hit', caption: '7 반려(상대 시트)', props: { state: 'hit', label: '1', memo: 'hit' } },
  { key: 'hit-mine', caption: '7 반려(내 시트, 취소선)', props: { state: 'hit', label: '법카', strike: true, memo: 'hit' } },
  { key: 'sunk', caption: '8 종결', props: { state: 'sunk', label: '법카', memo: 'sunk' } },
  { key: 'reveal', caption: '9 종료 후 공개', props: { state: 'reveal', label: '법카' } },
  { key: 'locked', caption: '10 잠김(회색 선택선)', props: { state: 'miss', label: '0', selected: true, selectionTone: 'locked' } },
  { key: 'readonly', caption: '11 읽기 전용 선택', props: { state: 'empty', selected: true, selectionTone: 'readonly' } },
];

/** 상태 종류 누락 방지용(테스트에서 CELL_STATES 가 전부 보이는지 확인) */
export const SAMPLED_STATES = CELL_STATES;

export function CellStateSampler() {
  return (
    <div className="mc-sampler" role="grid" aria-label="셀 상태 견본">
      {CELL_SAMPLES.map((s, i) => (
        <div key={s.key} className="mc-sampler__item" role="row">
          <span className="mc-sampler__cap">{s.caption}</span>
          <Cell {...s.props} addr={`A${i + 1}`} />
        </div>
      ))}
    </div>
  );
}
