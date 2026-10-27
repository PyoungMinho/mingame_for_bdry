// @vitest-environment jsdom
// V2 입력 부품(DropZone · InputTabs · FileRecognitionList) · V5 비교(BeforeAfterTable · IdentityCompare) · V6 체험(DemoCards · CloudRadio).
import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { Comparison, RuleId } from "../../../../lib/cloudcheck/model/report";
import { MOCK_CATALOG_BY_ID } from "../mocks/catalog";
import { MOCK_COMPARISON_OK, MOCK_COMPARISON_REFUSED } from "../mocks/extras";
import { MOCK_RECOGNITIONS, RECOG_ACCOUNT_MISMATCH, RECOG_CREDENTIALS_FILE, RECOG_OK_AWS, RECOG_OK_PASTE, RECOG_PARSE_ERROR, RECOG_SUPERSEDED } from "../mocks/inputs";
import { BeforeAfterTable, IdentityCompare, itemsDiffText } from "./Compare";
import { CloudRadio, DemoCards } from "./Demo";
import { filesFromDrop, DropZone, InputTabs } from "./DropZone";
import { FileRecognitionList } from "./FileRecognitionList";
import { distOf } from "../mocks/build";
import { attrValues, classTokens, unexpectedMissing } from "./__tests__/render";

describe("DropZone", () => {
  it("[파일 고르기] 버튼이 항상 보이고 숨은 파일 입력(multiple, .json/.csv)을 연다 — 같은 파일을 다시 골라도 change가 나도록 값을 비운다", () => {
    const onFiles = vi.fn();
    const { container } = render(<DropZone onFiles={onFiles} busy={false} />);
    const input = container.querySelector("input[type='file']") as HTMLInputElement;
    expect(input.multiple).toBe(true);
    expect(input.getAttribute("accept")).toBe(".json,.csv");
    expect(input.classList.contains("cc-vh")).toBe(true);
    expect(input.getAttribute("aria-hidden")).toBe("true");
    const click = vi.spyOn(input, "click");
    fireEvent.click(screen.getByRole("button", { name: "파일 고르기" }));
    expect(click).toHaveBeenCalledTimes(1);
    const f1 = new File(["{}"], "a.json");
    const f2 = new File(["x"], "b.csv");
    fireEvent.change(input, { target: { files: [f1, f2] } });
    expect(onFiles).toHaveBeenCalledWith([f1, f2]);
    expect(unexpectedMissing(container)).toEqual([]);
  });

  it("안내: 놓거나 고르세요 + 지원 형식 + JSON 25MB·CSV 20MB, 읽는 중이면 aria-busy", () => {
    const { container, rerender } = render(<DropZone onFiles={vi.fn()} busy={false} />);
    expect(container.textContent).toContain("결과 파일을 여기에 놓거나, 아래 버튼으로 고르세요");
    expect(container.textContent).toContain("JSON은 25MB, CSV는 20MB까지 읽습니다.");
    expect(container.querySelector(".cc-drop")?.getAttribute("aria-busy")).toBe("false");
    rerender(<DropZone onFiles={vi.fn()} busy />);
    expect(container.querySelector(".cc-drop")?.getAttribute("aria-busy")).toBe("true");
  });

  it("끌어 올리면 .cc-drop--over + '놓으면 읽습니다', 벗어나면 해제, 놓으면 파일을 읽고 창 전체 드롭으로 번지지 않는다", () => {
    const onFiles = vi.fn();
    const windowDrop = vi.fn();
    window.addEventListener("drop", windowDrop);
    const { container } = render(<DropZone onFiles={onFiles} busy={false} />);
    const zone = container.querySelector(".cc-drop") as HTMLElement;
    fireEvent.dragEnter(zone);
    expect(zone.classList.contains("cc-drop--over")).toBe(true);
    expect(zone.textContent).toContain("놓으면 읽습니다");
    fireEvent.dragLeave(zone, { relatedTarget: document.body });
    expect(zone.classList.contains("cc-drop--over")).toBe(false);
    const f = new File(["{}"], "dropped.json");
    fireEvent.drop(zone, { dataTransfer: { files: [f], items: [] } });
    expect(onFiles).toHaveBeenCalledWith([f]);
    expect(windowDrop).not.toHaveBeenCalled();
    window.removeEventListener("drop", windowDrop);
  });

  it("폴더는 읽지 않는다 — 폴더가 섞이면 onFolder, files에서는 뺀다(webkitGetAsEntry)", () => {
    const file = new File(["x"], "ok.json");
    const items = [
      { kind: "file", webkitGetAsEntry: () => ({ isDirectory: true }), getAsFile: () => new File([], "dir") },
      { kind: "file", webkitGetAsEntry: () => ({ isDirectory: false }), getAsFile: () => file },
    ];
    expect(filesFromDrop({ items, files: [] } as unknown as DataTransfer)).toEqual({ files: [file], folders: 1 });
    expect(filesFromDrop({ items: [], files: [file] } as unknown as DataTransfer)).toEqual({ files: [file], folders: 0 });
    const onFiles = vi.fn();
    const onFolder = vi.fn();
    const { container } = render(<DropZone onFiles={onFiles} busy={false} onFolder={onFolder} />);
    fireEvent.drop(container.querySelector(".cc-drop") as HTMLElement, { dataTransfer: { items, files: [] } });
    expect(onFolder).toHaveBeenCalledTimes(1);
    expect(onFiles).toHaveBeenCalledWith([file]);
  });
});

