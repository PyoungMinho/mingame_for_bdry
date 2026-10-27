// @vitest-environment jsdom
// PrintOptions · PrintHead — 인쇄 옵션(이름·ID 표시 기본 꺼짐)과 인쇄 머리(전체/목록 두 벌, 마스킹 기본, 도장·서명란 없음).
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { MOCK_REPORTS, REPORT_C, REPORT_HOSTILE, REPORT_REAL_D } from "../mocks/reports";
import { PrintHead, PrintOptions } from "./Print";
import { attrValues, unexpectedMissing } from "./__tests__/render";

describe("PrintOptions", () => {
  it("기본값: 전체 리포트 선택, '이름·ID 표시' 꺼짐 — 누르면 {scope:'full', unmask:false}", () => {
    const onPrint = vi.fn();
    render(<PrintOptions onPrint={onPrint} />);
    expect((screen.getByLabelText("전체 리포트") as HTMLInputElement).checked).toBe(true);
    expect((screen.getByLabelText("직접 볼 목록만") as HTMLInputElement).checked).toBe(false);
    expect((screen.getByLabelText("이름·ID 표시") as HTMLInputElement).checked).toBe(false);
    fireEvent.click(screen.getByRole("button", { name: "인쇄 창 열기" }));
    expect(onPrint).toHaveBeenCalledWith({ scope: "full", unmask: false });
  });

  it("범위와 이름·ID 표시를 고르면 그 값이 올라간다", () => {
    const onPrint = vi.fn();
    render(<PrintOptions onPrint={onPrint} />);
    fireEvent.click(screen.getByLabelText("직접 볼 목록만"));
    fireEvent.click(screen.getByLabelText("이름·ID 표시"));
    fireEvent.click(screen.getByRole("button", { name: "인쇄 창 열기" }));
    expect(onPrint).toHaveBeenCalledWith({ scope: "list", unmask: true });
  });

  it("안내: 기본은 가려서 인쇄 + 이 설정은 인쇄 버튼으로 인쇄할 때만 적용(브라우저 메뉴는 항상 가림)", () => {
    const { container } = render(<PrintOptions onPrint={vi.fn()} />);
    expect(container.querySelector("legend")?.textContent).toBe("인쇄 옵션");
    expect(container.textContent).toContain("기본은 가려서 인쇄합니다.");
    expect(container.textContent).toContain("브라우저 메뉴로 인쇄하면 항상 가려서 인쇄합니다.");
    expect(unexpectedMissing(container)).toEqual([]);
  });
});

describe("PrintHead", () => {
  it("두 벌 모두 cc-print-only(화면 숨김)이고 각각 cc-phead--full / cc-phead--list", () => {
    const { container } = render(
      <>
        <PrintHead report={REPORT_REAL_D} kind="full" pageVersion="0.1.0" />
        <PrintHead report={REPORT_REAL_D} kind="list" pageVersion="0.1.0" />
      </>,
    );
    const heads = Array.from(container.children);
    expect(heads.map((h) => h.className)).toEqual(["cc-print-only cc-phead--full", "cc-print-only cc-phead--list"]);
  });

  it("전체: 제목 · 신원(별칭·끝4자리) · 범위 · 수집 시각 · 수집기 버전 · 입력 파일 이름(MaskedValue) · 룰셋 버전 · 마스킹 안내 이중 렌더", () => {
    const { container } = render(<PrintHead report={REPORT_REAL_D} kind="full" pageVersion="0.1.0" />);
    const text = container.textContent ?? "";
    expect(text).toContain("문단속 5 리포트 · 올린 파일 기준 참고 자료");
    expect(text).toContain("••••3333");
    expect(text).toContain("리전: 확인 15개 · 활성 17개");
    expect(text).toContain("2026-10-19 12:12 KST (03:12 UTC)");
    expect(container.querySelectorAll(".cc-mask-short").length).toBeGreaterThan(0);
    expect(container.querySelector("p > span.cc-mask-short")?.textContent).toBe("이름과 ID는 가려서 인쇄했습니다.");
    expect(container.querySelector("p > span.cc-mask-full")?.textContent).toBe("이 인쇄본에는 실제 이름과 ID가 들어 있습니다.");
    expect(text).toContain("0.1.0");
    expect(text).not.toContain("111122223333"); // 전체 계정 ID 없음
  });

  it("목록만: 짧은 제목 + 분포 문장 + '점검 결과가 아니라 직접 확인할 일의 목록', 범위·입력 파일은 없다", () => {
    const { container } = render(<PrintHead report={REPORT_C} kind="list" />);
    const text = container.textContent ?? "";
    expect(text).toContain("문단속 5 직접 볼 목록 · 올린 파일 기준 참고 자료");
    expect(text).toContain("이 목록은 점검 결과가 아니라 직접 확인할 일의 목록입니다.");
    const d = REPORT_C.distribution.rules;
    expect(text).toContain(`점검 ${d.total}개 — 위험 ${d.risk} · 주의 ${d.caution} · 확인 불가 ${d.unknown} · 이상 없음 ${d.clear} · 해당 없음 ${d.na}`);
    expect(text).not.toContain("리전:");
  });

  it("체험이면 '체험 모드 · 가짜 데이터' 큰 제목(.cc-print-demo), 실제면 없다", () => {
    expect(render(<PrintHead report={MOCK_REPORTS.C} kind="full" />).container.querySelector(".cc-print-demo")?.textContent).toBe("체험 모드 · 가짜 데이터");
    expect(render(<PrintHead report={REPORT_REAL_D} kind="full" />).container.querySelector(".cc-print-demo")).toBeNull();
  });

  it("도장·서명란·'확인자'·'판정' 칸이 없다, 입력 요소 0", () => {
    const { container } = render(<PrintHead report={REPORT_REAL_D} kind="full" />);
    expect(container.textContent).not.toMatch(/서명|도장|확인자|판정:|적합|승인/);
    expect(container.querySelector("input, textarea, button")).toBeNull();
  });

  it("적대 입력 파일 이름도 글자로만, 속성에는 값이 없다", () => {
    const { container } = render(<PrintHead report={REPORT_HOSTILE} kind="full" />);
    expect(container.querySelector("img, script")).toBeNull();
    const names = REPORT_HOSTILE.collection.inputs.map((i) => i.name);
    for (const n of names) if (n.kind === "sensitive") expect(attrValues(container).some((a) => a.includes(n.full))).toBe(false);
  });
});
