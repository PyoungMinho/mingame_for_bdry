/**
 * CP-19 — StatusChip (신규 테스트, 기존 미커버).
 * 대상: src/components/common/StatusChip.tsx
 */
import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { StatusChip } from "@/components/common/StatusChip";

describe("StatusChip", () => {
  it("CP-19: status='processing' → '분석 중' 칩 렌더", () => {
    render(<StatusChip status="processing" />);
    expect(screen.getByText("분석 중")).toBeInTheDocument();
    expect(screen.getByLabelText("분석 중")).toBeInTheDocument();
  });
  it("status='pending' → '검증 대기 중' 칩 렌더", () => {
    render(<StatusChip status="pending" />);
    expect(screen.getByText("검증 대기 중")).toBeInTheDocument();
  });
  it("status='reported' → '신고 접수됨' 칩 렌더", () => {
    render(<StatusChip status="reported" />);
    expect(screen.getByText("신고 접수됨")).toBeInTheDocument();
  });
  it("processing 칩은 스피너(animate-spin) + reduced-motion 정적 아이콘 둘 다 포함", () => {
    const { container } = render(<StatusChip status="processing" />);
    expect(container.querySelector(".animate-spin")).toBeInTheDocument();
    expect(container.querySelector(".motion-reduce\\:block")).toBeInTheDocument();
  });
});
