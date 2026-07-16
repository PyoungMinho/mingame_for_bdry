// @vitest-environment jsdom
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, waitFor, act } from "@testing-library/react";
import ShareButtons from "./ShareButtons";

function mockClipboard() {
  Object.assign(navigator, {
    clipboard: { writeText: vi.fn().mockResolvedValue(undefined) },
  });
}

describe("ShareButtons", () => {
  it("탭하면 클립보드에 공유 텍스트가 그대로 복사되고 라벨이 '복사됨 ✓'로 전환된다(F3 — 토스트 미사용)", async () => {
    mockClipboard();
    render(<ShareButtons shareText={"동네고수 #123\n3/6 🎯"} shareUrl="https://example.com/dongne" />);

    fireEvent.click(screen.getByRole("button", { name: /결과 복사하기/ }));

    await waitFor(() => expect(screen.getByRole("button", { name: "복사됨 ✓" })).toBeInTheDocument());
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith("동네고수 #123\n3/6 🎯");
    expect(screen.getByRole("status")).toHaveTextContent("복사되었습니다");
  });

  it("2초 후 버튼 라벨이 원래대로 복귀한다", async () => {
    vi.useFakeTimers();
    mockClipboard();
    render(<ShareButtons shareText="x" shareUrl="https://example.com/dongne" />);

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /결과 복사하기/ }));
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(screen.getByRole("button", { name: "복사됨 ✓" })).toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(2000);
    });
    expect(screen.getByRole("button", { name: /결과 복사하기/ })).toBeInTheDocument();

    vi.useRealTimers();
  });

  it("navigator.share 미지원 기기에서는 '공유하기' 2차 버튼을 렌더하지 않는다", async () => {
    mockClipboard();
    // @ts-expect-error 테스트에서 의도적으로 미지원 시뮬레이션
    delete navigator.share;
    render(<ShareButtons shareText="x" shareUrl="https://example.com/dongne" />);
    await waitFor(() => expect(screen.getByRole("button", { name: /결과 복사하기/ })).toBeInTheDocument());
    expect(screen.queryByRole("button", { name: "공유하기" })).not.toBeInTheDocument();
  });

  it("navigator.share 지원 기기에서는 '공유하기' 버튼이 추가로 노출되고 같은 텍스트+URL을 넘긴다", async () => {
    mockClipboard();
    const shareMock = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, { share: shareMock });
    render(<ShareButtons shareText="공유텍스트" shareUrl="https://example.com/dongne" />);

    const shareBtn = await screen.findByRole("button", { name: "공유하기" });
    fireEvent.click(shareBtn);
    await waitFor(() =>
      expect(shareMock).toHaveBeenCalledWith({ text: "공유텍스트", url: "https://example.com/dongne" }),
    );
  });

  it("navigator.share가 실패해도 에러 UI 없이 조용히 클립보드로 폴백한다", async () => {
    mockClipboard();
    const shareMock = vi.fn().mockRejectedValue(new Error("cancelled"));
    Object.assign(navigator, { share: shareMock });
    render(<ShareButtons shareText="공유텍스트" shareUrl="https://example.com/dongne" />);

    const shareBtn = await screen.findByRole("button", { name: "공유하기" });
    fireEvent.click(shareBtn);
    await waitFor(() => expect(navigator.clipboard.writeText).toHaveBeenCalledWith("공유텍스트"));
  });
});
