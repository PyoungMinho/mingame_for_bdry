// @vitest-environment jsdom
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import OptionButton, { OA_OPTION_TRANSITION_MS } from "./OptionButton";

describe("OptionButton", () => {
  it("탭 즉시 점등(is-lit) 클래스가 붙고, onSelect는 아직 호출되지 않는다", () => {
    const onSelect = vi.fn();
    render(<OptionButton id="a" text="일단 따르고 나중에 의견을 전달한다" onSelect={onSelect} />);

    const btn = screen.getByRole("button", { name: /일단 따르고/ });
    fireEvent.click(btn);

    expect(btn).toHaveAttribute("aria-pressed", "true");
    expect(onSelect).not.toHaveBeenCalled();
  });

  it("260ms(design-final D3 확정) 뒤 onSelect(id)가 정확히 1회 호출된다", () => {
    vi.useFakeTimers();
    const onSelect = vi.fn();
    render(<OptionButton id="b" text="그 자리에서 바로 의견을 제시한다" onSelect={onSelect} />);

    fireEvent.click(screen.getByRole("button"));
    expect(onSelect).not.toHaveBeenCalled();

    vi.advanceTimersByTime(OA_OPTION_TRANSITION_MS - 1);
    expect(onSelect).not.toHaveBeenCalled();

    vi.advanceTimersByTime(1);
    expect(onSelect).toHaveBeenCalledTimes(1);
    expect(onSelect).toHaveBeenCalledWith("b");

    vi.useRealTimers();
  });

  it("disabled 상태에서는 클릭해도 onSelect가 호출되지 않는다(오탭 방지)", () => {
    vi.useFakeTimers();
    const onSelect = vi.fn();
    render(<OptionButton id="c" text="옵션 C" onSelect={onSelect} disabled />);

    fireEvent.click(screen.getByRole("button"));
    vi.advanceTimersByTime(500);
    expect(onSelect).not.toHaveBeenCalled();

    vi.useRealTimers();
  });

  it("selected=true로 마운트하면 뒤로가기 복원처럼 처음부터 점등 상태다", () => {
    render(<OptionButton id="a" text="옵션 A" selected onSelect={vi.fn()} />);
    expect(screen.getByRole("button")).toHaveAttribute("aria-pressed", "true");
  });

  it("실제 <button> 엘리먼트라 키보드 접근이 가능하다", () => {
    render(<OptionButton id="a" text="옵션 A" onSelect={vi.fn()} />);
    const btn = screen.getByRole("button");
    expect(btn.tagName).toBe("BUTTON");
    expect(btn).toHaveAttribute("type", "button");
  });

  it("긴 텍스트도 그대로 렌더링한다(line-clamp 금지 원칙 — 잘리지 않음)", () => {
    const longText =
      "이것은 매우 긴 선택지 텍스트입니다. 절대 잘리지 않고 카드 높이가 늘어나야 합니다. 계속 이어집니다.";
    render(<OptionButton id="a" text={longText} onSelect={vi.fn()} />);
    expect(screen.getByText(longText)).toBeInTheDocument();
  });
});
