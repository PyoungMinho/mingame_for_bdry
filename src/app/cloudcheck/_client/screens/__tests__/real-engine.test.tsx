// @vitest-environment jsdom
// src/app/cloudcheck/_client/screens/__tests__/real-engine.test.tsx — 목업이 아니라 실제 파서·엔진(state/deps.real.ts)으로 같은 화면 시험을 돌린다(방향서 §3 규칙 2).
// 입력은 lib/cloudcheck/parse/testdata.ts의 수집 파일 빌더(계약을 지키는 AWS·Azure 파일). E 카탈로그(rules/i18n/ko.ts)는 D4 통합에서 i18n/index.ts에 병합됐다
// → 화면에 ⟦키⟧가 0이어야 하고, 혹시 남으면 그 키가 ENGINE_KO에 있는지도 함께 본다(missingEngineKeys).
import { cleanup, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { awsFile, azureFile, enc, reportCsv, rgStorageCsv, type Json } from "../../../../../lib/cloudcheck/parse/testdata";
import { readFileSync } from "node:fs";
import path from "node:path";
import { BLOCK, CLOUDS, DEMO_SETS } from "../../shell";
import { ENGINE_KO } from "../../../../../lib/cloudcheck/rules/i18n/ko";
import { STATUS_ORDER, type Report } from "../../../../../lib/cloudcheck/model/report";
import { DOM_ID } from "../../components/dom-ids";
import { engineCatalogMerged } from "../../i18n/index";
import { REAL_DEPS } from "../../state/deps.real";
import { h1, mainEl, mount, uploadFiles, visibleText, type Harness } from "./harness";

const textFile = (name: string, body: string | Json): File => new File([typeof body === "string" ? body : JSON.stringify(body)], name, { type: "application/json" });
const awsPlain = (): File => textFile("cloudcheck-aws-result.json", awsFile().file);
const awsAfter = (): File =>
  textFile("cloudcheck-aws-after.json", awsFile({ mutate: (f) => { f.collectedAt = "2026-10-26T03:12:00Z"; f.run.finishedAt = "2026-10-26T03:12:00Z"; } }).file);

async function open(h: Harness, files: File[]): Promise<void> {
  await h.user.click(screen.getByRole("button", { name: "결과 파일이 이미 있어요" }));
  await uploadFiles(h, files);
  await waitFor(() => expect(screen.getAllByRole("table")[0]).toBeInTheDocument());
}
async function toReport(h: Harness, files: File[] = [awsPlain()]): Promise<void> {
  await open(h, files);
  await h.user.click(screen.getByRole("button", { name: "이 계정으로 리포트 보기" }));
  await waitFor(() => expect(h1().textContent).toBe("리포트"));
}
/** 시계를 고정한다: 수집 파일(2026-10-19 03:12Z)에서 8일 뒤 — 오래된 수집 안내(timeNotices)가 붙는 날이고, 실제 날짜가 흘러도 결과가 같다 */
const CLOCK = { now: () => "2026-10-27T05:00:00Z" as never, today: () => "2026-10-27" as never };
const mk = (): Harness => mount({ deps: REAL_DEPS, clock: CLOCK });
/** Azure 실제 점검을 연 공개 상태(운영 기본값은 Azure '준비 중' — STEP 5 결정 §8-A로 V2가 실제 Azure 입력을 막는다). 실제 Azure 판정 화면을 보는 시험은 이것으로 연다 */
const AZURE_OPEN = { aws: "beta", azure: "beta" } as const;
const mkAzureOpen = (): Harness => mount({ deps: REAL_DEPS, clock: CLOCK, availability: AZURE_OPEN });
/** 화면과 같은 입력(awsPlain)으로 실제 엔진이 만든 리포트 — 기대값은 고정 수치가 아니라 이것에서 읽는다 */
function sampleReport(): Report {
  const rec = REAL_DEPS.recognize({ via: "file", name: "x.json", bytes: enc(awsFile().file), lastModified: null });
  const b = REAL_DEPS.buildInput([rec]);
  if (!b.ok) throw new Error("build");
  return REAL_DEPS.judge(b.input);
}
/** 체험 데이터 블록(생성기 jsonBlock과 같은 모양) — [Azure 체험 보기] 시험용 */
function installRealDemoBlocks(): void {
  const dir = path.resolve(__dirname, "../../../../../lib/cloudcheck/fixtures/companies");
  for (const cloud of CLOUDS) {
    for (const set of DEMO_SETS) {
      const el = document.createElement("script");
      el.type = "application/json";
      el.id = BLOCK.demo(cloud, set);
      el.textContent = JSON.stringify(JSON.parse(readFileSync(path.join(dir, `${cloud}-${set}.json`), "utf8"))).replace(/</g, "\\u003c");
      document.body.appendChild(el);
    }
  }
}
/** 화면이 그린 ⟦키⟧ 중 ENGINE_KO에 없는 것(구성요소·화면 키가 빠진 경우도 여기서 잡힌다: 그 키는 ENGINE_KO에 없다) */
function missingEngineKeys(): string[] {
  const keys = (document.body.textContent ?? "").match(/⟦[^⟧]+⟧/g) ?? [];
  return [...new Set(keys.map((k) => k.slice(1, -1)))].filter((k) => !(k in ENGINE_KO));
}
/** 화면이 그린 ⟦키⟧ 개수 — E 카탈로그가 병합 전이면 0보다 커야 위 검사가 실제로 일을 하고 있다는 뜻 */
const renderedEngineKeyCount = (): number => (document.body.textContent ?? "").match(/⟦[^⟧]+⟧/g)?.length ?? 0;

beforeEach(() => {
  window.history.replaceState(null, "");
  document.documentElement.className = "";
  Object.defineProperty(window, "scrollY", { value: 0, configurable: true });
  window.print = vi.fn();
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("실제 엔진 · V2 입력 인식", () => {
  it("수집기 결과(JSON) 한 개: 종류·계정(별칭 + 끝 4자리)·수집 시각·담긴 곳 5곳·읽었습니다", async () => {
    const h = mk();
    await open(h, [awsPlain()]);
    const table = screen.getAllByRole("table")[0] as HTMLElement;
    expect(table.textContent).toContain("수집기 결과(JSON)");
    expect(table.textContent).toContain("acme-prod");
    expect(table.textContent).toContain("••••9012");
    expect(table.textContent).toContain("2026-10-19 12:12 KST (03:12 UTC)");
    expect(table.textContent).toContain("현관 열쇠 창문 창고 CCTV");
    expect(within(table).getByText("읽었습니다")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "이 계정으로 리포트 보기" })).not.toHaveAttribute("aria-disabled", "true");
  });
  it("잘린 JSON은 읽지 못함 패널 + 리포트 없음, 키 파일은 거부 + assertive", async () => {
    const h = mk();
    await open(h, [textFile("cut.json", JSON.stringify(awsFile().file).slice(0, 400))]);
    expect(mainEl().querySelector(".cc-untone")).not.toBeNull();
    expect(screen.getByRole("button", { name: "이 계정으로 리포트 보기" })).toHaveAttribute("aria-disabled", "true");
    expect(missingEngineKeys()).toEqual([]);
    cleanup();
    const h2 = mk();
    await h2.user.click(screen.getByRole("button", { name: "결과 파일이 이미 있어요" }));
    // 파일 선택창의 accept(.json,.csv) 때문에 이름에 확장자가 있어야 user-event가 넣어 준다(드롭은 확장자와 무관)
    await uploadFiles(h2, [textFile("credentials.json", "[default]\naws_access_key_id = AKIAIOSFODNN7EXAMPLE\naws_secret_access_key = wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY\n")]);
    await waitFor(() => expect(screen.getAllByRole("alert")[0]?.textContent).not.toBe(""));
    expect(screen.getByRole("button", { name: "이 계정으로 리포트 보기" })).toHaveAttribute("aria-disabled", "true");
    expect(document.body.textContent).not.toContain("AKIAIOSFODNN7EXAMPLE");
    expect(document.body.textContent).not.toContain("wJalrXUtnFEMI");
  });
  // D4 통합(프론트팀장): InputRecognition.name·identityPreview.alias는 비밀 패턴이면 redacted DisplayValue로 온다(API설계자) → MaskedValue가 '가린 값'만 그린다
  it("비밀 패턴이 든 파일 이름·계정 별칭은 '가린 값'으로만 보이고, 원값은 화면·속성·제목 어디에도 없다(V2 → V3)", async () => {
    const SECRET_NAME = "AKIAIOSFODNN7EXAMPLE";
    // 공개 저장소 push 보호 대비(STEP 6): 완성된 토큰 모양이 소스 바이트에 남지 않게 실행 중에 조립한다 — 값은 전과 같은 40자("gh"+"p_"+36자), 시험의 뜻·기대값 그대로
    const SECRET_ALIAS = ["gh", "p_", "0123456789abcdef".repeat(2), "0123"].join("");
    const body = awsFile({ mutate: (f) => { (f as { identity: { alias: { value: string } } }).identity.alias.value = SECRET_ALIAS; } }).file;
    const rec = REAL_DEPS.recognize({ via: "file", name: `${SECRET_NAME}.json`, bytes: enc(body), lastModified: null });
    expect(rec.name).toEqual({ kind: "redacted", why: "secret-pattern" });
    expect(rec.identityPreview?.alias).toEqual({ kind: "redacted", why: "secret-pattern" });
    const h = mk();
    await open(h, [textFile(`${SECRET_NAME}.json`, body)]);
    const table = screen.getAllByRole("table")[0] as HTMLElement;
    expect(within(table).getAllByText("가린 값").length).toBeGreaterThanOrEqual(2); // 파일 이름 칸 + 계정 칸의 별칭
    const leaks = (): string[] => {
      const all = [document.title, document.body.textContent ?? "", ...Array.from(document.querySelectorAll("*")).flatMap((el) => Array.from(el.attributes).map((a) => a.value))];
      return [SECRET_NAME, SECRET_ALIAS].filter((x) => all.some((v) => v.includes(x)));
    };
    expect(leaks()).toEqual([]);
    await h.user.click(screen.getByRole("button", { name: "이 계정으로 리포트 보기" }));
    await waitFor(() => expect(h1().textContent).toBe("리포트"));
    expect(document.querySelector(".cc-ctx")?.textContent).toContain("가린 값");
    expect(document.querySelector(".cc-ctx")?.textContent).toContain("••••9012");
    expect(leaks()).toEqual([]);
  });
  it("AWS와 Azure 파일이 섞이면 클라우드 불일치로 막는다(두 신원 나란히 · 버튼 aria-disabled)", async () => {
    const h = mk();
    await open(h, [awsPlain(), textFile("cloudcheck-azure.json", azureFile().file)]);
    await waitFor(() => expect(screen.getByRole("button", { name: "이 계정으로 리포트 보기" })).toHaveAttribute("aria-disabled", "true"));
    expect(missingEngineKeys()).toEqual([]);
  });
});

describe("실제 엔진 · V3 리포트", () => {
  it("분포는 엔진이 준 점검 단위 합계 그대로, 맥락 줄에 별칭 + 끝 4자리, 문 5구역이 고정 순서", async () => {
    const h = mk();
    await toReport(h);
    const dist = Array.from(mainEl().querySelectorAll("#cc-dist-h ~ .cc-dist .cc-dc")).map((x) => x.textContent?.replace(/\s+/g, " ").trim());
    const sample = sampleReport().distribution.rules;
    const names = { risk: "위험", caution: "주의", unknown: "확인 불가", clear: "이상 없음", na: "해당 없음" } as const;
    expect(dist).toEqual(STATUS_ORDER.map((s) => `${names[s]} ${sample[s]}`));
    expect(document.querySelector(".cc-ctx")?.textContent).toContain("acme-prod");
    expect(document.querySelector(".cc-ctx")?.textContent).toContain("••••9012");
    const heads = Array.from(mainEl().querySelectorAll(".cc-door__h")).map((x) => x.textContent ?? "");
    expect(heads.map((x) => x.replace(/\s+/g, ""))).toEqual(["현관MFA", "열쇠자격증명", "창문열린포트", "창고공개저장소", "CCTV감사로그"]);
    expect(mainEl().querySelectorAll(".cc-door__head .cc-sb").length).toBe(0);
  });
  // D4 통합(프론트팀장): 수치를 고정하지 않고 엔진 출력에서 읽는다(백엔드가 testdata·룰을 바꾸면 '확인 불가 1개' 같은 고정값이 낡는다 — 2026-10-19 실제로 0개가 됐다).
  // 확인 불가가 있는 경우의 화면(직접 볼 목록 행·'아직 판단하지 못한 점검' 줄)은 체험 반쯤본상회 실물(demo-real.test.tsx)이 함께 본다.
  it("이상 없음 행은 꼬리표·'못 본 것 n', 해당 없음 행은 근거 줄, 확인 불가 수와 직접 볼 목록은 엔진 출력과 같다", async () => {
    const report = sampleReport();
    const h = mk();
    await toReport(h);
    const clearRows = Array.from(mainEl().querySelectorAll(".cc-rule.cc-st--clear"));
    expect(clearRows.length).toBe(report.distribution.rules.clear);
    expect(clearRows.length).toBeGreaterThan(0);
    for (const row of clearRows) {
      expect(row.textContent).toContain("확인한 범위");
      expect(row.textContent).toMatch(/못 본 것 \d+/);
    }
    const naRows = Array.from(mainEl().querySelectorAll(".cc-rule.cc-st--na"));
    expect(naRows.length).toBe(report.distribution.rules.na);
    for (const row of naRows) expect(row.querySelector(".cc-rule__why")?.textContent).toMatch(/^근거: \S/);
    const unknown = report.distribution.rules.unknown;
    if (unknown > 0) expect(screen.getByText(new RegExp(`아직 판단하지 못한 점검이 ${unknown}개 있습니다`))).toBeInTheDocument();
    else expect(visibleText()).not.toContain("아직 판단하지 못한 점검이");
    expect(mainEl().querySelectorAll(".cc-mc tbody tr").length > 0).toBe(report.manualChecklist.length > 0);
  });
  it("쓰기 명령은 V3에 없고(G-D13), 도형은 글자와 함께(G-D3), 전체 계정 ID는 맥락 줄·신원 줄에 없다", async () => {
    const h = mk();
    await toReport(h);
    expect(document.querySelectorAll(".cc-cmd--write").length).toBe(0);
    const words = ["위험", "주의", "확인 불가", "이상 없음", "해당 없음"];
    for (const icon of Array.from(document.querySelectorAll(".cc-si"))) {
      const host = icon.closest(".cc-sb, .cc-dc, .cc-legend");
      expect(host).not.toBeNull();
      expect(words.some((w) => host?.textContent?.includes(w))).toBe(true);
    }
    expect(document.querySelector(".cc-ctx")?.textContent).not.toContain("123456789012");
    expect(document.querySelector(".cc-scope")?.textContent).not.toContain("123456789012");
    expect(document.title).toBe("리포트 · 문단속 5");
  });
  it("화면이 그린 모든 엔진 문장 키가 ENGINE_KO에 있다(병합 뒤 ⟦⟧ 0이 되기 위한 조건)", async () => {
    const h = mk();
    await toReport(h);
    // 점검 행을 모두 펼쳐 본문(영향·질문·근거·못 보는 것)의 키도 그리게 한다
    for (const btn of Array.from(document.querySelectorAll<HTMLElement>(".cc-rule__tog"))) await h.user.click(btn);
    if (engineCatalogMerged()) expect(visibleText()).not.toContain("⟦");
    else expect(renderedEngineKeyCount()).toBeGreaterThan(20);
    expect(missingEngineKeys()).toEqual([]);
  });
  it("위험 점검의 [고치는 법] → V4: 쓰기 명령이 나오고 자리표시자 키가 ENGINE_KO에 있다", async () => {
    const h = mk();
    await toReport(h);
    await h.user.click(document.getElementById(DOM_ID.ruleFix("AWS-NET-1")) as HTMLElement);
    await waitFor(() => expect(h1().textContent).toBe("고치는 법"));
    expect(mainEl().querySelectorAll(".cc-cmd--write").length).toBeGreaterThan(0);
    expect(mainEl().querySelectorAll(".cc-ph").length).toBeGreaterThan(0);
    expect(mainEl().textContent).toContain("••••9012");
    expect(missingEngineKeys()).toEqual([]);
    expect(document.title).toMatch(/^고치는 법 · .+ · 문단속 5$/);
  });
  it("마스킹 사본: 실제 maskedCopy 결과에 원래 이름이 없다", async () => {
    const created: Blob[] = [];
    URL.createObjectURL = vi.fn((b: Blob) => {
      created.push(b);
      return "blob:r";
    });
    URL.revokeObjectURL = vi.fn();
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => undefined);
    const h = mk();
    await toReport(h);
    await h.user.click(screen.getByRole("button", { name: "마스킹 사본 저장" }));
    const text = await new Promise<string>((resolve) => {
      const r = new FileReader();
      r.onload = (): void => resolve(String(r.result));
      r.readAsText(created[0] as Blob);
    });
    expect(text.length).toBeGreaterThan(10);
    for (const secret of ["acme-prod", "acme-public-assets", "acme-prod-data", "123456789012", "jane.doe", "ci-deployer"]) expect(text).not.toContain(secret);
  });
});

