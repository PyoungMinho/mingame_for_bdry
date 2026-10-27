// @vitest-environment jsdom
// src/app/cloudcheck/_client/screens/__tests__/report.test.tsx — V3 리포트 · V4 고치는 법 · V5 재점검 비교 · 리포트 유실 방지 장치.
// 목업 Report(체험 A~D · 실제 모드 파생 · 적대 값)를 같은 파이프라인(recognize → buildInput → judge)으로 열어 렌더를 검사한다.
// 목업의 엔진 코드는 화면 개발용 가짜라 실제 E 카탈로그에 없는 것이 있다(⟦cc.reason…⟧로 보일 수 있음) → 점검 행은 DOM id(DOM_ID)로 찾고,
// ⟦⟧ 검사는 C·S 키만 본다(harness.missingKeys). E 키는 실제 엔진 시험(real-engine · demo-real)이 본다(D4 통합).
import { act, cleanup, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Report, RuleId } from "../../../../../lib/cloudcheck/model/report";
import { STATUS_ORDER } from "../../../../../lib/cloudcheck/model/report";
import { DOM_ID } from "../../components/dom-ids";
import { MOCK_COMPARISON_OK } from "../../mocks/extras";
import { MOCK_REPORTS, REPORT_C, REPORT_HOSTILE, REPORT_REAL_D } from "../../mocks/reports";
import { lookup } from "../../i18n/index";
import { createMockDeps } from "../../state/deps.mock";
import { unloadGuardActive } from "../../state/unload";
import { attributeLeaks, bannedHits, h1, installDemoBlocks, jsonFile, mainEl, missingKeys, mount, openDemoReport, openRealReport, removeDemoBlocks, sensitiveFulls, uploadFiles, visibleText } from "./harness";

const real = (r: Report): Report => ({ ...r, mode: { kind: "real" }, identity: { ...r.identity, alias: r.identity.alias ?? null } });
const REAL_C = real(REPORT_C);
const reportEl = (): HTMLElement => document.querySelector(".cc-report") as HTMLElement;
/** 카탈로그 문장의 첫 파라미터 앞부분(비어 있으면 키 자체 — 시험이 조용히 통과하지 않게) */
const titlePrefix = (key: string): string => {
  const head = (lookup(key) ?? "").split("{")[0]?.trim() ?? "";
  return head === "" ? `⟦${key}⟧` : head;
};
const textOf = (el: Element | null | undefined): string => (el === null || el === undefined ? "" : (el.textContent ?? ""));

beforeEach(() => {
  window.history.replaceState(null, "");
  document.documentElement.className = "";
  Object.defineProperty(window, "scrollY", { value: 0, configurable: true });
  document.documentElement.scrollTop = 0;
  window.print = vi.fn();
});
afterEach(() => {
  cleanup();
  removeDemoBlocks();
  vi.restoreAllMocks();
});

