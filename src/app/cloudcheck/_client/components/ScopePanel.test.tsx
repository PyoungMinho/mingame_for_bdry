// @vitest-environment jsdom
// ScopePanel — 조회 범위 패널(접을 수 없음, R-03): 신원·범위·수집·권한·문별 수집 + 못 보는 것 7가지. 전체 계정 ID는 그리지 않는다.
import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { PermissionHint, Report } from "../../../../lib/cloudcheck/model/report";
import { MOCK_REPORTS, REPORT_AZURE_A, REPORT_HOSTILE, REPORT_REAL_D } from "../mocks/reports";
import { ScopePanel } from "./ScopePanel";
import { attrValues, classTokens, unexpectedMissing } from "./__tests__/render";

const ALL: readonly [string, Report][] = [
  ["C", MOCK_REPORTS.C],
  ["D", MOCK_REPORTS.D],
  ["A", MOCK_REPORTS.A],
  ["B", MOCK_REPORTS.B],
  ["Azure A", REPORT_AZURE_A],
  ["실제 D", REPORT_REAL_D],
  ["적대", REPORT_HOSTILE],
];

describe("ScopePanel — 모든 목업", () => {
  for (const [name, report] of ALL) {
    it(`${name}: 제목·고정 안내·행 5개·못 보는 것 7개·문별 수집 5개, 접힘 래퍼 없음, 카탈로그 키 누락 0`, () => {
      const { container } = render(<ScopePanel report={report} onShowManual={vi.fn()} />);
      const section = container.querySelector("section.cc-scope") as HTMLElement;
      expect(within(section).getByRole("heading", { level: 2 }).textContent).toBe("조회 범위");
      expect(section.textContent).toContain("이 영역은 접을 수 없습니다.");
      expect(section.querySelectorAll("dl.cc-scope__dl > div > dt").length).toBe(5);
      expect(Array.from(section.querySelectorAll("dl.cc-scope__dl > div > dt")).map((e) => e.textContent)).toEqual(["신원", "범위", "수집", "권한", "문별 수집"]);
      expect(section.querySelectorAll("ul.cc-scope__cannot > li")).toHaveLength(7);
      expect(section.querySelectorAll(".cc-dcr > li")).toHaveLength(5);
      // R-03: 패널 자체를 접는 버튼이 없다(패널 전체가 .cc-fold 안에 있지 않다)
      expect(section.closest(".cc-fold")).toBeNull();
      expect(section.querySelector("h2")?.closest("button")).toBeNull();
      expect(unexpectedMissing(container)).toEqual([]);
      expect(classTokens(container).filter((c) => !c.startsWith("cc-"))).toEqual([]);
      expect(container.querySelector("details")).toBeNull(); // G-D7
    });
  }

  it("전체 계정 ID(identity.account)는 어디에도 그리지 않는다", () => {
    for (const [, report] of ALL) {
      const { container, unmount } = render(<ScopePanel report={report} onShowManual={vi.fn()} />);
      expect(container.textContent).not.toContain("111122223333");
      expect(container.textContent).not.toContain("00000000-0000-0000-0000-000000000000");
      unmount();
    }
  });

  it("적대 값(<img onerror>·</script>·U+202E 치환·긴 이름): img·script 요소 0, 속성에 값 0(G-D8)", () => {
    const { container } = render(<ScopePanel report={REPORT_HOSTILE} onShowManual={vi.fn()} />);
    expect(container.querySelector("img, script, iframe")).toBeNull();
    const principal = REPORT_HOSTILE.identity.principalName;
    if (principal !== null && principal.kind === "sensitive") {
      expect(container.textContent).toContain(principal.full);
      expect(attrValues(container).some((v) => v.length >= 3 && v.includes(principal.full))).toBe(false);
    }
    expect(container.innerHTML).not.toContain("<b>alias</b>");
    expect(container.textContent).toContain("<b>alias</b>"); // 글자로만
  });
});

