// @vitest-environment jsdom
// GuideCard — AZ-MFA-G 가이드 카드: 단계마다 질문 + 문서 링크 + 본인 응답 라디오(처음엔 선택 없음). 본인 응답은 상태를 바꾸지 않는다(INV-8).
import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { MOCK_CATALOG_BY_ID } from "../mocks/catalog";
import { GuideCard, selfAnswerKey } from "./GuideCard";
import { unexpectedMissing } from "./__tests__/render";

const entry = MOCK_CATALOG_BY_ID.get("AZ-MFA-G")!;

describe("GuideCard", () => {
  it("카탈로그의 가이드 단계 수만큼 번호 목록(외곽선 번호 상자 .cc-steps), 안내 문장 3개, 상태 배지 없음(확인 불가는 점검 행의 몫)", () => {
    expect(entry.guide).not.toBeNull();
    const { container } = render(<GuideCard entry={entry} answers={{}} onAnswer={vi.fn()} />);
    const steps = container.querySelectorAll("ol.cc-steps > li");
    expect(steps).toHaveLength(entry.guide!.steps.length);
    expect(container.textContent).toContain("직접 확인하는 점검입니다. 자동으로 판정하지 않습니다.");
    expect(container.textContent).toContain("AWS 현관은 파일로 판정하고, Azure 현관은 직접 확인합니다");
    expect(container.textContent).toContain("본인 응답은 검증하지 않으며 상태는 확인 불가 그대로입니다. 이 탭을 닫으면 사라집니다.");
    expect(container.querySelector(".cc-sb, .cc-si")).toBeNull();
    expect(container.querySelector(".cc-untone.cc-hatch")).not.toBeNull();
    expect(unexpectedMissing(container)).toEqual([]);
  });

  it("단계마다 fieldset + legend + 라디오 3개(예·아니요·모름), 처음에는 아무것도 고르지 않았다", () => {
    const { container } = render(<GuideCard entry={entry} answers={{}} onAnswer={vi.fn()} />);
    const sets = container.querySelectorAll("fieldset");
    expect(sets).toHaveLength(entry.guide!.steps.length);
    for (const fs of Array.from(sets)) {
      expect(fs.querySelector("legend")?.textContent).toBe("확인한 결과를 골라 두세요(본인 응답)");
      const radios = Array.from(fs.querySelectorAll("input[type='radio']")) as HTMLInputElement[];
      expect(radios.map((r) => r.value)).toEqual(["yes", "no", "unknown"]);
      expect(radios.every((r) => !r.checked)).toBe(true);
      expect(new Set(radios.map((r) => r.name)).size).toBe(1);
      expect(Array.from(fs.querySelectorAll("label")).map((l) => l.textContent)).toEqual(["예", "아니요", "모름"]);
      expect(document.getElementById(fs.getAttribute("aria-describedby") ?? "")).not.toBeNull(); // 질문이 설명으로
    }
    expect(container.querySelectorAll(".cc-chip")).toHaveLength(0); // 응답 라벨 없음
  });

  it("라디오를 고르면 onAnswer(단계 id, 응답), 고른 단계에는 '본인 응답: 예(검증 안 됨) · 상태는 확인 불가 유지' 라벨", () => {
    const onAnswer = vi.fn();
    const first = entry.guide!.steps[0]!;
    const { container, rerender } = render(<GuideCard entry={entry} answers={{}} onAnswer={onAnswer} />);
    fireEvent.click(within(container.querySelector("fieldset") as HTMLElement).getByLabelText("예"));
    expect(onAnswer).toHaveBeenCalledWith(first.id, "yes");
    rerender(<GuideCard entry={entry} answers={{ [first.id]: "yes" }} onAnswer={onAnswer} />);
    const fs = container.querySelector("fieldset") as HTMLElement;
    expect((within(fs).getByLabelText("예") as HTMLInputElement).checked).toBe(true);
    expect(container.querySelectorAll(".cc-chip")).toHaveLength(1);
    expect(container.querySelector(".cc-chip")?.textContent).toBe("본인 응답: 예(검증 안 됨) · 상태는 확인 불가 유지");
  });

  it("문서가 있는 단계는 새 탭 링크(호스트 글자 + rel)", () => {
    const { container } = render(<GuideCard entry={entry} answers={{}} onAnswer={vi.fn()} />);
    const withDoc = entry.guide!.steps.filter((s) => s.doc !== null).length;
    const links = container.querySelectorAll("a[target='_blank']");
    expect(links).toHaveLength(withDoc);
    for (const a of Array.from(links)) expect(a.getAttribute("rel")).toBe("noopener noreferrer");
  });

  it("guide가 없는 점검이면 아무것도 그리지 않는다", () => {
    const { container } = render(<GuideCard entry={MOCK_CATALOG_BY_ID.get("AWS-MFA-1")!} answers={{}} onAnswer={vi.fn()} />);
    expect(container.innerHTML).toBe("");
  });

  it("selfAnswerKey: 점검 id + 단계 id", () => {
    expect(selfAnswerKey("AZ-MFA-G", "step-1")).toBe("AZ-MFA-G:step-1");
  });
});
