// @vitest-environment jsdom
// src/app/cloudcheck/_client/screens/__tests__/basic.test.tsx — V0 시작 · V1 수집 준비 · V2 입력 · V6 체험 고르기 · V7 판정 규칙 · V8 이 도구에 대해 · 앱 틀.
// 엔진은 목업 EngineDeps. 렌더 글자의 ⟦키⟧(목업은 C·S 키만 본다 — 목업 엔진 코드는 가짜라 E 누락은 real-engine·demo-real 시험이 본다)·금지어·쓰기 명령 위치·상태 글자를 함께 본다.
import { cleanup, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { bannedHits, h1, installDemoBlocks, jsonFile, mainEl, missingKeys, mount, openRealReport, removeDemoBlocks, uploadFiles, visibleText } from "./harness";

/** jsdom Blob에는 text()가 없다 */
const readBlob = (b: Blob): Promise<string> =>
  new Promise((resolve) => {
    const r = new FileReader();
    r.onload = (): void => resolve(String(r.result));
    r.readAsText(b);
  });

beforeEach(() => {
  window.history.replaceState(null, "");
  document.documentElement.className = "";
  document.documentElement.removeAttribute("data-cc-booted");
  window.print = vi.fn();
});
afterEach(() => {
  cleanup();
  removeDemoBlocks();
  vi.restoreAllMocks();
});

describe("앱 틀", () => {
  it("라이브 영역 둘 → 건너뛰기 버튼 → 띠 → 머리 → main → 바닥 순서, 첫 Tab은 '본문으로 건너뛰기'", async () => {
    const h = mount();
    const body = document.body.firstElementChild as HTMLElement;
    const order = Array.from(body.children).map((el) => el.tagName.toLowerCase() + (el.getAttribute("role") ?? ""));
    expect(order.slice(0, 2)).toEqual(["divstatus", "divalert"]);
    expect(body.querySelector("button.cc-skip")).not.toBeNull();
    await h.user.tab();
    expect(document.activeElement?.textContent).toBe("본문으로 건너뛰기");
    await h.user.keyboard("{Enter}");
    expect(document.activeElement).toBe(mainEl());
    expect(window.location.hash).toBe("");
  });
  it("첫 화면에서는 포커스·낭독을 빼앗지 않는다", () => {
    mount();
    expect(document.activeElement).toBe(document.body);
    expect(screen.getAllByRole("status")[0]?.textContent).toBe("");
    expect(document.title).toBe("문단속 5");
  });
  it("바닥: 만든 곳 · 페이지·룰셋 버전 · 한국어만 지원. 저장소 링크는 REPO_URL이 null이면 없다", () => {
    mount();
    const foot = document.querySelector("footer") as HTMLElement;
    expect(foot.textContent).toContain("만든 곳: Boundaryworks");
    expect(foot.textContent).toContain("페이지 버전 0.1.0");
    expect(foot.textContent).toContain("현재는 한국어만 지원합니다.");
    expect(foot.querySelector("a")).toBeNull();
  });
  it("href는 DocLink·DownloadLink에만: 앱 안 이동 버튼은 href가 없다(머리 메뉴·워드마크)", () => {
    mount();
    const header = document.querySelector("header") as HTMLElement;
    expect(header.querySelectorAll("a").length).toBe(0);
    expect(header.querySelectorAll("button").length).toBe(3);
  });
  it("file://이면 머리에 알리고 <html>에 cc-file, 오프라인판 블록을 숨긴다", () => {
    mount({ offline: true });
    expect(screen.getByText("오프라인판(파일)으로 열려 있습니다")).toBeInTheDocument();
    expect(document.documentElement.classList.contains("cc-file")).toBe(true);
    expect(screen.queryByText("오프라인판 내려받기")).toBeNull();
  });
});

describe("V0 시작", () => {
  it("정적 셸과 같은 상단 구조: h1 → tagline → p.cc-display(한 줄 약속)", () => {
    mount();
    const main = mainEl();
    expect(main.className).toBe("cc-wrap cc-stack");
    const kids = Array.from(main.children);
    expect(kids[0]?.tagName).toBe("H1");
    expect(kids[0]?.textContent).toBe("문단속 5");
    expect(kids[1]?.textContent).toBe("AWS·Azure 설정 다섯 곳의 위험 신호를 찾는 무료 교육 도구(베타)");
    expect(kids[2]?.className).toBe("cc-display");
    expect(kids[2]?.textContent).toContain("열쇠는 맡기지 않습니다.");
  });
  it("버튼 4개: AWS(주) · Azure(펼침 버튼, 준비 중) · 체험 · 결과 파일", () => {
    mount();
    const aws = screen.getByRole("button", { name: "AWS 점검 시작" });
    expect(aws.className).toContain("cc-btn--primary");
    const azure = screen.getByRole("button", { name: /Azure 점검 시작/ });
    expect(azure).toHaveAttribute("aria-expanded", "false");
    expect(azure).not.toHaveAttribute("aria-disabled");
    expect(azure.textContent).toContain("준비 중 · 실제 계정 검증 전");
    expect(screen.getByRole("button", { name: "체험 모드로 먼저 보기" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "결과 파일이 이미 있어요" })).toBeInTheDocument();
  });
  it("Azure 버튼은 이동하지 않고 같은 자리에 안내 + [Azure 체험 보기]를 펼친다", async () => {
    const h = mount();
    const azure = screen.getByRole("button", { name: /Azure 점검 시작/ });
    await h.user.click(azure);
    expect(azure).toHaveAttribute("aria-expanded", "true");
    expect(h1().textContent).toBe("문단속 5");
    expect(screen.getByText(/Azure 실제 점검은 준비 중입니다/)).toBeVisible();
    await h.user.click(screen.getByRole("button", { name: "Azure 체험 보기" }));
    expect(h1().textContent).toBe("체험 모드");
    expect(screen.getByRole("radio", { name: "Azure" })).toBeChecked();
  });
  it("약속 바로 아래 고지가 항상 있다(G-D19) · 직접 확인하는 방법 3가지 → 는 버튼이고 A9 제목으로 포커스를 옮긴다", async () => {
    const h = mount();
    expect(screen.getByText(/브라우저 확장 프로그램, 자동 번역/)).toBeInTheDocument();
    await h.user.click(screen.getByRole("button", { name: "직접 확인하는 방법 3가지 →" }));
    expect(document.activeElement?.textContent).toBe("직접 확인하는 방법 3가지");
    expect(window.location.hash).toBe("");
  });
  it("못 보는 것 3줄 + '7가지 모두 보기'는 같은 자리에서 접힘을 연다(화면 이동 없음)", async () => {
    const h = mount();
    const more = screen.getByRole("button", { name: /7가지 모두 보기/ });
    expect(more).toHaveAttribute("aria-expanded", "false");
    await h.user.click(more);
    expect(more).toHaveAttribute("aria-expanded", "true");
    expect(h1().textContent).toBe("문단속 5");
  });
  it("오프라인판 블록: 내려받기 링크 + 게시 채널(준비 중) + sha256sum 대조 안내. 해시 값은 쓰지 않는다(Q1)", () => {
    mount();
    const link = screen.getByRole("link", { name: "오프라인판 내려받기" });
    expect(link).toHaveAttribute("href", "/cloudcheck/download");
    expect(screen.getByText(/파일 안에 적을 수 없습니다/)).toBeInTheDocument();
    expect(mainEl().textContent).not.toMatch(/[0-9a-f]{64}/);
  });
  it("⟦키⟧(C·S — 목업) 0, 금지어 0, 쓰기 명령 0", () => {
    mount();
    expect(missingKeys(visibleText())).toEqual([]);
    expect(bannedHits(visibleText())).toEqual([]);
    expect(document.querySelectorAll(".cc-cmd--write").length).toBe(0);
  });
  it("[AWS 점검 시작] → V1: 포커스는 h1, 제목·낭독, pushState({cc:'prep'}, '')", async () => {
    const push = vi.spyOn(window.history, "pushState");
    const h = mount();
    await h.user.click(screen.getByRole("button", { name: "AWS 점검 시작" }));
    expect(h1().textContent).toBe("수집 준비");
    expect(document.activeElement).toBe(h1());
    expect(document.title).toBe("수집 준비 · 문단속 5");
    expect(screen.getAllByRole("status")[0]?.textContent).toBe("수집 준비 화면입니다. AWS.");
    expect(push).toHaveBeenCalledTimes(1);
    expect(push).toHaveBeenCalledWith({ cc: "prep" }, "");
    expect(window.location.hash).toBe("");
  });
  it("부팅 때 history.state가 V2~V5였는데 메모리가 비어 있으면 V0에 복구 안내(A3')", () => {
    window.history.replaceState({ cc: "report" }, "");
    mount();
    expect(screen.getByText("이 탭의 이전 작업이 사라졌을 수 있습니다")).toBeInTheDocument();
    expect(h1().textContent).toBe("문단속 5");
    expect(document.activeElement).toBe(document.body);
  });
  it("열린 실제 리포트가 있으면 A3 '리포트로 돌아가기', 체험 리포트에는 없다", async () => {
    const h = mount();
    await openRealReport(h);
    await h.user.click(screen.getByRole("button", { name: "문단속 5" }));
    expect(h1().textContent).toBe("문단속 5");
    expect(screen.getByText("열려 있는 리포트가 있습니다")).toBeInTheDocument();
    await h.user.click(screen.getByRole("button", { name: "리포트로 돌아가기" }));
    expect(h1().textContent).toBe("리포트");
  });
});

describe("V1 수집 준비", () => {
  async function toPrep(h: ReturnType<typeof mount>): Promise<void> {
    await h.user.click(screen.getByRole("button", { name: "AWS 점검 시작" }));
  }
  it("방법 ② 기본: 8단계 모두 · 스크립트 원문 자리 · 직접 입력 두 줄 · 복사 버튼 없음 · 쓰기 명령 없음", async () => {
    const h = mount();
    await toPrep(h);
    const main = mainEl();
    expect(screen.getByRole("radio", { name: "수집기로 한 번에 읽기" })).toBeChecked();
    for (const s of ["스크립트를 읽습니다", "확인할 해시 값을 봅니다", "실행할 권한을 정합니다", "수집기를 내려받습니다", "남은 파일을 지웁니다(선택)", "이 페이지에 결과 파일을 넣습니다"]) {
      expect(within(main).getAllByText(s).length).toBeGreaterThan(0);
    }
    const typed = Array.from(main.querySelectorAll(".cc-cmd--typed code")).map((c) => c.textContent);
    expect(typed).toEqual(["sha256sum cloudcheck-aws.sh", "bash cloudcheck-aws.sh"]);
    expect(Array.from(main.querySelectorAll("button")).filter((b) => /복사/.test(b.textContent ?? "")).length).toBe(0);
    expect(main.querySelectorAll(".cc-cmd--write").length).toBe(0);
    expect(main.querySelector("a[href]:not([target=_blank])")).toBeNull();
  });
  it("예상 호출 표는 호출 카탈로그 그대로(AWS 26종, 보고서 생성 요청 1건)", async () => {
    const h = mount();
    await toPrep(h);
    const rows = mainEl().querySelectorAll(".cc-fp tbody tr");
    expect(rows.length).toBe(26);
    expect(mainEl().querySelectorAll(".cc-fp__w").length).toBe(1);
    expect(mainEl().textContent).toContain("iam:GenerateCredentialReport");
  });
  it("순서 버튼은 해당 단계 제목으로 포커스를 옮긴다(해시 불변)", async () => {
    const h = mount();
    await toPrep(h);
    const nav = screen.getByRole("navigation", { name: "순서" });
    await h.user.click(within(nav).getByRole("button", { name: "수집기를 내려받습니다" }));
    expect(document.activeElement?.tagName).toBe("H2");
    expect(document.activeElement?.textContent).toBe("수집기를 내려받습니다");
    expect(window.location.hash).toBe("");
  });
  it("수집기 원문·메타가 데이터 블록에 있으면 해시를 8묶음으로 보이고 내려받기 버튼이 나온다. 없으면 '준비 중'", async () => {
    const h = mount();
    await toPrep(h);
    expect(mainEl().querySelector(".cc-hash")).toBeNull();
    expect(screen.queryByRole("button", { name: "수집기 내려받기" })).toBeNull();
    cleanup();
    const sha = "ab".repeat(32);
    document.body.insertAdjacentHTML(
      "beforeend",
      `<script type="text/plain" id="cc-collector-aws">#!/usr/bin/env bash\n# @cc:section mfa-key — x\necho hi\n</script><script type="application/json" id="cc-collectors">${JSON.stringify({ aws: { file: "cloudcheck-aws.sh", bytes: 56, sha256: sha }, azure: null })}</script>`,
    );
    const h2 = mount();
    await toPrep(h2);
    expect(mainEl().querySelectorAll(".cc-hash__g").length).toBe(8);
    expect(mainEl().querySelector(".cc-hash")?.textContent).toBe(sha);
    expect(screen.getByRole("button", { name: "수집기 내려받기" })).toBeInTheDocument();
    expect(mainEl().querySelector(".cc-sv")).not.toBeNull();
    document.querySelectorAll('script[id^="cc-collector"]').forEach((el) => el.remove());
  });
  it("Blob 내려받기: 원문 바이트로 시작하고 성공 낭독, 실패하면 안내", async () => {
    document.body.insertAdjacentHTML("beforeend", `<script type="text/plain" id="cc-collector-aws">echo hi\n</script>`);
    const created: Blob[] = [];
    URL.createObjectURL = vi.fn((b: Blob) => {
      created.push(b);
      return "blob:x";
    });
    URL.revokeObjectURL = vi.fn();
    const names: string[] = [];
    const click = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function (this: HTMLAnchorElement) {
      names.push(this.download);
    });
    const h = mount();
    await toPrep(h);
    await h.user.click(screen.getByRole("button", { name: "수집기 내려받기" }));
    expect(click).toHaveBeenCalled();
    expect(await readBlob(created[0] as Blob)).toBe("echo hi\n");
    // STEP 6 최종 리뷰 §2-3: text/plain이면 Safari가 '.sh.txt'로 저장해 안내한 두 줄이 실패한다 → octet-stream, 이름 = 셸에 입력하는 두 줄의 파일 이름
    expect(created[0]?.type).toBe("application/octet-stream");
    expect(names).toEqual(["cloudcheck-aws.sh"]);
    expect(mainEl().textContent).toContain("sha256sum cloudcheck-aws.sh");
    expect(mainEl().textContent).toContain("bash cloudcheck-aws.sh");
    expect(screen.getAllByRole("status")[0]?.textContent).toBe("내려받기를 시작했습니다. 브라우저의 다운로드 목록에서 확인하세요.");
    click.mockImplementation(() => {
      throw new Error("blocked");
    });
    await h.user.click(screen.getByRole("button", { name: "수집기 내려받기" }));
    expect(within(mainEl()).getByText(/내려받기가 시작되지 않았습니다/)).toBeInTheDocument();
    expect(screen.getAllByRole("status")[0]?.textContent).toContain("내려받기가 시작되지 않았습니다");
    document.querySelectorAll('script[id^="cc-collector"]').forEach((el) => el.remove());
  });
  it("방법 ①(AWS): 4단계 안내 + 한계 문구, 해시·스크립트 블록 없음", async () => {
    const h = mount();
    await toPrep(h);
    await h.user.click(screen.getByRole("radio", { name: "파일 하나만 내려받기" }));
    expect(h1().textContent).toBe("수집 준비");
    expect(screen.getByText("IAM 콘솔을 엽니다.")).toBeInTheDocument();
    expect(screen.getByText(/최대 4시간 전 상태/)).toBeInTheDocument();
    expect(mainEl().querySelector(".cc-hash")).toBeNull();
    expect(mainEl().querySelectorAll(".cc-cmd").length).toBe(0);
  });
  it("[← 처음으로] → V0", async () => {
    const h = mount();
    await toPrep(h);
    await h.user.click(screen.getByRole("button", { name: "← 처음으로" }));
    expect(h1().textContent).toBe("문단속 5");
  });
  it("ClickFix 교육 카드 + DocLink(www.helpnetsecurity.com, 새 탭, rel)", async () => {
    const h = mount();
    await toPrep(h);
    const link = screen.getByRole("link", { name: /ClickFix 설명 보기/ });
    expect(link).toHaveAttribute("target", "_blank");
    expect(link.getAttribute("rel")).toContain("noopener");
    expect(link.getAttribute("rel")).toContain("noreferrer");
    expect(link.textContent).toContain("www.helpnetsecurity.com");
  });
  it("글자 점검: ⟦⟧ 0 · 금지어 0", async () => {
    const h = mount();
    await toPrep(h);
    expect(missingKeys(visibleText())).toEqual([]);
    expect(bannedHits(visibleText())).toEqual([]);
  });
});

