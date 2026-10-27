// @vitest-environment jsdom
// QA EX-04 — 제목 × 상태(K-1 반영 뒤) (설계서 §4-5, 디자인 문구 검수 docs/design/cloudcheck-rule-copy-review.md §5)
// 룰마다 §5 표가 '낼 수 있다'(○·△)고 한 상태를 micro 픽스처 + 거부 변이로 실제로 만들고, 점검 행(RuleRow)을 렌더해 '[상태] 제목 — 사유' 줄을 읽는다.
// 기대: 표의 낼 수 있는 상태가 모두 만들어지고 렌더된다, ⟦키⟧ · 빈 자리 · 금지어 0, ✕ 0 —
//       AWS-NET-1 · AZ-NET-1 해당 없음 근거 = "보안 그룹 0개(확인됨)" · "NSG 0개(확인됨)"(K-1).
import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { judge } from "../../engine/judge";
import { deny } from "../../fixtures/mutate";
import { MICRO } from "../../fixtures/micro";
import type { IsoDate, RuleId, RuleResult, Status } from "../../model/report";
import { RULE_CATALOG } from "../../rules/catalog";
import { RULES } from "../../rules/registry";
import { RuleRow } from "../../../../app/cloudcheck/_client/components/RuleRow";
import { bannedHits } from "../../../../app/cloudcheck/_client/screens/__tests__/harness";

/** §5 표: 낼 수 있는 상태(○ · △). AZ-MFA-1은 released:false라 리포트에 나오지 않는다 */
const TABLE: Readonly<Partial<Record<RuleId, readonly Status[]>>> = {
  "AWS-STO-2": ["risk", "caution", "clear", "unknown", "na"],
  "AZ-STO-2": ["risk", "caution", "clear", "unknown", "na"],
  "AWS-NET-1": ["risk", "caution", "clear", "unknown", "na"],
  "AZ-NET-1": ["risk", "caution", "clear", "unknown", "na"],
  "AWS-KEY-4": ["risk", "caution", "clear", "unknown", "na"],
  "AWS-MFA-1": ["risk", "caution", "clear", "unknown", "na"],
  "AWS-MFA-2": ["risk", "clear", "unknown", "na"],
  "AZ-MFA-G": ["unknown"],
  "AWS-KEY-3": ["caution", "unknown", "na"],
  "AWS-KEY-1": ["caution", "clear", "unknown", "na"],
  "AWS-KEY-2": ["caution", "clear", "unknown", "na"],
  "AZ-KEY-1": ["caution", "clear", "unknown", "na"],
  "AWS-STO-1": ["caution", "clear", "unknown"],
  "AZ-STO-1": ["caution", "clear", "unknown", "na"],
  "AWS-LOG-1": ["caution", "clear", "unknown"],
  "AZ-LOG-1": ["caution", "clear", "unknown", "na"],
  "AZ-LOG-2": ["caution", "clear", "unknown", "na"],
};

/** 룰별로 만들 수 있는 결과: micro 사례 전부 + 사례마다 거부 변이(fixtures.denied 호출) */
function samples(id: RuleId): Map<Status, RuleResult> {
  const out = new Map<Status, RuleResult>();
  const mod = RULES.find((m) => m.spec.ruleId === id);
  const take = (r: RuleResult | undefined): void => { if (r !== undefined && !out.has(r.status)) out.set(r.status, r); };
  const pick = (rep: ReturnType<typeof judge>): RuleResult | undefined => rep.doors.flatMap((d) => d.rules).find((x) => x.ruleId === id);
  for (const make of Object.values(MICRO[id] ?? {})) {
    const input = make();
    take(pick(judge(input)));
    const d = mod?.spec.fixtures.denied;
    if (d !== undefined && "call" in d) { try { take(pick(judge(deny(input, d.call, { ...("resource" in d && d.resource ? { resource: d.resource } : {}), ...("region" in d && d.region ? { region: d.region } : {}) })))); } catch { /* 그 호출이 없는 사례 */ } }
    for (const call of mod?.spec.calls ?? []) { try { take(pick(judge(deny(input, call)))); } catch { /* 그 호출이 없는 사례 */ } }
  }
  if (id === "AZ-MFA-G") {
    const any = Object.values(MICRO["AZ-NET-1"])[0];
    take(pick(judge(any())));
  }
  return out;
}

