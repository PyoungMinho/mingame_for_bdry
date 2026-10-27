// @vitest-environment jsdom
// QA UI-02 · UI-03(일부) — 접근성 구조 (설계서 §4-6). 실브라우저 axe-core 스윕(ISO-03 스크래치)에서 나온 위반을 jsdom으로 고정한다.
// 확인된 버그 CC-QA-21: ① 상태 범례 <dl class="cc-legend" role="group">의 role이 dl 의미를 덮어 dt·dd가 목록 밖이 된다(axe dlitem, serious, V3마다 10곳)
//                      ② 고치는 법(V4)의 단계 제목이 h1 다음 h3(h2 건너뜀, axe heading-order)
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { StatusLegend } from "../../../../app/cloudcheck/_client/components/StatusLegend";
import { REAL_DEPS } from "../../../../app/cloudcheck/_client/state/deps.real";
import { h1, mount, uploadFiles } from "../../../../app/cloudcheck/_client/screens/__tests__/harness";
import { companyJson } from "../kit";

afterEach(() => { cleanup(); vi.restoreAllMocks(); });
const CLOCK = { now: () => "2026-10-19T05:00:00Z" as never, today: () => "2026-10-19" as never };

describe("CC-QA-21 상태 범례 dl", () => {
  it("전제: 범례는 dl 안에 dt·dd 짝 5개(상태 5종)를 그린다", () => {
    const { container } = render(<StatusLegend />);
    expect(container.querySelectorAll("dl.cc-legend dt").length).toBe(5);
    expect(container.querySelectorAll("dl.cc-legend dd").length).toBe(5);
  });
  it("[CC-QA-21] dl에 role을 덮어쓰지 않아야 한다(dt·dd가 '용어·설명' 목록으로 읽히게) (수정 전: role=group)", () => {
    const { container } = render(<StatusLegend />);
    expect(container.querySelector("dl.cc-legend")?.getAttribute("role")).toBeNull();
  });
});

describe("CC-QA-21 고치는 법(V4) 제목 수준", () => {
  it("[CC-QA-21] V4의 제목 수준이 한 단계씩만 내려간다(h1 → h3 건너뜀 없음)", async () => {
    window.history.replaceState(null, "");
    window.print = vi.fn();
    const h = mount({ deps: REAL_DEPS, clock: CLOCK });
    await h.user.click(screen.getByRole("button", { name: "결과 파일이 이미 있어요" }));
    await uploadFiles(h, [new File([JSON.stringify(companyJson("aws", "C"))], "cloudcheck-aws-3333-20261019T031500Z.json", { type: "application/json" })]);
    await waitFor(() => expect(screen.getAllByRole("table")[0]).toBeInTheDocument());
    await h.user.click(screen.getByRole("button", { name: "이 계정으로 리포트 보기" }));
    await waitFor(() => expect(h1().textContent).toBe("리포트"));
    await h.user.click(document.getElementById("cc-rule-AWS-NET-1-fix") as HTMLElement);
    await waitFor(() => expect(h1().textContent).toBe("고치는 법"));
    const levels = [...document.querySelectorAll("main h1, main h2, main h3, main h4")].filter((e) => e.closest("[hidden]") === null).map((e) => Number(e.tagName[1]));
    const jumps = levels.slice(1).map((l, i) => l - levels[i]).filter((d) => d > 1);
    expect(jumps).toEqual([]);
  });
});
