import { Bell } from 'lucide-react';
import type { CSSProperties, ReactNode } from 'react';
import { Button } from '../form/controls';
import { cx } from '../sheet/cx';

/* ───────── Popover / Dropdown (포털 금지 — 셸 안 DOM, title·<dialog> 금지) ───────── */

export interface PopoverProps {
  title?: string;
  children: ReactNode;
  /** 위치: 부모(position: relative) 기준 */
  style?: CSSProperties;
  className?: string;
  pad?: boolean;
  role?: 'dialog' | 'menu' | 'group';
  label?: string;
}

export function Popover({ title, children, style, className, pad = true, role = 'dialog', label }: PopoverProps) {
  return (
    <div className={cx('mc-pop', pad && 'mc-pop--pad', className)} style={style} role={role} aria-label={label ?? title}>
      {title ? <h3 className="mc-pop__title">{title}</h3> : null}
      {children}
    </div>
  );
}

export interface DropdownItem {
  id: string | number;
  label: string;
  /** 오른쪽 보조 글자("2회차 뒤 가능") — 12px, 읽혀야 하므로 흐리지 않는다 */
  aside?: string;
  disabled?: boolean;
}

export interface DropdownProps {
  items: readonly DropdownItem[];
  /** 키보드로 가리킨 항목 인덱스 */
  activeIndex?: number;
  onPick: (id: DropdownItem['id']) => void;
  /** data-mc-cmd 접두 (`taunt` → taunt:3) */
  cmdPrefix: string;
  label: string;
  style?: CSSProperties;
}

/** 목록형 드롭다운. 항목 앞 아이콘 없음(업무 메신저 빠른 답장 모양). 네이티브 select 금지. */
export function Dropdown({ items, activeIndex, onPick, cmdPrefix, label, style }: DropdownProps) {
  return (
    <div className="mc-pop mc-pop--menu" role="menu" aria-label={label} style={style} data-mc-menu-open="">
      {items.map((it, i) => (
        <button
          key={it.id}
          type="button"
          role="menuitem"
          className="mc-item"
          disabled={it.disabled}
          data-active={i === activeIndex ? 'true' : undefined}
          data-mc-cmd={`${cmdPrefix}:${it.id}`}
          onClick={() => onPick(it.id)}
        >
          <span>{it.label}</span>
          {it.aside ? <span className="mc-item__aside">{it.aside}</span> : null}
        </button>
      ))}
    </div>
  );
}

/* ───────── ConfirmPopover — 확인 2버튼, 위험 버튼 1개(기권) ───────── */

export interface ConfirmPopoverProps {
  title: string;
  body?: string;
  confirmLabel: string;
  cancelLabel: string;
  /** 기권처럼 되돌릴 수 없는 확인 버튼만 true → 빨강 */
  danger?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
  style?: CSSProperties;
}

export function ConfirmPopover({ title, body, confirmLabel, cancelLabel, danger, onConfirm, onCancel, style }: ConfirmPopoverProps) {
  return (
    <Popover title={title} style={style}>
      {body ? <div style={{ fontSize: 'var(--mc-fs-small)', color: 'var(--mc-text-sub)' }}>{body}</div> : null}
      <div className="mc-pop__row">
        <Button variant="secondary" cmd="confirm-cancel" onClick={onCancel}>
          {cancelLabel}
        </Button>
        <Button variant={danger ? 'danger' : 'primary'} cmd="confirm-ok" onClick={onConfirm}>
          {confirmLabel}
        </Button>
      </div>
    </Popover>
  );
}

/* ───────── InlineDialog — 셸 격자 영역 위 대화상자 (포털 금지) ───────── */

export interface InlineDialogProps {
  title: string;
  children: ReactNode;
  /** 버튼들(오른쪽 정렬). 기본 [닫기]는 없다 */
  actions?: ReactNode;
  labelledBy?: string;
}

/**
 * 격자 영역(.mc-body) 안에 absolute 로 깔리는 대화상자. 상단바·탭은 어두워지지 않는다.
 * 부모는 .mc-layer--game 안에 두면 숨기는 순간 같이 사라진다.
 */
export function InlineDialog({ title, children, actions, labelledBy }: InlineDialogProps) {
  return (
    <div className="mc-dialog-scrim">
      <div className="mc-dialog" role="dialog" aria-modal="true" aria-label={labelledBy ? undefined : title} aria-labelledby={labelledBy}>
        <div className="mc-dialog__head" id={labelledBy}>
          {title}
        </div>
        <div className="mc-dialog__body">{children}</div>
        {actions ? <div className="mc-dialog__foot">{actions}</div> : null}
      </div>
    </div>
  );
}

/* ───────── Toast (저장·생성·재대결: 왼쪽 아래, 텍스트 버튼) ───────── */

export interface ToastProps {
  text: string;
  /** `[열기]` `[저장]` 같은 텍스트 버튼 */
  action?: { label: string; cmd: string; onClick: () => void };
}

export function Toast({ text, action }: ToastProps) {
  return (
    <div className="mc-toast mc-toast--note" role="status">
      <span className="mc-toast__text">{text}</span>
      {action ? (
        <button type="button" className="mc-toast__link" data-mc-cmd={action.cmd} onClick={action.onClick}>
          {action.label}
        </button>
      ) : null}
    </div>
  );
}

/* ───────── AlarmToast — 결재 경보 ───────── */

export interface AlarmToastProps {
  /** 문구 ≤20자 */
  text: string;
  /** 단축키 칩 글자 (`Tab`, 모바일은 `전환`) */
  chip?: string;
  /** 토스트 전체가 클릭 영역 = 숨기기 */
  onActivate: () => void;
}

/**
 * 판 바로 위 가운데 고정(수식줄 아래 8px), 두 사람 같은 위치·크기. 깜빡임·흔들림·진동·소리·빨간 바탕 금지.
 * 크기·대비(13:1)로만 눈에 띈다. 게임 레이어 안에 그려야 숨기는 순간 같은 프레임에 사라진다.
 */
export function AlarmToast({ text, chip = 'Tab', onActivate }: AlarmToastProps) {
  return (
    <button type="button" className="mc-toast mc-toast--alarm" role="alert" data-mc-cmd="alarm" onClick={onActivate}>
      <Bell size={16} strokeWidth={1.5} aria-hidden="true" />
      <span className="mc-toast__text">{text}</span>
      <span className="mc-chip">{chip}</span>
    </button>
  );
}
