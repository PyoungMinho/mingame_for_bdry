// @vitest-environment jsdom
// Fold(useFold·FoldButton·FoldRegion·FoldProvider) · Banner — 접힘은 버튼 + 영역(<details> 아님), 접힌 영역도 DOM에 항상 있다.
import { fireEvent, render, screen } from "@testing-library/react";
import { useState, type ReactElement } from "react";
import { describe, expect, it } from "vitest";
import { Banner } from "./Banner";
import { controlledFold, FoldButton, FoldProvider, FoldRegion, useFold, type FoldControl } from "./Fold";

function Demo({ id = "a", print }: { id?: string; print?: "expand" | "hide" }): ReactElement {
  const fold = useFold(id);
  return (
    <div>
      <FoldButton fold={fold} noPrint={print === "hide"}>
        제목
      </FoldButton>
      <FoldRegion fold={fold} print={print}>
        <p>본문</p>
      </FoldRegion>
    </div>
  );
}

describe("useFold · FoldButton · FoldRegion", () => {
  it("기본 접힘: aria-expanded=false, 영역은 DOM에 있고 cc-fold(cc-open 없음), aria-controls가 영역 id를 가리킨다", () => {
    const { container } = render(<Demo />);
    const btn = screen.getByRole("button", { name: "제목" });
    expect(btn.getAttribute("aria-expanded")).toBe("false");
    const region = container.querySelector(".cc-fold") as HTMLElement;
    expect(region.id).toBe(btn.getAttribute("aria-controls"));
    expect(region.classList.contains("cc-open")).toBe(false);
    expect(region.textContent).toBe("본문"); // 접혀도 DOM에 있다(인쇄가 CSS로 펼친다)
    expect(btn.classList.contains("cc-tog")).toBe(true);
    expect(btn.querySelector(".cc-chev")).not.toBeNull();
    expect(container.querySelector("details")).toBeNull();
  });

  it("누르면 열림: aria-expanded=true + cc-open, 다시 누르면 접힘", () => {
    const { container } = render(<Demo />);
    const btn = screen.getByRole("button");
    fireEvent.click(btn);
    expect(btn.getAttribute("aria-expanded")).toBe("true");
    expect(container.querySelector(".cc-fold")?.classList.contains("cc-open")).toBe(true);
    fireEvent.click(btn);
    expect(btn.getAttribute("aria-expanded")).toBe("false");
  });

  it("print=expand → cc-po(인쇄 펼침), hide → 영역 cc-noprint + 버튼 cc-noprint", () => {
    const a = render(<Demo print="expand" />);
    expect(a.container.querySelector(".cc-fold")?.classList.contains("cc-po")).toBe(true);
    a.unmount();
    const b = render(<Demo print="hide" />);
    expect(b.container.querySelector(".cc-fold")?.classList.contains("cc-noprint")).toBe(true);
    expect(b.container.querySelector("button")?.classList.contains("cc-noprint")).toBe(true);
  });

  it("FoldProvider: 같은 id는 다시 마운트해도 상태가 이어진다(V4 → V3 복원용), 다른 id는 독립", () => {
    function Host(): ReactElement {
      const [open, setOpen] = useState<Readonly<Record<string, boolean>>>({});
      const [shown, setShown] = useState(true);
      const control: FoldControl = { isOpen: (id) => open[id], setOpen: (id, v) => setOpen((o) => ({ ...o, [id]: v })) };
      return (
        <FoldProvider control={control}>
          <button type="button" onClick={() => setShown((s) => !s)}>
            화면 전환
          </button>
          {shown ? <Demo id="rule-1" /> : null}
        </FoldProvider>
      );
    }
    render(<Host />);
    fireEvent.click(screen.getByRole("button", { name: "제목" }));
    expect(screen.getByRole("button", { name: "제목" }).getAttribute("aria-expanded")).toBe("true");
    fireEvent.click(screen.getByRole("button", { name: "화면 전환" })); // 언마운트
    fireEvent.click(screen.getByRole("button", { name: "화면 전환" })); // 다시 마운트
    expect(screen.getByRole("button", { name: "제목" }).getAttribute("aria-expanded")).toBe("true");
  });

  it("controlledFold: 바깥이 열림을 소유하고 토글만 위임한다", () => {
    let toggled = 0;
    function C(): ReactElement {
      const f = controlledFold(true, () => (toggled += 1), "region-x");
      return (
        <div>
          <FoldButton fold={f}>토글</FoldButton>
          <FoldRegion fold={f}>x</FoldRegion>
        </div>
      );
    }
    const { container } = render(<C />);
    expect(screen.getByRole("button").getAttribute("aria-controls")).toBe("region-x");
    expect(container.querySelector(".cc-fold")?.id).toBe("region-x");
    expect(container.querySelector(".cc-fold")?.classList.contains("cc-open")).toBe(true);
    fireEvent.click(screen.getByRole("button"));
    expect(toggled).toBe(1);
  });
});

describe("Banner", () => {
  it("strong: role=note, 항상 펼침(토글 버튼 없음), 잉크 반전 클래스", () => {
    const { container } = render(<Banner variant="strong" ariaLabel="중요한 알림" title="제목" body="본문" foldId="ignored" />);
    const el = container.firstElementChild as HTMLElement;
    expect(el.getAttribute("role")).toBe("note");
    expect(el.getAttribute("aria-label")).toBe("중요한 알림");
    expect(el.classList.contains("cc-banner--strong")).toBe(true);
    expect(container.querySelector("button")).toBeNull();
    expect(el.textContent).toBe("제목본문");
  });
  it("info + foldId: 제목이 토글 버튼, 본문은 접힌 영역(인쇄 펼침), '자세히'/'접기' 글자", () => {
    const { container } = render(<Banner variant="info" foldId="n1" title="수집한 지 26시간이 지났습니다" body="그동안 설정이 바뀌었을 수 있습니다." />);
    const btn = screen.getByRole("button");
    expect(btn.textContent).toContain("수집한 지 26시간이 지났습니다");
    expect(btn.textContent).toContain("자세히");
    expect(container.querySelector(".cc-fold")?.classList.contains("cc-po")).toBe(true);
    fireEvent.click(btn);
    expect(btn.textContent).toContain("접기");
    expect(btn.getAttribute("aria-expanded")).toBe("true");
  });
  it("foldId가 없으면 제목·본문이 모두 보인다. 닫기 버튼은 없다", () => {
    const { container } = render(
      <>
        <Banner variant="info" title="A3" body="본문" />
        <Banner variant="demo" title="Azure 준비 중" />
        <Banner variant="exception" title="예외 1건" />
      </>,
    );
    expect(container.querySelector("button")).toBeNull();
    expect(Array.from(container.querySelectorAll(".cc-banner")).map((e) => e.className)).toEqual(["cc-banner cc-banner--info", "cc-banner cc-banner--demo", "cc-banner cc-banner--exception"]);
  });
});
