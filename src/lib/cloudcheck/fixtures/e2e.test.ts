// 종단 시험: 가짜 회사 JSON → recognize → buildInput → judge → 사람이 먼저 쓴 정답지
// parse 모듈(API설계자)이 없으면 이 파일의 시험은 건너뛴다(describe.skipIf). 켜는 조건: src/lib/cloudcheck/parse/recognize.ts · normalize.ts가 있고 recognize · buildInput을 내보낸다.
// 건너뛴 경우에도 정답지 자체의 시험(answers.test.ts)과 파일 시험(companies/companies.test.ts)은 돈다.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { demoInputName } from "../contract/normalized";
import type { NormalizedInput } from "../contract/normalized";
import { checkInvariants as checkContractInvariants } from "../contract/normalized-invariants";
import { judge } from "../engine/judge";
import type { InputRecognition, Report, RuleResult, Status } from "../model/report";
import { RULE_CATALOG } from "../rules/catalog";
import { diffAnswer, summarizeReport } from "./answers";
import type { AnswerFile } from "./answers";
import { SET_IDS, companyCsvName, companyJsonName } from "./companies";
import type { SetId } from "./companies";
import { evidenceRemovingMutations } from "./mutate";
import { checkReport } from "./report-invariants";

interface RecognizeSource { readonly via: "file" | "paste" | "demo"; readonly name: string; readonly bytes: Uint8Array; readonly lastModified: number | null }
interface ParseApi {
  recognize(src: RecognizeSource): InputRecognition;
  buildInput(recs: readonly InputRecognition[]): { ok: true; input: NormalizedInput; recognitions: InputRecognition[] } | { ok: false; recognitions: InputRecognition[] };
}
async function loadParse(): Promise<ParseApi | null> {
  try {
    const base = "../parse/";
    const r = (await import(/* @vite-ignore */ `${base}recognize`)) as { recognize?: unknown };
    const n = (await import(/* @vite-ignore */ `${base}normalize`)) as { buildInput?: unknown };
    if (typeof r.recognize !== "function" || typeof n.buildInput !== "function") return null;
    return { recognize: r.recognize as ParseApi["recognize"], buildInput: n.buildInput as ParseApi["buildInput"] };
  } catch {
    return null;
  }
}
const api = await loadParse();

const COMPANIES = join(__dirname, "companies");
const ANSWERS = join(__dirname, "answers");
const bytesOf = (f: string): Uint8Array => new TextEncoder().encode(readFileSync(join(COMPANIES, f), "utf8"));
const answerOf = (set: SetId, cloud: "aws" | "azure"): AnswerFile => JSON.parse(readFileSync(join(ANSWERS, `${set}.${cloud}.json`), "utf8")) as AnswerFile;

function pipeline(set: SetId, cloud: "aws" | "azure"): { input: NormalizedInput; report: Report } {
  const p = api as ParseApi;
  const rec = p.recognize({ via: "demo", name: demoInputName(set, cloud), bytes: bytesOf(companyJsonName(cloud, set)), lastModified: null });
  expect(rec.status).toBe("ok");
  const built = p.buildInput([rec]);
  if (!built.ok) throw new Error(`buildInput 실패: ${set} ${cloud}`);
  return { input: built.input, report: judge(built.input) };
}

const rulesOf = (r: Report): RuleResult[] => r.doors.flatMap((d) => d.rules);
const catalog = (id: string) => RULE_CATALOG.find((e) => e.ruleId === id) as (typeof RULE_CATALOG)[number];
const itemRows = (r: Report, status: Status): number => rulesOf(r).reduce((n, x) => n + x.items.filter((i) => i.status === status).length, 0);

