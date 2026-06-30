// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { StreakIndicator } from "@/components/ui/streak-indicator";

const days = Array.from({ length: 7 }, (_, i) => ({
  date: `2026-05-${String(8 + i).padStart(2, "0")}`,
  completed: i < 5,
  isToday: i === 6,
}));

describe("StreakIndicator", () => {
  it("연속 일수 표시", () => {
    render(<StreakIndicator streakCount={5} days={days} />);
    expect(screen.getByText(/5/)).toBeTruthy();
  });

  it("7일 도트 group aria-label", () => {
    render(<StreakIndicator streakCount={5} days={days} />);
    expect(screen.getByLabelText(/최근 7일 체크인 현황/)).toBeTruthy();
  });

  it("isRestart=true 시 재시작 보너스 프레임 표시 (부정 메시지 없음)", () => {
    const { container } = render(
      <StreakIndicator streakCount={1} days={days} isRestart restartBonus={5} />
    );
    // "끊김" 부정 키워드 미노출 (디자인 레드라인)
    expect(container.textContent ?? "").not.toMatch(/실패|끊김|놓쳤/);
  });
});
