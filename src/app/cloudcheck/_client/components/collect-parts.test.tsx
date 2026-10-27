// @vitest-environment jsdom
// V1 수집 준비 부품: ScriptViewer · FootprintTable · HashDisplay · PathChooser.
import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { AWS_CALLS, AZURE_CALLS } from "../../../../lib/cloudcheck/contract/calls";
import { FootprintTable } from "./FootprintTable";
import { groupsOf8, HashDisplay } from "./HashDisplay";
import { pathDoors, PathChooser } from "./PathChooser";
import { ScriptViewer, splitSections } from "./ScriptViewer";
import { classTokens, unexpectedMissing } from "./__tests__/render";

const SCRIPT = [
  "#!/usr/bin/env bash",
  "# 신원 확인 — 이 스크립트가 읽는 것",
  "aws sts get-caller-identity",
  "# ===== [mfa] 현관 =====",
  "aws iam get-credential-report",
  "",
  "# ===== [key] 열쇠 =====",
  "aws iam list-users # <script>alert(1)</script>",
  "# ===== [log] CCTV =====",
  'echo "$HOME" && cat <<EOF',
  "",
].join("\n");
const SECTION_RE = /^# =+ \[(mfa|key|net|sto|log)\]/;

describe("ScriptViewer", () => {
  it("splitSections: 표식 줄이 새 구간을 연다 — 앞부분은 신원·범위(공통), 표식의 첫 캡처가 문 ID", () => {
    const s = splitSections(SCRIPT, SECTION_RE);
    expect(s.map((x) => [x.door, x.lines.length])).toEqual([[null, 3], ["mfa", 3], ["key", 2], ["log", 2]]);
    expect(s[1]?.lines[0]).toBe("# ===== [mfa] 현관 =====");
  });
  it("표식이 없으면 전체가 한 덩어리(원문은 항상 그대로 보인다), g 플래그 정규식도 안전", () => {
    const s = splitSections("a\nb\nc\n", /^NOPE/g);
    expect(s).toHaveLength(1);
    expect(s[0]?.lines).toEqual(["a", "b", "c"]);
    expect(splitSections(SCRIPT, /^# =+ \[(mfa|key|net|sto|log)\]/g).map((x) => x.door)).toEqual([null, "mfa", "key", "log"]);
  });
  it("구간마다 <details>(V1이라 허용) + 줄마다 span.cc-sv__l, 주석 줄은 --c, 파일 이름·읽기용 안내·translate=no", () => {
    const { container } = render(<ScriptViewer fileName="cloudcheck-aws.sh" source={SCRIPT} sectionRe={SECTION_RE} />);
    expect(container.querySelector("figure.cc-sv")?.getAttribute("translate")).toBe("no");
    expect(container.querySelector(".cc-sv__bar code")?.textContent).toBe("cloudcheck-aws.sh");
    expect(container.textContent).toContain("읽기용 원문입니다. 줄 번호는 복사되지 않습니다.");
    const details = container.querySelectorAll("details.cc-sv__d");
    expect(details).toHaveLength(4);
    expect(Array.from(details).map((d) => d.querySelector("summary")?.textContent)).toEqual([
      "신원·범위 부분 — 3줄",
      "현관(MFA) 부분 — 3줄",
      "열쇠(자격증명) 부분 — 2줄",
      "CCTV(감사 로그) 부분 — 2줄",
    ]);
    expect(container.querySelectorAll(".cc-sv__l")).toHaveLength(10);
    expect(container.querySelectorAll(".cc-sv__l--c").length).toBe(SCRIPT.split("\n").filter((l) => l.trimStart().startsWith("#")).length);
    for (const pre of Array.from(container.querySelectorAll("pre"))) expect(pre.getAttribute("tabindex")).toBe("0");
    expect(unexpectedMissing(container)).toEqual([]);
  });
  it("원문은 글자로만(스크립트 태그가 든 주석도 요소가 되지 않는다), 복사에 줄 번호가 섞이지 않는다(번호는 CSS 카운터 — 텍스트에 숫자 줄 번호 없음)", () => {
    const { container } = render(<ScriptViewer fileName="x.sh" source={SCRIPT} sectionRe={SECTION_RE} />);
    expect(container.querySelector("script")).toBeNull();
    expect(container.textContent).toContain("<script>alert(1)</script>");
    const code = Array.from(container.querySelectorAll("pre code"))[1] as HTMLElement;
    // 줄 = 블록 span 하나(빈 줄은 공백 한 칸) — 줄 번호 숫자는 텍스트에 없다
    expect(Array.from(code.querySelectorAll(".cc-sv__l"), (e) => e.textContent)).toEqual(["# ===== [mfa] 현관 =====", "aws iam get-credential-report", " "]);
  });
});

describe("FootprintTable", () => {
  it("AWS: 호출 카탈로그 26행 그대로(호출·권한·쓰는 곳·단위·구분), 쓰기(보고서 생성 요청) 행은 1건뿐이고 cc-fp__w", () => {
    const { container } = render(<FootprintTable cloud="aws" />);
    const rows = container.querySelectorAll("tbody > tr");
    expect(rows).toHaveLength(Object.keys(AWS_CALLS).length);
    expect(Object.keys(AWS_CALLS)).toHaveLength(26);
    expect(Array.from(container.querySelectorAll("thead th")).map((t) => t.textContent)).toEqual(["호출", "권한", "쓰는 곳", "호출 단위", "구분"]);
    expect(container.querySelectorAll("tr.cc-fp__w")).toHaveLength(1);
    const w = container.querySelector("tr.cc-fp__w") as HTMLElement;
    expect(w.textContent).toContain("aws iam generate-credential-report");
    expect(w.textContent).toContain("보고서 생성 요청");
    const first = rows[0] as HTMLElement;
    expect(first.textContent).toContain("aws sts get-caller-identity");
    expect(first.textContent).toContain("권한 없음"); // permission: null
    expect(first.textContent).toContain("신원");
    expect(first.textContent).toContain("계정당 1회");
    expect(first.textContent).toContain("조회");
    expect(unexpectedMissing(container)).toEqual([]);
  });
  it("Azure: 9행, 쓰기 행 없음, 단위(구독마다·스토리지 계정마다·로컬 조회)", () => {
    const { container } = render(<FootprintTable cloud="azure" />);
    expect(container.querySelectorAll("tbody > tr")).toHaveLength(Object.keys(AZURE_CALLS).length);
    expect(container.querySelectorAll("tr.cc-fp__w")).toHaveLength(0);
    const text = container.textContent ?? "";
    for (const u of ["구독마다", "스토리지 계정마다", "로컬 조회"]) expect(text).toContain(u);
  });
  it("표는 카드 변환 대상(cc-ct) — role·data-label 명시", () => {
    const { container } = render(<FootprintTable cloud="aws" />);
    expect(container.querySelector("table")?.classList.contains("cc-ct")).toBe(true);
    expect(container.querySelector("table")?.getAttribute("role")).toBe("table");
    expect(container.querySelectorAll("tbody td:not([data-label])")).toHaveLength(0);
    expect(classTokens(container).filter((c) => !c.startsWith("cc-"))).toEqual([]);
  });
});

describe("HashDisplay", () => {
  const HEX = "3f2a91c48b7d0e15a1b2c3d4e5f60718293a4b5c6d7e8f90a1b2c3d4e5f60718";
  it("64자를 8자리 × 8묶음(span.cc-hash__g) + <wbr> 7개, 공백 문자 없이 이어 붙으면 원본 64자", () => {
    expect(HEX).toHaveLength(64);
    expect(groupsOf8(HEX)).toHaveLength(8);
    const { container } = render(<HashDisplay hex={HEX} />);
    const code = container.querySelector("code.cc-hash") as HTMLElement;
    expect(code.querySelectorAll("span.cc-hash__g")).toHaveLength(8);
    expect(code.querySelectorAll("wbr")).toHaveLength(7);
    expect(code.textContent).toBe(HEX); // 복사하면 64자가 그대로(공백·개행 없음)
    expect(code.textContent).not.toMatch(/\s/);
    expect(code.getAttribute("translate")).toBe("no");
  });
  it("접근성: role=group + 고정 라벨 'SHA-256 해시, 64자' + 힌트 aria-describedby, tabIndex 0", () => {
    const { container } = render(<HashDisplay hex={HEX} describedBy="extra" />);
    const code = screen.getByRole("group", { name: "SHA-256 해시, 64자" });
    expect(code.getAttribute("tabindex")).toBe("0");
    const ids = (code.getAttribute("aria-describedby") ?? "").split(" ");
    expect(ids[1]).toBe("extra");
    expect(document.getElementById(ids[0] ?? "")?.textContent).toContain("전체가 선택됩니다");
    expect(container.querySelectorAll("button")).toHaveLength(0); // 복사 버튼 없음
  });
  it("키보드 포커스가 들어오면 전체 선택(Selection API) — 클립보드 API 아님", () => {
    const { container } = render(<HashDisplay hex={HEX} />);
    fireEvent.focus(container.querySelector("code") as HTMLElement);
    expect(window.getSelection()?.toString()).toBe(HEX);
  });
});

describe("PathChooser", () => {
  it("라디오 카드 2장(보이는 네이티브 라디오), 선택은 값만 바꾸고 이동하지 않는다", () => {
    const onChange = vi.fn();
    const { container } = render(<PathChooser cloud="aws" value="collector" onChange={onChange} />);
    const radios = Array.from(container.querySelectorAll("input[type='radio']")) as HTMLInputElement[];
    expect(radios.map((r) => [r.value, r.checked])).toEqual([["csv", false], ["collector", true]]);
    expect(new Set(radios.map((r) => r.name)).size).toBe(1);
    expect(radios.every((r) => !r.hidden && !r.classList.contains("cc-vh"))).toBe(true);
    const cards = container.querySelectorAll("label.cc-card.cc-card--radio");
    expect(cards).toHaveLength(2);
    expect(cards[1]?.classList.contains("cc-card--on")).toBe(true);
    fireEvent.click(radios[0] as HTMLElement);
    expect(onChange).toHaveBeenCalledWith("csv");
    expect(container.querySelector("[href]")).toBeNull();
    expect(container.querySelector("fieldset legend")).not.toBeNull();
  });
  it("접근 이름은 카드 제목만(카드 전체 글자가 이름이 되지 않는다), 나머지는 설명", () => {
    const { container } = render(<PathChooser cloud="aws" value="csv" onChange={vi.fn()} />);
    for (const r of Array.from(container.querySelectorAll("input[type='radio']"))) {
      expect(r.getAttribute("aria-labelledby")).toBeTruthy();
      expect(r.getAttribute("aria-describedby")).toBeTruthy();
      expect(document.getElementById(r.getAttribute("aria-labelledby") ?? "")?.className).toBe("cc-card__t");
    }
  });
  it("권장 칩은 수집기 카드에만(--inv), 문별 수집 줄(compact)은 5개씩", () => {
    const { container } = render(<PathChooser cloud="aws" value="collector" onChange={vi.fn()} />);
    const cards = Array.from(container.querySelectorAll("label.cc-card"));
    expect(cards[0]?.querySelector(".cc-chip--inv")).toBeNull();
    expect(cards[1]?.querySelector(".cc-chip--inv")?.textContent).toBe("권장");
    for (const c of cards) expect(c.querySelectorAll(".cc-dcr--compact > li")).toHaveLength(5);
  });
  it("경로별 문 수집 상태(상수): AWS ① = 현관·열쇠만 / Azure ① = 열쇠·창문 + 창고 일부 / ② = 다섯 곳 모두", () => {
    const st = (cloud: "aws" | "azure", p: "csv" | "collector"): string => pathDoors(cloud, p).map((r) => `${r.door}:${r.status}`).join(" ");
    expect(st("aws", "csv")).toBe("mfa:collected key:collected net:not-collected sto:not-collected log:not-collected");
    expect(st("azure", "csv")).toBe("mfa:not-collected key:collected net:collected sto:partial log:not-collected");
    expect(st("aws", "collector")).toBe("mfa:collected key:collected net:collected sto:collected log:collected");
    const { container } = render(<PathChooser cloud="aws" value="csv" onChange={vi.fn()} />);
    const first = container.querySelectorAll("label.cc-card")[0] as HTMLElement;
    expect(within(first).getAllByRole("listitem").map((li) => li.textContent)).toEqual(["현관 수집됨", "열쇠 수집됨", "창문 수집 안 함", "창고 수집 안 함", "CCTV 수집 안 함"]);
  });
  it("Azure 방법 ②에는 한계 문장이 없고, AWS ①·② 문구 키가 다르다(키 이름 기준)", () => {
    const aws = render(<PathChooser cloud="aws" value="csv" onChange={vi.fn()} />);
    const azure = render(<PathChooser cloud="azure" value="csv" onChange={vi.fn()} />);
    expect(aws.container.textContent).not.toBe(azure.container.textContent);
  });
});