describe("실제 엔진 · 예외 표시 (왕복 검사 · 상태 불변)", () => {
  it("주의 대상에 예외를 저장하면 라벨이 붙고 상태는 그대로, 내보낸 파일은 같은 파서로 다시 읽힌다", async () => {
    const created: Blob[] = [];
    URL.createObjectURL = vi.fn((b: Blob) => {
      created.push(b);
      return "blob:e";
    });
    URL.revokeObjectURL = vi.fn();
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => undefined);
    const h = mk();
    await toReport(h);
    await h.user.click(document.getElementById(DOM_ID.ruleToggle("AWS-KEY-1")) as HTMLElement);
    const row = document.getElementById(DOM_ID.rule("AWS-KEY-1")) as HTMLElement;
    const before = Array.from(row.querySelectorAll("tbody .cc-sb")).map((b) => b.textContent);
    await h.user.click(within(row).getAllByRole("button", { name: /예외로 표시/ })[0] as HTMLElement);
    await h.user.type(within(row).getByLabelText(/사유/), "배포 파이프라인 전용 키");
    await h.user.click(within(row).getByRole("button", { name: "예외로 표시하기" }));
    expect(row.querySelector(".cc-excl")?.textContent).toContain("예외 표시(상태는 그대로)");
    expect(Array.from(row.querySelectorAll("tbody .cc-sb")).map((b) => b.textContent)).toEqual(before);
    expect(screen.getByText(/예외 1건 적용/)).toBeInTheDocument();
    await h.user.click(screen.getByRole("button", { name: "예외 파일 내보내기" }));
    const text = await new Promise<string>((resolve) => {
      const r = new FileReader();
      r.onload = (): void => resolve(String(r.result));
      r.readAsText(created[0] as Blob);
    });
    const parsed = REAL_DEPS.parseExceptions(text);
    expect(parsed.ok).toBe(true);
    if (parsed.ok) {
      expect(parsed.file.entries).toHaveLength(1);
      expect(parsed.file.entries[0]?.ruleId).toBe("AWS-KEY-1");
      expect(parsed.file.entries[0]?.resource).toContain("|aws|".replace("|aws|", "aws|"));
    }
  });
});

