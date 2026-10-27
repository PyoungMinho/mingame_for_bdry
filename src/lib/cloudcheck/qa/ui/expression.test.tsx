// @vitest-environment jsdom
// QA EX-05 — 꼬리표 정직성(설계서 §4-5, CR-06): 위험·주의인데 범위가 증명되지 않은 점검의 꼬리표가 '전체'·'전부'를 말하면 안 된다.
// 실제 파서·엔진(REAL_DEPS) + 실제 화면(App)으로 본다. 입력은 회사 C(아슬아슬상회) 수집 JSON을 '버킷 목록 예산 초과'로 바꾼 것(E-19).
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { IsoDate, RuleResult } from "../../model/report";
import { RULE_CATALOG } from "../../rules/catalog";
import { REAL_DEPS } from "../../../../app/cloudcheck/_client/state/deps.real";
import { RuleRow } from "../../../../app/cloudcheck/_client/components/RuleRow";
import { DOM_ID } from "../../../../app/cloudcheck/_client/components/dom-ids";
import { h1, mount, uploadFiles, type Harness } from "../../../../app/cloudcheck/_client/screens/__tests__/harness";
import { companyJson, okReport, ruleOf, runJson } from "../kit";
import type { Json } from "../kit";
import { createRequire } from "node:module";
import { within } from "@testing-library/react";
import { failClosedReport } from "../../engine/judge";
import { awsFile, azureFile } from "../../parse/testdata";
import { PAGE } from "../../../../app/cloudcheck/_generated/page";
import { lookup } from "../../../../app/cloudcheck/_client/i18n/index";
import { bannedHits } from "../../../../app/cloudcheck/_client/screens/__tests__/harness";
import { companyCsv } from "../kit";

/** E-19: 버킷 3개 중 마지막 1개를 예산 밖으로(조회 못 함). 공개 버킷(위험)은 그대로 */
function budgetExceeded(): Json {
  const f = companyJson("aws", "C");
  const b = f.data.buckets;
  const n = b.items.length;
  b.budget = { limit: n - 1, total: n, collected: n - 1 };
  const last = b.items[n - 1];
  for (const k of ["publicAccessBlock", "policyStatus", "acl", "ownership", "website"]) {
    const rid = last[k].receipt;
    f.receipts = (f.receipts as Json[]).filter((r) => r.id !== rid);
    last[k] = { receipt: b.receipt, value: null };
  }
  return f;
}
/** IAM 사용자 목록이 잘림(truncated, 4명 중 2명) — AWS-MFA-2 위험은 받은 부분에서 유지(INV-4) */
function usersTruncated(): Json {
  const f = companyJson("aws", "C");
  const u = f.data.iamUsers;
  const rc = (f.receipts as Json[]).find((r) => r.id === u.receipt);
  rc.result = "truncated";
  rc.count = 4;
  return f;
}

const CLOCK = { now: () => "2026-10-19T05:00:00Z" as never, today: () => "2026-10-19" as never };
const fileOf = (name: string, body: unknown): File => new File([JSON.stringify(body)], name, { type: "application/json" });
async function toReport(h: Harness, files: File[]): Promise<void> {
  await h.user.click(screen.getByRole("button", { name: "결과 파일이 이미 있어요" }));
  await uploadFiles(h, files);
  await waitFor(() => expect(screen.getAllByRole("table")[0]).toBeInTheDocument());
  await h.user.click(screen.getByRole("button", { name: "이 계정으로 리포트 보기" }));
  await waitFor(() => expect(h1().textContent).toBe("리포트"));
}
const tailOf = (id: RuleResult["ruleId"]): string => document.getElementById(DOM_ID.rule(id))?.querySelector(".cc-rule__tail")?.textContent ?? "";
const OVERCLAIM = /계정 전체|전부/;

