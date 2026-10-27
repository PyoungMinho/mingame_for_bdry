// @vitest-environment jsdom
// RuleRow — 점검 행: <h3><button aria-expanded aria-controls>, 같은 줄의 다른 버튼은 토글 밖, 상태별 본문(영향·질문·판단하지 못한 이유·푸는 방법·대상 표·근거).
import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { IsoDate, Report, RuleId, RuleResult } from "../../../../lib/cloudcheck/model/report";
import { MOCK_CATALOG_BY_ID } from "../mocks/catalog";
import { MOCK_REPORTS, REPORT_B, REPORT_C, REPORT_D } from "../mocks/reports";
import { RuleRow } from "./RuleRow";
import type { TargetTableProps } from "./TargetTable";
import { unexpectedMissing } from "./__tests__/render";

const rule = (r: Report, id: RuleId): RuleResult => r.doors.flatMap((d) => d.rules).find((x) => x.ruleId === id) as RuleResult;
const table = (r: RuleResult): TargetTableProps => ({
  rule: r,
  overlay: null,
  shown: 50,
  onMore: vi.fn(),
  canMark: () => false,
  editingId: null,
  onOpenForm: vi.fn(),
  onSave: vi.fn(),
  onRemove: vi.fn(),
  today: "2026-10-19" as IsoDate,
});
function row(r: RuleResult, over: { open?: boolean; onFix?: () => void; onShowManual?: () => void; onToggle?: () => void } = {}) {
  const entry = MOCK_CATALOG_BY_ID.get(r.ruleId);
  if (entry === undefined) throw new Error("catalog");
  return render(
    <ul>
      <RuleRow rule={r} entry={entry} open={over.open ?? false} onToggle={over.onToggle ?? vi.fn()} onFix={over.onFix} onShowManual={over.onShowManual} table={table(r)} />
    </ul>,
  );
}

describe("RuleRow 구조", () => {
  it("h3 > 토글 버튼(aria-expanded=false, aria-controls=본문 id) — 이름은 '위험 점검 제목', 사유·동작 버튼은 토글 밖", () => {
    const r = rule(REPORT_C, "AWS-MFA-2");
    const onFix = vi.fn();
    const { container } = row(r, { onFix });
    const h3 = container.querySelector("h3") as HTMLElement;
    const toggle = h3.querySelector("button") as HTMLElement;
    expect(toggle.getAttribute("aria-expanded")).toBe("false");
    expect(toggle.textContent).toMatch(/^위험/);
    expect(document.getElementById(toggle.getAttribute("aria-controls") ?? "")?.classList.contains("cc-rule__body")).toBe(true);
    expect(h3.querySelectorAll("button")).toHaveLength(1);
    const fix = container.querySelector("button.cc-btn") as HTMLElement;
    expect(fix.closest("h3")).toBeNull(); // 상호작용 요소 중첩 금지
    expect(toggle.contains(fix)).toBe(false);
    fireEvent.click(fix);
    expect(onFix).toHaveBeenCalledTimes(1);
  });

  it("열림은 바깥이 소유: open prop이 true면 cc-open, 토글 클릭은 onToggle", () => {
    const onToggle = vi.fn();
    const r = rule(REPORT_C, "AWS-MFA-2");
    const { container, rerender } = row(r, { onToggle });
    fireEvent.click(container.querySelector("h3 button") as HTMLElement);
    expect(onToggle).toHaveBeenCalledTimes(1);
    expect(container.querySelector(".cc-rule__body")?.classList.contains("cc-open")).toBe(false);
    rerender(
      <ul>
        <RuleRow rule={r} entry={MOCK_CATALOG_BY_ID.get(r.ruleId)!} open onToggle={onToggle} table={table(r)} />
      </ul>,
    );
    expect(container.querySelector(".cc-rule__body")?.classList.contains("cc-open")).toBe(true);
    expect(container.querySelector("h3 button")?.getAttribute("aria-expanded")).toBe("true");
  });

  it("DOM id 규칙: li, 토글, [고치는 법] 버튼 id가 dom-ids와 같다(V4 → V3 복귀 포커스용)", () => {
    const r = rule(REPORT_C, "AWS-MFA-2");
    const { container } = row(r, { onFix: vi.fn() });
    expect(container.querySelector("li#cc-rule-AWS-MFA-2")).not.toBeNull();
    expect(container.querySelector("button#cc-rule-AWS-MFA-2-t")).not.toBeNull();
    expect(container.querySelector("button#cc-rule-AWS-MFA-2-fix")).not.toBeNull();
  });

  it("[고치는 법]은 위험·주의 + fix + onFix가 있을 때만", () => {
    const risk = rule(REPORT_C, "AWS-MFA-2");
    expect(row(risk).container.querySelector("button.cc-btn")).toBeNull(); // onFix 없음
    const clear = rule(MOCK_REPORTS.A, "AWS-MFA-1");
    expect(row(clear, { onFix: vi.fn() }).container.querySelector("button.cc-btn")).toBeNull(); // 이상 없음
    const guide = rule(MOCK_REPORTS.D, "AWS-KEY-4"); // 확인 불가
    expect(row(guide, { onFix: vi.fn() }).container.querySelector("button#cc-rule-AWS-KEY-4-fix")).toBeNull();
  });
});

