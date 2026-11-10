import {
  AlignLeft, Bold, Check, ChevronDown, Italic, MessageSquare, PaintBucket, Redo2, Sigma, Star, Underline, Undo2, X,
} from 'lucide-react';
import type { KeyboardEvent, ReactNode, Ref } from 'react';
import { McIcon } from './McIcon';
import { cx } from './cx';

/* ───────── 상단바 ───────── */

export interface TopBarProps {
  fileName: string;
  /** 장식 "버전 기록 2:1"(전적) */
  versionLabel?: string;
  /** "공동 편집 중" */
  coEditLabel?: string;
  /** 편집자 원 2개 (이니셜만) */
  editors?: readonly { initial: string; offline?: boolean }[];
  shareLabel: string;
  /** 비활성이어도 명령 이동 모드가 닿도록 aria-disabled로 그린다(클릭은 무시) */
  shareDisabled?: boolean;
  /** [공유] 클릭 */
  onShare?: () => void;
  /** 접근성용 별표 라벨 (장식) */
  starLabel?: string;
}

export function TopBar({ fileName, versionLabel, coEditLabel, editors = [], shareLabel, shareDisabled, onShare, starLabel = '즐겨찾기' }: TopBarProps) {
  return (
    <header className="mc-topbar">
      <McIcon className="mc-topbar__icon" />
      <span className="mc-topbar__file" data-testid="mc-filename">{fileName}</span>
      <button type="button" className="mc-topbar__star" tabIndex={-1} aria-label={starLabel}>
        <Star size={16} strokeWidth={1.5} />
      </button>
      {versionLabel ? <span className="mc-topbar__ver">{versionLabel}</span> : null}
      <span className="mc-topbar__spacer" />
      {editors.length ? (
        <span className="mc-avatars" aria-hidden="true">
          {editors.map((e, i) => (
            <span key={i} className="mc-avatar" data-offline={e.offline ? 'true' : undefined}>
              {e.initial}
            </span>
          ))}
        </span>
      ) : null}
      {coEditLabel ? <span className="mc-topbar__co">{coEditLabel}</span> : null}
      <button
        type="button"
        className="mc-btn"
        data-mc-cmd="share"
        aria-disabled={shareDisabled ? 'true' : undefined}
        onClick={shareDisabled ? undefined : onShare}
      >
        {shareLabel}
      </button>
    </header>
  );
}

/* ───────── 메뉴줄 ───────── */

export interface MenuItemDef {
  id: string;
  label: string;
  /** 오른쪽 보조 글자 */
  aside?: string;
  disabled?: boolean;
  /** 위험한 항목은 버튼 모양이 아니라 확인 팝오버가 처리한다. 여기서는 표시만 */
  active?: boolean;
}

export type MenuId = 'file' | 'help';

export interface MenuBarProps {
  /** 8개 라벨. 0번 = 파일(동작), 7번 = 도움말(동작), 나머지는 장식 */
  labels?: readonly string[];
  open: MenuId | null;
  onToggle: (menu: MenuId) => void;
  fileItems: readonly MenuItemDef[];
  helpItems: readonly MenuItemDef[];
  /** 항목을 눌렀을 때. 메뉴는 호출자가 닫는다 */
  onItem: (menu: MenuId, itemId: string) => void;
}

const DEFAULT_MENU_LABELS = ['파일', '편집', '보기', '삽입', '서식', '데이터', '도구', '도움말'] as const;

