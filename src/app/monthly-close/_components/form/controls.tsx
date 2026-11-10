import { Check } from 'lucide-react';
import { forwardRef, type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode } from 'react';
import { cx } from '../sheet/cx';

/* ───────── Button ───────── */

export type ButtonVariant = 'primary' | 'secondary' | 'text' | 'danger';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: 'md' | 'lg';
  /** 텍스트 버튼을 더 흐리게(불편한 문구 신고 등) */
  quiet?: boolean;
  /** 기능 버튼 이름 — 명령 이동 모드가 돈다 */
  cmd?: string;
}

/** 기본(파랑) · 보조(흰색+선) · 텍스트 · 위험(빨강, 기권 확인 하나만). 눌러도 번쩍이지 않는다. */
export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'primary', size = 'md', quiet, cmd, type = 'button', className, disabled, onClick, ...rest },
  ref,
) {
  // 기능 버튼(cmd 있음)은 비활성이어도 명령 이동 모드(`/`)가 닿아야 하므로 진짜 disabled 대신 aria-disabled + 클릭 무시
  const soft = !!cmd && !!disabled;
  return (
    <button
      {...rest}
      disabled={soft ? undefined : disabled}
      aria-disabled={soft ? true : rest['aria-disabled']}
      onClick={soft ? (e) => e.preventDefault() : onClick}
      ref={ref}
      type={type}
      className={cx('mc-btn', className)}
      data-variant={variant === 'primary' ? undefined : variant}
      data-size={size === 'lg' ? 'lg' : undefined}
      data-quiet={quiet ? 'true' : undefined}
      data-mc-cmd={cmd}
    />
  );
});

/* ───────── TextInput ───────── */

export interface TextInputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'size'> {
  size?: 'md' | 'lg';
  /** 오류 설명(아래 12px). 있으면 aria-invalid */
  error?: string;
}

export const TextInput = forwardRef<HTMLInputElement, TextInputProps>(function TextInput(
  { size = 'md', error, className, id, ...rest },
  ref,
) {
  const errId = error && id ? `${id}-err` : undefined;
  return (
    <>
      <input
        {...rest}
        id={id}
        ref={ref}
        className={cx('mc-input', className)}
        data-size={size === 'lg' ? 'lg' : undefined}
        aria-invalid={error ? true : undefined}
        aria-describedby={errId}
      />
      {error ? (
        <div className="mc-field-error" id={errId}>
          {error}
        </div>
      ) : null}
    </>
  );
});

/* ───────── RadioRow ───────── */

export interface RadioOption<V extends string> {
  value: V;
  label: string;
  /** 오른쪽 보조 글자 */
  aside?: string;
}

export interface RadioRowProps<V extends string> {
  label: string;
  options: readonly RadioOption<V>[];
  value: V | null;
  onChange: (v: V) => void;
}

/** 양식 3택 같은 라디오 행. 세 항목의 모양은 항상 같다. 방향키로 이동. */
export function RadioRow<V extends string>({ label, options, value, onChange }: RadioRowProps<V>) {
  return (
    <div className="mc-radios" role="radiogroup" aria-label={label}>
      {options.map((o, i) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          className="mc-radio"
          aria-checked={o.value === value}
          tabIndex={o.value === value || (value === null && i === 0) ? 0 : -1}
          onClick={() => onChange(o.value)}
          onKeyDown={(e) => {
            if (e.key === 'ArrowDown' || e.key === 'ArrowRight') {
              e.preventDefault();
              onChange(options[(i + 1) % options.length].value);
            } else if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') {
              e.preventDefault();
              onChange(options[(i - 1 + options.length) % options.length].value);
            }
          }}
        >
          <span className="mc-radio__dot" aria-hidden="true" />
          <span style={{ flex: 1 }}>{o.label}</span>
          {o.aside ? <span className="mc-item__aside">{o.aside}</span> : null}
        </button>
      ))}
    </div>
  );
}

/* ───────── Checkbox ───────── */

export interface CheckboxProps {
  checked: boolean;
  onChange: (v: boolean) => void;
  children: ReactNode;
  disabled?: boolean;
  cmd?: string;
}

export function Checkbox({ checked, onChange, children, disabled, cmd }: CheckboxProps) {
  return (
    <button
      type="button"
      role="checkbox"
      className="mc-check"
      aria-checked={checked}
      disabled={disabled}
      data-mc-cmd={cmd}
      onClick={() => onChange(!checked)}
    >
      <span className="mc-check__box" aria-hidden="true">
        {checked ? <Check size={11} strokeWidth={3} /> : null}
      </span>
      {children}
    </button>
  );
}

/* ───────── SegmentedChoice ───────── */

export interface SegmentedOption<V extends string> {
  value: V;
  label: string;
}

export interface SegmentedChoiceProps<V extends string> {
  label: string;
  options: readonly SegmentedOption<V>[];
  value: V | null;
  onChange: (v: V) => void;
  /** data-mc-cmd 접두 (`laugh` → laugh:none) */
  cmdPrefix?: string;
  disabled?: boolean;
}

/** 3개가 붙은 보조 버튼. 선택은 색뿐 아니라 `✓ ` 접두 + aria-pressed. */
export function SegmentedChoice<V extends string>({ label, options, value, onChange, cmdPrefix, disabled }: SegmentedChoiceProps<V>) {
  return (
    <div className="mc-seg" role="group" aria-label={label}>
      {options.map((o) => {
        const on = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            className="mc-seg__btn"
            aria-pressed={on}
            disabled={disabled}
            data-mc-cmd={cmdPrefix ? `${cmdPrefix}:${o.value}` : undefined}
            onClick={() => onChange(o.value)}
          >
            {on ? '✓ ' : ''}
            {o.label}
          </button>
        );
      })}
    </div>
  );
}