describe("V2 결과 파일 넣기", () => {
  async function toInput(h: ReturnType<typeof mount>): Promise<void> {
    await h.user.click(screen.getByRole("button", { name: "결과 파일이 이미 있어요" }));
  }
  it("빈 상태: 읽은 파일 없음 · CTA는 aria-disabled + 이유 글자 · 첫 탭은 '파일 놓기'", async () => {
    const h = mount();
    await toInput(h);
    expect(h1().textContent).toBe("결과 파일 넣기");
    expect(screen.getByText("아직 읽은 파일이 없습니다.")).toBeInTheDocument();
    const cta = screen.getByRole("button", { name: "이 계정으로 리포트 보기" });
    expect(cta).toHaveAttribute("aria-disabled", "true");
    expect(screen.getByText("읽을 수 있는 파일이 없습니다.")).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "파일 놓기" })).toHaveAttribute("aria-selected", "true");
    expect(document.getElementById("cc-panel-file")).toBeVisible();
    expect(document.getElementById("cc-panel-paste")).not.toBeVisible();
  });
  it("무전송 약속 + 고지가 드롭존 아래에 있다(G-D19)", async () => {
    const h = mount();
    await toInput(h);
    expect(screen.getByText(/올린 파일을 어디로도 보내지 않습니다/)).toBeInTheDocument();
    expect(screen.getByText(/브라우저 확장 프로그램, 자동 번역/)).toBeInTheDocument();
  });
  it("파일을 고르면 목록 한 줄 + 계정 확인 줄 + 볼 수 있는 곳 + CTA 활성, 낭독 '파일 1개를 읽었습니다.'", async () => {
    const h = mount();
    await toInput(h);
    await uploadFiles(h, [jsonFile("result.json")]);
    await waitFor(() => expect(screen.getAllByRole("table")[0]).toBeInTheDocument());
    const table = screen.getAllByRole("table")[0] as HTMLElement;
    expect(within(table).getByText("읽었습니다")).toBeInTheDocument();
    expect(screen.getByText(/위 계정이 점검하려던 계정이 맞는지 확인하세요/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "이 계정으로 리포트 보기" })).not.toHaveAttribute("aria-disabled", "true");
    expect(screen.getAllByRole("status")[0]?.textContent).toBe("파일 1개를 읽었습니다.");
  });
  it("읽지 못한 파일은 행 아래 확인 불가 톤 패널(도형 없음)이고 리포트를 만들지 않는다", async () => {
    const h = mount();
    await toInput(h);
    await uploadFiles(h, [jsonFile("cut.json")]);
    await waitFor(() => expect(mainEl().querySelector(".cc-untone")).not.toBeNull());
    expect(mainEl().querySelector(".cc-untone svg")).toBeNull();
    expect(screen.getByRole("button", { name: "이 계정으로 리포트 보기" })).toHaveAttribute("aria-disabled", "true");
    await h.user.click(screen.getByRole("button", { name: "이 계정으로 리포트 보기" }));
    expect(h1().textContent).toBe("결과 파일 넣기");
  });
  it("키 파일은 거부하고 assertive로 알린다", async () => {
    const h = mount();
    await toInput(h);
    await uploadFiles(h, [jsonFile("credentials.json")]);
    await waitFor(() => expect(screen.getAllByRole("alert")[0]?.textContent).not.toBe(""));
    expect(screen.getByRole("button", { name: "이 계정으로 리포트 보기" })).toHaveAttribute("aria-disabled", "true");
  });
  it("다른 계정의 파일이 섞이면 버튼을 막고 이유 글자(cc.input.mixed)를 보인다. [빼기]로 풀린다", async () => {
    const h = mount();
    await toInput(h);
    await uploadFiles(h, [jsonFile("a.json"), jsonFile("other.json")]);
    await waitFor(() => expect(screen.getAllByText(/다른 계정이나 다른 클라우드의 파일이 섞여 있습니다/).length).toBeGreaterThan(0));
    expect(screen.getByRole("button", { name: "이 계정으로 리포트 보기" })).toHaveAttribute("aria-disabled", "true");
    const removes = screen.getAllByRole("button", { name: /빼기/ });
    await h.user.click(removes[removes.length - 1] as HTMLElement);
    await waitFor(() => expect(screen.getByRole("button", { name: "이 계정으로 리포트 보기" })).not.toHaveAttribute("aria-disabled", "true"));
    expect(screen.getAllByRole("status")[0]?.textContent).toBe("2번째 파일을 뺐습니다.");
  });
  it("붙여넣기 탭: 입력칸은 값을 보관하지 않고 바로 읽는다 · 7속성(G-D10)", async () => {
    const h = mount();
    await toInput(h);
    await h.user.click(screen.getByRole("tab", { name: "붙여넣기" }));
    expect(document.getElementById("cc-panel-paste")).toBeVisible();
    const box = document.querySelector("textarea") as HTMLTextAreaElement;
    for (const [k, v] of [["spellcheck", "false"], ["autocomplete", "off"], ["autocorrect", "off"], ["autocapitalize", "off"], ["data-gramm", "false"], ["data-gramm_editor", "false"], ["data-enable-grammarly", "false"]] as const) {
      expect(box.getAttribute(k)).toBe(v);
    }
    box.focus();
    await h.user.paste("{}");
    expect(box.value).toBe("");
    await waitFor(() => expect(screen.getAllByRole("table")[0]).toBeInTheDocument());
    expect(screen.getByText(/붙여넣은 내용 1/)).toBeInTheDocument();
  });
  it("[모두 비우기] 낭독, 모든 비교 모드 문구 없음", async () => {
    const h = mount();
    await toInput(h);
    await uploadFiles(h, [jsonFile("result.json")]);
    await waitFor(() => expect(screen.getAllByRole("table")[0]).toBeInTheDocument());
    await h.user.click(screen.getByRole("button", { name: "모두 비우기" }));
    expect(screen.getByText("아직 읽은 파일이 없습니다.")).toBeInTheDocument();
    expect(screen.getAllByRole("status")[0]?.textContent).toBe("읽은 파일을 모두 비웠습니다.");
    expect(screen.queryByText(/비교 대상/)).toBeNull();
  });
  it("<main>에 translate=no (V2~V5)", async () => {
    const h = mount();
    await toInput(h);
    expect(mainEl()).toHaveAttribute("translate", "no");
  });
  it("글자 점검: ⟦⟧ 0 · 금지어 0", async () => {
    const h = mount();
    await toInput(h);
    await uploadFiles(h, [jsonFile("result.json"), jsonFile("cut.json")]);
    await waitFor(() => expect(screen.getAllByRole("table")[0]).toBeInTheDocument());
    expect(missingKeys(visibleText())).toEqual([]);
    expect(bannedHits(visibleText())).toEqual([]);
  });
});

