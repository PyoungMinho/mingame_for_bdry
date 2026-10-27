// @vitest-environment jsdom
// StatusIcon · StatusBadge · DistributionChips · StatusLegend — 상태 표시(G-D2·G-D3): 도형은 aria-hidden, 상태 글자는 어디서도 생략하지 않는다.
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { STATUS_ORDER, type Distribution, type Status } from "../../../../lib/cloudcheck/model/report";
import { distOf } from "../mocks/build";
import { REPORT_C } from "../mocks/reports";
import { DistributionChips } from "./DistributionChips";
import { StatusBadge } from "./StatusBadge";
import { StatusIcon } from "./StatusIcon";
import { StatusLegend } from "./StatusLegend";
import { classTokens, unexpectedMissing } from "./__tests__/render";

const WORD: Readonly<Record<Status, string>> = { risk: "위험", caution: "주의", clear: "이상 없음", unknown: "확인 불가", na: "해당 없음" };

describe("StatusIcon", () => {
  it("5상태 모두: aria-hidden·focusable=false, viewBox 24, 채운 도형(.cc-si__s) + 글리프(.cc-si__g), 크기는 클래스", () => {
    for (const s of STATUS_ORDER) {
      for (const size of [16, 20, 24] as const) {
        const { container, unmount } = render(<StatusIcon status={s} size={size} />);
        const svg = container.querySelector("svg");
        expect(svg?.getAttribute("aria-hidden")).toBe("true");
        expect(svg?.getAttribute("focusable")).toBe("false");
        expect(svg?.getAttribute("viewBox")).toBe("0 0 24 24");
        expect(svg?.classList.contains(`cc-si--${s}`)).toBe(true);
        expect(svg?.classList.contains("cc-si--20")).toBe(size === 20);
        expect(svg?.classList.contains("cc-si--24")).toBe(size === 24);
        expect(container.querySelectorAll(".cc-si__s")).toHaveLength(1);
        expect(container.querySelectorAll(".cc-si__g")).toHaveLength(1);
        // SVG 프레젠테이션 속성(width·height·fill·stroke)·style 없음(G-D22)
        for (const el of Array.from(container.querySelectorAll("*"))) {
          for (const a of ["width", "height", "fill", "stroke", "style"]) expect(el.hasAttribute(a), `${s} ${el.tagName} ${a}`).toBe(false);
        }
        unmount();
      }
    }
  });

  it("글리프는 글자가 아니라 path다(✓·? 문자 없음) — 텍스트 노드 0", () => {
    for (const s of STATUS_ORDER) {
      const { container, unmount } = render(<StatusIcon status={s} />);
      expect(container.textContent).toBe("");
      unmount();
    }
  });
});

describe("StatusBadge", () => {
  it("상태 글자 5개가 그대로(축약 없음), 도형은 글자 옆", () => {
    for (const s of STATUS_ORDER) {
      const { container, unmount } = render(<StatusBadge status={s} />);
      expect(container.querySelector(".cc-sb__t")?.textContent).toBe(WORD[s]);
      expect(container.querySelector(".cc-sb")?.classList.contains(`cc-st--${s}`)).toBe(true);
      expect(container.querySelector(".cc-si")?.parentElement).toBe(container.querySelector(".cc-sb"));
      unmount();
    }
  });

  it("크기 클래스와 개수('확인 불가 2')", () => {
    const { container, rerender } = render(<StatusBadge status="unknown" size="sm" count={2} />);
    expect(container.querySelector(".cc-sb")?.classList.contains("cc-sb--sm")).toBe(true);
    expect(container.querySelector(".cc-sb")?.textContent).toBe("확인 불가 2");
    rerender(<StatusBadge status="risk" size="lg" />);
    expect(container.querySelector(".cc-sb")?.classList.contains("cc-sb--lg")).toBe(true);
    expect(container.querySelector(".cc-si")?.classList.contains("cc-si--20")).toBe(true);
    rerender(<StatusBadge status="risk" count={1234} />);
    expect(container.querySelector(".cc-sb")?.textContent).toBe("위험 1,234");
  });

  it("글자를 숨기는 prop이 없다 — 어떤 크기에서도 글자가 있다(G-D3)", () => {
    for (const size of ["sm", "md", "lg"] as const) {
      const { container, unmount } = render(<StatusBadge status="caution" size={size} />);
      expect((container.textContent ?? "").trim()).toBe("주의");
      unmount();
    }
  });
});

