// @vitest-environment jsdom
// ConfirmDialog — 리포트 닫기 확인: showModal, 처음 포커스는 [리포트로 돌아가기], Esc = 돌아가기, 파괴적 버튼도 주 버튼 모양이 아님. <dialog> 미지원이면 인라인 패널.
import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ConfirmDialog } from "./ConfirmDialog";
import { unexpectedMissing } from "./__tests__/render";

type DialogProto = { showModal?: () => void; close?: () => void };
const proto = HTMLDialogElement.prototype as unknown as DialogProto;
const original = { showModal: proto.showModal, close: proto.close };

function polyfill(): void {
  proto.showModal = function (this: HTMLDialogElement) {
    this.setAttribute("open", "");
  };
  proto.close = function (this: HTMLDialogElement) {
    this.removeAttribute("open");
  };
}
function removeSupport(): void {
  delete proto.showModal;
  delete proto.close;
}
afterEach(() => {
  proto.showModal = original.showModal;
  proto.close = original.close;
});

describe("ConfirmDialog (<dialog> 지원)", () => {
  beforeEach(polyfill);

  it("open이 true가 되면 showModal, 처음 포커스는 [리포트로 돌아가기], 문구는 S 카탈로그 키(있으면 그 글자)", () => {
    const spy = vi.spyOn(proto as { showModal: () => void }, "showModal");
    const { container, rerender } = render(<ConfirmDialog open={false} onStay={vi.fn()} onGo={vi.fn()} />);
    expect(spy).not.toHaveBeenCalled();
    expect(container.querySelector("dialog")?.hasAttribute("open")).toBe(false);
    rerender(<ConfirmDialog open onStay={vi.fn()} onGo={vi.fn()} />);
    expect(spy).toHaveBeenCalledTimes(1);
    expect(container.querySelector("dialog")?.hasAttribute("open")).toBe(true);
    const buttons = container.querySelectorAll("button");
    expect(document.activeElement).toBe(buttons[0]); // stay가 DOM 첫 번째 + 처음 포커스
    expect(container.querySelector("dialog")?.getAttribute("aria-labelledby")).toBeTruthy();
    expect(unexpectedMissing(container)).toEqual([]);
  });

  it("버튼: 돌아가기는 primary, 닫고 계속은 외곽선(빨강·주 버튼 모양 아님)", () => {
    const onStay = vi.fn();
    const onGo = vi.fn();
    const { container } = render(<ConfirmDialog open onStay={onStay} onGo={onGo} />);
    const [stay, go] = Array.from(container.querySelectorAll("button"));
    expect(stay?.classList.contains("cc-btn--primary")).toBe(true);
    expect(go?.classList.contains("cc-btn")).toBe(true);
    expect(go?.classList.contains("cc-btn--primary")).toBe(false);
    fireEvent.click(stay as HTMLElement);
    fireEvent.click(go as HTMLElement);
    expect(onStay).toHaveBeenCalledTimes(1);
    expect(onGo).toHaveBeenCalledTimes(1);
  });

  it("Esc(cancel 이벤트) = 돌아가기, 기본 닫힘은 막는다(open prop이 단일 원천)", () => {
    const onStay = vi.fn();
    const { container } = render(<ConfirmDialog open onStay={onStay} onGo={vi.fn()} />);
    const dlg = container.querySelector("dialog") as HTMLDialogElement;
    const notPrevented = fireEvent(dlg, new Event("cancel", { bubbles: false, cancelable: true }));
    expect(notPrevented).toBe(false);
    expect(onStay).toHaveBeenCalledTimes(1);
  });

  it("open이 false로 돌아오면 닫는다", () => {
    const { container, rerender } = render(<ConfirmDialog open onStay={vi.fn()} onGo={vi.fn()} />);
    rerender(<ConfirmDialog open={false} onStay={vi.fn()} onGo={vi.fn()} />);
    expect(container.querySelector("dialog")?.hasAttribute("open")).toBe(false);
  });
});

describe("ConfirmDialog (<dialog> 미지원 → 인라인 패널)", () => {
  beforeEach(removeSupport);

  it("열렸을 때만 같은 문구의 패널(role=alertdialog)을 그리고 돌아가기에 포커스, Esc = 돌아가기", () => {
    const onStay = vi.fn();
    const { container, rerender } = render(<ConfirmDialog open={false} onStay={onStay} onGo={vi.fn()} />);
    expect(container.innerHTML).toBe("");
    rerender(<ConfirmDialog open onStay={onStay} onGo={vi.fn()} />);
    const panel = screen.getByRole("alertdialog");
    expect(container.querySelector("dialog")).toBeNull();
    expect(document.activeElement).toBe(container.querySelector("button"));
    act(() => {
      fireEvent.keyDown(panel, { key: "Escape" });
    });
    expect(onStay).toHaveBeenCalledTimes(1);
    expect(unexpectedMissing(container)).toEqual([]);
  });
});
