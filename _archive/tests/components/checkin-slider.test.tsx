// @vitest-environment jsdom
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { CheckinSlider } from "@/components/ui/checkin-slider";

describe("CheckinSlider", () => {
  it("렌더 + 레이블 표시", () => {
    render(
      <CheckinSlider
        axis="health"
        label="건강"
        value={50}
        onChange={vi.fn()}
      />
    );
    expect(screen.getByText(/건강/)).toBeTruthy();
  });

  it("색약 보조 모양 기호(원형 등) 존재", () => {
    const { container } = render(
      <CheckinSlider axis="health" label="건강" value={50} onChange={vi.fn()} />
    );
    expect(container.textContent ?? "").toMatch(/[○□◇△]/);
  });
});