const WORD: Readonly<Record<Status, string>> = { risk: "위험", caution: "주의", unknown: "확인 불가", clear: "이상 없음", na: "해당 없음" };
function lineOf(rule: RuleResult): string {
  const entry = RULE_CATALOG.find((e) => e.ruleId === rule.ruleId);
  if (entry === undefined) throw new Error(`카탈로그 없음 ${rule.ruleId}`);
  const table = { rule, overlay: null, shown: 50, onMore: vi.fn(), canMark: () => false, editingId: null, onOpenForm: vi.fn(), onSave: vi.fn(), onRemove: vi.fn(), today: "2026-10-19" as IsoDate };
  const { container } = render(<ul><RuleRow rule={rule} entry={entry} open={false} onToggle={vi.fn()} table={table} /></ul>);
  const badge = container.querySelector(".cc-sb")?.textContent?.trim() ?? "";
  const title = container.querySelector(".cc-rule__title")?.textContent?.trim() ?? "";
  const why = container.querySelector(".cc-rule__why")?.textContent?.trim() ?? "";
  cleanup();
  return `[${badge}] ${title} — ${why}`;
}

afterEach(() => cleanup());

describe("EX-04 제목 × 상태 — §5 표의 낼 수 있는 상태마다 줄을 렌더한다", () => {
  for (const [id, want] of Object.entries(TABLE) as [RuleId, readonly Status[]][]) {
    it(`${id}: ${want.map((s) => WORD[s]).join(" · ")}`, () => {
      const got = samples(id);
      const missing = want.filter((s) => !got.has(s));
      expect(missing, `만들지 못한 상태(픽스처 보강 필요)`).toEqual([]);
      const bad: string[] = [];
      for (const s of want) {
        const line = lineOf(got.get(s) as RuleResult);
        if (!line.startsWith(`[${WORD[s]}`)) bad.push(`상태 글자: ${line}`);
        if (/⟦|\{[A-Za-z][A-Za-z0-9]*\}/.test(line)) bad.push(`키·자리: ${line}`);
        const hits = bannedHits(line);
        if (hits.length > 0) bad.push(`금지어 ${hits.join(",")}: ${line}`);
        if (/ — $/.test(line)) bad.push(`사유 줄 없음: ${line}`);
      }
      expect(bad).toEqual([]);
    });
  }
  it("K-1: AWS-NET-1 · AZ-NET-1 해당 없음의 근거 줄은 '보안 그룹 0개(확인됨)' · 'NSG 0개(확인됨)'(주의 사유가 근거로 나가지 않는다)", () => {
    expect(lineOf(samples("AWS-NET-1").get("na") as RuleResult)).toMatch(/— 근거: 보안 그룹 0개\(확인됨\)$/);
    expect(lineOf(samples("AZ-NET-1").get("na") as RuleResult)).toMatch(/— 근거: NSG 0개\(확인됨\)$/);
  });
  it("§5 표에서 '—'(낼 수 없음)인 상태는 micro 전부와 거부 변이에서 나오지 않는다", () => {
    const extra: string[] = [];
    for (const [id, want] of Object.entries(TABLE) as [RuleId, readonly Status[]][]) for (const s of samples(id).keys()) if (!want.includes(s)) extra.push(`${id}: ${s}`);
    expect(extra).toEqual([]);
  });
});

/* ───────── EX-04 확장: 디자인 §8-5(2026-10-20 새 사유) — 실제 엔진 결과로 '[상태] 제목 — 사유' 줄을 읽는다 ───────── */
import { companyJson as _cj, okReport as _ok, ruleOf as _rule, runJson as _run } from "../kit";
import type { Json as _Json } from "../kit";
const lineFor = (f: _Json, id: RuleId): string => lineOf(_rule(_ok(_run(f)), id));
const sgsOf = (f: _Json): _Json[] => (f.data.securityGroups as _Json[]).flatMap((p) => p.items ?? []);
const clean = (line: string): string[] => [...(/⟦|\{[A-Za-z][A-Za-z0-9]*\}/.test(line) ? [`키·자리: ${line}`] : []), ...bannedHits(line).map((h) => `금지어 ${h}: ${line}`)];