describe("InputTabs", () => {
  it("tablist 하나, 선택된 탭만 tabIndex 0, aria-selected·aria-controls(패널 id 규칙)", () => {
    render(<InputTabs value="file" onChange={vi.fn()} />);
    const tabs = screen.getAllByRole("tab");
    expect(tabs.map((t) => t.textContent?.length).every((n) => (n ?? 0) > 0)).toBe(true);
    expect(tabs.map((t) => t.getAttribute("aria-selected"))).toEqual(["true", "false"]);
    expect(tabs.map((t) => t.tabIndex)).toEqual([0, -1]);
    expect(tabs.map((t) => t.id)).toEqual(["cc-tab-file", "cc-tab-paste"]);
    expect(tabs.map((t) => t.getAttribute("aria-controls"))).toEqual(["cc-panel-file", "cc-panel-paste"]);
  });
  it("화살표 키·Home·End로 이동(순환) + 선택된 탭에 포커스, 클릭도 onChange", () => {
    const onChange = vi.fn();
    render(<InputTabs value="file" onChange={onChange} />);
    const [file, paste] = screen.getAllByRole("tab") as [HTMLElement, HTMLElement];
    fireEvent.keyDown(file, { key: "ArrowRight" });
    expect(onChange).toHaveBeenLastCalledWith("paste");
    expect(document.activeElement).toBe(paste);
    fireEvent.keyDown(paste, { key: "ArrowRight" });
    expect(onChange).toHaveBeenLastCalledWith("file");
    fireEvent.keyDown(file, { key: "ArrowLeft" });
    expect(onChange).toHaveBeenLastCalledWith("paste");
    fireEvent.keyDown(paste, { key: "Home" });
    expect(onChange).toHaveBeenLastCalledWith("file");
    fireEvent.keyDown(file, { key: "End" });
    expect(onChange).toHaveBeenLastCalledWith("paste");
    fireEvent.click(paste);
    expect(onChange).toHaveBeenLastCalledWith("paste");
  });
});

