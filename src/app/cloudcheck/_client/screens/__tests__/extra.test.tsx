// @vitest-environment jsdom
// src/app/cloudcheck/_client/screens/__tests__/extra.test.tsx — 체험 안내 패널(P1) · Azure 개방(beta) 변형 · 본인 응답(INV-8) · 상수 일치(G-D25) · 오류 안전망 · 프레임 대기.
import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { EXCEPTION_MAX_DAYS } from "../../../../../lib/cloudcheck/contract/exceptions-schema";
import { LIMITS } from "../../../../../lib/cloudcheck/contract/collect-schema";
import type { Report } from "../../../../../lib/cloudcheck/model/report";
import { DOM_ID } from "../../components/dom-ids";
import { EXCEPTION_DEFAULT_DAYS } from "../../components/ExceptionForm";
import { MANUAL_GROUP_MIN as COMPONENT_MANUAL_GROUP_MIN } from "../../components/ManualCheckList";
import { TABLE_PAGE_SIZE } from "../../components/TargetTable";
import { EXC_DEFAULT_DAYS, MAX_FILES, MANUAL_GROUP_MIN, TABLE_PAGE } from "../../config";
import { t } from "../../i18n/index";
import { MOCK_REPORTS, REPORT_AZURE_A } from "../../mocks/reports";
import { createMockDeps } from "../../state/deps.mock";
import { nextFrames } from "../../state/pipeline";
import { guideTarget } from "../DemoGuide";
import { ErrorBoundary } from "../ErrorBoundary";
import { h1, installDemoBlocks, mainEl, missingKeys, mount, openDemoReport, openRealReport, removeDemoBlocks, visibleText } from "./harness";

const real = (r: Report): Report => ({ ...r, mode: { kind: "real" } });

beforeEach(() => {
  window.history.replaceState(null, "");
  document.documentElement.className = "";
  Object.defineProperty(window, "scrollY", { value: 0, configurable: true });
  window.print = vi.fn();
});
afterEach(() => {
  cleanup();
  removeDemoBlocks();
  vi.restoreAllMocks();
});

describe("체험 안내 패널 ⟨P1⟩", () => {
  const sets = [["C", "아슬아슬상회", "먼저 볼 3개가 왜 이 순서인지 읽어 보세요."], ["D", "반쯤본상회", "분포에서 확인 불가 칩과 '아직 판단하지 못한 점검' 줄을 읽어 보세요."], ["A", "반듯상회", "이상 없음 행의 '확인한 범위 · 기준 시각'과 '못 본 것' 칩을 읽어 보세요."], ["B", "멈춘시계상회", "주의 행마다 붙은 '확인할 질문'을 읽어 보세요."]] as const;
  for (const [set, company, firstLine] of sets) {
    it(`${company}: 기본 펼침, 세 줄, 줄마다 [그곳으로 이동], 인쇄에는 없다`, async () => {
      const h = mount();
      await openDemoReport(h, company);
      const panel = screen.getByRole("region", { name: "이 회사에서 살펴볼 곳" });
      expect(panel.className).toContain("cc-noprint");
      expect(within(panel).getByRole("button", { name: "이 회사에서 살펴볼 곳" })).toHaveAttribute("aria-expanded", "true");
      const items = panel.querySelectorAll("ol > li");
      expect(items.length).toBe(3);
      expect(items[0]?.textContent).toContain(firstLine);
      const gos = within(panel).getAllByRole("button", { name: /그곳으로 이동/ });
      expect(gos.length).toBe(3);
      // 접근 이름에 줄 글자가 들어 있다(같은 이름 세 개가 되지 않게)
      expect(new Set(gos.map((b) => b.getAttribute("aria-labelledby"))).size).toBe(3);
      expect(missingKeys(visibleText())).toEqual([]);
      void set;
    });
    it(`${company}: 세 버튼 모두 존재하는 요소로 포커스를 옮기고 해시는 그대로다`, async () => {
      const h = mount();
      await openDemoReport(h, company);
      const panel = screen.getByRole("region", { name: "이 회사에서 살펴볼 곳" });
      for (const b of within(panel).getAllByRole("button", { name: /그곳으로 이동/ })) {
        document.body.focus();
        await h.user.click(b);
        const active = document.activeElement as HTMLElement;
        expect(active).not.toBe(document.body);
        expect(active).not.toBe(b);
        expect(active.id).not.toBe("");
        expect(window.location.hash).toBe("");
      }
    });
  }
  it("C 둘째 줄은 첫 위험 점검 행을 펼치고 그 토글에 포커스", async () => {
    const h = mount();
    await openDemoReport(h);
    const panel = screen.getByRole("region", { name: "이 회사에서 살펴볼 곳" });
    await h.user.click(within(panel).getAllByRole("button", { name: /그곳으로 이동/ })[1] as HTMLElement);
    const active = document.activeElement as HTMLElement;
    expect(active.className).toContain("cc-tog");
    expect(active).toHaveAttribute("aria-expanded", "true");
  });
  it("접으면 제목 한 줄만 남는다(aria-expanded=false). 실제 리포트에는 패널이 없다", async () => {
    const h = mount();
    await openDemoReport(h);
    const toggle = screen.getByRole("button", { name: "이 회사에서 살펴볼 곳" });
    await h.user.click(toggle);
    expect(toggle).toHaveAttribute("aria-expanded", "false");
    cleanup();
    const h2 = mount();
    await openRealReport(h2);
    expect(screen.queryByRole("region", { name: "이 회사에서 살펴볼 곳" })).toBeNull();
  });
  it("guideTarget: 세트가 가르치는 상태가 데이터에 없어도 제목 구역으로 돌아가 깨지지 않는다", () => {
    const none = { ...MOCK_REPORTS.A, doors: MOCK_REPORTS.A.doors.map((d) => ({ ...d, rules: [] })) };
    for (const set of ["A", "B", "C", "D"] as const) for (const line of [1, 2, 3] as const) expect(guideTarget(set, line, { ...none, mode: { kind: "demo", setId: set } }).id).not.toBe("");
    expect(guideTarget("C", 3, MOCK_REPORTS.C).id).toBe(DOM_ID.firstFix(MOCK_REPORTS.C.firstLook.mode === "findings" ? (MOCK_REPORTS.C.firstLook.ruleIds[0] as never) : ("AWS-MFA-1" as never)));
  });
});