describe("V3 블록 순서 · 구조 규칙", () => {
  it("순서는 고정: 조회 범위 → 점검 결과 분포 → 먼저 볼 3개 → 현관·열쇠·창문·창고·CCTV → 직접 볼 목록 → 이 리포트로 할 수 있는 일", async () => {
    const h = mount({ deps: createMockDeps({ judge: () => REAL_C }) });
    await openRealReport(h);
    const heads = Array.from(reportEl().querySelectorAll("h2")).map((x) => x.textContent ?? "");
    const idx = (s: string): number => heads.findIndex((x) => x.includes(s));
    const seq = ["조회 범위", "점검 결과 분포", "먼저 볼", "현관", "열쇠", "창문", "창고", "CCTV", "직접 볼 목록", "이 리포트로 할 수 있는 일"].map(idx);
    expect(seq.every((i) => i >= 0)).toBe(true);
    expect([...seq].sort((a, b) => a - b)).toEqual(seq);
  });
  it("문 구역 머리에 종합 배지가 없다(G-D12) · 분포 칩 5개는 점검 단위 · <details> 0(G-D7) · 쓰기 명령 0(G-D13)", async () => {
    const h = mount({ deps: createMockDeps({ judge: () => REAL_C }) });
    await openRealReport(h);
    expect(reportEl().querySelectorAll(".cc-door__head .cc-sb").length).toBe(0);
    expect(reportEl().querySelectorAll("details").length).toBe(0);
    expect(document.querySelectorAll(".cc-cmd--write").length).toBe(0);
    const chips = Array.from(reportEl().querySelectorAll("#cc-dist-h ~ .cc-dist .cc-dc")).map((li) => li.textContent?.replace(/\s+/g, " ").trim());
    const d = REAL_C.distribution.rules;
    expect(chips).toEqual(STATUS_ORDER.map((s) => `${{ risk: "위험", caution: "주의", unknown: "확인 불가", clear: "이상 없음", na: "해당 없음" }[s]} ${d[s]}`));
  });
  it("상태 도형은 항상 상태 글자와 함께(G-D3)", async () => {
    const h = mount({ deps: createMockDeps({ judge: () => REAL_C }) });
    await openRealReport(h);
    const words = ["위험", "주의", "확인 불가", "이상 없음", "해당 없음"];
    const icons = Array.from(document.querySelectorAll(".cc-si"));
    expect(icons.length).toBeGreaterThan(10);
    for (const icon of icons) {
      const host = icon.closest(".cc-sb, .cc-dc, .cc-legend");
      expect(host, "도형은 StatusBadge·DistributionChips·StatusLegend 안에서만").not.toBeNull();
      expect(words.some((w) => textOf(host).includes(w))).toBe(true);
    }
  });
  it("점검 행은 기본 접힘 · 요약줄에 [고치는 법]이 보인다", async () => {
    const h = mount({ deps: createMockDeps({ judge: () => REAL_C }) });
    await openRealReport(h);
    const toggles = Array.from(reportEl().querySelectorAll(".cc-rule__tog"));
    expect(toggles.length).toBeGreaterThan(5);
    expect(toggles.every((b) => b.getAttribute("aria-expanded") === "false")).toBe(true);
    expect(document.getElementById(DOM_ID.ruleFix("AWS-NET-1"))).not.toBeNull();
  });
  it("이상 없음 행은 꼬리표(확인한 범위·기준 시각)와 '못 본 것 n' 칩 없이 나타나지 않고, 해당 없음 행에는 근거 줄이 있다(G-D11)", async () => {
    const h = mount({ deps: createMockDeps({ judge: () => real(MOCK_REPORTS.A) }) });
    await openRealReport(h);
    const clearRows = Array.from(reportEl().querySelectorAll(".cc-rule.cc-st--clear"));
    expect(clearRows.length).toBeGreaterThanOrEqual(4);
    for (const row of clearRows) {
      expect(textOf(row)).toContain("확인한 범위");
      expect(textOf(row)).toMatch(/못 본 것 \d+/);
    }
    const naRows = Array.from(reportEl().querySelectorAll(".cc-rule.cc-st--na"));
    expect(naRows.length).toBeGreaterThan(0);
    for (const row of naRows) expect(textOf(row)).toContain("근거");
  });
  it("인쇄 전용 블록: 인쇄 머리 두 벌 · 마지막 바닥 면책 · 화면 면책(G-D19) · 직접 볼 목록의 체크 칸은 CSS로만", async () => {
    const h = mount({ deps: createMockDeps({ judge: () => REAL_C }) });
    await openRealReport(h);
    expect(reportEl().querySelector(".cc-phead--full")?.className).toContain("cc-print-only");
    expect(reportEl().querySelector(".cc-phead--list")?.className).toContain("cc-print-only");
    expect(reportEl().querySelectorAll(".cc-disc").length).toBe(2);
    expect(reportEl().querySelector(".cc-print-only .cc-disc")).not.toBeNull();
    expect(reportEl().querySelectorAll('input[type="checkbox"]').length).toBe(1); // 화면 가리기 하나뿐(직접 볼 목록에 체크 칸 없음)
  });
  it("<main translate=no>, 제목·낭독: '리포트 · 문단속 5', 분포 다섯 상태를 모두 읽는다", async () => {
    const h = mount({ deps: createMockDeps({ judge: () => REAL_C }) });
    await openRealReport(h);
    expect(mainEl()).toHaveAttribute("translate", "no");
    expect(document.title).toBe("리포트 · 문단속 5");
    expect(document.activeElement).toBe(h1());
    const live = screen.getAllByRole("status")[0]?.textContent ?? "";
    for (const w of ["위험", "주의", "확인 불가", "이상 없음", "해당 없음"]) expect(live).toContain(w);
  });
  it("고정 맥락 줄: 별칭·끝 4자리·클라우드·기준 시각·확인 불가 n. 전체 계정 ID는 맥락 줄·신원 줄·제목에 없다(D4)", async () => {
    const h = mount({ deps: createMockDeps({ judge: () => REAL_C }) });
    await openRealReport(h);
    const ctx = document.querySelector(".cc-ctx") as HTMLElement;
    expect(ctx.textContent).toContain("••••3333");
    expect(ctx.textContent).toContain("AWS");
    expect(ctx.textContent).toMatch(/확인 불가 \d+/);
    expect(ctx.textContent).not.toContain("111122223333");
    expect(document.title).not.toContain("111122223333");
    const identityRow = reportEl().querySelector(".cc-scope dl > div") as HTMLElement;
    expect(identityRow.textContent).toContain("••••3333");
    expect(identityRow.textContent).not.toContain("111122223333");
  });
});

describe("V3 글자·누출 검사 (체험 A~D · 실제 · 적대 값)", () => {
  for (const [set, company] of [["C", "아슬아슬상회"], ["D", "반쯤본상회"], ["A", "반듯상회"], ["B", "멈춘시계상회"]] as const) {
    it(`체험 ${company}: ⟦⟧(E 제외) 0 · 금지어 0 · 쓰기 명령 0 · 속성·제목 누출 0`, async () => {
      const h = mount();
      await openDemoReport(h, company);
      const text = visibleText() + " " + (document.querySelector(".cc-ctx")?.textContent ?? "");
      expect(missingKeys(text)).toEqual([]);
      expect(bannedHits(text)).toEqual([]);
      expect(document.querySelectorAll(".cc-cmd--write").length).toBe(0);
      expect(attributeLeaks(sensitiveFulls(MOCK_REPORTS[set]))).toEqual([]);
    });
  }
  it("적대 값(<img onerror>, </script>, 양방향·제어 문자, __proto__ …): 요소가 만들어지지 않고 속성에도 없다", async () => {
    const hostile = real(REPORT_HOSTILE);
    const h = mount({ deps: createMockDeps({ judge: () => hostile }) });
    await openRealReport(h);
    expect(document.querySelectorAll("img, script, iframe, svg[onload]").length).toBe(0);
    expect(Array.from(document.querySelectorAll("*")).some((el) => el.hasAttribute("onerror") || el.hasAttribute("onload"))).toBe(false);
    expect(attributeLeaks(sensitiveFulls(hostile))).toEqual([]);
    expect(reportEl().textContent).toContain("<img src=x onerror=alert(1)>");
    expect(reportEl().querySelectorAll(".cc-mv").length).toBeGreaterThan(5);
    expect(Array.from(reportEl().querySelectorAll(".cc-mv")).every((m) => m.getAttribute("translate") === "no")).toBe(true);
  });
  it("실제 모드(알림 최대 밀도): ⟦⟧(E 제외) 0 · 금지어 0", async () => {
    const h = mount();
    await openRealReport(h);
    expect(missingKeys(visibleText())).toEqual([]);
    expect(bannedHits(visibleText())).toEqual([]);
  });
});

