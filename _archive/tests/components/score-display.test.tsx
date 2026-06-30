// @vitest-environment jsdom
/**
 * ScoreDisplay 시그니처 컴포넌트 기본 렌더 — BUG-006 통합 회귀
 * framer-motion MotionValue 는 jsdom 에서 텍스트 렌더가 비결정적 → role/aria-label 위주 검증
 */
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { ScoreDisplay } from "@/components/ui/score-display";

describe("ScoreDisplay", () => {
  it("role=region + 점수 aria-label", () => {
    render(<ScoreDisplay score={73} skipAnimation />);
    expect(screen.getByRole("region", { name: /오름 점수 73점/ })).toBeTruthy();
  });

  it("delta aria-label 양수/음수 포맷", () => {
    const { rerender } = render(<ScoreDisplay score={50} delta={3.2} skipAnimation />);
    expect(screen.getByLabelText(/변화량 \+3\.2/)).toBeTruthy();
    rerender(<ScoreDisplay score={50} delta={-2.1} skipAnimation />);
    expect(screen.getByLabelText(/변화량 -2\.1/)).toBeTruthy();
  });

  it("4축 미니막대 aria-label 4개 렌더", () => {
    render(
      <ScoreDisplay
        score={73}
        skipAnimation
        axes={[
          { axis: "health", value: 70, label: "건강" },
          { axis: "learn", value: 80, label: "학습" },
          { axis: "relate", value: 60, label: "관계" },
          { axis: "achieve", value: 90, label: "성취" },
        ]}
      />
    );
    expect(screen.getByLabelText(/건강 70점/)).toBeTruthy();
    expect(screen.getByLabelText(/학습 80점/)).toBeTruthy();
    expect(screen.getByLabelText(/관계 60점/)).toBeTruthy();
    expect(screen.getByLabelText(/성취 90점/)).toBeTruthy();
  });
});
