import type { RefObject } from 'react';
import type { MemoKind } from '../_components/sheet/Cell';
import type { IndustryPack } from '@/lib/monthly-close/copy/schema';
import type { Picker } from '@/lib/monthly-close/copy/pick';
import type { RoomController } from '@/lib/monthly-close/client/controller';
import type { RoomView } from '@/lib/monthly-close/protocol';
import type { ViewStore } from '@/lib/monthly-close/client/viewStore';
import type { CellSpec, PaneMemo } from './PaneGrid';
import type { GridMerge } from '../_components/sheet/SheetGrid';
import type { SelectionTone } from '../_components/sheet/Cell';
import type { KeyboardEvent, ReactNode } from 'react';

/** 이름 상자·수식 입력줄에 보일 값(단계마다 다르다) */
export interface FormulaState {
  readonly nameValue: string;
  readonly formula: string;
  readonly armed: boolean;
  readonly onNameChange?: (v: string) => void;
  readonly onNameSubmit?: (v: string) => void;
  readonly onCancel?: () => void;
  readonly onConfirm?: () => void;
}

/** 화면 조립 층이 단계 훅(Placement·Battle)에 넘기는 공용 도구 */
export interface ScreenCtx {
  readonly controller: RoomController;
  readonly view: RoomView;
  readonly pack: IndustryPack;
  readonly picker: Picker;
  readonly store: ViewStore;
  /** controller.now() — 매 틱 갱신 */
  readonly nowMs: number;
  readonly mode: 'room' | 'practice';
  /** 상태줄 한 줄(기본 5초) */
  readonly flash: (text: string, ms?: number) => void;
  /** 칸 메모(창당 1개) */
  readonly memo: (pane: 'mine' | 'opp', addr: string, kind: MemoKind, head: string, body: string) => void;
  readonly nameRef: RefObject<HTMLInputElement>;
  /** {상대} 이름(앞 4자) */
  readonly oppName: string;
}

/** 단계 훅이 돌려주는 창 두 개 분량의 속성 */
export interface PaneBundle {
  readonly formula: FormulaState;
  readonly leftSpecs: ReadonlyMap<string, CellSpec>;
  readonly rightSpecs: ReadonlyMap<string, CellSpec>;
  readonly leftMerges: readonly GridMerge[];
  readonly rightMerges: readonly GridMerge[];
  readonly leftSelected: { c: number; r: number } | null;
  readonly rightSelected: { c: number; r: number } | null;
  readonly leftRange?: { c0: number; r0: number; c1: number; r1: number } | null;
  readonly rightRange?: { c0: number; r0: number; c1: number; r1: number } | null;
  readonly rangeBad?: boolean;
  readonly rightTone?: SelectionTone;
  readonly rightHoverable?: boolean;
  readonly leftHoverable?: boolean;
  readonly rightPick?: { cols?: boolean; rows?: boolean } | null;
  readonly pickedCols?: readonly number[];
  readonly pickedRows?: readonly number[];
  readonly onPickCol?: (c: number) => void;
  readonly onPickRow?: (r: number) => void;
  readonly onLeftDown?: (c: number, r: number, e: { shiftKey: boolean; detail: number }) => void;
  readonly onRightDown?: (c: number, r: number, e: { shiftKey: boolean; detail: number }) => void;
  readonly onLeftKey?: (e: KeyboardEvent<HTMLDivElement>) => void;
  /** 왼쪽 판 칸 위로 마우스가 들어옴(배치 끌어 옮기기 미리보기) */
  readonly onLeftEnter?: (c: number, r: number) => void;
  readonly onRightKey?: (e: KeyboardEvent<HTMLDivElement>) => void;
  readonly rowHeight?: (r: number) => number | undefined;
  readonly rightHeadRight?: ReactNode;
  /** 오른쪽 창 위에 떠 있는 것(팝오버 등) */
  readonly rightOverlay?: ReactNode;
  /** 도구줄과 연결되는 값 */
  readonly toolbar: {
    readonly hintCount: number;
    readonly hintOff: boolean;
    readonly hintActive: boolean;
    readonly onHint: () => void;
    readonly tauntOff: boolean;
    readonly tauntOpen: boolean;
    readonly onTaunt: () => void;
    readonly tauntMenu: ReactNode;
  };
  /** 숨기는 순간 되돌릴 것 */
  readonly reset: () => void;
  /**
   * 모바일 확정 줄(UX §5): 선택 → 확정 2단계. 대전 `B7 반영` / 검산 `확인` / 힌트 `이 범위 검토`,
   * 배치는 [자동 배치](주) + [배치 완료](보조).
   */
  readonly mobileConfirm?: MobileConfirm;
}

export interface MobileConfirmButton {
  readonly label: string;
  readonly onConfirm: () => void;
  readonly disabled?: boolean;
  /** data-mc-cmd */
  readonly cmd?: string;
}
export interface MobileConfirm extends MobileConfirmButton {
  readonly secondary?: MobileConfirmButton;
}

export const noopToolbar: PaneBundle['toolbar'] = {
  hintCount: 0,
  hintOff: true,
  hintActive: false,
  onHint: () => undefined,
  tauntOff: true,
  tauntOpen: false,
  onTaunt: () => undefined,
  tauntMenu: null,
};
