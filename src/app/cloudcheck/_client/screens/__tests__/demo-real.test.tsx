// @vitest-environment jsdom
// src/app/cloudcheck/_client/screens/__tests__/demo-real.test.tsx — 체험 4세트 × AWS·Azure를 '실물'로 연다. 소유: 프론트팀장(D4 통합).
// 데이터 블록에는 생성기와 같은 방식(JSON.stringify + '<' → <)으로 fixtures/companies/<cloud>-<set>.json을 넣고, 엔진은 실제 연결(state/deps.real.ts)이다.
// G7(렌더 금지어)의 재료가 목업이 아니라 배포될 체험 데이터·엔진·E 카탈로그 그대로라는 점이 목업 시험(report.test.tsx)과 다르다.
//  - ⟦키⟧ 0(E 포함) · 금지어 0(허용 키 2문장 제외) · V3 쓰기 명령 0 · 속성·document.title에 사용자 값 0 · 분포 칩 = 엔진 분포 · 확인 불가면 직접 볼 목록
//  - 위험 점검 하나는 V4까지 열어 같은 검사를 한다(쓰기 명령은 V4에만)
import { readFileSync } from "node:fs";
import path from "node:path";
import { cleanup, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { demoInputName } from "../../../../../lib/cloudcheck/contract/normalized";
import { STATUS_ORDER, type Cloud, type DemoSetId, type Report } from "../../../../../lib/cloudcheck/model/report";
import { DOM_ID } from "../../components/dom-ids";
import { lookup } from "../../i18n/index";
import { BLOCK, CLOUDS, DEMO_SETS, readDemoText } from "../../shell";
import { REAL_DEPS } from "../../state/deps.real";
import { attributeLeaks, bannedHits, h1, mainEl, missingKeys, mount, sensitiveFulls, visibleText, type Harness } from "./harness";

const DEMO_DIR = path.resolve(__dirname, "../../../../../lib/cloudcheck/fixtures/companies");
const COMPANY: Readonly<Record<DemoSetId, string>> = { A: "반듯상회", B: "멈춘시계상회", C: "아슬아슬상회", D: "반쯤본상회" };
const CLOUD_LABEL: Readonly<Record<Cloud, string>> = { aws: "AWS", azure: "Azure" };
const STATUS_WORD = { risk: "위험", caution: "주의", unknown: "확인 불가", clear: "이상 없음", na: "해당 없음" } as const;
/** 체험은 시간 알림이 없지만(timeNotices = []) 시계는 고정해 둔다 */
const CLOCK = { now: () => "2026-10-27T05:00:00Z" as never, today: () => "2026-10-27" as never };

/** 생성기(_build/generate.mjs의 jsonBlock)와 같은 모양의 데이터 블록 글자 */
const blockTextOf = (cloud: Cloud, set: DemoSetId): string =>
  JSON.stringify(JSON.parse(readFileSync(path.join(DEMO_DIR, `${cloud}-${set}.json`), "utf8"))).replace(/</g, "\\u003c");
function installRealDemoBlocks(): void {
  for (const cloud of CLOUDS) {
    for (const set of DEMO_SETS) {
      const el = document.createElement("script");
      el.type = "application/json";
      el.id = BLOCK.demo(cloud, set);
      el.textContent = blockTextOf(cloud, set);
      document.body.appendChild(el);
    }
  }
}
const removeBlocks = (): void => document.querySelectorAll('script[id^="cc-demo-"]').forEach((el) => el.remove());

/** 앱과 같은 길로 만든 리포트(누출 검사·분포 대조용). 블록이 설치돼 있으면 블록 글자(앱이 읽는 것), 아니면 같은 변환을 한 파일 글자 */
function reportOf(cloud: Cloud, set: DemoSetId): Report {
  const text = readDemoText(cloud, set) ?? blockTextOf(cloud, set);
  const rec = REAL_DEPS.recognize({ via: "demo", name: demoInputName(set, cloud), bytes: new TextEncoder().encode(text), lastModified: null });
  const built = REAL_DEPS.buildInput([rec]);
  if (!built.ok) throw new Error(`buildInput 거부: ${cloud}-${set} (${rec.status})`);
  return REAL_DEPS.judge(built.input);
}

async function openDemo(h: Harness, cloud: Cloud, set: DemoSetId): Promise<void> {
  await h.user.click(screen.getByRole("button", { name: "체험 모드로 먼저 보기" }));
  await h.user.click(screen.getByRole("radio", { name: CLOUD_LABEL[cloud] }));
  const card = screen.getByRole("heading", { name: COMPANY[set] }).closest("article") as HTMLElement;
  await h.user.click(within(card).getByRole("button"));
  await waitFor(() => expect(h1().textContent).toBe("체험 리포트"));
}

/** 점검 행을 모두 펼친다(본문은 접혀도 DOM에 있지만, 펼친 상태의 화면도 같이 본다) */
async function expandAll(h: Harness): Promise<void> {
  for (const btn of Array.from(document.querySelectorAll<HTMLElement>(".cc-rule__tog"))) {
    if (btn.getAttribute("aria-expanded") === "false") await h.user.click(btn);
  }
}

/** 디자인 렌더 가드(§11-2) 중 실제 출력으로 다시 보는 것: G-D3 상태 글자 · G-D4 복사 버튼 0 · G-D7 <details> 0 · G-D9 translate=no · G-D12 문 머리 배지 0 · G-D23 글자 없는 버튼 0 */
function designRenderGuards(screen: "report" | "fix"): string[] {
  const bad: string[] = [];
  const main = mainEl();
  for (const icon of Array.from(document.querySelectorAll(".cc-si"))) {
    const host = icon.closest(".cc-sb, .cc-dc, .cc-legend");
    if (host === null || !Object.values(STATUS_WORD).some((w) => host.textContent?.includes(w))) bad.push("G-D3 상태 글자 없는 도형");
  }
  for (const b of Array.from(document.querySelectorAll("button"))) {
    if ((b.textContent ?? "").includes("복사")) bad.push(`G-D4 복사 버튼: ${b.textContent}`);
    const named = (b.textContent ?? "").trim() !== "" || (b.getAttribute("aria-labelledby") ?? "").split(/\s+/).some((id) => (document.getElementById(id)?.textContent ?? "").trim() !== "");
    if (!named) bad.push(`G-D23 글자 없는 버튼: ${b.outerHTML.slice(0, 80)}`);
  }
  if (main.querySelectorAll("details").length > 0) bad.push("G-D7 <details>");
  if (main.getAttribute("translate") !== "no") bad.push(`G-D9 <main translate=no> 아님(${screen})`);
  for (const el of Array.from(main.querySelectorAll(".cc-mv, .cc-cmd, .cc-hash"))) if (el.closest('[translate="no"]') === null) bad.push(`G-D9 ${el.className}`);
  if (main.querySelectorAll(".cc-door__head .cc-sb").length > 0) bad.push("G-D12 문 머리 배지");
  return bad;
}

beforeEach(() => {
  window.history.replaceState(null, "");
  document.documentElement.className = "";
  Object.defineProperty(window, "scrollY", { value: 0, configurable: true });
  window.print = vi.fn();
  installRealDemoBlocks();
});
afterEach(() => {
  cleanup();
  removeBlocks();
  vi.restoreAllMocks();
});

describe("체험 실물(데이터 블록 + 실제 엔진) — V3", () => {
  for (const cloud of CLOUDS) {
    for (const set of DEMO_SETS) {
      it(`${CLOUD_LABEL[cloud]} ${COMPANY[set]}: ⟦⟧ 0(E 포함) · 금지어 0 · 쓰기 명령 0 · 누출 0 · 분포 = 엔진`, async () => {
        const report = reportOf(cloud, set);
        expect(report.mode).toEqual({ kind: "demo", setId: set });
        const h = mount({ deps: REAL_DEPS, clock: CLOCK });
        await openDemo(h, cloud, set);
        await expandAll(h);
        const text = visibleText();
        expect(missingKeys(text, { engine: true })).toEqual([]);
        expect(bannedHits(text)).toEqual([]);
        expect(document.querySelectorAll(".cc-cmd--write").length).toBe(0);
        expect(attributeLeaks(sensitiveFulls(report))).toEqual([]);
        // 분포 칩(D5)은 엔진의 점검 단위 분포 그대로, 상태 글자를 줄이지 않는다
        const dist = Array.from(mainEl().querySelectorAll("#cc-dist-h ~ .cc-dist .cc-dc")).map((x) => x.textContent?.replace(/\s+/g, " ").trim());
        expect(dist).toEqual(STATUS_ORDER.map((s) => `${STATUS_WORD[s]} ${report.distribution.rules[s]}`));
        // 확인 불가가 있으면 '아직 판단하지 못한 점검' 줄과 직접 볼 목록 행이 있다(없으면 그 줄이 없다)
        const unknown = report.distribution.rules.unknown;
        if (unknown > 0) {
          expect(text).toContain(`아직 판단하지 못한 점검이 ${unknown}개 있습니다`);
          expect(mainEl().querySelectorAll(".cc-mc tbody tr").length).toBeGreaterThan(0);
        } else {
          expect(text).not.toContain("아직 판단하지 못한 점검이");
        }
        // 체험 리포트에는 시간 알림(오래된 사진)이 없다(제목 문장의 첫 파라미터 앞부분으로 찾는다 — E 문구가 다듬어져도 따라간다)
        for (const level of ["stale", "very-stale"]) {
          const head = (lookup(`cc.time.snapshot-age.${level}.title`) ?? "").split("{")[0]?.trim() ?? "";
          expect(head.length).toBeGreaterThan(0);
          expect(text).not.toContain(head);
        }
        expect(designRenderGuards("report")).toEqual([]);
      });
    }
  }
});

describe("체험 실물 — 위험 점검의 V4(아슬아슬상회의 위험 점검 전부)", () => {
  for (const cloud of CLOUDS) {
    const risks = reportOf(cloud, "C").doors.flatMap((d) => d.rules).filter((r) => r.status === "risk");
    it(`${CLOUD_LABEL[cloud]} ${COMPANY.C}에는 위험 점검이 있다`, () => expect(risks.length).toBeGreaterThan(0));
    for (const risk of risks) {
      it(`${CLOUD_LABEL[cloud]} ${risk.ruleId}: [고치는 법] → V4 ⟦⟧ 0 · 금지어 0 · 누출 0, 카탈로그에 쓰기 명령이 있으면 쓰기 블록·자리표시자`, async () => {
        const entry = REAL_DEPS.catalog.find((e) => e.ruleId === risk.ruleId);
        const writes = entry?.fix?.change.commands.filter((c) => c.kind === "write").length ?? 0;
        const h = mount({ deps: REAL_DEPS, clock: CLOCK });
        await openDemo(h, cloud, "C");
        await h.user.click(document.getElementById(DOM_ID.ruleFix(risk.ruleId)) as HTMLElement);
        await waitFor(() => expect(h1().textContent).toBe("고치는 법"));
        if (writes > 0) {
          expect(mainEl().querySelectorAll(".cc-cmd--write").length).toBeGreaterThan(0);
          expect(mainEl().querySelectorAll(".cc-ph").length).toBeGreaterThan(0);
        }
        const text = visibleText();
        expect(missingKeys(text, { engine: true })).toEqual([]);
        expect(bannedHits(text)).toEqual([]);
        expect(attributeLeaks(sensitiveFulls(reportOf(cloud, "C")))).toEqual([]);
        expect(designRenderGuards("fix")).toEqual([]);
      });
    }
  }
});

describe("체험 실물 — Azure 현관(AZ-MFA-G 본인 응답)", () => {
  it("Azure 반듯상회: 현관은 '수집: 수집 안 함' 한 번, AZ-MFA-G 행에 본인 응답 라디오, 응답해도 상태·분포는 그대로", async () => {
    const report = reportOf("azure", "A");
    const h = mount({ deps: REAL_DEPS, clock: CLOCK });
    await openDemo(h, "azure", "A");
    // 수집 줄은 사유를 되풀이하지 않는다. (실제 Azure 수집기는 run.doors.mfa = "skipped"라 '수집: 수집 안 함'이 맞다 — real-engine.test.tsx가 본다.
    //  체험 데이터 빌더는 mfa를 "collected"로 적어 '일부만 수집됨'이 나온다 → lib 보고 항목. 여기서는 중복이 없는지만 본다)
    const door = document.getElementById(DOM_ID.door("mfa"))?.closest("section") as HTMLElement;
    const collect = door.querySelector(".cc-door__collect")?.textContent ?? "";
    expect(collect).toMatch(/^수집: (수집 안 함|일부만 수집됨)$/);
    const row = document.getElementById(DOM_ID.rule("AZ-MFA-G")) as HTMLElement;
    expect(row).not.toBeNull();
    await h.user.click(document.getElementById(DOM_ID.ruleToggle("AZ-MFA-G")) as HTMLElement);
    const radios = within(row).getAllByRole("radio");
    expect(radios.length).toBeGreaterThan(0);
    const before = Array.from(mainEl().querySelectorAll("#cc-dist-h ~ .cc-dist .cc-dc")).map((x) => x.textContent);
    await h.user.click(radios[0] as HTMLElement);
    expect(row.textContent).toContain("본인 응답");
    expect(row.querySelector(".cc-sb")?.textContent).toContain("확인 불가");
    expect(Array.from(mainEl().querySelectorAll("#cc-dist-h ~ .cc-dist .cc-dc")).map((x) => x.textContent)).toEqual(before);
    expect(report.distribution.rules.unknown).toBeGreaterThan(0);
  });
});

describe("V1 수집기 원문 — 긴 줄·읽기 안내(D4 통합)", () => {
  const COLLECTOR_DIR = path.resolve(__dirname, "../../../../../lib/cloudcheck/collector");
  const installCollector = (cloud: Cloud): void => {
    const el = document.createElement("script");
    el.type = "text/plain";
    el.id = BLOCK.collector(cloud);
    el.textContent = readFileSync(path.join(COLLECTOR_DIR, `cloudcheck-${cloud}.sh`), "utf8");
    document.body.appendChild(el);
  };
  afterEach(() => document.querySelectorAll('script[id^="cc-collector-"]').forEach((el) => el.remove()));
  for (const cloud of CLOUDS) {
    it(`${CLOUD_LABEL[cloud]}: 예상 호출 목록 아래에 원문 글자({code}, translate=no)가 든 안내 한 줄, 원문의 가장 긴 줄도 한 줄(span)로 그대로 있다`, async () => {
      installCollector(cloud);
      const h = mount({ deps: REAL_DEPS, clock: CLOCK, availability: { aws: "beta", azure: "beta" } });
      await h.user.click(screen.getByRole("button", { name: cloud === "aws" ? "AWS 점검 시작" : "Azure 점검 시작" }));
      await waitFor(() => expect(h1().textContent).toBe("수집 준비"));
      const token = cloud === "aws" ? "AWS_IGNORE_CONFIGURED_ENDPOINT_URLS=true" : "az version";
      // 인라인 블록 칩(cc-pm)이 아니라 줄이 나뉘는 글자(cc-any) — 40자 환경 변수가 360px 화면을 넘치지 않게(D4 실브라우저 확인)
      const code = Array.from(mainEl().querySelectorAll("p.cc-hint code.cc-any")).find((c) => c.textContent === token);
      expect(code, token).toBeDefined();
      expect(code?.getAttribute("translate")).toBe("no");
      expect(code?.closest("p")?.textContent).not.toContain("⟦");
      // 원문은 가공 없이 줄 단위로 들어간다(소프트 줄바꿈은 CSS — styles.test.ts가 규칙을 본다)
      const longest = (readDemoScript(cloud) ?? "").split("\n").reduce((a, b) => (b.length > a.length ? b : a), "");
      expect(longest.length).toBeGreaterThan(1000);
      expect(Array.from(mainEl().querySelectorAll(".cc-sv__l")).some((l) => l.textContent === longest)).toBe(true);
    });
  }
  const readDemoScript = (cloud: Cloud): string | null => document.getElementById(BLOCK.collector(cloud))?.textContent ?? null;
});
