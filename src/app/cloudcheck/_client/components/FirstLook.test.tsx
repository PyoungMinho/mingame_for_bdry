// @vitest-environment jsdom
// FirstLook — 먼저 볼 3개(D6): findings / unlock / none-found 세 모드. 번호 장식 없음, 축하 연출 없음.
import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { Report, RuleId, RuleResult } from "../../../../lib/cloudcheck/model/report";
import { MOCK_CATALOG_BY_ID } from "../mocks/catalog";
import { MOCK_REPORTS, REPORT_AZURE_A, REPORT_B, REPORT_C, REPORT_D } from "../mocks/reports";
import { FirstLook } from "./FirstLook";
import { unexpectedMissing } from "./__tests__/render";

const rulesOf = (r: Report): ReadonlyMap<RuleId, RuleResult> => new Map(r.doors.flatMap((d) => d.rules).map((x) => [x.ruleId, x]));
const handlers = () => ({ onFix: vi.fn(), onShowTargets: vi.fn(), onShowManual: vi.fn() });

describe("FirstLook findings", () => {
  it("체험 C: 위험 3행 — 배지 + 점검 제목 + 사유 줄 + [고치는 법] + [대상 n개 보기], h2 '먼저 볼 3개'", () => {
    const h = handlers();
    const { container } = render(<FirstLook firstLook={REPORT_C.firstLook} rules={rulesOf(REPORT_C)} catalog={MOCK_CATALOG_BY_ID} {...h} />);
    expect(screen.getByRole("heading", { level: 2 }).textContent).toBe("먼저 볼 3개");
    const rows = container.querySelectorAll("ol.cc-pl > li.cc-pl__i");
    expect(rows).toHaveLength(3);
    for (const row of Array.from(rows)) {
      expect(row.querySelector(".cc-sb")).not.toBeNull(); // 상태 글자 + 도형
      expect(row.querySelector("h3")?.textContent).toMatch(/^(위험|주의)/);
      expect(row.querySelectorAll("button")).toHaveLength(2);
    }
    expect(unexpectedMissing(container)).toEqual([]);
  });

  it("[고치는 법]은 위험·주의 + fix가 있을 때만, 접근 이름에 점검 제목이 든다(aria-labelledby = 버튼 자기 id + 제목 id)", () => {
    const h = handlers();
    render(<FirstLook firstLook={REPORT_C.firstLook} rules={rulesOf(REPORT_C)} catalog={MOCK_CATALOG_BY_ID} {...h} />);
    const fixButtons = screen.getAllByRole("button").filter((b) => b.id.endsWith("-fix"));
    expect(fixButtons).toHaveLength(3);
    for (const b of fixButtons) {
      const ids = (b.getAttribute("aria-labelledby") ?? "").split(" ");
      expect(ids[0]).toBe(b.id);
      expect(ids).toHaveLength(2);
      expect(document.getElementById(ids[1] ?? "")?.tagName).toBe("H3");
    }
    fireEvent.click(fixButtons[0] as HTMLElement);
    expect(h.onFix).toHaveBeenCalledTimes(1);
    expect(h.onFix.mock.calls[0]?.[0]).toBe(REPORT_C.firstLook.mode === "findings" ? REPORT_C.firstLook.ruleIds[0] : undefined);
  });

  it("[대상 n개 보기]는 해당 점검 id와 함께 호출(화면 이동 아님 — 링크 없음)", () => {
    const h = handlers();
    const { container } = render(<FirstLook firstLook={REPORT_C.firstLook} rules={rulesOf(REPORT_C)} catalog={MOCK_CATALOG_BY_ID} {...h} />);
    const first = REPORT_C.firstLook.mode === "findings" ? REPORT_C.firstLook.ruleIds[0] : undefined;
    const rule = rulesOf(REPORT_C).get(first as RuleId) as RuleResult;
    const btn = within(container.querySelector("li.cc-pl__i") as HTMLElement).getByRole("button", { name: new RegExp(`대상 ${rule.distribution.total}개 보기`) });
    fireEvent.click(btn);
    expect(h.onShowTargets).toHaveBeenCalledWith(first);
    expect(container.querySelector("[href]")).toBeNull();
  });

  it("확인 불가가 채움으로 들어온 행(반쯤본상회)은 빗금 톤 + [직접 볼 목록에서 보기]", () => {
    const h = handlers();
    const { container } = render(<FirstLook firstLook={REPORT_D.firstLook} rules={rulesOf(REPORT_D)} catalog={MOCK_CATALOG_BY_ID} {...h} />);
    const unknownRows = Array.from(container.querySelectorAll("li.cc-pl__i")).filter((r) => r.classList.contains("cc-st--unknown"));
    for (const row of unknownRows) {
      expect(row.classList.contains("cc-hatch")).toBe(true);
      fireEvent.click(within(row as HTMLElement).getByRole("button", { name: /직접 볼 목록에서 보기/ }));
    }
    expect(h.onShowManual).toHaveBeenCalledTimes(unknownRows.length);
    expect(unexpectedMissing(container)).toEqual([]);
  });

  it("주의 모드(멈춘시계상회)도 같은 틀 — 번호를 쓰지 않는다(ol은 의미만, role=list)", () => {
    const { container } = render(<FirstLook firstLook={REPORT_B.firstLook} rules={rulesOf(REPORT_B)} catalog={MOCK_CATALOG_BY_ID} {...handlers()} />);
    expect(container.querySelector("ol")?.getAttribute("role")).toBe("list");
    expect(container.textContent).not.toMatch(/^\s*1\./);
  });
});