describe("실제 엔진 · V5 재점검 비교", () => {
  it("같은 계정의 나중 파일이면 비교가 되고, 같은 파일이면 '같은 수집 결과'로 거부한다", async () => {
    const h = mk();
    await toReport(h);
    await h.user.click(screen.getByRole("button", { name: "다시 수집한 파일과 비교" }));
    await waitFor(() => expect(h1().textContent).toBe("결과 파일 넣기"));
    await uploadFiles(h, [awsAfter()]);
    await waitFor(() => expect(screen.getAllByRole("table")[0]).toBeInTheDocument());
    await h.user.click(screen.getByRole("button", { name: "비교 보기" }));
    await waitFor(() => expect(h1().textContent).toBe("재점검 비교"));
    expect(mainEl().textContent).toContain("••••9012");
    expect(missingEngineKeys()).toEqual([]);
    await h.user.click(screen.getByRole("button", { name: "이번 리포트 보기" }));
    expect(h1().textContent).toBe("리포트");
    cleanup();
    const h2 = mk();
    await toReport(h2);
    await h2.user.click(screen.getByRole("button", { name: "다시 수집한 파일과 비교" }));
    await uploadFiles(h2, [awsPlain()]);
    await waitFor(() => expect(screen.getAllByRole("table")[0]).toBeInTheDocument());
    await h2.user.click(screen.getByRole("button", { name: "비교 보기" }));
    await waitFor(() => expect(h1().textContent).toBe("재점검 비교"));
    expect(screen.getByText("같은 수집 결과입니다. 고친 뒤 다시 수집한 파일을 넣어 주세요.")).toBeInTheDocument();
    expect(document.querySelector('section[aria-labelledby="cc-compare-id-h"]')?.textContent).toContain("같은 계정입니다."); // 같은 수집 결과 = 같은 계정(엔진 판정)
  });
  // STEP 7 직전 스모크(프론트팀장): 끝 4자리가 같은 다른 계정 — V2는 끝 4자리만 보므로 통과하고, 엔진이 전체 ID로 거부한다.
  // 고치기 전에는 거부 문장 바로 위에 '같은 계정입니다.'가 함께 보였다(IdentityCompare가 끝 4자리로 단정)
  it("끝 4자리가 같은 다른 계정: V5가 '다른 계정'으로 거부하고, 신원 칸은 '같은 계정입니다.' 없이 계정에 밑줄", async () => {
    const h = mk();
    await toReport(h);
    await h.user.click(screen.getByRole("button", { name: "다시 수집한 파일과 비교" }));
    await waitFor(() => expect(h1().textContent).toBe("결과 파일 넣기"));
    const later = awsFile({ mutate: (f) => { f.collectedAt = "2026-10-26T03:12:00Z"; f.run.finishedAt = "2026-10-26T03:12:00Z"; } }).file;
    const other = JSON.stringify(later).split("123456789012").join("999988889012");
    expect(other).not.toBe(JSON.stringify(later)); // 계정 ID를 실제로 바꿨다
    await uploadFiles(h, [textFile("cloudcheck-aws-other.json", other)]);
    await waitFor(() => expect(screen.getAllByRole("table")[0]).toBeInTheDocument());
    expect(screen.getByRole("button", { name: "비교 보기" })).not.toHaveAttribute("aria-disabled", "true"); // V2는 끝 4자리만 본다
    await h.user.click(screen.getByRole("button", { name: "비교 보기" }));
    await waitFor(() => expect(h1().textContent).toBe("재점검 비교"));
    expect(screen.getByText("다른 계정의 파일입니다. 비교하지 않았습니다.")).toBeInTheDocument();
    const idSection = document.querySelector('section[aria-labelledby="cc-compare-id-h"]') as HTMLElement;
    expect(idSection.textContent).toContain("••••9012");
    expect(idSection.textContent).not.toContain("같은 계정입니다.");
    expect(idSection.querySelectorAll(".cc-idc__diff .cc-acct").length).toBe(2);
    expect(screen.queryByRole("button", { name: "이번 리포트 보기" })).toBeNull();
  });
});