describe("Azure 개방(beta) 변형", () => {
  const beta = { aws: "beta", azure: "beta" } as const;
  it("V0 Azure 버튼은 일반 이동 버튼(펼침 아님)이고 V1은 Azure로 연다. [바꾸기]로 AWS와 오간다", async () => {
    const h = mount({ availability: beta });
    const azure = screen.getByRole("button", { name: "Azure 점검 시작" });
    expect(azure).not.toHaveAttribute("aria-expanded");
    await h.user.click(azure);
    expect(h1().textContent).toBe("수집 준비");
    expect(screen.getByText("Azure", { selector: "strong" })).toBeInTheDocument();
    expect(screen.getAllByRole("status")[0]?.textContent).toBe("수집 준비 화면입니다. Azure.");
    await h.user.click(screen.getByRole("button", { name: "바꾸기" }));
    expect(screen.getByText("AWS", { selector: "strong" })).toBeInTheDocument();
  });
  it("V1 Azure 방법 ①: 쿼리 두 개(읽기 전용, 복사 버튼 없음) · 방법 ②: 호출 9종", async () => {
    const h = mount({ availability: beta });
    await h.user.click(screen.getByRole("button", { name: "Azure 점검 시작" }));
    await h.user.click(screen.getByRole("radio", { name: "파일 하나만 내려받기" }));
    const kql = mainEl().querySelectorAll(".cc-cmd--kql");
    expect(kql.length).toBe(2);
    expect(mainEl().textContent).toContain("cc-rg-storage/1");
    expect(mainEl().textContent).toContain("cc-rg-nsg/1");
    expect(screen.getAllByText(/권한이 없는 리소스는 표시 없이 빠질 수 있어/).length).toBeGreaterThanOrEqual(2);
    expect(Array.from(mainEl().querySelectorAll("button")).filter((b) => /복사/.test(b.textContent ?? "")).length).toBe(0);
    await h.user.click(screen.getByRole("radio", { name: "수집기로 한 번에 읽기" }));
    expect(mainEl().querySelectorAll(".cc-fp tbody tr").length).toBe(9);
    expect(mainEl().querySelectorAll(".cc-cmd--write").length).toBe(0);
  });
  it("V2에서 Azure 자리 안내, V6에는 Azure 준비 중 안내가 없다", async () => {
    const h = mount({ availability: beta });
    await h.user.click(screen.getByRole("button", { name: "Azure 점검 시작" }));
    await h.user.click(screen.getAllByRole("button", { name: "결과 파일 넣기 →" })[0] as HTMLElement);
    expect(screen.getByText(/필요한 파일: 스토리지 쿼리 결과\(CSV\) · NSG 쿼리 결과\(CSV\)/)).toBeInTheDocument();
    cleanup();
    const h2 = mount({ availability: beta });
    await h2.user.click(screen.getByRole("button", { name: "체험 모드로 먼저 보기" }));
    await h2.user.click(screen.getByRole("radio", { name: "Azure" }));
    expect(screen.queryByText(/Azure 실제 점검은 준비 중입니다/)).toBeNull();
  });
  it("베타 띠는 AWS가 open이 되면 사라진다", () => {
    mount({ availability: { aws: "open", azure: "soon" } });
    expect(document.querySelector("aside.cc-band")).toBeNull();
  });
});