describe("FileRecognitionList", () => {
  it("rowNote(선택): 읽은 줄 바로 아래 안내 한 줄(7열 합침) — 읽지 못한 줄에는 부르지 않는다, 없으면 줄 없음", () => {
    const seen: string[] = [];
    const { container } = render(
      <FileRecognitionList recs={[RECOG_OK_AWS, RECOG_PARSE_ERROR]} onRemove={vi.fn()} compareLast4={null} rowNote={(rec) => { seen.push(rec.status); return "안내 한 줄"; }} />,
    );
    expect(seen).toEqual(["ok"]);
    const rows = Array.from(container.querySelectorAll("tbody > tr"));
    // 읽은 줄 → 안내 줄 → 읽지 못한 줄 → 실패 패널
    expect(rows[1]?.querySelector("td")?.getAttribute("colspan")).toBe("7");
    expect(rows[1]?.textContent).toBe("안내 한 줄");
    const none = render(<FileRecognitionList recs={[RECOG_OK_AWS]} onRemove={vi.fn()} compareLast4={null} rowNote={() => null} />);
    expect(none.container.querySelectorAll("tbody > tr")).toHaveLength(1);
  });
  it("빈 목록: '아직 읽은 파일이 없습니다.', 표 없음", () => {
    const { container } = render(<FileRecognitionList recs={[]} onRemove={vi.fn()} compareLast4={null} />);
    expect(container.textContent).toContain("아직 읽은 파일이 없습니다.");
    expect(container.querySelector("table")).toBeNull();
  });

  it("열 7개, 정상 행: 이름(MaskedValue) · 종류 · 계정(별칭 ••••끝4자리) · 수집 시각(KST) · 담긴 곳 · '읽었습니다'(무채색 글자) · [빼기]", () => {
    const onRemove = vi.fn();
    const { container } = render(<FileRecognitionList recs={[RECOG_OK_AWS]} onRemove={onRemove} compareLast4={null} />);
    expect(container.querySelectorAll("thead th")).toHaveLength(7);
    const row = container.querySelector("tbody > tr") as HTMLElement;
    expect(row.querySelector(".cc-mask-full")?.textContent).toBe("cloudcheck-result.json");
    expect(row.textContent).toContain("수집기 결과(JSON)");
    expect(row.textContent).toContain("halfseen-prod");
    expect(row.textContent).toContain("••••3333");
    expect(row.textContent).toContain("2026-10-19 12:12 KST (03:12 UTC)");
    expect(row.textContent).toContain("현관 열쇠 창문 창고");
    expect(row.textContent).toContain("읽었습니다");
    expect(row.querySelector(".cc-sb, .cc-si")).toBeNull(); // 정상 행에 상태 도형·초록 없음
    expect(container.querySelectorAll("tbody > tr")).toHaveLength(1); // 실패 패널 줄 없음
    fireEvent.click(within(row).getByRole("button", { name: /빼기/ }));
    expect(onRemove).toHaveBeenCalledWith(0);
    expect(unexpectedMissing(container)).toEqual([]);
  });

  it("[빼기]의 접근 이름 = 버튼 글자 + 파일 이름(aria-labelledby — 이름을 속성에 넣지 않는다)", () => {
    const { container } = render(<FileRecognitionList recs={[RECOG_OK_AWS]} onRemove={vi.fn()} compareLast4={null} />);
    const btn = container.querySelector("button") as HTMLElement;
    const ids = (btn.getAttribute("aria-labelledby") ?? "").split(" ");
    expect(ids[0]).toBe(btn.id);
    expect(document.getElementById(ids[1] ?? "")?.textContent).toContain("cloudcheck-result.json");
    expect(attrValues(container).some((a) => a.includes("cloudcheck-result.json"))).toBe(false);
  });

  it("붙여넣기 입력은 '붙여넣은 내용 n'(번호)", () => {
    const { container } = render(<FileRecognitionList recs={[RECOG_OK_AWS, RECOG_OK_PASTE]} onRemove={vi.fn()} compareLast4={null} />);
    expect(container.querySelectorAll("tbody > tr")[1]?.textContent).toContain("붙여넣은 내용 2");
  });

  it("실패 행: 아래 줄에 확인 불가 톤 패널(도형·'확인 불가' 글자 없음) — 제목 · 이유 · 이런 경우가 많습니다 · 다음 행동", () => {
    const { container } = render(<FileRecognitionList recs={[RECOG_PARSE_ERROR]} onRemove={vi.fn()} compareLast4={null} />);
    const panel = container.querySelector(".cc-untone") as HTMLElement;
    expect(panel).not.toBeNull();
    expect(panel.classList.contains("cc-hatch")).toBe(true);
    expect(panel.querySelector("svg")).toBeNull();
    expect(panel.querySelector(".cc-sb")).toBeNull();
    expect(panel.textContent).not.toContain("확인 불가");
    expect(panel.textContent).toContain("이런 경우가 많습니다");
    expect(panel.textContent).toContain("다음 행동");
    // 잘림 진단에는 입력 끝 40자(MaskedValue) — 속성에는 없다
    expect(attrValues(container).some((a) => a.includes('"region":"ap-northeast-2"'))).toBe(false);
  });

  it("상태 12종 + ok 변형 전부 렌더: 실패 행마다 패널 1개, 카탈로그 키 누락 0(E 제외), 속성에 파일 이름 0", () => {
    const { container } = render(<FileRecognitionList recs={MOCK_RECOGNITIONS} onRemove={vi.fn()} compareLast4="3333" />);
    const bad = MOCK_RECOGNITIONS.filter((r) => r.status !== "ok");
    expect(container.querySelectorAll(".cc-untone")).toHaveLength(bad.length);
    expect(unexpectedMissing(container)).toEqual([]);
    for (const r of MOCK_RECOGNITIONS) if (r.via === "file" && r.name.kind === "sensitive") expect(attrValues(container).some((a) => a.includes((r.name as { full: string }).full))).toBe(false);
    expect(classTokens(container).filter((c) => !c.startsWith("cc-"))).toEqual([]);
  });

  it("superseded 행은 cc-fr__row--superseded(글자 한 단계 흐림), 키 파일 거부 행도 같은 패널", () => {
    const { container } = render(<FileRecognitionList recs={[RECOG_SUPERSEDED, RECOG_CREDENTIALS_FILE]} onRemove={vi.fn()} compareLast4={null} />);
    expect(container.querySelectorAll("tr.cc-fr__row--superseded")).toHaveLength(1);
    expect(container.querySelectorAll(".cc-untone")).toHaveLength(2);
  });

  it("비교 모드: 계정 칸에 '비교 대상과 같은/다른 계정입니다'", () => {
    const { container } = render(<FileRecognitionList recs={[RECOG_OK_AWS, RECOG_ACCOUNT_MISMATCH]} onRemove={vi.fn()} compareLast4="3333" />);
    const rows = container.querySelectorAll("tbody > tr.cc-fr__row");
    expect(rows[0]?.textContent).toContain("비교 대상과 같은 계정입니다");
    expect(rows[1]?.textContent).toContain("비교 대상과 다른 계정입니다");
    const normal = render(<FileRecognitionList recs={[RECOG_OK_AWS]} onRemove={vi.fn()} compareLast4={null} />);
    expect(normal.container.textContent).not.toContain("비교 대상과");
  });
});

