// @vitest-environment jsdom
// DoorSection → RuleRow · NotCollectedGroup · NaFold · TargetTable · EvidenceList · GuideCard — 리포트 본문 렌더 가드(G-D3·5·7·8·11·12·13·15·21) 를 목업 전체(+ 적대 값)로.
import { fireEvent, render, screen, within } from "@testing-library/react";
import type { ReactElement } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { LINK_HOSTS, STATUS_ORDER, type DoorResult, type ExceptionOverlay, type IsoDate, type Report, type RuleId } from "../../../../lib/cloudcheck/model/report";
import { findBanned } from "../../../../lib/cloudcheck/model/banned-words";
import { lookup } from "../i18n/index";
import { MOCK_CATALOG_BY_ID } from "../mocks/catalog";
import { MOCK_OVERLAY_B } from "../mocks/extras";
import { MOCK_REPORTS, REPORT_AZURE_A, REPORT_B, REPORT_C, REPORT_D, REPORT_HOSTILE, REPORT_REAL_D } from "../mocks/reports";
import { DoorSection, type DoorHandlers, type DoorView } from "./DoorSection";
import { attrValues, classTokens, unexpectedMissing, visibleText } from "./__tests__/render";

const TODAY = "2026-10-19" as IsoDate;
const view = (over: Partial<DoorView> = {}): DoorView => ({ openRules: new Set<RuleId>(), shownRows: {}, editingItemId: null, today: TODAY, selfAnswers: {}, ...over });
const handlers = (): DoorHandlers => ({
  onToggleRule: vi.fn(),
  onFix: vi.fn(),
  onShowManual: vi.fn(),
  onMoreRows: vi.fn(),
  canMarkException: (item) => item.status === "risk" || item.status === "caution",
  onOpenExceptionForm: vi.fn(),
  onCloseExceptionForm: vi.fn(),
  onSaveException: vi.fn(),
  onRemoveException: vi.fn(),
  onSelfAnswer: vi.fn(),
});

function Doors({ report, overlay = null, v = view(), on = handlers() }: { report: Report; overlay?: ExceptionOverlay | null; v?: DoorView; on?: DoorHandlers }): ReactElement {
  return (
    <div className="cc-report">
      {report.doors.map((d) => (
        <DoorSection key={d.door} door={d} catalog={MOCK_CATALOG_BY_ID} inputs={report.collection.inputs} overlay={overlay} view={v} on={on} />
      ))}
    </div>
  );
}

/** 리포트 안의 모든 사용자 데이터 전체 값(3자 이상) */
function sensitiveFulls(report: Report): string[] {
  const out: string[] = [];
  const walk = (x: unknown): void => {
    if (typeof x !== "object" || x === null) return;
    if (x instanceof Map) {
      x.forEach(walk);
      return;
    }
    const o = x as Record<string, unknown>;
    if (o.kind === "sensitive" && typeof o.full === "string" && o.full.length >= 3) out.push(o.full);
    for (const v of Object.values(o)) walk(v);
  };
  walk(report);
  return out;
}

const ALL: readonly [string, Report][] = [
  ["C", MOCK_REPORTS.C],
  ["D", MOCK_REPORTS.D],
  ["A", MOCK_REPORTS.A],
  ["B", MOCK_REPORTS.B],
  ["Azure A", REPORT_AZURE_A],
  ["실제 D", REPORT_REAL_D],
  ["적대", REPORT_HOSTILE],
];