describe("V6 체험 고르기", () => {
  it("카드 4장: 아슬아슬상회 → 반쯤본상회 → 반듯상회 → 멈춘시계상회, 세트 글자 없음, 주 버튼 없음", async () => {
    const h = mount();
    await h.user.click(screen.getByRole("button", { name: "체험 모드로 먼저 보기" }));
    expect(h1().textContent).toBe("체험 모드");
    const titles = screen.getAllByRole("heading", { level: 2 }).map((x) => x.textContent); // STEP 5: h1 바로 아래 h2(axe heading-order)
    expect(titles).toEqual(["아슬아슬상회", "반쯤본상회", "반듯상회", "멈춘시계상회"]);
    expect(mainEl().querySelectorAll(".cc-btn--primary").length).toBe(0);
    expect(visibleText()).not.toMatch(/세트\s?[ABCD]\b/);
  });
  it("체험 표식: 보라 띠 + 안쪽 프레임, 베타 띠는 없다(둘을 쌓지 않는다)", async () => {
    const h = mount();
    await h.user.click(screen.getByRole("button", { name: "체험 모드로 먼저 보기" }));
    const bands = document.querySelectorAll("aside.cc-band");
    expect(bands.length).toBe(1);
    expect(bands[0]?.className).toContain("cc-band--demo");
    expect(document.querySelector(".cc-demo-frame")).not.toBeNull();
  });
  it("클라우드 라디오는 고르기만 한다(이동 없음). Azure를 고르면 안내", async () => {
    const h = mount();
    await h.user.click(screen.getByRole("button", { name: "체험 모드로 먼저 보기" }));
    await h.user.click(screen.getByRole("radio", { name: "Azure" }));
    expect(h1().textContent).toBe("체험 모드");
    expect(screen.getByText(/Azure 실제 점검은 준비 중입니다/)).toBeInTheDocument();
  });
  it("체험 데이터가 아직 없으면 '준비 중'을 알리고 머문다", async () => {
    removeDemoBlocks();
    const h = mount();
    await h.user.click(screen.getByRole("button", { name: "체험 모드로 먼저 보기" }));
    const card = screen.getByRole("heading", { name: "아슬아슬상회" }).closest("article") as HTMLElement;
    await h.user.click(within(card).getByRole("button"));
    expect(h1().textContent).toBe("체험 모드");
    expect(screen.getAllByRole("status")[0]?.textContent).toBe("준비 중");
  });
  it("카드를 누르면 V3(체험 리포트)로: 제목 '체험 리포트 · 문단속 5', 낭독 앞에 '체험 모드입니다.'", async () => {
    installDemoBlocks();
    const h = mount();
    await h.user.click(screen.getByRole("button", { name: "체험 모드로 먼저 보기" }));
    const card = screen.getByRole("heading", { name: "아슬아슬상회" }).closest("article") as HTMLElement;
    await h.user.click(within(card).getByRole("button"));
    await waitFor(() => expect(h1().textContent).toBe("체험 리포트"));
    expect(document.title).toBe("체험 리포트 · 문단속 5");
    expect(screen.getAllByRole("status")[0]?.textContent?.startsWith("체험 모드입니다. 리포트 화면입니다.")).toBe(true);
  });
});

