/**
 * §5-3 PhaseRail — 기둥 5개(조사1·조사2·조사3·변론·지목). 'prep'(준비)은 전부 아웃라인 + "준비" 라벨.
 * 전체가 48px 높이 버튼(→ O1 "진행 단계 맞추기" 시트). 게임 상태는 모른다 — current/onTap만 받는다.
 */
import type { RailStep } from './types';

export interface PhaseRailProps {
  current: RailStep;
  onTap?: () => void;
  className?: string;
}

const PILLARS: { step: Exclude<RailStep, 'prep'>; label: string }[] = [
  { step: 1, label: '조사 1' },
  { step: 2, label: '조사 2' },
  { step: 3, label: '조사 3' },
  { step: 'defense', label: '최종 변론' },
  { step: 'vote', label: '지목' },
];

const ORDER: Exclude<RailStep, 'prep'>[] = [1, 2, 3, 'defense', 'vote'];

export function PhaseRail({ current, onTap, className }: PhaseRailProps) {
  const currentIndex = current === 'prep' ? -1 : ORDER.indexOf(current);
  return (
    <button
      type="button"
      className={['gu-rail', className ?? ''].filter(Boolean).join(' ')}
      onClick={onTap}
      aria-label={current === 'prep' ? '진행 단계: 준비. 탭하면 단계 맞추기' : `진행 단계: ${PILLARS[currentIndex]?.label ?? ''}. 탭하면 단계 맞추기`}
    >
      {PILLARS.map((p, i) => {
        const state = current === 'prep' ? 'future' : i < currentIndex ? 'past' : i === currentIndex ? 'current' : 'future';
        return (
          <svg key={p.step} className="gu-rail-pillar" data-state={state} width="14" height="18" viewBox="0 0 14 18" aria-hidden>
            <rect x="1" y="2" width="12" height="2" rx="0.5" />
            <rect x="2.5" y="4.5" width="9" height="10" rx="0.5" />
            <rect x="0.5" y="14.5" width="13" height="2.5" rx="0.5" />
          </svg>
        );
      })}
      <span className="gu-sr">{current === 'prep' ? '준비' : PILLARS[currentIndex]?.label}</span>
    </button>
  );
}
