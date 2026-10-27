// @vitest-environment jsdom
// PasteBox — 관문 ⑤: 값을 보관하지 않는다. 붙여 넣은 글자는 곧바로 onText로, 글자가 아니면 onNonText로. 맞춤법·자동완성 7속성(G-D10).
import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { PasteBox } from "./PasteBox";
import { unexpectedMissing } from "./__tests__/render";

const clip = (text: string) => ({ clipboardData: { getData: (type: string) => (type === "text/plain" ? text : "") } });

describe("PasteBox", () => {
  it("7속성이 모두 붙고 readOnly가 아니며, 라벨·힌트가 있다", () => {
    const { container } = render(<PasteBox onText={vi.fn()} onNonText={vi.fn()} />);
    const ta = screen.getByRole("textbox");
    expect(ta.getAttribute("spellcheck")).toBe("false");
    expect(ta.getAttribute("autocomplete")).toBe("off");
    expect(ta.getAttribute("autocorrect")).toBe("off");
    expect(ta.getAttribute("autocapitalize")).toBe("off");
    expect(ta.getAttribute("data-gramm")).toBe("false");
    expect(ta.getAttribute("data-gramm_editor")).toBe("false");
    expect(ta.getAttribute("data-enable-grammarly")).toBe("false");
    expect(ta.hasAttribute("readonly")).toBe(false);
    expect(screen.getByLabelText("결과 붙여넣기")).toBe(ta);
    expect(container.textContent).toContain("붙여 넣은 내용은 이 입력칸에 남지 않고 바로 읽습니다");
    expect(unexpectedMissing(container)).toEqual([]);
  });

  it("붙여넣기: 기본 동작을 막고 text/plain을 onText로 — 입력칸 값은 계속 빈 문자열", () => {
    const onText = vi.fn();
    const onNonText = vi.fn();
    render(<PasteBox onText={onText} onNonText={onNonText} />);
    const ta = screen.getByRole("textbox") as HTMLTextAreaElement;
    const big = '{"schema":"x"}\n'.repeat(1000);
    const notPrevented = fireEvent.paste(ta, clip(big));
    expect(notPrevented).toBe(false); // preventDefault 됨
    expect(onText).toHaveBeenCalledTimes(1);
    expect(onText).toHaveBeenCalledWith(big);
    expect(onNonText).not.toHaveBeenCalled();
    expect(ta.value).toBe("");
  });

  it("글자가 아닌 붙여넣기(이미지 등)는 onNonText", () => {
    const onText = vi.fn();
    const onNonText = vi.fn();
    render(<PasteBox onText={onText} onNonText={onNonText} />);
    fireEvent.paste(screen.getByRole("textbox"), clip(""));
    expect(onText).not.toHaveBeenCalled();
    expect(onNonText).toHaveBeenCalledTimes(1);
  });

  it("타이핑은 값을 남기지 않는다(제어 컴포넌트 값은 항상 '')", async () => {
    const user = userEvent.setup();
    render(<PasteBox onText={vi.fn()} onNonText={vi.fn()} />);
    const ta = screen.getByRole("textbox") as HTMLTextAreaElement;
    await user.type(ta, "abc");
    expect(ta.value).toBe("");
  });

  it("글자를 끌어다 놓으면 onText, 파일을 놓으면 건드리지 않는다(창 전체 드롭 처리 몫)", () => {
    const onText = vi.fn();
    const onNonText = vi.fn();
    render(<PasteBox onText={onText} onNonText={onNonText} />);
    const ta = screen.getByRole("textbox");
    fireEvent.drop(ta, { dataTransfer: { files: [], getData: () => "dropped text" } });
    expect(onText).toHaveBeenCalledWith("dropped text");
    fireEvent.drop(ta, { dataTransfer: { files: [new File(["x"], "a.json")], getData: () => "" } });
    expect(onText).toHaveBeenCalledTimes(1);
    expect(onNonText).not.toHaveBeenCalled();
  });

  it("describedBy가 힌트와 함께 aria-describedby에 들어간다", () => {
    render(<PasteBox onText={vi.fn()} onNonText={vi.fn()} describedBy="extra-id" />);
    const ids = (screen.getByRole("textbox").getAttribute("aria-describedby") ?? "").split(" ");
    expect(ids).toHaveLength(2);
    expect(ids[1]).toBe("extra-id");
  });
});