describe("V7 판정 규칙", () => {
  it("문 5그룹 × 점검, priority 숫자는 보이지 않고 룰 ID는 작은 글자로. 미공개 점검은 펼칠 수 없는 한 줄", async () => {
    const h = mount();
    await h.user.click(screen.getByRole("button", { name: "판정 규칙" }));
    expect(h1().textContent).toBe("판정 규칙");
    expect(document.title).toBe("판정 규칙 · 문단속 5");
    const text = visibleText();
    expect(text).toMatch(/점검 17개 \(AWS 10 · Azure 7\)/);
    expect(text).toContain("AWS-MFA-1");
    expect(text).not.toMatch(/priority|우선순위/);
    expect(screen.getByText("아직 쓰지 않는 점검입니다(실제 계정 검증 대기).")).toBeInTheDocument();
    expect(mainEl().querySelectorAll("details").length).toBeGreaterThan(5);
  });
  it("상태별 조건은 낼 수 있는 상태만, 기준값에는 공개 기준/도구 기준 칩", async () => {
    const h = mount();
    await h.user.click(screen.getByRole("button", { name: "판정 규칙" }));
    const first = mainEl().querySelector("details") as HTMLDetailsElement;
    first.open = true;
    const dts = Array.from(first.querySelectorAll(".cc-cat__dl dt")).map((d) => d.textContent);
    expect(dts.length).toBeGreaterThan(0);
    for (const d of dts) expect(["위험", "주의", "확인 불가", "이상 없음", "해당 없음"].some((s) => (d ?? "").includes(s))).toBe(true);
  });
  it("클라우드 필터: Azure만", async () => {
    const h = mount();
    await h.user.click(screen.getByRole("button", { name: "판정 규칙" }));
    await h.user.click(screen.getByRole("radio", { name: "Azure" }));
    expect(visibleText()).not.toContain("AWS-MFA-1");
    expect(visibleText()).toContain("AZ-MFA-G");
  });
  it("[← 돌아가기]는 이전 화면으로(history.back이 없으면 돌아갈 곳)", async () => {
    const h = mount({ history: { push: () => false, pushed: () => false, disabled: () => true, back: () => undefined, current: () => null, onPop: () => () => undefined } });
    await h.user.click(screen.getByRole("button", { name: "AWS 점검 시작" }));
    await h.user.click(screen.getByRole("button", { name: "판정 규칙" }));
    expect(h1().textContent).toBe("판정 규칙");
    await h.user.click(screen.getByRole("button", { name: "← 돌아가기" }));
    expect(h1().textContent).toBe("수집 준비");
  });
  it("<main>은 번역을 허용한다(V7)", async () => {
    const h = mount();
    await h.user.click(screen.getByRole("button", { name: "판정 규칙" }));
    expect(mainEl()).not.toHaveAttribute("translate");
  });
});

