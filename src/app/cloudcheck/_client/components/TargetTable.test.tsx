// @vitest-environment jsdom
// TargetTable — 대상 표: 7열, 50행 단위 더 보기(넘친 행은 cc-fold cc-po), 이상 없음 행 인쇄 생략, 예외 행·라벨(상태는 그대로), 예외 폼.
import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { ExceptionOverlay, IsoDate, ItemResult, Label, RuleResult } from "../../../../lib/cloudcheck/model/report";
import { sens } from "../mocks/build";
import { MOCK_OVERLAY_B } from "../mocks/extras";
import { REPORT_B, REPORT_C, REPORT_HOSTILE } from "../mocks/reports";
import { TABLE_PAGE_SIZE, TargetTable, type TargetTableProps } from "./TargetTable";
import { attrValues, unexpectedMissing } from "./__tests__/render";

const TODAY = "2026-10-19" as IsoDate;
const ruleOf = (r: { doors: readonly { rules: readonly RuleResult[] }[] }, id: string): RuleResult => r.doors.flatMap((d) => d.rules).find((x) => x.ruleId === id) as RuleResult;

function props(rule: RuleResult, over: Partial<TargetTableProps> = {}): TargetTableProps {
  return {
    rule,
    overlay: null,
    shown: TABLE_PAGE_SIZE,
    onMore: vi.fn(),
    canMark: (i: ItemResult) => i.status === "risk" || i.status === "caution",
    editingId: null,
    onOpenForm: vi.fn(),
    onSave: vi.fn(),
    onRemove: vi.fn(),
    today: TODAY,
    ...over,
  };
}

describe("TargetTable 구조", () => {
  it("표 role 명시(table·rowgroup·row·columnheader·cell — 모바일 카드 변환 대비) + 열 머리 7개 + 캡션(숨김)", () => {
    const r = ruleOf(REPORT_C, "AWS-STO-2");
    const { container } = render(<TargetTable {...props(r)} />);
    const table = container.querySelector("table.cc-tt.cc-ct") as HTMLElement;
    expect(table.getAttribute("role")).toBe("table");
    expect(Array.from(table.querySelectorAll("thead th")).map((th) => th.textContent)).toEqual(["상태", "대상", "위치", "사실", "사유", "표시", "동작"]);
    for (const th of Array.from(table.querySelectorAll("thead th"))) {
      expect(th.getAttribute("scope")).toBe("col");
      expect(th.getAttribute("role")).toBe("columnheader");
    }
    expect(table.querySelector("caption.cc-vh")?.textContent).toBe("대상");
    expect(table.querySelectorAll("tbody > tr[role='row']:not(.cc-print-only)").length).toBe(r.items.length);
    for (const td of Array.from(table.querySelectorAll("tbody td"))) expect(td.getAttribute("role")).toBe("cell");
    // 모든 셀에 모바일 카드용 data-label(정적 글자)
    expect(table.querySelectorAll("tbody tr:not(.cc-print-only):not(.cc-tt__form) td:not([data-label])").length).toBe(0);
    expect(unexpectedMissing(container)).toEqual([]);
  });

  it("행: 상태 배지(sm) · 대상 이름(MaskedValue) + 종류 · 위치 · 사실 · 사유", () => {
    const r = ruleOf(REPORT_C, "AWS-STO-2");
    const { container } = render(<TargetTable {...props(r)} />);
    const first = container.querySelector("tbody tr") as HTMLElement;
    expect(first.querySelector(".cc-sb--sm")?.textContent).toBe("위험");
    const name = r.items[0]?.resource.name;
    expect(name?.kind).toBe("sensitive");
    if (name?.kind === "sensitive") {
      expect(first.querySelector(".cc-tt__name .cc-mask-full")?.textContent).toBe(name.full);
      expect(first.querySelector(".cc-tt__name .cc-mask-short")?.textContent).toBe(name.masked);
    }
    expect(first.querySelector(".cc-tt__type")?.textContent).toBe("S3 버킷");
    expect(first.textContent).toContain("ap-northeast-2"); // 위치(리전)
  });

  it("전역 대상은 '전역', 적대 이름은 글자 그대로(img 0)", () => {
    const iam = ruleOf(REPORT_C, "AWS-MFA-2");
    expect(render(<TargetTable {...props(iam)} />).container.textContent).toContain("전역");
    const hostile = ruleOf(REPORT_HOSTILE, "AWS-STO-2");
    const { container } = render(<TargetTable {...props(hostile)} />);
    expect(container.querySelector("img, script, svg[onload]")).toBeNull();
    const fulls = hostile.items.flatMap((i) => (i.resource.name.kind === "sensitive" ? [i.resource.name.full] : []));
    expect(fulls.length).toBeGreaterThan(0);
    for (const f of fulls) expect(container.textContent).toContain(f);
    for (const f of fulls) expect(attrValues(container).some((a) => a.length >= 3 && a.includes(f))).toBe(false);
  });
});