describe("실제 엔진 · Azure(공개 상태를 주입해 연다)", () => {
  it("Azure 수집 파일: V3가 열리고 맥락 줄에 Azure, 쓰기 명령 없음, 엔진 키가 모두 ENGINE_KO에 있다", async () => {
    const h = mkAzureOpen();
    await toReport(h, [textFile("cloudcheck-azure-result.json", azureFile().file)]);
    expect(document.querySelector(".cc-ctx")?.textContent).toContain("Azure");
    expect(document.querySelectorAll(".cc-cmd--write").length).toBe(0);
    for (const btn of Array.from(document.querySelectorAll<HTMLElement>(".cc-rule__tog"))) await h.user.click(btn);
    expect(missingEngineKeys()).toEqual([]);
  });
  it("Azure 현관: 엔진은 현관을 수집 안 함(not-collected)으로 두고 AZ-MFA-G를 확인 불가로 준다 → 현관 구역에 확인 불가가 보이고, 분포·직접 볼 목록에 들어간다", async () => {
    const h = mkAzureOpen();
    await toReport(h, [textFile("cloudcheck-azure-result.json", azureFile().file)]);
    const door = document.getElementById(DOM_ID.door("mfa"))?.closest("section") as HTMLElement;
    expect(door.querySelector(".cc-sb")?.textContent).toContain("확인 불가");
    // 직접 볼 목록에는 가이드 카드 요약 행("직접 확인 안내")이 들어간다 — 본인 응답 라디오는 점검 행 본문에만 있다
    expect(Array.from(mainEl().querySelectorAll(".cc-mc tbody tr")).some((tr) => tr.textContent?.includes("직접 확인 안내"))).toBe(true);
    expect(screen.getByText(/아직 판단하지 못한 점검이 1개 있습니다/)).toBeInTheDocument();
  });
  // D4 통합(프론트팀장)에서 고친 간극: 엔진은 Azure 현관을 not-collected로 두는데 DoorSection이 그런 문을 묶음 줄로만 그려 GuideCard가 사라졌다.
  // 이제 안내 카드 점검(entry.guide)은 수집 안 한 문에서도 일반 행으로 그린다 → 본인 응답 라디오가 행 본문에 있다. 수집 줄은 '수집 안 함'이 한 번만 나온다.
  it("Azure 현관: AZ-MFA-G가 일반 점검 행(펼침 버튼 + 본인 응답 라디오)으로 보이고, 묶음 줄·중복 문구가 없다", async () => {
    const h = mkAzureOpen();
    await toReport(h, [textFile("cloudcheck-azure-result.json", azureFile().file)]);
    const row = document.getElementById(DOM_ID.rule("AZ-MFA-G"));
    expect(row).not.toBeNull();
    await h.user.click(document.getElementById(DOM_ID.ruleToggle("AZ-MFA-G")) as HTMLElement);
    expect(within(row as HTMLElement).getAllByRole("radio").length).toBeGreaterThan(0);
    const door = document.getElementById(DOM_ID.door("mfa"))?.closest("section") as HTMLElement;
    expect(door.querySelector(".cc-ncg")).toBeNull();
    const collect = door.querySelector(".cc-door__collect")?.textContent ?? "";
    expect(collect).toBe("수집: 수집 안 함");
    // 조회 범위의 문별 수집 줄도 '수집 안 함 (수집 안 함)'으로 겹치지 않는다
    expect(document.querySelector(".cc-scope")?.textContent ?? "").not.toContain("수집 안 함(수집 안 함)");
    expect(visibleText()).not.toContain("⟦");
  });
});

