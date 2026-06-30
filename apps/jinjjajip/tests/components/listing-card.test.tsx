import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { ListingCard } from "@/components/listing/ListingCard";
import type { ScoreBreakdownItem } from "@/lib/types/domain";

const BASE_BREAKDOWN: ScoreBreakdownItem[] = [
  { key: "photo", earned: 30, max: 35, status: "verified" },
  { key: "exif", earned: 18, max: 20, status: "verified" },
  { key: "community", earned: 20, max: 20, status: "verified" },
  { key: "owner", earned: 12, max: 15, status: "verified" },
  { key: "transaction", earned: 10, max: 10, status: "verified" },
];

const GOLD_CARD_PROPS = {
  id: "listing-1",
  title: "관악구 원룸 Gold 테스트",
  address: "서울 관악구 봉천동 123",
  deposit: 1000,
  monthlyRent: 50,
  trustScore: 90,
  trustGrade: "gold" as const,
  naturalLabel: "실거주 세입자가 직접 찍은 사진이 검증됐어요",
  thumbnailUrl: "https://example.com/thumb.jpg",
  scoreBreakdown: BASE_BREAKDOWN,
  status: "verified" as const,
};

describe("ListingCard", () => {
  it("article role이 존재하고 tabIndex=0", () => {
    render(<ListingCard {...GOLD_CARD_PROPS} />);
    const card = screen.getByRole("article");
    expect(card).toBeInTheDocument();
    expect(card).toHaveAttribute("tabIndex", "0");
  });

  it("신뢰 배지가 가격보다 DOM 상 먼저 렌더 (시각 우선 §3.2)", () => {
    const { container } = render(<ListingCard {...GOLD_CARD_PROPS} />);
    const badgeEl = container.querySelector("[role=status]");
    const priceEl = container.querySelector(".text-price");
    expect(badgeEl).toBeInTheDocument();
    expect(priceEl).toBeInTheDocument();
    // badge가 price보다 앞에 있어야 함
    const allElements = container.querySelectorAll("[role=status], .text-price");
    expect(allElements[0]).toBe(badgeEl);
  });

  it("가격 formatDepositRent 올바른 표기 (1000만/월 50)", () => {
    render(<ListingCard {...GOLD_CARD_PROPS} />);
    expect(screen.getByText("1,000만 / 월 50")).toBeInTheDocument();
  });

  it("Enter키로 onNavigate 호출", () => {
    const onNavigate = vi.fn();
    render(<ListingCard {...GOLD_CARD_PROPS} onNavigate={onNavigate} />);
    const card = screen.getByRole("article");
    fireEvent.keyDown(card, { key: "Enter" });
    expect(onNavigate).toHaveBeenCalledWith("listing-1");
  });

  it("Space키로 onNavigate 호출", () => {
    const onNavigate = vi.fn();
    render(<ListingCard {...GOLD_CARD_PROPS} onNavigate={onNavigate} />);
    const card = screen.getByRole("article");
    fireEvent.keyDown(card, { key: " " });
    expect(onNavigate).toHaveBeenCalledWith("listing-1");
  });

  it("클릭으로 onNavigate 호출", () => {
    const onNavigate = vi.fn();
    render(<ListingCard {...GOLD_CARD_PROPS} onNavigate={onNavigate} />);
    fireEvent.click(screen.getByRole("article"));
    expect(onNavigate).toHaveBeenCalledWith("listing-1");
  });

  it("Unverified: 앰버 border-t 클래스 존재", () => {
    const { container } = render(
      <ListingCard {...GOLD_CARD_PROPS} trustGrade="unverified" trustScore={30} />
    );
    const card = container.querySelector("[role=article]");
    expect(card?.className).toContain("border-t-4");
    expect(card?.className).toContain("border-t-realestate-amber-warn-border");
  });

  it("thumbnailUrl 없으면 '사진 없음' fallback 노출", () => {
    render(<ListingCard {...GOLD_CARD_PROPS} thumbnailUrl={null} />);
    expect(screen.getByText("사진 없음")).toBeInTheDocument();
  });

  it("processing status일 때 '사진 분석 중' 배너 노출", () => {
    render(<ListingCard {...GOLD_CARD_PROPS} status="processing" />);
    expect(screen.getByText(/사진 분석 중/)).toBeInTheDocument();
  });

  it("pending 항목이 있으면 경고 보조 텍스트 노출", () => {
    const breakdownWithPending: ScoreBreakdownItem[] = [
      ...BASE_BREAKDOWN.slice(0, 4),
      { key: "transaction", earned: null, max: 10, status: "pending" },
    ];
    render(<ListingCard {...GOLD_CARD_PROPS} scoreBreakdown={breakdownWithPending} />);
    expect(screen.getByText(/점수 변동 가능/)).toBeInTheDocument();
  });
});