// STEP 6 디자인 검수 F1 회귀 방지: print.css의 '직접 볼 목록만' 규칙은 .cc-report의 직계 자식만 남긴다 → 인쇄 머리 두 벌은 header 안이 아니라 직계여야 한다
describe("인쇄 머리 구조(F1)", () => {
  it("PrintHead(전체·목록) 두 벌은 .cc-report의 직계 자식이고 cc-print-only, header 안에는 인쇄 머리가 없다", async () => {
    const h = mount();
    await openRealReport(h);
    const root = reportEl();
    for (const kind of ["full", "list"]) {
      const head = root.querySelector(`.cc-phead--${kind}`) as HTMLElement;
      expect(head, kind).not.toBeNull();
      expect(head.parentElement, kind).toBe(root);
      expect(head.classList.contains("cc-print-only"), kind).toBe(true);
    }
    expect(root.querySelectorAll(".cc-report__head .cc-print-only")).toHaveLength(0);
    // 화면에서 처음 보이는 블록은 여전히 header(h1)다
    const firstVisible = Array.from(root.children).find((c) => !c.classList.contains("cc-print-only"));
    expect(firstVisible?.classList.contains("cc-report__head")).toBe(true);
    // '직접 볼 목록만' 인쇄에서 남는 직계 자식 = 인쇄 머리 + 직접 볼 목록(+ 인쇄 전용 바닥)
    const kept = Array.from(root.children).filter((c) => c.classList.contains("cc-manual") || c.classList.contains("cc-print-only")).map((c) => c.className);
    expect(kept.some((c) => c.includes("cc-phead--list"))).toBe(true);
    expect(kept.some((c) => c.includes("cc-manual"))).toBe(true);
  });
});

describe("V3 D4 알림 묶음 순서(디자인 §6-4)", () => {
  it("강한 공지(비밀 패턴 → 7일 초과) → 일반 알림 3~11 → 예외 요약, 시간 알림은 표시 단계에서 끼운다", async () => {
    const h = mount({ clock: { now: () => "2026-10-26T05:00:00Z" as never, today: () => "2026-10-26" as never } });
    await openRealReport(h);
    const group = reportEl().querySelector('section[aria-label="알림"]') as HTMLElement;
    expect(group).not.toBeNull();
    const titles = Array.from(group.querySelectorAll(".cc-banner__t")).map((el) => el.textContent ?? "");
    const order = ["secrets-detected", "snapshot-age.very-stale", "areas-not-judged", "schema-newer-minor", "identity-unconfirmed", "collector-unknown-release", "as-of-before-evidence", "doors-skipped", "duplicate-input-ignored"];
    // 제목 문장의 첫 파라미터 앞까지로 찾는다(E 병합 뒤에는 키가 아니라 문장이 보인다. 디자인팀장이 문구를 다듬어도 따라간다)
    const pos = order.map((k) => titles.findIndex((x) => x.includes(titlePrefix(`cc.${k.startsWith("snapshot") ? "time" : "banner"}.${k}.title`))));
    expect(pos.every((p) => p >= 0)).toBe(true);
    expect([...pos].sort((a, b) => a - b)).toEqual(pos);
    // 강한 공지 두 개는 접힘 버튼이 없다(항상 펼침)
    const strong = Array.from(group.querySelectorAll(".cc-banner--strong"));
    expect(strong.length).toBe(2);
    expect(strong.every((s) => s.querySelector("button") === null)).toBe(true);
    // 일반 알림은 제목 버튼 + 접힌 본문
    const info = group.querySelector(".cc-banner--info button.cc-tog") as HTMLElement;
    expect(info).toHaveAttribute("aria-expanded", "false");
  });
  it("체험 모드는 시간 알림이 없다(고정 기준 시각)", async () => {
    const h = mount({ clock: { now: () => "2026-12-30T00:00:00Z" as never, today: () => "2026-12-30" as never } });
    await openDemoReport(h);
    for (const level of ["stale", "very-stale"]) expect(reportEl().textContent).not.toContain(titlePrefix(`cc.time.snapshot-age.${level}.title`));
  });
});

describe("체험 표식 4중 (G-D20)", () => {
  it("띠(보라) · 안쪽 프레임 · 맥락 줄 '가짜 회사' · 인쇄 큰 제목 · 탭 제목, 베타 띠와 쌓이지 않는다", async () => {
    const h = mount();
    await openDemoReport(h);
    expect(document.querySelectorAll("aside.cc-band").length).toBe(1);
    expect(document.querySelector("aside.cc-band")?.className).toContain("cc-band--demo");
    expect(document.querySelector(".cc-demo-frame")).not.toBeNull();
    expect(document.querySelector(".cc-ctx")?.textContent).toContain("[체험] 아슬아슬상회 (가짜 회사)");
    expect(reportEl().querySelector(".cc-print-demo")?.textContent).toBe("체험 모드 · 가짜 데이터");
    expect(document.title).toBe("체험 리포트 · 문단속 5");
  });
  it("체험의 동작 줄: 인쇄 · 다른 회사 보기 · 학습용 계정으로 실제로 해 보기만(마스킹 사본·예외 내보내기·화면 가리기·새 점검 없음)", async () => {
    const h = mount();
    await openDemoReport(h);
    const act = reportEl().querySelector("#cc-act-h")?.parentElement as HTMLElement;
    const names = Array.from(act.querySelectorAll("button")).map((b) => b.textContent);
    expect(names).toEqual(["인쇄", "다른 회사 보기", "학습용 계정으로 실제로 해 보기"]);
    expect(act.textContent).not.toContain("이 탭을 닫거나 새로 고치면 리포트는 사라집니다");
  });
  it("체험에는 beforeunload를 걸지 않고, 실제 리포트에는 건다(Q7)", async () => {
    const h = mount();
    await openDemoReport(h);
    expect(unloadGuardActive()).toBe(false);
    cleanup();
    const h2 = mount();
    await openRealReport(h2);
    expect(unloadGuardActive()).toBe(true);
  });
  it("[다른 회사 보기] → V6", async () => {
    const h = mount();
    await openDemoReport(h);
    await h.user.click(screen.getByRole("button", { name: "다른 회사 보기" }));
    expect(h1().textContent).toBe("체험 모드");
    expect(document.querySelector(".cc-band--demo")).not.toBeNull();
  });
  it("[학습용 계정으로 실제로 해 보기] → V1(체험 해제: 보라 띠·프레임·리포트가 사라지고 베타 띠로)", async () => {
    const h = mount();
    await openDemoReport(h);
    await h.user.click(screen.getByRole("button", { name: "학습용 계정으로 실제로 해 보기" }));
    expect(h1().textContent).toBe("수집 준비");
    expect(document.querySelector(".cc-band--demo")).toBeNull();
    expect(document.querySelector(".cc-demo-frame")).toBeNull();
    expect(document.querySelector("aside.cc-band")?.textContent).toContain("베타");
    expect(document.querySelector(".cc-report")).toBeNull();
  });
});