export function MenuBar({ labels = DEFAULT_MENU_LABELS, open, onToggle, fileItems, helpItems, onItem }: MenuBarProps) {
  return (
    <nav className="mc-menubar" aria-label="메뉴">
      {labels.map((label, i) => {
        const id: MenuId | null = i === 0 ? 'file' : i === 7 ? 'help' : null;
        if (!id) {
          return (
            <button key={i} type="button" className="mc-menubar__item" tabIndex={-1}>
              {label}
            </button>
          );
        }
        const items = id === 'file' ? fileItems : helpItems;
        return (
          <span key={i} className="mc-menubar__slot">
            <button
              type="button"
              className="mc-menubar__item"
              data-mc-cmd={`menu-${id}`}
              aria-haspopup="menu"
              aria-expanded={open === id}
              onClick={() => onToggle(id)}
            >
              {label}
            </button>
            {open === id ? (
              <div className="mc-pop mc-pop--menu" role="menu" data-mc-menu-open="">
                {items.map((it) => (
                  <button
                    key={it.id}
                    type="button"
                    role="menuitem"
                    className="mc-item"
                    data-mc-cmd={`${id}:${it.id}`}
                    data-active={it.active ? 'true' : undefined}
                    disabled={it.disabled}
                    onClick={() => onItem(id, it.id)}
                  >
                    <span>{it.label}</span>
                    {it.aside ? <span className="mc-item__aside">{it.aside}</span> : null}
                  </button>
                ))}
              </div>
            ) : null}
          </span>
        );
      })}
    </nav>
  );
}

/* ───────── 도구줄 ───────── */

export interface ToolBarProps {
  /** [Σ(n)] 힌트 버튼 */
  hintLabel: string;
  hintCount: number;
  /** 쓸 수 없음(게임 레이어에서만 흐린 모양. 클릭은 호출자가 상태줄 이유로 처리) */
  hintOff?: boolean;
  hintActive?: boolean;
  onHint?: () => void;
  /** [의견 남기기 ▾] 도발 버튼 */
  tauntLabel: string;
  tauntOff?: boolean;
  tauntOpen?: boolean;
  onTaunt?: () => void;
  /** 버튼 아래 드롭다운 자리 */
  hintMenu?: ReactNode;
  tauntMenu?: ReactNode;
}

function Decor({ children }: { children: ReactNode }) {
  return (
    <button type="button" className="mc-tool" tabIndex={-1} aria-hidden="true">
      {children}
    </button>
  );
}

export function ToolBar({
  hintLabel, hintCount, hintOff, hintActive, onHint, tauntLabel, tauntOff, tauntOpen, onTaunt, hintMenu, tauntMenu,
}: ToolBarProps) {
  const ic = { size: 16, strokeWidth: 1.5 } as const;
  return (
    <div className="mc-toolbar" role="toolbar" aria-label="도구">
      <Decor><Undo2 {...ic} /></Decor>
      <Decor><Redo2 {...ic} /></Decor>
      <span className="mc-tool-sep" />
      <button type="button" className="mc-tool mc-tool--wide" tabIndex={-1} aria-hidden="true">
        100% <ChevronDown size={12} strokeWidth={1.5} />
      </button>
      <span className="mc-tool-sep" />
      <Decor><Bold {...ic} /></Decor>
      <Decor><Italic {...ic} /></Decor>
      <Decor><Underline {...ic} /></Decor>
      <span className="mc-tool-sep" />
      <Decor><PaintBucket {...ic} /></Decor>
      <Decor><AlignLeft {...ic} /></Decor>
      <span className="mc-tool-sep" />
      <span style={{ position: 'relative', display: 'inline-flex' }}>
        <button
          type="button"
          className="mc-tool mc-tool--wide"
          data-mc-cmd="hint"
          data-off={hintOff ? 'true' : undefined}
          aria-label={`${hintLabel} ${hintCount}`}
          aria-pressed={hintActive || undefined}
          onClick={onHint}
          style={hintActive ? { background: 'var(--mc-accent-soft)', color: 'var(--mc-accent)' } : undefined}
        >
          <Sigma {...ic} />
          <span className="mc-tool__badge">({hintCount})</span>
        </button>
        {hintMenu}
      </span>
      <span style={{ position: 'relative', display: 'inline-flex' }}>
        <button
          type="button"
          className="mc-tool mc-tool--wide"
          data-mc-cmd="taunt"
          data-off={tauntOff ? 'true' : undefined}
          aria-haspopup="menu"
          aria-expanded={!!tauntOpen}
          onClick={onTaunt}
        >
          <MessageSquare {...ic} />
          {tauntLabel}
          <ChevronDown size={12} strokeWidth={1.5} />
        </button>
        {tauntMenu}
      </span>
    </div>
  );
}

