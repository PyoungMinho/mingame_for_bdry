/**
 * @vitest-environment happy-dom
 *
 * ModelChip — provider별 색상/initial 매핑, 미지원 provider fallback
 */
import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import { ModelChip } from "@/components/ui/ModelChip";

describe("ModelChip", () => {
  it("provider=openai → 초록색 배경 + 'O' initial 렌더", () => {
    const { container, getByText } = render(
      <ModelChip modelName="GPT-4o" provider="openai" />
    );
    expect(getByText("GPT-4o")).toBeTruthy();
    const avatar = container.querySelector("span[aria-hidden='true']");
    expect(avatar?.textContent).toBe("O");
    const bg = (avatar as HTMLElement | null)?.style.backgroundColor ?? "";
    // happy-dom: hex 유지 / jsdom: rgb 변환 — 둘 다 허용
    expect(
      bg.toLowerCase() === "#10b981" ||
        /rgb\(16,\s*185,\s*129\)/.test(bg)
    ).toBe(true);
  });

  it("provider=anthropic → 'A' initial", () => {
    const { container } = render(
      <ModelChip modelName="Claude Sonnet 4.6" provider="anthropic" />
    );
    const avatar = container.querySelector("span[aria-hidden='true']");
    expect(avatar?.textContent).toBe("A");
  });

  it("provider=other → 모델명 첫 글자를 대문자로 fallback", () => {
    const { container } = render(
      <ModelChip modelName="some-model" provider="other" />
    );
    const avatar = container.querySelector("span[aria-hidden='true']");
    expect(avatar?.textContent).toBe("S");
  });

  it("aria-label에 provider 라벨과 modelName 포함", () => {
    const { container } = render(
      <ModelChip modelName="GPT-4o" provider="openai" />
    );
    const root = container.firstChild as HTMLElement;
    expect(root.getAttribute("aria-label")).toContain("OpenAI");
    expect(root.getAttribute("aria-label")).toContain("GPT-4o");
  });
});