describe("DoorSection — 목업 전체 렌더 가드", () => {
  for (const [name, report] of ALL) {
    describe(name, () => {
      // RTL은 테스트마다 정리하므로 describe 본문이 아니라 beforeEach에서 그린다(안 그러면 두 번째 테스트부터 빈 DOM을 검사해 거짓 통과한다)
      let container: HTMLElement;
      beforeEach(() => {
        container = render(<Doors report={report} />).container;
      });

      it("문 구역 5개(DOORS 순서), 문 머리에 StatusBadge 없음(G-D12), <details> 없음(G-D7), 쓰기 명령 없음(G-D13)", () => {
        expect(Array.from(container.querySelectorAll("section.cc-door > .cc-door__head h2")).map((h) => h.textContent?.replace(/\s+/g, " ").trim().split(" ")[0])).toEqual(["현관", "열쇠", "창문", "창고", "CCTV"]);
        expect(container.querySelectorAll(".cc-door__head .cc-sb")).toHaveLength(0);
        expect(container.querySelectorAll("details")).toHaveLength(0);
        expect(container.querySelectorAll(".cc-cmd--write")).toHaveLength(0);
      });

      it("점검 행은 모두 접힌 채(aria-expanded=false) 본문이 DOM에 있고, 위험·주의·확인 불가 본문만 인쇄 펼침(cc-po)", () => {
        expect(container.querySelectorAll("li.cc-rule").length).toBeGreaterThan(0);
        for (const li of Array.from(container.querySelectorAll("li.cc-rule"))) {
          const toggle = li.querySelector("h3 > button.cc-tog");
          if (toggle === null) continue; // 요약만 있는 줄(카탈로그에 없는 점검·묶음 안 줄)
          expect(toggle.getAttribute("aria-expanded")).toBe("false");
          const body = document.getElementById(toggle.getAttribute("aria-controls") ?? "") as HTMLElement;
          expect(body.classList.contains("cc-fold")).toBe(true);
          expect(body.classList.contains("cc-open")).toBe(false);
          const clearOrNa = li.classList.contains("cc-st--clear") || li.classList.contains("cc-st--na");
          expect(body.classList.contains("cc-po"), li.id).toBe(!clearOrNa);
        }
      });

      it("모든 상태 도형(.cc-si--{s})은 같은 배지·칩·범례 안에 상태 글자가 있다(G-D3)", () => {
        const words = { risk: "위험", caution: "주의", clear: "이상 없음", unknown: "확인 불가", na: "해당 없음" } as const;
        expect(container.querySelectorAll(".cc-si").length).toBeGreaterThan(0);
        for (const icon of Array.from(container.querySelectorAll(".cc-si"))) {
          const s = STATUS_ORDER.find((x) => icon.classList.contains(`cc-si--${x}`));
          const host = icon.closest(".cc-sb, .cc-dc, .cc-legend");
          expect(host, "도형이 상태 배지·칩·범례 밖에 있다").not.toBeNull();
          expect(host?.textContent).toContain(words[s as keyof typeof words]);
        }
      });

      it("이상 없음 행: 꼬리표(확인한 범위·기준 시각) + '못 본 것 n' 칩 / 해당 없음 행: 근거 줄 + 꼬리표 (G-D11)", () => {
        for (const li of Array.from(container.querySelectorAll("li.cc-rule.cc-st--clear"))) {
          expect(li.querySelector(".cc-rule__tail")?.textContent, li.id).toContain("확인한 범위:");
          expect(li.querySelector(".cc-rule__tail")?.textContent).toContain("기준 시각:");
          expect(Array.from(li.querySelectorAll(".cc-chip--strong")).some((c) => /^못 본 것 \d+$/.test(c.textContent ?? ""))).toBe(true);
        }
        for (const li of Array.from(container.querySelectorAll("li.cc-rule.cc-st--na"))) {
          expect(li.querySelector(".cc-rule__why")?.textContent, "근거 줄").toContain("근거:");
          expect(li.querySelector(".cc-rule__tail")).not.toBeNull();
        }
      });

      it("외부 링크: 새 탭 + rel + 호스트 글자 + 허용 호스트(G-D5), href 속성은 a에만", () => {
        for (const a of Array.from(container.querySelectorAll("a"))) {
          expect(a.getAttribute("target")).toBe("_blank");
          expect(a.getAttribute("rel")).toMatch(/noopener/);
          expect(a.getAttribute("rel")).toMatch(/noreferrer/);
          const host = new URL(a.getAttribute("href") ?? "").host;
          expect((LINK_HOSTS as readonly string[]).includes(host)).toBe(true);
          expect(a.textContent).toContain(host);
        }
        expect(Array.from(container.querySelectorAll("[href]")).every((e) => e.tagName === "A")).toBe(true);
      });

      it("속성·id·aria 값에 사용자 데이터 0(G-D8), 클래스는 전부 cc- 접두(G-D15), C·S 카탈로그 키 누락 0", () => {
        const attrs = attrValues(container);
        expect(attrs.length).toBeGreaterThan(0);
        for (const full of sensitiveFulls(report)) {
          expect(attrs.filter((a) => a.includes(full)), `속성에 ${full}`).toEqual([]);
        }
        expect(classTokens(container).filter((c) => !c.startsWith("cc-"))).toEqual([]);
        expect(unexpectedMissing(container)).toEqual([]);
      });

      it("img·script·iframe 요소 0, 금지어 0(화면 글자 기준, 키 허용 문구 제외)", () => {
        expect(container.querySelector("img, script, iframe, object, embed")).toBeNull();
        const text = visibleText(container);
        expect(text.length).toBeGreaterThan(100);
        const hits = findBanned(text).map((h) => `${h.label}:${h.match}`);
        expect(hits).toEqual([]);
      });
    });
  }
});

