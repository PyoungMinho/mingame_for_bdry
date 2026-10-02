'use client';

/**
 * §5-17 VoteStepper — "N번 · 역할 이/가 가리킨 사람은?" + SeatGrid(자기 제외). 탭 즉시 다음 투표자.
 * 현재 투표자 = voters 순서 중 아직 ballots 에 표가 없는 **첫 사람**(집계 화면에서 중간 사람 표를 지우고
 * 돌아와도 그 사람부터 다시 묻는다). 순수 표시 로직, 판정 로직 아님.
 *
 * 취객 가드(§10-2): 타일을 탭하면 곧바로 다음 사람 그리드가 같은 자리에 뜬다 → 더블탭이 다음 사람 표로
 * 들어가는 사고를 막으려고 표 입력 후 600ms 동안 타일 탭을 무시한다.
 */
import { useRef } from 'react';
import { SeatGrid } from './SeatGrid';
import type { SeatGridItem } from './types';

export interface VoteStepperProps {
  /** 지목 순서(보통 자리 순) */
  voters: SeatGridItem[];
  /** 투표자가 고를 수 있는 후보(자기 자신은 여기서 제외한다) */
  candidates: SeatGridItem[];
  /** 지금까지 입력된 표: voterSeat → targetSeat */
  ballots: Record<number, number>;
  onBallot: (voterSeat: number, targetSeat: number) => void;
  /** 직전 사람 표 지우기 — 없으면 버튼 숨김 */
  onBack?: () => void;
  /** 재지목 여부(머리말 문구) */
  revote?: boolean;
  debounceMs?: number;
  className?: string;
}

function josa(word: string, withFinal: string, withoutFinal: string): string {
  const ch = word.charCodeAt(word.length - 1);
  if (ch < 0xac00 || ch > 0xd7a3) return withoutFinal;
  const hasFinal = (ch - 0xac00) % 28 !== 0;
  return hasFinal ? withFinal : withoutFinal;
}

export function VoteStepper({ voters, candidates, ballots, onBallot, onBack, revote, debounceMs = 600, className }: VoteStepperProps) {
  const lastRef = useRef(0);
  const doneCount = voters.filter((v) => ballots[v.seat] !== undefined).length;
  const current = voters.find((v) => ballots[v.seat] === undefined) ?? voters[voters.length - 1];
  const total = voters.length;

  if (!current) return null;
  const candidatesForCurrent = candidates.filter((c) => c.seat !== current.seat);
  const name = current.roleName ?? `${current.seat}번`;

  const handleSelect = (seat: number) => {
    const now = Date.now();
    if (debounceMs > 0 && now - lastRef.current < debounceMs) return;
    lastRef.current = now;
    onBallot(current.seat, seat);
  };

  return (
    <div className={['gu-votestepper', className ?? ''].filter(Boolean).join(' ')}>
      <p className="gu-votestepper-progress gu-num">
        {revote ? '재지목 ' : '지목 입력 '}
        {Math.min(doneCount + 1, total)}/{total}
      </p>
      <h3 className="gu-votestepper-q gu-display">
        {current.seat}번 · {name}
        {josa(name, '이', '가')} 가리킨 사람은?
      </h3>
      <SeatGrid seats={candidatesForCurrent} selected={ballots[current.seat] ?? null} onSelect={handleSelect} showRoles />
      {onBack && (
        <button type="button" className="gu-votestepper-back" onClick={onBack} disabled={doneCount === 0}>
          ‹ 이전 사람
        </button>
      )}
      <p className="gu-votestepper-hint">탭 즉시 다음 사람으로 넘어감</p>
    </div>
  );
}
