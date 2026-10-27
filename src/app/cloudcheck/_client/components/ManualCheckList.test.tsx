// @vitest-environment jsdom
// ManualCheckList — 직접 볼 목록: 화면에는 체크 칸이 없다(번호 목록), 인쇄에만 빈 칸·메모 열. 정렬 = 문 → priority → origin, 같은 점검·같은 사유 6개 이상은 한 행.
import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { ManualCheckItem } from "../../../../lib/cloudcheck/model/report";
import { MOCK_CATALOG_BY_ID } from "../mocks/catalog";
import { MOCK_REPORTS, REPORT_AZURE_A, REPORT_D, REPORT_REAL_D } from "../mocks/reports";
import { MANUAL_GROUP_MIN, ManualCheckList, sortManual } from "./ManualCheckList";
import { selfAnswerKey } from "./GuideCard";
import { attrValues, unexpectedMissing } from "./__tests__/render";

const render1 = (items: readonly ManualCheckItem[], over: { selfAnswers?: Record<string, "yes" | "no" | "unknown">; onPrintList?: () => void } = {}) =>
  render(<ManualCheckList items={items} catalog={MOCK_CATALOG_BY_ID} selfAnswers={over.selfAnswers ?? {}} onSelfAnswer={vi.fn()} onPrintList={over.onPrintList} />);

