/**
 * §5-11 DisclosureToggle — 세그 2개 52h, 간격 24(상반 의미는 간격을 넓게 — §10-2).
 * 공개/비공개는 "내 폰에만 남는 메모"다(§3 P6) — 전송 여부는 상위 책임, 여기선 선택 UI만.
 */
import { Lock, Megaphone } from 'lucide-react';

export interface DisclosureToggleProps {
  value: 'public' | 'private' | null;
  onChange: (value: 'public' | 'private') => void;
  /** 단서를 한 번이라도 연 뒤에만 true(§3 P6) */
  enabled: boolean;
  className?: string;
}

export function DisclosureToggle({ value, onChange, enabled, className }: DisclosureToggleProps) {
  return (
    <div className={['gu-disclosure', className ?? ''].filter(Boolean).join(' ')} role="group" aria-label="이 단서를 밝히겠소?">
      <button type="button" className="gu-disclosure-seg" data-tone="blue" data-active={value === 'public' || undefined} disabled={!enabled} onClick={() => onChange('public')}>
        <Megaphone aria-hidden size={18} />
        공개
      </button>
      <button type="button" className="gu-disclosure-seg" data-tone="purple" data-active={value === 'private' || undefined} disabled={!enabled} onClick={() => onChange('private')}>
        <Lock aria-hidden size={18} />
        비공개
      </button>
    </div>
  );
}