/* ───────── 이름 상자 + 수식 입력줄 ───────── */

export interface FormulaBarProps {
  /** 이름 상자 글자 ("B7", "E1:E8") */
  nameValue: string;
  onNameValueChange?: (v: string) => void;
  /** Enter 를 눌렀을 때(좌표 입력 확정). 한글 조합 중에는 호출되지 않는다 */
  onNameSubmit?: (v: string) => void;
  /** 모바일: 표시 전용(탭해도 키보드가 올라오지 않는다) */
  nameDisplayOnly?: boolean;
  /** 이름 상자가 읽기 전용(상대 차례 등)이어도 입력은 되게 하려면 false. 기본 false */
  formula: string;
  onFormulaChange?: (v: string) => void;
  onFormulaKeyDown?: (e: KeyboardEvent<HTMLInputElement>) => void;
  /** 편집·발사 대기·범위 입력 중이면 ✕ ✓ 활성 */
  armed?: boolean;
  /** 모바일에서는 ✕ ✓ 를 그리지 않는다 */
  hideButtons?: boolean;
  onCancel?: () => void;
  onConfirm?: () => void;
  cancelLabel?: string;
  confirmLabel?: string;
  nameLabel?: string;
  formulaLabel?: string;
  nameRef?: Ref<HTMLInputElement>;
  formulaRef?: Ref<HTMLInputElement>;
}

export function FormulaBar({
  nameValue, onNameValueChange, onNameSubmit, nameDisplayOnly, formula, onFormulaChange, onFormulaKeyDown, armed, hideButtons,
  onCancel, onConfirm, cancelLabel = '취소', confirmLabel = '입력', nameLabel = '이름 상자', formulaLabel = '수식 입력줄', nameRef, formulaRef,
}: FormulaBarProps) {
  return (
    <div className="mc-formula">
      {nameDisplayOnly ? (
        <div className="mc-namebox" data-display-only="true" role="textbox" aria-readonly="true" aria-label={nameLabel}>
          {nameValue}
        </div>
      ) : (
        <input
          ref={nameRef}
          className="mc-namebox"
          aria-label={nameLabel}
          value={nameValue}
          autoComplete="off"
          autoCapitalize="off"
          spellCheck={false}
          data-mc-namebox=""
          onChange={(e) => onNameValueChange?.(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.nativeEvent.isComposing) {
              e.preventDefault();
              onNameSubmit?.(e.currentTarget.value);
            }
          }}
        />
      )}
      {hideButtons ? null : (
        <>
          <button
            type="button"
            className="mc-formula__btn"
            data-kind="cancel"
            data-active={armed ? 'true' : 'false'}
            data-mc-cmd="cancel"
            aria-label={cancelLabel}
            disabled={!armed}
            onClick={onCancel}
          >
            <X size={16} strokeWidth={1.5} />
          </button>
          <button
            type="button"
            className="mc-formula__btn"
            data-kind="confirm"
            data-active={armed ? 'true' : 'false'}
            data-mc-cmd="confirm"
            aria-label={confirmLabel}
            disabled={!armed}
            onClick={onConfirm}
          >
            <Check size={16} strokeWidth={1.5} />
          </button>
        </>
      )}
      <span className="mc-formula__fx" aria-hidden="true">fx</span>
      <input
        ref={formulaRef}
        className={cx('mc-formula__input')}
        aria-label={formulaLabel}
        value={formula}
        readOnly={!onFormulaChange}
        data-readonly={onFormulaChange ? undefined : 'true'}
        tabIndex={onFormulaChange ? 0 : -1}
        autoComplete="off"
        spellCheck={false}
        onChange={(e) => onFormulaChange?.(e.target.value)}
        onKeyDown={onFormulaKeyDown}
      />
    </div>
  );
}
