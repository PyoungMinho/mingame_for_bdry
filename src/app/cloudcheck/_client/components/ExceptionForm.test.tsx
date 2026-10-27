// @vitest-environment jsdom
// ExceptionForm — 예외 표시 인라인 폼: 사유 1~500자 + 만료일(내일 ~ +90일, 기본 +30일), 오류는 빨강 없이(aria-invalid), Esc = 취소, 맞춤법 차단 7속성.
import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { EXCEPTION_MAX_DAYS } from "../../../../lib/cloudcheck/contract/exceptions-schema";
import type { IsoDate } from "../../../../lib/cloudcheck/model/report";
import { sens } from "../mocks/build";
import { addDays, EXCEPTION_DEFAULT_DAYS, ExceptionForm } from "./ExceptionForm";
import { attrValues, unexpectedMissing } from "./__tests__/render";

const TODAY = "2026-10-19" as IsoDate;
const target = sens("resourceName", "acme-old-uploads", "bucket-002");

function setup() {
  const onSave = vi.fn();
  const onCancel = vi.fn();
  const utils = render(<ExceptionForm target={target} today={TODAY} onSave={onSave} onCancel={onCancel} />);
  return { onSave, onCancel, ...utils };
}

describe("ExceptionForm", () => {
  it("addDays: UTC 산술(월말·연말 넘김, 윤년)", () => {
    expect(addDays("2026-10-19", 1)).toBe("2026-10-20");
    expect(addDays("2026-10-19", 30)).toBe("2026-11-18");
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
    expect(addDays("2028-02-28", 1)).toBe("2028-02-29");
    expect(addDays("2026-10-19", EXCEPTION_MAX_DAYS)).toBe("2027-01-17");
  });

  it("제목에 대상 이름(MaskedValue), 만료일 min=내일 · max=오늘+90일 · 기본 오늘+30일, 상태는 그대로 안내", () => {
    const { container } = setup();
    expect(container.querySelector("h4.cc-xf__h")?.textContent).toContain("예외 표시 —");
    expect(container.querySelector("h4 .cc-mask-full")?.textContent).toBe("acme-old-uploads");
    const date = screen.getByLabelText("만료일(필수)") as HTMLInputElement;
    expect(date.type).toBe("date");
    expect(date.min).toBe("2026-10-20");
    expect(date.max).toBe("2027-01-17");
    expect(date.value).toBe(addDays(TODAY, EXCEPTION_DEFAULT_DAYS));
    expect(container.textContent).toContain("상태는 그대로입니다. 이 표시는 상태를 바꾸지 않습니다.");
    expect(container.textContent).toContain("내일부터 90일 안에서 고릅니다.");
    expect(unexpectedMissing(container)).toEqual([]);
  });

  it("사유 입력칸: 7속성 + 최대 500자, 폼은 대상 이름으로 이름이 붙고 속성에는 이름이 없다", () => {
    const { container } = setup();
    const ta = screen.getByLabelText("사유(필수)") as HTMLTextAreaElement;
    expect(ta.getAttribute("spellcheck")).toBe("false");
    expect(ta.getAttribute("autocomplete")).toBe("off");
    expect(ta.getAttribute("autocorrect")).toBe("off");
    expect(ta.getAttribute("autocapitalize")).toBe("off");
    expect(ta.getAttribute("data-gramm")).toBe("false");
    expect(ta.getAttribute("data-gramm_editor")).toBe("false");
    expect(ta.getAttribute("data-enable-grammarly")).toBe("false");
    expect(ta.maxLength).toBe(500);
    expect(attrValues(container).some((v) => v.includes("acme-old-uploads"))).toBe(false);
    const form = container.querySelector("form") as HTMLFormElement;
    expect(document.getElementById(form.getAttribute("aria-labelledby") ?? "")?.textContent).toContain("acme-old-uploads");
  });

  it("저장: 사유(앞뒤 공백 제거)와 만료일이 onSave로", async () => {
    const user = userEvent.setup();
    const { onSave } = setup();
    await user.type(screen.getByLabelText("사유(필수)"), "  다음 분기에 정리할 예정  ");
    fireEvent.change(screen.getByLabelText("만료일(필수)"), { target: { value: "2026-12-31" } });
    await user.click(screen.getByRole("button", { name: "예외로 표시하기" }));
    expect(onSave).toHaveBeenCalledWith({ reason: "다음 분기에 정리할 예정", until: "2026-12-31" });
  });

  it("사유가 비면 저장하지 않고 오류 문장 + aria-invalid + aria-describedby + 사유 칸으로 포커스(빨강 없음)", async () => {
    const user = userEvent.setup();
    const { onSave, container } = setup();
    await user.click(screen.getByRole("button", { name: "예외로 표시하기" }));
    expect(onSave).not.toHaveBeenCalled();
    const ta = screen.getByLabelText("사유(필수)");
    expect(ta.getAttribute("aria-invalid")).toBe("true");
    expect(document.getElementById(ta.getAttribute("aria-describedby") ?? "")?.textContent).toBe("사유를 입력하세요.");
    expect(document.activeElement).toBe(ta);
    expect(container.querySelector(".cc-err")?.classList.contains("cc-err")).toBe(true);
    expect(container.querySelectorAll("[style]")).toHaveLength(0);
  });

  it("공백뿐인 사유·범위 밖 만료일(오늘, 91일 뒤, 비어 있음)도 막는다 — 만료일 오류는 만료일 칸으로 포커스", async () => {
    const user = userEvent.setup();
    const { onSave } = setup();
    await user.type(screen.getByLabelText("사유(필수)"), "   ");
    await user.click(screen.getByRole("button", { name: "예외로 표시하기" }));
    expect(onSave).not.toHaveBeenCalled();
    await user.clear(screen.getByLabelText("사유(필수)"));
    await user.type(screen.getByLabelText("사유(필수)"), "사유");
    for (const bad of ["2026-10-19", "2027-01-18", ""]) {
      fireEvent.change(screen.getByLabelText("만료일(필수)"), { target: { value: bad } });
      await user.click(screen.getByRole("button", { name: "예외로 표시하기" }));
      expect(onSave).not.toHaveBeenCalled();
      expect(screen.getByLabelText("만료일(필수)").getAttribute("aria-invalid")).toBe("true");
      expect(document.activeElement).toBe(screen.getByLabelText("만료일(필수)"));
    }
    expect(screen.getByText("만료일을 내일부터 90일 안에서 고르세요.")).toBeTruthy();
  });

  it("경계값: 내일과 오늘+90일은 통과", async () => {
    const user = userEvent.setup();
    const { onSave } = setup();
    await user.type(screen.getByLabelText("사유(필수)"), "사유");
    for (const ok of ["2026-10-20", "2027-01-17"]) {
      fireEvent.change(screen.getByLabelText("만료일(필수)"), { target: { value: ok } });
      await user.click(screen.getByRole("button", { name: "예외로 표시하기" }));
    }
    expect(onSave).toHaveBeenCalledTimes(2);
  });

  it("Esc = 취소, [취소] 버튼도 같다", async () => {
    const user = userEvent.setup();
    const { onCancel } = setup();
    await user.click(screen.getByLabelText("사유(필수)"));
    await user.keyboard("{Escape}");
    expect(onCancel).toHaveBeenCalledTimes(1);
    await user.click(screen.getByRole("button", { name: "취소" }));
    expect(onCancel).toHaveBeenCalledTimes(2);
  });
});
