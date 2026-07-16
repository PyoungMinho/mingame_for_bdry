// @vitest-environment jsdom
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import TownBadge from "./TownBadge";

describe("TownBadge", () => {
  it('status="playing"이면 아무것도 렌더하지 않는다(정답 확정 전 노출 = 정답 유출 가드)', () => {
    const { container } = render(<TownBadge status="playing" registered isMyTownAnswer />);
    expect(container).toBeEmptyDOMElement();
  });

  it("등록됨 + 정답 일치(성공)면 실링 뱃지와 성공 카피를 보여준다", () => {
    render(<TownBadge status="won" registered isMyTownAnswer />);
    expect(screen.getByText("오늘 정답이 우리 동네였음 ㅋㅋ")).toBeInTheDocument();
  });

  it("등록됨 + 정답 일치(실패)면 실패 변형 카피를 보여준다", () => {
    render(<TownBadge status="lost" registered isMyTownAnswer />);
    expect(screen.getByText("오늘 정답이 우리 동네였는데 못 맞혔어요 ㅠㅠ")).toBeInTheDocument();
  });

  it("등록됨 + 정답 불일치면 빈 공간 없이 완전히 미렌더된다", () => {
    const { container } = render(<TownBadge status="won" registered isMyTownAnswer={false} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("미등록이면 비차단 유도 카드를 보여준다", () => {
    const onRegisterClick = vi.fn();
    render(<TownBadge status="won" registered={false} onRegisterClick={onRegisterClick} />);
    expect(screen.getByText(/내 동네를 등록하면/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "내 동네 설정 →" }));
    expect(onRegisterClick).toHaveBeenCalledTimes(1);
  });
});
