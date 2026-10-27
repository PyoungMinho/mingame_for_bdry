// @vitest-environment jsdom
// EvidenceList — '이 점검이 쓴 호출 기록'(접힘, 인쇄 숨김): receipt.id로 중복 제거, CSV 출처, observed는 그리지 않는다.
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { ItemResult, RuleResult } from "../../../../lib/cloudcheck/model/report";
import { REPORT_C, REPORT_D } from "../mocks/reports";
import { EvidenceList } from "./EvidenceList";
import { unexpectedMissing } from "./__tests__/render";

const rule = (r: typeof REPORT_C, id: string): RuleResult => r.doors.flatMap((d) => d.rules).find((x) => x.ruleId === id) as RuleResult;

describe("EvidenceList", () => {
  it("영수증 id로 중복 제거 — 같은 호출 기록을 여러 대상이 가리켜도 한 줄", () => {
    const r = rule(REPORT_C, "AWS-MFA-2");
    const ids = new Set(r.items.flatMap((i) => i.evidence.flatMap((e) => (e.receipt === null ? [] : [e.receipt.id]))));
    const { container } = render(<EvidenceList items={r.items} />);
    const lines = container.querySelectorAll("ul.cc-ev > li");
    expect(lines).toHaveLength(ids.size);
    expect(screen.getByRole("button").textContent).toBe(`이 점검이 쓴 호출 기록 ${ids.size}건`);
    expect(unexpectedMissing(container)).toEqual([]);
  });

  it("접힘 + 인쇄 숨김(버튼·영역 모두 cc-noprint), 펼치면 줄이 보인다", () => {
    const r = rule(REPORT_C, "AWS-MFA-2");
    const { container } = render(<EvidenceList items={r.items} />);
    const btn = screen.getByRole("button");
    expect(btn.classList.contains("cc-noprint")).toBe(true);
    const region = document.getElementById(btn.getAttribute("aria-controls") ?? "") as HTMLElement;
    expect(region.classList.contains("cc-noprint")).toBe(true);
    expect(region.classList.contains("cc-open")).toBe(false);
    fireEvent.click(btn);
    expect(region.classList.contains("cc-open")).toBe(true);
    expect(container.querySelector("details")).toBeNull();
  });

  it("줄: 호출 기록 id · 호출 · 범위 · 결과 이름 · UTC 시각 — 개수와 오류 코드가 있으면 덧붙는다", () => {
    const r = rule(REPORT_D, "AWS-KEY-1"); // 거부된 호출(오류 코드 AccessDenied)
    const { container } = render(<EvidenceList items={r.items} />);
    const first = container.querySelector("ul.cc-ev > li") as HTMLElement;
    expect(first.querySelector("code")?.textContent).toMatch(/^0:r-/);
    expect(first.textContent).toContain("iam:ListAccessKeys");
    expect(first.textContent).toContain("거부");
    expect(first.textContent).toContain("AccessDenied");
    expect(first.textContent).toMatch(/\d{4}-\d{2}-\d{2} \d{2}:\d{2} UTC/);
    expect(first.textContent).not.toContain("KST"); // 호출 기록 시각은 UTC
  });

  it("CSV 출처 줄: 종류 · '열' · 몇 번째 줄 (영수증 줄과 함께)", () => {
    const base = rule(REPORT_C, "AWS-MFA-1").items[0] as ItemResult;
    const items: ItemResult[] = [base];
    const withCsv = { ...base, evidence: [...base.evidence, { receipt: null, csv: { kind: "csv-credential-report" as const, column: "mfa_active", row: 3 }, observed: [] }] } as ItemResult;
    const { container } = render(<EvidenceList items={[withCsv, ...items]} />);
    expect(container.textContent).toContain("AWS 자격증명 보고서(CSV) · 'mfa_active' 열 · 3번째 줄");
  });

  it("호출 기록이 없으면 아무것도 그리지 않는다", () => {
    const { container } = render(<EvidenceList items={[]} />);
    expect(container.innerHTML).toBe("");
  });
});
