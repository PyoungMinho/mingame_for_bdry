"use client";

import type { ReactNode } from "react";
import GuessRow, { type GuessRowState } from "./GuessRow";
import type { GameStatus, Guess } from "@/lib/dongne/types";

export interface GuessListProps {
  /** 시도 순서대로 이미 계산된 결과(거리/방위/근접도/정답여부) */
  guesses: Guess[];
  /** code → 표시명(동명이면 이미 "(시도)"가 포함된 문자열). manifest 룩업은 페이지 책임 */
  regionNames: Record<string, string>;
  status: GameStatus;
  maxAttempts?: number;
  /** 리스트 상단 "거리 · 방향 · 근접도" eyebrow 라벨(§4-6, 첫 플레이 명료성 확보) */
  showEyebrow?: boolean;
  className?: string;
}

/**
 * 6행 고정 스켈레톤 시도 리스트 (design-final §4-6, F8 확정).
 * 플레이한 행만 풀 렌더하고 나머지는 컴팩트 플레이스홀더로 유지해 "6번 안에" 자원 예산을
 * 시각화한다. **정답 행 이후의 남은 행은 렌더하지 않는다**("이후 행 숨김").
 *
 * 이 컴포넌트는 이미 계산된 `guesses`(거리/방위/근접도/정답여부)를 그대로 표시만 한다 —
 * 힌트 계산·정답 판정 등 게임 로직은 전부 페이지(src/app/dongne/page.tsx) 책임.
 */
export default function GuessList({
  guesses,
  regionNames,
  status,
  maxAttempts = 6,
  showEyebrow = true,
  className = "",
}: GuessListProps) {
  const rows: ReactNode[] = [];

  for (let i = 0; i < maxAttempts; i++) {
    const guess = guesses[i];
    const attemptNo = i + 1;

    if (guess) {
      if (guess.correct) {
        rows.push(<GuessRow key={attemptNo} index={attemptNo} state="correct" />);
        break; // 정답 이후 행은 숨김
      }
      rows.push(
        <GuessRow
          key={attemptNo}
          index={attemptNo}
          state="answered"
          regionName={regionNames[guess.code] ?? guess.code}
          distanceKm={guess.distanceKm}
          direction={guess.direction}
          proximity={guess.proximity}
        />,
      );
      continue;
    }

    const isActive = status === "playing" && i === guesses.length;
    const state: GuessRowState = isActive ? "active" : "pending";
    rows.push(<GuessRow key={attemptNo} index={attemptNo} state={state} />);
  }

  return (
    <div className={`dn-guess-list ${className}`.trim()}>
      {showEyebrow ? (
        <div className="dn-guess-list-eyebrow dn-text-label" aria-hidden="true">
          <span>거리 · 방향 · 근접도</span>
        </div>
      ) : null}
      {rows}
    </div>
  );
}