describe("V3 → V4 → V3 (T9·T13)", () => {
  async function toFix(h: ReturnType<typeof mount>, ruleId: RuleId = "AWS-NET-1"): Promise<void> {
    await h.user.click(document.getElementById(DOM_ID.ruleFix(ruleId)) as HTMLElement);
    await waitFor(() => expect(h1().textContent).toBe("고치는 법"));
  }
  it("[고치는 법] → V4: h1 포커스 · 제목 · 낭독 · 쓰기 명령은 여기서만 · pushState({cc:'fix'}, '') · 해시 불변", async () => {
    const push = vi.spyOn(window.history, "pushState");
    const h = mount({ deps: createMockDeps({ judge: () => REAL_C }) });
    await openRealReport(h);
    await toFix(h);
    expect(document.activeElement).toBe(h1());
    expect(document.title).toMatch(/^고치는 법 · .+ · 문단속 5$/);
    expect(screen.getAllByRole("status")[0]?.textContent).toMatch(/^고치는 법 화면입니다\. /);
    expect(mainEl().querySelectorAll(".cc-cmd--write").length).toBeGreaterThan(0);
    expect(mainEl().querySelectorAll(".cc-cmd--read").length).toBeGreaterThan(0);
    for (const call of push.mock.calls) {
      expect(Object.keys(call[0] as object)).toEqual(["cc"]);
      expect(call[1]).toBe("");
      expect(call.length).toBe(2);
    }
    expect(push.mock.calls.map((c) => (c[0] as { cc: string }).cc)).toEqual(["input", "report", "fix"]);
    expect(window.location.hash).toBe("");
  });
  it("V4 구성: 대상 계정 줄(4겹) · 3단계 모두 펼침 · 운영 영향 칩 · 대상 목록(MaskedValue) · 복사 버튼 0", async () => {
    const h = mount({ deps: createMockDeps({ judge: () => REAL_C }) });
    await openRealReport(h);
    await toFix(h);
    const main = mainEl();
    expect(main.querySelector(".cc-fix__acct")).not.toBeNull();
    expect(textOf(main)).toContain("••••3333");
    expect(textOf(main)).toMatch(/운영 영향/);
    expect(main.querySelectorAll(".cc-steps > li").length).toBeGreaterThanOrEqual(3);
    expect(main.querySelectorAll(".cc-fix__targets .cc-mv").length).toBeGreaterThan(0);
    expect(Array.from(main.querySelectorAll("button")).filter((b) => /복사/.test(b.textContent ?? "")).length).toBe(0);
    expect(screen.getByRole("button", { name: "고친 뒤 다시 수집해서 비교하기 →" })).toBeInTheDocument();
    expect(mainEl()).toHaveAttribute("translate", "no");
  });
  it("V3는 마운트한 채 숨겨진다: 돌아오면 펼침이 그대로이고, 눌렀던 [고치는 법] 버튼에 포커스, 스크롤 복원", async () => {
    const h = mount({ deps: createMockDeps({ judge: () => REAL_C }) });
    await openRealReport(h);
    const toggle = document.getElementById(DOM_ID.ruleToggle("AWS-KEY-1")) as HTMLElement;
    await h.user.click(toggle);
    expect(toggle).toHaveAttribute("aria-expanded", "true");
    Object.defineProperty(window, "scrollY", { value: 321, configurable: true });
    await toFix(h);
    expect(reportEl().hidden).toBe(true);
    expect(h1().textContent).toBe("고치는 법");
    await h.user.click(screen.getByRole("button", { name: "← 리포트로" }));
    await waitFor(() => expect(h1().textContent).toBe("리포트"));
    expect(reportEl().hidden).toBe(false);
    expect(document.getElementById(DOM_ID.ruleToggle("AWS-KEY-1"))).toHaveAttribute("aria-expanded", "true");
    expect(document.activeElement?.id).toBe(DOM_ID.ruleFix("AWS-NET-1"));
    expect(document.documentElement.scrollTop).toBe(321);
  });
  it("[고친 뒤 다시 수집해서 비교하기 →] → V1 재수집 모드(이전 계정 상기 + 4시간 캐시 안내)", async () => {
    const h = mount({ deps: createMockDeps({ judge: () => REAL_C }) });
    await openRealReport(h);
    await toFix(h);
    await h.user.click(screen.getByRole("button", { name: "고친 뒤 다시 수집해서 비교하기 →" }));
    expect(h1().textContent).toBe("수집 준비");
    expect(screen.getByText(/고친 뒤 다시 수집하는 중입니다/)).toBeInTheDocument();
    expect(screen.getByText(/최대 4시간 전 상태일 수 있어/)).toBeInTheDocument();
    expect(mainEl().textContent).toContain("••••3333");
  });
  it("체험 V4: 쓰기 명령 위 체험 안내 · 가짜 계정 안내 · CTA는 학습용 계정으로 → V1", async () => {
    installDemoBlocks();
    const h = mount();
    await openDemoReport(h);
    await h.user.click(document.getElementById(DOM_ID.ruleFix("AWS-MFA-2")) as HTMLElement);
    await waitFor(() => expect(h1().textContent).toBe("고치는 법"));
    expect(screen.getAllByText(/체험 모드: 가짜 데이터의 예시입니다/).length).toBeGreaterThan(0);
    expect(screen.getByText(/체험 모드: 가짜 계정입니다/)).toBeInTheDocument();
    expect(document.querySelector("aside.cc-band")?.className).toContain("cc-band--demo");
    await h.user.click(screen.getByRole("button", { name: "학습용 계정으로 실제로 해 보기 →" }));
    expect(h1().textContent).toBe("수집 준비");
    expect(document.querySelector(".cc-band--demo")).toBeNull();
    expect(document.querySelector(".cc-demo-frame")).toBeNull();
  });
});