describe("DistributionChips", () => {
  const dist: Distribution = distOf(["risk", "risk", "caution", "unknown", "unknown", "unknown", "clear", "na"]);

  it("칩 5개가 STATUS_ORDER 순서·상태 글자·개수로(0도 표시), 모든 .cc-si는 같은 칩 안에 상태 글자가 있다(G-D3)", () => {
    const { container } = render(<DistributionChips dist={dist} lead />);
    const chips = Array.from(container.querySelectorAll("li.cc-dc"));
    expect(chips.map((c) => c.textContent)).toEqual(["위험 2", "주의 1", "확인 불가 3", "이상 없음 1", "해당 없음 1"]);
    expect(container.querySelector(".cc-dist__lead")?.textContent).toBe("점검 8개");
    for (const icon of Array.from(container.querySelectorAll(".cc-si"))) {
      const chip = icon.closest(".cc-dc");
      const status = (["risk", "caution", "clear", "unknown", "na"] as const).find((s) => icon.classList.contains(`cc-si--${s}`)) as Status;
      expect(chip?.textContent).toContain(WORD[status]);
    }
    expect(unexpectedMissing(container)).toEqual([]);
  });

  it("0 칩은 --zero(바탕 없음), hideZero는 0을 생략(문 머리 sm)", () => {
    const onlyRisk = distOf(["risk"]);
    const { container, rerender } = render(<DistributionChips dist={onlyRisk} />);
    expect(container.querySelectorAll("li.cc-dc")).toHaveLength(5);
    expect(container.querySelectorAll("li.cc-dc--zero")).toHaveLength(4);
    expect(container.querySelector("li.cc-st--risk")?.classList.contains("cc-dc--zero")).toBe(false);
    rerender(<DistributionChips dist={onlyRisk} size="sm" hideZero />);
    const chips = Array.from(container.querySelectorAll("li.cc-dc"));
    expect(chips).toHaveLength(1);
    expect(chips[0]?.classList.contains("cc-dc--sm")).toBe(true);
    expect(chips[0]?.querySelector(".cc-si")?.classList.contains("cc-si--20")).toBe(false);
  });

  it("목록은 role=list, 막대·도넛·비율 요소가 없다(퍼센트 기호 0)", () => {
    const { container } = render(<DistributionChips dist={dist} lead />);
    expect(container.querySelector("ul")?.getAttribute("role")).toBe("list");
    expect(container.textContent).not.toContain("%");
    expect(container.querySelector("progress, meter, canvas")).toBeNull();
  });

  it("체험 C 문 단위 분포(REPORT_C.doors)도 상태 글자가 모두 보인다", () => {
    for (const d of REPORT_C.doors) {
      const { container, unmount } = render(<DistributionChips dist={d.distribution} size="sm" hideZero />);
      expect(classTokens(container).filter((c) => !c.startsWith("cc-"))).toEqual([]);
      unmount();
    }
  });
});

describe("StatusLegend", () => {
  it("5상태 도형 + 상태 글자 + 한 줄 뜻(STATUS_ORDER 순), 툴팁(title) 없음", () => {
    const { container } = render(<StatusLegend />);
    const rows = Array.from(container.querySelectorAll("dl > div"));
    expect(rows.map((r) => r.querySelector("dt")?.textContent?.trim())).toEqual(["위험", "주의", "확인 불가", "이상 없음", "해당 없음"]);
    expect(rows.map((r) => r.querySelector("dd")?.textContent)).toEqual([
      "위반이 데이터로 확인됨",
      "확인할 것이 있음",
      "증거가 모자라 판단하지 못함",
      "확인한 범위에서 위반이 없음",
      "점검할 대상이 없음(확인됨)",
    ]);
    expect(container.querySelectorAll("[title]")).toHaveLength(0);
    expect(screen.getByRole("group").getAttribute("aria-label")).toBe("상태 뜻");
  });
});