describe("ManualCheckList", () => {
  it("화면 구조: h2 '직접 볼 목록' + 안내 + 표(번호·문·무엇을·왜·어떻게·메모), 체크박스·입력 0", () => {
    const { container } = render1(REPORT_D.manualChecklist);
    expect(screen.getByRole("heading", { level: 2 }).textContent).toBe("직접 볼 목록");
    expect(container.textContent).toContain("이 도구가 판단하지 못했거나 볼 수 없는 것입니다. 하나씩 직접 확인하세요.");
    const ths = Array.from(container.querySelectorAll("thead th")).map((th) => th.textContent);
    expect(ths).toEqual(["번호", "문", "무엇을", "왜 판단하지 못했나", "어떻게 보나", "메모"]);
    expect(container.querySelector("input, textarea, select")).toBeNull(); // 화면 체크 칸 없음(Q10)
    expect(container.querySelector(".cc-manual")).not.toBeNull();
    expect(container.querySelector("details")).toBeNull();
    expect(unexpectedMissing(container)).toEqual([]);
  });

  it("인쇄 전용 요소: 번호 칸 앞 빈 상자(.cc-mc__box, aria-hidden)와 메모 열(.cc-mc__memo) — 화면 숨김은 CSS", () => {
    const { container } = render1(REPORT_D.manualChecklist);
    const rows = container.querySelectorAll("tbody > tr");
    expect(rows.length).toBeGreaterThan(0);
    for (const tr of Array.from(rows)) {
      expect(tr.querySelector(".cc-mc__no .cc-mc__box")?.getAttribute("aria-hidden")).toBe("true");
      expect(tr.querySelector("td.cc-mc__memo")?.textContent).toBe("");
    }
    expect(Array.from(container.querySelectorAll(".cc-mc__no")).map((c) => c.textContent)).toEqual(Array.from(rows, (_, i) => String(i + 1)));
  });

  it("정렬: 문 순서 → priority → origin (엔진이 섞어 줘도 같은 결과)", () => {
    const shuffled = [...REPORT_D.manualChecklist].reverse();
    const a = sortManual(REPORT_D.manualChecklist, MOCK_CATALOG_BY_ID).map((m) => m.id);
    const b = sortManual(shuffled, MOCK_CATALOG_BY_ID).map((m) => m.id);
    expect(new Set(a)).toEqual(new Set(b));
    const doors = sortManual(REPORT_D.manualChecklist, MOCK_CATALOG_BY_ID).map((m) => m.door);
    const order = ["mfa", "key", "net", "sto", "log", null];
    const idx = doors.map((d) => order.indexOf(d));
    expect(idx).toEqual([...idx].sort((x, y) => x - y));
  });

  it(`같은 점검·같은 사유 확인 불가 대상 ${MANUAL_GROUP_MIN}개 이상은 '대상 n개' 한 행 + 접힘(인쇄 펼침, 버튼은 인쇄 숨김)`, () => {
    const groups = REPORT_D.manualChecklist.filter((m) => m.origin === "unknown-item" && m.ruleId === "AWS-KEY-1");
    expect(groups.length).toBeGreaterThanOrEqual(MANUAL_GROUP_MIN);
    const { container } = render1(REPORT_D.manualChecklist);
    const btn = within(container).getByRole("button", { name: `대상 ${groups.length}개` });
    expect(btn.classList.contains("cc-noprint")).toBe(true);
    const region = document.getElementById(btn.getAttribute("aria-controls") ?? "") as HTMLElement;
    expect(region.classList.contains("cc-po")).toBe(true);
    expect(region.querySelectorAll("li")).toHaveLength(groups.length);
    // 묶인 대상 이름은 MaskedValue(이중 렌더)
    expect(region.querySelectorAll(".cc-mask-short").length).toBe(groups.length);
    // 행 수 = 전체 - 묶인 대상 + 1
    expect(container.querySelectorAll("tbody > tr")).toHaveLength(REPORT_D.manualChecklist.length - groups.length + 1);
  });

  it("묶음 기준 미만(5개)이면 묶지 않는다", () => {
    const five = REPORT_D.manualChecklist.filter((m) => m.origin === "unknown-item" && m.ruleId === "AWS-KEY-1").slice(0, MANUAL_GROUP_MIN - 1);
    const { container } = render1(five);
    expect(container.querySelectorAll("tbody > tr")).toHaveLength(five.length);
    expect(screen.queryByRole("button", { name: /대상 \d+개/ })).toBeNull();
  });

  it("무엇을 칸: 점검 제목 + 대상 이름 + what, origin 칩(범위 밖·직접 확인 안내·자동 안내)", () => {
    const { container } = render1(REPORT_D.manualChecklist);
    const text = container.textContent ?? "";
    expect(text).toContain("범위 밖");
    expect(text).toContain("자동 안내");
    const idp = Array.from(container.querySelectorAll("tbody tr")).find((tr) => tr.textContent?.includes("자동 안내")) as HTMLElement;
    expect(idp.textContent).toContain("자동 판정 범위 밖이라 직접 확인해야 합니다."); // why가 null인 auto-notice
  });

  it("왜 판단하지 못했나: why가 null이면 origin별 대체 문장(out-of-scope·guide-card)", () => {
    const oos = REPORT_D.manualChecklist.filter((m) => m.origin === "out-of-scope");
    expect(oos.length).toBeGreaterThan(0);
    const { container } = render1(oos);
    expect(container.textContent).toContain("이 파일이 다루지 않는 영역입니다.");
    const guide = render1(REPORT_AZURE_A.manualChecklist);
    expect(guide.container.textContent).toContain("직접 확인하는 점검입니다. 자동으로 판정하지 않습니다.");
  });

  it("어떻게 보나: 권한 해소법이면 '필요한 권한: …'에 권한 이름(고정폭 칩)", () => {
    const withPerm = REPORT_D.manualChecklist.filter((m) => m.resolution?.kind === "permission" && m.origin === "unknown-rule");
    expect(withPerm.length).toBeGreaterThan(0);
    const { container } = render1(withPerm);
    expect(container.textContent).toContain("필요한 권한:");
    expect(container.querySelector(".cc-mc__perm")?.textContent).toBe(withPerm[0]?.resolution?.permissions[0]);
  });

  it("guide-card 행: 라디오 없이 단계 요약 + 본인 응답 라벨만(입력은 점검 행의 가이드 카드 한 곳)", () => {
    const guideItem = REPORT_AZURE_A.manualChecklist.find((m) => m.origin === "guide-card") as ManualCheckItem;
    const step = MOCK_CATALOG_BY_ID.get("AZ-MFA-G")!.guide!.steps[0]!;
    const none = render1([guideItem]);
    expect(none.container.querySelectorAll("input")).toHaveLength(0);
    expect(none.container.querySelectorAll(".cc-chip")).toHaveLength(1); // origin 칩(직접 확인 안내)만
    none.unmount();
    const answered = render1([guideItem], { selfAnswers: { [selfAnswerKey("AZ-MFA-G", step.id)]: "no" } });
    expect(answered.container.textContent).toContain("본인 응답: 아니요(검증 안 됨) · 상태는 확인 불가 유지");
    expect(answered.container.querySelectorAll("input")).toHaveLength(0);
  });

  it("빈 상태: 표 없이 안내 한 줄(못 보는 것 7가지는 여전히), [이 목록만 인쇄]는 항목이 있을 때만 + 콜백", () => {
    const empty = render1([], { onPrintList: vi.fn() });
    expect(empty.container.querySelector("table")).toBeNull();
    expect(empty.container.textContent).toContain("직접 볼 것이 없습니다. 이 도구가 보지 못하는 것 7가지는 여전히 직접 확인해야 합니다.");
    expect(screen.queryByRole("button", { name: "이 목록만 인쇄" })).toBeNull();
    empty.unmount();
    const onPrintList = vi.fn();
    render1(REPORT_D.manualChecklist, { onPrintList });
    fireEvent.click(screen.getByRole("button", { name: "이 목록만 인쇄" }));
    expect(onPrintList).toHaveBeenCalledTimes(1);
  });

  it("실제 D: 속성에 대상 이름 0, 체험 A(콘솔 사용자 0)의 IdP 안내도 렌더", () => {
    const { container } = render1(REPORT_REAL_D.manualChecklist);
    for (const m of REPORT_REAL_D.manualChecklist) {
      const n = m.resource?.name;
      if (n?.kind === "sensitive") expect(attrValues(container).some((a) => a.includes(n.full))).toBe(false);
    }
    const a = render1(MOCK_REPORTS.A.manualChecklist);
    expect(a.container.querySelectorAll("tbody > tr")).toHaveLength(MOCK_REPORTS.A.manualChecklist.length);
  });
});
