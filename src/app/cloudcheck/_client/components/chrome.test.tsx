// @vitest-environment jsdom
// AppHeader · Band · DemoFrame · StickyContextBar · SkipButton · JumpNav · LiveRegions · PromiseBlock · Disclaimer — 페이지 틀.
import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { IsoUtc, TimeNotice } from "../../../../lib/cloudcheck/model/report";
import { findBanned } from "../../../../lib/cloudcheck/model/banned-words";
import { REPORT_C, REPORT_REAL_D } from "../mocks/reports";
import { AppHeader } from "./AppHeader";
import { Band, DemoFrame } from "./Band";
import { Disclaimer } from "./Disclaimer";
import { LiveRegions } from "./LiveRegions";
import { PromiseBlock } from "./PromiseBlock";
import { JumpNav, SkipButton } from "./Skip";
import { StickyContextBar } from "./StickyContextBar";
import { attrValues, unexpectedMissing } from "./__tests__/render";

describe("AppHeader", () => {
  it("워드마크·메뉴 둘 모두 href 없는 버튼(앱 안 이동), 현재 화면에 aria-current=page", () => {
    const onNav = vi.fn();
    const { container, rerender } = render(<AppHeader current="start" offline={false} onNav={onNav} />);
    expect(container.querySelector("[href]")).toBeNull();
    const nav = screen.getByRole("navigation", { name: "주 메뉴" });
    const buttons = within(nav).getAllByRole("button");
    expect(buttons.map((b) => b.textContent)).toEqual(["문단속 5", "판정 규칙", "이 도구에 대해"]);
    expect(buttons[0]?.getAttribute("aria-current")).toBe("page");
    fireEvent.click(buttons[1] as HTMLElement);
    fireEvent.click(buttons[2] as HTMLElement);
    fireEvent.click(buttons[0] as HTMLElement);
    expect(onNav.mock.calls).toEqual([["catalog"], ["about"], ["start"]]);
    rerender(<AppHeader current="catalog" offline={false} onNav={onNav} />);
    expect(screen.getByRole("button", { name: "판정 규칙" }).getAttribute("aria-current")).toBe("page");
    expect(screen.getByRole("button", { name: "문단속 5" }).hasAttribute("aria-current")).toBe(false);
  });

  it("정적 셸과 같은 상단 구조(.cc-hdr > .cc-hdr__in.cc-wrap > .cc-hdr__brand) — 부팅 때 밀림(CLS) 방지", () => {
    const { container } = render(<AppHeader current="start" offline={false} onNav={vi.fn()} />);
    const hdr = container.querySelector("header.cc-hdr");
    const inner = hdr?.firstElementChild;
    expect(inner?.classList.contains("cc-hdr__in")).toBe(true);
    expect(inner?.classList.contains("cc-wrap")).toBe(true);
    expect(inner?.firstElementChild?.classList.contains("cc-hdr__brand")).toBe(true);
    expect(inner?.firstElementChild?.textContent).toBe("문단속 5");
  });

  it("offline(file://)이면 머리 아래 한 줄로 알린다", () => {
    const { container, rerender } = render(<AppHeader current="start" offline onNav={vi.fn()} />);
    expect(container.querySelector(".cc-hdr__off")?.textContent).toBe("오프라인판(파일)으로 열려 있습니다");
    rerender(<AppHeader current="start" offline={false} onNav={vi.fn()} />);
    expect(container.querySelector(".cc-hdr__off")).toBeNull();
  });
});