describe("V3 동작: 먼저 볼 3개 · 구역 이동 · 직접 볼 목록 이동", () => {
  it("[대상 n개 보기]는 해당 점검 행을 펼치고 그 버튼에 포커스(화면 이동·pushState 없음)", async () => {
    const h = mount({ deps: createMockDeps({ judge: () => REAL_C }) });
    await openRealReport(h);
    const push = vi.spyOn(window.history, "pushState");
    const first = reportEl().querySelector(".cc-first .cc-pl__i") as HTMLElement;
    const btn = Array.from(first.querySelectorAll("button")).find((b) => /대상 \d+개 보기/.test(b.getAttribute("aria-labelledby") ? textOf(b) : "")) as HTMLElement;
    await h.user.click(btn);
    const open = Array.from(reportEl().querySelectorAll(".cc-rule__tog[aria-expanded='true']"));
    expect(open.length).toBe(1);
    expect(document.activeElement).toBe(open[0]);
    expect(push).not.toHaveBeenCalled();
    expect(h1().textContent).toBe("리포트");
  });
  it("구역 이동 버튼은 제목으로 포커스를 옮긴다(해시 불변)", async () => {
    const h = mount({ deps: createMockDeps({ judge: () => REAL_C }) });
    await openRealReport(h);
    const nav = screen.getByRole("navigation", { name: "리포트 구역 이동" });
    await h.user.click(within(nav).getByRole("button", { name: "분포" }));
    expect(document.activeElement?.id).toBe("cc-dist-h");
    await h.user.click(within(nav).getByRole("button", { name: "직접 볼 목록" }));
    expect(document.activeElement?.id).toBe(DOM_ID.manual);
    await h.user.click(within(nav).getByRole("button", { name: "창고" }));
    expect(document.activeElement?.id).toBe(DOM_ID.door("sto"));
    expect(window.location.hash).toBe("");
  });
  it("미판정 줄: 확인 불가가 있을 때만, [직접 볼 목록으로 이동]이 목록 제목으로 포커스", async () => {
    const h = mount({ deps: createMockDeps({ judge: () => REAL_C }) });
    await openRealReport(h);
    const unknown = REAL_C.distribution.rules.unknown;
    if (unknown > 0) {
      expect(screen.getByText(new RegExp(`아직 판단하지 못한 점검이 ${unknown}개 있습니다`))).toBeInTheDocument();
      await h.user.click(screen.getByRole("button", { name: "직접 볼 목록으로 이동" }));
      expect(document.activeElement?.id).toBe(DOM_ID.manual);
    }
  });
  it("D 리포트(확인 불가 다수): 미판정 줄과 직접 볼 목록, 권한 해제 힌트가 보인다", async () => {
    const hD = real(MOCK_REPORTS.D);
    const h = mount({ deps: createMockDeps({ judge: () => hD }) });
    await openRealReport(h);
    expect(screen.getByText(/아직 판단하지 못한 점검이 \d+개 있습니다 → 직접 볼 목록/)).toBeInTheDocument();
    expect(document.getElementById(DOM_ID.manual)).not.toBeNull();
    expect(reportEl().querySelectorAll(".cc-mc tbody tr").length).toBeGreaterThan(0);
  });
});