describe("BeforeAfterTable", () => {
  const ok = MOCK_COMPARISON_OK as Extract<Comparison, { ok: true }>;

  it("itemsDiffText: 값이 다른 상태만 STATUS_ORDER 순 최대 3개, 없으면 '대상 분포 그대로', 비율·퍼센트 없음", () => {
    expect(itemsDiffText(distOf(["risk", "risk", "caution", "clear"]), distOf(["unknown", "clear"]))).toBe("위험 2 → 0 · 주의 1 → 0 · 확인 불가 0 → 1");
    expect(itemsDiffText(distOf(["clear"]), distOf(["clear"]))).toBe("대상 분포 그대로");
    expect(itemsDiffText(distOf(["risk", "caution", "unknown", "clear", "na"]), distOf([]))).toBe("위험 1 → 0 · 주의 1 → 0 · 확인 불가 1 → 0");
    expect(itemsDiffText(distOf(["risk"]), distOf([]))).not.toMatch(/%|점수|개선/);
  });

  it("묶음 순서: 이번에는 확인 불가가 된 점검 → 심각도 높아짐 → 낮아짐 → 확인 불가에서 벗어남 → 그대로(접힘)", () => {
    const { container } = render(<BeforeAfterTable cmp={ok} catalog={MOCK_CATALOG_BY_ID} />);
    const groups = Array.from(container.querySelectorAll("tbody th[scope='rowgroup']")).map((t) => t.textContent);
    expect(groups).toEqual(["이번에는 확인 불가가 된 점검", "심각도가 높아진 점검", "심각도가 낮아진 점검", "확인 불가에서 벗어난 점검"]);
    const sameBtn = screen.getByRole("button", { name: /그대로 \d+개/ });
    expect(sameBtn.textContent).toContain("그대로 2개");
    expect(sameBtn.getAttribute("aria-expanded")).toBe("false");
    const sameBody = document.getElementById(sameBtn.getAttribute("aria-controls") ?? "") as HTMLElement;
    expect(sameBody.tagName).toBe("TBODY");
    expect(sameBody.classList.contains("cc-open")).toBe(false);
    expect(sameBody.querySelectorAll("tr")).toHaveLength(2);
    fireEvent.click(sameBtn);
    expect(sameBody.classList.contains("cc-open")).toBe(true);
  });

  it("became-unknown은 변화 칸 Chip--strong + 강조 줄(고쳐서 사라진 것이 아니다), became-known에도 줄", () => {
    const { container } = render(<BeforeAfterTable cmp={ok} catalog={MOCK_CATALOG_BY_ID} />);
    const unknownRow = Array.from(container.querySelectorAll("tbody tr")).find((tr) => tr.querySelector(".cc-chip--strong")) as HTMLElement;
    expect(unknownRow.querySelector(".cc-chip--strong")?.textContent).toBe("이번에는 확인 불가");
    expect(container.querySelectorAll("td.cc-ba__note")).toHaveLength(2);
    const notes = Array.from(container.querySelectorAll("td.cc-ba__note")).map((n) => n.textContent ?? "");
    expect(notes.every((n) => n.length > 0)).toBe(true);
  });

  it("행: 이전·이번 상태 글자(StatusBadge sm) + 변화 글자 + 대상 숫자 변화, 바뀐 행만 cc-ba__chg, 표 role·data-label", () => {
    const { container } = render(<BeforeAfterTable cmp={ok} catalog={MOCK_CATALOG_BY_ID} />);
    const worse = Array.from(container.querySelectorAll("tbody tr")).find((tr) => tr.textContent?.includes("심각도 높아짐") && tr.querySelector("td")) as HTMLElement;
    expect(Array.from(worse.querySelectorAll(".cc-sb"), (b) => b.textContent)).toEqual(["이상 없음", "주의"]);
    expect(worse.classList.contains("cc-ba__chg")).toBe(true);
    expect(worse.textContent).toContain("주의 0 → 1");
    const same = Array.from(container.querySelectorAll("tbody tr")).filter((tr) => tr.textContent?.includes("대상 분포 그대로"));
    expect(same.length).toBeGreaterThan(0);
    for (const tr of same) expect(tr.classList.contains("cc-ba__chg")).toBe(false);
    expect(container.querySelector("table")?.getAttribute("role")).toBe("table");
    expect(container.querySelectorAll("tbody tr td:not([data-label]):not([colspan])")).toHaveLength(0);
    expect(unexpectedMissing(container)).toEqual([]);
    expect(container.textContent).not.toMatch(/%|점수|개선율|좋아졌/);
  });

  it("변화가 없는 묶음은 그리지 않는다", () => {
    const only: Extract<Comparison, { ok: true }> = { ...ok, rules: ok.rules.filter((r) => r.change === "worse") };
    const { container } = render(<BeforeAfterTable cmp={only} catalog={MOCK_CATALOG_BY_ID} />);
    expect(container.querySelectorAll("tbody th[scope='rowgroup']")).toHaveLength(1);
    expect(screen.queryByRole("button")).toBeNull();
  });

  it("카탈로그에 없는 점검도 점검 ID 규칙의 제목 키로 그린다(문 아이콘 포함)", () => {
    const { container } = render(<BeforeAfterTable cmp={ok} catalog={new Map<RuleId, never>()} />);
    expect(container.querySelectorAll("svg.cc-di").length).toBeGreaterThan(0);
  });
});

