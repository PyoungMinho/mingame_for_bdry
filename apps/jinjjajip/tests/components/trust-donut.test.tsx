/**
 * CP-13 ~ CP-15 — TrustDonut (신규 테스트, 기존 미커버).
 * 대상: src/components/trust/TrustDonut.tsx
 * 핵심: 빈 도넛 방지(최소 아크), 100 초과 clamp, aria 점수 표기.
 */
import { render } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { TrustDonut } from "@/components/trust/TrustDonut";

function getArcCircle(container: HTMLElement) {
  // 0번=트랙, 1번=아크
  return container.querySelectorAll("circle")[1] as SVGCircleElement;
}
function getDashOffset(circle: SVGCircleElement): number {
  const v = circle.getAttribute("stroke-dashoffset") ?? circle.getAttribute("strokeDashoffset");
  return Number(v);
}
function getCircumference(container: HTMLElement): number {
  const track = container.querySelectorAll("circle")[0] as SVGCircleElement;
  const r = Number(track.getAttribute("r"));
  return 2 * Math.PI * r;
}

describe("TrustDonut", () => {
  it("CP-13: score=0 → 아크 길이 0(빈 도넛, dashoffset===둘레), aria '0점'", () => {
    const { container } = render(<TrustDonut score={0} grade="unverified" showScore />);
    const svg = container.querySelector("svg");
    expect(svg?.getAttribute("aria-label")).toContain("0점");
    const circ = getCircumference(container);
    const arc = getArcCircle(container);
    // arcLength=0 → dashOffset = circumference
    expect(getDashOffset(arc)).toBeCloseTo(circ, 5);
  });

  it("CP-14: score=3(5 미만) → 최소 아크 8px 보장(빈 도넛 방지)", () => {
    const { container } = render(<TrustDonut score={3} grade="silver" showScore />);
    const circ = getCircumference(container);
    const arc = getArcCircle(container);
    const dashOffset = getDashOffset(arc);
    const arcLength = circ - dashOffset;
    // 3% 자연 길이보다 큰 최소 8px 가 적용되어야 함
    expect(arcLength).toBeGreaterThanOrEqual(8 - 1e-6);
  });

  it("CP-15: score=120(초과) → clamp 100, aria '100점', dashoffset≈0(가득)", () => {
    const { container } = render(<TrustDonut score={120} grade="gold" showScore />);
    expect(container.querySelector("svg")?.getAttribute("aria-label")).toContain("100점");
    const arc = getArcCircle(container);
    expect(getDashOffset(arc)).toBeCloseTo(0, 5);
  });

  it("표시 점수(showScore)는 clamp된 값으로 렌더", () => {
    const { container } = render(<TrustDonut score={120} grade="gold" showScore />);
    // 본문 텍스트로 clamp된 100 노출
    expect(container.textContent).toContain("100");
  });

  it("showScore=false면 svg aria-hidden 처리(장식)", () => {
    const { container } = render(<TrustDonut score={50} grade="silver" />);
    expect(container.querySelector("svg")?.getAttribute("aria-hidden")).toBe("true");
  });
});
