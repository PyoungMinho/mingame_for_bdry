// QA FO-01 — 원시 파일 수준 증거 제거의 단조성 (설계서 §4-1, 빈 곳 ①)
// 회사 JSON 8개 + AWS 보고서 CSV 4개에 '증거를 줄이는' 변이(qa/raw-mutations.ts)를 가하고 recognize → buildInput → judge 전체 경로를 돌린다.
// 기대: ① 어떤 룰도 위험·주의·확인 불가 → 이상 없음·해당 없음으로 가지 않는다 ② 같은 (룰, MatchKey) 대상이 이상 없음이 아니던 것이 이상 없음이 되지 않는다
//       ③ 거부된 파일(not-cloudcheck 등)·정규화 실패는 통과로 본다 ④ checkReport 위반 0.
// 리프 null·키 삭제는 시드 고정 표본(회사당 각 250개)이다. 회사당 파이프라인 실행은 약 1천 회 이하(설계서 시간 예산 ≤3,000).
import { describe, expect, it, vi } from "vitest";
import { companyCsv, companyJson, monotoneViolations, okReport, runCsv, runJson, SETS } from "./kit";
import { csvMutations, jsonMutations } from "./raw-mutations";

vi.setConfig({ testTimeout: 120_000 });

interface Tally { runs: number; accepted: number; rejected: number; violations: string[] }
function exercise(kind: "json" | "csv", cloud: "aws" | "azure", set: (typeof SETS)[number]): Tally {
  const t: Tally = { runs: 0, accepted: 0, rejected: 0, violations: [] };
  if (kind === "json") {
    const base = companyJson(cloud, set);
    const before = okReport(runJson(base), `${cloud}-${set}`);
    for (const m of jsonMutations(base, { leafSample: 250, seed: 20261019 + set.charCodeAt(0) })) {
      t.runs++;
      const r = runJson(m.apply());
      if (r.kind !== "ok") { t.rejected++; continue; }
      t.accepted++;
      t.violations.push(...monotoneViolations(before, r.report, `[${cloud}-${set}] ${m.name}`));
    }
  } else {
    const text = companyCsv(set);
    const before = okReport(runCsv(text), `csv-${set}`);
    for (const m of csvMutations(text)) {
      t.runs++;
      const r = runCsv(m.apply() as string);
      if (r.kind !== "ok") { t.rejected++; continue; }
      t.accepted++;
      t.violations.push(...monotoneViolations(before, r.report, `[csv-${set}] ${m.name}`));
    }
  }
  return t;
}

describe("FO-01 수집기 JSON 변이 — 이상 없음·해당 없음이 새로 생기지 않는다", () => {
  for (const cloud of ["aws", "azure"] as const) for (const set of SETS) {
    it(`${cloud}-${set}`, () => {
      const t = exercise("json", cloud, set);
      expect(t.violations).toEqual([]);
      expect(t.runs).toBeGreaterThan(300);
      expect(t.accepted).toBeGreaterThan(50);   // 받아들인 변이가 있어야 판정 비교가 의미 있다
    });
  }
});

describe("FO-01 자격증명 보고서 CSV 변이 — 이상 없음·해당 없음이 새로 생기지 않는다", () => {
  for (const set of SETS) {
    it(`aws-${set}.credential-report.csv`, () => {
      const t = exercise("csv", "aws", set);
      expect(t.violations).toEqual([]);
      expect(t.accepted).toBeGreaterThan(20);
    });
  }
});
