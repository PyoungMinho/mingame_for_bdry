/**
 * §5-15 IncenseTimer — 향 스틱 1종(D12). stage = 96~112px 숫자, compact = 64px.
 * ≤20% 남음 → red-ink. 0 → "끝!". 틱 갱신은 상위 훅(useTimer)이 소유 — 여기선 value만 그린다.
 */
import { Pause, Play, Plus } from 'lucide-react';
import { GuButton } from './GuButton';
import type { IncenseTimerValue } from './types';

export interface IncenseTimerProps {
  value: IncenseTimerValue;
  size: 'stage' | 'compact';
  onPause?: () => void;
  onResume?: () => void;
  onAdd30?: () => void;
  className?: string;
}

function formatMMSS(ms: number): string {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

export function IncenseTimer({ value, size, onPause, onResume, onAdd30, className }: IncenseTimerProps) {
  const { remainingMs, totalMs, running } = value;
  const pct = totalMs > 0 ? Math.max(0, Math.min(1, remainingMs / totalMs)) : 0;
  const low = pct <= 0.2;
  const critical = remainingMs <= 10_000 && remainingMs > 0;
  const done = remainingMs <= 0;
  // §11: 숫자는 aria-live 금지(매초 낭독 방지). 1분·30초·0초를 지날 때만 바뀌는 문구를 따로 알린다.
  const secLeft = Math.ceil(remainingMs / 1000);
  const announce = done ? '시간이 다 됐소' : secLeft <= 30 ? '30초 남았소' : secLeft <= 60 ? '1분 남았소' : '';

  return (
    <div className={['gu-timer', className ?? ''].filter(Boolean).join(' ')} data-size={size} data-low={low || undefined} data-critical={critical || undefined}>
      <p className="gu-timer-num gu-num">
        {done ? '끝!' : formatMMSS(remainingMs)}
      </p>
      <span className="gu-sr" role="status">
        {announce}
      </span>
      <div className="gu-timer-stick" aria-hidden>
        <span className="gu-timer-stick-track" />
        <span className="gu-timer-stick-fill" style={{ transform: `scaleX(${pct})` }} />
        <span className="gu-timer-ember" style={{ left: `${pct * 100}%` }} />
      </div>
      {(onPause || onResume || onAdd30) && (
        <div className="gu-timer-controls">
          {/* QA BUG-16: 0초가 되면 멈춤/재개는 의미가 없다(엔진이 0초 재개를 거부) — +30초만 남긴다 */}
          {done ? null : running ? (
            <GuButton variant="secondary" size={64} icon={<Pause aria-hidden size={18} />} onClick={onPause} debounceMs={0}>
              멈춤
            </GuButton>
          ) : (
            <GuButton variant="secondary" size={64} icon={<Play aria-hidden size={18} />} onClick={onResume} debounceMs={0}>
              재개
            </GuButton>
          )}
          {onAdd30 && (
            <GuButton variant="secondary" size={64} icon={<Plus aria-hidden size={18} />} onClick={onAdd30} debounceMs={0}>
              +30초
            </GuButton>
          )}
        </div>
      )}
    </div>
  );
}