beforeEach(() => {
  window.history.replaceState(null, "");
  window.print = vi.fn();
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("EX-05 전제: 시험 입력이 '위험 + 범위 미증명'을 만든다(엔진 출력)", () => {
  it("버킷 예산 초과: AWS-STO-2는 위험이고 coverage.proven = false, 직접 볼 목록에 그 버킷(확인 불가 대상)이 있다", () => {
    const r = okReport(runJson(budgetExceeded()));
    const sto = ruleOf(r, "AWS-STO-2");
    expect(sto.status).toBe("risk");
    expect(sto.coverage).toMatchObject({ kind: "account-global", proven: false, covered: 0, total: 1 });
    expect(r.manualChecklist.some((m) => m.origin === "unknown-item" && m.ruleId === "AWS-STO-2")).toBe(true);
  });
  it("사용자 목록 잘림: AWS-MFA-2는 위험이고 coverage.proven = false", () => {
    const mfa = ruleOf(okReport(runJson(usersTruncated())), "AWS-MFA-2");
    expect(mfa.status).toBe("risk");
    expect(mfa.coverage.proven).toBe(false);
  });
  it("[CC-QA-06 · 결정 §8-B] 위험 + 범위 미증명인데 확인 불가 대상이 없으면(사용자 목록 잘림) 직접 볼 목록에 '보지 못한 나머지 대상' 항목이 들어간다", () => {
    const r = okReport(runJson(usersTruncated()));
    expect(r.manualChecklist.filter((m) => m.ruleId === "AWS-MFA-2" && m.id.endsWith("|rest")).length).toBe(1);
    // 대조: 범위가 증명된 원본 C에는 그 항목이 없다
    expect(okReport(runJson(companyJson("aws", "C"))).manualChecklist.filter((m) => m.ruleId === "AWS-MFA-2" && m.id.endsWith("|rest"))).toEqual([]);
  });
  it("대조: 범위가 증명된 위험(원본 C의 AWS-STO-2)의 꼬리표는 '계정 전체'가 맞다", () => {
    const sto = ruleOf(okReport(runJson(companyJson("aws", "C"))), "AWS-STO-2");
    expect(sto.coverage.proven).toBe(true);
    const entry = RULE_CATALOG.find((e) => e.ruleId === "AWS-STO-2");
    if (entry === undefined) throw new Error("catalog");
    const { container } = render(<ul><RuleRow rule={sto} entry={entry} open={false} onToggle={vi.fn()} table={tableProps(sto)} /></ul>);
    expect(container.querySelector(".cc-rule__tail")?.textContent).toContain("확인한 범위: 계정 전체");
  });
});

function tableProps(r: RuleResult) {
  return { rule: r, overlay: null, shown: 50, onMore: vi.fn(), canMark: () => false, editingId: null, onOpenForm: vi.fn(), onSave: vi.fn(), onRemove: vi.fn(), today: "2026-10-19" as IsoDate };
}

describe("EX-05 RuleRow 단위", () => {
  it("[CC-QA-06] 위험 + coverage.proven=false(버킷 예산 초과)면 꼬리표가 '계정 전체'·'전부'를 말하지 않아야 한다", () => {
    const sto = ruleOf(okReport(runJson(budgetExceeded())), "AWS-STO-2");
    const entry = RULE_CATALOG.find((e) => e.ruleId === "AWS-STO-2");
    if (entry === undefined) throw new Error("catalog");
    const { container } = render(<ul><RuleRow rule={sto} entry={entry} open={false} onToggle={vi.fn()} table={tableProps(sto)} /></ul>);
    const tail = container.querySelector(".cc-rule__tail")?.textContent ?? "";
    expect(tail).toContain("확인한 범위");
    expect(tail).not.toMatch(OVERCLAIM);
  });
  it("[CC-QA-06] 위험 + 사용자 목록 잘림이면 AWS-MFA-2 꼬리표가 '계정 전체'를 말하지 않아야 한다", () => {
    const mfa = ruleOf(okReport(runJson(usersTruncated())), "AWS-MFA-2");
    const entry = RULE_CATALOG.find((e) => e.ruleId === "AWS-MFA-2");
    if (entry === undefined) throw new Error("catalog");
    const { container } = render(<ul><RuleRow rule={mfa} entry={entry} open={false} onToggle={vi.fn()} table={tableProps(mfa)} /></ul>);
    expect(container.querySelector(".cc-rule__tail")?.textContent ?? "").not.toMatch(OVERCLAIM);
  });
});

describe("EX-05 실제 화면(V3, 실엔진)", () => {
  it("[CC-QA-06] 버킷 예산 초과 파일로 연 리포트: AWS-STO-2 행 꼬리표가 범위를 과장하지 않는다", async () => {
    const h = mount({ deps: REAL_DEPS, clock: CLOCK });
    await toReport(h, [fileOf("cloudcheck-aws-3333-20261019T031500Z.json", budgetExceeded())]);
    const tail = tailOf("AWS-STO-2");
    expect(tail).toContain("확인한 범위");
    expect(tail).not.toMatch(OVERCLAIM);
  });
  it("전제: 같은 화면에 AWS-STO-2 위험 행과 꼬리표가 있다(위 it.fails가 화면 로드 실패로 통과하는 것이 아님)", async () => {
    const h = mount({ deps: REAL_DEPS, clock: CLOCK });
    await toReport(h, [fileOf("cloudcheck-aws-3333-20261019T031500Z.json", budgetExceeded())]);
    expect(document.getElementById(DOM_ID.rule("AWS-STO-2"))?.classList.contains("cc-st--risk")).toBe(true);
    expect(tailOf("AWS-STO-2")).toContain("확인한 범위");
  });
});

/* ═════════ EX-01 렌더 금지어 전 화면 · EX-02 면책·고지 고정 노출 ═════════
 * 기존 demo-real.test.tsx가 체험 8곳의 V3 · V4를 본다. 여기서는 그 밖의 화면과 입력 종류, 텍스트 속성(aria-label · title · alt · placeholder) · document.title,
 * 정적 셸 · <noscript>(템플릿)를 본다. 기대: 금지어 0(허용 키 2개 글자 제외), ⟦키⟧ 0, 채워지지 않은 {이름} 0. */

const TEXT_ATTRS = ["aria-label", "title", "alt", "placeholder", "aria-description", "aria-roledescription", "aria-valuetext"];
function audit(where: string): string[] {
  const text = document.body.textContent ?? "";
  const attrs = [...document.querySelectorAll("*")].flatMap((el) => TEXT_ATTRS.map((a) => el.getAttribute(a)).filter((v): v is string => v !== null));
  const out: string[] = [];
  for (const [part, s] of [["글자", text], ["속성", attrs.join("\n")], ["제목", document.title]] as const) {
    for (const h of bannedHits(s)) out.push(`${where} ${part}: 금지어 ${h}`);
    for (const m of s.match(/⟦[^⟧]*⟧/g) ?? []) out.push(`${where} ${part}: 없는 키 ${m}`);
    for (const m of s.match(/\{[A-Za-z][A-Za-z0-9]*\}/g) ?? []) out.push(`${where} ${part}: 빈 자리 ${m}`);
  }
  return out;
}
const textFile = (name: string, body: unknown): File => new File([typeof body === "string" ? body : JSON.stringify(body)], name, { type: name.endsWith(".csv") ? "text/csv" : "application/json" });
async function openFiles(h: Harness, files: File[]): Promise<void> {
  await h.user.click(screen.getByRole("button", { name: "결과 파일이 이미 있어요" }));
  await uploadFiles(h, files);
  await waitFor(() => expect(screen.getAllByRole("table")[0]).toBeInTheDocument());
}
async function expandAll(h: Harness): Promise<void> {
  for (const btn of [...document.querySelectorAll<HTMLElement>(".cc-rule__tog, .cc-ncg > button, details > summary")]) await h.user.click(btn);
}

describe("EX-01 렌더 금지어 — 체험 밖 화면 · 입력 종류", () => {
  it("V0 · V6 · V7(전부 펼침) · V8 · V1(AWS) · V2", async () => {
    const h = mount({ deps: REAL_DEPS, clock: CLOCK });
    const bad = audit("V0");
    await h.user.click(screen.getByRole("button", { name: "체험 모드로 먼저 보기" }));
    await waitFor(() => expect(h1().textContent).toBe("체험 모드"));
    bad.push(...audit("V6"));
    await h.user.click(screen.getByRole("radio", { name: "Azure" }));
    bad.push(...audit("V6 Azure"));
    await h.user.click(screen.getByRole("button", { name: "판정 규칙" }));
    await waitFor(() => expect(h1().textContent).toBe("판정 규칙"));
    await expandAll(h);
    bad.push(...audit("V7"));
    await h.user.click(screen.getByRole("button", { name: "이 도구에 대해" }));
    await waitFor(() => expect(h1().textContent).toBe("이 도구에 대해"));
    await expandAll(h);
    bad.push(...audit("V8"));
    await h.user.click(screen.getByRole("button", { name: "문단속 5" }));
    await h.user.click(screen.getByRole("button", { name: "AWS 점검 시작" }));
    await waitFor(() => expect(h1().textContent).toBe("수집 준비"));       // RTL 하네스에는 수집기 데이터 블록이 없어 내려받기 버튼 대신 대체 안내가 나온다(실제 HTML은 ISO-02가 본다)
    await expandAll(h);
    bad.push(...audit("V1 AWS"));
    await h.user.click(screen.getAllByRole("button", { name: /^결과 파일 넣기/ })[0]);
    await waitFor(() => expect(h1().textContent).toBe("결과 파일 넣기"));
    bad.push(...audit("V2"));
    expect(bad).toEqual([]);
  });
  it("V3: 실제 수집 파일(AWS · Azure) · 보고서 CSV 단독 · 전부 확인 불가(failClosedReport) — 전부 펼침 + V4 하나", async () => {
    const bad: string[] = [];
    const cases: readonly [string, File[], Partial<typeof REAL_DEPS>][] = [
      ["AWS 수집 파일", [textFile("cloudcheck-aws-result.json", awsFile().file)], {}],
      ["Azure 수집 파일", [textFile("cloudcheck-azure-result.json", azureFile().file)], {}],
      ["보고서 CSV 단독", [textFile("credential-report.csv", companyCsv("C"))], {}],
      ["전부 확인 불가", [textFile("cloudcheck-aws-result.json", awsFile().file)], { judge: (i: unknown) => failClosedReport(i) }],
    ];
    // Azure 실제 점검은 운영 기본값에서 '준비 중'이라 V2가 막는다(결정 §8-A) — 실제 Azure 리포트 화면을 보는 이 시험은 공개 상태를 주입한다(막는 동작은 qa/ui/azure-gate.test.tsx)
    const AZURE_OPEN = { aws: "beta", azure: "beta" } as const;
    for (const [label, files, over] of cases) {
      cleanup();
      window.history.replaceState(null, "");
      const h = mount({ deps: { ...REAL_DEPS, ...over }, clock: CLOCK, availability: AZURE_OPEN });
      await openFiles(h, files);
      bad.push(...audit(`${label} V2`));
      await h.user.click(screen.getByRole("button", { name: "이 계정으로 리포트 보기" }));
      await waitFor(() => expect(h1().textContent).toBe("리포트"));
      await expandAll(h);
      bad.push(...audit(`${label} V3`));
      const fix = document.querySelector<HTMLElement>("[id$='-fix']");
      if (fix !== null) {
        await h.user.click(fix);
        await waitFor(() => expect(h1().textContent).toBe("고치는 법"));
        bad.push(...audit(`${label} V4`));
      }
    }
    expect(bad).toEqual([]);
  });
  it("V5 비교 결과(같은 계정 · 1주 뒤 · 상태 변화 있음)", async () => {
    const h = mount({ deps: REAL_DEPS, clock: CLOCK });
    const before = companyJson("aws", "C");
    await openFiles(h, [textFile("cloudcheck-aws-3333-20261019T031500Z.json", before)]);
    await h.user.click(screen.getByRole("button", { name: "이 계정으로 리포트 보기" }));
    await waitFor(() => expect(h1().textContent).toBe("리포트"));
    await h.user.click(screen.getByRole("button", { name: "다시 수집한 파일과 비교" }));
    const after = companyJson("aws", "C");
    after.collectedAt = "2026-10-26T03:15:00Z"; after.run.finishedAt = "2026-10-26T03:15:00Z";
    after.data.trails.value[0].status.value.isLogging = true;
    await uploadFiles(h, [textFile("cloudcheck-aws-3333-20261026T031500Z.json", after)]);
    await waitFor(() => expect(screen.getAllByRole("table")[0]).toBeInTheDocument());
    await h.user.click(screen.getByRole("button", { name: "비교 보기" }));
    await waitFor(() => expect(h1().textContent).toBe("재점검 비교"));
    await expandAll(h);
    expect(audit("V5")).toEqual([]);
  });
  it("새 사유 · 알림 문구(2026-10-20 결정 반영): 넓은 대역 · 프리픽스 리스트 · 서비스 태그 · 전송 오류 · 시각 역전 알림이 그려지고 금지어 · 없는 키 · 빈 자리 0", async () => {
    const bad: string[] = [];
    const awsNet = companyJson("aws", "C");
    const sgs = (awsNet.data.securityGroups as Json[]).flatMap((p) => p.items ?? []);
    sgs.find((x: Json) => x.groupId === "sg-0c0ffee1").ingress = [{ protocol: "tcp", fromPort: 22, toPort: 22, cidrs: ["1.0.0.0/8"], ipv6Cidrs: [], prefixListIds: [], sgRefCount: 0 }];
    sgs.find((x: Json) => x.groupId === "sg-0c0ffee2").ingress = [{ protocol: "tcp", fromPort: 3306, toPort: 3306, cidrs: [], ipv6Cidrs: [], prefixListIds: ["pl-0123abcd"], sgRefCount: 0 }];
    const awsLog = companyJson("aws", "A");
    awsLog.data.trails.value[0].status.value.hasDeliveryError = true;
    const azure = companyJson("azure", "C");
    const nsgRule = (azure.data.nsgs as Json[]).flatMap((p) => p.items ?? []).find((n: Json) => n.name === "nsg-acme-db").rules[0];
    nsgRule.sourcePrefixes = ["AzureCloud"];
    nsgRule.destPortRanges = ["22"];
    const csv = new File([companyCsv("C")], "credential-report.csv", { type: "text/csv", lastModified: Date.UTC(2026, 0, 1) });
    const cases: readonly [string, File[], string][] = [
      ["AWS 넓은 대역 · 프리픽스 리스트", [textFile("cloudcheck-aws-3333-20261019T031500Z.json", awsNet)], "AWS-NET-1"],
      ["AWS trail 전송 오류", [textFile("cloudcheck-aws-3333-20261019T031500Z.json", awsLog)], "AWS-LOG-1"],
      ["Azure 서비스 태그", [textFile("cloudcheck-azure-0003-20261019T031500Z.json", azure)], "AZ-NET-1"],
      ["보고서 CSV 시각 역전(E-01류)", [csv], "AWS-KEY-1"],
    ];
    for (const [label, files, ruleId] of cases) {
      cleanup();
      window.history.replaceState(null, "");
      const h = mount({ deps: REAL_DEPS, clock: CLOCK, availability: { aws: "beta", azure: "beta" } });
      await openFiles(h, files);
      await h.user.click(screen.getByRole("button", { name: "이 계정으로 리포트 보기" }));
      await waitFor(() => expect(h1().textContent).toBe("리포트"));
      await expandAll(h);
      bad.push(...audit(label));
      const row = document.getElementById(DOM_ID.rule(ruleId as RuleResult["ruleId"]));
      expect(row?.classList.contains("cc-st--clear") ?? true, `${label}: ${ruleId} 행이 이상 없음이면 안 된다`).toBe(false);
      if (label.startsWith("보고서 CSV")) expect(document.body.textContent ?? "").toContain("기준 시각보다 늦은 기록이 파일 안에 있습니다");
    }
    expect(bad).toEqual([]);
  });
  it("D-6: 붙여 넣은 보고서 CSV 줄 아래 '기준 시각 없음' 안내가 보이고, V2 · V3에 금지어 · 없는 키 · 빈 자리 0", async () => {
    window.history.replaceState(null, "");
    const h = mount({ deps: REAL_DEPS, clock: CLOCK });
    await h.user.click(screen.getByRole("button", { name: "결과 파일이 이미 있어요" }));
    await h.user.click(screen.getByRole("tab", { name: "붙여넣기" }));
    const ta = document.querySelector("textarea") as HTMLTextAreaElement;
    const text = companyCsv("C");
    fireEvent.paste(ta, { clipboardData: { getData: (t: string) => (t === "text/plain" ? text : ""), files: [], types: ["text/plain"] } });
    await waitFor(() => expect(screen.getAllByRole("table")[0]).toBeInTheDocument());
    const note = lookup("cc.input.paste-no-asof") ?? "";
    expect(note.length).toBeGreaterThan(10);
    expect(document.body.textContent ?? "").toContain(note.slice(0, 30));
    const bad = audit("V2 붙여넣기");
    await h.user.click(screen.getByRole("button", { name: "이 계정으로 리포트 보기" }));
    await waitFor(() => expect(h1().textContent).toBe("리포트"));
    await expandAll(h);
    bad.push(...audit("V3 붙여넣기"));
    expect(bad).toEqual([]);
  });
  it("정적 셸 · <noscript>(스크립트 없이 보이는 커밋된 HTML)", () => {
    const { JSDOM } = createRequire(import.meta.url)("jsdom") as { JSDOM: new (html: string) => { window: { document: Document; close(): void } } };
    const dom = new JSDOM(PAGE.html);
    const d = dom.window.document;
    d.querySelectorAll("script, style").forEach((el) => el.remove());     // 실행 스크립트 · 데이터 블록 · CSS 본문은 화면 글자가 아니다
    const text = d.body.textContent ?? "";
    const attrs = [...d.querySelectorAll("*")].flatMap((el) => TEXT_ATTRS.map((a) => el.getAttribute(a)).filter((v): v is string => v !== null)).join("\n");
    expect([...bannedHits(text), ...bannedHits(attrs), ...bannedHits(d.title)]).toEqual([]);
    expect(text).not.toMatch(/⟦|\{[A-Za-z][A-Za-z0-9]*\}/);
    expect(d.querySelector("noscript")?.textContent ?? "").not.toBe("");
    dom.window.close();
  });
});

describe("EX-02 면책 · 고지 고정 노출(G-D19)", () => {
  const caveat = lookup("cc.promise.caveat") ?? "";
  const disclaimer = lookup("cc.disclaimer.body") ?? "";
  const caveatRightAfterPromise = (): boolean => [...document.querySelectorAll(".cc-promise")].some((p) => p.lastElementChild?.classList.contains("cc-caveat") === true && p.lastElementChild.textContent === caveat);
  it("V0 · V2 · V3(화면 + 인쇄 바닥) · V8: 약속 바로 다음 고지, V3 · V8 면책", async () => {
    expect(caveat.length).toBeGreaterThan(10);
    expect(disclaimer.length).toBeGreaterThan(10);
    const h = mount({ deps: REAL_DEPS, clock: CLOCK });
    expect(caveatRightAfterPromise()).toBe(true);                                   // V0
    await openFiles(h, [textFile("cloudcheck-aws-result.json", awsFile().file)]);
    expect(caveatRightAfterPromise()).toBe(true);                                   // V2
    await h.user.click(screen.getByRole("button", { name: "이 계정으로 리포트 보기" }));
    await waitFor(() => expect(h1().textContent).toBe("리포트"));
    const shownDisclaimers = [...document.querySelectorAll("*")].filter((el) => el.children.length === 0 && (el.textContent ?? "").includes(disclaimer.slice(0, 20)));
    expect(shownDisclaimers.length).toBeGreaterThanOrEqual(2);                     // V3 화면 + 인쇄 바닥
    expect(shownDisclaimers.some((el) => el.closest(".cc-print-only") !== null)).toBe(true);
    await h.user.click(screen.getByRole("button", { name: "이 도구에 대해" }));
    await waitFor(() => expect(h1().textContent).toBe("이 도구에 대해"));
    expect(document.body.textContent).toContain(disclaimer.slice(0, 20));         // V8
    expect(caveatRightAfterPromise()).toBe(true);                                   // V8 약속
    void within;
  });
});
