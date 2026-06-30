import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { ScoreBreakdown } from "@/components/trust/ScoreBreakdown";
import type { ScoreBreakdownItem } from "@/lib/types/domain";

// 핵심 계약: earned===null(pending)은 "검증 대기 중"으로 표기, "0"은 절대 불가
const PENDING_ITEM: ScoreBreakdownItem = {
  key: "photo",
  earned: null,
  max: 35,
  status: "pending",
};

const VERIFIED_ITEM: ScoreBreakdownItem = {
  key: "exif",
  earned: 18,
  max: 20,
  status: "verified",
};

const ZERO_ITEM: ScoreBreakdownItem = {
  key: "community",
  earned: 0,
  max: 20,
  status: "verified",
};

const PROCESSING_ITEM: ScoreBreakdownItem = {
  key: "owner",
  earned: null,
  max: 15,
  status: "processing",
};

const REPORTED_ITEM: ScoreBreakdownItem = {
  key: "transaction",
  earned: 5,
  max: 10,
  status: "reported",
  deltaIfReported: -5,
};

describe("ScoreBreakdown — pending/0점 구분 (핵심 계약)", () => {
  it("earned=null은 '검증 대기 중'으로 표기", () => {
    render(<ScoreBreakdown items={[PENDING_ITEM]} />);
    expect(screen.getByText("검증 대기 중")).toBeInTheDocument();
  });

  it("earned=null일 때 '0' 텍스트가 노출되지 않아야 한다", () => {
    render(<ScoreBreakdown items={[PENDING_ITEM]} />);
    // "0/35" 형태의 점수 표기가 없어야 함
    expect(screen.queryByText(/^0\//)).not.toBeInTheDocument();
    expect(screen.queryByText("0")).not.toBeInTheDocument();
  });

  it("earned=0(verified)은 '0/20' 형태로 정상 표기", () => {
    render(<ScoreBreakdown items={[ZERO_ITEM]} />);
    expect(screen.getByText("0/20")).toBeInTheDocument();
  });

  it("verified 항목은 'N/max' 형태 표기", () => {
    render(<ScoreBreakdown items={[VERIFIED_ITEM]} />);
    expect(screen.getByText("18/20")).toBeInTheDocument();
  });

  it("processing 항목은 '분석 중' 표기", () => {
    render(<ScoreBreakdown items={[PROCESSING_ITEM]} />);
    expect(screen.getByText("분석 중")).toBeInTheDocument();
  });

  it("reported 항목은 '신고 접수됨' 포함 텍스트 표기", () => {
    render(<ScoreBreakdown items={[REPORTED_ITEM]} />);
    expect(screen.getByText(/신고 접수됨/)).toBeInTheDocument();
  });

  it("pending이 detail variant일 때 보조 카피 노출", () => {
    render(<ScoreBreakdown items={[PENDING_ITEM]} variant="detail" />);
    expect(screen.getByText(/허위매물 신호가 아니에요/)).toBeInTheDocument();
  });

  it("pending이 mini variant일 때 보조 카피 미노출", () => {
    render(<ScoreBreakdown items={[PENDING_ITEM]} variant="mini" />);
    expect(screen.queryByText(/허위매물 신호가 아니에요/)).not.toBeInTheDocument();
  });

  it("progressbar role은 pending 제외 verified/processing/reported 항목에 존재", () => {
    render(<ScoreBreakdown items={[VERIFIED_ITEM, PROCESSING_ITEM, REPORTED_ITEM]} />);
    const bars = screen.getAllByRole("progressbar");
    expect(bars.length).toBeGreaterThanOrEqual(1);
  });

  it("전체 5개 항목 복합: 라벨 수와 동일한 항목 행 렌더", () => {
    const items: ScoreBreakdownItem[] = [
      PENDING_ITEM,
      VERIFIED_ITEM,
      ZERO_ITEM,
      PROCESSING_ITEM,
      REPORTED_ITEM,
    ];
    render(<ScoreBreakdown items={items} variant="detail" />);
    // 5개 항목 행이 모두 렌더되어야 함
    const list = screen.getByRole("list", { name: "항목별 신뢰 점수" });
    expect(list.querySelectorAll("li")).toHaveLength(5);
  });
});