describe("실제 엔진 · 붙여 넣은 CSV의 기준 시각 안내(디자인 D-6)", () => {
  const NOTE = "붙여 넣은 CSV에는 수집 시각이 없어 기준 시각을 알 수 없습니다";
  async function pasteText(h: Harness, text: string): Promise<void> {
    await h.user.click(screen.getByRole("button", { name: "결과 파일이 이미 있어요" }));
    await h.user.click(screen.getByRole("tab", { name: "붙여넣기" }));
    (document.querySelector("textarea") as HTMLTextAreaElement).focus();
    await h.user.paste(text);
    await waitFor(() => expect(screen.getAllByRole("table")[0]).toBeInTheDocument());
  }
  it("자격증명 보고서 CSV를 붙여 넣으면 그 줄 바로 아래에 안내 한 줄(문장 그대로)", async () => {
    const h = mk();
    await pasteText(h, reportCsv());
    const rows = Array.from((screen.getAllByRole("table")[0] as HTMLElement).querySelectorAll("tbody > tr"));
    expect(rows[0]?.textContent).toContain("붙여넣은 내용 1");
    expect(rows[1]?.textContent).toContain(NOTE);
    expect(rows[1]?.textContent).toContain("보고서를 파일로 넣으면 파일 이름이나 수정 시각으로 기준 시각을 추정합니다.");
  });
  it("수집기 JSON을 붙여 넣으면(수집 시각이 있다) 안내가 없다", async () => {
    const h = mk();
    await pasteText(h, JSON.stringify(awsFile().file));
    expect(document.body.textContent).not.toContain(NOTE);
  });
});