describe("TargetTable 쪽 나누기·인쇄", () => {
  const many = (n: number): RuleResult => {
    const base = ruleOf(REPORT_C, "AWS-MFA-2");
    const proto = base.items[0] as ItemResult;
    return { ...base, items: Array.from({ length: n }, (_, i) => ({ ...proto, id: `bulk-${i}`, resource: { ...proto.resource, name: sens("userName", `user-name-${i}`, `user-${i}`) } })) };
  };

  it("50행만 보이고 나머지는 cc-fold cc-po(인쇄 펼침)로 DOM에 있으며, [더 보기(n개 남음)]은 인쇄에서 숨김", () => {
    const onMore = vi.fn();
    const { container } = render(<TargetTable {...props(many(120), { onMore })} />);
    const rows = Array.from(container.querySelectorAll("tbody > tr[role='row']"));
    expect(rows).toHaveLength(120);
    expect(rows.filter((r) => r.classList.contains("cc-fold"))).toHaveLength(70);
    expect(rows.filter((r) => r.classList.contains("cc-po"))).toHaveLength(70);
    expect(rows.slice(0, 50).every((r) => !r.classList.contains("cc-fold"))).toBe(true);
    const more = screen.getByRole("button", { name: "더 보기(70개 남음)" });
    expect(more.classList.contains("cc-noprint")).toBe(true);
    fireEvent.click(more);
    expect(onMore).toHaveBeenCalledTimes(1);
  });

  it("shown이 전체 이상이면 더 보기 버튼이 없다", () => {
    const { container } = render(<TargetTable {...props(many(40))} />);
    expect(container.querySelector("button.cc-noprint:not(.cc-btn--ghost)")).toBeNull();
    expect(screen.queryByText(/남음/)).toBeNull();
  });

  it("이상 없음 행은 cc-tt__row--clear(인쇄 숨김) + 인쇄 전용 생략 줄(cc-print-only)", () => {
    const r = ruleOf(REPORT_C, "AWS-STO-2");
    const clearN = r.items.filter((i) => i.status === "clear").length;
    expect(clearN).toBeGreaterThan(0);
    const { container } = render(<TargetTable {...props(r)} />);
    expect(container.querySelectorAll("tr.cc-tt__row--clear")).toHaveLength(clearN);
    expect(container.querySelector("tr.cc-print-only")?.textContent).toBe(`이상 없음 대상 ${clearN}개는 인쇄본에서 목록을 생략했습니다.`);
    const allRisk = ruleOf(REPORT_C, "AWS-KEY-4");
    expect(render(<TargetTable {...props({ ...allRisk, items: allRisk.items.filter((i) => i.status !== "clear") })} />).container.querySelector("tr.cc-print-only")).toBeNull();
  });
});

