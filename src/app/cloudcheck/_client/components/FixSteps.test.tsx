// @vitest-environment jsdom
// FixSteps · AccountCheck — 고치는 법(V4): 3단계 모두 펼침, 쓰기 명령은 ②·③만, 복사 버튼 0, 대상 계정 확인 상자.
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { CliTemplate } from "../../../../lib/cloudcheck/model/report";
import { MOCK_CATALOG } from "../mocks/catalog";
import { REPORT_C, REPORT_AZURE_A } from "../mocks/reports";
import { AccountCheck, FixSteps, stripStepMark } from "./FixSteps";
import { unexpectedMissing } from "./__tests__/render";

const fixes = MOCK_CATALOG.filter((e) => e.fix !== null);

describe("FixSteps", () => {
  it("고치는 법이 있는 점검 전부: 번호 목록 3단계가 모두 펼쳐져 있다(접힘·details 없음), 복사 버튼 0", () => {
    expect(fixes.length).toBeGreaterThan(0);
    for (const e of fixes) {
      const { container, unmount } = render(<FixSteps fix={e.fix!} demo={false} />);
      expect(container.querySelectorAll("ol.cc-steps > li"), e.ruleId).toHaveLength(3);
      expect(container.querySelectorAll("details, [aria-expanded], .cc-fold")).toHaveLength(0);
      expect(container.querySelectorAll("button")).toHaveLength(0);
      expect(container.querySelectorAll("h2.cc-fixstep__h")).toHaveLength(3); // STEP 5 QA CC-QA-21: V4 h1 바로 아래라 h2(모양은 h3)
      expect(container.querySelectorAll("h3")).toHaveLength(0);
      unmount();
    }
  });

  it("쓰기 명령은 ②·③에만, ①은 읽기 명령(머리표로 구분) — 쓰기 블록 수 = change + revert 명령 수", () => {
    for (const e of fixes) {
      const f = e.fix!;
      const { container, unmount } = render(<FixSteps fix={f} demo={false} />);
      const steps = Array.from(container.querySelectorAll("ol.cc-steps > li"));
      expect(steps[0]?.querySelectorAll(".cc-cmd--read")).toHaveLength(f.observe.commands.length);
      expect(steps[0]?.querySelectorAll(".cc-cmd--write")).toHaveLength(0);
      expect(steps[1]?.querySelectorAll(".cc-cmd--write")).toHaveLength(f.change.commands.length);
      expect(steps[2]?.querySelectorAll(".cc-cmd--write")).toHaveLength(f.revert.commands.length);
      expect(container.querySelectorAll(".cc-cmd--write")).toHaveLength(f.change.commands.length + f.revert.commands.length);
      unmount();
    }
  });

  it("②: 바꿀 속성 + 공식 문서 링크(새 탭, 호스트 글자) + 변경 문구, 쓰기 블록마다 자리표시자", () => {
    const e = fixes[0]!;
    const { container } = render(<FixSteps fix={e.fix!} demo={false} />);
    const second = container.querySelectorAll("ol.cc-steps > li")[1] as HTMLElement;
    expect(second.querySelector(".cc-fix__meta")?.textContent).toContain(e.fix!.change.property);
    const a = second.querySelector("a[target='_blank']") as HTMLAnchorElement;
    expect(a.getAttribute("rel")).toBe("noopener noreferrer");
    expect(a.textContent).toContain(e.fix!.change.doc.host);
    for (const block of Array.from(second.querySelectorAll(".cc-cmd--write"))) expect(block.querySelectorAll(".cc-ph").length).toBeGreaterThan(0);
  });

  it("체험이면 쓰기 블록마다 체험 안내(읽기 블록에는 없음)", () => {
    const e = fixes[0]!;
    const demo = render(<FixSteps fix={e.fix!} demo />);
    const writes = e.fix!.change.commands.length + e.fix!.revert.commands.length;
    expect((demo.container.textContent?.match(/체험 모드: 가짜 데이터의 예시입니다/g) ?? []).length).toBe(writes);
    demo.unmount();
    const real = render(<FixSteps fix={e.fix!} demo={false} />);
    expect(real.container.textContent).not.toContain("체험 모드: 가짜 데이터의 예시입니다");
  });

  it("commands가 비면 명령 블록 없이 문구만", () => {
    const f = { ...fixes[0]!.fix!, observe: { ...fixes[0]!.fix!.observe, commands: [] }, revert: { ...fixes[0]!.fix!.revert, commands: [] } };
    const { container } = render(<FixSteps fix={f} demo={false} />);
    const steps = Array.from(container.querySelectorAll("ol.cc-steps > li"));
    expect(steps[0]?.querySelector(".cc-cmd")).toBeNull();
    expect(steps[2]?.querySelector(".cc-cmd")).toBeNull();
    expect(steps[2]?.textContent?.length).toBeGreaterThan(0);
  });

  it("번호 상자와 단계 제목의 동그라미 숫자가 겹치지 않게 제목 앞 ①②③를 지운다", () => {
    expect(stripStepMark("① 먼저 확인")).toBe("먼저 확인");
    expect(stripStepMark("② 바꾸기")).toBe("바꾸기");
    expect(stripStepMark("③되돌리기")).toBe("되돌리기");
    expect(stripStepMark("먼저 확인")).toBe("먼저 확인");
  });

  it("카탈로그 키 누락 0(S 대기 키 제외)", () => {
    const { container } = render(<FixSteps fix={fixes[0]!.fix!} demo />);
    expect(unexpectedMissing(container)).toEqual([]);
  });
});

describe("AccountCheck", () => {
  const read: CliTemplate<"read"> = { kind: "read", shell: "aws", segments: [{ t: "text", v: "aws sts get-caller-identity" }] };
  it("AWS: 대상 계정(별칭 ••••끝4자리 · AWS) + 셸 계정 확인 문장(끝 네 자리 비교) + 읽기 명령 한 줄, 쓰기 블록 없음", () => {
    const { container } = render(<AccountCheck identity={REPORT_C.identity} cmd={read} demo={false} />);
    expect(container.querySelector("section.cc-fix__acct")).not.toBeNull();
    expect(container.textContent).toContain("••••3333");
    expect(container.textContent).toContain("AWS");
    expect(container.querySelector(".cc-cmd--read code")?.textContent).toBe("aws sts get-caller-identity");
    expect(container.querySelector(".cc-cmd--write")).toBeNull();
    expect(container.textContent).not.toContain("111122223333");
  });
  it("Azure: 테넌트 문구 키로, 체험이면 체험 안내 키로 바뀐다(키 이름으로 확인 — S 카탈로그가 채워지면 문장)", () => {
    const azure = render(<AccountCheck identity={REPORT_AZURE_A.identity} cmd={{ ...read, shell: "az" }} demo={false} />);
    const demo = render(<AccountCheck identity={REPORT_C.identity} cmd={read} demo />);
    const aws = render(<AccountCheck identity={REPORT_C.identity} cmd={read} demo={false} />);
    const t = (c: HTMLElement): string => c.textContent ?? "";
    // 세 문장은 서로 다르다(같은 키를 쓰지 않는다)
    expect(new Set([t(azure.container), t(demo.container), t(aws.container)]).size).toBe(3);
    expect(screen.queryAllByRole("button")).toHaveLength(0);
  });
});