describe("FirstLook unlock · none-found", () => {
  it("unlock(Azure 반듯상회): h2 '먼저 풀 것' + 묶음마다 해소법 종류 문장 + 점검 제목 나열, 번호·링크·버튼 없음", () => {
    expect(REPORT_AZURE_A.firstLook.mode).toBe("unlock");
    const { container } = render(<FirstLook firstLook={REPORT_AZURE_A.firstLook} rules={rulesOf(REPORT_AZURE_A)} catalog={MOCK_CATALOG_BY_ID} {...handlers()} />);
    expect(screen.getByRole("heading", { level: 2 }).textContent).toBe("먼저 풀 것");
    const rows = container.querySelectorAll("li.cc-pl__i");
    expect(rows.length).toBeGreaterThan(0);
    for (const row of Array.from(rows)) {
      expect(row.classList.contains("cc-hatch")).toBe(true);
      expect(row.querySelector("svg")).toBeNull();
    }
    expect(container.textContent).toMatch(/직접 확인해야 하는 점검 \d+개입니다|풀 수 있습니다|풀릴 수 있는/);
    expect(unexpectedMissing(container)).toEqual([]);
  });

  it("none-found(AWS 반듯상회): 축하 없이 '확인한 범위에서 위험·주의를 찾지 못했습니다' + 못 보는 것 안내 + 졸업 경로, [조회 범위로 이동]은 onShowScope가 있을 때만", () => {
    expect(MOCK_REPORTS.A.firstLook.mode).toBe("none-found");
    const onShowScope = vi.fn();
    const { container, rerender } = render(<FirstLook firstLook={MOCK_REPORTS.A.firstLook} rules={rulesOf(MOCK_REPORTS.A)} catalog={MOCK_CATALOG_BY_ID} {...handlers()} />);
    expect(screen.getByRole("heading", { level: 2 }).textContent).toBe("확인한 범위에서 위험·주의를 찾지 못했습니다");
    expect(container.textContent).toContain("이 도구가 보지 못하는 것 7가지는 여전히 직접 확인해야 합니다.");
    expect(container.textContent).toContain("더 넓게 보려면: Prowler · Defender for Cloud · CIS 벤치마크");
    expect(container.textContent).not.toMatch(/축하|잘했|완벽|안전/);
    expect(container.querySelector(".cc-banner--info")).not.toBeNull();
    expect(screen.queryByRole("button")).toBeNull();
    rerender(<FirstLook firstLook={MOCK_REPORTS.A.firstLook} rules={rulesOf(MOCK_REPORTS.A)} catalog={MOCK_CATALOG_BY_ID} {...handlers()} onShowScope={onShowScope} />);
    fireEvent.click(screen.getByRole("button", { name: "조회 범위로 이동" }));
    expect(onShowScope).toHaveBeenCalledTimes(1);
    expect(container.querySelector("[href]")).toBeNull();
  });
});
