import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { TrustScoreBadge } from "@/components/trust/TrustScoreBadge";

describe("TrustScoreBadge", () => {
  it("Gold 배지: ShieldCheck 아이콘과 '실거주 인증' 라벨 노출", () => {
    render(<TrustScoreBadge grade="gold" score={82} showScore />);
    expect(screen.getByRole("status")).toHaveAttribute(
      "aria-label",
      expect.stringContaining("실거주 인증")
    );
    expect(screen.getByText("실거주 인증")).toBeInTheDocument();
  });

  it("Silver 배지: '현장 인증' 라벨 노출", () => {
    render(<TrustScoreBadge grade="silver" score={65} showScore />);
    expect(screen.getByText("현장 인증")).toBeInTheDocument();
  });

  it("Unverified 배지: '미인증' 라벨 + 앰버 경고 스트립 노출", () => {
    render(<TrustScoreBadge grade="unverified" score={30} />);
    expect(screen.getByText("미인증")).toBeInTheDocument();
    // 앰버 경고 스트립
    expect(screen.getByText(/미인증 매물입니다/)).toBeInTheDocument();
  });

  it("scoreIsLowerBound=true면 점수를 'N점~'으로 표기", () => {
    render(<TrustScoreBadge grade="gold" score={72} scoreIsLowerBound showScore />);
    expect(screen.getByText("72점~")).toBeInTheDocument();
  });

  it("scoreIsLowerBound=false면 점수를 'N점'으로 표기", () => {
    render(<TrustScoreBadge grade="gold" score={82} scoreIsLowerBound={false} showScore />);
    expect(screen.getByText("82점")).toBeInTheDocument();
  });

  it("maxPossibleScore가 있으면 '최대 M점까지 가능' 텍스트 노출 (standard 이상)", () => {
    render(
      <TrustScoreBadge
        grade="silver"
        score={72}
        scoreIsLowerBound
        maxPossibleScore={92}
        variant="standard"
        showScore
      />
    );
    expect(screen.getByText(/최대 92점까지 가능/)).toBeInTheDocument();
  });

  it("naturalLabel prop이 있으면 default 자연어 대신 사용", () => {
    const custom = "직접 입력한 자연어 설명";
    render(<TrustScoreBadge grade="gold" score={80} naturalLabel={custom} />);
    expect(screen.getByText(custom)).toBeInTheDocument();
  });

  it("role=status 속성 존재", () => {
    render(<TrustScoreBadge grade="gold" score={80} />);
    expect(screen.getByRole("status")).toBeInTheDocument();
  });

  it("compact variant에서 자연어 라벨 미노출", () => {
    render(<TrustScoreBadge grade="gold" score={80} variant="compact" />);
    // compact에서 p 태그(자연어)는 렌더하지 않아야 함
    expect(
      screen.queryByText("실거주 세입자가 직접 찍은 사진이 검증됐어요")
    ).not.toBeInTheDocument();
  });
});
