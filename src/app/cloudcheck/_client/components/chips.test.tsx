// @vitest-environment jsdom
// Chip · LabelChip · ExceptionLabel · ImpactChip · UnknownTone · AccountLabel — 상태 색이 아닌 표시들.
import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { IsoDate, Label } from "../../../../lib/cloudcheck/model/report";
import { sens } from "../mocks/build";
import { AccountLabel } from "./AccountLabel";
import { Chip, ExceptionLabel, ImpactChip, LabelChip } from "./Chip";
import { UnknownTone } from "./UnknownTone";
import { attrValues, classTokens, unexpectedMissing } from "./__tests__/render";

describe("Chip", () => {
  it("변형 클래스(hint·strong·inv·soon)와 기본(실선)", () => {
    const { container } = render(
      <>
        <Chip>기본</Chip>
        <Chip variant="hint">추정</Chip>
        <Chip variant="strong">굵게</Chip>
        <Chip variant="inv">권장</Chip>
        <Chip variant="soon">준비 중</Chip>
      </>,
    );
    const chips = Array.from(container.querySelectorAll(".cc-chip"));
    expect(chips.map((c) => c.className)).toEqual(["cc-chip", "cc-chip cc-chip--hint", "cc-chip cc-chip--strong", "cc-chip cc-chip--inv", "cc-chip cc-chip--soon"]);
  });
});

describe("LabelChip", () => {
  it("라벨 4종: 이름 힌트·오래된 버킷 힌트는 추정(--hint), 의도된 공개 후보·이상한 문자는 실선", () => {
    const labels: Exclude<Label, { kind: "exception" }>[] = [
      { kind: "intended-public-candidate", basis: "static-website" },
      { kind: "name-hint", hint: "assets" },
      { kind: "legacy-hint", basis: "created-before-2023-04" },
      { kind: "unusual-characters" },
    ];
    const out = labels.map((label) => {
      const { container, unmount } = render(<LabelChip label={label} />);
      const chip = container.querySelector(".cc-chip");
      const result = { text: chip?.textContent, hint: chip?.classList.contains("cc-chip--hint") };
      unmount();
      return result;
    });
    expect(out).toEqual([
      { text: "의도된 공개 후보", hint: false },
      { text: "이름 힌트: assets", hint: true },
      { text: "2023-04 이전에 만든 버킷 · 확인 순서 힌트", hint: true },
      { text: "이름에 보이지 않는 문자나 방향 문자가 있어 치환해 보여 줍니다", hint: false },
    ]);
  });
});

describe("ExceptionLabel", () => {
  const base = { kind: "exception" as const, reason: sens("freeText", "레거시 사이트 자산", "•••"), until: "2026-12-31" as IsoDate, createdAt: "2026-10-19" as IsoDate };
  it("active: '예외 표시(상태는 그대로) · 사유 · 만료일까지', 사유는 MaskedValue(인쇄 마스킹 •••)", () => {
    const { container } = render(<ExceptionLabel label={{ ...base, state: "active" }} />);
    expect(container.querySelector(".cc-excl")?.textContent).toBe("예외 표시(상태는 그대로) · 레거시 사이트 자산••• · 2026-12-31까지");
    expect(container.querySelector(".cc-mask-short")?.textContent).toBe("•••");
    expect(container.querySelector(".cc-excl--expired")).toBeNull();
    expect(attrValues(container).some((v) => v.includes("레거시"))).toBe(false);
  });
  it("expired: 점선 + '예외 표시 만료되어 해제됨 · 만료일 …'", () => {
    const { container } = render(<ExceptionLabel label={{ ...base, state: "expired", until: "2026-10-01" as IsoDate }} />);
    expect(container.querySelector(".cc-excl--expired")?.textContent).toBe("예외 표시 만료되어 해제됨 · 만료일 2026-10-01");
  });
});

describe("ImpactChip", () => {
  it("낮음·중간·높음은 클래스(테두리 굵기)로 차등, prodImpact면 '운영 영향 가능' 칩이 더 붙는다", () => {
    const texts = (["low", "medium", "high"] as const).map((impact) => {
      const { container, unmount } = render(<ImpactChip impact={impact} prodImpact={false} />);
      const r = [container.querySelector(".cc-impact")?.className, container.querySelector(".cc-impact")?.textContent];
      unmount();
      return r;
    });
    expect(texts).toEqual([
      ["cc-impact cc-impact--low", "운영 영향: 낮음"],
      ["cc-impact cc-impact--medium", "운영 영향: 중간"],
      ["cc-impact cc-impact--high", "운영 영향: 높음"],
    ]);
    const { container } = render(<ImpactChip impact="low" prodImpact />);
    expect(Array.from(container.querySelectorAll(".cc-impact")).map((e) => e.textContent)).toEqual(["운영 영향: 낮음", "운영 영향 가능"]);
  });
});

describe("UnknownTone", () => {
  it("확인 불가 톤: 빗금 클래스, 상태 도형(svg)과 '확인 불가' 글자가 없다", () => {
    const { container } = render(
      <UnknownTone>
        <p>읽지 못했습니다</p>
      </UnknownTone>,
    );
    const el = container.firstElementChild;
    expect(el?.classList.contains("cc-untone")).toBe(true);
    expect(el?.classList.contains("cc-hatch")).toBe(true);
    expect(container.querySelector("svg")).toBeNull();
    expect(container.textContent).not.toContain("확인 불가");
  });
  it("as=p면 <p>", () => {
    const { container } = render(<UnknownTone as="p">한 줄</UnknownTone>);
    expect(container.firstElementChild?.tagName).toBe("P");
  });
});

describe("AccountLabel", () => {
  it("별칭(MaskedValue) + ••••끝4자리(aria-hidden) + 숨은 글자 '끝 네 자리 3333' — 전체 계정 ID는 없다", () => {
    const { container } = render(<AccountLabel alias={sens("alias", "halfseen-prod", "alias-001")} last4="3333" />);
    expect(container.querySelector(".cc-mask-full")?.textContent).toBe("halfseen-prod");
    expect(container.querySelector(".cc-mask-short")?.textContent).toBe("alias-001");
    const l4 = container.querySelector(".cc-acct__l4");
    expect(l4?.textContent).toBe("••••3333");
    expect(l4?.getAttribute("aria-hidden")).toBe("true");
    expect(container.querySelector(".cc-vh")?.textContent).toBe("끝 네 자리 3333");
    expect(unexpectedMissing(container)).toEqual([]);
  });
  it("별칭이 없으면 '별칭 없음'", () => {
    const { container } = render(<AccountLabel alias={null} last4="1234" />);
    expect(container.querySelector(".cc-acct__alias")?.textContent).toBe("별칭 없음");
  });
  it("클래스는 전부 cc- 접두", () => {
    const { container } = render(<AccountLabel alias={sens("alias", "x-y", "alias-001")} last4="0000" />);
    expect(classTokens(container).filter((c) => !c.startsWith("cc-"))).toEqual([]);
  });
});
