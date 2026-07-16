// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import StatsHistogram from "./StatsHistogram";
import type { PlayerStats } from "@/lib/dongne/types";

const stats: PlayerStats = {
  totalPlays: 10,
  wins: 8,
  currentStreak: 3,
  maxStreak: 5,
  lastPlayedGameNo: 42,
  histogram: [1, 2, 3, 1, 1, 0, 2],
};

describe("StatsHistogram", () => {
  it("기본적으로 접혀 있다(F4 — 모달 아닌 인라인 아코디언, 기본 접힘)", () => {
    render(<StatsHistogram stats={stats} />);
    expect(screen.getByRole("button", { name: /내 통계 보기/ })).toHaveAttribute("aria-expanded", "false");
  });

  it("트리거를 탭하면 펼쳐지고 요약 3칩·승률이 계산되어 보인다", () => {
    render(<StatsHistogram stats={stats} />);
    fireEvent.click(screen.getByRole("button", { name: /내 통계 보기/ }));

    expect(screen.getByRole("button", { name: /내 통계 보기/ })).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByText("10")).toBeInTheDocument(); // 총 플레이
    expect(screen.getByText("80%")).toBeInTheDocument(); // 승률 8/10
    expect(screen.getByText("3 / 5")).toBeInTheDocument(); // 현재/최고 스트릭
  });

  it("defaultOpen=true면 처음부터 펼쳐진 상태로 렌더된다", () => {
    render(<StatsHistogram stats={stats} defaultOpen />);
    expect(screen.getByRole("button", { name: /내 통계 보기/ })).toHaveAttribute("aria-expanded", "true");
  });

  it("totalPlays가 0이면 승률 0%로 나눗셈 오류 없이 처리한다", () => {
    render(
      <StatsHistogram
        stats={{ totalPlays: 0, wins: 0, currentStreak: 0, maxStreak: 0, lastPlayedGameNo: null, histogram: [0, 0, 0, 0, 0, 0, 0] }}
        defaultOpen
      />,
    );
    expect(screen.getByText("0%")).toBeInTheDocument();
  });
});