describe("실제 엔진 · Azure 공개 전 차단(STEP 5 기획팀장 결정 §8-A)", () => {
  const NOTE = "Azure 실제 점검은 준비 중입니다";
  const reportCount = (): number => document.querySelectorAll(".cc-report").length;
  async function readOnly(h: Harness, files: File[]): Promise<HTMLElement> {
    await open(h, files);
    const cta = screen.getByRole("button", { name: "이 계정으로 리포트 보기" });
    return cta;
  }
  it("운영 기본값(Azure 준비 중): 실제 Azure 수집 파일은 읽지만 리포트를 만들지 않는다 — 버튼 막힘 + 기존 안내 문구 + [Azure 체험 보기]", async () => {
    const h = mk();
    const cta = await readOnly(h, [textFile("cloudcheck-azure-result.json", azureFile().file)]);
    const table = screen.getAllByRole("table")[0] as HTMLElement;
    expect(within(table).getByText("읽었습니다")).toBeInTheDocument();
    expect(cta).toHaveAttribute("aria-disabled", "true");
    // 버튼의 이유 글자 = 기존 키 cc.start.azure-soon.note(새 키 없음), aria-describedby로 이어진다
    const reasonId = cta.getAttribute("aria-describedby") ?? "";
    expect(document.getElementById(reasonId)?.textContent).toContain(NOTE);
    expect(screen.getByRole("button", { name: "Azure 체험 보기" })).toBeInTheDocument();
    // 읽자마자 즉시 알림(role=alert 라이브 영역)으로도 알린다 — 버튼까지 가기 전에 막힌다는 것을 듣게
    expect(document.querySelector('[role="alert"].cc-vh')?.textContent ?? "").toContain(NOTE);
    await h.user.click(cta);
    expect(h1().textContent).toBe("결과 파일 넣기");
    expect(reportCount()).toBe(0);
  });
  it("Resource Graph CSV(Azure)도 같은 이유로 막는다", async () => {
    const h = mk();
    const cta = await readOnly(h, [new File([rgStorageCsv()], "cc-rg-storage.csv", { type: "text/csv" })]);
    expect(cta).toHaveAttribute("aria-disabled", "true");
    expect(document.getElementById(cta.getAttribute("aria-describedby") ?? "")?.textContent).toContain(NOTE);
    await h.user.click(cta);
    expect(reportCount()).toBe(0);
  });
  it("[Azure 체험 보기] → 체험 모드(Azure)로 가서 가짜 회사 리포트는 열린다(체험은 막지 않는다)", async () => {
    installRealDemoBlocks();
    try {
      const h = mk();
      await readOnly(h, [textFile("cloudcheck-azure-result.json", azureFile().file)]);
      await h.user.click(screen.getByRole("button", { name: "Azure 체험 보기" }));
      await waitFor(() => expect(h1().textContent).toBe("체험 모드"));
      expect((screen.getByRole("radio", { name: "Azure" }) as HTMLInputElement).checked).toBe(true);
      const card = screen.getByRole("heading", { name: "반듯상회" }).closest("article") as HTMLElement;
      await h.user.click(within(card).getByRole("button"));
      await waitFor(() => expect(h1().textContent).toBe("체험 리포트"));
      expect(document.querySelector(".cc-ctx")?.textContent).toContain("Azure");
    } finally {
      document.querySelectorAll('script[id^="cc-demo-"]').forEach((el) => el.remove());
    }
  });
  it("같은 파일도 Azure를 연 공개 상태면 리포트가 만들어진다(막는 기준은 공개 상태 하나)", async () => {
    const h = mkAzureOpen();
    await toReport(h, [textFile("cloudcheck-azure-result.json", azureFile().file)]);
    expect(reportCount()).toBe(1);
    expect(document.body.textContent).not.toContain(NOTE);
  });
  it("AWS 파일은 운영 기본값에서 그대로 리포트가 된다", async () => {
    const h = mk();
    await toReport(h);
    expect(reportCount()).toBe(1);
  });
});