describe("ScopePanel — 행", () => {
  it("신원: 별칭 ••••끝4자리 · 클라우드 · 실행 주체(역할) · 신원 출처 · 수집 때 계정 확인 방식", () => {
    const { container } = render(<ScopePanel report={REPORT_REAL_D} onShowManual={vi.fn()} />);
    const identity = container.querySelector("dl.cc-scope__dl > div:nth-child(1) dd") as HTMLElement;
    expect(identity.textContent).toContain("halfseen-prod");
    expect(identity.textContent).toContain("••••3333");
    expect(identity.textContent).toContain("AWS");
    expect(identity.textContent).toContain("실행 주체: IAM 사용자");
    expect(identity.textContent).toContain("수집기가 확인한 신원");
    expect(identity.textContent).toContain("수집할 때 계정 확인을 건너뜀(--yes)");
  });

  it("Azure: 현재 구독 + 구독 단위 범위 + 구독별 조회 상태(접힘, 인쇄 펼침)", () => {
    const { container } = render(<ScopePanel report={REPORT_AZURE_A} onShowManual={vi.fn()} />);
    const text = container.textContent ?? "";
    expect(text).toContain("현재 구독:");
    expect(text).toContain("구독: 조회 2개 · 보이는 2개");
    const btn = screen.getByRole("button", { name: "구독별 조회 상태" });
    expect(btn.getAttribute("aria-expanded")).toBe("false");
    const region = document.getElementById(btn.getAttribute("aria-controls") ?? "") as HTMLElement;
    expect(region.classList.contains("cc-po")).toBe(true);
    expect(region.textContent).toContain("tidy-main");
    expect(region.textContent).toContain("조회함");
  });

  it("범위: 빠진 리전(이름 + 짧은 사유)과 '끝까지 확인되지 않았습니다'(proven=false)", () => {
    const { container } = render(<ScopePanel report={REPORT_REAL_D} onShowManual={vi.fn()} />);
    const range = container.querySelector("dl.cc-scope__dl > div:nth-child(2) dd") as HTMLElement;
    expect(range.textContent).toContain("리전: 확인 15개 · 활성 17개");
    expect(range.textContent).toContain("ap-east-1");
    expect(range.textContent).toContain("me-south-1");
    expect(range.textContent).toContain("조회 범위가 끝까지 확인되지 않았습니다.");
  });

  it("수집: 한 줄 합계(성공=ok+empty+notconfigured, 오류=error+unsupported+throttled) + 호출 기록 자세히(접힘·인쇄 숨김) + 자격증명 보고서 생성 시각", () => {
    const { container } = render(<ScopePanel report={REPORT_REAL_D} onShowManual={vi.fn()} />);
    const collect = container.querySelector("dl.cc-scope__dl > div:nth-child(3) dd") as HTMLElement;
    expect(collect.textContent).toContain("수집: 2026-10-19 12:12 KST (03:12 UTC) · 수집기 1.0.0 · 호출 성공 119 · 거부 14 · 오류 2 · 잘림 1");
    expect(collect.textContent).toContain("자격증명 보고서 생성: 2026-10-19 12:10 KST (03:10 UTC) (보고서 안의 값)");
    const detail = within(collect).getByRole("button", { name: "호출 기록 자세히" });
    expect(detail.classList.contains("cc-noprint")).toBe(true);
    const region = document.getElementById(detail.getAttribute("aria-controls") ?? "") as HTMLElement;
    expect(region.classList.contains("cc-noprint")).toBe(true);
    expect(region.textContent).toContain("전체 136"); // 호출 기록 8종 합계 줄
    expect(region.textContent).toContain("읽은 입력");
    expect(region.textContent).toContain("알려진 릴리스 목록에 없음"); // knownRelease:false
    expect(region.textContent).toContain("더 새로운 형식(아는 값만 사용)");
    fireEvent.click(detail);
    expect(region.classList.contains("cc-open")).toBe(true);
  });

  it("CSV 입력만이면 '호출 기록 없음(CSV 입력)' + 기준 시각, 체험이면 '체험 데이터의 기준 시각은 고정'", () => {
    const csvOnly: Report = {
      ...REPORT_REAL_D,
      collection: { ...REPORT_REAL_D.collection, asOfRange: null, credentialReport: null, inputs: REPORT_REAL_D.collection.inputs.filter((i) => i.collector === null) },
    };
    const a = render(<ScopePanel report={csvOnly} onShowManual={vi.fn()} />);
    expect(a.container.textContent).toContain("호출 기록 없음(CSV 입력)");
    expect(a.container.textContent).not.toContain("수집기 1.0.0");
    a.unmount();
    const b = render(<ScopePanel report={MOCK_REPORTS.C} onShowManual={vi.fn()} />);
    expect(b.container.textContent).toContain("체험 데이터의 기준 시각은 고정되어 있습니다.");
    b.unmount();
    const c = render(<ScopePanel report={REPORT_REAL_D} onShowManual={vi.fn()} />);
    expect(c.container.textContent).not.toContain("체험 데이터의 기준 시각은 고정");
  });

  it("권한: 해제 힌트는 확인 불가 톤(도형·'확인 불가' 글자 없음), 거부 호출은 상위 3개 + 나머지 접힘(버튼은 인쇄 숨김, 영역은 인쇄 펼침)", () => {
    const { container } = render(<ScopePanel report={REPORT_REAL_D} onShowManual={vi.fn()} />);
    const perm = container.querySelector("dl.cc-scope__dl > div:nth-child(4) dd") as HTMLElement;
    const tones = perm.querySelectorAll(".cc-untone");
    expect(tones).toHaveLength(3);
    for (const t of Array.from(tones)) {
      expect(t.querySelector("svg")).toBeNull();
      expect(t.querySelector(".cc-sb")).toBeNull(); // 상태 배지(도형 + '확인 불가' 글자)가 아니라 문장이다
    }
    expect(tones[0]?.textContent).toContain("iam:ListAccessKeys 권한이 있으면 확인 불가 점검 2개(대상 12개)를 풀 수 있습니다.");
    expect(perm.textContent).toContain("거부된 호출 4개");
    const lists = perm.querySelectorAll("ul.cc-small");
    expect(lists[0]?.querySelectorAll("li")).toHaveLength(3);
    const more = within(perm).getByRole("button", { name: "나머지 1개 펼치기" });
    expect(more.classList.contains("cc-noprint")).toBe(true);
    const region = document.getElementById(more.getAttribute("aria-controls") ?? "") as HTMLElement;
    expect(region.classList.contains("cc-po")).toBe(true);
    expect(region.querySelectorAll("li")).toHaveLength(1);
    // 권한 이름이 호출과 다르면 '필요한 권한'을 덧붙이고, 같으면 덧붙이지 않는다
    expect(perm.textContent).not.toContain("필요한 권한:");
  });

  it("권한 힌트가 4개 이상이면 상위 3개 + '권한 해제 힌트 n개 더 보기' 접힘, 거부 호출이 없으면 한 줄", () => {
    const hints: PermissionHint[] = Array.from({ length: 5 }, (_, i) => ({ permission: `x:Perm${i}`, unlocks: [{ ruleId: "AWS-KEY-1", items: 1 }], total: 1 }));
    const report: Report = { ...REPORT_REAL_D, permissions: { denied: [], unlockHints: hints } };
    const { container } = render(<ScopePanel report={report} onShowManual={vi.fn()} />);
    const perm = container.querySelector("dl.cc-scope__dl > div:nth-child(4) dd") as HTMLElement;
    const visible = Array.from(perm.querySelectorAll(".cc-untone")).filter((e) => !e.closest(".cc-fold"));
    expect(visible).toHaveLength(3);
    const more = within(perm).getByRole("button", { name: "권한 해제 힌트 2개 더 보기" });
    expect(document.getElementById(more.getAttribute("aria-controls") ?? "")?.querySelectorAll(".cc-untone")).toHaveLength(2);
    expect(perm.textContent).toContain("거부된 호출이 없습니다.");
  });

  it("못 보는 것 7가지: 콘솔 사용자 0명(AWS-MFA-2 auto-notice)이면 IdP 줄을 굵게 + 설명 + 직접 볼 목록 버튼(onShowManual)", () => {
    const onShowManual = vi.fn();
    const { container } = render(<ScopePanel report={MOCK_REPORTS.A} onShowManual={onShowManual} />);
    const li = Array.from(container.querySelectorAll("ul.cc-scope__cannot > li")).find((e) => e.querySelector("strong")) as HTMLElement;
    fireEvent.click(within(li).getByRole("button", { name: "직접 볼 목록에서 보기" }));
    expect(onShowManual).toHaveBeenCalledTimes(1);
    expect(container.querySelectorAll("ul.cc-scope__cannot strong")).toHaveLength(1);
    const plain = render(<ScopePanel report={MOCK_REPORTS.C} onShowManual={vi.fn()} />);
    expect(plain.container.querySelectorAll("ul.cc-scope__cannot strong")).toHaveLength(0);
  });

  it("'못 막는 경로 4가지 →'는 onShowPaths가 있을 때만(앱 안 이동 버튼, href 없음)", () => {
    const onShowPaths = vi.fn();
    const { container, rerender } = render(<ScopePanel report={MOCK_REPORTS.C} onShowManual={vi.fn()} />);
    expect(screen.queryByRole("button", { name: "못 막는 경로 4가지 →" })).toBeNull();
    rerender(<ScopePanel report={MOCK_REPORTS.C} onShowManual={vi.fn()} onShowPaths={onShowPaths} />);
    fireEvent.click(screen.getByRole("button", { name: "못 막는 경로 4가지 →" }));
    expect(onShowPaths).toHaveBeenCalledTimes(1);
    expect(container.querySelector("[href]")).toBeNull();
  });
});
