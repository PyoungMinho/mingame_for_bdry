// @vitest-environment jsdom
// CliBlock — 관문 ④: 명령·쿼리·직접 입력 줄. 복사 버튼 0(R-11), 자리표시자 꺾쇠 유지, 쓰기 블록 표식, KQL 전체 선택(Selection API).
import { fireEvent, render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { CliTemplate } from "../../../../lib/cloudcheck/model/report";
import { RG_NSG_KQL, RG_STORAGE_KQL } from "../../../../lib/cloudcheck/contract/rg-queries";
import { MOCK_CATALOG } from "../mocks/catalog";
import { CliBlock } from "./CliBlock";
import { unexpectedMissing } from "./__tests__/render";

const read: CliTemplate<"read"> = { kind: "read", shell: "aws", segments: [{ t: "text", v: "aws iam list-mfa-devices --user-name " }, { t: "ph", key: "cc.ph.user-name" }] };
const write: CliTemplate<"write"> = { kind: "write", shell: "aws", segments: [{ t: "text", v: "aws iam delete-login-profile --user-name " }, { t: "ph", key: "cc.ph.user-name" }] };

describe("CliBlock", () => {
  it("읽기 명령: figure.cc-cmd--read, 머리표, 자리표시자는 <…> 꺾쇠 그대로, 복사 버튼 없음", () => {
    const { container } = render(<CliBlock cmd={read} />);
    expect(container.querySelector("figure.cc-cmd--read")).not.toBeNull();
    expect(container.querySelector("figcaption")?.textContent).toBe("읽기 명령(조회용 예시)");
    const ph = container.querySelector(".cc-ph");
    expect(ph?.textContent?.startsWith("<")).toBe(true);
    expect(ph?.textContent?.endsWith(">")).toBe(true);
    expect(container.querySelector("code")?.textContent?.startsWith("aws iam list-mfa-devices --user-name <")).toBe(true);
    expect(container.querySelectorAll("button")).toHaveLength(0);
    expect(container.querySelector("figure")?.getAttribute("translate")).toBe("no");
    expect(container.textContent).toContain("자리표시자입니다");
    expect(container.textContent).not.toContain("복사 버튼은 없습니다"); // 읽기 블록에는 쓰기 안내 없음
  });

  it("쓰기 명령: cc-cmd--write, 머리표 '쓰기 명령 · 계정 설정을 바꿉니다', 복사 버튼 없음 안내, 체험 안내는 demo일 때만", () => {
    const { container, rerender } = render(<CliBlock cmd={write} />);
    expect(container.querySelector("figure.cc-cmd--write figcaption")?.textContent).toBe("쓰기 명령 · 계정 설정을 바꿉니다");
    expect(container.textContent).toContain("복사 버튼은 없습니다.");
    expect(container.textContent).not.toContain("체험 모드: 가짜 데이터의 예시입니다");
    rerender(<CliBlock cmd={write} demo />);
    expect(container.textContent).toContain("체험 모드: 가짜 데이터의 예시입니다");
    rerender(<CliBlock cmd={read} demo />);
    expect(container.textContent).not.toContain("체험 모드: 가짜 데이터의 예시입니다"); // 읽기 블록에는 체험 안내 없음
  });

  it("자리표시자가 없으면 자리표시자 안내가 없다", () => {
    const { container } = render(<CliBlock cmd={{ kind: "read", shell: "aws", segments: [{ t: "text", v: "aws sts get-caller-identity" }] }} />);
    expect(container.textContent).not.toContain("자리표시자입니다");
    expect(container.querySelector(".cc-ph")).toBeNull();
  });

  it("직접 입력 줄(typed): 머리표 '셸에 직접 입력하는 줄', 버튼 0", () => {
    const { container } = render(<CliBlock typed="sha256sum cloudcheck-aws.sh" />);
    expect(container.querySelector("figure.cc-cmd--typed figcaption")?.textContent).toBe("셸에 직접 입력하는 줄");
    expect(container.querySelector("code")?.textContent).toBe("sha256sum cloudcheck-aws.sh");
    expect(container.querySelectorAll("button")).toHaveLength(0);
  });

  it("KQL: 포커스가 들어오면 블록 전체가 선택된다(클립보드 API 아님) + 선택 안내가 aria-describedby로 연결", () => {
    const { container } = render(<CliBlock kql={{ id: "cc-rg-storage/1", text: RG_STORAGE_KQL }} />);
    const pre = container.querySelector("pre") as HTMLElement;
    expect(pre.getAttribute("tabindex")).toBe("0");
    const hint = container.querySelector(`#${CSS.escape(pre.getAttribute("aria-describedby") ?? "")}`);
    expect(hint?.textContent).toContain("전체가 선택됩니다");
    expect(container.querySelector("figure")?.classList.contains("cc-cmd--kql")).toBe(true);
    fireEvent.focus(pre);
    expect(window.getSelection()?.toString()).toBe(RG_STORAGE_KQL);
    expect(container.querySelectorAll("button")).toHaveLength(0);
  });

  it("읽기·쓰기·직접 입력 블록은 선택 동작이 없다(포커스해도 선택이 생기지 않는다)", () => {
    window.getSelection()?.removeAllRanges();
    const { container } = render(<CliBlock cmd={write} />);
    fireEvent.focus(container.querySelector("pre") as HTMLElement);
    expect(window.getSelection()?.toString()).toBe("");
  });

  it("KQL 두 개(스토리지·NSG) 렌더, 줄바꿈 보존", () => {
    const { container } = render(
      <>
        <CliBlock kql={{ id: "a", text: RG_STORAGE_KQL }} />
        <CliBlock kql={{ id: "b", text: RG_NSG_KQL }} />
      </>,
    );
    expect(container.querySelectorAll("figure.cc-cmd--kql")).toHaveLength(2);
    expect(container.querySelectorAll("code")[1]?.textContent).toBe(RG_NSG_KQL);
  });

  it("목업 카탈로그의 모든 고치는 법 명령: 쓰기 블록마다 자리표시자 ≥ 1, 버튼 0, 클래스 cc- 접두", () => {
    for (const e of MOCK_CATALOG) {
      if (e.fix === null) continue;
      const cmds = [...e.fix.observe.commands, ...e.fix.change.commands, ...e.fix.revert.commands];
      for (const cmd of cmds) {
        const { container, unmount } = render(<CliBlock cmd={cmd} demo />);
        expect(container.querySelectorAll("button"), e.ruleId).toHaveLength(0);
        if (cmd.kind === "write") expect(container.querySelectorAll(".cc-ph").length, e.ruleId).toBeGreaterThan(0);
        expect(unexpectedMissing(container)).toEqual([]);
        unmount();
      }
    }
  });
});
