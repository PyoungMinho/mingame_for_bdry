import type { ReactNode } from 'react';
import { PaneHead } from '../sheet/Panes';
import { SheetGrid } from '../sheet/SheetGrid';

export interface ResultSheetProps {
  /** 시트 탭 이름 (시말서 등) */
  label: string;
  filterLeft: string;
  filterRight: string;
  /** <ResultDoc/> */
  doc: ReactNode;
  /** <DocActionBar/> */
  actions: ReactNode;
}

/**
 * 결과 탭: 눈금선을 끈 시트(보기 > 눈금선 해제와 같다) 위에 문서와 작업 줄을 얹는다.
 * 열·행 머리글은 그대로(셸 불변). 문서 왼쪽 여백 = A열 폭(64px). 작업 줄은 1행 위끝(+8px)에서 시작하고 문서는 그 아래 12px.
 * 이 탭을 보는 중에도 Tab·Esc 는 숨기기다 — 이 컴포넌트는 키를 가로채지 않는다.
 */
export function ResultSheet({ label, filterLeft, filterRight, doc, actions }: ResultSheetProps) {
  return (
    <div className="mc-pane mc-pane--single" data-pane="result">
      <PaneHead left={filterLeft} right={filterRight} />
      <div className="mc-pane__body">
        <SheetGrid
          label={label}
          colWidths={Array.from({ length: 12 }, () => null)}
          rowCount={36}
          gridlines={false}
          // `/` 명령 이동 모드를 끝내면 포커스를 이 시트로 돌려받는다(없으면 마지막 버튼에 남아 다음 `/`가 모드 재시작이 아닌 토글로 꼬였다)
          gridFocus
          renderCell={() => null}
          overlay={
            // 작업 줄을 문서 위에 둔다(디자인 리뷰 M5: 노트북 높이 1280×640·1366×657에서 문서 아래 작업 줄이 스크롤해야 보였다).
            // 위치·순서는 CSS(.mc-doc-stack): PC = 행 머리 40 + A열 64에서 시작, 작업 줄 → 문서. 모바일 = 왼쪽 8px, 문서 → 작업 줄(M4, UI §7-4)
            <div className="mc-doc-stack">
              {actions}
              {doc}
            </div>
          }
        />
      </div>
    </div>
  );
}