describe("DoorSection — 구조", () => {
  const door = (r: Report, id: DoorResult["door"]): DoorResult => r.doors.find((d) => d.door === id) as DoorResult;

  it("문 머리: 문 이름 + 용어 + 점검 단위 분포 칩(0 생략) + '직접 볼 것 n'(0도 표시)", () => {
    const { container } = render(<DoorSection door={door(REPORT_C, "mfa")} catalog={MOCK_CATALOG_BY_ID} inputs={REPORT_C.collection.inputs} overlay={null} view={view()} on={handlers()} />);
    const head = container.querySelector(".cc-door__head") as HTMLElement;
    expect(head.querySelector("h2")?.textContent).toContain("현관");
    expect(head.querySelector(".cc-door__term")?.textContent).toBe("MFA");
    const chips = Array.from(head.querySelectorAll("li.cc-dc")).map((c) => c.textContent);
    expect(chips.every((c) => !/ 0$/.test(c ?? ""))).toBe(true); // 0 칩 생략
    expect(head.textContent).toContain("직접 볼 것 0");
    expect(container.querySelector("section")?.getAttribute("aria-label")).toBe("현관 구역(MFA)");
  });

  it("수집 줄: 수집됨은 기준 시각, 일부 수집·수집 안 함은 사유(짧은 이름)", () => {
    const keyD = door(REPORT_D, "key");
    expect(keyD.collection.status).toBe("partial");
    const { container } = render(<DoorSection door={keyD} catalog={MOCK_CATALOG_BY_ID} inputs={REPORT_D.collection.inputs} overlay={null} view={view()} on={handlers()} />);
    expect(container.querySelector(".cc-door__collect")?.textContent).toContain("수집: 일부만 수집됨 ·");
    const collected = render(<DoorSection door={door(REPORT_C, "key")} catalog={MOCK_CATALOG_BY_ID} inputs={REPORT_C.collection.inputs} overlay={null} view={view()} on={handlers()} />);
    expect(collected.container.querySelector(".cc-door__collect")?.textContent).toContain("수집: 수집됨 · 기준 시각 2026-10-19 12:12 KST (03:12 UTC)");
  });

  it("수집하지 않은 문: 점검 행 대신 NotCollectedGroup 한 줄('확인 불가' 배지 + 점검 n개), 펼치면 요약줄들(인쇄도 펼침)", () => {
    const notCollected = REPORT_D.doors.find((d) => d.collection.status === "not-collected") as DoorResult;
    expect(notCollected).toBeDefined();
    const { container } = render(<DoorSection door={notCollected} catalog={MOCK_CATALOG_BY_ID} inputs={REPORT_D.collection.inputs} overlay={null} view={view()} on={handlers()} />);
    const group = container.querySelector(".cc-ncg") as HTMLElement;
    const btn = within(group).getByRole("button");
    expect(btn.textContent).toContain("확인 불가");
    expect(btn.textContent).toContain(`수집하지 않아 판단하지 못한 점검 ${notCollected.rules.length}개`);
    expect(btn.getAttribute("aria-expanded")).toBe("false");
    expect(container.querySelectorAll("h3 > button.cc-tog")).toHaveLength(0); // 행마다 토글은 없다
    fireEvent.click(btn);
    const region = document.getElementById(btn.getAttribute("aria-controls") ?? "") as HTMLElement;
    expect(region.classList.contains("cc-open")).toBe(true);
    expect(region.querySelectorAll("li.cc-rule")).toHaveLength(notCollected.rules.length);
    for (const li of Array.from(region.querySelectorAll("li.cc-rule"))) expect(li.textContent).toContain("확인 불가");
  });

  // D4 통합(프론트팀장): 실제 엔진은 Azure 현관을 수집 안 함(사유 not-collected)으로 두고 AZ-MFA-G(안내 카드)를 확인 불가로 준다
  it("수집 안 한 문의 안내 카드 점검(AZ-MFA-G)은 묶음 줄이 아니라 일반 점검 행 — 본인 응답 라디오가 행 본문에 있다", () => {
    const base = door(REPORT_AZURE_A, "mfa");
    expect(base.rules.some((r) => r.ruleId === "AZ-MFA-G")).toBe(true);
    const nc: DoorResult = { ...base, collection: { status: "not-collected", judgeLevel: "none", reason: { code: "not-collected" }, asOf: null, inputIndex: null } };
    const on = handlers();
    const { container } = render(<DoorSection door={nc} catalog={MOCK_CATALOG_BY_ID} inputs={REPORT_AZURE_A.collection.inputs} overlay={null} view={view({ openRules: new Set<RuleId>(["AZ-MFA-G"]) })} on={on} />);
    expect(container.querySelector(".cc-ncg")).toBeNull();
    const row = container.querySelector("#cc-rule-AZ-MFA-G") as HTMLElement;
    expect(row).not.toBeNull();
    expect(row.querySelector("h3 > button.cc-tog")?.getAttribute("aria-expanded")).toBe("true");
    const radios = within(row).getAllByRole("radio");
    expect(radios.length).toBeGreaterThan(0);
    fireEvent.click(radios[0] as HTMLElement);
    expect(on.onSelfAnswer).toHaveBeenCalledWith("AZ-MFA-G", expect.any(String), expect.any(String));
    // 수집 줄: 사유 'not-collected'는 상태 글자와 같은 말이라 붙이지 않는다
    expect(container.querySelector(".cc-door__collect")?.textContent).toBe("수집: 수집 안 함");
  });

  it("수집 줄 사유: not-collected는 빼고(일부 수집도), 정보가 있는 사유는 짧은 이름으로 붙인다", () => {
    const base = door(REPORT_C, "net");
    const line = (collection: DoorResult["collection"]): string => {
      const r = render(<DoorSection door={{ ...base, collection }} catalog={MOCK_CATALOG_BY_ID} inputs={REPORT_C.collection.inputs} overlay={null} view={view()} on={handlers()} />);
      const text = r.container.querySelector(".cc-door__collect")?.textContent ?? "";
      r.unmount();
      return text;
    };
    expect(line({ status: "not-collected", judgeLevel: "none", reason: { code: "not-collected" }, asOf: null, inputIndex: null })).toBe("수집: 수집 안 함");
    expect(line({ status: "not-collected", judgeLevel: "none", reason: null, asOf: null, inputIndex: null })).toBe("수집: 수집 안 함");
    // 사유의 짧은 이름은 E 카탈로그 값을 그대로 쓴다(디자인팀장이 문구를 다듬어도 따라간다)
    expect(line({ status: "not-collected", judgeLevel: "none", reason: { code: "parse-failed" }, asOf: null, inputIndex: null })).toBe(`수집: 수집 안 함 · ${lookup("cc.reason.short.parse-failed") ?? "?"}`);
    expect(line({ status: "partial", judgeLevel: "full", reason: { code: "not-collected" }, asOf: null, inputIndex: null })).toBe("수집: 일부만 수집됨");
    expect(line({ status: "partial", judgeLevel: "full", reason: { code: "denied" }, asOf: null, inputIndex: null })).toBe(`수집: 일부만 수집됨 · ${lookup("cc.reason.short.denied") ?? "?"}`);
  });

  it("해당 없음 점검은 문 끝의 '해당 없음 n개' 한 줄로 접힌다(인쇄 펼침)", () => {
    const keyA = door(MOCK_REPORTS.A, "key");
    const naCount = keyA.rules.filter((r) => r.status === "na").length;
    expect(naCount).toBeGreaterThan(0);
    const { container } = render(<DoorSection door={keyA} catalog={MOCK_CATALOG_BY_ID} inputs={MOCK_REPORTS.A.collection.inputs} overlay={null} view={view()} on={handlers()} />);
    const btn = screen.getByRole("button", { name: new RegExp(`해당 없음 ${naCount}개`) });
    const region = document.getElementById(btn.getAttribute("aria-controls") ?? "") as HTMLElement;
    expect(region.classList.contains("cc-po")).toBe(true);
    expect(region.querySelectorAll("li.cc-rule.cc-st--na")).toHaveLength(naCount);
    // 점검 행 목록에는 해당 없음이 들어 있지 않다
    expect(container.querySelectorAll("section > ul > li.cc-rule.cc-st--na")).toHaveLength(0);
  });

  it("그 문의 실제 사례: priority가 가장 작은 incident 1건만, 새 탭 링크(사례가 없는 문은 줄 없음)", () => {
    // 실제 카탈로그 18장은 incident가 모두 null이다(목업도 null) → 이 시험만 창고 두 점검에 사례를 넣은 카탈로그를 만든다.
    // 제목 키는 실제 E 카탈로그에 있는 키를 빌린다(cc.incident.* 키는 아직 없다 — 생기면 그 키로 바꾼다)
    const sto = door(REPORT_C, "sto");
    const ids = sto.rules.map((r) => r.ruleId);
    expect(ids.length).toBeGreaterThan(1);
    const withIncident = new Map(MOCK_CATALOG_BY_ID);
    const link = { href: "https://docs.aws.amazon.com/AmazonS3/latest/userguide/access-control-block-public-access.html", host: "docs.aws.amazon.com" } as const;
    for (const [i, id] of ids.entries()) {
      const e = withIncident.get(id);
      if (e !== undefined) withIncident.set(id, { ...e, incident: { titleKey: "cc.basis.aws-sto-2.block-public-access", date: (i === 0 ? "2026-01-15" : "2025-03-01") as IsoDate, link, sourceName: `src-${e.priority}` } });
    }
    const best = Math.min(...ids.map((id) => withIncident.get(id)?.priority ?? Infinity));
    const { container } = render(<DoorSection door={sto} catalog={withIncident} inputs={REPORT_C.collection.inputs} overlay={null} view={view()} on={handlers()} />);
    const inc = container.querySelectorAll(".cc-door__inc");
    expect(inc).toHaveLength(1);
    expect(inc[0]?.querySelector("a[target='_blank']")).not.toBeNull();
    expect(inc[0]?.textContent).toContain("실제 사례:");
    expect(inc[0]?.textContent).toContain(`src-${best}`);
    expect(inc[0]?.textContent).not.toContain("⟦");
    // 목업(=실제와 같이 사례 없음)으로는 사례 줄이 없다
    const plain = render(<DoorSection door={sto} catalog={MOCK_CATALOG_BY_ID} inputs={REPORT_C.collection.inputs} overlay={null} view={view()} on={handlers()} />);
    expect(plain.container.querySelectorAll(".cc-door__inc")).toHaveLength(0);
  });

  it("view.openRules에 있는 점검만 펼쳐진다(cc-open), 토글은 onToggleRule(점검 id)", () => {
    const on = handlers();
    const net = door(REPORT_C, "net");
    const id = net.rules[0]?.ruleId as RuleId;
    const { container } = render(<DoorSection door={net} catalog={MOCK_CATALOG_BY_ID} inputs={REPORT_C.collection.inputs} overlay={null} view={view({ openRules: new Set([id]) })} on={on} />);
    const li = container.querySelector(`#cc-rule-${id}`) as HTMLElement;
    const toggle = li.querySelector("h3 > button") as HTMLElement;
    expect(toggle.getAttribute("aria-expanded")).toBe("true");
    expect(li.querySelector(".cc-rule__body")?.classList.contains("cc-open")).toBe(true);
    fireEvent.click(toggle);
    expect(on.onToggleRule).toHaveBeenCalledWith(id);
  });

  it("예외 오버레이가 붙어도 대상의 상태 배지는 그대로(G-D21) — 라벨·행 클래스만 더해진다", () => {
    const sto = door(REPORT_B, "sto");
    const statusesOf = (c: HTMLElement): string[] => Array.from(c.querySelectorAll("table.cc-tt tbody tr:not(.cc-print-only):not(.cc-tt__form) .cc-sb")).map((e) => e.textContent ?? "");
    const open = new Set(sto.rules.map((r) => r.ruleId));
    const plain = render(<DoorSection door={sto} catalog={MOCK_CATALOG_BY_ID} inputs={REPORT_B.collection.inputs} overlay={null} view={view({ openRules: open })} on={handlers()} />);
    const withExc = render(<DoorSection door={sto} catalog={MOCK_CATALOG_BY_ID} inputs={REPORT_B.collection.inputs} overlay={MOCK_OVERLAY_B} view={view({ openRules: open })} on={handlers()} />);
    expect(statusesOf(withExc.container)).toEqual(statusesOf(plain.container));
    expect(withExc.container.querySelectorAll("tr.cc-exc").length).toBeGreaterThan(0);
    expect(plain.container.querySelectorAll("tr.cc-exc")).toHaveLength(0);
    expect(withExc.container.querySelector(".cc-excl")?.textContent).toContain("예외 표시(상태는 그대로)");
  });
});
