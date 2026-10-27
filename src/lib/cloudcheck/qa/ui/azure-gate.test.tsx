// @vitest-environment jsdom
// QA — V2 실제 Azure 입력 차단(기획팀장 결정 docs/planning/cloudcheck-qa-decisions.md §6 보정 2 · §8-A · §9-7, 베타 조건)
// 운영 기본값(Azure '준비 중')에서 V2에 실제 Azure 입력을 넣고 [이 계정으로 리포트 보기]를 누르면 리포트가 없고 기존 안내 cc.start.azure-soon.note가 보인다.
// 체험(Azure)은 그대로 열린다. 같은 파일도 공개 상태(availability 주입)면 리포트가 된다. 프론트 시험(real-engine.test.tsx)과 다른 입력(회사 A · D)으로 따로 본다.
import { readFileSync } from "node:fs";
import path from "node:path";
import { cleanup, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { t } from "../../../../app/cloudcheck/_client/i18n/index";
import { REAL_DEPS } from "../../../../app/cloudcheck/_client/state/deps.real";
import { h1, mount, uploadFiles } from "../../../../app/cloudcheck/_client/screens/__tests__/harness";
import type { Harness } from "../../../../app/cloudcheck/_client/screens/__tests__/harness";
import { companyJson } from "../kit";

afterEach(() => { cleanup(); vi.restoreAllMocks(); document.querySelectorAll('script[id^="cc-demo-"]').forEach((el) => el.remove()); });
const CLOCK = { now: () => "2026-10-19T05:00:00Z" as never, today: () => "2026-10-19" as never };
const NOTE = t("cc.start.azure-soon.note");
const azureFile = (set: "A" | "D"): File => new File([JSON.stringify(companyJson("azure", set))], `cloudcheck-azure-000${set === "A" ? 1 : 4}-20261019T031500Z.json`, { type: "application/json" });
const reports = (): number => document.querySelectorAll(".cc-report").length;

async function toV2(h: Harness, files: File[]): Promise<HTMLElement> {
  window.history.replaceState(null, "");
  await h.user.click(screen.getByRole("button", { name: "결과 파일이 이미 있어요" }));
  await uploadFiles(h, files);
  await waitFor(() => expect(screen.getAllByRole("table")[0]).toBeInTheDocument());
  return screen.getByRole("button", { name: "이 계정으로 리포트 보기" });
}

describe("V2 실제 Azure 입력 차단(운영 기본값 = Azure 준비 중)", () => {
  it("전제: 안내 문구가 비어 있지 않다(키 cc.start.azure-soon.note)", () => {
    expect(NOTE.length).toBeGreaterThan(10);
  });
  for (const set of ["A", "D"] as const) {
    it(`회사 ${set}(Azure 수집 JSON): 읽기는 되지만 버튼이 막히고 안내가 보이며, 눌러도 리포트가 없다`, async () => {
      const h = mount({ deps: REAL_DEPS, clock: CLOCK });
      const cta = await toV2(h, [azureFile(set)]);
      expect(within(screen.getAllByRole("table")[0] as HTMLElement).getByText("읽었습니다")).toBeInTheDocument();
      expect(cta).toHaveAttribute("aria-disabled", "true");
      expect(document.body.textContent ?? "").toContain(NOTE);
      await h.user.click(cta);
      expect(h1().textContent).toBe("결과 파일 넣기");
      expect(reports()).toBe(0);
    });
  }
  it("AWS 파일과 함께 넣어도(Azure + AWS) 리포트는 없다", async () => {
    const h = mount({ deps: REAL_DEPS, clock: CLOCK });
    const cta = await toV2(h, [azureFile("A"), new File([JSON.stringify(companyJson("aws", "A"))], "cloudcheck-aws-3333-20261019T031500Z.json", { type: "application/json" })]);
    await h.user.click(cta);
    expect(reports()).toBe(0);
  });
  it("대조: 같은 파일도 Azure를 연 공개 상태(availability 주입)면 리포트가 된다 — 막는 기준은 공개 상태 하나", async () => {
    const h = mount({ deps: REAL_DEPS, clock: CLOCK, availability: { aws: "beta", azure: "beta" } });
    const cta = await toV2(h, [azureFile("A")]);
    expect(cta).not.toHaveAttribute("aria-disabled", "true");
    await h.user.click(cta);
    await waitFor(() => expect(h1().textContent).toBe("리포트"));
    expect(reports()).toBe(1);
  });
  it("대조: AWS 실제 파일은 운영 기본값에서 그대로 리포트가 된다", async () => {
    const h = mount({ deps: REAL_DEPS, clock: CLOCK });
    const cta = await toV2(h, [new File([JSON.stringify(companyJson("aws", "C"))], "cloudcheck-aws-3333-20261019T031500Z.json", { type: "application/json" })]);
    await h.user.click(cta);
    await waitFor(() => expect(h1().textContent).toBe("리포트"));
    expect(reports()).toBe(1);
  });
});

describe("체험(Azure)은 막지 않는다", () => {
  /** 체험 데이터 블록(생성기 jsonBlock 모양)을 문서에 넣는다 */
  function installDemoBlocks(): void {
    const dir = path.resolve(__dirname, "../../fixtures/companies");
    for (const cloud of ["aws", "azure"] as const) for (const set of ["A", "B", "C", "D"] as const) {
      const el = document.createElement("script");
      el.type = "application/json";
      el.id = `cc-demo-${cloud}-${set}`;
      el.textContent = JSON.stringify(JSON.parse(readFileSync(path.join(dir, `${cloud}-${set}.json`), "utf8"))).replace(/</g, "\\u003c");
      document.body.appendChild(el);
    }
  }
  it("V0 → 체험 모드 → Azure → 아슬아슬상회 → 체험 리포트(Azure)가 열린다", async () => {
    installDemoBlocks();
    window.history.replaceState(null, "");
    const h = mount({ deps: REAL_DEPS, clock: CLOCK });
    await h.user.click(screen.getByRole("button", { name: "체험 모드로 먼저 보기" }));
    await waitFor(() => expect(h1().textContent).toBe("체험 모드"));
    await h.user.click(screen.getByRole("radio", { name: "Azure" }));
    const card = screen.getByRole("heading", { name: "아슬아슬상회" }).closest("article") as HTMLElement;
    await h.user.click(within(card).getByRole("button"));
    await waitFor(() => expect(h1().textContent).toBe("체험 리포트"));
    expect(document.querySelector(".cc-ctx")?.textContent ?? "").toContain("Azure");
  });
});
