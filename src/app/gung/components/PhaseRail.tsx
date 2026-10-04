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

/**
 * 진행표(6판 · UX 스펙 §2-4) — 「게임이 어떻게 흘러가는지」 한눈에. 칸 6개(라벨 ≤ 4자 + 분) + 합계.
 * 분은 상위가 타이머 상수에서 계산해 넘긴다(flowPlan). 게임 상태는 모른다 — current 가 있으면 그 칸만 금색.
 * 플레이어 대기(P1)·방장 대기실(H1)·하는 법 시트 맨 위에 같은 모양으로 들어간다. 역할과 무관하다.
 */
export interface FlowStripStep {
  key: string;
  label: string;
  minutes: number;
}

export interface FlowStripProps {
  title: string;
  steps: readonly FlowStripStep[];
  /** 합계 문구(예: '약 35분') */
  totalLabel: string;
  /** 조사 칸 풀이 한 줄(예: '조사 1번 = 현장 1 + 고르기 1 + 토론 5분') */
  note?: string;
  current?: string;
  className?: string;
}

export function FlowStrip({ title, steps, totalLabel, note, current, className }: FlowStripProps) {
  const ci = current ? steps.findIndex((s) => s.key === current) : -1;
  return (
    <section className={['gu-flow', className ?? ''].filter(Boolean).join(' ')} aria-label={`${title} · ${totalLabel}`}>
      <p className="gu-flow-head">
        <span className="gu-flow-title">{title}</span>
        <span className="gu-flow-total">{totalLabel}</span>
      </p>
      <ol className="gu-flow-list">
        {steps.map((s, i) => (
          <li key={s.key} className="gu-flow-item" data-state={ci < 0 ? undefined : i < ci ? 'past' : i === ci ? 'current' : 'future'}>
            <span className="gu-flow-label">{s.label}</span>
            <span className="gu-flow-min gu-num">{s.minutes}분</span>
          </li>
        ))}
      </ol>
      {note && <p className="gu-flow-note">{note}</p>}
    </section>
  );
}

/**
 * 조사 라운드 하위 단계 표시(6판) — 현장 보기 → 장소 고르기 → 토론. 방장 진행 화면 맨 위 한 줄.
 * 지금 단계만 금색(글자 + aria-current — 색만으로 구분하지 않는다).
 */
export interface RoundStepsProps {
  label: string;
  steps: readonly { key: string; label: string; minutes: number }[];
  current: string;
  className?: string;
}

export function RoundSteps({ label, steps, current, className }: RoundStepsProps) {
  const ci = steps.findIndex((s) => s.key === current);
  return (
    <ol className={['gu-roundsteps', className ?? ''].filter(Boolean).join(' ')} aria-label={label}>
      {steps.map((s, i) => (
        <li key={s.key} className="gu-roundsteps-item" data-state={i < ci ? 'past' : i === ci ? 'current' : 'future'} aria-current={i === ci ? 'step' : undefined}>
          {i > 0 && (
            <span className="gu-roundsteps-sep" aria-hidden>
              ›
            </span>
          )}
          <span className="gu-roundsteps-label">{s.label}</span> <span className="gu-num">{s.minutes}분</span>
        </li>
      ))}
    </ol>
  );
}