describe("V3 예외 표시 (상태는 그대로)", () => {
  async function openKeyRule(h: ReturnType<typeof mount>): Promise<void> {
    await h.user.click(document.getElementById(DOM_ID.ruleToggle("AWS-KEY-1")) as HTMLElement);
  }
  it("[예외로 표시] → 폼 → 저장하면 라벨이 붙고 상태 배지는 같다. 요약 띠와 맥락 줄 '예외 1', 낭독", async () => {
    const h = mount({ deps: createMockDeps({ judge: () => REAL_C }) });
    await openRealReport(h);
    await openKeyRule(h);
    const row = document.getElementById(DOM_ID.rule("AWS-KEY-1")) as HTMLElement;
    const badgeBefore = Array.from(row.querySelectorAll("tbody .cc-sb")).map((b) => textOf(b));
    const mark = within(row).getAllByRole("button", { name: /예외로 표시/ })[0] as HTMLElement;
    await h.user.click(mark);
    const reason = within(row).getByLabelText(/사유/) as HTMLTextAreaElement;
    expect(reason).toHaveAttribute("spellcheck", "false");
    await h.user.type(reason, "다음 분기에 정리할 예정");
    await h.user.click(within(row).getByRole("button", { name: "예외로 표시하기" }));
    expect(row.querySelector(".cc-excl")?.textContent).toContain("예외 표시(상태는 그대로)");
    const badgeAfter = Array.from(row.querySelectorAll("tbody .cc-sb")).map((b) => textOf(b));
    expect(badgeAfter).toEqual(badgeBefore);
    expect(screen.getByText(/예외 1건 적용/)).toBeInTheDocument();
    expect(document.querySelector(".cc-ctx")?.textContent).toContain("예외 1");
    expect(screen.getAllByRole("status")[0]?.textContent).toBe("예외를 표시했습니다. 상태는 그대로입니다.");
  });
  it("사유가 비어 있으면 저장하지 않고 오류는 글자(빨강 없음)로", async () => {
    const h = mount({ deps: createMockDeps({ judge: () => REAL_C }) });
    await openRealReport(h);
    await openKeyRule(h);
    const row = document.getElementById(DOM_ID.rule("AWS-KEY-1")) as HTMLElement;
    await h.user.click(within(row).getAllByRole("button", { name: /예외로 표시/ })[0] as HTMLElement);
    await h.user.click(within(row).getByRole("button", { name: "예외로 표시하기" }));
    expect(within(row).getByText("사유를 입력하세요.")).toBeInTheDocument();
    expect(row.querySelector(".cc-excl")).toBeNull();
  });
  it("예외 파일 내보내기는 직렬화한 글자로 내려받고(마스킹 아님) 고지가 상시 보인다 · 불러오기 실패는 사유 한 줄", async () => {
    const created: Blob[] = [];
    URL.createObjectURL = vi.fn((b: Blob) => {
      created.push(b);
      return "blob:x";
    });
    URL.revokeObjectURL = vi.fn();
    const names: string[] = [];
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function (this: HTMLAnchorElement) {
      names.push(this.download);
    });
    const h = mount({ deps: createMockDeps({ judge: () => REAL_C }) });
    await openRealReport(h);
    expect(screen.getByText(/실제 리소스 이름이 들어 있습니다. 공유하거나 공개 저장소에 올리지 마세요/)).toBeInTheDocument();
    await h.user.click(screen.getByRole("button", { name: "예외 파일 내보내기" }));
    expect(created.length).toBe(1);
    expect(created[0]?.type).toBe("application/json"); // 확장자(.json)와 MIME이 맞는다 — Safari가 이름을 바꾸지 않는다
    expect(names).toEqual(["cloudcheck-exceptions.json"]);
    const input = reportEl().querySelector('input[type="file"][accept^=".json"]') as HTMLInputElement;
    await h.user.upload(input, new File(["{nope"], "bad.json", { type: "application/json" }));
    await waitFor(() => expect(screen.getAllByText(/예외 파일을 읽지 못했습니다: 파일 형식이 맞지 않습니다\./).length).toBeGreaterThan(0));
  });
});

describe("V3 인쇄 · 마스킹 사본 · 화면 가리기 · 새 점검", () => {
  it("인쇄 옵션: 기본 마스킹. [인쇄 창 열기]는 print() 동안만 루트 클래스를 붙이고 끝나면 반드시 뗀다", async () => {
    const seen: string[] = [];
    window.print = vi.fn(() => {
      seen.push(document.documentElement.className);
    });
    const h = mount({ deps: createMockDeps({ judge: () => REAL_C }) });
    await openRealReport(h);
    await h.user.click(screen.getByRole("button", { name: "인쇄" }));
    const group = screen.getByRole("group", { name: "인쇄 옵션" });
    expect(within(group).getByRole("checkbox", { name: "이름·ID 표시" })).not.toBeChecked();
    await h.user.click(within(group).getByRole("radio", { name: "직접 볼 목록만" }));
    await h.user.click(within(group).getByRole("checkbox", { name: "이름·ID 표시" }));
    await h.user.click(within(group).getByRole("button", { name: "인쇄 창 열기" }));
    expect(seen[0]).toContain("cc-print-list-only");
    expect(seen[0]).toContain("cc-print-unmask");
    expect(document.documentElement.classList.contains("cc-print-unmask")).toBe(false);
    expect(document.documentElement.classList.contains("cc-print-list-only")).toBe(false);
  });
  it("[이 목록만 인쇄]는 마스킹 기본(unmask 없음)", async () => {
    const seen: string[] = [];
    window.print = vi.fn(() => {
      seen.push(document.documentElement.className);
    });
    const h = mount({ deps: createMockDeps({ judge: () => real(MOCK_REPORTS.D) }) });
    await openRealReport(h);
    await h.user.click(screen.getByRole("button", { name: "이 목록만 인쇄" }));
    expect(seen[0]).toBe("cc-print-list-only");
  });
  it("마스킹 사본 저장: maskedCopy 결과를 cloudcheck-masked.json으로 내려받는다", async () => {
    const created: Blob[] = [];
    URL.createObjectURL = vi.fn((b: Blob) => {
      created.push(b);
      return "blob:y";
    });
    URL.revokeObjectURL = vi.fn();
    const names: string[] = [];
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function (this: HTMLAnchorElement) {
      names.push(this.download);
    });
    const maskedCopy = vi.fn(() => '{"masked":true}\n');
    const h = mount({ deps: createMockDeps({ maskedCopy, judge: () => REAL_C }) });
    await openRealReport(h);
    expect(screen.getByText(/가명으로 바꾼 복사본입니다/)).toBeInTheDocument();
    await h.user.click(screen.getByRole("button", { name: "마스킹 사본 저장" }));
    expect(maskedCopy).toHaveBeenCalledTimes(1);
    expect(names).toEqual(["cloudcheck-masked.json"]);
    expect(created[0]?.type).toBe("application/json"); // 확장자(.json)와 MIME이 맞는다
    expect(screen.getAllByRole("status")[0]?.textContent).toContain("내려받기를 시작했습니다");
  });
  it("화면 가리기(P1): 켜면 <html>에 cc-screen-mask + 맥락 줄 표시, 끄면 사라진다", async () => {
    const h = mount({ deps: createMockDeps({ judge: () => REAL_C }) });
    await openRealReport(h);
    const box = screen.getByRole("checkbox", { name: "화면 가리기" });
    await h.user.click(box);
    expect(document.documentElement.classList.contains("cc-screen-mask")).toBe(true);
    expect(document.querySelector(".cc-ctx")?.textContent).toContain("화면 가리기 켜짐 — 이름·ID가 가려져 있습니다");
    await h.user.click(box);
    expect(document.documentElement.classList.contains("cc-screen-mask")).toBe(false);
  });
  it("이중 렌더: 사용자 데이터는 화면용(full)과 인쇄용(masked) span을 함께 그린다", async () => {
    const h = mount({ deps: createMockDeps({ judge: () => REAL_C }) });
    await openRealReport(h);
    const pair = reportEl().querySelector(".cc-mv .cc-mask-full") as HTMLElement;
    expect(pair).not.toBeNull();
    expect(pair.nextElementSibling?.className).toBe("cc-mask-short");
  });
  it("유실 고지는 상시 보인다 · [새 점검]은 확인 대화상자(처음 포커스 = 리포트로 돌아가기)를 거친다", async () => {
    const h = mount({ deps: createMockDeps({ judge: () => REAL_C }) });
    await openRealReport(h);
    expect(screen.getByText(/이 탭을 닫거나 새로 고치면 리포트는 사라집니다/)).toBeInTheDocument();
    await h.user.click(screen.getByRole("button", { name: "새 점검" }));
    const dialog = await screen.findByRole("alertdialog");
    expect(within(dialog).getByText("리포트를 닫을까요?")).toBeInTheDocument();
    expect(document.activeElement).toBe(within(dialog).getByRole("button", { name: "리포트로 돌아가기" }));
    await h.user.click(within(dialog).getByRole("button", { name: "리포트로 돌아가기" }));
    expect(screen.queryByRole("alertdialog")).toBeNull();
    expect(h1().textContent).toBe("리포트");
    await h.user.click(screen.getByRole("button", { name: "새 점검" }));
    await h.user.click(within(await screen.findByRole("alertdialog")).getByRole("button", { name: "리포트를 닫고 계속" }));
    expect(h1().textContent).toBe("문단속 5");
    expect(document.querySelector(".cc-report")).toBeNull();
    expect(unloadGuardActive()).toBe(false);
  });
  it("Esc = 돌아가기(인라인 확인 패널)", async () => {
    const h = mount({ deps: createMockDeps({ judge: () => REAL_C }) });
    await openRealReport(h);
    await h.user.click(screen.getByRole("button", { name: "새 점검" }));
    await screen.findByRole("alertdialog");
    await h.user.keyboard("{Escape}");
    expect(screen.queryByRole("alertdialog")).toBeNull();
    expect(h1().textContent).toBe("리포트");
  });
  it("V0에서 새 점검을 시작할 때도 실제 리포트가 있으면 확인(T1)", async () => {
    const h = mount({ deps: createMockDeps({ judge: () => REAL_C }) });
    await openRealReport(h);
    await h.user.click(screen.getByRole("button", { name: "문단속 5" }));
    await h.user.click(screen.getByRole("button", { name: "AWS 점검 시작" }));
    expect(await screen.findByRole("alertdialog")).toBeInTheDocument();
    expect(h1().textContent).toBe("문단속 5");
  });
});