describe("Band · DemoFrame", () => {
  it("베타 띠: 정적 셸과 같은 구조(aside.cc-band > tag + row + 공백 + more), 닫기·펼치기 버튼 없음", () => {
    const { container } = render(<Band kind="beta" />);
    const band = container.querySelector("aside.cc-band") as HTMLElement;
    expect(band.getAttribute("aria-label")).toBe("안내 띠");
    expect(Array.from(band.children).map((c) => c.className)).toEqual(["cc-band__tag", "cc-band__row", "cc-band__more"]);
    expect(band.textContent).toBe("베타실계정 검증 전 판정이 틀릴 수 있습니다.");
    expect(band.classList.contains("cc-band--demo")).toBe(false);
    expect(container.querySelector("button")).toBeNull();
  });
  it("체험 띠: --demo + 체험 문구 3키", () => {
    const { container } = render(<Band kind="demo" />);
    const band = container.querySelector("aside.cc-band") as HTMLElement;
    expect(band.classList.contains("cc-band--demo")).toBe(true);
    expect(band.querySelector(".cc-band__tag")?.textContent).toBe("체험 모드");
    expect(band.querySelector(".cc-band__row")?.textContent).toBe("가짜 데이터");
    expect(band.querySelector(".cc-band__more")?.textContent).toBe("실제 계정을 점검한 결과가 아닙니다.");
  });
  it("DemoFrame은 aria-hidden 고정 프레임", () => {
    const { container } = render(<DemoFrame />);
    expect(container.firstElementChild?.getAttribute("aria-hidden")).toBe("true");
    expect(container.firstElementChild?.classList.contains("cc-demo-frame")).toBe(true);
  });
});

describe("StickyContextBar", () => {
  const baseProps = { exceptionsActive: null, demoCompanyKey: null, age: null, screenMasked: false } as const;
  it("실제 리포트: 별칭 ••••끝4자리 · 클라우드 · 기준 시각(KST 짧게) · '확인 불가 n'(StatusBadge sm) — 전체 계정 ID 없음", () => {
    const { container } = render(<StickyContextBar identity={REPORT_REAL_D.identity} asOf={REPORT_REAL_D.collection.asOf} unknownRules={REPORT_REAL_D.distribution.rules.unknown} {...baseProps} exceptionsActive={1} />);
    const bar = screen.getByRole("region", { name: "계정과 기준 시각" });
    expect(bar.textContent).toContain("halfseen-prod");
    expect(bar.textContent).toContain("••••3333");
    expect(bar.textContent).toContain("AWS");
    expect(bar.textContent).toContain("10-19 12:12 KST 기준");
    expect(bar.querySelector(".cc-sb--sm")?.textContent).toBe(`확인 불가 ${REPORT_REAL_D.distribution.rules.unknown}`);
    expect(bar.textContent).toContain("예외 1");
    expect(container.textContent).not.toContain("111122223333");
    expect(unexpectedMissing(container)).toEqual([]);
  });
  it("기준 시각이 파일 이름·수정 시각으로 추정이면 '(추정)'", () => {
    const { container } = render(<StickyContextBar identity={REPORT_C.identity} asOf={{ at: "2026-10-19T03:12:00Z" as IsoUtc, source: "filename" }} unknownRules={0} {...baseProps} />);
    expect(container.textContent).toContain("(추정)");
  });
  it("체험: 별칭 자리에 '[체험] 회사 이름 (가짜 회사)'", () => {
    const { container } = render(<StickyContextBar identity={REPORT_C.identity} asOf={REPORT_C.collection.asOf} unknownRules={1} {...baseProps} demoCompanyKey="cc.status.risk" />);
    expect(container.textContent).toContain("[체험] 위험 (가짜 회사)");
    expect(container.textContent).not.toContain("별칭 없음");
  });
  it("경과는 24시간 이상일 때만(시간·일), 화면 가리기 켜짐 문구", () => {
    const age = (ageHours: number): Extract<TimeNotice, { kind: "snapshot-age" }> => ({ kind: "snapshot-age", level: "stale", ageHours });
    const text = (ageHours: number | null, screenMasked = false): string => {
      const { container, unmount } = render(<StickyContextBar identity={REPORT_C.identity} asOf={null} unknownRules={0} {...baseProps} age={ageHours === null ? null : age(ageHours)} screenMasked={screenMasked} />);
      const t = container.textContent ?? "";
      unmount();
      return t;
    };
    expect(text(10)).not.toMatch(/시간 전|일 전/);
    expect(text(30)).toContain("30시간 전");
    expect(text(200)).toContain("8일 전");
    expect(text(null, true)).toContain("화면 가리기 켜짐 — 이름·ID가 가려져 있습니다");
  });
  it("속성에 사용자 데이터가 없다", () => {
    const { container } = render(<StickyContextBar identity={REPORT_REAL_D.identity} asOf={null} unknownRules={0} {...baseProps} />);
    expect(attrValues(container).some((v) => v.includes("halfseen"))).toBe(false);
  });
});