describe("EX-04 확장 — 디자인 §8-5 새 사유 줄(✕ 0)", () => {
  it("AWS-NET-1 룰 주의(출발지 확인만): 넓은 대역 · 프리픽스 리스트를 말하고 '인터넷 전체'라고 하지 않는다", () => {
    const f = _cj("aws", "C");
    const s = sgsOf(f);
    s.find((x) => x.groupId === "sg-0c0ffee1").ingress = [{ protocol: "tcp", fromPort: 22, toPort: 22, cidrs: ["1.0.0.0/8"], ipv6Cidrs: [], prefixListIds: [], sgRefCount: 0 }];
    s.find((x) => x.groupId === "sg-0c0ffee2").ingress = [{ protocol: "tcp", fromPort: 3306, toPort: 3306, cidrs: [], ipv6Cidrs: [], prefixListIds: ["pl-0123abcd"], sgRefCount: 0 }];
    const line = lineFor(f, "AWS-NET-1");
    expect(line.startsWith("[주의")).toBe(true);
    expect(line).toMatch(/넓은 공인/);
    expect(line).toMatch(/프리픽스 리스트/);
    expect(line).not.toMatch(/인터넷 전체/);
    expect(clean(line)).toEqual([]);
  });
  it("AWS-NET-1 룰 주의(범주 섞임 — open-review): '인터넷 전체'를 거짓으로 말하지 않는다", () => {
    const f = _cj("aws", "C");
    const s = sgsOf(f);
    s.find((x) => x.groupId === "sg-0c0ffee1").ingress = [{ protocol: "tcp", fromPort: 22, toPort: 22, cidrs: [], ipv6Cidrs: [], prefixListIds: ["pl-0123abcd"], sgRefCount: 0 }];
    s.find((x) => x.groupId === "sg-0c0ffee2").ingress = [{ protocol: "tcp", fromPort: 25, toPort: 25, cidrs: ["0.0.0.0/0"], ipv6Cidrs: [], prefixListIds: [], sgRefCount: 0 }];
    const r = _rule(_ok(_run(f)), "AWS-NET-1");
    expect(r.why.code).toBe("AWS-NET-1:open-review");
    const line = lineOf(r);
    expect(line.startsWith("[주의")).toBe(true);
    expect(line).not.toMatch(/인터넷 전체/);
    expect(clean(line)).toEqual([]);
  });
  it("AWS-LOG-1 룰 주의(전달 오류) · 이상 없음(전달 오류 기록 없음까지 말한다)", () => {
    const bad = _cj("aws", "A");
    bad.data.trails.value[0].status.value.hasDeliveryError = true;
    const caution = lineFor(bad, "AWS-LOG-1");
    expect(caution.startsWith("[주의")).toBe(true);
    expect(caution).toMatch(/오류 기록/);
    const clear = lineFor(_cj("aws", "A"), "AWS-LOG-1");
    expect(clear.startsWith("[이상 없음")).toBe(true);
    expect(clear).toMatch(/전달 오류 기록이 없/);
    expect([...clean(caution), ...clean(clear)]).toEqual([]);
  });
  it("AZ-NET-1 룰 주의(서비스 태그): 서비스 태그를 말하고 '인터넷 전체'라고 하지 않는다", () => {
    const f = _cj("azure", "C");
    const rule0 = (f.data.nsgs as _Json[]).flatMap((p) => p.items ?? []).find((n) => n.name === "nsg-acme-db").rules[0];
    rule0.sourcePrefixes = ["AzureCloud"];
    rule0.destPortRanges = ["22"];
    const jump = (f.data.nsgs as _Json[]).flatMap((p) => p.items ?? []).find((n) => n.name === "nsg-acme-jump");
    if (jump) for (const r of jump.rules) if ((r.access as string).toLowerCase() === "allow") r.sourcePrefixes = ["203.0.113.0/24"];
    const line = lineFor(f, "AZ-NET-1");
    expect(line.startsWith("[주의")).toBe(true);
    expect(line).toMatch(/서비스 태그/);
    expect(line).not.toMatch(/인터넷 전체/);
    expect(clean(line)).toEqual([]);
  });
});
