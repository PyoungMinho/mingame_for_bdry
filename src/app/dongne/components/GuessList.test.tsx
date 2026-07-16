// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import GuessList from "./GuessList";
import type { Guess } from "@/lib/dongne/types";

const regionNames = { "11010": "종로구", "11020": "중구", "26010": "중구(부산)" };

function guess(code: string, correct = false): Guess {
  return { code, distanceKm: correct ? 0 : 42, direction: correct ? null : "NE", proximity: correct ? 100 : 63, correct };
}

describe("GuessList", () => {
  it("진행 중(2회 완료) — 완료 2행 + active 1행 + 컴팩트 대기 3행, 총 6행", () => {
    const { container } = render(
      <GuessList guesses={[guess("11010"), guess("11020")]} regionNames={regionNames} status="playing" />,
    );
    const rows = container.querySelectorAll(".dn-guess-row");
    expect(rows).toHaveLength(6);
    expect(rows[0]).toHaveClass("is-answered");
    expect(rows[1]).toHaveClass("is-answered");
    expect(rows[2]).toHaveClass("is-active");
    expect(rows[3]).toHaveClass("is-pending");
    expect(rows[5]).toHaveClass("is-pending");
  });

  it("정답 도달 시 정답 행 이후는 렌더하지 않는다(이후 행 숨김, F8)", () => {
    const { container } = render(
      <GuessList
        guesses={[guess("11010"), guess("26010", true)]}
        regionNames={regionNames}
        status="won"
      />,
    );
    const rows = container.querySelectorAll(".dn-guess-row");
    // 1행(오답) + 2행(정답) = 2행만, 3~6행 렌더 안 됨
    expect(rows).toHaveLength(2);
    expect(rows[1]).toHaveClass("is-correct");
  });

  it("6전 전패(실패)면 6행 전부 answered, active/pending 없음", () => {
    const guesses = Array.from({ length: 6 }, (_, i) => guess(`1101${i}`));
    const { container } = render(<GuessList guesses={guesses} regionNames={regionNames} status="lost" />);
    const rows = container.querySelectorAll(".dn-guess-row");
    expect(rows).toHaveLength(6);
    rows.forEach((r) => expect(r).toHaveClass("is-answered"));
  });

  it("동명 지역은 regionNames로 넘긴 '(시도)' 병기 표시명을 그대로 보여준다", () => {
    render(<GuessList guesses={[guess("26010")]} regionNames={regionNames} status="playing" />);
    expect(screen.getByText("중구(부산)")).toBeInTheDocument();
  });

  it("근접도는 %숫자 텍스트로도 노출된다(색 단독 정보 전달 금지, WCAG 1.4.1)", () => {
    render(<GuessList guesses={[guess("11010")]} regionNames={regionNames} status="playing" />);
    expect(screen.getByText("63%")).toBeInTheDocument();
  });

  it("showEyebrow=false면 상단 라벨을 렌더하지 않는다", () => {
    const { container, rerender } = render(
      <GuessList guesses={[]} regionNames={regionNames} status="playing" />,
    );
    expect(container.querySelector(".dn-guess-list-eyebrow")).toBeInTheDocument();
    rerender(<GuessList guesses={[]} regionNames={regionNames} status="playing" showEyebrow={false} />);
    expect(container.querySelector(".dn-guess-list-eyebrow")).not.toBeInTheDocument();
  });
});