describe.skipIf(api === null)("종단: 가짜 회사 8곳 × 정답지", () => {
  const cases = SET_IDS.flatMap((s) => (["aws", "azure"] as const).map((c) => [s, c] as const));

  describe.each(cases)("세트 %s · %s", (set, cloud) => {
    const { input, report } = pipeline(set, cloud);
    const answer = answerOf(set, cloud);

    it("정답지와 같다 (알려진 차이만 허용)", () => {
      const { diffs, tolerated } = diffAnswer(answer, summarizeReport(report));
      expect(diffs, JSON.stringify(diffs, null, 1)).toEqual([]);
      for (const t of tolerated) console.info(`[알려진 차이] ${set} ${cloud} ${t.path}: 정답지 ${JSON.stringify(t.expected)} / 지금 ${JSON.stringify(t.actual)} — ${answer.tolerate?.[t.path]?.owner}`);
    });
    it("체험 모드 표시와 불변식: mode = demo(세트), 입력 불변식 · 리포트 불변식 위반 0", () => {
      expect(report.mode).toEqual({ kind: "demo", setId: set });
      expect(checkContractInvariants(input)).toEqual([]);
      expect(checkReport(report)).toEqual([]);
    });
    it("같은 파일을 다시 읽어 판정해도 바이트까지 같다 (INV-9)", () => {
      expect(JSON.stringify(pipeline(set, cloud).report)).toBe(JSON.stringify(report));
    });
    it("지정한 기준 시각이 리포트에 실린다 (2026-10-19T03:15:00Z)", () => {
      expect(report.collection.asOf?.at).toBe("2026-10-19T03:15:00Z");
    });
    it("증거를 줄이는 변이를 어떤 것을 가해도 이상 없음 · 해당 없음이 새로 생기지 않는다 (INV-3, 회사 입력 전수)", () => {
      const rank = (s: Status): boolean => s === "clear" || s === "na";
      const before = new Map(rulesOf(report).map((r) => [r.ruleId, r]));
      let n = 0;
      for (const m of evidenceRemovingMutations(input)) {
        let mutated: NormalizedInput;
        try { mutated = m.apply(input); } catch { continue; }
        const after = judge(mutated);
        expect(checkReport(after), m.name).toEqual([]);
        for (const r of rulesOf(after)) {
          const b = before.get(r.ruleId) as RuleResult;
          if (!rank(b.status)) expect(rank(r.status), `${m.name} ${r.ruleId}: ${b.status} → ${r.status}`).toBe(false);
          const was = new Map(b.items.map((i) => [i.resource.key, i.status]));
          for (const i of r.items) { const w = was.get(i.resource.key); if (w !== undefined && w !== "clear") expect(i.status, `${m.name} ${r.ruleId} ${i.resource.key}`).not.toBe("clear"); }
        }
        n++;
      }
      expect(n).toBeGreaterThan(20);
    });
  });
});

