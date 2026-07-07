// @vitest-environment jsdom
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import ResultCard from "./ResultCard";
import typesData from "../data/types.json";
import type { OaType } from "../lib/types";

const types = typesData.types as unknown as OaType[];
const bulldozer = types.find((t) => t.id === "bulldozer")!;
const mediator = types.find((t) => t.id === "mediator")!;

const labels = {
  strengthLabel: "강점",
  shadowLabel: "그림자",
  matchLabel: "이런 동료와 찰떡궁합",
  matchCtaLabel: "이 유형 보기 →",
};

describe("ResultCard", () => {
  it("유형 데이터를 그대로 렌더링한다(도메인 하드코딩 없이 props로만)", () => {
    render(
      <ResultCard type={bulldozer} indexInTypes={1} totalTypes={8} labels={labels} />,
    );
    expect(screen.getByText(bulldozer.name)).toBeInTheDocument();
    expect(screen.getByText(`〈${bulldozer.alias}〉`)).toBeInTheDocument();
    expect(screen.getByText(`“${bulldozer.tagline}”`)).toBeInTheDocument();
    expect(screen.getByText("No.01/08")).toBeInTheDocument();
  });

  it("matchType이 없으면 상성 섹션이 렌더링되지 않는다", () => {
    render(<ResultCard type={bulldozer} indexInTypes={1} totalTypes={8} labels={labels} />);
    expect(screen.queryByText(labels.matchLabel)).not.toBeInTheDocument();
  });

  it("matchType이 있으면 상성 섹션과 CTA가 렌더링되고 클릭 핸들러가 호출된다", () => {
    const onMatchCtaClick = vi.fn();
    render(
      <ResultCard
        type={bulldozer}
        indexInTypes={1}
        totalTypes={8}
        matchType={mediator}
        labels={labels}
        onMatchCtaClick={onMatchCtaClick}
      />,
    );
    expect(screen.getByText(labels.matchLabel)).toBeInTheDocument();
    expect(screen.getByText(mediator.name)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: labels.matchCtaLabel }));
    expect(onMatchCtaClick).toHaveBeenCalledTimes(1);
  });

  it("유형별 컬러를 CSS 커스텀 프로퍼티로 주입한다(컴포넌트는 컬러를 하드코딩하지 않음)", () => {
    const { container } = render(
      <ResultCard type={bulldozer} indexInTypes={1} totalTypes={8} labels={labels} />,
    );
    const card = container.querySelector(".oa-result-card") as HTMLElement;
    expect(card.style.getPropertyValue("--oa-type-solid")).toBe(bulldozer.color.solid);
    expect(card.style.getPropertyValue("--oa-type-tint")).toBe(bulldozer.color.tint);
  });
});