describe("TargetTable 예외", () => {
  const b = ruleOf(REPORT_B, "AWS-STO-2");

  it("[예외로 표시]는 canMark인 대상(위험·주의)에만, 이상 없음·확인 불가에는 없다 — 접근 이름에 대상 이름", () => {
    const r = ruleOf(REPORT_C, "AWS-STO-2");
    const onOpenForm = vi.fn();
    const { container } = render(<TargetTable {...props(r, { onOpenForm })} />);
    const buttons = Array.from(container.querySelectorAll("button.cc-btn--ghost"));
    const marked = r.items.filter((i) => i.status === "risk" || i.status === "caution").length;
    expect(buttons).toHaveLength(marked);
    const first = buttons[0] as HTMLElement;
    const ids = (first.getAttribute("aria-labelledby") ?? "").split(" ");
    expect(ids[0]).toBe(first.id);
    const firstName = r.items[0]?.resource.name;
    expect(firstName?.kind === "sensitive" && document.getElementById(ids[1] ?? "")?.textContent?.includes(firstName.full)).toBe(true); // 이름은 화면의 MaskedValue에서(속성에 없다)
    expect(first.getAttribute("aria-label")).toBeNull();
    fireEvent.click(first);
    expect(onOpenForm).toHaveBeenCalledWith(r.items[0]?.id);
  });

  it("오버레이: 예외 행은 cc-exc(만료 cc-exc--expired) + 라벨 + [예외 해제], 상태 배지는 그대로(G-D21)", () => {
    const onRemove = vi.fn();
    const key1 = ruleOf(REPORT_B, "AWS-KEY-1"); // MOCK_OVERLAY_B: 레거시 버킷(활성) · choi 키(만료)
    const badges = (c: HTMLElement): string[] => Array.from(c.querySelectorAll("tbody > tr[role='row']:not(.cc-print-only) .cc-sb")).map((e) => e.textContent ?? "");
    for (const r of [b, key1]) {
      const plain = render(<TargetTable {...props(r)} />);
      const withExc = render(<TargetTable {...props(r, { overlay: MOCK_OVERLAY_B, onRemove })} />);
      expect(badges(withExc.container)).toEqual(badges(plain.container));
      expect(withExc.container.querySelectorAll(".cc-excl").length).toBe(withExc.container.querySelectorAll("tr.cc-exc").length);
      expect(plain.container.querySelectorAll("tr.cc-exc")).toHaveLength(0);
      plain.unmount();
      withExc.unmount();
    }
    const active = render(<TargetTable {...props(b, { overlay: MOCK_OVERLAY_B, onRemove })} />);
    expect(active.container.querySelectorAll("tr.cc-exc").length).toBe(1);
    expect(active.container.querySelector("tr.cc-exc--expired")).toBeNull();
    expect(active.container.querySelector(".cc-excl")?.textContent).toContain("예외 표시(상태는 그대로)");
    const remove = within(active.container).getByRole("button", { name: /예외 해제/ });
    fireEvent.click(remove);
    expect(onRemove).toHaveBeenCalledTimes(1);
    active.unmount();
    const expired = render(<TargetTable {...props(key1, { overlay: MOCK_OVERLAY_B })} />);
    expect(expired.container.querySelectorAll("tr.cc-exc--expired")).toHaveLength(1);
    expect(expired.container.querySelector(".cc-excl--expired")?.textContent).toContain("예외 표시 만료되어 해제됨");
    // 예외가 붙은 행에는 [예외로 표시]가 없다(해제만)
    for (const tr of Array.from(expired.container.querySelectorAll("tr.cc-exc"))) expect(tr.textContent).not.toContain("예외로 표시");
  });

  it("editingId인 대상 바로 아래에 예외 폼 행(tr.cc-tt__form), 저장·취소가 대상·값과 함께 올라간다", () => {
    const onSave = vi.fn();
    const onCloseForm = vi.fn();
    const target = b.items.find((i) => i.status === "caution") as ItemResult;
    const { container } = render(<TargetTable {...props(b, { editingId: target.id, onSave, onCloseForm })} />);
    const formRow = container.querySelector("tr.cc-tt__form") as HTMLElement;
    expect(formRow.previousElementSibling?.textContent).toContain(target.resource.name.kind === "sensitive" ? target.resource.name.full : "");
    expect(formRow.querySelector("form.cc-xf")).not.toBeNull();
    fireEvent.change(within(formRow).getByLabelText("사유(필수)"), { target: { value: "다음 분기에 정리" } });
    fireEvent.click(within(formRow).getByRole("button", { name: "예외로 표시하기" }));
    expect(onSave).toHaveBeenCalledTimes(1);
    expect(onSave.mock.calls[0]?.[0]).toBe(target);
    expect(onSave.mock.calls[0]?.[1]).toEqual({ reason: "다음 분기에 정리", until: "2026-11-18" });
    fireEvent.click(within(formRow).getByRole("button", { name: "취소" }));
    expect(onCloseForm).toHaveBeenCalledTimes(1);
  });

  it("onCloseForm이 없으면 취소는 onOpenForm('')으로 닫는다", () => {
    const onOpenForm = vi.fn();
    const target = b.items.find((i) => i.status === "caution") as ItemResult;
    const { container } = render(<TargetTable {...props(b, { editingId: target.id, onOpenForm })} />);
    fireEvent.click(within(container.querySelector("tr.cc-tt__form") as HTMLElement).getByRole("button", { name: "취소" }));
    expect(onOpenForm).toHaveBeenCalledWith("");
  });

  it("라벨(LabelChip)과 예외 라벨이 표시 칸에 함께 — 라벨은 상태를 바꾸지 않는다", () => {
    const label: Label = { kind: "intended-public-candidate", basis: "static-website" };
    const withLabel: RuleResult = { ...b, items: b.items.map((i, n) => (n === 0 ? { ...i, labels: [label] } : i)) };
    const { container } = render(<TargetTable {...props(withLabel)} />);
    expect(container.querySelector("tbody tr .cc-chip")?.textContent).toBe("의도된 공개 후보");
    expect(container.querySelector("tbody tr .cc-sb")?.textContent).toBe(b.items[0]?.status === "caution" ? "주의" : "위험");
    const overlay: ExceptionOverlay = MOCK_OVERLAY_B;
    expect(overlay.counts.active).toBe(1);
  });
});