describe("본인 응답은 상태를 바꾸지 않는다(INV-8)", () => {
  it("Azure 현관 가이드 카드: 고른 뒤 라벨이 붙고 확인 불가·분포·먼저 풀 것은 그대로", async () => {
    const azure = real(REPORT_AZURE_A);
    // 실제(체험이 아닌) Azure 리포트를 그리는 시험 — 운영 기본값은 Azure '준비 중'이라 V2가 막는다(STEP 5 결정 §8-A) → 공개 상태를 주입해 연다
    const h = mount({ deps: createMockDeps({ judge: () => azure }), availability: { aws: "beta", azure: "beta" } });
    await openRealReport(h);
    const distBefore = Array.from(document.querySelectorAll(".cc-report .cc-dist .cc-dc")).map((x) => x.textContent);
    const toggle = document.getElementById(DOM_ID.ruleToggle("AZ-MFA-G")) as HTMLElement;
    await h.user.click(toggle);
    const row = document.getElementById(DOM_ID.rule("AZ-MFA-G")) as HTMLElement;
    const badgeBefore = row.querySelector(".cc-sb")?.textContent;
    const yes = within(row).getAllByRole("radio", { name: "예" })[0] as HTMLElement;
    await h.user.click(yes);
    expect(yes).toBeChecked();
    expect(row.textContent).toContain("본인 응답: 예(검증 안 됨) · 상태는 확인 불가 유지");
    expect(row.querySelector(".cc-sb")?.textContent).toBe(badgeBefore);
    expect(Array.from(document.querySelectorAll(".cc-report .cc-dist .cc-dc")).map((x) => x.textContent)).toEqual(distBefore);
    expect(document.querySelector(".cc-first")?.textContent).toContain("안내를 따라 직접 확인해야 하는 점검");
  });
});

describe("상수와 카피 숫자 일치(G-D25)", () => {
  it("page 상수 = 컴포넌트 상수 = 계약 상수", () => {
    expect(TABLE_PAGE).toBe(TABLE_PAGE_SIZE);
    expect(MANUAL_GROUP_MIN).toBe(COMPONENT_MANUAL_GROUP_MIN);
    expect(EXC_DEFAULT_DAYS).toBe(EXCEPTION_DEFAULT_DAYS);
    expect(EXC_DEFAULT_DAYS).toBeLessThanOrEqual(EXCEPTION_MAX_DAYS);
    expect(EXCEPTION_MAX_DAYS).toBe(90);
    expect(LIMITS.jsonBytes / 1024 / 1024).toBe(25);
    expect(LIMITS.csvBytes / 1024 / 1024).toBe(20);
    expect(MAX_FILES).toBe(8);
  });
  it("한 번에 읽는 파일 수 안내는 상수로 채운다(카피에 숫자를 쓰지 않는다)", () => {
    expect(t("cc.input.too-many", { max: MAX_FILES })).toBe("한 번에 8개까지 읽습니다. 나머지는 읽지 않았습니다.");
  });
});

describe("프레임 대기 · 오류 안전망", () => {
  it("requestAnimationFrame이 멈춰도(백그라운드 탭) 타이머가 이어 준다", async () => {
    const raf = vi.spyOn(window, "requestAnimationFrame").mockImplementation(() => 0);
    const started = Date.now();
    await nextFrames(2);
    expect(raf).toHaveBeenCalled();
    expect(Date.now() - started).toBeLessThan(1500);
  });
  it("화면이 렌더 중 던지면 onFatal을 부르고 아무것도 그리지 않는다(빈 화면 대신 main.tsx가 정적 셸을 되살린다)", () => {
    const onFatal = vi.fn();
    const Bomb = (): never => {
      throw new Error("boom");
    };
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    const { container } = render(
      <ErrorBoundary onFatal={onFatal}>
        <Bomb />
      </ErrorBoundary>,
    );
    expect(onFatal).toHaveBeenCalledTimes(1);
    expect(container.textContent).toBe("");
  });
});

describe("컨트롤러", () => {
  it("언마운트하면 창 수준 리스너(beforeunload)를 모두 걷는다", async () => {
    const h = mount();
    await openRealReport(h);
    const e = new Event("beforeunload", { cancelable: true });
    window.dispatchEvent(e);
    expect(e.defaultPrevented).toBe(true);
    h.unmount();
    const e2 = new Event("beforeunload", { cancelable: true });
    window.dispatchEvent(e2);
    expect(e2.defaultPrevented).toBe(false);
  });
  it("화면 전환마다 document.title이 바뀌고 사용자 데이터는 들어가지 않는다", async () => {
    const h = mount();
    const titles: string[] = [document.title];
    await openRealReport(h);
    titles.push(document.title);
    await h.user.click(screen.getByRole("button", { name: "이 도구에 대해" }));
    titles.push(document.title);
    expect(titles).toEqual(["문단속 5", "리포트 · 문단속 5", "이 도구에 대해 · 문단속 5"]);
    expect(titles.join(" ")).not.toMatch(/halfseen|cloudcheck-demo|result\.json|3333/);
  });
  it("체험 데이터를 만든 뒤 데이터 블록 글자를 상태에 남기지 않는다(리포트 글자만)", async () => {
    installDemoBlocks();
    const h = mount();
    await openDemoReport(h);
    expect(visibleText()).not.toContain("{}");
  });
});