describe("SkipButton · JumpNav", () => {
  it("건너뛰기: href 없는 버튼, 누르면 대상에 focus()", () => {
    const main = document.createElement("main");
    main.tabIndex = -1;
    document.body.appendChild(main);
    const { container } = render(<SkipButton target={() => main} />);
    expect(container.querySelector("[href]")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "본문으로 건너뛰기" }));
    expect(document.activeElement).toBe(main);
    main.remove();
  });
  it("구역 이동: 항목마다 버튼 + focus(), 해시가 바뀌지 않는다", () => {
    const h = document.createElement("h2");
    h.tabIndex = -1;
    document.body.appendChild(h);
    const before = window.location.hash;
    render(<JumpNav items={[{ labelKey: "cc.c.scope.heading", target: () => h }, { labelKey: "cc.c.manual.heading", target: () => null }]} />);
    const nav = screen.getByRole("navigation");
    expect(within(nav).getAllByRole("button").map((b) => b.textContent)).toEqual(["조회 범위", "직접 볼 목록"]);
    fireEvent.click(within(nav).getByRole("button", { name: "조회 범위" }));
    expect(document.activeElement).toBe(h);
    fireEvent.click(within(nav).getByRole("button", { name: "직접 볼 목록" })); // 대상이 없어도 던지지 않는다
    expect(window.location.hash).toBe(before);
    h.remove();
  });
});

describe("LiveRegions", () => {
  it("polite(status) · assertive(alert) 둘, 글자는 그대로, 시각적으로 숨김", () => {
    const { container, rerender } = render(<LiveRegions polite="파일 1개를 읽었습니다." assertive="" />);
    expect(screen.getByRole("status").textContent).toBe("파일 1개를 읽었습니다.");
    expect(screen.getByRole("alert").textContent).toBe("");
    expect(container.querySelectorAll(".cc-vh")).toHaveLength(2);
    rerender(<LiveRegions polite="" assertive="키가 든 파일로 보입니다" />);
    expect(screen.getByRole("alert").textContent).toBe("키가 든 파일로 보입니다");
  });
});

describe("PromiseBlock · Disclaimer", () => {
  it("full: 한 줄 약속 + 무전송 약속 + 고지(항상 약속 바로 아래), 확인 방법 링크는 onVerify가 있을 때만(버튼)", () => {
    const onVerify = vi.fn();
    const { container, rerender } = render(<PromiseBlock variant="full" />);
    expect(container.textContent).toContain("열쇠는 맡기지 않습니다.");
    expect(container.textContent).toContain("이 페이지는 올린 파일을 어디로도 보내지 않습니다.");
    expect(container.querySelector("button")).toBeNull();
    const ps = Array.from(container.querySelectorAll("p"));
    expect(ps[ps.length - 1]?.textContent).toContain("브라우저 확장 프로그램, 자동 번역, 향상된 맞춤법 검사"); // 고지가 마지막(= 약속 바로 아래)
    rerender(<PromiseBlock variant="full" onVerify={onVerify} />);
    fireEvent.click(screen.getByRole("button", { name: "직접 확인하는 방법 3가지 →" }));
    expect(onVerify).toHaveBeenCalledTimes(1);
    expect(container.querySelector("[href]")).toBeNull();
  });
  it("short: 한 줄 약속 없이 무전송 약속 + 고지, hideLine은 full에서 한 줄 약속만 뺀다", () => {
    const a = render(<PromiseBlock variant="short" />);
    expect(a.container.textContent).not.toContain("열쇠는 맡기지 않습니다.");
    expect(a.container.textContent).toContain("확장을 끈 창이나 오프라인판");
    const b = render(<PromiseBlock variant="full" hideLine />);
    expect(b.container.textContent).not.toContain("열쇠는 맡기지 않습니다.");
    expect(b.container.textContent).toContain("확장을 끈 창이나 오프라인판");
  });
  it("면책 전문은 확정문 그대로이고, 금지어는 허용 키 범위(보증·인증·준수의 부정문)만 걸린다", () => {
    const { container } = render(<Disclaimer />);
    expect(container.querySelector(".cc-disc")?.textContent).toContain("보안을 보증하거나 규정 준수를 인증하지 않습니다.");
    const labels = new Set(findBanned(container.textContent ?? "").map((h) => h.label));
    for (const l of labels) expect(["인증·보증·보장", "적합·준수"]).toContain(l);
  });
});
