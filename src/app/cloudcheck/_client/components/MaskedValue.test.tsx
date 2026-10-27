// @vitest-environment jsdom
// MaskedValue — 관문 ①: 사용자 데이터를 그리는 유일한 통로(R-12·R-13). 적대 값이 글자로만 나오고(img 0·script 0), 속성에는 값이 없고, 이중 렌더가 CSS 전환 전제로 둘 다 DOM에 있다.
import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { DisplayValue } from "../../../../lib/cloudcheck/model/report";
import { plain, redacted, sens } from "../mocks/build";
import { HOSTILE_VALUES } from "../mocks/reports";
import { MaskedValue } from "./MaskedValue";
import { attrValues, classTokens, unexpectedMissing } from "./__tests__/render";

describe("MaskedValue", () => {
  it("plain: 비식별 상수를 그대로, translate=no, 이중 렌더 없음", () => {
    const { container } = render(<MaskedValue value={plain("ap-northeast-2")} />);
    const el = container.querySelector(".cc-mv");
    expect(el?.textContent).toBe("ap-northeast-2");
    expect(el?.getAttribute("translate")).toBe("no");
    expect(container.querySelector(".cc-mask-full")).toBeNull();
    expect(container.querySelector(".cc-mask-short")).toBeNull();
  });

  it("sensitive: 전체 값(cc-mask-full)과 마스킹 값(cc-mask-short)을 둘 다 DOM에 둔다 — 화면/인쇄는 CSS가 고른다", () => {
    const { container } = render(<MaskedValue value={sens("userName", "alice-prod", "user-003")} id="n1" />);
    const root = container.querySelector(".cc-mv");
    expect(root?.id).toBe("n1");
    expect(root?.getAttribute("translate")).toBe("no");
    expect(container.querySelector(".cc-mask-full")?.textContent).toBe("alice-prod");
    expect(container.querySelector(".cc-mask-short")?.textContent).toBe("user-003");
  });

  it("redacted: '가린 값'만 — 원값 개념이 DOM에 없다, 화면·인쇄 같음(cc-mask 이중 렌더 없음)", () => {
    const { container } = render(<MaskedValue value={redacted()} />);
    const el = container.querySelector(".cc-mv--redacted");
    expect(el?.textContent).toBe("가린 값");
    expect(el?.getAttribute("translate")).toBe("no");
    expect(container.querySelector(".cc-mask-full")).toBeNull();
  });

  it("flags: truncated → 값 뒤 '(일부)'(전체 쪽만 보임) + 숨김 설명, 제어·양방향 치환 → 숨김 설명(값 밖)", () => {
    const { container } = render(<MaskedValue value={sens("resourceName", "a".repeat(255) + "…", "bucket-001", ["truncated", "bidi-replaced", "control-chars-replaced"])} />);
    const mv = container.querySelector(".cc-mv");
    expect(mv?.textContent).not.toContain("(일부)"); // 값 안에는 섞이지 않는다(복사 보호)
    const trunc = Array.from(container.querySelectorAll(".cc-mask-full")).find((e) => e.textContent?.includes("(일부)"));
    expect(trunc).toBeDefined();
    const hidden = Array.from(container.querySelectorAll(".cc-vh")).map((e) => e.textContent);
    expect(hidden).toEqual(["긴 이름이라 일부만 보여 줍니다", "보이지 않는 문자를 치환해 보여 줍니다", "방향 제어 문자를 치환해 보여 줍니다"]);
    expect(mv?.querySelector(".cc-vh")).toBeNull();
  });

  it("적대 값: 글자 그대로 나오고 img·script·svg 요소가 생기지 않으며 HTML이 이스케이프된다", () => {
    for (const v of HOSTILE_VALUES) {
      const { container, unmount } = render(<MaskedValue value={v} />);
      expect(container.querySelector("img, script, svg, iframe, style")).toBeNull();
      if (v.kind === "sensitive") {
        expect(container.querySelector(".cc-mask-full")?.textContent).toBe(v.full);
        expect(container.innerHTML).not.toContain("<img");
        expect(container.innerHTML).not.toContain("<script");
      }
      unmount();
    }
  });

  it("제어 문자 치환 표시(U+FFFD)와 RTL 마커가 있는 값도 원문 그대로(엔진이 정리한 값을 다시 만지지 않는다)", () => {
    const value = sens("fileName", "evil�txt.sh", "file-001", ["bidi-replaced"]);
    const { container } = render(<MaskedValue value={value} />);
    expect(container.querySelector(".cc-mask-full")?.textContent).toBe("evil�txt.sh");
  });

  it("속성(aria-label·title·data-* 포함)에 사용자 데이터가 없다 — id만 허용(G-D8)", () => {
    const values: DisplayValue[] = [...HOSTILE_VALUES, sens("userName", "dev-kim", "user-001"), sens("accountId", "111122223333", "••••3333")];
    for (const v of values) {
      const { container, unmount } = render(<MaskedValue value={v} />);
      if (v.kind === "sensitive") {
        const leaks = attrValues(container).filter((a) => a.length >= 3 && a.includes(v.full));
        expect(leaks).toEqual([]);
      }
      unmount();
    }
  });

  it("클래스는 전부 cc- 접두, 카탈로그 키 누락 0", () => {
    const { container } = render(<MaskedValue value={sens("userName", "x-user", "user-001", ["truncated", "bidi-replaced", "control-chars-replaced"])} />);
    expect(classTokens(container).filter((c) => !c.startsWith("cc-"))).toEqual([]);
    expect(unexpectedMissing(container)).toEqual([]);
  });
});