/* ───────── UX 11-3 요건 (시연해야 할 UI 상태)을 실제 Report에서 확인 ───────── */
describe.skipIf(api === null)("체험 세트가 화면에서 시연해야 하는 상태 (UX 11-3)", () => {
  const R = (set: SetId, cloud: "aws" | "azure"): Report => pipeline(set, cloud).report;

  it("A·AWS: 위험·주의·확인 불가 0개 → none-found, 이상 없음 4행 이상, 해당 없음 3행 이상(근거 줄), IdP 직접 볼 목록", () => {
    const r = R("A", "aws");
    expect(r.firstLook.mode).toBe("none-found");
    expect(rulesOf(r).filter((x) => x.status === "clear").length).toBeGreaterThanOrEqual(4);
    const na = rulesOf(r).filter((x) => x.status === "na");
    expect(na.length).toBeGreaterThanOrEqual(3);
    for (const x of na) expect(x.status === "na" && x.basis.code.startsWith(`${x.ruleId}:`)).toBe(true);
    expect(r.manualChecklist.some((m) => m.origin === "auto-notice" && m.ruleId === "AWS-MFA-2")).toBe(true);
    for (const x of rulesOf(r).filter((y) => y.status === "clear")) expect(x.asOf).not.toBeNull();
  });
  it("A·Azure: Entra MFA 가이드 카드(항상 확인 불가)만 남아 먼저 볼 것이 unlock(가이드)이다", () => {
    const r = R("A", "azure");
    expect(r.firstLook.mode).toBe("unlock");
    expect(rulesOf(r).filter((x) => x.status === "unknown").map((x) => x.ruleId)).toEqual(["AZ-MFA-G"]);
    expect(r.manualChecklist.some((m) => m.origin === "guide-card")).toBe(true);
  });
  it("B: 위험 0개, 주의 대상 6행 이상, 주의 룰마다 질문 문구, 옛 버킷 · 의도된 공개 후보 라벨, 예외 연습용 주의 대상 2개 이상", () => {
    for (const cloud of ["aws", "azure"] as const) {
      const r = R("B", cloud);
      expect(rulesOf(r).some((x) => x.status === "risk")).toBe(false);
      expect(itemRows(r, "caution")).toBeGreaterThanOrEqual(6);
      for (const x of rulesOf(r).filter((y) => y.status === "caution")) expect(catalog(x.ruleId).questionKey, x.ruleId).not.toBeNull();
      const labels = rulesOf(r).flatMap((x) => x.items.flatMap((i) => i.labels.map((l) => l.kind)));
      expect(labels).toContain("intended-public-candidate");
      if (cloud === "aws") expect(labels).toContain("legacy-hint");
    }
  });
  it("C: 먼저 볼 것에 위험이 앞서고, 위험 행 4개 이상은 모두 고치는 법(fix)이 있고, 위험과 주의가 섞이고, 대상 표가 3행 이상이다", () => {
    for (const cloud of ["aws", "azure"] as const) {
      const r = R("C", cloud);
      expect(r.firstLook.mode).toBe("findings");
      const risky = rulesOf(r).filter((x) => x.status === "risk");
      expect(itemRows(r, "risk")).toBeGreaterThanOrEqual(4);
      for (const x of risky) expect(catalog(x.ruleId).fix, x.ruleId).not.toBeNull();
      expect(itemRows(r, "caution")).toBeGreaterThan(0);
      expect(rulesOf(r).some((x) => x.items.length >= 3)).toBe(true);
      if (r.firstLook.mode === "findings") {
        const doors = r.firstLook.ruleIds.map((id) => rulesOf(r).find((x) => x.ruleId === id)!.door);
        expect(new Set(doors).size).toBe(3);
        if (cloud === "aws") for (const id of r.firstLook.ruleIds) expect(rulesOf(r).find((x) => x.ruleId === id)!.status).toBe("risk");
      }
    }
  });
  it("D: 권한 힌트(권한 하나로 점검 2개 이상) · 알림 · 부분 거부 대상 · 빠진 범위 · 확인 불가 사유 5종 이상 · 직접 볼 목록", () => {
    for (const cloud of ["aws", "azure"] as const) {
      const r = R("D", cloud);
      expect(r.permissions.unlockHints.some((h) => h.unlocks.length >= 2), cloud).toBe(true);
      expect(r.banners.some((b) => b.kind === "areas-not-judged" || b.kind === "doors-skipped"), cloud).toBe(true);
      expect(rulesOf(r).some((x) => x.items.some((i) => i.why.code === "isolated-denial")), cloud).toBe(true);
      expect(r.scope.missing.length, cloud).toBeGreaterThanOrEqual(1);
      const reasons = new Set<string>();
      for (const x of rulesOf(r)) { if (x.status === "unknown") x.gaps.forEach((g) => reasons.add(g)); for (const i of x.items) if (i.status === "unknown") reasons.add(i.why.code); }
      expect(reasons.size, cloud).toBeGreaterThanOrEqual(5);
      const origins = new Set(r.manualChecklist.map((m) => m.origin));
      expect(origins.has("unknown-item")).toBe(true);
      expect(origins.has(cloud === "aws" ? "auto-notice" : "guide-card")).toBe(true);
      expect(r.firstLook.mode).toBe("findings");        // INV-7 주의가 있어 unlock이 아니라 findings
    }
  });
});

/* ───────── 자격증명 보고서 CSV만 올린 경우: 같은 사실을 보는 네 점검은 수집기 JSON과 같은 상태가 나와야 한다 ───────── */
describe.skipIf(api === null)("AWS 자격증명 보고서 CSV 단독 입력", () => {
  const SHARED = ["AWS-MFA-1", "AWS-MFA-2", "AWS-KEY-1", "AWS-KEY-2"];
  it.each(SET_IDS.map((s) => [s] as const))("세트 %s: CSV만으로 읽을 수 있는 점검(현관 · 열쇠의 보고서 기반 4개)은 수집기 JSON과 같은 상태이고, 나머지 문은 수집하지 않은 것으로 남는다", (set) => {
    const p = api as ParseApi;
    const rec = p.recognize({ via: "file", name: "credential-report.csv", bytes: bytesOf(companyCsvName(set)), lastModified: Date.UTC(2026, 9, 19, 3, 12, 9) });
    expect(rec.status).toBe("ok");
    expect(rec.kind).toBe("csv-credential-report");
    const built = p.buildInput([rec]);
    expect(built.ok).toBe(true);
    if (!built.ok) return;
    const csvReport = judge(built.input);
    expect(checkReport(csvReport)).toEqual([]);
    const jsonReport = pipeline(set, "aws").report;
    for (const id of SHARED) {
      const a = rulesOf(csvReport).find((x) => x.ruleId === id) as RuleResult;
      const b = rulesOf(jsonReport).find((x) => x.ruleId === id) as RuleResult;
      expect(a.status, `${id}: CSV ${a.status} / JSON ${b.status}`).toBe(b.status);
    }
    for (const id of ["AWS-NET-1", "AWS-STO-1", "AWS-STO-2", "AWS-LOG-1"]) {
      const a = rulesOf(csvReport).find((x) => x.ruleId === id) as RuleResult;
      expect(a.status).toBe("unknown");
      expect(a.why.code).toBe("not-collected");
    }
  });
});