describe("창 전체 드롭 (유실 방지 장치 3)", () => {
  function dropOnWindow(files: File[]): Event {
    const e = new Event("drop", { cancelable: true, bubbles: true });
    Object.defineProperty(e, "dataTransfer", { value: { types: ["Files"], files } });
    act(() => {
      window.dispatchEvent(e);
    });
    return e;
  }
  it("V3에서는 새 파일을 읽지 않고 삼킨다(페이지 이탈 방지) + 안내", async () => {
    const h = mount({ deps: createMockDeps({ judge: () => REAL_C }) });
    await openRealReport(h);
    const e = dropOnWindow([jsonFile("x.json")]);
    expect(e.defaultPrevented).toBe(true);
    await waitFor(() => expect(screen.getAllByRole("status")[0]?.textContent).toContain("리포트를 보는 중에는 새 파일을 읽지 않습니다"));
    expect(h1().textContent).toBe("리포트");
  });
  it("V0에서는 V2로 가서 읽는다", async () => {
    mount();
    const e = dropOnWindow([jsonFile("a.json")]);
    expect(e.defaultPrevented).toBe(true);
    await waitFor(() => expect(h1().textContent).toBe("결과 파일 넣기"));
    await waitFor(() => expect(screen.getAllByRole("table")[0]).toBeInTheDocument());
  });
  it("V7·V8에서는 삼키고 안내", async () => {
    const h = mount();
    await h.user.click(screen.getByRole("button", { name: "판정 규칙" }));
    dropOnWindow([jsonFile("a.json")]);
    await waitFor(() => expect(screen.getAllByRole("status")[0]?.textContent).toContain("이 화면에서는 파일을 읽지 않습니다"));
  });
});