describe("IdentityCompare", () => {
  it("같은 계정: 이전/이번 카드 두 장 + '같은 계정입니다.'", () => {
    const ok = MOCK_COMPARISON_OK as Extract<Comparison, { ok: true }>;
    const { container } = render(<IdentityCompare before={ok.before} after={ok.after} sameAccount />);
    const sides = container.querySelectorAll("section.cc-idc__side");
    expect(sides).toHaveLength(2);
    expect(Array.from(sides, (s) => s.querySelector("strong")?.textContent)).toEqual(["이전", "이번"]);
    expect(container.textContent).toContain("같은 계정입니다.");
    expect(container.querySelectorAll(".cc-idc__diff").length).toBe(1 + 1); // 수집 시각만 다르다(두 카드 모두 밑줄)
  });
  it("다른 계정: 다른 필드(끝 4자리)에 밑줄 클래스, '같은 계정입니다' 없음", () => {
    const { container } = render(<IdentityCompare before={MOCK_COMPARISON_REFUSED.before} after={MOCK_COMPARISON_REFUSED.after} sameAccount={false} />);
    expect(container.textContent).not.toContain("같은 계정입니다.");
    const sides = Array.from(container.querySelectorAll("section.cc-idc__side"));
    for (const s of sides) expect(s.querySelector(".cc-idc__diff .cc-acct")).not.toBeNull();
    expect(container.textContent).toContain("••••3333");
    expect(container.textContent).toContain("••••9999");
  });
  // STEP 7 직전 스모크(프론트팀장): 끝 4자리·별칭이 같은 다른 계정을 엔진이 different-account로 거부했는데 '같은 계정입니다.'가 함께 보였다
  it("끝 4자리·별칭이 같아도 엔진이 다른 계정이라고 하면 '같은 계정입니다'를 쓰지 않고 계정 칸에 밑줄", () => {
    const ok = MOCK_COMPARISON_OK as Extract<Comparison, { ok: true }>;
    const { container } = render(<IdentityCompare before={ok.before} after={{ ...ok.before, asOf: ok.after.asOf }} sameAccount={false} />);
    expect(container.textContent).not.toContain("같은 계정입니다.");
    for (const s of Array.from(container.querySelectorAll("section.cc-idc__side"))) expect(s.querySelector(".cc-idc__diff .cc-acct")).not.toBeNull();
  });
});