describe("RuleRow 상태별 내용", () => {
  it("위험·주의: 사유 줄 + 꼬리표(asOf가 있으면) + '대상 n개' 칩, 영향 소제목, 근거 링크, 마지막 확인일", () => {
    const r = rule(REPORT_C, "AWS-MFA-2");
    const { container } = row(r, { open: true });
    expect(container.querySelector(".cc-rule__why")).not.toBeNull();
    expect(container.querySelector(".cc-rule__tail")?.textContent).toContain("확인한 범위: 계정 전체");
    expect(Array.from(container.querySelectorAll(".cc-rule__act .cc-chip")).map((c) => c.textContent)).toEqual([`대상 ${r.distribution.total}개`]);
    const subs = Array.from(container.querySelectorAll("h4.cc-rule__sub")).map((h) => h.textContent);
    expect(subs).toContain("영향");
    expect(subs).toContain("근거");
    expect(container.querySelector(".cc-rule__body")?.textContent).toContain("마지막 확인일 2026-10-19");
    expect(container.querySelectorAll(".cc-rule__body a[target='_blank']").length).toBeGreaterThan(0);
  });

  it("주의: '확인할 질문' 소제목 + 질문 문장(questionKey가 있는 점검만)", () => {
    const r = rule(REPORT_B, "AWS-STO-2");
    const entry = MOCK_CATALOG_BY_ID.get(r.ruleId)!;
    expect(r.status).toBe("caution");
    expect(entry.questionKey).not.toBeNull();
    const { container } = row(r, { open: true });
    expect(Array.from(container.querySelectorAll("h4.cc-rule__sub")).map((h) => h.textContent)).toContain("확인할 질문");
    const risk = row(rule(REPORT_C, "AWS-MFA-2"), { open: true });
    expect(Array.from(risk.container.querySelectorAll("h4.cc-rule__sub")).map((h) => h.textContent)).not.toContain("확인할 질문"); // 위험에는 질문 없음
  });

  it("확인 불가: 빗금 톤 + 판단하지 못한 이유(짧은 이름 목록) + 푸는 방법 + [직접 볼 목록에서 보기], 꼬리표 없음", () => {
    const r = rule(REPORT_D, "AWS-KEY-4");
    expect(r.status).toBe("unknown");
    const onShowManual = vi.fn();
    const { container } = row(r, { open: true, onShowManual });
    const li = container.querySelector("li.cc-rule") as HTMLElement;
    expect(li.classList.contains("cc-hatch")).toBe(true);
    expect(li.classList.contains("cc-st--unknown")).toBe(true);
    expect(container.querySelector(".cc-rule__tail")).toBeNull();
    const subs = Array.from(container.querySelectorAll("h4.cc-rule__sub")).map((h) => h.textContent);
    expect(subs).toContain("판단하지 못한 이유");
    expect(subs).toContain("푸는 방법");
    expect(container.querySelector(".cc-rule__body")?.textContent).toContain("다시 수집"); // rerun 해소법
    fireEvent.click(within(container).getByRole("button", { name: /직접 볼 목록에서 보기/ }));
    expect(onShowManual).toHaveBeenCalledTimes(1);
  });

  it("권한 해소법이면 필요한 권한 이름이 푸는 방법에 든다", () => {
    const r = rule(REPORT_D, "AWS-KEY-1");
    expect(r.status === "unknown" && r.resolution.kind).toBe("permission");
    const { container } = row(r, { open: true });
    expect(container.querySelector(".cc-rule__body")?.textContent).toContain("iam:ListAccessKeys");
  });

  it("이상 없음: 꼬리표 + '못 본 것 n' 칩(필수) — 대상 n개 칩과 함께", () => {
    const r = rule(MOCK_REPORTS.A, "AWS-MFA-1");
    const entry = MOCK_CATALOG_BY_ID.get(r.ruleId)!;
    const { container } = row(r);
    const chips = Array.from(container.querySelectorAll(".cc-rule__act .cc-chip")).map((c) => c.textContent);
    expect(chips).toEqual([`대상 ${r.distribution.total}개`, `못 본 것 ${entry.cannotSee.length}`]);
    expect(container.querySelector(".cc-rule__tail")?.textContent).toContain("기준 시각:");
  });

  it("해당 없음: 근거 줄(근거: …) + 꼬리표, '대상 n개' 칩 없음", () => {
    const r = rule(MOCK_REPORTS.A, "AWS-MFA-2");
    expect(r.status).toBe("na");
    const { container } = row(r);
    expect(container.querySelector(".cc-rule__why")?.textContent).toContain("근거:");
    expect(container.querySelector(".cc-rule__tail")).not.toBeNull();
    expect(container.querySelector(".cc-rule__act .cc-chip")).toBeNull();
    expect(unexpectedMissing(container)).toEqual([]);
  });

  it("allowsClear=false인 점검은 본문에 '이 점검은 이상 없음을 주지 않습니다' 칩, true면 없다", () => {
    const r = rule(REPORT_D, "AWS-KEY-4");
    const entry = MOCK_CATALOG_BY_ID.get(r.ruleId)!;
    const noClear = render(
      <ul>
        <RuleRow rule={r} entry={{ ...entry, allowsClear: false }} open onToggle={vi.fn()} table={table(r)} />
      </ul>,
    );
    expect(noClear.container.querySelector(".cc-rule__body")?.textContent).toContain("이상 없음'을 주지 않습니다");
    noClear.unmount();
    const yes = render(
      <ul>
        <RuleRow rule={r} entry={{ ...entry, allowsClear: true }} open onToggle={vi.fn()} table={table(r)} />
      </ul>,
    );
    expect(yes.container.querySelector(".cc-rule__body")?.textContent).not.toContain("이상 없음'을 주지 않습니다");
  });

  it("라벨(LabelChip): 점검 라벨은 요약줄에 칩으로 — 상태 배지는 그대로", () => {
    const base = rule(REPORT_B, "AWS-STO-2");
    const labeled: RuleResult = { ...base, labels: [{ kind: "legacy-hint", basis: "created-before-2023-04" }] };
    const { container } = row(labeled);
    expect(container.querySelector(".cc-rule__act .cc-chip--hint")?.textContent).toContain("2023-04 이전에 만든 버킷");
    expect(container.querySelector(".cc-sb")?.textContent).toBe("주의");
  });
});

