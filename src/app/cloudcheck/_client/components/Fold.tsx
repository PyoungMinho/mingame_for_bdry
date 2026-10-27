// src/app/cloudcheck/_client/components/Fold.tsx — 접힘 패턴(디자인 R6): V3~V5는 <details>를 쓰지 않고 '버튼 + 영역'만 쓴다.
//  - 버튼 .cc-tog[aria-expanded][aria-controls] + 영역 .cc-fold(열림 .cc-open, 인쇄 펼침 .cc-po). 접힌 영역도 DOM에 항상 렌더한다(인쇄가 CSS로 펼치므로).
//  - 인쇄에서 펼쳐지는 접힘의 '더 보기'류 버튼에는 cc-noprint를 붙인다(noPrint), 제목을 담은 토글(점검 행·일반 알림 제목)은 인쇄에 남긴다.
//  - 열림 상태: 기본은 컴포넌트 로컬 상태. 페이지가 V4 → V3 복원(스크롤·펼침 유지)을 하려면 앱 상태(view)를 <FoldProvider control>로 내려 보낸다.
//    같은 id를 가진 접힘은 같은 상태를 읽는다(점검 id·알림 종류처럼 리포트 안에서 안정적인 값).
import { createContext, useCallback, useContext, useId, useState, type ReactElement, type ReactNode } from "react";
import { cx } from "./cx";
import { Icon } from "./Icon";

/** 페이지(앱 상태)가 접힘 상태를 소유할 때 쓰는 제어 객체 */
export interface FoldControl {
  /** 저장된 열림 여부(없으면 undefined → defaultOpen) */
  readonly isOpen: (id: string) => boolean | undefined;
  readonly setOpen: (id: string, open: boolean) => void;
}

const FoldContext = createContext<FoldControl | null>(null);

export interface FoldProviderProps {
  readonly control: FoldControl;
  readonly children: ReactNode;
}

export function FoldProvider({ control, children }: FoldProviderProps): ReactElement {
  return <FoldContext.Provider value={control}>{children}</FoldContext.Provider>;
}

export interface FoldState {
  readonly open: boolean;
  readonly toggle: () => void;
  readonly setOpen: (open: boolean) => void;
  /** 버튼의 aria-controls가 가리키는 영역 id */
  readonly regionId: string;
}

export function useFold(id: string, defaultOpen = false): FoldState {
  const ctl = useContext(FoldContext);
  const [local, setLocal] = useState(defaultOpen);
  const regionId = useId();
  const open = ctl === null ? local : (ctl.isOpen(id) ?? defaultOpen);
  const setOpen = useCallback(
    (next: boolean) => {
      if (ctl === null) setLocal(next);
      else ctl.setOpen(id, next);
    },
    [ctl, id],
  );
  const toggle = useCallback(() => setOpen(!open), [setOpen, open]);
  return { open, toggle, setOpen, regionId };
}

export interface FoldButtonProps {
  readonly fold: FoldState;
  readonly children: ReactNode;
  /** 추가 클래스(cc- 접두 토큰만) */
  readonly className?: string;
  /** 오른쪽 chevron(펼침 시 180° 회전). 기본 켬 */
  readonly chevron?: boolean;
  /** 인쇄에서 숨김('더 보기'류 버튼) */
  readonly noPrint?: boolean;
  /** 버튼 id(포커스 복원·aria-labelledby용) */
  readonly id?: string;
  /** 접근 이름을 다른 요소들의 글자로 구성(예: 버튼 자기 id + 점검 제목 id) */
  readonly labelledBy?: string;
}

export function FoldButton({ fold, children, className, chevron = true, noPrint = false, id, labelledBy }: FoldButtonProps): ReactElement {
  return (
    <button
      type="button"
      id={id}
      className={cx("cc-tog", className, noPrint && "cc-noprint")}
      aria-expanded={fold.open}
      aria-controls={fold.regionId}
      aria-labelledby={labelledBy}
      onClick={fold.toggle}
    >
      {children}
      {chevron ? <Icon name="chevron" size={20} className="cc-chev" /> : null}
    </button>
  );
}

export interface FoldRegionProps {
  readonly fold: FoldState;
  readonly children: ReactNode;
  readonly className?: string;
  /** expand = 인쇄에서 펼침(.cc-po) / hide = 인쇄에서 숨김(.cc-noprint) / 생략 = 화면 상태 그대로 */
  readonly print?: "expand" | "hide";
}

export function FoldRegion({ fold, children, className, print }: FoldRegionProps): ReactElement {
  return (
    <div id={fold.regionId} className={cx("cc-fold", fold.open && "cc-open", print === "expand" && "cc-po", print === "hide" && "cc-noprint", className)}>
      {children}
    </div>
  );
}

/** 열림 상태를 바깥(페이지 상태)이 소유하는 접힘 — RuleRow처럼 open·onToggle을 받는 컴포넌트가 FoldButton·FoldRegion을 그대로 쓰게 한다 */
export function controlledFold(open: boolean, onToggle: () => void, regionId: string): FoldState {
  return {
    open,
    toggle: onToggle,
    setOpen: (next: boolean) => {
      if (next !== open) onToggle();
    },
    regionId,
  };
}