describe("V8 이 도구에 대해", () => {
  it("J1~J8 구성 · 허용 키 2개가 모두 이 화면에 있다 · 못 보는 것 7가지 · 못 막는 경로 4가지", async () => {
    const h = mount();
    await h.user.click(screen.getByRole("button", { name: "이 도구에 대해" }));
    expect(h1().textContent).toBe("이 도구에 대해");
    const text = visibleText();
    expect(text).toContain("보안을 보증하거나 규정 준수를 인증하지 않습니다");
    expect(text).toContain("이 도구는 보안을 보증하거나 규정 준수를 인증하지 않으며, 감사 증적을 대신하지 않습니다.");
    expect(mainEl().querySelectorAll("#cc-about-cannot-h ~ ol > li").length).toBe(7);
    expect(mainEl().querySelectorAll("#cc-about-paths-h ~ ul > li").length).toBe(4);
    expect(screen.getByText(/Lucide 아이콘\(ISC 라이선스\)/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "오프라인판 내려받기" })).toBeInTheDocument();
  });
  it("약속의 '직접 확인하는 방법 3가지 →'는 같은 화면 J2 제목으로 포커스", async () => {
    const h = mount();
    await h.user.click(screen.getByRole("button", { name: "이 도구에 대해" }));
    await h.user.click(screen.getByRole("button", { name: "직접 확인하는 방법 3가지 →" }));
    expect(document.activeElement?.textContent).toBe("직접 확인하기 3가지");
  });
  it("글자 점검: ⟦⟧ 0(C·S — 목업) · 금지어는 허용 키 두 문장을 빼고 0", async () => {
    const h = mount();
    await h.user.click(screen.getByRole("button", { name: "이 도구에 대해" }));
    expect(missingKeys(visibleText())).toEqual([]);
    expect(bannedHits(visibleText())).toEqual([]);
    expect(document.querySelectorAll(".cc-cmd--write").length).toBe(0);
  });
});