describe("V5 재점검 비교 (T8·T10·T14)", () => {
  async function toCompareInput(h: ReturnType<typeof mount>): Promise<void> {
    await openRealReport(h);
    await h.user.click(screen.getByRole("button", { name: "다시 수집한 파일과 비교" }));
    await waitFor(() => expect(h1().textContent).toBe("결과 파일 넣기"));
  }
  it("V2 비교 모드: 비교 대상 배너(계정) · 버튼 '비교 보기' · 같은 계정이면 활성", async () => {
    const h = mount();
    await toCompareInput(h);
    expect(screen.getByText(/이전 리포트와 비교할 새 결과 파일을 넣어 주세요/)).toBeInTheDocument();
    await uploadFiles(h, [jsonFile("after.json")]);
    await waitFor(() => expect(screen.getAllByRole("table")[0]).toBeInTheDocument());
    const cta = screen.getByRole("button", { name: "비교 보기" });
    expect(cta).not.toHaveAttribute("aria-disabled", "true");
    expect(screen.getAllByText(/비교 대상과 같은 계정입니다/).length).toBeGreaterThan(0);
  });
  it("다른 계정의 파일이면 [비교 보기]를 사전 차단하고 이유를 글자로(5겹)", async () => {
    const h = mount();
    await toCompareInput(h);
    await uploadFiles(h, [jsonFile("other.json")]);
    await waitFor(() => expect(screen.getAllByRole("table")[0]).toBeInTheDocument());
    expect(screen.getByRole("button", { name: "비교 보기" })).toHaveAttribute("aria-disabled", "true");
    expect(screen.getAllByText(/비교 대상과 다른 계정의 파일입니다. 같은 계정의 파일을 넣어 주세요./).length).toBeGreaterThan(0);
  });
  it("비교 보기 → V5: 두 신원 나란히 · 바뀐 점검 · 낭독, [이번 리포트 보기] → V3(새 리포트)", async () => {
    const h = mount({ deps: createMockDeps({ compare: () => MOCK_COMPARISON_OK }) });
    await toCompareInput(h);
    await uploadFiles(h, [jsonFile("after.json")]);
    await waitFor(() => expect(screen.getAllByRole("table")[0]).toBeInTheDocument());
    await h.user.click(screen.getByRole("button", { name: "비교 보기" }));
    await waitFor(() => expect(h1().textContent).toBe("재점검 비교"));
    expect(document.title).toBe("재점검 비교 · 문단속 5");
    expect(screen.getAllByRole("status")[0]?.textContent).toBe("재점검 비교 화면입니다. 바뀐 점검 4개.");
    expect(mainEl()).toHaveAttribute("translate", "no");
    expect(screen.getByText("바뀐 점검 4개")).toBeInTheDocument();
    // 이번에는 확인 불가가 된 점검이 맨 위 + 강조 줄
    const groups = Array.from(mainEl().querySelectorAll(".cc-ba__grp, h3, th[scope='rowgroup']")).map((x) => textOf(x));
    expect(textOf(mainEl()).indexOf("이번에는 확인 불가가 된 점검")).toBeLessThan(textOf(mainEl()).indexOf("심각도가 높아진 점검"));
    expect(textOf(mainEl())).toContain("고쳐서 사라진 것이 아닙니다");
    expect(groups).toBeDefined();
    expect(mainEl().textContent).not.toMatch(/개선율|좋아졌|%/);
    await h.user.click(screen.getByRole("button", { name: "이번 리포트 보기" }));
    expect(h1().textContent).toBe("리포트");
    expect(unloadGuardActive()).toBe(true);
  });
  it("같은 수집 결과면 거부(도형 없는 확인 불가 톤) + 두 신원 + [다른 파일로 다시 비교]만", async () => {
    const h = mount();
    await toCompareInput(h);
    await uploadFiles(h, [jsonFile("result.json")]);
    await waitFor(() => expect(screen.getAllByRole("table")[0]).toBeInTheDocument());
    await h.user.click(screen.getByRole("button", { name: "비교 보기" }));
    await waitFor(() => expect(h1().textContent).toBe("재점검 비교"));
    expect(screen.getByText("같은 수집 결과입니다. 고친 뒤 다시 수집한 파일을 넣어 주세요.")).toBeInTheDocument();
    expect(mainEl().querySelector(".cc-untone svg")).toBeNull();
    expect(screen.queryByRole("button", { name: "이번 리포트 보기" })).toBeNull();
    expect(screen.getAllByRole("status")[0]?.textContent).toBe("재점검 비교 화면입니다. 비교하지 않았습니다.");
    await h.user.click(screen.getByRole("button", { name: "다른 파일로 다시 비교" }));
    expect(h1().textContent).toBe("결과 파일 넣기");
  });
  it("← 리포트로: 이전 리포트로 돌아가고 비교 모드를 끝낸다", async () => {
    const h = mount();
    await toCompareInput(h);
    await uploadFiles(h, [jsonFile("result.json")]);
    await waitFor(() => expect(screen.getAllByRole("table")[0]).toBeInTheDocument());
    await h.user.click(screen.getByRole("button", { name: "비교 보기" }));
    await waitFor(() => expect(h1().textContent).toBe("재점검 비교"));
    await h.user.click(screen.getByRole("button", { name: "← 리포트로" }));
    expect(h1().textContent).toBe("리포트");
  });
  it("글자 점검: ⟦⟧(E 제외) 0 · 금지어 0 · 쓰기 명령 0", async () => {
    const h = mount({ deps: createMockDeps({ compare: () => MOCK_COMPARISON_OK }) });
    await toCompareInput(h);
    await uploadFiles(h, [jsonFile("after.json")]);
    await waitFor(() => expect(screen.getAllByRole("table")[0]).toBeInTheDocument());
    await h.user.click(screen.getByRole("button", { name: "비교 보기" }));
    await waitFor(() => expect(h1().textContent).toBe("재점검 비교"));
    expect(missingKeys(visibleText())).toEqual([]);
    expect(bannedHits(visibleText())).toEqual([]);
    expect(document.querySelectorAll(".cc-cmd--write").length).toBe(0);
  });
});

describe("popstate (뒤로·앞으로)", () => {
  it("데이터 없는 화면을 가리키면 V0, V4 → V3 복귀는 popstate로도 같은 복원", async () => {
    const h = mount({ deps: createMockDeps({ judge: () => REAL_C }) });
    await openRealReport(h);
    await h.user.click(document.getElementById(DOM_ID.ruleFix("AWS-NET-1")) as HTMLElement);
    await waitFor(() => expect(h1().textContent).toBe("고치는 법"));
    await act(async () => {
      window.history.back();
      await new Promise((r) => setTimeout(r, 30));
    });
    await waitFor(() => expect(h1().textContent).toBe("리포트"));
    expect(document.activeElement?.id).toBe(DOM_ID.ruleFix("AWS-NET-1"));
    act(() => {
      window.dispatchEvent(new PopStateEvent("popstate", { state: { cc: "compare" } }));
    });
    await waitFor(() => expect(h1().textContent).toBe("문단속 5"));
  });
});