/* ───────── 체험 데이터는 실제 수집기가 내는 문 상태와 같아야 한다 (예전에는 Azure 현관을 collected로 적어 '일부만 수집됨'으로 보였다) ───────── */
describe.skipIf(api === null)("체험 데이터의 문 상태 = 실제 수집기의 문 상태", () => {
  const doorOf = (r: Report, d: string) => r.doors.find((x) => x.door === d) as Report["doors"][number];
  const azureJson = (set: SetId): { run: { doors: Record<string, string> } } => JSON.parse(readFileSync(join(COMPANIES, companyJsonName("azure", set)), "utf8")) as { run: { doors: Record<string, string> } };

  it("실제 Azure 수집기 스크립트는 run.doors.mfa를 늘 \"skipped\"로 적는다 (이 시험이 체험 데이터가 따라야 할 기준을 못 박는다)", () => {
    const sh = readFileSync(join(__dirname, "..", "collector", "cloudcheck-azure.sh"), "utf8");
    expect(sh).toContain('doors: {mfa: "skipped"');
    expect(sh).toContain("DOORS=key,net,sto,log");                      // 수집할 수 있는 문에 mfa가 없다
  });
  it.each(SET_IDS.map((s) => [s] as const))("Azure 세트 %s: 파일의 mfa는 skipped이고, 리포트의 현관은 수집 안 함(none)이며 직접 볼 것은 가이드 카드뿐이다", (set) => {
    expect(azureJson(set).run.doors.mfa).toBe("skipped");
    const r = pipeline(set, "azure").report;
    expect(doorOf(r, "mfa").collection).toMatchObject({ status: "not-collected", judgeLevel: "none", reason: { code: "not-collected" }, asOf: null, inputIndex: null });
    expect(r.manualChecklist.filter((m) => m.door === "mfa").map((m) => m.origin)).toEqual(["guide-card"]);
  });
  it.each(SET_IDS.map((s) => [s] as const))("AWS 세트 %s: 현관은 수집기가 모으는 문이라 collected이다 (건너뛴 문만 skipped)", (set) => {
    const json = JSON.parse(readFileSync(join(COMPANIES, companyJsonName("aws", set)), "utf8")) as { run: { doors: Record<string, string> } };
    expect(json.run.doors.mfa).toBe("collected");
    expect(doorOf(pipeline(set, "aws").report, "mfa").collection.status).toBe("collected");
  });
  it.each(SET_IDS.map((s) => [s] as const))("예전 모양(mfa를 collected로 적은 Azure 파일)을 읽어도 현관은 수집 안 함이고 직접 볼 목록은 같다: 세트 %s", (set) => {
    const p = api as ParseApi;
    const old = azureJson(set);
    old.run.doors.mfa = "collected";
    const rec = p.recognize({ via: "demo", name: demoInputName(set, "azure"), bytes: new TextEncoder().encode(JSON.stringify(old)), lastModified: null });
    expect(rec.status).toBe("ok");
    const built = p.buildInput([rec]);
    if (!built.ok) throw new Error("buildInput 실패");
    const r = judge(built.input);
    expect(doorOf(r, "mfa").collection).toMatchObject({ status: "not-collected", judgeLevel: "none" });
    expect(r.manualChecklist.map((m) => `${m.origin}:${m.ruleId ?? m.door}`).sort()).toEqual(pipeline(set, "azure").report.manualChecklist.map((m) => `${m.origin}:${m.ruleId ?? m.door}`).sort());
    expect(checkReport(r)).toEqual([]);
  });
});