describe("실제 엔진 · 연결(deps.real)", () => {
  it("rulesetVersion(rules/version 상수) = judge가 리포트에 적는 룰셋 버전", () => {
    expect(REAL_DEPS.rulesetVersion).toBe(sampleReport().engine.rulesetVersion);
    expect(REAL_DEPS.rulesetVersion).toMatch(/^\d+\.\d+\.\d+$/);
  });
  it("카탈로그는 RULE_CATALOG 18장(미공개 포함)이고, 리포트의 점검은 모두 카탈로그에 있다", () => {
    expect(REAL_DEPS.catalog).toHaveLength(18);
    const ids = new Set(REAL_DEPS.catalog.map((e) => e.ruleId));
    for (const r of sampleReport().doors.flatMap((d) => d.rules)) expect(ids.has(r.ruleId), r.ruleId).toBe(true);
  });
});

describe("실제 엔진 · V7 판정 규칙", () => {
  it("RULE_CATALOG 18장: 점검 17개(AWS 10 · Azure 7), 미공개 1개는 펼칠 수 없다. 사용 키가 ENGINE_KO에 있다", async () => {
    const h = mk();
    await h.user.click(screen.getByRole("button", { name: "판정 규칙" }));
    expect(visibleText()).toMatch(/점검 17개 \(AWS 10 · Azure 7\)/);
    expect(mainEl().querySelectorAll("details").length).toBe(17);
    expect(screen.getByText("아직 쓰지 않는 점검입니다(실제 계정 검증 대기).")).toBeInTheDocument();
    for (const d of Array.from(mainEl().querySelectorAll("details"))) d.open = true;
    expect(missingEngineKeys()).toEqual([]);
  });
});