describe("DemoCards · CloudRadio", () => {
  it("카드 4장을 C → D → A → B 순서로, 세트 글자(A~D)는 화면에 쓰지 않는다 — 카드마다 h2 + 보조 버튼 하나(주 버튼 없음)", () => {
    const onOpen = vi.fn();
    const { container } = render(<DemoCards cloud="aws" onOpen={onOpen} />);
    const cards = Array.from(container.querySelectorAll("article.cc-card"));
    expect(cards).toHaveLength(4);
    expect(container.querySelector(".cc-cards--4")).not.toBeNull();
    for (const c of cards) {
      expect(c.querySelectorAll("h2")).toHaveLength(1); // STEP 5: V6 h1 바로 아래(axe heading-order)
      expect(c.querySelectorAll("button")).toHaveLength(1);
      expect(c.querySelector("button.cc-btn--primary")).toBeNull();
    }
    const buttons = screen.getAllByRole("button");
    for (const [i, set] of (["C", "D", "A", "B"] as const).entries()) {
      fireEvent.click(buttons[i] as HTMLElement);
      expect(onOpen).toHaveBeenLastCalledWith(set);
    }
    expect(container.textContent).not.toMatch(/세트\s?[A-D]|\b[A-D]\s?세트/);
  });
  it("버튼의 접근 이름 = '이 회사 리포트 보기' 글자 + 회사 이름(aria-labelledby)", () => {
    const { container } = render(<DemoCards cloud="aws" onOpen={vi.fn()} />);
    for (const b of Array.from(container.querySelectorAll("button"))) {
      const ids = (b.getAttribute("aria-labelledby") ?? "").split(" ");
      expect(ids[0]).toBe(b.id);
      expect(document.getElementById(ids[1] ?? "")?.tagName).toBe("H2"); // STEP 5: 카드 제목은 h2(V6 h1 바로 아래)
    }
  });
  it("고른 클라우드의 한 줄을 보인다(AWS/Azure 전환)", () => {
    const aws = render(<DemoCards cloud="aws" onOpen={vi.fn()} />);
    const azure = render(<DemoCards cloud="azure" onOpen={vi.fn()} />);
    expect(aws.container.textContent).toContain("AWS:");
    expect(azure.container.textContent).toContain("Azure:");
    expect(aws.container.textContent).not.toBe(azure.container.textContent);
  });
  it("CloudRadio: fieldset + 라디오 2개(AWS·Azure), 고르면 onChange만(이동 없음)", () => {
    const onChange = vi.fn();
    const { container } = render(<CloudRadio value="aws" onChange={onChange} />);
    expect((screen.getByLabelText("AWS") as HTMLInputElement).checked).toBe(true);
    fireEvent.click(screen.getByLabelText("Azure"));
    expect(onChange).toHaveBeenCalledWith("azure");
    expect(container.querySelector("fieldset legend")).not.toBeNull();
    expect(container.querySelector("[href]")).toBeNull();
  });
});