// STEP 5 QA CC-QA-06(G7, 프론트팀장): 범위가 증명되지 않은 위험·주의 행의 꼬리표는 '계정 전체'·'… 전부'를 말하지 않는다
describe("RuleRow 꼬리표 — 범위 미증명(CC-QA-06)", () => {
  const OVERCLAIM = /계정 전체|전부/;
  const base = rule(REPORT_C, "AWS-MFA-2");
  const withCoverage = (coverage: RuleResult["coverage"], asOf: RuleResult["asOf"] = base.asOf): RuleResult => ({ ...base, coverage, asOf } as RuleResult);
  const tail = (r: RuleResult): string => row(r).container.querySelector(".cc-rule__tail")?.textContent ?? "";

  it("전제: 목업 C의 위험 행은 범위가 증명돼 '확인한 범위: 계정 전체'", () => {
    expect(base.status).toBe("risk");
    expect(base.coverage.proven).toBe(true);
    expect(tail(base)).toContain("확인한 범위: 계정 전체");
  });
  it("계정 단위 + 미증명 → '일부만(전체를 확인하지 못함)', 기준 시각은 그대로", () => {
    const text = tail(withCoverage({ kind: "account-global", covered: 0, total: 1, proven: false, population: null }));
    expect(text).toContain("확인한 범위: 일부만(전체를 확인하지 못함)");
    expect(text).toContain("기준 시각");
    expect(text).not.toMatch(OVERCLAIM);
  });
  it("리전 수가 다 찼어도 미증명이면 '전부'라고 하지 않고, 모자라면 'n개(활성 m개 중)'로 일부임을 말한다", () => {
    expect(tail(withCoverage({ kind: "regions", covered: 3, total: 3, proven: false, population: null }))).toContain("일부만(전체를 확인하지 못함)");
    const part = tail(withCoverage({ kind: "regions", covered: 2, total: 3, proven: false, population: null }));
    expect(part).toContain("리전 2개(활성 3개 중)");
    expect(part).not.toMatch(OVERCLAIM);
    expect(tail(withCoverage({ kind: "subscriptions", covered: 4, total: 4, proven: false, population: null }))).not.toMatch(OVERCLAIM);
    expect(tail(withCoverage({ kind: "regions", covered: 3, total: 3, proven: true, population: 5 }))).toContain("리전 3개 전부");
  });
  it("기준 시각이 없어도 미증명이면 범위 꼬리표를 그린다(증명된 행은 전처럼 꼬리표 없음)", () => {
    expect(tail(withCoverage({ kind: "account-global", covered: 0, total: 1, proven: false, population: null }, null))).toBe("확인한 범위: 일부만(전체를 확인하지 못함)");
    expect(row(withCoverage(base.coverage, null)).container.querySelector(".cc-rule__tail")).toBeNull();
  });
});
